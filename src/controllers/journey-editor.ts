import { drag, select } from "d3";
import { closeDialogs, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import { TRANSPORT_TYPES_CHANGED } from "@/controllers/transport-types-editor";
import { getDefaultTransportTypes } from "@/data/transport-types";
import { drawJourneys } from "@/renderers/draw-journeys";
import type { Journey, JourneyPoint, Segment, TransportDomain, TransportType } from "@/types/Journey";
import { downloadFile, getFileName, getPointer, rn } from "@/utils";
import {
  effectiveSpeed,
  formatTravelTime,
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

const SEGMENT_GRID_COLUMNS = "2em 7em 9em 4.5em 5.5em 5.5em 5em 3.5em 4em 7em 2em 1.8em 1.8em 1.8em 1.8em 1.8em";
const DEFAULT_JOURNEY_COLOR = "#8b1a1a";
/** Errors explain a rule and need time to read; confirmations only acknowledge an action. */
const ERROR_TIP_MS = 9000;
const WARN_TIP_MS = 7000;
const SUCCESS_TIP_MS = 2500;
const POINT_EDIT_HINT =
  "Drag the circles to reshape the path. Click the path to add a point, right-click a point to remove it.";

let editingJourneyId: number | null = null;
let pickState: {
  segmentId: number;
  endpoint: "from" | "to";
  chainNextTo?: boolean;
} | null = null;
/** Segment whose path points are currently being drag-edited on the map, if any. */
let editingPointsSegId: number | null = null;
/**
 * Point spacing captured when editing started, used to refill edges that dragging
 * stretches. Taken once so it reflects the pathfinder's natural density rather than
 * drifting upward as the user's own edits lengthen the path.
 */
let pointEditSpacing = 0;

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

// When transport types are added/renamed/deleted from the Transport Types editor,
// rebuild every dropdown in this editor so the user sees the new types immediately.
function onTransportTypesChanged(): void {
  const journey = getJourney();
  if (!journey) return;
  // Repopulate every segment-row's transport dropdown, preserving the current selection.
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

  const unit = distanceUnitInput.value;
  const transportOptions = pack.transportTypes
    .map(t => `<option value="${t.name}">${t.name} (${t.domain}, ${t.speed} ${unit}/h)</option>`)
    .join("");

  const html = /* html */ `<div id="journeyEditor" class="dialog stable">
    <style>
      /* From/To cells are clickable map-pickers — style them as chips so that reads visually */
      #journeyEditor .cellPick {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
        padding: 1px 4px;
        border-radius: 3px;
        border: 1px solid #9c9186;
        background: #efe9df;
        color: #4a4038;
        font-size: 0.85em;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.12s ease, border-color 0.12s ease;
      }
      #journeyEditor .cellPick:hover {
        background: #ddd0bb;
        border-color: #5f554c;
      }
      #journeyEditor .cellPick.unset {
        border-style: dashed;
        border-color: #b3aca3;
        background: transparent;
        color: #8a8078;
        font-style: italic;
      }
      #journeyEditor .cellPick.unset:hover {
        background: #efe9df;
        border-color: #5f554c;
        color: #4a4038;
      }

      /* Grid children default to min-width:auto and refuse to shrink below their
         intrinsic size, which lets wide controls spill into the next column. */
      #journeyEditor #segmentsBody > div > * {
        min-width: 0;
      }
      #journeyEditor #segmentsBody input:not([type="color"]),
      #journeyEditor #segmentsBody select {
        width: 100%;
        box-sizing: border-box;
      }

      /* Native colour inputs have a fixed intrinsic width — pin it to a compact swatch */
      #journeyEditor .segColor {
        width: 1.7em;
        height: 1.3em;
        padding: 0;
        border: 1px solid #9c9186;
        border-radius: 3px;
        background: none;
        cursor: pointer;
      }
      #journeyEditor .segColor::-webkit-color-swatch-wrapper {
        padding: 1px;
      }
      #journeyEditor .segColor::-webkit-color-swatch {
        border: none;
        border-radius: 2px;
      }

      #journeyEditor .segVisible,
      #journeyEditor .segPoints {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
    </style>
    <div id="journeyHeader" style="display: grid; grid-template-columns: auto 1fr auto auto auto auto; gap: 0.4em; align-items: center; margin-bottom: 0.5em;">
      <label>Name:</label>
      <input id="journeyName" value="${journey.name}" />
      <label style="margin-left: 0.6em;">Color:</label>
      <input id="journeyColor" type="color" value="${journey.color}" />
      <span id="journeyVisible" data-tip="Toggle visibility" class="pointer icon-eye"></span>
      <span id="journeyLock" data-tip="Lock/unlock journey" class="pointer ${journey.lock ? "icon-lock" : "icon-lock-open"}"></span>
    </div>

    <div id="journeyStartEnd" style="display: flex; gap: 1.2em; align-items: center; margin-bottom: 0.6em; padding: 0.3em 0.5em; background: #f5f2ea; border-radius: 4px;">
      <div>
        <b>Start:</b>
        <span id="journeyStartLabel">—</span>
        <button id="journeyPickStart" data-tip="Click on the map to set the journey's start cell (first segment's From)" class="icon-map-pin" style="margin-left: 0.3em;">Set start</button>
      </div>
      <div>
        <b>End:</b>
        <span id="journeyEndLabel">—</span>
        <button id="journeyPickEnd" data-tip="Click on the map to set the journey's end cell (last segment's To)" class="icon-map-pin" style="margin-left: 0.3em;">Set end</button>
      </div>
    </div>

    <div id="segmentsTable" class="table" style="min-width: 72em; margin-bottom: 0.5em;">
      <div class="header" style="display: grid; grid-template-columns: ${SEGMENT_GRID_COLUMNS}; gap: 0.3em; padding: 0.2em; font-weight: bold;">
        <div>#</div><div>Name</div><div>Transport</div><div>Speed</div><div>From</div><div>To</div><div>Dist</div><div>Time</div><div title="Roads / Off-road (land only)">Roads</div><div>Note</div><div title="Segment color">Col</div><div title="Segment visibility">Vis</div><div title="Edit path points">Pts</div><div></div><div></div><div></div>
      </div>
      <div id="segmentsBody"></div>
    </div>

    <div id="journeyFooter" class="totalLine" style="margin-bottom: 0.4em;">
      <div><b>Total distance:</b> <span id="jTotalDistance">0</span></div>
      <div style="margin-left: 1em;"><b>Average speed:</b> <span id="jAvgSpeed">0</span></div>
      <div style="margin-left: 1em;"><b>Travel time:</b> <span id="jTravelTime">0</span></div>
    </div>

    <div id="journeyBottom">
      <button id="journeyAddSegment" data-tip="Add a new segment; you'll click the map to pick 'from' and 'to' cells" class="icon-plus">Add segment</button>
      <button id="journeyRecompute" data-tip="Re-run pathfinding on all segments" class="icon-cw">Recompute</button>
      <button id="journeyExport" data-tip="Download this journey's segments as CSV" class="icon-download">CSV</button>
      <button id="journeyEditTransport" data-tip="Edit transport types" class="icon-cog">Transport…</button>
      <button id="journeyRemove" data-tip="Remove journey" class="icon-trash">Remove</button>
    </div>

    <template id="transportOptionsTmpl">${transportOptions}</template>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl("journeyName").on("input", onNameInput);
  ensureEl("journeyColor").on("input", onColorInput);
  ensureEl("journeyVisible").on("click", onToggleVisible);
  ensureEl("journeyLock").on("click", onToggleLock);
  ensureEl("journeyPickStart").on("click", pickJourneyStart);
  ensureEl("journeyPickEnd").on("click", pickJourneyEnd);
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

  journey.segments.forEach((seg, index) => {
    const row = document.createElement("div");
    row.className = "editorLine";
    row.style.cssText = `display: grid; grid-template-columns: ${SEGMENT_GRID_COLUMNS}; gap: 0.3em; padding: 0.2em; align-items: center;`;
    row.dataset.segId = String(seg.id);
    const isLandSeg = getDomain(seg.transportType) === "land";
    const roadsIcon = seg.avoidRoads ? "icon-tree" : "icon-map-signs";
    const roadsLabel = seg.avoidRoads ? "Off" : "On";
    const penaltyPct = Math.round((1 - OFF_ROAD_SPEED_FACTOR) * 100);
    const roadsTip = isLandSeg
      ? seg.avoidRoads
        ? `Off-road — pathfinder avoids the road network (${penaltyPct}% speed penalty). Click to switch to on-road.`
        : "On-road — pathfinder follows the road network. Click to go off-road (avoids roads)."
      : "Roads only apply to land transport";
    const bgColor = seg.avoidRoads ? "#f4dede" : "#dcecdc";
    const fgColor = seg.avoidRoads ? "#8b1a1a" : "#2a6e2a";
    const roadsCell = isLandSeg
      ? `<button class="segRoads ${roadsIcon}" data-tip="${roadsTip}" style="cursor: pointer; padding: 2px 6px; border-radius: 3px; border: 1px solid ${fgColor}; background: ${bgColor}; color: ${fgColor}; font-size: 0.85em; display: inline-flex; align-items: center; gap: 3px;"> ${roadsLabel}</button>`
      : `<span class="segRoads inactive ${roadsIcon}" data-tip="${roadsTip}" style="opacity: 0.35; padding: 2px 6px; border-radius: 3px; border: 1px dashed #999; color: #999; font-size: 0.85em; display: inline-flex; align-items: center; gap: 3px;"> n/a</span>`;
    const isEditingPoints = editingPointsSegId === seg.id;
    const hasPath = seg.points.length >= 2;
    const pointsTip = hasPath
      ? isEditingPoints
        ? "Editing path points — drag the circles on the map to reshape, click the path to add a point, right-click a point to remove it. Click to finish."
        : "Edit this segment's path points on the map"
      : "Set both endpoints first to get a path";
    row.innerHTML = /* html */ `
      <div>${index + 1}</div>
      <input class="segName" value="${seg.name}" />
      <select class="segTransport">${transportOptions.replace(`value="${seg.transportType}"`, `value="${seg.transportType}" selected`)}</select>
      <input class="segSpeed" type="number" step="0.5" min="0" value="${seg.speed}" title="${seg.avoidRoads ? `Effective: ${rn(effectiveSpeed(seg), 1)} ${distanceUnitInput.value}/h (off-road penalty)` : ""}" />
      <span class="segFrom cellPick icon-map-pin ${seg.from === undefined ? "unset" : ""}" data-tip="${seg.from === undefined ? "Not set — click, then click a cell on the map to set the start of this segment" : `Starts at cell ${seg.from} — click to pick a different cell on the map`}"> ${seg.from ?? "pick"}</span>
      <span class="segTo cellPick icon-map-pin ${seg.to === undefined ? "unset" : ""}" data-tip="${seg.to === undefined ? "Not set — click, then click a cell on the map to set the end of this segment" : `Ends at cell ${seg.to} — click to pick a different cell on the map`}"> ${seg.to ?? "pick"}</span>
      <div>${rn(segmentLengthKm(seg))} ${distanceUnitInput.value}</div>
      <div>${formatTravelTime(segmentTimeHours(seg))}</div>
      ${roadsCell}
      <input class="segNote" value="${(seg.note ?? "").replace(/"/g, "&quot;")}" placeholder="note…" data-tip="Free-text note for this segment" />
      <input class="segColor" type="color" value="${seg.color || journey.color || DEFAULT_JOURNEY_COLOR}" data-tip="Segment color (overrides the journey color)" />
      <span class="segVisible pointer ${seg.visible ? "icon-eye" : "icon-eye-off"}" data-tip="${seg.visible ? "Segment is visible — click to hide" : "Segment is hidden — click to show"}" style="${seg.visible ? "" : "opacity: 0.4;"}"></span>
      <span class="segPoints pointer icon-pencil ${hasPath ? "" : "inactive"}" data-tip="${pointsTip}" style="${isEditingPoints ? "color: #2a6e2a; font-weight: bold;" : hasPath ? "" : "opacity: 0.35;"}"></span>
      <span class="segRecompute pointer icon-cw" data-tip="Recompute this segment's path (discards manual point edits)"></span>
      <span class="segUp pointer icon-up-open" data-tip="Move up"></span>
      <span class="segDelete pointer icon-trash-empty" data-tip="Delete segment"></span>`;
    body.appendChild(row);
  });

  body.querySelectorAll<HTMLInputElement>(".segName").forEach(el => {
    el.on("input", onSegNameInput);
  });
  body.querySelectorAll<HTMLSelectElement>(".segTransport").forEach(el => {
    el.on("change", onSegTransportChange);
  });
  body.querySelectorAll<HTMLInputElement>(".segSpeed").forEach(el => {
    el.on("input", onSegSpeedInput);
  });
  body.querySelectorAll<HTMLElement>(".segFrom").forEach(el => {
    el.on("click", onPickFrom);
  });
  body.querySelectorAll<HTMLElement>(".segTo").forEach(el => {
    el.on("click", onPickTo);
  });
  body.querySelectorAll<HTMLElement>(".segRoads:not(.inactive)").forEach(el => {
    el.on("click", onToggleAvoidRoads);
  });
  body.querySelectorAll<HTMLInputElement>(".segNote").forEach(el => {
    el.on("input", onSegNoteInput);
  });
  body.querySelectorAll<HTMLInputElement>(".segColor").forEach(el => {
    el.on("input", onSegColorInput);
  });
  body.querySelectorAll<HTMLElement>(".segVisible").forEach(el => {
    el.on("click", onToggleSegVisible);
  });
  body.querySelectorAll<HTMLElement>(".segPoints:not(.inactive)").forEach(el => {
    el.on("click", onToggleEditPoints);
  });
  body.querySelectorAll<HTMLElement>(".segRecompute").forEach(el => {
    el.on("click", onSegRecompute);
  });
  body.querySelectorAll<HTMLElement>(".segUp").forEach(el => {
    el.on("click", onSegMoveUp);
  });
  body.querySelectorAll<HTMLElement>(".segDelete").forEach(el => {
    el.on("click", onSegDelete);
  });

  const totals = journeyTotals(journey);
  ensureEl("jTotalDistance").innerHTML = `${rn(totals.totalKm)} ${distanceUnitInput.value}`;
  ensureEl("jAvgSpeed").innerHTML = totals.avgSpeed ? `${rn(totals.avgSpeed, 1)} ${distanceUnitInput.value}/h` : "-";
  ensureEl("jTravelTime").innerHTML = formatTravelTime(totals.totalHours);

  const firstSeg = journey.segments[0];
  const lastSeg = journey.segments[journey.segments.length - 1];
  ensureEl("journeyStartLabel").innerHTML = firstSeg?.from !== undefined ? `cell ${firstSeg.from}` : "—";
  ensureEl("journeyEndLabel").innerHTML = lastSeg?.to !== undefined ? `cell ${lastSeg.to}` : "—";

  drawJourneys();
  drawSegmentControlPoints();
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
  if (!journey) return;
  journey.name = this.value;
}

function onColorInput(this: HTMLInputElement): void {
  const journey = getJourney();
  if (!journey) return;
  journey.color = this.value;
  drawJourneys();
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

  // If the new transport domain doesn't accept the segment's current endpoints,
  // block the change, revert the dropdown, and explain via an alert dialog.
  if (seg.from !== undefined && seg.to !== undefined) {
    const trialSeg = { ...seg, transportType: newTypeName };
    const msg = domainMismatchMessage(trialSeg, newType.domain);
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

function onSegRecompute(this: HTMLElement): void {
  const seg = getSegment(getRowSegId(this));
  if (!seg) return;
  recomputeSegment(seg);
  refresh();
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
  drawJourneys();
  drawSegmentControlPoints();
}

function onToggleSegVisible(this: HTMLElement): void {
  const seg = getSegment(getRowSegId(this));
  if (!seg) return;
  seg.visible = !seg.visible;
  if (!seg.visible && editingPointsSegId === seg.id) stopPointEditing();
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

  editingPointsSegId = segId;
  pointEditSpacing = medianSpacing(seg.points);
  refresh();
  tip(POINT_EDIT_HINT, true);
}

/**
 * Show an error that survives hover (pinned) and lasts long enough to read, then hand the
 * tooltip line back to the point-editing hint if that mode is still active.
 */
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

  // The path is re-created by drawJourneys on every refresh, so rebind each time.
  select<SVGPathElement, unknown>(`#segment${journey.i}_${seg.id}`).on("click", onAddControlPoint);
}

/** A point is judged by endpoint rules at the ends of a path and by the stricter mid-path rules elsewhere. */
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

    // Flag impassable terrain while dragging so the problem is visible before release.
    const allowed = isPointAllowed(cellId, domain, isEndpoint);
    this.setAttribute("fill", allowed ? "#fff" : "#e04040");
    this.setAttribute("stroke", allowed ? seg.color || getJourney()?.color || DEFAULT_JOURNEY_COLOR : "#8b1a1a");

    const moved: JourneyPoint = [x, y, cellId];
    (this as unknown as { __data__: JourneyPoint }).__data__ = moved;
    seg.points[pointIndex] = moved;

    // Endpoints stay in sync with the cells the journey is anchored to.
    if (pointIndex === 0) seg.from = cellId;
    else if (pointIndex === seg.points.length - 1) seg.to = cellId;

    seg.distance = pathLength(seg.points);
    drawJourneys();
  });

  event.on("end", () => {
    if (isPointAllowed(droppedCellId, domain, isEndpoint)) {
      // The drag stretched this point's edges; refill them so the path stays editable.
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

  // An inserted point is always mid-path, so it never gets endpoint leniency.
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

/** Index at which to insert a new point so it lands on the nearest existing leg of the path. */
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
  journey.segments = journey.segments.filter(s => s.id !== id);
  refresh();
}

function onPickFrom(this: HTMLElement): void {
  const id = getRowSegId(this);
  beginCellPick(id, "from");
}

function onPickTo(this: HTMLElement): void {
  const id = getRowSegId(this);
  beginCellPick(id, "to");
}

function beginCellPick(segmentId: number, endpoint: "from" | "to", chainNextTo = false): void {
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
    // Don't apply the click; keep the picker active so the user can try again.
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

  // if we just set 'from' on a fresh segment, chain into picking 'to'
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

// Shows a blocking alert dialog with a clear title + message. Used for domain-mismatch errors.
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
  const badFrom = seg.from !== undefined && !isValidEndpointForDomain(seg.from, domain);
  const badTo = seg.to !== undefined && !isValidEndpointForDomain(seg.to, domain);
  if (!badFrom && !badTo) return null;
  const parts: string[] = [];
  if (badFrom) parts.push(`<b>From</b> is a ${describeCell(seg.from!)}`);
  if (badTo) parts.push(`<b>To</b> is a ${describeCell(seg.to!)}`);
  const need =
    domain === "land"
      ? "This transport type is <b>land</b> — endpoints must be on land (coastal is fine)."
      : domain === "water"
        ? "This transport type is <b>water</b> — endpoints must be in water, or on a coast touching water."
        : "This transport type is <b>air</b> and should accept anything — this shouldn't happen.";
  return `${parts.join(" and ")}.<br/><br/>${need}`;
}

function recomputeSegment(seg: Segment): void {
  if (seg.from === undefined || seg.to === undefined) return;
  const domain = getDomain(seg.transportType);
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
  for (const seg of journey.segments) recomputeSegment(seg);
  refresh();
  tip("All segments recomputed", true, "success", SUCCESS_TIP_MS);
}

function createEmptySegment(journey: Journey): Segment {
  const nextId = journey.segments.length ? Math.max(...journey.segments.map(s => s.id)) + 1 : 0;
  const defaultTransport = pack.transportTypes[0];
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

function pickJourneyStart(): void {
  const journey = getJourney();
  if (!journey) return;
  if (!journey.segments.length) {
    createEmptySegment(journey);
    refresh();
  }
  const firstSeg = journey.segments[0];
  tip("Click on the map to set the journey's start cell.", true);
  beginCellPick(firstSeg.id, "from");
}

function pickJourneyEnd(): void {
  const journey = getJourney();
  if (!journey) return;
  if (!journey.segments.length) {
    createEmptySegment(journey);
    refresh();
  }
  const lastSeg = journey.segments[journey.segments.length - 1];
  tip("Click on the map to set the journey's end cell.", true);
  beginCellPick(lastSeg.id, "to");
}

function downloadSegments(): void {
  const journey = getJourney();
  if (!journey) return;
  const unit = distanceUnitInput.value;
  let data = `Idx,Name,TransportType,Speed(${unit}/h),EffectiveSpeed(${unit}/h),DistancePx,Distance(${unit}),TimeHours,From,To,AvoidRoads,Visible,Color,Note\n`;
  journey.segments.forEach((s, i) => {
    const km = segmentLengthKm(s);
    const hours = segmentTimeHours(s);
    const note = (s.note ?? "").replace(/"/g, '""');
    data += `${i + 1},"${s.name}","${s.transportType}",${s.speed},${rn(effectiveSpeed(s), 2)},${rn(s.distance, 2)},${rn(km, 2)},${rn(hours, 2)},${s.from ?? ""},${s.to ?? ""},${s.avoidRoads ? "yes" : "no"},${s.visible ? "yes" : "no"},${s.color ?? ""},"${note}"\n`;
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
  applyDefaultViewboxEvents();
  document.removeEventListener(TRANSPORT_TYPES_CHANGED, onTransportTypesChanged);
  editingJourneyId = null;
  destroyDialogIfExists("journeyEditor");
}

export const JourneyEditor = { open };
