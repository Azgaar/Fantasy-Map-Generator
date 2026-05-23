import type { Burg } from "../modules/burgs-generator";
import type { Deal } from "../modules/markets-generator";
import type { TradeBatch } from "../modules/trade-animation";
import { clearTradeHighlight, drawTradeHighlight } from "../renderers/draw-trade-animation";
import { ensureEl, formatPrice, rn } from "../utils";

let isInitialized = false;
let activeBatch: TradeBatch;

export function open(batch: TradeBatch): void {
  if (!batch?.deals.length) return;

  activeBatch = batch;
  tradeDetailsAddLines();
  drawTradeHighlight(activeBatch);

  $("#tradeDetails").dialog({
    title: `Trade: ${pack.burgs[batch.startBurgId]?.name} to ${pack.burgs[batch.endBurgId]?.name}`,
    resizable: false,
    position: { my: "right top", at: "right-10 top+10", of: "svg" },
    close: closeTradeDetails
  });

  if (!isInitialized) {
    ensureEl("tradeDetailsSummary").on("click", event => {
      const zoomEl = (event.target as HTMLElement).closest<HTMLElement>("[data-zoom]");
      if (!activeBatch || !zoomEl) return;
      const burgId = activeBatch[zoomEl.dataset.zoom === "start" ? "startBurgId" : "endBurgId"];
      const burg = pack.burgs[burgId];
      if (!burg) return;
      zoomTo(burg.x, burg.y, 8, 1500);
    });
    isInitialized = true;
  }
}

function tradeDetailsAddLines(): void {
  if (!activeBatch) return;

  const from = pack.burgs[activeBatch.startBurgId];
  const to = pack.burgs[activeBatch.endBurgId];
  const fromType = getClientType(activeBatch.deals[0], from, "from");
  const toType = getClientType(activeBatch.deals[0], to, "to");
  console.log(activeBatch, { fromType, toType });

  ensureEl("tradeDetailsSummary").innerHTML = /* html */ `
    <span><b>From</b>: ${from?.name} ${fromType} <span class="icon-dot-circled pointer" data-zoom="start" data-tip="Zoom to start"></span></span>
    <span style="margin-left:5px"><b>To</b>: ${to?.name} ${toType}</b> <span class="icon-dot-circled pointer" data-zoom="end" data-tip="Zoom to end"></span></span>`;

  const html = activeBatch.deals.map(deal => {
    const good = Goods.get(deal.good);
    if (!good) return "";

    return /* html */ `<div class="states tradeDeal" data-good="${good.name}" data-units="${rn(deal.units, 2)}" data-price="${deal.price}" data-value="${rn(deal.units * deal.price, 2)}">
    <svg data-tip="Good icon" width="2em" height="2em" class="goodIcon">
      <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${Goods.getStroke(good.color)}"/>
      <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"></use>
    </svg>
    <div data-tip="Good name" class="goodName">${good.name}</div>
    <div class="goodUnits">${rn(deal.units, 2)}</div>
    <div class="goodPrice">${formatPrice(deal.price)}</div>
    <div class="goodValue">${formatPrice(rn(deal.units * deal.price, 2))}</div>
  </div>`;
  });

  ensureEl("tradeDetailsBody").innerHTML = html.join("");
  ensureEl("tradeDetailsFooterDeals").innerHTML = String(activeBatch.deals.length);
  ensureEl("tradeDetailsFooterUnits").innerHTML = activeBatch.deals
    .reduce((sum, deal) => sum + deal.units, 0)
    .toFixed(2);
  ensureEl("tradeDetailsFooterValue").innerHTML = formatPrice(
    rn(
      activeBatch.deals.reduce((sum, deal) => sum + deal.units * deal.price, 0),
      2
    )
  );

  applySorting(ensureEl("tradeDetailsHeader"));
  $("#tradeDetails").dialog({ width: fitContent() });
}

function getClientType(deal: Deal, burg: Burg, direction: "from" | "to"): string {
  if (deal.clientType === "market") return "market";
  const isClient = direction === "to" ? deal.direction === "out" : deal.direction === "in";
  return isClient ? burg.group || "burg" : "market";
}

function closeTradeDetails(): void {
  ensureEl("tradeDetailsBody").innerHTML = "";
  ensureEl("tradeDetailsSummary").innerHTML = "";
  clearTradeHighlight();
}

declare global {
  interface Window {
    TradeDetails: { open: typeof open };
  }
}

window.TradeDetails = { open };
