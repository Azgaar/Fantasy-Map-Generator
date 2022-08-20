import {INFO, TIME} from "config/logging";
import {getInputNumber} from "utils/nodeUtils";
import {MAX_HEIGHT, MIN_LAND_HEIGHT} from "config/generation";

// some deeply depressed areas may not be resolved on river generation
// this areas tend to collect precipitation, so we can add a lake there to help the resolver
export function addLakesInDeepDepressions(heights: Uint8Array, neighbours: number[][], indexes: UintArray) {
  const ELEVATION_LIMIT = getInputNumber("lakeElevationLimitOutput");
  if (ELEVATION_LIMIT === MAX_HEIGHT - MIN_LAND_HEIGHT) return heights; // any depression can be resolved

  TIME && console.time("addLakesInDeepDepressions");

  const landCells = indexes.filter(i => heights[i] >= MIN_LAND_HEIGHT);
  landCells.sort((a, b) => heights[a] - heights[b]); // lower elevation first

  const currentHeights = new Uint8Array(heights);
  const checkedCells: Dict<true> = {[landCells[0]]: true};

  for (const cellId of landCells) {
    if (checkedCells[cellId]) continue;

    const THESHOLD_HEIGHT = currentHeights[cellId] + ELEVATION_LIMIT;

    let inDeepDepression = true;

    const queue = [cellId];
    const checkedPaths: Dict<true> = {[cellId]: true};

    while (queue.length) {
      const nextCellId = queue.pop()!;

      if (currentHeights[nextCellId] < MIN_LAND_HEIGHT) {
        inDeepDepression = false;
        break;
      }

      for (const neibCellId of neighbours[nextCellId]) {
        if (checkedPaths[neibCellId]) continue;

        checkedPaths[neibCellId] = true;
        checkedCells[neibCellId] = true;

        if (currentHeights[neibCellId] < THESHOLD_HEIGHT) queue.push(neibCellId);
      }
    }

    if (inDeepDepression) {
      currentHeights[cellId] = MIN_LAND_HEIGHT - 1;
      INFO && console.info(`ⓘ Added lake at deep depression. Cell: ${cellId}`);
    }
  }

  TIME && console.timeEnd("addLakesInDeepDepressions");
  return currentHeights;
}
