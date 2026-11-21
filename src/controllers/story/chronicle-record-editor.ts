// The Chronicle Record Editor: one event of the Chronicle, each field saved as it is changed. See docs/prd/events.md#the-chronicle
import { Controllers } from "@/controllers";
import { type DateParts, Dates } from "@/model/story/dates";
import { type EventPatch, Events, type EventType, isSided, type MapEvent } from "@/model/story/events";
import { Tags } from "@/model/tags";
import { EmblemRenderer } from "@/renderers/emblems/renderer";
import { Dialog } from "@/ui/dialog/dialog";
import { noteButton } from "@/ui/dialog/dialog-helpers";
import { clearEntityMarks, markEntities } from "@/ui/map/reveal";
import { tip } from "@/ui/tooltips";
import { t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/node-utils";
import { errorText, escapeHtml } from "@/utils/string-utils";
import { Chronicle, type Place } from "./chronicle";

const dialogId = "chronicleRecordEditor";

type DateField = "start" | "end";
type StatesKey = "attackers" | "defenders" | "states";

let eventId: number | null = null;
let unmark = 0; // the timer that clears the mark of a focused event

/** Edit an event; `rename` leaves its name ready to type, for one just added */
function open(id: number, rename = false): void {
  const event = Events.get(id);
  if (!event) return;
  Chronicle.stopPicking(); // a place awaited for the record shown before is not this one's
  eventId = id;
  renderDialog(event);
  fill();
  if (findEl("notesEditor")) void Controllers.NotesEditor.open({ type: "event", id });

  Dialog.open(dialogId, {
    title: t("Chronicle Record Editor"),
    position: { my: "left top", at: "left+10 top+10", of: "svg" },
    onClose
  });
  Chronicle.refresh(); // marks the row
  if (rename) {
    control("name").focus();
    control<HTMLInputElement>("name").select();
  }
}

const getEvent = (): MapEvent | undefined => Events.get(eventId ?? -1);

/** A war, an alliance or a vassalage that is going on follows the relation of its states */
const isOngoingRelation = (event: MapEvent): boolean =>
  event.type !== "custom" && event.type !== "battle" && event.end === undefined;

const isPlayed = (event: MapEvent): boolean => event.type === "battle" && Boolean(event.replay);

const control = <T extends HTMLElement = HTMLElement>(name: string): T =>
  ensureEl(dialogId).querySelector<T>(`[data-control="${name}"]`)!;

// the dialog

const row = (label: string, content: string, tipText = ""): string =>
  `<div class="label">${label}:</div><div ${tipText ? `data-tip="${tipText}"` : ""}>${content}</div>`;

/** The fields every event has; `fill` adds those of its type and writes the values */
function renderDialog(event: MapEvent): void {
  Dialog.destroy(dialogId);
  const html = /* html */ `<div id="${dialogId}" class="dialog" data-entity="event:${event.i}">
      <style>
        #chronicleRecordBody { display: grid; grid-template-columns: 5.5em 23em; gap: 0.3em; align-items: center; padding-bottom: 0.5em; }
        #chronicleRecordSides { display: contents; }
        #chronicleRecordBody input, #chronicleRecordBody select { box-sizing: border-box; min-width: 0; }
        #chronicleRecordBody div:not([class]) > :is(input, select) { width: 100%; }
        #${dialogId} .chronicleDate { display: grid; grid-template-columns: 4.5em 1fr 3em 5.5em; gap: 0.3em; align-items: center; }
        #${dialogId} .chronicleDate > * { width: 100%; }
        #${dialogId} .chronicleDate input[type="time"]::-webkit-calendar-picker-indicator { margin: 0; padding: 0; height: 1em; }
        #${dialogId} .chronicleDate input[type="time"]::-webkit-datetime-edit,
        #${dialogId} .chronicleDate input[type="time"]::-webkit-datetime-edit-fields-wrapper { padding: 0; }
        #${dialogId} .chroniclePair { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3em; }
        #${dialogId} .chronicleState { display: grid; grid-template-columns: 1.4em minmax(0, 1fr); gap: 0.2em; align-items: center; }
        #${dialogId} .coaIcon { margin: 0; }
        #${dialogId} .chronicleStates { display: flex; flex-wrap: wrap; gap: 0.3em; align-items: center; }
        #${dialogId} .chronicleStates > span { display: inline-flex; align-items: center; gap: 0.2em; padding: 0 0.3em 0 0.1em; border: 1px solid #d4d4d4; background: #fafafa; white-space: nowrap; }
        #${dialogId} .chronicleStates > span > span { font-size: 0.8em; color: #6e5e66; }
        #${dialogId} .chronicleStates > select { width: 5.5em; }
      </style>
      <div id="chronicleRecordBody">
        ${row(t("Name"), `<input data-control="name" autocorrect="off" spellcheck="false" />`)}
        ${row(t("Type"), `<select id="chronicleRecordType" data-control="type">${Chronicle.typeOptions()}</select>`)}
        ${row(t("Start"), renderDate("start"))}
        ${row(t("End"), renderDate("end"))}
        ${row(
          t("Part of"),
          `<input data-control="parent" list="chronicleParents" placeholder="${t("None")}" /><datalist id="chronicleParents"></datalist>`,
          t("The event it is part of: type to find one by name, empty for none")
        )}
        ${row(
          t("Tags"),
          `<input data-control="tags" placeholder="${t("none")}" autocorrect="off" spellcheck="false" />`,
          t("Comma-separated list of tags")
        )}
        <div id="chronicleRecordSides"></div>
      </div>
      <div id="chronicleRecordBottom"></div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  const dialog = ensureEl(dialogId);
  dialog.addEventListener("change", onChange);
  dialog.addEventListener("click", onClick);
  for (const type of ["input", "focusin"])
    dialog.addEventListener(type, ({ target }) => {
      const input = target as HTMLInputElement;
      if (input.dataset.control === "parent") suggestParents(input);
    });
}

/** The fields and buttons an event has by its type: drawn anew when the type changes */
function renderTyped(event: MapEvent): void {
  const played = isPlayed(event);
  const states = (key: StatesKey) => `<div class="chronicleStates" data-key="${key}"></div>`;
  const select = (name: string) =>
    `<div class="chronicleState"><span data-emblem="${name}"></span><select data-control="${name}"></select></div>`;
  const sides = row(t("Attackers"), states("attackers")) + row(t("Defenders"), states("defenders"));
  const winner = /* html */ `<select data-control="winner" ${played ? "disabled" : ""}>
      <option value="">${t("No victor")}</option>
      <option value="attackers">${t("Attackers")}</option>
      <option value="defenders">${t("Defenders")}</option>
    </select>`;
  const fields: Record<EventType, string> = {
    war: sides,
    battle: sides + row(t("Winner"), winner),
    alliance: row(t("States"), `<div class="chroniclePair">${select("ally0")}${select("ally1")}</div>`),
    vassalage: row(t("Suzerain"), select("suzerain")) + row(t("Vassal"), select("vassal")),
    custom: row(t("States"), states("states"), t("The states the event concerns"))
  };
  ensureEl("chronicleRecordSides").innerHTML = fields[event.type];

  const battle = event.type === "battle";
  ensureEl("chronicleRecordBottom").innerHTML = /* html */ `
    ${noteButton("chronicleRecordNotes", t("Edit free text notes (legend)"))}
    ${battle ? `<button id="chronicleRecordFocus" data-tip="${t("Locate on map")}" class="icon-target"></button>` : ""}
    ${battle && !played ? `<button id="chronicleRecordPlace" data-tip="${t("Pick the place on the map")}" class="icon-map-pin"></button>` : ""}
    ${played ? `<button id="chronicleRecordSummary" data-tip="${t("Show the battle summary")}" class="icon-doc"></button>` : ""}
    ${played ? `<button id="chronicleRecordReplay" data-tip="${t("Watch the battle again in the Battle Simulator")}" class="icon-play"></button>` : ""}
    <button id="chronicleRecordRemove" data-tip="${t("Remove")}" data-shortcut="Delete" class="icon-trash fastDelete"></button>`;
  ensureEl(dialogId).dataset.type = event.type;
}

function renderDate(field: DateField): string {
  const months = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${Dates.monthName(i + 1)}</option>`);
  return /* html */ `<div class="chronicleDate" data-field="${field}">
      <input type="number" data-control="${field}.year" step="1" data-tip="${t("Year, negative before the era")}" />
      <select data-control="${field}.month" data-tip="${t("Month")}"><option value=""></option>${months.join("")}</select>
      <input type="number" data-control="${field}.day" min="1" max="31" step="1" data-tip="${t("Day")}" />
      <input type="time" data-control="${field}.time" data-tip="${t("Time", { context: "clock" })}" />
    </div>`;
}

/** Write the event into the fields; the controls stay, so the one being typed in keeps the focus */
function fill(): void {
  const event = getEvent();
  if (!event) return void Dialog.close(dialogId);
  const ongoing = isOngoingRelation(event);
  const played = isPlayed(event);
  if (ensureEl(dialogId).dataset.type !== event.type) renderTyped(event);

  control<HTMLInputElement>("name").value = event.name;
  const type = control<HTMLSelectElement>("type");
  type.value = event.type;
  type.disabled = ongoing || played;
  type.parentElement!.dataset.tip = played
    ? t("A played battle stays a battle")
    : ongoing
      ? t("It goes on while the relation of its states holds: it ends through the relation")
      : t("What the event is: the fields below follow it");
  fillDate("start", event.start, false);
  fillDate("end", event.end, ongoing);
  control<HTMLInputElement>("parent").value = Events.get(event.parent ?? -1)?.name ?? "";
  control<HTMLInputElement>("tags").value = Tags.format(event.tags);

  if (isSided(event)) {
    for (const key of ["attackers", "defenders"] as const)
      fillStates(key, event[key], index => played || (ongoing && index === 0), !played);
    if (event.type === "battle") control<HTMLSelectElement>("winner").value = event.winner ?? "";
  } else if (event.type === "alliance") {
    fillStateSelect("ally0", event.states[0], ongoing);
    fillStateSelect("ally1", event.states[1], ongoing);
  } else if (event.type === "vassalage") {
    fillStateSelect("suzerain", event.suzerain, ongoing);
    fillStateSelect("vassal", event.vassal, ongoing);
  } else fillStates("states", event.states ?? [], () => false, true);
}

/** A part can be given only once the part before it is: a day needs a month, a time a day */
function fillDate(field: DateField, date: string | undefined, locked: boolean): void {
  const parts: Partial<DateParts> = (date && Dates.parse(date)) || {};
  const set = (part: string, value: string | number | undefined, disabled: boolean) => {
    const input = control<HTMLInputElement>(`${field}.${part}`);
    input.value = String(value ?? "");
    input.disabled = locked || disabled;
    return input;
  };
  const pad = (value: number) => String(value).padStart(2, "0");
  const time = parts.hour === undefined ? "" : `${pad(parts.hour)}:${pad(parts.minute ?? 0)}`;
  set("year", parts.year, false).placeholder = field === "end" ? t("ongoing") : "";
  set("month", parts.month, parts.year === undefined);
  set("day", parts.day, parts.month === undefined).max = String(Dates.monthDays(parts.month ?? 1));
  set("time", time, parts.day === undefined);
  const box = control(`${field}.year`).parentElement!;
  if (locked) box.dataset.tip = t("It goes on while the relation of its states holds: it ends through the relation");
  else delete box.dataset.tip;
}

function fillStates(key: StatesKey, ids: number[], fixed: (index: number) => boolean, addable: boolean): void {
  const chips = ids.map((id, index) => {
    const remove = fixed(index)
      ? ""
      : `<span class="icon-cancel pointer" data-index="${index}" data-tip="${t("Remove")}"></span>`;
    return `<span>${emblem(id)}${escapeHtml(Events.stateName(id))}${remove}</span>`;
  });
  const add = addable
    ? `<select data-control="add.${key}" data-tip="${t("Add a state")}"><option value="">+ ${t("Add")}</option>${Chronicle.stateOptions(ids)}</select>`
    : "";
  ensureEl(dialogId).querySelector(`.chronicleStates[data-key="${key}"]`)!.innerHTML = chips.join("") + add;
}

/** A state's emblem, drawn when it is first asked for; nothing for a state that is gone */
function emblem(stateId: number): string {
  const state = pack.states[stateId];
  if (!stateId || !state?.coa || state.removed) return "";
  void EmblemRenderer.trigger(`stateCOA${stateId}`, state.coa);
  return `<svg class="coaIcon" viewBox="0 0 200 200"><use href="#stateCOA${stateId}"></use></svg>`;
}

function fillStateSelect(name: string, value: number, locked: boolean): void {
  const select = control<HTMLSelectElement>(name);
  const current = value ? `<option value="${value}">${escapeHtml(Events.stateName(value))}</option>` : "";
  select.innerHTML = `<option value="0">—</option>${current}${Chronicle.stateOptions([value])}`;
  select.value = String(value);
  select.disabled = locked;
  ensureEl(dialogId).querySelector(`[data-emblem="${name}"]`)!.innerHTML = emblem(value);
}

// changes

/** Show the event again after something else changed it */
function refresh(): void {
  if (findEl(dialogId)) fill();
}

/** A change by the user; a refused one is told and the fields show the event as it is */
function change(patch: EventPatch): void {
  if (eventId === null) return;
  try {
    Events.update(eventId, patch);
  } catch (error) {
    tip(errorText(error), false, "error", 5000);
  }
  fill();
  Chronicle.refresh("start" in patch || "parent" in patch ? eventId : undefined); // moved in the list: brought into view
}

function onChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  const current = getEvent();
  const name = target.dataset.control;
  if (!current || !name) return;
  if (name === "parent") changeParent(target.value);
  else if (name === "type") changeType(target.value as EventType);
  else {
    const patch = readPatch(current, name, target.value);
    if (patch) change(patch);
    else fill(); // refused: the fields show the event as it is
  }
}

/** A battle takes its place from a click on the map, and is a battle once it has one */
function changeType(type: EventType): void {
  if (type === "battle") pickPlace("chronicleRecordType", place => change({ type, ...place }));
  else {
    Chronicle.stopPicking(); // a battle's place awaited for another type
    change({ type });
  }
}

/** A place picked on the map for the record shown now: one opened meanwhile takes none of it */
function pickPlace(buttonId: string, onPick: (place: Place) => void): void {
  const id = eventId;
  const forThis = (place: Place) => void (eventId === id && onPick(place));
  Chronicle.pickPlace(buttonId, forThis, () => void (eventId === id && fill()));
}

/** The change a control asks for; null when it is refused */
function readPatch(current: MapEvent, name: string, value: string): EventPatch | null {
  const [group, key] = name.split(".");
  if (group === "start" || group === "end") {
    const date = readDate(group);
    if (date === undefined) return null;
    if (group === "end") return { end: date };
    return date === null ? null : { start: date }; // a start cannot be emptied
  }
  if (name === "name") return { name: value };
  if (name === "tags") return { tags: value };
  if (name === "winner") return { winner: value === "attackers" || value === "defenders" ? value : null };
  if (name === "suzerain" || name === "vassal") return { [name]: +value };
  if (current.type === "alliance" && (name === "ally0" || name === "ally1")) {
    const states = [...current.states];
    states[name === "ally0" ? 0 : 1] = +value;
    return { states };
  }
  if (group === "add" && value) return { [key]: [...getStateIds(current, key as StatesKey), +value] };
  return null;
}

/** The date typed into a row: null for an empty one, undefined when the calendar has no such day */
function readDate(field: DateField): string | null | undefined {
  const value = (part: string) => control<HTMLInputElement>(`${field}.${part}`).value.trim();
  if (!value("year")) return null;
  const parts: DateParts = { year: Math.round(+value("year")) };
  if (value("month")) {
    parts.month = +value("month");
    if (value("day")) {
      parts.day = Math.round(+value("day"));
      if (value("time")) [parts.hour, parts.minute] = value("time").split(":").map(Number);
    }
  }
  if (Dates.isValid(parts)) return Dates.write(parts);
  tip(t("The calendar has no such day"), false, "error", 4000);
  return undefined;
}

function getStateIds(event: MapEvent, key: StatesKey): number[] {
  if (key === "states") return event.type === "custom" ? (event.states ?? []) : [];
  return isSided(event) ? event[key] : [];
}

function onClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const current = getEvent();
  if (!current) return;
  const chip = target.closest<HTMLElement>(".chronicleStates [data-index]");
  if (chip) {
    const key = chip.closest<HTMLElement>(".chronicleStates")!.dataset.key as StatesKey;
    const ids = [...getStateIds(current, key)];
    ids.splice(+chip.dataset.index!, 1);
    change({ [key]: ids });
  }
  const button = target.closest("button")?.id;
  if (button === "chronicleRecordNotes") void Controllers.NotesEditor.open({ type: "event", id: current.i });
  else if (button === "chronicleRecordFocus") focus(current);
  else if (button === "chronicleRecordPlace") pickPlace(button, place => change(place));
  else if (button === "chronicleRecordSummary") void Controllers.BattleScreen.showRecord(current.i);
  else if (button === "chronicleRecordReplay") void Controllers.BattleScreen.watch(current.i);
  else if (button === "chronicleRecordRemove") Chronicle.remove(current.i);
}

/** Zoom to the event's place and mark it for a moment */
function focus(event: MapEvent): void {
  if (!markEntities([{ type: "event", id: event.i }]))
    return void tip(t("The event has no place on the map"), false, "warn", 3000);
  clearTimeout(unmark);
  unmark = window.setTimeout(() => {
    clearEntityMarks();
    unmark = 0;
  }, 4000);
}

// suggestions

/** Events the edited one may be part of, whose names hold the text, wars first */
function getParentCandidates(text: string): MapEvent[] {
  const own = new Set([eventId, ...Events.parts(eventId ?? -1).map(part => part.i)]);
  const query = text.trim().toLocaleLowerCase();
  return Events.list()
    .filter(event => !own.has(event.i) && event.name.toLocaleLowerCase().includes(query))
    .sort((a, b) => Number(b.type === "war") - Number(a.type === "war"))
    .slice(0, 30);
}

function suggestParents(input: HTMLInputElement): void {
  ensureEl("chronicleParents").innerHTML = getParentCandidates(input.value)
    .map(
      event =>
        `<option value="${escapeHtml(event.name)}" label="${escapeHtml(Dates.formatRange(event.start, event.end))}"></option>`
    )
    .join("");
}

function changeParent(name: string): void {
  const parent = getParentCandidates(name).find(event => event.name === name.trim());
  if (!name.trim() || parent) change({ parent: parent?.i ?? null });
  else {
    tip(t("No event of that name can hold this one"), false, "error", 4000);
    fill();
  }
}

function onClose(): void {
  Chronicle.stopPicking();
  if (unmark) clearEntityMarks(); // only the mark it set
  clearTimeout(unmark);
  unmark = 0;
  eventId = null;
  delete findEl(dialogId)?.dataset.entity;
  Chronicle.refresh(); // unmarks the row
}

export const ChronicleRecordEditor = { open, refresh };
