(function (global, factory) {
  typeof exports === "object" && typeof module !== "undefined" ? (module.exports = factory()) : typeof define === "function" && define.amd ? define(factory) : (global.Resources = factory());
})(this, function () {
  "use strict";

  // TO-DO
  // apply logic on heightmap edit
  // apply logic on burgs regeneration
  // apply logic on population recalculation
  // apply logic on save
  // apply logic on load

  let cells;

  const getDefault = function () {
    // model: cells eligibility function; chance: chance to get rosource in model-eligible cell
    return [
      {i: 1, name: "Wood", category: "Construction", icon: "resource-wood", color: "#966F33", value: 5, chance: 10, model: "Any_forest", bonus: {fleet: 2, defence: 1}},
      {i: 2, name: "Stone", category: "Construction", icon: "resource-stone", color: "#979EA2", value: 4, chance: 7, model: "Hills", bonus: {prestige: 1, defence: 2}},
      {i: 3, name: "Marble", category: "Construction", icon: "resource-marble", color: "#d6d0bf", value: 15, chance: 1, model: "Mountains", bonus: {prestige: 2}},
      {i: 4, name: "Iron", category: "Ore", icon: "resource-iron", color: "#5D686E", value: 8, chance: 8, model: "Mountains_and_wetlands", bonus: {artillery: 1, infantry: 1, defence: 1}},
      {i: 5, name: "Copper", category: "Ore", icon: "resource-copper", color: "#b87333", value: 10, chance: 3, model: "Mountains", bonus: {artillery: 2, defence: 1, prestige: 1}},
      {i: 6, name: "Lead", category: "Ore", icon: "resource-lead", color: "#454343", value: 8, chance: 3, model: "Mountains", bonus: {artillery: 1, defence: 1}},
      {i: 7, name: "Silver", category: "Ore", icon: "resource-silver", color: "#C0C0C0", value: 15, chance: 3, model: "Mountains", bonus: {prestige: 2}},
      {i: 8, name: "Gold", category: "Ore", icon: "resource-gold", color: "#d4af37", value: 30, chance: 1, model: "Headwaters", bonus: {prestige: 3}},
      {i: 9, name: "Grain", category: "Food", icon: "resource-grain", color: "#F5DEB3", value: 1, chance: 15, model: "Biome_habitability", bonus: {population: 4}},
      {i: 10, name: "Сattle", category: "Food", icon: "resource-cattle", color: "#56b000", value: 2, chance: 10, model: "Pastures_and_temperate_forest", bonus: {population: 2}},
      {i: 11, name: "Fish", category: "Food", icon: "resource-fish", color: "#7fcdff", value: 1, chance: 5, model: "Marine_and_rivers", bonus: {population: 2}},
      {i: 12, name: "Game", category: "Food", icon: "resource-game", color: "#c38a8a", value: 2, chance: 3, model: "Any_forest", bonus: {archers: 2, population: 1}},
      {i: 13, name: "Wine", category: "Food", icon: "resource-wine", color: "#963e48", value: 3, chance: 4, model: "Tropical_forests", bonus: {population: 1, prestige: 1}},
      {i: 14, name: "Olives", category: "Food", icon: "resource-olives", color: "#BDBD7D", value: 3, chance: 4, model: "Tropical_forests", bonus: {population: 1}},
      {i: 15, name: "Honey", category: "Food", icon: "resource-honey", color: "#DCBC66", value: 4, chance: 3, model: "Temperate_and_boreal_forests", bonus: {population: 1}},
      {i: 16, name: "Salt", category: "Food", icon: "resource-salt", color: "#E5E4E5", value: 5, chance: 4, model: "Arid_land_and_salt_lakes", bonus: {population: 1, defence: 1}},
      {i: 17, name: "Dates", category: "Food", icon: "resource-dates", color: "#dbb2a3", value: 3, chance: 3, model: "Deserts", bonus: {population: 1}},
      {i: 18, name: "Horses", category: "Supply", icon: "resource-horses", color: "#ba7447", value: 10, chance: 6, model: "Grassland_and_cold_desert", bonus: {cavalry: 2}},
      {i: 19, name: "Elephants", category: "Supply", icon: "resource-elephants", color: "#C5CACD", value: 15, chance: 2, model: "Hot_biomes", bonus: {cavalry: 1}},
      {i: 20, name: "Camels", category: "Supply", icon: "resource-camels", color: "#C19A6B", value: 13, chance: 4, model: "Deserts", bonus: {cavalry: 1}},
      {i: 21, name: "Hemp", category: "Material", icon: "resource-hemp", color: "#069a06", value: 2, chance: 4, model: "Deciduous_forests", bonus: {fleet: 2}},
      {i: 22, name: "Pearls", category: "Luxury", icon: "resource-pearls", color: "#EAE0C8", value: 35, chance: 3, model: "Tropical_waters", bonus: {prestige: 1}},
      {i: 23, name: "Gemstones", category: "Luxury", icon: "resource-gemstones", color: "#e463e4", value: 35, chance: 2, model: "Mountains", bonus: {prestige: 1}},
      {i: 24, name: "Dyes", category: "Luxury", icon: "resource-dyes", color: "#fecdea", value: 15, chance: 0.5, model: "Habitable_biome_or_marine", bonus: {prestige: 1}},
      {i: 25, name: "Incense", category: "Luxury", icon: "resource-incense", color: "#ebe5a7", value: 25, chance: 2, model: "Hot_desert_and_tropical_forest", bonus: {prestige: 2}},
      {i: 26, name: "Silk", category: "Luxury", icon: "resource-silk", color: "#e0f0f8", value: 30, chance: 1, model: "Tropical_rainforest", bonus: {prestige: 2}},
      {i: 27, name: "Spices", category: "Luxury", icon: "resource-spices", color: "#e99c75", value: 30, chance: 2, model: "Tropical_rainforest", bonus: {prestige: 2}},
      {i: 28, name: "Amber", category: "Luxury", icon: "resource-amber", color: "#e68200", value: 15, chance: 2, model: "Foresty_seashore", bonus: {prestige: 1}},
      {i: 29, name: "Furs", category: "Material", icon: "resource-furs", color: "#8a5e51", value: 13, chance: 2, model: "Boreal_forests", bonus: {prestige: 1}},
      {i: 30, name: "Sheeps", category: "Material", icon: "resource-sheeps", color: "#53b574", value: 2, chance: 5, model: "Pastures_and_temperate_forest", bonus: {infantry: 1}},
      {i: 31, name: "Slaves", category: "Supply", icon: "resource-slaves", color: "#757575", value: 10, chance: 3, model: "Less_habitable_seashore", bonus: {population: 2}},
      {i: 32, name: "Tar", category: "Material", icon: "resource-tar", color: "#727272", value: 3, chance: 3, model: "Any_forest", bonus: {fleet: 1}},
      {i: 33, name: "Saltpeter", category: "Material", icon: "resource-saltpeter", color: "#e6e3e3", value: 8, chance: 2, model: "Biome_habitability", bonus: {artillery: 3}},
      {i: 34, name: "Coal", category: "Material", icon: "resource-coal", color: "#36454f", value: 2, chance: 7, model: "Hills", bonus: {artillery: 2}},
      {i: 35, name: "Oil", category: "Material", icon: "resource-oil", color: "#565656", value: 5, chance: 2, model: "Less_habitable_biomes", bonus: {artillery: 1}},
      {i: 36, name: "Tropical timber", category: "Luxury", icon: "resource-tropicalTimber", color: "#a45a52", value: 20, chance: 2, model: "Tropical_rainforest", bonus: {prestige: 1}},
      {i: 37, name: "Whales", category: "Food", icon: "resource-whales", color: "#cccccc", value: 2, chance: 2, model: "Arctic_waters", bonus: {population: 1}},
      {i: 38, name: "Sugar", category: "Food", icon: "resource-sugar", color: "#7abf87", value: 3, chance: 3, model: "Tropical_rainforest", bonus: {population: 1}},
      {i: 39, name: "Tea", category: "Luxury", icon: "resource-tea", color: "#d0f0c0", value: 10, chance: 3, model: "Hilly_tropical_rainforest", bonus: {prestige: 1}},
      {i: 40, name: "Tobacco", category: "Luxury", icon: "resource-tobacco", color: "#6D5843", value: 10, chance: 2, model: "Tropical_rainforest", bonus: {prestige: 1}}
    ];
  };

  // "0 Marine", "1 Hot Deserts", "2 Cold Deserts", "3 Savanna", "4 Grassland", "5 Tropical seasonal forest", "6 Temperate deciduous forest",
  // "7 Tropical rainforest", "8 Temperate rainforest", "9 Taiga", "10 Tundra", "11 Glacier", "12 Wetland"

  const models = {
    Deciduous_forests: i => [6, 7, 8].includes(cells.biome[i]),
    Any_forest: i => [5, 6, 7, 8, 9].includes(cells.biome[i]),
    Temperate_and_boreal_forests: i => [6, 8, 9].includes(cells.biome[i]),
    Hills: i => cells.h[i] >= 40 || (cells.h[i] >= 30 && !(i % 10)),
    Mountains: i => cells.h[i] >= 60 || (cells.h[i] >= 40 && !(i % 10)),
    Mountains_and_wetlands: i => cells.h[i] >= 60 || (cells.biome[i] === 12 && !(i % 8)),
    Headwaters: i => cells.h[i] >= 40 && cells.r[i],
    Biome_habitability: i => chance(biomesData.habitability[cells.biome[i]]),
    Marine_and_rivers: i => (cells.t[i] < 0 && ["ocean", "freshwater", "salt"].includes(group(i))) || (cells.t[i] > 0 && cells.t[i] < 3 && cells.r[i]),
    Pastures_and_temperate_forest: i => chance(100 - cells.h[i]) && chance([0, 0, 0, 100, 100, 20, 80, 0, 0, 0, 0, 0, 0][cells.biome[i]]),
    Tropical_forests: i => [5, 7].includes(cells.biome[i]),
    Arid_land_and_salt_lakes: i => chance([0, 80, 60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10][cells.biome[i]]) || group(i) === "salt" || group(i) === "dry",
    Deserts: i => cells.biome[i] === 1 || cells.biome[i] === 2,
    Grassland_and_cold_desert: i => cells.biome[i] === 3 || (!(i % 4) && cells.biome[i] === 2),
    Hot_biomes: i => [1, 3, 5, 7].includes(cells.biome[i]),
    Hot_desert_and_tropical_forest: i => [1, 7].includes(cells.biome[i]),
    Tropical_rainforest: i => cells.biome[i] === 7,
    Tropical_waters: i => cells.t[i] === -1 && temp(i) >= 18,
    Hilly_tropical_rainforest: i => cells.h[i] >= 40 && cells.biome[i] === 7,
    Subtropical_waters: i => cells.t[i] === -1 && temp(i) >= 14,
    Habitable_biome_or_marine: i => biomesData.habitability[cells.biome[i]] || cells.t[i] === -1,
    Foresty_seashore: i => cells.t[i] === 1 && [6, 7, 8, 9].includes(cells.biome[i]),
    Boreal_forests: i => chance([0, 0, 0, 0, 0, 0, 20, 0, 20, 100, 50, 0, 10][cells.biome[i]]),
    Less_habitable_seashore: i => cells.t[i] === 1 && chance([0, 50, 30, 30, 20, 10, 10, 20, 10, 20, 10, 0, 5][cells.biome[i]]),
    Less_habitable_biomes: i => chance([5, 80, 30, 10, 20, 5, 5, 5, 5, 30, 90, 0, 5][cells.biome[i]]),
    Arctic_waters: i => cells.t[i] < 0 && temp(i) < 8
  };

  const chance = v => {
    if (v < 0.01) return false;
    if (v > 99.99) return true;
    return v / 100 > Math.random();
  };

  const temp = i => grid.cells.temp[pack.cells.g[i]];
  const group = i => pack.features[cells.f[i]].group;

  const generate = function () {
    console.time("generateResources");
    cells = pack.cells;
    cells.resource = new Uint8Array(cells.i.length); // resources array [0, 255]
    const resourceMaxCells = Math.ceil((200 * cells.i.length) / 5000);
    if (!pack.resources) pack.resources = getDefault();
    pack.resources.forEach(r => (r.cells = 0));

    const skipGlaciers = biomesData.habitability[11] === 0;
    const shuffledCells = d3.shuffle(cells.i.slice());
    for (const i of shuffledCells) {
      if (!(i % 10)) d3.shuffle(pack.resources);
      if (skipGlaciers && cells.biome[i] === 11) continue;
      const rnd = Math.random() * 100;

      for (const resource of pack.resources) {
        if (resource.cells >= resourceMaxCells) continue;
        if (!models[resource.model](i)) continue;
        if (resource.cells >= resource.chance && rnd > resource.chance) continue;

        cells.resource[i] = resource.i;
        resource.cells++;
        break;
      }
    }
    pack.resources.sort((a, b) => (a.i > b.i ? 1 : -1));

    console.timeEnd("generateResources");
  };

  const getStroke = color => d3.color(color).darker(2).hex();
  const get = i => pack.resources.find(resource => resource.i === i);

  return {generate, getDefault, getStroke, get};
});
