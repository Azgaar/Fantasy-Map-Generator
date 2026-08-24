import { describe, expect, it } from "vitest";
import { buildAssignmentBoundaryScene } from "./assignment-boundary-scene";

describe("assignment boundary scene", () => {
  const source = {
    cells: {
      h: Uint8Array.from([30, 30]),
      i: [0, 1],
      v: [
        [0, 1, 2, 3],
        [1, 4, 5, 2]
      ]
    },
    vertices: {
      c: [
        [0, 2, 3],
        [0, 1, 2],
        [0, 1, 2],
        [0, 2, 3],
        [1, 2, 3],
        [1, 2, 3]
      ] as [number, number, number][],
      p: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [2, 0],
        [2, 1]
      ] as [number, number][]
    }
  };

  it("draws region and coastal edges while omitting shared edges inside one region", () => {
    const sameRegion = buildAssignmentBoundaryScene(source, Uint16Array.from([1, 1]), "cultures");
    const splitRegions = buildAssignmentBoundaryScene(source, Uint16Array.from([1, 2]), "cultures");

    expect(sameRegion.paths).toHaveLength(6);
    expect(splitRegions.paths).toHaveLength(7);
    expect(splitRegions.paths.some(path => path.domainId === "cultures:1:1:2")).toBe(true);
  });
});
