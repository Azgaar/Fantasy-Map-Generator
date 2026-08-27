import { beforeEach, describe, expect, it } from "vitest";
import { GraphOverride } from "./graph-override";
import "./pack-generator"; // registers the Pack global the module looks cell polygons up with

// square of 4 cells sharing the central vertex 0
const createGraph = () => ({
  cells: {
    i: [0, 1, 2, 3],
    v: [
      [0, 1, 2],
      [0, 2, 3],
      [0, 3, 4],
      [0, 4, 1]
    ],
    f: [1, 1, 1, 1],
    area: new Uint16Array(4)
  },
  vertices: {
    p: [
      [10, 10],
      [0, 0],
      [20, 0],
      [20, 20],
      [0, 20]
    ],
    c: [
      [0, 1, 2],
      [0, 1],
      [0, 1],
      [1, 2],
      [2, 3]
    ],
    v: [[], [], [], [], []]
  },
  features: [0, { i: 1, vertices: [1, 2, 3, 4], area: 400 }]
});

beforeEach(() => {
  globalThis.pack = createGraph() as unknown as typeof globalThis.pack;
  globalThis.graphWidth = 100;
  globalThis.graphHeight = 100;
  GraphOverride.clear();
});

describe("GraphOverride", () => {
  it("moves a vertex and keeps the change in the state", () => {
    GraphOverride.movePackVertex(0, [12.34, 13.5]);

    expect(pack.vertices.p[0]).toEqual([12.34, 13.5]);
    expect(GraphOverride.state).toEqual({
      pack: {
        vertices: {
          p: {
            0: [
              [10, 10],
              [12.34, 13.5]
            ]
          }
        }
      }
    });
  });

  it("keeps the original value when the same vertex is moved again", () => {
    GraphOverride.movePackVertex(0, [12, 13]);
    GraphOverride.movePackVertex(0, [14, 15]);

    expect(GraphOverride.state).toEqual({
      pack: {
        vertices: {
          p: {
            0: [
              [10, 10],
              [14, 15]
            ]
          }
        }
      }
    });
  });

  it("recalculates derived cell and feature areas", () => {
    GraphOverride.movePackVertex(3, [30, 30]); // stretches the feature and the cells around the vertex

    expect(pack.features[1].area).toBeGreaterThan(400);
    expect(pack.cells.area[1]).toBeGreaterThan(0);
  });

  it("re-applies the state to a rebuilt graph", () => {
    GraphOverride.movePackVertex(0, [12, 13]);
    const state = structuredClone(GraphOverride.state);

    globalThis.pack = createGraph() as unknown as typeof globalThis.pack; // reGraph
    GraphOverride.restore(state);

    expect(pack.vertices.p[0]).toEqual([12, 13]);
    expect(GraphOverride.state).toEqual(state); // restored overrides are saved again
  });

  it("re-applies the current state after the graph is rebuilt in place", () => {
    GraphOverride.movePackVertex(0, [12, 13]);

    globalThis.pack = createGraph() as unknown as typeof globalThis.pack; // reGraph
    expect(GraphOverride.state).toEqual({}); // not applied to the new graph yet, nothing to save
    GraphOverride.restore();

    expect(pack.vertices.p[0]).toEqual([12, 13]);
  });

  it("drops overrides the rebuilt graph no longer fits", () => {
    const state = {
      pack: {
        vertices: {
          p: {
            0: [
              [10, 10],
              [12, 13]
            ], // vertex is where it was generated, the override still applies
            2: [
              [5, 5],
              [7, 7]
            ], // vertex 2 is elsewhere now, the id means another point
            9: [
              [1, 1],
              [2, 2]
            ] // vertex is gone
          }
        }
      }
    };

    GraphOverride.restore(state as never);

    expect(pack.vertices.p[0]).toEqual([12, 13]);
    expect(pack.vertices.p[2]).toEqual([20, 0]);
    expect(pack.vertices.p[9]).toBeUndefined();
    expect(GraphOverride.state).toEqual({
      pack: {
        vertices: {
          p: {
            0: [
              [10, 10],
              [12, 13]
            ]
          }
        }
      }
    });
  });
});
