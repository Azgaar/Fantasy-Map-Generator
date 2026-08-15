import { select } from "d3";
import { Scene, ViewportLayers, type ViewportRenderContext } from "@/renderers/viewport/viewport-renderer";
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
  color: string;
}

interface GoodsCellSceneItem {
  id: string;
  cellId: number;
  total: number;
  produced: ProducedGood[];
}

const cellsScene = new Scene<GoodsCellSceneItem>();
const cellsLayer = ViewportLayers.register({ id: "goods-cells", render: reconcileGoodsCells });

export function toggleGoods(event?: MouseEvent) {
  if (!layerIsOn("toggleGoods")) {
    turnButtonOn("toggleGoods");
    drawGoods();
    if (event && isCtrlClick(event)) editStyle("goodsIcons");
  } else {
    if (event && isCtrlClick(event)) return editStyle("goodsIcons");
    SUBGROUPS.forEach(id => void select("#goods").select(`#${id}`).html(""));
    turnButtonOff("toggleGoods");
  }
}

export function drawGoods() {
  TIME && console.time("drawGoods");

  for (const id of SUBGROUPS) {
    if (select("#goods").select(`#${id}`).empty()) select("#goods").append("g").attr("id", id);
  }

  const visible = new Set(pack.goods.filter(good => good.visible).map(good => good.i));
  cellsScene.replace(buildGoodsCellsScene(visible));
  cellsLayer.render();
  select("#goods").select("#goodsIcons").html(buildGoodsIconsContent(visible));
  select("#goods").select("#goodsBurgs").html(buildGoodsBurgsContent(visible));

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
      filteredProduced.push({ color: good.color });
    }
    if (!total) continue;

    cellTotals.push({ id: `goods-cell-${cellId}`, cellId, total, produced: filteredProduced });
    if (total > maxTotal) maxTotal = total;
  }
  return maxTotal ? cellTotals.map(item => ({ ...item, total: item.total / maxTotal })) : [];
}

function reconcileGoodsCells(context: ViewportRenderContext): void {
  const goodsCells = context.root.querySelector<SVGGElement>("#goodsCells");
  if (!goodsCells) return;
  if (!cellsScene.valid) return;
  if (!layerIsOn("toggleGoods")) return void goodsCells.replaceChildren();

  const { x0, y0, x1, y1 } = context.bounds;
  const markup: string[] = [];
  for (const { cellId, total, produced } of cellsScene.values()) {
    const [x, y] = pack.cells.p[cellId];
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    const opacity = rn(0.1 + 0.9 * normalize(total, 0, 1), 2);
    const points = getPackPolygon(cellId, pack).join(" ");
    for (const good of produced) {
      markup.push(`<polygon points="${points}" fill="${good.color}" fill-opacity="${opacity}"/>`);
    }
  }
  goodsCells.innerHTML = markup.join("");
}

function buildGoodsIconsContent(displayedGoods: Set<number>): string {
  if (!displayedGoods.size || !pack.cells.good) return "";

  const iconsGroup = select("#goods").select("#goodsIcons");
  const drawCircle = +iconsGroup.attr("data-circle");
  const iconSize = +iconsGroup.attr("data-size") || DEFAULT_SIZE;
  const half = iconSize / 2;
  let html = "";
  for (const cellId of pack.cells.i) {
    const goodId = pack.cells.good[cellId];
    if (!goodId || !displayedGoods.has(goodId)) continue;
    const good = Goods.get(goodId);
    if (!good) continue;

    const [x, y] = pack.cells.p[cellId];
    const stroke = Goods.getStroke(good.color);
    html += `<g data-i="${good.i}">${
      drawCircle ? `<circle cx="${x}" cy="${y}" r="${half}" fill="${good.color}" stroke="${stroke}" />` : ""
    }<use href="#${good.icon}" x="${rn(x - half, 2)}" y="${rn(y - half, 2)}" width="${iconSize}" height="${iconSize}"/></g>`;
  }
  return html;
}

function buildGoodsBurgsContent(displayedGoods: Set<number>): string {
  if (!displayedGoods.size) return "";

  // plate icon size is user-defined; the rest of the geometry and font scale with it
  const plateIcon = +select("#goods").select("#goodsBurgs").attr("data-size") || PLATE_ICON;
  const scale = plateIcon / PLATE_ICON;
  const plateFont = PLATE_FONT * scale;
  const plateGap = PLATE_GAP * scale;
  const plateEntryGap = PLATE_ENTRY_GAP * scale;
  const platePadX = PLATE_PAD_X * scale;
  const platePadY = PLATE_PAD_Y * scale;
  const plateRx = PLATE_RX * scale;
  const charWidth = 1.2 * scale;

  let html = "";
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

    html += `<g data-id="${burg.i}">${content}</g>`;
  }
  return html;
}

declare global {
  interface Window {
    toggleGoods: typeof toggleGoods;
    drawGoods: typeof drawGoods;
  }
}

window.toggleGoods = toggleGoods;
window.drawGoods = drawGoods;
