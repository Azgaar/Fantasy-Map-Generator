import { rn } from "../utils/numberUtils";

export interface JourneyWaypoint {
  id: string;
  name: string;
  x: number;
  y: number;
}

/** Catalog + ordered path (`stopIds`: waypoint ids and/or `burg:n` / `marker:n`). */
export interface PackJourney {
  stopIds: string[];
  waypoints: JourneyWaypoint[];
}

/** Minimal pack slice for resolving burg/marker positions (avoids importing PackedGraph). */
export interface JourneyResolutionContext {
  burgs: Array<{ i?: number; x?: number; y?: number; removed?: boolean }>;
  markers: Array<{ i?: number; x?: number; y?: number }>;
}

/** Optional pack slice for pruning dead burg/marker refs during normalize. */
export interface JourneyNormalizePackContext {
  burgs?: Array<{ i?: number; removed?: boolean }>;
  markers?: Array<{ i?: number }>;
}

const BURG_REF_RE = /^burg:(\d+)$/;
const MARKER_REF_RE = /^marker:(\d+)$/;

export function burgJourneyStopRef(i: number): string {
  return `burg:${i}`;
}

export function markerJourneyStopRef(i: number): string {
  return `marker:${i}`;
}

export type ParsedJourneyStopRef =
  | { kind: "waypoint"; id: string }
  | { kind: "burg"; i: number }
  | { kind: "marker"; i: number };

export function parseJourneyStopRef(stopId: string): ParsedJourneyStopRef | null {
  const bm = BURG_REF_RE.exec(stopId);
  if (bm) return { kind: "burg", i: +bm[1] };
  const mm = MARKER_REF_RE.exec(stopId);
  if (mm) return { kind: "marker", i: +mm[1] };
  if (stopId.length > 0) return { kind: "waypoint", id: stopId };
  return null;
}

export function isWellFormedBurgStopRef(id: string): boolean {
  return BURG_REF_RE.test(id);
}

export function isWellFormedMarkerStopRef(id: string): boolean {
  return MARKER_REF_RE.test(id);
}

export function newWaypointId(): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "";
  if (uuid) return `wp_${uuid}`;
  return `wp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyPackJourney(): PackJourney {
  return { stopIds: [], waypoints: [] };
}

/** Next auto name `Stop n` based on existing waypoint names / count. */
export function nextDefaultWaypointName(waypoints: JourneyWaypoint[]): string {
  let maxN = 0;
  const re = /^Stop\s+(\d+)$/i;
  for (const w of waypoints) {
    const m = re.exec(w.name.trim());
    if (m) maxN = Math.max(maxN, +m[1]);
  }
  return `Stop ${maxN + 1}`;
}

function sanitizeWaypoints(raw: unknown[]): JourneyWaypoint[] {
  const out: JourneyWaypoint[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const name =
      typeof o.name === "string" && o.name.trim() !== "" ? o.name : "Stop";
    const x = Number(o.x);
    const y = Number(o.y);
    if (!id || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, x: rn(x, 6), y: rn(y, 6) });
  }
  return out;
}

function burgExistsInPack(
  pack: JourneyNormalizePackContext,
  i: number,
): boolean {
  const burgs = pack.burgs;
  if (!Array.isArray(burgs)) return false;
  return burgs.some((b) => b.i === i && !b.removed);
}

function markerExistsInPack(pack: JourneyNormalizePackContext, i: number): boolean {
  const markers = pack.markers;
  if (!Array.isArray(markers)) return false;
  return markers.some((m) => m.i === i);
}

function stopIdIsAllowed(
  id: string,
  waypointIds: Set<string>,
  pack?: JourneyNormalizePackContext,
): boolean {
  if (waypointIds.has(id)) return true;
  const parsed = parseJourneyStopRef(id);
  if (!parsed || parsed.kind === "waypoint") return false;
  if (parsed.kind === "burg") {
    if (!isWellFormedBurgStopRef(id)) return false;
    if (!pack) return true;
    return burgExistsInPack(pack, parsed.i);
  }
  if (!isWellFormedMarkerStopRef(id)) return false;
  if (!pack) return true;
  return markerExistsInPack(pack, parsed.i);
}

/**
 * Mutates `j` into canonical `{ stopIds, waypoints }`; drops invalid `stopIds`;
 * removes stray `points`. When `pack` is passed, drops burg/marker refs whose
 * entity no longer exists.
 */
export function normalizePackJourney(
  j: unknown,
  pack?: JourneyNormalizePackContext,
): void {
  if (!j || typeof j !== "object" || Array.isArray(j)) return;

  const obj = j as Record<string, unknown>;

  const waypoints: JourneyWaypoint[] = Array.isArray(obj.waypoints)
    ? sanitizeWaypoints(obj.waypoints as unknown[])
    : [];

  let stopIds: string[] = Array.isArray(obj.stopIds)
    ? (obj.stopIds as unknown[]).filter((id): id is string => typeof id === "string")
    : [];

  const idSet = new Set(waypoints.map((w) => w.id));
  stopIds = stopIds.filter((id) => stopIdIsAllowed(id, idSet, pack));

  delete obj.points;
  obj.stopIds = stopIds;
  obj.waypoints = waypoints;
}

function finiteCoord(x: unknown, y: unknown): [number, number] | null {
  const nx = Number(x);
  const ny = Number(y);
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
  return [nx, ny];
}

/** Resolve one stop to map coordinates, or null if missing. */
export function resolveJourneyStopPosition(
  stopId: string,
  j: PackJourney,
  ctx: JourneyResolutionContext,
): [number, number] | null {
  const wpMap = new Map(j.waypoints.map((w) => [w.id, [w.x, w.y]] as const));
  const direct = wpMap.get(stopId);
  if (direct) return [direct[0], direct[1]];

  const parsed = parseJourneyStopRef(stopId);
  if (!parsed || parsed.kind === "waypoint") return null;

  if (parsed.kind === "burg") {
    const burg = ctx.burgs.find((b) => b.i === parsed.i && !b.removed);
    if (!burg) {
      tryWarnMissing(`journey: missing burg ref ${stopId}`);
      return null;
    }
    const p = finiteCoord(burg.x, burg.y);
    if (!p) tryWarnMissing(`journey: burg ${parsed.i} has invalid x/y`);
    return p;
  }

  const marker = ctx.markers.find((m) => m.i === parsed.i);
  if (!marker) {
    tryWarnMissing(`journey: missing marker ref ${stopId}`);
    return null;
  }
  const p = finiteCoord(marker.x, marker.y);
  if (!p) tryWarnMissing(`journey: marker ${parsed.i} has invalid x/y`);
  return p;
}

function tryWarnMissing(msg: string): void {
  try {
    const w = typeof globalThis !== "undefined" && (globalThis as { WARN?: boolean }).WARN;
    if (w) console.warn(msg);
  } catch {
    /* noop */
  }
}

export function journeyResolvedCoordinates(
  j: PackJourney,
  ctx: JourneyResolutionContext = { burgs: [], markers: [] },
): [number, number][] {
  const out: [number, number][] = [];
  for (const id of j.stopIds) {
    const p = resolveJourneyStopPosition(id, j, ctx);
    if (p) out.push([p[0], p[1]]);
  }
  return out;
}

/** All stop ids in the journey sequence (waypoints, burgs, markers). */
export function referencedStopIds(j: PackJourney): Set<string> {
  return new Set(j.stopIds);
}

/** @deprecated Use referencedStopIds */
export function referencedWaypointIds(j: PackJourney): Set<string> {
  return referencedStopIds(j);
}
