import Alea from "alea";
import type {Burg} from "./burgs-generator";
import type {CultureType} from "./cultures-generator";
import {DEFAULT_CULTURE_TYPE} from "./cultures-generator";
import type {Good} from "./goods-generator";

export class ProductionModule {
  private readonly BONUS_PRODUCTION = 5;
  private readonly COLLECTION_DIVISOR = 3;

  // flood-fill traversal penalties
  private readonly PROVINCE_PENALTY = 3;
  private readonly STATE_PENALTY = 15;

  // dynamic pricing — raise buy price when raw good is extracted, lower sell price when manufactured
  private readonly BUY_PRESSURE_FACTOR = 0.002;
  private readonly SELL_PRESSURE_FACTOR = 0.001;
  private readonly PRICE_FLOOR_FACTOR = 0.5;
  private readonly PRICE_CEILING_FACTOR = 3.0;

  // iterative chain-value propagation
  private readonly CHAIN_MAX_ITERATIONS = 10;

  // bounded lookahead for per-tick planning
  private readonly PLAN_LOOKAHEAD_DEPTH = 3;
  private readonly PLAN_MAX_EXTRACT_CANDIDATES = 6;
  private readonly PLAN_MAX_MANUFACTURE_CANDIDATES = 10;

  // per-burg priority jitter amplitude (±PRIORITY_JITTER/2)
  private readonly PRIORITY_JITTER = 0.2;

  private _lastProductionData = new Map<number, BurgProductionData>();
  produce() {
    TIME && console.time("generateProduction");
    const {burgs} = pack;
    const goods = pack.goods;

    // Phase A: pre-computation (runs once, shared across all burgs)
    // Build id→Good map; pack.goods is shuffled during generation so array-position access is wrong
    const goodById = new Map<number, Good>(goods.map(g => [g.i, g]));
    TIME && console.time("generateProduction:buildCellPool");
    const cellPool = this.buildCellPool(goods);
    TIME && console.timeEnd("generateProduction:buildCellPool");

    TIME && console.time("generateProduction:buildChainValues");
    const chainValue = this.buildChainValues(goods);
    TIME && console.timeEnd("generateProduction:buildChainValues");

    TIME && console.time("generateProduction:buildPriceArrays");
    const {currentBuyPrice, currentSellPrice, buyPressure, sellPressure, priceFloor, priceCeiling} =
      this.buildPriceArrays(goods);
    TIME && console.timeEnd("generateProduction:buildPriceArrays");

    // globalMarket: goods produced/sold by burgs accumulate here so later burgs can buy them.
    // Starts empty; filled in Phase D of each burg (smallest first = poorest first).
    const globalMarket: Record<number, number> = {};

    // start from smallest burgs
    const validBurgs = burgs.filter(b => (b as Burg).i && !(b as Burg).removed) as Burg[];
    validBurgs.sort((a, b) => (a.population || 0) - (b.population || 0));

    let floodFillMs = 0;
    let planningMs = 0;
    let marketMs = 0;

    this._lastProductionData.clear();
    let burgRank = 0;

    for (const burg of validBurgs) {
      burgRank++;
      const type = burg.type || DEFAULT_CULTURE_TYPE;
      const population = burg.population || 0;

      // Deterministic per-burg RNG — consistent across regenerations, different per burg
      const burgRng = Alea(seed + String(burg.i));

      // Phase B: flood-fill cell collection
      const goodsPull: Record<number, number> = {};
      const addGood = (goodId: number, amount: number) => {
        const current = goodsPull[goodId] || 0;
        if (!current) {
          goodsPull[goodId] = amount;
        } else {
          // Diminishing returns when the same good arrives from multiple sources
          if (amount > current) goodsPull[goodId] = amount + current / this.COLLECTION_DIVISOR;
          else goodsPull[goodId] = current + amount / this.COLLECTION_DIVISOR;
        }
      };

      const budget = Math.max(1, Math.floor(population));

      // Snapshot market prices before this burg's production shifts them
      const pricesAtStart = {
        buy: currentBuyPrice.slice(),
        sell: currentSellPrice.slice()
      };
      const floodFillStart = TIME ? performance.now() : 0;
      const cellsReached = this.floodFillCells(burg, budget, cellPool, addGood);
      if (TIME) floodFillMs += performance.now() - floodFillStart;

      // ── Phase C: bounded lookahead planner (see production_schema.md) ─────────────
      // Each worker tick asks: what can this burg still finish with its remaining workers?
      // The planner explores a short action tree and picks the first move of the best
      // reachable plan, instead of following a global speculative chain heuristic.
      const goodsPullData: BurgProductionData["goodsPull"] = [];

      for (const goodIdStr in goodsPull) {
        const goodId = +goodIdStr;
        const good = goodById.get(goodId);
        if (!good) continue;
        const rawPull = goodsPull[goodId];
        // Queue ordered by actual extraction payoff (good.value), NOT chainValue.
        // chainValue is speculative future profit from chains the burg may never complete;
        // the manufacture candidate loop handles chain decisions correctly when feasible.
        // chainValue is kept in goodsPullData for display only.
        const cultureModifier = good.culture[type] || 1;
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

        const planningStart = TIME ? performance.now() : 0;
        const plan = this.planBestAction({
          goods,
          goodById,
          cultureType: type,
          inventory,
          remainingPool,
          globalMarket,
          currentBuyPrice,
          currentSellPrice,
          workersLeft,
          depth: Math.min(this.PLAN_LOOKAHEAD_DEPTH, Math.ceil(workersLeft))
        });
        if (TIME) planningMs += performance.now() - planningStart;

        if (!plan.action) break;

        if (plan.action.kind === "manufacture") {
          const {good, entries, maxYield, projectedGain} = plan.action;
          const actualYield = Math.min(fraction, maxYield);
          const cultureModifier = good.culture[type] || 1;
          const produced = actualYield * cultureModifier;
          const recipeLog: Array<{
            goodId: number;
            fromInventory: number;
            fromMarket: number;
            marketCost: number;
          }> = [];

          for (const [ingIdStr, neededPerUnit] of entries) {
            const ingId = +ingIdStr;
            const amountNeeded = actualYield * neededPerUnit;
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
          const {goodId, projectedGain} = plan.action;
          const extract = Math.min(fraction, remainingPool[goodId] || 0);
          remainingPool[goodId] = Math.max(0, (remainingPool[goodId] || 0) - extract);

          const good = goodById.get(goodId)!;
          const cultureModifier = good.culture[type] || 1;
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

      // ── Phase D: revenue + global market fill ─────────────────────────────
      // All goods in inventory go to globalMarket. sellPrice falls on supply.
      // burg.wealth accumulates net revenue. burg.produced stores 2dp amounts.
      const marketStart = TIME ? performance.now() : 0;
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
      if (TIME) marketMs += performance.now() - marketStart;

      this._lastProductionData.set(burg.i!, {
        population,
        processRank: burgRank,
        totalBurgs: validBurgs.length,
        cellsBudget: budget,
        cellsReached,
        cultureType: type,
        goodsPull: goodsPullData,
        jobs: jobsData,
        finalInventory: {...inventory}, // raw values before rounding
        pricesAtStart,
        phaseRevenue,
        wealthAfter: burg.wealth
      });
    }

    // Persist final market prices on goods so the UI can display them
    for (const good of goods) {
      good.buyPrice = +currentBuyPrice[good.i].toFixed(2);
      good.sellPrice = +currentSellPrice[good.i].toFixed(2);
    }

    if (TIME) {
      console.info(
        `generateProduction: floodFill=${floodFillMs.toFixed(1)}ms, planning=${planningMs.toFixed(1)}ms, market=${marketMs.toFixed(1)}ms`
      );
      console.timeEnd("generateProduction");
    }
  }

  // ─── Phase A helpers ─────────────────────────────────────────────────────────

  /**
   * Build a per-cell available-goods pool shared by all burgs.
   * Burg flood-fill zeroes pool entries as cells are claimed, enforcing scarcity.
   */
  private buildCellPool(goods: Good[]): Record<number, number>[] {
    const {cells} = pack;
    const biomeGoods = this.getBiomesProduction(goods);
    const cellPool: Record<number, number>[] = Array.from({length: cells.i.length}, () => ({}));

    for (const cellId of cells.i) {
      const goodId = cells.good[cellId];
      if (goodId) {
        cellPool[cellId][goodId] = (cellPool[cellId][goodId] || 0) + this.BONUS_PRODUCTION;
      }

      const biomeId = cells.biome[cellId];
      for (const {goodId, production} of biomeGoods[biomeId] ?? []) {
        cellPool[cellId][goodId] = (cellPool[cellId][goodId] || 0) + production;
      }
    }

    return cellPool;
  }

  /**
   * Propagate manufactured-good profit back to raw ingredient chain values.
   * Raw goods feeding profitable chains rank higher in the Pass 1 priority queue.
   * Returns chainValue[goodId] >= good.value for all goods.
   */
  private buildChainValues(goods: Good[]): number[] {
    // Index by good.i (not array position) — pack.goods is shuffled during generation
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

  /**
   * Initialise per-good dynamic price arrays and pre-calculate pressure constants.
   * Prices persist across the burg loop so early burgs' production influences later ones.
   */
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

  // ─── Phase B helper ──────────────────────────────────────────────────────────

  /**
   * Dijkstra flood-fill from burg.cell, visiting up to `budget` cells.
   * Cross-province and cross-state movement is penalised to model trade friction.
   * Water cells are always cheap to traverse (sea/river trade routes).
   */
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

  private planBestAction(params: {
    goods: Good[];
    goodById: Map<number, Good>;
    cultureType: string;
    inventory: Record<number, number>;
    remainingPool: Record<number, number>;
    globalMarket: Record<number, number>;
    currentBuyPrice: number[];
    currentSellPrice: number[];
    workersLeft: number;
    depth: number;
  }): {value: number; action: PlannedAction | null} {
    const baselineValue = this.getInventoryLiquidationValue(params.inventory, params.currentSellPrice);
    if (params.depth <= 0 || params.workersLeft <= 0) return {value: baselineValue, action: null};

    const fraction = Math.min(1, params.workersLeft);
    const candidates = this.getPlannedCandidates({...params, fraction});
    let bestValue = baselineValue;
    let bestAction: PlannedAction | null = null;

    for (const candidate of candidates) {
      const nextInventory = {...params.inventory};
      const nextPool = {...params.remainingPool};
      const nextMarket = {...params.globalMarket};
      let cashDelta = 0;

      if (candidate.kind === "extract") {
        const good = params.goodById.get(candidate.goodId)!;
        const cultureModifier = this.getCultureModifier(good, params.cultureType);
        const extract = Math.min(fraction, nextPool[candidate.goodId] || 0);
        nextPool[candidate.goodId] = Math.max(0, (nextPool[candidate.goodId] || 0) - extract);
        nextInventory[candidate.goodId] = (nextInventory[candidate.goodId] || 0) + extract * cultureModifier;
      } else {
        const cultureModifier = this.getCultureModifier(candidate.good, params.cultureType);
        const actualYield = Math.min(fraction, candidate.maxYield);
        for (const [ingIdStr, neededPerUnit] of candidate.entries) {
          const ingId = +ingIdStr;
          const amountNeeded = actualYield * neededPerUnit;
          const fromInventory = Math.min(nextInventory[ingId] || 0, amountNeeded);
          const fromMarket = Math.max(0, amountNeeded - fromInventory);
          nextInventory[ingId] = Math.max(0, (nextInventory[ingId] || 0) - fromInventory);
          if (fromMarket > 0) {
            const actualBuy = Math.min(fromMarket, nextMarket[ingId] || 0);
            nextMarket[ingId] = Math.max(0, (nextMarket[ingId] || 0) - actualBuy);
            cashDelta -= actualBuy * params.currentBuyPrice[ingId];
          }
        }
        nextInventory[candidate.good.i] = (nextInventory[candidate.good.i] || 0) + actualYield * cultureModifier;
      }

      const continuation = this.planBestAction({
        ...params,
        inventory: nextInventory,
        remainingPool: nextPool,
        globalMarket: nextMarket,
        workersLeft: Math.max(0, params.workersLeft - fraction),
        depth: params.depth - 1
      });
      const totalValue = cashDelta + continuation.value;

      if (totalValue > bestValue + 0.001) {
        bestValue = totalValue;
        bestAction = {
          ...candidate,
          projectedGain: totalValue - baselineValue
        };
      }
    }

    return {value: bestValue, action: bestAction};
  }

  private getPlannedCandidates(params: {
    goods: Good[];
    goodById: Map<number, Good>;
    cultureType: string;
    inventory: Record<number, number>;
    remainingPool: Record<number, number>;
    globalMarket: Record<number, number>;
    currentBuyPrice: number[];
    currentSellPrice: number[];
    fraction: number;
  }): PlannedAction[] {
    const extractCandidates: PlannedAction[] = Object.entries(params.remainingPool)
      .filter(([, amount]) => amount > 0)
      .map(([goodIdStr]) => {
        const goodId = +goodIdStr;
        const good = params.goodById.get(goodId)!;
        return {
          kind: "extract" as const,
          goodId,
          projectedGain: good.value * this.getCultureModifier(good, params.cultureType)
        };
      })
      .sort((a, b) => b.projectedGain - a.projectedGain)
      .slice(0, this.PLAN_MAX_EXTRACT_CANDIDATES);

    const manufactureCandidates: PlannedAction[] = [];
    for (const good of params.goods) {
      if (!good.recipes?.length) continue;
      const cultureModifier = this.getCultureModifier(good, params.cultureType);
      const revenue = params.currentSellPrice[good.i] * cultureModifier;

      for (const recipe of good.recipes) {
        const entries = Object.entries(recipe) as [string, number][];
        if (!entries.length) continue;

        let ingredientCost = 0;
        let maxYield = Infinity;
        let feasible = true;

        for (const [ingIdStr, neededPerUnit] of entries) {
          const ingId = +ingIdStr;
          ingredientCost += neededPerUnit * params.currentBuyPrice[ingId];
          const totalAvailable = (params.inventory[ingId] || 0) + (params.globalMarket[ingId] || 0);
          if (totalAvailable < neededPerUnit * params.fraction) {
            feasible = false;
            break;
          }
          maxYield = Math.min(maxYield, totalAvailable / neededPerUnit);
        }

        if (!feasible || !Number.isFinite(maxYield) || maxYield <= 0) continue;
        manufactureCandidates.push({
          kind: "manufacture",
          good,
          entries,
          maxYield,
          projectedGain: revenue - ingredientCost
        });
      }
    }

    manufactureCandidates.sort((a, b) => b.projectedGain - a.projectedGain);
    return extractCandidates.concat(manufactureCandidates.slice(0, this.PLAN_MAX_MANUFACTURE_CANDIDATES));
  }

  private getInventoryLiquidationValue(inventory: Record<number, number>, currentSellPrice: number[]) {
    let total = 0;
    for (const goodIdStr in inventory) {
      const goodId = +goodIdStr;
      total += (inventory[goodId] || 0) * currentSellPrice[goodId];
    }
    return total;
  }

  private getCultureModifier(good: Good, cultureType: string) {
    return good.culture[cultureType as CultureType] || 1;
  }

  getProductionData(burgId: number): BurgProductionData | undefined {
    return this._lastProductionData.get(burgId);
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
      entries: [string, number][];
      maxYield: number;
      projectedGain: number;
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
    pull: number; // raw units from flood-fill
    chainValue: number; // value elevated by downstream chains
    priority: number; // initial queue key
  }>;
  // One entry per worker tick, in order
  jobs: Array<
    | {
        kind: "extract";
        tick: number;
        goodId: number;
        units: number; // output after culture modifier
        cultureModifier: number;
        projectedGain?: number; // bounded-lookahead gain over current state
      }
    | {
        kind: "manufacture";
        tick: number;
        goodId: number;
        units: number; // output after culture modifier
        cultureModifier: number;
        recipe: Array<{
          goodId: number;
          fromInventory: number; // units sourced from own inventory
          fromMarket: number; // units bought from globalMarket
          marketCost: number; // wealth spent on market purchase
        }>;
        score: number; // bounded-lookahead gain over current state
      }
  >;
  finalInventory: Record<number, number>; // raw (un-rounded) values
  pricesAtStart: {buy: number[]; sell: number[]};
  phaseRevenue: number; // gross revenue from selling inventory to globalMarket
  wealthAfter: number; // burg.wealth after this production run
}

declare global {
  var Production: ProductionModule;
}

window.Production = new ProductionModule();
