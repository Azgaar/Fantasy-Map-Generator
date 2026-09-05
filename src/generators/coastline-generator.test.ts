// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { Coastline } from "./coastline-generator";
import type { Feature } from "./features";

const island = {
  i: 1,
  type: "island",
  vertices: [0, 1, 2, 3]
} as unknown as Feature;

/** The settings are facts of the map; a user edit also remembers them for the next one */
const stubFacts = () =>
  ({
    seed: "1",
    graph: { width: 100, height: 100 },
    coastline: Coastline.getDefaultSettings()
  }) as unknown as typeof globalThis.facts;

let remembered: [string, unknown][] = [];
const stubOptionsModel = () =>
  ({
    remember: (entry: string, value: unknown) => remembered.push([entry, value])
  }) as unknown as typeof globalThis.Options;

beforeEach(() => {
  localStorage.clear();
  remembered = [];
  globalThis.facts = stubFacts();
  globalThis.Options = stubOptionsModel();
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
  it("keeps them in facts, so they are saved and restored with the map", () => {
    Coastline.update({ maxDepth: 2 });
    expect(facts.coastline.maxDepth).toBe(2);

    facts.coastline = { ...Coastline.getDefaultSettings(), maxDepth: 5 };
    expect(Coastline.settings.maxDepth).toBe(5);
  });

  it("remembers a user edit, so the next map starts from the values they picked", () => {
    Coastline.update({ baseAmplitude: 3, enabled: false });

    const expected = { ...Coastline.getDefaultSettings(), baseAmplitude: 3, enabled: false };
    expect(facts.coastline).toEqual(expected);
    expect(remembered).toEqual([["coastline", expected]]);
  });
});

describe("getFeaturePath", () => {
  it("reproduces the same coastline for the same seed and settings", () => {
    const path = Coastline.getFeaturePath(island);

    facts.coastline = Coastline.getDefaultSettings(); // a reload: the settings come from the map again
    expect(Coastline.getFeaturePath(island)).toBe(path);

    for (let i = 0; i < 100; i++) Math.random(); // an own rng per feature, unaffected by what was generated before
    expect(Coastline.getFeaturePath(island)).toBe(path);

    facts.seed = "2";
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
