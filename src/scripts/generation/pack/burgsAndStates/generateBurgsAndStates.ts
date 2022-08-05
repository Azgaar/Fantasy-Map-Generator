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
  cells: Pick<
    IPack["cells"],
    "v" | "c" | "p" | "i" | "g" | "h" | "f" | "t" | "haven" | "harbor" | "r" | "fl" | "biome" | "s" | "culture"
  >
) {
  const cellsNumber = cells.i.length;
  const burgIds = new Uint16Array(cellsNumber);

  const scoredCellIds = getScoredCellIds();
  const statesNumber = getStatesNumber(scoredCellIds.length);
  if (statesNumber === 0) return {burgIds, burgs: [NO_BURG], states: [NEUTRALS]};

  const capitals = createCapitals(statesNumber, scoredCellIds, burgIds, cultures, pick(cells, "p", "f", "culture"));
  const states = createStates(capitals, cultures);
  const towns = createTowns(burgIds, cultures, pick(cells, "p", "i", "f", "s", "culture"));

  const stateIds = expandStates(
    capitals,
    states,
    features,
    pick(cells, "c", "h", "f", "t", "r", "fl", "s", "biome", "culture")
  );
  // normalizeStates();
  // burgs.filter(b => b.i && !b.removed).forEach(b => (b.state = stateIds[b.cell])); // assign state to burgs
  const roadScores = new Uint16Array(cellsNumber); // TODO: define roads

  const burgs = specifyBurgs(capitals, towns, roadScores);

  return {burgIds, stateIds, burgs, states};

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
}
