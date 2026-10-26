import { Goods } from "@/model/economy/goods-generator";
import type { Deal } from "@/model/economy/markets-generator";
import { DEAL_KINDS, Markets } from "@/model/economy/markets-generator";
import { Icons } from "@/model/icons";
import type { Burg } from "@/model/political/burgs-generator";
import { formatPrice } from "@/model/units";
import { goodBadge } from "@/renderers/draw-goods";
import { Csv } from "@/services/io/csv";
import { Dialog } from "@/ui/dialog/dialog";

import { bindColumnSorting, sortDataByColumns } from "@/ui/dialog/sorting";
import { dialogState } from "@/ui/dialog/state";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/ui/dialog/table";
import { zoomTo } from "@/ui/map/zoom";
import { tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { rn } from "@/utils/number-utils";

let activeMarketId = 0;
type FilterState = { scope: "all" | "local" | "global" };
let filterState: FilterState;

const dialogId = "marketDeals" as const;
const position = { my: "right top", at: "right bottom+10", of: "#marketOverview" };
const columns: EditorColumn<Deal>[] = [
  { key: "icon", width: "2em", permanent: true },
  {
    key: "good",
    label: t("Good"),
    width: "6.8em",
    permanent: true,
    sortBy: ([, , goodId]) => Goods.get(goodId)?.name ?? "",
    sortType: "alpha"
  },
  {
    key: "direction",
    label: t("Type"),
    width: "5em",
    sortBy: deal => getDirection(deal),
    sortType: "alpha"
  },
  {
    key: "counterparty",
    label: t("Counterparty"),
    width: "8em",
    sortBy: deal => getParty(deal)?.name ?? "",
    sortType: "alpha"
  },
  {
    key: "units",
    label: t("Units"),
    width: "5em",
    sortBy: ([, , , , units]) => units
  },
  {
    key: "carriage",
    label: t("Carriage"),
    width: "5em",
    sortBy: ([, , , , , , , , carriage]) => carriage
  },
  {
    key: "income",
    label: t("Income"),
    width: "5em",
    permanent: true,
    sortBy: deal => getDealNet(deal)
  }
];

const marketDealsTable = initEditorTable<Deal>({
  getData: getFilteredMarketDeals,
  onUpdate: renderMarketDealsPage
});

function open(marketId: number): void {
  void Icons.retry("goods");
  const market = Markets.get(marketId);
  if (!market) {
    tip(sentences(t("Invalid market"), t("The selected market does not exist")), true, "error", 5000);
    return;
  }

  filterState = dialogState.get(dialogId, "filters", (): FilterState => ({ scope: "all" }));
  if (!(["all", "local", "global"] as string[]).includes(filterState.scope)) filterState.scope = "all";
  dialogState.set(dialogId, "filters", filterState);
  activeMarketId = marketId;

  renderDialog();
  ensureEl<HTMLSelectElement>("marketDealsFilter").value = filterState.scope;
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
      <div>
        ${renderEditorHeader({ dialogId, columns })}
        <div id="marketDealsBody" class="table" style="max-height:30em"></div>

        <div id="marketDealsFooter" class="totalLine">
          <div style="margin-left: 5px" data-tip="${t("Deals count")}">${t("Deals")}: <span id="marketDealsFooterDeals">0</span></div>
          <div data-col="income" style="margin-left: 12px" data-tip="${t("Net flow for this market")}">${t("Net Flow")}: <span id="marketDealsFooterNet">🟡 0</span></div>
        </div>

        <div id="marketDealsBottom">
          <button id="marketDealsRefresh" data-tip="${t("Refresh")}" class="icon-cw"></button>
          <button id="marketDealsExport" data-tip="${t("Save data as a CSV file")}" class="icon-download"></button>
          <select id="marketDealsFilter" data-tip="${t("Filter deals by scope")}" style="margin-left: 8px">
            <option value="all">${t("All")}</option>
            <option value="local">${t("Local")}</option>
            <option value="global">${t("Global")}</option>
          </select>
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
  ensureEl("marketDealsExport").addEventListener("click", downloadDealsCsv);
  ensureEl("marketDealsBody").addEventListener("click", ev => {
    const el = ev.target as HTMLElement;
    const dealId = el.closest<HTMLElement>(".marketDealParty")?.closest<HTMLElement>(".marketDeal")?.dataset.id;
    const deal = pack.deals[Number(dealId)];
    if (!deal) return;

    const party = getParty(deal);
    if (party) zoomTo(party.x, party.y, 8, 2000);
  });
  ensureEl("marketDealsFilter").addEventListener("change", ev => {
    filterState.scope = (ev.target as HTMLSelectElement).value as typeof filterState.scope;
    dialogState.set(dialogId, "filters", filterState);
    marketDealsTable.reset();
  });
}

function closeMarketDeals(): void {
  Dialog.destroy(dialogId);
}

function getFilteredMarketDeals(): Deal[] {
  const market = Markets.get(activeMarketId);
  if (!market) {
    tip(sentences(t("Invalid market"), t("The selected market does not exist")), true, "error", 5000);
    return [];
  }

  const allDeals = getMarketDeals(pack.deals, activeMarketId);
  const deals = allDeals.filter(
    deal => filterState.scope === "all" || Markets.isImport(deal) === (filterState.scope === "global")
  );

  return sortDataByColumns(dialogId, deals, columns);
}

function renderMarketDealsPage(view: TableView<Deal>): void {
  const lines = view.rows.map(renderDealLine).join("");
  const netFlow = view.all.reduce((total, deal) => total + getDealNet(deal), 0);

  ensureEl("marketDealsBody").innerHTML = lines || t("No market deals recorded");
  ensureEl("marketDealsFooterDeals").innerHTML = String(view.all.length);
  ensureEl("marketDealsFooterNet").innerHTML = formatPrice(netFlow);
  renderEditorPagination(ensureEl("marketDealsFooter"), view, marketDealsTable.goto);
  Dialog.update(dialogId, { width: "fit-content", position });
}

export function getMarketDeals(deals: readonly Deal[], marketId: number): Deal[] {
  return deals.filter(([, dealMarket]) => dealMarket === marketId);
}

/** From the market's side: a burg's sale comes in, its purchase goes out */
export function getDirection([, , , kind]: Deal): "in" | "out" {
  return kind === DEAL_KINDS.sale ? "in" : "out";
}

function renderDealLine(deal: Deal): string {
  const [, , goodId, , units, , , , carriage] = deal;
  const good = Goods.get(goodId);
  if (!good) return "";

  const dealNet = getDealNet(deal);
  const party = getParty(deal);
  const direction = getDirection(deal);
  const scope = Markets.isImport(deal) ? "global" : "local";
  const incomeColor = dealNet >= 0 ? "#2a6" : "#c44";
  const backColor = dealNet >= 0 ? "#dff0d8" : "#f2dede";

  return /* html */ `<div class="states marketDeal" data-id="${pack.deals.indexOf(deal)}" data-good="${good.name}" data-direction="${direction}" data-units="${rn(units, 2)}" data-counterparty="${scope}_${party?.name}" data-income="${dealNet}">
      <svg data-col="icon" data-tip="${t("Good icon")}" width="1.3em" height="1.3em" class="goodIcon">
        ${goodBadge(good)}
      </svg>
      <div data-col="good" data-tip="${t("Name")}" class="goodName">${good.name}</div>
      <div data-col="direction"><span class="marketBadge" style="background:${backColor}; color:${incomeColor}">${direction.toUpperCase()}</span></div>
      <div data-col="counterparty" class="marketDealParty pointer" data-tip="${t("Click to zoom")}">
        <div class="${scope === "local" ? "icon-dot-circled" : "icon-store"}" style="display:inline-block; width: 0.8em; ${scope === "global" ? "font-size: 0.85em;" : ""}"></div>
        <div style="display:inline-block; width: 6.8em;">${party?.name}</div>
      </div>
      <div data-col="units" class="marketDealUnits">${rn(units, 2)}</div>
      <div data-col="carriage">${formatPrice(carriage)}</div>
      <div data-col="income" class="marketDealIncome" style="color:${incomeColor}">${formatPrice(dealNet)}</div>
    </div>`;
}

function getParty([burgId]: Deal): Burg | null {
  return pack.burgs[burgId] || null;
}

/** The market's income from the deal: what the burg paid, or minus what the market paid the burg */
export function getDealNet(deal: Deal): number {
  const [, , , , units, price] = deal;
  const value = rn(units * price, 2);
  return getDirection(deal) === "out" ? value : -value;
}

function downloadDealsCsv(): void {
  const market = Markets.get(activeMarketId);
  if (!market) return;

  const rows = getMarketDeals(pack.deals, activeMarketId).flatMap(deal => {
    const [, , goodId, , units, price, , , carriage] = deal;
    const good = Goods.get(goodId);
    if (!good) return [];
    return [
      [
        pack.deals.indexOf(deal),
        good.name,
        getDirection(deal),
        getParty(deal)?.name ?? "",
        rn(units, 2),
        rn(price, 2),
        carriage,
        rn(getDealNet(deal), 2)
      ]
    ];
  });
  Csv.download(
    `Market_${activeMarketId}_Deals`,
    ["Id", "Good", "Type", "Client", "Units", "Price", "Carriage", "Net"],
    rows
  );
}

export const MarketDealsOverview = { open };
