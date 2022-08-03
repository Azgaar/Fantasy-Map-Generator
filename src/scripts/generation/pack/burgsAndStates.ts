import * as d3 from "d3";

import {TIME, WARN} from "config/logging";
import {getColors} from "utils/colorUtils";
import {getInputNumber} from "utils/nodeUtils";
import {rn} from "utils/numberUtils";
import {each, gauss} from "utils/probabilityUtils";
import {getCommonEdgePoint} from "utils/lineUtils";

const {Names, COA} = window;

export function generateBurgsAndStates(
  cells: Pick<IPack["cells"], "v" | "p" | "i" | "g" | "f" | "haven" | "harbor" | "r" | "fl" | "s" | "culture">,
  vertices: IGraphVertices,
  cultures: TCultures,
  features: TPackFeatures,
  temp: Int8Array
) {
  const cellsNumber = cells.i.length;
  const burgIds = new Uint16Array(cellsNumber);

  const noBurg: TNoBurg = {name: undefined};
  const neutrals: TNeutrals = {i: 0, name: "Neutrals"};

  const scoredCellIds = getScoredCellIds();
  const statesNumber = getStatesNumber(scoredCellIds.length);
  if (statesNumber === 0) return {burgIds, burgs: [noBurg], states: [neutrals]};

  const capitals = createCapitals();
  const states = createStates();
  const towns = createTowns();

  const roadScores = new Uint16Array(cellsNumber); // TODO: define roads
  const burgs = specifyBurgs();

  return {burgIds, states, burgs};

  function getScoredCellIds() {
    // cell score for capitals placement
    const score = new Int16Array(cells.s.map(s => s * Math.random()));

    // filtered and sorted array of indexes
    const sorted = cells.i.filter(i => score[i] > 0 && cells.culture[i]).sort((a, b) => score[b] - score[a]);

    return sorted;
  }

  function getStatesNumber(populatedCells: number) {
    const requestedStatesNumber = getInputNumber("regionsOutput");

    if (populatedCells < requestedStatesNumber * 10) {
      const maxAllowed = Math.floor(populatedCells / 10);
      if (maxAllowed === 0) {
        WARN && console.warn("There is no populated cells. Cannot generate states");
        return 0;
      }

      WARN && console.warn(`Not enough populated cells (${populatedCells}). Will generate only ${maxAllowed} states`);
      return maxAllowed;
    }

    return requestedStatesNumber;
  }

  function createCapitals() {
    TIME && console.time("createCapitals");

    const capitals = placeCapitals().map((cellId, index) => {
      const id = index + 1;
      const cultureId = cells.culture[cellId];
      const name: string = Names.getCultureShort(cultureId);
      const featureId = cells.f[cellId];

      return {i: id, cell: cellId, culture: cultureId, name, feature: featureId, capital: 1 as Logical};
    });

    for (const {cell, i} of capitals) {
      burgIds[cell] = i;
    }

    TIME && console.timeEnd("createCapitals");
    return capitals;

    function placeCapitals() {
      function attemptToPlaceCapitals(spacing: number): number[] {
        const capitalCells: number[] = [];
        const capitalsQuadtree = d3.quadtree();

        for (const cellId of scoredCellIds) {
          const [x, y] = cells.p[cellId];

          if (capitalsQuadtree.find(x, y, spacing) === undefined) {
            capitalCells.push(cellId);
            capitalsQuadtree.add([x, y]);

            if (capitalCells.length === statesNumber) return capitalCells;
          }
        }

        WARN && console.warn("Cannot place capitals, trying again with reduced spacing");
        return attemptToPlaceCapitals(spacing / 1.2);
      }

      // initial min distance between capitals, reduced by 1.2 each iteration if not enough space
      const initialSpacing = (graphWidth + graphHeight) / 2 / statesNumber;
      return attemptToPlaceCapitals(initialSpacing);
    }
  }

  function createStates() {
    TIME && console.time("createStates");

    const colors = getColors(capitals.length);
    const each5th = each(5); // select each 5th element
    const powerInput = getInputNumber("powerInput");

    const states = capitals.map((capital, index) => {
      const {cell: cellId, culture: cultureId, name: capitalName, i: capitalId} = capital;
      const id = index + 1;

      const useCapitalName = capitalName.length < 9 && each5th(cellId);
      const basename = useCapitalName ? capitalName : Names.getCultureShort(cultureId);
      const name: string = Names.getState(basename, cultureId);
      const color = colors[index];

      const type = (cultures[cultureId] as ICulture).type;
      const expansionism = rn(Math.random() * powerInput + 1, 1);

      const shield = COA.getShield(cultureId, null);
      const coa = {...COA.generate(null, null, null, type), shield};

      return {i: id, center: cellId, type, name, color, expansionism, capital: capitalId, culture: cultureId, coa};
    });

    TIME && console.timeEnd("createStates");
    return [neutrals, ...states];
  }

  function createTowns() {
    TIME && console.time("createTowns");

    const townsNumber = getTownsNumber();
    if (townsNumber === 0) return [];

    // randomize cells score a bit for more natural towns placement
    const randomizeScore = (suitability: number) => suitability * gauss(1, 3, 0, 20, 3);
    const scores = new Int16Array(cells.s.map(randomizeScore));

    // take populated cells without capitals
    const scoredCellsIds = cells.i.filter(i => scores[i] > 0 && cells.culture[i] && !burgIds[i]);
    scoredCellsIds.sort((a, b) => scores[b] - scores[a]); // sort by randomized suitability score

    const towns = placeTowns().map((cellId, index) => {
      const id = index + 1;
      const cultureId = cells.culture[cellId];
      const name: string = Names.getCulture(cultureId);
      const featureId = cells.f[cellId];

      return {i: id, cell: cellId, culture: cultureId, name, feature: featureId, capital: 0 as Logical};
    });

    for (const {cell, i} of towns) {
      burgIds[cell] = i;
    }

    TIME && console.timeEnd("createTowns");
    return towns;

    function getTownsNumber() {
      const inputTownsNumber = getInputNumber("manorsInput");
      const shouldAutoDefine = inputTownsNumber === 1000;
      const desiredTownsNumber = shouldAutoDefine ? rn(scoredCellsIds.length / 5 ** 0.8) : inputTownsNumber;

      return Math.min(desiredTownsNumber, scoredCellsIds.length);
    }

    function placeTowns() {
      function attemptToPlaceTowns(spacing: number): number[] {
        const townCells: number[] = [];
        const townsQuadtree = d3.quadtree();

        const randomizeScaping = (spacing: number) => spacing * gauss(1, 0.3, 0.2, 2, 2);

        for (const cellId of scoredCellsIds) {
          const [x, y] = cells.p[cellId];

          // randomize min spacing a bit to make placement not that uniform
          const currentSpacing = randomizeScaping(spacing);

          if (townsQuadtree.find(x, y, currentSpacing) === undefined) {
            townCells.push(cellId);
            townsQuadtree.add([x, y]);

            if (townCells.length === townsNumber) return townCells;
          }
        }

        WARN && console.warn("Cannot place towns, trying again with reduced spacing");
        return attemptToPlaceTowns(spacing / 2);
      }

      // initial min distance between towns, reduced by 2 each iteration if not enough space
      const initialSpacing = (graphWidth + graphHeight) / 150 / (townsNumber ** 0.7 / 66);
      return attemptToPlaceTowns(initialSpacing);
    }
  }

  function specifyBurgs(): TBurgs {
    TIME && console.time("specifyBurgs");

    const burgs = [...capitals, ...towns].map(burgData => {
      const {cell, capital} = burgData;

      const port = definePort(cell, capital);
      const population = definePopulation(cell, capital, port);
      const [x, y] = defineLocation(cell, port);

      const type = defineType(cell, port);
      const coa = defineEmblem();

      return {...burgData, port, population, x, y, type, coa};
    });

    TIME && console.timeEnd("specifyBurgs");
    return [noBurg, ...burgs];

    function definePort(cellId: number, capital: Logical) {
      if (!cells.haven[cellId]) return 0; // must be a coastal cell
      if (temp[cells.g[cellId]] <= 0) return 0; // temperature must be above zero °C

      const havenCellId = cells.haven[cellId];
      const havenFeatureId = cells.f[havenCellId];
      const feature = features[havenFeatureId] as IPackFeatureOcean | IPackFeatureLake;
      if (feature.cells < 2) return 0; // water body must have at least 2 cells

      const isSafeHarbor = cells.harbor[cellId] === 1;
      if (!capital && !isSafeHarbor) return 0; // must be a capital or safe harbor

      return havenFeatureId;
    }

    function definePopulation(cellId: number, capital: Logical, port: number) {
      const basePopulation = (cells.s[cellId] + roadScores[cellId] / 2) / 4;
      const decimalPart = (cellId % 1000) / 1000;

      const capitalMultiplier = capital ? 1.3 : 1;
      const portMultiplier = port ? 1.3 : 1;
      const randomMultiplier = gauss(1, 1.5, 0.3, 10, 3);

      const total = (basePopulation + decimalPart) * capitalMultiplier * portMultiplier * randomMultiplier;
      return rn(Math.max(0.1, total), 3);
    }

    function defineLocation(cellId: number, port: number) {
      const [cellX, cellY] = cells.p[cellId];

      if (port) {
        // place ports on the coast
        const [x, y] = getCommonEdgePoint(cells.v, vertices, cellId, cells.haven[cellId]);
        return [rn(x, 2), rn(y, 2)];
      }

      if (cells.r[cellId]) {
        // place river burgs a bit off of the cell center
        const offset = Math.min(cells.fl[cellId] / 150, 1);
        const x = cellId % 2 ? cellX + offset : cellX - offset;
        const y = cells.r[cellId] % 2 ? cellY + offset : cellY - offset;
        return [rn(x, 2), rn(y, 2)];
      }

      return [cellX, cellY];
    }

    function defineType(cellId: number, port: number) {
      const cells = pack.cells;
      if (port) return "Naval";
      if (cells.haven[cellId] && pack.features[cells.f[cells.haven[cellId]]].type === "lake") return "Lake";
      if (cells.h[cellId] > 60) return "Highland";
      if (cells.r[cellId] && cells.r[cellId].length > 100 && cells.r[cellId].length >= pack.rivers[0].length)
        return "River";

      if (!cells.burg[cellId] || pack.burgs[cells.burg[cellId]].population < 6) {
        if (population < 5 && [1, 2, 3, 4].includes(cells.biome[cellId])) return "Nomadic";
        if (cells.biome[cellId] > 4 && cells.biome[cellId] < 10) return "Hunting";
      }

      return "Generic";
    }

    function defineEmblem() {
      return "emblem";
    }
  }
}
