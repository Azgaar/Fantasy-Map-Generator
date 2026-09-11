import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLabelsData, getLabelsIndex } from "./label-data";

const fitStateLabel = vi.hoisted(() => vi.fn(() => ({ pathPoints: [[1, 1]], text: "West", fontSize: 100 })));
vi.mock("./fit-state-label", () => ({ fitStateLabel }));

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
    cells: { p: CELL_POINTS, burg: [] }
  } as any;
  options.map.labels.groups = [];
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

it("includes the first route, whose valid ID is zero", () => {
  stubPack([]);
  pack.routes = [
    {
      i: 0,
      name: "Old Road",
      points: [
        [10, 10, 1],
        [20, 20, 2]
      ]
    }
  ] as typeof pack.routes;
  const label = getLabelsData().find(label => label.type === "route");
  expect(label?.entityId).toBe(0);
  expect(label?.text).toBe("Old Road");
});

describe("labels index", () => {
  beforeEach(() => {
    stubPack([{ i: 1, name: "Kobat", type: "River", cells: [0, 1, 2], points: [] }]);
    pack.states = [
      { i: 0 },
      { i: 1, name: "West", fullName: "Kingdom of West", cells: 5, center: 1 }
    ] as typeof pack.states;
    globalThis.Rivers = { addMeandering: vi.fn(() => []) } as any;
    fitStateLabel.mockClear();
  });

  it("names and anchors every label without fitting state paths or meandering rivers", () => {
    const index = getLabelsIndex();
    expect(index.map(label => [label.id, label.text])).toEqual([
      ["stateLabel1", "Kingdom of West"],
      ["riverLabel1", "Kobat River"]
    ]);
    expect(index.find(label => label.type === "river")?.anchor).toEqual([10, 10]);
    expect(fitStateLabel).not.toHaveBeenCalled();
    expect(Rivers.addMeandering).not.toHaveBeenCalled();
  });

  it("skips a state with no cells, as the full build does", () => {
    pack.states[1].cells = 0;
    expect(getLabelsIndex().find(label => label.type === "state")).toBeUndefined();
    expect(getLabelsData().find(label => label.type === "state")).toBeUndefined();
    expect(fitStateLabel).not.toHaveBeenCalled();
  });

  it("lists exactly the labels the full build renders", () => {
    pack.states.push(
      ...([
        { i: 2, name: "Void", cells: 0, center: 1 },
        { i: 3, name: "Plain", cells: 0, center: 1, label: { text: "Plain", pathPoints: [] } }
      ] as typeof pack.states)
    );
    const ids = (labels: { id: string }[]) => labels.map(label => label.id);
    expect(ids(getLabelsIndex())).toEqual(ids(getLabelsData()));
    expect(ids(getLabelsIndex()).includes("stateLabel3")).toBe(true); // plain text needs no cells to fit into
    expect(ids(getLabelsIndex()).includes("stateLabel2")).toBe(false);
  });

  it("still fits state labels for the full build", () => {
    expect(getLabelsData().find(label => label.type === "state")?.text).toBe("West");
    expect(fitStateLabel).toHaveBeenCalledTimes(1);
  });
});
