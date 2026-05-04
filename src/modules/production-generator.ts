import {DEFAULT_CULTURE_TYPE} from "./cultures-generator";
import type {Good} from "./goods-generator";

declare global {
  var Production: ProductionModule;
}

export class ProductionModule {
  private readonly BONUS_PRODUCTION = 4;
  private readonly FOOD_MULTIPLIER = 3;
  private readonly COLLECTION_DIVISOR = 3;

  produce() {
    const {cells, burgs} = pack;
    const biomeProduction = this.getBiomesProduction(pack.goods);

    for (const burg of burgs) {
      if (!burg.i || burg.removed) continue;

      const cell = burg.cell;
      const type = burg.type || DEFAULT_CULTURE_TYPE;
      const population = burg.population || 0;

      const goodsPull: Record<number, number> = {};
      const addGood = (goodId: number, production: number) => {
        const currentProd = goodsPull[goodId] || 0;
        if (!currentProd) {
          goodsPull[goodId] = production;
        } else {
          if (production > currentProd) goodsPull[goodId] = production + currentProd / this.COLLECTION_DIVISOR;
          else goodsPull[goodId] = currentProd + production / this.COLLECTION_DIVISOR;
        }
      };

      const cellsInArea = cells.c[cell].concat([cell]);
      for (const cellId of cellsInArea) {
        const good = cells.good[cellId];
        if (good) addGood(good, this.BONUS_PRODUCTION);
        const biomeId = cells.biome[cellId];
        biomeProduction[biomeId].forEach(({good, production}) => void addGood(good, production));
      }

      interface Item {
        goodId: number;
        basePriority: number;
        priority: number;
        production: number;
        isFood: boolean;
      }

      const items: Item[] = [];
      const queue = new FlatQueue();
      for (const goodId in goodsPull) {
        const good = Goods.get(+goodId);
        if (!good) continue;

        const cultureModifier = good.culture[type] || 1;
        const production = goodsPull[good.i] * cultureModifier;

        const isFood = good.tags.some(tag => tag.toLocaleLowerCase() === "food");

        const basePriority = production * good.value;
        const priority = basePriority * (isFood ? this.FOOD_MULTIPLIER : 1);
        items.push({
          goodId: good.i,
          basePriority,
          priority,
          production,
          isFood
        });
        queue.push(items.length - 1, -priority); // FlatQueue is min-heap, we want max
      }

      let foodProduced = 0;
      const productionPull: Record<number, number> = {};
      const addProduction = (goodId: number, production: number) => {
        if (!productionPull[goodId]) productionPull[goodId] = production;
        else productionPull[goodId] += production;
      };

      // produce 1 unit of raw good per population point
      for (let i = 0; i < population; i++) {
        const idx = queue.pop();
        if (idx === undefined) break;

        const occupation = items[idx];
        const {goodId, production, isFood} = occupation;
        addProduction(goodId, production);
        if (isFood) foodProduced += production;

        const foodModifier = isFood && foodProduced < population ? this.FOOD_MULTIPLIER : 1;
        const basePriority = occupation.basePriority / 2;
        const priority = basePriority * foodModifier;

        items.push({...occupation, basePriority, priority});
        queue.push(items.length - 1, -priority);
      }

      // craft manufactured goods
      const inventory: Record<string, number> = {...productionPull};
      for (const good of pack.goods) {
        if (!good.recipes?.length) continue;

        let bestRecipe: (typeof good.recipes)[number] | null = null;
        let bestYield = 0;

        for (const recipe of good.recipes) {
          const entries = Object.entries(recipe) as [string, number][];
          if (!entries.length) continue;

          const recipeYieldByIngredient = entries.map(([ingredientId, ingredientAmount]) => {
            const available = inventory[ingredientId] || 0;
            return available / ingredientAmount;
          });
          const recipeYield = Math.min(...recipeYieldByIngredient);

          if (Number.isFinite(recipeYield) && recipeYield > bestYield) {
            bestYield = recipeYield;
            bestRecipe = recipe;
          }
        }

        if (!bestRecipe || bestYield <= 0) continue;

        const cultureModifier = good.culture[type] || 1;
        const producedAmount = bestYield * cultureModifier;
        if (producedAmount <= 0) continue;

        for (const [ingredientId, ingredientAmount] of Object.entries(bestRecipe)) {
          const id = +ingredientId;
          inventory[id] = Math.max(0, (inventory[id] || 0) - bestYield * ingredientAmount);
        }

        inventory[good.i] = (inventory[good.i] || 0) + producedAmount;
      }

      burg.produced = {};
      for (const goodId in inventory) {
        const production = Math.floor(inventory[goodId]);
        if (production > 0) burg.produced[+goodId] = production;
      }

      // debug
      console.log(`Burg ${burg.i}: ${burg.name} produced:`);
      for (const goodId in burg.produced) {
        const good = Goods.get(+goodId);
        if (!good) continue;
        const production = burg.produced[+goodId];
        console.log(`${good.name}: ${production}`);
      }
    }
  }

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
