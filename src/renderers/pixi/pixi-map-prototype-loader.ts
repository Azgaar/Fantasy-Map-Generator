import { LAYER_CONTROLS_CHANGE_EVENT } from "@/components/layers/layer-controls";
import {
  getPendingPixiTheme,
  type PixiMapPrototypeApi,
  pixiRendererController,
  setPendingPixiTheme,
  syncPixiRendererVisibility
} from "./pixi-renderer-controller";

export type { PixiMapPrototypeApi } from "./pixi-renderer-controller";

window.PixiMapPrototype = pixiRendererController;

const scheduleEnable = (): void => {
  const theme = getPendingPixiTheme();
  if (theme) requestAnimationFrame(() => void pixiRendererController.enable(theme));
};

window.addEventListener("map:generated", scheduleEnable);
window.addEventListener("map:loaded", scheduleEnable);
window.addEventListener(LAYER_CONTROLS_CHANGE_EVENT, () => {
  requestAnimationFrame(syncPixiRendererVisibility);
});

const params = new URLSearchParams(location.search);
if (params.get("renderer") === "pixi") {
  setPendingPixiTheme(params.get("pixiTheme") === "biomes" ? "biomes" : "states");
}

export const legacyPixiMapPrototypeApi: PixiMapPrototypeApi = pixiRendererController;
