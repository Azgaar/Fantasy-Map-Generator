import { describe, expect, it, vi } from "vitest";
import type { Feature } from "@/generators/features";
import { buildBaseGeographyScene } from "./base-geography-scene";

const feature = (i: number, type: Feature["type"], vertices: number[], group = ""): Feature =>
  ({ group, i, type, vertices }) as Feature;

describe("base geography scene", () => {
  it("emits ordered feature masks and grouped neutral geography primitives", () => {
    const source = {
      features: [
        feature(0, "ocean", []),
        feature(1, "island", [0, 1, 2, 3]),
        feature(2, "lake", [4, 5, 6, 7], "salt"),
        feature(3, "island", [8, 9, 10, 11], "lake_island")
      ],
      vertices: {
        p: [
          [0, 0],
          [80, 0],
          [80, 40],
          [0, 40],
          [20, 10],
          [30, 10],
          [30, 20],
          [20, 20],
          [22, 12],
          [25, 12],
          [25, 15],
          [22, 15]
        ] as [number, number][]
      }
    };

    const scene = buildBaseGeographyScene(source, { height: 50, width: 100 }, "features:4");

    expect(scene.ocean).toMatchObject({
      bounds: { maxX: 100, maxY: 50, minX: 0, minY: 0 },
      domainIds: ["map"],
      kind: "polygon-batch",
      layer: "ocean",
      revision: "features:4"
    });
    expect([...scene.ocean.indices]).toEqual([0, 1, 2, 0, 2, 3]);
    expect([...scene.ocean.positions]).toEqual([0, 0, 100, 0, 100, 50, 0, 50]);
    expect(scene.landmass.polygons.map(({ domainId, role }) => [domainId, role])).toEqual([
      [1, "sea_island"],
      [3, "lake_island"]
    ]);
    expect(scene.lakes.polygons.map(({ domainId, role }) => [domainId, role])).toEqual([[2, "salt"]]);
    expect(scene.coastline.paths.map(({ closed, domainId, role }) => [domainId, role, closed])).toEqual([
      [1, "sea_island", true],
      [3, "lake_island", true]
    ]);
    expect(scene.landMask.regions.map(({ domainId, operation }) => [domainId, operation])).toEqual([
      [1, "include"],
      [2, "exclude"],
      [3, "include"]
    ]);
    expect(scene.waterMask.regions.map(({ domainId, operation }) => [domainId, operation])).toEqual([
      ["map", "include"],
      [1, "exclude"],
      [2, "include"],
      [3, "exclude"]
    ]);
  });

  it("clips shapes, skips invalid features, and delegates optional shaping without mutating source points", () => {
    const simplify = vi.fn((points: [number, number][]) => points);
    const fractalize = vi.fn((points: [number, number][]) => ({
      origIndices: points.map((_, index) => index),
      points: points.map(([x, y]) => [x + 1, y + 1] as [number, number])
    }));
    const points: [number, number][] = [
      [-10, 5],
      [5, -10],
      [20, 5],
      [5, 20]
    ];
    const scene = buildBaseGeographyScene(
      {
        features: [feature(1, "island", [0, 1, 2, 3]), feature(2, "lake", [10, 11, 12])],
        vertices: { p: points }
      },
      { height: 10, width: 10 },
      0,
      { fractalize, simplify }
    );

    expect(simplify).toHaveBeenCalledOnce();
    expect(fractalize).toHaveBeenCalledOnce();
    expect(fractalize.mock.calls[0][0].every(([x, y]) => x >= 0 && x <= 10 && y >= 0 && y <= 10)).toBe(true);
    expect(scene.landmass.domainIds).toEqual([1]);
    expect(scene.lakes.domainIds).toEqual([]);
    expect(points).toEqual([
      [-10, 5],
      [5, -10],
      [20, 5],
      [5, 20]
    ]);
  });

  it("rejects non-positive or non-finite map bounds", () => {
    const source = { features: [], vertices: { p: [] } };
    expect(() => buildBaseGeographyScene(source, { height: 10, width: 0 })).toThrow("Invalid map bounds");
    expect(() => buildBaseGeographyScene(source, { height: Number.NaN, width: 10 })).toThrow("Invalid map bounds");
  });
});
