import type {Burg} from "../modules/burgs-generator";
import type {Market} from "../modules/trade-generator";
import {ensureEl, rn} from "../utils";
import {downloadDealsCsv} from "./market-deals-overview";

let isInitialized = false;
let activeMarketId = 0;
let showAllGoods = false;

export function open(marketId: number): void {
  if (customization) return;

  const market = Trade.getMarket(marketId);
  if (!market) {
    tip("Invalid market. The selected market does not exist", true, "error", 5000);
    return;
  }

  closeDialogs("#marketOverview, .stable");
  if (!layerIsOn("toggleTrade")) toggleTrade();

  activeMarketId = marketId;
  marketOverviewAddLines();

  $("#marketOverview").dialog({
    title: `Market Overview: ${getMarketCenterName(market)}`,
    resizable: false,
    width: "auto",
    close: closeMarketOverview,
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  if (!isInitialized) {
    ensureEl("marketOverviewRefresh").on("click", marketOverviewAddLines);
    ensureEl("marketOverviewExport").on("click", downloadDealsCsv);
    ensureEl("marketOverviewToggleGoods").on("click", toggleGoodsVisibility);
    ensureEl("marketOverviewOpenDeals").on("click", openMarketDealsOverview);
    isInitialized = true;
  }
}

function marketOverviewAddLines() {
  const market = Trade.getMarket(activeMarketId);
  if (!market) {
    tip("Invalid market. The selected market does not exist", true, "error", 5000);
    return;
  }

  const centerBurg = pack.burgs[market.centerBurgId] as Burg | undefined;
  if (!centerBurg || centerBurg.removed) {
    tip("Invalid market. The selected market has no center burg", true, "error", 5000);
    return;
  }

  ensureEl("marketOverviewStats").innerHTML = /*html*/ `
    <span><b>Owner:</b> ${getOwnerStateName(market)}</span>
    <span><b>Connected Burgs:</b> ${Trade.getMarketBurgIds(market.i).length}</span>`;

  let lines = "";
  for (const [goodId, marketGood] of Object.entries(market.goods)) {
    if (!showAllGoods && marketGood.stock <= 0) continue;
    lines += renderGoodLine(+goodId, marketGood);
  }
  ensureEl("marketOverviewGoodsBody").innerHTML = lines || NO_GOODS_LINE;

  const taxRate = Trade.getSalesTaxRate(centerBurg);
  ensureEl("marketOverviewSummary").innerHTML = /*html*/ `
    <div>Stock: ${rn(totalUnits, 2)}</div>
    <div data-tip="Total money spent on local production buys, demand buys and global imports">Net Buys: ${formatPrice(netBuys)}</div>
    <div data-tip="Net income from local sales after sales tax">Net Sales: ${formatPrice(netSales)}</div>
    <div data-tip="Sales tax collected from local sales">Tax Payed: ${formatPrice(totalTax)} (rate: ${rn(taxRate * 100, 2)}%)</div>`;

  applySorting(ensureEl("marketOverviewGoodsHeader"));
  const stockHeader = ensureEl("marketOverviewGoodsHeader").querySelector(
    '[data-sortby="stock"]'
  ) as HTMLElement | null;
  if (stockHeader) stockHeader.click();
}

function toggleGoodsVisibility() {
  showAllGoods = !showAllGoods;
  ensureEl("marketOverviewToggleGoods").classList.toggle("active", showAllGoods);
  marketOverviewAddLines();
}

function renderGoodLine(goodId: number, marketGood: Market["goods"][number]): string {
  const good = Goods.get(goodId);
  if (!good) return "";

  return /* html */ `<div class="states marketGood"
      data-good="${good.name}"
      data-stock="${rn(marketGood.stock, 2)}"
      data-buyprice="${marketGood.buyPrice}"
      data-sellprice="${marketGood.sellPrice}">
      <div style="width:auto;min-width:0">${getGoodIcon(goodId)}${good.name}</div>
      <div style="width:auto;text-align:right">${rn(marketGood.stock, 2)}</div>
      <div style="width:auto;text-align:right">${formatPrice(marketGood.buyPrice)}</div>
      <div style="width:auto;text-align:right">${formatPrice(marketGood.sellPrice)}</div>
    </div>`;
}

function closeMarketOverview() {
  ensureEl("marketOverviewGoodsBody").innerHTML = "";
  ensureEl("marketOverviewSummary").innerHTML = "";
  showAllGoods = false;
  ensureEl("marketOverviewToggleGoods").classList.remove("active");
}

function getOwnerStateName(market: Market): string {
  const center = pack.burgs[market.centerBurgId] as Burg | undefined;
  if (!center) return "Unknown state";
  if (center.state === undefined) return "Independent";
  return pack.states[center.state].fullName || `State ${center.state}`;
}

function getMarketCenterName(market: Market): string {
  return pack.burgs[market.centerBurgId]?.name || `Market ${market.i}`;
}

function getGoodIcon(goodId: number): string {
  const good = Goods.get(goodId);
  if (!good) return "";

  const stroke = Goods.getStroke(good.color);
  return /*html*/ `<svg data-tip="Good icon" width="2em" height="2em" class="goodIcon">
      <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${stroke}"/>
      <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"/>
    </svg>`;
}

function formatPrice(value: number): string {
  return `🟡 ${rn(value, 2)}`;
}

declare global {
  interface Window {
    MarketOverview: {open: typeof open};
  }
  var toggleTrade: () => void;
}

window.MarketOverview = {open};
