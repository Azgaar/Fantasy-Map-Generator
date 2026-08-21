import { isCtrlClick } from "@/utils";
import { invalidatePixiRendererLayer, syncPixiRendererVisibility } from "./pixi/pixi-renderer-controller";

/** Invalidates the renderer-neutral Goods scene. Pixi is the only persistent owner. */
export function drawGoods(): void {
  invalidatePixiRendererLayer("goods");
}

export function toggleGoods(event?: MouseEvent): void {
  if (!layerIsOn("toggleGoods")) {
    turnButtonOn("toggleGoods");
    drawGoods();
    if (event && isCtrlClick(event)) editStyle("goodsIcons");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("goodsIcons");
      return;
    }
    turnButtonOff("toggleGoods");
  }
  syncPixiRendererVisibility();
}

declare global {
  interface Window {
    toggleGoods: typeof toggleGoods;
  }
}

window.toggleGoods = toggleGoods;
