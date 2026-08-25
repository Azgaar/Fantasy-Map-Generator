import { select } from "d3";
import { closeDialogs, confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { showDomDialog } from "@/components/ui/dom-dialog";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import { setLabelOverride } from "@/controllers/editor-mutations";
import type { Label, LabelType } from "@/generators/labels-generator";
import { UNNAMED_ROUTE } from "@/generators/routes-generator";
import type { Point } from "@/generators/voronoi";
import {
  MAP_INTERACTION_HANDLE_EVENT,
  type MapInteractionHandleEventDetail
} from "@/renderers/interaction/map-interaction-overlay";
import { createLabelArc } from "@/renderers/labels/label-arc";
import type { LabelData } from "@/renderers/labels/labels";
import { drawLabels, getSceneLabel, redrawLabel } from "@/renderers/labels/labels-renderer";
import {
  clearMapInteractionOverlay,
  getPixiMapPointAtClient,
  updateMapInteractionOverlay
} from "@/renderers/pixi/pixi-renderer-controller";
import { speak } from "@/utils";
import { ensureEl, getSegmentId, rn } from "../utils";

let lastSelectedGroup = ""; // the default group for newly added labels
let label: LabelData;
let activeHandle:
  | { initialOffset: Point; kind: "label" }
  | { index: number; initialPoint: Point; kind: "path" }
  | null = null;

function open(type: LabelType, id: number): void {
  if (customization || type === "state") return;
  closeDialogs(".stable");
  if (!window.LayerControls.isLayerOn("toggleLabels")) window.LayerControls.toggleLayer("toggleLabels");

  const cachedLabel = getSceneLabel(type, id);
  if (!cachedLabel) return;
  label = { ...cachedLabel }; // the editor owns its copy and hands it back to the renderer on every change

  document.getElementById("map")?.addEventListener(MAP_INTERACTION_HANDLE_EVENT, editLabelHandle as EventListener);
  select<SVGElement, unknown>("#viewbox").on("click.labelEditor", addInterimControlPoint);

  renderDialog();

  showDomDialog({
    content: ensureEl("labelEditor"),
    onClose: closeLabelEditor,
    placement: "top-center",
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Edit Label",
    width: "fit-content"
  });

  drawControlPointsAndLine();
  selectLabelGroup(label.group);
  updateValues();
  updateControls();
}

function renderDialog(): void {
  destroyDialog("labelEditor");
  const editorHtml = /* html */ `<div id="labelEditor" class="dialog">
      <button id="labelGroupShow" data-tip="Show the group selection" class="icon-tags"></button>
      <div id="labelGroupSection" style="display: none">
        <button id="labelGroupHide" data-tip="Hide the group selection" class="icon-tags"></button>
        <select id="labelGroupSelect" data-tip="Select a group for this label" style="width: 10em"></select>
        <button
          id="labelGroupsConfigure"
          data-tip="Open the Label Groups Configurator to create, edit and reorder groups"
          class="icon-cog"
        ></button>
      </div>
      <button id="labelTextShow" data-tip="Show the edit label text section" class="icon-pencil"></button>
      <div id="labelTextSection" style="display: none">
        <button id="labelTextHide" data-tip="Hide the edit label text section" class="icon-pencil"></button>
        <input
          id="labelText"
          data-tip='Type to change the label. Enter "|" to move to a new line'
          style="width: 12em"
        />
        <span id="labelTextSpeak" data-tip="Speak the name. You can change voice and language in options" class="speaker">🔊</span>
        <span id="labelTextRandom" data-tip="Generate random name" class="icon-shuffle pointer"></span>
      </div>
      <button id="labelEditStyle" data-tip="Edit label group style in Style Editor" class="icon-brush"></button>
      <button id="labelPathToggle"></button>
      <button id="labelSizeShow" data-tip="Show the font size section" class="icon-text-height"></button>
      <div id="labelSizeSection" style="display: none">
        <button id="labelSizeHide" data-tip="Hide the font size section" class="icon-text-height"></button>
        <span data-tip="Set relative size for the particular label">Size:</span>
        <input
          id="labelRelativeSize"
          data-tip="Set relative size for the particular label (% of group default)"
          type="number"
          min="30"
          max="300"
          step="1"
          style="width: 4.5em"
        />
      </div>
      <button id="labelOffsetShow" data-tip="Show the label offset section" class="icon-sliders"></button>
      <div id="labelOffsetSection" style="display: none">
        <button id="labelOffsetHide" data-tip="Hide the label offset section" class="icon-sliders"></button>
        <span data-tip="Set starting offset for the particular label">Offset:</span>
        <input
          id="labelStartOffset"
          data-tip="Set starting offset for the particular label (% along the path)"
          type="range"
          min="20"
          max="80"
          style="width: 8em"
        />
        <input
          id="labelStartOffsetValue"
          type="number"
          min="20"
          max="80"
          step="1"
          style="width: 3.5em"
          data-tip="Set starting offset numerically"
        />
      </div>
      <button id="labelLetterSpacingShow" data-tip="Show the letter spacing section" class="icon-text-width"></button>
      <div id="labelLetterSpacingSection" style="display: none">
        <button
          id="labelLetterSpacingHide"
          data-tip="Hide the letter spacing section"
          class="icon-text-width"
        ></button>
        <slider-input
          id="labelLetterSpacingSize"
          style="display: inline-block"
          data-tip="Set the letter spacing size for this label"
          min="0"
          max="20"
          step=".01"
          value="0"
        ></slider-input>
      </div>
      <button id="labelVisibility"></button>
      <button id="labelLegend" data-tip="Edit free text notes (legend) for this label" class="icon-edit"></button>
      <button id="labelReset" data-tip="Restore the default label" class="icon-arrows-cw"></button>
      <button
        id="labelRemoveSingle"
        data-tip="Remove the label"
        data-shortcut="Delete"
        class="icon-trash fastDelete"
      ></button>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);

  ensureEl("labelGroupShow").addEventListener("click", showGroupSection);
  ensureEl("labelGroupHide").addEventListener("click", hideGroupSection);
  ensureEl("labelGroupSelect").addEventListener("change", changeGroup);
  ensureEl("labelGroupsConfigure").addEventListener("click", () => void Controllers.LabelGroupsConfigurator.open());

  ensureEl("labelTextShow").addEventListener("click", showTextSection);
  ensureEl("labelTextHide").addEventListener("click", hideTextSection);
  ensureEl("labelText").addEventListener("input", changeText);
  ensureEl("labelTextSpeak").addEventListener("click", () => speak(ensureEl<HTMLInputElement>("labelText").value));
  ensureEl("labelTextRandom").addEventListener("click", generateRandomName);

  ensureEl("labelEditStyle").addEventListener("click", editGroupStyle);

  ensureEl("labelSizeShow").addEventListener("click", showSizeSection);
  ensureEl("labelSizeHide").addEventListener("click", hideSizeSection);
  ensureEl("labelOffsetShow").addEventListener("click", showOffsetSection);
  ensureEl("labelOffsetHide").addEventListener("click", hideOffsetSection);
  ensureEl("labelStartOffset").addEventListener("input", changeStartOffset);
  ensureEl("labelStartOffsetValue").addEventListener("input", changeStartOffsetFromValue);
  ensureEl("labelRelativeSize").addEventListener("input", changeRelativeSize);

  ensureEl("labelLetterSpacingShow").addEventListener("click", showLetterSpacingSection);
  ensureEl("labelLetterSpacingHide").addEventListener("click", hideLetterSpacingSection);
  ensureEl("labelLetterSpacingSize").addEventListener("input", changeLetterSpacingSize);

  ensureEl("labelPathToggle").addEventListener("click", toggleLabelPath);
  ensureEl("labelVisibility").addEventListener("click", toggleLabelVisibility);
  ensureEl("labelLegend").addEventListener("click", editLabelLegend);
  ensureEl("labelReset").addEventListener("click", resetSelectedLabel);
  ensureEl("labelRemoveSingle").addEventListener("click", removeSelectedLabel);
}

function selectLabelGroup(group: string): void {
  lastSelectedGroup = group;

  hideGroupSection();
  const groupSelect = ensureEl<HTMLSelectElement>("labelGroupSelect");
  groupSelect.options.length = 0; // remove all options

  for (const groupOptions of options.labels.groups) {
    groupSelect.options.add(new Option(groupOptions.name, groupOptions.name, false, groupOptions.name === group));
  }
}

function updateControls(): void {
  const hasPath = hasLabelPath();
  const topButtonsVisible = !ensureEl("labelEditor").classList.contains("section-open");
  ensureEl("labelOffsetShow").style.display = topButtonsVisible && hasPath ? "inline-block" : "none";
  ensureEl("labelRemoveSingle").style.display = topButtonsVisible && label.type === "added" ? "inline-block" : "none";
  ensureEl("labelReset").style.display =
    topButtonsVisible && Labels.hasOverride(label.type, label.entityId) ? "inline-block" : "none";

  const pathToggle = ensureEl("labelPathToggle");
  pathToggle.className = hasPath ? "icon-resize-horizontal" : "icon-bezier-curve";
  pathToggle.dataset.tip = hasPath
    ? "Remove the label path, render the label as a straight text"
    : "Curve the label along a path";

  const visibility = ensureEl("labelVisibility");
  visibility.className = label.hidden ? "icon-eye-off" : "icon-eye";
  visibility.dataset.tip = label.hidden
    ? "Show the label"
    : "Hide the label. You can toggle it on later in Labels Overview";
}

function hasLabelPath(): boolean {
  return Boolean(label.pathPoints?.length);
}

function updateValues(): void {
  const startOffset = label.startOffset || 50;
  ensureEl<HTMLInputElement>("labelText").value = label.text || "";
  ensureEl<HTMLInputElement>("labelStartOffset").value = String(startOffset);
  ensureEl<HTMLInputElement>("labelStartOffsetValue").value = String(startOffset);
  ensureEl<HTMLInputElement>("labelRelativeSize").value = String(label.fontSize ?? 100);
  ensureEl<HTMLInputElement>("labelLetterSpacingSize").value = String(label.letterSpacing ?? 0);
}

function hideTopButtons(): void {
  ensureEl("labelEditor").classList.add("section-open");
  document.querySelectorAll<HTMLElement>("#labelEditor > button").forEach(el => {
    el.style.display = "none";
  });
}

function showTopButtons(): void {
  ensureEl("labelEditor").classList.remove("section-open");
  document.querySelectorAll<HTMLElement>("#labelEditor > button").forEach(el => {
    el.style.display = "inline-block";
  });
  updateControls();
}

function drawControlPointsAndLine(): void {
  renderLabelOverlay();
}

function addInterimControlPoint(this: SVGElement, event: MouseEvent): void {
  if (!label.pathPoints?.length) return;
  const worldPoint = getPixiMapPointAtClient(event.clientX, event.clientY);
  if (!worldPoint) return;
  const point: Point = [worldPoint.x - (label.dx || 0), worldPoint.y - (label.dy || 0)];
  if (distanceToPolyline(point, label.pathPoints) > 6 / scale) return;
  const index = getSegmentId(label.pathPoints, point, 2);
  label.pathPoints.splice(index, 0, [rn(point[0], 2), rn(point[1], 2)]);
  applyLabelChanges();
}

function editLabelHandle(event: CustomEvent<MapInteractionHandleEventDetail>): void {
  const handleId = String(event.detail.handleId);
  if (handleId === "label-anchor") {
    editLabelAnchor(event);
    return;
  }
  if (!handleId.startsWith("label-path:")) return;
  const index = Number(handleId.split(":")[1]);
  editLabelPathPoint(event, index);
}

function editLabelAnchor(event: CustomEvent<MapInteractionHandleEventDetail>): void {
  if (event.detail.phase === "start") {
    activeHandle = { initialOffset: [label.dx || 0, label.dy || 0], kind: "label" };
    return;
  }
  if (event.detail.phase === "cancel") {
    if (activeHandle?.kind === "label") {
      [label.dx, label.dy] = activeHandle.initialOffset;
      activeHandle = null;
      applyLabelChanges();
    }
    return;
  }
  if (event.detail.phase === "move") {
    label.dx = rn(event.detail.worldPoint.x - label.anchor[0], 2);
    label.dy = rn(event.detail.worldPoint.y - label.anchor[1], 2);
    applyLabelChanges(false);
    return;
  }
  if (event.detail.phase !== "end" || activeHandle?.kind !== "label") return;
  activeHandle = null;
  applyLabelChanges();
}

function editLabelPathPoint(event: CustomEvent<MapInteractionHandleEventDetail>, index: number): void {
  const point = label.pathPoints?.[index];
  if (!point) return;
  if (event.detail.phase === "activate") {
    removeLabelPathPoint(index);
    return;
  }
  if (event.detail.phase === "start") {
    activeHandle = { index, initialPoint: [...point], kind: "path" };
    return;
  }
  if (event.detail.phase === "cancel") {
    if (activeHandle?.kind === "path" && activeHandle.index === index) {
      label.pathPoints![index] = [...activeHandle.initialPoint];
      activeHandle = null;
      applyLabelChanges();
    }
    return;
  }
  if (event.detail.phase === "move") {
    label.pathPoints![index] = [
      rn(event.detail.worldPoint.x - (label.dx || 0), 2),
      rn(event.detail.worldPoint.y - (label.dy || 0), 2)
    ];
    applyLabelChanges(false);
    return;
  }
  if (event.detail.phase !== "end" || activeHandle?.kind !== "path" || activeHandle.index !== index) return;
  const moved = Math.hypot(point[0] - activeHandle.initialPoint[0], point[1] - activeHandle.initialPoint[1]) > 0.01;
  activeHandle = null;
  if (!moved) removeLabelPathPoint(index);
  else applyLabelChanges();
}

function removeLabelPathPoint(index: number): void {
  label.pathPoints?.splice(index, 1);
  applyLabelChanges();
}

function renderLabelOverlay(): void {
  const dx = label.dx || 0;
  const dy = label.dy || 0;
  const path = label.pathPoints?.map(([x, y]) => ({ x: x + dx, y: y + dy })) ?? [];
  updateMapInteractionOverlay({
    handles: [
      {
        id: "label-anchor",
        label: `Move ${label.text || "label"}`,
        point: { x: label.anchor[0] + dx, y: label.anchor[1] + dy }
      },
      ...path.map((point, index) => ({
        id: `label-path:${index}`,
        label: `Edit label path point ${index + 1}`,
        point
      }))
    ],
    selection:
      path.length > 1
        ? [{ kind: "polyline", points: path }]
        : [{ kind: "point", point: { x: label.anchor[0] + dx, y: label.anchor[1] + dy } }]
  });
}

function distanceToPolyline(point: Point, points: Point[]): number {
  let distance = Infinity;
  for (let index = 1; index < points.length; index++) {
    distance = Math.min(distance, distanceToSegment(point, points[index - 1], points[index]));
  }
  return distance;
}

function distanceToSegment([x, y]: Point, [x1, y1]: Point, [x2, y2]: Point): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (!dx && !dy) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function showGroupSection(): void {
  hideTopButtons();
  ensureEl("labelGroupSection").style.display = "inline-block";
}

function hideGroupSection(): void {
  showTopButtons();
  ensureEl("labelGroupSection").style.display = "none";
}

function changeGroup(this: HTMLSelectElement): void {
  const nextGroup = this.value;
  const targetType = options.labels.groups.find(group => group.name === nextGroup)?.type;
  const apply = () => {
    lastSelectedGroup = nextGroup;
    label.group = nextGroup;
    applyLabelChanges();
  };
  if (targetType === label.type) return void apply();

  confirmationDialog({
    title: "Assign cross-type Label Group",
    message: `Assign this ${label.type} label to the ${targetType} group "${nextGroup}"? It's better to avoid such cross-type assignment.`,
    confirm: "Assign",
    onConfirm: apply,
    onCancel: () => {
      this.value = label.group;
    }
  });
}

function showTextSection(): void {
  hideTopButtons();
  ensureEl("labelTextSection").style.display = "inline-block";
}

function hideTextSection(): void {
  showTopButtons();
  ensureEl("labelTextSection").style.display = "none";
}

function changeText(): void {
  const input = ensureEl<HTMLInputElement>("labelText").value;
  label.text = input;
  applyLabelChanges();
  if (label.type === "province")
    tip("Use Provinces Editor to change the actual province name, not just a label", false, "warn");
}

const nameGenerators: Record<LabelType, (label: LabelData) => string> = {
  burg: label => Names.getCulture(pack.burgs[label.entityId].culture ?? 0),
  state: label => {
    const culture = pack.states[label.entityId].culture;
    return Names.getState(Names.getCulture(culture, 4, 7, ""), culture);
  },
  province: label => {
    const province = pack.provinces[label.entityId];
    return Names.getState(province.name, pack.cells.culture[province.center]);
  },
  added: label => {
    const cellId = findCell(...label.anchor);
    if (!cellId) return "";
    return Names.getCulture(pack.cells.culture[cellId]);
  },
  river: label => {
    const cellId = findCell(...label.anchor);
    if (!cellId) return "";
    return Rivers.getName(cellId);
  },
  route: label => {
    const points = pack.routes.find(route => route.i === label.entityId)?.points ?? [];
    return Routes.generateName({ group: label.group, points }) || UNNAMED_ROUTE;
  }
};

function generateRandomName(): void {
  ensureEl<HTMLInputElement>("labelText").value = nameGenerators[label.type](label);
  changeText();
}

function editGroupStyle(): void {
  window.StyleEditor.edit("labels", label.group);
}

function showSizeSection(): void {
  hideTopButtons();
  ensureEl("labelSizeSection").style.display = "inline-block";
}

function hideSizeSection(): void {
  showTopButtons();
  ensureEl("labelSizeSection").style.display = "none";
}

function showOffsetSection(): void {
  hideTopButtons();
  ensureEl("labelOffsetSection").style.display = "inline-block";
}

function hideOffsetSection(): void {
  showTopButtons();
  ensureEl("labelOffsetSection").style.display = "none";
}

function showLetterSpacingSection(): void {
  hideTopButtons();
  ensureEl("labelLetterSpacingSection").style.display = "inline-block";
}

function hideLetterSpacingSection(): void {
  showTopButtons();
  ensureEl("labelLetterSpacingSection").style.display = "none";
}

function changeStartOffset(this: HTMLInputElement): void {
  if (!hasLabelPath()) return;
  const value = this.value;
  ensureEl<HTMLInputElement>("labelStartOffsetValue").value = value;

  label.startOffset = +value;
  applyLabelChanges();
  tip(`Label offset: ${value}%`);
}

function changeStartOffsetFromValue(this: HTMLInputElement): void {
  if (!hasLabelPath()) return;
  const value = Math.min(80, Math.max(20, +this.value));
  ensureEl<HTMLInputElement>("labelStartOffset").value = String(value);
  this.value = String(value);

  label.startOffset = value;
  applyLabelChanges();
  tip(`Label offset: ${value}%`);
}

function changeRelativeSize(this: HTMLInputElement): void {
  label.fontSize = +this.value;
  applyLabelChanges();
  tip(`Label relative size: ${this.value}%`);
}

function changeLetterSpacingSize(this: HTMLInputElement): void {
  label.letterSpacing = +this.value;
  applyLabelChanges();
  tip(`Label letter-spacing size: ${this.value}px`);
}

// An empty path means the label is explicitly rendered as a plain text, so it won't fall back to the default geometry
function toggleLabelPath(): void {
  label.pathPoints = hasLabelPath() ? [] : createLabelArc(label);
  applyLabelChanges();
  drawControlPointsAndLine();
}

function toggleLabelVisibility(): void {
  if (label.hidden) delete label.hidden;
  else label.hidden = true;
  applyLabelChanges();
}

function editLabelLegend(): void {
  const noteId = label.type === "burg" ? `burg${label.entityId}` : label.id;
  void Controllers.NotesEditor.open(noteId, label.text);
}

function removeSelectedLabel(): void {
  confirmationDialog({
    confirm: "Remove",
    message: "Are you sure you want to remove the label?",
    onConfirm: () => {
      if (label.type !== "added") return;
      AddedLabels.remove(label.entityId);
      drawLabels();
      closeLabelEditor();
    },
    title: "Remove label"
  });
}

function applyLabelChanges(renderOverlay = true): void {
  const entity = Labels.getEntity(label.type, label.entityId);
  if (!entity) return;

  const mutation = setLabelOverride(entity, label.type, getLabelOverride());
  if (mutation.changed) redrawLabel(label);
  updateControls();
  if (renderOverlay) renderLabelOverlay();
}

function resetSelectedLabel(): void {
  const { type, entityId } = label;
  Labels.resetOverride(type, entityId);

  drawLabels();
  label = { ...(getSceneLabel(type, entityId) ?? label) };
  selectLabelGroup(label.group);
  updateValues();
  updateControls();
  drawControlPointsAndLine();
}

function closeLabelEditor(): void {
  document.getElementById("map")?.removeEventListener(MAP_INTERACTION_HANDLE_EVENT, editLabelHandle as EventListener);
  select<SVGElement, unknown>("#viewbox").on("click.labelEditor", null);
  clearMapInteractionOverlay();
  activeHandle = null;
  applyDefaultViewboxEvents();
  destroyDialog("labelEditor");
}

// An edited label always stores its geometry explicitly, so an empty path is kept as an empty array
function getLabelOverride(): Label {
  return {
    text: label.text,
    group: label.group,
    dx: label.dx,
    dy: label.dy,
    fontSize: label.fontSize,
    letterSpacing: label.letterSpacing,
    pathPoints: label.pathPoints ?? [],
    startOffset: label.startOffset,
    hidden: label.hidden
  };
}

const getLastSelectedGroup = (): string => lastSelectedGroup;
export const LabelsEditor = { open, getLastSelectedGroup };
