import { Grid } from "../../core/types";

export const BIOME_NAMES: string[] = [
  "Marine", // 0
  "Hot desert", // 1
  "Cold desert", // 2
  "Savanna", // 3
  "Grassland", // 4
  "Tropical seasonal forest", // 5
  "Temperate deciduous forest", // 6
  "Tropical rainforest", // 7
  "Temperate rainforest", // 8
  "Taiga", // 9
  "Tundra", // 10
  "Glacier", // 11
  "Wetland", // 12
  "Shallow Reef", // 13
  "Kelp Forest", // 14
  "Pelagic Zone", // 15
  "Abyssal Plain", // 16
  "Oceanic Trench", // 17
  "Chaos Land", // 18
  "Chaos Water" // 19
];

export const BIOME_COLORS: string[] = [
  "#466eab", // Marine
  "#fbe79f", // Hot desert
  "#b5b887", // Cold desert
  "#d2d082", // Savanna
  "#c8d68f", // Grassland
  "#b6d95d", // Tropical seasonal forest
  "#29bc56", // Temperate deciduous forest
  "#7dcb35", // Tropical rainforest
  "#409c43", // Temperate rainforest
  "#4b6b32", // Taiga
  "#96784b", // Tundra
  "#d5e7eb", // Glacier
  "#0b9131", // Wetland
  "#006994", // Shallow Reef
  "#004B49", // Kelp Forest
  "#000080", // Pelagic Zone
  "#000033", // Abyssal Plain
  "#000011", // Oceanic Trench
  "#4B0082", // Chaos Land
  "#190033"  // Chaos Water
];

const biomesMatrix = [
  // hot ↔ cold [>19°C; <-4°C]; dry ↕ wet
  new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 10]),
  new Uint8Array([3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 9, 9, 9, 9, 10, 10, 10]),
  new Uint8Array([5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 9, 9, 9, 9, 9, 10, 10, 10]),
  new Uint8Array([5, 6, 6, 6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 10, 10, 10]),
  new Uint8Array([7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 10, 10])
];

function isWetland(moisture: number, temperature: number, height: number): boolean {
  if (temperature <= -2) return false; // too cold
  if (moisture > 40 && height < 25) return true; // near coast
  if (moisture > 24 && height > 24 && height < 60) return true; // off coast
  return false;
}

export function getBiomeId(
  moisture: number,
  temperature: number,
  height: number,
  hasRiver: boolean
): number {
  if (height < 20) {
    if (height >= 15) return 13; // Shallow Reef
    if (height >= 10 && temperature > 10) return 14; // Kelp Forest
    if (height >= 5) return 15; // Pelagic Zone
    if (height >= 2) return 16; // Abyssal Plain
    return 17; // Oceanic Trench
  }

  if (temperature < -5) return 11; // Glacier/Ice cap
  if (temperature >= 25 && !hasRiver && moisture < 8) return 1; // Hot desert
  if (isWetland(moisture, temperature, height)) return 12; // Wetland

  const moistureBand = Math.min(Math.floor(moisture / 5), 4); // [0-4]
  const temperatureBand = Math.min(Math.max(Math.floor(20 - temperature), 0), 25); // [0-25]

  return biomesMatrix[moistureBand]?.[temperatureBand] ?? 4; // fallback to Grassland (4)
}

export function generateBiomes(
  grid: Grid,
  heights: Uint8Array,
  temp: Float32Array,
  prec: Uint8Array,
  rivers: Uint16Array
): Uint8Array {
  const pointsN = heights.length;
  const biomes = new Uint8Array(pointsN);

  const calculateMoisture = (cellId: number): number => {
    let moisture = prec[cellId] || 0;
    if (rivers && rivers[cellId] > 0) {
      moisture += 2; // base moisture bump near rivers
    }
    const neighbors = grid.cells.c[cellId] || [];
    const moistAround = neighbors
      .filter(n => heights[n] >= 20)
      .map(n => prec[n] || 0)
      .concat([moisture]);
    const avgMoisture = moistAround.reduce((sum, v) => sum + v, 0) / moistAround.length;
    return parseFloat((4 + avgMoisture).toFixed(2));
  };

  for (let cellId = 0; cellId < pointsN; cellId++) {
    const height = heights[cellId];
    const hasRiver = rivers ? rivers[cellId] > 0 : false;
    const moisture = height < 20 ? 0 : calculateMoisture(cellId);
    const temperature = temp[cellId] || 0;

    biomes[cellId] = getBiomeId(moisture, temperature, height, hasRiver);
  }

  return biomes;
}
