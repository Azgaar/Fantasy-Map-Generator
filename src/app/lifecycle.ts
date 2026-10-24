// The app and map lifecycle: start the app, erase what is on screen, generate a new world, put it back

import { restoreUi, syncOptionInputs } from "@/app/chrome/tabs/options-tab";
import { hideLoading, showLoading } from "@/app/loading";
import { setSeed } from "@/app/seed";
import { initShell, warnIfServerless } from "@/app/shell";
import { Controllers } from "@/controllers";
import { getPointsNumber } from "@/data/graph-density";
import { GenerationPipeline } from "@/model/generation-pipeline";
import { Icons } from "@/model/icons";
import { mapHistory, registerMap } from "@/model/map-history";
import { Options } from "@/model/options/options-model";
import { Layers } from "@/renderers/layers";
import { undraw } from "@/renderers/undraw";
import { is3dView } from "@/renderers/view-mode";
import { setViewportSize } from "@/renderers/viewport/viewport";
import { stashCallbackToken } from "@/services/assistant/azgaar-server/auth";
import { initiateAutosave } from "@/services/autosave";
import { declareDefaultFonts } from "@/services/fonts";
import { adoptLegacyIconSlots } from "@/services/io/styles-legacy";
import { logStats } from "@/services/logging";
import { registerServiceWorker } from "@/services/platform";
import { checkLoadParameters } from "@/services/url-params";
import { cleanupData } from "@/services/versioning";
import type { GridGraph } from "@/types/grid-graph";
import { closeDialogs, confirmationDialog, initDialogPositionPersistence } from "@/ui/dialog/dialog-helpers";
import { applyGraphSize, fitMapToScreen } from "@/ui/map/canvas";
import { applyDefaultViewboxEvents } from "@/ui/map/viewbox-events";
import { invokeActiveZooming, resetZoom } from "@/ui/map/zoom";
import { clearMainTip, tip } from "@/ui/tooltips";
import { debounce, parseError } from "@/utils/common-utils";
import { t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/node-utils";

/** Bring the app up */
export async function boot(): Promise<void> {
  stashCallbackToken(); // before anything reads the URL: the OAuth fragment is not a load parameter
  registerServiceWorker();
  initShell();
  initDialogPositionPersistence();
  declareDefaultFonts();

  Options.restore();
  await Options.restoreIcons(); // kept in IndexedDB, and needed before the first map draws
  adoptLegacyIconSlots(options.map.military.units); // the unit types a browser kept from before v1.154.0
  syncOptionInputs();
  restoreUi();
  setViewportSize(options.map.graph.width, options.map.graph.height);
  applyDefaultViewboxEvents();

  if (!warnIfServerless()) {
    hideLoading();
    await checkLoadParameters();
  }

  initiateAutosave();
}

export type GenerationConfig = {
  seed?: string;
  graph?: GridGraph;
  width?: number;
  height?: number;
  points?: number;
  jitter?: number;
};

/** Generate a whole new world */
export async function generate(config?: GenerationConfig): Promise<void> {
  try {
    const { seed: precreatedSeed, graph: precreatedGraph, width, height, points, jitter } = config || {};
    Options.setGraphSize(width, height);
    setSeed(precreatedSeed);
    Options.randomize();
    Icons.syncCustom(); // the carried-over custom icons, and the stored ones at startup
    if (precreatedGraph) {
      // the map is built on the given graph, whatever the settings ask for meanwhile
      if (points !== undefined) options.map.graph.points = points;
      if (jitter !== undefined) options.map.graph.jitter = jitter;
      options.map.graph.sampling = precreatedGraph.sampling;
    }
    applyGraphSize(); // TODO: DOM change, not part of generation

    await GenerationPipeline.run({ graph: precreatedGraph });
    Options.persist();

    syncOptionInputs();
    registerMap();
    logStats();
    invokeActiveZooming();
  } catch (error) {
    ERROR && console.error(error);
    clearMainTip();

    ensureEl("alertMessage").innerHTML =
      /* html */ `${t("An error has occurred on map generation. Please retry.")}<br>${t("If error is critical, clear the stored data and try again.")}
      <p id="errorBox">${parseError(error as Error)}</p>`;

    $("#alert").dialog({
      resizable: false,
      title: t("Generation error"),
      width: "32em",
      buttons: {
        [t("Cleanup data")]: () => cleanupData(),
        [t("Regenerate")]: function (this: HTMLElement) {
          regenerateMap("generation error");
          $(this).dialog("close");
        },
        [t("Ignore")]: function (this: HTMLElement) {
          $(this).dialog("close");
        }
      },
      position: { my: "center", at: "center", of: "svg" }
    });
  }
}

/** Replace the current map with a new one. Debounced: the hotkey and the button both fire it */
export const regenerateMap = debounce(async (config?: GenerationConfig | string) => {
  const reason = typeof config === "string" ? config : "user request";
  WARN && console.warn(`Generate new random map: ${reason}`);

  // a big grid takes long enough that the splash is worth showing. The size asked for, not the
  // one on screen: the map being replaced says nothing about how long the next one will take
  const shouldShowLoading = getPointsNumber(options.generation.graph.density) > 10000;
  shouldShowLoading && showLoading();

  closeDialogs("#worldConfigurator, #options3d");
  options.app.mode = null;
  resetZoom(1000);
  undraw();
  await generate(typeof config === "string" ? undefined : config);
  Layers.drawAll();

  if (is3dView()) Controllers.View3d.redraw();
  if (findEl("worldConfigurator")?.offsetParent) Controllers.WorldConfigurator.open();

  fitMapToScreen();
  shouldShowLoading && hideLoading();
  clearMainTip();
}, 250);

/** Ask before throwing away a map the user has been working on for a while */
export function regeneratePrompt(config?: GenerationConfig): void {
  if (options.app.mode) {
    tip(t("New map cannot be generated when edit mode is active, please exit the mode and retry"), false, "error");
    return;
  }

  const current = mapHistory.at(-1);
  const workingMinutes = current ? (Date.now() - current.registeredAt) / 60000 : 0;
  if (workingMinutes < 1) {
    regenerateMap(config);
    return;
  }

  confirmationDialog({
    title: t("Generate New Map"),
    message: `${t("Are you sure you want to generate a new map?")}<br>${t("All unsaved changes made to the current map will be lost")}`,
    confirm: t("Generate"),
    onConfirm: () => {
      closeDialogs();
      regenerateMap(config);
    }
  });
}
