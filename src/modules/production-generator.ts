import type { Burg } from "./burgs-generator";
import type { CultureType } from "./cultures-generator";
import { DEFAULT_CULTURE_TYPE } from "./cultures-generator";
import type { DemandCategory, Good } from "./goods-generator";
import { DEMAND_PRIORITY, DEMAND_TARGET_FACTORS } from "./goods-generator";
import {
  BONUS_RESOURCE_PRODUCTION,
  MARKET_MARGIN,
  MARKET_PRESSURE_FACTOR,
  type Market,
  PRICE_CEILING_FACTOR,
  PRICE_FLOOR_FACTOR
} from "./trade-generator";

export class ProductionModule {
  private readonly GOAL_STICKINESS_FACTOR = 0.85;
  private productionData = new Map<number, ProductionHistoryEntry[]>();

  produce() {
    TIME && console.time("generateProduction");
    const { burgs, goods } = pack;

    const validBurgs = burgs.filter(b => b.i && !b.removed);
    validBurgs.sort((a, b) => (a.population || 0) - (b.population || 0));

    const goodById = new Map<number, Good>(goods.map(g => [g.i, g]));
    const recipes = this.buildRecipesArray(goods);
    const recipesByOutput = this.buildRecipesByOutput(recipes);
    const minWorkersByGood = this.buildMinWorkersByGood(goods, recipesByOutput);

    this.productionData.clear();
    const demandInventoryByBurg = new Map<number, Record<number, number>>();

    for (const burg of validBurgs) {
      const market = Trade.getMarketForBurg(burg);
      if (!market) continue;
      const cultureType = burg.type || DEFAULT_CULTURE_TYPE;
      const population = burg.population || 0;
      const demandTargets = this.buildDemandTargets(burg);

      const inventory: Record<number, number> = { ...(burg.inventory || {}) };

      // Pre-seed local resource: burg is at the source so it doesn't need to buy it
      const localGoodId = pack.cells.good[burg.cell];
      if (localGoodId) {
        const localBonus = Math.min(Math.ceil(population), BONUS_RESOURCE_PRODUCTION);
        if (localBonus > 0) inventory[localGoodId] = (inventory[localGoodId] || 0) + localBonus;
      }

      const history: ProductionHistoryEntry[] = [];
      let workersUsed = 0;
      let activeGoalGoodId: number | null = null;
      let ingredientCosts = 0;

      for (let i = 0; i < Math.ceil(population); i++) {
        const workersLeft = population - workersUsed;
        const fraction = Math.min(1, workersLeft);
        if (fraction <= 0) break;

        const marketView = this.getMarketView(market);
        const decision = this.makeProductionDecision({
          burg,
          recipes,
          recipesByOutput,
          minWorkersByGood,
          goodById,
          demandTargets,
          cultureType,
          inventory,
          marketInventory: marketView.inventory,
          buyPrice: marketView.buyPrice,
          sellPrice: marketView.sellPrice,
          activeGoalGoodId,
          workersLeft,
          fraction
        });
        if (!decision?.action) break;
        activeGoalGoodId = decision.goalGoodId;

        if (decision.action.kind === "manufacture") {
          const { good, ingredients, maxYield } = decision.action;
          const actualYield = Math.min(fraction, maxYield);
          const cultureModifier = this.getCultureModifier(good, cultureType);
          const produced = actualYield * cultureModifier;
          const recipeLog: MfgHistoryEntry["recipe"] = [];

          for (const ingredient of ingredients) {
            const ingId = ingredient.goodId;
            const amount = actualYield * ingredient.amount;
            const fromInventory = Math.min(inventory[ingId] || 0, amount);
            const fromMarket = Math.max(0, amount - fromInventory);

            inventory[ingId] = Math.max(0, (inventory[ingId] || 0) - fromInventory);

            let marketCost = 0;
            if (fromMarket > 0) {
              const good = goodById.get(ingId)!;
              const marketGood = this.getMarketGoodData(market, ingId, good.value);
              const actualBuy = Math.min(fromMarket, marketGood.stock || 0);
              const purchase = Trade.buyFromMarket({
                burg,
                good,
                units: actualBuy,
                marketPrice: marketGood.price * (1 + MARKET_MARGIN)
              });
              marketCost = purchase.totalCost;
              ingredientCosts += marketCost;
              if (purchase.dealId !== null) history.push({ kind: "deal", dealId: purchase.dealId });
              burg.treasury = Math.round(((burg.treasury || 0) - marketCost) * 100) / 100;
              marketGood.price = Trade.applyMarketPressure(good.value, marketGood.price, actualBuy);
            }

            recipeLog.push({ goodId: ingId, amount, marketCost });
          }

          inventory[good.i] = (inventory[good.i] || 0) + produced;

          history.push({
            kind: "mfg",
            goodId: good.i,
            units: produced,
            cultureModifier,
            recipe: recipeLog,
            candidates: decision.candidates
          });
        }

        workersUsed += fraction;
      }

      demandInventoryByBurg.set(burg.i!, {});

      burg.produced = {};
      for (const entry of history) {
        if (entry.kind !== "mfg") continue;
        burg.produced[entry.goodId] = Math.round(((burg.produced[entry.goodId] || 0) + entry.units) * 100) / 100;
      }
      let phaseRevenue = 0;

      for (const goodIdStr in inventory) {
        const goodId = +goodIdStr;
        const amount = inventory[goodId];
        if (amount <= 0) continue;
        const good = goodById.get(goodId)!;

        const sellResult = Trade.sellToMarket({
          burg,
          good,
          units: amount,
          marketPrice: this.getMarketGoodData(market, goodId, good.value).price * (1 - MARKET_MARGIN)
        });
        phaseRevenue += sellResult.revenue;
        if (sellResult.dealId !== null) history.push({ kind: "deal", dealId: sellResult.dealId });
        const marketGood = this.getMarketGoodData(market, goodId, good.value);
        marketGood.price = Math.max(
          good.value * PRICE_FLOOR_FACTOR,
          marketGood.price - amount * good.value * MARKET_PRESSURE_FACTOR
        );
      }
      burg.treasury = Math.round(((burg.treasury || 0) + phaseRevenue) * 100) / 100;
      burg.product = Math.round(Math.max(0, phaseRevenue - ingredientCosts) * 100) / 100;

      this.productionData.set(burg.i!, history);
    }

    Trade.redistributeAcrossMarkets(this.productionData, demandInventoryByBurg);

    for (const burg of validBurgs) {
      const data = this.productionData.get(burg.i!);
      const marketCenter = Trade.getMarketForBurg(burg);
      if (!data || !marketCenter) continue;

      const demandInventory = demandInventoryByBurg.get(burg.i!) ?? {};
      this.fillBurgDemandFromCenter({
        burg,
        demandInventory,
        goodById,
        demandTargets: this.buildDemandTargets(burg),
        marketCenter,
        history: data
      });
      burg.inventory = {};
      for (const goodIdStr in demandInventory) {
        const goodId = +goodIdStr;
        const amount = demandInventory[goodId];
        if (amount > 0.001) burg.inventory[goodId] = Math.round(amount * 100) / 100;
      }
    }

    Trade.updateMarketDemand(this.productionData, demandInventoryByBurg);

    TIME && console.timeEnd("generateProduction");
  }

  private buildRecipesByOutput(recipes: Recipes[]): Map<number, Recipes[]> {
    const recipesByOutput = new Map<number, Recipes[]>();
    for (const recipe of recipes) {
      const outputId = recipe.good.i;
      const list = recipesByOutput.get(outputId);
      if (list) list.push(recipe);
      else recipesByOutput.set(outputId, [recipe]);
    }
    return recipesByOutput;
  }

  private buildMinWorkersByGood(goods: Good[], recipesByOutput: Map<number, Recipes[]>): number[] {
    const minWorkersByGood: number[] = [];
    for (const good of goods) minWorkersByGood[good.i] = 1;

    for (let iteration = 0; iteration < goods.length; iteration++) {
      let changed = false;

      for (const good of goods) {
        const recipeList = recipesByOutput.get(good.i);
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

  private buildDemandTargets(burg: Burg): number[] {
    const population = burg.population || 0;
    return DEMAND_PRIORITY.map(category => population * DEMAND_TARGET_FACTORS[category]);
  }

  private calculateDemandCoverage(inventory: Record<number, number>, goodById: Map<number, Good>): number[] {
    const demandCoverage = Array(DEMAND_PRIORITY.length).fill(0);

    for (const goodIdStr in inventory) {
      const goodId = +goodIdStr;
      const amount = inventory[goodId] || 0;
      if (amount <= 0) continue;

      const good = goodById.get(goodId);
      if (!good) continue;
      for (let category = 0; category < DEMAND_PRIORITY.length; category++) {
        const demandCategory = DEMAND_PRIORITY[category] as DemandCategory;
        const coveredAmount = good.demandCoverage[demandCategory] || 0;
        if (!coveredAmount) continue;
        demandCoverage[category] += amount * coveredAmount;
      }
    }

    return demandCoverage;
  }

  private fillBurgDemandFromCenter(params: {
    burg: Burg;
    demandInventory: Record<number, number>;
    goodById: Map<number, Good>;
    demandTargets: number[];
    marketCenter: Market;
    history: ProductionHistoryEntry[];
  }): void {
    const { burg, demandInventory, goodById, demandTargets, marketCenter, history } = params;
    const demandCoverage = this.calculateDemandCoverage(demandInventory, goodById);

    for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
      const demandCategory = DEMAND_PRIORITY[categoryIndex] as DemandCategory;
      let shortage = Math.max(0, demandTargets[categoryIndex] - demandCoverage[categoryIndex]);
      if (shortage <= 0.001) continue;

      const candidates = Object.keys(marketCenter.goods)
        .map(Number)
        .flatMap(goodId => {
          const available = marketCenter.goods[goodId]?.stock || 0;
          const good = goodById.get(goodId);
          const coverageWeight = good?.demandCoverage[demandCategory] || 0;
          if (!good || available <= 0.001 || coverageWeight <= 0) return [];
          return [{ good, goodId, available, coverageWeight }];
        })
        .sort((a, b) => b.coverageWeight - a.coverageWeight || a.good.value - b.good.value || a.goodId - b.goodId);

      for (const candidate of candidates) {
        if (shortage <= 0.001) break;

        const wealth = burg.treasury || 0;
        if (wealth <= 0.001) break;

        const buyPrice =
          this.getMarketGoodData(marketCenter, candidate.goodId, candidate.good.value).price * (1 + MARKET_MARGIN);
        const unitsNeeded = shortage / candidate.coverageWeight;
        const unitsAffordable = buyPrice > 0 ? wealth / buyPrice : candidate.available;
        const purchase = Trade.buyFromMarket({
          burg,
          good: candidate.good,
          units: Math.min(candidate.available, unitsNeeded, unitsAffordable),
          marketPrice: buyPrice
        });
        if (purchase.units <= 0.001) continue;

        if (purchase.dealId !== null) history.push({ kind: "deal", dealId: purchase.dealId });
        demandInventory[candidate.goodId] = (demandInventory[candidate.goodId] || 0) + purchase.units;
        burg.treasury = Math.round(((burg.treasury || 0) - purchase.totalCost) * 100) / 100;

        for (let coverageCategoryIndex = 0; coverageCategoryIndex < DEMAND_PRIORITY.length; coverageCategoryIndex++) {
          const coverageCategory = DEMAND_PRIORITY[coverageCategoryIndex] as DemandCategory;
          const retainedCoverage = candidate.good.demandCoverage[coverageCategory] || 0;
          if (!retainedCoverage) continue;
          demandCoverage[coverageCategoryIndex] += purchase.units * retainedCoverage;
        }

        shortage = Math.max(0, demandTargets[categoryIndex] - demandCoverage[categoryIndex]);
        const marketGood = this.getMarketGoodData(marketCenter, candidate.goodId, candidate.good.value);
        marketGood.price = Math.min(
          candidate.good.value * PRICE_CEILING_FACTOR,
          marketGood.price + purchase.units * candidate.good.value * MARKET_PRESSURE_FACTOR
        );
      }
    }
  }

  private getMarketGoodData(market: Market, goodId: number, fallbackPrice: number) {
    const existing = market.goods[goodId];
    if (existing) return existing;

    const created = {
      stock: 0,
      price: fallbackPrice
    };
    market.goods[goodId] = created;
    return created;
  }

  private getMarketView(market: Market): {
    inventory: Record<number, number>;
    buyPrice: number[];
    sellPrice: number[];
  } {
    const inventory: Record<number, number> = {};
    const buyPrice: number[] = [];
    const sellPrice: number[] = [];

    for (const goodIdStr in market.goods) {
      const goodId = +goodIdStr;
      const goodData = market.goods[goodId];
      inventory[goodId] = goodData.stock;
      buyPrice[goodId] = goodData.price * (1 + MARKET_MARGIN);
      sellPrice[goodId] = goodData.price * (1 - MARKET_MARGIN);
    }

    return { inventory, buyPrice, sellPrice };
  }

  private getDemandFocus(demandTargets: number[], demandCoverage: number[]): DemandFocus | null {
    const remainingDemand = demandTargets.map((target, category) => Math.max(0, target - demandCoverage[category]));
    const priorityCategory = remainingDemand.findIndex(shortage => shortage > 0.001);
    if (priorityCategory === -1) return null;

    return {
      category: DEMAND_PRIORITY[priorityCategory] as DemandCategory,
      shortage: remainingDemand[priorityCategory]
    };
  }

  private getDemandEffect(good: Good, demandFocus: DemandFocus | null): DemandEffect {
    if (!demandFocus) return { multiplier: 1, category: null, shortage: 0 };

    const coverageWeight = good.demandCoverage[demandFocus.category] || 0;
    if (!coverageWeight) return { multiplier: 1, category: null, shortage: 0 };

    const multiplier = 1 + coverageWeight * demandFocus.shortage;
    return {
      multiplier,
      category: demandFocus.category,
      shortage: demandFocus.shortage
    };
  }

  private buildImmediateManufactureCandidate(params: {
    recipe: Recipes;
    inventory: Record<number, number>;
    marketInventory: Record<number, number>;
    buyPrice: number[];
    sellPrice: number[];
    cultureType: string;
    demandEffect: DemandEffect;
    units: number;
    goalGoodId?: number;
    preparation?: boolean;
  }): { action: PlannedAction; candidate: DecisionCandidate } | null {
    const {
      recipe,
      inventory,
      marketInventory,
      buyPrice,
      sellPrice,
      cultureType,
      demandEffect,
      units,
      goalGoodId,
      preparation
    } = params;

    let maxYield = Infinity;
    let marketCostTotal = 0;

    for (const ingredient of recipe.ingredients) {
      const inventoryAvailable = inventory[ingredient.goodId] || 0;
      const marketAvailable = marketInventory[ingredient.goodId] || 0;
      const totalAvailable = inventoryAvailable + marketAvailable;
      if (totalAvailable < ingredient.amount * units - 0.001) return null;
      maxYield = Math.min(maxYield, totalAvailable / ingredient.amount);
    }

    if (!Number.isFinite(maxYield) || maxYield <= 0) return null;

    const actualUnits = Math.min(units, maxYield);
    for (const ingredient of recipe.ingredients) {
      const inventoryAvailable = inventory[ingredient.goodId] || 0;
      const amountNeeded = actualUnits * ingredient.amount;
      const fromMarket = Math.max(0, amountNeeded - Math.min(inventoryAvailable, amountNeeded));
      marketCostTotal += fromMarket * buyPrice[ingredient.goodId];
    }

    const cultureModifier = this.getCultureModifier(recipe.good, cultureType);
    const sellValue = (sellPrice[recipe.good.i] ?? recipe.good.value) * cultureModifier;
    const ingredientCost = marketCostTotal / actualUnits;
    const projectedGain = (sellValue - ingredientCost) * demandEffect.multiplier;
    const score = projectedGain;

    return {
      action: {
        kind: "manufacture",
        good: recipe.good,
        ingredients: recipe.ingredients,
        maxYield,
        score
      },
      candidate: {
        goodId: recipe.good.i,
        units: actualUnits,
        sellPrice: sellValue,
        ingredientCost,
        cultureModifier,
        demandEffect,
        score,
        ingredients: recipe.ingredients,
        goalGoodId,
        preparation
      }
    };
  }

  private planGoodAction(params: {
    good: Good;
    targetUnits: number;
    stepUnits: number;
    recipesByOutput: Map<number, Recipes[]>;
    minWorkersByGood: number[];
    goodById: Map<number, Good>;
    inventory: Record<number, number>;
    marketInventory: Record<number, number>;
    buyPrice: number[];
    sellPrice: number[];
    workersLeft: number;
    demandEffect: DemandEffect;
    cultureType: string;
    path?: Set<number>;
  }): GoalActionPlan | null {
    const {
      good,
      targetUnits,
      stepUnits,
      recipesByOutput,
      minWorkersByGood,
      goodById,
      inventory,
      marketInventory,
      buyPrice,
      sellPrice,
      workersLeft,
      demandEffect,
      cultureType,
      path = new Set<number>()
    } = params;

    if (workersLeft <= 0 || targetUnits <= 0) return null;
    if (path.has(good.i)) return null;

    const nextPath = new Set(path);
    nextPath.add(good.i);

    const cultureModifier = this.getCultureModifier(good, cultureType);
    const sellValuePerUnit = (sellPrice[good.i] ?? good.value) * cultureModifier;
    const totalProjectedGain = sellValuePerUnit * targetUnits * demandEffect.multiplier;

    const recipeList = recipesByOutput.get(good.i);
    if (!recipeList?.length) return null;

    let bestPlan: GoalActionPlan | null = null;

    for (const recipe of recipeList) {
      const immediate = this.buildImmediateManufactureCandidate({
        recipe,
        inventory,
        marketInventory,
        buyPrice,
        sellPrice,
        cultureType,
        demandEffect,
        units: Math.min(stepUnits, targetUnits),
        goalGoodId: good.i
      });
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
          candidate: immediate.candidate,
          immediate: true
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

        const fromInventory = Math.min(remaining, inventory[ingredient.goodId] || 0);
        remaining -= fromInventory;

        const marketAvailable = marketInventory[ingredient.goodId] || 0;
        const fromMarket = Math.min(remaining, marketAvailable);
        remaining -= fromMarket;
        marketCost += fromMarket * buyPrice[ingredient.goodId];

        if (remaining <= 0.001) continue;

        const ingredientGood = goodById.get(ingredient.goodId);
        if (!ingredientGood) {
          feasible = false;
          break;
        }

        const lowerBoundWorkers = remaining * (minWorkersByGood[ingredient.goodId] ?? Infinity);
        workersNeeded += lowerBoundWorkers;
        if (workersNeeded > workersLeft + 0.001) {
          feasible = false;
          break;
        }

        const subPlan = this.planGoodAction({
          good: ingredientGood,
          targetUnits: remaining,
          stepUnits,
          recipesByOutput,
          minWorkersByGood,
          goodById,
          inventory,
          marketInventory,
          buyPrice,
          sellPrice,
          workersLeft: workersLeft - targetUnits,
          demandEffect,
          cultureType,
          path: nextPath
        });

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
      const candidate: DecisionCandidate = {
        ...nextActionPlan.candidate,
        score: normalizedGain * Math.min(stepUnits, targetUnits),
        goalGoodId: good.i,
        preparation: nextActionPlan.goalGoodId !== good.i,
        gain: normalizedGain,
        workers: workersNeeded
      };

      const plan: GoalActionPlan = {
        goalGoodId: good.i,
        workersNeeded,
        marketCost,
        projectedGain,
        normalizedGain,
        action: {
          ...action,
          score: normalizedGain * Math.min(stepUnits, targetUnits)
        },
        candidate,
        immediate: false
      };
      if (!bestPlan || plan.normalizedGain > bestPlan.normalizedGain + 0.001) bestPlan = plan;
    }

    return bestPlan;
  }

  private makeProductionDecision(params: {
    burg: Burg;
    recipes: Recipes[];
    recipesByOutput: Map<number, Recipes[]>;
    minWorkersByGood: number[];
    goodById: Map<number, Good>;
    demandTargets: number[];
    cultureType: string;
    inventory: Record<number, number>;
    marketInventory: Record<number, number>;
    buyPrice: number[];
    sellPrice: number[];
    activeGoalGoodId: number | null;
    workersLeft: number;
    fraction: number;
  }): {
    action: PlannedAction;
    candidates: DecisionCandidate[];
    goalGoodId: number | null;
  } | null {
    const candidates: DecisionCandidate[] = [];
    const demandCoverage = this.calculateDemandCoverage(params.inventory, params.goodById);
    const demandFocus = this.getDemandFocus(params.demandTargets, demandCoverage);

    let chosenGoal: GoalActionPlan | null = null;
    for (const good of params.goodById.values()) {
      const demandEffect = this.getDemandEffect(good, demandFocus);
      const goalPlan = this.planGoodAction({
        good,
        targetUnits: params.fraction,
        stepUnits: params.fraction,
        recipesByOutput: params.recipesByOutput,
        minWorkersByGood: params.minWorkersByGood,
        goodById: params.goodById,
        inventory: params.inventory,
        marketInventory: params.marketInventory,
        buyPrice: params.buyPrice,
        sellPrice: params.sellPrice,
        workersLeft: params.workersLeft,
        demandEffect,
        cultureType: params.cultureType
      });
      if (!goalPlan || goalPlan.projectedGain <= 0) continue;
      candidates.push(goalPlan.candidate);
      if (!chosenGoal || goalPlan.normalizedGain > chosenGoal.normalizedGain + 0.001) chosenGoal = goalPlan;
    }

    if (params.activeGoalGoodId !== null && chosenGoal) {
      const activeGood = params.goodById.get(params.activeGoalGoodId);
      if (activeGood) {
        const activeDemand = this.getDemandEffect(activeGood, demandFocus);
        const activeGoal = this.planGoodAction({
          good: activeGood,
          targetUnits: params.fraction,
          stepUnits: params.fraction,
          recipesByOutput: params.recipesByOutput,
          minWorkersByGood: params.minWorkersByGood,
          goodById: params.goodById,
          inventory: params.inventory,
          marketInventory: params.marketInventory,
          buyPrice: params.buyPrice,
          sellPrice: params.sellPrice,
          workersLeft: params.workersLeft,
          demandEffect: activeDemand,
          cultureType: params.cultureType
        });
        if (activeGoal && activeGoal.normalizedGain >= (chosenGoal.normalizedGain || 0) * this.GOAL_STICKINESS_FACTOR) {
          chosenGoal = activeGoal;
        }
      }
    }

    if (!chosenGoal) return null;
    return {
      action: chosenGoal.action,
      candidates,
      goalGoodId: chosenGoal.goalGoodId
    };
  }

  private getCultureModifier(good: Good, cultureType: string) {
    return good.culture[cultureType as CultureType] || 1;
  }

  private buildRecipesArray(goods: Good[]): Recipes[] {
    const recipes: Recipes[] = [];
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

  getProductionData(burgId: number): ProductionHistoryEntry[] | undefined {
    return this.productionData.get(burgId);
  }
}

type PlannedAction = {
  kind: "manufacture";
  good: Good;
  ingredients: Ingredient[];
  maxYield: number;
  score: number;
};

export type Ingredient = { goodId: number; amount: number };

type Recipes = { good: Good; ingredients: Ingredient[] };

export type DemandEffect = {
  multiplier: number;
  category: DemandCategory | null;
  shortage: number;
};

type DemandFocus = { category: DemandCategory; shortage: number };

export type DecisionCandidate = {
  goodId: number;
  units: number;
  sellPrice: number;
  ingredientCost: number;
  cultureModifier: number;
  demandEffect: DemandEffect;
  score: number;
  ingredients: Ingredient[];
  goalGoodId?: number;
  preparation?: boolean;
  gain?: number; // set for prep candidates: goal projected gain per worker (demand-weighted)
  workers?: number; // total workers in the chain (prep + goal)
};

type GoalActionPlan = {
  goalGoodId: number;
  workersNeeded: number;
  marketCost: number;
  projectedGain: number;
  normalizedGain: number;
  action: PlannedAction;
  candidate: DecisionCandidate;
  immediate: boolean;
};

export type MfgHistoryEntry = {
  kind: "mfg";
  goodId: number;
  units: number;
  cultureModifier: number;
  recipe: { goodId: number; amount: number; marketCost: number }[];
  candidates?: DecisionCandidate[];
};

export type DealHistoryEntry = { kind: "deal"; dealId: number };

export type ProductionHistoryEntry = MfgHistoryEntry | DealHistoryEntry;

declare global {
  var Production: ProductionModule;
}

window.Production = new ProductionModule();
