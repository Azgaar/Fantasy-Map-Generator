import type { Selection } from "d3";
import { interpolateRgbBasis } from "d3";
import { rn } from "../utils/numberUtils";

/** Rainbow ramp endpoints used as one continuous gradient sliced per segment. */
export const JOURNEY_RAINBOW_STOPS = [
  "#e81416",
  "#ff7518",
  "#ffdc00",
  "#32cd32",
  "#00bfff",
  "#4e529a",
  "#70389d",
];

const rampInterpolator = interpolateRgbBasis(JOURNEY_RAINBOW_STOPS);

/** Parameter `u` in [0, 1] along the whole journey ramp. */
export function journeyRampColor(u: number): string {
  return rampInterpolator(Math.max(0, Math.min(1, u)));
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

/** Quantized directed chord id for lane stacking (A→B ≠ B→A). */
export function chordKey(a: [number, number], b: [number, number]): string {
  return `${rn(a[0], 2)},${rn(a[1], 2)}->${rn(b[0], 2)},${rn(b[1], 2)}`;
}

const MIN_SEG_LEN = 0.05;
const LANE_WIDTH = 3.5;

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

function quadraticSamples(
  a: [number, number],
  b: [number, number],
  bendAmount: number,
  lane: number,
  samples: number,
): [number, number][] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  /** Left of travel direction (−v rotated CCW). Reverse traversal swaps normal ⇒ opposite bulge on chord. */
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

function polylinePath(pts: [number, number][]): string {
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

function polylineLength(pts: [number, number][]): number {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    len += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  }
  return len;
}

class JourneyDrawModule {
  redraw(
    defs: Selection<SVGDefsElement, unknown, null, undefined>,
    journeys: Selection<SVGGElement, unknown, null, undefined>,
  ): void {
    journeys.selectAll("*").remove();
    defs.selectAll("linearGradient.journey-def").remove();

    const points = (pack.journey?.points ?? []) as [number, number][];
    if (!points.length) return;

    const verts = journeys.append("g").attr("class", "journey-vertices");
    const halo = journeys.append("g").attr("class", "journey-halo");
    const strokes = journeys.append("g").attr("class", "journey-strokes");
    const arrows = journeys.append("g").attr("class", "journey-arrows");

    const seen = new Set<string>();
    for (const [x, y] of points) {
      const k = `${rn(x, 2)},${rn(y, 2)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      verts
        .append("circle")
        .attr("class", "journey-waypoint")
        .attr("data-jx", rn(x, 2))
        .attr("data-jy", rn(y, 2))
        .attr("cx", rn(x, 2))
        .attr("cy", rn(y, 2))
        .attr("r", 5)
        .attr("fill", "#ffffff")
        .attr("stroke", "#000000")
        .attr("stroke-width", 1.5)
        .style("cursor", "pointer");
    }

    const S = Math.max(0, points.length - 1);
    if (S < 1) return;

    const lanes = laneMultipliersForSegments(points);
    const repeats = directedChordOccurrenceIndex(points);

    for (let i = 0; i < S; i++) {
      const a = points[i];
      const b = points[i + 1];
      const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (segLen < MIN_SEG_LEN) continue;

      const lane = lanes[i] ?? 0;
      const k = repeats[i] ?? 0;
      const bendAmount = bendSegmentChord(segLen, k);

      const samp = quadraticSamples(a, b, bendAmount, lane, 28);
      const d = polylinePath(samp);
      if (!d) continue;

      const [u0, u1] = segmentUInterval(S, i);
      const c0 = journeyRampColor(u0);
      const c1 = journeyRampColor(u1);

      const gid = `journeyGrad_${i}`;
      const grad = defs
        .append("linearGradient")
        .attr("id", gid)
        .attr("class", "journey-def")
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", a[0])
        .attr("y1", a[1])
        .attr("x2", b[0])
        .attr("y2", b[1]);

      grad.append("stop").attr("offset", "0%").attr("stop-color", c0);
      grad.append("stop").attr("offset", "100%").attr("stop-color", c1);

      halo
        .append("path")
        .attr("d", d)
        .attr("fill", "none")
        .attr("stroke", "#000000")
        .attr("stroke-width", 6)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");

      strokes
        .append("path")
        .attr("d", d)
        .attr("fill", "none")
        .attr("stroke", `url(#${gid})`)
        .attr("stroke-width", 3.2)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");

      let arrPts = arrowPositionsAlongPolyline(samp, 38);
      if (!arrPts.length && polylineLength(samp) > MIN_SEG_LEN) {
        const mid = Math.max(1, Math.floor(samp.length / 2));
        const prev = mid - 1;
        const angleDeg =
          (Math.atan2(
            samp[mid][1] - samp[prev][1],
            samp[mid][0] - samp[prev][0],
          ) *
            180) /
          Math.PI;
        arrPts = [{ x: samp[mid][0], y: samp[mid][1], angleDeg }];
      }
      for (const ar of arrPts) {
        arrows
          .append("path")
          .attr("d", "M0,-2.8 L7.5,0 L0,2.8 Z")
          .attr("fill", "#222222")
          .attr("stroke", "#000000")
          .attr("stroke-width", 0.9)
          .attr(
            "transform",
            `translate(${rn(ar.x, 2)},${rn(ar.y, 2)}) rotate(${rn(ar.angleDeg, 2)})`,
          );
      }
    }
  }
}

if (typeof window !== "undefined") {
  window.JourneyDraw = new JourneyDrawModule();
}

declare global {
  var pack: import("../types/PackedGraph").PackedGraph;
  interface Window {
    JourneyDraw?: JourneyDrawModule;
  }
}
