// Tools tab: the buttons that open every editor, tool and regeneration action
import { refreshEditors } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import { Emblems } from "@/generators/emblems-generator";
import { Population } from "@/generators/population-generator";
import { unfog } from "@/renderers/overlays/fogging";
import { ensureEl, gauss, isCtrlClick } from "@/utils";

const TEMPLATE = /* html */ `
  <div class="separator">Edit</div>
  <div class="grid">
    <button id="editBiomesButton" data-tip="Click to open Biomes Editor" data-shortcut="Shift + B">
      Biomes
    </button>
    <button id="overviewBurgsButton" data-tip="Click to open Burgs Overview" data-shortcut="Shift + T">
      Burgs
    </button>
    <button
      id="editCoastlineSettings"
      data-tip="Click to open Coastline Settings Editor"
    >
      Coastlines
    </button>
    <button id="editCulturesButton" data-tip="Click to open Cultures Editor" data-shortcut="Shift + C">
      Cultures
    </button>
    <button
      id="editDiplomacyButton"
      data-tip="Click to open Diplomatical relationships Editor"
      data-shortcut="Shift + D"
    >
      Diplomacy
    </button>
    <button id="editEmblemButton" data-tip="Click to open Emblem Editor" data-shortcut="Shift + Y">
      Emblems
    </button>
    <button id="editGoods" data-tip="Click to open Goods Editor" data-shortcut="Shift + G">Goods</button>
    <button
      id="editHeightmapButton"
      data-tip="Click to open Heightmap customization menu"
      data-shortcut="Shift + H"
    >
      Heightmap
    </button>
    <button id="overviewMarkersButton" data-tip="Click to open Markers Overview" data-shortcut="Shift + K">
      Markers
    </button>
    <button id="overviewMarketsButton" data-tip="Click to open Markets Overview">
      Markets
    </button>
    <button id="editMeasurersButton" data-tip="Click to open Measurers Editor" data-shortcut="Shift + =">
      Measurers
    </button>
    <button id="overviewLabelsButton" data-tip="Click to open Labels Overview" data-shortcut="Shift + L">
      Labels
    </button>
    <button
      id="overviewMilitaryButton"
      data-tip="Click to open Military Forces Overview"
      data-shortcut="Shift + M"
    >
      Military
    </button>
    <button id="editNamesBaseButton" data-tip="Click to open Namesbase Editor" data-shortcut="Shift + N">
      Namesbase
    </button>
    <button id="editNotesButton" data-tip="Click to open Notes Editor" data-shortcut="Shift + O">Notes</button>
    <button id="editProvincesButton" data-tip="Click to open Provinces Editor" data-shortcut="Shift + P">
      Provinces
    </button>
    <button id="editReligions" data-tip="Click to open Religions Editor" data-shortcut="Shift + R">
      Religions
    </button>
    <button id="overviewRiversButton" data-tip="Click to open Rivers Overview" data-shortcut="Shift + V">
      Rivers
    </button>
    <button id="overviewRoutesButton" data-tip="Click to open Routes Overview" data-shortcut="Shift + U">
      Routes
    </button>
    <button id="overviewJourneysButton" data-tip="Click to open Journeys Overview" data-shortcut="Shift + J">
      Journeys
    </button>
    <button id="editStatesButton" data-tip="Click to open States Editor" data-shortcut="Shift + S">
      States
    </button>
    <button id="editTradeAnimationButton" data-tip="Click to open Trade Animation Editor">
      Trade
    </button>
    <button id="editUnitsButton" data-tip="Click to open Units Editor" data-shortcut="Shift + Q">Units</button>
    <button id="editZonesButton" data-tip="Click to open Zones Editor" data-shortcut="Shift + Z">Zones</button>
  </div>
  <div class="separator">Regenerate</div>
  <div id="regenerateFeature" class="grid">
    <button
      id="regenerateBurgs"
      data-tip="Click to regenerate all unlocked burgs and routes. States will remain as they are. Note: burgs are only generated in populated areas with culture assigned"
    >
      Burgs
    </button>
    <button id="regenerateCultures" data-tip="Click to regenerate non-locked cultures">Cultures</button>
    <button
      id="regenerateEconomy"
      data-tip="Rebuild market territories, production, trade deals, and taxes from the current goods and markets"
    >
      Economy
    </button>
    <button id="regenerateEmblems" data-tip="Click to regenerate all emblems">Emblems</button>
    <button id="regenerateGoods" data-tip="Click to regenerate bonus goods placement">Goods</button>
    <button id="regenerateIce" data-tip="Click to regenerate icebergs and glaciers">Ice</button>
    <button
      id="regenerateStateLabels"
      data-tip="Click to update state labels placement based on current borders"
    >
      State Labels
    </button>
    <button id="regenerateMarkers" data-tip="Click to regenerate unlocked markers">
      Markers <i id="configRegenerateMarkers" class="icon-cog" data-tip="Click to set number multiplier"></i>
    </button>
    <button id="regenerateMarkets" data-tip="Click to regenerate markets and their territories">
      Markets
    </button>
    <button
      id="regenerateMilitary"
      data-tip="Click to recalculate military forces based on current military options"
    >
      Military
    </button>
    <button id="regeneratePopulation" data-tip="Click to recalculate rural and urban population">
      Population
    </button>
    <button
      id="regenerateProduction"
      data-tip="Click to regenerate production and trade deals"
    >
      Production
    </button>
    <button
      id="regenerateProvinces"
      data-tip="Click to regenerate non-locked provinces. States will remain as they are"
    >
      Provinces
    </button>
    <button
      id="regenerateReliefIcons"
      data-tip="Click to regenerate all relief icons based on current cell biome and elevation"
    >
      Relief
    </button>
    <button id="regenerateReligions" data-tip="Click to regenerate non-locked religions">Religions</button>
    <button id="regenerateRivers" data-tip="Click to regenerate all rivers (restore default state)">
      Rivers
    </button>
    <button id="regenerateRoutes" data-tip="Click to regenerate all unlocked routes">Routes</button>
    <button
      id="regenerateStates"
      data-tip="Click to regenerate non-locked states. Emblems and military forces will be regenerated as well, burgs will remain as they are, but capitals will be different"
    >
      States
    </button>
    <button
      id="regenerateZones"
      data-tip="Click to regenerate zones. Hold Ctrl and click to set zones number multiplier"
    >
      Zones
    </button>
  </div>
  <div class="separator">Add</div>
  <div id="addFeature" class="grid">
    <button
      id="addBurgTool"
      data-tip="Click on map to place a burg. Hold Shift to add multiple"
      data-shortcut="Shift + 1"
    >
      Burg
    </button>
    <button
      id="addLabel"
      data-tip="Click on map to place label. Hold Shift to add multiple"
      data-shortcut="Shift + 2"
    >
      Label
    </button>
    <button
      id="addMarker"
      data-tip="Click on map to place a marker. Hold Shift to add multiple"
      data-shortcut="Shift + 3"
    >
      Marker
    </button>
    <input type="hidden" id="addedMarkerType" name="addedMarkerType" value="" />
    <button
      id="addRiver"
      data-tip="Click on map to place a river. Hold Shift to add multiple"
      data-shortcut="Shift + 4"
    >
      River
    </button>
    <button id="addRoute" data-tip="Open route creation dialog" data-shortcut="Shift + 5">Route</button>
  </div>
  <div class="separator">Show</div>
  <div class="grid">
    <button id="overviewCellsButton" data-tip="Click to open Cell details view" data-shortcut="Shift + E">
      Cells
    </button>
    <button
      id="overviewChartsButton"
      data-tip="Click to open Charts to overview cells data"
      data-shortcut="Shift + A"
    >
      Charts
    </button>
    <button id="openMinimapButton" data-tip="Click to open minimap overview. Click minimap to center view">
      Minimap
    </button>
  </div>
  <div class="separator">Create</div>
  <div class="grid">
    <button id="openSubmapTool" data-tip="Click to generate a submap from the current viewport">Submap</button>
    <button id="openTransformTool" data-tip="Click to transform the map">Transform</button>
  </div>
`;

ensureEl("toolsContent").innerHTML = TEMPLATE;

ensureEl("toolsContent").addEventListener("click", event => {
  if (customization) return tip("Please exit the customization mode first", false, "error");
  if (!(event instanceof MouseEvent) || !(event.target instanceof HTMLElement)) return;
  if (!["BUTTON", "I"].includes(event.target.tagName)) return;

  const buttonId = event.target.id;
  const parentId = event.target.parentElement?.id;
  if (parentId === "regenerateFeature") confirmRegeneration(event, buttonId);
  else if (buttonId === "editHeightmapButton") void Controllers.HeightmapEditor.open();
  else if (buttonId === "editBiomesButton") void Controllers.BiomesEditor.open();
  else if (buttonId === "editStatesButton") void Controllers.StatesEditor.open();
  else if (buttonId === "editProvincesButton") void Controllers.ProvincesEditor.open();
  else if (buttonId === "editDiplomacyButton") void Controllers.DiplomacyEditor.open();
  else if (buttonId === "editCoastlineSettings") void Controllers.CoastlineEditor.open();
  else if (buttonId === "editTradeAnimationButton") void Controllers.TradeAnimationEditor.open();
  else if (buttonId === "editCulturesButton") void Controllers.CulturesEditor.open();
  else if (buttonId === "editReligions") void Controllers.ReligionsEditor.open();
  else if (buttonId === "editGoods") void Controllers.GoodsEditor.open();
  else if (buttonId === "editEmblemButton") void Controllers.EmblemsEditor.openDefault();
  else if (buttonId === "editNamesBaseButton") void Controllers.NamesbaseEditor.open();
  else if (buttonId === "editUnitsButton") void Controllers.UnitsEditor.open();
  else if (buttonId === "editMeasurersButton") void Controllers.MeasurersEditor.open();
  else if (buttonId === "editNotesButton") void Controllers.NotesEditor.open();
  else if (buttonId === "editZonesButton") void Controllers.ZonesEditor.open();
  else if (buttonId === "overviewChartsButton") void Controllers.ChartsOverview.open();
  else if (buttonId === "overviewBurgsButton") void Controllers.BurgsOverview.open();
  else if (buttonId === "overviewRoutesButton") void Controllers.RoutesOverview.open();
  else if (buttonId === "overviewJourneysButton") void Controllers.JourneysOverview.open();
  else if (buttonId === "overviewRiversButton") void Controllers.RiversOverview.open();
  else if (buttonId === "overviewMilitaryButton") void Controllers.MilitaryOverview.open();
  else if (buttonId === "overviewLabelsButton") void Controllers.LabelsOverview.open();
  else if (buttonId === "overviewMarkersButton") void Controllers.MarkersOverview.open();
  else if (buttonId === "overviewMarketsButton") void Controllers.MarketsOverview.open();
  else if (buttonId === "overviewCellsButton") void Controllers.CellInfo.open();
  else if (buttonId === "openMinimapButton") void Controllers.Minimap.open();
  else if (buttonId === "configRegenerateMarkers") void Controllers.MarkersSettings.open();
  else if (buttonId === "addBurgTool") void Controllers.BurgCreator.toggle();
  else if (buttonId === "addLabel") void Controllers.LabelCreator.toggle();
  else if (buttonId === "addRiver") void Controllers.RiverAutoCreator.toggle();
  else if (buttonId === "addRoute") void Controllers.RouteCreator.open();
  else if (buttonId === "addMarker") void Controllers.MarkerCreator.toggle();
  else if (buttonId === "openSubmapTool") void Controllers.SubmapTool.open();
  else if (buttonId === "openTransformTool") void Controllers.TransformTool.open();
});

function confirmRegeneration(event: MouseEvent, button: string): void {
  if (sessionStorage.getItem("regenerateFeatureDontAsk")) {
    regenerate(event, button);
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
        regenerate(event, button);
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

function regenerate(event: MouseEvent, button: string): void {
  if (button === "regenerateStateLabels") regenerateStateLabels();
  else if (button === "regenerateReliefIcons") regenerateReliefIcons();
  else if (button === "regenerateRoutes") regenerateRoutes();
  else if (button === "regenerateRivers") regenerateRivers();
  else if (button === "regeneratePopulation") regeneratePopulation();
  else if (button === "regenerateStates") regenerateStates();
  else if (button === "regenerateProvinces") regenerateProvinces();
  else if (button === "regenerateBurgs") regenerateBurgs();
  else if (button === "regenerateGoods") regenerateGoods();
  else if (button === "regenerateMarkets") regenerateMarkets();
  else if (button === "regenerateEconomy") regenerateEconomy();
  else if (button === "regenerateProduction") regenerateProduction();
  else if (button === "regenerateEmblems") regenerateEmblems();
  else if (button === "regenerateReligions") regenerateReligions();
  else if (button === "regenerateCultures") regenerateCultures();
  else if (button === "regenerateMilitary") regenerateMilitary();
  else if (button === "regenerateIce") regenerateIce();
  else if (button === "regenerateMarkers") regenerateMarkers();
  else if (button === "regenerateZones") regenerateZones(event);
  refreshEditors();
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

function regenerateZones(event: MouseEvent): void {
  function applyZonesRegeneration(multiplier: number): void {
    Zones.regenerate(multiplier);
    refreshEditors();
    Layers.draw("zones", "goods");
  }

  if (!isCtrlClick(event)) {
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
