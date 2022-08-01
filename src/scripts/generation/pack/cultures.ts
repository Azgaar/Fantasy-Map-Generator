import * as d3 from "d3";
import FlatQueue from "flatqueue";

import {cultureSets, DEFAULT_SORT_STRING, TCultureSetName} from "config/cultureSets";
import {
  DISTANCE_FIELD,
  ELEVATION,
  FOREST_BIOMES,
  HUNTING_BIOMES,
  MIN_LAND_HEIGHT,
  NOMADIC_BIOMES
} from "config/generation";
import {ERROR, TIME, WARN} from "config/logging";
import {getColors} from "utils/colorUtils";
import {abbreviate} from "utils/languageUtils";
import {getInputNumber, getInputValue, getSelectedOption} from "utils/nodeUtils";
import {minmax, rn} from "utils/numberUtils";
import {biased, P, rand} from "utils/probabilityUtils";
import {byId} from "utils/shorthands";
import {defaultNameBases} from "config/namebases";

const {COA} = window;

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
const {LAND_COAST, LANDLOCKED, WATER_COAST} = DISTANCE_FIELD;

export const generateCultures = function (
  features: TPackFeatures,
  cells: Pick<
    IPack["cells"],
    "p" | "i" | "g" | "t" | "h" | "haven" | "harbor" | "f" | "r" | "fl" | "s" | "pop" | "biome"
  >,
  temp: Int8Array
): TCultures {
  TIME && console.time("generateCultures");

  const wildlands: IWilderness = {name: "Wildlands", i: 0, base: 1, origins: [null], shield: "round"};

  const populatedCellIds = cells.i.filter(cellId => cells.pop[cellId] > 0);
  const maxSuitability = d3.max(cells.s)!;

  const culturesNumber = getCulturesNumber(populatedCellIds.length);
  if (!culturesNumber) return [wildlands];

  const culturesData = selectCulturesData(culturesNumber);
  const colors = getColors(culturesNumber);

  const powerInput = getInputNumber("powerInput");
  const emblemShape = getInputValue("emblemShape");
  const isEmblemShareRandom = emblemShape === "random";

  const codes: string[] = [];
  const centers = d3.quadtree();

  const definedCultures: ICulture[] = culturesData.map((cultureData, index) => {
    const {name, sort} = cultureData;
    const center = placeCenter(sort || DEFAULT_SORT_STRING);
    const base = checkNamesbase(cultureData.base);
    const color = colors[index];
    const type = defineCultureType(center);
    const expansionism = defineCultureExpansionism(type);

    const origins = [0];
    const code = abbreviate(name, codes);
    const shield = isEmblemShareRandom ? COA.getRandomShield() : cultureData.shield;

    centers.add(cells.p[center]);
    codes.push(code);

    return {i: index + 1, name, base, center, color, type, expansionism, origins, code, shield};
  });

  TIME && console.timeEnd("generateCultures");
  return [wildlands, ...definedCultures];

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
    let defaultCultures = getDefaultCultures(culturesNumber);
    if (defaultCultures.length <= culturesNumber) return defaultCultures;

    const cultures = [];
    const MAX_ITERATIONS = 200;

    for (let culture, rnd, i = 0; cultures.length < culturesNumber && i < MAX_ITERATIONS; i++) {
      do {
        rnd = rand(defaultCultures.length - 1);
        culture = defaultCultures[rnd];
      } while (!P(culture.chance));
      cultures.push(culture);
      defaultCultures.splice(rnd, 1);
    }

    return cultures;
  }

  function getDefaultCultures(culturesNumber: number) {
    const cultureSet = getInputValue("culturesSet") as TCultureSetName;
    if (cultureSet in cultureSets) {
      return cultureSets[cultureSet](culturesNumber);
    }

    throw new Error(`Unsupported culture set: ${cultureSet}`);
  }

  function placeCenter(sortingString: string) {
    let spacing = (graphWidth + graphHeight) / 2 / culturesNumber;

    const sorted = sortPopulatedCellByCultureSuitability(sortingString);
    const MAX = Math.floor(sorted.length / 2);
    const BIAS_EXPONENT = 6;

    return (function getCellId(): number {
      const cellId = sorted[biased(0, MAX, BIAS_EXPONENT)];
      if (centers.find(...cells.p[cellId], spacing) !== undefined) {
        // to close to another center, try again with reduced spacing
        spacing *= 0.9;
        return getCellId(); // call recursively
      }

      return cellId;
    })();
  }

  function sortPopulatedCellByCultureSuitability(sortingString: string) {
    let cellId: number;

    const sortingMethods = {
      // normalized cell score
      score: () => Math.ceil((cells.s[cellId] / maxSuitability) * 3),

      // temperature delta
      temp: (goalTemp: number) => {
        const tempDelta = Math.abs(temp[cells.g[cellId]] - goalTemp);
        return tempDelta ? tempDelta + 1 : 1;
      },

      // biome delta
      biome: (biomes: number[], fee = 4) => {
        return biomes.includes(cells.biome[cellId]) ? 1 : fee;
      },

      // fee if for an ocean coast
      oceanCoast: (fee = 4) => {
        const haven = cells.haven[cellId];
        const havenFeature = features[haven];
        return haven && havenFeature && havenFeature.type === "ocean" ? 1 : fee;
      },

      coastDist: () => cells.t[cellId],
      height: () => cells.h[cellId],
      suitability: () => cells.s[cellId]
    };

    const allSortingMethods = `{${Object.keys(sortingMethods).join(", ")}}`;

    const sortFn = new Function(allSortingMethods, "return " + sortingString);

    const comparator = (a: number, b: number) => {
      cellId = a;
      const cellA = sortFn(sortingMethods);

      cellId = b;
      const cellB = sortFn(sortingMethods);

      return cellB - cellA;
    };

    const sorted = Array.from(populatedCellIds).sort(comparator);
    return sorted;
  }

  // set culture type based on culture center position
  function defineCultureType(cellId: number): TCultureType {
    const height = cells.h[cellId];

    if (height > HILLS) return "Highland";

    const biome = cells.biome[cellId];
    if (height < MOUNTAINS && NOMADIC_BIOMES.includes(biome)) return "Nomadic";

    if (cells.t[cellId] === LAND_COAST) {
      const waterFeatureId = cells.f[cells.haven[cellId]];
      const waterFeature = features[waterFeatureId];

      const isBigLakeCoast = waterFeature && waterFeature.type === "lake" && waterFeature.cells > 5;
      if (isBigLakeCoast) return "Lake";

      const isOceanCoast = waterFeature && waterFeature.type === "ocean";
      if (isOceanCoast && P(0.1)) return "Naval";

      const isSafeHarbor = cells.harbor[cellId] === 1;
      if (isSafeHarbor && P(0.6)) return "Naval";

      const cellFeature = features[cells.f[cellId]];
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
      nameBases = [...defaultNameBases];
    }

    // check if base is in nameBases
    if (base < nameBases.length) return base;

    ERROR && console.error(`Name base ${base} is not available, applying a fallback one`);
    return base % nameBases.length;
  }
};

// expand cultures across the map (Dijkstra-like algorithm)
export const expandCultures = function (
  cultures: TCultures,
  features: TPackFeatures,
  cells: Pick<IPack["cells"], "c" | "area" | "h" | "t" | "f" | "r" | "fl" | "biome" | "pop">
) {
  TIME && console.time("expandCultures");

  const cultureIds = new Uint16Array(cells.h.length); // cell cultures
  const isWilderness = (culture: ICulture | IWilderness): culture is IWilderness => culture.i === 0;

  const queue = new FlatQueue<{cellId: number; cultureId: number}>();
  cultures.forEach(culture => {
    if (isWilderness(culture) || culture.removed) return;
    queue.push({cellId: culture.center, cultureId: culture.i}, 0);
  });

  const cellsNumberFactor = cells.h.length / 1.6;
  const neutral = cellsNumberFactor * getInputNumber("neutralInput"); // limit cost for culture growth
  const cost: number[] = [];

  while (queue.length) {
    const priority = queue.peekValue()!;
    const {cellId, cultureId} = queue.pop()!;

    if (cultureId === 0) throw new Error("Wilderness culture should not expand");
    const {type, expansionism} = cultures[cultureId] as ICulture;
    const cultureBiome = cells.biome[cellId];

    cells.c[cellId].forEach(neibCellId => {
      const biome = cells.biome[neibCellId];
      const biomeCost = getBiomeCost(biome, cultureBiome, type);
      const heightCost = getHeightCost(neibCellId, cells.h[neibCellId], type);
      const riverCost = getRiverCost(cells.r[neibCellId], neibCellId, type);
      const typeCost = getTypeCost(cells.t[neibCellId], type);
      const totalCost = priority + (biomeCost + heightCost + riverCost + typeCost) / expansionism;

      if (totalCost > neutral) return;

      if (!cost[neibCellId] || totalCost < cost[neibCellId]) {
        if (cells.pop[neibCellId] > 0) cultureIds[neibCellId] = cultureId; // assign culture to populated cell
        cost[neibCellId] = totalCost;
        queue.push({cellId: neibCellId, cultureId}, totalCost);
      }
    });
  }

  TIME && console.timeEnd("expandCultures");
  return cultureIds;

  function getBiomeCost(biome: number, cultureBiome: number, type: TCultureType) {
    if (cultureBiome === biome) return 10; // tiny penalty for native biome
    if (type === "Hunting") return biomesData.cost[biome] * 5; // non-native biome penalty for hunters
    if (type === "Nomadic" && FOREST_BIOMES.includes(biome)) return biomesData.cost[biome] * 10; // forest biome penalty for nomads
    return biomesData.cost[biome] * 2; // general non-native biome penalty
  }

  function getHeightCost(cellId: number, height: number, type: TCultureType) {
    if (height < MIN_LAND_HEIGHT) {
      const feature = features[cells.f[cellId]];
      const area = cells.area[cellId];

      if (type === "Lake" && feature && feature.type === "lake") return 10; // almost lake crossing penalty for Lake cultures
      if (type === "Naval") return area * 2; // low sea or lake crossing penalty for Naval cultures
      if (type === "Nomadic") return area * 50; // giant sea or lake crossing penalty for Nomads
      return area * 6; // general sea or lake crossing penalty
    }

    if (type === "Highland") {
      if (height >= MOUNTAINS) return 0; // no penalty for highlanders on highlands
      if (height < HILLS) return 3000; // giant penalty for highlanders on lowlands
      return 100; // penalty for highlanders on hills
    }

    if (height >= MOUNTAINS) return 200; // general mountains crossing penalty
    if (height >= HILLS) return 30; // general hills crossing penalty
    return 0;
  }

  function getRiverCost(riverId: number, cellId: number, type: TCultureType) {
    if (type === "River") return riverId ? 0 : 100; // penalty for river cultures
    if (!riverId) return 0; // no penalty for others if there is no river
    return minmax(cells.fl[cellId] / 10, 20, 100); // river penalty from 20 to 100 based on flux
  }

  function getTypeCost(t: number, type: TCultureType) {
    if (t === LAND_COAST) return type === "Naval" || type === "Lake" ? 0 : type === "Nomadic" ? 60 : 20; // penalty for coastline
    if (t === LANDLOCKED) return type === "Naval" || type === "Nomadic" ? 30 : 0; // low penalty for land level 2 for Navals and nomads
    if (t !== WATER_COAST) return type === "Naval" || type === "Lake" ? 100 : 0; // penalty for mainland for navals
    return 0;
  }
};
