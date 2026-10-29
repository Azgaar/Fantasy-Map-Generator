import type { Good } from "@/model/economy/goods-generator";
import { Goods } from "@/model/economy/goods-generator";
import type { Deal } from "@/model/economy/markets-generator";
import { DEAL_KINDS, Markets } from "@/model/economy/markets-generator";
import { Icons } from "@/model/icons";
import { formatPrice } from "@/model/units";
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
import {
  bindEconomyWiki,
  economyWikiButton,
  getTradeContext,
  money,
  splitDealPrice,
  tariffCell,
  tone,
  tradeCellTips,
  tradeColumnTips
} from "@/ui/economy-view";
import { zoomTo } from "@/ui/map/zoom";
import { tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { rn } from "@/utils/number-utils";

let activeMarketId = 0;

const dialogId = "marketDeals" as const;
const position = { my: "right top", at: "right bottom+10", of: "#marketOverview" };

/** A deal from the market's side: it buys what a burg sells and sells what a burg buys */
type MarketDealRow = {
  deal: Deal;
  good: Good;
  side: "buy" | "sell";
  burg: string;
  units: number;
  net: number; // per unit, as carriage, tax and tariff: the goods' own price
  carriage: number;
  tax: number;
  tariff: number;
  income: number; // to the market: positive when it sells, negative when it buys
  formula: string;
};

const tips = tradeColumnTips();
const marketIncomeTip = sentences(t("Market income"), t("Positive when the market sells, negative when it buys"));
const columns: EditorColumn<MarketDealRow>[] = [
  { key: "icon", width: "2em", permanent: true },
  { key: "good", label: t("Good"), width: "6.8em", permanent: true, sortBy: row => row.good.name, sortType: "alpha" },
  {
    key: "side",
    label: t("Type"),
    tip: sentences(t("Whether the market buys or sells"), t("Click to sort by {{column}}", { column: t("Type") })),
    width: "4em",
    sortType: "alpha",
    sortBy: row => row.side
  },
  {
    key: "burg",
    label: t("Burg"),
    tip: sentences(t("The burg the market trades with"), t("Click to sort by {{column}}", { column: t("Burg") })),
    width: "7em",
    sortType: "alpha",
    sortBy: row => row.burg
  },
  {
    key: "units",
    label: t("Units"),
    tip: sentences(tips.units, t("Click to sort by {{column}}", { column: t("Units") })),
    width: "5em",
    sortBy: row => row.units
  },
  {
    key: "net",
    label: t("Net"),
    tip: sentences(tips.net, t("Click to sort by {{column}}", { column: t("Net") })),
    width: "5em",
    sortBy: row => row.net
  },
  {
    key: "carriage",
    label: t("Carriage"),
    tip: sentences(tips.carriage, t("Click to sort by {{column}}", { column: t("Carriage") })),
    width: "5em",
    sortBy: row => row.carriage
  },
  {
    key: "tax",
    label: t("Tax"),
    tip: sentences(tips.tax, t("Click to sort by {{column}}", { column: t("Tax") })),
    width: "5em",
    sortBy: row => row.tax
  },
  {
    key: "tariff",
    label: t("Tariff"),
    tip: sentences(tips.tariff, t("Click to sort by {{column}}", { column: t("Tariff") })),
    width: "5em",
    sortBy: row => row.tariff
  },
  {
    key: "income",
    label: t("Income"),
    tip: sentences(marketIncomeTip, t("Click to sort by {{column}}", { column: t("Income") })),
    width: "6em",
    sortBy: row => row.income
  },
  { key: "actions", width: "1.4em", permanent: true, hidden: true }
];

const marketDealsTable = initEditorTable<MarketDealRow>({
  getData: getMarketDealRows,
  onUpdate: renderMarketDealsPage
});

function open(marketId: number): void {
  void Icons.retry("goods");
  const market = Markets.get(marketId);
  if (!market) {
    tip(sentences(t("Invalid market"), t("The selected market does not exist")), true, "error", 5000);
    return;
  }

  activeMarketId = marketId;
  renderDialog();
  marketDealsTable.reset();

  Dialog.open(dialogId, {
    title: t("{{- market}} Market Deals", { market: Markets.getName(market) }),
    position,
    onClose: closeMarketDeals
  });
}

function renderDialog(): void {
  Dialog.destroy(dialogId);
  const editorHtml = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
      <style>
        #${dialogId} .marketBadge { display: inline-block; border-radius: 3px; padding: 0 0.4em; font-size: 0.8em; font-weight: bold; line-height: 1.35 }
      </style>
      <div>
        ${renderEditorHeader({ dialogId, columns })}
        <div id="marketDealsBody" class="table" style="max-height:30em"></div>
        <div id="marketDealsFooter" class="totalLine"></div>
        <div id="marketDealsBottom">
          <button id="marketDealsRefresh" data-tip="${t("Refresh")}" class="icon-cw"></button>
          <button id="marketDealsExport" data-tip="${t("Save data as a CSV file")}" class="icon-download"></button>
          ${economyWikiButton("marketDealsWiki")}
        </div>
      </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  bindColumnSorting(dialogId, marketDealsTable.reset);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => Dialog.update(dialogId, { width: "fit-content", position })
  });

  ensureEl("marketDealsRefresh").addEventListener("click", marketDealsTable.refresh);
  bindEconomyWiki("marketDealsWiki");
  ensureEl("marketDealsExport").addEventListener("click", downloadDealsCsv);
  ensureEl("marketDealsBody").addEventListener("click", event => {
    const line = (event.target as HTMLElement)
      .closest<HTMLElement>(".marketDealBurg")
      ?.closest<HTMLElement>(".marketDeal");
    const burg = pack.burgs[pack.deals[Number(line?.dataset.id)]?.[0] ?? 0];
    if (burg?.i) zoomTo(burg.x, burg.y, 8, 2000);
  });
}

function closeMarketDeals(): void {
  Dialog.destroy(dialogId);
}

function getMarketDealRows(): MarketDealRow[] {
  if (!Markets.get(activeMarketId)) {
    tip(sentences(t("Invalid market"), t("The selected market does not exist")), true, "error", 5000);
    return [];
  }
  const rows = getMarketDeals(pack.deals, activeMarketId).flatMap(deal => getMarketDealRow(deal) ?? []);
  return sortDataByColumns(dialogId, rows, columns);
}

/** The market's trades with burgs; goods a burg kept never changed hands */
export function getMarketDeals(deals: readonly Deal[], marketId: number): Deal[] {
  return deals.filter(([, dealMarket, , kind]) => dealMarket === marketId && kind !== DEAL_KINDS.kept);
}

/** The market buys what a burg sells and sells what a burg buys */
export function getMarketSide([, , , kind]: Deal): "buy" | "sell" {
  return kind === DEAL_KINDS.sale ? "buy" : "sell";
}

/** The market's income from the deal: what the burg paid less the taxes passed on, or minus what it paid the burg */
export function getDealNet(deal: Deal): number {
  return rn(Markets.getMarketIncome(deal), 2);
}

function getMarketDealRow(deal: Deal): MarketDealRow | null {
  const [burgId, , goodId, , units, price, tax, tariff, carriage] = deal;
  const good = Goods.get(goodId);
  if (!good) return null;

  const side = getMarketSide(deal);
  const split = splitDealPrice({ units, price, tax, tariff, carriage }, side === "buy");
  const income = getDealNet(deal);
  return {
    deal,
    good,
    side,
    burg: pack.burgs[burgId]?.name ?? "",
    units,
    net: split.goodsPrice,
    carriage: split.carriage,
    tax: split.tax,
    tariff: split.tariff,
    income,
    formula: getIncomeFormula(deal, income)
  };
}

/** price × units, less the sales tax and tariff a sale passes to the states and the center burg's margin: what the market keeps */
function getIncomeFormula(deal: Deal, income: number): string {
  const [, , , kind, units, price, tax, tariff] = deal;
  const margin = Markets.getMargin(deal);
  const marginTerm = margin ? ` − ${t("Market margin")} ${formatPrice(rn(margin, 2))}` : "";
  const paid = `${formatPrice(price)} × ${rn(units, 2)}`;
  if (kind === DEAL_KINDS.sale) return `−${paid}${marginTerm} = ${formatPrice(income)}`;
  const passed = [
    tax ? ` − ${t("Sales Tax")} ${formatPrice(rn(tax, 2))}` : "",
    tariff ? ` − ${t("Tariff")} ${formatPrice(rn(tariff, 2))}` : ""
  ].join("");
  return `${paid}${passed}${marginTerm} = ${formatPrice(income)}`;
}

function renderMarketDealsPage(view: TableView<MarketDealRow>): void {
  ensureEl("marketDealsBody").innerHTML = view.rows.map(renderDealLine).join("") || t("No market deals recorded");
  renderTotals(view.all);
  renderEditorPagination(ensureEl("marketDealsFooter"), view, marketDealsTable.goto);
  Dialog.update(dialogId, { width: "fit-content", position });
}

function renderDealLine(row: MarketDealRow): string {
  const { deal, good, side, burg, units, net, carriage, tax, tariff, income, formula } = row;
  const context = getTradeContext(deal[0], deal[1], deal[2], deal[3]);
  const { isImport } = context;
  const cellTips = tradeCellTips({ good, units, net, carriage, tax, tariff, formula, ...context });
  const isSale = side === "sell";
  const isOrder = deal[3] === DEAL_KINDS.order;
  const sideTip = isOrder
    ? t("The market sells the goods to the state, delivered to the burg")
    : isSale
      ? t("The market sells the goods to the burg")
      : t("The market buys the goods from the burg");
  const badge = isOrder ? t("State") : isSale ? t("Sell") : t("Buy");

  return /* html */ `<div class="states marketDeal" data-id="${pack.deals.indexOf(deal)}" data-good="${good.name}" data-side="${side}" data-burg="${burg}" data-units="${rn(units, 2)}" data-income="${rn(income, 2)}">
      <svg data-col="icon" data-tip="${t("Good icon")}" width="1.3em" height="1.3em" class="goodIcon">
        ${goodBadge(good)}
      </svg>
      <div data-col="good" data-tip="${t("Name")}" class="goodName">${good.name}</div>
      <div data-col="side" data-tip="${sideTip}"><span class="marketBadge ${isSale ? "positive" : "negative"}">${badge.toUpperCase()}</span></div>
      <div data-col="burg" class="marketDealBurg pointer" data-tip="${t("Click to zoom")}">${burg}</div>
      <div data-col="units" data-tip="${cellTips.units}">${rn(units, 2)}</div>
      <div data-col="net" data-tip="${cellTips.net}">${money(net, isSale)}</div>
      <div data-col="carriage" data-tip="${cellTips.carriage}">${money(carriage, false)}</div>
      <div data-col="tax" data-tip="${cellTips.tax}">${money(tax, false)}</div>
      <div data-col="tariff" data-tip="${cellTips.tariff}">${tariffCell(tariff, isImport)}</div>
      <div data-col="income" class="${tone(income)}" data-tip="${t("Market income")}: ${formula}">${formatPrice(rn(income, 2))}</div>
    </div>`;
}

/** Sums of the market's deals in money: what it paid and got, and the carriage and taxes inside */
function renderTotals(rows: MarketDealRow[]): void {
  const sum = (pick: (row: MarketDealRow) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const bought = -sum(row => (row.side === "buy" ? row.income : 0));
  const sold = sum(row => (row.side === "sell" ? row.income : 0));
  const income = sold - bought;
  const total = (label: string, tip: string, amount: string) =>
    `<div style="margin-left: 12px" data-tip="${tip}">${label}: ${amount}</div>`;

  ensureEl("marketDealsFooter").innerHTML = [
    total(t("Deals"), t("Deals count"), String(rows.length)),
    total(t("Bought"), t("Paid to burgs for the goods the market bought"), money(bought, false) || formatPrice(0)),
    total(t("Sold"), t("Market income, less taxes and tariffs"), money(sold, true) || formatPrice(0)),
    total(
      t("Carriage"),
      t("Carriage paid in all"),
      formatPrice(
        rn(
          sum(row => row.carriage * row.units),
          2
        )
      )
    ),
    total(
      t("Tax"),
      t("Sales tax paid in all"),
      formatPrice(
        rn(
          sum(row => row.tax * row.units),
          2
        )
      )
    ),
    total(
      t("Tariff"),
      t("Import tariffs paid in all"),
      formatPrice(
        rn(
          sum(row => row.tariff * row.units),
          2
        )
      )
    ),
    total(t("Income"), marketIncomeTip, `<span class="${tone(income)}">${formatPrice(rn(income, 2))}</span>`)
  ].join("");
}

function downloadDealsCsv(): void {
  if (!Markets.get(activeMarketId)) return;
  const perUnit = (amount: number) => (rn(amount, 2) ? rn(amount, 2) : "");
  const rows = getMarketDeals(pack.deals, activeMarketId).flatMap(deal => {
    const row = getMarketDealRow(deal);
    if (!row) return [];
    const { good, side, burg, units, net, carriage, tax, tariff, income } = row;
    const id = pack.deals.indexOf(deal);
    return [
      [
        id,
        good.name,
        side,
        burg,
        rn(units, 2),
        rn(net, 2),
        perUnit(carriage),
        perUnit(tax),
        perUnit(tariff),
        rn(income, 2)
      ]
    ];
  });
  Csv.download(
    `Market_${activeMarketId}_Deals`,
    ["Id", "Good", "Type", "Burg", "Units", "Net Unit Price", "Carriage", "Tax", "Tariff", "Income"],
    rows
  );
}

export const MarketDealsOverview = { open };
