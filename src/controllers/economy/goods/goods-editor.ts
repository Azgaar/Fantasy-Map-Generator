import { select } from "d3";
import { Controllers } from "@/controllers";
import type { Good } from "@/model/economy/goods-generator";
import { DEMAND_CATEGORY_ICONS, DEMAND_PRIORITY, Goods } from "@/model/economy/goods-generator";
import { Markets } from "@/model/economy/markets-generator";
import { Production } from "@/model/economy/production-generator";
import { Pack } from "@/model/graph/pack-generator";
import { Icons } from "@/model/icons";
import { States } from "@/model/political/states-generator";
import { Tags } from "@/model/tags";
import { goodBadge } from "@/renderers/draw-goods";
import { Layers } from "@/renderers/layers";
import { LegendBoxes } from "@/renderers/legend-boxes";
import { Csv } from "@/services/io/csv";
import type { LegendItem } from "@/types/legend";
import { App } from "@/ui/app-commands";
import { developmentTip } from "@/ui/development-view";
import { Dialog } from "@/ui/dialog/dialog";
import { noteIcon, refreshEditors } from "@/ui/dialog/dialog-helpers";
import { bindColumnSorting, sortDataByColumns } from "@/ui/dialog/sorting";
import { dialogState } from "@/ui/dialog/state";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  setModeHiddenColumns,
  type TableView
} from "@/ui/dialog/table";
import { BADGE_COLORS, bindEconomyWiki, economyWikiButton } from "@/ui/economy-view";
import { applyDefaultViewboxEvents } from "@/ui/map/viewbox-events";
import { zoomTo } from "@/ui/map/zoom";
import { clearMainTip, tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl, getPointer } from "@/utils/node-utils";
import { rn } from "@/utils/number-utils";
import { escapeHtml } from "@/utils/string-utils";

let production: ReturnType<typeof getProduction> = {};
let depositsByGood: Record<number, number> = {};
let stockData: ReturnType<typeof getAllStockData> = {};

const dialogId = "goodsEditor" as const;
const LEGEND_NAME = "Goods"; // the legend box this editor toggles
const position = { my: "right top", at: "right-10 top+10", of: "svg" };
let filterState: { search: string };

const columns: EditorColumn<Good>[] = [
  { key: "display", width: "1.6em" },
  { key: "name", label: t("Name"), width: "10em", permanent: true, sortBy: good => good.name, sortType: "alpha" },
  {
    key: "type",
    label: t("Type"),
    width: "6em",
    permanent: true,
    sortBy: good => [good.recipes && "MFG", good.distribution && "RAW"].filter(Boolean).join(","),
    sortType: "alpha"
  },
  {
    key: "unit",
    label: t("Unit"),
    width: "5.5em",
    sortBy: good => good.unit ?? "",
    sortType: "alpha",
    tip: sentences(t("Unit of production"), t("Click to sort"))
  },
  {
    key: "produced",
    label: t("Produced"),
    width: "7em",
    sortBy: good => rn((production[good.i]?.burg ?? 0) + (production[good.i]?.cell ?? 0)),
    defaultSort: "desc",
    tip: sentences(t("Units made a day, in cells and burgs"), t("Click to sort"))
  },
  {
    key: "stock",
    label: t("Stock"),
    width: "6em",
    sortBy: good => stockData[good.i]?.total ?? 0,
    marginLeft: ".7em",
    tip: sentences(t("Units left in stock across all markets"), t("Click to sort"))
  },
  {
    key: "price",
    label: t("Price"),
    width: "4.6em",
    sortBy: good => good.value,
    tip: sentences(t("Base (initial) price"), t("Click to sort"))
  },
  {
    key: "carriage",
    label: t("Carriage"),
    width: "6em",
    hidden: true,
    sortBy: good => good.carriage,
    tip: sentences(t("Carriage: price of one unit per decima"), t("Click to sort"))
  },
  {
    key: "development",
    label: t("Development"),
    width: "7em",
    hidden: true,
    sortBy: good => good.development ?? 0,
    tip: sentences(t("The least development a land needs to produce the good"), t("Click to sort"))
  },
  {
    key: "deposits",
    label: t("Deposits"),
    width: "5.6em",
    hidden: true,
    sortBy: good => (good.distribution ? (depositsByGood[good.i] ?? 0) : -1),
    tip: sentences(t("Deposits placed, and their range"), t("Click to sort"))
  },
  {
    key: "coverage",
    label: t("Demand Coverage"),
    width: "9em",
    hidden: true,
    sortBy: good => Object.values(good.demandCoverage ?? {}).reduce((sum, share) => sum + (share ?? 0), 0),
    tip: sentences(t("How much of each demand category one unit covers"), t("Click to sort"))
  },
  {
    key: "tags",
    label: t("Tags"),
    width: "9em",
    hidden: true,
    sortBy: good => Tags.format(good.tags),
    sortType: "alpha"
  },
  { key: "note", width: "1.1em" },
  { key: "edit", width: "1.1em" },
  { key: "remove", width: "1.4em", permanent: true }
];
const goodsTable = initEditorTable<Good>({ dialogId, getData: getGoodsData, onUpdate: renderGoodsPage });

const CSV_COLUMNS = [
  "Id",
  "Good",
  "Color",
  "Type",
  "Tags",
  "Value",
  "Carriage",
  "Development",
  "Unit",
  "Demand Coverage",
  "Deposits",
  "Model",
  "Cells",
  "Produced",
  "Stock"
];

/** With a good id, the Goods layer shows only that good */
function open(goodId?: number): void {
  void Icons.retry("goods");
  if (options.app.mode) return;
  filterState = { search: dialogState.get(dialogId, "filters", () => ({ search: "" })).search ?? "" };
  Dialog.closeAll("#goodsEditor, .stable");

  if (goodId !== undefined) {
    for (const good of options.map.goods) good.visible = good.i === goodId;
    if (filterState.search) {
      filterState = { search: "" };
      dialogState.set(dialogId, "filters", filterState);
    }
    if (Layers.has("goods")) Layers.draw("goods");
  }
  Layers.show("goods");

  renderDialog();
  goodsTable.reset();

  Dialog.open("goodsEditor", {
    title: t("Goods Editor"),
    onClose: closeGoodsEditor,
    position
  });
}

function renderCoverage(good: Good): string {
  return DEMAND_PRIORITY.flatMap(category => {
    const share = good.demandCoverage?.[category];
    return share ? [`${DEMAND_CATEGORY_ICONS[category]}${share}`] : [];
  }).join(" ");
}

function getVisibleCount(goods = options.map.goods): number {
  return goods.reduce((count, good) => count + (good.visible ? 1 : 0), 0);
}

/** The goods selected for the Goods layer, or with none selected all goods */
function toggleLegend(): void {
  const getItems = () => {
    const selected = options.map.goods.filter(good => good.visible);
    return (selected.length ? selected : [...options.map.goods])
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((good): LegendItem => [good.i, good.color, good.name]);
  };
  LegendBoxes.toggle(LEGEND_NAME, getItems, t("No goods to show"));
}

function refreshEditor() {
  if (findEl(dialogId)) goodsTable.refresh(); // the good editor can outlive it
  Layers.draw("goods");
}

function renderDialog(): void {
  Dialog.destroy("goodsEditor");
  const editorHtml = /* html */ `<div id="goodsEditor" class="dialog stable editorDialog">
      ${renderEditorHeader({ dialogId, columns })}
      <div id="goodsBody" class="table" style="max-height: 50vh;" data-type="absolute"></div>
      <div id="goodsFilters" class="editorFilters">
        <label for="goodsSearch" data-tip="${t("Filter by name or tag")}">${t("Search")}: <input id="goodsSearch" type="search" autocomplete="off" /></label>
      </div>
      <div id="goodsFooter" class="totalLine hide">
        <div data-tip="${t("Goods shown on the Goods layer")}" style="margin-left: 5px">${t("Goods")}:&nbsp;${t("{{- shown}} of {{- total}}", { shown: `<span id="goodsDisplayed">0</span>`, total: `<span id="goodsNumber">0</span>` })}</div>
        <div data-tip="${t("Total units produced daily by all cells and burgs")}" style="margin-left: 12px">${t("Produced")}:&nbsp;<span id="goodsProduced">0</span></div>
        <div data-tip="${t("Units left in stock across all markets")}" style="margin-left: 12px">${t("Stock")}:&nbsp;<span id="goodsStock">0</span></div>
      </div>
      <div id="goodsBottom">
        <button id="goodsEditorRefresh" data-tip="${t("Refresh")}" class="icon-cw"></button>
        <button
          id="goodsPercentage"
          data-tip="${t("Toggle percentage / absolute values views")}"
          class="icon-percent"
        ></button>
        <button id="goodsLegend" data-tip="${t("Toggle Legend box")}" class="icon-list-bullet"></button>
        <button id="goodsAssign" data-tip="${t("Manually assign goods to cells")}" class="icon-brush"></button>
        <button id="goodsAdd" data-tip="${t("Add")}" class="icon-plus hide"></button>
        <button id="goodsRegenerate" data-tip="${t("Open regeneration dialog")}" class="icon-arrows-cw hide"></button>
        <button id="goodsChains" data-tip="${t("Show production chains graph")}" class="icon-chart-line hide"></button>
        <button id="goodsExport" data-tip="${t("Save data as a CSV file")}" class="icon-download hide"></button>
        <button id="goodsImport" data-tip="${t("Upload data from a CSV file")}" class="icon-upload hide"></button>
        ${economyWikiButton("goodsWiki")}
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  ensureEl<HTMLInputElement>("goodsSearch").value = filterState.search;
  ensureEl(`${dialogId}Header`).querySelector<HTMLElement>('[data-col="display"]')!.innerHTML = /* html */ `<input
    type="checkbox" data-tip="${t("Select or clear all filtered goods")}" class="native" id="goodsDisplayAll"
    style="margin: 0; width: 1.2em;" />`;
  bindColumnSorting(dialogId, goodsTable.reset);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => Dialog.update(dialogId, { width: "fit-content", position })
  });

  ensureEl("goodsSearch").addEventListener("input", onSearchInput);
  ensureEl("goodsEditorRefresh").addEventListener("click", goodsTable.refresh);
  bindEconomyWiki("goodsWiki");
  ensureEl("goodsPercentage").addEventListener("click", togglePercentageMode);
  ensureEl("goodsLegend").addEventListener("click", toggleLegend);
  ensureEl("goodsAssign").addEventListener("click", enterResourceAssignMode);
  ensureEl("goodsAdd").addEventListener("click", () => Controllers.GoodEditor.open(undefined, refreshEditor));
  ensureEl("goodsExport").addEventListener("click", downloadGoodsData);
  ensureEl("goodsImport").addEventListener("click", () => Csv.pick(uploadGoodsCsv));
  ensureEl("goodsDisplayAll").addEventListener("change", toggleAllDisplayed);
  ensureEl("goodsChains").addEventListener("click", () => Controllers.ProductionChains.open());
  ensureEl("goodsRegenerate").addEventListener("click", () => App.openEconomyRegeneration(["deposits", "production"]));

  ensureEl("goodsBody").addEventListener("click", ev => {
    const el = ev.target as HTMLElement;
    const cl = el.classList;
    const line = el.closest<HTMLElement>(".states");
    if (!line) return;
    const good = Goods.get(+line.dataset.id!);
    if (!good) return;
    if (cl.contains("icon-book")) return void Controllers.NotesEditor.open({ type: "good", id: good.i });
    if (cl.contains("goodEdit")) return Controllers.GoodEditor.open(good, refreshEditor);
    if (cl.contains("goodDisplayed")) return toggleDisplayedGood(good, el as HTMLInputElement);
    if (cl.contains("icon-trash-empty")) return removeGood(good);
  });
}

function getGoodsData(): Good[] {
  production = getProduction();
  stockData = getAllStockData();
  depositsByGood = countDeposits(); // the Deposits column sorts by it
  const goods = options.map.goods.filter(good => Tags.matches(filterState.search, good.name, good.tags));
  return sortDataByColumns(dialogId, goods, columns);
}

function onSearchInput(event: Event): void {
  filterState.search = (event.target as HTMLInputElement).value;
  dialogState.set(dialogId, "filters", filterState);
  goodsTable.reset();
}

function renderGoodsPage(view: TableView<Good>) {
  const body = ensureEl("goodsBody");
  const percentage = body.dataset.type === "percentage";
  const totalProduced = Object.values(production).reduce((sum, value) => sum + value.burg + value.cell, 0);
  const totalStock = Object.values(stockData).reduce((sum, value) => sum + value.total, 0);

  const renderTypeBadge = (type: string) => {
    const commonStyles =
      "display:inline-block;border-radius:3px;padding:0 .4em;font-size:0.8em;font-weight:bold;line-height:1.35";
    const [background, color] = BADGE_COLORS[type === "RAW" ? "local" : "mfg"];
    const style = `${commonStyles};background:${background};color:${color}`;
    if (type === "RAW")
      return `<span style="${style}" data-tip="${t("Raw goods come from the land and deposits")}">${t("RAW")}</span>`;
    return `<span style="${style}" data-tip="${t("Manufactured goods are produced in burgs")}">${t("MFG")}</span>`;
  };

  const lines = view.rows
    .map(good => {
      const types = [good.recipes && "MFG", good.distribution && "RAW"].filter(Boolean) as string[];
      const goodProduction = production[good.i] || { burg: 0, cell: 0 };
      const produced = rn(goodProduction.burg + goodProduction.cell);
      const producedTip = t("Made a day: {{total}} (cells {{cells}}, burgs {{burgs}})", {
        total: `${produced}⚒`,
        cells: `${rn(goodProduction.cell, 2)}⚒`,
        burgs: `${rn(goodProduction.burg, 2)}⚒`
      });
      const stock = rn(stockData[good.i]?.total ?? 0);
      const stockTip = `${t("Units left in stock across all markets")}: ${stock}`;

      return /*html*/ `<div class="states goods" data-id=${good.i} data-produced="${produced}" data-stock="${stock}">
        <div data-col="display"><input type="checkbox" data-tip="${t("Show this good on the Goods layer")}" class="native goodDisplayed" style="margin: 0; width: 1.2em;" ${good.visible ? "checked" : ""} /></div>
        <div data-col="name" style="display:flex; align-items:center"><svg data-tip="${t("Good icon")}" width="2em" height="2em" class="goodIcon">
          ${goodBadge(good)}
        </svg><span data-tip="${t("Name")}" class="goodName">${escapeHtml(good.name)}</span></div>
        <div data-col="type" data-tip="${t("Good types")}" class="goodType">${types.map(renderTypeBadge).join(" ")}</div>
        <div data-col="unit" data-tip="${t("Unit of production")}" class="goodUnit">${escapeHtml(good.unit ?? "")}</div>
        <div data-col="produced" data-tip="${sentences(producedTip, t("Click to see states, provinces and burgs producing this good"))}" class="goodProduced pointer" style="text-align: right">
          <div style="display: inline-block; width: 3em">${percentage ? `${rn(totalProduced ? (produced / totalProduced) * 100 : 0, 2)}%` : produced}</div>
          <div style="display: inline-block; width: 0.4em; font-size: 1.5em;">⚒</div>
        </div>
        <div data-col="stock" data-tip="${sentences(stockTip, t("Click to see breakdown by location"))}" class="goodStock pointer" style="text-align: right">
          <div style="display: inline-block; width: 3em">${percentage ? `${rn(totalStock ? (stock / totalStock) * 100 : 0, 2)}%` : stock}</div>
          <div style="display: inline-block; width: 0.4em; font-size: 1.2em;">⛁</div>
        </div>
        <div data-col="price" data-tip="${sentences(t("Base (initial) price"), t("Click to compare prices across markets"))}" class="goodBasePrice pointer">🟡 ${good.value}</div>
        <div data-col="carriage" data-tip="${t("Carriage: price of one unit per decima")}">🟡 ${good.carriage}</div>
        <div data-col="development" data-tip="${good.development ? developmentTip(good.development) : t("Needs no development")}">${good.development ?? 0}</div>
        <div data-col="deposits" data-tip="${t("Deposits placed, and their range")} (${formatDeposits(good)})">${good.distribution ? (depositsByGood[good.i] ?? 0) : ""}</div>
        <div data-col="coverage" data-tip="${t("How much of each demand category one unit covers")}">${renderCoverage(good)}</div>
        <div data-col="tags" data-tip="${t("Tags")}">${Tags.format(good.tags)}</div>
        ${noteIcon(t("Edit free text notes (legend)"))}
        <span data-col="edit" data-tip="${t("Edit good")}" class="icon-pencil goodEdit"></span>
        <span data-col="remove" data-tip="${t("Remove")}" class="icon-trash-empty goodRemove"></span>
      </div>`;
    })
    .join("");
  body.innerHTML = lines || t("No goods available");

  ensureEl("goodsNumber").innerHTML = String(options.map.goods.length);
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
  Dialog.update(dialogId, { width: "fit-content", position });
}

type Producer = { type: string; name: string; units: number; x: number; y: number };

/** States and provinces by their cells' output, then burgs by their own, each type largest first */
function getProducers(goodId: number): Producer[] {
  const { cells, states, provinces, burgs } = pack;
  const byState: number[] = [];
  const byProvince: number[] = [];
  let neutralCell = 0; // neutrals have no center of their own to zoom to
  Production.getRuralOutput().forEach((produced, cellId) => {
    const units = produced[goodId];
    if (!units || !cells.market[cellId]) return;
    const workingCell = Production.getWorkingCell(cellId);
    const stateId = cells.state[workingCell];
    byState[stateId] = (byState[stateId] || 0) + units;
    if (!stateId) neutralCell ||= workingCell;
    const provinceId = cells.province?.[workingCell];
    if (provinceId) byProvince[provinceId] = (byProvince[provinceId] || 0) + units;
  });

  type Region = { name: string; center?: number; pole?: [number, number]; removed?: boolean };
  const regions = (type: string, list: Region[], units: number[]): Producer[] =>
    units.flatMap((amount, id) => {
      const region = list[id];
      if (!amount || !region || region.removed) return [];
      const [x, y] = region.pole ?? cells.p[region.center ?? neutralCell];
      return [{ type, name: region.name, units: amount, x, y }];
    });
  const burgProducers = burgs.flatMap(burg => {
    const units = burg.i && !burg.removed ? Production.getBurgProduction(burg)[goodId] : 0;
    return units ? [{ type: t("Burg"), name: burg.name ?? "", units, x: burg.x, y: burg.y }] : [];
  });

  const largestFirst = (a: Producer, b: Producer) => b.units - a.units;
  return [
    ...regions(t("State"), states, byState).sort(largestFirst),
    ...regions(t("Province"), provinces, byProvince).sort(largestFirst),
    ...burgProducers.sort(largestFirst)
  ];
}

function openProducersDialog(goodId: number) {
  const good = Goods.get(goodId);
  if (!good) return;

  const producers = getProducers(goodId);
  let message = `<i style="color:#888">${t("Nothing produces {{good}}", { good: good.name })}</i>`;
  if (producers.length) {
    const columns = "grid-template-columns: 1.6em 5em 9em 4em;";
    const header = /*html*/ `
          <div class="header" style="${columns}">
            <div></div>
            <div>${t("Type")}</div>
            <div>${t("Name")}</div>
            <div>${t("Units")}</div>
         </div>`;
    const rows = producers
      .map(
        ({ type, name, units, x, y }) => /*html*/ `
          <div data-tip="${t("Click to zoom")}" class="states pointer" data-x="${x}" data-y="${y}">
            <div class="icon-dot-circled" style="width:1.6em"></div>
            <div style="width:5em">${type}</div>
            <div style="width:9em">${escapeHtml(name)}</div>
            <div style="width:4em">${rn(units, 1)}</div>
          </div>`
      )
      .join("");
    message = header + rows;
  }

  const text = Dialog.message({
    message,
    title: t("{{- good}} producers", { good: good.name }),
    buttons: [{ label: t("Close") }]
  });
  for (const row of text.querySelectorAll<HTMLElement>(".states")) {
    row.addEventListener("click", () => zoomTo(Number(row.dataset.x), Number(row.dataset.y), 8, 2000));
  }
}

type StockSource = { name: string; x: number; y: number; stock: number };

/** Each good's stock left in the markets after the last run */
function getAllStockData(): Record<number, { total: number; sources: StockSource[] }> {
  const result: Record<number, { total: number; sources: StockSource[] }> = {};
  for (const good of options.map.goods) result[good.i] = { total: 0, sources: [] };

  for (const market of pack.markets || []) {
    const center = pack.burgs[market.centerBurgId];
    if (!center) continue;
    for (const [goodId, { stock }] of Object.entries(market.goods)) {
      if (!result[+goodId] || stock <= 0) continue;
      result[+goodId].total += stock;
      result[+goodId].sources.push({ name: Markets.getName(market), x: center.x, y: center.y, stock });
    }
  }

  for (const good of options.map.goods) result[good.i].total = rn(result[good.i].total, 2);
  return result;
}

function openStockDialog(goodId: number) {
  const good = Goods.get(goodId);
  if (!good) return;

  const sources = stockData[goodId]?.sources ?? [];

  let message = `<i style="color:#888">${t("No stock of {{good}} in any market", { good: good.name })}</i>`;
  if (sources.length) {
    const header = /*html*/ `
      <div class="header" style="grid-template-columns: 1.6em 7em 4em;">
        <div></div>
        <div>${t("Location")}</div>
        <div>${t("Units")}</div>
      </div>`;
    const rows = [...sources]
      .sort((a, b) => b.stock - a.stock)
      .map(
        source => /*html*/ `
        <div data-tip="${t("Click to zoom")}" class="states pointer" data-x="${source.x}" data-y="${source.y}">
          <div class="icon-store" style="width:1em"></div>
          <div style="width:7em;">${escapeHtml(source.name)}</div>
          <div style="width:4em;">${source.stock}</div>
        </div>`
      )
      .join("");
    message = header + rows;
  }

  const text = Dialog.message({
    message,
    title: t("{{- good}} stock", { good: good.name }),
    buttons: [{ label: t("Close") }]
  });
  for (const row of text.querySelectorAll<HTMLElement>(".states")) {
    row.addEventListener("click", () => zoomTo(Number(row.dataset.x), Number(row.dataset.y), 8, 2000));
  }
}

function getProduction() {
  const production: Record<number, { burg: number; cell: number }> = {};
  const addProduction = (goodId: number, amount: number, type: "burg" | "cell") => {
    if (!production[goodId]) production[goodId] = { burg: 0, cell: 0 };
    production[goodId][type] += amount;
  };

  Production.getRuralOutput().forEach((produced, cellId) => {
    if (!pack.cells.market[cellId]) return; // out of every market, it reaches no one
    for (const goodId in produced) addProduction(Number(goodId), produced[goodId] || 0, "cell");
  });

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

function togglePercentageMode() {
  const body = ensureEl("goodsBody");
  body.dataset.type = body.dataset.type === "absolute" ? "percentage" : "absolute";
  goodsTable.refresh();
}

function enterResourceAssignMode(this: HTMLElement) {
  if (this.classList.contains("pressed")) return exitResourceAssignMode();
  options.app.mode = "assignGoods";
  this.classList.add("pressed");
  Layers.show("goods");
  if (!Layers.isOn("cells")) {
    Layers.show("cells");
    isCellsLayerForced = true;
  }

  setModeHiddenColumns(dialogId, [
    "display",
    "unit",
    "produced",
    "stock",
    "price",
    "carriage",
    "development",
    "deposits",
    "coverage",
    "tags",
    "note",
    "edit",
    "remove"
  ]);
  ensureEl("goodsFooter").style.display = "none";

  Dialog.update(dialogId, { position });

  tip(t("Select a good, then click cells to paint deposits"), true);
  select<SVGElement, unknown>("#viewbox").on("click", changeResourceOnCellClick);
}

function selectResourceOnLineClick(this: HTMLElement) {
  if (options.app.mode !== "assignGoods") return;
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
  options.app.mode = null;
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

function countDeposits(): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const goodId of pack.cells.good ?? []) if (goodId) counts[goodId] = (counts[goodId] || 0) + 1;
  return counts;
}

function downloadGoodsData() {
  const cellsByGood = countDeposits();

  const production = getProduction();
  const stock = getAllStockData();

  const rows = options.map.goods.map(good => {
    const types = [good.recipes && "MFG", good.distribution && "RAW"].filter(Boolean).join(";");
    const demandCoverage = formatDemandCoverage(good);
    const goodProduction = production[good.i] || { burg: 0, cell: 0 };
    return [
      good.i,
      good.name,
      good.color,
      types,
      good.tags.join(";"),
      good.value,
      good.carriage,
      good.development ?? 0,
      good.unit,
      demandCoverage,
      formatDeposits(good),
      good.distribution,
      cellsByGood[good.i] || 0,
      rn(goodProduction.burg + goodProduction.cell),
      stock[good.i]?.total ?? 0
    ];
  });
  Csv.download("Goods", CSV_COLUMNS, rows);
}

/** Update goods from a CSV in the export format; derived columns and the Model code are skipped */
async function uploadGoodsCsv(text: string): Promise<void> {
  const find = (id: number) => options.map.goods.find(good => good.i === id);
  const list = (cell: string) =>
    cell
      .split(";")
      .map(item => item.trim())
      .filter(Boolean);
  const updated = await Controllers.CsvUpload.update(
    text,
    CSV_COLUMNS,
    { find, text: ["Good", "Tags", "Unit"] },
    (id, row) => {
      const good = find(id)!;
      row.apply("Good", name => Goods.rename(id, name), good.name);
      row.apply("Color", color => Goods.recolor(id, color), good.color);
      row.assign("Tags", tags => Goods.setTags(id, list(tags)), good.tags.join(";"));
      row.apply("Value", value => Goods.setPrice(id, +value), good.value);
      row.apply("Carriage", value => Goods.setCarriage(id, +value), good.carriage);
      row.apply("Development", value => Goods.setDevelopment(id, +value), good.development ?? 0);
      row.assign("Unit", unit => Goods.setUnit(id, unit), good.unit);
      row.assign(
        "Demand Coverage",
        cell => Goods.setProduction(id, { demandCoverage: cell.trim() ? parseDemandCoverage(cell) : null }),
        formatDemandCoverage(good)
      );
      row.assign(
        "Deposits",
        cell => Goods.setProduction(id, { deposits: cell.trim() ? parseDeposits(cell) : null }),
        formatDeposits(good)
      );
    }
  );
  if (updated) refreshEditor();
}

/** "2-4" for two to four deposits on the map */
const formatDeposits = (good: Good) => (good.deposits ? good.deposits.join("-") : "");

function parseDeposits(cell: string): [number, number] {
  const [min, max = min] = cell.split("-").map(Number);
  return [min, max];
}

const formatDemandCoverage = (good: Good) =>
  Object.entries(good.demandCoverage || {})
    .map(([category, share]) => `${category}:${share}`)
    .join(";");

/** "food:1;luxury:0.5" as the demand coverage record; Goods.setProduction checks it */
function parseDemandCoverage(cell: string): Record<string, number> {
  const entries = cell
    .split(";")
    .map(entry => entry.trim())
    .filter(Boolean);
  return Object.fromEntries(
    entries.map(entry => {
      const [category, share, extra] = entry.split(":").map(part => part.trim());
      if (!category || !share || extra !== undefined || Number.isNaN(+share))
        throw new Error(t("Demand coverage is a list of category:share pairs, such as food:1;luxury:0.5"));
      return [category, +share];
    })
  );
}

function toggleDisplayedGood(good: Good, el: HTMLInputElement) {
  good.visible = el.checked;

  updateDisplayAllCheckbox();
  Layers.draw("goods");
}

function toggleAllDisplayed(this: HTMLInputElement) {
  const checked = this.checked;
  for (const good of goodsTable.view().all) good.visible = checked;

  ensureEl("goodsBody")
    .querySelectorAll<HTMLInputElement>(".goodDisplayed")
    .forEach(checkbox => {
      checkbox.checked = checked;
    });

  updateDisplayAllCheckbox();
  Layers.draw("goods");
}

function updateDisplayAllCheckbox() {
  const master = ensureEl<HTMLInputElement>("goodsDisplayAll");
  const goods = goodsTable.view().all;
  const total = goods.length;
  const visibleCount = getVisibleCount(goods);
  master.disabled = total === 0;
  master.checked = total > 0 && visibleCount === total;
  master.indeterminate = visibleCount > 0 && visibleCount < total;
  ensureEl("goodsDisplayed").innerHTML = String(getVisibleCount());
}

function removeGood(good: Good) {
  const message = `${t("Are you sure you want to remove the resource?")}<br>${t("This action cannot be reverted")}`;
  const onConfirm = () => {
    Dialog.close("goodEditor"); // it may be editing this good, or a recipe using it
    Goods.remove(good.i);
    States.pruneTariffs({ goods: [good.i] });
    Layers.draw("goods", "trade");
    refreshEditors();
  };
  Dialog.confirm({ title: t("Remove"), message, confirm: t("Remove"), onConfirm });
}

function closeGoodsEditor() {
  if (options.app.mode === "assignGoods") exitResourceAssignMode("close");
  production = {};
  depositsByGood = {};
  stockData = {};
  Dialog.destroy("goodsEditor");
}

export const GoodsEditor = { open, exportCsv: downloadGoodsData };
