import type { Burg } from "../generators/burgs-generator";
import type { Deal } from "../generators/markets-generator";
import type { Point } from "../generators/voronoi";
import { ra } from "../utils";
import { clear, draw } from "./draw-trade-animation";

export type TradeBatch = {
  id: string;
  deals: Deal[];
  startBurgId: number;
  endBurgId: number;
  type: "local" | "global";
};

type TradePath = { points: Point[]; segments: { type: "land" | "water"; points: Point[] }[] };

const DEFAULT_OPTIONS = {
  displayType: "both",
  concurrent: 30,
  duration: 250,
  landDurationModifier: 5,
  segmentChangePause: 1000,
  markerSize: 4
} as const;

export class TradeAnimationModule {
  private activeCount = 0;
  private generation = 0;
  private cachedBatches: TradeBatch[] | null = null;
  private pathCache = new Map<string, TradePath | null>();

  start(): void {
    if (!layerIsOn("toggleTrade")) return;
    this.stop();
    const batches = this.getDealBatches(pack.deals);
    if (!batches.length) return;
    this.cachedBatches = batches;
    this.topUp();
  }

  stop(): void {
    this.generation++;
    this.activeCount = 0;
    this.cachedBatches = null;
    this.pathCache.clear();
    clear();
  }

  restart(): void {
    this.stop();
    this.start();
  }

  sync(): void {
    if (layerIsOn("toggleTrade")) this.start();
    else this.stop();
  }

  private topUp(): void {
    if (!layerIsOn("toggleTrade") || !this.cachedBatches) return;
    const target = options.trade.animation.concurrent ?? DEFAULT_OPTIONS.concurrent;
    while (this.activeCount < target) {
      if (!this.spawnOne(this.cachedBatches)) break;
    }
  }

  private spawnOne(batches: TradeBatch[]): boolean {
    const type = options.trade.animation.displayType || "both";

    while (true) {
      const enabledBatches = type === "both" ? batches : batches.filter(batch => batch.type === type);
      if (!enabledBatches.length) return false;

      const batch = ra(enabledBatches);
      if (!batch) return false;

      const path = this.getPath(batch);
      if (!path) {
        const idx = batches.indexOf(batch);
        if (idx !== -1) batches.splice(idx, 1);
        continue;
      }

      const gen = this.generation;
      this.activeCount++;
      draw(
        batch,
        path.segments,
        () => {
          if (gen !== this.generation) return;
          this.activeCount--;
          this.topUp();
        },
        () => gen !== this.generation
      );
      return true;
    }
  }

  trigger(batches: TradeBatch[]): void {
    if (!batches.length) return;
    if (!layerIsOn("toggleTrade")) {
      clear();
      return;
    }

    for (const batch of batches) {
      const path = this.getPath(batch);
      if (!path) continue;
      draw(batch, path.segments);
    }
  }

  getPath(batch: TradeBatch): TradePath | null {
    const cacheKey = `${batch.startBurgId}-${batch.endBurgId}`;
    const cached = this.pathCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const startBurg = pack.burgs[batch.startBurgId];
    const endBurg = pack.burgs[batch.endBurgId];
    const path = !startBurg || !endBurg ? null : this.findRoutePath(startBurg.cell, endBurg.cell);
    this.pathCache.set(cacheKey, path);
    return path;
  }

  getPathCost(fromCell: number, toCell: number): number {
    const neighbors = pack.cells.routes[fromCell];
    if (!neighbors || !(toCell in neighbors)) return this.LAND_COST;
    const routeId = neighbors[toCell];
    const route = pack.routes.find(r => r.i === routeId);
    return route?.group === "searoutes" ? this.WATER_COST : this.LAND_COST;
  }

  private WATER_COST = 1;
  private LAND_COST = 5;
  private SWITCH_COST = 20;

  findRoutePath(startCell: number, endCell: number) {
    if (startCell === endCell) return null;

    const cellRoutes = pack.cells.routes;
    const startNeighbors = cellRoutes[startCell];
    if (!startNeighbors) return null;

    const isWaterRoute = new Map<number, boolean>();
    for (const route of pack.routes) {
      isWaterRoute.set(route.i, route.group === "searoutes");
    }

    // State encoding: stateId = cell * 2 + (isWater ? 1 : 0)
    const maxState = pack.cells.h.length * 2;
    const distArr = new Float64Array(maxState).fill(Infinity);
    const prevCellArr = new Int32Array(maxState).fill(-1);
    const prevStateArr = new Int32Array(maxState).fill(-1); // -1 = came directly from startCell

    // Prevent startCell from ever being re-enqueued.
    distArr[startCell * 2] = 0;
    distArr[startCell * 2 + 1] = 0;

    const queue = new window.FlatQueue();
    for (const nextStr of Object.keys(startNeighbors)) {
      const next = Number(nextStr);
      const water = isWaterRoute.get(startNeighbors[next]) ?? false;
      const cost = water ? this.WATER_COST : this.LAND_COST;
      const state = next * 2 + (water ? 1 : 0);
      if (cost < distArr[state]) {
        distArr[state] = cost;
        prevCellArr[state] = startCell;
        queue.push(state, cost);
      }
    }

    while (queue.length) {
      const cost: number = queue.peekValue();
      const stateId: number = queue.pop();
      if (cost > distArr[stateId]) continue;

      const cell = stateId >> 1;
      const wasWater = (stateId & 1) === 1;

      if (cell === endCell) return this.buildPathResult(stateId, prevCellArr, prevStateArr);

      const neighbors = cellRoutes[cell];
      if (!neighbors) continue;

      for (const nextStr of Object.keys(neighbors)) {
        const next = Number(nextStr);
        const water = isWaterRoute.get(neighbors[next]) ?? false;
        const isSwitch = water !== wasWater;

        const edgeCost = isSwitch ? this.SWITCH_COST : water ? this.WATER_COST : this.LAND_COST;
        const newCost = cost + edgeCost;
        const nextState = next * 2 + (water ? 1 : 0);

        if (newCost < distArr[nextState]) {
          distArr[nextState] = newCost;
          prevCellArr[nextState] = cell;
          prevStateArr[nextState] = stateId;
          queue.push(nextState, newCost);
        }
      }
    }

    return null;
  }

  private buildPathResult(
    terminalState: number,
    prevCellArr: Int32Array,
    prevStateArr: Int32Array
  ): { points: Point[]; segments: { type: "land" | "water"; points: Point[] }[] } {
    const cells: number[] = [terminalState >> 1]; // endCell
    const waterEdges: boolean[] = [];
    let state = terminalState;
    while (prevStateArr[state] !== -1) {
      waterEdges.push((state & 1) === 1);
      cells.push(prevCellArr[state]);
      state = prevStateArr[state];
    }
    waterEdges.push((state & 1) === 1); // first hop from startCell
    cells.push(prevCellArr[state]); // startCell
    cells.reverse();
    waterEdges.reverse();

    type Segment = "land" | "water";

    if (cells.length < 2) return { points: [], segments: [] };

    // Build a fast routeId→route lookup to avoid repeated linear scans.
    const routeById = new Map<number, { points: number[][] }>();
    for (const route of pack.routes) routeById.set(route.i, route);

    // Process the path edge-by-edge, extracting actual stored route geometry so the
    // animation follows the same adjusted/meandered points that the renderer draws.
    const segments: { type: Segment; points: Point[] }[] = [];
    let currentType: Segment = waterEdges[0] ? "water" : "land";

    // First edge: take the full geometry (both endpoint cell runs).
    const firstEdge = this.extractEdgePoints(cells[0], cells[1], pack.cells.routes[cells[0]]?.[cells[1]], routeById);
    let currentPoints: Point[] = firstEdge.map(p => [p[0], p[1]] as Point);

    for (let i = 1; i < cells.length - 1; i++) {
      const fromCell = cells[i];
      const toCell = cells[i + 1];
      const type: Segment = waterEdges[i] ? "water" : "land";

      if (type !== currentType) {
        segments.push({ type: currentType, points: currentPoints });
        // New segment shares the boundary point with the previous one.
        currentPoints = [currentPoints[currentPoints.length - 1]];
        currentType = type;
      }

      const edgePoints = this.extractEdgePoints(fromCell, toCell, pack.cells.routes[fromCell]?.[toCell], routeById);
      // The previous edge already emitted fromCell's entire run of points, so skip every leading
      // point that still belongs to fromCell and append only the new toCell geometry. Skipping just
      // one point would re-traverse fromCell's run (very visible on meandering water routes, where
      // the marker appears to spin 180° back and forth across every shared cell).
      let k = 0;
      while (k < edgePoints.length && edgePoints[k][2] === fromCell) k++;
      if (k === 0)
        k = 1; // boundary point wasn't tagged fromCell — skip just it to avoid a duplicate
      else if (k >= edgePoints.length) k = edgePoints.length - 1; // keep at least the final point
      for (; k < edgePoints.length; k++) currentPoints.push([edgePoints[k][0], edgePoints[k][1]]);
    }
    segments.push({ type: currentType, points: currentPoints });

    // Snap the path's terminal points to the burg positions. Sea routes that run up a river anchor a
    // port cell on the river course (the cell centre) rather than the burg marker, so a water segment
    // (or a land segment ending at a river port) would otherwise start/end a few pixels off the burg
    // it serves. getCellPoint returns the burg coordinate for burg cells, matching where the marker
    // is drawn.
    const firstSeg = segments[0].points;
    const lastSeg = segments[segments.length - 1].points;
    firstSeg[0] = this.getCellPoint(cells[0]);
    lastSeg[lastSeg.length - 1] = this.getCellPoint(cells[cells.length - 1]);

    // Flatten segments into a single points array (shared boundary points appear once).
    const points: Point[] = [];
    for (let si = 0; si < segments.length; si++) {
      for (let pk = 0; pk < segments[si].points.length; pk++) {
        if (pk === 0 && si > 0) continue;
        points.push(segments[si].points[pk]);
      }
    }

    return { points, segments };
  }

  // Extract the actual rendered points for one route edge (fromCell → toCell), each tagged with the
  // cell it belongs to ([x, y, cellId]). Looks up the stored route geometry so the animation follows
  // the same path the renderer draws. The cell tag lets the caller drop a cell's run once it has
  // already been emitted by the adjacent edge.
  private extractEdgePoints(
    fromCell: number,
    toCell: number,
    routeId: number | undefined,
    routeById: Map<number, { points: number[][] }>
  ): [number, number, number][] {
    const fallback = (): [number, number, number][] => [
      [...this.getCellPoint(fromCell), fromCell] as [number, number, number],
      [...this.getCellPoint(toCell), toCell] as [number, number, number]
    ];

    if (routeId === undefined) return fallback();
    const route = routeById.get(routeId);
    if (!route) return fallback();

    const pts = route.points;
    if (!pts) return fallback();

    for (let i = 0; i < pts.length - 1; i++) {
      const cellA = pts[i][2];
      const cellB = pts[i + 1][2];

      if (cellA === fromCell && cellB === toCell) {
        // Forward direction: include all points belonging to fromCell, then all belonging to toCell.
        let start = i;
        while (start > 0 && pts[start - 1][2] === fromCell) start--;
        let end = i + 1;
        while (end + 1 < pts.length && pts[end + 1][2] === toCell) end++;
        return pts.slice(start, end + 1).map(p => [p[0], p[1], p[2]] as [number, number, number]);
      }

      if (cellA === toCell && cellB === fromCell) {
        // Reverse direction: same slice, reversed.
        let start = i;
        while (start > 0 && pts[start - 1][2] === toCell) start--;
        let end = i + 1;
        while (end + 1 < pts.length && pts[end + 1][2] === fromCell) end++;
        return pts
          .slice(start, end + 1)
          .reverse()
          .map(p => [p[0], p[1], p[2]] as [number, number, number]);
      }
    }

    return fallback();
  }

  private getCellPoint(cellId: number): Point {
    const burgId = pack.cells.burg[cellId];
    const burg = burgId ? pack.burgs[burgId] : null;
    return burg ? [burg.x, burg.y] : pack.cells.p[cellId];
  }

  getDealBatches(deals: Deal[]): TradeBatch[] {
    const batches = new Map<string, TradeBatch>();

    for (const deal of deals) {
      const start = this.resolveParty(deal.seller, deal.sellerType);
      const end = this.resolveParty(deal.buyer, deal.buyerType);
      if (!start || !end || start.cell === end.cell) continue;
      if (!start.i || !end.i) continue;

      const type = deal.sellerType === "market" && deal.buyerType === "market" ? "global" : "local";
      const key = `${start.i}-${end.i}-${type}`;
      const batch = batches.get(key);
      if (batch) batch.deals.push(deal);
      else batches.set(key, { id: key, deals: [deal], startBurgId: start.i, endBurgId: end.i, type });
    }

    return Array.from(batches.values());
  }

  private resolveParty(id: number, type: "burg" | "market"): Burg | null {
    const burgId = type === "burg" ? id : Markets.get(id)?.centerBurgId;
    if (!burgId) return null;
    return pack.burgs[burgId] || null;
  }

  getDefaultOptions() {
    return DEFAULT_OPTIONS;
  }
}

declare global {
  var TradeAnimation: TradeAnimationModule;
}

window.TradeAnimation = new TradeAnimationModule();
