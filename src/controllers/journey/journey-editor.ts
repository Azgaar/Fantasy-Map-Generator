import {
  alertDialog,
  closeDialogs,
  confirmationDialog,
  destroyDialog,
  updateDialog
} from "@/components/dialog/dialog-helpers";
import { applyLineHighlighting } from "@/components/dialog/highlighting";
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
import {
  type CellPlace,
  cellEndpointLabel,
  getCellPoint,
  resolveCellPlace
} from "@/generators/journeys/journey-places";
import { startJourneyTravel, stopJourneyTravel } from "@/renderers/journey-travel";
import type { Journey, JourneySegment } from "@/types/Journey";
import {
  convertSpeed,
  downloadFile,
  ensureEl,
  escapeHtml,
  findEl,
  formatSpeed,
  getDistanceUnit,
  getFileName,
  parseSpeed,
  rn,
  toCsvField
} from "@/utils";
import { domainMismatchMessage, JourneyPathEditor, recomputeSegment } from "./journey-path-editor";

const dialogId = "journeyEditor" as const;
const MAP_POSITION = { my: "left top", at: "left+10 top+10", of: "#map", collision: "fit" };
const OVERVIEW_POSITION = { my: "right top", at: "right bottom+10", of: "#journeysOverview", collision: "fit" };

let editingJourneyId: number | null = null;

const columns: EditorColumn<JourneySegment>[] = [
  { key: "color", width: "1.2em" },
  { key: "name", label: "Name", width: "14em", permanent: true },
  { key: "from", label: "From", width: "11em", mobileHidden: true },
  { key: "to", label: "To", width: "11em", mobileHidden: true },
  { key: "transport", label: "Transport", width: "10em" },
  { key: "distance", label: "Distance", width: "5em" },
  { key: "speed", label: "Speed", width: "5em", mobileHidden: true },
  { key: "time", label: "Time", width: "5em" },
  { key: "roads", width: "1.4em", mobileHidden: true },
  { key: "visible", width: "1.4em", mobileHidden: true },
  { key: "points", width: "1.4em", mobileHidden: true },
  { key: "draw", width: "1.4em", mobileHidden: true },
  { key: "reset", width: "1.4em" },
  { key: "move", width: "1.4em", mobileHidden: true },
  { key: "delete", width: "1.4em", permanent: true }
];

const segmentsTable = initEditorTable<JourneySegment>({
  getData: () => getJourney()?.segments ?? [],
  onUpdate: renderSegmentsPage
});

const pathEditor = new JourneyPathEditor({ getJourney, getSegment, refresh: segmentsTable.refresh });

function open(journeyId: number): void {
  if (customization) return;

  if (editingJourneyId === journeyId) {
    // an armed on-map mode owns the click that got us here, e.g. drawing over the journey's own path
    if (pathEditor.isActive()) return;
    // re-opening the journey already being edited should not rebuild the dialog
    if (findEl(dialogId)?.offsetParent) {
      segmentsTable.refresh();
      return;
    }
  }

  teardown();
  closeDialogs(`#${dialogId}, .stable`);
  Layers.show("journeys");

  Journeys.sync();
  editingJourneyId = journeyId;

  const journey = getJourney();
  if (!journey) {
    tip("Journey not found", true, "error", 6000);
    return;
  }

  renderDialog(journey);
  segmentsTable.reset();

  $(`#${dialogId}`).dialog({
    title: "Edit Journey",
    resizable: false,
    width: "fit-content",
    position: findEl("journeysOverview") ? OVERVIEW_POSITION : MAP_POSITION,
    close: onClose
  });
}

function teardown(): void {
  stopJourneyTravel();
  pathEditor.cancel();
}

function getJourney(): Journey | undefined {
  if (editingJourneyId === null) return undefined;
  return pack.journeys.find(journey => journey.i === editingJourneyId);
}

function getSegment(id: number): JourneySegment | undefined {
  return getJourney()?.segments.find(segment => segment.i === id);
}

const getLineSegment = (el: HTMLElement): JourneySegment | undefined => getSegment(getRowId(el));

function renderDialog(journey: Journey): void {
  destroyDialog(dialogId);

  const html = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
    <div id="segmentsBody" class="table">${renderEditorHeader({ dialogId, columns })}</div>

    <div id="journeyControls" class="editorFilters" style="flex-direction: row; align-items: center">
      <fill-box id="journeyColor" size="1em" data-tip="Journey color. Click to change" fill="${journey.color}"></fill-box>
      <label for="journeyName" data-tip="Journey name" style="flex: 1; grid-template-columns: 3.2em 1fr">Name:
        <input id="journeyName" type="text" value="${escapeHtml(journey.name)}" />
      </label>
      <label for="journeyType" data-tip="Kind of travel this is: a quest, a caravan, a campaign"
        style="flex: 0 1 14em; grid-template-columns: 3.2em 1fr">Type:
        <input id="journeyType" type="text" value="${escapeHtml(journey.type)}" />
      </label>
    </div>

    <div id="journeyFooter" class="totalLine">
      <div data-tip="Total distance" data-col="distance">Distance:&nbsp;<span id="journeyTotalDistance">0</span></div>
      <div data-tip="Average speed, segments with non-zero speed only" style="margin-left: 12px" data-col="speed">Avg speed:&nbsp;<span id="journeyAvgSpeed">0</span></div>
      <div data-tip="Total time" style="margin-left: 12px" data-col="time">Total time:&nbsp;<span id="journeyTotalTime">0</span></div>
      <div data-tip="Travel time" style="margin-left: 12px" data-col="time">Travel time:&nbsp;<span id="journeyTravelTime">0</span></div>
    </div>

    <div id="journeyBottom" class="editorToolbar">
      <button id="journeyEditorRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
      <button id="journeyAddSegment" data-tip="Add a segment to the journey" class="icon-plus"></button>
      <button id="journeyEditTransport" data-tip="Edit transport types" class="icon-cog"></button>
      <button id="journeyExport" data-tip="Save journey segments as a text file (.csv)" class="icon-download"></button>
      <button id="journeyRemove" data-tip="Remove the journey" class="icon-trash"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  applyLineHighlighting(dialogId, ({ target }) => {
    const path = target.closest<SVGElement>("#journeys path[id^='segment']");
    if (!path) return undefined;
    const [journeyId, segmentId] = path.id.slice("segment".length).split("_").map(Number);
    return journeyId === editingJourneyId ? segmentId : undefined;
  });

  ensureEl("journeyEditorRefresh").addEventListener("click", segmentsTable.refresh);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () =>
      updateDialog(dialogId, {
        width: "fit-content",
        position: findEl("journeysOverview") ? OVERVIEW_POSITION : MAP_POSITION
      })
  });
  ensureEl("journeyName").addEventListener("input", onNameInput);
  ensureEl("journeyType").addEventListener("input", onTypeInput);
  ensureEl("journeyColor").addEventListener("click", onColorPick);
  ensureEl("journeyAddSegment").addEventListener("click", addSegment);
  ensureEl("journeyEditTransport").addEventListener("click", () => void Controllers.TransportEditor.open());
  ensureEl("journeyExport").addEventListener("click", downloadSegmentsData);
  ensureEl("journeyRemove").addEventListener("click", triggerJourneyRemove);
}

function renderSegmentsPage(view: TableView<JourneySegment>): void {
  const journey = getJourney();
  if (!journey) return;

  const body = ensureEl("segmentsBody");
  // removed rows never fire mouseleave, so a hover-started travel animation would loop forever
  stopJourneyTravel();
  body.querySelectorAll(":scope > .states").forEach(row => {
    row.remove();
  });
  body.insertAdjacentHTML("beforeend", view.rows.map(segment => renderSegmentLine(journey, segment)).join(""));

  const on = (selector: string, event: string, handler: EventListener) => {
    body.querySelectorAll<HTMLElement>(selector).forEach(el => void el.addEventListener(event, handler));
  };

  on(".segName", "input", onSegNameInput);
  on(".segTransport", "change", onSegTransportChange);
  on(".segSpeed:not([disabled])", "input", onSegSpeedInput);
  on(".segDuration", "input", onSegDurationInput);
  on(".segLocate.pointer", "click", onLocateEndpoint);
  on(".segFrom", "click", onPickFrom);
  on(".segTo", "click", onPickTo);
  on(".segRoads.pointer", "click", onToggleAvoidRoads);
  on(".segColor", "click", onSegColorPick);
  on(".segVisible", "click", onToggleSegVisible);
  on(".segPoints.pointer", "click", onToggleEditPoints);
  on(".segDraw.pointer", "click", onToggleDrawPath);
  on(".segReset", "click", onSegReset);
  on(".segUp.pointer", "click", onSegMoveUp);
  on(".segDelete", "click", onSegDelete);
  on(".states", "mouseenter", segmentHighlightOn);
  on(".states", "mouseleave", segmentHighlightOff);

  updateTotals(journey);
  renderEditorPagination(ensureEl("journeyFooter"), view, segmentsTable.goto);

  Layers.draw("journeys");
  pathEditor.drawOverlays();
}

function renderSegmentLine(journey: Journey, segment: JourneySegment): string {
  const unit = getDistanceUnit();
  const index = journey.segments.indexOf(segment);
  const domain = Transports.getDomain(segment.transport);
  const isStay = domain === "stay";

  const isEditingPoints = pathEditor.isEditing(segment.i, "points");
  const isDrawing = pathEditor.isEditing(segment.i, "draw");
  const canEditPoints = segment.points.length >= 2 && !isStay;

  const hours = Journeys.getSegmentTime(segment);

  return /* html */ `<div class="states" data-id="${segment.i}">
    <div data-col="color">
      <fill-box class="segColor" fill="${segment.color || journey.color}" data-tip="Segment color. Click to change"></fill-box>
    </div>
    <div data-col="name" style="width: 95%; overflow: hidden">
      <input class="segName" value="${escapeHtml(segment.name)}" data-tip="Segment name: ${escapeHtml(segment.name)}" />
    </div>
    ${renderEndpointCell("from", segment)}
    ${renderEndpointCell("to", segment)}
    <div data-col="transport"><select class="segTransport" data-tip="Transport type, sets the default speed and where the segment may go">${Transports.all
      .map(
        type =>
          `<option value="${escapeHtml(type.name)}" ${type.name === segment.transport ? "selected" : ""}>${escapeHtml(type.name)}</option>`
      )
      .join("")}</select></div>
    <div data-tip="Segment distance" data-col="distance">${rn(Journeys.getSegmentDistance(segment))} ${unit}</div>
    <div data-col="speed">
      <input class="segSpeed" type="number" step="0.1" min="0" value="${convertSpeed(segment.speed)}" ${isStay ? "disabled" : ""}
        data-tip="${isStay ? "A stay covers no ground, so it has no speed" : `Average travel speed in ${unit}/h, type to override. ${segment.avoidRoads ? `Off-road speed: ${convertSpeed(Journeys.getEffectiveSpeed(segment))}` : ""}`}" />
    </div>
    <div data-col="time" data-tip="${timeCellTip(segment)}">
      <input class="segDuration" type="number" min="0" step="0.1" value="${rn(hours, 1)}"/>
    </div>
    <div data-col="roads">
      <span class="segRoads pointer ${segment.avoidRoads ? "icon-tree" : "icon-map-signs"} ${domain === "land" ? "" : "hidden"}" data-tip="${segment.avoidRoads ? `Off-road: avoids the road network. Click to follow roads.` : `On-road: follows the road network at full speed. Click to go off-road.`}"></span>
    </div>
    <div data-col="visible">
      <span class="segVisible pointer ${segment.visible === false ? "icon-eye-off" : "icon-eye"}" data-tip="Toggle segment visibility"></span>
    </div>
    <div data-col="points">
      <span class="segPoints icon-pencil ${canEditPoints ? "pointer" : "inactive"}" ${isEditingPoints ? ` style="color: #2a6e2a"` : ""}
        data-tip="${!canEditPoints ? "Set both endpoints first" : isEditingPoints ? "Finish editing path points" : "Edit path points"}"></span>
    </div>
    <div data-col="draw">
      <span class="segDraw icon-brush ${isStay ? "inactive" : "pointer"}" ${isDrawing ? ` style="color: #2a6e2a"` : ""}
        data-tip="${isDrawing ? "Click to finish drawing (Esc to cancel)" : "Draw a custom path cell by cell"}"></span>
    </div>
    <div data-col="reset">
      <span class="segReset pointer icon-cw" data-tip="Reset the segment: recompute the path and restore the default color, speed and time"></span>
    </div>
    <div data-col="move">
      <span class="segUp icon-up-open ${index ? "pointer" : "inactive"}" data-tip="Move the segment up"></span>
    </div>
    <div data-col="delete">
      <span class="segDelete pointer icon-trash-empty" data-tip="Remove the segment"></span>
    </div>
  </div>`;
}

/** What the time column explains: the hours in the input, spelled out at the transport's travel day */
function timeCellTip(segment: JourneySegment): string {
  const hoursPerDay = Journeys.getSegmentHoursPerDay(segment); // each transport sustains its own travel day
  const full = Journeys.formatTravelTimeFull(Journeys.getSegmentElapsedHours(segment));
  return `Travel time in hours, type to override. Takes ${full} at ${hoursPerDay}h of travel per day`;
}

/**
 * Re-render the row's time cell alone. Used while the speed input next to it has focus, where
 * rebuilding the whole row would take the field the user is typing in with it.
 */
function syncTimeCell(el: HTMLElement, segment: JourneySegment): void {
  const cell = el.closest<HTMLElement>(".states")?.querySelector<HTMLElement>('[data-col="time"]');
  const duration = cell?.querySelector<HTMLInputElement>(".segDuration");
  if (!cell || !duration) return;

  cell.dataset.tip = timeCellTip(segment);
  if (document.activeElement !== duration) duration.value = String(rn(Journeys.getSegmentTime(segment), 1));
}

/** Longer endpoint tooltip; distinguishes the three cases explicitly */
function cellEndpointTooltip(cellId: number | undefined, place: CellPlace): string {
  if (cellId === undefined) return "Not set: click, then click a cell on the map to set this endpoint";
  const what = !place ? `Cell ${cellId}` : place.nearby ? `Vicinity of ${place.burg.name}` : place.burg.name;
  return `${what}, click to pick a different cell`;
}

/** Locate icon to zoom to the place, then the place name itself to re-pick the cell */
function renderEndpointCell(endpoint: "from" | "to", segment: JourneySegment): string {
  const cellId = segment[endpoint];
  const isSet = cellId !== undefined;
  const place = isSet ? resolveCellPlace(cellId) : null; // resolved once, worded twice below
  const label = escapeHtml(cellEndpointLabel(cellId, place)); // burg names are user-editable

  return /* html */ `<div data-col="${endpoint}">
    <span class="segLocate icon-target ${isSet ? "pointer" : "inactive"}" data-endpoint="${endpoint}"
      data-tip="${isSet ? `Zoom to ${label}` : "Set the endpoint first"}"></span>
    <span class="seg${endpoint === "from" ? "From" : "To"} pointer" data-tip="${escapeHtml(cellEndpointTooltip(cellId, place))}"
      ${isSet ? "" : 'style="opacity: 0.55; font-style: italic"'}>${label}</span>
  </div>`;
}

function updateTotals(journey: Journey): void {
  const unit = getDistanceUnit();
  const { totalDistance, totalHours, avgSpeed, elapsedHours, hiddenSegments } = Journeys.getTotals(journey);
  const hiddenNote = hiddenSegments
    ? ` ${hiddenSegments} hidden segment${hiddenSegments > 1 ? "s" : ""} left out.`
    : "";

  ensureEl("journeyTotalDistance").innerHTML = `${rn(totalDistance)} ${unit}`;
  ensureEl("journeyAvgSpeed").innerHTML = avgSpeed ? formatSpeed(avgSpeed) : "-";

  // the two clocks the journey runs on: days on the calendar, hours actually spent on the road
  const totalTime = ensureEl("journeyTotalTime");
  totalTime.innerHTML = Journeys.formatTravelTime(elapsedHours);
  totalTime.parentElement!.dataset.tip = `Time from start to finish: ${Journeys.formatTravelTimeFull(elapsedHours)}. A day of travel fills a whole day, however many hours the transport sustains.${hiddenNote}`;

  const travelTime = ensureEl("journeyTravelTime");
  travelTime.innerHTML = Journeys.formatHours(totalHours);
  travelTime.parentElement!.dataset.tip = `Hours spent moving or waiting: ${rn(totalHours, 1)}h, the sum of the segment times. Rest between travel days is not counted.${hiddenNote}`;
}

function onNameInput(this: HTMLInputElement): void {
  const journey = getJourney();
  if (journey) journey.name = this.value;
}

function onTypeInput(this: HTMLInputElement): void {
  const journey = getJourney();
  if (journey) journey.type = this.value;
}

function onColorPick(): void {
  const journey = getJourney();
  if (!journey) return;

  void Controllers.ColorPicker.open(journey.color, (fill: string) => {
    journey.color = fill;
    ensureEl<FillBoxElement>("journeyColor").fill = fill;
    segmentsTable.refresh();
  });
}

function onSegNameInput(this: HTMLInputElement): void {
  const segment = getLineSegment(this);
  if (segment) segment.name = this.value;
}

function onSegTransportChange(this: HTMLSelectElement): void {
  const segment = getLineSegment(this);
  if (!segment) return;

  const previousType = segment.transport;
  const newType = Transports.get(this.value);
  if (!newType) return;

  // Stay: clear the pathfinding-derived state, keeping the endpoints as anchors
  if (newType.domain === "stay") {
    Object.assign(segment, { transport: newType.name, speed: 0, duration: segment.duration ?? 1 });
    segment.avoidRoads = false;
    segment.custom = false;
    recomputeSegment(segment);
    segmentsTable.refresh();
    return;
  }

  const message = domainMismatchMessage(segment, newType.domain);
  if (message) {
    this.value = previousType;
    alertDialog({
      title: `Can't switch to ${newType.name}`,
      message: `${message}<br/><br/>Pick different endpoints first, then change the transport type or use an <b>air</b> transport type, which accepts any endpoints.`
    });
    return;
  }

  const applyChange = () => {
    segment.transport = newType.name;
    segment.speed = newType.speed;
    if (Transports.getDomain(previousType) === "stay") delete segment.duration;
    recomputeSegment(segment);
    segmentsTable.refresh();
  };

  // endpoints were checked above, but a custom-drawn path body can still clash with the new domain
  if (segment.custom && !Journeys.isValidPath(segment.points, newType.domain)) {
    this.value = previousType;
    confirmationDialog({
      title: "Overwrite custom path?",
      message: `Segment "<b>${escapeHtml(segment.name)}</b>" has a custom-drawn path that ${escapeHtml(
        newType.name
      )} can't follow. Replace it with the pathfinder's route?`,
      confirm: "Replace",
      onConfirm: () => {
        this.value = newType.name;
        segment.custom = false;
        applyChange();
      }
    });
    return;
  }

  applyChange();
}

function onSegSpeedInput(this: HTMLInputElement): void {
  const segment = getLineSegment(this);
  const journey = getJourney();
  if (!segment || !journey) return;

  segment.speed = parseSpeed(+this.value || 0); // stored in km/h, typed in the user distance unit
  // a full refresh would tear this very input out of the DOM mid-keystroke, so update in place
  syncTimeCell(this, segment);
  updateTotals(journey);
}

function onSegDurationInput(this: HTMLInputElement): void {
  const segment = getLineSegment(this);
  const journey = getJourney();
  if (!segment || !journey) return;

  // an emptied field is not a zero-hour leg: it gives the segment back to distance/speed
  if (this.value.trim() === "") delete segment.duration;
  else segment.duration = Math.max(0, +this.value || 0);
  updateTotals(journey);
}

function onSegColorPick(this: FillBoxElement): void {
  const segment = getLineSegment(this);
  if (!segment) return;

  void Controllers.ColorPicker.open(this.fill, (fill: string) => {
    segment.color = fill;
    segmentsTable.refresh();
  });
}

function onToggleSegVisible(this: HTMLElement): void {
  const segment = getLineSegment(this);
  if (!segment) return;

  Journeys.toggleVisibility(segment);
  if (segment.visible === false) pathEditor.stopEditing(segment.i); // a hidden segment can't be edited on the map
  segmentsTable.refresh();
}

function onToggleAvoidRoads(this: HTMLElement): void {
  const segment = getLineSegment(this);
  if (!segment) return;
  segment.avoidRoads = !segment.avoidRoads;
  recomputeSegment(segment);
  segmentsTable.refresh();
}

function onLocateEndpoint(this: HTMLElement): void {
  const segment = getLineSegment(this);
  const point = getCellPoint(segment?.[this.dataset.endpoint as "from" | "to"]);
  if (point) zoomTo(point[0], point[1], 8, 2000);
}

function onPickFrom(this: HTMLElement): void {
  pathEditor.pickEndpoint(getRowId(this), "from");
}

function onPickTo(this: HTMLElement): void {
  pathEditor.pickEndpoint(getRowId(this), "to");
}

function onToggleEditPoints(this: HTMLElement): void {
  pathEditor.togglePointEdit(getRowId(this));
}

function onToggleDrawPath(this: HTMLElement): void {
  pathEditor.toggleDrawing(getRowId(this));
}

/** Drop every manual override on the segment and re-run the pathfinder for it */
function onSegReset(this: HTMLElement): void {
  const segment = getLineSegment(this);
  if (!segment) return;

  const reset = () => {
    const isStay = Transports.getDomain(segment.transport) === "stay";
    delete segment.color;
    segment.speed = Transports.get(segment.transport)?.speed ?? segment.speed;
    // a stay has no speed to derive its time from, so it falls back to the default one hour
    if (isStay) segment.duration = 1;
    else delete segment.duration;
    segment.custom = false;
    recomputeSegment(segment);
    segmentsTable.refresh();
  };
  if (!segment.custom) {
    reset();
    return;
  }

  confirmationDialog({
    title: "Overwrite custom path?",
    message: `Segment "<b>${escapeHtml(segment.name)}</b>" has a custom-drawn path. Resetting replaces it with the pathfinder's route. Continue?`,
    confirm: "Reset",
    onConfirm: reset
  });
}

function onSegMoveUp(this: HTMLElement): void {
  const journey = getJourney();
  if (!journey) return;

  const index = journey.segments.findIndex(segment => segment.i === getRowId(this));
  if (index <= 0) return;
  journey.segments.splice(index - 1, 0, ...journey.segments.splice(index, 1));
  segmentsTable.refresh();
}

function onSegDelete(this: HTMLElement): void {
  const journey = getJourney();
  const segment = getLineSegment(this);
  if (!journey || !segment) return;

  confirmationDialog({
    title: "Remove segment",
    message: `Remove segment <b>${escapeHtml(segment.name)}</b>? This action cannot be reverted.`,
    confirm: "Remove",
    onConfirm: () => {
      pathEditor.stopEditing(segment.i);
      journey.segments = journey.segments.filter(other => other.i !== segment.i);
      segmentsTable.refresh();
    }
  });
}

function segmentHighlightOn(this: HTMLElement): void {
  Layers.show("journeys");
  if (editingJourneyId !== null) startJourneyTravel(editingJourneyId, getRowId(this));
}

function segmentHighlightOff(): void {
  stopJourneyTravel();
}

function addSegment(): void {
  const journey = getJourney();
  if (!journey) return;

  const isFirst = !journey.segments.length;
  const { i } = Journeys.addSegment(journey);
  segmentsTable.refresh();

  if (isFirst) pathEditor.pickEndpoint(i, "from", true);
  else pathEditor.pickEndpoint(i, "to");
}

function downloadSegmentsData(): void {
  const journey = getJourney();
  if (!journey) return;

  const unit = getDistanceUnit();
  const headers = `Idx,Name,Transport,Speed(${unit}/h),EffectiveSpeed(${unit}/h),DistancePx,Distance(${unit}),TimeHours,From,To,AvoidRoads,Custom,Visible,Color`;
  const lines = journey.segments.map((segment, index) =>
    [
      index + 1,
      toCsvField(segment.name),
      toCsvField(segment.transport),
      convertSpeed(segment.speed),
      convertSpeed(Journeys.getEffectiveSpeed(segment)),
      rn(segment.distance, 2),
      rn(Journeys.getSegmentDistance(segment), 2),
      rn(Journeys.getSegmentTime(segment), 2),
      segment.from ?? "",
      segment.to ?? "",
      segment.avoidRoads ? "yes" : "no",
      segment.custom ? "yes" : "no",
      segment.visible === false ? "no" : "yes",
      segment.color ?? ""
    ].join(",")
  );

  downloadFile([headers, ...lines].join("\n"), `${getFileName(journey.name || "Journey")}.csv`);
}

function triggerJourneyRemove(): void {
  const journey = getJourney();
  if (!journey) return;

  confirmationDialog({
    title: "Remove journey",
    message: `Remove journey <b>${escapeHtml(journey.name)}</b>? This action cannot be reverted.`,
    confirm: "Remove",
    onConfirm: () => {
      Journeys.remove(journey.i);
      Layers.draw("journeys");
      $(`#${dialogId}`).dialog("close");
    }
  });
}

function onClose(): void {
  teardown();
  editingJourneyId = null;
  destroyDialog(dialogId);
}

export const JourneyEditor = { open };
