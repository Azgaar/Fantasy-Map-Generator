import { clearTradeAnimations, drawTradeAnimation } from "../renderers/draw-trade-animation";
import { ra, rand } from "../utils";
import { findPath } from "../utils/pathUtils";
import type { Burg } from "./burgs-generator";
import type { Deal } from "./markets-generator";
import type { Point } from "./voronoi";

const MAX_INTERVAL = 3000;
const MAX_SPAWN = 5;

let animationInterval: number | null = null;
export function startTradeAnimationLoop(): void {
  if (animationInterval || !layerIsOn("toggleTradeAnimation")) return;
  const batches = getTradeDealBatches(pack.deals);
  if (batches.length === 0) return;

  spawnTradeAnimations(batches);
  animationInterval = window.setInterval(() => spawnTradeAnimations(batches), MAX_INTERVAL);
}

export function stopTradeAnimationLoop(): void {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }
  clearTradeAnimations();
}

export function restartTradeAnimationLoop(): void {
  stopTradeAnimationLoop();
  startTradeAnimationLoop();
}

export function syncTradeAnimationLoop(): void {
  if (layerIsOn("toggleTradeAnimation")) startTradeAnimationLoop();
  else stopTradeAnimationLoop();
}

function spawnTradeAnimations(batches: TradeBatch[]): void {
  if (!layerIsOn("toggleTradeAnimation")) {
    stopTradeAnimationLoop();
    return;
  }

  const spawnCount = rand(1, MAX_SPAWN);
  for (let i = 0; i < spawnCount; i++) {
    triggerTradeAnimation(batches);
  }
}

export type TradeBatch = {
  id: string;
  deals: Deal[];
  startBurgId: number;
  endBurgId: number;
};

export function getTradeDealBatches(deals: Deal[]): TradeBatch[] {
  const batches = new Map<string, TradeBatch>();

  for (const deal of deals) {
    const endpoints = getDealEndpoints(deal);
    if (!endpoints || endpoints.start.cell === endpoints.end.cell) continue;
    if (!endpoints.start.i || !endpoints.end.i) continue;

    const startBurgId = endpoints.start.i;
    const endBurgId = endpoints.end.i;
    const key = `${startBurgId}-${endBurgId}`;
    const batch = batches.get(key);
    if (batch) batch.deals.push(deal);
    else batches.set(key, { id: key, deals: [deal], startBurgId, endBurgId });
  }

  return Array.from(batches.values());
}

function getDealEndpoints(deal: Deal): { start: Burg; end: Burg } | null {
  const market = Markets.get(deal.market);
  if (!market) return null;

  const marketBurg = pack.burgs[market.centerBurgId];
  if (!marketBurg) return null;

  const clientBurgId = deal.clientType === "burg" ? deal.client : Markets.get(deal.client)?.centerBurgId;
  if (!clientBurgId) return null;
  const clientBurg = pack.burgs[clientBurgId];
  if (!clientBurg) return null;

  return deal.direction === "in" ? { start: clientBurg, end: marketBurg } : { start: marketBurg, end: clientBurg };
}

export function triggerTradeAnimation(batches: TradeBatch[]): void {
  if (!layerIsOn("toggleTradeAnimation")) {
    clearTradeAnimations();
    return;
  }

  const batch = ra(batches);
  if (!batch) return;

  const startBurg = pack.burgs[batch.startBurgId];
  const endBurg = pack.burgs[batch.endBurgId];
  if (!startBurg || !endBurg) return;

  const pathCells = findPath(startBurg.cell, cellId => cellId === endBurg.cell, getTradePathCost, pack);
  if (!pathCells || pathCells.length < 2) return;

  const getPoint = (cellId: number): Point => {
    const burg = pack.burgs[pack.cells.burg[cellId]];
    return burg ? [burg.x, burg.y] : pack.cells.p[cellId];
  };

  // split path into land/water segments
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

  drawTradeAnimation(batch, points, segments);
}

export function getTradePathCost(current: number, next: number): number {
  const hCurrent = pack.cells.h[current];
  const hNext = pack.cells.h[next];

  const isWater = hCurrent < 20;
  const toBeWater = hNext < 20;

  // Land-water transitions are only allowed via a port
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

declare global {
  interface Window {
    TradeAnimation: {
      trigger: typeof triggerTradeAnimation;
      start: typeof startTradeAnimationLoop;
      stop: typeof stopTradeAnimationLoop;
      restart: typeof restartTradeAnimationLoop;
      sync: typeof syncTradeAnimationLoop;
    };
  }
}

window.TradeAnimation = {
  trigger: triggerTradeAnimation,
  start: startTradeAnimationLoop,
  stop: stopTradeAnimationLoop,
  restart: restartTradeAnimationLoop,
  sync: syncTradeAnimationLoop
};
