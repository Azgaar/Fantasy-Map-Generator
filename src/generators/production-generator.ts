import { sum } from "d3";
import { minmax } from "../utils";
import type { Burg } from "./burgs-generator";
import { DEFAULT_CULTURE_TYPE } from "./cultures-generator";
import type { DemandCategory, Good } from "./goods-generator";
import { DEMAND_PRIORITY, getDemandTargets } from "./goods-generator";
import type { Deal, Market } from "./markets-generator";
import type { Zone } from "./zones-generator";

const BONUS_RURAL_PRODUCTION = 0.25;
const BONUS_URBAN_PRODUCTION = 1;
const MIN_BONUS_PRODUCTION = 1;
const MAX_BONUS_PRODUCTION = 5;

export class ProductionModule {
  private zoneCellSets: Map<number, Set<number>> | null = null; // lazy zoneId -> cells lookup, built only when a good uses zone multipliers
  private zoneCellSetsSource: Zone[] | null = null;

  produce() {
    TIME && console.time("generateProduction");

    this.zoneCellSets = null; // rebuild lookup to reflect any in-place zone edits
    Markets.collectRuralProduction();
    Markets.initializeMarketPrices();

    const index = this.buildProductionIndex(pack.goods);
    const sortedBurgs = pack.burgs
      .filter(burg => burg.i && !burg.removed)
      .sort((a, b) => a.population! - b.population!);

    for (const burg of sortedBurgs) {
      if (!burg.i || burg.removed || !burg.market) continue;
      const market = Markets.get(burg.market);
      if (!market) continue;

      const state = this.createBurgProductionState(burg, market, index);
      this.runWorkerLoop(index, state);

      const phaseRevenue = this.sellInventoryToMarket(state);
      burg.treasury = rn((burg.treasury || 0) + phaseRevenue, 2);
      burg.product = rn(Math.max(0, phaseRevenue - state.ingredientCosts), 2);

      burg.production = state.records;
    }

    Markets.runGlobalTrade();
    this.fillBurgsDemand(sortedBurgs, index);

    TIME && console.timeEnd("generateProduction");
  }

  private fillBurgsDemand(sortedBurgs: Burg[], index: ProductionIndex): void {
    for (const burg of sortedBurgs) {
      if (!burg.i || burg.removed || !burg.market) continue;
      this.fillDemandFromMarket({
        burg,
        demandCoverageByGood: index.demandCoverageByGood,
        demandGoodsByCategory: index.demandGoodsByCategory,
        demandTargets: getDemandTargets(burg.population || 0),
        records: burg.production || []
      });
    }
  }

  private buildProductionIndex(goods: Good[]): ProductionIndex {
    const demandCoverageByGood = this.buildDemandCoverageByGood(goods);
    const demandGoodsByCategory = this.buildDemandGoodsByCategory(goods, demandCoverageByGood);
    const recipes = this.buildRecipesArray(goods);
    const recipesByOutput = this.buildRecipesByOutput(recipes);
    const productiveGoods = goods.filter(good => recipesByOutput[good.i]?.length);
    const minWorkersByGood = this.buildMinWorkersByGood(goods, recipesByOutput);

    return {
      goods,
      demandCoverageByGood,
      demandGoodsByCategory,
      recipesByOutput,
      productiveGoods,
      minWorkersByGood
    };
  }

  private createBurgProductionState(burg: Burg, market: Market, index: ProductionIndex): BurgProductionState {
    const population = rn(burg.population || 0, 2);
    const inventory: number[] = [];
    const demandTargets = getDemandTargets(population);
    const demandCoverage = this.calculateDemandCoverage(inventory, index.demandCoverageByGood);
    const records: ProductionRecord[] = [];

    const good = Goods.get(pack.cells.good[burg.cell]);
    if (good) {
      const modifier = this.getModifiers(good, burg.cell);
      const bonus = minmax(population * BONUS_URBAN_PRODUCTION, MIN_BONUS_PRODUCTION, MAX_BONUS_PRODUCTION);
      const localBonus = bonus * modifier;
      if (localBonus > 0) {
        inventory[good.i] = (inventory[good.i] || 0) + localBonus;
        records.push({ goodId: good.i, units: rn(localBonus, 2) });
      }
    }

    return {
      burg,
      market,
      population,
      demandTargets,
      inventory,
      demandCoverage,
      records,
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
    const cultureModifier = this.getModifiers(good, state.burg.cell);
    const produced = rn(actualYield * cultureModifier, 2);
    if (!produced) return;

    // Plan all ingredient sourcing first; bail out before mutating state if any market buy fails.
    type Plan = { ingredientId: number; amount: number; fromInventory: number; deal: Deal | null };
    const plans: Plan[] = [];
    for (const ingredient of ingredients) {
      const ingredientId = ingredient.goodId;
      const amount = actualYield * ingredient.amount;
      const fromInventory = Math.min(state.inventory[ingredientId] || 0, amount);
      const fromMarket = Math.max(0, amount - fromInventory);

      let deal: Deal | null = null;
      if (fromMarket > 0.01) {
        deal = Markets.buy({ burg: state.burg, good: Goods.get(ingredientId)!, units: fromMarket });
        if (!deal) {
          const message = `Failed to acquire ${rn(fromMarket, 2)} units of ${Goods.get(ingredientId)?.name} from market for production of ${good.name}`;
          ERROR && console.error(message);
          return;
        }
      }
      plans.push({ ingredientId, amount, fromInventory, deal });
    }

    const recipe: ProductionRecipeEntry[] = [];
    for (const { ingredientId, amount, fromInventory, deal } of plans) {
      if (deal) {
        state.records.push({ dealId: deal.i });
        const marketCost = deal.units * deal.price;
        state.ingredientCosts += marketCost;
        state.burg.treasury = rn((state.burg.treasury || 0) - marketCost, 2);
      }
      recipe.push({ goodId: ingredientId, units: rn(amount, 2) });

      state.inventory[ingredientId] = Math.max(0, (state.inventory[ingredientId] || 0) - fromInventory);
      this.addDemandCoverage(state.demandCoverage, ingredientId, -fromInventory, index.demandCoverageByGood);
    }

    state.inventory[good.i] = (state.inventory[good.i] || 0) + produced;

    this.addDemandCoverage(state.demandCoverage, good.i, produced, index.demandCoverageByGood);

    const record: MfgRecord = { goodId: good.i, units: produced, recipe };
    if (cultureModifier !== 1) record.cultureModifier = cultureModifier;
    if (DEBUG.production) record.candidates = decision.candidates;
    state.records.push(record);
  }

  private sellInventoryToMarket(state: BurgProductionState): number {
    let phaseRevenue = 0;
    const taxRate = States.getSalesTax(state.burg);

    for (const goodIdStr in state.inventory) {
      const goodId = +goodIdStr;
      const units = state.inventory[goodId];
      if (units <= 0) continue;

      const good = Goods.get(goodId)!;
      const deal = Markets.sell({ burg: state.burg, good, units, taxRate });
      if (!deal) continue;

      const grossRevenue = deal.units * deal.price;
      const taxAmount = deal.tax ?? grossRevenue * taxRate;
      const revenue = grossRevenue - taxAmount;

      phaseRevenue += revenue;
      state.records.push({ dealId: deal.i });
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
    for (const good of goods) minWorkersByGood[good.i] = recipesByOutput[good.i]?.length ? Infinity : 1;

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

  private calculateDemandCoverage(
    inventory: Record<number, number> | number[],
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
    demandCoverageByGood,
    demandGoodsByCategory,
    demandTargets,
    records
  }: {
    burg: Burg;
    demandCoverageByGood: number[][];
    demandGoodsByCategory: DemandGoodCandidate[][];
    demandTargets: number[];
    records: ProductionRecord[];
  }): void {
    const market = Markets.get(burg.market);
    if (!market) return;

    const demandCoverage = new Array(DEMAND_PRIORITY.length).fill(0);

    for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
      let shortage = Math.max(0, demandTargets[categoryIndex] - demandCoverage[categoryIndex]);
      if (shortage <= 0.001) continue;

      const candidates = demandGoodsByCategory[categoryIndex];
      const sortedCandidates: { candidate: DemandGoodCandidate; costPerCoverage: number }[] = [];
      for (const candidate of candidates) {
        const marketGood = market.goods[candidate.goodId];
        const stock = marketGood?.stock || 0;
        if (stock <= 0.01) continue;
        const price = Markets.customerBuyPrice(marketGood.price);
        const costPerCoverage = price / candidate.coverageWeight;
        sortedCandidates.push({ candidate, costPerCoverage });
      }
      sortedCandidates.sort((a, b) => a.costPerCoverage - b.costPerCoverage);

      for (const { candidate } of sortedCandidates) {
        if (shortage <= 0.001) break;

        const budget = burg.treasury || 0;
        if (budget <= 0.01) break;

        const units = shortage / candidate.coverageWeight;
        const deal = Markets.buy({ burg, good: candidate.good, units, budget });
        if (!deal) continue;

        records.push({ dealId: deal.i });
        const totalCost = deal.units * deal.price;
        burg.treasury = rn((burg.treasury || 0) - totalCost, 2);

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

    const modifier = this.getModifiers(recipe.good, state.burg.cell);
    const outQuote = Markets.quoteMarket(state.market, recipe.good.i);
    const sellValue = (outQuote.sellPrice || recipe.good.value) * modifier;
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
        cultureModifier: modifier,
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

    const modifier = this.getModifiers(good, state.burg.cell);
    const sellQuote = Markets.quoteMarket(state.market, good.i);
    const sellValuePerUnit = (sellQuote.sellPrice || good.value) * modifier;
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

        const ingredientGood = Goods.get(ingredient.goodId);
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
      const activeGood = Goods.get(activeGoalGoodId);
      if (activeGood) {
        const activeDemand = this.getDemandEffect(activeGood, demandFocus, index.demandCoverageByGood);
        activeGoal = this.planGoodAction(index, state, activeGood, fraction, fraction, workersLeft, activeDemand);
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
    const produced: Record<number, number> = {};
    for (const record of burg.production || []) {
      if (isDealRecord(record)) continue;
      produced[record.goodId] = rn((produced[record.goodId] || 0) + record.units, 2);
    }
    return produced;
  }

  // Rural production for a single land cell
  getCellProduction(
    cellId: number,
    biomeProduction: Record<number, { goodId: number; production: number }[]>
  ): Record<number, number> {
    const produced: Record<number, number> = {};

    const modifier = (good: Good) => this.getModifiers(good, cellId);
    const add = (goodId: number, amount: number) => {
      produced[goodId] = rn((produced[goodId] || 0) + amount, 2);
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

export const isDealRecord = (record: ProductionRecord): record is DealRecord => "dealId" in record;
export const isMfgRecord = (record: ProductionRecord): record is MfgRecord => "recipe" in record;

type PlannedAction = {
  good: Good;
  ingredients: Ingredient[];
  maxYield: number;
};

type Recipe = { good: Good; ingredients: Ingredient[] };
export type Ingredient = { goodId: number; amount: number };

type ProductionIndex = {
  goods: Good[];
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
  inventory: number[];
  demandCoverage: number[];
  records: ProductionRecord[];
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

export type ProductionRecipeEntry = { goodId: number; units: number };

export type DealRecord = { dealId: number };

export type MfgRecord = {
  goodId: number;
  units: number;
  recipe: ProductionRecipeEntry[];
  cultureModifier?: number; // omitted when 1
  candidates?: readonly ProductionCandidate[]; // recorded only when DEBUG.production is on
};

export type LocalRecord = { goodId: number; units: number };

export type ProductionRecord = DealRecord | MfgRecord | LocalRecord;

declare global {
  var Production: ProductionModule;
}

window.Production = new ProductionModule();
