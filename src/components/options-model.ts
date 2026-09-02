// The options model: the only thing that changes the store
import { CELLS_BY_DENSITY, DEFAULT_DENSITY, type OptionsData, options, STORAGE_KEY } from "@/components/options-store";
import { heightmapTemplates } from "@/data/heightmap-templates";
import { Burgs } from "@/generators/burgs-generator";
import { CULTURE_SETS } from "@/generators/cultures-generator";
import { Labels } from "@/generators/labels-generator";
import { Names } from "@/generators/names-generator";
import { rn } from "@/utils/numberUtils";
import { deepMerge } from "@/utils/objectUtils";
import { isLocked } from "@/utils/preferences";
import { gauss, P, rand, rw } from "@/utils/probabilityUtils";
import { safeParseJSON } from "@/utils/stringUtils";

declare global {
  var Options: OptionsModel;
}

export class OptionsModel {
  SAVE_DELAY = 500;
  saveTimer = 0;

  /** Change the options and remember them */
  set(change: (options: OptionsData) => void): void {
    change(options);
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.persist(), this.SAVE_DELAY);
  }

  /** Overlay the options of the last session, then the search params, on the defaults */
  restoreStored(): void {
    this.restore(readStored());

    if (!isLocked("mapWidth")) options.graph.width = window.innerWidth;
    if (!isLocked("mapHeight")) options.graph.height = window.innerHeight;

    if (!(options.graph.width > 0)) options.graph.width = 1280;
    if (!(options.graph.height > 0)) options.graph.height = 800;
  }

  /** Adopt a stored settings object, without remembering it: the caller decides what to store */
  restore(saved: Record<string, unknown>): void {
    deepMerge(options, saved);
  }

  /** Write the options to localStore */
  persist(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = 0;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  }

  /** Re-roll every option the user has not pinned */
  randomize(): void {
    const ignorePins = new URL(window.location.href).searchParams.get("options") === "default";
    const roll = (key: string) => ignorePins || !isLocked(key);

    const preferences = readStored();
    options.burgs.groups = preferences.burgs?.groups ?? Burgs.getDefaultGroups();
    options.labels = preferences.labels ?? Labels.getDefaultOptions();

    if (roll("points")) this.setDensity(DEFAULT_DENSITY); // a default, not a roll
    if (roll("template")) options.heightmap.template = randomTemplate();
    if (roll("statesNumber")) options.states.limit = gauss(18, 5, 2, 30);
    if (roll("provincesRatio")) options.provinces.ratio = gauss(20, 10, 20, 100);
    if (roll("manors")) options.burgs.limit = 1000; // auto
    if (roll("religionsNumber")) options.religions.limit = gauss(6, 3, 2, 10);
    if (roll("sizeVariety")) this.setSizeVariety(gauss(4, 2, 0, 10, 1));
    if (roll("growthRate")) {
      const rate = rn(1 + Math.random(), 1);
      options.states.growthRate = rate;
      options.cultures.growthRate = rate;
    }
    if (roll("cultures")) options.cultures.limit = gauss(12, 3, 5, 30);
    if (roll("culturesSet")) options.cultures.set = randomCultureSet();

    const temperature = options.climate.temperature;
    if (roll("temperatureEquator")) temperature.equator = gauss(25, 7, 20, 35, 0);
    if (roll("temperatureNorthPole")) temperature.northPole = gauss(-25, 7, -40, 10, 0);
    if (roll("temperatureSouthPole")) temperature.southPole = gauss(-15, 7, -40, 10, 0);
    if (roll("prec")) options.climate.precipitation = gauss(100, 40, 5, 500);
    if (roll("distanceScale")) options.units.distance.scale = gauss(3, 1, 1, 5);

    if (roll("year")) options.lore.calendar.year = rand(100, 2000);
    if (roll("era")) {
      options.lore.calendar.era = this.randomEra();
      options.lore.calendar.eraShort = this.shortEra();
    }
  }

  setDensity(density: number): void {
    options.graph.density = density;
    options.graph.cellsDesired = CELLS_BY_DENSITY[density] ?? options.graph.cellsDesired;
  }

  /** One panel slider drives both, until the UI offers them separately */
  setSizeVariety(variety: number): void {
    options.cultures.sizeVariety = options.states.sizeVariety = variety;
  }

  randomEra(): string {
    return `${Names.getBaseShort(P(0.7) ? 1 : rand(Names.nameBases.length))} Era`;
  }

  shortEra(): string {
    return options.lore.calendar.era
      .split(" ")
      .filter(Boolean)
      .map(word => word[0].toUpperCase())
      .join("");
  }

  get isAutoBurgLimit(): boolean {
    return options.burgs.limit === 1000;
  }
}

/** What the browser kept from the last session, empty on a first visit or after a data cleanup */
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
export const Options = new OptionsModel();
globalThis.Options = Options;
