import {
  alertDialog,
  closeDialogs,
  confirmationDialog,
  destroyDialog,
  updateDialog
} from "@/components/dialog/dialog-helpers";
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
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import { TRANSPORT_TYPES_CHANGED } from "@/controllers/transport-types-editor";
import { getJourneyTypes } from "@/generators/journey-story";
import { OFF_ROAD_SPEED_FACTOR } from "@/generators/journeys-generator";
import { getSegmentColor } from "@/renderers/draw-journeys";
import type { JouneySegment, Journey } from "@/types/Journey";
import { downloadFile, ensureEl, findEl, getFileName, getHoursPerDay, rn } from "@/utils";
import { cellEndpointLabel, cellEndpointTooltip, getCellPoint } from "@/utils/cell-labels";
import * as PathEditor from "./journey-path-editor";

const dialogId = "journeyEditor" as const;
const MAP_POSITION = { my: "left top", at: "left+10 top+10", of: "#map", collision: "fit" };
const OVERVIEW_POSITION = { my: "right top", at: "right bottom+16", of: "#journeysOverview", collision: "fit" };

/** Dock under the Journeys Overview when it is on screen, so the two read as one panel */
const getPosition = () => (findEl("journeysOverview")?.offsetParent ? OVERVIEW_POSITION : MAP_POSITION);

const SUCCESS_TIP_MS = 2500;
const ERROR_TIP_MS = 9000;
const OFF_ROAD_PENALTY_PCT = Math.round((1 - OFF_ROAD_SPEED_FACTOR) * 100);
const ACTIVE_COLOR = "#2a6e2a"; // marks the segment an on-map editing mode is armed for

let editingJourneyId: number | null = null;

// Segments are an ordered itinerary, so no column is sortable — reordering is done with the move handle
const columns: EditorColumn<JouneySegment>[] = [
  { key: "name", label: "Name", width: "11em", permanent: true },
  { key: "transport", label: "Transport", width: "7em" },
  { key: "speed", label: "Speed", width: "4.5em" },
  { key: "from", label: "From", width: "9em" },
  { key: "to", label: "To", width: "9em" },
  { key: "distance", label: "Dist", width: "5.5em" },
  { key: "time", label: "Time", width: "6em" },
  { key: "roads", label: "Roads", width: "3.8em", mobileHidden: true },
  { key: "color", label: "Color", width: "3.8em" },
  // wide enough for the six row icons plus the columns button the header parks here
  { key: "actions", width: "10.5em", permanent: true, align: "right" }
];

const segmentsTable = initEditorTable<JouneySegment>({
  getData: () => getJourney()?.segments ?? [],
  onUpdate: renderSegmentsPage
});

function open(journeyId: number): void {
  if (customization) return;

  if (editingJourneyId === journeyId) {
    // an armed on-map mode owns the click that got us here, e.g. drawing over the journey's own path
    if (PathEditor.getMode()) return;
    // re-opening the journey already being edited should not rebuild the dialog
    if (findEl(dialogId)?.offsetParent) {
      segmentsTable.refresh();
      return;
    }
  }

  PathEditor.detach(); // drop any mode left armed for the journey we are leaving
  closeDialogs(`#${dialogId}, .stable`);
  Layers.show("journeys");

  Journeys.sync();
  editingJourneyId = journeyId;
  const journey = getJourney();
  if (!journey) {
    tip("Journey not found", true, "error", ERROR_TIP_MS);
    return;
  }

  PathEditor.attach({ getJourney, getSegment, refresh: segmentsTable.refresh });
  renderDialog(journey);
  segmentsTable.reset();
  document.addEventListener(TRANSPORT_TYPES_CHANGED, onTransportTypesChanged);

  $(`#${dialogId}`).dialog({
    title: "Edit Journey",
    resizable: false,
    width: "fit-content",
    position: getPosition(),
    close: onClose
  });
}

function getJourney(): Journey | undefined {
  if (editingJourneyId === null) return undefined;
  return pack.journeys.find(journey => journey.i === editingJourneyId);
}

function getSegment(id: number): JouneySegment | undefined {
  return getJourney()?.segments.find(segment => segment.id === id);
}

/** Segment id of the row a control lives in */
const getLineId = (el: HTMLElement): number => +(el.closest<HTMLElement>(".states")?.dataset.id ?? "-1");

const getLineSegment = (el: HTMLElement): JouneySegment | undefined => getSegment(getLineId(el));

function renderDialog(journey: Journey): void {
  destroyDialog(dialogId);

  const html = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog" style="max-width: 96vw">
    <div id="segmentsBody" class="table">${renderEditorHeader({ dialogId, columns })}</div>

    <div id="journeyControls" class="editorFilters" style="flex-direction: row; align-items: center">
      <label for="journeyName" data-tip="Journey name" style="flex: 1; grid-template-columns: 3.2em 1fr">Name:
        <input id="journeyName" type="text" value="${escapeAttr(journey.name)}" />
      </label>
      <label for="journeyType" data-tip="Kind of travel this is: a quest, a caravan, a campaign"
        style="flex: 0 1 14em; grid-template-columns: 3.2em 1fr">Type:
        <input id="journeyType" type="text" value="${escapeAttr(journey.type)}" list="journeyTypes" />
      </label>
      <datalist id="journeyTypes">${getJourneyTypes()
        .map(type => `<option value="${type}"></option>`)
        .join("")}</datalist>
      <fill-box id="journeyColor" size="1.2em" data-tip="Journey color. Click to change"></fill-box>
    </div>

    <div id="journeyFooter" class="totalLine">
      <div data-tip="Total distance" style="margin-left: 4px" data-col="distance">Distance:&nbsp;<span id="journeyTotalDistance">0</span></div>
      <div data-tip="Average speed, moving segments only" style="margin-left: 12px" data-col="speed">Avg speed:&nbsp;<span id="journeyAvgSpeed">0</span></div>
      <div data-tip="Total travel time at the configured travel hours per day" style="margin-left: 12px" data-col="time">Time:&nbsp;<span id="journeyTravelTime">0</span></div>
    </div>

    <div id="journeyBottom" class="editorToolbar">
      <button id="journeyEditorRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
      <button id="journeyAddSegment" data-tip="Add a segment to the journey" class="icon-plus"></button>
      <button id="journeyRecompute" data-tip="Recompute every segment's path" class="icon-retweet"></button>
      <button id="journeyVisible" data-tip="Toggle journey visibility on the map" class="${journey.visible === false ? "icon-eye-off" : "icon-eye"}"></button>
      <button id="journeyLock" data-tip="Lock or unlock the journey" class="${journey.lock ? "icon-lock" : "icon-lock-open"}"></button>
      <button id="journeyEditTransport" data-tip="Edit transport types" class="icon-cog"></button>
      <button id="journeyExport" data-tip="Save journey segments as a text file (.csv)" class="icon-download"></button>
      <button id="journeyRemove" data-tip="Remove the journey" class="icon-trash"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  ensureEl<FillBoxElement>("journeyColor").fill = journey.color;

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("journeyEditorRefresh").addEventListener("click", segmentsTable.refresh);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position: getPosition() })
  });
  ensureEl("journeyName").addEventListener("input", onNameInput);
  ensureEl("journeyType").addEventListener("input", onTypeInput);
  ensureEl("journeyColor").addEventListener("click", onColorPick);
  ensureEl("journeyVisible").addEventListener("click", onToggleVisible);
  ensureEl("journeyLock").addEventListener("click", onToggleLock);
  ensureEl("journeyAddSegment").addEventListener("click", addSegment);
  ensureEl("journeyRecompute").addEventListener("click", recomputeAll);
  ensureEl("journeyEditTransport").addEventListener("click", () => void Controllers.TransportTypesEditor.open());
  ensureEl("journeyExport").addEventListener("click", downloadSegmentsData);
  ensureEl("journeyRemove").addEventListener("click", triggerJourneyRemove);
}

function renderSegmentsPage(view: TableView<JouneySegment>): void {
  const journey = getJourney();
  if (!journey) return;

  const body = ensureEl("segmentsBody");
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
  on(".segColorReset", "click", onSegColorReset);
  on(".segVisible", "click", onToggleSegVisible);
  on(".segPoints.pointer", "click", onToggleEditPoints);
  on(".segDraw.pointer", "click", onToggleDrawPath);
  on(".segRecompute", "click", onSegRecompute);
  on(".segUp.pointer", "click", onSegMoveUp);
  on(".segDelete", "click", onSegDelete);

  updateTotals(journey);
  renderEditorPagination(ensureEl("journeyFooter"), view, segmentsTable.goto);

  Layers.draw("journeys");
  PathEditor.drawOverlays();
}

function renderSegmentLine(journey: Journey, segment: JouneySegment): string {
  const unit = distanceUnitInput.value;
  const index = journey.segments.indexOf(segment);
  const domain = Journeys.getDomain(segment.transportType);
  const isStay = domain === "stay" || Journeys.isStaySegment(segment);

  const mode = PathEditor.getMode();
  const isEditingPoints = mode?.kind === "points" && mode.segmentId === segment.id;
  const isDrawing = mode?.kind === "draw" && mode.segmentId === segment.id;
  const canEditPoints = segment.points.length >= 2 && !isStay;

  const transportOptions = pack.transportTypes
    .map(
      type =>
        `<option value="${type.name}" ${type.name === segment.transportType ? "selected" : ""}>${type.name}</option>`
    )
    .join("");

  const speedCell = isStay
    ? /* html */ `<input class="segSpeed" type="number" value="0" disabled data-tip="A stay covers no ground" />`
    : /* html */ `<input class="segSpeed" type="number" step="0.5" min="0" value="${segment.speed}"
        data-tip="Travel speed in ${unit}/h${segment.avoidRoads ? `. Effective off-road: ${rn(Journeys.getEffectiveSpeed(segment), 1)}` : ""}" />`;

  const timeCell = isStay
    ? /* html */ `<input class="segDuration" type="number" min="0" step="0.5" value="${segment.duration ?? 0}"
        data-tip="Stay duration in hours" style="flex: 0 1 3em" />h`
    : Journeys.formatTravelTime(Journeys.getSegmentTime(segment), getHoursPerDay());

  return /* html */ `<div class="states" data-id="${segment.id}">
    <div data-col="name"><input class="segName" value="${escapeAttr(segment.name)}" data-tip="Segment name" /></div>
    <div data-col="transport"><select class="segTransport" data-tip="Transport type, sets the speed and where the segment may go">${transportOptions}</select></div>
    <div data-col="speed">${speedCell}</div>
    ${renderEndpointCell("from", segment)}
    ${renderEndpointCell("to", segment)}
    <div data-tip="Segment distance" data-col="distance">${isStay ? "—" : `${rn(Journeys.getSegmentDistance(segment))} ${unit}`}</div>
    <div data-tip="${isStay ? "Stay duration" : `Time spent on this segment: ${Journeys.formatTravelTimeFull(Journeys.getSegmentTime(segment), getHoursPerDay())}`}" data-col="time">${timeCell}</div>
    <div data-col="roads">${renderRoadsToggle(segment, domain === "land")}</div>
    <div data-col="color">${renderColorCell(journey, segment)}</div>
    <div data-col="actions">
      <span class="segVisible pointer ${segment.visible === false ? "icon-eye-off" : "icon-eye"}" data-tip="Toggle segment visibility"></span>
      <span class="segPoints icon-pencil ${canEditPoints ? "pointer" : "inactive"}" ${activeStyle(isEditingPoints)}
        data-tip="${!canEditPoints ? "Set both endpoints first" : isEditingPoints ? "Finish editing path points" : "Edit path points"}"></span>
      <span class="segDraw icon-brush ${isStay ? "inactive" : "pointer"}" ${activeStyle(isDrawing)}
        data-tip="${isDrawing ? "Click to finish drawing (Esc to cancel)" : "Draw a custom path cell by cell"}"></span>
      <span class="segRecompute pointer icon-cw" data-tip="Recompute this segment's path"></span>
      <span class="segUp icon-up-open ${index ? "pointer" : "inactive"}" data-tip="Move the segment up"></span>
      <span class="segDelete pointer icon-trash-empty" data-tip="Remove the segment"></span>
    </div>
  </div>`;
}

/** Locate icon to zoom to the place, then the place name itself to re-pick the cell */
function renderEndpointCell(endpoint: "from" | "to", segment: JouneySegment): string {
  const cellId = segment[endpoint];
  const isSet = cellId !== undefined;
  const label = cellEndpointLabel(cellId);

  return /* html */ `<div data-col="${endpoint}">
    <span class="segLocate icon-target ${isSet ? "pointer" : "inactive"}" data-endpoint="${endpoint}"
      data-tip="${isSet ? `Zoom to ${label}` : "Set the endpoint first"}"></span>
    <span class="seg${endpoint === "from" ? "From" : "To"} pointer" data-tip="${cellEndpointTooltip(cellId)}"
      ${isSet ? "" : 'style="opacity: 0.55; font-style: italic"'}>${label}</span>
  </div>`;
}

/** One icon that both shows and toggles the road preference; greyed out off land */
function renderRoadsToggle(segment: JouneySegment, isLand: boolean): string {
  if (!isLand)
    return /* html */ `<span class="segRoads inactive icon-map-signs" data-tip="Land transport only"></span>`;

  const tipText = segment.avoidRoads
    ? `Off-road: avoids the road network at a ${OFF_ROAD_PENALTY_PCT}% speed penalty. Click to follow roads.`
    : "On-road: follows the road network at full speed. Click to go off-road.";
  return /* html */ `<span class="segRoads pointer ${segment.avoidRoads ? "icon-tree" : "icon-map-signs"}" data-tip="${tipText}"></span>`;
}

/** The reset keeps its slot when hidden, so the column track never reflows */
function renderColorCell(journey: Journey, segment: JouneySegment): string {
  const tipText = segment.color ? "Segment color. Click to change" : "Follows the journey color. Click to override";
  return /* html */ `<fill-box class="segColor" fill="${getSegmentColor(journey, segment)}" data-tip="${tipText}"></fill-box>
    <span class="segColorReset icon-ccw pointer" data-tip="Reset to the journey color"
      style="${segment.color ? "" : "visibility: hidden"}"></span>`;
}

const activeStyle = (isActive: boolean): string => (isActive ? ` style="color: ${ACTIVE_COLOR}"` : "");

const escapeAttr = (value: string): string => value.replace(/"/g, "&quot;");

function updateTotals(journey: Journey): void {
  const unit = distanceUnitInput.value;
  const { totalDistance, totalHours, avgSpeed } = Journeys.getTotals(journey);

  ensureEl("journeyTotalDistance").innerHTML = `${rn(totalDistance)} ${unit}`;
  ensureEl("journeyAvgSpeed").innerHTML = avgSpeed ? `${rn(avgSpeed, 1)} ${unit}/h` : "-";
  const hoursPerDay = getHoursPerDay();
  const travelTime = ensureEl("journeyTravelTime");
  travelTime.innerHTML = Journeys.formatTravelTime(totalHours, hoursPerDay);
  travelTime.parentElement!.dataset.tip = `Total travel time at ${hoursPerDay}h/day: ${Journeys.formatTravelTimeFull(totalHours, hoursPerDay)}`;
}

function onTransportTypesChanged(): void {
  if (getJourney()) segmentsTable.refresh();
}

// ---- journey-level handlers --------------------------------------------

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
    // the swatch lives outside the table, so a refresh alone would leave it stale
    ensureEl<FillBoxElement>("journeyColor").fill = fill;
    segmentsTable.refresh();
  });
}

function onToggleVisible(this: HTMLElement): void {
  const journey = getJourney();
  if (!journey) return;
  const visible = !journey.visible;
  if (!visible) journey.visible = false;
  else delete journey.visible;
  this.className = visible ? "icon-eye" : "icon-eye-off";
  Layers.draw("journeys");
}

function onToggleLock(this: HTMLElement): void {
  const journey = getJourney();
  if (!journey) return;
  journey.lock = !journey.lock;
  this.className = journey.lock ? "icon-lock" : "icon-lock-open";
}

// ---- segment handlers --------------------------------------------------

function onSegNameInput(this: HTMLInputElement): void {
  const segment = getLineSegment(this);
  if (segment) segment.name = this.value;
}

function onSegTransportChange(this: HTMLSelectElement): void {
  const segment = getLineSegment(this);
  if (!segment) return;

  const previousType = segment.transportType;
  const newType = Journeys.getTransportType(this.value);
  if (!newType) return;

  // Stay: clear the pathfinding-derived state, keeping the endpoints as anchors
  if (newType.domain === "stay") {
    Object.assign(segment, { transportType: newType.name, speed: 0, duration: segment.duration ?? 1 });
    segment.avoidRoads = false;
    segment.custom = false;
    PathEditor.recomputeSegment(segment);
    segmentsTable.refresh();
    return;
  }

  const message = PathEditor.domainMismatchMessage(segment, newType.domain);
  if (message) {
    this.value = previousType;
    alertDialog({
      title: `Can't switch to ${newType.name}`,
      message: `${message}<br/><br/>Pick different endpoints first, then change the transport type — or use an <b>air</b> transport type, which accepts any endpoints.`
    });
    return;
  }

  segment.transportType = newType.name;
  segment.speed = newType.speed;
  if (Journeys.getDomain(previousType) === "stay") segment.duration = undefined;
  PathEditor.recomputeSegment(segment);
  segmentsTable.refresh();
}

function onSegSpeedInput(this: HTMLInputElement): void {
  const segment = getLineSegment(this);
  if (!segment) return;
  segment.speed = +this.value || 0;
  segmentsTable.refresh();
}

function onSegDurationInput(this: HTMLInputElement): void {
  const segment = getLineSegment(this);
  const journey = getJourney();
  if (!segment || !journey) return;
  segment.duration = Math.max(0, +this.value || 0);
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

function onSegColorReset(this: HTMLElement): void {
  const segment = getLineSegment(this);
  if (!segment?.color) return;
  segment.color = undefined;
  segmentsTable.refresh();
}

function onToggleSegVisible(this: HTMLElement): void {
  const segment = getLineSegment(this);
  if (!segment) return;

  const visible = !segment.visible;
  if (!visible) segment.visible = false;
  else delete segment.visible;

  if (!visible) PathEditor.stopEditing(segment.id);
  segmentsTable.refresh();
}

function onToggleAvoidRoads(this: HTMLElement): void {
  const segment = getLineSegment(this);
  if (!segment) return;
  segment.avoidRoads = !segment.avoidRoads;
  PathEditor.recomputeSegment(segment);
  segmentsTable.refresh();

  const message = segment.avoidRoads
    ? `Segment set to off-road: avoids roads at a ${OFF_ROAD_PENALTY_PCT}% speed penalty.`
    : "Segment set to follow roads at full speed.";
  tip(message, true, "success", SUCCESS_TIP_MS);
}

function onLocateEndpoint(this: HTMLElement): void {
  const segment = getLineSegment(this);
  const point = getCellPoint(segment?.[this.dataset.endpoint as "from" | "to"]);
  if (point) zoomTo(point[0], point[1], 8, 2000);
}

function onPickFrom(this: HTMLElement): void {
  PathEditor.startCellPick(getLineId(this), "from");
}

function onPickTo(this: HTMLElement): void {
  PathEditor.startCellPick(getLineId(this), "to");
}

function onToggleEditPoints(this: HTMLElement): void {
  PathEditor.togglePointEdit(getLineId(this));
}

function onToggleDrawPath(this: HTMLElement): void {
  PathEditor.toggleDrawPath(getLineId(this));
}

function onSegRecompute(this: HTMLElement): void {
  const segment = getLineSegment(this);
  if (!segment) return;

  const recompute = () => {
    segment.custom = false;
    PathEditor.recomputeSegment(segment);
    segmentsTable.refresh();
  };
  if (!segment.custom) {
    recompute();
    return;
  }

  confirmationDialog({
    title: "Overwrite custom path?",
    message: `Segment "<b>${segment.name}</b>" has a custom-drawn path. Recomputing replaces it with the pathfinder's route. Continue?`,
    confirm: "Overwrite",
    onConfirm: recompute
  });
}

function onSegMoveUp(this: HTMLElement): void {
  const journey = getJourney();
  if (!journey) return;

  const index = journey.segments.findIndex(segment => segment.id === getLineId(this));
  if (index <= 0) return;
  journey.segments.splice(index - 1, 0, ...journey.segments.splice(index, 1));
  segmentsTable.refresh();
}

function onSegDelete(this: HTMLElement): void {
  const journey = getJourney();
  if (!journey) return;

  const segmentId = getLineId(this);
  PathEditor.stopEditing(segmentId);
  journey.segments = journey.segments.filter(segment => segment.id !== segmentId);
  segmentsTable.refresh();
}

// ---- journey actions ---------------------------------------------------

function addSegment(): void {
  const journey = getJourney();
  if (!journey) return;

  const isFirst = !journey.segments.length;
  const id = journey.segments.length ? Math.max(...journey.segments.map(segment => segment.id)) + 1 : 0;
  const transport = pack.transportTypes.find(type => type.domain !== "stay") ?? pack.transportTypes[0];

  journey.segments.push({
    id,
    name: `Segment ${id + 1}`,
    from: journey.segments[journey.segments.length - 1]?.to,
    transportType: transport?.name ?? "Direct",
    speed: transport?.speed ?? 5,
    distance: 0,
    points: []
  });
  segmentsTable.refresh();

  // a first segment needs both ends; a following one starts where the previous ended
  if (isFirst) PathEditor.startCellPick(id, "from", true);
  else PathEditor.startCellPick(id, "to");
}

function recomputeAll(): void {
  const journey = getJourney();
  if (!journey) return;

  const customCount = journey.segments.filter(segment => segment.custom).length;
  const recompute = () => {
    for (const segment of journey.segments) {
      segment.custom = false;
      PathEditor.recomputeSegment(segment);
    }
    segmentsTable.refresh();
    tip("All segments recomputed", true, "success", SUCCESS_TIP_MS);
  };
  if (!customCount) {
    recompute();
    return;
  }

  confirmationDialog({
    title: "Overwrite custom paths?",
    message: `${customCount} segment${customCount > 1 ? "s have" : " has"} a custom-drawn path. Recomputing replaces them. Continue?`,
    confirm: "Overwrite",
    onConfirm: recompute
  });
}

function downloadSegmentsData(): void {
  const journey = getJourney();
  if (!journey) return;

  const unit = distanceUnitInput.value;
  const headers = `Idx,Name,TransportType,Speed(${unit}/h),EffectiveSpeed(${unit}/h),DistancePx,Distance(${unit}),TimeHours,From,To,AvoidRoads,Custom,Visible,Color`;
  const lines = journey.segments.map((segment, index) =>
    [
      index + 1,
      `"${segment.name}"`,
      `"${segment.transportType}"`,
      segment.speed,
      rn(Journeys.getEffectiveSpeed(segment), 2),
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
    message: `Remove journey <b>${journey.name}</b>? This action cannot be reverted.`,
    confirm: "Remove",
    onConfirm: () => {
      Journeys.remove(journey.i);
      Layers.draw("journeys");
      $(`#${dialogId}`).dialog("close");
    }
  });
}

function onClose(): void {
  PathEditor.detach();
  applyDefaultViewboxEvents();
  document.removeEventListener(TRANSPORT_TYPES_CHANGED, onTransportTypesChanged);
  editingJourneyId = null;
  destroyDialog(dialogId);
}

export const JourneyEditor = { open };
