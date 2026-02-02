"use strict";

window.Resample = (function () {
  /*
    generate new map based on an existing one (resampling parentMap)
    parentMap: {grid, pack, notes} from original map
    projection: f(Number, Number) -> [Number, Number]
    inverse: f(Number, Number) -> [Number, Number]
    scale: Number
  */
  function process({projection, inverse, scale}) {
    const parentMap = {grid: deepCopy(grid), pack: deepCopy(pack), notes: deepCopy(notes)};
    const riversData = saveRiversData(pack.rivers);

    grid = generateGrid();
    pack = {};
    notes = parentMap.notes;

    resamplePrimaryGridData(parentMap, inverse, scale);

    Features.markupGrid();
    addLakesInDeepDepressions();
    openNearSeaLakes();

    OceanLayers();
    calculateMapCoordinates();
    calculateTemperatures();

    reGraph();
    Features.markupPack();
    Ice.generate()
    createDefaultRuler();

    restoreCellData(parentMap, inverse, scale);
    restoreRivers(riversData, projection, scale);
    restoreCultures(parentMap, projection);
    restoreBurgs(parentMap, projection, scale);
    restoreStates(parentMap, projection);
    restoreRoutes(parentMap, projection);
    restoreReligions(parentMap, projection);
    restoreProvinces(parentMap);
    restoreFeatureDetails(parentMap, inverse);
    restoreMarkers(parentMap, projection);
    restoreZones(parentMap, projection, scale);

    showStatistics();
  }

  function resamplePrimaryGridData(parentMap, inverse, scale) {
    grid.cells.h = new Uint8Array(grid.points.length);
    grid.cells.temp = new Int8Array(grid.points.length);
    grid.cells.prec = new Uint8Array(grid.points.length);

    grid.points.forEach(([x, y], newGridCell) => {
      const [parentX, parentY] = inverse(x, y);
      const parentPackCell = parentMap.pack.cells.q.find(parentX, parentY, Infinity)[2];
      const parentGridCell = parentMap.pack.cells.g[parentPackCell];

      grid.cells.h[newGridCell] = parentMap.grid.cells.h[parentGridCell];
      grid.cells.temp[newGridCell] = parentMap.grid.cells.temp[parentGridCell];
      grid.cells.prec[newGridCell] = parentMap.grid.cells.prec[parentGridCell];
    });

    if (scale >= 2) smoothHeightmap();
  }

  function smoothHeightmap() {
    grid.cells.h.forEach((height, newGridCell) => {
      const heights = [height, ...grid.cells.c[newGridCell].map(c => grid.cells.h[c])];
      const meanHeight = d3.mean(heights);
      grid.cells.h[newGridCell] = isWater(grid, newGridCell) ? Math.min(meanHeight, 19) : Math.max(meanHeight, 20);
    });
  }

  function restoreCellData(parentMap, inverse, scale) {
    pack.cells.biome = new Uint8Array(pack.cells.i.length);
    pack.cells.fl = new Uint16Array(pack.cells.i.length);
    pack.cells.s = new Int16Array(pack.cells.i.length);
    pack.cells.pop = new Float32Array(pack.cells.i.length);
    pack.cells.culture = new Uint16Array(pack.cells.i.length);
    pack.cells.state = new Uint16Array(pack.cells.i.length);
    pack.cells.burg = new Uint16Array(pack.cells.i.length);
    pack.cells.religion = new Uint16Array(pack.cells.i.length);
    pack.cells.province = new Uint16Array(pack.cells.i.length);

    const parentPackCellGroups = groupCellsByType(parentMap.pack);
    const parentPackLandCellsQuadtree = d3.quadtree(parentPackCellGroups.land);

    for (const newPackCell of pack.cells.i) {
      const [x, y] = inverse(...pack.cells.p[newPackCell]);
      if (isWater(pack, newPackCell)) continue;

      const parentPackCell = parentPackLandCellsQuadtree.find(x, y, Infinity)[2];
      const parentCellArea = parentMap.pack.cells.area[parentPackCell];
      const areaRatio = pack.cells.area[newPackCell] / parentCellArea;
      const scaleRatio = areaRatio / scale;

      pack.cells.biome[newPackCell] = parentMap.pack.cells.biome[parentPackCell];
      pack.cells.fl[newPackCell] = parentMap.pack.cells.fl[parentPackCell];
      pack.cells.s[newPackCell] = parentMap.pack.cells.s[parentPackCell] * scaleRatio;
      pack.cells.pop[newPackCell] = parentMap.pack.cells.pop[parentPackCell] * scaleRatio;
      pack.cells.culture[newPackCell] = parentMap.pack.cells.culture[parentPackCell];
      pack.cells.state[newPackCell] = parentMap.pack.cells.state[parentPackCell];
      pack.cells.religion[newPackCell] = parentMap.pack.cells.religion[parentPackCell];
      pack.cells.province[newPackCell] = parentMap.pack.cells.province[parentPackCell];
    }
  }

  function saveRiversData(parentRivers) {
    return parentRivers.map(river => {
      const meanderedPoints = Rivers.addMeandering(river.cells, river.points);
      return {...river, meanderedPoints};
    });
  }

  function restoreRivers(riversData, projection, scale) {
    pack.cells.r = new Uint16Array(pack.cells.i.length);
    pack.cells.conf = new Uint8Array(pack.cells.i.length);

    pack.rivers = riversData
      .map(river => {
        let wasInMap = true;
        const points = [];

        river.meanderedPoints.forEach(([parentX, parentY]) => {
          const [x, y] = projection(parentX, parentY);
          const inMap = isInMap(x, y);
          if (inMap || wasInMap) points.push([rn(x, 2), rn(y, 2)]);
          wasInMap = inMap;
        });
        if (points.length < 2) return null;

        const cells = points.map(point => findCell(...point));
        cells.forEach(cellId => {
          if (pack.cells.r[cellId]) pack.cells.conf[cellId] = 1;
          pack.cells.r[cellId] = river.i;
        });

        const widthFactor = river.widthFactor * scale;
        return {...river, cells, points, source: cells.at(0), mouth: cells.at(-2), widthFactor};
      })
      .filter(Boolean);

    pack.rivers.forEach(river => {
      river.basin = Rivers.getBasin(river.i);
      river.length = Rivers.getApproximateLength(river.points);
    });
  }

  function restoreCultures(parentMap, projection) {
    const validCultures = new Set(pack.cells.culture);
    const culturePoles = getPolesOfInaccessibility(pack, cellId => pack.cells.culture[cellId]);
    pack.cultures = parentMap.pack.cultures.map(culture => {
      if (!culture.i || culture.removed) return culture;
      if (!validCultures.has(culture.i)) return {...culture, removed: true, lock: false};

      const [xp, yp] = projection(...parentMap.pack.cells.p[culture.center]);
      const [x, y] = [rn(xp, 2), rn(yp, 2)];
      const centerCoords = isInMap(x, y) ? [x, y] : culturePoles[culture.i];
      const center = findCell(...centerCoords);
      return {...culture, center};
    });
  }

  function restoreBurgs(parentMap, projection, scale) {
    const packLandCellsQuadtree = d3.quadtree(groupCellsByType(pack).land);
    const findLandCell = (x, y) => packLandCellsQuadtree.find(x, y, Infinity)?.[2];

    pack.burgs = parentMap.pack.burgs.map(burg => {
      if (!burg.i || burg.removed) return burg;
      burg.population *= scale; // adjust for populationRate change

      const [xp, yp] = projection(burg.x, burg.y);
      if (!isInMap(xp, yp)) return {...burg, removed: true, lock: false};

      const closestCell = findCell(xp, yp);
      const cell = isWater(pack, closestCell) ? findLandCell(xp, yp) : closestCell;

      if (pack.cells.burg[cell]) {
        WARN && console.warn(`Cell ${cell} already has a burg. Removing burg ${burg.name} (${burg.i})`);
        return {...burg, removed: true, lock: false};
      }

      pack.cells.burg[cell] = burg.i;
      const [x, y] = getBurgCoordinates(burg, closestCell, cell, xp, yp);
      return {...burg, cell, x, y};
    });

    function getBurgCoordinates(burg, closestCell, cell, xp, yp) {
      const haven = pack.cells.haven[cell];
      if (burg.port && haven) return getCloseToEdgePoint(cell, haven);

      if (closestCell !== cell) return pack.cells.p[cell];
      return [rn(xp, 2), rn(yp, 2)];
    }

    function getCloseToEdgePoint(cell1, cell2) {
      const {cells, vertices} = pack;

      const [x0, y0] = cells.p[cell1];
      const commonVertices = cells.v[cell1].filter(vertex => vertices.c[vertex].some(cell => cell === cell2));
      const [x1, y1] = vertices.p[commonVertices[0]];
      const [x2, y2] = vertices.p[commonVertices[1]];
      const xEdge = (x1 + x2) / 2;
      const yEdge = (y1 + y2) / 2;

      const x = rn(x0 + 0.95 * (xEdge - x0), 2);
      const y = rn(y0 + 0.95 * (yEdge - y0), 2);

      return [x, y];
    }
  }

  function restoreStates(parentMap, projection) {
    const validStates = new Set(pack.cells.state);
    pack.states = parentMap.pack.states.map(state => {
      if (!state.i || state.removed) return state;
      if (validStates.has(state.i)) return state;
      return {...state, removed: true, lock: false};
    });

    States.getPoles();
    const regimentCellsMap = {};
    const VERTICAL_GAP = 8;

    pack.states = pack.states.map(state => {
      if (!state.i || state.removed) return state;

      const capital = pack.burgs[state.capital];
      state.center = !capital || capital.removed ? findCell(...state.pole) : capital.cell;

      const military = state.military.map(regiment => {
        const cellCoords = projection(...parentMap.pack.cells.p[regiment.cell]);
        const cell = isInMap(...cellCoords) ? findCell(...cellCoords) : state.center;

        const [xPos, yPos] = projection(regiment.x, regiment.y);
        const [xBase, yBase] = projection(regiment.bx, regiment.by);
        const [xCell, yCell] = pack.cells.p[cell];

        const regsOnCell = regimentCellsMap[cell] || 0;
        regimentCellsMap[cell] = regsOnCell + 1;

        const name =
          isInMap(xPos, yPos) || regiment.name.includes("[relocated]") ? regiment.name : `[relocated] ${regiment.name}`;

        const pos = isInMap(xPos, yPos)
          ? {x: rn(xPos, 2), y: rn(yPos, 2)}
          : {x: xCell, y: yCell + regsOnCell * VERTICAL_GAP};

        const base = isInMap(xBase, yBase) ? {bx: rn(xBase, 2), by: rn(yBase, 2)} : {bx: xCell, by: yCell};

        return {...regiment, cell, name, ...base, ...pos};
      });

      const neighbors = state.neighbors.filter(stateId => validStates.has(stateId));
      return {...state, neighbors, military};
    });
  }

  function restoreRoutes(parentMap, projection) {
    pack.routes = parentMap.pack.routes
      .map(route => {
        let wasInMap = true;
        const points = [];

        route.points.forEach(([parentX, parentY]) => {
          const [x, y] = projection(parentX, parentY);
          const inMap = isInMap(x, y);
          if (inMap || wasInMap) points.push([rn(x, 2), rn(y, 2)]);
          wasInMap = inMap;
        });
        if (points.length < 2) return null;

        const bbox = [0, 0, graphWidth, graphHeight];
        const clipped = lineclip(points, bbox)[0].map(([x, y]) => [rn(x, 2), rn(y, 2), findCell(x, y)]);
        const firstCell = clipped[0][2];
        const feature = pack.cells.f[firstCell];
        return {...route, feature, points: clipped};
      })
      .filter(Boolean);

    pack.cells.routes = Routes.buildLinks(pack.routes);
  }

  function restoreReligions(parentMap, projection) {
    const validReligions = new Set(pack.cells.religion);
    const religionPoles = getPolesOfInaccessibility(pack, cellId => pack.cells.religion[cellId]);

    pack.religions = parentMap.pack.religions.map(religion => {
      if (!religion.i || religion.removed) return religion;
      if (!validReligions.has(religion.i)) return {...religion, removed: true, lock: false};

      const [xp, yp] = projection(...parentMap.pack.cells.p[religion.center]);
      const [x, y] = [rn(xp, 2), rn(yp, 2)];
      const centerCoords = isInMap(x, y) ? [x, y] : religionPoles[religion.i];
      const center = findCell(...centerCoords);
      return {...religion, center};
    });
  }

  function restoreProvinces(parentMap) {
    const validProvinces = new Set(pack.cells.province);
    pack.provinces = parentMap.pack.provinces.map(province => {
      if (!province.i || province.removed) return province;
      if (!validProvinces.has(province.i)) return {...province, removed: true, lock: false};

      return province;
    });

    Provinces.getPoles();

    pack.provinces.forEach(province => {
      if (!province.i || province.removed) return;
      const capital = pack.burgs[province.burg];
      province.center = !capital?.removed ? capital.cell : findCell(...province.pole);
    });
  }

  function restoreMarkers(parentMap, projection) {
    pack.markers = parentMap.pack.markers;
    pack.markers.forEach(marker => {
      const [x, y] = projection(marker.x, marker.y);
      if (!isInMap(x, y)) Markers.deleteMarker(marker.i);

      const cell = findCell(x, y);
      marker.x = rn(x, 2);
      marker.y = rn(y, 2);
      marker.cell = cell;
    });
  }

  function restoreZones(parentMap, projection, scale) {
    const getSearchRadius = cellId => Math.sqrt(parentMap.pack.cells.area[cellId] / Math.PI) * scale;

    pack.zones = parentMap.pack.zones.map(zone => {
      const cells = zone.cells
        .map(cellId => {
          const [x, y] = projection(...parentMap.pack.cells.p[cellId]);
          if (!isInMap(x, y)) return null;
          return findAll(x, y, getSearchRadius(cellId));
        })
        .filter(Boolean)
        .flat();

      return {...zone, cells: unique(cells)};
    });
  }

  function restoreFeatureDetails(parentMap, inverse) {
    pack.features.forEach(feature => {
      if (!feature) return;
      const [x, y] = pack.cells.p[feature.firstCell];
      const [parentX, parentY] = inverse(x, y);
      const parentCell = parentMap.pack.cells.q.find(parentX, parentY, Infinity)[2];
      if (parentCell === undefined) return;
      const parentFeature = parentMap.pack.features[parentMap.pack.cells.f[parentCell]];

      if (parentFeature.group) feature.group = parentFeature.group;
      if (parentFeature.name) feature.name = parentFeature.name;
      if (parentFeature.height) feature.height = parentFeature.height;
    });
  }

  function groupCellsByType(graph) {
    return graph.cells.p.reduce(
      (acc, [x, y], cellId) => {
        const group = isWater(graph, cellId) ? "water" : "land";
        acc[group].push([x, y, cellId]);
        return acc;
      },
      {land: [], water: []}
    );
  }

  function isWater(graph, cellId) {
    return graph.cells.h[cellId] < 20;
  }

  function isInMap(x, y) {
    return x >= 0 && x <= graphWidth && y >= 0 && y <= graphHeight;
  }

  return {process};
})();
