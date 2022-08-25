import * as d3 from "d3";

import {WARN} from "config/logging";
import {religionsData} from "config/religionsData";
import {getInputNumber} from "utils/nodeUtils";
import {rand, rw} from "utils/probabilityUtils";
import {isBurg} from "utils/typeUtils";

const {forms} = religionsData;

export function generateOrganizedReligions(
  burgs: TBurgs,
  cultureIds: Uint16Array,
  cells: Pick<IPack["cells"], "i" | "p" | "pop">
): Pick<IReligion, "type" | "form" | "culture" | "center">[] {
  const religionsNumber = getInputNumber("religionsInput");
  if (religionsNumber === 0) return [];

  const canditateCells = getCandidateCells();
  const religionCells = placeReligions();

  const cultsNumber = Math.floor((rand(1, 4) / 10) * religionCells.length); // 10-40%
  const heresiesNumber = Math.floor((rand(0, 2) / 10) * religionCells.length); // 0-20%
  const organizedNumber = religionCells.length - cultsNumber - heresiesNumber;

  const getType = (index: number) => {
    if (index < organizedNumber) return "Organized";
    if (index < organizedNumber + cultsNumber) return "Cult";
    return "Heresy";
  };

  return religionCells.map((cellId, index) => {
    const type = getType(index);
    const form = rw<string>(forms[type]);
    const cultureId = cultureIds[cellId];

    return {type, form, culture: cultureId, center: cellId};
  });

  function placeReligions() {
    const religionCells = [];
    const religionsTree = d3.quadtree();

    // min distance between religions
    const spacing = (graphWidth + graphHeight) / 2 / religionsNumber;

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
