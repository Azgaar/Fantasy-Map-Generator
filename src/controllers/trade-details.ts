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
import type { Burg } from "../generators/burgs-generator";
import type { Deal } from "../generators/markets-generator";
import type { Point } from "../generators/voronoi";
import { clearHighlight, highlight } from "../renderers/draw-trade-animation";
import type { TradeBatch } from "../renderers/trade-animation";
import { ensureEl, formatPrice, rn } from "../utils";

let activeBatch: TradeBatch;
let activePoints: Point[] = [];
const dialogId = "tradeDetails" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
type TradeDetailRow = { goodId: number; good: string; units: number; price: number; value: number };
const columns: EditorColumn<TradeDetailRow>[] = [
  { key: "icon", width: "2.5em", permanent: true },
  {
    key: "good",
    label: "Good",
    width: "10em",
    permanent: true,
    sortBy: item => item.good,
    sortType: "alpha"
  },
  {
    key: "units",
    label: "Units",
    width: "5em",
    sortBy: item => item.units,
    defaultSort: "desc"
  },
  {
    key: "price",
    label: "Price",
    width: "5.5em",
    sortBy: item => item.price
  },
  {
    key: "value",
    label: "Value",
    width: "3.6em",
    sortBy: item => item.value
  },
  { key: "actions", width: "1.2em", permanent: true }
];

const tradeDetailsTable = initEditorTable<TradeDetailRow>({
  getData: getTradeDetails,
  onUpdate: renderTradeDetailsPage
});

function open(batch: TradeBatch): void {
  if (!batch?.deals.length) return;

  activeBatch = batch;

  const startBurg = pack.burgs[batch.startBurgId];
  const endBurg = pack.burgs[batch.endBurgId];
  if (!startBurg || !endBurg) return;
  const path = TradeAnimation.findRoutePath(startBurg.cell, endBurg.cell);
  if (!path) return;
  activePoints = path.points;

  renderDialog();
  tradeDetailsTable.reset();
  highlight(path.points);

  $(`#${dialogId}`).dialog({
    title: `Trade: ${pack.burgs[batch.startBurgId]?.name} to ${pack.burgs[batch.endBurgId]?.name}`,
    resizable: false,
    position,
    close: closeTradeDetails
  });
}

function renderDialog(): void {
  document.getElementById(dialogId)?.remove();
  const editorHtml = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
      <div>
        <div id="tradeDetailsSummary" class="totalLine"></div>
        ${renderEditorHeader({ dialogId, columns })}
        <div id="tradeDetailsBody" class="table" style="max-height:30em"></div>
        <div id="tradeDetailsFooter" class="totalLine">
          <div style="margin-left: 5px">Distance: <span id="tradeDetailsFooterDistance">0</span></div>
          <div data-col="units" style="margin-left: 12px" data-tip="Total traded units">Units: <span id="tradeDetailsFooterUnits">0</span></div>
          <div data-col="value" style="margin-left: 12px" data-tip="Total deal value">Value: <span id="tradeDetailsFooterValue">0</span></div>
        </div>
      </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  bindColumnSorting(dialogId, tradeDetailsTable.reset);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });

  ensureEl("tradeDetailsSummary").addEventListener("click", event => {
    const zoomEl = (event.target as HTMLElement).closest<HTMLElement>("[data-zoom]");
    if (!activeBatch || !zoomEl) return;
    const burgId = activeBatch[zoomEl.dataset.zoom === "start" ? "startBurgId" : "endBurgId"];
    const burg = pack.burgs[burgId];
    if (!burg) return;
    zoomTo(burg.x, burg.y, 8, 1500);
  });
}

function getTradeDetails(): TradeDetailRow[] {
  if (!activeBatch) return [];

  const combined = new Map<number, { units: number; value: number }>();
  for (const deal of activeBatch.deals) {
    const entry = combined.get(deal.good) ?? { units: 0, value: 0 };
    entry.units += deal.units;
    entry.value += deal.units * deal.price;
    combined.set(deal.good, entry);
  }

  const rows = Array.from(combined, ([goodId, { units, value }]) => {
    const good = Goods.get(goodId);
    return good ? { goodId, good: good.name, units, price: units ? value / units : 0, value } : null;
  }).filter((row): row is TradeDetailRow => row !== null);
  return sortDataByColumns(dialogId, rows, columns);
}

function renderTradeDetailsPage(view: TableView<TradeDetailRow>): void {
  if (!activeBatch) return;

  const from = pack.burgs[activeBatch.startBurgId];
  const to = pack.burgs[activeBatch.endBurgId];
  const fromType = getClientType(activeBatch.deals[0], from, "from");
  const toType = getClientType(activeBatch.deals[0], to, "to");

  ensureEl("tradeDetailsSummary").innerHTML = /* html */ `
    <span><b>Seller</b>: ${from?.name} ${fromType} <span class="icon-dot-circled pointer" data-zoom="start" data-tip="Zoom to start"></span></span>
    <span style="margin-left:5px"><b>Buyer</b>: ${to?.name} ${toType} <span class="icon-dot-circled pointer" data-zoom="end" data-tip="Zoom to end"></span></span>`;

  const totalUnits = view.all.reduce((total, row) => total + row.units, 0);
  const totalValue = view.all.reduce((total, row) => total + row.value, 0);

  const html = view.rows.map(({ goodId, units, price, value }) => {
    const good = Goods.get(goodId)!;

    return /* html */ `<div class="states tradeDeal" data-good="${good.name}" data-units="${rn(units, 2)}" data-price="${price}" data-value="${rn(value, 2)}">
    <svg data-col="icon" data-tip="Good icon" width="2em" height="2em" class="goodIcon">
      <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${Goods.getStroke(good.color)}"/>
      <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"></use>
    </svg>
    <div data-col="good" data-tip="Good name" class="goodName">${good.name}</div>
    <div data-col="units" class="goodUnits">${rn(units, 2)}</div>
    <div data-col="price" class="goodPrice">${formatPrice(rn(price, 2))}</div>
    <div data-col="value" class="goodValue">${formatPrice(rn(value, 2))}</div>
  </div>`;
  });

  const length = rn(
    activePoints.reduce((sum, p, i) => {
      if (i === 0) return 0;
      const prev = activePoints[i - 1];
      return sum + Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    }, 0),
    2
  );
  ensureEl("tradeDetailsBody").innerHTML = html.join("");
  ensureEl("tradeDetailsFooterDistance").innerHTML = `${rn(length * distanceScale)} ${distanceUnitInput.value}`;
  ensureEl("tradeDetailsFooterUnits").innerHTML = String(rn(totalUnits, 2));
  ensureEl("tradeDetailsFooterValue").innerHTML = formatPrice(totalValue);

  renderEditorPagination(ensureEl("tradeDetailsFooter"), view, tradeDetailsTable.goto);
  updateDialog(dialogId, { width: "fit-content", position });
}

function getClientType(deal: Deal, burg: Burg, direction: "from" | "to"): string {
  const type = direction === "from" ? deal.sellerType : deal.buyerType;
  if (type === "market") return "market";
  return burg.group || "burg";
}

function closeTradeDetails(): void {
  clearHighlight();
  $(`#${dialogId}`).dialog("destroy");
  ensureEl(dialogId).remove();
}

export const TradeDetails = { open };
