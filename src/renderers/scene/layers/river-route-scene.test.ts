import { describe, expect, it } from "vitest";
import type { MapRenderWorld } from "../render-world";
import { buildRiverScene, buildRouteScene } from "./river-route-scene";

const world = {
  cells: {
    fl: Float32Array.from([20, 80, 160]),
    h: Uint8Array.from([60, 40, 10]),
    p: [
      [10, 10],
      [50, 30],
      [90, 60]
    ]
  },
  rivers: [{ basin: 1, cells: [0, 1, 2], i: 7, sourceWidth: 0.2, widthFactor: 1 }],
  routes: [
    {
      group: "roads",
      i: 4,
      points: [
        [0, 0, 0],
        [30, 10, 1],
        [60, 40, 2]
      ]
    },
    {
      group: "searoutes",
      i: 5,
      points: [
        [10, 80, 0],
        [50, 60, 1]
      ]
    }
  ]
} as unknown as MapRenderWorld;

describe("river and route scenes", () => {
  it("builds stable variable-width river polygons from domain cells", () => {
    const first = buildRiverScene(world, { height: 100, width: 100 }, "rivers:1");
    const second = buildRiverScene(world, { height: 100, width: 100 }, "rivers:1");

    expect(first).toMatchObject({ kind: "polygon-path-batch", layer: "rivers", revision: "rivers:1" });
    expect(first.polygons).toHaveLength(1);
    expect(first.polygons[0]).toMatchObject({ domainId: 7, role: "basin:1" });
    expect(first.polygons[0].points.length).toBeGreaterThan(world.rivers[0].cells.length * 2);
    expect(first).toEqual(second);
  });

  it("samples grouped curved route lines without producing SVG path data", () => {
    const scene = buildRouteScene(world, "routes:1");

    expect(scene).toMatchObject({ kind: "line-batch", layer: "routes", revision: "routes:1" });
    expect(scene.paths.map(path => [path.domainId, path.role])).toEqual([
      [4, "roads"],
      [5, "searoutes"]
    ]);
    expect(scene.paths[0].points.length).toBeGreaterThan(world.routes[0].points.length);
    expect(scene.bounds).not.toBeNull();
  });
});
