// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { Options } from "@/components/options-model";
import { Coastline } from "./coastline-generator";
import type { Feature } from "./features";

const island = {
  i: 1,
  type: "island",
  vertices: [0, 1, 2, 3]
} as unknown as Feature;

beforeEach(() => {
  localStorage.clear();
  globalThis.options = Options.getDefaultOptions();
  globalThis.options.map.seed = "1";
  globalThis.options.map.graph = { width: 100, height: 100, points: 100 };
  globalThis.options.map.coastline = Coastline.getDefaultSettings();
  globalThis.Options = Options;
  globalThis.pack = {
    vertices: {
      p: [
        [10, 10],
        [90, 10],
        [90, 90],
        [10, 90]
      ]
    }
  } as unknown as typeof globalThis.pack;
  globalThis.simplify = points => points;
});

describe("settings", () => {
  it("keeps them in options.map, so they are saved and restored with the map", () => {
    Coastline.update({ maxDepth: 2 });
    expect(options.map.coastline.maxDepth).toBe(2);

    options.map.coastline = { ...Coastline.getDefaultSettings(), maxDepth: 5 };
    expect(Coastline.settings.maxDepth).toBe(5);
  });

  it("remembers a user edit, so the next map starts from the values they picked", () => {
    Coastline.update({ baseAmplitude: 3, enabled: false });

    const expected = { ...Coastline.getDefaultSettings(), baseAmplitude: 3, enabled: false };
    expect(options.map.coastline).toEqual(expected);
    expect(options.map.coastline).toEqual(expected);
  });
});

describe("getFeaturePath", () => {
  it("reproduces the same coastline for the same seed and settings", () => {
    const path = Coastline.getFeaturePath(island);

    options.map.coastline = Coastline.getDefaultSettings(); // a reload: the settings come from the map again
    expect(Coastline.getFeaturePath(island)).toBe(path);

    for (let i = 0; i < 100; i++) Math.random(); // an own rng per feature, unaffected by what was generated before
    expect(Coastline.getFeaturePath(island)).toBe(path);

    options.map.seed = "2";
    expect(Coastline.getFeaturePath(island)).not.toBe(path);
  });

  it("applies the settings of the loaded map", () => {
    const rough = Coastline.getFeaturePath(island).length;

    Coastline.update({ maxDepth: 1 });
    expect(Coastline.getFeaturePath(island).length).toBeLessThan(rough);

    Coastline.update({ enabled: false }); // plain arcs between the feature vertices
    expect(Coastline.getFeaturePath(island)).toBe("M10,50Q10,10 50,10Q90,10 90,50Q90,90 50,90Q10,90 10,50Z");
  });
});
