import {WARN} from "config/logging";
import {pick} from "utils/functionUtils";
import {getInputNumber} from "utils/nodeUtils";
import {NEUTRALS, NO_BURG} from "./config";
import {createCapitals} from "./createCapitals";
import {createStates} from "./createStates";
import {createTowns} from "./createTowns";
import {expandStates} from "./expandStates";
import {specifyBurgs} from "./specifyBurgs";

export function generateBurgsAndStates(
  cultures: TCultures,
  features: TPackFeatures,
  temp: Int8Array,
  rivers: Omit<IRiver, "name" | "basin" | "type">[],
  vertices: IGraphVertices,
  cells: Pick<
    IPack["cells"],
    "v" | "c" | "p" | "b" | "i" | "g" | "h" | "f" | "t" | "haven" | "harbor" | "r" | "fl" | "biome" | "s" | "culture"
  >
): {burgIds: Uint16Array; stateIds: Uint16Array; burgs: TBurgs; states: TStates} {
  const cellsNumber = cells.i.length;

  const scoredCellIds = getScoredCellIds();
  const statesNumber = getStatesNumber(scoredCellIds.length);
  if (statesNumber === 0) {
    return {
      burgIds: new Uint16Array(cellsNumber),
      stateIds: new Uint16Array(cellsNumber),
      burgs: [NO_BURG],
      states: [NEUTRALS]
    };
  }

  const capitals = createCapitals(statesNumber, scoredCellIds, cultures, pick(cells, "p", "f", "culture"));
  const capitalCells = new Map(capitals.map(({cell}) => [cell, true]));
  const states = createStates(capitals, cultures);

  const towns = createTowns(
    cultures,
    scoredCellIds.filter(i => !capitalCells.has(i)),
    pick(cells, "p", "i", "f", "s", "culture")
  );

  const stateIds = expandStates(
    capitalCells,
    states,
    features,
    pick(cells, "c", "h", "f", "t", "r", "fl", "s", "biome", "culture")
  );

  const burgs = specifyBurgs(
    capitals,
    towns,
    stateIds,
    features,
    temp,
    vertices,
    cultures,
    states,
    rivers,
    pick(cells, "v", "p", "g", "h", "f", "haven", "harbor", "s", "biome", "fl", "r")
  );

  const burgIds = assignBurgIds(burgs);

  return {burgIds, stateIds, burgs, states};

  function getScoredCellIds() {
    const score = new Int16Array(cells.s.map(s => s * Math.random()));

    // filtered and sorted array of indexes: only populated cells not on map edge
    const sorted = cells.i
      .filter(i => !cells.b[i] && score[i] > 0 && cells.culture[i])
      .sort((a, b) => score[b] - score[a]);

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

  function assignBurgIds(burgs: TBurgs) {
    const burgIds = new Uint16Array(cellsNumber);

    for (let i = 1; i < burgs.length; i++) {
      const {cell} = burgs[i] as IBurg;
      burgIds[cell] = i;
    }

    return burgIds;
  }
}
