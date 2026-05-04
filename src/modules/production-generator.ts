import Alea from "alea";
import type {Burg} from "./burgs-generator";
import {DEFAULT_CULTURE_TYPE} from "./cultures-generator";
import type {Good} from "./goods-generator";

declare global {
  var Production: ProductionModule;
}

export class ProductionModule {
  // existing
  private readonly BONUS_PRODUCTION = 4;
  private readonly FOOD_MULTIPLIER = 3;
  private readonly COLLECTION_DIVISOR = 3;

  // flood-fill traversal penalties
  private readonly PROVINCE_PENALTY = 3;
  private readonly STATE_PENALTY = 15;

  // dynamic pricing — raise buy price when raw good is extracted, lower sell price when manufactured
  private readonly BUY_PRESSURE_FACTOR = 0.01;
  private readonly SELL_PRESSURE_FACTOR = 0.006;
  private readonly PRICE_FLOOR_FACTOR = 0.3;
  private readonly PRICE_CEILING_FACTOR = 5.0;

  // iterative chain-value propagation
  private readonly CHAIN_MAX_ITERATIONS = 10;

  // per-burg priority jitter amplitude (±PRIORITY_JITTER/2)
  private readonly PRIORITY_JITTER = 0.2;

  // safety cap on manufacturing while-loop depth
  private readonly MAX_MFG_ITERATIONS = 20;

  produce() {
    const {burgs} = pack;
    const goods = pack.goods;

    // Phase A: pre-computation (runs once, shared across all burgs)
    const cellPool = this.buildCellPool(goods);
    const chainValue = this.buildChainValues(goods);
    const {currentBuyPrice, currentSellPrice, buyPressure, sellPressure, priceFloor, priceCeiling} =
      this.buildPriceArrays(goods);

    // Largest cities claim shared resources first and set prices for smaller settlements
    const validBurgs = burgs.filter(b => (b as Burg).i && !(b as Burg).removed) as Burg[];
    validBurgs.sort((a, b) => (b.population || 0) - (a.population || 0));

    for (const burg of validBurgs) {
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
      this.floodFillCells(burg, budget, cellPool, addGood);

      // Phase C, Pass 1: raw goods priority queue
      // Priorities use chainValue so raw goods feeding profitable chains rank higher
      // than their face value alone; ±jitter ensures burgs with identical geography diverge
      interface Item {
        goodId: number;
        basePriority: number;
        priority: number;
        production: number;
        isFood: boolean;
      }

      const items: Item[] = [];
      const rawQueue = new FlatQueue();

      for (const goodIdStr in goodsPull) {
        const goodId = +goodIdStr;
        const good = goods[goodId];
        if (!good) continue;

        const cultureModifier = good.culture[type] || 1;
        const production = goodsPull[goodId] * cultureModifier;
        const isFood = good.tags.some(tag => tag.toLowerCase() === "food");

        const basePriority = production * chainValue[goodId];
        const jitter = 1 - this.PRIORITY_JITTER / 2 + burgRng() * this.PRIORITY_JITTER;
        const priority = basePriority * (isFood ? this.FOOD_MULTIPLIER : 1) * jitter;

        items.push({goodId, basePriority, priority, production, isFood});
        rawQueue.push(items.length - 1, -priority); // negate: FlatQueue is min-heap
      }

      let foodProduced = 0;
      const inventory: Record<number, number> = {};

      for (let i = 0; i < population; i++) {
        const idx = rawQueue.pop();
        if (idx === undefined) break;

        const occupation = items[idx];
        const {goodId, production, isFood} = occupation;

        inventory[goodId] = (inventory[goodId] || 0) + production;
        if (isFood) foodProduced += production;

        // Raise buy price incrementally; later burgs see this good as more expensive
        currentBuyPrice[goodId] = Math.max(
          priceFloor[goodId],
          Math.min(currentBuyPrice[goodId] + production * buyPressure[goodId], priceCeiling[goodId])
        );

        const foodBoost = isFood && foodProduced < population ? this.FOOD_MULTIPLIER : 1;
        const basePriority = occupation.basePriority / 2;
        const jitter = 1 - this.PRIORITY_JITTER / 2 + burgRng() * this.PRIORITY_JITTER;
        const priority = basePriority * foodBoost * jitter;

        items.push({...occupation, basePriority, priority});
        rawQueue.push(items.length - 1, -priority);
      }

      // Phase C, Pass 2: manufacturing ordered by profit
      // Outer loop repeats until no more manufacturing is possible, which lets each
      // iteration unlock the next step of a multi-step chain (Sheep→Cloth→Garments).
      let mfgProgress = true;
      let mfgIter = 0;

      while (mfgProgress && mfgIter < this.MAX_MFG_ITERATIONS) {
        mfgProgress = false;
        mfgIter++;

        const candidates: {
          good: Good;
          recipe: Record<number, number>;
          profit: number;
          recipeYield: number;
        }[] = [];

        for (const good of goods) {
          if (!good.recipes?.length) continue;

          let bestRecipe: Record<number, number> | null = null;
          let bestProfit = 0;
          let bestYield = 0;

          for (const recipe of good.recipes) {
            const entries = Object.entries(recipe) as [string, number][];
            if (!entries.length) continue;

            const recipeYield = Math.min(...entries.map(([ingId, amount]) => (inventory[+ingId] || 0) / amount));
            if (!Number.isFinite(recipeYield) || recipeYield <= 0) continue;

            // Select recipe by profit, not by yield
            const recipeCost = entries.reduce((sum, [ingId, amount]) => sum + currentBuyPrice[+ingId] * amount, 0);
            const profit = currentSellPrice[good.i] - recipeCost;

            if (profit > bestProfit) {
              bestProfit = profit;
              bestRecipe = recipe;
              bestYield = recipeYield;
            }
          }

          if (!bestRecipe || bestYield <= 0) continue;
          candidates.push({
            good,
            recipe: bestRecipe,
            profit: bestProfit,
            recipeYield: bestYield
          });
        }

        candidates.sort((a, b) => b.profit - a.profit);

        for (const {good, recipe, recipeYield} of candidates) {
          const cultureModifier = good.culture[type] || 1;
          const producedAmount = recipeYield * cultureModifier;
          if (producedAmount <= 0) continue;

          for (const [ingIdStr, amount] of Object.entries(recipe)) {
            const ingId = +ingIdStr;
            inventory[ingId] = Math.max(0, (inventory[ingId] || 0) - recipeYield * amount);
          }

          inventory[good.i] = (inventory[good.i] || 0) + producedAmount;

          // Lower sell price as market is supplied; later burgs find this good less profitable
          currentSellPrice[good.i] = Math.max(
            priceFloor[good.i],
            currentSellPrice[good.i] - producedAmount * sellPressure[good.i]
          );

          mfgProgress = true;
        }
      }

      burg.produced = {};
      for (const goodId in inventory) {
        const amount = Math.floor(inventory[+goodId]);
        if (amount > 0) burg.produced[+goodId] = amount;
      }

      // debug
      console.log(`Burg ${burg.i}: ${burg.name} produced:`);
      for (const goodId in burg.produced) {
        const good = goods[+goodId];
        if (!good) continue;
        console.log(`  ${good.name}: ${burg.produced[+goodId]}`);
      }
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
    const biomeIndex = this.getBiomesProduction(goods);
    const cellPool: Record<number, number>[] = Array.from({length: cells.i.length}, () => ({}));

    for (const cellId of cells.i) {
      const goodId = cells.good[cellId];
      if (goodId) {
        cellPool[cellId][goodId] = (cellPool[cellId][goodId] || 0) + this.BONUS_PRODUCTION;
      }

      const biomeId = cells.biome[cellId];
      for (const {good, production} of biomeIndex[biomeId] ?? []) {
        cellPool[cellId][good] = (cellPool[cellId][good] || 0) + production;
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
    const chainValue = goods.map(g => g.value);

    for (let iter = 0; iter < this.CHAIN_MAX_ITERATIONS; iter++) {
      let changed = false;

      for (const good of goods) {
        if (!good.recipes?.length) continue;

        for (const recipe of good.recipes) {
          const entries = Object.entries(recipe) as [string, number][];
          if (!entries.length) continue;

          const recipeCost = entries.reduce((sum, [ingId, amount]) => sum + chainValue[+ingId] * amount, 0);
          const profit = good.value - recipeCost;
          if (profit <= 0) continue;

          const totalAmount = entries.reduce((sum, [, amount]) => sum + amount, 0);
          for (const [ingIdStr, amount] of entries) {
            const contribution = profit * (amount / totalAmount);
            if (contribution > 0.001) {
              chainValue[+ingIdStr] += contribution;
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
  ) {
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
  }

  // ─── Shared utility ──────────────────────────────────────────────────────────

  private getBiomesProduction(goods: Good[]) {
    const biomeProduction: {good: number; production: number}[][] = Array.from({length: biomesData.i.length}, () => []);

    for (const good of goods) {
      if (!good.biome) continue;

      for (const [biomeIdRaw, production] of Object.entries(good.biome)) {
        const biomeId = +biomeIdRaw;
        if (!production || production <= 0) continue;
        biomeProduction[biomeId].push({good: good.i, production});
      }
    }

    return biomeProduction;
  }
}

window.Production = new ProductionModule();
