// creates a Voronoi diagram from the given Delaunator, a list of points, and the number of points
// based on https://mapbox.github.io/delaunator

interface Delaunay {
  triangles: Uint32Array;
  halfedges: Int32Array;
}

type Number3 = [number, number, number];

export class Voronoi {
  private readonly delaunay: Delaunay;
  private readonly points: TPoints;
  private readonly pointsN: number;

  // voronoi cells: v = cell vertices, c = adjacent cells, b = near-border cell
  public readonly cells: {v: number[][]; c: number[][]; b: (0 | 1)[]};

  // cells vertices: p = vertex coordinates, v = neighboring vertices, c = adjacent cells
  public readonly vertices: {p: TPoints; v: Number3[]; c: Number3[]};

  constructor(delaunay: Delaunay, points: TPoints, pointsN: number) {
    this.delaunay = delaunay;
    this.points = points;
    this.pointsN = pointsN;
    this.cells = {v: [], c: [], b: []};
    this.vertices = {p: [], v: [], c: []};

    // Half-edges are the indices into the delaunator outputs:
    // delaunay.triangles[e] gives the point ID where the half-edge starts
    // delaunay.halfedges[e] returns either the opposite half-edge in the adjacent triangle, or -1 if there's not an adjacent triangle
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

  // Gets the indices of all the incoming and outgoing half-edges that touch the given point
  edgesAroundPoint(start: number): number[] {
    const result = [];
    let incoming = start;
    do {
      result.push(incoming);
      const outgoing = this.nextHalfedge(incoming);
      incoming = this.delaunay.halfedges[outgoing];
    } while (incoming !== -1 && incoming !== start && result.length < 20);
    return result;
  }

  // Retrieves all of the half-edges for a specific triangle
  edgesOfTriangle(t: number): Number3 {
    return [3 * t, 3 * t + 1, 3 * t + 2];
  }

  // Gets the IDs of the points comprising the given triangle
  pointsOfTriangle(t: number) {
    return this.edgesOfTriangle(t).map(edge => this.delaunay.triangles[edge]) as Number3;
  }

  // Identifies what triangles are adjacent to the given triangle
  trianglesAdjacentToTriangle(t: number) {
    let triangles = [];
    for (let edge of this.edgesOfTriangle(t)) {
      let opposite = this.delaunay.halfedges[edge];
      triangles.push(this.triangleOfEdge(opposite));
    }
    return triangles as Number3;
  }

  // Returns the center of the triangle located at the given index.
  triangleCenter(t: number): TPoint {
    let vertices = this.pointsOfTriangle(t).map(p => this.points[p]);
    return this.circumcenter(vertices);
  }

  // Enables lookup of a triangle, given one of the half-edges of that triangle
  triangleOfEdge(e: number): number {
    return Math.floor(e / 3);
  }

  // Moves to the next half-edge of a triangle, given the current half-edge's index
  nextHalfedge(e: number): number {
    return e % 3 === 2 ? e - 2 : e + 1;
  }

  // Moves to the previous half-edge of a triangle, given the current half-edge's index
  prevHalfedge(e: number): number {
    return e % 3 === 0 ? e + 2 : e - 1;
  }

  // Finds the circumcenter of the triangle identified by points a, b, and c
  circumcenter([[ax, ay], [bx, by], [cx, cy]]: TPoint[]): TPoint {
    const ad = ax * ax + ay * ay;
    const bd = bx * bx + by * by;
    const cd = cx * cx + cy * cy;
    const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    return [
      Math.floor((1 / D) * (ad * (by - cy) + bd * (cy - ay) + cd * (ay - by))),
      Math.floor((1 / D) * (ad * (cx - bx) + bd * (ax - cx) + cd * (bx - ax)))
    ];
  }
}
