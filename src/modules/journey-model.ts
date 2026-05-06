/**
 * Journey path: ordered burg / marker references only (positions live on pack).
 * Legacy `{ stopIds, waypoints }` is migrated on normalize (waypoint legs dropped).
 */

/** One leg in the journey sequence (linked-list style via array order). */
export interface JourneyBurgLeg {
  kind: "burg";
  id: number;
}

export interface JourneyMarkerLeg {
  kind: "marker";
  id: number;
}

export type JourneyStopLeg = JourneyBurgLeg | JourneyMarkerLeg;

export interface PackJourney {
  stops: JourneyStopLeg[];
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
  | { kind: "burg"; id: number }
  | { kind: "marker"; id: number };

export function journeyLegToRefString(leg: JourneyStopLeg): string {
  return leg.kind === "burg"
    ? burgJourneyStopRef(leg.id)
    : markerJourneyStopRef(leg.id);
}

export function parseJourneyStopRef(stopId: string): ParsedJourneyStopRef | null {
  const bm = BURG_REF_RE.exec(stopId);
  if (bm) return { kind: "burg", id: +bm[1] };
  const mm = MARKER_REF_RE.exec(stopId);
  if (mm) return { kind: "marker", id: +mm[1] };
  return null;
}

/** UI / DOM string → stored leg (burg or marker only). */
export function journeyRefStringToLeg(ref: string): JourneyStopLeg | null {
  const p = parseJourneyStopRef(ref);
  if (!p) return null;
  return p.kind === "burg"
    ? { kind: "burg", id: p.id }
    : { kind: "marker", id: p.id };
}

export function isWellFormedBurgStopRef(id: string): boolean {
  return BURG_REF_RE.test(id);
}

export function isWellFormedMarkerStopRef(id: string): boolean {
  return MARKER_REF_RE.test(id);
}

export function emptyPackJourney(): PackJourney {
  return { stops: [] };
}

function sanitizeStopsArray(raw: unknown[]): JourneyStopLeg[] {
  const out: JourneyStopLeg[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const kind = o.kind;
    const id = Number(o.id);
    if (!Number.isInteger(id) || id < 0) continue;
    if (kind === "burg") out.push({ kind: "burg", id });
    else if (kind === "marker") out.push({ kind: "marker", id });
  }
  return out;
}

function legacyStopIdsToLegs(stopIds: string[]): JourneyStopLeg[] {
  const out: JourneyStopLeg[] = [];
  for (const sid of stopIds) {
    const p = parseJourneyStopRef(sid);
    if (!p) continue;
    out.push(
      p.kind === "burg"
        ? { kind: "burg", id: p.id }
        : { kind: "marker", id: p.id },
    );
  }
  return out;
}

function burgExistsInPack(
  pack: JourneyNormalizePackContext,
  id: number,
): boolean {
  const burgs = pack.burgs;
  if (!Array.isArray(burgs)) return false;
  return burgs.some((b) => b.i === id && !b.removed);
}

function markerExistsInPack(pack: JourneyNormalizePackContext, id: number): boolean {
  const markers = pack.markers;
  if (!Array.isArray(markers)) return false;
  return markers.some((m) => m.i === id);
}

function legIsAllowed(
  leg: JourneyStopLeg,
  pack?: JourneyNormalizePackContext,
): boolean {
  if (leg.kind === "burg") {
    if (!pack) return true;
    return burgExistsInPack(pack, leg.id);
  }
  if (!pack) return true;
  return markerExistsInPack(pack, leg.id);
}

/**
 * Mutates `j` into canonical `{ stops }`. Migrates legacy `stopIds` (burg/marker
 * strings only; waypoint ids dropped). Removes `stopIds`, `waypoints`, `points`.
 */
export function normalizePackJourney(
  j: unknown,
  pack?: JourneyNormalizePackContext,
): void {
  if (!j || typeof j !== "object" || Array.isArray(j)) return;

  const obj = j as Record<string, unknown>;

  let stops = sanitizeStopsArray(
    Array.isArray(obj.stops) ? (obj.stops as unknown[]) : [],
  );

  if (!stops.length && Array.isArray(obj.stopIds)) {
    const ids = (obj.stopIds as unknown[]).filter(
      (id): id is string => typeof id === "string",
    );
    stops = legacyStopIdsToLegs(ids);
  }

  stops = stops.filter((leg) => legIsAllowed(leg, pack));

  delete obj.points;
  delete obj.stopIds;
  delete obj.waypoints;
  obj.stops = stops;
}

function finiteCoord(x: unknown, y: unknown): [number, number] | null {
  const nx = Number(x);
  const ny = Number(y);
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
  return [nx, ny];
}

function tryWarnMissing(msg: string): void {
  try {
    const w = typeof globalThis !== "undefined" && (globalThis as { WARN?: boolean }).WARN;
    if (w) console.warn(msg);
  } catch {
    /* noop */
  }
}

/** Resolve one leg to map coordinates, or null if missing. */
export function resolveJourneyLeg(
  leg: JourneyStopLeg,
  ctx: JourneyResolutionContext,
): [number, number] | null {
  if (leg.kind === "burg") {
    const burg = ctx.burgs.find((b) => b.i === leg.id && !b.removed);
    if (!burg) {
      tryWarnMissing(`journey: missing burg ${leg.id}`);
      return null;
    }
    const p = finiteCoord(burg.x, burg.y);
    if (!p) tryWarnMissing(`journey: burg ${leg.id} has invalid x/y`);
    return p;
  }

  const marker = ctx.markers.find((m) => m.i === leg.id);
  if (!marker) {
    tryWarnMissing(`journey: missing marker ${leg.id}`);
    return null;
  }
  const p = finiteCoord(marker.x, marker.y);
  if (!p) tryWarnMissing(`journey: marker ${leg.id} has invalid x/y`);
  return p;
}

/** Resolve `burg:n` / `marker:n` string (editor / DOM). */
export function resolveJourneyStopPosition(
  stopRef: string,
  ctx: JourneyResolutionContext,
): [number, number] | null {
  const leg = journeyRefStringToLeg(stopRef);
  if (!leg) return null;
  return resolveJourneyLeg(leg, ctx);
}

export function journeyResolvedCoordinates(
  j: PackJourney,
  ctx: JourneyResolutionContext = { burgs: [], markers: [] },
): [number, number][] {
  const out: [number, number][] = [];
  for (const leg of j.stops) {
    const p = resolveJourneyLeg(leg, ctx);
    if (p) out.push([p[0], p[1]]);
  }
  return out;
}

/** Ref strings for legs in the journey (for vertex hints). */
export function referencedStopIds(j: PackJourney): Set<string> {
  return new Set(j.stops.map(journeyLegToRefString));
}

/** @deprecated Use referencedStopIds */
export function referencedWaypointIds(j: PackJourney): Set<string> {
  return referencedStopIds(j);
}
