import type { JourneyPoint } from "@/types/Journey";
import { rn } from "@/utils";

/** An edge stretched beyond this multiple of the reference spacing gets subdivided. */
export const RESAMPLE_THRESHOLD = 1.75;

/** Hard cap so repeated edits can never grow a path without bound. */
export const MAX_PATH_POINTS = 500;

const distance = (a: JourneyPoint, b: JourneyPoint): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

/**
 * Median gap between consecutive points — the spacing a path is expected to keep.
 *
 * Median rather than mean because a couple of edges stretched by dragging would
 * inflate a mean enough to suppress the very resampling they should trigger.
 */
export const medianSpacing = (points: JourneyPoint[]): number => {
  if (points.length < 2) return 0;

  const lengths: number[] = [];
  for (let i = 1; i < points.length; i++) lengths.push(distance(points[i - 1], points[i]));
  lengths.sort((a, b) => a - b);

  const mid = Math.floor(lengths.length / 2);
  return lengths.length % 2 ? lengths[mid] : (lengths[mid - 1] + lengths[mid]) / 2;
};

/**
 * Refill the edges touching `index` with evenly spaced points when dragging has
 * stretched them well past `spacing`, so a lengthened path keeps enough handles
 * to stay editable.
 *
 * Inserted points lie on the straight line they subdivide, so the route's shape
 * and length are unchanged — this only adds grab handles.
 */
export const resampleAround = (
  points: JourneyPoint[],
  index: number,
  spacing: number,
  cellAt: (x: number, y: number) => number | undefined
): JourneyPoint[] => {
  if (spacing <= 0 || points.length < 2) return points;

  const result = points.slice();

  // Edge e joins points[e] and points[e+1], so the dragged point touches edges
  // index-1 and index. Walk them right-to-left so an insertion never shifts an
  // edge index still to be processed.
  const edges = [index, index - 1].filter(e => e >= 0 && e + 1 < result.length);

  for (const edge of edges) {
    const a = result[edge];
    const b = result[edge + 1];
    const length = distance(a, b);
    if (length <= spacing * RESAMPLE_THRESHOLD) continue;

    const room = MAX_PATH_POINTS - result.length;
    const parts = Math.min(Math.round(length / spacing), room + 1);
    if (parts < 2) continue;

    const inserted: JourneyPoint[] = [];
    for (let k = 1; k < parts; k++) {
      const t = k / parts;
      const x = rn(a[0] + (b[0] - a[0]) * t, 2);
      const y = rn(a[1] + (b[1] - a[1]) * t, 2);
      inserted.push([x, y, cellAt(x, y) ?? a[2]]);
    }
    result.splice(edge + 1, 0, ...inserted);
  }

  return result;
};
