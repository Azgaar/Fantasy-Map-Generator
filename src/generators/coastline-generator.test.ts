// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Coastline } from "./coastline-generator";
import type { Feature } from "./features";

const island = {
  i: 1,
  type: "island",
  vertices: [0, 1, 2, 3]
} as unknown as Feature;

/** The generator only needs a seed and the single write method it calls */
const stubOptions = () => {
  const stub: Record<string, unknown> = { seed: "1" };
  stub.set = (change: (o: unknown) => void) => change(stub);
  return stub as unknown as typeof globalThis.Options;
};

beforeEach(() => {
  localStorage.clear();
  globalThis.Options = stubOptions();
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
    expect(Options.coastline.maxDepth).toBe(2);

    Options.coastline = { ...Coastline.getDefaultSettings(), maxDepth: 5 };
    expect(Coastline.settings.maxDepth).toBe(5);
  });

  it("goes through Options.set, so the next session starts from the values the user picked", () => {
    const set = vi.fn((change: (o: unknown) => void) => change(globalThis.Options));
    globalThis.Options = { seed: "1", set } as unknown as typeof globalThis.Options;

    Coastline.update({ baseAmplitude: 3, enabled: false });
    expect(set).toHaveBeenCalled();
    expect(Options.coastline).toEqual({ ...Coastline.getDefaultSettings(), baseAmplitude: 3, enabled: false });
  });
});

describe("getFeaturePath", () => {
  it("reproduces the same coastline for the same seed and settings", () => {
    const path = Coastline.getFeaturePath(island);

    delete (Options as Partial<typeof Options>).coastline; // reload: settings are read from the map again
    expect(Coastline.getFeaturePath(island)).toBe(path);

    for (let i = 0; i < 100; i++) Math.random(); // an own rng per feature, unaffected by what was generated before
    expect(Coastline.getFeaturePath(island)).toBe(path);

    globalThis.Options.seed = "2";
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
