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
import { startJourneyTravel, stopJourneyTravel } from "@/renderers/journey-travel";
import type { JouneySegment, Journey } from "@/types/Journey";
import { downloadFile, ensureEl, findEl, getFileName, getHoursPerDay, rn } from "@/utils";
import { cellEndpointLabel, cellEndpointTooltip, getCellPoint } from "@/utils/cell-labels";
import * as PathEditor from "./journey-path-editor";

const dialogId = "journeyEditor" as const;
const MAP_POSITION = { my: "left top", at: "left+10 top+10", of: "#map", collision: "fit" };
const OVERVIEW_POSITION = { my: "right top", at: "right bottom+10", of: "#journeysOverview", collision: "fit" };

let editingJourneyId: number | null = null;

const columns: EditorColumn<JouneySegment>[] = [
  { key: "color", width: "1.2em" },
  { key: "name", label: "Name", width: "14em", permanent: true },
  { key: "from", label: "From", width: "9em", mobileHidden: true },
  { key: "to", label: "To", width: "9em", mobileHidden: true },
  { key: "transport", label: "Transport", width: "6em" },
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
    tip("Journey not found", true, "error", 6000);
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
    position: findEl("journeysOverview") ? OVERVIEW_POSITION : MAP_POSITION,
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

  const html = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
    <div id="segmentsBody" class="table">${renderEditorHeader({ dialogId, columns })}</div>

    <div id="journeyControls" class="editorFilters" style="flex-direction: row; align-items: center">
      <fill-box id="journeyColor" size="1em" data-tip="Journey color. Click to change" fill="${journey.color}"></fill-box>
      <label for="journeyName" data-tip="Journey name" style="flex: 1; grid-template-columns: 3.2em 1fr">Name:
        <input id="journeyName" type="text" value="${journey.name}" />
      </label>
      <label for="journeyType" data-tip="Kind of travel this is: a quest, a caravan, a campaign"
        style="flex: 0 1 14em; grid-template-columns: 3.2em 1fr">Type:
        <input id="journeyType" type="text" value="${journey.type}" />
      </label>
    </div>

    <div id="journeyFooter" class="totalLine">
      <div data-tip="Total distance" data-col="distance">Distance:&nbsp;<span id="journeyTotalDistance">0</span></div>
      <div data-tip="Average speed, segments with non-zero speed only" style="margin-left: 12px" data-col="speed">Avg speed:&nbsp;<span id="journeyAvgSpeed">0</span></div>
      <div data-tip="Total travel time at the configured travel hours per day" style="margin-left: 12px" data-col="time">Time:&nbsp;<span id="journeyTravelTime">0</span></div>

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

  const hoursPerDay = getHoursPerDay();
  const hours = Journeys.getSegmentTime(segment);

  return /* html */ `<div class="states" data-id="${segment.id}">
    <div data-col="color">
      <fill-box class="segColor" fill="${segment.color || journey.color}" data-tip="Segment color. Click to change"></fill-box>
    </div>
    <div data-col="name" style="width: 95%; overflow: hidden">
      <input class="segName" value="${segment.name}" data-tip="Segment name: ${segment.name}" />
    </div>
    ${renderEndpointCell("from", segment)}
    ${renderEndpointCell("to", segment)}
    <div data-col="transport"><select class="segTransport" data-tip="Transport type, sets the default speed and where the segment may go">${pack.transportTypes
      .map(
        type =>
          `<option value="${type.name}" ${type.name === segment.transportType ? "selected" : ""}>${type.name}</option>`
      )
      .join("")}</select></div>
    <div data-tip="Segment distance" data-col="distance">${rn(Journeys.getSegmentDistance(segment))} ${unit}</div>
    <div data-col="speed">
      <input class="segSpeed" type="number" step="0.1" min="0" value="${segment.speed}" data-tip="Travel speed in ${unit}/h, type to override. ${segment.avoidRoads ? `Off-road speed: ${rn(Journeys.getEffectiveSpeed(segment), 1)}` : ""}" />
    </div>
    <div data-col="time" data-tip="Travel time in hours, type to override. Equals to ${Journeys.formatTravelTimeFull(hours, hoursPerDay)}">
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
      message: `${message}<br/><br/>Pick different endpoints first, then change the transport type or use an <b>air</b> transport type, which accepts any endpoints.`
    });
    return;
  }

  segment.transportType = newType.name;
  segment.speed = newType.speed;
  if (Journeys.getDomain(previousType) === "stay") delete segment.duration;
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

function onToggleSegVisible(this: HTMLElement): void {
  const segment = getLineSegment(this);
  if (!segment) return;

  const visible = segment.visible === false;
  if (visible) delete segment.visible;
  else segment.visible = false;

  if (!visible) PathEditor.stopEditing(segment.id);
  segmentsTable.refresh();
}

function onToggleAvoidRoads(this: HTMLElement): void {
  const segment = getLineSegment(this);
  if (!segment) return;
  segment.avoidRoads = !segment.avoidRoads;
  PathEditor.recomputeSegment(segment);
  segmentsTable.refresh();
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

/** Drop every manual override on the segment and re-run the pathfinder for it */
function onSegReset(this: HTMLElement): void {
  const segment = getLineSegment(this);
  if (!segment) return;

  const reset = () => {
    const isStay = Journeys.getDomain(segment.transportType) === "stay";
    delete segment.color;
    segment.speed = Journeys.getTransportType(segment.transportType)?.speed ?? segment.speed;
    // a stay has no speed to derive its time from, so it falls back to the default one hour
    if (isStay) segment.duration = 1;
    else delete segment.duration;
    segment.custom = false;
    PathEditor.recomputeSegment(segment);
    segmentsTable.refresh();
  };
  if (!segment.custom) {
    reset();
    return;
  }

  confirmationDialog({
    title: "Overwrite custom path?",
    message: `Segment "<b>${segment.name}</b>" has a custom-drawn path. Resetting replaces it with the pathfinder's route. Continue?`,
    confirm: "Reset",
    onConfirm: reset
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
  const segment = getLineSegment(this);
  if (!journey || !segment) return;

  confirmationDialog({
    title: "Remove segment",
    message: `Remove segment <b>${segment.name}</b>? This action cannot be reverted.`,
    confirm: "Remove",
    onConfirm: () => {
      PathEditor.stopEditing(segment.id);
      journey.segments = journey.segments.filter(other => other.id !== segment.id);
      segmentsTable.refresh();
    }
  });
}

const getSegmentPath = (el: HTMLElement): SVGPathElement | null =>
  editingJourneyId === null ? null : findEl<SVGPathElement>(`segment${editingJourneyId}_${getLineId(el)}`);

function segmentHighlightOn(this: HTMLElement): void {
  Layers.show("journeys");
  getSegmentPath(this)?.setAttribute("stroke-width", "3");
  if (editingJourneyId !== null) startJourneyTravel(editingJourneyId, getLineId(this));
}

function segmentHighlightOff(this: HTMLElement): void {
  getSegmentPath(this)?.removeAttribute("stroke-width");
  stopJourneyTravel();
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
  stopJourneyTravel();
  PathEditor.detach();
  applyDefaultViewboxEvents();
  document.removeEventListener(TRANSPORT_TYPES_CHANGED, onTransportTypesChanged);
  editingJourneyId = null;
  destroyDialog(dialogId);
}

export const JourneyEditor = { open };
