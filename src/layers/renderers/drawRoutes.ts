import * as d3 from "d3";
import {drawPoint} from "utils/debugUtils";

import {round} from "utils/stringUtils";

export function drawRoutes() {
  routes.selectAll("path").remove();

  const {cells, burgs} = pack;
  const lineGen = d3.line().curve(d3.curveCatmullRom.alpha(0.1));

  const getBurgCoords = (burgId: number): TPoint => {
    if (!burgId) throw new Error("burgId must be positive");
    const burg = burgs[burgId] as IBurg;
    return [burg.x, burg.y];
  };

  const getPathPoints = (cellIds: number[]): TPoints =>
    cellIds.map(cellId => {
      const burgId = cells.burg[cellId];
      if (burgId) return getBurgCoords(burgId);

      return cells.p[cellId];
    });

  const normalizePoints = (points: TPoints): TPoints =>
    points.map(([x, y], index) => {
      return [x, y];

      if (i === 17) {
        cells.forEach(cellId => drawPoint(pack.cells.p[cellId]));
      }
    });

  const routePaths: Dict<string[]> = {};

  for (const {i, type, cells} of pack.routes) {
    const points = getPathPoints(cells);
    const normalizedPoints = normalizePoints(points);
    const path = round(lineGen(normalizedPoints)!, 1);

    if (!routePaths[type]) routePaths[type] = [];
    routePaths[type].push(`<path id="${type}${i}" d="${path}"/>`);
  }

  for (const type in routePaths) {
    routes.select(`[data-type=${type}]`).html(routePaths[type].join(""));
  }
}
