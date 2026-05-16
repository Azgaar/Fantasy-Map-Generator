export function toggleGoods(event?: MouseEvent) {
  if (!layerIsOn("toggleGoods")) {
    turnButtonOn("toggleGoods");
    drawGoods();
    if (event && isCtrlClick(event)) editStyle("goods");
  } else {
    if (event && isCtrlClick(event)) return editStyle("goods");
    goods.selectAll("*").remove();
    turnButtonOff("toggleGoods");
  }
}

const SIZE = 6;
const HALF = SIZE / 2;

export function drawGoods(pinnedGoods?: Set<number>) {
  TIME && console.time("drawGoods");
  const drawCircle = +goods.attr("data-circle");

  if (!pack.cells.good) return;

  let goodsHTML = "";
  for (const i of pack.cells.i) {
    if (!pack.cells.good[i]) continue;
    const good = Goods.get(pack.cells.good[i]);
    if (!good) continue;
    if (pinnedGoods?.size && !pinnedGoods.has(good.i)) continue;
    const [x, y] = pack.cells.p[i];
    const stroke = Goods.getStroke(good.color);

    if (!drawCircle) {
      goodsHTML += `<use data-i="${good.i}" href="#${good.icon}" x="${HALF}" y="${HALF}" width="${SIZE}" height="${SIZE}"/>`;
      continue;
    }

    goodsHTML += `<g>
      <circle data-i="${good.i}" cx="${x}" cy="${y}" r="${HALF}" fill="${good.color}" stroke="${stroke}" />
      <use href="#${good.icon}" x="${x - HALF}" y="${y - HALF}" width="${SIZE}" height="${SIZE}"/>
    </g>`;
  }

  goods.style("display", null).html(goodsHTML);
  TIME && console.timeEnd("drawGoods");
}

declare global {
  interface Window {
    toggleGoods: typeof toggleGoods;
    drawGoods: typeof drawGoods;
  }
}

window.toggleGoods = toggleGoods;
window.drawGoods = drawGoods;
