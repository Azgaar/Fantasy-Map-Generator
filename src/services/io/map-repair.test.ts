// @vitest-environment jsdom
import { expect, it } from "vitest";
import "@/model/story/journeys/transports-generator";
import { MapRepair } from "./map-repair";

it("unassigns each invalid cell owner from its own array only", () => {
  globalThis.pack = {
    cells: {
      i: [0, 1, 2],
      state: [0, 1, 9],
      province: [0, 2, 0],
      culture: [0, 5, 1],
      religion: [0, 0, 7],
      burg: [0, 0, 0],
      r: [0, 3, 0],
      f: [1, 1, 1],
      routes: {}
    },
    vertices: { p: [] },
    features: [0, { i: 1 }],
    states: [{ i: 0 }, { i: 1 }],
    provinces: [0],
    cultures: [{ i: 0 }, { i: 1 }],
    religions: [{ i: 0 }],
    burgs: [{ i: 0 }],
    rivers: [],
    routes: [],
    markers: [],
    journeys: []
  } as unknown as typeof pack;

  const repairs = MapRepair.repair();

  const { state, province, culture, religion, r } = pack.cells;
  expect([state, province, culture, religion, r]).toEqual([
    [0, 1, 0],
    [0, 0, 0],
    [0, 0, 1],
    [0, 0, 0],
    [0, 0, 0]
  ]);
  expect(repairs).toHaveLength(5);
});
