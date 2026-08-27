import { ensureEl } from "@/utils";

export function drawCells(): void {
  const isGridMode = customization === 1; // the heightmap editor works on the grid graph
  const cellIds = (isGridMode ? grid.cells.i : pack.cells.i) as ArrayLike<number>;
  const getPolygon = isGridMode
    ? (cellId: number) => Grid.getPolygon(cellId)
    : (cellId: number) => Pack.getPolygon(cellId);

  const paths = Array.from(cellIds, cellId => `M${getPolygon(cellId)}`);
  ensureEl("cells").innerHTML = /* html */ `<path d="${paths.join("")}" />`;
}
