import { Grid } from "../../core/types";
import { Burg } from "./burg-generator";
import FlatQueue from "flatqueue";

export interface State {
  id: number;
  name: string;
  color: string;
  capital: number; // Burg ID
  center: number; // Cell ID of capital
}

const STATE_COLORS = [
  "#2563eb", "#16a34a", "#ca8a04", "#d97706", "#dc2626",
  "#7c3aed", "#0891b2", "#db2777", "#4f46e5", "#0d9488"
];

const STATE_NAMES = [
  "Republic of", "Kingdom of", "Empire of", "Principality of",
  "Grand Duchy of", "Commonwealth of", "Federation of", "Union of"
];

const biomesData = {
  habitability: [0, 0, 0, 4, 10, 22, 25, 50, 100, 80, 50, 12, 0, 0],
  cost: [10, 10, 10, 30, 30, 22, 10, 30, 50, 70, 90, 100, 10, 10]
};

function getBiomeCost(b: number, biome: number, type: string) {
  if (b === biome) return 10; // tiny penalty for native biome
  if (type === "Hunting") return biomesData.cost[biome] * 2; // non-native biome penalty for hunters
  if (type === "Nomadic" && biome > 4 && biome < 10) return biomesData.cost[biome] * 3; // forest biome penalty for nomads
  return biomesData.cost[biome]; // general non-native biome penalty
}

function getHeightCost(h: number, area: number, type: string, biome: number) {
  const isHabitableWater = h < 20 && biomesData.habitability[biome] > 0;
  if (isHabitableWater) {
    if (type !== "Aquatic") return 3000; // massive penalty for non-aquatics entering the sea
    return 0; // aquatics thrive
  }
  if (type === "Aquatic" && h >= 20) return 3000; // massive penalty for aquatics going on land!
  if (!isHabitableWater) {
    if (type === "Naval" && h < 20) return 300; // low sea/lake crossing penalty for Naval cultures
    if (type === "Nomadic" && h < 20) return 10000; // giant sea/lake crossing penalty for Nomads
    if (h < 20) return 1000; // general sea/lake crossing penalty
  }
  if (type === "Highland" && h < 44) return 3000; // giant penalty for highlanders on lowlands
  if (type === "Highland") return 0; // no penalty for highlanders on highlands
  if (h >= 67) return 2200; // general mountains crossing penalty
  if (h >= 44) return 300; // general hills crossing penalty
  return 0;
}

function getRiverCost(r: number, flux: number, type: string) {
  if (type === "River") return r ? 0 : 100; // penalty for river cultures
  if (!r) return 0; // no penalty for others if there is no river
  return Math.max(20, Math.min(100, flux / 10)); // river penalty from 20 to 100 based on flux
}

function getTypeCost(t: number, type: string) {
  if (t === 1) return type === "Naval" || type === "Lake" ? 0 : type === "Nomadic" ? 60 : 20; // penalty for coastline
  if (t === 2) return type === "Naval" || type === "Nomadic" ? 30 : 0; // low penalty for land level 2 for Navals and nomads
  if (t !== -1) return type === "Naval" || type === "Lake" ? 100 : 0; // penalty for mainland for navals
  return 0;
}

export function generateStates(
  grid: Grid,
  heights: Uint8Array,
  cellCultures: Uint8Array,
  burgs: Burg[],
  count = 5,
  biomes?: Uint8Array,
  rivers?: Uint16Array,
  flux?: Float32Array,
  populations?: Float32Array
): { states: State[]; cellStates: Uint8Array } {
  const pointsN = heights.length;
  const cellStates = new Uint8Array(pointsN).fill(0); // 0 = Neutral territory
  const states: State[] = [];
  const actualBiomes = biomes || new Uint8Array(pointsN).fill(3);
  const safeRivers = rivers || new Uint16Array(pointsN).fill(0);
  const safeFlux = flux || new Float32Array(pointsN).fill(0);
  const safePops = populations || new Float32Array(pointsN).fill(0);
  const safeTypes = grid.cells.t || new Int8Array(pointsN).fill(0);
  const safeAreas = grid.cells.area || new Float32Array(pointsN).fill(1);

  if (burgs.length === 0) {
    return { states, cellStates };
  }

  // Sort burgs by population descending to select the largest as capitals
  const sortedBurgs = [...burgs].sort((a, b) => b.population - a.population);
  const actualCount = Math.min(count, sortedBurgs.length);

  type QItem = { cellId: number; cost: number; stateId: number; nativeBiome: number; stateType: string; culture: number; expansionism: number };
  const queue = new FlatQueue<QItem>();
  const minCost = new Float32Array(pointsN).fill(Infinity);

  for (let i = 0; i < actualCount; i++) {
    const stateId = i + 1;
    const capitalBurg = sortedBurgs[i];
    capitalBurg.isCapital = true;

    const stateName = `${STATE_NAMES[i % STATE_NAMES.length]} ${capitalBurg.name.replace("burg", "").replace("grad", "")}`;
    const stateType = i === 0 ? "Naval" : i === 1 ? "Nomadic" : "Generic";

    states.push({
      id: stateId,
      name: stateName,
      color: STATE_COLORS[i % STATE_COLORS.length],
      capital: capitalBurg.id,
      center: capitalBurg.cell
    });

    cellStates[capitalBurg.cell] = stateId;
    minCost[capitalBurg.cell] = 0;
    
    const nativeBiome = actualBiomes[capitalBurg.cell];
    const culture = cellCultures[capitalBurg.cell];
    queue.push({ cellId: capitalBurg.cell, cost: 0, stateId, nativeBiome, stateType, culture, expansionism: 1.0 }, 0);
  }

  const growthRate = pointsN / 2; // limit cost for state growth

  // Dijkstra expansion
  while (queue.length > 0) {
    const curr = queue.pop()!;

    if (curr.cost > minCost[curr.cellId]) continue;

    const neighbors = grid.cells.c[curr.cellId] || [];
    for (const n of neighbors) {
      const targetBiome = actualBiomes[n];
      const hTo = heights[n];
      const typeTo = safeTypes[n];

      const cultureCost = curr.culture === cellCultures[n] ? -9 : 100;
      const isHabitableWater = hTo < 20 && biomesData.habitability[targetBiome] > 0;
      const populationCost = hTo < 20 && curr.stateType !== "Aquatic" && !isHabitableWater
            ? 0
            : safePops[n]
              ? Math.max(20 - safePops[n], 0)
              : 50;

      const biomeCost = getBiomeCost(curr.nativeBiome, targetBiome, curr.stateType);
      const heightCost = getHeightCost(hTo, safeAreas[n], curr.stateType, targetBiome);
      const riverCost = getRiverCost(safeRivers[n], safeFlux[n], curr.stateType);
      const typeCost = getTypeCost(typeTo, curr.stateType);

      const cellCost = Math.max(cultureCost + populationCost + biomeCost + heightCost + riverCost + typeCost, 0);
      const totalCost = curr.cost + 10 + cellCost / curr.expansionism;

      if (totalCost > growthRate) continue;

      if (totalCost < minCost[n]) {
        minCost[n] = totalCost;
        if (hTo >= 20 || curr.stateType === "Aquatic" || isHabitableWater) {
             cellStates[n] = curr.stateId;
        }

        queue.push({
          cellId: n,
          cost: totalCost,
          stateId: curr.stateId,
          nativeBiome: curr.nativeBiome,
          stateType: curr.stateType,
          culture: curr.culture,
          expansionism: curr.expansionism
        }, totalCost);
      }
    }
  }

  return { states, cellStates };
}
