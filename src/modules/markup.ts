import * as d3 from "d3";

import {MIN_LAND_HEIGHT, DISTANCE_FIELD} from "config/generation";
import {ERROR, TIME} from "config/logging";
import {INT8_MAX} from "constants";
// @ts-expect-error js module
import {aleaPRNG} from "scripts/aleaPRNG";
import {createTypedArray} from "utils/arrayUtils";
import {dist2, pick} from "utils/functionUtils";
import {getColors} from "utils/colorUtils";
import {clipPoly} from "utils/lineUtils";

const {UNMARKED, LAND_COAST, WATER_COAST, LANDLOCKED, DEEPER_WATER} = DISTANCE_FIELD;

// define features (oceans, lakes, islands)
export function markupGridFeatures(grid: IGridWithHeights) {
  TIME && console.time("markupGridFeatures");
  Math.random = aleaPRNG(seed); // get the same result on heightmap edit in Erase mode

  if (!grid.cells || !grid.cells.h) {
    throw new Error("markupGridFeatures: grid.cells.h is required");
  }

  const cells = grid.cells;
  const heights = cells.h;
  const n = cells.i.length;

  const featureIds = new Uint16Array(n); // starts from 1
  const distanceField = new Int8Array(n);
  const features: TGridFeatures = [0];

  const queue = [0];
  for (let featureId = 1; queue[0] !== -1; featureId++) {
    const firstCell = queue[0];
    featureIds[firstCell] = featureId;

    const land = heights[firstCell] >= MIN_LAND_HEIGHT;
    let border = false; // set true if feature touches map edge

    while (queue.length) {
      const cellId = queue.pop()!;
      if (cells.b[cellId]) border = true;

      for (const neighborId of cells.c[cellId]) {
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
  const dfOceanMarked = markup({
    distanceField,
    neighbors: grid.cells.c,
    start: DEEPER_WATER,
    increment: -1,
    limit: -10
  });

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

  const packCellsNumber = cells.h.length;
  const gridCellsNumber = grid.cells.h.length;

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

  const OCEAN_MIN_SIZE = gridCellsNumber / 25;
  const SEA_MIN_SIZE = gridCellsNumber / 1000;
  const CONTINENT_MIN_SIZE = gridCellsNumber / 10;
  const ISLAND_MIN_SIZE = gridCellsNumber / 1000;

  function defineOceanGroup(cellsNumber: number) {
    if (cellsNumber > OCEAN_MIN_SIZE) return "ocean";
    if (cellsNumber > SEA_MIN_SIZE) return "sea";
    return "gulf";
  }

  function defineIslandGroup(firstCell: number, cellsNumber: number) {
    const prevCellFeature = features[featureIds[firstCell - 1]];

    if (prevCellFeature && prevCellFeature.type === "lake") return "lake_island";
    if (cellsNumber > CONTINENT_MIN_SIZE) return "continent";
    if (cellsNumber > ISLAND_MIN_SIZE) return "island";
    return "isle";
  }

  function addIsland(featureId: number, border: boolean, firstCell: number, cells: number, vertices: number[]) {
    const group = defineIslandGroup(firstCell, cells);
    const feature: IPackFeatureIsland = {
      i: featureId,
      type: "island",
      group,
      land: true,
      border,
      cells,
      firstCell,
      vertices
    };
    features.push(feature);
  }

  function addOcean(featureId: number, firstCell: number, cells: number, vertices: number[]) {
    const group = defineOceanGroup(cells);
    const feature: IPackFeatureOcean = {
      i: featureId,
      type: "ocean",
      group,
      land: false,
      border: false,
      cells,
      firstCell,
      vertices
    };
    features.push(feature);
  }

  function addLake(featureId: number, firstCell: number, cells: number, vertices: number[]) {
    const group = "freshwater"; // temp, to be defined later
    const name = ""; // temp, to be defined later
    const feature: IPackFeatureLake = {
      i: featureId,
      type: "lake",
      group,
      name,
      land: false,
      border: false,
      cells,
      firstCell,
      vertices
    };
    features.push(feature);
  }

  const queue = [0];
  for (let featureId = 1; queue[0] !== -1; featureId++) {
    const firstCell = queue[0];
    featureIds[firstCell] = featureId; // assign feature number

    const land = cells.h[firstCell] >= MIN_LAND_HEIGHT;
    let border = false; // true if feature touches map border
    let cellNumber = 1; // count cells in a feature

    const featureCells = [firstCell];

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
          featureCells.push(neighborId);
        }
      }
    }

    cells.v[firstCell]
      .map(v => vertices.p[v])
      .forEach(([x, y]) => {
        d3.select("#debug").append("circle").attr("cx", x).attr("cy", y).attr("r", 0.2).attr("fill", "yellow");
      });

    const startingCell = findStartingCell({firstCell, featureIds, featureId, vertices, cells, packCellsNumber});

    const isOuterCell = (cellId: number) => cellId >= packCellsNumber;
    const startingVertex = findStartingVertex({
      startingCell,
      border,
      featureIds,
      featureId,
      vertices,
      cells,
      isOuterCell
    });

    if (startingVertex === undefined || startingVertex > vertices.p.length) {
      throw new Error("Starting vertex not found");
    }

    const color = featureId === 1 ? "#2274cc" : getColors(12)[featureId % 12];
    const paths: TPoint[][] = featureCells.map(i => cells.v[i].map(v => vertices.p[v]));
    d3.select("#cells")
      .append("path")
      .attr("d", "M" + paths.join("M"))
      .attr("fill", color)
      .attr("fill-opacity", 0.5)
      .attr("stroke", "#333")
      .attr("stroke-width", "0.1");

    const [x, y] = cells.p[firstCell];
    d3.select("#debug").append("circle").attr("cx", x).attr("cy", y).attr("r", 1).attr("fill", "blue");
    const [cx, cy] = vertices.p[startingVertex];
    d3.select("#debug").append("circle").attr("cx", cx).attr("cy", cy).attr("r", 1.5).attr("fill", "red");

    const featureVertices = connectVertices({vertices, startingVertex, featureIds, featureId});

    const lineGen = d3.line();
    const points = clipPoly(featureVertices.map(v => vertices.p[v]));
    const path = lineGen(points)!;
    d3.select("#sea_island").attr("stroke", "black").append("path").attr("d", path);

    if (land) addIsland(featureId, border, firstCell, cellNumber, []);
    else if (border) addOcean(featureId, firstCell, cellNumber, []);
    else addLake(featureId, firstCell, cellNumber, []);

    queue[0] = featureIds.findIndex(f => f === UNMARKED); // find unmarked cell
  }

  // markup pack land cells
  const dfLandMarked = markup({distanceField, neighbors: cells.c, start: LANDLOCKED + 1, increment: 1});

  TIME && console.timeEnd("markupPackFeatures");

  return {features, featureIds, distanceField: dfLandMarked, haven, harbor};
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
  for (let distance = start, marked = Infinity; marked > 0 && distance > limit; distance += increment) {
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

function findStartingCell({
  firstCell,
  featureIds,
  featureId,
  vertices,
  cells,
  packCellsNumber
}: {
  firstCell: number;
  featureIds: Uint16Array;
  featureId: number;
  vertices: IGraphVertices;
  cells: Pick<IPack["cells"], "c" | "v">;
  packCellsNumber: number;
}) {
  const bordersOtherFeature = cells.c[firstCell].some(neighbor => featureIds[neighbor] !== featureId);
  if (bordersOtherFeature) return firstCell;

  const neibCells = cells.c[firstCell].sort((a, b) => a - b);
  for (const neibCell of neibCells) {
    const cellVertices = cells.v[neibCell];
    const edgingVertex = cellVertices.findIndex(vertex => vertices.c[vertex].some(cellId => cellId >= packCellsNumber));
    if (edgingVertex !== -1) {
      const engingCell = cells.c[neibCell];
      return engingCell[edgingVertex];
    }
  }

  throw new Error(`Markup: firstCell ${firstCell} of feature ${featureId} has no neighbors of other features`);
}

function findStartingVertex({
  startingCell,
  border,
  featureIds,
  featureId,
  vertices,
  cells,
  isOuterCell
}: {
  startingCell: number;
  border: boolean;
  featureIds: Uint16Array;
  featureId: number;
  vertices: IGraphVertices;
  cells: Pick<IPack["cells"], "c" | "v">;
  isOuterCell: (cellId: number) => boolean;
}) {
  const neibCells = cells.c[startingCell];
  const cellVertices = cells.v[startingCell];

  if (border) {
    const externalVertex = cellVertices.find(vertex => {
      const [x, y] = vertices.p[vertex];
      if (x < 0 || y < 0) return true;
      return vertices.c[vertex].some(isOuterCell);
    });
    if (externalVertex !== undefined) return externalVertex;
  }

  const otherFeatureNeibs = neibCells.filter(neibCell => featureIds[neibCell] !== featureId);
  if (!otherFeatureNeibs.length) {
    throw new Error(`Markup: firstCell ${startingCell} of feature ${featureId} has no neighbors of other features`);
  }

  const index = neibCells.indexOf(d3.min(otherFeatureNeibs)!);
  return cellVertices[index];
}

const CONNECT_VERTICES_MAX_ITERATIONS = 50000;

// connect vertices around feature
function connectVertices({
  vertices,
  startingVertex,
  featureIds,
  featureId
}: {
  vertices: IGraphVertices;
  startingVertex: number;
  featureIds: Uint16Array;
  featureId: number;
}) {
  const ofSameType = (cellId: number) => featureIds[cellId] === featureId;
  const chain: number[] = []; // vertices chain to form a path

  let next = startingVertex;
  for (let i = 0; i === 0 || (next !== startingVertex && i < CONNECT_VERTICES_MAX_ITERATIONS); i++) {
    const previous = chain.at(-1);
    const current = next;
    chain.push(current);

    const [c1, c2, c3] = vertices.c[current].map(ofSameType);
    const [v1, v2, v3] = vertices.v[current];

    if (v1 !== previous && c1 !== c2) next = v1;
    else if (v2 !== previous && c2 !== c3) next = v2;
    else if (v3 !== previous && c1 !== c3) next = v3;

    if (next === current) {
      ERROR && console.error("Next vertex is not found");
      break;
    }
  }

  return chain;
}
