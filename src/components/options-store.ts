// The options store: the configured values themselves and nothing else
import type { ThreeDOptions } from "@/data/view-3d-options";
import { defaultOptions as threeDDefaults } from "@/data/view-3d-options";
import { Burgs } from "@/generators/burgs-generator";
import type { CoastlineSettings } from "@/generators/coastline-generator";
import { Labels } from "@/generators/labels-generator";
import type { Transport } from "@/generators/transports-generator";
import { tradeAnimation } from "@/renderers/trade-animation";
import type { MilitaryUnit } from "@/types/Military";

declare global {
  var options: OptionsData;
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
export const DEFAULT_DENSITY = 4;

export const STORAGE_KEY = "fmg-options";

export type OptionsData = ReturnType<typeof getDefaultOptions>;

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
      longitude: 50, // West-East map shift in %, 50 is centered on prime meridian
      coordinates: { latT: 180, latN: 90, latS: -90, lonT: 320, lonW: -160, lonE: 160 } // derived from the three values above by Coordinates.calculate()
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

// biome-ignore lint/suspicious/noRedeclare: legacy seam
export const options: OptionsData = getDefaultOptions();
globalThis.options = options;
