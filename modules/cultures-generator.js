(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.Cultures = factory());
}(this, (function () {'use strict';

  let cells;

  const generate = function() {
    console.time('generateCultures');
    cells = pack.cells;
    cells.culture = new Uint16Array(cells.i.length); // cell cultures
    let count = +culturesInput.value;

    const populated = cells.i.filter(i => cells.s[i]).sort((a, b) => cells.s[b] - cells.s[a]); // cells sorted by population
    if (populated.length < count * 25) {
      count = Math.floor(populated.length / 50);
      if (!count) {
        console.warn(`There are no populated cells. Cannot generate cultures`);
        pack.cultures = [{name:"Wildlands", i:0, base:1}];
        alertMessage.innerHTML = `
          The climate is harsh and people cannot live in this world.<br>
          No cultures, states and burgs will be created.<br>
          Please consider changing climate settings in the World Configurator`;
        $("#alert").dialog({resizable: false, title: "Extreme climate warning",
          buttons: {Ok: function() {$(this).dialog("close");}}
        });
        return;
      } else {
        console.warn(`Not enought populated cells (${populated.length}). Will generate only ${count} cultures`);
        alertMessage.innerHTML = `
          There are only ${populated.length} populated cells and it's insufficient livable area.<br>
          Only ${count} out of ${culturesInput.value} requested cultures will be generated.<br>
          Please consider changing climate settings in the World Configurator`;
        $("#alert").dialog({resizable: false, title: "Extreme climate warning",
          buttons: {Ok: function() {$(this).dialog("close");}}
        });
      }
    }

    const cultures = pack.cultures = getRandomCultures(count);
    const centers = d3.quadtree();
    const colors = getColors(count);

    cultures.forEach(function(culture, i) {
      const c = culture.center = placeCultureCenter();
      centers.add(cells.p[c]);
      culture.i = i+1;
      delete culture.odd;
      culture.color = colors[i];
      culture.type = defineCultureType(c);
      culture.expansionism = defineCultureExpansionism(culture.type);
      culture.origin = 0;
      culture.code = getCode(culture.name);
      cells.culture[c] = i+1;
    });

    // the first culture with id 0 is for wildlands
    cultures.unshift({name:"Wildlands", i:0, base:1, origin:null});

    // check whether all bases are valid. If not, load default namesbase
    const invalidBase = cultures.some(c => !nameBases[c.base]);
    if (invalidBase) nameBases = Names.getNameBases();

    function getRandomCultures(c) {
      const d = getDefault(c), n = d.length-1;
      const count = Math.min(c, d.length);
      const cultures = [];
      while (cultures.length < count) {
        let culture = d[rand(n)];
        do {
          culture = d[rand(n)];
        } while (Math.random() > culture.odd || cultures.find(c => c.name === culture.name))
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

    // set culture type based on culture center position
    function defineCultureType(i) {
      if (cells.h[i] > 50) return "Highland"; // no penalty for hills and moutains, high for other elevations
      const f = pack.features[cells.f[cells.haven[i]]]; // feature
      if (f.type === "lake" && f.cells > 5) return "Lake" // low water cross penalty and high for non-along-coastline growth
      if ((f.cells < 10 && cells.harbor[i]) || (cells.harbor[i] === 1 && P(.5))) return "Naval"; // low water cross penalty and high for non-along-coastline growth
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
      if (type === "Nomadic") base = 1.5; else
      if (type === "Hunting") base = .7; else
      if (type === "Highland") base = 1.2;
      return rn((Math.random() * powerInput.value / 2 + 1) * base, 1);
    }

    console.timeEnd('generateCultures');
  }

  // assign a unique two-letters code (abbreviation)
  function getCode(name) {
    const words = name.split(" "), letters = words.join("");
    let code = words.length === 2 ? words[0][0]+words[1][0] : letters.slice(0,2);
    for (let i=1; i < letters.length-1 && pack.cultures.some(c => c.code === code); i++) {
      code = letters[0] + letters[i].toUpperCase();
    }
    return code;
  }

  const add = function(center) {
    const defaultCultures = getDefault();
    let culture, base, name;
    if (pack.cultures.length < defaultCultures.length) {
      // add one of the default cultures
      culture = pack.cultures.length;
      base = defaultCultures[culture].base;
      name = defaultCultures[culture].name;
    } else {
      // add random culture besed on one of the current ones
      culture = rand(pack.cultures.length - 1);
      name = Names.getCulture(culture, 5, 8, "");
      base = pack.cultures[culture].base;
    }
    const code = getCode(name);
    const i = pack.cultures.length;
    const color = d3.color(d3.scaleSequential(d3.interpolateRainbow)(Math.random())).hex();
    pack.cultures.push({name, color, base, center, i, expansionism:1, type:"Generic", cells:0, area:0, rural:0, urban:0, origin:0, code});
  }

  const getDefault = function(count) {
    if (culturesSet.value === "european") {
      return [
        {name:"Shwazen", base:0, odd: 1},
        {name:"Angshire", base:1, odd: 1},
        {name:"Luari", base:2, odd: 1},
        {name:"Tallian", base:3, odd: 1},
        {name:"Astellian", base:4, odd: 1},
        {name:"Slovan", base:5, odd: 1},
        {name:"Norse", base:6, odd: 1},
        {name:"Elladan", base:7, odd: 1},
        {name:"Romian", base:8, odd: .2},
        {name:"Soumi", base:9, odd: 1},
        {name:"Portuzian", base:13, odd: 1},
        {name:"Vengrian", base: 15, odd: 1},
        {name:"Turchian", base: 16, odd: .05},
        {name:"Euskati", base: 20, odd: .05},
        {name:"Keltan", base: 22, odd: .05}
      ];
    }

    if (culturesSet.value === "oriental") {
      return [
        {name:"Koryo", base:10, odd: 1},
        {name:"Hantzu", base:11, odd: 1},
        {name:"Yamoto", base:12, odd: 1},
        {name:"Turchian", base: 16, odd: 1},
        {name:"Berberan", base: 17, odd: .2},
        {name:"Eurabic", base: 18, odd: 1},
        {name:"Efratic", base: 23, odd: .1},
        {name:"Tehrani", base: 24, odd: 1},
        {name:"Maui", base: 25, odd: .2},
        {name:"Carnatic", base: 26, odd: .5},
        {name:"Vietic", base: 29, odd: .8},
        {name:"Guantzu", base:30, odd: .5},
        {name:"Ulus", base:31, odd: 1}
      ];
    }

    if (culturesSet.value === "english") {
      const getName = () => Names.getBase(1, 5, 9, "", 0);
      return [
        {name:getName(), base:1, odd: 1},
        {name:getName(), base:1, odd: 1},
        {name:getName(), base:1, odd: 1},
        {name:getName(), base:1, odd: 1},
        {name:getName(), base:1, odd: 1},
        {name:getName(), base:1, odd: 1},
        {name:getName(), base:1, odd: 1},
        {name:getName(), base:1, odd: 1},
        {name:getName(), base:1, odd: 1},
        {name:getName(), base:1, odd: 1}
      ];
    }

    if (culturesSet.value === "antique") {
      return [
        {name:"Roman", base:8, odd: 1},
        {name:"Roman", base:8, odd: 1},
        {name:"Roman", base:8, odd: 1},
        {name:"Roman", base:8, odd: 1},
        {name:"Hellenic", base:7, odd: 1}, // Greek
        {name:"Hellenic", base:7, odd: 1}, // Greek
        {name:"Macedonian", base:7, odd: .5}, // Greek
        {name:"Celtic", base:22, odd: 1},
        {name:"Germanic", base:0, odd: 1},
        {name:"Persian", base:24, odd: .8}, // Iranian
        {name:"Scythian", base:24, odd: .5}, // Iranian
        {name:"Cantabrian", base: 20, odd: .5}, // Basque
        {name:"Estian", base: 9, odd: .2}, // Finnic
        {name:"Carthaginian", base: 17, odd: .3}, // Berber (the closest we have)
        {name:"Mesopotamian", base: 23, odd: .2} // Mesopotamian
      ];
    }

    if (culturesSet.value === "highFantasy") {
      return [
        // fantasy races
        {name:"Quenian", base: 33, odd: 1}, // Elves
        {name:"Eldar", base: 33, odd: 1}, // Elves
        {name:"Lorian", base: 33, odd: .5}, // Elves
        {name:"Trow", base: 34, odd: .9}, // Dark Elves
        {name:"Dokalfar", base: 34, odd: .3}, // Dark Elves
        {name:"Durinn", base: 35, odd: 1}, // Dwarven
        {name:"Khazadur", base: 35, odd: 1}, // Dwarven
        {name:"Kobblin", base: 36, odd: 1}, // Goblin
        {name:"Uruk", base: 37, odd: 1}, // Orc
        {name:"Ugluk", base: 37, odd: .7}, // Orc
        {name:"Yotunn", base: 38, odd: .9}, // Giant
        {name:"Drake", base: 39, odd: .7}, // Draconic
        {name:"Rakhnid", base: 40, odd: .9}, // Arachnid
        {name:"Aj'Snaga", base: 41, odd: .9}, // Serpents
        // common fantasy human
        {name:"Gozdor", base:32, odd: 1},
        {name:"Anor", base:32, odd: 1},
        {name:"Dail", base:32, odd: 1},
        {name:"Duland", base:32, odd: 1},
        {name:"Rohand", base:32, odd: 1},
        // rare real-world western
        {name:"Norse", base:6, odd: .5},
        {name:"Izenlute", base:0, odd: .1},
        {name:"Lurian", base:2, odd: .1},
        {name:"Getalian", base:3, odd: .1},
        {name:"Astelan", base:4, odd: .05},
        // rare real-world exotic
        {name:"Yoruba", base:21, odd: .05},
        {name:"Ryoko", base:10, odd: .05},
        {name:"Toyamo", base:12, odd: .05},
        {name:"Guan-Tsu", base:30, odd: .05},
        {name:"Ulus-Khan", base:31, odd: .05},
        {name:"Turan", base: 16, odd: .05},
        {name:"Al'Uma", base: 18, odd: .05},
        {name:"Druidas", base: 22, odd: .05},
        {name:"Gorodian", base:5, odd: .05}
      ];
    }

    if (culturesSet.value === "darkFantasy") {
      return [
        // common real-world English
        {name:"Angshire", base:1, odd: 1},
        {name:"Enlandic", base:1, odd: 1},
        {name:"Westen", base:1, odd: 1},
        {name:"Nortumbic", base:1, odd: 1},
        {name:"Mercian", base:1, odd: 1},
        {name:"Kentian", base:1, odd: 1},
        // rare real-world western
        {name:"Norse", base:6, odd: .7},
        {name:"Schwarzen", base:0, odd: .3},
        {name:"Luarian", base:2, odd: .3},
        {name:"Hetallian", base:3, odd: .3},
        {name:"Astellian", base:4, odd: .3},
        // rare real-world exotic
        {name:"Kiswaili", base:28, odd: .05},
        {name:"Yoruba", base:21, odd: .05},
        {name:"Koryo", base:10, odd: .05},
        {name:"Hantzu", base:11, odd: .05},
        {name:"Yamoto", base:12, odd: .05},
        {name:"Guantzu", base:30, odd: .05},
        {name:"Ulus", base:31, odd: .05},
        {name:"Turan", base: 16, odd: .05},
        {name:"Berberan", base: 17, odd: .05},
        {name:"Eurabic", base: 18, odd: .05},
        {name:"Slovan", base:5, odd: .05},
        {name:"Keltan", base: 22, odd: .1},
        {name:"Elladan", base:7, odd: .2},
        {name:"Romian", base:8, odd: .2},
        // fantasy races
        {name:"Eldar", base: 33, odd: .5}, // Elves
        {name:"Trow", base: 34, odd: .8}, // Dark Elves
        {name:"Durinn", base: 35, odd: .8}, // Dwarven
        {name:"Kobblin", base: 36, odd: .8}, // Goblin
        {name:"Uruk", base: 37, odd: .8}, // Orc
        {name:"Yotunn", base: 38, odd: .8}, // Giant
        {name:"Drake", base: 39, odd: .9}, // Draconic
        {name:"Rakhnid", base: 40, odd: .9}, // Arachnid
        {name:"Aj'Snaga", base: 41, odd: .9}, // Serpents
      ]
    }

    if (culturesSet.value === "random") {
      return d3.range(count).map(i => {
        const rnd = rand(41);
        return {name:Names.getBaseShort(rnd), base:rnd, odd: 1}
      });
    }

    // all-world
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
      {name:"Soumi", base:9, odd: .3},
      {name:"Koryo", base:10, odd: .1},
      {name:"Hantzu", base:11, odd: .1},
      {name:"Yamoto", base:12, odd: .1},
      {name:"Portuzian", base:13, odd: .4},
      {name:"Nawatli", base:14, odd: .1},
      {name:"Vengrian", base: 15, odd: .2},
      {name:"Turchian", base: 16, odd: .2},
      {name:"Berberan", base: 17, odd: .1},
      {name:"Eurabic", base: 18, odd: .2},
      {name:"Inuk", base: 19, odd: .05},
      {name:"Euskati", base: 20, odd: .05},
      {name:"Yoruba", base: 21, odd: .05},
      {name:"Keltan", base: 22, odd: .05},
      {name:"Efratic", base: 23, odd: .05},
      {name:"Tehrani", base: 24, odd: .1},
      {name:"Maui", base: 25, odd: .05},
      {name:"Carnatic", base: 26, odd: .05},
      {name:"Inqan", base: 27, odd: .05},
      {name:"Kiswaili", base: 28, odd: .1},
      {name:"Vietic", base: 29, odd: .1},
      {name:"Guantzu", base:30, odd: .1},
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
        const biomeChangeCost = biome === cells.biome[n] ? 0 : 20; // penalty on biome change
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
    if (cells.biome[pack.cultures[c].center] === biome) return 10; // tiny penalty for native biome
    if (type === "Hunting") return biomesData.cost[biome] * 5; // non-native biome penalty for hunters
    if (type === "Nomadic" && biome > 4 && biome < 10) return biomesData.cost[biome] * 10; // forest biome penalty for nomads
    return biomesData.cost[biome] * 2; // general non-native biome penalty
  }

  function getHeightCost(i, h, type) {
    const f = pack.features[cells.f[i]], a = cells.area[i];
    if (type === "Lake" && f.type === "lake") return 10; // no lake crossing penalty for Lake cultures
    if (type === "Naval" && h < 20) return a * 2; // low sea/lake crossing penalty for Naval cultures
    if (type === "Nomadic" && h < 20) return a * 50; // giant sea/lake crossing penalty for Nomads
    if (h < 20) return a * 6; // general sea/lake crossing penalty
    if (type === "Highland" && h < 44) return 3000; // giant penalty for highlanders on lowlands
    if (type === "Highland" && h < 62) return 200; // giant penalty for highlanders on lowhills
    if (type === "Highland") return 0; // no penalty for highlanders on highlands
    if (h >= 67) return 200; // general mountains crossing penalty
    if (h >= 44) return 30; // general hills crossing penalty
    return 0;
  }

  function getRiverCost(r, i, type) {
    if (type === "River") return r ? 0 : 100; // penalty for river cultures
    if (!r) return 0; // no penalty for others if there is no river
    return Math.min(Math.max(cells.fl[i] / 10, 20), 100) // river penalty from 20 to 100 based on flux
  }

  function getTypeCost(t, type) {
    if (t === 1) return type === "Naval" || type === "Lake" ? 0 : type === "Nomadic" ? 60 : 20; // penalty for coastline
    if (t === 2) return type === "Naval" || type === "Nomadic" ? 30 : 0; // low penalty for land level 2 for Navals and nomads
    if (t !== -1) return type === "Naval" || type === "Lake" ? 100 : 0;  // penalty for mainland for navals
    return 0;
  }

  return {generate, add, expand, getDefault};

})));
