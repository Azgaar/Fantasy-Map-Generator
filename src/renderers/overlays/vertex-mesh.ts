// The cell structure under a vertex brush, drawn on #debug while the tool is active

import { Pack } from "@/model/graph/pack-generator";
import { unique } from "@/utils/array-utils";
import { createEl, ensureEl, findEl } from "@/utils/node-utils";

const getGroup = (): SVGGElement => {
  const existing = findEl<SVGGElement>("vertices");
  if (existing) return existing;
  const group = createEl<SVGGElement>("g", "vertices");
  ensureEl("debug").append(group);
  return group;
};

/** Show the given vertices and the cells they shape */
export function drawMesh(vertexIds: number[]): void {
  const { cells, vertices } = pack;
  const cellIds = unique(vertexIds.flatMap(id => vertices.c[id])).filter(id => id >= 0 && id < cells.i.length);

  const polygons = cellIds.map(id => `<polygon points="${Pack.getPolygon(id)}"></polygon>`);
  const circles = vertexIds.map(id => {
    const [x, y] = vertices.p[id];
    return `<circle cx="${x}" cy="${y}"></circle>`;
  });
  getGroup().innerHTML = polygons.join("") + circles.join("");
}

/** Remove the structure overlay */
export function removeMesh(): void {
  findEl("vertices")?.remove();
}
