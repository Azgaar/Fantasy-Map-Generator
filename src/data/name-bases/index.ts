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
 * generates and the roots it borrows; one set `at` the join shapes a name made of parts, where `+` marks each join */
export interface SoundRule {
  match: string;
  replace: string;
  at?: "join";
}

/** The shape of a meaning: which slots a name has */
export type Pattern =
  | "simplex" // root
  | "feature" // generic
  | "modifier-generic"
  | "owner-generic" // root, generic
  | "generic-of" // generic, root
  | "relative" // modifier, root
  | "root-land" // root, generic
  | "modifier-land"; // modifier, generic

/** A base's fixed form of a concept inside a name */
export interface Formant {
  form: string;
  weight?: number; // against the concept's other forms, 1 when absent
  position?: "first" | "last" | "word"; // where in a word the form may stand; anywhere when absent
  short?: string; // taken when the name runs too long
  link?: string; // put between the form and the part after it
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
  length: [min: number, max: number]; // of a generated name
  places: { names: string[] }; // the place names a Markov chain is built from
  rules?: SoundRule[]; // applied in order, before the shared ones
  lexicon?: Partial<Record<Concept, Formant[]>>;
  patterns?: Partial<Record<Pattern, { weight?: number; templates?: Template[] }>>;
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
