import { clear, draw } from "../renderers/draw-trade-animation";
import { ra } from "../utils";
import type { Burg } from "./burgs-generator";
import type { Deal } from "./markets-generator";
import type { Point } from "./voronoi";

export type TradeBatch = {
  id: string;
  deals: Deal[];
  startBurgId: number;
  endBurgId: number;
  type: "local" | "global";
};

const DEFAULT_OPTIONS = {
  displayType: "both",
  concurrent: 30,
  duration: 250,
  landDurationModifier: 5,
  segmentChangePause: 1000,
  fadeDuration: 2000,
  markerSize: 4
} as const;

export class TradeAnimationModule {
  private activeCount = 0;
  private generation = 0;
  private cachedBatches: TradeBatch[] | null = null;

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
    const enabledBatches = type === "both" ? batches : batches.filter(batch => batch.type === type);
    if (!enabledBatches.length) return false;

    const batch = ra(enabledBatches);
    if (!batch) return false;
    const startBurg = pack.burgs[batch.startBurgId];
    const endBurg = pack.burgs[batch.endBurgId];
    if (!startBurg || !endBurg) return false;
    const path = this.findRoutePath(startBurg.cell, endBurg.cell);
    if (!path) return false;

    const gen = this.generation;
    this.activeCount++;
    draw(batch, path.points, path.segments, () => {
      if (gen !== this.generation) return;
      this.activeCount--;
      this.topUp();
    });
    return true;
  }

  trigger(batches: TradeBatch[]): void {
    if (!batches.length) return;
    if (!layerIsOn("toggleTrade")) {
      clear();
      return;
    }

    for (const batch of batches) {
      const startBurg = pack.burgs[batch.startBurgId];
      const endBurg = pack.burgs[batch.endBurgId];
      if (!startBurg || !endBurg) continue;
      const path = this.findRoutePath(startBurg.cell, endBurg.cell);
      if (!path) continue;
      draw(batch, path.points, path.segments);
    }
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

        if (isSwitch) {
          // Land↔sea transitions are only permitted at port burg cells
          const burgId = pack.cells.burg[cell];
          if (!pack.burgs[burgId]?.port) continue;
        }

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

    // Build points and typed segments from the reconstructed path.
    const getPoint = (cellId: number): Point => {
      const burgId = pack.cells.burg[cellId];
      const burg = burgId ? pack.burgs[burgId] : null;
      return burg ? [burg.x, burg.y] : pack.cells.p[cellId];
    };

    type Segment = "land" | "water";
    let currentType: Segment = waterEdges[0] ? "water" : "land";
    let currentPoints: Point[] = [getPoint(cells[0])];
    const points: Point[] = [];
    const segments: { type: Segment; points: Point[] }[] = [];

    for (let i = 0; i < cells.length; i++) {
      const point = getPoint(cells[i]);
      points.push(point);
      if (i === 0) continue;

      const edgeType: Segment = waterEdges[i - 1] ? "water" : "land";
      if (edgeType !== currentType) {
        segments.push({ type: currentType, points: currentPoints });
        currentPoints = [getPoint(cells[i - 1]), point];
        currentType = edgeType;
      } else {
        currentPoints.push(point);
      }
    }
    segments.push({ type: currentType, points: currentPoints });

    return { points, segments };
  }

  getDealBatches(deals: Deal[]): TradeBatch[] {
    const batches = new Map<string, TradeBatch>();

    for (const deal of deals) {
      const endpoints = this.getDealEndpoints(deal);
      if (!endpoints || endpoints.start.cell === endpoints.end.cell) continue;
      if (!endpoints.start.i || !endpoints.end.i) continue;

      const startBurgId = endpoints.start.i;
      const endBurgId = endpoints.end.i;
      const type = deal.sellerType === "market" && deal.buyerType === "market" ? "global" : "local";
      const key = `${startBurgId}-${endBurgId}-${type}`;
      const batch = batches.get(key);
      if (batch) batch.deals.push(deal);
      else batches.set(key, { id: key, deals: [deal], startBurgId, endBurgId, type });
    }

    return Array.from(batches.values());
  }

  /** Returns the base traversal cost for a single route segment (no switch penalty). */
  getPathCost(current: number, next: number): number {
    const routeId = pack.cells.routes[current]?.[next];
    const route = pack.routes.find(r => r.i === routeId);
    return route?.group === "searoutes" ? 1 : 5;
  }

  private getDealEndpoints(deal: Deal): { start: Burg; end: Burg } | null {
    const start = this.resolveParty(deal.seller, deal.sellerType);
    const end = this.resolveParty(deal.buyer, deal.buyerType);
    if (!start || !end) return null;
    return { start, end };
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
