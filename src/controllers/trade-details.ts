import type { Burg } from "../generators/burgs-generator";
import type { Deal } from "../generators/markets-generator";
import type { Point } from "../generators/voronoi";
import { clearHighlight, highlight } from "../renderers/draw-trade-animation";
import type { TradeBatch } from "../renderers/trade-animation";
import { ensureEl, formatPrice, rn } from "../utils";

let isInitialized = false;
let activeBatch: TradeBatch;

function open(batch: TradeBatch): void {
  if (!batch?.deals.length) return;

  activeBatch = batch;

  const startBurg = pack.burgs[batch.startBurgId];
  const endBurg = pack.burgs[batch.endBurgId];
  if (!startBurg || !endBurg) return;
  const path = TradeAnimation.findRoutePath(startBurg.cell, endBurg.cell);
  if (!path) return;

  tradeDetailsAddLines(path.points);
  highlight(path.points);

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

function tradeDetailsAddLines(points: Point[]): void {
  if (!activeBatch) return;

  const from = pack.burgs[activeBatch.startBurgId];
  const to = pack.burgs[activeBatch.endBurgId];
  const fromType = getClientType(activeBatch.deals[0], from, "from");
  const toType = getClientType(activeBatch.deals[0], to, "to");

  ensureEl("tradeDetailsSummary").innerHTML = /* html */ `
    <span><b>Seller</b>: ${from?.name} ${fromType} <span class="icon-dot-circled pointer" data-zoom="start" data-tip="Zoom to start"></span></span>
    <span style="margin-left:5px"><b>Buyer</b>: ${to?.name} ${toType} <span class="icon-dot-circled pointer" data-zoom="end" data-tip="Zoom to end"></span></span>`;

  let totalUnits = 0;
  let totalValue = 0;
  const combined = new Map<number, { units: number; value: number }>();
  for (const deal of activeBatch.deals) {
    const entry = combined.get(deal.good) ?? { units: 0, value: 0 };
    entry.units += deal.units;
    entry.value += deal.units * deal.price;
    combined.set(deal.good, entry);
    totalUnits += deal.units;
    totalValue += deal.units * deal.price;
  }

  const html = Array.from(combined, ([goodId, { units, value }]) => {
    const good = Goods.get(goodId);
    if (!good) return "";
    const price = units ? value / units : 0;

    return /* html */ `<div class="states tradeDeal" data-good="${good.name}" data-units="${rn(units, 2)}" data-price="${price}" data-value="${rn(value, 2)}">
    <svg data-tip="Good icon" width="2em" height="2em" class="goodIcon">
      <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${Goods.getStroke(good.color)}"/>
      <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"></use>
    </svg>
    <div data-tip="Good name" class="goodName">${good.name}</div>
    <div class="goodUnits">${rn(units, 2)}</div>
    <div class="goodPrice">${formatPrice(rn(price, 2))}</div>
    <div class="goodValue">${formatPrice(rn(value, 2))}</div>
  </div>`;
  });

  const length = rn(
    points.reduce((sum, p, i) => {
      if (i === 0) return 0;
      const prev = points[i - 1];
      return sum + Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    }, 0),
    2
  );
  ensureEl("tradeDetailsBody").innerHTML = html.join("");
  ensureEl("tradeDetailsFooterDistance").innerHTML = `${rn(length * distanceScale)} ${distanceUnitInput.value}`;
  ensureEl("tradeDetailsFooterUnits").innerHTML = String(rn(totalUnits, 2));
  ensureEl("tradeDetailsFooterValue").innerHTML = formatPrice(totalValue);

  applySorting(ensureEl("tradeDetailsHeader"));
  $("#tradeDetails").dialog({ width: fitContent() });
}

function getClientType(deal: Deal, burg: Burg, direction: "from" | "to"): string {
  const type = direction === "from" ? deal.sellerType : deal.buyerType;
  if (type === "market") return "market";
  return burg.group || "burg";
}

function closeTradeDetails(): void {
  ensureEl("tradeDetailsBody").innerHTML = "";
  ensureEl("tradeDetailsSummary").innerHTML = "";
  clearHighlight();
}

export const TradeDetails = { open };
