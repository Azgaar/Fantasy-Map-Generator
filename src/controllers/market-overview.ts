import { select } from "d3";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { applySorting, applySortingByHeader } from "@/components/dialog/sorting";
import { clearMainTip, tip } from "@/components/tooltips";
import { restoreDefaultEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import { drawMarketsLayer } from "@/renderers/draw-markets";
import { downloadFile, getFileName } from "@/utils";
import type { Burg } from "../generators/burgs-generator";
import type { Market } from "../generators/markets-generator";
import { ensureEl, formatPrice, getPointer, rn } from "../utils";

let activeMarketId = 0;

function open(marketId: number): void {
  if (customization) return;

  const market = Markets.get(marketId);
  if (!market) {
    tip("Invalid market. The selected market does not exist", true, "error", 5000);
    return;
  }
  activeMarketId = marketId;

  closeDialogs("#marketOverview, .stable");

  renderDialog();
  marketOverviewAddLines();
  refreshNameInput(market);

  $("#marketOverview").dialog({
    title: `Market Stock: ${Markets.getName(market)}`,
    width: "auto",
    close: closeMarketOverview,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });
}

function renderDialog(): void {
  document.getElementById("marketOverview")?.remove();
  const html = /* html */ `<div id="marketOverview" class="dialog stable">
      <div id="marketOverviewNameLine" style="display: flex; align-items: center; margin-bottom: 0.4em">
        <div class="label">Name:</div>
        <input
          id="marketOverviewName"
          data-tip="Type to rename the market. Clear the field to reset to the default name"
          autocorrect="off"
          spellcheck="false"
          style="width: 11em; margin-left: 0.3em;"
        />
        <span
          id="marketOverviewNameReset"
          data-tip="Reset to the default name (center burg name)"
          class="icon-ccw pointer"
          style="margin-left: 0.3em"
        ></span>
      </div>
      <div id="marketOverviewHeader" class="header" style="grid-template-columns: 2.5em 9em 5.5em 3.2em;">
        <div></div>
        <div data-tip="Click to sort by good" class="sortable alphabetically" data-sortby="good" style="margin-left:0">Good&nbsp;</div>
        <div data-tip="Click to sort by stock" class="sortable icon-sort-number-down" data-sortby="stock">Stock&nbsp;</div>
        <div data-tip="Click to sort by price" class="sortable" data-sortby="price">Price&nbsp;</div>
      </div>
      <div id="marketOverviewGoodsBody" class="table" style="max-height:40em"></div>
      <div id="marketOverviewSummary" class="totalLine"></div>
      <div id="marketOverviewInfo" style="margin-bottom: 0.3em"></div>
      <div id="marketOverviewBottom">
        <button id="marketOverviewRefresh" data-tip="Refresh the Overview screen" class="icon-cw"></button>
        <button id="marketOverviewOpenDeals" data-tip="View market deals" class="icon-list-bullet"></button>
        <button
          id="marketOverviewRelocate"
          data-tip="Relocate market. Click on a burg on the map to move the market center"
          class="icon-map-pin"
        ></button>
        <button id="marketOverviewExport" data-tip="Save market deals data as a text file (.csv)" class="icon-download"></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  applySortingByHeader("marketOverviewHeader");

  ensureEl("marketOverviewRefresh").on("click", marketOverviewAddLines);
  ensureEl("marketOverviewExport").on("click", downloadStockCsv);
  ensureEl("marketOverviewOpenDeals").on("click", () => Controllers.MarketDealsOverview.open(activeMarketId));
  ensureEl("marketOverviewRelocate").on("click", toggleRelocateMarket);
  ensureEl("marketOverviewName").on("input", onRenameInput);
  ensureEl("marketOverviewNameReset").on("click", resetMarketName);
}

// The input shows the custom name (empty when using the default); the placeholder shows the default.
function refreshNameInput(market: Market): void {
  const input = ensureEl<HTMLInputElement>("marketOverviewName");
  input.value = market.name || "";
  input.placeholder = pack.burgs[market.centerBurgId]?.name || `Market ${market.i}`;
}

function onRenameInput(this: HTMLInputElement): void {
  const market = Markets.get(activeMarketId);
  if (!market) return;
  const value = this.value.trim();
  market.name = value || undefined;
  $("#marketOverview").dialog("option", "title", `Market Stock: ${Markets.getName(market)}`);
}

function resetMarketName(): void {
  const market = Markets.get(activeMarketId);
  if (!market) return;
  market.name = undefined;
  ensureEl<HTMLInputElement>("marketOverviewName").value = "";
  $("#marketOverview").dialog("option", "title", `Market Stock: ${Markets.getName(market)}`);
}

function marketOverviewAddLines() {
  const market = Markets.get(activeMarketId);
  if (!market) {
    tip("Invalid market. The selected market does not exist", true, "error", 5000);
    return;
  }

  const centerBurg = pack.burgs[market.centerBurgId] as Burg | undefined;
  if (!centerBurg || centerBurg.removed) {
    tip("Invalid market. The selected market has no center burg", true, "error", 5000);
    return;
  }

  let lines = "";
  for (const [goodId, marketGood] of Object.entries(market.goods)) {
    const good = Goods.get(Number(goodId));
    if (!good) continue;
    const stroke = Goods.getStroke(good.color);

    lines += /*html*/ `<div class="states marketGood"
      data-good="${good.name}"
      data-stock="${rn(marketGood.stock, 2)}"
      data-price="${rn(marketGood.price, 2)}">
      <svg data-tip="Good icon" width="2em" height="2em" class="goodIcon">
        <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${stroke}"/>
        <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"/>
      </svg>
      <div data-tip="Good name" class="goodName">${good.name}</div>
      <div data-tip="Good stock" class="marketGoodStock">${rn(marketGood.stock, 2)}</div>
      <div data-tip="Good price" class="marketGoodPrice">${formatPrice(marketGood.price)}</div>
    </div>`;
  }
  ensureEl("marketOverviewGoodsBody").innerHTML = lines || "No market goods available";

  const center = pack.burgs[market.centerBurgId];
  const state = pack.states[center?.state || 0];
  const coaId = `stateCOA${state.i}`;
  if (state) COArenderer.trigger(coaId, state.coa);

  ensureEl("marketOverviewInfo").innerHTML =
    `<svg class="coaIcon" viewBox="0 0 200 200"><use href="#${coaId}"></use></svg><b>Owner:</b> ${state.fullName || state.name}`;

  const burgs = pack.burgs.filter(b => !b.removed && b.market === market.i);
  const totalUnits = Object.values(market.goods).reduce((sum, mg) => sum + mg.stock, 0);
  ensureEl("marketOverviewSummary").innerHTML = /*html*/ `
    <div style="margin-left:5px">Cells: ${pack.cells.market.reduce((count, m) => count + (m === market.i ? 1 : 0), 0)}</div>
    <div style="margin-left:12px">Burgs: ${burgs.length}</div>
    <div style="margin-left:12px">Stock: ${rn(totalUnits, 2)}</div>`;

  applySorting(ensureEl("marketOverviewHeader"));
  $("#marketOverview").dialog({ width: "fit-content" });
}

function toggleRelocateMarket(): void {
  const button = ensureEl("marketOverviewRelocate");
  button.classList.toggle("pressed");
  if (button.classList.contains("pressed")) {
    select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", relocateMarketOnClick);
    tip("Click on a burg on the map to relocate the market center", true);
  } else {
    clearMainTip();
    restoreDefaultEvents();
  }
}

function relocateMarketOnClick(this: SVGGElement, event: MouseEvent): void {
  const market = Markets.get(activeMarketId);
  if (!market) return;

  const [x, y] = getPointer(event, this);
  const cellId = findCell(x, y);
  if (cellId === undefined) return;

  const burgId = pack.cells.burg[cellId];
  const burg = pack.burgs[burgId] as Burg | undefined;
  if (!burgId || !burg || burg.removed) {
    tip("No valid burg in this cell. Click on a cell with a burg", false, "error");
    return;
  }

  if (burgId === market.centerBurgId) {
    tip("This burg is already the center of this market", false, "error");
    return;
  }

  if (pack.markets.some(m => m.centerBurgId === burgId)) {
    tip("This burg is already a center of another market", false, "error");
    return;
  }

  if (!Markets.relocateMarket(activeMarketId, burgId)) return;

  toggleRelocateMarket();
  if (layerIsOn("toggleMarketsLayer")) drawMarketsLayer();

  refreshNameInput(market);
  $("#marketOverview").dialog("option", "title", `Market Stock: ${Markets.getName(market)}`);
  marketOverviewAddLines();
}

function downloadStockCsv() {
  const market = Markets.get(activeMarketId);
  if (!market) return;

  let csv = "Good,Stock,Buy Price,Sell Price\n";
  for (const [goodId, marketGood] of Object.entries(market.goods)) {
    const good = Goods.get(Number(goodId));
    if (!good) continue;
    const buyPrice = rn(Markets.customerBuyPrice(marketGood.price), 2);
    const sellPrice = rn(Markets.customerSellPrice(marketGood.price), 2);
    csv += `${[good.name, rn(marketGood.stock, 2), buyPrice, sellPrice].join(",")}\n`;
  }
  downloadFile(csv, `${getFileName("Market")}.csv`);
}

function closeMarketOverview() {
  if (ensureEl("marketOverviewRelocate").classList.contains("pressed")) toggleRelocateMarket();
  $("#marketOverview").dialog("destroy");
  ensureEl("marketOverview").remove();
}

export const MarketOverview = { open };
