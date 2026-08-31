// On-map interaction modes for journey segments
import { type D3DragEvent, drag, select } from "d3";
import { alertDialog, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import type { TransportDomain } from "@/generators/transports-generator";
import type { Journey, JourneyPoint, JourneySegment } from "@/types/Journey";
import { ensureEl, escapeHtml, findEl, getPointer, rn } from "@/utils";
import { createEl } from "@/utils/nodeUtils";

const OVERLAY_ID = "journeyOverlay";
const ERROR_TIP_TIME = 8000;

const warn = (message: string) => tip(message, true, "error", ERROR_TIP_TIME);

const HINTS = {
  pick: "Click a cell on the map to set the endpoint. Esc to cancel.",
  points: "Drag points to move, click the path to add, right-click a point to remove. Esc to finish.",
  draw: "Click cells to add points. Enter to finish, right-click to undo, Esc to cancel."
};

type Mode =
  | { kind: "pick"; segmentId: number; endpoint: "from" | "to"; chainTo?: boolean }
  | { kind: "points"; segmentId: number }
  | { kind: "draw"; segmentId: number; points: JourneyPoint[] };

type PathEditMode = Mode["kind"];

type ClickedCell = [x: number, y: number, cellId: number];

interface JourneyPathHost {
  getJourney: () => Journey | undefined;
  getSegment: (id: number) => JourneySegment | undefined;
  refresh: () => void;
}

export class JourneyPathEditor {
  private mode: Mode | null = null;

  constructor(private readonly host: JourneyPathHost) {}

  isActive(): boolean {
    return this.mode !== null;
  }

  isEditing(segmentId: number, kind?: PathEditMode): boolean {
    if (this.mode?.segmentId !== segmentId) return false;
    return !kind || this.mode.kind === kind;
  }

  pickEndpoint(segmentId: number, endpoint: "from" | "to", chainTo = false): void {
    if (this.host.getSegment(segmentId)) this.setMode({ kind: "pick", segmentId, endpoint, chainTo });
  }

  /** Show the draggable control points of the segment path, or hide them again */
  togglePointEdit(segmentId: number): void {
    if (this.isEditing(segmentId, "points")) {
      this.setMode(null);
    } else {
      const seg = this.host.getSegment(segmentId);
      if (!seg || seg.points.length < 2) {
        warn("This segment has no path yet: set both endpoints first");
        return;
      }
      this.setMode({ kind: "points", segmentId });
    }
    this.host.refresh();
  }

  /** Start drawing a custom path cell by cell, or commit the one being drawn */
  toggleDrawing(segmentId: number): void {
    // clicking the brush again commits the drawing; Esc discards it
    if (this.isEditing(segmentId, "draw")) {
      this.finishDrawing();
      return;
    }
    if (this.host.getSegment(segmentId)) this.setMode({ kind: "draw", segmentId, points: [] });
    this.host.refresh();
  }

  stopEditing(segmentId: number): void {
    if (this.isEditing(segmentId)) this.setMode(null);
  }

  cancel(): void {
    this.setMode(null);
  }

  /** Redraw the active mode's on-map handles; called by the host after every refresh */
  drawOverlays(): void {
    const seg = this.segment;
    if (!this.mode || this.mode.kind === "pick" || !seg) {
      findEl(OVERLAY_ID)?.remove();
      return;
    }

    const mode = this.mode;
    const journey = this.host.getJourney();
    const color = seg.color || journey?.color || "#000";
    const points = mode.kind === "draw" ? mode.points : seg.points;

    const dots = points
      .map(
        ([x, y]) => /* html */ `<circle cx="${x}" cy="${y}" r="0.8" fill="#fff" stroke="${color}" stroke-width="0.3"/>`
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
      .each((_datum, index, nodes) => {
        const circle = nodes[index];
        select(circle)
          .call(
            drag<SVGCircleElement, unknown>().on("start", (event: DragStart) => this.dragPoint(event, circle, index))
          )
          .on("contextmenu", (event: MouseEvent) => this.removePoint(event, index));
      });

    // listeners on the segment path go with it: refresh() redraws the layer from scratch
    select<SVGPathElement, unknown>(`#segment${journey?.i}_${seg.i}`).on("click", (event: MouseEvent) =>
      this.addPoint(event)
    );
  }

  private get segment(): JourneySegment | undefined {
    return this.mode ? this.host.getSegment(this.mode.segmentId) : undefined;
  }

  private setMode(next: Mode | null): void {
    const wasPickingCells = this.mode?.kind === "pick" || this.mode?.kind === "draw";
    this.mode = next;

    const picksCells = next?.kind === "pick" || next?.kind === "draw";
    const viewbox = ensureEl<SVGGElement>("viewbox");

    // Take the map click over the way every other cell-picking editor does, replacing the default
    // handler rather than stacking on top of it: a second listener would keep opening the editor
    // of whatever was clicked — a burg icon, a route — while the user is only picking a cell.
    if (picksCells)
      select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", this.onViewboxClick);
    else if (wasPickingCells) applyDefaultViewboxEvents();

    document.removeEventListener("keydown", this.onKeyDown);
    viewbox.removeEventListener("contextmenu", this.onDrawUndo);
    if (next) document.addEventListener("keydown", this.onKeyDown);
    // scoped to the map: a draw in progress must not eat the context menu of the dialogs around it
    if (next?.kind === "draw") viewbox.addEventListener("contextmenu", this.onDrawUndo);

    if (next) tip(HINTS[next.kind], true);
    else clearMainTip();

    this.drawOverlays();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.mode) return;
    if (event.key === "Escape") {
      this.setMode(null);
      this.host.refresh();
    } else if (event.key === "Enter" && this.mode.kind === "draw") this.finishDrawing();
  };

  /** Cell clicks belong to whichever mode is armed for them */
  private readonly onViewboxClick = (event: MouseEvent): void => {
    const clicked = getClickedCell(event, event.currentTarget as Element);
    if (!clicked) return;
    if (this.mode?.kind === "pick") this.pickCell(clicked);
    else if (this.mode?.kind === "draw") this.drawCell(clicked);
  };

  private pickCell(clicked: ClickedCell): void {
    const seg = this.segment;
    if (this.mode?.kind !== "pick" || !seg) {
      this.setMode(null);
      return;
    }

    const cellId = clicked[2];

    const domain = Transports.getDomain(seg.transport);
    if (!Journeys.isValidEndpoint(cellId, domain)) {
      warn(`Can't put an endpoint there — ${terrainRejection(cellId, domain, seg.transport)}`);
      return;
    }

    const endpoint = this.mode.endpoint;
    const chainTo = this.mode.chainTo;
    const apply = () => {
      seg[endpoint] = cellId;
      this.setMode(null);
      if (seg.from !== undefined && seg.to !== undefined) recomputeSegment(seg);
      this.host.refresh();
      if (chainTo) this.pickEndpoint(seg.i, "to");
    };

    // recomputeSegment never overwrites a custom path, so a silent endpoint change would desync it
    if (seg.custom) {
      confirmationDialog({
        title: "Overwrite custom path?",
        message: `Segment "<b>${escapeHtml(seg.name)}</b>" has a custom-drawn path. Moving an endpoint replaces it with the pathfinder's route. Continue?`,
        confirm: "Replace",
        onConfirm: () => {
          seg.custom = false;
          apply();
        }
      });
      return;
    }

    apply();
  }

  private dragPoint(event: DragStart, circle: SVGCircleElement, index: number): void {
    const seg = this.segment;
    if (!seg) return;

    const isEndpoint = index === 0 || index === seg.points.length - 1;
    const domain = Transports.getDomain(seg.transport);
    const original = seg.points[index];
    const originalFrom = seg.from;
    const originalTo = seg.to;

    const isAllowed = (cellId: number) => Journeys.isValidPointAt(cellId, domain, isEndpoint);

    let droppedCell = original[2];

    event.on("drag", (dragEvent: DragStart) => {
      const x = rn(dragEvent.x, 2);
      const y = rn(dragEvent.y, 2);
      droppedCell = Pack.findCell(x, y) ?? original[2];

      circle.setAttribute("cx", String(x));
      circle.setAttribute("cy", String(y));
      circle.setAttribute("fill", isAllowed(droppedCell) ? "#fff" : "#e04040");

      seg.points[index] = [x, y, droppedCell];
      if (isEndpoint) seg[index ? "to" : "from"] = droppedCell;
      syncGeometry(seg);
      Layers.draw("journeys");
    });

    event.on("end", () => {
      if (!isAllowed(droppedCell)) {
        seg.points[index] = original;
        seg.from = originalFrom;
        seg.to = originalTo;
        syncGeometry(seg);
        warn(`Point reverted — ${terrainRejection(droppedCell, domain, seg.transport)}`);
      }
      this.host.refresh();
    });
  }

  private addPoint(event: MouseEvent): void {
    const seg = this.segment;
    if (!seg) return;
    event.stopPropagation();

    const clicked = getClickedCell(event, event.currentTarget as Element);
    if (!clicked) return;
    const [x, y, cellId] = clicked;

    const domain = Transports.getDomain(seg.transport);
    if (!Journeys.isValidPathPoint(cellId, domain)) {
      warn(`Can't add a point there — ${terrainRejection(cellId, domain, seg.transport)}`);
      return;
    }

    seg.points.splice(closestSegmentIndex(seg.points, x, y), 0, [x, y, cellId]);
    syncGeometry(seg);
    this.host.refresh();
  }

  private removePoint(event: MouseEvent, index: number): void {
    event.preventDefault();
    const seg = this.segment;
    if (!seg) return;

    if (seg.points.length <= 2) {
      warn("A path needs at least two points.");
      return;
    }

    seg.points.splice(index, 1);
    syncGeometry(seg, true);
    this.host.refresh();
  }

  private drawCell(clicked: ClickedCell): void {
    const seg = this.segment;
    if (this.mode?.kind !== "draw" || !seg) return;

    const [x, y, cellId] = clicked;

    const domain = Transports.getDomain(seg.transport);
    const points = this.mode.points;

    // a mid-path point valid only as an endpoint (e.g. a port) can never be continued from
    const last = points.length > 1 ? points[points.length - 1] : undefined;
    if (last && !Journeys.isValidPathPoint(last[2], domain)) {
      warn("The path reached a terminal point — finish the drawing there, or undo it with a right-click.");
      return;
    }

    // any click may turn out to be the last one, so cells valid only as endpoints are accepted too
    if (!Journeys.isValidPathPoint(cellId, domain) && !Journeys.isValidEndpoint(cellId, domain)) {
      warn(`Can't add a point there — ${terrainRejection(cellId, domain, seg.transport)}`);
      return;
    }

    points.push([x, y, cellId]);
    this.drawOverlays();
  }

  private readonly onDrawUndo = (event: MouseEvent): void => {
    if (this.mode?.kind !== "draw") return;
    event.preventDefault();
    this.mode.points.pop();
    this.drawOverlays();
  };

  private finishDrawing(): void {
    const seg = this.segment;
    if (this.mode?.kind !== "draw" || !seg) {
      this.setMode(null);
      return;
    }

    const points = this.mode.points;
    if (points.length < 2) {
      warn("A custom path needs at least two points.");
      return;
    }

    // points are checked as they are added, but the transport type can be changed
    // mid-draw, so the finished path has to be re-checked as a whole
    const domain = Transports.getDomain(seg.transport);
    if (!Journeys.isValidPath(points, domain)) {
      warn(`This path isn't valid for a ${domain} transport type — right-click to undo the bad points.`);
      return;
    }

    seg.points = points;
    syncGeometry(seg, true);
    seg.custom = true;

    this.setMode(null);
    this.host.refresh();
  }
}

/** Bring the segment's stored geometry back in line with its points: length always, endpoints on request */
function syncGeometry(seg: JourneySegment, syncEndpoints = false): void {
  if (syncEndpoints) {
    seg.from = seg.points[0][2];
    seg.to = seg.points[seg.points.length - 1][2];
  }
  seg.distance = Journeys.getPathLength(seg.points);
}

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
      message: `Segment "<b>${escapeHtml(seg.name)}</b>": ${domainMismatchMessage(seg, domain) ?? result.warning}`
    });
  } else tip(result.warning, true, "warn", 8000);
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

type DragStart = D3DragEvent<SVGCircleElement, unknown, unknown>;

function terrainRejection(cellId: number, domain: TransportDomain, transport: string): string {
  const rule =
    domain === "land" ? "its path has to stay on land" : "its path has to stay on water or a navigable river";
  return `${transport} is a ${domain} transport — ${rule}. That spot is a ${Journeys.describeCell(cellId)}.`;
}

/** Cell under the cursor, rounded to the map coordinates the path points store */
function getClickedCell(event: MouseEvent, node: Element): ClickedCell | null {
  const [pointerX, pointerY] = getPointer(event, node);
  const x = rn(pointerX, 2);
  const y = rn(pointerY, 2);
  const cellId = Pack.findCell(x, y);
  return cellId === undefined ? null : [x, y, cellId];
}

/** Index of the edge running closest to (x, y) — where a new point is inserted */
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

function getOverlay(): SVGGElement {
  const existing = findEl<SVGGElement>(OVERLAY_ID);
  if (existing) return existing;

  const overlay = createEl<SVGGElement>("g", OVERLAY_ID);
  ensureEl("viewbox").append(overlay);
  return overlay;
}
