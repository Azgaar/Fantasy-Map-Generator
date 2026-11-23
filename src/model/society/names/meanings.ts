// Turns a meaning into a name in a name base: the rendering half of semantic names

import Alea from "alea";
import { type Concept, kindOf, settles } from "@/data/name-concepts";
import type { Formant, Meaning, NameBase, Pattern, Template, Token } from "@/types/names";
import { capitalize } from "@/utils/string-utils";
import { Appropriation } from "./appropriation";
import { Lexicon } from "./lexicon";
import { Names } from "./names-generator";
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

const [STRICT, LOOSE, ANY] = [2, 1, 0];
const ANY_ORDER: Formant["position"][] = ["word", undefined, "stem", "first", "last"]; // what reads best when nothing fits
const SILENT = "_"; // a noun left unsaid: the word beside it agrees with it all the same
const STAR = /\*\p{L}*/u; // where a describing word takes its ending, from the set it names, the default when none

/** A template with a form drawn for each of its concepts */
interface Layout {
  words: Item[][];
  forms: Formant[]; // in the order the concepts stand
  weight: number;
  hasModifier: boolean;
}

type Item = { slot: Slot } | { text: string };

class MeaningsModule {
  readonly slots = SLOTS;
  private readonly classPatterns = new Map<string, RegExp | null>();

  /** The English reading of a meaning */
  gloss({ pattern, tokens }: Meaning): string {
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

  /** The meaning of a name that has none: the whole name as one root */
  simplex(name: string, origin: string): Meaning {
    return { pattern: "simplex", tokens: [`~${name}`], origin };
  }

  /** The name a meaning takes in a base. The same meaning and base always give the same name */
  render(meaning: Meaning, baseId: string): string {
    return this.compose(meaning, baseId).name;
  }

  /** A meaning's name in a base, and whether it says all of it: a name too long for the base loses its modifier */
  compose(meaning: Meaning, baseId: string): { name: string; whole: boolean } {
    const base = Names.resolve(baseId) ?? Names.nameBases[0];
    if (!base) return { name: "ERROR", whole: false };

    const random = Alea(`${base.id}|${meaning.pattern}|${meaning.tokens}|${meaning.salt ?? 0}`);
    const values = Object.fromEntries(SLOTS[meaning.pattern].map((slot, index) => [slot, meaning.tokens[index]]));
    const grammar = Names.lineage(base).find(({ grammar }) => grammar)?.grammar;
    const counting = Names.lineage(base).flatMap(({ rules = [] }) => rules.filter(rule => rule.as)); // what makes a noun plural
    const formsOf = (concept: Concept) => Lexicon.formsOf(base, concept);
    const regex = (pattern: string) => this.regex(pattern);
    const matches = (pattern: string, text: string) => regex(pattern)?.test(text) ?? false;
    const isForeign = base.id !== meaning.origin; // a root coined elsewhere is adapted to this base
    const clips = meaning.pattern !== "relative"; // another place's name stands whole
    const rootOf = (token: Token, endsWord: boolean) => {
      const root = token.slice(1).toLowerCase();
      return isForeign ? Appropriation.adapt(root, base, endsWord) : root; // its own root stands as coined
    };

    // forms that may stand together; where a base has none, a noun stands in for a stem, then anything goes
    const templates = Lexicon.templatesOf(base, meaning.pattern);
    const strictness = [STRICT, LOOSE, ANY].find(level =>
      templates.some(template => layoutsOf(template, level).length)
    )!;
    // a template by its own weight, then its forms by theirs: how many forms fit a template does not favour it
    const fitting = templates
      .map(template => ({ weight: template.weight ?? 1, layouts: layoutsOf(template, strictness) }))
      .filter(({ layouts }) => layouts.length);
    const { layouts } = pick(fitting, random);
    const drawn = pick(layouts, random);
    const rolls = (base.rules ?? []).filter(rule => rule.chance !== undefined).map(() => random());
    const fitsBase = (name: string) => this.fits(name, base);

    // a name too long is made again with more effort: its shortest forms, then clipped roots, then no modifier
    const shortest = layouts.reduce((a, b) => (length(b) < length(a) ? b : a), drawn);
    let name = "";
    for (const effort of [0, 1, 2, 3]) {
      for (const kept of effort < 2 ? [Infinity] : effort === 2 ? [3, 2, 1] : [Infinity, 3, 2, 1]) {
        const parts = join(effort ? shortest : drawn, effort, kept);
        name = SoundRules.capitalize(SoundRules.join(parts, base.rules, { rolls, fits: fitsBase }));
        if (this.fits(name, base)) return { name, whole: strictness === STRICT && (effort < 3 || !drawn.hasModifier) };
      }
    }
    return { name, whole: false };

    /** Every way to fill a template's concepts with forms that may stand where it puts them */
    function layoutsOf({ parts }: Template, strictness: number): Layout[] {
      const unsaid = SLOTS[meaning.pattern].filter(slot => values[slot] && !parts.includes(`{${slot}}`));
      if (strictness !== ANY && !unsaid.every(slot => goesUnsaid(values[slot]))) return [];
      const words = parts
        .trim()
        .split(/(?<=[ -])|(?=[ -])/)
        .map(word => (word.match(/\{\w+\}|[^{}]+/g) ?? []).map(toItem));
      const sites = words.flatMap((items, order) =>
        items.flatMap((item, index) =>
          "slot" in item && isConceptAt(item.slot)
            ? { items, index, slot: item.slot, afterDash: index === 0 && isDash(words[order - 1]) }
            : []
        )
      );

      let filled: Formant[][] = [[]];
      for (const site of sites) {
        const forms = formsOf(values[site.slot] as Concept);
        const standing = forms.filter(form =>
          site.afterDash ? form.hyphen : standsAt(form, site.items, site.index, strictness)
        );
        const sole = [...forms].sort((a, b) => ANY_ORDER.indexOf(a.position) - ANY_ORDER.indexOf(b.position));
        filled = filled.flatMap(before =>
          (strictness === ANY ? sole.slice(0, 1) : standing).map(form => [...before, form])
        );
      }

      const agreeing = strictness === ANY ? filled : filled.filter(forms => agrees(sites, forms, parts.includes("*")));
      return agreeing.map(forms => ({
        words,
        forms,
        weight: forms.reduce((product, form) => product * (form.weight ?? 1), 1),
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
      if (position === "stem") return beforeConcept || Boolean(next && "text" in next); // a suffix of the template's own
      if (strictness === LOOSE && beforeConcept && position === "word") return !/[*_]/.test(form.form); // a noun for a stem
      if (form.form.endsWith("-")) return Boolean(next && "slot" in next && !isConceptAt(next.slot)); // a prefix goes before a root
      if (!position) return form.form !== SILENT;
      return position === (next ? "first" : "last");
    }

    // a suffix needs a stem before it and a stem a suffix after it; a describing word of one class needs its noun
    function agrees(
      sites: { items: Item[]; index: number; slot: Slot }[],
      forms: Formant[],
      inflects: boolean
    ): boolean {
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
        const ownSuffix = formsOf(values[site.slot] as Concept).some(isSuffix);
        if (joined && "slot" in joined && !isConceptAt(joined.slot) && ownSuffix && !isSuffix(form)) return false;
        if (site.slot !== "modifier" || site.items.length > 1) return true;
        // a word that describes the noun beside it: of the noun's class, and no noun itself, which joins it: Fordhall
        const kind = kindOf(values.modifier as Concept);
        if ((kind === "generic" || kind === "settlement") && !form.form.includes("*")) return false;
        if (!form.class) return true;
        // a counting word makes its noun take its class: "three" stands beside "towers", made of "tower" if need be
        const noun = forms[sites.findIndex(other => other.slot === "generic")];
        return counts(form.class) ? Boolean(noun && counted(noun, form.class)) : form.class === head;
      });
    }

    // the class of the noun a name is built on: its generic, or the root where it has none
    function headClass(sites: { slot: Slot }[], forms: Formant[]): string | undefined {
      const generic = forms[sites.findIndex(site => site.slot === "generic")];
      if (generic) return generic.class ?? classOf(bareOf(generic.form));
      return values.root && isRoot(values.root) ? classOf(rootOf(values.root, true)) : classOf("");
    }

    function counts(nounClass?: string): nounClass is string {
      return counting.some(rule => rule.as === nounClass);
    }

    // a noun as it stands beside a counting word of a class: as it is where it is of the class, else as the rules make it
    function counted(noun: Formant, nounClass: string): string | undefined {
      const bare = bareOf(noun.form);
      if ((noun.class ?? classOf(bare)) === nounClass) return bare;
      const rule = counting.find(rule => rule.as === nounClass && matches(rule.match, bare));
      return rule && bare.replace(regex(rule.match)!, rule.replace);
    }

    function classOf(noun: string): string | undefined {
      return Object.entries(grammar?.classes ?? {}).find(([, pattern]) => !pattern || matches(pattern, noun))?.[0];
    }

    function length({ forms }: Layout): number {
      return forms.reduce((sum, form) => sum + (form.short ?? form.form).length, 0);
    }

    function join({ words, forms }: Layout, effort: number, kept: number): string {
      const sites = words.flatMap(items => items.filter(item => "slot" in item && isConceptAt(item.slot)));
      const head = headClass(sites as { slot: Slot }[], forms) ?? "";
      // the default endings join as parts do, a named set's are spelled as they stand
      const agree = (text: string) =>
        text.replace(STAR, set => `${set.length > 1 ? "" : "+"}${grammar?.endings?.[set.slice(1)]?.[head] ?? ""}`);
      const drawn = new Map(sites.map((site, order) => [site, forms[order]]));
      const describing = forms[(sites as { slot: Slot }[]).findIndex(site => site.slot === "modifier")];
      const count = counts(describing?.class) ? describing.class : undefined;

      return words
        .map(items =>
          items
            .flatMap((item, index) => {
              if ("text" in item) return agree(item.text);
              const token = values[item.slot];
              if (!token || (effort === 3 && item.slot === "modifier")) return [];
              if (isRoot(token)) {
                const root = rootOf(token, index === items.length - 1);
                return clips && items.length > 1 && kept !== Infinity
                  ? Names.syllables(root).slice(0, kept).join("")
                  : root;
              }
              const form = drawn.get(item)!;
              const plain = agree((effort ? (form.short ?? form.form) : form.form).replace(/^-|_/g, ""));
              return (count && item.slot === "generic" && counted(form, count)) || plain || [];
            })
            .join("+")
        )
        .join("")
        .replace(/ +/g, " ")
        .trim();
    }
  }

  /** Whether a name is no longer than its base lets a name be; a name of several words may run to twice that */
  fits(name: string, base: NameBase): boolean {
    const [, max] = base.length;
    return name.length <= max * 2 && name.split(/[ -]/).every(word => word.length <= max);
  }

  private regex(pattern: string): RegExp | null {
    if (!this.classPatterns.has(pattern)) {
      try {
        this.classPatterns.set(pattern, new RegExp(pattern, "u"));
      } catch {
        this.classPatterns.set(pattern, null);
      }
    }
    return this.classPatterns.get(pattern)!;
  }
}

const isRoot = (token: Token): token is `~${string}` => token.startsWith("~");
const isSuffix = ({ form }: Formant) => form.startsWith("-");
// a template may leave out what a burg is by its group, never a name or what stands at the place
const goesUnsaid = (token: Token) => !isRoot(token) && (kindOf(token) === "settlement" || settles(token));
const isDash = (items?: Item[]) => items?.length === 1 && "text" in items[0] && items[0].text === "-";
const bareOf = (form: string) => form.replace(STAR, "").replace(/[-_]/g, "");

const plural = (noun: string) =>
  noun.endsWith("s") ? noun : /(x|z|ch|sh)$/.test(noun) ? `${noun}es` : `${noun.replace(/(?<=[^aeiou])y$/, "ie")}s`;

function pick<T extends { weight?: number }>(items: T[], random: () => number): T {
  let roll = random() * items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  for (const item of items) {
    roll -= item.weight ?? 1;
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

export const Meanings = new MeaningsModule();
