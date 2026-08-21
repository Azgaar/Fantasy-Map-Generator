import { isCtrlClick } from "@/utils";
import { invalidatePixiRendererLayer, syncPixiRendererVisibility } from "./pixi/pixi-renderer-controller";

/** Invalidates the renderer-neutral Markets scene. Pixi is the only persistent owner. */
export function drawMarkets(): void {
  invalidatePixiRendererLayer("markets");
}

export function toggleMarketsLayer(event?: MouseEvent): void {
  if (!layerIsOn("toggleMarketsLayer")) {
    turnButtonOn("toggleMarketsLayer");
    drawMarkets();
    if (event && isCtrlClick(event)) editStyle("markets");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("markets");
      return;
    }
    turnButtonOff("toggleMarketsLayer");
  }
  syncPixiRendererVisibility();
}

// Hover highlighting moves to renderer-independent picking/selection in M9.
export function highlightMarketOn(_marketId: number | string): void {}
export function highlightMarketOff(_marketId: number | string): void {}

declare global {
  interface Window {
    toggleMarketsLayer: typeof toggleMarketsLayer;
  }
}

window.toggleMarketsLayer = toggleMarketsLayer;
