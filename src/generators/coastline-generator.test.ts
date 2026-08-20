// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { Coastline } from "./coastline-generator";
import type { Feature } from "./features";

const island = {
  i: 1,
  type: "island",
  vertices: [0, 1, 2, 3]
} as unknown as Feature;

beforeEach(() => {
  localStorage.clear();
  globalThis.options = {} as typeof globalThis.options;
  globalThis.seed = "1";
  globalThis.graphWidth = 100;
  globalThis.graphHeight = 100;
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
  it("defaults on a map saved before the settings existed", () => {
    expect(Coastline.settings).toEqual(Coastline.getDefaultSettings());
  });

  it("keeps them in options, so they are saved and restored with the map", () => {
    Coastline.update({ maxDepth: 2 });
    expect(options.coastline.maxDepth).toBe(2);

    options.coastline = { ...Coastline.getDefaultSettings(), maxDepth: 5 };
    expect(Coastline.settings.maxDepth).toBe(5);
  });

  it("reuses the last values the user picked on the next map", () => {
    Coastline.update({ baseAmplitude: 3, enabled: false });

    globalThis.options = {} as typeof globalThis.options; // new map
    expect(Coastline.settings).toEqual({ ...Coastline.getDefaultSettings(), baseAmplitude: 3, enabled: false });
  });

  it("fills in the keys stored data misses and survives corrupted data", () => {
    localStorage.setItem("coastline-settings", JSON.stringify({ minEdge: 4 }));
    expect(Coastline.settings).toEqual({ ...Coastline.getDefaultSettings(), minEdge: 4 });

    globalThis.options = {} as typeof globalThis.options;
    localStorage.setItem("coastline-settings", "{not json");
    expect(Coastline.settings).toEqual(Coastline.getDefaultSettings());
  });
});

describe("getFeaturePath", () => {
  it("reproduces the same coastline for the same seed and settings", () => {
    const path = Coastline.getFeaturePath(island);

    delete (options as Partial<typeof options>).coastline; // reload: settings are read from the map again
    expect(Coastline.getFeaturePath(island)).toBe(path);

    for (let i = 0; i < 100; i++) Math.random(); // an own rng per feature, unaffected by what was generated before
    expect(Coastline.getFeaturePath(island)).toBe(path);

    globalThis.seed = "2";
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
