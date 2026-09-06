import { describe, expect, it } from "vitest";
import { createBrushStroke } from "./brushUtils";

function record() {
  const stamps: [number, number][] = [];
  return { stamps, stamp: (x: number, y: number) => stamps.push([x, y]) };
}

describe("createBrushStroke", () => {
  it("stamps at the first point of the stroke", () => {
    const { stamps, stamp } = record();
    createBrushStroke(10, stamp).moveTo(5, 5);
    expect(stamps).toEqual([[5, 5]]);
  });

  it("places stamps at even spacing along a segment, however few events cover it", () => {
    const { stamps, stamp } = record();
    const stroke = createBrushStroke(10, stamp);
    stroke.moveTo(0, 0);
    stroke.moveTo(40, 0); // one fast event over four spacings
    expect(stamps).toEqual([
      [0, 0],
      [10, 0],
      [20, 0],
      [30, 0],
      [40, 0]
    ]);
  });

  it("stamps the same positions whether a segment arrives as one event or many", () => {
    const one = record();
    const strokeOne = createBrushStroke(10, one.stamp);
    strokeOne.moveTo(0, 0);
    strokeOne.moveTo(30, 40);

    const many = record();
    const strokeMany = createBrushStroke(10, many.stamp);
    strokeMany.moveTo(0, 0);
    for (let i = 1; i <= 25; i++) strokeMany.moveTo((30 * i) / 25, (40 * i) / 25); // 2px steps

    expect(many.stamps.length).toBe(one.stamps.length);
    many.stamps.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(one.stamps[i][0], 6);
      expect(y).toBeCloseTo(one.stamps[i][1], 6);
    });
  });

  it("carries the leftover distance into the next event", () => {
    const { stamps, stamp } = record();
    const stroke = createBrushStroke(10, stamp);
    stroke.moveTo(0, 0);
    stroke.moveTo(7, 0); // short of a spacing
    stroke.moveTo(14, 0); // 14 travelled: one stamp at 10
    stroke.moveTo(21, 0); // 21 travelled: one stamp at 20
    expect(stamps).toEqual([
      [0, 0],
      [10, 0],
      [20, 0]
    ]);
  });

  it("does not stamp for movement shorter than the spacing", () => {
    const { stamps, stamp } = record();
    const stroke = createBrushStroke(10, stamp);
    stroke.moveTo(0, 0);
    for (let i = 0; i < 100; i++) stroke.moveTo(i % 2, 0); // jitter in place
    expect(stamps).toEqual([[0, 0]]);
  });
});
