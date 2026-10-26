import { interpolateYlOrBr } from "d3";
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
let burgPlates: BurgPlate[] = [];
let burgCircles: BurgCircle[] = [];
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
const ICON_FRAME = 100; // every goods icon is drawn in a 0 0 100 100 frame
const OVERVIEW_SATURATION = 0.95; // percentile from which cells get the darkest color and burgs the biggest circle
const BURG_FILL = "#1e88e5"; // blue stands out on the yellow-brown cells
const LINEWORK = 0.4; // icon lines are this share of the circle outline

/** A goods icon's `<use>` lines: the goods icons style, its width carried into the icon frame at the marker's
 * proportions, so a plate or the interface draws the icon as the marker does */
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
  opacity?: number; // relative output of the selected goods; the overview is solid, the group style dims both
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

/** a burg's output in the overview: the circle's area grows with its value, its size follows the plates style */
interface BurgCircle {
  burgId: number;
  x: number;
  y: number;
  share: number; // of the saturation percentile's output value, at most 1
}

/** a burg plate: the entry list is style-independent, the geometry is laid out per frame */
interface BurgPlate {
  burgId: number;
  x: number;
  y: number;
  entries: PlateEntry[];
}

export async function drawGoods(): Promise<void> {
  log.time("drawGoods");
  await Icons.load("goods");
  buildScene();
  layer.render();
  log.timeEnd("drawGoods");
}

/** Selected goods in detail, or with none selected an overview of all output by value */
function buildScene(): void {
  const selected = new Set(pack.goods.filter(good => good.visible).map(good => good.i));
  resourceIcons = [];
  burgPlates = [];
  burgCircles = [];
  if (selected.size) {
    buildCellProduction(selected);
    buildResourceIcons(selected);
    buildBurgPlates(selected);
  } else {
    buildCellOverview();
    buildBurgCircles();
  }
  sourcePack = pack;
}

/** Output in money: units at the goods' base prices */
const getOutputValue = (produced: Record<number, number>) =>
  Object.entries(produced).reduce((total, [goodId, units]) => total + units * (Goods.get(+goodId)?.value ?? 0), 0);

/** Layer teardown: drop the cached scene and the drawn content */
export function removeGoods(): void {
  sourcePack = null;
  cellProduction = [];
  resourceIcons = [];
  burgPlates = [];
  burgCircles = [];

  const root = findEl("goods");
  if (root) for (const child of Array.from(root.children)) child.replaceChildren();
}

function reconcileGoods({ root, bounds }: ViewportRenderContext): void {
  if (!Layers.isOn("goods")) return;
  if (sourcePack !== pack || root !== document) buildScene();

  const cells = root.querySelector<SVGGElement>("#goodsCells");
  if (cells) cells.innerHTML = renderCellProduction(bounds);

  const icons = root.querySelector<SVGGElement>("#goodsIcons");
  if (icons) icons.innerHTML = renderResourceIcons(bounds);

  const burgs = root.querySelector<SVGGElement>("#goodsBurgs");
  if (burgs) burgs.innerHTML = renderBurgPlates(bounds) + renderBurgCircles(bounds);
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

/** Each producing cell colored by its output value, from pale to dark at the saturation percentile */
function buildCellOverview(): void {
  cellProduction = [];
  const biomeProduction = Goods.getBiomesProduction();
  const values: [number, number][] = [];
  for (const cellId of pack.cells.i) {
    const value = getOutputValue(Production.getCellProduction(cellId, biomeProduction));
    if (value > 0) values.push([cellId, value]);
  }

  // square root spreads the many modest cells over the ramp
  const saturation = getSaturation(values.map(([, value]) => value));
  for (const [cellId, value] of values) {
    const color = interpolateYlOrBr(Math.sqrt(Math.min(1, value / saturation)));
    cellProduction.push({ cellId, colors: [color], ...getPolygonBox(cellId) });
  }
}

/** Every producing burg as a circle sized by its output value */
function buildBurgCircles(): void {
  const values: [Burg, number][] = [];
  for (const burg of pack.burgs) {
    if (!burg.i || burg.removed || !burg.production) continue;
    const value = getOutputValue(Production.getBurgProduction(burg));
    if (value > 0) values.push([burg, value]);
  }
  const saturation = getSaturation(values.map(([, value]) => value));
  burgCircles = values.map(([burg, value]) => ({
    burgId: burg.i!,
    x: burg.x,
    y: burg.y,
    share: Math.min(1, value / saturation)
  }));
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

/** Each burg's three most valuable products, shown in units */
function buildBurgPlates(displayedGoods: Set<number>): void {
  burgPlates = [];
  if (!displayedGoods.size) return;

  for (const burg of pack.burgs) {
    if (!burg.i || burg.removed || !burg.production) continue;

    const produced = Production.getBurgProduction(burg);
    const entries: PlateEntry[] = [];

    const top = pack.goods
      .filter(good => displayedGoods.has(good.i) && produced[good.i] > 0)
      .sort((a, b) => produced[b.i] * b.value - produced[a.i] * a.value)
      .slice(0, 3);
    for (const good of top) {
      entries.push({
        value: rn(produced[good.i], 1),
        color: good.color,
        stroke: Goods.getStroke(good.color),
        icon: good.icon
      });
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
      markup.push(
        `<polygon points="${points}" fill="${color}"${cell.opacity === undefined ? "" : ` fill-opacity="${cell.opacity}"`}/>`
      );
    }
  }

  return markup.join("");
}

function renderResourceIcons(bounds: Box): string {
  const { circle: drawCircle, size: iconSize } = styles.goods.groups.goodsIcons.options;
  const half = iconSize / 2;
  const lines = goodIconLines();
  const markup: string[] = [];

  for (const { x, y, goodId, color, stroke, icon } of resourceIcons) {
    if (!boundsIntersect({ x0: x - half, y0: y - half, x1: x + half, y1: y + half }, bounds)) continue;
    markup.push(
      `<g data-i="${goodId}">${
        drawCircle ? `<circle cx="${x}" cy="${y}" r="${half}" fill="${color}" stroke="${stroke}" />` : ""
      }<use href="${Icons.href(icon)}" x="${rn(x - half, 2)}" y="${rn(y - half, 2)}" width="${iconSize}" height="${iconSize}"${lines}/></g>`
    );
  }

  return markup.join("");
}

function renderBurgPlates(bounds: Box): string {
  // plate icon size is user-defined; the rest of the geometry and font scale with it
  const plateIcon = styles.goods.groups.goodsBurgs.options.size;
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

  const lines = goodIconLines();
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
      content += `<use href="${Icons.href(icon)}" x="${rn(offset, 1)}" y="${rn(iconY, 1)}" width="${rn(plateIcon, 2)}" height="${rn(plateIcon, 2)}"${lines}/>`;
      content += `<text x="${rn(offset + plateIcon + plateGap, 1)}" y="${rn(mid, 1)}" dominant-baseline="central" font-size="${rn(plateFont, 2)}px" fill="#28282f" stroke="none">${value}</text>`;
      offset += entryWidth(value) + plateEntryGap;
    }

    markup.push(`<g data-id="${burgId}">${content}</g>`);
  }

  return markup.join("");
}

function renderBurgCircles(bounds: Box): string {
  // the area grows with the output, the biggest circle half again the plate icon size across its radius
  const maxRadius = styles.goods.groups.goodsBurgs.options.size * 1.5;
  const markup: string[] = [];
  for (const { burgId, x, y, share } of burgCircles) {
    const r = Math.max(0.3, maxRadius * Math.sqrt(share));
    if (!boundsIntersect({ x0: x - r, y0: y - r, x1: x + r, y1: y + r }, bounds)) continue;
    markup.push(
      `<g data-id="${burgId}"><circle cx="${rn(x, 1)}" cy="${rn(y, 1)}" r="${rn(r, 2)}" fill="${BURG_FILL}" fill-opacity="0.9"/></g>`
    );
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
