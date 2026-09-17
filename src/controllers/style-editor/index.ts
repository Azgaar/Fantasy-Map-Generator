// The Style tab's editor
import "@/components/shared/slider-input";
import { z } from "zod";
import { type LayerId, Layers } from "@/components/layers";
import { openTab } from "@/components/options/options-panel";
import { SchemaForm } from "@/components/shared/schema-form";
import { invokeActiveZooming } from "@/components/zoom";
import { layerLabel } from "@/data/layer-labels";
import { VIGNETTE_PRESETS } from "@/data/vignette-presets";
import { Styles } from "@/generators/styles";
import { styleMeta, stylesSchema } from "@/generators/styles-schema";
import { applyVignetteOptions } from "@/renderers/draw-vignette";
import type { StyleElement, StyleSelection } from "@/types/styles";
import { ensureEl, findEl } from "@/utils";
import { Baseline, storePath, storeValue } from "./baseline";
import { CUSTOM_CONTROLS, destroyControlDialogs, updateGridSizeReadout } from "./controls";
import { FormDecoration } from "./decorate";
import { runEffect } from "./effects";
import { ElementsDialog } from "./elements-dialog";
import { GROUP_SOURCES, type GroupEntry, listElements } from "./groups";
import { PresetSelector } from "./preset-selector";

const ELEMENT_ALIASES: Record<string, StyleElement> = {
  regions: "states",
  terrs: "heightmap",
  cults: "cultures",
  relig: "religions",
  provs: "provinces",
  armies: "military",
  terrain: "relief",
  ruler: "rulers",
  prec: "precipitation",
  gridOverlay: "grid",
  goodsIcons: "goods",
  goodsBurgs: "goods",
  goodsCells: "goods",
  anchors: "burgIcons",
  icons: "burgIcons",
  tradeAnimation: "trade"
};

const elementSelect = () => ensureEl<HTMLSelectElement>("styleElementSelect");
const groupSelect = () => ensureEl<HTMLSelectElement>("styleGroupSelect");

let wired = false;
let glowTimer: number | undefined;
let baseline: Baseline | undefined; // the current preset, once loaded
let baselineName = "";
let decoration: FormDecoration | undefined;
const elementsDialog = new ElementsDialog(
  () => ({ element: elementSelect().value as StyleElement, group: groupSelect().value }),
  open
);
const presetsDialog = new PresetSelector();

function wire(): void {
  if (wired) return;
  wired = true;
  elementSelect().replaceChildren(...listElements().map(({ id, label }) => new Option(label, id)));
  elementSelect().value = "states";
  elementSelect().addEventListener("change", () => open(elementSelect().value as StyleElement));
  groupSelect().addEventListener("change", () => render());
  ensureEl("styleElementTreeButton").addEventListener("click", () => elementsDialog.open());
  ensureEl("stylePresetGalleryButton").addEventListener("click", () => presetsDialog.open());
}

// the marks compare with the current preset; until it is loaded the form renders plain, then gets decorated
function ensureBaseline(): void {
  const name = options.map.style.preset || "default";
  if (name === baselineName) return;
  baselineName = name;
  baseline = undefined;
  void Baseline.load(name).then(loaded => {
    if (baselineName !== name) return;
    baseline = loaded;
    decoration?.setBaseline(baseline);
  });
}

/** Show the editor for an element (and a group); with no arguments, whatever is selected */
function open(element?: string, group?: string): void {
  wire();
  if (element) {
    elementSelect().value = ELEMENT_ALIASES[element] ?? element;
    if (group) groupSelect().replaceChildren(new Option(group, group, true, true));
    else groupSelect().replaceChildren();
  }
  const wasActive = findEl("styleTab")?.classList.contains("active");
  openTab("styleTab"); // opens the editor through selectTab when the tab was not active
  if (wasActive) render();
  if (element) glow(Boolean(group));
}

/** Re-render the current selection from the store, e.g. after a preset change */
function refresh(): void {
  if (!wired || !findEl("styleForm")) return;
  render();
}

/** Empty the form and drop what the controls and the tab opened; called when the tab is left */
function close(): void {
  findEl("styleForm")?.replaceChildren();
  decoration = undefined;
  destroyControlDialogs();
  elementsDialog.close();
  presetsDialog.close();
}

function glow(withGroup: boolean): void {
  elementSelect().classList.add("glow");
  groupSelect().classList.toggle("glow", withGroup);
  window.clearTimeout(glowTimer);
  glowTimer = window.setTimeout(() => {
    elementSelect().classList.remove("glow");
    groupSelect().classList.remove("glow");
  }, 1500);
}

type Resolved = StyleSelection & {
  path: string[];
  schema: z.ZodObject;
  value: object | undefined;
  entries?: GroupEntry[]; // the group list of a grouped element
};

/** The store node, schema and group list a selection addresses; a group that is gone falls back to the first */
function resolve(element: StyleElement, wanted?: string): Resolved {
  const source = element in GROUP_SOURCES ? GROUP_SOURCES[element] : undefined;
  const layer = Layers.has(element) ? (element as LayerId) : undefined;

  if (!source) {
    return {
      element,
      layer,
      path: [element],
      schema: stylesSchema.shape[element] as z.ZodObject,
      value: styles[element]
    };
  }

  const entries = source();
  const group = entries.some(entry => entry.id === wanted) ? wanted! : (entries[0]?.id ?? "");

  if (element === "burgIcons") {
    // one group select serves both records: the burg icon rows flat, the anchors as a subsection
    const burgGroup = stylesSchema.shape.burgIcons.shape.burgIcons.shape.groups.valueType;
    const anchorGroup = stylesSchema.shape.burgIcons.shape.anchors.shape.groups.valueType;
    const schema = z.strictObject({
      ...burgGroup.shape,
      anchors: anchorGroup.register(styleMeta, { label: "Anchors" })
    });
    const icons = styles.burgIcons.burgIcons.groups[group];
    const value = icons ? { ...icons, anchors: styles.burgIcons.anchors.groups[group] } : undefined;
    return { element, group, layer, path: ["burgIcons", "burgIcons", "groups", group], schema, value, entries };
  }

  const record = (stylesSchema.shape[element] as z.ZodObject).shape.groups as z.ZodRecord;
  const schema = record.valueType as z.ZodObject;
  const value = (styles[element] as { groups: Record<string, object> }).groups[group];
  return { element, group, layer, path: [element, "groups", group], schema, value, entries };
}

// the group list comes first: it settles which store node the form reads
function selection(): Resolved {
  const sel = resolve(elementSelect().value as StyleElement, groupSelect().value);
  const select = groupSelect();
  const row = select.closest<HTMLElement>(".group-row") ?? select;
  row.style.display = sel.entries ? "" : "none";
  select.replaceChildren(...(sel.entries ?? []).map(({ id, label }) => new Option(label, id)));
  if (sel.group) select.value = sel.group;
  return sel;
}

/** Set one value on the store and run its effect; `relative` is a path below the selection's node */
function change(sel: Resolved, relative: string[], value: unknown): void {
  const path = storePath(sel, relative);
  const node = storeValue(sel, relative.slice(0, -1)) as Record<string, unknown> | undefined;
  const key = path.at(-1)!;
  if (!node) return;
  const previous = node[key];
  if (value === undefined) delete node[key];
  else node[key] = value;
  runEffect({ sel, path, value, previous });
  if (sel.element === "grid") updateGridSizeReadout();
}

/** Render the selection's form into a container; the standard container is #styleForm */
function renderForm(form: HTMLElement, sel: Resolved): void {
  form.replaceChildren();
  decoration = undefined;
  destroyControlDialogs();
  if (!sel.value) return;

  if (sel.layer && !Layers.isOn(sel.layer)) form.append(banner(sel.layer, () => renderForm(form, sel)));

  const onChange = (relative: string[], value: unknown): void => change(sel, relative, value);
  const rootTitle = sel.group ? `${layerLabel(sel.element)}: ${sel.group}` : layerLabel(sel.element);
  form.append(
    SchemaForm.render(sel.schema, sel.value, { meta: styleMeta, controls: CUSTOM_CONTROLS, rootTitle, onChange })
  );
  decorate(form, sel);

  decoration = new FormDecoration(form, sel, baseline, (relative, value) => {
    change(sel, relative, value);
    renderForm(form, sel);
  });
}

function render(): void {
  ensureBaseline();
  renderForm(ensureEl("styleForm"), selection());
  elementsDialog.refresh();
  presetsDialog.refresh();
}

function banner(layer: LayerId, rerender: () => void): HTMLElement {
  const banner = document.createElement("div");
  banner.className = "banner";
  banner.append(`${layerLabel(layer)} layer is hidden. `);
  const link = document.createElement("a");
  link.textContent = "Turn on";
  link.addEventListener("click", () => {
    Layers.show(layer);
    rerender();
  });
  banner.append(link);
  return banner;
}

// the rows that are not fields: readouts, preset pickers and the one app option users look for here
function decorate(form: HTMLElement, sel: Resolved): void {
  if (sel.element === "grid") {
    const row = extraRow("Cell size", "Distance between grid cell centers (in map scale)");
    const output = document.createElement("output");
    output.id = "styleGridSizeFriendly";
    const link = document.createElement("a");
    link.href = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Scale-and-distance#grids";
    link.target = "_blank";
    link.innerHTML =
      '<span data-tip="Open wiki article scale and distance to know about grid scale" class="icon-info-circled pointer"></span>';
    row.querySelector(".ctl")!.append(output, link);
    form.querySelector('[data-field="options.scale"]')?.after(row);
    updateGridSizeReadout();
  }

  if (sel.element === "vignette") {
    const row = extraRow("Preset", "Select a precreated vignette");
    row.dataset.field = "preset";
    const select = document.createElement("select");
    select.append(new Option("Select a preset…", ""), ...Object.keys(VIGNETTE_PRESETS).map(name => new Option(name)));
    select.addEventListener("change", () => {
      const preset = VIGNETTE_PRESETS[select.value];
      if (!preset) return;
      Object.assign(styles.vignette.attrs, preset.attrs);
      Object.assign(styles.vignette.options, preset.options);
      Styles.write("vignette");
      applyVignetteOptions();
      renderForm(form, sel);
    });
    row.querySelector(".ctl")!.append(select);
    rootBody(form).prepend(row);
  }

  if (sel.element === "markers") {
    const row = extraRow(
      "Constant size",
      "Keep the same size on any map scale, turn off to scale markers with the map"
    );
    row.dataset.field = "resizeOnZoom";
    row.querySelector(".ctl")!.append(
      appCheckbox("markersResizeOnZoom", options.map.markers.resizeOnZoom, checked => {
        Options.set(options => {
          options.map.markers.resizeOnZoom = checked;
        });
        invokeActiveZooming();
      })
    );
    rootBody(form).append(row);
  }

  if (sel.element === "emblems") {
    const row = extraRow(
      "Show all",
      "Show emblem groups even if their size is too small or too big at the current scale"
    );
    row.dataset.field = "showAll";
    row.querySelector(".ctl")!.append(
      appCheckbox("showAllEmblems", options.app.emblems.showAll, checked => {
        Options.set(options => {
          options.app.emblems.showAll = checked;
        });
        invokeActiveZooming();
      })
    );
    rootBody(form).append(row);
  }
}

// the styled checkbox with its label, for the app options that sit among the style rows
function appCheckbox(id: string, checked: boolean, onInput: (checked: boolean) => void): DocumentFragment {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "checkbox";
  checkbox.id = id;
  checkbox.checked = checked;
  const label = document.createElement("label");
  label.className = "checkbox-label";
  label.htmlFor = id;
  checkbox.addEventListener("input", () => onInput(checkbox.checked));
  const fragment = document.createDocumentFragment();
  fragment.append(checkbox, label);
  return fragment;
}

// the extra rows sit with the element's own rows, in the card SchemaForm titled by the selection
const rootBody = (form: HTMLElement): Element =>
  form.querySelector('.schema-form > details[data-section=""] > .body') ?? form.querySelector(".schema-form")!;

function extraRow(label: string, tip: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "row";
  row.dataset.tip = tip;
  row.innerHTML = /* html */ `<label>${label}</label><div class="ctl"></div>`;
  return row;
}

export const StyleEditor = { open, refresh, close };
