import { describe, it, expect } from "vitest";
import { getBiomeId, generateBiomes, BIOME_NAMES } from "./biomes-generator";
import { generateJitteredGrid } from "../grid/grid-generator";

describe("Biomes Generator", () => {
  it("should classify biomes based on Whittaker temperature and moisture rules", () => {
    // Water biomes
    expect(getBiomeId(0, 20, 18, false)).toBe(13); // Shallow Reef
    expect(getBiomeId(0, 15, 12, false)).toBe(14); // Kelp Forest
    expect(getBiomeId(0, 5, 4, false)).toBe(16); // Abyssal Plain

    // Land biomes
    expect(getBiomeId(2, 28, 25, false)).toBe(1); // Hot Desert (temp >= 25, dry, low moisture)
    expect(getBiomeId(3, -10, 30, false)).toBe(11); // Glacier (too cold: temp < -5)
    expect(getBiomeId(45, 10, 22, false)).toBe(12); // Wetland (moist, near coast)
  });

  it("should generate a complete biomes array matching the points grid", () => {
    const grid = generateJitteredGrid(800, 600, 1000, "biomes-test-seed");
    const pointsN = grid.points.length;
    const heights = new Uint8Array(pointsN).fill(25); // Land
    const temp = new Float32Array(pointsN).fill(20);
    const prec = new Uint8Array(pointsN).fill(10);
    const rivers = new Uint16Array(pointsN);

    const biomes = generateBiomes(grid, heights, temp, prec, rivers);
    expect(biomes.length).toBe(pointsN);
    for (const b of biomes) {
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(BIOME_NAMES.length);
    }
  });
});
