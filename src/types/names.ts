import type { Concept } from "@/data/name-concepts";

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
  as?: string; // the rule makes a noun of this class of a plain one, beside a counting word of the class: "tower" to "towers"
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
 * only after a stem or a root. One with `*` takes an ending that agrees with the noun beside it, from the default
 * set of endings or from a named one, as in `verhn*soft`. `_` says nothing: the noun is left out and the word beside
 * it still agrees with it */
export interface Formant {
  form: string;
  weight?: number; // a whole number, against the concept's other forms, 1 when absent
  position?: "first" | "last" | "word" | "stem"; // where in a word the form may stand, a stem only before a suffix; anywhere when absent
  short?: string; // taken when the name runs too long
  class?: string; // the noun class of a noun; on a word that describes one, the class of nouns it stands beside
  hyphen?: boolean; // a word that may also follow a name after a dash: David-Gorodok
}

/** What the grammar makes of a concept's words: a stem, and a combining form that starts a word */
export type Derivation = "stem" | "first";

/** What a base's words do beside each other and how they change: the classes its nouns fall into, such as genders
 * and the plural, the endings a describing word takes beside a noun of each, and the rules that make a concept's
 * other forms of the words written for it */
export interface Grammar {
  classes?: Record<string, string>; // class to a regex its nouns match, tried in order: the last may be empty and take the rest
  endings?: Record<string, Record<string, string>>; // a set of endings, "" the default, to the ending of each class that stands in for `*`
  derive?: Partial<Record<Derivation, { match: string; replace: string }[]>>; // the first rule that matches a word makes the form
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
  waters?: Corpus; // river and lake names, a chain of their own; place names stand in when absent
  people?: { male?: Corpus; female?: Corpus }; // personal names: the founders places are named after
  rules?: SoundRule[]; // applied in order, before the shared ones
  grammar?: Grammar;
  lexicon?: Partial<Record<Concept, Formant[]>>;
  patterns?: Partial<Record<Pattern, PatternLayout>>;
  settled?: number; // 0 to 1: the share of burg names that end in what the burg is by its group, 0.85 when absent
}

/** How a base coins names of a pattern */
export interface PatternLayout {
  weight?: number; // how often, against the other patterns
  templates?: Template[];
  female?: number; // of owner-generic, 0 to 1: the share of founders that are women; by the sizes of the people lists when absent
}

/** A base as the shipped data holds it: rules, grammar, forms and templates may be in their written form,
 * which `NameNotation` reads */
export interface WrittenNameBase extends Omit<NameBase, "rules" | "grammar" | "lexicon" | "patterns"> {
  rules?: (SoundRule | string)[]; // a string holds rules a line each
  grammar?: Grammar | string;
  lexicon?: Partial<Record<Concept, Formant[] | string>> | string; // a string holds a concept a line
  patterns?: Partial<Record<Pattern, Omit<PatternLayout, "templates"> & { templates?: Template[] | string }>>;
}

/** A concept, or a proper root with no concept behind it, marked with `~` */
export type Token = Concept | `~${string}`;

/** What a name says, apart from any language */
export interface Meaning {
  pattern: Pattern;
  tokens: Token[]; // in the pattern's slot order
  origin: string; // id of the name base it was coined in
  salt?: number; // re-rolls the choice between a concept's forms
}
