import type { Selection } from "d3";
import type { GoodsModule } from "../generators/goods-generator";
import type { MarketsModule } from "../generators/markets-generator";
import type { NameBase } from "../generators/names-generator";
import type { ProductionModule } from "../generators/production-generator";
import type { PackedGraph } from "./PackedGraph";

declare global {
  var seed: string;
  var pack: PackedGraph;
  var grid: any;
  var graphHeight: number;
  var graphWidth: number;
  var TIME: boolean;
  var WARN: boolean;
  var ERROR: boolean;
  var DEBUG: { stateLabels?: boolean; [key: string]: boolean | undefined };
  var options: Options;

  var heightmapTemplates: any;
  var Goods: GoodsModule;
  var Production: ProductionModule;
  var Markets: MarketsModule;
  var populationRate: number;
  var urbanDensity: number;
  var urbanization: number;
  var distanceScale: number;
  var nameBases: NameBase[];

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
  var mapSizeOutput: HTMLInputElement;
  var latitudeOutput: HTMLInputElement;
  var longitudeOutput: HTMLInputElement;
  var precOutput: HTMLInputElement;
  var hideLabels: HTMLInputElement;
  var stylePreset: HTMLSelectElement;
  var rescaleLabels: HTMLInputElement;
  var temperatureScale: HTMLSelectElement;

  // Global variables defined in main.js / versioning.js
  var viewX: number;
  var viewY: number;
  var VERSION: string;

  var rivers: Selection<SVGElement, unknown, null, undefined>;
  var oceanLayers: Selection<SVGGElement, unknown, null, undefined>;
  var emblems: Selection<SVGElement, unknown, null, undefined>;
  var goods: Selection<SVGGElement, unknown, null, undefined>;
  var markets: Selection<SVGGElement, unknown, null, undefined>;
  var svg: Selection<SVGSVGElement, unknown, null, undefined>;
  var ice: Selection<SVGGElement, unknown, null, undefined>;
  var labels: Selection<SVGGElement, unknown, null, undefined>;
  var burgLabels: Selection<SVGGElement, unknown, null, undefined>;
  var burgIcons: Selection<SVGGElement, unknown, null, undefined>;
  var anchors: Selection<SVGGElement, unknown, null, undefined>;
  var terrs: Selection<SVGGElement, unknown, null, undefined>;
  var temperature: Selection<SVGGElement, unknown, null, undefined>;
  var markers: Selection<SVGGElement, unknown, null, undefined>;
  var tradeAnimation: Selection<SVGGElement, unknown, null, undefined>;
  var defs: Selection<SVGDefsElement, unknown, null, undefined>;
  var coastline: Selection<SVGGElement, unknown, null, undefined>;
  var lakes: Selection<SVGGElement, unknown, null, undefined>;
  var provs: Selection<SVGGElement, unknown, null, undefined>;
  var getColorScheme: (scheme: string | null) => (t: number) => string;
  var getColor: (height: number, scheme: (t: number) => string) => string;
  var svgWidth: number;
  var svgHeight: number;
  var viewbox: Selection<SVGElement, unknown, null, undefined>;
  var routes: Selection<SVGElement, unknown, null, undefined>;
  var debug: Selection<SVGElement, unknown, null, undefined>;
  var biomesData: {
    i: number[];
    name: string[];
    color: string[];
    biomesMatrix: Uint8Array[];
    habitability: number[];
    iconsDensity: number[];
    icons: string[][];
    cost: number[];
  };
  var notes: any[];
  var style: {
    burgLabels: { [key: string]: { [key: string]: string } };
    burgIcons: { [key: string]: { [key: string]: string } };
    anchors: { [key: string]: { [key: string]: string } };
    [key: string]: any;
  };

  var mapId: number;
  var getArea: (rawArea: number) => number;
  var getAreaUnit: (squareMark?: string) => string;
  var getPrecipitation: (prec: number) => string;

  var layerIsOn: (layerId: string) => boolean;
  var drawRoute: (route: any) => void;
  var invokeActiveZooming: () => void;
  var FlatQueue: any;

  var THREE: any; // lazy-loaded
  var getMapURL: (type: string, options?: Record<string, unknown>) => Promise<string>;

  var tip: (
    message: string,
    autoHide?: boolean,
    type?: "info" | "warn" | "error" | "success",
    timeout?: number
  ) => void;
  var locked: (settingId: string) => boolean;
  var unlock: (settingId: string) => void;
  var $: (selector: any) => any;
  var scale: number;
  var changeFont: () => void;
  var getFriendlyHeight: (coords: [number, number]) => string;
  var addLakesInDeepDepressions: () => void;
  var openNearSeaLakes: () => void;
  var calculateMapCoordinates: () => void;
  var calculateTemperatures: () => void;
  var reGraph: () => void;
  var createDefaultRuler: () => void;
  var showStatistics: () => void;
  var closeDialogs: (except?: string) => void;
  var editWorld: () => void;
  var showExportPane: () => void;
  var UITour: { start: () => void };
  var TradeDetails: { open: (batch: any) => void };
  var getHeight: (h: number) => string;
  var getLatitude: (y: number, precision?: number) => number;
  var getLongitude: (x: number, precision?: number) => number;
  var getFileName: (name?: string) => string;
  var customization: number;
  var speak: (text: string) => void;
  var uploadFile: (el: HTMLInputElement, callback: (data: string) => void) => void;
  var downloadFile: (content: string | Blob, name: string, type?: string) => void;
  var zoomTo: (x: number, y: number, zoom: number, duration: number) => void;
  var modules: Record<string, boolean>;

  // Legacy UI globals
  var turnButtonOn: (buttonId: string) => void;
  var turnButtonOff: (buttonId: string) => void;
  var toggleGoods: (event?: MouseEvent) => void;
  var toggleMarketsLayer: (event?: MouseEvent) => void;
  var drawMarketsLayer: () => void;
  var toggleTrade: (event?: MouseEvent) => void;
  var isCtrlClick: (event: MouseEvent) => boolean;
  var editStyle: (layer: string) => void;
  var fitContent: () => number;
  var applySorting: (header: HTMLElement) => void;
  var capitalize: (str: string) => string;
  var rn: (value: number, decimals?: number) => number;
  var confirmationDialog: (options: { title: string; message: string; confirm: string; onConfirm: () => void }) => void;
  var openURL: (url: string) => void;
  var openPicker: (color: string, callback: (color: string) => void, options?: any) => void;
  var clearLegend: () => void;
  var drawLegend: (title: string, data: any[]) => void;
  var clearMainTip: () => void;
  var showMainTip: () => void;
  var moveCircle: (x: number, y: number, r?: number) => void;
  var removeCircle: () => void;
  var restoreDefaultEvents: () => void;
  var findCell: (x: number, y: number, radius?: number) => number | undefined;
  var refreshAllEditors: () => void;
  var toggleCells: () => void;
  var drawGoods: () => void;
  var regenerateGoods: () => void;
  var regenerateMarkets: () => void;
  var regenerateEconomy: () => void;
  var regenerateProduction: () => void;
  var legend: any;

  // Helpers defined in classic public/ scripts (not yet migrated to src/). Migrated counterparts
  // (src/utils, src/modules) and globally-typed generators (Names, Cultures, Religions, States,
  // Provinces, Burgs, COA, COArenderer) are used directly instead.
  var drawCultures: () => void;
  var drawReligions: () => void;
  var drawStates: () => void;
  var drawBorders: () => void;
  var drawProvinces: () => void;
  var drawStateLabels: (ids?: number[]) => void;
  var drawPopulation: () => void;

  var toggleCultures: () => void;
  var toggleStates: () => void;
  var toggleBiomes: () => void;
  var toggleReligions: () => void;
  var toggleProvinces: () => void;
  var toggleBorders: () => void;
  var togglePopulation: () => void;

  var highlightElement: (element: Element | null, duration?: number) => void;
  var applySortingByHeader: (headerId: string) => void;
  var fog: (id: string, path: string) => void;
  var unfog: (id?: string) => void;
  var overviewBurgs: (options: { stateId: number }) => void;
  var editEmblem: (type: string, id: string, el: any) => void;
  var l: (n: number) => string;

  var aleaPRNG: (seed: string | number) => () => number;
  var heightmapColorSchemes: Record<string, unknown>;
  var precreatedHeightmaps: Record<string, { name: string }>;
  var lock: (option: string) => void;
  var applyOption: (select: HTMLElement, value: string, text?: string) => void;
  var regeneratePrompt: (options?: { seed?: string; graph?: any }) => void;
  var editHeightmap: (options: { mode: string; tool: string }) => void;

  var cults: Selection<SVGGElement, unknown, null, undefined>;
  var relig: Selection<SVGGElement, unknown, null, undefined>;
  var regions: Selection<SVGGElement, unknown, null, undefined>;
  var statesBody: Selection<SVGGElement, unknown, null, undefined>;
  var statesHalo: Selection<SVGGElement, unknown, null, undefined>;
  var armies: Selection<SVGGElement, unknown, null, undefined>;
}

type BurgGroup = {
  name: string;
  order: number;
  active?: boolean;
  isDefault?: boolean;
  removed?: boolean;
  min?: number;
  max?: number;
  percentile?: number;
  features?: Record<string, boolean>;
  biomes?: number[];
  preview?: string;
};

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

type Options = {
  year: number;
  era: string;
  eraShort: string;
  pinNotes: boolean;
  winds: number[];
  temperatureEquator: number;
  temperatureNorthPole: number;
  temperatureSouthPole: number;
  stateLabelsMode: string;
  showBurgPreview: boolean;
  burgs: {
    groups: BurgGroup[];
  };
  military: MilitaryUnit[];
  trade: {
    animation: ReturnType<typeof TradeAnimation.getDefaultOptions>;
  };
};
