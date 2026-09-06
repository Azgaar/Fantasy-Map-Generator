// Pure ring math for the map wheel. No DOM, no menu knowledge.
// Every constant here is fixed by the design spec; see docs/superpowers/specs/2026-09-06-map-wheel-radial-controller-design.md

/** [innerRadius, outerRadius] per level, in SVG user units */
export const BANDS = [
  [58, 108],
  [112, 158],
  [162, 204],
  [208, 246]
] as const;

export const MAX_DEPTH = BANDS.length;

/** How many sectors a level can hold before labels collide: roughly arc-at-mid-radius / 70px */
export const ITEM_CAPS = [7, 11, 15, 19] as const;

export const GAP_PX = 3;
export const HOVER_GROW = 5;

const SPAN_PER_ITEM = 0.55;
const SPAN_MIN = 1.4;
const SPAN_MAX = Math.PI * 1.88;

export interface Sector {
  from: number;
  to: number;
  mid: number;
}

/** The root is a full circle; a child ring spans only the arc it needs, so depth reads as a fan */
export function ringSpan(level: number, count: number): number {
  if (level === 0) return Math.PI * 2;
  return Math.min(SPAN_MAX, Math.max(SPAN_MIN, count * SPAN_PER_ITEM));
}

export function sectors(level: number, count: number, parentMid: number): Sector[] {
  const span = ringSpan(level, count);
  const step = span / count;
  // the root starts half a sector before 12 o'clock so item 0 is centred at the top
  const start = level === 0 ? -Math.PI / 2 - step / 2 : parentMid - span / 2;
  const gap = GAP_PX / BANDS[level][1];

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
export function spineLine(level: number, parentMid: number): { x1: number; y1: number; x2: number; y2: number } {
  const from = BANDS[level - 1][1];
  const to = BANDS[level][0];
  return {
    x1: Math.cos(parentMid) * from,
    y1: Math.sin(parentMid) * from,
    x2: Math.cos(parentMid) * to,
    y2: Math.sin(parentMid) * to
  };
}
