import Delaunator from "delaunator";

import {dist2} from "utils/functionUtils";

// Urquhart graph is obtained by removing the longest edge from each triangle in the Delaunay triangulation
// this gives us an aproximation of a desired road network, i.e. connections between burgs
// code from https://observablehq.com/@mbostock/urquhart-graph
export function calculateUrquhartEdges(points: TPoints) {
  const score = (p0: number, p1: number) => dist2(points[p0], points[p1]);

  const {halfedges, triangles} = Delaunator.from(points);
  const n = triangles.length;

  const removed = new Uint8Array(n);
  const edges = [];

  for (let e = 0; e < n; e += 3) {
    const p0 = triangles[e],
      p1 = triangles[e + 1],
      p2 = triangles[e + 2];

    const p01 = score(p0, p1),
      p12 = score(p1, p2),
      p20 = score(p2, p0);

    removed[
      p20 > p01 && p20 > p12
        ? Math.max(e + 2, halfedges[e + 2])
        : p12 > p01 && p12 > p20
        ? Math.max(e + 1, halfedges[e + 1])
        : Math.max(e, halfedges[e])
    ] = 1;
  }

  for (let e = 0; e < n; ++e) {
    if (e > halfedges[e] && !removed[e]) {
      const t0 = triangles[e];
      const t1 = triangles[e % 3 === 2 ? e - 2 : e + 1];
      edges.push([t0, t1]);
    }
  }

  return edges;
}
