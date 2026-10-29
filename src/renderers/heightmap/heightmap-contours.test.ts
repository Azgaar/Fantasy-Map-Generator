import Delaunator from "delaunator";
import { describe, expect, test } from "vitest";
import type { Point } from "@/types/global";
import { getHeightContours, smoothContourHeights } from "./heightmap-contours";

const points: Point[] = Array.from({ length: 25 }, (_, i) => [(i % 5) * 10, Math.floor(i / 5) * 10]);
const indices = Delaunator.from(points).triangles;
const triangles = Array.from({ length: indices.length / 3 }, (_, i) => Array.from(indices.slice(i * 3, i * 3 + 3)));

describe("heightmap contours", () => {
  test("surface smoothing reduces cell noise while preserving constant terrain and source heights", () => {
    const heights = new Uint8Array([30, 50, 30]);
    const neighbors = [[1], [0, 2], [1]];
    expect(Array.from(smoothContourHeights(heights, neighbors))).toEqual([40, 40, 40]);
    expect(Array.from(heights)).toEqual([30, 50, 30]);
    expect(Array.from(smoothContourHeights([30, 30, 30], neighbors))).toEqual([30, 30, 30]);
    expect(Array.from(smoothContourHeights([30], [[]]))).toEqual([30]);
  });

  test("interpolates levels between samples instead of requiring a cell at that elevation", () => {
    const result = getHeightContours(
      [
        [0, 0],
        [10, 0],
        [0, 10]
      ],
      [20, 80, 20],
      [[0, 1, 2]],
      [50],
      5
    );
    expect(result).toEqual([{ height: 50, major: false, path: "M5,0L5,5" }]);
  });

  test("a uniform plateau has no contour or artificial border, including at its exact height", () => {
    expect(getHeightContours(points, new Uint8Array(25).fill(50), triangles, [25, 50, 75], 5)).toEqual([]);
  });

  test("a slope joins into a single open line from one map edge to the other", () => {
    const heights = points.map(([x]) => 20 + x * 2);
    const [contour] = getHeightContours(points, heights, triangles, [45], 5);
    expect(contour.major).toBe(true);
    expect(contour.path.match(/M/g)).toHaveLength(1);
    expect(contour.path).not.toMatch(/Z/);
    expect(contour.path).toMatch(/12\.5,0/);
    expect(contour.path).toMatch(/12\.5,40/);
  });

  test("isolated hills and depressions produce closed loops", () => {
    for (const [base, center] of [
      [20, 80],
      [80, 20]
    ]) {
      const heights = new Uint8Array(25).fill(base);
      heights[12] = center;
      const [contour] = getHeightContours(points, heights, triangles, [50], 5);
      expect(contour.path.match(/M/g)).toHaveLength(1);
      expect(contour.path).toMatch(/Z/);
      expect(contour.path).not.toMatch(/NaN|Infinity/);
    }
  });

  test("exact sample heights and saddle points stay finite, deterministic, and leave heights unchanged", () => {
    const heights = Uint8Array.from(points, ([x, y]) => 50 + ((x - 20) * (y - 20)) / 10);
    const before = heights.slice();
    const result = getHeightContours(points, heights, triangles, [25, 50, 75], 5);
    expect(result.length).toBe(3);
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
    expect(getHeightContours(points, heights, triangles, [25, 50, 75], 5)).toEqual(result);
    expect(heights).toEqual(before);
  });
});
