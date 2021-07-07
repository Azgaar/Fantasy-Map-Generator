(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? (module.exports = factory()) : typeof define === 'function' && define.amd ? define(factory) : (global.Resources = factory());
})(this, function () {
  'use strict';

  // TODO
  // apply logic on heightmap edit
  // apply logic on burgs regeneration
  // apply logic on population recalculation
  // apply logic on save
  // apply logic on load

  let cells, cellId;

  const getDefault = function () {
    return [
      {i: 1, name: 'Wood', category: 'Construction', icon: 'resource-wood', color: '#966F33', value: 2, chance: 4, model: 'Any_forest', bonus: {fleet: 2, defence: 1}},
      {i: 2, name: 'Stone', category: 'Construction', icon: 'resource-stone', color: '#979EA2', value: 2, chance: 4, model: 'Hills', bonus: {prestige: 1, defence: 2}},
      {i: 3, name: 'Marble', category: 'Construction', icon: 'resource-marble', color: '#d6d0bf', value: 7, chance: 1, model: 'Mountains', bonus: {prestige: 2}},
      {i: 4, name: 'Iron', category: 'Ore', icon: 'resource-iron', color: '#5D686E', value: 4, chance: 4, model: 'Mountains_and_wetlands', bonus: {artillery: 1, infantry: 1, defence: 1}},
      {i: 5, name: 'Copper', category: 'Ore', icon: 'resource-copper', color: '#b87333', value: 5, chance: 3, model: 'Mountains', bonus: {artillery: 2, defence: 1, prestige: 1}},
      {i: 6, name: 'Lead', category: 'Ore', icon: 'resource-lead', color: '#454343', value: 4, chance: 3, model: 'Mountains', bonus: {artillery: 1, defence: 1}},
      {i: 7, name: 'Silver', category: 'Ore', icon: 'resource-silver', color: '#C0C0C0', value: 8, chance: 3, model: 'Mountains', bonus: {prestige: 2}},
      {i: 8, name: 'Gold', category: 'Ore', icon: 'resource-gold', color: '#d4af37', value: 15, chance: 1, model: 'Headwaters', bonus: {prestige: 3}},
      {i: 9, name: 'Grain', category: 'Food', icon: 'resource-grain', color: '#F5DEB3', value: 1, chance: 4, model: 'More_habitable', bonus: {population: 4}},
      {i: 10, name: 'Cattle', category: 'Food', icon: 'resource-cattle', color: '#56b000', value: 2, chance: 4, model: 'Pastures_and_temperate_forest', bonus: {population: 2}},
      {i: 11, name: 'Fish', category: 'Food', icon: 'resource-fish', color: '#7fcdff', value: 1, chance: 2, model: 'Marine_and_rivers', bonus: {population: 2}},
      {i: 12, name: 'Game', category: 'Food', icon: 'resource-game', color: '#c38a8a', value: 2, chance: 3, model: 'Any_forest', bonus: {archers: 2, population: 1}},
      {i: 13, name: 'Wine', category: 'Food', icon: 'resource-wine', color: '#963e48', value: 2, chance: 3, model: 'Tropical_forests', bonus: {population: 1, prestige: 1}},
      {i: 14, name: 'Olives', category: 'Food', icon: 'resource-olives', color: '#BDBD7D', value: 2, chance: 3, model: 'Tropical_forests', bonus: {population: 1}},
      {i: 15, name: 'Honey', category: 'Food', icon: 'resource-honey', color: '#DCBC66', value: 2, chance: 3, model: 'Temperate_and_boreal_forests', bonus: {population: 1}},
      {i: 16, name: 'Salt', category: 'Food', icon: 'resource-salt', color: '#E5E4E5', value: 3, chance: 3, model: 'Arid_land_and_salt_lakes', bonus: {population: 1, defence: 1}},
      {i: 17, name: 'Dates', category: 'Food', icon: 'resource-dates', color: '#dbb2a3', value: 2, chance: 2, model: 'Hot_desert', bonus: {population: 1}},
      {i: 18, name: 'Horses', category: 'Supply', icon: 'resource-horses', color: '#ba7447', value: 5, chance: 4, model: 'Grassland_and_cold_desert', bonus: {cavalry: 2}},
      {i: 19, name: 'Elephants', category: 'Supply', icon: 'resource-elephants', color: '#C5CACD', value: 7, chance: 2, model: 'Hot_biomes', bonus: {cavalry: 1}},
      {i: 20, name: 'Camels', category: 'Supply', icon: 'resource-camels', color: '#C19A6B', value: 7, chance: 3, model: 'Deserts', bonus: {cavalry: 1}},
      {i: 21, name: 'Hemp', category: 'Material', icon: 'resource-hemp', color: '#069a06', value: 2, chance: 3, model: 'Deciduous_forests', bonus: {fleet: 2}},
      {i: 22, name: 'Pearls', category: 'Luxury', icon: 'resource-pearls', color: '#EAE0C8', value: 16, chance: 2, model: 'Tropical_waters', bonus: {prestige: 1}},
      {i: 23, name: 'Gemstones', category: 'Luxury', icon: 'resource-gemstones', color: '#e463e4', value: 17, chance: 2, model: 'Mountains', bonus: {prestige: 1}},
      {i: 24, name: 'Dyes', category: 'Luxury', icon: 'resource-dyes', color: '#fecdea', value: 6, chance: 0.5, model: 'Habitable_biome_or_marine', bonus: {prestige: 1}},
      {i: 25, name: 'Incense', category: 'Luxury', icon: 'resource-incense', color: '#ebe5a7', value: 12, chance: 2, model: 'Hot_desert_and_tropical_forest', bonus: {prestige: 2}},
      {i: 26, name: 'Silk', category: 'Luxury', icon: 'resource-silk', color: '#e0f0f8', value: 15, chance: 1, model: 'Tropical_rainforest', bonus: {prestige: 2}},
      {i: 27, name: 'Spices', category: 'Luxury', icon: 'resource-spices', color: '#e99c75', value: 15, chance: 2, model: 'Tropical_rainforest', bonus: {prestige: 2}},
      {i: 28, name: 'Amber', category: 'Luxury', icon: 'resource-amber', color: '#e68200', value: 7, chance: 2, model: 'Foresty_seashore', bonus: {prestige: 1}},
      {i: 29, name: 'Furs', category: 'Material', icon: 'resource-furs', color: '#8a5e51', value: 6, chance: 2, model: 'Boreal_forests', bonus: {prestige: 1}},
      {i: 30, name: 'Sheep', category: 'Material', icon: 'resource-sheeps', color: '#53b574', value: 2, chance: 3, model: 'Pastures_and_temperate_forest', bonus: {infantry: 1}},
      {i: 31, name: 'Slaves', category: 'Supply', icon: 'resource-slaves', color: '#757575', value: 5, chance: 2, model: 'Less_habitable_seashore', bonus: {population: 2}},
      {i: 32, name: 'Tar', category: 'Material', icon: 'resource-tar', color: '#727272', value: 2, chance: 3, model: 'Any_forest', bonus: {fleet: 1}},
      {i: 33, name: 'Saltpeter', category: 'Material', icon: 'resource-saltpeter', color: '#e6e3e3', value: 3, chance: 2, model: 'Less_habitable_biomes', bonus: {artillery: 3}},
      {i: 34, name: 'Coal', category: 'Material', icon: 'resource-coal', color: '#36454f', value: 2, chance: 3, model: 'Hills', bonus: {artillery: 2}},
      {i: 35, name: 'Oil', category: 'Material', icon: 'resource-oil', color: '#565656', value: 3, chance: 2, model: 'Less_habitable_biomes', bonus: {artillery: 1}},
      {i: 36, name: 'Tropical timber', category: 'Luxury', icon: 'resource-tropicalTimber', color: '#a45a52', value: 10, chance: 2, model: 'Tropical_rainforest', bonus: {prestige: 1}},
      {i: 37, name: 'Whales', category: 'Food', icon: 'resource-whales', color: '#cccccc', value: 2, chance: 3, model: 'Arctic_waters', bonus: {population: 1}},
      {i: 38, name: 'Sugar', category: 'Food', icon: 'resource-sugar', color: '#7abf87', value: 3, chance: 3, model: 'Tropical_rainforest', bonus: {population: 1}},
      {i: 39, name: 'Tea', category: 'Luxury', icon: 'resource-tea', color: '#d0f0c0', value: 5, chance: 3, model: 'Hilly_tropical_rainforest', bonus: {prestige: 1}},
      {i: 40, name: 'Tobacco', category: 'Luxury', icon: 'resource-tobacco', color: '#6D5843', value: 5, chance: 2, model: 'Tropical_rainforest', bonus: {prestige: 1}}
    ];
  };

  const defaultModels = {
    Deciduous_forests: 'biome(6, 7, 8)',
    Any_forest: 'biome(5, 6, 7, 8, 9)',
    Temperate_and_boreal_forests: 'biome(6, 8, 9)',
    Hills: 'minHeight(40) || (minHeight(30) && nth(10))',
    Mountains: 'minHeight(60) || (minHeight(40) && nth(10))',
    Mountains_and_wetlands: 'minHeight(60) || (biome(12) && nth(8))',
    Headwaters: 'river() && minHeight(40)',
    More_habitable: 'minHabitability(20) && habitability()',
    Marine_and_rivers: 'shore(-1) && (type("ocean", "freshwater", "salt") || (river() && shore(1, 2)))',
    Pastures_and_temperate_forest: '(biome(3, 4) && !elevation()) || (biome(6) && random(70)) || (biome(5) && nth(5))',
    Tropical_forests: 'biome(5, 7)',
    Arid_land_and_salt_lakes: 'type("salt", "dry") || (biome(1, 2) && random(70)) || (biome(12) && nth(10))',
    Hot_desert: 'biome(1)',
    Deserts: 'biome(1, 2)',
    Grassland_and_cold_desert: 'biome(3) || (biome(2) && nth(4))',
    Hot_biomes: 'biome(1, 3, 5, 7)',
    Hot_desert_and_tropical_forest: 'biome(1, 7)',
    Tropical_rainforest: 'biome(7)',
    Tropical_waters: 'shore(-1) && minTemp(18)',
    Hilly_tropical_rainforest: 'minHeight(40) && biome(7)',
    Subtropical_waters: 'shore(-1) && minTemp(14)',
    Habitable_biome_or_marine: 'shore(-1) || minHabitability(1)',
    Foresty_seashore: 'shore(1) && biome(6, 7, 8, 9)',
    Boreal_forests: 'biome(9) || (biome(10) && nth(2)) || (biome(6, 8) && nth(5)) || (biome(12) && nth(10))',
    Less_habitable_seashore: 'shore(1) && minHabitability(1) && !habitability()',
    Less_habitable_biomes: 'minHabitability(1) && !habitability()',
    Arctic_waters: 'shore(-1) && biome(0) && maxTemp(7)'
  };

  const methods = {
    random: (number) => number >= 100 || (number > 0 && number / 100 > Math.random()),
    nth: (number) => !(cellId % number),
    minHabitability: (min) => biomesData.habitability[pack.cells.biome[cellId]] >= min,
    habitability: () => biomesData.habitability[cells.biome[cellId]] > Math.random() * 100,
    elevation: () => pack.cells.h[cellId] / 100 > Math.random(),
    biome: (...biomes) => biomes.includes(pack.cells.biome[cellId]),
    minHeight: (heigh) => pack.cells.h[cellId] >= heigh,
    maxHeight: (heigh) => pack.cells.h[cellId] <= heigh,
    minTemp: (temp) => grid.cells.temp[pack.cells.g[cellId]] >= temp,
    maxTemp: (temp) => grid.cells.temp[pack.cells.g[cellId]] <= temp,
    shore: (...rings) => rings.includes(pack.cells.t[cellId]),
    type: (...types) => types.includes(pack.features[cells.f[cellId]].group),
    river: () => pack.cells.r[cellId]
  };
  const allMethods = '{' + Object.keys(methods).join(', ') + '}';

  const generate = function () {
    TIME && console.time('generateResources');
    cells = pack.cells;
    cells.resource = new Uint8Array(cells.i.length); // resources array [0, 255]
    const resourceMaxCells = Math.ceil((200 * cells.i.length) / 5000);
    if (!pack.resources) pack.resources = getDefault();
    pack.resources.forEach((r) => {
      r.cells = 0;
      const model = r.custom || defaultModels[r.model];
      r.fn = new Function(allMethods, 'return ' + model);
    });

    const skipGlaciers = biomesData.habitability[11] === 0;
    const shuffledCells = d3.shuffle(cells.i.slice());

    for (const i of shuffledCells) {
      if (!(i % 10)) d3.shuffle(pack.resources);
      if (skipGlaciers && cells.biome[i] === 11) continue;
      const rnd = Math.random() * 100;
      cellId = i;

      for (const resource of pack.resources) {
        if (resource.cells >= resourceMaxCells) continue;
        if (resource.cells ? rnd > resource.chance : Math.random() * 100 > resource.chance) continue;
        if (!resource.fn({...methods})) continue;

        cells.resource[i] = resource.i;
        resource.cells++;
        break;
      }
    }
    pack.resources.sort((a, b) => (a.i > b.i ? 1 : -1)).forEach((r) => delete r.fn);

    TIME && console.timeEnd('generateResources');
  };

  const getStroke = (color) => d3.color(color).darker(2).hex();
  const get = (i) => pack.resources.find((resource) => resource.i === i);

  return {generate, getDefault, defaultModels, methods, getStroke, get};
});
