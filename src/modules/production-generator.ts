import Alea from "alea";
import type {Burg} from "./burgs-generator";
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

  // per-burg priority jitter amplitude (±PRIORITY_JITTER/2)
  private readonly PRIORITY_JITTER = 0.2;

  private _lastProductionData = new Map<number, BurgProductionData>();
  produce() {
    const {burgs} = pack;
    const goods = pack.goods;

    // Phase A: pre-computation (runs once, shared across all burgs)
    // Build id→Good map; pack.goods is shuffled during generation so array-position access is wrong
    const goodById = new Map<number, Good>(goods.map(g => [g.i, g]));
    const cellPool = this.buildCellPool(goods);
    const chainValue = this.buildChainValues(goods);
    const {currentBuyPrice, currentSellPrice, buyPressure, sellPressure, priceFloor, priceCeiling} =
      this.buildPriceArrays(goods);

    // globalMarket: goods produced/sold by burgs accumulate here so later burgs can buy them.
    // Starts empty; filled in Phase D of each burg (smallest first = poorest first).
    const globalMarket: Record<number, number> = {};

    // start from smallest burgs
    const validBurgs = burgs.filter(b => (b as Burg).i && !(b as Burg).removed) as Burg[];
    validBurgs.sort((a, b) => (a.population || 0) - (b.population || 0));

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
      const pricesAtStart = {buy: currentBuyPrice.slice(), sell: currentSellPrice.slice()};
      const cellsReached = this.floodFillCells(burg, budget, cellPool, addGood);

      // ── Phase C: single-priority production loop (see production_schema.md) ────────
      // Every worker tick builds a candidate list of all feasible actions and executes
      // the one with the highest score. Three action kinds compete on equal footing:
      //
      //   Extract raw          score = chainValue[X] × cultureMod
      //   Manufacture (inv)    score = sellPrice[out] × cultureMod − Σ(needed × buyPrice)
      //   Buy-then-Manufacture score = same formula (buying sourced from globalMarket)
      //
      // No hard constraints other than availability. A burg buys from the market whenever
      // doing so enables a higher score than any raw extraction available.

      // Seed the raw-queue (used only for ordering, not hard-gating)
      interface RawItem {
        goodId: number;
        basePriority: number;
        priority: number;
      }
      const rawItems: RawItem[] = [];
      const rawQueue = new FlatQueue();
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
        rawItems.push({goodId, basePriority, priority});
        rawQueue.push(rawItems.length - 1, -priority);
        goodsPullData.push({goodId, pull: rawPull, chainValue: chainValue[goodId] ?? good.value, priority});
      }
      goodsPullData.sort((a, b) => b.priority - a.priority);

      const remainingPool: Record<number, number> = {...goodsPull};
      const inventory: Record<number, number> = {};
      const jobsData: BurgProductionData["jobs"] = [];
      let workersUsed = 0;

      for (let i = 0; i < Math.ceil(population); i++) {
        const fraction = Math.min(1, population - i);
        if (fraction <= 0) break;

        // ── Candidate 1: best extract action ──────────────────────────────────
        // Advance the queue past exhausted goods
        while (rawQueue.length) {
          const idx = rawQueue.peek();
          if ((remainingPool[rawItems[idx].goodId] ?? 0) > 0) break;
          rawQueue.pop();
        }

        let bestExtractScore = -Infinity;
        let bestExtractId = -1;
        let bestExtractItem: RawItem | undefined;
        if (rawQueue.length) {
          const item = rawItems[rawQueue.peek()];
          const good = goodById.get(item.goodId)!;
          // Score = base sell value × culture modifier — what the burg actually earns
          // from extracting and selling this raw good. No chain speculation here;
          // chain profit is accounted for in the manufacture candidate score.
          bestExtractScore = good.value * (good.culture[type] || 1);
          bestExtractId = item.goodId;
          bestExtractItem = item;
        }

        // ── Candidates 2 & 3: manufacture (from inventory or market) ─────────
        // score = sellPrice[out] × cultureMod − Σ(needed[ing] × buyPrice[ing])
        // Ingredients already in inventory have the same opportunity cost as buying,
        // so the formula is identical regardless of source.
        interface MfgCandidate {
          good: Good;
          entries: [string, number][];
          score: number;
          maxYield: number; // limited by (inventory + market) availability
          needsBuy: boolean; // true if any ingredient comes from globalMarket
        }

        let bestMfg: MfgCandidate | null = null;

        for (const good of goods) {
          if (!good.recipes?.length) continue;
          const cultureModifier = good.culture[type] || 1;
          const revenue = currentSellPrice[good.i] * cultureModifier;

          for (const recipe of good.recipes) {
            const entries = Object.entries(recipe) as [string, number][];
            if (!entries.length) continue;

            let ingredientCost = 0;
            let maxYield = Infinity;
            let needsBuy = false;
            let feasible = true;

            for (const [ingIdStr, neededPerUnit] of entries) {
              const ingId = +ingIdStr;
              const bp = currentBuyPrice[ingId];
              ingredientCost += neededPerUnit * bp;

              const inInv = inventory[ingId] || 0;
              const inMkt = globalMarket[ingId] || 0;
              const totalAvail = inInv + inMkt;

              if (totalAvail <= 0) {
                feasible = false;
                break;
              }
              maxYield = Math.min(maxYield, totalAvail / neededPerUnit);
              if (inInv < neededPerUnit * fraction) needsBuy = true;
            }

            if (!feasible || !Number.isFinite(maxYield) || maxYield <= 0) continue;

            const score = revenue - ingredientCost;
            if (score <= 0) continue;

            if (!bestMfg || score > bestMfg.score) {
              bestMfg = {good, entries, score, maxYield, needsBuy};
            }
          }
        }

        // ── Decision: highest score wins ─────────────────────────────────────
        const mfgScore = bestMfg?.score ?? -Infinity;

        if (bestExtractScore <= -Infinity && mfgScore <= -Infinity) break; // nothing to do

        if (bestMfg && mfgScore >= bestExtractScore) {
          // ── Execute: (buy-then-)manufacture ──────────────────────────────
          const {good, entries, score, maxYield} = bestMfg;
          const actualYield = Math.min(fraction, maxYield);
          const cultureModifier = good.culture[type] || 1;
          const produced = actualYield * cultureModifier;

          const recipeLog: Array<{goodId: number; fromInventory: number; fromMarket: number; marketCost: number}> = [];

          for (const [ingIdStr, neededPerUnit] of entries) {
            const ingId = +ingIdStr;
            const amtNeeded = actualYield * neededPerUnit;
            const fromInv = Math.min(inventory[ingId] || 0, amtNeeded);
            const fromMkt = amtNeeded - fromInv;

            inventory[ingId] = Math.max(0, (inventory[ingId] || 0) - fromInv);

            let marketCost = 0;
            if (fromMkt > 0) {
              const actualBuy = Math.min(fromMkt, globalMarket[ingId] || 0);
              globalMarket[ingId] = (globalMarket[ingId] || 0) - actualBuy;
              marketCost = actualBuy * currentBuyPrice[ingId];
              burg.wealth = (burg.wealth || 0) - marketCost;
              currentBuyPrice[ingId] = Math.min(
                priceCeiling[ingId],
                currentBuyPrice[ingId] + actualBuy * buyPressure[ingId]
              );
            }

            recipeLog.push({goodId: ingId, fromInventory: fromInv, fromMarket: fromMkt, marketCost});
          }

          inventory[good.i] = (inventory[good.i] || 0) + produced;

          jobsData.push({
            kind: "manufacture",
            tick: workersUsed + fraction,
            goodId: good.i,
            units: produced,
            cultureModifier,
            recipe: recipeLog,
            score
          });
        } else {
          // ── Execute: extract raw ──────────────────────────────────────────
          rawQueue.pop();
          const goodId = bestExtractId;
          const extract = Math.min(fraction, remainingPool[goodId]);
          remainingPool[goodId] -= extract;

          const good = goodById.get(goodId)!;
          const cultureModifier = good.culture[type] || 1;
          const produced = extract * cultureModifier;
          inventory[goodId] = (inventory[goodId] || 0) + produced;

          currentBuyPrice[goodId] = Math.min(
            priceCeiling[goodId],
            currentBuyPrice[goodId] + produced * buyPressure[goodId]
          );

          jobsData.push({kind: "extract", tick: workersUsed + fraction, goodId, units: produced, cultureModifier});

          // Re-queue with halved priority if pool still has supply
          if (remainingPool[goodId] > 0) {
            const basePriority = bestExtractItem!.basePriority / 2;
            const jitter = 1 - this.PRIORITY_JITTER / 2 + burgRng() * this.PRIORITY_JITTER;
            const priority = basePriority * jitter;
            rawItems.push({...bestExtractItem!, basePriority, priority});
            rawQueue.push(rawItems.length - 1, -priority);
          }
        }

        workersUsed += fraction;
      }

      // ── Phase D: revenue + global market fill ─────────────────────────────
      // All goods in inventory go to globalMarket. sellPrice falls on supply.
      // burg.wealth accumulates net revenue. burg.produced stores 2dp amounts.
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

  getProductionData(burgId: number): BurgProductionData | undefined {
    return this._lastProductionData.get(burgId);
  }
}

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
        score: number; // sellPrice×cultureMod − Σ(needed×buyPrice)
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
