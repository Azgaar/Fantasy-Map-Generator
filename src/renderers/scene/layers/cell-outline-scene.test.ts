import { describe, expect, it } from "vitest";
import { buildCellOutlineScene } from "./cell-outline-scene";

describe("cell outline scene", () => {
  it("emits each shared Voronoi edge once with stable vertex-pair ids", () => {
    const scene = buildCellOutlineScene(
      {
        cells: {
          i: [0, 1],
          v: [
            [0, 1, 2],
            [1, 3, 2]
          ]
        },
        vertices: {
          p: [
            [0, 0],
            [10, 0],
            [0, 10],
            [10, 10]
          ]
        }
      },
      "cells:2"
    );

    expect(scene).toMatchObject({
      bounds: { maxX: 10, maxY: 10, minX: 0, minY: 0 },
      kind: "line-batch",
      layer: "cells",
      revision: "cells:2"
    });
    expect(scene.domainIds).toEqual(["0:1", "1:2", "0:2", "1:3", "2:3"]);
    expect(scene.paths).toHaveLength(5);
  });

  it("skips invalid and duplicate edges", () => {
    const scene = buildCellOutlineScene({
      cells: { i: [0], v: [[0, 0, 1, 99]] },
      vertices: {
        p: [
          [0, 0],
          [1, 0]
        ]
      }
    });

    expect(scene.domainIds).toEqual(["0:1"]);
  });
});
