import Delaunator from "delaunator";

import {Voronoi} from "modules/voronoi";
import {TIME} from "config/logging";
// @ts-expect-error js module
import {aleaPRNG} from "scripts/aleaPRNG";
import {createTypedArray} from "utils/arrayUtils";
import {rn} from "utils/numberUtils";
import {byId} from "utils/shorthands";

export function generateGrid() {
  Math.random = aleaPRNG(seed); // reset PRNG
  const {spacing, cellsDesired, boundary, points, cellsX, cellsY} = placePoints();
  const {cells, vertices} = calculateVoronoi(points, boundary);
  return {spacing, cellsDesired, boundary, points, cellsX, cellsY, cells, vertices};
}

// place random points to calculate Voronoi diagram
function placePoints() {
  TIME && console.time("placePoints");
  const cellsDesired = Number(byId("pointsInput")?.dataset.cells);
  const spacing = rn(Math.sqrt((graphWidth * graphHeight) / cellsDesired), 2); // spacing between points before jirrering

  const boundary = getBoundaryPoints(graphWidth, graphHeight, spacing);
  const points = getJitteredGrid(graphWidth, graphHeight, spacing); // points of jittered square grid
  const cellsX = Math.floor((graphWidth + 0.5 * spacing - 1e-10) / spacing);
  const cellsY = Math.floor((graphHeight + 0.5 * spacing - 1e-10) / spacing);
  TIME && console.timeEnd("placePoints");

  return {spacing, cellsDesired, boundary, points, cellsX, cellsY};
}

// calculate Delaunay and then Voronoi diagram
export function calculateVoronoi(points: TPoints, boundary: TPoints): IGraph {
  TIME && console.time("calculateDelaunay");
  const allPoints: TPoints = points.concat(boundary);
  const delaunay = Delaunator.from(allPoints);
  TIME && console.timeEnd("calculateDelaunay");

  TIME && console.time("calculateVoronoi");
  const {cells, vertices} = new Voronoi(delaunay, allPoints, points.length);
  const i = createTypedArray({maxValue: points.length, length: points.length}).map((_, i) => i); // array of indexes

  TIME && console.timeEnd("calculateVoronoi");
  return {cells: {...cells, i}, vertices};
}

// add points along map edge to pseudo-clip voronoi cells
function getBoundaryPoints(width: number, height: number, spacing: number) {
  const offset = rn(spacing * -1.5);

  const bSpacing = spacing * 2;
  const w = width - offset * 2;
  const h = height - offset * 2;

  const numberX = Math.ceil(w / bSpacing) - 1;
  const numberY = Math.ceil(h / bSpacing) - 1;

  const points: TPoints = [];

  for (let i = 0.5; i < numberX; i++) {
    let x = Math.ceil((w * i) / numberX + offset);
    points.push([x, offset], [x, h + offset]);
  }

  for (let i = 0.5; i < numberY; i++) {
    let y = Math.ceil((h * i) / numberY + offset);
    points.push([offset, y], [w + offset, y]);
  }

  return points;
}

// get points on a regular square grid and jitter them a bit
function getJitteredGrid(width: number, height: number, spacing: number) {
  const radius = spacing / 2; // square radius
  const jittering = radius * 0.9; // max deviation
  const doubleJittering = jittering * 2;
  const jitter = () => Math.random() * doubleJittering - jittering;

  const points: TPoints = [];
  for (let y = radius; y < height; y += spacing) {
    for (let x = radius; x < width; x += spacing) {
      const xj = Math.min(rn(x + jitter(), 2), width);
      const yj = Math.min(rn(y + jitter(), 2), height);
      points.push([xj, yj]);
    }
  }
  return points;
}
