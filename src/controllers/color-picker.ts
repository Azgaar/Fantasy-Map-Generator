// The fill picker: an SVG overlay to pick a color or a hatching pattern.
import { type D3DragEvent, drag, hsl, rgb, select } from "d3";
import { tip } from "@/components/tooltips";
import { parseTransform, rn } from "@/utils";

type ColorSpace = "hsl" | "rgb" | "hex";

const CONTROLS = ["pickerH", "pickerS", "pickerL"] as const;
const CONTROL_MAX = { pickerH: 360, pickerS: 1, pickerL: 1 } as const;
const COLUMNS = 14;
const SWATCH_STEP_X = 22;
const SWATCH_STEP_Y = 20;
const SWATCH_X = 4;
const SWATCH_SIZE = 16;
const PICKER_WIDTH = 315;

/** Open the picker for the current fill, calling back on every pick */
function open(fill: string, callback: (fill: string) => void): void {
  document.getElementById("pickerContainer")?.remove();
  const container = renderPicker();
  addListeners(container, callback);

  if (fill[0] === "#") {
    setControlsFromColor(fill);
    updateSpaces();
    updatePickerColors();
  }

  updateSelectedRect(fill);
}

function renderPicker(): SVGSVGElement {
  const hatches = Array.from(document.querySelectorAll<SVGPatternElement>("g#defs-hatching > pattern"));
  const number = hatches.length;
  const colors = Array.from({ length: number }, (_, i) => hsl((i / number) * 360, 0.7, 0.7).formatHex());
  const rows = Math.ceil(number / COLUMNS);
  const colorsBottom = 36 + rows * SWATCH_STEP_Y;
  const hatchesBottom = 16 + number * 2 + rows * SWATCH_STEP_Y;
  const height = Math.max(40, colorsBottom, hatchesBottom) + 9;
  const x = (svgWidth - PICKER_WIDTH) / 2;
  const y = (svgHeight - height) / 2;
  const zIndex =
    Array.from(document.querySelectorAll<HTMLElement>(".ui-front")).reduce(
      (max, element) => Math.max(max, Number(getComputedStyle(element).zIndex) || 0),
      100
    ) + 1;

  const controls = [
    { id: "pickerH", label: "H:", x: 4, x1: 18, x2: 107, cx: 75, tip: "Set palette hue" },
    { id: "pickerS", label: "S:", x: 113, x1: 124, x2: 206, cx: 181.4, tip: "Set palette saturation" },
    { id: "pickerL", label: "L:", x: 213, x1: 226, x2: 306, cx: 282, tip: "Set palette lightness" }
  ]
    .map(
      control => /* html */ `<g data-tip="${control.tip}">
        <text x="${control.x}" y="14">${control.label}</text>
        <line x1="${control.x1}" y1="10" x2="${control.x2}" y2="10"></line>
        <circle cx="${control.cx}" cy="10" r="5" id="${control.id}"></circle>
      </g>`
    )
    .join("");

  const colorRects = colors
    .map(
      (color, i) => /* html */ `<rect
        id="picker_${color}"
        fill="${color}"
        class="${i ? "" : "selected"}"
        x="${(i % COLUMNS) * SWATCH_STEP_X + SWATCH_X}"
        y="${40 + Math.floor(i / COLUMNS) * SWATCH_STEP_Y}"
        width="${SWATCH_SIZE}"
        height="${SWATCH_SIZE}"
      ></rect>`
    )
    .join("");

  const hatchRects = hatches
    .map(
      (hatch, i) => /* html */ `<rect
        id="picker_${hatch.id}"
        fill="url(#${hatch.id})"
        x="${(i % COLUMNS) * SWATCH_STEP_X + SWATCH_X}"
        y="${Math.floor(i / COLUMNS) * SWATCH_STEP_Y + 20 + number * 2}"
        width="${SWATCH_SIZE}"
        height="${SWATCH_SIZE}"
      ></rect>`
    )
    .join("");

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

  document.body.insertAdjacentHTML(
    "beforeend",
    /* html */ `<svg
      id="pickerContainer"
      width="100%"
      height="100%"
      style="z-index: ${zIndex}"
    >
      <rect id="pickerOverlay" x="0" y="0" width="100%" height="100%" opacity="0.2"></rect>
      <g id="picker" transform="translate(${x},${y})">
        <rect id="pickerBackground" x="0" y="0" width="${PICKER_WIDTH}" height="${height}" fill="#ffffff" stroke="#5d4651"></rect>
        <g id="pickerControls">${controls}</g>
        <foreignObject id="pickerSpaces" x="4" y="20" width="303" height="20">${SPACES_HTML}</foreignObject>
        <g id="pickerColors" stroke="#333333">${colorRects}</g>
        <g id="pickerHatches" stroke="#333333">${hatchRects}</g>
        <rect id="pickerHeader" x="0" y="-30" width="${PICKER_WIDTH}" height="30"></rect>
        <text id="pickerLabel" x="12" y="-10">Color Picker</text>
        <rect id="pickerCloseRect" x="${PICKER_WIDTH - 23}" y="-21" width="14" height="14"></rect>
        <text id="pickerCloseText" x="${PICKER_WIDTH - 20}" y="-10">✕</text>
      </g>
    </svg>`
  );

  return document.getElementById("pickerContainer") as unknown as SVGSVGElement;
}

function addListeners(container: SVGSVGElement, callback: (fill: string) => void): void {
  const picker = getSvgElement<SVGGElement>("picker");
  const closePicker = () => container.remove();
  const tipClose = () => tip("Click to close the picker");
  const tipDrag = () => tip("Drag to change the picker position");

  getSvgElement("pickerOverlay").addEventListener("mousemove", tipClose);
  getSvgElement("pickerOverlay").addEventListener("click", closePicker);
  getSvgElement("pickerCloseRect").addEventListener("mousemove", tipClose);
  getSvgElement("pickerCloseRect").addEventListener("click", closePicker);
  getSvgElement("pickerBackground").addEventListener("mousemove", tipDrag);
  getSvgElement("pickerHeader").addEventListener("mousemove", tipDrag);
  getSvgElement("pickerLabel").addEventListener("mousemove", tipDrag);

  getSvgElement("pickerControls").addEventListener("mousemove", event => {
    const control = (event.target as Element).closest<SVGGElement>("g[data-tip]");
    if (control) tip(control.dataset.tip || "");
  });

  container.querySelectorAll<SVGLineElement>("#pickerControls line").forEach(line => {
    line.addEventListener("click", event => onControlClicked(event, callback));
  });

  container.querySelectorAll<HTMLInputElement>("#pickerSpaces input").forEach(input => {
    input.addEventListener("change", event => onSpaceChanged(event, callback));
  });
  getSvgElement("pickerSpaces").addEventListener("mousemove", () =>
    tip("Color value in different color spaces. Edit to change")
  );

  addFillListeners(getSvgElement("pickerColors"), callback, "Click to fill with the color");
  addFillListeners(getSvgElement("pickerHatches"), callback);

  select(picker).call(
    drag<SVGGElement, unknown>()
      .filter(event => (event.target as HTMLElement).tagName !== "INPUT")
      .on("start", function (event) {
        onPickerDrag.call(this, event);
      })
  );

  select(picker)
    .selectAll<SVGCircleElement, unknown>("#pickerControls circle")
    .call(
      drag<SVGCircleElement, unknown>().on("start", function (event) {
        onControlDrag.call(this, event, callback);
      })
    );
}

function addFillListeners(group: SVGGElement, callback: (fill: string) => void, hint?: string): void {
  group.addEventListener("click", event => {
    const rect = (event.target as Element).closest<SVGRectElement>("rect");
    if (rect) onFillClicked(rect, callback);
  });
  group.addEventListener("mouseover", event => {
    const rect = (event.target as Element).closest<SVGRectElement>("rect");
    if (rect) tip(hint || `Click to fill with the hatching ${rect.id}`);
  });
}

function getSvgElement<T extends SVGElement = SVGElement>(id: string): T {
  return document.getElementById(id) as unknown as T;
}

function setControlsFromColor(fill: string): void {
  const { h, s, l } = hsl(fill);
  if (!Number.isNaN(h)) setPickerControl("pickerH", h, 360);
  if (!Number.isNaN(s)) setPickerControl("pickerS", s, 1);
  if (!Number.isNaN(l)) setPickerControl("pickerL", l, 1);
}

function pickFill(callback: (fill: string) => void): void {
  const selected = getSvgElement("picker").querySelector("rect.selected");
  if (selected) callback(selected.getAttribute("fill") as string);
}

function updateSelectedRect(fill: string): void {
  const picker = getSvgElement("picker");
  picker.querySelector("rect.selected")?.classList.remove("selected");
  picker.querySelector(`rect[fill='${fill.toLowerCase()}']`)?.classList.add("selected");
}

const getControl = (id: (typeof CONTROLS)[number]) => getSvgElement<SVGCircleElement>(id);

function setPickerControl(id: (typeof CONTROLS)[number], value: number, max: number): void {
  const control = getControl(id);
  const line = control.previousElementSibling as SVGLineElement;
  const min = Number(line.getAttribute("x1"));
  const delta = Number(line.getAttribute("x2")) - min;
  control.setAttribute("cx", String(min + delta * (value / max)));
}

function getPickerControl(id: (typeof CONTROLS)[number]): number {
  const control = getControl(id);
  const line = control.previousElementSibling as SVGLineElement;
  const min = Number(line.getAttribute("x1"));
  const delta = Number(line.getAttribute("x2")) - min;
  return ((Number(control.getAttribute("cx")) - min) / delta) * CONTROL_MAX[id];
}

const getHSL = () => hsl(getPickerControl("pickerH"), getPickerControl("pickerS"), getPickerControl("pickerL"));

/** Sync the numeric HSL/RGB/HEX inputs with the control positions */
function updateSpaces(): void {
  const { h, s, l } = getHSL();
  const setValue = (id: string, value: string | number) => {
    (document.getElementById(id) as HTMLInputElement).value = String(value);
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
  const colors = Array.from(getSvgElement("pickerColors").querySelectorAll<SVGRectElement>("rect"));
  const number = colors.length;
  const { h, s, l } = getHSL();

  colors.forEach((rect, i) => {
    const color = hsl((i / number) * 180 + h, s, l).formatHex();
    rect.id = `picker_${color}`;
    rect.setAttribute("fill", color);
  });
}

function onFillClicked(rect: SVGRectElement, callback: (fill: string) => void): void {
  const fill = rect.getAttribute("fill") as string;
  updateSelectedRect(fill);
  pickFill(callback);

  const { h } = hsl(fill);
  if (Number.isNaN(h)) return; // hatching, not a color
  setPickerControl("pickerH", h, 360);
  updateSpaces();
}

function onControlClicked(event: MouseEvent, callback: (fill: string) => void): void {
  const line = event.currentTarget as SVGLineElement;
  const min = line.getScreenCTM()?.e || 0;
  (line.nextElementSibling as SVGCircleElement).setAttribute("cx", String(event.x - min));
  updateSpaces();
  updatePickerColors();
  pickFill(callback);
}

function onControlDrag(
  this: SVGCircleElement,
  event: D3DragEvent<SVGCircleElement, unknown, unknown>,
  callback: (fill: string) => void
): void {
  const line = this.previousElementSibling as SVGLineElement;
  const min = Number(line.getAttribute("x1"));
  const max = Number(line.getAttribute("x2"));

  event.on("drag", dragEvent => {
    this.setAttribute("cx", String(Math.max(Math.min(dragEvent.x, max), min)));
    updateSpaces();
    updatePickerColors();
    pickFill(callback);
  });
}

function onSpaceChanged(event: Event, callback: (fill: string) => void): void {
  const input = event.currentTarget as HTMLInputElement;
  const invalid = () => tip("You must provide a correct value", false, "error");
  if (!input.checkValidity()) return void invalid();

  const space = input.dataset.space as ColorSpace;
  const values = Array.from(input.parentNode?.querySelectorAll("input") || []).map(input => input.value);
  const fill =
    space === "hex"
      ? rgb(input.value)
      : space === "rgb"
        ? rgb(Number(values[0]), Number(values[1]), Number(values[2]))
        : hsl(Number(values[0]), Number(values[1]) / 100, Number(values[2]) / 100);

  const { l } = hsl(fill);
  if (Number.isNaN(l)) return void invalid();

  setControlsFromColor(fill.formatHex());
  updateSpaces();
  updatePickerColors();
  pickFill(callback);
}

function onPickerDrag(this: SVGGElement, event: D3DragEvent<SVGGElement, unknown, unknown>): void {
  const transform = parseTransform(this.getAttribute("transform")!);
  const x = Number(transform[0]) - event.x;
  const y = Number(transform[1]) - event.y;
  const bbox = this.getBBox();

  event.on("drag", dragEvent => {
    const px = rn(((x + dragEvent.x + bbox.width) / svgWidth) * 100, 2);
    const py = rn(((y + dragEvent.y + bbox.height) / svgHeight) * 100, 2);
    this.setAttribute("transform", `translate(${x + dragEvent.x},${y + dragEvent.y})`);
    this.dataset.x = String(px);
    this.dataset.y = String(py);
  });
}

export const ColorPicker = { open };
