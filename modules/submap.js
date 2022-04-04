"use strict";
/*
Experimental submaping module
*/

window.Submap = (function () {
  const isWater = (map, id) => map.grid.cells.h[map.pack.cells.g[id]] < 20? true: false;
  const inMap = (x,y) => x>0 && x<graphWidth && y>0 && y<graphHeight;

  function resample(parentMap, projection, options) {
    // generate new map based on an existing one (resampling parentMap)
    // parentMap: {seed, grid, pack} from original map
    // projection: map function from old to new coordinates or backwards
    //  prj(x,y,direction:bool) -> [x',y']

    const stage = s => INFO && console.log('SUBMAP:', s)
    const timeStart = performance.now();
    const childMap = { grid, pack }
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
    drawScaleBar(scale);

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
    const reverseGridMap = new Uint32Array(n); // cellmap from new -> oldcell

    const oldGrid = parentMap.grid;
    // build cache old -> [newcelllist]
    const forwardGridMap = parentMap.grid.points.map(_=>[]);
    resampler(grid.points, parentMap.pack.cells.q, (id, oldid) => {
      const cid = parentMap.pack.cells.g[oldid];
      grid.cells.h[id] = oldGrid.cells.h[cid];
      grid.cells.temp[id] = oldGrid.cells.temp[cid];
      grid.cells.prec[id] = oldGrid.cells.prec[cid];
      if (options.depressRivers) forwardGridMap[cid].push(id);
      reverseGridMap[id] = cid;
    })
    // TODO: add smooth/noise function for h, temp, prec n times

    // smooth heightmap
    // smoothing should never change cell type (land->water or water->land)

    if (options.smoothHeightMap) {
      const gcells = grid.cells;
      gcells.h.forEach((h,i) => {
        const hs = gcells.c[i].map(c=>gcells.h[c])
        hs.push(h)
        gcells.h[i] = h>=20
          ? Math.max(d3.mean(hs),20)
          : Math.min(d3.mean(hs),19);
      });
    }

    if (options.depressRivers) {
      stage("Generating riverbeds.")
      const rbeds = new Uint16Array(grid.cells.i.length);

      // and erode riverbeds
      parentMap.pack.rivers.forEach(r =>
        r.cells.forEach(oldpc => {
          if (oldpc < 0) return; // ignore out-of-map marker (-1)
          const oldc = parentMap.pack.cells.g[oldpc];
          const targetCells = forwardGridMap[oldc];
          if (!targetCells)
            throw "TargetCell shouldn't be empty.";
          targetCells.forEach(c => {
            if (grid.cells.h[c]<20) return;
            rbeds[c] = 1;
          });
        })
      );
      // raise every land cell a bit except riverbeds
      grid.cells.h.forEach((h, i) => {
        if (rbeds[i] || h<20) return;
        grid.cells.h[i] = Math.min(h+2, 100);
      });
    }

    stage("Detect features, ocean and generating lakes.")
    markFeatures();
    markupGridOcean();

    // Warning: addLakesInDeepDepressions can be very slow!
    if (options.addLakesInDepressions) {
      addLakesInDeepDepressions();
      openNearSeaLakes();
    }

    OceanLayers();

    calculateMapCoordinates();
    // calculateTemperatures();
    // generatePrecipitation();
    stage("Cell cleanup.")
    reGraph();

    // remove misclassified cells
    stage("Define coastline.")
    drawCoastline();

    /****************************************************/
    /* Packed Graph */
    /****************************************************/
    const oldCells = parentMap.pack.cells;
    // const reverseMap = new Map(); // cellmap from new -> oldcell
    const forwardMap = parentMap.pack.cells.p.map(_=>[]); // old -> [newcelllist]

    const pn = pack.cells.i.length;
    const cells = pack.cells;
    cells.culture = new Uint16Array(pn);
    cells.state = new Uint16Array(pn);
    cells.burg = new Uint16Array(pn);
    cells.religion = new Uint16Array(pn);
    cells.road = new Uint16Array(pn);
    cells.crossroad = new Uint16Array(pn);
    cells.province = new Uint16Array(pn);

    stage("Resampling culture, state and religion map.")
    for(const [id, gridCellId] of cells.g.entries()) {
      const oldGridId = reverseGridMap[gridCellId];
      if (!oldGridId) throw new Error("Old grid Id must be defined!")
      // find old parent's children
      const oldChildren = oldCells.i.filter(oid=>oldCells.g[oid]==oldGridId);
      let oldid; // matching cell on the original map

      if (!oldChildren.length) {
        // it *must* be a (deleted) deep ocean cell
        if (!oldGrid.cells.h[oldGridId] < 20) {
          console.error(`Warning, ${gridCellId} should be water cell, not ${oldGrid.cells.h[oldGridId]}`);
          continue;
        }
        // find replacement: closest water cell
        const [ox, oy] = cells.p[id]
        const [tx, ty] = projection(x, y, true);
        oldid = oldCells.q.find(tx,ty,Infinity)[2];
        if (!oldid) {
          console.warn("Warning, no id found in quad", id, "parent", gridCellId);
          continue;
        }
      } else {
        // find closest children (packcell) on the parent map
        const distance = x => (x[0]-cells.p[id][0])**2 + (x[1]-cells.p[id][1])**2;
        let d = Infinity;
        oldChildren.forEach(oid => {
          // must be the same type (this should be always true!)
          if (isWater(parentMap, oid) !== isWater(childMap, id)) {
            console.error(
              "should be the same", oid, id, oldCells.t[oid], cells.t[id],
              "oldparent", oldCells.g[oid], "newparent", cells.g[id],
              "oldheight:", oldGrid.cells.h[oldCells.g[oid]],
              "newheight", grid.cells.h[cells.g[id]])
            throw new Error("should be the same type.")
          }
          const [oldpx, oldpy] = oldCells.p[oid];
          const nd = distance(projection(oldpx, oldpx, false));
          if (!nd) {
            console.error("no distance!", nd, "old point", oldp)
          }
          if (nd < d) [d, oldid] = [nd, oid];
        })
        if (!oldid) {
          console.warn("Warning, no match for", id, "parent", gridCellId, "in");
          continue;
        }
      }

      if (isWater(childMap, id) !== isWater(parentMap, oldid)) {
        WARN && console.warn('Type discrepancy detected:', id, oldid, `${pack.cells.t[id]} != ${oldCells.t[oldid]}`);
      }

      cells.culture[id] = oldCells.culture[oldid];
      cells.state[id] = oldCells.state[oldid];
      cells.religion[id] = oldCells.religion[oldid];
      cells.province[id] = oldCells.province[oldid];
      // reverseMap.set(id, oldid)
      forwardMap[oldid].push(id)
    }

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

    stage("Porting Cultures");
    pack.cultures = parentMap.pack.cultures;
    // fix culture centers
    const validCultures = new Set(pack.cells.culture);
    pack.cultures.forEach((c, i) => {
      if (!i) return // ignore wildlands
      if (!validCultures.has(i)) {
        c.removed = true;
        c.center = null;
        return
      }
      const newCenters = forwardMap[c.center]
      c.center = newCenters.length
        ? newCenters[0]
        : pack.cells.culture.findIndex(x => x===i);
    });

    stage("Porting and locking burgs.");
    if (options.copyBurgs) copyBurgs(parentMap, projection, options);

    // transfer states, mark states without land as removed.
    stage("Porting states.");
    const validStates = new Set(pack.cells.state);
    pack.states = parentMap.pack.states;
    // keep valid states and neighbors only
    pack.states.forEach((s, i) => {
      if (!s.i || s.removed) return; // ignore removed and neutrals
      if (!validStates.has(i)) s.removed = true;
      s.neighbors = s.neighbors.filter(n => validStates.has(n));

      // find center
      s.center = (options.copyBurgs && pack.burgs[s.capital].cell)
        ? pack.burgs[s.capital].cell // capital is the best bet
        : pack.cells.state.findIndex(x => x===i); // otherwise use the first valid cell
    });

    // transfer provinces, mark provinces without land as removed.
    stage("Porting provinces.");
    const validProvinces = new Set(pack.cells.province);
    pack.provinces = parentMap.pack.provinces;
    // mark uneccesary provinces
    pack.provinces.forEach((p, i) => {
      if (!p || p.removed) return;
      if (!validProvinces.has(i)) {
        p.removed = true;
        return
      }
      const newCenters = forwardMap[p.center]
      p.center = newCenters.length
        ? newCenters[0]
        : pack.cells.province.findIndex(x => x===i);
    });

    // regenerate (if not copied) and display burgs
    if (!options.copyBurgs) BurgsAndStates.regenerateBurgs();
    BurgsAndStates.drawBurgs();

    stage("Regenerating road network.");
    if (!options.copyRoads) Routes.regenerate();

    drawStates();
    drawBorders();
    BurgsAndStates.drawStateLabels();

    Rivers.specify();
    Lakes.generateName();

    stage("Porting military.");
    for (const s of pack.states) {
      if (!s.military) continue;
      for (const m of s.military) {
        [m.x, m.y] = projection(m.x, m.y, false);
        [m.bx, m.by] = projection(m.bx, m.by, false);
        const cc = forwardMap[m.cell];
        m.cell = (cc && cc.length)? cc[0]: null;
      }
      s.military = s.military.filter(m=>m.cell).map((m, i) => ({...m, i}));
    }
    Military.redraw();

    stage("Copying markers.");
    for (const m of pack.markers) {
      const [x, y] = projection(m.x, m.y, false);
      if (!inMap(x, y)) {
        Markers.deleteMarker(m.i);
      } else {
        m.x = x;
        m.y = y;
        m.cell = findCell(x, y);
        if (options.lockMarkers) m.lock = true;
      }
    }
    drawMarkers();

    stage("Regenerating Zones.");
    if (!options.copyZones) addZones();
    Names.getMapName();
    stage("Submap done.");

    WARN && console.warn(`TOTAL: ${rn((performance.now() - timeStart) / 1000, 2)}s`);
    showStatistics();
    INFO && console.groupEnd("Generated Map " + seed);
  }

  /* find the nearest cell accepted by filter f *and* having at
  *  least one *neighbor* fulfilling filter g, up to cell-distance `max`
  *  returns [cellid, neighbor] tuple or undefined if no such cell.
  */
  const findNearest = (f, g, max=3) => centerId => {
    const met = new Set([centerId]); // cache, f might be expensive
    const kernel = (c, dist) => {
      const ncs = pack.cells.c[c].filter(nc => !met.has(nc));
      const n = ncs.find(g);
      if (f(c) && n) return [c, n];
      if (dist >= max || !ncs.length) return undefined;
      ncs.forEach(i => met.add(i));
      const targets = ncs.filter(f)
      let answer;
      while (targets.length && !answer) answer = kernel(targets.shift(), dist+1);
      return answer;
    }
    return kernel(centerId, 1);
  }

  function copyBurgs(parentMap, projection, options) {
    const cells = pack.cells;
    const childMap = { grid, pack }
    const isCoast = c => cells.t[c] === 1
    const isNearCoast = c => cells.t[c] === -1
    pack.burgs = parentMap.pack.burgs;

    // remap burgs to the best new cell
    pack.burgs.forEach( (b, id) => {
      if (id == 0) return; // skip empty city of neturals
      [b.x, b.y] = projection(b.x, b.y, false);

      // disable out-of-map (removed) burgs
      if (!inMap(b.x,b.y)) {
        b.removed = true;
        b.cell = null;
        return;
      }

      let cityCell = findCell(b.x, b.y);

      const searchCoastCell = findNearest(isCoast, isNearCoast, 6);
      // pull sunken burgs out of water
      if (isWater(childMap, cityCell)) {
        const res = searchCoastCell(cityCell)
        if (!res) {
          WARN && console.warn(`Burg ${b.name} sank like Atlantis. Unable to find coastal cells nearby. Try to reduce resample zoom level.`);
          b.removed = true;
          return;
        }
        const [coast, water] = res;
        [b.x, b.y] = b.port? getMiddlePoint(coast, water): cells.p[coast];
        if (b.port) b.port = cells.f[water];
        b.cell = coast;
      } if (b.port) {
        // find coast for ports on land
        const res = searchCoastCell(cityCell);
        if (res) {
          const [coast, water] = res;
          [b.x, b.y] = getMiddlePoint(coast, water);
          b.port = cells.f[water]; // copy feature number
          b.cell = coast;
        } else {
          WARN && console.warn(`Can't find water near port ${b.name}. Increase search radius in searchCoastCell. (Removing port status)`);
          b.cell = cityCell;
          [b.x, b.y] = cells.p[cityCell];
          b.port = 0;
        }
      } else {
        b.cell = cityCell;
        [b.x, b.y] = cells.p[cityCell];
      }
      if (!b.lock) b.lock = options.lockBurgs;
      pack.cells.burg[b.cell] = id;
      if (options.promoteTown) b.capital = 1;
    });
  }

  // export
  return { resample }
})();
