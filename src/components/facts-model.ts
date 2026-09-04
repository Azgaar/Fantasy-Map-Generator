import { type FactsData, factsSchema } from "@/components/facts-schema";
import { applyPin, pinnedFactKeys } from "@/components/pinnable";
import { Burgs } from "@/generators/burgs-generator";
import { DEFAULT_COASTLINE } from "@/generators/coastline-generator";
import { Labels } from "@/generators/labels-generator";
import { Names } from "@/generators/names-generator";
import { isLocked, lockedValue } from "@/utils/preferences";
import { gauss, P, rand } from "@/utils/probabilityUtils";
import { parseSections } from "@/utils/schemaUtils";

declare global {
  var Facts: FactsModel;
  var facts: FactsData;
}

export function getDefaultFacts(): FactsData {
  return {
    seed: "",
    graph: { width: 1280, height: 800, points: 10000 },
    geography: {
      mapSize: 100,
      latitude: 50,
      longitude: 50,
      coordinates: { latT: 180, latN: 90, latS: -90, lonT: 320, lonW: -160, lonE: 160 }
    },
    climate: {
      temperature: { equator: 27, northPole: -30, southPole: -15 },
      precipitation: 100,
      winds: [225, 45, 225, 315, 135, 315]
    },
    cultures: { set: "world" },
    lore: { name: "", description: "", calendar: { year: 1000, era: "Era", eraShort: "E" } },
    units: {
      distance: { unit: isImperial() ? "mi" : "km", scale: 3 },
      area: { unit: "square" },
      height: { unit: isImperial() ? "ft" : "m", exponent: 2 },
      temperature: { unit: isFahrenheit() ? "\u00B0F" : "\u00B0C" },
      population: { scale: 1000, urbanization: { rate: 1, density: 10 } }
    },
    labels: { resizeOnZoom: true, showAll: false, groups: [] },
    style: { preset: "default" },
    military: { units: [] },
    transports: [],
    burgs: { groups: [] },
    coastline: { ...DEFAULT_COASTLINE }
  };
}

globalThis.facts = getDefaultFacts();

// declarations, not consts: `getDefaultFacts` runs above them while this module is evaluating
function locale(): string {
  return typeof navigator === "undefined" ? "" : navigator.language;
}

/** the US and the UK measure distance and altitude in miles and feet; only the US reads \u00B0F */
function isImperial(): boolean {
  return ["en-US", "en-GB"].includes(locale());
}

function isFahrenheit(): boolean {
  return locale() === "en-US";
}

/** Validate an untrusted settings object from a `.map`, repairing what it can */
function parse(json: unknown): FactsData {
  return parseSections<FactsData>(factsSchema, getDefaultFacts(), json, "Facts.parse");
}

/**
 * Take a parsed object as the facts of the map now on screen. Replaces wholesale: a section the
 * file lacked comes back as its default, never as the previous map's value
 */
function adopt(data: FactsData): void {
  globalThis.facts = data;
  ensureDefinitionSets();
}

/**
 * A definition set entities reference by name cannot be empty, or the map draws nothing for the
 * names they point at. A file that carries none gets the module defaults - never the previous
 * map's set, and never the user's library, which seeds new maps only
 */
function ensureDefinitionSets(): void {
  const current = globalThis.facts;
  if (!current.burgs.groups?.length) current.burgs.groups = Burgs.getDefaultGroups();
  if (!current.labels.groups?.length) current.labels.groups = Labels.getDefaultGroups();
  // these two are window globals registered by eager generators, so they may not be up yet at
  // boot; both self-heal on first read, so an early miss here costs nothing
  if (!current.military.units?.length) current.military.units = globalThis.Military?.getDefaultOptions() ?? [];
  if (!current.transports?.length) current.transports = globalThis.Transports?.getDefaults() ?? [];
}

/**
 * Change what is true about this map. Callers are generators, derivations and the editors that
 * own a fact - never a panel that merely stages a value for the next map
 */
function set(change: (facts: FactsData) => void): void {
  change(globalThis.facts);
}

/**
 * Establish the facts a new map starts from: the defaults, the requests the user resolved, the
 * values they pinned, and their own definition sets. The pipeline overwrites the rest as it runs.
 * Called after `Options.randomize`, so the requests it reads are already rolled
 */
function seedForNewMap(): void {
  const seed = globalThis.facts.seed; // setSeed resolved it and reseeded the PRNG before the roll
  const fresh = getDefaultFacts();
  const { generation } = globalThis.options;

  // only what the map keeps being read for: the graph it was built on, the terrain it was raised
  // from, the name set its cultures came out of. The counts, rates and varieties stay requests
  fresh.seed = seed;
  const { width, height, density } = generation.graph;
  fresh.graph = { width, height, points: Options.cellsFor(density) };
  fresh.cultures = { set: generation.cultures.set };

  // the user's own sets, carried over; a generator fills in its module defaults when there is none
  const military = Options.recall("military");
  const transports = Options.recall("transports");
  const burgGroups = Options.recall("burgGroups");
  const labelGroups = Options.recall("labelGroups");
  const coastline = Options.recall("coastline");
  if (military) fresh.military.units = military;
  if (transports) fresh.transports = transports;
  if (burgGroups) fresh.burgs.groups = burgGroups;
  if (labelGroups) fresh.labels.groups = labelGroups;
  if (coastline) fresh.coastline = coastline;

  globalThis.facts = fresh;
  ensureDefinitionSets(); // whatever the library did not supply falls back to the module defaults
  rollUnpinnedFacts();
  applyPinnedFacts();
}

/** Facts with no request of their own are rolled here, the way requests are rolled in Options */
function rollUnpinnedFacts(): void {
  const ignorePins = new URL(window.location.href).searchParams.get("options") === "default";
  const roll = (key: string) => ignorePins || !isLocked(key);
  const { climate, units, lore } = globalThis.facts;

  if (roll("temperatureEquator")) climate.temperature.equator = gauss(25, 7, 20, 35, 0);
  if (roll("temperatureNorthPole")) climate.temperature.northPole = gauss(-25, 7, -40, 10, 0);
  if (roll("temperatureSouthPole")) climate.temperature.southPole = gauss(-15, 7, -40, 10, 0);
  if (roll("prec")) climate.precipitation = gauss(100, 40, 5, 500);
  if (roll("distanceScale")) units.distance.scale = gauss(3, 1, 1, 5);
  if (roll("year")) lore.calendar.year = rand(100, 2000);
  if (roll("era")) {
    lore.calendar.era = randomEra();
    lore.calendar.eraShort = shortEra();
  }
}

/**
 * Put every pinned fact back, so a pin outlives both a new map and a loaded one. Only facts: a
 * pinned request was already resolved into `options` before this map was seeded from it, and
 * writing one here would land after the fact it feeds had been read
 */
function applyPinnedFacts(): void {
  if (new URL(window.location.href).searchParams.get("options") === "default") return;
  for (const key of pinnedFactKeys()) {
    const value = lockedValue(key);
    if (value !== undefined) applyPin(key, value);
  }
}

function randomEra(): string {
  return `${Names.getBaseShort(P(0.7) ? 1 : rand(Names.nameBases.length))} Era`;
}

function shortEra(): string {
  return globalThis.facts.lore.calendar.era
    .split(" ")
    .filter(Boolean)
    .map(word => word[0].toUpperCase())
    .join("");
}

// biome-ignore lint/suspicious/noRedeclare: legacy seam
export const Facts = {
  parse,
  adopt,
  set,
  seedForNewMap,
  randomEra,
  shortEra,
  getDefaults: getDefaultFacts
};

type FactsModel = typeof Facts;
globalThis.Facts = Facts;
