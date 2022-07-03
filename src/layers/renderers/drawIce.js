import {getGridPolygon} from "utils/graphUtils";
import {aleaPRNG} from "scripts/aleaPRNG";
import {clipPoly} from "utils/lineUtils";

export function drawIce() {
  const {cells, vertices} = grid;
  const {temp, h} = cells;
  const n = cells.i.length;

  const used = new Uint8Array(cells.i.length);
  Math.random = aleaPRNG(seed);

  const shieldMin = -8; // max temp to form ice shield (glacier)
  const icebergMax = 1; // max temp to form an iceberg

  for (const i of grid.cells.i) {
    const t = temp[i];
    if (t > icebergMax) continue; // too warm: no ice
    if (t > shieldMin && h[i] >= 20) continue; // non-glacier land: no ice

    if (t <= shieldMin) {
      // very cold: ice shield
      if (used[i]) continue; // already rendered
      const onborder = cells.c[i].some(n => temp[n] > shieldMin);
      if (!onborder) continue; // need to start from onborder cell
      const vertex = cells.v[i].find(v => vertices.c[v].some(i => temp[i] > shieldMin));
      const chain = connectVertices(vertex);
      if (chain.length < 3) continue;
      const points = clipPoly(chain.map(v => vertices.p[v]));
      ice.append("polygon").attr("points", points).attr("type", "iceShield");
      continue;
    }

    // mildly cold: iceberd
    if (P(normalize(t, -7, 2.5))) continue; // t[-5; 2] cold: skip some cells
    if (grid.features[cells.f[i]].type === "lake") continue; // lake: no icebers
    let size = (6.5 + t) / 10; // iceberg size: 0 = full size, 1 = zero size
    if (cells.t[i] === -1) size *= 1.3; // coasline: smaller icebers
    size = Math.min(size * (0.4 + rand() * 1.2), 0.95); // randomize iceberg size
    resizePolygon(i, size);
  }

  function resizePolygon(i, s) {
    const c = grid.points[i];
    const points = getGridPolygon(i).map(p => [(p[0] + (c[0] - p[0]) * s) | 0, (p[1] + (c[1] - p[1]) * s) | 0]);
    ice
      .append("polygon")
      .attr("points", points)
      .attr("cell", i)
      .attr("size", rn(1 - s, 2));
  }

  // connect vertices to chain
  function connectVertices(start) {
    const chain = []; // vertices chain to form a path
    for (let i = 0, current = start; i === 0 || (current !== start && i < 20000); i++) {
      const prev = last(chain); // previous vertex in chain
      chain.push(current); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter(c => temp[c] <= shieldMin).forEach(c => (used[c] = 1));
      const c0 = c[0] >= n || temp[c[0]] > shieldMin;
      const c1 = c[1] >= n || temp[c[1]] > shieldMin;
      const c2 = c[2] >= n || temp[c[2]] > shieldMin;
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
}
