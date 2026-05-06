import { rn } from "../utils/numberUtils";

export interface JourneyWaypoint {
  id: string;
  name: string;
  x: number;
  y: number;
}

/** Catalog + ordered path (`stopIds` references `waypoints` by id). */
export interface PackJourney {
  stopIds: string[];
  waypoints: JourneyWaypoint[];
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

/**
 * Mutates `j` into canonical `{ stopIds, waypoints }`; drops unknown `stopIds`
 * and removes any stray `points` key (not part of the shipped format).
 */
export function normalizePackJourney(j: unknown): void {
  if (!j || typeof j !== "object" || Array.isArray(j)) return;

  const obj = j as Record<string, unknown>;

  let waypoints: JourneyWaypoint[] = Array.isArray(obj.waypoints)
    ? sanitizeWaypoints(obj.waypoints as unknown[])
    : [];

  let stopIds: string[] = Array.isArray(obj.stopIds)
    ? (obj.stopIds as unknown[]).filter((id): id is string => typeof id === "string")
    : [];

  const idSet = new Set(waypoints.map((w) => w.id));
  stopIds = stopIds.filter((id) => idSet.has(id));

  delete obj.points;
  obj.stopIds = stopIds;
  obj.waypoints = waypoints;
}

export function journeyResolvedCoordinates(j: PackJourney): [number, number][] {
  const map = new Map<string, [number, number]>(
    j.waypoints.map((w) => [w.id, [w.x, w.y]] as const),
  );
  const out: [number, number][] = [];
  for (const id of j.stopIds) {
    const p = map.get(id);
    if (p) out.push([p[0], p[1]]);
  }
  return out;
}

/** Waypoint ids that appear in the journey sequence (for circle hit hints). */
export function referencedWaypointIds(j: PackJourney): Set<string> {
  return new Set(j.stopIds);
}
