import type { Regiment } from "@/generators/military-generator";
import { invalidatePixiRendererLayer } from "./pixi/pixi-renderer-controller";

/** Invalidates the renderer-neutral Military scene. Pixi is the only persistent owner. */
export function drawMilitary(): void {
  invalidatePixiRendererLayer("military");
}

export function drawRegiment(_regiment: Regiment, _stateId: number): void {
  drawMilitary();
}

export function moveRegiment(regiment: Regiment, x: number, y: number): void {
  regiment.x = x;
  regiment.y = y;
  drawMilitary();
}
