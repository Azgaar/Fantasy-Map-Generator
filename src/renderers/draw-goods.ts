import type { Good } from "../generators/goods-generator";
import { normalize, rn } from "../utils";
import { getPackPolygon } from "../utils/graphUtils";

const SUBGROUPS = ["goodsCells", "goodsIcons", "goodsBurgs"] as const;

const SIZE = 6;
const HALF = SIZE / 2;

const PLATE_ICON = 3;
const PLATE_FONT = 3.5;
const PLATE_GAP = 0.2;
const PLATE_ENTRY_GAP = 0.8;
const PLATE_DY = 0;
const PLATE_PAD_X = 1;
const PLATE_PAD_Y = 0.6;
const PLATE_RX = 1;
const PLATE_FILL = "#f5f5f5";

export function toggleGoods(event?: MouseEvent) {
  if (!layerIsOn("toggleGoods")) {
    turnButtonOn("toggleGoods");
    drawGoods();
    if (event && isCtrlClick(event)) editStyle("goodsIcons");
  } else {
    if (event && isCtrlClick(event)) return editStyle("goodsIcons");
    SUBGROUPS.forEach(id => void goods.select(`#${id}`).html(""));
    turnButtonOff("toggleGoods");
  }
}

export function drawGoods() {
  TIME && console.time("drawGoods");

  for (const id of SUBGROUPS) {
    if (goods.select(`#${id}`).empty()) goods.append("g").attr("id", id);
  }

  const visible = new Set(pack.goods.filter(good => good.visible).map(good => good.i));
  goods.select("#goodsCells").html(buildGoodsCellsContent(visible));
  goods.select("#goodsIcons").html(buildGoodsIconsContent(visible));
  goods.select("#goodsBurgs").html(buildGoodsBurgsContent(visible));

  goods.style("display", null);
  TIME && console.timeEnd("drawGoods");
}

function buildGoodsCellsContent(displayedGoods: Set<number>): string {
  if (!displayedGoods.size) return "";

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
  if (maxTotal === 0) return "";

  // Second pass: render polygons with opacity normalized against the global max
  let html = "";
  for (const [cellId, { produced, total }] of cellTotals) {
    const opacity = 0.1 + 0.9 * normalize(total, 0, maxTotal);
    const points = getPackPolygon(cellId, pack).join(" ");
    for (const [goodId, amount] of produced) {
      if (amount <= 0) continue;
      const good = Goods.get(goodId);
      if (!good) continue;
      html += `<polygon points="${points}" fill="${good.color}" fill-opacity="${rn(opacity, 2)}"/>`;
    }
  }
  return html;
}

function buildGoodsIconsContent(displayedGoods: Set<number>): string {
  if (!displayedGoods.size || !pack.cells.good) return "";

  const drawCircle = +goods.select("#goodsIcons").attr("data-circle");
  let html = "";
  for (const cellId of pack.cells.i) {
    const goodId = pack.cells.good[cellId];
    if (!goodId || !displayedGoods.has(goodId)) continue;
    const good = Goods.get(goodId);
    if (!good) continue;

    const [x, y] = pack.cells.p[cellId];
    const stroke = Goods.getStroke(good.color);
    html += `<g data-i="${good.i}">${
      drawCircle ? `<circle cx="${x}" cy="${y}" r="${HALF}" fill="${good.color}" stroke="${stroke}" />` : ""
    }<use href="#${good.icon}" x="${x - HALF}" y="${y - HALF}" width="${SIZE}" height="${SIZE}"/></g>`;
  }
  return html;
}

function buildGoodsBurgsContent(displayedGoods: Set<number>): string {
  if (!displayedGoods.size) return "";

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

      const width = PLATE_ICON + PLATE_GAP + String(value).length * 1.2 + 0.4 * PLATE_FONT * 0.62;

      let i = entries.length;
      while (i > 0 && entries[i - 1].value < value) i--;
      entries.splice(i, 0, { good, value, width });
      if (entries.length > 3) entries.pop();
    }
    if (!entries.length) continue;

    const contentWidth = entries.reduce((sum, e) => sum + e.width, 0) + PLATE_ENTRY_GAP * (entries.length - 1);
    const plateWidth = contentWidth + PLATE_PAD_X * 2;
    const plateHeight = PLATE_ICON + PLATE_PAD_Y * 2;
    const plateX = burg.x - plateWidth / 2;
    const plateY = burg.y + PLATE_DY;
    const iconY = plateY + PLATE_PAD_Y;
    const mid = iconY + PLATE_ICON / 2;

    let content = `<rect x="${rn(plateX, 1)}" y="${rn(plateY, 1)}" width="${rn(plateWidth, 1)}" height="${rn(plateHeight, 1)}" rx="${PLATE_RX}" fill="${PLATE_FILL}"/>`;
    let offset = plateX + PLATE_PAD_X;
    for (const { good, value, width } of entries) {
      const stroke = Goods.getStroke(good.color);
      content += `<circle cx="${rn(offset + PLATE_ICON / 2, 1)}" cy="${rn(mid, 1)}" r="${PLATE_ICON / 2}" fill="${good.color}" stroke="${stroke}"/>`;
      content += `<use href="#${good.icon}" x="${rn(offset, 1)}" y="${rn(iconY, 1)}" width="${PLATE_ICON}" height="${PLATE_ICON}"/>`;
      content += `<text x="${rn(offset + PLATE_ICON + PLATE_GAP, 1)}" y="${rn(mid, 1)}" dominant-baseline="central" font-size="${PLATE_FONT}px" fill="#28282f" stroke="none">${value}</text>`;
      offset += width + PLATE_ENTRY_GAP;
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
