import { updateMapInteractionOverlay } from "../pixi/pixi-renderer-controller";

// The brush radius circle, drawn on the transient interaction overlay while a brush tool is active

/**
 * Show the brush radius circle at the given point, creating it if needed
 * @param {number} x - The x coordinate of the circle center
 * @param {number} y - The y coordinate of the circle center
 * @param {number} r - The circle radius
 */
export function moveCircle(x: number, y: number, r = 20): void {
  updateMapInteractionOverlay({ brush: { center: { x, y }, radius: r } });
}

/** Remove the brush radius circle */
export function removeCircle(): void {
  updateMapInteractionOverlay({ brush: null });
}
