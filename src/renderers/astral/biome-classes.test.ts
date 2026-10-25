import { describe, expect, it } from "vitest";
import { biomeClass, COMPOSITION_CLASSES } from "./biome-classes";

describe("biome classes", () => {
  it("leaves the void out and buckets every standard land biome into one of four classes", () => {
    const ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    expect(ids.map(biomeClass)).toEqual([0, 1, 1, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4]);
  });

  it("names the four classes in id order", () => {
    expect(COMPOSITION_CLASSES).toEqual(["irradiated", "arable", "biomass", "volatiles"]);
  });

  it("folds custom biomes beyond the standard twelve into the volatiles class", () => {
    expect(biomeClass(13)).toBe(4);
    expect(biomeClass(200)).toBe(4);
  });
});
