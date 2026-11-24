import { z } from "zod";
import { NAME_BASES, readNameBase } from "@/data/name-bases";
import type { Corpus, NameBase, NameBaseEntry } from "@/types/names";
import { last } from "@/utils/array-utils";
import { sentences, t } from "@/utils/i18n";
import { isVowel } from "@/utils/language-utils";
import { log } from "@/utils/logger";
import { notify } from "@/utils/notices";
import { P, ra } from "@/utils/probability-utils";
import { capitalize, safeParseJSON } from "@/utils/string-utils";
import { NameNotation } from "./notation";
import { SoundRules } from "./sound-rules";

// Markov chain lookup table: key is a letter (or empty string for word start), value is array of possible next syllables
// Note: Uses array with string keys (sparse array) to match original JS behavior
type MarkovChain = string[][] & Record<string, string[]>;

const SYLLABIC = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

const STEM_LENGTH = 4; // a stem is cut once it is this long

const formantSchema = z.object({
  form: z.string().min(1),
  weight: z.number().int().min(0).optional(),
  position: z.enum(["first", "last", "word", "stem"]).optional(),
  short: z.string().optional(),
  class: z.string().optional()
});

const rewritesSchema = z.array(z.object({ match: z.string(), replace: z.string() })).optional();

const corpusSchema = z.object({
  names: z.array(z.string()),
  mode: z.enum(["chain", "pick"]).optional(),
  length: z.tuple([z.number(), z.number()]).optional()
});

/** A base as a namesbase file holds it */
const NAME_BASE_SCHEMA = z.object({
  id: z.string().regex(/^[\p{L}\p{N}-]+$/u),
  name: z.string().min(1),
  length: z.tuple([z.number(), z.number()]),
  extends: z.string().optional(),
  places: corpusSchema,
  waters: corpusSchema.optional(),
  people: z.object({ male: corpusSchema.optional(), female: corpusSchema.optional() }).optional(),
  rules: z
    .array(
      z.object({
        match: z.string(),
        replace: z.string(),
        at: z.literal("join").optional(),
        when: z.enum(["long", "foreign"]).optional(),
        chance: z.number().min(0).max(1).optional(),
        as: z.string().optional()
      })
    )
    .optional(),
  grammar: z
    .object({
      classes: z.record(z.string(), z.string()).optional(),
      endings: z.record(z.string(), z.record(z.string(), z.string())).optional(),
      derive: z.object({ stem: rewritesSchema, first: rewritesSchema }).optional()
    })
    .optional(),
  settled: z.number().min(0).max(1).optional(),
  lexicon: z.record(z.string(), z.array(formantSchema)).optional(),
  patterns: z
    .record(
      z.string(),
      z.object({
        weight: z.number().int().min(0).optional(),
        female: z.number().min(0).max(1).optional(),
        templates: z.array(z.object({ parts: z.string(), weight: z.number().int().min(0).optional() })).optional()
      })
    )
    .optional()
});

class NamesGenerator {
  readonly schema = NAME_BASE_SCHEMA;
  private readonly shipped = new Map<string, NameBase>(); // the shipped bases loaded so far
  nameBases: NameBaseEntry[] = this.getNameBases();
  private readonly chains = new Map<string, MarkovChain | null>(); // Markov chains by base id
  private readonly corpusChains = new WeakMap<string[], MarkovChain>(); // of people and waters, by corpus: an edited one is chained anew

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
    const chain: MarkovChain = [] as unknown as MarkovChain;

    for (const name of names) {
      let prev = ""; // the letter a syllable follows; a word ends in an empty syllable
      for (const syllable of [...this.syllables(name), ""]) {
        if (!chain[prev]) chain[prev] = [];
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

        if (isVowel(that) === (next as unknown as boolean)) break; // two same vowels in a row (original quirky behavior)
        if (v && isVowel(name[c + 2])) break; // syllable has vowel and additional vowel is expected soon
      }

      syllables.push(syllable);
    }

    return syllables;
  }

  updateChain(id: string): MarkovChain | null {
    const names = this.find(id)?.places.names;
    const chain = names?.length ? this.calculateChain(names) : null;
    this.chains.set(id, chain);
    return chain;
  }

  clearChains(): void {
    this.chains.clear();
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
    return base?.places ? base : this.loaded()[0];
  }

  /** The map's bases loaded so far: at least those its cultures use, all of them after `loadAll` */
  loaded(): NameBase[] {
    return this.nameBases.filter((base): base is NameBase => Boolean(base.places));
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
    await this.load(this.nameBases.map(({ id }) => id));
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
        if (!base.places) Object.assign(base, structuredClone(shipped)); // it may have loaded meanwhile
      } catch (error) {
        log.error(`Name base ${id} failed to load`, error);
      }
      const parent = base.places && base.extends;
      base = this.nameBases.find(({ id }) => id === parent);
    }
  }

  private async read(id: string): Promise<NameBase> {
    const base = this.shipped.get(id) ?? NameNotation.read(await readNameBase(id));
    this.shipped.set(id, base);
    return base;
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

  /** A personal name of a base: a new one off the chain of its people corpus, or one of the corpus as it is.
   * The base sets which, unless the options do. A base with no people names a person like a place, only shorter.
   * Women are named as often as `female` says, 0 to 1, or by the sizes of the two lists */
  getPerson(id: string, female?: number): string {
    const base = this.resolve(id);
    const people =
      base &&
      this.lineage(base).find(({ people }) => people?.male?.names.length || people?.female?.names.length)?.people;
    if (!people) return this.getBase(id, 3, 6, "");

    const corpora = [people.male, people.female].filter((corpus): corpus is Corpus => Boolean(corpus?.names.length));
    const total = corpora.reduce((sum, { names }) => sum + names.length, 0);
    const men = female === undefined ? corpora[0].names.length / total : 1 - female;
    const corpus = corpora[1] && Math.random() >= men ? corpora[1] : corpora[0];

    const { proper } = options.generation.names;
    if ((proper === "base" ? (corpus.mode ?? "chain") : proper) === "pick") return ra(corpus.names);
    return this.coin(corpus, base, corpus.length ?? [4, 8]);
  }

  /** A proper name of a river or a lake: off the chain of the base's waters or one of them as it is, as the list
   * says; a place name where the base lists none */
  getWater(id: string): string {
    const base = this.resolve(id);
    const waters = base && this.lineage(base).find(({ waters }) => waters?.names.length)?.waters;
    if (!waters) return this.getBase(id);
    if (waters.mode === "pick") return ra(waters.names);
    return this.coin(waters, base, waters.length ?? base.places.length ?? base.length);
  }

  // a new name off a corpus's chain, by the base's rules
  private coin(corpus: Corpus, base: NameBase, [min, max]: [number, number]): string {
    if (!this.corpusChains.has(corpus.names)) this.corpusChains.set(corpus.names, this.calculateChain(corpus.names));
    const walked = this.walk(this.corpusChains.get(corpus.names)!, min, max);
    const name = SoundRules.capitalize(SoundRules.apply(walked, base.rules));
    return name.length < 2 ? ra(corpus.names) : name;
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
          cur = "";
          w = "";
          v = chain[""];
        } else break;
      } else {
        if (w.length + cur.length > max) {
          // word too long
          if (w.length < min) w += cur;
          break;
        } else v = chain[last(cur.split("")) as string] || chain[""];
      }

      w += cur;
      cur = ra(v);
    }

    return /['\- ]$/.test(w) ? w.slice(0, -1) : w; // a name ends in a letter
  }

  /** Generate a name with the base's Markov chain; an empty `dupl` allows no doubled letters */
  getBase(id: string, min?: number, max?: number, dupl?: string): string {
    if (id === undefined) {
      log.error("Please define a base");
      return "ERROR";
    }

    const base = this.resolve(id);
    if (!base) {
      log.error(`Namebase ${id} is not found`);
      return "ERROR";
    }

    const data = this.chains.get(base.id) ?? this.updateChain(base.id);
    if (!data || data[""] === undefined) {
      notify(
        sentences(t("Namesbase {{base}} is incorrect", { base: base.name }), t("Please check in namesbase editor")),
        "error"
      );
      log.error(`Namebase ${base.id} is incorrect!`);
      return "ERROR";
    }

    const [shortest, longest] = base.places.length ?? base.length;
    const w = this.walk(data, min || shortest, max || longest);

    const rules = dupl === "" ? [SoundRules.doublesRule(), ...(base.rules ?? [])] : base.rules;
    let name = SoundRules.capitalize(SoundRules.apply(w, rules));

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
  getCulture(culture: number, min?: number, max?: number, dupl?: string): string {
    if (culture === undefined) {
      log.error("Please define a culture");
      return "ERROR";
    }
    const base = pack.cultures[culture].base;
    return this.getBase(base, min, max, dupl);
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
    const base = this.resolve(id);
    const [shortest, longest] = base?.places.length ?? base?.length ?? [];
    const min = shortest ? shortest - 1 : undefined;
    const max = longest && min ? Math.max(longest - 2, min) : undefined;
    return this.getBase(id, min, max, "");
  }

  /** The start of a place name, without the ending that makes it a town: what a people is called */
  getStem(id: string): string {
    for (let attempt = 0; ; attempt++) {
      const name = this.getBaseShort(id);
      const [word] = name.split(/[^\p{L}]+/u).sort((a, b) => b.length - a.length);
      const syllables = this.syllables(word);
      let stem = "";
      for (const syllable of syllables.slice(0, -1)) if (stem.length < STEM_LENGTH) stem += syllable;
      if (SYLLABIC.test(word) || stem.replace(/[aeiouy]+$/, "").length > 2 || attempt > 8)
        return capitalize(stem || word);
    }
  }

  private validateSuffix(name: string, suffix: string): string {
    if (name.slice(-1 * suffix.length) === suffix) return name; // no suffix if name already ends with it
    const s1 = suffix.charAt(0);
    if (name.slice(-1) === s1) name = name.slice(0, -1); // remove name last letter if it's a suffix first letter
    if (isVowel(s1) === isVowel(name.slice(-1)) && isVowel(s1) === isVowel(name.slice(-2, -1)))
      name = name.slice(0, -1); // remove name last char if 2 last chars are the same type as suffix's 1st
    if (name.slice(-1) === s1) name = name.slice(0, -1); // remove name last letter if it's a suffix first letter
    return name + suffix;
  }

  private addSuffix(name: string): string {
    const suffix = P(0.8) ? "ia" : "land";
    if (suffix === "ia" && name.length > 6) name = name.slice(0, -(name.length - 3));
    else if (suffix === "land" && name.length > 6) name = name.slice(0, -(name.length - 5));
    return this.validateSuffix(name, suffix);
  }

  /** A name for the map, in a base its cultures use */
  getMapName(): string {
    const base = this.mapBase();
    const [shortest, longest] = base.places.length ?? base.length;
    const min = shortest - 1;
    const max = Math.max(longest - 3, min);
    const baseName = this.getBase(base.id, min, max, "");
    const name = P(0.7) ? this.addSuffix(baseName) : baseName;
    return name;
  }

  // the base of any of the map's cultures, the Wildlands where it has no other
  private mapBase(): NameBase {
    const cultures = pack.cultures.filter(culture => culture.i && !culture.removed);
    return this.resolve((cultures.length ? ra(cultures) : pack.cultures[0]).base);
  }

  /** A fresh list of the shipped bases, in full where loaded */
  getNameBases(): NameBaseEntry[] {
    return NAME_BASES.map(base => structuredClone(this.shipped.get(base.id) ?? base));
  }

  /** The bases as a .map record: a shipped base left as it is goes by its id alone, so it follows later updates */
  serialize(): string {
    const isShipped = (base: NameBaseEntry) =>
      !base.places || JSON.stringify(base) === JSON.stringify(this.shipped.get(base.id));
    return JSON.stringify(this.nameBases.map(base => (isShipped(base) ? { id: base.id } : base)));
  }

  /** Take the bases of a .map record, or the shipped ones when it holds none or is of an older make */
  restore(record?: string): void {
    const shipped = this.getNameBases();
    const stored: (NameBase | { id: string })[] | null = safeParseJSON(record ?? "");
    const byId = (id: string) => shipped.find(base => base.id === id) ?? [];
    this.nameBases = stored ? stored.flatMap(base => ("places" in base ? base : byId(base.id))) : shipped;
    this.clearChains();
  }

  /** Swap the whole set; a culture goes on with the base standing where its own stood */
  replace(bases: NameBaseEntry[]): void {
    const places = new Map(this.nameBases.map(({ id }, index) => [id, index]));
    for (const culture of pack.cultures ?? []) culture.base = bases[places.get(culture.base) ?? -1]?.id ?? culture.base;
    this.nameBases = bases;
    this.clearChains();
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
