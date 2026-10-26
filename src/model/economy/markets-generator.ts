import Alea from "alea";
import { quadtree } from "d3-quadtree";
import type { Burg } from "@/model/political/burgs-generator";
import { States } from "@/model/political/states-generator";
import { getDecima } from "@/model/units";
import { getColors, getRandomColor, requireFill } from "@/utils/color-utils";
import { FlatQueue } from "@/utils/flat-queue";
import { t } from "@/utils/i18n";
import { notify } from "@/utils/notices";
import { minmax, rn } from "@/utils/number-utils";
import type { DemandCategory, Good } from "./goods-generator";
import { DEMAND_PRIORITY, DEMAND_TARGET_FACTORS, Goods } from "./goods-generator";
import { Production } from "./production-generator";
import { TradeRoutes } from "./trade-routes";

const PRICE_FLOOR_FACTOR = 0.1;
const PRICE_CEILING_FACTOR = 5.0;
const LAPLACE_PRICE_SMOOTHING = 5;
const MARKET_PRESSURE_FACTOR = 0.01;
const MARKET_MARGIN = 0.05;
const MAX_DECIMAS = 10; // the map's diagonal: the most carriage, paid with no route to the burg's own market

export type Market = {
  i: number;
  centerBurgId: number;
  color: string;
  name?: string;
  goods: Record<number, { stock: number; price: number }>;
  note?: string;
};

/** Units the budget pays for at the price, rounded down to the hundredth so the cost stays within it */
const affordable = (budget: number, price: number) => Math.floor((budget / price) * 100 + 1e-6) / 100;

export const DEAL_KINDS = { sale: 0, input: 1, demand: 2, kept: 3 } as const;
export type DealKind = (typeof DEAL_KINDS)[keyof typeof DEAL_KINDS];

/** A burg's trade with a market in one good and kind, summed over the run; its id is its index in pack.deals */
export type Deal = [
  burg: number,
  market: number,
  good: number,
  kind: DealKind,
  units: number,
  price: number, // average per unit
  tax: number, // sales tax: the burg's on a sale, the exporter's on an import
  tariff: number, // the importer's, on an import
  carriage: number // average per unit: cost of carrying the goods between the market's center and the burg, in the price
];

/** One trade's amounts: price and carriage per unit, tax and tariff in total */
export type Trade = { units: number; price: number; tax: number; tariff?: number; carriage?: number };

type TariffRate = number | "embargo";
type TradeCosts = { taxPerUnit: number; tariffPerUnit: number };
type TradePair = {
  taxRate: number;
  exporterStateId: number;
  importerStateId: number;
  tariffs: TariffRate[]; // by good
};
export type TradeTerms = (exporter: Market, importer: Market, good: Good, price: number) => TradeCosts | null;
export type ImportQuote = { source: Market; stock: number; buyPrice: number };
type CompiledStateTariffs = {
  byStateAndGood: Map<number, Map<number, TariffRate>>;
  byStateAllGoods: Map<number, TariffRate>;
  allStatesByGood: Map<number, TariffRate>;
  allStatesAllGoods: TariffRate | undefined;
};

export class MarketsModule {
  private marketById: Market[] = [];
  private dealIds = new Map<string, number>(); // burg-market-good-kind -> deal index, for summing trades
  private dealIdsSource: Deal[] | null = null;
  private routeCosts: Float32Array[] | null = null; // by market then burg id, in map units
  private decima = 0; // a tenth of the map's diagonal, kept with the routes

  regenerate(): Market[] {
    return this.generate(true);
  }

  generate(regenerate: boolean = false): Market[] {
    if (!regenerate) Math.random = Alea(options.map.seed);
    const markets = this.createMarkets();
    this.expandMarkets(markets);

    pack.markets = markets;
    pack.deals = [];

    return markets;
  }

  private createMarkets(): Market[] {
    // Score each burg by population; capitals and ports are weighted higher
    const scored = pack.burgs
      .map(burg => {
        let score = burg.population || 0;
        if (burg.capital) score *= 2.5;
        if (burg.port) score *= 1.2;
        score *= Math.random() * 2 + 0.5; // add some noise
        return { burg, score };
      })
      .sort((a, b) => b.score - a.score);

    // minSpacing scales with map size relative to burg count
    let minSpacing = (((options.map.graph.width + options.map.graph.height) * 2) / pack.burgs.length ** 0.6) | 0;

    const markets: Market[] = [];
    const tree = quadtree<[number, number, number]>(
      [],
      d => d[0],
      d => d[1]
    );

    for (const { burg } of scored) {
      if (!burg.i || burg.removed) continue;
      const { x, y } = burg;
      const nearest = tree.find(x, y, minSpacing);
      if (!nearest) {
        // Create a new market anchored at this burg
        const marketId = markets.length + 1;
        const market = { i: marketId, centerBurgId: burg.i, color: "", goods: {} };
        markets.push(market);
        this.marketById[marketId] = market;
        tree.add([x, y, marketId]);
        minSpacing += 1;
      }
    }

    const colors = getColors(markets.length);
    markets.forEach((m, i) => {
      m.color = colors[i];
    });

    return markets;
  }

  expandTerritories(markets: Market[] = pack.markets): Uint16Array {
    this.indexMarkets(markets);
    return this.expandMarkets(markets);
  }

  private indexMarkets(markets: Market[] = pack.markets): void {
    this.marketById = [];
    for (const market of markets) if (market) this.marketById[market.i] = market;
  }

  public sync(): void {
    this.indexMarkets();
  }

  private expandMarkets(markets: Market[]): Uint16Array {
    const cells = pack.cells;
    const cellMarket = new Uint16Array(cells.i.length);
    const costs: number[] = [];
    const queue = new FlatQueue<{ cellId: number; marketId: number; burg: Burg; priority: number }>();

    const MIN_COST = 1;
    const BASE_COST = 10;
    const DIFFERENT_STATE_COST = 100;
    const WATER_COST = 50;
    const WATER_COST_FOR_NON_PORTS = 50;
    const ISLAND_CHANGE_COST = 100;

    const tradeCenters = {} as Record<number, boolean>;
    for (const market of markets) {
      const centerBurg = pack.burgs[market.centerBurgId];
      if (!centerBurg) continue;
      tradeCenters[centerBurg.i] = true;

      const startCell = centerBurg.cell;
      cellMarket[startCell] = market.i;
      costs[startCell] = MIN_COST;

      queue.push({ cellId: startCell, marketId: market.i, burg: centerBurg, priority: 0 }, 0);
    }

    while (queue.length) {
      const { cellId, marketId, burg, priority } = queue.pop();

      for (const neighborId of cells.c[cellId]) {
        const isWater = cells.h[neighborId] < 20;
        let cost = BASE_COST;
        if (isWater) {
          cost += WATER_COST;
          if (burg.port !== cells.f[neighborId]) cost += WATER_COST_FOR_NON_PORTS;
        } else {
          if (cells.f[burg.cell] !== cells.f[neighborId]) cost += ISLAND_CHANGE_COST;
          if (cells.state[neighborId] && burg.state !== cells.state[neighborId]) cost += DIFFERENT_STATE_COST;
        }

        const totalCost = priority + cost;
        if (!costs[neighborId] || totalCost < costs[neighborId]) {
          costs[neighborId] = totalCost;
          queue.push({ cellId: neighborId, marketId, burg, priority: totalCost }, totalCost);

          const hasGood = Boolean(cells.good[neighborId]);
          if (isWater && !hasGood) continue; // exclude water cells without goods

          cellMarket[neighborId] = marketId;
        }
      }
    }

    pack.cells.market = cellMarket;

    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed) continue;
      burg.market = cellMarket[burg.cell] || 0;
      burg.plaza = burg.plaza || tradeCenters[burg.i] ? 1 : 0;
    }

    return cellMarket;
  }

  collectRuralProduction(): void {
    const biomeProduction = Goods.getBiomesProduction();

    for (const cellId of pack.cells.i) {
      const market = this.marketById[pack.cells.market[cellId]];
      if (!market) continue;

      const produced = Production.getCellProduction(cellId, biomeProduction);
      for (const [goodId, amount] of Object.entries(produced)) {
        const good = Goods.get(+goodId);
        if (!good) continue;
        const marketGood = this.getMarketGood(market, good);
        marketGood.stock = rn(marketGood.stock + amount, 2);
      }
    }
  }

  private getMarketGood(market: Market, good: Good) {
    const existing = market.goods[good.i];
    if (existing) return existing;

    const initial = { stock: 0, price: good.value };
    market.goods[good.i] = initial;
    return initial;
  }

  initializeMarketPrices(): void {
    const consumerDemandFactors = this.collectConsumerDemand(pack.goods);
    const industrialDemandFactors = this.collectIndustrialDemand(pack.goods, consumerDemandFactors);
    const avgIngredientsCostByGood = this.calculateAverageBaseCostByGood(pack.goods);
    const populationByMarket = this.calculatePopulationByMarket();

    for (const market of pack.markets) {
      const population = populationByMarket[market.i] || 0;

      // First pass: raw goods - price from demand/supply ratio
      for (const good of pack.goods) {
        if (!good.distribution) continue;
        const marketGood = this.getMarketGood(market, good);
        const consumerDemand = consumerDemandFactors[good.i] || 0;
        const industrialDemand = industrialDemandFactors[good.i] || 0;
        const demand = population * (consumerDemand + industrialDemand);
        const ratio = (demand + LAPLACE_PRICE_SMOOTHING) / (marketGood.stock + LAPLACE_PRICE_SMOOTHING);
        marketGood.price = rn(good.value * minmax(ratio, PRICE_FLOOR_FACTOR, PRICE_CEILING_FACTOR), 2);
      }

      // Second pass: manufactured goods - average local ingredient cost + base value-added
      for (const good of pack.goods) {
        if (!good.recipes?.length) continue;
        const marketGood = this.getMarketGood(market, good);
        let totalMarketCost = 0;
        for (const recipe of good.recipes) {
          for (const [ingIdStr, amount] of Object.entries(recipe)) {
            const ingId = +ingIdStr;
            const ing = Goods.get(ingId);
            if (!ing) continue;
            totalMarketCost += amount * this.getMarketGood(market, ing).price;
          }
        }
        const avgMarketCost = totalMarketCost / good.recipes.length;
        const avgBaseCost = avgIngredientsCostByGood[good.i] ?? 0;
        const demandPrice = avgMarketCost + Math.max(0, good.value - avgBaseCost);
        marketGood.price = rn(
          minmax(demandPrice, good.value * PRICE_FLOOR_FACTOR, good.value * PRICE_CEILING_FACTOR),
          2
        );
      }
    }
  }

  public get(marketId: number | undefined): Market | undefined {
    if (!marketId) return undefined;
    return this.marketById[marketId];
  }

  /** Rename a market; empty takes its center burg's name again */
  rename(marketId: number, name: string): void {
    const market = this.living(marketId);
    if (typeof name !== "string") throw new Error("The name must be text");
    if (name.trim()) market.name = name.trim();
    else delete market.name;
  }

  /** Set a market's color on the Markets layer */
  recolor(marketId: number, color: string): void {
    this.living(marketId).color = requireFill(color);
  }

  private living(marketId: number): Market {
    const market = pack.markets?.find(({ i }) => i === marketId);
    if (!market) throw new Error(`Market ${marketId} does not exist`);
    return market;
  }

  // Display name: the custom name if set, otherwise derived from the center burg.
  public getName(market: Market): string {
    return market.name || pack.burgs[market.centerBurgId]?.name || `Market ${market.i}`;
  }

  addMarket(burgId: number): Market | null {
    const burg = (pack.burgs as Burg[])[burgId];
    if (!burg || burg.removed) return null;

    if (pack.markets.some(m => m.centerBurgId === burgId)) {
      notify(t("This burg is already a market center"), "error");
      return null;
    }

    const maxId = pack.markets.reduce((max, m) => Math.max(max, m.i), 0);
    const marketId = maxId + 1;
    const market: Market = { i: marketId, centerBurgId: burgId, color: getRandomColor(), goods: {} };
    pack.markets.push(market);
    pack.deals = [];

    this.indexMarkets();
    pack.cells.market[burg.cell] = marketId;
    burg.market = marketId;
    burg.plaza = 1;

    return market;
  }

  // Move the market center to another burg. Keeps territories, goods, production and deals intact.
  relocateMarket(marketId: number, newBurgId: number): Market | null {
    const market = this.get(marketId);
    if (!market) return null;

    const newCenter = pack.burgs[newBurgId];
    if (!newCenter || newCenter.removed) return null;
    if (market.centerBurgId === newBurgId) return null;
    if (pack.markets.some(m => m.centerBurgId === newBurgId)) return null;

    const oldCenter = pack.burgs[market.centerBurgId];
    if (oldCenter) oldCenter.plaza = 0;

    market.centerBurgId = newBurgId;
    pack.cells.market[newCenter.cell] = marketId;
    newCenter.market = marketId;
    newCenter.plaza = 1;

    return market;
  }

  removeMarket(marketId: number) {
    const market = this.get(marketId);
    if (!market) return;

    const centerBurg = pack.burgs[market.centerBurgId];
    if (centerBurg) centerBurg.plaza = 0;

    pack.deals = pack.deals.filter(([, dealMarket]) => dealMarket !== marketId);

    for (let i = 0; i < pack.cells.market.length; i++) {
      if (pack.cells.market[i] === marketId) pack.cells.market[i] = 0;
    }

    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed) continue;
      if (burg.market === marketId) burg.market = 0;
    }

    pack.markets = pack.markets.filter(m => m.i !== marketId);
    this.indexMarkets();
  }

  /** Prices at the market, or at the burg's door when a burg is given: buying adds the market's sales tax and the carriage, selling pays the carriage */
  quoteMarket(market: Market, goodId: number, burg?: Burg): { stock: number; buyPrice: number; sellPrice: number } {
    const good = Goods.get(goodId);
    if (!good) return { stock: 0, buyPrice: 0, sellPrice: 0 };
    const row = this.getMarketGood(market, good);
    const transport = burg ? this.getTransport(market, burg, good) : 0;
    return {
      stock: row.stock,
      buyPrice: rn(this.customerBuyPrice(row.price) + this.getSalesTaxPerUnit(market, row.price) + transport, 2),
      sellPrice: rn(Math.max(0, this.customerSellPrice(row.price) - transport), 2)
    };
  }

  /** Measures the route network from every market's center, for the economy run to price carriage */
  measureRoutes(): void {
    this.routeCosts = TradeRoutes.measure();
    this.decima = getDecima() || 1;
  }

  /** Per-unit cost of carrying a good between the market's center and the burg; Infinity with no route to another market */
  getTransport(market: Market, burg: Burg, good: Good): number {
    if (burg.i === market.centerBurgId) return 0;
    this.routeCosts ??= TradeRoutes.measure();
    this.decima ||= getDecima() || 1;
    const distance = this.routeCosts[market.i]?.[burg.i!] ?? Infinity;
    if (distance === Infinity && market.i !== burg.market) return Infinity;
    return Math.min(distance / this.decima, MAX_DECIMAS) * good.carriage;
  }

  buy({
    burg,
    good,
    units,
    kind,
    budget = Infinity
  }: {
    burg: Burg;
    good: Good;
    units: number;
    kind: DealKind;
    budget?: number;
  }): Trade | null {
    const market = this.get(burg.market);
    if (!market) return null;

    const marketGood = this.getMarketGood(market, good);
    const transport = this.getTransport(market, burg, good);
    const taxPerUnit = this.getSalesTaxPerUnit(market, marketGood.price);
    const price = rn(this.customerBuyPrice(marketGood.price) + taxPerUnit + transport, 2);

    const actualUnits = rn(Math.min(units, marketGood.stock, affordable(budget, price)), 2);
    if (actualUnits < 0.01) return null;

    const trade = { units: actualUnits, price, tax: rn(taxPerUnit * actualUnits, 2), carriage: rn(transport, 2) };
    this.recordDeal(burg.i!, market.i, good.i, kind, trade);

    marketGood.stock = rn(Math.max(0, marketGood.stock - actualUnits), 2);
    marketGood.price = rn(this.applyMarketPressure(good.value, marketGood.price, actualUnits), 2);
    return trade;
  }

  /** Sales tax the market's state levies per unit sold at the price */
  private getSalesTaxPerUnit(market: Market, price: number): number {
    return States.getSalesTax(pack.burgs[market.centerBurgId]) * price;
  }

  /** Units the burg sold to its own market this run and can still take back, at what the sale earned it per unit */
  quoteKeep(burg: Burg, good: Good): { units: number; price: number } | null {
    const market = this.get(burg.market);
    const sale = market && this.findDeal(burg.i!, market.i, good.i, DEAL_KINDS.sale);
    if (!market || !sale) return null;

    const units = Math.min(sale[4], this.getMarketGood(market, good).stock);
    if (units < 0.01) return null;
    return { units, price: sale[5] - sale[6] / sale[4] };
  }

  /** The burg takes back goods it sold to its own market to cover its demand, as if it never sold them: the sale and its tax shrink, the burg pays back what they earned */
  keep({
    burg,
    good,
    units,
    budget = Infinity
  }: {
    burg: Burg;
    good: Good;
    units: number;
    budget?: number;
  }): Trade | null {
    const market = this.get(burg.market);
    const quote = this.quoteKeep(burg, good);
    if (!market || !quote) return null;

    const kept = rn(Math.min(units, quote.units, affordable(budget, quote.price)), 2);
    if (kept < 0.01) return null;

    const sale = this.findDeal(burg.i!, market.i, good.i, DEAL_KINDS.sale)!;
    sale[6] = rn(sale[6] * (1 - kept / sale[4]), 2);
    sale[4] = rn(sale[4] - kept, 2);
    this.recordDeal(burg.i!, market.i, good.i, DEAL_KINDS.kept, { units: kept, price: 0, tax: 0 });

    const marketGood = this.getMarketGood(market, good);
    marketGood.stock = rn(Math.max(0, marketGood.stock - kept), 2);
    marketGood.price = rn(this.applyMarketPressure(good.value, marketGood.price, kept), 2);
    return { units: kept, price: rn(quote.price, 2), tax: 0 };
  }

  sell({ burg, good, units, taxRate }: { burg: Burg; good: Good; units: number; taxRate: number }): Trade | null {
    const market = this.get(burg.market);
    if (!market || units <= 0) return null;

    const marketGood = this.getMarketGood(market, good);
    const grossPrice = this.customerSellPrice(marketGood.price);
    const transport = Math.min(this.getTransport(market, burg, good), grossPrice);
    const price = rn(grossPrice - transport, 2);
    const tax = rn(units * price * taxRate, 2);
    const trade = { units: rn(units, 2), price, tax, carriage: rn(transport, 2) };
    this.recordDeal(burg.i!, market.i, good.i, DEAL_KINDS.sale, trade);

    marketGood.stock = rn(marketGood.stock + units, 2);
    marketGood.price = rn(this.applyMarketPressure(good.value, marketGood.price, -units), 2);
    return trade;
  }

  /** Adds a trade to the burg's deal with the market in the good and kind */
  recordDeal(burgId: number, marketId: number, goodId: number, kind: DealKind, trade: Trade) {
    const { tariff = 0, carriage = 0 } = trade;
    const deal = this.findDeal(burgId, marketId, goodId, kind);
    if (!deal) {
      this.dealIds.set(`${burgId}-${marketId}-${goodId}-${kind}`, pack.deals.length);
      pack.deals.push([burgId, marketId, goodId, kind, trade.units, trade.price, trade.tax, tariff, carriage]);
      return;
    }

    const units = deal[4] + trade.units;
    deal[5] = rn((deal[4] * deal[5] + trade.units * trade.price) / units, 2);
    deal[8] = rn((deal[4] * deal[8] + trade.units * carriage) / units, 2);
    deal[4] = rn(units, 2);
    deal[6] = rn(deal[6] + trade.tax, 2);
    deal[7] = rn(deal[7] + tariff, 2);
  }

  private findDeal(burgId: number, marketId: number, goodId: number, kind: DealKind): Deal | undefined {
    if (this.dealIdsSource !== pack.deals) {
      this.dealIds = new Map(pack.deals.map(([b, m, g, k], i) => [`${b}-${m}-${g}-${k}`, i]));
      this.dealIdsSource = pack.deals;
    }
    const id = this.dealIds.get(`${burgId}-${marketId}-${goodId}-${kind}`);
    return id === undefined ? undefined : pack.deals[id];
  }

  /** An import is a purchase from a market of another state than the burg's own market: only an import may pay a tariff */
  isImport(deal: Deal): boolean {
    if (deal[3] === DEAL_KINDS.sale) return false;
    const { taxState, tariffState } = this.getTaxStates(deal);
    return taxState !== tariffState;
  }

  /** States the deal's sales tax and tariff go to: the seller's and the importing market's */
  getTaxStates(deal: Deal): { taxState: number; tariffState: number } {
    const [burgId, marketId, , kind] = deal;
    const burg = pack.burgs[burgId];
    const marketState = (id: number | undefined) => pack.burgs[this.get(id)?.centerBurgId ?? 0]?.state || 0;
    return {
      taxState: kind === DEAL_KINDS.sale ? burg?.state || 0 : marketState(marketId),
      tariffState: marketState(burg?.market)
    };
  }

  /** The tariff rate the importer state levies on the good from the exporter state, 0 under an embargo */
  getTariffRate(importerStateId: number, exporterStateId: number, goodId: number): number {
    const rate = this.compileTariffs()(importerStateId, exporterStateId, goodId);
    return rate === "embargo" ? 0 : rate;
  }

  private compileTariffs(): (ownerStateId: number, otherStateId: number, goodId: number) => TariffRate {
    const compiled: Record<number, CompiledStateTariffs> = {};
    const pickRate = (prev: TariffRate | undefined, next: TariffRate): TariffRate =>
      prev === "embargo" ? "embargo" : next;

    for (const state of pack.states ?? []) {
      if (!state?.i || state.removed || !Array.isArray(state.tariffs) || !state.tariffs.length) continue;
      const entry: CompiledStateTariffs = {
        byStateAndGood: new Map(),
        byStateAllGoods: new Map(),
        allStatesByGood: new Map(),
        allStatesAllGoods: undefined
      };
      for (const rule of state.tariffs) {
        if (!rule) continue;
        if (rule.states === "all" && rule.goods === "all") {
          entry.allStatesAllGoods = pickRate(entry.allStatesAllGoods, rule.rate);
        } else if (rule.states === "all" && Array.isArray(rule.goods)) {
          for (const g of rule.goods) {
            entry.allStatesByGood.set(g, pickRate(entry.allStatesByGood.get(g), rule.rate));
          }
        } else if (Array.isArray(rule.states) && rule.goods === "all") {
          for (const s of rule.states) {
            entry.byStateAllGoods.set(s, pickRate(entry.byStateAllGoods.get(s), rule.rate));
          }
        } else if (Array.isArray(rule.states) && Array.isArray(rule.goods)) {
          for (const s of rule.states) {
            let goodMap = entry.byStateAndGood.get(s);
            if (!goodMap) {
              goodMap = new Map();
              entry.byStateAndGood.set(s, goodMap);
            }
            for (const g of rule.goods) {
              goodMap.set(g, pickRate(goodMap.get(g), rule.rate));
            }
          }
        }
      }
      compiled[state.i] = entry;
    }

    return (ownerStateId: number, otherStateId: number, goodId: number): TariffRate => {
      if (!ownerStateId || ownerStateId === otherStateId) return 0;
      const entry = compiled[ownerStateId];
      if (!entry) return 0;
      const tier1 = entry.byStateAndGood.get(otherStateId)?.get(goodId);
      if (tier1 !== undefined) return tier1;
      const tier2 = entry.byStateAllGoods.get(otherStateId);
      if (tier2 !== undefined) return tier2;
      const tier3 = entry.allStatesByGood.get(goodId);
      if (tier3 !== undefined) return tier3;
      if (entry.allStatesAllGoods !== undefined) return entry.allStatesAllGoods;
      return 0;
    };
  }

  /** Per-unit taxes on a good moving between markets: the exporter's sales tax and the importer's tariff. Null under an embargo */
  getTradeTerms(): TradeTerms {
    const resolveTariff = this.compileTariffs();
    const pairs: (TradePair | null)[][] = []; // by exporter then importer id, filled on first use

    const buildPair = (exporter: Market, importer: Market): TradePair | null => {
      const exporterCenter = pack.burgs[exporter.centerBurgId];
      const importerCenter = pack.burgs[importer.centerBurgId];
      if (!exporterCenter || !importerCenter) return null;
      return {
        taxRate: States.getSalesTax(exporterCenter),
        exporterStateId: exporterCenter.state || 0,
        importerStateId: importerCenter.state || 0,
        tariffs: []
      };
    };

    const resolvePolicy = (pair: TradePair, goodId: number): TariffRate => {
      const importerPolicy = resolveTariff(pair.importerStateId, pair.exporterStateId, goodId);
      const exporterPolicy = resolveTariff(pair.exporterStateId, pair.importerStateId, goodId);
      return importerPolicy === "embargo" || exporterPolicy === "embargo" ? "embargo" : importerPolicy;
    };

    return (exporter, importer, good, price) => {
      pairs[exporter.i] ??= [];
      const row = pairs[exporter.i];
      if (row[importer.i] === undefined) row[importer.i] = buildPair(exporter, importer);
      const pair = row[importer.i];
      if (!pair) return null;

      let tariffRate: TariffRate = 0;
      if (pair.exporterStateId !== pair.importerStateId) {
        pair.tariffs[good.i] ??= resolvePolicy(pair, good.i);
        tariffRate = pair.tariffs[good.i];
        if (tariffRate === "embargo") return null;
      }

      return {
        taxPerUnit: pair.taxRate * price,
        tariffPerUnit: tariffRate * price
      };
    };
  }

  /** The market a good reaches the burg cheapest from, with its stock and the burg's buy price */
  quoteImport(burg: Burg, good: Good, terms: TradeTerms): ImportQuote | null {
    const market = this.get(burg.market);
    if (!market) return null;

    let best: ImportQuote | null = null;
    for (const source of pack.markets) {
      const row = source.goods[good.i];
      if (source === market || !row || row.stock <= 0.01) continue;
      const transport = this.getTransport(source, burg, good);
      const basePrice = this.customerBuyPrice(row.price);
      if (transport === Infinity || (best && basePrice + transport >= best.buyPrice)) continue; // taxes only add to it
      const costs = terms(source, market, good, row.price);
      if (!costs) continue;
      const buyPrice = rn(basePrice + costs.taxPerUnit + costs.tariffPerUnit + transport, 2);
      if (!best || buyPrice < best.buyPrice) best = { source, stock: row.stock, buyPrice };
    }
    return best;
  }

  /** Price with the margin, the source's sales tax, the tariff and the carriage from the source's center to the burg; null when it cannot come */
  private getImportPrice(source: Market, market: Market, burg: Burg, good: Good, terms: TradeTerms): number | null {
    const price = source.goods[good.i]?.price ?? good.value;
    const costs = terms(source, market, good, price);
    const transport = this.getTransport(source, burg, good);
    if (!costs || transport === Infinity) return null;
    return rn(this.customerBuyPrice(price) + costs.taxPerUnit + costs.tariffPerUnit + transport, 2);
  }

  /** The burg buys a good from another market, paying taxes, margin and carriage */
  importForBurg({
    burg,
    source,
    good,
    units,
    kind,
    terms,
    budget = Infinity
  }: {
    burg: Burg;
    source: Market;
    good: Good;
    units: number;
    kind: DealKind;
    terms: TradeTerms;
    budget?: number;
  }): Trade | null {
    const market = this.get(burg.market);
    const row = source.goods[good.i];
    if (!market || !row) return null;

    const costs = terms(source, market, good, row.price);
    const price = this.getImportPrice(source, market, burg, good, terms);
    if (!costs || price === null) return null;

    const actualUnits = rn(Math.min(units, row.stock, affordable(budget, price)), 2);
    if (actualUnits < 0.01) return null;

    const trade = {
      units: actualUnits,
      price,
      tax: rn(costs.taxPerUnit * actualUnits, 2),
      tariff: rn(costs.tariffPerUnit * actualUnits, 2),
      carriage: rn(this.getTransport(source, burg, good), 2)
    };
    this.recordDeal(burg.i!, source.i, good.i, kind, trade);

    row.price = rn(this.applyMarketPressure(good.value, row.price, actualUnits), 2);
    row.stock = rn(row.stock - actualUnits, 2);
    return trade;
  }

  customerBuyPrice(midPrice: number): number {
    return rn(midPrice * (1 + MARKET_MARGIN), 2);
  }

  customerSellPrice(midPrice: number): number {
    return rn(midPrice * (1 - MARKET_MARGIN), 2);
  }

  private applyMarketPressure(basePrice: number, currentPrice: number | undefined, units: number): number {
    const price = currentPrice ?? basePrice;
    const floor = basePrice * PRICE_FLOOR_FACTOR;
    const ceiling = basePrice * PRICE_CEILING_FACTOR;
    return minmax(floor, price + units * basePrice * MARKET_PRESSURE_FACTOR, ceiling);
  }

  private collectConsumerDemand(goods: Good[]): number[] {
    const totalCoverageByCategory = Object.fromEntries(
      DEMAND_PRIORITY.map(category => [
        category,
        goods.reduce((sum, g) => sum + (g?.demandCoverage?.[category] || 0), 0) || 1
      ])
    ) as Record<DemandCategory, number>;

    const demandFactor: number[] = [];
    for (const good of goods) {
      demandFactor[good.i] = DEMAND_PRIORITY.reduce((sum, category) => {
        const share = (good?.demandCoverage?.[category] || 0) / (totalCoverageByCategory[category] || 1);
        return sum + share * DEMAND_TARGET_FACTORS[category];
      }, 0);
    }
    return demandFactor;
  }

  private collectIndustrialDemand(goods: Good[], consumerDemandFactors: number[]): number[] {
    // Per-capita demand for ingredients driven by consumer demand for their manufactured outputs.
    const demandFactor: number[] = [];
    for (const good of goods) {
      if (!good.recipes?.length) continue;
      const outputDemand = consumerDemandFactors[good.i] || 0;
      for (const recipe of good.recipes) {
        for (const [ingredientIdStr, amount] of Object.entries(recipe)) {
          const ingredientId = +ingredientIdStr;
          demandFactor[ingredientId] = (demandFactor[ingredientId] || 0) + amount * outputDemand;
        }
      }
    }
    return demandFactor;
  }

  private calculateAverageBaseCostByGood(goods: Good[]): number[] {
    const avgBaseCostByGood = new Array(goods.length);
    for (const good of goods) {
      if (!good.recipes?.length) continue;
      let totalBaseCost = 0;
      for (const recipe of good.recipes) {
        for (const [ingIdStr, amount] of Object.entries(recipe)) {
          const ing = Goods.get(+ingIdStr);
          if (ing) totalBaseCost += amount * ing.value;
        }
      }
      avgBaseCostByGood[good.i] = totalBaseCost / good.recipes.length;
    }
    return avgBaseCostByGood;
  }

  private calculatePopulationByMarket(): number[] {
    const populationByMarket: number[] = [];
    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed || !burg.market || !burg.population) continue;
      if (!populationByMarket[burg.market]) populationByMarket[burg.market] = 0;
      populationByMarket[burg.market] += burg.population;
    }
    return populationByMarket;
  }
}

export const Markets = new MarketsModule();
