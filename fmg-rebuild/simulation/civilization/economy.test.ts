import { describe, it, expect } from "vitest";
import { generateJitteredGrid } from "../grid/grid-generator";
import { generateGoods } from "./goods-generator";
import { generateMarkets } from "./markets-generator";
import { runProductionCycles } from "./production-generator";
import { generateBurgs } from "./burg-generator";

describe("Economy: Goods, Markets, & Production", () => {
  it("should calculate cell resource outputs, build city markets with prices, and run recipes", () => {
    const grid = generateJitteredGrid(800, 600, 1000, "economy-seed");
    const pointsN = grid.points.length;
    const heights = new Uint8Array(pointsN).fill(25);
    const biomes = new Uint8Array(pointsN).fill(4); // Grassland -> Crops/Livestock

    // 1. Goods outputs
    const cellGoods = generateGoods(grid, heights, biomes);
    expect(cellGoods.length).toBe(pointsN);
    // Should produce a valid good index
    expect(cellGoods[100]).toBeGreaterThan(0);

    // 2. Burg Markets
    const burgs = generateBurgs(grid, heights, biomes, new Uint16Array(pointsN), new Float32Array(pointsN), 4);
    const markets = generateMarkets(grid, burgs, cellGoods);
    expect(markets.length).toBe(burgs.length);

    for (const m of markets) {
      expect(m.prices[1]).toBeGreaterThan(0); // Wood price
      expect(m.prices[3]).toBeGreaterThan(0); // Crop price
    }

    // 3. Recipe Production
    const production = runProductionCycles(markets);
    expect(production.length).toBe(burgs.length);
    for (const p of production) {
      expect(p.producedGoods.Furniture).toBeGreaterThanOrEqual(0);
      expect(p.producedGoods.Tools).toBeGreaterThanOrEqual(0);
    }
  });
});
