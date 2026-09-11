import type { LayerId } from "@/components/layers";
import { Layers } from "@/components/layers";
import { MAP_COMMANDS, type MapCommand } from "@/components/map-commands";
import { ENTITY_TYPES, type EntityDisplay, type EntityTarget, MapEntities } from "@/components/map-entities";
import { tip } from "@/components/tooltips";
import { viewport } from "@/components/viewport";
import { zoomTo } from "@/components/zoom";
import { getLabelsIndex, type LabelIndexEntry } from "@/renderers/labels/label-data";
import { highlightArea, highlightElement } from "@/renderers/overlays/highlight";
import { MAX_QUESTION } from "@/services/agent/contract";
import { mapId, resetMapContext, selectEntity } from "@/services/agent/map-tools";
import type { Point } from "@/types/global";
import { findEl } from "@/utils";

interface SearchFields {
  name: string;
  alias: string; // the name with its context, an ordering tier below the name itself
  note?: string;
  normalizedNote?: string;
  unnamed?: boolean; // titled by its kind only: found through its context and note, ranked last
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
  label: LabelIndexEntry;
}

interface AssistantResult extends BaseResult {
  kind: "assistant";
  question: string;
}

type Result = CommandResult | EntityResult | LabelResult | AssistantResult;

export interface OmnibarOptions {
  assistant?: boolean;
}

/** A record matched by one query, kept together with the score the sort uses */
interface Scored {
  result: Result;
  score: number;
  order: number;
}

const HISTORY_KEY = "fmg-omnibar-history";
const HISTORY_LIMIT = 10;
const RESULT_LIMIT = 50;
const SNIPPET_LENGTH = 60;
const NOTE_SCORE = 100; // the tier below any name or context match; an unnamed entity never scores above it

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
  private matched = 0; // results found by the query, before the cap
  private history: string[] = [];
  private selected = -1;
  private busy = false;
  private panel?: typeof import("./help-assistant-map");
  private loading?: Promise<void>;
  private assistantHost?: HTMLElement;
  private showingAssistant = false;

  open(options: OmnibarOptions = {}): void | Promise<void> {
    if (this.root && !this.root.isConnected) {
      this.panel?.unmountMapPanel();
      this.events?.abort();
      this.events = undefined;
      this.root = undefined;
      this.assistantHost = undefined;
    }
    if (!this.root) {
      if (this.busy) return;
      this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
      this.history = this.readHistory();
      this.render();
      this.listen();
    }
    if (this.root!.hidden)
      this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.root!.hidden = false;
    if (options.assistant) return this.showAssistant();
    this.showSearch();
  }

  private showSearch(): void {
    this.showingAssistant = false;
    this.markAssistant();
    this.root?.classList.remove("omnibar-expanded");
    if (this.assistantHost) this.assistantHost.hidden = true;
    for (const el of this.root?.querySelectorAll<HTMLElement>(
      ".omnibar-search, #omnibar-list, #omnibar-status, .omnibar-actions"
    ) ?? [])
      el.hidden = false;
    this.records = this.collect();
    if (this.input) this.input.value = "";
    this.search();
    this.input?.focus();
  }

  private async showAssistant(question?: string, target?: EntityTarget): Promise<void> {
    const root = this.root;
    if (!root) return;
    const taskMapId = mapId();
    this.showingAssistant = true;
    this.markAssistant();
    root.classList.add("omnibar-expanded");
    root.querySelector<HTMLElement>("#omnibar-loading")!.hidden = Boolean(this.assistantHost);
    for (const el of root.querySelectorAll<HTMLElement>(
      ".omnibar-search, #omnibar-list, #omnibar-status, .omnibar-actions"
    ))
      el.hidden = true;
    if (!this.assistantHost && !this.loading) {
      this.loading = (async () => {
        const [panel, { ASSISTANT_STYLES }] = await Promise.all([
          import("./help-assistant-map"),
          import("./help-assistant-styles")
        ]);
        if (this.root !== root || !root.isConnected) return;
        this.panel = panel;
        const host = document.createElement("section");
        host.id = "helpAssistant";
        host.setAttribute("aria-label", "Azgaar Assistant");
        host.innerHTML = `${ASSISTANT_STYLES}<div class="omnibar-chat-header">
          <button type="button" data-chat="search">← Search</button><strong>Azgaar Assistant</strong>
          <button type="button" data-chat="new">New chat</button><button type="button" data-chat="close" aria-label="Close assistant">×</button>
        </div><div id="helpAssistantMap" class="helpAssistantPanel"></div>`;
        root.append(host);
        this.assistantHost = host;
        host.querySelector<HTMLButtonElement>('[data-chat="search"]')!.onclick = () => this.showSearch();
        host.querySelector<HTMLButtonElement>('[data-chat="new"]')!.onclick = () => panel.newMapConversation();
        host.querySelector<HTMLButtonElement>('[data-chat="close"]')!.onclick = () => this.close();
        panel.mountMapPanel(host.querySelector<HTMLElement>("#helpAssistantMap")!);
      })();
    }
    const loading = this.loading;
    try {
      await loading;
      if (this.root !== root || !this.assistantHost) return;
      this.assistantHost.hidden = !this.showingAssistant;
      if ((question || target) && mapId() !== taskMapId) {
        this.report("The map changed. Select a current result and ask again.", "warn");
        this.showSearch();
        return;
      }
      if (target) {
        if (MapEntities.get(target.ref) !== target.entity) {
          this.report("The map changed. Select a current result.", "warn");
          this.showSearch();
          return;
        }
        selectEntity(target.ref);
      }
      this.panel!.refreshMapContext();
      if (question) {
        const input = this.assistantHost.querySelector<HTMLTextAreaElement>("#helpMapInput")!;
        input.value = question;
        input.dispatchEvent(new Event("input"));
        void this.panel!.send();
      }
    } catch {
      if (this.root === root) {
        this.showSearch();
        this.report("Could not load the assistant. Please try again.", "error");
      }
    } finally {
      if (this.loading === loading) this.loading = undefined;
      root.querySelector<HTMLElement>("#omnibar-loading")!.hidden = true;
    }
  }

  /** Close the palette, restoring the focus it took when asked to */
  close(): void {
    this.dismiss(true);
  }

  private markAssistant(): void {
    const open = Boolean(this.showingAssistant && this.root && !this.root.hidden);
    const bubble = document.getElementById("helpAssistantBubble");
    bubble?.classList.toggle("open", open);
    bubble?.setAttribute("aria-expanded", String(open));
  }

  private collect(): Result[] {
    const commands: CommandResult[] = MAP_COMMANDS.map(command => ({
      kind: "command",
      id: command.id,
      name: command.name,
      context: "Command",
      fields: { name: normalize(command.name), alias: normalize(command.aliases) },
      command
    }));
    if (typeof pack === "undefined" || !pack.cells?.i?.length) return commands;

    const entities = new Map<string, Result>();
    for (const type of ENTITY_TYPES) {
      for (const target of MapEntities.collect(type, { located: true })) {
        const { ref, entity } = target;
        const key = MapEntities.key(ref);
        const display = MapEntities.getDisplay(ref);
        const name = MapEntities.getName(ref) || entity.name || "";
        const context = [display.kind, MapEntities.getContext(ref)].filter(Boolean).join(" · ");
        const alias = name ? `${entity.name || name} ${context}` : context;
        entities.set(key, {
          kind: "entity",
          id: `entity:${key}`,
          name: name || display.kind,
          context,
          fields: { ...this.fields({ name, alias, note: entity.note }), unnamed: !name },
          target,
          display
        });
      }
    }

    // entity labels are listed apart from their owners
    for (const label of getLabelsIndex()) {
      if (!label.text) continue;
      const type = label.type === "added" ? "addedLabel" : label.type;
      const owner = entities.get(MapEntities.key({ type, id: label.entityId }));
      if (owner?.kind !== "entity" || label.type === "added") continue; // an added label is its own entity
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
    const text = plainText(note || "");
    return {
      name: normalize(name),
      alias: normalize(alias),
      note: text,
      normalizedNote: text ? normalize(text) : undefined
    };
  }

  private readHistory(): string[] {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      const commands = new Set(MAP_COMMANDS.map(command => command.id));
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

  private render(): void {
    const root = document.createElement("div");
    root.id = "omnibar";
    root.className = "ui-front";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Search map and commands");

    root.innerHTML = /* html */ `
      <style>
        #omnibar[hidden], #omnibar [hidden] { display: none !important; }
        #omnibar.omnibar-expanded { width: min(720px, calc(100vw - 24px)); }
        #omnibar #helpAssistant { height: min(740px, calc(100dvh - 48px)); box-sizing: border-box; }
        #omnibar .omnibar-chat-header, #omnibar .omnibar-actions { display: flex; align-items: center; gap: 8px; padding: 8px; flex-wrap: wrap; }
        #omnibar .omnibar-chat-header strong { flex: 1; }
        #omnibar .omnibar-chat-header button, #omnibar .omnibar-actions button { font: inherit; min-height: 36px; padding: 4px 10px; }
        #omnibar-loading { padding: 20px; }
        #omnibar .omnibar-actions { border-top: 1px solid #ddd; }
        body:has(#omnibar:not([hidden])) > .ui-dialog:has(> #helpMapNotePreview, > #alert) { z-index: 100002 !important; }
        body:has(#omnibar:not([hidden])) > .ui-widget-overlay { z-index: 100001 !important; }

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
          font: 16px/1.4 var(--sans-serif);
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
          placeholder="Search the map, run a command, or ask a question…"
        >
        <span class="omnibar-escape" aria-hidden="true">esc</span>
      </div>

      <div id="omnibar-loading" role="status" hidden>Opening assistant…</div>
      <div id="omnibar-list" role="listbox" aria-label="Search results"></div>
      <div id="omnibar-status" role="status" aria-live="polite"></div>
      <div class="omnibar-actions"><button type="button" id="omnibar-assistant">Assistant</button>
        <button type="button" id="omnibar-ask-target" hidden>Ask about this</button></div>
    `;

    root.addEventListener("keydown", event => event.stopPropagation());
    document.body.append(root);
    this.root = root;
    this.input = root.querySelector<HTMLInputElement>("input")!;
    this.list = root.querySelector<HTMLDivElement>("#omnibar-list")!;
    this.status = root.querySelector<HTMLDivElement>("#omnibar-status")!;

    root.querySelector<HTMLButtonElement>("#omnibar-assistant")!.onclick = () => void this.showAssistant();
    root.querySelector<HTMLButtonElement>("#omnibar-ask-target")!.onclick = () => {
      const result = this.results[this.selected];
      if (result?.kind === "entity" || result?.kind === "label") void this.showAssistant(undefined, result.target);
    };
    this.input.addEventListener("input", () => this.search());
    this.list.addEventListener("mousedown", event => event.preventDefault());
    this.list.addEventListener("click", event => {
      const row = (event.target as Element).closest<HTMLElement>("[data-index]");
      if (row) void this.activate(Number(row.dataset.index));
    });
  }

  private listen(): void {
    if (this.events) return;

    this.events = new AbortController();
    const options = { capture: true, signal: this.events.signal };

    window.addEventListener(
      "keydown",
      event => {
        if (!this.root || this.root.hidden) return;
        if (!(event.target instanceof Node && this.root.contains(event.target))) return;
        if (event.key === "Tab") {
          const controls = [
            ...this.root.querySelectorAll<HTMLElement>(":is(button, input, select, textarea, a[href]):not(:disabled)")
          ].filter(el => !el.closest("[hidden]"));
          const edge = event.shiftKey ? controls[0] : controls.at(-1);
          if (document.activeElement === edge) {
            event.preventDefault();
            (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
          }
        }
        if (this.showingAssistant) {
          this.keys.add(event.code);
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopImmediatePropagation();
            this.close();
          }
          // Let editor controls handle typing, Enter and Tab; block only the map's bubbling hotkeys.
          return;
        }
        if (event.target === this.input && event.code === "Space" && !this.input?.value) {
          // a leading space is meaningless; also keeps a still-held opening Space out of the input
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        this.keys.add(event.code);
        event.stopImmediatePropagation();
        if (event.isComposing) return;
        if (event.target !== this.input) {
          if (event.key === "Escape") {
            event.preventDefault();
            this.close();
          }
          return;
        }
        if (["Escape", "Enter", "ArrowDown", "ArrowUp"].includes(event.key)) event.preventDefault();
        if (((event.ctrlKey || event.metaKey) && event.code === "KeyS") || /^F\d+$/.test(event.code))
          event.preventDefault(); // no browser save dialog or help page from behind the palette
        if (event.key === "Escape") this.close();
        else if (event.key === "Enter" && !event.repeat) void this.activate(this.selected);
        else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const count = this.results.length;
          if (count) this.select((this.selected + (event.key === "ArrowDown" ? 1 : -1) + count) % count);
        }
      },
      options
    );

    window.addEventListener(
      "keyup",
      event => {
        if (
          (this.root && !this.root.hidden && event.target instanceof Node && this.root.contains(event.target)) ||
          this.keys.has(event.code)
        ) {
          event.stopImmediatePropagation();
          event.preventDefault();
        }
        this.keys.delete(event.code);
        if (event.key === "Meta") this.keys.clear(); // macOS skips keyup for keys released under Cmd
        this.cleanup();
      },
      options
    );

    window.addEventListener(
      "pointerdown",
      event => {
        if (this.root && !this.root.hidden && !(event.target instanceof Node && this.root.contains(event.target))) {
          if ((event.target as Element).closest?.(".ui-dialog, .ui-widget-overlay")) return;
          this.close();
        }
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

    // a new map (generated, loaded or transformed) recycles ids, so recollect from the map on screen
    window.addEventListener(
      "map:generated",
      () => {
        resetMapContext();
        if (!this.root) return;
        if (this.assistantHost) {
          this.panel?.unmountMapPanel();
          this.panel?.mountMapPanel(this.assistantHost.querySelector<HTMLElement>("#helpAssistantMap")!);
          this.panel?.refreshMapContext();
        }
        this.records = this.collect();
        this.search();
        this.report("The map changed. Select a current result.");
      },
      { signal: this.events.signal }
    );
  }

  private search(): void {
    const value = this.input?.value.trim() || "";
    const commandsOnly = value.startsWith(">");
    const query = normalize(commandsOnly ? value.slice(1) : value);
    const searchable = !query || /[\p{L}\p{N}]/u.test(query); // a punctuation-only query matches nothing

    const scored = this.records
      .filter(result => !commandsOnly || result.kind === "command")
      .map(
        (result, order): Scored => ({
          result,
          order,
          score: searchable ? this.score(result, query, commandsOnly, this.history.indexOf(result.id)) : 0
        })
      )
      .filter(row => row.score > 0)
      .sort((a, b) => b.score - a.score || a.order - b.order);
    this.matched = scored.length;
    this.results = scored.slice(0, commandsOnly ? Infinity : RESULT_LIMIT).map(row => row.result); // a bare > lists every command

    if (!commandsOnly && query && searchable) {
      this.results.push({
        kind: "assistant",
        id: "ask-assistant",
        name: `Ask assistant: “${value}”`,
        question: value,
        context: "Assistant",
        fields: { name: "", alias: "" }
      });
    }
    this.selected = 0;
    this.renderResults(query);
  }

  /** Name matches, then alias and context matches, then note matches; recent commands lead an empty query */
  private score(result: Result, query: string, commandsOnly: boolean, recent: number): number {
    if (query) {
      const { fields } = result;
      const name = match(fields.name, query);
      const alias = match(fields.alias, query);
      const note = fields.normalizedNote?.includes(query) ? NOTE_SCORE : 0;
      const score = Math.max(name && name + 400, alias && alias + 200, note);
      return fields.unnamed ? Math.min(score, NOTE_SCORE) : score;
    }
    if (result.kind !== "command") return 0;
    if (recent >= 0) return 1000 - recent;
    return commandsOnly ? 1 : 0; // a bare > lists every command, with the recent ones first
  }

  private renderResults(query: string): void {
    if (!this.list || !this.status) return;

    this.list.replaceChildren();
    this.results.forEach((result, index) => {
      const unavailable =
        result.kind === "assistant"
          ? result.question.length > MAX_QUESTION
            ? `Use at most ${MAX_QUESTION} characters`
            : ""
          : getMapActionUnavailable();
      const row = document.createElement("div");
      row.id = `omnibar-result-${index}`;
      row.dataset.index = String(index);
      row.dataset.kind = result.kind;
      row.setAttribute("role", "option");
      row.setAttribute("aria-disabled", String(Boolean(unavailable)));

      const prefix = document.createElement("span");
      prefix.className = "omnibar-icon";
      if (result.kind === "command") {
        prefix.textContent = ">"; // commands are marked, entities carry a type icon
      } else
        prefix.classList.add(
          result.kind === "assistant" ? "icon-comment" : result.kind === "label" ? "icon-font" : result.display.icon
        );
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
        this.highlight(snippet, excerpt(note.note, previewNote ? "" : query), query);
        detail.append(" · ", snippet);
      }

      row.title = `${result.name} · ${detail.textContent}`;
      this.list!.append(row);
    });

    const localCount = this.results.filter(r => r.kind !== "assistant").length;
    const count = this.matched > localCount ? `${localCount} of ${this.matched}` : localCount;
    this.status.textContent = this.results.length
      ? `${count} local results · ↑↓ navigate · ↵ select`
      : query
        ? "No matches"
        : "";
    this.select(this.selected);
  }

  private highlight(element: HTMLElement, text: string, query: string): void {
    const { letters, haystack, owners } = letterIndex(text);
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
    const result = this.results[index];
    const ask = this.root?.querySelector<HTMLButtonElement>("#omnibar-ask-target");
    if (ask) {
      ask.hidden = result?.kind !== "entity" && result?.kind !== "label";
      ask.disabled = Boolean(getMapActionUnavailable());
      ask.textContent = result ? `Ask about ${result.name}` : "Ask about this";
    }
    const row = this.list?.children[index] as HTMLElement | undefined;
    if (row) {
      this.input?.setAttribute("aria-activedescendant", row.id);
      row.scrollIntoView({ block: "nearest" });
    } else this.input?.removeAttribute("aria-activedescendant");
  }

  private async activate(index: number): Promise<void> {
    const result = this.results[index];
    if (!result || this.busy) return;
    if (result.kind === "assistant") {
      if (this.showingAssistant) return;
      if (result.question.length <= MAX_QUESTION) await this.showAssistant(result.question);
      return;
    }
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
      } else {
        const opened = MapEntities.open(result.target.ref);
        if (opened) await opened;
        else this.navigate(result.target, { display: result.display }); // the entity has no editor, so reveal it instead
      }
    } catch {
      tip("Could not open the search result. Please try again.", false, "error");
    } finally {
      this.busy = false;
    }
  }

  /** A new map builds fresh entity objects, so identity tells a live record from a stale one */
  private current(result: EntityResult | LabelResult): boolean {
    return MapEntities.get(result.target.ref) === result.target.entity;
  }

  private navigate(
    target: EntityTarget,
    { label, display }: { label?: LabelIndexEntry; display?: EntityDisplay } = {}
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
    // the outline animates in while the view is still moving; a culled element (a river, a label) is not drawn yet,
    // so its own geometry stands in for it
    setTimeout(() => {
      const elementId = label ? label.id : MapEntities.getElementId(target.ref);
      const element = label
        ? findEl(label.id)
        : (display?.highlight && document.querySelector(display.highlight)) || (elementId ? findEl(elementId) : null);
      if (element) highlightElement(element);
      else highlightArea({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
    }, 750);
  }

  private remember(id: string): void {
    this.history = [id, ...this.history.filter(previous => previous !== id)].slice(0, HISTORY_LIMIT);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
    } catch {
      /* Storage is optional. */
    }
  }

  private report(message: string, type?: "warn" | "error"): void {
    if (type) tip(message, false, type, 4000);
    else if (this.status) this.status.textContent = message;
  }

  /** Report why the current map cannot run a search action; true while it cannot */
  private unavailable(): boolean {
    const reason = getMapActionUnavailable();
    if (!reason) return false;
    this.report(reason);
    return true;
  }

  private dismiss(restore: boolean): void {
    if (this.assistantHost && this.root) {
      this.root.hidden = true;
      this.markAssistant();
      if (restore && this.previousFocus?.isConnected) this.previousFocus.focus();
      return;
    }
    this.loading = undefined;
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
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Letters of a text with their normalized, searchable form and which letter each normalized character came from */
function letterIndex(text: string): { letters: string[]; haystack: string; owners: number[] } {
  const letters = Array.from(text);
  const normalized = letters.map(letter => letter.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase());
  const owners = normalized.flatMap((letter, index) => Array(letter.length).fill(index) as number[]);
  return { letters, haystack: normalized.join(""), owners };
}

/** A short run of the note around the first match, or its beginning: sliced by letter, so accents stay whole */
function excerpt(note: string, query: string): string {
  const { letters, haystack, owners } = letterIndex(note);
  const at = query ? haystack.indexOf(query) : -1;
  const start = at === -1 ? 0 : Math.max(0, owners[at] - 35);
  return `${start ? "…" : ""}${letters.slice(start, start + SNIPPET_LENGTH).join("")}`;
}

function plainText(html: string): string {
  if (!html) return ""; // most entities carry no note, and parsing each of them is the expensive part
  textTemplate.innerHTML = html;
  for (const node of textTemplate.content.querySelectorAll("script, style")) node.remove();
  for (const node of textTemplate.content.querySelectorAll("br, p, div, li")) node.append(" ");
  const text = textTemplate.content.textContent || "";
  textTemplate.innerHTML = "";
  return text.replace(/\s+/g, " ").trim();
}

function match(text: string, query: string): number {
  if (text === query) return 1000;
  if (text.startsWith(query)) return 850;
  if (text.includes(query)) return 700;

  const words = query.split(" ");
  return words.length > 1 && words.every(word => text.includes(word)) ? 600 : 0;
}

function getMapActionUnavailable(): string {
  if (typeof pack === "undefined" || !pack.cells?.i?.length) return "Generate or load a map first";
  if (typeof customization !== "undefined" && customization) return "Exit customization mode first";
  if (document.getElementById("canvas3d")) return "Switch to the 2D map first";
  return "";
}

export const Omnibar = new OmnibarController();
