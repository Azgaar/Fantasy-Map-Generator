// The Astral mapping: FMG's world read as a star map. Polities, sectors and star systems.
// The content (the name bases and their groups) lives in src/data/name-bases.ts; this module
// only reads it and applies it. See docs/astral/README.md
import { isAstralBase } from "@/data/name-bases";
import { Names } from "./names-generator";
import { Provinces } from "./provinces-generator";
import { States } from "./states-generator";

/** The culture sets that speak in the star-map register */
export const ASTRAL_SETS = ["astralTrek", "astralJammer", "grimdark"];

/** Is the map drawn from one of the Astral culture sets? */
export function isAstralMap(): boolean {
  return (ASTRAL_SETS as string[]).includes(options.map.cultures.set);
}

/** The words a sector can be called */
export const SECTOR_WORDS = ["Sector", "Reach", "Cluster", "Belt", "Orbit", "Shelf", "Quadrant", "Frontier"];

/**
 * A stable pick from a list, seeded by a string.
 *
 * The same name always gets the same word: a map that reshuffles its polities
 * every time it is regenerated is a map nobody can read.
 */
export function pickFor(words: string[], seed: string): string | undefined {
  if (!words.length) return undefined;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return words[hash % words.length];
}

/** The name groups of the base a culture names from, when that base is one of ours */
export function groupsOf(cultureId: number): Record<string, string[]> | undefined {
  const baseId = pack.cultures[cultureId]?.base;
  if (baseId === undefined) return undefined;
  const base = Names.nameBases[baseId];
  return isAstralBase(base) ? base.groups : undefined;
}

/**
 * The word a state should be called by, e.g. "United Federation".
 *
 * The word comes from the `polities` group of the culture's own base, so a
 * Trek state is a Federation and a Grimdark one a Compact. A culture that
 * names from a stock base keeps FMG's own word: the mapping renames the
 * sci-fi world, not the fantasy one.
 */
export function polityWordFor(cultureId: number, seed: string): string | undefined {
  const words = groupsOf(cultureId)?.polities;
  if (!words?.length) return undefined;
  // A word that carries its own "of" would read twice: "Church of the Ashen
  // Star of Starvalere". Such words stay in the pool for a polity named on its
  // own, but they are not the word in front of a state's name.
  return pickFor(
    words.filter(word => !/\bof\b/i.test(word)),
    seed
  );
}

/** The word a province should be called by, e.g. "Sector" */
export function sectorWordFor(seed: string): string | undefined {
  return pickFor(SECTOR_WORDS, seed);
}

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

declare global {
  var Astral: { systems: () => StarSystem[] };
}

window.Astral = { systems: systemsOf };

/**
 * Give the polities their words and the provinces their sectors.
 *
 * A state's word comes from its own culture, so a mixed map keeps each
 * people's register: the Astral states become federations and the stock ones
 * stay kingdoms. A province follows the culture of its capital burg.
 *
 * A polity is named by the system that holds it, so a state also takes the
 * name of its capital — no fantasy suffix, the way the Astral bases name
 * things. The words are picked by a hash of that name, so applying twice
 * changes nothing the second time.
 */
export function applyNaming(): { polities: number; sectors: number; renamed: number } {
  let polities = 0;
  let renamed = 0;
  for (const state of pack.states) {
    if (!state.i || state.removed || !state.name) continue;
    const culture = state.culture ?? 0;
    if (!groupsOf(culture)) continue; // a stock culture's state stays a kingdom
    const capital = state.capital ? pack.burgs[state.capital] : undefined;
    const word = polityWordFor(culture, capital?.name || state.name);
    if (!word) continue;
    if (capital?.name && state.name !== capital.name) {
      States.rename(state.i, capital.name);
      renamed++;
    }
    States.setForm(state.i, word);
    polities++;
  }

  let sectors = 0;
  for (const province of pack.provinces) {
    if (!province.i || province.removed || !province.name) continue;
    const culture = pack.burgs[province.burg]?.culture ?? 0;
    if (!groupsOf(culture)) continue; // a stock culture's province stays a county
    const word = sectorWordFor(province.name);
    if (!word) continue;
    Provinces.setForm(province.i, word);
    sectors++;
  }

  return { polities, sectors, renamed };
}
