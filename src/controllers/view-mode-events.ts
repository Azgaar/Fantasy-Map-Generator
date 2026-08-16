export const VIEW_MODE_CHANGE_EVENT = "fmg-view-mode-change";

export type ViewMode = "viewGlobe" | "viewMesh" | "viewStandard";

export function dispatchViewModeChange(mode: ViewMode): void {
  window.dispatchEvent(new CustomEvent<ViewMode>(VIEW_MODE_CHANGE_EVENT, { detail: mode }));
}
