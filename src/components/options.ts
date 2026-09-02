// The single source of truth for everything the user configures
import { heightmapTemplates } from "@/data/heightmap-templates";
import type { ThreeDOptions } from "@/data/view-3d-options";
import { defaultOptions as threeDDefaults } from "@/data/view-3d-options";
import { Burgs } from "@/generators/burgs-generator";
import type { CoastlineSettings } from "@/generators/coastline-generator";
import { CULTURE_SETS } from "@/generators/cultures-generator";
import type { LabelGroup } from "@/generators/labels-generator";
import { Labels } from "@/generators/labels-generator";
import { Names } from "@/generators/names-generator";
import type { Transport } from "@/generators/transports-generator";
import { tradeAnimation } from "@/renderers/trade-animation";
import type { BurgGroup } from "@/types/burg-groups";
import type { MilitaryUnit } from "@/types/Military";
import { rn } from "@/utils/numberUtils";
import { isLocked, setLocks } from "@/utils/preferences";
import { gauss, P, rand, rw } from "@/utils/probabilityUtils";
import { safeParseJSON } from "@/utils/stringUtils";

declare global {
  var options: OptionsModule;
}

/** cells the grid is built from, per density step of the Points slider */
export const CELLS_BY_DENSITY: Record<number, number> = {
  1: 1000,
  2: 2000,
  3: 5000,
  4: 10000,
  5: 20000,
  6: 30000,
  7: 40000,
  8: 50000,
  9: 60000,
  10: 70000,
  11: 80000,
  12: 90000,
  13: 100000
};

const DEFAULT_DENSITY = 4;

/** Everything the user configured last session, kept as one object under a single key */
const STORAGE_KEY = "options";

/** What is in that key, empty on a first visit or after a data cleanup */
function readStored(): Record<string, any> {
  return safeParseJSON(localStorage.getItem(STORAGE_KEY) ?? "") || {};
}

function isUS() {
  return navigator.language === "en-US";
}

export class OptionsModule {
  /** The string the PRNG is seeded with: the same seed and canvas size reproduce the same map */
  seed = "";

  graph = {
    width: 960,
    height: 540,
    density: DEFAULT_DENSITY, // step of the Points slider
    cellsDesired: CELLS_BY_DENSITY[DEFAULT_DENSITY]
  };

  heightmap = {
    template: "", // template or precreated heightmap id, picked on the first generation
    resolveDepressionsSteps: 250,
    lakeElevationLimit: 20
  };

  geography = {
    mapSize: 100, // map size in % of the world
    latitude: 50, // North-South map shift in %, 50 is centered on equator
    longitude: 50 // West-East map shift in %, 50 is centered on prime meridian
  };

  climate = {
    temperature: { equator: 27, northPole: -30, southPole: -15 },
    precipitation: 100, // modifier in %
    winds: [225, 45, 225, 315, 135, 315]
  };

  lore = {
    name: "", // the map's name, generated with it and editable in the panel
    calendar: { year: 1000, era: "Era", eraShort: "E" }
  };

  cultures = {
    set: "world",
    limit: 12,
    sizeVariety: 4,
    growthRate: 1
  };

  states = {
    limit: 18,
    sizeVariety: 4,
    growthRate: 1,
    growthModifier: 1 // transient, the States Editor slider while it recalculates
  };

  provinces = { ratio: 20 };

  religions = { limit: 6 };

  burgs = {
    limit: 1000, // 1000 means "auto"
    showMapPreview: true,
    groups: Burgs.getDefaultGroups() as BurgGroup[]
  };

  units = {
    distance: { unit: isUS() ? "mi" : "km", scale: 3 },
    area: { unit: "square" },
    height: { unit: isUS() ? "ft" : "m", exponent: 1.8 },
    temperature: { unit: isUS() ? "°F" : "°C" },
    population: { scale: 1000, urbanization: { rate: 1, density: 10 } }
  };

  labels = Labels.getDefaultOptions() as {
    resizeOnZoom: boolean;
    showAll: boolean;
    groups: LabelGroup[];
  };

  notes = { pinned: false };

  emblems = { showAll: false };

  trade = { animation: tradeAnimation.getDefaultOptions() };

  threeD: ThreeDOptions = { ...threeDDefaults };

  military: MilitaryUnit[] = [];

  transports: Transport[] = [];

  coastline!: CoastlineSettings;

  /** Overlay the options of the last session, then the search params, on the defaults */
  restoreStored(): void {
    migrateLegacyStore();
    this.restore(readStored());

    // search params win over both stored and default values
    const params = new URL(window.location.href).searchParams;
    const width = +(params.get("width") ?? 0);
    const height = +(params.get("height") ?? 0);
    if (width) this.graph.width = width;
    if (height) this.graph.height = height;

    // a zero-sized window (hidden or headless tab) would produce a degenerate grid
    if (!isLocked("mapWidth") || !isLocked("mapHeight")) {
      this.graph.width = window.innerWidth || 1280;
      this.graph.height = window.innerHeight || 800;
    }
    if (this.graph.width <= 0) this.graph.width = 1280;
    if (this.graph.height <= 0) this.graph.height = 800;
  }

  /**
   * Adopt a stored settings object: the copy this browser keeps, or the one a `.map` file carries.
   * Deep, so a source that holds only part of a group (an old `burgs.limit` with no `burgs.groups`)
   * does not wipe the rest of it
   */
  restore(saved: Record<string, unknown>): void {
    deepMerge(this as unknown as Record<string, unknown>, saved);
  }

  /** Keep the current options as the starting point of the next session */
  store(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this));
  }

  /**
   * Re-roll every option the user has not pinned. `options=default` in the URL ignores the pins too.
   * Runs before each generation, so a new map differs from the last unless the user asked otherwise
   */
  randomize(): void {
    const ignorePins = new URL(window.location.href).searchParams.get("options") === "default";
    const roll = (key: string) => ignorePins || !isLocked(key);

    // a loaded map's migrated group registries are map data, not session preferences: re-seed
    // from the same source boot uses, so new maps get the user's saved groups or the defaults
    const preferences = readStored();
    this.burgs.groups = preferences.burgs?.groups ?? Burgs.getDefaultGroups();
    this.labels = preferences.labels ?? Labels.getDefaultOptions();

    if (roll("points")) this.setDensity(DEFAULT_DENSITY); // a default, not a roll
    if (roll("template")) this.heightmap.template = randomTemplate();
    if (roll("statesNumber")) this.states.limit = gauss(18, 5, 2, 30);
    if (roll("provincesRatio")) this.provinces.ratio = gauss(20, 10, 20, 100);
    if (roll("manors")) this.burgs.limit = 1000; // auto
    if (roll("religionsNumber")) this.religions.limit = gauss(6, 3, 2, 10);
    if (roll("sizeVariety")) this.setSizeVariety(gauss(4, 2, 0, 10, 1));
    if (roll("growthRate")) this.setGrowthRate(rn(1 + Math.random(), 1));
    if (roll("cultures")) this.cultures.limit = gauss(12, 3, 5, 30);
    if (roll("culturesSet")) this.cultures.set = randomCultureSet();

    const temperature = this.climate.temperature;
    if (roll("temperatureEquator")) temperature.equator = gauss(25, 7, 20, 35, 0);
    if (roll("temperatureNorthPole")) temperature.northPole = gauss(-25, 7, -40, 10, 0);
    if (roll("temperatureSouthPole")) temperature.southPole = gauss(-15, 7, -40, 10, 0);
    if (roll("prec")) this.climate.precipitation = gauss(100, 40, 5, 500);
    if (roll("distanceScale")) this.units.distance.scale = gauss(3, 1, 1, 5);

    this.generateEra();
  }

  setDensity(density: number): void {
    this.graph.density = density;
    this.graph.cellsDesired = CELLS_BY_DENSITY[density] ?? this.graph.cellsDesired;
  }

  /** One panel slider drives both, until the UI offers them separately */
  setGrowthRate(rate: number): void {
    this.cultures.growthRate = this.states.growthRate = rate;
  }

  /** One panel slider drives both, until the UI offers them separately */
  setSizeVariety(variety: number): void {
    this.cultures.sizeVariety = this.states.sizeVariety = variety;
  }

  setEra(era: string): void {
    this.lore.calendar.era = era;
    this.lore.calendar.eraShort = era
      .split(" ")
      .map(word => word[0].toUpperCase())
      .join("");
  }

  /** A fresh era name, drawn from the name bases */
  randomEra(): string {
    return `${Names.getBaseShort(P(0.7) ? 1 : rand(Names.nameBases.length))} Era`;
  }

  /** Roll the in-world date, unless the user pinned one */
  generateEra(): void {
    if (!isLocked("year")) this.lore.calendar.year = rand(100, 2000);
    this.setEra(isLocked("era") ? this.lore.calendar.era : this.randomEra());
  }

  get isAutoBurgLimit(): boolean {
    return this.burgs.limit === 1000;
  }
}

/** A setting the panel shows, and how to read or write it on the options tree */
export type Setting = {
  key: string; // the id the panel input carries in `data-stored`, and the key a lock is kept under
  get: (options: OptionsModule) => string | number;
  set: (options: OptionsModule, value: string) => void;
};

/**
 * Settings the options tab shows. The input it renders for one is `<key>Input` or `<key>`, with an
 * optional `<key>Output` mirror, and `data-stored="<key>"` is what ties the control to the setting
 */
export const PANEL_SETTINGS: Setting[] = [
  { key: "seed", get: o => o.seed, set: (o, v) => (o.seed = v) },
  { key: "mapName", get: o => o.lore.name, set: (o, v) => (o.lore.name = v) },
  { key: "mapWidth", get: o => o.graph.width, set: (o, v) => (o.graph.width = +v) },
  { key: "mapHeight", get: o => o.graph.height, set: (o, v) => (o.graph.height = +v) },
  { key: "template", get: o => o.heightmap.template, set: (o, v) => (o.heightmap.template = v) },
  {
    key: "resolveDepressionsSteps",
    get: o => o.heightmap.resolveDepressionsSteps,
    set: (o, v) => (o.heightmap.resolveDepressionsSteps = +v)
  },
  {
    key: "lakeElevationLimit",
    get: o => o.heightmap.lakeElevationLimit,
    set: (o, v) => (o.heightmap.lakeElevationLimit = +v)
  },
  { key: "year", get: o => o.lore.calendar.year, set: (o, v) => (o.lore.calendar.year = +v) },
  { key: "era", get: o => o.lore.calendar.era, set: (o, v) => o.setEra(v) },
  { key: "cultures", get: o => o.cultures.limit, set: (o, v) => (o.cultures.limit = +v) },
  { key: "culturesSet", get: o => o.cultures.set, set: (o, v) => (o.cultures.set = v) },
  { key: "statesNumber", get: o => o.states.limit, set: (o, v) => (o.states.limit = +v) },
  { key: "growthRate", get: o => o.states.growthRate, set: (o, v) => o.setGrowthRate(+v) },
  { key: "sizeVariety", get: o => o.states.sizeVariety, set: (o, v) => o.setSizeVariety(+v) },
  { key: "provincesRatio", get: o => o.provinces.ratio, set: (o, v) => (o.provinces.ratio = +v) },
  { key: "manors", get: o => o.burgs.limit, set: (o, v) => (o.burgs.limit = +v) },
  { key: "religionsNumber", get: o => o.religions.limit, set: (o, v) => (o.religions.limit = +v) },
  { key: "heightExponent", get: o => o.units.height.exponent, set: (o, v) => (o.units.height.exponent = +v) },
  { key: "populationRate", get: o => o.units.population.scale, set: (o, v) => (o.units.population.scale = +v) },
  {
    key: "urbanization",
    get: o => o.units.population.urbanization.rate,
    set: (o, v) => (o.units.population.urbanization.rate = +v)
  },
  {
    key: "urbanDensity",
    get: o => o.units.population.urbanization.density,
    set: (o, v) => (o.units.population.urbanization.density = +v)
  },
  { key: "distanceScale", get: o => o.units.distance.scale, set: (o, v) => (o.units.distance.scale = +v) },
  { key: "distanceUnit", get: o => o.units.distance.unit, set: (o, v) => (o.units.distance.unit = v) },
  { key: "heightUnit", get: o => o.units.height.unit, set: (o, v) => (o.units.height.unit = v) },
  { key: "areaUnit", get: o => o.units.area.unit, set: (o, v) => (o.units.area.unit = v) },
  { key: "temperatureScale", get: o => o.units.temperature.unit, set: (o, v) => (o.units.temperature.unit = v) }
];

/** Settings the World Configurator owns: locked the same way, but that dialog renders them itself */
const WORLD_SETTINGS: Setting[] = [
  {
    key: "temperatureEquator",
    get: o => o.climate.temperature.equator,
    set: (o, v) => (o.climate.temperature.equator = +v)
  },
  {
    key: "temperatureNorthPole",
    get: o => o.climate.temperature.northPole,
    set: (o, v) => (o.climate.temperature.northPole = +v)
  },
  {
    key: "temperatureSouthPole",
    get: o => o.climate.temperature.southPole,
    set: (o, v) => (o.climate.temperature.southPole = +v)
  },
  { key: "prec", get: o => o.climate.precipitation, set: (o, v) => (o.climate.precipitation = +v) },
  { key: "mapSize", get: o => o.geography.mapSize, set: (o, v) => (o.geography.mapSize = +v) },
  { key: "latitude", get: o => o.geography.latitude, set: (o, v) => (o.geography.latitude = +v) },
  { key: "longitude", get: o => o.geography.longitude, set: (o, v) => (o.geography.longitude = +v) }
];

/** The sub-objects that used to be kept as a stringified value of their own */
const LEGACY_GROUPS: [key: string, apply: (value: any) => void][] = [
  ["military", value => (options.military = value)],
  ["burg-groups", value => (options.burgs.groups = value)],
  ["options-labels", value => (options.labels = value)],
  ["trade-animation", value => (options.trade.animation = value)],
  ["coastline-settings", value => (options.coastline = value)],
  ["options-transports", value => (options.transports = value)]
];

/**
 * Adopt the options of a browser that still keeps a key per setting: fold the values into the
 * single stored object, and turn the keys that held one into the locks they used to stand for
 */
function migrateLegacyStore(): void {
  if (localStorage.getItem(STORAGE_KEY)) return;

  const locks: string[] = [];
  const take = (key: string) => {
    const value = localStorage.getItem(key);
    localStorage.removeItem(key);
    return value;
  };

  for (const { key, set } of [...PANEL_SETTINGS, ...WORLD_SETTINGS]) {
    const value = take(key);
    if (value === null) continue;
    set(options, value);
    locks.push(key);
  }

  const density = take("points");
  if (density !== null) {
    options.setDensity(+density);
    locks.push("points");
  }

  const winds = take("winds");
  if (winds) options.climate.winds = winds.split(",").map(Number);

  for (const [key, apply] of LEGACY_GROUPS) {
    const value = safeParseJSON(take(key) ?? "");
    if (value) apply(value);
  }

  if (locks.length) setLocks(locks);
  options.store();
}

/** weighted by how good each template looks, so the common ones come up more often */
function randomTemplate(): string {
  const probabilities: Record<string, number> = {};
  for (const [id, template] of Object.entries(heightmapTemplates)) probabilities[id] = template.probability || 0;
  return rw(probabilities);
}

function randomCultureSet(): string {
  return rw(Object.fromEntries(Object.entries(CULTURE_SETS).map(([id, set]) => [id, set.probability])));
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue; // the file does not carry it: keep what we have
    const current = target[key];
    if (isPlainObject(current) && isPlainObject(value)) deepMerge(current, value);
    else target[key] = value;
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// biome-ignore lint/suspicious/noRedeclare: legacy seam
export const options = new OptionsModule();
globalThis.options = options;
