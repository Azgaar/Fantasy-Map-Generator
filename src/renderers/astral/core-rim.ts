// Core–Rim: where the grid's temperature sits decides which edge reads core-ward.
// The field is equator-banded, not one-sided: a whole-globe map puts both extremes on one axis
// and the wash simply reads as irradiation bands — coherent, just a different label
import type { Point } from "@/types/global";

export interface WashAxis {
  hot: Point; // the warmest grid point — the core-ward end
  cold: Point; // the coldest — the rim end
}

/** The axis from where temperature peaks to where it bottoms out; null when the field is flat */
export function coreRimAxis(points: readonly Point[], temp: ArrayLike<number>): WashAxis | null {
  let hot = 0;
  let cold = 0;
  for (let i = 1; i < temp.length; i++) {
    if (temp[i] > temp[hot]) hot = i;
    if (temp[i] < temp[cold]) cold = i;
  }
  if (hot === cold || !points[hot] || !points[cold]) return null; // no rim to find in a flat field
  return { hot: points[hot], cold: points[cold] };
}
