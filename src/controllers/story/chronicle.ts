// The Chronicle: the map's events in order of time. A record is edited in the Chronicle Record Editor. See docs/prd/events.md#the-chronicle
import { pointer } from "d3";
import { Controllers } from "@/controllers";
import { Pack } from "@/model/graph/pack-generator";
import { Dates } from "@/model/story/dates";
import { Events, type EventType, isSided, type MapEvent } from "@/model/story/events";
import { Tags } from "@/model/tags";
import { Csv } from "@/services/io/csv";
import { Dialog } from "@/ui/dialog/dialog";
import { noteIcon } from "@/ui/dialog/dialog-helpers";
import { bindColumnSorting, sortDataByColumns } from "@/ui/dialog/sorting";
import { dialogState } from "@/ui/dialog/state";
import {
  type EditorColumn,
  getRowId,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/ui/dialog/table";
import { stopMapPlacement, toggleMapPlacement } from "@/ui/map/map-placement";
import { tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/node-utils";
import { rn } from "@/utils/number-utils";
import { escapeHtml } from "@/utils/string-utils";

const dialogId = "chronicle" as const;
const editorId = "chronicleRecordEditor";
const position = { my: "right top", at: "right-10 top+10", of: "svg" };

type Filters = { search: string; type: EventType | "all"; state: number | "all" };
export type Place = { cell: number; x: number; y: number };

const NO_FILTERS: Filters = { search: "", type: "all", state: "all" };
const TYPE_LABELS: Record<EventType, string> = {
  custom: t("Event"),
  war: t("War"),
  battle: t("Battle"),
  alliance: t("Alliance"),
  vassalage: t("Vassalage")
};

const NO_REPLAY = () => t("The battle was not played in the Battle Simulator: it has no replay");

const getStateNames = (event: MapEvent): string => Events.stateNames(Events.statesOf(event));

const columns: EditorColumn<MapEvent>[] = [
  { key: "start", label: t("Start"), width: "8em", sortBy: event => Dates.sortKey(event.start), defaultSort: "asc" },
  {
    key: "end",
    label: t("End"),
    width: "8em",
    sortBy: event => (event.end === undefined ? Number.MAX_SAFE_INTEGER : Dates.sortKey(event.end))
  },
  { key: "name", label: t("Event"), width: "17em", permanent: true, sortBy: event => event.name, sortType: "alpha" },
  { key: "type", label: t("Type"), width: "6em", sortBy: event => TYPE_LABELS[event.type], sortType: "alpha" },
  {
    key: "tags",
    label: t("Tags"),
    width: "9em",
    hidden: true,
    sortBy: event => Tags.format(event.tags),
    sortType: "alpha"
  },
  { key: "states", label: t("States"), width: "14em", hidden: true, sortBy: getStateNames, sortType: "alpha" },
  { key: "replay", width: "1.4em", permanent: true },
  { key: "note", width: "1.4em", permanent: true },
  { key: "edit", width: "1.4em", permanent: true },
  { key: "remove", width: "1.4em", permanent: true }
];

let filters: Filters;
const openedByList = new WeakMap<MapEvent[], Set<number>>(); // events opened to show their parts, while the app runs, per map
const closedWhileFiltered = new Set<number>(); // while a filter is on, the parents of a match are open unless closed by hand
let picking = false; // the map waits for a battle's place
let matched: Set<number> | null = null; // the events a filter or search finds; null: no filter
let shown: Set<number> | null = null; // and their parents

const table = initEditorTable<MapEvent>({
  dialogId,
  getData: () => sortDataByColumns(dialogId, getTopEvents(), columns),
  onUpdate: renderList
});

/** Open the Chronicle, on an event when one is given: its parents open and its record is edited */
function open(eventId?: number): void {
  if (options.app.mode) return;
  filters = { ...NO_FILTERS, ...dialogState.get(dialogId, "filters", (): Filters => ({ ...NO_FILTERS })) };
  const state = filters.state === "all" ? undefined : pack.states[filters.state];
  if (!state?.i || state.removed) filters.state = "all"; // remembered from another map
  if (!(filters.type in TYPE_LABELS)) filters.type = "all";
  const event = eventId === undefined ? undefined : Events.get(eventId);
  if (event && !matches(event)) filters = { ...NO_FILTERS }; // a filter must not hide the event asked for
  Dialog.closeAll(`#${dialogId}, .stable`);
  renderDialog();
  table.reset();
  if (event) reveal(event);

  Dialog.open(dialogId, { title: t("Chronicle"), position, onClose });
  if (event) void Controllers.ChronicleRecordEditor.open(event.i);
}

function renderDialog(): void {
  Dialog.destroy(dialogId);
  const html = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
      <style>
        #${dialogId} .states.muted > [data-col]:not([class*="icon-"]) { opacity: 0.55; }
        #${dialogId} [data-col="name"] > span:last-child { overflow: hidden; text-overflow: ellipsis; }
        #${dialogId} .chronicleToggle { flex: 0 0 1em; font-size: 0.8em; }
        #${dialogId} .ongoing { color: #777; font-style: italic; }
        #chronicleFilters { flex-direction: row; gap: 0.8em; }
        #chronicleFilters > label { grid-template-columns: auto 1fr; flex: 1; }
      </style>
      ${renderEditorHeader({ dialogId, columns })}
      <div id="chronicleBody" class="table"></div>
      <div id="chronicleFilters" class="editorFilters">
        <label data-tip="${t("Search by name or tag; # before a word searches tags alone")}">${t("Search")}: <input id="chronicleSearch" type="search" /></label>
        <label data-tip="${t("Show events of one type")}">${t("Type")}: <select id="chronicleType"><option value="all">${t("all")}</option>${typeOptions()}</select></label>
        <label data-tip="${t("Show one state's history")}">${t("State")}: <select id="chronicleState"><option value="all">${t("all")}</option>${stateOptions()}</select></label>
      </div>
      <div id="chronicleFooter" class="totalLine">
        <div data-tip="${t("Events shown, parts included")}">${t("Events")}:&nbsp;<span id="chronicleCount">0</span></div>
        <div data-tip="${t("Current year: set it in the Lore editor")}" style="margin-left: 12px">${t("Year")}:&nbsp;<span id="chronicleYear"></span></div>
      </div>
      <div class="editorToolbar">
        <button id="chronicleRefresh" data-tip="${t("Refresh")}" class="icon-cw"></button>
        <button id="chronicleAdd" data-tip="${t("Add an event of your own")}" class="icon-plus"></button>
        <button id="chronicleToggleAll" data-tip="${t("Open or close all events that have parts")}" class="icon-resize-vertical"></button>
        <button id="chronicleDownload" data-tip="${t("Save data as a CSV file")}" class="icon-download"></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  showFilters();
  bindColumnSorting(dialogId, table.reset);
  initColumnVisibility({ dialogId, columns, onUpdate: table.refresh });
  ensureEl("chronicleBody").addEventListener("click", onListClick);
  ensureEl("chronicleSearch").addEventListener("input", onFilterChange);
  ensureEl("chronicleType").addEventListener("change", onFilterChange);
  ensureEl("chronicleState").addEventListener("change", onFilterChange);
  ensureEl("chronicleRefresh").addEventListener("click", () => {
    table.refresh();
    if (findEl(editorId)) void Controllers.ChronicleRecordEditor.refresh();
  });
  ensureEl("chronicleAdd").addEventListener("click", add);
  ensureEl("chronicleToggleAll").addEventListener("click", toggleAll);
  ensureEl("chronicleDownload").addEventListener("click", download);
}

function showFilters(): void {
  ensureEl<HTMLInputElement>("chronicleSearch").value = filters.search;
  ensureEl<HTMLSelectElement>("chronicleType").value = filters.type;
  ensureEl<HTMLSelectElement>("chronicleState").value = String(filters.state);
}

function typeOptions(): string {
  return (Object.keys(TYPE_LABELS) as EventType[])
    .map(type => `<option value="${type}">${TYPE_LABELS[type]}</option>`)
    .join("");
}

/** State names as options of a select, in order of the alphabet */
function stateOptions(exclude: number[] = []): string {
  return pack.states
    .filter(state => state.i && !state.removed && !exclude.includes(state.i))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(state => `<option value="${state.i}">${escapeHtml(state.name)}</option>`)
    .join("");
}

// the list

function renderList(view: TableView<MapEvent>): void {
  const edited = getEditedId();
  const rows: string[] = [];
  const addRows = (event: MapEvent, depth: number) => {
    const hasParts = Events.parts(event.i, false).length > 0;
    const opened = hasParts && isOpen(event);
    rows.push(renderRow(event, depth, hasParts, opened, event.i === edited));
    if (opened) for (const part of sortDataByColumns(dialogId, getShownParts(event), columns)) addRows(part, depth + 1);
  };
  for (const event of view.rows) addRows(event, 0);
  ensureEl("chronicleBody").innerHTML = rows.join("");

  const total = Events.list().length;
  ensureEl("chronicleCount").textContent = t("{{shown}} of {{total}}", { shown: matched?.size ?? total, total });
  ensureEl("chronicleYear").textContent = Dates.format(Events.present());
  renderEditorPagination(ensureEl("chronicleFooter"), view, table.goto);
}

function renderRow(event: MapEvent, depth: number, hasParts: boolean, opened: boolean, edited: boolean): string {
  const muted = matched && !matched.has(event.i);
  const { start, end } = event;
  const toggle = hasParts
    ? `<span class="chronicleToggle pointer ${opened ? "icon-down-open" : "icon-right-open"}" data-tip="${t("Show or hide the parts of the event")}"></span>`
    : `<span class="chronicleToggle"></span>`;
  const [from, to] = [Dates.format(start, "brief"), end === undefined ? "" : Dates.format(end, "brief")];
  const duration = Events.durationOf(event);
  const length = duration ? ` (${duration})` : "";
  const oneDay = from === to && (event.type === "battle" || event.type === "custom"); // its end is read in the tooltip
  const startTip = oneDay && length ? Dates.formatRange(start, end, "long") + length : "";
  const endCell =
    end === undefined
      ? `<div data-col="end" class="ongoing" data-tip="${t("Still going on")}">${t("ongoing")}</div>`
      : length && !oneDay
        ? `<div data-col="end" data-tip="${escapeHtml(Dates.format(end, "long") + length)}">${escapeHtml(to)}</div>`
        : `<div data-col="end"></div>`;
  const replay =
    event.type !== "battle"
      ? `<span data-col="replay"></span>`
      : event.replay
        ? `<span data-col="replay" data-tip="${t("Watch the battle again in the Battle Simulator")}" class="icon-play pointer"></span>`
        : `<span data-col="replay" data-tip="${NO_REPLAY()}" class="icon-play inactive"></span>`;
  const tags = escapeHtml(Tags.format(event.tags));
  const states = escapeHtml(getStateNames(event));
  return /* html */ `<div class="states ${edited ? "selected" : ""} ${muted ? "muted" : ""}" data-id="${event.i}">
      <div data-col="start" data-tip="${escapeHtml(startTip || Dates.format(start, "long"))}">${escapeHtml(from)}</div>
      ${endCell}
      <div data-col="name" style="padding-left: ${depth * 1.1}em" data-tip="${escapeHtml(event.name)}">${toggle}<span>${escapeHtml(event.name)}</span></div>
      <div data-col="type">${TYPE_LABELS[event.type]}</div>
      <div data-col="tags" data-tip="${tags}">${tags}</div>
      <div data-col="states" data-tip="${states}">${states}</div>
      ${replay}
      ${noteIcon(t("Edit free text notes (legend)"))}
      <span data-col="edit" data-tip="${t("Edit")}" class="icon-pencil"></span>
      <span data-col="remove" data-tip="${t("Remove")}" class="icon-trash-empty"></span>
    </div>`;
}

function onListClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const row = target.closest<HTMLElement>(".states[data-id]");
  if (!row) return;
  const id = getRowId(row);
  if (target.closest(".chronicleToggle.pointer")) toggle(id);
  else if (target.classList.contains("icon-pencil")) void Controllers.ChronicleRecordEditor.open(id);
  else if (target.classList.contains("icon-book")) void Controllers.NotesEditor.open({ type: "event", id });
  else if (target.classList.contains("icon-trash-empty")) remove(id);
  else if (target.classList.contains("icon-play")) {
    if (target.classList.contains("inactive")) tip(NO_REPLAY(), false, "warn", 4000);
    else void Controllers.BattleScreen.watch(id);
  }
}

function onFilterChange(): void {
  const state = ensureEl<HTMLSelectElement>("chronicleState").value;
  filters = {
    search: ensureEl<HTMLInputElement>("chronicleSearch").value,
    type: ensureEl<HTMLSelectElement>("chronicleType").value as Filters["type"],
    state: state === "all" ? "all" : +state
  };
  dialogState.set(dialogId, "filters", filters);
  closedWhileFiltered.clear();
  table.reset();
}

function isFiltered(): boolean {
  return Boolean(filters.search.trim()) || filters.type !== "all" || filters.state !== "all";
}

function matches(event: MapEvent): boolean {
  if (filters.type !== "all" && event.type !== filters.type) return false;
  if (filters.state !== "all" && !Events.statesOf(event).includes(filters.state)) return false;
  return Tags.matches(filters.search, event.name, event.tags);
}

/** Events with no parent; with a filter, those that match or hold a part that does */
function getTopEvents(): MapEvent[] {
  const all = Events.list();
  if (!isFiltered()) {
    matched = shown = null;
    return all.filter(event => event.parent === undefined);
  }
  matched = new Set(all.filter(matches).map(event => event.i));
  shown = new Set(matched);
  for (const id of matched) for (const parent of Events.parents(Events.get(id)!)) shown.add(parent.i);
  return all.filter(event => event.parent === undefined && shown!.has(event.i));
}

// parts

function getShownParts(event: MapEvent): MapEvent[] {
  const parts = Events.parts(event.i, false);
  return shown ? parts.filter(part => shown!.has(part.i)) : parts;
}

function getOpened(): Set<number> {
  const list = Events.list();
  if (!openedByList.has(list)) openedByList.set(list, new Set());
  return openedByList.get(list)!;
}

const isOpen = (event: MapEvent): boolean =>
  shown ? getShownParts(event).length > 0 && !closedWhileFiltered.has(event.i) : getOpened().has(event.i);

function toggle(id: number): void {
  const toggled = shown ? closedWhileFiltered : getOpened();
  if (toggled.has(id)) toggled.delete(id);
  else toggled.add(id);
  table.refresh();
}

function toggleAll(): void {
  const withParts = Events.list().filter(event => Events.parts(event.i, false).length);
  if (shown) {
    const anyOpen = withParts.some(isOpen);
    if (anyOpen) for (const event of withParts) closedWhileFiltered.add(event.i);
    else closedWhileFiltered.clear();
  } else {
    const opened = getOpened();
    const allOpen = withParts.every(event => opened.has(event.i));
    for (const event of withParts) allOpen ? opened.delete(event.i) : opened.add(event.i);
  }
  table.refresh();
}

/** Show the event's row: its parents open, on the page that holds it */
function reveal(event: MapEvent): void {
  const parents = Events.parents(event);
  for (const parent of parents) getOpened().add(parent.i);
  table.reveal(parents.at(-1) ?? event);
}

// records

/** The event open in the Chronicle Record Editor */
function getEditedId(): number | null {
  const key = findEl(editorId)?.dataset.entity;
  return key ? +key.split(":")[1] : null;
}

/** Draw the list again after a record changed; a given event is brought into view */
function refresh(eventId?: number): void {
  if (!findEl(dialogId)) return;
  const event = eventId === undefined ? undefined : Events.get(eventId);
  if (event) reveal(event);
  else table.refresh();
  if (findEl("notesEditor")) void Controllers.NotesEditor.refresh();
}

/** A new plain event, dated the present, opened with its name ready to type; its type is set in its record */
function add(): void {
  const start = Events.present();
  const id = Events.add({ type: "custom", name: "New event", start, end: start });
  if (!matches(Events.get(id)!)) {
    filters = { ...NO_FILTERS }; // a filter must not hide the event just added
    dialogState.set(dialogId, "filters", filters);
    closedWhileFiltered.clear();
    showFilters();
  }
  refresh(id);
  void Controllers.ChronicleRecordEditor.open(id, true);
}

/** Wait for a click on the map and hand over the place under it; the button shows it is waiting */
function pickPlace(buttonId: string, onPick: (place: Place) => void, onStop?: () => void): void {
  picking = toggleMapPlacement(
    buttonId,
    mouse => {
      stopMapPlacement();
      const [x, y] = pointer(mouse, mouse.currentTarget as SVGGElement).map(value => rn(value, 2));
      const cell = Pack.findCell(x, y);
      if (cell !== undefined && findEl(buttonId)) onPick({ cell, x, y });
    },
    t("Click on the map to place the battle"),
    undefined,
    () => {
      picking = false;
      findEl(buttonId)?.classList.remove("pressed");
      onStop?.();
    }
  );
}

function stopPicking(): void {
  if (picking) stopMapPlacement();
}

/** Remove an event with its parts, asked first */
function remove(id: number): void {
  const event = Events.get(id);
  if (!event) return;
  const parts = Events.parts(id);
  const played = parts.filter(part => part.type === "battle" && part.replay).length;
  const message = parts.length
    ? sentences(
        t("Remove the event and its parts ({{count}})?", { count: parts.length }),
        ...(played ? [t("Battles played among them: {{count}}", { count: played })] : []),
        t("To keep a part, empty its “Part of” first")
      )
    : t("Are you sure you want to remove the event?");
  Dialog.confirm({
    title: t("Remove"),
    message: `${message}<br>${t("This action cannot be reverted")}`,
    confirm: t("Remove"),
    onConfirm: () => {
      const removed = Events.remove(id);
      if (removed.includes(getEditedId() ?? -1)) Dialog.close(editorId);
      refresh();
    }
  });
}

/** Every event, its parts and tags and notes, as a flat table */
function download(): void {
  const headers = [
    "Id",
    "Name",
    "Start",
    "End",
    "Part of",
    "Tags",
    "Attackers",
    "Defenders",
    "States",
    "Result",
    "Note"
  ];
  const rows = Events.list().map(event => {
    const sided = isSided(event);
    return [
      event.i,
      event.name,
      event.start,
      event.end ?? "",
      event.parent ?? "",
      Tags.format(event.tags),
      sided ? Events.stateNames(event.attackers) : "",
      sided ? Events.stateNames(event.defenders) : "",
      sided ? "" : Events.stateNames(Events.statesOf(event)),
      Events.describeResult(event),
      event.note ?? ""
    ];
  });
  Csv.download("Chronicle", headers, rows);
}

function onClose(): void {
  stopPicking();
  Dialog.close(editorId);
  matched = shown = null;
  closedWhileFiltered.clear();
}

export const Chronicle = {
  open,
  refresh,
  remove,
  pickPlace,
  stopPicking,
  stateOptions,
  typeOptions,
  exportCsv: download
};
