export function drawReligions() {
  relig.selectAll("path").remove();
  const {cells, vertices, religions} = pack;
  const n = cells.i.length;

  const used = new Uint8Array(cells.i.length);
  const body = new Array(religions.length).fill(""); // store path around each religion
  const gap = new Array(religions.length).fill(""); // store path along water for each religion to fill the gaps

  for (const i of cells.i) {
    if (!cells.religion[i]) continue;
    if (used[i]) continue;
    used[i] = 1;
    const r = cells.religion[i];
    const onborder = cells.c[i].filter(n => cells.religion[n] !== r);
    if (!onborder.length) continue;
    const borderWith = cells.c[i].map(c => cells.religion[c]).find(n => n !== r);
    const vertex = cells.v[i].find(v => vertices.c[v].some(i => cells.religion[i] === borderWith));
    const chain = connectVertices(vertex, r, borderWith);
    if (chain.length < 3) continue;
    const points = chain.map(v => vertices.p[v[0]]);

    body[r] += "M" + points.join("L") + "Z";
    gap[r] +=
      "M" +
      vertices.p[chain[0][0]] +
      chain.reduce(
        (r2, v, i, d) =>
          !i ? r2 : !v[2] ? r2 + "L" + vertices.p[v[0]] : d[i + 1] && !d[i + 1][2] ? r2 + "M" + vertices.p[v[0]] : r2,
        ""
      );
  }

  const bodyData = body.map((p, i) => [p.length > 10 ? p : null, i, religions[i].color]).filter(d => d[0]);
  relig
    .selectAll("path")
    .data(bodyData)
    .enter()
    .append("path")
    .attr("d", d => d[0])
    .attr("fill", d => d[2])
    .attr("id", d => "religion" + d[1]);

  const gapData = gap.map((p, i) => [p.length > 10 ? p : null, i, religions[i].color]).filter(d => d[0]);
  relig
    .selectAll(".path")
    .data(gapData)
    .enter()
    .append("path")
    .attr("d", d => d[0])
    .attr("fill", "none")
    .attr("stroke", d => d[2])
    .attr("id", d => "religion-gap" + d[1])
    .attr("stroke-width", "10px");

  // connect vertices to chain
  function connectVertices(start, t, religion) {
    const chain = []; // vertices chain to form a path
    let land = vertices.c[start].some(c => cells.h[c] >= 20 && cells.religion[c] !== t);
    function check(i) {
      religion = cells.religion[i];
      land = cells.h[i] >= 20;
    }

    for (let i = 0, current = start; i === 0 || (current !== start && i < 20000); i++) {
      const prev = chain[chain.length - 1] ? chain[chain.length - 1][0] : -1; // previous vertex in chain
      chain.push([current, religion, land]); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter(c => cells.religion[c] === t).forEach(c => (used[c] = 1));
      const c0 = c[0] >= n || cells.religion[c[0]] !== t;
      const c1 = c[1] >= n || cells.religion[c[1]] !== t;
      const c2 = c[2] >= n || cells.religion[c[2]] !== t;
      const v = vertices.v[current]; // neighboring vertices
      if (v[0] !== prev && c0 !== c1) {
        current = v[0];
        check(c0 ? c[0] : c[1]);
      } else if (v[1] !== prev && c1 !== c2) {
        current = v[1];
        check(c1 ? c[1] : c[2]);
      } else if (v[2] !== prev && c0 !== c2) {
        current = v[2];
        check(c2 ? c[2] : c[0]);
      }
      if (current === chain[chain.length - 1][0]) {
        ERROR && console.error("Next vertex is not found");
        break;
      }
    }
    return chain;
  }
}
