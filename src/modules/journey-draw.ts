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

/** Arrowhead path (local coords before translate/rotate); 1.5× earlier triangle. */
const ARROW_PATH_D = "M0,-4.2 L11.25,0 L0,4.2 Z";

const MIN_SEG_LEN = 0.05;
const LANE_WIDTH = 3.5;

/** Target screen px under `#viewbox` scale (stroke-width × scale ≈ px). */
const JOURNEY_STROKE_SCREEN_PX = 3.2;
const JOURNEY_WAYPOINT_R_SCREEN_PX = 5;
const JOURNEY_WAYPOINT_STROKE_SCREEN_PX = 1.5;
const JOURNEY_HALO_DILATE_SCREEN_PX = 3;
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

function mapMetricScreenToWorld(
  screenPx: number,
  zoomScale: number,
  lo: number,
  hi: number,
): number {
  const k = Math.max(zoomScale, 1e-9);
  return Math.min(hi, Math.max(lo, screenPx / k));
}

function arrowTransform(
  x: number,
  y: number,
  angleDeg: number,
  zoomScale: number,
): string {
  const inv = rn(1 / Math.max(zoomScale, 1e-9), 6);
  return `translate(${rn(x, 2)},${rn(y, 2)}) rotate(${rn(angleDeg, 2)}) scale(${inv})`;
}

/** Single defs filter id: dilated silhouette behind segment stroke + arrows (unified halo). */
const JOURNEY_OUTLINE_FILTER_ID = "journeyUnifiedOutline";

function ensureJourneyOutlineFilter(
  defs: Selection<SVGDefsElement, unknown, null, undefined>,
  morphologyRadiusMap: number,
): void {
  defs.select(`filter#${JOURNEY_OUTLINE_FILTER_ID}`).remove();
  const f = defs
    .append("filter")
    .attr("id", JOURNEY_OUTLINE_FILTER_ID)
    .attr("class", "journey-outline-filter")
    .attr("color-interpolation-filters", "sRGB")
    .attr("x", "-50%")
    .attr("y", "-50%")
    .attr("width", "200%")
    .attr("height", "200%");

  f.append("feMorphology")
    .attr("in", "SourceAlpha")
    .attr("operator", "dilate")
    .attr("radius", rn(morphologyRadiusMap, 3))
    .attr("result", "dilatedAlpha");

  f.append("feFlood")
    .attr("flood-color", "#000000")
    .attr("result", "outlineFlood");

  f.append("feComposite")
    .attr("in", "outlineFlood")
    .attr("in2", "dilatedAlpha")
    .attr("operator", "in")
    .attr("result", "outlineShape");

  const merge = f.append("feMerge");
  merge.append("feMergeNode").attr("in", "outlineShape");
  merge.append("feMergeNode").attr("in", "SourceGraphic");
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

export class JourneyDrawModule {
  private lastLodTier: number | null = null;

  /** Full rebuild (data / LOD tier geometry). Pass current viewbox `scale` and zoom extent min for LOD. */
  redraw(
    defs: Selection<SVGDefsElement, unknown, null, undefined>,
    journeys: Selection<SVGGElement, unknown, null, undefined>,
    zoomScale = 1,
    zoomMinForLod = 0.05,
  ): void {
    journeys.selectAll("*").remove();
    defs.selectAll("linearGradient.journey-def").remove();
    defs.select(`filter#${JOURNEY_OUTLINE_FILTER_ID}`).remove();

    const points = (pack.journey?.points ?? []) as [number, number][];
    if (!points.length) {
      this.lastLodTier = null;
      return;
    }

    const zs = Number.isFinite(zoomScale) ? zoomScale : 1;
    const zm = Number.isFinite(zoomMinForLod) ? zoomMinForLod : 0.05;

    const verts = journeys.append("g").attr("class", "journey-vertices");

    const waypointR = mapMetricScreenToWorld(
      JOURNEY_WAYPOINT_R_SCREEN_PX,
      zs,
      0.15,
      80,
    );
    const waypointSw = mapMetricScreenToWorld(
      JOURNEY_WAYPOINT_STROKE_SCREEN_PX,
      zs,
      0.03,
      24,
    );

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
        .attr("r", rn(waypointR, 3))
        .attr("fill", "#ffffff")
        .attr("stroke", "#000000")
        .attr("stroke-width", rn(waypointSw, 3))
        .style("cursor", "pointer");
    }

    const S = Math.max(0, points.length - 1);
    if (S < 1) {
      this.lastLodTier = journeyLodTier(zs, zm);
      return;
    }

    const tier = journeyLodTier(zs, zm);
    const samples = journeyPolylineSamplesForTier(tier);
    const arrowSpacing = journeyArrowSpacingMapUnits(zs, tier);
    const morphR = mapMetricScreenToWorld(
      JOURNEY_HALO_DILATE_SCREEN_PX,
      zs,
      0.35,
      40,
    );

    ensureJourneyOutlineFilter(defs, morphR);
    const segmentsRoot = journeys.append("g").attr("class", "journey-segments");

    const lanes = laneMultipliersForSegments(points);
    const repeats = directedChordOccurrenceIndex(points);

    const strokeW = mapMetricScreenToWorld(
      JOURNEY_STROKE_SCREEN_PX,
      zs,
      0.06,
      24,
    );

    for (let i = 0; i < S; i++) {
      const a = points[i];
      const b = points[i + 1];
      const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (segLen < MIN_SEG_LEN) continue;

      const lane = lanes[i] ?? 0;
      const k = repeats[i] ?? 0;
      const bendAmount = bendSegmentChord(segLen, k);

      const samp = quadraticSamples(a, b, bendAmount, lane, samples);
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

      const seg = segmentsRoot
        .append("g")
        .attr("class", "journey-segment")
        .attr("filter", `url(#${JOURNEY_OUTLINE_FILTER_ID})`);

      seg
        .append("path")
        .attr("class", "journey-segment-stroke")
        .attr("d", d)
        .attr("fill", "none")
        .attr("stroke", `url(#${gid})`)
        .attr("stroke-width", rn(strokeW, 3))
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");

      let arrPts = arrowPositionsAlongPolyline(samp, arrowSpacing);
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
        const gt = chordGradientT(a, b, ar.x, ar.y);
        const arrowColor = journeyRampColor(u0 + gt * (u1 - u0));
        seg
          .append("path")
          .attr("class", "journey-arrow")
          .attr("d", ARROW_PATH_D)
          .attr("fill", arrowColor)
          .attr("data-ar-x", rn(ar.x, 2))
          .attr("data-ar-y", rn(ar.y, 2))
          .attr("data-ar-ang", rn(ar.angleDeg, 2))
          .attr("transform", arrowTransform(ar.x, ar.y, ar.angleDeg, zs));
      }
    }

    this.lastLodTier = tier;
  }

  /** Zoom-only updates: cheap attr patch if LOD tier unchanged; else full `redraw`. */
  syncZoom(
    defs: Selection<SVGDefsElement, unknown, null, undefined>,
    journeys: Selection<SVGGElement, unknown, null, undefined>,
    zoomScale = 1,
    zoomMinForLod = 0.05,
  ): void {
    const points = (pack.journey?.points ?? []) as [number, number][];
    if (!points.length) return;

    const zs = Number.isFinite(zoomScale) ? zoomScale : 1;
    const zm = Number.isFinite(zoomMinForLod) ? zoomMinForLod : 0.05;
    const tier = journeyLodTier(zs, zm);

    const S = Math.max(0, points.length - 1);
    if (S >= 1 && this.lastLodTier !== tier) {
      this.redraw(defs, journeys, zs, zm);
      return;
    }

    this.applyZoomSizing(defs, journeys, zs);
  }

  private applyZoomSizing(
    defs: Selection<SVGDefsElement, unknown, null, undefined>,
    journeys: Selection<SVGGElement, unknown, null, undefined>,
    zoomScale: number,
  ): void {
    const zs = Math.max(zoomScale, 1e-9);

    const strokeW = mapMetricScreenToWorld(
      JOURNEY_STROKE_SCREEN_PX,
      zs,
      0.06,
      24,
    );
    journeys
      .selectAll(".journey-segment-stroke")
      .attr("stroke-width", rn(strokeW, 3));

    const waypointR = mapMetricScreenToWorld(
      JOURNEY_WAYPOINT_R_SCREEN_PX,
      zs,
      0.15,
      80,
    );
    const waypointSw = mapMetricScreenToWorld(
      JOURNEY_WAYPOINT_STROKE_SCREEN_PX,
      zs,
      0.03,
      24,
    );
    journeys
      .selectAll(".journey-waypoint")
      .attr("r", rn(waypointR, 3))
      .attr("stroke-width", rn(waypointSw, 3));

    journeys.selectAll(".journey-arrow").each(function () {
      const el = this as SVGPathElement;
      const x = el.getAttribute("data-ar-x");
      const y = el.getAttribute("data-ar-y");
      const ang = el.getAttribute("data-ar-ang");
      if (x == null || y == null || ang == null) return;
      el.setAttribute(
        "transform",
        arrowTransform(+x, +y, +ang, zoomScale),
      );
    });

    const morphR = mapMetricScreenToWorld(
      JOURNEY_HALO_DILATE_SCREEN_PX,
      zs,
      0.35,
      40,
    );
    defs
      .select(`filter#${JOURNEY_OUTLINE_FILTER_ID}`)
      .select("feMorphology")
      .attr("radius", rn(morphR, 3));
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
