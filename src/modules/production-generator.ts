import Alea from "alea";
import type {Burg} from "./burgs-generator";
import type {CultureType} from "./cultures-generator";
import {DEFAULT_CULTURE_TYPE} from "./cultures-generator";
import type {Good} from "./goods-generator";

export class ProductionModule {
  private readonly BONUS_PRODUCTION = 5;
  private readonly COLLECTION_DIVISOR = 3;

  private readonly PROVINCE_PENALTY = 3;
  private readonly STATE_PENALTY = 15;

  private readonly BUY_PRESSURE_FACTOR = 0.002;
  private readonly SELL_PRESSURE_FACTOR = 0.001;
  private readonly PRICE_FLOOR_FACTOR = 0.5;
  private readonly PRICE_CEILING_FACTOR = 3.0;

  private readonly CHAIN_MAX_ITERATIONS = 10;
  private readonly PRIORITY_JITTER = 0.2;

  private productionData = new Map<number, BurgProductionData>();

  produce() {
    TIME && console.time("generateProduction");
    const {burgs} = pack;
    const goods = pack.goods;

    const goodById = new Map<number, Good>(goods.map(g => [g.i, g]));
    const cellPool = this.buildCellPool(goods);
    const chainValue = this.buildChainValues(goods);
    const {currentBuyPrice, currentSellPrice, buyPressure, sellPressure, priceFloor, priceCeiling} =
      this.buildPriceArrays(goods);

    const recipeOptions = this.buildRecipeOptions(goods);
    const globalMarket: Record<number, number> = {};

    const validBurgs = burgs.filter(b => (b as Burg).i && !(b as Burg).removed);
    validBurgs.sort((a, b) => (a.population || 0) - (b.population || 0));

    this.productionData.clear();
    let burgRank = 0;

    for (const burg of validBurgs) {
      burgRank++;
      const type = burg.type || DEFAULT_CULTURE_TYPE;
      const population = burg.population || 0;
      const burgRng = Alea(seed + String(burg.i));

      const goodsPull: Record<number, number> = {};
      const addGood = (goodId: number, amount: number) => {
        const current = goodsPull[goodId] || 0;
        if (!current) goodsPull[goodId] = amount;
        else if (amount > current) goodsPull[goodId] = amount + current / this.COLLECTION_DIVISOR;
        else goodsPull[goodId] = current + amount / this.COLLECTION_DIVISOR;
      };

      const budget = Math.max(1, Math.floor(population));
      const pricesAtStart = {
        buy: currentBuyPrice.slice(),
        sell: currentSellPrice.slice()
      };

      const cellsReached = this.floodFillCells(burg, budget, cellPool, addGood);

      const goodsPullData: BurgProductionData["goodsPull"] = [];
      for (const goodIdStr in goodsPull) {
        const goodId = +goodIdStr;
        const good = goodById.get(goodId);
        if (!good) continue;
        const rawPull = goodsPull[goodId];
        const cultureModifier = this.getCultureModifier(good, type);
        const basePriority = rawPull * good.value * cultureModifier;
        const jitter = 1 - this.PRIORITY_JITTER / 2 + burgRng() * this.PRIORITY_JITTER;
        const priority = basePriority * jitter;
        goodsPullData.push({
          goodId,
          pull: rawPull,
          chainValue: chainValue[goodId] ?? good.value,
          priority
        });
      }
      goodsPullData.sort((a, b) => b.priority - a.priority);

      const remainingPool: Record<number, number> = {...goodsPull};
      const inventory: Record<number, number> = {};
      const jobsData: BurgProductionData["jobs"] = [];
      let workersUsed = 0;

      for (let i = 0; i < Math.ceil(population); i++) {
        const workersLeft = population - workersUsed;
        const fraction = Math.min(1, workersLeft);
        if (fraction <= 0) break;

        const action = this.greedyBestAction({
          recipeOptions,
          goodById,
          chainValue,
          cultureType: type,
          inventory,
          remainingPool,
          globalMarket,
          currentBuyPrice,
          currentSellPrice,
          fraction
        });

        if (!action) break;

        if (action.kind === "manufacture") {
          const {good, entries, maxYield, projectedGain} = action;
          const actualYield = Math.min(fraction, maxYield);
          const cultureModifier = this.getCultureModifier(good, type);
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
              const actualBuy = Math.min(fromMarket, globalMarket[ingId] || 0);
              globalMarket[ingId] = Math.max(0, (globalMarket[ingId] || 0) - actualBuy);
              marketCost = actualBuy * currentBuyPrice[ingId];
              burg.wealth = (burg.wealth || 0) - marketCost;
              currentBuyPrice[ingId] = Math.min(
                priceCeiling[ingId],
                currentBuyPrice[ingId] + actualBuy * buyPressure[ingId]
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
            score: projectedGain
          });
        } else {
          const {goodId, projectedGain} = action;
          const extract = Math.min(fraction, remainingPool[goodId] || 0);
          remainingPool[goodId] = Math.max(0, (remainingPool[goodId] || 0) - extract);

          const good = goodById.get(goodId)!;
          const cultureModifier = this.getCultureModifier(good, type);
          const produced = extract * cultureModifier;
          inventory[goodId] = (inventory[goodId] || 0) + produced;

          currentBuyPrice[goodId] = Math.min(
            priceCeiling[goodId],
            currentBuyPrice[goodId] + produced * buyPressure[goodId]
          );

          jobsData.push({
            kind: "extract",
            tick: workersUsed + fraction,
            goodId,
            units: produced,
            cultureModifier,
            projectedGain
          });
        }

        workersUsed += fraction;
      }

      burg.produced = {};
      let phaseRevenue = 0;
      for (const goodIdStr in inventory) {
        const goodId = +goodIdStr;
        const amount = inventory[goodId];
        if (amount <= 0) continue;

        const revenue = amount * currentSellPrice[goodId];
        phaseRevenue += revenue;
        globalMarket[goodId] = (globalMarket[goodId] || 0) + amount;
        currentSellPrice[goodId] = Math.max(
          priceFloor[goodId],
          currentSellPrice[goodId] - amount * sellPressure[goodId]
        );

        burg.produced[goodId] = Math.round(amount * 100) / 100;
      }
      burg.wealth = (burg.wealth || 0) + phaseRevenue;

      this.productionData.set(burg.i!, {
        population,
        processRank: burgRank,
        totalBurgs: validBurgs.length,
        cellsBudget: budget,
        cellsReached,
        cultureType: type,
        goodsPull: goodsPullData,
        jobs: jobsData,
        finalInventory: {...inventory},
        pricesAtStart,
        phaseRevenue,
        wealthAfter: burg.wealth || 0
      });
    }

    for (const good of goods) {
      good.buyPrice = +currentBuyPrice[good.i].toFixed(2);
      good.sellPrice = +currentSellPrice[good.i].toFixed(2);
    }

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

  private buildChainValues(goods: Good[]): number[] {
    const chainValue: number[] = [];
    for (const good of goods) chainValue[good.i] = good.value;

    for (let iter = 0; iter < this.CHAIN_MAX_ITERATIONS; iter++) {
      let changed = false;

      for (const good of goods) {
        if (!good.recipes?.length) continue;

        for (const recipe of good.recipes) {
          const entries = Object.entries(recipe) as [string, number][];
          if (!entries.length) continue;

          const recipeCost = entries.reduce((sum, [ingId, amount]) => sum + (chainValue[+ingId] ?? 0) * amount, 0);
          const profit = good.value - recipeCost;
          if (profit <= 0) continue;

          const totalAmount = entries.reduce((sum, [, amount]) => sum + amount, 0);
          for (const [ingIdStr, amount] of entries) {
            const contribution = profit * (amount / totalAmount);
            if (contribution > 0.001) {
              chainValue[+ingIdStr] = (chainValue[+ingIdStr] ?? 0) + contribution;
              changed = true;
            }
          }
        }
      }

      if (!changed) break;
    }

    return chainValue;
  }

  private buildPriceArrays(goods: Good[]) {
    const n = goods.length;
    const currentBuyPrice = new Array<number>(n);
    const currentSellPrice = new Array<number>(n);
    const buyPressure = new Array<number>(n);
    const sellPressure = new Array<number>(n);
    const priceFloor = new Array<number>(n);
    const priceCeiling = new Array<number>(n);

    for (const good of goods) {
      const i = good.i;
      currentBuyPrice[i] = good.value;
      currentSellPrice[i] = good.value;
      buyPressure[i] = good.value * this.BUY_PRESSURE_FACTOR;
      sellPressure[i] = good.value * this.SELL_PRESSURE_FACTOR;
      priceFloor[i] = good.value * this.PRICE_FLOOR_FACTOR;
      priceCeiling[i] = good.value * this.PRICE_CEILING_FACTOR;
    }

    return {
      currentBuyPrice,
      currentSellPrice,
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
   * Chain awareness is preserved through chainValue[], which already encodes
   * the expected downstream manufacturing bonus for every raw good.
   */
  private greedyBestAction(params: {
    recipeOptions: RecipeOption[];
    goodById: Map<number, Good>;
    chainValue: number[];
    cultureType: string;
    inventory: Record<number, number>;
    remainingPool: Record<number, number>;
    globalMarket: Record<number, number>;
    currentBuyPrice: number[];
    currentSellPrice: number[];
    fraction: number;
  }): PlannedAction | null {
    let bestScore = -Infinity;
    let bestAction: PlannedAction | null = null;

    // Score every extractable good via chainValue (includes downstream manufacturing bonus)
    for (const goodIdStr in params.remainingPool) {
      const available = params.remainingPool[+goodIdStr];
      if (available <= 0) continue;
      const goodId = +goodIdStr;
      const good = params.goodById.get(goodId)!;
      const score = (params.chainValue[goodId] ?? good.value) * this.getCultureModifier(good, params.cultureType);
      if (score > bestScore) {
        bestScore = score;
        bestAction = {
          kind: "extract",
          goodId,
          projectedGain: score * params.fraction
        };
      }
    }

    // Score every feasible manufacture option by explicit profit margin
    for (const option of params.recipeOptions) {
      const cultureModifier = this.getCultureModifier(option.good, params.cultureType);
      const revenue = params.currentSellPrice[option.good.i] * cultureModifier;
      let ingredientCost = 0;
      let maxYield = Infinity;
      let feasible = true;

      for (const entry of option.entries) {
        const totalAvailable = (params.inventory[entry.goodId] || 0) + (params.globalMarket[entry.goodId] || 0);
        if (totalAvailable < entry.amount * params.fraction) {
          feasible = false;
          break;
        }
        ingredientCost += entry.amount * params.currentBuyPrice[entry.goodId];
        maxYield = Math.min(maxYield, totalAvailable / entry.amount);
      }

      if (!feasible || !Number.isFinite(maxYield) || maxYield <= 0) continue;
      const score = revenue - ingredientCost;
      const projectedGain = score * Math.min(params.fraction, maxYield);
      if (score > bestScore) {
        bestScore = score;
        bestAction = {
          kind: "manufacture",
          good: option.good,
          entries: option.entries,
          maxYield,
          projectedGain
        };
      }
    }

    return bestAction;
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
      projectedGain: number;
    }
  | {
      kind: "manufacture";
      good: Good;
      entries: RecipeEntry[];
      maxYield: number;
      projectedGain: number;
    };

type RecipeEntry = {goodId: number; amount: number};
type RecipeOption = {good: Good; entries: RecipeEntry[]};

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
    priority: number;
  }>;
  jobs: Array<
    | {
        kind: "extract";
        tick: number;
        goodId: number;
        units: number;
        cultureModifier: number;
        projectedGain?: number;
      }
    | {
        kind: "manufacture";
        tick: number;
        goodId: number;
        units: number;
        cultureModifier: number;
        recipe: Array<{
          goodId: number;
          fromInventory: number;
          fromMarket: number;
          marketCost: number;
        }>;
        score: number;
      }
  >;
  finalInventory: Record<number, number>;
  pricesAtStart: {buy: number[]; sell: number[]};
  phaseRevenue: number;
  wealthAfter: number;
}

declare global {
  var Production: ProductionModule;
}

window.Production = new ProductionModule();
