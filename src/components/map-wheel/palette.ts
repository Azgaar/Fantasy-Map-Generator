// The wheel follows FMG's live theme rather than carrying a palette of its own.
//
// `changeDialogsTheme()` (public/modules/ui/options.js) writes the app's colours as custom
// properties on <html> whenever the user moves the theme hue, colour or transparency sliders. We
// sample them here and fall back to the design handoff's parchment when they are absent - which is
// the case under jsdom, and in any build where the sliders were never touched.
//
// Why sample into strings instead of writing `var(--dark-solid)` everywhere: the sector fills are
// SVG *presentation attributes* (`setAttribute("fill", …)`), and a presentation attribute does not
// accept `var()` - it silently renders black. The stylesheet-side chrome (drawer, breadcrumb, hub)
// does use `var()` directly, reading these same values back off `.mw-wheel`. Label ink is resolved
// here too, though it is an ordinary inline style: it has to agree with the fill under it.

/** The design handoff's colours, kept as the fallback when the app has published no theme */
export const FILLS = {
  chosen: "#4a3a22",
  hot: "#6b5535",
  hotDanger: "#a33a2e",
  layerOn: "#8a9c6c",
  dim: "rgba(251,247,236,.82)",
  base: "rgba(251,247,236,.97)"
} as const;

export const INKS = {
  light: "#fffdf7",
  layerOn: "#20261a",
  danger: "#8d2f24",
  dim: "rgba(59,50,38,.82)",
  base: "#3b3226"
} as const;

export const EDGE = "rgba(90,74,48,.32)";
export const EDGE_DIM = "rgba(90,74,48,.16)";

export interface Palette {
  fills: { chosen: string; hot: string; hotDanger: string; layerOn: string; dim: string; base: string };
  /**
   * The light ink is painted on three different dark fills, so it is resolved three times - once
   * per background. One shared value cannot work: `readable` moves the ink toward whichever end its
   * background is furthest from, so a value made safe over one fill is not safe over another.
   */
  inks: {
    onChosen: string;
    onHot: string;
    onDanger: string;
    layerOn: string;
    danger: string;
    dim: string;
    base: string;
    accent: string;
  };
  edge: string;
  edgeDim: string;
}

type Rgba = [number, number, number, number];

function parse(color: string): Rgba | null {
  const text = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map(c => c + c).join("") : hex[1];
    const byte = (i: number) => Number.parseInt(digits.slice(i, i + 2), 16);
    return [byte(0), byte(2), byte(4), 1];
  }

  const rgb = /^rgba?\(([^)]+)\)$/i.exec(text);
  if (!rgb) return null;
  const parts = rgb[1]
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
  return [parts[0], parts[1], parts[2], Number.isNaN(parts[3]) ? 1 : (parts[3] ?? 1)];
}

const format = (rgb: number[], alpha: number): string => `rgba(${rgb.map(v => Math.round(v)).join(",")},${alpha})`;

/** Re-emit a colour at a different alpha, leaving anything we cannot parse alone */
export function withAlpha(color: string, alpha: number): string {
  const parsed = parse(color);
  return parsed ? format(parsed.slice(0, 3), alpha) : color;
}

const channel = (value: number): number => {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = (c: Rgba | number[]): number =>
  0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);

export function contrast(a: string, b: string): number | null {
  const [x, y] = [parse(a), parse(b)];
  if (!x || !y) return null;
  return ratio(x, y);
}

function ratio(a: number[], b: number[]): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Nudge an ink toward black or white until it clears WCAG AA over its own background.
 *
 * The theme is the user's to choose, but a 9.5px label is not legible at any hue: FMG's own
 * `--dark-solid` on `--light-solid` is 2.5:1 at the default theme colour. The hue survives - only
 * the lightness moves, and only as far as 4.5:1 needs. When the theme is absent the handoff's
 * colours already clear the bar, so this is a no-op and the fallback palette is untouched.
 */
export function readable(ink: string, background: string, min = 4.5): string {
  const [a, b] = [parse(ink), parse(background)];
  if (!a || !b || ratio(a, b) >= min) return ink;

  const target = luminance(b) > 0.18 ? 0 : 255;
  // rounded inside the search, so the ratio measured is the ratio of the string we emit
  const mix = (t: number): number[] => a.slice(0, 3).map(v => Math.round(v + (target - v) * t));

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 14; i++) {
    const t = (lo + hi) / 2;
    if (ratio(mix(t), b) >= min) hi = t;
    else lo = t;
  }
  return format(mix(hi), a[3]);
}

const cssVar = (name: string): string => {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

/**
 * Sampled once per wheel build. The wheel is transient and closes on an outside pointerdown, so a
 * palette that is live only from one open to the next is enough.
 *
 * The danger red and the layer-on green stay literal on purpose: they carry meaning, not style, and
 * a hue slider must not be able to turn "this deletes things" into the same colour as everything else.
 */
export function readPalette(): Palette {
  const light = cssVar("--light-solid");
  const dark = cssVar("--dark-solid");
  const header = cssVar("--header-active");
  // the two grounds the accent ink is painted on besides the ring's own fill
  const lighter = cssVar("--bg-lighter");
  const panel = cssVar("--bg-light");

  const base = light ? withAlpha(light, 0.97) : FILLS.base;
  const dim = light ? withAlpha(light, 0.82) : FILLS.dim;
  const chosen = dark || FILLS.chosen;
  const hot = header || FILLS.hot;
  const inkLight = light || INKS.light;

  return {
    fills: { chosen, hot, hotDanger: FILLS.hotDanger, layerOn: FILLS.layerOn, dim, base },
    inks: {
      onChosen: readable(inkLight, chosen),
      onHot: readable(inkLight, hot),
      onDanger: readable(inkLight, FILLS.hotDanger),
      layerOn: INKS.layerOn,
      danger: readable(INKS.danger, base),
      // dimmed siblings are still full click targets, so they are dimmed no further than .82 and
      // their ink is held to the same 4.5:1 as every other sector
      dim: readable(dark ? withAlpha(dark, 0.82) : INKS.dim, dim),
      base: readable(dark || INKS.base, base),
      // The accent is the hub's inactive tab (on the base fill), the breadcrumb (on --bg-lighter)
      // and the drawer's headings (on --bg-light), so it has to clear all three. Guarding against
      // them in turn only ever moves the ink further the same way: all three are one theme
      // lightness plus 0.02, 0.05 and 0.06, so they never straddle mid-grey.
      accent: [base, lighter || base, panel || base].reduce((ink, ground) => readable(ink, ground), hot)
    },
    edge: dark ? withAlpha(dark, 0.32) : EDGE,
    edgeDim: dark ? withAlpha(dark, 0.16) : EDGE_DIM
  };
}

/** Hand the sampled palette to the stylesheet, which skins the hub, breadcrumb and drawer */
export function applyPalette(element: HTMLElement, palette: Palette): void {
  const vars: Record<string, string> = {
    "--mw-fill-base": palette.fills.base,
    "--mw-fill-dim": palette.fills.dim,
    "--mw-fill-chosen": palette.fills.chosen,
    "--mw-fill-hot": palette.fills.hot,
    "--mw-fill-danger": palette.fills.hotDanger,
    "--mw-fill-layer-on": palette.fills.layerOn,
    "--mw-ink-base": palette.inks.base,
    // the only light ink the stylesheet paints is the hub's active tab, which sits on the hot fill
    "--mw-ink-light": palette.inks.onHot,
    "--mw-ink-accent": palette.inks.accent,
    "--mw-edge": palette.edge,
    "--mw-edge-dim": palette.edgeDim
  };
  for (const [name, value] of Object.entries(vars)) element.style.setProperty(name, value);
}
