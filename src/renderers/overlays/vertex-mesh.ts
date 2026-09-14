// The cell structure under a vertex brush, drawn on #debug while the tool is active

import { select } from "d3";
import { viewport } from "@/components/viewport";
import { unique } from "@/utils";

const getGroup = () => {
  const debug = select("#debug");
  const existing = debug.select<SVGGElement>("#vertices");
  return existing.empty() ? debug.append("g").attr("id", "vertices") : existing;
};

/** Show the given vertices and the cells they shape, updating the positions if already shown */
export function drawMesh(vertexIds: number[]): void {
  const { cells, vertices } = pack;
  const group = getGroup();

  const cellIds = unique(vertexIds.flatMap(id => vertices.c[id])).filter(id => id >= 0 && id < cells.i.length);
  group
    .selectAll<SVGPolygonElement, number>("polygon")
    .data(cellIds, id => id)
    .join("polygon")
    .attr("points", id => String(Pack.getPolygon(id)))
    .attr("stroke-width", 1 / viewport.scale); // the structure stays equally visible at any zoom

  group
    .selectAll<SVGCircleElement, number>("circle")
    .data(vertexIds, id => id)
    .join("circle")
    .attr("cx", id => vertices.p[id][0])
    .attr("cy", id => vertices.p[id][1])
    .attr("r", 2.5 / viewport.scale);
}

/** Remove the structure overlay */
export function removeMesh(): void {
  select("#debug").select("#vertices").remove();
}
