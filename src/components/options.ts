// Global generation and UI settings: what the user configured, as opposed to what was generated.
// Survives regeneration and is partly persisted to localStorage; `options.js` still owns the panel
// that edits it and `applyStoredOptions`, which overlays the stored values on top of these defaults
import type { ThreeDOptions } from "@/data/view-3d-options";
import { defaultOptions as threeDDefaults } from "@/data/view-3d-options";
import { Burgs } from "@/generators/burgs-generator";
import type { CoastlineSettings } from "@/generators/coastline-generator";
import type { LabelGroup } from "@/generators/labels-generator";
import { Labels } from "@/generators/labels-generator";
import type { Transport } from "@/generators/transports-generator";
import { tradeAnimation } from "@/renderers/trade-animation";
import type { BurgGroup } from "@/types/burg-groups";
import { ensureEl } from "@/utils/nodeUtils";
import { safeParseJSON } from "@/utils/stringUtils";

const restored = <T>(key: string, fallback: () => T): T => safeParseJSON(localStorage.getItem(key) ?? "") || fallback();

declare global {
  var options: Options;
  // seeded from the options panel inputs below, then edited in the Units Editor
  var populationRate: number;
  var urbanDensity: number;
  var urbanization: number;
  var distanceScale: number;

  type MilitaryUnit = {
    icon: string;
    name: string;
    rural: number;
    urban: number;
    crew: number;
    power: number;
    type: string;
    separate: number;
    biomes?: number[];
    states?: number[];
    cultures?: number[];
    religions?: number[];
  };
}

// a bare assignment would throw in a module: the property has to be created on globalThis first
globalThis.options = {
  pinNotes: false,
  winds: [225, 45, 225, 315, 135, 315],
  temperatureEquator: 27,
  temperatureNorthPole: -30,
  temperatureSouthPole: -15,
  mapSize: 100, // map size in % of the world
  latitude: 50, // North-South map shift in %, 50 is centered on equator
  longitude: 50, // West-East map shift in %, 50 is centered on prime meridian
  prec: 100, // precipitation modifier in %
  showBurgPreview: true,
  burgs: { groups: restored("burg-groups", () => Burgs.getDefaultGroups()) },
  labels: restored("options-labels", () => Labels.getDefaultOptions()),
  emblems: { showAll: false },
  trade: { animation: restored("trade-animation", () => tradeAnimation.getDefaultOptions()) },
  threeD: { ...threeDDefaults }
} as Options;

/**
 * Population and distance scales are edited in the Units Editor and read bare by generators.
 * Seeded from the inputs before `applyStoredOptions` runs, matching the legacy boot order
 */
export function readScaleInputs(): void {
  globalThis.populationRate = +ensureEl<HTMLInputElement>("populationRateInput").value;
  globalThis.distanceScale = +ensureEl<HTMLInputElement>("distanceScaleInput").value;
  globalThis.urbanization = +ensureEl<HTMLInputElement>("urbanizationInput").value;
  globalThis.urbanDensity = +ensureEl<HTMLInputElement>("urbanDensityInput").value;
}

export type Options = {
  year: number;
  era: string;
  eraShort: string;
  pinNotes: boolean;
  winds: number[];
  temperatureEquator: number;
  temperatureNorthPole: number;
  temperatureSouthPole: number;
  mapSize: number; // map size in % of the world
  latitude: number; // North-South map shift in %, 50 is centered on equator
  longitude: number; // West-East map shift in %, 50 is centered on prime meridian
  prec: number; // precipitation modifier in %
  showBurgPreview: boolean;
  burgs: { groups: BurgGroup[] };
  labels: { resizeOnZoom: boolean; showAll: boolean; groups: LabelGroup[] };
  military: MilitaryUnit[];
  transports: Transport[];
  trade: {
    animation: ReturnType<typeof TradeAnimation.getDefaultOptions>;
  };
  emblems: { showAll: boolean };
  coastline: CoastlineSettings;
  threeD: ThreeDOptions;
};
