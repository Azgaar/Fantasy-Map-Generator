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

// Route tier modifiers for different route types (lower = preferred)
const ROUTE_TIER_MODIFIERS = {
  majorSea: { cost: 0.3, priority: "immediate" },     // Major maritime trade routes
  royal: { cost: 0.4, priority: "immediate" },        // Capital-to-capital roads
  market: { cost: 1.0, priority: "background" },      // Regional trade roads
  local: { cost: 1.5, priority: "background" },       // Village-to-market roads
  footpath: { cost: 2.0, priority: "background" },    // Hamlet paths
  regional: { cost: 1.2, priority: "background" }     // Regional sea routes
};

window.Routes = (function () {
  // Per-cell cost cache for fast path evaluations
  let RC = null;
  function generate(lockedRoutes = []) {
    TIME && console.time("generateRoutes");
    const {capitalsByFeature, burgsByFeature, portsByFeature, primaryByFeature, plazaByFeature, unconnectedBurgsByFeature} = sortBurgsByFeature(pack.burgs);

    // Build per-cell route cost factors once
    RC = buildRouteCostCache();

    // connections: Map<cellId, Set<neighborCellId>> for O(1) adjacency checks without string keys
    const connections = new Map();
    lockedRoutes.forEach(route => addConnections(route.points.map(p => p[2])));

    // PHASE 1: IMMEDIATE PROCESSING (blocking - critical routes for trade and diplomacy)
    TIME && console.time("generateCriticalRoutes");
    const majorSeaRoutes = generateMajorSeaRoutes(); // Tier 1: Long-distance maritime trade
    const royalRoads = generateRoyalRoads();         // Tier 2: Capital-to-capital connections
    TIME && console.timeEnd("generateCriticalRoutes");

    // Create initial routes with critical paths only
    pack.routes = createRoutesData(lockedRoutes);
    pack.cells.routes = buildLinks(pack.routes);

    // PHASE 2: BACKGROUND PROCESSING (non-blocking - local and regional routes)
    setTimeout(() => {
      TIME && console.time("generateRegionalRoutes");
      const marketRoads = generateMarketRoads();     // Tier 3: Regional trade networks (was mainRoads)
      const localRoads = generateLocalRoads();       // Tier 4: Village-to-market connections (was secondaryRoads)
      const footpaths = generateFootpaths();         // Tier 5: Hamlet networks (was trails)
      const regionalSeaRoutes = generateRegionalSeaRoutes(); // Regional sea connections
      TIME && console.timeEnd("generateRegionalRoutes");
      
      // Append regional routes to existing critical routes
      appendRoutesToPack(marketRoads, localRoads, footpaths, regionalSeaRoutes);
    }, 100);

    TIME && console.timeEnd("generateRoutes");

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

    // Precompute per-cell route modifiers to avoid hot-path branching
    function buildRouteCostCache() {
      const {cells} = pack;
      const n = cells.i.length;
      const landHabitability = new Float32Array(n);
      const landHeight = new Float32Array(n);
      const isPassableLand = new Uint8Array(n);
      const waterType = new Float32Array(n);
      const isPassableWater = new Uint8Array(n);
      const stateId = new Uint32Array(n);
      const burgFactor = new Float32Array(n);

      for (let i = 0; i < n; i++) {
        const h = pack.cells.h[i];
        const hab = biomesData.habitability[pack.cells.biome[i]];
        isPassableLand[i] = h >= 20 && hab > 0 ? 1 : 0;
        landHabitability[i] = 1 + Math.max(100 - hab, 0) / 1000;
        landHeight[i] = 1 + Math.max(h - 25, 25) / 25;
        stateId[i] = pack.cells.state[i] >>> 0;
        burgFactor[i] = pack.cells.burg[i] ? 1 : 3;

        const t = pack.cells.t[i];
        waterType[i] = ROUTE_TYPE_MODIFIERS[t] || ROUTE_TYPE_MODIFIERS.default;
        const temp = grid.cells.temp[pack.cells.g[i]];
        isPassableWater[i] = h < 20 && temp >= MIN_PASSABLE_SEA_TEMP ? 1 : 0;
      }

      return {landHabitability, landHeight, isPassableLand, waterType, isPassableWater, stateId, burgFactor};
    }

    // Tier 1: Major Sea Routes - Connect capitals and major ports across ALL water bodies
    // Simulates long-distance maritime trade like Hanseatic League routes
    function generateMajorSeaRoutes() {
      TIME && console.time("generateMajorSeaRoutes");
      const majorSeaRoutes = [];
      
      // Get all significant ports for major trade routes
      let allMajorPorts = [];
      pack.burgs.forEach(b => {
        if (!b.i || b.removed) return;
        if (b.port) {
          if (b.capital || b.isLargePort || (b.population >= 5 && b.plaza) || (b.population >= 10)) {
            allMajorPorts.push(b);
          }
        }
      });

      // Fallback: if there are <2 declared ports (e.g., single-port water bodies),
      // consider coastal capitals/markets as pseudo-ports to ensure some sea routes.
      if (allMajorPorts.length < 2) {
        const coastalCandidates = pack.burgs.filter(b => {
          if (!b.i || b.removed) return false;
          const cell = b.cell;
          const coastal = pack.cells.t[cell] === 1; // coastline
          const tempOK = grid.cells.temp[pack.cells.g[cell]] >= MIN_PASSABLE_SEA_TEMP;
          return coastal && tempOK && (b.capital || b.plaza || b.isLargePort || b.population >= 5);
        });
        // take up to 12 best by importance
        coastalCandidates.sort((a, b) => (b.capital - a.capital) || (b.population - a.population));
        allMajorPorts = coastalCandidates.slice(0, Math.min(12, coastalCandidates.length));
      }
      
      if (allMajorPorts.length < 2) {
        TIME && console.timeEnd("generateMajorSeaRoutes");
        return majorSeaRoutes;
      }
      
      // Sort ports by importance (capitals first, then by population)
      allMajorPorts.sort((a, b) => {
        if (a.capital && !b.capital) return -1;
        if (!a.capital && b.capital) return 1;
        return b.population - a.population;
      });
      
      // Create a more comprehensive trade network
      // Primary hubs: ALL capital ports and top large ports
      const capitalPorts = allMajorPorts.filter(p => p.capital);
      const largePorts = allMajorPorts.filter(p => !p.capital && (p.isLargePort || p.population >= 10));
      const mediumPorts = allMajorPorts.filter(p => !p.capital && !p.isLargePort && p.population < 10);
      
      // Use all capitals and top large ports as primary hubs
      let hubs = [...capitalPorts, ...largePorts.slice(0, Math.max(10, Math.floor(largePorts.length * 0.5)))];
      if (hubs.length < 2) hubs = [...largePorts.slice(0, Math.min(20, largePorts.length))];
      const secondaryHubs = [...largePorts.slice(Math.max(10, Math.floor(largePorts.length * 0.5))), ...mediumPorts.slice(0, 20)];
      
      // Connect primary hubs strategically using sparse graph (Urquhart edges)
      if (hubs.length >= 2) {
        const points = hubs.map(p => [p.x, p.y]);
        const edges = calculateUrquhartEdges(points);
        edges.forEach(([ai, bi]) => {
          const a = hubs[ai];
          const b = hubs[bi];
          const start = a.cell;
          const exit = b.cell;
          const segments = findPathSegments({isWater: true, connections, start, exit, routeType: "majorSea"});
          for (const segment of segments) {
            addConnections(segment);
            majorSeaRoutes.push({feature: -1, cells: segment, type: "majorSea"});
          }
        });
      }
      
      // Connect large ports to nearest 1-2 hubs for trade network
      largePorts.slice(0, 15).forEach(port => {
        const nearestHubs = hubs
          .map(cap => ({
            cap,
            distance2: (port.x - cap.x) ** 2 + (port.y - cap.y) ** 2
          }))
          .sort((a, b) => a.distance2 - b.distance2)
          .slice(0, Math.min(2, hubs.length)); // Connect to up to 2 nearest hubs
        
        nearestHubs.forEach(({cap}) => {
          const segments = findPathSegments({
            isWater: true,
            connections,
            start: port.cell,
            exit: cap.cell,
            routeType: "majorSea"
          });
          for (const segment of segments) {
            addConnections(segment);
            majorSeaRoutes.push({feature: -1, cells: segment, type: "majorSea"});
          }
        });
      });
      
      // Connect secondary hubs to nearest primary hub
      secondaryHubs.forEach(port => {
        let nearestHub = null;
        let minDistance = Infinity;
        
        hubs.forEach(hub => {
          const dx = port.x - hub.x; const dy = port.y - hub.y; const d2 = dx*dx + dy*dy;
          if (d2 < minDistance) {
            minDistance = d2;
            nearestHub = hub;
          }
        });
        
        if (nearestHub) {
          const segments = findPathSegments({
            isWater: true, 
            connections, 
            start: port.cell, 
            exit: nearestHub.cell,
            routeType: "majorSea"
          });
          for (const segment of segments) {
            addConnections(segment);
            majorSeaRoutes.push({feature: -1, cells: segment, type: "majorSea"});
          }
        }
      });
      
      TIME && console.timeEnd("generateMajorSeaRoutes");
      return majorSeaRoutes;
    }

    // Tier 2: Royal Roads - Connect all state capitals for diplomatic and military movement
    function generateRoyalRoads() {
      TIME && console.time("generateRoyalRoads");
      const royalRoads = [];
      
      // Get all state capitals
      const capitals = [];
      pack.states.forEach(state => {
        if (state.i && !state.removed && state.capital) {
          const capital = pack.burgs[state.capital];
          if (capital && !capital.removed) {
            capitals.push(capital);
          }
        }
      });
      
      if (capitals.length < 2) {
        TIME && console.timeEnd("generateRoyalRoads");
        return royalRoads;
      }
      
      // Create a minimum spanning tree of capitals using Kruskal's algorithm
      // This ensures all capitals are connected with minimal total distance
      const edges = [];
      for (let i = 0; i < capitals.length; i++) {
        for (let j = i + 1; j < capitals.length; j++) {
          const dx = (capitals[i].x - capitals[j].x);
          const dy = (capitals[i].y - capitals[j].y);
          const distance = dx*dx + dy*dy; // squared distance is sufficient for sorting
          edges.push({
            from: i,
            to: j,
            distance,
            fromCell: capitals[i].cell,
            toCell: capitals[j].cell
          });
        }
      }
      
      // Sort edges by distance
      edges.sort((a, b) => a.distance - b.distance);
      
      // Use union-find to build minimum spanning tree
      const parent = Array.from({length: capitals.length}, (_, i) => i);
      const find = (x) => {
        if (parent[x] !== x) parent[x] = find(parent[x]);
        return parent[x];
      };
      const union = (x, y) => {
        const px = find(x);
        const py = find(y);
        if (px !== py) {
          parent[px] = py;
          return true;
        }
        return false;
      };
      
      // Build the tree
      for (const edge of edges) {
        if (union(edge.from, edge.to)) {
          const segments = findPathSegments({
            isWater: false,
            connections,
            start: edge.fromCell,
            exit: edge.toCell,
            routeType: "royal"
          });
          for (const segment of segments) {
            addConnections(segment);
            royalRoads.push({
              feature: pack.cells.f[edge.fromCell],
              cells: segment,
              type: "royal"
            });
          }
        }
      }
      
      TIME && console.timeEnd("generateRoyalRoads");
      return royalRoads;
    }

    // Tier 3: Market Roads - Regional trade networks (enhanced main roads)
    function generateMarketRoads() {
      TIME && console.time("generateMarketRoads");
      const marketRoads = [];
      
      // Get all market towns (from new settlement hierarchy)
      const marketTowns = pack.burgs.filter(b => 
        b.i && !b.removed && (b.settlementType === "marketTown" || b.plaza === 1)
      );
      
      // Group market towns by feature/region
      const marketsByFeature = {};
      marketTowns.forEach(town => {
        const feature = town.feature;
        if (!marketsByFeature[feature]) marketsByFeature[feature] = [];
        marketsByFeature[feature].push(town);
      });
      
      // Connect market towns within regions (15-30 km spacing as per research)
      for (const [feature, towns] of Object.entries(marketsByFeature)) {
        if (towns.length < 2) continue;
        
        // Use Delaunay triangulation for regional connections
        const points = towns.map(t => [t.x, t.y]);
        const edges = calculateUrquhartEdges(points);
        
        edges.forEach(([fromId, toId]) => {
          const fromTown = towns[fromId];
          const toTown = towns[toId];
          
          // Check distance is within daily travel range (15-30 km)
          const distance = Math.sqrt((fromTown.x - toTown.x) ** 2 + (fromTown.y - toTown.y) ** 2);
          const mapScale = Math.sqrt(graphWidth * graphHeight / 1000000);
          const kmDistance = distance / mapScale;
          
          // Only connect if within reasonable market day travel distance
          if (kmDistance <= 35) {
            const segments = findPathSegments({
              isWater: false,
              connections,
              start: fromTown.cell,
              exit: toTown.cell,
              routeType: "market"
            });
            
            for (const segment of segments) {
              addConnections(segment);
              marketRoads.push({
                feature: Number(feature),
                cells: segment,
                type: "market"
              });
            }
          }
        });
      }
      
      
      TIME && console.timeEnd("generateMarketRoads");
      return marketRoads;
    }
    
    // Tier 4: Local Roads - Village to nearest market town connections  
    function generateLocalRoads() {
      TIME && console.time("generateLocalRoads");
      const localRoads = [];
      
      // Get villages from settlement hierarchy
      const villages = pack.burgs.filter(b => 
        b.i && !b.removed && (
          b.settlementType === "largeVillage" || 
          b.settlementType === "smallVillage"
        )
      );
      
      // Get market towns and regional centers
      const marketCenters = pack.burgs.filter(b =>
        b.i && !b.removed && (
          b.settlementType === "marketTown" ||
          b.plaza === 1 ||
          b.isRegionalCenter ||
          b.capital
        )
      );
      
      // Connect each village to nearest market center
      const mapScaleLocal = Math.sqrt(graphWidth * graphHeight / 1000000);
      const maxLocalKm = 60; // cap local road reach
      const maxLocalDist2 = (maxLocalKm * mapScaleLocal) ** 2;
      const radiusPx = maxLocalKm * mapScaleLocal;
      const hashMarkets = makeSpatialHash(marketCenters, b => [b.x, b.y], radiusPx);

      villages.forEach(village => {
        let nearestMarket = null;
        let minDistance = Infinity;
        
        const candidates = queryCandidatesWithinRadius(hashMarkets, village.x, village.y, radiusPx);
        for (const market of candidates) {
          const dx = village.x - market.x;
          const dy = village.y - market.y;
          const d2 = dx*dx + dy*dy;
          // Prefer markets in same state/culture
          let culturalModifier = 1;
          if (village.state === market.state) culturalModifier = 0.8;
          if (village.culture === market.culture) culturalModifier *= 0.9;
          const adjustedDistance = d2 * culturalModifier;
          if (adjustedDistance < minDistance) { minDistance = adjustedDistance; nearestMarket = market; }
        }
        
        if (nearestMarket && minDistance <= maxLocalDist2) {
          const segments = findPathSegments({
            isWater: false,
            connections,
            start: village.cell,
            exit: nearestMarket.cell,
            routeType: "local"
          });
          
          for (const segment of segments) {
            // Skip excessively long local segments
            const pxLen = pathCellsLengthPx(segment);
            const kmLen = pxLen / mapScaleLocal;
            if (kmLen > maxLocalKm) continue;
            addConnections(segment);
            localRoads.push({
              feature: village.feature,
              cells: segment,
              type: "local"
            });
          }
        }
      });
      
      
      TIME && console.timeEnd("generateLocalRoads");
      return localRoads;
    }
    
    // Tier 5: Footpaths - Hamlet to village networks
    function generateFootpaths() {
      TIME && console.time("generateFootpaths");
      const footpaths = [];
      
      // Get hamlets from settlement hierarchy
      const hamlets = pack.burgs.filter(b => 
        b.i && !b.removed && b.settlementType === "hamlet"
      );
      
      // Get villages and larger settlements
      const largerSettlements = pack.burgs.filter(b =>
        b.i && !b.removed && (
          b.settlementType === "smallVillage" ||
          b.settlementType === "largeVillage" ||
          b.settlementType === "marketTown" ||
          b.plaza === 1
        )
      );
      
      // Connect each hamlet to nearest village (limit to <= 8 km)
      const mapScaleFoot = Math.sqrt(graphWidth * graphHeight / 1000000);
      const maxFootKm = 8;
      const maxFootDist2 = (maxFootKm * mapScaleFoot) ** 2;
      const radiusFootPx = maxFootKm * mapScaleFoot;
      const hashSettlements = makeSpatialHash(largerSettlements, b => [b.x, b.y], radiusFootPx);
      hamlets.forEach(hamlet => {
        let nearestVillage = null;
        let minDistance = Infinity;
        
        const candidates = queryCandidatesWithinRadius(hashSettlements, hamlet.x, hamlet.y, radiusFootPx);
        for (const village of candidates) {
          const dx = hamlet.x - village.x;
          const dy = hamlet.y - village.y;
          const d2 = dx*dx + dy*dy;
          let modifier = 1;
          if (hamlet.state === village.state) modifier = 0.7;
          if (hamlet.culture === village.culture) modifier *= 0.8;
          const adjustedDistance = d2 * modifier;
          if (d2 <= maxFootDist2 && adjustedDistance < minDistance) { minDistance = adjustedDistance; nearestVillage = village; }
        }
        
        if (nearestVillage) {
          const segments = findPathSegments({
            isWater: false,
            connections,
            start: hamlet.cell,
            exit: nearestVillage.cell,
            routeType: "footpath"
          });
          
          for (const segment of segments) {
            const pxLen = pathCellsLengthPx(segment);
            const kmLen = pxLen / mapScaleFoot;
            if (kmLen > maxFootKm) continue;
            addConnections(segment);
            footpaths.push({
              feature: hamlet.feature,
              cells: segment,
              type: "footpath"
            });
          }
        }
      });
      
      
      TIME && console.timeEnd("generateFootpaths");
      return footpaths;
    }
    
    // Regional sea routes (within water bodies)
    function generateRegionalSeaRoutes() {
      TIME && console.time("generateRegionalSeaRoutes");
      const regionalSeaRoutes = [];
      
      // Filter ports to only include significant ones (500+ population or special status)
      // Small fishing villages don't participate in trade routes
      const significantPortsByFeature = {};
      
      for (const [featureId, featurePorts] of Object.entries(portsByFeature)) {
        const significantPorts = featurePorts.filter(burg => 
          burg.population >= 0.5 || // 500+ population (in thousands)
          burg.capital ||           // Capital cities
          burg.isLargePort ||       // Designated large ports
          burg.plaza ||             // Market towns with plazas
          burg.isRegionalCenter     // Regional centers
        );
        
        if (significantPorts.length >= 2) {
          significantPortsByFeature[featureId] = significantPorts;
        }
      }
      
      // Connect significant ports within each water body
      for (const [featureId, featurePorts] of Object.entries(significantPortsByFeature)) {
        const points = featurePorts.map(burg => [burg.x, burg.y]);
        const urquhartEdges = calculateUrquhartEdges(points);

        urquhartEdges.forEach(([fromId, toId]) => {
          const start = featurePorts[fromId].cell;
          const exit = featurePorts[toId].cell;
          const segments = findPathSegments({isWater: true, connections, start, exit, routeType: "regional"});
          for (const segment of segments) {
            addConnections(segment);
            regionalSeaRoutes.push({feature: Number(featureId), cells: segment, type: "regional"});
          }
        });
      }

      TIME && console.timeEnd("generateRegionalSeaRoutes");
      return regionalSeaRoutes;
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
        const dx = unconnectedBurg.x - connectedBurg.x;
        const dy = unconnectedBurg.y - connectedBurg.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < minDistance) {
          minDistance = d2;
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
      for (let i = 0; i < segment.length - 1; i++) {
        const a = segment[i];
        const b = segment[i + 1];
        let setA = connections.get(a);
        if (!setA) { setA = new Set(); connections.set(a, setA); }
        setA.add(b);
        let setB = connections.get(b);
        if (!setB) { setB = new Set(); connections.set(b, setB); }
        setB.add(a);
      }
    }

    function hasConnection(a, b) {
      const s = connections.get(a);
      return s ? s.has(b) : false;
    }

    function findPathSegments({isWater, connections, start, exit, routeType}) {
      const getCost = createCostEvaluator({isWater, connections, routeType});
      const heuristicScale = getHeuristicScale(routeType, isWater);
      const heuristic = (node) => {
        const [ax, ay] = pack.cells.p[node];
        const [bx, by] = pack.cells.p[exit];
        const dx = ax - bx, dy = ay - by;
        const d = Math.hypot(dx, dy);
        return d * heuristicScale;
      };
      let pathCells = findPathAStar(start, exit, getCost, heuristic);
      if (!pathCells) {
        // Fallback to Dijkstra if A* fails or exceeds caps
        pathCells = findPath(start, current => current === exit, getCost);
      }
      if (!pathCells) return [];
      const segments = getRouteSegments(pathCells, connections);
      return segments;
    }

    function createRoutesData(lockedRoutes) {
      const pointsArray = preparePointsArray();
      const routes = [...lockedRoutes]; // Create a new array from locked routes

      // Process critical routes (Tier 1 & 2) - these run immediately
      for (const {feature, cells, merged, type} of mergeRoutes(majorSeaRoutes)) {
        if (merged) continue;
        const points = getPoints("searoutes", cells, pointsArray);
        routes.push({i: routes.length, group: "searoutes", feature, points, type: type || "majorSea"});
      }

      for (const {feature, cells, merged, type} of mergeRoutes(royalRoads)) {
        if (merged) continue;
        const points = getPoints("roads", cells, pointsArray);
        routes.push({i: routes.length, group: "roads", feature, points, type: type || "royal"});
      }

      return routes;
    }
    
    // Function to append background-generated routes to pack
    function appendRoutesToPack(marketRoads, localRoads, footpaths, regionalSeaRoutes) {
      const pointsArray = preparePointsArray();
      const routes = pack.routes;
      
      // Tier 3: Market Roads
      for (const {feature, cells, merged} of mergeRoutes(marketRoads)) {
        if (merged) continue;
        const points = getPoints("roads", cells, pointsArray);
        const routeId = getNextId();
        routes.push({i: routeId, group: "roads", feature, points, type: "market"});
        
        // Update cell routes
        for (let i = 0; i < cells.length - 1; i++) {
          addRouteConnection(cells[i], cells[i + 1], routeId);
        }
      }
      
      // Tier 4: Local Roads
      for (const {feature, cells, merged} of mergeRoutes(localRoads)) {
        if (merged) continue;
        const points = getPoints("secondary", cells, pointsArray);
        const routeId = getNextId();
        routes.push({i: routeId, group: "secondary", feature, points, type: "local"});
        
        for (let i = 0; i < cells.length - 1; i++) {
          addRouteConnection(cells[i], cells[i + 1], routeId);
        }
      }
      
      // Tier 5: Footpaths
      for (const {feature, cells, merged} of mergeRoutes(footpaths)) {
        if (merged) continue;
        const points = getPoints("trails", cells, pointsArray);
        const routeId = getNextId();
        routes.push({i: routeId, group: "trails", feature, points, type: "footpath"});
        
        for (let i = 0; i < cells.length - 1; i++) {
          addRouteConnection(cells[i], cells[i + 1], routeId);
        }
      }
      
      // Regional Sea Routes
      for (const {feature, cells, merged} of mergeRoutes(regionalSeaRoutes)) {
        if (merged) continue;
        const points = getPoints("searoutes", cells, pointsArray);
        const routeId = getNextId();
        routes.push({i: routeId, group: "searoutes", feature, points, type: "regional"});
        
        for (let i = 0; i < cells.length - 1; i++) {
          addRouteConnection(cells[i], cells[i + 1], routeId);
        }
      }
      
      // Rebuild route links after adding new routes
      pack.cells.routes = buildLinks(pack.routes);
    }
    
    function addRouteConnection(from, to, routeId) {
      const routes = pack.cells.routes || {};
      if (!routes[from]) routes[from] = {};
      routes[from][to] = routeId;
      if (!routes[to]) routes[to] = {};
      routes[to][from] = routeId;
      pack.cells.routes = routes;
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

  // Simple spatial hash for fast radius queries
  function makeSpatialHash(items, getXY, binSize) {
    const bins = new Map();
    for (const it of items) {
      const [x, y] = getXY(it);
      const ix = Math.floor(x / binSize);
      const iy = Math.floor(y / binSize);
      const key = ix + "," + iy;
      let arr = bins.get(key);
      if (!arr) { arr = []; bins.set(key, arr); }
      arr.push(it);
    }
    return {bins, binSize};
  }

  function queryCandidatesWithinRadius(hash, x, y, radius) {
    const out = [];
    const s = hash.binSize;
    const r = Math.ceil(radius / s);
    const ix0 = Math.floor((x - radius) / s);
    const iy0 = Math.floor((y - radius) / s);
    const ix1 = Math.floor((x + radius) / s);
    const iy1 = Math.floor((y + radius) / s);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iy = iy0; iy <= iy1; iy++) {
        const arr = hash.bins.get(ix + "," + iy);
        if (!arr) continue;
        for (const it of arr) out.push(it);
      }
    }
    return out;
  }

  function createCostEvaluator({isWater, connections, routeType = "market"}) {
    return isWater ? getWaterPathCost : getLandPathCost;

    function getLandPathCost(current, next) {
      if (!RC || !RC.isPassableLand[next]) return Infinity;

      const [ax, ay] = pack.cells.p[current];
      const [bx, by] = pack.cells.p[next];
      const distanceCost = Math.hypot(ax - bx, ay - by);
      const habitabilityModifier = RC.landHabitability[next];
      const heightModifier = RC.landHeight[next];
      const setA = connections.get(current);
      const connectionModifier = setA && setA.has(next) ? 0.5 : 1;
      const burgModifier = RC.burgFactor[next];
      
      // Medieval travel constraints
      const riverCrossingPenalty = pack.cells.r[next] && !pack.cells.burg[next] ? 1.5 : 1; // Bridges rare except at settlements
      const borderPenalty = getBorderPenalty(current, next, routeType); // Political boundaries affect some routes
      
      // Apply route tier modifier
      const tierModifier = ROUTE_TIER_MODIFIERS[routeType]?.cost || 1;

      const pathCost = distanceCost * habitabilityModifier * heightModifier * connectionModifier * 
                      burgModifier * riverCrossingPenalty * borderPenalty * tierModifier;
      return pathCost;
    }

    function getWaterPathCost(current, next) {
      if (!RC || !RC.isPassableWater[next]) return Infinity;

      const [ax, ay] = pack.cells.p[current];
      const [bx, by] = pack.cells.p[next];
      const distanceCost = Math.hypot(ax - bx, ay - by);
      const typeModifier = RC.waterType[next];
      const setA = connections.get(current);
      const connectionModifier = setA && setA.has(next) ? 0.5 : 1;
      
      // Apply route tier modifier for sea routes
      const tierModifier = ROUTE_TIER_MODIFIERS[routeType]?.cost || 1;

      const pathCost = distanceCost * typeModifier * connectionModifier * tierModifier;
      return pathCost;
    }
    
    function getBorderPenalty(current, next, routeType) {
      // Royal roads and major sea routes ignore borders (diplomatic/trade importance)
      if (routeType === "royal" || routeType === "majorSea") return 1;
      
      // Check if crossing state border
      const currentState = pack.cells.state[current];
      const nextState = pack.cells.state[next];
      if (currentState === nextState) return 1;
      
      // Higher penalty for local routes crossing borders
      if (routeType === "footpath") return 3;
      if (routeType === "local") return 2;
      return 1.5; // Market roads have moderate border penalty
    }
  }

  function getHeuristicScale(routeType, isWater) {
    // Conservative lower bound for per-edge modifier to keep heuristic admissible
    const tier = ROUTE_TIER_MODIFIERS[routeType]?.cost || 1;
    return 0.5 * tier;
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
      const isConnected = nextCellId !== undefined && ((connections.get(cellId)?.has(nextCellId)) || (connections.get(nextCellId)?.has(cellId)));

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
    if (points.length < 4) {
      const start = points[0]?.[2];
      const end = points.at(-1)?.[2];
      const startB = start != null ? pack.cells.burg[start] : 0;
      const endB = end != null ? pack.cells.burg[end] : 0;
      const startName = startB ? getAdjective(pack.burgs[startB].name) : null;
      const endName = endB ? getAdjective(pack.burgs[endB].name) : null;
      const base = group === "searoutes" ? "Sea route" : group === "secondary" || group === "roads" ? "Road" : "Trail";
      if (startName && endName) return `${base} ${startName}–${endName}`;
      if (startName) return `${base} from ${startName}`;
      if (endName) return `${base} to ${endName}`;
      return `${base} segment`;
    }

    const model = rw(models[group]);
    const suffix = rw(suffixes[group]);

    const burgName = getBurgName();
    if (model === "burg_suffix" && burgName) return `${burgName} ${suffix}`;
    if (model === "prefix_suffix") return `${ra(prefixes)} ${suffix}`;
    if (model === "the_descriptor_prefix_suffix") return `The ${ra(descriptors)} ${ra(prefixes)} ${suffix}`;
    if (model === "the_descriptor_burg_suffix" && burgName) return `The ${ra(descriptors)} ${burgName} ${suffix}`;
    return group === "searoutes" ? "Sea route" : "Route";

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

  // Compute path length in pixels from list of cell ids
  function pathCellsLengthPx(cells) {
    let len = 0;
    for (let i = 0; i < cells.length - 1; i++) {
      const [x1, y1] = pack.cells.p[cells[i]];
      const [x2, y2] = pack.cells.p[cells[i + 1]];
      len += Math.hypot(x2 - x1, y2 - y1);
    }
    return len;
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
