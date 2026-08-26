import type { LabelGroup } from "@/generators/labels-generator";
import type { ThreeDOptions } from "../data/view-3d-options";
import type { CoastlineSettings } from "../generators/coastline-generator";
import type { GoodsModule } from "../generators/goods-generator";
import type { MarketsModule } from "../generators/markets-generator";
import type { ProductionModule } from "../generators/production-generator";
import type { BurgGroup } from "./burg-groups";
import type { GridGraph } from "./GridGraph";
import type { PackedGraph } from "./PackedGraph";
import type { Style } from "./style";

declare global {
  var MOBILE: boolean;

  /**
   * Migrated helpers, reachable ONLY as `window.X` — deliberately not `var`, so that bare `X`
   * in a bundled module is a compile error. src/ imports what it calls; these entries exist so
   * the owning module can register the bridge and classic public/ code can keep calling it.
   * When the last classic caller of one is gone, delete the entry and its `window.X =` line.
   */
  interface Window {
    tip: typeof import("../components/tooltips").tip;
    clearMainTip: typeof import("../components/tooltips").clearMainTip;
    showDataTip: typeof import("../components/tooltips").showDataTip;
    showElementLockTip: typeof import("../components/tooltips").showElementLockTip;
    lock: typeof import("../utils/preferences").lock;
    unlock: typeof import("../utils/preferences").unlock;
    stored: typeof import("../utils/preferences").stored;
    applyDefaultViewboxEvents: typeof import("../components/viewbox-events").applyDefaultViewboxEvents;
    fitLegendBox: typeof import("../renderers/draw-legend").fitLegendBox;
    clearLegend: typeof import("../renderers/draw-legend").clearLegend;
    unfog: typeof import("../renderers/overlays/fogging").unfog;
    showInfo: typeof import("../components/app-info").showInfo;
    applyOption: typeof import("../utils").applyOption;
    closeDialogs: typeof import("../components/dialog/dialog-helpers").closeDialogs;
    confirmationDialog: typeof import("../components/dialog/dialog-helpers").confirmationDialog;
    downloadFile: typeof import("../utils").downloadFile;
    uploadFile: typeof import("../utils").uploadFile;
    panMap: typeof import("../components/zoom").panMap;
    setMapZoom: typeof import("../components/zoom").setMapZoom;
    changeMapZoom: typeof import("../components/zoom").changeMapZoom;
    setZoomExtent: typeof import("../components/zoom").setZoomExtent;
    setTranslateExtent: typeof import("../components/zoom").setTranslateExtent;
  }

  var mapId: number;
  var seed: string;
  var pack: PackedGraph;
  var grid: GridGraph;
  var graphHeight: number;
  var graphWidth: number;
  var TIME: boolean;
  var INFO: boolean;
  var WARN: boolean;
  var ERROR: boolean;
  var DEBUG: { stateLabels?: boolean; [key: string]: boolean | undefined };
  var options: Options;

  var Goods: GoodsModule;
  var Production: ProductionModule;
  var Markets: MarketsModule;
  var populationRate: number;
  var urbanDensity: number;
  var urbanization: number;
  var distanceScale: number;

  var pointsInput: HTMLInputElement;
  var culturesInput: HTMLInputElement;
  var culturesSet: HTMLSelectElement;
  var heightExponentInput: HTMLInputElement;
  var alertMessage: HTMLElement;
  var mapName: HTMLInputElement;
  var religionsNumber: HTMLInputElement;
  var distanceUnitInput: HTMLInputElement;
  var heightUnit: HTMLSelectElement;
  var areaUnit: HTMLInputElement;
  var stylePreset: HTMLSelectElement;
  var temperatureScale: HTMLSelectElement;

  // Global variables defined in main.js
  var scale: number;
  var viewX: number;
  var viewY: number;

  var getColorScheme: (scheme: string | null) => (t: number) => string;
  var getColor: (height: number, scheme: (t: number) => string) => string;
  var svgWidth: number;
  var svgHeight: number;

  var notes: any[]; // TODO: correct type
  var style: Style;

  // IO / loading helpers defined in classic public/ scripts
  var ldb: {
    get: (key: string) => Promise<Blob | undefined>;
    set: (key: string, value: Blob) => Promise<void>;
  };
  var Dropbox: any; // dropbox-sdk global, loaded on demand from libs/dropbox-sdk.min.js
  var mapHistory: { created: number; [key: string]: unknown }[];
  var customPresetPrefix: string;

  var focusOn: () => void;
  var fitMapToScreen: () => void;
  var regenerateMap: (reason?: string) => void;
  var generateMapOnLoad: () => void;
  var addCustomColorScheme: (scheme: string) => void;
  var updateTextureSelectValue: (href: string) => void;
  var calculateFriendlyGridSize: () => void;
  // heightmap editor globals
  var color: (value: number) => string;
  var edits: any; // heightmap edit history: Uint8Array[] with an extra .n cursor
  var undraw: () => void;
  var changeViewMode: (event?: Event) => void;
  var resetZoom: (duration?: number) => void;
  var RgbQuant: any; // external RgbQuant image-quantization lib

  var shiftCompass: () => void;

  var invokeActiveZooming: () => void;
  var FlatQueue: any;

  var THREE: any; // lazy-loaded

  var $: (selector: any) => any;
  var changeFont: () => void;
  var logStats: () => void;
  var applyGraphSize: () => void;
  var cellsDensityMap: Record<number, number>;
  var changeCellsDensity: (value: string) => void;
  var getCellsDensityColor: (cells: number) => string;
  var showExportPane: () => void;
  var customization: number;
  var zoomTo: (x: number, y: number, zoom?: number, duration?: number) => void;
  var modules: Record<string, boolean>;

  // Legacy UI globals
  var toggleOptions: (event?: Event) => void;
  var hideOptions: (event?: Event) => void;
  var isCtrlClick: (event: MouseEvent) => boolean;
  var editStyle: (layer: string, group?: string) => void;
  var capitalize: (str: string) => string;
  var rn: (value: number, decimals?: number) => number;
  var openURL: (url: string) => void;

  var tinymce:
    | {
        _setBaseUrl: (url: string) => void;
        init: (config: Record<string, unknown>) => void;
        remove: () => void;
        activeEditor?: { getContent: () => string; setContent: (content: string) => void };
      }
    | undefined;

  var aleaPRNG: (seed: string | number) => () => number;
  var heightmapColorSchemes: Record<string, unknown>;
  var regeneratePrompt: (options?: { seed?: string; graph?: any }) => void;

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

type Options = {
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
  trade: {
    animation: ReturnType<typeof TradeAnimation.getDefaultOptions>;
  };
  emblems: { showAll: boolean };
  coastline: CoastlineSettings;
  threeD: ThreeDOptions;
};

export type Point = [number, number];
