import { curveNatural, type D3DragEvent, drag, line, select } from "d3";
import { closeDialogs, confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { showMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import type { Label, LabelType } from "@/generators/labels-generator";
import { UNNAMED_ROUTE } from "@/generators/routes-generator";
import type { Point } from "@/generators/voronoi";
import { createLabelArc } from "@/renderers/labels/label-arc";
import { getLabelPath } from "@/renderers/labels/label-markup";
import type { LabelData } from "@/renderers/labels/labels";
import { getSceneLabel, redrawLabel } from "@/renderers/labels/labels-renderer";
import { speak } from "@/utils";
import { ensureEl, getPointer, round } from "../utils";

let lastSelectedGroup = ""; // the default group for newly added labels
let label: LabelData;

function open(type: LabelType, id: number): void {
  if (customization) return;
  closeDialogs(".stable");
  Layers.show("labels");

  const textEl = document.querySelector<SVGTextElement>(`#labels text[data-label-type='${type}'][data-id='${id}']`);
  if (!textEl) return;

  const cachedLabel = getSceneLabel(type, id);
  if (!cachedLabel) return;
  label = { ...cachedLabel }; // the editor owns its copy and hands it back to the renderer on every change

  makeLabelDraggable(textEl.id);
  select<SVGElement, unknown>("#viewbox").on("touchmove mousemove", showEditorTips);

  renderDialog();

  $("#labelEditor").dialog({
    title: "Edit Label",
    resizable: false,
    width: "fit-content",
    position: { my: "center top+10", at: "bottom", of: textEl, collision: "fit" },
    close: closeLabelEditor
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

function showEditorTips(event: MouseEvent): void {
  showMainTip();
  const target = event.target as SVGElement;
  const parent = target.parentNode as Element | null;
  if (target.closest(`#${label.id}`)) {
    tip("Drag to move the label");
  } else if (parent?.id === "controlPoints") {
    if (target.tagName === "circle") tip("Drag to move, click to delete the control point");
    if (target.tagName === "path") tip("Click to add a control point");
  }
}

function drawControlPointsAndLine(): void {
  select("#debug").select("#controlPoints").remove();
  if (!hasLabelPath()) return;

  const transform = label.dx || label.dy ? `translate(${label.dx || 0}, ${label.dy || 0})` : null;
  select<SVGGElement, unknown>("#debug")
    .append("g")
    .attr("id", "controlPoints")
    .attr("transform", transform)
    .append("path")
    .attr("d", getLabelPath(label))
    .style("stroke-width", Math.max(2.2 / scale, 0.2))
    .on("click", addInterimControlPoint);
  label.pathPoints?.forEach(drawControlPoint);
}

function drawControlPoint(point: Point): void {
  select<SVGGElement, unknown>("#debug")
    .select("#controlPoints")
    .append("circle")
    .attr("cx", point[0])
    .attr("cy", point[1])
    .attr("r", Math.max(3 / scale, 0.35))
    .style("stroke-width", Math.max(1 / scale, 0.15))
    .call(drag<SVGCircleElement, unknown>().on("drag", dragControlPoint))
    .on("click", clickControlPoint);
}

function dragControlPoint(this: SVGCircleElement, event: any): void {
  this.setAttribute("cx", event.x);
  this.setAttribute("cy", event.y);
  redrawLabelPath();
}

function redrawLabelPath(): void {
  const points: Point[] = [];
  select("#debug > #controlPoints")
    .selectAll<SVGCircleElement, unknown>("circle")
    .each(function () {
      const x = rn(+this.getAttribute("cx")!, 2);
      const y = rn(+this.getAttribute("cy")!, 2);
      points.push([x, y]);
    });
  const lineGen = line<[number, number]>().curve(curveNatural);
  const d = round(lineGen(points) || "");
  select("#debug").select("#controlPoints > path").attr("d", d);
  label.pathPoints = points;
  applyLabelChanges();
  if (!points.length) drawControlPointsAndLine(); // last control point removed, the label became a plain text
}

function clickControlPoint(this: SVGCircleElement): void {
  this.remove();
  redrawLabelPath();
}

function addInterimControlPoint(this: SVGPathElement, event: any): void {
  const point = getPointer(event, this);

  const dists: number[] = [];
  select("#debug #controlPoints")
    .selectAll<SVGCircleElement, unknown>("circle")
    .each(function () {
      const x = +this.getAttribute("cx")!;
      const y = +this.getAttribute("cy")!;
      dists.push((point[0] - x) ** 2 + (point[1] - y) ** 2);
    });

  let index = dists.length;
  if (dists.length > 1) {
    const sorted = dists.slice(0).sort((a, b) => a - b);
    const closest = dists.indexOf(sorted[0]);
    const next = dists.indexOf(sorted[1]);
    index = closest <= next ? closest + 1 : next + 1;
  }

  const before = `:nth-child(${index + 2})`;
  select<SVGGElement, unknown>("#debug")
    .select("#controlPoints")
    .insert("circle", before)
    .attr("cx", point[0])
    .attr("cy", point[1])
    .attr("r", 2.5)
    .attr("stroke-width", 0.8)
    .call(drag<SVGCircleElement, unknown>().on("drag", dragControlPoint))
    .on("click", clickControlPoint);

  redrawLabelPath();
}

function dragLabel(this: SVGElement, event: D3DragEvent<SVGGElement, unknown, unknown>) {
  const dx0 = (label.dx || 0) - event.x;
  const dy0 = (label.dy || 0) - event.y;

  event.on("drag", (dragEvent: D3DragEvent<SVGGElement, unknown, unknown>) => {
    label.dx = rn(dx0 + dragEvent.x, 2);
    label.dy = rn(dy0 + dragEvent.y, 2);
    const transform = `translate(${label.dx}, ${label.dy})`;
    this.setAttribute("transform", transform);
    select("#debug #controlPoints").attr("transform", transform);
  });

  event.on("end", () => applyLabelChanges());
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
  if (label.type === "state") tip("Use States Editor to change the actual state name, not just a label", false, "warn");
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
    const cellId = Pack.findCell(...label.anchor);
    if (!cellId) return "";
    return Names.getCulture(pack.cells.culture[cellId]);
  },
  river: label => {
    const cellId = Pack.findCell(...label.anchor);
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
  editStyle("labels", label.group);
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
  alertMessage.innerHTML = "Are you sure you want to remove the label?";
  $("#alert").dialog({
    resizable: false,
    title: "Remove label",
    buttons: {
      Remove: function (this: HTMLElement) {
        $(this).dialog("close");
        if (label.type !== "added") return;
        AddedLabels.remove(label.entityId);
        Layers.draw("labels");
        $("#labelEditor").dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function applyLabelChanges(): void {
  const entity = Labels.getEntity(label.type, label.entityId);
  if (!entity) return;

  entity.label = getLabelOverride();
  redrawLabel(label);
  makeLabelDraggable(label.id);
  updateControls();
}

function makeLabelDraggable(id: string): void {
  select<SVGElement, unknown>(`#${id}`)
    .call(drag<SVGElement, unknown>().on("start", dragLabel))
    .classed("draggable", true);
}

function resetSelectedLabel(): void {
  const { type, entityId } = label;
  Labels.resetOverride(type, entityId);

  Layers.draw("labels");
  label = { ...(getSceneLabel(type, entityId) ?? label) };
  makeLabelDraggable(label.id);
  selectLabelGroup(label.group);
  updateValues();
  updateControls();
  drawControlPointsAndLine();
}

function closeLabelEditor(): void {
  select("#debug").select("#controlPoints").remove();
  select(`#${label.id}`).on(".drag", null).classed("draggable", false);
  applyDefaultViewboxEvents();
  $("#labelEditor").dialog("destroy");
  ensureEl("labelEditor").remove();
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
