import { describe, expect, test } from "vitest";
import { getSatelliteBiomeData } from "./draw-satellite-texture";

const setBiomeColors = (colors: string[]) => {
  globalThis.biomesData = {
    i: [],
    name: [],
    color: colors,
    biomesMatrix: [],
    habitability: [],
    iconsDensity: [],
    icons: [],
    cost: []
  };
};

describe("getSatelliteBiomeData", () => {
  test("returns the built-in satellite palette for standard biomes", () => {
    const biome = getSatelliteBiomeData(4, 1);

    expect(biome).toEqual({ color: [0.45, 0.59, 0.25], density: 0.45 });
  });

  test("uses the custom biome color and the area's fallback density", () => {
    setBiomeColors(["#466eab", "#fbe79f", "#b5b887", "#d2d082", "#c8d68f", "", "", "", "", "", "", "", "", "#123456"]);

    const biome = getSatelliteBiomeData(13, 4);

    expect(biome).toEqual({ color: [18 / 255, 52 / 255, 86 / 255], density: 0.45 });
  });

  test("falls back to the area's built-in biome data if custom color cannot be parsed", () => {
    setBiomeColors([
      "#466eab",
      "#fbe79f",
      "#b5b887",
      "#d2d082",
      "#c8d68f",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "not-a-color"
    ]);

    const biome = getSatelliteBiomeData(13, 4);

    expect(biome).toEqual({ color: [0.45, 0.59, 0.25], density: 0.45 });
  });
});
