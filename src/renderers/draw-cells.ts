import { Grid } from "@/model/graph/grid-generator";
import { Pack } from "@/model/graph/pack-generator";
import { Layers } from "@/renderers/layers";
import { ViewportLayers, type ViewportRenderContext } from "@/renderers/viewport/viewport-renderer";
import { ensureEl } from "@/utils/nodeUtils";
import { rn } from "@/utils/numberUtils";

const layer = ViewportLayers.register({ id: "cellIndexes", render: reconcileIndexes });

const isGridMode = () => options.app.mode === "heightmap"; // the heightmap editor works on the grid graph

export function drawCells(): void {
  const cellIds = (isGridMode() ? grid.cells.i : pack.cells.i) as ArrayLike<number>;
  const getPolygon = isGridMode()
    ? (cellId: number) => Grid.getPolygon(cellId)
    : (cellId: number) => Pack.getPolygon(cellId);

  const paths = Array.from(cellIds, cellId => `M${getPolygon(cellId)}`);
  const cells = ensureEl("cells");
  cells.querySelector(":scope > path")?.remove();
  cells.insertAdjacentHTML("afterbegin", `<path d="${paths.join("")}" />`);
  layer.render();
}

function reconcileIndexes({ root, bounds }: ViewportRenderContext): void {
  const group = root.querySelector<SVGGElement>("#cellIndexes");
  if (!group) return;
  const { show, size, dx, dy } = styles.cells.groups.cellIndexes.options;
  if (!show || !Layers.isOn("cells")) return void group.replaceChildren();

  const cellIds = (isGridMode() ? grid.cells.i : pack.cells.i) as ArrayLike<number>;
  const points = isGridMode() ? grid.points : pack.cells.p;
  const spacing = grid.spacing || 10;
  const fontSize = rn(spacing * size, 2);
  const shiftX = dx * fontSize; // the shift is in font-size units
  const shiftY = dy * fontSize;
  const margin = spacing + Math.max(Math.abs(shiftX), Math.abs(shiftY));
  const { x0, y0, x1, y1 } = bounds;

  const markup: string[] = [];
  for (let i = 0; i < cellIds.length; i++) {
    const cellId = cellIds[i];
    const [x, y] = points[cellId];
    if (x < x0 - margin || x > x1 + margin || y < y0 - margin || y > y1 + margin) continue;
    markup.push(`<text x="${x}" y="${y}">${cellId}</text>`);
  }

  group.setAttribute("font-size", String(fontSize));
  group.setAttribute("text-anchor", "middle");
  group.setAttribute("dominant-baseline", "central");
  if (shiftX || shiftY) group.setAttribute("transform", `translate(${rn(shiftX, 2)} ${rn(shiftY, 2)})`);
  else group.removeAttribute("transform");
  group.innerHTML = markup.join("");
}
