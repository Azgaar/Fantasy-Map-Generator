import { invalidatePixiRendererLayer } from "@/renderers/pixi/pixi-renderer-controller";
import { ensureEl } from "@/utils";

declare global {
  var drawTemperature: () => void;
}

const temperatureRenderer = (): void => {
  TIME && console.time("drawTemperature");

  ensureEl("temperature").replaceChildren();
  invalidatePixiRendererLayer("temperature");

  TIME && console.timeEnd("drawTemperature");
};

window.drawTemperature = temperatureRenderer;

export { temperatureRenderer as drawTemperature };
