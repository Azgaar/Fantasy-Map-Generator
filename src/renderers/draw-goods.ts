import { select } from "d3";
import { reconcileSvgMarkupElements, type SvgMarkupItem } from "@/renderers/viewport/svg-markup-reconciler";
import { SpatialIndex, ViewportLayers, type ViewportRenderContext } from "@/renderers/viewport/viewport-renderer";
import { isCtrlClick } from "@/utils";
import type { Good } from "../generators/goods-generator";
import { normalize, rn } from "../utils";
import { getPackPolygon } from "../utils/graphUtils";

const SUBGROUPS = ["goodsCells", "goodsIcons", "goodsBurgs"] as const;

const PLATE_ICON = 3;
const PLATE_FONT = 3.5;
const PLATE_GAP = 0.2;
const PLATE_ENTRY_GAP = 0.8;
const PLATE_DY = 0;
const PLATE_PAD_X = 1;
const PLATE_PAD_Y = 0.6;
const PLATE_RX = 1;
const PLATE_FILL = "#f5f5f5";
const DEFAULT_SIZE = 6;

interface ProducedGood {
  id: number;
  color: string;
}

interface GoodsCellSceneItem {
  cellId: number;
  total: number;
  produced: ProducedGood[];
}

interface GoodsBurgSceneItem {
  burgId: number;
  x: number;
  y: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  markup: string;
}

const cellsIndex = new SpatialIndex<GoodsCellSceneItem>();
const iconsIndex = new SpatialIndex<number>();
const burgsIndex = new SpatialIndex<GoodsBurgSceneItem>();
let maximumBurgWidth = 0;
let maximumBurgHeight = 0;
const layer = ViewportLayers.register({ id: "goods", render: reconcileGoods, clear: clearGoods });

export function toggleGoods(event?: MouseEvent) {
  if (!layerIsOn("toggleGoods")) {
    turnButtonOn("toggleGoods");
    drawGoods();
    if (event && isCtrlClick(event)) editStyle("goodsIcons");
  } else {
    if (event && isCtrlClick(event)) return editStyle("goodsIcons");
    clearGoods();
    turnButtonOff("toggleGoods");
  }
}

export function drawGoods() {
  TIME && console.time("drawGoods");

  for (const id of SUBGROUPS) {
    if (select("#goods").select(`#${id}`).empty()) select("#goods").append("g").attr("id", id);
  }

  const displayedGoods = new Set(pack.goods.filter(good => good.visible).map(good => good.i));
  const cellItems = buildGoodsCellsScene(displayedGoods);
  cellsIndex.replace(cellItems, item => pack.cells.p[item.cellId]);
  iconsIndex.replace(pack.cells.i, cellId => {
    const goodId = pack.cells.good?.[cellId];
    return goodId && displayedGoods.has(goodId) ? pack.cells.p[cellId] : null;
  });
  const burgItems = buildGoodsBurgsScene(displayedGoods);
  burgsIndex.replace(burgItems, item => [item.x, item.y]);
  layer.render();

  select("#goods").style("display", null);
  TIME && console.timeEnd("drawGoods");
}

function buildGoodsCellsScene(displayedGoods: Set<number>): GoodsCellSceneItem[] {
  if (!displayedGoods.size) return [];

  const cellTotals: GoodsCellSceneItem[] = [];
  const biomeProduction = Goods.getBiomesProduction();
  let maxTotal = 0;
  for (const cellId of pack.cells.i) {
    let total = 0;
    const produced = Production.getCellProduction(cellId, biomeProduction);
    const filteredProduced: ProducedGood[] = [];
    for (const goodId in produced) {
      const amount = produced[goodId];
      if (!displayedGoods.has(+goodId) || amount <= 0) continue;
      const good = Goods.get(+goodId);
      if (!good) continue;
      total += amount;
      filteredProduced.push({ id: good.i, color: good.color });
    }
    if (!total) continue;

    cellTotals.push({ cellId, total, produced: filteredProduced });
    if (total > maxTotal) maxTotal = total;
  }

  if (maxTotal) for (const item of cellTotals) item.total /= maxTotal;
  return cellTotals;
}

function buildGoodsBurgsScene(displayedGoods: Set<number>): GoodsBurgSceneItem[] {
  maximumBurgWidth = 0;
  maximumBurgHeight = 0;
  if (!displayedGoods.size) return [];

  const burgsGroup = select("#goods").select("#goodsBurgs");
  const plateIcon = +burgsGroup.attr("data-size") || PLATE_ICON;
  const plateScale = plateIcon / PLATE_ICON;
  const plateFont = PLATE_FONT * plateScale;
  const plateGap = PLATE_GAP * plateScale;
  const plateEntryGap = PLATE_ENTRY_GAP * plateScale;
  const platePadX = PLATE_PAD_X * plateScale;
  const platePadY = PLATE_PAD_Y * plateScale;
  const plateRx = PLATE_RX * plateScale;
  const charWidth = 1.2 * plateScale;
  const items: GoodsBurgSceneItem[] = [];

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
      let index = entries.length;
      while (index > 0 && entries[index - 1].value < value) index--;
      entries.splice(index, 0, { good, value, width });
      if (entries.length > 3) entries.pop();
    }
    if (!entries.length) continue;

    const contentWidth = entries.reduce((sum, entry) => sum + entry.width, 0) + plateEntryGap * (entries.length - 1);
    const plateWidth = contentWidth + platePadX * 2;
    const plateHeight = plateIcon + platePadY * 2;
    maximumBurgWidth = Math.max(maximumBurgWidth, plateWidth);
    maximumBurgHeight = Math.max(maximumBurgHeight, plateHeight);
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

    items.push({
      burgId: burg.i,
      x: burg.x,
      y: burg.y,
      x0: plateX,
      y0: plateY,
      x1: plateX + plateWidth,
      y1: plateY + plateHeight,
      markup: `<g data-id="${burg.i}">${content}</g>`
    });
  }

  return items;
}

function reconcileGoods(context: ViewportRenderContext): void {
  const goodsCells = context.root.querySelector<SVGGElement>("#goodsCells");
  const goodsIcons = context.root.querySelector<SVGGElement>("#goodsIcons");
  const goodsBurgs = context.root.querySelector<SVGGElement>("#goodsBurgs");
  if (!goodsCells || !goodsIcons || !goodsBurgs) return;
  if (!cellsIndex.valid || !iconsIndex.valid || !burgsIndex.valid) return;
  if (!layerIsOn("toggleGoods")) {
    goodsCells.replaceChildren();
    goodsIcons.replaceChildren();
    goodsBurgs.replaceChildren();
    return;
  }

  const { x0, y0, x1, y1 } = context.bounds;
  const cellItems: SvgMarkupItem[] = [];
  for (const { cellId, total, produced } of cellsIndex.values(context.bounds)) {
    const [x, y] = pack.cells.p[cellId];
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    const opacity = rn(0.1 + 0.9 * normalize(total, 0, 1), 2);
    const points = getPackPolygon(cellId, pack).join(" ");
    for (const good of produced) {
      const markup = `<polygon points="${points}" fill="${good.color}" fill-opacity="${opacity}"/>`;
      cellItems.push({ id: `${cellId}:${good.id}`, key: markup, markup });
    }
  }
  reconcileSvgMarkupElements(goodsCells, cellItems);

  const drawCircle = +goodsIcons.dataset.circle!;
  const iconSize = +goodsIcons.dataset.size! || DEFAULT_SIZE;
  const half = iconSize / 2;
  const iconBounds = { ...context.bounds, x0: x0 - half, y0: y0 - half, x1: x1 + half, y1: y1 + half };
  const iconItems: SvgMarkupItem[] = [];
  for (const cellId of iconsIndex.values(iconBounds)) {
    const good = Goods.get(pack.cells.good[cellId]);
    if (!good) continue;
    const [x, y] = pack.cells.p[cellId];
    if (x + half < x0 || x - half > x1 || y + half < y0 || y - half > y1) continue;
    const stroke = Goods.getStroke(good.color);
    const markup = `<g data-i="${good.i}">${
      drawCircle ? `<circle cx="${x}" cy="${y}" r="${half}" fill="${good.color}" stroke="${stroke}" />` : ""
    }<use href="#${good.icon}" x="${rn(x - half, 2)}" y="${rn(y - half, 2)}" width="${iconSize}" height="${iconSize}"/></g>`;
    iconItems.push({ id: String(cellId), key: markup, markup });
  }
  reconcileSvgMarkupElements(goodsIcons, iconItems);

  const burgItems: SvgMarkupItem[] = [];
  const burgBounds = {
    ...context.bounds,
    x0: x0 - maximumBurgWidth,
    y0: y0 - maximumBurgHeight,
    x1: x1 + maximumBurgWidth,
    y1: y1 + maximumBurgHeight
  };
  for (const item of burgsIndex.values(burgBounds)) {
    if (item.x1 < x0 || item.x0 > x1 || item.y1 < y0 || item.y0 > y1) continue;
    burgItems.push({ id: String(item.burgId), key: item.markup, markup: item.markup });
  }
  reconcileSvgMarkupElements(goodsBurgs, burgItems);
}

function clearGoods(): void {
  cellsIndex.clear();
  iconsIndex.clear();
  burgsIndex.clear();
  maximumBurgWidth = 0;
  maximumBurgHeight = 0;
  for (const id of SUBGROUPS) document.querySelector(`#goods > #${id}`)?.replaceChildren();
}

declare global {
  interface Window {
    toggleGoods: typeof toggleGoods;
    drawGoods: typeof drawGoods;
  }
}

window.toggleGoods = toggleGoods;
window.drawGoods = drawGoods;
