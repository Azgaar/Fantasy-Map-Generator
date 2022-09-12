import * as d3 from "d3";
import Delaunator from "delaunator";
import FlatQueue from "flatqueue";

import {simplify} from "scripts/simplify";
import {Voronoi} from "modules/voronoi";
import {MIN_LAND_HEIGHT} from "config/generation";
import {findCell} from "utils/graphUtils";
import {isState} from "utils/typeUtils";
import {drawPath, drawPoint, drawPolyline} from "utils/debugUtils";

export function drawLabels() {
  /* global */ const {cells, vertices, features, states, burgs} = pack;
  /* global: findCell, graphWidth, graphHeight */

  drawStateLabels(cells, features, states, vertices);
  drawBurgLabels(burgs);
  // TODO: draw other labels

  window.Zoom.invoke();
}

function drawBurgLabels(burgs: TBurgs) {
  // remove old data
  burgLabels.selectAll("text").remove();

  const validBurgs = burgs.filter(burg => burg.i && !(burg as IBurg).removed) as IBurg[];

  // capitals
  const capitals = validBurgs.filter(burg => burg.capital);
  const capitalSize = Number(burgIcons.select("#cities").attr("size")) || 1;

  burgLabels
    .select("#cities")
    .selectAll("text")
    .data(capitals)
    .enter()
    .append("text")
    .attr("id", d => "burgLabel" + d.i)
    .attr("data-id", d => d.i)
    .attr("x", d => d.x)
    .attr("y", d => d.y)
    .attr("dy", `${capitalSize * -1.5}px`)
    .text(d => d.name);

  // towns
  const towns = validBurgs.filter(burg => !burg.capital);
  const townSize = Number(burgIcons.select("#towns").attr("size")) || 0.5;

  burgLabels
    .select("#towns")
    .selectAll("text")
    .data(towns)
    .enter()
    .append("text")
    .attr("id", d => "burgLabel" + d.i)
    .attr("data-id", d => d.i)
    .attr("x", d => d.x)
    .attr("y", d => d.y)
    .attr("dy", `${townSize * -1.5}px`)
    .text(d => d.name);
}

function drawStateLabels(cells: IPack["cells"], features: TPackFeatures, states: TStates, vertices: IGraphVertices) {
  const lineGen = d3.line().curve(d3.curveBundle.beta(1));
  const mode = options.stateLabelsMode || "auto";

  const labelPaths = getLabelPaths();
  console.log(labelPaths);

  function getLabelPaths() {
    const labelPaths: [number, TPoints][] = [];
    const MIN_HULL_SIZE = 20;
    const lineGen = d3.line().curve(d3.curveBundle.beta(1));

    for (const state of states) {
      if (!isState(state)) continue;
      const used: Dict<boolean> = {}; // mutable

      const visualCenter = findCell(...state.pole);
      const startingCell = cells.state[visualCenter] === state.i ? visualCenter : state.center;
      const hull = getHull(startingCell, state.i, state.cells, used);
      const points = [...hull].map(vertex => vertices.p[vertex]);

      const delaunay = Delaunator.from(points);
      const voronoi = new Voronoi(delaunay, points, points.length);
      const chain = connectVertices(voronoi.vertices, state.pole, used);

      drawPoint(state.pole, {color: "blue", radius: 1});

      if (state.i === 1) {
        points.forEach(point => {
          drawPoint(point, {color: "red", radius: 0.5});
        });
      }

      const pathPoints = simplify(
        chain.map(i => voronoi.vertices.p[i]),
        30
      );

      drawPath(lineGen(pathPoints)!, {stroke: "red", strokeWidth: 0.5});

      labelPaths.push([state.i, pathPoints]);
    }

    return labelPaths;

    function getHull(start: number, stateId: number, stateCells: number, used: Dict<boolean>) {
      const maxPassableLakeSize = stateCells / 10;
      const queue = [start];

      const hull = new Set<number>();
      const addToHull = (cellId: number, index: number) => {
        const vertex = cells.v[cellId][index];
        if (vertex) hull.add(vertex);
      };

      while (queue.length) {
        const cellId = queue.pop()!;

        cells.c[cellId].forEach((neibCellId, index) => {
          if (used[neibCellId]) return;
          used[neibCellId] = true;

          if (isHullEdge(neibCellId)) return addToHull(cellId, index);
          return queue.push(neibCellId);
        });
      }

      return hull;

      function isHullEdge(cellId: number) {
        if (cells.b[cellId]) return true;

        if (cells.h[cellId] < MIN_LAND_HEIGHT) {
          const feature = features[cells.f[cellId]];
          if (!feature || feature.type !== "lake") return true;
          if (feature.cells > maxPassableLakeSize) return true;
          return false;
        }

        if (cells.state[cellId] !== stateId) return true;

        if (hull.size > MIN_HULL_SIZE) {
          // stop on narrow passages
          const sameStateNeibs = cells.c[cellId].filter(c => cells.state[c] === stateId);
          if (sameStateNeibs.length < 3) return true;
        }

        return false;
      }
    }

    function connectVertices(vertices: Voronoi["vertices"], pole: TPoint, used: Dict<boolean>) {
      // check if vertex is inside the area
      const inside = vertices.p.map(([x, y]) => {
        if (x <= 0 || y <= 0 || x >= graphWidth || y >= graphHeight) return false; // out of the screen
        return used[findCell(x, y)];
      });

      const innerVertices = d3.range(vertices.p.length).filter(i => inside[i]);
      if (innerVertices.length < 2) return [0];

      const horyzontalShift = getHoryzontalShift(vertices.p.length);
      const {right: start, left: end} = getEdgeVertices(innerVertices, vertices.p, pole, horyzontalShift);

      // connect leftmost and rightmost vertices with shortest path
      const cost: number[] = [];
      const from: number[] = [];
      const queue = new FlatQueue<number>();
      queue.push(start, 0);

      while (queue.length) {
        const priority = queue.peekValue()!;
        const next = queue.pop()!;

        if (next === end) break;

        for (const neibVertex of vertices.v[next]) {
          if (neibVertex === -1) continue;

          const totalCost = priority + (inside[neibVertex] ? 1 : 100);
          if (from[neibVertex] || totalCost >= cost[neibVertex]) continue;

          cost[neibVertex] = totalCost;
          from[neibVertex] = next;
          queue.push(neibVertex, totalCost);
        }
      }

      // restore path
      const chain = [end];
      let cur = end;
      while (cur !== start) {
        cur = from[cur];
        if (inside[cur]) chain.push(cur);
      }
      return chain;
    }

    function getHoryzontalShift(verticesNumber: number) {
      console.log({verticesNumber});
      return 0;
      if (verticesNumber < 100) return 1;
      if (verticesNumber < 200) return 0.3;
      if (verticesNumber < 300) return 0.1;
      return 0;
    }

    function getEdgeVertices(innerVertices: number[], points: TPoints, pole: TPoint, horyzontalShift: number) {
      let leftmost = {value: Infinity, vertex: innerVertices.at(0)!};
      let rightmost = {value: -Infinity, vertex: innerVertices.at(-1)!};

      for (const vertex of innerVertices) {
        const [x, y] = points[vertex];
        const valueX = x - pole[0];
        const valueY = Math.abs(y - pole[1]) * horyzontalShift;

        if (valueX + valueY < leftmost.value) leftmost = {value: valueX + valueY, vertex};
        if (valueX - valueY > rightmost.value) rightmost = {value: valueX - valueY, vertex};
      }

      return {left: leftmost.vertex, right: rightmost.vertex};
    }
  }
}
