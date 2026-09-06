// The wheel follows FMG's live theme rather than carrying a palette of its own.
//
// `changeDialogsTheme()` (public/modules/ui/options.js) writes the app's colours as custom
// properties on <html> whenever the user moves the theme hue, colour or transparency sliders. We
// sample them here and fall back to the design handoff's parchment when they are absent - which is
// the case under jsdom, and in any build where the sliders were never touched.
//
// Why sample into strings instead of writing `var(--dark-solid)` everywhere: the sector fills are
// SVG *presentation attributes* (`setAttribute("fill", …)`), and a presentation attribute does not
// accept `var()` - it silently renders black. The stylesheet-side chrome (drawer, breadcrumb, hub,
// origin dot) does use `var()` directly, reading these same values back off the wheel's host. Label
// ink is resolved here too, though it is an ordinary inline style: it has to agree with the fill
// under it.
//
// The wheel's colours are OPAQUE. The only alpha in here is the user's transparency, applied once,
// to all of them - see `veiler` and the DIM note below.

/**
 * How far a surface is carried toward the theme's dark tone to say something about it. These are
 * MIXES, not alphas. The design handoff drew a dimmed sibling at `rgba(251,247,236,.82)` and the
 * strokes at `.32`/`.16`, but that mock sat on a static parchment backdrop, where a reduced alpha
 * reads as "faded". Over a live map it reads as "see-through" - and no transparency setting could
 * lift it, because the veil below can only ever lower an alpha. So de-emphasis is a COLOUR here,
 * and the user's transparency is the only source of translucency the wheel has.
 */
const DIM = 0.25;
/** the ink the handoff drew at .82 over the dimmed fill, as the opaque colour that composite makes */
const DIM_INK = 0.18;
const EDGE_MIX = 0.32;
const EDGE_DIM_MIX = 0.16;

/** The design handoff's colours, kept as the fallback when the app has published no theme */
export const FILLS = {
  chosen: "#4a3a22",
  hot: "#6b5535",
  hotDanger: "#a33a2e",
  layerOn: "#8a9c6c",
  dim: mix("#fbf7ec", "#4a3a22", DIM),
  base: "#fbf7ec"
} as const;

export const INKS = {
  light: "#fffdf7",
  layerOn: "#20261a",
  danger: "#8d2f24",
  dim: mix("#3b3226", FILLS.dim, DIM_INK),
  base: "#3b3226"
} as const;

export const EDGE = mix(FILLS.base, FILLS.chosen, EDGE_MIX);
export const EDGE_DIM = mix(FILLS.dim, FILLS.chosen, EDGE_DIM_MIX);

/**
 * The neutral fills carry the user's transparency, like every other panel in the app - but never
 * below this. FMG's slider runs all the way to alpha 0, and what shows through a sector is the MAP:
 * arbitrary, and at full contrast. Blended against a pure white and a pure black ground - the two
 * worst there are - the weakest veiled pair at .8 is the light ink on the hover fill, at 4.25:1;
 * every other veiled pair holds 4.78:1 or better. At .75 that pair falls to 3.79:1 and at .7 to
 * 3.39:1. Real map ground is mid-tone, where the loss is far smaller than at either extreme.
 */
export const ALPHA_FLOOR = 0.8;

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
// a declaration, not a const: FILLS above is built with mix(), which runs at module init
function solid(rgb: number[]): string {
  return `rgb(${rgb.map(v => Math.round(v)).join(",")})`;
}

/** Re-emit a colour at a different alpha, leaving anything we cannot parse alone */
export function withAlpha(color: string, alpha: number): string {
  const parsed = parse(color);
  return parsed ? format(parsed.slice(0, 3), alpha) : color;
}

/**
 * Blend two colours into a third, OPAQUE one - `t` of `toward`, the rest of `color`.
 *
 * This is what replaced every de-emphasising alpha in the wheel: `mix(a, b, t)` is exactly what
 * `rgba(b, t)` painted over an opaque `a` renders as, so the handoff's intent survives literally
 * while the result no longer lets the map through.
 */
export function mix(color: string, toward: string, t: number): string {
  const [a, b] = [parse(color), parse(toward)];
  if (!a || !b) return color;
  return solid(a.slice(0, 3).map((v, i) => v + (b[i] - v) * t));
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
 * The user's transparency, as a function that applies it to a surface. `changeDialogsTheme`
 * publishes it as `--bg-opacity` = (100 - transparency) / 100; absent (no theme yet) is opaque.
 *
 * ONE alpha, and every surface takes it. There is no per-surface "nominal" alpha to be lowered
 * toward any more: the wheel's own colours are opaque, so at transparency 0 the whole dial is, and
 * every notch of the slider moves all of it together. That is the fix - the veil used to sit under
 * baked-in alphas of .97 and .82 it could only ever lower, so no setting reached the top.
 */
function veiler(): (color: string) => string {
  const published = cssVar("--bg-opacity");
  const value = Number(published);
  // mapped onto [ALPHA_FLOOR, 1] rather than clamped to it: clamping made everything past 20% on the
  // slider identical, so most of the control did nothing to the dial. Mapping keeps the whole slider
  // visible on the ring, and full opacity now lands on a genuinely opaque dial.
  const alpha =
    published && Number.isFinite(value) ? ALPHA_FLOOR + (1 - ALPHA_FLOOR) * Math.min(1, Math.max(0, value)) : 1;
  return color => (alpha >= 1 ? color : withAlpha(color, alpha));
}

/**
 * Sampled per wheel build, and again whenever the app rewrites its theme variables (index.ts watches
 * <html> for that, and the renderer's handle repaints in place).
 *
 * The danger red and the layer-on green stay literal on purpose: they carry meaning, not style, and
 * a hue slider must not be able to turn "this deletes things" into the same colour as everything else.
 */
export function readPalette(): Palette {
  const light = cssVar("--light-solid");
  const dark = cssVar("--dark-solid");
  const header = cssVar("--header-active");

  const base = light || FILLS.base;
  const chosen = dark || FILLS.chosen;
  // `--header-active` carries an alphaReduced of the app's own. The wheel applies the user's
  // transparency itself, once, so the nominal colour has to be the opaque one - keeping the app's
  // alpha here would veil the hover fill twice, which is half of what the user reported.
  const hot = header ? withAlpha(header, 1) : FILLS.hot;
  // recessed by COLOUR, not by alpha - see the DIM note at the top of the file
  const dim = light && dark ? mix(base, chosen, DIM) : FILLS.dim;
  const inkLight = light || INKS.light;
  const inkBase = dark || INKS.base;
  // the strokes are the same story: an opaque mix of the fill they border, not an alpha over it
  const edge = mix(base, chosen, EDGE_MIX);
  const edgeDim = mix(dim, chosen, EDGE_DIM_MIX);

  // Transparency is applied LAST, through this one function, to every surface the wheel paints -
  // the fills, the strokes, and (via applyPalette) the hub, breadcrumb and drawer, which no longer
  // read FMG's already-veiled `--bg-*` vars. Every ink below is guarded against the nominal opaque
  // colour: what shows through a translucent sector is the map, which has no fixed colour, so the
  // opaque pair is the only stable reading there is, and ALPHA_FLOOR is what keeps that verdict
  // true of what the user actually sees.
  //
  // The danger red and the layer-on green are exempt for the same reason they are exempt from the
  // hue: they carry MEANING, not style. The green in particular is the one pair the veil could push
  // under 4:1 (3.49:1 over a black map at the floor), and saying "this layer is ON" at a glance is
  // its whole job. Keeping the two semantic fills opaque costs nothing visible - the ring still goes
  // translucent around them - and removes the exposure outright.
  const veil = veiler();

  return {
    fills: {
      chosen: veil(chosen),
      hot: veil(hot),
      hotDanger: FILLS.hotDanger,
      layerOn: FILLS.layerOn,
      dim: veil(dim),
      base: veil(base)
    },
    inks: {
      onChosen: readable(inkLight, chosen),
      onHot: readable(inkLight, hot),
      onDanger: readable(inkLight, FILLS.hotDanger),
      layerOn: INKS.layerOn,
      danger: readable(INKS.danger, base),
      // dimmed siblings are still full click targets, so their ink is softened toward their own
      // fill rather than faded, and held to the same 4.5:1 as every other sector - which is now a
      // literal statement about the pixels, since the fill under it is opaque
      dim: readable(mix(inkBase, dim, DIM_INK), dim),
      base: readable(inkBase, base),
      // The accent is the hub's inactive tab, the breadcrumb and the drawer's headings (all on the
      // base fill) and the drawer's head (on the dimmed fill), so it has to clear both. Guarding
      // against them in turn only ever moves the ink further the same way: the two are one theme
      // lightness plus 0.05 and minus 0.01, so they never straddle mid-grey.
      accent: [base, dim].reduce((ink, ground) => readable(ink, ground), hot)
    },
    edge: veil(edge),
    edgeDim: veil(edgeDim)
  };
}

/**
 * Hand the sampled palette to the stylesheet, which skins the hub, breadcrumb, drawer and origin.
 *
 * Published on the wheel's HOST when there is one, not on the ring the renderer hands us: a custom
 * property only reaches what sits under the element it was set on, and the origin dot is the ring's
 * SIBLING. Set on the ring, the dot fell back to the handoff's brown and stopped following both the
 * theme and the user's transparency - the same split this whole change exists to remove.
 */
export function applyPalette(element: HTMLElement, palette: Palette): void {
  const host = element.closest<HTMLElement>("#mapWheel") ?? element;
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
  for (const [name, value] of Object.entries(vars)) host.style.setProperty(name, value);
}
