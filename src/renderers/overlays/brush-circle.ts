// The brush radius circle, drawn on #debug while a brush tool is active

import { rn } from "@/utils";

const DASHES = 16; // dashes and gaps around the circle, whatever its radius

/**
 * Show the brush radius circle at the given point, creating it if needed
 * @param {number} x - The x coordinate of the circle center
 * @param {number} y - The y coordinate of the circle center
 * @param {number} r - The circle radius
 */
export function moveCircle(x: number, y: number, r = 20): void {
  const circle =
    document.getElementById("brushCircle") ??
    document.getElementById("debug")?.insertAdjacentElement("afterbegin", createCircle());
  if (!circle) return;

  circle.setAttribute("cx", String(x));
  circle.setAttribute("cy", String(y));
  circle.setAttribute("r", String(r));
  // keep the outline readable down to a single-cell brush: dashes scale with the radius,
  // the stroke does not scale with the zoom
  circle.setAttribute("stroke-dasharray", String(rn((2 * Math.PI * r) / DASHES, 2)));
}

function createCircle(): SVGCircleElement {
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.id = "brushCircle";
  circle.setAttribute("vector-effect", "non-scaling-stroke");
  return circle;
}

/** Remove the brush radius circle */
export function removeCircle(): void {
  document.getElementById("brushCircle")?.remove();
}
