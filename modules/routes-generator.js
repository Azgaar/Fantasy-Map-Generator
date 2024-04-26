window.Routes = (function () {
  const ROUTES = {
    MAIN_ROAD: 1,
    TRAIL: 2,
    SEA_ROUTE: 3
  };

  function generate() {
    const {cells, burgs} = pack;
    const cellRoutes = new Uint8Array(cells.h.length);

    const {capitalsByFeature, burgsByFeature, portsByFeature} = sortBurgsByFeature(burgs);
    const connections = new Map();

    const mainRoads = generateMainRoads();
    const trails = generateTrails();
    const seaRoutes = generateSeaRoutes();

    cells.route = cellRoutes;
    pack.routes = combineRoutes();

    function sortBurgsByFeature(burgs) {
      const burgsByFeature = {};
      const capitalsByFeature = {};
      const portsByFeature = {};

      const addBurg = (object, feature, burg) => {
        if (!object[feature]) object[feature] = [];
        object[feature].push(burg);
      };

      for (const burg of burgs) {
        if (burg.i && !burg.removed) {
          const {feature, capital, port} = burg;
          addBurg(burgsByFeature, feature, burg);
          if (capital) addBurg(capitalsByFeature, feature, burg);
          if (port) addBurg(portsByFeature, port, burg);
        }
      }

      return {burgsByFeature, capitalsByFeature, portsByFeature};
    }

    function generateMainRoads() {
      TIME && console.time("generateMainRoads");
      const mainRoads = [];

      for (const [key, featureCapitals] of Object.entries(capitalsByFeature)) {
        const points = featureCapitals.map(burg => [burg.x, burg.y]);
        const urquhartEdges = calculateUrquhartEdges(points);
        urquhartEdges.forEach(([fromId, toId]) => {
          const start = featureCapitals[fromId].cell;
          const exit = featureCapitals[toId].cell;

          const segments = findPathSegments({isWater: false, connections, start, exit});
          for (const segment of segments) {
            addConnections(segment, ROUTES.MAIN_ROAD);
            mainRoads.push({feature: Number(key), cells: segment});
          }
        });
      }

      TIME && console.timeEnd("generateMainRoads");
      return mainRoads;
    }

    function generateTrails() {
      TIME && console.time("generateTrails");
      const trails = [];

      for (const [key, featureBurgs] of Object.entries(burgsByFeature)) {
        const points = featureBurgs.map(burg => [burg.x, burg.y]);
        const urquhartEdges = calculateUrquhartEdges(points);
        urquhartEdges.forEach(([fromId, toId]) => {
          const start = featureBurgs[fromId].cell;
          const exit = featureBurgs[toId].cell;

          const segments = findPathSegments({isWater: false, connections, start, exit});
          for (const segment of segments) {
            addConnections(segment, ROUTES.TRAIL);
            trails.push({feature: Number(key), cells: segment});
          }
        });
      }

      TIME && console.timeEnd("generateTrails");
      return trails;
    }

    function generateSeaRoutes() {
      TIME && console.time("generateSeaRoutes");
      const seaRoutes = [];

      for (const [featureId, featurePorts] of Object.entries(portsByFeature)) {
        const points = featurePorts.map(burg => [burg.x, burg.y]);
        const urquhartEdges = calculateUrquhartEdges(points);
        console.log(urquhartEdges);
        urquhartEdges.forEach(([fromId, toId]) => {
          const start = featurePorts[fromId].cell;
          const exit = featurePorts[toId].cell;

          const segments = findPathSegments({isWater: true, connections, start, exit});
          for (const segment of segments) {
            addConnections(segment, ROUTES.SEA_ROUTE);
            seaRoutes.push({feature: Number(featureId), cells: segment});
          }
        });
      }

      TIME && console.timeEnd("generateSeaRoutes");
      return seaRoutes;
    }

    function addConnections(segment, routeTypeId) {
      for (let i = 0; i < segment.length; i++) {
        const cellId = segment[i];
        const nextCellId = segment[i + 1];
        if (nextCellId) {
          connections.set(`${cellId}-${nextCellId}`, true);
          connections.set(`${nextCellId}-${cellId}`, true);
        }
        if (!cellRoutes[cellId]) cellRoutes[cellId] = routeTypeId;
      }
    }

    function findPathSegments({isWater, connections, start, exit}) {
      const from = findPath(isWater, start, exit, connections);
      if (!from) return [];

      const pathCells = restorePath(start, exit, from);
      const segments = getRouteSegments(pathCells, connections);
      return segments;
    }

    function combineRoutes() {
      const routes = [];

      for (const {feature, cells} of mainRoads) {
        routes.push({i: routes.length, group: "roads", feature, cells});
      }

      for (const {feature, cells} of trails) {
        routes.push({i: routes.length, group: "trails", feature, cells});
      }

      for (const {feature, cells} of seaRoutes) {
        routes.push({i: routes.length, group: "searoutes", feature, cells});
      }

      return routes;
    }
  }

  const MIN_PASSABLE_SEA_TEMP = -4;

  const TYPE_MODIFIERS = {
    "-1": 1, // coastline
    "-2": 1.8, // sea
    "-3": 3, // open sea
    "-4": 5, // ocean
    default: 8 // far ocean
  };

  function findPath(isWater, start, exit, connections) {
    const {temp} = grid.cells;
    const {cells} = pack;

    const from = [];
    const cost = [];
    const queue = new FlatQueue();
    queue.push(start, 0);

    return isWater ? findWaterPath() : findLandPath();

    function findLandPath() {
      while (queue.length) {
        const priority = queue.peekValue();
        const next = queue.pop();

        for (const neibCellId of cells.c[next]) {
          if (cells.h[neibCellId] < 20) continue; // ignore water cells

          const habitability = biomesData.habitability[cells.biome[neibCellId]];
          if (!habitability) continue; // inhabitable cells are not passable (eg. lava, glacier)

          const distanceCost = dist2(cells.p[next], cells.p[neibCellId]);

          const habitabilityModifier = 1 + Math.max(100 - habitability, 0) / 1000; // [1, 1.1];
          const heightModifier = 1 + Math.max(cells.h[neibCellId] - 25, 25) / 25; // [1, 3];
          const connectionModifier = connections.has(`${next}-${neibCellId}`) ? 1 : 3;
          const burgModifier = cells.burg[neibCellId] ? 1 : 2;

          const cellsCost = distanceCost * habitabilityModifier * heightModifier * connectionModifier * burgModifier;
          const totalCost = priority + cellsCost;

          if (from[neibCellId] || totalCost >= cost[neibCellId]) continue;
          from[neibCellId] = next;

          if (neibCellId === exit) return from;

          cost[neibCellId] = totalCost;
          queue.push(neibCellId, totalCost);
        }
      }

      return null; // path is not found
    }

    function findWaterPath() {
      while (queue.length) {
        const priority = queue.peekValue();
        const next = queue.pop();

        for (const neibCellId of cells.c[next]) {
          if (neibCellId === exit) {
            from[neibCellId] = next;
            return from;
          }

          if (cells.h[neibCellId] >= 20) continue; // ignore land cells
          if (temp[cells.g[neibCellId]] < MIN_PASSABLE_SEA_TEMP) continue; // ignore too cold cells

          const distanceCost = dist2(cells.p[next], cells.p[neibCellId]);
          const typeModifier = TYPE_MODIFIERS[cells.t[neibCellId]] || TYPE_MODIFIERS.default;
          const connectionModifier = connections.has(`${next}-${neibCellId}`) ? 1 : 2;

          const cellsCost = distanceCost * typeModifier * connectionModifier;
          const totalCost = priority + cellsCost;

          if (from[neibCellId] || totalCost >= cost[neibCellId]) continue;
          from[neibCellId] = next;

          cost[neibCellId] = totalCost;
          queue.push(neibCellId, totalCost);
        }
      }

      return null; // path is not found
    }
  }

  function restorePath(start, end, from) {
    const cells = [];

    let current = end;
    let prev = end;

    while (current !== start) {
      cells.push(current);
      prev = from[current];
      current = prev;
    }

    cells.push(current);

    return cells;
  }

  function getRouteSegments(pathCells, connections) {
    const segments = [];
    let segment = [];

    for (let i = 0; i < pathCells.length; i++) {
      const cellId = pathCells[i];
      const nextCellId = pathCells[i + 1];
      const isConnected = connections.has(`${cellId}-${nextCellId}`) || connections.has(`${nextCellId}-${cellId}`);

      if (isConnected) {
        if (segment.length) {
          // segment stepped into existing segment
          segment.push(pathCells[i]);
          segments.push(segment);
          segment = [];
        }
        continue;
      }

      segment.push(pathCells[i]);
    }

    if (segment.length > 1) segments.push(segment);

    return segments;
  }

  // Urquhart graph is obtained by removing the longest edge from each triangle in the Delaunay triangulation
  // this gives us an aproximation of a desired road network, i.e. connections between burgs
  // code from https://observablehq.com/@mbostock/urquhart-graph
  function calculateUrquhartEdges(points) {
    const score = (p0, p1) => dist2(points[p0], points[p1]);

    const {halfedges, triangles} = Delaunator.from(points);
    const n = triangles.length;

    const removed = new Uint8Array(n);
    const edges = [];

    for (let e = 0; e < n; e += 3) {
      const p0 = triangles[e],
        p1 = triangles[e + 1],
        p2 = triangles[e + 2];

      const p01 = score(p0, p1),
        p12 = score(p1, p2),
        p20 = score(p2, p0);

      removed[
        p20 > p01 && p20 > p12
          ? Math.max(e + 2, halfedges[e + 2])
          : p12 > p01 && p12 > p20
          ? Math.max(e + 1, halfedges[e + 1])
          : Math.max(e, halfedges[e])
      ] = 1;
    }

    for (let e = 0; e < n; ++e) {
      if (e > halfedges[e] && !removed[e]) {
        const t0 = triangles[e];
        const t1 = triangles[e % 3 === 2 ? e - 2 : e + 1];
        edges.push([t0, t1]);
      }
    }

    return edges;
  }

  return {generate};
})();
