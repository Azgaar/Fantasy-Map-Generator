import type Delaunator from "delaunator";
export type Vertices = { p: Point[]; v: number[][]; c: number[][] };
export type Cells = {
  v: number[][];
  c: number[][];
  b: number[];
  i: Uint32Array<ArrayBufferLike>;
};
export type Point = [number, number];

/**
 * Creates a Voronoi diagram from the given Delaunator, a list of points, and the number of points. The Voronoi diagram is constructed using (I think) the {@link https://en.wikipedia.org/wiki/Bowyer%E2%80%93Watson_algorithm |Bowyer-Watson Algorithm}
 * The {@link https://github.com/mapbox/delaunator/ |Delaunator} library uses {@link https://en.wikipedia.org/wiki/Doubly_connected_edge_list |half-edges} to represent the relationship between points and triangles.
 * @param {{triangles: Uint32Array, halfedges: Int32Array}} delaunay A {@link https://github.com/mapbox/delaunator/blob/master/index.js |Delaunator} instance.
 * @param {[number, number][]} points A list of coordinates.
 * @param {number} pointsN The number of points.
 */
export class Voronoi {
  delaunay: Delaunator<Float64Array<ArrayBufferLike>>;
  points: Point[];
  pointsN: number;
  cells: Cells = { v: [], c: [], b: [], i: new Uint32Array() }; // voronoi cells: v = cell vertices, c = adjacent cells, b = near-border cell, i = cell indexes;
  vertices: Vertices = { p: [], v: [], c: [] }; // cells vertices: p = vertex coordinates, v = neighboring vertices, c = adjacent cells

  constructor(
    delaunay: Delaunator<Float64Array<ArrayBufferLike>>,
    points: Point[],
    pointsN: number,
  ) {
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
        this.cells.v[p] = edges.map((e) => this.triangleOfEdge(e)); // cell: adjacent vertex
        this.cells.c[p] = edges
          .map((e) => this.delaunay.triangles[e])
          .filter((c) => c < this.pointsN); // cell: adjacent valid cells
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
    return this.edgesOfTriangle(triangleIndex).map(
      (edge) => this.delaunay.triangles[edge],
    ) as [number, number, number];
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
   * @returns {[number, number]} The coordinates of the triangle's circumcenter.
   */
  private triangleCenter(triangleIndex: number): Point {
    const vertices = this.pointsOfTriangle(triangleIndex).map(
      (p) => this.points[p],
    );
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
      Math.floor((1 / D) * (ad * (by - cy) + bd * (cy - ay) + cd * (ay - by))),
      Math.floor((1 / D) * (ad * (cx - bx) + bd * (ax - cx) + cd * (bx - ax))),
    ];
  }
}
