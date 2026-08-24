import type { BurgAdded, BurgRemoved } from "@/generators/burgs-generator";
import { drawEmblems } from "./draw-emblems";
import { invalidateBurgSymbols } from "./point-symbols";

export function renderBurgAdded({ route }: BurgAdded): void {
  if (route && window.LayerControls.isLayerOn("toggleRoutes")) window.LayerControls.redrawLayer("toggleRoutes");
  invalidateBurgSymbols();
}

export function renderBurgChanged(_burg: BurgAdded["burg"]): void {
  invalidateBurgSymbols();
}

export function renderBurgRemoved({ burgId, hadEmblem }: BurgRemoved): void {
  if (hadEmblem) {
    document.getElementById(`burgCOA${burgId}`)?.remove();
    drawEmblems();
  }
  invalidateBurgSymbols();
}
