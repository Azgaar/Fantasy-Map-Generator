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

it("removes rivers with less than 2 cells and frees their cells and lakes", () => {
  globalThis.pack = {
    cells: {
      i: [0, 1, 2],
      state: [0, 0, 0],
      province: [],
      culture: [],
      religion: [],
      burg: [],
      r: [1, 2, 2],
      f: [1, 1, 1],
      routes: {}
    },
    vertices: { p: [] },
    features: [0, { i: 1, type: "lake", height: 20, inlets: [1, 2] }],
    states: [{ i: 0 }],
    provinces: [0],
    cultures: [{ i: 0 }],
    religions: [{ i: 0 }],
    burgs: [{ i: 0 }],
    rivers: [
      { i: 1, cells: [0] },
      { i: 2, cells: [1, 2] }
    ],
    routes: [],
    markers: [],
    journeys: []
  } as unknown as typeof pack;

  const repairs = MapRepair.repair();

  expect(pack.rivers.map(river => river.i)).toEqual([2]);
  expect(pack.cells.r).toEqual([0, 2, 2]);
  expect(pack.features[1].inlets).toEqual([2]);
  expect(repairs).toHaveLength(2);
});
