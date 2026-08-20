import type { BurgAdded, BurgRemoved } from "@/generators/burgs-generator";
import { invalidateBurgSymbols } from "./point-symbols";

export function renderBurgAdded({ route }: BurgAdded): void {
  if (route && layerIsOn("toggleRoutes")) drawRoute(route);
  invalidateBurgSymbols();
}

export function renderBurgChanged(_burg: BurgAdded["burg"]): void {
  invalidateBurgSymbols();
}

export function renderBurgRemoved({ burgId, hadEmblem }: BurgRemoved): void {
  if (hadEmblem) {
    document.getElementById(`burgCOA${burgId}`)?.remove();
    document.querySelector(`#emblems #burgEmblems > use[data-i='${burgId}']`)?.remove();
  }
  invalidateBurgSymbols();
}
