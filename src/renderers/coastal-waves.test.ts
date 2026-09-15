import { describe, expect, test } from "vitest";
import { getCoastalDistances, getCoastalWaves } from "./coastal-waves";

const params = {
  width: 800,
  height: 600,
  spacing: 8,
  density: 1,
  length: 1,
  reach: 4,
  seed: "ink",
  distanceAt: () => Infinity
};
const starts = (path: string) => [...path.matchAll(/M([\d.-]+),([\d.-]+)/g)].map(m => [+m[1], +m[2]]);

describe("coastal wave pattern", () => {
  test("defaults to the approved wave pattern and keeps line placement identical", () => {
    const waves = getCoastalWaves(params);
    expect(getCoastalWaves({ ...params, type: "waves" })).toBe(waves);
    expect(starts(getCoastalWaves({ ...params, type: "lines" }))).toEqual(starts(waves));
  });

  test.each(["waves", "lines"] as const)("renders finite, repeatable %s", type => {
    const path = getCoastalWaves({ ...params, type });
    expect(path.length).toBeGreaterThan(0);
    expect(path).not.toMatch(/NaN|Infinity/);
    expect(path).toBe(getCoastalWaves({ ...params, type }));
    expect(getCoastalWaves({ ...params, type, distanceAt: () => 0 })).toBe("");
    expect(getCoastalWaves({ ...params, type, distanceAt: () => 7 })).toBe("");
  });

  test("each type draws a distinct shape", () => {
    const paths = (["waves", "lines"] as const).map(type => getCoastalWaves({ ...params, type }));
    expect(new Set(paths).size).toBe(2);
  });

  test("surrounds a continent with distant waves and a clear offshore band", () => {
    const distanceAt = (x: number, y: number) => {
      const radius = Math.hypot(x - 400, y - 300);
      return radius < 80 ? 0 : 1 + (radius - 80) / 8;
    };
    const path = getCoastalWaves({ ...params, distanceAt });
    const radii = starts(path).map(([x, y]) => Math.hypot(x + 8 - 400, y - 300));
    expect(radii.some(radius => radius >= 80 && radius < 105)).toBe(true);
    expect(radii.some(radius => radius > 120 && radius < 140)).toBe(false);
    expect(radii.some(radius => radius > 155 && radius < 200)).toBe(true);
    expect(path).not.toMatch(/NaN|Infinity/);
  });

  test("does not add a border stripe when a clear offshore band meets the map edge", () => {
    expect(getCoastalWaves({ ...params, distanceAt: () => 7 })).toBe("");
  });

  test("does not create dashes on land or lakes, even at map edges", () => {
    expect(getCoastalWaves({ ...params, distanceAt: () => 0 })).toBe("");
  });

  test("adds a sparse coastal fringe away from map edges", () => {
    const path = getCoastalWaves({ ...params, distanceAt: x => Math.min(8, 1 + Math.abs(x - 400) / 8) });
    const points = starts(path).filter(([, y]) => y > 200 && y < 400);
    expect(points.some(([x]) => x > 370 && x < 430)).toBe(true);
    expect(points.some(([x]) => x > 200 && x < 300)).toBe(false);
  });

  test("redraws identically and varies with the seed", () => {
    expect(getCoastalWaves(params)).toBe(getCoastalWaves(params));
    expect(getCoastalWaves({ ...params, seed: "other" })).not.toBe(getCoastalWaves(params));
  });

  test("higher density adds strokes and longer reach extends coastal waves", () => {
    expect(starts(getCoastalWaves({ ...params, density: 2 })).length).toBeGreaterThan(
      starts(getCoastalWaves(params)).length
    );
    expect(starts(getCoastalWaves({ ...params, reach: 8, distanceAt: () => 5 })).length).toBeGreaterThan(
      starts(getCoastalWaves({ ...params, distanceAt: () => 5 })).length
    );
  });

  test("keeps extensive deep-sea waves below a quarter of the former full-map path size", () => {
    const path = getCoastalWaves({ ...params, width: 1920, height: 1080 });
    expect(path.length).toBeLessThan(2_500_000);
  });
});

describe("coastal distances", () => {
  test("supports reaches beyond the nine rings in grid.cells.t without changing terrain", () => {
    const heights = [30, ...new Array(20).fill(10)];
    const neighbors = heights.map((_, i) => [i - 1, i + 1].filter(next => next >= 0 && next < heights.length));
    const distances = getCoastalDistances(heights, neighbors, 12);
    expect(Array.from(distances.slice(0, 14))).toEqual(Array.from({ length: 14 }, (_, i) => i));
    expect(distances[14]).toBe(0);
    expect(heights).toEqual([30, ...new Array(20).fill(10)]);
  });
});
