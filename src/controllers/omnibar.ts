import type { LayerId } from "@/components/layers";
import { Layers } from "@/components/layers";
import { MAP_COMMANDS, type MapCommand } from "@/components/map-commands";
import { ENTITY_TYPES, type EntityDisplay, type EntityTarget, MapEntities } from "@/components/map-entities";
import { tip } from "@/components/tooltips";
import { viewport } from "@/components/viewport";
import { zoomTo } from "@/components/zoom";
import { getLabelsData } from "@/renderers/labels/label-data";
import type { LabelData } from "@/renderers/labels/labels";
import { highlightElement } from "@/renderers/overlays/highlight";
import type { Point } from "@/types/global";
import { findEl } from "@/utils";

interface SearchFields {
  names: string[];
  note?: string;
  normalizedNote?: string;
}

interface BaseResult {
  id: string;
  name: string;
  context: string;
  fields: SearchFields;
}

interface CommandResult extends BaseResult {
  kind: "command";
  command: MapCommand;
}

interface EntityResult extends BaseResult {
  kind: "entity";
  target: EntityTarget;
  display: EntityDisplay;
}

/** A label is not always its owner's element: it navigates to the text, not to the owner */
interface LabelResult extends BaseResult {
  kind: "label";
  target: EntityTarget;
  label: LabelData;
}

type Result = CommandResult | EntityResult | LabelResult;

/** A record matched by one query, kept together with the score the sort uses */
interface Scored {
  result: Result;
  score: number;
  order: number;
}

const HISTORY_KEY = "fmg-omnibar-history";
const HISTORY_LIMIT = 10;
const RESULT_LIMIT = 50;

/** Identifies the map the current records were collected from: a replacement recycles ids and entities */
let mapGeneration = 0;
window.addEventListener("map:generated", () => mapGeneration++);

const textTemplate = document.createElement("template");

class OmnibarController {
  private root?: HTMLDivElement;
  private input?: HTMLInputElement;
  private list?: HTMLDivElement;
  private status?: HTMLDivElement;
  private events?: AbortController;
  private previousFocus?: HTMLElement;
  private keys = new Set<string>();
  private records: Result[] = [];
  private results: Result[] = [];
  private history: string[] = [];
  private selected = -1;
  private generation = mapGeneration;
  private busy = false;

  open(): void {
    if (this.root) return void this.input?.focus();
    if (this.busy) return;

    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.generation = mapGeneration;
    this.records = this.collect();
    this.history = this.readHistory();

    this.render();
    this.listen();
    this.search();
    this.input?.focus();
  }

  private collect(): Result[] {
    const commands: CommandResult[] = MAP_COMMANDS.map(command => ({
      kind: "command",
      id: command.id,
      name: command.name,
      context: "Command",
      fields: { names: [this.normalize(command.name), this.normalize(command.aliases)] },
      command
    }));
    if (typeof pack === "undefined" || !pack.cells?.i?.length) return commands;

    const entities = new Map<string, Result>();
    for (const type of ENTITY_TYPES) {
      for (const target of MapEntities.collect(type)) {
        const { ref, entity } = target;
        const key = MapEntities.key(ref);
        const display = MapEntities.getDisplay(ref);
        const name = MapEntities.getName(ref) || entity.name || display.kind;
        const context = [display.kind, MapEntities.getContext(ref)].filter(Boolean).join(" · ");
        const alias = entity.name || name;
        entities.set(key, {
          kind: "entity",
          id: `entity:${key}`,
          name,
          context,
          fields: this.fields({ name, alias: `${alias} ${context}`, note: entity.note }),
          target,
          display
        });
      }
    }

    // labels are listed apart from their owners; an added label is its own entity, so it just gets the label data
    for (const label of getLabelsData()) {
      if (!label.text) continue;
      const type = label.type === "added" ? "addedLabel" : label.type;
      const owner = entities.get(MapEntities.key({ type, id: label.entityId }));
      if (!owner || owner.kind !== "entity") continue;
      if (label.type === "added") continue; // an added label is its own entity, so its own result already carries the text
      const name = label.text.replaceAll("|", " ");
      entities.set(`label:${label.id}`, {
        kind: "label",
        id: `label:${label.id}`,
        name,
        context: `Label · ${owner.context}`,
        fields: this.fields({ name, alias: `${owner.name} ${owner.context}` }),
        target: owner.target,
        label
      });
    }
    return [...commands, ...entities.values()];
  }

  private fields({ name, alias, note }: { name: string; alias: string; note?: string }): SearchFields {
    const text = this.plainText(note || "");
    return {
      names: [this.normalize(name), this.normalize(alias)],
      note: text,
      normalizedNote: text ? this.normalize(text) : undefined
    };
  }

  private navigate(
    target: EntityTarget,
    { label, display }: { label?: LabelData; display?: EntityDisplay } = {}
  ): void {
    const layers: LayerId[] = label ? ["labels"] : display?.layers || [];
    const points = label
      ? [[label.anchor[0] + (label.dx || 0), label.anchor[1] + (label.dy || 0)] as Point]
      : MapEntities.getPoints(target.ref);
    if (!points.length) {
      this.report("This element has no map location", "warn");
      return;
    }

    Layers.show(...layers);
    const group = label && options.map.labels.groups.find(group => group.name === label.group);
    if (group?.layerDependency && Layers.has(group.layerDependency)) Layers.show(group.layerDependency);

    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]; // a loop: a territory can have too many cells to spread
    for (const [x, y] of points)
      [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    const cap = label ? 8 : (display?.scale ?? 8);
    const fit = Math.min(
      cap,
      (viewport.width * 0.65) / Math.max(1, x1 - x0),
      (viewport.height * 0.65) / Math.max(1, y1 - y0)
    );
    let scale = Math.max(1, fit);
    if (group) scale = Math.max(group.zoom.min ?? 1, Math.min(group.zoom.max ?? 20, scale));

    zoomTo((x0 + x1) / 2, (y0 + y1) / 2, scale, 1500);
    // the outline animates in while the view is still moving: the target element may not be drawn yet, so a miss is fine
    setTimeout(() => {
      const elementId = label ? label.id : MapEntities.getElementId(target.ref);
      const element = label
        ? findEl(label.id)
        : (display?.highlight && document.querySelector(display.highlight)) || (elementId ? findEl(elementId) : null);
      if (element) highlightElement(element);
    }, 750);
  }

  private plainText(html: string): string {
    if (!html) return ""; // most entities carry no note, and parsing each of them is the expensive part
    textTemplate.innerHTML = html;
    for (const node of textTemplate.content.querySelectorAll("script, style")) node.remove();
    for (const node of textTemplate.content.querySelectorAll("br, p, div, li")) node.append(" ");
    const text = textTemplate.content.textContent || "";
    textTemplate.innerHTML = "";
    return text.replace(/\s+/g, " ").trim();
  }

  private normalize(text: string): string {
    return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  private match(text: string, query: string): number {
    if (text === query) return 1000;
    if (text.startsWith(query)) return 850;
    if (text.includes(query)) return 700;

    const words = query.split(" ");
    return words.length > 1 && words.every(word => text.includes(word)) ? 600 : 0;
  }

  private score(result: Result, query: string, commandsOnly: boolean, recent: number): number {
    if (query) {
      const name = Math.max(0, ...result.fields.names.map(name => this.match(name, query)));
      const note = result.fields.normalizedNote?.includes(query) ? 100 : 0;
      return Math.max(name && name + 200, note);
    }
    if (commandsOnly) return 1000 - Math.max(recent, 0); // every command, with the recent ones first
    if (result.kind !== "command" || recent < 0) return 0;
    return 1000 - recent;
  }

  private search(): void {
    const value = this.input?.value.trim() || "";
    const commandsOnly = value.startsWith(">");
    const query = this.normalize(commandsOnly ? value.slice(1) : value);
    const searchable = !query || /[\p{L}\p{N}]/u.test(query); // a punctuation-only query matches nothing

    this.results = this.records
      .filter(result => !commandsOnly || result.kind === "command")
      .map(
        (result, order): Scored => ({
          result,
          order,
          score: searchable ? this.score(result, query, commandsOnly, this.history.indexOf(result.id)) : 0
        })
      )
      .filter(row => row.score > 0)
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .slice(0, RESULT_LIMIT)
      .map(row => row.result);

    this.selected = 0;
    this.renderResults(query);
  }

  private render(): void {
    const root = document.createElement("div");
    root.id = "omnibar";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Search map and commands");

    root.innerHTML = /* html */ `
      <style>
        #omnibar {
          --line: color-mix(in srgb, var(--bg-main) 22%, transparent);
          --muted: color-mix(in srgb, currentColor 55%, transparent);
          position: fixed;
          top: 0.8em;
          left: 50%;
          transform: translateX(-50%);
          width: min(50em, calc(100vw - 2em));
          z-index: 100000;
          box-sizing: border-box;
          overflow: hidden;
          background: var(--bg-dialogs, rgb(250 250 250 / 97%));
          color: #30343b;
          box-shadow: 0 0.5em 1.5em #00000030;
          font: 1.2em/1.3 var(--sans-serif);
        }

        #omnibar .omnibar-search {
          display: flex;
          align-items: center;
          gap: 0.7em;
          padding: 0 0.9em;
        }

        #omnibar .omnibar-search > .icon-search {
          color: var(--dark-solid);
          font-size: 1em;
        }

        #omnibar input {
          box-sizing: border-box;
          flex: 1;
          min-width: 0;
          height: 2.7em;
          margin: 0;
          padding: 0;
          border: 0;
          border-radius: 0;
          outline: none;
          box-shadow: none;
          background: transparent;
          color: inherit;
          caret-color: var(--dark-solid);
          font: inherit;
        }

        #omnibar input::placeholder {
          color: var(--muted);
        }

        #omnibar .omnibar-escape {
          color: var(--muted);
          font-size: 0.75em;
        }

        #omnibar-list {
          max-height: min(26em, 50vh);
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-width: thin;
          scrollbar-color: var(--line) transparent;
        }

        #omnibar-list:not(:empty) {
          padding: 0.25em;
          border-top: 1px solid var(--line);
        }

        #omnibar [role="option"] {
          display: flex;
          align-items: center;
          gap: 0.6em;
          min-width: 0;
          padding: 0.3em 0.6em;
          cursor: pointer;
        }

        #omnibar [role="option"]:hover {
          background: color-mix(in srgb, var(--dark-solid) 5%, transparent);
        }

        #omnibar [role="option"][aria-selected="true"] {
          background: color-mix(in srgb, var(--dark-solid) 12%, transparent);
        }

        #omnibar [aria-disabled="true"] {
          color: var(--muted);
          cursor: default;
        }

        #omnibar .omnibar-icon {
          flex: 0 0 1.3em;
          color: var(--muted);
          font-size: 0.95em;
          text-align: center;
        }

        #omnibar [aria-selected="true"] .omnibar-icon {
          color: var(--dark-solid);
        }

        #omnibar .omnibar-name {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        #omnibar .omnibar-detail {
          flex: 0 1 auto;
          max-width: 50%;
          margin-left: auto;
          overflow: hidden;
          color: var(--muted);
          font-size: 0.85em;
          text-align: right;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        #omnibar mark {
          background: transparent;
          color: var(--dark-solid);
          font-weight: 600;
        }

        #omnibar-status {
          padding: 0.35em 1.2em;
          border-top: 1px solid var(--line);
          color: var(--muted);
          font-size: 0.75em;
        }

        #omnibar-status:empty {
          display: none;
        }
      </style>

      <div class="omnibar-search">
        <span class="icon-search" aria-hidden="true"></span>
        <input
          id="omnibar-input"
          role="combobox"
          aria-label="Search map and commands"
          aria-expanded="true"
          aria-controls="omnibar-list"
          aria-autocomplete="list"
          autocomplete="off"
          spellcheck="false"
          placeholder="Search map and commands"
        >
        <span class="omnibar-escape" aria-hidden="true">esc</span>
      </div>

      <div id="omnibar-list" role="listbox" aria-label="Search results"></div>
      <div id="omnibar-status" role="status" aria-live="polite"></div>
    `;

    document.body.append(root);
    this.root = root;
    this.input = root.querySelector<HTMLInputElement>("input")!;
    this.list = root.querySelector<HTMLDivElement>("#omnibar-list")!;
    this.status = root.querySelector<HTMLDivElement>("#omnibar-status")!;

    this.input.addEventListener("input", () => this.search());
    this.list.addEventListener("mousedown", event => event.preventDefault());
    this.list.addEventListener("click", event => {
      const row = (event.target as Element).closest<HTMLElement>("[data-index]");
      if (row) void this.activate(Number(row.dataset.index));
    });
  }

  private renderResults(query: string): void {
    if (!this.list || !this.status) return;

    const unavailable = this.getMapActionUnavailable();
    this.list.replaceChildren();
    this.results.forEach((result, index) => {
      const row = document.createElement("div");
      row.id = `omnibar-result-${index}`;
      row.dataset.index = String(index);
      row.setAttribute("role", "option");
      row.setAttribute("aria-disabled", String(Boolean(unavailable)));

      const prefix = document.createElement("span");
      prefix.className = "omnibar-icon";
      if (result.kind === "command") {
        prefix.textContent = ">"; // commands are marked, entities carry a type icon
      } else prefix.classList.add(result.kind === "label" ? "icon-font" : result.display.icon);
      prefix.setAttribute("aria-hidden", "true");

      const title = document.createElement("span");
      title.className = "omnibar-name";
      this.highlight(title, result.name, query);

      const detail = document.createElement("span");
      detail.className = "omnibar-detail";
      const layer = result.kind === "command" ? result.command.layer : undefined;
      detail.textContent =
        unavailable || `${result.context}${layer ? ` · ${Layers.isOn(layer) ? "Visible" : "Hidden"}` : ""}`;
      row.append(prefix, title, detail);

      const note = result.kind === "entity" ? result.fields : undefined;
      const previewNote = result.kind === "entity" && result.display.previewNote;
      if (note?.note && (previewNote || (query && note.normalizedNote?.includes(query)))) {
        const snippet = document.createElement("span");
        const start = previewNote ? 0 : Math.max(0, (note.normalizedNote || "").indexOf(query) - 35);
        this.highlight(snippet, `${start ? "…" : ""}${note.note.slice(start, start + 60)}`, query);
        detail.append(" · ", snippet);
      }

      row.title = `${result.name} · ${detail.textContent}`;
      this.list!.append(row);
    });

    this.status.textContent = this.results.length
      ? `${this.results.length} results · ↑↓ navigate · ↵ select`
      : query
        ? "No matches"
        : "";
    this.select(this.selected);
  }

  private highlight(element: HTMLElement, text: string, query: string): void {
    const letters = Array.from(text);
    const normalized = letters.map(letter => letter.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase());
    const owners = normalized.flatMap((letter, index) => Array(letter.length).fill(index) as number[]);
    const haystack = normalized.join("");
    const matches = new Set<number>();

    for (const word of query.split(" ").filter(Boolean)) {
      let start = haystack.indexOf(word);
      while (start !== -1) {
        for (let i = start; i < start + word.length; i++) matches.add(owners[i]);
        start = haystack.indexOf(word, start + word.length);
      }
    }

    letters.forEach((letter, index) => {
      if (!matches.has(index)) {
        element.append(letter);
        return;
      }
      const mark = document.createElement("mark");
      mark.textContent = letter;
      element.append(mark);
    });
  }

  private select(index: number): void {
    this.selected = index;
    this.list?.querySelectorAll<HTMLElement>("[role='option']").forEach((row, i) => {
      row.setAttribute("aria-selected", String(i === index));
    });
    const row = this.list?.children[index] as HTMLElement | undefined;
    if (row) {
      this.input?.setAttribute("aria-activedescendant", row.id);
      row.scrollIntoView({ block: "nearest" });
    } else this.input?.removeAttribute("aria-activedescendant");
  }

  private listen(): void {
    if (this.events) return;

    this.events = new AbortController();
    const options = { capture: true, signal: this.events.signal };

    window.addEventListener(
      "keydown",
      event => {
        if (!this.root) return;
        if (event.code === "Space" && !this.input?.value) {
          // a leading space is meaningless; also keeps a still-held opening Space out of the input
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        this.keys.add(event.code);
        event.stopImmediatePropagation();
        if (event.isComposing) return;
        if (["Escape", "Enter", "ArrowDown", "ArrowUp", "Tab"].includes(event.key)) event.preventDefault();
        if (event.key === "Escape") this.close();
        else if (event.key === "Enter" && !event.repeat) void this.activate(this.selected);
        else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const count = this.results.length;
          if (count) this.select((this.selected + (event.key === "ArrowDown" ? 1 : -1) + count) % count);
        } else if (event.key === "Tab") this.input?.focus();
      },
      options
    );

    window.addEventListener(
      "keyup",
      event => {
        if (this.root || this.keys.has(event.code)) {
          event.stopImmediatePropagation();
          event.preventDefault();
        }
        this.keys.delete(event.code);
        this.cleanup();
      },
      options
    );

    window.addEventListener(
      "pointerdown",
      event => {
        if (this.root && !this.root.contains(event.target as Node)) this.close();
      },
      options
    );

    window.addEventListener(
      "blur",
      () => {
        this.keys.clear();
        this.close();
      },
      { signal: this.events.signal }
    );

    // a generated, loaded or transformed map recycles ids, so the records must come from the map on screen now
    window.addEventListener(
      "map:generated",
      () => {
        console.log("map:generated");
        if (!this.root) return;
        this.generation = mapGeneration;
        this.records = this.collect();
        this.search();
        this.report("The map changed. Select a current result.");
      },
      { signal: this.events.signal }
    );
  }

  /** Close the palette, restoring the focus it took when asked to */
  close(): void {
    this.dismiss(true);
  }

  private dismiss(restore: boolean): void {
    this.root?.remove();
    this.root = this.input = this.list = this.status = undefined;
    this.records = this.results = [];
    if (restore && this.previousFocus?.isConnected) this.previousFocus.focus();
    this.previousFocus = undefined;
    this.cleanup();
  }

  private cleanup(): void {
    if (this.root || this.keys.size) return;
    this.events?.abort();
    this.events = undefined;
  }

  private async activate(index: number): Promise<void> {
    const result = this.results[index];
    if (!result || this.busy) return;
    if (this.unavailable()) return;

    if (result.kind !== "command" && !this.current(result)) {
      this.records = this.collect();
      this.search();
      this.report("The map changed. Select a current result.");
      return;
    }

    this.busy = true;
    this.dismiss(false);

    try {
      if (result.kind === "command") {
        await result.command.run();
        this.remember(result.id);
      } else if (result.kind === "label") {
        this.navigate(result.target, { label: result.label });
      } else if (!MapEntities.open(result.target.ref)) {
        this.navigate(result.target, { display: result.display }); // the entity has no editor, so reveal it instead
      }
    } catch {
      tip("Could not open the search result. Please try again.", false, "error");
    } finally {
      this.busy = false;
    }
  }

  private current(result: EntityResult | LabelResult): boolean {
    if (this.generation !== mapGeneration) return false;
    return MapEntities.get(result.target.ref) === result.target.entity;
  }

  private report(message: string, type?: "warn" | "error"): void {
    if (type) tip(message, false, type, 4000);
    else if (this.status) this.status.textContent = message;
  }

  /** Report why the current map cannot run a search action; true while it cannot */
  private unavailable(): boolean {
    const reason = this.getMapActionUnavailable();
    if (!reason) return false;
    this.report(reason);
    return true;
  }

  private readHistory(): string[] {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      const commands = new Set(this.records.filter(result => result.kind === "command").map(result => result.id));
      return Array.isArray(stored)
        ? [...new Set(stored.filter((id): id is string => typeof id === "string" && commands.has(id)))].slice(
            0,
            HISTORY_LIMIT
          )
        : [];
    } catch {
      return [];
    }
  }

  private remember(id: string): void {
    this.history = [id, ...this.history.filter(previous => previous !== id)].slice(0, HISTORY_LIMIT);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
    } catch {
      /* Storage is optional. */
    }
  }

  private getMapActionUnavailable(): string {
    if (typeof pack === "undefined" || !pack.cells?.i?.length) return "Generate or load a map first";
    if (typeof customization !== "undefined" && customization) return "Exit customization mode first";
    if (document.getElementById("canvas3d")) return "Switch to the 2D map first";
    return "";
  }
}

export const Omnibar = new OmnibarController();
