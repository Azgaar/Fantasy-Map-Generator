import { describe, expect, test } from "vitest";
import { getSatelliteBiomeData } from "./draw-satellite-texture";

describe("getSatelliteBiomeData", () => {
  test("returns the built-in satellite palette for standard biomes", () => {
    const biome = getSatelliteBiomeData(4, 1);

    expect(biome).toEqual({ color: [0.45, 0.59, 0.25], density: 0.45 });
  });

  test("uses the custom biome color and the area's fallback density", () => {
    globalThis.biomesData = {
      color: ["#466eab", "#fbe79f", "#b5b887", "#d2d082", "#c8d68f", "", "", "", "", "", "", "", "", "#123456"]
    } as any;

    const biome = getSatelliteBiomeData(13, 4);

    expect(biome).toEqual({ color: [18 / 255, 52 / 255, 86 / 255], density: 0.45 });
  });

  test("falls back to the area's built-in biome data if custom color cannot be parsed", () => {
    globalThis.biomesData = {
      color: ["#466eab", "#fbe79f", "#b5b887", "#d2d082", "#c8d68f", "", "", "", "", "", "", "", "", "not-a-color"]
    } as any;

    const biome = getSatelliteBiomeData(13, 4);

    expect(biome).toEqual({ color: [0.45, 0.59, 0.25], density: 0.45 });
  });
});
