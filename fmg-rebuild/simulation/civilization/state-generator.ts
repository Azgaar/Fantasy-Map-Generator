import { Grid } from "../../core/types";
import { Burg } from "./burg-generator";

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

const BIOMES_COST = [10, 10, 10, 30, 30, 22, 10, 30, 50, 70, 90, 100, 10, 10];
const BIOMES_HABITABILITY = [0, 0, 0, 4, 10, 22, 25, 50, 100, 80, 50, 12, 0, 0];

function getBiomeCost(b: number, biome: number, type: string) {
  if (b === biome) return 10;
  const costVal = BIOMES_COST[biome] || 10;
  if (type === "Hunting") return costVal * 2;
  if (type === "Nomadic" && biome > 4 && biome < 10) return costVal * 3;
  return costVal;
}

function getHeightCost(h: number, type: string, biome: number) {
  const isHabitableWater = h < 20 && BIOMES_HABITABILITY[biome] > 0;
  if (isHabitableWater) {
    if (type !== "Aquatic") return 3000;
    return 0;
  }
  if (type === "Aquatic" && h >= 20) return 3000;
  if (!isHabitableWater) {
    if (type === "Naval" && h < 20) return 300;
    if (type === "Nomadic" && h < 20) return 10000;
    if (h < 20) return 1000;
  }
  if (type === "Highland" && h < 44) return 3000;
  if (type === "Highland") return 0;
  if (h >= 67) return 2200;
  if (h >= 44) return 300;
  return 0;
}

function getTypeCost(t: number, type: string) {
  if (t === 1) return type === "Naval" || type === "Lake" ? 0 : type === "Nomadic" ? 60 : 20;
  if (t === 2) return type === "Naval" || type === "Nomadic" ? 30 : 0;
  if (t !== -1) return type === "Naval" || type === "Lake" ? 100 : 0;
  return 0;
}

function getStateExpansionCost(
  fromIdx: number,
  toIdx: number,
  heights: Uint8Array,
  cellCultures: Uint8Array,
  biomeTo: number,
  nativeBiome: number,
  stateType: string,
  cellTypeTo: number
): number {
  const hTo = heights[toIdx];
  const cultureCost = cellCultures[fromIdx] === cellCultures[toIdx] ? -9 : 100;
  
  const isHabitableWater = hTo < 20 && BIOMES_HABITABILITY[biomeTo] > 0;
  const populationCost = hTo < 20 && stateType !== "Aquatic" && !isHabitableWater ? 0 : 50;
  
  const bCost = getBiomeCost(nativeBiome, biomeTo, stateType);
  const hCost = getHeightCost(hTo, stateType, biomeTo);
  const tCost = getTypeCost(cellTypeTo, stateType);
  
  const cellCost = Math.max(cultureCost + populationCost + bCost + hCost + tCost, 0);
  return 10 + cellCost;
}

export function generateStates(
  grid: Grid,
  heights: Uint8Array,
  cellCultures: Uint8Array,
  burgs: Burg[],
  count = 5,
  biomes?: Uint8Array
): { states: State[]; cellStates: Uint8Array } {
  const pointsN = heights.length;
  const cellStates = new Uint8Array(pointsN).fill(0); // 0 = Neutral territory
  const states: State[] = [];
  const actualBiomes = biomes || new Uint8Array(pointsN).fill(3);

  if (burgs.length === 0) {
    return { states, cellStates };
  }

  // Sort burgs by population descending to select the largest as capitals
  const sortedBurgs = [...burgs].sort((a, b) => b.population - a.population);
  const actualCount = Math.min(count, sortedBurgs.length);

  const queue: { cellId: number; cost: number; stateId: number; nativeBiome: number; stateType: string }[] = [];
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
    queue.push({ cellId: capitalBurg.cell, cost: 0, stateId, nativeBiome, stateType });
  }

  // Dijkstra expansion
  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const curr = queue.shift()!;

    if (curr.cost > minCost[curr.cellId]) continue;

    const neighbors = grid.cells.c[curr.cellId] || [];
    for (const n of neighbors) {
      const biomeTo = actualBiomes[n];
      const cellTypeTo = grid.cells.t ? grid.cells.t[n] || 0 : 0;
      const edgeCost = getStateExpansionCost(
        curr.cellId,
        n,
        heights,
        cellCultures,
        biomeTo,
        curr.nativeBiome,
        curr.stateType,
        cellTypeTo
      );
      const nextCost = curr.cost + edgeCost / 1.0; // simple expansion rate scaling

      // Limit max state growth size
      if (nextCost < 5000.0 && nextCost < minCost[n]) {
        minCost[n] = nextCost;
        cellStates[n] = curr.stateId;
        queue.push({
          cellId: n,
          cost: nextCost,
          stateId: curr.stateId,
          nativeBiome: curr.nativeBiome,
          stateType: curr.stateType
        });
      }
    }
  }

  return { states, cellStates };
}
