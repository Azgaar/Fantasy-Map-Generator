import { describe, expect, it } from "vitest";
import {
  arcPath,
  BANDS,
  bandDepth,
  bands,
  boxRadius,
  drawerOffset,
  GAP_PX,
  ITEM_CAPS,
  LABEL,
  labelFit,
  labelPoint,
  labelRects,
  labelStack,
  MARK_CLEAR,
  MARK_SIZE,
  MAX_DEPTH,
  markPath,
  maxOuterRadius,
  openOuterRadius,
  ringSpan,
  sectors,
  spineLine,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  wheelScale
} from "./geometry";
import { WHEEL_CSS } from "./styles";

const TAU = Math.PI * 2;

describe("ringSpan", () => {
  it("spans the full circle at the root", () => {
    expect(ringSpan(0, 5)).toBeCloseTo(TAU, 10);
    expect(ringSpan(0, 19)).toBeCloseTo(TAU, 10);
  });

  it("scales with item count at deeper levels", () => {
    expect(ringSpan(1, 10)).toBeCloseTo(5.5, 10);
  });

  it("clamps to a 1.4 rad floor so tiny rings stay readable", () => {
    expect(ringSpan(1, 1)).toBeCloseTo(1.4, 10);
    expect(ringSpan(2, 2)).toBeCloseTo(1.4, 10);
  });

  it("clamps to a pi*1.88 ceiling so a child ring never closes into a circle", () => {
    expect(ringSpan(1, 40)).toBeCloseTo(Math.PI * 1.88, 10);
    expect(ringSpan(3, 19)).toBeCloseTo(Math.PI * 1.88, 10);
  });
});

describe("sectors", () => {
  it("centres the first root item on 12 o'clock", () => {
    for (const count of [1, 2, 5, 7]) {
      expect(sectors(0, count, 0)[0].mid).toBeCloseTo(-Math.PI / 2, 10);
    }
  });

  it("centres a child ring on its parent's mid-angle", () => {
    const parentMid = 0.8;
    const ring = sectors(1, 4, parentMid);
    const centre = (ring[0].from + ring[ring.length - 1].to) / 2;
    expect(centre).toBeCloseTo(parentMid, 10);
  });

  it("trims gap/outerRadius radians from each end of every sector", () => {
    const gap = GAP_PX / bands()[1][1];
    const ring = sectors(1, 4, 0);
    const step = ringSpan(1, 4) / 4;
    expect(ring[0].to - ring[0].from).toBeCloseTo(step - gap * 2, 10);
  });

  it("keeps the 3px gap a 3px gap as the dial grows", () => {
    const wide = sectors(1, 4, 0, 2);
    const gap = GAP_PX / bands(2)[1][1];
    const step = ringSpan(1, 4) / 4;
    expect(wide[0].to - wide[0].from).toBeCloseTo(step - gap * 2, 10);
    // a wider ring needs fewer radians for the same gap, so its sectors are angularly larger
    expect(wide[0].to - wide[0].from).toBeGreaterThan(sectors(1, 4, 0)[0].to - sectors(1, 4, 0)[0].from);
  });

  it("is unchanged by a scale of 1", () => {
    expect(sectors(2, 6, 0.4, 1)).toEqual(sectors(2, 6, 0.4));
  });

  it("leaves sectors non-overlapping and in order", () => {
    const ring = sectors(2, 6, 0);
    for (let i = 1; i < ring.length; i++) expect(ring[i].from).toBeGreaterThan(ring[i - 1].to);
  });
});

describe("arcPath", () => {
  it("starts at the inner radius on the from-angle", () => {
    expect(arcPath(58, 108, 0, Math.PI / 2).startsWith("M 58.00 0.00")).toBe(true);
  });

  it("clears the large-arc flag for a sweep under pi", () => {
    expect(arcPath(58, 108, 0, Math.PI / 2)).toContain("A 108 108 0 0 1");
  });

  it("sets the large-arc flag for a sweep over pi", () => {
    expect(arcPath(58, 108, 0, Math.PI * 1.5)).toContain("A 108 108 0 1 1");
  });

  it("closes the path", () => {
    expect(arcPath(58, 108, 0, 1).endsWith("Z")).toBe(true);
  });
});

describe("labelPoint", () => {
  it("sits at the mid-radius of the band", () => {
    const [x, y] = labelPoint(0, 58, 108);
    expect(x).toBeCloseTo(83, 10);
    expect(y).toBeCloseTo(0, 10);
  });
});

describe("spineLine", () => {
  it("bridges the gap between the parent band's outer edge and the child band's inner edge", () => {
    const line = spineLine(1, 0);
    expect(line.x1).toBeCloseTo(bands()[0][1], 10);
    expect(line.x2).toBeCloseTo(bands()[1][0], 10);
    expect(line.y1).toBeCloseTo(0, 10);
  });

  it("scales with the dial", () => {
    const line = spineLine(1, 0, 1.5);
    expect(line.x1).toBeCloseTo(spineLine(1, 0).x1 * 1.5, 10);
    expect(line.x2).toBeCloseTo(spineLine(1, 0).x2 * 1.5, 10);
  });
});

describe("bands", () => {
  it("has four bands, each starting clear of the one inside it", () => {
    expect(MAX_DEPTH).toBe(4);
    expect(ITEM_CAPS).toEqual([7, 11, 15, 19]);
    for (let level = 1; level < MAX_DEPTH; level++) {
      expect(BANDS[level][0]).toBeGreaterThan(BANDS[level - 1][1]);
    }
  });

  it("scales every radius uniformly and by nothing else", () => {
    expect(bands()).toEqual(BANDS.map(([inner, outer]) => [inner, outer]));
    expect(bands(2)).toEqual(bands().map(([inner, outer]) => [inner * 2, outer * 2]));
    expect(maxOuterRadius(2)).toBeCloseTo(maxOuterRadius() * 2, 10);
    expect(boxRadius(2)).toBeCloseTo(boxRadius() * 2, 10);
    for (const level of [0, 1, 2, 3]) {
      expect(openOuterRadius(level, 2)).toBeCloseTo(openOuterRadius(level) * 2, 10);
      expect(drawerOffset(level, 2)).toBeCloseTo(drawerOffset(level) * 2, 10);
    }
  });

  // The bug both of these guard: the chrome hung off the deepest POSSIBLE ring, so a two-ring wheel
  // put its drawer 164px past where the ring visibly ends and its breadcrumb in the screen's corner.
  // The BOX is the one thing that must keep using the maximum - it cannot resize as rings open.
  it("separates the ring that is open from the deepest one the box has to hold", () => {
    expect(openOuterRadius(MAX_DEPTH - 1)).toBe(maxOuterRadius());
    for (const level of [0, 1, 2]) {
      expect(openOuterRadius(level)).toBe(BANDS[level][1]);
      expect(openOuterRadius(level)).toBeLessThan(maxOuterRadius());
      expect(drawerOffset(level)).toBeLessThan(drawerOffset(MAX_DEPTH - 1));
    }
    // and the box still accommodates a drill to the deepest level from the moment it is opened
    expect(boxRadius()).toBeGreaterThan(maxOuterRadius());
  });

  it("clamps an open level outside the band table rather than reading off the end", () => {
    expect(openOuterRadius(-1)).toBe(BANDS[0][1]);
    expect(openOuterRadius(MAX_DEPTH + 2)).toBe(maxOuterRadius());
  });

  it("keeps the drawer a constant clearance beyond whichever ring is open", () => {
    const clear = drawerOffset(0) - openOuterRadius(0);
    expect(clear).toBeGreaterThan(0);
    for (const level of [1, 2, 3]) expect(drawerOffset(level) - openOuterRadius(level)).toBeCloseTo(clear, 10);
  });

  it("gives every ring at its cap more arc per label than the label is wide", () => {
    const table = bands();
    ITEM_CAPS.forEach((cap, level) => {
      const mid = (table[level][0] + table[level][1]) / 2;
      const arc = (ringSpan(level, cap) * mid) / cap;
      expect(arc).toBeGreaterThan(LABEL.width);
    });
  });
});

// The bug this guards: a label is an upright box centred on the band's mid-radius, so the share of
// the band's RADIAL depth it eats depends on where the sector points - the widest text LINE at
// 3 o'clock, the whole STACK at 12 o'clock, a mix in between. Asserting those two angles is not the
// same as asserting the maximum, and it was the angles in between that still spilled: for an ink box
// of half-width `a` reaching `reach` from the label's centre, the radial half-extent at angle t is
// `a*|cos t| + reach*|sin t|`, whose maximum over t is `hypot(a, reach)` - larger than either.
//
// The assertion below is that maximum, per ink box, and it is deliberately blind to the strings the
// tree happens to hold today: text lines are taken at the FULL label width, because
// `overflow-wrap: anywhere` makes a broken long word exactly that wide, and the HERE channel labels
// sectors with generated names ("Confederation of …") that do break.
describe("every ink box a label can produce fits its band, at every sector angle", () => {
  const levels = [0, 1, 2, 3];

  it("holds the furthest-reaching ink box at each level", () => {
    for (const level of levels) {
      for (const rect of labelRects(level)) {
        const needs = 2 * Math.hypot(rect.half, rect.reach);
        expect(bandDepth(level), `level ${level}, ${rect.name}`).toBeGreaterThan(needs);
      }
      expect(bandDepth(level), `level ${level}`).toBeGreaterThan(labelFit(level));
    }
  });

  it("covers the two axes the earlier, weaker bound checked", () => {
    // sideways is `hypot(width/2, 0) * 2` and upright is `hypot(0, stack/2) * 2`, so both are
    // corollaries of the bound above rather than assertions of their own
    for (const level of levels) {
      expect(labelFit(level)).toBeGreaterThanOrEqual(LABEL.width);
      expect(labelFit(level)).toBeGreaterThanOrEqual(labelStack(level));
    }
  });

  it("needs asserting only once, because both sides scale with uiSize together", () => {
    for (const scale of [0.8, 1, 2]) {
      for (const level of levels) {
        expect(bandDepth(level, scale) / scale).toBeCloseTo(bandDepth(level), 10);
        expect(bandDepth(level, scale)).toBeGreaterThan(labelFit(level) * scale);
      }
    }
  });

  it("leaves the parent tick room outside the tallest label that carries one", () => {
    // the tick sits at the band's outer edge on any sector with children, note line or not
    for (const level of levels) {
      const clearance = (bandDepth(level) - labelStack(level)) / 2;
      expect(clearance, `level ${level}`).toBeGreaterThan(MARK_SIZE + MARK_CLEAR);
    }
  });

  // Expected values are literals on purpose: styles.ts interpolates LABEL, so comparing the CSS
  // back against LABEL would pass for any value at all. These numbers are the ones the band table
  // above was solved for, so changing a metric has to change this test too.
  it("is the same label the stylesheet paints", () => {
    expect(LABEL).toEqual({
      width: 62,
      lines: 2,
      gap: 2,
      lineHeight: 1.15,
      note: 8.5,
      noteWidth: 0.65,
      root: { font: 10.5, icon: 19 },
      deep: { font: 9.5, icon: 16 }
    });
    expect(WHEEL_CSS).toContain("width: calc(62px * var(--mw-ui, 1))");
    expect(WHEEL_CSS).toContain("font-size: calc(9.5px * var(--mw-ui, 1))");
    expect(WHEEL_CSS).toContain("font-size: calc(10.5px * var(--mw-ui, 1))");
    expect(WHEEL_CSS).toContain("line-height: 1.15");
    expect(WHEEL_CSS).toContain("-webkit-line-clamp: 2");
    expect(WHEEL_CSS).toContain("max-width: 65%");
    // and the two rules that bound the ink to that label however long a name is
    expect(WHEEL_CSS).toContain("overflow-wrap: anywhere");
    expect(WHEEL_CSS).toContain("text-overflow: ellipsis");
  });
});

describe("markPath", () => {
  it("points outward from just inside the band's outer arc", () => {
    const outer = BANDS[1][1];
    const points = [...markPath(0, outer).matchAll(/(-?\d+\.\d+) (-?\d+\.\d+)/g)].map(m => [+m[1], +m[2]]);
    expect(points).toHaveLength(3);
    const tip = points[1];
    expect(tip[0]).toBeCloseTo(outer - MARK_CLEAR, 10);
    expect(tip[1]).toBeCloseTo(0, 10);
    // the two base corners sit MARK_SIZE further in, either side of the mid-angle
    expect(points[0][0]).toBeCloseTo(outer - MARK_CLEAR - MARK_SIZE, 10);
    expect(points[0][1]).toBeCloseTo(-points[2][1], 10);
  });

  it("stays inside the band at every angle and scale", () => {
    for (const scale of [0.8, 1, 2]) {
      const [inner, outer] = bands(scale)[2];
      for (const mid of [0, 1.1, -2.4, Math.PI]) {
        const points = [...markPath(mid, outer, scale).matchAll(/(-?\d+\.\d+) (-?\d+\.\d+)/g)];
        for (const [, x, y] of points) {
          const r = Math.hypot(+x, +y);
          expect(r).toBeLessThanOrEqual(outer);
          expect(r).toBeGreaterThan(inner);
        }
      }
    }
  });
});

describe("wheelScale", () => {
  it("follows uiSize inside its own clamp", () => {
    expect(wheelScale(1, 1920, 1200)).toBe(1);
    expect(wheelScale(1.4, 1920, 1200)).toBeCloseTo(1.4, 10);
  });

  it("clamps uiSize to the 0.8..2 the dial can absorb", () => {
    expect(wheelScale(0.3, 2560, 1600)).toBeCloseTo(UI_SCALE_MIN, 10);
    expect(wheelScale(3, 2560, 1600)).toBeCloseTo(UI_SCALE_MAX, 10);
  });

  it("defaults to 1 when uiSize is missing or unreadable", () => {
    expect(wheelScale(Number.NaN, 1920, 1200)).toBe(1);
    expect(wheelScale(0, 1920, 1200)).toBe(1);
  });

  it("clamps again so the box never outgrows the viewport", () => {
    // the box divides back out to the room it was fitted into, so allow float dust and nothing more
    const fits = (box: number, room: number) => expect(box).toBeLessThanOrEqual(room + 1e-9);
    const scale = wheelScale(2, 1280, 720);
    fits(boxRadius(scale) * 2, 720 - 32);
    expect(scale).toBeLessThan(UI_SCALE_MAX);
    fits(boxRadius(wheelScale(2, 400, 400)) * 2, 400 - 32);
  });
});
