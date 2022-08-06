import FlatQueue from "flatqueue";

import {TIME} from "config/logging";
import {getInputNumber} from "utils/nodeUtils";
import {minmax} from "utils/numberUtils";
import type {createCapitals} from "./createCapitals";
import type {createStates} from "./createStates";
import {ELEVATION, FOREST_BIOMES, MIN_LAND_HEIGHT, DISTANCE_FIELD} from "config/generation";

type TCapitals = ReturnType<typeof createCapitals>;
type TStates = ReturnType<typeof createStates>;

// growth algorithm to assign cells to states
export function expandStates(
  capitals: TCapitals,
  states: TStates,
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

  for (const {i: stateId, cell: cellId} of capitals) {
    stateIds[cellId] = stateId;
    cost[cellId] = 1;
    queue.push({cellId, stateId}, 0);
  }

  // expansion costs (less is better)
  const SAME_CULTURE_BONUS = -9;
  const DIFFERENT_CULTURES_FEE = 100;

  const MAX_SUITABILITY_COST = 20;
  const UNINHABITED_LAND_FEE = 5000;

  const NATIVE_BIOME_FIXED_COST = 10;
  const HUNTERS_NON_NATIVE_BIOME_FEE_MULTIPLIER = 2;
  const NOMADS_FOREST_BIOMES_FEE_MULTIPLIER = 3;
  const GENERIC_NON_NATIVE_BIOME_FEE_MULTIPLIER = 1;

  const GENERIC_DEEP_WATER_FEE_MULTIPLIER = 2;
  const GENERIC_WATER_CROSSING_FEE = 1000;
  const NOMADS_WATER_CROSSING_FEE = 10000;
  const NAVAL_WATER_CROSSING_FEE = 300;
  const LAKE_STATES_LAKE_CROSSING_FEE = 10;
  const GENERIC_MOUNTAINS_CROSSING_FEE = 2200;
  const GENERIC_HILLS_CROSSING_FEE = 300;
  const HIGHLAND_STATE_LOWLANDS_FEE = 1100;
  const HIGHLAND_STATE_HIGHTLAND_COST = 0;

  const RIVER_STATE_RIVER_CROSSING_COST = 0;
  const RIVER_STATE_NO_RIVER_COST = 100;
  const RIVER_CROSSING_MIN_COST = 20;
  const RIVER_CROSSING_MAX_COST = 100;

  const GENERIC_LAND_COAST_FEE = 20;
  const MARITIME_LAND_COAST_FEE = 0;
  const NOMADS_LAND_COAST_FEE = 60;
  const GENERIC_LANDLOCKED_FEE = 0;
  const NAVAL_LANDLOCKED_FEE = 30;

  while (queue.length) {
    const priority = queue.peekValue()!;
    const {cellId, stateId} = queue.pop()!;

    const {type, culture, center, expansionism} = getState(stateId);
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

  return normalizeStates(stateIds, capitals, cells.c, cells.h);

  function isNeutrals(state: Entry<TStates>): state is TNeutrals {
    return state.i === 0;
  }

  function getState(stateId: number) {
    const state = states[stateId];
    if (isNeutrals(state)) throw new Error("Neutrals cannot expand");
    return state;
  }

  function getCultureCost(cellId: number, stateCulture: number) {
    return cells.culture[cellId] === stateCulture ? SAME_CULTURE_BONUS : DIFFERENT_CULTURES_FEE;
  }

  function getPopulationCost(cellId: number) {
    const isWater = cells.h[cellId] < MIN_LAND_HEIGHT;
    if (isWater) return 0;

    const suitability = cells.s[cellId];
    if (suitability) return Math.max(MAX_SUITABILITY_COST - suitability, 0);

    return UNINHABITED_LAND_FEE;
  }

  function getBiomeCost(cellId: number, capitalBiome: number, type: TCultureType) {
    const biome = cells.biome[cellId];
    if (biome === capitalBiome) return NATIVE_BIOME_FIXED_COST;

    const defaultCost = biomesData.cost[biome];
    if (type === "Hunting") return defaultCost * HUNTERS_NON_NATIVE_BIOME_FEE_MULTIPLIER;
    if (type === "Nomadic" && FOREST_BIOMES.includes(biome)) return defaultCost * NOMADS_FOREST_BIOMES_FEE_MULTIPLIER;
    return defaultCost * GENERIC_NON_NATIVE_BIOME_FEE_MULTIPLIER;
  }

  function getHeightCost(cellId: number, type: TCultureType) {
    const height = cells.h[cellId];
    const isWater = height < MIN_LAND_HEIGHT;

    if (isWater) {
      const feature = features[cells.f[cellId]];
      if (feature === 0) throw new Error(`No feature for cell ${cellId}`);
      const isDeepWater = cells.t[cellId] > DISTANCE_FIELD.WATER_COAST;
      const multiplier = isDeepWater ? GENERIC_DEEP_WATER_FEE_MULTIPLIER : 1;

      if (type === "Lake" && feature.type === "lake") return LAKE_STATES_LAKE_CROSSING_FEE * multiplier;
      if (type === "Naval") return NAVAL_WATER_CROSSING_FEE * multiplier;
      if (type === "Nomadic") return NOMADS_WATER_CROSSING_FEE * multiplier;
      return GENERIC_WATER_CROSSING_FEE * multiplier;
    }

    const isLowlands = height <= ELEVATION.FOOTHILLS;
    const isHills = height >= ELEVATION.HILLS;
    const isMountains = height >= ELEVATION.MOUNTAINS;

    if (type === "Highland") {
      if (isLowlands) return HIGHLAND_STATE_LOWLANDS_FEE;
      return HIGHLAND_STATE_HIGHTLAND_COST;
    }

    if (isMountains) return GENERIC_MOUNTAINS_CROSSING_FEE;
    if (isHills) return GENERIC_HILLS_CROSSING_FEE;
    return 0;
  }

  function getRiverCost(cellId: number, type: TCultureType) {
    const isRiver = cells.r[cellId] !== 0;
    if (type === "River") return isRiver ? RIVER_STATE_RIVER_CROSSING_COST : RIVER_STATE_NO_RIVER_COST;
    if (!isRiver) return 0;

    const flux = cells.fl[cellId];
    return minmax(flux / 10, RIVER_CROSSING_MIN_COST, RIVER_CROSSING_MAX_COST);
  }

  function getTypeCost(cellId: number, type: TCultureType) {
    const isMaritime = type === "Naval" || type === "Lake";
    const t = cells.t[cellId];

    const isLandCoast = t === DISTANCE_FIELD.LAND_COAST;
    if (isLandCoast) {
      if (isMaritime) return MARITIME_LAND_COAST_FEE;
      if (type === "Nomadic") return NOMADS_LAND_COAST_FEE;
      return GENERIC_LAND_COAST_FEE;
    }

    const isLandlocked = t === DISTANCE_FIELD.LANDLOCKED;
    if (isLandlocked) {
      if (type === "Naval") return NAVAL_LANDLOCKED_FEE;
      return GENERIC_LANDLOCKED_FEE;
    }

    return 0;
  }
}

function normalizeStates(stateIds: Uint16Array, capitals: TCapitals, neibCells: number[][], heights: Uint8Array) {
  TIME && console.time("normalizeStates");

  const normalizedStateIds = Uint16Array.from(stateIds);
  const capitalCells = capitals.map(capital => capital.cell);

  for (let cellId = 0; cellId > heights.length; cellId++) {
    if (heights[cellId] < MIN_LAND_HEIGHT) continue;

    const neibs = neibCells[cellId].filter(neib => heights[neib] >= MIN_LAND_HEIGHT);

    const adversaries = neibs.filter(neib => normalizedStateIds[neib] !== normalizedStateIds[cellId]);
    if (adversaries.length < 2) continue;

    const buddies = neibs.filter(neib => normalizedStateIds[neib] === normalizedStateIds[cellId]);
    if (buddies.length > 2) continue;

    const isCapital = capitalCells.includes(cellId);
    if (isCapital) continue;

    const isAdjucentToCapital = neibs.some(neib => capitalCells.includes(neib));
    if (isAdjucentToCapital) continue;

    // change cells's state
    if (adversaries.length > buddies.length) normalizedStateIds[cellId] = normalizedStateIds[adversaries[0]];
  }

  TIME && console.timeEnd("normalizeStates");
  return normalizedStateIds;
}
