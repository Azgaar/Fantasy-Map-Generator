// The controls the style editor adds to SchemaForm: each owns its option source and any dialog it opens,
// and the composed ones call `set` with the whole string the schema format expects
import { interpolateRgb, interpolateRgbBasis, scaleSequential } from "d3";
import { destroyDialog } from "@/components/dialog/dialog-helpers";
import { IconSets } from "@/components/icon-sets";
import {
  type ControlFactory,
  type FieldSpec,
  inline,
  row,
  rows,
  STANDARD_CONTROLS,
  unsetValue
} from "@/components/shared/schema-form";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import { TEXTURES } from "@/data/textures";
import { FORMATS, isLabelStyle } from "@/generators/styles-formats";
import { drawHeights } from "@/renderers/draw-heightmap";
import { HeightmapColorSchemes } from "@/renderers/heightmap-color-schemes";
import { getLabelsIndex } from "@/renderers/labels/label-data";
import { addGoogleFont, addLocalFont, addWebFont } from "@/services/fonts";
import type { StandardControl, StyleControl } from "@/types/styles";
import { ensureEl, findEl, rn, toHEX } from "@/utils";
import { BURG_ICON_DIALOG, FONT_DIALOG, openBurgIconDialog, openFontDialog, paintBurgIconDialog } from "./dialogs";
import { burgIconPreview } from "./icon-preview";

const OPEN_DIALOGS = ["addFontDialog", "textureUrlDialog", "heightmapSchemeDialog", BURG_ICON_DIALOG, FONT_DIALOG];

/** Dialogs a control may have left open; the editor calls it on close */
export function destroyControlDialogs(): void {
  for (const id of OPEN_DIALOGS) destroyDialog(id);
}

type Props<K extends keyof HTMLElementTagNameMap> = Partial<Omit<HTMLElementTagNameMap[K], "style">> & {
  style?: string;
};
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Props<K> = {}): HTMLElementTagNameMap[K] => {
  const { style, ...rest } = props;
  const node = Object.assign(document.createElement(tag), rest);
  if (style) node.style.cssText = style;
  return node;
};
const selectOf = (entries: [string, string][], value: string): HTMLSelectElement => {
  const select = el("select");
  for (const [v, label] of entries) select.add(new Option(label, v));
  select.value = value;
  return select;
};
const sideButton = (icon: string, tipText: string): HTMLButtonElement => {
  const button = el("button", { className: `${icon} sideButton`, style: "flex: none; margin-block: 0" });
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

function openAddFontDialog(onAdded: (family: string) => void): void {
  destroyDialog("addFontDialog");
  const dialog = el("div", { id: "addFontDialog", className: "dialog", style: "display: none" });
  dialog.innerHTML = /* html */ `
    <span>There are 3 ways to add a custom font:</span>
    <p>
      <strong>Google font</strong>. Open <a href="https://fonts.google.com/" target="_blank">Google Fonts</a>, find
      a font you like and enter its name to the field below.
    </p>
    <p>
      <strong>Local font</strong>. If you have a font
      <a href="https://faqs.skillcrush.com/article/275-downloading-installing-a-font-on-your-computer" target="_blank">installed on your computer</a>,
      just provide the font name. Make sure the browser is reloaded after the installation. The font won't work
      on machines not having it installed. Good source of fonts are
      <a href="https://fontesk.com" target="_blank">Fontdesk</a> and <a href="https://www.dafont.com" target="_blank">DaFont</a>.
    </p>
    <p>
      <strong>Font URL</strong>. Provide font name and link to the font file hosted online. The best free font
      hostings are <a href="https://fonts.google.com/" target="_blank">Google Fonts</a> and
      <a target="_blank" href="https://www.cdnfonts.com">CDN Fonts</a>. To get font file open the link to css
      provided by these services and manually copy the link to <code>woff2</code> of desired variant. To add another
      variant (e.g. Cyrillic), add the font one more time under the same name, but with another URL
    </p>
    <div style="margin-top: 0.3em" data-tip="Select font adding method">
      <select id="addFontMethod">
        <option value="googleFont" selected>Google font</option>
        <option value="localFont">Local font</option>
        <option value="fontURL">Font URL</option>
      </select>
      <input id="addFontNameInput" placeholder="font family" style="width: 15em" />
      <div><input id="addFontURLInput" placeholder="font file URL" style="width: 22.6em; margin-top: 0.1em; display: none" /></div>
    </div>`;
  ensureEl("dialogs").append(dialog);

  const method = ensureEl<HTMLSelectElement>("addFontMethod");
  const nameInput = ensureEl<HTMLInputElement>("addFontNameInput");
  const urlInput = ensureEl<HTMLInputElement>("addFontURLInput");
  method.addEventListener("change", () => {
    urlInput.style.display = method.value === "fontURL" ? "inline" : "none";
  });

  const add = async () => {
    const family = nameInput.value.trim();
    const src = urlInput.value.trim();
    if (!family) return tip("Please provide a font name", false, "error");
    const exists =
      method.value === "fontURL"
        ? fonts.some(font => font.family === family && font.src === `url('${src}')`)
        : fonts.some(font => font.family === family);
    if (exists) return tip("The font is already added", false, "error");

    const added =
      method.value === "fontURL"
        ? addWebFont(family, src)
        : method.value === "googleFont"
          ? await addGoogleFont(family)
          : addLocalFont(family);
    if (added) onAdded(added);
    $(dialog).dialog("close");
  };

  $(dialog).dialog({
    title: "Add custom font",
    width: "26em",
    position: { my: "center", at: "center", of: "svg" },
    close: () => destroyDialog("addFontDialog"),
    buttons: {
      // jQuery 3.1 takes an async function for a props object, so the button handler stays sync
      Add: () => void add(),
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
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
  const input = el("input", {
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
  const shadow = el("input", { type: "text", value: parsed.shadow, placeholder: "none" });
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

function openSchemeBuilder(current: string, onCreate: (stops: string) => void): void {
  destroyDialog("heightmapSchemeDialog");
  const dialog = el("div", { id: "heightmapSchemeDialog", className: "dialog", style: "display: none" });
  dialog.innerHTML = /* html */ `<div>
    <i>Define heightmap gradient colors from high to low altitude</i>
    <img id="heightmapSchemePreview" alt="heightmap preview" style="margin-top: 0.5em; width: 100%;" />
    <div id="heightmapSchemeStops" style="margin-block: 0.5em; display: flex; flex-wrap: wrap;"></div>
    <div id="heightmapSchemeGradient" style="height: 1.9em; border: 1px solid #767676;"></div>
  </div>`;
  ensureEl("dialogs").append(dialog);

  const stops = current.startsWith("#")
    ? current.split(",")
    : [0, 0.25, 0.5, 0.75, 1].map(HeightmapColorSchemes.get(current)).map(toHEX);

  const renderPreview = () => {
    ensureEl<HTMLImageElement>("heightmapSchemePreview").src = drawHeights({
      heights: grid.cells.h,
      width: grid.cellsX,
      height: grid.cellsY,
      scheme: scaleSequential(interpolateRgbBasis(stops)),
      renderOcean: styles.heightmap.groups.oceanHeights.options.render
    });
  };
  const renderGradient = () => {
    ensureEl("heightmapSchemeGradient").style.background = `linear-gradient(to right, ${stops.join(",")})`;
  };
  const renderStops = () => {
    const container = ensureEl("heightmapSchemeStops");
    container.replaceChildren();
    stops.forEach((stop, index) => {
      if (index) {
        const add = el("button", {
          className: "add",
          textContent: "+",
          style: "margin-top: 0.3em; height: max-content"
        });
        add.dataset.tip = "Add color stop in between";
        add.addEventListener("click", () => {
          stops.splice(index, 0, toHEX(interpolateRgb(stops[index - 1], stops[index])(0.5)));
          renderAll();
        });
        container.append(add);
      }
      const input = el("input", { type: "color", className: "stop", value: stop, style: "width: 2.5em; border: none" });
      input.dataset.tip = "Click to set the color";
      input.addEventListener("input", () => {
        stops[index] = input.value;
        renderPreview();
        renderGradient();
      });
      container.append(input);
      if (index && index < stops.length - 1) {
        const remove = el("button", {
          className: "remove",
          textContent: "x",
          style: "margin-top: 0.3em; height: max-content"
        });
        remove.dataset.tip = "Remove color stop";
        remove.addEventListener("click", () => {
          stops.splice(index, 1);
          renderAll();
        });
        container.append(remove);
      }
    });
  };
  const renderAll = () => {
    renderPreview();
    renderStops();
    renderGradient();
  };
  renderAll();

  $(dialog).dialog({
    resizable: false,
    title: "Create heightmap color scheme",
    position: { my: "center top+150", at: "center top", of: "svg" },
    close: () => destroyDialog("heightmapSchemeDialog"),
    buttons: {
      Create: function (this: HTMLElement) {
        const name = stops.join(",");
        if (HeightmapColorSchemes.has(name)) return tip("This scheme already exists", false, "error");
        HeightmapColorSchemes.add(name);
        onCreate(name);
        $(this).dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

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

function openTextureUrlDialog(onApply: (url: string) => void): void {
  destroyDialog("textureUrlDialog");
  const dialog = el("div", { id: "textureUrlDialog", className: "dialog", style: "display: none" });
  dialog.innerHTML = /* html */ `Provide a texture image URL:
    <input id="textureURL" type="url" style="width: 100%" placeholder="http://www.example.com/image.jpg" />
    <canvas id="texturePreview" width="256px" height="144px"></canvas>`;
  ensureEl("dialogs").append(dialog);
  const input = ensureEl<HTMLInputElement>("textureURL");
  input.addEventListener("input", () => {
    const image = new Image();
    image.onload = () => {
      const canvas = ensureEl<HTMLCanvasElement>("texturePreview");
      const context = canvas.getContext("2d")!;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = input.value;
  });

  $(dialog).dialog({
    resizable: false,
    title: "Load custom texture",
    width: "28em",
    close: () => destroyDialog("textureUrlDialog"),
    buttons: {
      Apply: function (this: HTMLElement) {
        if (!input.value) return tip("Please provide a valid URL", false, "error");
        onApply(input.value);
        $(this).dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

// a button that opens a picker dialog: the current value drawn, and a caret
const pickButton = (): HTMLButtonElement => el("button", { type: "button", className: "pick" });

// the group's icon, drawn in its fill and stroke as they are edited; the sets open in a dialog
const icon: ControlFactory = (spec, value, set) => {
  const anchors = spec.path.includes("anchors");
  const button = pickButton();
  let current = typeof value === "string" ? value : "";
  const show = () => {
    button.innerHTML = `${burgIconPreview(current)}<span>${IconSets.name(current)}</span>`;
  };
  show();
  void IconSets.load(anchors ? "ports" : "burgs").then(show); // the preview frames itself from the loaded symbol

  // the fill and stroke rows of the same group are siblings rendered before this control
  const paint = { fill: "none", stroke: "none" };
  const applyPaint = () => {
    button.style.fill = paint.fill;
    button.style.stroke = paint.stroke;
    paintBurgIconDialog(paint.fill, paint.stroke);
  };
  queueMicrotask(() => {
    const form = button.closest(".schema-form");
    const prefix = spec.path.slice(0, -2);
    for (const attr of ["fill", "stroke"] as const) {
      const hex = form?.querySelector<HTMLInputElement>(
        `[data-field="${[...prefix, "attrs", attr].join(".")}"] input.hex`
      );
      const read = () => {
        paint[attr] = hex?.value || "none";
        applyPaint();
      };
      read();
      hex?.addEventListener("input", read);
      hex?.addEventListener("change", read);
    }
  });

  button.addEventListener("click", () =>
    openBurgIconDialog({
      anchors,
      selected: current,
      ...paint,
      onPick: id => {
        current = id;
        show();
        set(id);
      }
    })
  );
  return button;
};

// the market marker emoji, through the Icon Selector
const emoji: ControlFactory = (_spec, value, set) => {
  const button = pickButton();
  const symbol = el("span", { className: "emoji", textContent: String(value ?? "") });
  button.append(symbol, el("span", { textContent: "change" }));
  button.addEventListener("click", () => {
    void Controllers.IconSelector.open(symbol.textContent ?? "", next => {
      symbol.textContent = next;
      set(next);
    });
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
  icon,
  emoji
};
