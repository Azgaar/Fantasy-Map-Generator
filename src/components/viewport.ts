// The svg viewport: the window onto the map. Size follows the browser window, transform follows the zoom
// behavior in components/zoom.ts. Everything in screen space reads its geometry from here
export const viewport = { width: 0, height: 0, scale: 1, x: 0, y: 0 };

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
