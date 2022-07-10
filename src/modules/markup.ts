import {MIN_LAND_HEIGHT, DISTANCE_FIELD} from "config/generation";
import {TIME} from "config/logging";
import {INT8_MAX} from "constants";
// @ts-expect-error js module
import {aleaPRNG} from "scripts/aleaPRNG";

const {UNMARKED, LAND_COAST, WATER_COAST} = DISTANCE_FIELD;

// define features (grid.features: ocean, lakes, islands) and calculate distance field (cells.t)
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
  let distanceField = new Int8Array(n);
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
  distanceField = markup({graph: grid, distanceField, start: -2, increment: -1, limit: -10});

  TIME && console.timeEnd("markupGridFeatures");
  return {featureIds, distanceField, features};
}

// calculate distance to coast for every cell
function markup({
  graph,
  distanceField,
  start,
  increment,
  limit
}: {
  graph: IGraph;
  distanceField: Int8Array;
  start: number;
  increment: number;
  limit: number;
}) {
  const cellsLength = graph.cells.i.length;
  const neighbors = graph.cells.c;

  for (let distance = start, marked = Infinity; marked > 0 && distance > limit; distance += increment) {
    marked = 0;
    const prevDistance = distance - increment;
    for (let cellId = 0; cellId < cellsLength; cellId++) {
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

// Re-mark features (ocean, lakes, islands)
export function reMarkFeatures() {
  TIME && console.time("reMarkFeatures");
  const {cells} = pack;
  const features: TPackFeatures = [0];
  const n = cells.i.length;

  cells.f = new Uint16Array(n); // cell feature number
  cells.t = new Int8Array(n); // cell type: 1 = land along coast; -1 = water along coast;
  cells.haven = n < 65535 ? new Uint16Array(n) : new Uint32Array(n); // cell haven (opposite water cell);
  cells.harbor = new Uint8Array(n); // cell harbor (number of adjacent water cells);

  const defineHaven = (i: number) => {
    const water = cells.c[i].filter(c => cells.h[c] < 20);
    const dist2 = water.map(c => (cells.p[i][0] - cells.p[c][0]) ** 2 + (cells.p[i][1] - cells.p[c][1]) ** 2);
    const closest = water[dist2.indexOf(Math.min.apply(Math, dist2))];

    cells.haven[i] = closest;
    cells.harbor[i] = water.length;
  };

  for (let i = 1, queue = [0]; queue[0] !== -1; i++) {
    const start = queue[0]; // first cell
    cells.f[start] = i; // assign feature number
    const land = cells.h[start] >= 20;
    let border = false; // true if feature touches map border
    let cellNumber = 1; // to count cells number in a feature

    while (queue.length) {
      const firstCellId = queue.pop()!;

      if (cells.b[firstCellId]) border = true;
      cells.c[firstCellId].forEach(function (e) {
        const eLand = cells.h[e] >= 20;
        if (land && !eLand) {
          cells.t[firstCellId] = 1;
          cells.t[e] = -1;
          if (!cells.haven[firstCellId]) defineHaven(firstCellId);
        } else if (land && eLand) {
          if (!cells.t[e] && cells.t[firstCellId] === 1) cells.t[e] = 2;
          else if (!cells.t[firstCellId] && cells.t[e] === 1) cells.t[firstCellId] = 2;
        }
        if (!cells.f[e] && land === eLand) {
          queue.push(e);
          cells.f[e] = i;
          cellNumber++;
        }
      });
    }

    if (land) {
      const group = defineIslandGroup(start, cellNumber);
      const feature: IPackFeatureIsland = {i, type: "island", group, land, border, cells: cellNumber, firstCell: start};
      features.push(feature);
    } else if (border) {
      const group = defineOceanGroup(cellNumber);
      const feature: IPackFeatureOcean = {i, type: "ocean", group, land, border, cells: cellNumber, firstCell: start};
      features.push(feature);
    } else {
      const group = "freshwater"; // temp, to be defined later
      const name = ""; // temp, to be defined later
      const cells = cellNumber;
      const feature: IPackFeatureLake = {i, type: "lake", group, name, land, border, cells, firstCell: start};
      features.push(feature);
    }

    queue[0] = cells.f.findIndex(f => f === UNMARKED); // find unmarked cell
  }

  // markupPackLand
  markup({graph: pack, distanceField: pack.cells.t, start: 3, increment: 1, limit: INT8_MAX});

  function defineOceanGroup(number: number) {
    if (number > grid.cells.i.length / 25) return "ocean";
    if (number > grid.cells.i.length / 100) return "sea";
    return "gulf";
  }

  function defineIslandGroup(cellId: number, number: number) {
    const prevCellFeature = features[cells.f[cellId - 1]];

    if (cellId && prevCellFeature && prevCellFeature.type === "lake") return "lake_island";
    if (number > grid.cells.i.length / 10) return "continent";
    if (number > grid.cells.i.length / 1000) return "island";
    return "isle";
  }

  pack.features = features;

  TIME && console.timeEnd("reMarkFeatures");
}
