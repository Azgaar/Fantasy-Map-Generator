import type { Burg } from "../modules/burgs-generator";
import type { Deal } from "../modules/markets-generator";
import type { TradeBatch } from "../modules/trade-animation";
import { ensureEl, formatPrice, rn } from "../utils";

let isInitialized = false;
let activeBatch: TradeBatch | null = null;

export function open(batch: TradeBatch): void {
  if (!batch?.deals.length) return;

  activeBatch = batch;
  renderTradeDetails(batch);

  $("#tradeDetails").dialog({
    title: `Trade: ${getBurgName(batch.startBurgId)} to ${getBurgName(batch.endBurgId)}`,
    resizable: false,
    width: "auto",
    position: { my: "center", at: "center", of: "svg", collision: "fit" },
    close: closeTradeDetails
  });

  if (!isInitialized) {
    ensureEl("tradeDetailsZoomStart").on("click", () => zoomToBurg("start"));
    ensureEl("tradeDetailsZoomEnd").on("click", () => zoomToBurg("end"));
    ensureEl("tradeDetailsBody").on("click", event => {
      const target = event.target as HTMLElement;
      const burgId = Number(target.closest<HTMLElement>("[data-zoom-burg]")?.dataset.zoomBurg);
      const burg = pack.burgs[burgId];
      if (!burg) return;
      zoomTo(burg.x, burg.y, 8, 1500);
    });
    isInitialized = true;
  }
}

function renderTradeDetails(batch: TradeBatch): void {
  const totalUnits = batch.deals.reduce((sum, deal) => sum + deal.units, 0);
  const totalValue = batch.deals.reduce((sum, deal) => sum + getDealValue(deal), 0);

  ensureEl("tradeDetailsSummary").innerHTML = /* html */ `
    <div style="margin-left:5px">From: <b>${getBurgName(batch.startBurgId)}</b></div>
    <div style="margin-left:12px">To: <b>${getBurgName(batch.endBurgId)}</b></div>
    <div style="margin-left:12px">Deals: <b>${batch.deals.length}</b></div>`;

  ensureEl("tradeDetailsBody").innerHTML = batch.deals.map(renderDealLine).join("");
  ensureEl("tradeDetailsFooterUnits").innerHTML = rn(totalUnits, 2).toString();
  ensureEl("tradeDetailsFooterValue").innerHTML = formatPrice(totalValue);

  applySorting(ensureEl("tradeDetailsHeader"));
  $("#tradeDetails").dialog({ width: fitContent() });
}

function renderDealLine(deal: Deal): string {
  const good = Goods.get(deal.good);
  if (!good) return "";

  const marketBurg = getMarketCenterBurg(deal.market);
  const counterparty = getCounterpartyBurg(deal);
  const value = getDealValue(deal);
  const color = value >= 0 ? "#2a6" : "#c44";
  const marketName = marketBurg?.name || "Unknown";
  const counterpartyName = counterparty?.name || "Unknown";

  return /* html */ `<div class="states tradeDeal" data-good="${good.name}" data-direction="${deal.direction}" data-market="${marketName}" data-counterparty="${counterpartyName}" data-units="${rn(deal.units, 2)}" data-price="${deal.price}" data-value="${value}">
    <svg data-tip="Good icon" width="1.3em" height="1.3em" class="goodIcon">
      <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${Goods.getStroke(good.color)}"/>
      <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"/>
    </svg>
    <div data-tip="Good name" class="goodName">${good.name}</div>
    <div><span class="marketBadge" style="background:#f5d9d6; color:${color}">${deal.direction.toUpperCase()}</span></div>
    <div class="pointer" data-tip="Click to zoom" data-zoom-burg="${marketBurg?.i || 0}">${marketName}</div>
    <div class="pointer" data-tip="Click to zoom" data-zoom-burg="${counterparty?.i || 0}">${counterpartyName}</div>
    <div>${rn(deal.units, 2)}</div>
    <div>${formatPrice(deal.price)}</div>
    <div style="color:${color}">${formatPrice(value)}</div>
  </div>`;
}

function getDealValue(deal: Deal): number {
  return rn(deal.units * deal.price * (deal.direction === "in" ? -1 : 1), 2);
}

function getMarketCenterBurg(marketId: number): Burg | null {
  const market = Markets.get(marketId);
  if (!market) return null;
  return pack.burgs[market.centerBurgId] || null;
}

function getCounterpartyBurg(deal: Deal): Burg | null {
  const burgId = deal.clientType === "burg" ? deal.client : Markets.get(deal.client)?.centerBurgId;
  return burgId ? pack.burgs[burgId] || null : null;
}

function getBurgName(burgId: number): string {
  return pack.burgs[burgId]?.name || "Unknown";
}

function zoomToBurg(target: "start" | "end"): void {
  if (!activeBatch) return;
  const burgId = target === "start" ? activeBatch.startBurgId : activeBatch.endBurgId;
  const burg = pack.burgs[burgId];
  if (!burg) return;
  zoomTo(burg.x, burg.y, 8, 1500);
}

function closeTradeDetails(): void {
  ensureEl("tradeDetailsBody").innerHTML = "";
  ensureEl("tradeDetailsSummary").innerHTML = "";
  activeBatch = null;
}

declare global {
  interface Window {
    TradeDetails: { open: typeof open };
  }
}

window.TradeDetails = { open };
