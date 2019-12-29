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
    let count = Math.min(+culturesInput.value, +culturesSet.selectedOptions[0].dataset.max);

    const populated = cells.i.filter(i => cells.s[i]); // populated cells
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

    cultures.forEach(function(c, i) {
      const cell = c.center = placeCenter(c.sort ? c.sort : (i) => cells.s[i]);
      centers.add(cells.p[cell]);
      c.i = i+1;
      delete c.odd;
      delete c.sort;
      c.color = colors[i];
      c.type = defineCultureType(cell);
      c.expansionism = defineCultureExpansionism(c.type);
      c.origin = 0;
      c.code = getCode(c.name);
      cells.culture[cell] = i+1;
    });

    function placeCenter(v) {
      let c, spacing = (graphWidth + graphHeight) / 2 / count;
      const sorted = [...populated].sort((a, b) => v(b) - v(a)), max = Math.floor(sorted.length / 2);
      do {c = sorted[biased(0, max, 5)]; spacing *= .9;}
      while (centers.find(cells.p[c][0], cells.p[c][1], spacing) !== undefined);
      return c;
    }

    // the first culture with id 0 is for wildlands
    cultures.unshift({name:"Wildlands", i:0, base:1, origin:null});

    // make sure all bases exist in nameBases
    if (!nameBases.length) {console.error("Name base is empty, default nameBases will be applied"); nameBases = Names.getNameBases();}
    cultures.forEach(c => c.base = c.base % nameBases.length);

    function getRandomCultures(c) {
      const d = getDefault(c), n = d.length-1;
      const count = Math.min(c, d.length);
      const cultures = [];
      while (cultures.length < count) {
        let culture = d[rand(n)];
        do {
          culture = d[rand(n)];
        } while (!P(culture.odd) || cultures.find(c => c.name === culture.name))
        cultures.push(culture);
      }
      return cultures;
    }

    // set culture type based on culture center position
    function defineCultureType(i) {
      if (cells.h[i] < 70 && [1,2,4].includes(cells.biome[i])) return "Nomadic"; // high penalty in forest biomes and near coastline
      if (cells.h[i] > 50) return "Highland"; // no penalty for hills and moutains, high for other elevations
      const f = pack.features[cells.f[cells.haven[i]]]; // opposite feature
      if (f.type === "lake" && f.cells > 5) return "Lake" // low water cross penalty and high for growth not along coastline
      if (cells.harbor[i] && f.type !== "lake" && P(.1) || (cells.harbor[i] === 1 && P(.6)) || (pack.features[cells.f[i]].group === "isle" && P(.4))) return "Naval"; // low water cross penalty and high for non-along-coastline growth
      if (cells.r[i] && cells.fl[i] > 100) return "River"; // no River cross penalty, penalty for non-River growth
      if (cells.t[i] > 2 && [3,7,8,9,10,12].includes(cells.biome[i])) return "Hunting"; // high penalty in non-native biomes
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
    // generic sorting functions
    const cells = pack.cells, s = cells.s, sMax = d3.max(s), t = cells.t, h = cells.h, temp = grid.cells.temp;
    const n = cell => Math.ceil(s[cell] / sMax * 3) // normalized cell score
    const td = (cell, goal) => {const d = Math.abs(temp[cells.g[cell]] - goal); return d ? d+1 : 1;} // temperature difference fee
    const bd = (cell, biomes, fee = 4) => biomes.includes(cells.biome[cell]) ? 1 : fee; // biome difference fee
    const sf = (cell, fee = 4) => cells.haven[cell] && pack.features[cells.f[cells.haven[cell]]].type !== "lake" ? 1 : fee; // not on sea coast fee
    // https://en.wikipedia.org/wiki/List_of_cities_by_average_temperature

    if (culturesSet.value === "european") {
      return [
        {name:"Shwazen", base:0, odd: 1, sort: i => n(i) / td(i, 10) / bd(i, [6, 8])},
        {name:"Angshire", base:1, odd: 1, sort: i => n(i) / td(i, 10) / sf(i)},
        {name:"Luari", base:2, odd: 1, sort: i => n(i) / td(i, 12) / bd(i, [6, 8])},
        {name:"Tallian", base:3, odd: 1, sort: i => n(i) / td(i, 15)},
        {name:"Astellian", base:4, odd: 1, sort: i => n(i) / td(i, 16)},
        {name:"Slovan", base:5, odd: 1, sort: i => n(i) / td(i, 6) * t[i]},
        {name:"Norse", base:6, odd: 1, sort: i => n(i) / td(i, 5)},
        {name:"Elladan", base:7, odd: 1, sort: i => n(i) / td(i, 18) * h[i]},
        {name:"Romian", base:8, odd: .2, sort: i => n(i) / td(i, 15) / t[i]},
        {name:"Soumi", base:9, odd: 1, sort: i => n(i) / td(i, 5) / bd(i, [9]) * t[i]},
        {name:"Portuzian", base:13, odd: 1, sort: i => n(i) / td(i, 17) / sf(i)},
        {name:"Vengrian", base: 15, odd: 1, sort: i => n(i) / td(i, 11) / bd(i, [4]) * t[i]},
        {name:"Turchian", base: 16, odd: .05, sort: i => n(i) / td(i, 14)},
        {name:"Euskati", base: 20, odd: .05, sort: i => n(i) / td(i, 15) * h[i]},
        {name:"Keltan", base: 22, odd: .05, sort: i => n(i) / td(i, 11) / bd(i, [6, 8]) * t[i]}
      ];
    }

    if (culturesSet.value === "oriental") {
      return [
        {name:"Koryo", base:10, odd: 1, sort: i => n(i) / td(i, 12) / t[i]},
        {name:"Hantzu", base:11, odd: 1, sort: i => n(i) / td(i, 13)},
        {name:"Yamoto", base:12, odd: 1, sort: i => n(i) / td(i, 15) / t[i]},
        {name:"Turchian", base: 16, odd: 1, sort: i => n(i) / td(i, 12)},
        {name:"Berberan", base: 17, odd: .2, sort: i => n(i) / td(i, 19) / bd(i, [1, 2, 3], 7) * t[i]},
        {name:"Eurabic", base: 18, odd: 1, sort: i => n(i) / td(i, 26) / bd(i, [1, 2], 7) * t[i]},
        {name:"Efratic", base: 23, odd: .1, sort: i => n(i) / td(i, 22) * t[i]},
        {name:"Tehrani", base: 24, odd: 1, sort: i => n(i) / td(i, 18) * h[i]},
        {name:"Maui", base: 25, odd: .2, sort: i => n(i) / td(i, 24) / sf(i) / t[i]},
        {name:"Carnatic", base: 26, odd: .5, sort: i => n(i) / td(i, 26)},
        {name:"Vietic", base: 29, odd: .8, sort: i => n(i) / td(i, 25) / bd(i, [7], 7) / t[i]},
        {name:"Guantzu", base:30, odd: .5, sort: i => n(i) / td(i, 17)},
        {name:"Ulus", base:31, odd: 1, sort: i => n(i) / td(i, 5) / bd(i, [2, 4, 10], 7) * t[i]}
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
        {name:"Roman", base:8, odd: 1, sort: i => n(i) / td(i, 14) / t[i]}, // Roman
        {name:"Roman", base:8, odd: 1, sort: i => n(i) / td(i, 15) / sf(i)}, // Roman
        {name:"Roman", base:8, odd: 1, sort: i => n(i) / td(i, 16) / sf(i)}, // Roman
        {name:"Roman", base:8, odd: 1, sort: i => n(i) / td(i, 17) / t[i]}, // Roman
        {name:"Hellenic", base:7, odd: 1, sort: i => n(i) / td(i, 18) / sf(i) * h[i]}, // Greek
        {name:"Hellenic", base:7, odd: 1, sort: i => n(i) / td(i, 19) / sf(i) * h[i]}, // Greek
        {name:"Macedonian", base:7, odd: .5, sort: i => n(i) / td(i, 12) * h[i]}, // Greek
        {name:"Celtic", base:22, odd: 1, sort: i => n(i) / td(i, 11) ** .5 / bd(i, [6, 8])},
        {name:"Germanic", base:0, odd: 1, sort: i => n(i) / td(i, 10) ** .5 / bd(i, [6, 8])},
        {name:"Persian", base:24, odd: .8, sort: i => n(i) / td(i, 18) * h[i]}, // Iranian
        {name:"Scythian", base:24, odd: .5, sort: i => n(i) / td(i, 11) ** .5 / bd(i, [4])}, // Iranian
        {name:"Cantabrian", base: 20, odd: .5, sort: i => n(i) / td(i, 16) * h[i]}, // Basque
        {name:"Estian", base: 9, odd: .2, sort: i => n(i) / td(i, 5) * t[i]}, // Finnic
        {name:"Carthaginian", base: 17, odd: .3, sort: i => n(i) / td(i, 19) / sf(i)}, // Berber
        {name:"Mesopotamian", base: 23, odd: .2, sort: i => n(i) / td(i, 22) / bd(i, [1, 2, 3])} // Mesopotamian
      ];
    }

    if (culturesSet.value === "highFantasy") {
      return [
        // fantasy races
        {name:"Quenian", base: 33, odd: 1, sort: i => n(i) / bd(i, [6,7,8,9], 10) * t[i]}, // Elves
        {name:"Eldar", base: 33, odd: 1, sort: i => n(i) / bd(i, [6,7,8,9], 10) * t[i]}, // Elves
        {name:"Lorian", base: 33, odd: .5, sort: i => n(i) / bd(i, [6,7,8,9], 10)}, // Elves
        {name:"Trow", base: 34, odd: .9, sort: i => n(i) / bd(i, [7,8,9,12], 10) * t[i]}, // Dark Elves
        {name:"Dokalfar", base: 34, odd: .3, sort: i => n(i) / bd(i, [7,8,9,12], 10) * t[i]}, // Dark Elves
        {name:"Durinn", base: 35, odd: 1, sort: i => n(i) + h[i]}, // Dwarven
        {name:"Khazadur", base: 35, odd: 1, sort: i => n(i) + h[i]}, // Dwarven
        {name:"Kobblin", base: 36, odd: 1, sort: i => t[i] - s[i]}, // Goblin
        {name:"Uruk", base: 37, odd: 1, sort: i => h[i] * t[i]}, // Orc
        {name:"Ugluk", base: 37, odd: .7, sort: i => h[i] * t[i] / bd(i, [1,2,10,11])}, // Orc
        {name:"Yotunn", base: 38, odd: .9, sort: i => td(i, -10)}, // Giant
        {name:"Drake", base: 39, odd: .7, sort: i => -s[i]}, // Draconic
        {name:"Rakhnid", base: 40, odd: .9, sort: i => t[i] - s[i]}, // Arachnid
        {name:"Aj'Snaga", base: 41, odd: .9, sort: i => n(i) / bd(i, [12], 10)}, // Serpents
        // common fantasy human
        {name:"Gozdor", base:32, odd: 1, sort: i => n(i) / td(i, 18)},
        {name:"Anor", base:32, odd: 1, sort: i => n(i) / td(i, 10)},
        {name:"Dail", base:32, odd: 1, sort: i => n(i) / td(i, 13)},
        {name:"Duland", base:32, odd: 1, sort: i => n(i) / td(i, 14)},
        {name:"Rohand", base:32, odd: 1, sort: i => n(i) / td(i, 16)},
        // rare real-world western
        {name:"Norse", base:6, odd: .5, sort: i => n(i) / td(i, 5) / sf(i)},
        {name:"Izenlute", base:0, odd: .1, sort: i => n(i) / td(i, 5)},
        {name:"Lurian", base:2, odd: .1, sort: i => n(i) / td(i, 12) / bd(i, [6, 8])},
        {name:"Getalian", base:3, odd: .1, sort: i => n(i) / td(i, 15)},
        {name:"Astelan", base:4, odd: .05, sort: i => n(i) / td(i, 16)},
        // rare real-world exotic
        {name:"Yoruba", base:21, odd: .05, sort: i => n(i) / td(i, 15) / bd(i, [5, 7])},
        {name:"Ryoko", base:10, odd: .05, sort: i => n(i) / td(i, 12) / t[i]},
        {name:"Toyamo", base:12, odd: .05, sort: i => n(i) / td(i, 15) / t[i]},
        {name:"Guan-Tsu", base:30, odd: .05, sort: i => n(i) / td(i, 17)},
        {name:"Ulus-Khan", base:31, odd: .05, sort: i => n(i) / td(i, 5) / bd(i, [2, 4, 10], 7) * t[i]},
        {name:"Turan", base: 16, odd: .05, sort: i => n(i) / td(i, 13)},
        {name:"Al'Uma", base: 18, odd: .05, sort: i => n(i) / td(i, 26) / bd(i, [1, 2], 7) * t[i]},
        {name:"Druidas", base: 22, odd: .05, sort: i => n(i) / td(i, 11) / bd(i, [6, 8]) * t[i]},
        {name:"Gorodian", base:5, odd: .05, sort: i => n(i) / td(i, 6) * t[i]}
      ];
    }

    if (culturesSet.value === "darkFantasy") {
      return [
        // common real-world English
        {name:"Angshire", base:1, odd: 1, sort: i => n(i) / td(i, 10) / sf(i)},
        {name:"Enlandic", base:1, odd: 1, sort: i => n(i) / td(i, 12)},
        {name:"Westen", base:1, odd: 1, sort: i => n(i) / td(i, 10)},
        {name:"Nortumbic", base:1, odd: 1, sort: i => n(i) / td(i, 7)},
        {name:"Mercian", base:1, odd: 1, sort: i => n(i) / td(i, 9)},
        {name:"Kentian", base:1, odd: 1, sort: i => n(i) / td(i, 12)},
        // rare real-world western
        {name:"Norse", base:6, odd: .7, sort: i => n(i) / td(i, 5) / sf(i)},
        {name:"Schwarzen", base:0, odd: .3, sort: i => n(i) / td(i, 10) / bd(i, [6, 8])},
        {name:"Luarian", base:2, odd: .3, sort: i => n(i) / td(i, 12) / bd(i, [6, 8])},
        {name:"Hetallian", base:3, odd: .3, sort: i => n(i) / td(i, 15)},
        {name:"Astellian", base:4, odd: .3, sort: i => n(i) / td(i, 16)},
        // rare real-world exotic
        {name:"Kiswaili", base:28, odd: .05, sort: i => n(i) / td(i, 29) / bd(i, [1, 3, 5, 7])},
        {name:"Yoruba", base:21, odd: .05, sort: i => n(i) / td(i, 15) / bd(i, [5, 7])},
        {name:"Koryo", base:10, odd: .05, sort: i => n(i) / td(i, 12) / t[i]},
        {name:"Hantzu", base:11, odd: .05, sort: i => n(i) / td(i, 13)},
        {name:"Yamoto", base:12, odd: .05, sort: i => n(i) / td(i, 15) / t[i]},
        {name:"Guantzu", base:30, odd: .05, sort: i => n(i) / td(i, 17)},
        {name:"Ulus", base:31, odd: .05, sort: i => n(i) / td(i, 5) / bd(i, [2, 4, 10], 7) * t[i]},
        {name:"Turan", base: 16, odd: .05, sort: i => n(i) / td(i, 12)},
        {name:"Berberan", base: 17, odd: .05, sort: i => n(i) / td(i, 19) / bd(i, [1, 2, 3], 7) * t[i]},
        {name:"Eurabic", base: 18, odd: .05, sort: i => n(i) / td(i, 26) / bd(i, [1, 2], 7) * t[i]},
        {name:"Slovan", base:5, odd: .05, sort: i => n(i) / td(i, 6) * t[i]},
        {name:"Keltan", base: 22, odd: .1, sort: i => n(i) / td(i, 11) ** .5 / bd(i, [6, 8])},
        {name:"Elladan", base:7, odd: .2, sort: i => n(i) / td(i, 18) / sf(i) * h[i]},
        {name:"Romian", base:8, odd: .2, sort: i => n(i) / td(i, 14) / t[i]},
        // fantasy races
        {name:"Eldar", base: 33, odd: .5, sort: i => n(i) / bd(i, [6,7,8,9], 10) * t[i]}, // Elves
        {name:"Trow", base: 34, odd: .8, sort: i => n(i) / bd(i, [7,8,9,12], 10) * t[i]}, // Dark Elves
        {name:"Durinn", base: 35, odd: .8, sort: i => n(i) + h[i]}, // Dwarven
        {name:"Kobblin", base: 36, odd: .8, sort: i => t[i] - s[i]}, // Goblin
        {name:"Uruk", base: 37, odd: .8, sort: i => h[i] * t[i] / bd(i, [1,2,10,11])}, // Orc
        {name:"Yotunn", base: 38, odd: .8, sort: i => td(i, -10)}, // Giant
        {name:"Drake", base: 39, odd: .9, sort: i => -s[i]}, // Draconic
        {name:"Rakhnid", base: 40, odd: .9, sort: i => t[i] - s[i]}, // Arachnid
        {name:"Aj'Snaga", base: 41, odd: .9, sort: i => n(i) / bd(i, [12], 10)}, // Serpents
      ]
    }

    if (culturesSet.value === "random") {
      return d3.range(count).map(i => {
        const rnd = rand(nameBases.length-1);
        return {name:Names.getBaseShort(rnd), base:rnd, odd: 1}
      });
    }

    // all-world
    return [
      {name:"Shwazen", base:0, odd: .7, sort: i => n(i) / td(i, 10) / bd(i, [6, 8])},
      {name:"Angshire", base:1, odd: 1, sort: i => n(i) / td(i, 10) / sf(i)},
      {name:"Luari", base:2, odd: .6, sort: i => n(i) / td(i, 12) / bd(i, [6, 8])},
      {name:"Tallian", base:3, odd: .6, sort: i => n(i) / td(i, 15)},
      {name:"Astellian", base:4, odd: .6, sort: i => n(i) / td(i, 16)},
      {name:"Slovan", base:5, odd: .7, sort: i => n(i) / td(i, 6) * t[i]},
      {name:"Norse", base:6, odd: .7, sort: i => n(i) / td(i, 5)},
      {name:"Elladan", base:7, odd: .7, sort: i => n(i) / td(i, 18) * h[i]},
      {name:"Romian", base:8, odd: .7, sort: i => n(i) / td(i, 15)},
      {name:"Soumi", base:9, odd: .3, sort: i => n(i) / td(i, 5) / bd(i, [9]) * t[i]},
      {name:"Koryo", base:10, odd: .1, sort: i => n(i) / td(i, 12) / t[i]},
      {name:"Hantzu", base:11, odd: .1, sort: i => n(i) / td(i, 13)},
      {name:"Yamoto", base:12, odd: .1, sort: i => n(i) / td(i, 15) / t[i]},
      {name:"Portuzian", base:13, odd: .4, sort: i => n(i) / td(i, 17) / sf(i)},
      {name:"Nawatli", base:14, odd: .1, sort: i => h[i] / td(i, 18) / bd(i, [7])},
      {name:"Vengrian", base: 15, odd: .2, sort: i => n(i) / td(i, 11) / bd(i, [4]) * t[i]},
      {name:"Turchian", base: 16, odd: .2, sort: i => n(i) / td(i, 13)},
      {name:"Berberan", base: 17, odd: .1, sort: i => n(i) / td(i, 19) / bd(i, [1, 2, 3], 7) * t[i]},
      {name:"Eurabic", base: 18, odd: .2, sort: i => n(i) / td(i, 26) / bd(i, [1, 2], 7) * t[i]},
      {name:"Inuk", base: 19, odd: .05, sort: i => td(i, -1) / bd(i, [10, 11]) / sf(i)},
      {name:"Euskati", base: 20, odd: .05, sort: i => n(i) / td(i, 15) * h[i]},
      {name:"Yoruba", base: 21, odd: .05, sort: i => n(i) / td(i, 15) / bd(i, [5, 7])},
      {name:"Keltan", base: 22, odd: .05, sort: i => n(i) / td(i, 11) / bd(i, [6, 8]) * t[i]},
      {name:"Efratic", base: 23, odd: .05, sort: i => n(i) / td(i, 22) * t[i]},
      {name:"Tehrani", base: 24, odd: .1, sort: i => n(i) / td(i, 18) * h[i]},
      {name:"Maui", base: 25, odd: .05, sort: i => n(i) / td(i, 24) / sf(i) / t[i]},
      {name:"Carnatic", base: 26, odd: .05, sort: i => n(i) / td(i, 26)},
      {name:"Inqan", base: 27, odd: .05, sort: i => h[i] / td(i, 13)},
      {name:"Kiswaili", base: 28, odd: .1, sort: i => n(i) / td(i, 29) / bd(i, [1, 3, 5, 7])},
      {name:"Vietic", base: 29, odd: .1, sort: i => n(i) / td(i, 25) / bd(i, [7], 7) / t[i]},
      {name:"Guantzu", base:30, odd: .1, sort: i => n(i) / td(i, 17)},
      {name:"Ulus", base:31, odd: .1, sort: i => n(i) / td(i, 5) / bd(i, [2, 4, 10], 7) * t[i]}
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
