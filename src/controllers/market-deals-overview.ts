import { updateDialog } from "@/components/dialog/dialog-helpers";
import { bindColumnSorting, sortDataByColumns } from "@/components/dialog/sorting";
import { dialogState } from "@/components/dialog/state";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/components/dialog/table";
import { tip } from "@/components/tooltips";
import { downloadFile, getFileName } from "@/utils";
import type { Burg } from "../generators/burgs-generator";
import type { Deal } from "../generators/markets-generator";
import { ensureEl, formatPrice, rn } from "../utils";

let activeMarketId = 0;
type FilterState = { scope: "all" | "local" | "global" };
let filterState: FilterState;

const dialogId = "marketDeals" as const;
const position = { my: "right top", at: "right bottom+10", of: "#marketOverview", collision: "fit" };
const columns: EditorColumn<Deal>[] = [
  { key: "icon", width: "2em", permanent: true },
  {
    key: "good",
    label: "Good",
    width: "6.8em",
    permanent: true,
    sortBy: deal => Goods.get(deal.good)?.name ?? "",
    sortType: "alpha"
  },
  {
    key: "direction",
    label: "Type",
    width: "5em",
    sortBy: deal => getDirection(deal, activeMarketId),
    sortType: "alpha"
  },
  {
    key: "counterparty",
    label: "Counterparty",
    width: "8em",
    sortBy: deal => getParty(deal)?.name ?? "",
    sortType: "alpha"
  },
  {
    key: "units",
    label: "Units",
    width: "5em",
    sortBy: deal => deal.units
  },
  {
    key: "income",
    label: "Income",
    width: "5em",
    sortBy: deal => getDealNet(deal, activeMarketId)
  },
  { key: "actions", width: "1.2em", permanent: true }
];

const marketDealsTable = initEditorTable<Deal>({
  getData: getFilteredMarketDeals,
  onUpdate: renderMarketDealsPage
});

function open(marketId: number): void {
  const market = Markets.get(marketId);
  if (!market) {
    tip("Invalid market. The selected market does not exist", true, "error", 5000);
    return;
  }

  filterState = dialogState.get(dialogId, "filters", (): FilterState => ({ scope: "all" }));
  if (!(["all", "local", "global"] as string[]).includes(filterState.scope)) filterState.scope = "all";
  dialogState.set(dialogId, "filters", filterState);
  activeMarketId = marketId;

  renderDialog();
  ensureEl<HTMLSelectElement>("marketDealsFilter").value = filterState.scope;
  marketDealsTable.reset();

  $(`#${dialogId}`).dialog({
    title: `${Markets.getName(market)} Market Deals`,
    position,
    close: closeMarketDeals
  });
}

function renderDialog(): void {
  document.getElementById(dialogId)?.remove();
  const editorHtml = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
      <div>
        ${renderEditorHeader({ dialogId, columns })}
        <div id="marketDealsBody" class="table" style="max-height:30em"></div>

        <div id="marketDealsFooter" class="totalLine">
          <div style="margin-left: 5px" data-tip="Deals count">Deals: <span id="marketDealsFooterDeals">0</span></div>
          <div data-col="income" style="margin-left: 12px" data-tip="Net flow for this market">Net Flow: <span id="marketDealsFooterNet">🟡 0</span></div>
        </div>

        <div id="marketDealsBottom">
          <button id="marketDealsRefresh" data-tip="Refresh the Deals screen" class="icon-cw"></button>
          <button id="marketDealsExport" data-tip="Save market deals data as a text file (.csv)" class="icon-download"></button>
          <select id="marketDealsFilter" data-tip="Filter deals by scope" style="margin-left: 8px">
            <option value="all">All</option>
            <option value="local">Local</option>
            <option value="global">Global</option>
          </select>
        </div>
      </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  bindColumnSorting(dialogId, marketDealsTable.reset);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });

  ensureEl("marketDealsRefresh").addEventListener("click", marketDealsTable.refresh);
  ensureEl("marketDealsExport").addEventListener("click", downloadDealsCsv);
  ensureEl("marketDealsBody").addEventListener("click", ev => {
    const el = ev.target as HTMLElement;
    const dealId = el.closest<HTMLElement>(".marketDealParty")?.closest<HTMLElement>(".marketDeal")?.dataset.id;
    const deal = pack.deals.find(d => d.i === Number(dealId));
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
  $(`#${dialogId}`).dialog("destroy");
  ensureEl(dialogId).remove();
}

function getFilteredMarketDeals(): Deal[] {
  const market = Markets.get(activeMarketId);
  if (!market) {
    tip("Invalid market. The selected market does not exist", true, "error", 5000);
    return [];
  }

  const allDeals = getMarketDeals(pack.deals, activeMarketId);
  const deals = allDeals.filter(deal => {
    if (filterState.scope === "all") return true;
    const counterparty = getCounterparty(deal, activeMarketId);
    return filterState.scope === "local" ? counterparty.type === "burg" : counterparty.type === "market";
  });

  return sortDataByColumns(dialogId, deals, columns);
}

function renderMarketDealsPage(view: TableView<Deal>): void {
  const lines = view.rows.map(renderDealLine).join("");
  const netFlow = view.all.reduce((total, deal) => total + getDealNet(deal, activeMarketId), 0);

  ensureEl("marketDealsBody").innerHTML = lines || "No market deals recorded";
  ensureEl("marketDealsFooterDeals").innerHTML = String(view.all.length);
  ensureEl("marketDealsFooterNet").innerHTML = formatPrice(netFlow);
  renderEditorPagination(ensureEl("marketDealsFooter"), view, marketDealsTable.goto);
  updateDialog(dialogId, { width: "fit-content", position });
}

export function getMarketDeals(deals: readonly Deal[], marketId: number): Deal[] {
  return deals.filter(
    deal =>
      (deal.sellerType === "market" && deal.seller === marketId) ||
      (deal.buyerType === "market" && deal.buyer === marketId)
  );
}

function isMarketSeller(deal: Deal, marketId: number): boolean {
  return deal.sellerType === "market" && deal.seller === marketId;
}

export function getDirection(deal: Deal, marketId: number): "in" | "out" {
  return isMarketSeller(deal, marketId) ? "out" : "in";
}

export function getCounterparty(deal: Deal, marketId: number): { id: number; type: "burg" | "market" } {
  return isMarketSeller(deal, marketId)
    ? { id: deal.buyer, type: deal.buyerType }
    : { id: deal.seller, type: deal.sellerType };
}

function renderDealLine(deal: Deal): string {
  const good = Goods.get(deal.good);
  if (!good) return "";

  const dealNet = getDealNet(deal, activeMarketId);
  const party = getParty(deal);
  const counterparty = getCounterparty(deal, activeMarketId);
  const direction = getDirection(deal, activeMarketId);
  const incomeColor = dealNet >= 0 ? "#2a6" : "#c44";
  const backColor = dealNet >= 0 ? "#dff0d8" : "#f2dede";

  return /* html */ `<div class="states marketDeal" data-id="${deal.i}" data-good="${good.name}" data-direction="${direction}" data-units="${rn(deal.units, 2)}" data-counterparty="${counterparty.type}_${party?.name}" data-income="${dealNet}">
      <svg data-col="icon" data-tip="Good icon" width="1.3em" height="1.3em" class="goodIcon">
        <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${Goods.getStroke(good.color)}"/>
        <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"/>
      </svg>
      <div data-col="good" data-tip="Good name" class="goodName">${good.name}</div>
      <div data-col="direction"><span class="marketBadge" style="background:${backColor}; color:${incomeColor}">${direction.toUpperCase()}</span></div>
      <div data-col="counterparty" class="marketDealParty pointer" data-tip="Click to zoom">
        <div class="${counterparty.type === "burg" ? "icon-dot-circled" : "icon-store"}" style="display:inline-block; width: 0.8em; ${counterparty.type === "market" ? "font-size: 0.85em;" : ""}"></div>
        <div style="display:inline-block; width: 6.8em;">${party?.name}</div>
      </div>
      <div data-col="units" class="marketDealUnits">${rn(deal.units, 2)}</div>
      <div data-col="income" class="marketDealIncome" style="color:${incomeColor}">${formatPrice(dealNet)}</div>
    </div>`;
}

function getParty(deal: Deal): Burg | null {
  const counterparty = getCounterparty(deal, activeMarketId);
  const burgId = counterparty.type === "burg" ? counterparty.id : Markets.get(counterparty.id)?.centerBurgId;
  if (!burgId) return null;
  return pack.burgs[burgId] || null;
}

export function getDealNet(deal: Deal, marketId: number): number {
  const value = rn(deal.units * deal.price, 2);
  return isMarketSeller(deal, marketId) ? value : -value;
}

function downloadDealsCsv(): void {
  const market = Markets.get(activeMarketId);
  if (!market) return;

  const lines = getMarketDeals(pack.deals, activeMarketId);
  let csv = "Id,Good,Type,Client,Units,Price,Net\n";
  for (const deal of lines) {
    const good = Goods.get(deal.good);
    if (!good) continue;

    csv += [
      deal.i,
      good.name,
      getDirection(deal, activeMarketId),
      getParty(deal)?.name ?? "",
      rn(deal.units, 2),
      rn(deal.price, 2),
      rn(getDealNet(deal, activeMarketId), 2)
    ].join(",");
    csv += "\n";
  }

  downloadFile(csv, `${getFileName(`Market_${activeMarketId}_Deals`)}.csv`);
}

export const MarketDealsOverview = { open };
