import { describe, expect, it } from "vitest";
import type { JourneyPoint } from "@/types/Journey";
import { MAX_PATH_POINTS, medianSpacing, RESAMPLE_THRESHOLD, resampleAround } from "./journey-path-edit";

/** Points spaced `gap` apart along the x axis, cell id mirroring the index. */
const line = (count: number, gap = 10): JourneyPoint[] =>
  Array.from({ length: count }, (_, i) => [i * gap, 0, i] as JourneyPoint);

const cellAt = (x: number) => Math.round(x / 10);

const edgeLengths = (points: JourneyPoint[]): number[] =>
  points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));

describe("medianSpacing", () => {
  it("returns the gap of an evenly spaced path", () => {
    expect(medianSpacing(line(5, 10))).toBe(10);
  });

  it("returns 0 for a path that has no edges", () => {
    expect(medianSpacing([])).toBe(0);
    expect(medianSpacing(line(1))).toBe(0);
  });

  it("averages the middle two edges when the count is even", () => {
    const points: JourneyPoint[] = [
      [0, 0, 0],
      [10, 0, 1],
      [30, 0, 2],
      [60, 0, 3]
    ];
    expect(medianSpacing(points)).toBe(20); // edges 10, 20, 30
  });

  it("ignores a few stretched edges, unlike a mean", () => {
    const points = line(10, 10);
    points[9] = [900, 0, 9]; // one enormous final edge
    expect(medianSpacing(points)).toBe(10);
  });
});

describe("resampleAround", () => {
  it("subdivides an edge stretched by a drag", () => {
    const points = line(5, 10);
    points[2] = [100, 0, 2]; // drag the middle point far to the right

    const result = resampleAround(points, 2, 10, cellAt);

    expect(result.length).toBeGreaterThan(points.length);
    for (const length of edgeLengths(result)) expect(length).toBeLessThanOrEqual(10 * RESAMPLE_THRESHOLD);
  });

  it("leaves the route's shape and length untouched", () => {
    const points = line(5, 10);
    points[2] = [50, 40, 2];
    const before = edgeLengths(points).reduce((a, b) => a + b, 0);

    const result = resampleAround(points, 2, 10, cellAt);
    const after = edgeLengths(result).reduce((a, b) => a + b, 0);

    expect(after).toBeCloseTo(before, 1);
    // every original point survives, in order
    for (const point of points) {
      expect(result.some(p => p[0] === point[0] && p[1] === point[1])).toBe(true);
    }
  });

  it("does not touch edges that are still within the threshold", () => {
    const points = line(5, 10);
    expect(resampleAround(points, 2, 10, cellAt)).toHaveLength(points.length);
  });

  it("only touches the two edges adjacent to the dragged point", () => {
    const points = line(6, 10);
    points[1] = [-200, 0, 1]; // stretch edges 0 and 1
    points[4] = [400, 0, 4]; // stretch edges 3 and 4, but drag index 1

    const result = resampleAround(points, 1, 10, cellAt);
    const stretchedFarEdge = result.find(
      (p, i) => i > 0 && Math.hypot(p[0] - result[i - 1][0], p[1] - result[i - 1][1]) > 100
    );
    expect(stretchedFarEdge).toBeDefined(); // the far stretch was left alone
  });

  it("handles a dragged endpoint, which has only one adjacent edge", () => {
    const points = line(4, 10);
    points[0] = [-100, 0, 0];

    const result = resampleAround(points, 0, 10, cellAt);

    expect(result.length).toBeGreaterThan(points.length);
    expect(result[0]).toEqual(points[0]);
  });

  it("assigns each inserted point the cell it falls in", () => {
    const points = line(3, 10);
    points[1] = [50, 0, 1];

    const result = resampleAround(points, 1, 10, cellAt);
    const inserted = result.filter(p => !points.some(o => o[0] === p[0] && o[1] === p[1]));

    expect(inserted.length).toBeGreaterThan(0);
    for (const [x, , cellId] of inserted) expect(cellId).toBe(cellAt(x));
  });

  it("falls back to the edge's origin cell when no cell is found", () => {
    const points = line(3, 10);
    points[1] = [50, 0, 1];

    const result = resampleAround(points, 1, 10, () => undefined);
    const inserted = result.filter(p => !points.some(o => o[0] === p[0] && o[1] === p[1]));

    expect(inserted.length).toBeGreaterThan(0);
    for (const point of inserted) expect([0, 1].includes(point[2])).toBe(true);
  });

  it("never grows a path beyond the cap", () => {
    const points = line(3, 10);
    points[1] = [100000, 0, 1];

    const result = resampleAround(points, 1, 1, cellAt);

    expect(result.length).toBeLessThanOrEqual(MAX_PATH_POINTS);
  });

  it("is a no-op without a usable reference spacing", () => {
    const points = line(4, 10);
    expect(resampleAround(points, 1, 0, cellAt)).toBe(points);
    expect(resampleAround(points, 1, -5, cellAt)).toBe(points);
  });

  it("leaves a two-point direct line alone", () => {
    const points: JourneyPoint[] = [
      [0, 0, 0],
      [500, 0, 1]
    ];
    expect(resampleAround(points, 0, medianSpacing(points), cellAt)).toHaveLength(2);
  });
});
