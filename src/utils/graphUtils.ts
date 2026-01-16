import Delaunator from "delaunator";
import Alea from "alea";
import { color } from "d3";
import { byId } from "./shorthands";
import { rn } from "./numberUtils";
import { createTypedArray } from "./arrayUtils";
import { Cells, Vertices, Voronoi, Point } from "../modules/voronoi";

/**
 * Get boundary points on a regular square grid
 * @param {number} width - The width of the area
 * @param {number} height - The height of the area
 * @param {number} spacing - The spacing between points
 * @returns {Array} - An array of boundary points
 */
const getBoundaryPoints = (width: number, height: number, spacing: number): Point[] => {
  const offset = rn(-1 * spacing);
  const bSpacing = spacing * 2;
  const w = width - offset * 2;
  const h = height - offset * 2;
  const numberX = Math.ceil(w / bSpacing) - 1;
  const numberY = Math.ceil(h / bSpacing) - 1;
  const points: Point[] = [];

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

/**
 * Get points on a jittered square grid
 * @param {number} width - The width of the area
 * @param {number} height - The height of the area
 * @param {number} spacing - The spacing between points
 * @returns {Array} - An array of jittered grid points
 */
const getJitteredGrid = (width: number, height: number, spacing: number): Point[] => {
  const radius = spacing / 2; // square radius
  const jittering = radius * 0.9; // max deviation
  const doubleJittering = jittering * 2;
  const jitter = () => Math.random() * doubleJittering - jittering;

  let points: Point[] = [];
  for (let y = radius; y < height; y += spacing) {
    for (let x = radius; x < width; x += spacing) {
      const xj = Math.min(rn(x + jitter(), 2), width);
      const yj = Math.min(rn(y + jitter(), 2), height);
      points.push([xj, yj]);
    }
  }
  return points;
}

/**
 * Places points on a jittered grid and calculates spacing and cell counts
 * @param {number} graphWidth - The width of the graph
 * @param {number} graphHeight - The height of the graph
 * @returns {Object} - An object containing spacing, cellsDesired, boundary points, grid points, cellsX, and cellsY
 */
const placePoints = (graphWidth: number, graphHeight: number): {spacing: number, cellsDesired: number, boundary: Point[], points: Point[], cellsX: number, cellsY: number} => {
  TIME && console.time("placePoints");
  const cellsDesired = +(byId("pointsInput")?.dataset.cells || 0);
  const spacing = rn(Math.sqrt((graphWidth * graphHeight) / cellsDesired), 2); // spacing between points before jittering

  const boundary = getBoundaryPoints(graphWidth, graphHeight, spacing);
  const points = getJitteredGrid(graphWidth, graphHeight, spacing); // points of jittered square grid
  const cellCountX = Math.floor((graphWidth + 0.5 * spacing - 1e-10) / spacing); // number of cells in x direction
  const cellCountY = Math.floor((graphHeight + 0.5 * spacing - 1e-10) / spacing); // number of cells in y direction
  TIME && console.timeEnd("placePoints");

  return {spacing, cellsDesired, boundary, points, cellsX: cellCountX, cellsY: cellCountY};
}


/**
 * Checks if the grid needs to be regenerated based on desired parameters
 * @param {Object} grid - The current grid object
 * @param {number} expectedSeed - The expected seed value
 * @param {number} graphWidth - The width of the graph
 * @param {number} graphHeight - The height of the graph
 * @returns {boolean} - True if the grid should be regenerated, false otherwise
 */
export const shouldRegenerateGrid = (grid: any, expectedSeed: number, graphWidth: number, graphHeight: number) => {
  if (expectedSeed && expectedSeed !== grid.seed) return true;

  const cellsDesired = +(byId("pointsInput")?.dataset?.cells || 0);
  if (cellsDesired !== grid.cellsDesired) return true;

  const newSpacing = rn(Math.sqrt((graphWidth * graphHeight) / cellsDesired), 2);
  const newCellsX = Math.floor((graphWidth + 0.5 * newSpacing - 1e-10) / newSpacing);
  const newCellsY = Math.floor((graphHeight + 0.5 * newSpacing - 1e-10) / newSpacing);

  return grid.spacing !== newSpacing || grid.cellsX !== newCellsX || grid.cellsY !== newCellsY;
}

interface Grid {
  spacing: number;
  cellsDesired: number;
  boundary: Point[];
  points: Point[];
  cellsX: number;
  cellsY: number;
  seed: string | number;
  cells: Cells;
  vertices: Vertices;
}
/**
 * Generates a Voronoi grid based on jittered grid points
 * @returns {Object} - The generated grid object containing spacing, cellsDesired, boundary, points, cellsX, cellsY, cells, vertices, and seed
 */
export const generateGrid = (seed: string, graphWidth: number, graphHeight: number): Grid => {
  Math.random = Alea(seed); // reset PRNG
  const {spacing, cellsDesired, boundary, points, cellsX, cellsY} = placePoints(graphWidth, graphHeight);
  const {cells, vertices} = calculateVoronoi(points, boundary);
  return {spacing, cellsDesired, boundary, points, cellsX, cellsY, cells, vertices, seed};
}

/**
 * Calculates the Voronoi diagram from given points and boundary
 * @param {Array} points - The array of points for Voronoi calculation
 * @param {Array} boundary - The boundary points to clip the Voronoi cells
 * @returns {Object} - An object containing Voronoi cells and vertices
 */
export const calculateVoronoi = (points: Point[], boundary: Point[]): {cells: Cells, vertices: Vertices} => {
  TIME && console.time("calculateDelaunay");
  const allPoints = points.concat(boundary);
  const delaunay = Delaunator.from(allPoints);
  TIME && console.timeEnd("calculateDelaunay");

  TIME && console.time("calculateVoronoi");
  const voronoi = new Voronoi(delaunay, allPoints, points.length);

  const cells = voronoi.cells;
  cells.i = createTypedArray({maxValue: points.length, length: points.length}).map((_, i) => i) as Uint32Array<ArrayBufferLike>; // array of indexes
  const vertices = voronoi.vertices;
  TIME && console.timeEnd("calculateVoronoi");

  return {cells, vertices};
}

/**
 * Returns a cell index on a regular square grid based on x and y coordinates
 * @param {number} x - The x coordinate
 * @param {number} y - The y coordinate
 * @param {Object} grid - The grid object containing spacing, cellsX, and cellsY
 * @returns {number} - The index of the cell in the grid
 */
export const findGridCell = (x: number, y: number, grid: any): number => {
  return (
    Math.floor(Math.min(y / grid.spacing, grid.cellsY - 1)) * grid.cellsX +
    Math.floor(Math.min(x / grid.spacing, grid.cellsX - 1))
  );
}

/** 
 * return array of cell indexes in radius on a regular square grid
 * @param {number} x - The x coordinate
 * @param {number} y - The y coordinate
 * @param {number} radius - The search radius
 * @param {Object} grid - The grid object containing spacing, cellsX, and cellsY
 * @returns {Array} - An array of cell indexes within the specified radius
 */
export const findGridAll = (x: number, y: number, radius: number, grid: any): number[] => {
  const c = grid.cells.c;
  let r = Math.floor(radius / grid.spacing);
  let found = [findGridCell(x, y, grid)];
  if (!r || radius === 1) return found;
  if (r > 0) found = found.concat(c[found[0]]);
  if (r > 1) {
    let frontier = c[found[0]];
    while (r > 1) {
      let cycle = frontier.slice();
      frontier = [];
      cycle.forEach(function (s: number) {
        c[s].forEach(function (e: number) {
          if (found.indexOf(e) !== -1) return;
          found.push(e);
          frontier.push(e);
        });
      });
      r--;
    }
  }

  return found;
}

/**
 * Returns the index of the packed cell containing the given x and y coordinates
 * @param {number} x - The x coordinate
 * @param {number} y - The y coordinate
 * @param {number} radius - The search radius (default is Infinity)
 * @returns {number|undefined} - The index of the found cell or undefined if not found
 */
export const findClosestCell = (x: number, y: number, radius = Infinity, packedGraph: any): number | undefined => {
  if (!packedGraph.cells?.q) return;
  const found = packedGraph.cells.q.find(x, y, radius);
  return found ? found[2] : undefined;
}

/**
 * Returns an array of packed cell indexes within a specified radius from given x and y coordinates
 * @param {number} x - The x coordinate
 * @param {number} y - The y coordinate
 */
export const findAllCellsInRadius = (x: number, y: number, radius: number, packedGraph: any): number[] => {
  const found = packedGraph.cells.q.findAll(x, y, radius);
  return found.map((r: any) => r[2]);
}

/**
 * Returns the polygon points for a packed cell given its index
 * @param {number} i - The index of the packed cell
 * @returns {Array} - An array of polygon points for the specified cell
 */
export const getPackPolygon = (cellIndex: number, packedGraph: any) => {
  return packedGraph.cells.v[cellIndex].map((v: number) => packedGraph.vertices.p[v]);
}

/**
 * Returns the polygon points for a grid cell given its index
 * @param {number} i - The index of the grid cell
 * @returns {Array} - An array of polygon points for the specified grid cell
 */
export const getGridPolygon = (i: number, grid: any) => {
  return grid.cells.v[i].map((v: number) => grid.vertices.p[v]);
}

/**
 * mbostock's poissonDiscSampler implementation
 * Generates points using Poisson-disc sampling within a specified rectangle
 * @param {number} x0 - The minimum x coordinate of the rectangle
 * @param {number} y0 - The minimum y coordinate of the rectangle
 * @param {number} x1 - The maximum x coordinate of the rectangle
 * @param {number} y1 - The maximum y coordinate of the rectangle
 * @param {number} r - The minimum distance between points
 * @param {number} k - The number of attempts before rejection (default is 3)
 * @yields {Array} - An array containing the x and y coordinates of a generated point
 */
export function* poissonDiscSampler(x0: number, y0: number, x1: number, y1: number, r: number, k = 3) {
  if (!(x1 >= x0) || !(y1 >= y0) || !(r > 0)) throw new Error();

  const width = x1 - x0;
  const height = y1 - y0;
  const r2 = r * r;
  const r2_3 = 3 * r2;
  const cellSize = r * Math.SQRT1_2;
  const gridWidth = Math.ceil(width / cellSize);
  const gridHeight = Math.ceil(height / cellSize);
  const grid = new Array(gridWidth * gridHeight);
  const queue: [number, number][] = [];

  function far(x: number, y: number) {
    const i = (x / cellSize) | 0;
    const j = (y / cellSize) | 0;
    const i0 = Math.max(i - 2, 0);
    const j0 = Math.max(j - 2, 0);
    const i1 = Math.min(i + 3, gridWidth);
    const j1 = Math.min(j + 3, gridHeight);
    for (let j = j0; j < j1; ++j) {
      const o = j * gridWidth;
      for (let i = i0; i < i1; ++i) {
        const s = grid[o + i];
        if (s) {
          const dx = s[0] - x;
          const dy = s[1] - y;
          if (dx * dx + dy * dy < r2) return false;
        }
      }
    }
    return true;
  }

  function sample(x: number, y: number) {
    const point: [number, number] = [x, y];
    queue.push((grid[gridWidth * ((y / cellSize) | 0) + ((x / cellSize) | 0)] = point));
    return [x + x0, y + y0];
  }

  yield sample(width / 2, height / 2);

  pick: while (queue.length) {
    const i = (Math.random() * queue.length) | 0;
    const parent = queue[i];

    for (let j = 0; j < k; ++j) {
      const a = 2 * Math.PI * Math.random();
      const r = Math.sqrt(Math.random() * r2_3 + r2);
      const x = parent[0] + r * Math.cos(a);
      const y = parent[1] + r * Math.sin(a);
      if (0 <= x && x < width && 0 <= y && y < height && far(x, y)) {
        yield sample(x, y);
        continue pick;
      }
    }

    const r = queue.pop();
    if (r !== undefined && i < queue.length) queue[i] = r;
  }
}

/**
 * Checks if a packed cell is land based on its height
 * @param {number} i - The index of the packed cell
 * @returns {boolean} - True if the cell is land, false otherwise
 */
export const isLand = (i: number, packedGraph: any) => {
  return packedGraph.cells.h[i] >= 20;
}

/**
 * Checks if a packed cell is water based on its height
 * @param {number} i - The index of the packed cell
 * @returns {boolean} - True if the cell is water, false otherwise
 */
export const isWater = (i: number, packedGraph: any) => {
  return packedGraph.cells.h[i] < 20;
}

export const findAllInQuadtree = (x: number, y: number, radius: number, quadtree: any) => {
  const radiusSearchInit = (t: any, radius: number) => {
    t.result = [];
    (t.x0 = t.x - radius), (t.y0 = t.y - radius);
    (t.x3 = t.x + radius), (t.y3 = t.y + radius);
    t.radius = radius * radius;
  };

  const radiusSearchVisit = (t: any, d2: number) => {
    t.node.data.scanned = true;
    if (d2 < t.radius) {
      do {
        t.result.push(t.node.data);
        t.node.data.selected = true;
      } while ((t.node = t.node.next));
    }
  };

  class Quad {
    node: any;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    constructor(node: any, x0: number, y0: number, x1: number, y1: number) {
      this.node = node;
      this.x0 = x0;
      this.y0 = y0;
      this.x1 = x1;
      this.y1 = y1;
    }
  }

  const t: any = {x, y, x0: quadtree._x0, y0: quadtree._y0, x3: quadtree._x1, y3: quadtree._y1, quads: [], node: quadtree._root};
  if (t.node) t.quads.push(new Quad(t.node, t.x0, t.y0, t.x3, t.y3));
  radiusSearchInit(t, radius);

  var i = 0;
  while ((t.q = t.quads.pop())) {
    i++;

    // Stop searching if this quadrant can’t contain a closer node.
    if (
      !(t.node = t.q.node) ||
      (t.x1 = t.q.x0) > t.x3 ||
      (t.y1 = t.q.y0) > t.y3 ||
      (t.x2 = t.q.x1) < t.x0 ||
      (t.y2 = t.q.y1) < t.y0
    )
      continue;

    // Bisect the current quadrant.
    if (t.node.length) {
      t.node.explored = true;
      var xm: number = (t.x1 + t.x2) / 2,
        ym: number = (t.y1 + t.y2) / 2;

      t.quads.push(
        new Quad(t.node[3], xm, ym, t.x2, t.y2),
        new Quad(t.node[2], t.x1, ym, xm, t.y2),
        new Quad(t.node[1], xm, t.y1, t.x2, ym),
        new Quad(t.node[0], t.x1, t.y1, xm, ym)
      );

      // Visit the closest quadrant first.
      if ((t.i = (+(y >= ym) << 1) | +(x >= xm))) {
        t.q = t.quads[t.quads.length - 1];
        t.quads[t.quads.length - 1] = t.quads[t.quads.length - 1 - t.i];
        t.quads[t.quads.length - 1 - t.i] = t.q;
      }
    }

    // Visit this point. (Visiting coincident points isn’t necessary!)
    else {
      var dx = x - +quadtree._x.call(null, t.node.data),
        dy = y - +quadtree._y.call(null, t.node.data),
        d2 = dx * dx + dy * dy;
      radiusSearchVisit(t, d2);
    }
  }
  return t.result;
}

// draw raster heightmap preview (not used in main generation)
/**
 * Draws a raster heightmap preview based on given heights and rendering options
 * @param {Object} options - The options for drawing the heightmap
 * @param {Array} options.heights - The array of height values
 * @param {number} options.width - The width of the heightmap
 * @param {number} options.height - The height of the heightmap
 * @param {Function} options.scheme - The color scheme function for rendering heights
 * @param {boolean} options.renderOcean - Whether to render ocean heights
 * @returns {string} - A data URL representing the drawn heightmap image
 */
export const drawHeights = ({heights, width, height, scheme, renderOcean}: {heights: number[], width: number, height: number, scheme: (value: number) => string, renderOcean: boolean}) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(width, height);

  const getHeight = (height: number) => (height < 20 ? (renderOcean ? height : 0) : height);

  for (let i = 0; i < heights.length; i++) {
    const colorScheme = scheme(1 - getHeight(heights[i]) / 100);
    const {r, g, b} = color(colorScheme)!.rgb();

    const n = i * 4;
    imageData.data[n] = r;
    imageData.data[n + 1] = g;
    imageData.data[n + 2] = b;
    imageData.data[n + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

declare global {
  var TIME: boolean;
  interface Window {
    
    shouldRegenerateGrid: typeof shouldRegenerateGrid;
    generateGrid: typeof generateGrid;
    findCell: typeof findClosestCell;
    findGridCell: typeof findGridCell;
    findGridAll: typeof findGridAll;
    calculateVoronoi: typeof calculateVoronoi;
    findAll: typeof findAllCellsInRadius;
    getPackPolygon: typeof getPackPolygon;
    getGridPolygon: typeof getGridPolygon;
    poissonDiscSampler: typeof poissonDiscSampler;
    isLand: typeof isLand;
    isWater: typeof isWater;
    findAllInQuadtree: typeof findAllInQuadtree;
    drawHeights: typeof drawHeights;
  }
}