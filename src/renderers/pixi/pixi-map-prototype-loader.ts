import { LAYER_CONTROLS_CHANGE_EVENT } from "@/components/layers/layer-controls";
import {
  getPendingPixiTheme,
  type PixiMapPrototypeApi,
  pixiRendererController,
  setPendingPixiTheme,
  syncPixiRendererVisibility
} from "./pixi-renderer-controller";
import { registerPixiRendererEventBridge } from "./pixi-renderer-events";
import { getInitialPixiTheme } from "./pixi-renderer-startup";

export type { PixiMapPrototypeApi } from "./pixi-renderer-controller";

window.PixiMapPrototype = pixiRendererController;
registerPixiRendererEventBridge(pixiRendererController);

const scheduleEnable = (): void => {
  const theme = getPendingPixiTheme();
  if (theme) requestAnimationFrame(() => void pixiRendererController.enable(theme));
};

window.addEventListener("map:generated", scheduleEnable);
window.addEventListener("map:loaded", scheduleEnable);
window.addEventListener(LAYER_CONTROLS_CHANGE_EVENT, () => {
  requestAnimationFrame(syncPixiRendererVisibility);
});

const initialTheme = getInitialPixiTheme(location.search);
if (initialTheme) setPendingPixiTheme(initialTheme);

export const legacyPixiMapPrototypeApi: PixiMapPrototypeApi = pixiRendererController;
