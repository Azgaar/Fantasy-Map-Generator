import type { Burg } from "../modules/burgs-generator";
import type { Market } from "../modules/trade-generator";
import { ensureEl, formatPrice, rn } from "../utils";

let isInitialized = false;
let activeMarketId = 0;
let showAllGoods = false;

export function open(marketId: number): void {
  if (customization) return;

  const market = Trade.getMarket(marketId);
  if (!market) {
    tip(
      "Invalid market. The selected market does not exist",
      true,
      "error",
      5000,
    );
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
    position: {
      my: "right top",
      at: "right-10 top+10",
      of: "svg",
      collision: "fit",
    },
  });

  if (!isInitialized) {
    ensureEl("marketOverviewRefresh").on("click", marketOverviewAddLines);
    ensureEl("marketOverviewExport").on("click", downloadStockCsv);
    ensureEl("marketOverviewToggleGoods").on("click", toggleGoodsVisibility);
    ensureEl("marketOverviewOpenDeals").on("click", () =>
      window.MarketDealsOverview.open(activeMarketId),
    );
    isInitialized = true;
  }
}

function marketOverviewAddLines() {
  const market = Trade.getMarket(activeMarketId);
  if (!market) {
    tip(
      "Invalid market. The selected market does not exist",
      true,
      "error",
      5000,
    );
    return;
  }

  const centerBurg = pack.burgs[market.centerBurgId] as Burg | undefined;
  if (!centerBurg || centerBurg.removed) {
    tip(
      "Invalid market. The selected market has no center burg",
      true,
      "error",
      5000,
    );
    return;
  }

  let lines = "";
  for (const [goodId, marketGood] of Object.entries(market.goods)) {
    const good = Goods.get(Number(goodId));
    if (!good) continue;
    const stroke = Goods.getStroke(good.color);

    if (!showAllGoods && marketGood.stock <= 0) continue;
    lines += /*html*/ `<div class="states marketGood"
      data-good="${good.name}"
      data-stock="${rn(marketGood.stock, 2)}"
      data-price="${rn(marketGood.price, 2)}">
      <svg data-tip="Good icon" width="2em" height="2em" class="goodIcon">
        <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${stroke}"/>
        <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"/>
      </svg>
      <div data-tip="Good name" class="goodName">${good.name}</div>
      <div data-tip="Good stock" class="marketGoodStock">${rn(marketGood.stock, 2)}</div>
      <div data-tip="Good price" class="marketGoodPrice">${formatPrice(marketGood.price)}</div>
    </div>`;
  }
  ensureEl("marketOverviewGoodsBody").innerHTML =
    lines || "No market goods available";

  const totalUnits = Object.values(market.goods).reduce(
    (sum, mg) => sum + mg.stock,
    0,
  );
  ensureEl("marketOverviewSummary").innerHTML = /*html*/ `
    <div style="margin-left:5px">Owner: ${getOwnerStateName(market)}</div>
    <div style="margin-left:5px">Cells: ${pack.cells.market.reduce((count, m) => count + (m === market.i ? 1 : 0), 0)}</div>
    <div style="margin-left:12px">Burgs: ${Trade.getMarketBurgIds(market.i).length}</div>
    <div style="margin-left:12px">Stock: ${rn(totalUnits, 2)}</div>`;

  applySorting(ensureEl("marketOverviewHeader"));
  $("#marketOverview").dialog({ width: fitContent() });
}

function toggleGoodsVisibility() {
  showAllGoods = !showAllGoods;
  ensureEl("marketOverviewToggleGoods").classList.toggle(
    "active",
    showAllGoods,
  );
  marketOverviewAddLines();
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

function downloadStockCsv() {
  const market = Trade.getMarket(activeMarketId);
  if (!market) return;

  let csv = "Good,Stock,Buy Price,Sell Price\n";
  for (const [goodId, marketGood] of Object.entries(market.goods)) {
    if (!showAllGoods && marketGood.stock <= 0) continue;
    const good = Goods.get(Number(goodId));
    if (!good) continue;
    csv += `${[good.name, rn(marketGood.stock, 2), rn(marketGood.price, 2)].join(",")}\n`;
  }
  downloadFile(csv, `${getFileName("Market_Stock")}.csv`);
}

function closeMarketOverview() {
  ensureEl("marketOverviewGoodsBody").innerHTML = "";
  ensureEl("marketOverviewSummary").innerHTML = "";
  showAllGoods = false;
  ensureEl("marketOverviewToggleGoods").classList.remove("active");
}

declare global {
  interface Window {
    MarketOverview: { open: typeof open };
    MarketDealsOverview: { open: (marketId: number) => void };
  }
  var toggleTrade: () => void;
}

window.MarketOverview = { open };
