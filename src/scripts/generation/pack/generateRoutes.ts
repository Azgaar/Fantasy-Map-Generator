import Delaunator from "delaunator";
import FlatQueue from "flatqueue";

import {TIME} from "config/logging";
import {ROUTES} from "config/generation";
import {dist2} from "utils/functionUtils";
import {drawLine} from "utils/debugUtils";

export function generateRoutes(burgs: TBurgs, cells: Pick<IPack["cells"], "c" | "h" | "biome" | "state" | "burg">) {
  const cellRoutes = new Uint8Array(cells.h.length);
  const validBurgs = burgs.filter(burg => burg.i && !(burg as IBurg).removed) as IBurg[];
  const mainRoads = generateMainRoads();
  const trails = generateTrails();
  // const oceanRoutes = getSearoutes();

  const routes = combineRoutes();

  console.log(routes);
  return {cellRoutes, routes};

  function generateMainRoads() {
    TIME && console.time("generateMainRoads");
    const mainRoads: {feature: number; cells: number[]}[] = [];

    const capitalsByFeature = validBurgs.reduce((acc, burg) => {
      const {capital, feature} = burg;
      if (!capital) return acc;
      if (!acc[feature]) acc[feature] = [];
      acc[feature].push(burg);
      return acc;
    }, {} as {[feature: string]: IBurg[]});

    for (const [key, featureCapitals] of Object.entries(capitalsByFeature)) {
      const points: TPoints = featureCapitals.map(burg => [burg.x, burg.y]);
      const urquhartEdges = calculateUrquhartEdges(points);
      urquhartEdges.forEach(([fromId, toId]) => {
        drawLine(points[fromId], points[toId], {stroke: "red", strokeWidth: 0.03});

        const start = featureCapitals[fromId].cell;
        const exit = featureCapitals[toId].cell;

        const segments = findLandPathSegments(cellRoutes, start, exit);
        for (const segment of segments) {
          segment.forEach(cellId => {
            cellRoutes[cellId] = ROUTES.MAIN_ROAD;
          });
          mainRoads.push({feature: Number(key), cells: segment});
        }
      });
    }

    TIME && console.timeEnd("generateMainRoads");
    return mainRoads;
  }

  function generateTrails() {
    TIME && console.time("generateTrails");

    const trails: {feature: number; cells: number[]}[] = [];

    const burgsByFeature = validBurgs.reduce((acc, burg) => {
      const {feature} = burg;
      if (!acc[feature]) acc[feature] = [];
      acc[feature].push(burg);
      return acc;
    }, {} as {[feature: string]: IBurg[]});

    for (const [key, featureBurgs] of Object.entries(burgsByFeature)) {
      const points: TPoints = featureBurgs.map(burg => [burg.x, burg.y]);
      const urquhartEdges = calculateUrquhartEdges(points);
      urquhartEdges.forEach(([fromId, toId]) => {
        drawLine(points[fromId], points[toId], {strokeWidth: 0.03});

        const start = featureBurgs[fromId].cell;
        const exit = featureBurgs[toId].cell;

        const segments = findLandPathSegments(cellRoutes, start, exit);
        for (const segment of segments) {
          segment.forEach(cellId => {
            cellRoutes[cellId] = ROUTES.TRAIL;
          });
          trails.push({feature: Number(key), cells: segment});
        }
      });
    }

    TIME && console.timeEnd("generateTrails");
    return trails;
  }

  // find land route segments from cell to cell
  function findLandPathSegments(cellRoutes: Uint8Array, start: number, exit: number): number[][] {
    const from = findPath();
    if (!from) return [];

    const pathCells = restorePath(start, exit, from);
    const segments = getRouteSegments(pathCells, cellRoutes);
    return segments;

    function findPath() {
      const from: number[] = [];
      const cost: number[] = [];
      const queue = new FlatQueue<number>();
      queue.push(start, 0);

      while (queue.length) {
        const priority = queue.peekValue()!;
        const next = queue.pop()!;

        for (const neibCellId of cells.c[next]) {
          if (cells.h[neibCellId] < 20) continue; // ignore water cells
          const stateChangeCost = cells.state && cells.state[neibCellId] !== cells.state[next] ? 400 : 0; // prefer to lay within the same state
          const habitability = biomesData.habitability[cells.biome[neibCellId]];
          if (!habitability) continue; // avoid inhabitable cells (eg. lava, glacier)
          const habitedCost = habitability ? Math.max(100 - habitability, 0) : 400; // routes tend to lay within populated areas
          const heightChangeCost = Math.abs(cells.h[neibCellId] - cells.h[next]) * 10; // routes tend to avoid elevation changes
          const heightCost = cells.h[neibCellId] > 80 ? cells.h[neibCellId] : 0; // routes tend to avoid mountainous areas
          const cellCoast = 10 + stateChangeCost + habitedCost + heightChangeCost + heightCost;
          const totalCost = priority + (cellRoutes[neibCellId] || cells.burg[neibCellId] ? cellCoast / 3 : cellCoast);

          if (from[neibCellId] || totalCost >= cost[neibCellId]) continue;
          from[neibCellId] = next;

          if (neibCellId === exit) return from;

          cost[neibCellId] = totalCost;
          queue.push(neibCellId, totalCost);
        }
      }

      return null; // path is not found
    }
  }

  function combineRoutes() {
    const routes: TRoutes = [];

    for (const {feature, cells} of mainRoads) {
      routes.push({i: routes.length, type: "road", feature, cells});
    }

    for (const {feature, cells} of trails) {
      routes.push({i: routes.length, type: "trail", feature, cells});
    }

    return routes;
  }
}

function restorePath(start: number, end: number, from: number[]) {
  const cells: number[] = [];

  let current = end;
  let prev = end;

  while (current !== start) {
    cells.push(current);
    prev = from[current];
    current = prev;
  }

  cells.push(current);

  return cells;
}

function getRouteSegments(pathCells: number[], cellRoutes: Uint8Array) {
  const hasRoute = (cellId: number) => cellRoutes[cellId] !== 0;
  const noRoute = (cellId: number) => cellRoutes[cellId] === 0;

  const segments: number[][] = [];
  let segment: number[] = [];

  // UC: complitely new route
  if (pathCells.every(noRoute)) return [pathCells];

  // UC: only first and/or last cell have route
  if (pathCells.slice(1, -1).every(noRoute)) return [pathCells];

  // UC: all cells already have route
  if (pathCells.every(hasRoute)) return [];

  // UC: discontinuous route
  for (let i = 0; i < pathCells.length; i++) {
    const cellId = pathCells[i];
    const nextCellId = pathCells[i + 1];

    const hasRoute = cellRoutes[cellId] !== 0;
    const nextHasRoute = cellRoutes[nextCellId] !== 0;

    const noConnection = !hasRoute || !nextHasRoute;
    if (noConnection) segment.push(cellId);
  }

  return segments;
}

// Urquhart graph is obtained by removing the longest edge from each triangle in the Delaunay triangulation
// this gives us an aproximation of a desired road network, i.e. connections between burgs
// code from https://observablehq.com/@mbostock/urquhart-graph
function calculateUrquhartEdges(points: TPoints) {
  const score = (p0: number, p1: number) => dist2(points[p0], points[p1]);

  const {halfedges, triangles} = Delaunator.from(points);
  const n = triangles.length;

  const removed = new Uint8Array(n);
  const edges = [];

  for (let e = 0; e < n; e += 3) {
    const p0 = triangles[e],
      p1 = triangles[e + 1],
      p2 = triangles[e + 2];

    const p01 = score(p0, p1),
      p12 = score(p1, p2),
      p20 = score(p2, p0);

    removed[
      p20 > p01 && p20 > p12
        ? Math.max(e + 2, halfedges[e + 2])
        : p12 > p01 && p12 > p20
        ? Math.max(e + 1, halfedges[e + 1])
        : Math.max(e, halfedges[e])
    ] = 1;
  }

  for (let e = 0; e < n; ++e) {
    if (e > halfedges[e] && !removed[e]) {
      const t0 = triangles[e];
      const t1 = triangles[e % 3 === 2 ? e - 2 : e + 1];
      edges.push([t0, t1]);
    }
  }

  return edges;
}
