import { minmax } from "./numberUtils";

export interface PanZoom {
  k: number;
  x: number;
  y: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 32;
export const PAN_ZOOM_IDENTITY: PanZoom = { k: 1, x: 0, y: 0 };

// keep the scaled content covering the whole viewport
export function clampPanZoom({ k, x, y }: PanZoom, viewport: Viewport): PanZoom {
  return {
    k,
    x: minmax(x, viewport.width * (1 - k), 0),
    y: minmax(y, viewport.height * (1 - k), 0)
  };
}

// rescale by factor keeping the content point under `point` fixed
export function zoomAt(
  t: PanZoom,
  point: { x: number; y: number },
  factor: number,
  viewport: Viewport,
  maxK = MAX_ZOOM
): PanZoom {
  const k = minmax(t.k * factor, MIN_ZOOM, Math.max(MIN_ZOOM, maxK));
  const ratio = k / t.k;
  return clampPanZoom({ k, x: point.x - (point.x - t.x) * ratio, y: point.y - (point.y - t.y) * ratio }, viewport);
}

export function panBy(t: PanZoom, dx: number, dy: number, viewport: Viewport): PanZoom {
  return clampPanZoom({ k: t.k, x: t.x + dx, y: t.y + dy }, viewport);
}
