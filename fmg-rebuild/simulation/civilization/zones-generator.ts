import { Grid } from "../../core/types";
import { createPRNG } from "../../core/random";

export interface Zone {
  id: number;
  name: string;
  type: string;
  color: string;
  cells: number[]; // Cell indices included in this zone
}

const ZONE_TYPES = [
  { type: "Wasteland", color: "rgba(100, 116, 139, 0.4)" },
  { type: "Plague Outbreak", color: "rgba(16, 185, 129, 0.4)" },
  { type: "Mystic Forest", color: "rgba(168, 85, 247, 0.4)" }
];

export function generateZones(
  grid: Grid,
  heights: Uint8Array,
  seed: string
): Zone[] {
  const zones: Zone[] = [];
  const pointsN = heights.length;
  const rng = createPRNG(seed);

  // Generate 2 zones
  for (let zId = 1; zId <= 2; zId++) {
    // Select seed cell on land
    let center = -1;
    for (let attempts = 0; attempts < 100; attempts++) {
      const idx = Math.floor(rng() * pointsN);
      if (heights[idx] >= 20) {
        center = idx;
        break;
      }
    }
    if (center === -1) continue;

    // Grow the zone using simple BFS up to 30 neighbors
    const zoneCells: number[] = [center];
    const visited = new Set<number>([center]);
    const queue = [center];

    while (queue.length > 0 && zoneCells.length < 35) {
      const curr = queue.shift()!;
      const neighbors = grid.cells.c[curr] || [];
      for (const n of neighbors) {
        if (!visited.has(n) && heights[n] >= 20) {
          visited.add(n);
          zoneCells.push(n);
          queue.push(n);
        }
      }
    }

    const t = ZONE_TYPES[(zId - 1) % ZONE_TYPES.length];
    zones.push({
      id: zId,
      name: `${t.type} ${zId}`,
      type: t.type,
      color: t.color,
      cells: zoneCells
    });
  }

  return zones;
}
