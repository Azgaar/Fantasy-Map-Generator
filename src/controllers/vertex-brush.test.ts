import { polygonArea } from "d3";
import { beforeEach, describe, expect, it } from "vitest";
import { GraphOverride } from "@/generators/graph-override";
import "@/generators/pack-generator"; // registers the Pack global the brush looks cells up with
import type { Point } from "@/types/global";
import { isSimple, VertexBrush } from "./vertex-brush";

// one square cell away from the map frame; vertex 1 is its top-right corner
const createGraph = () => ({
  cells: {
    i: [0],
    p: [[20, 20]],
    v: [[0, 1, 2, 3]],
    f: [1],
    area: new Uint16Array(1)
  },
  vertices: {
    p: [
      [10, 10],
      [30, 10],
      [30, 30],
      [10, 30]
    ] as Point[],
    c: [[0], [0], [0], [0]],
    v: [
      [3, 1],
      [0, 2],
      [1, 3],
      [2, 0]
    ]
  },
  features: [0, { i: 1, vertices: [0, 1, 2, 3] }]
});

const polygon = (cell: number) => pack.cells.v[cell].map(id => pack.vertices.p[id]);

beforeEach(() => {
  globalThis.pack = createGraph() as unknown as typeof globalThis.pack;
  globalThis.grid = { spacing: 5 } as unknown as typeof globalThis.grid;
  options.map.graph = { width: 100, height: 100, points: 100 };
  GraphOverride.revert();
});

describe("isSimple", () => {
  it("accepts a convex polygon and rejects a bowtie", () => {
    expect(
      isSimple([
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10]
      ])
    ).toBe(true);
    expect(
      isSimple([
        [0, 0],
        [10, 10],
        [10, 0],
        [0, 10]
      ])
    ).toBe(false);
  });
});

describe("VertexBrush", () => {
  it("keeps a cell simple when a vertex is dragged across the opposite edge", () => {
    const before = Math.abs(polygonArea(polygon(0)));
    const brush = new VertexBrush([30, 10], 5); // only the corner is inside the brush

    // the bowtie keeps its winding and 30% of the area, so the area check alone lets it through
    brush.move([30, 38]);

    expect(isSimple(polygon(0))).toBe(true);
    expect(Math.abs(polygonArea(polygon(0)))).toBeGreaterThanOrEqual(before * 0.25);
  });

  it("still moves the vertex as far as the cell stays simple", () => {
    const brush = new VertexBrush([30, 10], 5);

    expect(brush.move([30, 38])).toBe(true);

    const [x, y] = pack.vertices.p[1];
    expect(x).toBe(30);
    expect(y).toBeGreaterThan(10);
    expect(y).toBeLessThan(30);
  });
});
