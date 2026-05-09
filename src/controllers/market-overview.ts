import type {Burg} from "../modules/burgs-generator";
import type {Deal, Market, TradePhase} from "../modules/trade-generator";
import {ensureEl, rn} from "../utils";

let isInitialized = false;
let activeMarketId = 0;

type DealKind = "BUY" | "SELL" | "GLOBAL";

const PHASE: Record<TradePhase, {label: string; kind: DealKind; tip: string}> = {
  "local-production-buy": {
    label: "PROD BUY",
    kind: "BUY",
    tip: "Local market purchase for production"
  },
  "local-demand-buy": {
    label: "DEMAND BUY",
    kind: "BUY",
    tip: "Local market purchase to fill burg demand"
  },
  "local-sale": {
    label: "SALE",
    kind: "SELL",
    tip: "Sale to the local market"
  },
  global: {
    label: "GLOBAL",
    kind: "GLOBAL",
    tip: "Redistribution between markets"
  }
};

function open(marketId: number): void {
  if (customization) return;
  closeDialogs("#marketOverview, .stable");
  if (!layerIsOn("toggleTrade")) toggleTrade();

  if (!isInitialized) {
    ensureEl("marketOverviewRefresh").on("click", marketOverviewAddLines);
    ensureEl("marketOverviewExport").on("click", downloadDealsCsv);
    isInitialized = true;
  }

  activeMarketId = marketId;
  marketOverviewAddLines();

  const market = Trade.getMarket(marketId);
  if (!market) {
    tip("Invalid market. The selected market does not exist", true, "error", 5000);
    return;
  }

  $("#marketOverview").dialog({
    title: `Market Overview: ${getMarketCenterName(market)}`,
    resizable: false,
    width: "44em",
    close: closeMarketOverview,
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });
}

function closeMarketOverview(): void {
  ensureEl("marketOverviewGoodsBody").innerHTML = "";
  ensureEl("marketOverviewDealsBody").innerHTML = "";
}

function marketOverviewAddLines(): void {
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

  const deals = getMarketDeals(market.i);
  const goodsLines = renderGoodsLines(market);
  const dealsLines = renderDealsLines(deals, market);
  const summary = getSummary(deals, centerBurg);

  ensureEl("marketOverviewStats").innerHTML = renderStatsLine(market, centerBurg, summary.totalUnits);
  ensureEl("marketOverviewSummary").innerHTML = renderSummaryLine(summary);
  ensureEl("marketOverviewGoodsBody").innerHTML =
    goodsLines || `<div style="padding:.35em .45em;color:#777;font-style:italic">No market goods available</div>`;
  ensureEl("marketOverviewDealsBody").innerHTML =
    dealsLines || `<div style="padding:.35em .45em;color:#777;font-style:italic">No market deals recorded</div>`;

  ensureEl("marketOverviewFooterDeals").innerHTML = String(deals.length);
  ensureEl("marketOverviewFooterUnits").innerHTML = String(rn(summary.totalUnits, 2));
  ensureEl("marketOverviewFooterNet").innerHTML = formatPrice(summary.netFlow);

  applySorting(ensureEl("marketOverviewGoodsHeader"));
  applySorting(ensureEl("marketOverviewDealsHeader"));
  $("#marketOverview").dialog({width: fitContent()});
}

function getMarketDeals(marketId: number): Deal[] {
  return (pack.deals || []).filter(deal => deal.market === marketId).sort((a, b) => a.id - b.id);
}

function renderGoodsLines(market: Market): string {
  return Object.entries(market.goods)
    .map(([goodId, marketGood]) => renderGoodLine(+goodId, marketGood))
    .filter(Boolean)
    .join("");
}

function renderDealsLines(deals: Deal[], market: Market): string {
  return deals.map(deal => renderDealLine(deal, market)).join("");
}

function renderStatsLine(market: Market, centerBurg: Burg, totalUnits: number): string {
  const taxRate = Trade.getSalesTaxRate(centerBurg);
  return /* html */ `
    <span><b>Trade Center:</b> ${centerBurg.name} (${market.i})</span>
    <span><b>Owner:</b> ${getOwnerStateName(market)}</span>
    <span><b>Connected Burgs:</b> ${Trade.getMarketBurgIds(market.i).length}</span>
    <span><b>State Sales Tax:</b> ${rn(taxRate * 100, 2)}%</span>
    <span><b>Recorded Units:</b> ${rn(totalUnits, 2)}</span>
  `;
}

function renderSummaryLine(summary: ReturnType<typeof getSummary>): string {
  return /* html */ `<div style="display:flex;justify-content:space-between;padding:0 .5em;gap:1em;flex-wrap:wrap">
    <span title="All recorded deals for this market"><b>Deals:</b> <span style="font-weight:600">${summary.totalDeals}</span></span>
    <span title="Redistribution deals where this market was the importer"><b>Global Deals:</b> <span style="font-weight:600">${summary.globalDeals}</span></span>
    <span title="Total money spent on local production buys, demand buys and global imports"><b>Buy Spend:</b> <span style="font-weight:600;color:#c44">${formatPrice(summary.buySpend)}</span></span>
    <span title="Net income from local sales after sales tax"><b>Sale Income:</b> <span style="font-weight:600;color:#2a6">${formatPrice(summary.saleIncome)}</span></span>
    <span title="Sales tax collected from local sales"><b>Total Tax:</b> <span style="font-weight:600;color:#c84">${formatPrice(summary.totalTax)}</span></span>
    <span title="Sale income minus purchase spend"><b>Net Flow:</b> <span style="font-weight:600;color:${summary.netFlow >= 0 ? "#2a6" : "#c44"}">${formatPrice(summary.netFlow)}</span></span>
  </div>`;
}

function getSummary(deals: Deal[], centerBurg: Burg) {
  const sales = deals.filter(deal => deal.phase === "local-sale");
  const buys = deals.filter(deal => deal.phase !== "local-sale");

  const totalDeals = deals.length;
  const globalDeals = deals.filter(deal => deal.phase === "global").length;
  const totalUnits = deals.reduce((sum, deal) => sum + deal.units, 0);
  const buySpend = buys.reduce((sum, deal) => sum + getDealSpend(deal), 0);
  const grossSaleIncome = sales.reduce((sum, deal) => sum + getDealRevenue(deal), 0);
  const totalTax = grossSaleIncome * Trade.getSalesTaxRate(centerBurg);
  const saleIncome = grossSaleIncome - totalTax;
  const netFlow = saleIncome - buySpend;

  return {totalDeals, globalDeals, totalUnits, buySpend, totalTax, saleIncome, netFlow};
}

function renderDealLine(deal: Deal, market: Market): string {
  const phase = PHASE[deal.phase];
  const dealNet = getDealNet(deal);
  const goodName = getGoodName(deal.goodId);
  const counterparty =
    phase.kind === "SELL" ? getPartyLabel(deal.buyerId, market) : getPartyLabel(deal.sellerId, market);
  const details = getDealDetails(deal, market);

  return /* html */ `<div class="states marketDeal"
      style="display:grid;grid-template-columns:14em 4.5em 11em 6.5em 10.5em;align-items:center"
      data-good="${goodName}"
      data-units="${rn(deal.units, 2)}"
      data-counterparty="${counterparty}"
      data-income="${dealNet}"
      data-details="${details}">
      <div style="width:auto">${getGoodIcon(deal.goodId)}${goodName} ${renderPhaseBadge(deal.phase)}</div>
      <div style="width:auto">${rn(deal.units, 2)}</div>
      <div style="width:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${counterparty}">${counterparty}</div>
      <div style="width:auto;text-align:right;color:${dealNet >= 0 ? "#2a6" : "#c44"}">${formatPrice(dealNet)}</div>
      <div style="width:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${details}">${details}</div>
    </div>`;
}

function renderGoodLine(goodId: number, marketGood: Market["goods"][number]): string {
  const good = Goods.get(goodId);
  if (!good) return "";

  const spread = marketGood.sellPrice - marketGood.buyPrice;
  return /* html */ `<div class="states marketGood"
      style="display:grid;grid-template-columns:11em 4.5em 5.5em 5.5em 5.5em;align-items:center"
      data-good="${good.name}"
      data-stock="${rn(marketGood.stock, 2)}"
      data-buyprice="${marketGood.buyPrice}"
      data-sellprice="${marketGood.sellPrice}"
      data-spread="${spread}">
      <div style="width:auto">${getGoodIcon(goodId)}${good.name}</div>
      <div style="width:auto;text-align:right">${rn(marketGood.stock, 2)}</div>
      <div style="width:auto;text-align:right">${formatPrice(marketGood.buyPrice)}</div>
      <div style="width:auto;text-align:right">${formatPrice(marketGood.sellPrice)}</div>
      <div style="width:auto;text-align:right">${formatPrice(spread)}</div>
    </div>`;
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

function getMarketLabel(market: Market): string {
  return `${getMarketCenterName(market)} market`;
}

function getPartyLabel(id: number, currentMarket: Market): string {
  if (id === currentMarket.i) return getMarketLabel(currentMarket);

  const burg = pack.burgs[id] as Burg | undefined;
  if (burg && !burg.removed) return burg.name || `Burg ${id}`;

  const market = Trade.getMarket(id);
  if (market) return getMarketLabel(market);
  return `#${id}`;
}

function getDealSpend(deal: Deal): number {
  return deal.phase === "local-sale" ? 0 : deal.units * deal.prices.marketBuy;
}

function getDealRevenue(deal: Deal): number {
  return deal.phase === "local-sale" ? deal.units * deal.prices.marketSell : 0;
}

function getDealTax(deal: Deal): number {
  if (deal.phase !== "local-sale") return 0;
  const seller = pack.burgs[deal.sellerId] as Burg | undefined;
  return seller ? getDealRevenue(deal) * Trade.getSalesTaxRate(seller) : 0;
}

function getDealNet(deal: Deal): number {
  return getDealRevenue(deal) - getDealTax(deal) - getDealSpend(deal);
}

function getDealDetails(deal: Deal, market: Market): string {
  const seller = getPartyLabel(deal.sellerId, market);
  const buyer = getPartyLabel(deal.buyerId, market);
  const tax = getDealTax(deal);
  if (deal.phase === "local-sale") {
    return `seller ${seller}; buyer ${buyer}; units ${rn(deal.units, 2)} x sell ${rn(deal.prices.marketSell, 2)} - tax ${rn(tax, 2)}`;
  }
  return `seller ${seller}; buyer ${buyer}; units ${rn(deal.units, 2)} x buy ${rn(deal.prices.marketBuy, 2)}`;
}

function getGoodName(goodId: number): string {
  return Goods.get(goodId)?.name || `#${goodId}`;
}

function getGoodIcon(goodId: number): string {
  const good = Goods.get(goodId);
  if (!good) return "";
  return `<svg width="14" height="14" style="margin:-6px 2px -4px 0;vertical-align:middle">
    <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${Goods.getStroke(good.color)}"/>
    <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"/>
  </svg>`;
}

function renderPhaseBadge(phase: TradePhase): string {
  const phaseInfo = PHASE[phase];
  const base =
    "display:inline-block;border-radius:3px;padding:0 .4em;font-size:.8em;font-weight:bold;line-height:1.35;margin-left:4px";
  if (phaseInfo.kind === "SELL") {
    return `<span style="${base};background:#dff0e2;color:#2f8a46" title="${phaseInfo.tip}">${phaseInfo.label}</span>`;
  }
  if (phaseInfo.kind === "GLOBAL") {
    return `<span style="${base};background:#edf1f4;color:#5f6f7a" title="${phaseInfo.tip}">${phaseInfo.label}</span>`;
  }
  return `<span style="${base};background:#f5d9d6;color:#a33" title="${phaseInfo.tip}">${phaseInfo.label}</span>`;
}

function formatPrice(value: number): string {
  return `🟡 ${rn(value, 2)}`;
}

function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function downloadDealsCsv(): void {
  const market = Trade.getMarket(activeMarketId);
  if (!market) return;

  const centerName = getMarketCenterName(market);
  const lines = getMarketDeals(market.i);
  let csv = "Market,Deal Id,Phase,Good,Units,Buyer,Seller,Buy Price,Sell Price,Tax,Net\n";

  for (const deal of lines) {
    const buyer = getPartyLabel(deal.buyerId, market);
    const seller = getPartyLabel(deal.sellerId, market);
    csv += [
      escapeCsv(centerName),
      deal.id,
      PHASE[deal.phase].label,
      escapeCsv(getGoodName(deal.goodId)),
      rn(deal.units, 2),
      escapeCsv(buyer),
      escapeCsv(seller),
      rn(deal.prices.marketBuy, 2),
      rn(deal.prices.marketSell, 2),
      rn(getDealTax(deal), 2),
      rn(getDealNet(deal), 2)
    ].join(",");
    csv += "\n";
  }

  downloadFile(csv, `${getFileName(`Market_${centerName}_Deals`)}.csv`);
}

declare global {
  interface Window {
    MarketOverview: {open: typeof open};
  }
  var toggleTrade: () => void;
}

window.MarketOverview = {open};
