import { ensureEl } from "@/utils";

export function drawCells(): void {
  const isGridMode = customization === 1; // the heightmap editor works on the grid graph
  const cellIds = (isGridMode ? grid.cells.i : pack.cells.i) as ArrayLike<number>;
  const getPolygon = isGridMode
    ? (cellId: number) => Grid.getPolygon(cellId)
    : (cellId: number) => Pack.getPolygon(cellId);

  const paths = Array.from(cellIds, cellId => `M${getPolygon(cellId)}`);
  let html = `<path d="${paths.join("")}" />`;

  if (styles.cells.options?.showIndexes) {
    const points = isGridMode ? grid.points : pack.cells.p;
    const fontSize = Math.max(1.5, Math.round((grid.spacing || 10) * 0.3 * 10) / 10);
    const color = styles.cells.attrs.stroke || "#808080";
    const texts = Array.from(
      cellIds,
      cellId => `<text x="${points[cellId][0]}" y="${points[cellId][1]}">${cellId}</text>`
    ).join("");
    html += `<g id="cellIndexes" stroke="none" fill="${color}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="central" pointer-events="none">${texts}</g>`;
  }

  ensureEl("cells").innerHTML = html;
}
