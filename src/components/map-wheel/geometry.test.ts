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
  labelPoint,
  labelStack,
  MARK_CLEAR,
  MARK_SIZE,
  MAX_DEPTH,
  markPath,
  outerRadius,
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
    expect(outerRadius(2)).toBeCloseTo(outerRadius() * 2, 10);
    expect(boxRadius(2)).toBeCloseTo(boxRadius() * 2, 10);
    expect(drawerOffset(2)).toBeCloseTo(drawerOffset() * 2, 10);
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

// The bug this guards: a label is an upright box, so which of its two dimensions eats the band's
// RADIAL depth depends on where the sector points. At 3 o'clock the depth has to cover the widest
// TEXT LINE; at 12 o'clock it has to cover the whole STACK. Sizing labels against the arc alone
// left ink outside 141 of 882 measured placements. Both sides below are derived - the band table
// from BANDS, the label from LABEL - and the stylesheet is written from that same LABEL, so no
// third number can drift in between.
describe("a label fits the band it sits in", () => {
  const levels = [0, 1, 2, 3];

  it("holds the widest text line a label can produce, at a sector pointing sideways", () => {
    for (const level of levels) expect(bandDepth(level), `level ${level}`).toBeGreaterThan(LABEL.width);
  });

  it("holds the tallest stack a label can produce, at a sector pointing up", () => {
    for (const level of levels) {
      expect(bandDepth(level), `level ${level}`).toBeGreaterThan(labelStack(level));
    }
  });

  it("leaves the parent tick room outside the label it marks", () => {
    // the tick is only drawn where no note line is, so that is the stack it has to clear
    for (const level of levels) {
      const clearance = (bandDepth(level) - labelStack(level, LABEL.lines, false)) / 2;
      expect(clearance, `level ${level}`).toBeGreaterThan(MARK_SIZE + MARK_CLEAR);
    }
  });

  it("writes those very metrics into the stylesheet", () => {
    expect(WHEEL_CSS).toContain(`width: calc(${LABEL.width}px * var(--mw-ui, 1))`);
    expect(WHEEL_CSS).toContain(`font-size: calc(${LABEL.deep.font}px * var(--mw-ui, 1))`);
    expect(WHEEL_CSS).toContain(`font-size: calc(${LABEL.root.font}px * var(--mw-ui, 1))`);
    expect(WHEEL_CSS).toContain(`line-height: ${LABEL.lineHeight}`);
    expect(WHEEL_CSS).toContain(`-webkit-line-clamp: ${LABEL.lines}`);
    expect(WHEEL_CSS).toContain(`max-width: ${Math.round(LABEL.noteWidth * 100)}%`);
    // a word longer than the label must break rather than reach outside the band
    expect(WHEEL_CSS).toContain("overflow-wrap: anywhere");
  });

  it("scales the whole fit with uiSize, so no size can break it", () => {
    for (const scale of [0.8, 1, 2]) {
      for (const level of levels) {
        expect(bandDepth(level, scale)).toBeGreaterThan(LABEL.width * scale);
        expect(bandDepth(level, scale)).toBeGreaterThan(labelStack(level) * scale);
      }
    }
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
