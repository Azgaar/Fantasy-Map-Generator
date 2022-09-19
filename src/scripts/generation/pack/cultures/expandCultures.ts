import FlatQueue from "flatqueue";

import {DISTANCE_FIELD, ELEVATION, FOREST_BIOMES, MIN_LAND_HEIGHT} from "config/generation";
import {TIME} from "config/logging";
import {getInputNumber} from "utils/nodeUtils";
import {minmax} from "utils/numberUtils";
import {isCulture} from "utils/typeUtils";

const {LAND_COAST, LANDLOCKED, WATER_COAST} = DISTANCE_FIELD;
const {MOUNTAINS, HILLS} = ELEVATION;

// expand cultures across the map (Dijkstra-like algorithm)
export function expandCultures(
  cultures: TCultures,
  features: TPackFeatures,
  cells: Pick<IPack["cells"], "c" | "area" | "h" | "t" | "f" | "r" | "fl" | "biome" | "pop">
) {
  TIME && console.time("expandCultures");

  const cultureIds = new Uint16Array(cells.h.length); // cell cultures
  const queue = new FlatQueue<{cellId: number; cultureId: number}>();

  cultures.filter(isCulture).forEach(culture => {
    queue.push({cellId: culture.center, cultureId: culture.i}, 0);
  });

  const cellsNumberFactor = cells.h.length / 1.6;
  const maxExpansionCost = cellsNumberFactor * getInputNumber("neutralInput"); // limit cost for culture growth
  const cost: number[] = [];

  while (queue.length) {
    const priority = queue.peekValue()!;
    const {cellId, cultureId} = queue.pop()!;

    const {type, expansionism, center} = getCulture(cultureId);
    const cultureBiome = cells.biome[center];

    cells.c[cellId].forEach(neibCellId => {
      const biomeCost = getBiomeCost(neibCellId, cultureBiome, type);
      const heightCost = getHeightCost(neibCellId, cells.h[neibCellId], type);
      const riverCost = getRiverCost(cells.r[neibCellId], neibCellId, type);
      const typeCost = getTypeCost(cells.t[neibCellId], type);

      const totalCost = priority + (biomeCost + heightCost + riverCost + typeCost) / expansionism;
      if (totalCost > maxExpansionCost) return;

      if (!cost[neibCellId] || totalCost < cost[neibCellId]) {
        if (cells.pop[neibCellId] > 0) cultureIds[neibCellId] = cultureId; // assign culture to populated cell
        cost[neibCellId] = totalCost;
        queue.push({cellId: neibCellId, cultureId}, totalCost);
      }
    });
  }

  TIME && console.timeEnd("expandCultures");
  return cultureIds;

  function getCulture(cultureId: number) {
    const culture = cultures[cultureId];
    if (!isCulture(culture)) throw new Error("Wilderness cannot expand");
    return culture;
  }

  function getBiomeCost(cellId: number, cultureBiome: number, type: TCultureType) {
    const biome = cells.biome[cellId];
    if (cultureBiome === biome) return 10; // tiny penalty for native biome
    if (type === "Hunting") return biomesData.cost[biome] * 5; // non-native biome penalty for hunters
    if (type === "Nomadic" && FOREST_BIOMES.includes(biome)) return biomesData.cost[biome] * 10; // forest biome penalty for nomads
    return biomesData.cost[biome] * 2; // general non-native biome penalty
  }

  function getHeightCost(cellId: number, height: number, type: TCultureType) {
    if (height < MIN_LAND_HEIGHT) {
      const feature = features[cells.f[cellId]];
      const area = cells.area[cellId];

      if (type === "Lake" && feature && feature.type === "lake") return 10; // almost lake crossing penalty for Lake cultures
      if (type === "Naval") return area * 2; // low sea or lake crossing penalty for Naval cultures
      if (type === "Nomadic") return area * 50; // giant sea or lake crossing penalty for Nomads
      return area * 6; // general sea or lake crossing penalty
    }

    if (type === "Highland") {
      if (height >= MOUNTAINS) return 0; // no penalty for highlanders on highlands
      if (height < HILLS) return 3000; // giant penalty for highlanders on lowlands
      return 100; // penalty for highlanders on hills
    }

    if (height >= MOUNTAINS) return 200; // general mountains crossing penalty
    if (height >= HILLS) return 30; // general hills crossing penalty
    return 0;
  }

  function getRiverCost(riverId: number, cellId: number, type: TCultureType) {
    if (type === "River") return riverId ? 0 : 100; // penalty for river cultures
    if (!riverId) return 0; // no penalty for others if there is no river
    return minmax(cells.fl[cellId] / 10, 20, 100); // river penalty from 20 to 100 based on flux
  }

  function getTypeCost(t: number, type: TCultureType) {
    if (t === LAND_COAST) return type === "Naval" || type === "Lake" ? 0 : type === "Nomadic" ? 60 : 20; // penalty for coastline
    if (t === LANDLOCKED) return type === "Naval" || type === "Nomadic" ? 30 : 0; // low penalty for land level 2 for Navals and nomads
    if (t !== WATER_COAST) return type === "Naval" || type === "Lake" ? 100 : 0; // penalty for mainland for navals
    return 0;
  }
}
