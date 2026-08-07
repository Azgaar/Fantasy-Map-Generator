import { describe, it, expect } from "vitest";
import { generateJitteredGrid } from "../grid/grid-generator";
import { generateBurgs } from "./burg-generator";
import { generateCultures } from "./culture-generator";
import { generateStates } from "./state-generator";
import { generateProvinces } from "./province-generator";
import { generateMilitary } from "./military-generator";
import { serializeMapState, deserializeMapState } from "../../core/serialization";

describe("Provinces, Military, & Save/Load Systems", () => {
  it("should generate provinces and armies, and support JSON save/load serialization", () => {
    const grid = generateJitteredGrid(800, 600, 1000, "final-test-seed");
    const pointsN = grid.points.length;
    const heights = new Uint8Array(pointsN).fill(25);
    const biomes = new Uint8Array(pointsN).fill(4);
    const rivers = new Uint16Array(pointsN);
    const flux = new Float32Array(pointsN);

    // 1. Spawning civilization components
    const { cultures, cellCultures } = generateCultures(grid, heights, biomes, 4, "final-test-seed");
    const burgs = generateBurgs(grid, heights, biomes, rivers, flux, 8);
    const { states, cellStates } = generateStates(grid, heights, cellCultures, burgs, 3);
    
    // 2. Spawn Provinces
    const { provinces, cellProvinces } = generateProvinces(grid, heights, cellStates, burgs, states);
    expect(provinces.length).toBeGreaterThan(0);
    expect(cellProvinces.length).toBe(pointsN);

    // 3. Spawn Armies
    const military = generateMilitary(grid, heights, cellStates, states, burgs);
    expect(military.length).toBeGreaterThan(0);
    
    // Armies should be positioned on valid land cell indices
    for (const unit of military) {
      expect(unit.cell).toBeLessThan(pointsN);
      expect(unit.cell).toBeGreaterThanOrEqual(0);
      expect(unit.size).toBeGreaterThan(0);
    }

    // 4. Save/Load JSON Serialization Checks
    const mockState = {
      seed: "final-test-seed",
      width: 800,
      height: 600,
      grid,
      heights,
      temp: new Float32Array(pointsN).fill(15),
      prec: new Uint8Array(pointsN).fill(25),
      flowDirections: new Int32Array(pointsN).fill(-1),
      flux,
      rivers,
      biomes,
      cellCultures,
      cellStates,
      cellProvinces,
      cultures,
      burgs,
      states,
      provinces,
      routes: [],
      military
    };

    const serializedStr = serializeMapState(mockState);
    expect(serializedStr).toBeTypeOf("string");
    expect(serializedStr.length).toBeGreaterThan(100);

    const reloadedState = deserializeMapState(serializedStr);
    expect(reloadedState.seed).toBe("final-test-seed");
    expect(reloadedState.width).toBe(800);
    expect(reloadedState.height).toBe(600);
    expect(Array.from(reloadedState.heights)).toEqual(Array.from(heights));
    expect(reloadedState.burgs.length).toBe(burgs.length);
    expect(reloadedState.military.length).toBe(military.length);
  });
});
