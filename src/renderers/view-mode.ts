// Which view the map is shown in: the flat map, the 3D mesh, the globe or the Astral chart

import { notifyAstralView } from "@/app/chrome/astral-view";

export { subscribeAstralView } from "@/app/chrome/astral-view";

type ViewMode = "standard" | "mesh" | "globe";
type Cartography = "standard" | "astral";
let viewMode: ViewMode = "standard";
let cartography: Cartography = "standard";
let livingWorldEnabled = false;

export const getViewMode = (): ViewMode => viewMode;
export function setViewMode(mode: ViewMode): void {
  viewMode = mode;
}

export const is3dView = (): boolean => viewMode !== "standard";
export const isGlobeView = (): boolean => viewMode === "globe";
export const isAstralView = (): boolean => cartography === "astral";
export const isLivingWorldEnabled = (): boolean => livingWorldEnabled;

export function setLivingWorld(enabled: boolean): void {
  livingWorldEnabled = enabled;
}

export function setAstralView(on: boolean): void {
  const next: Cartography = on ? "astral" : "standard";
  if (cartography === next) return;

  cartography = next;
  notifyAstralView();
}
