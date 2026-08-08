import { getDefaultTransportTypes } from "@/data/transport-types";
import type { Journey, JourneyPoint, Segment, TransportDomain, TransportType } from "@/types/Journey";
import { isLand } from "../utils";
import type { Route } from "./routes-generator";

/** Last-resort stroke when neither the segment, the journey, nor the layer sets one. */
export const DEFAULT_JOURNEY_COLOR = "#8b1a1a";

/** Off-road travel is slower than on-road — this factor is applied to the
 *  segment's base speed when `avoidRoads` is set (0.5 = half speed). */
export const OFF_ROAD_SPEED_FACTOR = 0.5;

/** Fallback when the hours-per-day setting isn't stored yet. */
export const DEFAULT_HOURS_PER_DAY = 8;

// Journeys tolerate slightly colder seas than trade routes do (Routes uses -4).
const MIN_PASSABLE_SEA_TEMP = -5;

// On-road: road cells are cheaper — the pathfinder detours to use them.
// 0.5 means road travel costs half as much, matching the 2× speed advantage.
const ON_ROAD_DISCOUNT = 0.5;

// Off-road: road cells are more expensive — the pathfinder routes around them.
const OFF_ROAD_PENALTY = 5;

// ---- metrics ----------------------------------------------------------

export const isStaySegment = (seg: Segment): boolean => seg.speed <= 0;

export const segmentLengthKm = (seg: Segment): number => (isStaySegment(seg) ? 0 : seg.distance * distanceScale);

export const effectiveSpeed = (seg: Segment): number => {
  if (!seg.speed || seg.speed <= 0) return 0;
  return seg.avoidRoads ? seg.speed * OFF_ROAD_SPEED_FACTOR : seg.speed;
};

export const segmentTimeHours = (seg: Segment): number => {
  if (isStaySegment(seg)) return Math.max(0, seg.duration ?? 0);
  const speed = effectiveSpeed(seg);
  if (speed <= 0) return 0;
  return segmentLengthKm(seg) / speed;
};

export interface JourneyTotals {
  totalKm: number;
  totalHours: number;
  avgSpeed: number;
}

export const journeyTotals = (journey: Journey): JourneyTotals => {
  let totalKm = 0;
  let totalHours = 0;
  let movingHours = 0;
  for (const seg of journey.segments) {
    const km = segmentLengthKm(seg);
    const hours = segmentTimeHours(seg);
    totalKm += km;
    totalHours += hours;
    if (!isStaySegment(seg)) movingHours += hours;
  }
  const avgSpeed = movingHours > 0 ? totalKm / movingHours : 0;
  return { totalKm, totalHours, avgSpeed };
};

/**
 * Format an hours value as e.g. "2d 3h 15m". Days are counted based on
 * `hoursPerDay` (default 8h — a realistic day of travel), so a 24-hour
 * journey with 8h/day reads as "3d" rather than "1d".
 */
export const formatTravelTime = (hours: number, hoursPerDay = DEFAULT_HOURS_PER_DAY): string => {
  if (!Number.isFinite(hours) || hours <= 0) return "0m";
  const perDay = hoursPerDay > 0 ? hoursPerDay : DEFAULT_HOURS_PER_DAY;
  const totalMinutes = Math.round(hours * 60);
  const minutesPerDay = perDay * 60;
  const days = Math.floor(totalMinutes / minutesPerDay);
  const rem1 = totalMinutes - days * minutesPerDay;
  const h = Math.floor(rem1 / 60);
  const m = rem1 - h * 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (h) parts.push(`${h}h`);
  if (m || parts.length === 0) parts.push(`${m}m`);
  return parts.join(" ");
};

/** Total length in px of a point chain. Exported so manual path edits can recalculate distance. */
export const pathLength = (points: JourneyPoint[]): number => {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
};

// ---- pathfinding ------------------------------------------------------

export interface PathfindingResult {
  points: JourneyPoint[];
  distance: number;
  warning?: string;
  errorCode?: "no-water" | "no-land" | "no-water-path" | "no-land-path";
}

export interface JourneyPathOptions {
  /** Land-domain only: if true, avoid the road network (cost-penalise road cells). */
  avoidRoads?: boolean;
}

const pointOf = (cellId: number): JourneyPoint => {
  const [x, y] = pack.cells.p[cellId];
  return [x, y, cellId];
};

const dist = (a: JourneyPoint, b: JourneyPoint): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

const isCoastalLand = (cellId: number): boolean => {
  if (!isLand(cellId, pack)) return false;
  const neighbours = pack.cells.c[cellId] || [];
  return neighbours.some(n => !isLand(n, pack));
};

/**
 * A* shortest-path over the Voronoi cell graph.
 *
 * Two critical differences from the shared `findPath` in pathUtils:
 *  1. Uses a Euclidean-distance heuristic so exploration fans toward the
 *     target, producing visually straighter paths.
 *  2. Checks the exit condition when a cell is **popped** from the priority
 *     queue (not when discovered as a neighbour), guaranteeing the returned
 *     path is truly optimal.
 */
const findPathAStar = (
  start: number,
  end: number,
  getCost: (current: number, next: number) => number
): number[] | null => {
  if (start === end) return [start];

  const cells = pack.cells;
  const [ex, ey] = cells.p[end];
  const heuristic = (cell: number): number => {
    const [cx, cy] = cells.p[cell];
    return Math.hypot(cx - ex, cy - ey);
  };

  const from: number[] = [];
  const gScore: number[] = [];
  const closed = new Set<number>();
  const queue = new window.FlatQueue();

  gScore[start] = 0;
  queue.push(start, heuristic(start));

  while (queue.length) {
    const current = queue.pop();

    if (current === end) {
      const path: number[] = [end];
      let cur = end;
      while (cur !== start) {
        cur = from[cur];
        path.push(cur);
      }
      return path.reverse();
    }

    if (closed.has(current)) continue;
    closed.add(current);

    const currentG = gScore[current];
    if (currentG === undefined) continue;

    for (const next of cells.c[current]) {
      if (closed.has(next)) continue;

      const edgeCost = getCost(current, next);
      if (edgeCost === Infinity) continue;

      const tentativeG = currentG + edgeCost;
      const existingG = gScore[next];
      if (existingG !== undefined && tentativeG >= existingG) continue;

      from[next] = current;
      gScore[next] = tentativeG;
      queue.push(next, tentativeG + heuristic(next));
    }
  }

  return null;
};

const buildDirect = (from: number, to: number): PathfindingResult => {
  const points: JourneyPoint[] = [pointOf(from), pointOf(to)];
  return { points, distance: pathLength(points) };
};

// BFS over pack.cells.routes to find a road path between two cells.
// Returns cell-id chain or null if disconnected.
const bfsRouteCells = (start: number, end: number): number[] | null => {
  const links = pack.cells.routes;
  if (!links[start] || !links[end]) return null;
  if (start === end) return [start];

  const from: Record<number, number> = {};
  const visited = new Set<number>([start]);
  const queue: number[] = [start];

  while (queue.length) {
    const current = queue.shift()!;
    const neighbors = links[current];
    if (!neighbors) continue;
    for (const nextStr of Object.keys(neighbors)) {
      const next = +nextStr;
      if (visited.has(next)) continue;
      visited.add(next);
      from[next] = current;
      if (next === end) {
        const chain: number[] = [end];
        let cur = end;
        while (cur !== start) {
          cur = from[cur];
          chain.push(cur);
        }
        return chain.reverse();
      }
      queue.push(next);
    }
  }
  return null;
};

// Concatenate underlying route control-point slices along a cell chain, deduplicating shared endpoints.
const collectRoutePoints = (cellChain: number[]): JourneyPoint[] => {
  const links = pack.cells.routes;
  const points: JourneyPoint[] = [];
  const pushPoint = (p: JourneyPoint) => {
    const last = points[points.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) return;
    points.push(p);
  };

  for (let i = 0; i < cellChain.length - 1; i++) {
    const a = cellChain[i];
    const b = cellChain[i + 1];
    const routeId = links[a]?.[b];
    const route = routeId !== undefined ? pack.routes.find((r: Route) => r.i === routeId) : undefined;

    if (!route?.points || route.points.length < 2) {
      pushPoint(pointOf(a));
      pushPoint(pointOf(b));
      continue;
    }

    // Find the slice of route.points that goes from cell a to cell b.
    const idxA = route.points.findIndex(p => p[2] === a);
    const idxB = route.points.findIndex(p => p[2] === b);
    if (idxA === -1 || idxB === -1) {
      pushPoint(pointOf(a));
      pushPoint(pointOf(b));
      continue;
    }
    const step = idxA < idxB ? 1 : -1;
    for (let j = idxA; j !== idxB + step; j += step) {
      const p = route.points[j];
      pushPoint([p[0], p[1], p[2]] as JourneyPoint);
    }
  }

  if (!points.length) return [pointOf(cellChain[0]), pointOf(cellChain[cellChain.length - 1])];
  return points;
};

const cellHasRoute = (cellId: number): boolean => {
  const links = pack.cells.routes?.[cellId];
  return !!links && Object.keys(links).length > 0;
};

const buildLand = (from: number, to: number, avoidRoads = false): PathfindingResult => {
  if (!avoidRoads) {
    // Try exact road-network path first (BFS). This produces the best result
    // because it walks the underlying Route.points slices for road geometry.
    const chain = bfsRouteCells(from, to);
    if (chain && chain.length >= 2) {
      const points = collectRoutePoints(chain);
      return { points, distance: pathLength(points) };
    }
  }

  // A* over the Voronoi cell graph.
  //   On-road fallback: road cells get a discount so the path seeks out roads.
  //   Off-road:         road cells get a penalty so the path avoids roads.
  const getCost = (a: number, b: number): number => {
    if (!isLand(b, pack) && b !== to && b !== from) return Infinity;
    const base = dist(pointOf(a), pointOf(b));
    if (cellHasRoute(b)) return base * (avoidRoads ? OFF_ROAD_PENALTY : ON_ROAD_DISCOUNT);
    return base;
  };
  const pathCells = findPathAStar(from, to, getCost);
  if (!pathCells || pathCells.length < 2) {
    return {
      points: [],
      distance: 0,
      errorCode: "no-land-path",
      warning: "No land route found between these cells — they may be on different landmasses."
    };
  }
  const points = pathCells.map(pointOf);
  return {
    points,
    distance: pathLength(points),
    warning: avoidRoads ? undefined : "Segment leaves the road network"
  };
};

const buildWater = (from: number, to: number): PathfindingResult => {
  const getCost = (a: number, b: number): number => {
    if (isLand(b, pack) && b !== to && b !== from) return Infinity;
    const gridCell = pack.cells.g[b];
    if (grid.cells.temp[gridCell] < MIN_PASSABLE_SEA_TEMP) return Infinity;
    return dist(pointOf(a), pointOf(b));
  };
  const pathCells = findPathAStar(from, to, getCost);
  if (!pathCells || pathCells.length < 2) {
    return {
      points: [],
      distance: 0,
      errorCode: "no-water-path",
      warning: "No sea route found between these cells — they may be in different bodies of water."
    };
  }
  const points = pathCells.map(pointOf);
  return { points, distance: pathLength(points) };
};

class JourneysModule {
  getTransportType(name: string): TransportType | undefined {
    return pack.transportTypes.find(t => t.name === name);
  }

  /** Domain of the named transport type; unknown types are treated as unrestricted. */
  getDomain(name: string): TransportDomain {
    return this.getTransportType(name)?.domain ?? "air";
  }

  /**
   * Is the given cell a valid endpoint for the given transport domain?
   *   land:  cell must be on land (coastal land is fine because you can board/disembark there)
   *   water: cell must be water, OR coastal-land (so a boat can be boarded from the shore)
   *   air:   any cell
   */
  isValidEndpoint(cellId: number, domain: TransportDomain): boolean {
    if (cellId === undefined || cellId === null) return false;
    if (domain === "air" || domain === "stay") return true;
    if (domain === "land") return isLand(cellId, pack);
    // water
    if (!isLand(cellId, pack)) return true;
    return isCoastalLand(cellId);
  }

  /**
   * Is the cell valid for an *intermediate* point on a path of this domain?
   *
   * Stricter than endpoint validation: a water route may legitimately start or end
   * on a coastal land cell (you board the boat from shore), but it must not run
   * overland mid-route. Land routes must stay on land throughout.
   */
  isValidPathPoint(cellId: number, domain: TransportDomain): boolean {
    if (cellId === undefined || cellId === null) return false;
    if (domain === "air" || domain === "stay") return true;
    if (domain === "land") return isLand(cellId, pack);
    return !isLand(cellId, pack);
  }

  describeCell(cellId: number): string {
    if (cellId === undefined || cellId === null) return "no cell";
    if (!isLand(cellId, pack)) return `water cell ${cellId}`;
    if (isCoastalLand(cellId)) return `coastal land cell ${cellId}`;
    return `inland land cell ${cellId}`;
  }

  findPath(from: number, to: number, domain: TransportDomain, options: JourneyPathOptions = {}): PathfindingResult {
    if (from === to) return { points: [pointOf(from)], distance: 0 };

    // Domain gate: refuse before pathfinding when endpoints obviously don't match.
    if (domain === "land") {
      if (!isLand(from, pack) || !isLand(to, pack)) {
        return {
          points: [],
          distance: 0,
          errorCode: "no-land",
          warning: "Land transport can only travel between land cells. At least one endpoint is in water."
        };
      }
    } else if (domain === "water") {
      const fromOk = !isLand(from, pack) || isCoastalLand(from);
      const toOk = !isLand(to, pack) || isCoastalLand(to);
      if (!fromOk || !toOk) {
        return {
          points: [],
          distance: 0,
          errorCode: "no-water",
          warning:
            "Water transport needs a water cell (or a coastal cell touching water) at both ends. At least one endpoint is inland."
        };
      }
    }

    if (domain === "air" || domain === "stay") return buildDirect(from, to);
    if (domain === "water") return buildWater(from, to);
    return buildLand(from, to, options.avoidRoads);
  }

  /** Ensure the pack carries the journey collections; safe to call repeatedly. */
  sync(): void {
    if (!pack.journeys) pack.journeys = [];
    if (!pack.transportTypes?.length) pack.transportTypes = getDefaultTransportTypes();
  }

  getNextId(): number {
    return pack.journeys.length ? Math.max(...pack.journeys.map(j => j.i)) + 1 : 0;
  }

  // New journeys carry no colour so they follow the layer style until overridden.
  create(): Journey {
    this.sync();
    const i = this.getNextId();
    const journey: Journey = { i, name: `Journey ${i + 1}`, visible: true, segments: [] };
    pack.journeys.push(journey);
    return journey;
  }

  remove(journeyId: number): void {
    pack.journeys = pack.journeys.filter(j => j.i !== journeyId);
  }

  /**
   * On a fresh random map, seed one demo journey so the Journeys layer is not
   * empty when a user first opens it. Picks two capitals (or largest burgs)
   * on the same landmass and routes overland between them.
   *
   * Skipped when journeys already exist (loaded save, template map) or when
   * the map has fewer than 2 usable burgs.
   */
  generateDemo(): void {
    this.sync();
    if (pack.journeys.length) return;

    const burgs = (pack.burgs ?? []).filter(b => b?.i && !b.removed && b.cell !== undefined);
    if (burgs.length < 2) return;

    const capitals = burgs.filter(b => b.capital);
    const pool = capitals.length >= 2 ? capitals : [...burgs].sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

    const overland = pack.transportTypes.find(t => t.domain === "land");
    if (!overland) return;

    for (let i = 0; i < Math.min(pool.length, 6); i++) {
      for (let j = i + 1; j < Math.min(pool.length, 6); j++) {
        const from = pool[i].cell;
        const to = pool[j].cell;
        const result = this.findPath(from, to, "land");
        if (result.errorCode || result.points.length < 2) continue;

        const seg: Segment = {
          id: 0,
          name: `${pool[i].name ?? "Start"} → ${pool[j].name ?? "End"}`,
          visible: true,
          from,
          to,
          transportType: overland.name,
          speed: overland.speed,
          distance: result.distance,
          points: result.points
        };
        pack.journeys.push({ i: 0, name: "Sample Journey", visible: true, segments: [seg] });
        return;
      }
    }
  }
}

type JourneysModuleType = JourneysModule;
declare global {
  var Journeys: JourneysModuleType;
}

window.Journeys = new JourneysModule();
