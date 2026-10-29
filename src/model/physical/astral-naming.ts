// The Astral mapping: FMG's world read as a star map. Polities, sectors and star systems.
// The content (the name bases and their groups) lives in src/data/name-bases.ts; this module
// only reads it and applies it. See docs/astral/README.md
import { createRng } from "./astral-system/rng";
import { SPECTRAL_TABLE } from "./astral-system/stars";
import { pickWeighted } from "./astral-system/util";

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

/** What each spectral class is called in words */
const CLASS_NAMES: Record<string, string> = {
  O: "blue supergiant",
  B: "blue giant",
  A: "white star",
  F: "white-yellow star",
  G: "yellow dwarf",
  K: "orange dwarf",
  M: "red dwarf"
};

/** From this population up, the roll narrows to the habitable F/G/K band */
const CORE_POPULATION = 10_000;
/** The astro layer's own habitable pick */
const CORE_WEIGHTS = [25, 45, 30];

/**
 * The star's class, rolled from the standard astro spectral distribution.
 *
 * The roll is seeded by the map seed and the burg id, so a system keeps its star across opens,
 * edits and save/load. Below the core population the roll is the standard distribution - a
 * red-dwarf galaxy with the exotic stars rare; at or above it, the roll narrows to the habitable
 * F/G/K pick. Crossing the threshold rerolls the star; an edit within a band changes nothing.
 * The chart styles no O group, so the fringe roll is the table minus O.
 */
export function starClassFor(burg: { i: number; population?: number }): StarClass {
  const people = peopleOf(burg);
  const band = people < CORE_POPULATION ? "fringe" : "core";
  const rng = createRng(`${options.map.seed}/astral/class/${burg.i}/${band}`);
  const fringe = SPECTRAL_TABLE.filter(star => star.type !== "O");
  const cls =
    people < CORE_POPULATION
      ? pickWeighted(
          rng,
          fringe.map(star => star.type),
          fringe.map(star => star.weight)
        )
      : pickWeighted(rng, ["F", "G", "K"], CORE_WEIGHTS);
  return { class: cls, name: CLASS_NAMES[cls] };
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
  const { class: starType, name: className } = starClassFor(burg);
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
