import { curveNatural, drag, line, select } from "d3";
import { closeDialogs, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { showMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import type { AddedLabel, LabelType } from "@/generators/labels";
import type { Point } from "@/generators/voronoi";
import { getLabelPath } from "@/renderers/labels/label-markup";
import { drawLabelsByType, getCachedLabel, removeLabel } from "@/renderers/labels/labels-renderer";
import type { LabelData } from "@/types/labels";
import { speak } from "@/utils";
import { destroyDialogIfExists, ensureEl, getPointer, round } from "../utils";

let hasExplicitTextOverride = false;

let lastSelectedGroup = ""; // the default group for newly added labels
let label: LabelData;

function open(type: LabelType, id: number): void {
  if (customization) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleLabels")) toggleLabels();

  const textEl = document.querySelector<SVGTextElement>(`#labels text[data-label-type='${type}'][data-id='${id}']`);
  if (!textEl) return;

  const cachedLabel = getCachedLabel(type, id);
  if (!cachedLabel) return;
  label = cachedLabel;

  select<SVGElement, unknown>(`#${textEl.id}`)
    .call(drag<SVGElement, unknown>().on("start", dragLabel))
    .classed("draggable", true);
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
  destroyDialogIfExists("labelEditor");
  const editorHtml = /* html */ `<div id="labelEditor" class="dialog">
      <button id="labelGroupShow" data-tip="Show the group selection" class="icon-tags"></button>
      <div id="labelGroupSection" style="display: none">
        <button id="labelGroupHide" data-tip="Hide the group selection" class="icon-tags"></button>
        <select id="labelGroupSelect" data-tip="Select a group for this label" style="width: 10em"></select>
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
      <button id="labelAlign" data-tip="Turn text path into a straight line" class="icon-resize-horizontal"></button>
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

  ensureEl("labelAlign").addEventListener("click", editLabelAlign);
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
  const isBurg = label.type === "burg";
  const topButtonsVisible = !ensureEl("labelEditor").classList.contains("section-open");
  ensureEl("labelOffsetShow").style.display = topButtonsVisible && !isBurg ? "inline-block" : "none";
  ensureEl("labelAlign").style.display = topButtonsVisible && !isBurg ? "inline-block" : "none";
  ensureEl("labelRemoveSingle").style.display = topButtonsVisible && label.type === "added" ? "inline-block" : "none";
  ensureEl("labelReset").style.display = topButtonsVisible && hasOverrides() ? "inline-block" : "none";
}

function updateValues(): void {
  const startOffset = label.type === "burg" ? 50 : (label.startOffset ?? 50);

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
  if (target.closest(`#${label.elId}`)) {
    tip("Drag to move the label");
  } else if (parent?.id === "controlPoints") {
    if (target.tagName === "circle") tip("Drag to move, click to delete the control point");
    if (target.tagName === "path") tip("Click to add a control point");
  }
}

function drawControlPointsAndLine(): void {
  select("#debug").select("#controlPoints").remove();
  if ("pathPoints" in label) {
    const transform = label.dx || label.dy ? `translate(${label.dx || 0}, ${label.dy || 0})` : null;
    select<SVGGElement, unknown>("#debug")
      .append("g")
      .attr("id", "controlPoints")
      .attr("transform", transform)
      .append("path")
      .attr("d", getLabelPath(label))
      .on("click", addInterimControlPoint)
      .node() as SVGPathElement;

    label.pathPoints?.forEach(drawControlPoint);
  }
}

function drawControlPoint(point: Point): void {
  select<SVGGElement, unknown>("#debug")
    .select("#controlPoints")
    .append("circle")
    .attr("cx", point[0])
    .attr("cy", point[1])
    .attr("r", 2.5)
    .attr("stroke-width", 0.8)
    .call(drag<SVGCircleElement, unknown>().on("drag", dragControlPoint))
    .on("click", clickControlPoint);
}

function dragControlPoint(this: SVGCircleElement, event: any): void {
  this.setAttribute("cx", event.x);
  this.setAttribute("cy", event.y);
  redrawLabelPath();
}

function redrawLabelPath(): void {
  if (label.type === "burg") return;

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

function dragLabel(event: any): void {
  const label = label;
  const dx0 = (label.dx || 0) - event.x;
  const dy0 = (label.dy || 0) - event.y;

  event.on("drag", (dragEvent: any) => {
    label.dx = rn(dx0 + dragEvent.x, 2);
    label.dy = rn(dy0 + dragEvent.y, 2);
    applyLabelChanges();
    select("#debug #controlPoints").attr("transform", `translate(${label.dx}, ${label.dy})`);
  });
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
  if (targetType === label.type) return apply();

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
  const label = label;
  if (label) label.text = input;
  hasExplicitTextOverride = true;
  applyLabelChanges();
  if (label.type === "state") tip("Use States Editor to change the actual state name, not just a label", false, "warn");
  if (label.type === "province")
    tip("Use Provinces Editor to change the actual province name, not just a label", false, "warn");
}

function generateRandomName(): void {
  let name = "";
  if (label?.type === "state") {
    const culture = pack.states[label.stateId].culture;
    name = Names.getState(Names.getCulture(culture, 4, 7, ""), culture);
  } else if (label?.type === "province") {
    const province = pack.provinces[label.provinceId];
    name = Names.getState(province.name, pack.cells.culture[province.center]);
  } else if (label?.type === "burg") {
    name = Names.getCulture(pack.burgs[label.burgId].culture ?? 0);
  } else {
    const label = label;
    const points = label?.pathPoints || [];
    const center = points.length
      ? points.reduce(([x, y], point) => [x + point[0] / points.length, y + point[1] / points.length], [0, 0])
      : [0, 0];
    const cell = findCell(center[0] + (label?.dx || 0), center[1] + (label?.dy || 0))!;
    const culture = pack.cells.culture[cell];
    name = Names.getCulture(culture);
  }
  ensureEl<HTMLInputElement>("labelText").value = name;
  changeText();
}

function editGroupStyle(): void {
  editStyle("labels", getSelectedGroup());
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
  if (label.type === "burg") return;

  const value = this.value;
  ensureEl<HTMLInputElement>("labelStartOffsetValue").value = value;
  const label = label;
  if (label) label.startOffset = +value;
  applyLabelChanges();
  tip(`Label offset: ${value}%`);
}

function changeStartOffsetFromValue(this: HTMLInputElement): void {
  if (label.type === "burg") return;

  const value = Math.min(80, Math.max(20, +this.value));
  ensureEl<HTMLInputElement>("labelStartOffset").value = String(value);
  this.value = String(value);
  const label = label;
  if (label) label.startOffset = value;
  applyLabelChanges();
  tip(`Label offset: ${value}%`);
}

function changeRelativeSize(this: HTMLInputElement): void {
  const label = label;
  if (label) label.fontSize = +this.value;
  applyLabelChanges();
  tip(`Label relative size: ${this.value}%`);
}

function changeLetterSpacingSize(this: HTMLInputElement): void {
  const label = label;
  if (label) label.letterSpacing = +this.value;
  applyLabelChanges();
  tip(`Label letter-spacing size: ${this.value}px`);
}

function editLabelAlign(): void {
  if (label.type === "burg") return;

  const label = label;
  if (!label?.pathPoints?.length) return;

  const xs = label.pathPoints.map(point => point[0]);
  const ys = label.pathPoints.map(point => point[1]);
  const center = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const halfLength = Math.max((Math.max(...xs) - Math.min(...xs)) / 2, 100);
  label.pathPoints = [
    [center[0] - halfLength, center[1]],
    [center[0] + halfLength, center[1]]
  ];
  applyLabelChanges();
  drawControlPointsAndLine();
}

function editLabelLegend(): void {
  const noteId = label.type === "burg" ? `burg${label.burgId}` : label.elId;
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
        removeLabel("added", label.i);
        AddedLabels.remove(label.i);
        $("#labelEditor").dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function applyLabelChanges(): void {
  const selected = label;
  const label = { ...selected.label };
  if (selected.type !== "added" && !hasExplicitTextOverride) delete label.text;
  if (selected.type === "state") {
    pack.states[selected.stateId].label = label;
    drawLabelsByType(selected.type, [selected.stateId]);
  } else if (selected.type === "province") {
    pack.provinces[selected.provinceId].label = label;
    drawLabelsByType(selected.type, [selected.provinceId]);
  } else if (selected.type === "burg") {
    pack.burgs[selected.burgId].label = label;
    drawLabelsByType(selected.type, [selected.burgId]);
  } else if (selected.type === "river" || selected.type === "route") {
    const entities = selected.type === "river" ? pack.rivers : pack.routes;
    const entity = entities.find(entity => entity.i === selected.entityId);
    if (!entity) return;
    entity.label = label;
    drawLabelsByType(selected.type, [selected.entityId]);
  } else if (selected.type === "added") {
    const labelId = selected.labelId;
    const index = pack.labels.findIndex(({ i }) => i === labelId);
    if (index === -1) return;
    pack.labels[index] = label as AddedLabel;
    drawLabelsByType(selected.type, [labelId]);
  }

  select<SVGElement, unknown>(`#${label.elId}`)
    .call(drag<SVGElement, unknown>().on("start", dragLabel))
    .classed("draggable", true);
  updateControls();
}

function hasOverrides(): boolean {
  const selected = label;
  if (selected.type === "state") return Boolean(pack.states[selected.stateId].label);
  if (selected.type === "province") return Boolean(pack.provinces[selected.provinceId].label);
  if (selected.type === "burg") return Boolean(pack.burgs[selected.burgId].label);
  if (selected.type === "river") return Boolean(pack.rivers.find(entity => entity.i === selected.entityId)?.label);
  if (selected.type === "route") return Boolean(pack.routes.find(entity => entity.i === selected.entityId)?.label);
  const { dx, dy, startOffset, fontSize, letterSpacing } = selected.label;
  return [dx, dy, startOffset, fontSize, letterSpacing].some(value => value !== undefined);
}

function resetSelectedLabel(): void {
  const selected = label;
  if (selected.type === "state") {
    hasExplicitTextOverride = false;
    delete pack.states[selected.stateId].label;
    drawLabelsByType("state", [selected.stateId]);
    const textEl = document.getElementById(selected.elId) as SVGTextElement | null;
    if (textEl) selected.label = getPathLabel(textEl.id);
  } else if (selected.type === "province") {
    hasExplicitTextOverride = false;
    delete pack.provinces[selected.provinceId].label;
    drawLabelsByType("province", [selected.provinceId]);
    const textEl = document.getElementById(selected.elId) as SVGTextElement | null;
    if (textEl) selected.label = getPathLabel(textEl.id);
  } else if (selected.type === "burg") {
    hasExplicitTextOverride = false;
    const burg = pack.burgs[selected.burgId];
    delete burg.label;
    drawLabelsByType("burg", [selected.burgId]);
    selected.label = { text: burg.name };
  } else if (selected.type === "river" || selected.type === "route") {
    const entities = selected.type === "river" ? pack.rivers : pack.routes;
    const entity = entities.find(entity => entity.i === selected.entityId);
    if (!entity) return;
    delete entity.label;
    drawLabelsByType(selected.type, [selected.entityId]);
    selected.label = getPathLabel(selected.elId);
  } else {
    const { i, text, pathPoints, group } = selected.label;
    const resetLabel: AddedLabel = { i, text, pathPoints, group };
    const index = pack.labels.findIndex(label => label.i === i);
    if (index === -1) return;
    pack.labels[index] = resetLabel;
    selected.label = { ...resetLabel };
    drawLabelsByType("added", [i]);
  }

  select<SVGElement, unknown>(`#${label.elId}`)
    .call(drag<SVGElement, unknown>().on("start", dragLabel))
    .classed("draggable", true);
  selectLabelGroup(getSelectedGroup());
  updateValues();
  updateControls();
  drawControlPointsAndLine();
}

function closeLabelEditor(): void {
  select("#debug").select("#controlPoints").remove();
  select(`#${label.elId}`).on(".drag", null).classed("draggable", false);
  applyDefaultViewboxEvents();
  $("#labelEditor").dialog("destroy");
  ensureEl("labelEditor").remove();
}

const getLastSelectedGroup = (): string => lastSelectedGroup;
const renameLastSelectedGroup = (oldName: string, newName: string): void => {
  if (lastSelectedGroup === oldName) lastSelectedGroup = newName;
};

export const LabelsEditor = { open, getLastSelectedGroup, renameLastSelectedGroup };
