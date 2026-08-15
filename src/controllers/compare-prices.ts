import { updateDialog } from "@/components/dialog/dialog-helpers";
import { bindColumnSorting, sortDataByColumns } from "@/components/dialog/sorting";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/components/dialog/table";
import { downloadFile, getFileName } from "@/utils";
import type { Market } from "../generators/markets-generator";
import { ensureEl, formatPrice, rn } from "../utils";

const dialogId = "marketsGoodCompare" as const;
const position = { my: "right top", at: "left-10 top", collision: "fit" };
const columns: EditorColumn<Market>[] = [
  { key: "color", width: "1.6em", permanent: true },
  {
    key: "market",
    label: "Market",
    width: "9em",
    permanent: true,
    tip: "Market center burg name. Click to sort",
    sortBy: market => Markets.getName(market),
    sortType: "alpha"
  },
  {
    key: "stock",
    label: "Stock",
    width: "6em",
    tip: "Good stock in this market. Click to sort",
    sortBy: market => market.goods[activeGoodId]?.stock ?? 0,
    defaultSort: "desc"
  },
  {
    key: "price",
    label: "Price",
    width: "6em",
    tip: "Price for this good. Click to sort",
    sortBy: market => market.goods[activeGoodId]?.price ?? 0
  },
  { key: "actions", width: "1.2em", permanent: true }
];

let activeGoodId = -1;
let activeAnchor = "#marketsOverview";

const comparePricesTable = initEditorTable<Market>({
  getData: () => sortDataByColumns(dialogId, [...pack.markets], columns),
  onUpdate: renderComparePricesPage
});

function open(goodId?: number, anchor = "#marketsOverview"): void {
  if (goodId !== undefined) activeGoodId = goodId;
  activeAnchor = anchor;

  renderDialog();
  rebuildGoodSelect();
  comparePricesTable.reset();

  $(`#${dialogId}`).dialog({
    title: "Compare Prices",
    position: { ...position, of: anchor },
    close: closeComparePrices
  });
}

function renderDialog(): void {
  document.getElementById(dialogId)?.remove();
  const editorHtml = /* html */ `<div id="${dialogId}" class="dialog editorDialog">
      <div style="display:flex; align-items:center; gap:.5em; padding:.2em 0 .4em; font-size:.9em;">
        <label for="marketsGoodCompareSelect" data-tip="Select good to compare stock across markets">Good:</label>
        <select id="marketsGoodCompareSelect" style="flex:1; min-width:8em;"></select>
      </div>
      ${renderEditorHeader({ dialogId, columns })}
      <div id="marketsGoodCompareBody" class="table" data-type="absolute" style="max-height:40em;"></div>
      <div id="marketsGoodCompareFooter" class="totalLine">
        <div data-col="stock" data-tip="Total stock of this good across all markets" style="margin-left:5px">Total Stock:&nbsp;<span id="marketsGoodCompareFooterStock">0</span></div>
        <div data-col="price" data-tip="Average price of this good across markets" style="margin-left:12px">Avg Price:&nbsp;<span id="marketsGoodCompareFooterPrice">0</span></div>
      </div>
      <div id="marketsGoodCompareBottom">
        <button id="marketsGoodCompareRefresh" data-tip="Refresh" class="icon-cw"></button>
        <button id="marketsGoodComparePercentage" data-tip="Toggle percentage / absolute values views" class="icon-percent"></button>
        <button id="marketsGoodCompareExport" data-tip="Save data as a CSV file" class="icon-download"></button>
      </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  bindColumnSorting(dialogId, comparePricesTable.reset);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position: { ...position, of: activeAnchor } })
  });

  ensureEl("marketsGoodCompareSelect").addEventListener("change", () => {
    activeGoodId = +ensureEl<HTMLSelectElement>("marketsGoodCompareSelect").value;
    comparePricesTable.reset();
  });
  ensureEl("marketsGoodCompareRefresh").addEventListener("click", comparePricesTable.refresh);
  ensureEl("marketsGoodComparePercentage").addEventListener("click", togglePercentageMode);
  ensureEl("marketsGoodCompareExport").addEventListener("click", downloadCsv);
}

function closeComparePrices(): void {
  $(`#${dialogId}`).dialog("destroy");
  ensureEl(dialogId).remove();
}

function renderComparePricesPage(view: TableView<Market>): void {
  const body = ensureEl("marketsGoodCompareBody");

  const good = activeGoodId >= 0 ? Goods.get(activeGoodId) : undefined;
  if (!good) {
    body.innerHTML = "Select a good";
    updateFooter(0, 0);
    renderEditorPagination(ensureEl("marketsGoodCompareFooter"), view, comparePricesTable.goto);
    return;
  }

  const totalStock = view.all.reduce((total, market) => total + rn(market.goods[good.i]?.stock ?? 0, 2), 0);
  const priceSum = view.all.reduce((total, market) => total + rn(market.goods[good.i]?.price ?? 0, 2), 0);
  const percentage = body.dataset.type === "percentage";

  const lines = view.rows.map(market => {
    const centerName = Markets.getName(market);
    const goodData = market.goods[good.i];
    const stock = rn(goodData?.stock ?? 0, 2);
    const price = rn(goodData?.price ?? 0, 2);
    const stockText = percentage ? (totalStock ? `${rn((stock / totalStock) * 100, 2)}%` : "0%") : String(stock);

    return /*html*/ `<div class="states" data-id="${market.i}" data-market="${centerName}" data-stock="${stock}" data-price="${price}">
      <fill-box data-col="color" fill="${market.color}"></fill-box>
      <div data-col="market">${centerName}</div>
      <div data-col="stock" data-type="stock">${stockText}</div>
      <div data-col="price">${formatPrice(price)}</div>
    </div>`;
  });
  body.innerHTML = lines.join("");
  updateFooter(rn(totalStock, 2), view.all.length ? rn(priceSum / view.all.length, 2) : 0);
  renderEditorPagination(ensureEl("marketsGoodCompareFooter"), view, comparePricesTable.goto);
  updateDialog(dialogId, { width: "fit-content", position: { ...position, of: activeAnchor } });
}

function updateFooter(totalStock: number, avgPrice: number): void {
  ensureEl("marketsGoodCompareFooterStock").innerHTML = String(totalStock);
  ensureEl("marketsGoodCompareFooterPrice").innerHTML = formatPrice(avgPrice);
}

function togglePercentageMode(): void {
  const body = ensureEl("marketsGoodCompareBody");
  body.dataset.type = body.dataset.type === "absolute" ? "percentage" : "absolute";
  comparePricesTable.refresh();
}

function downloadCsv(): void {
  const good = activeGoodId >= 0 ? Goods.get(activeGoodId) : undefined;
  const goodName = good?.name ?? "Unknown";
  let csv = `Market,Stock (${goodName}),Price (${goodName})\n`;
  for (const market of pack.markets) {
    const centerName = Markets.getName(market);
    const goodData = good ? market.goods[good.i] : undefined;
    const stock = rn(goodData?.stock ?? 0, 2);
    const price = rn(goodData?.price ?? 0, 2);
    csv += `${centerName},${stock},${price}\n`;
  }
  downloadFile(csv, `${getFileName(`Compare_Prices_${goodName}`)}.csv`);
}

function rebuildGoodSelect(): void {
  const select = ensureEl<HTMLSelectElement>("marketsGoodCompareSelect");
  const prev = activeGoodId >= 0 ? activeGoodId : +select.value;
  const sortedGoods = [...pack.goods].sort((a, b) => a.name.localeCompare(b.name));
  select.innerHTML = sortedGoods
    .map(g => `<option value="${g.i}" ${g.i === prev ? "selected" : ""}>${g.name}</option>`)
    .join("");
  if (prev >= 0 && Goods.get(prev)) {
    activeGoodId = prev;
    select.value = String(prev);
  } else {
    activeGoodId = sortedGoods[0]?.i ?? 0;
    select.value = String(activeGoodId);
  }
}

export const ComparePrices = { open };
