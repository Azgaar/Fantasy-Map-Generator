import type {Burg} from "../modules/burgs-generator";
import type {Deal, Market, TradePhase} from "../modules/trade-generator";
import {ensureEl, formatPrice, rn} from "../utils";

let isInitialized = false;
let activeMarketId = 0;

type DealKind = "BUY" | "SELL" | "GLOBAL";

const PHASE: Record<TradePhase, {type: DealKind; tip: string; color: string}> = {
  "local-production-buy": {
    type: "BUY",
    tip: "Local market purchase for production",
    color: "#2a6"
  },
  "local-demand-buy": {
    type: "BUY",
    tip: "Local market purchase to fill burg demand",
    color: "#2a6"
  },
  "local-sale": {
    type: "SELL",
    tip: "Sale to the local market",
    color: "#a33"
  },
  global: {
    type: "GLOBAL",
    tip: "Redistribution between markets",
    color: "#5f6f7a"
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
    title: `Market Deals: ${getMarketCenterName(market)}`,
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
  let netFlow = 0;

  let lines = "";
  for (const deal of deals) {
    netFlow += getDealNet(deal);
    lines += renderDealLine(deal, market);
  }

  ensureEl("marketDealsBody").innerHTML = lines || "No market deals recorded";
  ensureEl("marketDealsFooterDeals").innerHTML = String(deals.length);
  ensureEl("marketDealsFooterNet").innerHTML = formatPrice(netFlow);

  applySorting(ensureEl("marketDealsHeader"));
}

function closeMarketDeals(): void {
  ensureEl("marketDealsBody").innerHTML = "";
}

function renderDealLine(deal: Deal, market: Market): string {
  const good = Goods.get(deal.goodId);
  if (!good) return "";

  const stroke = Goods.getStroke(good.color);
  const phase = PHASE[deal.phase];
  const dealNet = getDealNet(deal);

  const counterparty = getPartyLabel(phase.type === "BUY" ? deal.buyer : deal.seller, market);
  const {type, tip, color} = PHASE[deal.phase];
  const incomeColor = dealNet >= 0 ? "#2a6" : "#c44";

  return /* html */ `<div class="states marketDeal" data-good="${good.name}" data-type="${type}" data-units="${rn(deal.units, 2)}" data-counterparty="${counterparty}" data-income="${dealNet}">
      <svg data-tip="Good icon" width="1.4em" height="1.4em" class="goodIcon">
        <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${stroke}"/>
        <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"/>
      </svg>
      <div data-tip="Good name" class="goodName">${good.name}</div>
      <div class="marketDealType" data-tip="${tip}" style="color:${color}">${type}</div>
      <div class="marketDealUnits">${rn(deal.units, 2)}</div>
      <div class="marketDealCounterparty" data-tip="${counterparty}">${counterparty}</div>
      <div class="marketDealIncome" style="color:${incomeColor}">${formatPrice(dealNet)}</div>
    </div>`;
}

function getMarketCenterName(market: Market): string {
  return pack.burgs[market.centerBurgId]?.name || `Market ${market.i}`;
}

function getPartyLabel(id: number, currentMarket: Market): string {
  if (id === currentMarket.i) return `${getMarketCenterName(currentMarket)} market`;

  const burg = pack.burgs[id] as Burg | undefined;
  if (burg && !burg.removed) return burg.name || `Burg ${id}`;

  const market = Trade.getMarket(id);
  if (market) return `${getMarketCenterName(market)} market`;
  return `#${id}`;
}

function getDealSpend(deal: Deal): number {
  return deal.phase === "local-sale" ? 0 : deal.units * deal.price;
}

function getDealRevenue(deal: Deal): number {
  return deal.phase === "local-sale" ? deal.units * deal.price : 0;
}

function getDealTax(deal: Deal): number {
  if (deal.phase !== "local-sale") return 0;
  const seller = pack.burgs[deal.seller] as Burg | undefined;
  return seller ? getDealRevenue(deal) * Trade.getSalesTaxRate(seller) : 0;
}

function getDealNet(deal: Deal): number {
  return getDealRevenue(deal) - getDealTax(deal) - getDealSpend(deal);
}

function downloadDealsCsv(): void {
  const market = Trade.getMarket(activeMarketId);
  if (!market) return;

  const lines = pack.deals.filter(deal => deal.market === activeMarketId);
  let csv = "Id,Good,Type,Units,Buyer,Seller,Price,Tax,Net\n";
  for (const deal of lines) {
    const good = Goods.get(deal.goodId);
    if (!good) continue;

    const buyer = getPartyLabel(deal.buyer, market);
    const seller = getPartyLabel(deal.seller, market);
    const type = PHASE[deal.phase].type;

    csv += [
      deal.id,
      good.name,
      type,
      rn(deal.units, 2),
      buyer,
      seller,
      rn(deal.price, 2),
      rn(getDealTax(deal), 2),
      rn(getDealNet(deal), 2)
    ].join(",");
    csv += "\n";
  }

  downloadFile(csv, `${getFileName(`Market_${activeMarketId}_Deals`)}.csv`);
}

declare global {
  interface Window {
    MarketDealsOverview: {open: typeof open};
  }
}

window.MarketDealsOverview = {open};
