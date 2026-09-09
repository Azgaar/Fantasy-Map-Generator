// All app configuration options, options.map saved to `.map` file as settings; docs/architecture/configuration.md
import { adoptLegacyOptions } from "@/components/options-legacy";
import { AUTO_BURG_LIMIT, type MapData, mapSchema, type OptionsData, optionsSchema } from "@/components/options-schema";
import { Pins } from "@/components/pins";
import { DEFAULT_DENSITY, getPointsNumber } from "@/data/graph-density";
import { heightmapTemplates } from "@/data/heightmap-templates";
import { DEFAULT_TRADE_ANIMATION } from "@/data/trade-animation-options";
import { DEFAULT_THREE_D } from "@/data/view-3d-options";
import { Burgs } from "@/generators/burgs-generator";
import { Coastline } from "@/generators/coastline-generator";
import { Coordinates } from "@/generators/coordinates";
import { CULTURE_SETS } from "@/generators/cultures-generator";
import { Labels } from "@/generators/labels-generator";
import { Military } from "@/generators/military-generator";
import { Names } from "@/generators/names-generator";
import { Transports } from "@/generators/transports-generator";
import { safeParseJSON } from "@/utils";
import { rn } from "@/utils/numberUtils";
import { deepMerge } from "@/utils/objectUtils";
import { gauss, rand, rw } from "@/utils/probabilityUtils";
import { parseSections } from "@/utils/schemaUtils";

declare global {
  var Options: OptionsModel;
  /** what this browser wants, read bare across the app and replaced wholesale on restore */
  var options: OptionsData;
}

export const STORAGE_KEY = "fmg-options";
export const DEFAULT_THEME_COLOR = "#997787";
const SAVE_DELAY = 500;

const locale = () => (typeof navigator === "undefined" ? "" : navigator.language);
const isImperial = () => ["en-US", "en-GB"].includes(locale());

class OptionsModel {
  private saveTimer = 0;

  /** A fresh browser's options: every value present, each from the module that owns it */
  getDefaultOptions(): OptionsData {
    return {
      map: {
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
          temperature: { unit: locale() === "en-US" ? "°F" : "°C" },
          population: { scale: 1000, urbanization: { rate: 1, density: 10 } }
        },
        style: { preset: "default" },
        burgs: { groups: Burgs.getDefaultGroups() },
        labels: { resizeOnZoom: true, groups: Labels.getDefaultGroups() },
        military: { units: Military.getDefaultOptions() },
        transports: Transports.getDefaults(),
        coastline: Coastline.getDefaultSettings()
      },
      generation: {
        graph: { width: 1280, height: 800, density: DEFAULT_DENSITY },
        geography: { mapSize: null, latitude: null, longitude: null },
        template: "",
        resolveDepressionsSteps: 250,
        lakeElevationLimit: 20,
        cultures: { limit: 12, set: "world", sizeVariety: 4, growthRate: 1 },
        states: { limit: 18, sizeVariety: 4, growthRate: 1 },
        provinces: { ratio: 20 },
        religions: { limit: 6 },
        burgs: { limit: 1000 }
      },
      app: {
        notesPinned: false,
        emblems: { showAll: false, shape: "culture" },
        labels: { showAll: false },
        rendering: "optimizeSpeed",
        viewportRedraw: "continuous",
        onLoad: "random",
        zoomExtent: { min: 1, max: 20 },
        viewport: null,
        autosave: { interval: 15, remind: true },
        ui: {
          size: null,
          tooltipSize: 14,
          themeColor: DEFAULT_THEME_COLOR,
          transparency: 5,
          assistant: "show",
          speakerVoice: ""
        },
        export: { pngResolution: 1, tiles: { cols: 8, rows: 8, scale: 1 } },
        trade: { animation: structuredClone(DEFAULT_TRADE_ANIMATION) },
        threeD: structuredClone(DEFAULT_THREE_D)
      }
    };
  }

  /** Change the options and remember them */
  set(change: (config: OptionsData) => void): void {
    change(options);
    this.save();
  }

  /** Remember options changed in place, once the changes stop coming */
  save(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.persist(), SAVE_DELAY);
  }

  /** Write the options to localStorage immediately */
  persist(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = 0;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  }

  /** Throw this browser's options away and start from the defaults: a reset, never a repair */
  reset(): void {
    options = this.getDefaultOptions();
    this.persist();
  }

  /** Boot: adopt what this browser kept from the last session, validated and repaired */
  restore(): void {
    let stored: Record<string, unknown> = {};
    const parsed = safeParseJSON(localStorage.getItem(STORAGE_KEY) ?? "");
    if (typeof parsed === "object" && parsed !== null) stored = parsed;

    const source = deepMerge(this.getDefaultOptions(), adoptLegacyOptions() ?? {});
    deepMerge(source, stored);

    options = parseSections<OptionsData>(optionsSchema, this.getDefaultOptions(), source, "Options.restore");
    this.repairSets();
    this.setGraphSize(Pins.valueOr("mapWidth", window.innerWidth), Pins.valueOr("mapHeight", window.innerHeight));
    this.persist();
  }

  /** Resolve the next extent; an omitted size keeps the current request, including a loaded map's */
  setGraphSize(width?: number, height?: number): void {
    const { graph } = options.generation;

    graph.width = width ?? Pins.valueOr("mapWidth", graph.width);
    graph.height = height ?? Pins.valueOr("mapHeight", graph.height);

    // a hidden or headless tab reports no size, which would make a degenerate grid
    if (!(graph.width > 0)) graph.width = 1280;
    if (!(graph.height > 0)) graph.height = 800;
  }

  /** Establish new map settings */
  randomize(): void {
    const { generation } = options;
    const { graph, cultures, states, provinces, religions, burgs } = generation;

    // the slider holds a density step; the cell count it stands for is derived where it is used
    graph.density = Pins.rolls("points") ? DEFAULT_DENSITY : Pins.valueOr("points", graph.density);
    generation.resolveDepressionsSteps = Pins.valueOr("resolveDepressionsSteps", generation.resolveDepressionsSteps);
    generation.lakeElevationLimit = Pins.valueOr("lakeElevationLimit", generation.lakeElevationLimit);
    generation.geography = {
      mapSize: Pins.valueOr<number | null>("mapSize", null),
      latitude: Pins.valueOr<number | null>("latitude", null),
      longitude: Pins.valueOr<number | null>("longitude", null)
    };

    generation.template = Pins.rolls("template")
      ? this.randomTemplate()
      : Pins.valueOr("template", generation.template);
    states.limit = Pins.rolls("statesNumber") ? gauss(18, 5, 2, 30) : Pins.valueOr("statesNumber", states.limit);
    provinces.ratio = Pins.rolls("provincesRatio")
      ? gauss(20, 10, 20, 100)
      : Pins.valueOr("provincesRatio", provinces.ratio);
    burgs.limit = Pins.rolls("manors") ? AUTO_BURG_LIMIT : Pins.valueOr("manors", burgs.limit);
    religions.limit = Pins.rolls("religionsNumber")
      ? gauss(6, 3, 2, 10)
      : Pins.valueOr("religionsNumber", religions.limit);

    // one panel slider drives states and cultures alike, until the UI offers them separately
    const variety = Pins.rolls("sizeVariety") ? gauss(4, 2, 0, 10, 1) : Pins.valueOr("sizeVariety", states.sizeVariety);
    const growth = Pins.rolls("growthRate") ? rn(1 + Math.random(), 1) : Pins.valueOr("growthRate", states.growthRate);
    states.sizeVariety = cultures.sizeVariety = variety;
    states.growthRate = cultures.growthRate = growth;

    cultures.limit = Pins.rolls("cultures") ? gauss(12, 3, 5, 30) : Pins.valueOr("cultures", cultures.limit);
    cultures.set = Pins.rolls("culturesSet") ? this.randomCultureSet() : Pins.valueOr("culturesSet", cultures.set);
    this.capCultures();

    // keep the resolved seed, the active style preset and the user's definition sets
    const previous = options.map;
    const map = this.getDefaultOptions().map;
    map.seed = previous.seed;
    map.style = previous.style;
    map.burgs.groups = previous.burgs.groups;
    map.labels.groups = previous.labels.groups;
    map.military.units = previous.military.units;
    map.transports = previous.transports;
    map.coastline = previous.coastline;

    // and the requests it consumes
    map.graph = { width: graph.width, height: graph.height, points: getPointsNumber(graph.density) };
    map.cultures.set = cultures.set;
    options.map = map;
    this.repairSets();

    const { climate, units, lore } = map;
    const { temperature } = climate;

    temperature.equator = Pins.rolls("temperatureEquator")
      ? gauss(25, 7, 20, 35, 0)
      : Pins.valueOr("temperatureEquator", temperature.equator);
    temperature.northPole = Pins.rolls("temperatureNorthPole")
      ? gauss(-25, 7, -40, 10, 0)
      : Pins.valueOr("temperatureNorthPole", temperature.northPole);
    temperature.southPole = Pins.rolls("temperatureSouthPole")
      ? gauss(-15, 7, -40, 10, 0)
      : Pins.valueOr("temperatureSouthPole", temperature.southPole);
    climate.precipitation = Pins.rolls("prec") ? gauss(100, 40, 5, 500) : Pins.valueOr("prec", climate.precipitation);
    units.distance.scale = Pins.rolls("distanceScale")
      ? gauss(3, 1, 1, 5)
      : Pins.valueOr("distanceScale", units.distance.scale);
    lore.calendar.year = Pins.rolls("year") ? rand(100, 2000) : Pins.valueOr("year", lore.calendar.year);

    if (Pins.rolls("era")) {
      lore.calendar.era = Names.getEra();
      lore.calendar.eraShort = Names.getEraShort(lore.calendar.era);
    } else {
      lore.calendar.era = Pins.valueOr("era", lore.calendar.era);
      lore.calendar.eraShort = Pins.valueOr("eraShort", lore.calendar.eraShort);
    }

    lore.name = Pins.rolls("mapName") ? Names.getMapName() : Pins.valueOr("mapName", lore.name);
    units.distance.unit = Pins.valueOr("distanceUnit", units.distance.unit);
    units.area.unit = Pins.valueOr("areaUnit", units.area.unit);
    units.height.unit = Pins.valueOr("heightUnit", units.height.unit);
    units.height.exponent = Pins.valueOr("heightExponent", units.height.exponent);
    units.temperature.unit = Pins.valueOr("temperatureScale", units.temperature.unit);
    units.population.scale = Pins.valueOr("populationRate", units.population.scale);
    units.population.urbanization.rate = Pins.valueOr("urbanization", units.population.urbanization.rate);
    units.population.urbanization.density = Pins.valueOr("urbanDensity", units.population.urbanization.density);
  }

  /** A culture set holds a fixed number of cultures: the map cannot ask for more than it has */
  capCultures(): void {
    const { cultures } = options.generation;
    const max = CULTURE_SETS[cultures.set]?.max;
    if (max && cultures.limit > max) cultures.limit = max;
  }

  /** weighted by how good each template looks, so the common ones come up more often */
  private randomTemplate(): string {
    const probabilities: Record<string, number> = {};
    for (const [id, template] of Object.entries(heightmapTemplates)) probabilities[id] = template.probability || 0;
    return rw(probabilities);
  }

  private randomCultureSet(): string {
    return rw(Object.fromEntries(Object.entries(CULTURE_SETS).map(([id, set]) => [id, set.probability])));
  }

  /** Take the settings of a `.map` being opened */
  applyLoaded(json: unknown): void {
    const coordinates = (json as Partial<MapData> | null)?.geography?.coordinates;
    options.map = parseSections<MapData>(mapSchema, this.getDefaultOptions().map, json, "Options.applyLoaded");
    if (!mapSchema.shape.geography.shape.coordinates.safeParse(coordinates).success) Coordinates.calculate();
    this.repairSets();

    if (Pins.rolls("mapWidth")) options.generation.graph.width = options.map.graph.width;
    if (Pins.rolls("mapHeight")) options.generation.graph.height = options.map.graph.height;
  }

  /** A set the map's entities name by must never be empty: the module that owns it answers for it */
  private repairSets(): void {
    const { map } = options;
    const defaults = this.getDefaultOptions().map;
    if (!map.burgs.groups.length) map.burgs.groups = defaults.burgs.groups;
    if (!map.labels.groups.length) map.labels.groups = defaults.labels.groups;
    if (!map.military.units.length) map.military.units = defaults.military.units;
    if (!map.transports.length) map.transports = defaults.transports;

    Burgs.ensureDefaultGroup(map.burgs.groups);
    Labels.restoreMissingTypes(map.labels.groups);
  }
}

// biome-ignore lint/suspicious/noRedeclare: legacy seam, as in styles.ts
export const Options = new OptionsModel();
globalThis.Options = Options;
globalThis.options = Options.getDefaultOptions();
