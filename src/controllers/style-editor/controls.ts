// The controls the style editor adds to SchemaForm: each owns its option source and any dialog it opens,
// and the composed ones call `set` with the whole string the schema format expects
import { interpolateRgb, interpolateRgbBasis, scaleSequential } from "d3";
import { destroyDialog } from "@/components/dialog/dialog-helpers";
import { type ControlFactory, type ControlKind, STANDARD_CONTROLS, unsetValue } from "@/components/shared/schema-form";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import { TEXTURES } from "@/data/textures";
import { VIGNETTE_PRESETS } from "@/data/vignette-presets";
import { drawHeights } from "@/renderers/draw-heightmap";
import { HeightmapColorSchemes } from "@/renderers/heightmap-color-schemes";
import { addGoogleFont, addLocalFont, addWebFont } from "@/services/fonts";
import { ensureEl, findEl, rn, toHEX } from "@/utils";

const OPEN_DIALOGS = ["addFontDialog", "textureUrlDialog", "heightmapSchemeDialog"];

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

const number = (value: number, props: Props<"input"> = {}): HTMLInputElement =>
  el("input", { type: "number", value: String(value), style: "width: 4.5em", ...props });

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

// the loaded font families, plus the dialog that adds one
const font: ControlFactory = (_spec, value, set) => {
  const wrapper = el("span", { style: "display: contents" });
  const select = el("select");
  const fill = (selected: string) => {
    select.replaceChildren(...fonts.map(({ family }) => new Option(family, family)));
    for (const option of select.options) option.style.fontFamily = option.value;
    if (selected && !fonts.some(font => font.family === selected)) select.add(new Option(selected, selected));
    select.value = selected;
  };
  fill(typeof value === "string" ? value : "");
  select.addEventListener("change", () => set(select.value));
  const add = sideButton("icon-plus", "Add a font");
  add.addEventListener("click", () =>
    openAddFontDialog(family => {
      fill(family);
      set(family);
    })
  );
  wrapper.append(select, add);
  return wrapper;
};

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

  $(dialog).dialog({
    title: "Add custom font",
    width: "26em",
    position: { my: "center", at: "center", of: "svg" },
    close: () => destroyDialog("addFontDialog"),
    buttons: {
      Add: async function (this: HTMLElement) {
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
        $(this).dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

const parseUnit = (value: unknown): { size: number; unit: string } => {
  const match = String(value ?? "").match(/^(\d*\.?\d+)(%|px)?$/);
  return { size: match ? Number(match[1]) : 0, unit: match?.[2] ?? "" };
};

// a font size: number and unit, with the classic +/- nudge
const unit: ControlFactory = (_spec, value, set) => {
  const wrapper = el("span", { style: "display: contents" });
  const current = parseUnit(value);
  const input = number(current.size, { min: "0.1", step: "0.1" });
  const units: [string, string][] = [
    ["%", "%"],
    ["px", "px"]
  ];
  if (!current.unit) units.unshift(["", "—"]);
  const unitSelect = selectOf(units, current.unit);
  unitSelect.style.width = "4em";
  const emit = () => {
    const size = Number(input.value);
    if (!Number.isFinite(size) || size <= 0) return;
    set(`${size}${unitSelect.value}`);
  };
  const nudge = (delta: number) => {
    input.value = String(Math.min(999, Math.max(0.1, rn(Number(input.value) + delta, 1))));
    emit();
  };
  const plus = el("button", { className: "whiteButton", textContent: "+" });
  plus.dataset.tip = "Increase font";
  const minus = el("button", { className: "whiteButton", textContent: "-" });
  minus.dataset.tip = "Decrease font";
  plus.addEventListener("click", () => nudge(0.1));
  minus.addEventListener("click", () => nudge(-0.1));
  input.addEventListener("input", emit);
  unitSelect.addEventListener("change", emit);
  wrapper.append(plus, minus, input, unitSelect);
  return wrapper;
};

const parseBlur = (value: unknown): number =>
  Number.parseFloat(String(value ?? "").match(/blur\(([^)]+)\)/)?.[1] ?? "") || 0;

// blur(Npx), null at 0
const blur: ControlFactory = (spec, value, set) => {
  const wrapper = el("span", { style: "display: contents" });
  const slider = STANDARD_CONTROLS.slider!({ ...spec, step: spec.step ?? 0.1, nullAs: 0 }, parseBlur(value), next => {
    const px = Number(next);
    set(px > 0 ? `blur(${px}px)` : unsetValue(spec));
  });
  wrapper.append(slider, el("span", { textContent: "px" }));
  return wrapper;
};

// translate(x y) scale(s) for the compass rose
const transform: ControlFactory = (spec, value, set) => {
  const wrapper = el("span", { style: "display: flex; flex-wrap: wrap; align-items: center; gap: .3em; width: 100%" });
  const match = String(value ?? "").match(/translate\((-?[\d.]+) (-?[\d.]+)\) scale\(([\d.]+)\)/);
  const x = number(match ? Number(match[1]) : 80);
  x.dataset.tip = "Shift by x axis in pixels";
  const y = number(match ? Number(match[2]) : 80);
  y.dataset.tip = "Shift by y axis in pixels";
  const scale = STANDARD_CONTROLS.slider!(
    { ...spec, kind: "slider", min: 0.02, max: 1, step: 0.01, label: "Size" },
    match ? Number(match[3]) : 0.25,
    () => emit()
  );
  scale.style.flex = "1 1 100%";
  const emit = () =>
    set(`translate(${x.value || 0} ${y.value || 0}) scale(${(scale as HTMLElement & { value: string }).value})`);
  x.addEventListener("input", emit);
  y.addEventListener("input", emit);
  wrapper.append(el("span", { textContent: "x" }), x, el("span", { textContent: "y" }), y, scale);
  return wrapper;
};

type LabelStyle = { shadow: string; transform: string; dx: number; dy: number; rest: string[] };

/** The label cssText split into the parts the control edits and the declarations it keeps as they are */
export function parseLabelStyle(style: unknown): LabelStyle {
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

export function composeLabelStyle({ shadow, transform, dx, dy, rest }: LabelStyle): string | null {
  const declarations = [
    ...rest,
    shadow && `text-shadow: ${shadow}`,
    transform && `text-transform: ${transform}`,
    (dx || dy) && `transform: translate(${dx}em, ${dy}em)`
  ].filter(Boolean);
  return declarations.length ? declarations.join("; ") : null;
}

// text shadow, letter case and the label shift, kept in one cssText
const labelStyle: ControlFactory = (spec, value, set) => {
  const wrapper = el("span", { style: "display: flex; flex-wrap: wrap; align-items: center; gap: .3em; width: 100%" });
  const parsed = parseLabelStyle(value);
  const shadow = el("input", {
    type: "text",
    value: parsed.shadow,
    placeholder: "text shadow",
    style: "flex: 1 1 100%"
  });
  shadow.dataset.tip = "Set text shadow, e.g. white 0 0 4px";
  const transform = selectOf(
    [
      ["", "No text transform"],
      ["uppercase", "Uppercase"],
      ["lowercase", "Lowercase"],
      ["capitalize", "Capitalize"]
    ],
    parsed.transform
  );
  transform.style.flex = "1 1 100%";
  transform.dataset.tip = "Change the letter case of the labels as displayed";
  const dx = number(parsed.dx, { min: "-5", max: "5", step: "0.01" });
  dx.dataset.tip = "Set label shift along X axis, in em";
  const dy = number(parsed.dy, { min: "-5", max: "5", step: "0.01" });
  dy.dataset.tip = "Set label shift along Y axis, in em";
  const emit = () => {
    const next = composeLabelStyle({
      shadow: shadow.value.trim(),
      transform: transform.value,
      dx: Number(dx.value) || 0,
      dy: Number(dy.value) || 0,
      rest: parsed.rest
    });
    set(next ?? unsetValue(spec));
  };
  shadow.addEventListener("input", emit);
  transform.addEventListener("change", emit);
  dx.addEventListener("input", emit);
  dy.addEventListener("input", emit);
  wrapper.append(shadow, transform, el("span", { textContent: "shift x" }), dx, el("span", { textContent: "y" }), dy);
  return wrapper;
};

// "5%"
const percent: ControlFactory = (_spec, value, set) => {
  const wrapper = el("span", { style: "display: contents" });
  const input = number(Number.parseFloat(String(value ?? "")) || 0, { step: "0.1" });
  input.addEventListener("input", () => {
    if (input.value !== "" && Number.isFinite(Number(input.value))) set(`${Number(input.value)}%`);
  });
  wrapper.append(input, el("span", { textContent: "%" }));
  return wrapper;
};

// a heightmap colour scheme, built-in or a custom gradient
const scheme: ControlFactory = (_spec, value, set) => {
  const wrapper = el("span", { style: "display: contents" });
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
  wrapper.append(select, add);
  return wrapper;
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
      heights: grid.cells.h as unknown as number[],
      width: grid.cellsX,
      height: grid.cellsY,
      scheme: scaleSequential(interpolateRgbBasis(stops)),
      renderOcean: false
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
    width: "28em",
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
  const wrapper = el("span", { style: "display: contents" });
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
  wrapper.append(select, add);
  return wrapper;
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

// <burg-icon-picker>, previewed in the group's fill and stroke as they are edited
const icon: ControlFactory = (spec, value, set) => {
  const picker = document.createElement("burg-icon-picker") as HTMLElement & { value: string };
  if (spec.path.includes("anchors")) picker.setAttribute("anchors", "");
  picker.value = typeof value === "string" ? value : "";
  picker.addEventListener("change", () => set(picker.value));

  // the fill and stroke rows of the same group are siblings rendered after this control
  queueMicrotask(() => {
    const form = picker.closest(".schema-form");
    const prefix = spec.path.slice(0, -2);
    const outputs = ["fill", "stroke"].map(attr => ({
      attr,
      output: form?.querySelector<HTMLOutputElement>(`[data-field="${[...prefix, "attrs", attr].join(".")}"] output`)
    }));
    const paint = () => {
      for (const { attr, output } of outputs) picker.style.setProperty(attr, output?.value || "none");
    };
    paint();
    const observer = new MutationObserver(paint);
    for (const { output } of outputs)
      if (output) observer.observe(output, { childList: true, characterData: true, subtree: true });
  });
  return picker;
};

// the market marker emoji, through the Icon Selector
const emoji: ControlFactory = (_spec, value, set) => {
  const button = el("button", {
    type: "button",
    textContent: String(value ?? ""),
    style: "background: none; padding: 0"
  });
  button.addEventListener("click", () => {
    void Controllers.IconSelector.open(button.textContent ?? "", next => {
      button.textContent = next;
      set(next);
    });
  });
  return button;
};

// not a field: assigns a ready-made look into the vignette and asks the editor to re-render
const vignettePreset: ControlFactory = (_spec, _value, set) => {
  const select = selectOf(
    [["", "Select a preset…"], ...Object.keys(VIGNETTE_PRESETS).map(name => [name, name] as [string, string])],
    ""
  );
  select.addEventListener("change", () => select.value && set(select.value));
  return select;
};

// the four global filters as radio buttons
const mapFilter: ControlFactory = (spec, value, set) => {
  const wrapper = el("span", { id: "mapFilters", style: "display: flex; gap: .3em; flex-wrap: wrap" });
  for (const option of spec.options ?? []) {
    const id = String(option);
    const button = el("button", {
      id,
      className: "radio",
      textContent: spec.choices?.[id] ?? id,
      style: "flex: 1 1 auto; padding: 4px 0"
    });
    button.classList.toggle("pressed", value === id);
    button.addEventListener("click", () => {
      const pressed = button.classList.contains("pressed");
      for (const b of wrapper.querySelectorAll(".pressed")) b.classList.remove("pressed");
      if (pressed) return set(unsetValue(spec));
      button.classList.add("pressed");
      set(id);
    });
    wrapper.append(button);
  }
  return wrapper;
};

/** The friendly grid size next to the scale input: `scale × 25 × units.scale unit` */
export function updateGridSizeReadout(): void {
  const output = findEl<HTMLOutputElement>("styleGridSizeFriendly");
  if (!output) return;
  const { scale, unit } = options.map.units.distance;
  output.value = `${rn(styles.grid.options.scale * 25 * scale, 2)} ${unit}`;
}

export const CUSTOM_CONTROLS: Partial<Record<ControlKind, ControlFactory>> = {
  filter,
  font,
  unit,
  blur,
  transform,
  labelStyle,
  percent,
  scheme,
  texture,
  icon,
  emoji,
  vignettePreset,
  mapFilter
};
