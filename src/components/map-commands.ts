import { refreshEditors } from "@/components/dialog/dialog-helpers";
import type { LayerId } from "@/components/layers";
import { Layers } from "@/components/layers";
import { LAYER_TOGGLES } from "@/components/options/tabs/layers-tab";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import { Emblems } from "@/generators/emblems-generator";
import { Population } from "@/generators/population-generator";
import { unfog } from "@/renderers/overlays/fogging";
import { ensureEl, gauss, isCtrlClick } from "@/utils";

export interface MapCommand {
  id: string;
  name: string;
  aliases: string;
  run: (event?: MouseEvent) => unknown;
  layer?: LayerId;
}

export const MAP_COMMANDS: MapCommand[] = [
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
  // missing: burg and label groups, other???
  ...[...LAYER_TOGGLES].map(([id, layer]) => ({
    id: `layer:${id}`,
    name: `Toggle ${layer.label.replace(/<\/?u>/g, "")}`,
    aliases: "layer visibility show hide",
    layer: id,
    run: () => Layers.toggle(id)
  }))
];

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
