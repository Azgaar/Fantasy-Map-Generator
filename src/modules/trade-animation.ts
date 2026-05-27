import { clear, draw } from "../renderers/draw-trade-animation";
import { ra } from "../utils";
import { findPath } from "../utils/pathUtils";
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
    if (batches.length === 0) return;
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
    const pathData = this.getPath(batch);
    if (!pathData) return false;

    const gen = this.generation;
    this.activeCount++;
    draw(batch, pathData.points, pathData.segments, () => {
      if (gen !== this.generation) return;
      this.activeCount--;
      this.topUp();
    });
    return true;
  }

  getPath(batch: TradeBatch): { points: Point[]; segments: { type: "land" | "water"; points: Point[] }[] } | null {
    const startBurg = pack.burgs[batch.startBurgId];
    const endBurg = pack.burgs[batch.endBurgId];
    if (!startBurg || !endBurg) return null;

    const pathCells = findPath(
      startBurg.cell,
      cellId => cellId === endBurg.cell,
      (a, b) => this.getPathCost(a, b),
      pack
    );
    if (!pathCells || pathCells.length < 2) return null;

    const getPoint = (cellId: number): Point => {
      const burg = pack.burgs[pack.cells.burg[cellId]];
      return burg ? [burg.x, burg.y] : pack.cells.p[cellId];
    };

    const isLand = (cellId: number): boolean => pack.cells.h[cellId] >= 20;
    type Segment = "land" | "water";
    let currentType: Segment = isLand(pathCells[0]) && isLand(pathCells[1]) ? "land" : "water";
    let currentPoints: Point[] = [getPoint(pathCells[0])];
    const points: Point[] = [];
    const segments: { type: Segment; points: Point[] }[] = [];

    for (let i = 0; i < pathCells.length; i++) {
      const curr = pathCells[i];
      const point = getPoint(curr);
      points.push(point);
      if (i === 0) continue;

      const prev = pathCells[i - 1];
      const edge: Segment = isLand(prev) && isLand(curr) ? "land" : "water";
      if (edge !== currentType) {
        segments.push({ type: currentType, points: currentPoints });
        currentPoints = [getPoint(prev), point];
        currentType = edge;
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

  getPathCost(current: number, next: number): number {
    const hCurrent = pack.cells.h[current];
    const hNext = pack.cells.h[next];

    const isWater = hCurrent < 20;
    const toBeWater = hNext < 20;

    if (isWater !== toBeWater) {
      const currentBurgId = pack.cells.burg[current];
      const nextBurgId = pack.cells.burg[next];
      const currentBurg = currentBurgId ? pack.burgs[currentBurgId] : null;
      const nextBurg = nextBurgId ? pack.burgs[nextBurgId] : null;

      const isPortTransition = currentBurg?.port || nextBurg?.port;
      if (!isPortTransition) return Infinity;
    }

    return toBeWater ? Routes.getWaterPathCost(current, next) : Routes.getLandPathCost(current, next);
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
