import { Grid } from "../../core/types";
import { createPRNG } from "../../core/random";

export interface Marker {
  id: number;
  type: "volcano" | "ruins" | "monument" | "spring";
  name: string;
  cell: number;
  x: number;
  y: number;
}

export function generateMarkers(
  grid: Grid,
  heights: Uint8Array,
  biomes: Uint8Array,
  seed: string
): Marker[] {
  const markers: Marker[] = [];
  const pointsN = heights.length;
  const rng = createPRNG(seed);
  let nextId = 1;

  for (let i = 0; i < pointsN; i++) {
    if (heights[i] < 20) continue; // no markers at sea

    const roll = rng();

    // Volcano: Spawns in high mountains (h > 75)
    if (heights[i] > 75 && roll < 0.05 && markers.filter(m => m.type === "volcano").length < 3) {
      const [x, y] = grid.points[i];
      markers.push({
        id: nextId++,
        type: "volcano",
        name: `Mt. Volcano ${nextId}`,
        cell: i,
        x,
        y
      });
    }

    // Ruins: Spawns in temperate/rain forests (biome 6, 8)
    else if ((biomes[i] === 6 || biomes[i] === 8) && roll < 0.03 && markers.filter(m => m.type === "ruins").length < 4) {
      const [x, y] = grid.points[i];
      markers.push({
        id: nextId++,
        type: "ruins",
        name: `Ancient Ruins ${nextId}`,
        cell: i,
        x,
        y
      });
    }
  }

  return markers;
}
