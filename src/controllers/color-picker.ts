// The fill picker: a Chrome-like color dialog; a fill is a color, optionally drawn as a hatching pattern
import { color, hsl, rgb } from "d3";
import { Hatches } from "@/renderers/hatches";
import { destroyDialog } from "@/ui/dialog/dialog-helpers";
import { getRandomColor } from "@/utils/colorUtils";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/nodeUtils";
import { minmax } from "@/utils/numberUtils";

const DIALOG = "colorPicker";
const PRESETS = Array.from({ length: 12 }, (_, i) => hsl(i * 30, 0.7, 0.7).formatHex());
// clean, tileable hatchings shown by default; the rest stay for maps that already use them
const BASIC_HATCHES = [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11].map(i => `hatch${i}`);
const FORMATS = ["hex", "rgb", "hsl"] as const;
let format: (typeof FORMATS)[number] = "hex";

type EyeDropperApi = new () => { open: () => Promise<{ sRGBHex: string }> };
const EyeDropper = (window as unknown as { EyeDropper?: EyeDropperApi }).EyeDropper;

const STYLE = /* css */ `
  #${DIALOG} { padding: .6em; }
  #${DIALOG} > div { width: auto; }
  #${DIALOG} button { margin: 0; }
  #${DIALOG} svg { pointer-events: none; }
  #${DIALOG} .area { position: relative; height: 12em; border: 1px solid #9b9b9b; cursor: crosshair; touch-action: none;
    background: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, var(--hue)); }
  #${DIALOG} .handle { position: absolute; width: .7em; height: .7em; margin: -.45em; border: 1px solid #fff; outline: 1px solid #000; pointer-events: none; }
  #${DIALOG} .controls, #${DIALOG} .fields { display: flex; align-items: center; gap: .4em; margin-top: .6em; }
  #${DIALOG} .controls button svg { display: block; width: 1em; height: 1em; fill: currentColor; }
  #${DIALOG} .preview { flex: none; width: 1.75em; height: 1.75em; box-sizing: border-box; border: 1px solid #9b9b9b; }
  #${DIALOG} .hue { flex: 1; min-width: 0; height: .8em; border: 1px solid #9b9b9b;
    background: linear-gradient(to right, #f00, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00); }
  #${DIALOG} .inputs { display: flex; flex: 1; gap: .4em; }
  #${DIALOG} .inputs label { display: grid; flex: 1; min-width: 0; }
  #${DIALOG} .inputs label > * { grid-area: 1 / 1; }
  #${DIALOG} .inputs input { width: 100%; padding: .2em 2.2em .2em .4em; -moz-appearance: textfield; }
  #${DIALOG} .inputs input::-webkit-inner-spin-button, #${DIALOG} .inputs input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  #${DIALOG} .inputs span { align-self: center; justify-self: end; padding-right: .5em; font-size: .9em; opacity: .6; pointer-events: none; }
  #${DIALOG} .swatches { display: grid; grid-template-columns: repeat(12, 1fr); gap: .3em; margin-top: .6em; padding-top: .6em; border-top: 1px solid #0000001a; }
  #${DIALOG} .swatch { aspect-ratio: 1; padding: 0; border: 1px solid #9b9b9b; background: none; }
  #${DIALOG} .swatch:hover { border-color: #000; }
  #${DIALOG} .swatch.selected { outline: 2px solid var(--dark-solid); outline-offset: 1px; }
  #${DIALOG} .swatches:not(.expanded) .extra { display: none; }
  #${DIALOG} .expand { padding: 0; }
  #${DIALOG} .swatches svg, #${DIALOG} .preview svg { display: block; width: 100%; height: 100%; }
  #${DIALOG} .patterns { position: absolute; }
`;

const EYEDROPPER_ICON = /* html */ `<svg viewBox="0 0 16 16"><path d="M13.4 2.6a2 2 0 0 0-2.8 0L8.9 4.3 8.2 3.6 7.1 4.7l.7.7L2.5 10.7V13.5h2.8l5.3-5.3.7.7 1.1-1.1-.7-.7 1.7-1.7a2 2 0 0 0 0-2.8ZM4.7 12H4v-.7l5-5 .7.7Z"/></svg>`;

/** Close the picker if it is open, releasing the caller callback */
function close(): void {
  const dialog = findEl(DIALOG);
  if (dialog) $(dialog).dialog("close");
}

/** Open the picker for the current fill, calling back on every pick */
function open(fill: string, callback: (fill: string) => void): void {
  close();
  const hatched = Hatches.parse(fill);
  let pattern = hatched?.hatch ?? ""; // "" for a solid color
  let { h: hue, s: saturation, v: value } = toHsv(hatched?.color || normalize(fill) || PRESETS[0]);
  if (Number.isNaN(hue)) hue = 0;

  ensureEl("dialogs").insertAdjacentHTML("beforeend", renderDialog());
  const dialog = ensureEl(DIALOG);
  const find = <T extends Element = HTMLElement>(selector: string) => dialog.querySelector<T>(selector)!;
  const [area, handle, hueSlider, preview, inputs, patterns] = [
    find(".area"),
    find(".handle"),
    find<HTMLInputElement>(".hue"),
    find<SVGRectElement>(".preview rect"),
    find(".inputs"),
    find<SVGSVGElement>(".patterns")
  ];

  const render = (fields = true) => {
    const hex = toHex(hue, saturation, value);
    area.style.setProperty("--hue", toHex(hue, 1, 1));
    Object.assign(handle.style, { left: `${saturation * 100}%`, top: `${(1 - value) * 100}%`, background: hex });
    hueSlider.value = String(Math.round(hue));
    patterns.style.color = hex; // the hatching swatches draw in the current color
    preview.setAttribute("fill", pattern ? `url(#picker-${pattern})` : hex);
    if (fields) {
      const elements = inputs.querySelectorAll("input");
      getFields(hex, hue).forEach((field, i) => {
        elements[i].value = String(field.value);
      });
    }
    for (const swatch of dialog.querySelectorAll<HTMLElement>("[data-color]")) {
      swatch.classList.toggle("selected", swatch.dataset.color === hex);
    }
    for (const swatch of dialog.querySelectorAll<HTMLElement>("[data-hatch]")) {
      swatch.classList.toggle("selected", swatch.dataset.hatch === pattern);
    }
  };

  const pick = (fields = true) => {
    const hex = toHex(hue, saturation, value);
    const picked = pattern ? Hatches.fill(pattern, hex) : hex;
    render(fields);
    Hatches.ensure(picked);
    callback(picked);
  };

  const pickColor = (hex: string, fields = true) => {
    const hsv = toHsv(hex);
    if (!Number.isNaN(hsv.h)) hue = hsv.h;
    [saturation, value] = [hsv.s, hsv.v];
    pick(fields);
  };

  const pickFromArea = (event: PointerEvent) => {
    const { left, top, width, height } = area.getBoundingClientRect();
    saturation = minmax((event.clientX - left) / width, 0, 1);
    value = 1 - minmax((event.clientY - top) / height, 0, 1);
    pick();
  };

  area.addEventListener("pointerdown", event => {
    area.setPointerCapture(event.pointerId);
    pickFromArea(event);
  });
  area.addEventListener("pointermove", event => {
    if (area.hasPointerCapture(event.pointerId)) pickFromArea(event);
  });

  hueSlider.addEventListener("input", () => {
    hue = hueSlider.valueAsNumber;
    pick();
  });

  // typing updates the map live but leaves the fields alone; committing a field normalizes them in place
  inputs.addEventListener("input", () => {
    const values = Array.from(inputs.querySelectorAll("input"), input => input.value.trim());
    const hex = parseFields(values);
    if (!hex) return;
    pickColor(hex, false);
    if (format === "hsl") {
      hue = Number(values[0]) % 360;
      render(false);
    }
  });
  inputs.addEventListener("change", () => render());

  const buildFields = () => {
    inputs.innerHTML = getFields(toHex(hue, saturation, value), hue)
      .map(renderField)
      .join("");
  };

  find(".format").addEventListener("click", () => {
    format = FORMATS[(FORMATS.indexOf(format) + 1) % FORMATS.length];
    buildFields();
  });

  find(".random").addEventListener("click", () => pickColor(getRandomColor()));

  const eyedropper = find(".eyedropper");
  if (EyeDropper) {
    eyedropper.addEventListener("click", async () => {
      const picked = await new EyeDropper()
        .open()
        .then(result => normalize(result.sRGBHex))
        .catch(() => ""); // cancelled with Esc
      if (picked && dialog.isConnected) pickColor(picked);
    });
  } else eyedropper.remove();

  dialog.addEventListener("click", event => {
    const swatch = (event.target as Element).closest<HTMLElement>(".swatch");
    if (swatch?.dataset.color) pickColor(swatch.dataset.color);
    else if (swatch?.dataset.hatch) {
      pattern = pattern === swatch.dataset.hatch ? "" : swatch.dataset.hatch; // clicking the selected one goes solid
      pick();
    }
  });

  const hatchGrid = find(".hatches");
  const expandButton = find(".expand");
  const expand = (expanded: boolean) => {
    hatchGrid.classList.toggle("expanded", expanded);
    expandButton.className = `expand ${expanded ? "icon-up-open" : "icon-down-open"}`;
    expandButton.dataset.tip = expanded ? t("Show only the basic hatchings") : t("Show all hatchings");
  };
  expandButton.addEventListener("click", () => expand(!hatchGrid.classList.contains("expanded")));
  expand(Boolean(pattern) && !BASIC_HATCHES.includes(pattern));

  buildFields();
  render();

  $(dialog).dialog({
    title: t("Color Picker"),
    resizable: false,
    width: "26em",
    position: { my: "center", at: "center", of: "svg" },
    close: () => destroyDialog(DIALOG)
  });
}

function renderDialog(): string {
  const bases = Hatches.bases();
  const previews = bases.map(base => Hatches.recolor(base, `picker-${base.id}`, "currentColor").outerHTML).join("");
  const swatch = (data: string, fill: string, hint: string, extra = false) =>
    /* html */ `<button class="swatch${extra ? " extra" : ""}" ${data} data-tip="${hint}"><svg><rect width="100%" height="100%" fill="${fill}" /></svg></button>`;
  const colors = PRESETS.map(color => swatch(`data-color="${color}"`, color, t("Click to fill with the color")));
  const hatch = (id: string) =>
    swatch(
      `data-hatch="${id}"`,
      `url(#picker-${id})`,
      sentences(t("Click to fill with the hatching {{hatching}}", { hatching: id }), t("Click again to remove it")),
      !BASIC_HATCHES.includes(id)
    );
  const extras = bases.map(({ id }) => id).filter(id => !BASIC_HATCHES.includes(id));

  return /* html */ `<div id="${DIALOG}" class="dialog">
    <style>${STYLE}</style>
    <svg class="patterns" width="0" height="0"><defs>${previews}</defs></svg>
    <div class="area" data-tip="${t("Drag to set saturation and brightness")}"><div class="handle"></div></div>
    <div class="controls">
      <button class="eyedropper" data-tip="${t("Pick a color from the screen")}">${EYEDROPPER_ICON}</button>
      <span class="preview" data-tip="${t("Current fill")}"><svg><rect width="100%" height="100%" /></svg></span>
      <input class="hue" type="range" min="0" max="360" step="1" data-tip="${t("Set hue")}" />
      <button class="random icon-shuffle" data-tip="${t("Pick a random color")}"></button>
    </div>
    <div class="fields">
      <div class="inputs"></div>
      <button class="format icon-resize-vertical" data-tip="${t("Switch color format")}"></button>
    </div>
    <div class="swatches">${colors.join("")}</div>
    <div class="swatches hatches">
      ${BASIC_HATCHES.map(hatch).join("")}
      <button class="expand"></button>${extras.map(hatch).join("")}
    </div>
  </div>`;
}

type Field = { label: string; value: string | number; max?: number };

function getFields(hex: string, hue: number): Field[] {
  if (format === "hex") return [{ label: "HEX", value: hex }];
  if (format === "rgb") {
    const { r, g, b } = rgb(hex);
    return [
      { label: "R", value: r, max: 255 },
      { label: "G", value: g, max: 255 },
      { label: "B", value: b, max: 255 }
    ];
  }
  const { s, l } = hsl(hex);
  return [
    { label: "H", value: Math.round(hue), max: 360 },
    { label: "S", value: Math.round((s || 0) * 100), max: 100 },
    { label: "L", value: Math.round(l * 100), max: 100 }
  ];
}

function renderField({ label, value, max }: Field): string {
  const type = max ? `type="number" min="0" max="${max}"` : `type="text" maxlength="7"`;
  return /* html */ `<label><input ${type} value="${value}" spellcheck="false" autocomplete="off" /><span>${label}</span></label>`;
}

/** The fields' color as HEX, or "" while they hold an incomplete or invalid value */
function parseFields(values: string[]): string {
  if (format === "hex")
    return /^#?([\da-f]{3}|[\da-f]{6})$/i.test(values[0]) ? normalize(`#${values[0].replace("#", "")}`) : "";

  const numbers = values.map(Number);
  const limits = format === "rgb" ? [255, 255, 255] : [360, 100, 100];
  if (values.some(value => value === "") || numbers.some((n, i) => !(n >= 0 && n <= limits[i]))) return "";
  const [a, b, c] = numbers;
  return format === "rgb" ? rgb(a, b, c).formatHex() : hsl(a, b / 100, c / 100).formatHex();
}

/** A CSS color as lowercase 6-digit HEX; "" for a hatching or another non-color fill */
function normalize(fill: string): string {
  return color(fill)?.formatHex() || "";
}

function toHex(hue: number, saturation: number, value: number): string {
  const channel = (n: number) => {
    const k = (n + hue / 60) % 6;
    return (value - value * saturation * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return rgb(channel(5), channel(3), channel(1)).formatHex();
}

/** HSV with hue in degrees, NaN for greys */
function toHsv(hex: string): { h: number; s: number; v: number } {
  const { r, g, b } = rgb(hex);
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  const sector = !delta
    ? NaN
    : max === red
      ? ((green - blue) / delta + 6) % 6
      : max === green
        ? (blue - red) / delta + 2
        : (red - green) / delta + 4;
  return { h: sector * 60, s: max ? delta / max : 0, v: max };
}

export const ColorPicker = { open, close };
