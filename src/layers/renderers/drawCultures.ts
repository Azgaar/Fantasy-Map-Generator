import {connectVertices} from "scripts/connectVertices";

export function drawCultures() {
  /* uses */ const {cells, vertices, cultures} = pack;

  cults.selectAll("path").remove(); // cleanup

  const used = new Uint8Array(cells.i.length);
  const paths = new Array(cultures.length).fill("");

  for (const i of cells.i) {
    if (!cells.culture[i]) continue;
    if (used[i]) continue;
    used[i] = 1;
    const cultureId = cells.culture[i];
    const onborder = cells.c[i].some(n => cells.culture[n] !== cultureId);
    if (!onborder) continue;

    const startingVertex = cells.v[i].find(v => vertices.c[v].some(i => cells.culture[i] !== cultureId));
    if (startingVertex === undefined)
      throw new Error(`Draw cultures: starting vertex for culture ${cultureId} is not found`);

    const ofSameType = (cellId: number) => cells.culture[cellId] === cultureId;
    const chain = connectVertices({vertices, startingVertex, ofSameType});

    if (chain.length < 3) continue;
    const points = chain.map(v => vertices.p[v]);

    paths[cultureId] += "M" + points.join("L") + "Z";
  }

  const data = paths.map((p, i) => [p, i]).filter(d => d[0].length > 10);
  cults
    .selectAll("path")
    .data(data)
    .enter()
    .append("path")
    .attr("d", d => d[0])
    .attr("fill", d => cultures[d[1]].color)
    .attr("id", d => "culture" + d[1]);
}
