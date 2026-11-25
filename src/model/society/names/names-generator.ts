import { NAME_BASES, readNameBase } from "@/data/name-bases";
import type { Corpus, NameBase, NameBaseEntry } from "@/types/names";
import { sentences, t } from "@/utils/i18n";
import { log } from "@/utils/logger";
import { notify } from "@/utils/notices";
import { ra, seeded } from "@/utils/probability-utils";
import { capitalize } from "@/utils/string-utils";
import { Corpora, MIN_CUT } from "./corpora";
import { NameNotation } from "./notation";
import { SoundRules } from "./sound-rules";

const PEOPLE_NAME = 4; // the letters a people's name has at least
const PEOPLE_TRIES = 12;
const STEM_LENGTH = 4; // a stem is cut once it is this long
const WORD_TRIES = 60; // how many times a word that is not free is walked anew
const WORD_PATIENCE = 12; // how many walks before a longer word will do
export const PEOPLE_LENGTH: [number, number] = [4, 8]; // of a personal name, where its list sets none

class NamesGenerator {
  private readonly shipped = new Map(NAME_BASES.map(base => [base.id, { ...base }])); // filled as they load, never edited

  /** All bases: the shipped ones, each as edited where it is, and the user's own */
  get nameBases(): NameBaseEntry[] {
    const own = options.map.nameBases.filter(({ id }) => !this.shipped.has(id));
    return [...Array.from(this.shipped.keys(), id => this.entry(id)), ...own];
  }

  /** A base of the classic make: a length range, a corpus and the letters allowed to stand twice in a row */
  composeBase(id: string, name: string, [min, max]: [number, number], names: string[], doubled = ""): NameBase {
    const length: [number, number] = [Number.isFinite(min) ? min : 5, Number.isFinite(max) ? max : 12];
    return { id, name: name || "Base", length, places: { names }, rules: [SoundRules.doublesRule(doubled)] };
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

  /** Whether there is a base of an id, loaded or not */
  has(id: string): boolean {
    return this.shipped.has(id) || Boolean(this.own(id));
  }

  // an edited or custom base
  private own(id: string): NameBase | undefined {
    return options.map.nameBases.find(base => base.id === id);
  }

  /** The base of an id, loaded or not; the first one where there is none */
  entry(id: string): NameBaseEntry {
    return this.own(id) ?? this.shipped.get(id) ?? this.entry(NAME_BASES[0].id);
  }

  /** A loaded base by id */
  find(id: string): NameBase | undefined {
    const base = this.own(id) ?? this.shipped.get(id);
    return base?.places && base;
  }

  /** The base an id stands for; one that failed to load gives any that is loaded */
  resolve(id: string): NameBase {
    const base = this.entry(id);
    if (base.places) return base;
    const [any] = this.loaded();
    if (!any) throw new Error("No name base is loaded");
    return any;
  }

  /** The bases loaded so far: at least those the map's cultures use, all of them after `loadAll` */
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

  /** Load the bases the map's cultures use and those its burgs' names were coined in */
  async loadUsed(): Promise<void> {
    const bases = (pack.cultures ?? []).map(({ base }) => base);
    const origins = (pack.burgs ?? []).flatMap(burg => burg?.meaning?.origin ?? []);
    await this.load([...bases, ...origins]);
  }

  /** Load every base */
  async loadAll(): Promise<void> {
    await this.load(this.ids());
  }

  /** Any of the loaded bases */
  randomBase(): NameBase {
    return ra(this.loaded());
  }

  private async loadLineage(entry: NameBaseEntry): Promise<void> {
    const seen = new Set<NameBaseEntry>();
    for (let base: NameBaseEntry | undefined = entry; base && !seen.has(base); ) {
      seen.add(base);
      try {
        const read = base.places ? undefined : NameNotation.read(await readNameBase(base.id));
        if (!base.places) Object.assign(base, read); // it may have loaded meanwhile
      } catch (error) {
        log.error(`Name base ${base.id} failed to load`, error);
      }
      const parent: string | undefined = base.places && base.extends;
      base = parent && this.has(parent) ? this.entry(parent) : undefined;
    }
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

  /** The lists of personal names of a base, its own or inherited */
  peopleOf(base: NameBase): Corpus[] | undefined {
    return this.inherited(base, ({ people }) => {
      const listed = [people?.male, people?.female].filter((list): list is Corpus => Boolean(list?.names.length));
      return listed.length ? listed : undefined;
    });
  }

  /** The names of rivers and lakes of a base, its own or inherited */
  watersOf(base: NameBase): Corpus | undefined {
    return this.inherited(base, ({ waters }) => (waters?.names.length ? waters : undefined));
  }

  /** The lengths of a base's generated place names */
  placeLength(base: NameBase): [min: number, max: number] {
    return base.places.length ?? base.length;
  }

  /** A personal name of a base: a new one off the chain of its people corpus, or one of the corpus as it is.
   * The base sets which, unless the options do. A base with no people names a person like a place, only shorter.
   * Women are named as often as `female` says, 0 to 1, or as the base does */
  getPerson(id: string, female?: number): string {
    const base = this.resolve(id);
    const corpora = this.peopleOf(base);
    if (!corpora) return this.getBase(id, 3, 6, true);
    const corpus = corpora[1] && Math.random() >= 1 - (female ?? this.womenShare(base)) ? corpora[1] : corpora[0];

    const { proper } = options.generation.names;
    if ((proper === "base" ? (corpus.mode ?? "chain") : proper) === "pick") return ra(corpus.names);
    return this.coin(corpus, base, corpus.length ?? PEOPLE_LENGTH);
  }

  /** The share of women among the persons a base names: its founders', where it sets one, or by the sizes of its lists */
  womenShare(base: NameBase): number {
    const [men = 0, women = 0] = (this.peopleOf(base) ?? []).map(({ names }) => names.length);
    return this.femaleFounders(base) ?? (women ? women / (men + women) : 0);
  }

  /** The share of a base's founders that are women, where it sets one */
  femaleFounders(base: NameBase): number | undefined {
    return this.inherited(base, ({ patterns }) => patterns?.["owner-generic"]?.female);
  }

  /** A person of a culture, off one roll of the ambient sequence: how the name is coined moves nothing else */
  getCulturePerson(culture: number): string {
    return seeded(`${Math.random()}`, () => this.getPerson(pack.cultures[culture].base));
  }

  /** A god of a culture, off one roll too: goddesses are nearer to a half than women are among founders */
  getCultureDeity(culture: number): string {
    const { base } = pack.cultures[culture];
    return seeded(`${Math.random()}`, () => this.getPerson(base, (0.5 + this.womenShare(this.resolve(base))) / 2));
  }

  /** A proper name of a river or a lake: off the chain of the base's waters or one of them as it is, as the list
   * says; a place name where the base lists none */
  getWater(id: string): string {
    const base = this.resolve(id);
    const waters = this.watersOf(base);
    if (!waters) return this.getBase(id);
    if (waters.mode === "pick") return ra(waters.names);
    return this.coin(waters, base, waters.length ?? this.placeLength(base));
  }

  // a new name off a corpus's chain, by the base's rules
  private coin(corpus: Corpus, base: NameBase, [min, max]: [number, number]): string {
    const walked = Corpora.draw(corpus.names, min, max);
    const name = SoundRules.capitalize(SoundRules.apply(walked, base.rules));
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
      const ruled = SoundRules.apply(walked, base.rules, true);
      word = ruled.replace(/[^\p{L}]/gu, "");
      if (isFit && word === ruled && word.length >= 2 && isFree(word)) break;
    }
    return word;
  }

  /** Generate a name with the base's Markov chain, with no doubled letters if `single` */
  getBase(id: string, min?: number, max?: number, single = false): string {
    const base = this.resolve(id);
    if (!Corpora.chainOf(base.places.names)[""]) {
      notify(
        sentences(t("Namesbase {{base}} is incorrect", { base: base.name }), t("Please check in namesbase editor")),
        "error"
      );
      log.error(`Namebase ${base.id} is incorrect!`);
      return "ERROR";
    }

    const [shortest, longest] = this.placeLength(base);
    const w = Corpora.draw(base.places.names, min || shortest, max || longest);

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
      const syllables = Corpora.syllables(word);
      let stem = "";
      for (const syllable of syllables.slice(0, -1)) if (stem.length < STEM_LENGTH) stem += syllable;
      if (Corpora.isSyllabic(word)) return stem || word;
      stem = Corpora.close(stem.toLowerCase(), this.resolve(id).places.names);
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
    return this.resolve((cultures.length ? ra(cultures) : pack.cultures[0]).base);
  }

  /** Whether a base stands as shipped: one the user added or changed does not */
  isShipped({ id }: NameBaseEntry): boolean {
    return this.shipped.has(id) && !this.own(id);
  }

  /** Whether a base is a shipped one the user has changed */
  isChanged({ id }: NameBaseEntry): boolean {
    return this.shipped.has(id) && Boolean(this.own(id));
  }

  /** A loaded base to change in place: of a shipped one a copy, which stands in its place */
  edit(id: string): NameBase {
    return this.own(id) ?? this.add(structuredClone(this.find(id)!));
  }

  add(base: NameBase): NameBase {
    options.map.nameBases.push(base);
    return base;
  }

  /** Add a copy of a base under a name and an id of its own */
  copy(base: NameBase, name: string): NameBase {
    const id = this.uniqueId(name, this.ids());
    return this.add({ ...structuredClone(base), id, name });
  }

  /** Put an edited base back as it ships; it stays edited where the shipped one does not load */
  async reset(id: string): Promise<void> {
    const shipped = this.shipped.get(id)!;
    await this.loadLineage(shipped);
    if (shipped.places) this.remove(id);
  }

  /** Forget the copy of a shipped base that was not changed in the end */
  dropUnchanged(id: string): void {
    const shipped = this.shipped.get(id);
    if (shipped?.places && JSON.stringify(shipped) === JSON.stringify(this.own(id))) this.remove(id);
  }

  remove(id: string): void {
    options.map.nameBases = options.map.nameBases.filter(base => base.id !== id);
  }

  ids(): string[] {
    return this.nameBases.map(({ id }) => id);
  }

  /** Swap all edited and custom bases for others; a culture whose base is gone takes the first one */
  replace(bases: NameBase[]): void {
    options.map.nameBases = bases;
    for (const culture of pack.cultures ?? []) culture.base = this.entry(culture.base).id;
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
