'use strict';

window.Production = (function () {
  const BONUS_PRODUCTION = 4;
  const BIOME_PRODUCTION = [
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
  const RIVER_PRODUCTION = [{resource: 11, production: 0.5}]; // fish
  const HILLS_PRODUCTION = [{resource: 34, production: 0.5}]; // coal
  const FOOD_MULTIPLIER = 3;

  const collectResources = () => {
    const {cells, burgs} = pack;

    for (const burg of burgs) {
      if (!burg.i || burg.removed) continue;

      const {cell, type, population} = burg;

      const resourcesPull = {};
      const addResource = (resourceId, production) => {
        const currentProd = resourcesPull[resourceId] || 0;
        if (!currentProd) {
          resourcesPull[resourceId] = production;
        } else {
          if (production > currentProd) resourcesPull[resourceId] = production + currentProd / 3;
          else resourcesPull[resourceId] = currentProd + production / 3;
        }
      };

      const cellsInArea = cells.c[cell].concat([cell]);
      for (const cell of cellsInArea) {
        cells.resource[cell] && addResource(cells.resource[cell], BONUS_PRODUCTION);
        BIOME_PRODUCTION[cells.biome[cell]].forEach(({resource, production}) => addResource(resource, production));
        cells.r[cell] && RIVER_PRODUCTION.forEach(({resource, production}) => addResource(resource, production));
        cells.h[cell] >= 50 && HILLS_PRODUCTION.forEach(({resource, production}) => addResource(resource, production));
      }

      const queue = new PriorityQueue({comparator: (a, b) => b.priority - a.priority});
      for (const resourceId in resourcesPull) {
        const baseProduction = resourcesPull[resourceId];
        const resource = Resources.get(+resourceId);

        const cultureModifier = resource.culture[type] || 1;
        const production = baseProduction * cultureModifier;

        const {value, category} = resource;
        const isFood = category === 'Food';

        const basePriority = production * value;
        const priority = basePriority * (isFood ? FOOD_MULTIPLIER : 1);
        queue.queue({resourceId: +resourceId, basePriority, priority, production, isFood});
      }

      let foodProduced = 0;
      const productionPull = {};
      const addProduction = (resourceId, production) => {
        if (!productionPull[resourceId]) productionPull[resourceId] = production;
        else productionPull[resourceId] += production;
      };

      for (let i = 0; i < population; i++) {
        const occupation = queue.dequeue();
        const {resourceId, production, basePriority, isFood} = occupation;
        addProduction(resourceId, production);
        if (isFood) foodProduced += production;

        const foodModifier = isFood && foodProduced < population ? FOOD_MULTIPLIER : 1;
        const newBasePriority = basePriority / 2;
        const newPriority = newBasePriority * foodModifier;

        queue.queue({...occupation, basePriority: newBasePriority, priority: newPriority});
      }

      for (const resourceId in productionPull) {
        const production = Math.ceil(productionPull[resourceId]);
        productionPull[resourceId] = production;
      }
      burg.production = productionPull;
    }
  };

  const defineExport = () => {
    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed) continue;
      const {population, production: resourcePool} = burg;
      const localUsage = Math.ceil(population);

      const surplus = {};
      for (const resourceId in resourcePool) {
        const production = resourcePool[resourceId];
        const extraProduction = production - localUsage;
        if (extraProduction > 0) surplus[resourceId] = extraProduction;
      }

      burg.export = surplus;
    }
  };

  return {collectResources, defineExport};
})();
