// Pure ring math for the map wheel. No DOM, no menu knowledge.
// The base table is fixed by the design spec; see docs/superpowers/specs/2026-09-06-map-wheel-radial-controller-design.md
//
// Two independent factors sit on top of that table:
//
// 1. BASE_RADIUS_SCALE grows the radii and NOTHING else. That is what stops labels overflowing
//    their sectors: at the base radii the worst case is the root ring at 7 items, 2pi*83/7 = 74.5px
//    of arc for a 74px label. Scaling the whole dial cannot fix it - arc and label grow together
//    and the ratio never moves. Growing the radii alone buys 89px of arc for the same 74px label.
// 2. The `scale` argument is the app's own uiSize, applied uniformly to everything (radii, label
//    widths, font sizes, icon sizes) so the dial grows for legibility rather than for fit.
//
// The scale is threaded explicitly rather than held in module state: these functions are pure, and
// the tests depend on that.

/** [innerRadius, outerRadius] per level, before either scale factor */
export const BANDS = [
  [58, 108],
  [112, 158],
  [162, 204],
  [208, 246]
] as const;

/** Radius-only headroom, so a label is comfortably narrower than the arc it sits on */
export const BASE_RADIUS_SCALE = 1.2;

export const MAX_DEPTH = BANDS.length;

/** How many sectors a level can hold before labels collide: roughly arc-at-mid-radius / 70px */
export const ITEM_CAPS = [7, 11, 15, 19] as const;

export const GAP_PX = 3;
export const HOVER_GROW = 5;

/** Room inside the SVG box for the hover growth and the drop shadow */
const BOX_PAD = 12;
/** Gap between the ring's outer edge and the drawer's near edge */
const DRAWER_CLEAR = 14;

export const UI_SCALE_MIN = 0.8;
export const UI_SCALE_MAX = 2;

/** Clearance kept between the wheel's box and the edge of the viewport */
export const VIEWPORT_MARGIN = 8;

export interface Sector {
  from: number;
  to: number;
  mid: number;
}

export function bands(scale = 1): [number, number][] {
  const k = BASE_RADIUS_SCALE * scale;
  return BANDS.map(([inner, outer]): [number, number] => [inner * k, outer * k]);
}

export const outerRadius = (scale = 1): number => BANDS[MAX_DEPTH - 1][1] * BASE_RADIUS_SCALE * scale;

/** Half the rendered SVG box */
export const boxRadius = (scale = 1): number => outerRadius(scale) + BOX_PAD * scale;

/** Distance from the wheel centre to the drawer's near edge */
export const drawerOffset = (scale = 1): number => outerRadius(scale) + DRAWER_CLEAR * scale;

/**
 * Follow the app's own sizing control, then refuse to grow past the viewport. Two clamps: uiSize
 * itself runs 0.6..3, which is far more than a dial anchored at a click point can absorb, and even
 * the clamped range does not fit every window.
 */
export function wheelScale(uiSize: number, viewportWidth: number, viewportHeight: number): number {
  const ui = Number.isFinite(uiSize) && uiSize > 0 ? Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, uiSize)) : 1;
  const room = (Math.min(viewportWidth, viewportHeight) - 32) / (boxRadius(1) * 2);
  return Math.max(0.1, Math.min(ui, room));
}

const SPAN_PER_ITEM = 0.55;
const SPAN_MIN = 1.4;
const SPAN_MAX = Math.PI * 1.88;

/** The root is a full circle; a child ring spans only the arc it needs, so depth reads as a fan */
export function ringSpan(level: number, count: number): number {
  if (level === 0) return Math.PI * 2;
  return Math.min(SPAN_MAX, Math.max(SPAN_MIN, count * SPAN_PER_ITEM));
}

export function sectors(level: number, count: number, parentMid: number, scale = 1): Sector[] {
  const span = ringSpan(level, count);
  const step = span / count;
  // the root starts half a sector before 12 o'clock so item 0 is centred at the top
  const start = level === 0 ? -Math.PI / 2 - step / 2 : parentMid - span / 2;
  // a 3px gap stays 3px: the wider the ring, the fewer radians it takes
  const gap = GAP_PX / bands(scale)[level][1];

  return Array.from({ length: count }, (_, i) => {
    const from = start + i * step + gap;
    const to = from + step - gap * 2;
    return { from, to, mid: (from + to) / 2 };
  });
}

const point = (r: number, a: number): string => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;

/** An annulus wedge */
export function arcPath(inner: number, outer: number, from: number, to: number): string {
  const large = to - from > Math.PI ? 1 : 0;
  return (
    `M ${point(inner, from)} L ${point(outer, from)}` +
    ` A ${outer} ${outer} 0 ${large} 1 ${point(outer, to)}` +
    ` L ${point(inner, to)}` +
    ` A ${inner} ${inner} 0 ${large} 0 ${point(inner, from)} Z`
  );
}

export function labelPoint(mid: number, inner: number, outer: number): [number, number] {
  const r = (inner + outer) / 2;
  return [Math.cos(mid) * r, Math.sin(mid) * r];
}

/** The stub of line tying a child ring back to the sector that opened it */
export function spineLine(
  level: number,
  parentMid: number,
  scale = 1
): { x1: number; y1: number; x2: number; y2: number } {
  const table = bands(scale);
  const from = table[level - 1][1];
  const to = table[level][0];
  return {
    x1: Math.cos(parentMid) * from,
    y1: Math.sin(parentMid) * from,
    x2: Math.cos(parentMid) * to,
    y2: Math.sin(parentMid) * to
  };
}
