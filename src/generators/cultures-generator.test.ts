import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Cultures } from "./cultures-generator";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("uses the requested culture set when regenerating an existing map", () => {
  options = Options.getDefaultOptions();
  options.map.cultures.set = "english";
  options.generation.cultures = { ...options.generation.cultures, set: "highFantasy", limit: 16 };
  const cells = { i: Array.from({ length: 500 }, (_, i) => i), s: Array(500).fill(1), h: [], t: [] };
  vi.stubGlobal("pack", { cells });
  vi.stubGlobal("grid", { cells: { temp: [] } });
  const getDefault = Cultures.getDefault.bind(Cultures);
  let names: string[] = [];
  vi.spyOn(Cultures, "getDefault").mockImplementation(count => {
    names = getDefault(count).map(culture => culture.name);
    throw new Error("stop before placement");
  });

  expect(() => Cultures.regenerate()).toThrow("stop before placement");
  expect(options.map.cultures.set).toBe("highFantasy");
  expect(Cultures.getDefault).toHaveBeenCalledWith(16);
  expect(names.includes("Quenian (Elfish)")).toBe(true);
});

describe("culture population breakdown", () => {
  beforeEach(() => {
    vi.stubGlobal("options", {
      map: { units: { population: { scale: 1000, urbanization: { rate: 2 } } } }
    });
    vi.stubGlobal("pack", {
      cells: {
        i: [0, 1, 2, 3, 4],
        h: [30, 30, 30, 30, 10],
        state: [1, 1, 2, 0, 1],
        province: [1, 1, 2, 0, 1],
        culture: [1, 2, 0, 2, 2],
        pop: [60, 50, 0, 100, 1000],
        burg: [1, 0, 0, 0, 0]
      },
      burgs: [{}, { population: 10, culture: 2 }],
      cultures: [{ name: "Wildlands" }, { name: "Trow" }, { name: "Elladan" }],
      states: [{ i: 0 }, { i: 1, culture: 2 }],
      provinces: [0, { i: 1, center: 0, culture: 2 }, { i: 2, center: 2 }]
    });
  });

  it.each(["state", "province"] as const)("weights rural and urban population under cell culture for a %s", entity => {
    const before = structuredClone(pack);
    expect(Cultures.getPopulationBreakdown(entity, 1)).toBe("Trow 61.5%, Elladan 38.5%");
    expect(pack).toEqual(before); // composition never changes the official culture or caches statistics
  });

  it("reflects population settings and map edits on the next request", () => {
    expect(Cultures.getPopulationBreakdown("province", 1)).toBe("Trow 61.5%, Elladan 38.5%");
    options.map.units.population.urbanization.rate = 0;
    pack.cells.pop[1] = 90;
    expect(Cultures.getPopulationBreakdown("province", 1)).toBe("Elladan 60%, Trow 40%");
  });

  it("uses culture id to order equal shares and includes culture zero", () => {
    pack.cells.culture[0] = 2;
    pack.cells.culture[1] = 0;
    pack.cells.pop[1] = 80;
    expect(Cultures.getPopulationBreakdown("state", 1)).toBe("Wildlands 50%, Elladan 50%");
  });

  it("handles unpopulated and absent regions", () => {
    expect(Cultures.getPopulationBreakdown("province", 2)).toBe("No population");
    expect(Cultures.getPopulationBreakdown("state", 99)).toBe("No population");
  });
});
