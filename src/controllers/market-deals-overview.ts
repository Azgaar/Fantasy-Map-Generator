import type { Burg } from "../modules/burgs-generator";
import { getSalesTaxRateForBurg } from "../modules/states-generator";
import type { Deal, Market } from "../modules/trade-generator";
import { ensureEl, formatPrice, rn } from "../utils";

let isInitialized = false;
let activeMarketId = 0;

type DealKind = "IN" | "OUT";

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
      const deal = pack.deals.find(d => d.id === Number(dealId));
      if (!deal) return;

      const burgId = deal.client;
      if (burgId) zoomTo(pack.burgs[burgId].x, pack.burgs[burgId].y, 8, 2000);
    });
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

function typeBadge(type: DealKind): string {
  const base =
    "display:inline-block;border-radius:3px;padding:0 .4em;font-size:0.8em;font-weight:bold;line-height:1.35";
  if (type === "IN") return `<span style="${base};background:#f5d9d6;color:#a33">IN</span>`;
  if (type === "OUT") return `<span style="${base};background:#dff0e2;color:#2f8a46">OUT</span>`;
  return `<span style="${base};background:#edf1f4;color:#5f6f7a">GLOBAL</span>`;
}

function renderDealLine(deal: Deal, market: Market): string {
  const good = Goods.get(deal.good);
  if (!good) return "";

  const stroke = Goods.getStroke(good.color);
  const type: DealKind = deal.type === "in" ? "IN" : "OUT";
  const tip = deal.type === "in" ? "Market purchase" : "Sale to the local market";
  const dealNet = getDealNet(deal);

  const counterparty = getPartyLabel(deal.client, market);
  const incomeColor = dealNet >= 0 ? "#2a6" : "#c44";

  return /* html */ `<div class="states marketDeal" data-id="${deal.id}" data-good="${good.name}" data-type="${type}" data-units="${rn(deal.units, 2)}" data-counterparty="${counterparty}" data-income="${dealNet}">
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

function getPartyLabel(id: number, currentMarket: Market): string {
  if (id === currentMarket.i) return `${getMarketCenterName(currentMarket)} market`;

  const burg = pack.burgs[id] as Burg | undefined;
  if (burg && !burg.removed) return burg.name || `Burg ${id}`;

  const market = Trade.getMarket(id);
  if (market) return `${getMarketCenterName(market)} market`;
  return `#${id}`;
}

function getDealSpend(deal: Deal): number {
  return deal.type === "in" ? deal.units * deal.price : 0;
}

function getDealRevenue(deal: Deal): number {
  return deal.type === "out" ? deal.units * deal.price : 0;
}

function getDealTax(deal: Deal): number {
  if (deal.type === "out") {
    // Market sells
    const market = Trade.getMarket(deal.market);
    const seller = pack.burgs[market?.centerBurgId || 0] as Burg | undefined;
    return seller ? getDealRevenue(deal) * getSalesTaxRateForBurg(seller) : 0;
  } else {
    // Burg sells
    const seller = pack.burgs[deal.client] as Burg | undefined;
    return seller ? getDealSpend(deal) * getSalesTaxRateForBurg(seller) : 0;
  }
}

function getDealNet(deal: Deal): number {
  return getDealRevenue(deal) - getDealTax(deal) - getDealSpend(deal);
}

function downloadDealsCsv(): void {
  const market = Trade.getMarket(activeMarketId);
  if (!market) return;

  const lines = pack.deals.filter(deal => deal.market === activeMarketId);
  let csv = "Id,Good,Type,Units,Client,Price,Tax,Net\n";
  for (const deal of lines) {
    const good = Goods.get(deal.good);
    if (!good) continue;

    const counterparty = getPartyLabel(deal.client, market);
    const type = deal.type === "in" ? "IN" : "OUT";

    csv += [
      deal.id,
      good.name,
      type,
      rn(deal.units, 2),
      counterparty,
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
