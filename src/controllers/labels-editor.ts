import { curveNatural, drag, line, select } from "d3";
import { Controllers } from "@/controllers";
import { destroyDialogIfExists, ensureEl, findEl, getPointer, parseTransform, round } from "../utils";

const lineGen = line<[number, number]>().curve(curveNatural);

// group selected in the editor most recently; used as the default group for newly added labels
let lastSelectedGroup = "";

function open(tspan: SVGTSpanElement): void {
  if (customization) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleLabels")) toggleLabels();

  const textPath = tspan.parentNode as SVGTextPathElement;
  const text = textPath.parentNode as SVGTextElement;
  elSelected = select<SVGElement, unknown>(text)
    .call(drag<SVGElement, unknown>().on("start", dragLabel))
    .classed("draggable", true) as unknown as typeof elSelected;
  select<SVGElement, unknown>("#viewbox").on("touchmove mousemove", showEditorTips);

  renderDialog();

  $("#labelEditor").dialog({
    title: "Edit Label",
    resizable: false,
    width: fitContent(),
    position: { my: "center top+10", at: "bottom", of: text, collision: "fit" },
    close: closeLabelEditor
  });

  drawControlPointsAndLine();
  selectLabelGroup(text);
  updateValues(textPath);
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
  ensureEl("labelGroupSelect").on("click", changeGroup);
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
  ensureEl("labelRemoveSingle").on("click", removeLabel);
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
  if (grandParent?.id === elSelected.attr("id")) {
    tip("Drag to shift the label");
  } else if (parent?.id === "controlPoints") {
    if (target.tagName === "circle") tip("Drag to move, click to delete the control point");
    if (target.tagName === "path") tip("Click to add a control point");
  }
}

function selectLabelGroup(text: SVGTextElement): void {
  const group = (text.parentNode as SVGGElement).id;

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
  select("#debug").append("g").attr("id", "controlPoints").attr("transform", elSelected.attr("transform"));
  const path = ensureEl(`textPath_${elSelected.attr("id")}`) as unknown as SVGPathElement;
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
  const path = ensureEl(`textPath_${elSelected.attr("id")}`) as unknown as SVGPathElement;
  const points: [number, number][] = [];
  select("#debug")
    .select("#controlPoints")
    .selectAll<SVGCircleElement, unknown>("circle")
    .each(function () {
      points.push([+this.getAttribute("cx")!, +this.getAttribute("cy")!]);
    });
  const d = round(lineGen(points) || "");
  path.setAttribute("d", d);
  select("#debug").select("#controlPoints > path").attr("d", d);
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
  const tr = parseTransform(elSelected.attr("transform"));
  const dx = +tr[0] - event.x;
  const dy = +tr[1] - event.y;

  event.on("drag", (dragEvent: any) => {
    const transform = `translate(${dx + dragEvent.x},${dy + dragEvent.y})`;
    elSelected.attr("transform", transform);
    select("#debug").select("#controlPoints").attr("transform", transform);
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
  ensureEl(this.value).appendChild(elSelected.node()!);
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

  // just rename if only 1 element left
  const oldGroup = elSelected.node()!.parentNode as SVGGElement;
  if (oldGroup.id !== "states" && oldGroup.id !== "addedLabels" && oldGroup.childElementCount === 1) {
    ensureEl<HTMLSelectElement>("labelGroupSelect").selectedOptions[0].remove();
    ensureEl<HTMLSelectElement>("labelGroupSelect").options.add(new Option(group, group, false, true));
    oldGroup.id = group;
    toggleNewGroupInput();
    ensureEl<HTMLInputElement>("labelGroupInput").value = "";
    return;
  }

  const newGroup = (elSelected.node()!.parentNode as SVGGElement).cloneNode(false) as SVGGElement;
  ensureEl("labels").appendChild(newGroup);
  newGroup.id = group;
  ensureEl<HTMLSelectElement>("labelGroupSelect").options.add(new Option(group, group, false, true));
  ensureEl(group).appendChild(elSelected.node()!);

  toggleNewGroupInput();
  ensureEl<HTMLInputElement>("labelGroupInput").value = "";
}

function removeLabelsGroup(): void {
  const group = (elSelected.node()!.parentNode as SVGGElement).id;
  const basic = group === "states" || group === "addedLabels";
  const count = (elSelected.node()!.parentNode as SVGGElement).childElementCount;
  alertMessage.innerHTML = /* html */ `Are you sure you want to remove ${
    basic ? "all elements in the group" : "the entire label group"
  }? <br /><br />Labels to be
    removed: ${count}`;
  $("#alert").dialog({
    resizable: false,
    title: "Remove route group",
    buttons: {
      Remove: function (this: HTMLElement) {
        $(this).dialog("close");
        $("#labelEditor").dialog("close");
        hideGroupSection();
        select<SVGGElement, unknown>("#labels")
          .select(`#${group}`)
          .selectAll<SVGTextElement, unknown>("text")
          .each(function () {
            ensureEl(`textPath_${this.id}`).remove();
            this.remove();
          });
        if (!basic) select<SVGGElement, unknown>("#labels").select(`#${group}`).remove();
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
  const el = elSelected.select("textPath").node() as SVGElement;

  const lines = input.split("|");
  if (lines.length > 1) {
    const top = (lines.length - 1) / -2; // y offset
    el.innerHTML = lines.map((line, index) => `<tspan x="0" dy="${index ? 1 : top}em">${line}</tspan>`).join("");
  } else el.innerHTML = `<tspan x="0">${lines}</tspan>`;

  if (elSelected.attr("id").slice(0, 10) === "stateLabel")
    tip("Use States Editor to change an actual state name, not just a label", false, "warn");
}

function generateRandomName(): void {
  let name = "";
  if (elSelected.attr("id").slice(0, 10) === "stateLabel") {
    const id = +elSelected.attr("id").slice(10);
    const culture = pack.states[id].culture;
    name = Names.getState(Names.getCulture(culture, 4, 7, ""), culture);
  } else {
    const box = (elSelected.node() as SVGGraphicsElement).getBBox();
    const cell = findCell((box.x + box.width) / 2, (box.y + box.height) / 2)!;
    const culture = pack.cells.culture[cell];
    name = Names.getCulture(culture);
  }
  ensureEl<HTMLInputElement>("labelText").value = name;
  changeText();
}

function editGroupStyle(): void {
  const g = (elSelected.node()!.parentNode as SVGGElement).id;
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
  elSelected.select("textPath").attr("startOffset", `${value}%`);
  tip(`Label offset: ${value}%`);
}

function changeStartOffsetFromValue(this: HTMLInputElement): void {
  const value = Math.min(80, Math.max(20, +this.value));
  ensureEl<HTMLInputElement>("labelStartOffset").value = String(value);
  this.value = String(value);
  elSelected.select("textPath").attr("startOffset", `${value}%`);
  tip(`Label offset: ${value}%`);
}

function changeRelativeSize(this: HTMLInputElement): void {
  elSelected.select("textPath").attr("font-size", `${this.value}%`);
  tip(`Label relative size: ${this.value}%`);
  changeText();
}

function changeLetterSpacingSize(this: HTMLInputElement): void {
  elSelected.select("textPath").attr("letter-spacing", `${this.value}px`);
  tip(`Label letter-spacing size: ${this.value}px`);
  changeText();
}

function editLabelAlign(): void {
  const bbox = (elSelected.node() as SVGGraphicsElement).getBBox();
  const c = [bbox.x + bbox.width / 2, bbox.y + bbox.height / 2];
  const path = select<SVGElement, unknown>("#deftemp").select(`#textPath_${elSelected.attr("id")}`);
  path.attr("d", `M${c[0] - bbox.width},${c[1]}h${bbox.width * 2}`);
  drawControlPointsAndLine();
}

function editLabelLegend(): void {
  const id = elSelected.attr("id");
  const name = elSelected.text();
  void Controllers.NotesEditor.open(id, name);
}

function removeLabel(): void {
  alertMessage.innerHTML = "Are you sure you want to remove the label?";
  $("#alert").dialog({
    resizable: false,
    title: "Remove label",
    buttons: {
      Remove: function (this: HTMLElement) {
        $(this).dialog("close");
        select<SVGElement, unknown>("#deftemp")
          .select(`#textPath_${elSelected.attr("id")}`)
          .remove();
        elSelected.remove();
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
  unselect();
  $("#labelEditor").dialog("destroy");
  ensureEl("labelEditor").remove();
}

const getLastSelectedGroup = (): string => lastSelectedGroup;

export const LabelsEditor = { open, getLastSelectedGroup };
