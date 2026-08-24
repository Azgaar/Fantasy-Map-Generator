import type { MarkerRenderState } from "./scene/layers/point-symbol-scene";

let visibleIds: Set<number> | null = null;
let pinnedOnly = false;

export function getMarkerRenderState(): MarkerRenderState {
  return { pinnedOnly, visibleIds };
}

export function setMarkerRenderFilter(ids: readonly number[] | null): void {
  visibleIds = ids ? new Set(ids) : null;
}

export function setMarkerPinnedOnly(value: boolean): void {
  pinnedOnly = value;
}

export function resetMarkerRenderState(): void {
  visibleIds = null;
  pinnedOnly = false;
}
