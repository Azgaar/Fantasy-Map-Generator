import type {Burg} from "../modules/burgs-generator";
import type {Deal, Market, TradePhase} from "../modules/trade-generator";
import {ensureEl, formatPrice, rn} from "../utils";

let isInitialized = false;
let activeMarketId = 0;

type DealKind = "BUY" | "SELL" | "GLOBAL";

type MarketSummary = {
  totalDeals: number;
  globalDeals: number;
  totalUnits: number;
  buySpend: number;
  totalTax: number;
  saleIncome: number;
  netFlow: number;
};

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

export function open(marketId: number): void {
  const market = Trade.getMarket(marketId);
  if (!market) {
    tip("Invalid market. The selected market does not exist", true, "error", 5000);
    return;
  }

  activeMarketId = marketId;
  marketDealsAddLines();

  $("#marketDeals").dialog({
    title: `Market Deal History: ${getMarketCenterName(market)}`,
    resizable: false,
    width: "auto",
    close: closeMarketDeals,
    position: {my: "right top", at: "right bottom+10", of: "#marketOverview", collision: "fit"}
  });

  if (!isInitialized) {
    ensureEl("marketDealsRefresh").on("click", marketDealsAddLines);
    ensureEl("marketDealsExport").on("click", downloadDealsCsv);
    isInitialized = true;
  }
}

function marketDealsAddLines(): void {
  const market = Trade.getMarket(activeMarketId);
  if (!market) {
    tip("Invalid market. The selected market does not exist", true, "error", 5000);
    return;
  }

  const deals = pack.deals.filter(deal => deal.market === activeMarketId);
  const summary = getSummary(deals);

  let lines = "";
  for (const deal of deals) {
    lines += renderDealLine(deal, market);
  }

  ensureEl("marketDealsBody").innerHTML = lines || "No market deals recorded";
  ensureEl("marketDealsFooterDeals").innerHTML = String(deals.length);
  ensureEl("marketDealsFooterNet").innerHTML = formatPrice(summary.netFlow);

  applySorting(ensureEl("marketDealsHeader"));
}

function closeMarketDeals(): void {
  ensureEl("marketDealsBody").innerHTML = "";
}

function renderDealLine(deal: Deal, market: Market): string {
  const phase = PHASE[deal.phase];
  const dealNet = getDealNet(deal);
  const goodName = getGoodName(deal.goodId);
  const counterparty =
    phase.kind === "SELL" ? getPartyLabel(deal.buyerId, market) : getPartyLabel(deal.sellerId, market);
  const details = getDealDetails(deal, market);

  return /* html */ `<div class="states marketDeal"
      data-good="${goodName}"
      data-units="${rn(deal.units, 2)}"
      data-counterparty="${counterparty}"
      data-income="${dealNet}"
      data-details="${details}">
      <div style="width:auto;min-width:0">${getGoodIcon(deal.goodId)}${goodName} ${renderPhaseBadge(deal.phase)}</div>
      <div style="width:auto;text-align:right">${rn(deal.units, 2)}</div>
      <div title="${counterparty}">${counterparty}</div>
      <div style="width:auto;text-align:right;color:${dealNet >= 0 ? "#2a6" : "#c44"}">${formatPrice(dealNet)}</div>
      <div title="${details}">${details}</div>
    </div>`;
}

function getSummary(deals: Deal[]): MarketSummary {
  const sales = deals.filter(deal => deal.phase === "local-sale");
  const buys = deals.filter(deal => deal.phase !== "local-sale");

  const totalDeals = deals.length;
  const globalDeals = deals.filter(deal => deal.phase === "global").length;
  const totalUnits = deals.reduce((sum, deal) => sum + deal.units, 0);
  const buySpend = buys.reduce((sum, deal) => sum + getDealSpend(deal), 0);
  const grossSaleIncome = sales.reduce((sum, deal) => sum + getDealRevenue(deal), 0);
  const totalTax = sales.reduce((sum, deal) => sum + getDealTax(deal), 0);
  const saleIncome = grossSaleIncome - totalTax;
  const netFlow = saleIncome - buySpend;

  return {
    totalDeals,
    globalDeals,
    totalUnits,
    buySpend,
    totalTax,
    saleIncome,
    netFlow
  };
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

  const stroke = Goods.getStroke(good.color);
  return /*html*/ `<svg data-tip="Good icon" width="2em" height="2em" class="goodIcon">
      <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${stroke}"/>
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

function downloadDealsCsv(): void {
  const market = Trade.getMarket(activeMarketId);
  if (!market) return;

  const centerName = getMarketCenterName(market);
  const lines = pack.deals.filter(deal => deal.market === activeMarketId);
  let csv = "Market,Deal Id,Phase,Good,Units,Buyer,Seller,Buy Price,Sell Price,Tax,Net\n";

  for (const deal of lines) {
    const buyer = getPartyLabel(deal.buyerId, market);
    const seller = getPartyLabel(deal.sellerId, market);
    csv += [
      centerName,
      deal.id,
      PHASE[deal.phase].label,
      getGoodName(deal.goodId),
      rn(deal.units, 2),
      buyer,
      seller,
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
    MarketDealsOverview: {open: typeof open};
  }
}

window.MarketDealsOverview = {open};
