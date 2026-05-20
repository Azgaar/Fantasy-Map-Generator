// Mock document and window on globalThis before importing modules
(globalThis as any).document = {
  getElementById: () => null
};
(globalThis as any).window = {
  document: (globalThis as any).document
};

import { beforeEach, describe, expect, it } from "vitest";
import type { Burg } from "./burgs-generator";
import type { Good } from "./goods-generator";
import { type Market, MarketsModule } from "./markets-generator";
import { ProductionModule } from "./production-generator";

describe("MarketsModule", () => {
  let marketsModule: MarketsModule;

  beforeEach(() => {
    marketsModule = new MarketsModule();
    global.Markets = marketsModule;

    global.graphWidth = 1000;
    global.graphHeight = 800;
    global.TIME = false;
    global.rn = (v: number, _d?: number) => Math.round(v * 100) / 100;

    global.pack = {
      goods: [
        {
          i: 0,
          name: "Wheat",
          value: 10,
          distribution: 1,
          recipes: [],
          demandCoverage: { food: 1 }
        }
      ] as any[],
      markets: [] as any[],
      burgs: [] as any[],
      deals: [] as any[]
    } as any;
  });

  describe("redistributeAcrossMarkets", () => {
    it("should respect exporter reserve limit and only export excess stock", () => {
      const market1: Market = {
        i: 1,
        centerBurgId: 1,
        color: "#ff0000",
        goods: {
          0: { stock: 100, price: 5 }
        }
      };

      const market2: Market = {
        i: 2,
        centerBurgId: 2,
        color: "#00ff00",
        goods: {
          0: { stock: 0, price: 20 }
        }
      };

      const burg1: Burg = {
        i: 1,
        x: 100,
        y: 100,
        population: 100,
        market: 1,
        produced: {}
      } as any;

      const burg2: Burg = {
        i: 2,
        x: 200,
        y: 100,
        population: 100,
        market: 2,
        produced: {}
      } as any;

      global.pack.markets = [market1, market2];
      global.pack.burgs = [{ i: 0 } as any, burg1, burg2];

      marketsModule.runGlobalTrade();

      expect(market1.goods[0].stock).toBeGreaterThan(0);
      expect(market1.goods[0].stock).toBeCloseTo(100 - market2.goods[0].stock, 1);
    });
  });

  describe("buy logic and budget constraints", () => {
    it("should floor units, enforce 0.01 min unit deal limits, and keep cost within budget", () => {
      const market1: Market = {
        i: 1,
        centerBurgId: 1,
        color: "#ff0000",
        goods: {
          0: { stock: 100, price: 10 } // Buy price = 10 * 1.1 = 11
        }
      };
      marketsModule.generate = () => [market1];
      (marketsModule as any).marketById = [null, market1];

      const burg: Burg = {
        i: 1,
        market: 1,
        treasury: 15
      } as any;

      global.pack.markets = [market1];
      global.pack.burgs = [{ i: 0 } as any, burg];

      // Requesting 5 units with budget of 15 should cap units at 15 / 11 = 1.3636 -> floored to 1.36 units.
      const deal = marketsModule.buy({
        burg,
        good: global.pack.goods[0],
        units: 5,
        budget: 15
      });

      expect(deal).not.toBeNull();
      expect(deal!.units).toBe(1.36);
      expect(deal!.price).toBe(11);
      expect(deal!.units * deal!.price).toBeLessThanOrEqual(15);
      expect(market1.goods[0].stock).toBeCloseTo(100 - 1.36, 2);
    });

    it("should return null (not make a deal) if units would floor below 0.01 due to low budget", () => {
      const market1: Market = {
        i: 1,
        centerBurgId: 1,
        color: "#ff0000",
        goods: {
          0: { stock: 100, price: 10 } // Buy price = 11
        }
      };
      (marketsModule as any).marketById = [null, market1];

      const burg: Burg = {
        i: 1,
        market: 1,
        treasury: 0.05
      } as any;

      global.pack.markets = [market1];
      global.pack.burgs = [{ i: 0 } as any, burg];

      // Budget 0.05 / Buy Price 11 = 0.0045 units. Less than 0.01, should return null.
      const deal = marketsModule.buy({
        burg,
        good: global.pack.goods[0],
        units: 5,
        budget: 0.05
      });

      expect(deal).toBeNull();
    });
  });
});

describe("ProductionModule.fillDemandFromMarket cheapest sorting", () => {
  it("should buy the candidate good with the best cost-per-coverage first, even if its unit price is higher", () => {
    const marketsModule = new MarketsModule();
    global.Markets = marketsModule;

    const wheat: Good = {
      i: 0,
      name: "Wheat",
      value: 10,
      recipes: [],
      demandCoverage: { food: 0.5 }
    };
    const fish: Good = {
      i: 1,
      name: "Fish",
      value: 12,
      recipes: [],
      demandCoverage: { food: 1.0 }
    };

    global.pack = {
      goods: [wheat, fish],
      markets: [] as any[],
      burgs: [] as any[],
      deals: [] as any[]
    } as any;

    // Wheat price is 10, buy price = 11. Cost per coverage = 11 / 0.5 = 22.
    // Fish price is 12, buy price = 13.2. Cost per coverage = 13.2 / 1.0 = 13.2.
    // Fish has higher unit price (13.2 vs 11), but lower cost per coverage (13.2 vs 22).
    // The burg should purchase Fish first.

    const market1: Market = {
      i: 1,
      centerBurgId: 1,
      color: "#ff0000",
      goods: {
        0: { stock: 10, price: 10 },
        1: { stock: 10, price: 12 }
      }
    };
    (marketsModule as any).marketById = [null, market1];

    const burg: Burg = {
      i: 1,
      market: 1,
      treasury: 100,
      population: 100
    } as any;

    global.pack.markets = [market1];
    global.pack.burgs = [{ i: 0 } as any, burg];

    const prodModule = new ProductionModule();
    const index = (prodModule as any).buildProductionIndex(global.pack.goods);

    const demandInventory: number[] = [];
    const history: any[] = [];
    const demandTargets = [20, 0, 0, 0, 0]; // 20 units of food demand

    (prodModule as any).fillDemandFromMarket({
      burg,
      demandInventory,
      demandCoverageByGood: index.demandCoverageByGood,
      demandGoodsByCategory: index.demandGoodsByCategory,
      demandTargets,
      history
    });

    // Burg should buy fish (i=1) first.
    // fish covers 1.0, demand target is 20. Stock is 10.
    // So burg buys all 10 fish.
    // Fish covers 1.0, demand target is 20. Stock is 10.
    // Fish price is 13.2, so the burg with budget 100 can only afford 100 / 13.2 = 7.575... -> 7.58 units.
    // Wheat has worse cost-per-coverage, so Fish is prioritized.
    // The burg spends all its budget on Fish first.
    expect(demandInventory[1]).toBe(7.58); // Bought all the Fish it could afford (7.58 units)
    expect(demandInventory[0] || 0).toBe(0); // Wheat was not bought because budget was exhausted
  });
});
