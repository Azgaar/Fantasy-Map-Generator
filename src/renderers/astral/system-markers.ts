// Pure geometry for the star markers: the class grouping, the population-driven size ladder, and the
// shape of one star. The DOM writer is draw-systems.ts; it owns grouping and positioning, this module
// owns what a single marker is drawn from. The system editor's preview emits the same shapes.

import type { StarSystem } from "@/generators/astral-naming";
import { rn } from "@/utils/numberUtils";
import { escapeHtml } from "@/utils/stringUtils";

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

/** One style attr value: an SVG presentation attribute, or null when unset */
type StyleAttr = string | number | boolean | null | undefined;

/** Style attrs serialized to markup; unset values are skipped */
export function writeAttrs(attrs: Record<string, StyleAttr> | undefined): string {
  const written: string[] = [];
  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (value !== null && value !== undefined) written.push(` ${name}="${escapeHtml(String(value))}"`);
  }
  return written.join("");
}

/** One star's shape, at its population's size: the star itself plus the accents its traits earn */
export function starShape(population: number, capital: boolean, port: boolean, glow: boolean): string {
  const radius = starRadiusEm(population);
  return [
    glow ? halo(radius) : "",
    `<circle class="star" r="${rn(radius, 3)}em"/>`,
    capital ? capitalRing(radius) : "",
    port ? portTick(radius) : ""
  ].join("");
}

function halo(radius: number): string {
  return `<circle class="glow" r="${rn(radius * GLOW_RADIUS, 3)}em" fill-opacity="${GLOW_OPACITY}" stroke="none"/>`;
}

function capitalRing(radius: number): string {
  return `<circle class="capital" r="${rn(radius + CAPITAL_GAP_EM, 3)}em" fill="none" stroke-width="${CAPITAL_RING_EM}em"/>`;
}

function portTick(radius: number): string {
  const orbit = rn((radius + PORT_ORBIT_EM) * Math.SQRT1_2, 3); // the tick hangs on a 45° orbit
  return `<circle class="port" cx="${orbit}em" cy="-${orbit}em" r="${PORT_TICK_EM}em"/>`;
}
