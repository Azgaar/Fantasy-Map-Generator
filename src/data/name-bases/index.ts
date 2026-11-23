import type { Concept } from "@/data/name-concepts";
import { amazigh } from "./amazigh";
import { arabic } from "./arabic";
import { arachnid } from "./arachnid";
import { basque } from "./basque";
import { cantonese } from "./cantonese";
import { castillian } from "./castillian";
import { celtic } from "./celtic";
import { chinese } from "./chinese";
import { darkElven } from "./dark-elven";
import { draconic } from "./draconic";
import { dwarven } from "./dwarven";
import { elven } from "./elven";
import { english } from "./english";
import { finnic } from "./finnic";
import { french } from "./french";
import { german } from "./german";
import { giant } from "./giant";
import { goblin } from "./goblin";
import { greek } from "./greek";
import { hawaiian } from "./hawaiian";
import { humanGeneric } from "./human-generic";
import { hungarian } from "./hungarian";
import { inuit } from "./inuit";
import { iranian } from "./iranian";
import { italian } from "./italian";
import { japanese } from "./japanese";
import { karnataka } from "./karnataka";
import { korean } from "./korean";
import { levantine } from "./levantine";
import { mesopotamian } from "./mesopotamian";
import { mongolian } from "./mongolian";
import { nahuatl } from "./nahuatl";
import { nigerian } from "./nigerian";
import { nordic } from "./nordic";
import { orc } from "./orc";
import { portuguese } from "./portuguese";
import { quechua } from "./quechua";
import { roman } from "./roman";
import { ruthenian } from "./ruthenian";
import { serpents } from "./serpents";
import { swahili } from "./swahili";
import { turkish } from "./turkish";
import { vietnamese } from "./vietnamese";

/** A regex rewrite: `match` is a regex source, `replace` may use `$1` groups. A rule shapes the words a base
 * generates and the roots it borrows. One set `at` the join, or with a `chance`, shapes a name made of parts,
 * where `+` marks each join; one for `long` names runs on the finished name while it is too long;
 * one for `foreign` roots adapts a root coined in another base */
export interface SoundRule {
  match: string;
  replace: string;
  at?: "join";
  when?: "long" | "foreign";
  chance?: number; // 0 to 1: the rule fires for a share of names, the same ones every time
}

/** A list of names a Markov chain is built from, or drawn from as they are */
export interface Corpus {
  names: string[];
  mode?: "chain" | "pick"; // generate new names of the corpus, the default, or pick one of its own
  length?: [min: number, max: number]; // of a generated name
}

/** The shape of a meaning: which slots a name has */
export type Pattern =
  | "simplex" // root
  | "feature" // generic
  | "modifier-generic"
  | "owner-generic" // root, generic
  | "generic-of" // generic, root
  | "compound" // modifier, generic, settlement
  | "relative" // modifier, root
  | "root-land" // root, generic
  | "modifier-land"; // modifier, generic

/** A base's fixed form of a concept inside a name. A form written `-sk` is a suffix: it ends a word and stands
 * only after a stem or a root. One with `*` takes an ending that agrees with the noun beside it. `_` says nothing:
 * the noun is left out and the word beside it still agrees with it */
export interface Formant {
  form: string;
  weight?: number; // against the concept's other forms, 1 when absent
  position?: "first" | "last" | "word" | "stem"; // where in a word the form may stand, a stem only before a suffix; anywhere when absent
  short?: string; // taken when the name runs too long
  link?: string; // put between the form and the part after it
  class?: string; // the noun class of a noun; on a word that describes one, the class of nouns it stands beside
}

/** What a base's words do beside each other: the classes its nouns fall into, such as genders and the plural,
 * and the ending a describing word takes beside a noun of each */
export interface Grammar {
  classes?: Record<string, string>; // class to a regex its nouns match, tried in order: the last may be empty and take the rest
  agreement?: Record<string, string>; // class to the ending that stands in for `*`
}

/** How a base lays a pattern out: slots in braces, such as "{root}s{generic}" or "{generic} {root}" */
export interface Template {
  parts: string;
  weight?: number;
}

export interface NameBase {
  id: string; // stable slug, what a culture stores as its base
  name: string;
  extends?: string; // the base whose lexicon and patterns stand in where this one has none
  length: [min: number, max: number]; // of a name, generated or made of parts
  places: Corpus; // the place names a Markov chain is built from; its own length, if any, is for generated names
  people?: { male?: Corpus; female?: Corpus }; // personal names: the founders places are named after
  rules?: SoundRule[]; // applied in order, before the shared ones
  grammar?: Grammar;
  lexicon?: Partial<Record<Concept, Formant[]>>;
  patterns?: Partial<Record<Pattern, { weight?: number; templates?: Template[] }>>;
  settled?: number; // 0 to 1: the share of burg names that end in what the burg is by its group, 0.85 when absent
}

const NAME_BASES: NameBase[] = [
  // real-world bases by Azgaar
  german,
  english,
  french,
  italian,
  castillian,
  ruthenian,
  nordic,
  greek,
  roman,
  finnic,
  korean,
  chinese,
  japanese,
  portuguese,
  nahuatl,
  hungarian,
  turkish,
  amazigh,
  arabic,
  inuit,
  basque,
  nigerian,
  celtic,
  mesopotamian,
  iranian,
  hawaiian,
  karnataka,
  quechua,
  swahili,
  vietnamese,
  cantonese,
  mongolian,
  // fantasy bases by Dopu
  humanGeneric,
  elven,
  darkElven,
  dwarven,
  goblin,
  orc,
  giant,
  draconic,
  arachnid,
  serpents,
  // additional by Avengium
  levantine
];

export const getDefaultNameBases = (): NameBase[] => structuredClone(NAME_BASES);
