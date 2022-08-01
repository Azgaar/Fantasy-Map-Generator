import * as d3 from "d3";

import {getPaths} from "./utilts";

export function drawCultures() {
  /* uses */ const {cells, vertices, cultures} = pack;

  const getType = (cellId: number) => cells.culture[cellId];
  const paths = getPaths(cells.c, cells.v, vertices, getType);

  const getColor = (i: number) => i && (cultures[i] as ICulture).color;

  d3.select("#cults")
    .selectAll("path")
    .remove()
    .data(Object.entries(paths))
    .enter()
    .append("path")
    .attr("d", ([, path]) => path)
    .attr("fill", ([i]) => getColor(Number(i)))
    .attr("id", ([i]) => "culture" + i);
}
