// Pure geometry for the marker "in radius" rings. No DOM / globals so it can be unit-tested directly.

/**
 * Convert a real-world radius (in the user's distance unit) to map pixels.
 * @param distance ring radius in the map's distance unit (mi, km, …)
 * @param distanceScale user distance-units per map pixel
 */
export function radiusPxFor(distance: number, distanceScale: number): number {
  return distance / distanceScale;
}
