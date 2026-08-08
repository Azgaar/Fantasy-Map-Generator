import { describe, it, expect } from "vitest";
import { generateJitteredGrid } from "../grid/grid-generator";
import { generateHydrology } from "./hydrology-generator";

describe("Hydrology Generator", () => {
  it("should generate flow directions, flux, and distance field", () => {
    const grid = generateJitteredGrid(800, 600, 1000, "hydrology-test-seed");
    const pointsN = grid.points.length;
    const heights = new Uint8Array(pointsN).fill(10); // flat low ocean/land boundary

    // Set a central mountain
    for (let i = 0; i < pointsN; i++) {
      const [x, y] = grid.points[i];
      const dist = Math.sqrt(Math.pow(x - 400, 2) + Math.pow(y - 300, 2));
      heights[i] = Math.max(10, Math.round(90 - dist / 5)); // central peak up to 90
    }

    const precipitation = new Uint8Array(pointsN).fill(5); // base precipitation
    const result = generateHydrology(grid, heights, precipitation);

    expect(result.t.length).toBe(pointsN);
    expect(result.flowDirections.length).toBe(pointsN);
    expect(result.flux.length).toBe(pointsN);

    // Flow directions should generally point downhill (to cells with lower height)
    let downhillFlowCount = 0;
    let totalFlowCount = 0;
    for (let i = 0; i < pointsN; i++) {
      const next = result.flowDirections[i];
      if (next !== -1) {
        totalFlowCount++;
        if (result.heights[next] <= result.heights[i]) {
          downhillFlowCount++;
        }
      }
    }
    // Most land flows should successfully lead downhill
    expect(downhillFlowCount).toBe(totalFlowCount);

    // There should be some rivers generated due to high flux accumulation
    const maxFlux = Math.max(...Array.from(result.flux));
    expect(maxFlux).toBeGreaterThan(5);

    const riverCount = result.rivers.reduce((sum, r) => sum + (r > 0 ? 1 : 0), 0);
    expect(riverCount).toBeGreaterThan(0);
  });
});
