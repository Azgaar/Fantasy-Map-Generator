import { isCtrlClick } from "@/utils";
import {
  invalidatePixiRendererLayer,
  syncPixiRendererVisibility,
  updateMapInteractionOverlay
} from "./pixi/pixi-renderer-controller";

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

export function highlightMarketOn(marketId: number | string): void {
  const id = Number(marketId);
  const highlight = pack.cells.i
    .filter(cellId => pack.cells.market[cellId] === id)
    .map(cellId => ({
      kind: "polygon" as const,
      points: pack.cells.v[cellId].map(vertexId => {
        const [x, y] = pack.vertices.p[vertexId];
        return { x, y };
      })
    }));
  updateMapInteractionOverlay({ highlight });
}

export function highlightMarketOff(_marketId: number | string): void {
  updateMapInteractionOverlay({ highlight: null });
}

declare global {
  interface Window {
    toggleMarketsLayer: typeof toggleMarketsLayer;
  }
}

window.toggleMarketsLayer = toggleMarketsLayer;
