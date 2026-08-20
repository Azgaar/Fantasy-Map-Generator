import { describe, expect, it } from "vitest";
import type { PackedGraph } from "@/types/PackedGraph";
import { buildBorderPaths, buildBorderScene } from "./border-paths";

const graph = {
  cells: {
    c: [
      [1, 2],
      [0, 2],
      [0, 1]
    ],
    h: Uint8Array.from([0, 30, 30]),
    i: [0, 1, 2],
    province: Uint8Array.from([0, 1, 2]),
    state: Uint8Array.from([0, 1, 2]),
    v: [
      [0, 1, 2],
      [0, 1, 2],
      [1, 2, 3]
    ]
  },
  vertices: {
    c: [
      [0, 1, 0],
      [2, 1, 0],
      [2, 1, 0],
      [2, 0, 0]
    ],
    i: [0, 1, 2, 3],
    p: [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1]
    ],
    v: [
      [0, 0, 0],
      [2, 0, 0],
      [1, 3, 3],
      [3, 3, 3]
    ],
    x: [0, 1, 1, 2],
    y: [0, 0, 1, 1]
  }
} as unknown as Pick<PackedGraph, "cells" | "vertices">;

describe("border scene", () => {
  it("emits deterministic line primitives and derives the SVG compatibility path", () => {
    const scene = buildBorderScene(graph, "borders:3");

    expect(scene.state).toMatchObject({
      bounds: { maxX: 1, maxY: 1, minX: 1, minY: 0 },
      domainIds: ["state:1:2:0"],
      kind: "line-batch",
      layer: "borders",
      revision: "borders:3"
    });
    expect(scene.state.paths[0].points).toEqual([
      [1, 1],
      [1, 0]
    ]);
    expect(buildBorderPaths(graph).state).toBe("M1,1 1,0");
  });
});
