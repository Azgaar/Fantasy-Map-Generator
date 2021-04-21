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
    // model: cells eligibility
    return [
      {i: 1, name: "Wood", value: 5, spread: 2, model: "forestAndTaiga", bonus: {fleet: 2, defence: 1}},
      {i: 2, name: "Stone", value: 4, spread: .7, model: "hills", bonus: {prestige: 1, defence: 2}},
      {i: 3, name: "Marble", value: 15, spread: .05, model: "mountains", bonus: {prestige: 2}},
      {i: 4, name: "Iron", value: 8, spread: .2, model: "mountainsAndRareWetland", bonus: {artillery: 1, infantry: 1, defence: 1}},
      {i: 5, name: "Copper", value: 10, spread: .1, model: "mountains", bonus: {artillery: 2, defence: 1, prestige: 1}},
      {i: 6, name: "Lead", value: 8, spread: .05, model: "mountains", bonus: {artillery: 1, defence: 1}},
      {i: 7, name: "Silver", value: 15, spread: .05, model: "mountains", bonus: {prestige: 2}},
      {i: 8, name: "Gold", value: 30, spread: .02, model: "upperRivers", bonus: {prestige: 3}},
      {i: 9, name: "Grain", value: 1, spread: 3, model: "habitability", bonus: {population: 4}},
      {i: 10, name: "Livestock", value: 2, spread: 1.8, model: "pasturesAndTemperateForest", bonus: {population: 2}},
      {i: 11, name: "Fish", value: 1, spread: 2.2, model: "waterAndRiver", bonus: {population: 2}},
      {i: 12, name: "Game", value: 2, spread: .2, model: "forestAndTaiga", bonus: {archers: 2, population: 1}},
      {i: 13, name: "Wine", value: 3, spread: .3, model: "tropics", bonus: {population: 1, prestige: 1}},
      {i: 14, name: "Olives", value: 3, spread: .3, model: "tropics", bonus: {population: 1}},
      {i: 15, name: "Honey", value: 4, spread: .16, model: "deciduousForestAndTaiga", bonus: {population: 1}},
      {i: 16, name: "Salt", value: 5, spread: .2, model: "aridLandAndLakes", bonus: {population: 1, defence: 1}},
      {i: 17, name: "Dates", value: 3, spread: .16, model: "desert", bonus: {population: 1}},
      {i: 18, name: "Horses", value: 10, spread: .3, model: "grasslandsAndColdDesert", bonus: {cavalry: 2}},
      {i: 19, name: "Elephant", value: 15, spread: .1, model: "savannaDesertTropicalForest", bonus: {cavalry: 1}},
      {i: 20, name: "Camels", value: 13, spread: .2, model: "desert", bonus: {cavalry: 1}},
      {i: 21, name: "Hemp", value: 2, spread: .4, model: "forest", bonus: {fleet: 2}},
      {i: 22, name: "Pearls", value: 35, spread: .16, model: "tropicalWater", bonus: {prestige: 1}},
      {i: 23, name: "Gemstones", value: 35, spread: .1, model: "mountains", bonus: {prestige: 1}},
      {i: 24, name: "Dyes", value: 15, spread: .2, model: "habitableOrWater", bonus: {prestige: 1}},
      {i: 25, name: "Incense", value: 25, spread: .1, model: "desertAndTropicalForest", bonus: {prestige: 2}},
      {i: 26, name: "Silk", value: 30, spread: .05, model: "tropicalForest", bonus: {prestige: 2}},
      {i: 27, name: "Spices", value: 30, spread: .08, model: "tropicalForest", bonus: {prestige: 2}},
    ]
  }

  const chance = v => {
    if (v < .1) return false;
    if (v > 99.9) return true;
    return v / 100 > Math.random();
  }

  const temp = i => grid.cells.temp[pack.cells.g[i]];
  const group = i => pack.features[cells.f[i]].group;

  const models = {
    forest: i => [6, 7, 8].includes(cells.biome[i]),
    forestAndTaiga: i => [5, 6, 7, 8, 9].includes(cells.biome[i]),
    deciduousForestAndTaiga: i => [6, 8, 9].includes(cells.biome[i]),
    hills: i => cells.h[i] >= 40,
    mountains: i => cells.h[i] >= 60 || (cells.h[i] >= 40 && P(.1)),
    mountainsAndRareWetland: i => cells.h[i] >= 60 || (cells.biome[i] === 12 && !(i%8)),
    upperRivers: i => cells.h[i] >= 40 && cells.r[i],
    habitability: i => chance(biomesData.habitability[cells.biome[i]]),
    waterAndRiver: i => cells.r[i] || (!(i%2) && (cells.h[i] < 20) && group(i) !== "dry"),
    pasturesAndTemperateForest: i => chance([0, 0, 0, 100, 100, 20, 80, 0, 0, 0, 0, 0, 0][cells.biome[i]]),
    tropics: i => [5, 7].includes(cells.biome[i]),
    aridLandAndLakes: i => chance([0, 80, 60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10][cells.biome[i]]) || group(i) === "salt" || group(i) === "dry",
    desert: i => cells.biome[i] === 1 || cells.biome[i] === 2,
    grasslandsAndColdDesert: i => cells.biome[i] === 3 || (!(i%4) && cells.biome[i] === 2),
    savannaDesertTropicalForest: i => [1, 3, 5, 7].includes(cells.biome[i]),
    desertAndTropicalForest: i => [1, 7].includes(cells.biome[i]),
    tropicalForest: i => cells.biome[i] === 7,
    tropicalWater: i => cells.t[i] === -1 && temp(i) >= 20,
    subAndTropicalWater: i => cells.t[i] === -1 && temp(i) >= 15,
    habitableOrWater: i => biomesData.habitability[cells.biome[i]] || cells.t[i] === -1,
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
      resource.expected = ~~expected; // temp
      resource.max = gauss(expected, expected / 2, expected / 5, cellsN, 0); // temp
      resource.cells = 0;
      return resource;
    });

    const shuffledCells = d3.shuffle(cells.i.slice());
    for (const i of shuffledCells) {
      if (!(i%10)) d3.shuffle(pack.resources);

      for (const resource of pack.resources) {
        if (resource.cells >= resource.max) continue;
        if (!models[resource.model](i)) continue;

        cells.resource[i] = resource.i;
        resource.cells += 1;
        break;
      }

    }

    console.table(pack.resources.sort((a, b) => a.i > b.i ? 1 : -1));
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
