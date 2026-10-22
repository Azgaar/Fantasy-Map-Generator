// The Legends browser: the map's chronicle made readable. A timeline of events grouped by era,
// and the fallen realms with their stories. Read-only: it presents pack.history. See
// docs/plans/history-generation.md and docs/domain/glossary.md
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { dialogState } from "@/components/dialog/state";
import { Controllers } from "@/controllers";
import { Chronicle } from "@/generators/history-generator";
import { getCellPoint } from "@/generators/journeys/journey-places";
import type { Era, HistoricalFigure, HistoryEvent, HistoryEventType, HistRef } from "@/types/history";
import { capitalize, downloadFile, ensureEl, escapeHtml, getFileName } from "@/utils";

const dialogId = "legendsBrowser" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };

const TEMPLATE = /* html */ `
  <style>
    #${dialogId} { width: 34em; }
    #${dialogId} #legendsTabs { display: flex; gap: .3em; padding: .3em .4em 0; }
    #${dialogId} #legendsTabs button { padding: .2em 1em; }
    #${dialogId} #legendsTabs button.active { font-weight: bold; background-color: rgba(0, 0, 0, 0.08); }
    #${dialogId} #legendsBody { height: 24em; overflow-y: auto; padding: .3em .5em; }
    #${dialogId} .legendsEra { font-weight: bold; margin: .6em 0 .2em; border-bottom: 1px solid rgba(0, 0, 0, 0.15); }
    #${dialogId} .legendsEvent { display: flex; gap: .4em; align-items: baseline; padding: .15em 0; }
    #${dialogId} .legendsYear { font-weight: bold; flex: 0 0 3.2em; text-align: right; }
    #${dialogId} .legendsText { flex: 1; }
    #${dialogId} .legendActor { font-style: italic; white-space: nowrap; color: #3d4a5c; }
    #${dialogId} .legendLocate { flex: none; }
    #${dialogId} .legendsRealm { border: 1px solid rgba(0, 0, 0, 0.15); border-radius: 4px; padding: .4em .5em; margin-bottom: .5em; }
    #${dialogId} .legendsRealmHead { display: flex; gap: .8em; align-items: baseline; }
    #${dialogId} .legendsRealmLine { margin-top: .3em; }
    #${dialogId} .legendsRealm .legendsEvent { padding-left: .5em; }
    #${dialogId} .legendsEmpty { padding: 1em; font-style: italic; opacity: .7; }
  </style>
`;

const EVENT_ICONS: Record<HistoryEventType, string> = {
  founding: "🏛️",
  war: "⚔️",
  battle: "🛡️",
  collapse: "🏚️",
  schism: "✝️",
  migration: "🧭",
  independence: "🏴",
  goldenAge: "🌟",
  sack: "🔥",
  plague: "☠️",
  coronation: "👑",
  succession: "🤝"
};

let tab: "timeline" | "realms" | "figures" = "timeline";
let filters: { type: string; actor: string; search: string };

function open(): void {
  if (customization) return;
  filters = dialogState.get(dialogId, "filters", () => ({ type: "", actor: "", search: "" }));
  tab = "timeline";
  closeDialogs(`#${dialogId}, .stable`);

  Chronicle.sync();
  renderDialog();
  renderBody();

  $(`#${dialogId}`).dialog({ title: "Legends", resizable: false, position, close: () => destroyDialog(dialogId) });
}

function renderDialog(): void {
  destroyDialog(dialogId);

  const types = [...new Set(pack.history.events.map(event => event.type))].sort();
  const html = /* html */ `<div id="${dialogId}" class="dialog stable">${TEMPLATE}
    <div id="legendsTabs">
      <button id="legendsTabTimeline" class="active" data-tip="Every recorded event, grouped by era">Timeline</button>
      <button id="legendsTabRealms" data-tip="The fallen realms and their stories">Realms</button>
      <button id="legendsTabFigures" data-tip="The rulers and generals of the chronicle">Figures</button>
    </div>

    <div id="legendsFilters" class="editorFilters">
      <label for="legendsType" data-tip="Show only events of this kind" style="grid-template-columns: 3.4em 8em">Type:
        <select id="legendsType"><option value="">All</option>${types.map(type => `<option>${type}</option>`).join("")}</select>
      </label>
      <label for="legendsActor" data-tip="Show only events involving this kind of entity" style="grid-template-columns: 3.4em 7em">Actors:
        <select id="legendsActor">
          <option value="">All</option>
          ${["state", "realm", "culture", "religion", "burg", "figure"].map(kind => `<option>${kind}</option>`).join("")}
        </select>
      </label>
      <label for="legendsSearch" data-tip="Filter by the event text" style="grid-template-columns: 4em 10em">Search:
        <input id="legendsSearch" type="search" />
      </label>
    </div>

    <div id="legendsBody"></div>

    <div id="legendsFooter" class="totalLine">
      <div data-tip="Events shown" style="margin-left: 4px">Events:&nbsp;<span id="legendsCount">0</span></div>
    </div>

    <div id="legendsBottom" class="editorToolbar">
      <button id="legendsRefresh" data-tip="Refresh the browser" class="icon-cw"></button>
      <button id="legendsExport" data-tip="Save the chronicle as a text file (.txt)" class="icon-download"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl<HTMLSelectElement>("legendsType").value = filters.type;
  ensureEl<HTMLSelectElement>("legendsActor").value = filters.actor;
  ensureEl<HTMLInputElement>("legendsSearch").value = filters.search;

  ensureEl("legendsTabTimeline").addEventListener("click", () => switchTab("timeline"));
  ensureEl("legendsTabRealms").addEventListener("click", () => switchTab("realms"));
  ensureEl("legendsTabFigures").addEventListener("click", () => switchTab("figures"));
  ensureEl("legendsType").addEventListener("change", onFilterChange);
  ensureEl("legendsActor").addEventListener("change", onFilterChange);
  ensureEl("legendsSearch").addEventListener("input", onFilterChange);
  ensureEl("legendsRefresh").addEventListener("click", renderBody);
  ensureEl("legendsExport").addEventListener("click", exportChronicle);
}

function switchTab(next: "timeline" | "realms" | "figures"): void {
  tab = next;
  ensureEl("legendsTabTimeline").classList.toggle("active", tab === "timeline");
  ensureEl("legendsTabRealms").classList.toggle("active", tab === "realms");
  ensureEl("legendsTabFigures").classList.toggle("active", tab === "figures");
  renderBody();
}

function onFilterChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.id === "legendsType") filters.type = input.value;
  else if (input.id === "legendsActor") filters.actor = input.value;
  else filters.search = input.value;
  dialogState.set(dialogId, "filters", filters);
  renderBody();
}

function matches(event: HistoryEvent): boolean {
  if (filters.type && event.type !== filters.type) return false;
  if (filters.actor && !event.actors.some(ref => ref.kind === filters.actor)) return false;
  const search = filters.search.toLowerCase().trim();
  if (search && !event.text.toLowerCase().includes(search)) return false;
  return true;
}

function renderBody(): void {
  const body = ensureEl("legendsBody");
  body.innerHTML = "";
  if (!pack.history.events.length) {
    body.innerHTML = `<div class="legendsEmpty">No chronicle. Generate a map with history enabled to fill it.</div>`;
    ensureEl("legendsCount").textContent = "0";
    return;
  }

  if (tab === "realms") {
    renderRealms(body);
    return;
  }
  if (tab === "figures") {
    renderFigures(body);
    return;
  }

  renderTimeline(body);
}

/** events under era headers; an event belongs to the last era that has begun by its year */
function renderTimeline(body: HTMLElement): void {
  const events = pack.history.events.filter(matches);
  const { eras } = pack.history;
  let current: string | undefined;
  let lines = "";
  for (const event of events) {
    const era = eraFor(eras, event.year);
    const header = era ? `${era.name} (${formatSpan(era.from, era.to)})` : "Age unremembered";
    if (header !== current) {
      current = header;
      lines += `<div class="legendsEra">${escapeHtml(header)}</div>`;
    }
    lines += renderEvent(event);
  }
  body.innerHTML = `<div class="legendsTimeline">${lines}</div>`;
  wireRows(body);
  ensureEl("legendsCount").textContent = String(events.length);
}

function eraFor(eras: Era[], year: number): Era | undefined {
  let owner: Era | undefined;
  for (const era of eras) {
    if (era.from <= year) owner = era;
  }
  return owner;
}

function formatSpan(from: number, to: number): string {
  return from === to ? String(to) : `${from}–${to}`;
}

function renderEvent(event: HistoryEvent): string {
  const year = `<span class="legendsYear">${event.year}</span>`;
  const icon = `<span class="legendsIcon" data-tip="${event.type}">${EVENT_ICONS[event.type]}</span>`;
  const actors = event.actors.map(ref => renderActor(ref)).join(" ");
  const locate = event.loc === undefined ? "" : renderLocate(event.loc);
  return /* html */ `<div class="legendsEvent" data-id="${event.i}">
    ${icon} ${year} <span class="legendsText">${escapeHtml(event.text)}</span> ${actors} ${locate}
  </div>`;
}

function renderActor(ref: HistRef): string {
  const label = actorLabel(ref);
  const tip =
    ref.kind === "burg" ? "its editor" : ref.kind === "figure" || ref.kind === "realm" ? "its page" : "it on the map";
  return /* html */ `<span class="legendActor pointer" data-kind="${ref.kind}" data-id="${ref.id}"
    data-tip="Open ${tip}">${escapeHtml(label)}</span>`;
}

function renderLocate(cell: number): string {
  return /* html */ `<span class="legendLocate pointer icon-target" data-cell="${cell}" data-tip="Zoom to where it happened"></span>`;
}

function actorLabel(ref: HistRef): string {
  if (ref.kind === "state") return pack.states[ref.id]?.name ?? "a fallen state";
  if (ref.kind === "realm") return pack.history.realms[ref.id]?.name ?? "a fallen realm";
  if (ref.kind === "burg") return pack.burgs[ref.id]?.name ?? "a lost town";
  if (ref.kind === "culture") return pack.cultures[ref.id]?.name ?? "an ancient people";
  if (ref.kind === "religion") return pack.religions[ref.id]?.name ?? "an old faith";
  if (ref.kind === "figure") return pack.history.figures?.[ref.id]?.name ?? "a nameless name";
  return "unknown";
}

function renderRealms(body: HTMLElement): void {
  let lines = "";
  for (const realm of pack.history.realms) {
    const events = pack.history.events.filter(
      event => matches(event) && event.actors.some(ref => ref.kind === "realm" && ref.id === realm.i)
    );
    const successors = realm.successors.map(id => renderActor({ kind: "state", id })).join(" ");
    const remnant =
      realm.remnantCulture === undefined ? "" : renderActor({ kind: "culture", id: realm.remnantCulture });
    lines += /* html */ `<div class="legendsRealm">
      <div class="legendsRealmHead"><b>${escapeHtml(realm.name)}</b>
        <span class="legendsRealmSpan">${formatSpan(realm.founded, realm.fallen)}</span>
        <span class="legendsRealmCause" data-tip="How the realm ended">${realm.cause}</span>
      </div>
      <div class="legendsRealmLine">Successors: ${successors || "none recorded"}</div>
      ${remnant ? `<div class="legendsRealmLine">Remnant people: ${remnant}</div>` : ""}
      <div class="legendsRealmLine">${events.map(renderEvent).join("") || "Its chronicle is lost."}</div>
    </div>`;
  }
  body.innerHTML = lines || `<div class="legendsEmpty">No fallen realms haunt this map.</div>`;
  wireRows(body);
  ensureEl("legendsCount").textContent = String(pack.history.realms.length);
}

/** the people of the chronicle, grouped under the entity they served */
function renderFigures(body: HTMLElement): void {
  const figures = (pack.history.figures ?? []).filter(figureMatches);
  const grouped = new Map<string, { target: HistRef; figures: HistoricalFigure[] }>();
  for (const figure of figures) {
    const target = figure.roles[0]?.target;
    if (!target) continue;
    const key = `${target.kind}:${target.id}`;
    const group = grouped.get(key) ?? { target, figures: [] };
    group.figures.push(figure);
    grouped.set(key, group);
  }
  const lines = [...grouped.values()]
    .map(
      ({ target, figures: group }) => /* html */ `<div class="legendsRealm">
      <div class="legendsRealmHead"><b>${escapeHtml(actorLabel(target))}</b></div>
      ${group.map(renderFigure).join("")}
    </div>`
    )
    .join("");
  body.innerHTML = lines || `<div class="legendsEmpty">No figures grace this chronicle.</div>`;
  wireRows(body);
  ensureEl("legendsCount").textContent = String(figures.length);
}

function figureMatches(figure: HistoricalFigure): boolean {
  if (filters.actor && filters.actor !== "figure" && !figure.roles.some(role => role.target.kind === filters.actor))
    return false;
  const search = filters.search.toLowerCase().trim();
  if (search && !figure.name.toLowerCase().includes(search)) return false;
  return true;
}

function renderFigure(figure: HistoricalFigure): string {
  const life = figure.death === undefined ? `${figure.birth}–` : formatSpan(figure.birth, figure.death);
  const roles = figure.roles
    .map(role => {
      const served =
        role.to === undefined && role.type === "ruler"
          ? `since ${role.from}`
          : formatSpan(role.from, role.to ?? role.from);
      return `${capitalize(role.type)} ${renderActor(role.target)}, ${served}`;
    })
    .join("; ");
  return /* html */ `<div class="legendsEvent">
    <span class="legendsYear">${life}</span>
    <span class="legendsText"><b>${escapeHtml(figure.name)}</b> — ${roles}</span>
  </div>`;
}

function wireRows(body: HTMLElement): void {
  body.querySelectorAll("span.legendLocate").forEach(el => void el.addEventListener("click", zoomToEvent));
  body.querySelectorAll("span.legendActor").forEach(el => void el.addEventListener("click", openActor));
}

function zoomToEvent(this: HTMLElement): void {
  const point = getCellPoint(Number(this.dataset.cell));
  if (point) zoomTo(point[0], point[1], 8, 2000);
}

/** jump to where the actor lives: a state at its pole, a culture or religion at its center; a burg opens its editor */
function openActor(this: HTMLElement): void {
  const id = Number(this.dataset.id);
  switch (this.dataset.kind) {
    case "state": {
      const state = pack.states[id];
      if (!state || state.removed) return;
      if (state.pole) zoomTo(state.pole[0], state.pole[1], 4, 2000);
      break;
    }
    case "burg":
      if (pack.burgs[id] && !pack.burgs[id].removed) void Controllers.BurgEditor.open(id);
      break;
    case "culture":
    case "religion": {
      const center = this.dataset.kind === "culture" ? pack.cultures[id]?.center : pack.religions[id]?.center;
      if (center === undefined) return;
      const [x, y] = pack.cells.p[center];
      zoomTo(x, y, 4, 2000);
      break;
    }
    case "realm":
    case "figure":
      switchTab(this.dataset.kind === "realm" ? "realms" : "figures");
      break;
  }
}

function exportChronicle(): void {
  const lines = pack.history.events.map(event => `${event.year}: ${event.text}`);
  downloadFile(lines.join("\n"), `${getFileName("Chronicle")}.txt`);
}

export const LegendsOverview = { open };
