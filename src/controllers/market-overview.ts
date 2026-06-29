import { Controllers } from "@/controllers";
import type { Burg } from "../generators/burgs-generator";
import type { Market } from "../generators/markets-generator";
import { ensureEl, formatPrice, rn } from "../utils";

let isInitialized = false;
let activeMarketId = 0;

function open(marketId: number): void {
  if (customization) return;

  const market = Markets.get(marketId);
  if (!market) {
    tip("Invalid market. The selected market does not exist", true, "error", 5000);
    return;
  }

  closeDialogs("#marketOverview, .stable");

  activeMarketId = marketId;
  marketOverviewAddLines();
  refreshNameInput(market);

  $("#marketOverview").dialog({
    title: `Market Stock: ${Markets.getName(market)}`,
    resizable: false,
    width: "auto",
    close: closeMarketOverview,
    position: {
      my: "right top",
      at: "right-10 top+10",
      of: "svg",
      collision: "fit"
    }
  });

  if (!isInitialized) {
    ensureEl("marketOverviewRefresh").on("click", marketOverviewAddLines);
    ensureEl("marketOverviewExport").on("click", downloadStockCsv);
    ensureEl("marketOverviewOpenDeals").on("click", () => Controllers.MarketDealsOverview.open(activeMarketId));
    ensureEl("marketOverviewName").on("input", onRenameInput);
    ensureEl("marketOverviewNameReset").on("click", resetMarketName);
    isInitialized = true;
  }
}

// The input shows the custom name (empty when using the default); the placeholder shows the default.
function refreshNameInput(market: Market): void {
  const input = ensureEl<HTMLInputElement>("marketOverviewName");
  input.value = market.name || "";
  input.placeholder = pack.burgs[market.centerBurgId]?.name || `Market ${market.i}`;
}

function onRenameInput(this: HTMLInputElement): void {
  const market = Markets.get(activeMarketId);
  if (!market) return;
  const value = this.value.trim();
  market.name = value || undefined;
  $("#marketOverview").dialog("option", "title", `Market Stock: ${Markets.getName(market)}`);
}

function resetMarketName(): void {
  const market = Markets.get(activeMarketId);
  if (!market) return;
  market.name = undefined;
  ensureEl<HTMLInputElement>("marketOverviewName").value = "";
  $("#marketOverview").dialog("option", "title", `Market Stock: ${Markets.getName(market)}`);
}

function marketOverviewAddLines() {
  const market = Markets.get(activeMarketId);
  if (!market) {
    tip("Invalid market. The selected market does not exist", true, "error", 5000);
    return;
  }

  const centerBurg = pack.burgs[market.centerBurgId] as Burg | undefined;
  if (!centerBurg || centerBurg.removed) {
    tip("Invalid market. The selected market has no center burg", true, "error", 5000);
    return;
  }

  let lines = "";
  for (const [goodId, marketGood] of Object.entries(market.goods)) {
    const good = Goods.get(Number(goodId));
    if (!good) continue;
    const stroke = Goods.getStroke(good.color);

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
  ensureEl("marketOverviewGoodsBody").innerHTML = lines || "No market goods available";

  const center = pack.burgs[market.centerBurgId];
  const state = pack.states[center?.state || 0];
  const coaId = `stateCOA${state.i}`;
  if (state) COArenderer.trigger(coaId, state.coa);

  ensureEl("marketOverviewInfo").innerHTML =
    `<svg class="coaIcon" viewBox="0 0 200 200"><use href="#${coaId}"></use></svg><b>Owner:</b> ${state.fullName || state.name}`;

  const burgs = pack.burgs.filter(b => !b.removed && b.market === market.i);
  const totalUnits = Object.values(market.goods).reduce((sum, mg) => sum + mg.stock, 0);
  ensureEl("marketOverviewSummary").innerHTML = /*html*/ `
    <div style="margin-left:5px">Cells: ${pack.cells.market.reduce((count, m) => count + (m === market.i ? 1 : 0), 0)}</div>
    <div style="margin-left:12px">Burgs: ${burgs.length}</div>
    <div style="margin-left:12px">Stock: ${rn(totalUnits, 2)}</div>`;

  applySorting(ensureEl("marketOverviewHeader"));
  $("#marketOverview").dialog({ width: fitContent() });
}

function downloadStockCsv() {
  const market = Markets.get(activeMarketId);
  if (!market) return;

  let csv = "Good,Stock,Buy Price,Sell Price\n";
  for (const [goodId, marketGood] of Object.entries(market.goods)) {
    const good = Goods.get(Number(goodId));
    if (!good) continue;
    const buyPrice = rn(Markets.customerBuyPrice(marketGood.price), 2);
    const sellPrice = rn(Markets.customerSellPrice(marketGood.price), 2);
    csv += `${[good.name, rn(marketGood.stock, 2), buyPrice, sellPrice].join(",")}\n`;
  }
  downloadFile(csv, `${getFileName("Market")}.csv`);
}

function closeMarketOverview() {
  ensureEl("marketOverviewGoodsBody").innerHTML = "";
  ensureEl("marketOverviewSummary").innerHTML = "";
}

export const MarketOverview = { open };
