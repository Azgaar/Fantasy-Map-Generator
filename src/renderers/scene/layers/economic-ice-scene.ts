import { color } from "d3-color";
import type { Burg } from "@/generators/burgs-generator";
import type { Good } from "@/generators/goods-generator";
import type {
  LinePathPrimitive,
  PolygonPathBatchPrimitive,
  PolygonPathPrimitive,
  SceneBounds,
  SceneRevision
} from "../primitives";
import type { MapRenderWorld } from "../render-world";

export interface GoodsProductionSource {
  getBurgProduction(burg: Burg): Record<number, number>;
  getCellProduction(
    cellId: number,
    biomeProduction: Record<number, { goodId: number; production: number }[]>
  ): Record<number, number>;
}

export interface GoodsCellSceneItem {
  cellId: number;
  color: string;
  goodId: number;
  opacity: number;
  points: readonly [number, number][];
}

export interface GoodsIconSceneItem {
  cellId: number;
  color: string;
  goodId: number;
  icon: string;
  stroke: string;
  x: number;
  y: number;
}

export interface GoodsBurgEntrySceneItem {
  color: string;
  goodId: number;
  icon: string;
  stroke: string;
  value: number;
}

export interface GoodsBurgSceneItem {
  burgId: number;
  entries: readonly GoodsBurgEntrySceneItem[];
  x: number;
  y: number;
}

export interface GoodsScene {
  burgs: readonly GoodsBurgSceneItem[];
  cells: readonly GoodsCellSceneItem[];
  icons: readonly GoodsIconSceneItem[];
  revision: SceneRevision;
}

export interface MarketSceneItem {
  borders: readonly LinePathPrimitive[];
  center: { burgId: number; x: number; y: number } | null;
  color: string;
  marketId: number;
  polygons: readonly PolygonPathPrimitive[];
  stroke: string;
}

export interface MarketScene {
  markets: readonly MarketSceneItem[];
  revision: SceneRevision;
}

export function buildIceScene(world: MapRenderWorld, revision: SceneRevision): PolygonPathBatchPrimitive {
  const polygons = world.ice.map<PolygonPathPrimitive>(ice => ({
    domainId: ice.i,
    points: ice.points.map(([x, y]) => [x + (ice.offset?.[0] ?? 0), y + (ice.offset?.[1] ?? 0)]),
    role: ice.type
  }));
  return {
    bounds: getPolygonBounds(polygons),
    domainIds: polygons.map(({ domainId }) => domainId),
    kind: "polygon-path-batch",
    layer: "ice",
    polygons,
    revision
  };
}

export function buildGoodsScene(
  world: MapRenderWorld,
  production: GoodsProductionSource | undefined,
  revision: SceneRevision
): GoodsScene {
  if (!production) return { burgs: [], cells: [], icons: [], revision };
  const visibleGoods = new Map(world.goods.filter(good => good.visible).map(good => [good.i, good]));
  if (!visibleGoods.size) return { burgs: [], cells: [], icons: [], revision };

  const biomeProduction = getBiomeProduction(world.goods);
  const totals: Array<{ cellId: number; produced: Array<{ amount: number; good: Good }>; total: number }> = [];
  let maximum = 0;
  for (const cellId of world.cells.i) {
    const produced = Object.entries(production.getCellProduction(cellId, biomeProduction))
      .map(([goodId, amount]) => ({ amount, good: visibleGoods.get(Number(goodId)) }))
      .filter((entry): entry is { amount: number; good: Good } => Boolean(entry.good && entry.amount > 0));
    const total = produced.reduce((sum, entry) => sum + entry.amount, 0);
    if (!total) continue;
    maximum = Math.max(maximum, total);
    totals.push({ cellId, produced, total });
  }

  const cells = totals.flatMap(({ cellId, produced, total }) => {
    const opacity = 0.1 + 0.9 * (maximum ? total / maximum : 0);
    const points = getCellPolygon(world, cellId);
    return produced.map(({ good }) => ({ cellId, color: good.color, goodId: good.i, opacity, points }));
  });
  const icons = world.cells.i.flatMap<GoodsIconSceneItem>(cellId => {
    const good = visibleGoods.get(world.cells.good[cellId]);
    const point = world.cells.p[cellId];
    return good && point
      ? [
          {
            cellId,
            color: good.color,
            goodId: good.i,
            icon: good.icon,
            stroke: darken(good.color),
            x: point[0],
            y: point[1]
          }
        ]
      : [];
  });
  const burgs = world.burgs.flatMap<GoodsBurgSceneItem>(burg => {
    if (!burg.i || burg.removed || !burg.production) return [];
    const entries = Object.entries(production.getBurgProduction(burg))
      .map(([goodId, amount]) => ({ amount, good: visibleGoods.get(Number(goodId)) }))
      .filter((entry): entry is { amount: number; good: Good } => Boolean(entry.good && entry.amount > 0))
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 3)
      .map(({ amount, good }) => ({
        color: good.color,
        goodId: good.i,
        icon: good.icon,
        stroke: darken(good.color),
        value: Math.round(amount * 10) / 10
      }));
    return entries.length ? [{ burgId: burg.i, entries, x: burg.x, y: burg.y }] : [];
  });
  return { burgs, cells, icons, revision };
}

export function buildMarketScene(world: MapRenderWorld, revision: SceneRevision): MarketScene {
  const polygonsByMarket = traceCellRegions(world);
  return {
    markets: world.markets.map(market => {
      const burg = world.burgs[market.centerBurgId];
      return {
        borders: traceMarketBorders(world, market.i),
        center: burg ? { burgId: burg.i, x: burg.x, y: burg.y } : null,
        color: market.color || "#dababf",
        marketId: market.i,
        polygons: polygonsByMarket.get(market.i) ?? [],
        stroke: darken(market.color || "#dababf")
      };
    }),
    revision
  };
}

function traceMarketBorders(world: MapRenderWorld, marketId: number): LinePathPrimitive[] {
  const paths: LinePathPrimitive[] = [];
  for (const cellId of world.cells.i) {
    if (world.cells.market[cellId] !== marketId) continue;
    const vertices = world.cells.v[cellId];
    for (let index = 0; index < vertices.length; index++) {
      const startId = vertices[index];
      const endId = vertices[(index + 1) % vertices.length];
      const adjacentToEdge = world.vertices.c[startId].filter(candidate => world.vertices.c[endId].includes(candidate));
      if (adjacentToEdge.some(candidate => candidate !== cellId && world.cells.market[candidate] === marketId)) {
        continue;
      }
      const start = world.vertices.p[startId];
      const end = world.vertices.p[endId];
      if (!start || !end) continue;
      paths.push({ domainId: `${marketId}:${cellId}:${index}`, points: [start, end], role: String(marketId) });
    }
  }
  return paths;
}

function getBiomeProduction(goods: readonly Good[]): Record<number, { goodId: number; production: number }[]> {
  const result: Record<number, { goodId: number; production: number }[]> = {};
  for (const good of goods) {
    for (const [biomeId, production] of Object.entries(good.biomeOutput ?? {})) {
      if (!production) continue;
      const values = result[Number(biomeId)] ?? [];
      values.push({ goodId: good.i, production });
      result[Number(biomeId)] = values;
    }
  }
  return result;
}

function getCellPolygon(world: MapRenderWorld, cellId: number): [number, number][] {
  return world.cells.v[cellId].map(vertexId => world.vertices.p[vertexId]);
}

function traceCellRegions(world: MapRenderWorld): Map<number, PolygonPathPrimitive[]> {
  const result = new Map<number, PolygonPathPrimitive[]>();
  for (const cellId of world.cells.i) {
    const marketId = world.cells.market[cellId];
    if (!marketId) continue;
    const polygon: PolygonPathPrimitive = {
      domainId: `${marketId}:${cellId}`,
      points: getCellPolygon(world, cellId),
      role: String(marketId)
    };
    const current = result.get(marketId);
    if (current) current.push(polygon);
    else result.set(marketId, [polygon]);
  }
  return result;
}

function darken(value: string): string {
  return color(value)?.darker(2).hex() ?? "#000000";
}

function getPolygonBounds(polygons: readonly PolygonPathPrimitive[]): SceneBounds | null {
  if (!polygons.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polygon of polygons) {
    for (const [x, y] of polygon.points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { maxX, maxY, minX, minY };
}
