// Generates real maps in the Node test environment, with the generators the app runs
import type { IntegrityRule, IntegrityViolation } from "./map-integrity";

Object.assign(globalThis, { grid: undefined, pack: {} });

const { GenerationPipeline } = await import("./generation-pipeline");
await import("./");
const { MapIntegrity } = await import("./map-integrity");
const { MapRestoration } = await import("./map-restoration");

interface MapOptions {
  seed: string;
  template?: string; // a procedural template: image heightmaps need a canvas
  points?: number;
}

export async function generateMap({ seed, template = "continents", points = 3000 }: MapOptions): Promise<void> {
  Object.assign(globalThis, { grid: undefined, pack: {} });
  options.map.seed = seed;
  options.generation.template = template;
  options.map.graph = { ...options.map.graph, width: 960, height: 540, points };
  await GenerationPipeline.run({});
}

/** the Risk heightmap edit, with the edit applied to a copy of the current heights */
export function riskEdit(edit: (heights: Uint8Array) => void, erosion: boolean): void {
  const heights = grid.cells.h.slice();
  edit(heights);
  MapRestoration.applyHeights(heights, { erosion });
}

/** set the height of every grid cell within a circle given in fractions of the map size */
export const circle =
  (fx: number, fy: number, radius: number, height: number, only: "land" | "water" | "all" = "all") =>
  (heights: Uint8Array) => {
    const { width, height: mapHeight } = options.map.graph;
    grid.points.forEach(([x, y], cell) => {
      if (Math.hypot(x - fx * width, y - fy * mapHeight) > radius) return;
      const isLand = heights[cell] >= 20;
      if (only === "all" || (only === "land") === isLand) heights[cell] = height;
    });
  };

/** broken rules, by rule, for comparing a map before and after an operation */
export function violations(): Map<IntegrityRule, IntegrityViolation> {
  return new Map(MapIntegrity.check().map(violation => [violation.rule, violation]));
}

/** the rules an operation broke that the map did not already break, or broke more often */
export function newViolations(before: Map<IntegrityRule, IntegrityViolation>) {
  return [...violations().values()].filter(({ rule, count }) => count > (before.get(rule)?.count ?? 0));
}

export const living = <T extends { i: number; removed?: boolean }>(list: T[]) => list.filter(e => e.i && !e.removed);
