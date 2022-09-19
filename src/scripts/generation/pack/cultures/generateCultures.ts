import * as d3 from "d3";

import {cultureSets, DEFAULT_SORT_STRING, TCultureSetName} from "config/cultureSets";
import {DISTANCE_FIELD, ELEVATION, HUNTING_BIOMES, NOMADIC_BIOMES} from "config/generation";
import {ERROR, TIME, WARN} from "config/logging";
import {getColors} from "utils/colorUtils";
import {abbreviate} from "utils/languageUtils";
import {getInputNumber, getInputValue, getSelectedOption} from "utils/nodeUtils";
import {rn} from "utils/numberUtils";
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
const {LAND_COAST, LANDLOCKED} = DISTANCE_FIELD;

type TCellsData = Pick<
  IPack["cells"],
  "p" | "i" | "g" | "t" | "h" | "haven" | "harbor" | "f" | "r" | "fl" | "s" | "pop" | "biome"
>;

export function generateCultures(features: TPackFeatures, cells: TCellsData, temp: Int8Array): TCultures {
  TIME && console.time("generateCultures");

  const wildlands: TWilderness = {i: 0, name: "Wildlands", base: 1, origins: [null], shield: "round"};

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
}
