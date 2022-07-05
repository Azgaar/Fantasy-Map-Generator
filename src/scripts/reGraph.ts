import * as d3 from "d3";

import {TIME} from "config/logging";
import {UINT16_MAX} from "constants";
import {createTypedArray} from "utils/arrayUtils";
import {calculateVoronoi, getPackPolygon} from "utils/graphUtils";
import {rn} from "utils/numberUtils";

// recalculate Voronoi Graph to pack cells
export function reGraph() {
  TIME && console.time("reGraph");
  const {cells: gridCells, points, features} = grid;
  const newCells: {p: TPoints; g: number[]; h: number[]} = {p: [], g: [], h: []}; // store new data
  const spacing2 = grid.spacing ** 2;

  for (const i of gridCells.i) {
    const height = gridCells.h[i];
    const type = gridCells.t[i];
    if (height < 20 && type !== -1 && type !== -2) continue; // exclude all deep ocean points
    if (type === -2 && (i % 4 === 0 || features[gridCells.f[i]].type === "lake")) continue; // exclude non-coastal lake points
    const [x, y] = points[i];

    addNewPoint(i, x, y, height);

    // add additional points for cells along coast
    if (type === 1 || type === -1) {
      if (gridCells.b[i]) continue; // not for near-border cells
      gridCells.c[i].forEach(e => {
        if (i > e) return;
        if (gridCells.t[e] === type) {
          const dist2 = (y - points[e][1]) ** 2 + (x - points[e][0]) ** 2;
          if (dist2 < spacing2) return; // too close to each other
          const x1 = rn((x + points[e][0]) / 2, 1);
          const y1 = rn((y + points[e][1]) / 2, 1);
          addNewPoint(i, x1, y1, height);
        }
      });
    }
  }

  function addNewPoint(i: number, x: number, y: number, height: number) {
    newCells.p.push([x, y]);
    newCells.g.push(i);
    newCells.h.push(height);
  }

  function getCellArea(i: number) {
    const area = Math.abs(d3.polygonArea(getPackPolygon(i)));
    return Math.min(area, UINT16_MAX);
  }

  const {cells: packCells, vertices} = calculateVoronoi(newCells.p, grid.boundary);
  pack.vertices = vertices;
  pack.cells = packCells;
  pack.cells.p = newCells.p;
  pack.cells.g = createTypedArray({maxValue: grid.points.length, from: newCells.g});
  pack.cells.q = d3.quadtree(newCells.p.map(([x, y], i) => [x, y, i]));
  pack.cells.h = createTypedArray({maxValue: 100, from: newCells.h});
  pack.cells.area = createTypedArray({maxValue: UINT16_MAX, from: pack.cells.i}).map(getCellArea);

  TIME && console.timeEnd("reGraph");
}
