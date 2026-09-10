import { select } from "d3";
import { Layers } from "@/components/layers";
import type { Good } from "@/generators/goods-generator";
import type { PackedGraph } from "../types/PackedGraph";
import { getIsolines, normalize, rn } from "../utils";
import { buildFillPaths } from "./isoline-fills";
import { ViewportLayers, type ViewportRenderContext } from "./viewport/viewport-renderer";

const PLATE_ICON = 3;
const PLATE_FONT = 3.5;
const PLATE_GAP = 0.2;
const PLATE_ENTRY_GAP = 0.8;
const PLATE_DY = 0;
const PLATE_PAD_X = 1;
const PLATE_PAD_Y = 0.6;
const PLATE_RX = 1;
const PLATE_FILL = "#f5f5f5";

const CELL_BUCKETS = 5;
const MAX_PLATES = 1000;
const MAX_ICONS = 4000;
const CULL_PAD = 30;

interface SceneItem {
  x: number;
  y: number;
  markup: string;
}

interface CullBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

let iconItems: SceneItem[] = [];
let plateItems: SceneItem[] = [];
let sourcePack: PackedGraph | null = null;

const layer = ViewportLayers.register({ id: "goods", render: reconcileGoods });

export function drawGoods() {
  TIME && console.time("drawGoods");
  buildScene();
  layer.render();
  TIME && console.timeEnd("drawGoods");
}

function buildScene(): void {
  const visible = new Set(pack.goods.filter(good => good.visible).map(good => good.i));
  select("#goods").select("#goodsCells").html(buildGoodsCellsContent(visible));
  iconItems = buildIconItems(visible);
  plateItems = buildPlateItems(visible);
  sourcePack = pack;
}

export function encodeCellFill(goodId: number, normalized: number): number {
  const bucket = Math.min(CELL_BUCKETS - 1, Math.floor(normalized * CELL_BUCKETS));
  return goodId * CELL_BUCKETS + bucket + 1;
}

export function cellFillColor(key: number, getGoodColor: (goodId: number) => string): string {
  const goodId = Math.floor((key - 1) / CELL_BUCKETS);
  const bucket = (key - 1) % CELL_BUCKETS;
  const alpha = 0.1 + (0.9 * (bucket + 1)) / CELL_BUCKETS;
  const alphaHex = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return getGoodColor(goodId) + alphaHex;
}

export function capVisible<T extends { x: number; y: number }>(
  items: T[],
  bounds: CullBounds,
  max: number,
  pad = 0
): T[] {
  const result: T[] = [];
  for (const item of items) {
    if (item.x < bounds.x0 - pad || item.x > bounds.x1 + pad || item.y < bounds.y0 - pad || item.y > bounds.y1 + pad)
      continue;
    result.push(item);
    if (result.length >= max) break;
  }
  return result;
}

export function strideVisible<T extends { x: number; y: number }>(
  items: T[],
  bounds: CullBounds,
  max: number,
  pad = 0
): T[] {
  const visible = capVisible(items, bounds, Infinity, pad);
  if (visible.length <= max) return visible;

  const stride = Math.ceil(visible.length / max);
  const sampled: T[] = [];
  for (let i = 0; i < visible.length; i += stride) sampled.push(visible[i]);
  return sampled;
}

function reconcileGoods(context: ViewportRenderContext): void {
  if (!Layers.isOn("goods")) return;
  if (sourcePack !== pack) buildScene(); // a loaded or regenerated map replaces the production
  const iconsGroup = context.root.querySelector("#goodsIcons");
  const burgsGroup = context.root.querySelector("#goodsBurgs");
  if (!iconsGroup || !burgsGroup) return;

  const { bounds } = context;
  iconsGroup.innerHTML = strideVisible(iconItems, bounds, MAX_ICONS, CULL_PAD)
    .map(item => item.markup)
    .join("");
  burgsGroup.innerHTML = capVisible(plateItems, bounds, MAX_PLATES, CULL_PAD)
    .map(item => item.markup)
    .join("");
}

function buildGoodsCellsContent(displayedGoods: Set<number>): string {
  if (!displayedGoods.size) return "";

  const biomeProduction = Goods.getBiomesProduction();
  const dominant = new Map<number, number>();
  const totals = new Map<number, number>();
  let maxTotal = 0;
  for (const cellId of pack.cells.i) {
    const produced = Production.getCellProduction(cellId, biomeProduction);
    let total = 0;
    let bestGood = 0;
    let bestAmount = 0;
    for (const [goodId, amount] of Object.entries(produced)) {
      if (!displayedGoods.has(+goodId) || amount <= 0) continue;
      total += amount;
      if (amount > bestAmount) {
        bestAmount = amount;
        bestGood = +goodId;
      }
    }
    if (!total) continue;

    dominant.set(cellId, bestGood);
    totals.set(cellId, total);
    if (total > maxTotal) maxTotal = total;
  }
  if (maxTotal === 0) return "";

  const keys = new Int32Array(pack.cells.i.length);
  for (const [cellId, total] of totals) {
    keys[cellId] = encodeCellFill(dominant.get(cellId)!, normalize(total, 0, maxTotal));
  }

  const isolines = getIsolines(pack, cellId => keys[cellId] || null, { fill: true });
  return buildFillPaths("goodsCell", isolines, key => cellFillColor(key, goodId => Goods.get(goodId)?.color ?? "#000"));
}

function buildIconItems(displayedGoods: Set<number>): SceneItem[] {
  if (!displayedGoods.size || !pack.cells.good) return [];

  const drawCircle = styles.goods.goodsIcons.options.circle;
  const iconSize = styles.goods.goodsIcons.options.size;
  const half = iconSize / 2;

  const items: SceneItem[] = [];
  for (const cellId of pack.cells.i) {
    const goodId = pack.cells.good[cellId];
    if (!goodId || !displayedGoods.has(goodId)) continue;
    const good = Goods.get(goodId);
    if (!good) continue;

    const [x, y] = pack.cells.p[cellId];
    const stroke = Goods.getStroke(good.color);
    const markup = `<g data-i="${good.i}">${
      drawCircle ? `<circle cx="${x}" cy="${y}" r="${half}" fill="${good.color}" stroke="${stroke}" />` : ""
    }<use href="#${good.icon}" x="${rn(x - half, 2)}" y="${rn(y - half, 2)}" width="${iconSize}" height="${iconSize}"/></g>`;
    items.push({ x, y, markup });
  }
  return items;
}

function buildPlateItems(displayedGoods: Set<number>): SceneItem[] {
  if (!displayedGoods.size) return [];

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

  const items: (SceneItem & { total: number })[] = [];
  for (const burg of pack.burgs) {
    if (!burg.i || burg.removed || !burg.production) continue;

    const produced = Production.getBurgProduction(burg);
    const entries: { good: Good; value: number; width: number }[] = [];

    for (const good of pack.goods) {
      if (!displayedGoods.has(good.i)) continue;
      const raw = produced[good.i];
      if (!raw || raw <= 0) continue;

      const value = rn(raw, 1);
      if (entries.length === 3 && value <= entries[2].value) continue;

      const width = plateIcon + plateGap + String(value).length * charWidth + 0.4 * plateFont * 0.62;

      let i = entries.length;
      while (i > 0 && entries[i - 1].value < value) i--;
      entries.splice(i, 0, { good, value, width });
      if (entries.length > 3) entries.pop();
    }
    if (!entries.length) continue;

    const contentWidth = entries.reduce((sum, e) => sum + e.width, 0) + plateEntryGap * (entries.length - 1);
    const plateWidth = contentWidth + platePadX * 2;
    const plateHeight = plateIcon + platePadY * 2;
    const plateX = burg.x - plateWidth / 2;
    const plateY = burg.y + PLATE_DY;
    const iconY = plateY + platePadY;
    const mid = iconY + plateIcon / 2;

    let content = `<rect x="${rn(plateX, 1)}" y="${rn(plateY, 1)}" width="${rn(plateWidth, 1)}" height="${rn(plateHeight, 1)}" rx="${rn(plateRx, 2)}" fill="${PLATE_FILL}"/>`;
    let offset = plateX + platePadX;
    for (const { good, value, width } of entries) {
      const stroke = Goods.getStroke(good.color);
      content += `<circle cx="${rn(offset + plateIcon / 2, 1)}" cy="${rn(mid, 1)}" r="${rn(plateIcon / 2, 2)}" fill="${good.color}" stroke="${stroke}"/>`;
      content += `<use href="#${good.icon}" x="${rn(offset, 1)}" y="${rn(iconY, 1)}" width="${rn(plateIcon, 2)}" height="${rn(plateIcon, 2)}"/>`;
      content += `<text x="${rn(offset + plateIcon + plateGap, 1)}" y="${rn(mid, 1)}" dominant-baseline="central" font-size="${rn(plateFont, 2)}px" fill="#28282f" stroke="none">${value}</text>`;
      offset += width + plateEntryGap;
    }

    const total = entries.reduce((sum, e) => sum + e.value, 0);
    items.push({ x: burg.x, y: burg.y, total, markup: `<g data-id="${burg.i}">${content}</g>` });
  }

  // production-sorted so the zoomed-out cap keeps the biggest producers
  items.sort((a, b) => b.total - a.total);
  return items;
}
