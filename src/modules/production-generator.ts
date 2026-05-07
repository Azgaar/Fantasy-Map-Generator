import type {Burg} from "./burgs-generator";
import type {CultureType} from "./cultures-generator";
import {DEFAULT_CULTURE_TYPE} from "./cultures-generator";
import type {DemandCategory, Good} from "./goods-generator";
import {DEMAND_PRIORITY, DEMAND_TARGET_FACTORS} from "./goods-generator";

export class ProductionModule {
  private readonly BONUS_PRODUCTION = 5;
  private readonly COLLECTION_DIVISOR = 3;

  private readonly PROVINCE_PENALTY = 3;
  private readonly STATE_PENALTY = 15;

  private readonly BUY_PRESSURE_FACTOR = 0.002;
  private readonly SELL_PRESSURE_FACTOR = 0.001;
  private readonly PRICE_FLOOR_FACTOR = 0.5;
  private readonly PRICE_CEILING_FACTOR = 3.0;
  private readonly DEMAND_SHORTAGE_MULTIPLIER = 2.0;

  private readonly CHAIN_VALUE_MAX_WORKERS = 5;

  private productionData = new Map<number, BurgProductionData>();

  produce() {
    TIME && console.time("generateProduction");
    const {burgs} = pack;
    const goods = pack.goods;
    const validBurgs = burgs.filter(b => (b as Burg).i && !(b as Burg).removed);
    Trade.initialize(goods, validBurgs as Burg[]);

    const goodById = new Map<number, Good>(goods.map(g => [g.i, g]));
    const cellPool = this.buildCellPool(goods);
    const chainValueByWorkers = this.buildChainValues(goods, this.CHAIN_VALUE_MAX_WORKERS);
    const {buyPressure, sellPressure, priceFloor, priceCeiling} = this.buildPriceArrays(goods);

    const recipeOptions = this.buildRecipeOptions(goods);

    validBurgs.sort((a, b) => (a.population || 0) - (b.population || 0));

    this.productionData.clear();
    let burgRank = 0;

    for (const burg of validBurgs) {
      burgRank++;
      const marketCenter = Trade.getCenterForBurg(burg as Burg);
      if (!marketCenter) continue;
      const cultureType = burg.type || DEFAULT_CULTURE_TYPE;
      const population = burg.population || 0;
      const demandTargets = this.buildDemandTargets(burg);

      const goodsPull: Record<number, number> = {};
      const addGood = (goodId: number, amount: number) => {
        const current = goodsPull[goodId] || 0;
        if (!current) goodsPull[goodId] = amount;
        else if (amount > current) goodsPull[goodId] = amount + current / this.COLLECTION_DIVISOR;
        else goodsPull[goodId] = current + amount / this.COLLECTION_DIVISOR;
      };

      const budget = Math.max(1, Math.floor(population));
      const cellsReached = this.floodFillCells(burg, budget, cellPool, addGood);

      const goodsPullData: BurgProductionData["goodsPull"] = [];
      for (const goodIdStr in goodsPull) {
        const goodId = +goodIdStr;
        const good = goodById.get(goodId);
        if (!good) continue;
        const rawPull = goodsPull[goodId];
        const chainValue = this.getChainValueForWorkers(
          chainValueByWorkers,
          Math.max(0, population - 1),
          goodId,
          good.value
        );
        goodsPullData.push({
          goodId,
          pull: rawPull,
          chainValue
        });
      }
      goodsPullData.sort((a, b) => b.pull - a.pull || b.chainValue - a.chainValue || a.goodId - b.goodId);

      const remainingPool: Record<number, number> = {...goodsPull};
      const inventory: Record<number, number> = {};
      const jobsData: BurgProductionData["jobs"] = [];
      let workersUsed = 0;

      for (let i = 0; i < Math.ceil(population); i++) {
        const workersLeft = population - workersUsed;
        const fraction = Math.min(1, workersLeft);
        if (fraction <= 0) break;

        const decision = this.greedyBestAction({
          burg,
          recipeOptions,
          goodById,
          chainValueByWorkers,
          demandTargets,
          cultureType,
          inventory,
          remainingPool,
          marketInventory: marketCenter.inventory,
          currentBuyPrice: marketCenter.buyPrice,
          currentSellPrice: marketCenter.sellPrice,
          workersLeft,
          fraction
        });
        const action = decision?.action;
        if (!action) break;

        if (action.kind === "manufacture") {
          const {good, entries, maxYield, score} = action;
          const actualYield = Math.min(fraction, maxYield);
          const cultureModifier = this.getCultureModifier(good, cultureType);
          const produced = actualYield * cultureModifier;
          const recipeLog: Array<{
            goodId: number;
            fromInventory: number;
            fromMarket: number;
            marketCost: number;
          }> = [];

          for (const entry of entries) {
            const ingId = entry.goodId;
            const amountNeeded = actualYield * entry.amount;
            const fromInventory = Math.min(inventory[ingId] || 0, amountNeeded);
            const fromMarket = Math.max(0, amountNeeded - fromInventory);

            inventory[ingId] = Math.max(0, (inventory[ingId] || 0) - fromInventory);

            let marketCost = 0;
            if (fromMarket > 0) {
              const good = goodById.get(ingId)!;
              const actualBuy = Math.min(fromMarket, marketCenter.inventory[ingId] || 0);
              const purchase = Trade.buyFromCenter({
                burg,
                good,
                units: actualBuy,
                marketPrice: marketCenter.buyPrice[ingId],
                phase: "local-production-buy"
              });
              marketCost = purchase.totalCost;
              burg.wealth = (burg.wealth || 0) - marketCost;
              marketCenter.buyPrice[ingId] = Math.min(
                priceCeiling[ingId],
                marketCenter.buyPrice[ingId] + actualBuy * buyPressure[ingId]
              );
            }

            recipeLog.push({
              goodId: ingId,
              fromInventory,
              fromMarket,
              marketCost
            });
          }

          inventory[good.i] = (inventory[good.i] || 0) + produced;

          jobsData.push({
            kind: "manufacture",
            tick: workersUsed + fraction,
            goodId: good.i,
            units: produced,
            cultureModifier,
            recipe: recipeLog,
            score,
            log: decision.log
          });
        } else {
          const {goodId, score} = action;
          const extract = Math.min(fraction, remainingPool[goodId] || 0);
          remainingPool[goodId] = Math.max(0, (remainingPool[goodId] || 0) - extract);

          const good = goodById.get(goodId)!;
          const cultureModifier = this.getCultureModifier(good, cultureType);
          const produced = extract * cultureModifier;
          inventory[goodId] = (inventory[goodId] || 0) + produced;

          jobsData.push({
            kind: "extract",
            tick: workersUsed + fraction,
            goodId,
            units: produced,
            cultureModifier,
            score,
            log: decision.log
          });
        }

        workersUsed += fraction;
      }

      const {retainedInventory, excessInventory} = this.splitInventoryByDemand(inventory, demandTargets, goodById);

      burg.produced = {};
      let phaseRevenue = 0;
      for (const goodIdStr in inventory) {
        const goodId = +goodIdStr;
        const amount = inventory[goodId];
        if (amount <= 0) continue;
        burg.produced[goodId] = Math.round(amount * 100) / 100;
      }

      for (const goodIdStr in excessInventory) {
        const goodId = +goodIdStr;
        const amount = excessInventory[goodId];
        if (amount <= 0) continue;
        const good = goodById.get(goodId)!;

        const {revenue} = Trade.sellToCenter({
          burg,
          good,
          units: amount,
          marketPrice: marketCenter.sellPrice[goodId],
          phase: "local-sale"
        });
        phaseRevenue += revenue;
        marketCenter.sellPrice[goodId] = Math.max(
          priceFloor[goodId],
          marketCenter.sellPrice[goodId] - amount * sellPressure[goodId]
        );
      }
      const grossProduct =
        phaseRevenue -
        jobsData.reduce((sum, job) => {
          if (job.kind !== "manufacture") return sum;
          return sum + job.recipe.reduce((recipeSum, item) => recipeSum + item.marketCost, 0);
        }, 0);
      const productPerCapita = population > 0 ? grossProduct / population : 0;
      burg.wealth = (burg.wealth || 0) + phaseRevenue;

      this.productionData.set(burg.i!, {
        population,
        processRank: burgRank,
        totalBurgs: validBurgs.length,
        cellsBudget: budget,
        cellsReached,
        cultureType: cultureType,
        goodsPull: goodsPullData,
        jobs: jobsData,
        finalInventory: retainedInventory,
        phaseRevenue,
        grossProduct,
        productPerCapita,
        wealthAfter: burg.wealth || 0
      });
    }

    Trade.redistributeBetweenCenters(goods, this.productionData);

    for (const burg of validBurgs) {
      const data = this.productionData.get(burg.i!);
      const marketCenter = Trade.getCenterForBurg(burg as Burg);
      if (!data || !marketCenter) continue;

      this.fillBurgDemandFromCenter({
        burg: burg as Burg,
        data,
        goods,
        goodById,
        demandTargets: this.buildDemandTargets(burg as Burg),
        marketCenter,
        buyPressure,
        priceCeiling
      });
    }

    Trade.updateCenterDemand(goods, this.productionData);

    TIME && console.timeEnd("generateProduction");
  }

  private buildCellPool(goods: Good[]): Record<number, number>[] {
    const {cells} = pack;
    const biomeGoods = this.getBiomesProduction(goods);
    const cellPool: Record<number, number>[] = Array.from({length: cells.i.length}, () => ({}));

    for (const cellId of cells.i) {
      const goodId = cells.good[cellId];
      if (goodId) cellPool[cellId][goodId] = (cellPool[cellId][goodId] || 0) + this.BONUS_PRODUCTION;

      const biomeId = cells.biome[cellId];
      for (const {goodId: biomeGoodId, production} of biomeGoods[biomeId] ?? []) {
        cellPool[cellId][biomeGoodId] = (cellPool[cellId][biomeGoodId] || 0) + production;
      }
    }

    return cellPool;
  }

  private buildChainValues(goods: Good[], maxWorkers: number): number[][] {
    const baseValues: number[] = [];
    for (const good of goods) baseValues[good.i] = good.value;

    const chainValueByWorkers: number[][] = Array.from({length: maxWorkers + 1}, () => []);
    chainValueByWorkers[0] = baseValues.slice();
    chainValueByWorkers[1] = baseValues.slice();

    for (let workers = 2; workers <= maxWorkers; workers++) {
      const previous = chainValueByWorkers[workers - 1];
      const current = previous.slice();
      let changed = false;

      for (const good of goods) {
        if (!good.recipes?.length) continue;

        for (const recipe of good.recipes) {
          const entries = Object.entries(recipe) as [string, number][];
          if (!entries.length) continue;

          const recipeCost = entries.reduce((sum, [ingId, amount]) => sum + (previous[+ingId] ?? 0) * amount, 0);
          const profit = good.value - recipeCost;
          if (profit <= 0) continue;

          const totalAmount = entries.reduce((sum, [, amount]) => sum + amount, 0);
          for (const [ingIdStr, amount] of entries) {
            const contribution = profit * (amount / totalAmount);
            if (contribution <= 0.001) continue;
            const ingredientId = +ingIdStr;
            const candidateValue = (previous[ingredientId] ?? baseValues[ingredientId] ?? 0) + contribution;
            if (candidateValue > (current[ingredientId] ?? 0) + 0.001) {
              current[ingredientId] = candidateValue;
              changed = true;
            }
          }
        }
      }

      chainValueByWorkers[workers] = current;
      if (!changed) {
        for (let extraWorkers = workers + 1; extraWorkers <= maxWorkers; extraWorkers++) {
          chainValueByWorkers[extraWorkers] = current.slice();
        }
        break;
      }
    }

    return chainValueByWorkers;
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
  ): {retainedInventory: Record<number, number>; excessInventory: Record<number, number>} {
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
    data: BurgProductionData;
    goods: Good[];
    goodById: Map<number, Good>;
    demandTargets: number[];
    marketCenter: {
      inventory: Record<number, number>;
      buyPrice: number[];
    };
    buyPressure: number[];
    priceCeiling: number[];
  }): void {
    const {burg, data, goodById, demandTargets, marketCenter, buyPressure, priceCeiling} = params;
    const demandCoverage = this.calculateDemandCoverage(data.finalInventory, goodById);

    for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
      const demandCategory = DEMAND_PRIORITY[categoryIndex] as DemandCategory;
      let shortage = Math.max(0, demandTargets[categoryIndex] - demandCoverage[categoryIndex]);
      if (shortage <= 0.001) continue;

      const candidates = Object.keys(marketCenter.inventory)
        .map(Number)
        .flatMap(goodId => {
          const available = marketCenter.inventory[goodId] || 0;
          const good = goodById.get(goodId);
          const coverageWeight = good?.demandCoverage[demandCategory] || 0;
          if (!good || available <= 0.001 || coverageWeight <= 0) return [];
          return [{good, goodId, available, coverageWeight}];
        })
        .sort((a, b) => b.coverageWeight - a.coverageWeight || a.good.value - b.good.value || a.goodId - b.goodId);

      for (const candidate of candidates) {
        if (shortage <= 0.001) break;

        const unitsNeeded = shortage / candidate.coverageWeight;
        const purchase = Trade.buyFromCenter({
          burg,
          good: candidate.good,
          units: Math.min(candidate.available, unitsNeeded),
          marketPrice: marketCenter.buyPrice[candidate.goodId],
          phase: "local-demand-fill"
        });
        if (purchase.units <= 0.001) continue;

        data.finalInventory[candidate.goodId] = (data.finalInventory[candidate.goodId] || 0) + purchase.units;
        burg.wealth = (burg.wealth || 0) - purchase.totalCost;
        data.wealthAfter = burg.wealth || 0;

        for (let coverageCategoryIndex = 0; coverageCategoryIndex < DEMAND_PRIORITY.length; coverageCategoryIndex++) {
          const coverageCategory = DEMAND_PRIORITY[coverageCategoryIndex] as DemandCategory;
          const retainedCoverage = candidate.good.demandCoverage[coverageCategory] || 0;
          if (!retainedCoverage) continue;
          demandCoverage[coverageCategoryIndex] += purchase.units * retainedCoverage;
        }

        shortage = Math.max(0, demandTargets[categoryIndex] - demandCoverage[categoryIndex]);
        marketCenter.buyPrice[candidate.goodId] = Math.min(
          priceCeiling[candidate.goodId],
          marketCenter.buyPrice[candidate.goodId] + purchase.units * buyPressure[candidate.goodId]
        );
      }
    }
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

    const multiplier = 1 + coverageWeight * (this.DEMAND_SHORTAGE_MULTIPLIER + demandFocus.shortage);

    return {
      multiplier,
      category: demandFocus.category,
      shortage: demandFocus.shortage
    };
  }

  private getChainValueForWorkers(chainValueByWorkers: number[][], workers: number, goodId: number, fallback: number) {
    const maxWorkers = chainValueByWorkers.length - 1;
    const workerBucket = Math.max(0, Math.min(maxWorkers, Math.ceil(workers)));
    return chainValueByWorkers[workerBucket]?.[goodId] ?? fallback;
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

  private floodFillCells(
    burg: Burg,
    budget: number,
    cellPool: Record<number, number>[],
    addGood: (goodId: number, amount: number) => void
  ): number {
    const {cells} = pack;
    const burgCell = burg.cell;
    const burgState = burg.state ?? 0;
    const burgProvince = cells.province[burgCell];

    const visited = new Set<number>();
    const cost: Record<number, number> = {};
    cost[burgCell] = 0;

    const queue = new FlatQueue();
    queue.push(burgCell, 0);

    while (queue.length && visited.size < budget) {
      const cellId = queue.pop() as number;
      if (visited.has(cellId)) continue;
      visited.add(cellId);

      const pool = cellPool[cellId];
      for (const goodIdStr in pool) {
        const goodId = +goodIdStr;
        if (pool[goodId] > 0) {
          addGood(goodId, pool[goodId]);
          pool[goodId] = 0;
        }
      }

      if (visited.size >= budget) break;

      const baseCost = cost[cellId] ?? 0;
      for (const neighbor of cells.c[cellId]) {
        if (visited.has(neighbor)) continue;

        const isWater = cells.h[neighbor] < 20;
        let hopCost = 1;
        if (!isWater) {
          if (cells.province[neighbor] !== burgProvince) hopCost += this.PROVINCE_PENALTY;
          if (cells.state[neighbor] !== burgState) hopCost += this.STATE_PENALTY;
        }

        const totalCost = baseCost + hopCost;
        if (cost[neighbor] === undefined || totalCost < cost[neighbor]) {
          cost[neighbor] = totalCost;
          queue.push(neighbor, totalCost);
        }
      }
    }

    return visited.size;
  }

  private getBiomesProduction(goods: Good[]) {
    const biomeProduction: {goodId: number; production: number}[][] = Array.from(
      {length: biomesData.i.length},
      () => []
    );

    for (const good of goods) {
      if (!good.biome) continue;
      for (const [biomeId, production] of Object.entries(good.biome)) {
        if (!production || production <= 0) continue;
        biomeProduction[+biomeId].push({goodId: good.i, production});
      }
    }

    return biomeProduction;
  }

  /**
   * O(G + R) greedy action selection per worker tick.
   * Replaces the former O((G+R)^depth) DFS lookahead.
   * Chain awareness is preserved through worker-bucketed chain values, which
   * encode how much downstream bonus is actually reachable for the remaining workers.
   */
  private greedyBestAction(params: {
    burg: Burg;
    recipeOptions: RecipeOption[];
    goodById: Map<number, Good>;
    chainValueByWorkers: number[][];
    demandTargets: number[];
    cultureType: string;
    inventory: Record<number, number>;
    remainingPool: Record<number, number>;
    marketInventory: Record<number, number>;
    currentBuyPrice: number[];
    currentSellPrice: number[];
    workersLeft: number;
    fraction: number;
  }): {action: PlannedAction | null; log: Log | null} | null {
    let bestScore = -Infinity;
    let bestAction: PlannedAction | null = null;
    const candidates: DecisionCandidate[] = [];
    const demandCoverage = this.calculateDemandCoverage(params.inventory, params.goodById);
    const demandFocus = this.getDemandFocus(params.demandTargets, demandCoverage);

    // Score every extractable good via worker-aware chain value.
    for (const goodIdStr in params.remainingPool) {
      const available = params.remainingPool[+goodIdStr];
      if (available <= 0) continue;
      const goodId = +goodIdStr;
      const good = params.goodById.get(goodId)!;
      const cultureModifier = this.getCultureModifier(good, params.cultureType);
      const actualUnits = Math.min(params.fraction, available);
      const chainValue = this.getChainValueForWorkers(
        params.chainValueByWorkers,
        Math.max(0, params.workersLeft - params.fraction),
        goodId,
        good.value
      );
      const demandEffect = this.getDemandEffect(good, demandFocus);
      const perWorkerScore = chainValue * cultureModifier * demandEffect.multiplier;
      const score = perWorkerScore * actualUnits;
      candidates.push({
        kind: "extract",
        goodId,
        score,
        chainValue,
        demandEffect,
        cultureModifier,
        units: actualUnits,
        available
      });
      if (score > bestScore) {
        bestScore = score;
        bestAction = {
          kind: "extract",
          goodId,
          score
        };
      }
    }

    // Score every feasible manufacture option by explicit profit margin
    for (const option of params.recipeOptions) {
      const cultureModifier = this.getCultureModifier(option.good, params.cultureType);
      const revenue = params.currentSellPrice[option.good.i] * cultureModifier;
      let maxYield = Infinity;
      let feasible = true;

      for (const entry of option.entries) {
        const inventoryAvailable = params.inventory[entry.goodId] || 0;
        const marketAvailable = params.marketInventory[entry.goodId] || 0;
        const totalAvailable = inventoryAvailable + marketAvailable;
        if (totalAvailable < entry.amount * params.fraction) {
          feasible = false;
          break;
        }
        maxYield = Math.min(maxYield, totalAvailable / entry.amount);
      }

      if (!feasible || !Number.isFinite(maxYield) || maxYield <= 0) continue;
      const demandEffect = this.getDemandEffect(option.good, demandFocus);
      const actualUnits = Math.min(params.fraction, maxYield);
      const ingredients: DecisionIngredient[] = [];
      let marketCostTotal = 0;

      for (const entry of option.entries) {
        const inventoryAvailable = params.inventory[entry.goodId] || 0;
        const marketAvailable = params.marketInventory[entry.goodId] || 0;
        const totalAvailable = inventoryAvailable + marketAvailable;
        const amountNeeded = actualUnits * entry.amount;
        const fromInventory = Math.min(inventoryAvailable, amountNeeded);
        const fromMarket = Math.max(0, amountNeeded - fromInventory);
        const marketCost = fromMarket * Trade.getConsumerPrice(params.burg, params.currentBuyPrice[entry.goodId]);
        marketCostTotal += marketCost;

        ingredients.push({
          goodId: entry.goodId,
          amount: amountNeeded,
          buyPrice: params.currentBuyPrice[entry.goodId],
          available: totalAvailable,
          availableInventory: inventoryAvailable,
          availableMarket: marketAvailable,
          fromInventory,
          fromMarket,
          marketCost
        });
      }

      const ingredientCost = actualUnits > 0 ? marketCostTotal / actualUnits : 0;
      const perWorkerScore = (revenue - ingredientCost) * demandEffect.multiplier;
      const score = perWorkerScore * actualUnits;
      candidates.push({
        kind: "manufacture",
        goodId: option.good.i,
        score,
        sellPrice: params.currentSellPrice[option.good.i],
        demandEffect,
        cultureModifier,
        revenue,
        ingredientCost,
        units: actualUnits,
        ingredients
      });
      if (score > bestScore) {
        bestScore = score;
        bestAction = {
          kind: "manufacture",
          good: option.good,
          entries: option.entries,
          maxYield,
          score
        };
      }
    }

    if (!bestAction) return null;

    const chosenKind = bestAction.kind;
    const chosenGoodId = chosenKind === "extract" ? bestAction.goodId : bestAction.good.i;
    const selected =
      candidates.find(candidate => candidate.kind === chosenKind && candidate.goodId === chosenGoodId) || null;
    const alternatives = candidates
      .filter(candidate => !(candidate.kind === chosenKind && candidate.goodId === chosenGoodId))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    return {
      action: bestAction,
      log: {
        selected,
        alternatives,
        candidateCount: candidates.length
      }
    };
  }

  private getCultureModifier(good: Good, cultureType: string) {
    return good.culture[cultureType as CultureType] || 1;
  }

  private buildRecipeOptions(goods: Good[]): RecipeOption[] {
    const options: RecipeOption[] = [];
    for (const good of goods) {
      if (!good.recipes?.length) continue;
      for (const recipe of good.recipes) {
        const entries = Object.entries(recipe).map(([goodId, amount]) => ({
          goodId: +goodId,
          amount
        }));
        if (!entries.length) continue;
        options.push({good, entries});
      }
    }
    return options;
  }

  getProductionData(burgId: number): BurgProductionData | undefined {
    return this.productionData.get(burgId);
  }
}

type PlannedAction =
  | {
      kind: "extract";
      goodId: number;
      score: number;
    }
  | {
      kind: "manufacture";
      good: Good;
      entries: RecipeEntry[];
      maxYield: number;
      score: number;
    };

type RecipeEntry = {goodId: number; amount: number};
type RecipeOption = {good: Good; entries: RecipeEntry[]};
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
export type DecisionCandidate =
  | {
      kind: "extract";
      goodId: number;
      score: number;
      chainValue: number;
      demandEffect: DemandEffect;
      cultureModifier: number;
      units: number;
      available: number;
    }
  | {
      kind: "manufacture";
      goodId: number;
      score: number;
      sellPrice: number;
      demandEffect: DemandEffect;
      cultureModifier: number;
      revenue: number;
      ingredientCost: number;
      units: number;
      ingredients: DecisionIngredient[];
    };
export type Log = {
  selected: DecisionCandidate | null;
  alternatives: DecisionCandidate[];
  candidateCount: number;
};

export interface BurgProductionData {
  population: number;
  processRank: number;
  totalBurgs: number;
  cellsBudget: number;
  cellsReached: number;
  cultureType: string;
  goodsPull: Array<{
    goodId: number;
    pull: number;
    chainValue: number;
  }>;
  jobs: Array<
    | {
        kind: "extract";
        tick: number;
        goodId: number;
        units: number;
        cultureModifier: number;
        score?: number;
        log?: Log | null;
      }
    | {
        kind: "manufacture";
        tick: number;
        goodId: number;
        units: number;
        cultureModifier: number;
        score: number;
        recipe: Array<{
          goodId: number;
          fromInventory: number;
          fromMarket: number;
          marketCost: number;
        }>;
        log?: Log | null;
      }
  >;
  finalInventory: Record<number, number>;
  phaseRevenue: number;
  grossProduct: number;
  productPerCapita: number;
  wealthAfter: number;
}

declare global {
  var Production: ProductionModule;
}

window.Production = new ProductionModule();
