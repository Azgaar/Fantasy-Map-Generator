import { invalidatePixiRendererLayer } from "./pixi/pixi-renderer-controller";
import { setMarkerRenderFilter, setMarkerPinnedOnly } from "./marker-render-state";

export function invalidateBurgSymbols(): void {
  invalidatePixiRendererLayer("burgIcons");
}

export function invalidateMarkerSymbols(): void {
  invalidatePixiRendererLayer("markers");
}

export function filterMarkerSymbols(ids: readonly number[] | null): void {
  setMarkerRenderFilter(ids);
  invalidateMarkerSymbols();
}

export function showOnlyPinnedMarkers(value: boolean): void {
  setMarkerPinnedOnly(value);
  invalidateMarkerSymbols();
}
