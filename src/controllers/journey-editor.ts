import { alertDialog, closeDialogs, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import { TRANSPORT_TYPES_CHANGED } from "@/controllers/transport-types-editor";
import {
  effectiveSpeed,
  formatTravelTime,
  isStaySegment,
  journeyTotals,
  OFF_ROAD_SPEED_FACTOR,
  segmentLengthKm,
  segmentTimeHours
} from "@/generators/journeys-generator";
import { drawJourneys, getJourneyColor, setJourneyColorMode } from "@/renderers/draw-journeys";
import type { Journey, Segment } from "@/types/Journey";
import { destroyDialogIfExists, downloadFile, ensureEl, getFileName, getHoursPerDay, rn } from "@/utils";
import { cellEndpointLabel, cellEndpointTooltip } from "@/utils/cell-labels";
import * as PathEditor from "./journey-path-editor";

const SUCCESS_TIP_MS = 2500;
const ERROR_TIP_MS = 9000;

let editingJourneyId: number | null = null;

function open(journeyId: number): void {
  if (customization) return;
  closeDialogs("#journeyEditor, .stable");
  if (!layerIsOn("toggleJourneys")) toggleJourneys();

  Journeys.sync();
  editingJourneyId = journeyId;
  const journey = getJourney();
  if (!journey) {
    tip("Journey not found", true, "error", ERROR_TIP_MS);
    return;
  }

  PathEditor.attach({ getJourney, getSegment, refresh });
  setJourneyColorMode("segment"); // reveal per-segment overrides while editing this journey
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

function getJourney(): Journey | undefined {
  if (editingJourneyId === null) return undefined;
  return pack.journeys.find(j => j.i === editingJourneyId);
}

function getSegment(id: number): Segment | undefined {
  return getJourney()?.segments.find(s => s.id === id);
}

function getRowSegId(el: HTMLElement): number {
  const row = el.closest<HTMLElement>("[data-seg-id]");
  return +(row?.dataset.segId ?? "-1");
}

function renderDialog(journey: Journey): void {
  destroyDialogIfExists("journeyEditor");

  const html = /* html */ `<div id="journeyEditor" class="dialog stable">
    <div id="journeyHeader">
      <div class="label">Name:</div>
      <input id="journeyName" value="${journey.name}" />
      <input id="journeyColor" type="color" value="${getJourneyColor(journey)}" class="${journey.color ? "" : "inherited"}"
        data-tip="${journey.color ? "Journey color — click ✕ to follow the layer style" : "Derived from the Journeys layer style — pick a color to override"}" />
      <span id="journeyColorReset" data-tip="Reset to follow the layer style" class="pointer" style="${journey.color ? "" : "visibility: hidden"}">✕</span>
      <span id="journeyEditStyle" data-tip="Edit style for the Journeys layer" class="icon-brush pointer"></span>
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

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("journeyName").on("input", onNameInput);
  ensureEl("journeyColor").on("input", onColorInput);
  ensureEl("journeyColorReset").on("click", onColorReset);
  ensureEl("journeyEditStyle").on("click", () => editStyle("journeys"));
  ensureEl("journeyVisible").on("click", onToggleVisible);
  ensureEl("journeyLock").on("click", onToggleLock);
  ensureEl("journeyAddSegment").on("click", addSegment);
  ensureEl("journeyRecompute").on("click", recomputeAll);
  ensureEl("journeyExport").on("click", downloadSegments);
  ensureEl("journeyEditTransport").on("click", () => void Controllers.TransportTypesEditor.open());
  ensureEl("journeyRemove").on("click", removeJourney);
}

function segmentRow(journey: Journey, seg: Segment, index: number): string {
  const unit = distanceUnitInput.value;
  const domain = Journeys.getDomain(seg.transportType);
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

  const isEditingPoints = PathEditor.getPointEditSegId() === seg.id;
  const isDrawing = PathEditor.getCustomPathSegId() === seg.id;
  const hasPath = seg.points.length >= 2;

  const distanceCell = isStay ? "—" : `${rn(segmentLengthKm(seg))} ${unit}`;
  const timeCell = isStay
    ? `<input class="segDuration" type="number" min="0" step="0.5" value="${seg.duration ?? 0}" data-tip="Stay duration in hours" /> h`
    : formatTravelTime(segmentTimeHours(seg), getHoursPerDay());

  const speedCell = isStay
    ? `<input class="segSpeed" type="number" value="0" disabled />`
    : `<input class="segSpeed" type="number" step="0.5" min="0" value="${seg.speed}" title="${seg.avoidRoads ? `Effective: ${rn(effectiveSpeed(seg), 1)} ${unit}/h` : ""}" />`;

  // Both states keep the same wrapper so the grid track never reflows.
  const swatchColor = seg.color || getJourneyColor(journey);
  const colorCell = /* html */ `<span class="segColorCell">
    <input class="segColor ${seg.color ? "" : "inherited"}" type="color" value="${swatchColor}"
      data-tip="${seg.color ? "Segment color — click ✕ to reset" : "Uses the journey color — pick a color to override"}" />
    <span class="segColorReset pointer" data-tip="Reset to the journey color"
      style="${seg.color ? "" : "visibility: hidden"}">✕</span>
  </span>`;

  const transportOptions = pack.transportTypes
    .map(t => `<option value="${t.name}" ${t.name === seg.transportType ? "selected" : ""}>${t.name}</option>`)
    .join("");

  return /* html */ `<div class="editorLine" data-seg-id="${seg.id}">
    <div>${index + 1}</div>
    <input class="segName" value="${seg.name}" />
    <select class="segTransport">${transportOptions}</select>
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
    <span class="segDelete pointer icon-trash-empty" data-tip="Delete segment"></span>
  </div>`;
}

function refresh(): void {
  const journey = getJourney();
  if (!journey) return;

  const body = ensureEl("segmentsBody");
  body.innerHTML = journey.segments.map((seg, index) => segmentRow(journey, seg, index)).join("");

  const on = (selector: string, event: string, handler: EventListener) => {
    body.querySelectorAll<HTMLElement>(selector).forEach(el => void el.on(event, handler));
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

  updateTotals(journey);
  drawJourneys();
  PathEditor.drawOverlays();
}

function updateTotals(journey: Journey): void {
  const unit = distanceUnitInput.value;
  const hoursPerDay = getHoursPerDay();
  const totals = journeyTotals(journey);

  ensureEl("jTotalDistance").innerHTML = `${rn(totals.totalKm)} ${unit}`;
  ensureEl("jAvgSpeed").innerHTML = totals.avgSpeed ? `${rn(totals.avgSpeed, 1)} ${unit}/h` : "-";
  ensureEl("jTravelTime").innerHTML = formatTravelTime(totals.totalHours, hoursPerDay);
  ensureEl("jHoursPerDay").innerHTML = String(hoursPerDay);
}

function onTransportTypesChanged(): void {
  if (getJourney()) refresh();
}

// ---- journey-level handlers --------------------------------------------

function onNameInput(this: HTMLInputElement): void {
  const journey = getJourney();
  if (journey) journey.name = this.value;
}

function onColorInput(this: HTMLInputElement): void {
  const journey = getJourney();
  if (!journey) return;
  journey.color = this.value;
  reopenHeader(journey);
  refresh();
}

/** Drop the journey override so it follows the Journeys layer style again. */
function onColorReset(): void {
  const journey = getJourney();
  if (!journey?.color) return;
  journey.color = undefined;
  reopenHeader(journey);
  refresh();
}

// The colour controls change appearance with the override state, and they live
// outside #segmentsBody, so refresh() alone would leave them stale.
function reopenHeader(journey: Journey): void {
  const swatch = ensureEl<HTMLInputElement>("journeyColor");
  swatch.value = getJourneyColor(journey);
  swatch.classList.toggle("inherited", !journey.color);
  ensureEl("journeyColorReset").style.visibility = journey.color ? "" : "hidden";
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

// ---- segment handlers ---------------------------------------------------

function onSegNameInput(this: HTMLInputElement): void {
  const seg = getSegment(getRowSegId(this));
  if (seg) seg.name = this.value;
}

function onSegTransportChange(this: HTMLSelectElement): void {
  const seg = getSegment(getRowSegId(this));
  if (!seg) return;
  const previousType = seg.transportType;
  const newTypeName = this.value;
  const newType = Journeys.getTransportType(newTypeName);
  if (!newType) return;

  const newDomain = newType.domain;

  // Stay-domain switch: clear pathfinding-derived state, keep endpoints as anchors.
  if (newDomain === "stay") {
    seg.transportType = newTypeName;
    seg.speed = 0;
    seg.duration = seg.duration ?? 1;
    seg.avoidRoads = false;
    seg.custom = false;
    if (seg.from !== undefined && seg.to !== undefined) PathEditor.recomputeSegment(seg);
    refresh();
    return;
  }

  if (seg.from !== undefined && seg.to !== undefined) {
    const message = PathEditor.domainMismatchMessage({ ...seg, transportType: newTypeName }, newDomain);
    if (message) {
      this.value = previousType;
      alertDialog({
        title: `Can't switch to ${newTypeName}`,
        message: `${message}<br/><br/>Pick different endpoints first, then change the transport type — or use an <b>air</b> transport type which accepts any endpoints.`
      });
      return;
    }
  }

  seg.transportType = newTypeName;
  seg.speed = newType.speed;
  if (previousType && Journeys.getDomain(previousType) === "stay") seg.duration = undefined;
  PathEditor.recomputeSegment(seg);
  refresh();
}

function onSegSpeedInput(this: HTMLInputElement): void {
  const seg = getSegment(getRowSegId(this));
  if (!seg) return;
  seg.speed = +this.value || 0;
  refresh();
}

function onSegDurationInput(this: HTMLInputElement): void {
  const seg = getSegment(getRowSegId(this));
  const journey = getJourney();
  if (!seg || !journey) return;
  seg.duration = Math.max(0, +this.value || 0);
  updateTotals(journey);
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
  if (!seg?.color) return;
  seg.color = undefined;
  refresh();
}

function onToggleSegVisible(this: HTMLElement): void {
  const seg = getSegment(getRowSegId(this));
  if (!seg) return;
  seg.visible = !seg.visible;
  if (!seg.visible) {
    if (PathEditor.getPointEditSegId() === seg.id) PathEditor.stopPointEdit();
    if (PathEditor.getCustomPathSegId() === seg.id) PathEditor.cancelCustomPath();
  }
  refresh();
}

function onToggleAvoidRoads(this: HTMLElement): void {
  const seg = getSegment(getRowSegId(this));
  if (!seg) return;
  seg.avoidRoads = !seg.avoidRoads;
  PathEditor.recomputeSegment(seg);
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

function onPickFrom(this: HTMLElement): void {
  PathEditor.startCellPick(getRowSegId(this), "from");
}

function onPickTo(this: HTMLElement): void {
  PathEditor.startCellPick(getRowSegId(this), "to");
}

function onToggleEditPoints(this: HTMLElement): void {
  PathEditor.togglePointEdit(getRowSegId(this));
}

function onToggleCustomPath(this: HTMLElement): void {
  PathEditor.toggleCustomPath(getRowSegId(this));
}

function onSegRecompute(this: HTMLElement): void {
  const seg = getSegment(getRowSegId(this));
  if (!seg) return;

  const recompute = () => {
    seg.custom = false;
    PathEditor.recomputeSegment(seg);
    refresh();
  };

  if (!seg.custom) {
    recompute();
    return;
  }

  confirmationDialog({
    title: "Overwrite custom path?",
    message: `Segment "<b>${seg.name}</b>" has a custom-drawn path. Recomputing will replace it with the pathfinder's route. Continue?`,
    confirm: "Overwrite",
    onConfirm: recompute
  });
}

function onSegMoveUp(this: HTMLElement): void {
  const journey = getJourney();
  if (!journey) return;
  const index = journey.segments.findIndex(s => s.id === getRowSegId(this));
  if (index <= 0) return;
  const [seg] = journey.segments.splice(index, 1);
  journey.segments.splice(index - 1, 0, seg);
  refresh();
}

function onSegDelete(this: HTMLElement): void {
  const journey = getJourney();
  if (!journey) return;
  const id = getRowSegId(this);
  if (PathEditor.getPointEditSegId() === id) PathEditor.stopPointEdit();
  if (PathEditor.getCustomPathSegId() === id) PathEditor.cancelCustomPath();
  journey.segments = journey.segments.filter(s => s.id !== id);
  refresh();
}

// ---- journey actions ----------------------------------------------------

function addSegment(): void {
  const journey = getJourney();
  if (!journey) return;

  const isFirst = !journey.segments.length;
  const id = journey.segments.length ? Math.max(...journey.segments.map(s => s.id)) + 1 : 0;
  const transport = pack.transportTypes.find(t => t.domain !== "stay") ?? pack.transportTypes[0];
  const seg: Segment = {
    id,
    name: `Segment ${id + 1}`,
    visible: true,
    from: journey.segments[journey.segments.length - 1]?.to,
    to: undefined,
    transportType: transport?.name ?? "Direct",
    speed: transport?.speed ?? 5,
    distance: 0,
    points: []
  };
  journey.segments.push(seg);
  refresh();

  if (isFirst) {
    tip("First click the start cell on the map, then the destination.", true);
    PathEditor.startCellPick(seg.id, "from", true);
  } else {
    tip("Click the destination cell on the map.", true);
    PathEditor.startCellPick(seg.id, "to");
  }
}

function recomputeAll(): void {
  const journey = getJourney();
  if (!journey) return;

  const customCount = journey.segments.filter(s => s.custom).length;
  const recompute = () => {
    for (const seg of journey.segments) {
      seg.custom = false;
      PathEditor.recomputeSegment(seg);
    }
    refresh();
    tip("All segments recomputed", true, "success", SUCCESS_TIP_MS);
  };

  if (!customCount) {
    recompute();
    return;
  }

  confirmationDialog({
    title: "Overwrite custom paths?",
    message: `${customCount} segment${customCount > 1 ? "s have" : " has"} a custom-drawn path. Recomputing will replace them. Continue?`,
    confirm: "Overwrite",
    onConfirm: recompute
  });
}

function downloadSegments(): void {
  const journey = getJourney();
  if (!journey) return;

  const unit = distanceUnitInput.value;
  const headers = `Idx,Name,TransportType,Speed(${unit}/h),EffectiveSpeed(${unit}/h),DistancePx,Distance(${unit}),TimeHours,From,To,AvoidRoads,Custom,Visible,Color,Note`;
  const lines = journey.segments.map((s, i) => {
    const note = (s.note ?? "").replace(/"/g, '""');
    return `${i + 1},"${s.name}","${s.transportType}",${s.speed},${rn(effectiveSpeed(s), 2)},${rn(s.distance, 2)},${rn(segmentLengthKm(s), 2)},${rn(segmentTimeHours(s), 2)},${s.from ?? ""},${s.to ?? ""},${s.avoidRoads ? "yes" : "no"},${s.custom ? "yes" : "no"},${s.visible ? "yes" : "no"},${s.color ?? ""},"${note}"`;
  });

  downloadFile([headers, ...lines].join("\n"), `${getFileName(journey.name || "Journey")}.csv`);
}

function removeJourney(): void {
  const journey = getJourney();
  if (!journey) return;
  confirmationDialog({
    title: "Remove journey",
    message: `Remove journey <b>${journey.name}</b>? This action cannot be reverted.`,
    confirm: "Remove",
    onConfirm: () => {
      Journeys.remove(journey.i);
      drawJourneys();
      $("#journeyEditor").dialog("close");
    }
  });
}

function onClose(): void {
  PathEditor.detach();
  setJourneyColorMode("journey"); // back to one colour per journey on the map
  applyDefaultViewboxEvents();
  document.removeEventListener(TRANSPORT_TYPES_CHANGED, onTransportTypesChanged);
  editingJourneyId = null;
  destroyDialogIfExists("journeyEditor");
}

export const JourneyEditor = { open };
