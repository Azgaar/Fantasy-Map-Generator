class Voronoi {
  /**
   * Creates a Voronoi diagram from the given Delaunator, a list of points, and the number of points. The Voronoi diagram is constructed using (I think) the {@link https://en.wikipedia.org/wiki/Bowyer%E2%80%93Watson_algorithm|Bowyer-Watson Algorithm}
   * @param {{triangles: Uint32Array, halfedges: Int32Array}} delaunay A {@link https://github.com/mapbox/delaunator/blob/master/index.js|Delaunator} instance
   * @param {[number, number][]} points A list of coordinates. 
   * @param {number} pointsN The number of points.
   */
  constructor(delaunay, points, pointsN) {
    this.delaunay = delaunay;
    this.points = points;
    this.pointsN = pointsN;
    this.cells = { v: [], c: [], b: [] }; // voronoi cells: v = cell vertices, c = adjacent cells, b = near-border cell
    this.vertices = { p: [], v: [], c: [] }; // cells vertices: p = vertex coordinates, v = neighboring vertices, c = adjacent cells

    for (let e = 0; e < this.delaunay.triangles.length; e++) {

      const p = this.delaunay.triangles[this.nextHalfedge(e)];
      if (p < this.pointsN && !this.cells.c[p]) {
        const edges = this.edgesAroundPoint(e);
        this.cells.v[p] = edges.map(e => this.triangleOfEdge(e));                                   // cell: adjacent vertex
        this.cells.c[p] = edges.map(e => this.delaunay.triangles[e]).filter(c => c < this.pointsN); // cell: adjacent valid cells
        this.cells.b[p] = edges.length > this.cells.c[p].length ? 1 : 0;                            // cell: is border
      }

      const t = this.triangleOfEdge(e);
      if (!this.vertices.p[t]) {
        this.vertices.p[t] = this.triangleCenter(t);              // vertex: coordinates
        this.vertices.v[t] = this.trianglesAdjacentToTriangle(t); // vertex: adjacent vertices
        this.vertices.c[t] = this.pointsOfTriangle(t);            // vertex: adjacent cells
      }
    }
  }

  /**
   * 
   * @param {number} t The index of the triangle
   * @returns {[number, number, number]}
   */
  pointsOfTriangle(t) {
    return this.edgesOfTriangle(t).map(edge => this.delaunay.triangles[edge]);
  }

  /**
   * Identifies what triangles are adjacent to the given triangle
   * @param {number} t The index of the triangle
   * @returns {number[]}
   */
  trianglesAdjacentToTriangle(t) {
    let triangles = [];
    for (let edge of this.edgesOfTriangle(t)) {
      let opposite = this.delaunay.halfedges[edge];
      triangles.push(this.triangleOfEdge(opposite));
    }
    return triangles;
  }

  /**
   * 
   * @param {number} start 
   * @returns {number[]}
   */
  edgesAroundPoint(start) {
    const result = [];
    let incoming = start;
    do {
      result.push(incoming);
      const outgoing = this.nextHalfedge(incoming);
      incoming = this.delaunay.halfedges[outgoing];
    } while (incoming !== -1 && incoming !== start && result.length < 20);
    return result;
  }

  /**
   * Returns the center of the triangle located at the given index.
   * @param {number} t The index of the triangle
   * @returns {number}
   */
  triangleCenter(t) {
    let vertices = this.pointsOfTriangle(t).map(p => this.points[p]);
    return this.circumcenter(vertices[0], vertices[1], vertices[2]);
  }

  /**
   * Gets all of the edges of a triangle starting at index t
   * @param {number} t The index of the triangle
   * @returns {[number, number, number]} The edges of the triangle
   */
  edgesOfTriangle(t) { return [3 * t, 3 * t + 1, 3 * t + 2]; }

  /**
   * Identifies the triangle that corresponds to the given edge index
   * @param {number} e The index of the edge
   * @returns {number} The index of the triangle
   */
  triangleOfEdge(e) { return Math.floor(e / 3); }
  /**
   * Determines the index of the next half edge of the current triangle in the this.delaunay.triangles array
   * @param {number} e The index of the current half edge
   * @returns {number} The index of the next half edge
   */
  nextHalfedge(e) { return (e % 3 === 2) ? e - 2 : e + 1; }
  /**
   * Determines the index of the previous half edge of the current triangle in the this.delaunay.triangles array
   * @param {number} e The index of the current half edge
   * @returns {number} The index of the previous half edge
   */
  prevHalfedge(e) { return (e % 3 === 0) ? e + 2 : e - 1; }

  /**
   * Finds the circumcenter of the triangle identified by points a, b, and c.
   * @param {[number, number]} a
   * @param {[number, number]} b 
   * @param {[number, number]} c
   * @return {[number, number]} The coordinates of the circumcenter of the triangle.
   */
  circumcenter(a, b, c) {
    let ad = a[0] * a[0] + a[1] * a[1];
    let bd = b[0] * b[0] + b[1] * b[1];
    let cd = c[0] * c[0] + c[1] * c[1];
    let D = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    return [
      Math.floor(1 / D * (ad * (b[1] - c[1]) + bd * (c[1] - a[1]) + cd * (a[1] - b[1]))),
      Math.floor(1 / D * (ad * (c[0] - b[0]) + bd * (a[0] - c[0]) + cd * (b[0] - a[0])))
    ];
  }
}