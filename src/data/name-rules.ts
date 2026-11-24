import type { Concept } from "@/data/name-concepts";
import type { Formant, Pattern, SoundRule } from "@/types/names";

const VOWELS = "aeiouyàèìòùáéíóúýâêîôûäëïöüÿãõāēīōūăĕĭŏŭąęįǫųıőű";
const [VOWEL, CONSONANT] = [`[${VOWELS}]`, `[^${VOWELS} +-]`];

/** How the parts of a name meet, after its base's rules and before the `+` marks go */
export const JOIN_RULES: SoundRule[] = [
  { match: `(?<=${CONSONANT})${VOWEL}+\\+(?=${VOWEL}[^ +-]{0,3}$)`, replace: "" }, // a short vowel ending takes the place of a part's last vowels
  { match: "(.)\\+\\1", replace: "$1" } // one letter where two of a kind meet
];

/** The rules every name goes through after its own base's rules */
export const SHARED_RULES: SoundRule[] = [
  { match: "(?<=[^ -])(.)\\1{2,}", replace: "$1$1" }, // no letter three times in a row inside a word
  { match: "- +", replace: "-" } // no space after a hyphen
];

/** What a word off a Markov chain goes through besides: the words of a base's lexicon are spelled as written */
export const CHAIN_RULES: SoundRule[] = [
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
export const DEFAULT_TEMPLATES: Record<Pattern, string> = {
  simplex: "{root}",
  feature: "{generic}",
  "modifier-generic": "{modifier}{generic}, {modifier} {generic}",
  "owner-generic": "{root}{generic}, {root} {generic}",
  "generic-of": "{root}{generic}, {generic} {root}",
  compound: "{modifier}{generic}{settlement}, {modifier}{generic}",
  relative: "{modifier} {root}",
  "root-land": "{root}{generic}",
  "modifier-land": "{modifier}{generic}"
};

/** How often a base coins a name of each pattern where it sets no weight of its own */
export const DEFAULT_WEIGHTS: Record<Pattern, number> = {
  simplex: 0, // drawn by share alone
  feature: 3,
  "modifier-generic": 40,
  "owner-generic": 35,
  "generic-of": 10,
  compound: 8,
  relative: 5,
  "root-land": 65,
  "modifier-land": 35
};

/** The forms a concept takes in a base that has none of its own */
export const DEFAULT_LEXICON: Partial<Record<Concept, Formant[]>> = {
  land: [{ form: "ia", position: "last" }]
};
