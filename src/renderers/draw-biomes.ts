import { invalidatePixiRendererLayer } from "@/renderers/pixi/pixi-renderer-controller";
import { ensureEl } from "@/utils";

export function drawBiomes(): void {
  TIME && console.time("drawBiomes");
  ensureEl("biomes").replaceChildren();
  invalidatePixiRendererLayer("biomes");

  TIME && console.timeEnd("drawBiomes");
}

declare global {
  interface Window {
    drawBiomes: typeof drawBiomes;
  }
}

window.drawBiomes = drawBiomes;
