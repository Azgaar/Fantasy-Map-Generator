// What a base holds for its concepts and patterns: forms and templates written for it, for a base it extends or
// for all bases, and forms coined from its corpus where nobody wrote any

import { CONCEPTS, type Concept, conceptsOf, type Kind, kindOf, settles } from "@/data/name-concepts";
import { DEFAULT_LEXICON, DEFAULT_TEMPLATES, DEFAULT_WEIGHTS } from "@/data/name-rules";
import type { Derivation, Formant, Grammar, NameBase, Pattern, Template } from "@/types/names";
import { seeded } from "@/utils/probability-utils";
import { compileRegex } from "@/utils/string-utils";
import { Names } from "./names-generator";
import { NameNotation, STAR } from "./notation";

const SETTLEMENT_ENDINGS = 3;
const FLUENT = 2 / 3; // the share of places a base of a real language writes at least

// what a kind of concept takes of the grammar: a place a stem for its suffixes, a modifier a combining form too
const DERIVED: Partial<Record<Kind, Derivation[]>> = {
  generic: ["stem"],
  modifier: ["first", "stem"]
};

/** What a base writes of the vocabulary, read off the lexicons of its lineage and true while they stand */
interface Vocabulary {
  lexicons: NameBase["lexicon"][];
  written: Set<Concept>;
  isFluent: boolean; // it writes most places
  placeWords: Set<string>; // what it calls settlements, places and lands
}

class LexiconModule {
  private readonly defaultTemplates = Object.fromEntries(
    Object.entries(DEFAULT_TEMPLATES).map(([pattern, text]) => [pattern, NameNotation.parseTemplates(text)])
  ) as Record<Pattern, Template[]>;
  private readonly coined = new WeakMap<string[], { rules: NameBase["rules"]; forms: Map<Concept, Formant[]> }>(); // by corpus
  private readonly derivations = new WeakMap<Formant[], { derive: Grammar["derive"]; forms: Formant[] }>(); // by written forms
  private readonly vocabularies = new WeakMap<NameBase, Vocabulary>();

  /** The forms of a concept in a base: written for it, for a base it extends or for all bases, else coined */
  formsOf(base: NameBase, concept: Concept): Formant[] {
    const written = this.writtenForms(base, concept);
    return written ? this.withDerived(base, concept, written) : this.coinedForms(base, concept);
  }

  /** The forms a concept takes where a base writes none of its own */
  standInForms(base: NameBase, concept: Concept): Formant[] {
    const bare = { ...base, lexicon: { ...base.lexicon, [concept]: undefined } };
    return this.writtenForms(bare, concept) ?? this.coinedForms(base, concept);
  }

  /** The forms a base's grammar makes of what is written for a concept: a stem of its words, a combining form of its
   * stems or, where it has none, of its words. The first of the grammar's rules of a kind that matches the form as
   * written, `*` and all, makes one, as heavy as the form it is made of; one still holding a `*` is none.
   * A kind written for the concept is made of nothing */
  derivedForms(base: NameBase, concept: Concept, written: Formant[]): Formant[] {
    const derive = this.grammarOf(base)?.derive;
    const kinds = DERIVED[kindOf(concept)];
    if (!derive || !kinds) return [];

    const words = written.filter(({ form, position }) => (!position || position === "word") && /^\p{L}/u.test(form));
    const stems = written.filter(({ position }) => position === "stem");
    const made: Formant[] = [];
    for (const kind of kinds) {
      if (written.some(({ position }) => position === kind)) continue;
      for (const { form, weight } of kind === "first" && stems.length ? stems : words) {
        const rule = derive[kind]?.find(({ match }) => compileRegex(match)?.test(form));
        const derived = rule && form.replace(compileRegex(rule.match)!, rule.replace);
        if (!derived || STAR.test(derived)) continue;
        if ([...written, ...made].some(other => other.form === derived && other.position === kind)) continue;
        made.push({ form: derived, position: kind, ...(weight !== undefined && { weight }) });
      }
    }
    return made;
  }

  /** The forms a base, the bases it extends or the shared lexicon hold for a concept */
  authoredForms(base: NameBase, concept: Concept): Formant[] | undefined {
    const own = Names.inherited(base, ({ lexicon }) => (lexicon?.[concept]?.length ? lexicon[concept] : undefined));
    return own ?? DEFAULT_LEXICON[concept];
  }

  /** The concepts a base has forms of, its own or inherited */
  writtenConcepts(base: NameBase): Set<Concept> {
    return this.vocabularyOf(base).written;
  }

  /** Whether a word is what the base calls a kind of place or land */
  isPlaceWord(word: string, base: NameBase): boolean {
    return this.vocabularyOf(base).placeWords.has(word);
  }

  /** A base's grammar, its own or inherited */
  grammarOf(base: NameBase): Grammar | undefined {
    return Names.inherited(base, ({ grammar }) => grammar);
  }

  /** The concepts a base names with, of those given: a base that writes most places keeps to the words it writes, so
   * that no coined word stands among real ones */
  spoken(base: NameBase, concepts: Concept[]): Concept[] {
    const { isFluent, written } = this.vocabularyOf(base);
    const known = isFluent ? concepts.filter(concept => written.has(concept)) : [];
    return known.length ? known : concepts;
  }

  /** The layouts of a pattern in a base, its own, inherited or shared */
  templatesOf(base: NameBase, pattern: Pattern): Template[] {
    const own = Names.inherited(base, ({ patterns }) => {
      const templates = patterns?.[pattern]?.templates;
      return templates?.length ? templates : undefined;
    });
    return own ?? this.defaultTemplates[pattern];
  }

  /** How often a base coins a name of a pattern */
  patternWeight(base: NameBase, pattern: Pattern): number {
    return Names.inherited(base, ({ patterns }) => patterns?.[pattern]?.weight) ?? DEFAULT_WEIGHTS[pattern];
  }

  /** The share of a base's founders that are women, where it sets one */
  femaleFounders(base: NameBase): number | undefined {
    return Names.inherited(base, ({ patterns }) => patterns?.["owner-generic"]?.female);
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

  // a land unwritten is plain "land"
  private writtenForms(base: NameBase, concept: Concept): Formant[] | undefined {
    return this.authoredForms(base, concept) ?? (isLand(concept) ? this.authoredForms(base, "land") : undefined);
  }

  private vocabularyOf(base: NameBase): Vocabulary {
    const lexicons = Names.lineage(base).map(({ lexicon }) => lexicon);
    const cached = this.vocabularies.get(base);
    if (cached?.lexicons.length === lexicons.length && cached.lexicons.every((lexicon, i) => lexicon === lexicons[i]))
      return cached;

    const concepts = Object.keys(CONCEPTS) as Concept[];
    const written = new Set(concepts.filter(concept => this.authoredForms(base, concept)?.length));
    const places = conceptsOf("generic");
    const isFluent = places.filter(concept => written.has(concept)).length >= places.length * FLUENT;
    const forms = [...conceptsOf("settlement"), ...places, ...conceptsOf("land")].flatMap(
      concept => this.authoredForms(base, concept) ?? []
    );
    const placeWords = new Set(forms.map(({ form }) => form.replaceAll("-", "").toLowerCase()));
    const vocabulary = { lexicons, written, isFluent, placeWords };
    this.vocabularies.set(base, vocabulary);
    return vocabulary;
  }

  // the written forms and what the grammar makes of them, cached while both stand
  private withDerived(base: NameBase, concept: Concept, written: Formant[]): Formant[] {
    const derive = this.grammarOf(base)?.derive;
    if (!derive) return written;
    const cached = this.derivations.get(written);
    if (cached?.derive === derive) return cached.forms;
    const forms = [...written, ...this.derivedForms(base, concept, written)];
    this.derivations.set(written, { derive, forms });
    return forms;
  }

  /** The forms a base makes for a concept nobody wrote a form for: a settlement is an ending, what stands at a place
   * is more often a word of its own */
  private coinedForms(base: NameBase, concept: Concept): Formant[] {
    const { names } = base.places;
    let coined = this.coined.get(names);
    if (!coined || coined.rules !== base.rules) {
      coined = { rules: base.rules, forms: this.coin(base) };
      this.coined.set(names, coined);
    }
    return coined.forms.get(concept)!;
  }

  // all coined forms at once, whatever is written: no two concepts share a root, and an edit to one moves no other
  private coin(base: NameBase): Map<Concept, Formant[]> {
    const endings = this.mineEndings(base.places.names);
    const taken = new Set(endings);
    const word = (min: number, max: number): string => {
      const own = Names.getWord(base, min, max, drawn => !taken.has(drawn));
      taken.add(own);
      return own;
    };
    const forms = new Map<Concept, Formant[]>();
    const add = (concept: Concept, make: () => Formant[]) => forms.set(concept, seeded(`${base.id}|${concept}`, make));

    // settlements end names with the corpus's commonest endings, a few each; what stands at a place takes the rest
    const settlements = conceptsOf("settlement");
    const spare = endings.splice(0, settlements.length * SETTLEMENT_ENDINGS);
    for (const [order, concept] of settlements.entries())
      add(concept, () => {
        const mined = spare.filter((_, index) => index % settlements.length === order);
        const own = mined.length ? mined : [word(3, 4)];
        return own.map((form, index) => ({ form, position: "last", weight: own.length - index }));
      });
    for (const [order, concept] of conceptsOf("generic").entries())
      add(concept, () => [
        { form: word(4, 7), position: "word", weight: settles(concept) ? 1 : 4 }, // a fort ends a name as a town does
        { form: endings[order] ?? word(3, 4), position: "last", weight: 2 },
        { form: word(3, 5), position: "first", weight: 2 }
      ]);
    for (const concept of [...conceptsOf("modifier"), ...conceptsOf("numeral")])
      add(concept, () => [
        { form: word(3, 5), position: "first" },
        { form: word(4, 7), position: "word" }
      ]);
    return forms;
  }
}

const isLand = (concept: Concept) => kindOf(concept) === "land";

export const Lexicon = new LexiconModule();
