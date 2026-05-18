import type { Burg } from "./burgs-generator";
import { DEFAULT_CULTURE_TYPE } from "./cultures-generator";
import type { DemandCategory, Good } from "./goods-generator";
import { BONUS_RESOURCE_PRODUCTION, DEMAND_PRIORITY, getDemandTargets } from "./goods-generator";
import type { Market } from "./markets-generator";
import { getSalesTaxRateForBurg } from "./states-generator";

export class ProductionModule {
  private readonly GOAL_STICKINESS_FACTOR = 0.85;
  private productionData = new Map<number, ProductionHistory[]>();

  produce() {
    TIME && console.time("generateProduction");

    Markets.collectRuralProduction();
    Markets.initializeMarketPrices();

    const index = this.buildProductionIndex(pack.goods);
    const validBurgs = this.getValidBurgs(pack.burgs);

    this.productionData.clear();

    const demandInventoryByBurg = new Map<number, number[]>();
    const demandTargetsByBurg: number[][] = [];
    for (const burg of validBurgs) {
      if (!burg.i) continue;
      const burgProduction = this.executeBurgProduction(burg, index);
      if (!burgProduction) continue;

      demandInventoryByBurg.set(burg.i, []);
      demandTargetsByBurg[burg.i] = burgProduction.demandTargets;
      this.productionData.set(burg.i, burgProduction.history);
    }

    const productionBurgIds = new Set(this.productionData.keys());
    Markets.redistributeAcrossMarkets(productionBurgIds, demandInventoryByBurg);

    for (const burg of validBurgs) {
      if (!burg.i) continue;
      const data = this.productionData.get(burg.i);
      const market = Markets.get(burg.market);
      if (!data || !market) continue;

      const demandInventory = demandInventoryByBurg.get(burg.i) ?? [];
      this.fillDemandFromMarket({
        burg,
        demandInventory,
        demandCoverageByGood: index.demandCoverageByGood,
        demandGoodsByCategory: index.demandGoodsByCategory,
        demandTargets: demandTargetsByBurg[burg.i] ?? getDemandTargets(burg.population || 0),
        history: data
      });
      burg.inventory = {};
      for (const goodIdStr in demandInventory) {
        const goodId = +goodIdStr;
        const amount = demandInventory[goodId];
        if (amount > 0.001) burg.inventory[goodId] = rn(amount, 2);
      }
    }

    Markets.updateMarketDemand(productionBurgIds, demandInventoryByBurg);

    TIME && console.timeEnd("generateProduction");
  }

  private getValidBurgs(burgs: Burg[]): Burg[] {
    return burgs.filter(burg => burg.i && !burg.removed).sort((a, b) => (a.population || 0) - (b.population || 0));
  }

  private buildProductionIndex(goods: Good[]): ProductionIndex {
    const goodById = this.buildGoodById(goods);
    const demandCoverageByGood = this.buildDemandCoverageByGood(goods);
    const demandGoodsByCategory = this.buildDemandGoodsByCategory(goods, demandCoverageByGood);
    const recipes = this.buildRecipesArray(goods);
    const recipesByOutput = this.buildRecipesByOutput(recipes);
    const productiveGoods = goods.filter(good => recipesByOutput[good.i]?.length);
    const minWorkersByGood = this.buildMinWorkersByGood(goods, recipesByOutput);

    return {
      goods,
      goodById,
      demandCoverageByGood,
      demandGoodsByCategory,
      recipesByOutput,
      productiveGoods,
      minWorkersByGood
    };
  }

  private executeBurgProduction(
    burg: Burg,
    index: ProductionIndex
  ): {
    demandTargets: number[];
    history: ProductionHistory[];
  } | null {
    const market = Markets.get(burg.market);
    if (!market) return null;

    const state = this.createBurgProductionState(burg, market, index);
    this.runWorkerLoop(index, state);
    this.commitProducedTotals(burg, state.history);

    const phaseRevenue = this.sellInventoryToMarket(state, index);
    burg.treasury = (burg.treasury || 0) + phaseRevenue;
    burg.product = Math.max(0, phaseRevenue - state.ingredientCosts);

    return {
      demandTargets: state.demandTargets,
      history: state.history
    };
  }

  private createBurgProductionState(burg: Burg, market: Market, index: ProductionIndex): BurgProductionState {
    const population = burg.population || 0;
    const inventory = this.copyInventory(burg.inventory);
    const localGoodId = pack.cells.good[burg.cell];

    if (localGoodId) {
      const localBonus = Math.min(Math.ceil(population), BONUS_RESOURCE_PRODUCTION);
      if (localBonus > 0) inventory[localGoodId] = (inventory[localGoodId] || 0) + localBonus;
    }

    return {
      burg,
      market,
      population,
      demandTargets: getDemandTargets(burg.population || 0),
      inventory,
      demandCoverage: this.calculateDemandCoverage(inventory, index.demandCoverageByGood),
      history: [],
      ingredientCosts: 0,
      activeGoalGoodId: null
    };
  }

  private runWorkerLoop(index: ProductionIndex, state: BurgProductionState): void {
    let workersUsed = 0;

    for (let i = 0; i < Math.ceil(state.population); i++) {
      const workersLeft = state.population - workersUsed;
      const workerFraction = Math.min(1, workersLeft);
      if (workerFraction <= 0) break;

      const decision = this.makeProductionDecision(
        index,
        state,
        state.demandTargets,
        state.demandCoverage,
        state.activeGoalGoodId,
        workersLeft,
        workerFraction
      );
      if (!decision) break;

      state.activeGoalGoodId = decision.goalGoodId;
      this.executeManufacture(state, index, decision, workerFraction);
      workersUsed += workerFraction;
    }
  }

  private executeManufacture(
    state: BurgProductionState,
    index: ProductionIndex,
    decision: ProductionDecision,
    workerFraction: number
  ): void {
    const { good, ingredients, maxYield } = decision.action;
    const actualYield = Math.min(workerFraction, maxYield);
    const cultureModifier = good.culture?.[state.burg.type || DEFAULT_CULTURE_TYPE] || 1;
    const produced = actualYield * cultureModifier;
    const recipeLog: ManufacturingRecipeLog = [];

    for (const ingredient of ingredients) {
      const ingredientGoodId = ingredient.goodId;
      const amount = actualYield * ingredient.amount;
      const fromInventory = Math.min(state.inventory[ingredientGoodId] || 0, amount);
      const fromMarket = Math.max(0, amount - fromInventory);

      state.inventory[ingredientGoodId] = Math.max(0, (state.inventory[ingredientGoodId] || 0) - fromInventory);
      this.addDemandCoverage(state.demandCoverage, ingredientGoodId, -fromInventory, index.demandCoverageByGood);

      const marketCost = this.buyIngredientFromMarket(state, index, ingredientGoodId, fromMarket);
      if (marketCost) recipeLog.push({ goodId: ingredientGoodId, amount, marketCost });
    }

    state.inventory[good.i] = (state.inventory[good.i] || 0) + produced;
    this.addDemandCoverage(state.demandCoverage, good.i, produced, index.demandCoverageByGood);

    state.history.push({
      kind: "mfg",
      goodId: good.i,
      units: produced,
      cultureModifier,
      recipe: recipeLog,
      candidates: decision.candidates
    });
  }

  private buyIngredientFromMarket(
    state: BurgProductionState,
    index: ProductionIndex,
    goodId: number,
    units: number
  ): number {
    if (units <= 0) return 0;

    const { burg, history } = state;
    const good = index.goodById[goodId]!;
    const budget = Math.max(0, burg.treasury || 0);
    const deal = Markets.buy({ burg, good, units, budget });
    if (!deal) return 0;

    history.push({ kind: "deal", dealId: deal.i });
    const totalCost = deal.units * deal.price;
    state.ingredientCosts += totalCost;
    burg.treasury = (burg.treasury || 0) - totalCost;

    return totalCost;
  }

  private commitProducedTotals(burg: Burg, history: ProductionHistory[]): void {
    burg.produced = {};
    for (const entry of history) {
      if (entry.kind !== "mfg") continue;
      burg.produced[entry.goodId] = (burg.produced[entry.goodId] || 0) + entry.units;
    }
  }

  private sellInventoryToMarket(state: BurgProductionState, index: ProductionIndex): number {
    let phaseRevenue = 0;

    for (const goodIdStr in state.inventory) {
      const goodId = +goodIdStr;
      const units = state.inventory[goodId];
      if (units <= 0) continue;

      const good = index.goodById[goodId]!;
      const deal = Markets.sell({ burg: state.burg, good, units });
      if (!deal) continue;

      const grossRevenue = deal.units * deal.price;
      const taxAmount = grossRevenue * getSalesTaxRateForBurg(state.burg);
      const revenue = grossRevenue - taxAmount;

      phaseRevenue += revenue;
      state.history.push({ kind: "deal", dealId: deal.i });
    }

    return phaseRevenue;
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

  private buildMinWorkersByGood(goods: Good[], recipesByOutput: Recipe[][]): number[] {
    const minWorkersByGood: number[] = [];
    for (const good of goods) minWorkersByGood[good.i] = 1;

    for (let iteration = 0; iteration < goods.length; iteration++) {
      let changed = false;

      for (const good of goods) {
        const recipeList = recipesByOutput[good.i];
        if (!recipeList?.length) continue;

        let bestForGood = minWorkersByGood[good.i] ?? Infinity;
        for (const recipe of recipeList) {
          let workers = 1;
          for (const ingredient of recipe.ingredients) {
            const ingredientWorkers = minWorkersByGood[ingredient.goodId] ?? 1;
            workers += ingredientWorkers * ingredient.amount;
          }
          if (workers < bestForGood) bestForGood = workers;
        }

        if (bestForGood + 0.001 < (minWorkersByGood[good.i] ?? Infinity)) {
          minWorkersByGood[good.i] = bestForGood;
          changed = true;
        }
      }

      if (!changed) break;
    }

    return minWorkersByGood;
  }

  private buildGoodById(goods: Good[]): Good[] {
    const goodById: Good[] = [];
    for (const good of goods) goodById[good.i] = good;
    return goodById;
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

  private copyInventory(inventory: Record<number, number> | undefined): NumericInventory {
    const copy: NumericInventory = [];
    if (!inventory) return copy;

    for (const goodIdStr in inventory) {
      const amount = inventory[+goodIdStr];
      if (amount > 0) copy[+goodIdStr] = amount;
    }

    return copy;
  }

  private calculateDemandCoverage(
    inventory: Record<number, number> | NumericInventory,
    demandCoverageByGood: number[][]
  ): number[] {
    const demandCoverage: number[] = Array(DEMAND_PRIORITY.length).fill(0);

    for (const goodIdStr in inventory) {
      const goodId = +goodIdStr;
      const amount = inventory[goodId] || 0;
      if (amount <= 0) continue;

      this.addDemandCoverage(demandCoverage, goodId, amount, demandCoverageByGood);
    }

    return demandCoverage;
  }

  private addDemandCoverage(
    demandCoverage: number[],
    goodId: number,
    amount: number,
    demandCoverageByGood: number[][]
  ): void {
    if (!amount) return;

    const coverage = demandCoverageByGood[goodId];
    if (!coverage) return;
    for (let category = 0; category < DEMAND_PRIORITY.length; category++) {
      const coveredAmount = coverage[category] || 0;
      if (!coveredAmount) continue;
      demandCoverage[category] += amount * coveredAmount;
    }
  }

  private fillDemandFromMarket({
    burg,
    demandInventory,
    demandCoverageByGood,
    demandGoodsByCategory,
    demandTargets,
    history
  }: {
    burg: Burg;
    demandInventory: number[];
    demandCoverageByGood: number[][];
    demandGoodsByCategory: DemandGoodCandidate[][];
    demandTargets: number[];
    history: ProductionHistory[];
  }): void {
    const demandCoverage = this.calculateDemandCoverage(demandInventory, demandCoverageByGood);

    for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
      let shortage = Math.max(0, demandTargets[categoryIndex] - demandCoverage[categoryIndex]);
      if (shortage <= 0.001) continue;

      const candidates = demandGoodsByCategory[categoryIndex];

      for (const candidate of candidates) {
        if (shortage <= 0.001) break;

        const budget = burg.treasury || 0;
        if (budget <= 0.001) break;

        const units = shortage / candidate.coverageWeight;
        const deal = Markets.buy({ burg, good: candidate.good, units, budget });
        if (!deal) continue;

        history.push({ kind: "deal", dealId: deal.i });
        demandInventory[candidate.goodId] = (demandInventory[candidate.goodId] || 0) + deal.units;
        const totalCost = deal.units * deal.price;
        burg.treasury = (burg.treasury || 0) - totalCost;

        const retainedCoverageByCategory = demandCoverageByGood[candidate.goodId];
        for (let coverageCategoryIndex = 0; coverageCategoryIndex < DEMAND_PRIORITY.length; coverageCategoryIndex++) {
          const retainedCoverage = retainedCoverageByCategory[coverageCategoryIndex] || 0;
          if (!retainedCoverage) continue;
          demandCoverage[coverageCategoryIndex] += deal.units * retainedCoverage;
        }

        shortage = Math.max(0, demandTargets[categoryIndex] - demandCoverage[categoryIndex]);
      }
    }
  }

  private getDemandFocus(demandTargets: number[], demandCoverage: number[]): DemandFocus | null {
    for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
      const shortage = Math.max(0, demandTargets[categoryIndex] - demandCoverage[categoryIndex]);
      if (shortage <= 0.001) continue;

      return {
        category: DEMAND_PRIORITY[categoryIndex] as DemandCategory,
        categoryIndex,
        shortage
      };
    }

    return null;
  }

  private getDemandEffect(good: Good, demandFocus: DemandFocus | null, demandCoverageByGood: number[][]): DemandEffect {
    if (!demandFocus) return { multiplier: 1, category: null };

    const coverageWeight = demandCoverageByGood[good.i]?.[demandFocus.categoryIndex] || 0;
    if (!coverageWeight) return { multiplier: 1, category: null };

    const multiplier = 1 + coverageWeight * demandFocus.shortage;
    return {
      multiplier,
      category: demandFocus.category
    };
  }

  private buildImmediateManufactureCandidate(
    state: BurgProductionState,
    recipe: Recipe,
    demandEffect: DemandEffect,
    units: number,
    goalGoodId?: number
  ): { action: PlannedAction; candidate: ProductionCandidate } | null {
    let maxYield = Infinity;
    let marketCostTotal = 0;

    for (const ingredient of recipe.ingredients) {
      const quote = Markets.quoteMarket(state.market, ingredient.goodId);
      const inventoryAvailable = state.inventory[ingredient.goodId] || 0;
      const marketAvailable = quote.stock || 0;
      const totalAvailable = inventoryAvailable + marketAvailable;
      if (totalAvailable < ingredient.amount * units - 0.001) return null;
      maxYield = Math.min(maxYield, totalAvailable / ingredient.amount);
    }

    if (!Number.isFinite(maxYield) || maxYield <= 0) return null;

    const actualUnits = Math.min(units, maxYield);
    for (const ingredient of recipe.ingredients) {
      const quote = Markets.quoteMarket(state.market, ingredient.goodId);
      const inventoryAvailable = state.inventory[ingredient.goodId] || 0;
      const amountNeeded = actualUnits * ingredient.amount;
      const fromMarket = Math.max(0, amountNeeded - Math.min(inventoryAvailable, amountNeeded));
      marketCostTotal += fromMarket * quote.buyPrice;
    }

    const burgType = state.burg.type || DEFAULT_CULTURE_TYPE;
    const cultureModifier = recipe.good.culture?.[burgType] || 1;
    const outQuote = Markets.quoteMarket(state.market, recipe.good.i);
    const sellValue = (outQuote.sellPrice || recipe.good.value) * cultureModifier;
    const ingredientCost = marketCostTotal / actualUnits;
    const projectedGain = (sellValue - ingredientCost) * demandEffect.multiplier;
    const score = projectedGain;

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
        cultureModifier,
        demandCategory: demandEffect.category,
        demandMultiplier: demandEffect.multiplier,
        score,
        ingredients: recipe.ingredients,
        goalGoodId
      }
    };
  }

  private planGoodAction(
    index: ProductionIndex,
    state: BurgProductionState,
    good: Good,
    targetUnits: number,
    stepUnits: number,
    workersLeft: number,
    demandEffect: DemandEffect,
    path: boolean[] = []
  ): GoalActionPlan | null {
    if (workersLeft <= 0 || targetUnits <= 0) return null;
    if (path[good.i]) return null;

    path[good.i] = true;

    const burgType = state.burg.type || DEFAULT_CULTURE_TYPE;
    const cultureModifier = good.culture?.[burgType] || 1;
    const sellQuote = Markets.quoteMarket(state.market, good.i);
    const sellValuePerUnit = (sellQuote.sellPrice || good.value) * cultureModifier;
    const totalProjectedGain = sellValuePerUnit * targetUnits * demandEffect.multiplier;

    const recipeList = index.recipesByOutput[good.i];
    if (!recipeList?.length) {
      path[good.i] = false;
      return null;
    }

    let bestPlan: GoalActionPlan | null = null;

    for (const recipe of recipeList) {
      const immediate = this.buildImmediateManufactureCandidate(
        state,
        recipe,
        demandEffect,
        Math.min(stepUnits, targetUnits),
        good.i
      );
      if (immediate && targetUnits <= workersLeft + 0.001) {
        const perUnitNetGain = immediate.candidate.score;
        const immediateMarketCost = immediate.candidate.ingredientCost * immediate.candidate.units;
        const plan: GoalActionPlan = {
          goalGoodId: good.i,
          workersNeeded: targetUnits,
          marketCost: immediateMarketCost,
          projectedGain: perUnitNetGain * targetUnits,
          normalizedGain: perUnitNetGain,
          action: immediate.action,
          candidate: immediate.candidate
        };
        if (!bestPlan || plan.normalizedGain > bestPlan.normalizedGain + 0.001) bestPlan = plan;
        continue;
      }

      let workersNeeded = targetUnits;
      let marketCost = 0;
      let feasible = true;
      let nextActionPlan: GoalActionPlan | null = null;

      for (const ingredient of recipe.ingredients) {
        const amountNeeded = targetUnits * ingredient.amount;
        let remaining = amountNeeded;

        const quote = Markets.quoteMarket(state.market, ingredient.goodId);
        const fromInventory = Math.min(remaining, state.inventory[ingredient.goodId] || 0);
        remaining -= fromInventory;

        const fromMarket = Math.min(remaining, quote.stock);
        remaining -= fromMarket;
        marketCost += fromMarket * quote.buyPrice;

        if (remaining <= 0.001) continue;

        const ingredientGood = index.goodById[ingredient.goodId];
        if (!ingredientGood) {
          feasible = false;
          break;
        }

        const lowerBoundWorkers = remaining * (index.minWorkersByGood[ingredient.goodId] ?? Infinity);
        workersNeeded += lowerBoundWorkers;
        if (workersNeeded > workersLeft + 0.001) {
          feasible = false;
          break;
        }

        const subPlan = this.planGoodAction(
          index,
          state,
          ingredientGood,
          remaining,
          stepUnits,
          workersLeft - targetUnits,
          demandEffect,
          path
        );

        if (!subPlan) {
          feasible = false;
          break;
        }

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
      if (!bestPlan || plan.normalizedGain > bestPlan.normalizedGain + 0.001) bestPlan = plan;
    }

    path[good.i] = false;
    return bestPlan;
  }

  private makeProductionDecision(
    index: ProductionIndex,
    state: BurgProductionState,
    demandTargets: number[],
    demandCoverage: number[],
    activeGoalGoodId: number | null,
    workersLeft: number,
    fraction: number
  ): ProductionDecision | null {
    const candidates: ProductionCandidate[] = [];
    const demandFocus = this.getDemandFocus(demandTargets, demandCoverage);

    let chosenGoal: GoalActionPlan | null = null;
    let activeGoal: GoalActionPlan | null = null;
    for (const good of index.productiveGoods) {
      const demandEffect = this.getDemandEffect(good, demandFocus, index.demandCoverageByGood);
      const goalPlan = this.planGoodAction(index, state, good, fraction, fraction, workersLeft, demandEffect);
      if (!goalPlan || goalPlan.projectedGain <= 0) continue;
      candidates.push(goalPlan.candidate);
      if (good.i === activeGoalGoodId) activeGoal = goalPlan;
      if (!chosenGoal || goalPlan.normalizedGain > chosenGoal.normalizedGain + 0.001) chosenGoal = goalPlan;
    }

    if (activeGoalGoodId !== null && chosenGoal && !activeGoal) {
      const activeGood = index.goodById[activeGoalGoodId];
      if (activeGood) {
        const activeDemand = this.getDemandEffect(activeGood, demandFocus, index.demandCoverageByGood);
        activeGoal = this.planGoodAction(index, state, activeGood, fraction, fraction, workersLeft, activeDemand);
      }
    }

    if (
      activeGoal &&
      chosenGoal &&
      activeGoal.normalizedGain >= chosenGoal.normalizedGain * this.GOAL_STICKINESS_FACTOR
    ) {
      chosenGoal = activeGoal;
    }

    if (!chosenGoal) return null;
    return {
      action: chosenGoal.action,
      candidates,
      goalGoodId: chosenGoal.goalGoodId
    };
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

  getProductionData(burgId: number): readonly ProductionHistory[] | undefined {
    return this.productionData.get(burgId);
  }
}

type PlannedAction = {
  good: Good;
  ingredients: Ingredient[];
  maxYield: number;
};

type Recipe = { good: Good; ingredients: Ingredient[] };
export type Ingredient = { goodId: number; amount: number };

type NumericInventory = number[];

type ProductionIndex = {
  goods: Good[];
  goodById: Good[];
  demandCoverageByGood: number[][];
  demandGoodsByCategory: DemandGoodCandidate[][];
  recipesByOutput: Recipe[][];
  productiveGoods: Good[];
  minWorkersByGood: number[];
};

type BurgProductionState = {
  burg: Burg;
  market: Market;
  population: number;
  demandTargets: number[];
  inventory: NumericInventory;
  demandCoverage: number[];
  history: ProductionHistory[];
  ingredientCosts: number;
  activeGoalGoodId: number | null;
};

type DemandEffect = { multiplier: number; category: DemandCategory | null };

type DemandFocus = { category: DemandCategory; categoryIndex: number; shortage: number };

type DemandGoodCandidate = { good: Good; goodId: number; coverageWeight: number };

type ProductionDecision = {
  action: PlannedAction;
  candidates: ProductionCandidate[];
  goalGoodId: number | null;
};

type ManufacturingRecipeLog = { goodId: number; amount: number; marketCost: number }[];

export type ProductionCandidate = {
  goodId: number;
  units: number;
  sellPrice: number;
  ingredientCost: number;
  cultureModifier: number;
  demandCategory: DemandCategory | null;
  demandMultiplier: number;
  score: number;
  ingredients: readonly Ingredient[];
  goalGoodId?: number;
  isPreparation?: boolean;
  gainPerWorker?: number; // set for prep candidates: goal projected gain per worker (demand-weighted)
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

export type MfgHistory = {
  kind: "mfg";
  goodId: number;
  units: number;
  cultureModifier: number;
  recipe: readonly ManufacturingRecipeLog[number][];
  candidates?: readonly ProductionCandidate[];
};

export type DealHistory = { kind: "deal"; dealId: number };

export type ProductionHistory = MfgHistory | DealHistory;

declare global {
  var Production: ProductionModule;
}

window.Production = new ProductionModule();
