import * as d3 from "d3";

import {round} from "utils/stringUtils";

export function drawRoutes() {
  routes.selectAll("path").remove();

  const lineGen = d3.line().curve(d3.curveBasis);

  const routePaths: Dict<string[]> = {};

  for (const {i, type, cells: routeCells} of pack.routes) {
    const points = routeCells.map(cellId => pack.cells.p[cellId]);
    const path = round(lineGen(points)!);

    if (!routePaths[type]) routePaths[type] = [];
    routePaths[type].push(`<path id="${type}${i}" d="${path}"/>`);
  }

  for (const type in routePaths) {
    routes.select(`[data-type=${type}]`).html(routePaths[type].join(""));
  }
}
