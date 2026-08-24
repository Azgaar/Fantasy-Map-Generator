import { LAYER_CONTROLS_CHANGE_EVENT } from "@/components/layers/layer-controls";
import { bindRendererCommands, rendererCommands } from "@/renderers/core/renderer-commands";
import { pixiRendererController, preloadPixiRenderer, syncPixiRendererVisibility } from "./pixi-renderer-controller";
import { activatePixiRendererOwnership } from "./pixi-renderer-ownership";

activatePixiRendererOwnership();
bindRendererCommands(pixiRendererController);
window.MapRendererCommands = rendererCommands;

// Fetch and parse Pixi while generation and the rest of application startup continue.
void preloadPixiRenderer().catch(() => undefined);

const scheduleStart = (): void => {
  requestAnimationFrame(() => void pixiRendererController.start().catch(showRendererFailure));
};

export function showRendererFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : "Unable to initialize graphics acceleration";
  const existing = document.getElementById("pixi-renderer-failure");
  const alert = existing ?? document.createElement("div");
  alert.id = "pixi-renderer-failure";
  alert.setAttribute("role", "alert");
  alert.className = "pixi-renderer-failure";
  alert.textContent = `The map renderer could not start. Enable WebGL or WebGPU and reload the page. ${message}`;
  if (!existing) document.getElementById("map")?.before(alert);
}

window.addEventListener("map:generated", scheduleStart);
window.addEventListener("map:loaded", scheduleStart);
window.addEventListener(LAYER_CONTROLS_CHANGE_EVENT, () => {
  requestAnimationFrame(syncPixiRendererVisibility);
});
