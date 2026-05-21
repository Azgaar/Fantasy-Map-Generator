import { clearTradeAnimations, drawTradeAnimation } from "../renderers/draw-trade-animation";
import { ra, rand } from "../utils";
import { findPath } from "../utils/pathUtils";
import type { Burg } from "./burgs-generator";
import type { Deal } from "./markets-generator";
import { MIN_PASSABLE_SEA_TEMP } from "./routes-generator";
import type { Point } from "./voronoi";

const INTERVAL = 3000;
const MAX_SPAWN = 5;

export type TradeAnimationBatch = {
  id: string;
  deals: Deal[];
  startBurgId: number;
  endBurgId: number;
};

export function getTradePathCost(current: number, next: number): number {
  const hCurrent = pack.cells.h[current];
  const hNext = pack.cells.h[next];

  const currentIsLand = hCurrent >= 20;
  const nextIsLand = hNext >= 20;

  // Land-water transitions are only allowed if a port is present on either side of the transition
  if (currentIsLand !== nextIsLand) {
    const currentBurgId = pack.cells.burg[current];
    const nextBurgId = pack.cells.burg[next];
    const currentBurg = currentBurgId ? pack.burgs[currentBurgId] : null;
    const nextBurg = nextBurgId ? pack.burgs[nextBurgId] : null;

    const isPortTransition = currentBurg?.port || nextBurg?.port;
    if (!isPortTransition) {
      return Infinity;
    }
  }

  // Calculate Euclidean distance
  const p1 = pack.cells.p[current];
  const p2 = pack.cells.p[next];
  const dist = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);

  // Check if cells are connected by an existing route (roads, trails, or searoutes)
  const routeId = pack.cells.routes?.[current]?.[next];
  const routeConnected = routeId !== undefined;

  if (nextIsLand) {
    // Land Cost
    const habitability = biomesData.habitability[pack.cells.biome[next]];
    if (!habitability) return Infinity; // Glaciers / impassable biomes

    const habitabilityModifier = 1 + Math.max(100 - habitability, 0) / 1000;
    const heightModifier = 1 + Math.max(pack.cells.h[next] - 25, 25) / 25;

    // Apply a significant discount if there is a generated road/trail route
    const routeModifier = routeConnected ? 0.3 : 1.0;
    const burgModifier = pack.cells.burg[next] ? 0.8 : 1.2;

    return dist * habitabilityModifier * heightModifier * routeModifier * burgModifier;
  } else {
    // Water Cost
    // Impassable if sea temperature is too low (frozen sea)
    if (grid.cells.temp[pack.cells.g[next]] < MIN_PASSABLE_SEA_TEMP) return Infinity;

    // Apply discount if there is a generated sea route
    const routeModifier = routeConnected ? 0.3 : 1.0;
    return dist * routeModifier;
  }
}

export function getTradeDealBatches(deals: Deal[] = pack.deals): TradeAnimationBatch[] {
  const batches = new Map<string, TradeAnimationBatch>();

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
  const marketBurg = getMarketCenterBurg(deal.market);
  if (!marketBurg) return null;

  const clientBurg = getClientBurg(deal);
  if (!clientBurg) return null;

  return deal.direction === "in" ? { start: clientBurg, end: marketBurg } : { start: marketBurg, end: clientBurg };
}

function getMarketCenterBurg(marketId: number): Burg | null {
  const market = Markets.get(marketId);
  if (!market) return null;
  const marketBurg = pack.burgs[market.centerBurgId];
  return marketBurg && !marketBurg.removed ? marketBurg : null;
}

function getClientBurg(deal: Deal): Burg | null {
  const clientBurgId = deal.clientType === "burg" ? deal.client : Markets.get(deal.client)?.centerBurgId;
  if (!clientBurgId) return null;
  const clientBurg = pack.burgs[clientBurgId];
  return clientBurg && !clientBurg.removed ? clientBurg : null;
}

export function triggerTradeAnimation(): void {
  if (!layerIsOn("toggleTradeAnimation")) {
    clearTradeAnimations();
    return;
  }

  const batch = ra(getTradeDealBatches());
  if (!batch) return;

  const startBurg = pack.burgs[batch.startBurgId];
  const endBurg = pack.burgs[batch.endBurgId];
  if (!startBurg || !endBurg) return;
  const startCell = startBurg.cell;
  const endCell = endBurg.cell;
  if (startCell === endCell) return;

  const pathCells = findPath(startCell, cellId => cellId === endCell, getTradePathCost, pack);
  if (!pathCells || pathCells.length < 2) return;

  const points: Point[] = [];
  points.push([startBurg.x, startBurg.y]);
  for (let i = 1; i < pathCells.length - 1; i++) {
    points.push(pack.cells.p[pathCells[i]]);
  }
  points.push([endBurg.x, endBurg.y]);

  drawTradeAnimation(batch, points);
}

let animationInterval: number | null = null;
export function startTradeAnimationLoop(): void {
  if (animationInterval || !layerIsOn("toggleTradeAnimation")) return;

  spawnTradeAnimations();
  animationInterval = window.setInterval(spawnTradeAnimations, INTERVAL);
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

function spawnTradeAnimations(): void {
  if (!layerIsOn("toggleTradeAnimation")) {
    stopTradeAnimationLoop();
    return;
  }

  const spawnCount = rand(1, MAX_SPAWN);
  for (let i = 0; i < spawnCount; i++) {
    window.setTimeout(triggerTradeAnimation, Math.random() * INTERVAL);
  }
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
