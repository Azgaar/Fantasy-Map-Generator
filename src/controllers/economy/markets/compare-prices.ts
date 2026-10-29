import { Goods } from "@/model/economy/goods-generator";
import type { Market } from "@/model/economy/markets-generator";
import { Markets } from "@/model/economy/markets-generator";
import { Icons } from "@/model/icons";
import { formatPrice, getMoneyUnit } from "@/model/units";
import { goodBadge } from "@/renderers/draw-goods";
import { Csv } from "@/services/io/csv";
import { Dialog } from "@/ui/dialog/dialog";

import { bindColumnSorting, sortDataByColumns } from "@/ui/dialog/sorting";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/ui/dialog/table";
import { bindEconomyWiki, economyWikiButton } from "@/ui/economy-view";
import { sentences, t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { rn } from "@/utils/number-utils";

const dialogId = "marketsGoodCompare" as const;
const position = { my: "right top", at: "left-10 top" };
const columns: EditorColumn<Market>[] = [
  { key: "color", width: "1.6em", permanent: true },
  {
    key: "market",
    label: t("Market"),
    width: "9em",
    permanent: true,
    tip: sentences(t("Market center burg name"), t("Click to sort")),
    sortBy: market => Markets.getName(market),
    sortType: "alpha"
  },
  {
    key: "stock",
    label: t("Stock"),
    width: "6em",
    tip: sentences(t("Good stock in this market"), t("Click to sort")),
    sortBy: market => market.goods[activeGoodId]?.stock ?? 0,
    defaultSort: "desc"
  },
  {
    key: "price",
    label: t("Price"),
    width: "6em",
    tip: sentences(t("Price, or its share of the base price"), t("Click to sort")),
    sortBy: market => market.goods[activeGoodId]?.price ?? 0
  },
  { key: "actions", width: "1.4em", permanent: true, hidden: true }
];

let activeGoodId = -1;
let activeAnchor = "#marketsOverview";

const comparePricesTable = initEditorTable<Market>({
  getData: () => sortDataByColumns(dialogId, [...pack.markets], columns),
  onUpdate: renderComparePricesPage
});

function open(goodId?: number, anchor = "#marketsOverview"): void {
  void Icons.retry("goods");
  if (goodId !== undefined) activeGoodId = goodId;
  activeAnchor = anchor;

  renderDialog();
  rebuildGoodSelect();
  comparePricesTable.reset();

  Dialog.open(dialogId, {
    title: t("Compare Prices"),
    position: { ...position, of: anchor },
    onClose: closeComparePrices
  });
}

function renderDialog(): void {
  Dialog.destroy(dialogId);
  const editorHtml = /* html */ `<div id="${dialogId}" class="dialog editorDialog">
      <div style="display:flex; align-items:center; gap:.5em; padding:.2em 0 .4em; font-size:.9em;">
        <label for="marketsGoodCompareSelect" data-tip="${t("Select good to compare stock across markets")}">${t("Good")}:</label>
        <svg id="marketsGoodCompareIcon" width="1.6em" height="1.6em"></svg>
        <select id="marketsGoodCompareSelect" style="flex:1; min-width:8em;"></select>
        <span data-tip="${t("Base price in {{money}}", { money: getMoneyUnit() })}">${t("Base Price")}: <span id="marketsGoodCompareBase"></span></span>
      </div>
      ${renderEditorHeader({ dialogId, columns })}
      <div id="marketsGoodCompareBody" class="table" data-type="absolute" style="max-height:40em;"></div>
      <div id="marketsGoodCompareFooter" class="totalLine">
        <div data-col="stock" data-tip="${t("Total stock of this good across all markets")}" style="margin-left:5px">${t("Total Stock")}:&nbsp;<span id="marketsGoodCompareFooterStock">0</span></div>
        <div data-col="price" data-tip="${t("Average price of this good across markets")}" style="margin-left:12px">${t("Avg Price")}:&nbsp;<span id="marketsGoodCompareFooterPrice">0</span></div>
      </div>
      <div id="marketsGoodCompareBottom">
        <button id="marketsGoodCompareRefresh" data-tip="${t("Refresh")}" class="icon-cw"></button>
        <button id="marketsGoodComparePercentage" data-tip="${t("Toggle percentage / absolute values views")}" class="icon-percent"></button>
        <button id="marketsGoodCompareExport" data-tip="${t("Save data as a CSV file")}" class="icon-download"></button>
        ${economyWikiButton("marketsGoodCompareWiki")}
      </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  bindColumnSorting(dialogId, comparePricesTable.reset);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => Dialog.update(dialogId, { width: "fit-content", position: { ...position, of: activeAnchor } })
  });

  ensureEl("marketsGoodCompareSelect").addEventListener("change", () => {
    activeGoodId = +ensureEl<HTMLSelectElement>("marketsGoodCompareSelect").value;
    comparePricesTable.reset();
  });
  ensureEl("marketsGoodCompareRefresh").addEventListener("click", comparePricesTable.refresh);
  bindEconomyWiki("marketsGoodCompareWiki");
  ensureEl("marketsGoodComparePercentage").addEventListener("click", togglePercentageMode);
  ensureEl("marketsGoodCompareExport").addEventListener("click", downloadCsv);
}

function closeComparePrices(): void {
  Dialog.destroy(dialogId);
}

function renderComparePricesPage(view: TableView<Market>): void {
  const body = ensureEl("marketsGoodCompareBody");

  const good = activeGoodId >= 0 ? Goods.get(activeGoodId) : undefined;
  ensureEl("marketsGoodCompareIcon").innerHTML = good ? goodBadge(good) : "";
  ensureEl("marketsGoodCompareBase").innerHTML = good ? formatPrice(good.value) : "";
  if (!good) {
    body.innerHTML = t("Select a good");
    ensureEl("marketsGoodCompareFooterStock").innerHTML = "0";
    ensureEl("marketsGoodCompareFooterPrice").innerHTML = formatPrice(0);
    renderEditorPagination(ensureEl("marketsGoodCompareFooter"), view, comparePricesTable.goto);
    return;
  }

  const totalStock = view.all.reduce((total, market) => total + rn(market.goods[good.i]?.stock ?? 0, 2), 0);
  const priceSum = view.all.reduce((total, market) => total + rn(market.goods[good.i]?.price ?? 0, 2), 0);
  const percentage = body.dataset.type === "percentage";
  const ofBase = (price: number) => `${good.value ? rn((price / good.value) * 100) : 0}%`;
  const priceText = (price: number) => (percentage ? ofBase(price) : formatPrice(price));

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
      <div data-col="price" data-tip="${sentences(`${t("Market price")}: ${formatPrice(price)}`, t("{{percent}} of the base price", { percent: ofBase(price) }))}">${priceText(price)}</div>
    </div>`;
  });
  body.innerHTML = lines.join("");
  const avgPrice = view.all.length ? rn(priceSum / view.all.length, 2) : 0;
  ensureEl("marketsGoodCompareFooterStock").innerHTML = String(rn(totalStock, 2));
  ensureEl("marketsGoodCompareFooterPrice").innerHTML = priceText(avgPrice);
  renderEditorPagination(ensureEl("marketsGoodCompareFooter"), view, comparePricesTable.goto);
  Dialog.update(dialogId, { width: "fit-content", position: { ...position, of: activeAnchor } });
}

function togglePercentageMode(): void {
  const body = ensureEl("marketsGoodCompareBody");
  body.dataset.type = body.dataset.type === "absolute" ? "percentage" : "absolute";
  comparePricesTable.refresh();
}

function downloadCsv(): void {
  const good = activeGoodId >= 0 ? Goods.get(activeGoodId) : undefined;
  const goodName = good?.name ?? "Unknown";
  const rows = pack.markets.map(market => {
    const goodData = good ? market.goods[good.i] : undefined;
    return [Markets.getName(market), rn(goodData?.stock ?? 0, 2), rn(goodData?.price ?? 0, 2)];
  });
  Csv.download(`Compare_Prices_${goodName}`, ["Market", `Stock (${goodName})`, `Price (${goodName})`], rows);
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
