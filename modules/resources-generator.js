(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.Resources = factory());
}(this, (function () {'use strict';

  // TO-DO
  // apply logic on heightmap edit
  // apply logic on burgs regenearation
  // apply logic on population recalculation

  let cells;

  const getDefault = function() {
    // spread: percentage of eligible cells to get a resource
    // model: cells eligibility model
    return [
      {i: 1, name: "Wood", value: 5, spread: 2, model: "forestAndTaiga", bonus: {fleet: 2, defence: 1}},
      {i: 2, name: "Stone", value: 4, spread: .3, model: "hills", bonus: {prestige: 1, defence: 2}},
      {i: 3, name: "Marble", value: 15, spread: .05, model: "mountains", bonus: {prestige: 2}},
      {i: 4, name: "Iron", value: 8, spread: .12, model: "mountainsAndWetland", bonus: {artillery: 1, infantry: 1, defence: 1}},
      {i: 5, name: "Copper", value: 10, spread: .06, model: "mountains", bonus: {artillery: 2, defence: 1, prestige: 1}},
      {i: 6, name: "Lead", value: 8, spread: .04, model: "mountains", bonus: {artillery: 1, defence: 1}},
      {i: 7, name: "Silver", value: 15, spread: .04, model: "mountains", bonus: {prestige: 2}},
      {i: 8, name: "Gold", value: 30, spread: .02, model: "UpperRivers", bonus: {prestige: 3}},
      {i: 9, name: "Grain", value: 1, spread: 3, model: "habitability", bonus: {population: 4, comfort: 1}},
      {i: 10, name: "Livestock", value: 2, spread: 2, model: "pasturesAndTemperateForest", bonus: {population: 2, comfort: 1}},
      {i: 11, name: "Fish", value: 1, spread: 1.2, model: "water", bonus: {population: 2, comfort: 1}},
    ]
    // Savanna, Grassland Deciduous forest
  }

  const chance = v => {
    if (v < .1) return false;
    if (v > 99.9) return true;
    return v / 100 > Math.random();
  }

  const models = {
    forestAndTaiga: i => [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0][cells.biome[i]],
    hills: i => cells.h[i] >= 40,
    mountains: i => cells.h[i] >= 60 || (cells.h[i] >= 40 && P(.1)),
    mountainsAndWetland: i => cells.h[i] >= 60 || (cells.biome[i] === 12 && P(.1)),
    UpperRivers: i => cells.h[i] >= 40 && cells.r[i],
    habitability: i => chance(biomesData.habitability[cells.biome[i]]),
    water: i => cells.h[i] < 20 || cells.r[i],
    pasturesAndTemperateForest: i => chance([0, 0, 0, 100, 100, 20, 100, 0, 0, 0, 0, 0, 0][cells.biome[i]]),
  }

  // Biomes: 0: Marine, 1: Hot desert, 2: Cold desert, 3: Savanna, 4: Grassland,
  //         5: Tropical seasonal forest, 6: Temperate deciduous forest, 7: Tropical rainforest,
  //         8: Temperate rainforest, 9: Taiga, 10: Tundra, 11: Glacier, 12: Wetland

  const generate = function() {
    cells = pack.cells;
    const cellsN = cells.i.length;
    const cellsP = cellsN / 100; // 1% of all cells
    cells.resource = new Uint8Array(cellsN); // resources array [0, 255]

    pack.resources = getDefault().map(resource => {
      const expected = cellsP * resource.spread;
      resource.max = gauss(expected, expected / 2, expected / 5, cellsN, 0);
      resource.cells = 0;
      return resource;
    });

    const shuffledCells = d3.shuffle(cells.i.slice());
    for (const i of shuffledCells) {
      if (!(i%10)) d3.shuffle(pack.resources);

      for (const resource of pack.resources) {
        if (!resource.i) continue;
        if (resource.cells >= resource.max) continue;
        if (!models[resource.model](i)) continue;

        cells.resource[i] = resource.i;
        resource.cells += 1;
        break;
      }

    }

    console.table(pack.resources);
  }

  const draw = function() {
    let resourcesHTML = "";
    for (const i of cells.i) {
      if (!cells.resource[i]) continue;
      const resource = pack.resources.find(resource => resource.i === cells.resource[i]);
      const [x, y] = cells.p[i];
      resourcesHTML += `<use href="#resource-${resource.i}" x="${x-3}" y="${y-3}" width="6" height="6"/>`;
    }

    goods.html(resourcesHTML);
  }

return {generate, getDefault, draw};

})));
