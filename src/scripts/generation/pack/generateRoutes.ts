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
