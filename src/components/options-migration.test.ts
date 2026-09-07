// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";
import { Layers } from "@/components/layers";
import { Coordinates } from "@/generators/coordinates";
import { GenerationPipeline } from "@/generators/generation-pipeline";
import "@/generators/grid-generator";
import { migrateLegacySettings } from "@/services/io/auto-update";
import { safeParseJSON } from "@/utils/stringUtils";
import { Pins } from "./pins";

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  options = Options.getDefaultOptions();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

function legacyFile() {
  return readFileSync("tests/fixtures/1.143.1.map", "utf8").split("\r\n");
}

it("converts the pipe settings still written by master 1.151.2", () => {
  const data = legacyFile();
  migrateLegacySettings("1.151.2", data);
  expect(safeParseJSON(data[1])).toBeTruthy();
});

it("preserves the grid's legacy requested density", () => {
  const data = legacyFile();
  data[6] = JSON.stringify({ ...JSON.parse(data[6]), cellsDesired: 100000 });
  migrateLegacySettings("1.143.1", data);
  Options.applyLoaded(JSON.parse(data[1]));
  expect(options.map.graph.points).toBe(100000);
});

it("recovers density from spacing when older saves omitted cellsDesired", () => {
  const data = legacyFile();
  migrateLegacySettings("1.143.1", data);
  Options.applyLoaded(JSON.parse(data[1]));
  expect(options.map.graph.points).toBe(10000);
});

it("leaves current JSON settings intact on repeated migration", () => {
  const data = legacyFile();
  migrateLegacySettings("1.151.2", data);
  const migrated = data[1];
  migrateLegacySettings("1.151.2", data);
  expect(data[1]).toBe(migrated);
});

it("migrates definition sets before validating them", () => {
  expect(Layers.has("rivers")).toBe(true);
  const data = legacyFile();
  const parts = data[1].split("|");
  const legacy = JSON.parse(parts[19]);
  legacy.labels.groups.push({
    name: "My Rivers",
    type: "river",
    layerDependency: "toggleRivers",
    zoom: { min: 2, max: 30 }
  });
  legacy.military = [{ name: "Cavalry", rural: 0.1, urban: 0.2, crew: 3, type: "mounted", separate: 0 }];
  parts[19] = JSON.stringify(legacy);
  data[1] = parts.join("|");
  migrateLegacySettings("1.3.0", data);
  Options.applyLoaded(JSON.parse(data[1]));
  expect(options.map.labels.groups.find(group => group.name === "My Rivers")).toMatchObject({
    layerDependency: "rivers"
  });
  expect(options.map.military.units).toMatchObject([{ name: "Cavalry", icon: "🐴", power: 3 }]);
});

it("preserves legacy burg groups with comma-separated biome filters through a reload", () => {
  const data = readFileSync("tests/fixtures/1.139.4.map", "utf8").split("\r\n");
  migrateLegacySettings("1.139.4", data);
  Options.applyLoaded(JSON.parse(data[1]));
  const groups = structuredClone(options.map.burgs.groups);

  expect(groups).toHaveLength(9);
  expect(groups.find(group => group.name === "caravanserai")?.biomes).toEqual([1, 2, 3]);
  expect(groups.find(group => group.name === "trading_post")?.biomes).toEqual([5, 6, 7, 8, 9, 10, 11, 12]);
  Options.applyLoaded(JSON.parse(JSON.stringify(options.map)));
  expect(options.map.burgs.groups).toEqual(groups);
  expect(console.warn).not.toHaveBeenCalled();
});

it.each(["biomes", "states", "cultures", "religions"] as const)("normalizes legacy %s filters", key => {
  const data = legacyFile();
  const parts = data[1].split("|");
  const legacy = JSON.parse(parts[19]);
  legacy.burgs.groups = [
    { name: "custom", order: 0, isDefault: true, [key]: "1, 2,3" },
    { name: "empty", order: 1, [key]: "" },
    { name: "array", order: 2, [key]: [4, 5] }
  ];
  parts[19] = JSON.stringify(legacy);
  data[1] = parts.join("|");
  migrateLegacySettings("1.143.1", data);
  Options.applyLoaded(JSON.parse(data[1]));

  expect(options.map.burgs.groups.map(group => group[key])).toEqual([[1, 2, 3], [], [4, 5]]);
});

it("keeps the loaded extent through preparation for the next map", () => {
  const map = Options.getDefaultOptions().map;
  map.graph = { width: 1600, height: 900, points: 20000 };
  Options.applyLoaded(map);
  Options.setGraphSize();
  Options.randomize();
  expect(options.map.graph).toMatchObject({ width: 1600, height: 900 });
});

it("repairs negative label zoom bounds already saved by legacy migrations", () => {
  const data = legacyFile();
  const parts = data[1].split("|");
  const legacy = JSON.parse(parts[19]);
  legacy.labels.groups.push({ name: "forests", type: "added", zoom: { min: -0.3, max: -0.1 } });
  parts[19] = JSON.stringify(legacy);
  data[1] = parts.join("|");

  migrateLegacySettings("1.143.1", data);
  Options.applyLoaded(JSON.parse(data[1]));
  expect(options.map.labels.groups.find(group => group.name === "forests")?.zoom).toEqual({ min: 0, max: 0 });
  expect(console.warn).not.toHaveBeenCalledWith('Options.applyLoaded: invalid "labels" values replaced with defaults');
});

it("derives a missing coordinate cache from the loaded geography", () => {
  const map = JSON.parse(JSON.stringify(Options.getDefaultOptions().map));
  map.geography.mapSize = 20;
  delete map.geography.coordinates;
  Options.applyLoaded(map);
  expect(options.map.geography.coordinates.latT).toBe(36);
});

it("rejects invalid pin ranges without losing valid pins", () => {
  localStorage.setItem("fmg-locks", JSON.stringify({ prec: -100, points: 99, statesNumber: 8, imaginary: 3 }));
  Options.randomize();
  expect(options.map.climate.precipitation).toBeGreaterThanOrEqual(0);
  expect(options.generation.graph.density).toBe(4);
  expect(options.generation.states.limit).toBe(8);
  expect(Pins.has("imaginary")).toBe(false);
});

it.each([
  ["year", 1000.5],
  ["mapSize", 101],
  ["mapWidth", 0],
  ["distanceScale", -1],
  ["statesNumber", -1]
])("does not persist an invalid %s pin", (key, value) => {
  Pins.set(String(key), value);
  expect(Pins.has(String(key))).toBe(false);
});

it("resolves pins into requests before the geography generator runs", () => {
  globalThis.grid = { ...Grid.generate("geography", 1280, 800), features: [] };
  Pins.set("template", "britain");
  Pins.set("mapSize", 20);
  Pins.set("latitude", 0);
  Options.randomize();
  expect(options.generation.geography).toEqual({ mapSize: 20, latitude: 0, longitude: null });

  Pins.set("mapSize", 70); // a later pin cannot change the request already prepared for this generation
  Coordinates.generate();
  expect(options.map.geography).toMatchObject({ mapSize: 20, latitude: 0, longitude: 51.3 });
  expect(options.map.geography.coordinates).toMatchObject({ latT: 36, latN: 90 });

  window.history.replaceState({}, "", "?options=default");
  Options.randomize();
  expect(options.generation.geography).toEqual({ mapSize: null, latitude: null, longitude: null });
  options.generation.template = "britain";
  Coordinates.generate();
  expect(options.map.geography).toMatchObject({ mapSize: 7, latitude: 20, longitude: 51.3 });
});

it("generates a map name in randomize, including when pins are ignored", () => {
  Pins.set("mapName", "Pinned World");
  Options.randomize();
  expect(options.map.lore.name).toBe("Pinned World");
  window.history.replaceState({}, "", "?options=default");
  Options.randomize();
  expect(options.map.lore.name).not.toBe("");
  expect(options.map.lore.name).not.toBe("Pinned World");
  expect(Pins.has("mapName")).toBe(true);
});

it("adopts the user's legacy transport library", () => {
  const transports = [{ i: 99, name: "Sky whale", speed: 30, domain: "air", hoursPerDay: 12 }];
  localStorage.setItem("options-transports", JSON.stringify(transports));
  Options.restore();
  expect(options.map.transports).toEqual(transports);
  expect(localStorage.getItem("options-transports")).toBeNull();
});

it("replaces the previous grid when generation asks for a different seed", async () => {
  const { width, height } = options.map.graph;
  const previous = Grid.generate("old-seed", width, height);
  globalThis.grid = previous;
  options.map.seed = "new-seed";
  vi.stubGlobal("HeightmapGenerator", {
    generate: () => {
      throw new Error("stop after grid");
    }
  });
  try {
    await expect(GenerationPipeline.run({})).rejects.toThrow("stop after grid");
    expect(grid).not.toBe(previous);
    expect(grid.points).toEqual(Grid.generate("new-seed", width, height).points);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("uses an explicitly selected preview grid and clears its old heights", async () => {
  const preview = Grid.generate("preview", 1280, 800);
  preview.cells.h.fill(70);
  const createGrid = vi.spyOn(Grid, "generate");
  vi.stubGlobal("HeightmapGenerator", {
    generate: () => {
      throw new Error("stop after grid");
    }
  });
  try {
    await expect(GenerationPipeline.run({ graph: preview })).rejects.toThrow("stop after grid");
    expect(grid).toBe(preview);
    expect(createGrid).not.toHaveBeenCalled();
    expect(grid.cells.h.every(height => height === 0)).toBe(true);
  } finally {
    vi.unstubAllGlobals();
  }
});
