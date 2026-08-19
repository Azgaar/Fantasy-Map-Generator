import { drag, select } from "d3";
import { closeDialogs, confirmationDialog, refreshEditors, updateDialog } from "@/components/dialog/dialog-helpers";
import { bindColumnSorting, sortDataByColumns } from "@/components/dialog/sorting";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  setModeHiddenColumns,
  type TableView
} from "@/components/dialog/table";
import type { FillBoxElement } from "@/components/fill-box";
import { Layers } from "@/components/layers";
import { clearMainTip, showMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import { moveCircle, removeCircle } from "@/renderers/overlays/brush-circle";
import { downloadFile, getFileName } from "@/utils";
import type { Burg } from "../generators/burgs-generator";
import type { Deal, Market } from "../generators/markets-generator";
import { highlightMarketOff, highlightMarketOn } from "../renderers/draw-markets";
import {
  ensureEl,
  findAllCellsInRadius,
  findClosestCell,
  formatPrice,
  getIsolines,
  getPointer,
  getVertexPath,
  rn
} from "../utils";

// Working copy of pack.cells.market mutated during manual assignment; applied on commit.
let marketsWorking: Uint16Array | null = null;
let marketsManualHistory: Uint16Array[] = [];
const dialogId = "marketsOverview" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };

type MarketRow = {
  market: Market;
  name: string;
  owner: string;
  cells: number;
  burgs: number;
  stock: number;
  sales: number;
  buys: number;
  value: number;
};

const columns: EditorColumn<MarketRow>[] = [
  { key: "color", width: "1.6em", permanent: true },
  { key: "market", label: "Market", width: "7em", permanent: true, sortBy: row => row.name, sortType: "alpha" },
  { key: "owner", label: "Owner", width: "7em", sortBy: row => row.owner, sortType: "alpha" },
  { key: "cells", label: "Cells", width: "4em", sortBy: row => row.cells },
  { key: "burgs", label: "Burgs", width: "4em", sortBy: row => row.burgs },
  { key: "stock", label: "Stock", width: "5em", sortBy: row => row.stock },
  { key: "sales", label: "Sales", width: "5em", sortBy: row => row.sales },
  { key: "buys", label: "Buys", width: "5em", sortBy: row => row.buys },
  {
    key: "value",
    label: "Value",
    width: "5em",
    sortBy: row => row.value,
    defaultSort: "desc",
    tip: "Market value: net trading flow plus unsold inventory value minus tax. Click to sort"
  },
  { key: "actions", width: "1.4em", permanent: true, align: "right" }
];

const marketsTable = initEditorTable<MarketRow>({ getData: getMarketsData, onUpdate: renderMarketsPage });

function open(): void {
  if (customization) return;
  closeDialogs("#marketsOverview, .stable");
  Layers.show("markets");

  renderDialog();
  marketsTable.reset();

  $("#marketsOverview").dialog({
    title: "Markets Overview",
    resizable: false,
    width: "auto",
    close: closeMarketsOverview,
    position
  });
}

function renderDialog(): void {
  document.getElementById("marketsOverview")?.remove();
  const editorHtml = /* html */ `<div id="marketsOverview" class="dialog stable editorDialog">
      ${renderEditorHeader({ dialogId, columns })}
      <div id="marketsOverviewBody" class="table" data-type="absolute" style="max-height:40em; cursor:pointer"></div>
      <div id="marketsOverviewFooter" class="totalLine">
        <div data-tip="Total number of markets" style="margin-left:5px">Markets:&nbsp;<span id="marketsOverviewFooterMarkets">0</span></div>
        <div data-tip="Average gross sales revenue per market" style="margin-left:12px">Avg Sales:&nbsp;<span id="marketsOverviewFooterSales">0</span></div>
        <div data-tip="Average purchase spending per market" style="margin-left:12px">Avg Buys:&nbsp;<span id="marketsOverviewFooterBuys">0</span></div>
        <div data-tip="Average market value per market" style="margin-left:12px">Avg Value:&nbsp;<span id="marketsOverviewFooterValue">0</span></div>
      </div>
      <div id="marketsOverviewBottom">
        <button id="marketsOverviewRefresh" data-tip="Refresh the overview" class="icon-cw"></button>
        <button id="marketsOverviewPercentage" data-tip="Toggle percentage / absolute values views" class="icon-percent"></button>
        <button id="marketsOverviewCompare" data-tip="Compare good stock across markets" class="icon-chart-bar"></button>
        <button id="marketsOverviewExport" data-tip="Save markets data as a CSV file" class="icon-download"></button>
        <slider-input id="marketsBrush" min="1" max="100" value="15" data-tip="Change brush size. Shortcuts: + / ] to increase; - / [ to decrease" style="display: none;"></slider-input>
        <button id="marketsManually" data-tip="Manually re-assign market territories" class="icon-brush"></button>
        <div id="marketsManuallyButtons" style="display: none">
          <button id="marketsManuallyUndo" data-tip="Undo last brush stroke" class="icon-ccw"></button>
          <button id="marketsManuallyApply" data-tip="Apply assignment" class="icon-check"></button>
          <button id="marketsManuallyCancel" data-tip="Cancel assignment" class="icon-cancel"></button>
        </div>
        <button id="marketsAdd" data-tip="Add a new market. Click on a burg on the map. Hold Shift to add multiple" class="icon-plus"></button>
        <button id="marketsRegenerate" data-tip="Regenerate markets and their territories" class="icon-arrows-cw"></button>
        <button id="marketsRegenerateProduction" data-tip="Regenerate production and trade deals" class="icon-retweet"></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  bindColumnSorting(dialogId, marketsTable.reset);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });

  ensureEl("marketsOverviewRefresh").addEventListener("click", marketsTable.refresh);
  ensureEl("marketsOverviewExport").addEventListener("click", downloadMarketsCsv);
  ensureEl("marketsOverviewCompare").addEventListener("click", () => Controllers.ComparePrices.open());
  ensureEl("marketsOverviewPercentage").addEventListener("click", togglePercentageMode);
  ensureEl("marketsManually").addEventListener("click", () => {
    if (customization === 15) exitMarketsManualAssignment(false);
    else enterMarketsManualAssignment();
  });
  ensureEl("marketsManuallyUndo").addEventListener("click", undoMarketsManualStep);
  ensureEl("marketsManuallyApply").addEventListener("click", () => exitMarketsManualAssignment(true));
  ensureEl("marketsManuallyCancel").addEventListener("click", () => exitMarketsManualAssignment(false));
  ensureEl("marketsAdd").addEventListener("click", () => {
    if (customization === 16) exitAddMarketMode();
    else enterAddMarketMode();
  });
  ensureEl("marketsRegenerate").addEventListener("click", regenerateMarkets);
  ensureEl("marketsRegenerateProduction").addEventListener("click", regenerateProduction);
  ensureEl("marketsOverviewBody").addEventListener("click", (ev: Event) => {
    const target = ev.target as HTMLElement;

    const fillBox = target.closest<FillBoxElement>("fill-box");
    if (fillBox) {
      const row = fillBox.closest<HTMLElement>(".states.market");
      const marketId = row ? +row.dataset.id! : 0;
      // marketId 0 is the "No market" row — it has no color to edit
      if (marketId) marketChangeFill(fillBox, marketId);
      return;
    }

    if (target.classList.contains("icon-trash-empty")) {
      const line = target.closest<HTMLElement>(".states.market");
      if (!line) return;
      confirmRemoveMarket(+line.dataset.id!);
      return;
    }

    const line = target.closest<HTMLElement>(".states.market");
    if (!line) return;
    const marketId = +line.dataset.id!;

    if (customization === 15) {
      ensureEl("marketsOverviewBody")
        .querySelector<HTMLElement>(".states.market.selected")
        ?.classList.remove("selected");
      line.classList.add("selected");
    } else if (marketId) {
      // marketId 0 is the non-editable "No market" summary row — no detail dialog
      Controllers.MarketOverview.open(marketId);
    }
  });
}

function getMarketsData(): MarketRow[] {
  const rows = pack.markets.map(market => {
    const { sales, buys, value } = getMarketFinancials(market);
    return {
      market,
      name: Markets.getName(market),
      owner: getOwnerStateName(market),
      cells: getMarketCells(market.i),
      burgs: getMarketBurgs(market.i),
      stock: rn(getMarketTotalStock(market), 2),
      sales,
      buys,
      value
    };
  });
  return sortDataByColumns(dialogId, rows, columns);
}

function renderMarketsPage(view: TableView<MarketRow>): void {
  const body = ensureEl("marketsOverviewBody");
  if (!view.all.length) {
    body.innerHTML = "No markets available";
    updateFooter(0, 0, 0, 0);
    renderEditorPagination(ensureEl("marketsOverviewFooter"), view, marketsTable.goto);
    return;
  }

  const totals = view.all.reduce(
    (sum, row) => ({
      cells: sum.cells + row.cells,
      burgs: sum.burgs + row.burgs,
      stock: sum.stock + row.stock,
      sales: sum.sales + row.sales,
      buys: sum.buys + row.buys,
      value: sum.value + row.value
    }),
    { cells: getMarketCells(0), burgs: getMarketBurgs(0), stock: 0, sales: 0, buys: 0, value: 0 }
  );
  const percentage = body.dataset.type === "percentage";
  const format = (type: keyof typeof totals, value: number, price = false) =>
    percentage ? `${rn(totals[type] ? (value / totals[type]) * 100 : 0, 2)}%` : price ? formatPrice(rn(value)) : value;
  const lines = view.rows.map(row => renderMarketRow(row, format)).join("");
  body.innerHTML = lines + renderNoMarketRow(format);

  body.querySelectorAll<HTMLElement>(".states.market").forEach(row => {
    const marketId = row.dataset.id!;
    if (marketId === "0") return; // "No market" row: not a real market, no hover highlight
    row.addEventListener("mouseenter", () => highlightMarketOn(marketId));
    row.addEventListener("mouseleave", () => highlightMarketOff(marketId));
  });

  const count = view.all.length;
  updateFooter(
    count,
    count ? rn(totals.sales / count, 2) : 0,
    count ? rn(totals.buys / count, 2) : 0,
    count ? rn(totals.value / count, 2) : 0
  );
  renderEditorPagination(ensureEl("marketsOverviewFooter"), view, marketsTable.goto);
  updateDialog(dialogId, { width: "fit-content", position });
}

function renderMarketRow(
  row: MarketRow,
  format: (type: keyof Omit<MarketRow, "market" | "name" | "owner">, value: number, price?: boolean) => string | number
): string {
  const { market, name, owner, cells, burgs, stock, sales, buys, value } = row;
  return /*html*/ `<div class="states market" data-id="${market.i}">
    <div data-col="color"><fill-box fill="${market.color}"></fill-box></div>
    <div data-col="market" data-tip="Market name. Click to view details" class="marketName">${name}</div>
    <div data-col="owner" data-tip="Owning state" class="marketOwner">${owner}</div>
    <div data-col="cells" data-tip="Number of cells in market territory" class="marketCells">${format("cells", cells)}</div>
    <div data-col="burgs" data-tip="Number of burgs in market territory" class="marketBurgs">${format("burgs", burgs)}</div>
    <div data-col="stock" data-tip="Total stock of all goods in this market" class="marketStock">${format("stock", stock)}</div>
    <div data-col="sales" data-tip="Total gross sales revenue" class="marketSales">${format("sales", sales, true)}</div>
    <div data-col="buys" data-tip="Total purchase spending" class="marketBuysCol">${format("buys", buys, true)}</div>
    <div data-col="value" data-tip="Market value: net trading flow plus unsold inventory value minus tax" class="marketValue">${format("value", value, true)}</div>
    <div data-col="actions"><span data-tip="Remove this market" class="icon-trash-empty hiddenIcon" style="visibility:hidden"></span></div>
  </div>`;
}

function enterMarketsManualAssignment(): void {
  Layers.show("markets");
  customization = 15;
  marketsManualHistory = [];

  document.getElementById("marketsTemp")?.remove();
  select("#markets").append("g").attr("id", "marketsTemp").style("fill-opacity", "0.7");
  marketsWorking = Uint16Array.from(pack.cells.market);
  renderMarketsTemp();

  document.querySelectorAll<HTMLElement>("#marketsOverviewBottom > button").forEach(b => {
    b.style.display = "none";
  });
  ensureEl("marketsManuallyButtons").style.display = "block";
  ensureEl("marketsBrush").style.display = "inline-block";
  ensureEl("marketsManually").classList.add("pressed");
  ensureEl("marketsOverviewFooter").style.display = "none";

  setModeHiddenColumns(dialogId, ["burgs", "stock", "sales", "buys", "value", "actions"]);

  tip('Click a market row (or "No market") to select it, then drag on the map to repaint territory', true);

  const firstRow = ensureEl("marketsOverviewBody").querySelector<HTMLElement>('.states.market:not([data-id="0"])');
  if (firstRow) firstRow.classList.add("selected");

  select<SVGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .on("click", selectMarketOnMapClick)
    .call(drag<SVGElement, unknown>().on("start", startMarketsBrushDrag))
    .on("touchmove mousemove", onMarketsBrushMove);

  $("#marketsOverview").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" } });
}

function saveMarketsManualSnapshot(): void {
  if (marketsWorking) marketsManualHistory.push(Uint16Array.from(marketsWorking));
}

function renderNoMarketRow(
  format: (type: "cells" | "burgs" | "stock" | "sales" | "buys" | "value", value: number) => string | number = (
    _type,
    value
  ) => value
): string {
  const cells = getMarketCells(0);
  const burgs = getMarketBurgs(0);
  return /*html*/ `<div class="states market" data-id="0">
    <div data-col="color"><fill-box fill="none" data-tip="Cells assigned to no market"></fill-box></div>
    <div data-col="market" data-tip="Cells with no market; their burgs are excluded from production" class="marketName">No market</div>
    <div data-col="owner" class="marketOwner">—</div>
    <div data-col="cells" data-tip="Number of cells with no market" class="marketCells">${format("cells", cells)}</div>
    <div data-col="burgs" data-tip="Number of burgs with no market" class="marketBurgs">${format("burgs", burgs)}</div>
    <div data-col="stock" class="marketStock">—</div>
    <div data-col="sales" class="marketSales">—</div>
    <div data-col="buys" class="marketBuysCol">—</div>
    <div data-col="value" class="marketValue">—</div>
    <div data-col="actions"></div>
  </div>`;
}

function selectMarketOnMapClick(this: SVGElement, event: MouseEvent): void {
  const [x, y] = getPointer(event, this);
  const cellId = findCell(x, y);
  if (cellId === undefined) return;

  const marketId = (marketsWorking ?? pack.cells.market)[cellId];

  const body = ensureEl("marketsOverviewBody");
  body.querySelector<HTMLElement>(".states.market.selected")?.classList.remove("selected");
  body.querySelector<HTMLElement>(`.states.market[data-id="${marketId}"]`)?.classList.add("selected");
}

function startMarketsBrushDrag(this: SVGElement, event: any): void {
  const selectedRow = ensureEl("marketsOverviewBody").querySelector<HTMLElement>(".states.market.selected");
  if (!selectedRow) return;
  const marketId = +selectedRow.dataset.id!;
  // marketId 0 = "no market" (erase assignment); any other id must be an existing market.
  if (marketId !== 0 && !Markets.get(marketId)) return;

  saveMarketsManualSnapshot();
  const r = +ensureEl<HTMLInputElement>("marketsBrush").value;

  event.on("drag", (dragEvent: any) => {
    if (!dragEvent.dx && !dragEvent.dy) return;
    const [x, y] = getPointer(dragEvent, this);
    moveCircle(x, y, r);

    const found = r > 5 ? findAllCellsInRadius(x, y, r, pack) : [findClosestCell(x, y, Infinity, pack)];
    const selection = found.filter(cellId => cellId !== undefined);
    if (!selection.length) return;
    paintMarketCells(selection, marketId);
  });
}

function paintMarketCells(selection: number[], targetMarketId: number) {
  if (!marketsWorking) return;

  const affected = new Set<number>([targetMarketId]);
  let changed = false;
  for (const cellId of selection) {
    const prev = marketsWorking[cellId];
    if (prev === targetMarketId) continue;
    if (prev) affected.add(prev); // previous owner loses a cell
    marketsWorking[cellId] = targetMarketId;
    changed = true;
  }

  if (changed) updateMarketTempPaths(affected);
}

// Render every market's territory as a single combined path (one DOM node per market).
function renderMarketsTemp(): void {
  const temp = document.getElementById("marketsTemp");
  if (!temp || !marketsWorking) return;

  const working = marketsWorking;
  const isolines = getIsolines(pack, cellId => working[cellId] || null, { fill: true });
  temp.innerHTML = pack.markets
    .map(market => `<path data-market="${market.i}" fill="${market.color}" d="${isolines[market.i]?.fill || ""}"/>`)
    .join("");
}

// Recompute the combined path only for the markets whose territory changed.
function updateMarketTempPaths(marketIds: Iterable<number>): void {
  const temp = document.getElementById("marketsTemp");
  if (!temp || !marketsWorking) return;

  const cellsByMarket = new Map<number, number[]>();
  for (const id of marketIds) cellsByMarket.set(id, []);

  for (let cellId = 0; cellId < marketsWorking.length; cellId++) {
    const cells = cellsByMarket.get(marketsWorking[cellId]);
    if (cells) cells.push(cellId);
  }

  for (const [marketId, cells] of cellsByMarket) {
    if (!marketId) continue; // market 0 = "no market": those cells are left unpainted
    const d = cells.length ? getVertexPath(cells, pack) : "";
    setMarketTempPath(temp, marketId, d);
  }
}

function setMarketTempPath(temp: HTMLElement, marketId: number, d: string): void {
  let path = temp.querySelector<SVGPathElement>(`path[data-market="${marketId}"]`);
  if (!path) {
    path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("data-market", String(marketId));
    const market = Markets.get(marketId);
    if (market) path.setAttribute("fill", market.color);
    temp.appendChild(path);
  }
  path.setAttribute("d", d);
}

function onMarketsBrushMove(this: SVGElement, event: MouseEvent): void {
  showMainTip();
  const [x, y] = getPointer(event, this);
  const r = +ensureEl<HTMLInputElement>("marketsBrush").value;
  moveCircle(x, y, r);
}

function undoMarketsManualStep(): void {
  if (!marketsManualHistory.length) return;
  marketsWorking = marketsManualHistory.pop()!;
  renderMarketsTemp();
}

function exitMarketsManualAssignment(apply: boolean): void {
  customization = 0;

  if (apply && marketsWorking) {
    for (let cellId = 0; cellId < marketsWorking.length; cellId++) {
      const marketId = marketsWorking[cellId];
      pack.cells.market[cellId] = marketId;
      const burgId = pack.cells.burg[cellId];
      if (burgId) (pack.burgs as Burg[])[burgId].market = marketId;
    }
  }

  marketsWorking = null;
  marketsManualHistory = [];
  document.getElementById("marketsTemp")?.remove();

  setModeHiddenColumns(dialogId, []);
  ensureEl("marketsOverviewFooter").style.display = "";

  document.querySelectorAll<HTMLElement>("#marketsOverviewBottom > button").forEach(b => {
    b.style.display = "";
  });
  ensureEl("marketsManuallyButtons").style.display = "none";
  ensureEl("marketsBrush").style.display = "none";
  ensureEl("marketsManually").classList.remove("pressed");
  ensureEl("marketsOverviewBody").querySelector<HTMLElement>(".states.market.selected")?.classList.remove("selected");

  applyDefaultViewboxEvents();
  clearMainTip();
  removeCircle();

  if (apply) {
    Layers.draw("markets");
    marketsTable.refresh();
  }

  $("#marketsOverview").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" } });
}

function enterAddMarketMode(): void {
  customization = 16;
  ensureEl("marketsAdd").classList.add("pressed");
  tip("Click on a burg on the map to create a new market there. Hold Shift to add multiple", true);
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addMarketOnClick);
}

function exitAddMarketMode(): void {
  customization = 0;
  ensureEl("marketsAdd").classList.remove("pressed");
  applyDefaultViewboxEvents();
  clearMainTip();
}

function addMarketOnClick(this: SVGElement, ev: MouseEvent): void {
  const [x, y] = getPointer(ev, this);
  const cellId = findCell(x, y);
  if (cellId === undefined) return;

  const burgId = pack.cells.burg[cellId];
  if (!burgId) {
    tip("Click on a burg to create a new market — no burg found here", false, "error");
    return;
  }

  const newMarket = Markets.addMarket(burgId);
  if (!newMarket) return;

  if (!ev.shiftKey) exitAddMarketMode();

  Layers.draw("markets");
  marketsTable.refresh();
}

function confirmRemoveMarket(marketId: number): void {
  const market = Markets.get(marketId);
  if (!market) return;
  const name = Markets.getName(market);

  confirmationDialog({
    title: "Remove Market",
    message: `Are you sure you want to remove the market "${name}"?<br>This action cannot be reverted`,
    confirm: "Remove",
    onConfirm: () => {
      Markets.removeMarket(marketId);
      Layers.draw("markets");
      marketsTable.refresh();
    }
  });
}

function marketChangeFill(fillBox: FillBoxElement, marketId: number): void {
  const market = Markets.get(marketId);
  if (!market) return;

  const callback = (newFill: string) => {
    fillBox.fill = newFill;
    market.color = newFill;
    Layers.draw("markets");
  };

  void Controllers.ColorPicker.open(market.color, callback);
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
  body.dataset.type = body.dataset.type === "absolute" ? "percentage" : "absolute";
  marketsTable.refresh();
}

function updateFooter(count: number, avgSales: number, avgBuys: number, avgValue: number): void {
  ensureEl("marketsOverviewFooterMarkets").innerHTML = String(count);
  ensureEl("marketsOverviewFooterSales").innerHTML = formatPrice(avgSales);
  ensureEl("marketsOverviewFooterBuys").innerHTML = formatPrice(avgBuys);
  ensureEl("marketsOverviewFooterValue").innerHTML = formatPrice(avgValue);
}

function getOwnerStateName(market: Market): string {
  const center = pack.burgs[market.centerBurgId];
  if (!center) return "Unknown";
  if (!center.state) return "Independent";
  return pack.states[center.state]?.name || `State ${center.state}`;
}

function regenerateMarkets() {
  confirmationDialog({
    title: "Regenerate markets",
    message: /* html */ `Are you sure you want to regenerate markets and their territories?
      <label style="display:flex; align-items:center; gap:.4em; margin-top:.6em;">
        <input id="marketsRegenerateProductionToggle" type="checkbox" class="native" checked />
        Regenerate production and trade
      </label>`,
    confirm: "Regenerate",
    onConfirm: () => {
      const regenProduction = ensureEl<HTMLInputElement>("marketsRegenerateProductionToggle").checked;
      Markets.regenerate();
      if (regenProduction) {
        Production.regenerate();
      }
      Layers.draw("markets", "goods");
      Layers.draw("trade");
      refreshEditors();
    }
  });
}

function regenerateProduction() {
  confirmationDialog({
    title: "Regenerate production",
    message:
      "Are you sure you want to regenerate production and trade for all goods? Generation will be based on the current Goods settings and bonus goods placement",
    confirm: "Regenerate",
    onConfirm: () => {
      Production.regenerate();
      Layers.draw("goods");
      Layers.draw("trade");
      refreshEditors();
    }
  });
}

function downloadMarketsCsv(): void {
  let csv = "Market,Owner,Cells,Burgs,Total Stock,Sales,Buys,Value\n";
  for (const market of pack.markets) {
    const { sales, buys, value } = getMarketFinancials(market);
    const cells = getMarketCells(market.i);
    const burgs = getMarketBurgs(market.i);
    const stock = rn(getMarketTotalStock(market), 2);
    csv += `${[Markets.getName(market), getOwnerStateName(market), cells, burgs, stock, sales, buys, value].join(",")}\n`;
  }
  downloadFile(csv, `${getFileName("Markets_Overview")}.csv`);
}

function closeMarketsOverview(): void {
  if (customization === 15) exitMarketsManualAssignment(false);
  if (customization === 16) exitAddMarketMode();
  $("#marketsOverview").dialog("destroy");
  ensureEl("marketsOverview").remove();
}

export const MarketsOverview = { open };
