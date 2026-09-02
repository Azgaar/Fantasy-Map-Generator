// The single source of truth for everything the user configures
import { heightmapTemplates } from "@/data/heightmap-templates";
import type { ThreeDOptions } from "@/data/view-3d-options";
import { defaultOptions as threeDDefaults } from "@/data/view-3d-options";
import { Burgs } from "@/generators/burgs-generator";
import type { CoastlineSettings } from "@/generators/coastline-generator";
import { CULTURE_SETS } from "@/generators/cultures-generator";
import { Labels } from "@/generators/labels-generator";
import { Names } from "@/generators/names-generator";
import type { Transport } from "@/generators/transports-generator";
import { tradeAnimation } from "@/renderers/trade-animation";
import type { MilitaryUnit } from "@/types/Military";
import { rn } from "@/utils/numberUtils";
import { deepMerge } from "@/utils/objectUtils";
import { isLocked } from "@/utils/preferences";
import { gauss, P, rand, rw } from "@/utils/probabilityUtils";
import { safeParseJSON } from "@/utils/stringUtils";

declare global {
  var Options: OptionsModule;
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

export const STORAGE_KEY = "fmg-options";
const SAVE_DELAY = 250;
let saveTimer = 0;

function getDefaultOptions() {
  return {
    seed: "",
    graph: {
      width: 960,
      height: 540,
      density: DEFAULT_DENSITY, // step of the Points slider
      cellsDesired: CELLS_BY_DENSITY[DEFAULT_DENSITY]
    },
    heightmap: {
      template: "", // template or precreated heightmap id, picked on the first generation
      resolveDepressionsSteps: 250,
      lakeElevationLimit: 20
    },
    geography: {
      mapSize: 100, // map size in % of the world
      latitude: 50, // North-South map shift in %, 50 is centered on equator
      longitude: 50 // West-East map shift in %, 50 is centered on prime meridian
    },
    climate: {
      temperature: { equator: 27, northPole: -30, southPole: -15 },
      precipitation: 100, // modifier in %
      winds: [225, 45, 225, 315, 135, 315]
    },
    lore: {
      name: "", // the map's name, generated with it and editable in the panel
      calendar: { year: 1000, era: "Era", eraShort: "E" }
    },
    cultures: { set: "world", limit: 12, sizeVariety: 4, growthRate: 1 },
    states: {
      limit: 18,
      sizeVariety: 4,
      growthRate: 1,
      growthModifier: 1 // transient, the States Editor slider while it recalculates
    },
    provinces: { ratio: 20 },
    religions: { limit: 6 },
    burgs: {
      limit: 1000, // 1000 means "auto"
      showMapPreview: true,
      groups: Burgs.getDefaultGroups()
    },
    units: {
      distance: { unit: navigator.language === "en-US" ? "mi" : "km", scale: 3 },
      area: { unit: "square" },
      height: { unit: navigator.language === "en-US" ? "ft" : "m", exponent: 1.8 },
      temperature: { unit: navigator.language === "en-US" ? "°F" : "°C" },
      population: { scale: 1000, urbanization: { rate: 1, density: 10 } }
    },
    labels: Labels.getDefaultOptions(),
    notes: { pinned: false },
    emblems: { showAll: false },
    trade: { animation: tradeAnimation.getDefaultOptions() },
    threeD: { ...threeDDefaults } as ThreeDOptions,
    military: [] as MilitaryUnit[],
    transports: [] as Transport[],
    coastline: undefined as unknown as CoastlineSettings
  };
}

/** The options tree: derived from the defaults, so the two can never drift apart */
export type OptionsData = ReturnType<typeof getDefaultOptions>;

export class OptionsModule {
  constructor() {
    Object.assign(this, getDefaultOptions());
  }

  /** Overlay the options of the last session, then the search params, on the defaults */
  restoreStored(): void {
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

  /** Adopt a stored settings object */
  restore(saved: Record<string, unknown>): void {
    deepMerge(this as unknown as Record<string, unknown>, saved);
  }

  /** Change the options and remember them */
  set(change: (options: OptionsModule) => void): void {
    change(this);
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => this.persist(), SAVE_DELAY);
  }

  /** Write the options to localStore */
  persist(): void {
    clearTimeout(saveTimer);
    saveTimer = 0;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this));
  }

  /** Re-roll every option the user has not pinned */
  randomize(): void {
    const ignorePins = new URL(window.location.href).searchParams.get("options") === "default";
    const roll = (key: string) => ignorePins || !isLocked(key);

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
    if (roll("growthRate")) {
      const rate = rn(1 + Math.random(), 1);
      this.states.growthRate = rate;
      this.cultures.growthRate = rate;
    }
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

/** What is in that key, empty on a first visit or after a data cleanup */
function readStored(): Record<string, any> {
  return safeParseJSON(localStorage.getItem(STORAGE_KEY) ?? "") || {};
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

// biome-ignore lint/suspicious/noRedeclare: legacy seam
export const Options = new OptionsModule();
globalThis.Options = Options;
