import { sum } from "d3";
import { noExpenses } from "@/data/expenses";
import type { Burg } from "@/model/political/burgs-generator";
import type { DealKind, Good, Market, Transaction } from "@/types/economy";
import { log } from "@/utils/logger";
import { rn } from "@/utils/number-utils";
import { DEAL_KINDS } from "./deals";
import {
  DEMAND_PRIORITY,
  getDemandTargets,
  getNeedsCost,
  getVarietyShares,
  NOVELTY,
  SAVINGS_RATE,
  WANT_LIMITS,
  WANT_SHARES,
  WEALTH_WANTS
} from "./demand";
import { EconomyDebug } from "./economy-debug";
import { Goods } from "./goods-generator";
import { Markets } from "./markets-generator";
import { Output } from "./output";
import { Prosperity } from "./prosperity";
import { StateOrders } from "./state-orders";
import { Taxes } from "./taxes";
import { MIN_LOCAL_STOCK, type Outlet, type SourceOption, type SourceQuote, Trade, type TradeTerms } from "./trade";

export const MAX_DEPOSIT_VALUE = 200; // most base value a burg's deposit yields a day, so a large burg cannot grind a gemstone mine
export const DEPOSIT_OUTPUT = 2; // units a worker gets a day from the burg's own deposit, before multipliers
const MAX_WORKERS = 300;
export const WORKFORCE_SHARE = 0.32; // townspeople working in trades; the rest serve, build, farm or are too young or old
const WORKERS_PER_TURN = 5;
const MAX_CLEARING_PASSES = 3; // outlets a burg tries for its leftovers on its last turn
const LOT_DEPTH_SHARE = 0.5; // a step sells at most this share of a day's sales where it sells
const MIN_STEP = 0.5; // fewest workers in a step, so a thin market does not take endless decisions
const MIN_PURCHASE = 1; // fewest coins a burg spends on a good, so it buys fewer goods in bigger lots
const MIN_SMALL_PURCHASE = 0.25; // the same when all it has for the need or want is less than MIN_PURCHASE
export const BURG_SPECIALIZATION = 1.89;
export const MARKET_SPECIALIZATION = 0.6;

/** A burg's day in the run */
type BurgDay = {
  burg: Burg;
  market: Market;
  workers: number; // its workforce
  inventory: number[];
  produced: number[]; // by good, what its deposit yielded included
  deposit: Good | undefined; // the good of the burg's cell, worked in place of its recipes
  depositLeft: number; // units the deposit can still yield this run
  goals: Good[]; // what it can make: goods with recipes, and its deposit's
  log?: ProductionLogEntry[]; // kept only in debug mode
  taxRate: number; // the burg's sales tax, paid on what it sells
  ingredientCosts: number;
  revenue: number;
  workersUsed: number;
  spent: number; // on the burg's needs and wants this run
  settled: number; // the treasury after the burg last bought for its people
  outlets: QuoteCache<Outlet | null>; // the market paying the most at the burg's door
  covered: number[]; // by demand category: what the burg's purchases covered so far this run
  consumed: number[]; // by good: units the burg bought or kept for itself this run
  workersByGood: number[]; // workers put into each good this run, for division of labor
  activeGoalGoodId: number | null;
  sources: QuoteCache<SourceQuote | null>; // cheapest other market, null when none
  modifiers: number[]; // by good: getModifiers at the burg's cell
};

type ProductionIndex = {
  demandCoverageByGood: number[][];
  demandGoodsByCategory: DemandGoodCandidate[][];
  recipesByOutput: Recipe[][];
  productiveGoods: Good[];
  tradeTerms: TradeTerms;
  chainInputs: Map<number, Set<number>>; // by goal good: every input down its chain
  marketWorkers: number[][]; // by market then good: workers the market's burgs put into it this run
  marketWorkforce: number[]; // by market: the workers its burgs have
  worldWorkers: number[]; // by good: workers all burgs put into it this run
  worldWorkforce: number; // the workers all burgs have
  needsCost: number; // a person's daily needs at the cheapest coverage at base prices
};

type PlannedAction = {
  good: Good;
  ingredients: Ingredient[];
  maxYield: number;
};

type Recipe = { good: Good; ingredients: Ingredient[] };
type Ingredient = { goodId: number; amount: number };

type PlanningStock = { inventory: number[]; market: number[] };
type RankedGoal = { good: Good; bound: number; step: number; saleValue: number }; // bound orders the planning
type MarketQuote = ReturnType<typeof Trade.quoteMarket> & { source: Market; sourceCarriage: number }; // source: where the burg buys

/** Quotes by good; an earlier turn's holds while no market's row of the good has changed */
type QuoteCache<T> = { turn: number; quotes: ({ value: T; turn: number; revision: number } | undefined)[] };

type DemandGoodCandidate = { good: Good; goodId: number; coverageWeight: number };

type ProductionDecision = {
  action: PlannedAction;
  candidates: ProductionCandidate[];
  goalGoodId: number | null;
  runnerUp: number; // the best other goal's gain a worker, or at most this
};

export type ProductionCandidate = {
  goodId: number;
  units: number;
  sellPrice: number;
  ingredientCost: number;
  modifier: number;
  score: number;
  ingredients: readonly Ingredient[];
  goalGoodId?: number;
  isPreparation?: boolean;
  gainPerWorker?: number; // set for prep candidates: goal projected gain per worker
  workersNeeded?: number; // total workers in the chain (prep + goal)
};

type GoalActionPlan = {
  goalGoodId: number;
  workersNeeded: number;
  marketCost: number;
  projectedGain: number;
  normalizedGain: number;
  action: PlannedAction;
  candidate: ProductionCandidate;
};

type ProductionRecipeEntry = { goodId: number; units: number };

type ManufacturingEntry = {
  goodId: number;
  units: number;
  workers: number;
  recipe: ProductionRecipeEntry[]; // empty for the burg's deposit
  modifier?: number; // omitted when 1
  specialization?: number; // division of labor factor, omitted when 1
  candidates: readonly ProductionCandidate[];
};

type TradeEntry = { goodId: number; market: number; kind: DealKind; sources?: SourceOption[] } & Transaction;

/** A demand category's shortage when the burg came to fill it, and its goods, cheapest first */
type DemandEntry = {
  category: number; // index in DEMAND_PRIORITY
  shortage: number;
  options: { goodId: number; coverage: number; costPerCoverage: number; market: number; kept: boolean }[];
};

/** One step of a burg's production run, logged in debug mode */
export type ProductionLogEntry = ManufacturingEntry | TradeEntry | DemandEntry;

export class ProductionModule {
  regenerate(): void {
    Markets.claimWaterDeposits();
    pack.deals = [];
    for (const market of pack.markets) market.goods = {};
    this.produce();
    Taxes.collect();
  }

  /** Forgets the run when what it names is gone; adjustments stay */
  clear(): void {
    pack.deals = [];
    EconomyDebug.clear();
    for (const market of pack.markets) {
      market.goods = {};
      market.feePaid = 0;
      delete market.rural;
    }
    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed) continue;
      burg.product = 0;
      burg.production = [];
      burg.pollTaxPaid = 0;
      burg.treasury = sum(burg.adjustments ?? [], line => line.value);
    }
    for (const state of pack.states) if (state.i && !state.removed) state.economy.spent = noExpenses();
    pack.cells.prosperity = new Uint8Array(pack.cells.i.length);
    Taxes.collect();
  }

  produce() {
    Output.forgetZones(); // rebuild lookup to reflect any in-place zone edits
    // licenses first: the margin rate follows them
    for (const market of pack.markets) {
      const center = pack.burgs[market.centerBurgId];
      market.feePaid = center?.i && !center.removed ? Markets.getFee(center.state || 0) : 0;
    }
    Trade.billLicenses();

    const rural = Output.getRural();
    Trade.collectRuralProduction(rural);
    Trade.initializeMarketPrices();
    Trade.measureRoutes();
    const recording = EconomyDebug.start();

    const index = this.buildProductionIndex(options.map.goods);
    const sortedBurgs = this.getTurnOrder(pack.burgs.filter(burg => burg.i && !burg.removed));

    const days: BurgDay[] = [];
    for (const burg of sortedBurgs) {
      const market = Markets.ofBurg(burg);
      burg.pollTaxPaid = market ? rn(Taxes.getPollTaxDue(burg.state || 0, burg.population || 0), 2) : 0;
      burg.treasury = sum(burg.adjustments ?? [], line => line.value) - burg.pollTaxPaid;
      if (market) days.push(this.createBurgDay(index, burg, market, recording));
      else {
        burg.product = 0; // out of every market: nothing made
        burg.production = [];
      }
    }
    StateOrders.start();
    for (const { market, workers } of days) {
      index.marketWorkforce[market.i] = (index.marketWorkforce[market.i] || 0) + workers;
      index.worldWorkforce += workers;
    }

    // a few workers a turn, so the first in line cannot drain a market alone
    let working = days;
    while (working.length) {
      let worked = false;
      working = working.filter(day => {
        const before = day.workersUsed;
        const hasWork = this.runWorkerLoop(index, day, WORKERS_PER_TURN);
        worked ||= day.workersUsed > before; // a burg putting its last workers to work worked too
        // inputs made for the chain still under way wait for its next step
        const inputs = hasWork ? this.getChainInputs(index, day.activeGoalGoodId) : null;
        // a burg with idle workers tries again next round: buyers in between move the prices that idled it
        const isDone = !hasWork && day.workersUsed >= day.workers - 0.001;
        this.sellInventoryToMarket(index, day, goodId => !inputs?.has(goodId));
        // on its last turn, what one outlet refused is offered to the next best
        for (let pass = 0; isDone && pass < MAX_CLEARING_PASSES && this.sellInventoryToMarket(index, day); pass++);
        this.fillDemand(index, day, hasWork && day.workers ? day.workersUsed / day.workers : 1);
        this.spendOnWants(index, day);
        day.settled = day.burg.treasury || 0;
        return !isDone;
      });
      for (const market of pack.markets) Trade.spendRural(market);
      StateOrders.place();
      if (!worked) break;
    }
    Trade.settleLicenses();
    // money after a burg's last turn, as a center's margin, is spent too
    for (const day of days) {
      if ((day.burg.treasury || 0) <= day.settled + 0.01) continue;
      this.fillDemand(index, day);
      this.spendOnWants(index, day);
    }
    StateOrders.place(true);
    Trade.endRun();
    StateOrders.end();
    pack.deals = pack.deals.filter(([, , , , units]) => units > 0); // sales kept back whole
    pack.cells.prosperity = Prosperity.getCellsProsperity(rural);

    // unrounded mid-run so sub-cent margins add up; a center with no market has them too; no -0
    for (const burg of sortedBurgs) burg.treasury = rn(burg.treasury || 0, 2) || 0;
    for (const { burg, produced, revenue, ingredientCosts, log } of days) {
      burg.product = rn(revenue - ingredientCosts, 2);
      burg.production = produced.flatMap((units, goodId) => (units ? [[goodId, rn(units, 2)]] : []));
      if (log) EconomyDebug.set(burg.i!, log);
    }
  }

  getTurnOrder(burgs: Burg[]): Burg[] {
    const development = pack.cells.development;
    const weight = (burg: Burg) => Math.sqrt(burg.population || 0) * development[burg.cell];
    return burgs.sort((a, b) => weight(b) - weight(a));
  }

  private buildProductionIndex(goods: Good[]): ProductionIndex {
    const demandCoverageByGood = this.buildDemandCoverageByGood(goods);
    const demandGoodsByCategory = this.buildDemandGoodsByCategory(goods, demandCoverageByGood);
    const recipes = this.buildRecipesArray(goods);
    const recipesByOutput = this.buildRecipesByOutput(recipes);
    const productiveGoods = goods.filter(good => recipesByOutput[good.i]?.length);

    return {
      demandCoverageByGood,
      demandGoodsByCategory,
      recipesByOutput,
      productiveGoods,
      tradeTerms: Trade.getTradeTerms(),
      chainInputs: new Map(),
      marketWorkers: [],
      marketWorkforce: [],
      worldWorkers: [],
      worldWorkforce: 0,
      needsCost: getNeedsCost(goods)
    };
  }

  getWorkers(burg: Burg): number {
    return Math.min(rn((burg.population || 0) * WORKFORCE_SHARE, 2), MAX_WORKERS);
  }

  private createBurgDay(index: ProductionIndex, burg: Burg, market: Market, recording = false): BurgDay {
    const workers = this.getWorkers(burg);
    if (workers === MAX_WORKERS) log.warn(`Burg ${burg.name} (${burg.i}) workforce is capped at ${MAX_WORKERS}`);
    const deposit = Goods.get(pack.cells.good[burg.cell]);
    const goals =
      deposit && !index.productiveGoods.includes(deposit) ? [...index.productiveGoods, deposit] : index.productiveGoods;

    return {
      burg,
      market,
      workers,
      inventory: [],
      produced: [],
      log: recording ? [] : undefined,
      deposit,
      depositLeft: deposit?.value ? MAX_DEPOSIT_VALUE / deposit.value : Infinity,
      goals,
      taxRate: Taxes.getSalesTax(burg),
      ingredientCosts: 0,
      revenue: 0,
      workersUsed: 0,
      spent: 0,
      settled: 0,
      outlets: { turn: 0, quotes: [] },
      covered: new Array(DEMAND_PRIORITY.length).fill(0),
      consumed: [],
      workersByGood: [],
      activeGoalGoodId: null,
      sources: { turn: 0, quotes: [] },
      modifiers: []
    };
  }

  /** Spends up to `workers` of its remaining workers; false once none are left or nothing pays */
  private runWorkerLoop(index: ProductionIndex, day: BurgDay, workers = day.workers): boolean {
    let used = 0;
    day.sources.turn++; // other burgs traded since the last turn
    day.outlets.turn++;

    let runnerUp = Infinity; // the best other goal's gain a worker at the last decision
    while (used < workers - 0.001) {
      const workersLeft = day.workers - day.workersUsed;
      const workerFraction = Math.min(1, workersLeft, workers - used);
      if (workerFraction <= 0.001) return false;

      let decision = this.continueGoal(index, day, workersLeft, workerFraction, runnerUp);
      if (!decision) {
        decision = this.makeProductionDecision(index, day, day.activeGoalGoodId, workersLeft, workerFraction);
        if (!decision) return false;
        runnerUp = decision.runnerUp;
      }

      day.activeGoalGoodId = decision.goalGoodId;
      const spent = this.executeManufacture(index, day, decision, workerFraction);
      used += spent;
      day.workersUsed += spent;
      // sold at once, so the next worker sees the moved price; a chain's inputs wait for their step
      if (decision.action.good.i === decision.goalGoodId)
        this.sellInventoryToMarket(index, day, goodId => goodId === decision.goalGoodId);
    }

    return true;
  }

  /** Makes the decided good; returns the workers it took */
  private executeManufacture(
    index: ProductionIndex,
    day: BurgDay,
    decision: ProductionDecision,
    workerFraction: number
  ): number {
    const { good, ingredients, maxYield } = decision.action;
    const modifier = this.getBurgModifiers(day, good);
    const specialization = this.getSpecialization(index, day, good.i);
    const output = modifier * specialization; // units a worker makes
    let actualYield = Math.min(workerFraction, maxYield);
    if (!ingredients.length) actualYield = Math.min(actualYield, day.depositLeft / output); // the deposit yields no more
    const produced = rn(actualYield * output, 2);
    if (!produced) return workerFraction;

    for (const ingredient of ingredients) {
      const ingredientId = ingredient.goodId;
      const amount = actualYield * ingredient.amount;
      // trades go in hundredths: buy the shortfall rounded up, so no input is made from nothing
      const shortfall = amount - Math.min(day.inventory[ingredientId] || 0, amount);
      const fromMarket = Math.ceil(shortfall * 100 - 1e-6) / 100;
      if (fromMarket <= 0) continue;

      const trade = this.acquire(index, day, Goods.get(ingredientId)!, fromMarket, DEAL_KINDS.input);
      if (trade) {
        const marketCost = trade.units * trade.price;
        day.ingredientCosts += marketCost;
        day.burg.treasury = (day.burg.treasury || 0) - marketCost;
        day.inventory[ingredientId] = (day.inventory[ingredientId] || 0) + trade.units;
      }
      // short of an input, the step makes nothing: what was bought waits in the inventory
      if (!trade || trade.units < fromMarket) {
        const message = `Failed to acquire ${rn(fromMarket, 2)} units of ${Goods.get(ingredientId)?.name} from market for production of ${good.name}`;
        log.error(message);
        return workerFraction;
      }
    }

    const recipe: ProductionRecipeEntry[] = [];
    for (const ingredient of ingredients) {
      const amount = actualYield * ingredient.amount;
      recipe.push({ goodId: ingredient.goodId, units: rn(amount, 2) });
      const left = (day.inventory[ingredient.goodId] || 0) - amount;
      day.inventory[ingredient.goodId] = left < 0.01 ? 0 : left; // a purchase rounded up leaves crumbs, not stock
    }

    if (!ingredients.length) day.depositLeft -= produced;
    day.inventory[good.i] = (day.inventory[good.i] || 0) + produced;
    day.produced[good.i] = (day.produced[good.i] || 0) + produced;
    day.workersByGood[good.i] = (day.workersByGood[good.i] || 0) + actualYield;
    index.marketWorkers[day.market.i] ??= [];
    const marketWorkers = index.marketWorkers[day.market.i];
    marketWorkers[good.i] = (marketWorkers[good.i] || 0) + actualYield;
    index.worldWorkers[good.i] = (index.worldWorkers[good.i] || 0) + actualYield;

    if (day.log) {
      const entry: ManufacturingEntry = {
        goodId: good.i,
        units: produced,
        workers: rn(actualYield, 2),
        recipe,
        candidates: decision.candidates
      };
      if (modifier !== 1) entry.modifier = modifier;
      if (specialization !== 1) entry.specialization = rn(specialization, 2);
      day.log.push(entry);
    }
    return actualYield; // a chain's step takes only the workers it needs, the rest go on to the next step
  }

  /** Buys at its own market while stocked enough, else the cheapest other, else what its own has */
  private acquire(
    index: ProductionIndex,
    day: BurgDay,
    good: Good,
    units: number,
    kind: DealKind,
    budget = Infinity
  ): Transaction | null {
    const { burg } = day;
    const sources = day.log && Trade.listSources(burg, good, index.tradeTerms); // before the trade moves them
    const market = this.getSupplier(index, day, good);
    if (!market) return null;
    if (market !== day.market) day.sources.quotes[good.i] = undefined; // the source's stock and price moved
    day.outlets.quotes[good.i] = undefined; // so may the best place to sell it

    const trade = Trade.buy({ burg, good, units, kind, source: market, terms: index.tradeTerms, budget });
    if (trade) day.log?.push({ goodId: good.i, market: market.i, kind, ...trade, sources: sources || undefined });
    return trade;
  }

  /** The quote `acquire` would buy at */
  private quote(index: ProductionIndex, day: BurgDay, goodId: number): MarketQuote {
    const local = Trade.quoteMarket(day.market, goodId, day.burg);
    const good = Goods.get(goodId);
    const supplier = good && this.getSupplier(index, day, good);
    const { sellPrice, carriage } = local;
    if (!supplier || supplier === day.market) {
      const stock = supplier ? local.stock : 0; // a remainder too small to buy is no stock
      return { stock, buyPrice: local.buyPrice, sellPrice, carriage, source: day.market, sourceCarriage: carriage };
    }
    const source = this.getSource(index, day, good)!;
    return {
      stock: source.stock,
      buyPrice: source.buyPrice,
      sellPrice,
      carriage,
      source: source.source,
      sourceCarriage: source.carriage
    };
  }

  private getSupplier(index: ProductionIndex, day: BurgDay, good: Good): Market | null {
    return Trade.getSupplier(day.market, good, () => this.getSource(index, day, good)?.source);
  }

  /** The turn's cheapest other market for the good, null when none sells it */
  private getSource(index: ProductionIndex, day: BurgDay, good: Good): SourceQuote | null {
    return this.cached(day.sources, good, () => Trade.quoteSource(day.burg, good, index.tradeTerms));
  }

  /** The market paying the most at the burg's door; the burg's own trades in the good drop it */
  private getOutlet(index: ProductionIndex, day: BurgDay, good: Good): Outlet | null {
    return this.cached(day.outlets, good, () => Trade.getOutlet(day.burg, good, index.tradeTerms));
  }

  /** The turn's quote; an earlier one stands while the good's market rows are unchanged */
  private cached<T>(cache: QuoteCache<T>, good: Good, quote: () => T): T {
    const revision = Trade.getRevision(good);
    const entry = cache.quotes[good.i];
    if (entry && (entry.turn === cache.turn || entry.revision === revision)) {
      entry.turn = cache.turn;
      return entry.value;
    }
    const value = quote();
    cache.quotes[good.i] = { value, turn: cache.turn, revision };
    return value;
  }

  private quotedSource(day: BurgDay, goodId: number): SourceQuote | null | undefined {
    const entry = day.sources.quotes[goodId];
    return entry?.turn === day.sources.turn ? entry.value : undefined;
  }

  /** The burg sold only what it made, so only that can be kept */
  private quoteKeep(day: BurgDay, good: Good) {
    return day.produced[good.i] ? Trade.quoteKeep(day.burg, good) : null;
  }

  /** Logs the category's shortage and the goods that could cover it, cheapest coverage first */
  private logDemand(
    day: BurgDay,
    category: number,
    shortage: number,
    sorted: { candidate: DemandGoodCandidate; costPerCoverage: number; kept: boolean }[]
  ): void {
    const options = sorted.map(({ candidate, costPerCoverage, kept }) => {
      const local = (day.market.goods[candidate.goodId]?.stock || 0) >= MIN_LOCAL_STOCK;
      const market =
        kept || local ? day.market.i : (this.quotedSource(day, candidate.goodId)?.source.i ?? day.market.i);
      return {
        goodId: candidate.goodId,
        coverage: candidate.coverageWeight,
        costPerCoverage: rn(costPerCoverage, 2),
        market,
        kept
      };
    });
    day.log!.push({ category, shortage: rn(shortage, 2), options });
  }

  /** Sells the chosen inventory goods, all by default, where each fetches most; unsold ones wait. True if any sold */
  private sellInventoryToMarket(
    index: ProductionIndex,
    day: BurgDay,
    sells: (goodId: number) => boolean = () => true
  ): boolean {
    let sold = false;
    let phaseRevenue = 0;
    const { taxRate } = day;

    for (let goodId = 0; goodId < day.inventory.length; goodId++) {
      const units = day.inventory[goodId];
      if (!units || units <= 0 || !sells(goodId)) continue;

      const good = Goods.get(goodId)!;
      const market = this.getOutlet(index, day, good)?.market ?? day.market;
      const trade = Trade.sell({ burg: day.burg, good, units, taxRate, market, terms: index.tradeTerms });
      if (!trade) continue;
      sold = true;
      const left = units - trade.units;
      day.inventory[goodId] = left < 0.01 ? 0 : left;
      day.outlets.quotes[goodId] = undefined; // the sale moved its price
      if (market !== day.market) day.sources.quotes[goodId] = undefined; // and that market's stock

      const revenue = trade.units * trade.price - trade.tax - (trade.tariff || 0);
      phaseRevenue += revenue;
      day.log?.push({ goodId, market: market.i, kind: DEAL_KINDS.sale, ...trade });
    }

    day.revenue += phaseRevenue;
    day.burg.treasury = (day.burg.treasury || 0) + phaseRevenue;
    return sold;
  }

  private getChainInputs(index: ProductionIndex, goodId: number | null): Set<number> {
    const inputs = new Set<number>();
    if (goodId === null) return inputs;
    const cached = index.chainInputs.get(goodId);
    if (cached) return cached;
    const add = (outputId: number) => {
      for (const { ingredients } of index.recipesByOutput[outputId] || [])
        for (const { goodId: inputId } of ingredients) {
          if (inputs.has(inputId)) continue;
          inputs.add(inputId);
          add(inputId);
        }
    };
    add(goodId);
    index.chainInputs.set(goodId, inputs);
    return inputs;
  }

  private buildRecipesByOutput(recipes: Recipe[]): Recipe[][] {
    const recipesByOutput: Recipe[][] = [];
    for (const recipe of recipes) {
      const outputId = recipe.good.i;
      const list = recipesByOutput[outputId];
      if (list) list.push(recipe);
      else recipesByOutput[outputId] = [recipe];
    }
    return recipesByOutput;
  }

  private buildDemandCoverageByGood(goods: Good[]): number[][] {
    const demandCoverageByGood: number[][] = [];

    for (const good of goods) {
      const coverage: number[] = Array(DEMAND_PRIORITY.length).fill(0);
      for (let category = 0; category < DEMAND_PRIORITY.length; category++) {
        coverage[category] = good.demandCoverage?.[DEMAND_PRIORITY[category]] || 0;
      }
      demandCoverageByGood[good.i] = coverage;
    }

    return demandCoverageByGood;
  }

  private buildDemandGoodsByCategory(goods: Good[], demandCoverageByGood: number[][]): DemandGoodCandidate[][] {
    const demandGoodsByCategory: DemandGoodCandidate[][] = Array.from({ length: DEMAND_PRIORITY.length }, () => []);

    for (const good of goods) {
      const coverage = demandCoverageByGood[good.i];
      if (!coverage) continue;

      for (let category = 0; category < DEMAND_PRIORITY.length; category++) {
        const coverageWeight = coverage[category] || 0;
        if (coverageWeight <= 0) continue;
        demandGoodsByCategory[category].push({ good, goodId: good.i, coverageWeight });
      }
    }

    for (const candidates of demandGoodsByCategory) {
      candidates.sort(
        (a, b) => b.coverageWeight - a.coverageWeight || a.good.value - b.good.value || a.goodId - b.goodId
      );
    }

    return demandGoodsByCategory;
  }

  /** Buys the share of its needs due so far, a poor burg only the cheapest; the rest waits a turn */
  private fillDemand(index: ProductionIndex, day: BurgDay, share = 1): void {
    const { burg, covered } = day;
    const demandTargets = getDemandTargets(burg.population || 0).map(target => target * share);
    const poor = this.getAffluence(index, day) < share; // earns less than the needs due: only the cheapest will do
    if (poor && (burg.treasury || 0) <= 0.01) return; // nothing to buy with, nor a want to signal
    day.sources.turn++; // other burgs traded since its last turn

    for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
      let shortage = Math.max(0, demandTargets[categoryIndex] - covered[categoryIndex]);
      if (shortage <= 0.001) continue;

      const sortedCandidates: { candidate: DemandGoodCandidate; costPerCoverage: number; kept: boolean }[] = [];
      const missing: { candidate: DemandGoodCandidate; costPerCoverage: number }[] = []; // goods nobody stocks
      for (const candidate of index.demandGoodsByCategory[categoryIndex]) {
        const own = this.quoteKeep(day, candidate.good);
        const quote = this.quote(index, day, candidate.goodId);
        if (!own && quote.stock <= 0.01) {
          if (poor) continue; // the poor signal no shortage
          const costPerCoverage =
            Trade.quoteMarket(day.market, candidate.goodId, burg).buyPrice / candidate.coverageWeight;
          if (costPerCoverage > 0) missing.push({ candidate, costPerCoverage });
          continue;
        }
        const price = own ? Math.min(own.price, quote.buyPrice) : quote.buyPrice;
        const kept = Boolean(own && own.price <= quote.buyPrice); // as the purchase below decides
        sortedCandidates.push({ candidate, costPerCoverage: price / candidate.coverageWeight, kept });
      }
      sortedCandidates.sort((a, b) => a.costPerCoverage - b.costPerCoverage);
      if (day.log) this.logDemand(day, categoryIndex, shortage, sortedCandidates);

      const cover = (candidate: DemandGoodCandidate, trade: Transaction | null) => {
        if (!trade) return;
        this.consume(index, day, candidate.goodId, trade);
        shortage = Math.max(0, demandTargets[categoryIndex] - covered[categoryIndex]);
      };
      // what the burg sold to its own market is kept back first when cheaper than buying it
      const buy = (candidate: DemandGoodCandidate, coverageWanted: number) => {
        const budget = burg.treasury || 0;
        if (budget <= 0.01 || coverageWanted <= 0.001) return;
        let units = coverageWanted / candidate.coverageWeight;
        const own = this.quoteKeep(day, candidate.good);
        if (own && own.price <= this.quote(index, day, candidate.goodId).buyPrice) {
          const kept = Trade.keep({ burg, good: candidate.good, units, budget });
          if (kept) {
            day.revenue -= kept.units * kept.price; // as if it never sold them
            day.outlets.quotes[candidate.goodId] = undefined; // taking it back moved its price
            day.log?.push({ goodId: candidate.goodId, market: day.market.i, kind: DEAL_KINDS.kept, ...kept });
            units -= kept.units;
          }
          cover(candidate, kept);
        }
        if (units < 0.01) return;
        cover(candidate, this.acquire(index, day, candidate.good, units, DEAL_KINDS.demand, burg.treasury || 0));
      };

      // a good nobody stocks turns its buyers away, which is demand too
      if (!poor) {
        const options = [...sortedCandidates, ...missing];
        const wanted = shortage;
        const shares = this.getLotShares(
          this.getShares(index, day, categoryIndex, options),
          k => k < sortedCandidates.length,
          k => wanted * options[k].costPerCoverage,
          burg.treasury || 0
        );
        options.forEach(({ candidate }, k) => {
          if (k >= sortedCandidates.length)
            Trade.signalShortage(day.market, candidate.good, (wanted * shares[k]) / candidate.coverageWeight);
          else buy(candidate, Math.min(shortage, wanted * shares[k]));
        });
      }
      for (const { candidate } of sortedCandidates) {
        if (shortage <= 0.001 || (burg.treasury || 0) <= 0.01) break;
        buy(candidate, shortage);
      }
    }
  }

  private getAffluence(index: ProductionIndex, day: BurgDay): number {
    const income = (day.burg.treasury || 0) + day.spent;
    const perPerson = day.burg.population ? income / day.burg.population : 0;
    return index.needsCost ? perPerson / index.needsCost : 1;
  }

  /** Shares of a need's spending by price per coverage; richer burgs pay more for goods they lack */
  private getShares(
    index: ProductionIndex,
    day: BurgDay,
    category: number,
    options: { candidate: DemandGoodCandidate; costPerCoverage: number }[]
  ): number[] {
    const bonus = NOVELTY * Math.log10(Math.max(1, this.getAffluence(index, day)));
    const covered = day.covered[category];
    return getVarietyShares(
      options.map(({ candidate, costPerCoverage }) => {
        const had = covered
          ? Math.min(1, ((day.consumed[candidate.goodId] || 0) * candidate.coverageWeight) / covered)
          : 0;
        return costPerCoverage / (1 + bonus * (1 - had));
      })
    );
  }

  /** Drops `buyable` options with too small a lot, their money going to the rest */
  private getLotShares(
    shares: number[],
    buyable: (k: number) => boolean,
    cost: (k: number) => number,
    budget: number
  ): number[] {
    let kept = shares.flatMap((share, k) => (share > 0 && buyable(k) ? [k] : []));
    if (kept.length < 2) return shares;
    const sum = (list: number[], value: (k: number) => number) => list.reduce((total, k) => total + value(k), 0);
    const total = sum(kept, k => shares[k]);
    const full = sum(kept, k => shares[k] * cost(k));
    const affordable = full > budget ? budget / full : 1; // what it spends on each as it runs out of money
    const least = Math.min(full, budget) < MIN_PURCHASE ? MIN_SMALL_PURCHASE : MIN_PURCHASE;
    const lot = (k: number, raised: number) => shares[k] * raised * cost(k) * affordable;

    for (;;) {
      const raised = total / sum(kept, k => shares[k]);
      const enough = kept.filter(k => lot(k, raised) >= least);
      if (enough.length === kept.length) break;
      if (!enough.length) {
        kept = [kept.reduce((best, k) => (lot(k, raised) > lot(best, raised) ? k : best))]; // too little for any lot: the largest
        break;
      }
      kept = enough;
    }

    const raised = total / sum(kept, k => shares[k]);
    return shares.map((share, k) => (buyable(k) ? (kept.includes(k) ? share * raised : 0) : share));
  }

  /** Spends what the burg can spare beyond its needs, up to (1 - savings) of its income */
  private spendOnWants(index: ProductionIndex, day: BurgDay): void {
    const { burg } = day;
    const income = (burg.treasury || 0) + day.spent;
    const budget = Math.min(burg.treasury || 0, (1 - SAVINGS_RATE) * income - day.spent);
    if (budget <= 0.01) return;

    const targets = getDemandTargets(burg.population || 0);
    const affluence = Math.max(1, this.getAffluence(index, day));
    let left = budget;
    DEMAND_PRIORITY.forEach((category, categoryIndex) => {
      // wealth wants take what the capped wants leave
      let money = WEALTH_WANTS.includes(category) ? left : budget * WANT_SHARES[category];
      const limit = WANT_LIMITS[category] * (WEALTH_WANTS.includes(category) ? Math.sqrt(affluence) : 1);
      const cap = () => targets[categoryIndex] * (1 + limit) - day.covered[categoryIndex];
      if (money <= 0.01 || cap() <= 0.001) return;
      const options = index.demandGoodsByCategory[categoryIndex]
        .map(candidate => {
          const quote = this.quote(index, day, candidate.goodId);
          const price =
            quote.stock > 0.01 ? quote.buyPrice : Trade.quoteMarket(day.market, candidate.goodId, burg).buyPrice;
          return { candidate, stocked: quote.stock > 0.01, price, costPerCoverage: price / candidate.coverageWeight };
        })
        .filter(({ price }) => price > 0);
      if (!options.length) return;
      const total = money;
      const shares = this.getLotShares(
        this.getShares(index, day, categoryIndex, options),
        k => options[k].stocked,
        () => total,
        total
      );
      const purchase = (candidate: DemandGoodCandidate, price: number, spend: number) => {
        const units = Math.min(spend / price, cap() / candidate.coverageWeight);
        if (spend <= 0.01 || units < 0.01) return;
        const trade = this.acquire(index, day, candidate.good, units, DEAL_KINDS.demand, spend);
        if (!trade) return;
        const cost = this.consume(index, day, candidate.goodId, trade);
        money -= cost;
        left -= cost;
      };
      options.forEach(({ candidate, stocked, price }, k) => {
        if (stocked) purchase(candidate, price, Math.min(money, total * shares[k]));
        else
          Trade.signalShortage(
            day.market,
            candidate.good,
            Math.min((total * shares[k]) / price, cap() / candidate.coverageWeight)
          );
      });
      const stocked = options
        .map((option, k) => ({ ...option, share: shares[k] }))
        .filter(option => option.stocked && option.share > 0)
        .sort((a, b) => b.share - a.share); // what is left goes to the goods the burg favors most
      for (const { candidate } of stocked) {
        if (money <= 0.01 || cap() <= 0.001) break;
        purchase(candidate, this.quote(index, day, candidate.goodId).buyPrice, money);
      }
    });
  }

  /** Pays for what the burg bought for itself and counts the needs covered; returns the cost */
  private consume(index: ProductionIndex, day: BurgDay, goodId: number, trade: Transaction): number {
    const cost = trade.units * trade.price;
    day.burg.treasury = (day.burg.treasury || 0) - cost;
    day.spent += cost;
    day.consumed[goodId] = (day.consumed[goodId] || 0) + trade.units;
    const coverage = index.demandCoverageByGood[goodId];
    for (let i = 0; i < DEMAND_PRIORITY.length; i++) day.covered[i] += trade.units * (coverage[i] || 0);
    return cost;
  }

  private getWorkerOutput(index: ProductionIndex, day: BurgDay, good: Good): number {
    return this.getBurgModifiers(day, good) * this.getSpecialization(index, day, good.i);
  }

  private isWorkingDeposit(day: BurgDay, good: Good): boolean {
    return good === day.deposit && day.depositLeft >= 0.01;
  }

  /** The good's modifiers at the burg, fixed for the run; a deposit gives more while it lasts */
  private getBurgModifiers(day: BurgDay, good: Good): number {
    day.modifiers[good.i] ??= Output.getModifiers(good, day.burg.cell);
    return day.modifiers[good.i] * (this.isWorkingDeposit(day, good) ? DEPOSIT_OUTPUT : 1);
  }

  /** Working its deposit of the good while that lasts, otherwise the good's recipes */
  private getRecipes(index: ProductionIndex, day: BurgDay, good: Good): Recipe[] | undefined {
    return this.isWorkingDeposit(day, good) ? [{ good, ingredients: [] }] : index.recipesByOutput[good.i];
  }

  private getSpecialization(index: ProductionIndex, day: BurgDay, goodId: number): number {
    const own = day.workers ? (day.workersByGood[goodId] || 0) / day.workers : 0;
    const marketWorkforce = index.marketWorkforce[day.market.i];
    const market = marketWorkforce ? (index.marketWorkers[day.market.i]?.[goodId] || 0) / marketWorkforce : 0;
    const world = index.worldWorkforce ? (index.worldWorkers[goodId] || 0) / index.worldWorkforce : 0;
    const excess = world ? Math.min(Math.max(market / world - 1, 0), 1) : 0;
    return 1 + BURG_SPECIALIZATION * Math.min(own, 1) + MARKET_SPECIALIZATION * excess;
  }

  /** Output value per worker: the lot's best price less sales tax, as input prices include theirs */
  private getSaleValue(index: ProductionIndex, day: BurgDay, good: Good, modifier: number, workers: number): number {
    const units = -modifier * workers;
    const outlet = this.getOutlet(index, day, good);
    const local = Trade.quoteSale(day.market, good, day.burg);
    let price = Trade.atLot(local.sellPrice, local.carriage, day.market, good, units);
    // a lot never fetches more than a unit, so an outlet paying no more for a unit cannot win
    if (outlet && outlet.market !== day.market && outlet.price > price)
      price = Math.max(price, Trade.atLot(outlet.price, outlet.carriage, outlet.market, good, units));
    return Math.max(price, 0) * modifier * (1 - day.taxRate);
  }

  /** Cost of the units at the burg's door: the lot moves the price */
  private getLotCost(quote: MarketQuote, goodId: number, units: number): number {
    if (units <= 0) return 0;
    return units * Trade.atLot(quote.buyPrice, quote.sourceCarriage, quote.source, Goods.get(goodId)!, units);
  }

  private buildImmediateManufactureCandidate(
    index: ProductionIndex,
    day: BurgDay,
    recipe: Recipe,
    units: number,
    goalGoodId: number,
    stock: PlanningStock | undefined,
    quotes: MarketQuote[],
    saleValue: number // per worker, for a lot of the units
  ): { action: PlannedAction; candidate: ProductionCandidate } | null {
    // workers the burg's deposit still has work for; a recipe's inputs bound it below
    let maxYield = Infinity;
    if (!recipe.ingredients.length)
      maxYield = day.depositLeft >= 0.01 ? day.depositLeft / this.getWorkerOutput(index, day, recipe.good) : 0;
    let marketCostTotal = 0;

    for (const ingredient of recipe.ingredients) {
      quotes[ingredient.goodId] ??= this.quote(index, day, ingredient.goodId);
      const quote = quotes[ingredient.goodId];
      const inventoryAvailable = (stock?.inventory ?? day.inventory)[ingredient.goodId] || 0;
      const marketAvailable = stock?.market[ingredient.goodId] ?? quote.stock;
      const totalAvailable = inventoryAvailable + marketAvailable;
      if (totalAvailable < ingredient.amount * units - 0.001) return null;
      maxYield = Math.min(maxYield, totalAvailable / ingredient.amount);
    }

    if (maxYield <= 0) return null;

    const actualUnits = Math.min(units, maxYield);
    for (const ingredient of recipe.ingredients) {
      quotes[ingredient.goodId] ??= this.quote(index, day, ingredient.goodId);
      const quote = quotes[ingredient.goodId];
      const inventoryAvailable = (stock?.inventory ?? day.inventory)[ingredient.goodId] || 0;
      const amountNeeded = actualUnits * ingredient.amount;
      const fromMarket = Math.max(0, amountNeeded - Math.min(inventoryAvailable, amountNeeded));
      marketCostTotal += this.getLotCost(quote, ingredient.goodId, fromMarket);
    }

    const modifier = this.getWorkerOutput(index, day, recipe.good);
    const sellValue =
      actualUnits === units ? saleValue : this.getSaleValue(index, day, recipe.good, modifier, actualUnits);
    const ingredientCost = marketCostTotal / actualUnits;
    const score = sellValue - ingredientCost;

    return {
      action: {
        good: recipe.good,
        ingredients: recipe.ingredients,
        maxYield: Math.min(maxYield, Math.max(units, 0.01)) // a step making an input makes only what the chain lacks
      },
      candidate: {
        goodId: recipe.good.i,
        units: actualUnits,
        sellPrice: sellValue,
        ingredientCost,
        modifier: modifier,
        score,
        ingredients: recipe.ingredients,
        goalGoodId
      }
    };
  }

  private reserveRecipeInputs(
    index: ProductionIndex,
    day: BurgDay,
    recipe: Recipe,
    units: number,
    stock: PlanningStock | undefined,
    quotes: MarketQuote[]
  ) {
    const reserved: PlanningStock = {
      inventory: (stock?.inventory ?? day.inventory).slice(),
      market: stock?.market.slice() ?? []
    };
    const missing: Ingredient[] = [];
    let marketCost = 0;

    // Reserve shared inputs before recursing.
    for (const { goodId, amount } of recipe.ingredients) {
      quotes[goodId] ??= this.quote(index, day, goodId);
      const quote = quotes[goodId];
      const inventory = reserved.inventory[goodId] || 0;
      const market = reserved.market[goodId] ?? quote.stock;
      const fromInventory = Math.min(units * amount, inventory);
      const fromMarket = Math.min(units * amount - fromInventory, market);
      reserved.inventory[goodId] = inventory - fromInventory;
      reserved.market[goodId] = market - fromMarket;
      marketCost += this.getLotCost(quote, goodId, fromMarket);
      const remaining = units * amount - fromInventory - fromMarket;
      if (remaining > 0.001) missing.push({ goodId, amount: remaining });
    }

    return { reserved, missing, marketCost };
  }

  /** Plans from stocks as they are and without the deposit good's, to weigh working against buying */
  private getRecipeStocks(
    index: ProductionIndex,
    day: BurgDay,
    recipe: Recipe,
    stock: PlanningStock | undefined,
    quotes: MarketQuote[]
  ): (PlanningStock | undefined)[] {
    const { deposit } = day;
    if (!deposit || !recipe.ingredients.some(({ goodId }) => goodId === deposit.i)) return [stock];
    quotes[deposit.i] ??= this.quote(index, day, deposit.i);
    if ((stock?.market[deposit.i] ?? quotes[deposit.i].stock) <= 0.001) return [stock];
    const own: PlanningStock = {
      inventory: (stock?.inventory ?? day.inventory).slice(),
      market: stock?.market.slice() ?? []
    };
    own.market[deposit.i] = 0;
    return [stock, own];
  }

  private planGoodAction(
    index: ProductionIndex,
    day: BurgDay,
    good: Good,
    targetUnits: number,
    stepUnits: number,
    workersLeft: number,
    path: boolean[] = [],
    stock?: PlanningStock,
    quotes: MarketQuote[] = [],
    saleValue?: number // per worker, when the caller knows it
  ): GoalActionPlan | null {
    if (workersLeft <= 0 || targetUnits <= 0 || targetUnits > workersLeft + 0.001) return null;
    if (path[good.i]) return null;

    const recipeList = this.getRecipes(index, day, good);
    if (!recipeList?.length) return null;
    path[good.i] = true;

    const modifier = this.getWorkerOutput(index, day, good);
    const sellValuePerUnit = saleValue ?? this.getSaleValue(index, day, good, modifier, targetUnits);
    const totalProjectedGain = sellValuePerUnit * targetUnits;

    let bestPlan: GoalActionPlan | null = null;
    let bestStock: PlanningStock | null = null;

    for (const recipe of recipeList)
      for (const recipeStock of this.getRecipeStocks(index, day, recipe, stock, quotes)) {
        const immediate = this.buildImmediateManufactureCandidate(
          index,
          day,
          recipe,
          targetUnits,
          good.i,
          recipeStock,
          quotes,
          sellValuePerUnit
        );
        if (immediate) {
          const perUnitNetGain = immediate.candidate.score;
          const plan: GoalActionPlan = {
            goalGoodId: good.i,
            workersNeeded: targetUnits,
            marketCost: immediate.candidate.ingredientCost * targetUnits,
            projectedGain: perUnitNetGain * targetUnits,
            normalizedGain: perUnitNetGain,
            action: immediate.action,
            candidate: { ...immediate.candidate, units: Math.min(stepUnits, targetUnits) }
          };
          if (!bestPlan || plan.normalizedGain > bestPlan.normalizedGain + 0.001) {
            bestPlan = plan;
            bestStock = stock
              ? this.reserveRecipeInputs(index, day, recipe, targetUnits, recipeStock, quotes).reserved
              : null;
          }
          continue;
        }

        let workersNeeded = targetUnits;
        const reservation = this.reserveRecipeInputs(index, day, recipe, targetUnits, recipeStock, quotes);
        const { reserved, missing } = reservation;
        let marketCost = reservation.marketCost;
        let feasible = true;
        let nextActionPlan: GoalActionPlan | null = null;

        for (const ingredient of missing) {
          const ingredientGood = Goods.get(ingredient.goodId);
          if (!ingredientGood) {
            feasible = false;
            break;
          }

          // the step's workers: a worker makes more or less than a unit of the input
          const subPlan = this.planGoodAction(
            index,
            day,
            ingredientGood,
            ingredient.amount / this.getWorkerOutput(index, day, ingredientGood),
            stepUnits,
            workersLeft - workersNeeded,
            path,
            reserved,
            quotes
          );

          if (!subPlan) {
            feasible = false;
            break;
          }

          workersNeeded += subPlan.workersNeeded;
          marketCost += subPlan.marketCost;

          if (!nextActionPlan || subPlan.normalizedGain > nextActionPlan.normalizedGain + 0.001) {
            nextActionPlan = subPlan;
          }
        }

        if (!feasible || !nextActionPlan || workersNeeded > workersLeft + 0.001) continue;

        const projectedGain = totalProjectedGain - marketCost;
        const normalizedGain = projectedGain / workersNeeded;
        const action = nextActionPlan.action;
        const candidate: ProductionCandidate = {
          ...nextActionPlan.candidate,
          score: normalizedGain * Math.min(stepUnits, targetUnits),
          goalGoodId: good.i,
          isPreparation: nextActionPlan.goalGoodId !== good.i,
          gainPerWorker: normalizedGain,
          workersNeeded
        };

        const plan: GoalActionPlan = {
          goalGoodId: good.i,
          workersNeeded,
          marketCost,
          projectedGain,
          normalizedGain,
          action,
          candidate
        };
        if (!bestPlan || plan.normalizedGain > bestPlan.normalizedGain + 0.001) {
          bestPlan = plan;
          bestStock = reserved;
        }
      }

    path[good.i] = false;
    if (stock && bestStock) {
      stock.inventory = bestStock.inventory;
      stock.market = bestStock.market;
    }
    return bestPlan;
  }

  private makeProductionDecision(
    index: ProductionIndex,
    day: BurgDay,
    activeGoalGoodId: number | null,
    workersLeft: number,
    fraction: number
  ): ProductionDecision | null {
    const candidates: ProductionCandidate[] = [];
    const quotes: MarketQuote[] = []; // No trades occur within a decision.

    let activeGoal: GoalActionPlan | null = null;
    const plans: GoalActionPlan[] = [];
    let unplanned = -Infinity; // the bound of the first goal left unplanned
    let best = -Infinity;
    for (const { good, bound, step, saleValue } of this.rankGoals(index, day, activeGoalGoodId, fraction)) {
      // it and the rest cannot beat the choice: planned only for the debug log
      const beaten = unplanned > -Infinity || (plans.length > 0 && bound <= best + 0.001);
      if (beaten && unplanned === -Infinity) unplanned = bound;
      if (beaten && !day.log) break;
      const goalPlan = this.planGoodAction(index, day, good, step, step, workersLeft, [], undefined, quotes, saleValue);
      if (!goalPlan || goalPlan.projectedGain <= 0) continue;
      if (day.log) candidates.push(goalPlan.candidate); // only the debug log reads them
      if (beaten) continue;
      if (good.i === activeGoalGoodId) activeGoal = goalPlan;
      plans.push(goalPlan);
      best = Math.max(best, goalPlan.normalizedGain);
    }

    let chosenGoal: GoalActionPlan | null = null;
    for (const plan of plans)
      if (!chosenGoal || plan.normalizedGain > chosenGoal.normalizedGain + 0.001) chosenGoal = plan;
    if (activeGoal && chosenGoal && activeGoal.normalizedGain >= chosenGoal.normalizedGain) chosenGoal = activeGoal;
    if (!chosenGoal) return null;

    // what the best other goal could gain: as planned, or at most the first unplanned one's bound
    let runnerUp = unplanned;
    for (const plan of plans) if (plan !== chosenGoal) runnerUp = Math.max(runnerUp, plan.normalizedGain);
    return { action: chosenGoal.action, candidates, goalGoodId: chosenGoal.goalGoodId, runnerUp };
  }

  /** Keeps the goal while it beats the last runner-up: own trades only make others' inputs dearer */
  private continueGoal(
    index: ProductionIndex,
    day: BurgDay,
    workersLeft: number,
    fraction: number,
    runnerUp: number
  ): ProductionDecision | null {
    const good = day.activeGoalGoodId === null ? undefined : Goods.get(day.activeGoalGoodId);
    if (!good || runnerUp === Infinity) return null;
    const modifier = this.getWorkerOutput(index, day, good);
    const step = this.getStep(index, day, good, modifier, fraction);
    const saleValue = this.getSaleValue(index, day, good, modifier, step);
    if (saleValue <= runnerUp + 0.001) return null;
    const plan = this.planGoodAction(index, day, good, step, step, workersLeft, [], undefined, [], saleValue);
    if (!plan || plan.projectedGain <= 0 || plan.normalizedGain <= runnerUp + 0.001) return null;
    return { action: plan.action, candidates: day.log ? [plan.candidate] : [], goalGoodId: good.i, runnerUp };
  }

  /** Goals that can pay, the active first, then best paying: a goal gains at most its sale value */
  private rankGoals(
    index: ProductionIndex,
    day: BurgDay,
    activeGoalGoodId: number | null,
    fraction: number
  ): RankedGoal[] {
    const goals: RankedGoal[] = [];
    for (const good of day.goals) {
      const modifier = this.getWorkerOutput(index, day, good);
      const step = this.getStep(index, day, good, modifier, fraction);
      const saleValue = this.getSaleValue(index, day, good, modifier, step);
      if (good.i === activeGoalGoodId) goals.push({ good, bound: Infinity, step, saleValue });
      else if (saleValue > 0) goals.push({ good, bound: saleValue, step, saleValue });
    }
    return goals.sort((a, b) => b.bound - a.bound);
  }

  /** Workers to sell a share of a day's sales, so the burg stops where the price stops paying */
  private getStep(index: ProductionIndex, day: BurgDay, good: Good, modifier: number, fraction: number) {
    const market = this.getOutlet(index, day, good)?.market ?? day.market;
    const workers = (LOT_DEPTH_SHARE * Trade.getDepth(market, good)) / modifier;
    return Math.max(Math.min(workers, fraction), Math.min(MIN_STEP, fraction));
  }

  private buildRecipesArray(goods: Good[]): Recipe[] {
    const recipes: Recipe[] = [];
    for (const good of goods) {
      if (!good.recipes?.length) continue;
      for (const recipe of good.recipes) {
        const entries = Object.entries(recipe).map(([goodId, amount]) => ({
          goodId: +goodId,
          amount
        }));
        if (!entries.length) continue;
        recipes.push({ good, ingredients: entries });
      }
    }
    return recipes;
  }

  // Urban production for a single burg
  getBurgProduction(burg: Burg): Record<number, number> {
    return Object.fromEntries(burg.production ?? []);
  }
}

export const Production = new ProductionModule();

export function isTradeEntry(entry: ProductionLogEntry): entry is TradeEntry {
  return "kind" in entry;
}

export function isDemandEntry(entry: ProductionLogEntry): entry is DemandEntry {
  return "category" in entry;
}
