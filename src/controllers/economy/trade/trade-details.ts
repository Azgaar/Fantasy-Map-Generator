import { Goods } from "@/model/economy/goods-generator";
import type { Deal } from "@/model/economy/markets-generator";
import { DEAL_KINDS, Markets } from "@/model/economy/markets-generator";
import type { Point } from "@/model/graph/voronoi";
import { Icons } from "@/model/icons";
import { formatPrice } from "@/model/units";
import { goodBadge } from "@/renderers/draw-goods";
import { clearHighlight, highlight } from "@/renderers/draw-trade-animation";
import { TradeAnimation } from "@/renderers/trade-animation";
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
import { zoomTo } from "@/ui/map/zoom";
import { sentences, t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { rn } from "@/utils/number-utils";
import { tone, toneStyle } from "../economy-config";
import { bindEconomyWiki, economyWikiButton } from "../economy-wiki";
import { carriageDistance, money, splitDealPrice, tariffCell, tradeCellTips, tradeColumnTips } from "./deal-price";

/** A burg's trades with one market in one direction: it sells to its market, or buys from a market */
type Flow = { deals: Deal[]; burgId: number; marketId: number; isSale: boolean };
let activeFlow: Flow | null = null;
let activePoints: Point[] = [];

const dialogId = "tradeDetails" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg" };

type TradeDetailRow = {
  goodId: number;
  good: string;
  units: number;
  price: number; // per unit, as carriage, tax and tariff: the goods' own price
  carriage: number;
  tax: number;
  tariff: number;
  income: number; // to the burg: positive on a sale, negative on a purchase
  formula: string;
};
const tips = tradeColumnTips();
const columns: EditorColumn<TradeDetailRow>[] = [
  { key: "icon", width: "2.5em", permanent: true },
  { key: "good", label: t("Good"), width: "9em", permanent: true, sortBy: item => item.good, sortType: "alpha" },
  {
    key: "units",
    label: t("Units"),
    tip: sentences(tips.units, t("Click to sort by {{column}}", { column: t("Units") })),
    width: "5em",
    sortBy: item => item.units
  },
  {
    key: "net",
    label: t("Net"),
    tip: sentences(tips.net, t("Click to sort by {{column}}", { column: t("Net") })),
    width: "5em",
    sortBy: item => item.price
  },
  {
    key: "carriage",
    label: t("Carriage"),
    tip: sentences(tips.carriage, t("Click to sort by {{column}}", { column: t("Carriage") })),
    width: "5em",
    sortBy: item => item.carriage
  },
  {
    key: "tax",
    label: t("Tax"),
    tip: sentences(tips.tax, t("Click to sort by {{column}}", { column: t("Tax") })),
    width: "5em",
    sortBy: item => item.tax
  },
  {
    key: "tariff",
    label: t("Tariff"),
    tip: sentences(tips.tariff, t("Click to sort by {{column}}", { column: t("Tariff") })),
    width: "5em",
    sortBy: item => item.tariff
  },
  {
    key: "income",
    label: t("Income"),
    tip: sentences(tips.income, t("Click to sort by {{column}}", { column: t("Income") })),
    width: "5em",
    sortBy: item => Math.abs(item.income),
    defaultSort: "desc"
  },
  { key: "actions", width: "1.4em", permanent: true, hidden: true }
];

const tradeDetailsTable = initEditorTable<TradeDetailRow>({
  getData: getTradeDetails,
  onUpdate: renderTradeDetailsPage
});

/** Opens the goods the deal's burg trades with the deal's market in the deal's direction */
function open(deal: Deal): void {
  void Icons.retry("goods");
  const ends = deal && TradeAnimation.getEnds(deal);
  if (!ends) return;

  const [burgId, marketId, , kind] = deal;
  const burg = pack.burgs[burgId];
  const market = Markets.get(marketId);
  if (!burg || !market) return;

  const isSale = kind === DEAL_KINDS.sale;
  const isOrder = kind === DEAL_KINDS.order; // the state's, apart from the burg's own purchases
  const deals = pack.deals.filter(
    ([b, m, , k]) =>
      b === burgId &&
      m === marketId &&
      k !== DEAL_KINDS.kept &&
      (k === DEAL_KINDS.sale) === isSale &&
      (k === DEAL_KINDS.order) === isOrder
  );
  activeFlow = { deals, burgId, marketId, isSale };

  const path = TradeAnimation.findRoutePath(pack.burgs[ends.startBurgId].cell, pack.burgs[ends.endBurgId].cell);
  if (!path) return;
  activePoints = path.points;

  renderDialog();
  tradeDetailsTable.reset();
  highlight(path.points);

  const names = { burg: burg.name, market: Markets.getName(market), state: pack.states[burg.state || 0]?.name };
  Dialog.open(dialogId, {
    title: isOrder
      ? t("State order: {{- state}} buys from {{- market}} for {{- burg}}", names)
      : isSale
        ? t("Trade: {{- burg}} sells to {{- market}}", names)
        : !Markets.isImport(deal)
          ? t("Trade: {{- burg}} buys from {{- market}}", names)
          : t("Trade: {{- burg}} imports from {{- market}}", names),
    position,
    onClose: closeTradeDetails
  });
}

function renderDialog(): void {
  Dialog.destroy(dialogId);
  const editorHtml = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
      <style>
        ${toneStyle(`#${dialogId}`)}
      </style>
      <div>
        <div id="tradeDetailsSummary" class="totalLine"></div>
        ${renderEditorHeader({ dialogId, columns })}
        <div id="tradeDetailsBody" class="table" style="max-height:30em"></div>
        <div id="tradeDetailsFooter" class="totalLine">
          <div style="margin-left: 5px">${t("Distance")}: <span id="tradeDetailsFooterDistance">0</span></div>
          <div data-col="units" style="margin-left: 12px" data-tip="${t("Total traded units")}">${t("Units")}: <span id="tradeDetailsFooterUnits">0</span></div>
          <div data-col="income" style="margin-left: 12px" data-tip="${tips.income}">${t("Income")}: <span id="tradeDetailsFooterIncome">0</span></div>
        </div>
        <div id="tradeDetailsBottom">${economyWikiButton("tradeDetailsWiki")}</div>
      </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  bindEconomyWiki("tradeDetailsWiki");
  bindColumnSorting(dialogId, tradeDetailsTable.reset);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => Dialog.update(dialogId, { width: "fit-content", position })
  });

  ensureEl("tradeDetailsSummary").addEventListener("click", event => {
    const zoomEl = (event.target as HTMLElement).closest<HTMLElement>("[data-zoom]");
    if (!activeFlow || !zoomEl) return;
    const { burgId, marketId } = activeFlow;
    const burg = pack.burgs[zoomEl.dataset.zoom === "burg" ? burgId : (Markets.get(marketId)?.centerBurgId ?? 0)];
    if (burg?.i) zoomTo(burg.x, burg.y, 8, 1500);
  });
}

function getTradeDetails(): TradeDetailRow[] {
  if (!activeFlow) return [];

  const combined = new Map<number, { units: number; paid: number; tax: number; tariff: number; carriage: number }>();
  for (const [, , goodId, , units, price, tax, tariff, carriage] of activeFlow.deals) {
    const entry = combined.get(goodId) ?? { units: 0, paid: 0, tax: 0, tariff: 0, carriage: 0 };
    entry.units += units;
    entry.paid += units * price;
    entry.tax += tax;
    entry.tariff += tariff;
    entry.carriage += carriage * units;
    combined.set(goodId, entry);
  }

  const { isSale } = activeFlow;
  const rows = Array.from(combined, ([goodId, { units, paid, tax, tariff, carriage }]) => {
    const good = Goods.get(goodId);
    if (!good) return null;
    const perUnit = (total: number) => (units ? total / units : 0);
    const split = splitDealPrice({ units, price: perUnit(paid), tax, tariff, carriage: perUnit(carriage) }, isSale);
    return {
      goodId,
      good: good.name,
      units,
      price: split.goodsPrice,
      carriage: split.carriage,
      tax: split.tax,
      tariff: split.tariff,
      income: isSale ? split.value : -split.value,
      formula: split.formula
    };
  }).filter((row): row is TradeDetailRow => row !== null);
  return sortDataByColumns(dialogId, rows, columns);
}

function renderTradeDetailsPage(view: TableView<TradeDetailRow>): void {
  if (!activeFlow) return;

  const { burgId, marketId, isSale, deals } = activeFlow;
  const burg = pack.burgs[burgId];
  const market = Markets.get(marketId);
  const isImport = Markets.isImport(deals[0]);
  const decimas = market && burg ? Markets.getDecimas(market, burg) : 0;
  const carriageFactor = market && burg ? Markets.getCarriageFactor(market, burg) : 1;
  const zoom = (target: string) =>
    `<span class="icon-dot-circled pointer" data-zoom="${target}" data-tip="${t("Click to zoom")}"></span>`;
  ensureEl("tradeDetailsSummary").innerHTML = /* html */ `
    <span><b>${t("Burg")}</b>: ${burg?.name} ${zoom("burg")}</span>
    <span style="margin-left:5px" data-tip="${carriageDistance(decimas)}"><b>${isSale ? t("Sells to market") : isImport ? t("Imports from market") : t("Buys from market")}</b>: ${market ? Markets.getName(market) : ""} ${zoom("market")}</span>`;

  const { taxState: taxStateId, tariffState: tariffStateId } = Markets.getTaxStates(deals[0]);
  const html = view.rows.map(({ goodId, units, price, carriage, tax, tariff, income, formula }) => {
    const good = Goods.get(goodId)!;
    const cellTips = tradeCellTips({
      good,
      units,
      net: price,
      carriage,
      tax,
      tariff,
      decimas,
      carriageFactor,
      isImport,
      taxStateId,
      tariffStateId,
      formula
    });
    return /* html */ `<div class="states tradeDeal" data-good="${good.name}" data-units="${rn(units, 2)}" data-income="${rn(income, 2)}">
    <svg data-col="icon" data-tip="${t("Good icon")}" width="2em" height="2em" class="goodIcon">
      ${goodBadge(good)}
    </svg>
    <div data-col="good" data-tip="${t("Name")}" class="goodName">${good.name}</div>
    <div data-col="units" data-tip="${cellTips.units}">${rn(units, 2)}</div>
    <div data-col="net" data-tip="${cellTips.net}">${money(price, isSale)}</div>
    <div data-col="carriage" data-tip="${cellTips.carriage}">${money(carriage, false)}</div>
    <div data-col="tax" data-tip="${cellTips.tax}">${money(tax, false)}</div>
    <div data-col="tariff" data-tip="${cellTips.tariff}">${tariffCell(tariff, isImport)}</div>
    <div data-col="income" class="${tone(income)}" data-tip="${cellTips.income}">${formatPrice(rn(income, 2))}</div>
  </div>`;
  });

  const length = activePoints.reduce((sum, p, i) => {
    if (i === 0) return 0;
    const prev = activePoints[i - 1];
    return sum + Math.hypot(p[0] - prev[0], p[1] - prev[1]);
  }, 0);
  const totalUnits = view.all.reduce((total, row) => total + row.units, 0);
  const totalIncome = view.all.reduce((total, row) => total + row.income, 0);

  ensureEl("tradeDetailsBody").innerHTML = html.join("");
  ensureEl("tradeDetailsFooterDistance").innerHTML =
    `${rn(length * options.map.units.distance.scale)} ${options.map.units.distance.unit}`;
  ensureEl("tradeDetailsFooterUnits").innerHTML = String(rn(totalUnits, 2));
  ensureEl("tradeDetailsFooterIncome").innerHTML =
    `<span class="${tone(totalIncome)}">${formatPrice(rn(totalIncome, 2))}</span>`;

  renderEditorPagination(ensureEl("tradeDetailsFooter"), view, tradeDetailsTable.goto);
  Dialog.update(dialogId, { width: "fit-content", position });
}

function closeTradeDetails(): void {
  clearHighlight();
  activeFlow = null;
  activePoints = [];
  Dialog.destroy(dialogId);
}

export const TradeDetails = { open };
