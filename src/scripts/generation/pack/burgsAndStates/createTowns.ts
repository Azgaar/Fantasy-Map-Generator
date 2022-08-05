import * as d3 from "d3";

import {TIME, WARN} from "config/logging";
import {getInputNumber} from "utils/nodeUtils";
import {rn} from "utils/numberUtils";
import {gauss} from "utils/probabilityUtils";

const {Names} = window;

export function createTowns(scoredCellIds: UintArray, burgIds: Uint16Array) {
  TIME && console.time("createTowns");

  const townsNumber = getTownsNumber();
  if (townsNumber === 0) return [];

  // randomize cells score a bit for more natural towns placement
  const randomizeScore = (suitability: number) => suitability * gauss(1, 3, 0, 20, 3);
  const scores = new Int16Array(cells.s.map(randomizeScore));

  // take populated cells without capitals
  const scoredCellsIds = cells.i.filter(i => scores[i] > 0 && cells.culture[i] && !burgIds[i]);
  scoredCellsIds.sort((a, b) => scores[b] - scores[a]); // sort by randomized suitability score

  const towns = placeTowns(townsNumber, scoredCellIds).map((cellId, index) => {
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
}

function placeTowns(townsNumber: number, scoredCellIds: UintArray) {
  function attemptToPlaceTowns(spacing: number): number[] {
    const townCells: number[] = [];
    const townsQuadtree = d3.quadtree();

    const randomizeScaping = (spacing: number) => spacing * gauss(1, 0.3, 0.2, 2, 2);

    for (const cellId of scoredCellIds) {
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
