import { describe, expect, it } from "vitest";
import { arcPath, BANDS, GAP_PX, ITEM_CAPS, labelPoint, MAX_DEPTH, ringSpan, sectors, spineLine } from "./geometry";

const TAU = Math.PI * 2;

describe("bands", () => {
  it("has four bands matching the design spec", () => {
    expect(BANDS).toEqual([
      [58, 108],
      [112, 158],
      [162, 204],
      [208, 246]
    ]);
    expect(MAX_DEPTH).toBe(4);
    expect(ITEM_CAPS).toEqual([7, 11, 15, 19]);
  });
});

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
    const gap = GAP_PX / BANDS[1][1];
    const ring = sectors(1, 4, 0);
    const step = ringSpan(1, 4) / 4;
    expect(ring[0].to - ring[0].from).toBeCloseTo(step - gap * 2, 10);
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
    expect(line.x1).toBeCloseTo(BANDS[0][1], 10);
    expect(line.x2).toBeCloseTo(BANDS[1][0], 10);
    expect(line.y1).toBeCloseTo(0, 10);
  });
});
