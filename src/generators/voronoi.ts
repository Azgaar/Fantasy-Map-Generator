import Delaunator from "delaunator";
import type { Point } from "@/types/global";

export type { Point } from "@/types/global";

export type Vertices = { p: Point[]; v: number[][]; c: number[][] };
export type Cells = {
  v: number[][];
  c: number[][];
  b: number[];
  i: Uint32Array<ArrayBufferLike>;
};

/**
 * Creates a Voronoi diagram from the given Delaunator, a list of points, and the number of points. The Voronoi diagram is constructed using (I think) the {@link https://en.wikipedia.org/wiki/Bowyer%E2%80%93Watson_algorithm |Bowyer-Watson Algorithm}
 * The {@link https://github.com/mapbox/delaunator/ |Delaunator} library uses {@link https://en.wikipedia.org/wiki/Doubly_connected_edge_list |half-edges} to represent the relationship between points and triangles.
 * @param {{triangles: Uint32Array, halfedges: Int32Array}} delaunay A {@link https://github.com/mapbox/delaunator/blob/master/index.js |Delaunator} instance.
 * @param {Point[]} points A list of coordinates.
 * @param {number} pointsN The number of points.
 */
export class Voronoi {
  delaunay: Delaunator<Float64Array<ArrayBufferLike>>;
  points: Point[];
  pointsN: number;
  cells: Cells = { v: [], c: [], b: [], i: new Uint32Array() }; // voronoi cells: v = cell vertices, c = adjacent cells, b = near-border cell, i = cell indexes;
  vertices: Vertices = { p: [], v: [], c: [] }; // cells vertices: p = vertex coordinates, v = neighboring vertices, c = adjacent cells

  constructor(delaunay: Delaunator<Float64Array<ArrayBufferLike>>, points: Point[], pointsN: number) {
    this.delaunay = delaunay;
    this.points = points;
    this.pointsN = pointsN;
    this.vertices;

    // Half-edges are the indices into the delaunator outputs:
    // delaunay.triangles[e] gives the point ID where the half-edge starts
    // delaunay.halfedges[e] returns either the opposite half-edge in the adjacent triangle, or -1 if there's not an adjacent triangle.
    for (let e = 0; e < this.delaunay.triangles.length; e++) {
      const p = this.delaunay.triangles[this.nextHalfedge(e)];
      if (p < this.pointsN && !this.cells.c[p]) {
        const edges = this.edgesAroundPoint(e);
        this.cells.v[p] = edges.map(e => this.triangleOfEdge(e)); // cell: adjacent vertex
        this.cells.c[p] = edges.map(e => this.delaunay.triangles[e]).filter(c => c < this.pointsN); // cell: adjacent valid cells
        this.cells.b[p] = edges.length > this.cells.c[p].length ? 1 : 0; // cell: is border
      }

      const t = this.triangleOfEdge(e);
      if (!this.vertices.p[t]) {
        this.vertices.p[t] = this.triangleCenter(t); // vertex: coordinates
        this.vertices.v[t] = this.trianglesAdjacentToTriangle(t); // vertex: adjacent vertices
        this.vertices.c[t] = this.pointsOfTriangle(t); // vertex: adjacent cells
      }
    }
  }

  /**
   * Gets the IDs of the points comprising the given triangle. Taken from {@link https://mapbox.github.io/delaunator/#triangle-to-points| the Delaunator docs.}
   * @param {number} t The index of the triangle
   * @returns {[number, number, number]} The IDs of the points comprising the given triangle.
   */
  private pointsOfTriangle(triangleIndex: number): [number, number, number] {
    return this.edgesOfTriangle(triangleIndex).map(edge => this.delaunay.triangles[edge]) as [number, number, number];
  }

  /**
   * Identifies what triangles are adjacent to the given triangle. Taken from {@link https://mapbox.github.io/delaunator/#triangle-to-triangles| the Delaunator docs.}
   * @param {number} triangleIndex The index of the triangle
   * @returns {number[]} The indices of the triangles that share half-edges with this triangle.
   */
  private trianglesAdjacentToTriangle(triangleIndex: number): number[] {
    const triangles = [];
    for (const edge of this.edgesOfTriangle(triangleIndex)) {
      const opposite = this.delaunay.halfedges[edge];
      triangles.push(this.triangleOfEdge(opposite));
    }
    return triangles;
  }

  /**
   * Gets the indices of all the incoming and outgoing half-edges that touch the given point. Taken from {@link https://mapbox.github.io/delaunator/#point-to-edges| the Delaunator docs.}
   * @param {number} start The index of an incoming half-edge that leads to the desired point
   * @returns {[number, number, number]} The indices of all half-edges (incoming or outgoing) that touch the point.
   */
  private edgesAroundPoint(start: number): [number, number, number] {
    const result = [];
    let incoming = start;
    do {
      result.push(incoming);
      const outgoing = this.nextHalfedge(incoming);
      incoming = this.delaunay.halfedges[outgoing];
    } while (incoming !== -1 && incoming !== start && result.length < 20);
    return result as [number, number, number];
  }

  /**
   * Returns the center of the triangle located at the given index.
   * @param {number} triangleIndex The index of the triangle
   * @returns {Point} The coordinates of the triangle's circumcenter.
   */
  private triangleCenter(triangleIndex: number): Point {
    const vertices = this.pointsOfTriangle(triangleIndex).map(p => this.points[p]);
    return this.circumcenter(vertices[0], vertices[1], vertices[2]);
  }

  /**
   * Retrieves all of the half-edges for a specific triangle `triangleIndex`. Taken from {@link https://mapbox.github.io/delaunator/#edge-and-triangle| the Delaunator docs.}
   * @param {number} triangleIndex The index of the triangle
   * @returns {[number, number, number]} The edges of the triangle.
   */
  private edgesOfTriangle(triangleIndex: number): [number, number, number] {
    return [3 * triangleIndex, 3 * triangleIndex + 1, 3 * triangleIndex + 2];
  }

  /**
   * Enables lookup of a triangle, given one of the half-edges of that triangle. Taken from {@link https://mapbox.github.io/delaunator/#edge-and-triangle| the Delaunator docs.}
   * @param {number} e The index of the edge
   * @returns {number} The index of the triangle
   */
  private triangleOfEdge(e: number): number {
    return Math.floor(e / 3);
  }

  /**
   * Moves to the next half-edge of a triangle, given the current half-edge's index. Taken from {@link https://mapbox.github.io/delaunator/#edge-to-edges| the Delaunator docs.}
   * @param {number} e The index of the current half edge
   * @returns {number} The index of the next half edge
   */
  private nextHalfedge(e: number): number {
    return e % 3 === 2 ? e - 2 : e + 1;
  }

  /**
   * Moves to the previous half-edge of a triangle, given the current half-edge's index. Taken from {@link https://mapbox.github.io/delaunator/#edge-to-edges| the Delaunator docs.}
   * @param {number} e The index of the current half edge
   * @returns {number} The index of the previous half edge
   */
  // private prevHalfedge(e: number): number { return (e % 3 === 0) ? e + 2 : e - 1; }

  /**
   * Finds the circumcenter of the triangle identified by points a, b, and c. Taken from {@link https://en.wikipedia.org/wiki/Circumscribed_circle#Circumcenter_coordinates| Wikipedia}
   * @param {[number, number]} a The coordinates of the first point of the triangle
   * @param {[number, number]} b The coordinates of the second point of the triangle
   * @param {[number, number]} c The coordinates of the third point of the triangle
   * @return {[number, number]} The coordinates of the circumcenter of the triangle.
   */
  private circumcenter(a: Point, b: Point, c: Point): Point {
    const [ax, ay] = a;
    const [bx, by] = b;
    const [cx, cy] = c;
    const ad = ax * ax + ay * ay;
    const bd = bx * bx + by * by;
    const cd = cx * cx + cy * cy;
    const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    return [
      (1 / D) * (ad * (by - cy) + bd * (cy - ay) + cd * (ay - by)),
      (1 / D) * (ad * (cx - bx) + bd * (ax - cx) + cd * (bx - ax))
    ];
  }
}

/**
 * Builds the Voronoi diagram for the given points, using the boundary pseudo-points to clip the outer cells
 * @param points - cell points
 * @param boundary - pseudo-points along the map edge, they get no cells of their own
 * @param wrapWidth - map width to join the west and east edges into a cylinder, 0 for a flat map
 */
export const calculateVoronoi = (
  points: Point[],
  boundary: Point[],
  wrapWidth = 0
): { cells: Cells; vertices: Vertices } => {
  if (wrapWidth) return calculateWrappedVoronoi(points, boundary, wrapWidth);

  TIME && console.time("calculateDelaunay");
  const allPoints = points.concat(boundary);
  const delaunay = Delaunator.from(allPoints);
  TIME && console.timeEnd("calculateDelaunay");

  TIME && console.time("calculateVoronoi");
  const { cells, vertices } = new Voronoi(delaunay, allPoints, points.length);
  cells.i = Uint32Array.from({ length: points.length }, (_, i) => i);
  TIME && console.timeEnd("calculateVoronoi");

  return { cells, vertices };
};

/**
 * Voronoi diagram of a map whose west and east edges meet: sites near an edge are copied past the opposite one,
 * so seam cells get their neighbors across it. Each triangle the copies duplicate is kept once, as the image
 * whose lowest-id site is not a copy. Vertex coordinates are wrapped into [0, width)
 */
const calculateWrappedVoronoi = (points: Point[], boundary: Point[], width: number) => {
  TIME && console.time("calculateWrappedVoronoi");
  const pointsN = points.length;
  const sites = points.concat(boundary);
  const sitesN = sites.length;

  // the copied band must hold the circumcircle of every triangle at a cell, sparse points need a wider one
  let margin = (3 * width) / Math.sqrt(pointsN);
  let triangulation = triangulateWrapped(sites, pointsN, width, margin);
  while (!triangulation) {
    margin *= 2;
    triangulation = triangulateWrapped(sites, pointsN, width, margin);
  }
  const { all, origin, triangles, halfedges, centers } = triangulation;

  const trianglesN = triangles.length / 3;
  const next = (e: number) => (e % 3 === 2 ? e - 2 : e + 1);
  const trianglePoints = (t: number) => [triangles[3 * t], triangles[3 * t + 1], triangles[3 * t + 2]];

  // a triangle of sites far from the edges has no images: its own index is the key
  const inner = (p: number) => p < sitesN && all[p][0] >= margin && all[p][0] <= width - margin;
  const keyOf = (t: number): number | string => {
    const tri = trianglePoints(t);
    if (tri.every(inner)) return t;
    return tri
      .map(p => origin[p])
      .sort((a, b) => a - b)
      .join();
  };

  const vertexIds = new Map<number | string, number>();
  const kept: number[] = []; // vertex id -> triangle
  for (let t = 0; t < trianglesN; t++) {
    const tri = trianglePoints(t);
    if (tri.every(p => origin[p] >= pointsN)) continue; // touches no cell
    const lowest = tri.reduce((a, b) => (origin[a] < origin[b] ? a : b));
    if (lowest >= sitesN) continue; // an image
    const key = keyOf(t);
    if (vertexIds.has(key)) continue;
    vertexIds.set(key, kept.length);
    kept.push(t);
  }

  const vertexOf = (t: number) => {
    const id = vertexIds.get(keyOf(t));
    if (id === undefined) throw new Error(`Wrapped Voronoi: triangle ${t} has no kept image`);
    return id;
  };

  const inedges = new Int32Array(all.length).fill(-1);
  for (let e = 0; e < triangles.length; e++) {
    const p = triangles[next(e)];
    if (halfedges[e] === -1 || inedges[p] === -1) inedges[p] = e;
  }

  const cells: Cells = { v: [], c: [], b: [], i: Uint32Array.from({ length: pointsN }, (_, i) => i) };
  for (let p = 0; p < pointsN; p++) {
    const edges: number[] = [];
    const start = inedges[p];
    let incoming = start;
    do {
      edges.push(incoming);
      incoming = halfedges[next(incoming)];
    } while (incoming !== -1 && incoming !== start && edges.length < 20);

    const around = edges.map(e => origin[triangles[e]]);
    cells.v[p] = edges.map(e => vertexOf(Math.floor(e / 3)));
    cells.c[p] = around.filter(c => c < pointsN);
    cells.b[p] = around.length > cells.c[p].length ? 1 : 0;
  }

  const vertices: Vertices = { p: [], v: [], c: [] };
  kept.forEach((t, id) => {
    const [x, y] = centers[t];
    vertices.p[id] = [x - Math.floor(x / width) * width, y];
    vertices.c[id] = trianglePoints(t).map(p => origin[p]);
    vertices.v[id] = [0, 1, 2].map(k => {
      const opposite = halfedges[3 * t + k];
      if (opposite === -1) return -1;
      const neighbor = Math.floor(opposite / 3);
      return trianglePoints(neighbor).every(p => origin[p] >= pointsN) ? -1 : vertexOf(neighbor);
    });
  });

  TIME && console.timeEnd("calculateWrappedVoronoi");
  return { cells, vertices };
};

/** Delaunay triangulation of the sites and their copies within the margin past each edge, null if the margin is too narrow */
const triangulateWrapped = (sites: Point[], pointsN: number, width: number, margin: number) => {
  const all = sites.slice();
  const origin = Array.from(sites, (_, i) => i);
  const addImage = (x: number, y: number, siteId: number) => {
    all.push([x, y]);
    origin.push(siteId);
  };
  sites.forEach(([x, y], i) => {
    if (x < margin) addImage(x + width, y, i);
    if (x > width - margin) addImage(x - width, y, i);
  });

  const { triangles, halfedges } = Delaunator.from(all);
  const centers: Point[] = [];
  const isFullCopy = margin >= width; // every site has images on both sides: nothing wider to try

  for (let t = 0; t < triangles.length / 3; t++) {
    const a = all[triangles[3 * t]];
    const b = all[triangles[3 * t + 1]];
    const c = all[triangles[3 * t + 2]];
    const [ax, ay] = a;
    const [bx, by] = b;
    const [cx, cy] = c;
    const ad = ax * ax + ay * ay;
    const bd = bx * bx + by * by;
    const cd = cx * cx + cy * cy;
    const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    const x = (ad * (by - cy) + bd * (cy - ay) + cd * (ay - by)) / D;
    const y = (ad * (cx - bx) + bd * (ax - cx) + cd * (bx - ax)) / D;
    centers[t] = [x, y];

    if (isFullCopy) continue;
    const touchesCell = [0, 1, 2].some(k => triangles[3 * t + k] < pointsN);
    if (!touchesCell) continue;
    const radius = Math.hypot(ax - x, ay - y);
    if (x - radius < -margin || x + radius > width + margin) return null;
  }

  return { all, origin, triangles, halfedges, centers };
};
