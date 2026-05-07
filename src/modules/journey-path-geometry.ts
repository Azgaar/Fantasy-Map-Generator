import { rn } from "../utils/numberUtils";

/** Quantized directed chord id for lane stacking (A→B ≠ B→A). */
export function chordKey(a: [number, number], b: [number, number]): string {
  return `${rn(a[0], 2)},${rn(a[1], 2)}->${rn(b[0], 2)},${rn(b[1], 2)}`;
}

/**
 * Fraction along chord A→B for point P (clamped to [0, 1]), matching `linearGradient`
 * `userSpaceOnUse` with axis from A to B (constant perpendicular to that axis).
 */
export function chordGradientT(
  a: [number, number],
  b: [number, number],
  px: number,
  py: number,
): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy;
  if (len2 < 1e-18) return 0;
  const t = ((px - a[0]) * vx + (py - a[1]) * vy) / len2;
  return Math.max(0, Math.min(1, t));
}

export const MIN_SEG_LEN = 0.05;
const LANE_WIDTH = 3.5;

/** Baseline arrow spacing at scale 1 (screen-ish); multiplied by tier below. */
const JOURNEY_ARROW_SPACING_BASE_PX = 38;

const LOD_TIER_MAX = 6;

const LOD_ARROW_SPACING_MUL: readonly number[] = [
  2.25, 1.9, 1.6, 1.35, 1.2, 1.08, 1,
];

/**
 * Discrete LOD tier from zoom `scale` vs minimum zoom extent (both > 0).
 * Tier rises as the user zooms in relative to `zoomMin`.
 */
export function journeyLodTier(scale: number, zoomMin: number): number {
  const s = Math.max(scale, 1e-9);
  const zmin = Math.max(zoomMin, 1e-9);
  const raw = Math.floor(Math.log2(s)) - Math.floor(Math.log2(zmin));
  return Math.max(0, Math.min(LOD_TIER_MAX, raw));
}

/** Polyline subdivisions for quadratic sampling; higher tier ⇒ smoother curve. */
export function journeyPolylineSamplesForTier(tier: number): number {
  const t = Math.max(0, Math.min(LOD_TIER_MAX, tier));
  return Math.min(44, Math.max(12, 14 + t * 5));
}

/** Fewer arrows when tier is low (zoomed out). */
export function journeyArrowSpacingMulForTier(tier: number): number {
  const t = Math.max(0, Math.min(LOD_TIER_MAX, tier));
  return LOD_ARROW_SPACING_MUL[t] ?? 1;
}

/** Arrow spacing in map units (~constant screen spacing × LOD density). */
export function journeyArrowSpacingMapUnits(
  scale: number,
  tier: number,
  spacingPx = JOURNEY_ARROW_SPACING_BASE_PX,
): number {
  const k = Math.max(scale, 1e-9);
  return (spacingPx * journeyArrowSpacingMulForTier(tier)) / k;
}

/** Max perpendicular lift at chord midpoint (fraction of chord length), scale ~ repeat index below. */
const BEND_BASE = 0.14;
/** Extra curvature per reuse count `k` of the same directed chord: bend *= (1 + k * CURVATURE_REPEAT_GAIN). */
const CURVATURE_REPEAT_GAIN = 0.45;

/**
 * SVG maps use Y-down; negate CCW left normal so traveler‑relative “left” matches screen intuition.
 */
const LEFT_NORMAL_SCREEN_SIGN = -1;

/** 0-based reuse index per directed chord (first traversal → 0, second identical chord → 1, …). */
export function directedChordOccurrenceIndex(
  points: [number, number][],
): number[] {
  const indices: number[] = [];
  const counters = new Map<string, number>();
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < MIN_SEG_LEN) {
      indices.push(0);
      continue;
    }
    const key = chordKey(p0, p1);
    const k = counters.get(key) ?? 0;
    indices.push(k);
    counters.set(key, k + 1);
  }
  return indices;
}

/** Chord midpoint perpendicular bend magnitude after applying repeat scaling. */
export function bendSegmentChord(len: number, repeatIndex: number): number {
  return (
    BEND_BASE * len * (1 + Math.max(0, repeatIndex) * CURVATURE_REPEAT_GAIN)
  );
}

/** Lane multiplier per segment (centered around 0) for duplicate directed chords. */
export function laneMultipliersForSegments(
  points: [number, number][],
): number[] {
  const keys: string[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < MIN_SEG_LEN) {
      keys.push("");
      continue;
    }
    keys.push(chordKey(p0, p1));
  }

  const counts = new Map<string, number>();
  for (const k of keys) {
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const idx = new Map<string, number>();
  const lanes: number[] = [];
  for (const k of keys) {
    if (!k || (counts.get(k) ?? 0) <= 1) {
      lanes.push(0);
      continue;
    }
    const c = counts.get(k)!;
    const slot = idx.get(k) ?? 0;
    idx.set(k, slot + 1);
    lanes.push(slot - (c - 1) / 2);
  }
  return lanes;
}

export function quadraticSamples(
  a: [number, number],
  b: [number, number],
  bendAmount: number,
  lane: number,
  samples: number,
): [number, number][] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const cx = mx + nx * bendAmount * LEFT_NORMAL_SCREEN_SIGN;
  const cy = my + ny * bendAmount * LEFT_NORMAL_SCREEN_SIGN;

  const pts: [number, number][] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const omt = 1 - t;
    let x = omt * omt * a[0] + 2 * omt * t * cx + t * t * b[0];
    let y = omt * omt * a[1] + 2 * omt * t * cy + t * t * b[1];
    const tx = 2 * omt * (cx - a[0]) + 2 * t * (b[0] - cx);
    const ty = 2 * omt * (cy - a[1]) + 2 * t * (b[1] - cy);
    const tlen = Math.hypot(tx, ty) || 1;
    const px = -ty / tlen;
    const py = tx / tlen;
    const fade = Math.sin(Math.PI * t);
    const off = lane * LANE_WIDTH * fade;
    x += px * off;
    y += py * off;
    pts.push([x, y]);
  }
  return pts;
}

export function polylinePath(pts: [number, number][]): string {
  if (pts.length === 0) return "";
  let d = `M${rn(pts[0][0], 2)},${rn(pts[0][1], 2)}`;
  for (let i = 1; i < pts.length; i++) {
    d += `L${rn(pts[i][0], 2)},${rn(pts[i][1], 2)}`;
  }
  return d;
}

export interface ArrowSample {
  x: number;
  y: number;
  angleDeg: number;
}

/** Arrow markers spaced along a polyline (map coords). */
export function arrowPositionsAlongPolyline(
  pts: [number, number][],
  spacing: number,
): ArrowSample[] {
  const result: ArrowSample[] = [];
  if (pts.length < 2 || spacing <= 0) return result;

  let cumulative = 0;
  let nextAt = spacing;

  for (let i = 0; i < pts.length - 1; i++) {
    const x0 = pts[i][0];
    const y0 = pts[i][1];
    const x1 = pts[i + 1][0];
    const y1 = pts[i + 1][1];
    const segLen = Math.hypot(x1 - x0, y1 - y0);
    if (segLen < 1e-9) continue;
    const angleDeg = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;

    const segEnd = cumulative + segLen;
    while (nextAt <= segEnd + 1e-9) {
      const alongSeg = nextAt - cumulative;
      const t = alongSeg / segLen;
      result.push({
        x: x0 + t * (x1 - x0),
        y: y0 + t * (y1 - y0),
        angleDeg,
      });
      nextAt += spacing;
    }
    cumulative = segEnd;
  }

  return result;
}

export function polylineLength(pts: [number, number][]): number {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    len += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  }
  return len;
}

/** Inclusive interval along the ramp for segment `segmentIndex` of `segmentCount` edges. */
export function segmentUInterval(
  segmentCount: number,
  segmentIndex: number,
): [number, number] {
  if (segmentCount <= 0) return [0, 0];
  const u0 = segmentIndex / segmentCount;
  const u1 = (segmentIndex + 1) / segmentCount;
  return [u0, u1];
}
