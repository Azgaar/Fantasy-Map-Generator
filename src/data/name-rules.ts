import type { SoundRule } from "@/data/name-bases";

/** The rules every name goes through after its own base's rules */
export const SHARED_RULES: SoundRule[] = [
  { match: "(?<=[^ -])(.)\\1{2,}", replace: "$1$1" }, // no letter three times in a row inside a word
  { match: "- +", replace: "-" }, // no space after a hyphen
  { match: "(?<=[^ -])ae", replace: "e" } // "ae" reads as "e" inside a word
];
