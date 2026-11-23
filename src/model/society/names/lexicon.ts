// What a base holds for its concepts and patterns: forms and templates written for it, for a base it extends or
// for all bases, and forms coined from its corpus where nobody wrote any

import { type Concept, conceptsOf, kindOf, settles } from "@/data/name-concepts";
import { DEFAULT_LEXICON, DEFAULT_TEMPLATES, DEFAULT_WEIGHTS } from "@/data/name-rules";
import type { Formant, NameBase, Pattern, Template } from "@/types/names";
import { seeded } from "@/utils/probability-utils";
import { Names } from "./names-generator";
import { NameNotation } from "./notation";

const SETTLEMENT_ENDINGS = 3;

type Fallback = Record<"first" | "last" | "word", string> & { more?: string[] }; // a settlement has endings to spare

class LexiconModule {
  private readonly defaultTemplates = Object.fromEntries(
    Object.entries(DEFAULT_TEMPLATES).map(([pattern, text]) => [pattern, NameNotation.parseTemplates(text)])
  ) as Record<Pattern, Template[]>;
  private readonly fallbacks = new WeakMap<string[], Map<Concept, Fallback>>(); // by corpus

  /** The forms of a concept in a base: written for it, for a base it extends or for all bases, else coined */
  formsOf(base: NameBase, concept: Concept): Formant[] {
    const authored =
      this.authoredForms(base, concept) ?? (isLand(concept) ? this.authoredForms(base, "land") : undefined);
    if (authored) return authored; // a land unwritten is plain "land"

    // a settlement is an ending; what stands at a place is more often a word of its own
    const { first, last, word, more = [] } = this.fallbackForms(base, concept);
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

  /** The forms a base, the bases it extends or the shared lexicon hold for a concept */
  authoredForms(base: NameBase, concept: Concept): Formant[] | undefined {
    const own = Names.lineage(base).find(({ lexicon }) => lexicon?.[concept]?.length);
    return own?.lexicon?.[concept] ?? DEFAULT_LEXICON[concept];
  }

  /** The forms a base makes for a concept nobody wrote a form for: at a word's start, at its end, on its own */
  fallbackForms(base: NameBase, concept: Concept): Fallback {
    return this.fallbackOf(base).get(concept)!;
  }

  /** The layouts of a pattern in a base, its own, inherited or shared */
  templatesOf(base: NameBase, pattern: Pattern): Template[] {
    const own = Names.lineage(base).find(({ patterns }) => patterns?.[pattern]?.templates?.length);
    return own?.patterns?.[pattern]?.templates ?? this.defaultTemplates[pattern];
  }

  /** How often a base coins a name of a pattern */
  patternWeight(base: NameBase, pattern: Pattern): number {
    const own = Names.lineage(base).find(({ patterns }) => patterns?.[pattern]?.weight !== undefined);
    return own?.patterns?.[pattern]?.weight ?? DEFAULT_WEIGHTS[pattern];
  }

  /** The endings many names of a corpus share, the commonest first: -bach, -ingen, -ton */
  mineEndings(names: string[]): string[] {
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

  // the forms of a base nobody wrote a lexicon for, made of its own corpus and cached while the corpus stands
  private fallbackOf(base: NameBase): Map<Concept, Fallback> {
    const cached = this.fallbacks.get(base.places.names);
    if (cached) return cached;

    // a settlement ends a name with the corpus's commonest endings, a few each; what stands at a place takes the rest
    const endings = this.mineEndings(base.places.names);
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
    const everyNth = (items: string[], start: number) =>
      items.filter((_, index) => index % settlements.length === start);
    const describing = [...conceptsOf("modifier"), ...conceptsOf("numeral")];
    for (const concept of [...settlements, ...generics, ...describing, ...conceptsOf("land")]) {
      const first = coin(`${concept}|first`, 3, 5);
      const order = settlements.indexOf(concept);
      const mined = order < 0 ? [endings[spare + generics.indexOf(concept)]] : everyNth(endings.slice(0, spare), order);
      const [last = coin(`${concept}|last`, 3, 4), ...more] = generics.includes(concept) || order >= 0 ? mined : [];
      lexicon.set(concept, { first, last, word: coin(`${concept}|word`, 4, 7), more });
    }

    this.fallbacks.set(base.places.names, lexicon);
    return lexicon;
  }
}

const isLand = (concept: Concept) => kindOf(concept) === "land";

export const Lexicon = new LexiconModule();
