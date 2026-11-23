// Gives burgs and states a meaning that fits their place: the "semantic" half of semantic names

import {
  type Concept,
  conceptsOf,
  fitsOf,
  isConcept,
  type SiteTag,
  settlementOf,
  weightOf
} from "@/data/name-concepts";
import { Goods } from "@/model/economy/goods-generator";
import type { Feature } from "@/model/physical/features-generator";
import type { River } from "@/model/physical/river-generator";
import type { Burg } from "@/model/political/burgs-generator";
import type { Meaning, NameBase, Pattern, Token } from "@/types/names";
import { P, ra, seeded } from "@/utils/probability-utils";
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

interface BurgOptions {
  burgs?: Burg[]; // the burgs around: the map's, or the ones a generator is still placing
  taken?: Set<string | undefined>; // names no new one may repeat
  baseId?: string;
}

interface StateOptions {
  taken?: Set<string | undefined>;
  baseId?: string;
  seed?: string;
}

const BURG_PATTERNS: Pattern[] = ["feature", "modifier-generic", "owner-generic", "generic-of", "compound", "relative"];
const STATE_PATTERNS: Pattern[] = ["simplex", "root-land", "modifier-land"];
const WATER_TAGS: SiteTag[] = ["stream", "river", "mouth"];
const SHORE_TAGS: SiteTag[] = ["lake", "port", "coast"];
const FOREST_BIOMES = [5, 6, 7, 8, 9];
const BIG_RIVER_FLUX = 100; // from where a river carries boats
const SETTLED = 0.85; // the share of burg names that end in what the burg is, where a base sets none
const LANDMARK = 0.3; // of those, the share named for what stands there, not for what it is like
const WATER_SHARE = 0.5; // waters keep old names: this many of them say something
const PLAIN = 1; // how well a concept that fits anywhere fits, against one the place asks for (2 to 4)
const TRIES = 12;
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
const WATERS: Concept[] = ["river", "brook", "water", "run", "tarn", "eye"]; // what a water is, not what a burg stands by
const isBuilt = (fit: number, _: unknown, concept: Concept) =>
  fit > 0 && concept !== "abbey" && !WATERS.includes(concept);

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
    const base = Names.resolve(baseId ?? pack.cultures[burg.culture!].base) ?? Names.nameBases[0];
    const site = this.getSite(burg);
    const landmark = this.pickConcept("generic", site, (fit, _, concept) => fit >= 3 && !WATERS.includes(concept)); // what the place stands out for
    const water = this.getWater(burg, site);
    const neighbor = this.getNeighbor(burg, burgs);
    const settlement = this.getSettlement(burg);
    const terrain = this.pickConcept("generic", site, (fit, _, concept) => fit >= 2 && TERRAIN.includes(concept));

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

    const name = burg.capital ? Names.getBaseShort(base.id) : Names.getBase(base.id);
    return { name, meaning: { pattern: "simplex", tokens: [`~${name}`], origin: base.id } };
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
      water?: { root: Token; tags: SiteTag[] };
      neighbor?: { root: Token; modifier: Concept };
    }
  ): Token[] | undefined {
    const generic = () => by.settled ?? this.pickConcept("generic", site, isBuilt)!;
    if (pattern === "feature") return [by.landmark!];
    if (pattern === "owner-generic") return [`~${this.founder(base)}`, generic()];
    if (pattern === "relative") return [by.neighbor!.modifier, by.neighbor!.root];
    const numbered = (counted: Concept) => COUNTABLE.includes(counted) && P(NUMBERED);
    const numeral = () => this.pickWeighted(conceptsOf("numeral"), weightOf);
    if (pattern === "compound") {
      const first = numbered(by.terrain!) ? numeral() : this.pickConcept("modifier", site)!;
      return [first, by.terrain!, by.settlement!];
    }
    if (pattern === "modifier-generic") {
      const place = generic();
      if (!by.settled && numbered(place)) return [numeral(), place]; // Three Towers
      const named = by.settled && by.landmark && P(LANDMARK) ? by.landmark : this.pickConcept("modifier", site)!;
      return [named, place];
    }
    const byWater =
      by.settled ??
      this.pickConcept(
        "generic",
        site,
        (weight, tags, concept) => isBuilt(weight, tags, concept) && by.water!.tags.some(tag => tags?.includes(tag))
      );
    return byWater && [byWater, by.water!.root];
  }

  /** The name a burg would take now that its group is no longer `was`: the same meaning, ending in what the burg
   * has become. Nothing when its name says nothing of its group, or would stay as it is */
  regrouped(burg: Burg, was?: string): Named | undefined {
    const [old, now] = [this.getSettlement({ ...burg, group: was }), this.getSettlement(burg)];
    if (!burg.meaning || !old || !now || old === now || !burg.meaning.tokens.includes(old)) return undefined;
    const tokens = burg.meaning.tokens.map(token => (token === old ? now : token));
    const meaning: Meaning = { ...burg.meaning, tokens };
    const name = Meanings.render(meaning, meaning.origin);
    return name === burg.name || this.burgNames(pack.burgs).has(name) ? undefined : { name, meaning };
  }

  // what a burg is by its group; a capital is a city whatever its group, a burg with no group yet is nothing
  private getSettlement(burg: Burg): Concept | undefined {
    if (burg.capital) return "city";
    const group = burg.group && options.map.burgs.groups.find(({ name }) => name === burg.group);
    return group ? settlementOf(group) : undefined;
  }

  /** A meaning for a state and its name in its culture's base, or in the base given.
   * With a seed the name comes off a random sequence of its own */
  state(capital: Burg, cultureId: number, { taken = this.stateNames(), baseId, seed }: StateOptions = {}): Named {
    if (seed) return seeded(seed, () => this.state(capital, cultureId, { taken, baseId }));
    const base = Names.resolve(baseId ?? pack.cultures[cultureId].base) ?? Names.nameBases[0];
    const site = this.getSite(capital);
    const lands = conceptsOf("land").filter(concept => Lexicon.authoredForms(base, concept)); // a fallback form would name a town

    for (let attempt = 0; attempt < TRIES; attempt++) {
      const pattern = this.pickPattern(base, STATE_PATTERNS);
      const land = this.pickWeighted(lands, concept => this.weigh(concept, site));
      const root: Token =
        pattern === "simplex" ? `~${Names.getBase(base.id, 3, 6, "")}` : this.getStateRoot(capital, base);
      const tokens: Token[] =
        pattern === "simplex"
          ? [root]
          : pattern === "root-land"
            ? [root, land]
            : [this.pickConcept("modifier", site)!, land];
      const named = this.accept({ pattern, tokens, origin: base.id }, base, taken, 3);
      if (named) return named;
    }

    const name = Names.getBaseShort(base.id);
    return { name, meaning: { pattern: "simplex", tokens: [`~${name}`], origin: base.id } };
  }

  /** The name a named thing would take in a culture's base, when that is another name than it has.
   * A name with no meaning is carried over as a proper name coined in the base given */
  nameIn(named: { name?: string; meaning?: Meaning }, cultureId: number, origin: string): string | undefined {
    const base = pack.cultures[cultureId]?.base;
    if (!base || !named.name) return undefined;
    const name = Meanings.render(named.meaning ?? Meanings.simplex(named.name, origin), base);
    return name === named.name ? undefined : name;
  }

  /** A land's name around a root, such as a province named after no burg, in a culture's base or the base given */
  land(root: string, cultureOrBase: number | string): string {
    return this.landOf(root, cultureOrBase).name;
  }

  /** A land's meaning around a root, and its name */
  landOf(root: string, cultureOrBase: number | string): Named {
    const baseId = typeof cultureOrBase === "number" ? pack.cultures[cultureOrBase].base : cultureOrBase;
    const base = Names.resolve(baseId) ?? Names.nameBases[0];
    const pattern = this.pickPattern(base, ["simplex", "root-land"]);
    const lands = conceptsOf("land").filter(concept => Lexicon.authoredForms(base, concept));
    const land = this.pickWeighted(lands, weightOf);
    const tokens: Token[] = pattern === "simplex" ? [`~${root}`] : [`~${root}`, land];
    const meaning: Meaning = { pattern, tokens, origin: base.id };
    return { name: Meanings.render(meaning, base.id), meaning };
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
    const { cells } = pack;
    const course = river.cells.filter(cell => cell >= 0);
    const cell = course[Math.floor(course.length / 2)] ?? river.mouth;
    const culture = cells.culture[river.mouth] ?? 0;
    const base = Names.resolve(baseId ?? pack.cultures[culture]?.base) ?? Names.nameBases[0];
    const isSmall = river.type !== "River"; // a brook, a creek or a fork
    const [x, y] = cells.p[cell];
    const site = { ...this.getSite({ cell, x, y, culture }), [isSmall ? "small" : "big"]: 2 };
    const waters: Concept[] = isSmall ? ["brook", "brook", "water", "run"] : ["river", "river", "water", "run"];

    for (let attempt = 0; attempt < TRIES; attempt++) {
      const pattern = this.pickPattern(base, ["simplex", "modifier-generic"], WATER_SHARE);
      const tokens: Token[] =
        pattern === "simplex" ? [`~${Names.getWater(base.id)}`] : [this.pickConcept("modifier", site)!, ra(waters)];
      const min = pattern === "simplex" ? 0 : undefined; // a water's own name is never too short: Exe, Oka
      const named = this.accept({ pattern, tokens, origin: base.id }, base, taken, min);
      if (named) return named;
    }
    return this.proper(base);
  }

  /** A meaning for a lake and its name in the base of the culture on its shore, or in the base given */
  lake(lake: Feature, { taken = this.featureNames(), baseId }: StateOptions = {}): Named {
    const { cells } = pack;
    const cell = lake.shoreline?.[0] || lake.firstCell;
    const culture = cells.culture[cell] ?? 0;
    const base = Names.resolve(baseId ?? pack.cultures[culture]?.base) ?? Names.nameBases[0];
    const [x, y] = cells.p[cell];
    const site = this.getSite({ cell, x, y, culture });
    const waters: Concept[] =
      lake.cells < 4 ? ["pool", "pool", "tarn", "lake", "eye"] : ["lake", "lake", "lake", "water", "eye"];

    for (let attempt = 0; attempt < TRIES; attempt++) {
      const pattern = this.pickPattern(base, ["simplex", "modifier-generic", "owner-generic"], WATER_SHARE);
      const first: Token = pattern === "owner-generic" ? `~${this.founder(base)}` : this.pickConcept("modifier", site)!;
      const tokens: Token[] = pattern === "simplex" ? [`~${Names.getWater(base.id)}`] : [first, ra(waters)];
      const min = pattern === "simplex" ? 0 : undefined; // a water's own name is never too short: Exe, Oka
      const named = this.accept({ pattern, tokens, origin: base.id }, base, taken, min);
      if (named) return named;
    }
    return this.proper(base);
  }

  // a person a place is named after: a woman as often as the base's owner-generic pattern says
  private founder(base: NameBase): string {
    return Names.getPerson(base.id, Lexicon.femaleFounders(base));
  }

  /** A proper name of a base: what a water is called when no meaning would do */
  private proper(base: NameBase): Named {
    const name = Names.getWater(base.id);
    return { name, meaning: { pattern: "simplex", tokens: [`~${name}`], origin: base.id } };
  }

  private featureNames(): Set<string | undefined> {
    return new Set(pack.features.map(feature => feature?.name));
  }

  // one time in five a state is named after its capital, when the capital's name is one short word to build on
  private getStateRoot(capital: Burg, base: NameBase): Token {
    const own = capital.meaning?.tokens.find(token => token.startsWith("~")) ?? `~${capital.name}`;
    return own.length < 10 && P(0.2) && !own.includes(" ") ? (own as Token) : `~${this.founder(base)}`; // else after a founder
  }

  /** Render a meaning and take the name when it is free, long enough and no longer than the base allows */
  private accept(
    meaning: Meaning,
    base: NameBase,
    taken: Set<string | undefined>,
    min = base.length[0]
  ): Named | undefined {
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

  /** The river or lake a burg stands by, as a root for its name, with the tags a generic must share with it */
  private getWater(burg: Burg, site: Site): { root: Token; tags: SiteTag[] } | undefined {
    const { cells, rivers, features } = pack;
    const river = site.stream || site.river ? rivers.find(river => river.i === cells.r[burg.cell]) : undefined;
    if (river?.name && !river.name.includes(" "))
      return { root: this.borrow(river.name, river.mouth, burg), tags: WATER_TAGS };
    const lake = site.lake ? features[cells.f[cells.haven[burg.cell]]] : undefined;
    if (!lake?.name || lake.name.includes(" ")) return undefined; // a name of two words is no root
    return { root: this.borrow(lake.name, lake.shoreline?.[0] ?? lake.firstCell, burg), tags: SHORE_TAGS };
  }

  /** A name as a root for a burg's own: one the culture at a cell gave is adapted to the burg's base */
  private borrow(name: string, namedAt: number, burg: Burg): Token {
    const [theirs, own] = [pack.cultures[pack.cells.culture[namedAt]]?.base, pack.cultures[burg.culture!].base];
    const base = Names.resolve(own);
    return theirs === own || !base ? `~${name}` : `~${capitalize(Appropriation.adapt(name.toLowerCase(), base))}`;
  }

  /** The nearest named burg of the same culture close by, and how this burg stands to it */
  private getNeighbor(burg: Burg, burgs: Burg[]): { root: Token; modifier: Concept } | undefined {
    const reach = (options.map.graph.width + options.map.graph.height) / 40;
    let nearest: Burg | undefined;
    let distance = reach;
    for (const other of burgs) {
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

  /** How well a concept fits a site: what the site offers of its tags, a little for one that fits anywhere,
   * more for the good made there, 0 for one the site has nothing for */
  private fit(concept: Concept, site: Site): number {
    const tags = fitsOf(concept);
    const fit = tags ? Math.max(...tags.map(tag => site[tag] ?? 0)) : PLAIN;
    return concept === site.good ? fit + 4 : fit;
  }

  /** How readily a site's name takes a concept: how well it fits, times how common the concept is. Commonness
   * counts squared: real names repeat a few words and leave the rest rare */
  private weigh(concept: Concept, site: Site): number {
    return this.fit(concept, site) * weightOf(concept) ** 2;
  }

  /** Draw a pattern by the base's weights; with a share, proper names take what the share leaves */
  private pickPattern(base: NameBase, patterns: Pattern[], share?: number): Pattern {
    if (share !== undefined) return P(share) ? this.pickPattern(base, without(patterns, "simplex")) : "simplex";
    return this.pickWeighted(patterns, pattern => Lexicon.patternWeight(base, pattern));
  }

  private settledShare(base: NameBase): number {
    return Names.lineage(base).find(({ settled }) => settled !== undefined)?.settled ?? SETTLED;
  }

  /** A meaning no place stands behind and its name: what a base makes of names, for its editor to show */
  sample(base: NameBase): Named {
    const concept = (kind: "settlement" | "generic" | "modifier") => ra(conceptsOf(kind));
    const pattern = this.pickPattern(base, ["feature", "modifier-generic", "owner-generic"]);
    const generic = concept(P(this.settledShare(base)) ? "settlement" : "generic");
    const tokens: Token[] =
      pattern === "feature"
        ? [concept("generic")]
        : pattern === "modifier-generic"
          ? [concept("modifier"), generic]
          : [`~${this.founder(base)}`, generic];
    const meaning: Meaning = { pattern, tokens, origin: base.id };
    return { name: Meanings.render(meaning, base.id), meaning };
  }

  private pickConcept(
    kind: "generic" | "modifier",
    site: Site,
    allow: (fit: number, tags: SiteTag[] | undefined, concept: Concept) => boolean = fit => fit > 0
  ): Concept | undefined {
    const concepts = conceptsOf(kind).filter(concept => allow(this.fit(concept, site), fitsOf(concept), concept));
    return concepts.length ? this.pickWeighted(concepts, concept => this.weigh(concept, site)) : undefined;
  }

  private pickWeighted<T>(items: T[], weigh: (item: T) => number): T {
    const weights = items.map(weigh);
    let roll = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
    for (const [index, item] of items.entries()) {
      roll -= weights[index];
      if (roll < 0) return item;
    }
    return items[items.length - 1];
  }
}

const without = <T>(items: T[], item: T) => items.filter(other => other !== item);

export const Toponyms = new ToponymsGenerator();
