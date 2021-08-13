"use strict";
/*
Experimental submaping module
*/

window.Submap = (function () {
  function resample(baseState, projection, monitor=null) {
    // resample original map instead of regenerating
    // based on a parent map (baseState)
    // projection: map function from old to new coordinates: f(x,y) -> [x2,y2]
    // monitor: progress signaling object. MUST have at least 2 properties:
    //  stage: function (string) dispatched at state change
    //  progress: function (float) dispatched at progress change (@long process)

    const stage = s => monitor && monitor.stage && monitor.stage(s)
    const progress = p => monitor && monitor.progress && monitor.progress(p)
    const timeStart = performance.now();
    invokeActiveZooming();

    // copy seed
    seed = baseState.seed;
    Math.random = aleaPRNG(seed);
    INFO && console.group("SubMap with seed: " + seed);

    // create new grid
    applyMapSize();
    placePoints();
    calculateVoronoi(grid, grid.points);

    drawScaleBar();

    const resampler = (points, qtree, f) => {
      for(const [i,[x, y]] of points.entries()) {
        const [tx, ty] = projection(x, y);
        const oldid = qtree.find(tx,ty,Infinity)[2];
        f(i, oldid);
      }
    }

    stage("Resampling heightmap, temperature and precipitation.")
    // resample heightmap from old WorldState
    const n = grid.points.length;
    grid.cells.h = new Uint8Array(n); // heightmap
    grid.cells.temp = new Int8Array(n); // temperature
    grid.cells.prec = new Int8Array(n); // precipitation

    const gridCells = baseState.grid.cells;
    resampler(grid.points, baseState.pack.cells.q, (id, oldid) => {
      const cid = baseState.pack.cells.g[oldid]
      grid.cells.h[id] = gridCells.h[cid];
      grid.cells.temp[id] = gridCells.temp[cid];
      grid.cells.prec[id] = gridCells.prec[cid];
      id%50 || progress(id * 100.0 / grid.points.length);
    })
    // TODO: add smooth/noise function for h, temp, prec n times

    stage("Detect features, ocean and generating lakes.")
    markFeatures();
    markupGridOcean();
    addLakesInDeepDepressions();
    // openNearSeaLakes();
    OceanLayers();
    // defineMapSize(); // not needed (not random)
    // TODO: update UI inputs before calculating according to new boundaries.
    calculateMapCoordinates();
    // calculateTemperatures();
    // generatePrecipitation();
    stage("Cleaning cell network.")
    reGraph();
    drawCoastline();

    // resample packed graph
    const packCells = baseState.pack.cells;
    const reverseMap = new Map(); // cellmap from new -> oldcell
    const forwardMap = baseState.pack.cells.p.map(_=>[]); // old -> [newcelllist]

    const pn = pack.cells.i.length;
    pack.cells.culture = new Uint16Array(pn);
    pack.cells.state = new Uint16Array(pn);
    pack.cells.burg = new Uint16Array(pn);
    pack.cells.religion = new Uint16Array(pn);
    pack.cells.road = new Uint16Array(pn);
    pack.cells.crossroad = new Uint16Array(pn);

    stage("Resampling culture, state and religion map.")

    resampler(pack.cells.p, packCells.q, (id, oldid) => {
      pack.cells.culture[id] = packCells.culture[oldid];
      pack.cells.state[id] = packCells.state[oldid];
      pack.cells.religion[id] = packCells.religion[oldid];
      reverseMap.set(id, oldid)
      forwardMap[oldid].push(id)
    })

    console.log('reversemap:',forwardMap)
    console.log('forwardmap:',reverseMap)

    Rivers.generate();
    drawRivers();
    Lakes.defineGroup();

    // biome calculation based on (resampled) grid.cells.temp and prec
    // it's safe to recalculate.
    defineBiomes();
    // recalculate suitability and population
    // TODO: normalize according to the base-map
    rankCells();

    // transfer basemap cultures
    pack.cultures = baseState.pack.cultures
    // Cultures.generate();
    // Cultures.expand();
    // TODO: update culture centers

    // transfer states and burgs. mark states without land as removed.
    const validStates = new Set(pack.cells.state);
    pack.states = baseState.pack.states
    pack.states.forEach(s => {
      if (!validStates.has(s.i)) s.removed=true;
    });

    // BurgsAndStates.generate();
    // Religions.generate();
    // BurgsAndStates.defineStateForms();
    // BurgsAndStates.defineBurgFeatures();

    // remove non-existent burgs
    pack.burgs = baseState.pack.burgs


    const [[xmin, ymin], [xmax, ymax]] = getViewBoxExtent();
    const inMap = (x,y) => x>xmin && x<xmax && y>ymin && y<ymax;

    // remap burgs to the best new cell
    pack.burgs.forEach((b, i) => {
      [b.x,b.y] = projection(b.x, b.y);
      if (!inMap(b.x,b.y)) {
        // out-of-map (removed) burgs' cell will be undefined
        console.log('burg is out of map:', b)
        b.removed=true;
        b.cell = undefined;
        return;
      }
      b.cell = findCell(b.x, b.y);
      pack.cells.burg[b.cell] = i;
      // TODO: move port burgs to coast b.x, b.y,
    });

    BurgsAndStates.generateProvinces();

    drawStates();
    drawBorders();
    BurgsAndStates.drawStateLabels();

    Rivers.specify();
    Lakes.generateName();

    Military.generate();
    addMarkers();
    addZones();
    Names.getMapName();

    WARN && console.warn(`TOTAL: ${rn((performance.now() - timeStart) / 1000, 2)}s`);
    showStatistics();
    INFO && console.groupEnd("Generated Map " + seed);
  }

  // export
  return { resample }
})();
