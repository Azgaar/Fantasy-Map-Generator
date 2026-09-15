// The cell structure under a vertex brush, drawn on #debug while the tool is active

import { viewport } from "@/components/viewport";
import { unique } from "@/utils";
import { createEl, ensureEl, findEl } from "@/utils/nodeUtils";

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
  const scale = viewport.scale; // the structure stays equally visible at any zoom
  const cellIds = unique(vertexIds.flatMap(id => vertices.c[id])).filter(id => id >= 0 && id < cells.i.length);

  const polygons = cellIds.map(id => `<polygon points="${Pack.getPolygon(id)}" stroke-width="${1 / scale}"></polygon>`);
  const circles = vertexIds.map(id => {
    const [x, y] = vertices.p[id];
    return `<circle cx="${x}" cy="${y}" r="${2.5 / scale}"></circle>`;
  });
  getGroup().innerHTML = polygons.join("") + circles.join("");
}

/** Remove the structure overlay */
export function removeMesh(): void {
  findEl("vertices")?.remove();
}
