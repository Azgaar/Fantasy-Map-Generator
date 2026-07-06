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
      globalThis.States = {
        getSalesTax: (burg: { state?: number }) => {
          const stateId = burg?.state || 0;
          if (!stateId) return 0;
          return globalThis.pack.states?.[stateId]?.salesTax ?? 0;
        }
      } as any;
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
      marketsModule["marketById"] = [market1, market1];
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

    it("runGlobalTrade() should add exporter sales tax to landed cost and record it on the deal", () => {
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
      const burg1: Burg = { i: 1, x: 100, y: 100, population: 100, market: 1, state: 1 } as any;
      const burg2: Burg = { i: 2, x: 200, y: 100, population: 100, market: 2, state: 2 } as any;
      globalThis.pack.markets = [market1, market2];
      globalThis.pack.burgs = [{ i: 0 } as any, burg1, burg2];
      globalThis.pack.states = [
        { i: 0, salesTax: 0 } as any,
        { i: 1, salesTax: 0.2 } as any,
        { i: 2, salesTax: 0.1 } as any
      ];
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      marketsModule["marketById"] = [market1, market2];
      marketsModule.runGlobalTrade();

      const tradeDeal = globalThis.pack.deals.find(
        (d: any) => d.sellerType === "market" && d.seller === 1 && d.buyerType === "market"
      );
      expect(tradeDeal).toBeDefined();
      expect(tradeDeal!.tax).toBeGreaterThan(0);
      // tax = exporterTaxRate * exporterPrice * units = 0.2 * 5 * units
      expect(tradeDeal!.tax).toBeCloseTo(0.2 * 5 * tradeDeal!.units, 1);
      // landed cost includes tax: price >= exporterPrice + tax/unit
      expect(tradeDeal!.price).toBeGreaterThan(5);
    });

    it("addMarket() should claim only the center burg's cell and preserve existing borders", () => {
      // Two cells already owned by market 1, plus a manual edit to be preserved.
      const market1: Market = { i: 1, centerBurgId: 1, color: "#ff0000", goods: {} };
      globalThis.pack.markets = [market1];
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      marketsModule["marketById"] = [market1];

      const centerBurg: Burg = { i: 2, cell: 3 } as any;
      globalThis.pack.burgs = [{ i: 0 } as any, { i: 1, cell: 0 } as any, centerBurg];
      // cell 3 currently belongs to market 1; all four cells are owned by market 1.
      globalThis.pack.cells = { i: [0, 1, 2, 3], market: Uint16Array.from([1, 1, 1, 1]) } as any;

      const newMarket = marketsModule.addMarket(2);

      expect(newMarket).not.toBeNull();
      expect(newMarket!.i).toBe(2);
      // Only the center burg's own cell changed owner.
      expect(Array.from(globalThis.pack.cells.market)).toEqual([1, 1, 1, 2]);
      expect(centerBurg.market).toBe(2);
      expect(centerBurg.plaza).toBe(1);
      // The new market is reachable through the index used by buy/sell/overview.
      expect(marketsModule.get(2)).toBe(newMarket);
    });

    it("addMarket() should reject a burg that already centers a market", () => {
      const market1: Market = { i: 1, centerBurgId: 1, color: "#ff0000", goods: {} };
      globalThis.pack.markets = [market1];
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      marketsModule["marketById"] = [market1];
      globalThis.pack.burgs = [{ i: 0 } as any, { i: 1, cell: 0 } as any];
      globalThis.pack.cells = { i: [0], market: Uint16Array.from([1]) } as any;
      globalThis.tip = () => {};

      expect(marketsModule.addMarket(1)).toBeNull();
      expect(globalThis.pack.markets).toHaveLength(1);
    });

    it("removeMarket() should drop only the removed market's deals, cells and burg link", () => {
      const market1: Market = { i: 1, centerBurgId: 1, color: "#ff0000", goods: {} };
      const market2: Market = { i: 2, centerBurgId: 2, color: "#00ff00", goods: {} };
      globalThis.pack.markets = [market1, market2];
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      marketsModule["marketById"] = [undefined as any, market1, market2];

      const burg1: Burg = { i: 1, cell: 0, market: 1, plaza: 1 } as any;
      const burg2: Burg = { i: 2, cell: 1, market: 2, plaza: 1 } as any;
      globalThis.pack.burgs = [{ i: 0 } as any, burg1, burg2];
      globalThis.pack.cells = { i: [0, 1], market: Uint16Array.from([1, 2]) } as any;
      globalThis.pack.deals = [
        { i: 1, seller: 1, sellerType: "market", buyer: 0, buyerType: "burg", good: 0, units: 1, price: 1, tax: 0 },
        { i: 2, seller: 2, sellerType: "market", buyer: 0, buyerType: "burg", good: 0, units: 1, price: 1, tax: 0 }
      ] as any;

      marketsModule.removeMarket(1);

      expect(globalThis.pack.markets).toEqual([market2]);
      // Only market 1's deal is dropped; market 2's deal survives.
      expect(globalThis.pack.deals).toHaveLength(1);
      expect(globalThis.pack.deals[0].seller).toBe(2);
      // Only market 1's cell and burg link are unassigned.
      expect(Array.from(globalThis.pack.cells.market)).toEqual([0, 2]);
      expect(burg1.market).toBe(0);
      expect(burg1.plaza).toBe(0);
      expect(burg2.market).toBe(2);
    });

    it("collectRuralProduction() should ignore cells with no market (market 0)", () => {
      const market1: Market = { i: 1, centerBurgId: 1, color: "#ff0000", goods: {} };
      globalThis.pack.markets = [market1];
      // Index by id: slot 0 (no market) stays empty so market-0 cells resolve to undefined.
      const index: Market[] = [];
      index[market1.i] = market1;
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      marketsModule["marketById"] = index;

      // Three land cells: cells 0 and 2 belong to market 1, cell 1 has no market.
      globalThis.pack.cells = { i: [0, 1, 2], market: Uint16Array.from([1, 0, 1]) } as any;

      const good = globalThis.pack.goods[0];
      globalThis.Goods = {
        getBiomesProduction: () => ({}),
        get: (id: number) => (id === good.i ? good : undefined)
      } as any;
      // Each cell would yield 5 units if collected.
      globalThis.Production = { getCellProduction: () => ({ [good.i]: 5 }) } as any;

      marketsModule.collectRuralProduction();

      // Only the two market-1 cells contribute; the no-market cell is skipped.
      expect(market1.goods[good.i].stock).toBe(10);
    });

    it("getName() should prefer a custom name, fall back to the center burg, then to a generic label", () => {
      globalThis.pack.burgs = [{ i: 0 } as any, { i: 1, name: "Riverton" } as any];

      const named: Market = { i: 1, centerBurgId: 1, color: "#fff", goods: {}, name: "Grand Bazaar" };
      expect(marketsModule.getName(named)).toBe("Grand Bazaar");

      const derived: Market = { i: 1, centerBurgId: 1, color: "#fff", goods: {} };
      expect(marketsModule.getName(derived)).toBe("Riverton");

      const blank: Market = { i: 2, centerBurgId: 1, color: "#fff", goods: {}, name: "" };
      expect(marketsModule.getName(blank)).toBe("Riverton");

      const orphan: Market = { i: 7, centerBurgId: 99, color: "#fff", goods: {} };
      expect(marketsModule.getName(orphan)).toBe("Market 7");
    });

    it("sell() should record sales tax on burg deals when state has a sales tax", () => {
      const market1: Market = {
        i: 1,
        centerBurgId: 1,
        color: "#ff0000",
        goods: { 0: { stock: 0, price: 10 } }
      };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      marketsModule["marketById"] = [market1, market1];
      globalThis.pack.markets = [market1];
      const burg: Burg = { i: 1, market: 1, state: 1 } as any;
      globalThis.pack.burgs = [{ i: 0 } as any, burg];
      globalThis.pack.states = [{ i: 0, salesTax: 0 } as any, { i: 1, salesTax: 0.2 } as any];
      const taxRate = globalThis.States.getSalesTax(burg);
      const deal = marketsModule.sell({ burg, good: globalThis.pack.goods[0], units: 5, taxRate });
      expect(deal).not.toBeNull();
      expect(deal!.tax).toBeGreaterThan(0);
      expect(deal!.tax).toBeCloseTo(deal!.units * deal!.price * 0.2, 2);
    });

    it("sync() should rebuild the id index so get() resolves markets after a load", () => {
      // Simulate a freshly loaded map: pack.markets is populated but marketById was never built.
      const market3: Market = { i: 3, centerBurgId: 30, color: "#fff", goods: {} };
      const market7: Market = { i: 7, centerBurgId: 70, color: "#fff", goods: {} };
      globalThis.pack.markets = [market3, market7];
      expect(marketsModule.get(3)).toBeUndefined();

      marketsModule.sync();

      expect(marketsModule.get(3)).toBe(market3);
      expect(marketsModule.get(7)).toBe(market7);
      expect(marketsModule.get(99)).toBeUndefined();
    });

    it("sync() should tolerate holes in pack.markets", () => {
      const market2: Market = { i: 2, centerBurgId: 20, color: "#fff", goods: {} };
      globalThis.pack.markets = [null as any, market2];
      expect(() => marketsModule.sync()).not.toThrow();
      expect(marketsModule.get(2)).toBe(market2);
    });
  });
});
