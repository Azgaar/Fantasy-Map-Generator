import { showInfo } from "@/components/app-info";
import { refreshEditors } from "@/components/dialog/dialog-helpers";
import type { LayerId } from "@/components/layers";
import { Layers } from "@/components/layers";
import { applyPreset, savePreset } from "@/components/layers-presets";
import { regeneratePrompt } from "@/components/lifecycle";
import {
  loadURL,
  openExportToPngTiles,
  pickMapFile,
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
import { t } from "@/utils/i18n";

export interface MapCommand {
  id: string;
  name: string;
  aliases: string;
  run: (event?: MouseEvent) => unknown;
  layer?: LayerId;
  matches?: (query: string) => boolean; // queries the command answers beyond its name and aliases
  link?: true; // an Assistant answer may link it: it only opens a dialog, tab or chart
}

export const isLinkable = (command: MapCommand): boolean => command.link === true;

/** Ordered by priority: the omnibar breaks score ties by definition order */
export const MAP_COMMANDS: MapCommand[] = [
  {
    id: "assistant",
    name: t("Azgaar Assistant"),
    aliases: "help chat question ask faq support how why what ?",
    matches: isQuestion,
    run: () => Controllers.Assistant.open()
  },
  {
    id: "startTour",
    name: t("Start Interactive Tour"),
    aliases: "help guide tutorial",
    run: () => Services.UiTour.start()
  },
  { id: "newMap", name: t("Generate New Map"), aliases: "regenerate random create", run: () => regeneratePrompt() },
  {
    id: "saveToMachine",
    name: t("Save Map File"),
    aliases: "save .map disk",
    run: () => Services.Save.toMachine()
  },
  {
    id: "saveMapAs",
    name: t("Save Map As…"),
    aliases: "save as copy .map filename folder location backup",
    run: () => Services.Save.toMachine(true)
  },
  {
    id: "loadFromFile",
    name: t("Load Map from File"),
    aliases: "open upload disk",
    run: () => pickMapFile()
  },
  {
    id: "quickLoad",
    name: t("Quick Load Map"),
    aliases: "browser storage restore",
    run: () => Services.Load.quickLoad()
  },
  {
    id: "saveToStorage",
    name: t("Save Map to browser storage"),
    aliases: "browser storage",
    run: () => Services.Save.toStorage()
  },
  { id: "saveToDropbox", name: t("Save Map to Dropbox"), aliases: "cloud", run: () => Services.Save.toDropbox() },
  { id: "loadFromURL", name: t("Load Map from URL"), aliases: "open link", run: () => loadURL() },
  { id: "saveButton", name: t("Show Save Panel"), link: true, aliases: "store dialog", run: () => showSavePane() },
  { id: "loadButton", name: t("Load Map"), aliases: "open dialog", run: () => showLoadPane() },
  {
    id: "exportButton",
    name: t("Show Export Panel"),
    link: true,
    aliases: "map download image data",
    run: () => showExportPane()
  },
  { id: "copyMapURL", name: t("Copy Map URL"), aliases: "seed link share clipboard", run: () => copyMapURL() },
  {
    id: "seedHistory",
    name: t("Show Seed History"),
    link: true,
    aliases: "previous maps restore",
    run: () => showSeedHistoryDialog()
  },
  {
    id: "editStatesButton",
    name: t("States Editor"),
    link: true,
    aliases: "countries kingdoms nations",
    run: () => Controllers.StatesEditor.open()
  },
  {
    id: "overviewBurgsButton",
    name: t("Burgs Overview"),
    link: true,
    aliases: "settlements cities towns villages",
    run: () => Controllers.BurgsOverview.open()
  },
  {
    id: "editCulturesButton",
    name: t("Cultures Editor"),
    link: true,
    aliases: "people",
    run: () => Controllers.CulturesEditor.open()
  },
  {
    id: "editReligions",
    name: t("Religions Editor"),
    link: true,
    aliases: "faith beliefs",
    run: () => Controllers.ReligionsEditor.open()
  },
  {
    id: "editProvincesButton",
    name: t("Provinces Editor"),
    link: true,
    aliases: "territories counties",
    run: () => Controllers.ProvincesEditor.open()
  },
  {
    id: "editHeightmapButton",
    name: t("Edit Heightmap"),
    link: true,
    aliases: "terrain elevation",
    run: () => Controllers.HeightmapEditor.open()
  },
  {
    id: "editBiomesButton",
    name: t("Biomes Editor"),
    link: true,
    aliases: "environment terrain",
    run: () => Controllers.BiomesEditor.open()
  },
  {
    id: "editReliefRules",
    name: t("Relief Rules"),
    link: true,
    aliases: "terrain icons mountains hills trees biome rules",
    run: () => Controllers.ReliefRulesEditor.open()
  },
  {
    id: "editDiplomacyButton",
    name: t("Diplomacy Overview"),
    link: true,
    aliases: "relations allies wars",
    run: () => Controllers.DiplomacyOverview.open()
  },
  {
    id: "overviewFeaturesButton",
    name: t("Geographical Features Overview"),
    link: true,
    aliases: "islands lakes oceans landmasses water bodies continents",
    run: () => Controllers.FeaturesOverview.open()
  },
  {
    id: "overviewRiversButton",
    name: t("Rivers Overview"),
    link: true,
    aliases: "waterways",
    run: () => Controllers.RiversOverview.open()
  },
  {
    id: "overviewRoutesButton",
    name: t("Routes Overview"),
    link: true,
    aliases: "roads paths trails",
    run: () => Controllers.RoutesOverview.open()
  },
  {
    id: "overviewMarkersButton",
    name: t("Markers Overview"),
    link: true,
    aliases: "points of interest",
    run: () => Controllers.MarkersOverview.open()
  },
  {
    id: "overviewLabelsButton",
    name: t("Labels Overview"),
    link: true,
    aliases: "text typography",
    run: () => Controllers.LabelsOverview.open()
  },
  {
    id: "editZonesButton",
    name: t("Zones Editor"),
    link: true,
    aliases: "areas regions",
    run: () => Controllers.ZonesEditor.open()
  },
  {
    id: "overviewMilitaryButton",
    name: t("Military Overview"),
    link: true,
    aliases: "armies regiments",
    run: () => Controllers.MilitaryOverview.open()
  },
  {
    id: "regiments",
    name: t("Regiments Overview"),
    link: true,
    aliases: "military armies",
    run: () => Controllers.RegimentsOverview.open()
  },
  {
    id: "editEmblemButton",
    name: t("Edit Emblem"),
    link: true,
    aliases: "heraldry coat of arms",
    run: () => Controllers.EmblemsEditor.openDefault()
  },
  {
    id: "editNotesButton",
    name: t("Notes Editor"),
    link: true,
    aliases: "lore descriptions legends",
    run: () => Controllers.NotesEditor.open()
  },
  {
    id: "lore",
    name: t("Setup Lore"),
    link: true,
    aliases: "description history story",
    run: () => Controllers.LoreEditor.open()
  },
  {
    id: "editNamesBaseButton",
    name: t("Namesbase Editor"),
    link: true,
    aliases: "names language",
    run: () => Controllers.NamesbaseEditor.open()
  },
  {
    id: "editUnitsButton",
    name: t("Units Editor"),
    link: true,
    aliases: "scale distance population",
    run: () => Controllers.UnitsEditor.open()
  },
  {
    id: "editCoastlineSettings",
    name: t("Coastline Settings"),
    link: true,
    aliases: "coast islands oceans",
    run: () => Controllers.CoastlineEditor.open()
  },
  {
    id: "editMeasurersButton",
    name: t("Measurers Editor"),
    link: true,
    aliases: "rulers distances",
    run: () => Controllers.MeasurersEditor.open()
  },
  {
    id: "editGoods",
    name: t("Goods Editor"),
    link: true,
    aliases: "resources products economy",
    run: () => Controllers.GoodsEditor.open()
  },
  {
    id: "overviewMarketsButton",
    name: t("Markets Overview"),
    link: true,
    aliases: "economy trade",
    run: () => Controllers.MarketsOverview.open()
  },
  {
    id: "productionChains",
    name: t("Production Chains"),
    link: true,
    aliases: "goods recipes economy",
    run: () => Controllers.ProductionChains.open()
  },
  {
    id: "editTradeAnimationButton",
    name: t("Trade Animation Editor"),
    link: true,
    aliases: "economy",
    run: () => Controllers.TradeAnimationEditor.open()
  },
  {
    id: "overviewJourneysButton",
    name: t("Journeys Overview"),
    link: true,
    aliases: "travel quests",
    run: () => Controllers.JourneysOverview.open()
  },
  {
    id: "transports",
    name: t("Transport Types"),
    link: true,
    aliases: "journeys travel speed",
    run: () => Controllers.TransportEditor.open()
  },
  {
    id: "burgGroups",
    name: t("Configure burg groups"),
    link: true,
    aliases: "settlements cities towns villages types",
    run: () => Controllers.BurgGroupEditor.open()
  },
  {
    id: "labelGroups",
    name: t("Configure Label Groups"),
    link: true,
    aliases: "labels text typography fonts",
    run: () => Controllers.LabelGroupsConfigurator.open()
  },
  {
    id: "routeGroups",
    name: t("Edit route groups"),
    link: true,
    aliases: "roads paths trails types",
    run: () => Controllers.RouteGroupsEditor.open()
  },
  {
    id: "world",
    name: t("World Configurator"),
    link: true,
    aliases: "climate size latitude temperature",
    run: () => Controllers.WorldConfigurator.open()
  },
  {
    id: "overviewCellsButton",
    name: t("Cell Details"),
    link: true,
    aliases: "cell information",
    run: () => Controllers.CellInfo.open()
  },
  {
    id: "overviewChartsButton",
    name: t("Data Charts"),
    link: true,
    aliases: "statistics graphs",
    run: () => Controllers.ChartsOverview.open()
  },
  {
    id: "addBurgTool",
    name: t("Add Burg"),
    aliases: "add burgs settlement city town village",
    run: () => Controllers.BurgCreator.toggle()
  },
  { id: "addLabel", name: t("Add Label"), aliases: "text", run: () => Controllers.LabelCreator.toggle() },
  {
    id: "addMarker",
    name: t("Add Marker"),
    aliases: "point of interest",
    run: () => Controllers.MarkerCreator.toggle()
  },
  { id: "addRiver", name: t("Add River"), aliases: "waterway", run: () => Controllers.RiverAutoCreator.toggle() },
  {
    id: "drawRiver",
    name: t("Draw River"),
    aliases: "add waterway manually",
    run: () => Controllers.RiverCreator.open()
  },
  { id: "addRoute", name: t("Add Route"), aliases: "road trail path", run: () => Controllers.RouteCreator.open() },
  {
    id: "selectHeightmap",
    name: t("Select Heightmap Template"),
    aliases: "precreated generation options",
    run: () => Controllers.HeightmapSelection.open()
  },
  {
    id: "openSubmapTool",
    name: t("Create Submap"),
    aliases: "generate region",
    run: () => Controllers.SubmapTool.open()
  },
  {
    id: "openTransformTool",
    name: t("Transform Map"),
    aliases: "rotate resize",
    run: () => Controllers.TransformTool.open()
  },
  {
    id: "openWrapTool",
    name: t("Wrap Tool"),
    link: true,
    aliases: "reshape cells brush",
    run: () => Controllers.WrapTool.open()
  },
  {
    id: "openMinimapButton",
    name: t("Minimap"),
    link: true,
    aliases: "navigation",
    run: () => Controllers.Minimap.open()
  },
  {
    id: "viewMesh",
    name: t("3D Preview"),
    link: true,
    aliases: "view mode mesh",
    run: () => Controllers.View3d.open("viewMesh")
  },
  {
    id: "viewGlobe",
    name: t("Open Globe View"),
    link: true,
    aliases: "view mode planet",
    run: () => Controllers.View3d.open("viewGlobe")
  },
  {
    id: "showStatesChart",
    name: t("States bubble chart"),
    link: true,
    aliases: "countries kingdoms area population bubble",
    run: () => Controllers.StatesEditor.showChart()
  },
  {
    id: "showProvincesChart",
    name: t("Provinces chart"),
    link: true,
    aliases: "territories area population treemap",
    run: () => Controllers.ProvincesEditor.showChart()
  },
  {
    id: "showBurgsChart",
    name: t("Burgs bubble chart"),
    link: true,
    aliases: "settlements cities population bubble",
    run: () => Controllers.BurgsOverview.showChart()
  },
  {
    id: "showCulturesHierarchy",
    name: t("Cultures tree"),
    link: true,
    aliases: "people origins tree",
    run: () => Controllers.CulturesEditor.showHierarchy()
  },
  {
    id: "showReligionsHierarchy",
    name: t("Religions tree"),
    link: true,
    aliases: "faith beliefs origins tree",
    run: () => Controllers.ReligionsEditor.showHierarchy()
  },
  {
    id: "showRelationsHistory",
    name: t("Relations history"),
    link: true,
    aliases: "diplomacy chronicle wars",
    run: () => Controllers.DiplomacyOverview.showHistory()
  },
  {
    id: "regenerateStates",
    name: `${t("Regenerate")}: ${t("States")}`,
    aliases: "generate countries kingdoms",
    run: () => confirmRegeneration(regenerateStates)
  },
  {
    id: "regenerateProvinces",
    name: `${t("Regenerate")}: ${t("Provinces")}`,
    aliases: "generate counties",
    run: () => confirmRegeneration(regenerateProvinces)
  },
  {
    id: "regenerateBurgs",
    name: `${t("Regenerate")}: ${t("Burgs")}`,
    aliases: "generate settlements cities towns",
    run: () => confirmRegeneration(regenerateBurgs)
  },
  {
    id: "regenerateCultures",
    name: `${t("Regenerate")}: ${t("Cultures")}`,
    aliases: "generate people",
    run: () => confirmRegeneration(regenerateCultures)
  },
  {
    id: "regenerateReligions",
    name: `${t("Regenerate")}: ${t("Religions")}`,
    aliases: "generate faith",
    run: () => confirmRegeneration(regenerateReligions)
  },
  {
    id: "regenerateRivers",
    name: `${t("Regenerate")}: ${t("Rivers")}`,
    aliases: "generate waterways",
    run: () => confirmRegeneration(regenerateRivers)
  },
  {
    id: "regenerateRoutes",
    name: `${t("Regenerate")}: ${t("Routes")}`,
    aliases: "generate roads",
    run: () => confirmRegeneration(regenerateRoutes)
  },
  {
    id: "regenerateStateLabels",
    name: `${t("Regenerate")}: ${t("State Labels")}`,
    aliases: "generate text placement",
    run: () => confirmRegeneration(regenerateStateLabels)
  },
  {
    id: "regenerateReliefIcons",
    name: `${t("Regenerate")}: ${t("Relief")}`,
    aliases: "generate mountains forests",
    run: () => confirmRegeneration(regenerateReliefIcons)
  },
  {
    id: "regenerateEmblems",
    name: `${t("Regenerate")}: ${t("Emblems")}`,
    aliases: "generate heraldry",
    run: () => confirmRegeneration(regenerateEmblems)
  },
  {
    id: "regenerateMarkers",
    name: `${t("Regenerate")}: ${t("Markers")}`,
    aliases: "generate points of interest",
    run: () => confirmRegeneration(regenerateMarkers)
  },
  {
    id: "regenerateZones",
    name: `${t("Regenerate")}: ${t("Zones")}`,
    aliases: "generate regions",
    run: event => confirmRegeneration(() => regenerateZones(event))
  },
  {
    id: "regenerateMilitary",
    name: `${t("Regenerate")}: ${t("Military")}`,
    aliases: "generate armies regiments",
    run: () => confirmRegeneration(regenerateMilitary)
  },
  {
    id: "regeneratePopulation",
    name: `${t("Regenerate")}: ${t("Population")}`,
    aliases: "generate people",
    run: () => confirmRegeneration(regeneratePopulation)
  },
  {
    id: "regenerateGoods",
    name: `${t("Regenerate")}: ${t("Goods")}`,
    aliases: "generate resources",
    run: () => confirmRegeneration(regenerateGoods)
  },
  {
    id: "regenerateMarkets",
    name: `${t("Regenerate")}: ${t("Markets")}`,
    aliases: "generate economy",
    run: () => confirmRegeneration(regenerateMarkets)
  },
  {
    id: "regenerateProduction",
    name: `${t("Regenerate")}: ${t("Production")}`,
    aliases: "generate trade economy",
    run: () => confirmRegeneration(regenerateProduction)
  },
  {
    id: "regenerateEconomy",
    name: `${t("Regenerate")}: ${t("Economy")}`,
    aliases: "generate trade",
    run: () => confirmRegeneration(regenerateEconomy)
  },
  {
    id: "regenerateIce",
    name: `${t("Regenerate")}: ${t("Ice")}`,
    aliases: "generate glaciers icebergs",
    run: () => confirmRegeneration(regenerateIce)
  },
  {
    id: "configRegenerateMarkers",
    name: t("Configure Marker Generation"),
    aliases: "markers settings",
    run: () => Controllers.MarkersSettings.open()
  },
  { id: "zoomReset", name: t("Reset Zoom"), aliases: "fit view whole map", run: () => resetZoom(1000) },
  { id: "zoomIn", name: t("Zoom In"), aliases: "view closer", run: () => changeMapZoom(1.2) },
  { id: "zoomOut", name: t("Zoom Out"), aliases: "view farther", run: () => changeMapZoom(0.8) },
  { id: "toggleOptions", name: t("Toggle Menu"), aliases: "options panel show hide", run: () => toggleOptions() },
  { id: "layersTab", name: t("Layers Tab"), link: true, aliases: "menu panel", run: () => openTab("layersTab") },
  {
    id: "styleTab",
    name: t("Style Tab"),
    link: true,
    aliases: "menu panel editor",
    run: () => openTab("styleTab")
  },
  {
    id: "optionsTab",
    name: t("Options Tab"),
    link: true,
    aliases: "menu panel settings",
    run: () => openTab("optionsTab")
  },
  { id: "toolsTab", name: t("Tools Tab"), link: true, aliases: "menu panel", run: () => openTab("toolsTab") },
  {
    id: "aboutTab",
    name: t("About Tab"),
    link: true,
    aliases: "menu panel info credits",
    run: () => openTab("aboutTab")
  },
  {
    id: "exportSvg",
    name: t("Export as SVG"),
    aliases: "download vector image",
    run: () => Services.ExportMap.exportToSvg()
  },
  { id: "exportPng", name: t("Export as PNG"), aliases: "download image", run: () => Services.ExportMap.exportToPng() },
  {
    id: "exportJpeg",
    name: t("Export as JPEG"),
    aliases: "download image",
    run: () => Services.ExportMap.exportToJpeg()
  },
  { id: "exportTiles", name: t("Export as PNG Tiles"), aliases: "download zip", run: () => openExportToPngTiles() },
  {
    id: "exportJsonFull",
    name: `${t("Export to JSON")}: ${t("Full")}`,
    aliases: "download data",
    run: () => Services.ExportJson.exportToJson("Full")
  },
  {
    id: "exportJsonMinimal",
    name: `${t("Export to JSON")}: ${t("Minimal")}`,
    aliases: "download data",
    run: () => Services.ExportJson.exportToJson("Minimal")
  },
  {
    id: "exportJsonPackCells",
    name: `${t("Export to JSON")}: ${t("Pack cells")}`,
    aliases: "download data",
    run: () => Services.ExportJson.exportToJson("PackCells")
  },
  {
    id: "exportJsonGridCells",
    name: `${t("Export to JSON")}: ${t("Grid cells")}`,
    aliases: "download data",
    run: () => Services.ExportJson.exportToJson("GridCells")
  },
  {
    id: "exportGeoJsonCells",
    name: `${t("Export to GeoJSON")}: ${t("Cells")}`,
    aliases: "download gis",
    run: () => Services.ExportMap.saveGeoJsonCells()
  },
  {
    id: "exportGeoJsonRoutes",
    name: `${t("Export to GeoJSON")}: ${t("Routes")}`,
    aliases: "download gis",
    run: () => Services.ExportMap.saveGeoJsonRoutes()
  },
  {
    id: "exportGeoJsonRivers",
    name: `${t("Export to GeoJSON")}: ${t("Rivers")}`,
    aliases: "download gis",
    run: () => Services.ExportMap.saveGeoJsonRivers()
  },
  {
    id: "exportGeoJsonMarkers",
    name: `${t("Export to GeoJSON")}: ${t("Markers")}`,
    aliases: "download gis",
    run: () => Services.ExportMap.saveGeoJsonMarkers()
  },
  {
    id: "exportGeoJsonZones",
    name: `${t("Export to GeoJSON")}: ${t("Zones")}`,
    aliases: "download gis",
    run: () => Services.ExportMap.saveGeoJsonZones()
  },
  {
    id: "exportCsvBurgs",
    name: `${t("Export to CSV")}: ${t("Burgs")}`,
    aliases: "download table settlements cities towns",
    run: () => Controllers.BurgsOverview.exportCsv()
  },
  {
    id: "exportCsvBiomes",
    name: `${t("Export to CSV")}: ${t("Biomes")}`,
    aliases: "download table environment terrain",
    run: () => Controllers.BiomesEditor.exportCsv()
  },
  {
    id: "exportCsvRelations",
    name: `${t("Export to CSV")}: ${t("Relations")}`,
    aliases: "download table diplomacy matrix",
    run: () => Controllers.DiplomacyOverview.exportCsv()
  },
  {
    id: "exportCsvGoods",
    name: `${t("Export to CSV")}: ${t("Goods")}`,
    aliases: "download table resources economy",
    run: () => Controllers.GoodsEditor.exportCsv()
  },
  {
    id: "exportCsvMarkers",
    name: `${t("Export to CSV")}: ${t("Markers")}`,
    aliases: "download table points of interest",
    run: () => Controllers.MarkersOverview.exportCsv()
  },
  {
    id: "exportCsvMarkets",
    name: `${t("Export to CSV")}: ${t("Markets")}`,
    aliases: "download table economy trade",
    run: () => Controllers.MarketsOverview.exportCsv()
  },
  {
    id: "exportCsvMilitary",
    name: `${t("Export to CSV")}: ${t("Military")}`,
    aliases: "download table armies forces",
    run: () => Controllers.MilitaryOverview.exportCsv()
  },
  {
    id: "exportCsvRegiments",
    name: `${t("Export to CSV")}: ${t("Regiments")}`,
    aliases: "download table military armies",
    run: () => Controllers.RegimentsOverview.exportCsv()
  },
  {
    id: "exportCsvNotes",
    name: `${t("Export to CSV")}: ${t("Notes")}`,
    aliases: "download table lore legends descriptions",
    run: () => Controllers.NotesEditor.exportCsv()
  },
  {
    id: "exportCsvZones",
    name: `${t("Export to CSV")}: ${t("Zones")}`,
    aliases: "download table areas regions",
    run: () => Controllers.ZonesEditor.exportCsv()
  },
  { id: "showInfo", name: t("Show App Info"), link: true, aliases: "about version help", run: () => showInfo() },
  {
    id: "getApp",
    name: t("Get Desktop App"),
    aliases: "install download electron",
    run: () => Services.AppOffer.open()
  },
  {
    id: "toggleSaveReminder",
    name: t("Toggle Save Reminder"),
    aliases: "autosave notification",
    run: () => toggleSaveReminder()
  },
  {
    id: "optionsReset",
    name: t("Reset Options"),
    aliases: "restore defaults clear cache reload",
    run: () => cleanupData()
  },
  { id: "savePresetButton", name: t("Save Layers Preset"), aliases: "displayed layers", run: () => savePreset() },
  ...Object.entries(LAYER_PRESETS).map(([id, label]) => ({
    id: `preset:${id}`,
    name: t("Apply Layers Preset: {{- preset}}", { preset: label }),
    aliases: "layers preset show",
    run: () => applyPreset(id)
  })),
  ...[...LAYER_TOGGLES].map(([id, layer]) => ({
    id: `layer:${id}`,
    name: t("Toggle {{- layer}}", { layer: layer.label }),
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
  message.innerHTML = `${t("Regeneration will remove all the custom changes for the element.")}<br><br>${t("Are you sure you want to proceed?")}`;
  $("#alert").dialog({
    resizable: false,
    title: t("Regenerate element"),
    buttons: {
      [t("Proceed")]: function () {
        apply();
        $(this).dialog("close");
      },
      [t("Cancel")]: function () {
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
  promptForNumber(t("Please provide zones number multiplier"), { default: 1, step: 0.01, min: 0, max: 100 }, value =>
    applyZonesRegeneration(Number(value))
  );
}
