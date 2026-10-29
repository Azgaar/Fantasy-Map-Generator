import { Goods } from "@/model/economy/goods-generator";
import { Production } from "@/model/economy/production-generator";
import { Pack } from "@/model/graph/pack-generator";
import { Icons } from "@/model/icons";
import type { Burg } from "@/model/political/burgs-generator";
import { Layers } from "@/renderers/layers";
import {
  type Box,
  boundsIntersect,
  ViewportLayers,
  type ViewportRenderContext
} from "@/renderers/viewport/viewport-renderer";
import type { PackedGraph } from "@/types/packed-graph";
import { log } from "@/utils/logger";
import { findEl } from "@/utils/node-utils";
import { normalize, rn } from "@/utils/number-utils";

const layer = ViewportLayers.register({ id: "goods", render: reconcileGoods });
let cellProduction: CellProduction[] = [];
let resourceIcons: ResourceIcon[] = [];
let burgCircles: BurgCircle[] = [];
let sourcePack: PackedGraph | null = null;

const ICON_FRAME = 100; // every goods icon is drawn in a 0 0 100 100 frame
const OVERVIEW_SATURATION = 0.95; // percentile from which cells get the darkest color and burgs the biggest circle
const PIE_GOODS = 5; // a burg pie shows its most valuable goods, the rest in one sector
const OTHER_FILL = "#9e9e9e";
const LINEWORK = 0.4; // icon lines are this share of the circle outline

/** A goods icon's `<use>` lines: the goods icons style, its width carried into the icon frame at the marker's
 * proportions, so the interface draws the icon as the marker does */
export function goodIconLines(): string {
  const { attrs, options } = styles.goods.groups.goodsIcons;
  const width = ((attrs["stroke-width"] ?? 1) * LINEWORK * ICON_FRAME) / options.size;
  return ` stroke="${attrs.stroke ?? "none"}" stroke-width="${rn(width, 2)}"`;
}

/** A good's icon on its circle, filling any svg: the interface draws a good as the map does */
export function goodBadge({ color, icon }: { color: string; icon: string }): string {
  return `<circle cx="50%" cy="50%" r="42%" fill="${color}" stroke="${Goods.getStroke(color)}"/><use href="${Icons.href(icon)}" x="10%" y="10%" width="80%" height="80%"${goodIconLines()}/>`;
}

/** a producing cell: the polygon points are re-read per frame, only the visible ones */
interface CellProduction extends Box {
  cellId: number;
  opacity: number; // relative output value; the group style dims it further
  colors: string[];
}

interface ResourceIcon {
  cellId: number;
  x: number;
  y: number;
  goodId: number;
  color: string;
  stroke: string;
  icon: string;
}

/** a burg's output of the shown goods: a pie of them by value, its area grows with the total, its size follows the style */
interface BurgCircle {
  burgId: number;
  x: number;
  y: number;
  share: number; // of the saturation percentile's output value, at most 1
  sectors: PieSector[];
}

interface PieSector {
  goods: number[]; // one good, or the rest of the burg's goods
  color: string;
  share: number; // of the burg's output value
}

export async function drawGoods(): Promise<void> {
  log.time("drawGoods");
  await Icons.load("goods");
  buildScene();
  layer.render();
  log.timeEnd("drawGoods");
}

/** Selected goods in detail, or with none selected an overview of every good: cells by their output value */
function buildScene(): void {
  const selected = new Set(pack.goods.filter(good => good.visible).map(good => good.i));
  const shown = selected.size ? selected : new Set(pack.goods.map(good => good.i));
  if (selected.size) buildCellProduction(selected);
  else buildCellOverview();
  buildResourceIcons(shown);
  buildBurgCircles(shown);
  sourcePack = pack;
}

/** Layer teardown: drop the cached scene and the drawn content */
export function removeGoods(): void {
  sourcePack = null;
  cellProduction = [];
  resourceIcons = [];
  burgCircles = [];

  const root = findEl("goods");
  if (root) for (const child of Array.from(root.children)) child.replaceChildren();
}

function reconcileGoods({ root, bounds }: ViewportRenderContext): void {
  if (!Layers.isOn("goods")) return;
  if (sourcePack !== pack || root !== document) buildScene();

  const { goodsCells, goodsIcons, goodsBurgs } = styles.goods.groups;
  const cells = root.querySelector<SVGGElement>("#goodsCells");
  if (cells) cells.innerHTML = goodsCells.options.render ? renderCellProduction(bounds) : "";

  const icons = root.querySelector<SVGGElement>("#goodsIcons");
  if (icons) icons.innerHTML = goodsIcons.options.render ? renderResourceIcons(bounds) : "";

  const burgs = root.querySelector<SVGGElement>("#goodsBurgs");
  if (burgs) burgs.innerHTML = goodsBurgs.options.render ? renderBurgCircles(bounds) : "";
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

/** A high percentile of the values: a few outliers would leave everything else pale and small against the maximum */
function getSaturation(values: number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * OVERVIEW_SATURATION)] || 1;
}

/** Every producing cell in its most valuable good's color, its opacity following its output value */
function buildCellOverview(): void {
  cellProduction = [];
  const biomeProduction = Goods.getBiomesProduction();
  const cells: [number, number, string][] = [];
  for (const cellId of pack.cells.i) {
    let value = 0;
    let top: { color: string; value: number } | null = null;
    for (const [goodId, units] of Object.entries(Production.getCellProduction(cellId, biomeProduction))) {
      const good = Goods.get(+goodId);
      const goodValue = good ? units * good.value : 0;
      if (!good || goodValue <= 0) continue;
      value += goodValue;
      if (!top || goodValue > top.value) top = { color: good.color, value: goodValue };
    }
    if (top) cells.push([cellId, value, top.color]);
  }

  const saturation = getSaturation(cells.map(([, value]) => value));
  for (const [cellId, value, color] of cells) {
    const opacity = rn(0.1 + 0.9 * Math.min(1, value / saturation), 2);
    cellProduction.push({ cellId, colors: [color], opacity, ...getPolygonBox(cellId) });
  }
}

/** Every burg producing the shown goods as a pie of them, sized by its output value */
function buildBurgCircles(shown: Set<number>): void {
  const values: [Burg, number, PieSector[]][] = [];
  for (const burg of pack.burgs) {
    if (!burg.i || burg.removed || !burg.production) continue;
    // output in money: units at the goods' base prices
    const goods = Object.entries(Production.getBurgProduction(burg))
      .flatMap(([goodId, units]) => {
        const good = shown.has(+goodId) ? Goods.get(+goodId) : undefined;
        const value = good ? units * good.value : 0;
        return good && value > 0 ? [{ good, value }] : [];
      })
      .sort((a, b) => b.value - a.value);
    const value = goods.reduce((total, good) => total + good.value, 0);
    if (!value) continue;

    const sectors: PieSector[] = goods
      .slice(0, PIE_GOODS)
      .map(({ good, value: goodValue }) => ({ goods: [good.i], color: good.color, share: goodValue / value }));
    const rest = goods.slice(PIE_GOODS);
    if (rest.length) {
      const share = rest.reduce((total, good) => total + good.value, 0) / value;
      sectors.push({ goods: rest.map(({ good }) => good.i), color: OTHER_FILL, share });
    }
    values.push([burg, value, sectors]);
  }
  const saturation = getSaturation(values.map(([, value]) => value));
  burgCircles = values.map(([burg, value, sectors]) => ({
    burgId: burg.i!,
    x: burg.x,
    y: burg.y,
    share: Math.min(1, value / saturation),
    sectors
  }));
}

/** Deposit cells, an icon at each cell's center, or at its burg's, in the middle of the burg's pie */
function buildResourceIcons(shown: Set<number>): void {
  resourceIcons = [];
  if (!pack.cells.good) return;

  for (const cellId of pack.cells.i) {
    const goodId = pack.cells.good[cellId];
    if (!goodId || !shown.has(goodId)) continue;
    const good = Goods.get(goodId);
    if (!good) continue;

    const burg = pack.burgs[pack.cells.burg?.[cellId] || 0];
    const [x, y] = burg?.i && !burg.removed ? [burg.x, burg.y] : pack.cells.p[cellId];
    resourceIcons.push({
      cellId,
      x,
      y,
      goodId,
      color: good.color,
      stroke: Goods.getStroke(good.color),
      icon: good.icon
    });
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
  const { circle: drawCircle, size: iconSize } = styles.goods.groups.goodsIcons.options;
  const half = iconSize / 2;
  const lines = goodIconLines();
  const markup: string[] = [];

  for (const { cellId, x, y, goodId, color, stroke, icon } of resourceIcons) {
    if (!boundsIntersect({ x0: x - half, y0: y - half, x1: x + half, y1: y + half }, bounds)) continue;
    markup.push(
      `<g data-i="${goodId}" data-cell="${cellId}">${
        drawCircle ? `<circle cx="${x}" cy="${y}" r="${half}" fill="${color}" stroke="${stroke}" />` : ""
      }<use href="${Icons.href(icon)}" x="${rn(x - half, 2)}" y="${rn(y - half, 2)}" width="${iconSize}" height="${iconSize}"${lines}/></g>`
    );
  }

  return markup.join("");
}

function renderBurgCircles(bounds: Box): string {
  // the area grows with the output, the biggest circle's radius 1.5 times the size setting
  const maxRadius = styles.goods.groups.goodsBurgs.options.size * 1.5;
  const markup: string[] = [];
  for (const { burgId, x, y, share, sectors } of burgCircles) {
    const r = Math.max(0.3, maxRadius * Math.sqrt(share));
    if (!boundsIntersect({ x0: x - r, y0: y - r, x1: x + r, y1: y + r }, bounds)) continue;
    markup.push(`<g data-id="${burgId}">${renderPie(x, y, r, sectors)}</g>`);
  }
  return markup.join("");
}

/** Sectors clockwise from the top, the most valuable first */
function renderPie(x: number, y: number, r: number, sectors: PieSector[]): string {
  if (sectors.length === 1) {
    const [{ goods, color }] = sectors;
    return `<circle data-goods="${goods}" cx="${rn(x, 1)}" cy="${rn(y, 1)}" r="${rn(r, 2)}" fill="${color}"/>`;
  }

  const point = (angle: number) => `${rn(x + r * Math.sin(angle), 2)},${rn(y - r * Math.cos(angle), 2)}`;
  let start = 0;
  return sectors
    .map(({ goods, color, share }) => {
      const end = start + share * 2 * Math.PI;
      const large = end - start > Math.PI ? 1 : 0;
      const path = `M${rn(x, 2)},${rn(y, 2)}L${point(start)}A${rn(r, 2)},${rn(r, 2)} 0 ${large} 1 ${point(end)}Z`;
      start = end;
      return `<path data-goods="${goods}" d="${path}" fill="${color}"/>`;
    })
    .join("");
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
