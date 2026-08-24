import { describe, expect, it } from "vitest";
import { buildRetainedCellTopology, getCellGeometryRange, RetainedCellTopologyCache } from "./retained-cell-topology";

const vertexPoints = [
  [0, 0],
  [2, 0],
  [2, 2],
  [0, 2],
  [3, 1]
] as const;

describe("buildRetainedCellTopology", () => {
  it("builds stable triangle fans and per-cell update ranges", () => {
    const topology = buildRetainedCellTopology({
      cellIds: [2, 5],
      cellVertices: [undefined, undefined, [0, 1, 2, 3], undefined, undefined, [1, 4, 2]],
      revision: 7,
      vertexPoints
    });

    expect([...topology.positions]).toEqual([0, 0, 2, 0, 2, 2, 0, 2, 2, 0, 3, 1, 2, 2]);
    expect([...topology.indices]).toEqual([0, 1, 2, 0, 2, 3, 4, 5, 6]);
    expect(topology.vertexCount).toBe(7);
    expect(topology.triangleCount).toBe(3);
    expect(topology.bounds).toEqual({ maxX: 3, maxY: 2, minX: 0, minY: 0 });
    expect(getCellGeometryRange(topology, 2)).toEqual({
      bounds: { maxX: 2, maxY: 2, minX: 0, minY: 0 },
      cellId: 2,
      indexCount: 6,
      indexOffset: 0,
      triangleCount: 2,
      triangleOffset: 0,
      vertexCount: 4,
      vertexOffset: 0
    });
    expect(getCellGeometryRange(topology, 5)).toMatchObject({
      cellId: 5,
      indexCount: 3,
      indexOffset: 6,
      triangleCount: 1,
      triangleOffset: 2,
      vertexCount: 3,
      vertexOffset: 4
    });
    expect(getCellGeometryRange(topology, 4)).toBeUndefined();
  });

  it("drops invalid cells and normalizes repeated closing vertices", () => {
    const topology = buildRetainedCellTopology({
      cellIds: [0, 1, 2],
      cellVertices: [
        [0, 1],
        [0, 1, 99],
        [0, 1, 2, 0]
      ],
      revision: "topology-a",
      vertexPoints
    });

    expect(topology.cellRanges).toHaveLength(1);
    expect(topology.vertexCount).toBe(3);
    expect(topology.triangleCount).toBe(1);
    expect([...topology.indices]).toEqual([0, 1, 2]);
    expect(getCellGeometryRange(topology, 0)).toBeUndefined();
    expect(getCellGeometryRange(topology, 1)).toBeUndefined();
    expect(getCellGeometryRange(topology, 2)?.vertexCount).toBe(3);
  });

  it("uses 32-bit indices when the retained vertex count exceeds the WebGL 16-bit range", () => {
    const largePolygon = Array.from({ length: 65_536 }, (_, index) => index);
    const points = largePolygon.map(index => [index, index % 2] as const);
    const topology = buildRetainedCellTopology({
      cellIds: [0],
      cellVertices: [largePolygon],
      revision: 1,
      vertexPoints: points
    });

    expect(topology.indices).toBeInstanceOf(Uint32Array);
  });
});

describe("RetainedCellTopologyCache", () => {
  it("reuses topology until its explicit revision changes", () => {
    const cache = new RetainedCellTopologyCache();
    const source = { cellIds: [0], cellVertices: [[0, 1, 2]], revision: 1, vertexPoints };

    const first = cache.get(source);
    expect(cache.get({ ...source, cellVertices: [[1, 2, 3]] })).toBe(first);

    const next = cache.get({ ...source, revision: 2 });
    expect(next).not.toBe(first);
    expect(next.revision).toBe(2);

    cache.clear();
    expect(cache.get({ ...source, revision: 2 })).not.toBe(next);
  });
});
