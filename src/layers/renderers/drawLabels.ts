import {MIN_LAND_HEIGHT} from "config/generation";
import * as d3 from "d3";
import Delaunator from "delaunator";
import {Voronoi} from "modules/voronoi";

import {findCell} from "utils/graphUtils";
import {isState} from "utils/typeUtils";

export function drawLabels() {
  /* global */ const {cells, vertices, features, states, burgs} = pack;

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

  function getLabelPaths() {
    const labelPaths: number[][] = [];
    const MIN_HULL_SIZE = 20;

    for (const state of states) {
      if (!isState(state)) continue;
      const used: Dict<boolean> = {};

      const visualCenter = findCell(...state.pole);
      const start = cells.state[visualCenter] === state.i ? visualCenter : state.center;
      const hull = getHull(start, state.i, state.cells, used);
      const points = [...hull].map(vertex => vertices.p[vertex]);
      const delaunay = Delaunator.from(points);
      const voronoi = new Voronoi(delaunay, points, points.length);
      const chain = connectCenters(voronoi.vertices, state.pole[1]);
      const relaxed = chain.map(i => voronoi.vertices.p[i]).filter((p, i) => i % 15 === 0 || i + 1 === chain.length);
      labelPaths.push([state.i, relaxed]);
    }

    return labelPaths;

    function getHull(start: number, stateId: number, stateCells: number, used: Dict<boolean>) {
      const queue = [start];
      const hull = new Set<number>();
      const addHull = (cellId: number, neibCellIndex: number) => hull.add(cells.v[cellId][neibCellIndex]);
      const maxPassableLakeSize = stateCells / 10;

      while (queue.length) {
        const cellId = queue.pop()!;

        cells.c[cellId].forEach((neibCellId, neibCellIndex) => {
          if (used[neibCellId]) return;
          if (isHullEdge(neibCellId)) return addHull(neibCellId, neibCellIndex);

          used[neibCellId] = true;
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
  }
}
