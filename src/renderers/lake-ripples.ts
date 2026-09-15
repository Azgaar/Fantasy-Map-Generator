import Alea from "alea";
import type { Styles } from "@/generators/styles-schema";
import type { Point } from "@/types/global";
import { wavyDash } from "@/utils/pathUtils";

export type LakeEmbellishment = Styles["lakes"]["groups"][string]["options"];

export interface LakeRipples {
  path: string;
  x: number; // bounds of the lake, for the mask
  y: number;
  width: number;
  height: number;
  gap: number; // blank water along the shore, in map units
}

// every length is in ripple units: the cell spacing, shrinking on lakes narrower than UNIT_CELLS cells
const UNIT_CELLS = 4;
const MIN_SIZE = 0.65; // lakes narrower than this, in cell spacings, or than MIN_SIZE_WIDTHS stroke widths, stay blank
const MIN_SIZE_WIDTHS = 8;
const POND_SIZE = 4; // lakes up to this many cell spacings across get a few open strokes instead of shore ripples
const POND_ROWS = 1.5; // strokes per cell spacing of pond height at density 1, clamped to [2, 5]
const POND_LENGTH = 1.5; // longest pond stroke at length 1, in cell spacings
const POND_MIN_LENGTH = 0.3; // shortest pond stroke, in cell spacings, or POND_MIN_WIDTHS stroke widths
const POND_MIN_WIDTHS = 6;
const POND_BOW = 0.04; // pond wave height, as a share of the stroke length
const ROW_GAP = 0.32; // between ripple rows at density 1
const AMPLITUDE = 0.045; // ripple wave height, capped at a fifth of the row gap
const REACH = 3; // ripples fade out this far from the shore
const FRINGE = 0.75; // share of the reach the ripple field extends to on average...
const FRINGE_WOBBLE = 0.15; // ...swelling and receding by this much along the shore
const DASH = 1.8; // shortest ripple at length 1; the longest is twice that
const MIN_DASH = 0.4; // no ripple shorter than this fits before the far shore
const HALF_PERIOD = 0.3; // ripple wave length is twice this

/** Fine shore ripples for lakes; a few open strokes for ponds. */
export function getLakeRipples(points: Point[], spacing: number, style: LakeEmbellishment, seed: string): LakeRipples {
  let x = Infinity;
  let y = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const [px, py] of points) {
    if (px < x) x = px;
    if (px > right) right = px;
    if (py < y) y = py;
    if (py > bottom) bottom = py;
  }
  const width = right - x;
  const height = bottom - y;
  const unit = Math.max(1, Math.min(spacing, Math.min(width, height) / UNIT_CELLS));
  const gap = Math.max(style.width, unit * style.halo);
  const bounds = { x, y, width, height, gap };

  const blank =
    points.length < 3 ||
    Math.min(width, height) < Math.max(spacing * MIN_SIZE, style.width * MIN_SIZE_WIDTHS) ||
    style.embellishment === "none";
  if (blank) return { ...bounds, path: "" };

  const random = Alea(seed);
  const path =
    Math.max(width, height) <= spacing * POND_SIZE
      ? getPondStrokes(points, spacing, style, bounds, random)
      : getShoreRipples(points, unit, style, bounds, random);
  return { ...bounds, path };
}

type Bounds = Omit<LakeRipples, "path">;

function getPondStrokes(
  points: Point[],
  spacing: number,
  style: LakeEmbellishment,
  bounds: Bounds,
  random: () => number
) {
  const { y, height, gap } = bounds;
  const rows = Math.max(2, Math.min(5, Math.round((height / spacing) * POND_ROWS * style.density)));
  const minLength = Math.max(spacing * POND_MIN_LENGTH, style.width * POND_MIN_WIDTHS);
  const parts: string[] = [];
  for (let i = 0; i < rows; i++) {
    const row = y + height * (0.2 + ((i + 0.5) / rows) * 0.6); // the middle three fifths of the pond
    const spans = getWaterSpans(points, row);
    for (let j = 0; j + 1 < spans.length; j += 2) {
      const available = spans[j + 1] - spans[j] - gap * 2;
      const length = Math.min(available * (0.55 + random() * 0.2), spacing * style.length * POND_LENGTH);
      if (length < minLength) continue;
      const left = spans[j] + gap + (available - length) * (0.35 + random() * 0.3);
      parts.push(
        style.embellishment === "lines"
          ? `M${left.toFixed(2)},${row.toFixed(2)}h${length.toFixed(2)}`
          : wavyDash(left, row, length, 2, length * POND_BOW)
      );
    }
  }
  return parts.join("");
}

function getShoreRipples(
  points: Point[],
  unit: number,
  style: LakeEmbellishment,
  bounds: Bounds,
  random: () => number
) {
  const { y, height, gap } = bounds;
  const rowGap = (unit * ROW_GAP) / style.density;
  const amplitude = Math.min(unit * AMPLITUDE, rowGap * 0.2);
  const reach = unit * REACH;
  const phase = random() * Math.PI * 2;
  const f = (value: number) => value.toFixed(2);
  const parts: string[] = [];

  for (
    let row = y + gap + rowGap * (0.4 + random() * 0.4);
    row < y + height - gap;
    row += rowGap * (0.9 + random() * 0.2)
  ) {
    const crossings = getWaterSpans(points, row);
    const nearby = getEdgesNear(points, row, reach);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const start = crossings[i] + gap;
      const end = crossings[i + 1] - gap;
      for (let left = start + unit * random() * 0.25; left < end; ) {
        const length = Math.min(unit * style.length * (DASH + random() * DASH), end - left);
        if (length < unit * MIN_DASH) break;
        const midpoint = left + length / 2;
        const distance = getShoreDistance(points, nearby, midpoint, row);
        const fringe =
          reach * (FRINGE + FRINGE_WOBBLE * Math.sin((midpoint / unit) * 0.7 + (row / unit) * 0.4 + phase));
        if (distance < fringe && random() < Math.min(1, (1 - distance / fringe) * 2)) {
          if (style.embellishment === "lines") parts.push(`M${f(left)},${f(row)}h${f(length)}`);
          else {
            const halves = Math.max(2, Math.round(length / (unit * HALF_PERIOD)));
            const up = random() < 0.5 ? -1 : 1;
            parts.push(wavyDash(left, row, length, halves, amplitude * up));
          }
        }
        left += length + unit * (0.15 + random() * 0.4);
      }
    }
  }
  return parts.join("");
}

/** x coordinates where the horizontal line at `row` crosses the outline, sorted: pairs bound water */
function getWaterSpans(points: Point[], row: number): number[] {
  const crossings: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    if (ay > row !== by > row) crossings.push(ax + ((row - ay) * (bx - ax)) / (by - ay));
  }
  return crossings.sort((a, b) => a - b);
}

/** indices of the outline edges whose y range comes within `reach` of `row` */
function getEdgesNear(points: Point[], row: number, reach: number): number[] {
  const edges: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const ay = points[i][1];
    const by = points[(i + 1) % points.length][1];
    if (row >= Math.min(ay, by) - reach && row <= Math.max(ay, by) + reach) edges.push(i);
  }
  return edges;
}

function getShoreDistance(points: Point[], edges: number[], px: number, py: number): number {
  let distance = Infinity;
  for (const i of edges) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    distance = Math.min(distance, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return distance;
}
