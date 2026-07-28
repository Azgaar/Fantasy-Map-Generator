import { describe, expect, test } from "vitest";
import type { Biome } from "@/generators/biomes-generator";
import { buildBiomePaths } from "./draw-biomes";

const biomes = [
  { i: 0, color: "#000000" },
  { i: 1, color: "#abcdef" },
  { i: 2, color: "url(#hatch1)" }
] as Biome[];

describe("buildBiomePaths", () => {
  test("renders biome fills and water gaps with the biome color", () => {
    const isolines: Parameters<typeof buildBiomePaths>[1] = {
      1: { fill: "M1,1Z", waterGap: "M1,2L3,4" },
      2: { fill: "M5,5Z" }
    };

    expect(buildBiomePaths(biomes, isolines)).toBe(
      '<path d="M1,1Z" fill="#abcdef" id="biome1" />' +
        '<path d="M1,2L3,4" fill="none" stroke="#abcdef" stroke-width="3" id="biome-gap1" />' +
        '<path d="M5,5Z" fill="url(#hatch1)" id="biome2" />'
    );
  });

  test("does not emit paths for an empty isoline", () => {
    expect(buildBiomePaths(biomes, { 1: {} })).toBe("");
  });
});
