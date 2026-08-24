import { describe, expect, it } from "vitest";
import { buildCellFillScene } from "./cell-fill-scene";
import { buildRetainedCellTopology } from "./retained-cell-topology";

describe("buildCellFillScene", () => {
  it("combines retained topology and semantic attributes into a renderer-neutral polygon batch", () => {
    const topology = buildRetainedCellTopology({
      cellIds: [2],
      cellVertices: [undefined, undefined, [0, 1, 2]],
      revision: "topology:4",
      vertexPoints: [
        [1, 2],
        [5, 2],
        [1, 6]
      ]
    });
    const scene = buildCellFillScene(
      topology,
      {
        assignments: Uint8Array.from([0, 0, 1]),
        colors: [{}, { color: "#336699" }],
        fallbackColor: "#888888",
        heights: Uint8Array.from([0, 0, 20])
      },
      "states",
      "states:9"
    );

    expect(scene).toMatchObject({
      bounds: { maxX: 5, maxY: 6, minX: 1, minY: 2 },
      domainIds: [2],
      kind: "polygon-batch",
      layer: "states",
      revision: "states:9"
    });
    expect(scene.positions).toBe(topology.positions);
    expect(scene.indices).toBe(topology.indices);
    expect(scene.colors).toEqual(Float32Array.from([0.2, 0.4, 0.6, 1, 0.2, 0.4, 0.6, 1, 0.2, 0.4, 0.6, 1]));
  });
});
