import type { Route } from "@/generators/routes-generator";
import type { JourneyPoint, TransportDomain } from "@/types/Journey";
import { isLand } from "@/utils";

const MIN_PASSABLE_SEA_TEMP = -5;

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

export interface PathfindingResult {
  points: JourneyPoint[];
  distance: number;
  warning?: string;
  errorCode?: "no-water" | "no-land" | "no-water-path" | "no-land-path";
}

// ---- domain-aware endpoint validation ---------------------------------

const isCoastalLand = (cellId: number): boolean => {
  if (!isLand(cellId, pack)) return false;
  const neighbours = pack.cells.c[cellId] || [];
  return neighbours.some(n => !isLand(n, pack));
};

/**
 * Is the given cell a valid endpoint for the given transport domain?
 *   land:  cell must be on land (coastal land is fine because you can board/disembark there)
 *   water: cell must be water, OR coastal-land (so a boat can be boarded from the shore)
 *   air:   any cell
 */
export function isValidEndpointForDomain(cellId: number, domain: TransportDomain): boolean {
  if (cellId === undefined || cellId === null) return false;
  if (domain === "air") return true;
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
export function isValidPathPointForDomain(cellId: number, domain: TransportDomain): boolean {
  if (cellId === undefined || cellId === null) return false;
  if (domain === "air") return true;
  if (domain === "land") return isLand(cellId, pack);
  return !isLand(cellId, pack);
}

export function describeCell(cellId: number): string {
  if (cellId === undefined || cellId === null) return "no cell";
  const land = isLand(cellId, pack);
  if (!land) return `water cell ${cellId}`;
  if (isCoastalLand(cellId)) return `coastal land cell ${cellId}`;
  return `inland land cell ${cellId}`;
}

// ---- helpers ----------------------------------------------------------

const pointOf = (cellId: number): JourneyPoint => {
  const [x, y] = pack.cells.p[cellId];
  return [x, y, cellId];
};

const dist = (a: JourneyPoint, b: JourneyPoint): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Total length in px of a point chain. Exported so manual path edits can recalculate distance. */
export const pathLength = (points: JourneyPoint[]): number => {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
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

// On-road: road cells are cheaper — the pathfinder detours to use them.
// 0.5 means road travel costs half as much, matching the 2× speed advantage.
const ON_ROAD_DISCOUNT = 0.5;

// Off-road: road cells are more expensive — the pathfinder routes around them.
const OFF_ROAD_PENALTY = 5;

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

export interface JourneyPathOptions {
  /** Land-domain only: if true, avoid the road network (cost-penalise road cells). */
  avoidRoads?: boolean;
}

export function findJourneyPath(
  from: number,
  to: number,
  domain: TransportDomain,
  options: JourneyPathOptions = {}
): PathfindingResult {
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

  if (domain === "air") return buildDirect(from, to);
  if (domain === "water") return buildWater(from, to);
  return buildLand(from, to, options.avoidRoads);
}
