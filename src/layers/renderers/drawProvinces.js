export function drawProvinces() {
  const labelsOn = provs.attr("data-labels") == 1;
  provs.selectAll("*").remove();

  const provinces = pack.provinces;
  const {body, gap} = getProvincesVertices();

  const g = provs.append("g").attr("id", "provincesBody");
  const bodyData = body.map((p, i) => [p.length > 10 ? p : null, i, provinces[i].color]).filter(d => d[0]);
  g.selectAll("path")
    .data(bodyData)
    .enter()
    .append("path")
    .attr("d", d => d[0])
    .attr("fill", d => d[2])
    .attr("stroke", "none")
    .attr("id", d => "province" + d[1]);
  const gapData = gap.map((p, i) => [p.length > 10 ? p : null, i, provinces[i].color]).filter(d => d[0]);
  g.selectAll(".path")
    .data(gapData)
    .enter()
    .append("path")
    .attr("d", d => d[0])
    .attr("fill", "none")
    .attr("stroke", d => d[2])
    .attr("id", d => "province-gap" + d[1]);

  const labels = provs.append("g").attr("id", "provinceLabels");
  labels.style("display", `${labelsOn ? "block" : "none"}`);
  const labelData = provinces.filter(p => p.i && !p.removed && p.pole);
  labels
    .selectAll(".path")
    .data(labelData)
    .enter()
    .append("text")
    .attr("x", d => d.pole[0])
    .attr("y", d => d.pole[1])
    .attr("id", d => "provinceLabel" + d.i)
    .text(d => d.name);
}

export function getProvincesVertices() {
  const cells = pack.cells,
    vertices = pack.vertices,
    provinces = pack.provinces,
    n = cells.i.length;
  const used = new Uint8Array(cells.i.length);
  const vArray = new Array(provinces.length); // store vertices array
  const body = new Array(provinces.length).fill(""); // store path around each province
  const gap = new Array(provinces.length).fill(""); // store path along water for each province to fill the gaps

  for (const i of cells.i) {
    if (!cells.province[i] || used[i]) continue;
    const p = cells.province[i];
    const onborder = cells.c[i].some(n => cells.province[n] !== p);
    if (!onborder) continue;

    const borderWith = cells.c[i].map(c => cells.province[c]).find(n => n !== p);
    const vertex = cells.v[i].find(v => vertices.c[v].some(i => cells.province[i] === borderWith));
    const chain = connectVertices(vertex, p, borderWith);
    if (chain.length < 3) continue;
    const points = chain.map(v => vertices.p[v[0]]);
    if (!vArray[p]) vArray[p] = [];
    vArray[p].push(points);
    body[p] += "M" + points.join("L");
    gap[p] +=
      "M" +
      vertices.p[chain[0][0]] +
      chain.reduce(
        (r, v, i, d) =>
          !i ? r : !v[2] ? r + "L" + vertices.p[v[0]] : d[i + 1] && !d[i + 1][2] ? r + "M" + vertices.p[v[0]] : r,
        ""
      );
  }

  // find province visual center
  vArray.forEach((ar, i) => {
    const sorted = ar.sort((a, b) => b.length - a.length); // sort by points number
    provinces[i].pole = polylabel(sorted, 1.0); // pole of inaccessibility
  });

  return {body, gap};

  // connect vertices to chain
  function connectVertices(start, t, province) {
    const chain = []; // vertices chain to form a path
    let land = vertices.c[start].some(c => cells.h[c] >= 20 && cells.province[c] !== t);
    function check(i) {
      province = cells.province[i];
      land = cells.h[i] >= 20;
    }

    for (let i = 0, current = start; i === 0 || (current !== start && i < 20000); i++) {
      const prev = chain[chain.length - 1] ? chain[chain.length - 1][0] : -1; // previous vertex in chain
      chain.push([current, province, land]); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter(c => cells.province[c] === t).forEach(c => (used[c] = 1));
      const c0 = c[0] >= n || cells.province[c[0]] !== t;
      const c1 = c[1] >= n || cells.province[c[1]] !== t;
      const c2 = c[2] >= n || cells.province[c[2]] !== t;
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
    chain.push([start, province, land]); // add starting vertex to sequence to close the path
    return chain;
  }
}
