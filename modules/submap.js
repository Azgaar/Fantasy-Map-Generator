"use strict";
/*
Experimental submaping module
*/

window.Submap = (function () {
  function resample(baseState, projection, options) {
    // generate new map based on (resampling) existing one (baseState)
    // baseState: {seed, grid, pack} from original map
    // projection: map function from old to new coordinates or backwards
    //  prj(x,y,direction:bool) -> [x',y']

    const stage = s => INFO && console.log('SUBMAP:', s)
    const timeStart = performance.now();
    invokeActiveZooming();

    // copy seed
    seed = baseState.seed;
    Math.random = aleaPRNG(seed);
    INFO && console.group("SubMap with seed: " + seed);
    DEBUG && console.log("Using Options:", options);

    // create new grid
    applyMapSize();
    placePoints();
    calculateVoronoi(grid, grid.points);

    drawScaleBar();

    const resampler = (points, qtree, f) => {
      for(const [i,[x, y]] of points.entries()) {
        const [tx, ty] = projection(x, y, true);
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
    const forwardGridMap = baseState.grid.points.map(_=>[]); // old -> [newcelllist]
    resampler(grid.points, baseState.pack.cells.q, (id, oldid) => {
      const cid = baseState.pack.cells.g[oldid]
      grid.cells.h[id] = gridCells.h[cid];
      grid.cells.temp[id] = gridCells.temp[cid];
      grid.cells.prec[id] = gridCells.prec[cid];
      if (options.depressRivers) forwardGridMap[oldid].push(id);
    })
    // TODO: add smooth/noise function for h, temp, prec n times

    stage("Detect features, ocean and generating lakes.")
    markFeatures();

    if (options.depressRivers) {
      stage("Generating riverbeds.")
      const rbeds = new Uint16Array(grid.cells.i.length);

      // and erode riverbeds
      baseState.pack.rivers.forEach(r =>
        r.cells.forEach(oldc => {
          const targetCells = forwardGridMap[oldc];
          if (!targetCells) {
            console.error('Targetcells is empty');
            console.log("oldc,gridmap", oldc, forwardGridMap);
            return;
          }
          targetCells.forEach(c => {
            if (grid.cells.t[c]<1) return;
            rbeds[c] = 1;
          });
        })
      );
      // raise every land cell a bit except riverbeds
      grid.cells.h.forEach((h, i) => {
        if (!rbeds[i] || grid.cells.t[i]<1) return;
        grid.cells.h[i] = Math.min(grid.cells.h[i] * 1.1, 255);
      });
    }

    markupGridOcean();
    if (options.addLakesInDepressions)
      addLakesInDeepDepressions();
    // openNearSeaLakes();
    OceanLayers();
    // defineMapSize(); // not needed (not random)
    // TODO: update UI inputs before calculating according to new boundaries.
    calculateMapCoordinates();
    // calculateTemperatures();
    // generatePrecipitation();
    stage("Cell cleanup.")
    reGraph();

    // remove misclassified cells

    stage("Define coastline.")
    drawCoastline();

    // resample packed graph
    const oldCells = baseState.pack.cells;
    const reverseMap = new Map(); // cellmap from new -> oldcell
    const forwardMap = baseState.pack.cells.p.map(_=>[]); // old -> [newcelllist]

    const pn = pack.cells.i.length;
    const cells = pack.cells;
    cells.culture = new Uint16Array(pn);
    cells.state = new Uint16Array(pn);
    cells.burg = new Uint16Array(pn);
    cells.religion = new Uint16Array(pn);
    cells.road = new Uint16Array(pn);
    cells.crossroad = new Uint16Array(pn);

    stage("Resampling culture, state and religion map.")

    resampler(cells.p, oldCells.q, (id, oldid) => {
      if (cells.t[id] * oldCells.t[oldid] < 0) {
        // missmaped cell: water instead of land or vice versa
        WARN && console.warn('Type discrepancy detected:', id, oldid, `${pack.cells.t[id]} != ${oldCells.t[oldid]}`);
        const aid = cells.t[id]<0
          ? cells.c[id].find(c=>cells.t[c]<0)
          : cells.c[id].find(c=>cells.t[c]>0);
        const [x, y] = cells.p[aid];
        const [tx, ty] = projection(x, y, true);
        oldid = oldCells.q.find(tx,ty,Infinity)[2];
        WARN && console.warn(`using cell ${aid}->${oldid} instead`);
      }

      cells.culture[id] = oldCells.culture[oldid];
      cells.state[id] = oldCells.state[oldid];
      cells.religion[id] = oldCells.religion[oldid];
      reverseMap.set(id, oldid)
      forwardMap[oldid].push(id)
    })

    DEBUG && console.log('reversemap:',forwardMap)
    DEBUG && console.log('forwardmap:',reverseMap)

    // TODO: errode riverbeds

    stage("Regenerating river network.")
    Rivers.generate();
    drawRivers();
    Lakes.defineGroup();

    // biome calculation based on (resampled) grid.cells.temp and prec
    // it's safe to recalculate.
    stage("Regenerating Biome.")
    defineBiomes();
    // recalculate suitability and population
    // TODO: normalize according to the base-map
    rankCells();

    // transfer basemap cultures
    pack.cultures = baseState.pack.cultures;
    // fix culture centers
    const validCultures = new Set(pack.cells.culture);
    console.log('cultures',validCultures);
    pack.cultures.forEach((c, i) => {
      if (!validCultures.has(i)) {
        c.removed = true;
        c.center = undefined;
      } else {
        c.center = pack.cells.culture.findIndex(x => x===i);
      }
    });

    // Cultures.generate();
    // Cultures.expand();

    // transfer states, mark states without land as removed.
    const validStates = new Set(pack.cells.state);
    stage("Porting states.")
    pack.states = baseState.pack.states;
    // keep valid states and neighbors only
    pack.states.forEach((s, i) => {
      if (!validStates.has(i)) s.removed=true;
      s.neighbors = s.neighbors.filter(n => validStates.has(n));
    });

    // fix extra coastline cells without state.
    const newCoastCells = cells.t.reduce(
      (a,c,i) => c === -1 && !cells.state[i] ? a.push(i) && a: a, []
    );

    // BurgsAndStates.generate();
    // Religions.generate();
    // BurgsAndStates.defineStateForms();
    // BurgsAndStates.defineBurgFeatures();

    stage("Porting and locking burgs.")
    pack.burgs = baseState.pack.burgs
    const [[xmin, ymin], [xmax, ymax]] = getViewBoxExtent();
    const inMap = (x,y) => x>xmin && x<xmax && y>ymin && y<ymax;

    // remap burgs to the best new cell
    pack.burgs.forEach((b, i) => {
      // [b.x,b.y] = inverseProjection(b.x, b.y);
      [b.x,b.y] = projection(b.x, b.y, false);
      if (!inMap(b.x,b.y)) {
        // disable out-of-map (removed) burgs
        b.removed = true;
        b.cell = undefined;
        return;
      }

      let bestCell = findCell(b.x, b.y);

      // move burgs out of water
      if (cells.t[bestCell] == -1) {
        const coasts = cells.c[bestCell].filter(c=>cells.t[c] == 1);
        if (!coasts.length) {
          WARN && console.warn(`Burg ${b.name} sank like Atlantis. Unable to find coastal cells nearby. Try to reduce resample zoom level.`);
          b.removed = true;
          return;
        }
        bestCell = coasts[0]; // TODO: closest instead?
      }

      b.cell = bestCell;
      b.lock = true;
      pack.cells.burg[b.cell] = i;
      if (options.promoteTown) b.capital = 1;

      // find water body id for ports
      if (b.port) {
        const water = cells.c[b.cell].filter(c=>cells.t[c] == -1);
        if (water.length) {
          b.port = cells.f[water[0]];
          [b.x, b.y] = getMiddlePoint(b.cell, water[0]);
        } else {
          WARN && console.warn(`Can't find water near port ${b.name}. :-/`);
          b.port = 0;
        }
      } else {
        [b.x, b.y] = cells.p[b.cell];
      }

      // TODO: move port burgs to coast b.x, b.y,
    });
    BurgsAndStates.drawBurgs();

    stage("Regenerating road network.")
    Routes.regenerate();

    stage("Regenerating provinces.")
    BurgsAndStates.generateProvinces();

    drawStates();
    drawBorders();
    BurgsAndStates.drawStateLabels();

    Rivers.specify();
    Lakes.generateName();

    stage("Modelling military.")
    Military.generate();
    addMarkers();
    addZones();
    Names.getMapName();
    stage("Submap done.")

    WARN && console.warn(`TOTAL: ${rn((performance.now() - timeStart) / 1000, 2)}s`);
    showStatistics();
    INFO && console.groupEnd("Generated Map " + seed);
  }

  // export
  return { resample }
})();
