import {TIME} from "config/logging";
import {getInputNumber, getInputValue} from "utils/nodeUtils";
import {DISTANCE_FIELD, MAX_HEIGHT, MIN_LAND_HEIGHT} from "config/generation";
import {drawPolygon} from "utils/debugUtils";

const {LAND_COAST, WATER_COAST} = DISTANCE_FIELD;

// near sea lakes usually get a lot of water inflow
// most of them would brake threshold and flow out to sea (see Ancylus Lake)
// connect these type of lakes to the main water body to improve the heightmap
export function openNearSeaLakes(
  heights: Uint8Array,
  neighbours: number[][],
  indexes: UintArray,
  borderCells: IGraphCells["b"]
) {
  if (getInputValue("templateInput") === "Atoll") return; // no need for Atolls

  TIME && console.time("openNearSeaLakes");
  const MAX_BREACHABLE_HEIGHT = 22; // max height that can be breached by water

  const features: Dict<"ocean" | "lake"> = {};
  const featureIds: Dict<number> = {};
  let featureId = 0;

  const lakeCoastalCells: Dict<number[]> = {};

  for (const cellId of indexes) {
    if (featureIds[cellId]) continue;
    if (heights[cellId] >= MIN_LAND_HEIGHT) continue;

    featureId += 1;
    const breachableCoastalCells: number[] = [];
    let isLake = true; // lakes are features surrounded by land cells

    const queue = [cellId];
    featureIds[cellId] = featureId;

    while (queue.length) {
      const nextCellId = queue.pop()!;

      for (const neighborId of neighbours[nextCellId]) {
        if (isLake && borderCells[neighborId]) isLake = false;
        if (featureIds[neighborId]) continue;
        const height = heights[neighborId];

        if (height < MIN_LAND_HEIGHT) {
          featureIds[neighborId] = featureId;
          queue.push(neighborId);
        } else if (isLake && height <= MAX_BREACHABLE_HEIGHT) {
          breachableCoastalCells.push(neighborId);
        }
      }
    }

    features[featureId] = isLake ? "lake" : "ocean";
    if (isLake) lakeCoastalCells[featureId] = breachableCoastalCells;
  }

  console.log(featureIds, features, lakeCoastalCells);

  TIME && console.timeEnd("openNearSeaLakes");
  return heights;
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
