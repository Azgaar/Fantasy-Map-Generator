import { Layers } from "@/components/layers";
import {
  type Box,
  boundsIntersect,
  ViewportLayers,
  type ViewportRenderContext
} from "@/renderers/viewport/viewport-renderer";
import type { PackedGraph } from "@/types/PackedGraph";
import { normalize, rn } from "../utils";

const layer = ViewportLayers.register({ id: "goods", render: reconcileGoods });
let cellProduction: CellProduction[] = [];
let resourceIcons: ResourceIcon[] = [];
let burgPlates: BurgPlate[] = [];
let sourcePack: PackedGraph | null = null;

const PLATE_ICON = 3;
const PLATE_FONT = 3.5;
const PLATE_GAP = 0.2;
const PLATE_ENTRY_GAP = 0.8;
const PLATE_DY = 0;
const PLATE_PAD_X = 1;
const PLATE_PAD_Y = 0.6;
const PLATE_RX = 1;
const PLATE_FILL = "#f5f5f5";

/** a producing cell: the polygon points are re-read per frame, only the visible ones */
interface CellProduction extends Box {
  cellId: number;
  opacity: number;
  colors: string[];
}

interface ResourceIcon {
  x: number;
  y: number;
  goodId: number;
  color: string;
  stroke: string;
  icon: string;
}

interface PlateEntry {
  value: number;
  color: string;
  stroke: string;
  icon: string;
}

/** a burg plate: the entry list is style-independent, the geometry is laid out per frame */
interface BurgPlate {
  burgId: number;
  x: number;
  y: number;
  entries: PlateEntry[];
}

export function drawGoods(): void {
  TIME && console.time("drawGoods");
  buildScene();
  layer.render();
  TIME && console.timeEnd("drawGoods");
}

function buildScene(): void {
  const displayed = new Set(pack.goods.filter(good => good.visible).map(good => good.i));
  buildCellProduction(displayed);
  buildResourceIcons(displayed);
  buildBurgPlates(displayed);
  sourcePack = pack;
}

function reconcileGoods({ root, bounds }: ViewportRenderContext): void {
  if (!Layers.isOn("goods")) return;
  if (sourcePack !== pack) buildScene();

  const cells = root.querySelector<SVGGElement>("#goodsCells");
  if (cells) cells.innerHTML = renderCellProduction(bounds);

  const icons = root.querySelector<SVGGElement>("#goodsIcons");
  if (icons) icons.innerHTML = renderResourceIcons(bounds);

  const burgs = root.querySelector<SVGGElement>("#goodsBurgs");
  if (burgs) burgs.innerHTML = renderBurgPlates(bounds);
}

function buildCellProduction(displayedGoods: Set<number>): void {
  cellProduction = [];
  if (!displayedGoods.size) return;

  // First pass: accumulate total production per cell to find the global max
  const cellTotals = new Map<number, { produced: Map<number, number>; total: number }>();
  const biomeProduction = Goods.getBiomesProduction();
  let maxTotal = 0;
  for (const cellId of pack.cells.i) {
    let total = 0;
    const produced = Production.getCellProduction(cellId, biomeProduction);
    const filteredProduced = Object.entries(produced).reduce((map, [goodId, amount]) => {
      if (displayedGoods.has(+goodId)) {
        map.set(+goodId, amount);
        total += amount;
      }
      return map;
    }, new Map<number, number>());
    if (!total) continue;

    cellTotals.set(cellId, { produced: filteredProduced, total });
    if (total > maxTotal) maxTotal = total;
  }
  if (maxTotal === 0) return;

  // Second pass: colors with opacity normalized against the global max, plus the box to cull on
  for (const [cellId, { produced, total }] of cellTotals) {
    const colors: string[] = [];
    for (const [goodId, amount] of produced) {
      if (amount <= 0) continue;
      const good = Goods.get(goodId);
      if (good) colors.push(good.color);
    }
    if (!colors.length) continue;

    const opacity = rn(0.1 + 0.9 * normalize(total, 0, maxTotal), 2);
    cellProduction.push({ cellId, colors, opacity, ...getPolygonBox(cellId) });
  }
}

function buildResourceIcons(displayedGoods: Set<number>): void {
  resourceIcons = [];
  if (!displayedGoods.size || !pack.cells.good) return;

  for (const cellId of pack.cells.i) {
    const goodId = pack.cells.good[cellId];
    if (!goodId || !displayedGoods.has(goodId)) continue;
    const good = Goods.get(goodId);
    if (!good) continue;

    const [x, y] = pack.cells.p[cellId];
    resourceIcons.push({ x, y, goodId, color: good.color, stroke: Goods.getStroke(good.color), icon: good.icon });
  }
}

function buildBurgPlates(displayedGoods: Set<number>): void {
  burgPlates = [];
  if (!displayedGoods.size) return;

  for (const burg of pack.burgs) {
    if (!burg.i || burg.removed || !burg.production) continue;

    const produced = Production.getBurgProduction(burg);
    const entries: PlateEntry[] = [];

    // the three biggest producers, picked on value alone so the list survives style changes
    for (const good of pack.goods) {
      if (!displayedGoods.has(good.i)) continue;
      const raw = produced[good.i];
      if (!raw || raw <= 0) continue;

      const value = rn(raw, 1);
      if (entries.length === 3 && value <= entries[2].value) continue;

      let i = entries.length;
      while (i > 0 && entries[i - 1].value < value) i--;
      entries.splice(i, 0, { value, color: good.color, stroke: Goods.getStroke(good.color), icon: good.icon });
      if (entries.length > 3) entries.pop();
    }
    if (!entries.length) continue;

    burgPlates.push({ burgId: burg.i, x: burg.x, y: burg.y, entries });
  }
}

function renderCellProduction(bounds: Box): string {
  const markup: string[] = [];

  for (const cell of cellProduction) {
    if (!boundsIntersect(cell, bounds)) continue;
    const points = Pack.getPolygon(cell.cellId).join(" ");
    for (const color of cell.colors) {
      markup.push(`<polygon points="${points}" fill="${color}" fill-opacity="${cell.opacity}"/>`);
    }
  }

  return markup.join("");
}

function renderResourceIcons(bounds: Box): string {
  const { circle: drawCircle, size: iconSize } = styles.goods.goodsIcons.options;
  const half = iconSize / 2;
  const markup: string[] = [];

  for (const { x, y, goodId, color, stroke, icon } of resourceIcons) {
    if (!boundsIntersect({ x0: x - half, y0: y - half, x1: x + half, y1: y + half }, bounds)) continue;
    markup.push(
      `<g data-i="${goodId}">${
        drawCircle ? `<circle cx="${x}" cy="${y}" r="${half}" fill="${color}" stroke="${stroke}" />` : ""
      }<use href="#${icon}" x="${rn(x - half, 2)}" y="${rn(y - half, 2)}" width="${iconSize}" height="${iconSize}"/></g>`
    );
  }

  return markup.join("");
}

function renderBurgPlates(bounds: Box): string {
  // plate icon size is user-defined; the rest of the geometry and font scale with it
  const plateIcon = styles.goods.goodsBurgs.options.size;
  const scale = plateIcon / PLATE_ICON;
  const plateFont = PLATE_FONT * scale;
  const plateGap = PLATE_GAP * scale;
  const plateEntryGap = PLATE_ENTRY_GAP * scale;
  const platePadX = PLATE_PAD_X * scale;
  const platePadY = PLATE_PAD_Y * scale;
  const plateRx = PLATE_RX * scale;
  const charWidth = 1.2 * scale;
  const entryWidth = (value: number) =>
    plateIcon + plateGap + String(value).length * charWidth + 0.4 * plateFont * 0.62;

  const markup: string[] = [];

  for (const { burgId, x, y, entries } of burgPlates) {
    const contentWidth =
      entries.reduce((sum, entry) => sum + entryWidth(entry.value), 0) + plateEntryGap * (entries.length - 1);
    const plateWidth = contentWidth + platePadX * 2;
    const plateHeight = plateIcon + platePadY * 2;
    const plateX = x - plateWidth / 2;
    const plateY = y + PLATE_DY;
    if (!boundsIntersect({ x0: plateX, y0: plateY, x1: plateX + plateWidth, y1: plateY + plateHeight }, bounds)) {
      continue;
    }

    const iconY = plateY + platePadY;
    const mid = iconY + plateIcon / 2;

    let content = `<rect x="${rn(plateX, 1)}" y="${rn(plateY, 1)}" width="${rn(plateWidth, 1)}" height="${rn(plateHeight, 1)}" rx="${rn(plateRx, 2)}" fill="${PLATE_FILL}"/>`;
    let offset = plateX + platePadX;
    for (const { value, color, stroke, icon } of entries) {
      content += `<circle cx="${rn(offset + plateIcon / 2, 1)}" cy="${rn(mid, 1)}" r="${rn(plateIcon / 2, 2)}" fill="${color}" stroke="${stroke}"/>`;
      content += `<use href="#${icon}" x="${rn(offset, 1)}" y="${rn(iconY, 1)}" width="${rn(plateIcon, 2)}" height="${rn(plateIcon, 2)}"/>`;
      content += `<text x="${rn(offset + plateIcon + plateGap, 1)}" y="${rn(mid, 1)}" dominant-baseline="central" font-size="${rn(plateFont, 2)}px" fill="#28282f" stroke="none">${value}</text>`;
      offset += entryWidth(value) + plateEntryGap;
    }

    markup.push(`<g data-id="${burgId}">${content}</g>`);
  }

  return markup.join("");
}

function getPolygonBox(cellId: number): Box {
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const [x, y] of Pack.getPolygon(cellId)) {
    if (x < box.x0) box.x0 = x;
    if (y < box.y0) box.y0 = y;
    if (x > box.x1) box.x1 = x;
    if (y > box.y1) box.y1 = y;
  }
  return box;
}
