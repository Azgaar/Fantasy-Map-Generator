import {TIME} from "/src/config/logging";
import {clipPoly} from "/src/utils/lineUtils";
import {rn} from "/src/utils/numberUtils";
import {P} from "/src/utils/probabilityUtils";
import {round} from "/src/utils/stringUtils";

window.OceanLayers = (function () {
  let cells, vertices, pointsN, used;

  function OceanLayers() {
    const outline = oceanLayers.attr("layers");
    if (outline === "none") return;
    TIME && console.time("drawOceanLayers");

    const lineGen = d3.line().curve(d3.curveBasisClosed);
    (cells = grid.cells), (pointsN = grid.cells.i.length), (vertices = grid.vertices);
    const limits = outline === "random" ? randomizeOutline() : outline.split(",").map(s => +s);

    const chains = [];
    const opacity = rn(0.4 / limits.length, 2);
    used = new Uint8Array(pointsN); // to detect already passed cells

    for (const i of cells.i) {
      const t = cells.t[i];
      if (t > 0) continue;
      if (used[i] || !limits.includes(t)) continue;
      const start = findStart(i, t);
      if (!start) continue;
      used[i] = 1;
      const chain = connectVertices(start, t); // vertices chain to form a path
      if (chain.length < 4) continue;
      const relax = 1 + t * -2; // select only n-th point
      const relaxed = chain.filter((v, i) => !(i % relax) || vertices.c[v].some(c => c >= pointsN));
      if (relaxed.length < 4) continue;
      const points = clipPoly(
        relaxed.map(v => vertices.p[v]),
        1
      );
      chains.push([t, points]);
    }

    for (const t of limits) {
      const layer = chains.filter(c => c[0] === t);
      let path = layer.map(c => round(lineGen(c[1]))).join("");
      if (path) oceanLayers.append("path").attr("d", path).attr("fill", "#ecf2f9").style("opacity", opacity);
    }

    // find eligible cell vertex to start path detection
    function findStart(i, t) {
      if (cells.b[i]) return cells.v[i].find(v => vertices.c[v].some(c => c >= pointsN)); // map border cell
      return cells.v[i][cells.c[i].findIndex(c => cells.t[c] < t || !cells.t[c])];
    }

    TIME && console.timeEnd("drawOceanLayers");
  }

  function randomizeOutline() {
    const limits = [];
    let odd = 0.2;
    for (let l = -9; l < 0; l++) {
      if (P(odd)) {
        odd = 0.2;
        limits.push(l);
      } else {
        odd *= 2;
      }
    }
    return limits;
  }

  // connect vertices to chain
  function connectVertices(start, t) {
    const chain = []; // vertices chain to form a path
    for (let i = 0, current = start; i === 0 || (current !== start && i < 10000); i++) {
      const prev = chain[chain.length - 1]; // previous vertex in chain
      chain.push(current); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter(c => cells.t[c] === t).forEach(c => (used[c] = 1));
      const v = vertices.v[current]; // neighboring vertices
      const c0 = !cells.t[c[0]] || cells.t[c[0]] === t - 1;
      const c1 = !cells.t[c[1]] || cells.t[c[1]] === t - 1;
      const c2 = !cells.t[c[2]] || cells.t[c[2]] === t - 1;
      if (v[0] !== undefined && v[0] !== prev && c0 !== c1) current = v[0];
      else if (v[1] !== undefined && v[1] !== prev && c1 !== c2) current = v[1];
      else if (v[2] !== undefined && v[2] !== prev && c0 !== c2) current = v[2];
      if (current === chain[chain.length - 1]) {
        ERROR && console.error("Next vertex is not found");
        break;
      }
    }
    chain.push(chain[0]); // push first vertex as the last one
    return chain;
  }

  return OceanLayers;
})();
