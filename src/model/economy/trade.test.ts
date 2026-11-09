import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEAL_KINDS, Deals } from "@/model/economy/deals";
import { SAVINGS_RATE } from "@/model/economy/demand";
import { Taxes } from "@/model/economy/taxes";
import type { Burg } from "@/model/political/burgs-generator";
import { noFinance, States } from "@/model/political/states-generator";
import type { Deal, Market } from "@/types/economy";
import { rn } from "@/utils/number-utils";
import { Goods } from "./goods-generator";
import { MARKET_MARGIN, Markets, MarketsModule } from "./markets-generator";
import { IMPORT_CARRIAGE_FACTOR, PRICE_CURVE, Trade, TradeModule } from "./trade";
import { TradeRoutes } from "./trade-routes";

const MARGIN = Markets.getMarginRate(); // a market that paid no license fee

/** States as the model keeps them: each with its finances, zero but for the given ones */
const withFinance = (states: any[]) =>
  states.map(state => ({ ...state, economy: { ...noFinance(), ...state.economy } }));

describe("TradeModule", () => {
  describe("buy logic and budget constraints", () => {
    let tradeModule: TradeModule;
    // biome-ignore lint/complexity/useLiteralKeys: private access for testing
    const ruralDay = (marketId: number) => tradeModule["days"][marketId];
    beforeEach(() => {
      Object.assign(Markets, new MarketsModule());
      tradeModule = new TradeModule();
      Object.assign(Trade, tradeModule);
      options.map.graph = { width: 1000, height: 800, points: 10000, sampling: "square", jitter: 0.9 };
      Object.assign(States, {
        getSalesTax: (burg: { state?: number }) => {
          const stateId = burg?.state || 0;
          if (!stateId) return 0;
          return globalThis.pack.states?.[stateId]?.economy.salesTax ?? 0;
        }
      });
      // Minimal valid Good
      globalThis.pack = {
        cells: { market: [0, 1, 2, 3] }, // cell k lies in market k
        markets: [],
        burgs: [],
        deals: []
      } as any;
      options.map.goods = [
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
      ];
    });

    it("buy() should floor units, enforce min unit, and keep cost within budget", () => {
      const market1: Market = {
        i: 1,
        centerBurgId: 1,
        color: "#ff0000",
        goods: { 0: { stock: 100, price: 10 } }
      };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      Markets["marketById"] = [market1, market1];
      globalThis.pack.markets = [market1];
      const burg: Burg = { i: 1, cell: 1, treasury: 15 } as any;
      globalThis.pack.burgs = [{ i: 0 } as any, burg];
      const deal = tradeModule.buy({
        burg,
        good: globalThis.options.map.goods[0],
        units: 5,
        kind: DEAL_KINDS.demand,
        budget: 15
      });
      const price = rn(10 * (1 + MARGIN), 2);
      const units = Math.floor((15 / price) * 100) / 100; // floored to the hundredth: the cost stays within the budget
      expect(deal).not.toBeNull();
      expect(deal!.units).toBe(units);
      expect(deal!.price).toBe(price);
      expect(deal!.units * deal!.price).toBeLessThanOrEqual(15);
      expect(market1.goods[0].stock).toBeCloseTo(100 - units, 2);
    });

    it("buy() should return null if units floor below 0.01 due to low budget", () => {
      const market1: Market = {
        i: 1,
        centerBurgId: 1,
        color: "#ff0000",
        goods: { 0: { stock: 100, price: 10 } }
      };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      Markets["marketById"] = [market1];
      globalThis.pack.markets = [market1];
      const burg: Burg = { i: 1, cell: 1, treasury: 0.05 } as any;
      globalThis.pack.burgs = [{ i: 0 } as any, burg];
      const deal = tradeModule.buy({
        burg,
        good: globalThis.options.map.goods[0],
        units: 5,
        kind: DEAL_KINDS.demand,
        budget: 0.05
      });
      expect(deal).toBeNull();
    });

    it("pays the margin to the market's center burg as each trade happens, and takes it back on goods kept", () => {
      const market: Market = { i: 1, centerBurgId: 1, color: "#f00", goods: { 0: { stock: 100, price: 10 } } };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      Markets["marketById"] = [market, market];
      globalThis.pack.markets = [market];
      const center: Burg = { i: 1, cell: 1, treasury: 0 } as any;
      globalThis.pack.burgs = [{ i: 0 } as any, center];
      const good = globalThis.options.map.goods[0];

      tradeModule.buy({ burg: center, good, units: 2, kind: DEAL_KINDS.demand });
      expect(center.treasury).toBeCloseTo(2 * 10 * MARGIN, 5);

      tradeModule.sell({ burg: center, good, units: 4, taxRate: 0 });
      tradeModule.keep({ burg: center, good, units: 1 });
      const margins = globalThis.pack.deals.reduce((sum: number, deal: Deal) => sum + Deals.getMargin(deal), 0);
      expect(center.treasury).toBeCloseTo(margins, 1);
    });

    it("pays the license out of the margin as it comes in, and what the margin left unpaid at the day's end", () => {
      const market: Market = { i: 1, centerBurgId: 1, color: "#f00", goods: { 0: { stock: 100, price: 10 } } };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      Markets["marketById"] = [market, market];
      globalThis.pack.markets = [market];
      const center: Burg = { i: 1, cell: 1, treasury: 0 } as any;
      globalThis.pack.burgs = [{ i: 0 } as any, center];
      const good = globalThis.options.map.goods[0];
      const margin = (units: number) => units * 10 * Markets.getMarginRate(market);

      market.feePaid = 1;
      tradeModule.billLicenses();
      tradeModule.buy({ burg: center, good, units: 2, kind: DEAL_KINDS.demand });
      expect(center.treasury).toBe(0); // all of it went to the license
      tradeModule.buy({ burg: center, good, units: 2, kind: DEAL_KINDS.demand });
      expect(center.treasury).toBeCloseTo(margin(4) - 1, 5);
      tradeModule.settleLicenses();
      expect(center.treasury).toBeCloseTo(margin(4) - 1, 5); // paid off already

      market.feePaid = 5; // a quiet market
      center.treasury = 0;
      tradeModule.billLicenses();
      tradeModule.buy({ burg: center, good, units: 2, kind: DEAL_KINDS.demand });
      expect(center.treasury).toBe(0);
      tradeModule.settleLicenses();
      expect(center.treasury).toBeCloseTo(margin(2) - 5, 5);
    });

    it("buy() adds the market's state sales tax to the price and records it for that state", () => {
      const market: Market = { i: 1, centerBurgId: 1, color: "#f00", goods: { 0: { stock: 100, price: 10 } } };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      Markets["marketById"] = [market, market];
      globalThis.pack.markets = [market];
      const burg: Burg = { i: 1, cell: 1, state: 1 } as any;
      globalThis.pack.burgs = [{ i: 0 } as any, burg];
      globalThis.pack.states = withFinance([{ i: 0 }, { i: 1, economy: { salesTax: 0.2 } }]);

      const trade = tradeModule.buy({
        burg,
        good: globalThis.options.map.goods[0],
        units: 2,
        kind: DEAL_KINDS.demand
      })!;
      expect(trade.price).toBeCloseTo(10 * (1 + MARGIN) + 0.2 * 10, 2);
      expect(trade.tax).toBeCloseTo(0.2 * 10 * 2, 2);
      expect(Taxes.getTaxStates(globalThis.pack.deals[0]).taxState).toBe(1);
    });

    const setupImport = (states?: any[]) => {
      const exporter: Market = { i: 1, centerBurgId: 1, color: "#f00", goods: { 0: { stock: 100, price: 5 } } };
      const importer: Market = { i: 2, centerBurgId: 2, color: "#0f0", goods: { 0: { stock: 0, price: 20 } } };
      const burg: Burg = { i: 2, x: 200, y: 100, population: 100, cell: 2, state: 2, treasury: 1000 } as any;
      globalThis.pack.markets = [exporter, importer];
      globalThis.pack.burgs = [{ i: 0 } as any, { i: 1, x: 100, y: 100, cell: 1, state: 1 } as any, burg];
      globalThis.pack.states = withFinance(states ?? [{ i: 0 }, { i: 1 }, { i: 2 }]);
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      Markets["marketById"] = [exporter, exporter, importer];
      setRoutes({ 1: 100 });
      const good = globalThis.options.map.goods[0];
      const terms = tradeModule.getTradeTerms();
      const importGood = (units = 10, budget?: number) =>
        tradeModule.buy({ burg, source: exporter, good, units, kind: DEAL_KINDS.input, terms, budget });
      return { exporter, importer, burg, good, terms, importGood };
    };
    // route cost from each market's center to burg 2
    const setRoutes = (costs: Record<number, number>) => {
      const rows: Float32Array[] = [];
      for (const [marketId, cost] of Object.entries(costs)) rows[+marketId] = Float32Array.from([Infinity, 0, cost]);
      globalThis.pack.cells ??= { routes: {} } as any;
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["routeCosts"] = rows;
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["routeCostsSource"] = [pack.cells.routes, pack.markets, Markets.revision, pack.burgs.length];
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["decima"] = Math.hypot(1000, 800) / 10;
    };
    const carriage = (cost: number) => cost / (Math.hypot(1000, 800) / 10); // one coin per unit and decima
    const transport = carriage(100) * IMPORT_CARRIAGE_FACTOR; // the exporter is another state's market

    it("buy() from a source records one deal of the burg with the source market at price plus margin and carriage", () => {
      const { exporter, importer, importGood } = setupImport();
      const trade = importGood();

      expect(trade?.units).toBe(10);
      expect(trade?.price).toBeCloseTo(rn(5 * (1 + MARGIN), 2) + transport, 2);
      expect(globalThis.pack.deals).toEqual([[2, 1, 0, DEAL_KINDS.input, 10, trade!.price, 0, 0, trade!.carriage]]);
      expect([exporter.goods[0].stock, importer.goods[0].stock]).toEqual([90, 0]);
    });

    it("buy() from a source caps units by the budget at the delivered buy price", () => {
      const { importGood } = setupImport();
      const trade = importGood(10, 13);
      expect(trade!.units * trade!.price).toBeLessThanOrEqual(13);
      expect(trade!.units).toBeCloseTo(13 / (5 * (1 + MARGIN) + transport), 1);
    });

    it("quoteSource() picks the source that delivers to the burg cheapest", () => {
      const { burg, good, terms } = setupImport();
      const far: Market = { i: 3, centerBurgId: 3, color: "#00f", goods: { 0: { stock: 50, price: 4.5 } } };
      globalThis.pack.markets.push(far);
      globalThis.pack.burgs.push({ i: 3, x: 400, y: 100, cell: 3, state: 1 } as any);
      setRoutes({ 1: 100, 3: 300 });
      // the far market is cheaper but its carriage costs more than the price gap
      expect(tradeModule.quoteSource(burg, good, terms)?.source.i).toBe(1);
      far.goods[0].price = 0.1; // cheap enough to pay its carriage
      expect(tradeModule.quoteSource(burg, good, terms)?.source.i).toBe(3);
    });

    it("charges more carriage from another state's market", () => {
      const { exporter, importer, burg, good } = setupImport();
      globalThis.pack.burgs.push({ i: 3, state: 2 } as any);
      importer.centerBurgId = 3; // the burg's own market, centered in its state
      setRoutes({ 1: 100, 2: 100 });
      expect(tradeModule.getTransport(importer, burg, good)).toBeCloseTo(carriage(100), 5);
      expect(tradeModule.getTransport(exporter, burg, good)).toBeCloseTo(carriage(100) * IMPORT_CARRIAGE_FACTOR, 5);
      globalThis.pack.burgs[1].state = 2; // the same state: no longer an import
      expect(tradeModule.getTransport(exporter, burg, good)).toBeCloseTo(carriage(100), 5);
    });

    it("measures the routes again once a market moves to another center", () => {
      const { exporter, burg } = setupImport();
      globalThis.pack.burgs.push({ i: 3, x: 150, y: 100, cell: 3, state: 1 } as any);
      setRoutes({ 1: 100 });
      const decimas = tradeModule.getDecimas(exporter, burg);
      const measured: Float32Array[] = [];
      measured[exporter.i] = Float32Array.from([Infinity, 0, 50, 0]);
      const measure = vi.spyOn(TradeRoutes, "measure").mockReturnValue(measured);

      Markets.relocateMarket(exporter.i, 3);

      expect(tradeModule.getDecimas(exporter, burg)).toBeCloseTo(decimas / 2, 5);
      expect(measure).toHaveBeenCalledOnce();
      measure.mockRestore();
    });

    it("treats trade with the neutral lands as no import: no import carriage, tariff or embargo", () => {
      const embargoAll = { states: "all", goods: "all", rate: "embargo" };
      const { exporter, importer, burg, good, terms } = setupImport([
        { i: 0 },
        { i: 1 },
        { i: 2, economy: { tariffs: [embargoAll] } }
      ]);
      expect(terms(exporter, importer, good, 5)).toBeNull();
      globalThis.pack.burgs[1].state = 0; // the exporter's center in the neutral lands
      expect(tradeModule.getTransport(exporter, burg, good)).toBeCloseTo(carriage(100), 5);
      expect(tradeModule.getTradeTerms()(exporter, importer, good, 5)).toEqual({ taxPerUnit: 0, tariffPerUnit: 0 });
    });

    it("quoteSource() skips a market with no route to the burg", () => {
      const { burg, good, terms, importGood } = setupImport();
      setRoutes({ 1: Infinity });
      expect(tradeModule.quoteSource(burg, good, terms)).toBeNull();
      expect(importGood()).toBeNull();
    });

    it("caps carriage at ten decimas, the most a burg with no route to its own market pays", () => {
      const { importer, burg, good } = setupImport();
      importer.centerBurgId = 1;
      setRoutes({ 2: 1e6 });
      expect(tradeModule.getTransport(importer, burg, good)).toBe(10 * good.carriage);
      setRoutes({ 2: Infinity });
      expect(tradeModule.getTransport(importer, burg, good)).toBe(10 * good.carriage);
    });

    it("prices a good by the day's demand against its supply, expected sales counted in both, in any order of trades", () => {
      const { importer, burg, good } = setupImport();
      importer.centerBurgId = 1;
      setRoutes({ 2: 0 });
      importer.goods[0] = { stock: 0, price: 10 };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["days"] = [
        undefined,
        undefined,
        {
          depth: [20],
          listPrice: [10],
          demand: [],
          supply: [],
          rural: [],
          ruralPeople: 0,
          cash: 0,
          income: 0,
          spent: 0,
          margin: 0,
          covered: [],
          bought: [],
          pollTaxDue: []
        }
      ] as never;

      tradeModule.sell({ burg, good, units: 20, taxRate: 0 }); // a day's sales offered
      expect(importer.goods[0].price).toBeCloseTo(10 * (20 / 40) ** PRICE_CURVE); // a surplus: below the list price
      tradeModule.buy({ burg, good, units: 20, kind: DEAL_KINDS.demand }); // and all bought
      expect(importer.goods[0].price).toBeCloseTo(10); // balanced: the list price, wherever the trades left it
      tradeModule.signalShortage(importer, good, 20); // buyers turned away
      expect(importer.goods[0].price).toBeCloseTo(10 * (60 / 40) ** PRICE_CURVE); // a shortage: above it
      tradeModule.sell({ burg, good, units: 1000, taxRate: 0 }); // a glut: the floor, 2% of the value
      expect(importer.goods[0].price).toBe(0.2);
    });

    it("prices a lot at the market's average price over the move it makes, so a big lot pays its own impact", () => {
      const { importer, burg, good } = setupImport();
      importer.centerBurgId = 1;
      setRoutes({ 2: 0 });
      importer.goods[0] = { stock: 0, price: 10 };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["days"] = [
        undefined,
        undefined,
        {
          depth: [20],
          listPrice: [10],
          demand: [],
          supply: [],
          rural: [],
          ruralPeople: 0,
          cash: 0,
          income: 0,
          spent: 0,
          margin: 0,
          covered: [],
          bought: [],
          pollTaxDue: []
        }
      ] as never;

      const steps = Array.from({ length: 1000 }, (_, k) => (k + 0.5) / 1000); // the lot, unit by unit
      const mean = (price: (share: number) => number) => steps.reduce((sum, k) => sum + price(k), 0) / steps.length;
      const lot = (units: number) => mean(k => 10 * (20 / (20 - units * k)) ** PRICE_CURVE);
      const sale = tradeModule.sell({ burg, good, units: 20, taxRate: 0 })!;
      expect(sale.price).toBeCloseTo(rn(lot(-20) * (1 - MARGIN), 2), 2); // well below the opening 10
      expect(sale.price).toBeGreaterThan(rn(importer.goods[0].price * (1 - MARGIN), 2)); // but above where it left the price

      importer.goods[0].price = 10;
      const budget = 150;
      const purchase = tradeModule.buy({ burg, good, units: 20, kind: DEAL_KINDS.demand, budget })!;
      expect(purchase.units * purchase.price).toBeLessThanOrEqual(budget);
      expect(purchase.price).toBeGreaterThan(10 * (1 + MARGIN)); // dearer than the opening price
    });

    it("counts what the countryside brings as the day's first supply", () => {
      const { importer, good } = setupImport();
      globalThis.options.map.goods = [{ ...good, demandCoverage: { food: 1 } }];
      globalThis.pack.cells = { routes: {}, market: [], burg: [] } as never;
      const day = { depth: [], listPrice: [], demand: [], supply: [], rural: [], ruralPeople: 40, pollTaxDue: [] };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["days"] = [undefined, undefined, day] as never;
      globalThis.pack.markets = [importer];
      const open = (rural: number) => {
        day.rural = [rural] as never;
        tradeModule.initializeMarketPrices();
        return importer.goods[0].price;
      };
      const value = good.value;
      expect(open(0)).toBe(value); // no supply: its value
      const expected = day.depth[0] as number;
      expect(open(expected)).toBeCloseTo(value * 0.5 ** PRICE_CURVE); // a day's sales
      expect(open(expected * 3)).toBeCloseTo(value * 0.25 ** PRICE_CURVE); // three days'
      expect(open(expected * 1000)).toBeCloseTo(value * 0.02); // never below the floor
      expect(day.depth[0]).toBe(expected);
    });

    it("counts an import as demand once, shared by the markets nearer the buyer than its source, the nearest the most", () => {
      const { exporter, importer, burg, good } = setupImport();
      const near: Market = { i: 3, centerBurgId: 1, color: "#00f", goods: { 0: { stock: 0, price: 5 } } };
      const far: Market = { i: 4, centerBurgId: 1, color: "#ff0", goods: { 0: { stock: 0, price: 5 } } };
      globalThis.pack.markets = [exporter, importer, near, far];
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      Markets["marketById"] = [exporter, exporter, importer, near, far];
      const decima = Math.hypot(1000, 800) / 10;
      setRoutes({ 1: 2 * decima, 2: 0, 3: decima, 4: 3 * decima });
      globalThis.pack.cells = { routes: {}, market: [0, 1, 2] } as never;
      const row = (rural: number[] = []) => ({
        depth: [100],
        listPrice: [5],
        demand: [],
        supply: [],
        rural,
        covered: [],
        bought: [],
        pollTaxDue: []
      });
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["days"] = [undefined, row(), row(), row(), row()] as never;
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["routeCostsSource"] = [pack.cells.routes, pack.markets, Markets.revision, pack.burgs.length];
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["run"] = { books: [tradeModule["buildBook"](good)], positions: [undefined, 0, 1, 2, 3] } as never;
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["carriage"] = [];

      const trade = tradeModule.buy({ burg, good, units: 9, kind: DEAL_KINDS.demand, source: exporter })!;
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      const demand = (market: Market) => tradeModule["days"][market.i].demand[0] || 0;
      expect(demand(exporter)).toBe(trade.units); // the deal
      expect(demand(importer)).toBeCloseTo((2 / 3) * trade.units); // the buyer's own market, at no distance
      expect(demand(near)).toBeCloseTo((1 / 3) * trade.units); // half the way to the source
      expect(demand(far)).toBe(0); // further than the source
      expect(importer.goods[0].price).toBeGreaterThan(5); // short of it: above the list price
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["run"] = null;
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["carriage"] = null;
    });

    it("sells only the units that fetch something at the burg's door: a glut keeps the rest", () => {
      const { importer, burg, good } = setupImport();
      importer.centerBurgId = 1;
      setRoutes({ 2: 200 });
      importer.goods[0] = { stock: 0, price: 10 };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["days"] = [
        undefined,
        undefined,
        { depth: [20], listPrice: [10], demand: [], supply: [], rural: [] }
      ] as never;

      const least = (carriage(200) + 0.01) / (1 - MARGIN); // the price at which a unit fetches a cent
      const sale = tradeModule.sell({ burg, good, units: 1000, taxRate: 0 })!;
      expect(sale.units).toBeCloseTo(20 * ((10 / least) ** (1 / PRICE_CURVE) - 1), 1);
      expect(sale.price).toBeGreaterThan(0);
      expect(importer.goods[0].price).toBeCloseTo(least, 2);
      expect(tradeModule.sell({ burg, good, units: 1, taxRate: 0 })).toBeNull(); // nothing more fetches a cent

      importer.goods[0].price = 10;
      setRoutes({}); // no route to its own market: ten decimas of carriage cost more than the price
      expect(tradeModule.sell({ burg, good, units: 1, taxRate: 0 })).toBeNull();
    });

    it("atLot() turns a unit's price at the burg's door into what buy() and sell() charge for the lot", () => {
      const { exporter, burg, good, importGood } = setupImport();
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["days"] = [
        undefined,
        { depth: [20], listPrice: [5], demand: [], supply: [], rural: [], covered: [], bought: [], pollTaxDue: [] }
      ] as never;
      const unit = { buyPrice: rn(5 * (1 + MARGIN), 2) + transport, sellPrice: rn(5 * (1 - MARGIN), 2) - transport };

      const buyAtLot = tradeModule.atLot(unit.buyPrice, transport, exporter, good, 10);
      expect(buyAtLot).toBeGreaterThan(unit.buyPrice);
      expect(importGood(10)!.price).toBeCloseTo(buyAtLot, 1);

      exporter.goods[0].price = 5;
      const sellAtLot = tradeModule.atLot(unit.sellPrice, transport, exporter, good, -10);
      expect(sellAtLot).toBeLessThan(unit.sellPrice);
      expect(tradeModule.sell({ burg, good, units: 10, taxRate: 0, market: exporter })!.price).toBeCloseTo(
        sellAtLot,
        1
      );
    });

    it("adds up small trades at a cheap price and rounds it when the run ends", () => {
      const { importer, burg, good } = setupImport();
      importer.centerBurgId = 1;
      setRoutes({ 2: 0 });
      good.value = 0.5;
      importer.goods[0] = { stock: 0, price: 0.5 };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["days"] = [
        undefined,
        undefined,
        {
          depth: [100],
          listPrice: [0.5],
          demand: [],
          supply: [],
          rural: [],
          ruralPeople: 0,
          cash: 0,
          income: 0,
          spent: 0,
          margin: 0,
          covered: [],
          bought: [],
          pollTaxDue: []
        }
      ] as never;

      for (let sale = 0; sale < 50; sale++) tradeModule.sell({ burg, good, units: 1, taxRate: 0 });
      expect(importer.goods[0].price).toBeCloseTo(0.5 * (100 / 150) ** PRICE_CURVE, 4);
      tradeModule.endRun();
      expect(importer.goods[0].price).toBe(rn(0.5 * (100 / 150) ** PRICE_CURVE, 2));
    });

    it("keep() takes back only the burg's own goods, never the rural produce in stock", () => {
      const { importer, burg, good } = setupImport();
      globalThis.pack.burgs[3] = { i: 3, cell: 2, state: 2, treasury: 1000 } as Burg; // another burg of the market
      setRoutes({ 2: 0 });
      importer.goods[0] = { stock: 10, price: 10 };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["days"] = [
        undefined,
        undefined,
        {
          depth: [1e9],
          listPrice: [10],
          demand: [],
          supply: [],
          rural: [10],
          ruralPeople: 0,
          cash: 0,
          income: 0,
          spent: 0,
          margin: 0,
          covered: [],
          bought: [],
          pollTaxDue: []
        }
      ] as never;

      tradeModule.sell({ burg, good, units: 5, taxRate: 0 }); // 15 in stock, 10 of them rural
      tradeModule.buy({ burg: pack.burgs[3], good, units: 9, kind: DEAL_KINDS.demand }); // 6 rural units, 3 of the burg's
      expect(tradeModule.keep({ burg, good, units: 5 })?.units).toBe(2);
      expect(ruralDay(2).rural[0]).toBeCloseTo(importer.goods[0].stock, 2);
    });

    it("pays the countryside for its produce as it is bought, less the margin its market's center takes", () => {
      const { importer, burg, good } = setupImport();
      importer.centerBurgId = 1;
      importer.goods[0] = { stock: 100, price: 10 };
      globalThis.pack.states = withFinance([{ i: 0 }, { i: 1 }, { i: 2 }]); // the market's center (burg 1) is in state 1
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["days"] = [
        undefined,
        undefined,
        {
          depth: [1e9],
          listPrice: [10],
          demand: [],
          supply: [],
          rural: [50],
          ruralPeople: 10,
          cash: 0,
          income: 0,
          spent: 0,
          margin: 0,
          covered: [],
          bought: [],
          pollTaxDue: []
        }
      ] as never;

      tradeModule.buy({ burg, good, units: 10, kind: DEAL_KINDS.demand }); // half the stock is rural: 5 of its units
      const earned = 5 * 10 * (1 - MARGIN);
      expect(ruralDay(2).income).toBeCloseTo(earned, 2);
      expect(ruralDay(2).spent).toBe(0);
      // the center takes the margin on both sides: the buyer's on all 10 units, the rural sellers' on their 5
      expect(ruralDay(2).margin).toBeCloseTo(5 * 10 * MARGIN, 2);
      expect(globalThis.pack.burgs[1].treasury).toBeCloseTo(15 * 10 * MARGIN, 2);

      tradeModule.spendRural(importer); // they spend what they don't save on what the market has
      expect(ruralDay(2).spent).toBeGreaterThan(0);
      expect(ruralDay(2).spent).toBeLessThanOrEqual(earned * (1 - SAVINGS_RATE) + 0.01);
    });

    it("rural people keep back their poll tax and pay it at the end of the run, as far as their money goes", () => {
      const { importer } = setupImport();
      importer.goods[0] = { stock: 100, price: 1 };
      globalThis.pack.markets = [importer];
      const day = (income: number, pollTaxDue: number[]) => ({
        depth: [1e9],
        listPrice: [1],
        demand: [],
        supply: [],
        rural: [],
        ruralPeople: 10,
        cash: income,
        income,
        spent: 0,
        margin: 0,
        covered: [],
        bought: [],
        pollTaxDue
      });

      // they owe 8 of the 20 they earned: they spend at most 12, not 62% of 20, and pay in full
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["days"] = [undefined, undefined, day(20, [0, 6, 2])] as never;
      tradeModule.spendRural(importer);
      expect(ruralDay(2).spent).toBeLessThanOrEqual(12 + 0.01);
      tradeModule.endRun();
      expect(importer.rural?.pollTax).toEqual([
        [1, 6, 6],
        [2, 2, 2]
      ]);

      // they earned 5 and owe 8: they buy nothing and pay what they have, split by what each state charged
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["days"] = [undefined, undefined, day(5, [0, 6, 2])] as never;
      tradeModule.spendRural(importer);
      expect(ruralDay(2).spent).toBe(0);
      tradeModule.endRun();
      expect(importer.rural?.pollTax).toEqual([
        [1, 6, 3.75],
        [2, 2, 1.25]
      ]);
    });

    it("rural people pay their market's center its margin, kept in their day, and no sales tax", () => {
      const { importer } = setupImport([{ i: 0 }, { i: 1 }, { i: 2, economy: { salesTax: 0.5 } }]);
      importer.goods[0] = { stock: 100, price: 10 };
      globalThis.pack.markets = [importer];
      const center = globalThis.pack.burgs[2];
      center.treasury = 0;
      const day = {
        depth: [1e9],
        listPrice: [10],
        demand: [],
        supply: [],
        rural: [],
        ruralPeople: 1000,
        cash: 100,
        income: 100,
        spent: 0,
        margin: 0
      };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["days"] = [undefined, undefined, { ...day, covered: [], bought: [], pollTaxDue: [] }] as never;

      tradeModule.spendRural(importer);
      tradeModule.endRun();
      const [[, units]] = importer.rural!.bought;
      expect(importer.rural!.spent).toBeCloseTo(units * 10 * (1 + MARGIN), 1); // the buy price, untaxed
      expect(importer.rural!.margin).toBeCloseTo(units * 10 * MARGIN, 1);
      expect(center.treasury).toBeCloseTo(importer.rural!.margin!, 1);
    });

    it("rural people keep what is left of their produce, as each purchase took its share of the stock", () => {
      const { importer, burg, good } = setupImport();
      importer.goods[0] = { stock: 100, price: 10 };
      globalThis.pack.markets = [importer];
      const day = {
        depth: [1e9],
        listPrice: [10],
        demand: [],
        supply: [],
        rural: [100],
        ruralPeople: 1,
        cash: 0,
        income: 0,
        spent: 0,
        margin: 0
      };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      tradeModule["days"] = [undefined, undefined, { ...day, covered: [], bought: [], pollTaxDue: [] }] as never;

      tradeModule.sell({ burg, good, units: 100, taxRate: 0 });
      tradeModule.buy({ burg, good, units: 100, kind: DEAL_KINDS.demand });
      tradeModule.endRun();
      expect(importer.rural!.kept).toEqual([[0, 50]]); // half the stock was theirs when the buyer took half of it
    });

    it("measures routes again once the route network changes", () => {
      setupImport();
      const measure = vi.spyOn(TradeRoutes, "measure").mockReturnValue([]);
      const [market, burg] = [globalThis.pack.markets[0], globalThis.pack.burgs[2]];
      tradeModule.getDecimas(market, burg);
      expect(measure).not.toHaveBeenCalled(); // the routes set for the test still hold
      globalThis.pack.cells.routes = {};
      tradeModule.getDecimas(market, burg);
      expect(measure).toHaveBeenCalledTimes(1);
      measure.mockRestore();
    });

    it("sells where the price at the burg's door is best, carriage paid", () => {
      const { exporter, importer, burg, good } = setupImport();
      importer.centerBurgId = 1;
      exporter.goods[0].price = 5;
      importer.goods[0].price = 4.5;
      setRoutes({ 1: 100, 2: 0 }); // the exporter's center is 0.78 decimas away, in the same state
      expect(tradeModule.getOutlet(burg, good)?.market).toBe(importer); // 4.5 less the margin at home beats 5 less the margin and 0.78 of carriage
      exporter.goods[0].price = 20;
      expect(tradeModule.getOutlet(burg, good)?.market).toBe(exporter);
    });

    it("buy() and sell() at the burg's own market pay the carriage from its center", () => {
      const { importer, burg, good } = setupImport();
      importer.goods[0] = { stock: 100, price: 20 };
      importer.centerBurgId = 1;
      setRoutes({ 2: 200 });
      const bought = tradeModule.buy({ burg, good, units: 1, kind: DEAL_KINDS.demand })!;
      expect(bought.price).toBeCloseTo(20 * (1 + MARGIN) + carriage(200), 2);
      const midPrice = importer.goods[0].price; // raised by the purchase
      const sold = tradeModule.sell({ burg, good, units: 1, taxRate: 0 })!;
      expect(sold.price).toBeCloseTo(midPrice * (1 - MARGIN) - carriage(200), 1);
    });

    it("buy() from a source adds the exporter's sales tax after the margin and records it on the import", () => {
      const { importGood } = setupImport([
        { i: 0 },
        { i: 1, economy: { salesTax: 0.2 } },
        { i: 2, economy: { salesTax: 0.1 } }
      ]);
      const trade = importGood()!;
      expect(trade.tax).toBeCloseTo(0.2 * 5 * 10, 2);
      expect(trade.price).toBeCloseTo(rn(5 * (1 + MARGIN), 2) + 0.2 * 5 + transport, 2);
      expect(Taxes.getTaxStates(globalThis.pack.deals[0]).taxState).toBe(1);
    });

    it("buy() from a source applies the importer's tariff and records deal.tariff", () => {
      const { importGood } = setupImport([
        { i: 0 },
        { i: 1, economy: { tariffs: [{ states: "all", goods: "all", rate: 0.1 }] } },
        { i: 2, economy: { tariffs: [{ states: "all", goods: "all", rate: 0.2 }] } }
      ]);
      importGood();
      const [deal] = globalThis.pack.deals;
      expect(deal[7]).toBeCloseTo(0.2 * 5 * 10, 2);
      expect(Taxes.getTaxStates(deal).tariffState).toBe(2);
    });

    it("isImport() is a purchase from a market of another state", () => {
      const { burg } = setupImport();
      const remoteBuy: Deal = [2, 1, 0, DEAL_KINDS.input, 1, 1, 0, 0, 0];
      const localBuy: Deal = [2, 2, 0, DEAL_KINDS.demand, 1, 1, 0, 0, 0];
      const sale: Deal = [2, 2, 0, DEAL_KINDS.sale, 1, 1, 0, 0, 0];
      expect([remoteBuy, localBuy, sale].map(deal => Taxes.isImport(deal))).toEqual([true, false, false]);

      globalThis.pack.burgs[1].state = burg.state; // the source market's center joins the burg's state
      expect(Taxes.isImport(remoteBuy)).toBe(false);
    });

    it("a burg that lost its market keeps paying its tariffs to its own state", () => {
      setupImport();
      const paid: Deal = [2, 1, 0, DEAL_KINDS.input, 1, 1, 0, 0.5, 0];
      globalThis.pack.cells.market[globalThis.pack.burgs[2].cell] = 0;
      expect(Taxes.getTaxStates(paid).tariffState).toBe(globalThis.pack.burgs[2].state);
      expect(Taxes.isImport(paid)).toBe(true);
    });

    it("sell() to another state's market pays that state's tariff off the revenue: an import there", () => {
      const { exporter, burg, good } = setupImport([
        { i: 0 },
        { i: 1, economy: { tariffs: [{ states: "all", goods: "all", rate: 0.1 }] } },
        { i: 2 }
      ]);
      const sold = tradeModule.sell({ burg, good, units: 10, taxRate: 0, market: exporter })!;
      expect(sold.tariff).toBeCloseTo(0.1 * 5 * 10, 2);
      const [deal] = globalThis.pack.deals;
      expect(deal[7]).toBeCloseTo(sold.tariff!, 2);
      expect(Taxes.isImport(deal)).toBe(true);
      expect(Taxes.getTaxStates(deal).tariffState).toBe(1);
      expect(Taxes.getDealTariffRate(deal)).toBe(0.1);
    });

    it("an embargo by either state blocks the sale too", () => {
      for (const states of [
        [{ i: 0 }, { i: 1, economy: { tariffs: [{ states: [2], goods: "all", rate: "embargo" }] } }, { i: 2 }],
        [{ i: 0 }, { i: 1 }, { i: 2, economy: { tariffs: [{ states: [1], goods: "all", rate: "embargo" }] } }]
      ]) {
        const { exporter, importer, burg, good } = setupImport(states);
        exporter.goods[0].price = 100; // would pay far better
        expect(tradeModule.getOutlet(burg, good)?.market).toBe(importer);
        expect(tradeModule.sell({ burg, good, units: 1, taxRate: 0, market: exporter })).toBeNull();
      }
      expect(globalThis.pack.deals).toHaveLength(0);
    });

    it("buy() from a source applies no tariff or embargo between markets of one state", () => {
      const { burg, importGood } = setupImport([
        { i: 0 },
        { i: 1, economy: { tariffs: [{ states: "all", goods: "all", rate: "embargo" }] } }
      ]);
      burg.state = 1;
      globalThis.pack.burgs[2].state = 1;
      expect(importGood()).not.toBeNull();
      expect(globalThis.pack.deals[0][7]).toBe(0);
    });

    it("an embargo by either state blocks the import", () => {
      for (const states of [
        [{ i: 0 }, { i: 1, economy: { tariffs: [{ states: [2], goods: "all", rate: "embargo" }] } }, { i: 2 }],
        [{ i: 0 }, { i: 1 }, { i: 2, economy: { tariffs: [{ states: [1], goods: "all", rate: "embargo" }] } }]
      ]) {
        const { burg, good, terms, importGood } = setupImport(states);
        expect(tradeModule.quoteSource(burg, good, terms)).toBeNull();
        expect(importGood()).toBeNull();
      }
      expect(globalThis.pack.deals).toHaveLength(0);
    });

    it("an embargo on specific goods blocks only those goods, over any tariff", () => {
      const cases: [any[], boolean][] = [
        [[{ states: "all", goods: [1], rate: "embargo" }], true],
        [[{ states: "all", goods: [0], rate: "embargo" }], false],
        [[{ states: [1], goods: [0, 1], rate: "embargo" }], false],
        [
          [
            { states: [1], goods: "all", rate: 0.1 },
            { states: [1], goods: [0], rate: "embargo" }
          ],
          false
        ],
        [
          [
            { states: "all", goods: [0], rate: "embargo" },
            { states: [1], goods: "all", rate: 0.1 }
          ],
          false
        ],
        [
          [
            { states: [1], goods: "all", rate: "embargo" },
            { states: "all", goods: [0], rate: 0.1 }
          ],
          false
        ],
        [
          [
            { states: "all", goods: [0], rate: "embargo" },
            { states: [1], goods: [0], rate: 0.1 }
          ],
          false
        ],
        [
          [
            { states: [1], goods: "all", rate: "embargo" },
            { states: [1], goods: [0], rate: 0.1 }
          ],
          false
        ],
        [
          [
            { states: "all", goods: "all", rate: "embargo" },
            { states: [1], goods: "all", rate: 0 }
          ],
          false
        ],
        [
          [
            { states: [1], goods: [0], rate: 0.1 },
            { states: [1], goods: [0], rate: "embargo" }
          ],
          false
        ]
      ];
      for (const [tariffs, opens] of cases) {
        for (const states of [
          [{ i: 0 }, { i: 1 }, { i: 2, economy: { tariffs } }],
          [
            { i: 0 },
            {
              i: 1,
              economy: { tariffs: tariffs.map(rule => ({ ...rule, states: rule.states === "all" ? "all" : [2] })) }
            },
            { i: 2 }
          ]
        ]) {
          globalThis.pack.deals = [];
          const { exporter, burg, good, terms, importGood } = setupImport(states);
          expect(tradeModule.quoteSource(burg, good, terms) !== null).toBe(opens);
          expect(importGood() !== null).toBe(opens);
          expect(tradeModule.sell({ burg, good, units: 1, taxRate: 0, market: exporter }) !== null).toBe(opens);
        }
      }
    });

    it("tariffs take the most specific rule of the importer's state", () => {
      const { importGood } = setupImport([
        { i: 0 },
        { i: 1 },
        {
          i: 2,
          economy: {
            tariffs: [
              { states: "all", goods: "all", rate: 0.5 },
              { states: [1], goods: "all", rate: 0.3 },
              { states: [1], goods: [0], rate: 0.05 }
            ]
          }
        }
      ]);
      importGood();
      expect(globalThis.pack.deals[0][7]).toBeCloseTo(0.05 * 5 * 10, 2);
    });

    it("collectRuralProduction() should ignore cells with no market (market 0)", () => {
      const market1: Market = { i: 1, centerBurgId: 1, color: "#ff0000", goods: {} };
      globalThis.pack.markets = [market1];
      // Index by id: slot 0 (no market) stays empty so market-0 cells resolve to undefined.
      const index: Market[] = [];
      index[market1.i] = market1;
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      Markets["marketById"] = index;

      // Three land cells: cells 0 and 2 belong to market 1, cell 1 has no market.
      globalThis.pack.cells = {
        i: [0, 1, 2],
        market: Uint16Array.from([1, 0, 1]),
        state: Uint16Array.from([0, 0, 0]),
        pop: [1, 1, 1]
      } as any;

      const good = globalThis.options.map.goods[0];
      Object.assign(Goods, { get: (id: number) => (id === good.i ? good : undefined) });

      tradeModule.collectRuralProduction([{ [good.i]: 5 }, { [good.i]: 5 }, { [good.i]: 5 }]); // each cell yields 5

      // Only the two market-1 cells contribute; the no-market cell is skipped.
      expect(market1.goods[good.i].stock).toBe(10);
    });

    it("sell() should record sales tax on burg deals when state has a sales tax", () => {
      const market1: Market = {
        i: 1,
        centerBurgId: 1,
        color: "#ff0000",
        goods: { 0: { stock: 0, price: 10 } }
      };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      Markets["marketById"] = [market1, market1];
      globalThis.pack.markets = [market1];
      const burg: Burg = { i: 1, cell: 1, state: 1 } as any;
      globalThis.pack.burgs = [{ i: 0 } as any, burg];
      globalThis.pack.states = withFinance([{ i: 0 }, { i: 1, economy: { salesTax: 0.2 } }]);
      const taxRate = Taxes.getSalesTax(burg);
      const deal = tradeModule.sell({ burg, good: globalThis.options.map.goods[0], units: 5, taxRate });
      expect(deal).not.toBeNull();
      expect(deal!.tax).toBeGreaterThan(0);
      expect(deal!.tax).toBeCloseTo(deal!.units * deal!.price * 0.2, 2);
      expect(Taxes.getTaxStates(globalThis.pack.deals[0]).taxState).toBe(1);
    });

    it("sums a burg's trades with a market in one good and kind into one deal at the average price", () => {
      const market1: Market = { i: 1, centerBurgId: 1, color: "#ff0000", goods: { 0: { stock: 100, price: 10 } } };
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      Markets["marketById"] = [market1, market1];
      globalThis.pack.markets = [market1];
      const burg: Burg = { i: 1, cell: 1, treasury: 1000 } as any;
      globalThis.pack.burgs = [{ i: 0 } as any, burg];
      const good = globalThis.options.map.goods[0];

      const first = tradeModule.buy({ burg, good, units: 2, kind: DEAL_KINDS.input })!;
      const second = tradeModule.buy({ burg, good, units: 4, kind: DEAL_KINDS.input })!;
      tradeModule.buy({ burg, good, units: 1, kind: DEAL_KINDS.demand });
      tradeModule.sell({ burg, good, units: 3, taxRate: 0 });

      const average = rn((2 * first.price + 4 * second.price) / 6, 2);
      expect(globalThis.pack.deals.map(([, , , kind, units]) => [kind, units])).toEqual([
        [DEAL_KINDS.input, 6],
        [DEAL_KINDS.demand, 1],
        [DEAL_KINDS.sale, 3]
      ]);
      expect(globalThis.pack.deals[0][5]).toBe(average);
    });
  });
});

describe("market margin", () => {
  it("rises with the license fee the market's center paid, by the fee factor's root, in whole percents", () => {
    const market = { i: 1, centerBurgId: 1, color: "", goods: {} } as Market;
    expect(Markets.getMarginRate(market)).toBe(Math.round(MARKET_MARGIN * 100) / 100);
    market.feePaid = 35; // a typical monarchy's
    expect(Markets.getMarginRate(market)).toBe(0.05);
    market.feePaid = 105; // a fee factor of 4
    expect(Markets.getMarginRate(market)).toBe(Math.round(MARKET_MARGIN * 200) / 100);
  });

  it("stays below the price, however dear the license", () => {
    const market = { i: 1, centerBurgId: 1, color: "", goods: {}, feePaid: 1000000 } as Market;
    expect(Markets.getMarginRate(market)).toBe(0.5);
  });
});
