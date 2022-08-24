import * as d3 from "d3";

import {WARN} from "config/logging";
import {religionsData} from "config/religionsData";
import {getRandomColor, getMixedColor} from "utils/colorUtils";
import {getInputNumber} from "utils/nodeUtils";
import {rand, rw} from "utils/probabilityUtils";
import {isBurg} from "utils/typeUtils";
import {getDeityName} from "./generateDeityName";
import {generateFolkReligions} from "./generateFolkReligions";
import {generateReligionName} from "./generateReligionName";

const {forms, types} = religionsData;

export function generateOrganizedReligionsAndCults(
  states: TStates,
  cultures: TCultures,
  burgs: TBurgs,
  cultureIds: Uint16Array,
  stateIds: Uint16Array,
  burgIds: Uint16Array,
  folkReligions: ReturnType<typeof generateFolkReligions>,
  cells: Pick<IPack["cells"], "i" | "p" | "pop">
) {
  const religionsNumber = getInputNumber("religionsInput");
  if (religionsNumber === 0) return [];

  const cultsNumber = Math.floor((rand(1, 4) / 10) * religionsNumber); // 10-40%
  const organizedNumber = religionsNumber - cultsNumber;

  const canditateCells = getCandidateCells();
  const religionCells = placeReligions();

  return religionCells.map((cellId, index) => {
    const cultureId = cultureIds[cellId];
    const stateId = stateIds[cellId];
    const burgId = burgIds[cellId];

    const type = index < organizedNumber ? "Organized" : "Cult";

    const form = rw(forms[type] as {[key in keyof typeof types]: number});
    const deityName = getDeityName(cultures, cultureId);
    const deity = form === "Non-theism" ? null : deityName;

    const {name, expansion, center} = generateReligionName({
      cultureId,
      stateId,
      burgId,
      cultures,
      states,
      burgs,
      center: cellId,
      form,
      deity: deityName
    });

    const folkReligion = folkReligions.find(({culture}) => culture === cultureId);
    const baseColor = folkReligion?.color || getRandomColor();
    const color = getMixedColor(baseColor, 0.3, 0);

    return {name, type, form, deity, color, culture: cultureId, center, expansion};
  });

  function placeReligions() {
    const religionCells = [];
    const religionsTree = d3.quadtree();

    // initial min distance between religions
    let spacing = (graphWidth + graphHeight) / 4 / religionsNumber;

    for (const cellId of canditateCells) {
      const [x, y] = cells.p[cellId];

      if (religionsTree.find(x, y, spacing) === undefined) {
        religionCells.push(cellId);
        religionsTree.add([x, y]);

        if (religionCells.length === religionsNumber) return religionCells;
      }
    }

    WARN && console.warn(`Placed only ${religionCells.length} of ${religionsNumber} religions`);
    return religionCells;
  }

  function getCandidateCells() {
    const validBurgs = burgs.filter(isBurg);

    if (validBurgs.length >= religionsNumber)
      return validBurgs.sort((a, b) => b.population - a.population).map(burg => burg.cell);

    return cells.i.filter(i => cells.pop[i] > 2).sort((a, b) => cells.pop[b] - cells.pop[a]);
  }
}
