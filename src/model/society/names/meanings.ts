// Turns a meaning into a name in a name base: the rendering half of semantic names

import { type Concept, isConcept, type Kind, kindOf, settles } from "@/data/name-concepts";
import type { Formant, Meaning, NameBase, Pattern, Template, Token } from "@/types/names";
import { pickWeighted, seededRandom } from "@/utils/probability-utils";
import { capitalize, compileRegex } from "@/utils/string-utils";
import { Appropriation } from "./appropriation";
import { Lexicon } from "./lexicon";
import { Names } from "./names-generator";
import { SILENT, STAR } from "./notation";
import { SoundRules } from "./sound-rules";

type Slot = "root" | "generic" | "modifier" | "settlement";

const SLOTS: Record<Pattern, Slot[]> = {
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

// the kinds of words a slot takes; a place word may describe, and a fort is what a burg is
const TAKES: Record<Slot, Kind[]> = {
  root: [],
  generic: ["generic", "settlement"],
  modifier: ["modifier", "numeral", "generic", "settlement"],
  settlement: ["settlement", "generic"]
};
const LAND: Kind[] = ["land"];

const CLIPPED = 2 / 3; // the share of a root that must be left for it to be told
const UNSAID: Kind[] = ["settlement", "land"];
const [STRICT, LOOSE, ANY] = [2, 1, 0];
const ANY_ORDER: Formant["position"][] = ["word", undefined, "last", "stem", "first"]; // what reads best when nothing fits
const MIN_NAME = 3;
const STUTTER = /(\p{L}{3,})\+\1|(\p{L}{2})\+\2(?=[ -]|$)/u; // a part that repeats the one before: Harlan-land, Amnon-on
const LEFT_OVER = /(?<=^|[ -])[ '+-]+|[ +-]+$/g; // the marks between a name and a modifier given up

/** A template with a form drawn for each of its concepts */
interface Layout {
  words: Item[][];
  sites: Site[];
  forms: Formant[]; // in the order of the sites
  weight: number;
  hasModifier: boolean;
}

type Item = { slot: Slot } | { text: string };

/** Where a template puts a concept */
interface Site {
  item: Item;
  items: Item[]; // of the word it is in
  slot: Slot;
  after?: Standing; // what it comes after in the word, and before
  before?: Standing;
  afterDash: boolean;
}

type Standing = "text" | "concept" | "name";

class MeaningsModule {
  readonly slots = SLOTS;

  /** The English reading of a meaning */
  gloss({ pattern, tokens }: Meaning): string {
    const words = tokens.map(token => (isRoot(token) ? token.slice(1) : capitalize(token)));
    const counts = tokens.length > 1 && !isRoot(tokens[0]) && kindOf(tokens[0]) === "numeral";
    const [first, second, third] = counts ? [words[0], plural(words[1]), words[2]] : words;
    if (pattern === "simplex") return first;
    if (pattern === "compound") return `${first} ${second} ${third}`;
    if (pattern === "feature") return `The ${first}`;
    if (pattern === "owner-generic") return `${first}${first.endsWith("s") ? "'" : "'s"} ${second}`;
    if (pattern === "generic-of") return `${first} of ${second}`;
    if (pattern === "root-land") return `${second} of ${first}`;
    return `${first} ${second}`;
  }

  /** A meaning as a table keeps it, such as "owner-generic: ~Eadric, town" */
  write({ pattern, tokens }: Meaning): string {
    return `${pattern}: ${tokens.join(", ")}`;
  }

  /** The meaning a text written that way stands for, coined in a base */
  read(text: string, origin: string): Meaning {
    const [, name = "", words = ""] = /^([^:]*):(.*)$/s.exec(text) ?? [];
    const pattern = name.trim().toLowerCase();
    if (!isPattern(pattern))
      throw new Error(`A meaning starts with a pattern and a colon. Patterns: ${Object.keys(SLOTS).join(", ")}`);
    const slots = SLOTS[pattern];
    const parts = words.split(",").map(word => word.trim());
    if (parts.length !== slots.length || parts.some(word => !word.replace(/^~+/, "").trim()))
      throw new Error(`A meaning of the pattern ${pattern} has these words: ${slots.join(", ")}`);
    const tokens = parts.map((word, order): Token => {
      const slot = slots[order];
      if (isRoot(word) || slot === "root") return `~${word.replace(/^~+/, "").trim()}`;
      const concept = word.toLowerCase();
      if (!isConcept(concept)) throw new Error(`"${word}" is not a known word. A proper name starts with ~`);
      const kinds = slot === "generic" && pattern.endsWith("-land") ? LAND : TAKES[slot];
      if (!kinds.includes(kindOf(concept)))
        throw new Error(`"${word}" cannot stand as the ${slot} of ${pattern}, which is a word of: ${kinds.join(", ")}`);
      return concept;
    });
    return { pattern, tokens, origin };
  }

  /** The meaning of a name that has none: the whole name as one root */
  simplex(name: string, origin: string): Meaning {
    return { pattern: "simplex", tokens: [`~${name}`], origin };
  }

  /** What a name says; one with no meaning stands as a proper name of a culture's base */
  of({ name = "", meaning }: { name?: string; meaning?: Meaning }, culture = 0): Meaning {
    return meaning ?? this.simplex(name, pack.cultures[culture]?.base ?? Names.nameBases[0].id);
  }

  /** The same thing said anew in a base: the concepts in its words, the roots as its people say them */
  coinedIn<T extends Pick<Meaning, "tokens" | "origin">>(meaning: T, base: NameBase): T {
    if (Names.lineage(base).some(({ id }) => id === meaning.origin)) return { ...meaning, origin: base.id };
    const say = (token: Token): Token => (isRoot(token) ? `~${Appropriation.adopt(token.slice(1), base)}` : token);
    return { ...meaning, tokens: meaning.tokens.map(say), origin: base.id };
  }

  /** The name a meaning takes in a base. The same meaning and base always give the same name */
  render(meaning: Meaning, baseId: string): string {
    return this.compose(meaning, baseId).name;
  }

  /** A meaning's name in a base, and whether it says all of it: a name too long for the base loses its modifier */
  compose(meaning: Meaning, of: NameBase | string): { name: string; whole: boolean } {
    const base = typeof of === "string" ? Names.resolve(of) : of;
    const random = seededRandom(`${base.id}|${meaning.pattern}|${meaning.tokens}|${meaning.salt ?? 0}`);
    const values = Object.fromEntries(SLOTS[meaning.pattern].map((slot, index) => [slot, meaning.tokens[index]]));
    const grammar = Lexicon.grammarOf(base);
    const counting = Names.lineage(base).flatMap(({ rules }) => SoundRules.sort(rules).counting);
    const formsOf = once((concept: Concept) => Lexicon.formsOf(base, concept));
    const matches = (pattern: string, text: string) => compileRegex(pattern)?.test(text) ?? false;
    const clips = meaning.pattern !== "relative"; // another place's name stands whole
    const rootOf = (token: Token) => token.slice(1).toLowerCase(); // a root stands as coined

    // forms that may stand together; where a base has none, a noun stands in for a stem, then anything goes
    const templates = Lexicon.templatesOf(base, meaning.pattern);
    let strictness = STRICT;
    let fitting = fittingAt(strictness);
    while (!fitting.length && strictness > ANY) fitting = fittingAt(--strictness);
    // a template by its own weight, then its forms by theirs: how many forms fit a template does not favour it
    const { layouts } = pick(fitting, random);
    const drawn = pick(layouts, random);
    const rolls = Array.from({ length: SoundRules.sort(base.rules).rolls }, () => random());
    const fitsBase = (name: string) => this.fits(name, base);

    // a name too long is made again with more effort: its shortest forms, then clipped roots, then no modifier
    const layoutFor = once((effort: number) =>
      effort ? layouts.reduce((a, b) => (length(b) < length(a) ? b : a), drawn) : drawn
    );
    const isTold = (name: string) => name.length >= MIN_NAME || meaning.pattern === "simplex"; // not an ending alone: Ni
    let [name, spare] = ["", ""];
    for (const effort of [0, 1, 2, 3]) {
      for (const kept of effort < 2 ? [Infinity] : effort === 2 ? [3, 2, 1] : [Infinity, 3, 2, 1]) {
        const parts = join(layoutFor(Math.min(effort, 1)), effort, kept);
        name = SoundRules.capitalize(SoundRules.join(parts, base.rules, { rolls, fits: fitsBase }));
        if (isTold(name)) spare = name;
        else spare ||= name;
        if (isTold(name) && this.fits(name, base)) {
          const says = strictness === STRICT && (effort < 3 || !drawn.hasModifier);
          return { name, whole: says && !STUTTER.test(parts) && !isStub(kept) };
        }
      }
    }
    return { name: spare, whole: false };

    // a root clipped to a stub tells nobody's name: Ana of Anahita
    function isStub(kept: number): boolean {
      const roots = kept === Infinity ? [] : meaning.tokens.filter(isRoot).map(token => rootOf(token));
      return roots.some(root => Names.cut(root, base, kept).length < root.length * CLIPPED);
    }

    function fittingAt(strictness: number): { weight?: number; layouts: Layout[] }[] {
      return templates
        .map(template => ({ weight: template.weight, layouts: layoutsOf(template, strictness) }))
        .filter(({ layouts }) => layouts.length);
    }

    /** Every way to fill a template's concepts with forms that may stand where it puts them */
    function layoutsOf(template: Template, strictness: number): Layout[] {
      const { words, slots, inflects } = wordsOf(template);
      const isSaid = (slot: Slot) => !values[slot] || slots.has(slot) || goesUnsaid(values[slot]);
      if (strictness !== ANY && !SLOTS[meaning.pattern].every(isSaid)) return [];
      const sites = sitesOf(template, SLOTS[meaning.pattern].filter(isConceptAt));

      let filled: Formant[][] = [[]];
      for (const [order, site] of sites.entries()) {
        const forms = standingAt(site, strictness);
        const longer: Formant[][] = [];
        for (const before of filled) {
          const onStem = strictness !== ANY && site.after === "concept" ? takesSuffix(before[order - 1]) : undefined;
          for (const form of forms)
            if (onStem === undefined || isSuffix(form) === onStem) longer.push([...before, form]);
        }
        filled = longer;
      }

      const agreeing = strictness === ANY ? filled : filled.filter(forms => agrees(sites, forms, inflects));
      return agreeing.map(forms => {
        let weight = 1;
        for (const form of forms) weight *= form.weight ?? 1;
        return { words, sites, forms, weight, hasModifier: slots.has("modifier") };
      });
    }

    /** The forms that may stand at a site, whatever stands at the others */
    function standingAt(site: Site, strictness: number): Formant[] {
      const { items, slot, afterDash, after } = site;
      const concept = values[slot] as Concept;
      const forms = formsOf(concept);
      if (strictness === ANY) {
        const reads = (form: Formant) => (isSuffix(form) ? ANY_ORDER.length : ANY_ORDER.indexOf(form.position));
        return [...forms].sort((a, b) => reads(a) - reads(b)).slice(0, 1);
      }

      // a proper name takes a suffix where the concept has one: its full forms stand apart from the name
      const needsSuffix = after === "name" && forms.some(isSuffix);
      // a word that describes the noun beside it is no noun itself, which joins it: Fordhall
      const kind = kindOf(concept);
      const describes = slot === "modifier" && items.length === 1 && (kind === "generic" || kind === "settlement");
      return forms.filter(form => {
        if (!(afterDash ? form.hyphen : standsAt(form, site, strictness))) return false;
        if (isSuffix(form) ? after === "text" : needsSuffix) return false;
        return !describes || form.form.includes("*");
      });
    }

    function isConceptAt(slot: Slot): boolean {
      return Boolean(values[slot]) && !isRoot(values[slot]);
    }

    // where a form may stand by its own make; what stands beside it is checked as the others are drawn
    function standsAt(form: Formant, { items, before }: Site, strictness: number): boolean {
      const position = form.position ?? (isSuffix(form) ? "last" : form.form.includes("*") ? "word" : undefined);
      if (items.length === 1) return !position || position === "word";
      if (position === "stem") return before === "concept" || before === "text"; // a suffix of the template's own
      if (strictness === LOOSE && before === "concept" && position === "word") return !/[*_]/.test(form.form); // a noun for a stem
      if (form.form.endsWith("-")) return before === "name"; // a prefix goes before a root
      if (!position) return form.form !== SILENT;
      return position === (before ? "first" : "last");
    }

    // a describing word of one class needs its noun, a noun unsaid a word that shows it
    function agrees(sites: Site[], forms: Formant[], inflects: boolean): boolean {
      return sites.every(({ slot, items }, order) => {
        const form = forms[order];
        if (form.form === SILENT && !inflects && !forms.some(({ form }) => form.includes("*"))) return false;
        if (slot !== "modifier" || items.length > 1 || !form.class) return true;
        // a counting word makes its noun take its class: "three" stands beside "towers", made of "tower" if need be
        const noun = forms[sites.findIndex(other => other.slot === "generic")];
        return counts(form.class) ? Boolean(noun && counted(noun, form.class)) : form.class === headClass(sites, forms);
      });
    }

    // the class of the noun a name is built on: its generic, or the root where it has none
    function headClass(sites: Site[], forms: Formant[]): string | undefined {
      const generic = forms[sites.findIndex(site => site.slot === "generic")];
      if (generic) return generic.class ?? classOf(bareOf(generic.form));
      return values.root && isRoot(values.root) ? classOf(rootOf(values.root)) : classOf("");
    }

    function counts(nounClass?: string): nounClass is string {
      return counting.some(rule => rule.as === nounClass);
    }

    // a noun as it stands beside a counting word of a class: as it is where it is of the class, else as the rules make it
    function counted(noun: Formant, nounClass: string): string | undefined {
      const bare = bareOf(noun.form);
      if ((noun.class ?? classOf(bare)) === nounClass) return bare;
      const rule = counting.find(rule => rule.as === nounClass && matches(rule.match, bare));
      return rule && bare.replace(compileRegex(rule.match)!, rule.replace);
    }

    function classOf(noun: string): string | undefined {
      return Object.entries(grammar?.classes ?? {}).find(([, pattern]) => !pattern || matches(pattern, noun))?.[0];
    }

    function length({ forms }: Layout): number {
      return forms.reduce((sum, form) => sum + (form.short ?? form.form).length, 0);
    }

    function join({ words, sites, forms }: Layout, effort: number, kept: number): string {
      const head = headClass(sites, forms) ?? "";
      // the default endings join as parts do, a named set's are spelled as they stand
      const agree = (text: string) =>
        text.replace(STAR, set => `${set.length > 1 ? "" : "+"}${grammar?.endings?.[set.slice(1)]?.[head] ?? ""}`);
      const drawn = new Map(sites.map(({ item }, order) => [item, forms[order]]));
      const describing = forms[sites.findIndex(site => site.slot === "modifier")];
      const count = counts(describing?.class) ? describing.class : undefined;

      return words
        .map(items =>
          items
            .flatMap(item => {
              if ("text" in item) return agree(item.text);
              const token = values[item.slot];
              if (!token || (effort === 3 && item.slot === "modifier")) return [];
              if (isRoot(token)) {
                const root = rootOf(token);
                return clips && items.length > 1 && kept !== Infinity ? Names.cut(root, base, kept) : root;
              }
              const form = drawn.get(item)!;
              const plain = agree((effort ? (form.short ?? form.form) : form.form).replace(/^-|_/g, ""));
              return (count && item.slot === "generic" && counted(form, count)) || plain || [];
            })
            .join("+")
        )
        .join("")
        .replace(/ +/g, " ")
        .replace(effort === 3 ? LEFT_OVER : /^ +| +$/g, "");
    }
  }

  /** Whether a name is no longer than its base lets a name be; a name of several words may run to twice that */
  fits(name: string, base: NameBase): boolean {
    const [, max] = base.length;
    return name.length <= max * 2 && name.split(/[ -]/).every(word => word.length <= max);
  }
}

interface ParsedTemplate {
  words: Item[][];
  slots: Set<Slot>;
  inflects: boolean; // it has an ending that agrees with the noun
  sites: Map<string, Site[]>; // by the slots that hold concepts
}

const parsed = new WeakMap<Template, ParsedTemplate>();

function wordsOf(template: Template): ParsedTemplate {
  let known = parsed.get(template);
  if (!known) {
    const toItem = (text: string): Item => {
      const slot = /^\{(\w+)\}$/.exec(text)?.[1] as Slot | undefined;
      return slot ? { slot } : { text };
    };
    const words = template.parts
      .trim()
      .split(/(?<=[ -])|(?=[ -])/)
      .map(word => (word.match(/\{\w+\}|[^{}]+/g) ?? []).map(toItem));
    const slots = new Set(words.flat().flatMap(item => ("slot" in item ? item.slot : [])));
    known = { words, slots, inflects: template.parts.includes("*"), sites: new Map() };
    parsed.set(template, known);
  }
  return known;
}

/** Where a template puts the concepts of a meaning */
function sitesOf(template: Template, concepts: Slot[]): Site[] {
  const { words, sites } = wordsOf(template);
  const key = concepts.join();
  let known = sites.get(key);
  if (!known) {
    const standing = (item?: Item): Standing | undefined =>
      item && ("text" in item ? "text" : concepts.includes(item.slot) ? "concept" : "name");
    known = words.flatMap((items, order) =>
      items.flatMap((item, index) => {
        if ("text" in item || !concepts.includes(item.slot)) return [];
        const [after, before] = [standing(items[index - 1]), standing(items[index + 1])];
        const afterDash = index === 0 && isDash(words[order - 1]);
        return { item, items, slot: item.slot, after, before, afterDash };
      })
    );
    sites.set(key, known);
  }
  return known;
}

/** A function that works out each answer once */
function once<K, T>(run: (key: K) => T): (key: K) => T {
  const known = new Map<K, T>();
  return key => {
    if (!known.has(key)) known.set(key, run(key));
    return known.get(key)!;
  };
}

const isPattern = (name: string): name is Pattern => Object.hasOwn(SLOTS, name);
const isRoot = (token: string): token is `~${string}` => token.startsWith("~");
const isSuffix = ({ form }: Formant) => form.startsWith("-");
// a template may leave out what a burg is by its group or a land, whose name is a suffix of the template's own: Frankia;
// never a name or what stands at the place
const goesUnsaid = (token: Token) => !isRoot(token) && (UNSAID.includes(kindOf(token)) || settles(token));
const takesSuffix = ({ position }: Formant) => position === "stem" || position === "word";
const isDash = (items?: Item[]) => items?.length === 1 && "text" in items[0] && items[0].text === "-";
const bareOf = (form: string) => form.replace(STAR, "").replace(/[-_]/g, "");

const plural = (noun: string) =>
  noun.endsWith("s") ? noun : /(x|z|ch|sh)$/.test(noun) ? `${noun}es` : `${noun.replace(/(?<=[^aeiou])y$/, "ie")}s`;

const pick = <T extends { weight?: number }>(items: T[], random: () => number): T =>
  pickWeighted(
    items,
    items.map(({ weight = 1 }) => weight),
    random
  );

export const Meanings = new MeaningsModule();
