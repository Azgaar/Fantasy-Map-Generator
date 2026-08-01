// Pure geometry for the party travel-range rings. No DOM / globals so it can be unit-tested directly.

/**
 * Convert a real-world radius (in the user's distance unit) to map pixels.
 * @param distance ring radius in the map's distance unit (mi, km, …)
 * @param distanceScale user distance-units per map pixel
 */
export function radiusPxFor(distance: number, distanceScale: number): number {
  return distance / distanceScale;
}

/**
 * Zoom scale that fits a ring's diameter into the smaller viewport dimension, clamped to the zoom extent.
 * @param radiusPx ring radius in map pixels
 * @param viewportW viewport width in screen pixels
 * @param viewportH viewport height in screen pixels
 * @param extent [min, max] zoom scale bounds
 * @param fit fraction of the viewport the ring should fill (margin), default 0.9
 */
export function fitZoom(
  radiusPx: number,
  viewportW: number,
  viewportH: number,
  extent: [number, number],
  fit = 0.9
): number {
  if (!(radiusPx > 0)) return extent[1]; // sub-pixel / invalid radius → max zoom, never NaN
  const raw = (fit * Math.min(viewportW, viewportH)) / (2 * radiusPx);
  const [min, max] = extent;
  return Math.max(min, Math.min(max, raw));
}
