"use strict";
// FMG utils related to cell ranking and population

// calculate cell suitability and population based on various factors
function rankCells(pack, grid, utils, modules) {
  const { TIME, normalize } = utils;
  const { biomesData } = modules;
  
  TIME && console.time("rankCells");
  
  const { cells, features } = pack;
  const s = new Int16Array(cells.i.length); // cell suitability array
  const pop = new Float32Array(cells.i.length); // cell population array

  const flMean = utils.d3.median(cells.fl.filter(f => f)) || 0;
  const flMax = utils.d3.max(cells.fl) + utils.d3.max(cells.conf); // to normalize flux
  const areaMean = utils.d3.mean(cells.area); // to adjust population by cell area

  for (const i of cells.i) {
    if (cells.h[i] < 20) continue; // no population in water
    
    let suitability = +biomesData.habitability[cells.biome[i]]; // base suitability derived from biome habitability
    if (!suitability) continue; // uninhabitable biomes has 0 suitability
    
    if (flMean) suitability += normalize(cells.fl[i] + cells.conf[i], flMean, flMax) * 250; // big rivers and confluences are valued
    suitability -= (cells.h[i] - 50) / 5; // low elevation is valued, high is not;

    if (cells.t[i] === 1) {
      if (cells.r[i]) suitability += 15; // estuary is valued
      const feature = features[cells.f[cells.haven[i]]];
      if (feature.type === "lake") {
        if (feature.group === "freshwater") suitability += 30;
        else if (feature.group == "salt") suitability += 10;
        else if (feature.group == "frozen") suitability += 1;
        else if (feature.group == "dry") suitability -= 5;
        else if (feature.group == "sinkhole") suitability -= 5;
        else if (feature.group == "lava") suitability -= 30;
      } else {
        suitability += 5; // ocean coast is valued
        if (cells.harbor[i] === 1) suitability += 20; // safe sea harbor is valued
      }
    }

    s[i] = suitability / 5; // general population rate
    // cell rural population is suitability adjusted by cell area
    pop[i] = s[i] > 0 ? (s[i] * cells.area[i]) / areaMean : 0;
  }

  TIME && console.timeEnd("rankCells");
  
  return { s, pop };
}

export { rankCells };