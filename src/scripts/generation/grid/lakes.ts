import {TIME} from "config/logging";
import {getInputNumber, getInputValue} from "utils/nodeUtils";
import {DISTANCE_FIELD, MAX_HEIGHT, MIN_LAND_HEIGHT} from "config/generation";
import {drawPolygon} from "utils/debugUtils";

const {LAND_COAST, WATER_COAST} = DISTANCE_FIELD;

// near sea lakes usually get a lot of water inflow
// most of them would brake threshold and flow out to sea (see Ancylus Lake)
// connect these type of lakes to the main water body to improve the heightmap
export function openNearSeaLakes(grid: IGraph & Partial<IGrid>) {
  if (getInputValue("templateInput") === "Atoll") return; // no need for Atolls

  const {cells, features} = grid;
  if (!features?.find(f => f && f.type === "lake")) return; // no lakes

  TIME && console.time("openNearSeaLakes");
  const LIMIT = 22; // max height that can be breached by water

  const isLake = (featureId: number) => featureId && (features[featureId] as IGridFeature).type === "lake";
  const isOcean = (featureId: number) => featureId && (features[featureId] as IGridFeature).type === "ocean";

  for (const cellId of cells.i) {
    const featureId = cells.f[cellId];
    if (!isLake(featureId)) continue; // not a lake cell

    check_neighbours: for (const neibCellId of cells.c[cellId]) {
      // water cannot brake the barrier
      if (cells.t[neibCellId] !== WATER_COAST || cells.h[neibCellId] > LIMIT) continue;

      for (const neibOfNeibCellId of cells.c[neibCellId]) {
        const neibOfNeibFeatureId = cells.f[neibOfNeibCellId];
        if (!isOcean(neibOfNeibFeatureId)) continue; // not an ocean
        removeLake(neibCellId, featureId, neibOfNeibFeatureId);
        break check_neighbours;
      }
    }
  }

  function removeLake(barrierCellId: number, lakeFeatureId: number, oceanFeatureId: number) {
    cells.h[barrierCellId] = MIN_LAND_HEIGHT - 1;
    cells.t[barrierCellId] = WATER_COAST;
    cells.f[barrierCellId] = oceanFeatureId;

    for (const neibCellId of cells.c[barrierCellId]) {
      if (cells.h[neibCellId] >= MIN_LAND_HEIGHT) cells.t[neibCellId] = LAND_COAST;
    }

    if (features && lakeFeatureId) {
      // mark former lake as ocean
      (features[lakeFeatureId] as IGridFeature).type = "ocean";
    }
  }

  TIME && console.timeEnd("openNearSeaLakes");
}

// some deeply depressed areas may not be resolved on river generation
// this areas tend to collect precipitation, so we can add a lake there to help the resolver
export function addLakesInDeepDepressions(
  heights: Uint8Array,
  neighbours: number[][],
  cellVertices: number[][],
  vertices: IGraphVertices,
  indexes: UintArray
) {
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
      console.log(`ⓘ Added lake at deep depression. Cell: ${cellId}`);

      const polygon = cellVertices[cellId].map(vertex => vertices.p[vertex]);
      drawPolygon(polygon, {stroke: "red", strokeWidth: 1, fill: "none"});
    }
  }

  TIME && console.timeEnd("addLakesInDeepDepressions");
  return currentHeights;
}
