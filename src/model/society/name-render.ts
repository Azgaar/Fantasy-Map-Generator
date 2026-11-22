// Turns a meaning into a name in a name base: the "translation" half of semantic names

import Alea from "alea";
import type { Formant, NameBase, Pattern, Template } from "@/data/name-bases";
import { type Concept, conceptsOf } from "@/data/name-concepts";
import { DEFAULT_LEXICON, DEFAULT_TEMPLATES, DEFAULT_WEIGHTS } from "@/data/name-rules";
import { capitalize } from "@/utils/string-utils";
import { Names } from "./names-generator";
import { applyRules, capitalizeWords, joinParts } from "./sound-rules";

/** A concept, or a proper root with no concept behind it, marked with `~` */
export type Token = Concept | `~${string}`;

/** What a name says, apart from any language */
export interface Meaning {
  pattern: Pattern;
  tokens: Token[]; // in the pattern's slot order
  origin: string; // id of the name base it was coined in
  salt?: number; // re-rolls the choice between a concept's forms
}

type Slot = "root" | "generic" | "modifier";
type Position = NonNullable<Formant["position"]>;

export const SLOTS: Record<Pattern, Slot[]> = {
  simplex: ["root"],
  feature: ["generic"],
  "modifier-generic": ["modifier", "generic"],
  "owner-generic": ["root", "generic"],
  "generic-of": ["generic", "root"],
  relative: ["modifier", "root"],
  "root-land": ["root", "generic"],
  "modifier-land": ["modifier", "generic"]
};

const isRoot = (token: Token): token is `~${string}` => token.startsWith("~");

/** The English reading of a meaning */
export function gloss({ pattern, tokens }: Meaning): string {
  const [first, second] = tokens.map(token => (isRoot(token) ? token.slice(1) : capitalize(token)));
  if (pattern === "simplex") return first;
  if (pattern === "feature") return `The ${first}`;
  if (pattern === "owner-generic") return `${first}${first.endsWith("s") ? "'" : "'s"} ${second}`;
  if (pattern === "generic-of") return `${first} of ${second}`;
  if (pattern === "root-land") return `${second} of ${first}`;
  return `${first} ${second}`;
}

/** The meaning of a name that has none: the whole name as one root */
export const simplex = (name: string, origin: string): Meaning => ({
  pattern: "simplex",
  tokens: [`~${name}`],
  origin
});

/** The name a meaning takes in a base. The same meaning and base always give the same name */
export const render = (meaning: Meaning, baseId: string): string => compose(meaning, baseId).name;

/** A meaning's name in a base, and whether it says all of it: a name too long for the base loses its modifier */
export function compose(meaning: Meaning, baseId: string): { name: string; whole: boolean } {
  const base = Names.resolve(baseId) ?? Names.nameBases[0];
  if (!base) return { name: "ERROR", whole: false };

  const random = Alea(`${base.id}|${meaning.pattern}|${meaning.tokens}|${meaning.salt ?? 0}`);
  const template = pick(templatesOf(base, meaning.pattern), random).parts;
  const values = Object.fromEntries(SLOTS[meaning.pattern].map((slot, index) => [slot, meaning.tokens[index]]));
  const forms = new Map<string, Formant>(); // the form drawn for each concept: one draw, whatever the effort

  // a name too long is made again with more effort: shorter forms, then clipped roots, then no modifier
  let name = "";
  for (const effort of [0, 1, 2, 3]) {
    for (const kept of effort < 2 ? [Infinity] : effort === 2 ? [3, 2, 1] : [Infinity, 3, 2, 1]) {
      name = capitalizeWords(joinParts(join(effort, kept), base.rules));
      if (fits(name, base)) return { name, whole: effort < 3 || !template.includes("{modifier}") };
    }
  }
  return { name, whole: false };

  function join(effort: number, kept: number): string {
    const words = (effort === 3 ? template.replace("{modifier}", "") : template).trim().split(/(?<=[ -])|(?=[ -])/);
    return words
      .map(word => {
        const items = word.match(/\{\w+\}|[^{}]+/g) ?? [];
        return items.flatMap((item, index) => {
          const slot = /^\{(\w+)\}$/.exec(item)?.[1] as Slot | undefined;
          if (!slot) return item;
          const token = values[slot];
          if (!token) return [];
          if (isRoot(token))
            return clip(applyRules(token.slice(1).toLowerCase(), base.rules), items.length > 1 ? kept : Infinity);
          const position: Position = items.length === 1 ? "word" : index ? "last" : "first";
          return morphs(token, position, effort, index < items.length - 1);
        });
      })
      .map(parts => parts.join("+"))
      .join("");
  }

  function morphs(concept: Concept, position: Position, effort: number, linked: boolean): string[] {
    const all = formantsOf(base, concept, position);
    const fitting = all.filter(formant => !formant.position || formant.position === position);
    const candidates = fitting.length ? fitting : all;
    if (!forms.has(concept)) forms.set(concept, pick(candidates, random));
    const shortest = candidates.reduce((a, b) => ((b.short ?? b.form).length < (a.short ?? a.form).length ? b : a));
    const formant = effort ? shortest : forms.get(concept)!;
    const form = effort ? (formant.short ?? formant.form) : formant.form;
    return linked && formant.link ? [form, formant.link] : [form];
  }

  function clip(root: string, kept: number): string {
    return kept === Infinity ? root : Names.syllables(root).slice(0, kept).join("");
  }
}

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

/** A base and the bases it extends, nearest first */
function lineage(base: NameBase): NameBase[] {
  const chain = [base];
  for (let parent = base.extends && Names.find(base.extends); parent && !chain.includes(parent); ) {
    chain.push(parent);
    parent = parent.extends && Names.find(parent.extends);
  }
  return chain;
}

function templatesOf(base: NameBase, pattern: Pattern): Template[] {
  const own = lineage(base).find(({ patterns }) => patterns?.[pattern]?.templates?.length);
  return own?.patterns?.[pattern]?.templates ?? [{ parts: DEFAULT_TEMPLATES[pattern] }];
}

/** How often a base coins a name of a pattern */
export function patternWeight(base: NameBase, pattern: Pattern): number {
  const own = lineage(base).find(({ patterns }) => patterns?.[pattern]?.weight !== undefined);
  return own?.patterns?.[pattern]?.weight ?? DEFAULT_WEIGHTS[pattern];
}

/** The forms a base, the bases it extends or the shared lexicon hold for a concept */
export function authoredForms(base: NameBase, concept: Concept): Formant[] | undefined {
  const own = lineage(base).find(({ lexicon }) => lexicon?.[concept]?.length);
  return own?.lexicon?.[concept] ?? DEFAULT_LEXICON[concept];
}

function formantsOf(base: NameBase, concept: Concept, position: Position): Formant[] {
  return authoredForms(base, concept) ?? [{ form: fallbackOf(base).get(concept)![position], position }];
}

// The forms of a base nobody wrote a lexicon for, made of its own corpus and cached while the corpus stands

const fallbacks = new WeakMap<string[], Map<Concept, Record<Position, string>>>();

function fallbackOf(base: NameBase): Map<Concept, Record<Position, string>> {
  const cached = fallbacks.get(base.places.names);
  if (cached) return cached;

  // a generic ends a name with one of the corpus's commonest endings, the commonest concepts first
  const endings = mineEndings(base.places.names);
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

  const lexicon = new Map<Concept, Record<Position, string>>();
  for (const concept of [...generics, ...conceptsOf("modifier"), ...conceptsOf("land")]) {
    const first = coin(`${concept}|first`, 3, 5);
    const last = endings[generics.indexOf(concept)] ?? coin(`${concept}|last`, 3, 4);
    lexicon.set(concept, { first, last, word: coin(`${concept}|word`) });
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
function mineEndings(names: string[]): string[] {
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
