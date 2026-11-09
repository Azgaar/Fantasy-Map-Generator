import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Options } from "@/model/options/options-model";
import { Development } from "./development-generator";

// a chain of six land cells and a water cell at one point, so the noise is the same everywhere
function stubMap() {
  const n = 7;
  vi.stubGlobal("pack", {
    cells: {
      i: Array.from({ length: n }, (_, i) => i),
      c: Array.from({ length: n }, (_, i) => [i - 1, i + 1].filter(j => j >= 0 && j < n)),
      p: Array.from({ length: n }, () => [10, 10]),
      h: [30, 30, 30, 30, 30, 30, 10],
      culture: [1, 1, 1, 1, 1, 1, 0],
      biome: new Array(n).fill(0),
      r: new Array(n).fill(0),
      harbor: new Array(n).fill(0),
      burg: new Array(n).fill(0),
      pop: [1, 1, 1, 1, 1, 1, 0]
    },
    cultures: [
      { i: 0, name: "Wildlands", base: 1, type: "Generic" },
      { i: 1, name: "Shwazen", base: 0, type: "Generic", center: 0, development: 70 }
    ],
    biomes: [{ habitability: 50 }]
  });
}

beforeEach(() => {
  options = Options.getDefaultOptions();
  options.map.seed = "1";
});
afterEach(() => vi.unstubAllGlobals());

it("treats a culture missing from a damaged file as Wildlands, not as no development", () => {
  stubMap();
  pack.cells.culture[0] = 9;
  Development.generate();
  expect(Array.from(pack.cells.development!).slice(0, 2).every(Boolean)).toBe(true);
});

it("leaves water undeveloped", () => {
  stubMap();
  Development.generate();
  expect(pack.cells.development![6]).toBe(0);
});

it("names the era a level falls in", () => {
  expect(Development.getEra(1)).toBe("Paleolithic");
  expect(Development.getEra(35)).toBe("Commercial Revolution");
  expect(Development.getEra(36)).toBe("Late Middle Ages");
  expect(Development.getEra(100)).toBe("Post-human");
});

it("names eras by the map's set", () => {
  options.map.eras[0].name = "Age of Ash";
  expect(Development.getEra(2)).toBe("Age of Ash");
  expect(Development.getDefaultEras()[0].name).toBe("Paleolithic");
});

it("sets painted land cells and leaves water undeveloped", () => {
  stubMap();
  Development.generate();
  Development.setCells(45, [2, 6]);
  expect(pack.cells.development![2]).toBe(45);
  expect(pack.cells.development![6]).toBe(0);
  expect(() => Development.setCells(101, [2])).toThrow();
});

it("averages development by the people of each state, townspeople included", () => {
  vi.stubGlobal("pack", {
    cells: {
      h: [30, 30, 30, 30, 10],
      pop: [1, 1, 0, 0, 0],
      burg: [0, 1, 0, 0, 0],
      development: Uint8Array.from([10, 40, 20, 30, 0])
    },
    burgs: [{ i: 0 }, { i: 1, population: 2 }]
  });
  options.map.units.population.urbanization.rate = 1;
  const averages = Development.getAverages([1, 1, 2, 2, 1]);
  expect(averages[1]).toBe((1 * 10 + 3 * 40) / 4); // the burg's 2 people live at 40
  expect(averages[2]).toBeUndefined(); // nobody lives there
  expect(averages[0]).toBeUndefined();
  pack.cells.development![1] = 0;
  expect(Development.getAverages([1, 1, 2, 2, 1])[1]).toBe(10); // painted to no development, its people are not counted
});

it("settles a burg founded later at the best level around, at least 5, and clears a cell it leaves", () => {
  stubMap();
  pack.cells.pop[3] = 0;
  Development.generate();
  pack.cells.development!.set([20, 20, 2, 0, 30, 2, 0]);
  Development.settle(3);
  expect(pack.cells.development![3]).toBe(30); // the best neighbor
  Development.settle(2);
  expect(pack.cells.development![2]).toBe(5); // a town is past the foragers
  Development.vacate(3);
  expect(pack.cells.development![3]).toBe(0); // nobody lives there
  Development.vacate(2);
  expect(pack.cells.development![2]).toBe(5); // its rural people stay
});

it("resettles land after the people moved: new land takes its neighbors' best, emptied land none, painted 0 stays", () => {
  stubMap();
  Development.generate();
  pack.cells.development!.set([20, 0, 30, 0, 25, 20, 0]);
  const wasPeopled = [true, true, true, false, true, true, false]; // cell 1 was painted to no development
  pack.cells.pop = Float32Array.from([1, 1, 0, 1, 1, 1, 0]);
  Development.resettle(wasPeopled);
  expect([...pack.cells.development!]).toEqual([20, 0, 0, 25, 25, 20, 0]);
});

it("gives a water cell the best development of its shore", () => {
  stubMap();
  Development.generate();
  pack.cells.development!.set([20, 20, 20, 20, 20, 35, 0]);
  expect(Development.ofCell(6)).toBe(35);
  expect(Development.ofCell(5)).toBe(35);
});

it("gives none to land nobody lives on, and generated burgs at least 5", () => {
  stubMap();
  pack.cultures[1].development = 1;
  pack.cells.pop[3] = 0;
  pack.cells.pop[5] = 0;
  pack.cells.burg[5] = 1;
  Development.generate();
  expect(pack.cells.development![3]).toBe(0);
  expect(pack.cells.development![4]).toBeGreaterThanOrEqual(1);
  expect(pack.cells.development![5]).toBeGreaterThanOrEqual(5);
});

it("paints peopled cells, burgs included, to the level given, 0 for none", () => {
  stubMap();
  pack.cells.burg[5] = 1;
  pack.cells.pop[3] = 0;
  Development.generate();
  Development.setCells(1, [3, 5]);
  expect(pack.cells.development![3]).toBe(0);
  expect(pack.cells.development![5]).toBe(1);
  Development.setCells(0, [5]);
  expect(pack.cells.development![5]).toBe(0); // no development
  expect(() => Development.setCells(-1, [5])).toThrow();
});

it("holds peoples back in harsh biomes", () => {
  stubMap();
  pack.biomes[0].development = 2; // as temperate deciduous forest
  Development.generate();
  const forest = pack.cells.development![0];
  stubMap();
  pack.biomes[0].development = -6; // as tundra
  Development.generate();
  expect(pack.cells.development![0]).toBe(forest - 8);
});
