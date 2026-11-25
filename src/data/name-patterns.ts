import type { Kind } from "@/data/name-concepts";
import type { Pattern } from "@/types/names";

export type Slot = "root" | "generic" | "modifier" | "settlement";

interface PatternData {
  slots: Slot[];
  gloss: string; // the English reading
  templates: string; // where a base has none of its own: a settlement's ending joins what it is named for, two words of their own stand apart
  weight: number; // how often a base coins a name of it, where it sets no weight of its own
  isLand?: boolean; // its generic is a land
}

/** The shapes of a meaning */
export const PATTERNS: Record<Pattern, PatternData> = {
  simplex: { slots: ["root"], gloss: "{root}", templates: "{root}", weight: 0 }, // drawn by share alone
  feature: { slots: ["generic"], gloss: "The {generic}", templates: "{generic}", weight: 3 },
  "modifier-generic": {
    slots: ["modifier", "generic"],
    gloss: "{modifier} {generic}",
    templates: "{modifier}{generic}, {modifier} {generic}",
    weight: 40
  },
  "owner-generic": {
    slots: ["root", "generic"],
    gloss: "{root}'s {generic}",
    templates: "{root}{generic}, {root} {generic}",
    weight: 35
  },
  "generic-of": {
    slots: ["generic", "root"],
    gloss: "{generic} of {root}",
    templates: "{root}{generic}, {generic} {root}",
    weight: 10
  },
  compound: {
    slots: ["modifier", "generic", "settlement"],
    gloss: "{modifier} {generic} {settlement}",
    templates: "{modifier}{generic}{settlement}, {modifier}{generic}",
    weight: 8
  },
  relative: { slots: ["modifier", "root"], gloss: "{modifier} {root}", templates: "{modifier} {root}", weight: 5 },
  "root-land": {
    slots: ["root", "generic"],
    gloss: "{generic} of {root}",
    templates: "{root}{generic}",
    weight: 65,
    isLand: true
  },
  "modifier-land": {
    slots: ["modifier", "generic"],
    gloss: "{modifier} {generic}",
    templates: "{modifier}{generic}",
    weight: 35,
    isLand: true
  }
};

// a place word may describe, and a fort is what a burg is
const TAKES: Record<Slot, Kind[]> = {
  root: [],
  generic: ["generic", "settlement"],
  modifier: ["modifier", "numeral", "generic", "settlement"],
  settlement: ["settlement", "generic"]
};
const LAND: Kind[] = ["land"];

/** The kinds of words a slot of a pattern takes; a root takes none, it is a proper name */
export const kindsOf = (pattern: Pattern, slot: Slot): Kind[] =>
  slot === "generic" && PATTERNS[pattern].isLand ? LAND : TAKES[slot];

export const isPattern = (name: string): name is Pattern => Object.hasOwn(PATTERNS, name);
