// The Style elements dialog: every style element with its visibility, its groups and their counts. A click
// selects in the editor and the dialog stays open, following the selection
import { destroyDialog } from "@/components/dialog/dialog-helpers";
import { type LayerId, Layers } from "@/components/layers";
import type { StyleElement } from "@/generators/styles-schema";
import { ensureEl, findEl } from "@/utils";
import type { Selection } from "./effects";
import { GROUP_SOURCES, listElements } from "./groups";

const ID = "styleElements";

const STYLE = /* css */ `
  #${ID} { padding: .4em .5em; }
  #${ID} > .tree { width: auto; max-height: 400px; overflow: auto; }
  #${ID} input.filter { width: 100%; box-sizing: border-box; margin-bottom: .4em; }
  #${ID} .li { display: grid; grid-template-columns: 1em 1em 1fr auto; align-items: center; gap: .4em; height: 1.9em; padding: 0 .4em; border-radius: 3px; white-space: nowrap; cursor: pointer; }
  #${ID} .li:hover { background: rgba(255, 255, 255, .25); }
  #${ID} .li.on { background: rgba(255, 255, 255, .45); font-weight: 700; }
  #${ID} .li .cnt { opacity: .6; font-size: .9em; font-weight: 400; }
  #${ID} .li .caret { opacity: .6; text-align: center; }
  #${ID} .dot { width: .7em; height: .7em; border-radius: 50%; border: 1px solid #333; justify-self: center; box-sizing: border-box; }
  #${ID} .dot.vis { background: #2f9e44; }
  #${ID} .dot.perm { background: #999; border-color: #999; cursor: default; }
  #${ID} .sub { margin-left: .9em; padding-left: 1.6em; border-left: 1px solid rgba(0, 0, 0, .15); }
  #${ID} .sub .li { grid-template-columns: 1fr auto; }
`;

export class ElementsDialog {
  private readonly expanded = new Set<string>(); // grouped elements the user unfolded, kept between opens
  private filter = "";
  private unsubscribe?: () => void;

  constructor(
    private readonly current: () => Selection,
    private readonly onPick: (element: StyleElement, group?: string) => void
  ) {}

  open(): void {
    if (findEl(ID)) return void this.render();

    const dialog = document.createElement("div");
    dialog.id = ID;
    dialog.className = "dialog";
    dialog.style.display = "none";
    dialog.innerHTML = /* html */ `
      <style>${STYLE}</style>
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
    destroyDialog(ID);
  }

  /** Re-render when the selection or a group list changed elsewhere; a no-op while closed */
  refresh(): void {
    if (findEl(ID)) this.render();
  }

  private onClick(event: Event): void {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>(".li");
    if (!row) return;
    const element = row.dataset.element as StyleElement;

    if (target.classList.contains("dot")) {
      if (Layers.has(element) && !Layers.get(element).params.permanent) Layers.toggle(element);
    } else if (target.classList.contains("caret")) {
      this.expanded.has(element) ? this.expanded.delete(element) : this.expanded.add(element);
      this.render();
    } else if (row.dataset.group !== undefined) {
      this.onPick(element, row.dataset.group);
    } else {
      // a grouped element opens on its first group and unfolds
      const first = GROUP_SOURCES[element]?.()[0]?.id;
      if (first !== undefined) this.expanded.add(element);
      this.onPick(element, first);
    }
  }

  private render(): void {
    const tree = findEl(ID)?.querySelector(".tree");
    if (!tree) return;
    const current = this.current();
    const rows: HTMLElement[] = [];

    for (const { id, label } of listElements()) {
      const entries = GROUP_SOURCES[id]?.() ?? [];
      const elementMatches = !this.filter || label.toLowerCase().includes(this.filter);
      const matching = this.filter ? entries.filter(entry => entry.id.toLowerCase().includes(this.filter)) : entries;
      if (!elementMatches && !matching.length) continue;

      const grouped = entries.length > 0;
      const isOpen = grouped && (this.filter ? true : this.expanded.has(id));
      const row = document.createElement("div");
      row.className = "li";
      row.dataset.element = id;
      if (current.element === id && !grouped) row.classList.add("on");
      row.innerHTML = /* html */ `<span class="caret">${grouped ? (isOpen ? "▾" : "▸") : ""}</span>${this.dot(id)}<span class="name">${label}</span><span class="cnt">${grouped ? entries.length : ""}</span>`;
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
        const [, name = entry.id, count = ""] = entry.label.match(/^(.*?)\s*\((.*)\)$/) ?? []; // "river (110)"
        item.innerHTML = /* html */ `<span class="name">${name}</span><span class="cnt">${count}</span>`;
        sub.append(item);
      }
      rows.push(sub);
    }
    tree.replaceChildren(...rows);
  }

  // green when the layer is on, hollow when off, grey when it cannot be toggled or is not a layer
  private dot(id: StyleElement): string {
    if (!Layers.has(id)) return '<span class="dot perm" data-tip="Not a layer"></span>';
    const layer = id as LayerId;
    if (Layers.get(layer).params.permanent) return '<span class="dot perm" data-tip="Always shown"></span>';
    const on = Layers.isOn(layer);
    return `<span class="dot${on ? " vis" : ""}" data-tip="Layer is ${on ? "on" : "off"}. Click to toggle"></span>`;
  }
}
