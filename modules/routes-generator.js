const ROUTES_SHARP_ANGLE = 135;
const ROUTES_VERY_SHARP_ANGLE = 115;

const MIN_PASSABLE_SEA_TEMP = -4;
const ROUTE_TYPE_MODIFIERS = {
  "-1": 1, // coastline
  "-2": 1.8, // sea
  "-3": 4, // open sea
  "-4": 6, // ocean
  default: 8 // far ocean
};

window.Routes = (function () {
  function generate(lockedRoutes = []) {
    const {capitalsByFeature, burgsByFeature, portsByFeature, primaryByFeature, plazaByFeature, unconnectedBurgsByFeature} = sortBurgsByFeature(pack.burgs);

    const connections = new Map();
    lockedRoutes.forEach(route => addConnections(route.points.map(p => p[2])));

    const mainRoads = generateMainRoads();
    const secondaryRoads = generateSecondaryRoads();
    const trails = generateTrails();
    const seaRoutes = generateSeaRoutes();

    pack.routes = createRoutesData(lockedRoutes);
    pack.cells.routes = buildLinks(pack.routes);

    function sortBurgsByFeature(burgs) {
      const burgsByFeature = {};
      const capitalsByFeature = {};
      const portsByFeature = {};
      const primaryByFeature = {}; // capitals + large ports
      const plazaByFeature = {}; // plaza burgs (excluding primary centers)
      const unconnectedBurgsByFeature = {}; // burgs not connected by main roads or secondary roads

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
          
          // Primary centers: capitals and large ports
          if (capital || burg.isLargePort) {
            addBurg(primaryByFeature, feature, burg);
          }
          
          // Plaza burgs: those with plazas but not primary centers
          if ((burg.plaza || burg.isRegionalCenter || burg.guaranteedPlaza) && !capital && !burg.isLargePort) {
            addBurg(plazaByFeature, feature, burg);
          }
          
          // Unconnected burgs: those not already connected by main roads or secondary roads
          if (!capital && !burg.isLargePort && !(burg.plaza || burg.isRegionalCenter || burg.guaranteedPlaza)) {
            addBurg(unconnectedBurgsByFeature, feature, burg);
          }
        }
      }

      return {burgsByFeature, capitalsByFeature, portsByFeature, primaryByFeature, plazaByFeature, unconnectedBurgsByFeature};
    }

    function generateMainRoads() {
      TIME && console.time("generateMainRoads");
      const mainRoads = [];

      for (const [key, featurePrimary] of Object.entries(primaryByFeature)) {
        const points = featurePrimary.map(burg => [burg.x, burg.y]);
        const urquhartEdges = calculateUrquhartEdges(points);
        urquhartEdges.forEach(([fromId, toId]) => {
          const start = featurePrimary[fromId].cell;
          const exit = featurePrimary[toId].cell;

          const segments = findPathSegments({isWater: false, connections, start, exit});
          for (const segment of segments) {
            addConnections(segment);
            mainRoads.push({feature: Number(key), cells: segment});
          }
        });
      }

      TIME && console.timeEnd("generateMainRoads");
      return mainRoads;
    }

    function generateSecondaryRoads() {
      TIME && console.time("generateSecondaryRoads");
      const secondaryRoads = [];

      for (const [key, featurePlazas] of Object.entries(plazaByFeature)) {
        // Skip if no plaza burgs in this feature
        if (featurePlazas.length === 0) continue;
        
        const featurePrimary = primaryByFeature[key] || [];
        
        // Combine plaza burgs with primary centers for connection network
        const allConnectableBurgs = [...featurePlazas, ...featurePrimary];
        
        // If we have primary centers in this feature, connect plazas to them
        if (featurePrimary.length > 0 && featurePlazas.length > 0) {
          // Connect each plaza to the nearest primary center
          for (const plazaBurg of featurePlazas) {
            let nearestPrimary = null;
            let minDistance = Infinity;
            
            for (const primaryBurg of featurePrimary) {
              const distance = Math.sqrt(
                (plazaBurg.x - primaryBurg.x) ** 2 + (plazaBurg.y - primaryBurg.y) ** 2
              );
              if (distance < minDistance) {
                minDistance = distance;
                nearestPrimary = primaryBurg;
              }
            }
            
            if (nearestPrimary) {
              const segments = findPathSegments({
                isWater: false, 
                connections, 
                start: plazaBurg.cell, 
                exit: nearestPrimary.cell
              });
              for (const segment of segments) {
                addConnections(segment);
                secondaryRoads.push({feature: Number(key), cells: segment});
              }
            }
          }
        }
        
        // Connect plaza burgs to each other if there are multiple
        if (featurePlazas.length >= 2) {
          const points = featurePlazas.map(burg => [burg.x, burg.y]);
          const urquhartEdges = calculateUrquhartEdges(points);
          urquhartEdges.forEach(([fromId, toId]) => {
            const start = featurePlazas[fromId].cell;
            const exit = featurePlazas[toId].cell;

            const segments = findPathSegments({isWater: false, connections, start, exit});
            for (const segment of segments) {
              addConnections(segment);
              secondaryRoads.push({feature: Number(key), cells: segment});
            }
          });
        }
      }

      TIME && console.timeEnd("generateSecondaryRoads");
      return secondaryRoads;
    }

    function generateTrails() {
      TIME && console.time("generateTrails");
      const trails = [];

      for (const [key, unconnectedBurgs] of Object.entries(unconnectedBurgsByFeature)) {
        // Skip if no unconnected burgs in this feature
        if (unconnectedBurgs.length === 0) continue;
        
        // Get all connected burgs in this feature (primary + plaza)
        const connectedBurgs = [...(primaryByFeature[key] || []), ...(plazaByFeature[key] || [])];
        
        // Connect unconnected burgs to the network
        for (const unconnectedBurg of unconnectedBurgs) {
          if (connectedBurgs.length > 0) {
            // Find the best connection point (could be a burg or a point on an existing route)
            const bestConnection = findBestConnectionPoint(unconnectedBurg, connectedBurgs, connections);
            
            if (bestConnection) {
              const segments = findPathSegments({
                isWater: false, 
                connections, 
                start: unconnectedBurg.cell, 
                exit: bestConnection.cell
              });
              for (const segment of segments) {
                addConnections(segment);
                trails.push({feature: Number(key), cells: segment});
              }
            }
          } else if (unconnectedBurgs.length >= 2) {
            // If no connected burgs exist, create minimal trail network between unconnected burgs
            const points = unconnectedBurgs.map(burg => [burg.x, burg.y]);
            const urquhartEdges = calculateUrquhartEdges(points);
            urquhartEdges.forEach(([fromId, toId]) => {
              const start = unconnectedBurgs[fromId].cell;
              const exit = unconnectedBurgs[toId].cell;

              const segments = findPathSegments({isWater: false, connections, start, exit});
              for (const segment of segments) {
                addConnections(segment);
                trails.push({feature: Number(key), cells: segment});
              }
            });
            break; // Only do this once per feature
          }
        }
      }

      TIME && console.timeEnd("generateTrails");
      return trails;
    }

    // Helper function to find the best connection point for a trail
    function findBestConnectionPoint(unconnectedBurg, connectedBurgs, connections) {
      let bestConnection = null;
      let minDistance = Infinity;
      
      // First, try connecting to the nearest connected burg
      for (const connectedBurg of connectedBurgs) {
        const distance = Math.sqrt(
          (unconnectedBurg.x - connectedBurg.x) ** 2 + (unconnectedBurg.y - connectedBurg.y) ** 2
        );
        if (distance < minDistance) {
          minDistance = distance;
          bestConnection = connectedBurg;
        }
      }
      
      return bestConnection;
    }

    function generateSeaRoutes() {
      TIME && console.time("generateSeaRoutes");
      const seaRoutes = [];

      for (const [featureId, featurePorts] of Object.entries(portsByFeature)) {
        const points = featurePorts.map(burg => [burg.x, burg.y]);
        const urquhartEdges = calculateUrquhartEdges(points);

        urquhartEdges.forEach(([fromId, toId]) => {
          const start = featurePorts[fromId].cell;
          const exit = featurePorts[toId].cell;
          const segments = findPathSegments({isWater: true, connections, start, exit});
          for (const segment of segments) {
            addConnections(segment);
            seaRoutes.push({feature: Number(featureId), cells: segment});
          }
        });
      }

      TIME && console.timeEnd("generateSeaRoutes");
      return seaRoutes;
    }

    function addConnections(segment) {
      for (let i = 0; i < segment.length; i++) {
        const cellId = segment[i];
        const nextCellId = segment[i + 1];
        if (nextCellId) {
          connections.set(`${cellId}-${nextCellId}`, true);
          connections.set(`${nextCellId}-${cellId}`, true);
        }
      }
    }

    function findPathSegments({isWater, connections, start, exit}) {
      const getCost = createCostEvaluator({isWater, connections});
      const pathCells = findPath(start, current => current === exit, getCost);
      if (!pathCells) return [];
      const segments = getRouteSegments(pathCells, connections);
      return segments;
    }

    function createRoutesData(routes) {
      const pointsArray = preparePointsArray();

      for (const {feature, cells, merged} of mergeRoutes(mainRoads)) {
        if (merged) continue;
        const points = getPoints("roads", cells, pointsArray);
        routes.push({i: routes.length, group: "roads", feature, points});
      }

      for (const {feature, cells, merged} of mergeRoutes(secondaryRoads)) {
        if (merged) continue;
        const points = getPoints("secondary", cells, pointsArray);
        routes.push({i: routes.length, group: "secondary", feature, points});
      }

      for (const {feature, cells, merged} of mergeRoutes(trails)) {
        if (merged) continue;
        const points = getPoints("trails", cells, pointsArray);
        routes.push({i: routes.length, group: "trails", feature, points});
      }

      for (const {feature, cells, merged} of mergeRoutes(seaRoutes)) {
        if (merged) continue;
        const points = getPoints("searoutes", cells, pointsArray);
        routes.push({i: routes.length, group: "searoutes", feature, points});
      }

      return routes;
    }

    // merge routes so that the last cell of one route is the first cell of the next route
    function mergeRoutes(routes) {
      let routesMerged = 0;

      for (let i = 0; i < routes.length; i++) {
        const thisRoute = routes[i];
        if (thisRoute.merged) continue;

        for (let j = i + 1; j < routes.length; j++) {
          const nextRoute = routes[j];
          if (nextRoute.merged) continue;

          if (nextRoute.cells.at(0) === thisRoute.cells.at(-1)) {
            routesMerged++;
            thisRoute.cells = thisRoute.cells.concat(nextRoute.cells.slice(1));
            nextRoute.merged = true;
          }
        }
      }

      return routesMerged > 1 ? mergeRoutes(routes) : routes;
    }
  }

  function createCostEvaluator({isWater, connections}) {
    return isWater ? getWaterPathCost : getLandPathCost;

    function getLandPathCost(current, next) {
      if (pack.cells.h[next] < 20) return Infinity; // ignore water cells

      const habitability = biomesData.habitability[pack.cells.biome[next]];
      if (!habitability) return Infinity; // inhabitable cells are not passable (e.g. glacier)

      const distanceCost = dist2(pack.cells.p[current], pack.cells.p[next]);
      const habitabilityModifier = 1 + Math.max(100 - habitability, 0) / 1000; // [1, 1.1];
      const heightModifier = 1 + Math.max(pack.cells.h[next] - 25, 25) / 25; // [1, 3];
      const connectionModifier = connections.has(`${current}-${next}`) ? 0.5 : 1;
      const burgModifier = pack.cells.burg[next] ? 1 : 3;

      const pathCost = distanceCost * habitabilityModifier * heightModifier * connectionModifier * burgModifier;
      return pathCost;
    }

    function getWaterPathCost(current, next) {
      if (pack.cells.h[next] >= 20) return Infinity; // ignore land cells
      if (grid.cells.temp[pack.cells.g[next]] < MIN_PASSABLE_SEA_TEMP) return Infinity; // ignore too cold cells

      const distanceCost = dist2(pack.cells.p[current], pack.cells.p[next]);
      const typeModifier = ROUTE_TYPE_MODIFIERS[pack.cells.t[next]] || ROUTE_TYPE_MODIFIERS.default;
      const connectionModifier = connections.has(`${current}-${next}`) ? 0.5 : 1;

      const pathCost = distanceCost * typeModifier * connectionModifier;
      return pathCost;
    }
  }

  function buildLinks(routes) {
    const links = {};

    for (const {points, i: routeId} of routes) {
      const cells = points.map(p => p[2]);

      for (let i = 0; i < cells.length - 1; i++) {
        const cellId = cells[i];
        const nextCellId = cells[i + 1];

        if (cellId !== nextCellId) {
          if (!links[cellId]) links[cellId] = {};
          links[cellId][nextCellId] = routeId;

          if (!links[nextCellId]) links[nextCellId] = {};
          links[nextCellId][cellId] = routeId;
        }
      }
    }

    return links;
  }

  function preparePointsArray() {
    const {cells, burgs} = pack;
    return cells.p.map(([x, y], cellId) => {
      const burgId = cells.burg[cellId];
      if (burgId) return [burgs[burgId].x, burgs[burgId].y];
      return [x, y];
    });
  }

  function getPoints(group, cells, points) {
    const data = cells.map(cellId => [...points[cellId], cellId]);

    // resolve sharp angles
    if (group !== "searoutes") {
      for (let i = 1; i < cells.length - 1; i++) {
        const cellId = cells[i];
        if (pack.cells.burg[cellId]) continue;

        const [prevX, prevY] = data[i - 1];
        const [currX, currY] = data[i];
        const [nextX, nextY] = data[i + 1];

        const dAx = prevX - currX;
        const dAy = prevY - currY;
        const dBx = nextX - currX;
        const dBy = nextY - currY;
        const angle = Math.abs((Math.atan2(dAx * dBy - dAy * dBx, dAx * dBx + dAy * dBy) * 180) / Math.PI);

        if (angle < ROUTES_SHARP_ANGLE) {
          const middleX = (prevX + nextX) / 2;
          const middleY = (prevY + nextY) / 2;
          let newX, newY;

          if (angle < ROUTES_VERY_SHARP_ANGLE) {
            newX = rn((currX + middleX * 2) / 3, 2);
            newY = rn((currY + middleY * 2) / 3, 2);
          } else {
            newX = rn((currX + middleX) / 2, 2);
            newY = rn((currY + middleY) / 2, 2);
          }

          if (findCell(newX, newY) === cellId) {
            data[i] = [newX, newY, cellId];
            points[cellId] = [data[i][0], data[i][1]]; // change cell coordinate for all routes
          }
        }
      }
    }

    return data; // [[x, y, cell], [x, y, cell]];
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

  // connect cell with routes system by land
  function connect(cellId) {
    const getCost = createCostEvaluator({isWater: false, connections: new Map()});
    const pathCells = findPath(cellId, isConnected, getCost);
    if (!pathCells) return;

    const pointsArray = preparePointsArray();
    const points = getPoints("trails", pathCells, pointsArray);
    const feature = pack.cells.f[cellId];
    const routeId = getNextId();
    const newRoute = {i: routeId, group: "trails", feature, points};
    pack.routes.push(newRoute);

    for (let i = 0; i < pathCells.length; i++) {
      const cellId = pathCells[i];
      const nextCellId = pathCells[i + 1];
      if (nextCellId) addConnection(cellId, nextCellId, routeId);
    }

    return newRoute;

    function addConnection(from, to, routeId) {
      const routes = pack.cells.routes;

      if (!routes[from]) routes[from] = {};
      routes[from][to] = routeId;

      if (!routes[to]) routes[to] = {};
      routes[to][from] = routeId;
    }
  }

  // utility functions
  function isConnected(cellId) {
    const routes = pack.cells.routes;
    return routes[cellId] && Object.keys(routes[cellId]).length > 0;
  }

  function areConnected(from, to) {
    const routeId = pack.cells.routes[from]?.[to];
    return routeId !== undefined;
  }

  function getRoute(from, to) {
    const routeId = pack.cells.routes[from]?.[to];
    if (routeId === undefined) return null;

    const route = pack.routes.find(route => route.i === routeId);
    if (!route) return null;

    return route;
  }

  function hasRoad(cellId) {
    const connections = pack.cells.routes[cellId];
    if (!connections) return false;

    return Object.values(connections).some(routeId => {
      const route = pack.routes.find(route => route.i === routeId);
      if (!route) return false;
      return route.group === "roads";
    });
  }

  function hasSecondaryRoad(cellId) {
    const connections = pack.cells.routes[cellId];
    if (!connections) return false;

    return Object.values(connections).some(routeId => {
      const route = pack.routes.find(route => route.i === routeId);
      if (!route) return false;
      return route.group === "secondary";
    });
  }

  function isCrossroad(cellId) {
    const connections = pack.cells.routes[cellId];
    if (!connections) return false;
    if (Object.keys(connections).length > 3) return true;
    const majorRoadConnections = Object.values(connections).filter(routeId => {
      const route = pack.routes.find(route => route.i === routeId);
      return route?.group === "roads" || route?.group === "secondary";
    });
    return majorRoadConnections.length > 2;
  }

  // name generator data
  const models = {
    roads: {burg_suffix: 3, prefix_suffix: 6, the_descriptor_prefix_suffix: 2, the_descriptor_burg_suffix: 1},
    secondary: {burg_suffix: 5, prefix_suffix: 4, the_descriptor_prefix_suffix: 1, the_descriptor_burg_suffix: 2},
    trails: {burg_suffix: 8, prefix_suffix: 1, the_descriptor_burg_suffix: 1},
    searoutes: {burg_suffix: 4, prefix_suffix: 2, the_descriptor_prefix_suffix: 1}
  };

  const prefixes = [
    "King",
    "Queen",
    "Military",
    "Old",
    "New",
    "Ancient",
    "Royal",
    "Imperial",
    "Great",
    "Grand",
    "High",
    "Silver",
    "Dragon",
    "Shadow",
    "Star",
    "Mystic",
    "Whisper",
    "Eagle",
    "Golden",
    "Crystal",
    "Enchanted",
    "Frost",
    "Moon",
    "Sun",
    "Thunder",
    "Phoenix",
    "Sapphire",
    "Celestial",
    "Wandering",
    "Echo",
    "Twilight",
    "Crimson",
    "Serpent",
    "Iron",
    "Forest",
    "Flower",
    "Whispering",
    "Eternal",
    "Frozen",
    "Rain",
    "Luminous",
    "Stardust",
    "Arcane",
    "Glimmering",
    "Jade",
    "Ember",
    "Azure",
    "Gilded",
    "Divine",
    "Shadowed",
    "Cursed",
    "Moonlit",
    "Sable",
    "Everlasting",
    "Amber",
    "Nightshade",
    "Wraith",
    "Scarlet",
    "Platinum",
    "Whirlwind",
    "Obsidian",
    "Ethereal",
    "Ghost",
    "Spike",
    "Dusk",
    "Raven",
    "Spectral",
    "Burning",
    "Verdant",
    "Copper",
    "Velvet",
    "Falcon",
    "Enigma",
    "Glowing",
    "Silvered",
    "Molten",
    "Radiant",
    "Astral",
    "Wild",
    "Flame",
    "Amethyst",
    "Aurora",
    "Shadowy",
    "Solar",
    "Lunar",
    "Whisperwind",
    "Fading",
    "Titan",
    "Dawn",
    "Crystalline",
    "Jeweled",
    "Sylvan",
    "Twisted",
    "Ebon",
    "Thorn",
    "Cerulean",
    "Halcyon",
    "Infernal",
    "Storm",
    "Eldritch",
    "Sapphire",
    "Crimson",
    "Tranquil",
    "Paved"
  ];

  const descriptors = [
    "Great",
    "Shrouded",
    "Sacred",
    "Fabled",
    "Frosty",
    "Winding",
    "Echoing",
    "Serpentine",
    "Breezy",
    "Misty",
    "Rustic",
    "Silent",
    "Cobbled",
    "Cracked",
    "Shaky",
    "Obscure"
  ];

  const suffixes = {
    roads: {road: 7, route: 3, way: 2, highway: 1},
    secondary: {road: 4, route: 2, way: 3, avenue: 1, boulevard: 1},
    trails: {trail: 4, path: 1, track: 1, pass: 1},
    searoutes: {"sea route": 5, lane: 2, passage: 1, seaway: 1}
  };

  function generateName({group, points}) {
    if (points.length < 4) return "Unnamed route segment";

    const model = rw(models[group]);
    const suffix = rw(suffixes[group]);

    const burgName = getBurgName();
    if (model === "burg_suffix" && burgName) return `${burgName} ${suffix}`;
    if (model === "prefix_suffix") return `${ra(prefixes)} ${suffix}`;
    if (model === "the_descriptor_prefix_suffix") return `The ${ra(descriptors)} ${ra(prefixes)} ${suffix}`;
    if (model === "the_descriptor_burg_suffix" && burgName) return `The ${ra(descriptors)} ${burgName} ${suffix}`;
    return "Unnamed route";

    function getBurgName() {
      const priority = [points.at(-1), points.at(0), points.slice(1, -1).reverse()];
      for (const [_x, _y, cellId] of priority) {
        const burgId = pack.cells.burg[cellId];
        if (burgId) return getAdjective(pack.burgs[burgId].name);
      }
      return null;
    }
  }

  const ROUTE_CURVES = {
    roads: d3.curveCatmullRom.alpha(0.1),
    secondary: d3.curveCatmullRom.alpha(0.1),
    trails: d3.curveCatmullRom.alpha(0.1),
    searoutes: d3.curveCatmullRom.alpha(0.5),
    default: d3.curveCatmullRom.alpha(0.1)
  };

  function getPath({group, points}) {
    const lineGen = d3.line();
    lineGen.curve(ROUTE_CURVES[group] || ROUTE_CURVES.default);
    const path = round(lineGen(points.map(p => [p[0], p[1]])), 1);
    return path;
  }

  function getLength(routeId) {
    const path = routes.select("#route" + routeId).node();
    if (!path) {
      // Fallback: calculate length from route points if DOM element not available
      const route = pack.routes.find(r => r.i === routeId);
      if (route && route.points) {
        let length = 0;
        for (let i = 0; i < route.points.length - 1; i++) {
          const [x1, y1] = route.points[i];
          const [x2, y2] = route.points[i + 1];
          length += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        }
        return length;
      }
      return 0;
    }
    return path.getTotalLength();
  }

  function getNextId() {
    return pack.routes.length ? Math.max(...pack.routes.map(r => r.i)) + 1 : 0;
  }

  function remove(route) {
    const routes = pack.cells.routes;

    for (const point of route.points) {
      const from = point[2];
      if (!routes[from]) continue;

      for (const [to, routeId] of Object.entries(routes[from])) {
        if (routeId === route.i) {
          delete routes[from][to];
          delete routes[to][from];
        }
      }
    }

    pack.routes = pack.routes.filter(r => r.i !== route.i);
    viewbox.select("#route" + route.i).remove();
  }

  return {
    generate,
    buildLinks,
    connect,
    isConnected,
    areConnected,
    getRoute,
    hasRoad,
    hasSecondaryRoad,
    isCrossroad,
    generateName,
    getPath,
    getLength,
    getNextId,
    remove
  };
})();
