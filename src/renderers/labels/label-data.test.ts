import { beforeEach, describe, expect, it } from "vitest";
import { getLabelsData } from "./label-data";

// river.cells carries -1 as a sentinel for "runs off the map edge" (see river-generator,
// which resolves it with projectToNearestEdge). Cell -1 has no entry in pack.cells.p.
const CELL_POINTS: [number, number][] = [
  [0, 0],
  [10, 10],
  [20, 20],
  [30, 30]
];

function stubPack(rivers: unknown[]): void {
  globalThis.pack = {
    states: [],
    provinces: [],
    addedLabels: [],
    burgs: [],
    routes: [],
    rivers,
    cells: { p: CELL_POINTS }
  } as any;
  globalThis.options = { labels: { groups: [] } } as any;
  // the label path is not under test here; only the anchor is
  globalThis.Rivers = { addMeandering: () => [] } as any;
}

describe("river labels with off-map cells", () => {
  beforeEach(() => {
    stubPack([]);
  });

  it("anchors a two-cell river whose second cell runs off the map edge", () => {
    // the middle of a 2-cell river is index 1, which is exactly where the sentinel sits
    stubPack([{ i: 1, name: "Kobat", type: "River", cells: [2, -1], points: [] }]);

    const labels = getLabelsData();

    const river = labels.find(label => label.type === "river");
    expect(river).toBeDefined();
    expect(river?.anchor).toEqual([20, 20]); // the real cell, not the sentinel
  });

  it("anchors a single-cell river that only touches the edge", () => {
    stubPack([{ i: 1, name: "Edge", type: "River", cells: [-1], points: [] }]);

    expect(() => getLabelsData()).not.toThrow();
  });

  it("still anchors on the middle cell when no cell is off-map", () => {
    stubPack([{ i: 1, name: "Inland", type: "River", cells: [0, 1, 2], points: [] }]);

    const river = getLabelsData().find(label => label.type === "river");
    expect(river?.anchor).toEqual([10, 10]);
  });

  // old saves can carry rivers whose cells array was never assigned
  it("skips a river that has no cells array", () => {
    stubPack([{ i: 1, name: "Colorado", type: "River" }]);

    expect(() => getLabelsData()).not.toThrow();
    expect(getLabelsData().find(label => label.type === "river")).toBeUndefined();
  });
});
