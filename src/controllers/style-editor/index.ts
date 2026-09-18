// The Style tab's editor
import "@/components/shared/slider-input";
import type { z } from "zod";
import { type LayerId, Layers } from "@/components/layers";
import { openTab } from "@/components/options/options-panel";
import { SchemaForm } from "@/components/shared/schema-form";
import { invokeActiveZooming } from "@/components/zoom";
import { layerLabel } from "@/data/layer-labels";
import { VIGNETTE_PRESETS } from "@/data/vignette-presets";
import { Styles } from "@/generators/styles";
import { styleMeta, stylesSchema } from "@/generators/styles-schema";
import { applyVignetteOptions } from "@/renderers/draw-vignette";
import type { PathSelection, StyleElement, StyleSelection } from "@/types/styles";
import { ensureEl, findEl } from "@/utils";
import { Baseline, storePath, storeValue } from "./baseline";
import { CUSTOM_CONTROLS, destroyControlDialogs, updateGridSizeReadout } from "./controls";
import {
  ElementsDialog,
  elementFor,
  type GroupEntry,
  groupEntriesFor,
  hasGroups,
  listElements,
  PresetSelector
} from "./dialogs";
import { runEffect } from "./effects";

class StyleEditorController {
  private wired = false;
  private glowTimer?: number;
  private baselineName = "";
  private current?: Resolved;
  private decoration?: FormDecoration;
  private readonly elementsDialog: ElementsDialog;
  private readonly presetsDialog = new PresetSelector();

  constructor() {
    this.elementsDialog = new ElementsDialog(
      () => ({ element: this.elementSelect.value as StyleElement, group: this.groupSelect.value }),
      (element, group) => this.open(element, group)
    );
  }

  private get elementSelect(): HTMLSelectElement {
    return ensureEl("styleElementSelect");
  }

  private get groupSelect(): HTMLSelectElement {
    return ensureEl("styleGroupSelect");
  }

  /** Show the editor for an element (and a group); with no arguments, whatever is selected */
  open(element?: string, group?: string): void {
    this.wire();
    if (element) {
      this.elementSelect.value = elementFor(element);
      if (group) this.groupSelect.replaceChildren(new Option(group, group, true, true));
      else this.groupSelect.replaceChildren();
    }
    const wasActive = findEl("styleTab")?.classList.contains("active");
    openTab("styleTab"); // opens the editor through selectTab when the tab was not active
    if (wasActive) this.render();
    if (element) this.glow(Boolean(group));
  }

  /** Re-render the current selection from the store, e.g. after a preset change */
  refresh(): void {
    if (!this.wired || !findEl("styleForm")) return;
    this.render();
  }

  /** Empty the form and drop what the controls and the tab opened; called when the tab is left */
  close(): void {
    findEl("styleForm")?.replaceChildren();
    this.decoration?.detach();
    this.current = undefined;
    destroyControlDialogs();
    this.elementsDialog.close();
    this.presetsDialog.close();
  }

  private wire(): void {
    if (this.wired) return;
    this.wired = true;
    this.elementSelect.replaceChildren(...listElements().map(({ id, label }) => new Option(label, id)));
    this.elementSelect.value = "states";
    this.elementSelect.addEventListener("change", () => this.open(this.elementSelect.value as StyleElement));
    this.groupSelect.addEventListener("change", () => this.render());
    ensureEl("styleElementTreeButton").addEventListener("click", () => this.elementsDialog.open());
    ensureEl("stylePresetGalleryButton").addEventListener("click", () => this.presetsDialog.open());
  }

  // the marks compare with the current preset; until it is loaded the form renders plain, then gets decorated
  private ensureBaseline(): void {
    const name = options.map.style.preset || "default";
    if (name === this.baselineName) return;
    this.baselineName = name;
    this.decoration?.setBaseline(undefined);
    void Baseline.load(name).then(loaded => {
      if (this.baselineName !== name) return;
      this.decoration?.setBaseline(loaded);
    });
  }

  private render(): void {
    this.ensureBaseline();
    this.renderForm(this.selection());
    this.elementsDialog.refresh();
    this.presetsDialog.refresh();
  }

  // the group list comes first: it settles which store node the form reads
  private selection(): Resolved {
    const sel = this.resolve(this.elementSelect.value as StyleElement, this.groupSelect.value);
    const select = this.groupSelect;
    const row = select.closest<HTMLElement>(".group-row") ?? select;
    row.style.display = sel.entries ? "" : "none";
    select.replaceChildren(
      ...(sel.entries ?? []).map(
        entry => new Option(entry.count ? `${entry.label} (${entry.count})` : entry.label, entry.id)
      )
    );
    if (sel.group) select.value = sel.group;
    return sel;
  }

  /** The store node, schema and group list a selection addresses; a group that is gone falls back to the first */
  private resolve(element: StyleElement, wanted?: string): Resolved {
    const layer = Layers.has(element) ? (element as LayerId) : undefined;

    if (!hasGroups(element)) {
      return {
        element,
        layer,
        path: [element],
        schema: stylesSchema.shape[element] as z.ZodObject,
        value: styles[element]
      };
    }

    const entries = groupEntriesFor(element);
    const group = entries.some(entry => entry.id === wanted) ? wanted! : (entries[0]?.id ?? "");
    const record = (stylesSchema.shape[element] as z.ZodObject).shape.groups as z.ZodRecord;
    const schema = record.valueType as z.ZodObject;
    const value = (styles[element] as { groups: Record<string, object> }).groups[group];
    return { element, group, layer, path: [element, "groups", group], schema, value, entries };
  }

  private renderForm(sel: Resolved): void {
    this.current = sel;
    const form = ensureEl("styleForm");
    this.decoration?.detach(); // the rows below are about to be replaced
    form.replaceChildren();
    destroyControlDialogs();
    if (!sel.value) return;

    if (sel.layer && !Layers.isOn(sel.layer)) form.append(this.banner(sel.layer));

    const rootTitle = sel.group ? `${layerLabel(sel.element)}: ${sel.group}` : layerLabel(sel.element);
    form.append(
      SchemaForm.render(sel.schema, sel.value, {
        meta: styleMeta,
        controls: CUSTOM_CONTROLS,
        rootTitle,
        onChange: (relative, value) => this.change(relative, value)
      })
    );
    this.addExtraRows(form, sel);

    // one decoration per editor: the form element outlives every render, so its listeners must not stack
    this.decoration ??= new FormDecoration(form, (relative, value) => {
      this.change(relative, value);
      if (this.current) this.renderForm(this.current);
    });
    this.decoration.attach(sel);
  }

  /** Set one value on the store and run its effect; `relative` is a path below the selection's node */
  private change(relative: string[], value: unknown): void {
    const sel = this.current;
    if (!sel) return;
    const path = storePath(sel, relative);
    const node = storeValue(sel, relative.slice(0, -1)) as Record<string, unknown> | undefined;
    if (!node) return;
    const key = path.at(-1)!;
    const previous = node[key];
    if (value === undefined) delete node[key];
    else node[key] = value;
    runEffect({ sel, path, value, previous });
    if (sel.element === "grid") updateGridSizeReadout();
  }

  private banner(layer: LayerId): HTMLElement {
    const banner = document.createElement("div");
    banner.className = "banner";
    banner.append(`${layerLabel(layer)} layer is hidden. `);
    const link = document.createElement("a");
    link.textContent = "Turn on";
    link.addEventListener("click", () => {
      Layers.show(layer);
      if (this.current) this.renderForm(this.current);
    });
    banner.append(link);
    return banner;
  }

  /** The body of the card SchemaForm titles by the selection, where the element's own rows live */
  private rootBody(form: HTMLElement): Element {
    return form.querySelector('.schema-form > details[data-section=""] > .body') ?? form.querySelector(".schema-form")!;
  }

  /** A row outside the schema: a label and an empty control slot */
  private extraRow(label: string, tip: string): HTMLElement {
    const row = document.createElement("div");
    row.className = "row";
    row.dataset.tip = tip;
    row.innerHTML = /* html */ `<label>${label}</label><div class="ctl"></div>`;
    return row;
  }

  /** The styled checkbox with its label, for the app options that sit among the style rows */
  private appCheckbox(id: string, checked: boolean, onInput: (checked: boolean) => void): DocumentFragment {
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

  // the rows that are not fields: readouts, preset pickers and the one app option users look for here
  private addExtraRows(form: HTMLElement, sel: Resolved): void {
    if (sel.element === "grid") {
      const row = this.extraRow("Cell size", "Distance between grid cell centers (in map scale)");
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

    // not a field: assigns a ready-made look into the vignette and asks the editor to re-render
    if (sel.element === "vignette") {
      const row = this.extraRow("Preset", "Select a precreated vignette");
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
        this.renderForm(sel);
      });
      row.querySelector(".ctl")!.append(select);
      this.rootBody(form).prepend(row);
    }

    if (sel.element === "emblems") {
      const row = this.extraRow(
        "Show all",
        "Show emblem groups even if their size is too small or too big at the current scale"
      );
      row.dataset.field = "showAll";
      row.querySelector(".ctl")!.append(
        this.appCheckbox("showAllEmblems", options.app.emblems.showAll, checked => {
          Options.set(options => {
            options.app.emblems.showAll = checked;
          });
          invokeActiveZooming();
        })
      );
      this.rootBody(form).append(row);
    }
  }

  private glow(withGroup: boolean): void {
    this.elementSelect.classList.add("glow");
    this.groupSelect.classList.toggle("glow", withGroup);
    window.clearTimeout(this.glowTimer);
    this.glowTimer = window.setTimeout(() => {
      this.elementSelect.classList.remove("glow");
      this.groupSelect.classList.remove("glow");
    }, 1500);
  }
}

/** What the editor resolves a selection to: the store node, its schema subtree and the path to it */
type Resolved = StyleSelection & {
  path: string[];
  schema: z.ZodObject;
  value: object | undefined;
  entries?: GroupEntry[]; // the group list of a grouped element
};

class FormDecoration {
  private readonly folded = new Map<string, boolean>(); // section open state per element, for the session
  private cards: HTMLDetailsElement[] = [];
  private selection?: PathSelection;
  private baseline?: Baseline;

  /** `reset` writes a preset value and re-renders the form */
  constructor(
    private readonly form: HTMLElement,
    private readonly reset: (relative: string[], value: unknown) => void
  ) {
    // the control has written the store by the time the event bubbles here; a tick later is safe for every widget
    const onEdit = (event: Event) => {
      const field = (event.target as Element | null)?.closest<HTMLElement>("[data-field]");
      if (!field || !form.contains(field)) return;
      window.setTimeout(() => {
        this.mark(field);
        this.updatePreviews();
      }, 0);
    };
    form.addEventListener("input", onEdit);
    form.addEventListener("change", onEdit);
  }

  /** Look at the form as freshly rendered for `sel`: restore the folded cards and draw the preset marks */
  attach(sel: PathSelection): void {
    this.selection = sel;
    this.cards = Array.from(this.form.querySelectorAll<HTMLDetailsElement>("details[data-section]"));
    for (const card of this.cards) {
      const key = `${sel.element}/${card.dataset.section}`;
      if (this.folded.has(key)) card.open = this.folded.get(key)!;
      card.addEventListener("toggle", () => this.folded.set(key, card.open));
    }
    for (const field of this.fields) this.addResetButton(field);
    this.markAll();
  }

  /** The form is gone; drop what pointed at it */
  detach(): void {
    this.cards = [];
    this.selection = undefined;
  }

  /** The tab renders before the preset is loaded; once it is, the marks appear */
  setBaseline(baseline: Baseline | undefined): void {
    this.baseline = baseline;
    this.markAll();
  }

  private get fields(): HTMLElement[] {
    return Array.from(this.form.querySelectorAll<HTMLElement>("[data-field]"));
  }

  private relativeOf(field: HTMLElement): string[] {
    return field.dataset.field!.split(".");
  }

  private addResetButton(field: HTMLElement): void {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reset icon-ccw";
    button.addEventListener("click", event => {
      event.stopPropagation();
      const relative = this.relativeOf(field);
      const diff = this.baseline?.diffAt(this.selection!, relative);
      if (diff) this.reset(relative, diff.presetValue);
    });
    // a composite field's rows: the button sits on the first, the others get a blank of the same width
    // so all the rows' controls line up; a row part or a gate takes it itself
    const slots = Array.from(field.querySelectorAll<HTMLElement>(":scope > .ctl, :scope > .row > .ctl"));
    if (!slots.length) {
      field.append(button);
      return;
    }
    slots[0].append(button);
    for (const slot of slots.slice(1)) {
      const blank = button.cloneNode() as HTMLElement;
      blank.classList.add("blank");
      slot.append(blank);
    }
  }

  private markAll(): void {
    for (const field of this.fields) this.mark(field);
    this.updatePreviews();
  }

  // a changed field shows its reset button; the button's tip names the value it restores
  private mark(field: HTMLElement): void {
    if (!this.selection) return;
    const diff = this.baseline?.diffAt(this.selection, this.relativeOf(field));
    field.classList.toggle("changed", diff?.changed ?? false);
    const button = field.querySelector<HTMLElement>(".reset");
    if (!button || !diff) return;
    const value = diff.presetValue;
    const text = value == null ? "unset" : typeof value === "object" ? JSON.stringify(value) : String(value);
    button.dataset.tip = `Reset to preset value: ${text}`;
  }

  private updatePreviews(): void {
    if (!this.selection) return;
    for (const card of this.cards) {
      card.querySelector<HTMLElement>("summary > .preview")!.replaceChildren(...this.preview(card));
    }
  }

  // what the card's own rows (not a nested card's) produce, read from the store: a text sample for a font,
  // else a swatch for a fill and a line for a stroke; the filter's name when one is set
  private preview(card: HTMLDetailsElement): Element[] {
    const selection = this.selection!;
    const values: Record<string, unknown> = {};
    for (const field of this.fields) {
      if (field.closest("details[data-section]") !== card) continue;
      const relative = this.relativeOf(field);
      values[relative.at(-1)!] = storeValue(selection, relative);
    }
    const text = (key: string): string | undefined =>
      typeof values[key] === "string" ? String(values[key]) : undefined;
    const number = (key: string, fallback: number): number =>
      typeof values[key] === "number" ? Number(values[key]) : fallback;

    const font = text("font-family");
    const fill = text("fill") ?? text("color");
    const stroke = text("stroke");
    const filter = text("filter");
    const preview: Element[] = [];

    if (font) {
      const sample = document.createElement("span");
      sample.className = "sample";
      sample.textContent = "Sample";
      sample.style.fontFamily = font;
      sample.style.fontWeight = String(values["font-weight"] ?? "");
      sample.style.fontStyle = text("font-style") ?? "";
      sample.style.color = fill ?? "";
      const strokeWidth = number("stroke-width", 0);
      if (stroke && strokeWidth > 0) sample.style.webkitTextStroke = `${Math.min(strokeWidth, 1)}px ${stroke}`;
      preview.push(sample);
    } else {
      if (fill) {
        const swatch = document.createElement("span");
        swatch.className = "sw";
        const color = document.createElement("i");
        color.style.background = fill;
        color.style.opacity = String(number("fill-opacity", number("opacity", 1)));
        swatch.append(color);
        preview.push(swatch);
      }
      if (stroke) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "ln");
        svg.setAttribute("width", "60");
        svg.setAttribute("height", "12");
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", "0");
        line.setAttribute("y1", "6");
        line.setAttribute("x2", "60");
        line.setAttribute("y2", "6");
        line.setAttribute("stroke", stroke);
        line.setAttribute("stroke-width", String(Math.min(number("stroke-width", 1), 6)));
        line.setAttribute("opacity", String(number("opacity", 1)));
        const dash = text("stroke-dasharray");
        if (dash && dash !== "none") line.setAttribute("stroke-dasharray", dash);
        const linecap = text("stroke-linecap");
        if (linecap) line.setAttribute("stroke-linecap", linecap);
        svg.append(line);
        preview.push(svg);
      }
    }
    if (filter && filter !== "none") {
      // url(#splotch) → "splotch"; a CSS function list → its function names
      const name =
        filter.match(/^url\(#(.+)\)$/)?.[1] ?? Array.from(filter.matchAll(/([a-z-]+)\(/g), m => m[1]).join(", ");
      const fx = document.createElement("span");
      fx.className = "fx";
      fx.textContent = name;
      preview.push(fx);
    }
    return preview;
  }
}

export const StyleEditor = new StyleEditorController();
