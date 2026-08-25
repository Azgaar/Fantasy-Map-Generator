import { invalidatePixiRendererLayer } from "./pixi/pixi-renderer-controller";

/** Invalidates the renderer-neutral Military scene. Pixi is the only persistent owner. */
export function drawMilitary(): void {
  invalidatePixiRendererLayer("military");
}
