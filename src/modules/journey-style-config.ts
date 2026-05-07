import { interpolateRgbBasis } from "d3";

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

/** Default path/arrows color when `data-color-mode` is solid and no `data-solid-stroke`. */
export const JOURNEY_DEFAULT_SOLID_STROKE = "#5c5c70";

/** Single source for Style tab + `readJourneyStyleConfig` (also on `window.Journey.STYLE_DEFAULTS`). */
export const JOURNEY_STYLE_DEFAULTS = {
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

export type JourneyColorMode = "rainbow" | "solid";

/** Resolved presentation for `#journeys` (from `data-*` + defaults). */
export interface JourneyStyleConfig {
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

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

const builtinRampInterpolator = interpolateRgbBasis(JOURNEY_RAINBOW_STOPS);

/** Parse comma-separated hex/color tokens; returns null if fewer than two usable stops. */
export function parseJourneyRainbowStops(raw: string | null | undefined): string[] | null {
  if (raw == null || !String(raw).trim()) return null;
  const parts = String(raw)
    .split(",")
    .map(s => s.trim())
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
    parsedStops && parsedStops.length >= 2 ? parsedStops : [...JOURNEY_RAINBOW_STOPS];

  const solidStroke =
    get("data-solid-stroke")?.trim() || JOURNEY_STYLE_DEFAULTS.solidStroke;

  const lineScreenPx = clamp(
    attrPx("data-line-screen-px", JOURNEY_STYLE_DEFAULTS.lineScreenPx),
    0.5,
    96,
  );

  const waypointFill =
    get("data-waypoint-fill")?.trim() || JOURNEY_STYLE_DEFAULTS.waypointFill;
  const waypointStroke =
    get("data-waypoint-stroke")?.trim() || JOURNEY_STYLE_DEFAULTS.waypointStroke;

  const waypointRScreenPx = clamp(
    attrPx("data-waypoint-r-screen-px", JOURNEY_STYLE_DEFAULTS.waypointRScreenPx),
    2,
    120,
  );

  const waypointRingScreenPx = clamp(
    attrPx(
      "data-waypoint-ring-screen-px",
      JOURNEY_STYLE_DEFAULTS.waypointRingScreenPx,
    ),
    0,
    48,
  );

  const outlineColor =
    get("data-outline-color")?.trim() || JOURNEY_STYLE_DEFAULTS.outlineColor;

  const outlineScreenPx = clamp(
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
export function journeyRampSamplerForConfig(cfg: JourneyStyleConfig): (u: number) => string {
  if (cfg.colorMode === "solid") {
    const c = cfg.solidStroke;
    return (_u: number) => c;
  }
  const stops = cfg.rainbowStops.length >= 2 ? cfg.rainbowStops : JOURNEY_RAINBOW_STOPS;
  const interp = interpolateRgbBasis([...stops]);
  return (u: number) => interp(Math.max(0, Math.min(1, u)));
}

/** Parameter `u` in [0, 1] along the whole journey ramp (built-in rainbow). */
export function journeyRampColor(u: number): string {
  return builtinRampInterpolator(Math.max(0, Math.min(1, u)));
}
