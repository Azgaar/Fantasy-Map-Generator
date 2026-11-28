// Gives burgs, lands and waters a meaning that fits their place: the "semantic" half of semantic names

import { group } from "d3";
import {
  type Concept,
  conceptsOf,
  impliedBy,
  isCountable,
  isTerrain,
  type Kind,
  kindOf,
  OPPOSITES,
  settlementOf,
  weightOf
} from "@/data/name-concepts";
import { PATTERNS } from "@/data/name-patterns";
import { type EntityRef, MapEntities } from "@/model/map-entities";
import type { Feature } from "@/model/physical/features-generator";
import type { River } from "@/model/physical/river-generator";
import type { Burg } from "@/model/political/burgs-generator";
import type { Province } from "@/model/political/provinces-generator";
import { States } from "@/model/political/states-generator";
import type { Meaning, NameBase, Named, Pattern, PlaceRef, PlaceType, Token } from "@/types/names";
import { P, pickWeighted, ra, seeded } from "@/utils/probability-utils";
import { Appropriation } from "./appropriation";
import { Lexicon } from "./lexicon";
import { isRoot, Meanings } from "./meanings";
import { NameBases } from "./name-bases";
import { Names } from "./names-generator";
import { commonness, type Place, type PoolName, type Site, Sites } from "./sites";

type Coined = Required<Named>;

/** A place as it is renamed */
type Renamed = Partial<Named> & { i?: number; removed?: boolean; lock?: boolean };

/** What names each kind of place that keeps a meaning */
interface Naming {
  list: () => (Renamed | undefined)[];
  find: (id: number) => Renamed | undefined;
  culture: (id: number) => number | undefined; // in whose tongue it is named; none for what has no meaning
  taken: () => Set<string | undefined>; // the names a new one may not repeat
  coin: (id: number, baseId: string) => Coined; // a meaning that fits it, and its name in a base
  proper: (id: number, baseId: string) => string;
}

/** How a place is renamed when its culture says names another way: the name it has respelled, or a new one */
export type Retelling = "appropriate" | "regenerate";

/** A new name for one of the map's places */
interface Renaming {
  type: PlaceType;
  id: number;
  named: Coined;
}

/** Names no new one may repeat */
type Taken = { has(name?: string): boolean };

interface PlaceOptions {
  taken?: Taken;
  baseId?: string;
}

interface BurgOptions extends PlaceOptions {
  burgs?: Burg[]; // the burgs that may be around, the map's where none are given
}

interface SampleOptions {
  pattern?: Pattern;
  concept?: Concept;
}

/** How big a land is: what it is called leans on it */
export type LandSize = "big" | "middle" | "small";

interface StateOptions extends PlaceOptions {
  size?: LandSize;
}

const BURG_PATTERNS: Pattern[] = ["feature", "modifier-generic", "owner-generic", "generic-of", "compound", "relative"];
const LAND_PATTERNS = (Object.keys(PATTERNS) as Pattern[]).filter(pattern => PATTERNS[pattern].isLand);
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
const OWN_PEOPLE = 0.1; // how readily a state is named after its own people
const CAPITAL_ROOT = 0.2; // how readily a state is named after the person or river its capital is named after
const ADJECTIVE = /(?:shire|(?<=.{3})ian|(?<=.{4})an)$/; // what a people's name is without
const WATER_SHARE = 0.5; // waters keep old names: this many of them say something
const POOL_CELLS = 4; // a lake of fewer cells is a pool
const SEA_DESCRIBED = 0.8; // the share of seas named for what they are like, not for their side of the map
const NEIGHBOR_SHARE = 40; // how far a burg names itself after another: the map's width and height together over this
const LEVEL_CLIMB = 8; // the height a burg stands above or below its neighbor to be its Upper or Lower
const TRIES = 12; // meanings drawn before a place takes a proper name
const LAND_TRIES = TRIES * 4; // lands drawn before one cut short or taken will do
const RENAMES = 16; // how many ways a burg's new name is drawn, to take the one nearest to the old
const NUMBERED = 0.12; // of the names of what there may be several of, the share that count them

// what a sea is like
const SEA_WORDS: Concept[] = [
  "amber",
  "autumn",
  "bitter",
  "black",
  "blue",
  "bone",
  "bright",
  "broad",
  "broken",
  "clear",
  "cold",
  "crimson",
  "cursed",
  "dark",
  "dawn",
  "dead",
  "deep",
  "dragon",
  "dread",
  "drowned",
  "dusk",
  "far",
  "frost",
  "ghost",
  "glass",
  "golden",
  "great",
  "green",
  "grey",
  "haunted",
  "ice",
  "king",
  "kraken",
  "lost",
  "lucky",
  "mist",
  "moon",
  "night",
  "pale",
  "pearl",
  "quiet",
  "red",
  "reed",
  "sail",
  "salt",
  "serpent",
  "shadow",
  "silver",
  "singing",
  "sky",
  "sleeping",
  "star",
  "storm",
  "summer",
  "sun",
  "thunder",
  "wandering",
  "weeping",
  "whale",
  "whispering",
  "white",
  "wild",
  "wind",
  "winter",
  "wonder",
  "yellow"
];

const TERRAIN = conceptsOf("generic").filter(isTerrain);
const COUNTABLE = conceptsOf("generic").filter(isCountable);

class ToponymsGenerator {
  private readonly namings: Record<PlaceType, Naming> = {
    burg: {
      list: () => pack.burgs,
      find: id => pack.burgs[id],
      culture: id => pack.burgs[id].culture,
      taken: () => this.burgNames(pack.burgs),
      coin: (id, baseId) => this.burg(pack.burgs[id], { baseId }),
      proper: (_, baseId) => Names.getBase(baseId)
    },
    state: {
      list: () => pack.states,
      find: id => pack.states[id],
      culture: id => (id ? pack.states[id].culture : undefined), // neutral lands are no state
      taken: () => this.landNames(),
      coin: (id, baseId) => {
        const { capital, culture, area } = pack.states[id];
        return this.state(pack.burgs[capital], culture, { baseId, size: States.getLandSize(area) });
      },
      proper: (id, baseId) => this.land(baseId, undefined, States.getLandSize(pack.states[id].area)).name
    },
    province: {
      list: () => pack.provinces,
      find: id => pack.provinces[id],
      culture: id => pack.cells.culture[pack.provinces[id].center],
      taken: () => this.landNames(),
      coin: (_, baseId) => this.land(baseId),
      proper: (_, baseId) => this.land(baseId).name
    },
    river: {
      list: () => pack.rivers,
      find: id => pack.rivers.find(({ i }) => i === id),
      culture: id => pack.cells.culture[pack.rivers.find(({ i }) => i === id)!.mouth],
      taken: () => new Set(pack.rivers.map(({ name }) => name)),
      coin: (id, baseId) => this.river(pack.rivers.find(({ i }) => i === id)!, { baseId }),
      proper: (_, baseId) => Names.getWater(baseId)
    },
    feature: {
      list: () => pack.features,
      find: id => pack.features[id] || undefined,
      culture: id => (pack.features[id].type === "ocean" ? undefined : this.cultureOfFeature(pack.features[id])), // seas belong to no people
      taken: () => this.featureNames(),
      coin: (id, baseId) => {
        const feature = pack.features[id];
        if (feature.type === "ocean") return this.sea(feature, baseId);
        return feature.type === "lake" ? this.lake(feature, { baseId }) : this.island(feature, { baseId });
      },
      proper: (id, baseId) => {
        const feature = pack.features[id];
        return feature.type === "island" ? this.land(baseId).name : Names.getWater(baseId);
      }
    }
  };

  /** Run a place's naming on a random sequence seeded by the map seed, the place and `roll`, so naming one place
   * moves no other. Another roll gives other names */
  drawFor<T>(type: string, id: number, draw: () => T, roll?: string): T {
    return seeded([options.map.seed, type, id, ...(roll === undefined ? [] : [roll])].join("|"), draw);
  }

  /** A place that keeps a meaning, by its kind and id */
  placeOf(type: PlaceType, id: number): Partial<Named> | undefined {
    return this.namings[type].find(id);
  }

  /** A new meaning that fits a place, and its name in a base */
  coinFor(type: PlaceType, id: number, baseId: string): Coined {
    return this.namings[type].coin(id, baseId);
  }

  /** A new proper name for a place, in a base */
  properFor(type: PlaceType, id: number, baseId: string): string {
    return this.namings[type].proper(id, baseId);
  }

  /** Name the burgs that have no name yet, each on a random sequence of its own: one name does not move another.
   * With `only`, name just the burgs it takes */
  nameBurgs(burgs: Burg[], roll = "", only: (burg: Burg) => boolean = () => true): void {
    const taken = this.burgNames(burgs);
    const named = group(
      burgs.filter(burg => burg.name),
      burg => burg.culture
    );
    for (const burg of burgs) {
      if (!burg.i || burg.name || burg.removed || !only(burg)) continue;
      const kin = named.get(burg.culture) ?? [];
      Object.assign(
        burg,
        this.drawFor("burg", burg.i, () => this.burg(burg, { burgs: kin, taken }), roll)
      );
      taken.add(burg.name);
      kin.push(burg);
      named.set(burg.culture, kin);
    }
  }

  /** The name of a burg, given now if it has none: for what is named after a burg before all burgs are */
  nameOf(burg: Burg): string {
    if (!burg.name)
      Object.assign(
        burg,
        this.drawFor("burg", burg.i, () => this.burg(burg), "")
      );
    return burg.name!;
  }

  /** A meaning that fits a burg's place and group, and its name in the culture's base or in the base given.
   * A burg with no group yet takes a name that says nothing of its size */
  burg(burg: Burg, { burgs = pack.burgs, taken = this.burgNames(burgs), baseId }: BurgOptions = {}): Coined {
    const base = NameBases.resolve(baseId ?? pack.cultures[burg.culture!].base);
    const picked = this.pickBurg(base, taken);
    if (picked) return picked;
    const site = this.getSite(burg);
    const landmark = Sites.pickConcept("landmark", site, base, 3); // what the place stands out for
    const water = this.getWater(burg, site, base);
    const neighbor = this.getNeighbor(burg, burgs, base);
    const settlement = this.getSettlement(burg);
    const terrain = Sites.pickConcept("terrain", site, base, 2);

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
      const after = pattern === "generic-of" ? water?.after : pattern === "relative" ? neighbor?.after : undefined;
      const named = tokens && this.accept(withAfter({ pattern, tokens, origin: base.id }, after), base, taken);
      if (named) return named;
      if (pattern === "feature" && patterns.length > 1) patterns = without(patterns, "feature"); // its names stay the same
    }

    return proper(() => (burg.capital ? Names.getBaseShort(base.id) : Names.getBase(base.id)), base, taken);
  }

  // a listed place not on the map yet, where the base picks its burg names; one like them when all are taken
  private pickBurg(base: NameBase, taken: Taken): Coined | undefined {
    if (base.places.mode !== "pick") return undefined;
    const free = base.places.names.filter(name => !taken.has(name));
    return proper(() => (free.length ? ra(free) : Names.getBase(base.id)), base, taken);
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
    const generic = () => by.settled ?? Sites.pickConcept("built", site, base)!;
    if (pattern === "feature") return [by.landmark!];
    if (pattern === "owner-generic") return [`~${Names.getPerson(base.id)}`, generic()];
    if (pattern === "relative") return [by.neighbor!.modifier, by.neighbor!.root];
    const numbered = (counted: Concept) => isCountable(counted) && P(NUMBERED);
    const numeral = () => pickBy(Lexicon.spoken(base, conceptsOf("numeral")), weightOf);
    const modifier = (place: Concept) => Sites.pickConcept("modifier", site, base, 0, impliedBy(place))!;
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
    const byWater = by.settled ?? Sites.pickConcept(by.water!.pool, site, base);
    return byWater && [byWater, by.water!.root];
  }

  /** A burg's name after its group changed from `was`: the same meaning with the new settlement word, closest to the
   * old name, and respelled again where the old one was. Nothing when the name does not say the group, or stays */
  regrouped(burg: Burg, was?: string): Coined | undefined {
    const [old, now] = [this.getSettlement({ ...burg, group: was }), this.getSettlement(burg)];
    if (!burg.meaning || !old || !now || old === now || !burg.meaning.tokens.includes(old)) return undefined;
    const base = NameBases.find(burg.meaning.origin);
    if (!base) return undefined; // its tongue is not on the map any more
    const { own } = burg.meaning;
    const tokens = burg.meaning.tokens.map(token => (token === old ? now : token));
    const taken = this.burgNames(pack.burgs);
    let best: Coined | undefined;
    for (let salt = 0; salt < RENAMES; salt++) {
      const meaning: Meaning = { ...burg.meaning, tokens, salt: salt || undefined, own: undefined };
      const { name, whole } = Meanings.compose(meaning, base);
      if (!whole || taken.has(name) || name === own) continue; // its own name is taken too
      const said = own && this.nameIn({ name, meaning }, burg.culture!, base.id);
      const named = said || { name, meaning };
      if (said && taken.has(said.name)) continue;
      if (!best || shared(named.name, burg.name!) > shared(best.name, burg.name!)) best = named;
    }
    return best;
  }

  // what a burg is by its group; a capital is a city whatever its group, a burg with no group yet is nothing
  private getSettlement(burg: Pick<Burg, "capital" | "group">): Concept | undefined {
    if (burg.capital) return "city";
    const group = burg.group && options.map.burgs.groups.find(({ name }) => name === burg.group);
    return group ? settlementOf(group) : undefined;
  }

  /** A meaning for a state and its name in its culture's base, or in the base given: a land, never a bare name */
  state(
    capital: Burg,
    cultureId: number,
    { taken = this.landNames(), baseId, size = "small" }: StateOptions = {}
  ): Coined {
    const base = NameBases.resolve(baseId ?? pack.cultures[cultureId].base);
    const meaning = capital.meaning && Meanings.coinedIn(capital.meaning, base);
    const people = this.getPeopleRoot(cultureId);
    const root = () => this.getCapitalRoot(meaning) ?? (people && P(OWN_PEOPLE) ? people : this.getLandRoot(base));
    const water = meaning?.pattern === "generic-of" ? meaning.tokens[1] : undefined;
    return this.coinLand(base, taken, this.getSite(capital), root, { size, water, after: meaning?.after });
  }

  // a land around a root or a describing word, its name not yet taken and not too long where a shorter one is found
  private coinLand(
    base: NameBase,
    taken: Taken,
    site: Site,
    root: () => Token,
    { size, water, after, land }: { size: LandSize; water?: Token; after?: PlaceRef; land?: Concept } // after: the water's
  ): Coined {
    const landSite = { ...site, ...LAND_SITES[size] };
    const weigh = (pattern: Pattern) =>
      Lexicon.patternWeight(base, pattern) * (pattern === "modifier-land" && size === "big" ? BIG_DESCRIBED : 1);
    let shortest: Coined | undefined;
    for (let attempt = 0; ; attempt++) {
      const pattern = pickBy(LAND_PATTERNS, weigh);
      const first = pattern === "root-land" ? root() : Sites.pickConcept("modifier", landSite, base)!;
      const tokens = [first, land ?? Sites.pickLand(base, landSite)];
      const meaning = withAfter({ pattern, tokens, origin: base.id }, first === water ? after : undefined);
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
      if ((attempt >= TRIES && !taken.has(name)) || attempt >= LAND_TRIES) return { name, meaning };
    }
  }

  /** A name as a culture says it, coming from base `saidIn`: appropriated whole, or back to its own name in the base
   * it was coined in. The meaning keeps the own name of a respelled one. Nothing when the name stays */
  nameIn(named: Partial<Named>, cultureId: number, saidIn: string): Coined | undefined {
    const baseId = pack.cultures[cultureId]?.base;
    if (!baseId || baseId === saidIn || !named.name) return undefined; // a people of the same tongue says it as it is
    const { own = named.name, ...meaning } = named.meaning ?? Meanings.simplex(named.name, saidIn);
    if (baseId === meaning.origin) return own === named.name ? undefined : { name: own, meaning };
    const name = Appropriation.adopt(named.name, NameBases.resolve(baseId));
    return !name || name === named.name ? undefined : { name, meaning: { ...meaning, own } };
  }

  /** The places a culture names, locked ones aside */
  placesOf(cultureId: number): PlaceRef[] {
    return [...this.unlocked()].flatMap(({ type, naming, place }) =>
      naming.culture(place.i) === cultureId ? { type, id: place.i } : []
    );
  }

  /** A place's name now that its culture says names in another base than `saidIn`: the name it has as the culture
   * says it, or a new one. Nothing when it stays or would repeat another */
  renameIn({ type, id }: PlaceRef, saidIn: string, how: Retelling): Coined | undefined {
    const naming = this.namings[type];
    const [place, culture] = [naming.find(id), naming.culture(id)];
    if (!place || culture === undefined) return undefined;
    const named =
      how === "regenerate" ? naming.coin(id, pack.cultures[culture].base) : this.nameIn(place, culture, saidIn);
    return named && named.name !== place.name && !naming.taken().has(named.name) ? named : undefined;
  }

  /** New names for the places named after a renamed one, the new name as their root. Only where the root still says
   * the old name and the name was not edited by hand; locked places aside */
  renamedAfter(after: PlaceRef, was: string): Renaming[] {
    const now = this.placeOf(after.type, after.id)?.name;
    if (!now || now === was) return [];
    const culture = this.cultureOf(after) ?? 0;
    const lands = this.landNames(); // states and provinces share theirs
    const takenBy: Partial<Record<PlaceType, Set<string | undefined>>> = { state: lands, province: lands };
    const takenOf = (type: PlaceType) => (takenBy[type] ??= this.namings[type].taken());

    return [...this.unlocked()].flatMap(({ type, naming, place }) => {
      const meaning = place.meaning;
      if (meaning?.after?.type !== after.type || meaning.after.id !== after.id) return [];
      const base = NameBases.find(meaning.origin);
      const index = meaning.tokens.findIndex(isRoot);
      if (!base || index < 0) return [];

      // a root is the name as it is or as the base's people say it
      const spellings = (name: string): Token[] => [`~${name}`, this.borrow(name, culture, base)];
      const said = spellings(was).indexOf(meaning.tokens[index]);
      if (said < 0 || Meanings.render(meaning, base.id) !== (meaning.own ?? place.name)) return []; // renamed by hand
      const taken = takenOf(type);
      const tokens = meaning.tokens.with(index, spellings(now)[said]);
      const coined = this.accept({ ...meaning, tokens, salt: undefined, own: undefined }, base, taken, 0);
      if (!coined) return [];
      const respelled = meaning.own ? this.nameIn(coined, naming.culture(place.i) ?? 0, base.id) : undefined;
      const named = respelled ?? coined;
      if (taken.has(named.name)) return [];
      taken.add(named.name);
      return { type, id: place.i, named };
    });
  }

  // every place that keeps a meaning, locked ones aside
  private *unlocked(): Generator<{ type: PlaceType; naming: Naming; place: Renamed & { i: number } }> {
    for (const [type, naming] of Object.entries(this.namings) as [PlaceType, Naming][])
      for (const place of naming.list())
        if (place?.i && !place.removed && !place.lock) yield { type, naming, place: place as Renamed & { i: number } };
  }

  /** A name for the map: a big land's, in a base its cultures use */
  mapName(): string {
    const base = Names.mapBase();
    return this.coinLand(base, new Set(), {}, () => this.getLandRoot(base), { size: "big" }).name;
  }

  /** A meaning for a land, such as a province named after no burg, and its name in a culture's base or the base
   * given, which repeats none of those taken and no burg's */
  land(cultureOrBase: number | string, taken = this.landNames(), size: LandSize = "small"): Coined {
    const baseId = typeof cultureOrBase === "number" ? pack.cultures[cultureOrBase].base : cultureOrBase;
    const base = NameBases.resolve(baseId);
    const has = (name?: string) => {
      if (taken.has(name)) return true;
      for (const burg of pack.burgs) if (burg.name === name && !burg.removed) return true;
      return false;
    };
    return this.coinLand(base, { has }, {}, () => this.getLandRoot(base), { size });
  }

  /** The names of the lands there are, states and provinces */
  landNames(provinces: Province[] = pack.provinces): Set<string | undefined> {
    return new Set([...this.stateNames(), ...provinces.filter(p => p.i && !p.removed).map(({ name }) => name)]);
  }

  /** A colony's meaning after the land it was settled from, as in New Oswinfall, and its name in a culture's base.
   * Nothing when the name is too long to keep "new" */
  colonyOf(root: string, cultureId: number, after?: PlaceRef): Coined | undefined {
    const baseId = pack.cultures[cultureId].base;
    const meaning = withAfter({ pattern: "relative", tokens: ["new", `~${root}`], origin: baseId }, after);
    const { name, whole } = Meanings.compose(meaning, baseId);
    return whole ? { name, meaning } : undefined;
  }

  /** Say what a name means in notation, such as "owner-generic: ~Eadric, town"; the name itself stays. Empty text clears it. The key is a burg's, state's, province's, river's or feature's. A rename clears it, so set it after */
  setMeaning(key: string, text: string): void {
    const ref = MapEntities.resolveKey(key);
    if (!ref) throw new Error(`Entity ${key} does not exist`);
    const named = MapEntities.get(ref) as { meaning?: Meaning };
    const baseId = this.baseOf(ref);
    if (baseId === undefined) throw new Error(`The name of ${key} has no meaning`);
    if (typeof text !== "string") throw new Error("The meaning must be text");
    if (text.trim()) named.meaning = Meanings.read(text, baseId);
    else delete named.meaning;
  }

  /** Set what a place's name says, or clear it; the name itself stays as it is */
  setMeaningOf(type: PlaceType, id: number, meaning?: Meaning): void {
    const place = this.namings[type].find(id);
    if (!place || place.removed) throw new Error(`There is no ${type} ${id}`);
    place.meaning = meaning;
  }

  /** The culture in whose tongue a thing is named; nothing for what has no meaning */
  cultureOf({ type, id }: EntityRef): number | undefined {
    return Object.hasOwn(this.namings, type) ? this.namings[type as PlaceType].culture(id) : undefined;
  }

  /** The base a thing's name is said in; nothing for what has no meaning */
  baseOf(ref: EntityRef): string | undefined {
    if (ref.type === "feature" && pack.features[ref.id]?.type === "ocean") return NameBases.sea;
    const culture = this.cultureOf(ref);
    return culture === undefined ? undefined : pack.cultures[culture]?.base;
  }

  /** The culture in whose tongue a feature is named: on a lake's shore, on an island's first cell */
  private cultureOfFeature({ type, shoreline, firstCell }: Feature): number {
    return pack.cells.culture[(type === "lake" && shoreline?.[0]) || firstCell];
  }

  /** Name the rivers that are not locked, each on a random sequence of its own */
  nameRivers(rivers: River[]): void {
    const taken = new Set<string | undefined>(rivers.filter(river => river.lock).map(river => river.name));
    for (const river of rivers) {
      if (river.lock) continue;
      Object.assign(
        river,
        this.drawFor("river", river.i, () => this.river(river, { taken }))
      );
      taken.add(river.name);
    }
  }

  /** A meaning for a river and its name in the base of the culture at its mouth, or in the base given:
   * a proper name, or what its water looks like */
  river(river: River, { taken = new Set(pack.rivers.map(({ name }) => name)), baseId }: PlaceOptions = {}): Coined {
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
      return [pattern, [Sites.pickConcept("modifier", site, base)!, ra(waters)]];
    });
    return named ?? proper(() => Names.getWater(base.id), base, taken);
  }

  /** A meaning for a sea and its name: a describing word or the side of the map it lies on, in no people's tongue
   * unless a base is given. Its noun, sea or gulf, stands apart */
  sea(sea: Feature, baseId = NameBases.sea): Coined {
    const word = P(SEA_DESCRIBED) ? ra(SEA_WORDS) : this.getSide(sea.firstCell);
    const meaning: Meaning = { pattern: "description", tokens: [word], origin: baseId };
    return { name: Meanings.render(meaning, baseId), meaning };
  }

  /** A meaning for a lake and its name in the base of the culture on its shore, or in the base given */
  private lake(lake: Feature, { taken = this.featureNames(), baseId }: PlaceOptions = {}): Coined {
    const { base, site } = this.getGround(lake.shoreline?.[0] || lake.firstCell, baseId);
    const waters = Lexicon.spoken(
      base,
      lake.cells < POOL_CELLS ? ["pool", "pool", "tarn", "lake", "eye"] : ["lake", "lake", "lake", "water", "eye"]
    );

    const named = this.coin(base, taken, () => {
      const pattern = this.pickPattern(base, ["simplex", "modifier-generic", "owner-generic"], WATER_SHARE);
      const first: Token =
        pattern === "owner-generic" ? `~${Names.getPerson(base.id)}` : Sites.pickConcept("modifier", site, base)!;
      return [pattern, pattern === "simplex" ? [`~${Names.getWater(base.id)}`] : [first, ra(waters)]];
    });
    return named ?? proper(() => Names.getWater(base.id), base, taken);
  }

  /** A meaning for an island and its name in the base of the culture on its first cell: an island of some kind or
   * of someone's. A continent is named as a land */
  private island(island: Feature, { taken = this.featureNames(), baseId }: PlaceOptions = {}): Coined {
    const { base, site } = this.getGround(island.firstCell, baseId);
    const root = () => this.getLandRoot(base);
    if (island.subtype === "continent") return this.coinLand(base, taken, site, root, { size: "middle", land: "land" });

    const named = this.coin(base, taken, () => {
      const pattern = this.pickPattern(base, ["modifier-generic", "owner-generic"]);
      return [pattern, [pattern === "owner-generic" ? root() : Sites.pickConcept("modifier", site, base)!, "island"]];
    });
    return named ?? this.coinLand(base, taken, site, root, { size: "small" });
  }

  /** What a cell offers a name, and the base to say it in: the one given, or that of the culture at a cell */
  private getGround(cell: number, baseId?: string, namedAt = cell): { base: NameBase; site: Site } {
    const culture = pack.cells.culture[namedAt] ?? 0;
    const [x, y] = pack.cells.p[cell];
    const base = NameBases.resolve(baseId ?? pack.cultures[culture]?.base);
    return { base, site: Sites.read({ cell, x, y, culture }) };
  }

  /** The first of the meanings drawn whose name may be taken */
  private coin(base: NameBase, taken: Taken, draw: () => [Pattern, Token[]]): Coined | undefined {
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
  private getCapitalRoot(meaning?: Meaning): Token | undefined {
    if (meaning?.pattern !== "owner-generic" && meaning?.pattern !== "generic-of") return undefined;
    return P(CAPITAL_ROOT) ? meaning.tokens.find(isRoot) : undefined;
  }

  // a state's own people, where no other state is named after them: Shwazen, or Portuz of Portuzian
  private getPeopleRoot(cultureId: number): Token | undefined {
    const name = cultureId ? pack.cultures[cultureId].name : "";
    if (!/^\p{L}{3,}$/u.test(name)) return undefined;
    const root: Token = `~${name.replace(ADJECTIVE, "")}`;
    return pack.states.some(({ meaning, removed }) => !removed && meaning?.tokens[0] === root) ? undefined : root;
  }

  // the side of the map a cell is on
  private getSide(cell: number): Concept {
    const [x, y] = pack.cells.p[cell];
    const { width, height } = options.map.graph;
    const [dx, dy] = [x / width - 0.5, y / height - 0.5];
    return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "west" : "east") : dy < 0 ? "north" : "south";
  }

  // who a land or an island is named after: a person, or a people
  private getLandRoot(base: NameBase): Token {
    if (P(FOUNDED)) return `~${Names.getPerson(base.id)}`;
    for (let attempt = 0; ; attempt++) {
      const stem = Names.getStem(base.id);
      if (attempt >= TRIES || !Lexicon.isPlaceWord(stem.toLowerCase(), base)) return `~${stem}`; // no Land of Town
    }
  }

  /** Render a meaning and take the name when it is free, long enough and no longer than the base allows */
  private accept(meaning: Meaning, base: NameBase, taken: Taken, min = base.length[0]): Coined | undefined {
    // a name taken is drawn again with other forms of the same meaning
    for (const salt of [0, 1, 2]) {
      const salted = salt ? { ...meaning, salt } : meaning;
      const { name, whole } = Meanings.compose(salted, base);
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

  /** The river or lake a burg stands by, as a root for its name in a base, with the pool of what stands by it */
  private getWater(
    burg: Burg,
    site: Site,
    base: NameBase
  ): { root: Token; pool: PoolName; after: PlaceRef } | undefined {
    const { cells, rivers, features } = pack;
    const river = site.stream || site.river ? rivers.find(river => river.i === cells.r[burg.cell]) : undefined;
    if (river?.name && !/[ -]/.test(river.name))
      return {
        root: this.borrow(river.name, pack.cells.culture[river.mouth], base),
        pool: "riverside",
        after: { type: "river", id: river.i }
      };
    const lake = site.lake ? features[cells.f[cells.haven[burg.cell]]] : undefined;
    if (!lake?.name || /[ -]/.test(lake.name)) return undefined; // a name of two words is no root
    return {
      root: this.borrow(lake.name, this.cultureOfFeature(lake), base),
      pool: "shore",
      after: { type: "feature", id: lake.i }
    };
  }

  /** A name as a root for another in a base: one a culture of another base gave is adapted */
  private borrow(name: string, culture: number, base: NameBase): Token {
    const isOwn = NameBases.entry(pack.cultures[culture]?.base).id === base.id;
    return `~${isOwn ? name : Appropriation.adopt(name, base)}`;
  }

  /** The nearest named burg of the same culture close by, and how this burg stands to it */
  private getNeighbor(
    burg: Burg,
    burgs: Burg[],
    base: NameBase
  ): { root: Token; modifier: Concept; after: PlaceRef } | undefined {
    const reach = (options.map.graph.width + options.map.graph.height) / NEIGHBOR_SHARE;
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
      Math.abs(climb) >= LEVEL_CLIMB ? (heights[burg.cell] > heights[nearest.cell] ? "upper" : "lower") : undefined;
    const modifier = overseas ? "new" : ra<Concept>([direction, direction, level ?? "new", "little"]);
    const akin = OPPOSITES.find(group => group.includes(modifier))!;
    if (nearest.meaning?.tokens.some(token => (akin as Token[]).includes(token))) return undefined; // no Little Littlestead or West Southby
    return { root: this.borrow(nearest.name!, burg.culture!, base), modifier, after: { type: "burg", id: nearest.i } };
  }

  // what a burg's place offers a name, its size by its group
  private getSite(burg: Place & Pick<Burg, "group">): Site {
    return Sites.read(burg, this.getSettlement(burg));
  }

  /** Draw a pattern by the base's weights; with a share, proper names take what the share leaves */
  private pickPattern(base: NameBase, patterns: Pattern[], share?: number): Pattern {
    if (share !== undefined) return P(share) ? this.pickPattern(base, without(patterns, "simplex")) : "simplex";
    return pickBy(patterns, pattern => Lexicon.patternWeight(base, pattern));
  }

  /** The share of a base's burg names that end in what the burg is by its group */
  settledShare(base: NameBase): number {
    return NameBases.inherited(base, ({ settled }) => settled) ?? SETTLED;
  }

  /** A meaning no place stands behind and its name: what a base makes of names, for its editor to show. A pattern or
   * a concept to say may be asked for */
  sample(base: NameBase, { pattern, concept }: SampleOptions = {}): Coined {
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
      "owner-generic": () => [`~${Names.getPerson(base.id)}`, generic()],
      "generic-of": () => [generic(), `~${Names.getWater(base.id)}`],
      compound: () => [modifier(), any("generic", TERRAIN), any("settlement")],
      relative: () => [modifier(), `~${Names.getBase(base.id)}`],
      description: () => [modifier()],
      "root-land": () => [this.getLandRoot(base), land()],
      "modifier-land": () => [modifier(), land()]
    };
    const meaning: Meaning = { pattern: layout, tokens: fill[layout](), origin: base.id };
    return { name: Meanings.render(meaning, base.id), meaning };
  }

  /** A land's name and meaning, as `sample` */
  sampleLand(base: NameBase): Coined {
    return this.sample(base, { pattern: this.pickPattern(base, LAND_PATTERNS) });
  }
}

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

/** A name that says nothing but itself, drawn again while it is taken */
function proper(draw: () => string, base: NameBase, taken: Taken): Coined {
  let name = draw();
  for (let attempt = 1; attempt < TRIES && taken.has(name); attempt++) name = draw();
  return { name, meaning: Meanings.simplex(name, base.id) };
}

const without = <T>(items: T[], item: T) => items.filter(other => other !== item);

const withAfter = (meaning: Meaning, after?: PlaceRef): Meaning => (after ? { ...meaning, after } : meaning);

export const Toponyms = new ToponymsGenerator();
