(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.Cultures = factory());
}(this, (function () {'use strict';

  let cells;
 
  const generate = function() {
    console.time('generateCultures');
    cells = pack.cells;
    cells.culture = new Int8Array(cells.i.length); // cell cultures
    let count = +culturesInput.value;

    const populated = cells.i.filter(i => cells.s[i]).sort((a, b) => cells.s[b] - cells.s[a]); // cells sorted by population
    if (populated.length < count * 25) {
      count = Math.floor(populated.length / 50);
      if (!count) {
        console.error(`There is no populated cells. Cannot generate cultures`);
        pack.cultures = [{name:"Wildlands", i:0, base:1}];
        alertMessage.innerHTML = `
          The climate is harsh and people cannot live in this world.<br>
          No cultures, states and burgs will be created.<br>
          Please consider changing the World Configurator settings`;
        $("#alert").dialog({resizable: false, title: "Extreme climate warning",
          buttons: {Ok: function() {$(this).dialog("close");}}
        });
        return;
      } else {
        console.error(`Not enought populated cells (${populated.length}). Will generate only ${count} cultures`);
        alertMessage.innerHTML = `
          There is only ${populated.length} populated cells and it's insufficient livable area.<br>
          Only ${count} out of ${culturesInput.value} requiested cultures will be generated.<br>
          Please consider changing the World Configurator settings`;
        $("#alert").dialog({resizable: false, title: "Extreme climate warning",
          buttons: {Ok: function() {$(this).dialog("close");}}
        });
      }
    }

    pack.cultures = getRandomCultures(count);
    const centers = d3.quadtree();
    const colors = getColors(count);

    pack.cultures.forEach(function(culture, i) {
      const c = culture.center = placeCultureCenter();
      centers.add(cells.p[c]);
      culture.i = i+1;
      culture.color = colors[i];
      culture.type = defineCultureType(c);
      culture.expansionism = defineCultureExpansionism(culture.type);
      cells.culture[c] = i+1;
      //debug.append("text").attr("stroke", "#000").attr("font-size", "10").attr("font-family", "Almendra SC").attr("x", cells.p[c][0]).attr("y", cells.p[c][1]).text(culture.type);
    });

    // the first culture with id 0 is for wildlands
    pack.cultures.unshift({name:"Wildlands", i:0, base:1});

    // check whether all bases are valid. If not, load default namesbase
    const invalidBase = pack.cultures.some(c => !nameBase[c.base]);
    if (invalidBase) applyDefaultNamesData();

    function getRandomCultures(c) {
      const d = getDefault();
      const cultures = [];
      while (cultures.length < c) {
        let culture = d[0];
        do {culture = d[rand(d.length-1)];} while (Math.random() > culture.odd || cultures.find(c => c.name === culture.name))
        cultures.push(culture);
      }
      return cultures;
    }

    // culture center tends to be placed in a density populated cell
    function placeCultureCenter() {
      let center, spacing = (graphWidth + graphHeight) / count;
      do {
        center = populated[biased(0, populated.length-1, 3)];
        spacing = spacing * .8;
      }
      while (centers.find(cells.p[center][0], cells.p[center][1], spacing) !== undefined);
      return center;
    }

    function defineCultureType(i) {
      if (cells.h[i] > 50) return "Highland"; // no penalty for hills and moutains, high for other elevations
      const f = cells.f[cells.haven[i]];
      if (pack.features[f].type === "lake" && pack.features[f].cells > 5) return "Lake" // low water cross penalty and high for non-along-coastline growth
      if (cells.harbor[i] === 1) return "Naval"; // low water cross penalty and high for non-along-coastline growth
      if (cells.r[i] && cells.fl[i] > 100) return "River"; // no River cross penalty, penalty for non-River growth
      const b = cells.biome[i];
      if (b === 4 || b === 1 || b === 2) return "Nomadic"; // high penalty in forest biomes and near coastline
      if (b === 3 || b === 9 || b === 10) return "Hunting"; // high penalty in non-native biomes
      return "Generic";
    }
    
    function defineCultureExpansionism(type) {
      let base = 1; // Generic
      if (type === "Lake") base = .8; else
      if (type === "Naval") base = 1.5; else
      if (type === "River") base = .9; else
      if (type === "Nomadic") base = 1.8; else
      if (type === "Hunting") base = .7; else
      if (type === "Highland") base = .5;
      return rn((Math.random() * powerInput.value / 2 + 1) * base, 1);
    }

    console.timeEnd('generateCultures');
  }

  const getDefault = function() {
    return [
      {name:"Shwazen", base:0, odd: .7},
      {name:"Angshire", base:1, odd: 1},
      {name:"Luari", base:2, odd: .6},
      {name:"Tallian", base:3, odd: .6},
      {name:"Astellian", base:4, odd: .6},
      {name:"Slovan", base:5, odd: .7},
      {name:"Norse", base:6, odd: .7},
      {name:"Elladan", base:7, odd: .7},
      {name:"Romian", base:8, odd: .7},
      {name:"Soumi", base:9, odd: .4},
      {name:"Koryo", base:10, odd: .5},
      {name:"Hantzu", base:11, odd: .5},
      {name:"Yamoto", base:12, odd: .5},
      {name:"Portuzian", base:13, odd: .4},
      {name:"Nawatli", base:14, odd: .2},
      {name:"Vengrian", base: 15, odd: .2},
      {name:"Turchian", base: 16, odd: .2},
      {name:"Berberan", base: 17, odd: .2},
      {name:"Eurabic", base: 18, odd: .2},
      {name:"Inuk", base: 19, odd: .1},
      {name:"Euskati", base: 20, odd: .1},
      {name:"Negarian", base: 21, odd: .05},
      {name:"Keltan", base: 22, odd: .1},
      {name:"Efratic", base: 23, odd: .1},
      {name:"Tehrani", base: 24, odd: .1},
      {name:"Maui", base: 25, odd: .05},
      {name:"Carnatic", base: 26, odd: .1},
      {name:"Inqan", base: 27, odd: .1},
      {name:"Kiswaili", base: 28, odd: .1},
      {name:"Vietic", base: 29, odd: .1},
      {name:"Guantzu", base:30, odd: 1},
      {name:"Ulus", base:31, odd: .1}
    ];
  }

  // expand cultures across the map (Dijkstra-like algorithm) 
  const expand = function() {
    console.time('expandCultures');
    cells = pack.cells;

    const queue = new PriorityQueue({comparator: (a, b) => a.p - b.p});
    pack.cultures.forEach(function(c) {
      if (!c.i || c.removed) return;
      queue.queue({e:c.center, p:0, c:c.i});
    });
    
    const neutral = cells.i.length / 5000 * 3000 * neutralInput.value; // limit cost for culture growth
    const cost = [];
    while (queue.length) {
      const next = queue.dequeue(), n = next.e, p = next.p, c = next.c;
      const type = pack.cultures[c].type;
      cells.c[n].forEach(function(e) {
        const biome = cells.biome[e];
        const biomeCost = getBiomeCost(c, biome, type);
        const biomeChangeCost = biome === cells.biome[n] ? 0 : 5 * Math.abs(biome - cells.biome[n]); // penalty on biome change
        const heightCost = getHeightCost(e, cells.h[e], type);
        const riverCost = getRiverCost(cells.r[e], e, type);
        const typeCost = getTypeCost(cells.t[e], type);
        const totalCost = p + (biomeCost + biomeChangeCost + heightCost + riverCost + typeCost) / pack.cultures[c].expansionism;

        if (totalCost > neutral) return;

        if (!cost[e] || totalCost < cost[e]) {
          if (cells.s[e] > 0) cells.culture[e] = c; // assign culture to populated cell
          cost[e] = totalCost;
          queue.queue({e, p:totalCost, c});

          //debug.append("text").attr("x", (cells.p[n][0]+cells.p[e][0])/2 - 1).attr("y", (cells.p[n][1]+cells.p[e][1])/2 - 1).text(rn(totalCost-p)).attr("font-size", .8);
          //const points = [cells.p[n][0], cells.p[n][1], (cells.p[n][0]+cells.p[e][0])/2, (cells.p[n][1]+cells.p[e][1])/2, cells.p[e][0], cells.p[e][1]];
          //debug.append("polyline").attr("points", points.toString()).attr("marker-mid", "url(#arrow)").attr("opacity", .6);
        }
      });
    }
    //debug.selectAll(".text").data(cost).enter().append("text").attr("x", (d, e) => cells.p[e][0]-1).attr("y", (d, e) => cells.p[e][1]-1).text(d => d ? rn(d) : "").attr("font-size", 2);
    console.timeEnd('expandCultures');
  }
  
  function getBiomeCost(c, biome, type) {
    if (cells.biome[pack.cultures[c].center] === biome) return biomesData.cost[biome] / 2; // tiny penalty for native biome
    if (type === "Hunting") return biomesData.cost[biome] * 5; // non-native biome penalty for hunters
    if (type === "Nomadic" && biome > 4 && biome < 10) return biomesData.cost[biome] * 10; // forest biome penalty for nomads
    return biomesData.cost[biome] * 2; // general non-native biome penalty
  }

  function getHeightCost(i, h, type) {
    if ((type === "Naval" || type === "Lake") && h < 20) return cells.area[i]; // low sea crossing penalty for Navals
    if (type === "Nomadic" && h < 20) return cells.area[i] * 50; // giant sea crossing penalty for Navals
    if (h < 20) return cells.area[i] * 5; // general sea crossing penalty
    if (type === "Highland" && h < 50) return 30; // penalty for highlanders on lowlands
    if (type === "Highland") return 0; // no penalty for highlanders on highlands
    if (h >= 70) return 100; // general mountains crossing penalty
    if (h >= 50) return 30; // general hills crossing penalty
    return 0;
  }

  function getRiverCost(r, i, type) {
    if (type === "River") return r ? 0 : 50; // penalty for river cultures
    if (!r) return 0; // no penalty for others if there is no river 
    return Math.min(Math.max(cells.fl[i] / 10, 20), 100) // river penalty from 20 to 100 based on flux
  }

  function getTypeCost(ctype, type) {
    if (ctype === 1) return type === "Naval" || type === "Lake" ? 0 : type === "Nomadic" ? 60 : 20; // penalty for coastline
    if (ctype === 2) return type === "Naval" || type === "Nomadic" ? 30 : 0; // low penalty for land level 2 for Navals and nomads
    if (ctype !== -1) return type === "Naval" || type === "Lake" ? 100 : 0;  // penalty for mainland for navals
    return 0;
  }

  return {generate, expand, getDefault};

})));