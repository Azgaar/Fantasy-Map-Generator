import { NAME_BASES, readNameBase } from "@/data/name-bases";
import type { Corpus, NameBase, NameBaseEntry } from "@/types/names";
import { sentences, t } from "@/utils/i18n";
import { isVowel, trimVowels } from "@/utils/language-utils";
import { log } from "@/utils/logger";
import { notify } from "@/utils/notices";
import { P, ra, seeded } from "@/utils/probability-utils";
import { capitalize, safeParseJSON } from "@/utils/string-utils";
import { NameNotation } from "./notation";
import { SoundRules } from "./sound-rules";

/** The syllables that may follow a letter, or start a word under "" */
type MarkovChain = Record<string, string[]>;

/** What the words of a corpus sound like: the letters they put together and the consonants they close in */
interface Sounds {
  words: Set<string>;
  triples: Set<string>;
  ends: Set<string>;
}

const SYLLABIC = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

const STEM_LENGTH = 4; // a stem is cut once it is this long
const MIN_CUT = 3; // a name cut short keeps this many letters
const WORD_TRIES = 60; // how many times a word that is not free is walked anew
const WORD_PATIENCE = 12; // how many walks before a longer word will do
export const PEOPLE_LENGTH: [number, number] = [4, 8]; // of a personal name, where its list sets none
const REDRAWS = 12; // how many times a word that does not sound like its corpus is walked anew

class NamesGenerator {
  private readonly shipped = new Map<string, string>(); // the JSON of the shipped bases loaded so far
  nameBases: NameBaseEntry[] = this.getNameBases();
  private readonly sounds = new WeakMap<string[], Sounds>(); // by corpus
  private readonly chains = new WeakMap<string[], MarkovChain>(); // by corpus: an edited one is chained anew

  /** A base of the classic make: a length range, a corpus and the letters allowed to stand twice in a row */
  composeBase(id: string, name: string, length: [number, number], names: string[], doubled = ""): NameBase {
    return { id, name, length, places: { names }, rules: [SoundRules.doublesRule(doubled)] };
  }

  /** An id made of a base's name, numbered when another base has taken it */
  uniqueId(name: string, taken: string[]): string {
    const slug =
      name
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "") || "base";
    let id = slug;
    for (let n = 2; taken.includes(id); n++) id = `${slug}-${n}`;
    return id;
  }

  calculateChain(names: string[]): MarkovChain {
    const chain: MarkovChain = {};

    for (const name of names) {
      let prev = ""; // the letter a syllable follows; a word ends in an empty syllable
      for (const syllable of [...this.syllables(name), ""]) {
        chain[prev] ??= [];
        chain[prev].push(syllable);
        prev = syllable[syllable.length - 1];
      }
    }

    return chain;
  }

  /** Split a name into the pseudo-syllables the chain is made of */
  syllables(rawName: string): string[] {
    const name = rawName.trim().toLowerCase();
    const basic = !/[^\x20-\x7e]/.test(name); // basic printable ASCII chars and English rules can be applied
    const syllables: string[] = [];

    for (let i = 0; i < name.length; i += syllables[syllables.length - 1].length) {
      let syllable = "";
      let v = 0; // 0 if no vowels in syllable

      for (let c = i; name[c] && syllable.length < 5; c++) {
        const that = name[c],
          next = name[c + 1]; // next char
        syllable += that;
        if (syllable === " " || syllable === "-") break; // syllable starts with space or hyphen
        if (!next || next === " " || next === "-") break; // no need to check
        if (SYLLABIC.test(that) || SYLLABIC.test(next)) break; // CJK character is a syllable on its own

        if (isVowel(that)) v = 1; // check if letter is vowel

        // do not split some diphthongs
        if (that === "y" && next === "e") continue; // 'ye'
        if (basic) {
          // English-like
          if (that === "o" && next === "o") continue; // 'oo'
          if (that === "e" && next === "e") continue; // 'ee'
          if (that === "a" && next === "e") continue; // 'ae'
          if (that === "c" && next === "h") continue; // 'ch'
        }

        if (v && isVowel(name[c + 2])) break; // syllable has vowel and additional vowel is expected soon
      }

      syllables.push(syllable);
    }

    return syllables;
  }

  private chainOf(names: string[]): MarkovChain {
    let chain = this.chains.get(names);
    if (!chain) {
      chain = this.calculateChain(names);
      this.chains.set(names, chain);
    }
    return chain;
  }

  /** Whether the map lists a base, loaded or not */
  has(id: string): boolean {
    return this.nameBases.some(base => base.id === id);
  }

  /** The base the map lists under an id, loaded or not; a shipped one the map has dropped gives the base standing in
   * its place, any other the first one */
  entry(id: string): NameBaseEntry | undefined {
    const listed = this.nameBases.find(base => base.id === id);
    if (listed) return listed;
    const place = NAME_BASES.findIndex(base => base.id === id);
    return this.nameBases[place % this.nameBases.length] ?? this.nameBases[0];
  }

  /** A loaded base by id */
  find(id: string): NameBase | undefined {
    const base = this.nameBases.find(base => base.id === id);
    return base?.places && base;
  }

  /** The base an id stands for; one that failed to load gives any that is loaded */
  resolve(id: string): NameBase {
    const base = this.entry(id);
    if (base?.places) return base;
    const [any] = this.loaded();
    if (!any) throw new Error("No name base is loaded");
    return any;
  }

  /** The map's bases loaded so far: at least those its cultures use, all of them after `loadAll` */
  loaded(): NameBase[] {
    return this.nameBases.filter((base): base is NameBase => Boolean(base.places));
  }

  /** Bases in the order of their names, to choose from */
  sorted<T extends NameBaseEntry>(bases: T[]): T[] {
    return bases.toSorted((a, b) => a.name.localeCompare(b.name));
  }

  /** Load what bases stand for, with the bases they extend. One that fails to load stays out */
  async load(ids: Iterable<string>): Promise<void> {
    await Promise.all([...new Set(ids)].map(id => this.loadLineage(this.entry(id))));
  }

  /** Load the bases the map's cultures use */
  async loadUsed(): Promise<void> {
    await this.load((pack.cultures ?? []).map(({ base }) => base));
  }

  /** Load every base the map lists */
  async loadAll(): Promise<void> {
    await this.load(this.ids());
  }

  /** Any of the loaded bases */
  randomBase(): NameBase {
    return ra(this.loaded());
  }

  private async loadLineage(entry: NameBaseEntry | undefined): Promise<void> {
    const seen = new Set<NameBaseEntry>();
    for (let base = entry; base && !seen.has(base); ) {
      seen.add(base);
      const { id } = base;
      try {
        const shipped = base.places ? undefined : await this.read(id);
        if (!base.places) Object.assign(base, shipped); // it may have loaded meanwhile
      } catch (error) {
        log.error(`Name base ${id} failed to load`, error);
      }
      const parent = base.places && base.extends;
      base = this.nameBases.find(({ id }) => id === parent);
    }
  }

  private async read(id: string): Promise<NameBase> {
    const shipped = this.shipped.get(id) ?? JSON.stringify(NameNotation.read(await readNameBase(id)));
    this.shipped.set(id, shipped);
    return JSON.parse(shipped);
  }

  /** A base and the bases it extends, nearest first */
  lineage(base: NameBase): NameBase[] {
    const line = [base];
    for (let parent = base.extends && this.find(base.extends); parent && !line.includes(parent); ) {
      line.push(parent);
      parent = parent.extends && this.find(parent.extends);
    }
    return line;
  }

  /** What a base holds, or the nearest base it extends that does */
  inherited<T>(base: NameBase, pick: (base: NameBase) => T | undefined): T | undefined {
    for (const line of this.lineage(base)) {
      const held = pick(line);
      if (held !== undefined) return held;
    }
    return undefined;
  }

  /** The lengths of a base's generated place names */
  placeLength(base: NameBase): [min: number, max: number] {
    return base.places.length ?? base.length;
  }

  /** A personal name of a base: a new one off the chain of its people corpus, or one of the corpus as it is.
   * The base sets which, unless the options do. A base with no people names a person like a place, only shorter.
   * Women are named as often as `female` says, 0 to 1, or by the sizes of the two lists */
  getPerson(id: string, female?: number): string {
    const base = this.resolve(id);
    const corpora = this.inherited(base, ({ people }) => {
      const listed = [people?.male, people?.female].filter((list): list is Corpus => Boolean(list?.names.length));
      return listed.length ? listed : undefined;
    });
    if (!corpora) return this.getBase(id, 3, 6, true);

    const total = corpora.reduce((sum, { names }) => sum + names.length, 0);
    const men = female === undefined ? corpora[0].names.length / total : 1 - female;
    const corpus = corpora[1] && Math.random() >= men ? corpora[1] : corpora[0];

    const { proper } = options.generation.names;
    if ((proper === "base" ? (corpus.mode ?? "chain") : proper) === "pick") return ra(corpus.names);
    return this.coin(corpus, base, corpus.length ?? PEOPLE_LENGTH);
  }

  /** A proper name of a river or a lake: off the chain of the base's waters or one of them as it is, as the list
   * says; a place name where the base lists none */
  getWater(id: string): string {
    const base = this.resolve(id);
    const waters = this.inherited(base, ({ waters }) => (waters?.names.length ? waters : undefined));
    if (!waters) return this.getBase(id);
    if (waters.mode === "pick") return ra(waters.names);
    return this.coin(waters, base, waters.length ?? this.placeLength(base));
  }

  // a new name off a corpus's chain, by the base's rules
  private coin(corpus: Corpus, base: NameBase, [min, max]: [number, number]): string {
    const walked = this.draw(this.chainOf(corpus.names), corpus.names, min, max);
    const name = SoundRules.capitalize(SoundRules.apply(walked, base.rules));
    return name.length < 2 ? ra(corpus.names) : name;
  }

  /** A word off a chain that sounds like its corpus: one that does not is walked anew, on a random sequence of its
   * own, and the closest of the words is taken */
  private draw(chain: MarkovChain, names: string[], min: number, max: number): string {
    let word = this.walk(chain, min, max);
    if (SYLLABIC.test(word)) return word;
    const first = word;
    let best = this.strangeness(word, names);
    for (let n = 1; best && n <= REDRAWS; n++) {
      const other = seeded(`${first}|${n}`, () => this.walk(chain, min, max));
      const strangeness = other.length < min ? Infinity : this.strangeness(other, names);
      if (strangeness < best) [word, best] = [other, strangeness];
    }
    return word;
  }

  // how many times a word puts three letters together as no word of the corpus does; a word of the corpus itself is one off
  private strangeness(word: string, names: string[]): number {
    const { triples, words } = this.soundsOf(names);
    let strange = words.has(word) ? 1 : 0;
    for (const triple of triplesOf(word)) if (!triples.has(triple)) strange++;
    return strange;
  }

  /** A lowercase word that sounds like a base's names and is free: a longer one where those run out, any in the end */
  getWord(base: NameBase, min: number, max: number, isFree: (word: string) => boolean): string {
    const { names } = base.places;
    const chain = this.chainOf(names);
    if (!chain[""]) return "error";
    let word = "";
    for (let attempt = 0; attempt < WORD_TRIES; attempt++) {
      const room = max + Math.floor(attempt / WORD_PATIENCE);
      const walked = this.walk(chain, min, room);
      if (walked.length < min || walked.length > room + 2) continue;
      const isFit = isFree(walked) && this.isFamiliar(walked, names);
      if (word && !isFit) continue;
      const ruled = SoundRules.apply(walked, base.rules, true);
      word = ruled.replace(/[^\p{L}]/gu, "");
      if (isFit && word === ruled && word.length >= 2 && isFree(word)) break;
    }
    return word;
  }

  // whether a word puts letters together as the words of a corpus do, and is none of them
  private isFamiliar(word: string, names: string[]): boolean {
    if (SYLLABIC.test(word)) return true;
    const { triples, words } = this.soundsOf(names);
    const ended = `^${word}$`;
    for (let i = 0; i + 3 <= ended.length; i++) if (!triples.has(ended.slice(i, i + 3))) return false;
    return !words.has(word);
  }

  private soundsOf(names: string[]): Sounds {
    let sounds = this.sounds.get(names);
    if (!sounds) {
      const words = names.map(name => name.trim().toLowerCase());
      const ends = words.flatMap(word => word.split(/[^\p{L}]+/u)).map(closingOf);
      sounds = { words: new Set(words), triples: new Set(words.flatMap(triplesOf)), ends: new Set(ends) };
      this.sounds.set(names, sounds);
    }
    return sounds;
  }

  /** The start of a name, so many syllables of it, with no more consonants at its end than the base's names close in */
  cut(name: string, base: NameBase, syllables: number): string {
    let start = "";
    for (const [index, syllable] of this.syllables(name).entries())
      if (index < syllables || start.length < MIN_CUT) start += syllable;
    return start.length < name.length ? this.close(start, base) : name;
  }

  private close(start: string, base: NameBase): string {
    if (SYLLABIC.test(start)) return start;
    const { ends } = this.soundsOf(base.places.names);
    let closed = start;
    while (closed.length > 2 && closingOf(closed) && !ends.has(closingOf(closed))) closed = closed.slice(0, -1);
    return closed.length >= MIN_CUT || start.length < MIN_CUT ? closed : start;
  }

  /** Walk a chain from a word's start until the word ends between the lengths given, or grows too long */
  private walk(chain: MarkovChain, min: number, max: number): string {
    let v = chain[""],
      cur = ra(v),
      w = "";
    for (let i = 0; i < 20; i++) {
      if (cur === "") {
        // end of word
        if (w.length < min) {
          w = "";
          v = chain[""];
        } else break;
      } else {
        if (w.length + cur.length > max) {
          // word too long
          if (w.length < min) w += cur;
          break;
        } else v = chain[cur[cur.length - 1]] || chain[""];
      }

      w += cur;
      cur = ra(v);
    }

    return /['\- ]$/.test(w) ? w.slice(0, -1) : w; // a name ends in a letter
  }

  /** Generate a name with the base's Markov chain, with no doubled letters if `single` */
  getBase(id: string, min?: number, max?: number, single = false): string {
    const base = this.resolve(id);
    const chain = this.chainOf(base.places.names);
    if (!chain[""]) {
      notify(
        sentences(t("Namesbase {{base}} is incorrect", { base: base.name }), t("Please check in namesbase editor")),
        "error"
      );
      log.error(`Namebase ${base.id} is incorrect!`);
      return "ERROR";
    }

    const [shortest, longest] = this.placeLength(base);
    const w = this.draw(chain, base.places.names, min || shortest, max || longest);

    let name = SoundRules.capitalize(SoundRules.apply(w, base.rules, single));

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
    const [shortest, longest] = this.placeLength(this.resolve(id));
    const min = shortest ? shortest - 1 : undefined;
    const max = longest && min ? Math.max(longest - 2, min) : undefined;
    return this.getBase(id, min, max, true);
  }

  /** The start of a place name, without the ending that makes it a town: what a people is called */
  getStem(id: string): string {
    for (let attempt = 0; ; attempt++) {
      const name = this.getBaseShort(id);
      const [word] = name.split(/[^\p{L}]+/u).sort((a, b) => b.length - a.length);
      const syllables = this.syllables(word);
      let stem = "";
      for (const syllable of syllables.slice(0, -1)) if (stem.length < STEM_LENGTH) stem += syllable;
      if (SYLLABIC.test(word)) return stem || word;
      stem = this.close(stem.toLowerCase(), this.resolve(id));
      if (stem.replace(/[aeiouy]+$/, "").length > 2 || attempt > 8)
        return capitalize(stem.length < MIN_CUT ? word : stem);
    }
  }

  /** A name for the map, in a base its cultures use: a land's, or a place's as it is */
  getMapName(): string {
    const base = this.mapBase();
    if (P(0.3)) return this.getBaseShort(base.id);
    const stem = this.getStem(base.id);
    if (SYLLABIC.test(stem)) return stem;
    return P(0.8) ? `${trimVowels(stem)}ia` : `${stem.replace(/l$/, "")}land`;
  }

  // the base of any of the map's cultures, the Wildlands where it has no other
  private mapBase(): NameBase {
    const cultures = pack.cultures.filter(culture => culture.i && !culture.removed);
    return this.resolve((cultures.length ? ra(cultures) : pack.cultures[0]).base);
  }

  /** A fresh list of the shipped bases, in full where loaded */
  getNameBases(): NameBaseEntry[] {
    return NAME_BASES.map(base => {
      const shipped = this.shipped.get(base.id);
      return shipped ? JSON.parse(shipped) : { ...base };
    });
  }

  /** Whether a base stands as shipped: one the user added or changed does not */
  isShipped(base: NameBaseEntry): boolean {
    return !base.places || JSON.stringify(base) === this.shipped.get(base.id);
  }

  /** Whether a base is a shipped one the user has changed */
  isChanged(base: NameBaseEntry): boolean {
    return !this.isShipped(base) && NAME_BASES.some(({ id }) => id === base.id);
  }

  /** Put a shipped base back as it ships */
  async reset(id: string): Promise<void> {
    const shipped = await this.read(id);
    this.nameBases = this.nameBases.map(base => (base.id === id ? shipped : base));
  }

  add(base: NameBase): NameBase {
    this.nameBases.push(base);
    return base;
  }

  /** Add a copy of a base under a name and an id of its own */
  copy(base: NameBase, name: string): NameBase {
    const id = this.uniqueId(name, this.ids());
    return this.add({ ...structuredClone(base), id, name });
  }

  remove(id: string): void {
    this.nameBases = this.nameBases.filter(base => base.id !== id);
  }

  ids(): string[] {
    return this.nameBases.map(({ id }) => id);
  }

  /** The bases as a .map record: a shipped base left as it is goes by its id alone, so it follows later updates */
  serialize(): string {
    return JSON.stringify(this.nameBases.map(base => (this.isShipped(base) ? { id: base.id } : base)));
  }

  /** Take the bases of a .map record, or the shipped ones when it holds none or is of an older make */
  restore(record?: string): void {
    const shipped = this.getNameBases();
    const stored: (NameBase | { id: string })[] | null = safeParseJSON(record ?? "");
    const byId = (id: string) => shipped.find(base => base.id === id) ?? [];
    this.nameBases = stored ? stored.flatMap(base => ("places" in base ? base : byId(base.id))) : shipped;
  }

  /** Swap the whole set; a culture goes on with the base standing where its own stood */
  replace(bases: NameBaseEntry[]): void {
    const places = new Map(this.nameBases.map(({ id }, index) => [id, index]));
    for (const culture of pack.cultures ?? []) culture.base = bases[places.get(culture.base) ?? -1]?.id ?? culture.base;
    this.nameBases = bases;
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

const triplesOf = (word: string) => {
  const ended = `^${word}$`;
  const triples: string[] = [];
  for (let i = 0; i + 3 <= ended.length; i++) triples.push(ended.slice(i, i + 3));
  return triples;
};

// the consonants a word closes in
const closingOf = (word: string) => {
  let start = word.length;
  while (start > 0 && !isVowel(word[start - 1])) start--;
  return word.slice(start);
};

export const Names = new NamesGenerator();
