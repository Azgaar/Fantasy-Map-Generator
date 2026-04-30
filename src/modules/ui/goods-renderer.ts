declare global {
  function toggleGoods(event?: MouseEvent): void;
  function drawGoods(): void;
}

function toggleGoods(event?: MouseEvent) {
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

function drawGoods() {
  TIME && console.time("drawGoods");
  const someArePinned = pack.goods.some((good: any) => good.pinned);
  const drawCircle = +goods.attr("data-circle");

  if (!pack.cells.good) return;

  let goodsHTML = "";
  for (const i of pack.cells.i) {
    if (!pack.cells.good[i]) continue;
    const good = Goods.get(pack.cells.good[i]);
    if (!good) continue;
    if (someArePinned && !good.pinned) continue;
    const [x, y] = pack.cells.p[i];
    const stroke = Goods.getStroke(good.color);

    if (!drawCircle) {
      goodsHTML += `<use data-i="${good.i}" href="#${good.icon}" x="${x - 3}" y="${y - 3}" width="6" height="6"/>`;
      continue;
    }

    goodsHTML += `<g>
      <circle data-i="${good.i}" cx=${x} cy=${y} r="3" fill="${good.color}" stroke="${stroke}" />
      <use href="#${good.icon}" x="${x - 3}" y="${y - 3}" width="6" height="6"/>
    </g>`;
  }

  goods.style("display", null).html(goodsHTML);
  TIME && console.timeEnd("drawGoods");
}

window.toggleGoods = toggleGoods;
window.drawGoods = drawGoods;
