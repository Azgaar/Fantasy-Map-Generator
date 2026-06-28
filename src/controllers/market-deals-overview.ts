import type { Burg } from "../generators/burgs-generator";
import type { Deal } from "../generators/markets-generator";
import { ensureEl, formatPrice, rn } from "../utils";

let isInitialized = false;
let activeMarketId = 0;
let activeFilter: "all" | "local" | "global" = "all";

function open(marketId: number): void {
  const market = Markets.get(marketId);
  if (!market) {
    tip("Invalid market. The selected market does not exist", true, "error", 5000);
    return;
  }

  activeMarketId = marketId;
  activeFilter = "all";
  (ensureEl("marketDealsFilter") as HTMLSelectElement).value = "all";
  marketDealsAddLines();

  $("#marketDeals").dialog({
    title: `${Markets.getName(market)} Market Deals`,
    position: { my: "right top", at: "right bottom+10", of: "#marketOverview", collision: "fit" }
  });

  if (!isInitialized) {
    ensureEl("marketDealsRefresh").on("click", marketDealsAddLines);
    ensureEl("marketDealsExport").on("click", downloadDealsCsv);
    ensureEl("marketDealsBody").on("click", ev => {
      const el = ev.target as HTMLElement;
      const dealId = el.closest<HTMLElement>(".marketDealParty")?.parentElement?.dataset.id;
      const deal = pack.deals.find(d => d.i === Number(dealId));
      if (!deal) return;

      const party = getParty(deal);
      if (party) zoomTo(party.x, party.y, 8, 2000);
    });
    ensureEl("marketDealsFilter").on("change", ev => {
      activeFilter = (ev.target as HTMLSelectElement).value as typeof activeFilter;
      marketDealsAddLines();
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

  const allDeals = getMarketDeals(activeMarketId);
  const deals = allDeals.filter(deal => {
    if (activeFilter === "all") return true;
    const counterparty = getCounterparty(deal);
    return activeFilter === "local" ? counterparty.type === "burg" : counterparty.type === "market";
  });
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

function getMarketDeals(marketId: number): Deal[] {
  return pack.deals.filter(
    deal =>
      (deal.sellerType === "market" && deal.seller === marketId) ||
      (deal.buyerType === "market" && deal.buyer === marketId)
  );
}

function isMarketSeller(deal: Deal): boolean {
  return deal.sellerType === "market" && deal.seller === activeMarketId;
}

function getDirection(deal: Deal): "in" | "out" {
  return isMarketSeller(deal) ? "out" : "in";
}

function getCounterparty(deal: Deal): { id: number; type: "burg" | "market" } {
  return isMarketSeller(deal) ? { id: deal.buyer, type: deal.buyerType } : { id: deal.seller, type: deal.sellerType };
}

function renderDealLine(deal: Deal): string {
  const good = Goods.get(deal.good);
  if (!good) return "";

  const dealNet = getDealNet(deal);
  const party = getParty(deal);
  const counterparty = getCounterparty(deal);
  const direction = getDirection(deal);
  const incomeColor = dealNet >= 0 ? "#2a6" : "#c44";
  const backColor = dealNet >= 0 ? "#dff0d8" : "#f2dede";

  return /* html */ `<div class="states marketDeal" data-id="${deal.i}" data-good="${good.name}" data-direction="${direction}" data-units="${rn(deal.units, 2)}" data-counterparty="${counterparty.type}_${party?.name}" data-income="${dealNet}">
      <svg data-tip="Good icon" width="1.3em" height="1.3em" class="goodIcon">
        <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${Goods.getStroke(good.color)}"/>
        <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"/>
      </svg>
      <div data-tip="Good name" class="goodName">${good.name}</div>
      <div><span class="marketBadge" style="background:${backColor}; color:${incomeColor}">${direction.toUpperCase()}</span></div>
      <div class="marketDealParty pointer" data-tip="Click to zoom">
        <div class="${counterparty.type === "burg" ? "icon-dot-circled" : "icon-store"}" style="display:inline-block; width: 0.8em; ${counterparty.type === "market" ? "font-size: 0.85em;" : ""}"></div>
        <div style="display:inline-block; width: 6.8em;">${party?.name}</div>
      </div>
      <div class="marketDealUnits">${rn(deal.units, 2)}</div>
      <div class="marketDealIncome" style="color:${incomeColor}">${formatPrice(dealNet)}</div>
    </div>`;
}

function getParty(deal: Deal): Burg | null {
  const counterparty = getCounterparty(deal);
  const burgId = counterparty.type === "burg" ? counterparty.id : Markets.get(counterparty.id)?.centerBurgId;
  if (!burgId) return null;
  return pack.burgs[burgId] || null;
}

function getDealNet(deal: Deal): number {
  return rn(deal.units * deal.price * (isMarketSeller(deal) ? 1 : -1), 2);
}

function downloadDealsCsv(): void {
  const market = Markets.get(activeMarketId);
  if (!market) return;

  const lines = getMarketDeals(activeMarketId);
  let csv = "Id,Good,Type,Client,Units,Price,Net\n";
  for (const deal of lines) {
    const good = Goods.get(deal.good);
    if (!good) continue;

    csv += [
      deal.i,
      good.name,
      getDirection(deal),
      getParty(deal)?.name ?? "",
      rn(deal.units, 2),
      rn(deal.price, 2),
      rn(getDealNet(deal), 2)
    ].join(",");
    csv += "\n";
  }

  downloadFile(csv, `${getFileName(`Market_${activeMarketId}_Deals`)}.csv`);
}

export const MarketDealsOverview = { open };
