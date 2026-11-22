// Gives burgs and states a meaning that fits their place: the "semantic" half of semantic names

import type { NameBase, Pattern } from "@/data/name-bases";
import { type Concept, conceptsOf, fitsOf, isConcept, type SiteTag } from "@/data/name-concepts";
import { DEFAULT_WEIGHTS } from "@/data/name-rules";
import { Goods } from "@/model/economy/goods-generator";
import type { Feature } from "@/model/physical/features-generator";
import type { River } from "@/model/physical/river-generator";
import type { Burg } from "@/model/political/burgs-generator";
import { P, ra } from "@/utils/probability-utils";
import { capitalize } from "@/utils/string-utils";
import { adopt } from "./name-adoption";
import {
  authoredForms,
  compose,
  type Meaning,
  patternWeight,
  render,
  seeded,
  simplex,
  type Token
} from "./name-render";
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

const BURG_PATTERNS: Pattern[] = ["simplex", "feature", "modifier-generic", "owner-generic", "generic-of", "relative"];
const STATE_PATTERNS: Pattern[] = ["simplex", "root-land", "modifier-land"];
const WATER_TAGS: SiteTag[] = ["stream", "river", "mouth"];
const SHORE_TAGS: SiteTag[] = ["lake", "port", "coast"];
const FOREST_BIOMES = [5, 6, 7, 8, 9];
const BIG_RIVER_FLUX = 100; // from where a river carries boats
const WATER_SHARE = 0.5; // waters keep old names: half as many of them say something as burgs do
const TRIES = 12;

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
  /** Name the burgs that have no name yet, each on a random sequence of its own: one name does not move another */
  nameBurgs(burgs: Burg[], roll = ""): void {
    const taken = this.burgNames(burgs);
    for (const burg of burgs) {
      if (!burg.i || burg.name) continue;
      Object.assign(
        burg,
        seeded(`${options.map.seed}|burg|${burg.i}|${roll}`, () => this.burg(burg, { burgs, taken }))
      );
      taken.add(burg.name);
    }
  }

  /** A meaning that fits a burg's place and its name in the culture's base, or in the base given */
  burg(burg: Burg, { burgs = pack.burgs, taken = this.burgNames(burgs), baseId }: BurgOptions = {}): Named {
    const base = Names.resolve(baseId ?? pack.cultures[burg.culture!].base) ?? Names.nameBases[0];
    const site = this.getSite(burg);
    const landmark = this.pickConcept("generic", site, weight => weight >= 3); // a generic the place stands out for
    const water = this.getWater(burg, site);
    const neighbor = this.getNeighbor(burg, burgs);

    const supported = (pattern: Pattern) =>
      (pattern !== "feature" || landmark) &&
      (pattern !== "generic-of" || water) &&
      (pattern !== "relative" || neighbor);
    const patterns = BURG_PATTERNS.filter(supported);

    for (let attempt = 0; attempt < TRIES; attempt++) {
      const pattern = this.pickPattern(base, patterns);
      const tokens = this.fillBurg(pattern, burg, base, site, landmark, water, neighbor);
      const named = tokens && this.accept({ pattern, tokens, origin: base.id }, base, taken);
      if (named) return named;
    }

    const name = burg.capital ? Names.getBaseShort(base.id) : Names.getBase(base.id);
    return { name, meaning: { pattern: "simplex", tokens: [`~${name}`], origin: base.id } };
  }

  private fillBurg(
    pattern: Pattern,
    burg: Burg,
    base: NameBase,
    site: Site,
    landmark?: Concept,
    water?: { root: Token; tags: SiteTag[] },
    neighbor?: { root: Token; modifier: Concept }
  ): Token[] | undefined {
    const generic = () => this.pickConcept("generic", site)!;
    const modifier = () => this.pickConcept("modifier", site)!;
    if (pattern === "simplex") return [`~${burg.capital ? Names.getBaseShort(base.id) : Names.getBase(base.id)}`];
    if (pattern === "feature") return [landmark!];
    if (pattern === "modifier-generic") return [modifier(), generic()];
    if (pattern === "owner-generic") return [`~${Names.getPerson(base.id)}`, generic()];
    if (pattern === "relative") return [neighbor!.modifier, neighbor!.root];
    const byWater = this.pickConcept(
      "generic",
      site,
      (weight, tags) => weight > 0 && water!.tags.some(tag => tags?.includes(tag))
    );
    return byWater && [byWater, water!.root];
  }

  /** A meaning for a state and its name in its culture's base, or in the base given.
   * With a seed the name comes off a random sequence of its own */
  state(capital: Burg, cultureId: number, { taken = this.stateNames(), baseId, seed }: StateOptions = {}): Named {
    if (seed) return seeded(seed, () => this.state(capital, cultureId, { taken, baseId }));
    const base = Names.resolve(baseId ?? pack.cultures[cultureId].base) ?? Names.nameBases[0];
    const site = this.getSite(capital);
    const lands = conceptsOf("land").filter(concept => authoredForms(base, concept)); // a fallback form would name a town

    for (let attempt = 0; attempt < TRIES; attempt++) {
      const pattern = this.pickPattern(base, STATE_PATTERNS);
      const land = this.pickWeighted(lands, concept => (concept === "land" ? 6 : this.weigh(concept, site))); // mostly plain "land"
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
    const name = render(named.meaning ?? simplex(named.name, origin), base);
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
    const lands = conceptsOf("land").filter(concept => authoredForms(base, concept));
    const land = this.pickWeighted(lands, concept => (concept === "land" ? 6 : 1));
    const tokens: Token[] = pattern === "simplex" ? [`~${root}`] : [`~${root}`, land];
    const meaning: Meaning = { pattern, tokens, origin: base.id };
    return { name: render(meaning, base.id), meaning };
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
    const waters: Concept[] = isSmall ? ["brook", "brook", "water"] : ["river", "river", "water"];

    for (let attempt = 0; attempt < TRIES; attempt++) {
      const pattern = this.pickPattern(base, ["simplex", "modifier-generic"], WATER_SHARE);
      const tokens: Token[] =
        pattern === "simplex" ? [`~${Names.getBase(base.id)}`] : [this.pickConcept("modifier", site)!, ra(waters)];
      const named = this.accept({ pattern, tokens, origin: base.id }, base, taken);
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
    const waters: Concept[] = lake.cells < 4 ? ["pool", "pool", "lake", "water"] : ["lake", "lake", "lake", "water"];

    for (let attempt = 0; attempt < TRIES; attempt++) {
      const pattern = this.pickPattern(base, ["simplex", "modifier-generic", "owner-generic"], WATER_SHARE);
      const first: Token =
        pattern === "owner-generic" ? `~${Names.getPerson(base.id)}` : this.pickConcept("modifier", site)!;
      const tokens: Token[] = pattern === "simplex" ? [`~${Names.getBase(base.id)}`] : [first, ra(waters)];
      const named = this.accept({ pattern, tokens, origin: base.id }, base, taken);
      if (named) return named;
    }
    return this.proper(base);
  }

  /** A proper name of a base: what a place is called when no meaning would do */
  private proper(base: NameBase): Named {
    const name = Names.getBase(base.id);
    return { name, meaning: { pattern: "simplex", tokens: [`~${name}`], origin: base.id } };
  }

  private featureNames(): Set<string | undefined> {
    return new Set(pack.features.map(feature => feature?.name));
  }

  // one time in five a state is named after its capital, when the capital's name is short enough to build on
  private getStateRoot(capital: Burg, base: NameBase): Token {
    const own = capital.meaning?.tokens.find(token => token.startsWith("~")) ?? `~${capital.name}`;
    return own.length < 10 && P(0.2) ? (own as Token) : `~${Names.getPerson(base.id)}`; // else after a founder
  }

  /** Render a meaning and take the name when it is free, long enough and no longer than the base allows */
  private accept(
    meaning: Meaning,
    base: NameBase,
    taken: Set<string | undefined>,
    min = base.length[0]
  ): Named | undefined {
    const { name, whole } = compose(meaning, base.id);
    return whole && name.length >= min && !taken.has(name) ? { name, meaning } : undefined;
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
    if (river?.name) return { root: this.borrow(river.name, river.mouth, burg), tags: WATER_TAGS };
    const lake = site.lake ? features[cells.f[cells.haven[burg.cell]]] : undefined;
    if (!lake?.name) return undefined;
    return { root: this.borrow(lake.name, lake.shoreline?.[0] ?? lake.firstCell, burg), tags: SHORE_TAGS };
  }

  /** A name as a root for a burg's own: one the culture at a cell gave is adapted to the burg's base */
  private borrow(name: string, namedAt: number, burg: Burg): Token {
    const [theirs, own] = [pack.cultures[pack.cells.culture[namedAt]]?.base, pack.cultures[burg.culture!].base];
    const base = Names.resolve(own);
    return theirs === own || !base ? `~${name}` : `~${capitalize(adopt(name.toLowerCase(), base))}`;
  }

  /** The nearest named burg of the same culture close by, and how this burg stands to it */
  private getNeighbor(burg: Burg, burgs: Burg[]): { root: Token; modifier: Concept } | undefined {
    const reach = (options.map.graph.width + options.map.graph.height) / 40;
    let nearest: Burg | undefined;
    let distance = reach;
    for (const other of burgs) {
      if (!other.i || other === burg || other.removed || !other.name || other.culture !== burg.culture) continue;
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
    else if (height < 35 && (biome === 3 || biome === 4)) site.plain = 2;
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

  /** How well a concept fits a site: 1 for one that fits anywhere, 0 for one the site has nothing for */
  private weigh(concept: Concept, site: Site): number {
    const tags = fitsOf(concept);
    const fit = tags ? Math.max(...tags.map(tag => site[tag] ?? 0)) : 1;
    return concept === site.good ? fit + 4 : fit;
  }

  /** Draw a pattern by the base's weights, the options setting the share of names that say something */
  private pickPattern(base: NameBase, patterns: Pattern[], share = 1): Pattern {
    const meaningful = (options.generation.names.meaningful / 100) * share;
    const total = patterns.reduce((sum, pattern) => sum + DEFAULT_WEIGHTS[pattern], 0);
    const plain = DEFAULT_WEIGHTS.simplex / total; // the share of proper names where nothing is set
    const scale = (pattern: Pattern) => (pattern === "simplex" ? (1 - meaningful) / plain : meaningful / (1 - plain));
    return this.pickWeighted(patterns, pattern => patternWeight(base, pattern) * scale(pattern));
  }

  /** A meaning no place stands behind and its name: what a base makes of names, for its editor to show */
  sample(base: NameBase): Named {
    const concept = (kind: "generic" | "modifier") => ra(conceptsOf(kind));
    const pattern = this.pickPattern(base, ["simplex", "feature", "modifier-generic", "owner-generic"]);
    const tokens: Token[] =
      pattern === "simplex"
        ? [`~${Names.getBase(base.id)}`]
        : pattern === "feature"
          ? [concept("generic")]
          : pattern === "modifier-generic"
            ? [concept("modifier"), concept("generic")]
            : [`~${Names.getPerson(base.id)}`, concept("generic")];
    const meaning: Meaning = { pattern, tokens, origin: base.id };
    return { name: render(meaning, base.id), meaning };
  }

  private pickConcept(
    kind: "generic" | "modifier",
    site: Site,
    allow: (weight: number, tags?: SiteTag[]) => boolean = weight => weight > 0
  ): Concept | undefined {
    const concepts = conceptsOf(kind).filter(concept => allow(this.weigh(concept, site), fitsOf(concept)));
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

export const Toponyms = new ToponymsGenerator();
