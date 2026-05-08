import type {Burg} from "./burgs-generator";
import type {CultureType} from "./cultures-generator";
import {DEFAULT_CULTURE_TYPE} from "./cultures-generator";
import type {DemandCategory, Good} from "./goods-generator";
import {DEMAND_PRIORITY, DEMAND_TARGET_FACTORS} from "./goods-generator";
import type {Market} from "./trade-generator";

export class ProductionModule {
  private readonly BONUS_PRODUCTION = 5;
  private readonly PROVINCE_PENALTY = 3;
  private readonly STATE_PENALTY = 15;

  private readonly BUY_PRESSURE_FACTOR = 0.002;
  private readonly SELL_PRESSURE_FACTOR = 0.001;
  private readonly PRICE_FLOOR_FACTOR = 0.5;
  private readonly PRICE_CEILING_FACTOR = 3.0;
  private readonly DEMAND_SHORTAGE_MULTIPLIER = 2.0;

  private readonly CHAIN_VALUE_MAX_WORKERS = 5;

  private productionData = new Map<number, BurgProductionData>();
  private claimedCells = new Set<number>();

  produce() {
    TIME && console.time("generateProduction");
    const {burgs, goods} = pack;

    const validBurgs = burgs.filter(b => b.i && !b.removed);
    validBurgs.sort((a, b) => (a.population || 0) - (b.population || 0));

    const goodById = new Map<number, Good>(goods.map(g => [g.i, g]));
    this.claimedCells.clear();
    const globalResources = this.collectGlobalResources(goods);
    const chainValueByWorkers = this.buildChainValues(goods, this.CHAIN_VALUE_MAX_WORKERS);
    const {buyPressure, sellPressure, priceFloor, priceCeiling} = this.buildPriceArrays(goods);
    const recipes = this.buildRecipesArray(goods);

    this.productionData.clear();

    for (const burg of validBurgs) {
      const market = Trade.getMarketForBurg(burg);
      if (!market) continue;
      const cultureType = burg.type || DEFAULT_CULTURE_TYPE;
      const population = burg.population || 0;
      const demandTargets = this.buildDemandTargets(burg);
      const workers = Math.max(1, Math.ceil(population));
      const {resources: burgResources, cellEntries: burgCellEntries} = this.getBurgResourses(
        burg,
        workers,
        globalResources
      );

      const inventory: Record<number, number> = {};
      const jobs: BurgProductionData["jobs"] = [];
      let workersUsed = 0;

      for (let i = 0; i < Math.ceil(population); i++) {
        const workersLeft = population - workersUsed;
        const fraction = Math.min(1, workersLeft);
        if (fraction <= 0) break;

        const marketView = this.getMarketView(market);
        const decision = this.makeProductionDecision({
          burg,
          recipes,
          goodById,
          chainValueByWorkers,
          demandTargets,
          cultureType,
          inventory,
          burgResources,
          marketInventory: marketView.inventory,
          buyPrice: marketView.buyPrice,
          sellPrice: marketView.sellPrice,
          workersLeft,
          fraction
        });
        if (!decision?.action) break;

        if (decision.action.kind === "manufacture") {
          const {good, ingredients, maxYield, score} = decision.action;
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
                marketPrice: marketGood.buyPrice,
                phase: "local-production-buy"
              });
              marketCost = purchase.totalCost;
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

          jobs.push({
            kind: "manufacture",
            tick: workersUsed + fraction,
            goodId: good.i,
            units: produced,
            cultureModifier,
            recipe: recipeLog,
            score,
            candidates: decision.candidates
          });
        } else {
          // extraction
          const {goodId, score} = decision.action;
          const extract = Math.min(fraction, burgResources[goodId] || 0);
          burgResources[goodId] -= extract;

          // Deduct extracted amount from the source cells in globalResources
          let remaining = extract;
          for (const entry of burgCellEntries) {
            if (entry.goodId !== goodId || remaining <= 0.001) continue;
            const take = Math.min(entry.amount, remaining);
            entry.amount -= take;
            remaining -= take;
            globalResources[entry.cellId][entry.goodId] = entry.amount;
          }

          const good = goodById.get(goodId)!;
          const cultureModifier = this.getCultureModifier(good, cultureType);
          const produced = extract * cultureModifier;
          inventory[goodId] = (inventory[goodId] || 0) + produced;

          jobs.push({
            kind: "extract",
            tick: workersUsed + fraction,
            goodId,
            units: produced,
            cultureModifier,
            score,
            candidates: decision.candidates
          });
        }

        workersUsed += fraction;
      }

      const {retainedInventory, excessInventory} = this.splitInventoryByDemand(inventory, demandTargets, goodById);

      // Zero any remaining claimed cells that were not fully extracted
      for (const entry of burgCellEntries) {
        if (entry.amount > 0.001) {
          globalResources[entry.cellId][entry.goodId] = 0;
        }
      }

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

        const {revenue} = Trade.sellToMarket({
          burg,
          good,
          units: amount,
          marketPrice: this.getMarketGoodData(market, goodId, good.value).sellPrice,
          phase: "local-sale"
        });
        phaseRevenue += revenue;
        const marketGood = this.getMarketGoodData(market, goodId, good.value);
        marketGood.sellPrice = Math.max(priceFloor[goodId], marketGood.sellPrice - amount * sellPressure[goodId]);
      }
      burg.wealth = (burg.wealth || 0) + phaseRevenue;

      this.productionData.set(burg.i!, {
        jobs,
        finalInventory: retainedInventory
      });
    }

    Trade.redistributeAcrossMarkets(goods, this.productionData);

    for (const burg of validBurgs) {
      const data = this.productionData.get(burg.i!);
      const marketCenter = Trade.getMarketForBurg(burg);
      if (!data || !marketCenter) continue;

      this.fillBurgDemandFromCenter({
        burg,
        data,
        goods,
        goodById,
        demandTargets: this.buildDemandTargets(burg),
        marketCenter,
        buyPressure,
        priceCeiling
      });
    }

    Trade.updateMarketDemand(goods, this.productionData);

    TIME && console.timeEnd("generateProduction");
  }

  private collectGlobalResources(goods: Good[]): Record<number, number>[] {
    const {cells} = pack;
    const biomeResources = this.getBiomesResources(goods);
    const cellsResources: Record<number, number>[] = Array.from({length: cells.i.length}, () => ({}));

    for (const cellId of cells.i) {
      const goodId = cells.good[cellId];
      if (goodId) cellsResources[cellId][goodId] = (cellsResources[cellId][goodId] || 0) + this.BONUS_PRODUCTION;

      const biomeId = cells.biome[cellId];
      for (const {goodId, production} of biomeResources[biomeId] ?? []) {
        cellsResources[cellId][goodId] = (cellsResources[cellId][goodId] || 0) + production;
      }
    }

    return cellsResources;
  }

  private getBiomesResources(goods: Good[]) {
    const biomeResources: {goodId: number; production: number}[][] = Array.from(
      {length: biomesData.i.length},
      () => []
    );

    for (const good of goods) {
      if (!good.biome) continue;
      for (const [biomeId, production] of Object.entries(good.biome)) {
        if (!production || production <= 0) continue;
        biomeResources[+biomeId].push({goodId: good.i, production});
      }
    }

    return biomeResources;
  }

  private getBurgResourses(
    burg: Burg,
    cellsBudget: number,
    globalResources: Record<number, number>[]
  ): {resources: Record<number, number>; cellEntries: CellEntry[]} {
    const resources: Record<number, number> = {};
    const cellEntries: CellEntry[] = [];
    const addGood = (cellId: number, goodId: number, amount: number) => {
      resources[goodId] = (resources[goodId] || 0) + amount;
      cellEntries.push({cellId, goodId, amount});
    };

    this.floodFillCells(burg, cellsBudget, globalResources, this.claimedCells, addGood);
    return {resources, cellEntries};
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
    data: BurgProductionData;
    goods: Good[];
    goodById: Map<number, Good>;
    demandTargets: number[];
    marketCenter: Market;
    buyPressure: number[];
    priceCeiling: number[];
  }): void {
    const {burg, data, goodById, demandTargets, marketCenter, buyPressure, priceCeiling} = params;
    const demandCoverage = this.calculateDemandCoverage(data.finalInventory, goodById);

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

        const unitsNeeded = shortage / candidate.coverageWeight;
        const purchase = Trade.buyFromMarket({
          burg,
          good: candidate.good,
          units: Math.min(candidate.available, unitsNeeded),
          marketPrice: this.getMarketGoodData(marketCenter, candidate.goodId, candidate.good.value).buyPrice,
          phase: "local-demand-fill"
        });
        if (purchase.units <= 0.001) continue;

        data.finalInventory[candidate.goodId] = (data.finalInventory[candidate.goodId] || 0) + purchase.units;
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
    claimedCells: Set<number>,
    addGood: (cellId: number, goodId: number, amount: number) => void
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
      if (visited.has(cellId) || claimedCells.has(cellId)) continue;
      visited.add(cellId);
      claimedCells.add(cellId);

      const pool = cellPool[cellId];
      for (const goodIdStr in pool) {
        const goodId = +goodIdStr;
        if (pool[goodId] > 0) {
          addGood(cellId, goodId, pool[goodId]);
          // pool[goodId] is NOT zeroed here; it is zeroed during extraction or after the worker loop
        }
      }

      if (visited.size >= budget) break;

      const baseCost = cost[cellId] ?? 0;
      for (const neighbor of cells.c[cellId]) {
        if (visited.has(neighbor) || claimedCells.has(neighbor)) continue;

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

  private makeProductionDecision(params: {
    burg: Burg;
    recipes: Recipes[];
    goodById: Map<number, Good>;
    chainValueByWorkers: number[][];
    demandTargets: number[];
    cultureType: string;
    inventory: Record<number, number>;
    burgResources: Record<number, number>;
    marketInventory: Record<number, number>;
    buyPrice: number[];
    sellPrice: number[];
    workersLeft: number;
    fraction: number;
  }): {action: PlannedAction; candidates: DecisionCandidate[]} | null {
    let bestScore = -Infinity;
    let bestAction: PlannedAction | null = null;
    const candidates: DecisionCandidate[] = [];
    const demandCoverage = this.calculateDemandCoverage(params.inventory, params.goodById);
    const demandFocus = this.getDemandFocus(params.demandTargets, demandCoverage);

    // Score every extractable good via worker-aware chainValue
    for (const goodIdStr in params.burgResources) {
      const goodId = +goodIdStr;
      const available = params.burgResources[goodId];
      if (available <= 0) continue;
      const good = params.goodById.get(goodId);
      if (!good) continue;

      const cultureModifier = this.getCultureModifier(good, params.cultureType);
      const units = Math.min(params.fraction, available);
      const chainValue = this.getChainValueForWorkers(
        params.chainValueByWorkers,
        Math.max(0, params.workersLeft - params.fraction),
        goodId,
        good.value
      );
      const demandEffect = this.getDemandEffect(good, demandFocus);
      const currentSellPrice = params.sellPrice[goodId] ?? good.value;
      const priceRatio = good.value > 0 ? currentSellPrice / good.value : 1;
      const adjustedChainValue = chainValue * priceRatio;
      const score = units * adjustedChainValue * cultureModifier * demandEffect.multiplier;
      candidates.push({
        kind: "extract",
        goodId,
        score,
        chainValue: adjustedChainValue,
        demandEffect,
        cultureModifier,
        units,
        available
      });
      if (score > bestScore) {
        bestScore = score;
        bestAction = {kind: "extract", goodId, score};
      }
    }

    // Score every feasible manufacture option by explicit profit margin
    for (const recipe of params.recipes) {
      const cultureModifier = this.getCultureModifier(recipe.good, params.cultureType);
      const baseChainValue = this.getChainValueForWorkers(
        params.chainValueByWorkers,
        Math.max(0, params.workersLeft - params.fraction),
        recipe.good.i,
        recipe.good.value
      );
      const currentSellPrice = params.sellPrice[recipe.good.i] ?? recipe.good.value;
      const priceRatio = recipe.good.value > 0 ? currentSellPrice / recipe.good.value : 1;
      const chainValue = baseChainValue * priceRatio;
      const revenue = chainValue * cultureModifier;
      let maxYield = Infinity;
      let feasible = true;

      for (const ingredient of recipe.ingredients) {
        const inventoryAvailable = params.inventory[ingredient.goodId] || 0;
        const marketAvailable = params.marketInventory[ingredient.goodId] || 0;
        const totalAvailable = inventoryAvailable + marketAvailable;
        if (totalAvailable < ingredient.amount * params.fraction) {
          feasible = false;
          break;
        }
        maxYield = Math.min(maxYield, totalAvailable / ingredient.amount);
      }

      if (!feasible || !Number.isFinite(maxYield) || maxYield <= 0) continue;

      const demandEffect = this.getDemandEffect(recipe.good, demandFocus);
      const units = Math.min(params.fraction, maxYield);
      const ingredients: DecisionIngredient[] = [];
      let marketCostTotal = 0;

      for (const ingredient of recipe.ingredients) {
        const inventoryAvailable = params.inventory[ingredient.goodId] || 0;
        const marketAvailable = params.marketInventory[ingredient.goodId] || 0;
        const totalAvailable = inventoryAvailable + marketAvailable;
        const amountNeeded = units * ingredient.amount;
        const fromInventory = Math.min(inventoryAvailable, amountNeeded);
        const fromMarket = Math.max(0, amountNeeded - fromInventory);
        const marketCost = fromMarket * Trade.getConsumerPrice(params.burg, params.buyPrice[ingredient.goodId]);
        marketCostTotal += marketCost;

        ingredients.push({
          goodId: ingredient.goodId,
          amount: amountNeeded,
          buyPrice: params.buyPrice[ingredient.goodId],
          available: totalAvailable,
          availableInventory: inventoryAvailable,
          availableMarket: marketAvailable,
          fromInventory,
          fromMarket,
          marketCost
        });
      }

      const ingredientsCost = marketCostTotal / units;
      const perWorkerScore = (revenue - ingredientsCost) * demandEffect.multiplier;
      const score = perWorkerScore * units;
      candidates.push({
        kind: "manufacture",
        goodId: recipe.good.i,
        score,
        chainValue,
        demandEffect,
        cultureModifier,
        revenue,
        ingredientCost: ingredientsCost,
        units,
        ingredients
      });
      if (score > bestScore) {
        bestScore = score;
        bestAction = {
          kind: "manufacture",
          good: recipe.good,
          ingredients: recipe.ingredients,
          maxYield,
          score
        };
      }
    }

    if (!bestAction) return null;

    return {action: bestAction, candidates};
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

  getProductionData(burgId: number): BurgProductionData | undefined {
    return this.productionData.get(burgId);
  }

  getAccessibleResources(burgId: number): Array<{goodId: number; amount: number}> {
    const burg = (pack.burgs as Burg[])[burgId];
    if (!burg || burg.removed) return [];

    const goods = pack.goods;
    const freshResources = this.collectGlobalResources(goods);
    const workers = Math.max(1, Math.ceil(burg.population || 0));
    const localClaimed = new Set<number>();
    const resources: Record<number, number> = {};

    this.floodFillCells(burg, workers, freshResources, localClaimed, (_cellId, goodId, amount) => {
      resources[goodId] = (resources[goodId] || 0) + amount;
    });

    return Object.entries(resources)
      .map(([goodIdStr, amount]) => ({goodId: +goodIdStr, amount}))
      .sort((a, b) => b.amount - a.amount);
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
      ingredients: Ingredient[];
      maxYield: number;
      score: number;
    };

type Ingredient = {goodId: number; amount: number};
type CellEntry = {cellId: number; goodId: number; amount: number};
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
      chainValue: number;
      demandEffect: DemandEffect;
      cultureModifier: number;
      revenue: number;
      ingredientCost: number;
      units: number;
      ingredients: DecisionIngredient[];
    };

export interface BurgProductionData {
  jobs: (Extraction | Manufacturing)[];
  finalInventory: Record<number, number>;
}

interface Job {
  kind: "extract" | "manufacture";
  tick: number;
  goodId: number;
  units: number;
  cultureModifier: number;
  score: number;
  candidates: DecisionCandidate[];
}

interface Extraction extends Job {
  kind: "extract";
}

interface Manufacturing extends Job {
  kind: "manufacture";
  recipe: {
    goodId: number;
    fromInventory: number;
    fromMarket: number;
    marketCost: number;
  }[];
}

declare global {
  var Production: ProductionModule;
}

window.Production = new ProductionModule();
