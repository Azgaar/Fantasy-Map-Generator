import { select } from "d3";
import { closeDialogs, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import { getDefaultTransportTypes } from "@/data/transport-types";
import { drawJourneys } from "@/renderers/draw-journeys";
import { highlightElement } from "@/renderers/overlays/highlight";
import type { Journey } from "@/types/Journey";
import { downloadFile, getFileName, rn } from "@/utils";
import { formatTravelTime, journeyTotals } from "@/utils/journey-metrics";
import { destroyDialogIfExists, ensureEl } from "../utils";

function open(): void {
  if (customization) return;
  closeDialogs("#journeysOverview, .stable");
  if (!layerIsOn("toggleJourneys")) toggleJourneys();

  ensureJourneysArray();
  renderDialog();
  addLines();

  $("#journeysOverview").dialog({
    title: "Journeys Overview",
    resizable: false,
    width: "fit-content",
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" },
    close: onClose
  });
}

function ensureJourneysArray(): void {
  if (!pack.journeys) pack.journeys = [];
  if (!pack.transportTypes?.length) pack.transportTypes = getDefaultTransportTypes();
}

function renderDialog(): void {
  destroyDialogIfExists("journeysOverview");

  const html = /* html */ `<div id="journeysOverview" class="dialog stable">
    <div id="journeysHeader" class="header" style="grid-template-columns: 15em 5em 6em 6em 8em 5em 5em">
      <div class="sortable alphabetically" data-sortby="name">Journey&nbsp;</div>
      <div class="sortable icon-sort-number-down" data-sortby="segments">Segs&nbsp;</div>
      <div class="sortable icon-sort-number-down" data-sortby="distance">Distance&nbsp;</div>
      <div class="sortable icon-sort-number-down" data-sortby="avgspeed">Avg spd&nbsp;</div>
      <div class="sortable" data-sortby="time">Travel time&nbsp;</div>
      <div></div>
      <div></div>
    </div>
    <div id="journeysBody" class="table"></div>
    <div id="journeysFooter" class="totalLine">
      <div style="margin-left: 4px">Journeys:&nbsp;<span id="journeysFooterNumber">0</span></div>
      <div style="margin-left: 12px">Total distance:&nbsp;<span id="journeysFooterDistance">0</span></div>
    </div>
    <div id="journeysBottom">
      <button id="journeysOverviewRefresh" data-tip="Refresh the list" class="icon-cw"></button>
      <button id="journeyCreateNew" data-tip="Create a new journey" class="icon-plus"></button>
      <button id="journeysExport" data-tip="Download journeys summary as CSV" class="icon-download"></button>
      <button id="journeysEditTransport" data-tip="Edit transport types (add custom modes like Magic Carpet)" class="icon-cog"></button>
      <button id="journeysLockAll" data-tip="Lock or unlock all journeys" class="icon-lock"></button>
      <button id="journeysRemoveAll" data-tip="Remove all unlocked journeys" class="icon-trash"></button>
      <label for="journeysSearch" style="margin-left: 0.2em">Search: <input id="journeysSearch" type="search" /></label>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl("journeysOverviewRefresh").on("click", addLines);
  ensureEl("journeyCreateNew").on("click", createNewJourney);
  ensureEl("journeysExport").on("click", downloadJourneys);
  ensureEl("journeysEditTransport").on("click", () => void Controllers.TransportTypesEditor.open());
  ensureEl("journeysLockAll").on("click", toggleLockAll);
  ensureEl("journeysRemoveAll").on("click", removeAllJourneys);
  ensureEl("journeysSearch").on("input", addLines);
}

function addLines(): void {
  const body = ensureEl("journeysBody");
  body.innerHTML = "";
  const searchText = ensureEl<HTMLInputElement>("journeysSearch").value.toLowerCase().trim();

  let list = pack.journeys;
  if (searchText) list = list.filter(j => (j.name || "").toLowerCase().includes(searchText));

  const rows: string[] = [];
  let grandKm = 0;
  for (const journey of list) {
    const totals = journeyTotals(journey);
    grandKm += totals.totalKm;
    const distance = `${rn(totals.totalKm)} ${distanceUnitInput.value}`;
    const speed = totals.avgSpeed ? `${rn(totals.avgSpeed, 1)} ${distanceUnitInput.value}/h` : "-";
    const time = formatTravelTime(totals.totalHours);
    rows.push(/* html */ `<div
      class="states"
      data-id="${journey.i}"
      data-name="${journey.name}"
      data-segments="${journey.segments.length}"
      data-distance="${totals.totalKm}"
      data-avgspeed="${totals.avgSpeed}"
      data-time="${totals.totalHours}"
    >
      <span data-tip="Locate the journey" class="icon-target"></span>
      <div style="width: 13em; margin-left: 0.4em;">${journey.name}</div>
      <div style="width: 4em;">${journey.segments.length}</div>
      <div style="width: 6em;">${distance}</div>
      <div style="width: 6em;">${speed}</div>
      <div style="width: 7em;">${time}</div>
      <span data-tip="Edit journey" class="icon-pencil"></span>
      <span class="locks pointer ${journey.lock ? "icon-lock" : "icon-lock-open inactive"}"
        onmouseover="showElementLockTip(event)"></span>
      <span data-tip="Remove journey" class="icon-trash-empty"></span>
    </div>`);
  }
  body.insertAdjacentHTML("beforeend", rows.join(""));

  ensureEl("journeysFooterNumber").innerHTML = `${list.length} of ${pack.journeys.length}`;
  ensureEl("journeysFooterDistance").innerHTML = `${rn(grandKm)} ${distanceUnitInput.value}`;

  body.querySelectorAll("div.states").forEach(el => void el.on("mouseenter", journeyHighlightOn));
  body.querySelectorAll("div.states").forEach(el => void el.on("mouseleave", journeyHighlightOff));
  body.querySelectorAll("div > span.icon-target").forEach(el => void el.on("click", zoomToJourney));
  body.querySelectorAll("div > span.icon-pencil").forEach(el => void el.on("click", openJourneyEditor));
  body.querySelectorAll("div > span.locks").forEach(el => void el.on("click", toggleLockStatus));
  body.querySelectorAll("div > span.icon-trash-empty").forEach(el => void el.on("click", removeOne));
}

function createNewJourney(): void {
  ensureJourneysArray();
  const id = pack.journeys.length ? Math.max(...pack.journeys.map(j => j.i)) + 1 : 0;
  const newJourney: Journey = {
    i: id,
    name: `Journey ${id + 1}`,
    visible: true,
    color: "#8b1a1a",
    segments: []
  };
  pack.journeys.push(newJourney);
  drawJourneys();
  addLines();
  void Controllers.JourneyEditor.open(id);
}

function journeyHighlightOn(event: Event): void {
  if (!layerIsOn("toggleJourneys")) toggleJourneys();
  const id = +(event.target as HTMLElement).dataset.id!;
  select("#journeys").select(`#journey${id}`).selectAll("path").attr("stroke-width", 3);
}

function journeyHighlightOff(e: Event): void {
  const id = +(e.target as HTMLElement).dataset.id!;
  select("#journeys").select(`#journey${id}`).selectAll("path").attr("stroke-width", null);
}

function zoomToJourney(this: HTMLElement): void {
  const id = +(this.parentNode as HTMLElement).dataset.id!;
  const g = select("#journeys").select(`#journey${id}`).node() as Element;
  if (g) highlightElement(g, 3);
}

function openJourneyEditor(this: HTMLElement): void {
  const id = +(this.parentNode as HTMLElement).dataset.id!;
  void Controllers.JourneyEditor.open(id);
}

function toggleLockStatus(this: HTMLElement): void {
  const id = +(this.parentNode as HTMLElement).dataset.id!;
  const j = pack.journeys.find(jj => jj.i === id);
  if (!j) return;
  j.lock = !j.lock;
  addLines();
}

function toggleLockAll(): void {
  const allLocked = pack.journeys.every(j => j.lock);
  pack.journeys.forEach(j => {
    j.lock = !allLocked;
  });
  addLines();
}

function removeOne(this: HTMLElement): void {
  const id = +(this.parentNode as HTMLElement).dataset.id!;
  confirmationDialog({
    title: "Remove journey",
    message: "Are you sure you want to remove this journey? <br>This action cannot be reverted.",
    confirm: "Remove",
    onConfirm: () => {
      pack.journeys = pack.journeys.filter(j => j.i !== id);
      drawJourneys();
      addLines();
    }
  });
}

function removeAllJourneys(): void {
  const toRemove = pack.journeys.filter(j => !j.lock);
  if (!toRemove.length) {
    tip("No unlocked journeys to remove", true, "error", 9000);
    return;
  }
  confirmationDialog({
    title: "Remove all journeys",
    message: `Remove all <b>unlocked</b> journeys (${toRemove.length})? Locked ones will be kept.`,
    confirm: "Remove",
    onConfirm: () => {
      pack.journeys = pack.journeys.filter(j => j.lock);
      drawJourneys();
      addLines();
    }
  });
}

function downloadJourneys(): void {
  const unit = distanceUnitInput.value;
  let data = `Id,Name,Segments,Distance(${unit}),AvgSpeed(${unit}/h),TravelHours\n`;
  for (const j of pack.journeys) {
    const t = journeyTotals(j);
    data += `${j.i},"${j.name}",${j.segments.length},${rn(t.totalKm, 2)},${rn(t.avgSpeed, 2)},${rn(t.totalHours, 2)}\n`;
  }
  downloadFile(data, `${getFileName("Journeys")}.csv`);
}

function onClose(): void {
  destroyDialogIfExists("journeysOverview");
}

export const JourneysOverview = { open };
