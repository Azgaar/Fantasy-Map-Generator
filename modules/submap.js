"use strict";
/*
Experimental submaping module
*/

window.Submap = (function () {
  function resample(parentMap, projection, options) {
    // generate new map based on (resampling) existing one (parentMap)
    // parentMap: {seed, grid, pack} from original map
    // projection: map function from old to new coordinates or backwards
    //  prj(x,y,direction:bool) -> [x',y']

    const stage = s => INFO && console.log('SUBMAP:', s)
    const timeStart = performance.now();
    invokeActiveZooming();

    // copy seed
    seed = parentMap.seed;
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

    const gridCells = parentMap.grid.cells;
    const forwardGridMap = parentMap.grid.points.map(_=>[]); // old -> [newcelllist]
    resampler(grid.points, parentMap.pack.cells.q, (id, oldid) => {
      const cid = parentMap.pack.cells.g[oldid]
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
      parentMap.pack.rivers.forEach(r =>
        r.cells.forEach(oldc => {
          const targetCells = forwardGridMap[oldc];
          if (!targetCells) throw "TargetCell shouldn't be empty.";
          targetCells.forEach(c => {
            if (grid.cells.t[c]<1) return;
            rbeds[c] = 1;
          });
        })
      );
      // raise every land cell a bit except riverbeds
      grid.cells.h.forEach((h, i) => {
        if (!rbeds[i] || grid.cells.t[i]<1) return;
        grid.cells.h[i] = Math.min(grid.cells.h[i]+2, 100);
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
    const oldCells = parentMap.pack.cells;
    const reverseMap = new Map(); // cellmap from new -> oldcell
    const forwardMap = parentMap.pack.cells.p.map(_=>[]); // old -> [newcelllist]

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
    stage("Regenerating Biome.");
    defineBiomes();
    // recalculate suitability and population
    // TODO: normalize according to the base-map
    rankCells();

    // transfer basemap cultures
    pack.cultures = parentMap.pack.cultures;
    // fix culture centers
    const validCultures = new Set(pack.cells.culture);
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
    stage("Porting states.");
    pack.states = parentMap.pack.states;
    // keep valid states and neighbors only
    pack.states.forEach((s, i) => {
      if (s.removed) return;
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

    stage("Porting and locking burgs.");
    if (options.copyBurgs) copyBurgs(parentMap, projection, options);
    else BurgsAndStates.regenerateBurgs();
    BurgsAndStates.drawBurgs();

    stage("Regenerating road network.");
    Routes.regenerate();

    stage("Regenerating provinces.");
    BurgsAndStates.generateProvinces();

    drawStates();
    drawBorders();
    BurgsAndStates.drawStateLabels();

    Rivers.specify();
    Lakes.generateName();

    stage("Modelling military, markers and zones (if requested).");
    if (options.addMilitary) Military.generate();
    if (options.addMarkers) addMarkers();
    if (options.addZones) addZones();
    Names.getMapName();
    stage("Submap done.");

    WARN && console.warn(`TOTAL: ${rn((performance.now() - timeStart) / 1000, 2)}s`);
    showStatistics();
    INFO && console.groupEnd("Generated Map " + seed);
  }

  /* find the nearest cell having at least one *neighbor*
  *  fulfilling filter f, up to cell-distance `max`
  *  returns [cellid, neighbor] tuple or undefined if no such cell.
  */
  const findNearest = (f, max=3) => centerId => {
    const met = new Set([centerId]); // f might be expensive
    const kernel = (c, dist) => {
      const ncs = pack.cells.c[c].filter(nc => !met.has(nc));
      const n = ncs.find(f);
      if (n) return [c, n];
      if (dist >= max || !ncs.length) return undefined;
      ncs.forEach(i => met.add(i));
      let answer;
      while (ncs.length && !answer) answer = kernel(ncs.shift(), dist+1);
      return answer;
    }
    return kernel(centerId, 1);
  }

  function copyBurgs(parentMap, projection, options) {
    const [[xmin, ymin], [xmax, ymax]] = getViewBoxExtent();
    const inMap = (x,y) => x>xmin && x<xmax && y>ymin && y<ymax;
    const cells = pack.cells;
    pack.burgs = parentMap.pack.burgs;

    // remap burgs to the best new cell
    pack.burgs.forEach( (b, id) => {
      if (id == 0) return; // skip empty city of neturals
      [b.x, b.y] = projection(b.x, b.y, false);

      // disable out-of-map (removed) burgs
      if (!inMap(b.x,b.y)) {
        b.removed = true;
        b.cell = undefined;
        return;
      }

      let cityCell = findCell(b.x, b.y);

      // pull sunken burgs out of water
      if (cells.t[cityCell] <= 0) {
        const searchPlace = findNearest(c => cells.t[c] === 1);
        const res = searchPlace(cityCell)
        if (!res) {
          WARN && console.warn(`Burg ${b.name} sank like Atlantis. Unable to find coastal cells nearby. Try to reduce resample zoom level.`);
          b.removed = true;
          return;
        }
        const [water, coast] = res;
        [b.x, b.y] = b.port? getMiddlePoint(coast, water): cells.p[coast];
        if (b.port) b.port = cells.f[water];
        b.cell = coast;
      } if (b.port) {
        // find coast for ports on land
        const searchPortCell = findNearest(c => cells.t[c] === -1);
        const res = searchPortCell(cityCell);
        if (res) {
          const [coast, water] = res;
          [b.x, b.y] = getMiddlePoint(coast, water);
          b.port = cells.f[water]; // copy feature number
          b.cell = coast;
        } else {
          WARN && console.warn(`Can't find water near port ${b.name}. :-/`);
          b.port = 0;
        }
      } else {
        b.cell = cityCell;
        [b.x, b.y] = cells.p[cityCell];
      }
      b.lock = true;
      pack.cells.burg[b.cell] = id;
      if (options.promoteTown) b.capital = 1;
    });
  }

  // export
  return { resample }
})();
