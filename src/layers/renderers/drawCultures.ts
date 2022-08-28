import * as d3 from "d3";

import {getPaths} from "./utilts";
import {pick} from "utils/functionUtils";

export function drawCultures() {
  d3.select("#cults").selectAll("g").remove();

  /* uses */ const {cells, vertices, features, cultures} = pack;

  const paths = getPaths({
    getType: (cellId: number) => cells.culture[cellId],
    cells: pick(cells, "c", "v", "b", "h", "f"),
    vertices,
    features
  });

  const getColor = (i: number) => (cultures[i] as ICulture).color;

  d3.select("#cults")
    .append("g")
    .attr("fill", "none")
    .attr("stroke-width", 3)
    .selectAll("path")
    .remove()
    .data(paths)
    .enter()
    .append("path")
    .attr("d", ([, path]) => path.waterGap)
    .attr("stroke", ([i]) => getColor(Number(i)))
    .attr("id", ([i]) => "culture-gap" + i);

  d3.select("#cults")
    .append("g")
    .attr("stroke", "none")
    .selectAll("path")
    .remove()
    .data(paths)
    .enter()
    .append("path")
    .attr("d", ([, path]) => path.fill)
    .attr("fill", ([i]) => getColor(Number(i)))
    .attr("id", ([i]) => "culture" + i);
}
