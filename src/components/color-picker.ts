// The fill picker: an SVG overlay to pick a color or a hatching pattern.
import { type D3DragEvent, drag, hsl, range, rgb, type Selection, select, selectAll } from "d3";
import { ensureEl, parseTransform, rn } from "@/utils";
import { tip } from "./tooltips";

type ColorSpace = "hsl" | "rgb" | "hex";

let applyFill: ((fill: string) => void) | null = null;

const CONTROLS = ["pickerH", "pickerS", "pickerL"] as const;
const CONTROL_MAX = { pickerH: 360, pickerS: 1, pickerL: 1 } as const;

/** Open the picker for the current fill, calling back on every pick */
export function openPicker(fill: string, callback: (fill: string) => void): void {
  if (!select("#picker").size()) createPicker();
  select("#pickerContainer").style("display", "block");

  applyFill = callback;

  if (fill[0] === "#") {
    setControlsFromColor(fill);
    updateSpaces();
    updatePickerColors();
  }

  updateSelectedRect(fill);
}

function setControlsFromColor(fill: string): void {
  const { h, s, l } = hsl(fill);
  if (!Number.isNaN(h)) setPickerControl("pickerH", h, 360);
  if (!Number.isNaN(s)) setPickerControl("pickerS", s, 1);
  if (!Number.isNaN(l)) setPickerControl("pickerL", l, 1);
}

function pickFill(): void {
  const selected = ensureEl("picker").querySelector("rect.selected");
  if (selected && applyFill) applyFill(selected.getAttribute("fill") as string);
}

function updateSelectedRect(fill: string): void {
  const picker = ensureEl("picker");
  picker.querySelector("rect.selected")?.classList.remove("selected");
  picker.querySelector(`rect[fill='${fill.toLowerCase()}']`)?.classList.add("selected");
}

const getControl = (id: (typeof CONTROLS)[number]) => ensureEl(id) as unknown as SVGCircleElement;

function setPickerControl(id: (typeof CONTROLS)[number], value: number, max: number): void {
  const control = getControl(id);
  const line = control.previousSibling as SVGLineElement;
  const min = Number(line.getAttribute("x1"));
  const delta = Number(line.getAttribute("x2")) - min;
  control.setAttribute("cx", String(min + delta * (value / max)));
}

function getPickerControl(id: (typeof CONTROLS)[number]): number {
  const control = getControl(id);
  const line = control.previousSibling as SVGLineElement;
  const min = Number(line.getAttribute("x1"));
  const delta = Number(line.getAttribute("x2")) - min;
  return ((Number(control.getAttribute("cx")) - min) / delta) * CONTROL_MAX[id];
}

const getHSL = () => hsl(getPickerControl("pickerH"), getPickerControl("pickerS"), getPickerControl("pickerL"));

/** Sync the numeric HSL/RGB/HEX inputs with the control positions */
function updateSpaces(): void {
  const { h, s, l } = getHSL();
  const setValue = (id: string, value: string | number) => {
    ensureEl<HTMLInputElement>(id).value = String(value);
  };

  setValue("pickerHSL_H", rn(h));
  setValue("pickerHSL_S", rn(s * 100));
  setValue("pickerHSL_L", rn(l * 100));

  const color = rgb(getHSL());
  setValue("pickerRGB_R", color.r);
  setValue("pickerRGB_G", color.g);
  setValue("pickerRGB_B", color.b);
  setValue("pickerHEX", color.formatHex());
}

/** Re-tint the color swatches around the current hue, saturation and lightness */
function updatePickerColors(): void {
  const colors = select("#picker > #pickerColors").selectAll<SVGRectElement, unknown>("rect");
  const number = colors.size();
  const { h, s, l } = getHSL();

  colors.each(function (_datum, i) {
    const clr = hsl((i / number) * 180 + h, s, l).formatHex();
    this.setAttribute("id", `picker_${clr}`);
    this.setAttribute("fill", clr);
  });
}

function onFillClicked(this: SVGRectElement): void {
  const fill = this.getAttribute("fill") as string;
  updateSelectedRect(fill);
  pickFill();

  const { h } = hsl(fill);
  if (Number.isNaN(h)) return; // hatching, not a color
  setPickerControl("pickerH", h, 360);
  updateSpaces();
}

function onControlClicked(this: SVGLineElement, event: MouseEvent): void {
  const min = this.getScreenCTM()?.e || 0;
  (this.nextSibling as SVGCircleElement).setAttribute("cx", String(event.x - min));
  updateSpaces();
  updatePickerColors();
  pickFill();
}

function onControlDrag(this: SVGCircleElement, event: D3DragEvent<SVGCircleElement, unknown, unknown>): void {
  const line = this.previousSibling as SVGLineElement;
  const min = Number(line.getAttribute("x1"));
  const max = Number(line.getAttribute("x2"));

  event.on("drag", dragEvent => {
    this.setAttribute("cx", String(Math.max(Math.min(dragEvent.x, max), min)));
    updateSpaces();
    updatePickerColors();
    pickFill();
  });
}

function onSpaceChanged(this: HTMLInputElement): void {
  const invalid = () => tip("You must provide a correct value", false, "error");
  if (!this.checkValidity()) return void invalid();

  const space = this.dataset.space as ColorSpace;
  const values = Array.from(this.parentNode?.querySelectorAll("input") || []).map(input => input.value);
  const fill =
    space === "hex"
      ? rgb(this.value)
      : space === "rgb"
        ? rgb(Number(values[0]), Number(values[1]), Number(values[2]))
        : hsl(Number(values[0]), Number(values[1]) / 100, Number(values[2]) / 100);

  const { l } = hsl(fill);
  if (Number.isNaN(l)) return void invalid();

  setControlsFromColor(fill.formatHex());
  updateSpaces();
  updatePickerColors();
  pickFill();
}

function onPickerDrag(event: D3DragEvent<SVGGElement, unknown, unknown>): void {
  const picker = select<SVGGElement, unknown>("#picker");
  const transform = parseTransform(picker.attr("transform"));
  const x = Number(transform[0]) - event.x;
  const y = Number(transform[1]) - event.y;
  const bbox = (picker.node() as SVGGElement).getBBox();

  event.on("drag", dragEvent => {
    const px = rn(((x + dragEvent.x + bbox.width) / svgWidth) * 100, 2);
    const py = rn(((y + dragEvent.y + bbox.height) / svgHeight) * 100, 2);
    picker
      .attr("transform", `translate(${x + dragEvent.x},${y + dragEvent.y})`)
      .attr("data-x", px)
      .attr("data-y", py);
  });
}

const SPACES_HTML = /* html */ `<label style="margin-right: 6px"
    >HSL: <input type="number" id="pickerHSL_H" data-space="hsl" min="0" max="360" value="231" />,
    <input type="number" id="pickerHSL_S" data-space="hsl" min="0" max="100" value="70" />,
    <input type="number" id="pickerHSL_L" data-space="hsl" min="0" max="100" value="70" />
  </label>
  <label style="margin-right: 6px"
    >RGB: <input type="number" id="pickerRGB_R" data-space="rgb" min="0" max="255" value="125" />,
    <input type="number" id="pickerRGB_G" data-space="rgb" min="0" max="255" value="142" />,
    <input type="number" id="pickerRGB_B" data-space="rgb" min="0" max="255" value="232" />
  </label>
  <label>HEX: <input type="text" id="pickerHEX" data-space="hex" style="width:42px" autocorrect="off" spellcheck="false" value="#7d8ee8" /></label>`;

function createPicker(): void {
  const tipClose = () => tip("Click to close the picker");
  const closePicker = () => container.style("display", "none");

  const container = select("body")
    .append("svg")
    .attr("id", "pickerContainer")
    .attr("width", "100%")
    .attr("height", "100%");

  container
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("opacity", 0.2)
    .on("mousemove", tipClose)
    .on("click", closePicker);

  const picker = container
    .append("g")
    .attr("id", "picker")
    .call(
      drag<SVGGElement, unknown>()
        .filter(event => (event.target as HTMLElement).tagName !== "INPUT")
        .on("start", onPickerDrag)
    );

  appendControls(picker);
  appendSpaces(picker);
  appendFills(picker);
  appendChrome(picker);
}

type PickerSelection = Selection<SVGGElement, unknown, HTMLElement, any>;

function appendControls(picker: PickerSelection): void {
  const controls = picker.append("g").attr("id", "pickerControls");

  const appendControl = (id: string, label: string, x: number, x1: number, x2: number, cx: number, hint: string) => {
    const group = controls.append("g");
    group.append("text").attr("x", x).attr("y", 14).text(label);
    group.append("line").attr("x1", x1).attr("y1", 10).attr("x2", x2).attr("y2", 10);
    group.append("circle").attr("cx", cx).attr("cy", 10).attr("r", 5).attr("id", id);
    group.on("mousemove", () => tip(hint));
  };

  appendControl("pickerH", "H:", 4, 18, 107, 75, "Set palette hue");
  appendControl("pickerS", "S:", 113, 124, 206, 181.4, "Set palette saturation");
  appendControl("pickerL", "L:", 213, 226, 306, 282, "Set palette lightness");

  controls.selectAll<SVGLineElement, unknown>("line").on("click", onControlClicked);
  controls
    .selectAll<SVGCircleElement, unknown>("circle")
    .call(drag<SVGCircleElement, unknown>().on("start", onControlDrag));
}

function appendSpaces(picker: PickerSelection): void {
  const spaces = picker
    .append("foreignObject")
    .attr("id", "pickerSpaces")
    .attr("x", 4)
    .attr("y", 20)
    .attr("width", 303)
    .attr("height", 20)
    .on("mousemove", () => tip("Color value in different color spaces. Edit to change"));

  (spaces.node() as Element).insertAdjacentHTML("beforeend", SPACES_HTML);
  spaces.selectAll<HTMLInputElement, unknown>("input").on("change", onSpaceChanged);
}

/** Append the color swatches and the hatching swatches */
function appendFills(picker: PickerSelection): void {
  const colors = picker.append("g").attr("id", "pickerColors").attr("stroke", "#333333");
  const hatches = picker.append("g").attr("id", "pickerHatches").attr("stroke", "#333333");

  const hatching = selectAll<SVGPatternElement, unknown>("g#defs-hatching > pattern");
  const number = hatching.size();

  range(number)
    .map(i => hsl((i / number) * 360, 0.7, 0.7).formatHex())
    .forEach((clr, i) => {
      colors
        .append("rect")
        .attr("id", `picker_${clr}`)
        .attr("fill", clr)
        .attr("class", i ? "" : "selected")
        .attr("x", (i % 14) * 22 + 4)
        .attr("y", 40 + Math.floor(i / 14) * 20)
        .attr("width", 16)
        .attr("height", 16);
    });

  hatching.each(function (_datum, i) {
    hatches
      .append("rect")
      .attr("id", `picker_${this.id}`)
      .attr("fill", `url(#${this.id})`)
      .attr("x", (i % 14) * 22 + 4)
      .attr("y", Math.floor(i / 14) * 20 + 20 + number * 2)
      .attr("width", 16)
      .attr("height", 16);
  });

  colors
    .selectAll<SVGRectElement, unknown>("rect")
    .on("click", onFillClicked)
    .on("mouseover", () => tip("Click to fill with the color"));

  hatches
    .selectAll<SVGRectElement, unknown>("rect")
    .on("click", onFillClicked)
    .on("mouseover", function (this: SVGRectElement) {
      tip(`Click to fill with the hatching ${this.id}`);
    });
}

/** Append the picker frame: background, header, title and close button */
function appendChrome(picker: PickerSelection): void {
  const tipDrag = () => tip("Drag to change the picker position");
  const tipClose = () => tip("Click to close the picker");
  const closePicker = () => select("#pickerContainer").style("display", "none");

  const bbox = (picker.node() as SVGGElement).getBBox();
  const width = bbox.width + 8;
  const height = bbox.height + 9;

  picker
    .insert("rect", ":first-child")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "#ffffff")
    .attr("stroke", "#5d4651")
    .on("mousemove", tipDrag);

  picker
    .insert("text", ":first-child")
    .attr("x", width - 20)
    .attr("y", -10)
    .attr("id", "pickerCloseText")
    .text("✕");

  picker
    .insert("rect", ":first-child")
    .attr("x", width - 23)
    .attr("y", -21)
    .attr("id", "pickerCloseRect")
    .attr("width", 14)
    .attr("height", 14)
    .on("mousemove", tipClose)
    .on("click", closePicker);

  picker
    .insert("text", ":first-child")
    .attr("x", 12)
    .attr("y", -10)
    .attr("id", "pickerLabel")
    .text("Color Picker")
    .on("mousemove", tipDrag);

  picker
    .insert("rect", ":first-child")
    .attr("x", 0)
    .attr("y", -30)
    .attr("width", width)
    .attr("height", 30)
    .attr("id", "pickerHeader")
    .on("mousemove", tipDrag);

  picker.attr("transform", `translate(${(svgWidth - width) / 2},${(svgHeight - height) / 2})`);
}

export const ColorPicker = { open: openPicker };
