import { describe, expect, it } from "vitest";
import { fractalizeCoastline, sampleCoastlineShape } from "./coastline-fractal";

describe("coastline shaping", () => {
  const points: [number, number][] = [
    [10, 10],
    [80, 12],
    [88, 55],
    [50, 85],
    [12, 60]
  ];

  it("is deterministic from explicit render context instead of legacy globals", () => {
    const context = { bounds: { height: 100, width: 100 }, seed: "coast-detail" };
    const first = fractalizeCoastline(points, 7, "island", context);
    const second = fractalizeCoastline(points, 7, "island", context);
    const differentSeed = fractalizeCoastline(points, 7, "island", { ...context, seed: "other-detail" });

    expect(second).toEqual(first);
    expect(differentSeed.points).not.toEqual(first.points);
  });

  it("adaptively samples the legacy hybrid curves into a closed high-detail Pixi outline", () => {
    const sampled = sampleCoastlineShape({ origIndices: points.map((_, index) => index), points });

    expect(sampled.points.length).toBeGreaterThan(points.length);
    expect(sampled.origIndices).toEqual(sampled.points.map((_, index) => index));
    expect(sampled.maxOffset).toBeGreaterThan(0);
    expect(sampled.points.at(-1)).not.toEqual(sampled.points[0]);
    expect(sampled.points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });
});
