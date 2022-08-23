import * as d3 from "d3";

import {getNormal} from "utils/lineUtils";
import {round} from "utils/stringUtils";

const lineGenTypeMap: {[key in IRoute["type"]]: d3.CurveFactory | d3.CurveFactoryLineOnly} = {
  road: d3.curveCatmullRom.alpha(0.1),
  trail: d3.curveCatmullRom.alpha(0.1),
  sea: d3.curveBasis
};

export function drawRoutes() {
  routes.selectAll("path").remove();

  const {cells, burgs} = pack;
  const lineGen = d3.line();

  const SHARP_ANGLE = 135;
  const VERY_SHARP_ANGLE = 115;

  const points = adjustBurgPoints(); // mutable array of points
  const routePaths: Dict<string[]> = {};

  for (const {i, type, cells} of pack.routes) {
    if (type !== "sea") straightenPathAngles(cells); // mutates points
    const pathPoints = getPathPoints(cells);

    lineGen.curve(lineGenTypeMap[type]);
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

  function getPathPoints(cellIds: number[]): TPoints {
    const pathPoints = cellIds.map(cellId => points[cellId]);

    if (pathPoints.length === 2) {
      // curve and shorten 2-points line
      const [[x1, y1], [x2, y2]] = pathPoints;

      const middleX = (x1 + x2) / 2;
      const middleY = (y1 + y2) / 2;

      // add shifted point at the middle to curve the line a bit
      const NORMAL_LENGTH = 0.3;
      const normal = getNormal([x1, y1], [x2, y2]);
      const sign = cellIds[0] % 2 ? 1 : -1;
      const normalX = middleX + NORMAL_LENGTH * Math.cos(normal) * sign;
      const normalY = middleY + NORMAL_LENGTH * Math.sin(normal) * sign;

      // make line shorter to avoid overlapping with other lines
      const SHORT_LINE_LENGTH_MODIFIER = 0.8;
      const distX = x2 - x1;
      const distY = y2 - y1;
      const nx1 = x1 + distX * SHORT_LINE_LENGTH_MODIFIER;
      const ny1 = y1 + distY * SHORT_LINE_LENGTH_MODIFIER;
      const nx2 = x2 - distX * SHORT_LINE_LENGTH_MODIFIER;
      const ny2 = y2 - distY * SHORT_LINE_LENGTH_MODIFIER;

      return [
        [nx1, ny1],
        [normalX, normalY],
        [nx2, ny2]
      ];
    }

    return pathPoints;
  }
}
