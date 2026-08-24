import { invalidatePixiRendererLayer, updateMapInteractionOverlay } from "./pixi/pixi-renderer-controller";

/** Invalidates the renderer-neutral Markets scene. Pixi is the only persistent owner. */
export function drawMarkets(): void {
  invalidatePixiRendererLayer("markets");
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
