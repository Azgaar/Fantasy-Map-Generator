// Turns a meaning into a name in a name base: the "translation" half of semantic names

import Alea from "alea";
import type { Formant, NameBase, Pattern, Template } from "@/data/name-bases";
import { type Concept, conceptsOf, kindOf, settles } from "@/data/name-concepts";
import { DEFAULT_LEXICON, DEFAULT_TEMPLATES, DEFAULT_WEIGHTS } from "@/data/name-rules";
import { capitalize } from "@/utils/string-utils";
import { adopt } from "./name-adoption";
import { Names } from "./names-generator";
import { capitalizeWords, joinParts } from "./sound-rules";

/** A concept, or a proper root with no concept behind it, marked with `~` */
export type Token = Concept | `~${string}`;

/** What a name says, apart from any language */
export interface Meaning {
  pattern: Pattern;
  tokens: Token[]; // in the pattern's slot order
  origin: string; // id of the name base it was coined in
  salt?: number; // re-rolls the choice between a concept's forms
}

type Slot = "root" | "generic" | "modifier" | "settlement";

export const SLOTS: Record<Pattern, Slot[]> = {
  simplex: ["root"],
  feature: ["generic"],
  "modifier-generic": ["modifier", "generic"],
  "owner-generic": ["root", "generic"],
  "generic-of": ["generic", "root"],
  compound: ["modifier", "generic", "settlement"],
  relative: ["modifier", "root"],
  "root-land": ["root", "generic"],
  "modifier-land": ["modifier", "generic"]
};

const isRoot = (token: Token): token is `~${string}` => token.startsWith("~");

/** The English reading of a meaning */
export function gloss({ pattern, tokens }: Meaning): string {
  const words = tokens.map(token => (isRoot(token) ? token.slice(1) : capitalize(token)));
  const counts = !isRoot(tokens[0]) && kindOf(tokens[0]) === "numeral";
  const [first, second, third] = counts ? [words[0], plural(words[1]), words[2]] : words;
  if (pattern === "simplex") return first;
  if (pattern === "compound") return `${first} ${second} ${third}`;
  if (pattern === "feature") return `The ${first}`;
  if (pattern === "owner-generic") return `${first}${first.endsWith("s") ? "'" : "'s"} ${second}`;
  if (pattern === "generic-of") return `${first} of ${second}`;
  if (pattern === "root-land") return `${second} of ${first}`;
  return `${first} ${second}`;
}

const plural = (noun: string) =>
  noun.endsWith("s") ? noun : /(x|z|ch|sh)$/.test(noun) ? `${noun}es` : `${noun.replace(/(?<=[^aeiou])y$/, "ie")}s`;

/** The meaning of a name that has none: the whole name as one root */
export const simplex = (name: string, origin: string): Meaning => ({
  pattern: "simplex",
  tokens: [`~${name}`],
  origin
});

/** The name a meaning takes in a base. The same meaning and base always give the same name */
export const render = (meaning: Meaning, baseId: string): string => compose(meaning, baseId).name;

/** A template with a form drawn for each of its concepts */
interface Layout {
  words: Item[][];
  forms: Formant[]; // in the order the concepts stand
  weight: number;
  hasModifier: boolean;
}

type Item = { slot: Slot } | { text: string };

/** A meaning's name in a base, and whether it says all of it: a name too long for the base loses its modifier */
export function compose(meaning: Meaning, baseId: string): { name: string; whole: boolean } {
  const base = Names.resolve(baseId) ?? Names.nameBases[0];
  if (!base) return { name: "ERROR", whole: false };

  const random = Alea(`${base.id}|${meaning.pattern}|${meaning.tokens}|${meaning.salt ?? 0}`);
  const values = Object.fromEntries(SLOTS[meaning.pattern].map((slot, index) => [slot, meaning.tokens[index]]));
  const grammar = Names.lineage(base).find(({ grammar }) => grammar)?.grammar;
  const declines = Object.keys(grammar?.agreement ?? {}).length > 0; // describing words take endings here
  const counting = Names.lineage(base).flatMap(({ rules = [] }) => rules.filter(rule => rule.as)); // what makes a noun plural
  const isForeign = base.id !== meaning.origin; // a root coined elsewhere is adapted to this base
  const rootOf = (token: Token, endsWord: boolean) => {
    const root = token.slice(1).toLowerCase();
    return isForeign ? adopt(root, base, endsWord) : root; // its own root stands as coined
  };

  // forms that may stand together; where a base has none, a noun stands in for a stem, then anything goes
  const templates = templatesOf(base, meaning.pattern);
  const strictness = [STRICT, LOOSE, ANY].find(level => templates.some(template => layoutsOf(template, level).length))!;
  const layouts = templates.flatMap(template => layoutsOf(template, strictness));
  const drawn = pick(layouts, random);
  const rolls = (base.rules ?? []).filter(rule => rule.chance !== undefined).map(() => random());
  const fitsBase = (name: string) => fits(name, base);

  // a name too long is made again with more effort: its shortest forms, then clipped roots, then no modifier
  const shortest = layouts
    .filter(layout => layout.words === drawn.words)
    .reduce((a, b) => (length(b) < length(a) ? b : a), drawn);
  let name = "";
  for (const effort of [0, 1, 2, 3]) {
    for (const kept of effort < 2 ? [Infinity] : effort === 2 ? [3, 2, 1] : [Infinity, 3, 2, 1]) {
      const parts = join(effort ? shortest : drawn, effort, kept);
      name = capitalizeWords(joinParts(parts, base.rules, { rolls, fits: fitsBase }));
      if (fits(name, base)) return { name, whole: strictness === STRICT && (effort < 3 || !drawn.hasModifier) };
    }
  }
  return { name, whole: false };

  /** Every way to fill a template's concepts with forms that may stand where it puts them */
  function layoutsOf({ parts, weight = 1 }: Template, strictness: number): Layout[] {
    const words = parts
      .trim()
      .split(/(?<=[ -])|(?=[ -])/)
      .map(word => (word.match(/\{\w+\}|[^{}]+/g) ?? []).map(toItem));
    const sites = words.flatMap(items =>
      items.flatMap((item, index) =>
        "slot" in item && isConceptAt(item.slot) ? { items, index, slot: item.slot } : []
      )
    );

    let filled: Formant[][] = [[]];
    for (const site of sites) {
      const forms = formantsOf(base, values[site.slot] as Concept);
      const standing = forms.filter(form => standsAt(form, site.items, site.index, strictness));
      const sole = [...forms].sort((a, b) => ANY_ORDER.indexOf(a.position) - ANY_ORDER.indexOf(b.position));
      filled = filled.flatMap(before =>
        (strictness === ANY ? sole.slice(0, 1) : standing).map(form => [...before, form])
      );
    }

    const agreeing = strictness === ANY ? filled : filled.filter(forms => agrees(sites, forms, parts.includes("*")));
    return agreeing.map(forms => ({
      words,
      forms,
      weight: forms.reduce((product, form) => product * (form.weight ?? 1), weight),
      hasModifier: parts.includes("{modifier}")
    }));
  }

  function toItem(text: string): Item {
    const slot = /^\{(\w+)\}$/.exec(text)?.[1] as Slot | undefined;
    return slot ? { slot } : { text };
  }

  function isConceptAt(slot: Slot): boolean {
    return Boolean(values[slot]) && !isRoot(values[slot]);
  }

  // where a form may stand by its own make; what stands beside it is checked once every form is drawn
  function standsAt(form: Formant, items: Item[], index: number, strictness: number): boolean {
    const next = items[index + 1];
    const position = form.position ?? (isSuffix(form) ? "last" : form.form.includes("*") ? "word" : undefined);
    const beforeConcept = Boolean(next && "slot" in next && isConceptAt(next.slot));
    if (items.length === 1) return !position || position === "word";
    if (position === "stem") return beforeConcept;
    if (strictness === LOOSE && beforeConcept && position === "word") return !/[*_]/.test(form.form); // a noun for a stem
    if (form.form.endsWith("-")) return Boolean(next && "slot" in next && !isConceptAt(next.slot)); // a prefix goes before a root
    if (!position) return form.form !== SILENT;
    return position === (next ? "first" : "last");
  }

  // a suffix needs a stem before it and a stem a suffix after it; a describing word of one class needs its noun
  function agrees(sites: { items: Item[]; index: number; slot: Slot }[], forms: Formant[], inflects: boolean): boolean {
    const head = headClass(sites, forms);
    const described = inflects || forms.some(({ form }) => form.includes("*"));
    return sites.every((site, order) => {
      const [form, before] = [forms[order], sites[order - 1]];
      const follows = before?.items === site.items && before.index === site.index - 1;
      const onStem = forms[order - 1]?.position === "stem" || forms[order - 1]?.position === "word";
      if (follows && isSuffix(form) !== onStem) return false;
      if (form.form === SILENT && !described) return false; // a noun goes unsaid only where a word still shows it
      const joined = site.items[site.index - 1];
      if (!follows && joined && "text" in joined && isSuffix(form)) return false;
      // a proper name takes a suffix where the concept has one: its full forms stand apart from the name
      const ownSuffix = formantsOf(base, values[site.slot] as Concept).some(isSuffix);
      if (joined && "slot" in joined && !isConceptAt(joined.slot) && ownSuffix && !isSuffix(form)) return false;
      if (site.slot !== "modifier" || site.items.length > 1) return true;
      // a word that describes the noun beside it: of the noun's class, and no noun itself where words agree
      const kind = kindOf(values.modifier as Concept);
      const isNoun = (kind === "generic" || kind === "settlement") && !form.form.includes("*");
      if (isNoun && declines) return false;
      if (!form.class || isNoun) return true;
      // a counting word makes its noun take its class: "three" stands beside "towers", made of "tower" if need be
      const noun = forms[sites.findIndex(other => other.slot === "generic")];
      return counts(form.class) ? Boolean(noun && counted(noun, form.class)) : form.class === head;
    });
  }

  // the class of the noun a name is built on: its generic, or the root where it has none
  function headClass(sites: { slot: Slot }[], forms: Formant[]): string | undefined {
    const generic = forms[sites.findIndex(site => site.slot === "generic")];
    if (generic) return generic.class ?? classOf(generic.form.replace(/[-*_]/g, ""));
    return values.root && isRoot(values.root) ? classOf(rootOf(values.root, true)) : classOf("");
  }

  function counts(nounClass?: string): nounClass is string {
    return counting.some(rule => rule.as === nounClass);
  }

  // a noun as it stands beside a counting word of a class: as it is where it is of the class, else as the rules make it
  function counted(noun: Formant, nounClass: string): string | undefined {
    const bare = noun.form.replace(/[-*_]/g, "");
    if ((noun.class ?? classOf(bare)) === nounClass) return bare;
    const rule = counting.find(rule => rule.as === nounClass && test(rule.match, bare));
    return rule && bare.replace(regex(rule.match)!, rule.replace);
  }

  function classOf(noun: string): string | undefined {
    return Object.entries(grammar?.classes ?? {}).find(([, pattern]) => !pattern || test(pattern, noun))?.[0];
  }

  function length({ forms }: Layout): number {
    return forms.reduce((sum, form) => sum + (form.short ?? form.form).length, 0);
  }

  function join({ words, forms }: Layout, effort: number, kept: number): string {
    const sites = words.flatMap(items => items.filter(item => "slot" in item && isConceptAt(item.slot)));
    const ending = `+${grammar?.agreement?.[headClass(sites as { slot: Slot }[], forms) ?? ""] ?? ""}`;
    const drawn = new Map(sites.map((site, order) => [site, forms[order]]));
    const describing = forms[(sites as { slot: Slot }[]).findIndex(site => site.slot === "modifier")];
    const count = counts(describing?.class) ? describing.class : undefined;

    return words
      .map(items =>
        items
          .flatMap((item, index) => {
            if ("text" in item) return item.text.replace("*", ending);
            const token = values[item.slot];
            if (!token || (effort === 3 && item.slot === "modifier")) return [];
            if (isRoot(token)) {
              const root = rootOf(token, index === items.length - 1);
              return items.length > 1 && kept !== Infinity ? Names.syllables(root).slice(0, kept).join("") : root;
            }
            const form = drawn.get(item)!;
            const plain = (effort ? (form.short ?? form.form) : form.form).replace(/^-|_/g, "").replace("*", ending);
            const text = (count && item.slot === "generic" && counted(form, count)) || plain;
            const next = items[index + 1];
            const beforeSuffix = next && "slot" in next && drawn.get(next) && isSuffix(drawn.get(next)!);
            return next && form.link && !beforeSuffix ? [text, form.link] : text || [];
          })
          .join("+")
      )
      .join("")
      .replace(/ +/g, " ")
      .trim();
  }
}

const SETTLEMENT_ENDINGS = 3;
const [STRICT, LOOSE, ANY] = [2, 1, 0];
const ANY_ORDER: Formant["position"][] = ["word", undefined, "stem", "first", "last"]; // what reads best when nothing fits
const SILENT = "_"; // a noun left unsaid: the word beside it agrees with it all the same
const isSuffix = ({ form }: Formant) => form.startsWith("-");

const classPatterns = new Map<string, RegExp | null>();

function regex(pattern: string): RegExp | null {
  if (!classPatterns.has(pattern)) {
    try {
      classPatterns.set(pattern, new RegExp(pattern, "u"));
    } catch {
      classPatterns.set(pattern, null);
    }
  }
  return classPatterns.get(pattern)!;
}

const test = (pattern: string, text: string): boolean => regex(pattern)?.test(text) ?? false;

/** Whether a name is no longer than its base lets a name be; a name of several words may run to twice that */
export function fits(name: string, base: NameBase): boolean {
  const [, max] = base.length;
  return name.length <= max * 2 && name.split(/[ -]/).every(word => word.length <= max);
}

function pick<T extends { weight?: number }>(items: T[], random: () => number): T {
  let roll = random() * items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  for (const item of items) {
    roll -= item.weight ?? 1;
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

function templatesOf(base: NameBase, pattern: Pattern): Template[] {
  const own = Names.lineage(base).find(({ patterns }) => patterns?.[pattern]?.templates?.length);
  return own?.patterns?.[pattern]?.templates ?? DEFAULT_TEMPLATES[pattern];
}

/** How often a base coins a name of a pattern */
export function patternWeight(base: NameBase, pattern: Pattern): number {
  const own = Names.lineage(base).find(({ patterns }) => patterns?.[pattern]?.weight !== undefined);
  return own?.patterns?.[pattern]?.weight ?? DEFAULT_WEIGHTS[pattern];
}

/** The forms a base, the bases it extends or the shared lexicon hold for a concept */
export function authoredForms(base: NameBase, concept: Concept): Formant[] | undefined {
  const own = Names.lineage(base).find(({ lexicon }) => lexicon?.[concept]?.length);
  return own?.lexicon?.[concept] ?? DEFAULT_LEXICON[concept];
}

function formantsOf(base: NameBase, concept: Concept): Formant[] {
  const authored = authoredForms(base, concept) ?? (isLand(concept) ? authoredForms(base, "land") : undefined);
  if (authored) return authored; // a land unwritten is plain "land"

  // a settlement is an ending; what stands at a place is more often a word of its own
  const { first, last, word, more = [] } = fallbackOf(base).get(concept)!;
  const kind = kindOf(concept);
  if (kind === "settlement")
    return [last, ...more].map((form, index, all) => ({ form, position: "last", weight: all.length - index }));
  if (kind === "modifier" || kind === "numeral")
    return [
      { form: first, position: "first" },
      { form: word, position: "word" }
    ];
  return [
    { form: word, position: "word", weight: settles(concept) ? 0.5 : 2 }, // a fort ends a name as a town does
    { form: last, position: "last" },
    { form: first, position: "first" }
  ];
}

const isLand = (concept: Concept) => kindOf(concept) === "land";

/** The forms a base makes for a concept nobody wrote a form for: at a word's start, at its end, on its own */
export const fallbackForms = (base: NameBase, concept: Concept): Fallback => fallbackOf(base).get(concept)!;

type Fallback = Record<"first" | "last" | "word", string> & { more?: string[] }; // a settlement has endings to spare

// The forms of a base nobody wrote a lexicon for, made of its own corpus and cached while the corpus stands

const fallbacks = new WeakMap<string[], Map<Concept, Fallback>>();

function fallbackOf(base: NameBase): Map<Concept, Fallback> {
  const cached = fallbacks.get(base.places.names);
  if (cached) return cached;

  // a settlement ends a name with the corpus's commonest endings, a few each; what stands at a place takes the rest
  const endings = mineEndings(base.places.names);
  const settlements = conceptsOf("settlement");
  const spare = settlements.length * SETTLEMENT_ENDINGS;
  const generics = conceptsOf("generic");
  const taken = new Set(endings);
  const coin = (key: string, min?: number, max?: number): string => {
    for (let attempt = 0; ; attempt++) {
      const word = seeded(`${base.id}|${key}|${attempt}`, () => Names.getBase(base.id, min, max, "")).toLowerCase();
      const clean = !/[^\p{L}]/u.test(word) && !taken.has(word) && word.length <= (max ?? Infinity) + 2; // one short word of its own
      if (clean || attempt > 8) {
        taken.add(word);
        return word.replace(/[^\p{L}]/gu, "");
      }
    }
  };

  const lexicon = new Map<Concept, Fallback>();
  const everyNth = (items: string[], start: number) => items.filter((_, index) => index % settlements.length === start);
  const describing = [...conceptsOf("modifier"), ...conceptsOf("numeral")];
  for (const concept of [...settlements, ...generics, ...describing, ...conceptsOf("land")]) {
    const first = coin(`${concept}|first`, 3, 5);
    const order = settlements.indexOf(concept);
    const mined = order < 0 ? [endings[spare + generics.indexOf(concept)]] : everyNth(endings.slice(0, spare), order);
    const [last = coin(`${concept}|last`, 3, 4), ...more] = generics.includes(concept) || order >= 0 ? mined : [];
    lexicon.set(concept, { first, last, word: coin(`${concept}|word`, 4, 7), more });
  }

  fallbacks.set(base.places.names, lexicon);
  return lexicon;
}

/** Run a function on a random sequence of its own, leaving the map's sequence where it was */
export function seeded<T>(seed: string, run: () => T): T {
  const ambient = Math.random;
  Math.random = Alea(seed);
  try {
    return run();
  } finally {
    Math.random = ambient;
  }
}

/** The endings many names of a corpus share, the commonest first: -bach, -ingen, -ton */
export function mineEndings(names: string[]): string[] {
  const counts = new Map<string, number>();
  for (const name of names) {
    const word = name.trim().toLowerCase();
    for (const size of [3, 4, 5]) {
      const ending = word.slice(-size);
      if (word.length >= size + 2 && !/[^\p{L}]/u.test(ending)) counts.set(ending, (counts.get(ending) ?? 0) + 1);
    }
  }

  const common = [...counts].filter(([, count]) => count >= 3);
  const eclipsed = ([ending, count]: [string, number]) =>
    common.some(
      ([other, otherCount]) =>
        other !== ending &&
        (other.endsWith(ending) || ending.endsWith(other)) &&
        (otherCount > count || (otherCount === count && other.length > ending.length))
    );
  return common
    .filter(entry => !eclipsed(entry))
    .sort((a, b) => b[1] - a[1])
    .map(([ending]) => ending);
}
