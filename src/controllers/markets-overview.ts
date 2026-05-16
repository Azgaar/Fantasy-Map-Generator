import { easeSinIn } from "d3";
import type { Burg } from "../modules/burgs-generator";
import type { Deal, Market } from "../modules/trade-generator";
import { debounce, ensureEl, formatPrice, rn } from "../utils";

let isInitialized = false;
let isCompareInitialized = false;
let compareGoodId = -1;

export function open(): void {
  if (customization) return;
  closeDialogs("#marketsOverview, .stable");
  if (!layerIsOn("toggleTrade")) toggleTrade();

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
    ensureEl("marketsOverviewCompare").on("click", openCompareDialog);
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
  if (!markets.length) {
    ensureEl("marketsOverviewBody").innerHTML = "No markets available";
    updateFooter(0, 0, 0, 0);
    return;
  }

  let lines = "";
  let totalSales = 0;
  let totalBuys = 0;
  let totalIncome = 0;

  for (const market of markets) {
    const centerName = getMarketCenterName(market);
    const ownerName = getOwnerStateName(market);
    const cells = getMarketCells(market.i);
    const burgs = getMarketBurgs(market.i);
    const stock = rn(getMarketTotalStock(market), 2);
    const { sales, buys, income } = getMarketFinancials(market.i);

    totalSales += sales;
    totalBuys += buys;
    totalIncome += income;

    lines += /*html*/ `<div class="states market" data-id="${market.i}"
        data-market="${centerName}" data-owner="${ownerName}"
        data-cells="${cells}" data-burgs="${burgs}"
        data-stock="${stock}" data-sales="${sales}" data-buys="${buys}" data-income="${income}">
      <fill-box fill="${market.color}"></fill-box>
      <div data-tip="Market center burg. Click to view details" class="marketName" style="width:7em">${centerName}</div>
      <div data-tip="Owning state" class="marketOwner" style="width:8em">${ownerName}</div>
      <div data-tip="Number of cells in market territory" class="marketCells" style="width:3.5em">${cells}</div>
      <div data-tip="Number of burgs in market territory" class="marketBurgs" style="width:3.5em">${burgs}</div>
      <div data-tip="Total stock of all goods in this market" class="marketStock" style="width:5em">${stock}</div>
      <div data-tip="Total gross sales revenue" class="marketSales" style="width:6em">${formatPrice(sales)}</div>
      <div data-tip="Total purchase spending" class="marketBuysCol" style="width:6em">${formatPrice(buys)}</div>
      <div data-tip="Net income" class="marketIncome" style="width:6em">${formatPrice(income)}</div>
    </div>`;
  }

  ensureEl("marketsOverviewBody").innerHTML = lines;

  ensureEl("marketsOverviewBody")
    .querySelectorAll<HTMLElement>(".states.market")
    .forEach(row => {
      row.on("mouseenter", highlightMarketOn);
      row.on("mouseleave", highlightMarketOff);
    });

  const count = markets.length;
  updateFooter(
    count,
    count ? rn(totalSales / count, 2) : 0,
    count ? rn(totalBuys / count, 2) : 0,
    count ? rn(totalIncome / count, 2) : 0
  );
  applySorting(ensureEl("marketsOverviewHeader"));
  $("#marketsOverview").dialog({ width: fitContent() });
}

const highlightMarketOn = debounce((ev: Event) => {
  const marketId = +(ev.currentTarget as HTMLElement).dataset.id!;
  if (!layerIsOn("toggleTrade")) return;
  trade
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
  if (!layerIsOn("toggleTrade")) return;
  trade.select(`#market${marketId} circle`).transition().attr("stroke-width", null).attr("stroke", null);
}

function openCompareDialog(): void {
  rebuildCompareGoodSelect();
  compareDialogAddLines();
  $("#marketsGoodCompare").dialog({
    title: "Compare Prices",
    resizable: false,
    width: "auto",
    position: {
      my: "right top",
      at: "left-10 top",
      of: "#marketsOverview",
      collision: "fit"
    }
  });
  if (!isCompareInitialized) {
    ensureEl("marketsGoodCompareSelect").on("change", () => {
      compareGoodId = +ensureEl<HTMLSelectElement>("marketsGoodCompareSelect").value;
      compareDialogAddLines();
    });
    isCompareInitialized = true;
  }
}

function compareDialogAddLines(): void {
  const good = compareGoodId >= 0 ? Goods.get(compareGoodId) : undefined;
  if (!good) {
    ensureEl("marketsGoodCompareBody").innerHTML = "Select a good";
    return;
  }

  let lines = "";
  for (const market of pack.markets) {
    const centerName = getMarketCenterName(market);
    const goodData = market.goods[good.i];
    const stock = rn(goodData?.stock ?? 0, 2);
    const price = rn(goodData?.price ?? 0, 2);
    lines += /*html*/ `<div class="states" data-id="${market.i}" data-market="${centerName}" data-stock="${stock}" data-price="${price}">
      <fill-box fill="${market.color}"></fill-box>
      <div style="width:9em">${centerName}</div>
      <div style="width:5em">${stock}</div>
      <div style="width:7em">${formatPrice(price)}</div>
    </div>`;
  }
  ensureEl("marketsGoodCompareBody").innerHTML = lines;
  applySorting(ensureEl("marketsGoodCompareHeader"));
  $("#marketsGoodCompare").dialog({ width: fitContent() });
}

function rebuildCompareGoodSelect(): void {
  const select = ensureEl<HTMLSelectElement>("marketsGoodCompareSelect");
  const prev = compareGoodId >= 0 ? compareGoodId : +select.value;
  select.innerHTML = pack.goods
    .map(g => `<option value="${g.i}" ${g.i === prev ? "selected" : ""}>${g.name}</option>`)
    .join("");
  if (prev >= 0 && Goods.get(prev)) {
    compareGoodId = prev;
    select.value = String(prev);
  } else {
    compareGoodId = pack.goods[0]?.i ?? 0;
    select.value = String(compareGoodId);
  }
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

function getMarketFinancials(marketId: number): {
  sales: number;
  buys: number;
  income: number;
} {
  const deals: Deal[] = (pack.deals || []).filter((deal: Deal) => deal.market === marketId);
  let sales = 0;
  let buys = 0;
  let tax = 0;

  for (const deal of deals) {
    const amount = deal.units * deal.price;
    if (deal.phase === "sell") {
      sales += amount;
      const seller = pack.burgs[deal.seller] as Burg | undefined;
      if (seller) tax += amount * Trade.getSalesTaxRate(seller);
    } else {
      buys += amount;
    }
  }

  return {
    sales: rn(sales, 2),
    buys: rn(buys, 2),
    income: rn(sales - tax - buys, 2)
  };
}

function updateFooter(count: number, avgSales: number, avgBuys: number, avgIncome: number): void {
  ensureEl("marketsOverviewFooterMarkets").innerHTML = String(count);
  ensureEl("marketsOverviewFooterSales").innerHTML = formatPrice(avgSales);
  ensureEl("marketsOverviewFooterBuys").innerHTML = formatPrice(avgBuys);
  ensureEl("marketsOverviewFooterIncome").innerHTML = formatPrice(avgIncome);
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
  let csv = "Market,Owner,Cells,Burgs,Total Stock,Sales,Buys,Income\n";
  for (const market of pack.markets) {
    const { sales, buys, income } = getMarketFinancials(market.i);
    const cells = getMarketCells(market.i);
    const burgs = getMarketBurgs(market.i);
    const stock = rn(getMarketTotalStock(market), 2);
    csv += `${[getMarketCenterName(market), getOwnerStateName(market), cells, burgs, stock, sales, buys, income].join(",")}\n`;
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
