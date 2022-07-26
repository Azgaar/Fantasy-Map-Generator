import * as d3 from "d3";
import FlatQueue from "flatqueue";

import {ERROR, TIME, WARN} from "config/logging";
import {getColors} from "utils/colorUtils";
import {rn, minmax} from "utils/numberUtils";
import {rand, P, biased} from "utils/probabilityUtils";
import {abbreviate} from "utils/languageUtils";
import {getInputNumber, getInputValue, getSelectedOption} from "utils/nodeUtils";
import {byId} from "utils/shorthands";
import {cultureSets, TCultureSetName} from "config/cultureSets";
import {DISTANCE_FIELD, ELEVATION, HUNTING_BIOMES, NOMADIC_BIOMES} from "config/generation";

const {COA, Names} = window;

const cultureTypeBaseExpansionism: {[key in TCultureType]: number} = {
  Generic: 1,
  Lake: 0.8,
  Naval: 1.5,
  River: 0.9,
  Nomadic: 1.5,
  Hunting: 0.7,
  Highland: 1.2
};

const {MOUNTAINS, HILLS} = ELEVATION;
const {LAND_COAST, LANDLOCKED} = DISTANCE_FIELD;

window.Cultures = (function () {
  let cells: IGraphCells & IPackCells;

  const generate = function (pack: IPack): {culture: Uint16Array; cultures: TCultures} {
    TIME && console.time("generateCultures");
    cells = pack.cells;

    const wildlands: IWilderness = {name: "Wildlands", i: 0, base: 1, origins: [null], shield: "round"};
    const culture = new Uint16Array(cells.i.length); // cell cultures

    const populatedCellIds = cells.i.filter(cellId => cells.pop[cellId] > 0);

    const culturesNumber = getCulturesNumber(populatedCellIds.length);
    if (!culturesNumber) return {culture, cultures: [wildlands]};

    const culturesData = selectCulturesData(culturesNumber);
    const colors = getColors(culturesNumber);

    const powerInput = getInputNumber("powerInput");
    const emblemShape = getInputValue("emblemShape");
    const isEmblemShareRandom = emblemShape === "random";

    const codes: string[] = [];
    const centers = d3.quadtree();

    const definedCultures: ICulture[] = culturesData.map((cultureData, index) => {
      const sort = cultureData.sort || "n";
      const sortingFn = new Function("return " + sort);
      const cell = placeCenter(sortingFn);

      const {name} = cultureData;
      const base = checkNamesbase(cultureData.base);
      const color = colors[index];
      const type = defineCultureType(cell);
      const expansionism = defineCultureExpansionism(type);

      const origins = [0];
      const code = abbreviate(name, codes);
      const shield = isEmblemShareRandom ? COA.getRandomShield() : cultureData.shield;

      centers.add(cells.p[cell]);
      codes.push(code);
      cells.culture[cell] = index + 1;

      return {i: index + 1, name, base, cell, color, type, expansionism, origins, code, shield};
    });

    const cultures: TCultures = [wildlands, ...definedCultures];

    TIME && console.timeEnd("generateCultures");

    return {culture, cultures};

    function getCulturesNumber(populatedCells: number) {
      const culturesDesired = getInputNumber("culturesInput");
      const culturesAvailable = Number(getSelectedOption("culturesSet").dataset.max);
      const expectedNumber = Math.min(culturesDesired, culturesAvailable);

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
      if (defaultCultures.length >= culturesNumber) return defaultCultures;

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

    function placeCenter(sort: Function) {
      let c;
      let spacing = (graphWidth + graphHeight) / 2 / culturesNumber;
      const sorted = Array.from(populatedCellIds).sort((a, b) => sort(b) - sort(a));
      const max = Math.floor(sorted.length / 2);

      do {
        c = sorted[biased(0, max, 5)];
        spacing *= 0.9;
      } while (centers.find(cells.p[c][0], cells.p[c][1], spacing) !== undefined);
      return c;
    }

    // set culture type based on culture center position
    function defineCultureType(cellId: number): TCultureType {
      const height = cells.h[cellId];

      if (height > HILLS) return "Highland";

      const biome = cells.biome[cellId];
      if (height < MOUNTAINS && NOMADIC_BIOMES.includes(biome)) return "Nomadic";

      if (cells.t[cellId] === LAND_COAST) {
        const waterFeatureId = cells.f[cells.haven[cellId]];
        const waterFeature = pack.features[waterFeatureId];

        const isBigLakeCoast = waterFeature && waterFeature.type === "lake" && waterFeature.cells > 5;
        if (isBigLakeCoast) return "Lake";

        const isOceanCoast = waterFeature && waterFeature.type === "ocean";
        if (isOceanCoast && P(0.1)) return "Naval";

        const isSafeHarbor = cells.harbor[cellId] === 1;
        if (isSafeHarbor && P(0.6)) return "Naval";

        const cellFeature = pack.features[cells.f[cellId]];
        const isIsle = cellFeature && cellFeature.group === "isle";
        if (isIsle && P(0.4)) return "Naval";
      }

      const isOnBigRiver = cells.r[cellId] && cells.fl[cellId] > 100;
      if (isOnBigRiver) return "River";

      const isDeelyLandlocked = cells.t[cellId] > LANDLOCKED;
      if (isDeelyLandlocked && HUNTING_BIOMES.includes(biome)) return "Hunting";

      return "Generic";
    }

    function defineCultureExpansionism(type: TCultureType) {
      const baseExp = cultureTypeBaseExpansionism[type];
      return rn(((Math.random() * powerInput) / 2 + 1) * baseExp, 1);
    }

    function checkNamesbase(base: number) {
      // make sure namesbase exists in nameBases
      if (!nameBases.length) {
        ERROR && console.error("Name base is empty, default nameBases will be applied");
        nameBases = Names.getNameBases();
      }

      // check if base is in nameBases
      if (base > nameBases.length) return base;
      ERROR && console.error(`Name base ${base} is not available, applying a fallback one`);
      return base % nameBases.length;
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
