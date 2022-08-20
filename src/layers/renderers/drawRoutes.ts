import * as d3 from "d3";

import {round} from "utils/stringUtils";

export function drawRoutes() {
  routes.selectAll("path").remove();

  const {cells, burgs} = pack;
  const lineGen = d3.line().curve(d3.curveCatmullRom.alpha(0.1));

  const SHARP_ANGLE = 135;
  const VERY_SHARP_ANGLE = 115;

  const points = adjustBurgPoints(); // mutable array of points
  const routePaths: Dict<string[]> = {};

  for (const {i, type, cells} of pack.routes) {
    straightenPathAngles(cells); // mutates points
    const pathPoints = cells.map(cellId => points[cellId]);
    const path = round(lineGen(pathPoints)!, 1);

    if (!routePaths[type]) routePaths[type] = [];
    routePaths[type].push(`<path id="${type}${i}" d="${path}"/>`);
  }

  for (const type in routePaths) {
    routes.select(`[data-type=${type}]`).html(routePaths[type].join(""));
  }

  function adjustBurgPoints() {
    const points = Array.from(cells.p);

    for (const burg of burgs) {
      if (burg.i === 0) continue;
      const {cell, x, y} = burg as IBurg;
      points[cell] = [x, y];
    }

    return points;
  }

  function straightenPathAngles(cellIds: number[]) {
    for (let i = 1; i < cellIds.length - 1; i++) {
      const cellId = cellIds[i];
      if (cells.burg[cellId]) continue;

      const prev = points[cellIds[i - 1]];
      const that = points[cellId];
      const next = points[cellIds[i + 1]];

      const dAx = prev[0] - that[0];
      const dAy = prev[1] - that[1];
      const dBx = next[0] - that[0];
      const dBy = next[1] - that[1];
      const angle = (Math.atan2(dAx * dBy - dAy * dBx, dAx * dBx + dAy * dBy) * 180) / Math.PI;

      if (Math.abs(angle) < SHARP_ANGLE) {
        const middleX = (prev[0] + next[0]) / 2;
        const middleY = (prev[1] + next[1]) / 2;

        if (Math.abs(angle) < VERY_SHARP_ANGLE) {
          const newX = (that[0] + middleX * 2) / 3;
          const newY = (that[1] + middleY * 2) / 3;
          points[cellId] = [newX, newY];
          continue;
        }

        const newX = (that[0] + middleX) / 2;
        const newY = (that[1] + middleY) / 2;
        points[cellId] = [newX, newY];
      }
    }
  }
}
