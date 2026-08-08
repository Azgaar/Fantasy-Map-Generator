import { describe, it, expect } from "vitest";
import { generateJitteredGrid } from "../grid/grid-generator";
import { generateCultures } from "./culture-generator";
import { generateBurgs } from "./burg-generator";
import { generateStates } from "./state-generator";
import { generateRoutes } from "./route-generator";

describe("Civilization & Routes Simulation", () => {
  it("should procedurally place cultures, burgs, states, and routes", () => {
    const grid = generateJitteredGrid(800, 600, 1000, "civ-test-seed");
    const pointsN = grid.points.length;
    const heights = new Uint8Array(pointsN).fill(25); // Land
    const biomes = new Uint8Array(pointsN).fill(4); // Grassland
    const rivers = new Uint16Array(pointsN);
    const flux = new Float32Array(pointsN);

    // 1. Generate Cultures
    const { cultures, cellCultures } = generateCultures(grid, heights, biomes, 4, "civ-test-seed");
    expect(cultures.length).toBe(4);
    expect(cellCultures.length).toBe(pointsN);

    // 2. Generate Burgs
    const burgs = generateBurgs(grid, heights, biomes, rivers, flux, 8);
    expect(burgs.length).toBeGreaterThan(0);
    expect(burgs.length).toBeLessThanOrEqual(8);

    // 3. Generate States
    const { states, cellStates } = generateStates(grid, heights, cellCultures, burgs, 3);
    expect(states.length).toBeGreaterThan(0);
    expect(cellStates.length).toBe(pointsN);

    // 4. Generate Routes
    const routes = generateRoutes(grid, heights, burgs);
    expect(routes.length).toBeGreaterThan(0);
    for (const r of routes) {
      expect(r.path.length).toBeGreaterThan(1);
    }
  });
});
