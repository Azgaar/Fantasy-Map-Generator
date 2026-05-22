import { beforeEach, describe, expect, it } from "vitest";
import type { Burg } from "./burgs-generator";
import { type Market, MarketsModule } from "./markets-generator";

describe("MarketsModule", () => {
  describe("buy logic and budget constraints", () => {
    let marketsModule: MarketsModule;
    beforeEach(() => {
      marketsModule = new MarketsModule();
      globalThis.Markets = marketsModule;
      globalThis.graphWidth = 1000;
      globalThis.graphHeight = 800;
      globalThis.TIME = false;
      globalThis.rn = (v: number, _d?: number) => Math.round(v * 100) / 100;
      // Minimal valid Good
      globalThis.pack = {
        goods: [
          {
            i: 0,
            name: "Wheat",
            value: 10,
            tags: ["food"],
            unit: "unit",
            icon: "icon",
            color: "#fff",
            distribution: "1",
            recipes: [],
            demandCoverage: { food: 1 }
          }
        ],
        markets: [],
        burgs: [],
        deals: []
      } as any;
    });

    it("buy() should floor units, enforce min unit, and keep cost within budget", () => {
      const market1: Market = {
        i: 1,
        centerBurgId: 1,
        color: "#ff0000",
        goods: { 0: { stock: 100, price: 10 } }
      };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      marketsModule["marketById"] = [undefined, market1];
      globalThis.pack.markets = [market1];
      const burg: Burg = { i: 1, market: 1, treasury: 15 } as any;
      globalThis.pack.burgs = [{ i: 0 } as any, burg];
      const deal = marketsModule.buy({ burg, good: globalThis.pack.goods[0], units: 5, budget: 15 });
      expect(deal).not.toBeNull();
      expect(deal!.units).toBe(1.36);
      expect(deal!.price).toBe(11);
      expect(deal!.units * deal!.price).toBeLessThanOrEqual(15);
      expect(market1.goods[0].stock).toBeCloseTo(100 - 1.36, 2);
    });

    it("buy() should return null if units floor below 0.01 due to low budget", () => {
      const market1: Market = {
        i: 1,
        centerBurgId: 1,
        color: "#ff0000",
        goods: { 0: { stock: 100, price: 10 } }
      };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      marketsModule["marketById"] = [market1];
      globalThis.pack.markets = [market1];
      const burg: Burg = { i: 1, market: 1, treasury: 0.05 } as any;
      globalThis.pack.burgs = [{ i: 0 } as any, burg];
      const deal = marketsModule.buy({ burg, good: globalThis.pack.goods[0], units: 5, budget: 0.05 });
      expect(deal).toBeNull();
    });

    it("runGlobalTrade() should transfer excess stock to importers", () => {
      // Setup two markets, one with excess, one with none
      const market1: Market = {
        i: 1,
        centerBurgId: 1,
        color: "#ff0000",
        goods: { 0: { stock: 100, price: 5 } }
      };
      const market2: Market = {
        i: 2,
        centerBurgId: 2,
        color: "#00ff00",
        goods: { 0: { stock: 0, price: 20 } }
      };
      const burg1: Burg = { i: 1, x: 100, y: 100, population: 100, market: 1 } as any;
      const burg2: Burg = { i: 2, x: 200, y: 100, population: 100, market: 2 } as any;
      globalThis.pack.markets = [market1, market2];
      globalThis.pack.burgs = [{ i: 0 } as any, burg1, burg2];
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      marketsModule["marketById"] = [market1, market2];
      marketsModule.runGlobalTrade();
      // After trade, market2 should have gained stock
      expect(market2.goods[0].stock).toBeGreaterThan(0);
      expect(market1.goods[0].stock).toBeLessThan(100);
    });
  });
});
