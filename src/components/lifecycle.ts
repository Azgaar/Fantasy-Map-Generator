// The app and map lifecycle: start the app, erase what is on screen, generate a new world, put it back

import { applyGraphSize, fitMapToScreen } from "@/components/canvas";
import { closeDialogs, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { hideLoading, showLoading } from "@/components/loading";
import { restoreUi, syncInputs } from "@/components/options/tabs/options-tab";
import { setSeed } from "@/components/seed";
import { initShell, warnIfServerless } from "@/components/shell";
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { setViewportSize } from "@/components/viewport";
import { invokeActiveZooming, resetZoom } from "@/components/zoom";
import { Controllers } from "@/controllers";
import { GenerationPipeline } from "@/generators/generation-pipeline";
import { unfog } from "@/renderers/overlays/fogging";
import { initiateAutosave } from "@/services/autosave";
import { logStats } from "@/services/logging";
import { registerServiceWorker } from "@/services/platform";
import { checkLoadParameters } from "@/services/url-params";
import { cleanupData } from "@/services/versioning";
import type { GridGraph } from "@/types/GridGraph";
import { debounce, ensureEl, findEl, last, parseError } from "@/utils";

export interface MapHistoryEntry {
  seed: string;
  width: number;
  height: number;
  template: string;
  created: number;
}

let mapId = 0; // A map's id is the moment it was generated
const mapHistory: MapHistoryEntry[] = [];

export const getMapId = (): number => mapId;
export const getMapHistory = (): readonly MapHistoryEntry[] => mapHistory;

/** Take note of a map that is now on screen: a generated one is dated now, a loaded one keeps its own id */
export function registerMap(id: number = Date.now()): void {
  mapId = id;
  mapHistory.push({
    seed: options.seed,
    width: options.graph.width,
    height: options.graph.height,
    template: options.heightmap.template,
    created: mapId
  });
  window.mapsGenerated = mapHistory.length;
  window.dispatchEvent(
    new CustomEvent("map:generated", { detail: { seed: options.seed, mapId, mapsGenerated: mapHistory.length } })
  );
}

/** Bring the app up */
export async function boot(): Promise<void> {
  initShell();
  registerServiceWorker();

  Options.restoreStored(); // the options of the last session, then the search params
  syncInputs(); // options are the source of truth, the inputs only display them
  restoreUi(); // the tab's own restore: locks, style presets, theme, ui size
  setViewportSize(options.graph.width, options.graph.height);
  applyDefaultViewboxEvents();

  if (!warnIfServerless()) {
    hideLoading();
    await checkLoadParameters();
  }

  initiateAutosave();
}

export type GenerationConfig = { seed?: string; graph?: GridGraph };

/** Generate a whole new world. The pipeline owns the sequence, this owns everything around it */
export async function generate(config?: GenerationConfig): Promise<void> {
  try {
    const { seed: precreatedSeed, graph: precreatedGraph } = config || {};
    setSeed(precreatedSeed);
    Options.randomize();
    applyGraphSize();

    await GenerationPipeline.run({ seed: precreatedSeed, graph: precreatedGraph });

    syncInputs(); // after the pipeline: it names the map, which the panel shows
    Options.persist(); // what was generated is what the next session starts from
    registerMap(); // a generated map's id is the moment it was generated
    logStats();
    invokeActiveZooming();
  } catch (error) {
    ERROR && console.error(error);
    clearMainTip();

    ensureEl("alertMessage").innerHTML = /* html */ `An error has occurred on map generation. Please retry.
      <br />If error is critical, clear the stored data and try again.
      <p id="errorBox">${parseError(error as Error)}</p>`;

    $("#alert").dialog({
      resizable: false,
      title: "Generation error",
      width: "32em",
      buttons: {
        "Cleanup data": () => cleanupData(),
        Regenerate: function (this: HTMLElement) {
          regenerateMap("generation error");
          $(this).dialog("close");
        },
        Ignore: function (this: HTMLElement) {
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

  // a big grid takes long enough that the splash is worth showing
  const shouldShowLoading = options.graph.cellsDesired > 10000;
  shouldShowLoading && showLoading();

  closeDialogs("#worldConfigurator, #options3d");
  customization = 0;
  resetZoom(1000);
  undraw();
  await generate(typeof config === "string" ? undefined : config);
  Layers.drawAll();

  if (options.threeD.isOn) Controllers.View3d.redraw();
  if (findEl("worldConfigurator")?.offsetParent) Controllers.WorldConfigurator.open();

  fitMapToScreen();
  shouldShowLoading && hideLoading();
  clearMainTip();
}, 250);

/** Ask before throwing away a map the user has been working on for a while */
export function regeneratePrompt(config?: GenerationConfig): void {
  if (customization) {
    tip("New map cannot be generated when edit mode is active, please exit the mode and retry", false, "error");
    return;
  }

  const current = last(mapHistory);
  const workingMinutes = current ? (Date.now() - current.created) / 60000 : 0;
  if (workingMinutes < 1) {
    regenerateMap(config);
    return;
  }

  confirmationDialog({
    title: "Generate new map",
    message:
      "Are you sure you want to generate a new map?<br />All unsaved changes made to the current map will be lost",
    confirm: "Generate",
    onConfirm: () => {
      closeDialogs();
      regenerateMap(config);
    }
  });
}

/** Clear the map: every layer, the transient defs and the notes that described what was there */
export function undraw(): void {
  Layers.eraseAll();
  for (const el of ensureEl("deftemp").querySelectorAll("path, clipPath, svg")) el.remove();
  ensureEl("coas").innerHTML = ""; // auto-generated emblems are re-created on demand
  notes = [];
  unfog();
}

declare global {
  interface Window {
    mapId: number;
    mapsGenerated: number;
  }
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var regeneratePrompt: (config?: GenerationConfig) => void;
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var regenerateMap: (config?: GenerationConfig | string) => void;
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var undraw: () => void;
}
window.regeneratePrompt = regeneratePrompt;
window.regenerateMap = regenerateMap;
window.undraw = undraw;
