// The single source of truth for everything the user configures: what a map is generated from, as
// opposed to what generation produced. Survives regeneration, is partly persisted to localStorage,
// and is never read back out of the DOM - the options panel is a view over this object, not its home.
// The shape follows the `settings` block of docs/architecture/future_data_model.md.
import { heightmapTemplates } from "@/data/heightmap-templates";
import { precreatedHeightmaps } from "@/data/precreated-heightmaps";
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
import { applyOption, findEl } from "@/utils/nodeUtils";
import { rn } from "@/utils/numberUtils";
import { stored } from "@/utils/preferences";
import { gauss, P, rand, rw } from "@/utils/probabilityUtils";
import { safeParseJSON } from "@/utils/stringUtils";

declare global {
  var options: OptionsModule;
}

const restored = <T>(key: string, fallback: () => T): T => safeParseJSON(localStorage.getItem(key) ?? "") || fallback();

const isUS = () => navigator.language === "en-US";

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

/**
 * The options a map is generated from, and the operations over them. State and behaviour live
 * together: `options` is an instance, so `options.climate.winds` and `options.randomize()` both work.
 * Only the data fields are own properties, so `JSON.stringify(options)` still yields plain settings
 */
export class OptionsModule {
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
    groups: restored("burg-groups", () => Burgs.getDefaultGroups()) as BurgGroup[]
  };

  units = {
    distance: { unit: "mi", scale: 3 },
    area: { unit: "square" },
    height: { unit: "ft", exponent: 1.8 },
    temperature: { unit: "°F" },
    population: { scale: 1000, urbanization: { rate: 1, density: 10 } }
  };

  labels = restored("options-labels", () => Labels.getDefaultOptions()) as {
    resizeOnZoom: boolean;
    showAll: boolean;
    groups: LabelGroup[];
  };

  notes = { pinned: false };

  emblems = { showAll: false };

  trade = { animation: restored("trade-animation", () => tradeAnimation.getDefaultOptions()) };

  threeD: ThreeDOptions = { ...threeDDefaults };

  military: MilitaryUnit[] = [];

  transports: Transport[] = [];

  coastline!: CoastlineSettings;

  // ---------------------------------------------------------------- persistence

  /** Overlay the values the user pinned in localStorage, then the search params, on the defaults */
  restoreStored(): void {
    for (const [storedKey, path] of PERSISTED) {
      const value = stored(storedKey);
      if (value !== null) this.write(path, value);
    }

    const density = stored("points");
    if (density) this.setDensity(+density);

    // world configurator values: stored under their own keys, the dialog renders them itself
    const winds = stored("winds");
    if (winds) this.climate.winds = winds.split(",").map(Number);
    for (const [storedKey, path] of WORLD_SETTINGS) {
      const value = stored(storedKey);
      if (value !== null) this.write(path, value);
    }
    const military = stored("military");
    if (military) this.military = safeParseJSON(military);

    if (!stored("distanceUnit")) this.units.distance.unit = isUS() ? "mi" : "km";
    if (!stored("heightUnit")) this.units.height.unit = isUS() ? "ft" : "m";
    if (!stored("temperatureScale")) this.units.temperature.unit = isUS() ? "°F" : "°C";

    // search params win over both stored and default values
    const params = new URL(window.location.href).searchParams;
    const width = +(params.get("width") ?? 0);
    const height = +(params.get("height") ?? 0);
    if (width) this.graph.width = width;
    if (height) this.graph.height = height;

    // a zero-sized window (hidden or headless tab) would produce a degenerate grid
    if (!stored("mapWidth") || !stored("mapHeight")) {
      this.graph.width = window.innerWidth || 1280;
      this.graph.height = window.innerHeight || 800;
    }
    if (this.graph.width <= 0) this.graph.width = 1280;
    if (this.graph.height <= 0) this.graph.height = 800;
  }

  /**
   * Adopt the settings stored in a `.map` file, keeping the current values for anything it lacks.
   * Deep, so a file that carries only part of a group (an old `burgs.limit` with no `burgs.groups`)
   * does not wipe the rest of it
   */
  restoreSaved(saved: Record<string, unknown>): void {
    deepMerge(this as unknown as Record<string, unknown>, isLegacyShape(saved) ? fromLegacyShape(saved) : saved);
  }

  // ---------------------------------------------------------------- the panel

  /** Push every option the panel shows into its input, so the DOM reflects the object */
  syncInputs(): void {
    for (const [storedKey, path] of PERSISTED) {
      if (storedKey === "template") continue; // a select whose options are added on demand, see below

      const value = String(this.read(path));
      const input = inputFor(storedKey);
      if (input) input.value = value;
      const output = findEl<HTMLOutputElement>(`${storedKey}Output`);
      if (output) output.value = value;
    }

    const template = findEl<HTMLSelectElement>("templateInput");
    if (template && this.heightmap.template) {
      applyOption(template, this.heightmap.template, heightmapName(this.heightmap.template));
    }

    const manors = findEl<HTMLOutputElement>("manorsOutput");
    if (manors) manors.value = this.isAutoBurgLimit ? "auto" : String(this.burgs.limit);
  }

  /**
   * Keep the object in step with the panel while the classic markup still owns the inputs.
   * `data-stored` names the option, the same key the panel locks and persists under
   */
  private watchInputs(): void {
    const paths = new Map(PERSISTED);

    const onChange = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      const storedKey = target?.dataset?.stored;
      if (!storedKey) return;

      if (storedKey === "points") return this.setDensity(+target.value);
      const path = paths.get(storedKey);
      if (path) this.write(path, target.value);
    };

    for (const id of ["options", "dialogs"]) {
      const root = findEl(id);
      root?.addEventListener("input", onChange);
      root?.addEventListener("change", onChange);
    }

    // the canvas size inputs are not `data-stored`, the panel persists them by hand
    for (const [id, path] of [
      ["mapWidthInput", "graph.width"],
      ["mapHeightInput", "graph.height"]
    ] as const) {
      findEl(id)?.addEventListener("change", event => this.write(path, (event.target as HTMLInputElement).value));
    }
  }

  // ---------------------------------------------------------------- generation

  /**
   * Re-roll every option the user has not pinned. `options=default` in the URL ignores the pins too.
   * Runs before each generation, so a new map differs from the last unless the user asked otherwise
   */
  randomize(): void {
    const ignorePins = new URL(window.location.href).searchParams.get("options") === "default";
    const roll = (key: string) => ignorePins || !stored(key);

    // a loaded map's migrated group registries are map data, not session preferences: re-seed
    // from the same source boot uses, so new maps get the user's saved groups or the defaults
    this.burgs.groups = restored("burg-groups", () => Burgs.getDefaultGroups());
    this.labels = restored("options-labels", () => Labels.getDefaultOptions());

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

  // ---------------------------------------------------------------- setters

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
    if (!stored("year")) this.lore.calendar.year = rand(100, 2000);
    this.setEra(stored("era") ? this.lore.calendar.era : this.randomEra());
  }

  get isAutoBurgLimit(): boolean {
    return this.burgs.limit === 1000;
  }

  // ---------------------------------------------------------------- path access

  private read(path: string): unknown {
    return path.split(".").reduce<any>((node, key) => node?.[key], this);
  }

  /** Write a stored string into the option at `path`, coerced to the type the default declares */
  private write(path: string, value: string): void {
    const keys = path.split(".");
    const leaf = keys.pop()!;
    const node = keys.reduce<any>((node, key) => node?.[key], this);
    if (!node) return;
    node[leaf] = typeof node[leaf] === "number" ? +value : value;
  }

  constructor() {
    this.watchInputs();
  }
}

/**
 * Options the panel persists, as `[localStorage key, option path]`. The input element id follows the
 * stored key - `<key>Input` or `<key>` - with an optional `<key>Output` mirror, the convention the
 * classic panel already uses. This table is the seam `components/tabs/options-tab.ts` will render from
 */
const PERSISTED: [stored: string, path: string][] = [
  ["mapWidth", "graph.width"],
  ["mapHeight", "graph.height"],
  ["template", "heightmap.template"],
  ["resolveDepressionsSteps", "heightmap.resolveDepressionsSteps"],
  ["lakeElevationLimit", "heightmap.lakeElevationLimit"],
  ["year", "lore.calendar.year"],
  ["era", "lore.calendar.era"],
  ["cultures", "cultures.limit"],
  ["culturesSet", "cultures.set"],
  ["statesNumber", "states.limit"],
  ["growthRate", "states.growthRate"],
  ["sizeVariety", "states.sizeVariety"],
  ["provincesRatio", "provinces.ratio"],
  ["manors", "burgs.limit"],
  ["religionsNumber", "religions.limit"],
  ["heightExponent", "units.height.exponent"],
  ["populationRate", "units.population.scale"],
  ["urbanization", "units.population.urbanization.rate"],
  ["urbanDensity", "units.population.urbanization.density"],
  ["distanceScale", "units.distance.scale"],
  ["distanceUnit", "units.distance.unit"],
  ["heightUnit", "units.height.unit"],
  ["areaUnit", "units.area.unit"],
  ["temperatureScale", "units.temperature.unit"]
];

/** World Configurator values: stored under their own keys, edited in that dialog rather than the panel */
const WORLD_SETTINGS: [stored: string, path: string][] = [
  ["temperatureEquator", "climate.temperature.equator"],
  ["temperatureNorthPole", "climate.temperature.northPole"],
  ["temperatureSouthPole", "climate.temperature.southPole"],
  ["prec", "climate.precipitation"],
  ["mapSize", "geography.mapSize"],
  ["latitude", "geography.latitude"],
  ["longitude", "geography.longitude"]
];

const inputFor = (storedKey: string) =>
  findEl<HTMLInputElement>(`${storedKey}Input`) ?? findEl<HTMLInputElement>(storedKey);

const heightmapName = (id: string): string => heightmapTemplates[id]?.name || precreatedHeightmaps[id]?.name || id;

/** weighted by how good each template looks, so the common ones come up more often */
function randomTemplate(): string {
  const probabilities: Record<string, number> = {};
  for (const [id, template] of Object.entries(heightmapTemplates)) probabilities[id] = template.probability || 0;
  return rw(probabilities);
}

function randomCultureSet(): string {
  return rw(Object.fromEntries(Object.entries(CULTURE_SETS).map(([id, set]) => [id, set.probability])));
}

// ---------------------------------------------------------------- legacy .map files

/** Copy `source` over `target` group by group. Arrays and primitives replace, plain objects merge */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    const current = target[key];
    if (isPlainObject(current) && isPlainObject(value)) deepMerge(current, value);
    else target[key] = value;
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Maps saved before the settings were nested carry a flat object, recognisable by any of these keys */
const isLegacyShape = (saved: Record<string, unknown>) =>
  "mapWidth" in saved || "culturesSet" in saved || "populationRate" in saved;

/** `[flat key, nested path]` for every option a pre-nesting `.map` file may carry */
const LEGACY_PATHS: [flat: string, path: string][] = [
  ["mapWidth", "graph.width"],
  ["mapHeight", "graph.height"],
  ["pointsDensity", "graph.density"],
  ["cellsDesired", "graph.cellsDesired"],
  ["heightmap", "heightmap.template"],
  ["resolveDepressionsSteps", "heightmap.resolveDepressionsSteps"],
  ["lakeElevationLimit", "heightmap.lakeElevationLimit"],
  ["mapSize", "geography.mapSize"],
  ["latitude", "geography.latitude"],
  ["longitude", "geography.longitude"],
  ["temperatureEquator", "climate.temperature.equator"],
  ["temperatureNorthPole", "climate.temperature.northPole"],
  ["temperatureSouthPole", "climate.temperature.southPole"],
  ["prec", "climate.precipitation"],
  ["winds", "climate.winds"],
  ["year", "lore.calendar.year"],
  ["era", "lore.calendar.era"],
  ["eraShort", "lore.calendar.eraShort"],
  ["culturesSet", "cultures.set"],
  ["culturesNumber", "cultures.limit"],
  ["sizeVariety", "cultures.sizeVariety"],
  ["growthRate", "cultures.growthRate"],
  ["statesNumber", "states.limit"],
  ["provincesRatio", "provinces.ratio"],
  ["manorsNumber", "burgs.limit"],
  ["showBurgPreview", "burgs.showMapPreview"],
  ["religionsNumber", "religions.limit"],
  ["pinNotes", "notes.pinned"],
  ["populationRate", "units.population.scale"],
  ["urbanization", "units.population.urbanization.rate"],
  ["urbanDensity", "units.population.urbanization.density"],
  ["distanceScale", "units.distance.scale"],
  ["distanceUnit", "units.distance.unit"],
  ["heightUnit", "units.height.unit"],
  ["areaUnit", "units.area.unit"],
  ["heightExponent", "units.height.exponent"],
  ["temperatureScale", "units.temperature.unit"]
];

function fromLegacyShape(saved: Record<string, unknown>): Record<string, unknown> {
  const nested: Record<string, any> = {};
  const flat = new Set(LEGACY_PATHS.map(([key]) => key));

  // anything already nested (burgs.groups, labels, trade, threeD, military, …) carries over as it is
  for (const [key, value] of Object.entries(saved)) if (!flat.has(key)) nested[key] = value;

  for (const [key, path] of LEGACY_PATHS) {
    if (!(key in saved)) continue;
    const keys = path.split(".");
    const leaf = keys.pop()!;
    let node = nested;
    for (const step of keys) node = node[step] ??= {};
    node[leaf] = saved[key];
  }

  // one slider drove both in the flat shape
  nested.states = {
    ...nested.states,
    sizeVariety: nested.cultures?.sizeVariety,
    growthRate: nested.cultures?.growthRate
  };
  return nested;
}

// biome-ignore lint/suspicious/noRedeclare: legacy seam
export const options = new OptionsModule();
globalThis.options = options;
