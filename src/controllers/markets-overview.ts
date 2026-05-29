import { easeSinIn } from "d3";
import type { Burg } from "../modules/burgs-generator";
import type { Deal, Market } from "../modules/markets-generator";
import { debounce, ensureEl, formatPrice, rn } from "../utils";

let isInitialized = false;

export function open(): void {
  if (customization) return;
  closeDialogs("#marketsOverview, .stable");
  if (!layerIsOn("toggleMarkets")) toggleMarkets();

  marketsOverviewAddLines();

  $("#marketsOverview").dialog({
    title: "Markets Overview",
    resizable: false,
    width: "auto",
    close: closeMarketsOverview,
    position: {
      my: "right top",
      at: "right-10 top+10",
      of: "svg",
      collision: "fit"
    }
  });

  if (!isInitialized) {
    ensureEl("marketsOverviewRefresh").on("click", marketsOverviewAddLines);
    ensureEl("marketsOverviewExport").on("click", downloadMarketsCsv);
    ensureEl("marketsOverviewCompare").on("click", () => window.ComparePrices.open());
    ensureEl("marketsOverviewPercentage").on("click", togglePercentageMode);
    ensureEl("marketsOverviewBody").on("click", ev => {
      const line = (ev.target as HTMLElement).closest<HTMLElement>(".states.market");
      if (!line) return;
      const marketId = +line.dataset.id!;
      window.MarketOverview.open(marketId);
    });
    isInitialized = true;
  }
}

function marketsOverviewAddLines(): void {
  const markets = pack.markets;
  const body = ensureEl("marketsOverviewBody");

  if (body.dataset.type === "percentage") {
    body.dataset.type = "absolute";
  }

  if (!markets.length) {
    body.innerHTML = "No markets available";
    updateFooter(0, 0, 0, 0);
    return;
  }

  let lines = "";
  let totalSales = 0;
  let totalBuys = 0;
  let totalValue = 0;

  for (const market of markets) {
    const centerName = getMarketCenterName(market);
    const ownerName = getOwnerStateName(market);
    const cells = getMarketCells(market.i);
    const burgs = getMarketBurgs(market.i);
    const stock = rn(getMarketTotalStock(market), 2);
    const { sales, buys, value } = getMarketFinancials(market);

    totalSales += sales;
    totalBuys += buys;
    totalValue += value;

    lines += /*html*/ `<div class="states market" data-id="${market.i}"
        data-market="${centerName}" data-owner="${ownerName}"
        data-cells="${cells}" data-burgs="${burgs}"
        data-stock="${stock}" data-sales="${sales}" data-buys="${buys}" data-value="${value}">
      <fill-box fill="${market.color}"></fill-box>
      <div data-tip="Market center burg. Click to view details" class="marketName" style="width:7em">${centerName}</div>
      <div data-tip="Owning state" class="marketOwner" style="width:8em">${ownerName}</div>
      <div data-tip="Number of cells in market territory" data-type="cells" class="marketCells" style="width:3.5em">${cells}</div>
      <div data-tip="Number of burgs in market territory" data-type="burgs" class="marketBurgs" style="width:3.5em">${burgs}</div>
      <div data-tip="Total stock of all goods in this market" data-type="stock" class="marketStock" style="width:5em">${stock}</div>
      <div data-tip="Total gross sales revenue" data-type="sales" class="marketSales" style="width:6em">${formatPrice(sales)}</div>
      <div data-tip="Total purchase spending" data-type="buys" class="marketBuysCol" style="width:6em">${formatPrice(buys)}</div>
      <div data-tip="Market value: net trading flow plus unsold inventory value minus tax" data-type="value" class="marketValue" style="width:6em">${formatPrice(value)}</div>
    </div>`;
  }

  body.innerHTML = lines;

  body.querySelectorAll<HTMLElement>(".states.market").forEach(row => {
    row.on("mouseenter", highlightMarketOn);
    row.on("mouseleave", highlightMarketOff);
  });

  const count = markets.length;
  updateFooter(
    count,
    count ? rn(totalSales / count, 2) : 0,
    count ? rn(totalBuys / count, 2) : 0,
    count ? rn(totalValue / count, 2) : 0
  );
  applySorting(ensureEl("marketsOverviewHeader"));
  $("#marketsOverview").dialog({ width: fitContent() });
}

const highlightMarketOn = debounce((ev: Event) => {
  const marketId = +(ev.currentTarget as HTMLElement).dataset.id!;
  if (!layerIsOn("toggleMarkets")) return;
  markets
    .select(`#market${marketId} circle`)
    .raise()
    .transition()
    .duration(2000)
    .ease(easeSinIn)
    .attr("stroke-width", 2.5)
    .attr("stroke", "#d0240f");
}, 200);

function highlightMarketOff(ev: Event): void {
  const marketId = +(ev.currentTarget as HTMLElement).dataset.id!;
  if (!layerIsOn("toggleMarkets")) return;
  markets.select(`#market${marketId} circle`).transition().attr("stroke-width", null).attr("stroke", null);
}

function getMarketTotalStock(market: Market): number {
  return Object.values(market.goods).reduce((sum, g) => sum + (g.stock || 0), 0);
}

function getMarketCells(marketId: number): number {
  const marketArr = pack.cells.market;
  if (!marketArr) return 0;
  let count = 0;
  for (let i = 0; i < marketArr.length; i++) {
    if (marketArr[i] === marketId) count++;
  }
  return count;
}

function getMarketBurgs(marketId: number): number {
  const marketArr = pack.cells.market;
  if (!marketArr) return 0;
  return (pack.burgs as Burg[]).filter(b => b.i && !b.removed && marketArr[b.cell] === marketId).length;
}

function getMarketFinancials(market: Market): {
  sales: number;
  buys: number;
  value: number;
} {
  const marketId = market.i;
  const deals: Deal[] = (pack.deals || []).filter(
    (deal: Deal) =>
      (deal.sellerType === "market" && deal.seller === marketId) ||
      (deal.buyerType === "market" && deal.buyer === marketId)
  );
  let sales = 0;
  let buys = 0;
  let tax = 0;

  for (const deal of deals) {
    const amount = deal.units * deal.price;
    const marketIsSeller = deal.sellerType === "market" && deal.seller === marketId;
    if (marketIsSeller) {
      sales += amount;
      tax += deal.tax || 0;
    } else {
      buys += amount;
    }
  }

  const stockValue = Object.values(market.goods).reduce((sum, g) => sum + (g.stock || 0) * (g.price || 0), 0);

  return {
    sales: rn(sales, 2),
    buys: rn(buys, 2),
    value: rn(buys - sales + stockValue - tax, 2)
  };
}

function togglePercentageMode(): void {
  const body = ensureEl("marketsOverviewBody");
  if (body.dataset.type === "absolute") {
    body.dataset.type = "percentage";
    const rows = Array.from(body.querySelectorAll<HTMLElement>(":scope > div"));
    const totals: Record<string, number> = {};
    const numericTypes = ["cells", "burgs", "stock", "sales", "buys", "value"];
    for (const type of numericTypes) {
      totals[type] = rows.reduce((sum, row) => sum + (+row.dataset[type]! || 0), 0);
    }
    rows.forEach(row => {
      row.querySelectorAll<HTMLElement>("div[data-type]").forEach(cell => {
        const type = cell.dataset.type!;
        const val = +row.dataset[type]! || 0;
        cell.textContent = totals[type] ? `${rn((val / totals[type]) * 100, 2)}%` : "0%";
      });
    });
  } else {
    body.dataset.type = "absolute";
    marketsOverviewAddLines();
  }
}

function updateFooter(count: number, avgSales: number, avgBuys: number, avgValue: number): void {
  ensureEl("marketsOverviewFooterMarkets").innerHTML = String(count);
  ensureEl("marketsOverviewFooterSales").innerHTML = formatPrice(avgSales);
  ensureEl("marketsOverviewFooterBuys").innerHTML = formatPrice(avgBuys);
  ensureEl("marketsOverviewFooterValue").innerHTML = formatPrice(avgValue);
}

function getMarketCenterName(market: Market): string {
  return pack.burgs[market.centerBurgId]?.name || `Market ${market.i}`;
}

function getOwnerStateName(market: Market): string {
  const center = pack.burgs[market.centerBurgId];
  if (!center) return "Unknown";
  if (!center.state) return "Independent";
  return pack.states[center.state]?.name || `State ${center.state}`;
}

function downloadMarketsCsv(): void {
  let csv = "Market,Owner,Cells,Burgs,Total Stock,Sales,Buys,Value\n";
  for (const market of pack.markets) {
    const { sales, buys, value } = getMarketFinancials(market);
    const cells = getMarketCells(market.i);
    const burgs = getMarketBurgs(market.i);
    const stock = rn(getMarketTotalStock(market), 2);
    csv += `${[getMarketCenterName(market), getOwnerStateName(market), cells, burgs, stock, sales, buys, value].join(",")}\n`;
  }
  downloadFile(csv, `${getFileName("Markets_Overview")}.csv`);
}

function closeMarketsOverview(): void {
  ensureEl("marketsOverviewBody").innerHTML = "";
}

declare global {
  interface Window {
    MarketsOverview: { open: typeof open };
  }
}

window.MarketsOverview = { open };
