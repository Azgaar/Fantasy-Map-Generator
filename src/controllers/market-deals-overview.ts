import type { Burg } from "../modules/burgs-generator";
import type { Deal, Market } from "../modules/markets-generator";
import { getSalesTaxRateForBurg } from "../modules/states-generator";
import { ensureEl, formatPrice, rn } from "../utils";

let isInitialized = false;
let activeMarketId = 0;

type DealKind = "BUY" | "SELL";

export function open(marketId: number): void {
  const market = Markets.get(marketId);
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
    position: {
      my: "right top",
      at: "right bottom+10",
      of: "#marketOverview",
      collision: "fit"
    }
  });

  if (!isInitialized) {
    ensureEl("marketDealsRefresh").on("click", marketDealsAddLines);
    ensureEl("marketDealsExport").on("click", downloadDealsCsv);
    ensureEl("marketDealsBody").on("click", ev => {
      const el = ev.target as HTMLElement;
      if (!el.classList.contains("marketDealCounterparty")) return;
      const dealId = el.closest<HTMLElement>(".marketDeal")?.dataset.id;
      const deal = pack.deals.find(d => d.i === Number(dealId));
      if (!deal) return;

      const burgId = getPartyBurgId(deal);
      if (burgId) zoomTo(pack.burgs[burgId].x, pack.burgs[burgId].y, 8, 2000);
    });
    isInitialized = true;
  }
}

function marketDealsAddLines(): void {
  const market = Markets.get(activeMarketId);
  if (!market) {
    tip("Invalid market. The selected market does not exist", true, "error", 5000);
    return;
  }

  const deals = pack.deals.filter(deal => deal.market === activeMarketId);
  let netFlow = 0;

  let lines = "";
  for (const deal of deals) {
    netFlow += getDealNet(deal);
    lines += renderDealLine(deal);
  }

  ensureEl("marketDealsBody").innerHTML = lines || "No market deals recorded";
  ensureEl("marketDealsFooterDeals").innerHTML = String(deals.length);
  ensureEl("marketDealsFooterNet").innerHTML = formatPrice(netFlow);

  applySorting(ensureEl("marketDealsHeader"));
}

function closeMarketDeals(): void {
  ensureEl("marketDealsBody").innerHTML = "";
}

function typeBadge(type: DealKind): string {
  const base =
    "display:inline-block;border-radius:3px;padding:0 .4em;font-size:0.8em;font-weight:bold;line-height:1.35";
  if (type === "BUY") return `<span style="${base};background:#f5d9d6;color:#a33">BUY</span>`;
  if (type === "SELL") return `<span style="${base};background:#dff0e2;color:#2f8a46">SELL</span>`;
  return `<span style="${base};background:#edf1f4;color:#5f6f7a">GLOBAL</span>`;
}

function getPartyBurgId(deal: Deal): number {
  if (deal.clientType === "burg") return deal.client;
  const market = Markets.get(deal.client);
  if (market) return market.centerBurgId;
  return 0;
}

function renderDealLine(deal: Deal): string {
  const good = Goods.get(deal.good);
  if (!good) return "";

  const stroke = Goods.getStroke(good.color);
  const type: DealKind = deal.direction === "out" ? "SELL" : "BUY";
  const tip = deal.direction === "out" ? "Sale to the local market" : "Market purchase";
  const dealNet = getDealNet(deal);

  const counterparty = getPartyLabel(deal);
  const incomeColor = dealNet >= 0 ? "#2a6" : "#c44";

  return /* html */ `<div class="states marketDeal" data-id="${deal.i}" data-good="${good.name}" data-type="${type}" data-units="${rn(deal.units, 2)}" data-counterparty="${counterparty}" data-income="${dealNet}">
      <svg data-tip="Good icon" width="1.3em" height="1.3em" class="goodIcon">
        <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${stroke}"/>
        <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"/>
      </svg>
      <div data-tip="Good name" class="goodName">${good.name}</div>
      <div class="marketDealType" data-tip="${tip}">${typeBadge(type)}</div>
      <div class="marketDealCounterparty pointer" data-tip="Click to zoom">${counterparty}</div>
      <div class="marketDealUnits">${rn(deal.units, 2)}</div>
      <div class="marketDealIncome" style="color:${incomeColor}">${formatPrice(dealNet)}</div>
    </div>`;
}

function getMarketCenterName(market: Market): string {
  return pack.burgs[market.centerBurgId]?.name || `Market ${market.i}`;
}

function getPartyLabel(deal: Deal): string {
  if (deal.clientType === "burg") {
    const burg = pack.burgs[deal.client] as Burg | undefined;
    if (burg && !burg.removed) return burg.name || `Burg ${deal.client}`;
  } else if (deal.clientType === "market") {
    const market = Markets.get(deal.client);
    if (market) return `${getMarketCenterName(market)} market`;
    const marker = pack.markers.find(m => m.i === deal.client);
    if (marker) return marker.type || `Marker ${deal.client}`;
  }
  return `#${deal.client}`;
}

function getDealSpend(deal: Deal): number {
  return deal.direction === "in" ? deal.units * deal.price : 0;
}

function getDealRevenue(deal: Deal): number {
  return deal.direction === "out" ? deal.units * deal.price : 0;
}

function getDealTax(deal: Deal): number {
  if (deal.direction !== "in") return 0;
  if (deal.clientType === "burg") {
    const seller = pack.burgs[deal.client] as Burg | undefined;
    return seller ? deal.units * deal.price * getSalesTaxRateForBurg(seller) : 0;
  }
  return 0;
}

function getDealNet(deal: Deal): number {
  return getDealRevenue(deal) - getDealSpend(deal);
}

function downloadDealsCsv(): void {
  const market = Markets.get(activeMarketId);
  if (!market) return;

  const lines = pack.deals.filter(deal => deal.market === activeMarketId);
  let csv = "Id,Good,Type,Units,Buyer,Seller,Price,Tax,Net\n";
  for (const deal of lines) {
    const good = Goods.get(deal.good);
    if (!good) continue;

    const buyer = deal.direction === "out" ? getPartyLabel(deal) : `${getMarketCenterName(market)} market`;
    const seller = deal.direction === "in" ? getPartyLabel(deal) : `${getMarketCenterName(market)} market`;
    const type = deal.direction === "out" ? "SELL" : "BUY";

    csv += [
      deal.i,
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
    MarketDealsOverview: { open: typeof open };
  }
}

window.MarketDealsOverview = { open };
