import { describe, expect, it } from "vitest";
import {
  arcPath,
  BANDS,
  BASE_RADIUS_SCALE,
  bands,
  boxRadius,
  drawerOffset,
  GAP_PX,
  ITEM_CAPS,
  labelPoint,
  MAX_DEPTH,
  outerRadius,
  ringSpan,
  sectors,
  spineLine,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  wheelScale
} from "./geometry";

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

// The labels are the reason the radii carry a multiplier of their own. A root label is 74px wide,
// and at the base table 7 of them get 2pi*83/7 = 74.5px of arc each - the label is the sector.
// Scaling the whole dial cannot help, because the label scales with it; only the radii may move.
describe("bands", () => {
  it("has four base bands matching the design spec", () => {
    expect(BANDS).toEqual([
      [58, 108],
      [112, 158],
      [162, 204],
      [208, 246]
    ]);
    expect(MAX_DEPTH).toBe(4);
    expect(ITEM_CAPS).toEqual([7, 11, 15, 19]);
  });

  it("applies the base radius multiplier and nothing else at scale 1", () => {
    expect(bands()).toEqual(BANDS.map(([inner, outer]) => [inner * BASE_RADIUS_SCALE, outer * BASE_RADIUS_SCALE]));
    expect(bands(1)).toEqual(bands());
  });

  it("scales every radius uniformly", () => {
    expect(bands(2)).toEqual(bands().map(([inner, outer]) => [inner * 2, outer * 2]));
    expect(outerRadius(2)).toBeCloseTo(outerRadius() * 2, 10);
    expect(boxRadius(2)).toBeCloseTo(boxRadius() * 2, 10);
    expect(drawerOffset(2)).toBeCloseTo(drawerOffset() * 2, 10);
  });

  it("buys every ring more arc per label than the label is wide", () => {
    const widths = [74, 66, 66, 66];
    const table = bands();
    ITEM_CAPS.forEach((cap, level) => {
      const mid = (table[level][0] + table[level][1]) / 2;
      const arc = (ringSpan(level, cap) * mid) / cap;
      expect(arc).toBeGreaterThan(widths[level]);
    });
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
    const scale = wheelScale(2, 1280, 720);
    expect(boxRadius(scale) * 2).toBeLessThanOrEqual(720 - 32);
    expect(scale).toBeLessThan(UI_SCALE_MAX);
    expect(boxRadius(wheelScale(2, 400, 400)) * 2).toBeLessThanOrEqual(400 - 32);
  });
});
