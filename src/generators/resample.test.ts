import { expect, it, vi } from "vitest";
import "./grid-generator";
import { Resample as Resampler } from "./resample";

it("resamples at the requested density and records it in the map", () => {
  options = Options.getDefaultOptions();
  options.map.graph = { width: 800, height: 600, points: 1000, sampling: "square", jitter: 0.9 };
  options.generation.graph.density = 2;
  vi.stubGlobal("grid", Grid.generate("old"));
  vi.stubGlobal("pack", { cells: { p: [], g: [] }, rivers: [] });
  vi.stubGlobal("Features", {
    markupGrid: () => {
      throw new Error("stop after resampling");
    }
  });
  const identity = (x: number, y: number): [number, number] => [x, y];

  try {
    expect(() => Resampler.process({ projection: identity, inverse: identity, scale: 1 })).toThrow(
      "stop after resampling"
    );
    expect(options.map.graph.points).toBe(2000);
    expect(grid.points.length).toBeGreaterThan(1800);
    expect(grid.points.length).toBeLessThan(2200);
  } finally {
    vi.unstubAllGlobals();
  }
});
