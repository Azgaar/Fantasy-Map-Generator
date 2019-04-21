(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.Voronoi = factory());
}(this, (function () { 'use strict';

  var Voronoi = function Voronoi(delaunay, points, pointsN) {
    const cells = {v: [], c: [], b: []}; // voronoi cells: v = cell vertices, c = adjacent cells, b = near-border cell
    const vertices = {p: [], v: [], c: []}; // cells vertices: p = vertex coordinates, v = neighboring vertices, c = adjacent cells
    
    for (let e=0; e < delaunay.triangles.length; e++) {

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
      let vertices = pointsOfTriangle(t).map(p => points[p]);
      return circumcenter(vertices[0], vertices[1], vertices[2]);
    }
    
    return {cells, vertices}
    
  }
  
  function edgesOfTriangle(t) {return [3*t, 3*t+1, 3*t+2];}

  function triangleOfEdge(e)  {return Math.floor(e/3);}

  function nextHalfedge(e) {return (e % 3 === 2) ? e-2 : e+1;}

  function prevHalfedge(e) {return (e % 3 === 0) ? e+2 : e-1;}

  function circumcenter(a, b, c) {
    let ad = a[0]*a[0] + a[1]*a[1],
        bd = b[0]*b[0] + b[1]*b[1],
        cd = c[0]*c[0] + c[1]*c[1];
    let D = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    return [
      Math.floor(1/D * (ad * (b[1] - c[1]) + bd * (c[1] - a[1]) + cd * (a[1] - b[1]))),
      Math.floor(1/D * (ad * (c[0] - b[0]) + bd * (a[0] - c[0]) + cd * (b[0] - a[0])))
    ];
  }

  return Voronoi;

})));