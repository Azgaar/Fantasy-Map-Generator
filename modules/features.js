"use strict";

window.Features = (function () {
  const DEEPER_LAND = 3;
  const LANDLOCKED = 2;
  const LAND_COAST = 1;
  const UNMARKED = 0;
  const WATER_COAST = -1;
  const DEEP_WATER = -2;

  // calculate distance to coast for every cell
  function markup({distanceField, neighbors, start, increment, limit = INT8_MAX}) {
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
  }

  // mark Grid features (ocean, lakes, islands) and calculate distance field
  function markupGrid() {
    TIME && console.time("markupGrid");
    Math.random = aleaPRNG(seed); // get the same result on heightmap edit in Erase mode

    const {h: heights, c: neighbors, b: borderCells, i} = grid.cells;
    const cellsNumber = i.length;
    const distanceField = new Int8Array(cellsNumber); // gird.cells.t
    const featureIds = new Uint16Array(cellsNumber); // gird.cells.f
    const features = [0];

    const queue = [0];
    for (let featureId = 1; queue[0] !== -1; featureId++) {
      const firstCell = queue[0];
      featureIds[firstCell] = featureId;

      const land = heights[firstCell] >= 20;
      let border = false; // set true if feature touches map edge

      while (queue.length) {
        const cellId = queue.pop();
        if (borderCells[cellId]) border = true;

        for (const neighborId of neighbors[cellId]) {
          const isNeibLand = heights[neighborId] >= 20;

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
    markup({distanceField, neighbors, start: DEEP_WATER, increment: -1, limit: -10});

    grid.cells.t = distanceField;
    grid.cells.f = featureIds;
    grid.features = features;

    TIME && console.timeEnd("markupGrid");
  }

  // mark Pack features (ocean, lakes, islands), calculate distance field and add properties
  function markupPack() {
    TIME && console.time("markupPack");

    const gridCellsNumber = grid.cells.i.length;
    const OCEAN_MIN_SIZE = gridCellsNumber / 25;
    const SEA_MIN_SIZE = gridCellsNumber / 1000;
    const CONTINENT_MIN_SIZE = gridCellsNumber / 10;
    const ISLAND_MIN_SIZE = gridCellsNumber / 1000;

    const {h: heights, c: neighbors, b: borderCells, i} = pack.cells;
    const cellsNumber = i.length;
    if (!cellsNumber) return; // no cells -> there is nothing to do

    const distanceField = new Int8Array(cellsNumber); // pack.cells.t
    const featureIds = new Uint16Array(cellsNumber); // pack.cells.f
    const haven = createTypedArray({maxValue: cellsNumber, length: cellsNumber}); // haven: opposite water cell
    const harbor = new Uint8Array(cellsNumber); // harbor: number of adjacent water cells
    const features = [0];

    const defineHaven = cellId => {
      const waterCells = neighbors[cellId].filter(isWater);
      const distances = waterCells.map(c => dist2(cells.p[cellId], cells.p[c]));
      const closest = distances.indexOf(Math.min.apply(Math, distances));

      haven[cellId] = waterCells[closest];
      harbor[cellId] = waterCells.length;
    };

    const queue = [0];
    for (let featureId = 1; queue[0] !== -1; featureId++) {
      const firstCell = queue[0];
      featureIds[firstCell] = featureId;

      const land = isLand(firstCell);
      let border = false; // true if feature touches map border
      let totalCells = 1; // count cells in a feature

      while (queue.length) {
        const cellId = queue.pop();
        if (borderCells[cellId]) border = true;

        for (const neighborId of neighbors[cellId]) {
          const isNeibLand = isLand(neighborId);

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
            totalCells++;
          }
        }
      }

      const featureVertices = getFeatureVertices({firstCell, vertices, cells, featureIds, featureId});
      const points = clipPoly(featureVertices.map(vertex => vertices.p[vertex]));
      const area = d3.polygonArea(points); // feature perimiter area
      features.push(addFeature({firstCell, land, border, featureVertices, featureId, totalCells, area}));

      queue[0] = featureIds.findIndex(f => f === UNMARKED); // find unmarked cell
    }

    markup({distanceField, neighbors, start: DEEPER_LAND, increment: 1}); // markup pack land
    markup({distanceField, neighbors, start: DEEP_WATER, increment: -1, limit: -10}); // markup pack water

    pack.cells.t = distanceField;
    pack.cells.f = featureIds;
    pack.cells.haven = haven;
    pack.cells.harbor = harbor;
    pack.features = features;

    TIME && console.timeEnd("markupPack");

    function addFeature({firstCell, land, border, featureVertices, featureId, totalCells, area}) {
      const absArea = Math.abs(rn(area));

      if (land) return addIsland();
      if (border) return addOcean();
      return addLake();

      function addIsland() {
        const group = defineIslandGroup();
        const feature = {
          i: featureId,
          type: "island",
          group,
          land: true,
          border,
          cells: totalCells,
          firstCell,
          vertices: featureVertices,
          area: absArea
        };
        return feature;
      }

      function addOcean() {
        const group = defineOceanGroup();
        const feature = {
          i: featureId,
          type: "ocean",
          group,
          land: false,
          border: false,
          cells: totalCells,
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
          const isLand = cellId => heights[cellId] >= MIN_LAND_HEIGHT;
          const cellsAround = lakeVertices.map(vertex => vertices.c[vertex].filter(isLand)).flat();
          return unique(cellsAround);
        }

        function getLakeElevation() {
          const MIN_ELEVATION_DELTA = 0.1;
          const minShoreHeight = d3.min(shoreline.map(cellId => heights[cellId])) || MIN_LAND_HEIGHT;
          return rn(minShoreHeight - MIN_ELEVATION_DELTA, 2);
        }

        const feature = {
          i: featureId,
          type: "lake",
          group,
          name,
          land: false,
          border: false,
          cells: totalCells,
          firstCell,
          vertices: lakeVertices,
          shoreline: shoreline,
          height,
          area: absArea
        };
        return feature;
      }

      function defineOceanGroup() {
        if (totalCells > OCEAN_MIN_SIZE) return "ocean";
        if (totalCells > SEA_MIN_SIZE) return "sea";
        return "gulf";
      }

      function defineIslandGroup() {
        const prevFeature = features[featureIds[firstCell - 1]];

        if (prevFeature && prevFeature.type === "lake") return "lake_island";
        if (totalCells > CONTINENT_MIN_SIZE) return "continent";
        if (totalCells > ISLAND_MIN_SIZE) return "island";
        return "isle";
      }
    }
  }

  return {markupGrid, markupPack};
})();
