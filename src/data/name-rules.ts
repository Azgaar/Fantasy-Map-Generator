import type { Formant, Pattern, SoundRule } from "@/data/name-bases";
import type { Concept } from "@/data/name-concepts";

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

/** How a pattern is laid out where a base has no template of its own */
export const DEFAULT_TEMPLATES: Record<Pattern, string> = {
  simplex: "{root}",
  feature: "{generic}",
  "modifier-generic": "{modifier}{generic}",
  "owner-generic": "{root}{generic}",
  "generic-of": "{root}{generic}",
  relative: "{modifier}{root}",
  "root-land": "{root}{generic}",
  "modifier-land": "{modifier}{generic}"
};

/** How often a base coins a name of each pattern where it sets no weight of its own */
export const DEFAULT_WEIGHTS: Record<Pattern, number> = {
  simplex: 35,
  feature: 4,
  "modifier-generic": 18,
  "owner-generic": 26,
  "generic-of": 12,
  relative: 3,
  "root-land": 57,
  "modifier-land": 8
};

/** The forms a concept takes in a base that has none of its own */
export const DEFAULT_LEXICON: Partial<Record<Concept, Formant[]>> = {
  land: [{ form: "ia", position: "last" }]
};
