(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.Voronoi = factory());
}(this, (function () { 'use strict';

  var Voronoi = function Voronoi(delaunay, points, pointsN) {
    const cells = {v: [], c: [], b: []}; // voronoi cells: v = cell vertices, c = adjacent cells, b = near-border cell
    const vertices = {p: [], v: [], c: []}; // cells vertices: p = vertex coordinates, v = neighboring vertices, c = adjacent cells

    var trianglesLength = delaunay.triangles.length;
    for (let e=0; e < trianglesLength; e++) {

      const p = delaunay.triangles[nextHalfedge(e)];
      if (p < pointsN && !cells.c[p]) {
        const edges = edgesAroundPoint(e);
        cells.v[p] = edges.map(e => triangleOfEdge(e));                              // cell: adjacent vertex
        cells.c[p] = edges.map(e => delaunay.triangles[e]).filter(c => c < pointsN); // cell: adjacent valid cells
        cells.b[p] = edges.length > cells.c[p].length ? 1 : 0;                       // cell: is border
      }

      const t = triangleOfEdge(e);
      if (!vertices.p[t]) {
        vertices.p[t] = triangleCenter(t);              // vertex: coordinates
        vertices.v[t] = trianglesAdjacentToTriangle(t); // vertex: adjacent vertices
        vertices.c[t] = pointsOfTriangle(t);            // vertex: adjacent cells
      }
    }

    function pointsOfTriangle(t) {
      return edgesOfTriangle(t).map(e => delaunay.triangles[e]);
    }

    function trianglesAdjacentToTriangle(t) {
      let triangles = [];
      for (let e of edgesOfTriangle(t)) {
        let opposite = delaunay.halfedges[e];
        triangles.push(triangleOfEdge(opposite));
      }
      return triangles;
    }

    function edgesAroundPoint(start) {
      let result = [], incoming = start;
      do {
        result.push(incoming);
        const outgoing = nextHalfedge(incoming);
        incoming = delaunay.halfedges[outgoing];
      } while (incoming !== -1 && incoming !== start && result.length < 20);
      return result;
    }

    function triangleCenter(t) {
      let vertexPoints = pointsOfTriangle(t).map(p => points[p]);
      return circumcenter(vertexPoints[0], vertexPoints[1], vertexPoints[2]);
    }

    return {cells, vertices}

  }

  function edgesOfTriangle(t) {return [3*t, 3*t+1, 3*t+2];}

  function triangleOfEdge(e)  {return Math.floor(e/3);}

  function nextHalfedge(e) {return (e % 3 === 2) ? e-2 : e+1;}

  function prevHalfedge(e) {return (e % 3 === 0) ? e+2 : e-1;}

  function circumcenter(a, b, c) {
    let a0 = a[0], b0 = b[0], c0 = c[0],
        a1 = a[1], b1 = b[1], c1 = c[1];
    let ad = a0*a0 + a1*a1,
        bd = b0*b0 + b1*b1,
        cd = c0*c0 + c1*c1;
    let D = 2 * (a0 * (b1 - c1) + b0 * (c1 - a1) + c0 * (a1 - b1));
    return [
      Math.floor(1/D * (ad * (b1 - c1) + bd * (c1 - a1) + cd * (a1 - b1))),
      Math.floor(1/D * (ad * (c0 - b0) + bd * (a0 - c0) + cd * (b0 - a0)))
    ];
  }

  return Voronoi;

})));