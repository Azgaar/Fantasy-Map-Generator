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
    if (toolsAreAvailable()) confirmRegeneration(event, buttonId);
    return;
  }

  invokeToolControllerCommand(buttonId);
});

window.addEventListener(RUN_REGENERATION_EVENT, event => {
  if (!toolsAreAvailable()) return;
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
}

function regenerateStateLabels(): void {
  for (const state of pack.states) {
    if (!state.i || state.removed) continue;
    // cleanup custom label data to force recalculation of pathPoints
    if (state.label) delete state.label;
  }
  drawLabels();
}

function regenerateReliefIcons(): void {
  Relief.generate();
  redrawRelief();
}

function regenerateRoutes(): void {
  Routes.regenerate();
  if (layerIsOn("toggleRoutes")) drawRoutes();
}

function regenerateRivers(): void {
  Rivers.regenerate();
  if (layerIsOn("toggleRivers")) drawRivers();
}

function regeneratePopulation(): void {
  Population.regenerate();
  if (layerIsOn("togglePopulation")) drawPopulation();
  if (layerIsOn("toggleGoods")) drawGoods();
}

function regenerateStates(): void {
  const { warning, error } = States.regenerate(getStateExpansionSettings());
  if (error) return void tip(error, false, "error");
  if (warning) tip(warning, false, "warn");

  unfog();
  if (layerIsOn("toggleStates")) drawStates();
  if (layerIsOn("toggleBorders")) drawBorders();
  if (layerIsOn("toggleProvinces")) drawProvinces();
  drawLabels();
  if (layerIsOn("toggleBurgIcons")) invalidateBurgSymbols();
  if (layerIsOn("toggleMilitary")) drawMilitary();
  if (layerIsOn("toggleGoods")) drawGoods();
  if (layerIsOn("toggleEmblems")) {
    clearEmblems(["state", "province"]);
    drawEmblems();
  }
}

function regenerateProvinces(): void {
  Provinces.regenerate();
  unfog();
  if (layerIsOn("toggleBorders")) drawBorders();
  if (layerIsOn("toggleProvinces")) drawProvinces();
  drawLabels();
  if (layerIsOn("toggleEmblems")) {
    clearEmblems(["province"]);
    drawEmblems();
  }
}

function regenerateBurgs(): void {
  Burgs.regenerate();
  if (layerIsOn("toggleBurgIcons")) invalidateBurgSymbols();
  drawLabels();
  if (layerIsOn("toggleRoutes")) drawRoutes();
  if (layerIsOn("togglePopulation")) drawPopulation();
  if (layerIsOn("toggleGoods")) drawGoods();
  if (layerIsOn("toggleEmblems")) {
    clearEmblems(["burg"]);
    drawEmblems();
  }
}

function regenerateGoods(): void {
  Goods.regenerate();
  if (layerIsOn("toggleGoods")) drawGoods();
}

function regenerateMarkets(): void {
  Markets.regenerate();
  if (layerIsOn("toggleMarketsLayer")) drawMarkets();
  if (layerIsOn("toggleGoods")) drawGoods();
  if (layerIsOn("toggleTrade")) tradeAnimation.restart();
}

function regenerateEconomy(): void {
  Production.regenerateEconomy();
  if (layerIsOn("toggleMarketsLayer")) drawMarkets();
  if (layerIsOn("toggleGoods")) drawGoods();
  if (layerIsOn("toggleTrade")) tradeAnimation.restart();
}

function regenerateProduction(): void {
  Production.regenerate();
  if (layerIsOn("toggleGoods")) drawGoods();
  if (layerIsOn("toggleTrade")) tradeAnimation.restart();
}

function regenerateEmblems(): void {
  COA.regenerate();
  if (!layerIsOn("toggleEmblems")) return;
  clearEmblems(["state", "province", "burg"]);
  drawEmblems();
}

function regenerateReligions(): void {
  Religions.regenerate();
  if (layerIsOn("toggleReligions")) drawReligions();
  if (layerIsOn("toggleGoods")) drawGoods();
}

function regenerateCultures(): void {
  Cultures.regenerate();
  if (layerIsOn("toggleCultures")) drawCultures();
  if (layerIsOn("toggleGoods")) drawGoods();
}

function regenerateMilitary(): void {
  Military.regenerate();
  if (layerIsOn("toggleMilitary")) drawMilitary();
}

function regenerateIce(): void {
  Ice.regenerate();
  if (layerIsOn("toggleIce")) drawIce();
}

function regenerateMarkers(): void {
  Markers.regenerate();
  if (layerIsOn("toggleMarkers")) invalidateMarkerSymbols();
}

function regenerateZones(event: MouseEvent): void {
  function applyZonesRegeneration(multiplier: number): void {
    Zones.regenerate(multiplier);
    refreshEditors();
    if (layerIsOn("toggleZones")) drawZones();
    if (layerIsOn("toggleGoods")) drawGoods();
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
