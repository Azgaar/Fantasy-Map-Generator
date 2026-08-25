import type {
  MilitaryUnit as ApplicationMilitaryUnit,
  ApplicationOptions,
  MapHistoryEntry,
  Note
} from "@/application/application-state";
import type { GoodsModule } from "../generators/goods-generator";
import type { MarketsModule } from "../generators/markets-generator";
import type { ProductionModule } from "../generators/production-generator";
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
    LayerControls: import("../components/layers/layer-controls").LegacyLayerControls;
    MapStyleControls: import("../components/style/map-style-controls").MapStyleControlsApi;
    StyleEditor: import("../components/style/style-editor-runtime").StyleEditorApi;
    StylePresets: import("../components/style/style-presets-controller").StylePresetsApi;
    tip: typeof import("../components/tooltips").tip;
    clearMainTip: typeof import("../components/tooltips").clearMainTip;
    showDataTip: typeof import("../components/tooltips").showDataTip;
    showElementLockTip: typeof import("../components/tooltips").showElementLockTip;
    lock: typeof import("../utils/preferences").lock;
    unlock: typeof import("../utils/preferences").unlock;
    stored: typeof import("../utils/preferences").stored;
    applyDefaultViewboxEvents: typeof import("../components/viewbox-events").applyDefaultViewboxEvents;
    drawRelief: typeof import("../renderers/draw-relief-icons").drawRelief;
    drawBorders: typeof import("../renderers/draw-borders").drawBorders;
    drawBiomes: typeof import("../renderers/draw-biomes").drawBiomes;
    redrawRelief: typeof import("../renderers/draw-relief-icons").redrawRelief;
    redrawLegend: typeof import("../renderers/draw-legend").redrawLegend;
    fitLegendBox: typeof import("../renderers/draw-legend").fitLegendBox;
    clearLegend: typeof import("../renderers/draw-legend").clearLegend;
    fog: typeof import("../renderers/overlays/fogging").fog;
    unfog: typeof import("../renderers/overlays/fogging").unfog;
    showInfo: typeof import("../components/app-info").showInfo;
    applyOption: typeof import("../utils").applyOption;
    closeDialogs: typeof import("../components/dialog/dialog-helpers").closeDialogs;
    confirmationDialog: typeof import("../components/dialog/dialog-helpers").confirmationDialog;
    destroyDialog: typeof import("../components/dialog/dialog-helpers").destroyDialog;
    updateDialog: typeof import("../components/dialog/dialog-helpers").updateDialog;
    enableElementDragging: typeof import("../components/element-dragging").enableElementDragging;
    enableVerticalSortable: typeof import("../components/dialog/vertical-sortable").enableVerticalSortable;
    showDomDialog: (
      options: import("../components/ui/dom-dialog").DomDialogOptions
    ) => Promise<import("../components/ui/dom-dialog").DomDialogHandle>;
    showMessageDialog: (
      options: import("../components/ui/message-dialog").MessageDialogOptions
    ) => Promise<import("../components/ui/message-dialog").MessageDialogHandle>;
    downloadFile: typeof import("../utils").downloadFile;
    uploadFile: typeof import("../utils").uploadFile;
    getPrecipitation: typeof import("../utils").getPrecipitation;
    panMap: typeof import("../components/zoom").panMap;
    setMapZoom: typeof import("../components/zoom").setMapZoom;
    changeMapZoom: typeof import("../components/zoom").changeMapZoom;
    MapZoom: {
      setExtent: typeof import("../components/zoom").setMapZoomExtent;
      setTranslateExtent: typeof import("../components/zoom").setMapTranslateExtent;
    };
    MapPerformance: typeof import("../services/performance-monitor").MapPerformance;
    MapRendererCommands: typeof import("../renderers/core/renderer-commands").rendererCommands;
    OptionsController: import("../components/options/options-controller").OptionsControllerApi;
    ViewportCells: { draw: () => void; clear: () => void };
    GridGeneration: typeof import("../generators/grid-generation").GridGeneration;
    drawStateLabels: (ids?: number[]) => void;
    drawBurgLabels: () => void;
    drawBurgLabel: (burg: import("../generators/burgs-generator").Burg) => void;
    removeBurgLabel: (burgId: number) => void;
  }

  var seed: string;
  var pack: PackedGraph;
  // Grid is still exposed to legacy scripts. New code can opt into the structural Grid type from ./grid.
  var grid: any;
  var graphHeight: number;
  var graphWidth: number;
  var TIME: boolean;
  var INFO: boolean;
  var WARN: boolean;
  var ERROR: boolean;
  var DEBUG: { stateLabels?: boolean; [key: string]: boolean | undefined };
  var options: ApplicationOptions;

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
  var mapName: HTMLInputElement;
  var religionsNumber: HTMLInputElement;
  var distanceUnitInput: HTMLInputElement;
  var heightUnit: HTMLSelectElement;
  var areaUnit: HTMLInputElement;
  var stylePreset: HTMLSelectElement;
  var temperatureScale: HTMLSelectElement;

  // Transitional application-state accessors. New code should use the typed state/controller modules.
  var viewX: number;
  var viewY: number;

  var svgWidth: number;
  var svgHeight: number;
  var notes: Note[];
  var style: Style;

  var mapId: number;

  var Dropbox: any; // dropbox-sdk global, loaded on demand from libs/dropbox-sdk.min.js
  var mapHistory: MapHistoryEntry[];

  // heightmap editor globals
  var color: (value: number) => string;
  var resetZoom: (duration?: number) => void;
  var RgbQuant: any; // external RgbQuant image-quantization lib

  var shiftCompass: () => void;

  var THREE: any; // lazy-loaded

  var scale: number;
  var showExportPane: () => void;
  var customization: number;
  var zoomTo: (x: number, y: number, zoom?: number, duration?: number) => void;
  var modules: Record<string, boolean>;

  // Legacy UI globals
  var drawMarketsLayer: () => void;
  var isCtrlClick: (event: MouseEvent) => boolean;
  var capitalize: (str: string) => string;
  var rn: (value: number, decimals?: number) => number;
  var openURL: (url: string) => void;
  var findCell: (x: number, y: number, radius?: number) => number | undefined;
  var drawGoods: () => void;
  var drawBorders: () => void;
  var drawLabels: () => void;

  var tinymce:
    | {
        _setBaseUrl: (url: string) => void;
        init: (config: Record<string, unknown>) => void;
        remove: () => void;
        activeEditor?: { getContent: () => string; setContent: (content: string) => void };
      }
    | undefined;

  var heightmapColorSchemes: Record<string, unknown>;

  type MilitaryUnit = ApplicationMilitaryUnit;
}

export type Point = [number, number];
