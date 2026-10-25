// The Astral mapping: FMG's world read as a star map. Polities, sectors and star systems.
// The content (the name bases and their groups) lives in src/data/name-bases.ts; this module
// only reads it and applies it. See docs/astral/README.md
export {
  ASTRAL_SETS,
  applyNaming,
  groupsOf,
  isAstralMap,
  pickFor,
  polityWordFor,
  SECTOR_WORDS,
  sectorWordFor
} from "./polity-naming";

export interface StarClass {
  /** the spectral class, as a letter */
  class: string;
  /** what the class is called in words */
  name: string;
}

/**
 * The star's class, from how many people live in its system.
 *
 * The ladder runs from the comfortable to the exotic as the population falls.
 * A world of a million sits on a Sun-like yellow dwarf — the most habitable
 * star there is; below that the stars get harder and stranger, until the
 * loneliest outposts sit on red dwarfs: flare-lit, tidal-locked, and nobody's
 * idea of a home. The rare, spectacular types — white stars and blue giants —
 * belong to the smaller worlds, because they are spectacular, not comfortable.
 *
 * The thresholds are FMG's town sizes: a hamlet, a town, a city, a capital, a
 * metropolis.
 */
export function starClass(population: number): StarClass {
  if (population > 1_000_000) return { class: "G", name: "yellow dwarf" };
  if (population > 250_000) return { class: "F", name: "white-yellow star" };
  if (population > 50_000) return { class: "K", name: "orange dwarf" };
  if (population > 10_000) return { class: "A", name: "white star" };
  if (population > 2_000) return { class: "B", name: "blue giant" };
  return { class: "M", name: "red dwarf" };
}

/** How many people live in a system, in people */
export function peopleOf(burg: { population?: number }): number {
  const { scale, urbanization } = options.map.units.population;
  return Math.round((burg.population ?? 0) * scale * urbanization.rate);
}

/** The installations, in FMG's words and in ours */
export const TRAITS: Record<string, string> = {
  port: "shipyard",
  citadel: "bastion",
  plaza: "civic core",
  shanty: "drift",
  temple: "shrine",
  walls: "shielding"
};

/** The installations a system has, in our words */
export function systemTraits(burg: {
  port?: number;
  citadel?: number;
  plaza?: number;
  shanty?: number;
  temple?: number;
  walls?: number;
}): string[] {
  const traits: string[] = [];
  if (burg.port) traits.push(TRAITS.port);
  if (burg.citadel) traits.push(TRAITS.citadel);
  if (burg.plaza) traits.push(TRAITS.plaza);
  if (burg.shanty) traits.push(TRAITS.shanty);
  if (burg.temple) traits.push(TRAITS.temple);
  if (burg.walls) traits.push(TRAITS.walls);
  return traits;
}

export interface StarSystem {
  id: number;
  name: string;
  /** the system's place in the sector */
  x: number;
  y: number;
  /** the star's spectral class */
  class: string;
  /** what the class is called in words */
  className: string;
  /** the system's population, in people */
  population: number;
  /** the installations that make the system what it is */
  traits: string[];
  state: number;
  culture: number;
  capital: boolean;
  port: boolean;
}

/** One system, read from one burg */
export function toSystem(burg: (typeof pack.burgs)[number]): StarSystem {
  const population = peopleOf(burg);
  const { class: starType, name: className } = starClass(population);
  return {
    id: burg.i,
    name: burg.name ?? "",
    x: burg.x,
    y: burg.y,
    class: starType,
    className,
    population,
    traits: systemTraits(burg),
    state: burg.state ?? 0,
    culture: burg.culture ?? 0,
    capital: !!burg.capital,
    port: !!burg.port
  };
}

/** Every system on the map, in burg order */
export function systemsOf(): StarSystem[] {
  return pack.burgs.filter(burg => burg?.i && !burg.removed).map(toSystem);
}

/** The map tooltip line for a system: its class, its traits, and the invitation */
export function systemTip(system: StarSystem): string {
  const traits = system.traits.join(", ");
  const installations = traits && traits.charAt(0).toUpperCase() + traits.slice(1);
  return `${system.class}-class ${system.className}${installations ? `. ${installations}` : ""}. Click to edit`;
}

declare global {
  var Astral: { systems: () => StarSystem[] };
}

window.Astral = { systems: systemsOf };
