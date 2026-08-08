import { drag, select } from "d3";
import { closeDialogs, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import { TRANSPORT_TYPES_CHANGED } from "@/controllers/transport-types-editor";
import { getDefaultTransportTypes } from "@/data/transport-types";
import { drawJourneys } from "@/renderers/draw-journeys";
import type { Journey, JourneyPoint, Segment, TransportDomain, TransportType } from "@/types/Journey";
import { downloadFile, getFileName, getHoursPerDay, getPointer, rn } from "@/utils";
import { cellEndpointLabel, cellEndpointTooltip } from "@/utils/cellLabels";
import {
  DEFAULT_JOURNEY_COLOR,
  effectiveSpeed,
  formatTravelTime,
  isStaySegment,
  journeyTotals,
  OFF_ROAD_SPEED_FACTOR,
  segmentLengthKm,
  segmentTimeHours
} from "@/utils/journey-metrics";
import { medianSpacing, resampleAround } from "@/utils/journey-path-edit";
import {
  describeCell,
  findJourneyPath,
  isValidEndpointForDomain,
  isValidPathPointForDomain,
  pathLength
} from "@/utils/journey-pathfinding";
import { destroyDialogIfExists, ensureEl } from "../utils";

const ERROR_TIP_MS = 9000;
const WARN_TIP_MS = 7000;
const SUCCESS_TIP_MS = 2500;
const POINT_EDIT_HINT = "Drag points to move, click the path to add, right-click a point to remove.";
const CUSTOM_PATH_HINT =
  "Click cells to add points. Click the brush icon (or press Enter) to finish, Esc to cancel, right-click to undo.";

let editingJourneyId: number | null = null;
let pickState: {
  segmentId: number;
  endpoint: "from" | "to";
  chainNextTo?: boolean;
} | null = null;
let editingPointsSegId: number | null = null;
let pointEditSpacing = 0;
let customPathSegId: number | null = null;
let customPathPoints: JourneyPoint[] = [];

function open(journeyId: number): void {
  if (customization) return;
  closeDialogs("#journeyEditor, .stable");
  if (!layerIsOn("toggleJourneys")) toggleJourneys();

  ensureTransportTypes();
  editingJourneyId = journeyId;
  const journey = getJourney();
  if (!journey) {
    tip("Journey not found", true, "error", ERROR_TIP_MS);
    return;
  }

  renderDialog(journey);
  refresh();
  document.addEventListener(TRANSPORT_TYPES_CHANGED, onTransportTypesChanged);

  $("#journeyEditor").dialog({
    title: "Edit Journey",
    resizable: false,
    width: "fit-content",
    position: { my: "left top", at: "left+10 top+10", of: "#map" },
    close: onClose
  });
}

function onTransportTypesChanged(): void {
  const journey = getJourney();
  if (!journey) return;
  document.querySelectorAll<HTMLSelectElement>("#segmentsBody .segTransport").forEach(sel => {
    const currentValue = sel.value;
    sel.innerHTML = pack.transportTypes.map(t => `<option value="${t.name}">${t.name}</option>`).join("");
    if (pack.transportTypes.some(t => t.name === currentValue)) sel.value = currentValue;
  });
}

function ensureTransportTypes(): void {
  if (!pack.transportTypes?.length) pack.transportTypes = getDefaultTransportTypes();
}

function getJourney(): Journey | undefined {
  if (editingJourneyId === null) return undefined;
  return pack.journeys.find(j => j.i === editingJourneyId);
}

function renderDialog(journey: Journey): void {
  destroyDialogIfExists("journeyEditor");

  const html = /* html */ `<div id="journeyEditor" class="dialog stable">
    <div id="journeyHeader">
      <div class="label">Name:</div>
      <input id="journeyName" value="${journey.name}" />
      <input id="journeyColor" type="color" value="${journey.color}" data-tip="Journey color" />
      <span id="journeyVisible" data-tip="Toggle visibility" class="pointer icon-eye"></span>
      <span id="journeyLock" data-tip="Lock/unlock" class="pointer ${journey.lock ? "icon-lock" : "icon-lock-open"}"></span>
    </div>

    <div id="segmentsTable" class="table">
      <div class="header">
        <div>#</div><div>Name</div><div>Transport</div><div>Speed</div><div>From</div><div>To</div>
        <div>Dist</div><div>Time</div><div>Roads</div><div>Note</div><div>Col</div><div>Vis</div>
        <div>Pts</div><div>Draw</div><div></div><div></div><div></div>
      </div>
      <div id="segmentsBody"></div>
    </div>

    <div id="journeyFooter" class="totalLine">
      <div>Distance:&nbsp;<span id="jTotalDistance">0</span></div>
      <div>Avg speed:&nbsp;<span id="jAvgSpeed">0</span></div>
      <div>Travel time:&nbsp;<span id="jTravelTime">0</span> (<span id="jHoursPerDay">8</span>h/day)</div>
    </div>

    <div id="journeyBottom">
      <button id="journeyAddSegment" data-tip="Add a segment" class="icon-plus"></button>
      <button id="journeyRecompute" data-tip="Recompute all segment paths" class="icon-cw"></button>
      <button id="journeyEditTransport" data-tip="Edit transport types" class="icon-cog"></button>
      <button id="journeyExport" data-tip="Download segments as CSV" class="icon-download"></button>
      <button id="journeyRemove" data-tip="Remove journey" class="icon-trash"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl("journeyName").on("input", onNameInput);
  ensureEl("journeyColor").on("input", onColorInput);
  ensureEl("journeyVisible").on("click", onToggleVisible);
  ensureEl("journeyLock").on("click", onToggleLock);
  ensureEl("journeyAddSegment").on("click", addSegment);
  ensureEl("journeyRecompute").on("click", recomputeAll);
  ensureEl("journeyExport").on("click", downloadSegments);
  ensureEl("journeyEditTransport").on("click", openTransportEditor);
  ensureEl("journeyRemove").on("click", removeJourney);
}

function refresh(): void {
  const journey = getJourney();
  if (!journey) return;

  const body = ensureEl("segmentsBody");
  body.innerHTML = "";

  const transportOptions = pack.transportTypes.map(t => `<option value="${t.name}">${t.name}</option>`).join("");
  const unit = distanceUnitInput.value;
  const hoursPerDay = getHoursPerDay();

  journey.segments.forEach((seg, index) => {
    const row = document.createElement("div");
    row.className = "editorLine";
    row.dataset.segId = String(seg.id);
    const domain = getDomain(seg.transportType);
    const isLandSeg = domain === "land";
    const isStay = domain === "stay" || isStaySegment(seg);

    const roadsIcon = seg.avoidRoads ? "icon-tree" : "icon-map-signs";
    const roadsClass = isLandSeg ? (seg.avoidRoads ? "roadsChip off" : "roadsChip on") : "roadsChip inactive";
    const roadsLabel = isLandSeg ? (seg.avoidRoads ? "off" : "on") : "n/a";
    const roadsTip = isLandSeg
      ? seg.avoidRoads
        ? `Off-road (${Math.round((1 - OFF_ROAD_SPEED_FACTOR) * 100)}% speed penalty). Click to switch.`
        : "On-road. Click to switch to off-road."
      : "Land transport only";

    const isEditingPoints = editingPointsSegId === seg.id;
    const isDrawing = customPathSegId === seg.id;
    const hasPath = seg.points.length >= 2;

    const distanceCell = isStay ? "—" : `${rn(segmentLengthKm(seg))} ${unit}`;
    const timeCell = isStay
      ? `<input class="segDuration" type="number" min="0" step="0.5" value="${seg.duration ?? 0}" data-tip="Stay duration in hours" /> h`
      : formatTravelTime(segmentTimeHours(seg), hoursPerDay);

    const speedCell = isStay
      ? `<input class="segSpeed" type="number" value="0" disabled />`
      : `<input class="segSpeed" type="number" step="0.5" min="0" value="${seg.speed}" title="${seg.avoidRoads ? `Effective: ${rn(effectiveSpeed(seg), 1)} ${unit}/h` : ""}" />`;

    const swatchColor = seg.color || journey.color || DEFAULT_JOURNEY_COLOR;
    const colorCell = seg.color
      ? `<span>
           <input class="segColor" type="color" value="${swatchColor}" data-tip="Segment color — click ✕ to reset" />
           <span class="segColorReset pointer" data-tip="Reset to journey color">✕</span>
         </span>`
      : `<input class="segColor inherited" type="color" value="${swatchColor}" data-tip="Uses journey color — pick a color to override" />`;

    row.innerHTML = /* html */ `
      <div>${index + 1}</div>
      <input class="segName" value="${seg.name}" />
      <select class="segTransport">${transportOptions.replace(`value="${seg.transportType}"`, `value="${seg.transportType}" selected`)}</select>
      ${speedCell}
      <span class="segFrom cellPick ${seg.from === undefined ? "unset" : ""}" data-tip="${cellEndpointTooltip(seg.from)}">${cellEndpointLabel(seg.from)}</span>
      <span class="segTo cellPick ${seg.to === undefined ? "unset" : ""}" data-tip="${cellEndpointTooltip(seg.to)}">${cellEndpointLabel(seg.to)}</span>
      <div>${distanceCell}</div>
      <div>${timeCell}</div>
      <span class="segRoads ${roadsClass} ${roadsIcon}" data-tip="${roadsTip}">&nbsp;${roadsLabel}</span>
      <input class="segNote" value="${(seg.note ?? "").replace(/"/g, "&quot;")}" placeholder="note…" />
      ${colorCell}
      <span class="segVisible pointer ${seg.visible ? "icon-eye" : "icon-eye-off"}" data-tip="Toggle visibility"></span>
      <span class="segPoints pointer icon-pencil ${hasPath && !isStay ? "" : "inactive"} ${isEditingPoints ? "segActive" : ""}" data-tip="${hasPath && !isStay ? (isEditingPoints ? "Finish editing points" : "Edit path points") : "Set endpoints first"}"></span>
      <span class="segDraw pointer icon-brush ${isStay ? "inactive" : ""} ${isDrawing ? "segActive" : ""}" data-tip="${isDrawing ? "Click to finish drawing (Esc to cancel)" : "Draw a custom path"}"></span>
      <span class="segRecompute pointer icon-cw" data-tip="Recompute path"></span>
      <span class="segUp pointer icon-up-open" data-tip="Move up"></span>
      <span class="segDelete pointer icon-trash-empty" data-tip="Delete segment"></span>`;
    body.appendChild(row);
  });

  const on = <T extends Element>(selector: string, event: string, handler: EventListener) => {
    body.querySelectorAll<T & HTMLElement>(selector).forEach(el => {
      el.on(event, handler);
    });
  };

  on(".segName", "input", onSegNameInput);
  on(".segTransport", "change", onSegTransportChange);
  on(".segSpeed:not([disabled])", "input", onSegSpeedInput);
  on(".segDuration", "input", onSegDurationInput);
  on(".segFrom", "click", onPickFrom);
  on(".segTo", "click", onPickTo);
  on(".segRoads:not(.inactive)", "click", onToggleAvoidRoads);
  on(".segNote", "input", onSegNoteInput);
  on(".segColor", "input", onSegColorInput);
  on(".segColorReset", "click", onSegColorReset);
  on(".segVisible", "click", onToggleSegVisible);
  on(".segPoints:not(.inactive)", "click", onToggleEditPoints);
  on(".segDraw:not(.inactive)", "click", onToggleCustomPath);
  on(".segRecompute", "click", onSegRecompute);
  on(".segUp", "click", onSegMoveUp);
  on(".segDelete", "click", onSegDelete);

  const totals = journeyTotals(journey);
  ensureEl("jTotalDistance").innerHTML = `${rn(totals.totalKm)} ${unit}`;
  ensureEl("jAvgSpeed").innerHTML = totals.avgSpeed ? `${rn(totals.avgSpeed, 1)} ${unit}/h` : "-";
  ensureEl("jTravelTime").innerHTML = formatTravelTime(totals.totalHours, hoursPerDay);
  ensureEl("jHoursPerDay").innerHTML = String(hoursPerDay);

  drawJourneys();
  drawSegmentControlPoints();
  drawCustomPathPreview();
}

function getRowSegId(el: HTMLElement): number {
  const row = el.closest<HTMLElement>("[data-seg-id]");
  return +(row?.dataset.segId ?? "-1");
}

function getSegment(id: number): Segment | undefined {
  const journey = getJourney();
  return journey?.segments.find(s => s.id === id);
}

function onNameInput(this: HTMLInputElement): void {
  const journey = getJourney();
  if (journey) journey.name = this.value;
}

function onColorInput(this: HTMLInputElement): void {
  const journey = getJourney();
  if (!journey) return;
  journey.color = this.value;
  refresh();
}

function onToggleVisible(): void {
  const journey = getJourney();
  if (!journey) return;
  journey.visible = !journey.visible;
  drawJourneys();
}

function onToggleLock(this: HTMLElement): void {
  const journey = getJourney();
  if (!journey) return;
  journey.lock = !journey.lock;
  this.classList.toggle("icon-lock", !!journey.lock);
  this.classList.toggle("icon-lock-open", !journey.lock);
}

function onSegNameInput(this: HTMLInputElement): void {
  const seg = getSegment(getRowSegId(this));
  if (seg) seg.name = this.value;
}

function onSegTransportChange(this: HTMLSelectElement): void {
  const seg = getSegment(getRowSegId(this));
  if (!seg) return;
  const previousType = seg.transportType;
  const newTypeName = this.value;
  const newType = getTransportType(newTypeName);
  if (!newType) return;

  const newDomain = newType.domain;

  // Stay-domain switch: clear pathfinding-derived state, keep endpoints as anchors.
  if (newDomain === "stay") {
    seg.transportType = newTypeName;
    seg.speed = 0;
    seg.duration = seg.duration ?? 1;
    seg.avoidRoads = false;
    seg.custom = false;
    if (seg.from !== undefined && seg.to !== undefined) recomputeSegment(seg);
    refresh();
    return;
  }

  if (seg.from !== undefined && seg.to !== undefined) {
    const trialSeg = { ...seg, transportType: newTypeName };
    const msg = domainMismatchMessage(trialSeg, newDomain);
    if (msg) {
      this.value = previousType;
      showAlert(
        `Can't switch to ${newTypeName}`,
        `${msg}<br/><br/>Pick different endpoints first, then change the transport type — or use an <b>air</b> transport type which accepts any endpoints.`
      );
      return;
    }
  }

  seg.transportType = newTypeName;
  seg.speed = newType.speed;
  if (previousType && getDomain(previousType) === "stay") seg.duration = undefined;
  recomputeSegment(seg);
  refresh();
}

function onSegSpeedInput(this: HTMLInputElement): void {
  const seg = getSegment(getRowSegId(this));
  if (seg) {
    seg.speed = +this.value || 0;
    refresh();
  }
}

function onSegDurationInput(this: HTMLInputElement): void {
  const seg = getSegment(getRowSegId(this));
  if (!seg) return;
  seg.duration = Math.max(0, +this.value || 0);
  const journey = getJourney();
  if (!journey) return;
  const totals = journeyTotals(journey);
  const hoursPerDay = getHoursPerDay();
  ensureEl("jTravelTime").innerHTML = formatTravelTime(totals.totalHours, hoursPerDay);
}

function onSegRecompute(this: HTMLElement): void {
  const seg = getSegment(getRowSegId(this));
  if (!seg) return;
  const doIt = () => {
    seg.custom = false;
    recomputeSegment(seg);
    refresh();
  };
  if (seg.custom) {
    confirmationDialog({
      title: "Overwrite custom path?",
      message: `Segment "<b>${seg.name}</b>" has a custom-drawn path. Recomputing will replace it with the pathfinder's route. Continue?`,
      confirm: "Overwrite",
      onConfirm: doIt
    });
    return;
  }
  doIt();
}

function onToggleAvoidRoads(this: HTMLElement): void {
  const seg = getSegment(getRowSegId(this));
  if (!seg) return;
  seg.avoidRoads = !seg.avoidRoads;
  recomputeSegment(seg);
  refresh();
  const penaltyPct = Math.round((1 - OFF_ROAD_SPEED_FACTOR) * 100);
  tip(
    seg.avoidRoads
      ? `Segment set to off-road (avoids roads, ${penaltyPct}% speed penalty).`
      : "Segment set to follow roads (full speed).",
    true,
    "success",
    SUCCESS_TIP_MS
  );
}

function onSegNoteInput(this: HTMLInputElement): void {
  const seg = getSegment(getRowSegId(this));
  if (seg) seg.note = this.value;
}

function onSegColorInput(this: HTMLInputElement): void {
  const seg = getSegment(getRowSegId(this));
  if (!seg) return;
  seg.color = this.value;
  refresh();
}

function onSegColorReset(this: HTMLElement): void {
  const seg = getSegment(getRowSegId(this));
  if (!seg) return;
  seg.color = undefined;
  refresh();
}

function onToggleSegVisible(this: HTMLElement): void {
  const seg = getSegment(getRowSegId(this));
  if (!seg) return;
  seg.visible = !seg.visible;
  if (!seg.visible) {
    if (editingPointsSegId === seg.id) stopPointEditing();
    if (customPathSegId === seg.id) cancelCustomPath();
  }
  refresh();
}

// ---- path point editing -----------------------------------------------

function onToggleEditPoints(this: HTMLElement): void {
  const segId = getRowSegId(this);
  if (editingPointsSegId === segId) {
    stopPointEditing();
    refresh();
    tip("Finished editing path points.", true, "success", SUCCESS_TIP_MS);
    return;
  }

  const seg = getSegment(segId);
  if (!seg || seg.points.length < 2) {
    tip("This segment has no path yet — set both endpoints first.", true, "error", ERROR_TIP_MS);
    return;
  }

  if (customPathSegId !== null) cancelCustomPath();
  editingPointsSegId = segId;
  pointEditSpacing = medianSpacing(seg.points);
  refresh();
  tip(POINT_EDIT_HINT, true);
}

function tipPointError(message: string): void {
  tip(message, true, "error", ERROR_TIP_MS);
  const segId = editingPointsSegId;
  if (segId === null) return;
  window.setTimeout(() => {
    if (editingPointsSegId === segId) tip(POINT_EDIT_HINT, true);
  }, ERROR_TIP_MS + 100);
}

function stopPointEditing(): void {
  editingPointsSegId = null;
  pointEditSpacing = 0;
  select("#journeyControlPoints").remove();
  clearMainTip();
}

function controlPointsGroup() {
  const existing = select<SVGGElement, unknown>("#journeyControlPoints");
  if (!existing.empty()) return existing;
  return select("#viewbox").append("g").attr("id", "journeyControlPoints");
}

function drawSegmentControlPoints(): void {
  if (editingPointsSegId === null) {
    select("#journeyControlPoints").remove();
    return;
  }
  const journey = getJourney();
  const seg = getSegment(editingPointsSegId);
  if (!journey || !seg || seg.points.length < 2) {
    select("#journeyControlPoints").remove();
    return;
  }

  const color = seg.color || journey.color || DEFAULT_JOURNEY_COLOR;
  controlPointsGroup()
    .selectAll<SVGCircleElement, JourneyPoint>("circle")
    .data(seg.points)
    .join("circle")
    .attr("cx", d => d[0])
    .attr("cy", d => d[1])
    .attr("r", 0.8)
    .attr("fill", "#fff")
    .attr("stroke", color)
    .attr("stroke-width", 0.3)
    .style("cursor", "move")
    .call(drag<SVGCircleElement, JourneyPoint>().on("start", onDragControlPoint))
    .on("contextmenu", onRemoveControlPoint);

  select<SVGPathElement, unknown>(`#segment${journey.i}_${seg.id}`).on("click", onAddControlPoint);
}

function isPointAllowed(cellId: number, domain: TransportDomain, isEndpoint: boolean): boolean {
  return isEndpoint ? isValidEndpointForDomain(cellId, domain) : isValidPathPointForDomain(cellId, domain);
}

function terrainRejectionMessage(cellId: number, domain: TransportDomain, transportType: string): string {
  const rule =
    domain === "land"
      ? "its path has to stay on land"
      : "its path has to stay on water (only the start and end may sit on a coast)";
  return `${transportType} is a ${domain} transport — ${rule}. That spot is a ${describeCell(cellId)}.`;
}

function onDragControlPoint(event: any): void {
  const seg = editingPointsSegId === null ? undefined : getSegment(editingPointsSegId);
  if (!seg) return;
  const pointIndex = seg.points.indexOf(event.subject);
  if (pointIndex === -1) return;

  const domain = getDomain(seg.transportType);
  const isEndpoint = pointIndex === 0 || pointIndex === seg.points.length - 1;
  const original = event.subject as JourneyPoint;
  const originalFrom = seg.from;
  const originalTo = seg.to;
  let droppedCellId = original[2];

  event.on("drag", function (this: SVGCircleElement, dragEvent: any) {
    this.setAttribute("cx", String(dragEvent.x));
    this.setAttribute("cy", String(dragEvent.y));

    const x = rn(dragEvent.x, 2);
    const y = rn(dragEvent.y, 2);
    const cellId = findCell(x, y) ?? original[2];
    droppedCellId = cellId;

    const allowed = isPointAllowed(cellId, domain, isEndpoint);
    this.setAttribute("fill", allowed ? "#fff" : "#e04040");
    this.setAttribute("stroke", allowed ? seg.color || getJourney()?.color || DEFAULT_JOURNEY_COLOR : "#8b1a1a");

    const moved: JourneyPoint = [x, y, cellId];
    (this as unknown as { __data__: JourneyPoint }).__data__ = moved;
    seg.points[pointIndex] = moved;

    if (pointIndex === 0) seg.from = cellId;
    else if (pointIndex === seg.points.length - 1) seg.to = cellId;

    seg.distance = pathLength(seg.points);
    drawJourneys();
  });

  event.on("end", () => {
    if (isPointAllowed(droppedCellId, domain, isEndpoint)) {
      seg.points = resampleAround(seg.points, pointIndex, pointEditSpacing, (x, y) => findCell(x, y));
      seg.distance = pathLength(seg.points);
    } else {
      seg.points[pointIndex] = original;
      seg.from = originalFrom;
      seg.to = originalTo;
      seg.distance = pathLength(seg.points);
      tipPointError(`Point reverted — ${terrainRejectionMessage(droppedCellId, domain, seg.transportType)}`);
    }
    refresh();
  });
}

function onAddControlPoint(this: SVGPathElement, event: MouseEvent): void {
  const seg = editingPointsSegId === null ? undefined : getSegment(editingPointsSegId);
  if (!seg) return;
  event.stopPropagation();

  const [x, y] = getPointer(event, this);
  const px = rn(x, 2);
  const py = rn(y, 2);
  const cellId = findCell(px, py);
  if (cellId === undefined) return;

  const domain = getDomain(seg.transportType);
  if (!isValidPathPointForDomain(cellId, domain)) {
    tipPointError(`Can't add a point there — ${terrainRejectionMessage(cellId, domain, seg.transportType)}`);
    return;
  }

  seg.points.splice(closestSegmentIndex(seg.points, px, py), 0, [px, py, cellId]);
  seg.distance = pathLength(seg.points);
  refresh();
}

function onRemoveControlPoint(event: MouseEvent, point: JourneyPoint): void {
  event.preventDefault();
  const seg = editingPointsSegId === null ? undefined : getSegment(editingPointsSegId);
  if (!seg) return;

  if (seg.points.length <= 2) {
    tipPointError("A path needs at least two points.");
    return;
  }

  const index = seg.points.indexOf(point);
  if (index === -1) return;
  seg.points.splice(index, 1);
  seg.from = seg.points[0][2];
  seg.to = seg.points[seg.points.length - 1][2];
  seg.distance = pathLength(seg.points);
  refresh();
}

function closestSegmentIndex(points: JourneyPoint[], x: number, y: number): number {
  let bestIndex = 1;
  let bestDistance = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared));
    const distance = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return bestIndex;
}

// ---- custom path drawing (click-to-build) -----------------------------

function onToggleCustomPath(this: HTMLElement): void {
  const segId = getRowSegId(this);
  // Clicking the same brush button again ends drawing — finish if the path is
  // usable (≥2 points), otherwise cancel. Esc is always a hard cancel.
  if (customPathSegId === segId) {
    if (customPathPoints.length >= 2) finishCustomPath();
    else {
      cancelCustomPath();
      refresh();
      tip("Custom path cancelled — you need at least two points.", true, "warn", WARN_TIP_MS);
    }
    return;
  }
  const seg = getSegment(segId);
  if (!seg) return;

  if (editingPointsSegId !== null) stopPointEditing();
  endCellPick();

  customPathSegId = segId;
  customPathPoints = [];
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click.journeyDraw", onCustomPathClick);
  document.addEventListener("contextmenu", onCustomPathRightClick);
  document.addEventListener("keydown", onCustomPathKey, true);
  showDrawToolbar();
  refresh();
  tip(CUSTOM_PATH_HINT, true);
}

function showDrawToolbar(): void {
  destroyDrawToolbar();
  const html = /* html */ `<div id="journeyDrawToolbar">
    <span id="journeyDrawStatus">0 points</span>
    <button id="journeyDrawFinish" data-tip="Save this path (need ≥2 points)" class="icon-check" disabled>Finish</button>
    <button id="journeyDrawUndo" data-tip="Remove the last point (right-click)" class="icon-left" disabled>Undo</button>
    <button id="journeyDrawCancel" data-tip="Discard drawing (Esc)" class="icon-cancel">Cancel</button>
    <span class="journeyDrawHint">Click cells to add points. Right-click undoes.</span>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  ensureEl("journeyDrawFinish").on("click", finishCustomPath);
  ensureEl("journeyDrawUndo").on("click", undoLastCustomPoint);
  ensureEl("journeyDrawCancel").on("click", () => {
    cancelCustomPath();
    refresh();
  });
}

function updateDrawToolbar(): void {
  const status = document.getElementById("journeyDrawStatus");
  const finish = document.getElementById("journeyDrawFinish") as HTMLButtonElement | null;
  const undo = document.getElementById("journeyDrawUndo") as HTMLButtonElement | null;
  if (status) status.textContent = `${customPathPoints.length} point${customPathPoints.length === 1 ? "" : "s"}`;
  if (finish) finish.disabled = customPathPoints.length < 2;
  if (undo) undo.disabled = customPathPoints.length === 0;
}

function destroyDrawToolbar(): void {
  document.getElementById("journeyDrawToolbar")?.remove();
}

function undoLastCustomPoint(): void {
  if (customPathSegId === null) return;
  customPathPoints.pop();
  drawCustomPathPreview();
}

function onCustomPathClick(this: SVGElement, event: MouseEvent): void {
  if (customPathSegId === null) return;
  const seg = getSegment(customPathSegId);
  if (!seg) return;

  const [x, y] = getPointer(event, this);
  const px = rn(x, 2);
  const py = rn(y, 2);
  const cellId = findCell(px, py);
  if (cellId === undefined) return;

  const domain = getDomain(seg.transportType);
  const isEndpoint = customPathPoints.length === 0;
  if (!isPointAllowed(cellId, domain, isEndpoint)) {
    tip(
      `Can't add a point there — ${terrainRejectionMessage(cellId, domain, seg.transportType)}`,
      true,
      "error",
      ERROR_TIP_MS
    );
    return;
  }
  customPathPoints.push([px, py, cellId]);
  drawCustomPathPreview();
  updateDrawToolbar();
}

function onCustomPathRightClick(event: MouseEvent): void {
  if (customPathSegId === null) return;
  event.preventDefault();
  customPathPoints.pop();
  drawCustomPathPreview();
  updateDrawToolbar();
}

function onCustomPathKey(event: KeyboardEvent): void {
  if (customPathSegId === null) return;
  if (event.key === "Escape") {
    cancelCustomPath();
    refresh();
    return;
  }
  if (event.key === "Enter") {
    finishCustomPath();
  }
}

function finishCustomPath(): void {
  if (customPathSegId === null) return;
  const seg = getSegment(customPathSegId);
  if (!seg) {
    cancelCustomPath();
    return;
  }

  if (customPathPoints.length < 2) {
    tip("A custom path needs at least two points.", true, "error", ERROR_TIP_MS);
    return;
  }

  seg.points = customPathPoints.slice();
  seg.from = seg.points[0][2];
  seg.to = seg.points[seg.points.length - 1][2];
  seg.distance = pathLength(seg.points);
  seg.custom = true;

  const domain = getDomain(seg.transportType);
  const domainMsg = domainMismatchMessage(seg, domain);
  if (domainMsg) tip(domainMsg.replace(/<\/?b>/g, ""), true, "warn", WARN_TIP_MS);

  cancelCustomPath();
  refresh();
  tip("Custom path saved.", true, "success", SUCCESS_TIP_MS);
}

function cancelCustomPath(): void {
  customPathSegId = null;
  customPathPoints = [];
  select<SVGElement, unknown>("#viewbox").style("cursor", null).on("click.journeyDraw", null);
  document.removeEventListener("contextmenu", onCustomPathRightClick);
  document.removeEventListener("keydown", onCustomPathKey, true);
  select("#journeyCustomPreview").remove();
  destroyDrawToolbar();
  clearMainTip();
}

function drawCustomPathPreview(): void {
  if (customPathSegId === null) {
    select("#journeyCustomPreview").remove();
    return;
  }
  const journey = getJourney();
  const seg = getSegment(customPathSegId);
  if (!journey || !seg) return;
  const color = seg.color || journey.color || DEFAULT_JOURNEY_COLOR;
  select("#journeyCustomPreview").remove();
  const g = select("#viewbox").append("g").attr("id", "journeyCustomPreview").style("pointer-events", "none");

  // Ghost markers for the segment's existing from/to cells — visible anchors so
  // the user knows what will be replaced when they finish.
  const ghostAnchor = (cellId: number | undefined, label: string) => {
    if (cellId === undefined || !pack.cells.p[cellId]) return;
    const [x, y] = pack.cells.p[cellId];
    const anchor = g.append("g").attr("class", "journeyGhostAnchor");
    anchor
      .append("circle")
      .attr("cx", x)
      .attr("cy", y)
      .attr("r", 1.8)
      .attr("fill", "none")
      .attr("stroke", "#666")
      .attr("stroke-dasharray", "0.8 0.6")
      .attr("stroke-width", 0.4);
    anchor
      .append("text")
      .attr("x", x)
      .attr("y", y - 2.6)
      .attr("text-anchor", "middle")
      .attr("font-size", 2)
      .attr("fill", "#666")
      .text(label);
  };
  if (!customPathPoints.length) {
    ghostAnchor(seg.from, "from");
    ghostAnchor(seg.to, "to");
    return;
  }

  const d = customPathPoints.map((p, i) => `${(i === 0 ? "M" : "L") + p[0]} ${p[1]}`).join(" ");
  g.append("path")
    .attr("d", d)
    .attr("fill", "none")
    .attr("stroke", color)
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "2 1");

  customPathPoints.forEach((p, i) => {
    const isStart = i === 0;
    const isLast = i === customPathPoints.length - 1;
    g.append("circle")
      .attr("cx", p[0])
      .attr("cy", p[1])
      .attr("r", isStart ? 1.5 : 0.9)
      .attr("fill", isStart ? "#2a6e2a" : "#fff")
      .attr("stroke", isStart ? "#fff" : color)
      .attr("stroke-width", isStart ? 0.4 : 0.3);
    if (isStart) {
      g.append("text")
        .attr("x", p[0])
        .attr("y", p[1] - 2.4)
        .attr("text-anchor", "middle")
        .attr("font-size", 2)
        .attr("fill", "#2a6e2a")
        .text("start");
    }
    if (isLast && !isStart) {
      g.append("text")
        .attr("x", p[0])
        .attr("y", p[1] - 2)
        .attr("text-anchor", "middle")
        .attr("font-size", 2)
        .attr("fill", color)
        .text(String(i + 1));
    }
  });
}

// -----------------------------------------------------------------------

function onSegMoveUp(this: HTMLElement): void {
  const journey = getJourney();
  if (!journey) return;
  const id = getRowSegId(this);
  const idx = journey.segments.findIndex(s => s.id === id);
  if (idx > 0) {
    const [seg] = journey.segments.splice(idx, 1);
    journey.segments.splice(idx - 1, 0, seg);
    refresh();
  }
}

function onSegDelete(this: HTMLElement): void {
  const journey = getJourney();
  if (!journey) return;
  const id = getRowSegId(this);
  if (editingPointsSegId === id) stopPointEditing();
  if (customPathSegId === id) cancelCustomPath();
  journey.segments = journey.segments.filter(s => s.id !== id);
  refresh();
}

function onPickFrom(this: HTMLElement): void {
  beginCellPick(getRowSegId(this), "from");
}

function onPickTo(this: HTMLElement): void {
  beginCellPick(getRowSegId(this), "to");
}

function beginCellPick(segmentId: number, endpoint: "from" | "to", chainNextTo = false): void {
  if (customPathSegId !== null) cancelCustomPath();
  pickState = { segmentId, endpoint, chainNextTo };
  tip(`Click on the map to pick the '${endpoint}' cell. Press Esc to cancel.`, true);
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click.journeyPick", onMapClick);
  document.addEventListener("keydown", onEscape);
}

function onEscape(e: KeyboardEvent): void {
  if (e.key === "Escape") endCellPick();
}

function onMapClick(this: SVGElement, event: MouseEvent): void {
  if (!pickState) {
    endCellPick();
    return;
  }
  const [x, y] = getPointer(event, this);
  const cellId = findCell(x, y);
  if (cellId === undefined) return;

  const seg = getSegment(pickState.segmentId);
  if (!seg) {
    endCellPick();
    return;
  }

  const domain = getDomain(seg.transportType);
  if (!isValidEndpointForDomain(cellId, domain)) {
    showAlert(
      `Invalid cell for ${seg.transportType}`,
      `You clicked a ${describeCell(cellId)}, but <b>${seg.transportType}</b> is a <b>${domain}</b> transport type.<br/><br/>` +
        (domain === "land"
          ? "Pick a land cell (coastal is fine)."
          : domain === "water"
            ? "Pick a water cell or a coastal cell touching water."
            : "Any cell should work — this shouldn't happen.")
    );
    return;
  }

  if (pickState.endpoint === "from") seg.from = cellId;
  else seg.to = cellId;

  const chainNext = pickState.chainNextTo;
  endCellPick();

  if (seg.from !== undefined && seg.to !== undefined) recomputeSegment(seg);
  refresh();

  if (chainNext) {
    tip("Now click the destination cell.", true);
    beginCellPick(seg.id, "to");
  }
}

function endCellPick(): void {
  pickState = null;
  select<SVGElement, unknown>("#viewbox").style("cursor", null).on("click.journeyPick", null);
  document.removeEventListener("keydown", onEscape);
  clearMainTip();
}

function getTransportType(name: string): TransportType | undefined {
  return pack.transportTypes.find(t => t.name === name);
}

function getDomain(name: string): TransportDomain {
  return getTransportType(name)?.domain ?? "air";
}

function showAlert(title: string, message: string): void {
  ensureEl("alertMessage").innerHTML = message;
  $("#alert").dialog({
    resizable: false,
    title,
    width: "26em",
    position: { my: "center", at: "center", of: "svg" },
    buttons: {
      OK: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function domainMismatchMessage(seg: Segment, domain: TransportDomain): string | null {
  if (domain === "air" || domain === "stay") return null;
  const badFrom = seg.from !== undefined && !isValidEndpointForDomain(seg.from, domain);
  const badTo = seg.to !== undefined && !isValidEndpointForDomain(seg.to, domain);
  if (!badFrom && !badTo) return null;
  const parts: string[] = [];
  if (badFrom) parts.push(`<b>From</b> is a ${describeCell(seg.from!)}`);
  if (badTo) parts.push(`<b>To</b> is a ${describeCell(seg.to!)}`);
  const need =
    domain === "land"
      ? "This transport type is <b>land</b> — endpoints must be on land (coastal is fine)."
      : "This transport type is <b>water</b> — endpoints must be in water, or on a coast touching water.";
  return `${parts.join(" and ")}.<br/><br/>${need}`;
}

function recomputeSegment(seg: Segment): void {
  if (seg.custom) return; // Never overwrite a custom-drawn path silently.
  if (seg.from === undefined || seg.to === undefined) return;
  const domain = getDomain(seg.transportType);

  if (domain === "stay") {
    // Stay: draw a direct line so it renders as an anchored dot/short segment.
    const result = findJourneyPath(seg.from, seg.to, "air");
    seg.points = result.points;
    seg.distance = result.distance;
    return;
  }

  const result = findJourneyPath(seg.from, seg.to, domain, {
    avoidRoads: domain === "land" && !!seg.avoidRoads
  });
  seg.points = result.points;
  seg.distance = result.distance;

  if (result.errorCode === "no-land" || result.errorCode === "no-water") {
    const msg = domainMismatchMessage(seg, domain) ?? result.warning ?? "Invalid segment.";
    showAlert(`Can't use ${seg.transportType} here`, msg);
  } else if (result.errorCode === "no-land-path") {
    showAlert(
      `No land route for ${seg.transportType}`,
      `Segment "<b>${seg.name}</b>" has no land connection between its endpoints. They may be on different landmasses — consider a water or air transport type instead.`
    );
  } else if (result.errorCode === "no-water-path") {
    showAlert(
      `No sea route for ${seg.transportType}`,
      `Segment "<b>${seg.name}</b>" has no water connection between its endpoints. They may be in different bodies of water — consider a land or air transport type instead.`
    );
  } else if (result.warning) {
    tip(result.warning, true, "warn", WARN_TIP_MS);
  }
}

function recomputeAll(): void {
  const journey = getJourney();
  if (!journey) return;
  const customCount = journey.segments.filter(s => s.custom).length;
  const doIt = () => {
    for (const seg of journey.segments) {
      seg.custom = false;
      recomputeSegment(seg);
    }
    refresh();
    tip("All segments recomputed", true, "success", SUCCESS_TIP_MS);
  };
  if (customCount) {
    confirmationDialog({
      title: "Overwrite custom paths?",
      message: `${customCount} segment${customCount > 1 ? "s have" : " has"} a custom-drawn path. Recomputing will replace them. Continue?`,
      confirm: "Overwrite",
      onConfirm: doIt
    });
    return;
  }
  doIt();
}

function createEmptySegment(journey: Journey): Segment {
  const nextId = journey.segments.length ? Math.max(...journey.segments.map(s => s.id)) + 1 : 0;
  const defaultTransport = pack.transportTypes.find(t => t.domain !== "stay") ?? pack.transportTypes[0];
  const prev = journey.segments[journey.segments.length - 1];
  const seg: Segment = {
    id: nextId,
    name: `Segment ${nextId + 1}`,
    visible: true,
    from: prev?.to,
    to: undefined,
    transportType: defaultTransport?.name ?? "Direct",
    speed: defaultTransport?.speed ?? 5,
    distance: 0,
    points: []
  };
  journey.segments.push(seg);
  return seg;
}

function addSegment(): void {
  const journey = getJourney();
  if (!journey) return;
  const isFirst = !journey.segments.length;
  const seg = createEmptySegment(journey);
  refresh();

  if (isFirst) {
    tip("First click the start cell on the map, then the destination.", true);
    beginCellPick(seg.id, "from", true);
  } else {
    tip("Click the destination cell on the map.", true);
    beginCellPick(seg.id, "to");
  }
}

function downloadSegments(): void {
  const journey = getJourney();
  if (!journey) return;
  const unit = distanceUnitInput.value;
  let data = `Idx,Name,TransportType,Speed(${unit}/h),EffectiveSpeed(${unit}/h),DistancePx,Distance(${unit}),TimeHours,From,To,AvoidRoads,Custom,Visible,Color,Note\n`;
  journey.segments.forEach((s, i) => {
    const km = segmentLengthKm(s);
    const hours = segmentTimeHours(s);
    const note = (s.note ?? "").replace(/"/g, '""');
    data += `${i + 1},"${s.name}","${s.transportType}",${s.speed},${rn(effectiveSpeed(s), 2)},${rn(s.distance, 2)},${rn(km, 2)},${rn(hours, 2)},${s.from ?? ""},${s.to ?? ""},${s.avoidRoads ? "yes" : "no"},${s.custom ? "yes" : "no"},${s.visible ? "yes" : "no"},${s.color ?? ""},"${note}"\n`;
  });
  downloadFile(data, `${getFileName(journey.name || "Journey")}.csv`);
}

function openTransportEditor(): void {
  void Controllers.TransportTypesEditor.open();
}

function removeJourney(): void {
  const journey = getJourney();
  if (!journey) return;
  confirmationDialog({
    title: "Remove journey",
    message: `Remove journey <b>${journey.name}</b>? This action cannot be reverted.`,
    confirm: "Remove",
    onConfirm: () => {
      pack.journeys = pack.journeys.filter(j => j.i !== journey.i);
      drawJourneys();
      $("#journeyEditor").dialog("close");
    }
  });
}

function onClose(): void {
  endCellPick();
  stopPointEditing();
  cancelCustomPath();
  applyDefaultViewboxEvents();
  document.removeEventListener(TRANSPORT_TYPES_CHANGED, onTransportTypesChanged);
  editingJourneyId = null;
  destroyDialogIfExists("journeyEditor");
}

export const JourneyEditor = { open };
