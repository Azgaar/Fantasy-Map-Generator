import { showInfo } from "@/components/app-info";
import { refreshEditors } from "@/components/dialog/dialog-helpers";
import type { LayerId } from "@/components/layers";
import { Layers } from "@/components/layers";
import { applyPreset, savePreset } from "@/components/layers-presets";
import { regeneratePrompt } from "@/components/lifecycle";
import {
  loadURL,
  openExportToPngTiles,
  showExportPane,
  showLoadPane,
  showSavePane
} from "@/components/options/io-panes";
import { openTab, toggleOptions } from "@/components/options/options-panel";
import { LAYER_PRESETS, LAYER_TOGGLES } from "@/components/options/tabs/layers-tab";
import { showSeedHistoryDialog } from "@/components/seed";
import { tip } from "@/components/tooltips";
import { changeMapZoom, resetZoom } from "@/components/zoom";
import { Controllers } from "@/controllers";
import { Emblems } from "@/generators/emblems-generator";
import { Population } from "@/generators/population-generator";
import { unfog } from "@/renderers/overlays/fogging";
import { Services } from "@/services";
import { toggleSaveReminder } from "@/services/autosave";
import { copyMapURL } from "@/services/url-params";
import { cleanupData } from "@/services/versioning";
import { ensureEl, gauss, isCtrlClick } from "@/utils";

export interface MapCommand {
  id: string;
  name: string;
  aliases: string;
  run: (event?: MouseEvent) => unknown;
  layer?: LayerId;
  matches?: (query: string) => boolean; // queries the command answers beyond its name and aliases
}

export const MAP_COMMANDS: MapCommand[] = [
  {
    id: "helpAssistant",
    name: "Ask AI: Azgaar Assistant",
    aliases: "help chat question ask faq support how why what ?",
    matches: isQuestion,
    run: () => Controllers.HelpAssistant.open()
  },
  {
    id: "startTour",
    name: "Start Interactive Tour",
    aliases: "help guide tutorial",
    run: () => Services.UiTour.start()
  },
  { id: "getApp", name: "Get Desktop App", aliases: "install download electron", run: () => Services.AppOffer.open() },
  {
    id: "editBiomesButton",
    name: "Open Biomes Editor",
    aliases: "environment terrain",
    run: () => Controllers.BiomesEditor.open()
  },
  {
    id: "overviewBurgsButton",
    name: "Open Burgs Overview",
    aliases: "settlements cities towns villages",
    run: () => Controllers.BurgsOverview.open()
  },
  {
    id: "editCoastlineSettings",
    name: "Open Coastline Editor",
    aliases: "coast islands oceans",
    run: () => Controllers.CoastlineEditor.open()
  },
  {
    id: "editCulturesButton",
    name: "Open Cultures Editor",
    aliases: "people",
    run: () => Controllers.CulturesEditor.open()
  },
  {
    id: "editDiplomacyButton",
    name: "Open Diplomacy Editor",
    aliases: "relations allies wars",
    run: () => Controllers.DiplomacyEditor.open()
  },
  {
    id: "editEmblemButton",
    name: "Open Emblems Editor",
    aliases: "heraldry coat of arms",
    run: () => Controllers.EmblemsEditor.openDefault()
  },
  {
    id: "editGoods",
    name: "Open Goods Editor",
    aliases: "resources products economy",
    run: () => Controllers.GoodsEditor.open()
  },
  {
    id: "editHeightmapButton",
    name: "Edit Heightmap",
    aliases: "terrain elevation",
    run: () => Controllers.HeightmapEditor.open()
  },
  {
    id: "overviewMarkersButton",
    name: "Open Markers Overview",
    aliases: "points of interest",
    run: () => Controllers.MarkersOverview.open()
  },
  {
    id: "overviewMarketsButton",
    name: "Open Markets Overview",
    aliases: "economy trade",
    run: () => Controllers.MarketsOverview.open()
  },
  {
    id: "editMeasurersButton",
    name: "Open Measurers Editor",
    aliases: "rulers distances",
    run: () => Controllers.MeasurersEditor.open()
  },
  {
    id: "overviewLabelsButton",
    name: "Open Labels Overview",
    aliases: "text typography",
    run: () => Controllers.LabelsOverview.open()
  },
  {
    id: "overviewMilitaryButton",
    name: "Open Military Overview",
    aliases: "armies regiments",
    run: () => Controllers.MilitaryOverview.open()
  },
  {
    id: "editNamesBaseButton",
    name: "Open Namesbase Editor",
    aliases: "names language",
    run: () => Controllers.NamesbaseEditor.open()
  },
  {
    id: "editNotesButton",
    name: "Open Notes Editor",
    aliases: "lore descriptions legends",
    run: () => Controllers.NotesEditor.open()
  },
  {
    id: "editProvincesButton",
    name: "Open Provinces Editor",
    aliases: "territories counties",
    run: () => Controllers.ProvincesEditor.open()
  },
  {
    id: "editReligions",
    name: "Open Religions Editor",
    aliases: "faith beliefs",
    run: () => Controllers.ReligionsEditor.open()
  },
  {
    id: "overviewRiversButton",
    name: "Open Rivers Overview",
    aliases: "waterways",
    run: () => Controllers.RiversOverview.open()
  },
  {
    id: "overviewRoutesButton",
    name: "Open Routes Overview",
    aliases: "roads paths trails",
    run: () => Controllers.RoutesOverview.open()
  },
  {
    id: "overviewJourneysButton",
    name: "Open Journeys Overview",
    aliases: "travel quests",
    run: () => Controllers.JourneysOverview.open()
  },
  {
    id: "editStatesButton",
    name: "Open States Editor",
    aliases: "countries kingdoms nations",
    run: () => Controllers.StatesEditor.open()
  },
  {
    id: "editTradeAnimationButton",
    name: "Open Trade Animation Editor",
    aliases: "economy",
    run: () => Controllers.TradeAnimationEditor.open()
  },
  {
    id: "editUnitsButton",
    name: "Open Units Editor",
    aliases: "scale distance population",
    run: () => Controllers.UnitsEditor.open()
  },
  {
    id: "editZonesButton",
    name: "Open Zones Editor",
    aliases: "areas regions",
    run: () => Controllers.ZonesEditor.open()
  },
  {
    id: "overviewCellsButton",
    name: "Open Cell Details",
    aliases: "cell information",
    run: () => Controllers.CellInfo.open()
  },
  {
    id: "overviewChartsButton",
    name: "Open Data Charts",
    aliases: "statistics graphs",
    run: () => Controllers.ChartsOverview.open()
  },
  {
    id: "showStatesChart",
    name: "Show States Chart",
    aliases: "countries kingdoms area population bubble",
    run: () => Controllers.StatesEditor.showChart()
  },
  {
    id: "showProvincesChart",
    name: "Show Provinces Chart",
    aliases: "territories area population treemap",
    run: () => Controllers.ProvincesEditor.showChart()
  },
  {
    id: "showBurgsChart",
    name: "Show Burgs Chart",
    aliases: "settlements cities population bubble",
    run: () => Controllers.BurgsOverview.showChart()
  },
  {
    id: "showCulturesHierarchy",
    name: "Show Cultures Hierarchy",
    aliases: "people origins tree",
    run: () => Controllers.CulturesEditor.showHierarchy()
  },
  {
    id: "showReligionsHierarchy",
    name: "Show Religions Hierarchy",
    aliases: "faith beliefs origins tree",
    run: () => Controllers.ReligionsEditor.showHierarchy()
  },
  {
    id: "showRelationsHistory",
    name: "Show Relations History",
    aliases: "diplomacy chronicle wars",
    run: () => Controllers.DiplomacyEditor.showHistory()
  },
  { id: "openMinimapButton", name: "Open Minimap", aliases: "navigation", run: () => Controllers.Minimap.open() },
  { id: "openSubmapTool", name: "Create Submap", aliases: "generate region", run: () => Controllers.SubmapTool.open() },
  {
    id: "openTransformTool",
    name: "Transform Map",
    aliases: "rotate resize",
    run: () => Controllers.TransformTool.open()
  },
  {
    id: "addBurgTool",
    name: "Add Burg",
    aliases: "add burgs settlement city town village",
    run: () => Controllers.BurgCreator.toggle()
  },
  { id: "addLabel", name: "Add Label", aliases: "text", run: () => Controllers.LabelCreator.toggle() },
  { id: "addMarker", name: "Add Marker", aliases: "point of interest", run: () => Controllers.MarkerCreator.toggle() },
  { id: "addRiver", name: "Add River", aliases: "waterway", run: () => Controllers.RiverAutoCreator.toggle() },
  { id: "addRoute", name: "Add Route", aliases: "road trail path", run: () => Controllers.RouteCreator.open() },
  {
    id: "regenerateBurgs",
    name: "Regenerate Burgs",
    aliases: "generate settlements cities towns",
    run: () => confirmRegeneration(regenerateBurgs)
  },
  {
    id: "regenerateCultures",
    name: "Regenerate Cultures",
    aliases: "generate people",
    run: () => confirmRegeneration(regenerateCultures)
  },
  {
    id: "regenerateEconomy",
    name: "Regenerate Economy",
    aliases: "generate trade",
    run: () => confirmRegeneration(regenerateEconomy)
  },
  {
    id: "regenerateEmblems",
    name: "Regenerate Emblems",
    aliases: "generate heraldry",
    run: () => confirmRegeneration(regenerateEmblems)
  },
  {
    id: "regenerateGoods",
    name: "Regenerate Goods",
    aliases: "generate resources",
    run: () => confirmRegeneration(regenerateGoods)
  },
  {
    id: "regenerateIce",
    name: "Regenerate Ice",
    aliases: "generate glaciers icebergs",
    run: () => confirmRegeneration(regenerateIce)
  },
  {
    id: "regenerateStateLabels",
    name: "Regenerate State Labels",
    aliases: "generate text placement",
    run: () => confirmRegeneration(regenerateStateLabels)
  },
  {
    id: "regenerateMarkers",
    name: "Regenerate Markers",
    aliases: "generate points of interest",
    run: () => confirmRegeneration(regenerateMarkers)
  },
  {
    id: "regenerateMarkets",
    name: "Regenerate Markets",
    aliases: "generate economy",
    run: () => confirmRegeneration(regenerateMarkets)
  },
  {
    id: "regenerateMilitary",
    name: "Regenerate Military",
    aliases: "generate armies regiments",
    run: () => confirmRegeneration(regenerateMilitary)
  },
  {
    id: "regeneratePopulation",
    name: "Regenerate Population",
    aliases: "generate people",
    run: () => confirmRegeneration(regeneratePopulation)
  },
  {
    id: "regenerateProduction",
    name: "Regenerate Production",
    aliases: "generate trade economy",
    run: () => confirmRegeneration(regenerateProduction)
  },
  {
    id: "regenerateProvinces",
    name: "Regenerate Provinces",
    aliases: "generate counties",
    run: () => confirmRegeneration(regenerateProvinces)
  },
  {
    id: "regenerateReliefIcons",
    name: "Regenerate Relief",
    aliases: "generate mountains forests",
    run: () => confirmRegeneration(regenerateReliefIcons)
  },
  {
    id: "regenerateReligions",
    name: "Regenerate Religions",
    aliases: "generate faith",
    run: () => confirmRegeneration(regenerateReligions)
  },
  {
    id: "regenerateRivers",
    name: "Regenerate Rivers",
    aliases: "generate waterways",
    run: () => confirmRegeneration(regenerateRivers)
  },
  {
    id: "regenerateRoutes",
    name: "Regenerate Routes",
    aliases: "generate roads",
    run: () => confirmRegeneration(regenerateRoutes)
  },
  {
    id: "regenerateStates",
    name: "Regenerate States",
    aliases: "generate countries kingdoms",
    run: () => confirmRegeneration(regenerateStates)
  },
  {
    id: "regenerateZones",
    name: "Regenerate Zones",
    aliases: "generate regions",
    run: event => confirmRegeneration(() => regenerateZones(event))
  },
  {
    id: "configRegenerateMarkers",
    name: "Configure Marker Generation",
    aliases: "markers settings",
    run: () => Controllers.MarkersSettings.open()
  },
  {
    id: "world",
    name: "Open World Configurator",
    aliases: "climate size latitude temperature",
    run: () => Controllers.WorldConfigurator.open()
  },
  { id: "lore", name: "Open Map Lore", aliases: "description history story", run: () => Controllers.LoreEditor.open() },
  {
    id: "regiments",
    name: "Open Regiments Overview",
    aliases: "military armies",
    run: () => Controllers.RegimentsOverview.open()
  },
  {
    id: "productionChains",
    name: "Open Production Chains",
    aliases: "goods recipes economy",
    run: () => Controllers.ProductionChains.open()
  },
  {
    id: "burgGroups",
    name: "Open Burg Groups Editor",
    aliases: "settlements cities towns villages types",
    run: () => Controllers.BurgGroupEditor.open()
  },
  {
    id: "labelGroups",
    name: "Open Label Groups Editor",
    aliases: "labels text typography fonts",
    run: () => Controllers.LabelGroupsConfigurator.open()
  },
  {
    id: "routeGroups",
    name: "Open Route Groups Editor",
    aliases: "roads paths trails types",
    run: () => Controllers.RouteGroupsEditor.open()
  },
  {
    id: "transports",
    name: "Open Transports Editor",
    aliases: "journeys travel speed",
    run: () => Controllers.TransportEditor.open()
  },
  { id: "drawRiver", name: "Draw River", aliases: "add waterway manually", run: () => Controllers.RiverCreator.open() },
  {
    id: "selectHeightmap",
    name: "Select Heightmap Template",
    aliases: "precreated generation options",
    run: () => Controllers.HeightmapSelection.open()
  },
  { id: "newMap", name: "Generate New Map", aliases: "regenerate random create", run: () => regeneratePrompt() },
  {
    id: "seedHistory",
    name: "Show Seed History",
    aliases: "previous maps restore",
    run: () => showSeedHistoryDialog()
  },
  { id: "copyMapURL", name: "Copy Map URL", aliases: "seed link share clipboard", run: () => copyMapURL() },
  { id: "saveButton", name: "Show Save Panel", aliases: "store dialog", run: () => showSavePane() },
  {
    id: "saveToMachine",
    name: "Save Map File",
    aliases: "save .map disk",
    run: () => Services.Save.toMachine()
  },
  { id: "saveToDropbox", name: "Save Map to Dropbox", aliases: "cloud", run: () => Services.Save.toDropbox() },
  {
    id: "saveToStorage",
    name: "Save Map to browser storage",
    aliases: "browser storage",
    run: () => Services.Save.toStorage()
  },
  { id: "loadButton", name: "Load Map", aliases: "open dialog", run: () => showLoadPane() },
  {
    id: "loadFromFile",
    name: "Load Map from File",
    aliases: "open upload disk",
    run: () => ensureEl("mapToLoad").click()
  },
  { id: "loadFromURL", name: "Load Map from URL", aliases: "open link", run: () => loadURL() },
  { id: "quickLoad", name: "Quick Load Map", aliases: "browser storage restore", run: () => Services.Load.quickLoad() },
  { id: "exportButton", name: "Export Map", aliases: "download image data dialog", run: () => showExportPane() },
  {
    id: "exportSvg",
    name: "Export as SVG",
    aliases: "download vector image",
    run: () => Services.ExportMap.exportToSvg()
  },
  { id: "exportPng", name: "Export as PNG", aliases: "download image", run: () => Services.ExportMap.exportToPng() },
  { id: "exportJpeg", name: "Export as JPEG", aliases: "download image", run: () => Services.ExportMap.exportToJpeg() },
  { id: "exportTiles", name: "Export as PNG Tiles", aliases: "download zip", run: () => openExportToPngTiles() },
  {
    id: "exportGeoJsonCells",
    name: "Export Cells as GeoJSON",
    aliases: "download gis",
    run: () => Services.ExportMap.saveGeoJsonCells()
  },
  {
    id: "exportGeoJsonRoutes",
    name: "Export Routes as GeoJSON",
    aliases: "download gis",
    run: () => Services.ExportMap.saveGeoJsonRoutes()
  },
  {
    id: "exportGeoJsonRivers",
    name: "Export Rivers as GeoJSON",
    aliases: "download gis",
    run: () => Services.ExportMap.saveGeoJsonRivers()
  },
  {
    id: "exportGeoJsonMarkers",
    name: "Export Markers as GeoJSON",
    aliases: "download gis",
    run: () => Services.ExportMap.saveGeoJsonMarkers()
  },
  {
    id: "exportGeoJsonZones",
    name: "Export Zones as GeoJSON",
    aliases: "download gis",
    run: () => Services.ExportMap.saveGeoJsonZones()
  },
  {
    id: "exportJsonFull",
    name: "Export Full JSON",
    aliases: "download data",
    run: () => Services.ExportJson.exportToJson("Full")
  },
  {
    id: "exportJsonMinimal",
    name: "Export Minimal JSON",
    aliases: "download data",
    run: () => Services.ExportJson.exportToJson("Minimal")
  },
  {
    id: "exportJsonPackCells",
    name: "Export Pack Cells JSON",
    aliases: "download data",
    run: () => Services.ExportJson.exportToJson("PackCells")
  },
  {
    id: "exportJsonGridCells",
    name: "Export Grid Cells JSON",
    aliases: "download data",
    run: () => Services.ExportJson.exportToJson("GridCells")
  },
  {
    id: "exportCsvBiomes",
    name: "Export Biomes as CSV",
    aliases: "download table environment terrain",
    run: () => Controllers.BiomesEditor.exportCsv()
  },
  {
    id: "exportCsvBurgs",
    name: "Export Burgs as CSV",
    aliases: "download table settlements cities towns",
    run: () => Controllers.BurgsOverview.exportCsv()
  },
  {
    id: "exportCsvRelations",
    name: "Export Relations as CSV",
    aliases: "download table diplomacy matrix",
    run: () => Controllers.DiplomacyEditor.exportCsv()
  },
  {
    id: "exportCsvGoods",
    name: "Export Goods as CSV",
    aliases: "download table resources economy",
    run: () => Controllers.GoodsEditor.exportCsv()
  },
  {
    id: "exportCsvMarkers",
    name: "Export Markers as CSV",
    aliases: "download table points of interest",
    run: () => Controllers.MarkersOverview.exportCsv()
  },
  {
    id: "exportCsvMarkets",
    name: "Export Markets as CSV",
    aliases: "download table economy trade",
    run: () => Controllers.MarketsOverview.exportCsv()
  },
  {
    id: "exportCsvMilitary",
    name: "Export Military as CSV",
    aliases: "download table armies forces",
    run: () => Controllers.MilitaryOverview.exportCsv()
  },
  {
    id: "exportCsvNotes",
    name: "Export Notes as CSV",
    aliases: "download table lore legends descriptions",
    run: () => Controllers.NotesEditor.exportCsv()
  },
  {
    id: "exportCsvRegiments",
    name: "Export Regiments as CSV",
    aliases: "download table military armies",
    run: () => Controllers.RegimentsOverview.exportCsv()
  },
  {
    id: "exportCsvZones",
    name: "Export Zones as CSV",
    aliases: "download table areas regions",
    run: () => Controllers.ZonesEditor.exportCsv()
  },
  { id: "toggleOptions", name: "Toggle Menu", aliases: "options panel show hide", run: () => toggleOptions() },
  { id: "layersTab", name: "Open Layers Tab", aliases: "menu panel", run: () => openTab("layersTab") },
  { id: "styleTab", name: "Open Style Tab", aliases: "menu panel editor", run: () => openTab("styleTab") },
  { id: "optionsTab", name: "Open Options Tab", aliases: "menu panel settings", run: () => openTab("optionsTab") },
  { id: "toolsTab", name: "Open Tools Tab", aliases: "menu panel", run: () => openTab("toolsTab") },
  { id: "aboutTab", name: "Open About Tab", aliases: "menu panel info credits", run: () => openTab("aboutTab") },
  { id: "zoomReset", name: "Reset Zoom", aliases: "fit view whole map", run: () => resetZoom(1000) },
  { id: "zoomIn", name: "Zoom In", aliases: "view closer", run: () => changeMapZoom(1.2) },
  { id: "zoomOut", name: "Zoom Out", aliases: "view farther", run: () => changeMapZoom(0.8) },
  { id: "viewMesh", name: "Open 3D Scene", aliases: "view mode mesh", run: () => Controllers.View3d.open("viewMesh") },
  {
    id: "viewGlobe",
    name: "Open Globe View",
    aliases: "view mode planet",
    run: () => Controllers.View3d.open("viewGlobe")
  },
  { id: "savePresetButton", name: "Save Layers Preset", aliases: "displayed layers", run: () => savePreset() },
  { id: "showInfo", name: "Show App Info", aliases: "about version help", run: () => showInfo() },
  {
    id: "toggleSaveReminder",
    name: "Toggle Save Reminder",
    aliases: "autosave notification",
    run: () => toggleSaveReminder()
  },
  {
    id: "optionsReset",
    name: "Reset Options",
    aliases: "restore defaults clear cache reload",
    run: () => cleanupData()
  },
  ...Object.entries(LAYER_PRESETS).map(([id, label]) => ({
    id: `preset:${id}`,
    name: `Apply Layers Preset: ${label}`,
    aliases: "layers preset show",
    run: () => applyPreset(id)
  })),
  ...[...LAYER_TOGGLES].map(([id, layer]) => ({
    id: `layer:${id}`,
    name: `Toggle ${layer.label.replace(/<\/?u>/g, "")}`,
    aliases: "layer visibility show hide",
    layer: id,
    run: () => Layers.toggle(id)
  }))
];

/** A typed question: ends with a question mark or opens with a question word */
function isQuestion(text: string): boolean {
  const query = text.trim();
  const QUESTION_START = /^(how|what|why|where|when|which|who|can|could|should|is|are|do|does|did|will|would)\s+\S/i;
  return query.includes("?") || QUESTION_START.test(query);
}

function confirmRegeneration(action: () => void): void {
  const apply = () => {
    action();
    refreshEditors();
  };
  if (sessionStorage.getItem("regenerateFeatureDontAsk")) {
    apply();
    return;
  }

  const message = ensureEl("alertMessage");
  message.innerHTML =
    "Regeneration will remove all the custom changes for the element.<br /><br />Are you sure you want to proceed?";
  $("#alert").dialog({
    resizable: false,
    title: "Regenerate element",
    buttons: {
      Proceed: function () {
        apply();
        $(this).dialog("close");
      },
      Cancel: function () {
        $(this).dialog("close");
      }
    },
    open: function () {
      const checkbox =
        '<span><input id="dontAsk" class="checkbox" type="checkbox"><label for="dontAsk" class="checkbox-label dontAsk"><i>do not ask again</i></label><span>';
      this.parentElement.querySelector(".ui-dialog-buttonpane")?.insertAdjacentHTML("afterbegin", checkbox);
    },
    close: function () {
      const checkbox = this.parentElement.querySelector(".checkbox") as HTMLInputElement | null;
      if (checkbox?.checked) sessionStorage.setItem("regenerateFeatureDontAsk", "true");
      $(this).dialog("destroy");
    }
  });
}

function regenerateStateLabels(): void {
  for (const state of pack.states) {
    if (!state.i || state.removed) continue;
    if (state.label) delete state.label; // cleanup custom label data to force recalculation of pathPoints
  }
  Layers.draw("labels");
}

function regenerateReliefIcons(): void {
  Relief.generate();
  Layers.draw("relief");
}

function regenerateRoutes(): void {
  Routes.regenerate();
  Layers.draw("routes");
}

function regenerateRivers(): void {
  Rivers.regenerate();
  Layers.draw("rivers");
}

function regeneratePopulation(): void {
  Population.regenerate();
  Layers.draw("population", "goods");
}

function regenerateStates(): void {
  const { warning, error } = States.regenerate();
  if (error) return void tip(error, false, "error");
  if (warning) tip(warning, false, "warn");

  unfog();
  Layers.draw("states", "borders", "provinces", "labels", "burgIcons", "military", "goods", "emblems");
}

function regenerateProvinces(): void {
  Provinces.regenerate();
  unfog();
  Layers.draw("borders", "provinces", "labels", "emblems");
}

function regenerateBurgs(): void {
  Burgs.regenerate();
  Layers.draw("burgIcons", "labels", "routes", "population", "goods", "emblems");
}

function regenerateGoods(): void {
  Goods.regenerate();
  Layers.draw("goods");
}

function regenerateMarkets(): void {
  Markets.regenerate();
  Layers.draw("markets", "goods", "trade");
}

function regenerateEconomy(): void {
  Production.regenerateEconomy();
  Layers.draw("markets", "goods", "trade");
}

function regenerateProduction(): void {
  Production.regenerate();
  Layers.draw("goods", "trade");
}

function regenerateEmblems(): void {
  Emblems.regenerate();
  Layers.draw("emblems");
}

function regenerateReligions(): void {
  Religions.regenerate();
  Layers.draw("religions", "goods");
}

function regenerateCultures(): void {
  Cultures.regenerate();
  Layers.draw("cultures", "goods");
}

function regenerateMilitary(): void {
  Military.regenerate();
  Layers.draw("military");
}

function regenerateIce(): void {
  Ice.regenerate();
  Layers.draw("ice");
}

function regenerateMarkers(): void {
  Markers.regenerate();
  Layers.draw("markers");
}

function regenerateZones(event?: MouseEvent): void {
  function applyZonesRegeneration(multiplier: number): void {
    Zones.regenerate(multiplier);
    refreshEditors();
    Layers.draw("zones", "goods");
  }

  if (!event || !isCtrlClick(event)) {
    applyZonesRegeneration(gauss(1, 0.5, 0.6, 5, 2));
    return;
  }

  const promptForNumber = window.prompt as unknown as (
    message: string,
    options: { default: number; step: number; min: number; max: number },
    callback: (value: number | string) => void
  ) => void;
  promptForNumber("Please provide zones number multiplier", { default: 1, step: 0.01, min: 0, max: 100 }, value =>
    applyZonesRegeneration(Number(value))
  );
}
