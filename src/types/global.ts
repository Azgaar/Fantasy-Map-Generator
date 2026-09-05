import type { Selection } from "d3";
import type { LabelGroup } from "@/generators/labels-generator";
import type { ThreeDOptions } from "../data/view-3d-options";
import type { CoastlineSettings } from "../generators/coastline-generator";
import type { GoodsModule } from "../generators/goods-generator";
import type { MarketsModule } from "../generators/markets-generator";
import type { ProductionModule } from "../generators/production-generator";
import type { Transport } from "../generators/transports-generator";
import type { BurgGroup } from "./burg-groups";
import type { GridGraph } from "./GridGraph";
import type { PackedGraph } from "./PackedGraph";

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
    drawBurgIcon: typeof import("../renderers/draw-burg-icons").drawBurgIcon;
    removeBurgIcon: typeof import("../renderers/draw-burg-icons").removeBurgIcon;
    clearMainTip: typeof import("../components/tooltips").clearMainTip;
    showDataTip: typeof import("../components/tooltips").showDataTip;
    showElementLockTip: typeof import("../components/tooltips").showElementLockTip;
    lock: typeof import("../utils/preferences").lock;
    unlock: typeof import("../utils/preferences").unlock;
    stored: typeof import("../utils/preferences").stored;
    applyDefaultViewboxEvents: typeof import("../components/viewbox-events").applyDefaultViewboxEvents;
    redrawLegend: typeof import("../renderers/draw-legend").redrawLegend;
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
    getLabelsData: typeof import("../renderers/labels/label-data").getLabelsData;
    applyVignetteOptions: typeof import("../renderers/draw-vignette").applyVignetteOptions;
    applyOceanPattern: typeof import("../renderers/draw-ocean").applyOceanPattern;
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
  var effectiveLabelPx: (scale: number, startPx: number, restPx: number) => number;
  var labelPxForGroup: (group: string, d: number, scale: number) => number;
  var svgLabelFontSize: (px: number, scale: number) => number;
  var labelTiers: {
    groupRank: (group: string) => number;
    groupMinZoom: (group: string) => number;
  };
  var selectNonOverlapping: (
    boxes: {
      id: string;
      left: number;
      top: number;
      right: number;
      bottom: number;
      weight: number;
    }[]
  ) => Set<string>;

  // Global variables defined in main.js
  var scale: number;
  var viewX: number;
  var viewY: number;

  var getColorScheme: (scheme: string | null) => (t: number) => string;
  var getColor: (height: number, scheme: (t: number) => string) => string;
  var svgWidth: number;
  var svgHeight: number;
  var statesBody: Selection<SVGGElement, unknown, null, undefined>;
  var statesHalo: Selection<SVGGElement, unknown, null, undefined>;
  var emblems: Selection<SVGElement, unknown, null, undefined>;
  var armies: Selection<SVGGElement, unknown, null, undefined>;
  var labels: Selection<SVGGElement, unknown, null, undefined>;
  var terrain: Selection<SVGGElement, unknown, null, undefined>;

  // Renderer bridges registered on window by their owning module (see draw-* renderers)
  var drawLabels: () => void;
  var drawRoutes: () => void;
  var drawRoute: (route: import("../generators/routes-generator").Route) => void;
  // Element globals bound by the compatibility shim in public/main.js (upstream migrated to
  // d3.select("#id") at the point of use). Delete alongside that shim.
  var viewbox: Selection<SVGElement, unknown, null, undefined>;
  var routes: Selection<SVGElement, unknown, null, undefined>;
  var routeTypeStyle: (
    type: string
  ) => { "stroke-width": number; "stroke-dasharray": string | null; "stroke-linecap": string } | undefined;
  var routeGroupStyle: (
    group: string
  ) => { "stroke-width": number; "stroke-dasharray": string | null; "stroke-linecap": string } | undefined;
  var applyRouteLineStyle: (el: Element, fallback: unknown, presetStyle: unknown) => void;
  var readPresetAttrs: (el: Element, attrs: string[]) => Record<string, string>;
  var debug: Selection<SVGElement, unknown, null, undefined>;
  // SVG layer selections reassigned on map load (main.js)
  var scaleBar: Selection<SVGGElement, unknown, null, undefined>;
  var ocean: Selection<SVGGElement, unknown, null, undefined>;
  var oceanPattern: Selection<SVGGElement, unknown, null, undefined>;
  var landmass: Selection<SVGGElement, unknown, null, undefined>;
  var texture: Selection<SVGGElement, unknown, null, undefined>;
  var biomes: Selection<SVGGElement, unknown, null, undefined>;
  var cells: Selection<SVGGElement, unknown, null, undefined>;
  var gridOverlay: Selection<SVGGElement, unknown, null, undefined>;
  var coordinates: Selection<SVGGElement, unknown, null, undefined>;
  var compass: Selection<SVGGElement, unknown, null, undefined>;
  var zones: Selection<SVGGElement, unknown, null, undefined>;
  var borders: Selection<SVGGElement, unknown, null, undefined>;
  var stateBorders: Selection<SVGGElement, unknown, null, undefined>;
  var provinceBorders: Selection<SVGGElement, unknown, null, undefined>;
  var roads: Selection<SVGGElement, unknown, null, undefined>;
  var trails: Selection<SVGGElement, unknown, null, undefined>;
  var searoutes: Selection<SVGGElement, unknown, null, undefined>;
  var airroutes: Selection<SVGGElement, unknown, null, undefined>;
  var prec: Selection<SVGGElement, unknown, null, undefined>;
  var population: Selection<SVGGElement, unknown, null, undefined>;
  var icons: Selection<SVGGElement, unknown, null, undefined>;
  var ruler: Selection<SVGGElement, unknown, null, undefined>;
  var fogging: Selection<SVGGElement, unknown, null, undefined>;
  var notes: any[]; // TODO: correct type
  var styles: import("@/generators/styles-schema").Styles;
  var Styles: typeof import("@/generators/styles")["Styles"];
  var stylesLegacy: typeof import("@/generators/styles-legacy");

  var getArea: (rawArea: number) => number;

  // Dialog fit-content gutter fix, defined in src/components/dialog/fit-content.ts
  var fitContent: () => string;
  var getAreaUnit: (squareMark?: string) => string;
  var getPrecipitation: (prec: number) => string;

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
  var applyStoredStyles: any;

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
  transports: Transport[];
  trade: {
    animation: ReturnType<typeof TradeAnimation.getDefaultOptions>;
  };
  emblems: { showAll: boolean };
  coastline: CoastlineSettings;
  threeD: ThreeDOptions;
};

export type Point = [number, number];
