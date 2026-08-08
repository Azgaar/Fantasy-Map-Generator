// On-map interaction modes for journey segments: picking endpoint cells,
// dragging path control points, and drawing a custom path cell by cell.
// The dialog itself lives in journey-editor, which attaches this module while open.
import { drag, select } from "d3";
import { alertDialog } from "@/components/dialog/dialog-helpers";
import { clearMainTip, tip } from "@/components/tooltips";
import { pathLength } from "@/generators/journeys-generator";
import { drawJourneys, getJourneyColor } from "@/renderers/draw-journeys";
import type { Journey, JourneyPoint, Segment, TransportDomain } from "@/types/Journey";
import { ensureEl, getPointer, rn } from "@/utils";

const ERROR_TIP_MS = 9000;
const WARN_TIP_MS = 7000;
const SUCCESS_TIP_MS = 2500;
const POINT_EDIT_HINT = "Drag points to move, click the path to add, right-click a point to remove.";
const CUSTOM_PATH_HINT =
  "Click cells to add points. Click the brush icon (or press Enter) to finish, Esc to cancel, right-click to undo.";

/** An edge stretched beyond this multiple of the reference spacing gets subdivided. */
export const RESAMPLE_THRESHOLD = 1.75;

/** Hard cap so repeated edits can never grow a path without bound. */
export const MAX_PATH_POINTS = 500;

interface PathEditorHost {
  getJourney: () => Journey | undefined;
  getSegment: (id: number) => Segment | undefined;
  refresh: () => void;
}

let host: PathEditorHost | null = null;
let pickState: { segmentId: number; endpoint: "from" | "to"; chainNextTo?: boolean } | null = null;
let pointEditSegId: number | null = null;
let pointEditSpacing = 0;
let customPathSegId: number | null = null;
let customPathPoints: JourneyPoint[] = [];

/** Bind the module to an open journey editor. Call `detach` when that dialog closes. */
export function attach(newHost: PathEditorHost): void {
  host = newHost;
}

export function detach(): void {
  stopCellPick();
  stopPointEdit();
  cancelCustomPath();
  host = null;
}

export const getPointEditSegId = (): number | null => pointEditSegId;
export const getCustomPathSegId = (): number | null => customPathSegId;

// ---- shared geometry ---------------------------------------------------

const distance = (a: JourneyPoint, b: JourneyPoint): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

/**
 * Median gap between consecutive points — the spacing a path is expected to keep.
 *
 * Median rather than mean because a couple of edges stretched by dragging would
 * inflate a mean enough to suppress the very resampling they should trigger.
 */
export const medianSpacing = (points: JourneyPoint[]): number => {
  if (points.length < 2) return 0;

  const lengths: number[] = [];
  for (let i = 1; i < points.length; i++) lengths.push(distance(points[i - 1], points[i]));
  lengths.sort((a, b) => a - b);

  const mid = Math.floor(lengths.length / 2);
  return lengths.length % 2 ? lengths[mid] : (lengths[mid - 1] + lengths[mid]) / 2;
};

/**
 * Refill the edges touching `index` with evenly spaced points when dragging has
 * stretched them well past `spacing`, so a lengthened path keeps enough handles
 * to stay editable.
 *
 * Inserted points lie on the straight line they subdivide, so the route's shape
 * and length are unchanged — this only adds grab handles.
 */
export const resampleAround = (
  points: JourneyPoint[],
  index: number,
  spacing: number,
  cellAt: (x: number, y: number) => number | undefined
): JourneyPoint[] => {
  if (spacing <= 0 || points.length < 2) return points;

  const result = points.slice();

  // Edge e joins points[e] and points[e+1], so the dragged point touches edges
  // index-1 and index. Walk them right-to-left so an insertion never shifts an
  // edge index still to be processed.
  const edges = [index, index - 1].filter(e => e >= 0 && e + 1 < result.length);

  for (const edge of edges) {
    const a = result[edge];
    const b = result[edge + 1];
    const length = distance(a, b);
    if (length <= spacing * RESAMPLE_THRESHOLD) continue;

    const room = MAX_PATH_POINTS - result.length;
    const parts = Math.min(Math.round(length / spacing), room + 1);
    if (parts < 2) continue;

    const inserted: JourneyPoint[] = [];
    for (let k = 1; k < parts; k++) {
      const t = k / parts;
      const x = rn(a[0] + (b[0] - a[0]) * t, 2);
      const y = rn(a[1] + (b[1] - a[1]) * t, 2);
      inserted.push([x, y, cellAt(x, y) ?? a[2]]);
    }
    result.splice(edge + 1, 0, ...inserted);
  }

  return result;
};

/** Index of the edge whose midline runs closest to (x, y) — where a new point is inserted. */
export const closestSegmentIndex = (points: JourneyPoint[], x: number, y: number): number => {
  let bestIndex = 1;
  let bestDistance = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared));
    const distanceToEdge = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    if (distanceToEdge < bestDistance) {
      bestDistance = distanceToEdge;
      bestIndex = i;
    }
  }
  return bestIndex;
};

// ---- shared messaging --------------------------------------------------

const segmentColor = (seg: Segment): string => {
  const journey = host?.getJourney();
  return seg.color || (journey ? getJourneyColor(journey) : "");
};

function isPointAllowed(cellId: number, domain: TransportDomain, isEndpoint: boolean): boolean {
  return isEndpoint ? Journeys.isValidEndpoint(cellId, domain) : Journeys.isValidPathPoint(cellId, domain);
}

function terrainRejectionMessage(cellId: number, domain: TransportDomain, transportType: string): string {
  const rule =
    domain === "land"
      ? "its path has to stay on land"
      : "its path has to stay on water (only the start and end may sit on a coast)";
  return `${transportType} is a ${domain} transport — ${rule}. That spot is a ${Journeys.describeCell(cellId)}.`;
}

/** Explain which endpoints clash with the segment's domain, or null when both fit. */
export function domainMismatchMessage(seg: Segment, domain: TransportDomain): string | null {
  if (domain === "air" || domain === "stay") return null;
  const badFrom = seg.from !== undefined && !Journeys.isValidEndpoint(seg.from, domain);
  const badTo = seg.to !== undefined && !Journeys.isValidEndpoint(seg.to, domain);
  if (!badFrom && !badTo) return null;
  const parts: string[] = [];
  if (badFrom) parts.push(`<b>From</b> is a ${Journeys.describeCell(seg.from!)}`);
  if (badTo) parts.push(`<b>To</b> is a ${Journeys.describeCell(seg.to!)}`);
  const need =
    domain === "land"
      ? "This transport type is <b>land</b> — endpoints must be on land (coastal is fine)."
      : "This transport type is <b>water</b> — endpoints must be in water, or on a coast touching water.";
  return `${parts.join(" and ")}.<br/><br/>${need}`;
}

// ---- endpoint picking --------------------------------------------------

export function startCellPick(segmentId: number, endpoint: "from" | "to", chainNextTo = false): void {
  if (customPathSegId !== null) cancelCustomPath();
  pickState = { segmentId, endpoint, chainNextTo };
  tip(`Click on the map to pick the '${endpoint}' cell. Press Esc to cancel.`, true);
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click.journeyPick", onPickClick);
  document.addEventListener("keydown", onPickEscape);
}

export function stopCellPick(): void {
  pickState = null;
  select<SVGElement, unknown>("#viewbox").style("cursor", null).on("click.journeyPick", null);
  document.removeEventListener("keydown", onPickEscape);
  clearMainTip();
}

function onPickEscape(event: KeyboardEvent): void {
  if (event.key === "Escape") stopCellPick();
}

function onPickClick(this: SVGElement, event: MouseEvent): void {
  if (!pickState || !host) {
    stopCellPick();
    return;
  }

  const [x, y] = getPointer(event, this);
  const cellId = findCell(x, y);
  if (cellId === undefined) return;

  const seg = host.getSegment(pickState.segmentId);
  if (!seg) {
    stopCellPick();
    return;
  }

  const domain = Journeys.getDomain(seg.transportType);
  if (!Journeys.isValidEndpoint(cellId, domain)) {
    alertDialog({
      title: `Invalid cell for ${seg.transportType}`,
      message:
        `You clicked a ${Journeys.describeCell(cellId)}, but <b>${seg.transportType}</b> is a <b>${domain}</b> transport type.<br/><br/>` +
        (domain === "land"
          ? "Pick a land cell (coastal is fine)."
          : domain === "water"
            ? "Pick a water cell or a coastal cell touching water."
            : "Any cell should work — this shouldn't happen.")
    });
    return;
  }

  if (pickState.endpoint === "from") seg.from = cellId;
  else seg.to = cellId;

  const chainNext = pickState.chainNextTo;
  stopCellPick();

  if (seg.from !== undefined && seg.to !== undefined) recomputeSegment(seg);
  host.refresh();

  if (chainNext) {
    tip("Now click the destination cell.", true);
    startCellPick(seg.id, "to");
  }
}

// ---- path recomputation ------------------------------------------------

/** Re-run the pathfinder for a segment, reporting any domain problem to the user. */
export function recomputeSegment(seg: Segment): void {
  if (seg.custom) return; // Never overwrite a custom-drawn path silently.
  if (seg.from === undefined || seg.to === undefined) return;
  const domain = Journeys.getDomain(seg.transportType);

  if (domain === "stay") {
    // Stay: draw a direct line so it renders as an anchored dot/short segment.
    const result = Journeys.findPath(seg.from, seg.to, "air");
    seg.points = result.points;
    seg.distance = result.distance;
    return;
  }

  const result = Journeys.findPath(seg.from, seg.to, domain, {
    avoidRoads: domain === "land" && !!seg.avoidRoads
  });
  seg.points = result.points;
  seg.distance = result.distance;

  if (result.errorCode === "no-land" || result.errorCode === "no-water") {
    alertDialog({
      title: `Can't use ${seg.transportType} here`,
      message: domainMismatchMessage(seg, domain) ?? result.warning ?? "Invalid segment."
    });
  } else if (result.errorCode === "no-land-path") {
    alertDialog({
      title: `No land route for ${seg.transportType}`,
      message: `Segment "<b>${seg.name}</b>" has no land connection between its endpoints. They may be on different landmasses — consider a water or air transport type instead.`
    });
  } else if (result.errorCode === "no-water-path") {
    alertDialog({
      title: `No sea route for ${seg.transportType}`,
      message: `Segment "<b>${seg.name}</b>" has no water connection between its endpoints. They may be in different bodies of water — consider a land or air transport type instead.`
    });
  } else if (result.warning) {
    tip(result.warning, true, "warn", WARN_TIP_MS);
  }
}

// ---- control point editing ---------------------------------------------

export function togglePointEdit(segmentId: number): void {
  if (!host) return;
  if (pointEditSegId === segmentId) {
    stopPointEdit();
    host.refresh();
    tip("Finished editing path points.", true, "success", SUCCESS_TIP_MS);
    return;
  }

  const seg = host.getSegment(segmentId);
  if (!seg || seg.points.length < 2) {
    tip("This segment has no path yet — set both endpoints first.", true, "error", ERROR_TIP_MS);
    return;
  }

  if (customPathSegId !== null) cancelCustomPath();
  pointEditSegId = segmentId;
  pointEditSpacing = medianSpacing(seg.points);
  host.refresh();
  tip(POINT_EDIT_HINT, true);
}

export function stopPointEdit(): void {
  pointEditSegId = null;
  pointEditSpacing = 0;
  select("#journeyControlPoints").remove();
  clearMainTip();
}

function tipPointError(message: string): void {
  tip(message, true, "error", ERROR_TIP_MS);
  const segId = pointEditSegId;
  if (segId === null) return;
  window.setTimeout(() => {
    if (pointEditSegId === segId) tip(POINT_EDIT_HINT, true);
  }, ERROR_TIP_MS + 100);
}

function controlPointsGroup() {
  const existing = select<SVGGElement, unknown>("#journeyControlPoints");
  if (!existing.empty()) return existing;
  return select("#viewbox").append("g").attr("id", "journeyControlPoints");
}

function drawControlPoints(): void {
  const journey = host?.getJourney();
  const seg = pointEditSegId === null ? undefined : host?.getSegment(pointEditSegId);
  if (!journey || !seg || seg.points.length < 2) {
    select("#journeyControlPoints").remove();
    return;
  }

  const color = segmentColor(seg);
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

function onDragControlPoint(event: any): void {
  const seg = pointEditSegId === null ? undefined : host?.getSegment(pointEditSegId);
  if (!seg || !host) return;
  const pointIndex = seg.points.indexOf(event.subject);
  if (pointIndex === -1) return;

  const domain = Journeys.getDomain(seg.transportType);
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
    this.setAttribute("stroke", allowed ? segmentColor(seg) : "#8b1a1a");

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
    host?.refresh();
  });
}

function onAddControlPoint(this: SVGPathElement, event: MouseEvent): void {
  const seg = pointEditSegId === null ? undefined : host?.getSegment(pointEditSegId);
  if (!seg || !host) return;
  event.stopPropagation();

  const [x, y] = getPointer(event, this);
  const px = rn(x, 2);
  const py = rn(y, 2);
  const cellId = findCell(px, py);
  if (cellId === undefined) return;

  const domain = Journeys.getDomain(seg.transportType);
  if (!Journeys.isValidPathPoint(cellId, domain)) {
    tipPointError(`Can't add a point there — ${terrainRejectionMessage(cellId, domain, seg.transportType)}`);
    return;
  }

  seg.points.splice(closestSegmentIndex(seg.points, px, py), 0, [px, py, cellId]);
  seg.distance = pathLength(seg.points);
  host.refresh();
}

function onRemoveControlPoint(event: MouseEvent, point: JourneyPoint): void {
  event.preventDefault();
  const seg = pointEditSegId === null ? undefined : host?.getSegment(pointEditSegId);
  if (!seg || !host) return;

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
  host.refresh();
}

// ---- custom path drawing (click-to-build) ------------------------------

export function toggleCustomPath(segmentId: number): void {
  if (!host) return;
  // Clicking the same brush button again ends drawing — finish if the path is
  // usable (≥2 points), otherwise cancel. Esc is always a hard cancel.
  if (customPathSegId === segmentId) {
    if (customPathPoints.length >= 2) finishCustomPath();
    else {
      cancelCustomPath();
      host.refresh();
      tip("Custom path cancelled — you need at least two points.", true, "warn", WARN_TIP_MS);
    }
    return;
  }
  if (!host.getSegment(segmentId)) return;

  if (pointEditSegId !== null) stopPointEdit();
  stopCellPick();

  customPathSegId = segmentId;
  customPathPoints = [];
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click.journeyDraw", onCustomPathClick);
  document.addEventListener("contextmenu", onCustomPathRightClick);
  document.addEventListener("keydown", onCustomPathKey, true);
  showDrawToolbar();
  host.refresh();
  tip(CUSTOM_PATH_HINT, true);
}

export function cancelCustomPath(): void {
  customPathSegId = null;
  customPathPoints = [];
  select<SVGElement, unknown>("#viewbox").style("cursor", null).on("click.journeyDraw", null);
  document.removeEventListener("contextmenu", onCustomPathRightClick);
  document.removeEventListener("keydown", onCustomPathKey, true);
  select("#journeyCustomPreview").remove();
  destroyDrawToolbar();
  clearMainTip();
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

  // add listeners — dropped together with the toolbar HTML on cancel
  ensureEl("journeyDrawFinish").on("click", finishCustomPath);
  ensureEl("journeyDrawUndo").on("click", undoLastCustomPoint);
  ensureEl("journeyDrawCancel").on("click", () => {
    cancelCustomPath();
    host?.refresh();
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
  updateDrawToolbar();
}

function onCustomPathClick(this: SVGElement, event: MouseEvent): void {
  const seg = customPathSegId === null ? undefined : host?.getSegment(customPathSegId);
  if (!seg) return;

  const [x, y] = getPointer(event, this);
  const px = rn(x, 2);
  const py = rn(y, 2);
  const cellId = findCell(px, py);
  if (cellId === undefined) return;

  const domain = Journeys.getDomain(seg.transportType);
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
  undoLastCustomPoint();
}

function onCustomPathKey(event: KeyboardEvent): void {
  if (customPathSegId === null) return;
  if (event.key === "Escape") {
    cancelCustomPath();
    host?.refresh();
    return;
  }
  if (event.key === "Enter") finishCustomPath();
}

function finishCustomPath(): void {
  const seg = customPathSegId === null ? undefined : host?.getSegment(customPathSegId);
  if (!seg) {
    cancelCustomPath();
    return;
  }

  if (customPathPoints.length < 2) {
    tip("A custom path needs at least two points.", true, "error", ERROR_TIP_MS);
    return;
  }

  // Points are checked as they are added, but the transport type can be changed
  // mid-draw — so the finished path has to be re-checked as a whole. Drawing stays
  // active on failure so the work can be undone rather than lost.
  const domain = Journeys.getDomain(seg.transportType);
  if (!Journeys.isValidPath(customPathPoints, domain)) {
    alertDialog({
      title: `Path doesn't suit ${seg.transportType}`,
      message:
        `Some points on this path aren't valid for a <b>${domain}</b> transport type — the transport type was probably changed while you were drawing.<br/><br/>` +
        "Right-click to undo those points, or switch to an <b>air</b> transport type, which accepts any path."
    });
    return;
  }

  seg.points = customPathPoints.slice();
  seg.from = seg.points[0][2];
  seg.to = seg.points[seg.points.length - 1][2];
  seg.distance = pathLength(seg.points);
  seg.custom = true;

  const domainMsg = domainMismatchMessage(seg, Journeys.getDomain(seg.transportType));
  if (domainMsg) tip(domainMsg.replace(/<\/?b>/g, ""), true, "warn", WARN_TIP_MS);

  cancelCustomPath();
  host?.refresh();
  tip("Custom path saved.", true, "success", SUCCESS_TIP_MS);
}

function drawCustomPathPreview(): void {
  select("#journeyCustomPreview").remove();
  const seg = customPathSegId === null ? undefined : host?.getSegment(customPathSegId);
  if (!seg) return;

  const color = segmentColor(seg);
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

/** Redraw both on-map overlays; called by the editor after every table refresh. */
export function drawOverlays(): void {
  if (pointEditSegId === null) select("#journeyControlPoints").remove();
  else drawControlPoints();

  if (customPathSegId === null) select("#journeyCustomPreview").remove();
  else drawCustomPathPreview();
}
