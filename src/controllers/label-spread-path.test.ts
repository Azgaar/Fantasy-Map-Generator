import { describe, expect, test } from "vitest";
import { labelSpreadInternals } from "@/controllers/label-spread";

const { getPathStartOffsetCandidates, getPathStartOffsetPreference, isPathTextUpright } = labelSpreadInternals;

describe("label spread path candidates", () => {
  test("clamps candidate offsets to 20–80 while retaining an in-range current offset", () => {
    expect(getPathStartOffsetCandidates(10)).toEqual([20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80]);
    expect(getPathStartOffsetCandidates(40)).toEqual([40, 20, 25, 30, 35, 45, 50, 55, 60, 65, 70, 75, 80]);
    expect(getPathStartOffsetCandidates(90)).toEqual([80, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75]);
  });

  test("penalizes only offsets outside the preferred 30–70 range", () => {
    expect(getPathStartOffsetPreference(20)).toBe(100);
    expect(getPathStartOffsetPreference(25)).toBe(25);
    expect(getPathStartOffsetPreference(30)).toBe(0);
    expect(getPathStartOffsetPreference(50)).toBe(0);
    expect(getPathStartOffsetPreference(70)).toBe(0);
    expect(getPathStartOffsetPreference(75)).toBe(25);
    expect(getPathStartOffsetPreference(80)).toBe(100);
  });

  test("rejects a path whose occupied text interval runs right-to-left", () => {
    expect(
      isPathTextUpright(
        fakePath([
          [100, 0],
          [0, 0]
        ]),
        30,
        50
      )
    ).toBe(false);
  });

  test("rejects a local reversal inside the occupied text interval", () => {
    const path = fakePath([
      [0, 0],
      [60, 0],
      [40, 10],
      [100, 10]
    ]);
    expect(isPathTextUpright(path, 50, 50)).toBe(false);
  });

  test("accepts a left-to-right occupied interval", () => {
    const path = fakePath([
      [0, 0],
      [30, -10],
      [70, 10],
      [100, 0]
    ]);
    expect(isPathTextUpright(path, 40, 50)).toBe(true);
  });
});

function fakePath(points: [number, number][]) {
  const segments = points.slice(1).map(([x, y], index) => {
    const [previousX, previousY] = points[index];
    return { previousX, previousY, x, y, length: Math.hypot(x - previousX, y - previousY) };
  });
  const totalLength = segments.reduce((total, segment) => total + segment.length, 0);
  return {
    getTotalLength: () => totalLength,
    getPointAtLength: (distance: number) => {
      let remaining = Math.min(Math.max(distance, 0), totalLength);
      for (const segment of segments) {
        if (remaining > segment.length) {
          remaining -= segment.length;
          continue;
        }
        const ratio = segment.length ? remaining / segment.length : 0;
        return {
          x: segment.previousX + (segment.x - segment.previousX) * ratio,
          y: segment.previousY + (segment.y - segment.previousY) * ratio
        };
      }
      const [x, y] = points.at(-1)!;
      return { x, y };
    }
  };
}
