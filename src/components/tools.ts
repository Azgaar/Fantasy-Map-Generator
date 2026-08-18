import { refreshEditors } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import { Emblems } from "@/generators/emblems-generator";
import { Population } from "@/generators/population-generator";
import { unfog } from "@/renderers/overlays/fogging";
import { ensureEl, gauss, isCtrlClick } from "@/utils";

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
