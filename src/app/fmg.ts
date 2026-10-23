// `window.FMG`: what the browser console and the Assistant's read_map scripts reach. The app never reads it
import { hideOptions, toggleOptions } from "@/app/chrome/options-panel";
import { changeCellsDensity } from "@/app/chrome/tabs/options-tab";
import { drawCellsValue, drawPath, drawPoint, drawPolygons, drawRouteConnections } from "@/app/debug-drawing";
import { applyLayersPreset, applyURLLayers } from "@/app/layers-presets";
import { regenerateMap, regeneratePrompt } from "@/app/lifecycle";
import { generateMapWithSeed, restoreSeed, showSeedHistoryDialog } from "@/app/seed";
import { Controllers } from "@/controllers";
import { heightmapTemplates } from "@/data/heightmap-templates";
import { precreatedHeightmaps } from "@/data/precreated-heightmaps";
import { AddedLabels } from "@/model/annotations/added-labels";
import { Labels } from "@/model/annotations/labels-generator";
import { Legends } from "@/model/annotations/legends";
import { Measurers } from "@/model/annotations/measurers-generator";
import { Goods } from "@/model/economy/goods-generator";
import { Markets } from "@/model/economy/markets-generator";
import { Production } from "@/model/economy/production-generator";
import { Routes } from "@/model/economy/routes-generator";
import { Transports } from "@/model/economy/transports-generator";
import { ErasePipeline, GenerationPipeline } from "@/model/generation-pipeline";
import { GraphOverride } from "@/model/graph/graph-override";
import { Grid } from "@/model/graph/grid-generator";
import { Pack } from "@/model/graph/pack-generator";
import { IconSets } from "@/model/icon-sets";
import { CustomIcons, Icons } from "@/model/icons";
import { MapEntities } from "@/model/map-entities";
import { mapHistory } from "@/model/map-history";
import { MapIntegrity } from "@/model/map-integrity";
import { MapRestoration } from "@/model/map-restoration";
import { Options } from "@/model/options/options-model";
import { Pins } from "@/model/options/pins";
import { Biomes } from "@/model/physical/biomes-generator";
import { Coastline } from "@/model/physical/coastline-generator";
import { Coordinates } from "@/model/physical/coordinates";
import { Features } from "@/model/physical/features-generator";
import { HeightmapGenerator } from "@/model/physical/heightmap-generator";
import { Ice } from "@/model/physical/ice-generator";
import { Lakes } from "@/model/physical/lakes";
import { Ocean } from "@/model/physical/ocean-generator";
import { Precipitation } from "@/model/physical/precipitation-generator";
import { Relief } from "@/model/physical/relief-generator";
import { Rivers } from "@/model/physical/river-generator";
import { Temperature } from "@/model/physical/temperature-generator";
import { Burgs } from "@/model/political/burgs-generator";
import { Emblems } from "@/model/political/emblems-generator";
import { Military } from "@/model/political/military-generator";
import { Provinces } from "@/model/political/provinces-generator";
import { States } from "@/model/political/states-generator";
import { Zones } from "@/model/political/zones-generator";
import { Resample } from "@/model/resample";
import { Cultures } from "@/model/society/cultures-generator";
import { Names } from "@/model/society/names-generator";
import { Population } from "@/model/society/population-generator";
import { Religions } from "@/model/society/religions-generator";
import { Journeys } from "@/model/story/journeys/journeys-generator";
import { Lore } from "@/model/story/lore";
import { Markers } from "@/model/story/markers-generator";
import { Notes } from "@/model/story/notes";
import { Styles } from "@/model/styles/styles";
import { Tags } from "@/model/tags";
import * as units from "@/model/units";
import { fitLegendBox } from "@/renderers/draw-legend";
import { EmblemRenderer } from "@/renderers/emblems/renderer";
import { getLabelsData } from "@/renderers/labels/label-data";
import { Layers } from "@/renderers/layers";
import { TradeAnimation } from "@/renderers/trade-animation";
import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";
import { Services } from "@/services";
import { setScriptScope } from "@/services/assistant/provider/runtime";
import { initiateAutosave, toggleSaveReminder } from "@/services/autosave";
import { fonts } from "@/services/fonts";
import { getFileName } from "@/services/io/file-name";
import { speak } from "@/services/speech";
import { copyMapURL } from "@/services/url-params";
import { cleanupData, VERSION } from "@/services/versioning";
import { closeDialogs, confirmationDialog } from "@/ui/dialog/dialog-helpers";
import { invokeActiveZooming, resetZoom, setMapZoom, setTranslateExtent, setZoomExtent, zoomTo } from "@/ui/map/zoom";
import { clearMainTip, tip } from "@/ui/tooltips";
import * as arrayUtils from "@/utils/arrayUtils";
import * as colorUtils from "@/utils/colorUtils";
import * as commonUtils from "@/utils/commonUtils";
import * as fileUtils from "@/utils/fileUtils";
import * as heightUtils from "@/utils/heightUtils";
import * as languageUtils from "@/utils/languageUtils";
import * as nodeUtils from "@/utils/nodeUtils";
import * as numberUtils from "@/utils/numberUtils";
import * as objectUtils from "@/utils/objectUtils";
import * as pathUtils from "@/utils/pathUtils";
import * as probabilityUtils from "@/utils/probabilityUtils";
import * as stringUtils from "@/utils/stringUtils";

const FMG = {
  // replaced wholesale on regeneration and load, so read through getters
  get pack() {
    return pack;
  },
  get grid() {
    return grid;
  },
  get options() {
    return options;
  },
  get styles() {
    return styles;
  },

  // helpers
  ...arrayUtils,
  ...colorUtils,
  ...commonUtils,
  ...fileUtils,
  ...heightUtils,
  ...languageUtils,
  ...nodeUtils,
  ...numberUtils,
  ...objectUtils,
  ...pathUtils,
  ...probabilityUtils,
  ...stringUtils,
  ...units,
  speak,
  getFileName,
  VERSION,
  mapHistory,
  fonts,
  heightmapTemplates,
  precreatedHeightmaps,

  AddedLabels,
  Biomes,
  Burgs,
  Coastline,
  Coordinates,
  Cultures,
  CustomIcons,
  Emblems,
  ErasePipeline,
  Features,
  GenerationPipeline,
  Goods,
  GraphOverride,
  Grid,
  HeightmapGenerator,
  Ice,
  IconSets,
  Icons,
  Journeys,
  Labels,
  Lakes,
  Legends,
  Lore,
  MapEntities,
  MapIntegrity,
  MapRestoration,
  Markers,
  Markets,
  Measurers,
  Military,
  Names,
  Notes,
  Ocean,
  Options,
  Pack,
  Pins,
  Population,
  Precipitation,
  Production,
  Provinces,
  Relief,
  Religions,
  Resample,
  Rivers,
  Routes,
  States,
  Styles,
  Tags,
  Temperature,
  Transports,
  Zones,

  Layers,
  ViewportLayers,
  TradeAnimation,
  EmblemRenderer,
  getLabelsData,
  fitLegendBox,

  Controllers,
  Services,

  tip,
  clearMainTip,
  closeDialogs,
  confirmationDialog,
  zoomTo,
  resetZoom,
  setMapZoom,
  setZoomExtent,
  setTranslateExtent,
  invokeActiveZooming,

  regenerateMap,
  regeneratePrompt,
  generateMapWithSeed,
  restoreSeed,
  showSeedHistoryDialog,
  applyLayersPreset,
  applyURLLayers,
  toggleOptions,
  hideOptions,
  changeCellsDensity,
  initiateAutosave,
  toggleSaveReminder,
  copyMapURL,
  cleanupData,

  // debugging aids for the devtools prompt, drawn into the #debug layer
  drawCellsValue: (data: unknown[], points = pack.cells.p) => drawCellsValue(data, points),
  drawPolygons: (data: number[]) => drawPolygons(data, undefined, grid),
  drawRouteConnections: () => drawRouteConnections(pack),
  drawPoint,
  drawPath,
  getVertexPath: (cells: number[]) => pathUtils.getVertexPath(cells, pack)
};

Object.defineProperty(window, "FMG", { value: FMG });
setScriptScope(FMG);
