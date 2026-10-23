import { describe, expect, it, vi } from "vitest";
import type { PackedGraph } from "@/types/PackedGraph";
import "./pack-generator";

describe("packed-cell spatial queries", () => {
  it("reuses one quadtree for repeated queries against the same map", () => {
    const points: [number, number][] = [
      [0, 0],
      [5, 0],
      [10, 0]
    ];
    const mapPoints = vi.spyOn(points, "map");
    const graph = { cells: { p: points } } as PackedGraph;

    expect(Pack.findAll(5, 0, 6, graph).sort()).toEqual([0, 1, 2]);
    expect(Pack.findAll(5, 0, 2, graph)).toEqual([1]);
    expect(Pack.findCell(6, 0, Infinity, graph)).toBe(1);
    expect(mapPoints).toHaveBeenCalledOnce();
  });
});
