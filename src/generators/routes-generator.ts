import { curveCatmullRom, line } from "d3";
import Delaunator from "delaunator";
import { distanceSquared, findClosestCell, findPath, getAdjective, isLand, ra, rn, round, rw } from "../utils";
import { meander } from "../utils/pathUtils";
import type { Burg } from "./burgs-generator";
import type { River } from "./river-generator";
import type { Point } from "./voronoi";

const ROUTES_SHARP_ANGLE = 135;
const ROUTES_VERY_SHARP_ANGLE = 115;

export const MIN_PASSABLE_SEA_TEMP = -4;
const RIVER_TYPE_MODIFIER = 1.5;
const ROUTE_TYPE_MODIFIERS: Record<string, number> = {
  "-1": 1, // coastline
  "-2": 1.8, // sea
  "-3": 4, // open sea
  "-4": 6, // ocean
  default: 8 // far ocean
};

// name generator data
const models: Record<string, Record<string, number>> = {
  roads: {
    burg_suffix: 3,
    prefix_suffix: 6,
    the_descriptor_prefix_suffix: 2,
    the_descriptor_burg_suffix: 1
  },
  trails: { burg_suffix: 8, prefix_suffix: 1, the_descriptor_burg_suffix: 1 },
  searoutes: {
    burg_suffix: 4,
    prefix_suffix: 2,
    the_descriptor_prefix_suffix: 1
  }
};

const prefixes: string[] = [
  "King",
  "Queen",
  "Military",
  "Old",
  "New",
  "Ancient",
  "Royal",
  "Imperial",
  "Great",
  "Grand",
  "High",
  "Silver",
  "Dragon",
  "Shadow",
  "Star",
  "Mystic",
  "Whisper",
  "Eagle",
  "Golden",
  "Crystal",
  "Enchanted",
  "Frost",
  "Moon",
  "Sun",
  "Thunder",
  "Phoenix",
  "Sapphire",
  "Celestial",
  "Wandering",
  "Echo",
  "Twilight",
  "Crimson",
  "Serpent",
  "Iron",
  "Forest",
  "Flower",
  "Whispering",
  "Eternal",
  "Frozen",
  "Rain",
  "Luminous",
  "Stardust",
  "Arcane",
  "Glimmering",
  "Jade",
  "Ember",
  "Azure",
  "Gilded",
  "Divine",
  "Shadowed",
  "Cursed",
  "Moonlit",
  "Sable",
  "Everlasting",
  "Amber",
  "Nightshade",
  "Wraith",
  "Scarlet",
  "Platinum",
  "Whirlwind",
  "Obsidian",
  "Ethereal",
  "Ghost",
  "Spike",
  "Dusk",
  "Raven",
  "Spectral",
  "Burning",
  "Verdant",
  "Copper",
  "Velvet",
  "Falcon",
  "Enigma",
  "Glowing",
  "Silvered",
  "Molten",
  "Radiant",
  "Astral",
  "Wild",
  "Flame",
  "Amethyst",
  "Aurora",
  "Shadowy",
  "Solar",
  "Lunar",
  "Whisperwind",
  "Fading",
  "Titan",
  "Dawn",
  "Crystalline",
  "Jeweled",
  "Sylvan",
  "Twisted",
  "Ebon",
  "Thorn",
  "Cerulean",
  "Halcyon",
  "Infernal",
  "Storm",
  "Eldritch",
  "Sapphire",
  "Crimson",
  "Tranquil",
  "Paved"
];

const descriptors = [
  "Great",
  "Shrouded",
  "Sacred",
  "Fabled",
  "Frosty",
  "Winding",
  "Echoing",
  "Serpentine",
  "Breezy",
  "Misty",
  "Rustic",
  "Silent",
  "Cobbled",
  "Cracked",
  "Shaky",
  "Obscure"
];

const suffixes: Record<string, Record<string, number>> = {
  roads: { road: 7, route: 3, way: 2, highway: 1 },
  trails: { trail: 4, path: 1, track: 1, pass: 1 },
  searoutes: { route: 5, lane: 2, passage: 1, "water way": 1 }
};

export interface Route {
  i: number;
  group: string;
  feature: number;
  points: number[][];
  cells?: number[];
  merged?: boolean;
  name?: string;
  length?: number;
  lock?: boolean;
}

type RiverEdge = { riverId: number; fromIndex: number };

type RiverRun = {
  startIdx: number; // first route-cell index of the run
  endIdx: number; // last route-cell index of the run (shared with the next run at confluences)
  riverId: number;
  direction: 1 | -1; // +1 if the route runs downstream (source->mouth), -1 if upstream
  firstCanonicalIndexInRiver: number; // river.cells index of the run's source-most cell
};

class RoutesModule {
  private connections: Map<string, boolean> = new Map();
  private riverEdges: Map<number, Map<number, RiverEdge>> = new Map();
  private riversById: Map<number, River> = new Map();
  private riverGeometryCache: Map<number, { points: Point[]; anchorIndices: number[] }> = new Map();

  generate(lockedRoutes: Route[] = []) {
    this.connections = new Map();
    this.buildRiverEdges();
    lockedRoutes.forEach((route: Route) => {
      this.addConnections(route.points.map(p => p[2]));
    });

    pack.routes = this.createRoutesData(lockedRoutes);
    pack.cells.routes = this.buildLinks(pack.routes);
  }

  private sortBurgsByFeature(burgs: Burg[]) {
    const burgsByFeature: Record<number, Burg[]> = {};
    const capitalsByFeature: Record<number, Burg[]> = {};
    const portsByFeature: Record<number, Burg[]> = {};

    const addBurg = (collection: Record<number, Burg[]>, feature: number, burg: Burg) => {
      if (!collection[feature]) collection[feature] = [];
      collection[feature].push(burg);
    };

    for (const burg of burgs) {
      if (burg.i && !burg.removed) {
        const { feature, capital, port } = burg;
        if (feature === undefined) continue;
        addBurg(burgsByFeature, feature, burg);
        if (capital) addBurg(capitalsByFeature, feature, burg);
        if (port) addBurg(portsByFeature, port, burg);
      }
    }

    return { burgsByFeature, capitalsByFeature, portsByFeature };
  }

  // Urquhart graph is obtained by removing the longest edge from each triangle in the Delaunay triangulation
  // this gives us an aproximation of a desired road network, i.e. connections between burgs
  // code from https://observablehq.com/@mbostock/urquhart-graph
  private calculateUrquhartEdges(points: Point[]) {
    if (points.length < 2) return []; // No connection for less than 2 points
    if (points.length === 2) return [[0, 1]]; // Direct connection for exactly two points

    const score = (p0: number, p1: number) => distanceSquared(points[p0], points[p1]);

    const { halfedges, triangles } = Delaunator.from(points);
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

  getLandPathCost(current: number, next: number) {
    if (pack.cells.h[next] < 20) return Infinity; // ignore water cells

    const habitability = biomesData.habitability[pack.cells.biome[next]];
    if (!habitability) return Infinity; // inhabitable cells are not passable (e.g. glacier)

    const distanceCost = distanceSquared(pack.cells.p[current], pack.cells.p[next]);
    const habitabilityModifier = 1 + Math.max(100 - habitability, 0) / 1000; // [1, 1.1];
    const heightModifier = 1 + Math.max(pack.cells.h[next] - 25, 25) / 25; // [1, 3];
    const connectionModifier = this.connections.has(`${current}-${next}`) ? 0.5 : 1;
    const burgModifier = pack.cells.burg[next] ? 1 : 3;

    const pathCost = distanceCost * habitabilityModifier * heightModifier * connectionModifier * burgModifier;
    return pathCost;
  }

  getWaterPathCost(current: number, next: number) {
    const { h, r, p, t, g } = pack.cells;
    const connectionModifier = this.connections.has(`${current}-${next}`) ? 0.5 : 1;

    if (h[next] >= 20) {
      // land cell: only navigable via a river, and only along the actual river course
      if (!Rivers.isNavigable(next)) return Infinity;
      if (!this.riverEdges.get(current)?.has(next)) return Infinity;
      return distanceSquared(p[current], p[next]) * RIVER_TYPE_MODIFIER * connectionModifier;
    }

    // leaving a land cell into water
    if (h[current] >= 20) {
      if (r[current]) {
        // river-land cell: must follow the river's recorded outlet
        if (!this.riverEdges.get(current)?.has(next)) return Infinity;
      } else {
        // coastal port cell: must leave through its haven, the water cell the burg was shifted
        // towards — otherwise the rendered route cuts across the land to reach the burg
        const haven = pack.cells.haven?.[current];
        if (haven && haven !== next) return Infinity;
      }
    }
    if (grid.cells.temp[g[next]] < MIN_PASSABLE_SEA_TEMP) return Infinity;

    const distanceCost = distanceSquared(p[current], p[next]);
    const typeModifier = ROUTE_TYPE_MODIFIERS[t[next]] || ROUTE_TYPE_MODIFIERS.default;
    return distanceCost * typeModifier * connectionModifier;
  }

  private createCostEvaluator({ isWater }: { isWater: boolean }) {
    return isWater ? this.getWaterPathCost.bind(this) : this.getLandPathCost.bind(this);
  }

  private getRouteSegments(pathCells: number[]) {
    const segments = [];
    let segment = [];

    for (let i = 0; i < pathCells.length; i++) {
      const cellId = pathCells[i];
      const nextCellId = pathCells[i + 1];
      const isConnected =
        this.connections.has(`${cellId}-${nextCellId}`) || this.connections.has(`${nextCellId}-${cellId}`);

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

    if (segment.length > 1) segments.push(segment);

    return segments;
  }

  private findPathSegments({ isWater, start, exit }: { isWater: boolean; start: number; exit: number }) {
    const getCost = this.createCostEvaluator({ isWater });
    const isExit = isWater
      ? (next: number, current?: number) => {
          if (next !== exit) return false;
          if (current === undefined) return true;
          // river port: approach along the river course
          if (this.riverEdges.get(current)?.has(next)) return true;
          // coastal port: approach only over water, through the haven the burg was shifted towards
          if (pack.cells.h[current] >= 20) return false;
          const haven = pack.cells.haven?.[exit];
          return !haven || current === haven;
        }
      : (next: number) => next === exit;
    const pathCells = findPath(start, isExit, getCost, pack);
    if (!pathCells) return [];
    const segments = this.getRouteSegments(pathCells);
    return segments;
  }

  private generateMainRoads() {
    TIME && console.time("generateMainRoads");
    const { capitalsByFeature } = this.sortBurgsByFeature(pack.burgs);
    const mainRoads: Route[] = [];

    for (const [key, featureCapitals] of Object.entries(capitalsByFeature)) {
      const points = featureCapitals.map(burg => [burg.x, burg.y] as Point);
      const urquhartEdges = this.calculateUrquhartEdges(points);
      urquhartEdges.forEach(([fromId, toId]) => {
        const start = featureCapitals[fromId].cell;
        const exit = featureCapitals[toId].cell;

        const segments = this.findPathSegments({ isWater: false, start, exit });
        for (const segment of segments) {
          this.addConnections(segment);
          mainRoads.push({ feature: Number(key), cells: segment } as Route);
        }
      });
    }

    TIME && console.timeEnd("generateMainRoads");
    return mainRoads;
  }

  private addConnections(segment: number[]) {
    for (let i = 0; i < segment.length; i++) {
      const cellId = segment[i];
      const nextCellId = segment[i + 1];
      if (nextCellId) {
        this.connections.set(`${cellId}-${nextCellId}`, true);
        this.connections.set(`${nextCellId}-${cellId}`, true);
      }
    }
  }

  private generateTrails() {
    TIME && console.time("generateTrails");
    const { burgsByFeature } = this.sortBurgsByFeature(pack.burgs);
    const trails: Route[] = [];

    for (const [key, featureBurgs] of Object.entries(burgsByFeature)) {
      const points = featureBurgs.map(burg => [burg.x, burg.y] as Point);
      const urquhartEdges = this.calculateUrquhartEdges(points);
      urquhartEdges.forEach(([fromId, toId]) => {
        const start = featureBurgs[fromId].cell;
        const exit = featureBurgs[toId].cell;

        const segments = this.findPathSegments({ isWater: false, start, exit });
        for (const segment of segments) {
          this.addConnections(segment);
          trails.push({ feature: Number(key), cells: segment } as Route);
        }
      });
    }

    TIME && console.timeEnd("generateTrails");
    return trails;
  }

  private generateSeaRoutes() {
    TIME && console.time("generateSeaRoutes");
    const { portsByFeature } = this.sortBurgsByFeature(pack.burgs);
    const seaRoutes: Route[] = [];

    for (const [featureId, featurePorts] of Object.entries(portsByFeature)) {
      const points = featurePorts.map(burg => [burg.x, burg.y] as Point);
      const urquhartEdges = this.calculateUrquhartEdges(points);

      urquhartEdges.forEach(([fromId, toId]) => {
        const start = featurePorts[fromId].cell;
        const exit = featurePorts[toId].cell;
        const segments = this.findPathSegments({ isWater: true, start, exit });
        for (const segment of segments) {
          this.addConnections(segment);
          seaRoutes.push({ feature: Number(featureId), cells: segment } as Route);
        }
      });
    }

    TIME && console.timeEnd("generateSeaRoutes");
    return seaRoutes;
  }

  private preparePointsArray(): Point[] {
    const { cells, burgs } = pack;
    return cells.p.map(([x, y], cellId) => {
      const burgId = cells.burg[cellId];
      if (burgId) return [burgs[burgId].x, burgs[burgId].y];
      return [x, y];
    });
  }

  // Group consecutive route cells that follow a single river in one direction into maximal runs.
  // A run ends at a confluence (riverId change) or when the route leaves the river course; the
  // confluence cell is shared as the last cell of one run and the first of the next.
  private findRiverRuns(cells: number[]): RiverRun[] {
    const runs: RiverRun[] = [];

    let k = 0;
    while (k < cells.length - 1) {
      const edge = this.riverEdges.get(cells[k])?.get(cells[k + 1]);
      const reverseEdge = edge ? this.riverEdges.get(cells[k + 1])?.get(cells[k]) : undefined;
      if (!edge || !reverseEdge) {
        k++;
        continue;
      }

      const direction: 1 | -1 = reverseEdge.fromIndex === edge.fromIndex + 1 ? 1 : -1;
      const { riverId } = edge;
      let endIdx = k + 1;
      let prevToIndex = reverseEdge.fromIndex;

      // Extend the run while each step stays on the same river, contiguous and same-direction.
      while (endIdx + 1 < cells.length) {
        const ahead = this.riverEdges.get(cells[endIdx])?.get(cells[endIdx + 1]);
        if (!ahead || ahead.riverId !== riverId || ahead.fromIndex !== prevToIndex) break;
        const aheadReverse = this.riverEdges.get(cells[endIdx + 1])?.get(cells[endIdx]);
        if (!aheadReverse || aheadReverse.fromIndex - ahead.fromIndex !== direction) break;
        prevToIndex = aheadReverse.fromIndex;
        endIdx++;
      }

      const firstCanonicalIndexInRiver = direction === 1 ? edge.fromIndex : prevToIndex;
      runs.push({ startIdx: k, endIdx, riverId, direction, firstCanonicalIndexInRiver });
      k = endIdx;
    }

    return runs;
  }

  private getRiverGeometry(river: River): { points: Point[]; anchorIndices: number[] } {
    const cached = this.riverGeometryCache.get(river.i);
    if (cached) return cached;

    const { h, p } = pack.cells;
    const geometry = meander(river.cells, p, {
      anchors: river.points ?? undefined,
      meandering: 0.5,
      startStep: h[river.cells[0]] < 20 ? 1 : 10,
      isWaterCell: river.cells.map(c => c !== -1 && h[c] < 20),
      bounds: { width: graphWidth, height: graphHeight }
    });

    this.riverGeometryCache.set(river.i, geometry);
    return geometry;
  }

  private emitRiverRun(run: RiverRun, cells: number[], result: [number, number, number][]): void {
    const runCells = cells.slice(run.startIdx, run.endIdx + 1);
    const river = this.riversById.get(run.riverId);
    if (!river) return;

    const { points, anchorIndices } = this.getRiverGeometry(river);

    const lo = run.firstCanonicalIndexInRiver;
    const hi = lo + runCells.length - 1;
    const startPoint = anchorIndices[lo];
    const endPoint = anchorIndices[hi];
    let slicePoints: Point[] = points.slice(startPoint, endPoint + 1).map(point => [point[0], point[1]]);
    let sliceAnchorIndices = anchorIndices.slice(lo, hi + 1).map(idx => idx - startPoint);

    // Reverse for upstream routes so the output runs in route order.
    if (run.direction === -1) {
      const total = slicePoints.length;
      slicePoints = slicePoints.slice().reverse();
      sliceAnchorIndices = sliceAnchorIndices
        .slice()
        .reverse()
        .map(idx => total - 1 - idx);
    }

    let nextAnchorPtr = 0;
    let currentCellId = runCells[0];
    const skipFirst = result.length > 0 && result[result.length - 1][2] === runCells[0];
    for (let pk = 0; pk < slicePoints.length; pk++) {
      if (nextAnchorPtr < sliceAnchorIndices.length && sliceAnchorIndices[nextAnchorPtr] === pk) {
        currentCellId = runCells[nextAnchorPtr];
        nextAnchorPtr++;
      }
      if (pk === 0 && skipFirst) continue;
      result.push([slicePoints[pk][0], slicePoints[pk][1], currentCellId]);
    }
  }

  addMeandering(cells: number[], anchors: Point[]): [number, number, number][] {
    const runs = this.findRiverRuns(cells);
    const result: [number, number, number][] = [];
    let runPtr = 0;
    let i = 0;

    while (i < cells.length) {
      if (runPtr < runs.length && runs[runPtr].startIdx === i) {
        const run = runs[runPtr++];
        this.emitRiverRun(run, cells, result);
        i = run.endIdx; // the run's last cell may start the next run (confluence)
      } else {
        const alreadyEmitted = result.length > 0 && result[result.length - 1][2] === cells[i];
        if (!alreadyEmitted) result.push([anchors[i][0], anchors[i][1], cells[i]]);
        i++;
      }
    }

    return result;
  }

  private getPoints(group: string, cells: number[], points: Point[]) {
    if (group === "searoutes") {
      const anchors = cells.map(cellId => points[cellId]);
      return this.addMeandering(cells, anchors);
    }

    // resolve sharp angles
    const data = cells.map(cellId => [...points[cellId], cellId]);
    for (let i = 1; i < cells.length - 1; i++) {
      const cellId = cells[i];
      if (pack.cells.burg[cellId]) continue;

      const [prevX, prevY] = data[i - 1];
      const [currX, currY] = data[i];
      const [nextX, nextY] = data[i + 1];

      const dAx = prevX - currX;
      const dAy = prevY - currY;
      const dBx = nextX - currX;
      const dBy = nextY - currY;
      const angle = Math.abs((Math.atan2(dAx * dBy - dAy * dBx, dAx * dBx + dAy * dBy) * 180) / Math.PI);

      if (angle < ROUTES_SHARP_ANGLE) {
        const middleX = (prevX + nextX) / 2;
        const middleY = (prevY + nextY) / 2;
        let newX: number, newY: number;

        if (angle < ROUTES_VERY_SHARP_ANGLE) {
          newX = rn((currX + middleX * 2) / 3, 2);
          newY = rn((currY + middleY * 2) / 3, 2);
        } else {
          newX = rn((currX + middleX) / 2, 2);
          newY = rn((currY + middleY) / 2, 2);
        }

        if (findClosestCell(newX, newY, undefined, pack) === cellId) {
          data[i] = [newX, newY, cellId];
          points[cellId] = [data[i][0], data[i][1]]; // change cell coordinate for all routes
        }
      }
    }

    return data; // [[x, y, cell], [x, y, cell]];
  }

  // merge routes so that the last cell of one route is the first cell of the next route
  private mergeRoutes(routes: Route[]): Route[] {
    let routesMerged = 0;

    for (let i = 0; i < routes.length; i++) {
      const thisRoute = routes[i];
      if (thisRoute.merged) continue;

      for (let j = i + 1; j < routes.length; j++) {
        const nextRoute = routes[j];
        if (nextRoute.merged) continue;

        if (nextRoute.cells!.at(0) === thisRoute.cells!.at(-1)) {
          routesMerged++;
          thisRoute.cells = thisRoute.cells!.concat(nextRoute.cells!.slice(1));
          nextRoute.merged = true;
        }
      }
    }

    return routesMerged > 1 ? this.mergeRoutes(routes) : routes;
  }

  private createRoutesData(routes: Route[]) {
    const seaRoutes = this.generateSeaRoutes();
    const mainRoads = this.generateMainRoads();
    const trails = this.generateTrails();
    const pointsArray = this.preparePointsArray();

    for (const { feature, cells, merged } of this.mergeRoutes(mainRoads)) {
      if (merged) continue;
      const points = this.getPoints("roads", cells!, pointsArray);
      routes.push({ i: routes.length, group: "roads", feature, points });
    }

    for (const { feature, cells, merged } of this.mergeRoutes(trails)) {
      if (merged) continue;
      const points = this.getPoints("trails", cells!, pointsArray);
      routes.push({ i: routes.length, group: "trails", feature, points });
    }

    for (const { feature, cells, merged } of this.mergeRoutes(seaRoutes)) {
      if (merged) continue;
      const points = this.getPoints("searoutes", cells!, pointsArray);
      routes.push({ i: routes.length, group: "searoutes", feature, points });
    }

    return routes;
  }

  // direction-aware river graph derived from pack.rivers
  private buildRiverEdges() {
    this.riverEdges = new Map();
    this.riversById = new Map();
    this.riverGeometryCache = new Map();
    for (const river of pack.rivers) {
      this.riversById.set(river.i, river);
      if (!river.cells || river.cells.length < 2) continue;
      for (let i = 0; i < river.cells.length - 1; i++) {
        const a = river.cells[i];
        const b = river.cells[i + 1];
        if (a < 0 || b < 0) continue;
        if (!this.riverEdges.has(a)) this.riverEdges.set(a, new Map());
        if (!this.riverEdges.has(b)) this.riverEdges.set(b, new Map());
        this.riverEdges.get(a)!.set(b, { riverId: river.i, fromIndex: i });
        this.riverEdges.get(b)!.set(a, { riverId: river.i, fromIndex: i + 1 });
      }
    }
  }

  buildLinks(routes: Route[]): Record<number, Record<number, number>> {
    const links: Record<number, Record<number, number>> = {};

    for (const { points, i: routeId } of routes) {
      const cells = points.map(p => p[2]);

      for (let i = 0; i < cells.length - 1; i++) {
        const cellId = cells[i];
        const nextCellId = cells[i + 1];

        if (cellId !== nextCellId) {
          if (!links[cellId]) links[cellId] = {};
          links[cellId][nextCellId] = routeId;

          if (!links[nextCellId]) links[nextCellId] = {};
          links[nextCellId][cellId] = routeId;
        }
      }
    }

    return links;
  }

  // utility functions
  isConnected(cellId: number): boolean {
    const routes = pack.cells.routes;
    return routes[cellId] && Object.keys(routes[cellId]).length > 0;
  }

  getNextId() {
    return pack.routes.length ? Math.max(...pack.routes.map(r => r.i)) + 1 : 0;
  }

  // connect cell with routes system by land
  connect(cellId: number): Route | undefined {
    const getCost = this.createCostEvaluator({ isWater: false });
    const isExit = (c: number) => isLand(c, pack) && this.isConnected(c);
    const pathCells = findPath(cellId, isExit, getCost, pack);
    if (!pathCells) return;

    const pointsArray = this.preparePointsArray();
    const points = this.getPoints("trails", pathCells, pointsArray);
    const feature = pack.cells.f[cellId];
    const routeId = this.getNextId();
    const newRoute = { i: routeId, group: "trails", feature, points };
    pack.routes.push(newRoute as Route);

    const addConnection = (from: number, to: number, routeId: number) => {
      const routes = pack.cells.routes;

      if (!routes[from]) routes[from] = {};
      routes[from][to] = routeId;

      if (!routes[to]) routes[to] = {};
      routes[to][from] = routeId;
    };

    for (let i = 0; i < pathCells.length; i++) {
      const currentCell = pathCells[i];
      const nextCellId = pathCells[i + 1];
      if (nextCellId) addConnection(currentCell, nextCellId, routeId);
    }

    return newRoute as Route;
  }

  areConnected(from: number, to: number): boolean {
    const routeId = pack.cells.routes[from]?.[to];
    return routeId !== undefined;
  }

  getRoute(from: number, to: number) {
    const routeId = pack.cells.routes[from]?.[to];
    if (routeId === undefined) return null;

    const route = pack.routes.find(route => route.i === routeId);
    if (!route) return null;

    return route;
  }

  hasRoad(cellId: number): boolean {
    const connections = pack.cells.routes[cellId];
    if (!connections) return false;

    return Object.values(connections).some(routeId => {
      const route = pack.routes.find(route => route.i === routeId);
      if (!route) return false;
      return route.group === "roads";
    });
  }

  isCrossroad(cellId: number): boolean {
    const connections = pack.cells.routes[cellId];
    if (!connections) return false;
    if (Object.keys(connections).length > 3) return true;
    const roadConnections = Object.values(connections).filter(routeId => {
      const route = pack.routes.find(route => route.i === routeId);
      return route?.group === "roads";
    });
    return roadConnections.length > 2;
  }

  remove(route: Route) {
    const routes = pack.cells.routes;

    for (const point of route.points) {
      const from = point[2];
      if (!routes[from]) continue;

      for (const [to, routeId] of Object.entries(routes[from])) {
        if (routeId === route.i) {
          delete routes[from][parseInt(to, 10)];
          delete routes[parseInt(to, 10)][from];
        }
      }
    }

    pack.routes = pack.routes.filter(r => r.i !== route.i);
    viewbox.select(`#route${route.i}`).remove();
  }

  getConnectivityRate(cellId: number): number {
    const connections = pack.cells.routes[cellId];
    if (!connections) return 0;

    const connectivityRateMap: Record<string, number> = {
      roads: 0.2,
      trails: 0.1,
      searoutes: 0.2,
      default: 0.1
    };

    const connectivity = Object.values(connections).reduce((acc, routeId) => {
      const route = pack.routes.find(route => route.i === routeId);
      if (!route) return acc;
      const rate = connectivityRateMap[route.group] || connectivityRateMap.default;
      return acc + rate;
    }, 0.8);

    return connectivity;
  }

  generateName({ group, points }: { group: string; points: number[][] }): string {
    if (points.length < 4) return "Unnamed route segment";

    function getBurgName() {
      const priority = [points.at(-1), points.at(0), points.slice(1, -1).reverse()];
      for (const [_x, _y, cellId] of priority as [number, number, number][]) {
        const burgId = pack.cells.burg[cellId];
        if (burgId) return getAdjective(pack.burgs[burgId].name!);
      }
      return null;
    }

    const model = rw(models[group] || models.roads);
    const suffix = rw(suffixes[group] || suffixes.roads);

    const burgName = getBurgName();
    if (model === "burg_suffix" && burgName) return `${burgName} ${suffix}`;
    if (model === "prefix_suffix") return `${ra(prefixes)} ${suffix}`;
    if (model === "the_descriptor_prefix_suffix") return `The ${ra(descriptors)} ${ra(prefixes)} ${suffix}`;
    if (model === "the_descriptor_burg_suffix" && burgName) return `The ${ra(descriptors)} ${burgName} ${suffix}`;
    return "Unnamed route";
  }

  private ROUTE_CURVES: Record<string, any> = {
    roads: curveCatmullRom.alpha(0.1),
    trails: curveCatmullRom.alpha(0.1),
    searoutes: curveCatmullRom.alpha(0.5),
    default: curveCatmullRom.alpha(0.1)
  };

  getPath({ group, points }: { group: string; points: number[][] }): string {
    const lineGen = line();
    const curve = this.ROUTE_CURVES[group] || this.ROUTE_CURVES.default;
    lineGen.curve(curve);
    const path = round(lineGen(points.map(p => [p[0], p[1]]))!, 1);
    return path;
  }

  getLength(routeId: number): number {
    const path = routes.select(`#route${routeId}`).node() as SVGPathElement;
    return path.getTotalLength();
  }

  // run on map load to restore connections based on routes data
  sync() {
    this.connections = new Map();
    this.buildRiverEdges();
    for (const route of pack.routes) {
      for (let i = 0; i < route.points.length - 1; i++) {
        const cellId = route.points[i][2];
        const nextCellId = route.points[i + 1][2];
        this.connections.set(`${cellId}-${nextCellId}`, true);
        this.connections.set(`${nextCellId}-${cellId}`, true);
      }
    }
  }
}

declare global {
  var Routes: RoutesModule;
}

window.Routes = new RoutesModule();
