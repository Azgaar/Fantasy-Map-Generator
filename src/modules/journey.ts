/**
 * Journey feature module (merged).
 *
 * Contains model, style config, geometry, draw, and editor logic.
 */
import type { Selection } from "d3";
import { interpolateRgbBasis } from "d3";
import { ensureEl } from "../utils";
import { minmax, rn } from "../utils/numberUtils";
import { escapeHtml } from "../utils/stringUtils";

/** One leg in the journey sequence (linked-list style via array order). */
interface JourneyBurgLeg {
  kind: "burg";
  id: number;
}

interface JourneyMarkerLeg {
  kind: "marker";
  id: number;
}

export type JourneyStopLeg = JourneyBurgLeg | JourneyMarkerLeg;

export interface PackJourney {
  stops: JourneyStopLeg[];
}

/** Minimal pack slice for resolving burg/marker positions (avoids importing PackedGraph). */
export interface JourneyResolutionContext {
  burgs: Array<{ i?: number; x?: number; y?: number; removed?: boolean }>;
  markers: Array<{ i?: number; x?: number; y?: number }>;
  /** First matching non-removed burg per id (same semantics as linear find). When set, `resolveJourneyLeg` uses O(1) lookup. */
  burgById?: Map<number, JourneyResolutionContext["burgs"][number]>;
  /** First marker per id (same semantics as linear find). */
  markerById?: Map<number, JourneyResolutionContext["markers"][number]>;
}

function indexBurgsById(
  burgs: JourneyResolutionContext["burgs"],
): Map<number, JourneyResolutionContext["burgs"][number]> {
  const m = new Map<number, JourneyResolutionContext["burgs"][number]>();
  for (const b of burgs) {
    if (b.removed) continue;
    const id = b.i;
    if (id === undefined || typeof id !== "number") continue;
    if (!m.has(id)) m.set(id, b);
  }
  return m;
}

function indexMarkersById(
  markers: JourneyResolutionContext["markers"],
): Map<number, JourneyResolutionContext["markers"][number]> {
  const m = new Map<number, JourneyResolutionContext["markers"][number]>();
  for (const mk of markers) {
    const id = mk.i;
    if (id === undefined || typeof id !== "number") continue;
    if (!m.has(id)) m.set(id, mk);
  }
  return m;
}

/** Build resolution context with id indexes (preferred for redraw / many stops). */
export function buildJourneyResolutionContext(
  burgs: JourneyResolutionContext["burgs"],
  markers: JourneyResolutionContext["markers"],
): JourneyResolutionContext {
  return {
    burgs,
    markers,
    burgById: indexBurgsById(burgs),
    markerById: indexMarkersById(markers),
  };
}

const BURG_REF_RE = /^burg:(\d+)$/;
const MARKER_REF_RE = /^marker:(\d+)$/;

function burgJourneyStopRef(i: number): string {
  return `burg:${i}`;
}

export function markerJourneyStopRef(i: number): string {
  return `marker:${i}`;
}

type ParsedJourneyStopRef =
  | { kind: "burg"; id: number }
  | { kind: "marker"; id: number };

export function journeyLegToRefString(leg: JourneyStopLeg): string {
  return leg.kind === "burg"
    ? burgJourneyStopRef(leg.id)
    : markerJourneyStopRef(leg.id);
}

function parseJourneyStopRef(stopId: string): ParsedJourneyStopRef | null {
  const bm = BURG_REF_RE.exec(stopId);
  if (bm) return { kind: "burg", id: +bm[1] };
  const mm = MARKER_REF_RE.exec(stopId);
  if (mm) return { kind: "marker", id: +mm[1] };
  return null;
}

/** UI / DOM string → stored leg (burg or marker only). */
export function journeyRefStringToLeg(ref: string): JourneyStopLeg | null {
  const p = parseJourneyStopRef(ref);
  if (!p) return null;
  return p.kind === "burg"
    ? { kind: "burg", id: p.id }
    : { kind: "marker", id: p.id };
}

function sanitizeStopsArray(raw: unknown[]): JourneyStopLeg[] {
  const out: JourneyStopLeg[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const kind = o.kind;
    const id = Number(o.id);
    if (!Number.isInteger(id) || id < 0) continue;
    if (kind === "burg") out.push({ kind: "burg", id });
    else if (kind === "marker") out.push({ kind: "marker", id });
  }
  return out;
}

type PackWithOptionalJourney = {
  journey?: unknown;
};

/**
 * Ensures `pack.journey` exists and mutates it to canonical `{ stops }` via
 * {@link normalizePackJourney}. Single entry point for layers / editor / load.
 */
export function ensurePackJourneyNormalized(
  pack: PackWithOptionalJourney,
): void {
  if (
    !pack.journey ||
    typeof pack.journey !== "object" ||
    Array.isArray(pack.journey)
  ) {
    pack.journey = { stops: [] };
  }
  normalizePackJourney(pack.journey);
}

/**
 * Mutates journey object into canonical `{ stops }` only.
 */
export function normalizePackJourney(j: unknown): void {
  if (!j || typeof j !== "object" || Array.isArray(j)) return;

  const obj = j as Record<string, unknown>;

  const stops = sanitizeStopsArray(
    Array.isArray(obj.stops) ? (obj.stops as unknown[]) : [],
  );
  obj.stops = stops;
}

function finiteCoord(x: unknown, y: unknown): [number, number] | null {
  const nx = Number(x);
  const ny = Number(y);
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
  return [nx, ny];
}

function tryWarnMissing(msg: string): void {
  try {
    const w =
      typeof globalThis !== "undefined" &&
      (globalThis as { WARN?: boolean }).WARN;
    if (w) console.warn(msg);
  } catch {
    /* noop */
  }
}

/** Resolve one leg to map coordinates, or null if missing. */
export function resolveJourneyLeg(
  leg: JourneyStopLeg,
  ctx: JourneyResolutionContext,
): [number, number] | null {
  if (leg.kind === "burg") {
    const burg =
      ctx.burgById?.get(leg.id) ??
      ctx.burgs.find((b) => b.i === leg.id && !b.removed);
    if (!burg) {
      tryWarnMissing(`journey: missing burg ${leg.id}`);
      return null;
    }
    const p = finiteCoord(burg.x, burg.y);
    if (!p) tryWarnMissing(`journey: burg ${leg.id} has invalid x/y`);
    return p;
  }

  const marker =
    ctx.markerById?.get(leg.id) ?? ctx.markers.find((m) => m.i === leg.id);
  if (!marker) {
    tryWarnMissing(`journey: missing marker ${leg.id}`);
    return null;
  }
  const p = finiteCoord(marker.x, marker.y);
  if (!p) tryWarnMissing(`journey: marker ${leg.id} has invalid x/y`);
  return p;
}

/** Resolve `burg:n` / `marker:n` string (editor / DOM). */
export function resolveJourneyStopPosition(
  stopRef: string,
  ctx: JourneyResolutionContext,
): [number, number] | null {
  const leg = journeyRefStringToLeg(stopRef);
  if (!leg) return null;
  return resolveJourneyLeg(leg, ctx);
}

/** One resolved leg and its map coordinate (same order as `journeyResolvedCoordinates` points). */
interface JourneyResolvedStopEntry {
  leg: JourneyStopLeg;
  coord: [number, number];
}

/**
 * Resolve each leg once: coordinates for polyline + waypoint attribution.
 * Omits legs that fail to resolve (same sequence as `journeyResolvedCoordinates`).
 */
export function journeyResolvedStopEntries(
  j: PackJourney,
  ctx: JourneyResolutionContext = { burgs: [], markers: [] },
): JourneyResolvedStopEntry[] {
  const out: JourneyResolvedStopEntry[] = [];
  for (const leg of j.stops) {
    const p = resolveJourneyLeg(leg, ctx);
    if (!p) continue;
    out.push({ leg, coord: [p[0], p[1]] });
  }
  return out;
}

export function journeyResolvedCoordinates(
  j: PackJourney,
  ctx: JourneyResolutionContext = { burgs: [], markers: [] },
): [number, number][] {
  const rows = journeyResolvedStopEntries(j, ctx);
  const out: [number, number][] = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) out[i] = rows[i].coord;
  return out;
}

/** Rainbow ramp endpoints used as one continuous gradient sliced per segment. */
const JOURNEY_RAINBOW_STOPS = [
  "#e81416",
  "#ff7518",
  "#ffdc00",
  "#32cd32",
  "#00bfff",
  "#4e529a",
  "#70389d",
];

/** Default path/arrows color when `data-color-mode` is solid and no `data-solid-stroke`. */
export const JOURNEY_DEFAULT_SOLID_STROKE = "#5c5c70";

/** Single source for Style tab + `readJourneyStyleConfig` (also on `window.Journey.STYLE_DEFAULTS`). */
const JOURNEY_STYLE_DEFAULTS = {
  lineScreenPx: 6,
  waypointRScreenPx: 9,
  waypointRingScreenPx: 4.5,
  outlineScreenPx: 2,
  solidStroke: JOURNEY_DEFAULT_SOLID_STROKE,
  waypointFill: "#ffffff",
  waypointStroke: "#000000",
  outlineColor: "#000000",
  /** Gradient picker defaults when `data-rainbow-stops` is unset (match ramp ends). */
  gradientFromHex: "#e81416",
  gradientToHex: "#70389d",
} as const;

type JourneyColorMode = "rainbow" | "solid";

/** Resolved presentation for `#journeys` (from `data-*` + defaults). */
interface JourneyStyleConfig {
  colorMode: JourneyColorMode;
  solidStroke: string;
  rainbowStops: readonly string[];
  lineScreenPx: number;
  waypointFill: string;
  waypointStroke: string;
  waypointRScreenPx: number;
  waypointRingScreenPx: number;
  outlineColor: string;
  outlineScreenPx: number;
}

const builtinRampInterpolator = interpolateRgbBasis(JOURNEY_RAINBOW_STOPS);

/** Parse comma-separated hex/color tokens; returns null if fewer than two usable stops. */
export function parseJourneyRainbowStops(
  raw: string | null | undefined,
): string[] | null {
  if (raw == null || !String(raw).trim()) return null;
  const parts = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length >= 2 ? parts : null;
}

/**
 * Read journey style from `#journeys` SVG attributes (`data-*`).
 * Safe with `null` / missing element (uses {@link JOURNEY_STYLE_DEFAULTS}).
 */
export function readJourneyStyleConfig(el: Element | null): JourneyStyleConfig {
  const get = (name: string): string | null =>
    el && typeof el.getAttribute === "function" ? el.getAttribute(name) : null;

  const attrPx = (name: string, fallback: number): number => {
    const v = Number.parseFloat(get(name) ?? "");
    return Number.isFinite(v) ? v : fallback;
  };

  const modeRaw = (get("data-color-mode") || "rainbow").toLowerCase().trim();
  const colorMode: JourneyColorMode = modeRaw === "solid" ? "solid" : "rainbow";

  const parsedStops = parseJourneyRainbowStops(get("data-rainbow-stops"));
  const rainbowStops =
    parsedStops && parsedStops.length >= 2
      ? parsedStops
      : [...JOURNEY_RAINBOW_STOPS];

  const solidStroke =
    get("data-solid-stroke")?.trim() || JOURNEY_STYLE_DEFAULTS.solidStroke;

  const lineScreenPx = minmax(
    attrPx("data-line-screen-px", JOURNEY_STYLE_DEFAULTS.lineScreenPx),
    0.5,
    96,
  );

  const waypointFill =
    get("data-waypoint-fill")?.trim() || JOURNEY_STYLE_DEFAULTS.waypointFill;
  const waypointStroke =
    get("data-waypoint-stroke")?.trim() ||
    JOURNEY_STYLE_DEFAULTS.waypointStroke;

  const waypointRScreenPx = minmax(
    attrPx(
      "data-waypoint-r-screen-px",
      JOURNEY_STYLE_DEFAULTS.waypointRScreenPx,
    ),
    2,
    120,
  );

  const waypointRingScreenPx = minmax(
    attrPx(
      "data-waypoint-ring-screen-px",
      JOURNEY_STYLE_DEFAULTS.waypointRingScreenPx,
    ),
    0,
    48,
  );

  const outlineColor =
    get("data-outline-color")?.trim() || JOURNEY_STYLE_DEFAULTS.outlineColor;

  const outlineScreenPx = minmax(
    attrPx("data-outline-screen-px", JOURNEY_STYLE_DEFAULTS.outlineScreenPx),
    0,
    32,
  );

  return {
    colorMode,
    solidStroke,
    rainbowStops,
    lineScreenPx,
    waypointFill,
    waypointStroke,
    waypointRScreenPx,
    waypointRingScreenPx,
    outlineColor,
    outlineScreenPx,
  };
}

/** Uniform ramp sampler along one logical journey (same contract as `journeyRampColor`). */
export function journeyRampSamplerForConfig(
  cfg: JourneyStyleConfig,
): (u: number) => string {
  if (cfg.colorMode === "solid") {
    const c = cfg.solidStroke;
    return (_u: number) => c;
  }
  const stops =
    cfg.rainbowStops.length >= 2 ? cfg.rainbowStops : JOURNEY_RAINBOW_STOPS;
  const interp = interpolateRgbBasis([...stops]);
  return (u: number) => interp(minmax(u, 0, 1));
}

/** Parameter `u` in [0, 1] along the whole journey ramp (built-in rainbow). */
export function journeyRampColor(u: number): string {
  return builtinRampInterpolator(minmax(u, 0, 1));
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
  return minmax(t, 0, 1);
}

const MIN_SEG_LEN = 0.05;
const LANE_WIDTH = 3.5;
const JOURNEY_ARROW_SPACING_BASE_PX = 38;
const LOD_TIER_MAX = 6;
const LOD_ARROW_SPACING_MUL: readonly number[] = [
  2.25, 1.9, 1.6, 1.35, 1.2, 1.08, 1,
];

export function journeyLodTier(scale: number, zoomMin: number): number {
  const s = Math.max(scale, 1e-9);
  const zmin = Math.max(zoomMin, 1e-9);
  const raw = Math.floor(Math.log2(s)) - Math.floor(Math.log2(zmin));
  return minmax(raw, 0, LOD_TIER_MAX);
}

export function journeyPolylineSamplesForTier(tier: number): number {
  const t = minmax(tier, 0, LOD_TIER_MAX);
  return minmax(14 + t * 5, 12, 44);
}

export function journeyArrowSpacingMulForTier(tier: number): number {
  const t = minmax(tier, 0, LOD_TIER_MAX);
  return LOD_ARROW_SPACING_MUL[t] ?? 1;
}

export function journeyArrowSpacingMapUnits(
  scale: number,
  tier: number,
  spacingPx = JOURNEY_ARROW_SPACING_BASE_PX,
): number {
  const k = Math.max(scale, 1e-9);
  return (spacingPx * journeyArrowSpacingMulForTier(tier)) / k;
}

const BEND_BASE = 0.14;
const CURVATURE_REPEAT_GAIN = 0.45;
const LEFT_NORMAL_SCREEN_SIGN = -1;

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

export function bendSegmentChord(len: number, repeatIndex: number): number {
  return (
    BEND_BASE * len * (1 + Math.max(0, repeatIndex) * CURVATURE_REPEAT_GAIN)
  );
}

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
  for (let i = 1; i < pts.length; i++)
    d += `L${rn(pts[i][0], 2)},${rn(pts[i][1], 2)}`;
  return d;
}

interface ArrowSample {
  x: number;
  y: number;
  angleDeg: number;
}

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

export function segmentUInterval(
  segmentCount: number,
  segmentIndex: number,
): [number, number] {
  if (segmentCount <= 0) return [0, 0];
  const u0 = segmentIndex / segmentCount;
  const u1 = (segmentIndex + 1) / segmentCount;
  return [u0, u1];
}

const ARROW_PATH_D = "M0,-8.4 L22.5,0 L0,8.4 Z";
const JOURNEY_OUTLINE_FILTER_ID = "journeyUnifiedOutline";

function mapMetricScreenToWorld(
  screenPx: number,
  zoomScale: number,
  lo: number,
  hi: number,
): number {
  const k = Math.max(zoomScale, 1e-9);
  return minmax(screenPx / k, lo, hi);
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

function ensureJourneyOutlineFilter(
  defs: Selection<SVGDefsElement, unknown, null, undefined>,
  morphologyRadiusMap: number,
  floodColor: string,
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
    .attr("flood-color", floodColor)
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

class JourneyDrawModule {
  private lastLodTier: number | null = null;

  redraw(
    defs: Selection<SVGDefsElement, unknown, null, undefined>,
    journeys: Selection<SVGGElement, unknown, null, undefined>,
    zoomScale = 1,
    zoomMinForLod = 0.05,
  ): void {
    journeys.selectAll("*").remove();
    defs.selectAll("linearGradient.journey-def").remove();
    defs.select(`filter#${JOURNEY_OUTLINE_FILTER_ID}`).remove();
    if (!pack.journey) {
      this.lastLodTier = null;
      return;
    }
    ensurePackJourneyNormalized(pack);
    const journeyData = pack.journey as PackJourney;
    const resCtx = buildJourneyResolutionContext(
      pack.burgs ?? [],
      pack.markers ?? [],
    );
    const resolvedStops = journeyResolvedStopEntries(journeyData, resCtx);
    if (!resolvedStops.length) {
      this.lastLodTier = null;
      return;
    }
    const points = resolvedStops.map((r) => r.coord);
    const zs = zoomScale;
    const zm = zoomMinForLod;
    const styleCfg = readJourneyStyleConfig(journeys.node());
    const rampAt = journeyRampSamplerForConfig(styleCfg);
    const verts = journeys.append("g").attr("class", "journey-vertices");
    const waypointR = mapMetricScreenToWorld(
      styleCfg.waypointRScreenPx,
      zs,
      0.15,
      80,
    );
    const waypointSw = mapMetricScreenToWorld(
      styleCfg.waypointRingScreenPx,
      zs,
      0.03,
      24,
    );
    const idsAtCoord = new Map<string, string[]>();
    for (const { leg, coord } of resolvedStops) {
      const sid = journeyLegToRefString(leg);
      const ck = `${rn(coord[0], 2)},${rn(coord[1], 2)}`;
      const arr = idsAtCoord.get(ck) ?? [];
      if (!arr.includes(sid)) arr.push(sid);
      idsAtCoord.set(ck, arr);
    }
    const seen = new Set<string>();
    for (const [x, y] of points) {
      const k = `${rn(x, 2)},${rn(y, 2)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const jidList = idsAtCoord.get(k);
      const circle = verts
        .append("circle")
        .attr("class", "journey-waypoint")
        .attr("data-jx", rn(x, 2))
        .attr("data-jy", rn(y, 2))
        .attr("cx", rn(x, 2))
        .attr("cy", rn(y, 2))
        .attr("r", rn(waypointR, 3))
        .attr("fill", styleCfg.waypointFill)
        .attr("stroke", styleCfg.waypointStroke)
        .attr("stroke-width", rn(waypointSw, 3))
        .style("cursor", "pointer");
      if (jidList?.length === 1)
        circle.attr("data-journey-stop-ref", jidList[0]);
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
      styleCfg.outlineScreenPx,
      zs,
      0.35,
      40,
    );
    ensureJourneyOutlineFilter(defs, morphR, styleCfg.outlineColor);
    const segmentsRoot = journeys.append("g").attr("class", "journey-segments");
    const lanes = laneMultipliersForSegments(points);
    const repeats = directedChordOccurrenceIndex(points);
    const strokeW = mapMetricScreenToWorld(styleCfg.lineScreenPx, zs, 0.06, 24);
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
      const c0 = rampAt(u0);
      const c1 = rampAt(u1);
      const seg = segmentsRoot
        .append("g")
        .attr("class", "journey-segment")
        .attr("filter", `url(#${JOURNEY_OUTLINE_FILTER_ID})`);
      let strokeAttr: string;
      if (styleCfg.colorMode === "solid") strokeAttr = styleCfg.solidStroke;
      else {
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
        strokeAttr = `url(#${gid})`;
      }
      seg
        .append("path")
        .attr("class", "journey-segment-stroke")
        .attr("d", d)
        .attr("fill", "none")
        .attr("stroke", strokeAttr)
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
        const arrowColor = rampAt(u0 + gt * (u1 - u0));
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

  syncZoom(
    defs: Selection<SVGDefsElement, unknown, null, undefined>,
    journeys: Selection<SVGGElement, unknown, null, undefined>,
    zoomScale = 1,
    zoomMinForLod = 0.05,
  ): void {
    if (!pack.journey) return;
    ensurePackJourneyNormalized(pack);
    const points = journeyResolvedCoordinates(
      pack.journey as PackJourney,
      buildJourneyResolutionContext(pack.burgs ?? [], pack.markers ?? []),
    );
    if (!points.length) return;
    const zs = zoomScale;
    const zm = zoomMinForLod;
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
    const styleCfg = readJourneyStyleConfig(journeys.node());
    const strokeW = mapMetricScreenToWorld(styleCfg.lineScreenPx, zs, 0.06, 24);
    journeys
      .selectAll(".journey-segment-stroke")
      .attr("stroke-width", rn(strokeW, 3));
    const waypointR = mapMetricScreenToWorld(
      styleCfg.waypointRScreenPx,
      zs,
      0.15,
      80,
    );
    const waypointSw = mapMetricScreenToWorld(
      styleCfg.waypointRingScreenPx,
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
      el.setAttribute("transform", arrowTransform(+x, +y, +ang, zoomScale));
    });
    const morphR = mapMetricScreenToWorld(
      styleCfg.outlineScreenPx,
      zs,
      0.35,
      40,
    );
    const filt = defs.select(`filter#${JOURNEY_OUTLINE_FILTER_ID}`);
    filt.select("feMorphology").attr("radius", rn(morphR, 3));
    filt.select("feFlood").attr("flood-color", styleCfg.outlineColor);
  }
}

/** Minimal facade consumed by legacy JS modules. */
type JourneyGlobalApi = {
  STYLE_DEFAULTS: typeof JOURNEY_STYLE_DEFAULTS;
  ensurePackJourneyNormalized: typeof ensurePackJourneyNormalized;
};

function journeyStopSelectOptions(currentRef: string): string {
  ensurePackJourneyNormalized(pack);
  let html = "";
  const known = new Set<string>();
  if (!currentRef)
    html +=
      '<option value="" disabled selected>Choose marker or burg…</option>';
  html += '<optgroup label="Markers">';
  for (const m of pack.markers || []) {
    if (m.i == null || !Number.isFinite(m.x) || !Number.isFinite(m.y)) continue;
    const ref = markerJourneyStopRef(m.i);
    known.add(ref);
    const sel = ref === currentRef ? " selected" : "";
    const typeLabel = m.type ? String(m.type) : "Marker";
    const label = `${typeLabel} #${m.i} (${rn(m.x, 2)}, ${rn(m.y, 2)})`;
    html += `<option value="${escapeHtml(ref)}"${sel}>${escapeHtml(label)}</option>`;
  }
  html += '</optgroup><optgroup label="Burgs">';
  for (const b of pack.burgs || []) {
    if (
      b.removed ||
      b.i == null ||
      !Number.isFinite(b.x) ||
      !Number.isFinite(b.y)
    )
      continue;
    const ref = burgJourneyStopRef(b.i);
    known.add(ref);
    const sel = ref === currentRef ? " selected" : "";
    const nm =
      b.name && String(b.name).trim() !== "" ? String(b.name) : `Burg ${b.i}`;
    const label = `${nm} (${rn(b.x, 2)}, ${rn(b.y, 2)})`;
    html += `<option value="${escapeHtml(ref)}"${sel}>${escapeHtml(label)}</option>`;
  }
  html += "</optgroup>";
  if (currentRef && !known.has(currentRef)) {
    html += `<option value="${escapeHtml(currentRef)}" selected>${escapeHtml("[missing stop]")}</option>`;
  }
  return html;
}

function journeyRenderStopRows(container: HTMLElement): void {
  ensurePackJourneyNormalized(pack);
  const stops = pack.journey!.stops;
  const rows = stops.length === 0 ? [null] : stops;
  rows.forEach((leg, i) => {
    const currentRef = leg ? journeyLegToRefString(leg) : "";
    const showRemove = stops.length > 0;
    const removeStyle = showRemove
      ? ""
      : "visibility:hidden;pointer-events:none";
    container.insertAdjacentHTML(
      "beforeend",
      `<div class="editorLine journey-stop-row" data-stop-index="${i}" style="display:grid;grid-template-columns:auto 1fr auto;gap:0.5em 1em;align-items:center">
        <span><b>#</b>${i + 1}</span>
        <select class="journey-stop-select" data-tip="Stop: marker or burg (position follows the map)" data-stop-index="${i}">${journeyStopSelectOptions(currentRef)}</select>
        <span data-tip="Remove this leg" class="icon-trash-empty pointer journey-stop-remove" data-stop-index="${i}" style="${removeStyle}"></span>
      </div>`,
    );
  });
}

function journeyEditorRefreshBody(): void {
  const stBody = ensureEl("journeyEditorStopsBody");
  stBody.innerHTML = "";
  ensurePackJourneyNormalized(pack);
  journeyRenderStopRows(stBody);
}

function journeyEditorRootChange(ev: Event): void {
  const t = ev.target as HTMLElement;
  if (t.classList.contains("journey-stop-select")) {
    const row = t.closest("[data-stop-index]");
    if (!row) return;
    const idx = +(row as HTMLElement).dataset.stopIndex!;
    if (!Number.isFinite(idx)) return;
    const val = (t as HTMLSelectElement).value;
    ensurePackJourneyNormalized(pack);
    if (!val) return;
    const leg = journeyRefStringToLeg(val);
    if (!leg) return;
    const stops = pack.journey!.stops;
    if (stops.length === 0) stops.push(leg);
    else stops[idx] = leg;
    journeyEditorRefreshBody();
    drawJourney();
  }
}

function journeyEditorRootClick(ev: Event): void {
  const t = ev.target as HTMLElement;
  if (t.classList.contains("journey-stop-remove")) {
    const row = t.closest("[data-stop-index]");
    if (!row) return;
    const idx = +(row as HTMLElement).dataset.stopIndex!;
    if (!Number.isFinite(idx)) return;
    ensurePackJourneyNormalized(pack);
    pack.journey!.stops.splice(idx, 1);
    journeyEditorRefreshBody();
    drawJourney();
  }
}

function journeyAppendStopRef(stopRef: string): void {
  ensurePackJourneyNormalized(pack);
  const ctx = buildJourneyResolutionContext(
    pack.burgs ?? [],
    pack.markers ?? [],
  );
  if (!resolveJourneyStopPosition(stopRef, ctx)) return;
  const leg = journeyRefStringToLeg(stopRef);
  if (!leg) return;
  pack.journey!.stops.push(leg);
  journeyEditorRefreshBody();
  drawJourney();
}

function journeyEditorAddLegClick(): void {
  ensurePackJourneyNormalized(pack);
  const stops = pack.journey!.stops;
  if (!stops.length) {
    tip(
      "Choose the first stop in the Journey row (marker or burg), then use + to add legs.",
      false,
      "warn",
    );
    return;
  }
  stops.push(stops[stops.length - 1]);
  journeyEditorRefreshBody();
  drawJourney();
}

function journeyEditorOnClick(): void {
  const d3g = globalThis as typeof globalThis & {
    d3?: { event?: { sourceEvent?: Event } };
  };
  const evt = d3g.d3?.event?.sourceEvent ?? window.event;
  const target = evt?.target as HTMLElement | undefined;
  let circleEl: Element | null = null;
  if (target?.classList?.contains("journey-waypoint")) circleEl = target;
  else if (target?.closest?.(".journey-waypoint"))
    circleEl = target.closest(".journey-waypoint");
  if (circleEl) {
    const stopRef = circleEl.getAttribute("data-journey-stop-ref");
    if (stopRef) {
      journeyAppendStopRef(stopRef);
      return;
    }
    return;
  }
  tip(
    "Add stops from the Journey dropdown (markers and burgs only).",
    false,
    "info",
  );
}

function closeJourneyEditor(): void {
  ensureEl("journeyEditorStopsBody").innerHTML = "";
  viewbox.on("click.journey", null).style("cursor", null);
  clearMainTip();
  restoreDefaultEvents();
}

function editJourney(): void {
  if (customization) return;
  closeDialogs("#journeyEditor, .stable");
  ensurePackJourneyNormalized(pack);
  if (!layerIsOn("toggleJourney")) toggleJourney();
  tip(
    "Build the path with markers and burgs only—each leg follows live map positions. Use + to repeat the last stop. Click a journey circle to append that stop again. Undo / Clear affect the path only.",
    true,
  );
  viewbox.style("cursor", "default").on("click.journey", journeyEditorOnClick);
  $("#journeyEditor").dialog({
    title: "Journey editor",
    resizable: false,
    position: { my: "left top", at: "left+10 top+10", of: "#map" },
    close: closeJourneyEditor,
  });
  if (modules.editJourney) {
    journeyEditorRefreshBody();
    return;
  }
  modules.editJourney = true;
  $("#journeyEditorRoot")
    .on("change.journeyEd", journeyEditorRootChange)
    .on("click.journeyEd", journeyEditorRootClick);
  $("#journeyEditorAddLeg").on("click.journeyEd", journeyEditorAddLegClick);
  $("#journeyEditorUndo").on("click.journeyEd", () => {
    ensurePackJourneyNormalized(pack);
    pack.journey!.stops.pop();
    journeyEditorRefreshBody();
    drawJourney();
  });
  $("#journeyEditorClear").on("click.journeyEd", () => {
    ensurePackJourneyNormalized(pack);
    pack.journey!.stops = [];
    journeyEditorRefreshBody();
    drawJourney();
  });
  $("#journeyEditorDone").on("click.journeyEd", () =>
    $("#journeyEditor").dialog("close"),
  );
  journeyEditorRefreshBody();
}

if (typeof window !== "undefined") {
  window.JourneyDraw = new JourneyDrawModule();
  const journeyApi: JourneyGlobalApi = {
    STYLE_DEFAULTS: JOURNEY_STYLE_DEFAULTS,
    ensurePackJourneyNormalized,
  };
  window.Journey = journeyApi;
  window.editJourney = editJourney;
}

declare global {
  var pack: import("../types/PackedGraph").PackedGraph;
  interface Window {
    JourneyDraw?: JourneyDrawModule;
    Journey?: JourneyGlobalApi;
    editJourney?: () => void;
  }
}
