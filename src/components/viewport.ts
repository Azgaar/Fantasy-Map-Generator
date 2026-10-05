// The svg viewport: the window onto the map. Size follows the browser window, transform follows the zoom
// behavior in components/zoom.ts. Everything in screen space reads its geometry from here
export const viewport = { width: 0, height: 0, scale: 1, x: 0, y: 0 };

/** The layers whose font size follows the zoom, each on its own curve; every other layer keeps its sizes */
export const ZOOM_CURVES = {
  labels: (scale: number) => (100 + 100 / scale) / 2, // arithmetic
  markers: (scale: number) => 100 / Math.sqrt(scale), // geometric
  burgIcons: (scale: number) => 100 / (1 + (scale - 1) / 80) // near natural
} satisfies Record<string, (scale: number) => number>;

export type ZoomedLayer = keyof typeof ZOOM_CURVES;

/** The font size of a zoomed layer at a scale, in px */
export const zoomFontSize = (layer: ZoomedLayer, scale: number): number =>
  Math.max(Math.round(ZOOM_CURVES[layer](scale) * 100) / 100, 1);

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
