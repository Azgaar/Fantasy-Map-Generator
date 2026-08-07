import { Grid } from "../../core/types";

export interface Burg {
  id: number;
  cell: number;
  x: number;
  y: number;
  name: string;
  population: number;
  isCapital: boolean;
  port: number; // 0 if none, or the feature ID of the ocean/lake it ports to
}

const BURG_NAMES_PREFIX = ["Odin", "Gron", "New", "Old", "Al", "Roth", "Stone", "Black", "Oak", "River"];
const BURG_NAMES_SUFFIX = ["burg", "grad", "ville", "ton", "ford", "port", "shire", "field", "wood", "crag"];

export function calculateSuitability(
  grid: Grid,
  heights: Uint8Array,
  biomes: Uint8Array,
  rivers: Uint16Array,
  flux: Float32Array
): Float32Array {
  const pointsN = heights.length;
  const score = new Float32Array(pointsN);

  for (let i = 0; i < pointsN; i++) {
    if (heights[i] < 20) continue; // no cities in the ocean/lakes

    let cellScore = 5.0;

    // 1. Biome habitability bonuses
    const biome = biomes[i];
    if (biome === 1 || biome === 2) cellScore -= 4.0; // desert penalty
    if (biome === 11) cellScore = 0; // glaciers are uninhabitable
    if (biome === 6 || biome === 8) cellScore += 5.0; // temperate dec/rain forests are great

    // 2. Proximity to water / coastlines
    let isCoast = false;
    for (const c of grid.cells.c[i]) {
      if (heights[c] < 20) {
        isCoast = true;
        break;
      }
    }
    if (isCoast) cellScore += 6.0; // port possibility

    // 3. Rivers & Confluences
    if (rivers[i] > 0) {
      cellScore += 4.0;
      // confluence bonus
      const fluxVal = flux ? flux[i] || 1.0 : 1.0;
      if (fluxVal > 50.0) {
        cellScore += 5.0;
      }
    }

    score[i] = Math.max(0, cellScore);
  }

  return score;
}

export function generateBurgs(
  grid: Grid,
  heights: Uint8Array,
  biomes: Uint8Array,
  rivers: Uint16Array,
  flux: Float32Array,
  count = 20
): Burg[] {
  const pointsN = heights.length;
  const score = calculateSuitability(grid, heights, biomes, rivers, flux);
  const burgs: Burg[] = [];

  const placedCellIds = new Set<number>();

  // Find local maxima / best candidates
  const candidates: { cellId: number; score: number }[] = [];
  for (let i = 0; i < pointsN; i++) {
    if (score[i] > 0) {
      candidates.push({ cellId: i, score: score[i] });
    }
  }

  // Sort descending by score
  candidates.sort((a, b) => b.score - a.score);

  let nextBurgId = 1;
  for (const candidate of candidates) {
    if (burgs.length >= count) break;

    // Ensure it's not too close to another placed burg
    let tooClose = false;
    for (const b of burgs) {
      const [x1, y1] = grid.points[b.cell];
      const [x2, y2] = grid.points[candidate.cellId];
      const dist = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
      if (dist < grid.spacing * 3.5) {
        tooClose = true;
        break;
      }
    }

    if (tooClose) continue;

    const cellId = candidate.cellId;
    const [x, y] = grid.points[cellId];
    
    // Check if near coast to assign port flag
    let port = 0;
    for (const c of grid.cells.c[cellId]) {
      if (heights[c] < 20) {
        port = 1; // standard water body port
        break;
      }
    }

    const pref = BURG_NAMES_PREFIX[Math.floor(Math.random() * BURG_NAMES_PREFIX.length)];
    const suff = BURG_NAMES_SUFFIX[Math.floor(Math.random() * BURG_NAMES_SUFFIX.length)];

    burgs.push({
      id: nextBurgId++,
      cell: cellId,
      x,
      y,
      name: `${pref}${suff}`,
      population: Math.round(1000 + candidate.score * 500 + Math.random() * 2000),
      isCapital: false,
      port
    });
  }

  return burgs;
}
