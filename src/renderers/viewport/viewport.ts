import type { ZoomSize } from "@/data/style-choices";

export const viewport = { width: 0, height: 0, scale: 1, x: 0, y: 0 };

/** The font size at a zoom scale, in % of the size at scale 1: from growing with the map to keeping its pixels */
const ZOOM_CURVES: Record<ZoomSize, (scale: number) => number> = {
  screen: scale => 100 / scale,
  arithmetic: scale => (100 + 100 / scale) / 2,
  geometric: scale => 100 / Math.sqrt(scale),
  natural: scale => 100 / (1 + (scale - 1) / 80),
  map: () => 100
};

/** The layers whose font size follows the zoom, each as its `zoomSize` style option says; every other layer keeps its sizes */
export const ZOOMED_LAYERS = ["labels", "markers", "burgIcons"] as const;
export type ZoomedLayer = (typeof ZOOMED_LAYERS)[number];

/** The font size of a zoomed layer at a scale, in px */
export const zoomFontSize = (layer: ZoomedLayer, scale: number): number =>
  Math.max(Math.round(ZOOM_CURVES[styles[layer].options.zoomSize as ZoomSize](scale) * 100) / 100, 1);

/** Set the svg resolution */
export function setViewportSize(width: number, height: number): void {
  viewport.width = width;
  viewport.height = height;
}

/** Set the map transform */
export function setViewportTransform(scale: number, x: number, y: number): void {
  viewport.scale = scale;
  viewport.x = x;
  viewport.y = y;
}
