import { LAYER_CONTROLS_CHANGE_EVENT } from "@/components/layers/layer-controls";
import { pixiRendererController, syncPixiRendererVisibility } from "./pixi-renderer-controller";
import { registerPixiRendererEventBridge } from "./pixi-renderer-events";
import { activatePixiRendererOwnership } from "./pixi-renderer-ownership";

activatePixiRendererOwnership();
registerPixiRendererEventBridge(pixiRendererController);

const scheduleStart = (): void => {
  requestAnimationFrame(() => void pixiRendererController.start());
};

window.addEventListener("map:generated", scheduleStart);
window.addEventListener("map:loaded", scheduleStart);
window.addEventListener(LAYER_CONTROLS_CHANGE_EVENT, () => {
  requestAnimationFrame(syncPixiRendererVisibility);
});
