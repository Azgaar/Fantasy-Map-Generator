// What a place offers a name, read off the map, and the concepts that fit it best

import {
  type Concept,
  conceptsOf,
  fitsOf,
  isConcept,
  isTerrain,
  isWater,
  type SiteTag,
  weightOf
} from "@/data/name-concepts";
import { Goods } from "@/model/economy/goods-generator";
import type { Burg } from "@/model/political/burgs-generator";
import type { NameBase } from "@/types/names";
import { pickWeighted } from "@/utils/probability-utils";
import { Lexicon } from "./lexicon";

/** How strongly a place offers each thing a concept may ask for */
export type Site = Partial<Record<SiteTag, number>> & { good?: Concept };

/** What a site is read from: a burg, or the cell a river or a lake is named at. A burg not specified yet has no
 * citadel, walls, temple or group */
export type Place = Pick<Burg, "cell" | "x" | "y" | "culture" | "port" | "capital" | "citadel" | "walls" | "temple">;

const BIG_RIVER_FLUX = 100; // from where a river carries boats
const [MOUNTAIN, HIGH_HILL, HILL] = [62, 45, 35]; // heights
// the default biomes' ids
const DESERTS = [1, 2];
const GRASSLANDS = [3, 4];
const FORESTS = [5, 6, 7, 8, 9];
const COLD = [9, 10, 11];
const HOT = [1, 3, 5, 7];
const WETLAND = 12;
const [BIG_SCORE, SMALL_SCORE] = [0.6, 0.3]; // of the best placement score: a burg of no size above is big, below small
const PLAIN = 1; // how well a concept that fits anywhere fits, against one the place asks for (2 to 4)
const GOOD = 4; // how much better a concept fits where the good it names is made

// what each culture type makes more of when it names a place
const LEANINGS: Record<string, SiteTag[]> = {
  Naval: ["port", "coast", "island"],
  Highland: ["hill", "mountain"],
  River: ["stream", "river", "mouth"],
  Lake: ["lake"],
  Hunting: ["forest"],
  Nomadic: ["desert", "plain"]
};

const WORDS: Concept[] = [...conceptsOf("generic"), ...conceptsOf("modifier")];
const PLACES = new Map(WORDS.map((concept, index) => [concept, index]));
// how well each word fits a place that offers nothing, and the words that ask for each thing it may offer
const BARE = Float64Array.from(WORDS, concept => (fitsOf(concept) ? 0 : PLAIN));
const ASKING = new Map<SiteTag, number[]>();
for (const [index, concept] of WORDS.entries())
  for (const tag of fitsOf(concept) ?? []) ASKING.set(tag, [...(ASKING.get(tag) ?? []), index]);

const isBuilt = (concept: Concept) => concept !== "abbey" && !isWater(concept);
const asksFor = (tags: SiteTag[]) => (concept: Concept) =>
  isBuilt(concept) && tags.some(tag => fitsOf(concept)?.includes(tag));

// the concepts one is picked from
const POOLS = {
  landmark: ["generic", concept => !isWater(concept)],
  terrain: ["generic", isTerrain],
  built: ["generic", isBuilt],
  riverside: ["generic", asksFor(["stream", "river", "mouth"])],
  shore: ["generic", asksFor(["lake", "port", "coast"])],
  modifier: ["modifier", () => true]
} satisfies Record<string, ["generic" | "modifier", (concept: Concept) => boolean]>;

export type PoolName = keyof typeof POOLS;

/** The words of a base in a pool: their places among all words, and how common they are */
interface Pool {
  places: number[];
  weights: number[];
}

class SitesModule {
  private readonly pools = new WeakMap<Set<Concept>, Partial<Record<PoolName, Pool>>>(); // by the concepts a base writes
  private readonly fits = new WeakMap<Site, Float64Array>();
  private readonly maxScores = new WeakMap<object, number>(); // by the cells' score array, so a new map measures anew

  /** What a place offers a name: water, relief, biome, deposits, size and the culture's leanings. `settlement` is
   * what a burg is by its group */
  read(place: Place, settlement?: Concept): Site {
    const { cells, features, cultures } = pack;
    const cell = place.cell;
    const site: Site = {};

    const coastal = cells.t[cell] === 1;
    const shore = coastal ? features[cells.f[cells.haven[cell]]] : undefined;
    if (place.port && coastal) site.port = 3;
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
    if (height >= MOUNTAIN) site.mountain = 3;
    else if (height >= HIGH_HILL) site.hill = 3;
    else if (height >= HILL) site.hill = 2;
    else if (GRASSLANDS.includes(biome)) site.plain = 2;
    else if (FORESTS.includes(biome)) site.plain = 1; // the fields cleared around a burg
    if (FORESTS.includes(biome)) site.forest = 2;
    if (biome === WETLAND) site.marsh = 3;
    if (DESERTS.includes(biome)) site.desert = 3;
    if (COLD.includes(biome)) site.cold = 2;
    if (HOT.includes(biome)) site.hot = 1;

    const good = [cell, ...cells.c[cell]].map(near => Goods.get(cells.good?.[near])).find(Boolean);
    if (good?.tags.some(tag => tag === "ore" || tag === "metal" || tag === "mineral")) site.ore = 3;
    const goodName = good?.name.toLowerCase() ?? "";
    site.good = [goodName, goodName.replace(/s$/, "")].find(isConcept);

    if (place.capital) site.capital = 2;
    if (place.citadel ?? place.capital) site.citadel = 3; // a capital will have one
    if (place.walls ?? place.capital) site.walls = 2;
    if (place.temple) site.temple = 3;
    if (settlement === "city") site.big = 2;
    else if (settlement === "village" || settlement === "hamlet") site.small = 2;
    else if (settlement !== "town") {
      // no group yet, or one of no size: the placement score tells
      const score = cells.s[cell] / this.getMaxScore();
      if (score > BIG_SCORE) site.big = 2;
      else if (score < SMALL_SCORE) site.small = 2;
    }

    const { width, height: mapHeight } = options.map.graph;
    if (place.y < mapHeight / 3) site.north = 2;
    else if (place.y > (mapHeight * 2) / 3) site.south = 2;
    if (place.x < width / 3) site.west = 2;
    else if (place.x > (width * 2) / 3) site.east = 2;

    const type = cultures[place.culture!]?.type;
    if (type === "Nomadic") site.nomadic = 2;
    for (const tag of LEANINGS[type] ?? []) if (site[tag]) site[tag] *= 1.5;
    return site;
  }

  /** A concept of a base's pool, as likely as it fits the site times how common it is; none when the site offers
   * none so much as `min` */
  pickConcept(pool: PoolName, site: Site, base: NameBase, min = 0, except?: Concept): Concept | undefined {
    const { places, weights } = this.poolOf(pool, base);
    const fits = this.fitsOf(site);
    const barred = except ? PLACES.get(except) : undefined;
    const drawn = places.map((place, i) => (fits[place] < min || place === barred ? 0 : fits[place] * weights[i]));
    return drawn.some(Boolean) ? WORDS[pickWeighted(places, drawn)] : undefined;
  }

  /** What a land is called: a land word the base writes, so that no state is the Kingdom of a Realm, one that ends a
   * name where there is one */
  pickLand(base: NameBase, site: Site): Concept {
    const lands = conceptsOf("land").filter(concept => Lexicon.authoredForms(base, concept)); // a coined form would name a town
    const joined = lands.filter(land => Lexicon.authoredForms(base, land)!.some(({ position }) => position !== "word"));
    const candidates = joined.length ? joined : lands;
    return pickWeighted(
      candidates,
      candidates.map(land => Math.max(...(fitsOf(land)?.map(tag => site[tag] ?? 0) ?? [PLAIN])) * commonness(land))
    );
  }

  // the base's words of a pool; kept while the concepts the base writes stay the same
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
      fits = BARE.slice();
      for (const [tag, words] of ASKING) {
        const offer = site[tag];
        if (offer) for (const index of words) if (offer > fits[index]) fits[index] = offer;
      }
      const made = site.good && PLACES.get(site.good);
      if (made !== undefined) fits[made] += GOOD;
      this.fits.set(site, fits);
    }
    return fits;
  }

  private getMaxScore(): number {
    const scores = pack.cells.s;
    let max = this.maxScores.get(scores) ?? 0;
    if (!max) {
      for (const score of scores) if (score > max) max = score;
      this.maxScores.set(scores, max || 1);
    }
    return max || 1;
  }
}

/** How common a concept is in real names, counted squared: real names repeat a few words and leave the rest rare */
export function commonness(concept: Concept): number {
  return weightOf(concept) ** 2;
}

export const Sites = new SitesModule();
