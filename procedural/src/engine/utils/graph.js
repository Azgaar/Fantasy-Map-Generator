import Delaunator from 'delaunator';
import { Voronoi } from '../modules/voronoi.js';
import { rn } from './numberUtils.js'; // Assuming you have these helpers
import { createTypedArray } from './arrayUtils.js';
// import { UINT16_MAX } from './arrayUtils.js';
import * as d3 from 'd3'; // Or import specific d3 modules

/**
 * Generates the initial grid object based on configuration.
 * Assumes Math.random() has already been seeded by the orchestrator.
 * @param {object} config - The graph configuration, e.g., { width, height, cellsDesired }.
 */
export function generateGrid(config) {
  // REMOVED: Math.random = aleaPRNG(seed); This is now handled by engine/main.js.
  const { spacing, cellsDesired, boundary, points, cellsX, cellsY } = placePoints(config);
  const { cells, vertices } = calculateVoronoi(points, boundary);
  return { spacing, cellsDesired, boundary, points, cellsX, cellsY, cells, vertices };
}

// place random points to calculate Voronoi diagram
function placePoints(config) {
  const { width, height, cellsDesired } = config;
  const spacing = rn(Math.sqrt((width * height) / cellsDesired), 2);

  const boundary = getBoundaryPoints(width, height, spacing);
  const points = getJitteredGrid(width, height, spacing);
  const cellsX = Math.floor((width + 0.5 * spacing - 1e-10) / spacing);
  const cellsY = Math.floor((height + 0.5 * spacing - 1e-10) / spacing);

  return { spacing, cellsDesired, boundary, points, cellsX, cellsY };
}

// calculate Delaunay and then Voronoi diagram
function calculateVoronoi(points, boundary) {
  const allPoints = points.concat(boundary);
  const delaunay = Delaunator.from(allPoints);
  const voronoi = new Voronoi(delaunay, allPoints, points.length);

  const cells = voronoi.cells;
  cells.i = createTypedArray({ maxValue: points.length, length: points.length }).map((_, i) => i);
  const vertices = voronoi.vertices;

  return { cells, vertices };
}

// add points along map edge to pseudo-clip voronoi cells
function getBoundaryPoints(width, height, spacing) {
  const offset = rn(-1 * spacing);
  const bSpacing = spacing * 2;
  const w = width - offset * 2;
  const h = height - offset * 2;
  const numberX = Math.ceil(w / bSpacing) - 1;
  const numberY = Math.ceil(h / bSpacing) - 1;
  const points = [];

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
function getJitteredGrid(width, height, spacing) {
  const radius = spacing / 2;
  const jittering = radius * 0.9;
  const doubleJittering = jittering * 2;
  const jitter = () => Math.random() * doubleJittering - jittering; // Uses the pre-seeded Math.random()

  let points = [];
  for (let y = radius; y < height; y += spacing) {
    for (let x = radius; x < width; x += spacing) {
      const xj = Math.min(rn(x + jitter(), 2), width);
      const yj = Math.min(rn(y + jitter(), 2), height);
      points.push([xj, yj]);
    }
  }
  return points;
}

// convert grid graph to pack cells by filtering and adding coastal points
export function reGraph(grid, utils) {
  const { createTypedArray, rn, UINT16_MAX } = utils;
  const { cells: gridCells, points, features, spacing } = grid;

  const newCellsData = { p: [], g: [], h: [] }; // store new data
  const spacing2 = spacing ** 2;

  for (const i of gridCells.i) {
    const height = gridCells.h[i];
    const type = gridCells.t[i];

    if (height < 20 && type !== -1 && type !== -2) continue;
    if (type === -2 && (i % 4 === 0 || features[gridCells.f[i]].type === "lake")) continue;

    const [x, y] = points[i];
    addNewPoint(i, x, y, height);

    if (type === 1 || type === -1) {
      if (gridCells.b[i]) continue;
      gridCells.c[i].forEach(function (e) {
        if (i > e) return;
        if (gridCells.t[e] === type) {
          const dist2 = (y - points[e][1]) ** 2 + (x - points[e][0]) ** 2;
          if (dist2 < spacing2) return;
          const x1 = rn((x + points[e][0]) / 2, 1);
          const y1 = rn((y + points[e][1]) / 2, 1);
          addNewPoint(i, x1, y1, height);
        }
      });
    }
  }

  function addNewPoint(i, x, y, height) {
    newCellsData.p.push([x, y]);
    newCellsData.g.push(i);
    newCellsData.h.push(height);
  }

  const { cells: packCells, vertices } = calculateVoronoi(newCellsData.p, grid.boundary);

  const tempPack = { vertices, cells: { ...packCells, p: newCellsData.p } };

  return {
    vertices,
    cells: {
      ...packCells,
      p: newCellsData.p,
      g: createTypedArray({ maxValue: grid.points.length, from: newCellsData.g }),
      q: d3.quadtree(newCellsData.p.map(([x, y], i) => [x, y, i])),
      h: createTypedArray({ maxValue: 100, from: newCellsData.h }),
      area: createTypedArray({ maxValue: UINT16_MAX, length: packCells.i.length }).map((_, cellId) => {
        const polygon = tempPack.cells.v[cellId].map(v => tempPack.vertices.p[v]);
        const area = Math.abs(d3.polygonArea(polygon));
        return Math.min(area, UINT16_MAX);
      })
    }
  };
}
