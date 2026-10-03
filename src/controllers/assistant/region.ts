// The map box a picture of the map shows: around an entity or a given box, in the picture's proportions

import type { Region } from "@/services/io/export";
import type { Point } from "@/types/global";
import { getBounds } from "@/utils/pathUtils";

const MIN_SPAN = 80; // map units shown around a point-like entity

/** A box around the points, padded unless `exact` (a given box), widened to the picture's proportions */
export function frameRegion(
  points: Point[],
  picture: { width: number; height: number },
  exact = false
): Region | undefined {
  if (!points.length) return undefined;
  const [x0, y0, x1, y1] = getBounds(points);
  const pad = exact ? 1 : 1.3;
  let span = [Math.max(x1 - x0, exact ? 1 : MIN_SPAN) * pad, Math.max(y1 - y0, exact ? 1 : MIN_SPAN) * pad];
  const ratio = picture.width / picture.height;
  span = span[0] / span[1] < ratio ? [span[1] * ratio, span[1]] : [span[0], span[0] / ratio];
  // kept inside the map where it fits, so an entity by the edge is not framed by emptiness
  const within = (center: number, size: number, limit: number) =>
    size >= limit ? limit / 2 : Math.min(Math.max(center, size / 2), limit - size / 2);
  const cx = within((x0 + x1) / 2, span[0], options.map.graph.width);
  const cy = within((y0 + y1) / 2, span[1], options.map.graph.height);
  return { x0: cx - span[0] / 2, y0: cy - span[1] / 2, x1: cx + span[0] / 2, y1: cy + span[1] / 2, ...picture };
}
