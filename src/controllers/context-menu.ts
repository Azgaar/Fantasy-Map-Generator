import { Controllers } from "@/controllers";
import { Pack } from "@/model/graph/pack-generator";
import { type EntityRef, MapEntities } from "@/model/map-entities";
import { Layers } from "@/renderers/layers";
import * as Connection from "@/services/assistant/provider/connection";
import { openEntity, revealEntity } from "@/ui/map/reveal";
import { openEditor } from "@/ui/map/viewbox-events";
import { t } from "@/utils/i18n";
import { findEl, getPointer } from "@/utils/node-utils";
import { rn } from "@/utils/number-utils";
import { escapeHtml } from "@/utils/string-utils";

/** An entity at the spot, with its topmost element under the cursor when it is drawn there */
interface Row {
  ref: EntityRef;
  element?: Element;
}

const MENU_KEYS = ["Escape", "ArrowDown", "ArrowUp", "Enter", " "];

class ContextMenuController {
  private root?: HTMLDivElement;
  private events?: AbortController;
  private rows: Row[] = [];
  private cell = 0;
  private point: [number, number] = [0, 0]; // where the menu was opened, in map units

  open(event: MouseEvent): void {
    this.close();
    const viewbox = findEl("viewbox");
    if (!viewbox || !pack.cells?.p) return;

    const [x, y] = getPointer(event, viewbox);
    const cell = Pack.findCell(x, y);
    if (cell === undefined) return;

    this.cell = cell;
    this.point = [rn(x, 2), rn(y, 2)];
    this.rows = this.collect(event.clientX, event.clientY, cell);
    this.render(event.clientX, event.clientY);
    this.listen();
  }

  close(): void {
    this.root?.remove();
    this.root = undefined;
    this.rows = [];
    this.events?.abort();
    this.events = undefined;
  }

  /** What is drawn under the cursor, top first, then what the cell holds; past the top, the narrowest first */
  private collect(clientX: number, clientY: number, cell: number): Row[] {
    const rows = new Map<string, Row>();
    const add = (ref: EntityRef, element?: Element) => {
      const key = MapEntities.key(ref);
      if (!rows.has(key) && MapEntities.get(ref)) rows.set(key, { ref, element });
    };
    for (const element of document.elementsFromPoint(clientX, clientY)) {
      const ref = MapEntities.resolveTarget(element);
      if (ref) add(ref, element);
    }
    const top = rows.values().next().value; // the topmost entity drawn here, if any
    for (const ref of MapEntities.at(cell)) add(ref, this.element(ref));

    const scale = ({ ref }: Row) => MapEntities.getDisplay(ref).scale;
    const rest = [...rows.values()].filter(row => row !== top).sort((a, b) => scale(b) - scale(a));
    return top ? [top, ...rest] : rest;
  }

  private render(clientX: number, clientY: number): void {
    const root = document.createElement("div");
    root.id = "contextMenu";
    root.setAttribute("role", "menu");

    const rows = this.rows.map(({ ref, element }, index) => {
      const { kind, icon } = MapEntities.getDisplay(ref);
      const hidden = !element && this.hidden(ref); // drawn under the cursor is shown, whatever its own layers
      const name = MapEntities.getName(ref); // an unnamed entity is titled by its kind only
      return /* html */ `<button type="button" role="menuitem" data-index="${index}" ${hidden ? `class="dim" data-tip="${t("The layer is hidden")}"` : ""}>
        <span class="${icon}"></span><span class="name">${escapeHtml(name || kind)}</span>${name ? `<span class="kind">${escapeHtml(kind)}</span>` : ""}
      </button>`;
    });
    if (Connection.isConnected())
      rows.push(/* html */ `<button type="button" role="menuitem" data-action="ask">
        <span class="icon-help"></span><span class="name">${t("What's there?")}</span>
      </button>`);

    root.innerHTML = /* html */ `
      <style>
        #contextMenu {
          position: fixed;
          z-index: 100000;
          box-sizing: border-box;
          min-width: 14em;
          max-width: min(24em, calc(100vw - 8px));
          max-height: calc(100vh - 8px);
          overflow-y: auto;
          padding: 0.25em;
          background: var(--bg-dialogs, rgb(250 250 250 / 97%));
          color: #30343b;
          box-shadow: 0 0.5em 1.5em #00000030;
          font: 1.1em/1.3 var(--sans-serif);
        }

        #contextMenu button {
          display: flex;
          align-items: center;
          gap: 0.6em;
          width: 100%;
          padding: 0.3em 0.6em;
          border: 0;
          background: transparent;
          color: inherit;
          font: inherit;
          text-align: left;
          cursor: pointer;
        }

        #contextMenu button:hover,
        #contextMenu button:focus-visible {
          outline: none;
          background: color-mix(in srgb, var(--dark-solid) 12%, transparent);
        }

        #contextMenu button.dim {
          opacity: 0.55;
        }

        #contextMenu button[data-action="ask"] {
          margin-top: 0.25em;
          border-top: 1px solid color-mix(in srgb, var(--bg-main) 22%, transparent);
        }

        #contextMenu button > [class^="icon-"] {
          flex: 0 0 1.3em;
          color: var(--dark-solid);
          text-align: center;
        }

        #contextMenu .name {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        #contextMenu .kind {
          color: color-mix(in srgb, currentColor 55%, transparent);
          font-size: 0.85em;
          white-space: nowrap;
        }
      </style>
      ${rows.join("")}`;

    document.body.append(root);
    const { width, height } = root.getBoundingClientRect();
    root.style.left = `${Math.max(4, Math.min(clientX, window.innerWidth - width - 4))}px`;
    root.style.top = `${Math.max(4, Math.min(clientY, window.innerHeight - height - 4))}px`;
    this.root = root;
  }

  private listen(): void {
    const root = this.root;
    if (!root) return;
    this.events = new AbortController();
    const signal = this.events.signal;
    const capture = { capture: true, signal };

    root.addEventListener("click", event => this.activate(event.target as Element), { signal });
    root.addEventListener("contextmenu", event => event.preventDefault(), { signal });

    // the hotkeys act on keyup (Escape closes dialogs, arrows pan, Space opens search): the menu's keys stop there;
    // any other key closes the menu and does its usual job, as a zoom or a layer toggle would leave the menu stale
    const own = (event: KeyboardEvent) => MENU_KEYS.includes(event.key);
    window.addEventListener(
      "keydown",
      event => {
        if (!own(event)) {
          this.close();
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") this.move(event.key === "ArrowDown" ? 1 : -1);
        if (event.key !== "Enter" && event.key !== " ") event.preventDefault(); // a focused row clicks on them
        event.stopImmediatePropagation();
      },
      capture
    );
    window.addEventListener(
      "keyup",
      event => {
        if (!own(event)) return;
        event.stopImmediatePropagation();
        if (event.key === "Escape") this.close();
      },
      capture
    );
    const outside = (event: Event) => {
      if (!root.contains(event.target as Node)) this.close();
    };
    window.addEventListener("pointerdown", outside, capture);
    window.addEventListener("wheel", outside, capture);
    // not captured: a row losing focus as the menu is removed must not close it again
    for (const type of ["blur", "resize", "map:generated"])
      window.addEventListener(type, () => this.close(), { signal });
  }

  private move(step: number): void {
    const buttons = Array.from(this.root?.querySelectorAll("button") ?? []);
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      current === -1 ? (step > 0 ? 0 : buttons.length - 1) : (current + step + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  /** A drawn row opens what left-click on it opens; any other row opens or reveals like a search result */
  private activate(target: Element): void {
    const button = target.closest("button");
    if (!button) return;
    if (button.dataset.action === "ask") {
      this.ask();
      return;
    }

    const row = this.rowOf(button);
    this.close();
    if (!row || (row.element && openEditor(row.element))) return;
    if (!openEntity(row.ref)) revealEntity(row.ref);
  }

  private ask(): void {
    const [x, y] = this.point;
    const question = `${t("What's there?")} cell:${this.cell}, x:${x}, y:${y}`;
    this.close();
    Controllers.Assistant.ask(question);
  }

  /** The entity's own shown element; a territory's is its label, which opens the label editor instead */
  private element(ref: EntityRef): Element | undefined {
    const element = this.hidden(ref) ? null : findEl(MapEntities.getElementId(ref) ?? "");
    return element && !element.closest("#labels") ? element : undefined;
  }

  private hidden(ref: EntityRef): boolean {
    const { layers } = MapEntities.getDisplay(ref);
    return layers.length > 0 && !layers.some(layer => Layers.isOn(layer));
  }

  private rowOf(target: Element | undefined): Row | undefined {
    const index = target?.closest<HTMLElement>("button[data-index]")?.dataset.index;
    return index === undefined ? undefined : this.rows[Number(index)];
  }
}

export const ContextMenu = new ContextMenuController();
