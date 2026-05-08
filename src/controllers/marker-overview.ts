import type {Burg} from "../modules/burgs-generator";
import type {Deal, Market, TradePhase} from "../modules/trade-generator";
import {ensureEl, rn} from "../utils";

type DealKind = "BUY" | "SELL" | "GLOBAL";

const phaseLabels: Record<TradePhase, {label: string; kind: DealKind; title: string}> = {
  "local-production-buy": {label: "PROD BUY", kind: "BUY", title: "Local market purchase for production"},
  "local-demand-buy": {label: "DEMAND BUY", kind: "BUY", title: "Local market purchase to fill burg demand"},
  "local-sale": {label: "SALE", kind: "SELL", title: "Sale to the local market"},
  global: {label: "GLOBAL", kind: "GLOBAL", title: "Redistribution between markets"}
};

function formatPrice(value: number): string {
  return `🟡 ${rn(value, 2)}`;
}

function getMarketCenterName(market: Market | undefined): string {
  if (!market) return "Unknown market";
  return pack.burgs[market.centerBurgId]?.name || `Market ${market.i}`;
}

function getMarketLabel(market: Market | undefined): string {
  if (!market) return "unknown market";
  return `${getMarketCenterName(market)} market`;
}

function getPartyLabel(partyId: number, currentMarket: Market): string {
  if (partyId === currentMarket.i) return getMarketLabel(currentMarket);

  const burg = pack.burgs[partyId] as Burg | undefined;
  if (burg && !burg.removed) return burg.name || `Burg ${partyId}`;

  const market = Trade.getMarket(partyId);
  if (market) return getMarketLabel(market);

  return `#${partyId}`;
}

function getDealTaxRate(deal: Deal): number {
  if (deal.phase !== "local-sale") return 0;
  const seller = pack.burgs[deal.sellerId] as Burg | undefined;
  return seller ? Trade.getSalesTaxRate(seller) : 0;
}

function getDealSpend(deal: Deal): number {
  return deal.phase === "local-sale" ? 0 : deal.units * deal.prices.marketBuy;
}

function getDealRevenue(deal: Deal): number {
  return deal.phase === "local-sale" ? deal.units * deal.prices.marketSell : 0;
}

function getDealTax(deal: Deal): number {
  return getDealRevenue(deal) * getDealTaxRate(deal);
}

function getDealNet(deal: Deal): number {
  return getDealRevenue(deal) - getDealTax(deal) - getDealSpend(deal);
}

function getGoodName(goodId: number): string {
  return Goods.get(goodId)?.name || `#${goodId}`;
}

function getGoodDot(goodId: number): string {
  const good = Goods.get(goodId);
  if (!good) return "";

  return `<svg width="14" height="14" style="margin:-6px 2px -4px 0;vertical-align:middle">
      <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${Goods.getStroke(good.color)}"/>
      <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"/>
    </svg>`;
}

function getPhaseBadge(phase: TradePhase): string {
  const {label, title} = phaseLabels[phase];
  const baseStyles =
    "display:inline-block;border-radius:3px;padding:0 .4em;font-size:0.8em;font-weight:bold;line-height:1.35";

  if (phaseLabels[phase].kind === "SELL") {
    return `<span style="${baseStyles};background:#dff0e2;color:#2f8a46" title="${title}">${label}</span>`;
  }
  if (phaseLabels[phase].kind === "GLOBAL") {
    return `<span style="${baseStyles};background:#edf1f4;color:#5f6f7a" title="${title}">${label}</span>`;
  }

  return `<span style="${baseStyles};background:#f5d9d6;color:#a33" title="${title}">${label}</span>`;
}

function renderDealDetails(deal: Deal, market: Market): string {
  const {title} = phaseLabels[deal.phase];
  const taxRate = getDealTaxRate(deal);
  const spend = getDealSpend(deal);
  const revenue = getDealRevenue(deal);
  const tax = getDealTax(deal);
  const net = getDealNet(deal);
  const seller = getPartyLabel(deal.sellerId, market);
  const buyer = getPartyLabel(deal.buyerId, market);

  const priceLine =
    deal.phase === "local-sale"
      ? `unit ${rn(deal.units, 2)} × sell price ${rn(deal.prices.marketSell, 2)} - sales tax ${rn(tax, 2)}`
      : `unit ${rn(deal.units, 2)} × buy price ${rn(deal.prices.marketBuy, 2)}`;

  const netLabel = deal.phase === "local-sale" ? "income" : "spent";

  return /*html*/ `
    <div><b>Deal calculation:</b> ${priceLine} = <b>${formatPrice(deal.phase === "local-sale" ? net : -spend)}</b> ${netLabel}</div>
    <div><b>Parties:</b> seller ${seller}, buyer ${buyer}</div>
    <div><b>Phase:</b> ${title}</div>
    <div><b>Price snapshot:</b> base ${formatPrice(deal.prices.base)}, buy ${formatPrice(deal.prices.marketBuy)}, sell ${formatPrice(deal.prices.marketSell)}, consumer ${formatPrice(deal.prices.consumerBuy)}</div>
    <div><b>Totals:</b> gross ${formatPrice(revenue || spend)}, tax ${formatPrice(tax)}, net ${formatPrice(net)}</div>
    ${deal.phase === "local-sale" ? `<div><b>Sales tax rate:</b> ${rn(taxRate * 100, 2)}%</div>` : ""}
  `;
}

function renderDealRow(params: {deal: Deal; market: Market}) {
  const {deal, market} = params;
  const phase = phaseLabels[deal.phase];
  const detailsId = `deal-details-${deal.id}`;
  const value = getDealNet(deal);
  const counterpart =
    phase.kind === "SELL" ? getPartyLabel(deal.buyerId, market) : getPartyLabel(deal.sellerId, market);

  return [
    /*html*/ `<tr data-target="${detailsId}" style="border-bottom:1px solid #f0f0f0;cursor:pointer" title="Click to expand deal details">
        <td style="padding:.4em .5em;vertical-align:top">${getGoodDot(deal.goodId)}${getGoodName(deal.goodId)} <span style="margin-left:4px">${getPhaseBadge(deal.phase)}</span></td>
        <td style="padding:.4em .5em;vertical-align:top">${rn(deal.units, 2)}</td>
        <td style="padding:.4em .5em;vertical-align:top">${counterpart}</td>
        <td style="padding:.4em .5em;vertical-align:top;text-align:right;color:${value >= 0 ? "#2a6" : "#c44"}">${formatPrice(value)}</td>
      </tr>`,
    /*html*/ `<tr id="${detailsId}" style="display:none">
        <td colspan="4" style="padding:.5em .5em 1em;">${renderDealDetails(deal, market)}</td>
      </tr>`
  ];
}

function renderTable(params: {
  colWidths: string[];
  headers: Array<{label: string; align?: "left" | "right"; title?: string}>;
  rows: string[];
  empty: string;
}): string {
  const {colWidths, headers, rows, empty} = params;
  if (!rows.length) return `<i style="color:#888;font-style:italic">${empty}</i>`;

  const cell = (content: string | number, align: "left" | "right" = "left", title = "") =>
    `<th style="padding:.4em .5em;vertical-align:top${align === "right" ? ";text-align:right" : ""}"${title ? ` title="${title}"` : ""}>${content}</th>`;

  return /*html*/ `<table style="width:100%;table-layout:fixed;border-collapse:collapse;line-height:1">
    <colgroup>${colWidths.map(width => `<col style="width: ${width};">`).join("")}</colgroup>
    <thead><tr style="background:#eee">${headers
      .map(header => cell(header.label, header.align || "left", header.title || ""))
      .join("")}</tr></thead>
    <tbody>${rows.join("")}</tbody>
  </table>`;
}

function renderSummaryBar(
  items: Array<{
    label: string;
    value: string;
    title: string;
    valueStyle?: string;
  }>
): string {
  return /*html*/ `<div style="display:flex;margin-top:.6em;justify-content:space-between;padding:0 .5em;gap:1em;flex-wrap:wrap">${items
    .map(
      item =>
        `<span title="${item.title}"><b>${item.label}:</b> <span style="font-weight:600;${item.valueStyle || ""}">${item.value}</span></span>`
    )
    .join("")}</div>`;
}

function renderSection(title: string, content: string, titleTooltip = ""): string {
  return `<div style="margin-bottom:.9em"><div style="font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:.3em;margin-bottom:.45em"${titleTooltip ? ` title="${titleTooltip}"` : ""}>${title}</div>${content}</div>`;
}

function getOwnerStateName(market: Market) {
  const tradeCenter = pack.burgs[market.centerBurgId];
  if (!tradeCenter) return "Unknown state";
  const stateId = tradeCenter.state;
  if (stateId === undefined) return "Independent";

  return pack.states[stateId].fullName || `State ${stateId}`;
}

export function open(marketId: number): void {
  if (customization) return;
  closeDialogs("#markerOverview, .stable");

  const market = Trade.getMarket(marketId);
  if (!market) {
    tip("Invalid market. The selected market does not exist.", true, "error", 5000);
    return;
  }

  const centerBurg = pack.burgs[market.centerBurgId] as Burg | undefined;
  if (!centerBurg || centerBurg.removed) {
    tip("Invalid market. The selected market has no center burg.", true, "error", 5000);
    return;
  }

  if (!layerIsOn("toggleTrade")) toggleTrade();

  const deals = (pack.deals || []).filter(deal => deal.market === market.i).sort((a, b) => a.id - b.id);
  const saleDeals = deals.filter(deal => deal.phase === "local-sale");
  const purchaseDeals = deals.filter(deal => deal.phase !== "local-sale");
  const globalDeals = deals.filter(deal => deal.phase === "global");
  const totalUnits = deals.reduce((sum, deal) => sum + deal.units, 0);
  const totalSpend = purchaseDeals.reduce((sum, deal) => sum + getDealSpend(deal), 0);
  const totalIncome = saleDeals.reduce((sum, deal) => sum + getDealNet(deal), 0);
  const totalTax = saleDeals.reduce((sum, deal) => sum + getDealTax(deal), 0);
  const netFlow = totalIncome - totalSpend;
  const taxRate = Trade.getSalesTaxRate(centerBurg);

  const marketGoods = Object.entries(market.goods)
    .map(([goodIdStr, stats]) => {
      const goodId = +goodIdStr;
      const good = Goods.get(goodId);
      if (!good) return "";

      return /*html*/ `<tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:.4em .5em;vertical-align:top">${getGoodDot(goodId)}${good.name}</td>
        <td style="padding:.4em .5em;vertical-align:top;text-align:right">${rn(stats.stock, 2)}</td>
        <td style="padding:.4em .5em;vertical-align:top;text-align:right">${formatPrice(stats.buyPrice)}</td>
        <td style="padding:.4em .5em;vertical-align:top;text-align:right">${formatPrice(stats.sellPrice)}</td>
        <td style="padding:.4em .5em;vertical-align:top;text-align:right">${formatPrice(stats.sellPrice - stats.buyPrice)}</td>
      </tr>`;
    })
    .filter(Boolean)
    .join("");

  const marketDealsRows = deals.flatMap(deal => renderDealRow({deal, market}));

  const summaryHtml = renderSummaryBar([
    {
      label: "Deals",
      value: String(deals.length),
      title: "All recorded deals for this market"
    },
    {
      label: "Global Deals",
      value: String(globalDeals.length),
      title: "Redistribution deals where this market was the importer"
    },
    {
      label: "Buy Spend",
      value: formatPrice(totalSpend),
      title: "Total money spent on local production buys, demand buys, and global imports",
      valueStyle: totalSpend >= 0 ? "color:#c44" : ""
    },
    {
      label: "Sale Income",
      value: formatPrice(totalIncome),
      title: "Net income from local sale deals after sales tax",
      valueStyle: totalIncome >= 0 ? "color:#2a6" : ""
    },
    {
      label: "Total Tax",
      value: formatPrice(totalTax),
      title: "Sales tax collected from local sale deals",
      valueStyle: totalTax >= 0 ? "color:#c84" : ""
    },
    {
      label: "Net Flow",
      value: formatPrice(netFlow),
      title: "Sale income minus purchase spend for this market",
      valueStyle: netFlow >= 0 ? "color:#2a6" : "color:#c44"
    }
  ]);

  const marketStatsHtml = renderTable({
    colWidths: ["34%", "12%", "18%", "18%", "18%"],
    headers: [
      {label: "Good"},
      {label: "Stock", align: "right"},
      {label: "Buy Price", align: "right"},
      {label: "Sell Price", align: "right"},
      {
        label: "Spread",
        align: "right",
        title: "Current sell price minus buy price"
      }
    ],
    rows: marketGoods ? [marketGoods] : [],
    empty: "No market goods available"
  });

  const dealHistoryHtml = renderTable({
    colWidths: ["35%", "12%", "23%", "17%", "13%"],
    headers: [
      {label: "Good"},
      {label: "Units", align: "right"},
      {label: "Counterparty"},
      {label: "Income", align: "right", title: "Money flow for this deal row"},
      {label: "Details", align: "left"}
    ],
    rows: marketDealsRows,
    empty: "No market deals recorded"
  });

  const markerOverviewBody = ensureEl("markerOverviewBody");
  markerOverviewBody.innerHTML = /*html*/ `
    <div style="margin-bottom:.85em;display:flex;flex-wrap:wrap;column-gap:.85em;align-items:center">
      <span><b>Trade Center:</b> ${centerBurg.name} (${market.i})</span>
      <span><b>Owner: </b>${getOwnerStateName(market)}</span>
      <span><b>Connected Burgs:</b> ${Trade.getMarketBurgIds(market.i).length}</span>
      <span><b>State Sales Tax:</b> ${rn(taxRate * 100, 2)}%</span>
      <span><b>Recorded Units:</b> ${rn(totalUnits, 2)}</span>
    </div>
    ${renderSection("Market Statistics", marketStatsHtml, "Current stock and price levels for every good in this market.")}
    ${summaryHtml}
    ${renderSection("Market Deal History", dealHistoryHtml, "Chronological deal log for the selected market.")}
  `;

  markerOverviewBody.onclick = event => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLTableRowElement>("tr[data-target]");
    if (!row) return;

    const targetId = row.dataset.target;
    if (!targetId) return;

    const detailsRow = markerOverviewBody.querySelector<HTMLTableRowElement>(`#${targetId}`);
    if (!detailsRow) return;

    const isOpen = detailsRow.style.display !== "none";
    detailsRow.style.display = isOpen ? "none" : "table-row";
  };

  $("#markerOverview").dialog({
    width: "auto",
    resizable: true,
    title: `Marker Overview: ${centerBurg.name}`,
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });
}

declare global {
  interface Window {
    MarkerOverview: {open: typeof open};
  }
  var MarkerOverview: {open: typeof open};
  var toggleTrade: () => void;
}

window.MarkerOverview = {open};
