import Delaunator from "delaunator";
import FlatQueue from "flatqueue";

import {TIME} from "config/logging";
import {ELEVATION, MIN_LAND_HEIGHT, ROUTES} from "config/generation";
import {dist2} from "utils/functionUtils";

export function generateRoutes(
  burgs: TBurgs,
  cells: Pick<IPack["cells"], "c" | "p" | "h" | "biome" | "state" | "burg">
) {
  const cellRoutes = new Uint8Array(cells.h.length);
  const validBurgs = burgs.filter(burg => burg.i && !(burg as IBurg).removed) as IBurg[];
  const connections: Map<string, boolean> = new Map();

  const mainRoads = generateMainRoads();
  const trails = generateTrails();
  // const oceanRoutes = getSearoutes();

  const routes = combineRoutes();
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
        const start = featureCapitals[fromId].cell;
        const exit = featureCapitals[toId].cell;

        const segments = findLandPathSegments(cellRoutes, connections, start, exit);
        for (const segment of segments) {
          addConnections(segment, ROUTES.MAIN_ROAD);
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
        const start = featureBurgs[fromId].cell;
        const exit = featureBurgs[toId].cell;

        const segments = findLandPathSegments(cellRoutes, connections, start, exit);
        for (const segment of segments) {
          addConnections(segment, ROUTES.TRAIL);
          trails.push({feature: Number(key), cells: segment});
        }
      });
    }

    TIME && console.timeEnd("generateTrails");
    return trails;
  }

  function addConnections(segment: number[], roadTypeId: number) {
    for (let i = 0; i < segment.length; i++) {
      const cellId = segment[i];
      const nextCellId = segment[i + 1];
      if (nextCellId) connections.set(`${cellId}-${nextCellId}`, true);
      cellRoutes[cellId] = roadTypeId;
    }
  }

  // find land route segments from cell to cell
  function findLandPathSegments(
    cellRoutes: Uint8Array,
    connections: Map<string, boolean>,
    start: number,
    exit: number
  ): number[][] {
    const from = findPath();
    if (!from) return [];

    const pathCells = restorePath(start, exit, from);
    const segments = getRouteSegments(pathCells, connections);
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
          if (cells.h[neibCellId] < MIN_LAND_HEIGHT) continue; // ignore water cells

          const habitability = biomesData.habitability[cells.biome[neibCellId]];
          if (!habitability) continue; // inhabitable cells are not passable (eg. lava, glacier)

          const distanceCost = dist2(cells.p[next], cells.p[neibCellId]);

          const habitabilityModifier = 1 + Math.max(100 - habitability, 0) / 1000; // [1, 1.1];
          const heightModifier = 1 + Math.max(cells.h[neibCellId] - ELEVATION.HILLS, 0) / 500; // [1, 1.1];
          const roadModifier = cellRoutes[neibCellId] ? 0.5 : 1;
          const burgModifier = cells.burg[neibCellId] ? 0.5 : 1;

          const cellsCost = distanceCost * habitabilityModifier * heightModifier * roadModifier * burgModifier;
          const totalCost = priority + cellsCost;

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

function getRouteSegments(pathCells: number[], connections: Map<string, boolean>) {
  const segments: number[][] = [];
  let segment: number[] = [];

  // if (pathCells.includes(5204)) debugger;

  for (let i = 0; i < pathCells.length; i++) {
    const cellId = pathCells[i];
    const nextCellId = pathCells[i + 1];
    const isConnected = connections.has(`${cellId}-${nextCellId}`) || connections.has(`${nextCellId}-${cellId}`);

    if (isConnected) {
      if (segment.length) {
        // segment stepped into existing segment
        segment.push(pathCells[i]);
        segments.push(segment);
        segment = [];
      }
      continue;
    }

    segment.push(pathCells[i]);
  }

  if (segment.length) segments.push(segment);

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
