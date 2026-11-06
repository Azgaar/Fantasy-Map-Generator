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
export const PRICE_CURVE = 2; // exponent of the demand to supply ratio in a price
const WANTS_ESTIMATE = 0.93; // expected sales: what people buy beyond their needs, as a multiple of them
const OPENING_ELASTICITY = 0.21; // how far below its value an ingredient opens where its trades need less than a unit a day
export const MARKET_MARGIN = 0.035; // a market's margin before its license fee raises it
const MAX_MARKET_MARGIN = 0.5; // however dear the license: past 1 a market would sell for less than nothing
const MAX_DECIMAS = 10; // the map's diagonal: the most carriage, paid with no route to the burg's own market
export const MIN_LOCAL_STOCK = 1; // a buyer stays at its own market while it stocks this much
export const IMPORT_CARRIAGE_FACTOR = 2; // carriage from another state's market: borders, tolls, longer hauls

type Carriage = {
  decimas: Float64Array; // from every market to a burg, by market id
  factors: Float64Array;
  atDecimas: Float64Array; // as decimas and factors, by position in pack.markets
  atFactors: Float64Array;
  ownAt: number; // the position of the burg's own market, -1 without one
  nearestOther: number; // decimas to the nearest market not its own: no other market's carriage is less
  nearest?: Int32Array; // positions by distance to the burg, filled on first use
};
/** A good in every market, by position in pack.markets, with the orders the market scans walk */
type GoodBook = {
  rows: Market["goods"][number][];
  stocked: Uint8Array; // 1 where the market has more than MIN_STOCK
  stockedCount: number;
  sellPrices: Float64Array; // what the market pays for a unit, before carriage and tariff
  buyPrices: Float64Array; // what it asks for a unit, before taxes and carriage
  bySell: Int32Array; // positions, the best paying first
  byBuy: Int32Array; // positions, the cheapest first
  sellRanks: Int32Array; // each position's index in bySell
  buyRanks: Int32Array;
  revision: number; // bumped on every change to a market's row of the good
};
type RunIndex = { books: GoodBook[]; positions: number[] }; // books by good id, positions by market id
const MIN_STOCK = 0.01; // less is no stock to buy from

/** Moves a position to its place after its price moved, stepwise: a trade moves prices little */
const reorder = (order: Int32Array, ranks: Int32Array, prices: Float64Array, at: number, descending: boolean) => {
  const sign = descending ? -1 : 1;
  const key = prices[at] * sign;
  let i = ranks[at];
  const move = (to: number, from: number) => {
    order[to] = order[from];
    ranks[order[to]] = to;
  };
  for (; i > 0 && prices[order[i - 1]] * sign > key; i--) move(i, i - 1);
  for (; i < order.length - 1 && prices[order[i + 1]] * sign < key; i++) move(i, i + 1);
  order[i] = at;
  ranks[at] = i;
};

/** A deal's identity as one number: burg, market and good ids are 16 bits each, the kind 3 */
const dealKey = (burg: number, market: number, good: number, kind: number) =>
  burg * 2 ** 35 + market * 2 ** 19 + good * 8 + kind;

/** Trade between two states; neutral lands are no state: no tariff, embargo or import carriage */
const isForeign = (stateA: number, stateB: number) => Boolean(stateA && stateB && stateA !== stateB);

/** Units the budget pays for, rounded down to the hundredth so the cost stays within it */
const affordable = (budget: number, price: number) => Math.floor((budget / price) * 100 + 1e-6) / 100;

/** The average over t from 0 to x of (1 + t)^power */
const averageGrowth = (x: number, power: number) => {
  const raised = power + 1;
  return raised ? Math.expm1(raised * Math.log1p(x)) / (raised * x) : Math.log1p(x) / x;
};

/** A market's day: list prices, depth, demand and supply so far, rural stock share, rural money */
type MarketDay = {
  listPrice: number[];
  depth: number[];
  demand: number[];
  supply: number[];
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

/** A burg's trade with a market in one good and kind, summed over the run; id: pack.deals index */
export type Deal = [
  burg: number,
  market: number,
  good: number,
  kind: DealKind,
  units: number,
  price: number, // average per unit
  tax: number, // sales tax: the burg's on a sale, the selling market's on a purchase
  tariff: number, // the importer's, on an import
  carriage: number // average per unit, between the market's center and the burg, in the price
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
export type SourceQuote = { source: Market; stock: number; buyPrice: number; carriage: number };
export type Outlet = { market: Market; price: number; carriage: number };
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
  private dealIds = new Map<number, number>(); // dealKey -> deal index, for summing trades
  private dealIdsSource: Deal[] | null = null;
  private routeCosts: Float32Array[] | null = null; // by market then burg id, in map units
  private routeCostsSource: unknown[] = []; // the route links, markets, their revision and burg count they were measured on
  private decima = 0; // a tenth of the map's diagonal, kept with the routes
  private days: MarketDay[] = []; // by market, for the economy run
  private taxes: number[] = []; // by state: sales tax and tariffs collected so far in the economy run
  private carriage: Carriage[] | null = null; // by burg, for the economy run
  private run: RunIndex | null = null; // for the economy run
  private marginRates = new Map<number, number>(); // by license fee paid
  private licenseDue: number[] = []; // by market: what of its license its center has still to pay in the economy run

  collectRuralProduction(output = Production.getRuralOutput()): void {
    this.days = [];
    this.taxes = [];
    for (const market of pack.markets)
      this.days[market.i] = {
        listPrice: [],
        depth: [],
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

  initializeMarketPrices(): void {
    const demandFactors = this.collectDemand(options.map.goods);
    const populationByMarket = this.calculatePopulationByMarket();

    for (const market of pack.markets) {
      const day = this.days[market.i];
      if (!day) continue;
      const people = (populationByMarket[market.i] || 0) + day.ruralPeople;
      for (const good of options.map.goods) {
        const expected = people * (demandFactors[good.i] || 0);
        day.depth[good.i] = Math.max(1, expected);
        day.supply[good.i] = day.rural[good.i] || 0;
        const coversNeeds = Object.keys(good.demandCoverage ?? {}).length > 0;
        day.listPrice[good.i] = coversNeeds ? good.value : good.value * Math.min(1, expected) ** OPENING_ELASTICITY;
        this.getMarketGood(market, good).price = this.getBalancePrice(day, good);
      }
    }

    // the rows are only changed in place for the rest of the run, and fees are paid at dawn
    const run: RunIndex = { books: [], positions: [] };
    pack.markets.forEach((market, at) => {
      run.positions[market.i] = at;
    });
    for (const good of options.map.goods) run.books[good.i] = this.buildBook(good);
    this.run = run;
  }

  /** The good's book, kept up to date for the economy run, otherwise as it stands */
  private getBook(good: Good): GoodBook {
    return this.run?.books[good.i] ?? this.buildBook(good);
  }

  private buildBook(good: Good): GoodBook {
    const rows = pack.markets.map(market => this.getMarketGood(market, good));
    const sellPrices = Float64Array.from(rows, (row, at) => this.customerSellPrice(pack.markets[at], row.price));
    const buyPrices = Float64Array.from(rows, (row, at) => this.customerBuyPrice(pack.markets[at], row.price));
    const positions = rows.map((_row, at) => at);
    const bySell = Int32Array.from(positions).sort((a, b) => sellPrices[b] - sellPrices[a]);
    const byBuy = Int32Array.from(positions).sort((a, b) => buyPrices[a] - buyPrices[b]);
    const sellRanks = new Int32Array(rows.length);
    const buyRanks = new Int32Array(rows.length);
    bySell.forEach((at, rank) => {
      sellRanks[at] = rank;
    });
    byBuy.forEach((at, rank) => {
      buyRanks[at] = rank;
    });
    const stocked = Uint8Array.from(rows, row => Number(row.stock > MIN_STOCK));
    const stockedCount = stocked.reduce((count, flag) => count + flag, 0);
    return { rows, stocked, stockedCount, sellPrices, buyPrices, bySell, byBuy, sellRanks, buyRanks, revision: 0 };
  }

  /** Changes with the good's market rows, so a quote can tell it is stale; NaN outside a run */
  getRevision(good: Good): number {
    return this.run?.books[good.i].revision ?? NaN;
  }

  /** A price change the rounded prices do not show changes no quote */
  private touchPrice(market: Market, good: Good, marketGood: Market["goods"][number]) {
    const book = this.run?.books[good.i];
    const at = this.run?.positions[market.i];
    if (book && at !== undefined) {
      const sell = this.customerSellPrice(market, marketGood.price);
      const buy = this.customerBuyPrice(market, marketGood.price);
      if (sell === book.sellPrices[at] && buy === book.buyPrices[at]) return;
    }
    this.touch(market, good, marketGood);
  }

  private touch(market: Market, good: Good, marketGood: Market["goods"][number]) {
    const book = this.run?.books[good.i];
    const at = this.run?.positions[market.i];
    if (!book || at === undefined) return; // outside a run, or a run that failed: the next one indexes afresh
    book.revision++;
    const stocked = Number(marketGood.stock > MIN_STOCK);
    book.stockedCount += stocked - book.stocked[at];
    book.stocked[at] = stocked;
    book.sellPrices[at] = this.customerSellPrice(market, marketGood.price);
    book.buyPrices[at] = this.customerBuyPrice(market, marketGood.price);
    reorder(book.bySell, book.sellRanks, book.sellPrices, at, true);
    reorder(book.byBuy, book.buyRanks, book.buyPrices, at, false);
  }

  private getBalancePrice(day: MarketDay, good: Good): number {
    const depth = day.depth[good.i];
    const ratio = (depth + (day.demand[good.i] || 0)) / (depth + (day.supply[good.i] || 0));
    return minmax(
      day.listPrice[good.i] * ratio ** PRICE_CURVE,
      good.value * PRICE_FLOOR_FACTOR,
      good.value * PRICE_CEILING_FACTOR
    );
  }

  /** Demand with no stock changing hands: buyers turned away, or a share of an import */
  private addDemand(market: Market, good: Good, units: number) {
    const day = this.days[market.i];
    if (!day?.depth[good.i]) return; // outside an economy run the price stays
    day.demand[good.i] = (day.demand[good.i] || 0) + units;
    const marketGood = this.getMarketGood(market, good);
    marketGood.price = this.getBalancePrice(day, good);
    this.touchPrice(market, good, marketGood);
  }

  /** A trade: the stock it leaves, and the demand or supply it adds */
  private trade(market: Market, good: Good, stock: number, demand: number, supply: number) {
    const marketGood = this.getMarketGood(market, good);
    marketGood.stock = stock;
    const day = this.days[market.i];
    if (day?.depth[good.i]) {
      day.demand[good.i] = (day.demand[good.i] || 0) + demand;
      day.supply[good.i] = (day.supply[good.i] || 0) + supply;
      marketGood.price = this.getBalancePrice(day, good);
    }
    this.touch(market, good, marketGood);
  }

  /** Nearer markets share the import's demand, the nearest most, so it counts once */
  private addNearerDemand(burg: Burg, source: Market, good: Good, units: number) {
    const at = this.run?.positions[source.i];
    if (at === undefined) return;
    const carriage = this.getCarriage(burg);
    const { atDecimas } = carriage;
    const far = atDecimas[at];
    if (!far) return;
    carriage.nearest ??= Int32Array.from(atDecimas.keys()).sort((a, b) => atDecimas[a] - atDecimas[b]);
    let total = 0;
    for (const k of carriage.nearest) {
      if (atDecimas[k] >= far) break;
      total += 1 - atDecimas[k] / far;
    }
    for (const k of carriage.nearest) {
      const share = atDecimas[k] < far ? (units * (1 - atDecimas[k] / far)) / total : 0;
      if (share < 0.01) break;
      this.addDemand(pack.markets[k], good, share);
    }
  }

  /** Average price over a lot as it moves the price, units negative on selling */
  private getLotPrice(market: Market, good: Good, units: number): number {
    return this.lotPrice(this.getMarketGood(market, good).price, market, good, units);
  }

  private lotPrice(price: number, market: Market, good: Good, units: number): number {
    const day = this.days[market.i];
    const depth = day?.depth[good.i];
    if (!depth || Math.abs(units) < 1e-9) return price;
    const growth =
      units > 0
        ? averageGrowth(units / (depth + (day.demand[good.i] || 0)), PRICE_CURVE)
        : averageGrowth(-units / (depth + (day.supply[good.i] || 0)), -PRICE_CURVE);
    return minmax(price * growth, good.value * PRICE_FLOOR_FACTOR, good.value * PRICE_CEILING_FACTOR);
  }

  /** Units the market expects to sell a day in a run; unlimited outside it */
  getDepth(market: Market, good: Good): number {
    return this.days[market.i]?.depth[good.i] ?? Infinity;
  }

  signalShortage(market: Market, good: Good, units: number) {
    if (units > 0.01) this.addDemand(market, good, units);
  }

  /** Takes units at the lot's price; the rural share pays rural people, less the center's margin */
  private takeStock(market: Market, good: Good, units: number, price: number) {
    const marketGood = this.getMarketGood(market, good);
    const day = this.days[market.i];
    if (day && marketGood.stock > 0) {
      const fromRural = Math.min(day.rural[good.i] || 0, (units * (day.rural[good.i] || 0)) / marketGood.stock);
      if (fromRural > 0) {
        day.rural[good.i] -= fromRural;
        const earned = fromRural * this.customerSellPrice(market, price);
        day.cash += earned;
        day.income += earned;
        const margin = fromRural * price * this.getMarginRate(market);
        this.payMarginAmount(market, margin);
        day.margin += margin;
      }
    }
    this.trade(market, good, rn(Math.max(0, marketGood.stock - units), 2), units, 0);
  }

  /** Rural people spend earnings, less savings and poll tax, at their market up to their wants */
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
      const offers = options.map.goods
        .filter(good => good.demandCoverage?.[category])
        .map(good => ({
          good,
          price: this.customerBuyPrice(market, this.getMarketGood(market, good).price)
        }));
      const purchase = (good: Good, spend: number) => {
        const wanted = Math.min(market.goods[good.i].stock, room(good));
        const atOpen = Math.min(wanted, spend / this.customerBuyPrice(market, market.goods[good.i].price));
        // the smaller lot moves the price less, so it stays within the spend
        const units = Math.min(atOpen, spend / this.customerBuyPrice(market, this.getLotPrice(market, good, atOpen)));
        if (spend <= 0.01 || units < 0.01) return;
        const lot = this.getLotPrice(market, good, units);
        const cost = units * this.customerBuyPrice(market, lot);
        money -= cost;
        day.cash -= cost;
        day.spent += cost;
        day.bought[good.i] = (day.bought[good.i] || 0) + units;
        for (const [other, share] of Object.entries(good.demandCoverage!)) {
          const i = DEMAND_PRIORITY.indexOf(other as DemandCategory);
          day.covered[i] = (day.covered[i] || 0) + units * (share || 0);
        }
        const margin = units * lot * this.getMarginRate(market);
        this.payMarginAmount(market, margin);
        day.margin += margin;
        this.takeStock(market, good, units, lot);
      };
      // goods out of stock turn them away, which is demand too
      const shares = getVarietyShares(offers.map(({ good, price }) => price / good.demandCoverage![category]!));
      const total = money;
      offers.forEach(({ good, price }, k) => {
        const spend = Math.min(money, total * shares[k]);
        if (market.goods[good.i].stock > 0.01) purchase(good, spend);
        else this.signalShortage(market, good, Math.min(spend / price, room(good)));
      });
      const stocked = offers
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

  /** Rural poll tax, paid before the last orders so the states can spend it; returns it by state */
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

  /** The best market to sell at, after carriage and the importer's tariff; none under an embargo */
  getOutlet(burg: Burg, good: Good, terms = this.getTradeTerms()): Outlet | null {
    const { atDecimas, atFactors, ownAt, nearestOther } = this.getCarriage(burg);
    const own = Markets.ofBurg(burg);
    const { rows, sellPrices, bySell } = this.getBook(good);
    const markets = pack.markets;
    const leastCarriage = nearestOther * good.carriage;
    let best: Market | null = null;
    let bestPrice = -Infinity;
    let bestCarriage = 0;
    let bestAt = Infinity; // an equal price goes to the market first in pack.markets
    // its own market first: it pays no import carriage, so the others can be cut off by their least
    for (let rank = ownAt < 0 ? 0 : -1; rank < bySell.length; rank++) {
      const at = rank < 0 ? ownAt : bySell[rank];
      if (rank >= 0) {
        if (at === ownAt) continue;
        if (best && sellPrices[at] - leastCarriage < bestPrice) break; // carriage and tariffs only lower the rest
      }
      const distance = atDecimas[at];
      if (distance === Infinity) continue;
      const carriage = distance * good.carriage * atFactors[at];
      const beforeTariff = sellPrices[at] - carriage;
      if (best && beforeTariff < bestPrice) continue; // a tariff only lowers it
      const market = markets[at];
      const tariff = this.getSaleTariff(own, market, good, rows[at].price, terms);
      if (tariff === null) continue;
      const price = beforeTariff - tariff;
      if (!best || price > bestPrice || (price === bestPrice && at < bestAt))
        [best, bestPrice, bestCarriage, bestAt] = [market, price, carriage, at];
    }
    return best && { market: best, price: bestPrice, carriage: bestCarriage };
  }

  /** Per-unit tariff another state's market levies on goods from the burg's; null under an embargo */
  private getSaleTariff(own: Market | undefined, market: Market, good: Good, price: number, terms: TradeTerms) {
    if (!own || own === market) return 0;
    return terms(own, market, good, price)?.tariffPerUnit ?? null;
  }

  /** Prices at the burg's door: buying adds sales tax and carriage, selling pays carriage */
  quoteMarket(
    market: Market,
    goodId: number,
    burg: Burg
  ): { stock: number; buyPrice: number; sellPrice: number; carriage: number } {
    const good = Goods.get(goodId);
    if (!good) return { stock: 0, buyPrice: 0, sellPrice: 0, carriage: 0 };
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
      sellPrice: rn(Math.max(0, this.customerSellPrice(market, row.price) - carriage), 2),
      carriage
    };
  }

  /** What a unit fetches at the burg's door and the carriage in it */
  quoteSale(market: Market, good: Good, burg: Burg): { sellPrice: number; carriage: number } {
    const carriage = this.getTransport(market, burg, good);
    const sellPrice = rn(
      Math.max(0, this.customerSellPrice(market, this.getMarketGood(market, good).price) - carriage),
      2
    );
    return { sellPrice, carriage };
  }

  /** A door price as a lot's, units negative on selling: the market's part moves, carriage stays */
  atLot(doorPrice: number, carriage: number, market: Market, good: Good, units: number): number {
    const price = market.goods[good.i]?.price;
    if (!price) return doorPrice;
    const factor = this.lotPrice(price, market, good, units) / price;
    const fixed = units < 0 ? -carriage : carriage;
    return (doorPrice - fixed) * factor + fixed;
  }

  private priceAtDoor(withMargin: number, tax: number, tariff: number, carriage: number): number {
    return rn(withMargin + tax + tariff + carriage, 2);
  }

  measureRoutes(): void {
    this.routeCosts = null;
    this.getRouteCosts();
    this.carriage = [];
  }

  /** Route costs from every market's center, measured again once routes, markets or burgs change */
  private getRouteCosts(): Float32Array[] {
    if (this.carriage && this.routeCosts) return this.routeCosts; // measured for this run
    const source = [pack.cells.routes, pack.markets, Markets.revision, pack.burgs.length];
    if (!this.routeCosts || source.some((value, index) => value !== this.routeCostsSource[index])) {
      this.routeCosts = TradeRoutes.measure();
      this.routeCostsSource = source;
      this.decima = getDecima() || 1;
    }
    return this.routeCosts;
  }

  /** Ends the run: rounds prices; each market keeps its rural day and the poll tax its people paid */
  endRun(): void {
    // average prices keep 4 decimals, so units × price gives back what was paid to the cent
    for (const deal of pack.deals) {
      deal[4] = rn(deal[4], 2);
      deal[5] = rn(deal[5], 4);
      deal[6] = rn(deal[6], 2);
      deal[7] = rn(deal[7], 2);
      deal[8] = rn(deal[8], 4);
    }
    for (const market of pack.markets) {
      for (const marketGood of Object.values(market.goods)) marketGood.price = rn(marketGood.price, 2);
      const day = this.days[market.i];
      if (!day) continue;
      const bought = day.bought.flatMap((units, goodId) => (units ? [[goodId, rn(units, 2)] as [number, number]] : []));
      // every purchase took the rural share of the stock, so what is left of it is theirs
      const kept = day.rural.flatMap((units, goodId) => {
        const left = Math.min(units, market.goods[goodId]?.stock || 0);
        return left >= 0.01 ? [[goodId, rn(left, 2)] as [number, number]] : [];
      });
      const share = day.pollTaxShare ?? this.getPollTaxShare(day);
      const pollTax = day.pollTaxDue.flatMap((owed, stateId) =>
        owed ? [[stateId, rn(owed, 2), rn(owed * share, 2)] as [number, number, number]] : []
      );
      market.rural = {
        earned: rn(day.income, 2),
        spent: rn(day.spent, 2),
        bought,
        kept,
        margin: rn(day.margin, 2)
      };
      if (pollTax.length) market.rural.pollTax = pollTax;
    }
    this.carriage = null;
    this.run = null;
  }

  /** Decimas between the market's center and the burg; Infinity with no route to another market */
  getDecimas(market: Market, burg: Burg): number {
    if (burg.i === market.centerBurgId) return 0;
    const distance = this.getRouteCosts()[market.i]?.[burg.i!] ?? Infinity;
    if (distance === Infinity && market !== Markets.ofBurg(burg)) return Infinity;
    return Math.min(distance / this.decima, MAX_DECIMAS);
  }

  /** Per-unit carriage, dearer from another state; Infinity with no route to another market */
  getTransport(market: Market, burg: Burg, good: Good): number {
    return this.carry(this.getCarriage(burg), market, good);
  }

  private carry({ decimas, factors }: Carriage, market: Market, good: Good): number {
    const distance = decimas[market.i];
    return distance === Infinity ? Infinity : distance * good.carriage * factors[market.i];
  }

  /** Decimas and carriage factors from every market to the burg, kept for the run */
  private getCarriage(burg: Burg): Carriage {
    const cached = this.carriage?.[burg.i!];
    if (cached) return cached;
    const { markets } = pack;
    const size = markets.reduce((max, market) => Math.max(max, market.i + 1), 0);
    const decimas = new Float64Array(size).fill(Infinity);
    const factors = new Float64Array(size);
    const atDecimas = new Float64Array(markets.length);
    const atFactors = new Float64Array(markets.length);
    const own = Markets.ofBurg(burg);
    const ownState = Markets.getState(own);
    let ownAt = -1;
    let nearestOther = Infinity;
    for (let at = 0; at < markets.length; at++) {
      const market = markets[at];
      const distance = this.getDecimas(market, burg);
      const factor =
        own && own !== market && isForeign(Markets.getState(market), ownState) ? IMPORT_CARRIAGE_FACTOR : 1;
      decimas[market.i] = atDecimas[at] = distance;
      factors[market.i] = atFactors[at] = factor;
      if (market === own) ownAt = at;
      else if (distance < nearestOther) nearestOther = distance;
    }
    const carriage = { decimas, factors, atDecimas, atFactors, ownAt, nearestOther };
    if (this.carriage) this.carriage[burg.i!] = carriage;
    return carriage;
  }

  getCarriageFactor(market: Market, burg: Burg): number {
    return this.isImportFor(market, burg) ? IMPORT_CARRIAGE_FACTOR : 1;
  }

  private isImportFor(market: Market, burg: Burg): boolean {
    const own = Markets.ofBurg(burg);
    return Boolean(own && own !== market && isForeign(Markets.getState(market), Markets.getState(own)));
  }

  /** Buys from a market, its own unless a source is given, paying margin, taxes and carriage */
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

    const carriage = this.getTransport(source, burg, good);
    if (carriage === Infinity) return null;
    const quote = (lot: number) => {
      const costs = terms(source, market, good, lot);
      return (
        costs && {
          costs,
          price: this.priceAtDoor(this.customerBuyPrice(source, lot), costs.taxPerUnit, costs.tariffPerUnit, carriage)
        }
      );
    };
    const opening = quote(row.price);
    if (!opening) return null;
    // the smaller lot the budget then buys moves the price less, so it stays within the budget
    const atOpen = Math.min(units, row.stock, affordable(budget, opening.price));
    const actualUnits = rn(
      Math.min(atOpen, affordable(budget, quote(this.getLotPrice(source, good, atOpen))!.price)),
      2
    );
    if (actualUnits < 0.01) return null;
    const lot = this.getLotPrice(source, good, actualUnits);
    const { costs, price } = quote(lot)!;

    const trade = {
      units: actualUnits,
      price,
      tax: rn(costs.taxPerUnit * actualUnits, 2),
      tariff: rn(costs.tariffPerUnit * actualUnits, 2),
      carriage: rn(carriage, 2)
    };
    this.recordDeal(burg.i!, source.i, good.i, kind, trade);
    this.payMargin(source, kind, trade);

    this.takeStock(source, good, actualUnits, lot);
    if (source !== market) this.addNearerDemand(burg, source, good, actualUnits);
    return trade;
  }

  /** Own market while it stocks enough, else `cheapest`, else what its own has left; null if none */
  getSupplier(own: Market, good: Good, cheapest: () => Market | undefined): Market | null {
    const local = own.goods[good.i]?.stock || 0;
    if (local >= MIN_LOCAL_STOCK) return own;
    return cheapest() ?? (local > 0.01 ? own : null);
  }

  private getSalesTaxPerUnit(market: Market, price: number): number {
    return States.getSalesTax(pack.burgs[market.centerBurgId]) * price;
  }

  /** Units sold to its own market it can take back, at what each earned; rural stock is not its */
  quoteKeep(burg: Burg, good: Good): { units: number; price: number } | null {
    const market = Markets.ofBurg(burg);
    const sale = market && this.findDeal(burg.i!, market.i, good.i, DEAL_KINDS.sale);
    if (!market || !sale) return null;

    const rural = this.days[market.i]?.rural[good.i] || 0;
    const units = Math.min(sale[4], this.getMarketGood(market, good).stock - rural);
    if (units < 0.01) return null;
    return { units, price: sale[5] - sale[6] / sale[4] };
  }

  /** Takes back own sales to cover demand, as if never sold: the sale and its tax shrink */
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
    this.trade(market, good, rn(Math.max(0, marketGood.stock - kept), 2), 0, -kept); // the sale undone
    return { units: kept, price: rn(quote.price, 2), tax: 0 };
  }

  /** Units the market takes before the next fetches under a cent at the burg's door */
  private getSellable(market: Market, good: Good, carriage: number, tariffRate: number): number {
    const kept = 1 - this.getMarginRate(market) - tariffRate; // of the market's price, what reaches the burg before carriage
    const price = this.getMarketGood(market, good).price;
    const least = kept > 0 ? (carriage + 0.01) / kept : Infinity; // the market's price at which a unit fetches a cent
    if (price <= least) return 0;
    const depth = this.days[market.i]?.depth[good.i];
    if (!depth || least <= good.value * PRICE_FLOOR_FACTOR) return Infinity; // the price never falls that low
    return (depth + (this.days[market.i].supply[good.i] || 0)) * ((price / least) ** (1 / PRICE_CURVE) - 1);
  }

  /** Sells to a market, its own by default, units that fetch something; null if none or embargoed */
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
    const tariffRate = this.getSaleTariff(Markets.ofBurg(burg), market, good, 1, terms);
    if (tariffRate === null) return null;
    const transport = this.getTransport(market, burg, good);
    const sold = rn(Math.min(units, this.getSellable(market, good, transport, tariffRate)), 2);
    if (sold < 0.01) return null;

    const lot = this.getLotPrice(market, good, -sold); // the lot pays its own impact
    const price = rn(this.customerSellPrice(market, lot) - transport, 2);
    const tax = rn(sold * price * taxRate, 2);
    const trade = { units: sold, price, tax, tariff: rn(sold * tariffRate * lot, 2), carriage: rn(transport, 2) };
    this.recordDeal(burg.i!, market.i, good.i, DEAL_KINDS.sale, trade);
    this.payMargin(market, DEAL_KINDS.sale, trade);

    this.trade(market, good, rn(marketGood.stock + sold, 2), 0, sold);
    return trade;
  }

  recordDeal(burgId: number, marketId: number, goodId: number, kind: DealKind, trade: Transaction) {
    const { tariff = 0, carriage = 0 } = trade;
    const deal = this.findDeal(burgId, marketId, goodId, kind);
    if (!deal) {
      this.dealIds.set(dealKey(burgId, marketId, goodId, kind), pack.deals.length);
      const added: Deal = [burgId, marketId, goodId, kind, trade.units, trade.price, trade.tax, tariff, carriage];
      pack.deals.push(added);
      this.creditTaxes(added, trade.tax, tariff);
      return;
    }
    this.creditTaxes(deal, trade.tax, tariff);

    const units = deal[4] + trade.units;
    deal[5] = (deal[4] * deal[5] + trade.units * trade.price) / units; // unrounded until the run ends
    deal[8] = (deal[4] * deal[8] + trade.units * carriage) / units;
    deal[4] = units;
    deal[6] += trade.tax;
    deal[7] += tariff;
  }

  /** The states' taxes so far in the run, which they spend as they come */
  private creditTaxes(deal: Deal, tax: number, tariff: number) {
    if (!tax && !tariff) return;
    const { taxState, tariffState } = this.getTaxStates(deal);
    if (tax) this.taxes[taxState] = (this.taxes[taxState] || 0) + tax;
    if (tariff) this.taxes[tariffState] = (this.taxes[tariffState] || 0) + tariff;
  }

  getTaxesSoFar(stateId: number): number {
    return this.taxes[stateId] || 0;
  }

  private findDeal(burgId: number, marketId: number, goodId: number, kind: DealKind): Deal | undefined {
    if (this.dealIdsSource !== pack.deals) {
      this.dealIds = new Map(pack.deals.map(([b, m, g, k], i) => [dealKey(b, m, g, k), i]));
      this.dealIdsSource = pack.deals;
    }
    const id = this.dealIds.get(dealKey(burgId, marketId, goodId, kind));
    return id === undefined ? undefined : pack.deals[id];
  }

  /** Money to the market: a burg's payment with carriage, less taxes, minus what it pays a burg */
  getMarketIncome(deal: Deal): number {
    const [, , , kind, units, price, tax, tariff] = deal;
    if (kind === DEAL_KINDS.kept) return 0;
    const margin = this.getMargin(deal); // the center burg's, not the market's
    if (kind === DEAL_KINDS.sale) return -units * price - margin;
    return units * price - tax - tariff - margin;
  }

  getMargin([, marketId, , kind, units, price, tax, tariff, carriage]: Deal): number {
    return this.marginOf(Markets.get(marketId), kind, { units, price, tax, tariff, carriage });
  }

  /** Share a market buys below and sells above its price, whole percents, raised by the license */
  getMarginRate(market?: Market): number {
    const fee = market?.feePaid || 0;
    let rate = this.marginRates.get(fee);
    if (rate === undefined) {
      rate = Math.min(
        MAX_MARKET_MARGIN,
        Math.round(MARKET_MARGIN * Math.sqrt(1 + fee / MARKET_FEE_DETERRENCE) * 100) / 100
      );
      this.marginRates.set(fee, rate);
    }
    return rate;
  }

  /** The market's spread on a trade, before taxes and carriage */
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

  /** Paid as the trade happens, so the center can spend it the same day */
  private payMargin(market: Market, kind: DealKind, trade: Transaction): void {
    this.payMarginAmount(market, this.marginOf(market, kind, trade));
  }

  /** To the market's center, first to the license it still owes */
  private payMarginAmount(market: Market, amount: number): void {
    const center = pack.burgs[market.centerBurgId];
    if (!center?.i || center.removed) return;
    const due = this.licenseDue[market.i] || 0;
    const toLicense = amount > 0 ? Math.min(due, amount) : 0; // a margin given back on goods kept stays with the center
    if (toLicense) this.licenseDue[market.i] = due - toLicense;
    center.treasury = (center.treasury || 0) + amount - toLicense;
  }

  /** Bills each market's center its license for the day, paid out of the margin as it comes in */
  billLicenses(): void {
    this.licenseDue = [];
    for (const market of pack.markets) if (market.feePaid) this.licenseDue[market.i] = market.feePaid;
  }

  settleLicenses(): void {
    for (const market of pack.markets) {
      const due = this.licenseDue[market.i];
      const center = pack.burgs[market.centerBurgId];
      if (due && center?.i && !center.removed) center.treasury = (center.treasury || 0) - due;
    }
    this.licenseDue = [];
  }

  /** Only an import may pay a tariff */
  isImport(deal: Deal): boolean {
    const burg = pack.burgs[deal[0]];
    const own = Markets.getState(burg && Markets.ofBurg(burg));
    return deal[7] > 0 || isForeign(own, Markets.getState(Markets.get(deal[1])));
  }

  /** A burg that lost its market since the run stays in its own state until the next one */
  private getMarketStates([burgId, marketId]: Deal): { own: number; market: number } {
    const burg = pack.burgs[burgId];
    const own = burg && Markets.ofBurg(burg);
    return {
      own: own ? Markets.getState(own) : burg?.state || 0,
      market: Markets.getState(Markets.get(marketId))
    };
  }

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

  getTaxesByState(): { salesTax: number[]; tariffs: number[] } {
    const salesTax: number[] = [];
    const tariffs: number[] = [];
    for (const deal of pack.deals) {
      const { taxState, tariffState } = this.getTaxStates(deal);
      if (deal[6]) salesTax[taxState] = (salesTax[taxState] || 0) + deal[6];
      if (deal[7]) tariffs[tariffState] = (tariffs[tariffState] || 0) + deal[7];
    }
    return { salesTax, tariffs };
  }

  /** The importer state's rate on the good from the exporter state, 0 under an embargo */
  getTariffRate(importerStateId: number, exporterStateId: number, goodId: number): number {
    const rate = this.findTariff(importerStateId, exporterStateId, goodId);
    return rate === "embargo" ? 0 : rate;
  }

  /** The importer's most specific rule: state and good, state, good, all; an embargo wins a tie */
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

  /** Per-unit sales tax and any tariff from a source market to another's burg; null if embargoed */
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

  /** Every market as a source, cheapest first, then the rest. Debug only: it prunes nothing */
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

    const { atDecimas, atFactors, nearestOther } = this.getCarriage(burg);
    const { rows, stocked, buyPrices, byBuy, stockedCount } = this.getBook(good);
    const leastCarriage = nearestOther * good.carriage;
    const markets = pack.markets;
    let best: SourceQuote | null = null;
    let bestAt = Infinity; // an equal price goes to the market first in pack.markets
    let unseen = stockedCount; // the stocked markets still ahead: none left ends the search
    for (const at of byBuy) {
      if (!unseen) break;
      const withMargin = buyPrices[at];
      if (best && withMargin + leastCarriage > best.buyPrice + 0.006) break; // taxes and carriage only add to the rest; past 0.006 nothing rounds back to it
      if (!stocked[at]) continue;
      unseen--;
      const source = markets[at];
      if (source === market) continue;
      const distance = atDecimas[at];
      if (distance === Infinity) continue;
      const carriage = distance * good.carriage * atFactors[at];
      if (best && withMargin + carriage > best.buyPrice + 0.006) continue; // past 0.006 over the best nothing rounds back to it
      const row = rows[at];
      const costs = terms(source, market, good, row.price);
      if (!costs) continue;
      const buyPrice = this.priceAtDoor(withMargin, costs.taxPerUnit, costs.tariffPerUnit, carriage);
      if (!best || buyPrice < best.buyPrice || (buyPrice === best.buyPrice && at < bestAt)) {
        best = { source, stock: row.stock, buyPrice, carriage };
        bestAt = at;
      }
    }
    return best;
  }

  customerBuyPrice(market: Market, midPrice: number): number {
    return rn(midPrice * (1 + this.getMarginRate(market)), 2);
  }

  customerSellPrice(market: Market, midPrice: number): number {
    return rn(midPrice * (1 - this.getMarginRate(market)), 2);
  }

  /** Units a person buys of each good a day, plus what the trades making its products need */
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
