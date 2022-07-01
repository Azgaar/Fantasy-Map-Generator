import FlatQueue from "flatqueue";

import {TIME} from "config/logging";
import {findCell} from "utils/graphUtils";
import {last} from "utils/arrayUtils";
import {round} from "utils/stringUtils";

window.Routes = (function () {
  const getRoads = function () {
    TIME && console.time("generateMainRoads");
    const cells = pack.cells;
    const burgs = pack.burgs.filter(b => b.i && !b.removed);
    const capitals = burgs.filter(b => b.capital).sort((a, b) => a.population - b.population);

    if (capitals.length < 2) return []; // not enough capitals to build main roads
    const paths = []; // array to store path segments

    for (const b of capitals) {
      const connect = capitals.filter(c => c.feature === b.feature && c !== b);
      for (const t of connect) {
        const [from, exit] = findLandPath(b.cell, t.cell, true);
        const segments = restorePath(b.cell, exit, "main", from);
        segments.forEach(s => paths.push(s));
      }
    }

    cells.i.forEach(i => (cells.s[i] += cells.road[i] / 2)); // add roads to suitability score
    TIME && console.timeEnd("generateMainRoads");
    return paths;
  };

  const getTrails = function () {
    TIME && console.time("generateTrails");
    const cells = pack.cells;
    const burgs = pack.burgs.filter(b => b.i && !b.removed);

    if (burgs.length < 2) return []; // not enough burgs to build trails

    let paths = []; // array to store path segments
    for (const f of pack.features.filter(f => f.land)) {
      const isle = burgs.filter(b => b.feature === f.i); // burgs on island
      if (isle.length < 2) continue;

      isle.forEach(function (b, i) {
        let path = [];
        if (!i) {
          // build trail from the first burg on island
          // to the farthest one on the same island or the closest road
          const farthest = d3.scan(
            isle,
            (a, c) => (c.y - b.y) ** 2 + (c.x - b.x) ** 2 - ((a.y - b.y) ** 2 + (a.x - b.x) ** 2)
          );
          const to = isle[farthest].cell;
          if (cells.road[to]) return;
          const [from, exit] = findLandPath(b.cell, to, true);
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

    TIME && console.timeEnd("generateTrails");
    return paths;
  };

  const getSearoutes = function () {
    TIME && console.time("generateSearoutes");
    const {cells, burgs, features} = pack;
    const allPorts = burgs.filter(b => b.port > 0 && !b.removed);

    if (!allPorts.length) return [];

    const bodies = new Set(allPorts.map(b => b.port)); // water features with ports
    let paths = []; // array to store path segments
    const connected = []; // store cell id of connected burgs

    bodies.forEach(f => {
      const ports = allPorts.filter(b => b.port === f); // all ports on the same feature
      if (!ports.length) return;

      if (features[f]?.border) addOverseaRoute(f, ports[0]);

      // get inner-map routes
      for (let s = 0; s < ports.length; s++) {
        const source = ports[s].cell;
        if (connected[source]) continue;

        for (let t = s + 1; t < ports.length; t++) {
          const target = ports[t].cell;
          if (connected[target]) continue;

          const [from, exit, passable] = findOceanPath(target, source, true);
          if (!passable) continue;

          const path = restorePath(target, exit, "ocean", from);
          paths = paths.concat(path);

          connected[source] = 1;
          connected[target] = 1;
        }
      }
    });

    function addOverseaRoute(f, port) {
      const {x, y, cell: source} = port;
      const dist = p => Math.abs(p[0] - x) + Math.abs(p[1] - y);
      const [x1, y1] = [
        [0, y],
        [x, 0],
        [graphWidth, y],
        [x, graphHeight]
      ].sort((a, b) => dist(a) - dist(b))[0];
      const target = findCell(x1, y1);

      if (cells.f[target] === f && cells.h[target] < 20) {
        const [from, exit, passable] = findOceanPath(target, source, true);

        if (passable) {
          const path = restorePath(target, exit, "ocean", from);
          paths = paths.concat(path);
          last(path).push([x1, y1]);
        }
      }
    }

    TIME && console.timeEnd("generateSearoutes");
    return paths;
  };

  const lineGen = d3.line().curve(d3.curveBasis);

  const draw = function (main, small, water) {
    TIME && console.time("drawRoutes");
    const {cells, burgs} = pack;
    const {burg, p} = cells;

    const getBurgCoords = b => [burgs[b].x, burgs[b].y];
    const getPathPoints = cells => cells.map(i => (Array.isArray(i) ? i : burg[i] ? getBurgCoords(burg[i]) : p[i]));
    const getPath = segment => round(lineGen(getPathPoints(segment)), 1);
    const getPathsHTML = (paths, type) =>
      paths.map((path, i) => `<path id="${type}${i}" d="${getPath(path)}" />`).join("");

    lineGen.curve(d3.curveCatmullRom.alpha(0.1));
    roads.html(getPathsHTML(main, "road"));
    trails.html(getPathsHTML(small, "trail"));

    lineGen.curve(d3.curveBundle.beta(1));
    searoutes.html(getPathsHTML(water, "searoute"));

    TIME && console.timeEnd("drawRoutes");
  };

  const regenerate = function () {
    routes.selectAll("path").remove();
    pack.cells.road = new Uint16Array(pack.cells.i.length);
    pack.cells.crossroad = new Uint16Array(pack.cells.i.length);
    const main = getRoads();
    const small = getTrails();
    const water = getSearoutes();
    draw(main, small, water);
  };

  return {getRoads, getTrails, getSearoutes, draw, regenerate};

  // Find a land path to a specific cell (exit), to a closest road (toRoad), or to all reachable cells (null, null)
  function findLandPath(start, exit = null, toRoad = null) {
    const cells = pack.cells;
    const queue = new FlatQueue();
    const cost = [];
    const from = [];
    queue.push(start, 0);

    while (queue.length) {
      const priority = queue.peekValue();
      const next = queue.pop();

      if (toRoad && cells.road[next]) return [from, next];

      for (const neibCellId of cells.c[next]) {
        if (cells.h[neibCellId] < 20) continue; // ignore water cells
        const stateChangeCost = cells.state && cells.state[neibCellId] !== cells.state[next] ? 400 : 0; // trails tend to lay within the same state
        const habitability = biomesData.habitability[cells.biome[neibCellId]];
        if (!habitability) continue; // avoid inhabitable cells (eg. lava, glacier)
        const habitedCost = habitability ? Math.max(100 - habitability, 0) : 400; // routes tend to lay within populated areas
        const heightChangeCost = Math.abs(cells.h[neibCellId] - cells.h[next]) * 10; // routes tend to avoid elevation changes
        const heightCost = cells.h[neibCellId] > 80 ? cells.h[neibCellId] : 0; // routes tend to avoid mountainous areas
        const cellCoast = 10 + stateChangeCost + habitedCost + heightChangeCost + heightCost;
        const totalCost = priority + (cells.road[neibCellId] || cells.burg[neibCellId] ? cellCoast / 3 : cellCoast);

        if (from[neibCellId] || totalCost >= cost[neibCellId]) continue;
        from[neibCellId] = next;
        if (neibCellId === exit) return [from, exit];
        cost[neibCellId] = totalCost;
        queue.push(neibCellId, totalCost);
      }
    }
    return [from, exit];
  }

  function restorePath(start, end, type, from) {
    const cells = pack.cells;
    const path = []; // to store all segments;
    let segment = [],
      current = end,
      prev = end;
    const score = type === "main" ? 5 : 1; // to increase road score at cell

    if (type === "ocean" || !cells.road[prev]) segment.push(end);
    if (!cells.road[prev]) cells.road[prev] = score;

    for (let i = 0, limit = 1000; i < limit; i++) {
      if (!from[current]) break;
      current = from[current];

      if (cells.road[current]) {
        if (segment.length) {
          segment.push(current);
          path.push(segment);
          if (segment[0] !== end) {
            cells.road[segment[0]] += score;
            cells.crossroad[segment[0]] += score;
          }
          if (current !== start) {
            cells.road[current] += score;
            cells.crossroad[current] += score;
          }
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
    const temp = grid.cells.temp;

    const queue = new FlatQueue();
    const cost = [];
    const from = [];
    queue.push(start, 0);

    while (queue.length) {
      const priority = queue.peekValue();
      const next = queue.pop();

      if (toRoute && next !== start && cells.road[next]) return [from, next, true];

      for (const neibCellId of cells.c[next]) {
        if (neibCellId === exit) {
          from[neibCellId] = next;
          return [from, exit, true];
        }

        if (cells.h[neibCellId] >= 20) continue; // ignore land cells
        if (temp[cells.g[neibCellId]] <= -5) continue; // ignore cells with term <= -5

        const dist2 =
          (cells.p[neibCellId][1] - cells.p[next][1]) ** 2 + (cells.p[neibCellId][0] - cells.p[next][0]) ** 2;
        const totalCost = priority + (cells.road[neibCellId] ? 1 + dist2 / 2 : dist2 + (cells.t[neibCellId] ? 1 : 100));

        if (from[neibCellId] || totalCost >= cost[neibCellId]) continue;
        (from[neibCellId] = next), (cost[neibCellId] = totalCost);
        queue.push(neibCellId, totalCost);
      }
    }
    return [from, exit, false];
  }
})();
