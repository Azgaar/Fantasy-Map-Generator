import { interpolateTurbo } from "d3";
import { Development } from "@/model/society/development-generator";
import { findEl } from "@/utils/node-utils";
import { getIsolines } from "@/utils/path-utils";
import { buildFillPaths } from "../isoline-fills";

const overlayId = "developmentOverlay";

/** From the dark stone ages through medieval greens and yellows to the reds of modern eras */
export function getEraColor(index: number): string {
  return interpolateTurbo(0.05 + (0.9 * index) / (Development.eras.length - 1));
}

export function drawDevelopmentOverlay(): void {
  removeDevelopmentOverlay();
  const debug = findEl("debug");
  const development = pack.cells.development;
  if (!debug || !development) return;

  const overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
  overlay.id = overlayId;
  overlay.style.opacity = "0.7";
  overlay.style.pointerEvents = "none";
  overlay.style.mask = "url(#land)";
  // eras shift by one so the first is not taken for a cell with no development
  const isolines = getIsolines(
    pack,
    cellId => (development[cellId] ? Development.getEraIndex(development[cellId]) + 1 : 0),
    { fill: true, waterGap: true }
  );
  overlay.innerHTML = buildFillPaths("era", isolines, index => getEraColor(index - 1));
  debug.appendChild(overlay);
}

export function removeDevelopmentOverlay(): void {
  findEl(overlayId)?.remove();
}

export const isDevelopmentOverlayShown = (): boolean => Boolean(findEl(overlayId));
