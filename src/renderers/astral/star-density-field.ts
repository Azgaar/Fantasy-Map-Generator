// The stellar density field: population-weighted system counts spread over land cells, banded for the heatmap
import type { Burg } from "@/model/political/burgs-generator";
import type { PackedGraph } from "@/types/packed-graph";

export interface DensityFieldOptions {
  reach: number; // kernel radius, percent of the map's smaller side
  levels: number; // bands, 1..6
  populationWeight: number; // 0..1: population share vs the bare system count
}

const WATER = 20; // cells below this height are water and carry no density

type DensityCells = Pick<PackedGraph["cells"], "i" | "c" | "p" | "h">;

/** Band per cell: 0 is below the first threshold and draws nothing, else 1..levels. Pure and deterministic */
export function buildDensityField(
  cells: DensityCells,
  burgs: Burg[],
  size: { width: number; height: number },
  { reach, levels, populationWeight }: DensityFieldOptions
): Uint8Array {
  const bands = new Uint8Array(cells.i.length);
  const systems = burgs.filter(burg => burg.i && !burg.removed);
  if (!systems.length || !levels) return bands;

  const field = new Float32Array(cells.i.length);
  const visited = new Int32Array(cells.i.length); // generation stamp, one spread pass per system
  const radius = (Math.min(size.width, size.height) * reach) / 100;
  let maxPopulation = 0;
  for (const system of systems) maxPopulation = Math.max(maxPopulation, system.population ?? 0);
  if (!maxPopulation) populationWeight = 0;

  systems.forEach((system, index) => {
    const weight = 1 - populationWeight + (populationWeight * (system.population ?? 0)) / maxPopulation;
    spread(cells, system, radius, weight, index + 1, visited, field);
  });

  let max = 0;
  for (const value of field) max = Math.max(max, value);
  if (!max) return bands;
  for (const cellId of cells.i) bands[cellId] = Math.floor((field[cellId] / max) * levels);
  return bands;
}

/** Accumulate the system's kernel onto the land cells inside its radius, nearest gets the full weight */
function spread(
  cells: DensityCells,
  system: Burg,
  radius: number,
  weight: number,
  generation: number,
  visited: Int32Array,
  field: Float32Array
): void {
  const queue = [system.cell];
  visited[system.cell] = generation;
  while (queue.length) {
    const cellId = queue.pop()!;
    const [x, y] = cells.p[cellId];
    const distance = Math.hypot(x - system.x, y - system.y);
    if (distance > radius) continue;
    field[cellId] += weight * (1 - distance / radius);
    for (const neighbor of cells.c[cellId]) {
      if (visited[neighbor] === generation || cells.h[neighbor] < WATER) continue;
      visited[neighbor] = generation;
      queue.push(neighbor);
    }
  }
}
