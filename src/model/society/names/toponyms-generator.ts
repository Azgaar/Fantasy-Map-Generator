// Gives burgs, lands and waters a meaning that fits their place: the "semantic" half of semantic names

import {
  type Concept,
  conceptsOf,
  fitsOf,
  isConcept,
  type Kind,
  kindOf,
  type SiteTag,
  settlementOf,
  weightOf
} from "@/data/name-concepts";
import { Goods } from "@/model/economy/goods-generator";
import type { Feature } from "@/model/physical/features-generator";
import type { River } from "@/model/physical/river-generator";
import type { Burg } from "@/model/political/burgs-generator";
import type { Province } from "@/model/political/provinces-generator";
import type { Meaning, NameBase, Pattern, Token } from "@/types/names";
import { P, pickWeighted, ra, seeded } from "@/utils/probability-utils";
import { capitalize } from "@/utils/string-utils";
import { Appropriation } from "./appropriation";
import { Lexicon } from "./lexicon";
import { Meanings } from "./meanings";
import { Names } from "./names-generator";

/** How strongly a place offers each thing a concept may ask for */
type Site = Partial<Record<SiteTag, number>> & { good?: Concept };

interface Named {
  name: string;
  meaning: Meaning;
}

/** What a site is read from: a burg, or the cell a river or a lake is named at */
type Place = Pick<Burg, "cell" | "x" | "y" | "culture" | "port" | "capital">;

/** Names no new one may repeat */
type Taken = { has(name?: string): boolean };

interface BurgOptions {
  burgs?: Burg[]; // the burgs around: the map's, or the ones a generator is still placing
  taken?: Taken;
  baseId?: string;
}

interface SampleOptions {
  pattern?: Pattern;
  concept?: Concept;
}

/** How big a land is: what it is called leans on it */
export type LandSize = "big" | "middle" | "small";

interface StateOptions {
  taken?: Taken;
  baseId?: string;
  seed?: string;
  size?: LandSize;
}

const BURG_PATTERNS: Pattern[] = ["feature", "modifier-generic", "owner-generic", "generic-of", "compound", "relative"];
const LAND_PATTERNS: Pattern[] = ["root-land", "modifier-land"];
const FOREST_BIOMES = [5, 6, 7, 8, 9];
const BIG_RIVER_FLUX = 100; // from where a river carries boats
const SETTLED = 0.85; // the share of burg names that end in what the burg is, where a base sets none
const LANDMARK = 0.3; // of those, the share named for what stands there, not for what it is like
// how well the words for big and for small things fit a land: a march may grow to an empire, though few do
const LAND_SITES: Record<LandSize, Site> = {
  big: { big: 2, small: 0.15 },
  middle: { big: 0.5, small: 0.5 },
  small: { big: 0.05, small: 1 }
};
const BIG_DESCRIBED = 0.2; // how readily a big land takes a describing word, against a smaller one: an empire is its people's
const LAND_LENGTH = 10; // the letters of a land's longest word, past which a shorter name is looked for
const LAND_REDRAWS = 3;
const FOUNDED = 0.4; // the share of lands and islands named after a person, not after a people
const WATER_SHARE = 0.5; // waters keep old names: this many of them say something
const PLAIN = 1; // how well a concept that fits anywhere fits, against one the place asks for (2 to 4)
const GOOD = 4; // how much better a concept fits where the good it names is made
const TRIES = 12;
const RENAMES = 16; // how many ways a burg's new name is drawn, to take the one nearest to the old
// the lie of the land: what a name of three parts is built around, as in Red-hill-town
const TERRAIN: Concept[] = [
  ...["field", "wood", "hill", "ford", "valley", "mount", "shore", "island", "lake", "marsh", "spring", "meadow"],
  ...["grove", "bank", "bay", "cape", "cliff", "ridge", "pass", "heath", "pool", "rock", "crag", "fell", "falls"],
  ...["glade", "glen", "hollow", "gorge", "peak", "cave", "sands", "dune", "waste", "fen", "barrow", "bend"]
] as Concept[];
// what there may be several of in one place
const COUNTABLE: Concept[] = [
  ...["hill", "mount", "peak", "rock", "tower", "bridge", "ford", "well", "spring", "pool", "lake", "mill", "tree"],
  ...["cave", "barrow", "island", "cliff", "crag", "tooth", "horn", "finger", "fork", "grove", "spire", "falls"]
] as Concept[];
const NUMBERED = 0.12; // the share of such names that count them
// what tells one of two neighbours from the other: a neighbour told apart by one of a group is told by no other of it
const OPPOSITES: Concept[][] = [
  ["north", "south", "east", "west"],
  ["upper", "lower", "middle", "high", "low"],
  ["new", "old"],
  ["little", "great"]
];
// what a place is already, so that nothing more is said of it: no Stone Rock
const REDUNDANT: Partial<Record<Concept, Concept>> = {
  rock: "stone",
  crag: "stone",
  quarry: "stone",
  sands: "sand",
  dune: "sand",
  marsh: "wet",
  fen: "wet"
};
const WATERS: Concept[] = ["river", "brook", "water", "run", "tarn", "eye"]; // what a water is, not what a burg stands by

const WORDS: Concept[] = [...conceptsOf("generic"), ...conceptsOf("modifier")];
const PLACES = new Map(WORDS.map((concept, index) => [concept, index]));
// how well each word fits a place that offers nothing, and the words that ask for each thing it may offer
const BARE = Float64Array.from(WORDS, concept => (fitsOf(concept) ? 0 : PLAIN));
const ASKING = new Map<SiteTag, number[]>();
for (const [index, concept] of WORDS.entries())
  for (const tag of fitsOf(concept) ?? []) ASKING.set(tag, [...(ASKING.get(tag) ?? []), index]);

const isBuilt = (concept: Concept) => concept !== "abbey" && !WATERS.includes(concept);
const asksFor = (tags: SiteTag[]) => (concept: Concept) =>
  isBuilt(concept) && tags.some(tag => fitsOf(concept)?.includes(tag));

// the concepts one is picked from
const POOLS = {
  landmark: ["generic", concept => !WATERS.includes(concept)],
  terrain: ["generic", concept => TERRAIN.includes(concept)],
  built: ["generic", isBuilt],
  riverside: ["generic", asksFor(["stream", "river", "mouth"])],
  shore: ["generic", asksFor(["lake", "port", "coast"])],
  modifier: ["modifier", () => true]
} satisfies Record<string, ["generic" | "modifier", (concept: Concept) => boolean]>;

type PoolName = keyof typeof POOLS;

/** The words of a base in a pool: their places among all words, and how common they are */
interface Pool {
  places: number[];
  weights: number[];
}

// what each culture type makes more of when it names a place
const LEANINGS: Record<string, SiteTag[]> = {
  Naval: ["port", "coast", "island"],
  Highland: ["hill", "mountain"],
  River: ["stream", "river", "mouth"],
  Lake: ["lake"],
  Hunting: ["forest"],
  Nomadic: ["desert", "plain"]
};

class ToponymsGenerator {
  private readonly pools = new WeakMap<Set<Concept>, Partial<Record<PoolName, Pool>>>(); // by the concepts a base writes
  private readonly fits = new WeakMap<Site, Float64Array>();

  /** Name the burgs that have no name yet, each on a random sequence of its own: one name does not move another.
   * With `only`, name just the burgs it takes */
  nameBurgs(burgs: Burg[], roll = "", only: (burg: Burg) => boolean = () => true): void {
    const taken = this.burgNames(burgs);
    for (const burg of burgs) {
      if (!burg.i || burg.name || burg.removed || !only(burg)) continue;
      Object.assign(
        burg,
        seeded(`${options.map.seed}|burg|${burg.i}|${roll}`, () => this.burg(burg, { burgs, taken }))
      );
      taken.add(burg.name);
    }
  }

  /** The name of a burg, given now if it has none: for what is named after a burg before all burgs are */
  nameOf(burg: Burg): string {
    if (!burg.name)
      Object.assign(
        burg,
        seeded(`${options.map.seed}|burg|${burg.i}|`, () => this.burg(burg))
      );
    return burg.name!;
  }

  /** A meaning that fits a burg's place and group, and its name in the culture's base or in the base given.
   * A burg with no group yet takes a name that says nothing of its size */
  burg(burg: Burg, { burgs = pack.burgs, taken = this.burgNames(burgs), baseId }: BurgOptions = {}): Named {
    const base = Names.resolve(baseId ?? pack.cultures[burg.culture!].base);
    const picked = this.pickBurg(base, taken);
    if (picked) return picked;
    const site = this.getSite(burg);
    const landmark = this.pickConcept("landmark", site, base, 3); // what the place stands out for
    const water = this.getWater(burg, site);
    const neighbor = this.getNeighbor(burg, burgs);
    const settlement = this.getSettlement(burg);
    const terrain = this.pickConcept("terrain", site, base, 2);

    const supported = (pattern: Pattern) =>
      (pattern !== "feature" || landmark) &&
      (pattern !== "generic-of" || water) &&
      (pattern !== "compound" || (settlement && terrain)) &&
      (pattern !== "relative" || neighbor);
    let patterns = BURG_PATTERNS.filter(supported);

    for (let attempt = 0; attempt < TRIES; attempt++) {
      const pattern = this.pickPattern(base, patterns);
      const settled = P(this.settledShare(base)) ? settlement : undefined; // most names end in what the burg is
      const tokens = this.fillBurg(pattern, base, site, { settled, settlement, terrain, landmark, water, neighbor });
      const named = tokens && this.accept({ pattern, tokens, origin: base.id }, base, taken);
      if (named) return named;
      if (pattern === "feature" && patterns.length > 1) patterns = without(patterns, "feature"); // its names stay the same
    }

    return proper(burg.capital ? Names.getBaseShort(base.id) : Names.getBase(base.id), base);
  }

  // a listed place not on the map yet, where the base picks its burg names; one like them when all are taken
  private pickBurg(base: NameBase, taken: Taken): Named | undefined {
    if (base.places.mode !== "pick") return undefined;
    const free = base.places.names.filter(name => !taken.has(name));
    return proper(free.length ? ra(free) : Names.getBase(base.id), base);
  }

  private fillBurg(
    pattern: Pattern,
    base: NameBase,
    site: Site,
    by: {
      settled?: Concept;
      settlement?: Concept;
      terrain?: Concept;
      landmark?: Concept;
      water?: { root: Token; pool: PoolName };
      neighbor?: { root: Token; modifier: Concept };
    }
  ): Token[] | undefined {
    const generic = () => by.settled ?? this.pickConcept("built", site, base)!;
    if (pattern === "feature") return [by.landmark!];
    if (pattern === "owner-generic") return [`~${this.founder(base)}`, generic()];
    if (pattern === "relative") return [by.neighbor!.modifier, by.neighbor!.root];
    const numbered = (counted: Concept) => COUNTABLE.includes(counted) && P(NUMBERED);
    const numeral = () => pickBy(Lexicon.spoken(base, conceptsOf("numeral")), weightOf);
    const modifier = (place: Concept) => this.pickConcept("modifier", site, base, 0, REDUNDANT[place])!;
    if (pattern === "compound") {
      const first = numbered(by.terrain!) ? numeral() : modifier(by.terrain!);
      return [first, by.terrain!, by.settlement!];
    }
    if (pattern === "modifier-generic") {
      const place = generic();
      if (!by.settled && numbered(place)) return [numeral(), place]; // Three Towers
      const named = by.settled && by.landmark && P(LANDMARK) ? by.landmark : modifier(place);
      return [named, place];
    }
    const byWater = by.settled ?? this.pickConcept(by.water!.pool, site, base);
    return byWater && [byWater, by.water!.root];
  }

  /** The name a burg would take now that its group is no longer `was`: the same meaning, ending in what the burg
   * has become, and as much of the name kept as can be. Nothing when its name says nothing of its group, or would stay as it is */
  regrouped(burg: Burg, was?: string): Named | undefined {
    const [old, now] = [this.getSettlement({ ...burg, group: was }), this.getSettlement(burg)];
    if (!burg.meaning || !old || !now || old === now || !burg.meaning.tokens.includes(old)) return undefined;
    const tokens = burg.meaning.tokens.map(token => (token === old ? now : token));
    const taken = this.burgNames(pack.burgs);
    let best: Named | undefined;
    for (let salt = 0; salt < RENAMES; salt++) {
      const meaning: Meaning = { ...burg.meaning, tokens, salt: salt || undefined };
      const { name, whole } = Meanings.compose(meaning, meaning.origin);
      if (!whole || taken.has(name)) continue; // its own name is taken too
      if (!best || shared(name, burg.name!) > shared(best.name, burg.name!)) best = { name, meaning };
    }
    return best;
  }

  // what a burg is by its group; a capital is a city whatever its group, a burg with no group yet is nothing
  private getSettlement(burg: Burg): Concept | undefined {
    if (burg.capital) return "city";
    const group = burg.group && options.map.burgs.groups.find(({ name }) => name === burg.group);
    return group ? settlementOf(group) : undefined;
  }

  /** A meaning for a state and its name in its culture's base, or in the base given: a land, never a bare name.
   * With a seed the name comes off a random sequence of its own */
  state(
    capital: Burg,
    cultureId: number,
    { taken = this.landNames(), baseId, seed, size = "small" }: StateOptions = {}
  ): Named {
    if (seed) return seeded(seed, () => this.state(capital, cultureId, { taken, baseId, size }));
    const base = Names.resolve(baseId ?? pack.cultures[cultureId].base);
    const root = () => this.getCapitalRoot(capital) ?? this.getLandRoot(base);
    const { pattern, tokens = [] } = capital.meaning ?? {};
    const water = pattern === "generic-of" ? tokens[1] : undefined;
    return this.coinLand(base, taken, this.getSite(capital), root, { size, water });
  }

  // a land around a root or a describing word, its name not yet taken and not too long where a shorter one is found
  private coinLand(
    base: NameBase,
    taken: Taken,
    site: Site,
    root: () => Token,
    { size, water, land }: { size: LandSize; water?: Token; land?: Concept }
  ): Named {
    const landSite = { ...site, ...LAND_SITES[size] };
    const weigh = (pattern: Pattern) =>
      Lexicon.patternWeight(base, pattern) * (pattern === "modifier-land" && size === "big" ? BIG_DESCRIBED : 1);
    let shortest: Named | undefined;
    for (let attempt = 0; ; attempt++) {
      const pattern = pickBy(LAND_PATTERNS, weigh);
      const first = pattern === "root-land" ? root() : this.pickConcept("modifier", landSite, base)!;
      const meaning: Meaning = { pattern, tokens: [first, land ?? this.pickLand(base, landSite)], origin: base.id };
      const named = this.accept(meaning, base, taken, 3);
      if (named && !isLongLand(named.name)) return named;
      // a water's name is a land's as it is, as Congo; a person's or a people's is not
      const bare =
        named && first === water && this.accept({ ...meaning, pattern: "simplex", tokens: [first] }, base, taken);
      if (bare) return bare;
      if (named && (!shortest || named.name.length < shortest.name.length)) shortest = named;
      if (shortest && attempt >= LAND_REDRAWS) return shortest;
      if (named) continue;
      const name = Meanings.render(meaning, base.id); // no name fits the base's length: one cut short will do
      if ((attempt >= TRIES && !taken.has(name)) || attempt >= TRIES * 4) return { name, meaning };
    }
  }

  // what a land is called: a word the base ends a name with, so that no state is the Kingdom of a Realm
  private pickLand(base: NameBase, site: Site): Concept {
    const lands = conceptsOf("land").filter(concept => Lexicon.authoredForms(base, concept)); // a fallback form would name a town
    const joined = lands.filter(land => Lexicon.authoredForms(base, land)!.some(({ position }) => position !== "word"));
    return pickBy(joined.length ? joined : lands, land => {
      const fit = Math.max(...(fitsOf(land)?.map(tag => site[tag] ?? 0) ?? [PLAIN]));
      return fit * commonness(land);
    });
  }

  /** The name a named thing would take in a culture's base, when that is another name than it has.
   * A name with no meaning is carried over as a proper name coined in the base given */
  nameIn(named: { name?: string; meaning?: Meaning }, cultureId: number, origin: string): string | undefined {
    const base = pack.cultures[cultureId]?.base;
    if (!base || !named.name) return undefined;
    const name = Meanings.render(named.meaning ?? Meanings.simplex(named.name, origin), base);
    return name === named.name ? undefined : name;
  }

  /** A land's name, such as a province's named after no burg, in a culture's base or the base given */
  land(cultureOrBase: number | string, size?: LandSize): string {
    return this.landOf(cultureOrBase, undefined, size).name;
  }

  /** A land's meaning and its name, which repeats none of those taken and no burg's */
  landOf(cultureOrBase: number | string, taken = this.landNames(), size: LandSize = "small"): Named {
    const baseId = typeof cultureOrBase === "number" ? pack.cultures[cultureOrBase].base : cultureOrBase;
    const base = Names.resolve(baseId);
    const has = (name?: string) => taken.has(name) || pack.burgs.some(burg => burg.name === name && !burg.removed);
    return this.coinLand(base, { has }, {}, () => this.getLandRoot(base), { size });
  }

  /** The names of the lands there are, states and provinces */
  landNames(provinces: Province[] = pack.provinces): Set<string | undefined> {
    return new Set([...this.stateNames(), ...provinces.filter(p => p.i && !p.removed).map(({ name }) => name)]);
  }

  /** A colony's meaning after the land it was settled from, as in New Oswinfall, and its name in a culture's base.
   * Nothing when the name is too long to keep "new" */
  colonyOf(root: string, cultureId: number): Named | undefined {
    const baseId = pack.cultures[cultureId].base;
    const meaning: Meaning = { pattern: "relative", tokens: ["new", `~${root}`], origin: baseId };
    const { name, whole } = Meanings.compose(meaning, baseId);
    return whole ? { name, meaning } : undefined;
  }

  /** Name the rivers that are not locked, each on a random sequence of its own */
  nameRivers(rivers: River[]): void {
    const taken = new Set<string | undefined>(rivers.filter(river => river.lock).map(river => river.name));
    for (const river of rivers) {
      if (river.lock) continue;
      Object.assign(
        river,
        seeded(`${options.map.seed}|river|${river.i}`, () => this.river(river, { taken }))
      );
      taken.add(river.name);
    }
  }

  /** A meaning for a river and its name in the base of the culture at its mouth, or in the base given:
   * a proper name, or what its water looks like */
  river(river: River, { taken = new Set(pack.rivers.map(({ name }) => name)), baseId }: StateOptions = {}): Named {
    const course = river.cells.filter(cell => cell >= 0);
    const cell = course[Math.floor(course.length / 2)] ?? river.mouth;
    const { base, site } = this.getGround(cell, baseId, river.mouth);
    const isSmall = river.type !== "River"; // a brook, a creek or a fork
    site[isSmall ? "small" : "big"] = 2;
    const waters = Lexicon.spoken(
      base,
      isSmall ? ["brook", "brook", "water", "run"] : ["river", "river", "water", "run"]
    );

    const named = this.coin(base, taken, () => {
      const pattern = this.pickPattern(base, ["simplex", "modifier-generic"], WATER_SHARE);
      if (pattern === "simplex") return [pattern, [`~${Names.getWater(base.id)}`]];
      return [pattern, [this.pickConcept("modifier", site, base)!, ra(waters)]];
    });
    return named ?? proper(Names.getWater(base.id), base);
  }

  /** A meaning for a lake and its name in the base of the culture on its shore, or in the base given */
  lake(lake: Feature, { taken = this.featureNames(), baseId }: StateOptions = {}): Named {
    const { base, site } = this.getGround(lake.shoreline?.[0] || lake.firstCell, baseId);
    const waters = Lexicon.spoken(
      base,
      lake.cells < 4 ? ["pool", "pool", "tarn", "lake", "eye"] : ["lake", "lake", "lake", "water", "eye"]
    );

    const named = this.coin(base, taken, () => {
      const pattern = this.pickPattern(base, ["simplex", "modifier-generic", "owner-generic"], WATER_SHARE);
      const first: Token =
        pattern === "owner-generic" ? `~${this.founder(base)}` : this.pickConcept("modifier", site, base)!;
      return [pattern, pattern === "simplex" ? [`~${Names.getWater(base.id)}`] : [first, ra(waters)]];
    });
    return named ?? proper(Names.getWater(base.id), base);
  }

  /** A meaning for an island and its name in the base of the culture on its first cell: an island of some kind or
   * of someone's. A continent is named as a land */
  island(island: Feature, { taken = this.featureNames(), baseId }: StateOptions = {}): Named {
    const { base, site } = this.getGround(island.firstCell, baseId);
    const root = () => this.getLandRoot(base);
    if (island.subtype === "continent") return this.coinLand(base, taken, site, root, { size: "middle", land: "land" });

    const named = this.coin(base, taken, () => {
      const pattern = this.pickPattern(base, ["modifier-generic", "owner-generic"]);
      return [pattern, [pattern === "owner-generic" ? root() : this.pickConcept("modifier", site, base)!, "island"]];
    });
    return named ?? this.coinLand(base, taken, site, root, { size: "small" });
  }

  // a person a place is named after: a woman as often as the base's owner-generic pattern says
  private founder(base: NameBase): string {
    return Names.getPerson(base.id, Lexicon.femaleFounders(base));
  }

  /** What a cell offers a name, and the base to say it in: the one given, or that of the culture at a cell */
  private getGround(cell: number, baseId?: string, namedAt = cell): { base: NameBase; site: Site } {
    const culture = pack.cells.culture[namedAt] ?? 0;
    const [x, y] = pack.cells.p[cell];
    const base = Names.resolve(baseId ?? pack.cultures[culture]?.base);
    return { base, site: this.getSite({ cell, x, y, culture }) };
  }

  /** The first of the meanings drawn whose name may be taken */
  private coin(base: NameBase, taken: Taken, draw: () => [Pattern, Token[]]): Named | undefined {
    for (let attempt = 0; attempt < TRIES; attempt++) {
      const [pattern, tokens] = draw();
      const min = pattern === "simplex" ? 0 : undefined; // a water's own name is never too short: Exe, Oka
      const named = this.accept({ pattern, tokens, origin: base.id }, base, taken, min);
      if (named) return named;
    }
    return undefined;
  }

  private featureNames(): Set<string | undefined> {
    return new Set([...pack.features.map(feature => feature?.name), ...pack.rivers.map(({ name }) => name)]);
  }

  // one time in five a state is named after the person or the river its capital is named after
  private getCapitalRoot({ meaning }: Burg): Token | undefined {
    if (meaning?.pattern !== "owner-generic" && meaning?.pattern !== "generic-of") return undefined;
    return P(0.2) ? meaning.tokens.find(token => token.startsWith("~")) : undefined;
  }

  // who a land or an island is named after: a person, or a people
  private getLandRoot(base: NameBase): Token {
    if (P(FOUNDED)) return `~${this.founder(base)}`;
    for (let attempt = 0; ; attempt++) {
      const stem = Names.getStem(base.id);
      if (attempt >= TRIES || !Lexicon.isPlaceWord(stem.toLowerCase(), base)) return `~${stem}`; // no Land of Town
    }
  }

  /** Render a meaning and take the name when it is free, long enough and no longer than the base allows */
  private accept(meaning: Meaning, base: NameBase, taken: Taken, min = base.length[0]): Named | undefined {
    // a name taken is drawn again with other forms of the same meaning
    for (const salt of [0, 1, 2]) {
      const salted = salt ? { ...meaning, salt } : meaning;
      const { name, whole } = Meanings.compose(salted, base.id);
      if (whole && name.length >= min && !taken.has(name)) return { name, meaning: salted };
    }
    return undefined;
  }

  private stateNames(): Set<string | undefined> {
    return new Set(pack.states.filter(state => !state.removed).map(state => state.name));
  }

  private burgNames(burgs: Burg[]): Set<string | undefined> {
    return new Set(burgs.filter(burg => !burg.removed).map(burg => burg.name));
  }

  /** The river or lake a burg stands by, as a root for its name, with the pool of what stands by it */
  private getWater(burg: Burg, site: Site): { root: Token; pool: PoolName } | undefined {
    const { cells, rivers, features } = pack;
    const river = site.stream || site.river ? rivers.find(river => river.i === cells.r[burg.cell]) : undefined;
    if (river?.name && !/[ -]/.test(river.name))
      return { root: this.borrow(river.name, river.mouth, burg), pool: "riverside" };
    const lake = site.lake ? features[cells.f[cells.haven[burg.cell]]] : undefined;
    if (!lake?.name || /[ -]/.test(lake.name)) return undefined; // a name of two words is no root
    return { root: this.borrow(lake.name, lake.shoreline?.[0] ?? lake.firstCell, burg), pool: "shore" };
  }

  /** A name as a root for a burg's own: one the culture at a cell gave is adapted to the burg's base */
  private borrow(name: string, namedAt: number, burg: Burg): Token {
    const [theirs, own] = [pack.cultures[pack.cells.culture[namedAt]]?.base, pack.cultures[burg.culture!].base];
    const base = Names.resolve(own);
    return theirs === own ? `~${name}` : `~${capitalize(Appropriation.adapt(name.toLowerCase(), base))}`;
  }

  /** The nearest named burg of the same culture close by, and how this burg stands to it */
  private getNeighbor(burg: Burg, burgs: Burg[]): { root: Token; modifier: Concept } | undefined {
    const reach = (options.map.graph.width + options.map.graph.height) / 40;
    let nearest: Burg | undefined;
    let distance = reach;
    for (const other of burgs) {
      if (Math.abs(other.x - burg.x) >= distance || Math.abs(other.y - burg.y) >= distance) continue;
      if (!other.i || other === burg || other.removed || !other.name || other.culture !== burg.culture) continue;
      if (other.meaning?.pattern === "relative") continue; // no New New Barton
      const apart = Math.hypot(other.x - burg.x, other.y - burg.y);
      if (apart < distance) [nearest, distance] = [other, apart];
    }
    if (!nearest || nearest.name!.includes(" ")) return undefined;

    const [dx, dy] = [burg.x - nearest.x, burg.y - nearest.y];
    const [climb, heights] = [pack.cells.h[burg.cell] - pack.cells.h[nearest.cell], pack.cells.h];
    const direction: Concept = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "east" : "west") : dy > 0 ? "south" : "north";
    const overseas = burg.feature !== nearest.feature;
    const level: Concept | undefined =
      Math.abs(climb) >= 8 ? (heights[burg.cell] > heights[nearest.cell] ? "upper" : "lower") : undefined;
    const modifier = overseas ? "new" : ra<Concept>([direction, direction, level ?? "new", "little"]);
    const akin = OPPOSITES.find(group => group.includes(modifier))!;
    if (nearest.meaning?.tokens.some(token => (akin as Token[]).includes(token))) return undefined; // no Little Littlestead or West Southby
    return { root: `~${nearest.name}`, modifier };
  }

  /** What a burg's place offers a name: water, relief, biome, deposits, size and the culture's leanings */
  private getSite(burg: Place): Site {
    const { cells, features, cultures } = pack;
    const cell = burg.cell;
    const site: Site = {};

    const coastal = cells.t[cell] === 1;
    const shore = coastal ? features[cells.f[cells.haven[cell]]] : undefined;
    if (burg.port && coastal) site.port = 3;
    if (shore?.type === "ocean") site.coast = 2;
    if (shore?.type === "lake") site.lake = 3;
    const landmass = features[cells.f[cell]]?.subtype;
    if (landmass === "isle" || landmass === "lake_island") site.island = 3;
    else if (landmass === "island") site.island = 2;

    if (cells.r[cell]) {
      if (cells.fl[cell] >= BIG_RIVER_FLUX) site.river = 3;
      else site.stream = 3;
      const isMouth = coastal && pack.rivers.some(river => river.i === cells.r[cell] && river.mouth === cell);
      if (isMouth || cells.conf[cell]) site.mouth = 4;
    }

    const [height, biome] = [cells.h[cell], cells.biome[cell]];
    if (height >= 62) site.mountain = 3;
    else if (height >= 45) site.hill = 3;
    else if (height >= 35) site.hill = 2;
    else if (biome === 3 || biome === 4) site.plain = 2;
    else if (FOREST_BIOMES.includes(biome)) site.plain = 1; // the fields cleared around a burg
    if (FOREST_BIOMES.includes(biome)) site.forest = 2;
    if (biome === 12) site.marsh = 3;
    if (biome === 1 || biome === 2) site.desert = 3;
    if (biome >= 9 && biome <= 11) site.cold = 2;
    if (biome === 1 || biome === 3 || biome === 5 || biome === 7) site.hot = 1;

    const good = [cell, ...cells.c[cell]].map(near => Goods.get(cells.good?.[near])).find(Boolean);
    if (good?.tags.some(tag => tag === "ore" || tag === "metal" || tag === "mineral")) site.ore = 3;
    const goodName = good?.name.toLowerCase() ?? "";
    site.good = [goodName, goodName.replace(/s$/, "")].find(isConcept);

    if (burg.capital) site.capital = site.big = 2;
    const score = cells.s[cell] / this.getMaxScore();
    if (score > 0.6) site.big = 2;
    else if (score < 0.3 && !burg.capital) site.small = 2;

    const { width, height: mapHeight } = options.map.graph;
    if (burg.y < mapHeight / 3) site.north = 2;
    else if (burg.y > (mapHeight * 2) / 3) site.south = 2;
    if (burg.x < width / 3) site.west = 2;
    else if (burg.x > (width * 2) / 3) site.east = 2;

    const type = cultures[burg.culture!]?.type;
    if (type === "Nomadic") site.nomadic = 2;
    for (const tag of LEANINGS[type] ?? []) if (site[tag]) site[tag] *= 1.5;
    return site;
  }

  private maxScores = new WeakMap<object, number>(); // by the cells' score array, so a new map measures anew

  private getMaxScore(): number {
    const scores = pack.cells.s;
    let max = this.maxScores.get(scores) ?? 0;
    if (!max) {
      for (const score of scores) if (score > max) max = score;
      this.maxScores.set(scores, max || 1);
    }
    return max || 1;
  }

  /** Draw a pattern by the base's weights; with a share, proper names take what the share leaves */
  private pickPattern(base: NameBase, patterns: Pattern[], share?: number): Pattern {
    if (share !== undefined) return P(share) ? this.pickPattern(base, without(patterns, "simplex")) : "simplex";
    return pickBy(patterns, pattern => Lexicon.patternWeight(base, pattern));
  }

  /** The share of a base's burg names that end in what the burg is by its group */
  settledShare(base: NameBase): number {
    return Names.inherited(base, ({ settled }) => settled) ?? SETTLED;
  }

  /** A meaning no place stands behind and its name: what a base makes of names, for its editor to show. A pattern or
   * a concept to say may be asked for */
  sample(base: NameBase, { pattern, concept }: SampleOptions = {}): Named {
    const picked = pattern || concept ? undefined : this.pickBurg(base, new Set());
    if (picked) return picked;
    const kind = concept && kindOf(concept);
    const patterns: Pattern[] = ["feature", "modifier-generic", "owner-generic"];
    const layout =
      pattern ?? (kind ? (kind === "land" ? "modifier-land" : "modifier-generic") : this.pickPattern(base, patterns));

    const any = (of: Kind, from = conceptsOf(of)) => {
      const spoken = Lexicon.spoken(base, from);
      return of === "settlement" ? ra(spoken) : pickBy(spoken, commonness);
    };
    const modifier = () => (concept && (kind === "modifier" || kind === "numeral") ? concept : any("modifier"));
    const place = () => (kind === "numeral" ? any("generic", COUNTABLE) : any("generic"));
    const generic = () => {
      if (concept && (kind === "settlement" || kind === "generic")) return concept;
      return kind !== "numeral" && P(this.settledShare(base)) ? any("settlement") : place();
    };
    const land = () => (concept && kind === "land" ? concept : any("land"));

    const fill: Record<Pattern, () => Token[]> = {
      simplex: () => [`~${Names.getWater(base.id)}`],
      feature: () => [place()],
      "modifier-generic": () => [modifier(), generic()],
      "owner-generic": () => [`~${this.founder(base)}`, generic()],
      "generic-of": () => [generic(), `~${Names.getWater(base.id)}`],
      compound: () => [modifier(), any("generic", TERRAIN), any("settlement")],
      relative: () => [modifier(), `~${Names.getBase(base.id)}`],
      "root-land": () => [this.getLandRoot(base), land()],
      "modifier-land": () => [modifier(), land()]
    };
    const meaning: Meaning = { pattern: layout, tokens: fill[layout](), origin: base.id };
    return { name: Meanings.render(meaning, base.id), meaning };
  }

  /** A land's name and meaning, as `sample` */
  sampleLand(base: NameBase): Named {
    return this.sample(base, { pattern: this.pickPattern(base, LAND_PATTERNS) });
  }

  /** A concept as likely as it fits the site, times how common it is; none when the site offers none so much */
  private pickConcept(pool: PoolName, site: Site, base: NameBase, min = 0, except?: Concept): Concept | undefined {
    const { places, weights } = this.poolOf(pool, base);
    const fits = this.fitsOf(site);
    const barred = except ? PLACES.get(except) : undefined;
    let total = 0;
    for (let i = 0; i < places.length; i++) {
      const fit = fits[places[i]];
      const weight = fit < min || places[i] === barred ? 0 : fit * weights[i];
      total += weight;
      drawn[i] = weight;
    }
    if (!total) return undefined;

    let roll = Math.random() * total;
    let picked = 0;
    for (let i = 0; i < places.length; i++) {
      if (!drawn[i]) continue;
      picked = places[i];
      roll -= drawn[i];
      if (roll < 0) break;
    }
    return WORDS[picked];
  }

  // a pool holds while the vocabulary it is of stands
  private poolOf(name: PoolName, base: NameBase): Pool {
    const written = Lexicon.writtenConcepts(base);
    let pools = this.pools.get(written);
    if (!pools) {
      pools = {};
      this.pools.set(written, pools);
    }
    if (!pools[name]) {
      const [kind, takes] = POOLS[name];
      const concepts = Lexicon.spoken(base, conceptsOf(kind)).filter(takes);
      pools[name] = { places: concepts.map(concept => PLACES.get(concept)!), weights: concepts.map(commonness) };
    }
    return pools[name];
  }

  // how well each word fits a site
  private fitsOf(site: Site): Float64Array {
    let fits = this.fits.get(site);
    if (!fits) {
      const { good, ...offers } = site;
      fits = BARE.slice();
      for (const [tag, offer] of Object.entries(offers) as [SiteTag, number][])
        for (const index of ASKING.get(tag) ?? []) if (offer > fits[index]) fits[index] = offer;
      const made = good && PLACES.get(good);
      if (made !== undefined) fits[made] += GOOD;
      this.fits.set(site, fits);
    }
    return fits;
  }
}

const drawn = new Float64Array(WORDS.length); // the weights of the pool being picked from

const isLongLand = (name: string) =>
  name.length > LAND_LENGTH * 1.5 || name.split(/[ -]/).some(word => word.length > LAND_LENGTH);

// how many letters two names share at their start and at their end
const shared = (name: string, other: string) => {
  let [start, end] = [0, 0];
  while (start < name.length && name[start] === other[start]) start++;
  while (end < name.length - start && name.at(-1 - end) === other.at(-1 - end)) end++;
  return start + end;
};

const pickBy = <T>(items: T[], weigh: (item: T) => number): T => pickWeighted(items, items.map(weigh));

// commonness counts squared: real names repeat a few words and leave the rest rare
function commonness(concept: Concept): number {
  return weightOf(concept) ** 2;
}

/** A name that says nothing but itself */
const proper = (name: string, base: NameBase): Named => ({ name, meaning: Meanings.simplex(name, base.id) });

const without = <T>(items: T[], item: T) => items.filter(other => other !== item);

export const Toponyms = new ToponymsGenerator();
