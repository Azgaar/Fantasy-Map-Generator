import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Pack } from "@/model/graph/pack-generator";
import { Coastline } from "@/model/physical/coastline-generator";
import type { Point } from "@/types/global";
import { BattleSite } from "./battle-site";

const square = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1]
];

/** A map 100 × 100 of 10 × 10 cells, its features by the cell centre, each with its outline */
function stubMap(
  features: { land: boolean; type: string; subtype?: string; outline: Point[]; at: (p: Point) => boolean }[]
) {
  const p = Array.from({ length: 100 }, (_, i): Point => [5 + (i % 10) * 10, 5 + Math.floor(i / 10) * 10]);
  const f = p.map(point => features.findLastIndex(feature => feature.at(point)) + 1);
  vi.stubGlobal("pack", { cells: { i: p.map((_, i) => i), p, f }, features: [0, ...features] });
  vi.spyOn(Pack, "findAll").mockImplementation((x, y, radius) =>
    p.flatMap((point, i) => (Math.hypot(point[0] - x, point[1] - y) <= radius ? [i] : []))
  );
  vi.spyOn(Coastline, "getFeatureShape").mockImplementation(feature => {
    const { outline } = features[pack.features.indexOf(feature) - 1];
    return { points: outline, origIndices: outline.map((_, i) => i) };
  });
}

describe("getShore", () => {
  let graph: typeof options.map.graph;
  beforeEach(() => {
    graph = options.map.graph;
    options.map.graph = { ...graph, width: 100, height: 100 };
  });
  afterEach(() => {
    options.map.graph = graph;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("finds the coast of the sea", () => {
    stubMap([
      { land: false, type: "ocean", outline: square(0, 0, 100, 100), at: () => true },
      {
        land: true,
        type: "island",
        outline: square(20, 20, 80, 80),
        at: ([x, y]) => x > 20 && x < 80 && y > 20 && y < 80
      }
    ]);
    expect(BattleSite.getShore([50, 75])).toEqual([50, 80]);
  });

  it("finds no shore where the land runs off the map's edge", () => {
    stubMap([{ land: true, type: "island", outline: square(0, 0, 100, 100), at: () => true }]);
    expect(BattleSite.getShore([50, 3])).toBeNull();
  });

  it("finds the shore of a lake, but not of a dry one", () => {
    const lake = (subtype: string) =>
      stubMap([
        { land: true, type: "island", outline: square(0, 0, 100, 100), at: () => true },
        {
          land: false,
          type: "lake",
          subtype,
          outline: square(40, 40, 60, 60),
          at: ([x, y]) => x > 40 && x < 60 && y > 40 && y < 60
        }
      ]);
    lake("freshwater");
    expect(BattleSite.getShore([50, 68])).toEqual([50, 60]);
    lake("dry");
    expect(BattleSite.getShore([50, 68])).toBeNull();
  });
});
