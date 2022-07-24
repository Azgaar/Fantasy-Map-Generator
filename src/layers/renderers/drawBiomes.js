import {clipPoly} from "utils/lineUtils";
import {TIME} from "config/logging";

export function drawBiomes() {
  TIME && console.time("drawBiomes");
  biomes.selectAll("path").remove();

  const {cells, vertices} = pack;
  const n = cells.i.length;

  const used = new Uint8Array(cells.i.length);
  const paths = new Array(biomesData.i.length).fill("");

  for (const i of cells.i) {
    if (!cells.biome[i]) continue; // no need to mark marine biome (liquid water)
    if (used[i]) continue; // already marked
    const b = cells.biome[i];
    const onborder = cells.c[i].some(n => cells.biome[n] !== b);
    if (!onborder) continue;
    const edgeVerticle = cells.v[i].find(v => vertices.c[v].some(i => cells.biome[i] !== b));
    const chain = connectVertices(edgeVerticle, b);
    if (chain.length < 3) continue;
    const points = clipPoly(chain.map(v => vertices.p[v]));
    paths[b] += "M" + points.join("L") + "Z";
  }

  paths.forEach(function (d, i) {
    if (d.length < 10) return;
    biomes
      .append("path")
      .attr("d", d)
      .attr("fill", biomesData.color[i])
      .attr("stroke", biomesData.color[i])
      .attr("id", "biome" + i);
  });

  // connect vertices to chain
  function connectVertices(start, b) {
    const chain = []; // vertices chain to form a path
    for (let i = 0, current = start; i === 0 || (current !== start && i < 20000); i++) {
      const prev = chain[chain.length - 1]; // previous vertex in chain
      chain.push(current); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter(c => cells.biome[c] === b).forEach(c => (used[c] = 1));
      const c0 = c[0] >= n || cells.biome[c[0]] !== b;
      const c1 = c[1] >= n || cells.biome[c[1]] !== b;
      const c2 = c[2] >= n || cells.biome[c[2]] !== b;
      const v = vertices.v[current]; // neighboring vertices
      if (v[0] !== prev && c0 !== c1) current = v[0];
      else if (v[1] !== prev && c1 !== c2) current = v[1];
      else if (v[2] !== prev && c0 !== c2) current = v[2];
      if (current === chain[chain.length - 1]) {
        ERROR && console.error("Next vertex is not found");
        break;
      }
    }
    return chain;
  }

  TIME && console.timeEnd("drawBiomes");
}
