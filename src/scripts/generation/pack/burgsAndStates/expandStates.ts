import FlatQueue from "flatqueue";

import {TIME} from "config/logging";
import {getInputNumber} from "utils/nodeUtils";
import {minmax} from "utils/numberUtils";
import {ELEVATION, FOREST_BIOMES, MIN_LAND_HEIGHT, DISTANCE_FIELD} from "config/generation";
import type {TStateData} from "./createStateData";

const costs = {
  SAME_CULTURE: -9,
  DIFFERENT_CULTURES: 100,

  MAX_SUITABILITY: 20,
  UNINHABITED_LAND: 5000,
  NATIVE_BIOME_FIXED: 10,

  GENERIC_WATER_CROSSING: 1000,
  NOMADS_WATER_CROSSING: 10000,
  NAVAL_WATER_CROSSING: 300,
  LAKE_STATES_LAKE_CROSSING: 10,
  GENERIC_MOUNTAINS_CROSSING: 2200,
  GENERIC_HILLS_CROSSING: 300,
  HIGHLAND_STATE_LOWLANDS: 1100,
  HIGHLAND_STATE_HIGHTLAND: 0,

  RIVER_STATE_RIVER_CROSSING: 0,
  RIVER_STATE_NO_RIVER: 100,
  RIVER_CROSSING_MIN: 20,
  RIVER_CROSSING_MAX: 100,

  GENERIC_LAND_COAST: 20,
  MARITIME_LAND_COAST: 0,
  NOMADS_LAND_COAST: 60,
  GENERIC_LANDLOCKED: 0,
  NAVAL_LANDLOCKED: 30
};

const multipliers = {
  HUNTERS_NON_NATIVE_BIOME: 2,
  NOMADS_FOREST_BIOMES: 3,
  GENERIC_NON_NATIVE_BIOME: 1,
  GENERIC_DEEP_WATER: 2
};

// growth algorithm to assign cells to states
export function expandStates(
  capitalCells: Map<number, boolean>,
  statesData: TStateData[],
  features: TPackFeatures,
  cells: Pick<IPack["cells"], "c" | "h" | "f" | "t" | "r" | "fl" | "s" | "biome" | "culture">
) {
  TIME && console.time("expandStates");

  const cellsNumber = cells.s.length;
  const stateIds = new Uint16Array(cellsNumber);

  const queue = new FlatQueue<{cellId: number; stateId: number}>();
  const cost: number[] = [];

  const neutralInput = getInputNumber("neutralInput");
  const maxExpansionCost = (cellsNumber / 2) * neutralInput * statesNeutral;

  for (const {i: stateId, center: cellId} of statesData) {
    stateIds[cellId] = stateId;
    cost[cellId] = 1;
    queue.push({cellId, stateId}, 0);
  }

  const statesMap = new Map<number, TStateData>(statesData.map(stateData => [stateData.i, stateData]));

  while (queue.length) {
    const priority = queue.peekValue()!;
    const {cellId, stateId} = queue.pop()!;

    const {type, culture, center, expansionism} = statesMap.get(stateId)!;
    const capitalBiome = cells.biome[center];

    cells.c[cellId].forEach(neibCellId => {
      if (neibCellId === center && stateIds[neibCellId]) return; // do not overwrite capital cells

      const cultureCost = getCultureCost(culture, neibCellId);
      const populationCost = getPopulationCost(neibCellId);
      const biomeCost = getBiomeCost(neibCellId, capitalBiome, type);
      const heightCost = getHeightCost(neibCellId, type);
      const riverCost = getRiverCost(neibCellId, type);
      const typeCost = getTypeCost(neibCellId, type);

      const cellCost = Math.max(cultureCost + populationCost + biomeCost + heightCost + riverCost + typeCost, 0);
      const totalCost = priority + 10 + cellCost / expansionism;
      if (totalCost > maxExpansionCost) return;

      if (!cost[neibCellId] || totalCost < cost[neibCellId]) {
        if (cells.h[neibCellId] >= MIN_LAND_HEIGHT) stateIds[neibCellId] = stateId; // assign state to cell
        cost[neibCellId] = totalCost;

        queue.push({cellId: neibCellId, stateId}, totalCost);
      }
    });
  }

  TIME && console.timeEnd("expandStates");

  return normalizeStates(stateIds, capitalCells, cells.c, cells.h);

  function getCultureCost(cellId: number, stateCulture: number) {
    return cells.culture[cellId] === stateCulture ? costs.SAME_CULTURE : costs.DIFFERENT_CULTURES;
  }

  function getPopulationCost(cellId: number) {
    const isWater = cells.h[cellId] < MIN_LAND_HEIGHT;
    if (isWater) return 0;

    const suitability = cells.s[cellId];
    if (suitability) return Math.max(costs.MAX_SUITABILITY - suitability, 0);

    return costs.UNINHABITED_LAND;
  }

  function getBiomeCost(cellId: number, capitalBiome: number, type: TCultureType) {
    const biome = cells.biome[cellId];
    if (biome === capitalBiome) return costs.NATIVE_BIOME_FIXED;

    const defaultCost = biomesData.cost[biome];
    if (type === "Hunting") return defaultCost * multipliers.HUNTERS_NON_NATIVE_BIOME;
    if (type === "Nomadic" && FOREST_BIOMES.includes(biome)) return defaultCost * multipliers.NOMADS_FOREST_BIOMES;
    return defaultCost * multipliers.GENERIC_NON_NATIVE_BIOME;
  }

  function getHeightCost(cellId: number, type: TCultureType) {
    const height = cells.h[cellId];
    const isWater = height < MIN_LAND_HEIGHT;

    if (isWater) {
      const feature = features[cells.f[cellId]];
      if (feature === 0) throw new Error(`No feature for cell ${cellId}`);
      const isDeepWater = cells.t[cellId] > DISTANCE_FIELD.WATER_COAST;
      const multiplier = isDeepWater ? multipliers.GENERIC_DEEP_WATER : 1;

      if (type === "Lake" && feature.type === "lake") return costs.LAKE_STATES_LAKE_CROSSING * multiplier;
      if (type === "Naval") return costs.NAVAL_WATER_CROSSING * multiplier;
      if (type === "Nomadic") return costs.NOMADS_WATER_CROSSING * multiplier;
      return costs.GENERIC_WATER_CROSSING * multiplier;
    }

    const isLowlands = height <= ELEVATION.FOOTHILLS;
    const isHills = height >= ELEVATION.HILLS;
    const isMountains = height >= ELEVATION.MOUNTAINS;

    if (type === "Highland") {
      if (isLowlands) return costs.HIGHLAND_STATE_LOWLANDS;
      return costs.HIGHLAND_STATE_HIGHTLAND;
    }

    if (isMountains) return costs.GENERIC_MOUNTAINS_CROSSING;
    if (isHills) return costs.GENERIC_HILLS_CROSSING;
    return 0;
  }

  function getRiverCost(cellId: number, type: TCultureType) {
    const isRiver = cells.r[cellId] !== 0;
    if (type === "River") return isRiver ? costs.RIVER_STATE_RIVER_CROSSING : costs.RIVER_STATE_NO_RIVER;
    if (!isRiver) return 0;

    const flux = cells.fl[cellId];
    return minmax(flux / 10, costs.RIVER_CROSSING_MIN, costs.RIVER_CROSSING_MAX);
  }

  function getTypeCost(cellId: number, type: TCultureType) {
    const isMaritime = type === "Naval" || type === "Lake";
    const t = cells.t[cellId];

    const isLandCoast = t === DISTANCE_FIELD.LAND_COAST;
    if (isLandCoast) {
      if (isMaritime) return costs.MARITIME_LAND_COAST;
      if (type === "Nomadic") return costs.NOMADS_LAND_COAST;
      return costs.GENERIC_LAND_COAST;
    }

    const isLandlocked = t === DISTANCE_FIELD.LANDLOCKED;
    if (isLandlocked) {
      if (type === "Naval") return costs.NAVAL_LANDLOCKED;
      return costs.GENERIC_LANDLOCKED;
    }

    return 0;
  }
}

function normalizeStates(
  stateIds: Uint16Array,
  capitalCells: Map<number, boolean>,
  neibCells: number[][],
  heights: Uint8Array
) {
  TIME && console.time("normalizeStates");

  const normalizedStateIds = Uint16Array.from(stateIds);

  for (let cellId = 0; cellId < heights.length; cellId++) {
    if (heights[cellId] < MIN_LAND_HEIGHT) continue;

    const neibs = neibCells[cellId].filter(neib => heights[neib] >= MIN_LAND_HEIGHT);

    const adversaries = neibs.filter(neib => normalizedStateIds[neib] !== normalizedStateIds[cellId]);
    if (adversaries.length < 2) continue;

    const buddies = neibs.filter(neib => normalizedStateIds[neib] === normalizedStateIds[cellId]);
    if (buddies.length > 2) continue;

    const isCapital = capitalCells.has(cellId);
    if (isCapital) continue;

    const isAdjucentToCapital = neibs.some(neib => capitalCells.has(neib));
    if (isAdjucentToCapital) continue;

    // change cells's state
    if (adversaries.length > buddies.length) normalizedStateIds[cellId] = normalizedStateIds[adversaries[0]];
  }

  TIME && console.timeEnd("normalizeStates");
  return normalizedStateIds;
}
