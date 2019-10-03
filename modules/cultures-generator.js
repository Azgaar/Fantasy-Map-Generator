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
    });

    // the first culture with id 0 is for wildlands
    pack.cultures.unshift({name:"Wildlands", i:0, base:1});

    // check whether all bases are valid. If not, load default namesbase
    const invalidBase = pack.cultures.some(c => !nameBases[c.base]);
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
      if ((f.cells < 10 && cells.harbor[i]) || (cells.harbor[i] === 1 && Math.random() < .5)) return "Naval"; // low water cross penalty and high for non-along-coastline growth
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

    if (culturesSet.value === "highFantasy") {
      return [
        {name:ra(["Umbar","Vanya","Wroda","Cronmi","Etarn","Fauln","Gondin","Hernami","Ithinda","Jaundal"]), base:32, odd: 1},
        {name:ra(["Mithlun","Deru","Baen","Nimic","Amdar","Nevaer","Pendra","Morid","Enad","Tullid"]), base:32, odd: .8},
        {name:ra(["Kelim","Lemra","Ondan","Quixot","Ranoy","Hondan","Talmun","Arba","Gruni","Tacha"]), base:32, odd: .5},
        {name:Names.getBaseShort(32), base:32, odd: .2},
        // Human African cultures (Swahili, Nigerian)
        {name:ra(["Unbu","Fala","Yabir","Nadi","Turu","Nubir","Bertu","Swada","Guon","Duir"]), base:ra([28,21]), odd: .5},
        {name:ra(["Misaad","Tiga","Yana","Julo","Tanu","Danga","Ezaza","Yud","Oroba","Zula"]), base:ra([28,21]), odd: .3},
        {name:Names.getBaseShort(28), base:28, odd: .1},
        // Human oriental cultures (Chinese, Korean, Japanese)
        {name:ra(["Quian","Nihan", "Akai","Huin","Jandai","Kuita","Feng","Sang","Yuhong","Zhonyu"]), base:ra([11,10,12]), odd: .5},
        {name:ra(["Jumun", "Usei","Rinu","Yataro","Jaelin","Sasung","Oyo","Yaun","Lamlei","Ochato"]), base:ra([11,10,12]), odd: .3},
        {name:Names.getBaseShort(11), base:11, odd: .1},
        // Human nomadic cultures (Berber, Arabic, Turkish, Mongolian)
        {name:ra(["Yird","Zaja","Omuk","Daziji","Harad", "Burja","Khosat","Ongal","Jingan", "Bagharin"]), base:ra([17,18,16,31]), odd: .5},
        {name:ra(["Dal", "Qeduin","Damar","Yeduin","Buzakh","Argol","Monthar","Suul", "Azurid","Oran"]), base:ra([17,18,16,31]), odd: .3},
        {name:Names.getBaseShort(31), base:31, odd: .1},
        // Elven cultures (Elven, Dark Elven)
        {name:ra(["Lossal","Aeval","Alar","Taltari","Elavar","Selane","Lahsa","Vendilae","Endaree","Altawe","Aldar"]), base:33, odd: .9},
        {name:ra(["Dokkal","Drauga","Ulsin","Undril","Eldazan","Velas","Waendir","Cindil","Dhantyr","Uldar"]), base:34, odd: .9},
        {name:Names.getBaseShort(33), base:33, odd: .1},
        {name:Names.getBaseShort(34), base:34, odd: .1},
        // Dwarven cultures
        {name:ra(["Garadur","Kalemund","Khazram","Norgath","Zardum","Ulthar","Tumunz","Shatharn","Nuldalar","Azkadun"]), base:35, odd: 1},
        {name:Names.getBaseShort(35), base:35, odd: .1},
        // Orcic cultures
        {name:ra(["Oruk","Ulg","Quigg","Rughar","Rikagh","Brundh","Kaldag","Umogg","Verug","Rekh"]), base:37, odd: .8},
        {name:Names.getBaseShort(37), base:37, odd: .1},
        // Goblin cultures
        {name:ra(["Grubi","Gobbun","Bogog","Katong","Ziggag","Nildac","Blygg","Yagnob","Dulb","Gibog"]), base:36, odd: .7},
        {name:Names.getBaseShort(36), base:36, odd: .1},
        // Draconic cultures
        {name:ra(["Drache","Alduun","Tiranax","Firosos","Daavor","Sakaal","Oruniin","Rigaal","Diiru","Velrit"]), base:39, odd: .3},
        {name:Names.getBaseShort(39), base:39, odd: .05},
        // Arachnid cultures
        {name:ra(["Aranee","Yoraz","Zhizu","On'Omi","Xantha","Qalan","Yeqir","Zheer","Shirrox","Khra'La"]), base:40, odd: .2},
        {name:Names.getBaseShort(40), base:40, odd: .05},
        // Serpents (snakes) cultures
        {name:ra(["Najar","Saj","Vultess","Solkush","Vekis","Zeriss","Ci'Kush","Kophyss","Sal'Har","Surresh"]), base:41, odd: .2},
        {name:Names.getBaseShort(41), base:41, odd: .05},
        // Giants cultures
        {name:ra(["Gorth","Volkar","Barak","Suvrok","Dughal","Ranag","Undur","Kakarn","Dalken","Grimgar"]), base:38, odd: .2},
        {name:Names.getBaseShort(38), base:38, odd: .05}
      ];
    }

    if (culturesSet.value === "darkFantasy") {
      const west = ra([0,1,2,3,4,6]); // real-world western
      const east = ra([10,11,12,26,29,30]); // real-world oriental
      const randReal = rand(31); // reql-world random
      const randFantasy = rand(35, 39); // fantasy random (except frequently used)

      return [
        {name:ra(["Gluum","Dregg","Crimna","Grimmer","Plagan","Gretan","Maeldar","Peyon","Waeri","Creven"]), base:32, odd: 1},
        {name:Names.getBaseShort(32), base:32, odd: .4},
        {name:Names.getBaseShort(west), base:west, odd: .4},
        {name:Names.getBaseShort(west), base:west, odd: 4},
        {name:Names.getBaseShort(west), base:west, odd: .4},
        {name:Names.getBaseShort(east), base:east, odd: .4},
        {name:Names.getBaseShort(randReal), base:randReal, odd: .4},
        {name:Names.getBaseShort(randReal), base:randReal, odd: .4},
        {name:Names.getBaseShort(randFantasy), base:randFantasy, odd: .4},
        {name:ra(["Drauer","Svartal","Ulsin","Druchan","Eldazar","Velaz","Waendir","Cryndil","Vhantyr","Uldaga"]), base: 34, odd: .8},
        {name:Names.getBaseShort(34), base:34, odd: .2},
        {name:ra(["Necrin","Yoraz","Zhizu","On'Omi","Xantha","Qalan","Yeqir","Zheer","Shirrox","Khra'La"]), base:40, odd: .6},
        {name:Names.getBaseShort(40), base:40, odd: .1},
        {name:ra(["Najaq","Saja","Zultesh","Solkuss","Sekrys","Verish","Ji'Suu","Kophress","Sul'Vhas","Surraj"]), base:41, odd: .6},
        {name:Names.getBaseShort(41), base:41, odd: .1}
      ]
    }

    if (culturesSet.value === "lowFantasy") {
      return [
        // real-world cultures
        {name:ra(["Misaad","Tiga","Yana","Julo","Tanu","Danga","Ezaza","Yud","Oroba","Zula"]), base:ra([28,21]), odd: .7},
        {name:ra(["Unbu","Fala","Yabir","Nadi","Turu","Nubir","Bertu","Swada","Guon","Duir"]), base:ra([28,21]), odd: .4},
        {name:ra(["Jumun", "Usei","Rinu","Yataro","Jaelin","Sasung","Oyo","Yaun","Lamlei","Ochato"]), base:ra([11,10,12]), odd: .7},
        {name:ra(["Quian","Nihan", "Akai","Huin","Jandai","Kuita","Feng","Sang","Yuhong","Zhonyu"]), base:ra([11,10,12]), odd: .4},
        {name:ra(["Dal", "Qeduin","Damar","Yeduin","Buzakh","Argol","Monthar","Suul", "Azurid","Oran"]), base:ra([18,16,31]), odd: .7},
        {name:ra(["Yird","Zaja","Omuk","Daziji","Harad", "Burja","Khosat","Ongal","Jingan", "Bagharin"]), base:ra([18,16,31]), odd: .4},
        {name:ra(["Muerid","Atau","Olvid","Carani","Incora","Fastama","Tusange","Captiur","Tristei","Duila"]), base:ra([2,3,4]), odd: .6},
        {name:ra(["Vergen","Todir","Angest","Duncein","Mordane","Ungeran","Slaktan","Pijini","Joldamor","Kelfang"]), base:ra([0,6]), odd: .5},
        {name:ra(["Vaer","Hayal","Fajalan","Banta","Feled","Unohda","Kuolemi","Hatamur","Inhortu","Rienau"]), base:ra([9,15]),odd: .5},
        {name:ra(["Semerta","Rezyn","Stragh","Otchza","Rabini","Yamak","Nocht","Erstoz","Vozha","Vukod"]), base:5, odd: .6},
        {name:ra(["Itzil","Itoza","Beldur","Minaz","Etsipian","Gurean","Morrai","Hiloga","Gurrusi","Beldurn"]), base:20, odd: .2},
        {name:ra(["Kongji","Qishin","Moushi","Wuhui","Zhaozei","Tushada","Shai","Xingzhi","Jukong","Tiantao"]), base:ra([30, 11]), odd: .5},
        // human cultures
        {name:ra(["Mithlun","Deru","Baen","Nimic","Amdar","Nevaer","Pendra"]), base:32, odd: 1},
        {name:ra(["Morid","Enad","Tullid","Kelim","Lemra","Ondan","Fargunia"]), base:32, odd: 1},
        {name:ra(["Quixot","Ranoy","Hondan","Talmun","Arba","Gruni","Tacha"]), base:32, odd: 1},
        {name:ra(["Gluum","Dregg","Crimna","Grimmer","Plagan","Gretan","Jaundal"]), base:32, odd: .5},
        {name:ra(["Cronmi","Etarn","Fauln","Gondin","Hernami","Ithinda"]), base:32, odd: .5},
        {name:ra(["Peyon","Waeri","Creven","Umbar","Vanya","Wroda","Maeldar"]), base:32, odd: .5},
        // non-human cultures
        {name:ra(["Lossal","Aeval","Alar","Taltari","Elavar","Selane","Lahsa","Vendilae","Endaree","Altawe","Aldar"]), base:33, odd: .2},
        {name:ra(["Garadur","Kalemund","Khazram","Norgath","Zardum","Ulthar","Tumunz","Shatharn","Nuldalar","Azkadun"]), base:35, odd: .2},
        {name:ra(["Gorth","Volkar","Barak","Suvrok","Dughal","Ranag","Undur","Kakarn","Dalken","Grimgar"]), base:38, odd: .2}
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
      {name:"Negarian", base: 21, odd: .05},
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

  function getTypeCost(ctype, type) {
    if (ctype === 1) return type === "Naval" || type === "Lake" ? 0 : type === "Nomadic" ? 60 : 20; // penalty for coastline
    if (ctype === 2) return type === "Naval" || type === "Nomadic" ? 30 : 0; // low penalty for land level 2 for Navals and nomads
    if (ctype !== -1) return type === "Naval" || type === "Lake" ? 100 : 0;  // penalty for mainland for navals
    return 0;
  }

  return {generate, expand, getDefault};

})));