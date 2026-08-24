import { invalidatePixiRendererLayer } from "./pixi/pixi-renderer-controller";

/** Invalidates the renderer-neutral Goods scene. Pixi is the only persistent owner. */
export function drawGoods(): void {
  invalidatePixiRendererLayer("goods");
}
