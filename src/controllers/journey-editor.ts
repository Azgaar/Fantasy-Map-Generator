import { select } from "d3";
import { closeDialogs, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import { TRANSPORT_TYPES_CHANGED } from "@/controllers/transport-types-editor";
import { getDefaultTransportTypes } from "@/data/transport-types";
import { drawJourneys } from "@/renderers/draw-journeys";
import type { Journey, Segment, TransportDomain, TransportType } from "@/types/Journey";
import { downloadFile, getFileName, getPointer, rn } from "@/utils";
import {
  effectiveSpeed,
  formatTravelTime,
  journeyTotals,
  OFF_ROAD_SPEED_FACTOR,
  segmentLengthKm,
  segmentTimeHours
} from "@/utils/journey-metrics";
import { describeCell, findJourneyPath, isValidEndpointForDomain } from "@/utils/journey-pathfinding";
import { destroyDialogIfExists, ensureEl } from "../utils";

let editingJourneyId: number | null = null;
let pickState: {
  segmentId: number;
  endpoint: "from" | "to";
  chainNextTo?: boolean;
} | null = null;

function open(journeyId: number): void {
  if (customization) return;
  closeDialogs("#journeyEditor, .stable");
  if (!layerIsOn("toggleJourneys")) toggleJourneys();

  ensureTransportTypes();
  editingJourneyId = journeyId;
  const journey = getJourney();
  if (!journey) {
    tip("Journey not found", false, "error");
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

    <div id="segmentsTable" class="table" style="min-width: 56em; margin-bottom: 0.5em;">
      <div class="header" style="display: grid; grid-template-columns: 2em 8em 10em 5em 5em 5em 5em 3em 4em 2em 2em 2em; gap: 0.3em; padding: 0.2em; font-weight: bold;">
        <div>#</div><div>Name</div><div>Transport</div><div>Speed</div><div>From</div><div>To</div><div>Dist</div><div>Time</div><div title="Roads / Off-road (land only)">Roads</div><div></div><div></div><div></div>
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
    row.style.cssText =
      "display: grid; grid-template-columns: 2em 8em 10em 5em 5em 5em 5em 3em 4em 2em 2em 2em; gap: 0.3em; padding: 0.2em; align-items: center;";
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
    row.innerHTML = /* html */ `
      <div>${index + 1}</div>
      <input class="segName" value="${seg.name}" />
      <select class="segTransport">${transportOptions.replace(`value="${seg.transportType}"`, `value="${seg.transportType}" selected`)}</select>
      <input class="segSpeed" type="number" step="0.5" min="0" value="${seg.speed}" style="width: 4.5em;" title="${seg.avoidRoads ? `Effective: ${rn(effectiveSpeed(seg), 1)} ${distanceUnitInput.value}/h (off-road penalty)` : ""}" />
      <span class="segFrom pointer" data-tip="Click, then click a cell on the map to set 'from'">${seg.from !== undefined ? seg.from : "— pick"}</span>
      <span class="segTo pointer" data-tip="Click, then click a cell on the map to set 'to'">${seg.to !== undefined ? seg.to : "— pick"}</span>
      <div>${rn(segmentLengthKm(seg))} ${distanceUnitInput.value}</div>
      <div>${formatTravelTime(segmentTimeHours(seg))}</div>
      ${roadsCell}
      <span class="segRecompute pointer icon-cw" data-tip="Recompute this segment's path"></span>
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
    false,
    "success",
    2500
  );
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
    tip(result.warning, false, "warn", 4000);
  }
}

function recomputeAll(): void {
  const journey = getJourney();
  if (!journey) return;
  for (const seg of journey.segments) recomputeSegment(seg);
  refresh();
  tip("All segments recomputed", false, "success", 2000);
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
  let data = `Idx,Name,TransportType,Speed(${unit}/h),DistancePx,Distance(${unit}),TimeHours,From,To,AvoidRoads,Note\n`;
  journey.segments.forEach((s, i) => {
    const km = segmentLengthKm(s);
    const hours = segmentTimeHours(s);
    data += `${i + 1},"${s.name}","${s.transportType}",${s.speed},${rn(s.distance, 2)},${rn(km, 2)},${rn(hours, 2)},${s.from ?? ""},${s.to ?? ""},${s.avoidRoads ? "yes" : "no"},"${s.note ?? ""}"\n`;
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
  applyDefaultViewboxEvents();
  document.removeEventListener(TRANSPORT_TYPES_CHANGED, onTransportTypesChanged);
  editingJourneyId = null;
  destroyDialogIfExists("journeyEditor");
}

export const JourneyEditor = { open };
