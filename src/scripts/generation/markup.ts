import * as d3 from "d3";

import {DISTANCE_FIELD, MIN_LAND_HEIGHT} from "config/generation";
import {TIME} from "config/logging";
import {INT8_MAX} from "config/constants";
import {aleaPRNG} from "scripts/aleaPRNG";
import {getFeatureVertices} from "scripts/connectVertices";
import {createTypedArray, unique} from "utils/arrayUtils";
import {dist2} from "utils/functionUtils";
import {clipPoly} from "utils/lineUtils";
import {rn} from "utils/numberUtils";

const {UNMARKED, LAND_COAST, WATER_COAST, LANDLOCKED, DEEPER_WATER} = DISTANCE_FIELD;

// define features (oceans, lakes, islands)
export function markupGridFeatures(neighbors: IGraphCells["c"], borderCells: IGraphCells["b"], heights: Uint8Array) {
  TIME && console.time("markupGridFeatures");
  Math.random = aleaPRNG(seed); // get the same result on heightmap edit in Erase mode

  const gridCellsNumber = borderCells.length;
  const featureIds = new Uint16Array(gridCellsNumber); // starts from 1
  const distanceField = new Int8Array(gridCellsNumber);
  const features: TGridFeatures = [0];

  const queue = [0];
  for (let featureId = 1; queue[0] !== -1; featureId++) {
    const firstCell = queue[0];
    featureIds[firstCell] = featureId;

    const land = heights[firstCell] >= MIN_LAND_HEIGHT;
    let border = false; // set true if feature touches map edge

    while (queue.length) {
      const cellId = queue.pop()!;
      if (borderCells[cellId]) border = true;

      for (const neighborId of neighbors[cellId]) {
        const isNeibLand = heights[neighborId] >= MIN_LAND_HEIGHT;

        if (land === isNeibLand && featureIds[neighborId] === UNMARKED) {
          featureIds[neighborId] = featureId;
          queue.push(neighborId);
        } else if (land && !isNeibLand) {
          distanceField[cellId] = LAND_COAST;
          distanceField[neighborId] = WATER_COAST;
        }
      }
    }

    const type = land ? "island" : border ? "ocean" : "lake";
    features.push({i: featureId, land, border, type});

    queue[0] = featureIds.findIndex(f => f === UNMARKED); // find unmarked cell
  }

  // markup deep ocean cells
  const dfOceanMarked = markup({distanceField, neighbors, start: DEEPER_WATER, increment: -1, limit: -10});

  TIME && console.timeEnd("markupGridFeatures");
  return {featureIds, distanceField: dfOceanMarked, features};
}

// define features (oceans, lakes, islands) add related details
export function markupPackFeatures(
  grid: IGrid,
  vertices: IGraphVertices,
  cells: Pick<IPack["cells"], "c" | "v" | "b" | "p" | "h">
) {
  TIME && console.time("markupPackFeatures");

  const gridCellsNumber = grid.cells.h.length;
  const packCellsNumber = cells.c.length;

  const features: TPackFeatures = [0];
  const featureIds = new Uint16Array(packCellsNumber); // ids of features, starts from 1
  const distanceField = new Int8Array(packCellsNumber); // distance from coast; 1 = land along coast; -1 = water along coast
  const haven = createTypedArray({maxValue: packCellsNumber, length: packCellsNumber}); // haven (opposite water cell)
  const harbor = new Uint8Array(packCellsNumber); // harbor (number of adjacent water cells)

  const defineHaven = (cellId: number) => {
    const waterCells = cells.c[cellId].filter(c => cells.h[c] < MIN_LAND_HEIGHT);
    const distances = waterCells.map(c => dist2(cells.p[cellId], cells.p[c]));
    const closest = distances.indexOf(Math.min.apply(Math, distances));

    haven[cellId] = waterCells[closest];
    harbor[cellId] = waterCells.length;
  };

  const queue = [0];
  for (let featureId = 1; queue[0] !== -1; featureId++) {
    const firstCell = queue[0];
    featureIds[firstCell] = featureId; // assign feature number

    const land = cells.h[firstCell] >= MIN_LAND_HEIGHT;
    let border = false; // true if feature touches map border
    let cellNumber = 1; // count cells in a feature

    while (queue.length) {
      const cellId = queue.pop()!;
      if (cells.b[cellId]) border = true;

      for (const neighborId of cells.c[cellId]) {
        const isNeibLand = cells.h[neighborId] >= MIN_LAND_HEIGHT;

        if (land && !isNeibLand) {
          distanceField[cellId] = LAND_COAST;
          distanceField[neighborId] = WATER_COAST;
          if (!haven[cellId]) defineHaven(cellId);
        } else if (land && isNeibLand) {
          if (distanceField[neighborId] === UNMARKED && distanceField[cellId] === LAND_COAST)
            distanceField[neighborId] = LANDLOCKED;
          else if (distanceField[cellId] === UNMARKED && distanceField[neighborId] === LAND_COAST)
            distanceField[cellId] = LANDLOCKED;
        }

        if (!featureIds[neighborId] && land === isNeibLand) {
          queue.push(neighborId);
          featureIds[neighborId] = featureId;
          cellNumber++;
        }
      }
    }

    const featureVertices = getFeatureVertices({firstCell, vertices, cells, featureIds, featureId});
    const points = clipPoly(featureVertices.map(vertex => vertices.p[vertex]));
    const area = d3.polygonArea(points); // feature perimiter area

    const feature = addFeature({
      vertices,
      heights: cells.h,
      features,
      featureIds,
      firstCell,
      land,
      border,
      featureVertices,
      featureId,
      cellNumber,
      gridCellsNumber,
      area
    });
    features.push(feature);

    queue[0] = featureIds.findIndex(f => f === UNMARKED); // find unmarked cell
  }

  // markup pack land cells
  const dfLandMarked = markup({distanceField, neighbors: cells.c, start: LANDLOCKED + 1, increment: 1});

  // markup deep ocean cells
  const dfOceanMarked = markup({
    distanceField: dfLandMarked,
    neighbors: cells.c,
    start: DEEPER_WATER,
    increment: -1,
    limit: -10
  });

  TIME && console.timeEnd("markupPackFeatures");

  return {features, featureIds, distanceField: dfOceanMarked, haven, harbor};
}

function addFeature({
  vertices,
  heights,
  features,
  featureIds,
  firstCell,
  land,
  border,
  featureVertices,
  featureId,
  cellNumber,
  gridCellsNumber,
  area
}: {
  vertices: IGraphVertices;
  heights: Uint8Array;
  features: TPackFeatures;
  featureIds: Uint16Array;
  firstCell: number;
  land: boolean;
  border: boolean;
  featureVertices: number[];
  featureId: number;
  cellNumber: number;
  gridCellsNumber: number;
  area: number;
}) {
  const OCEAN_MIN_SIZE = gridCellsNumber / 25;
  const SEA_MIN_SIZE = gridCellsNumber / 1000;
  const CONTINENT_MIN_SIZE = gridCellsNumber / 10;
  const ISLAND_MIN_SIZE = gridCellsNumber / 1000;

  const absArea = Math.abs(rn(area));

  if (land) return addIsland();
  if (border) return addOcean();
  return addLake();

  function addIsland() {
    const group = defineIslandGroup();
    const feature: IPackFeatureIsland = {
      i: featureId,
      type: "island",
      group,
      land: true,
      border,
      cells: cellNumber,
      firstCell,
      vertices: featureVertices,
      area: absArea
    };
    return feature;
  }

  function addOcean() {
    const group = defineOceanGroup();
    const feature: IPackFeatureOcean = {
      i: featureId,
      type: "ocean",
      group,
      land: false,
      border: false,
      cells: cellNumber,
      firstCell,
      vertices: featureVertices,
      area: absArea
    };
    return feature;
  }

  function addLake() {
    const group = "freshwater"; // temp, to be defined later
    const name = ""; // temp, to be defined later

    // ensure lake ring is clockwise (to form a hole)
    const lakeVertices = area > 0 ? featureVertices.reverse() : featureVertices;

    const shoreline = getShoreline(); // land cells around lake
    const height = getLakeElevation();

    function getShoreline() {
      const isLand = (cellId: number) => heights[cellId] >= MIN_LAND_HEIGHT;
      const cellsAround = lakeVertices.map(vertex => vertices.c[vertex].filter(isLand)).flat();
      return unique(cellsAround);
    }

    function getLakeElevation() {
      const MIN_ELEVATION_DELTA = 0.1;
      const minShoreHeight = d3.min(shoreline.map(cellId => heights[cellId])) || MIN_LAND_HEIGHT;
      return rn(minShoreHeight - MIN_ELEVATION_DELTA, 2);
    }

    const feature: IPackFeatureLake = {
      i: featureId,
      type: "lake",
      group,
      name,
      land: false,
      border: false,
      cells: cellNumber,
      firstCell,
      vertices: lakeVertices,
      shoreline: shoreline,
      height,
      area: absArea
    };
    return feature;
  }

  function defineOceanGroup() {
    if (cellNumber > OCEAN_MIN_SIZE) return "ocean";
    if (cellNumber > SEA_MIN_SIZE) return "sea";
    return "gulf";
  }

  function defineIslandGroup() {
    const prevFeature = features[featureIds[firstCell - 1]];

    if (prevFeature && prevFeature.type === "lake") return "lake_island";
    if (cellNumber > CONTINENT_MIN_SIZE) return "continent";
    if (cellNumber > ISLAND_MIN_SIZE) return "island";
    return "isle";
  }
}

// calculate distance to coast for every cell
function markup({
  distanceField,
  neighbors,
  start,
  increment,
  limit = INT8_MAX
}: {
  distanceField: Int8Array;
  neighbors: number[][];
  start: number;
  increment: number;
  limit?: number;
}) {
  for (let distance = start, marked = Infinity; marked > 0 && distance !== limit; distance += increment) {
    marked = 0;
    const prevDistance = distance - increment;
    for (let cellId = 0; cellId < neighbors.length; cellId++) {
      if (distanceField[cellId] !== prevDistance) continue;

      for (const neighborId of neighbors[cellId]) {
        if (distanceField[neighborId] !== UNMARKED) continue;
        distanceField[neighborId] = distance;
        marked++;
      }
    }
  }

  return distanceField;
}
