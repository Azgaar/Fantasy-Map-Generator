import {TIME} from "config/logging";

export function generateRoutes(burgs: TBurgs) {
  const routeScores = new Uint8Array(n); // cell road power
  getRoads(burgs);
  // const townRoutes = getTrails();
  // const oceanRoutes = getSearoutes();

  return routeScores;
}

const getRoads = function (burgs: TBurgs) {
  TIME && console.time("generateMainRoads");
  const cells = pack.cells;

  const isBurg = (burg: TNoBurg | IBurg): burg is IBurg => burg.i > 0;
  const capitals = burgs.filter(burg => isBurg(burg) && burg.capital && !burg.removed) as IBurg[];
  capitals.sort((a, b) => a.population - b.population);

  if (capitals.length < 2) return []; // not enough capitals to build main roads

  const routes = []; // array to store path segments

  for (const {i, feature, cell: fromCell} of capitals) {
    const sameFeatureCapitals = capitals.filter(capital => i !== capital.i && feature === capital.feature);
    for (const {cell: toCell} of sameFeatureCapitals) {
      const [from, exit] = findLandPath(fromCell, toCell, true);
      const segments = restorePath(fromCell, exit, "main", from);
      segments.forEach(s => routes.push(s));
    }
  }

  cells.i.forEach(i => (cells.s[i] += cells.road[i] / 2)); // add roads to suitability score
  TIME && console.timeEnd("generateMainRoads");
  return routes;
};
