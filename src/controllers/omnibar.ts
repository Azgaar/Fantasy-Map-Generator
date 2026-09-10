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

interface Result {
  id: string;
  name: string;
  context: string;
  names: string[];
  note: string;
  normalizedNote?: string;
  icon: string;
  command?: MapCommand;
  target?: EntityTarget;
  display?: EntityDisplay;
  label?: LabelData; // navigate to the label text rather than to the entity itself
}

class OmnibarController {
  private readonly config = {
    historyKey: "fmg-omnibar-history",
    historyLimit: 10,
    resultLimit: 50
  };

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
  private map?: typeof pack;
  private cells?: typeof pack.cells;
  private busy = false;

  open(): void {
    if (this.root) return void this.input?.focus();
    if (this.busy) return;

    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.map = pack;
    this.cells = this.map?.cells;
    this.records = this.collect();
    this.history = this.readHistory();

    this.render();
    this.listen();
    this.search();
    this.input?.focus();
  }

  private collect(): Result[] {
    const records: Result[] = MAP_COMMANDS.map(command => ({
      id: command.id,
      name: command.name,
      context: "Command",
      names: [this.normalize(command.name), this.normalize(command.aliases)],
      note: "",
      icon: "",
      command
    }));
    if (!this.map) return records;

    const entities = new Map<string, Result>();
    for (const type of ENTITY_TYPES) {
      for (const target of MapEntities.collect(type)) {
        const { ref, entity } = target;
        const key = MapEntities.key(ref);
        const display = MapEntities.getDisplay(ref);
        const name = MapEntities.getName(ref) || entity.name || display.kind;
        const context = [display.kind, MapEntities.getContext(ref)].filter(Boolean).join(" · ");
        const alias = entity.name || name;
        const result = { id: `entity:${key}`, name, context, icon: display.icon, target, display };
        entities.set(key, this.entityResult(result, alias));
      }
    }

    // labels are listed apart from their owners; an added label is its own entity, so it just gets the label data
    for (const label of getLabelsData()) {
      if (!label.text) continue;
      const type = label.type === "added" ? "addedLabel" : label.type;
      const owner = entities.get(MapEntities.key({ type, id: label.entityId }));
      if (!owner) continue;
      if (label.type === "added") {
        owner.label = label;
        continue;
      }
      const id = `label:${label.id}`;
      const name = label.text.replaceAll("|", " ");
      const { context, target } = owner;
      const result = { id, name, context: `Label · ${context}`, icon: "icon-font", target, label };
      entities.set(id, this.entityResult(result));
    }
    return [...records, ...entities.values()];
  }

  private entityResult(result: Omit<Result, "names" | "note">, alias = result.name): Result {
    const note = this.plainText(result.target!.entity.note || "");
    const names = [this.normalize(result.name), this.normalize(`${alias} ${result.context}`)];
    return { ...result, names, note, normalizedNote: this.normalize(note) };
  }

  private navigate(result: Result): void {
    const { target, display, label } = result;
    const ref = target!.ref;
    const layers: LayerId[] = label ? ["labels"] : display?.layers || [];
    const points = label
      ? [[label.anchor[0] + (label.dx || 0), label.anchor[1] + (label.dy || 0)] as Point]
      : MapEntities.getPoints(ref);
    if (!points.length) return void tip("This element has no map location", false, "warn", 4000);

    Layers.show(...layers);
    const group = label && options.map.labels.groups.find(group => group.name === label.group);
    if (group?.layerDependency && Layers.has(group.layerDependency)) Layers.show(group.layerDependency);

    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]; // a loop: a territory can have too many cells to spread
    for (const [x, y] of points)
      [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    const fit = Math.min(
      label ? 8 : display!.scale,
      (viewport.width * 0.65) / Math.max(1, x1 - x0),
      (viewport.height * 0.65) / Math.max(1, y1 - y0)
    );
    let scale = Math.max(1, fit);
    if (group) scale = Math.max(group.zoom.min ?? 1, Math.min(group.zoom.max ?? 20, scale));

    zoomTo((x0 + x1) / 2, (y0 + y1) / 2, scale, 1500, () => {
      const elementId = MapEntities.getElementId(ref);
      const element = label
        ? findEl(label.id)
        : (display?.highlight && document.querySelector(display.highlight)) || (elementId ? findEl(elementId) : null);
      if (element) highlightElement(element);
    });
  }

  private plainText(html: string): string {
    const template = document.createElement("template");
    template.innerHTML = html;
    for (const node of template.content.querySelectorAll("script, style")) node.remove();
    for (const node of template.content.querySelectorAll("br, p, div, li")) node.append(" ");
    return (template.content.textContent || "").replace(/\s+/g, " ").trim();
  }

  private normalize(text: string): string {
    return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  private match(text: string, query: string): number {
    if (!/[\p{L}\p{N}]/u.test(query)) return 0;
    if (text === query) return 1000;
    if (text.startsWith(query)) return 850;
    if (text.includes(query)) return 700;

    const words = query.split(" ");
    return words.length > 1 && words.every(word => text.includes(word)) ? 600 : 0;
  }

  private search(): void {
    const value = this.input?.value.trim() || "";
    const commandsOnly = value.startsWith(">");
    const query = this.normalize(commandsOnly ? value.slice(1) : value);

    this.results = this.records
      .filter(result => !commandsOnly || result.command)
      .map((result, order) => {
        const recent = this.history.indexOf(result.id);
        const nameScore = Math.max(...result.names.map(name => this.match(name, query)));
        const noteScore = /[\p{L}\p{N}]/u.test(query) && result.normalizedNote?.includes(query) ? 100 : 0;
        const score = query
          ? Math.max(nameScore ? nameScore + 200 : 0, noteScore)
          : result.command && (commandsOnly || recent >= 0)
            ? 1000 - (recent < 0 ? this.history.length : recent)
            : 0;
        return { result, score, order };
      })
      .filter(row => row.score > 0)
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .slice(0, this.config.resultLimit)
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
          position: fixed;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          width: min(620px, calc(100vw - 24px));
          z-index: 100000;
          box-sizing: border-box;
          overflow: hidden;
          background: rgb(255 255 255 / 97%);
          color: #30343b;
          border: 1px solid #00000014;
          border-radius: 6px;
          box-shadow: 0 4px 18px #00000014;
          font: 14px var(--sans-serif);
        }

        #omnibar .omnibar-search {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 12px;
        }

        #omnibar .omnibar-search > .icon-search {
          color: #858a91;
          font-size: 14px;
        }

        #omnibar input {
          box-sizing: border-box;
          flex: 1;
          min-width: 0;
          height: 42px;
          margin: 0;
          padding: 0;
          border: 0;
          border-radius: 0;
          outline: none;
          box-shadow: none;
          background: transparent;
          color: inherit;
          caret-color: var(--dark-solid, #555);
          font: inherit;
        }

        #omnibar input::placeholder {
          color: #7b8087;
        }

        #omnibar .omnibar-escape {
          color: #858a91;
          font-size: 10px;
        }

        #omnibar-list {
          max-height: min(360px, 50vh);
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-width: thin;
          scrollbar-color: #00000026 transparent;
        }

        #omnibar-list:not(:empty) {
          padding: 4px;
          border-top: 1px solid #0000000c;
        }

        #omnibar [role="option"] {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
          padding: 6px 8px;
          border-radius: 3px;
          line-height: 1.4;
          cursor: pointer;
        }

        #omnibar [role="option"]:hover {
          background: #00000004;
        }

        #omnibar [role="option"][aria-selected="true"] {
          background: color-mix(in srgb, var(--dark-solid, #555) 9%, transparent);
        }

        #omnibar [aria-disabled="true"] {
          color: #858a91;
          cursor: default;
        }

        #omnibar .omnibar-icon {
          flex: 0 0 18px;
          color: #858a91;
          font-size: 13px;
          text-align: center;
        }

        #omnibar [aria-selected="true"] .omnibar-icon {
          color: var(--dark-solid, #555);
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
          color: #737982;
          font-size: 11px;
          text-align: right;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        #omnibar mark {
          background: transparent;
          color: inherit;
          font-weight: 600;
        }

        #omnibar-status {
          padding: 6px 12px;
          border-top: 1px solid #00000008;
          color: #737982;
          font-size: 10px;
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
      prefix.className = `omnibar-icon ${result.icon}`;
      if (result.command) prefix.textContent = ">";
      prefix.setAttribute("aria-hidden", "true");

      const title = document.createElement("span");
      title.className = "omnibar-name";
      this.highlight(title, result.name, query);

      const detail = document.createElement("span");
      detail.className = "omnibar-detail";
      const layer = result.command?.layer;
      detail.textContent =
        unavailable || `${result.context}${layer ? ` · ${Layers.isOn(layer) ? "Visible" : "Hidden"}` : ""}`;
      row.append(prefix, title, detail);

      const previewNote = result.display?.previewNote;
      if (result.note && (previewNote || (query && result.normalizedNote?.includes(query)))) {
        const snippet = document.createElement("span");
        const start = previewNote ? 0 : Math.max(0, (result.normalizedNote || "").indexOf(query) - 35);
        this.highlight(snippet, `${start ? "…" : ""}${result.note.slice(start, start + 60)}`, query);
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
        if (event.key === "Escape") this.dismiss(true);
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
        if (this.root && !this.root.contains(event.target as Node)) this.dismiss(true);
      },
      options
    );

    window.addEventListener(
      "blur",
      () => {
        this.keys.clear();
        this.dismiss(true);
      },
      { signal: this.events.signal }
    );
  }

  dismiss(restore: boolean): void {
    this.root?.remove();
    this.root = this.input = this.list = this.status = undefined;
    this.records = this.results = [];
    this.map = this.cells = undefined;
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
    const reason = this.getMapActionUnavailable();
    if (reason) {
      if (this.status) this.status.textContent = reason;
      return;
    }

    if (!result.command && !this.current(result)) {
      this.records = this.collect();
      this.map = pack;
      this.cells = pack.cells;
      this.search();
      if (this.status) this.status.textContent = "Map changed. Select a current result.";
      return;
    }

    this.busy = true;
    this.dismiss(false);

    try {
      if (result.command) {
        await result.command.run();
        this.remember(result.id);
      } else this.navigate(result);
    } catch {
      tip("Could not open the search result. Please try again.", false, "error");
    } finally {
      this.busy = false;
    }
  }

  private current(result: Result): boolean {
    if (this.map !== pack || this.cells !== pack.cells || !result.target) return false;
    return MapEntities.get(result.target.ref) === result.target.entity;
  }

  private readHistory(): string[] {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(this.config.historyKey) || "[]");
      const commands = new Set(this.records.filter(r => r.command).map(r => r.id));
      return Array.isArray(stored)
        ? [...new Set(stored.filter((id): id is string => typeof id === "string" && commands.has(id)))].slice(
            0,
            this.config.historyLimit
          )
        : [];
    } catch {
      return [];
    }
  }

  private remember(id: string): void {
    this.history = [id, ...this.history.filter(previous => previous !== id)].slice(0, this.config.historyLimit);
    try {
      localStorage.setItem(this.config.historyKey, JSON.stringify(this.history));
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
