import { ensureEl, getGridPolygon, getPackPolygon } from "@/utils";

export function drawCells(): void {
  const isGridMode = customization === 1; // the heightmap editor works on the grid graph
  const graph = isGridMode ? grid : pack;
  const polygon = isGridMode ? getGridPolygon : getPackPolygon;

  const paths = Array.from(graph.cells.i as ArrayLike<number>, cellId => `M${polygon(cellId, graph)}`);
  ensureEl("cells").innerHTML = /* html */ `<path d="${paths.join("")}" />`;
}
