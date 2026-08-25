import { requireWorkspaceCapability } from "@/application/workspace-mode";
import { refreshEditors } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { getStateExpansionSettings } from "@/controllers/state-generation-settings";
import { Population } from "@/generators/population-generator";
import { drawBorders } from "@/renderers/draw-borders";
import { clearEmblems, drawEmblems } from "@/renderers/draw-emblems";
import { drawGoods } from "@/renderers/draw-goods";
import { drawIce } from "@/renderers/draw-ice";
import { drawMarkets } from "@/renderers/draw-markets";
import { drawMilitary } from "@/renderers/draw-military";
import { redrawRelief } from "@/renderers/draw-relief-icons";
import { drawLabels } from "@/renderers/labels/labels-renderer";
import { unfog } from "@/renderers/overlays/fogging";
import { invalidateBurgSymbols, invalidateMarkerSymbols } from "@/renderers/point-symbols";
import { tradeAnimation } from "@/renderers/trade-animation";
import { notifyMapMutation } from "@/services/map-mutation";
import { ensureEl, gauss, isCtrlClick } from "@/utils";
import { invokeToolControllerCommand, toolsAreAvailable } from "./tool-command-executor";
import { type RegenerationCommandDetail, RUN_REGENERATION_EVENT } from "./ui/regeneration-command";

ensureEl("toolsContent").addEventListener("click", event => {
  if (!(event instanceof MouseEvent) || !(event.target instanceof HTMLElement)) return;
  const configButton = event.target.closest<HTMLElement>("#configRegenerateMarkers");
  const button = event.target.closest<HTMLButtonElement>("button");
  if (button?.dataset.commandId) return;
  const action = configButton ?? button;
  if (!action) return;

  const buttonId = action.id;
  const parentId = button?.parentElement?.id;
  if (parentId === "regenerateFeature") {
    if (toolsAreAvailable() && requireWorkspaceCapability("map:generate")) confirmRegeneration(event, buttonId);
    return;
  }

  invokeToolControllerCommand(buttonId);
});

window.addEventListener(RUN_REGENERATION_EVENT, event => {
  if (!toolsAreAvailable() || !requireWorkspaceCapability("map:generate")) return;
  const detail = (event as CustomEvent<RegenerationCommandDetail>).detail;
  if (!detail?.buttonId) return;
  const { buttonId, ctrlKey, metaKey } = detail;
  regenerate(new MouseEvent("click", { ctrlKey, metaKey }), buttonId);
});

function confirmRegeneration(event: MouseEvent, button: string): void {
  if (sessionStorage.getItem("regenerateFeatureDontAsk")) {
    regenerate(event, button);
    return;
  }

  let dontAskAgain = false;
  void import("@/components/ui/message-dialog").then(({ showMessageDialog }) => {
    showMessageDialog({
      actions: [{ label: "Proceed", onClick: () => regenerate(event, button) }, { label: "Cancel" }],
      id: "regenerateElementDialog",
      messageHtml:
        "Regeneration will remove all the custom changes for the element.<br /><br />Are you sure you want to proceed?",
      onClose: () => {
        if (dontAskAgain) sessionStorage.setItem("regenerateFeatureDontAsk", "true");
      },
      rememberChoice: {
        label: "do not ask again",
        onChange: checked => {
          dontAskAgain = checked;
        }
      },
      title: "Regenerate element"
    });
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
  notifyMapMutation("regenerate");
}

function regenerateStateLabels(): void {
  drawLabels();
}

function regenerateReliefIcons(): void {
  Relief.generate();
  redrawRelief();
}

function regenerateRoutes(): void {
  Routes.regenerate();
  if (window.LayerControls.isLayerOn("toggleRoutes")) window.LayerControls.redrawLayer("toggleRoutes");
}

function regenerateRivers(): void {
  Rivers.regenerate();
  if (window.LayerControls.isLayerOn("toggleRivers")) window.LayerControls.redrawLayer("toggleRivers");
}

function regeneratePopulation(): void {
  Population.regenerate();
  if (window.LayerControls.isLayerOn("togglePopulation")) window.LayerControls.redrawLayer("togglePopulation");
  if (window.LayerControls.isLayerOn("toggleGoods")) drawGoods();
}

function regenerateStates(): void {
  const { warning, error } = States.regenerate(getStateExpansionSettings());
  if (error) return void tip(error, false, "error");
  if (warning) tip(warning, false, "warn");

  unfog();
  if (window.LayerControls.isLayerOn("toggleStates")) window.LayerControls.redrawLayer("toggleStates");
  if (window.LayerControls.isLayerOn("toggleBorders")) drawBorders();
  if (window.LayerControls.isLayerOn("toggleProvinces")) window.LayerControls.redrawLayer("toggleProvinces");
  drawLabels();
  if (window.LayerControls.isLayerOn("toggleBurgIcons")) invalidateBurgSymbols();
  if (window.LayerControls.isLayerOn("toggleMilitary")) drawMilitary();
  if (window.LayerControls.isLayerOn("toggleGoods")) drawGoods();
  if (window.LayerControls.isLayerOn("toggleEmblems")) {
    clearEmblems(["state", "province"]);
    drawEmblems();
  }
}

function regenerateProvinces(): void {
  Provinces.regenerate();
  unfog();
  if (window.LayerControls.isLayerOn("toggleBorders")) drawBorders();
  if (window.LayerControls.isLayerOn("toggleProvinces")) window.LayerControls.redrawLayer("toggleProvinces");
  drawLabels();
  if (window.LayerControls.isLayerOn("toggleEmblems")) {
    clearEmblems(["province"]);
    drawEmblems();
  }
}

function regenerateBurgs(): void {
  Burgs.regenerate();
  if (window.LayerControls.isLayerOn("toggleBurgIcons")) invalidateBurgSymbols();
  drawLabels();
  if (window.LayerControls.isLayerOn("toggleRoutes")) window.LayerControls.redrawLayer("toggleRoutes");
  if (window.LayerControls.isLayerOn("togglePopulation")) window.LayerControls.redrawLayer("togglePopulation");
  if (window.LayerControls.isLayerOn("toggleGoods")) drawGoods();
  if (window.LayerControls.isLayerOn("toggleEmblems")) {
    clearEmblems(["burg"]);
    drawEmblems();
  }
}

function regenerateGoods(): void {
  Goods.regenerate();
  if (window.LayerControls.isLayerOn("toggleGoods")) drawGoods();
}

function regenerateMarkets(): void {
  Markets.regenerate();
  if (window.LayerControls.isLayerOn("toggleMarketsLayer")) drawMarkets();
  if (window.LayerControls.isLayerOn("toggleGoods")) drawGoods();
  if (window.LayerControls.isLayerOn("toggleTrade")) tradeAnimation.restart();
}

function regenerateEconomy(): void {
  Production.regenerateEconomy();
  if (window.LayerControls.isLayerOn("toggleMarketsLayer")) drawMarkets();
  if (window.LayerControls.isLayerOn("toggleGoods")) drawGoods();
  if (window.LayerControls.isLayerOn("toggleTrade")) tradeAnimation.restart();
}

function regenerateProduction(): void {
  Production.regenerate();
  if (window.LayerControls.isLayerOn("toggleGoods")) drawGoods();
  if (window.LayerControls.isLayerOn("toggleTrade")) tradeAnimation.restart();
}

function regenerateEmblems(): void {
  COA.regenerate();
  if (!window.LayerControls.isLayerOn("toggleEmblems")) return;
  clearEmblems(["state", "province", "burg"]);
  drawEmblems();
}

function regenerateReligions(): void {
  Religions.regenerate();
  if (window.LayerControls.isLayerOn("toggleReligions")) window.LayerControls.redrawLayer("toggleReligions");
  if (window.LayerControls.isLayerOn("toggleGoods")) drawGoods();
}

function regenerateCultures(): void {
  Cultures.regenerate();
  if (window.LayerControls.isLayerOn("toggleCultures")) window.LayerControls.redrawLayer("toggleCultures");
  if (window.LayerControls.isLayerOn("toggleGoods")) drawGoods();
}

function regenerateMilitary(): void {
  Military.regenerate();
  if (window.LayerControls.isLayerOn("toggleMilitary")) drawMilitary();
}

function regenerateIce(): void {
  Ice.regenerate();
  if (window.LayerControls.isLayerOn("toggleIce")) drawIce();
}

function regenerateMarkers(): void {
  Markers.regenerate();
  if (window.LayerControls.isLayerOn("toggleMarkers")) invalidateMarkerSymbols();
}

function regenerateZones(event: MouseEvent): void {
  function applyZonesRegeneration(multiplier: number): void {
    Zones.regenerate(multiplier);
    refreshEditors();
    if (window.LayerControls.isLayerOn("toggleZones")) window.LayerControls.redrawLayer("toggleZones");
    if (window.LayerControls.isLayerOn("toggleGoods")) drawGoods();
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
