import { describe, expect, it } from "vitest";
import { buildGridScene, GRID_PATTERN_TYPES } from "./grid-scene";

describe("grid scene", () => {
  it("builds a clipped square grid without duplicate segments", () => {
    const scene = buildGridScene({ height: 50, width: 50 }, { dx: 0, dy: 0, scale: 1, type: "square" }, "grid:1");

    expect(scene).toMatchObject({
      bounds: { maxX: 50, maxY: 50, minX: 0, minY: 0 },
      kind: "line-batch",
      layer: "grid",
      revision: "grid:1"
    });
    expect(scene.paths).toHaveLength(12);
    expect(new Set(scene.paths.map(path => JSON.stringify(path.points))).size).toBe(scene.paths.length);
    expect(scene.paths.every(path => path.points.flat().every(value => value >= 0 && value <= 50))).toBe(true);
  });

  it("supports every exposed pattern and normalizes invalid transforms", () => {
    for (const type of GRID_PATTERN_TYPES) {
      const scene = buildGridScene({ height: 80, width: 100 }, { dx: Number.NaN, dy: 2, scale: 0, type });
      expect(scene.paths.length, type).toBeGreaterThan(0);
    }
  });
});
