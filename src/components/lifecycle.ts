// The app and map lifecycle: start the app, erase what is on screen, generate a new world, put it back
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { hideLoading, showLoading } from "@/components/loading";
import { readScaleInputs } from "@/components/options";
import { setSeed } from "@/components/seed";
import { warnIfServerless } from "@/components/shell";
import { clearMainTip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { invokeActiveZooming, resetZoom } from "@/components/zoom";
import { Controllers } from "@/controllers";
import { GenerationPipeline } from "@/generators/generation-pipeline";
import { unfog } from "@/renderers/overlays/fogging";
import { initiateAutosave } from "@/services/autosave";
import { registerServiceWorker } from "@/services/platform";
import { logStats } from "@/services/stats";
import { checkLoadParameters } from "@/services/url-params";
import { cleanupData } from "@/services/versioning";
import type { GridGraph } from "@/types/GridGraph";
import { debounce, ensureEl, findEl, parseError } from "@/utils";

export async function boot(): Promise<void> {
  registerServiceWorker();

  readScaleInputs(); // before applyStoredOptions, which overrides distanceScale from localStorage
  applyStoredOptions();

  // the voronoi graph extent is fixed for the life of a map, the svg canvas is resized to the window
  graphWidth = +ensureEl<HTMLInputElement>("mapWidthInput").value;
  graphHeight = +ensureEl<HTMLInputElement>("mapHeightInput").value;
  svgWidth = graphWidth;
  svgHeight = graphHeight;

  // binds the zoom behaviour and its handlers (see components/viewbox-events.ts), so it has to run
  // before checkLoadParameters - deep links (MFCG, a stored view position) zoom the map on load
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
    applyGraphSize();
    randomizeOptions();

    await GenerationPipeline.run({ seed: precreatedSeed, graph: precreatedGraph });

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
  WARN && console.warn("Generate new random map");

  // a big grid takes long enough that the splash is worth showing
  const cellsDesired = +(ensureEl("pointsInput").dataset.cells ?? 0);
  const shouldShowLoading = cellsDesired > 10000;
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

/** Clear the map: every layer, the transient defs and the notes that described what was there */
export function undraw(): void {
  Layers.eraseAll();
  for (const el of ensureEl("deftemp").querySelectorAll("path, clipPath, svg")) el.remove();
  ensureEl("coas").innerHTML = ""; // auto-generated emblems are re-created on demand
  notes = [];
  unfog();
}

// Legacy seam: classic public/ code regenerates and clears the map through the globals
declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var regenerateMap: (config?: GenerationConfig | string) => void;
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var undraw: () => void;
}
window.regenerateMap = regenerateMap;
window.undraw = undraw;
