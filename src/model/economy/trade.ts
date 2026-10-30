// The economy's trading: market prices, burgs buying and selling, carriage, taxes, tariffs and margins, summed in deals

import type { Burg } from "@/model/political/burgs-generator";
import { States } from "@/model/political/states-generator";
import { getDecima } from "@/model/units";
import { minmax, rn } from "@/utils/number-utils";
import type { DemandCategory, Good } from "./goods-generator";
import {
  DEMAND_PRIORITY,
  DEMAND_TARGET_FACTORS,
  Goods,
  getVarietyShares,
  SAVINGS_RATE,
  WANT_LIMITS,
  WANT_SHARES
} from "./goods-generator";
import { MARKET_FEE_DETERRENCE, type Market, Markets } from "./markets-generator";
import { Production } from "./production-generator";
import { TradeRoutes } from "./trade-routes";

const PRICE_FLOOR_FACTOR = 0.02;
const PRICE_CEILING_FACTOR = 5.0;
export const PRICE_RESPONSE = 0.74; // a trade of a day's expected sales moves the price e^this times
const WANTS_ESTIMATE = 1.5; // expected sales: what people buy beyond their needs, as a multiple of them
const OPENING_ELASTICITY = 0.08; // how far below its value an ingredient opens where its trades need less than a unit a day
export const MARKET_MARGIN = 0.035; // a market's margin before its license fee raises it
const MAX_DECIMAS = 10; // the map's diagonal: the most carriage, paid with no route to the burg's own market
export const MIN_LOCAL_STOCK = 1; // a buyer buys at its own market while it stocks this much, otherwise from the cheapest market
export const IMPORT_CARRIAGE_FACTOR = 2; // carriage from another state's market: borders, tolls, longer hauls

type Carriage = { decimas: Float64Array; factors: Float64Array }; // from every market to a burg, by market id

/** Trade between two different states; neutral lands are no state, so trade with them is never an import: no tariff, embargo or import carriage */
const isForeign = (stateA: number, stateB: number) => Boolean(stateA && stateB && stateA !== stateB);

/** Units the budget pays for at the price, rounded down to the hundredth so the cost stays within it */
const affordable = (budget: number, price: number) => Math.floor((budget / price) * 100 + 1e-6) / 100;

/** A market's day: how much of each good it expects to sell, how much of its stock is rural produce, and its rural people's money */
type MarketDay = {
  depth: number[];
  rural: number[];
  ruralPeople: number;
  cash: number;
  income: number;
  spent: number;
  margin: number;
  covered: number[];
  bought: number[];
  pollTaxDue: number[]; // by the state of the rural people's cells
  pollTaxShare?: number; // the share of it they pay, settled before the day's last orders
};

export const DEAL_KINDS = { sale: 0, input: 1, demand: 2, kept: 3, order: 4 } as const; // an order is a state's purchase, the burg its seat
export type DealKind = (typeof DEAL_KINDS)[keyof typeof DEAL_KINDS];

/** A burg's trade with a market in one good and kind, summed over the run; its id is its index in pack.deals */
export type Deal = [
  burg: number,
  market: number,
  good: number,
  kind: DealKind,
  units: number,
  price: number, // average per unit
  tax: number, // sales tax: the burg's on a sale, the selling market's on a purchase
  tariff: number, // the importer's, on an import
  carriage: number // average per unit: cost of carrying the goods between the market's center and the burg, in the price
];

/** One trade's amounts: price and carriage per unit, tax and tariff in total */
export type Transaction = { units: number; price: number; tax: number; tariff?: number; carriage?: number };

type TariffRate = number | "embargo";
type TradeCosts = { taxPerUnit: number; tariffPerUnit: number };
type TradePair = {
  taxRate: number;
  exporterStateId: number;
  importerStateId: number;
  tariffs: TariffRate[]; // by good
};
export type TradeTerms = (source: Market, market: Market, good: Good, price: number) => TradeCosts | null;
export type SourceQuote = { source: Market; stock: number; buyPrice: number };
/** A market as a source of a good for a burg, at the burg's door, or why it cannot sell it there */
export type SourceOption = {
  market: number;
  stock: number;
  price: number; // with the margin
  tax: number;
  tariff: number;
  carriage: number;
  buyPrice: number;
  isImport: boolean; // from another state than the burg's market: a tariff applies, even a zero one
  excluded?: "stock" | "route" | "embargo";
};

export class TradeModule {
  private dealIds = new Map<string, number>(); // burg-market-good-kind -> deal index, for summing trades
  private dealIdsSource: Deal[] | null = null;
  private routeCosts: Float32Array[] | null = null; // by market then burg id, in map units
  private routeCostsSource: unknown[] = []; // the route links, markets, their revision and burg count they were measured on
  private decima = 0; // a tenth of the map's diagonal, kept with the routes
  private days: MarketDay[] = []; // by market, for the economy run
  private taxes: number[] = []; // by state: sales tax and tariffs collected so far in the economy run
  private carriage: Map<number, Carriage> | null = null; // by burg, for the economy run
  private marginRates = new Map<number, number>(); // by license fee paid

  /** The countryside brings its produce to its market; it is paid as the produce is bought */
  collectRuralProduction(output = Production.getRuralOutput()): void {
    this.days = [];
    this.taxes = [];
    for (const market of pack.markets)
      this.days[market.i] = {
        depth: [],
        rural: [],
        ruralPeople: 0,
        cash: 0,
        income: 0,
        spent: 0,
        margin: 0,
        covered: [],
        bought: [],
        pollTaxDue: []
      };

    for (const cellId of pack.cells.i) {
      const market = Markets.get(pack.cells.market[cellId]);
      if (!market) continue;
      const day = this.days[market.i];
      const people = pack.cells.pop[cellId] || 0;
      day.ruralPeople += people;
      const stateId = pack.cells.state[cellId];
      day.pollTaxDue[stateId] = (day.pollTaxDue[stateId] || 0) + States.getPollTaxDue(stateId, people);

      for (const [goodId, amount] of Object.entries(output[cellId])) {
        const good = Goods.get(+goodId);
        if (!good) continue;
        const marketGood = this.getMarketGood(market, good);
        marketGood.stock = rn(marketGood.stock + amount, 2);
        day.rural[good.i] = (day.rural[good.i] || 0) + amount;
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

  /** Each market expects to sell a day's demand of its people and trades; an ingredient its trades need less than a unit of a day opens below its value */
  initializeMarketPrices(): void {
    const demandFactors = this.collectDemand(pack.goods);
    const populationByMarket = this.calculatePopulationByMarket();

    for (const market of pack.markets) {
      const day = this.days[market.i];
      if (!day) continue;
      const people = (populationByMarket[market.i] || 0) + day.ruralPeople;
      for (const good of pack.goods) {
        const expected = people * (demandFactors[good.i] || 0);
        day.depth[good.i] = Math.max(1, expected);
        const coversNeeds = Object.keys(good.demandCoverage ?? {}).length > 0;
        const price = coversNeeds ? good.value : good.value * Math.min(1, expected) ** OPENING_ELASTICITY;
        this.getMarketGood(market, good).price = Math.max(price, good.value * PRICE_FLOOR_FACTOR);
      }
    }
  }

  /** A trade of a day's expected sales moves the price e^PRICE_RESPONSE times: up on buying, down on selling. Unrounded until the run ends, so small trades add up */
  private movePrice(market: Market, good: Good, units: number) {
    const depth = this.days[market.i]?.depth[good.i];
    if (!depth) return; // outside an economy run the price stays
    const marketGood = this.getMarketGood(market, good);
    const price = marketGood.price * Math.exp((PRICE_RESPONSE * units) / depth);
    marketGood.price = minmax(price, good.value * PRICE_FLOOR_FACTOR, good.value * PRICE_CEILING_FACTOR);
  }

  /** Buyers turned away for lack of stock raise the price as if they had bought */
  signalShortage(market: Market, good: Good, units: number) {
    if (units > 0.01) this.movePrice(market, good, units);
  }

  /** Units taken from the market's stock: the share that is rural produce pays the market's rural people, less the margin its center takes */
  private takeStock(market: Market, good: Good, units: number) {
    const marketGood = this.getMarketGood(market, good);
    const day = this.days[market.i];
    if (day && marketGood.stock > 0) {
      const fromRural = Math.min(day.rural[good.i] || 0, (units * (day.rural[good.i] || 0)) / marketGood.stock);
      if (fromRural > 0) {
        day.rural[good.i] -= fromRural;
        const earned = fromRural * this.customerSellPrice(market, marketGood.price);
        day.cash += earned;
        day.income += earned;
        const margin = fromRural * marketGood.price * this.getMarginRate(market);
        this.payMarginAmount(market, margin);
        day.margin += margin;
      }
    }
    marketGood.stock = rn(Math.max(0, marketGood.stock - units), 2);
    this.movePrice(market, good, units);
  }

  /** The market's rural people spend what they earned, less savings and their poll tax, on goods at their market up to their wants */
  spendRural(market: Market) {
    const day = this.days[market.i];
    if (!day) return;
    const pollTax = day.pollTaxDue.reduce((total, due) => total + (due || 0), 0);
    const budget = Math.min(day.cash, Math.min((1 - SAVINGS_RATE) * day.income, day.income - pollTax) - day.spent);
    if (budget <= 0.01) return;
    DEMAND_PRIORITY.forEach((category, categoryIndex) => {
      let money = budget * WANT_SHARES[category];
      const room = (good: Good) =>
        (day.ruralPeople * DEMAND_TARGET_FACTORS[category] * WANT_LIMITS[category] -
          (day.covered[categoryIndex] || 0)) /
        good.demandCoverage![category]!;
      const options = pack.goods
        .filter(good => good.demandCoverage?.[category])
        .map(good => ({
          good,
          price: this.customerBuyPrice(market, this.getMarketGood(market, good).price)
        }));
      const purchase = (good: Good, spend: number) => {
        const price = this.customerBuyPrice(market, market.goods[good.i].price); // earlier purchases moved it
        const units = Math.min(market.goods[good.i].stock, spend / price, room(good));
        if (spend <= 0.01 || units < 0.01) return;
        const cost = units * price;
        money -= cost;
        day.cash -= cost;
        day.spent += cost;
        day.bought[good.i] = (day.bought[good.i] || 0) + units;
        for (const [other, share] of Object.entries(good.demandCoverage!)) {
          const i = DEMAND_PRIORITY.indexOf(other as DemandCategory);
          day.covered[i] = (day.covered[i] || 0) + units * (share || 0);
        }
        const margin = units * market.goods[good.i].price * this.getMarginRate(market);
        this.payMarginAmount(market, margin);
        day.margin += margin;
        this.takeStock(market, good, units);
      };
      // spread over every good covering the need, cheaper ones getting more; goods out of stock turn them away, raising their price
      const shares = getVarietyShares(options.map(({ good, price }) => price / good.demandCoverage![category]!));
      const total = money;
      options.forEach(({ good, price }, k) => {
        const spend = Math.min(money, total * shares[k]);
        if (market.goods[good.i].stock > 0.01) purchase(good, spend);
        else this.signalShortage(market, good, Math.min(spend / price, room(good)));
      });
      const stocked = options
        .filter(({ good }) => market.goods[good.i].stock > 0.01)
        .sort((a, b) => a.price / a.good.demandCoverage![category]! - b.price / b.good.demandCoverage![category]!);
      for (const { good } of stocked) {
        if (money <= 0.01) break;
        purchase(good, money);
      }
    });
  }

  /** The share of their poll tax rural people can pay from what they kept */
  private getPollTaxShare(day: MarketDay): number {
    const due = day.pollTaxDue.reduce((total, amount) => total + (amount || 0), 0);
    return due > 0 ? Math.min(1, Math.max(0, day.cash) / due) : 0;
  }

  /** Rural people pay their poll tax from what they kept before the day's last orders, so the states spend what they get; returns it by state */
  settleRuralPollTax(): number[] {
    const paid: number[] = [];
    for (const market of pack.markets) {
      const day = this.days[market.i];
      if (!day) continue;
      const share = this.getPollTaxShare(day);
      day.pollTaxShare = share;
      day.pollTaxDue.forEach((owed, stateId) => {
        if (owed) paid[stateId] = (paid[stateId] || 0) + owed * share;
      });
    }
    return paid;
  }

  /** The market where a unit of the good sells for the most at the burg's door, after carriage and the importer's tariff; none under an embargo */
  getOutlet(burg: Burg, good: Good, terms = this.getTradeTerms()): { market: Market; price: number } | null {
    const carriage = this.getCarriage(burg);
    const own = Markets.ofBurg(burg);
    let best: Market | null = null;
    let bestPrice = -Infinity;
    for (const market of pack.markets) {
      const transport = this.carry(carriage, market, good);
      if (transport === Infinity) continue;
      const midPrice = this.getMarketGood(market, good).price;
      const tariff = this.getSaleTariff(own, market, good, midPrice, terms);
      if (tariff === null) continue;
      const price = this.customerSellPrice(market, midPrice) - transport - tariff;
      if (!best || price > bestPrice) [best, bestPrice] = [market, price];
    }
    return best && { market: best, price: bestPrice };
  }

  /** Per-unit tariff another state's market levies on a burg's sale, as on goods from the burg's own market; null under an embargo */
  private getSaleTariff(own: Market | undefined, market: Market, good: Good, price: number, terms: TradeTerms) {
    if (!own || own === market) return 0;
    return terms(own, market, good, price)?.tariffPerUnit ?? null;
  }

  /** Prices at the burg's door: buying adds the market's sales tax and the carriage, selling pays the carriage */
  quoteMarket(market: Market, goodId: number, burg: Burg): { stock: number; buyPrice: number; sellPrice: number } {
    const good = Goods.get(goodId);
    if (!good) return { stock: 0, buyPrice: 0, sellPrice: 0 };
    const row = this.getMarketGood(market, good);
    const carriage = this.getTransport(market, burg, good);
    return {
      stock: row.stock,
      buyPrice: this.priceAtDoor(
        this.customerBuyPrice(market, row.price),
        this.getSalesTaxPerUnit(market, row.price),
        0,
        carriage
      ),
      sellPrice: rn(Math.max(0, this.customerSellPrice(market, row.price) - carriage), 2)
    };
  }

  /** What a unit costs the burg at its door: the price with the margin, the taxes and the carriage */
  private priceAtDoor(withMargin: number, tax: number, tariff: number, carriage: number): number {
    return rn(withMargin + tax + tariff + carriage, 2);
  }

  /** Measures the route network from every market's center, for the economy run to price carriage */
  measureRoutes(): void {
    this.routeCosts = null;
    this.getRouteCosts();
    this.carriage = new Map();
  }

  /** Route costs from every market's center, measured again once routes, markets or burgs change */
  private getRouteCosts(): Float32Array[] {
    const source = [pack.cells.routes, pack.markets, Markets.revision, pack.burgs.length];
    if (!this.routeCosts || source.some((value, index) => value !== this.routeCostsSource[index])) {
      this.routeCosts = TradeRoutes.measure();
      this.routeCostsSource = source;
      this.decima = getDecima() || 1;
    }
    return this.routeCosts;
  }

  /** Ends the run: prices are rounded, each market keeps its rural day, with the poll tax its people paid, for the views */
  endRun(): void {
    for (const market of pack.markets) {
      for (const marketGood of Object.values(market.goods)) marketGood.price = rn(marketGood.price, 2);
      const day = this.days[market.i];
      if (!day) continue;
      const bought = day.bought.flatMap((units, goodId) => (units ? [[goodId, rn(units, 2)] as [number, number]] : []));
      const share = day.pollTaxShare ?? this.getPollTaxShare(day);
      const pollTax = day.pollTaxDue.flatMap((owed, stateId) =>
        owed ? [[stateId, rn(owed, 2), rn(owed * share, 2)] as [number, number, number]] : []
      );
      market.rural = {
        earned: rn(day.income, 2),
        spent: rn(day.spent, 2),
        bought,
        margin: rn(day.margin, 2)
      };
      if (pollTax.length) market.rural.pollTax = pollTax;
    }
    this.carriage = null;
  }

  /** Decimas a good is carried between the market's center and the burg along routes; Infinity with no route to another market */
  getDecimas(market: Market, burg: Burg): number {
    if (burg.i === market.centerBurgId) return 0;
    const distance = this.getRouteCosts()[market.i]?.[burg.i!] ?? Infinity;
    if (distance === Infinity && market !== Markets.ofBurg(burg)) return Infinity;
    return Math.min(distance / this.decima, MAX_DECIMAS);
  }

  /** Per-unit cost of carrying a good between the market's center and the burg, dearer from another state's market; Infinity with no route to another market */
  getTransport(market: Market, burg: Burg, good: Good): number {
    return this.carry(this.getCarriage(burg), market, good);
  }

  private carry({ decimas, factors }: Carriage, market: Market, good: Good): number {
    const distance = decimas[market.i];
    return distance === Infinity ? Infinity : distance * good.carriage * factors[market.i];
  }

  /** Decimas and carriage factors from every market to the burg, kept for the rest of an economy run */
  private getCarriage(burg: Burg): Carriage {
    const cached = this.carriage?.get(burg.i!);
    if (cached) return cached;
    const size = pack.markets.reduce((max, market) => Math.max(max, market.i + 1), 0);
    const decimas = new Float64Array(size).fill(Infinity);
    const factors = new Float64Array(size);
    for (const market of pack.markets) {
      decimas[market.i] = this.getDecimas(market, burg);
      factors[market.i] = this.getCarriageFactor(market, burg);
    }
    const carriage = { decimas, factors };
    this.carriage?.set(burg.i!, carriage);
    return carriage;
  }

  /** Carriage from another state's market costs more */
  getCarriageFactor(market: Market, burg: Burg): number {
    return this.isImportFor(market, burg) ? IMPORT_CARRIAGE_FACTOR : 1;
  }

  private isImportFor(market: Market, burg: Burg): boolean {
    const own = Markets.ofBurg(burg);
    return Boolean(own && own !== market && isForeign(Markets.getState(market), Markets.getState(own)));
  }

  /** The burg buys a good from a market, its own unless a source is given, paying the margin, the source's sales tax, the tariff and the carriage */
  buy({
    burg,
    good,
    units,
    kind,
    source = Markets.ofBurg(burg),
    terms = this.getTradeTerms(),
    budget = Infinity
  }: {
    burg: Burg;
    good: Good;
    units: number;
    kind: DealKind;
    source?: Market;
    terms?: TradeTerms;
    budget?: number;
  }): Transaction | null {
    const market = Markets.ofBurg(burg);
    const row = source?.goods[good.i];
    if (!market || !source || !row) return null;

    const costs = terms(source, market, good, row.price);
    const carriage = this.getTransport(source, burg, good);
    if (!costs || carriage === Infinity) return null;
    const withMargin = this.customerBuyPrice(source, row.price);
    const price = this.priceAtDoor(withMargin, costs.taxPerUnit, costs.tariffPerUnit, carriage);

    const actualUnits = rn(Math.min(units, row.stock, affordable(budget, price)), 2);
    if (actualUnits < 0.01) return null;

    const trade = {
      units: actualUnits,
      price,
      tax: rn(costs.taxPerUnit * actualUnits, 2),
      tariff: rn(costs.tariffPerUnit * actualUnits, 2),
      carriage: rn(carriage, 2)
    };
    this.recordDeal(burg.i!, source.i, good.i, kind, trade);
    this.payMargin(source, kind, trade);

    this.takeStock(source, good, actualUnits);
    return trade;
  }

  /** Where a buyer buys a good: its own market while it stocks enough, otherwise the cheapest other one finds, or what its own has left; null when none has any */
  getSupplier(own: Market, good: Good, cheapest: () => Market | undefined): Market | null {
    const local = own.goods[good.i]?.stock || 0;
    if (local >= MIN_LOCAL_STOCK) return own;
    return cheapest() ?? (local > 0.01 ? own : null);
  }

  /** Sales tax the market's state levies per unit sold at the price */
  private getSalesTaxPerUnit(market: Market, price: number): number {
    return States.getSalesTax(pack.burgs[market.centerBurgId]) * price;
  }

  /** Units the burg sold to its own market this run and can still take back, at what the sale earned it per unit; the rural produce in stock is not its own */
  quoteKeep(burg: Burg, good: Good): { units: number; price: number } | null {
    const market = Markets.ofBurg(burg);
    const sale = market && this.findDeal(burg.i!, market.i, good.i, DEAL_KINDS.sale);
    if (!market || !sale) return null;

    const rural = this.days[market.i]?.rural[good.i] || 0;
    const units = Math.min(sale[4], this.getMarketGood(market, good).stock - rural);
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
  }): Transaction | null {
    const market = Markets.ofBurg(burg);
    const quote = this.quoteKeep(burg, good);
    if (!market || !quote) return null;

    const kept = rn(Math.min(units, quote.units, affordable(budget, quote.price)), 2);
    if (kept < 0.01) return null;

    const sale = this.findDeal(burg.i!, market.i, good.i, DEAL_KINDS.sale)!;
    this.payMargin(market, DEAL_KINDS.sale, { units: -kept, price: sale[5], tax: 0, carriage: sale[8] }); // undone with the sale
    const tax = rn(sale[6] * (1 - kept / sale[4]), 2);
    this.creditTaxes(sale, tax - sale[6], 0);
    sale[6] = tax;
    sale[4] = rn(sale[4] - kept, 2);
    this.recordDeal(burg.i!, market.i, good.i, DEAL_KINDS.kept, { units: kept, price: 0, tax: 0 });

    const marketGood = this.getMarketGood(market, good);
    marketGood.stock = rn(Math.max(0, marketGood.stock - kept), 2);
    this.movePrice(market, good, kept);
    return { units: kept, price: rn(quote.price, 2), tax: 0 };
  }

  /** The burg sells to a market, its own unless another is given; another state's market levies its tariff, off the revenue as the sales tax. Null under an embargo */
  sell({
    burg,
    good,
    units,
    taxRate,
    market = Markets.ofBurg(burg),
    terms = this.getTradeTerms()
  }: {
    burg: Burg;
    good: Good;
    units: number;
    taxRate: number;
    market?: Market;
    terms?: TradeTerms;
  }): Transaction | null {
    if (!market || units <= 0) return null;

    const marketGood = this.getMarketGood(market, good);
    const tariff = this.getSaleTariff(Markets.ofBurg(burg), market, good, marketGood.price, terms);
    if (tariff === null) return null;
    const grossPrice = this.customerSellPrice(market, marketGood.price);
    const transport = Math.min(this.getTransport(market, burg, good), grossPrice);
    const price = rn(grossPrice - transport, 2);
    const tax = rn(units * price * taxRate, 2);
    const trade = { units: rn(units, 2), price, tax, tariff: rn(units * tariff, 2), carriage: rn(transport, 2) };
    this.recordDeal(burg.i!, market.i, good.i, DEAL_KINDS.sale, trade);
    this.payMargin(market, DEAL_KINDS.sale, trade);

    marketGood.stock = rn(marketGood.stock + units, 2);
    this.movePrice(market, good, -units);
    return trade;
  }

  /** Adds a trade to the burg's deal with the market in the good and kind */
  recordDeal(burgId: number, marketId: number, goodId: number, kind: DealKind, trade: Transaction) {
    const { tariff = 0, carriage = 0 } = trade;
    const deal = this.findDeal(burgId, marketId, goodId, kind);
    if (!deal) {
      this.dealIds.set(`${burgId}-${marketId}-${goodId}-${kind}`, pack.deals.length);
      const added: Deal = [burgId, marketId, goodId, kind, trade.units, trade.price, trade.tax, tariff, carriage];
      pack.deals.push(added);
      this.creditTaxes(added, trade.tax, tariff);
      return;
    }
    this.creditTaxes(deal, trade.tax, tariff);

    const units = deal[4] + trade.units;
    deal[5] = rn((deal[4] * deal[5] + trade.units * trade.price) / units, 2);
    deal[8] = rn((deal[4] * deal[8] + trade.units * carriage) / units, 2);
    deal[4] = rn(units, 2);
    deal[6] = rn(deal[6] + trade.tax, 2);
    deal[7] = rn(deal[7] + tariff, 2);
  }

  /** The states' taxes so far in the run, which they spend as they come */
  private creditTaxes(deal: Deal, tax: number, tariff: number) {
    if (!tax && !tariff) return;
    const { taxState, tariffState } = this.getTaxStates(deal);
    if (tax) this.taxes[taxState] = (this.taxes[taxState] || 0) + tax;
    if (tariff) this.taxes[tariffState] = (this.taxes[tariffState] || 0) + tariff;
  }

  /** Sales tax and tariffs the state collected so far in the economy run */
  getTaxesSoFar(stateId: number): number {
    return this.taxes[stateId] || 0;
  }

  private findDeal(burgId: number, marketId: number, goodId: number, kind: DealKind): Deal | undefined {
    if (this.dealIdsSource !== pack.deals) {
      this.dealIds = new Map(pack.deals.map(([b, m, g, k], i) => [`${b}-${m}-${g}-${k}`, i]));
      this.dealIdsSource = pack.deals;
    }
    const id = this.dealIds.get(`${burgId}-${marketId}-${goodId}-${kind}`);
    return id === undefined ? undefined : pack.deals[id];
  }

  /**
   * The deal's money to its market: what a burg pays for goods, carriage included, less the taxes and tariff the
   * market passes to the states; minus what the market pays a burg for its goods. Goods a burg kept never reach it
   */
  getMarketIncome(deal: Deal): number {
    const [, , , kind, units, price, tax, tariff] = deal;
    if (kind === DEAL_KINDS.kept) return 0;
    const margin = this.getMargin(deal); // the center burg's, not the market's
    if (kind === DEAL_KINDS.sale) return -units * price - margin;
    return units * price - tax - tariff - margin;
  }

  /** The market margin on the deal, earned by the center burg of the deal's market */
  getMargin([, marketId, , kind, units, price, tax, tariff, carriage]: Deal): number {
    return this.marginOf(Markets.get(marketId), kind, { units, price, tax, tariff, carriage });
  }

  /** The share a market buys below and sells above its price, in whole percents: the base margin, raised by the license fee its center paid */
  getMarginRate(market?: Market): number {
    const fee = market?.feePaid || 0;
    let rate = this.marginRates.get(fee);
    if (rate === undefined) {
      rate = Math.round(MARKET_MARGIN * Math.sqrt(1 + fee / MARKET_FEE_DETERRENCE) * 100) / 100;
      this.marginRates.set(fee, rate);
    }
    return rate;
  }

  /** The margin in a trade: the market's spread between its own price and the price it buys or sells at, before taxes and carriage */
  private marginOf(
    market: Market | undefined,
    kind: DealKind,
    { units, price, tax, tariff = 0, carriage = 0 }: Transaction
  ): number {
    if (kind === DEAL_KINDS.kept || !units) return 0;
    const rate = this.getMarginRate(market);
    if (kind === DEAL_KINDS.sale) return (units * (price + carriage) * rate) / (1 - rate);
    const marketPrice = price - (tax + tariff) / units - carriage;
    return (units * marketPrice * rate) / (1 + rate);
  }

  /** The center burg's merchants take the margin as the trade happens, so the hub can spend it the same day */
  private payMargin(market: Market, kind: DealKind, trade: Transaction): void {
    this.payMarginAmount(market, this.marginOf(market, kind, trade));
  }

  private payMarginAmount(market: Market, amount: number): void {
    const center = pack.burgs[market.centerBurgId];
    if (!center?.i || center.removed) return;
    center.treasury = rn((center.treasury || 0) + amount, 2);
  }

  /** An import is trade between the burg's own market and a market of another state, either way: only an import may pay a tariff */
  isImport(deal: Deal): boolean {
    const { own, market } = this.getMarketStates(deal);
    return isForeign(own, market);
  }

  /** The states of the burg's own market and of the deal's market */
  private getMarketStates([burgId, marketId]: Deal): { own: number; market: number } {
    const burg = pack.burgs[burgId];
    return { own: Markets.getState(burg && Markets.ofBurg(burg)), market: Markets.getState(Markets.get(marketId)) };
  }

  /** States the deal's sales tax and tariff go to: the seller's, and the importer's: the deal's market on a sale, the burg's own market on a purchase */
  getTaxStates(deal: Deal): { taxState: number; tariffState: number } {
    const kind = deal[3];
    const { own, market } = this.getMarketStates(deal);
    return kind === DEAL_KINDS.sale
      ? { taxState: pack.burgs[deal[0]]?.state || 0, tariffState: market }
      : { taxState: market, tariffState: own };
  }

  /** The rate of the deal's tariff: the importer's on goods from the other market's state */
  getDealTariffRate(deal: Deal): number {
    const { own, market } = this.getMarketStates(deal);
    return deal[3] === DEAL_KINDS.sale
      ? this.getTariffRate(market, own, deal[2])
      : this.getTariffRate(own, market, deal[2]);
  }

  /** Sales tax and tariffs of the run's deals, by the state collecting them */
  getTaxesByState(): { salesTax: number[]; tariffs: number[] } {
    const salesTax: number[] = [];
    const tariffs: number[] = [];
    for (const deal of pack.deals ?? []) {
      const { taxState, tariffState } = this.getTaxStates(deal);
      if (deal[6]) salesTax[taxState] = (salesTax[taxState] || 0) + deal[6];
      if (deal[7]) tariffs[tariffState] = (tariffs[tariffState] || 0) + deal[7];
    }
    return { salesTax, tariffs };
  }

  /** The tariff rate the importer state levies on the good from the exporter state, 0 under an embargo */
  getTariffRate(importerStateId: number, exporterStateId: number, goodId: number): number {
    const rate = this.findTariff(importerStateId, exporterStateId, goodId);
    return rate === "embargo" ? 0 : rate;
  }

  /** The importer's most specific rule for the good from the exporter: state and good, state, good, then all; an embargo wins a tie */
  private findTariff(importerStateId: number, exporterStateId: number, goodId: number): TariffRate {
    const importer = pack.states[importerStateId];
    if (!isForeign(importerStateId, exporterStateId) || !importer || importer.removed) return 0;
    let rate: TariffRate = 0;
    let rank = -1;
    for (const { states, goods, rate: ruleRate } of importer.economy.tariffs) {
      if (states !== "all" && !states.includes(exporterStateId)) continue;
      if (goods !== "all" && !goods.includes(goodId)) continue;
      const ruleRank = (states === "all" ? 0 : 2) + (goods === "all" ? 0 : 1);
      if (ruleRank < rank || (ruleRank === rank && rate === "embargo")) continue;
      rate = ruleRate;
      rank = ruleRank;
    }
    return rate;
  }

  /** Per-unit taxes on a good bought from a source market for a burg of another market: the source's sales tax and, from another state, the importer's tariff. Null under an embargo */
  getTradeTerms(): TradeTerms {
    const pairs: (TradePair | null)[][] = []; // by source then buyer's market id, filled on first use

    const buildPair = (source: Market, market: Market): TradePair | null => {
      const sourceCenter = pack.burgs[source.centerBurgId];
      const marketCenter = pack.burgs[market.centerBurgId];
      if (!sourceCenter || !marketCenter) return null;
      return {
        taxRate: States.getSalesTax(sourceCenter),
        exporterStateId: sourceCenter.state || 0,
        importerStateId: marketCenter.state || 0,
        tariffs: []
      };
    };

    const resolvePolicy = (pair: TradePair, goodId: number): TariffRate => {
      const importerPolicy = this.findTariff(pair.importerStateId, pair.exporterStateId, goodId);
      const exporterPolicy = this.findTariff(pair.exporterStateId, pair.importerStateId, goodId);
      return importerPolicy === "embargo" || exporterPolicy === "embargo" ? "embargo" : importerPolicy;
    };

    return (source, market, good, price) => {
      pairs[source.i] ??= [];
      const row = pairs[source.i];
      if (row[market.i] === undefined) row[market.i] = buildPair(source, market);
      const pair = row[market.i];
      if (!pair) return null;

      let tariffRate: TariffRate = 0;
      if (isForeign(pair.exporterStateId, pair.importerStateId)) {
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

  /** Every market as a source of the good for the burg, cheapest first, then those that cannot sell it. Debug only: it prunes nothing */
  listSources(burg: Burg, good: Good, terms: TradeTerms): SourceOption[] {
    const own = Markets.ofBurg(burg);
    if (!own) return [];

    const options = pack.markets.map(source => {
      const row = source.goods[good.i];
      const stock = row?.stock ?? 0;
      const midPrice = row?.price ?? good.value;
      const carriage = this.getTransport(source, burg, good);
      const costs = terms(source, own, good, midPrice);
      const excluded = stock <= 0.01 ? "stock" : carriage === Infinity ? "route" : !costs ? "embargo" : undefined;
      const option: SourceOption = {
        market: source.i,
        stock: rn(stock, 2),
        price: this.customerBuyPrice(source, midPrice),
        tax: rn(costs?.taxPerUnit ?? 0, 2),
        tariff: rn(costs?.tariffPerUnit ?? 0, 2),
        isImport: isForeign(Markets.getState(source), Markets.getState(own)),
        carriage: carriage === Infinity ? 0 : rn(carriage, 2),
        buyPrice: 0
      };
      if (excluded) option.excluded = excluded;
      else option.buyPrice = this.priceAtDoor(option.price, costs!.taxPerUnit, costs!.tariffPerUnit, carriage);
      return option;
    });
    return options.sort((a, b) => Number(!!a.excluded) - Number(!!b.excluded) || a.buyPrice - b.buyPrice);
  }

  /** The market a good reaches the burg cheapest from, with its stock and the burg's buy price */
  quoteSource(burg: Burg, good: Good, terms: TradeTerms): SourceQuote | null {
    const market = Markets.ofBurg(burg);
    if (!market) return null;

    const carry = this.getCarriage(burg);
    let best: SourceQuote | null = null;
    for (const source of pack.markets) {
      const row = source.goods[good.i];
      if (source === market || !row || row.stock <= 0.01) continue;
      const carriage = this.carry(carry, source, good);
      if (carriage === Infinity) continue;
      const withMargin = this.customerBuyPrice(source, row.price);
      if (best && withMargin + carriage >= best.buyPrice) continue; // taxes only add to it
      const costs = terms(source, market, good, row.price);
      if (!costs) continue;
      const buyPrice = this.priceAtDoor(withMargin, costs.taxPerUnit, costs.tariffPerUnit, carriage);
      if (!best || buyPrice < best.buyPrice) best = { source, stock: row.stock, buyPrice };
    }
    return best;
  }

  customerBuyPrice(market: Market, midPrice: number): number {
    return rn(midPrice * (1 + this.getMarginRate(market)), 2);
  }

  customerSellPrice(market: Market, midPrice: number): number {
    return rn(midPrice * (1 - this.getMarginRate(market)), 2);
  }

  /** Units a person buys of each good a day: as buyers spread each need at base prices, plus what the trades making its products need */
  private collectDemand(goods: Good[]): number[] {
    const consumer: number[] = [];
    for (const category of DEMAND_PRIORITY) {
      const covering = goods.filter(good => good.demandCoverage?.[category]);
      const shares = getVarietyShares(covering.map(good => good.value / good.demandCoverage![category]!));
      covering.forEach((good, k) => {
        consumer[good.i] =
          (consumer[good.i] || 0) + (DEMAND_TARGET_FACTORS[category] * shares[k]) / good.demandCoverage![category]!;
      });
    }

    const users = new Map<number, [output: Good, amount: number][]>();
    for (const good of goods)
      for (const recipe of good.recipes || [])
        for (const [id, amount] of Object.entries(recipe)) {
          if (!users.has(+id)) users.set(+id, []);
          users.get(+id)!.push([good, amount / good.recipes!.length]);
        }

    const demand: number[] = [];
    const resolve = (good: Good, path: Set<number>): number => {
      if (demand[good.i] !== undefined) return demand[good.i];
      if (path.has(good.i)) return 0;
      path.add(good.i);
      let units = (consumer[good.i] || 0) * (1 + WANTS_ESTIMATE);
      for (const [output, amount] of users.get(good.i) || []) units += amount * resolve(output, path);
      path.delete(good.i);
      demand[good.i] = units;
      return units;
    };
    for (const good of goods) resolve(good, new Set());
    return demand;
  }

  private calculatePopulationByMarket(): number[] {
    const populationByMarket: number[] = [];
    for (const burg of pack.burgs) {
      const marketId = pack.cells.market[burg.cell];
      if (!burg.i || burg.removed || !marketId || !burg.population) continue;
      populationByMarket[marketId] = (populationByMarket[marketId] || 0) + burg.population;
    }
    return populationByMarket;
  }
}

export const Trade = new TradeModule();
