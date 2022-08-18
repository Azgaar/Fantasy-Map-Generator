import FlatQueue from "flatqueue";

import {TIME} from "config/logging";
import {ROUTES} from "config/generation";

const isBurg = (burg: TNoBurg | IBurg): burg is IBurg => burg.i > 0;

export function generateRoutes(burgs: TBurgs, cells: Pick<IPack["cells"], "c" | "h" | "biome" | "state" | "burg">) {
  const cellRoutes = new Uint8Array(cells.h.length);
  const mainRoads = generateMainRoads();
  // const townRoutes = getTrails();
  // const oceanRoutes = getSearoutes();

  const routes = combineRoutes();

  console.log(routes);
  return {cellRoutes, routes};

  function generateMainRoads() {
    TIME && console.time("generateMainRoads");
    const mainRoads: {feature: number; from: number; to: number; end: number; cells: number[]}[] = [];

    const capitalsByFeature = burgs.reduce((acc, burg) => {
      if (!isBurg(burg)) return acc;
      const {capital, removed, feature} = burg;
      if (!capital || removed) return acc;

      if (!acc[feature]) acc[feature] = [];
      acc[feature].push(burg);
      return acc;
    }, {} as {[feature: string]: IBurg[]});

    for (const [key, featureCapitals] of Object.entries(capitalsByFeature)) {
      for (let i = 0; i < featureCapitals.length; i++) {
        const {cell: from} = featureCapitals[i];

        for (let j = i + 1; j < featureCapitals.length; j++) {
          const {cell: to} = featureCapitals[j];

          const {end, pathCells} = findLandPath({start: from, exit: to});
          if (end !== null && pathCells.length) {
            pathCells.forEach(cellId => {
              cellRoutes[cellId] = ROUTES.MAIN_ROAD;
            });
            mainRoads.push({feature: Number(key), from, to, end, cells: pathCells});
          }
        }
      }
    }

    TIME && console.timeEnd("generateMainRoads");
    return mainRoads;
  }

  // find land path to a specific cell or to a closest road
  function findLandPath({start, exit}: {start: number; exit: number}) {
    const from: number[] = [];
    const end = findPath();
    if (end === null) return {end, pathCells: []};

    const pathCells = restorePath(start, end, from);
    return {end, pathCells};

    function findPath() {
      const cost: number[] = [];
      const queue = new FlatQueue<number>();
      queue.push(start, 0);

      while (queue.length) {
        const priority = queue.peekValue()!;
        const next = queue.pop()!;

        if (cellRoutes[next]) return next;

        for (const neibCellId of cells.c[next]) {
          if (cells.h[neibCellId] < 20) continue; // ignore water cells
          const stateChangeCost = cells.state && cells.state[neibCellId] !== cells.state[next] ? 400 : 0; // trails tend to lay within the same state
          const habitability = biomesData.habitability[cells.biome[neibCellId]];
          if (!habitability) continue; // avoid inhabitable cells (eg. lava, glacier)
          const habitedCost = habitability ? Math.max(100 - habitability, 0) : 400; // routes tend to lay within populated areas
          const heightChangeCost = Math.abs(cells.h[neibCellId] - cells.h[next]) * 10; // routes tend to avoid elevation changes
          const heightCost = cells.h[neibCellId] > 80 ? cells.h[neibCellId] : 0; // routes tend to avoid mountainous areas
          const cellCoast = 10 + stateChangeCost + habitedCost + heightChangeCost + heightCost;
          const totalCost = priority + (cellRoutes[neibCellId] || cells.burg[neibCellId] ? cellCoast / 3 : cellCoast);

          if (from[neibCellId] || totalCost >= cost[neibCellId]) continue;
          from[neibCellId] = next;

          if (neibCellId === exit) return exit;

          cost[neibCellId] = totalCost;
          queue.push(neibCellId, totalCost);
        }
      }

      return null;
    }
  }

  function combineRoutes() {
    const routes: TRoutes = [];

    for (const {feature, from, to, end, cells} of mainRoads) {
      routes.push({i: routes.length, type: "road", feature, from, to, end, cells});
    }

    return routes;
  }
}

function restorePath(start: number, end: number, from: number[]) {
  const cells: number[] = [];

  let current = end;
  let prev = end;

  while (current !== start) {
    prev = from[current];
    cells.push(current);
    current = prev;
  }

  return cells;
}
