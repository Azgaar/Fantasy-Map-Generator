import Alea from "alea";
import type { Point } from "@/types/global";
import { getHeightContourChains } from "./heightmap-contours";

export interface HachureParams {
  points: Point[]; // cell centers of the jittered square grid, then the boundary pseudo-points
  heights: ArrayLike<number>; // one per point
  neighbors: number[][]; // one per cell: the boundary points have none
  triangles: number[][];
  spacing: number;
  cellsX: number;
  cellsY: number;
  inBand: (height: number) => boolean; // land or ocean cells
  thresholds: number[]; // the levels strokes are seeded along
  density: number; // strokes along a level, relative to the default
  length: number; // stroke length, relative to the default
  width: number; // stroke width at its root, relative to the default
  seed: string;
}

const STEP = 0.3; // sampling step along a stroke, in cell spacings
const ROW_GAP = 0.2; // gap between strokes along a level at density 1, in cell spacings
const LENGTH = 0.5; // longest stroke at length 1, in cell spacings
const WIDTH = 0.2; // root width of a stroke at width 1, in map units
const ROW_SCATTER = 0.45; // a seed slides this far down the fall line at most, in cell spacings, so rows don't show
const ROOT_JITTER = 0.06; // lateral root jitter, in cell spacings
const ANGLE_JITTER = 0.05; // slight heading variation, in radians
const MIN_LENGTH = 0.15; // shortest stroke, as a share of the longest: a few strokes are mere ticks
const FADE_STEPS = 2; // steps a stroke keeps running past the foot of the slope
// slopes in height units per cell spacing: terrain is generated per cell, so this holds across graph densities
const MIN_SLOPE = 1.8; // gentler ground draws nothing; a stroke reaching it is at the foot of the slope
const FULL_SLOPE = 4.5; // steeper ground draws the full stroke spacing, length and width
const MIN_LEVEL_DENSITY = 0.12; // low hills get occasional marks, keeping plains mostly white
const MAX_LEVEL_DENSITY = 0.9; // leave small breaks even on the strongest ridges
const LEVEL_POWER = 1.7; // favor upper slopes where the reference map concentrates hachures

/** least-squares plane gradient (dh/dx, dh/dy) at every cell, flattened as [gx0, gy0, gx1, gy1, ...] */
export function getSlopeGradients(points: Point[], heights: ArrayLike<number>, neighbors: number[][]): Float64Array {
  const gradients = new Float64Array(neighbors.length * 2);
  for (let i = 0; i < neighbors.length; i++) {
    const [x, y] = points[i];
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    let sxh = 0;
    let syh = 0;
    for (const n of neighbors[i]) {
      const dx = points[n][0] - x;
      const dy = points[n][1] - y;
      const dh = heights[n] - heights[i];
      sxx += dx * dx;
      syy += dy * dy;
      sxy += dx * dy;
      sxh += dx * dh;
      syh += dy * dh;
    }
    const det = sxx * syy - sxy * sxy;
    if (Math.abs(det) < 1e-9) continue;
    gradients[i * 2] = (sxh * syy - syh * sxy) / det;
    gradients[i * 2 + 1] = (syh * sxx - sxh * sxy) / det;
  }
  return gradients;
}

/** Engraved hachures: tapered strokes down the fall line, seeded along the levels, denser where steep. One filled path */
export function getHachures(params: HachureParams): string {
  const { points, heights, neighbors, triangles, spacing, cellsX, cellsY, inBand } = params;
  const { thresholds, density, length, width, seed } = params;
  const random = Alea(seed);
  const gradients = getSlopeGradients(points, heights, neighbors);
  const weightOf = (slope: number) => Math.min(1, Math.max(0, (slope - MIN_SLOPE) / (FULL_SLOPE - MIN_SLOPE)));
  let lowestLevel = Infinity;
  let highestLevel = -Infinity;
  for (let i = 0; i < heights.length; i++) {
    if (!inBand(heights[i])) continue;
    lowestLevel = Math.min(lowestLevel, heights[i]);
    highestLevel = Math.max(highestLevel, heights[i]);
  }
  if (!Number.isFinite(lowestLevel)) return "";
  const levelOf = (height: number) =>
    highestLevel === lowestLevel ? 1 : (height - lowestLevel) / (highestLevel - lowestLevel);

  const cellAt = (x: number, y: number): number => {
    if (x < 0 || y < 0) return -1;
    const column = Math.floor(x / spacing);
    const row = Math.floor(y / spacing);
    if (column >= cellsX || row >= cellsY) return -1;
    return row * cellsX + column;
  };

  // inverse-distance blend of the cell gradients around a point: the fall line without cell-edge kinks.
  // Called per stroke step, so it writes to `gx`/`gy` instead of allocating a tuple
  let gx = 0;
  let gy = 0;
  const blendGradient = (x: number, y: number, cell: number): void => {
    let sum = 1 / (0.01 + (points[cell][0] - x) ** 2 + (points[cell][1] - y) ** 2);
    gx = gradients[cell * 2] * sum;
    gy = gradients[cell * 2 + 1] * sum;
    for (const j of neighbors[cell]) {
      const w = 1 / (0.01 + (points[j][0] - x) ** 2 + (points[j][1] - y) ** 2);
      gx += gradients[j * 2] * w;
      gy += gradients[j * 2 + 1] * w;
      sum += w;
    }
    gx /= sum;
    gy /= sum;
  };

  const step = spacing * STEP;
  const gap = (spacing * ROW_GAP) / density;
  const parts: string[] = [];

  const trace = (x: number, y: number): { path: string | null; weight: number } => {
    const none = { path: null, weight: 0 };
    const cell = cellAt(x, y);
    if (cell < 0 || !inBand(heights[cell])) return none;
    blendGradient(x, y, cell);
    const weight = weightOf(Math.hypot(gx, gy) * spacing);
    if (!weight) return none;

    const angle = Math.atan2(-gy, -gx) + (random() - 0.5) * ANGLE_JITTER * (0.5 + weight);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const slide = random() * ROW_SCATTER * spacing;
    const lateral = (random() - 0.5) * ROOT_JITTER * spacing;
    x += dx * slide - dy * lateral;
    y += dy * slide + dx * lateral;

    // the stroke runs straight down the fall line at its root, as far as the ground stays steep
    const longest = LENGTH * length * spacing * (0.5 + 0.5 * weight);
    const wanted = longest * (MIN_LENGTH + (1 - MIN_LENGTH) * random() ** 1.5);
    let run = 0;
    let fading = 0;
    while (run < wanted) {
      const px = x + dx * (run + step);
      const py = y + dy * (run + step);
      const here = cellAt(px, py);
      if (here < 0 || !inBand(heights[here])) break;
      blendGradient(px, py, here);
      if (Math.hypot(gx, gy) * spacing < MIN_SLOPE && ++fading > FADE_STEPS) break;
      run += step;
    }
    if (run < step) return { path: null, weight };
    const rootWidth = WIDTH * width * (0.4 + 0.6 * weight) * (0.75 + random() * 0.5);
    return {
      path: taper(x, y, dx * Math.min(run, wanted), dy * Math.min(run, wanted), rootWidth),
      weight
    };
  };

  for (const chain of getHeightContourChains(points, heights, triangles, thresholds)) {
    const levelWeight = Math.min(1, Math.max(0, levelOf(chain.height)));
    const levelDensity = MIN_LEVEL_DENSITY + (MAX_LEVEL_DENSITY - MIN_LEVEL_DENSITY) * levelWeight ** LEVEL_POWER;
    if (random() > levelDensity) continue;
    const row = chain.closed ? [...chain.points, chain.points[0]] : chain.points;
    let untilNext = random() * gap;
    for (let i = 1; i < row.length; i++) {
      const [x0, y0] = row[i - 1];
      const [x1, y1] = row[i];
      const segment = Math.hypot(x1 - x0, y1 - y0);
      let along = untilNext;
      while (along < segment) {
        const t = along / segment;
        const { path, weight } = trace(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
        if (path) parts.push(path);
        // steep ground packs the strokes: the gap shrinks with the slope
        along += gap * (1.6 - weight) * (0.65 + random() * 0.7);
      }
      untilNext = along - segment;
    }
  }

  return parts.join("");
}

/** the outline of a straight stroke: `rootWidth` wide at (x, y), a sharp point at (x + dx, y + dy) */
export function taper(x: number, y: number, dx: number, dy: number, rootWidth: number): string {
  const d = Math.hypot(dx, dy) || 1;
  const ax = -dy / d; // across the stroke
  const ay = dx / d;
  const f = (v: number) => v.toFixed(2);
  const root = `M${f(x + (ax * rootWidth) / 2)},${f(y + (ay * rootWidth) / 2)}`;
  return `${root}l${f(dx - (ax * rootWidth) / 2)},${f(dy - (ay * rootWidth) / 2)}l${f(-dx - (ax * rootWidth) / 2)},${f(-dy - (ay * rootWidth) / 2)}Z`;
}
