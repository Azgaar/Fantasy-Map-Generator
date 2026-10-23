// Pure geometry for the star markers: the class grouping and the population-driven size ladder.
// The DOM writer is draw-systems.ts; this module holds no markup.
import type { StarSystem } from "@/generators/astral-naming";

/** The spectral classes, hottest to coolest; the layer draws one data-group per class */
export const STAR_CLASSES = ["G", "F", "K", "A", "B", "M"] as const;
export type StarClassId = (typeof STAR_CLASSES)[number];

const RADIUS_EM: [min: number, max: number] = [0.35, 0.8]; // star radius in em of the class font
const DIM_POP = 2_000; // the M threshold: dimmer worlds all draw the smallest star
const BRIGHT_POP = 10_000_000; // worlds from here up all draw the largest star

/** Accent geometry, in em of the class font */
export const CAPITAL_GAP_EM = 0.4; // ring gap around the star
export const CAPITAL_RING_EM = 0.14; // ring stroke width
export const PORT_ORBIT_EM = 0.7; // the tick's distance beyond the star radius
export const PORT_TICK_EM = 0.16; // the tick's radius
export const GLOW_RADIUS = 2.2; // halo radius in star radii
export const GLOW_OPACITY = 0.22;

/** The star's radius in em of the class font: a log scale of population, clamped to the ladder */
export function starRadiusEm(population: number): number {
  const [min, max] = RADIUS_EM;
  const span = Math.log10(BRIGHT_POP / DIM_POP);
  const t = Math.min(Math.max(Math.log10(Math.max(population, 1) / DIM_POP) / span, 0), 1);
  return min + t * (max - min);
}

/** The systems keyed by spectral class, every class present, in render order */
export function groupByClass(systems: StarSystem[]): Record<StarClassId, StarSystem[]> {
  const groups = { G: [], F: [], K: [], A: [], B: [], M: [] } as Record<StarClassId, StarSystem[]>;
  for (const system of systems) groups[system.class as StarClassId]?.push(system);
  return groups;
}
