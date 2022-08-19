import * as d3 from "d3";

import {TIME, WARN} from "config/logging";

const {Names} = window;

export function createCapitals(
  statesNumber: number,
  scoredCellIds: UintArray,
  cultures: TCultures,
  cells: Pick<IPack["cells"], "p" | "f" | "culture">
) {
  TIME && console.time("createCapitals");

  const capitalCells = placeCapitals(statesNumber, scoredCellIds, cells.p);

  const capitals = capitalCells.map(cellId => {
    const cultureId = cells.culture[cellId];
    const nameBase = cultures[cultureId].base;
    const name: string = Names.getBaseShort(nameBase);
    const featureId = cells.f[cellId];

    return {cell: cellId, culture: cultureId, name, feature: featureId, capital: 1 as Logical};
  });

  TIME && console.timeEnd("createCapitals");
  return capitals;
}

function placeCapitals(statesNumber: number, scoredCellIds: UintArray, points: TPoints) {
  function attemptToPlaceCapitals(spacing: number): number[] {
    const capitalCells: number[] = [];
    const capitalsQuadtree = d3.quadtree();

    for (const cellId of scoredCellIds) {
      const [x, y] = points[cellId];

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
