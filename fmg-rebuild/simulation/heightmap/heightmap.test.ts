import { describe, it, expect } from "vitest";
import { generateJitteredGrid } from "../grid/grid-generator";
import { HeightmapGenerator } from "./heightmap-generator";

describe("Heightmap Generator", () => {
  it("should generate a blank heightmap initially", () => {
    const grid = generateJitteredGrid(800, 600, 1000, "heightmap-seed");
    const hg = new HeightmapGenerator(grid, 800, 600, "heightmap-seed");
    expect(hg.heights.reduce((sum, h) => sum + h, 0)).toBe(0);
  });

  it("should correctly execute Hill operations and generate elevations", () => {
    const grid = generateJitteredGrid(800, 600, 1000, "heightmap-seed");
    const hg = new HeightmapGenerator(grid, 800, 600, "heightmap-seed");
    hg.executeTemplate("Hill 5 60-80 30-70 30-70\nSmooth 2");

    const totalElevation = hg.heights.reduce((sum, h) => sum + h, 0);
    expect(totalElevation).toBeGreaterThan(0);
    for (const h of hg.heights) {
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(100);
    }
  });

  it("should support masking elevations towards the center of the grid", () => {
    const grid = generateJitteredGrid(800, 600, 1000, "heightmap-seed");
    const hg1 = new HeightmapGenerator(grid, 800, 600, "heightmap-seed");
    const hg2 = new HeightmapGenerator(grid, 800, 600, "heightmap-seed");

    hg1.executeTemplate("Hill 5 80 50 50");
    hg2.executeTemplate("Hill 5 80 50 50\nMask 2");

    // Mask should reduce total elevation, especially towards the boundaries
    const totalElev1 = hg1.heights.reduce((sum, h) => sum + h, 0);
    const totalElev2 = hg2.heights.reduce((sum, h) => sum + h, 0);
    expect(totalElev2).toBeLessThan(totalElev1);
  });
});
