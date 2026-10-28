// The Legends browser: the map's chronicle made readable. A timeline of events grouped by era,
// and the fallen realms with their stories. Read-only: it presents pack.history. See
// docs/plans/history-generation.md and docs/domain/glossary.md
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { dialogState } from "@/components/dialog/state";
import { Controllers } from "@/controllers";
import { goToPresent, isInPast, scrubRange, scrubToYear, viewedEpoch } from "@/controllers/historical-view";
import { ALIGNMENT_COLORS } from "@/data/culture-traits";
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
    #${dialogId} .legendsTraits { opacity: .95; }
    #${dialogId} .legendsAlignment { font-weight: bold; }
    #${dialogId} .legendsVice { color: #a33d3d; }
    #${dialogId} .legendsEmpty { padding: 1em; font-style: italic; opacity: .7; }
    #${dialogId} #legendsScrub { display: flex; gap: .5em; align-items: center; padding: .3em .5em; }
    #${dialogId} #legendsScrubRange { flex: 1; }
    #${dialogId} #legendsScrubYear { font-weight: bold; white-space: nowrap; }
    #${dialogId} #legendsScrubNow { flex: none; }
    #${dialogId} .legendsEra.past { background-color: rgba(0, 0, 0, 0.08); }
  </style>
`;

const EVENT_ICONS: Record<HistoryEventType, string> = {
  founding: "🏛️",
  war: "⚔️",
  battle: "🛡️",
  conquest: "🚩",
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
  goToPresent(); // a fresh browser always opens at the present (also a no-op when not scrubbing)

  $(`#${dialogId}`).dialog({ title: "Legends", resizable: false, position, close: closeBrowser });
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
          ${["state", "realm", "culture", "religion", "burg", "figure", "polity"].map(kind => `<option>${kind}</option>`).join("")}
        </select>
      </label>
      <label for="legendsSearch" data-tip="Filter by the event text" style="grid-template-columns: 4em 10em">Search:
        <input id="legendsSearch" type="search" />
      </label>
    </div>

    <div id="legendsBody"></div>

    <div id="legendsScrub" class="editorToolbar" hidden data-tip="Drag to see the past. The map shows the year the slider is at">
      <label for="legendsScrubRange" style="grid-template-columns: auto 1fr">
        <input id="legendsScrubRange" type="range" min="0" max="0" step="1" value="0" />
      </label>
      <span id="legendsScrubYear"></span>
      <button id="legendsScrubNow" class="icon-history pointer" data-tip="Return to the present"></button>
    </div>

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
  wireScrub();
}

function closeBrowser(): void {
  goToPresent(); // the map comes back to the present, the dialog was maybe scrubbing a past
  destroyDialog(dialogId);
}

/** the range input spanning the epochs; hidden when the map has no past to scrub */
function wireScrub(): void {
  const scrub = ensureEl("legendsScrub");
  const range = ensureEl<HTMLInputElement>("legendsScrubRange");
  const bounds = scrubRange();

  if (!bounds) {
    scrub.hidden = true;
    return;
  }

  scrub.hidden = false;
  range.min = String(bounds.min);
  range.max = String(bounds.max);
  range.value = String(options.map.lore.calendar.year);
  updateScrubLabel();

  range.addEventListener("input", onScrubInput);
  ensureEl("legendsScrubNow").addEventListener("click", () => {
    range.value = String(options.map.lore.calendar.year);
    onScrubInput();
  });
}

function onScrubInput(): void {
  const range = ensureEl<HTMLInputElement>("legendsScrubRange");
  scrubToYear(+range.value);
  updateScrubLabel();
  renderBody();
}

function updateScrubLabel(): void {
  const range = ensureEl<HTMLInputElement>("legendsScrubRange");
  const era = isInPast() ? viewedEpoch()?.era : options.map.lore.calendar.era;
  ensureEl("legendsScrubYear").innerHTML = escapeHtml([range.value, era].filter(Boolean).join(" · "));
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

/** events under era headers; an event belongs to the last era that has begun by its year.
 *  While a year is scrubbed, only the events the chronicle records by then are shown */
function renderTimeline(body: HTMLElement): void {
  const visibleUntil = getScrubRange();
  const events = pack.history.events
    .filter(matches)
    .filter(event => visibleUntil === null || event.year <= visibleUntil);
  const currentEra = viewedEpoch()?.era;
  const { eras } = pack.history;
  let current: string | undefined;
  let lines = "";
  for (const event of events) {
    const era = eraFor(eras, event.year);
    const header = era ? `${era.name} (${formatSpan(era.from, era.to)})` : "Age unremembered";
    if (header !== current) {
      current = header;
      const isScrubbedEra = isInPast() && era?.name === currentEra;
      lines += `<div class="legendsEra${isScrubbedEra ? " past" : ""}">${escapeHtml(header)}</div>`;
    }
    lines += renderEvent(event);
  }
  body.innerHTML = `<div class="legendsTimeline">${lines}</div>`;
  wireRows(body);
  ensureEl("legendsCount").textContent = String(events.length);
}

/** the year the slider shows, or null when the browser does not span the epochs */
function getScrubRange(): number | null {
  const row = document.getElementById("legendsScrub");
  const range = row?.querySelector<HTMLInputElement>("input#legendsScrubRange");
  if (!row || row.hidden || !range) return null;
  return +range.value;
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
  const ethos = ref.kind === "culture" ? cultureEthos(ref.id) : "";
  const hint = ethos ? `${ethos}. Open ${tip}` : `Open ${tip}`;
  return /* html */ `<span class="legendActor pointer" data-kind="${ref.kind}" data-id="${ref.id}"
    data-tip="${escapeHtml(hint)}">${escapeHtml(label)}</span>`;
}

/** "A lawful people prizing truth and justice", or "" for a culture with no traits: an old map, or
 *  the traits layer turned off. Culture actors have no page of their own, so this is where a
 *  culture's ethos is readable */
function cultureEthos(cultureId: number): string {
  const culture = pack.cultures[cultureId];
  const alignment = culture?.alignment;
  const values = culture?.values ?? [];
  if (!alignment || !values.length) return "";

  const prized =
    values.length === 1 ? `${values[0]} above all` : `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
  return `A ${alignment} people prizing ${prized}`;
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
  if (ref.kind === "polity") return pack.history.polities?.[ref.id]?.name ?? "a fallen polity";
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
    <span class="legendsText"><b>${escapeHtml(figure.name)}</b> — ${roles}${renderTraits(figure)}</span>
  </div>`;
}

/** the figure's character after its roles: alignment, then the virtues and the vices it never
 *  contradicts. Nothing when the chronicle predates the traits layer or the layer is off */
function renderTraits(figure: HistoricalFigure): string {
  const { alignment } = figure;
  if (!alignment) return "";

  const badge = `<span class="legendsAlignment" style="color:${ALIGNMENT_COLORS[alignment]}" data-tip="${capitalize(
    alignment
  )} alignment">${alignment}</span>`;
  const virtues = (figure.virtues ?? []).map(virtue => escapeHtml(virtue)).join(", ");
  const vices = (figure.vices ?? []).map(vice => `<span class="legendsVice">${escapeHtml(vice)}</span>`).join(", ");
  const traits = [badge, virtues, vices].filter(Boolean).join(" · ");
  return ` <span class="legendsTraits">— ${traits}</span>`;
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
