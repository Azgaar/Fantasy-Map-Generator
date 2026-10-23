import { afterEach, expect, it, vi } from "vitest";
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
  expect(names.includes("Quenian")).toBe(true);
});

it("sets ancestry on highFantasy and darkFantasy cultures and allows setting ancestry", () => {
  options = Options.getDefaultOptions();
  const cells = { i: Array.from({ length: 500 }, (_, i) => i), s: Array(500).fill(1), h: [], t: [] };
  vi.stubGlobal("pack", {
    cells,
    cultures: [
      { i: 0, name: "Wildlands", code: "Wi" },
      { i: 1, name: "Quenian", ancestry: "Elfish", code: "Qu" }
    ]
  });
  vi.stubGlobal("grid", { cells: { temp: [] } });

  options.map.cultures.set = "highFantasy";
  const highFantasy = Cultures.getDefault();
  const quenian = highFantasy.find(c => c.name === "Quenian");
  expect(quenian?.ancestry).toBe("Elfish");

  options.map.cultures.set = "darkFantasy";
  const darkFantasy = Cultures.getDefault();
  const eldar = darkFantasy.find(c => c.name === "Eldar");
  expect(eldar?.ancestry).toBe("Elfish");

  Cultures.setAncestry(1, "High Elf");
  expect(pack.cultures[1].ancestry).toBe("High Elf");

  Cultures.setAncestry(1, "   ");
  expect(pack.cultures[1].ancestry).toBeUndefined();
});

it("recomputes a renamed culture's code without clashing with other cultures", () => {
  vi.stubGlobal("pack", {
    cultures: [
      { i: 0, name: "Wildlands", code: "Wi" },
      { i: 1, name: "Old", code: "Ol" },
      { i: 2, name: "Salt", code: "Sa" }
    ]
  });
  Cultures.rename(1, "Saltmere");
  expect(pack.cultures[1]).toMatchObject({ name: "Saltmere", code: "SA" });
  expect(() => Cultures.rename(5, "X")).toThrow("Culture 5 does not exist");
});
