import { invalidatePixiRendererLayer } from "./pixi/pixi-renderer-controller";

/** Invalidates the renderer-neutral Ice scene. Pixi is the only persistent owner. */
export function drawIce(): void {
  invalidatePixiRendererLayer("ice");
}

export const redrawGlacier = (_id: number): void => drawIce();
export const redrawIceberg = (_id: number): void => drawIce();
