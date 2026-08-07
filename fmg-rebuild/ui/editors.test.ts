import { describe, it, expect } from "vitest";
import { generateJitteredGrid } from "../simulation/grid/grid-generator";
import { generateBurgs } from "../simulation/civilization/burg-generator";
import { generateCultures } from "../simulation/civilization/culture-generator";
import { generateStates } from "../simulation/civilization/state-generator";
import { store } from "../state/store";

describe("State Store & Editor Operations", () => {
  it("should successfully apply state store changes and trigger reactions", () => {
    const grid = generateJitteredGrid(800, 600, 1000, "editors-test-seed");
    const heights = new Uint8Array(grid.points.length).fill(25);
    const biomes = new Uint8Array(grid.points.length).fill(4);
    const { cultures, cellCultures } = generateCultures(grid, heights, biomes, 2, "test");
    const burgs = generateBurgs(grid, heights, biomes, new Uint16Array(grid.points.length), new Float32Array(grid.points.length), 4);
    const { states, cellStates } = generateStates(grid, heights, cellCultures, burgs, 2);

    store.updateState({
      grid,
      heights,
      burgs,
      states
    });

    const activeState = store.getState() as any;
    expect(activeState.burgs.length).toBe(burgs.length);

    // Mock editing a burg name
    const burgToEdit = activeState.burgs[0];
    burgToEdit.name = "Constantinople";
    burgToEdit.population = 99999;

    const updatedBurgs = activeState.burgs.map((b: any) => b.id === burgToEdit.id ? { ...burgToEdit } : b);
    store.updateState({ burgs: updatedBurgs });

    const nextState = store.getState() as any;
    expect(nextState.burgs[0].name).toBe("Constantinople");
    expect(nextState.burgs[0].population).toBe(99999);
  });
});
