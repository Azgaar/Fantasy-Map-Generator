declare global {
  var Production: ProductionModule;
}

export class ProductionModule {
  private readonly BONUS_PRODUCTION = 4;
  private readonly BIOME_PRODUCTION = [
    [{resource: 11, production: 0.75}], // marine: fish
    [{resource: 2, production: 0.5}], // hot desert: stone
    [{resource: 2, production: 0.5}], // cold desert: stone
    [
      {resource: 12, production: 0.4},
      {resource: 10, production: 0.4}
    ], // savanna: game 0.75, cattle 0.75
    [{resource: 10, production: 0.5}], // grassland: cattle
    [{resource: 9, production: 0.5}], // tropical seasonal forest: grain
    [
      {resource: 9, production: 0.5},
      {resource: 1, production: 0.5}
    ], // temperate deciduous forest: grain, wood
    [
      {resource: 9, production: 0.5},
      {resource: 1, production: 0.5}
    ], // tropical rainforest: grain, wood
    [
      {resource: 9, production: 0.5},
      {resource: 1, production: 0.5}
    ], // temperate rainforest: grain, wood
    [
      {resource: 1, production: 0.5},
      {resource: 12, production: 0.4}
    ], // taiga: wood, game
    [{resource: 29, production: 0.5}], // tundra: furs
    [], // glacier: nothing
    [
      {resource: 4, production: 0.4},
      {resource: 12, production: 0.4}
    ] // wetland: iron, game
  ];

  private readonly RIVER_PRODUCTION = [{resource: 11, production: 0.5}]; // fish
  private readonly HILLS_PRODUCTION = [{resource: 34, production: 0.5}]; // coal
  private readonly FOOD_MULTIPLIER = 3;

  collectGoods() {
    const {cells, burgs} = pack;

    for (const burg of burgs) {
      if (!burg.i || burg.removed) continue;

      const cell = burg.cell;
      const type = burg.type || "Generic";
      const population = burg.population || 0;

      const goodsPull: Record<number, number> = {};
      const addResource = (resourceId: number, production: number) => {
        const currentProd = goodsPull[resourceId] || 0;
        if (!currentProd) {
          goodsPull[resourceId] = production;
        } else {
          if (production > currentProd) goodsPull[resourceId] = production + currentProd / 3;
          else goodsPull[resourceId] = currentProd + production / 3;
        }
      };

      const cellsInArea = cells.c[cell].concat([cell]);
      for (const cellId of cellsInArea) {
        const good = cells.good[cellId];
        if (good) addResource(good, this.BONUS_PRODUCTION);
        this.BIOME_PRODUCTION[cells.biome[cellId]].forEach(({resource, production}) =>
          addResource(resource, production)
        );
        if (cells.r[cellId]) {
          this.RIVER_PRODUCTION.forEach(({resource, production}) => addResource(resource, production));
        }
        if (cells.h[cellId] >= 50) {
          this.HILLS_PRODUCTION.forEach(({resource, production}) => addResource(resource, production));
        }
      }

      interface Item {
        resourceId: number;
        basePriority: number;
        priority: number;
        production: number;
        isFood: boolean;
      }

      const items: Item[] = [];
      const queue = new FlatQueue();
      for (const resourceId in goodsPull) {
        const baseProduction = goodsPull[resourceId];
        const resource = Goods.get(+resourceId);

        const cultureModifier = resource?.culture[type] || 1;
        const production = baseProduction * cultureModifier;

        const {value, category} = resource!;
        const isFood = category === "Food";

        const basePriority = production * value;
        const priority = basePriority * (isFood ? this.FOOD_MULTIPLIER : 1);
        items.push({resourceId: +resourceId, basePriority, priority, production, isFood});
        queue.push(items.length - 1, -priority); // negate: FlatQueue is min-heap, we want max
      }

      let foodProduced = 0;
      const productionPull: Record<number, number> = {};
      const addProduction = (resourceId: number, production: number) => {
        if (!productionPull[resourceId]) productionPull[resourceId] = production;
        else productionPull[resourceId] += production;
      };

      for (let i = 0; i < population; i++) {
        const idx = queue.pop();
        if (idx === undefined) break;
        const occupation = items[idx];
        const {resourceId, production, basePriority, isFood} = occupation;
        addProduction(resourceId, production);
        if (isFood) foodProduced += production;

        const foodModifier = isFood && foodProduced < population ? this.FOOD_MULTIPLIER : 1;
        const newBasePriority = basePriority / 2;
        const newPriority = newBasePriority * foodModifier;

        items.push({...occupation, basePriority: newBasePriority, priority: newPriority});
        queue.push(items.length - 1, -newPriority);
      }

      burg.produced = {};
      for (const resourceId in productionPull) {
        const production = productionPull[resourceId];
        burg.produced[resourceId] = Math.ceil(production);
      }
    }
  }
}

window.Production = new ProductionModule();
