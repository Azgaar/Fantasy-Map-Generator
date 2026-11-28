// The name bases a map can name in: the shipped ones, loaded as they are needed, and the user's own and edited ones,
// and what each holds of its own or of the bases it extends

import { NAME_BASES, readNameBase } from "@/data/name-bases";
import type { Corpus, NameBase, NameBaseEntry, SoundRule } from "@/types/names";
import { log } from "@/utils/logger";
import { ra } from "@/utils/probability-utils";
import { NameNotation } from "./notation";
import { purposeOf, RULE_PURPOSES, SoundRules } from "./sound-rules";

const NO_RULES: readonly SoundRule[] = [];
const NO_WORDS: readonly string[] = [];

type Gender = "male" | "female";

class NameBasesCatalog {
  readonly sea = "human-generic"; // seas belong to no people: their names are said in it
  private readonly shipped = new Map(NAME_BASES.map(base => [base.id, { ...base }])); // filled as they load, never edited
  private readonly ruleSets = new WeakMap<
    NameBase,
    { lists: (readonly SoundRule[] | undefined)[]; rules: readonly SoundRule[] }
  >();

  /** All bases: the shipped ones, each as edited where it is, and the user's own */
  get all(): NameBaseEntry[] {
    const own = options.map.nameBases.filter(({ id }) => !this.shipped.has(id));
    return [...Array.from(this.shipped.keys(), id => this.entry(id)), ...own];
  }

  /** A base of the classic make: a length range, a corpus and the letters allowed to stand twice in a row */
  compose(id: string, name: string, [min, max]: [number, number], names: string[], doubled = ""): NameBase {
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
    return this.all.filter((base): base is NameBase => Boolean(base.places));
  }

  /** Bases in the order of their names, to choose from */
  sorted<T extends NameBaseEntry>(bases: T[]): T[] {
    return bases.toSorted((a, b) => a.name.localeCompare(b.name));
  }

  /** Load what bases stand for, with the bases they extend. One that fails to load stays out */
  async load(ids: Iterable<string>): Promise<void> {
    await Promise.all([...new Set(ids)].map(id => this.loadLineage(this.entry(id))));
  }

  /** Load the bases the map's cultures use, the seas' and those its burgs' names were coined in */
  async loadUsed(): Promise<void> {
    const bases = (pack.cultures ?? []).map(({ base }) => base);
    const seas = pack.features?.some(feature => feature?.type === "ocean") ? [this.sea] : [];
    const origins = (pack.burgs ?? []).flatMap(burg => burg?.meaning?.origin ?? []);
    await this.load([...bases, ...seas, ...origins]);
  }

  /** Load every base */
  async loadAll(): Promise<void> {
    await this.load(this.ids());
  }

  /** Any of the loaded bases */
  random(): NameBase {
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

  /** The words a base keeps lowercase between others, its own or inherited */
  joiningOf(base: NameBase): readonly string[] {
    return this.inherited(base, ({ joining }) => (joining?.length ? joining : undefined)) ?? NO_WORDS;
  }

  /** The rules a base names by: for each purpose its own, or those of the nearest base it extends that has some */
  rulesOf(base: NameBase): readonly SoundRule[] {
    const line = this.lineage(base);
    if (line.length === 1) return base.rules ?? NO_RULES;
    const lists = line.map(({ rules }) => rules);
    const known = this.ruleSets.get(base);
    if (known?.lists.length === lists.length && known.lists.every((list, i) => list === lists[i])) return known.rules;
    const rules = RULE_PURPOSES.flatMap(
      purpose =>
        this.inherited(base, ({ rules }) => {
          const own = rules?.filter(rule => purposeOf(rule) === purpose);
          return own?.length ? own : undefined;
        }) ?? []
    );
    this.ruleSets.set(base, { lists, rules });
    return rules;
  }

  /** The lists of personal names of a base, its own or inherited */
  peopleOf(base: NameBase): Corpus[] | undefined {
    return this.inherited(base, ({ people }) => {
      const listed = [people?.male, people?.female].filter((list): list is Corpus => Boolean(list?.names.length));
      return listed.length ? listed : undefined;
    });
  }

  /** Whether a personal name of a base is a man's or a woman's: by the list that holds it, else by the list more of
   * whose names end as it does. Nothing where the lists do not tell */
  genderOf(base: NameBase, name: string): Gender | undefined {
    const people = this.inherited(base, ({ people }) => (people?.male || people?.female ? people : undefined));
    if (!people?.male?.names.length || !people.female?.names.length) return undefined;
    const [male, female] = [endingsOf(people.male.names), endingsOf(people.female.names)];
    const word = name.toLowerCase();
    if (male.names.has(word) !== female.names.has(word)) return male.names.has(word) ? "male" : "female";
    for (const size of [3, 2]) {
      const ending = word.slice(-size);
      const [men, women] = [male, female].map(list => (list.endings.get(ending) ?? 0) / list.names.size);
      if (men !== women) return men > women ? "male" : "female";
    }
    return undefined;
  }

  /** The names of rivers and lakes of a base, its own or inherited */
  watersOf(base: NameBase): Corpus | undefined {
    return this.inherited(base, ({ waters }) => (waters?.names.length ? waters : undefined));
  }

  /** The lengths of a base's generated place names */
  placeLength(base: NameBase): [min: number, max: number] {
    return base.places.length ?? base.length;
  }

  /** The share of a base's founders that are women, where it sets one */
  femaleFounders(base: NameBase): number | undefined {
    return this.inherited(base, ({ patterns }) => patterns?.["owner-generic"]?.female);
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
    return this.all.map(({ id }) => id);
  }

  /** Swap all edited and custom bases for others; a culture whose base is gone takes the first one */
  replace(bases: NameBase[]): void {
    options.map.nameBases = bases;
    for (const culture of pack.cultures ?? []) culture.base = this.entry(culture.base).id;
  }
}

// a list of personal names, lowercase, and how many of them end in each two and three letters
const endings = new WeakMap<readonly string[], { names: Set<string>; endings: Map<string, number> }>();
function endingsOf(list: readonly string[]): { names: Set<string>; endings: Map<string, number> } {
  let known = endings.get(list);
  if (!known) {
    const names = new Set(list.map(name => name.toLowerCase()));
    const counts = new Map<string, number>();
    for (const name of names)
      for (const size of [2, 3]) counts.set(name.slice(-size), (counts.get(name.slice(-size)) ?? 0) + 1);
    known = { names, endings: counts };
    endings.set(list, known);
  }
  return known;
}

export const NameBases = new NameBasesCatalog();
