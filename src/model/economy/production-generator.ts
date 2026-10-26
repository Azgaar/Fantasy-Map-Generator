import { sum } from "d3";
import type { Burg } from "@/model/political/burgs-generator";
import { States } from "@/model/political/states-generator";
import type { Zone } from "@/model/political/zones-generator";
import { DEFAULT_CULTURE_TYPE } from "@/model/society/cultures-generator";
import { log } from "@/utils/logger";
import { minmax, rn } from "@/utils/number-utils";
import type { DemandCategory, Good } from "./goods-generator";
import { DEMAND_PRIORITY, Goods, getDemandTargets } from "./goods-generator";
import type { DealKind, ImportQuote, Market, Trade, TradeTerms } from "./markets-generator";
import { DEAL_KINDS, Markets } from "./markets-generator";

const RURAL_OUTPUT_FACTOR = 3;
const BONUS_RURAL_PRODUCTION = 0.25;
const BONUS_URBAN_PRODUCTION = 1;
const MIN_BONUS_PRODUCTION = 1;
const MAX_BONUS_PRODUCTION = 5;
const MAX_WORKERS = 1000;
const WORKERS_PER_TURN = 5;

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
    if (!pack.goods?.length) Goods.generate();
    else Goods.sync();

    Markets.expandTerritories(pack.markets);
    this.regenerate();
  }

  produce() {
    this.zoneCellSets = null; // rebuild lookup to reflect any in-place zone edits
    Markets.collectRuralProduction();
    Markets.initializeMarketPrices();
    Markets.measureRoutes();

    const index = this.buildProductionIndex(pack.goods);
    const sortedBurgs = pack.burgs
      .filter(burg => burg.i && !burg.removed)
      .sort((a, b) => b.population! - a.population!);

    const states: BurgProductionState[] = [];
    for (const burg of sortedBurgs) {
      const market = burg.market ? Markets.get(burg.market) : undefined;
      if (market) states.push(this.createBurgProductionState(burg, market));
    }

    // burgs take turns, largest first, so the first in line cannot drain a market alone
    let working = states;
    while (working.length) {
      working = working.filter(state => {
        const hasWork = this.runWorkerLoop(index, state, WORKERS_PER_TURN);
        this.sellInventoryToMarket(state);
        return hasWork;
      });
    }

    for (const state of states) this.fillDemand(index, state);
    pack.deals = pack.deals.filter(deal => deal[4] > 0); // sales kept back whole

    for (const { burg, produced, revenue, ingredientCosts, log } of states) {
      burg.product = rn(Math.max(0, revenue - ingredientCosts), 2);
      burg.production = produced.flatMap((units, goodId) => (units ? [[goodId, rn(units, 2)]] : []));
      if (log) burg.productionLog = log;
      else delete burg.productionLog;
    }
  }

  private buildProductionIndex(goods: Good[]): ProductionIndex {
    const demandCoverageByGood = this.buildDemandCoverageByGood(goods);
    const demandGoodsByCategory = this.buildDemandGoodsByCategory(goods, demandCoverageByGood);
    const recipes = this.buildRecipesArray(goods);
    const recipesByOutput = this.buildRecipesByOutput(recipes);
    const productiveGoods = goods.filter(good => recipesByOutput[good.i]?.length);

    return {
      goods,
      demandCoverageByGood,
      demandGoodsByCategory,
      recipesByOutput,
      productiveGoods,
      tradeTerms: Markets.getTradeTerms()
    };
  }

  private createBurgProductionState(burg: Burg, market: Market): BurgProductionState {
    const burgPopulation = rn(burg.population || 0, 2);
    const population = Math.min(burgPopulation, MAX_WORKERS);
    if (population < burgPopulation) {
      log.warn(`Burg ${burg.name} (${burg.i}) population ${burgPopulation} is capped at ${MAX_WORKERS} for production`);
    }
    const inventory: number[] = [];
    const produced: number[] = [];
    const productionLog: ProductionLogEntry[] | undefined = log.debug.production ? [] : undefined;

    const good = Goods.get(pack.cells.good[burg.cell]);
    if (good) {
      const modifier = this.getModifiers(good, burg.cell);
      const bonus = minmax(population * BONUS_URBAN_PRODUCTION, MIN_BONUS_PRODUCTION, MAX_BONUS_PRODUCTION);
      const localBonus = bonus * modifier;
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
      ingredientCosts: 0,
      revenue: 0,
      workersUsed: 0,
      activeGoalGoodId: null,
      imports: []
    };
  }

  /** Spends up to `workers` of the burg's remaining workers; false once none are left or nothing is worth making */
  private runWorkerLoop(index: ProductionIndex, state: BurgProductionState, workers = state.population): boolean {
    let used = 0;
    state.imports = []; // other burgs traded since the last turn

    while (used < workers - 0.001) {
      const workersLeft = state.population - state.workersUsed;
      const workerFraction = Math.min(1, workersLeft, workers - used);
      if (workerFraction <= 0.001) return false;

      const decision = this.makeProductionDecision(index, state, state.activeGoalGoodId, workersLeft, workerFraction);
      if (!decision) return false;

      state.activeGoalGoodId = decision.goalGoodId;
      this.executeManufacture(index, state, decision, workerFraction);
      used += workerFraction;
      state.workersUsed += workerFraction;
    }

    return true;
  }

  private executeManufacture(
    index: ProductionIndex,
    state: BurgProductionState,
    decision: ProductionDecision,
    workerFraction: number
  ): void {
    const { good, ingredients, maxYield } = decision.action;
    const actualYield = Math.min(workerFraction, maxYield);
    const cultureModifier = this.getModifiers(good, state.burg.cell);
    const produced = rn(actualYield * cultureModifier, 2);
    if (!produced) return;

    // Plan all ingredient sourcing first; bail out before mutating state if any market buy fails.
    type Plan = { ingredientId: number; amount: number; fromInventory: number; trade: Trade | null };
    const plans: Plan[] = [];
    for (const ingredient of ingredients) {
      const ingredientId = ingredient.goodId;
      const amount = actualYield * ingredient.amount;
      const fromInventory = Math.min(state.inventory[ingredientId] || 0, amount);
      const fromMarket = Math.max(0, amount - fromInventory);

      let trade: Trade | null = null;
      if (fromMarket > 0.01) {
        trade = this.acquire(index, state, Goods.get(ingredientId)!, fromMarket, DEAL_KINDS.input);
        if (!trade) {
          const message = `Failed to acquire ${rn(fromMarket, 2)} units of ${Goods.get(ingredientId)?.name} from market for production of ${good.name}`;
          log.error(message);
          return;
        }
      }
      plans.push({ ingredientId, amount, fromInventory, trade });
    }

    const recipe: ProductionRecipeEntry[] = [];
    for (const { ingredientId, amount, fromInventory, trade } of plans) {
      if (trade) {
        const marketCost = trade.units * trade.price;
        state.ingredientCosts += marketCost;
        state.burg.treasury = rn((state.burg.treasury || 0) - marketCost, 2);
      }
      recipe.push({ goodId: ingredientId, units: rn(amount, 2) });

      state.inventory[ingredientId] = Math.max(0, (state.inventory[ingredientId] || 0) - fromInventory);
    }

    state.inventory[good.i] = (state.inventory[good.i] || 0) + produced;
    state.produced[good.i] = (state.produced[good.i] || 0) + produced;

    if (state.log) {
      const entry: MfgEntry = { goodId: good.i, units: produced, recipe, candidates: decision.candidates };
      if (cultureModifier !== 1) entry.cultureModifier = cultureModifier;
      state.log.push(entry);
    }
  }

  /** Buys from the burg's market while it stocks the good, otherwise imports from the turn's cheapest source */
  private acquire(
    index: ProductionIndex,
    state: BurgProductionState,
    good: Good,
    units: number,
    kind: DealKind,
    budget = Infinity
  ): Trade | null {
    const { burg } = state;
    let market = state.market;
    let trade: Trade | null;
    if ((market.goods[good.i]?.stock || 0) > 0.01) {
      trade = Markets.buy({ burg, good, units, kind, budget });
    } else {
      const quote = state.imports[good.i];
      if (!quote) return null;
      state.imports[good.i] = undefined; // the source's stock and price moved
      market = quote.source;
      trade = Markets.importForBurg({ burg, source: market, good, units, kind, terms: index.tradeTerms, budget });
    }

    if (trade) state.log?.push({ goodId: good.i, market: market.i, kind, ...trade });
    return trade;
  }

  /** The local quote while the burg's market stocks the good, otherwise the turn's cheapest import */
  private quote(index: ProductionIndex, state: BurgProductionState, goodId: number): MarketQuote {
    const local = Markets.quoteMarket(state.market, goodId, state.burg);
    const good = Goods.get(goodId);
    if (local.stock > 0.01 || !good) return local;

    if (state.imports[goodId] === undefined) {
      state.imports[goodId] = Markets.quoteImport(state.burg, good, index.tradeTerms);
    }
    const imported = state.imports[goodId];
    return imported ? { ...local, stock: imported.stock, buyPrice: imported.buyPrice } : local;
  }

  /** The burg sold only what it made, so only that can be kept */
  private quoteKeep(state: BurgProductionState, good: Good) {
    return state.produced[good.i] ? Markets.quoteKeep(state.burg, good) : null;
  }

  private sellInventoryToMarket(state: BurgProductionState): void {
    let phaseRevenue = 0;
    const taxRate = States.getSalesTax(state.burg);

    for (const goodIdStr in state.inventory) {
      const goodId = +goodIdStr;
      const units = state.inventory[goodId];
      if (units <= 0) continue;

      const good = Goods.get(goodId)!;
      const trade = Markets.sell({ burg: state.burg, good, units, taxRate });
      if (!trade) continue;

      const revenue = trade.units * trade.price - trade.tax;
      phaseRevenue += revenue;
      state.log?.push({ goodId, market: state.market.i, kind: DEAL_KINDS.sale, ...trade });
    }

    state.inventory = [];
    state.revenue += phaseRevenue;
    state.burg.treasury = rn((state.burg.treasury || 0) + phaseRevenue, 2);
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

  /** Covers the burg's demand categories in priority order, cheapest coverage first, within its treasury */
  private fillDemand(index: ProductionIndex, state: BurgProductionState): void {
    const { burg } = state;
    const demandTargets = getDemandTargets(burg.population || 0);
    const demandCoverage = new Array(DEMAND_PRIORITY.length).fill(0);
    state.imports = []; // other burgs traded since its last turn

    for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
      let shortage = Math.max(0, demandTargets[categoryIndex] - demandCoverage[categoryIndex]);
      if (shortage <= 0.001) continue;

      const sortedCandidates: { candidate: DemandGoodCandidate; costPerCoverage: number }[] = [];
      for (const candidate of index.demandGoodsByCategory[categoryIndex]) {
        const own = this.quoteKeep(state, candidate.good);
        const quote = this.quote(index, state, candidate.goodId);
        if (!own && quote.stock <= 0.01) continue;
        const price = own ? Math.min(own.price, quote.buyPrice) : quote.buyPrice;
        sortedCandidates.push({ candidate, costPerCoverage: price / candidate.coverageWeight });
      }
      sortedCandidates.sort((a, b) => a.costPerCoverage - b.costPerCoverage);

      for (const { candidate } of sortedCandidates) {
        if (shortage <= 0.001) break;

        const budget = burg.treasury || 0;
        if (budget <= 0.01) break;

        const cover = (trade: Trade | null) => {
          if (!trade) return;
          burg.treasury = rn((burg.treasury || 0) - trade.units * trade.price, 2);
          const coverage = index.demandCoverageByGood[candidate.goodId];
          for (let coverageIndex = 0; coverageIndex < DEMAND_PRIORITY.length; coverageIndex++) {
            demandCoverage[coverageIndex] += trade.units * (coverage[coverageIndex] || 0);
          }
          shortage = Math.max(0, demandTargets[categoryIndex] - demandCoverage[categoryIndex]);
        };

        // what the burg sold to its own market is kept back first when that is cheaper than buying it
        const own = this.quoteKeep(state, candidate.good);
        if (own && own.price <= this.quote(index, state, candidate.goodId).buyPrice) {
          const units = shortage / candidate.coverageWeight;
          const kept = Markets.keep({ burg, good: candidate.good, units, budget });
          if (kept)
            state.log?.push({ goodId: candidate.goodId, market: state.market.i, kind: DEAL_KINDS.kept, ...kept });
          cover(kept);
        }
        if (shortage <= 0.001) continue;

        const units = shortage / candidate.coverageWeight;
        cover(this.acquire(index, state, candidate.good, units, DEAL_KINDS.demand, burg.treasury || 0));
      }
    }
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

    const modifier = this.getModifiers(recipe.good, state.burg.cell);
    quotes[recipe.good.i] ??= this.quote(index, state, recipe.good.i);
    const outQuote = quotes[recipe.good.i];
    const sellValue = (outQuote.sellPrice || recipe.good.value) * modifier;
    const ingredientCost = marketCostTotal / actualUnits;
    const score = sellValue - ingredientCost;

    return {
      action: {
        good: recipe.good,
        ingredients: recipe.ingredients,
        maxYield
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

    const modifier = this.getModifiers(good, state.burg.cell);
    quotes[good.i] ??= this.quote(index, state, good.i);
    const sellQuote = quotes[good.i];
    const sellValuePerUnit = (sellQuote.sellPrice || good.value) * modifier;
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

        const subPlan = this.planGoodAction(
          index,
          state,
          ingredientGood,
          ingredient.amount,
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
      const normalizedGain = workersNeeded > 0 ? projectedGain / workersNeeded : projectedGain;
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
      candidates.push(goalPlan.candidate);
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

  // Rural production for a single land cell
  getCellProduction(
    cellId: number,
    biomeProduction: Record<number, { goodId: number; production: number }[]>
  ): Record<number, number> {
    const produced: Record<number, number> = {};

    const modifier = (good: Good) => this.getModifiers(good, cellId);
    const add = (goodId: number, amount: number) => {
      produced[goodId] = rn((produced[goodId] || 0) + amount * RURAL_OUTPUT_FACTOR, 2);
    };

    const isWater = pack.cells.h[cellId] < 20;
    const pop = isWater ? sum(pack.cells.c[cellId].map(c => pack.cells.pop[c])) || 0 : pack.cells.pop[cellId];

    if (pop > 0) {
      for (const { goodId, production } of biomeProduction[pack.cells.biome[cellId]] || []) {
        const good = Goods.get(goodId);
        if (good) add(goodId, pop * production * modifier(good));
      }

      const bonusGoodId = pack.cells.good[cellId];
      if (bonusGoodId) {
        const good = Goods.get(bonusGoodId);
        if (good) {
          const bonus = Math.min(pop * BONUS_RURAL_PRODUCTION, MAX_BONUS_PRODUCTION);
          add(bonusGoodId, bonus * modifier(good));
        }
      }
    }

    return produced;
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

export const isMfgEntry = (entry: ProductionLogEntry): entry is MfgEntry => "recipe" in entry;
export const isTradeEntry = (entry: ProductionLogEntry): entry is TradeEntry => "kind" in entry;

type PlannedAction = {
  good: Good;
  ingredients: Ingredient[];
  maxYield: number;
};

type Recipe = { good: Good; ingredients: Ingredient[] };
type Ingredient = { goodId: number; amount: number };

type ProductionIndex = {
  goods: Good[];
  demandCoverageByGood: number[][];
  demandGoodsByCategory: DemandGoodCandidate[][];
  recipesByOutput: Recipe[][];
  productiveGoods: Good[];
  tradeTerms: TradeTerms;
};

type PlanningStock = { inventory: number[]; market: number[] };
type MarketQuote = ReturnType<typeof Markets.quoteMarket>;

type BurgProductionState = {
  burg: Burg;
  market: Market;
  population: number;
  inventory: number[];
  produced: number[]; // by good, local bonus included
  log?: ProductionLogEntry[]; // kept only in debug mode
  ingredientCosts: number;
  revenue: number;
  workersUsed: number;
  activeGoalGoodId: number | null;
  imports: (ImportQuote | null | undefined)[]; // cheapest import by good for the current turn, null when none
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

type MfgEntry = {
  goodId: number;
  units: number;
  recipe: ProductionRecipeEntry[];
  cultureModifier?: number; // omitted when 1
  candidates: readonly ProductionCandidate[];
};

type TradeEntry = { goodId: number; market: number; kind: DealKind } & Trade;

/** One step of a burg's production run, logged in debug mode */
export type ProductionLogEntry = LocalEntry | MfgEntry | TradeEntry;

export const Production = new ProductionModule();
