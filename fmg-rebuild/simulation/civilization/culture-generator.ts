import { Grid } from "../../core/types";
import { createPRNG, PRNG } from "../../core/random";
import FlatQueue from "flatqueue";

export interface Culture {
  id: number;
  name: string;
  color: string;
  center: number; // cell ID of capital/origin
}

const CULTURE_COLORS = [
  "#e11d48", "#2563eb", "#16a34a", "#ca8a04", "#9333ea",
  "#0891b2", "#ea580c", "#db2777", "#4f46e5", "#65a30d"
];

const CULTURE_NAMES = [
  "Common", "Highland", "Riverine", "Nomadic", "Maritime",
  "Oasis", "Forest", "Glacial", "Sylvan", "Steppe"
];

// biomesData for basic habitability checking
const biomesData = {
  habitability: [0, 0, 0, 4, 10, 22, 25, 50, 100, 80, 50, 12, 0, 0],
  cost: [10, 10, 10, 30, 30, 22, 10, 30, 50, 70, 90, 100, 10, 10]
};

function getBiomeCost(b: number, biome: number, type: string): number {
  if (b === biome) return 10; // tiny penalty for native biome
  if (type === "Hunting") return biomesData.cost[biome] * 5; // non-native biome penalty for hunters
  if (type === "Nomadic" && biome > 4 && biome < 10) return biomesData.cost[biome] * 10; // forest biome penalty for nomads
  return biomesData.cost[biome] * 2; // general non-native biome penalty
}

function getHeightCost(h: number, area: number, type: string, biome: number): number {
  const isHabitableWater = h < 20 && biomesData.habitability[biome] > 0;
  if (isHabitableWater) {
    if (type !== "Aquatic") return area * 100; // massive penalty for non-aquatics entering the sea
    return 0; // aquatics thrive
  }
  if (type === "Aquatic" && h >= 20) return area * 100; // massive penalty for aquatics going on land!
  if (!isHabitableWater) {
    if (type === "Naval" && h < 20) return area * 2; // low sea/lake crossing penalty for Naval cultures
    if (type === "Nomadic" && h < 20) return area * 50; // giant sea/lake crossing penalty for Nomads
    if (h < 20) return area * 6; // general sea/lake crossing penalty
  }
  if (type === "Highland" && h < 44) return 3000; // giant penalty for highlanders on lowlands
  if (type === "Highland" && h < 62) return 200; // giant penalty for highlanders on lowhills
  if (type === "Highland") return 0; // no penalty for highlanders on highlands
  if (h >= 67) return 200; // general mountains crossing penalty
  if (h >= 44) return 30; // general hills crossing penalty
  return 0;
}

function getRiverCost(riverId: number, flux: number, type: string): number {
  if (type === "River") return riverId ? 0 : 100; // penalty for river cultures
  if (!riverId) return 0; // no penalty for others if there is no river
  return Math.max(20, Math.min(100, flux / 10)); // river penalty from 20 to 100 based on flux
}

function getTypeCost(t: number, type: string): number {
  if (t === 1) return type === "Naval" || type === "Lake" ? 0 : type === "Nomadic" ? 60 : 20; // penalty for coastline
  if (t === 2) return type === "Naval" || type === "Nomadic" ? 30 : 0; // low penalty for land level 2 for Navals and nomads
  if (t !== -1) return type === "Naval" || type === "Lake" ? 100 : 0; // penalty for mainland for navals
  return 0;
}

export function generateCultures(
  grid: Grid,
  heights: Uint8Array,
  biomes: Uint8Array,
  count = 6,
  seed: string,
  flux?: Float32Array,
  rivers?: Uint16Array
): { cultures: Culture[]; cellCultures: Uint8Array } {
  const pointsN = heights.length;
  const cellCultures = new Uint8Array(pointsN).fill(0); // 0 = Wild / No Culture
  const cultures: Culture[] = [];
  const rng = createPRNG(seed);

  const safeFlux = flux || new Float32Array(pointsN).fill(0);
  const safeRivers = rivers || new Uint16Array(pointsN).fill(0);
  const safeTypes = grid.cells.t || new Int8Array(pointsN).fill(0);

  // 1. Select culture seeds based on suitability
  const candidates: number[] = [];
  for (let i = 0; i < pointsN; i++) {
    if (heights[i] >= 20 && biomes[i] !== 11) {
      candidates.push(i);
    }
  }

  if (candidates.length === 0) {
    return { cultures, cellCultures };
  }

  // Shuffle candidates
  candidates.sort(() => rng() - 0.5);

  const actualCount = Math.min(count, candidates.length);
  const centers = candidates.slice(0, actualCount);

  // Initialize seeds
  type QItem = { cellId: number; cost: number; cultureId: number; type: string; nativeBiome: number; expansionism: number };
  const queue = new FlatQueue<QItem>();
  for (let i = 0; i < actualCount; i++) {
    const cultureId = i + 1;
    const center = centers[i];
    const name = CULTURE_NAMES[i % CULTURE_NAMES.length];
    cultures.push({
      id: cultureId,
      name: name + "ic",
      color: CULTURE_COLORS[i % CULTURE_COLORS.length],
      center
    });
    cellCultures[center] = cultureId;

    let type = "Generic";
    if (name === "Highland") type = "Highland";
    if (name === "Nomadic" || name === "Steppe") type = "Nomadic";
    if (name === "Maritime") type = "Naval";
    if (name === "Riverine") type = "River";

    queue.push({ cellId: center, cost: 0, cultureId, type, nativeBiome: biomes[center], expansionism: 1.0 }, 0);
  }

  // 2. Dijkstra expansion
  const minCost = new Float32Array(pointsN).fill(Infinity);
  for (let i = 0; i < actualCount; i++) {
    minCost[centers[i]] = 0;
  }

  const maxExpansionCost = pointsN * 0.6;

  // Simple priority queue loop (Dijkstra)
  while (queue.length > 0) {
    const curr = queue.pop()!;

    if (curr.cost > minCost[curr.cellId]) continue;

    const neighbors = grid.cells.c[curr.cellId] || [];
    for (const n of neighbors) {
      const sourceBiome = biomes[curr.cellId];
      const targetBiome = biomes[n];

      const biomeCost = getBiomeCost(curr.nativeBiome, targetBiome, curr.type);
      const biomeChangeCost = sourceBiome === targetBiome ? 0 : 20;
      const heightCost = getHeightCost(heights[n], grid.cells.area ? grid.cells.area[n] : 1, curr.type, targetBiome);
      const riverCost = getRiverCost(safeRivers[n], safeFlux[n], curr.type);
      const typeCost = getTypeCost(safeTypes[n], curr.type);
      
      const cellCost = (biomeCost + biomeChangeCost + heightCost + riverCost + typeCost) / curr.expansionism;
      const totalCost = curr.cost + cellCost;

      if (totalCost > maxExpansionCost) continue;

      if (totalCost < minCost[n]) {
        minCost[n] = totalCost;
        if (heights[n] >= 20 || targetBiome !== 11) {
            cellCultures[n] = curr.cultureId;
        }
        queue.push({
          cellId: n,
          cost: totalCost,
          cultureId: curr.cultureId,
          type: curr.type,
          nativeBiome: curr.nativeBiome,
          expansionism: curr.expansionism
        }, totalCost);
      }
    }
  }

  return { cultures, cellCultures };
}
