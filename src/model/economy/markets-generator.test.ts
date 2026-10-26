import { beforeEach, describe, expect, it } from "vitest";
import type { Burg } from "@/model/political/burgs-generator";
import { States } from "@/model/political/states-generator";
import { rn } from "@/utils/number-utils";
import { Goods } from "./goods-generator";
import { DEAL_KINDS, type Deal, type Market, Markets, MarketsModule } from "./markets-generator";
import { Production } from "./production-generator";

describe("MarketsModule", () => {
  describe("buy logic and budget constraints", () => {
    let marketsModule: MarketsModule;
    beforeEach(() => {
      marketsModule = new MarketsModule();
      Object.assign(Markets, marketsModule);
      options.map.graph = { width: 1000, height: 800, points: 10000, sampling: "square", jitter: 0.9 };
      Object.assign(States, {
        getSalesTax: (burg: { state?: number }) => {
          const stateId = burg?.state || 0;
          if (!stateId) return 0;
          return globalThis.pack.states?.[stateId]?.salesTax ?? 0;
        }
      });
      // Minimal valid Good
      globalThis.pack = {
        goods: [
          {
            i: 0,
            name: "Wheat",
            value: 10,
            carriage: 1,
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
      const deal = marketsModule.buy({
        burg,
        good: globalThis.pack.goods[0],
        units: 5,
        kind: DEAL_KINDS.demand,
        budget: 15
      });
      expect(deal).not.toBeNull();
      expect(deal!.units).toBe(1.42);
      expect(deal!.price).toBe(10.5);
      expect(deal!.units * deal!.price).toBeLessThanOrEqual(15);
      expect(market1.goods[0].stock).toBeCloseTo(100 - 1.42, 2);
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
      const deal = marketsModule.buy({
        burg,
        good: globalThis.pack.goods[0],
        units: 5,
        kind: DEAL_KINDS.demand,
        budget: 0.05
      });
      expect(deal).toBeNull();
    });

    it("buy() adds the market's state sales tax to the price and records it for that state", () => {
      const market: Market = { i: 1, centerBurgId: 1, color: "#f00", goods: { 0: { stock: 100, price: 10 } } };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      marketsModule["marketById"] = [market, market];
      globalThis.pack.markets = [market];
      const burg: Burg = { i: 1, market: 1, state: 1 } as any;
      globalThis.pack.burgs = [{ i: 0 } as any, burg];
      globalThis.pack.states = [{ i: 0 }, { i: 1, salesTax: 0.2 }] as any;

      const trade = marketsModule.buy({ burg, good: globalThis.pack.goods[0], units: 2, kind: DEAL_KINDS.demand })!;
      expect(trade.price).toBeCloseTo(10 * 1.05 + 0.2 * 10, 2);
      expect(trade.tax).toBeCloseTo(0.2 * 10 * 2, 2);
      expect(marketsModule.getTaxStates(globalThis.pack.deals[0]).taxState).toBe(1);
    });

    const setupImport = (states?: any[]) => {
      const exporter: Market = { i: 1, centerBurgId: 1, color: "#f00", goods: { 0: { stock: 100, price: 5 } } };
      const importer: Market = { i: 2, centerBurgId: 2, color: "#0f0", goods: { 0: { stock: 0, price: 20 } } };
      const burg: Burg = { i: 2, x: 200, y: 100, population: 100, market: 2, state: 2, treasury: 1000 } as any;
      globalThis.pack.markets = [exporter, importer];
      globalThis.pack.burgs = [{ i: 0 } as any, { i: 1, x: 100, y: 100, market: 1, state: 1 } as any, burg];
      globalThis.pack.states = states ?? [{ i: 0 }, { i: 1 }, { i: 2 }];
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      marketsModule["marketById"] = [exporter, exporter, importer];
      setRoutes({ 1: 100 });
      const good = globalThis.pack.goods[0];
      const terms = marketsModule.getTradeTerms();
      const importGood = (units = 10, budget?: number) =>
        marketsModule.buyFromSource({ burg, source: exporter, good, units, kind: DEAL_KINDS.input, terms, budget });
      return { exporter, importer, burg, good, terms, importGood };
    };
    // route cost from each market's center to burg 2
    const setRoutes = (costs: Record<number, number>) => {
      const rows: Float32Array[] = [];
      for (const [marketId, cost] of Object.entries(costs)) rows[+marketId] = Float32Array.from([Infinity, 0, cost]);
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      marketsModule["routeCosts"] = rows;
    };
    const carriage = (cost: number) => cost / (Math.hypot(1000, 800) / 10); // one coin per unit and decima
    const transport = carriage(100);

    it("buyFromSource() records one deal of the burg with the source market at price plus margin and carriage", () => {
      const { exporter, importer, importGood } = setupImport();
      const trade = importGood();

      expect(trade?.units).toBe(10);
      expect(trade?.price).toBeCloseTo(5 * 1.05 + transport, 2);
      expect(globalThis.pack.deals).toEqual([[2, 1, 0, DEAL_KINDS.input, 10, trade!.price, 0, 0, trade!.carriage]]);
      expect([exporter.goods[0].stock, importer.goods[0].stock]).toEqual([90, 0]);
    });

    it("buyFromSource() caps units by the budget at the delivered buy price", () => {
      const { importGood } = setupImport();
      const trade = importGood(10, 13);
      expect(trade!.units * trade!.price).toBeLessThanOrEqual(13);
      expect(trade!.units).toBeCloseTo(13 / (5 * 1.05 + transport), 1);
    });

    it("quoteSource() picks the source that delivers to the burg cheapest", () => {
      const { burg, good, terms } = setupImport();
      const far: Market = { i: 3, centerBurgId: 3, color: "#00f", goods: { 0: { stock: 50, price: 4.5 } } };
      globalThis.pack.markets.push(far);
      globalThis.pack.burgs.push({ i: 3, x: 400, y: 100, market: 3 } as any);
      setRoutes({ 1: 100, 3: 300 });
      // the far market is cheaper but its carriage costs more than the price gap
      expect(marketsModule.quoteSource(burg, good, terms)?.source.i).toBe(1);
      far.goods[0].price = 3;
      expect(marketsModule.quoteSource(burg, good, terms)?.source.i).toBe(3);
    });

    it("quoteSource() skips a market with no route to the burg", () => {
      const { burg, good, terms, importGood } = setupImport();
      setRoutes({ 1: Infinity });
      expect(marketsModule.quoteSource(burg, good, terms)).toBeNull();
      expect(importGood()).toBeNull();
    });

    it("caps carriage at ten decimas, the most a burg with no route to its own market pays", () => {
      const { importer, burg, good } = setupImport();
      importer.centerBurgId = 1;
      setRoutes({ 2: 1e6 });
      expect(marketsModule.getTransport(importer, burg, good)).toBe(10 * good.carriage);
      setRoutes({ 2: Infinity });
      expect(marketsModule.getTransport(importer, burg, good)).toBe(10 * good.carriage);
    });

    it("buy() and sell() at the burg's own market pay the carriage from its center", () => {
      const { importer, burg, good } = setupImport();
      importer.goods[0] = { stock: 100, price: 20 };
      importer.centerBurgId = 1;
      setRoutes({ 2: 200 });
      const bought = marketsModule.buy({ burg, good, units: 1, kind: DEAL_KINDS.demand })!;
      expect(bought.price).toBeCloseTo(20 * 1.05 + carriage(200), 2);
      const midPrice = importer.goods[0].price; // raised by the purchase
      const sold = marketsModule.sell({ burg, good, units: 1, taxRate: 0 })!;
      expect(sold.price).toBeCloseTo(midPrice * 0.95 - carriage(200), 1);
    });

    it("buyFromSource() adds the exporter's sales tax after the margin and records it on the import", () => {
      const { importGood } = setupImport([{ i: 0 }, { i: 1, salesTax: 0.2 }, { i: 2, salesTax: 0.1 }]);
      const trade = importGood()!;
      expect(trade.tax).toBeCloseTo(0.2 * 5 * 10, 2);
      expect(trade.price).toBeCloseTo(5 * 1.05 + 0.2 * 5 + transport, 2);
      expect(marketsModule.getTaxStates(globalThis.pack.deals[0]).taxState).toBe(1);
    });

    it("buyFromSource() applies the importer's tariff and records deal.tariff", () => {
      const { importGood } = setupImport([
        { i: 0 },
        { i: 1, tariffs: [{ states: "all", goods: "all", rate: 0.1 }] },
        { i: 2, tariffs: [{ states: "all", goods: "all", rate: 0.2 }] }
      ]);
      importGood();
      const [deal] = globalThis.pack.deals;
      expect(deal[7]).toBeCloseTo(0.2 * 5 * 10, 2);
      expect(marketsModule.getTaxStates(deal).tariffState).toBe(2);
    });

    it("isImport() is a purchase from a market of another state", () => {
      const { burg } = setupImport();
      const remoteBuy: Deal = [2, 1, 0, DEAL_KINDS.input, 1, 1, 0, 0, 0];
      const localBuy: Deal = [2, 2, 0, DEAL_KINDS.demand, 1, 1, 0, 0, 0];
      const sale: Deal = [2, 2, 0, DEAL_KINDS.sale, 1, 1, 0, 0, 0];
      expect([remoteBuy, localBuy, sale].map(deal => marketsModule.isImport(deal))).toEqual([true, false, false]);

      globalThis.pack.burgs[1].state = burg.state; // the source market's center joins the burg's state
      expect(marketsModule.isImport(remoteBuy)).toBe(false);
    });

    it("buyFromSource() applies no tariff or embargo between markets of one state", () => {
      const { burg, importGood } = setupImport([
        { i: 0 },
        { i: 1, tariffs: [{ states: "all", goods: "all", rate: "embargo" }] }
      ]);
      burg.state = 1;
      globalThis.pack.burgs[2].state = 1;
      expect(importGood()).not.toBeNull();
      expect(globalThis.pack.deals[0][7]).toBe(0);
    });

    it("an embargo by either state blocks the import", () => {
      for (const states of [
        [{ i: 0 }, { i: 1, tariffs: [{ states: [2], goods: "all", rate: "embargo" }] }, { i: 2 }],
        [{ i: 0 }, { i: 1 }, { i: 2, tariffs: [{ states: [1], goods: "all", rate: "embargo" }] }]
      ]) {
        const { burg, good, terms, importGood } = setupImport(states);
        expect(marketsModule.quoteSource(burg, good, terms)).toBeNull();
        expect(importGood()).toBeNull();
      }
      expect(globalThis.pack.deals).toHaveLength(0);
    });

    it("tariffs take the most specific rule of the importer's state", () => {
      const { importGood } = setupImport([
        { i: 0 },
        { i: 1 },
        {
          i: 2,
          tariffs: [
            { states: "all", goods: "all", rate: 0.5 },
            { states: [1], goods: "all", rate: 0.3 },
            { states: [1], goods: [0], rate: 0.05 }
          ]
        }
      ]);
      importGood();
      expect(globalThis.pack.deals[0][7]).toBeCloseTo(0.05 * 5 * 10, 2);
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
        [1, 1, 0, DEAL_KINDS.demand, 1, 1, 0, 0, 0],
        [2, 2, 0, DEAL_KINDS.demand, 1, 1, 0, 0, 0]
      ];

      marketsModule.removeMarket(1);

      expect(globalThis.pack.markets).toEqual([market2]);
      // Only market 1's deal is dropped; market 2's deal survives.
      expect(globalThis.pack.deals).toEqual([[2, 2, 0, DEAL_KINDS.demand, 1, 1, 0, 0, 0]]);
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
      Object.assign(Goods, {
        getBiomesProduction: () => ({}),
        get: (id: number) => (id === good.i ? good : undefined)
      });
      // Each cell would yield 5 units if collected.
      Object.assign(Production, { getCellProduction: () => ({ [good.i]: 5 }) });

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
      const taxRate = States.getSalesTax(burg);
      const deal = marketsModule.sell({ burg, good: globalThis.pack.goods[0], units: 5, taxRate });
      expect(deal).not.toBeNull();
      expect(deal!.tax).toBeGreaterThan(0);
      expect(deal!.tax).toBeCloseTo(deal!.units * deal!.price * 0.2, 2);
      expect(marketsModule.getTaxStates(globalThis.pack.deals[0]).taxState).toBe(1);
    });

    it("sums a burg's trades with a market in one good and kind into one deal at the average price", () => {
      const market1: Market = { i: 1, centerBurgId: 1, color: "#ff0000", goods: { 0: { stock: 100, price: 10 } } };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      marketsModule["marketById"] = [market1, market1];
      globalThis.pack.markets = [market1];
      const burg: Burg = { i: 1, market: 1, treasury: 1000 } as any;
      globalThis.pack.burgs = [{ i: 0 } as any, burg];
      const good = globalThis.pack.goods[0];

      const first = marketsModule.buy({ burg, good, units: 2, kind: DEAL_KINDS.input })!;
      const second = marketsModule.buy({ burg, good, units: 4, kind: DEAL_KINDS.input })!;
      marketsModule.buy({ burg, good, units: 1, kind: DEAL_KINDS.demand });
      marketsModule.sell({ burg, good, units: 3, taxRate: 0 });

      const average = rn((2 * first.price + 4 * second.price) / 6, 2);
      expect(globalThis.pack.deals.map(([, , , kind, units]) => [kind, units])).toEqual([
        [DEAL_KINDS.input, 6],
        [DEAL_KINDS.demand, 1],
        [DEAL_KINDS.sale, 3]
      ]);
      expect(globalThis.pack.deals[0][5]).toBe(average);
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

describe("market placement", () => {
  it("gives a portless landmass a market and lets a market across the water stand closer", () => {
    options.map.graph = { width: 1000, height: 800, points: 10000, sampling: "square", jitter: 0.9 };
    const burg = (i: number, x: number, feature: number, population: number, port = 0) =>
      ({ i, x, y: 0, feature, population, port }) as Burg;
    // the spacing is about 1,230 here: one market on the mainland, half that across the water
    globalThis.pack = {
      burgs: [
        { i: 0 } as Burg,
        burg(1, 0, 1, 100, 9),
        burg(2, 100, 1, 50),
        burg(3, 300, 2, 1), // a portless island next to the mainland
        burg(4, 400, 3, 1, 9), // a port island within half the spacing
        burg(5, 1200, 4, 1, 9) // a port island beyond it
      ]
    } as typeof pack;

    // biome-ignore lint/complexity/useLiteralKeys: private test access
    const markets: Market[] = new MarketsModule()["createMarkets"]();
    const centers = markets.map(market => market.centerBurgId).sort();

    expect(centers).toEqual([1, 3, 5]);
  });
});
