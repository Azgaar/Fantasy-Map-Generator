import { rn } from "../utils";
import type { Burg } from "./burgs-generator";

/** Compass bearing in degrees, 0 = N, clockwise, on SVG coordinates where y grows downward. */
export function compassBearing(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0;
  return ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
}

/**
 * Height in metres. Mirrors getHeight() in utils/unitUtils.ts but stays numeric and
 * unit-free — getHeight returns a formatted string and reads the unit <select> from
 * the DOM, which would make this module impure.
 */
export function elevationMetres(h: number, heightExponent: number): number {
  if (h >= 20) return (h - 18) ** heightExponent;
  if (h > 0) return ((h - 20) / h) * 50;
  return -990;
}

/** distanceScale is km per world unit. */
export function kmToWorldUnits(km: number, distanceScale: number): number {
  return km / (distanceScale || 1);
}

/** FNV-1a 32-bit. settlemaker's seed is a number; FMG's burg seed is a string. */
export function hashSeedToInt(s: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** The same population scaling the watabou preview builders apply. */
export function scaledPopulation(population: number, populationRate: number, urbanization: number): number {
  return rn(population * populationRate * urbanization);
}

/**
 * Radius of the local window. Sized as a multiple of the settlement's own extent so a
 * pass or valley on an approach usually falls inside it; see the spec's assumptions.
 */
export const DEFAULT_WINDOW_RADIUS_KM = 12;

/** Grid rings the window must span even when the metric radius is smaller. */
export const MIN_WINDOW_RINGS = 2;

/**
 * At default settings (distanceScale 3, cellsDesired 10000) the metric radius is 4 world
 * units while cells sit 8-13 units apart, which would collapse the window to the burg's
 * own cell. Floor it at a couple of grid rings so the window always spans neighbours.
 * Returns km, because that is what CellWindow.radiusKm records as provenance.
 */
export function effectiveWindowRadiusKm(radiusKm: number, distanceScale: number, spacing: number): number {
  const minKm = MIN_WINDOW_RINGS * (spacing || 0) * (distanceScale || 1);
  return Math.max(radiusKm, minKm);
}

export interface CellWindow {
  center: number;
  cellIds: number[];
  radiusKm: number;
}

/** BFS from the centre cell, bounded by straight-line distance rather than hop count. */
export function collectWindow(
  center: number,
  cellsC: ArrayLike<number[]>,
  cellsP: ArrayLike<[number, number]>,
  radiusKm: number,
  distanceScale: number
): CellWindow {
  const radiusUnits = kmToWorldUnits(radiusKm, distanceScale);
  const maxSq = radiusUnits * radiusUnits;
  const [cx, cy] = cellsP[center] ?? [0, 0];

  const seen = new Set<number>([center]);
  const cellIds: number[] = [center];
  const queue = [center];

  while (queue.length) {
    const current = queue.shift() as number;
    for (const neighbour of cellsC[current] ?? []) {
      if (seen.has(neighbour)) continue;
      seen.add(neighbour);
      const p = cellsP[neighbour];
      if (!p) continue;
      const dx = p[0] - cx;
      const dy = p[1] - cy;
      if (dx * dx + dy * dy > maxSq) continue;
      cellIds.push(neighbour);
      queue.push(neighbour);
    }
  }

  return { center, cellIds, radiusKm };
}

export type RouteGroup = "roads" | "trails" | "searoutes" | "airroutes" | "traderoutes";

export interface Approach {
  routeId: number;
  group: string; // upstream allows custom route groups, so this is not limited to RouteGroup
  type?: string;
  name?: string;
  bearingDeg: number;
  through: boolean;
  corridor?: Corridor;
}

/**
 * One entry per route connection leaving the burg cell. An empty array is meaningful:
 * settlemaker treats [] as "this burg genuinely has no roads" and an omitted field as
 * "route data unknown", which makes it invent random gates instead.
 */
export function readApproaches(
  center: number,
  cellsRoutes: Record<number, Record<number, number>>,
  cellsP: ArrayLike<[number, number]>,
  // group is a plain string upstream (custom route groups); RouteGroup names the ones we branch on
  routeById: Map<number, { group: string; type?: string; name?: string }>
): Approach[] {
  const connections = cellsRoutes[center];
  if (!connections) return [];

  const [cx, cy] = cellsP[center] ?? [0, 0];
  const sidesByRoute = new Map<number, number>();
  for (const routeId of Object.values(connections)) {
    sidesByRoute.set(routeId, (sidesByRoute.get(routeId) ?? 0) + 1);
  }

  const approaches: Approach[] = [];
  for (const [neighbourKey, routeId] of Object.entries(connections)) {
    const route = routeById.get(routeId);
    if (!route) continue;
    const p = cellsP[Number(neighbourKey)];
    if (!p) continue;
    approaches.push({
      routeId,
      group: route.group,
      type: route.type,
      name: route.name,
      bearingDeg: compassBearing(p[0] - cx, p[1] - cy),
      through: (sidesByRoute.get(routeId) ?? 0) > 1
    });
  }

  return approaches.sort((a, b) => a.bearingDeg - b.bearingDeg);
}

export interface RiverReading {
  id: number;
  name: string;
  type: string;
  /** Omitted when the nearest river cell is the burg's own: there is no direction to give. */
  bearingDeg?: number;
  dischargeM3s: number;
  widthKm: number;
  throughBurg: boolean;
}

export interface WaterFeatureReading {
  featureId: number;
  type: string;
  name: string;
}

export interface Hydrology {
  oceanBearingDeg?: number;
  harbourSize?: "large" | "small";
  coastal: boolean;
  lakeside: boolean;
  rivers: RiverReading[];
  waterFeatures: WaterFeatureReading[];
}

export const LARGE_HARBOUR_MIN_POPULATION = 5000;

const SEA_TRADE_GROUPS = new Set<string>(["searoutes", "traderoutes"] satisfies RouteGroup[]);

export function readHydrology(input: {
  window: CellWindow;
  cellsHaven: ArrayLike<number>;
  cellsHarbor: ArrayLike<number>;
  cellsF: ArrayLike<number>;
  cellsP: ArrayLike<[number, number]>;
  cellsR: ArrayLike<number>;
  featureTypeById: (featureId: number) => string | undefined;
  featureNameById: (featureId: number) => string | undefined;
  riverById: (
    id: number
  ) => { name?: string; type?: string; discharge?: number; width?: number; cells?: number[] } | undefined;
  approaches: Approach[];
  isPort: boolean;
  population: number;
}): Hydrology {
  const {
    window: win,
    cellsHaven,
    cellsHarbor,
    cellsF,
    cellsP,
    cellsR,
    featureTypeById,
    featureNameById,
    riverById,
    approaches,
    isPort,
    population
  } = input;
  const center = win.center;

  const coastal = isPort || Number(cellsHarbor[center] ?? 0) > 0;

  const lakeside = win.cellIds.some(id => featureTypeById(Number(cellsF[id])) === "lake");

  const haven = Number(cellsHaven[center] ?? 0);
  const havenPoint = haven ? cellsP[haven] : undefined;
  const [bx, by] = cellsP[center] ?? [0, 0];
  const oceanBearingDeg = coastal && havenPoint ? compassBearing(havenPoint[0] - bx, havenPoint[1] - by) : undefined;

  const hasSeaTradeRoute = approaches.some(a => SEA_TRADE_GROUPS.has(a.group));
  const harbourSize = coastal
    ? hasSeaTradeRoute && population >= LARGE_HARBOUR_MIN_POPULATION
      ? "large"
      : "small"
    : undefined;

  const nearestRiverCell = new Map<number, number>();
  for (const id of win.cellIds) {
    const river = Number(cellsR[id] ?? 0);
    if (!river) continue;
    const existing = nearestRiverCell.get(river);
    if (existing === undefined) {
      nearestRiverCell.set(river, id);
      continue;
    }
    const dist = (cellId: number) => {
      const p = cellsP[cellId] ?? [0, 0];
      return Math.hypot(p[0] - bx, p[1] - by);
    };
    if (dist(id) < dist(existing)) nearestRiverCell.set(river, id);
  }

  const rivers: RiverReading[] = [];
  for (const [riverId, cellId] of nearestRiverCell) {
    const river = riverById(riverId);
    if (!river) continue;
    const p = cellsP[cellId] ?? [bx, by];
    // A river through the burg's own cell has no bearing: the vector would be (0,0),
    // which compassBearing reports as due north.
    const bearingDeg = cellId === center ? undefined : compassBearing(p[0] - bx, p[1] - by);
    rivers.push({
      id: riverId,
      name: river.name ?? "",
      type: river.type ?? "",
      ...(bearingDeg !== undefined && { bearingDeg }),
      dischargeM3s: river.discharge ?? 0,
      widthKm: river.width ?? 0,
      throughBurg: Number(cellsR[center] ?? 0) === riverId
    });
  }
  rivers.sort((a, b) => b.dischargeM3s - a.dischargeM3s);

  const waterFeatures: WaterFeatureReading[] = [];
  const seenFeatures = new Set<number>();
  for (const id of win.cellIds) {
    const featureId = Number(cellsF[id]);
    if (seenFeatures.has(featureId)) continue;
    seenFeatures.add(featureId);
    const type = featureTypeById(featureId);
    if (type !== "ocean" && type !== "lake") continue;
    waterFeatures.push({ featureId, type, name: featureNameById(featureId) ?? "" });
  }
  waterFeatures.sort((a, b) => a.featureId - b.featureId);

  return {
    coastal,
    lakeside,
    ...(oceanBearingDeg !== undefined && { oceanBearingDeg }),
    ...(harbourSize !== undefined && { harbourSize }),
    rivers,
    waterFeatures
  };
}

export interface Terrain {
  elevationM: number;
  windowMinM: number;
  windowMaxM: number;
  reliefM: number;
  meanGradient: number;
  setting: "mountain" | "hills" | "plain" | "valley" | "plateau" | "coast";
}

const MOUNTAIN_ELEVATION_M = 2000;
const PLATEAU_ELEVATION_M = 800;
const HILLS_RELIEF_M = 300;

export function readTerrain(input: {
  window: CellWindow;
  cellsH: ArrayLike<number>;
  cellsP: ArrayLike<[number, number]>;
  heightExponent: number;
  distanceScale: number;
  coastal: boolean;
}): Terrain {
  const { window: win, cellsH, cellsP, heightExponent, distanceScale, coastal } = input;

  const elevationM = elevationMetres(Number(cellsH[win.center] ?? 0), heightExponent);
  const heights = win.cellIds.map(id => elevationMetres(Number(cellsH[id] ?? 0), heightExponent));
  const windowMinM = Math.min(...heights);
  const windowMaxM = Math.max(...heights);
  const reliefM = windowMaxM - windowMinM;
  const meanM = heights.reduce((sum, h) => sum + h, 0) / heights.length;

  const [cx, cy] = cellsP[win.center] ?? [0, 0];
  let gradientSum = 0;
  let gradientCount = 0;
  for (let i = 0; i < win.cellIds.length; i++) {
    const id = win.cellIds[i];
    if (id === win.center) continue;
    const p = cellsP[id];
    if (!p) continue;
    const runM = Math.hypot(p[0] - cx, p[1] - cy) * (distanceScale || 1) * 1000;
    if (runM <= 0) continue;
    gradientSum += Math.abs(heights[i] - elevationM) / runM;
    gradientCount++;
  }
  const meanGradient = gradientCount ? gradientSum / gradientCount : 0;

  const setting = ((): Terrain["setting"] => {
    if (coastal) return "coast";
    if (elevationM >= MOUNTAIN_ELEVATION_M) return "mountain";
    if (meanM - elevationM > RELIEF_TOLERANCE_M && reliefM >= HILLS_RELIEF_M) return "valley";
    if (reliefM >= HILLS_RELIEF_M) return "hills";
    if (elevationM >= PLATEAU_ELEVATION_M) return "plateau";
    return "plain";
  })();

  return { elevationM, windowMinM, windowMaxM, reliefM, meanGradient, setting };
}

export interface Climate {
  temperatureC: number;
  biome: string;
  biomeMix: { name: string; share: number }[];
}

export function readClimate(input: {
  window: CellWindow;
  cellsG: ArrayLike<number>;
  cellsBiome: ArrayLike<number>;
  gridTemp: ArrayLike<number>;
  biomeNameById: (biomeId: number) => string | undefined;
}): Climate {
  const { window: win, cellsG, cellsBiome, gridTemp, biomeNameById } = input;
  const gridCell = Number(cellsG[win.center] ?? 0);

  const counts = new Map<string, number>();
  for (const id of win.cellIds) {
    const name = biomeNameById(Number(cellsBiome[id] ?? 0));
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const biomeMix = total
    ? [...counts.entries()].map(([name, count]) => ({ name, share: count / total })).sort((a, b) => b.share - a.share)
    : [];

  return {
    temperatureC: Number(gridTemp[gridCell] ?? 0),
    biome: biomeNameById(Number(cellsBiome[win.center] ?? 0)) ?? "",
    biomeMix
  };
}

export const MAX_TOP_GOODS = 5;

export interface Economy {
  tradeRole?: "hub" | "waystation";
  marketId?: number;
  marketName?: string;
  isMarketCentre: boolean;
  topGoods: { id: number; name: string; units: number }[];
  treasuryBand: "poor" | "modest" | "prosperous" | "rich";
}

/**
 * Treasury is banded rather than passed through: the raw figure is a sim-internal
 * quantity that drifts as the economy sim changes, but the band survives that.
 */
function bandTreasury(treasury: number | undefined): Economy["treasuryBand"] {
  // No sim data collapses to the middle band rather than a distinct "unknown": the band is
  // consumed as a rendering hint, and an extra state would only ever be treated as average.
  if (treasury === undefined) return "modest";
  if (treasury < 0) return "poor";
  if (treasury < 500) return "modest";
  if (treasury < 5000) return "prosperous";
  return "rich";
}

export function readEconomy(input: {
  burgId: number;
  tradeRole?: "hub" | "waystation";
  treasury?: number;
  marketId?: number;
  marketById: (id: number) => { name?: string; centerBurgId?: number } | undefined;
  producedGoods: { goodId: number; units: number }[];
  goodNameById: (id: number) => string | undefined;
}): Economy {
  const { burgId, tradeRole, treasury, marketId, marketById, producedGoods, goodNameById } = input;

  const market = marketId === undefined ? undefined : marketById(marketId);

  // A burg can both gather and manufacture the same good, so sum per good before ranking.
  const unitsByGood = new Map<number, number>();
  for (const { goodId, units } of producedGoods) {
    unitsByGood.set(goodId, (unitsByGood.get(goodId) ?? 0) + units);
  }

  const topGoods = [...unitsByGood.entries()]
    .map(([goodId, units]) => ({ id: goodId, name: goodNameById(goodId), units }))
    .filter((g): g is { id: number; name: string; units: number } => Boolean(g.name))
    .sort((a, b) => b.units - a.units)
    .slice(0, MAX_TOP_GOODS);

  return {
    tradeRole,
    marketId: market ? marketId : undefined,
    marketName: market?.name,
    isMarketCentre: market?.centerBurgId === burgId,
    topGoods,
    treasuryBand: bandTreasury(treasury)
  };
}

export interface BurgContext {
  burg: {
    i: number;
    name: string;
    population: number;
    seedKey: string;
    capital: boolean;
    port: boolean;
    citadel: boolean;
    walls: boolean;
    plaza: boolean;
    temple: boolean;
    shanty: boolean;
    culture?: string;
  };
  window: { radiusKm: number; cellCount: number };
  approaches: Approach[];
  hydrology: Hydrology;
  terrain: Terrain;
  climate: Climate;
  economy: Economy;
}

export interface Corridor {
  sampledKm: number;
  elevationDeltaM: number;
  maxGradient: number;
  relief: "descent" | "ascent" | "valley" | "ridge" | "flat";
  followsRiver: boolean;
  riverId?: number;
  biomes: string[];
  minTempC: number;
}

/** Metres of height change below which a corridor reads as level. */
const RELIEF_TOLERANCE_M = 40;

export function readCorridor(input: {
  routeCells: number[];
  cellsH: ArrayLike<number>;
  cellsP: ArrayLike<[number, number]>;
  cellsR: ArrayLike<number>;
  cellsG: ArrayLike<number>;
  cellsBiome: ArrayLike<number>;
  gridTemp: ArrayLike<number>;
  biomeNameById: (id: number) => string | undefined;
  heightExponent: number;
  distanceScale: number;
}): Corridor {
  const { routeCells, cellsH, cellsP, cellsR, cellsG, cellsBiome, gridTemp, biomeNameById } = input;
  const { heightExponent, distanceScale } = input;

  const heights = routeCells.map(id => elevationMetres(Number(cellsH[id] ?? 0), heightExponent));

  const biomes: string[] = [];
  let minTempC = Number.POSITIVE_INFINITY;
  const riverCounts = new Map<number, number>();

  for (const id of routeCells) {
    const name = biomeNameById(Number(cellsBiome[id] ?? 0));
    if (name && !biomes.includes(name)) biomes.push(name);

    const temp = Number(gridTemp[Number(cellsG[id] ?? 0)] ?? 0);
    if (temp < minTempC) minTempC = temp;

    const river = Number(cellsR[id] ?? 0);
    if (river) riverCounts.set(river, (riverCounts.get(river) ?? 0) + 1);
  }
  if (!Number.isFinite(minTempC)) minTempC = 0;

  let sampledKm = 0;
  let maxGradient = 0;
  for (let i = 1; i < routeCells.length; i++) {
    const a = cellsP[routeCells[i - 1]];
    const b = cellsP[routeCells[i]];
    if (!a || !b) continue;
    const stepKm = Math.hypot(b[0] - a[0], b[1] - a[1]) * (distanceScale || 1);
    sampledKm += stepKm;
    if (stepKm > 0) {
      const gradient = Math.abs(heights[i] - heights[i - 1]) / (stepKm * 1000);
      if (gradient > maxGradient) maxGradient = gradient;
    }
  }

  const elevationDeltaM = heights.length > 1 ? heights.at(-1)! - heights[0] : 0;

  // A river only counts as followed when the corridor runs along it, not merely crosses it.
  let followsRiver = false;
  let riverId: number | undefined;
  for (const [id, count] of riverCounts) {
    if (count >= 2) {
      followsRiver = true;
      riverId = id;
      break;
    }
  }

  const relief = ((): Corridor["relief"] => {
    if (heights.length < 3) {
      if (elevationDeltaM > RELIEF_TOLERANCE_M) return "ascent";
      if (elevationDeltaM < -RELIEF_TOLERANCE_M) return "descent";
      return "flat";
    }
    const middle = heights.slice(1, -1);
    const midMin = Math.min(...middle);
    const midMax = Math.max(...middle);
    const first = heights[0];
    const last = heights.at(-1) as number;
    if (first - midMin > RELIEF_TOLERANCE_M && last - midMin > RELIEF_TOLERANCE_M) return "valley";
    if (midMax - first > RELIEF_TOLERANCE_M && midMax - last > RELIEF_TOLERANCE_M) return "ridge";
    if (elevationDeltaM > RELIEF_TOLERANCE_M) return "ascent";
    if (elevationDeltaM < -RELIEF_TOLERANCE_M) return "descent";
    return "flat";
  })();

  return { sampledKm, elevationDeltaM, maxGradient, relief, followsRiver, riverId, biomes, minTempC };
}

/**
 * A route's cells run end to end, so a through-route has two arms at the burg. Sample the
 * longer one — it carries more of the corridor's character.
 */
export function orderRouteCellsOutward(routeCells: number[], center: number): number[] {
  const at = routeCells.indexOf(center);
  if (at === -1) return [center];

  const backward = routeCells.slice(0, at + 1).reverse();
  const forward = routeCells.slice(at);
  return backward.length >= forward.length ? backward : forward;
}

const idIndexCache = new WeakMap<object, { length: number; index: Map<number, unknown> }>();

/**
 * Indices over pack arrays, memoised on the array's own identity — pack is replaced
 * wholesale on load and regenerate, so the new array simply misses the cache and no
 * invalidation call is needed. Without this, a CSV export of a large map rebuilds every
 * index once per burg. The length check also catches in-place additions or removals.
 */
function indexById<T extends { i: number }>(source: readonly T[] | undefined): Map<number, T> {
  if (!source) return new Map();
  const cached = idIndexCache.get(source as object);
  if (cached && cached.length === source.length) return cached.index as Map<number, T>;
  const index = new Map<number, T>(source.map(item => [item.i, item]));
  idIndexCache.set(source as object, { length: source.length, index: index as Map<number, unknown> });
  return index;
}

/** The only function here that reads globals. Everything above it is pure. */
export function buildBurgContext(burg: Burg): BurgContext {
  const { cells, features, routes, biomes, cultures } = pack;
  const cell = burg.cell;
  const {
    scale: populationRate,
    urbanization: { rate: urbanization }
  } = options.map.units.population;
  const distanceScale = options.map.units.distance.scale;

  const population = scaledPopulation(burg.population ?? 0, populationRate, urbanization);
  const radiusKm = effectiveWindowRadiusKm(DEFAULT_WINDOW_RADIUS_KM, distanceScale, Number(grid?.spacing ?? 0));
  const win = collectWindow(cell, cells.c, cells.p, radiusKm, distanceScale);

  const routeById = indexById(routes);
  // Flying burgs are not on the ground route network.
  const approaches = burg.flying ? [] : readApproaches(cell, cells.routes, cells.p, routeById);
  const windowCells = new Set(win.cellIds);
  const heightExponent = options.map.units.height.exponent;
  for (const approach of approaches) {
    const outward = orderRouteCellsOutward(routeById.get(approach.routeId)?.cells ?? [], cell);
    // Clip to the window: the readings must stay traceable to the window that produced them.
    const clipped: number[] = [];
    for (const id of outward) {
      if (!windowCells.has(id)) break;
      clipped.push(id);
    }
    approach.corridor = readCorridor({
      routeCells: clipped.length ? clipped : [cell],
      cellsH: cells.h,
      cellsP: cells.p,
      cellsR: cells.r,
      cellsG: cells.g,
      cellsBiome: cells.biome,
      gridTemp: grid.cells.temp,
      biomeNameById: id => biomes[id]?.name,
      heightExponent,
      distanceScale
    });
  }

  const hydrology = readHydrology({
    window: win,
    cellsHaven: cells.haven,
    cellsHarbor: cells.harbor,
    cellsF: cells.f,
    cellsP: cells.p,
    cellsR: cells.r,
    featureTypeById: id => features[id]?.type,
    featureNameById: id => features[id]?.name,
    riverById: id => indexById(pack.rivers).get(id),
    approaches,
    isPort: Number(burg.port ?? 0) > 0,
    population
  });

  const terrain = readTerrain({
    window: win,
    cellsH: cells.h,
    cellsP: cells.p,
    heightExponent,
    distanceScale,
    coastal: hydrology.coastal
  });

  const climate = readClimate({
    window: win,
    cellsG: cells.g,
    cellsBiome: cells.biome,
    gridTemp: grid.cells.temp,
    biomeNameById: id => biomes[id]?.name
  });

  const economy = readEconomy({
    burgId: burg.i,
    tradeRole: burg.tradeRole,
    treasury: burg.treasury,
    marketId: burg.market,
    marketById: id => indexById(pack.markets).get(id),
    // Both gathered (LocalRecord) and manufactured (MfgRecord) output counts: a tannery
    // or smithy characterises a settlement more than its hinterland's raw yield does.
    // Both carry goodId and units; DealRecord carries neither and drops out here.
    producedGoods: (burg.production ?? []).flatMap(record =>
      "goodId" in record && "units" in record ? [{ goodId: record.goodId, units: record.units }] : []
    ),
    goodNameById: id => indexById(pack.goods).get(id)?.name
  });

  return {
    burg: {
      i: burg.i,
      name: burg.name ?? "",
      population,
      seedKey: `${options.map.seed}${String(burg.i).padStart(4, "0")}`,
      capital: Boolean(burg.capital),
      port: Boolean(burg.port),
      citadel: Boolean(burg.citadel),
      walls: Boolean(burg.walls),
      plaza: Boolean(burg.plaza),
      temple: Boolean(burg.temple),
      shanty: Boolean(burg.shanty),
      culture: burg.culture === undefined ? undefined : cultures[burg.culture]?.name
    },
    window: { radiusKm: win.radiusKm, cellCount: win.cellIds.length },
    approaches,
    hydrology,
    terrain,
    climate,
    economy
  };
}
