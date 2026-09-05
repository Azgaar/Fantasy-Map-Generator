import { type FactsData, factsSchema } from "@/components/facts-schema";
import { applyPin, pinnedFactKeys } from "@/components/settings";
import { Burgs } from "@/generators/burgs-generator";
import { DEFAULT_COASTLINE } from "@/generators/coastline-generator";
import { Labels } from "@/generators/labels-generator";
import { Military } from "@/generators/military-generator";
import { Names } from "@/generators/names-generator";
import { Transports } from "@/generators/transports-generator";
import { ignoresPins, lockedValue, rolls } from "@/utils/preferences";
import { gauss, P, rand } from "@/utils/probabilityUtils";
import { parseSections } from "@/utils/schemaUtils";

declare global {
  var Facts: FactsModel;
  /** what is true about the map on screen, written where the map changes and saved to the file */
  var facts: FactsData;
}

/** A new map before anything has run: every value present, each from the module that owns it */
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
      temperature: { unit: isFahrenheit() ? "°F" : "°C" },
      population: { scale: 1000, urbanization: { rate: 1, density: 10 } }
    },
    labels: { resizeOnZoom: true, groups: Labels.getDefaultGroups() },
    style: { preset: "default" },
    military: { units: Military.getDefaultOptions() },
    transports: Transports.getDefaults(),
    burgs: { groups: Burgs.getDefaultGroups() },
    coastline: { ...DEFAULT_COASTLINE }
  };
}

globalThis.facts = getDefaultFacts();

// declarations, not consts: `getDefaultFacts` runs above them while this module is evaluating
function locale(): string {
  return typeof navigator === "undefined" ? "" : navigator.language;
}

/** the US and the UK measure distance and altitude in miles and feet; only the US reads °F */
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

/** A set entities reference by name cannot be empty, or the names they point at draw nothing */
function ensureDefinitionSets(): void {
  const defaults = getDefaultFacts();
  if (!facts.burgs.groups?.length) facts.burgs.groups = defaults.burgs.groups;
  if (!facts.labels.groups?.length) facts.labels.groups = defaults.labels.groups;
  if (!facts.military.units?.length) facts.military.units = defaults.military.units;
  if (!facts.transports?.length) facts.transports = defaults.transports;
}

/**
 * Establish the facts a new map starts from: the defaults, the requests the user resolved, the
 * values they pinned, and their own definition sets. The pipeline overwrites the rest as it runs.
 * Called after `Options.randomize`, so the requests it reads are already rolled
 */
function seedForNewMap(): void {
  const seed = facts.seed; // setSeed resolved it and reseeded the PRNG before the roll
  const fresh = getDefaultFacts();
  const { generation } = options;

  // only what the map keeps being read for: the graph it was built on, the terrain it was raised
  // from, the name set its cultures came out of. The counts, rates and varieties stay requests
  fresh.seed = seed;
  const { width, height, density } = generation.graph;
  fresh.graph = { width, height, points: Options.cellsFor(density) };
  fresh.cultures = { set: generation.cultures.set };

  // the user's own sets, carried over; the module defaults stand where they saved none
  fresh.military.units = Options.recall("military") ?? fresh.military.units;
  fresh.transports = Options.recall("transports") ?? fresh.transports;
  fresh.burgs.groups = Options.recall("burgGroups") ?? fresh.burgs.groups;
  fresh.labels.groups = Options.recall("labelGroups") ?? fresh.labels.groups;
  fresh.coastline = Options.recall("coastline") ?? fresh.coastline;

  globalThis.facts = fresh;
  ensureDefinitionSets(); // a set the user emptied falls back to the module defaults
  rollUnpinnedFacts();
  applyPinnedFacts();
}

/** Facts with no request of their own are rolled here, the way requests are rolled in Options */
function rollUnpinnedFacts(): void {
  const { climate, units, lore } = facts;

  if (rolls("temperatureEquator")) climate.temperature.equator = gauss(25, 7, 20, 35, 0);
  if (rolls("temperatureNorthPole")) climate.temperature.northPole = gauss(-25, 7, -40, 10, 0);
  if (rolls("temperatureSouthPole")) climate.temperature.southPole = gauss(-15, 7, -40, 10, 0);
  if (rolls("prec")) climate.precipitation = gauss(100, 40, 5, 500);
  if (rolls("distanceScale")) units.distance.scale = gauss(3, 1, 1, 5);
  if (rolls("year")) lore.calendar.year = rand(100, 2000);
  if (rolls("era")) {
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
  if (ignoresPins()) return;
  for (const key of pinnedFactKeys()) {
    const value = lockedValue(key);
    if (value !== undefined) applyPin(key, value);
  }
}

function randomEra(): string {
  return `${Names.getBaseShort(P(0.7) ? 1 : rand(Names.nameBases.length))} Era`;
}

function shortEra(): string {
  return facts.lore.calendar.era
    .split(" ")
    .filter(Boolean)
    .map(word => word[0].toUpperCase())
    .join("");
}

// biome-ignore lint/suspicious/noRedeclare: legacy seam
export const Facts = {
  parse,
  adopt,
  seedForNewMap,
  randomEra,
  shortEra,
  getDefaults: getDefaultFacts
};

type FactsModel = typeof Facts;
globalThis.Facts = Facts;
