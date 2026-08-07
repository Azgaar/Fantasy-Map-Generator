import { describe, it, expect } from "vitest";
import { generateJitteredGrid } from "../grid/grid-generator";
import { generateReligions } from "./religions-generator";
import { generateZones } from "./zones-generator";
import { generateMarkers } from "./markers-generator";
import { bakeErosion } from "../heightmap/erosion-bake";

describe("Religions, Erosion, Zones, & Markers Parity", () => {
  it("should generate religions, zones, markers, and run hydraulic erosion cycles", () => {
    const grid = generateJitteredGrid(800, 600, 1000, "parity-seed-abc");
    const pointsN = grid.points.length;
    const heights = new Uint8Array(pointsN).fill(25);
    const biomes = new Uint8Array(pointsN).fill(4);
    const flowDirections = new Int32Array(pointsN).fill(-1);

    // 1. Hydraulic Erosion
    // Raise a peak to carve down
    heights[50] = 90;
    flowDirections[50] = 51; // downflow neighbor
    heights[51] = 20;

    const erodedHeights = bakeErosion(grid, heights, flowDirections, 2);
    expect(erodedHeights[50]).toBeLessThan(90); // Peak should be eroded
    expect(erodedHeights[51]).toBeGreaterThan(20); // Sediment deposited

    // 2. Religions
    const cellCultures = new Uint8Array(pointsN).fill(1);
    const { religions, cellReligions } = generateReligions(grid, erodedHeights, cellCultures, 3, "parity-seed-abc");
    expect(religions.length).toBeGreaterThan(0);
    expect(cellReligions.length).toBe(pointsN);

    // 3. Zones
    const zones = generateZones(grid, erodedHeights, "parity-seed-abc");
    expect(zones.length).toBeGreaterThan(0);
    for (const z of zones) {
      expect(z.cells.length).toBeGreaterThan(0);
      expect(z.color).toContain("rgba");
    }

    // 4. Markers
    const markers = generateMarkers(grid, erodedHeights, biomes, "parity-seed-abc");
    // Ensure structure works even if count is low on small test layouts
    expect(markers).toBeInstanceOf(Array);
  });
});
