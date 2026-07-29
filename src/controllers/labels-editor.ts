import { curveNatural, drag, line, type Selection, select } from "d3";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { showMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import type { AddedLabel, Label } from "@/generators/labels";
import { getLabelGroupAttributes } from "@/renderers/draw-label-utils";
import { drawLabel, removeLabel as removeRenderedLabel } from "@/renderers/draw-labels";
import { speak } from "@/utils";
import { extractPathPoints } from "@/utils/pathUtils";
import { destroyDialogIfExists, ensureEl, findEl, getPointer, parseTransform, round } from "../utils";

let selectedLabel: Selection<SVGElement, unknown, HTMLElement, unknown>;
let lastSelectedGroup = ""; // group selected in the editor most recently; used as the default group for newly added labels
let stateLabelDraft: Label | undefined;

function getEditableLabel(): Label | AddedLabel | undefined {
  const id = selectedLabel.attr("id") || "";
  const stateId = id.match(/^stateLabel(\d+)$/)?.[1];
  if (stateId) {
    if (!stateLabelDraft) return;
    pack.states[+stateId].label = stateLabelDraft;
    return stateLabelDraft;
  }
  const customId = id.match(/^addedLabel(\d+)$/)?.[1];
  return customId ? AddedLabels.get(+customId) : undefined;
}

const isStateLabel = (): boolean => selectedLabel.attr("id").startsWith("stateLabel");

function renderSelectedLabel(): void {
  const id = selectedLabel.attr("id");
  if (id.startsWith("stateLabel")) drawLabel("state", +id.slice(10));
  else drawLabel("added", +id.slice(10));

  selectedLabel = select<SVGElement, unknown>(`#${id}`)
    .call(drag<SVGElement, unknown>().on("start", dragLabel))
    .classed("draggable", true);
}

function open(tspan: SVGTSpanElement): void {
  if (customization) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleLabels")) toggleLabels();

  const textPath = tspan.parentNode as SVGTextPathElement;
  const text = textPath.parentElement;
  const group = text?.parentElement?.id;
  if (!text || !group) return;

  selectedLabel = select<SVGElement, unknown>(`#${text.id}`)
    .call(drag<SVGElement, unknown>().on("start", dragLabel))
    .classed("draggable", true);
  stateLabelDraft = getStateLabelDraft();
  select<SVGElement, unknown>("#viewbox").on("touchmove mousemove", showEditorTips);

  renderDialog();

  $("#labelEditor").dialog({
    title: "Edit Label",
    resizable: false,
    width: "fit-content",
    position: { my: "center top+10", at: "bottom", of: text, collision: "fit" },
    close: closeLabelEditor
  });

  drawControlPointsAndLine();
  selectLabelGroup(group);
  updateValues(textPath);
}

function getStateLabelDraft(): Label | undefined {
  if (!isStateLabel()) return;

  const state = pack.states[+selectedLabel.attr("id").slice(10)];
  if (state.label?.pathPoints?.length) {
    return { ...state.label, pathPoints: state.label.pathPoints.map(point => [...point]) };
  }

  const labelId = selectedLabel.attr("id");
  const path = document.querySelector<SVGPathElement>(`#textPath_${labelId}`)!;
  const textPath = selectedLabel.selectChild<SVGTextPathElement>("textPath").node()!;
  return {
    ...state.label,
    pathPoints: extractPathPoints(path),
    text: [...textPath.querySelectorAll("tspan")].map(tspan => tspan.textContent).join("|"),
    fontSize: Number.parseFloat(textPath.getAttribute("font-size")!)
  };
}

function renderDialog(): void {
  destroyDialogIfExists("labelEditor");
  const editorHtml = /* html */ `<div id="labelEditor" class="dialog">
      <button id="labelGroupShow" data-tip="Show the group selection" class="icon-tags"></button>
      <div id="labelGroupSection" style="display: none">
        <button id="labelGroupHide" data-tip="Hide the group selection" class="icon-tags"></button>
        <select id="labelGroupSelect" data-tip="Select a group for this label" style="width: 10em"></select>
        <input
          id="labelGroupInput"
          placeholder="new group name"
          data-tip="Provide a name for the new group"
          style="display: none; width: 10em"
        />
        <span id="labelGroupNew" data-tip="Create a new group for this label" class="icon-plus pointer"></span>
        <span
          id="labelGroupRemove"
          data-tip="Remove the Group with all labels"
          class="icon-trash-empty pointer"
        ></span>
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
      <button
        id="labelRemoveSingle"
        data-tip="Remove the label"
        data-shortcut="Delete"
        class="icon-trash fastDelete"
      ></button>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);

  ensureEl("labelGroupShow").on("click", showGroupSection);
  ensureEl("labelGroupHide").on("click", hideGroupSection);
  ensureEl("labelGroupSelect").on("change", changeGroup);
  ensureEl("labelGroupInput").on("change", createNewGroup);
  ensureEl("labelGroupNew").on("click", toggleNewGroupInput);
  ensureEl("labelGroupRemove").on("click", removeLabelsGroup);

  ensureEl("labelTextShow").on("click", showTextSection);
  ensureEl("labelTextHide").on("click", hideTextSection);
  ensureEl("labelText").on("input", changeText);
  ensureEl("labelTextSpeak").on("click", () => speak(ensureEl<HTMLInputElement>("labelText").value));
  ensureEl("labelTextRandom").on("click", generateRandomName);

  ensureEl("labelEditStyle").on("click", editGroupStyle);

  ensureEl("labelSizeShow").on("click", showSizeSection);
  ensureEl("labelSizeHide").on("click", hideSizeSection);
  ensureEl("labelOffsetShow").on("click", showOffsetSection);
  ensureEl("labelOffsetHide").on("click", hideOffsetSection);
  ensureEl("labelStartOffset").on("input", changeStartOffset);
  ensureEl("labelStartOffsetValue").on("input", changeStartOffsetFromValue);
  ensureEl("labelRelativeSize").on("input", changeRelativeSize);

  ensureEl("labelLetterSpacingShow").on("click", showLetterSpacingSection);
  ensureEl("labelLetterSpacingHide").on("click", hideLetterSpacingSection);
  ensureEl("labelLetterSpacingSize").on("input", changeLetterSpacingSize);

  ensureEl("labelAlign").on("click", editLabelAlign);
  ensureEl("labelLegend").on("click", editLabelLegend);
  ensureEl("labelRemoveSingle").on("click", removeSelectedLabel);
}

function hideTopButtons(): void {
  document.querySelectorAll<HTMLElement>("#labelEditor > button").forEach(el => {
    el.style.display = "none";
  });
}

function showTopButtons(): void {
  document.querySelectorAll<HTMLElement>("#labelEditor > button").forEach(el => {
    el.style.display = "inline-block";
  });
}

function showEditorTips(event: MouseEvent): void {
  showMainTip();
  const target = event.target as SVGElement;
  const parent = target.parentNode as Element | null;
  const grandParent = parent?.parentNode as Element | null;
  if (grandParent?.id === selectedLabel.attr("id")) {
    tip("Drag to shift the label");
  } else if (parent?.id === "controlPoints") {
    if (target.tagName === "circle") tip("Drag to move, click to delete the control point");
    if (target.tagName === "path") tip("Click to add a control point");
  }
}

function selectLabelGroup(group: string): void {
  if (group === "states" || group === "burgLabels") {
    ensureEl("labelGroupShow").style.display = "none";
    return;
  }

  lastSelectedGroup = group;

  hideGroupSection();
  const groupSelect = ensureEl<HTMLSelectElement>("labelGroupSelect");
  groupSelect.options.length = 0; // remove all options

  select<SVGGElement, unknown>("#labels")
    .selectAll<SVGGElement, unknown>(":scope > g")
    .each(function () {
      if (this.id === "states") return;
      if (this.id === "burgLabels") return;
      groupSelect.options.add(new Option(this.id, this.id, false, this.id === group));
    });
}

function updateValues(textPath: SVGTextPathElement): void {
  ensureEl<HTMLInputElement>("labelText").value = [...textPath.querySelectorAll("tspan")]
    .map(tspan => tspan.textContent)
    .join("|");
  const startOffset = Number.parseFloat(textPath.getAttribute("startOffset")!);
  ensureEl<HTMLInputElement>("labelStartOffset").value = String(startOffset);
  ensureEl<HTMLInputElement>("labelStartOffsetValue").value = String(startOffset);
  ensureEl<HTMLInputElement>("labelRelativeSize").value = String(
    Number.parseFloat(textPath.getAttribute("font-size")!)
  );
  const letterSpacingSize = textPath.getAttribute("letter-spacing") || "0";
  ensureEl<HTMLInputElement>("labelLetterSpacingSize").value = String(Number.parseFloat(letterSpacingSize));
}

function drawControlPointsAndLine(): void {
  select("#debug").select("#controlPoints").remove();
  select("#debug").append("g").attr("id", "controlPoints").attr("transform", selectedLabel.attr("transform"));
  const path = ensureEl(`textPath_${selectedLabel.attr("id")}`) as unknown as SVGPathElement;
  select<SVGGElement, unknown>("#debug")
    .select("#controlPoints")
    .append("path")
    .attr("d", path.getAttribute("d"))
    .on("click", addInterimControlPoint);
  const l = path.getTotalLength();
  if (!l) return;
  const increment = l / Math.max(Math.ceil(l / 200), 2);
  for (let i = 0; i <= l; i += increment) {
    addControlPoint(path.getPointAtLength(i));
  }
}

function addControlPoint(point: DOMPoint): void {
  select<SVGGElement, unknown>("#debug")
    .select("#controlPoints")
    .append("circle")
    .attr("cx", point.x)
    .attr("cy", point.y)
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
  const points: [number, number][] = [];
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
  const label = getEditableLabel();
  if (label) label.pathPoints = points;
  renderSelectedLabel();
}

function clickControlPoint(this: SVGCircleElement): void {
  this.remove();
  redrawLabelPath();
}

function addInterimControlPoint(this: SVGPathElement, event: any): void {
  const point = getPointer(event, this);

  const dists: number[] = [];
  select("#debug")
    .select("#controlPoints")
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
  const tr = parseTransform(selectedLabel.attr("transform"));
  const dx0 = +tr[0] - event.x;
  const dy0 = +tr[1] - event.y;

  event.on("drag", (dragEvent: any) => {
    const label = getEditableLabel();
    if (label) {
      label.dx = rn(dx0 + dragEvent.x, 2);
      label.dy = rn(dy0 + dragEvent.y, 2);
    }
    renderSelectedLabel();
    select("#debug").select("#controlPoints").attr("transform", selectedLabel.attr("transform"));
  });
}

function showGroupSection(): void {
  hideTopButtons();
  ensureEl("labelGroupSection").style.display = "inline-block";
}

function hideGroupSection(): void {
  showTopButtons();
  ensureEl("labelGroupSection").style.display = "none";
  ensureEl("labelGroupInput").style.display = "none";
  ensureEl<HTMLInputElement>("labelGroupInput").value = "";
  ensureEl("labelGroupSelect").style.display = "inline-block";
}

function changeGroup(this: HTMLSelectElement): void {
  lastSelectedGroup = this.value;
  const label = getEditableLabel();
  if (label && "group" in label) label.group = this.value;
  renderSelectedLabel();
}

function toggleNewGroupInput(): void {
  const labelGroupInput = ensureEl("labelGroupInput");
  const labelGroupSelect = ensureEl("labelGroupSelect");
  if (labelGroupInput.style.display === "none") {
    labelGroupInput.style.display = "inline-block";
    labelGroupInput.focus();
    labelGroupSelect.style.display = "none";
  } else {
    labelGroupInput.style.display = "none";
    labelGroupSelect.style.display = "inline-block";
  }
}

function createNewGroup(this: HTMLInputElement): void {
  if (!this.value) {
    tip("Please provide a valid group name");
    return;
  }
  const group = this.value
    .toLowerCase()
    .replace(/ /g, "_")
    .replace(/[^\w\s]/gi, "");

  if (findEl(group)) {
    tip("Element with this id already exists. Please provide a unique name", false, "error");
    return;
  }

  if (Number.isFinite(+group.charAt(0))) {
    tip("Group name should start with a letter", false, "error");
    return;
  }

  lastSelectedGroup = group;

  // preserve the current group style when creating a group from a single custom label
  const oldGroup = selectedLabel.node()!.parentNode as SVGGElement;
  const oldGroupId = oldGroup.id;
  const oldGroupStyle = style.addedLabels[oldGroupId] || style.addedLabels.addedLabels || {};
  style.addedLabels[group] = Object.fromEntries(getLabelGroupAttributes(oldGroupStyle));
  const renameOldGroup = oldGroupId !== "states" && oldGroupId !== "addedLabels" && oldGroup.childElementCount === 1;
  if (renameOldGroup) {
    ensureEl<HTMLSelectElement>("labelGroupSelect").selectedOptions[0].remove();
  }

  ensureEl<HTMLSelectElement>("labelGroupSelect").options.add(new Option(group, group, false, true));
  const label = getEditableLabel();
  if (label && "group" in label) label.group = group;
  renderSelectedLabel();
  if (renameOldGroup) {
    oldGroup.remove();
    delete style.addedLabels[oldGroupId];
  }

  toggleNewGroupInput();
  ensureEl<HTMLInputElement>("labelGroupInput").value = "";
}

function removeLabelsGroup(): void {
  const group = (selectedLabel.node()!.parentNode as SVGGElement).id;
  const basic = group === "states" || group === "addedLabels";
  const count = (selectedLabel.node()!.parentNode as SVGGElement).childElementCount;
  alertMessage.innerHTML = /* html */ `Are you sure you want to remove ${
    basic ? "all elements in the group" : "the entire label group"
  }? <br /><br />Labels to be
    removed: ${count}`;
  $("#alert").dialog({
    resizable: false,
    title: "Remove label group",
    buttons: {
      Remove: function (this: HTMLElement) {
        $(this).dialog("close");
        $("#labelEditor").dialog("close");
        pack.labels
          .filter(label => label.group === group)
          .forEach(label => {
            AddedLabels.remove(label.i);
          });
        if (!basic) delete style.addedLabels[group];
        if (lastSelectedGroup === group) lastSelectedGroup = "addedLabels";
        drawLabel("added");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
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
  const label = getEditableLabel();
  if (label) label.text = input;
  renderSelectedLabel();
  if (isStateLabel()) tip("Use States Editor to change an actual state name, not just a label", false, "warn");
}

function generateRandomName(): void {
  let name = "";
  if (isStateLabel()) {
    const culture = pack.states[+selectedLabel.attr("id").slice(10)].culture;
    name = Names.getState(Names.getCulture(culture, 4, 7, ""), culture);
  } else {
    const box = (selectedLabel.node() as SVGGraphicsElement).getBBox();
    const cell = findCell((box.x + box.width) / 2, (box.y + box.height) / 2)!;
    const culture = pack.cells.culture[cell];
    name = Names.getCulture(culture);
  }
  ensureEl<HTMLInputElement>("labelText").value = name;
  changeText();
}

function editGroupStyle(): void {
  const g = (selectedLabel.node()!.parentNode as SVGGElement).id;
  editStyle("labels", g);
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
  const value = this.value;
  ensureEl<HTMLInputElement>("labelStartOffsetValue").value = value;
  const label = getEditableLabel();
  if (label) label.startOffset = +value;
  renderSelectedLabel();
  tip(`Label offset: ${value}%`);
}

function changeStartOffsetFromValue(this: HTMLInputElement): void {
  const value = Math.min(80, Math.max(20, +this.value));
  ensureEl<HTMLInputElement>("labelStartOffset").value = String(value);
  this.value = String(value);
  const label = getEditableLabel();
  if (label) label.startOffset = value;
  renderSelectedLabel();
  tip(`Label offset: ${value}%`);
}

function changeRelativeSize(this: HTMLInputElement): void {
  const label = getEditableLabel();
  if (label) label.fontSize = +this.value;
  renderSelectedLabel();
  tip(`Label relative size: ${this.value}%`);
  changeText();
}

function changeLetterSpacingSize(this: HTMLInputElement): void {
  const label = getEditableLabel();
  if (label) label.letterSpacing = +this.value;
  renderSelectedLabel();
  tip(`Label letter-spacing size: ${this.value}px`);
  changeText();
}

function editLabelAlign(): void {
  const bbox = (selectedLabel.node() as SVGGraphicsElement).getBBox();
  const c = [bbox.x + bbox.width / 2, bbox.y + bbox.height / 2];
  const label = getEditableLabel();
  if (label) {
    label.pathPoints = [
      [c[0] - bbox.width, c[1]],
      [c[0] + bbox.width, c[1]]
    ];
  }
  renderSelectedLabel();
  drawControlPointsAndLine();
}

function editLabelLegend(): void {
  const id = selectedLabel.attr("id");
  const name = selectedLabel.text();
  void Controllers.NotesEditor.open(id, name);
}

function removeSelectedLabel(): void {
  alertMessage.innerHTML = "Are you sure you want to remove the label?";
  $("#alert").dialog({
    resizable: false,
    title: "Remove label",
    buttons: {
      Remove: function (this: HTMLElement) {
        $(this).dialog("close");
        const label = getEditableLabel();
        if (label && "i" in label) {
          removeRenderedLabel("added", label.i);
          AddedLabels.remove(label.i);
        } else if (label) {
          const stateId = +selectedLabel.attr("id").slice(10);
          removeRenderedLabel("state", stateId);
          delete pack.states[+selectedLabel.attr("id").slice(10)].label;
        }
        $("#labelEditor").dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function closeLabelEditor(): void {
  select("#debug").select("#controlPoints").remove();
  selectedLabel.on(".drag", null).classed("draggable", false);
  stateLabelDraft = undefined;
  applyDefaultViewboxEvents();
  $("#labelEditor").dialog("destroy");
  ensureEl("labelEditor").remove();
}

const getLastSelectedGroup = (): string => lastSelectedGroup;

export const LabelsEditor = { open, getLastSelectedGroup };
