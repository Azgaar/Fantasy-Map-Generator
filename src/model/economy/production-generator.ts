import { sum } from "d3";
import type { Burg } from "@/model/political/burgs-generator";
import { States } from "@/model/political/states-generator";
import type { Zone } from "@/model/political/zones-generator";
import { DEFAULT_CULTURE_TYPE } from "@/model/society/cultures-generator";
import { log } from "@/utils/logger";
import { minmax, rn } from "@/utils/number-utils";
import { EconomyDebug } from "./economy-debug";
import type { DemandCategory, Good } from "./goods-generator";
import {
  DEMAND_PRIORITY,
  Goods,
  getDemandTargets,
  getNeedsCost,
  getVarietyShares,
  NOVELTY,
  SAVINGS_RATE,
  WANT_LIMITS,
  WANT_SHARES,
  WEALTH_WANTS
} from "./goods-generator";
import { type Market, Markets } from "./markets-generator";
import { Prosperity } from "./prosperity";
import { StateOrders } from "./state-orders";
import {
  DEAL_KINDS,
  type DealKind,
  MIN_LOCAL_STOCK,
  type SourceOption,
  type SourceQuote,
  Trade,
  type TradeTerms,
  type Transaction
} from "./trade";

const RURAL_OUTPUT_FACTOR = 1.23;
export const DEPOSIT_RICHNESS = 2.52; // units a deposit yields a day per population point of its cell, on a map of DEPOSIT_MAP_CELLS
const DEPOSIT_MAP_CELLS = 5000; // deposit counts are per map: their yield grows with the map's cells
const DEPOSIT_MAX_POPULATION = 10; // a deposit's yield stops growing past this population
export const BONUS_URBAN_PRODUCTION = 3.59; // free units per population point of a burg on a deposit
const MIN_BONUS_PRODUCTION = 1;
const MAX_BONUS_PRODUCTION = 5;
export const MAX_BONUS_VALUE = 200; // a burg's free units are worth at most this at base value, so a rich deposit can't flood its treasury
const MAX_WORKERS = 1000;
export const WORKFORCE_SHARE = 0.32; // townspeople working in trades; the rest serve, build, farm or are too young or old
const WORKERS_PER_TURN = 5;
export const BURG_SPECIALIZATION = 0.87;
export const MARKET_SPECIALIZATION = 0.6;

export class ProductionModule {
  private zoneCellSets: Map<number, Set<number>> | null = null; // lazy zoneId -> cells lookup, built only when a good uses zone multipliers
  private zoneCellSetsSource: Zone[] | null = null;

  regenerate(): void {
    pack.deals = [];
    for (const market of pack.markets) market.goods = {};
    this.produce();
    States.collectTaxes();
  }

  regenerateEconomy(): void {
    Goods.sync();
    Markets.expandTerritories();
    this.regenerate();
  }

  produce() {
    this.zoneCellSets = null; // rebuild lookup to reflect any in-place zone edits
    // a market's license is its center burg's first claim, with the poll tax: a quiet market can end the day in debt. Set first: the market's margin follows it
    const marketFees: number[] = [];
    for (const market of pack.markets) {
      const center = pack.burgs[market.centerBurgId];
      market.feePaid = center?.i && !center.removed ? States.getMarketFee(center.state || 0) : 0;
      marketFees[market.centerBurgId] = (marketFees[market.centerBurgId] || 0) + market.feePaid;
    }

    const rural = this.getRuralOutput();
    Trade.collectRuralProduction(rural);
    Trade.initializeMarketPrices();
    Trade.measureRoutes();
    const recording = EconomyDebug.start();

    const index = this.buildProductionIndex(pack.goods);
    const sortedBurgs = pack.burgs
      .filter(burg => burg.i && !burg.removed)
      .sort((a, b) => b.population! - a.population!);

    const states: BurgProductionState[] = [];
    for (const burg of sortedBurgs) {
      const market = Markets.ofBurg(burg);
      // the poll tax is the day's first claim: the burg starts owing it and pays it from its first sales
      burg.pollTaxPaid = market ? rn(States.getPollTaxDue(burg.state || 0, burg.population || 0), 2) : 0;
      burg.treasury = -burg.pollTaxPaid - (marketFees[burg.i!] || 0);
      if (market) states.push(this.createBurgProductionState(burg, market, recording));
      else {
        burg.product = 0; // out of every market: nothing made
        burg.production = [];
      }
    }
    StateOrders.start();
    for (const { market, population } of states) {
      index.marketPopulation[market.i] = (index.marketPopulation[market.i] || 0) + population;
      index.worldPopulation += population;
    }

    // burgs take turns, largest first, so the first in line cannot drain a market alone; each turn a burg works, sells,
    // buys its needs in step with the work done, then spends what it can spare; rural people spend what their produce earned,
    // states what their taxes brought in
    let working = states;
    while (working.length) {
      working = working.filter(state => {
        const hasWork = this.runWorkerLoop(index, state, WORKERS_PER_TURN);
        // inputs made for the chain still under way wait for its next step
        const inputs = hasWork ? this.getChainInputs(index, state.activeGoalGoodId) : null;
        this.sellInventoryToMarket(state, goodId => !inputs?.has(goodId));
        this.fillDemand(index, state, hasWork && state.population ? state.workersUsed / state.population : 1);
        this.spendOnWants(index, state);
        return hasWork;
      });
      for (const market of pack.markets) Trade.spendRural(market);
      StateOrders.place();
    }
    StateOrders.place(true);
    Trade.endRun();
    StateOrders.end();
    pack.deals = pack.deals.filter(deal => deal[4] > 0); // sales kept back whole
    pack.cells.prosperity = Prosperity.getCellsProsperity(rural);

    for (const { burg, produced, revenue, ingredientCosts, log } of states) {
      burg.product = rn(Math.max(0, revenue - ingredientCosts), 2);
      burg.production = produced.flatMap((units, goodId) => (units ? [[goodId, rn(units, 2)]] : []));
      if (log) EconomyDebug.set(burg.i!, log);
    }
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
      marketPopulation: [],
      worldWorkers: [],
      worldPopulation: 0,
      needsCost: getNeedsCost(goods)
    };
  }

  /** The burg's workforce: its share of the population working in trades, capped */
  getWorkers(burg: Burg): number {
    return Math.min(rn((burg.population || 0) * WORKFORCE_SHARE, 2), MAX_WORKERS);
  }

  private createBurgProductionState(burg: Burg, market: Market, recording = false): BurgProductionState {
    const population = this.getWorkers(burg);
    if (population === MAX_WORKERS) log.warn(`Burg ${burg.name} (${burg.i}) workforce is capped at ${MAX_WORKERS}`);
    const inventory: number[] = [];
    const produced: number[] = [];
    const productionLog: ProductionLogEntry[] | undefined = recording ? [] : undefined;

    const good = Goods.get(pack.cells.good[burg.cell]);
    if (good) {
      const localBonus = this.getLocalBonus(good, burg);
      if (localBonus > 0) {
        inventory[good.i] = localBonus;
        produced[good.i] = localBonus;
        productionLog?.push({ goodId: good.i, units: rn(localBonus, 2) });
      }
    }

    return {
      burg,
      market,
      population,
      inventory,
      produced,
      log: productionLog,
      taxRate: States.getSalesTax(burg),
      ingredientCosts: 0,
      revenue: 0,
      workersUsed: 0,
      spent: 0,
      outlets: [],
      demandCoverage: new Array(DEMAND_PRIORITY.length).fill(0),
      consumed: [],
      workersByGood: [],
      activeGoalGoodId: null,
      sources: []
    };
  }

  /** Spends up to `workers` of the burg's remaining workers; false once none are left or nothing is worth making */
  private runWorkerLoop(index: ProductionIndex, state: BurgProductionState, workers = state.population): boolean {
    let used = 0;
    state.sources = []; // other burgs traded since the last turn
    state.outlets = [];

    while (used < workers - 0.001) {
      const workersLeft = state.population - state.workersUsed;
      const workerFraction = Math.min(1, workersLeft, workers - used);
      if (workerFraction <= 0.001) return false;

      const decision = this.makeProductionDecision(index, state, state.activeGoalGoodId, workersLeft, workerFraction);
      if (!decision) return false;

      state.activeGoalGoodId = decision.goalGoodId;
      const spent = this.executeManufacture(index, state, decision, workerFraction);
      used += spent;
      state.workersUsed += spent;
      // a finished good is sold at once, so the next worker sees the price it moved; a chain's inputs wait for their step
      if (decision.action.good.i === decision.goalGoodId)
        this.sellInventoryToMarket(state, goodId => goodId === decision.goalGoodId);
    }

    return true;
  }

  /** Makes the decided good; returns the workers it took */
  private executeManufacture(
    index: ProductionIndex,
    state: BurgProductionState,
    decision: ProductionDecision,
    workerFraction: number
  ): number {
    const { good, ingredients, maxYield } = decision.action;
    const actualYield = Math.min(workerFraction, maxYield);
    const cultureModifier = this.getModifiers(good, state.burg.cell);
    const specialization = this.getSpecialization(index, state, good.i);
    const produced = rn(actualYield * cultureModifier * specialization, 2);
    if (!produced) return workerFraction;

    // buy what the inventory lacks; inputs bought before a failed purchase stay in the inventory
    for (const ingredient of ingredients) {
      const ingredientId = ingredient.goodId;
      const amount = actualYield * ingredient.amount;
      const fromMarket = amount - Math.min(state.inventory[ingredientId] || 0, amount);
      if (fromMarket <= 0.01) continue;

      const trade = this.acquire(index, state, Goods.get(ingredientId)!, fromMarket, DEAL_KINDS.input);
      if (!trade) {
        const message = `Failed to acquire ${rn(fromMarket, 2)} units of ${Goods.get(ingredientId)?.name} from market for production of ${good.name}`;
        log.error(message);
        return workerFraction;
      }
      const marketCost = trade.units * trade.price;
      state.ingredientCosts += marketCost;
      state.burg.treasury = rn((state.burg.treasury || 0) - marketCost, 2);
      state.inventory[ingredientId] = (state.inventory[ingredientId] || 0) + trade.units;
    }

    const recipe: ProductionRecipeEntry[] = [];
    for (const ingredient of ingredients) {
      const amount = actualYield * ingredient.amount;
      recipe.push({ goodId: ingredient.goodId, units: rn(amount, 2) });
      const left = (state.inventory[ingredient.goodId] || 0) - amount;
      state.inventory[ingredient.goodId] = left < 0.01 ? 0 : left; // a purchase rounded up leaves crumbs, not stock
    }

    state.inventory[good.i] = (state.inventory[good.i] || 0) + produced;
    state.produced[good.i] = (state.produced[good.i] || 0) + produced;
    state.workersByGood[good.i] = (state.workersByGood[good.i] || 0) + actualYield;
    index.marketWorkers[state.market.i] ??= [];
    const marketWorkers = index.marketWorkers[state.market.i];
    marketWorkers[good.i] = (marketWorkers[good.i] || 0) + actualYield;
    index.worldWorkers[good.i] = (index.worldWorkers[good.i] || 0) + actualYield;

    if (state.log) {
      const entry: ManufacturingEntry = { goodId: good.i, units: produced, recipe, candidates: decision.candidates };
      if (cultureModifier !== 1) entry.cultureModifier = cultureModifier;
      if (specialization !== 1) entry.specialization = rn(specialization, 2);
      state.log.push(entry);
    }
    return actualYield; // a chain's step takes only the workers it needs, the rest go on to the next step
  }

  /** Buys from the burg's market while it stocks enough of the good, otherwise from the turn's cheapest other market, or what its own has left */
  private acquire(
    index: ProductionIndex,
    state: BurgProductionState,
    good: Good,
    units: number,
    kind: DealKind,
    budget = Infinity
  ): Transaction | null {
    const { burg } = state;
    const sources = state.log && Trade.listSources(burg, good, index.tradeTerms); // before the trade moves them
    const market = this.getSupplier(index, state, good);
    if (!market) return null;
    if (market !== state.market) state.sources[good.i] = undefined; // the source's stock and price moved

    const trade = Trade.buy({ burg, good, units, kind, source: market, terms: index.tradeTerms, budget });
    if (trade) state.log?.push({ goodId: good.i, market: market.i, kind, ...trade, sources: sources || undefined });
    return trade;
  }

  /** The local quote while the burg's market stocks enough of the good, otherwise the turn's cheapest other market, or what its own has left */
  private quote(index: ProductionIndex, state: BurgProductionState, goodId: number): MarketQuote {
    const local = Trade.quoteMarket(state.market, goodId, state.burg);
    const good = Goods.get(goodId);
    const supplier = good && this.getSupplier(index, state, good);
    if (!supplier) return { ...local, stock: 0 }; // a remainder too small to buy is no stock
    if (supplier === state.market) return local;
    const source = state.sources[goodId]!;
    return { ...local, stock: source.stock, buyPrice: source.buyPrice };
  }

  /** Where the burg buys the good this turn */
  private getSupplier(index: ProductionIndex, state: BurgProductionState, good: Good): Market | null {
    return Trade.getSupplier(state.market, good, () => this.getSource(index, state, good)?.source);
  }

  /** The turn's cheapest other market for the good, null when none sells it */
  private getSource(index: ProductionIndex, state: BurgProductionState, good: Good): SourceQuote | null {
    if (state.sources[good.i] === undefined)
      state.sources[good.i] = Trade.quoteSource(state.burg, good, index.tradeTerms);
    return state.sources[good.i] ?? null;
  }

  /** The best price at the burg's door for a unit of the good, in any market it reaches */
  private getOutletPrice(state: BurgProductionState, good: Good): number {
    state.outlets[good.i] ??= Trade.getOutlet(state.burg, good)?.price ?? 0;
    return state.outlets[good.i]!;
  }

  /** The burg sold only what it made, so only that can be kept */
  private quoteKeep(state: BurgProductionState, good: Good) {
    return state.produced[good.i] ? Trade.quoteKeep(state.burg, good) : null;
  }

  /** The category's shortage and every good that could cover it, cheapest coverage first, as the burg saw them */
  private logDemand(
    state: BurgProductionState,
    category: number,
    shortage: number,
    sorted: { candidate: DemandGoodCandidate; costPerCoverage: number; kept: boolean }[]
  ): void {
    const options = sorted.map(({ candidate, costPerCoverage, kept }) => {
      const local = (state.market.goods[candidate.goodId]?.stock || 0) >= MIN_LOCAL_STOCK;
      const market = kept || local ? state.market.i : (state.sources[candidate.goodId]?.source.i ?? state.market.i);
      return {
        goodId: candidate.goodId,
        coverage: candidate.coverageWeight,
        costPerCoverage: rn(costPerCoverage, 2),
        market,
        kept
      };
    });
    state.log!.push({ category, shortage: rn(shortage, 2), options });
  }

  /** Sells the goods of the burg's inventory it chooses, all by default, where each fetches the most */
  private sellInventoryToMarket(state: BurgProductionState, sells: (goodId: number) => boolean = () => true): void {
    let phaseRevenue = 0;
    const { taxRate } = state;

    for (const goodIdStr in state.inventory) {
      const goodId = +goodIdStr;
      const units = state.inventory[goodId];
      if (units <= 0 || !sells(goodId)) continue;
      state.inventory[goodId] = 0;

      const good = Goods.get(goodId)!;
      const market = Trade.getOutlet(state.burg, good)?.market ?? state.market; // where it fetches the most
      const trade = Trade.sell({ burg: state.burg, good, units, taxRate, market });
      if (!trade) continue;

      const revenue = trade.units * trade.price - trade.tax;
      phaseRevenue += revenue;
      state.log?.push({ goodId, market: market.i, kind: DEAL_KINDS.sale, ...trade });
    }

    state.revenue += phaseRevenue;
    state.burg.treasury = rn((state.burg.treasury || 0) + phaseRevenue, 2);
  }

  /** Every good the good's recipes take, down its whole production chain */
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
        coverage[category] = good.demandCoverage?.[DEMAND_PRIORITY[category] as DemandCategory] || 0;
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

  /** Buys the share of the burg's daily needs due so far, cheaper goods getting more; what it could not get waits for its next turn */
  private fillDemand(index: ProductionIndex, state: BurgProductionState, share = 1): void {
    const { burg, demandCoverage } = state;
    const demandTargets = getDemandTargets(burg.population || 0).map(target => target * share);
    state.sources = []; // other burgs traded since its last turn

    for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
      let shortage = Math.max(0, demandTargets[categoryIndex] - demandCoverage[categoryIndex]);
      if (shortage <= 0.001) continue;

      const sortedCandidates: { candidate: DemandGoodCandidate; costPerCoverage: number; kept: boolean }[] = [];
      const missing: { candidate: DemandGoodCandidate; costPerCoverage: number }[] = []; // goods nobody stocks
      for (const candidate of index.demandGoodsByCategory[categoryIndex]) {
        const own = this.quoteKeep(state, candidate.good);
        const quote = this.quote(index, state, candidate.goodId);
        if (!own && quote.stock <= 0.01) {
          const costPerCoverage =
            Trade.quoteMarket(state.market, candidate.goodId, burg).buyPrice / candidate.coverageWeight;
          if (costPerCoverage > 0) missing.push({ candidate, costPerCoverage });
          continue;
        }
        const price = own ? Math.min(own.price, quote.buyPrice) : quote.buyPrice;
        const kept = Boolean(own && own.price <= quote.buyPrice); // as the purchase below decides
        sortedCandidates.push({ candidate, costPerCoverage: price / candidate.coverageWeight, kept });
      }
      sortedCandidates.sort((a, b) => a.costPerCoverage - b.costPerCoverage);
      if (state.log) this.logDemand(state, categoryIndex, shortage, sortedCandidates);

      const cover = (candidate: DemandGoodCandidate, trade: Transaction | null) => {
        if (!trade) return;
        this.consume(index, state, candidate.goodId, trade);
        shortage = Math.max(0, demandTargets[categoryIndex] - demandCoverage[categoryIndex]);
      };
      // what the burg sold to its own market is kept back first when that is cheaper than buying it
      const buy = (candidate: DemandGoodCandidate, coverageWanted: number) => {
        const budget = burg.treasury || 0;
        if (budget <= 0.01 || coverageWanted <= 0.001) return;
        let units = coverageWanted / candidate.coverageWeight;
        const own = this.quoteKeep(state, candidate.good);
        if (own && own.price <= this.quote(index, state, candidate.goodId).buyPrice) {
          const kept = Trade.keep({ burg, good: candidate.good, units, budget });
          if (kept) {
            state.log?.push({ goodId: candidate.goodId, market: state.market.i, kind: DEAL_KINDS.kept, ...kept });
            units -= kept.units;
          }
          cover(candidate, kept);
        }
        if (units < 0.01) return;
        cover(candidate, this.acquire(index, state, candidate.good, units, DEAL_KINDS.demand, burg.treasury || 0));
      };

      // every good covering the need gets its share; a good nobody stocks turns its buyers away, raising its price
      const options = [...sortedCandidates, ...missing];
      const shares = this.getShares(index, state, categoryIndex, options);
      const wanted = shortage;
      options.forEach(({ candidate }, k) => {
        if (k >= sortedCandidates.length)
          Trade.signalShortage(state.market, candidate.good, (wanted * shares[k]) / candidate.coverageWeight);
        else buy(candidate, Math.min(shortage, wanted * shares[k]));
      });
      for (const { candidate } of sortedCandidates) {
        if (shortage <= 0.001 || (burg.treasury || 0) <= 0.01) break;
        buy(candidate, shortage);
      }
    }
  }

  /** How many days of its needs a person of the burg earns so far, at least 1 */
  private getAffluence(index: ProductionIndex, state: BurgProductionState): number {
    const income = (state.burg.treasury || 0) + state.spent;
    const perPerson = state.burg.population ? income / state.burg.population : 0;
    return index.needsCost ? Math.max(1, perPerson / index.needsCost) : 1;
  }

  /** Shares of the need's spending by price per coverage; the richer the burg, the more it pays for goods it has had little of */
  private getShares(
    index: ProductionIndex,
    state: BurgProductionState,
    category: number,
    options: { candidate: DemandGoodCandidate; costPerCoverage: number }[]
  ): number[] {
    const bonus = NOVELTY * Math.log10(this.getAffluence(index, state));
    const covered = state.demandCoverage[category];
    return getVarietyShares(
      options.map(({ candidate, costPerCoverage }) => {
        const had = covered
          ? Math.min(1, ((state.consumed[candidate.goodId] || 0) * candidate.coverageWeight) / covered)
          : 0;
        return costPerCoverage / (1 + bonus * (1 - had));
      })
    );
  }

  /** Spends what the burg can spare beyond its needs, up to (1 - savings) of its income, spread over the goods of every category as its needs are */
  private spendOnWants(index: ProductionIndex, state: BurgProductionState): void {
    const { burg } = state;
    const income = (burg.treasury || 0) + state.spent;
    const budget = Math.min(burg.treasury || 0, (1 - SAVINGS_RATE) * income - state.spent);
    if (budget <= 0.01) return;

    const targets = getDemandTargets(burg.population || 0);
    const affluence = this.getAffluence(index, state);
    let left = budget;
    DEMAND_PRIORITY.forEach((category, categoryIndex) => {
      // what the capped wants leave goes to those that grow with affluence: the rich spend on luxury, not on more bread
      let money = WEALTH_WANTS.includes(category) ? left : budget * WANT_SHARES[category];
      const limit = WANT_LIMITS[category] * (WEALTH_WANTS.includes(category) ? Math.sqrt(affluence) : 1);
      const cap = () => targets[categoryIndex] * (1 + limit) - state.demandCoverage[categoryIndex];
      if (money <= 0.01 || cap() <= 0.001) return; // nothing to spend or nothing more wanted
      const options = index.demandGoodsByCategory[categoryIndex]
        .map(candidate => {
          const quote = this.quote(index, state, candidate.goodId);
          const price =
            quote.stock > 0.01 ? quote.buyPrice : Trade.quoteMarket(state.market, candidate.goodId, burg).buyPrice;
          return { candidate, stocked: quote.stock > 0.01, price, costPerCoverage: price / candidate.coverageWeight };
        })
        .filter(({ price }) => price > 0);
      if (!options.length) return;
      const shares = this.getShares(index, state, categoryIndex, options);
      const total = money;
      const purchase = (candidate: DemandGoodCandidate, price: number, spend: number) => {
        const units = Math.min(spend / price, cap() / candidate.coverageWeight);
        if (spend <= 0.01 || units < 0.01) return;
        const trade = this.acquire(index, state, candidate.good, units, DEAL_KINDS.demand, spend);
        if (!trade) return;
        const cost = this.consume(index, state, candidate.goodId, trade);
        money -= cost;
        left -= cost;
      };
      options.forEach(({ candidate, stocked, price }, k) => {
        if (stocked) purchase(candidate, price, Math.min(money, total * shares[k]));
        else
          Trade.signalShortage(
            state.market,
            candidate.good,
            Math.min((total * shares[k]) / price, cap() / candidate.coverageWeight)
          );
      });
      const stocked = options
        .map((option, k) => ({ ...option, share: shares[k] }))
        .filter(option => option.stocked)
        .sort((a, b) => b.share - a.share); // what is left goes to the goods the burg favors most
      for (const { candidate } of stocked) {
        if (money <= 0.01 || cap() <= 0.001) break;
        purchase(candidate, this.quote(index, state, candidate.goodId).buyPrice, money);
      }
    });
  }

  /** Pays for what the burg bought for its own use and counts the needs it covers; returns the cost */
  private consume(index: ProductionIndex, state: BurgProductionState, goodId: number, trade: Transaction): number {
    const cost = trade.units * trade.price;
    state.burg.treasury = rn((state.burg.treasury || 0) - cost, 2);
    state.spent += cost;
    state.consumed[goodId] = (state.consumed[goodId] || 0) + trade.units;
    const coverage = index.demandCoverageByGood[goodId];
    for (let i = 0; i < DEMAND_PRIORITY.length; i++) state.demandCoverage[i] += trade.units * (coverage[i] || 0);
    return cost;
  }

  /** Units of the good a worker makes a day here */
  private getWorkerOutput(index: ProductionIndex, state: BurgProductionState, good: Good): number {
    return this.getModifiers(good, state.burg.cell) * this.getSpecialization(index, state, good.i);
  }

  /** Division of labor: the more of the burg's workers make a good, and the more its market makes of it than the world, the more each makes */
  private getSpecialization(index: ProductionIndex, state: BurgProductionState, goodId: number): number {
    const own = state.population ? (state.workersByGood[goodId] || 0) / state.population : 0;
    const marketPopulation = index.marketPopulation[state.market.i];
    const market = marketPopulation ? (index.marketWorkers[state.market.i]?.[goodId] || 0) / marketPopulation : 0;
    const world = index.worldPopulation ? (index.worldWorkers[goodId] || 0) / index.worldPopulation : 0;
    const excess = world ? Math.min(Math.max(market / world - 1, 0), 1) : 0;
    return 1 + BURG_SPECIALIZATION * Math.min(own, 1) + MARKET_SPECIALIZATION * excess;
  }

  /** What a unit made brings the burg: the sell price less its own sales tax, as its inputs' prices hold theirs */
  private getSaleValue(state: BurgProductionState, good: Good, quote: MarketQuote, modifier: number): number {
    return Math.max(quote.sellPrice, this.getOutletPrice(state, good)) * modifier * (1 - state.taxRate);
  }

  private buildImmediateManufactureCandidate(
    index: ProductionIndex,
    state: BurgProductionState,
    recipe: Recipe,
    units: number,
    goalGoodId: number,
    stock: PlanningStock | undefined,
    quotes: MarketQuote[]
  ): { action: PlannedAction; candidate: ProductionCandidate } | null {
    let maxYield = Infinity;
    let marketCostTotal = 0;

    for (const ingredient of recipe.ingredients) {
      quotes[ingredient.goodId] ??= this.quote(index, state, ingredient.goodId);
      const quote = quotes[ingredient.goodId];
      const inventoryAvailable = (stock?.inventory ?? state.inventory)[ingredient.goodId] || 0;
      const marketAvailable = stock?.market[ingredient.goodId] ?? quote.stock;
      const totalAvailable = inventoryAvailable + marketAvailable;
      if (totalAvailable < ingredient.amount * units - 0.001) return null;
      maxYield = Math.min(maxYield, totalAvailable / ingredient.amount);
    }

    if (!Number.isFinite(maxYield) || maxYield <= 0) return null;

    const actualUnits = Math.min(units, maxYield);
    for (const ingredient of recipe.ingredients) {
      quotes[ingredient.goodId] ??= this.quote(index, state, ingredient.goodId);
      const quote = quotes[ingredient.goodId];
      const inventoryAvailable = (stock?.inventory ?? state.inventory)[ingredient.goodId] || 0;
      const amountNeeded = actualUnits * ingredient.amount;
      const fromMarket = Math.max(0, amountNeeded - Math.min(inventoryAvailable, amountNeeded));
      marketCostTotal += fromMarket * quote.buyPrice;
    }

    const modifier = this.getWorkerOutput(index, state, recipe.good);
    quotes[recipe.good.i] ??= this.quote(index, state, recipe.good.i);
    const sellValue = this.getSaleValue(state, recipe.good, quotes[recipe.good.i], modifier);
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
        cultureModifier: modifier,
        score,
        ingredients: recipe.ingredients,
        goalGoodId
      }
    };
  }

  private reserveRecipeInputs(
    index: ProductionIndex,
    state: BurgProductionState,
    recipe: Recipe,
    units: number,
    stock: PlanningStock | undefined,
    quotes: MarketQuote[]
  ) {
    const reserved: PlanningStock = {
      inventory: (stock?.inventory ?? state.inventory).slice(),
      market: stock?.market.slice() ?? []
    };
    const missing: Ingredient[] = [];
    let marketCost = 0;

    // Reserve shared inputs before recursing.
    for (const { goodId, amount } of recipe.ingredients) {
      quotes[goodId] ??= this.quote(index, state, goodId);
      const quote = quotes[goodId];
      const inventory = reserved.inventory[goodId] || 0;
      const market = reserved.market[goodId] ?? quote.stock;
      const fromInventory = Math.min(units * amount, inventory);
      const fromMarket = Math.min(units * amount - fromInventory, market);
      reserved.inventory[goodId] = inventory - fromInventory;
      reserved.market[goodId] = market - fromMarket;
      marketCost += fromMarket * quote.buyPrice;
      const remaining = units * amount - fromInventory - fromMarket;
      if (remaining > 0.001) missing.push({ goodId, amount: remaining });
    }

    return { reserved, missing, marketCost };
  }

  private planGoodAction(
    index: ProductionIndex,
    state: BurgProductionState,
    good: Good,
    targetUnits: number,
    stepUnits: number,
    workersLeft: number,
    path: boolean[] = [],
    stock?: PlanningStock,
    quotes: MarketQuote[] = []
  ): GoalActionPlan | null {
    if (workersLeft <= 0 || targetUnits <= 0 || targetUnits > workersLeft + 0.001) return null;
    if (path[good.i]) return null;

    path[good.i] = true;

    const modifier = this.getWorkerOutput(index, state, good);
    quotes[good.i] ??= this.quote(index, state, good.i);
    const sellValuePerUnit = this.getSaleValue(state, good, quotes[good.i], modifier);
    const totalProjectedGain = sellValuePerUnit * targetUnits;

    const recipeList = index.recipesByOutput[good.i];
    if (!recipeList?.length) {
      path[good.i] = false;
      return null;
    }

    let bestPlan: GoalActionPlan | null = null;
    let bestStock: PlanningStock | null = null;

    for (const recipe of recipeList) {
      const immediate = this.buildImmediateManufactureCandidate(
        index,
        state,
        recipe,
        targetUnits,
        good.i,
        stock,
        quotes
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
            ? this.reserveRecipeInputs(index, state, recipe, targetUnits, stock, quotes).reserved
            : null;
        }
        continue;
      }

      let workersNeeded = targetUnits;
      const reservation = this.reserveRecipeInputs(index, state, recipe, targetUnits, stock, quotes);
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
          state,
          ingredientGood,
          ingredient.amount / this.getWorkerOutput(index, state, ingredientGood),
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
    state: BurgProductionState,
    activeGoalGoodId: number | null,
    workersLeft: number,
    fraction: number
  ): ProductionDecision | null {
    const candidates: ProductionCandidate[] = [];
    const quotes: MarketQuote[] = []; // No trades occur within a decision.

    let chosenGoal: GoalActionPlan | null = null;
    let activeGoal: GoalActionPlan | null = null;
    for (const good of index.productiveGoods) {
      const goalPlan = this.planGoodAction(index, state, good, fraction, fraction, workersLeft, [], undefined, quotes);
      if (!goalPlan || goalPlan.projectedGain <= 0) continue;
      if (state.log) candidates.push(goalPlan.candidate); // only the debug log reads them
      if (good.i === activeGoalGoodId) activeGoal = goalPlan;
      if (!chosenGoal || goalPlan.normalizedGain > chosenGoal.normalizedGain + 0.001) chosenGoal = goalPlan;
    }

    if (activeGoalGoodId !== null && chosenGoal && !activeGoal) {
      const activeGood = Goods.get(activeGoalGoodId);
      if (activeGood) {
        activeGoal = this.planGoodAction(
          index,
          state,
          activeGood,
          fraction,
          fraction,
          workersLeft,
          [],
          undefined,
          quotes
        );
      }
    }

    if (activeGoal && chosenGoal && activeGoal.normalizedGain >= chosenGoal.normalizedGain) chosenGoal = activeGoal;
    if (!chosenGoal) return null;

    return { action: chosenGoal.action, candidates, goalGoodId: chosenGoal.goalGoodId };
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

  /** Each cell's rural output a day, units by good id */
  getRuralOutput(): Record<number, number>[] {
    const biomes = Goods.getBiomesProduction();
    return Array.from(pack.cells.i, cellId => this.getCellOutput(cellId, biomes));
  }

  /** A cell's rural output a day, units by good id */
  getCellProduction(cellId: number): Record<number, number> {
    return this.getCellOutput(cellId, Goods.getBiomesProduction());
  }

  private getCellOutput(cellId: number, biomes: ReturnType<typeof Goods.getBiomesProduction>): Record<number, number> {
    const produced: Record<number, number> = {};

    const modifier = (good: Good) => this.getModifiers(good, cellId);
    const add = (goodId: number, amount: number) => {
      produced[goodId] = rn((produced[goodId] || 0) + amount * RURAL_OUTPUT_FACTOR, 2);
    };

    const pop = this.getCellPopulation(cellId);
    if (pop > 0) {
      for (const { goodId, production } of biomes[pack.cells.biome[cellId]] || []) {
        const good = Goods.get(goodId);
        if (good) add(goodId, pop * production * modifier(good));
      }

      const deposit = Goods.get(pack.cells.good[cellId]);
      if (deposit) produced[deposit.i] = rn((produced[deposit.i] || 0) + this.getDepositOutput(deposit, cellId), 2);
    }

    return produced;
  }

  /** Units a deposit of the good on the cell yields a day: the more people work it, the more, up to a cap; more on bigger maps, as their deposits are as few */
  getDepositOutput(good: Good, cellId: number): number {
    const pop = Math.min(this.getCellPopulation(cellId), DEPOSIT_MAX_POPULATION);
    const mapScale = pack.cells.i.length / DEPOSIT_MAP_CELLS;
    return pop * DEPOSIT_RICHNESS * mapScale * this.getModifiers(good, cellId);
  }

  /** Free units a burg on a deposit of the good starts its day with */
  getLocalBonus(good: Good, burg: Burg): number {
    const population = minmax(rn(burg.population || 0, 2), MIN_BONUS_PRODUCTION, MAX_BONUS_PRODUCTION);
    const units = population * BONUS_URBAN_PRODUCTION * this.getModifiers(good, burg.cell);
    return good.value > 0 ? Math.min(units, MAX_BONUS_VALUE / good.value) : units;
  }

  /** A land cell's people, or a water cell's from the land around it */
  private getCellPopulation(cellId: number): number {
    const { cells } = pack;
    if (cells.h[cellId] >= 20) return cells.pop[cellId];
    return sum(cells.c[cellId].map(c => cells.pop[c])) || 0;
  }

  private getModifiers(good: Good, cellId: number): number {
    const mult = good.multipliers;
    if (!mult) return 1;

    const biomeId = pack.cells.biome[cellId];
    const cultureId = pack.cells.culture[cellId];
    const stateId = pack.cells.state[cellId];
    const religionId = pack.cells.religion[cellId];

    const burgId = pack.cells.burg[cellId];
    const cultureType = (burgId ? pack.burgs[burgId]?.type : pack.cultures[cultureId]?.type) ?? DEFAULT_CULTURE_TYPE;

    let modifier =
      (mult.cultureType?.[cultureType] ?? 1) *
      (mult.culture?.[cultureId] ?? 1) *
      (mult.state?.[stateId] ?? 1) *
      (mult.religion?.[religionId] ?? 1) *
      (mult.biome?.[biomeId] ?? 1);

    if (mult.zone) {
      const zoneCellSets = this.getZoneCellSets();
      for (const zoneIdStr in mult.zone) {
        const value = mult.zone[+zoneIdStr];
        if (value === undefined || value === 1) continue;
        if (zoneCellSets.get(+zoneIdStr)?.has(cellId)) modifier *= value;
      }
    }

    return modifier;
  }

  private getZoneCellSets(): Map<number, Set<number>> {
    const zones = pack.zones || [];
    if (this.zoneCellSets && this.zoneCellSetsSource === zones) return this.zoneCellSets;

    const sets = new Map<number, Set<number>>();
    for (const zone of zones) sets.set(zone.i, new Set(zone.cells));
    this.zoneCellSets = sets;
    this.zoneCellSetsSource = zones;
    return sets;
  }
}

export const isManufacturingEntry = (entry: ProductionLogEntry): entry is ManufacturingEntry => "recipe" in entry;
export const isTradeEntry = (entry: ProductionLogEntry): entry is TradeEntry => "kind" in entry;
export const isDemandEntry = (entry: ProductionLogEntry): entry is DemandEntry => "category" in entry;

type PlannedAction = {
  good: Good;
  ingredients: Ingredient[];
  maxYield: number;
};

type Recipe = { good: Good; ingredients: Ingredient[] };
type Ingredient = { goodId: number; amount: number };

type ProductionIndex = {
  demandCoverageByGood: number[][];
  demandGoodsByCategory: DemandGoodCandidate[][];
  recipesByOutput: Recipe[][];
  productiveGoods: Good[];
  tradeTerms: TradeTerms;
  chainInputs: Map<number, Set<number>>; // by goal good: every input down its chain
  marketWorkers: number[][]; // by market then good: workers the market's burgs put into it this run
  marketPopulation: number[]; // by market: the workers its burgs have
  worldWorkers: number[]; // by good: workers all burgs put into it this run
  worldPopulation: number; // the workers all burgs have
  needsCost: number; // a person's daily needs at the cheapest coverage at base prices
};

type PlanningStock = { inventory: number[]; market: number[] };
type MarketQuote = ReturnType<typeof Trade.quoteMarket>;

type BurgProductionState = {
  burg: Burg;
  market: Market;
  population: number;
  inventory: number[];
  produced: number[]; // by good, local bonus included
  log?: ProductionLogEntry[]; // kept only in debug mode
  taxRate: number; // the burg's sales tax, paid on what it sells
  ingredientCosts: number;
  revenue: number;
  workersUsed: number;
  spent: number; // on the burg's needs and wants this run
  outlets: (number | undefined)[]; // by good: the best price at the burg's door this turn
  demandCoverage: number[]; // by demand category: what the burg's purchases covered so far this run
  consumed: number[]; // by good: units the burg bought or kept for itself this run
  workersByGood: number[]; // workers put into each good this run, for division of labor
  activeGoalGoodId: number | null;
  sources: (SourceQuote | null | undefined)[]; // cheapest other market by good for the current turn, null when none
};

type DemandGoodCandidate = { good: Good; goodId: number; coverageWeight: number };

type ProductionDecision = {
  action: PlannedAction;
  candidates: ProductionCandidate[];
  goalGoodId: number | null;
};

export type ProductionCandidate = {
  goodId: number;
  units: number;
  sellPrice: number;
  ingredientCost: number;
  cultureModifier: number;
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

/** Units of each good a burg made in the last production run, local bonus included */
export type BurgProduction = [good: number, units: number][];

type LocalEntry = { goodId: number; units: number };

type ManufacturingEntry = {
  goodId: number;
  units: number;
  recipe: ProductionRecipeEntry[];
  cultureModifier?: number; // omitted when 1
  specialization?: number; // division of labor factor, omitted when 1
  candidates: readonly ProductionCandidate[];
};

type TradeEntry = { goodId: number; market: number; kind: DealKind; sources?: SourceOption[] } & Transaction;

/** A demand category's shortage when the burg came to fill it, and the goods it could use, cheapest coverage first */
type DemandEntry = {
  category: number; // index in DEMAND_PRIORITY
  shortage: number;
  options: { goodId: number; coverage: number; costPerCoverage: number; market: number; kept: boolean }[];
};

/** One step of a burg's production run, logged in debug mode */
export type ProductionLogEntry = LocalEntry | ManufacturingEntry | TradeEntry | DemandEntry;

export const Production = new ProductionModule();
