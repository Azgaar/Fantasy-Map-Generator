import * as d3 from "d3";
import FlatQueue from "flatqueue";

import {TIME, WARN} from "config/logging";
import {getColors} from "utils/colorUtils";
import {rn, minmax} from "utils/numberUtils";
import {rand, P, biased} from "utils/probabilityUtils";
import {abbreviate} from "utils/languageUtils";
import {getInputNumber, getInputValue, getSelectedOption} from "utils/nodeUtils";
import {byId} from "utils/shorthands";
import {cultureSets, TCultureSetName} from "config/cultureSets";

const {COA} = window;

window.Cultures = (function () {
  let cells: IGraphCells & IPackCells;

  const generate = function (pack: IPack) {
    TIME && console.time("generateCultures");
    cells = pack.cells;

    const wildlands = {name: "Wildlands", i: 0, base: 1, origins: [null], shield: "round"};
    const culture = new Uint16Array(cells.i.length); // cell cultures

    const culturesNumber = getCulturesNumber();
    if (!culturesNumber) return {culture, cultures: [wildlands]};

    const culturesData = selectCulturesData(culturesNumber);
    const centers = d3.quadtree();
    const colors = getColors(culturesNumber);
    const emblemShape = getInputValue("emblemShape");

    const codes: string[] = [];

    const cultures = culturesData.map(function (c, i) {
      const cell = (c.center = placeCenter(c.sort ? c.sort : i => cells.s[i]));
      centers.add(cells.p[cell]);
      c.i = i + 1;
      delete c.odd;
      delete c.sort;
      c.color = colors[i];
      c.type = defineCultureType(cell);
      c.expansionism = defineCultureExpansionism(c.type);
      c.origins = [0];
      c.code = abbreviate(c.name, codes);
      codes.push(c.code);
      cells.culture[cell] = i + 1;
      if (emblemShape === "random") c.shield = COA.getRandomShield();
    });

    function placeCenter(v) {
      let c,
        spacing = (graphWidth + graphHeight) / 2 / culturesNumber;
      const sorted = [...populated].sort((a, b) => v(b) - v(a)),
        max = Math.floor(sorted.length / 2);
      do {
        c = sorted[biased(0, max, 5)];
        spacing *= 0.9;
      } while (centers.find(cells.p[c][0], cells.p[c][1], spacing) !== undefined);
      return c;
    }

    // the first culture with id 0 is for wildlands
    cultures.unshift(wildlands);

    // make sure all bases exist in nameBases
    if (!nameBases.length) {
      ERROR && console.error("Name base is empty, default nameBases will be applied");
      nameBases = Names.getNameBases();
    }

    cultures.forEach(c => (c.base = c.base % nameBases.length));

    TIME && console.timeEnd("generateCultures");
    return {culture, cultures};

    function getCulturesNumber() {
      const culturesDesired = getInputNumber("culturesInput");
      const culturesAvailable = Number(getSelectedOption("culturesSet").dataset.max);
      const expectedNumber = Math.min(culturesDesired, culturesAvailable);

      const populatedCells = cells.pop.reduce((prev, curr) => prev + (curr > 0 ? 1 : 0), 0);

      // normal case, enough populated cells to generate cultures
      if (populatedCells >= expectedNumber * 25) return expectedNumber;

      // not enough populated cells, reduce count
      const reducedNumber = Math.floor(populatedCells / 50);

      if (reducedNumber > 0) {
        WARN &&
          console.warn(`Not enough populated cells (${populatedCells}). Will generate only ${reducedNumber} cultures`);

        byId("alertMessage")!.innerHTML = `Insufficient liveable area: ${populatedCells} populated cells.<br />
          Only ${reducedNumber} out of ${culturesDesired} requested cultures can be created.<br />
          Please consider changing climate settings in the World Configurator`;
      } else {
        WARN && console.warn(`No populated cells. Cannot generate cultures`);

        byId("alertMessage")!.innerHTML = `The climate is harsh and people cannot live in this world.<br />
          No cultures, states and burgs will be created.<br />
          Please consider changing climate settings in the World Configurator`;
      }

      $("#alert").dialog({
        resizable: false,
        title: "Extreme climate warning",
        buttons: {
          Ok: function () {
            $(this).dialog("close");
          }
        }
      });

      return reducedNumber;
    }

    function selectCulturesData(culturesNumber: number) {
      let defaultCultures = getDefault(culturesNumber);
      if (defaultCultures.length === culturesNumber) return defaultCultures;
      if (defaultCultures.every(d => d.odd === 1)) return defaultCultures.slice(0, culturesNumber);

      const culturesAvailable = Math.min(culturesNumber, defaultCultures.length);
      const cultures = [];

      for (let culture, rnd, i = 0; cultures.length < culturesAvailable && i < 200; i++) {
        do {
          rnd = rand(defaultCultures.length - 1);
          culture = defaultCultures[rnd];
        } while (!P(culture.odd));
        cultures.push(culture);
        defaultCultures.splice(rnd, 1);
      }

      return cultures;
    }

    // set culture type based on culture center position
    function defineCultureType(i) {
      if (cells.h[i] < 70 && [1, 2, 4].includes(cells.biome[i])) return "Nomadic"; // high penalty in forest biomes and near coastline
      if (cells.h[i] > 50) return "Highland"; // no penalty for hills and moutains, high for other elevations
      const f = pack.features[cells.f[cells.haven[i]]]; // opposite feature
      if (f.type === "lake" && f.cells > 5) return "Lake"; // low water cross penalty and high for growth not along coastline
      if (
        (cells.harbor[i] && f.type !== "lake" && P(0.1)) ||
        (cells.harbor[i] === 1 && P(0.6)) ||
        (pack.features[cells.f[i]].group === "isle" && P(0.4))
      )
        return "Naval"; // low water cross penalty and high for non-along-coastline growth
      if (cells.r[i] && cells.fl[i] > 100) return "River"; // no River cross penalty, penalty for non-River growth
      if (cells.t[i] > 2 && [3, 7, 8, 9, 10, 12].includes(cells.biome[i])) return "Hunting"; // high penalty in non-native biomes
      return "Generic";
    }

    function defineCultureExpansionism(type) {
      let base = 1; // Generic
      if (type === "Lake") base = 0.8;
      else if (type === "Naval") base = 1.5;
      else if (type === "River") base = 0.9;
      else if (type === "Nomadic") base = 1.5;
      else if (type === "Hunting") base = 0.7;
      else if (type === "Highland") base = 1.2;
      return rn(((Math.random() * powerInput.value) / 2 + 1) * base, 1);
    }
  };

  const add = function (center) {
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
    const code = abbreviate(
      name,
      pack.cultures.map(c => c.code)
    );
    const i = pack.cultures.length;
    const color = d3.color(d3.scaleSequential(d3.interpolateRainbow)(Math.random())).hex();

    // define emblem shape
    let shield = culture.shield;
    const emblemShape = document.getElementById("emblemShape").value;
    if (emblemShape === "random") shield = COA.getRandomShield();

    pack.cultures.push({
      name,
      color,
      base,
      center,
      i,
      expansionism: 1,
      type: "Generic",
      cells: 0,
      area: 0,
      rural: 0,
      urban: 0,
      origins: [0],
      code,
      shield
    });
  };

  const getDefault = function (culturesNumber: number) {
    // // generic sorting functions
    // const {cells} = pack;
    // const {s, t, h} = cells;
    // const temp = grid.cells.temp;

    // const sMax = d3.max(s)!;

    // // normalized cell score
    // const n = cell => Math.ceil((s[cell] / sMax) * 3);

    // // temperature difference fee
    // const td = (cell, goal) => {
    //   const d = Math.abs(temp[cells.g[cell]] - goal);
    //   return d ? d + 1 : 1;
    // };

    // // biome difference fee
    // const bd = (cell, biomes, fee = 4) => (biomes.includes(cells.biome[cell]) ? 1 : fee);

    // // not on sea coast fee
    // const sf = (cell, fee = 4) =>
    //   cells.haven[cell] && pack.features[cells.f[cells.haven[cell]]].type !== "lake" ? 1 : fee;

    const cultureSet = getInputValue("culturesSet") as TCultureSetName;
    if (cultureSet in cultureSets) {
      return cultureSets[cultureSet](culturesNumber);
    }

    throw new Error(`Unsupported culture set: ${cultureSet}`);
  };

  // expand cultures across the map (Dijkstra-like algorithm)
  const expand = function () {
    TIME && console.time("expandCultures");
    cells = pack.cells;

    const queue = new FlatQueue();
    pack.cultures.forEach(culture => {
      if (!culture.i || culture.removed) return;
      queue.push({cellId: culture.center, cultureId: culture.i}, 0);
    });

    const neutral = (cells.i.length / 5000) * 3000 * neutralInput.value; // limit cost for culture growth
    const cost = [];

    while (queue.length) {
      const priority = queue.peekValue();
      const {cellId, cultureId} = queue.pop();

      const type = pack.cultures[cultureId].type;
      cells.c[cellId].forEach(neibCellId => {
        const biome = cells.biome[neibCellId];
        const biomeCost = getBiomeCost(cultureId, biome, type);
        const biomeChangeCost = biome === cells.biome[cellId] ? 0 : 20; // penalty on biome change
        const heightCost = getHeightCost(neibCellId, cells.h[neibCellId], type);
        const riverCost = getRiverCost(cells.r[neibCellId], neibCellId, type);
        const typeCost = getTypeCost(cells.t[neibCellId], type);
        const totalCost =
          priority +
          (biomeCost + biomeChangeCost + heightCost + riverCost + typeCost) / pack.cultures[cultureId].expansionism;

        if (totalCost > neutral) return;

        if (!cost[neibCellId] || totalCost < cost[neibCellId]) {
          if (cells.s[neibCellId] > 0) cells.culture[neibCellId] = cultureId; // assign culture to populated cell
          cost[neibCellId] = totalCost;
          queue.push({cellId: neibCellId, cultureId}, totalCost);
        }
      });
    }

    TIME && console.timeEnd("expandCultures");
  };

  function getBiomeCost(c, biome, type) {
    if (cells.biome[pack.cultures[c].center] === biome) return 10; // tiny penalty for native biome
    if (type === "Hunting") return biomesData.cost[biome] * 5; // non-native biome penalty for hunters
    if (type === "Nomadic" && biome > 4 && biome < 10) return biomesData.cost[biome] * 10; // forest biome penalty for nomads
    return biomesData.cost[biome] * 2; // general non-native biome penalty
  }

  function getHeightCost(i, h, type) {
    const f = pack.features[cells.f[i]],
      a = cells.area[i];
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
    return minmax(cells.fl[i] / 10, 20, 100); // river penalty from 20 to 100 based on flux
  }

  function getTypeCost(t, type) {
    if (t === 1) return type === "Naval" || type === "Lake" ? 0 : type === "Nomadic" ? 60 : 20; // penalty for coastline
    if (t === 2) return type === "Naval" || type === "Nomadic" ? 30 : 0; // low penalty for land level 2 for Navals and nomads
    if (t !== -1) return type === "Naval" || type === "Lake" ? 100 : 0; // penalty for mainland for navals
    return 0;
  }

  return {generate, add, expand, getDefault};
})();
