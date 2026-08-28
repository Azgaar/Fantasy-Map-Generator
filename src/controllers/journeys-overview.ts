import { closeDialogs, confirmationDialog, destroyDialog, updateDialog } from "@/components/dialog/dialog-helpers";
import { applyLineHighlighting } from "@/components/dialog/highlighting";
import { bindColumnSorting, sortDataByColumns } from "@/components/dialog/sorting";
import { dialogState } from "@/components/dialog/state";
import {
  type EditorColumn,
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
import { highlightElement } from "@/renderers/overlays/highlight";
import type { Journey } from "@/types/Journey";
import { downloadFile, ensureEl, findEl, getFileName, getHoursPerDay, rn } from "@/utils";
import { cellEndpointLabel } from "@/utils/cell-labels";

const dialogId = "journeysOverview" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
let filterState: { search: string };

const columns: EditorColumn<Journey>[] = [
  { key: "locate", width: "1.4em", permanent: true },
  { key: "name", label: "Journey", width: "14em", permanent: true, sortBy: j => j.name || "", sortType: "alpha" },
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
    label: "Duration",
    width: "7em",
    tip: "Total travel time",
    mobileHidden: true,
    sortBy: j => Journeys.getTotals(j).totalHours
  },
  { key: "actions", width: "3.6em", permanent: true, align: "right" }
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
    return [journey.name, ...places].some(value => (value || "").toLowerCase().includes(searchText));
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
      <label for="journeysSearch" data-tip="Filter by journey name or endpoint">Search: <input id="journeysSearch" type="search" /></label>
    </div>

    <div id="journeysFooter" class="totalLine">
      <div data-tip="Journeys number" style="margin-left: 4px">Journeys:&nbsp;<span id="journeysFooterNumber">0</span></div>
      <div data-tip="Total distance" style="margin-left: 12px" data-col="distance">Distance:&nbsp;<span id="journeysFooterDistance">0</span></div>
      <div data-tip="Total travel time" style="margin-left: 12px" data-col="time">Time:&nbsp;<span id="journeysFooterTime">0</span></div>
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
  ensureEl("journeysEditTransport").addEventListener("click", () => void Controllers.TransportTypesEditor.open());
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

  const unit = distanceUnitInput.value;
  const hoursPerDay = getHoursPerDay();
  let lines = "";

  for (const journey of view.rows) {
    const { totalDistance, totalHours, avgSpeed } = Journeys.getTotals(journey);
    lines += /* html */ `<div class="states" data-id="${journey.i}">
      <span data-tip="Locate the journey" class="icon-target" data-col="locate"></span>
      <div data-col="name" style="width: 93%; overflow: hidden">
        <fill-box class="journeyColor" fill="${journey.color}" size="0.8em" data-tip="Journey color. Click to change"></fill-box>
        <span data-tip="Journey name">${journey.name}</span>
      </div>
      <div data-tip="Start of the first segment" data-col="from">${cellEndpointLabel(getStart(journey))}</div>
      <div data-tip="End of the last segment" data-col="to">${cellEndpointLabel(getEnd(journey))}</div>
      <div data-tip="Total distance" data-col="distance">${rn(totalDistance)} ${unit}</div>
      <div data-tip="Average speed, moving segments only" data-col="speed">${avgSpeed ? `${rn(avgSpeed, 1)} ${unit}/h` : "-"}</div>
      <div data-tip="Total travel time: ${Journeys.formatTravelTimeFull(totalHours, hoursPerDay)}" data-col="time">${Journeys.formatTravelTime(totalHours, hoursPerDay)}</div>
      <div data-col="actions">
        <span data-tip="Edit journey" class="icon-pencil"></span>
        <span class="locks pointer ${journey.lock ? "icon-lock" : "icon-lock-open inactive"}" onmouseover="showElementLockTip(event)"></span>
        <span data-tip="Remove journey" class="icon-trash-empty"></span>
      </div>
    </div>`;
  }
  body.insertAdjacentHTML("beforeend", lines);

  const totals = view.all.map(journey => Journeys.getTotals(journey));
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  ensureEl("journeysFooterNumber").innerHTML = `${view.all.length} of ${pack.journeys.length}`;
  ensureEl("journeysFooterDistance").innerHTML = `${rn(sum(totals.map(t => t.totalDistance)))} ${unit}`;
  const totalHours = sum(totals.map(t => t.totalHours));
  const footerTime = ensureEl("journeysFooterTime");
  footerTime.innerHTML = Journeys.formatTravelTime(totalHours, hoursPerDay);
  footerTime.parentElement!.dataset.tip = `Total travel time at ${hoursPerDay}h/day: ${Journeys.formatTravelTimeFull(totalHours, hoursPerDay)}`;

  // add listeners
  body.querySelectorAll("div.states").forEach(el => void el.addEventListener("mouseenter", journeyHighlightOn));
  body.querySelectorAll("div.states").forEach(el => void el.addEventListener("mouseleave", journeyHighlightOff));
  body.querySelectorAll("fill-box.journeyColor").forEach(el => void el.addEventListener("click", changeJourneyColor));
  body.querySelectorAll("span.icon-target").forEach(el => void el.addEventListener("click", zoomToJourney));
  body.querySelectorAll("span.icon-pencil").forEach(el => void el.addEventListener("click", openJourneyEditor));
  body.querySelectorAll("span.locks").forEach(el => void el.addEventListener("click", toggleLockStatus));
  body.querySelectorAll("span.icon-trash-empty").forEach(el => void el.addEventListener("click", triggerJourneyRemove));

  renderEditorPagination(ensureEl("journeysFooter"), view, journeysTable.goto);
}

const getLineId = (el: HTMLElement): number => +(el.closest<HTMLElement>(".states")?.dataset.id ?? "-1");

function getStart(journey: Journey) {
  return journey.segments[0]?.from;
}

function getEnd(journey: Journey) {
  return journey.segments[journey.segments.length - 1]?.to;
}

const getJourneyPaths = (journeyId: number): SVGPathElement[] =>
  Array.from(document.querySelectorAll<SVGPathElement>(`#journeys > #journey${journeyId} > path`));

function journeyHighlightOn(this: HTMLElement): void {
  Layers.show("journeys");
  for (const path of getJourneyPaths(getLineId(this))) path.setAttribute("stroke-width", "3");
}

function journeyHighlightOff(this: HTMLElement): void {
  for (const path of getJourneyPaths(getLineId(this))) path.removeAttribute("stroke-width");
}

function zoomToJourney(this: HTMLElement): void {
  const group = findEl<SVGGElement>(`journey${getLineId(this)}`);
  if (group) highlightElement(group, 3);
}

function changeJourneyColor(this: FillBoxElement): void {
  const journey = pack.journeys.find(j => j.i === getLineId(this));
  if (!journey) return;

  void Controllers.ColorPicker.open(this.fill, (fill: string) => {
    journey.color = fill;
    this.fill = fill;
    Layers.draw("journeys");
  });
}

function openJourneyEditor(this: HTMLElement): void {
  void Controllers.JourneyEditor.open(getLineId(this));
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
  tip(`Generated "${journey.name}": ${journey.segments.length} segments`, true, "success", 6000);
}

function toggleLockStatus(this: HTMLElement): void {
  const journey = pack.journeys.find(j => j.i === getLineId(this));
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
  const journeyId = getLineId(this);
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
  const unit = distanceUnitInput.value;
  let data = `Id,Journey,From,To,Segments,Distance(${unit}),AvgSpeed(${unit}/h),TravelHours\n`; // headers

  for (const journey of journeysTable.view().all) {
    const { totalDistance, totalHours, avgSpeed } = Journeys.getTotals(journey);
    const places = [cellEndpointLabel(getStart(journey)), cellEndpointLabel(getEnd(journey))];
    const values = [
      journey.i,
      `"${journey.name}"`,
      `"${places[0]}"`,
      `"${places[1]}"`,
      journey.segments.length,
      rn(totalDistance, 2),
      rn(avgSpeed, 2),
      rn(totalHours, 2)
    ];
    data += `${values.join(",")}\n`;
  }

  downloadFile(data, `${getFileName("Journeys")}.csv`);
}

function onClose(): void {
  destroyDialog(dialogId);
}

export const JourneysOverview = { open };
