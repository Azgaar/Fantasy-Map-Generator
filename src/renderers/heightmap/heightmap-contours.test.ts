import Delaunator from "delaunator";
import { describe, expect, test } from "vitest";
import type { Point } from "@/types/global";
import {
  getContourInterval,
  getContourLabels,
  getContourLevels,
  getHeightContourChains,
  getHeightContours,
  smoothContourHeights
} from "./heightmap-contours";

const points: Point[] = Array.from({ length: 25 }, (_, i) => [(i % 5) * 10, Math.floor(i / 5) * 10]);
const indices = Delaunator.from(points).triangles;
const triangles = Array.from({ length: indices.length / 3 }, (_, i) => Array.from(indices.slice(i * 3, i * 3 + 3)));

// contour paths of plain generator-height levels, as the tests below trace them
const traceContours = (points: Point[], heights: ArrayLike<number>, triangles: number[][], thresholds: number[]) =>
  getHeightContours(
    getHeightContourChains(points, heights, triangles, thresholds),
    thresholds.map(height => ({ height, value: height, major: height === 45 }))
  );

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
    const result = traceContours(
      [
        [0, 0],
        [10, 0],
        [0, 10]
      ],
      [20, 80, 20],
      [[0, 1, 2]],
      [50]
    );
    expect(result).toEqual([{ height: 50, major: false, path: "M5,0L5,5" }]);
  });

  test("a uniform plateau has no contour or artificial border, including at its exact height", () => {
    expect(traceContours(points, new Uint8Array(25).fill(50), triangles, [25, 50, 75])).toEqual([]);
  });

  test("a slope joins into a single open line from one map edge to the other", () => {
    const heights = points.map(([x]) => 20 + x * 2);
    const [contour] = traceContours(points, heights, triangles, [45]);
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
      const [contour] = traceContours(points, heights, triangles, [50]);
      expect(contour.path.match(/M/g)).toHaveLength(1);
      expect(contour.path).toMatch(/Z/);
      expect(contour.path).not.toMatch(/NaN|Infinity/);
    }
  });

  test("exact sample heights and saddle points stay finite, deterministic, and leave heights unchanged", () => {
    const heights = Uint8Array.from(points, ([x, y]) => 50 + ((x - 20) * (y - 20)) / 10);
    const before = heights.slice();
    const result = traceContours(points, heights, triangles, [25, 50, 75]);
    expect(result.length).toBe(3);
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
    expect(traceContours(points, heights, triangles, [25, 50, 75])).toEqual(result);
    expect(heights).toEqual(before);
  });
});

describe("contour levels", () => {
  const toLand = (value: number) => 18 + Math.sqrt(value); // the default height exponent
  const toDepth = (depth: number) => 1000 / (50 + depth);

  test("land levels are round values up to the highest point, every fifth one major", () => {
    const levels = getContourLevels(100, 2550, toLand);
    expect(levels.map(level => level.value)).toEqual(Array.from({ length: 25 }, (_, i) => (i + 1) * 100));
    expect(levels[0].height).toBe(28);
    expect(levels.filter(level => level.major).map(level => level.value)).toEqual([500, 1000, 1500, 2000, 2500]);
  });

  test("values the height scale puts at or below sea level draw no land contour", () => {
    expect(getContourLevels(2, 10, toLand).map(level => level.value)).toEqual([6, 8, 10]);
  });

  test("depth levels descend from the shore", () => {
    const levels = getContourLevels(100, 500, toDepth);
    expect(levels.map(level => level.value)).toEqual([100, 200, 300, 400, 500]);
    expect(levels.every((level, i) => i === 0 || level.height < levels[i - 1].height)).toBe(true);
    expect(levels.every(level => level.height < 20)).toBe(true);
  });

  test("a flat map has no levels", () => {
    expect(getContourLevels(100, 0, toLand)).toEqual([]);
  });
});

describe("contour interval", () => {
  test("picks the offered interval nearest to the wanted number of lines", () => {
    expect(getContourInterval(9, 2704)).toBe(200);
    expect(getContourInterval(2, 150)).toBe(100);
    expect(getContourInterval(10, 100000)).toBe(2000); // the widest offered
    expect(getContourInterval(0, 50)).toBe(50); // no old line: one at most
  });
});

describe("contour labels", () => {
  const levels = [
    { height: 40, value: 400, major: false },
    { height: 50, value: 500, major: true }
  ];
  const straight = (x: number, height: number) => ({
    height,
    closed: false,
    points: Array.from({ length: 101 }, (_, i): Point => [x, i * 10])
  });
  const options = { size: 4, spacing: 240, heightAt: (x: number) => x, probe: 5 };

  test("only major contours are labeled, along the line, spread over its length", () => {
    const labels = getContourLabels([straight(100, 40), straight(500, 50)], levels, options);
    expect(labels).toHaveLength(4);
    expect(labels.every(label => label.text === "500" && label.x === 500)).toBe(true);
    expect(labels.map(label => label.y).sort((a, b) => a - b)).toEqual([125, 375, 625, 875]);
  });

  test("label tops face uphill", () => {
    const [east] = getContourLabels([straight(500, 50)], levels, options);
    expect(east.angle).toBe(90);
    const [west] = getContourLabels([straight(500, 50)], levels, { ...options, heightAt: (x: number) => -x });
    expect(west.angle).toBe(-90);
  });

  test("a loop too small for its text carries no label", () => {
    const loop = {
      height: 50,
      closed: true,
      points: [
        [0, 0],
        [5, 0],
        [5, 5],
        [0, 5]
      ] as Point[]
    };
    expect(getContourLabels([loop], levels, options)).toEqual([]);
  });

  test("labels on crowded lines keep clear of each other", () => {
    const chains = [straight(500, 50), straight(502, 50), straight(504, 50)];
    const labels = getContourLabels(chains, levels, options);
    for (const a of labels) {
      for (const b of labels) {
        if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.width);
      }
    }
  });
});
