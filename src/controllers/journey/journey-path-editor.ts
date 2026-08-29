// On-map interaction modes for journey segments: picking endpoint cells, dragging
// path points, and drawing a custom path cell by cell. Only one mode is active at a
// time. The dialog itself lives in journey-editor, which attaches this module while open.
import { type D3DragEvent, drag, select } from "d3";
import { alertDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { clearMainTip, tip } from "@/components/tooltips";
import type { TransportDomain } from "@/generators/transports-generator";
import type { Journey, JourneyPoint, JourneySegment } from "@/types/Journey";
import { ensureEl, findEl, getPointer, rn } from "@/utils";
import { createEl } from "@/utils/nodeUtils";

const ERROR_TIP_MS = 9000;
const OVERLAY_ID = "journeyOverlay";

const HINTS = {
  pick: "Click a cell on the map to set the endpoint. Esc to cancel.",
  points: "Drag points to move, click the path to add, right-click a point to remove. Esc to finish.",
  draw: "Click cells to add points. Enter to finish, right-click to undo, Esc to cancel."
};

interface PathEditorHost {
  getJourney: () => Journey | undefined;
  getSegment: (id: number) => JourneySegment | undefined;
  refresh: () => void;
}

/** Endpoint picking, control-point editing and freehand drawing are mutually exclusive */
type Mode =
  | { kind: "pick"; segmentId: number; endpoint: "from" | "to"; chainTo?: boolean }
  | { kind: "points"; segmentId: number }
  | { kind: "draw"; segmentId: number; points: JourneyPoint[] };

let host: PathEditorHost | null = null;
let mode: Mode | null = null;

/** Bind the module to an open journey editor. Call `detach` when that dialog closes */
export function attach(newHost: PathEditorHost): void {
  host = newHost;
}

export function detach(): void {
  setMode(null);
  host = null;
}

export const getMode = (): Mode | null => mode;

/** Leave any mode that targets the segment, e.g. before deleting or hiding it */
export function stopEditing(segmentId: number): void {
  if (mode?.segmentId === segmentId) setMode(null);
}

const getSegment = (): JourneySegment | undefined => (mode ? host?.getSegment(mode.segmentId) : undefined);

/**
 * Single entry point for mode changes: tears the previous mode's map bindings down,
 * arms the new one and redraws the overlays. Passing null just leaves the current mode.
 */
function setMode(next: Mode | null): void {
  mode = next;

  const picksCells = next?.kind === "pick" || next?.kind === "draw";
  const viewbox = ensureEl<SVGGElement>("viewbox");
  viewbox.style.cursor = picksCells ? "crosshair" : "";

  viewbox.removeEventListener("click", onViewboxClick);
  document.removeEventListener("keydown", onKeyDown);
  document.removeEventListener("contextmenu", onDrawUndo);
  if (picksCells) viewbox.addEventListener("click", onViewboxClick);
  if (next) document.addEventListener("keydown", onKeyDown);
  if (next?.kind === "draw") document.addEventListener("contextmenu", onDrawUndo);

  if (next) tip(HINTS[next.kind], true);
  else clearMainTip();

  drawOverlays();
}

function onKeyDown(event: KeyboardEvent): void {
  if (!mode) return;
  if (event.key === "Escape") {
    setMode(null);
    host?.refresh();
  } else if (event.key === "Enter" && mode.kind === "draw") finishDrawing();
}

function terrainRejection(cellId: number, domain: TransportDomain, transport: string): string {
  const rule =
    domain === "land" ? "its path has to stay on land" : "its path has to stay on water or a navigable river";
  return `${transport} is a ${domain} transport — ${rule}. That spot is a ${Journeys.describeCell(cellId)}.`;
}

/** Explain which endpoints clash with the segment's domain, or null when both fit */
export function domainMismatchMessage(seg: JourneySegment, domain: TransportDomain): string | null {
  const bad: string[] = [];
  for (const endpoint of ["from", "to"] as const) {
    const cellId = seg[endpoint];
    if (cellId !== undefined && !Journeys.isValidEndpoint(cellId, domain)) {
      bad.push(`<b>${endpoint}</b> is a ${Journeys.describeCell(cellId)}`);
    }
  }
  if (!bad.length) return null;

  const need =
    domain === "land"
      ? "endpoints must be on land (coastal is fine)"
      : "endpoints must be in water, on a coast touching water, or on a navigable river";
  return `${bad.join(" and ")}.<br/><br/>This transport type is <b>${domain}</b> — ${need}.`;
}

type ClickedCell = [x: number, y: number, cellId: number];

/** Cell under the cursor, rounded to the map coordinates the path points store */
function getClickedCell(event: MouseEvent, node: Element): ClickedCell | null {
  const [pointerX, pointerY] = getPointer(event, node);
  const x = rn(pointerX, 2);
  const y = rn(pointerY, 2);
  const cellId = Pack.findCell(x, y);
  return cellId === undefined ? null : [x, y, cellId];
}

// ---- endpoint picking --------------------------------------------------

export function startCellPick(segmentId: number, endpoint: "from" | "to", chainTo = false): void {
  if (host?.getSegment(segmentId)) setMode({ kind: "pick", segmentId, endpoint, chainTo });
}

/** Cell clicks belong to whichever mode is armed for them */
function onViewboxClick(this: SVGGElement, event: MouseEvent): void {
  const clicked = getClickedCell(event, this);
  if (!clicked) return;
  if (mode?.kind === "pick") onPickCell(clicked);
  else if (mode?.kind === "draw") onDrawCell(clicked);
}

function onPickCell(clicked: ClickedCell): void {
  const seg = getSegment();
  if (mode?.kind !== "pick" || !seg) {
    setMode(null);
    return;
  }

  const cellId = clicked[2];

  const domain = Transports.getDomain(seg.transport);
  if (!Journeys.isValidEndpoint(cellId, domain)) {
    tip(
      `Can't put an endpoint there — ${terrainRejection(cellId, domain, seg.transport)}`,
      true,
      "error",
      ERROR_TIP_MS
    );
    return;
  }

  seg[mode.endpoint] = cellId;
  const chainTo = mode.chainTo;
  setMode(null);

  if (seg.from !== undefined && seg.to !== undefined) recomputeSegment(seg);
  host?.refresh();

  if (chainTo) startCellPick(seg.i, "to");
}

// ---- path recomputation ------------------------------------------------

/** Re-run the pathfinder for a segment, reporting any domain problem to the user */
export function recomputeSegment(seg: JourneySegment): void {
  if (seg.custom) return; // never overwrite a custom-drawn path silently
  if (seg.from === undefined || seg.to === undefined) return;

  const domain = Transports.getDomain(seg.transport);
  // a stay has no movement: a direct line anchors it between its endpoints
  const result = Journeys.findPath(seg.from, seg.to, domain === "stay" ? "air" : domain, {
    avoidRoads: domain === "land" && !!seg.avoidRoads
  });
  seg.points = result.points;
  seg.distance = result.distance;

  if (!result.warning) return;
  if (result.errorCode) {
    alertDialog({
      title: `Can't use ${seg.transport} here`,
      message: `Segment "<b>${seg.name}</b>": ${domainMismatchMessage(seg, domain) ?? result.warning}`
    });
  } else tip(result.warning, true, "warn", ERROR_TIP_MS);
}

// ---- control point editing ---------------------------------------------

export function togglePointEdit(segmentId: number): void {
  if (mode?.kind === "points" && mode.segmentId === segmentId) {
    setMode(null);
  } else {
    const seg = host?.getSegment(segmentId);
    if (!seg || seg.points.length < 2) {
      tip("This segment has no path yet — set both endpoints first.", true, "error", ERROR_TIP_MS);
      return;
    }
    setMode({ kind: "points", segmentId });
  }
  host?.refresh();
}

function onDragPoint(this: SVGCircleElement, event: D3DragEvent<SVGCircleElement, unknown, unknown>): void {
  const seg = getSegment();
  if (!seg) return;

  const index = +this.dataset.index!;
  const isEndpoint = index === 0 || index === seg.points.length - 1;
  const domain = Transports.getDomain(seg.transport);
  const original = seg.points[index];
  const originalFrom = seg.from;
  const originalTo = seg.to;

  const isAllowed = (cellId: number) =>
    isEndpoint ? Journeys.isValidEndpoint(cellId, domain) : Journeys.isValidPathPoint(cellId, domain);

  let droppedCell = original[2];

  event.on("drag", (dragEvent: D3DragEvent<SVGCircleElement, unknown, unknown>) => {
    const x = rn(dragEvent.x, 2);
    const y = rn(dragEvent.y, 2);
    droppedCell = Pack.findCell(x, y) ?? original[2];

    this.setAttribute("cx", String(x));
    this.setAttribute("cy", String(y));
    this.setAttribute("fill", isAllowed(droppedCell) ? "#fff" : "#e04040");

    seg.points[index] = [x, y, droppedCell];
    if (isEndpoint) seg[index ? "to" : "from"] = droppedCell;
    seg.distance = Journeys.getPathLength(seg.points);
    Layers.draw("journeys");
  });

  event.on("end", () => {
    if (!isAllowed(droppedCell)) {
      seg.points[index] = original;
      seg.from = originalFrom;
      seg.to = originalTo;
      seg.distance = Journeys.getPathLength(seg.points);
      tip(`Point reverted — ${terrainRejection(droppedCell, domain, seg.transport)}`, true, "error", ERROR_TIP_MS);
    }
    host?.refresh();
  });
}

/** Index of the edge running closest to (x, y) — where a new point is inserted */
export function closestSegmentIndex(points: JourneyPoint[], x: number, y: number): number {
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

function onAddPoint(this: SVGPathElement, event: MouseEvent): void {
  const seg = getSegment();
  if (!seg) return;
  event.stopPropagation();

  const clicked = getClickedCell(event, this);
  if (!clicked) return;
  const [x, y, cellId] = clicked;

  const domain = Transports.getDomain(seg.transport);
  if (!Journeys.isValidPathPoint(cellId, domain)) {
    tip(`Can't add a point there — ${terrainRejection(cellId, domain, seg.transport)}`, true, "error", ERROR_TIP_MS);
    return;
  }

  seg.points.splice(closestSegmentIndex(seg.points, x, y), 0, [x, y, cellId]);
  seg.distance = Journeys.getPathLength(seg.points);
  host?.refresh();
}

function onRemovePoint(this: SVGCircleElement, event: MouseEvent): void {
  event.preventDefault();
  const seg = getSegment();
  if (!seg) return;

  if (seg.points.length <= 2) {
    tip("A path needs at least two points.", true, "error", ERROR_TIP_MS);
    return;
  }

  seg.points.splice(+this.dataset.index!, 1);
  seg.from = seg.points[0][2];
  seg.to = seg.points[seg.points.length - 1][2];
  seg.distance = Journeys.getPathLength(seg.points);
  host?.refresh();
}

// ---- custom path drawing (click-to-build) ------------------------------

export function toggleDrawPath(segmentId: number): void {
  // clicking the brush again commits the drawing; Esc discards it
  if (mode?.kind === "draw" && mode.segmentId === segmentId) {
    finishDrawing();
    return;
  }
  if (host?.getSegment(segmentId)) setMode({ kind: "draw", segmentId, points: [] });
  host?.refresh();
}

function onDrawCell(clicked: ClickedCell): void {
  const seg = getSegment();
  if (mode?.kind !== "draw" || !seg) return;

  const [x, y, cellId] = clicked;

  const domain = Transports.getDomain(seg.transport);
  const isEndpoint = !mode.points.length;
  const allowed = isEndpoint ? Journeys.isValidEndpoint(cellId, domain) : Journeys.isValidPathPoint(cellId, domain);
  if (!allowed) {
    tip(`Can't add a point there — ${terrainRejection(cellId, domain, seg.transport)}`, true, "error", ERROR_TIP_MS);
    return;
  }

  mode.points.push([x, y, cellId]);
  drawOverlays();
}

function onDrawUndo(event: MouseEvent): void {
  if (mode?.kind !== "draw") return;
  event.preventDefault();
  mode.points.pop();
  drawOverlays();
}

function finishDrawing(): void {
  const seg = getSegment();
  if (mode?.kind !== "draw" || !seg) {
    setMode(null);
    return;
  }

  const points = mode.points;
  if (points.length < 2) {
    tip("A custom path needs at least two points.", true, "error", ERROR_TIP_MS);
    return;
  }

  // points are checked as they are added, but the transport type can be changed
  // mid-draw, so the finished path has to be re-checked as a whole
  const domain = Transports.getDomain(seg.transport);
  if (!Journeys.isValidPath(points, domain)) {
    tip(
      `This path isn't valid for a ${domain} transport type — right-click to undo the bad points.`,
      true,
      "error",
      ERROR_TIP_MS
    );
    return;
  }

  seg.points = points;
  seg.from = points[0][2];
  seg.to = points[points.length - 1][2];
  seg.distance = Journeys.getPathLength(seg.points);
  seg.custom = true;

  setMode(null);
  host?.refresh();
}

// ---- on-map overlays ---------------------------------------------------

/** Redraw the active mode's on-map handles; called by the editor after every refresh */
export function drawOverlays(): void {
  const seg = getSegment();
  if (!mode || mode.kind === "pick" || !seg) {
    findEl(OVERLAY_ID)?.remove();
    return;
  }

  const journey = host?.getJourney();
  const color = seg.color || journey?.color || "#000";
  const points = mode.kind === "draw" ? mode.points : seg.points;

  const dots = points
    .map(
      ([x, y], index) =>
        /* html */ `<circle cx="${x}" cy="${y}" r="0.8" data-index="${index}" fill="#fff" stroke="${color}" stroke-width="0.3"/>`
    )
    .join("");
  const preview =
    mode.kind === "draw" && points.length > 1
      ? /* html */ `<path d="M${points.map(([x, y]) => `${x} ${y}`).join("L")}" fill="none"
          stroke="${color}" stroke-width="1.5" stroke-dasharray="2 1"/>`
      : "";

  const overlay = getOverlay();
  overlay.innerHTML = preview + dots;

  // a drawing in progress is a preview only: every click on it belongs to the map below
  if (mode.kind === "draw") {
    overlay.style.pointerEvents = "none";
    return;
  }

  overlay.style.pointerEvents = "";
  select(overlay)
    .selectAll<SVGCircleElement, unknown>("circle")
    .style("cursor", "move")
    .call(drag<SVGCircleElement, unknown>().on("start", onDragPoint))
    .on("contextmenu", onRemovePoint);

  // listeners on the segment path go with it: refresh() redraws the layer from scratch
  select<SVGPathElement, unknown>(`#segment${journey?.i}_${seg.i}`).on("click", onAddPoint);
}

function getOverlay(): SVGGElement {
  const existing = findEl<SVGGElement>(OVERLAY_ID);
  if (existing) return existing;

  const overlay = createEl<SVGGElement>("g", OVERLAY_ID);
  ensureEl("viewbox").append(overlay);
  return overlay;
}
