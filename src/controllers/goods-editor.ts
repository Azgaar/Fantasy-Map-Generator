import { select } from "d3";
import {
  closeDialogs,
  confirmationDialog,
  destroyDialog,
  refreshEditors,
  updateDialog
} from "@/components/dialog/dialog-helpers";
import { bindColumnSorting, sortDataByColumns } from "@/components/dialog/sorting";
import { dialogState } from "@/components/dialog/state";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  setModeHiddenColumns,
  type TableView
} from "@/components/dialog/table";
import { Layers } from "@/components/layers";
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import { downloadFile, getFileName, rn } from "@/utils";
import type { Good } from "../generators/goods-generator";
import { isDealRecord, isMfgRecord } from "../generators/production-generator";
import { ensureEl, getPointer, unique } from "../utils";

let production: ReturnType<typeof getProduction> = {};
let stockData: ReturnType<typeof getAllStockData> = {};

const dialogId = "goodsEditor" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
let filterState: { visibleTags: string[] };

const columns: EditorColumn<Good>[] = [
  { key: "display", width: "1.6em" },
  { key: "name", label: "Name", width: "10em", permanent: true, sortBy: good => good.name, sortType: "alpha" },
  {
    key: "type",
    label: "Type",
    width: "6em",
    permanent: true,
    sortBy: good => [good.recipes && "MFG", good.distribution && "RAW"].filter(Boolean).join(","),
    sortType: "alpha"
  },
  {
    key: "unit",
    label: "Unit",
    width: "4em",
    sortBy: good => good.unit ?? "",
    sortType: "alpha",
    tip: "Unit of production. Click to sort"
  },
  {
    key: "produced",
    label: "Produced",
    width: "6em",
    sortBy: good => rn((production[good.i]?.burg ?? 0) + (production[good.i]?.cell ?? 0)),
    defaultSort: "desc",
    tip: "Total units produced daily in cells (raw) and burgs (manufactured). Click to sort"
  },
  {
    key: "stock",
    label: "Stock",
    width: "6em",
    sortBy: good => stockData[good.i]?.total ?? 0,
    marginLeft: ".7em",
    tip: "Total units in stock across all markets and burg inventories. Click to sort"
  },
  {
    key: "price",
    label: "Price",
    width: "4.6em",
    sortBy: good => good.value,
    tip: "Base (initial) price. Click to sort"
  },
  { key: "actions", width: "2em", permanent: true, align: "right" }
];
const goodsTable = initEditorTable<Good>({ getData: getGoodsData, onUpdate: renderGoodsPage });

function open() {
  if (customization) return;
  filterState = dialogState.get(dialogId, "filters", () => ({ visibleTags: [] as string[] }));
  closeDialogs("#goodsEditor, .stable");

  Layers.show("goods");

  renderDialog();
  goodsTable.reset();

  $("#goodsEditor").dialog({
    title: "Goods Editor",
    close: closeGoodsEditor,
    position
  });
}

function getVisibleCount(): number {
  return pack.goods.reduce((count, good) => count + (good.visible ? 1 : 0), 0);
}

function refreshEditor() {
  goodsTable.refresh();
  Layers.draw("goods");
}

function renderDialog(): void {
  destroyDialog("goodsEditor");
  const editorHtml = /* html */ `<div id="goodsEditor" class="dialog stable editorDialog">
      ${renderEditorHeader({ dialogId, columns })}
      <div id="goodsBody" class="table" style="max-height: 50vh;" data-type="absolute"></div>
      <div id="goodsFooter" class="totalLine hide">
        <div data-tip="Number of goods (displayed / total)" style="margin-left: 5px">Goods:&nbsp;<span id="goodsDisplayed">0</span> of <span id="goodsNumber">0</span></div>
        <div data-tip="Total units produced daily by all cells and burgs" style="margin-left: 12px">Produced:&nbsp;<span id="goodsProduced">0</span></div>
        <div data-tip="Total units in stock across all markets and burg inventories" style="margin-left: 12px">Stock:&nbsp;<span id="goodsStock">0</span></div>
      </div>
      <div id="goodsBottom">
        <button id="goodsEditorRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
        <button
          id="goodsPercentage"
          data-tip="Toggle percentage / absolute values display mode"
          class="icon-percent"
        ></button>
        <button id="goodsTagsFilter" data-tip="Filter visible goods by tags" class="icon-tags"></button>
        <button id="goodsAssign" data-tip="Manually assign goods to cells" class="icon-brush"></button>
        <button id="goodsAdd" data-tip="Add a new good" class="icon-plus hide"></button>
        <button id="goodsRegenerateGoods" data-tip="Regenerate bonus goods placement" class="icon-arrows-cw hide"></button>
        <button id="goodsRegenerateProduction" data-tip="Regenerate production and trade deals" class="icon-retweet hide"></button>
        <button id="goodsChains" data-tip="Show production chains graph" class="icon-chart-line hide"></button>
        <button
          id="goodsRestore"
          data-tip="Restore default list and regenerate goods"
          class="icon-history hide"
        ></button>
        <button id="goodsExport" data-tip="Download goods-related data" class="icon-download hide"></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  ensureEl("goodsTagsFilter").classList.toggle("active", filterState.visibleTags.length > 0);
  ensureEl(`${dialogId}Header`).querySelector<HTMLElement>('[data-col="display"]')!.innerHTML = /* html */ `<input
    type="checkbox" data-tip="Show or hide all goods on the Goods map" class="native" id="goodsDisplayAll"
    style="margin: 0; width: 1.2em;" />`;
  bindColumnSorting(dialogId, goodsTable.reset);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });

  ensureEl("goodsEditorRefresh").addEventListener("click", goodsTable.refresh);
  ensureEl("goodsPercentage").addEventListener("click", togglePercentageMode);
  ensureEl("goodsTagsFilter").addEventListener("click", openTagsVisibilityDialog);
  ensureEl("goodsAssign").addEventListener("click", enterResourceAssignMode);
  ensureEl("goodsAdd").addEventListener("click", () => Controllers.GoodEditor.open(undefined, refreshEditor));
  ensureEl("goodsRestore").addEventListener("click", goodsRestoreDefaults);
  ensureEl("goodsExport").addEventListener("click", downloadGoodsData);
  ensureEl("goodsDisplayAll").addEventListener("change", toggleAllDisplayed);
  ensureEl("goodsChains").addEventListener("click", () => Controllers.ProductionChains.open());
  ensureEl("goodsRegenerateGoods").addEventListener("click", requestGoodsRegeneration);
  ensureEl("goodsRegenerateProduction").addEventListener("click", requestProductionRegeneration);

  ensureEl("goodsBody").addEventListener("click", ev => {
    const el = ev.target as HTMLElement;
    const cl = el.classList;
    const line = el.closest<HTMLElement>(".states");
    if (!line) return;
    const good = Goods.get(+line.dataset.id!);
    if (!good) return;
    if (cl.contains("goodEdit")) return Controllers.GoodEditor.open(good, refreshEditor);
    if (cl.contains("goodDisplayed")) return toggleDisplayedGood(good, el as HTMLInputElement);
    if (cl.contains("icon-trash-empty")) return removeGood(good);
  });
}

function getGoodsData(): Good[] {
  production = getProduction();
  stockData = getAllStockData();
  const hasFilter = filterState.visibleTags.length > 0;
  const goods = hasFilter
    ? pack.goods.filter(good => good.tags?.some(tag => filterState.visibleTags.includes(tag)))
    : [...pack.goods];
  return sortDataByColumns(dialogId, goods, columns);
}

function renderGoodsPage(view: TableView<Good>) {
  const body = ensureEl("goodsBody");
  const percentage = body.dataset.type === "percentage";
  const totalProduced = Object.values(production).reduce((sum, value) => sum + value.burg + value.cell, 0);
  const totalStock = Object.values(stockData).reduce((sum, value) => sum + value.total, 0);

  const renderTypeBadge = (type: string) => {
    const commonStyles =
      "display:inline-block;border-radius:3px;padding:0 .4em;font-size:0.8em;font-weight:bold;line-height:1.35";
    if (type === "RAW")
      return `<span style="${commonStyles};background:#d0e7f5;color:#036" data-tip="Raw goods are produced by rural population in cells based on biome availability and in cells and burgs when bonus resource is assigned to cells">RAW</span>`;
    return `<span style="${commonStyles};background:#f8e7bf;color:#b67a00" data-tip="Manufactured goods are produced in burgs">MFG</span>`;
  };

  const lines = view.rows
    .map(good => {
      const types = [good.recipes && "MFG", good.distribution && "RAW"].filter(Boolean) as string[];
      const goodProduction = production[good.i] || { burg: 0, cell: 0 };
      const produced = rn(goodProduction.burg + goodProduction.cell);
      const producedTip = `Good daily production: ${produced}⚒. Cells: ${rn(goodProduction.cell, 2)}⚒. Burgs: ${rn(goodProduction.burg, 2)}⚒`;
      const stock = rn(stockData[good.i]?.total ?? 0);
      const stockTip = `Total stock in all markets and burg inventories: ${stock} units`;

      return /*html*/ `<div class="states goods" data-id=${good.i} data-produced="${produced}" data-stock="${stock}">
        <div data-col="display"><input type="checkbox" data-tip="Toggle this good on the Goods map" class="native goodDisplayed" style="margin: 0; width: 1.2em;" ${good.visible ? "checked" : ""} /></div>
        <div data-col="name" style="display:flex; align-items:center"><svg data-tip="Good icon" width="2em" height="2em" class="goodIcon">
          <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${Goods.getStroke(good.color)}"/>
          <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"/>
        </svg><span data-tip="Good name" class="goodName">${good.name}</span></div>
        <div data-col="type" data-tip="Good types" class="goodType">${types.map(renderTypeBadge).join(" ")}</div>
        <div data-col="unit" data-tip="Unit of production" class="goodUnit">${good.unit ?? ""}</div>
        <div data-col="produced" data-tip="${producedTip}. Click to see burgs producing this good" class="goodProduced pointer" style="text-align: right">
          <div style="display: inline-block; width: 3em">${percentage ? `${rn(totalProduced ? (produced / totalProduced) * 100 : 0, 2)}%` : produced}</div>
          <div style="display: inline-block; width: 0.4em; font-size: 1.5em;">⚒</div>
        </div>
        <div data-col="stock" data-tip="${stockTip}. Click to see breakdown by location" class="goodStock pointer" style="text-align: right">
          <div style="display: inline-block; width: 3em">${percentage ? `${rn(totalStock ? (stock / totalStock) * 100 : 0, 2)}%` : stock}</div>
          <div style="display: inline-block; width: 0.4em; font-size: 1.2em;">⛁</div>
        </div>
        <div data-col="price" data-tip="Base (initial) price. Click to compare prices across markets" class="goodBasePrice pointer">🟡 ${good.value}</div>
        <div data-col="actions"><span data-tip="Edit good" class="icon-pencil goodEdit"></span><span data-tip="Remove good" class="icon-trash-empty goodRemove"></span></div>
      </div>`;
    })
    .join("");
  body.innerHTML = lines || "No goods available";

  ensureEl("goodsDisplayed").innerHTML = String(getVisibleCount());
  ensureEl("goodsNumber").innerHTML = String(pack.goods.length);
  ensureEl("goodsProduced").innerHTML = String(rn(totalProduced));
  ensureEl("goodsStock").innerHTML = String(rn(totalStock));
  renderEditorPagination(ensureEl("goodsFooter"), view, goodsTable.goto);

  body.querySelectorAll("div.states").forEach(el => void el.addEventListener("click", selectResourceOnLineClick));
  body.querySelectorAll<HTMLButtonElement>(".goodProduced").forEach(el => {
    el.addEventListener("click", ev => {
      ev.stopPropagation();
      openProducersDialog(Number(el.closest<HTMLElement>(".states")?.dataset.id));
    });
  });

  body.querySelectorAll<HTMLElement>(".goodStock").forEach(el => {
    el.addEventListener("click", ev => {
      ev.stopPropagation();
      const goodId = Number((el.closest<HTMLElement>(".states") as HTMLElement).dataset.id);
      openStockDialog(goodId);
    });
  });

  body.querySelectorAll<HTMLElement>(".goodBasePrice").forEach(el => {
    el.addEventListener("click", ev => {
      ev.stopPropagation();
      const goodId = Number((el.closest<HTMLElement>(".states") as HTMLElement).dataset.id);
      Controllers.ComparePrices.open(goodId, "#goodsEditor");
    });
  });

  updateDisplayAllCheckbox();
  updateDialog(dialogId, { width: "fit-content", position });
}

function openProducersDialog(goodId: number) {
  const good = Goods.get(goodId);
  if (!good) return;

  const producers = pack.burgs
    .filter(b => b.i && !b.removed)
    .map(b => ({ burg: b, units: Production.getBurgProduction(b)[goodId] ?? 0 }))
    .filter(({ units }) => units > 0)
    .sort((a, b) => b.units - a.units);

  if (!producers.length) {
    alertMessage.innerHTML = `<i style="color:#888">No burgs produced ${good.name}.</i>`;
  } else {
    const header = /*html*/ `
          <div class="header" style="grid-template-columns: 1.6em 7em 4em;">
            <div></div>
            <div>Burg</div>
            <div>Units</div>
         </div>`;
    const rows = producers
      .map(
        ({ burg, units }) => /*html*/ `
          <div data-tip="Click to zoom to burg" class="states pointer" data-x="${burg.x} " data-y="${burg.y}" data-id="${burg.i}">
            <div class="icon-dot-circled" style="width:1em"></div>
            <div style="width:7em;">${burg.name}</div>
            <div style="width:4em;">${units}</div>
          </div>`
      )
      .join("");
    alertMessage.innerHTML = header + rows;
    alertMessage.querySelectorAll<HTMLElement>(".states").forEach(row => {
      row.addEventListener("click", () => {
        zoomTo(Number(row.dataset.x), Number(row.dataset.y), 8, 2000);
      });
    });
  }

  $("#alert").dialog({
    resizable: false,
    title: `${good.name} producers`,
    buttons: {
      Close: function () {
        $(this).dialog("close");
      }
    }
  });
}

type StockSource = { name: string; type: "market" | "burg"; x: number; y: number; id: number; stock: number };

function getAllStockData(): Record<number, { total: number; sources: StockSource[] }> {
  const dealById = new Map((pack.deals || []).map(d => [d.i, d]));
  const result: Record<number, { total: number; sources: StockSource[] }> = {};
  for (const good of pack.goods) result[good.i] = { total: 0, sources: [] };

  for (const market of pack.markets || []) {
    const centerBurg = pack.burgs[market.centerBurgId];
    if (!centerBurg) continue;
    const x = centerBurg.x ?? 0;
    const y = centerBurg.y ?? 0;
    const marketName = Markets.getName(market);

    for (const [goodIdStr, { stock }] of Object.entries(market.goods)) {
      const goodId = +goodIdStr;
      if (!result[goodId] || stock <= 0) continue;
      result[goodId].total += stock;
      result[goodId].sources.push({ name: marketName, type: "market", x, y, id: market.i, stock });
    }
  }

  for (const burg of pack.burgs) {
    if (!burg?.i || burg.removed || !burg.production) continue;

    const netInventory: Record<number, number> = {};
    for (const record of burg.production) {
      if (isMfgRecord(record)) {
        netInventory[record.goodId] = (netInventory[record.goodId] || 0) + record.units;
        for (const item of record.recipe) {
          netInventory[item.goodId] = (netInventory[item.goodId] || 0) - item.units;
        }
      } else if (isDealRecord(record)) {
        const deal = dealById.get(record.dealId);
        if (!deal) continue;
        if (deal.buyerType === "burg" && deal.buyer === burg.i) {
          netInventory[deal.good] = (netInventory[deal.good] || 0) + deal.units;
        } else if (deal.sellerType === "burg" && deal.seller === burg.i) {
          netInventory[deal.good] = (netInventory[deal.good] || 0) - deal.units;
        }
      } else {
        netInventory[record.goodId] = (netInventory[record.goodId] || 0) + record.units;
      }
    }

    for (const [goodIdStr, units] of Object.entries(netInventory)) {
      const goodId = +goodIdStr;
      if (!result[goodId] || units <= 0.001) continue;
      const roundedUnits = rn(units, 2);
      result[goodId].total += roundedUnits;
      result[goodId].sources.push({
        name: burg.name || `Burg ${burg.i}`,
        type: "burg",
        x: burg.x ?? 0,
        y: burg.y ?? 0,
        id: burg.i,
        stock: roundedUnits
      });
    }
  }

  for (const good of pack.goods) result[good.i].total = rn(result[good.i].total, 2);

  return result;
}

function openStockDialog(goodId: number) {
  const good = Goods.get(goodId);
  if (!good) return;

  const stockData = getAllStockData();
  const data = stockData[goodId];
  const sources = data?.sources ?? [];

  if (!sources.length) {
    alertMessage.innerHTML = `<i style="color:#888">No stock of ${good.name} found in any market or burg inventory.</i>`;
  } else {
    const header = /*html*/ `
      <div class="header" style="grid-template-columns: 1.6em 7em 4em;">
        <div></div>
        <div>Location</div>
        <div>Units</div>
      </div>`;
    const rows = [...sources]
      .sort((a, b) => b.stock - a.stock)
      .map(
        source => /*html*/ `
        <div data-tip="Click to zoom to location" class="states pointer" data-x="${source.x}" data-y="${source.y}" data-id="${source.id}">
          <div class="${source.type === "market" ? "icon-store" : "icon-dot-circled"}" style="width:1em"></div>
          <div style="width:7em;">${source.name}</div>
          <div style="width:4em;">${source.stock}</div>
        </div>`
      )
      .join("");
    alertMessage.innerHTML = header + rows;
    alertMessage.querySelectorAll<HTMLElement>(".states").forEach(row => {
      row.addEventListener("click", () => {
        zoomTo(Number(row.dataset.x), Number(row.dataset.y), 8, 2000);
      });
    });
  }

  $("#alert").dialog({
    resizable: false,
    title: `${good.name} stock`,
    buttons: {
      Close: function () {
        $(this).dialog("close");
      }
    }
  });
}

function getProduction() {
  const production: Record<number, { burg: number; cell: number }> = {};
  const addProduction = (goodId: number, amount: number, type: "burg" | "cell") => {
    if (!production[goodId]) production[goodId] = { burg: 0, cell: 0 };
    production[goodId][type] += amount;
  };

  // rural production
  const productionByBiome = Goods.getBiomesProduction();
  for (const cellId of pack.cells.i) {
    const produced = Production.getCellProduction(cellId, productionByBiome);
    for (const goodId in produced) {
      addProduction(Number(goodId), produced[goodId] || 0, "cell");
    }
  }

  // burg production
  for (const burg of pack.burgs) {
    if (!burg || burg.removed || !burg.production) continue;
    const produced = Production.getBurgProduction(burg);
    for (const goodId in produced) {
      addProduction(Number(goodId), produced[goodId] || 0, "burg");
    }
  }

  return production;
}

function openTagsVisibilityDialog() {
  const tags = unique(pack.goods.flatMap(good => good.tags));
  const renderTag = (tag: string) =>
    `<label style="display: flex; align-items: center;"><input type="checkbox" class="native" value="${tag}" ${filterState.visibleTags.includes(tag) ? "checked" : ""} /> ${tag}</label>`;
  const tagsMarkup = tags.length ? tags.map(renderTag).join("") : '<div style="color:#666">No tags available</div>';

  alertMessage.innerHTML = `
    <div data-tip="Only goods with at least one selected tag remain visible in the editor list" style="display: grid; grid-template-columns: 1fr 1fr 1fr; column-gap: 0.3em;">${tagsMarkup}</div>
  `;

  $("#alert").dialog({
    resizable: false,
    title: "Filter goods by tags",
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      "Clear filter": function () {
        filterState.visibleTags = [];
        dialogState.set(dialogId, "filters", filterState);
        applyTagVisibilityFilter();
        $(this).dialog("close");
      },
      Apply: function () {
        const checks = Array.from(alertMessage.querySelectorAll<HTMLInputElement>("input[type=checkbox]:checked"));
        filterState.visibleTags = checks.map(check => check.value);
        dialogState.set(dialogId, "filters", filterState);
        applyTagVisibilityFilter();
        $(this).dialog("close");
      }
    }
  });
}

function applyTagVisibilityFilter() {
  const hasFilter = filterState.visibleTags.length > 0;
  ensureEl("goodsTagsFilter").classList.toggle("active", hasFilter);
  goodsTable.reset();
}

function goodsRestoreDefaults() {
  confirmationDialog({
    title: "Restore default goods",
    message: "Are you sure you want to restore default goods? <br>This action cannot be reverted",
    confirm: "Restore",
    onConfirm: () => {
      Goods.restoreDefaults();
      Goods.generate();
      Production.regenerateEconomy();
      Layers.draw("markets", "goods");
      Layers.draw("trade");
      refreshEditors();
    }
  });
}

function togglePercentageMode() {
  const body = ensureEl("goodsBody");
  body.dataset.type = body.dataset.type === "absolute" ? "percentage" : "absolute";
  goodsTable.refresh();
}

function enterResourceAssignMode(this: HTMLElement) {
  if (this.classList.contains("pressed")) return exitResourceAssignMode();
  customization = 14;
  this.classList.add("pressed");
  Layers.show("goods");
  if (!Layers.isOn("cells")) {
    Layers.show("cells");
    isCellsLayerForced = true;
  }

  setModeHiddenColumns(dialogId, ["display", "unit", "produced", "stock", "price", "actions"]);
  ensureEl("goodsFooter").style.display = "none";

  $("#goodsEditor").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" } });

  tip("Select good line in editor, click on cells to remove or add a bonus resource", true);
  select<SVGElement, unknown>("#viewbox").on("click", changeResourceOnCellClick);
}

function selectResourceOnLineClick(this: HTMLElement) {
  if (customization !== 14) return;
  const body = ensureEl("goodsBody");
  body.querySelector<HTMLElement>("div.selected")?.classList.remove("selected");
  this.classList.add("selected");
}

function changeResourceOnCellClick(this: SVGElement, event: MouseEvent) {
  const body = ensureEl("goodsBody");
  const point = getPointer(event, this);
  const cellId = Pack.findCell(...point);
  if (cellId === undefined) return;

  const selected = body.querySelector<HTMLElement>("div.selected");
  if (!selected) return;

  if (pack.cells.good[cellId]) {
    pack.cells.good[cellId] = 0;
  } else {
    const resourceId = +selected.dataset.id!;
    const resource = Goods.get(resourceId);
    if (!resource) return;
    pack.cells.good[cellId] = resourceId;
    resource.visible = true;
  }

  Layers.draw("goods");
}

let isCellsLayerForced = false; // the cells layer is turned on for the assignment mode

function exitResourceAssignMode(close?: string) {
  const body = ensureEl("goodsBody");
  customization = 0;
  ensureEl("goodsAssign").classList.remove("pressed");

  if (isCellsLayerForced) {
    Layers.hide("cells");
    isCellsLayerForced = false;
  }

  setModeHiddenColumns(dialogId, []);
  ensureEl("goodsFooter").style.display = "";

  if (!close) goodsTable.refresh();

  applyDefaultViewboxEvents();
  clearMainTip();
  const selected = body.querySelector("div.selected");
  if (selected) selected.classList.remove("selected");
}

function downloadGoodsData() {
  const cellsByGood: Record<number, number> = {};
  for (const goodId of pack.cells.good) {
    if (goodId) cellsByGood[goodId] = (cellsByGood[goodId] || 0) + 1;
  }

  const production = getProduction();
  const stockData = getAllStockData();

  let data = "Id,Good,Color,Type,Tags,Value,Unit,Demand Coverage,Chance,Model,Cells,Produced,Stock\n";

  for (const good of pack.goods) {
    const types = [good.recipes && "MFG", good.distribution && "RAW"].filter(Boolean).join(";");
    const tags = good.tags.join(";");
    const demandCoverage = Object.entries(good.demandCoverage || {})
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
    const cells = cellsByGood[good.i] || 0;
    const goodProduction = production[good.i] || { burg: 0, cell: 0 };
    const produced = rn(goodProduction.burg + goodProduction.cell);
    const stock = stockData[good.i]?.total ?? 0;

    data += `${good.i},${good.name},${good.color},${types},${tags},${good.value},${good.unit ?? ""},${demandCoverage},${good.chance ?? ""},${good.distribution ?? ""},${cells},${produced},${stock}\n`;
  }

  const name = `${getFileName("Goods")}.csv`;
  downloadFile(data, name);
}

function toggleDisplayedGood(good: Good, el: HTMLInputElement) {
  good.visible = el.checked;

  updateDisplayAllCheckbox();
  Layers.draw("goods");
}

function toggleAllDisplayed(this: HTMLInputElement) {
  const checked = this.checked;
  for (const good of pack.goods) good.visible = checked;

  ensureEl("goodsBody")
    .querySelectorAll<HTMLInputElement>(".goodDisplayed")
    .forEach(checkbox => {
      checkbox.checked = checked;
    });

  Layers.draw("goods");
}

function updateDisplayAllCheckbox() {
  const master = ensureEl<HTMLInputElement>("goodsDisplayAll");
  const total = pack.goods.length;
  const visibleCount = getVisibleCount();
  master.checked = total > 0 && visibleCount === total;
  master.indeterminate = visibleCount > 0 && visibleCount < total;
  ensureEl("goodsDisplayed").innerHTML = String(visibleCount);
}

function requestGoodsRegeneration() {
  confirmationDialog({
    title: "Regenerate bonus goods",
    message:
      "Are you sure you want to regenerate bonus goods placement? Generation will be based on the current Goods settings and won't affect production or trade",
    confirm: "Regenerate",
    onConfirm: () => {
      Goods.regenerate();
      Layers.draw("goods");
      refreshEditors();
    }
  });
}

function requestProductionRegeneration() {
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

function removeGood(good: Good) {
  const message = "Are you sure you want to remove the resource? <br>This action cannot be reverted";
  const onConfirm = () => {
    for (const i of pack.cells.i) {
      if (pack.cells.good[i] === good.i) {
        pack.cells.good[i] = 0;
      }
    }

    pack.goods = pack.goods.filter(g => g.i !== good.i);
    Goods.sync();
    goodsTable.refresh();
    Layers.draw("goods");
  };
  confirmationDialog({ title: "Remove resource", message, confirm: "Remove", onConfirm });
}

function closeGoodsEditor() {
  if (customization === 14) exitResourceAssignMode("close");
  $("#goodsEditor").dialog("destroy");
  ensureEl("goodsEditor").remove();
}

export const GoodsEditor = { open };
