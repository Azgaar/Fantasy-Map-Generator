import type { Corpus, NameBase } from "@/types/names";
import { sentences, t } from "@/utils/i18n";
import { log } from "@/utils/logger";
import { notify } from "@/utils/notices";
import { ra, seeded } from "@/utils/probability-utils";
import { capitalize } from "@/utils/string-utils";
import { Corpora, MIN_CUT } from "./corpora";
import { NameBases } from "./name-bases";
import { SoundRules } from "./sound-rules";

const PEOPLE_NAME = 4; // the letters a people's name has at least
const PEOPLE_TRIES = 12;
const STEM_LENGTH = 4; // a stem is cut once it is this long
const WORD_TRIES = 60; // how many times a word that is not free is walked anew
const WORD_PATIENCE = 12; // how many walks before a longer word will do
export const PEOPLE_LENGTH: [number, number] = [4, 8]; // of a personal name, where its list sets none

// Proper names off a base's lists: places, waters, persons, peoples
class NamesGenerator {
  /** A personal name of a base: a new one off the chain of its people corpus, or one of the corpus as it is.
   * The base sets which, unless the options do. A base with no people names a person like a place, only shorter.
   * Women are named as often as `female` says, 0 to 1, or as the base does */
  getPerson(id: string, female?: number): string {
    const base = NameBases.resolve(id);
    const corpora = NameBases.peopleOf(base);
    if (!corpora) return this.getBase(id, 3, 6, true);
    const corpus = corpora[1] && Math.random() >= 1 - (female ?? this.womenShare(base)) ? corpora[1] : corpora[0];

    const { proper } = options.generation.names;
    if ((proper === "base" ? (corpus.mode ?? "chain") : proper) === "pick") return ra(corpus.names);
    return this.coin(corpus, base, corpus.length ?? PEOPLE_LENGTH);
  }

  /** The share of women among the persons a base names: its founders', where it sets one, or by the sizes of its lists */
  womenShare(base: NameBase): number {
    const [men = 0, women = 0] = (NameBases.peopleOf(base) ?? []).map(({ names }) => names.length);
    return NameBases.femaleFounders(base) ?? (women ? women / (men + women) : 0);
  }

  /** A person of a culture, off one roll of the ambient sequence: how the name is coined moves nothing else */
  getCulturePerson(culture: number): string {
    return seeded(`${Math.random()}`, () => this.getPerson(pack.cultures[culture].base));
  }

  /** A god of a culture, off one roll too: goddesses are nearer to a half than women are among founders */
  getCultureDeity(culture: number): string {
    const { base } = pack.cultures[culture];
    return seeded(`${Math.random()}`, () => this.getPerson(base, (0.5 + this.womenShare(NameBases.resolve(base))) / 2));
  }

  /** A proper name of a river or a lake: off the chain of the base's waters or one of them as it is, as the list
   * says; a place name where the base lists none */
  getWater(id: string): string {
    const base = NameBases.resolve(id);
    const waters = NameBases.watersOf(base);
    if (!waters) return this.getBase(id);
    if (waters.mode === "pick") return ra(waters.names);
    return this.coin(waters, base, waters.length ?? NameBases.placeLength(base));
  }

  // a new name off a corpus's chain, by the base's rules
  private coin(corpus: Corpus, base: NameBase, [min, max]: [number, number]): string {
    const walked = Corpora.draw(corpus.names, min, max);
    const name = SoundRules.capitalize(SoundRules.apply(walked, NameBases.rulesOf(base)), NameBases.joiningOf(base));
    return name.length < 2 ? ra(corpus.names) : name;
  }

  /** A lowercase word that sounds like a base's names and is free: a longer one where those run out, any in the end */
  getWord(base: NameBase, min: number, max: number, isFree: (word: string) => boolean): string {
    const { names } = base.places;
    if (!Corpora.chainOf(names)[""]) return "error";
    let word = "";
    for (let attempt = 0; attempt < WORD_TRIES; attempt++) {
      const room = max + Math.floor(attempt / WORD_PATIENCE);
      const walked = Corpora.walk(names, min, room);
      if (walked.length < min || walked.length > room + 2) continue;
      const isFit = isFree(walked) && Corpora.isFamiliar(walked, names);
      if (word && !isFit) continue;
      const ruled = SoundRules.apply(walked, NameBases.rulesOf(base), true);
      word = ruled.replace(/[^\p{L}]/gu, "");
      if (isFit && word === ruled && word.length >= 2 && isFree(word)) break;
    }
    return word;
  }

  /** Generate a name with the base's Markov chain, with no doubled letters if `single` */
  getBase(id: string, min?: number, max?: number, single = false): string {
    const base = NameBases.resolve(id);
    if (!Corpora.chainOf(base.places.names)[""]) {
      notify(
        sentences(t("Namesbase {{base}} is incorrect", { base: base.name }), t("Please check in namesbase editor")),
        "error"
      );
      log.error(`Namebase ${base.id} is incorrect!`);
      return "ERROR";
    }

    const [shortest, longest] = NameBases.placeLength(base);
    const w = Corpora.draw(base.places.names, min || shortest, max || longest);

    let name = SoundRules.capitalize(SoundRules.apply(w, NameBases.rulesOf(base), single), NameBases.joiningOf(base));

    // join the word if any part has only 1 letter
    if (name.split(" ").some(part => part.length < 2))
      name = name
        .split(" ")
        .map((p, i) => (i ? p.toLowerCase() : p))
        .join("");

    if (name.length < 2) {
      log.error("Name is too short! Random name will be selected");
      name = ra(base.places.names);
    }

    return name;
  }

  // generate name for culture
  getCulture(culture: number, min?: number, max?: number, single = false): string {
    if (culture === undefined) {
      log.error("Please define a culture");
      return "ERROR";
    }
    return this.getBase(pack.cultures[culture].base, min, max, single);
  }

  // generate short name for culture
  getCultureShort(culture: number): string {
    if (culture === undefined) {
      log.error("Please define a culture");
      return "ERROR";
    }
    return this.getBaseShort(pack.cultures[culture].base);
  }

  // generate short name for base
  getBaseShort(id: string): string {
    const [shortest, longest] = NameBases.placeLength(NameBases.resolve(id));
    const min = shortest ? shortest - 1 : undefined;
    const max = longest && min ? Math.max(longest - 2, min) : undefined;
    return this.getBase(id, min, max, true);
  }

  /** The start of a place name, without the ending that makes it a town: what a people is called */
  getStem(id: string): string {
    for (let attempt = 0; ; attempt++) {
      const name = this.getBaseShort(id);
      const [word] = name.split(/[^\p{L}]+/u).sort((a, b) => b.length - a.length);
      const syllables = Corpora.syllables(word);
      let stem = "";
      for (const syllable of syllables.slice(0, -1)) if (stem.length < STEM_LENGTH) stem += syllable;
      if (Corpora.isSyllabic(word)) return stem || word;
      stem = Corpora.close(stem.toLowerCase(), NameBases.resolve(id).places.names);
      if (stem.replace(/[aeiouy]+$/, "").length > 2 || attempt > 8)
        return capitalize(stem.length < MIN_CUT ? word : stem);
    }
  }

  /** What a people of a base is called: the stem of a place name no culture of the map is called by */
  getPeople(id: string): string {
    const taken = new Set(pack.cultures.map(({ name }) => name));
    for (let attempt = 0; ; attempt++) {
      const stem = this.getStem(id);
      const isWhole = stem.length >= PEOPLE_NAME || Corpora.isSyllabic(stem);
      if ((isWhole && !taken.has(stem)) || attempt >= PEOPLE_TRIES) return stem;
    }
  }

  /** The base of any of the map's cultures, the Wildlands where it has no other */
  mapBase(): NameBase {
    const cultures = pack.cultures.filter(culture => culture.i && !culture.removed);
    return NameBases.resolve((cultures.length ? ra(cultures) : pack.cultures[0]).base);
  }

  /** The calendar era: a name in a base the map's cultures use, plus "Era" */
  getEra(): string {
    return `${this.getBaseShort(this.mapBase().id)} Era`;
  }

  /** The abbreviation an era name suggests, which the user may override */
  getEraShort(era: string): string {
    return era
      .split(" ")
      .filter(Boolean)
      .map(word => word[0].toUpperCase())
      .join("");
  }
}

export const Names = new NamesGenerator();
