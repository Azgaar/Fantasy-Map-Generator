import type { Formant, Pattern, SoundRule, Template } from "@/data/name-bases";
import type { Concept } from "@/data/name-concepts";
import { parseTemplates } from "@/utils/name-notation";

const VOWELS = "aeiouyàèìòùáéíóúýâêîôûäëïöüÿãõāēīōūăĕĭŏŭąęįǫų";
const [VOWEL, CONSONANT] = [`[${VOWELS}]`, `[^${VOWELS} +-]`];

/** How the parts of a name meet, after its base's rules and before the `+` marks go */
export const JOIN_RULES: SoundRule[] = [
  { match: `(?<=${CONSONANT})${VOWEL}+\\+(?=${VOWEL}[^ +-]{0,3}$)`, replace: "" }, // a short vowel ending takes the place of a part's last vowels
  { match: "(.)\\+\\1", replace: "$1" } // one letter where two of a kind meet
];

/** The rules every name goes through after its own base's rules */
export const SHARED_RULES: SoundRule[] = [
  { match: "(?<=[^ -])(.)\\1{2,}", replace: "$1$1" }, // no letter three times in a row inside a word
  { match: "- +", replace: "-" }, // no space after a hyphen
  { match: "(?<=[^ -])ae", replace: "e" } // "ae" reads as "e" inside a word
];

/** What stands in for a letter a base never writes: the first stand-in the base does write */
export const NEAREST_LETTERS: Record<string, string[]> = {
  a: ["e", "o"],
  b: ["p", "v"],
  c: ["k", "s"],
  d: ["t", "k"],
  e: ["i", "a"],
  f: ["p", "v", "h"],
  g: ["k", "h"],
  h: ["kh", ""],
  i: ["e", "y"],
  j: ["y", "zh", "i"],
  k: ["c", "q", "g"],
  l: ["r"],
  m: ["n"],
  n: ["m"],
  o: ["u", "a"],
  p: ["b", "f"],
  q: ["k", "c"],
  r: ["l"],
  s: ["z", "sh", "k"],
  t: ["d", "k"],
  u: ["o", "w"],
  v: ["w", "b", "f"],
  w: ["v", "u"],
  x: ["ks", "s", "k"],
  y: ["i", "j"],
  z: ["s", "j", "k"]
};

/** How a pattern is laid out where a base has no template of its own: a settlement's ending joins what it is
 * named for, two words of their own stand apart */
export const DEFAULT_TEMPLATES: Record<Pattern, Template[]> = {
  simplex: parseTemplates("{root}"),
  feature: parseTemplates("{generic}"),
  "modifier-generic": parseTemplates("{modifier}{generic}, {modifier} {generic}"),
  "owner-generic": parseTemplates("{root}{generic}, {root} {generic}"),
  "generic-of": parseTemplates("{root}{generic}, {generic} {root}"),
  compound: parseTemplates("{modifier}{generic}{settlement}, {modifier}{generic}"),
  relative: parseTemplates("{modifier} {root}"),
  "root-land": parseTemplates("{root}{generic}"),
  "modifier-land": parseTemplates("{modifier}{generic}")
};

/** How often a base coins a name of each pattern where it sets no weight of its own */
export const DEFAULT_WEIGHTS: Record<Pattern, number> = {
  simplex: 35,
  feature: 3,
  "modifier-generic": 40,
  "owner-generic": 35,
  "generic-of": 10,
  compound: 8,
  relative: 5,
  "root-land": 57,
  "modifier-land": 8
};

/** The forms a concept takes in a base that has none of its own */
export const DEFAULT_LEXICON: Partial<Record<Concept, Formant[]>> = {
  land: [{ form: "ia", position: "last" }]
};
