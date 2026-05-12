import type {Burg} from "./burgs-generator";
import type {CultureType} from "./cultures-generator";
import {DEFAULT_CULTURE_TYPE} from "./cultures-generator";
import type {DemandCategory, Good} from "./goods-generator";
import {DEMAND_PRIORITY, DEMAND_TARGET_FACTORS} from "./goods-generator";
import type {Market} from "./trade-generator";

export class ProductionModule {
  private readonly BUY_PRESSURE_FACTOR = 0.002;
  private readonly SELL_PRESSURE_FACTOR = 0.001;
  private readonly PRICE_FLOOR_FACTOR = 0.5;
  private readonly PRICE_CEILING_FACTOR = 3.0;
  private readonly GOAL_STICKINESS_FACTOR = 0.85;

  private productionData = new Map<number, ProductionHistoryEntry[]>();

  produce() {
    TIME && console.time("generateProduction");
    const {burgs, goods} = pack;

    const validBurgs = burgs.filter(b => b.i && !b.removed);
    validBurgs.sort((a, b) => (a.population || 0) - (b.population || 0));

    const goodById = new Map<number, Good>(goods.map(g => [g.i, g]));
    const {buyPressure, sellPressure, priceFloor, priceCeiling} = this.buildPriceArrays(goods);
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

      const inventory: Record<number, number> = {...(burg.inventory || {})};
      const history: ProductionHistoryEntry[] = [];
      let workersUsed = 0;
      let activeGoalGoodId: number | null = null;

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
          const {good, ingredients, maxYield} = decision.action;
          const actualYield = Math.min(fraction, maxYield);
          const cultureModifier = this.getCultureModifier(good, cultureType);
          const produced = actualYield * cultureModifier;
          const recipeLog: {
            goodId: number;
            fromInventory: number;
            fromMarket: number;
            marketCost: number;
          }[] = [];

          for (const ingredient of ingredients) {
            const ingId = ingredient.goodId;
            const amountNeeded = actualYield * ingredient.amount;
            const fromInventory = Math.min(inventory[ingId] || 0, amountNeeded);
            const fromMarket = Math.max(0, amountNeeded - fromInventory);

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
                marketPrice: marketGood.buyPrice
              });
              marketCost = purchase.totalCost;
              if (purchase.dealId !== null) history.push({kind: "deal", dealId: purchase.dealId});
              burg.wealth = (burg.wealth || 0) - marketCost;
              marketGood.buyPrice = Math.min(priceCeiling[ingId], marketGood.buyPrice + actualBuy * buyPressure[ingId]);
            }

            recipeLog.push({
              goodId: ingId,
              fromInventory,
              fromMarket,
              marketCost
            });
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

      const {retainedInventory, excessInventory} = this.splitInventoryByDemand(inventory, demandTargets, goodById);
      demandInventoryByBurg.set(burg.i!, retainedInventory);

      burg.produced = {};
      for (const entry of history) {
        if (entry.kind !== "mfg") continue;
        burg.produced[entry.goodId] = Math.round(((burg.produced[entry.goodId] || 0) + entry.units) * 100) / 100;
      }
      let phaseRevenue = 0;

      for (const goodIdStr in excessInventory) {
        const goodId = +goodIdStr;
        const amount = excessInventory[goodId];
        if (amount <= 0) continue;
        const good = goodById.get(goodId)!;

        const sellResult = Trade.sellToMarket({
          burg,
          good,
          units: amount,
          marketPrice: this.getMarketGoodData(market, goodId, good.value).sellPrice
        });
        phaseRevenue += sellResult.revenue;
        if (sellResult.dealId !== null) history.push({kind: "deal", dealId: sellResult.dealId});
        const marketGood = this.getMarketGoodData(market, goodId, good.value);
        marketGood.sellPrice = Math.max(priceFloor[goodId], marketGood.sellPrice - amount * sellPressure[goodId]);
      }
      burg.wealth = (burg.wealth || 0) + phaseRevenue;

      this.productionData.set(burg.i!, history);
    }

    Trade.redistributeAcrossMarkets(goods, this.productionData, demandInventoryByBurg);

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
        buyPressure,
        priceCeiling,
        history: data
      });
      burg.inventory = demandInventory;
    }

    Trade.updateMarketDemand(goods, this.productionData, demandInventoryByBurg);

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

  private splitInventoryByDemand(
    inventory: Record<number, number>,
    demandTargets: number[],
    goodById: Map<number, Good>
  ): {
    retainedInventory: Record<number, number>;
    excessInventory: Record<number, number>;
  } {
    const retainedInventory: Record<number, number> = {};
    const excessInventory: Record<number, number> = {...inventory};
    const retainedDemandCoverage = Array(DEMAND_PRIORITY.length).fill(0);

    for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
      const demandCategory = DEMAND_PRIORITY[categoryIndex] as DemandCategory;
      const candidates = Object.keys(excessInventory)
        .map(Number)
        .filter(goodId => {
          const amount = excessInventory[goodId] || 0;
          const good = goodById.get(goodId);
          return amount > 0 && Boolean(good?.demandCoverage[demandCategory]);
        })
        .sort((a, b) => {
          const goodA = goodById.get(a)!;
          const goodB = goodById.get(b)!;
          const coverageA = goodA.demandCoverage[demandCategory] || 0;
          const coverageB = goodB.demandCoverage[demandCategory] || 0;
          return coverageB - coverageA || a - b;
        });

      for (const goodId of candidates) {
        const shortage = Math.max(0, demandTargets[categoryIndex] - retainedDemandCoverage[categoryIndex]);
        if (shortage <= 0.001) break;

        const available = excessInventory[goodId] || 0;
        if (available <= 0) continue;
        const good = goodById.get(goodId)!;
        const coverageWeight = good.demandCoverage[demandCategory] || 0;
        if (!coverageWeight) continue;

        const keepAmount = Math.min(available, shortage / coverageWeight);
        if (keepAmount <= 0.001) continue;

        retainedInventory[goodId] = (retainedInventory[goodId] || 0) + keepAmount;
        excessInventory[goodId] = Math.max(0, available - keepAmount);

        for (let coverageCategoryIndex = 0; coverageCategoryIndex < DEMAND_PRIORITY.length; coverageCategoryIndex++) {
          const coverageCategory = DEMAND_PRIORITY[coverageCategoryIndex] as DemandCategory;
          const retainedCoverage = good.demandCoverage[coverageCategory] || 0;
          if (!retainedCoverage) continue;
          retainedDemandCoverage[coverageCategoryIndex] += keepAmount * retainedCoverage;
        }
      }
    }

    return {retainedInventory, excessInventory};
  }

  private fillBurgDemandFromCenter(params: {
    burg: Burg;
    demandInventory: Record<number, number>;
    goodById: Map<number, Good>;
    demandTargets: number[];
    marketCenter: Market;
    buyPressure: number[];
    priceCeiling: number[];
    history: ProductionHistoryEntry[];
  }): void {
    const {burg, demandInventory, goodById, demandTargets, marketCenter, buyPressure, priceCeiling, history} = params;
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
          return [{good, goodId, available, coverageWeight}];
        })
        .sort((a, b) => b.coverageWeight - a.coverageWeight || a.good.value - b.good.value || a.goodId - b.goodId);

      for (const candidate of candidates) {
        if (shortage <= 0.001) break;

        const wealth = burg.wealth || 0;
        if (wealth <= 0.001) break;

        const buyPrice = this.getMarketGoodData(marketCenter, candidate.goodId, candidate.good.value).buyPrice;
        const unitsNeeded = shortage / candidate.coverageWeight;
        const unitsAffordable = buyPrice > 0 ? wealth / buyPrice : candidate.available;
        const purchase = Trade.buyFromMarket({
          burg,
          good: candidate.good,
          units: Math.min(candidate.available, unitsNeeded, unitsAffordable),
          marketPrice: buyPrice
        });
        if (purchase.units <= 0.001) continue;

        if (purchase.dealId !== null) history.push({kind: "deal", dealId: purchase.dealId});
        demandInventory[candidate.goodId] = (demandInventory[candidate.goodId] || 0) + purchase.units;
        burg.wealth = (burg.wealth || 0) - purchase.totalCost;

        for (let coverageCategoryIndex = 0; coverageCategoryIndex < DEMAND_PRIORITY.length; coverageCategoryIndex++) {
          const coverageCategory = DEMAND_PRIORITY[coverageCategoryIndex] as DemandCategory;
          const retainedCoverage = candidate.good.demandCoverage[coverageCategory] || 0;
          if (!retainedCoverage) continue;
          demandCoverage[coverageCategoryIndex] += purchase.units * retainedCoverage;
        }

        shortage = Math.max(0, demandTargets[categoryIndex] - demandCoverage[categoryIndex]);
        const marketGood = this.getMarketGoodData(marketCenter, candidate.goodId, candidate.good.value);
        marketGood.buyPrice = Math.min(
          priceCeiling[candidate.goodId],
          marketGood.buyPrice + purchase.units * buyPressure[candidate.goodId]
        );
      }
    }
  }

  private getMarketGoodData(market: Market, goodId: number, fallbackPrice: number) {
    const existing = market.goods[goodId];
    if (existing) return existing;

    const created = {
      stock: 0,
      buyPrice: fallbackPrice,
      sellPrice: fallbackPrice
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
      buyPrice[goodId] = goodData.buyPrice;
      sellPrice[goodId] = goodData.sellPrice;
    }

    return {inventory, buyPrice, sellPrice};
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
    if (!demandFocus) return {multiplier: 1, category: null, shortage: 0};

    const coverageWeight = good.demandCoverage[demandFocus.category] || 0;
    if (!coverageWeight) return {multiplier: 1, category: null, shortage: 0};

    const multiplier = 1 + coverageWeight * demandFocus.shortage;
    return {multiplier, category: demandFocus.category, shortage: demandFocus.shortage};
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
    projectedGainOverride?: number;
    goalGoodId?: number;
    preparation?: boolean;
  }): {action: PlannedAction; candidate: DecisionCandidate} | null {
    const {
      recipe,
      inventory,
      marketInventory,
      buyPrice,
      sellPrice,
      cultureType,
      demandEffect,
      units,
      projectedGainOverride,
      goalGoodId,
      preparation
    } = params;

    let maxYield = Infinity;
    const ingredients: DecisionIngredient[] = [];
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
      const marketAvailable = marketInventory[ingredient.goodId] || 0;
      const totalAvailable = inventoryAvailable + marketAvailable;
      const amountNeeded = actualUnits * ingredient.amount;
      const fromInventory = Math.min(inventoryAvailable, amountNeeded);
      const fromMarket = Math.max(0, amountNeeded - fromInventory);
      const marketCost = fromMarket * buyPrice[ingredient.goodId];
      marketCostTotal += marketCost;

      ingredients.push({
        goodId: ingredient.goodId,
        amount: amountNeeded,
        buyPrice: buyPrice[ingredient.goodId],
        available: totalAvailable,
        availableInventory: inventoryAvailable,
        availableMarket: marketAvailable,
        fromInventory,
        fromMarket,
        marketCost
      });
    }

    const cultureModifier = this.getCultureModifier(recipe.good, cultureType);
    const sellValue = (sellPrice[recipe.good.i] ?? recipe.good.value) * cultureModifier;
    const ingredientCost = marketCostTotal / actualUnits;
    const projectedGain = projectedGainOverride ?? (sellValue - ingredientCost) * demandEffect.multiplier;
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
        kind: "manufacture",
        goodId: recipe.good.i,
        score,
        projectedGain,
        demandEffect,
        cultureModifier,
        revenue: sellValue,
        ingredientCost,
        units: actualUnits,
        ingredients,
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
        projectedGainOverride: totalProjectedGain,
        goalGoodId: good.i
      });
      if (immediate && targetUnits <= workersLeft + 0.001) {
        const normalizedGain = targetUnits > 0 ? totalProjectedGain / targetUnits : totalProjectedGain;
        const immediateMarketCost =
          immediate.candidate.kind === "manufacture"
            ? immediate.candidate.ingredientCost * immediate.candidate.units
            : 0;
        const plan: GoalActionPlan = {
          goalGoodId: good.i,
          workersNeeded: targetUnits,
          marketCost: immediateMarketCost,
          projectedGain: totalProjectedGain,
          normalizedGain,
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
        projectedGain,
        score: normalizedGain * Math.min(stepUnits, targetUnits),
        goalGoodId: good.i,
        preparation: nextActionPlan.goalGoodId !== good.i
      };

      const plan: GoalActionPlan = {
        goalGoodId: good.i,
        workersNeeded,
        marketCost,
        projectedGain,
        normalizedGain,
        action: {...action, score: normalizedGain * Math.min(stepUnits, targetUnits)},
        candidate,
        immediate: false
      };
      if (!bestPlan || plan.normalizedGain > bestPlan.normalizedGain + 0.001) bestPlan = plan;
    }

    return bestPlan;
  }

  private buildPriceArrays(goods: Good[]) {
    const n = goods.length;
    const buyPressure = new Array<number>(n);
    const sellPressure = new Array<number>(n);
    const priceFloor = new Array<number>(n);
    const priceCeiling = new Array<number>(n);

    for (const good of goods) {
      const i = good.i;
      buyPressure[i] = good.value * this.BUY_PRESSURE_FACTOR;
      sellPressure[i] = good.value * this.SELL_PRESSURE_FACTOR;
      priceFloor[i] = good.value * this.PRICE_FLOOR_FACTOR;
      priceCeiling[i] = good.value * this.PRICE_CEILING_FACTOR;
    }

    return {
      buyPressure,
      sellPressure,
      priceFloor,
      priceCeiling
    };
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
  }): {action: PlannedAction; candidates: DecisionCandidate[]; goalGoodId: number | null} | null {
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
    return {action: chosenGoal.action, candidates, goalGoodId: chosenGoal.goalGoodId};
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
        recipes.push({good, ingredients: entries});
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

type Ingredient = {goodId: number; amount: number};
type Recipes = {good: Good; ingredients: Ingredient[]};
export type DecisionIngredient = {
  goodId: number;
  amount: number;
  buyPrice: number;
  available: number;
  availableInventory: number;
  availableMarket: number;
  fromInventory: number;
  fromMarket: number;
  marketCost: number;
};
export type DemandEffect = {
  multiplier: number;
  category: DemandCategory | null;
  shortage: number;
};
type DemandFocus = {category: DemandCategory; shortage: number};

export type DecisionCandidate = {
  kind: "manufacture";
  goodId: number;
  score: number;
  projectedGain: number;
  demandEffect: DemandEffect;
  cultureModifier: number;
  revenue: number;
  ingredientCost: number;
  units: number;
  ingredients: DecisionIngredient[];
  goalGoodId?: number;
  preparation?: boolean;
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
  recipe: Array<{goodId: number; fromInventory: number; fromMarket: number; marketCost: number}>;
  candidates?: DecisionCandidate[];
};

export type DealHistoryEntry = {kind: "deal"; dealId: number};

export type ProductionHistoryEntry = MfgHistoryEntry | DealHistoryEntry;

declare global {
  var Production: ProductionModule;
}

window.Production = new ProductionModule();
