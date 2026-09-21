// Every dialog the Style tab opens, plus the element and group listings the dialogs and the editor share
import { destroyDialog } from "@/components/dialog/dialog-helpers";
import { IconSets } from "@/components/icon-sets";
import { Layers } from "@/components/layers";
import { Controllers } from "@/controllers";
import { layerLabel } from "@/data/layer-labels";
import type { BurgIconSetId } from "@/generators/burgs-generator";
import { stylesSchema } from "@/generators/styles-schema";
import { getLabelsData } from "@/renderers/labels/label-data";
import { StylePresetsService, SYSTEM_PRESETS } from "@/services/style-presets";
import { VERSION } from "@/services/versioning";
import type { StyleElement, StyleSelection } from "@/types/styles";
import { capitalize, ensureEl, escapeHtml, findEl } from "@/utils";
import { burgIconPreview } from "./icon-preview";

export function listElements(): { id: StyleElement; label: string }[] {
  return (Object.keys(stylesSchema.shape) as StyleElement[])
    .map(id => ({ id, label: layerLabel(id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// The editors name elements by their svg group id
const ELEMENT_BY_DOM_ID: ReadonlyMap<string, StyleElement> = new Map(
  Layers.all.flatMap(layer => {
    if (!(layer.id in stylesSchema.shape)) return [];
    const ids = [layer.id, layer.elementId, ...layer.children.map(child => child.id)];
    return ids.map(id => [id, layer.id as StyleElement] as const);
  })
);

/** The style element an editor's id addresses: a legacy svg group id, a layer id, or the id itself */
export const elementFor = (id: string): StyleElement => ELEMENT_BY_DOM_ID.get(id) ?? (id as StyleElement);

/** Whether the element keeps a record of user-named groups, even while the record is empty */
export const hasGroups = (element: StyleElement): boolean => element in GROUP_SOURCES;

export type GroupEntry = { id: string; label: string; count?: string };
export const groupEntriesFor = (element: StyleElement): GroupEntry[] => GROUP_SOURCES[element]?.() ?? [];

const countBy = <T>(items: readonly T[], key: (item: T) => string | undefined): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k !== undefined) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
};

// labels and burgs list top-down: the group drawn on top (states, capitals) is the one most often styled
const GROUP_SOURCES: Partial<Record<StyleElement, () => GroupEntry[]>> = {
  labels: () => {
    // count from the label data: the culled DOM only holds labels rendered at this zoom
    const counts = countBy(getLabelsData(), label => label.group);
    return options.map.labels.groups
      .map(({ name }) => ({ id: name, label: name, count: String(counts.get(name) ?? 0) }))
      .reverse();
  },
  burgIcons: () => {
    const burgs = pack.burgs.filter(burg => burg.i && !burg.removed);
    const all = countBy(burgs, burg => burg.group);
    const ports = countBy(
      burgs.filter(burg => burg.port),
      burg => burg.group
    );
    return [...options.map.burgs.groups]
      .sort((a, b) => b.order - a.order)
      .map(({ name }) => ({
        id: name,
        label: name,
        count: `${all.get(name) ?? 0} burgs, ${ports.get(name) ?? 0} ports`
      }));
  },
  routes: () => {
    const counts = countBy(pack.routes ?? [], route => route.group);
    return Object.keys(styles.routes.groups).map(id => ({ id, label: id, count: String(counts.get(id) ?? 0) }));
  },
  lakes: () => {
    const counts = countBy(
      (pack.features ?? []).filter(feature => feature?.type === "lake"),
      feature => (feature as { group?: string }).group
    );
    return Object.keys(styles.lakes.groups).map(id => ({ id, label: id, count: String(counts.get(id) ?? 0) }));
  }
};

const ELEMENTS_ID = "styleElements";
const ELEMENTS_STYLE = /* css */ `
  #${ELEMENTS_ID} { padding: .4em .5em; }
  #${ELEMENTS_ID} > .tree { width: auto; max-height: 400px; overflow: auto; }
  #${ELEMENTS_ID} input.filter { width: 100%; box-sizing: border-box; margin-bottom: .4em; }
  #${ELEMENTS_ID} .li { display: grid; grid-template-columns: 1em 1em 1fr auto; align-items: center; gap: .4em; height: 1.9em; padding: 0 .4em; border-radius: 3px; white-space: nowrap; cursor: pointer; }
  #${ELEMENTS_ID} .li:hover { background: rgba(255, 255, 255, .25); }
  #${ELEMENTS_ID} .li.on { background: rgba(255, 255, 255, .45); font-weight: 700; }
  #${ELEMENTS_ID} .li .cnt { opacity: .6; font-size: .9em; font-weight: 400; }
  #${ELEMENTS_ID} .li .caret { opacity: .6; text-align: center; }
  #${ELEMENTS_ID} .dot { width: .7em; height: .7em; border-radius: 50%; border: 1px solid #333; justify-self: center; box-sizing: border-box; }
  #${ELEMENTS_ID} .dot.vis { background: #2f9e44; }
  #${ELEMENTS_ID} .dot.perm { background: #999; border-color: #999; cursor: default; }
  #${ELEMENTS_ID} .sub { margin-left: .9em; padding-left: 1.6em; border-left: 1px solid rgba(0, 0, 0, .15); }
  #${ELEMENTS_ID} .sub .li { grid-template-columns: 1fr auto; }
`;

/** Every style element with its visibility, its groups and their counts; a click selects in the editor */
export class ElementsDialog {
  private readonly expanded = new Set<string>(); // grouped elements the user unfolded, kept between opens
  private filter = "";
  private unsubscribe?: () => void;

  constructor(
    private readonly current: () => StyleSelection,
    private readonly onPick: (element: StyleElement, group?: string) => void
  ) {}

  open(): void {
    if (findEl(ELEMENTS_ID)) return void this.render();

    const dialog = document.createElement("div");
    dialog.id = ELEMENTS_ID;
    dialog.className = "dialog";
    dialog.style.display = "none";
    dialog.innerHTML = /* html */ `
      <style>${ELEMENTS_STYLE}</style>
      <input class="filter" type="text" placeholder="Filter…" data-tip="Filter elements and groups by name" />
      <div class="tree"></div>`;
    ensureEl("dialogs").append(dialog);

    const input = dialog.querySelector<HTMLInputElement>("input.filter")!;
    input.value = this.filter;
    input.addEventListener("input", () => {
      this.filter = input.value.trim().toLowerCase();
      this.render();
    });
    dialog.querySelector(".tree")!.addEventListener("click", event => this.onClick(event));
    this.unsubscribe = Layers.subscribe(() => this.render());

    $(dialog).dialog({
      title: "Style elements",
      width: "20em",
      height: "auto",
      maxHeight: Math.round(window.innerHeight * 0.7),
      position: { my: "left top", at: "right+10 top", of: "#options" },
      close: () => this.close()
    });
    this.render();
  }

  close(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    destroyDialog(ELEMENTS_ID);
  }

  /** Re-render when the selection or a group list changed elsewhere; a no-op while closed */
  refresh(): void {
    if (findEl(ELEMENTS_ID)) this.render();
  }

  private onClick(event: Event): void {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>(".li");
    if (!row) return;
    const element = row.dataset.element as StyleElement;

    if (target.classList.contains("dot")) {
      if (Layers.has(element) && !Layers.get(element).params.permanent) Layers.toggle(element);
      return;
    }
    if (target.classList.contains("caret")) {
      if (this.expanded.has(element)) this.expanded.delete(element);
      else this.expanded.add(element);
      this.render();
      return;
    }
    if (row.dataset.group !== undefined) {
      this.onPick(element, row.dataset.group);
      return;
    }

    // a grouped element opens on its first group and unfolds
    const first = groupEntriesFor(element)[0]?.id;
    if (first !== undefined) this.expanded.add(element);
    this.onPick(element, first);
  }

  private render(): void {
    const tree = findEl(ELEMENTS_ID)?.querySelector(".tree");
    if (!tree) return;
    const current = this.current();
    const rows: HTMLElement[] = [];

    for (const { id, label } of listElements()) {
      const entries = groupEntriesFor(id);
      const grouped = hasGroups(id);
      const elementMatches = !this.filter || label.toLowerCase().includes(this.filter);
      const matching = this.filter ? entries.filter(entry => entry.label.toLowerCase().includes(this.filter)) : entries;
      if (!elementMatches && !matching.length) continue;
      const isOpen = grouped && (this.filter ? true : this.expanded.has(id));

      const row = document.createElement("div");
      row.className = "li";
      row.dataset.element = id;
      if (current.element === id && !grouped) row.classList.add("on");
      row.append(
        this.span("caret", grouped ? (isOpen ? "▾" : "▸") : ""),
        this.dot(id),
        this.span("name", label),
        this.span("cnt", grouped ? String(entries.length) : "")
      );
      rows.push(row);
      if (!isOpen) continue;

      const sub = document.createElement("div");
      sub.className = "sub";
      for (const entry of elementMatches ? entries : matching) {
        const item = document.createElement("div");
        item.className = "li";
        item.dataset.element = id;
        item.dataset.group = entry.id;
        if (current.element === id && current.group === entry.id) item.classList.add("on");
        item.append(this.span("name", entry.label), this.span("cnt", entry.count ?? ""));
        sub.append(item);
      }
      rows.push(sub);
    }
    tree.replaceChildren(...rows);
  }

  private span(className: string, text = ""): HTMLElement {
    const el = document.createElement("span");
    el.className = className;
    el.textContent = text;
    return el;
  }

  // green when the layer is on, hollow when off, grey when it cannot be toggled or is not a layer
  private dot(id: StyleElement): HTMLElement {
    const dot = document.createElement("span");
    dot.className = "dot";
    if (!Layers.has(id)) {
      dot.classList.add("perm");
      dot.dataset.tip = "Not a layer";
      return dot;
    }
    if (Layers.get(id).params.permanent) {
      dot.classList.add("perm");
      dot.dataset.tip = "Always shown";
      return dot;
    }
    const on = Layers.isOn(id);
    if (on) dot.classList.add("vis");
    dot.dataset.tip = `Layer is ${on ? "on" : "off"}. Click to toggle`;
    return dot;
  }
}

// --- the preset gallery ----------------------------------------------------------------------------

const PRESETS_ID = "presetSelector";
const PRESETS_STYLE = /* css */ `
  #${PRESETS_ID} { padding: .4em .5em; }
  #${PRESETS_ID} > .grid { width: auto; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .4em; }
  #${PRESETS_ID} .pc { min-width: 0; border: 2px solid transparent; border-radius: 4px; padding: 2px; text-align: center; font-size: .9em; cursor: pointer; overflow: hidden; }
  #${PRESETS_ID} .pc:hover { background: rgba(255, 255, 255, .15); }
  #${PRESETS_ID} .pc.on { border-color: var(--style-pick, #f5c542); background: rgba(255, 255, 255, .25); }
  #${PRESETS_ID} .pc .img { position: relative; aspect-ratio: 16 / 9; border-radius: 2px; background: #888; display: flex; align-items: center; justify-content: center; color: #eee; font-style: italic; overflow: hidden; }
  #${PRESETS_ID} .pc .img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  #${PRESETS_ID} .pc .name { display: block; text-transform: capitalize; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

/** One screenshot per preset, the current one outlined; a click applies through the confirmed path */
export class PresetSelector {
  open(): void {
    if (findEl(PRESETS_ID)) return void this.render();

    const dialog = document.createElement("div");
    dialog.id = PRESETS_ID;
    dialog.className = "dialog";
    dialog.style.display = "none";
    dialog.innerHTML = /* html */ `<style>${PRESETS_STYLE}</style><div class="grid"></div>`;
    ensureEl("dialogs").append(dialog);
    dialog.querySelector(".grid")!.addEventListener("click", event => {
      const name = (event.target as HTMLElement).closest<HTMLElement>(".pc")?.dataset.name;
      if (name && name !== this.current()) void Controllers.StylePresetsEditor.requestChange(name);
    });

    $(dialog).dialog({
      title: "Style presets",
      width: "36em",
      position: { my: "left top", at: "right+10 top", of: "#options" },
      close: () => destroyDialog(PRESETS_ID)
    });
    this.render();
  }

  /** Re-render after the preset changed or a custom one was saved or removed; a no-op while closed */
  refresh(): void {
    if (findEl(PRESETS_ID)) this.render();
  }

  close(): void {
    destroyDialog(PRESETS_ID);
  }

  private current(): string {
    return options.map.style.preset || "default";
  }

  private render(): void {
    const grid = findEl(PRESETS_ID)?.querySelector(".grid");
    if (!grid) return;
    const cards = [...SYSTEM_PRESETS, ...StylePresetsService.listCustom()].map(name => this.card(name));
    grid.replaceChildren(...cards);
  }

  private card(name: string): HTMLElement {
    const card = document.createElement("div");
    card.className = "pc";
    card.dataset.name = name;
    card.dataset.tip = `Apply the ${StylePresetsService.displayName(name)} preset`;
    card.classList.toggle("on", name === this.current());

    const image = document.createElement("div");
    image.className = "img";
    // a custom preset, or a screenshot that fails to load, shows the neutral tile
    if (StylePresetsService.isSystem(name)) {
      const screenshot = document.createElement("img");
      screenshot.alt = "";
      screenshot.addEventListener("error", () => screenshot.replaceWith("custom"));
      screenshot.src = `./images/style-presets/${name}.png?v=${VERSION}`;
      image.append(screenshot);
    } else {
      image.textContent = "custom";
    }

    const label = document.createElement("span");
    label.className = "name";
    label.textContent = StylePresetsService.displayName(name);
    card.append(image, label);
    return card;
  }
}

export const FONT_DIALOG = "fontDialog";

const FONT_STYLE = /* css */ `
  #${FONT_DIALOG} { display: flex; flex-direction: column; gap: .4em; }
  #${FONT_DIALOG} input { width: 100%; box-sizing: border-box; }
  #${FONT_DIALOG} .choices { display: flex; flex-direction: column; gap: 0.3em; width: auto; max-height: 40vh; overflow-y: auto; }
  #${FONT_DIALOG} button { flex: none; padding: .3em .5em; border: 1px solid transparent; border-radius: 0; text-align: left; white-space: nowrap; overflow: hidden; }
  #${FONT_DIALOG} button:hover { border-color: var(--dark-solid); }
  #${FONT_DIALOG} button.pressed { border: 1px solid var(--dark-solid); }
  #${FONT_DIALOG} button .sample { display: block; font-size: 1.5em; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; }
  #${FONT_DIALOG} button .family { display: block; font-size: 0.9em; line-height: 1em; opacity: .7; }
`;

type FontDialogOptions = {
  selected: string;
  sample: string; // what the labels say, drawn in each family
  onPick: (family: string) => void;
  onAdd: (refresh: (family: string) => void) => void; // opens the add-font flow; the callback lists the new family
};

function fontChoices(sample: string, selected: string): string {
  const families = [...new Set(fonts.map(({ family }) => family))];
  if (selected && !families.includes(selected)) families.push(selected);
  return families
    .map(
      family => /* html */ `
        <button type="button" data-family="${escapeHtml(family)}" class="${family === selected ? "pressed" : ""}">
          <span class="sample" style="font-family: '${escapeHtml(family)}'">${escapeHtml(sample)}</span>
          <span class="family">${escapeHtml(family)}</span>
        </button>`
    )
    .join("");
}

export function openFontDialog({ selected, sample, onPick, onAdd }: FontDialogOptions): void {
  destroyDialog(FONT_DIALOG);
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${FONT_DIALOG}" class="dialog">
      <style>${FONT_STYLE}</style>
      <input type="text" placeholder="Search fonts" />
      <div class="choices">${fontChoices(sample, selected)}</div>
    </div>`
  );
  const dialog = ensureEl(FONT_DIALOG);

  const search = dialog.querySelector("input")!;
  const list = dialog.querySelector<HTMLElement>(".choices")!;

  const filter = () => {
    const query = search.value.trim().toLowerCase();
    for (const button of list.querySelectorAll<HTMLElement>("button[data-family]")) {
      button.hidden = !button.dataset.family!.toLowerCase().includes(query);
    }
  };
  search.addEventListener("input", filter);

  const select = (family: string) => {
    for (const pressed of list.querySelectorAll(".pressed")) pressed.classList.remove("pressed");
    list.querySelector(`button[data-family="${CSS.escape(family)}"]`)?.classList.add("pressed");
    onPick(family);
  };
  list.addEventListener("click", event => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-family]");
    if (button) select(button.dataset.family!);
  });

  $(dialog).dialog({
    title: "Select font",
    width: "24em",
    position: { my: "center", at: "center", of: "svg" },
    close: () => destroyDialog(FONT_DIALOG),
    buttons: {
      "Add font": () =>
        onAdd(family => {
          list.innerHTML = fontChoices(sample, family);
          filter();
          select(family);
        }),
      Close: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
  list.querySelector(".pressed")?.scrollIntoView({ block: "center" });
}

// --- the burg and port icon picker -----------------------------------------------------------------

export const BURG_ICON_DIALOG = "burgIconDialog";

const BURG_ICON_STYLE = /* css */ `
  #${BURG_ICON_DIALOG} .choices { display: grid; grid-template-columns: repeat(7, 5em); gap: .3em; }
  #${BURG_ICON_DIALOG} > div { width: 100%; }
  #${BURG_ICON_DIALOG} h4 { margin: .6em 0 .3em; }
  #${BURG_ICON_DIALOG} h4:first-child { margin-top: 0; }
  #${BURG_ICON_DIALOG} button { width: 100%; min-width: 0; margin: 0; padding: .3em .2em; border: 1px solid transparent; border-radius: 0; white-space: normal; }
  #${BURG_ICON_DIALOG} button:hover { border-color: var(--dark-solid); }
  #${BURG_ICON_DIALOG} button.pressed { border: 1px solid var(--dark-solid); }
  #${BURG_ICON_DIALOG} button svg { display: block; width: 100%; height: 42px; overflow: visible; pointer-events: none; }
  #${BURG_ICON_DIALOG} button span { display: block; font-size: 0.9em; line-height: 1em; opacity: .7; text-transform: capitalize; overflow-wrap: anywhere; }
`;

type BurgIconDialogOptions = {
  anchors: boolean; // the port icons instead of the burg ones
  selected: string;
  fill: string;
  stroke: string;
  onPick: (id: string) => void;
};

const ROOT_GROUP = "Atlas"; // the set's own files; a subdirectory is a styled group named after it

/** The dialog's content: the set's files grouped by directory, the selected one pressed */
export function renderChoices(set: BurgIconSetId, selected: string): string {
  const groups = new Map<string, string[]>();
  for (const file of IconSets.files(set)) {
    const slash = file.lastIndexOf("/");
    const group = slash < 0 ? ROOT_GROUP : capitalize(file.slice(0, slash));
    groups.set(group, [...(groups.get(group) ?? []), file]);
  }
  return [...groups]
    .map(
      ([group, files]) => /* html */ `
        ${groups.size > 1 ? `<h4>${group}</h4>` : ""}
        <div class="choices">
          ${files
            .map(file => {
              const id = `#${IconSets.symbolId(set, file)}`;
              const name = file.slice(file.lastIndexOf("/") + 1).replaceAll("-", " ");
              return /* html */ `
                <button type="button" data-icon="${id}" title="${name}" class="${id === selected ? "pressed" : ""}">
                  ${burgIconPreview(id)}<span>${name}</span>
                </button>`;
            })
            .join("")}
        </div>`
    )
    .join("");
}

export async function openBurgIconDialog({
  anchors,
  selected,
  fill,
  stroke,
  onPick
}: BurgIconDialogOptions): Promise<void> {
  const set: BurgIconSetId = anchors ? "ports" : "burgs";
  await IconSets.retry(set); // the previews frame themselves from the loaded symbols
  destroyDialog(BURG_ICON_DIALOG);
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${BURG_ICON_DIALOG}" class="dialog">
      <style>${BURG_ICON_STYLE}</style>
      ${renderChoices(set, selected)}
    </div>`
  );
  const dialog = ensureEl(BURG_ICON_DIALOG);
  paintBurgIconDialog(fill, stroke, dialog);
  dialog.addEventListener("click", event => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-icon]");
    if (!button) return;
    for (const pressed of dialog.querySelectorAll(".pressed")) pressed.classList.remove("pressed");
    button.classList.add("pressed");
    onPick(button.dataset.icon!);
  });

  $(dialog).dialog({
    title: anchors ? "Select port icon" : "Select burg icon",
    width: "fit-content",
    position: { my: "center", at: "center", of: "svg" },
    close: () => destroyDialog(BURG_ICON_DIALOG),
    buttons: {
      Close: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

/** Redraw the open dialog's icons in a group's paint as it is edited */
export function paintBurgIconDialog(fill: string, stroke: string, dialog = findEl(BURG_ICON_DIALOG)): void {
  if (!dialog) return;
  dialog.style.fill = fill;
  dialog.style.stroke = stroke;
}
