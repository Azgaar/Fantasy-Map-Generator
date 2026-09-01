import { closeDialogs, confirmationDialog, destroyDialog, updateDialog } from "@/components/dialog/dialog-helpers";
import { applyLineHighlighting } from "@/components/dialog/highlighting";
import { bindColumnSorting, sortDataByColumns } from "@/components/dialog/sorting";
import { dialogState } from "@/components/dialog/state";
import {
  type EditorColumn,
  getRowId,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/components/dialog/table";
import type { FillBoxElement } from "@/components/fill-box";
import { Layers } from "@/components/layers";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import { cellEndpointLabel, getCellPoint } from "@/generators/journeys/journey-places";
import { startJourneyTravel, stopJourneyTravel } from "@/renderers/journey-travel";
import { highlightElement } from "@/renderers/overlays/highlight";
import type { Journey } from "@/types/Journey";
import {
  convertSpeed,
  downloadFile,
  ensureEl,
  escapeHtml,
  findEl,
  formatSpeed,
  getDistanceUnit,
  getFileName,
  rn,
  toCsvField
} from "@/utils";

const dialogId = "journeysOverview" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
let filterState: { search: string };

const columns: EditorColumn<Journey>[] = [
  { key: "name", label: "Journey", width: "16em", permanent: true, sortBy: j => j.name || "", sortType: "alpha" },
  { key: "type", label: "Type", width: "8em", sortBy: j => j.type || "", sortType: "alpha" },
  {
    key: "from",
    label: "From",
    width: "7em",
    mobileHidden: true,
    sortBy: j => cellEndpointLabel(getStart(j)),
    sortType: "alpha"
  },
  {
    key: "to",
    label: "To",
    width: "7em",
    mobileHidden: true,
    sortBy: j => cellEndpointLabel(getEnd(j)),
    sortType: "alpha"
  },
  { key: "distance", label: "Distance", width: "7em", sortBy: j => Journeys.getTotals(j).totalDistance },
  {
    key: "speed",
    label: "Speed",
    width: "6em",
    mobileHidden: true,
    tip: "Average speed",
    sortBy: j => Journeys.getTotals(j).avgSpeed
  },
  {
    key: "time",
    label: "Total time",
    width: "5.6em",
    tip: "Time from start to finish, travel days counted at each transport's travel hours",
    mobileHidden: true,
    sortBy: j => Journeys.getTotals(j).elapsedHours
  },
  { key: "edit", width: "1.4em" },
  { key: "locate", width: "1.4em" },
  { key: "visible", width: "1.4em" },
  { key: "lock", width: "1.4em" },
  { key: "remove", width: "1.4em", permanent: true }
];

const journeysTable = initEditorTable<Journey>({
  getData: () => sortDataByColumns(dialogId, getFilteredJourneys(), columns),
  onUpdate: renderJourneysPage
});

function getFilteredJourneys(): Journey[] {
  const searchText = filterState.search.toLowerCase().trim();
  if (!searchText) return pack.journeys.slice();

  return pack.journeys.filter(journey => {
    const places = [cellEndpointLabel(getStart(journey)), cellEndpointLabel(getEnd(journey))];
    return [journey.name, journey.type, ...places].some(value => (value || "").toLowerCase().includes(searchText));
  });
}

function open(): void {
  if (customization) return;
  filterState = dialogState.get(dialogId, "filters", () => ({ search: "" }));
  closeDialogs(`#${dialogId}, .stable`);
  Layers.show("journeys");

  Journeys.sync();
  renderDialog();
  journeysTable.reset();

  $(`#${dialogId}`).dialog({ title: "Journeys Overview", resizable: false, position, close: onClose });
}

function renderDialog(): void {
  destroyDialog(dialogId);

  const html = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
    <div id="journeysBody" class="table">${renderEditorHeader({ dialogId, columns })}</div>

    <div id="journeysFilters" class="editorFilters">
      <label for="journeysSearch" data-tip="Filter by journey name, type or endpoint" style="grid-template-columns: 4em 12em">Search: <input id="journeysSearch" type="search" /></label>
    </div>

    <div id="journeysFooter" class="totalLine">
      <div data-tip="Journeys number" style="margin-left: 4px">Journeys:&nbsp;<span id="journeysFooterNumber">0</span></div>
      <div data-tip="Total distance" style="margin-left: 12px" data-col="distance">Distance:&nbsp;<span id="journeysFooterDistance">0</span></div>
      <div data-tip="Total time" style="margin-left: 12px" data-col="time">Total time:&nbsp;<span id="journeysFooterTime">0</span></div>
      <div data-tip="Travel time" style="margin-left: 12px" data-col="time">Travel time:&nbsp;<span id="journeysFooterTravelTime">0</span></div>
    </div>

    <div id="journeysBottom" class="editorToolbar">
      <button id="journeysOverviewRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
      <button id="journeyCreateNew" data-tip="Create a new journey" class="icon-plus"></button>
      <button id="journeyGenerateStory" data-tip="Generate a random journey" class="icon-shuffle"></button>
      <button id="journeysEditStyle" data-tip="Edit journeys style in Style Editor" class="icon-adjust"></button>
      <button id="journeysEditTransport" data-tip="Edit transport types (add custom modes like Magic Carpet)" class="icon-cog"></button>
      <button id="journeysExport" data-tip="Save journeys-related data as a text file (.csv)" class="icon-download"></button>
      <button id="journeysLockAll" data-tip="Lock or unlock all journeys" class="icon-lock"></button>
      <button id="journeysRemoveAll" data-tip="Remove all unlocked journeys" class="icon-trash"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl<HTMLInputElement>("journeysSearch").value = filterState.search;
  bindColumnSorting(dialogId, journeysTable.reset);
  applyLineHighlighting(dialogId, ({ target }) => {
    const group = target.closest<SVGElement>("#journeys > g[id^='journey']");
    return group ? Number(group.id.slice("journey".length)) : undefined;
  });

  ensureEl("journeysOverviewRefresh").addEventListener("click", journeysTable.refresh);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });
  ensureEl("journeyCreateNew").addEventListener("click", createEmptyJourney);
  ensureEl("journeyGenerateStory").addEventListener("click", generateRandomJourney);
  ensureEl("journeysEditStyle").addEventListener("click", () => editStyle("journeys"));
  ensureEl("journeysEditTransport").addEventListener("click", () => void Controllers.TransportEditor.open());
  ensureEl("journeysExport").addEventListener("click", downloadJourneysData);
  ensureEl("journeysLockAll").addEventListener("click", toggleLockAll);
  ensureEl("journeysRemoveAll").addEventListener("click", triggerAllJourneysRemove);
  ensureEl("journeysSearch").addEventListener("input", event => {
    filterState.search = (event.target as HTMLInputElement).value;
    dialogState.set(dialogId, "filters", filterState);
    journeysTable.reset();
  });
}

function renderJourneysPage(view: TableView<Journey>): void {
  const body = ensureEl("journeysBody");
  body.querySelectorAll(":scope > .states").forEach(row => {
    row.remove();
  });

  const unit = getDistanceUnit();
  let lines = "";

  for (const journey of view.rows) {
    const { totalDistance, totalHours, avgSpeed, elapsedHours, hiddenSegments } = Journeys.getTotals(journey);
    const hiddenNote = hiddenSegments
      ? `. ${hiddenSegments} hidden segment${hiddenSegments > 1 ? "s" : ""} left out`
      : "";
    lines += /* html */ `<div class="states" data-id="${journey.i}">
      <div data-col="name" style="width: 93%; overflow: hidden">
        <fill-box class="journeyColor" fill="${journey.color}" size="0.8em" data-tip="Journey color. Click to change"></fill-box>
        <span data-tip="Journey name: ${escapeHtml(journey.name)}">${escapeHtml(journey.name)}</span>
      </div>
      <div data-tip="Kind of travel this is" data-col="type">${escapeHtml(journey.type)}</div>
      ${renderEndpoint("from", getStart(journey))}
      ${renderEndpoint("to", getEnd(journey))}
      <div data-tip="Total distance" data-col="distance">${rn(totalDistance)} ${unit}</div>
      <div data-tip="Average speed, moving segments only" data-col="speed">${avgSpeed ? formatSpeed(avgSpeed) : "-"}</div>
      <div data-tip="Total time: ${Journeys.formatTravelTimeFull(elapsedHours)}. Travel time: ${Journeys.formatHours(totalHours)}${hiddenNote}" data-col="time">${Journeys.formatTravelTime(elapsedHours)}</div>
      <div data-col="edit"><span class="journeyEdit pointer icon-pencil" data-tip="Edit journey"></span></div>
      <div data-col="locate"><span class="journeyZoom pointer icon-target" data-tip="Locate the journey"></span></div>
      <div data-col="visible"><span class="journeyVisible pointer ${journey.visible === false ? "icon-eye-off" : "icon-eye"}" data-tip="Toggle journey visibility on the map"></span></div>
      <div data-col="lock"><span class="locks pointer ${journey.lock ? "icon-lock" : "icon-lock-open inactive"}" onmouseover="showElementLockTip(event)"></span></div>
      <div data-col="remove"><span class="journeyRemove pointer icon-trash-empty" data-tip="Remove journey"></span></div>
    </div>`;
  }
  body.insertAdjacentHTML("beforeend", lines);

  const totals = view.all.map(journey => Journeys.getTotals(journey));
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  ensureEl("journeysFooterNumber").innerHTML = `${view.all.length} of ${pack.journeys.length}`;
  ensureEl("journeysFooterDistance").innerHTML = `${rn(sum(totals.map(t => t.totalDistance)))} ${unit}`;
  const hiddenSegments = sum(totals.map(t => t.hiddenSegments));
  const hiddenNote = hiddenSegments
    ? ` ${hiddenSegments} hidden segment${hiddenSegments > 1 ? "s" : ""} left out.`
    : "";

  // every journey is already in calendar hours, so the totals just add up
  const elapsedHours = sum(totals.map(t => t.elapsedHours));
  const footerTime = ensureEl("journeysFooterTime");
  footerTime.innerHTML = Journeys.formatTravelTime(elapsedHours);
  footerTime.parentElement!.dataset.tip = `Time from start to finish: ${Journeys.formatTravelTimeFull(elapsedHours)}. A day of travel fills a whole day, however many hours the transport sustains.${hiddenNote}`;

  const travelHours = sum(totals.map(t => t.totalHours));
  const footerTravelTime = ensureEl("journeysFooterTravelTime");
  footerTravelTime.innerHTML = Journeys.formatHours(travelHours);
  footerTravelTime.parentElement!.dataset.tip = `Hours spent moving or waiting: ${rn(travelHours, 1)}h, the sum of the segment times. Rest between travel days is not counted.${hiddenNote}`;

  body.querySelectorAll("div.states").forEach(el => void el.addEventListener("mouseenter", journeyHighlightOn));
  body.querySelectorAll("div.states").forEach(el => void el.addEventListener("mouseleave", stopJourneyTravel));
  body.querySelectorAll("fill-box.journeyColor").forEach(el => void el.addEventListener("click", changeJourneyColor));
  body.querySelectorAll("span.journeyZoom").forEach(el => void el.addEventListener("click", zoomToJourney));
  body.querySelectorAll("span.journeyLocate.pointer").forEach(el => void el.addEventListener("click", zoomToEndpoint));
  body.querySelectorAll("span.journeyEdit").forEach(el => void el.addEventListener("click", openJourneyEditor));
  body.querySelectorAll("span.journeyVisible").forEach(el => void el.addEventListener("click", toggleVisibility));
  body.querySelectorAll("span.locks").forEach(el => void el.addEventListener("click", toggleLockStatus));
  body.querySelectorAll("span.journeyRemove").forEach(el => void el.addEventListener("click", triggerJourneyRemove));

  renderEditorPagination(ensureEl("journeysFooter"), view, journeysTable.goto);
}

function renderEndpoint(endpoint: "from" | "to", cellId: number | undefined): string {
  const label = escapeHtml(cellEndpointLabel(cellId)); // burg names are user-editable
  const isSet = cellId !== undefined;
  const what = endpoint === "from" ? "Start of the first segment" : "End of the last segment";

  return /* html */ `<div data-tip="${what}" data-col="${endpoint}">
    <span class="journeyLocate icon-target ${isSet ? "pointer" : "inactive"}" data-cell="${cellId ?? ""}"
      data-tip="${isSet ? `Zoom to ${label}` : "Endpoint is not set"}"></span>
    <span>${label}</span>
  </div>`;
}

const getLineJourney = (el: HTMLElement): Journey | undefined =>
  pack.journeys.find(journey => journey.i === getRowId(el));

const getStart = (journey: Journey) => journey.segments[0]?.from;

const getEnd = (journey: Journey) => journey.segments.at(-1)?.to;

function journeyHighlightOn(this: HTMLElement): void {
  Layers.show("journeys");
  startJourneyTravel(getRowId(this));
}

function zoomToJourney(this: HTMLElement): void {
  const group = findEl<SVGGElement>(`journey${getRowId(this)}`);
  if (group) highlightElement(group, 2);
}

function zoomToEndpoint(this: HTMLElement): void {
  const point = getCellPoint(Number(this.dataset.cell));
  if (point) zoomTo(point[0], point[1], 8, 2000);
}

function changeJourneyColor(this: FillBoxElement): void {
  const journey = getLineJourney(this);
  if (!journey) return;

  void Controllers.ColorPicker.open(this.fill, (fill: string) => {
    journey.color = fill;
    this.fill = fill;
    Layers.draw("journeys");
  });
}

function openJourneyEditor(this: HTMLElement): void {
  void Controllers.JourneyEditor.open(getRowId(this));
}

function createEmptyJourney(): void {
  const journey = Journeys.addEmpty();
  Layers.draw("journeys");
  journeysTable.refresh();
  void Controllers.JourneyEditor.open(journey.i);
}

function generateRandomJourney(): void {
  const journey = Journeys.addRandom();
  if (!journey) {
    tip("Can't plot a journey: the map needs at least two burgs connected by land or sea", true, "error", 6000);
    return;
  }

  Layers.draw("journeys");
  journeysTable.refresh();
  tip(`Generated "${escapeHtml(journey.name)}": ${journey.segments.length} segments`, true, "success", 6000);
}

function toggleVisibility(this: HTMLElement): void {
  const journey = getLineJourney(this);
  if (!journey) return;

  Journeys.toggleVisibility(journey);
  Layers.draw("journeys");
  journeysTable.refresh();
}

function toggleLockStatus(this: HTMLElement): void {
  const journey = getLineJourney(this);
  if (!journey) return;
  journey.lock = !journey.lock;
  journeysTable.refresh();
}

function toggleLockAll(): void {
  const allLocked = pack.journeys.every(journey => journey.lock);
  for (const journey of pack.journeys) journey.lock = !allLocked;
  journeysTable.refresh();
}

function triggerJourneyRemove(this: HTMLElement): void {
  const journeyId = getRowId(this);
  confirmationDialog({
    title: "Remove journey",
    message: "Are you sure you want to remove the journey? <br>This action cannot be reverted.",
    confirm: "Remove",
    onConfirm: () => {
      Journeys.remove(journeyId);
      Layers.draw("journeys");
      journeysTable.refresh();
    }
  });
}

function triggerAllJourneysRemove(): void {
  const unlocked = pack.journeys.filter(journey => !journey.lock);
  if (!unlocked.length) {
    tip("No unlocked journeys to remove", true, "error", 6000);
    return;
  }

  confirmationDialog({
    title: "Remove all journeys",
    message: `Remove all <b>unlocked</b> journeys (${unlocked.length})? Locked ones will be kept.`,
    confirm: "Remove",
    onConfirm: () => {
      pack.journeys = pack.journeys.filter(journey => journey.lock);
      Layers.draw("journeys");
      journeysTable.refresh();
    }
  });
}

function downloadJourneysData(): void {
  const unit = getDistanceUnit();
  let data = `Id,Journey,Type,From,To,Segments,Distance(${unit}),AvgSpeed(${unit}/h),TravelHours,TotalDays\n`; // headers

  for (const journey of journeysTable.view().all) {
    const { totalDistance, totalHours, avgSpeed, totalDays } = Journeys.getTotals(journey);
    const places = [cellEndpointLabel(getStart(journey)), cellEndpointLabel(getEnd(journey))];
    const values = [
      journey.i,
      toCsvField(journey.name),
      toCsvField(journey.type),
      toCsvField(places[0]),
      toCsvField(places[1]),
      journey.segments.length,
      rn(totalDistance, 2),
      convertSpeed(avgSpeed),
      rn(totalHours, 2),
      rn(totalDays, 2) // calendar days from start to finish, a full travel day counting as a whole day
    ];
    data += `${values.join(",")}\n`;
  }

  downloadFile(data, `${getFileName("Journeys")}.csv`);
}

function onClose(): void {
  stopJourneyTravel();
  destroyDialog(dialogId);
}

export const JourneysOverview = { open };
