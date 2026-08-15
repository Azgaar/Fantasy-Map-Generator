import type { BurgAdded, BurgRemoved } from "@/generators/burgs-generator";
import { drawBurgIcon, removeBurgIcon } from "./draw-burg-icons";

export function renderBurgAdded({ burg, route }: BurgAdded): void {
  if (route && layerIsOn("toggleRoutes")) drawRoute(route);
  drawBurgIcon(burg);
}

export function renderBurgChanged(burg: BurgAdded["burg"]): void {
  drawBurgIcon(burg);
}

export function renderBurgRemoved({ burgId, hadEmblem }: BurgRemoved): void {
  if (hadEmblem) {
    document.getElementById(`burgCOA${burgId}`)?.remove();
    document.querySelector(`#emblems #burgEmblems > use[data-i='${burgId}']`)?.remove();
  }
  removeBurgIcon(burgId);
}
