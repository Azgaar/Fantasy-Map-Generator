// Which view the map is shown in: the flat map, the 3D mesh or the globe

type ViewMode = "standard" | "mesh" | "globe";
let viewMode: ViewMode = "standard";

export function setViewMode(mode: ViewMode): void {
  viewMode = mode;
}

export const is3dView = (): boolean => viewMode !== "standard";
export const isGlobeView = (): boolean => viewMode === "globe";
