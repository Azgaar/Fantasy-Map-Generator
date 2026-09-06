// Pure ring math for the map wheel. No DOM, no menu knowledge.
// See docs/superpowers/specs/2026-09-06-map-wheel-radial-controller-design.md
//
// A label is an upright box on a ring, so how much of the band's RADIAL DEPTH it eats depends on
// where the sector points: at 3 o'clock the depth carries the widest text LINE, at 12 o'clock the
// whole STACK, and in between a mix of the two. Measured in the browser, sizing the labels against
// the arc alone left 157 of 882 placements with ink outside their own sector, up to 9.5px.
//
// The maximum over every angle is exact and has a closed form. For an ink box of half-width `a`
// whose furthest edge is `reach` from the label's centre, the radial half-extent at sector angle t
// is `a*|cos t| + reach*|sin t|`, whose maximum over t is `hypot(a, reach)` - and because the label
// centre sits on the band's mid-radius, that maximum IS the distance from the mid-radius to the
// furthest ink. So the bands are sized by `labelFit` below: every ink box in the stack (the icon,
// each text line at the FULL label width, and the note at its width cap) must satisfy
// `hypot(a, reach) <= bandDepth / 2`. Both sides scale with uiSize, so the fit holds at every size.
//
// The `scale` argument is the app's own uiSize, applied uniformly to everything (radii, label
// widths, font sizes, icon sizes) so the dial grows for legibility rather than for fit. It is
// threaded explicitly rather than held in module state: these functions are pure, and the tests
// depend on that.

/** [innerRadius, outerRadius] per level, at uiSize 1. Depths are set by `labelFit`, not by taste. */
export const BANDS = [
  [58, 130],
  [135, 205],
  [210, 280],
  [285, 355]
] as const;

export const MAX_DEPTH = BANDS.length;

/**
 * The label's own metrics, in px at uiSize 1. styles.ts writes exactly these numbers into the
 * stylesheet, so the band table above and the labels it has to hold cannot drift apart.
 */
export const LABEL = {
  /** one width for every level: it is what the band depth must cover at a horizontal sector */
  width: 62,
  /** the text is clamped to this many lines, so a long name is bounded rather than unbounded */
  lines: 2,
  /** flex gap between icon, text and note */
  gap: 2,
  lineHeight: 1.15,
  /** the optional third line: a layer's on/off, a subject's kind, the subject count */
  note: 8.5,
  /**
   * and how much of the label's width that line may use before it ellipsises. The note sits at the
   * end of the stack, so it is the ink furthest from the band's mid-radius and its width is what
   * reaches out at a diagonal sector; capping it costs less depth than narrowing the whole label.
   */
  noteWidth: 0.65,
  root: { font: 10.5, icon: 19 },
  deep: { font: 9.5, icon: 16 }
} as const;

/** How much of the band's depth a label can take up: icon + wrapped text + the note line */
export function labelStack(level: number, lines: number = LABEL.lines, note = true): number {
  const { font, icon } = level === 0 ? LABEL.root : LABEL.deep;
  const text = lines * font * LABEL.lineHeight;
  return icon + LABEL.gap + text + (note ? LABEL.gap + LABEL.note * LABEL.lineHeight : 0);
}

export interface LabelRect {
  /** which box of the stack this is */
  name: string;
  /** half its width. Text lines take the FULL label width: a broken long word fills it exactly */
  half: number;
  /** distance from the label's centre to its furthest edge */
  reach: number;
}

/**
 * The ink boxes a label can produce, worst case. Widths are the widths the CSS ALLOWS, never the
 * widths a particular string happens to produce: `overflow-wrap: anywhere` makes a broken line
 * exactly `LABEL.width` wide, and map-generated names (`Confederation of …`) do break.
 */
export function labelRects(level: number): LabelRect[] {
  const { font, icon } = level === 0 ? LABEL.root : LABEL.deep;
  const line = font * LABEL.lineHeight;
  const half = labelStack(level) / 2;
  const rects: LabelRect[] = [{ name: "icon", half: icon / 2, reach: half }];

  for (let i = 0; i < LABEL.lines; i++) {
    const top = -half + icon + LABEL.gap + i * line;
    rects.push({ name: `line ${i + 1}`, half: LABEL.width / 2, reach: Math.max(Math.abs(top), Math.abs(top + line)) });
  }

  rects.push({ name: "note", half: (LABEL.width * LABEL.noteWidth) / 2, reach: half });
  return rects;
}

/**
 * The band depth this level's labels need: twice the furthest any of their ink can reach from the
 * band's mid-radius, over every sector angle. `bandDepth(level) >= labelFit(level)` is the whole
 * fit guarantee, and a unit test holds the table above to it.
 */
export const labelFit = (level: number): number =>
  2 * Math.max(...labelRects(level).map(({ half, reach }) => Math.hypot(half, reach)));

export const bandDepth = (level: number, scale = 1): number => (BANDS[level][1] - BANDS[level][0]) * scale;

/**
 * The tick marking a sector as a parent. It replaces the "▸" that used to cost a whole text line in
 * every parent label; drawn in the SVG it costs only this much of the band's outer edge.
 */
export const MARK_SIZE = 4;
/** Clearance between the tick's outer point and the band's outer arc */
export const MARK_CLEAR = 2;

/** How many sectors a level can hold before labels collide: roughly arc-at-mid-radius / 70px */
export const ITEM_CAPS = [7, 11, 15, 19] as const;

export const GAP_PX = 3;
export const HOVER_GROW = 5;

/** Room inside the SVG box for the hover growth; the shadow is drawn outside it (overflow: visible) */
const BOX_PAD = 6;
/** Gap between the OUTERMOST OPEN ring's outer edge and the drawer's near edge */
const DRAWER_CLEAR = 14;
/** Gap between the outermost open ring and the breadcrumb sitting above it */
export const CRUMB_CLEAR = 10;

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
  return BANDS.map(([inner, outer]): [number, number] => [inner * scale, outer * scale]);
}

/**
 * The outer edge of the deepest ring that COULD be drawn. Only the box uses this: it has to hold a
 * drill to level 3 without relaying out, so it is sized once at open and never moves.
 */
export const maxOuterRadius = (scale = 1): number => BANDS[MAX_DEPTH - 1][1] * scale;

/**
 * The outer edge of the deepest ring actually OPEN, which is where the ring visibly ends. Everything
 * anchored to the ring - the drawer, the breadcrumb - hangs off this rather than off the maximum
 * above, or a two-ring wheel gets its drawer 164px out in empty space and its breadcrumb in the
 * corner of the screen.
 */
export const openOuterRadius = (level: number, scale = 1): number =>
  BANDS[Math.min(Math.max(Math.trunc(level), 0), MAX_DEPTH - 1)][1] * scale;

/** Half the rendered SVG box: the maximum, so opening a ring never resizes the box */
export const boxRadius = (scale = 1): number => maxOuterRadius(scale) + BOX_PAD * scale;

/** Distance from the wheel centre to the drawer's near edge, for a wheel open to `level` */
export const drawerOffset = (level: number, scale = 1): number => openOuterRadius(level, scale) + DRAWER_CLEAR * scale;

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

/** The parent tick: a small triangle pointing outward, just inside the band's outer arc */
export function markPath(mid: number, outer: number, scale = 1): string {
  const size = MARK_SIZE * scale;
  const tip = outer - MARK_CLEAR * scale;
  const base = tip - size;
  const half = size * 0.6;
  const [cx, cy] = [Math.cos(mid), Math.sin(mid)];
  const at = (r: number, offset: number): string =>
    `${(cx * r - cy * offset).toFixed(2)} ${(cy * r + cx * offset).toFixed(2)}`;
  return `M ${at(base, -half)} L ${at(tip, 0)} L ${at(base, half)} Z`;
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
