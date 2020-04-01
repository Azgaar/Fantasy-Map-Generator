(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.Routes = factory());
}(this, (function () {'use strict';

  const getRoads = function() {
    console.time("generateMainRoads");
    const cells = pack.cells, burgs = pack.burgs.filter(b => b.i && !b.removed);
    const capitals = burgs.filter(b => b.capital);
    if (capitals.length < 2) return []; // not enought capitals to build main roads
    const paths = []; // array to store path segments

    for (const b of capitals) {
      const connect = capitals.filter(c => c.i > b.i && c.feature === b.feature);
      if (!connect.length) continue;
      const farthest = d3.scan(connect, (a, c) => ((c.y - b.y) ** 2 + (c.x - b.x) ** 2) - ((a.y - b.y) ** 2 + (a.x - b.x) ** 2));
      const [from, exit] = findLandPath(b.cell, connect[farthest].cell, null);
      const segments = restorePath(b.cell, exit, "main", from);
      segments.forEach(s => paths.push(s));
    }

    cells.i.forEach(i => cells.s[i] += cells.road[i] / 2); // add roads to suitability score
    console.timeEnd("generateMainRoads");
    return paths;
  }

  const getTrails = function() {
    console.time("generateTrails");
    const cells = pack.cells, burgs = pack.burgs.filter(b => b.i && !b.removed);
    if (burgs.length < 2) return []; // not enought burgs to build trails

    let paths = []; // array to store path segments
    for (const f of pack.features.filter(f => f.land)) {
      const isle = burgs.filter(b => b.feature === f.i); // burgs on island
      if (isle.length < 2) continue;

      isle.forEach(function(b, i) {
        let path = [];
        if (!i) {
          // build trail from the first burg on island to the farthest one on the same island
          const farthest = d3.scan(isle, (a, c) => ((c.y - b.y) ** 2 + (c.x - b.x) ** 2) - ((a.y - b.y) ** 2 + (a.x - b.x) ** 2));
          const to = isle[farthest].cell;
          if (cells.road[to]) return;
          const [from, exit] = findLandPath(b.cell, to, null);
          path = restorePath(b.cell, exit, "small", from);
        } else {
          // build trail from all other burgs to the closest road on the same island
          if (cells.road[b.cell]) return;
          const [from, exit] = findLandPath(b.cell, null, true);
          if (exit === null) return;
          path = restorePath(b.cell, exit, "small", from);
        }
        if (path) paths = paths.concat(path);
      });
    }

    console.timeEnd("generateTrails");
    return paths;
  }

  const getSearoutes = function() {
    console.time("generateSearoutes");
    const cells = pack.cells, allPorts = pack.burgs.filter(b => b.port > 0 && !b.removed);
    if (allPorts.length < 2) return [];
    const bodies = new Set(allPorts.map(b => b.port)); // features with ports
    let paths = []; // array to store path segments

    bodies.forEach(function(f) {
      const ports = allPorts.filter(b => b.port === f);
      if (ports.length < 2) return;
      const first = ports[0].cell;
      const farthest = ports[d3.scan(ports, (a, b) => ((b.y - ports[0].y) ** 2 + (b.x - ports[0].x) ** 2) - ((a.y - ports[0].y) ** 2 + (a.x - ports[0].x) ** 2))].cell;

      // directly connect first port with the farthest one on the same island to remove gap
      void function() {
        if (!pack.features[f] || pack.features[f].type === "lake") return;
        const portsOnIsland = ports.filter(b => cells.f[b.cell] === cells.f[first]);
        if (portsOnIsland.length < 4) return;
        const opposite = ports[d3.scan(portsOnIsland, (a, b) => ((b.y - ports[0].y) ** 2 + (b.x - ports[0].x) ** 2) - ((a.y - ports[0].y) ** 2 + (a.x - ports[0].x) ** 2))].cell;
        //debug.append("circle").attr("cx", pack.cells.p[opposite][0]).attr("cy", pack.cells.p[opposite][1]).attr("r", 1);
        //debug.append("circle").attr("cx", pack.cells.p[first][0]).attr("cy", pack.cells.p[first][1]).attr("fill", "red").attr("r", 1);
        const [from, exit, passable] = findOceanPath(opposite, first);
        if (!passable) return;
        from[first] = cells.haven[first];
        const path = restorePath(opposite, first, "ocean", from);
        paths = paths.concat(path);
      }()

      // directly connect first port with the farthest one
      void function() {
        const [from, exit, passable] = findOceanPath(farthest, first);
        if (!passable) return;
        from[first] = cells.haven[first];
        const path = restorePath(farthest, first, "ocean", from);
        paths = paths.concat(path);
      }()

      // indirectly connect first port with all other ports
      void function() {
        if (ports.length < 3) return;
        for (const p of ports) {
          if (p.cell === first || p.cell === farthest) continue;
          const [from, exit, passable] = findOceanPath(p.cell, first, true);
          if (!passable) continue;
          const path = restorePath(p.cell, exit, "ocean", from);
          paths = paths.concat(path);
        }
      }()

    });

    console.timeEnd("generateSearoutes");
    return paths;
  }

  const draw = function(main, small, ocean) {
    console.time("drawRoutes");
    const cells = pack.cells, burgs = pack.burgs;
    lineGen.curve(d3.curveCatmullRom.alpha(0.1));

    // main routes
    roads.selectAll("path").data(main).enter().append("path")
      .attr("id", (d, i) => "road" + i)
      .attr("d", d => round(lineGen(d.map(c => {
        const b = cells.burg[c];
        const x = b ? burgs[b].x : cells.p[c][0];
        const y = b ? burgs[b].y : cells.p[c][1];
        return [x, y];
      })), 1));

    // small routes
    trails.selectAll("path").data(small).enter().append("path")
      .attr("id", (d, i) => "trail" + i)
      .attr("d", d => round(lineGen(d.map(c => {
        const b = cells.burg[c];
        const x = b ? burgs[b].x : cells.p[c][0];
        const y = b ? burgs[b].y : cells.p[c][1];
        return [x, y];
      })), 1));

    // ocean routes
    lineGen.curve(d3.curveBundle.beta(1));
    searoutes.selectAll("path").data(ocean).enter().append("path")
      .attr("id", (d, i) => "searoute" + i)
      .attr("d", d => round(lineGen(d.map(c => {
        const b = cells.burg[c];
        const x = b ? burgs[b].x : cells.p[c][0];
        const y = b ? burgs[b].y : cells.p[c][1];
        return [x, y];
      })), 1));

    console.timeEnd("drawRoutes");
  }

  const regenerate = function() {
    routes.selectAll("path").remove();
    pack.cells.road = new Uint16Array(pack.cells.i.length);
    pack.cells.crossroad = new Uint16Array(pack.cells.i.length);
    const main = getRoads();
    const small = getTrails();
    const ocean = getSearoutes();
    draw(main, small, ocean);
  }

  return {getRoads, getTrails, getSearoutes, draw, regenerate};

  // Find a land path to a specific cell (exit), to a closest road (toRoad), or to all reachable cells (null, null)
  function findLandPath(start, exit = null, toRoad = null) {
    const cells = pack.cells;
    const queue = new PriorityQueue({comparator: (a, b) => a.p - b.p});
    const cost = [], from = [];
    queue.queue({e: start, p: 0});

    while (queue.length) {
      const next = queue.dequeue(), n = next.e, p = next.p;
      if (toRoad && cells.road[n]) return [from, n];

      for (const c of cells.c[n]) {
        if (cells.h[c] < 20) continue; // ignore water cells
        const stateChangeCost = cells.state && cells.state[c] !== cells.state[n] ? 400 : 0; // trails tend to lay within the same state
        const habitability = biomesData.habitability[cells.biome[c]];
        const habitedCost = habitability ? Math.max(100 - habitability, 0) : 400; // routes tend to lay within populated areas
        const heightChangeCost = Math.abs(cells.h[c] - cells.h[n]) * 10; // routes tend to avoid elevation changes
        const heightCost = cells.h[c] > 80 ? cells.h[c] : 0; // routes tend to avoid mountainous areas
        const cellCoast = 10 + stateChangeCost + habitedCost + heightChangeCost + heightCost;
        const totalCost = p + (cells.road[c] || cells.burg[c] ? cellCoast / 3 : cellCoast);

        if (from[c] || totalCost >= cost[c]) continue;
        from[c] = n;
        if (c === exit) return [from, exit];
        cost[c] = totalCost;
        queue.queue({e: c, p: totalCost});
      }

    }
    return [from, exit];
  }

  function restorePath(start, end, type, from) {
    const cells = pack.cells;
    const path = []; // to store all segments;
    let segment = [], current = end, prev = end;
    const score = type === "main" ? 5 : 1; // to incrade road score at cell

    if (type === "ocean" || !cells.road[prev]) segment.push(end);
    if (!cells.road[prev]) cells.road[prev] = score;

    for (let i = 0, limit = 1000; i < limit; i++) {
      if (!from[current]) break;
      current = from[current];

      if (cells.road[current]) {
        if (segment.length) {
          segment.push(current);
          path.push(segment);
          if (segment[0] !== end) {cells.road[segment[0]] += score; cells.crossroad[segment[0]] += score;}
          if (current !== start) {cells.road[current] += score; cells.crossroad[current] += score;}
        }
        segment = [];
        prev = current;
      } else {
        if (prev) segment.push(prev);
        prev = null;
        segment.push(current);
      }

      cells.road[current] += score;
      if (current === start) break;
    }

    if (segment.length > 1) path.push(segment);
    return path;
  }

  // find water paths
  function findOceanPath(start, exit = null, toRoute = null) {
    const cells = pack.cells;
    const queue = new PriorityQueue({comparator: (a, b) => a.p - b.p});
    const cost = [], from = [];
    queue.queue({e: start, p: 0});

    while (queue.length) {
      const next = queue.dequeue(), n = next.e, p = next.p;
      if (toRoute && n !== start && cells.road[n]) return [from, n, true];

      for (const c of cells.c[n]) {
        if (c === exit) {from[c] = n; return [from, exit, true];}
        if (cells.h[c] >= 20) continue; // ignore land cells
        const dist2 = (cells.p[c][1] - cells.p[n][1]) ** 2 + (cells.p[c][0] - cells.p[n][0]) ** 2;
        const totalCost = p + (cells.road[c] ? 1 + dist2 / 2 : dist2 + (cells.t[c] ? 1 : 100));

        if (from[c] || totalCost >= cost[c]) continue;
        from[c] = n, cost[c] = totalCost;
        queue.queue({e: c, p: totalCost});
      }

    }
    return [from, exit, false];
  }

})));