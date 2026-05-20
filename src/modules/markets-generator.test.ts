// Mock document and window on globalThis before importing modules
(globalThis as any).document = {
  getElementById: () => null
};
(globalThis as any).window = {
  document: (globalThis as any).document
};

import { beforeEach, describe, expect, it } from "vitest";
import type { Burg } from "./burgs-generator";
import { type Market, MarketsModule } from "./markets-generator";

describe("MarketsModule.redistributeAcrossMarkets", () => {
  let marketsModule: MarketsModule;

  beforeEach(() => {
    marketsModule = new MarketsModule();

    // Mock globals needed by the module
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
          demandCoverage: { food: 1 } // Use a valid category from DEMAND_PRIORITY
        }
      ] as any[],
      markets: [] as any[],
      burgs: [] as any[],
      deals: [] as any[]
    } as any;
  });

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

    console.log("Market 1 ending stock:", market1.goods[0].stock);
    console.log("Market 2 ending stock:", market2.goods[0].stock);

    // Verify exporter stock did not drop below its reserve
    expect(market1.goods[0].stock).toBeGreaterThan(0);
    expect(market1.goods[0].stock).toBeCloseTo(100 - market2.goods[0].stock, 1);
  });
});
