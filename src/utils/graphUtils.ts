// @ts-nocheck
import {TIME} from "../config/logging";
import {createTypedArray} from "./arrayUtils";
import {rn} from "./numberUtils";
import {byId} from "./shorthands";

const Delaunator = window.Delaunator;
const Voronoi = window.Voronoi;
const graphWidth = window.graphWidth;
const graphHeight = window.graphHeight;

// check if new grid graph should be generated or we can use the existing one
export function shouldRegenerateGrid(grid) {
  const cellsDesired = Number(byId("pointsInput")?.dataset.cells);
  if (cellsDesired !== grid.cellsDesired) return true;

  const newSpacing = rn(Math.sqrt((graphWidth * graphHeight) / cellsDesired), 2);
  const newCellsX = Math.floor((graphWidth + 0.5 * newSpacing - 1e-10) / newSpacing);
  const newCellsY = Math.floor((graphHeight + 0.5 * newSpacing - 1e-10) / newSpacing);

  return grid.spacing !== newSpacing || grid.cellsX !== newCellsX || grid.cellsY !== newCellsY;
}

export function generateGrid() {
  Math.random = aleaPRNG(seed); // reset PRNG
  const {spacing, cellsDesired, boundary, points, cellsX, cellsY} = placePoints();
  const {cells, vertices} = calculateVoronoi(points, boundary);
  return {spacing, cellsDesired, boundary, points, cellsX, cellsY, cells, vertices};
}

// place random points to calculate Voronoi diagram
function placePoints() {
  TIME && console.time("placePoints");
  const cellsDesired = +byId("pointsInput").dataset.cells;
  const spacing = rn(Math.sqrt((graphWidth * graphHeight) / cellsDesired), 2); // spacing between points before jirrering

  const boundary = getBoundaryPoints(graphWidth, graphHeight, spacing);
  const points = getJitteredGrid(graphWidth, graphHeight, spacing); // points of jittered square grid
  const cellsX = Math.floor((graphWidth + 0.5 * spacing - 1e-10) / spacing);
  const cellsY = Math.floor((graphHeight + 0.5 * spacing - 1e-10) / spacing);
  TIME && console.timeEnd("placePoints");

  return {spacing, cellsDesired, boundary, points, cellsX, cellsY};
}

// calculate Delaunay and then Voronoi diagram
export function calculateVoronoi(points: number[][], boundary: number[][]) {
  TIME && console.time("calculateDelaunay");
  const allPoints = points.concat(boundary);
  const delaunay = Delaunator.from(allPoints);
  TIME && console.timeEnd("calculateDelaunay");

  TIME && console.time("calculateVoronoi");
  const voronoi = new Voronoi(delaunay, allPoints, points.length);

  const cells = voronoi.cells;
  cells.i = createTypedArray({maxValue: points.length, length: points.length}).map((_, i) => i); // array of indexes
  const vertices = voronoi.vertices;
  TIME && console.timeEnd("calculateVoronoi");

  return {cells, vertices};
}

// add points along map edge to pseudo-clip voronoi cells
function getBoundaryPoints(width: number, height: number, spacing: number) {
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
function getJitteredGrid(width: number, height: number, spacing: number) {
  const radius = spacing / 2; // square radius
  const jittering = radius * 0.9; // max deviation
  const doubleJittering = jittering * 2;
  const jitter = () => Math.random() * doubleJittering - jittering;

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

// return cell index on a regular square grid
export function findGridCell(x: number, y: number, grid) {
  return (
    Math.floor(Math.min(y / grid.spacing, grid.cellsY - 1)) * grid.cellsX +
    Math.floor(Math.min(x / grid.spacing, grid.cellsX - 1))
  );
}

// return array of cell indexes in radius on a regular square grid
export function findGridAll(x: number, y: number, radius: number) {
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
      cycle.forEach(function (s) {
        c[s].forEach(function (e) {
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

// return array of cell indexes in radius
export function findAll(x: number, y: number, radius: number) {
  const found = pack.cells.q.findAll(x, y, radius);
  return found.map(r => r[2]);
}

// get polygon points for packed cells knowing cell id
export function getPackPolygon(i: number) {
  return pack.cells.v[i].map(v => pack.vertices.p[v]);
}

// return closest cell index
export function findCell(x: number, y: number, radius = Infinity) {
  const found = pack.cells.q.find(x, y, radius);
  return found ? found[2] : undefined;
}

// get polygon points for initial cells knowing cell id
export function getGridPolygon(i: number) {
  return grid.cells.v[i].map(v => grid.vertices.p[v]);
}

// filter land cells
export function isLand(i: number) {
  return pack.cells.h[i] >= 20;
}

// filter water cells
export function isWater(i: number) {
  return pack.cells.h[i] < 20;
}

// findAll d3.quandtree search from https://bl.ocks.org/lwthatcher/b41479725e0ff2277c7ac90df2de2b5e
void (function addFindAll() {
  const Quad = function (node, x0, y0, x1, y1) {
    this.node = node;
    this.x0 = x0;
    this.y0 = y0;
    this.x1 = x1;
    this.y1 = y1;
  };

  const tree_filter = function (x, y, radius) {
    var t = {x, y, x0: this._x0, y0: this._y0, x3: this._x1, y3: this._y1, quads: [], node: this._root};
    if (t.node) {
      t.quads.push(new Quad(t.node, t.x0, t.y0, t.x3, t.y3));
    }
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
        var xm = (t.x1 + t.x2) / 2,
          ym = (t.y1 + t.y2) / 2;

        t.quads.push(
          new Quad(t.node[3], xm, ym, t.x2, t.y2),
          new Quad(t.node[2], t.x1, ym, xm, t.y2),
          new Quad(t.node[1], xm, t.y1, t.x2, ym),
          new Quad(t.node[0], t.x1, t.y1, xm, ym)
        );

        // Visit the closest quadrant first.
        if ((t.i = ((y >= ym) << 1) | (x >= xm))) {
          t.q = t.quads[t.quads.length - 1];
          t.quads[t.quads.length - 1] = t.quads[t.quads.length - 1 - t.i];
          t.quads[t.quads.length - 1 - t.i] = t.q;
        }
      }

      // Visit this point. (Visiting coincident points isn’t necessary!)
      else {
        var dx = x - +this._x.call(null, t.node.data),
          dy = y - +this._y.call(null, t.node.data),
          d2 = dx * dx + dy * dy;
        radiusSearchVisit(t, d2);
      }
    }
    return t.result;
  };
  d3.quadtree.prototype.findAll = tree_filter;

  var radiusSearchInit = function (t, radius) {
    t.result = [];
    (t.x0 = t.x - radius), (t.y0 = t.y - radius);
    (t.x3 = t.x + radius), (t.y3 = t.y + radius);
    t.radius = radius * radius;
  };

  var radiusSearchVisit = function (t, d2) {
    t.node.data.scanned = true;
    if (d2 < t.radius) {
      do {
        t.result.push(t.node.data);
        t.node.data.selected = true;
      } while ((t.node = t.node.next));
    }
  };
})();
