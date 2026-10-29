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
import {
  DEMAND_PRIORITY,
  DEMAND_TARGET_FACTORS,
  Goods,
  getVarietyShares,
  SAVINGS_RATE,
  WANT_LIMITS,
  WANT_SHARES
} from "./goods-generator";
import { Production } from "./production-generator";
import { TradeRoutes } from "./trade-routes";

const PRICE_FLOOR_FACTOR = 0.02;
const PRICE_CEILING_FACTOR = 5.0;
export const PRICE_RESPONSE = 0.56; // a trade of a day's expected sales moves the price e^this times
const WANTS_ESTIMATE = 1.94; // expected sales: what people buy beyond their needs, as a multiple of them
const OPENING_ELASTICITY = 0.07; // how far below its value an ingredient opens where its trades need less than a unit a day
export const CAPITAL_RENT = 0.21; // share of rural sale income paid to the state's capital: dues and absentee landlords
export const MARKET_MARGIN = 0.035; // a market's margin before its license: merchants pass the fee on, by the fee factor's root, so a typical monarchy's market (fee 25) takes 5%
const OTHER_LANDMASS_SPACING = 0.5; // share of the market spacing a market on another landmass keeps clear
const MAX_DECIMAS = 10; // the map's diagonal: the most carriage, paid with no route to the burg's own market
export const MIN_LOCAL_STOCK = 1; // a buyer buys at its own market while it stocks this much, otherwise from the cheapest market
export const IMPORT_CARRIAGE_FACTOR = 2; // carriage from another state's market: borders, tolls, longer hauls
const MARKET_FEE_DETERRENCE = 25; // a state's market fee a day that halves a burg's chance to be a market center and doubles the area each market needs
const CROSSROADS_BONUS = 0.25; // score a burg gains for each route beyond a road through it, up to 4 more
const SPACING_RANGE = [0.5, 2.5]; // the spacing a burg needs, as a share of the base, from the busiest land to the emptiest
const DENSITY_PULL = 0.6; // how far markets follow burgs: 1 gives every market about as many burgs, 0 spaces them evenly

export type Market = {
  i: number;
  centerBurgId: number;
  color: string;
  name?: string;
  goods: Record<number, { stock: number; price: number }>;
  rural?: RuralDay; // its rural people's last day, kept from the economy run
  feePaid?: number; // license fee its center burg paid its state in the last economy run
  note?: string;
};

/** A market's rural people's day: what their produce earned, the rent paid out of it, what they bought with the rest, and the poll tax they owed and paid by state */
export type RuralDay = {
  earned: number;
  rent: number;
  spent: number;
  bought: [goodId: number, units: number][];
  margin?: number; // what the market's center took on their purchases, in no deal
  pollTax?: [stateId: number, owed: number, paid: number][];
};

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
  rent: number;
  spent: number;
  margin: number;
  covered: number[];
  bought: number[];
  pollTaxDue: number[]; // by the state of the rural people's cells
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
export type Trade = { units: number; price: number; tax: number; tariff?: number; carriage?: number };

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
  private routeCostsSource: unknown[] = []; // the route links, markets and burg count they were measured on
  private decima = 0; // a tenth of the map's diagonal, kept with the routes
  private days: MarketDay[] = []; // by market, for the economy run
  private taxes: number[] = []; // by state: sales tax and tariffs collected so far in the economy run
  private produce: Float32Array | null = null; // by cell: its rural produce at base prices, from the last run
  private produceSource: unknown = null; // the cells it describes
  private carriage: Map<number, { decimas: Float64Array; imports: Uint8Array }> | null = null; // by burg then market, for the economy run

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
    const feeFactor = (burg: Burg) => 1 + States.getMarketFee(burg.state || 0) / MARKET_FEE_DETERRENCE;
    // Score each burg by population; capitals, ports and crossroads are weighted higher, a dear market license lower
    const scored = pack.burgs
      .map(burg => {
        let score = burg.population || 0;
        if (burg.capital) score *= 2.5;
        if (burg.port) score *= 1.2;
        const roads = Object.keys(pack.cells.routes?.[burg.cell!] ?? {}).length;
        score *= 1 + CROSSROADS_BONUS * minmax(roads - 2, 0, 4);
        score /= feeFactor(burg);
        score *= Math.random() * 2 + 0.5; // add some noise
        return { burg, score };
      })
      .sort((a, b) => b.score - a.score);

    const spacing = this.getSpacing(
      scored.map(({ burg }) => burg).filter(burg => burg.i && !burg.removed),
      feeFactor
    );

    const markets: Market[] = [];
    this.marketById = [];
    const newTree = () =>
      quadtree<[number, number, number]>(
        [],
        d => d[0],
        d => d[1]
      );
    const tree = newTree();
    const treeByLandmass = new Map<number, ReturnType<typeof newTree>>();
    const place = (burg: Burg) => {
      const marketId = markets.length + 1;
      const market = { i: marketId, centerBurgId: burg.i!, color: "", goods: {} };
      markets.push(market);
      this.marketById[marketId] = market;
      tree.add([burg.x, burg.y, marketId]);
      if (!treeByLandmass.has(burg.feature!)) treeByLandmass.set(burg.feature!, newTree());
      treeByLandmass.get(burg.feature!)!.add([burg.x, burg.y, marketId]);
    };

    const living = scored.filter(({ burg }) => burg.i && !burg.removed);
    for (const { burg } of living) {
      const { x, y } = burg;
      const minSpacing = spacing.get(burg.i!)!;
      // a market across the water is a world apart: it blocks a new one only when much closer
      const blocked =
        treeByLandmass.get(burg.feature!)?.find(x, y, minSpacing) ||
        tree.find(x, y, minSpacing * OTHER_LANDMASS_SPACING);
      if (!blocked) place(burg);
    }

    // a landmass with burgs but no port has no sea routes to the rest: it trades within itself
    const portLandmasses = new Set(living.filter(({ burg }) => burg.port).map(({ burg }) => burg.feature));
    for (const { burg } of living) {
      if (!portLandmasses.has(burg.feature) && !treeByLandmass.has(burg.feature!)) place(burg);
    }

    const colors = getColors(markets.length);
    markets.forEach((m, i) => {
      m.color = colors[i];
    });

    return markets;
  }

  /** How far a burg must be from other market centers to become one: closer where burgs crowd and licenses are cheap, farther in empty land and greedy states. A market needs land in proportion to its fee factor and inverse to the burgs around it; both are relative to the world's average, so the number of markets stays about the same */
  private getSpacing(burgs: Burg[], feeFactor: (burg: Burg) => number): Map<number, number> {
    const base = ((options.map.graph.width + options.map.graph.height) * 2.5) / pack.burgs.length ** 0.6;
    const tree = quadtree<Burg>(
      burgs,
      burg => burg.x,
      burg => burg.y
    );
    const neighbors = burgs.map(({ x, y }) => {
      let count = 0;
      tree.visit((node, x0, y0, x1, y1) => {
        if (!node.length) {
          for (let leaf: typeof node | undefined = node; leaf; leaf = leaf.next) {
            const { data } = leaf as { data: Burg };
            if ((data.x - x) ** 2 + (data.y - y) ** 2 < base ** 2) count++;
          }
        }
        return x0 > x + base || x1 < x - base || y0 > y + base || y1 < y - base;
      });
      return count;
    });
    const fees = burgs.map(feeFactor);
    const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / (values.length || 1);
    const meanNeighbors = mean(neighbors);
    const meanFee = mean(fees);
    const [min, max] = SPACING_RANGE;
    return new Map(
      burgs.map((burg, index) => {
        const area = (meanNeighbors / neighbors[index]) ** DENSITY_PULL * (fees[index] / meanFee);
        return [burg.i!, base * minmax(Math.sqrt(area), min, max)];
      })
    );
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
    const DIFFERENT_STATE_COST = 200;
    const WATER_COST = 50;
    const WATER_COST_FOR_NON_PORTS = 50;
    const ISLAND_CHANGE_COST = 100;

    const nativeOwner = new Uint8Array(cells.i.length); // cell is owned by a market of its own state

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
        const isNative = Boolean(cells.state[neighborId]) && burg.state === cells.state[neighborId];
        let cost = BASE_COST;
        if (isWater) {
          cost += WATER_COST;
          if (burg.port !== cells.f[neighborId]) cost += WATER_COST_FOR_NON_PORTS;
        } else {
          if (cells.f[burg.cell] !== cells.f[neighborId]) cost += ISLAND_CHANGE_COST;
          if (cells.state[neighborId] && !isNative) cost += DIFFERENT_STATE_COST;
        }

        const totalCost = priority + cost;
        const nativeTie = totalCost === costs[neighborId] && isNative && !nativeOwner[neighborId];
        if (!costs[neighborId] || totalCost < costs[neighborId] || nativeTie) {
          costs[neighborId] = totalCost;
          queue.push({ cellId: neighborId, marketId, burg, priority: totalCost }, totalCost);

          const hasGood = Boolean(cells.good[neighborId]);
          if (isWater && !hasGood) continue; // exclude water cells without goods

          cellMarket[neighborId] = marketId;
          nativeOwner[neighborId] = isNative ? 1 : 0;
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

  /** The countryside brings its produce to its market; it is paid as the produce is bought */
  collectRuralProduction(): void {
    const biomeProduction = Goods.getBiomesProduction();
    this.days = [];
    this.taxes = [];
    this.produce = new Float32Array(pack.cells.i.length);
    this.produceSource = pack.cells;
    for (const market of pack.markets)
      this.days[market.i] = {
        depth: [],
        rural: [],
        ruralPeople: 0,
        cash: 0,
        income: 0,
        rent: 0,
        spent: 0,
        margin: 0,
        covered: [],
        bought: [],
        pollTaxDue: []
      };

    for (const cellId of pack.cells.i) {
      const market = this.marketById[pack.cells.market[cellId]];
      if (!market) continue;
      const day = this.days[market.i];
      const people = pack.cells.pop[cellId] || 0;
      day.ruralPeople += people;
      const stateId = pack.cells.state[cellId];
      day.pollTaxDue[stateId] = (day.pollTaxDue[stateId] || 0) + States.getPollTaxDue(stateId, people);

      const produced = Production.getCellProduction(cellId, biomeProduction);
      for (const [goodId, amount] of Object.entries(produced)) {
        const good = Goods.get(+goodId);
        if (!good) continue;
        const marketGood = this.getMarketGood(market, good);
        marketGood.stock = rn(marketGood.stock + amount, 2);
        day.rural[good.i] = (day.rural[good.i] || 0) + amount;
        this.produce[cellId] += amount * good.value;
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
        this.getMarketGood(market, good).price = rn(Math.max(price, good.value * PRICE_FLOOR_FACTOR), 2);
      }
    }
  }

  /** A trade of a day's expected sales moves the price e^PRICE_RESPONSE times: up on buying, down on selling */
  private movePrice(market: Market, good: Good, units: number) {
    const depth = this.days[market.i]?.depth[good.i];
    if (!depth) return; // outside an economy run the price stays
    const marketGood = this.getMarketGood(market, good);
    const price = marketGood.price * Math.exp((PRICE_RESPONSE * units) / depth);
    marketGood.price = rn(minmax(price, good.value * PRICE_FLOOR_FACTOR, good.value * PRICE_CEILING_FACTOR), 2);
  }

  /** Buyers turned away for lack of stock raise the price as if they had bought */
  signalShortage(market: Market, good: Good, units: number) {
    if (units > 0.01) this.movePrice(market, good, units);
  }

  /** Units taken from the market's stock: the share that is rural produce pays the market's rural people, less the margin and the capital's rent */
  private takeStock(market: Market, good: Good, units: number) {
    const marketGood = this.getMarketGood(market, good);
    const day = this.days[market.i];
    if (day && marketGood.stock > 0) {
      const fromRural = Math.min(day.rural[good.i] || 0, (units * (day.rural[good.i] || 0)) / marketGood.stock);
      if (fromRural > 0) {
        day.rural[good.i] -= fromRural;
        const earned = fromRural * this.customerSellPrice(market, marketGood.price);
        const rent = earned * CAPITAL_RENT;
        const capital = pack.burgs[pack.states[this.getMarketState(market)]?.capital || 0];
        const paid = capital?.i && !capital.removed ? rent : 0; // no capital to pay: the countryside keeps it
        if (paid) capital!.treasury = rn((capital!.treasury || 0) + paid, 2);
        day.cash += earned - paid;
        day.income += earned - paid;
        day.rent += paid;
      }
    }
    marketGood.stock = rn(Math.max(0, marketGood.stock - units), 2);
    this.movePrice(market, good, units);
  }

  /** The market's rural people spend up to (1 - savings) of what they earned on goods at their market, keeping back their poll tax, cheapest coverage first, up to their wants; their needs come from their own fields */
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

  /** By state: the poll tax rural people could pay now, as the run's end will collect it */
  getRuralPollTax(): number[] {
    const paid: number[] = [];
    for (const market of pack.markets) {
      const day = this.days[market.i];
      if (!day) continue;
      const share = this.getPollTaxShare(day);
      day.pollTaxDue.forEach((owed, stateId) => {
        if (owed) paid[stateId] = (paid[stateId] || 0) + owed * share;
      });
    }
    return paid;
  }

  /** What the market's rural people earned and spent this run */
  getRuralBalance(marketId: number): { people: number; income: number; spent: number } | null {
    const day = this.days[marketId];
    return day ? { people: day.ruralPeople, income: rn(day.income, 2), spent: rn(day.spent, 2) } : null;
  }

  /** The market where a unit of the good sells for the most at the burg's door, after carriage */
  getOutlet(burg: Burg, good: Good): { market: Market; price: number } | null {
    let best: { market: Market; price: number } | null = null;
    for (const market of pack.markets) {
      const transport = this.getTransport(market, burg, good);
      if (transport === Infinity) continue;
      const price = this.customerSellPrice(market, this.getMarketGood(market, good).price) - transport;
      if (!best || price > best.price) best = { market, price };
    }
    return best;
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
    this.routeCosts = null;
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
    this.routeCosts = null;
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
      buyPrice: rn(
        this.customerBuyPrice(market, row.price) + this.getSalesTaxPerUnit(market, row.price) + transport,
        2
      ),
      sellPrice: rn(Math.max(0, this.customerSellPrice(market, row.price) - transport), 2)
    };
  }

  /** Measures the route network from every market's center, for the economy run to price carriage */
  measureRoutes(): void {
    this.routeCosts = null;
    this.getRouteCosts();
    this.carriage = new Map();
  }

  /** Route costs from every market's center, measured again once routes, markets or burgs change */
  private getRouteCosts(): Float32Array[] {
    const source = [pack.cells.routes, pack.markets, pack.burgs.length];
    if (!this.routeCosts || source.some((value, index) => value !== this.routeCostsSource[index])) {
      this.routeCosts = TradeRoutes.measure();
      this.routeCostsSource = source;
      this.decima = getDecima() || 1;
    }
    return this.routeCosts;
  }

  /** Each cell's rural produce at base prices in the last run, while it describes the current cells */
  getCellProduce(): Float32Array | null {
    return this.produceSource === pack.cells ? this.produce : null;
  }

  /** Ends the run: rural people pay their poll tax from what they kept, as far as it goes; keeps each market's rural day for the views, and drops the carriage, as edits to burgs and states may change it */
  endRun(): void {
    for (const market of pack.markets) {
      const day = this.days[market.i];
      if (!day) continue;
      const bought = day.bought.flatMap((units, goodId) => (units ? [[goodId, rn(units, 2)] as [number, number]] : []));
      const share = this.getPollTaxShare(day);
      const pollTax = day.pollTaxDue.flatMap((owed, stateId) =>
        owed ? [[stateId, rn(owed, 2), rn(owed * share, 2)] as [number, number, number]] : []
      );
      market.rural = {
        earned: rn(day.income + day.rent, 2),
        rent: rn(day.rent, 2),
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
    if (distance === Infinity && market.i !== burg.market) return Infinity;
    return Math.min(distance / this.decima, MAX_DECIMAS);
  }

  /** Per-unit cost of carrying a good between the market's center and the burg, dearer from another state's market; Infinity with no route to another market */
  getTransport(market: Market, burg: Burg, good: Good): number {
    if (this.carriage) {
      const { decimas, imports } = this.getCarriage(burg);
      const distance = decimas[market.i];
      return distance === Infinity
        ? Infinity
        : distance * good.carriage * (imports[market.i] ? IMPORT_CARRIAGE_FACTOR : 1);
    }
    const decimas = this.getDecimas(market, burg);
    if (decimas === Infinity) return Infinity;
    return decimas * good.carriage * (this.isImportFor(market, burg) ? IMPORT_CARRIAGE_FACTOR : 1);
  }

  /** Decimas and import flags from every market to the burg, measured once a run */
  private getCarriage(burg: Burg) {
    let carriage = this.carriage!.get(burg.i!);
    if (carriage) return carriage;
    const decimas = new Float64Array(this.marketById.length).fill(Infinity);
    const imports = new Uint8Array(this.marketById.length);
    for (const market of pack.markets) {
      decimas[market.i] = this.getDecimas(market, burg);
      imports[market.i] = Number(this.isImportFor(market, burg));
    }
    carriage = { decimas, imports };
    this.carriage!.set(burg.i!, carriage);
    return carriage;
  }

  /** Carriage from another state's market costs more */
  getCarriageFactor(market: Market, burg: Burg): number {
    return this.isImportFor(market, burg) ? IMPORT_CARRIAGE_FACTOR : 1;
  }

  private isImportFor(market: Market, burg: Burg): boolean {
    const own = this.get(burg.market);
    return Boolean(own && own !== market && isForeign(this.getMarketState(market), this.getMarketState(own)));
  }

  private getMarketState(market: Market): number {
    return pack.burgs[market.centerBurgId]?.state || 0;
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
    const price = rn(this.customerBuyPrice(market, marketGood.price) + taxPerUnit + transport, 2);

    const actualUnits = rn(Math.min(units, marketGood.stock, affordable(budget, price)), 2);
    if (actualUnits < 0.01) return null;

    const trade = { units: actualUnits, price, tax: rn(taxPerUnit * actualUnits, 2), carriage: rn(transport, 2) };
    this.recordDeal(burg.i!, market.i, good.i, kind, trade);
    this.payMargin(market, kind, trade);

    this.takeStock(market, good, actualUnits);
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

  /** The burg sells to a market, its own unless another is given */
  sell({
    burg,
    good,
    units,
    taxRate,
    market = this.get(burg.market)
  }: {
    burg: Burg;
    good: Good;
    units: number;
    taxRate: number;
    market?: Market;
  }): Trade | null {
    if (!market || units <= 0) return null;

    const marketGood = this.getMarketGood(market, good);
    const grossPrice = this.customerSellPrice(market, marketGood.price);
    const transport = Math.min(this.getTransport(market, burg, good), grossPrice);
    const price = rn(grossPrice - transport, 2);
    const tax = rn(units * price * taxRate, 2);
    const trade = { units: rn(units, 2), price, tax, carriage: rn(transport, 2) };
    this.recordDeal(burg.i!, market.i, good.i, DEAL_KINDS.sale, trade);
    this.payMargin(market, DEAL_KINDS.sale, trade);

    marketGood.stock = rn(marketGood.stock + units, 2);
    this.movePrice(market, good, -units);
    return trade;
  }

  /** Adds a trade to the burg's deal with the market in the good and kind */
  recordDeal(burgId: number, marketId: number, goodId: number, kind: DealKind, trade: Trade) {
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
    return this.marginOf(this.get(marketId), kind, { units, price, tax, tariff, carriage });
  }

  /** The share a market buys below and sells above its price, in whole percents: the base margin, raised by the license fee its center paid */
  getMarginRate(market?: Market): number {
    return Math.round(MARKET_MARGIN * Math.sqrt(1 + (market?.feePaid || 0) / MARKET_FEE_DETERRENCE) * 100) / 100;
  }

  /** The margin in a trade: the market's spread between its own price and the price it buys or sells at, before taxes and carriage */
  private marginOf(
    market: Market | undefined,
    kind: DealKind,
    { units, price, tax, tariff = 0, carriage = 0 }: Trade
  ): number {
    if (kind === DEAL_KINDS.kept || !units) return 0;
    const rate = this.getMarginRate(market);
    if (kind === DEAL_KINDS.sale) return (units * (price + carriage) * rate) / (1 - rate);
    const marketPrice = price - (tax + tariff) / units - carriage;
    return (units * marketPrice * rate) / (1 + rate);
  }

  /** The center burg's merchants take the margin as the trade happens, so the hub can spend it the same day */
  private payMargin(market: Market, kind: DealKind, trade: Trade): void {
    this.payMarginAmount(market, this.marginOf(market, kind, trade));
  }

  private payMarginAmount(market: Market, amount: number): void {
    const center = pack.burgs[market.centerBurgId];
    if (!center?.i || center.removed) return;
    center.treasury = rn((center.treasury || 0) + amount, 2);
  }

  /** An import is a purchase from a market of another state than the burg's own market: only an import may pay a tariff */
  isImport(deal: Deal): boolean {
    if (deal[3] === DEAL_KINDS.sale) return false;
    const { taxState, tariffState } = this.getTaxStates(deal);
    return isForeign(taxState, tariffState);
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
      if (!state?.i || state.removed || !Array.isArray(state.economy.tariffs) || !state.economy.tariffs.length)
        continue;
      const entry: CompiledStateTariffs = {
        byStateAndGood: new Map(),
        byStateAllGoods: new Map(),
        allStatesByGood: new Map(),
        allStatesAllGoods: undefined
      };
      for (const rule of state.economy.tariffs) {
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
      if (!isForeign(ownerStateId, otherStateId)) return 0;
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

  /** Per-unit taxes on a good bought from a source market for a burg of another market: the source's sales tax and, from another state, the importer's tariff. Null under an embargo */
  getTradeTerms(): TradeTerms {
    const resolveTariff = this.compileTariffs();
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
      const importerPolicy = resolveTariff(pair.importerStateId, pair.exporterStateId, goodId);
      const exporterPolicy = resolveTariff(pair.exporterStateId, pair.importerStateId, goodId);
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
    const own = this.get(burg.market);
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
        isImport: isForeign(this.getMarketState(source), this.getMarketState(own)),
        carriage: carriage === Infinity ? 0 : rn(carriage, 2),
        buyPrice: 0
      };
      if (excluded) option.excluded = excluded;
      else option.buyPrice = rn(option.price + option.tax + option.tariff + option.carriage, 2);
      return option;
    });
    return options.sort((a, b) => Number(!!a.excluded) - Number(!!b.excluded) || a.buyPrice - b.buyPrice);
  }

  /** The market a good reaches the burg cheapest from, with its stock and the burg's buy price */
  quoteSource(burg: Burg, good: Good, terms: TradeTerms): SourceQuote | null {
    const market = this.get(burg.market);
    if (!market) return null;

    let best: SourceQuote | null = null;
    for (const source of pack.markets) {
      const row = source.goods[good.i];
      if (source === market || !row || row.stock <= 0.01) continue;
      const transport = this.getTransport(source, burg, good);
      const basePrice = this.customerBuyPrice(source, row.price);
      if (transport === Infinity || (best && basePrice + transport >= best.buyPrice)) continue; // taxes only add to it
      const costs = terms(source, market, good, row.price);
      if (!costs) continue;
      const buyPrice = rn(basePrice + costs.taxPerUnit + costs.tariffPerUnit + transport, 2);
      if (!best || buyPrice < best.buyPrice) best = { source, stock: row.stock, buyPrice };
    }
    return best;
  }

  /** Price with the margin, the source's sales tax, the tariff and the carriage from the source's center to the burg; null when it cannot come */
  private getSourcePrice(source: Market, market: Market, burg: Burg, good: Good, terms: TradeTerms): number | null {
    const price = source.goods[good.i]?.price ?? good.value;
    const costs = terms(source, market, good, price);
    const transport = this.getTransport(source, burg, good);
    if (!costs || transport === Infinity) return null;
    return rn(this.customerBuyPrice(source, price) + costs.taxPerUnit + costs.tariffPerUnit + transport, 2);
  }

  /** The burg buys a good from another market, paying taxes, margin and carriage */
  buyFromSource({
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
    const price = this.getSourcePrice(source, market, burg, good, terms);
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
    this.payMargin(source, kind, trade);

    this.takeStock(source, good, actualUnits);
    return trade;
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
      if (!burg.i || burg.removed || !burg.market || !burg.population) continue;
      if (!populationByMarket[burg.market]) populationByMarket[burg.market] = 0;
      populationByMarket[burg.market] += burg.population;
    }
    return populationByMarket;
  }
}

export const Markets = new MarketsModule();
