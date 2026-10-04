// The controls the style editor adds to SchemaForm: each owns its option source and any dialog it opens,
// and the composed ones call `set` with the whole string the schema format expects

import { Icons } from "@/components/icons";
import { Controllers } from "@/controllers";
import { TEXTURES } from "@/data/textures";
import { FORMATS, isLabelStyle } from "@/generators/styles-formats";
import { HeightmapColorSchemes } from "@/renderers/heightmap-color-schemes";
import { getLabelsIndex } from "@/renderers/labels/label-data";
import type { StandardControl, StyleControl } from "@/types/styles";
import { ensureEl, escapeHtml, findEl, htmlEl, rn } from "@/utils";
import {
  openAddFontDialog,
  openFontDialog,
  openSchemeBuilder,
  openTextureUrlDialog,
  trackControlDialog
} from "./dialogs";
import { type ControlFactory, type FieldSpec, inline, row, rows, STANDARD_CONTROLS, unsetValue } from "./schema-form";

const selectOf = (entries: [string, string][], value: string): HTMLSelectElement => {
  const select = htmlEl("select");
  for (const [v, label] of entries) select.add(new Option(label, v));
  select.value = value;
  return select;
};
const sideButton = (icon: string, tipText: string): HTMLButtonElement => {
  const button = htmlEl("button", { className: `${icon} sideButton`, style: "flex: none; margin-block: 0" });
  button.dataset.tip = tipText;
  return button;
};

// url(#id) from the map's own filter defs, or none
const filter: ControlFactory = (spec, value, set) => {
  const entries: [string, string][] = [["", "None"]];
  for (const def of ensureEl("filters").querySelectorAll("filter[id][name]")) {
    entries.push([`url(#${def.id})`, def.getAttribute("name") ?? def.id]);
  }
  const current = typeof value === "string" && value !== "none" ? value : "";
  if (current && !entries.some(([v]) => v === current)) entries.push([current, current]); // a CSS filter list a preset carries
  const select = selectOf(entries, current);
  select.addEventListener("change", () => set(select.value || unsetValue(spec)));
  return select;
};

// the current family drawn in itself; the families open in a dialog that renders the group's labels in each
const font: ControlFactory = (_spec, value, set) => {
  const button = pickButton();
  let current = typeof value === "string" ? value : "";
  const show = () => {
    button.textContent = current || "none";
    button.style.fontFamily = current;
  };
  show();
  button.addEventListener("click", () =>
    openFontDialog({
      selected: current,
      sample: fontSample(),
      onPick: family => {
        current = family;
        show();
        set(family);
      },
      onAdd: openAddFontDialog
    })
  );
  return button;
};

// what the selected label group says, so the dialog and the card preview show the map's own words;
// other elements get a stock sample
export function fontSample(): string {
  const element = ensureEl<HTMLSelectElement>("styleElementSelect").value;
  if (element !== "labels") return element === "legend" ? "Legend" : "Sample";
  const group = ensureEl<HTMLSelectElement>("styleGroupSelect").value;
  const texts = getLabelsIndex()
    .filter(label => label.group === group && label.text)
    .map(label => label.text);
  return [...new Set(texts)].slice(0, 2).join(", ") || "Sample";
}

// blur(Npx), null at 0
const blur: ControlFactory = (spec, value, set) => {
  const current = Number.parseFloat(String(value ?? "").match(/blur\(([^)]+)\)/)?.[1] ?? "") || 0;
  const slider = STANDARD_CONTROLS.slider!({ ...spec, step: spec.step ?? 0.1, nullAs: 0 }, current, next => {
    const px = Number(next);
    set(px > 0 ? `blur(${px}px)` : unsetValue(spec));
  });
  return inline(slider, "px");
};

// a dash array the schema pins the format of, so a half-typed value never reaches the store
const dash: ControlFactory = (spec, value, set) => {
  const input = htmlEl("input", {
    type: "text",
    value: value == null || value === "none" ? "" : String(value),
    placeholder: "none"
  });
  input.addEventListener("input", () => {
    const next = input.value.trim();
    if (!next || next === "none") set(unsetValue(spec));
    else if (FORMATS.strokeDasharray.test(next)) set(next);
  });
  return input;
};

const withTip = <T extends HTMLElement>(node: T, tip: string): T => {
  node.dataset.tip = tip;
  return node;
};

type Slider = HTMLElement & { value: string };
const sliderOf = (spec: FieldSpec, bounds: Partial<FieldSpec>, value: number, onInput: () => void): Slider =>
  STANDARD_CONTROLS.slider!({ ...spec, kind: "slider", ...bounds }, value, onInput) as Slider;

// translate(x y) scale(s) for the compass rose: a slider per part, the shifts reach across the map
const transform: ControlFactory = (spec, value, set) => {
  const match = String(value ?? "").match(/translate\((-?[\d.]+) (-?[\d.]+)\) scale\(([\d.]+)\)/);
  const emit = () => set(`translate(${x.value} ${y.value}) scale(${scale.value})`);
  const { width, height } = options.map.graph;
  const x = sliderOf(spec, { min: 0, max: width, step: 1 }, match ? Number(match[1]) : 80, emit);
  const y = sliderOf(spec, { min: 0, max: height, step: 1 }, match ? Number(match[2]) : 80, emit);
  const scale = sliderOf(spec, { min: 0.02, max: 1, step: 0.01 }, match ? Number(match[3]) : 0.25, emit);
  return rows(
    withTip(row("Shift x", x), "Shift the rose along x, in pixels"),
    withTip(row("Shift y", y), "Shift the rose along y, in pixels"),
    withTip(row("Size", scale), "Scale the rose")
  );
};

type LabelStyle = { shadow: string; transform: string; dx: number; dy: number; rest: string[] };

/** The label cssText split into the parts the control edits and the declarations it keeps as they are */
function parseLabelStyle(style: unknown): LabelStyle {
  const parsed: LabelStyle = { shadow: "", transform: "", dx: 0, dy: 0, rest: [] };
  for (const declaration of String(style ?? "").split(";")) {
    const [property, ...valueParts] = declaration.split(":");
    const name = property.trim();
    const v = valueParts.join(":").trim();
    if (!name || !v) continue;
    if (name === "text-shadow") parsed.shadow = v;
    else if (name === "text-transform") parsed.transform = v;
    else if (name === "transform") {
      const shift = v.match(/translate\(\s*(-?[\d.]+)em\s*,\s*(-?[\d.]+)em\s*\)/);
      if (shift) [parsed.dx, parsed.dy] = [Number(shift[1]), Number(shift[2])];
    } else parsed.rest.push(`${name}: ${v}`);
  }
  return parsed;
}

function composeLabelStyle({ shadow, transform, dx, dy, rest }: LabelStyle): string | null {
  const declarations = [
    ...rest,
    shadow && `text-shadow: ${shadow}`,
    transform && `text-transform: ${transform}`,
    (dx || dy) && `transform: translate(${dx}em, ${dy}em)`
  ].filter(Boolean);
  return declarations.length ? declarations.join("; ") : null;
}

// text shadow, letter case and the label shift, kept in one cssText: a row each
const labelStyle: ControlFactory = (spec, value, set) => {
  const parsed = parseLabelStyle(value);
  const shadow = htmlEl("input", { type: "text", value: parsed.shadow, placeholder: "none" });
  const transform = selectOf(
    [
      ["", "As is"],
      ["uppercase", "Uppercase"],
      ["lowercase", "Lowercase"],
      ["capitalize", "Capitalize"]
    ],
    parsed.transform
  );
  const emit = () => {
    const next = composeLabelStyle({
      shadow: shadow.value.trim(),
      transform: transform.value,
      dx: Number(dx.value) || 0,
      dy: Number(dy.value) || 0,
      rest: parsed.rest
    });
    // the schema pins the declarations a label style may carry: a half-typed one never reaches the store
    const valid = next === null || isLabelStyle(next);
    shadow.style.borderColor = valid ? "" : "var(--dark-solid)";
    if (valid) set(next ?? unsetValue(spec));
  };
  const dx = sliderOf(spec, { min: -2, max: 2, step: 0.01 }, parsed.dx, emit);
  const dy = sliderOf(spec, { min: -2, max: 2, step: 0.01 }, parsed.dy, emit);
  shadow.addEventListener("input", emit);
  transform.addEventListener("change", emit);
  return rows(
    withTip(row("Shadow", shadow), "Set text shadow, e.g. white 0 0 4px"),
    withTip(row("Case", transform), "Change the letter case"),
    withTip(row("Shift x", dx), "Shift the labels along x"),
    withTip(row("Shift y", dy), "Shift the labels along y")
  );
};

// a heightmap colour scheme, built-in or a custom gradient
const scheme: ControlFactory = (_spec, value, set) => {
  const current = typeof value === "string" ? value : "bright";
  HeightmapColorSchemes.ensure(current);
  const select = selectOf(
    HeightmapColorSchemes.names().map(name => [name, name.startsWith("#") ? `custom ${name.slice(0, 12)}…` : name]),
    current
  );
  select.addEventListener("change", () => set(select.value));
  const add = sideButton("icon-plus", "Click to add a custom heightmap color scheme");
  add.addEventListener("click", () =>
    openSchemeBuilder(select.value, stops => {
      select.add(new Option(`custom ${stops.slice(0, 12)}…`, stops));
      select.value = stops;
      set(stops);
    })
  );
  return inline(select, add);
};

// a bundled texture or any image URL
const texture: ControlFactory = (_spec, value, set) => {
  const current = typeof value === "string" ? value : "";
  const entries: [string, string][] = Object.entries(TEXTURES);
  if (current && !(current in TEXTURES)) entries.push([current, current.split("/").pop()!.slice(0, 20)]);
  const select = selectOf(entries, current);
  select.addEventListener("change", () => set(select.value));
  const add = sideButton("icon-plus", "Click and provide a URL to image to be set as a texture");
  add.addEventListener("click", () =>
    openTextureUrlDialog(url => {
      select.add(new Option(url.split("/").pop()!.slice(0, 20), url));
      select.value = url;
      set(url);
    })
  );
  return inline(select, add);
};

// a button that opens a picker dialog: the current value drawn, and a caret
const pickButton = (): HTMLButtonElement => htmlEl("button", { type: "button", className: "pick" });

// an icon slot of a style
const icon: ControlFactory = (_spec, value, set) => {
  const button = pickButton();
  let current = typeof value === "string" ? value : "";
  const show = () => {
    const name = Icons.name(current) === Icons.glyphText(current) ? "" : Icons.name(current); // unnamed text is its own name
    button.innerHTML = `${Icons.html(current)}<span>${escapeHtml(name)}</span>`;
  };
  show();

  button.addEventListener("click", () => {
    Controllers.IconPicker.open({
      current,
      live: true,
      onPick: id => {
        current = id;
        show();
        set(id);
      }
    });
    trackControlDialog("iconPicker");
  });
  return button;
};

/** The friendly grid size next to the scale input: `scale × 25 × units.scale unit` */
export function updateGridSizeReadout(): void {
  const output = findEl<HTMLOutputElement>("styleGridSizeFriendly");
  if (!output) return;
  const { scale, unit } = options.map.units.distance;
  output.value = `${rn(styles.grid.options.scale * 25 * scale, 2)} ${unit}`;
}

export const CUSTOM_CONTROLS: Record<Exclude<StyleControl, StandardControl>, ControlFactory> = {
  filter,
  font,
  blur,
  dash,
  transform,
  labelStyle,
  scheme,
  texture,
  icon
};
