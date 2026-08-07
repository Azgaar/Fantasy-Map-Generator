import { Grid } from "../../core/types";
import { createPRNG, PRNG } from "../../core/random";

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

// Returns cost to cross from cell 'fromIdx' to neighbor 'toIdx'
function getCultureExpansionCost(
  fromIdx: number,
  toIdx: number,
  heights: Uint8Array,
  biomes: Uint8Array
): number {
  const hTo = heights[toIdx];
  if (hTo < 20) return 50.0; // water is harder to cross for non-maritime
  
  const biomeTo = biomes[toIdx];
  if (biomeTo === 1 || biomeTo === 2) return 15.0; // Deserts are dry/costly
  if (biomeTo === 11) return 80.0; // Glacier is extremely hard
  
  const elevationDiff = Math.abs(heights[toIdx] - heights[fromIdx]);
  return 1.0 + elevationDiff * 0.5;
}

export function generateCultures(
  grid: Grid,
  heights: Uint8Array,
  biomes: Uint8Array,
  count = 6,
  seed: string
): { cultures: Culture[]; cellCultures: Uint8Array } {
  const pointsN = heights.length;
  const cellCultures = new Uint8Array(pointsN).fill(0); // 0 = Wild / No Culture
  const cultures: Culture[] = [];
  const rng = createPRNG(seed);

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
  const queue: { cellId: number; cost: number; cultureId: number }[] = [];
  for (let i = 0; i < actualCount; i++) {
    const cultureId = i + 1;
    const center = centers[i];
    cultures.push({
      id: cultureId,
      name: CULTURE_NAMES[i % CULTURE_NAMES.length] + "ic",
      color: CULTURE_COLORS[i % CULTURE_COLORS.length],
      center
    });
    cellCultures[center] = cultureId;
    queue.push({ cellId: center, cost: 0, cultureId });
  }

  // 2. Dijkstra expansion
  const minCost = new Float32Array(pointsN).fill(Infinity);
  for (const q of queue) {
    minCost[q.cellId] = 0;
  }

  // Simple priority queue loop (Dijkstra)
  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const curr = queue.shift()!;

    if (curr.cost > minCost[curr.cellId]) continue;

    const neighbors = grid.cells.c[curr.cellId] || [];
    for (const n of neighbors) {
      const edgeCost = getCultureExpansionCost(curr.cellId, n, heights, biomes);
      const nextCost = curr.cost + edgeCost;
      
      // Limit culture maximum range
      if (nextCost < 120.0 && nextCost < minCost[n]) {
        minCost[n] = nextCost;
        cellCultures[n] = curr.cultureId;
        queue.push({ cellId: n, cost: nextCost, cultureId: curr.cultureId });
      }
    }
  }

  return { cultures, cellCultures };
}
