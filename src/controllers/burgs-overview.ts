import { pack as packLayout, select, stratify } from "d3";
import { closeDialogs, confirmationDialog, updateDialog } from "@/components/dialog/dialog-helpers";
import { applyLineHighlighting } from "@/components/dialog/highlighting";
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
import { Layers } from "@/components/layers";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import type { Burg } from "@/generators/burgs-generator";
import { removeEmblem } from "@/renderers/draw-emblems";
import { downloadFile, getFileName, getHeight, getLatitude, getLongitude, uploadFile } from "@/utils";
import { convertTemperature, ensureEl, getTemperatureLikeness, rn, si } from "../utils";

type Filters = { stateId?: number | null; cultureId?: number | null };
type FilterState = { search: string; stateId: number; cultureId: number };

const dialogId = "burgsOverview" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
let filterState: FilterState;

const columns: EditorColumn<Burg>[] = [
  { key: "locate", width: "0.8em", permanent: true },
  {
    key: "name",
    label: "Burg",
    width: "8em",
    permanent: true,
    sortBy: b => b.name || "",
    sortType: "alpha"
  },
  {
    key: "province",
    label: "Province",
    width: "8em",
    hidden: true,
    mobileHidden: true,
    sortType: "alpha",
    sortBy: b => {
      const p = pack.cells.province[b.cell];
      return p ? pack.provinces[p]?.name || "" : "";
    }
  },
  {
    key: "state",
    label: "State",
    width: "8em",
    sortBy: b => pack.states[b.state!]?.name || "",
    sortType: "alpha"
  },
  {
    key: "culture",
    label: "Culture",
    width: "10em",
    mobileHidden: true,
    sortBy: b => pack.cultures[b.culture!]?.name || "",
    sortType: "alpha"
  },
  {
    key: "group",
    label: "Group",
    width: "6em",
    mobileHidden: true,
    sortBy: b => b.group || "",
    sortType: "alpha"
  },
  {
    key: "population",
    label: "Population",
    width: "7em",
    defaultSort: "desc",
    sortBy: b => b.population! * populationRate * urbanization
  },
  {
    key: "grossproduct",
    label: "Product",
    width: "6.5em",
    hidden: true,
    mobileHidden: true,
    sortBy: b => rn(b.product || 0, 2)
  },
  {
    key: "productpercapita",
    label: "Wealth",
    width: "6.5em",
    mobileHidden: true,
    tip: "Click to sort by burg wealth (gross product per capita)",
    sortBy: b => rn(b.population! > 0 ? (b.product || 0) / b.population! : 0, 2)
  },
  {
    key: "treasury",
    label: "Treasury",
    width: "6.5em",
    mobileHidden: true,
    sortBy: b => rn(b.treasury || 0, 2)
  },
  {
    key: "features",
    label: "Features",
    width: "6em",
    mobileHidden: true,
    sortType: "alpha",
    sortBy: b => (b.capital && b.port ? "a-capital-port" : b.capital ? "c-capital" : b.port ? "p-port" : "z-burg")
  },
  { key: "actions", width: "3.2em", permanent: true, align: "right" }
];

const burgsTable = initEditorTable<Burg>({
  getData: () => sortDataByColumns(dialogId, getFilteredBurgs(), columns),
  onUpdate: renderBurgsPage
});

function open(filters: Filters = {}): void {
  if (customization) return;
  filterState = dialogState.get(dialogId, "filters", () => ({ search: "", stateId: -1, cultureId: -1 }));
  closeDialogs(`#${dialogId}, .stable`);
  Layers.show("burgIcons", "labels");

  if (filters.stateId != null) filterState.stateId = filters.stateId;
  if (filters.cultureId != null) filterState.cultureId = filters.cultureId;
  renderDialog();
  updateFilter();
  updateLockAllIcon();
  burgsTable.reset();

  $(`#${dialogId}`).dialog({
    title: "Burgs Overview",
    resizable: false,
    close: closeBurgsOverview,
    width: "fit-content",
    position
  });
}

function renderDialog(): void {
  document.getElementById("burgsOverview")?.remove();
  const HTML = /* html */ `<div id="burgsOverview" class="dialog stable editorDialog">
      <div id="burgsBody" class="table">${renderEditorHeader({ dialogId, columns })}</div>
      <div id="burgsFilters" data-tip="Apply a filter" class="editorFilters">
        <label for="burgsSearch" data-tip="Filter by name, province, state, culture, or group"
          >Search: <input id="burgsSearch" type="search"
        /></label>
        <label for="burgsFilterState"
          >State:
          <select id="burgsFilterState"></select
        ></label>
        <label for="burgsFilterCulture"
          >Culture:
          <select id="burgsFilterCulture"></select
        ></label>
      </div>
      <div id="burgsFooter" class="totalLine">
        <div data-tip="Burgs displayed" style="margin-left: 5px">
          Burgs:&nbsp;<span id="burgsFooterBurgs">0 of 0</span>
        </div>
        <div data-tip="Average population" style="margin-left: 12px" data-col="population">
          Avg population:&nbsp;<span id="burgsFooterPopulation">0</span>
        </div>
        <div data-tip="Average gross product" style="margin-left: 12px" data-col="grossproduct">
          Avg product:&nbsp;<span id="burgsFooterGrossProduct">0</span> 🟡
        </div>
        <div data-tip="Average wealth (product per capita)" style="margin-left: 12px" data-col="productpercapita">
          Avg wealth:&nbsp;<span id="burgsFooterProductPerCapita">0</span> 🟡
        </div>
        <div data-tip="Average treasury" style="margin-left: 12px" data-col="treasury">
          Avg treasury:&nbsp;<span id="burgsFooterTreasury">0</span> 🟡
        </div>
      </div>
      <div id="burgsBottom" class="editorToolbar">
        <button id="burgsOverviewRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
        <button id="burgsGroupsEditorButton" data-tip="Edit burg groups" class="icon-cog"></button>
        <button id="burgsChart" data-tip="Show burgs bubble chart" class="icon-chart-area"></button>
        <button
          id="regenerateBurgNames"
          data-tip="Regenerate burg names based on assigned culture"
          class="icon-retweet"
        ></button>
        <button id="addNewBurg" data-tip="Add a new burg. Hold Shift to add multiple" class="icon-plus"></button>
        <button
          id="burgsExport"
          data-tip="Save burgs-related data as a text file (.csv)"
          class="icon-download"
        ></button>
        <button id="burgNamesImport" data-tip="Rename burgs in bulk" class="icon-upload"></button>
        <button id="burgsLockAll" data-tip="Lock or unlock all burgs" class="icon-lock"></button>
        <button
          id="burgsRemoveAll"
          data-tip="Remove all unlocked burgs except for capitals. To remove a capital remove its state first"
          class="icon-trash"
        ></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", HTML);
  ensureEl<HTMLInputElement>("burgsSearch").value = filterState.search;
  bindColumnSorting(dialogId, burgsTable.reset);
  applyLineHighlighting(dialogId, ({ target, cellId }) => {
    const burgId = pack.cells.burg[cellId];
    if (burgId) return burgId;
    const burg = target.closest<SVGElement>("#labels [data-label-type='burg'][data-id], #burgIcons [data-id]");
    return burg ? Number(burg.dataset.id) : undefined;
  });

  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });

  ensureEl("burgsOverviewRefresh").addEventListener("click", refreshBurgsEditor);
  ensureEl("burgsGroupsEditorButton").addEventListener("click", () => Controllers.BurgGroupEditor.open());
  ensureEl("burgsChart").addEventListener("click", showBurgsChart);
  ensureEl("burgsFilterState").addEventListener("change", onFilterChange);
  ensureEl("burgsFilterCulture").addEventListener("change", onFilterChange);
  ensureEl("burgsSearch").addEventListener("input", onFilterChange);
  ensureEl("regenerateBurgNames").addEventListener("click", regenerateNames);
  ensureEl("addNewBurg").addEventListener("click", () => void Controllers.BurgCreator.toggle());
  ensureEl("burgsExport").addEventListener("click", downloadBurgsData);
  ensureEl("burgNamesImport").addEventListener("click", renameBurgsInBulk);
  ensureEl("burgsListToLoad").addEventListener("change", function (this: HTMLInputElement) {
    uploadFile(this, importBurgNames);
  });
  ensureEl("burgsLockAll").addEventListener("click", toggleLockAll);
  ensureEl("burgsRemoveAll").addEventListener("click", triggerAllBurgsRemove);
}

function closeBurgsOverview(): void {
  if (document.getElementById("addBurgTool")?.classList.contains("pressed")) void Controllers.BurgCreator.stop();
  $("#burgsOverview").dialog("destroy");
  ensureEl("burgsOverview").remove();
}

function refreshBurgsEditor(): void {
  updateFilter();
  burgsTable.reset();
}

function updateFilter(): void {
  const stateFilter = ensureEl<HTMLSelectElement>("burgsFilterState");
  const validStateIds = new Set(pack.states.filter(state => !state.removed).map(state => state.i));
  if (!validStateIds.has(filterState.stateId)) filterState.stateId = -1;
  stateFilter.options.length = 0; // remove all options
  stateFilter.options.add(new Option("all", "-1", false, filterState.stateId === -1));
  stateFilter.options.add(new Option(pack.states[0].name, "0", false, filterState.stateId === 0));
  const statesSorted = pack.states.filter(s => s.i && !s.removed).sort((a, b) => (a.name > b.name ? 1 : -1));
  statesSorted.forEach(
    s => void stateFilter.options.add(new Option(s.name, String(s.i), false, s.i === filterState.stateId))
  );

  const cultureFilter = ensureEl<HTMLSelectElement>("burgsFilterCulture");
  const validCultureIds = new Set(pack.cultures.filter(culture => !culture.removed).map(culture => culture.i));
  if (!validCultureIds.has(filterState.cultureId)) filterState.cultureId = -1;
  cultureFilter.options.length = 0; // remove all options
  cultureFilter.options.add(new Option(`all`, "-1", false, filterState.cultureId === -1));
  cultureFilter.options.add(new Option(pack.cultures[0].name, "0", false, filterState.cultureId === 0));
  const culturesSorted = pack.cultures.filter(c => c.i && !c.removed).sort((a, b) => (a.name > b.name ? 1 : -1));
  culturesSorted.forEach(
    c => void cultureFilter.options.add(new Option(c.name, String(c.i), false, c.i === filterState.cultureId))
  );
  dialogState.set(dialogId, "filters", filterState);
}

function onFilterChange(): void {
  filterState.search = ensureEl<HTMLInputElement>("burgsSearch").value;
  filterState.stateId = +ensureEl<HTMLSelectElement>("burgsFilterState").value;
  filterState.cultureId = +ensureEl<HTMLSelectElement>("burgsFilterCulture").value;
  dialogState.set(dialogId, "filters", filterState);
  burgsTable.reset();
}

function getFilteredBurgs(): Burg[] {
  const searchText = filterState.search.toLowerCase().trim();

  let filtered = pack.burgs.filter(b => b.i && !b.removed);

  if (searchText) {
    // filter by search text
    filtered = filtered.filter(b => {
      const name = b.name!.toLowerCase();
      const state = (pack.states[b.state!]?.name || "").toLowerCase();
      const prov = pack.cells.province[b.cell];
      const province = prov ? pack.provinces[prov]?.name.toLowerCase() : "";
      const culture = (pack.cultures[b.culture!]?.name || "").toLowerCase();
      return (
        name.includes(searchText) ||
        state.includes(searchText) ||
        province.includes(searchText) ||
        culture.includes(searchText) ||
        b.group!.toLowerCase().includes(searchText)
      );
    });
  }
  if (filterState.stateId !== -1) filtered = filtered.filter(b => b.state === filterState.stateId); // filtered by state
  if (filterState.cultureId !== -1) filtered = filtered.filter(b => b.culture === filterState.cultureId); // filtered by culture
  return filtered;
}

// totals and footer span the full filtered set, not just the current page
function renderBurgsPage(view: TableView<Burg>): void {
  const body = ensureEl("burgsBody");
  const validCount = pack.burgs.filter(b => b.i && !b.removed).length;

  body.querySelectorAll(":scope > .states").forEach(row => {
    row.remove();
  });
  let lines = "";
  let totalPopulation = 0;
  let totalProduct = 0;
  let totalProductPerCapita = 0;
  let totalTreasury = 0;

  for (const b of view.all) {
    const population = b.population! * populationRate * urbanization;
    const grossProduct = rn(b.product || 0, 2);
    const productPerCapita = rn(b.population! > 0 ? (b.product || 0) / b.population! : 0, 2);
    const treasury = rn(b.treasury || 0, 2);
    totalPopulation += population;
    totalProduct += grossProduct;
    totalProductPerCapita += productPerCapita;
    totalTreasury += treasury;
  }

  for (const b of view.rows) {
    const population = b.population! * populationRate * urbanization;
    const grossProduct = rn(b.product || 0, 2);
    const productPerCapita = rn(b.population! > 0 ? (b.product || 0) / b.population! : 0, 2);
    const treasury = rn(b.treasury || 0, 2);
    const features = b.capital && b.port ? "a-capital-port" : b.capital ? "c-capital" : b.port ? "p-port" : "z-burg";
    const state = pack.states[b.state!].name;
    const prov = pack.cells.province[b.cell];
    const province = prov ? pack.provinces[prov].name : "";
    const culture = pack.cultures[b.culture!].name;

    lines += /* html */ `<div
        class="states"
        data-id=${b.i}
        data-name="${b.name}"
        data-state="${state}"
        data-province="${province}"
        data-culture="${culture}"
        data-group="${b.group}"
        data-population=${population}
        data-grossproduct=${grossProduct}
        data-productpercapita=${productPerCapita}
        data-treasury=${treasury}
        data-features="${features}"
      >
        <span data-tip="Click to zoom into view" class="icon-dot-circled pointer" data-col="locate"></span>
        <input data-tip="Burg name" class="burgName" value="${b.name}" data-col="name" disabled />
        <input data-tip="Burg province" value="${province}" data-col="province" disabled />
        <input data-tip="Burg state" value="${state}" data-col="state" disabled />
        <input data-tip="Dominant culture" value="${culture}" data-col="culture" disabled />
        <input data-tip="Burg group" value="${b.group}" data-col="group" disabled />
        <div data-col="population">
          <span data-tip="Burg population" class="icon-male"></span>
          <input data-tip="Burg population" value=${si(population)} disabled />
        </div>
        <div data-col="grossproduct">
          <span data-tip="Gross Product: local sale revenue minus purchased ingredient costs during the production.">🟡</span>
          <input data-tip="Gross Product: local sale revenue minus purchased ingredient costs during the production." value=${grossProduct} disabled />
        </div>
        <div data-col="productpercapita">
          <span data-tip="Wealth: gross product divided by population">🟡</span>
          <input data-tip="Wealth: gross product divided by population" value=${productPerCapita} disabled />
        </div>
        <div data-col="treasury">
          <span data-tip="Treasury: accumulated cash balance">🟡</span>
          <input data-tip="Treasury: accumulated cash balance" value=${treasury} disabled />
        </div>
        <div data-col="features">
          <span
            data-tip="${b.capital ? " This burg is a state capital" : "This burg is a NOT state capital"}"
            class="icon-star-empty${b.capital ? "" : " inactive"}" style="padding: 0 1px;"></span>
          <span data-tip="${b.port ? " This burg is a port" : "This burg is NOT a port"}"
          class="icon-anchor${b.port ? "" : " inactive"}" style="font-size: .9em; padding: 0 1px;"></span>
        </div>
        <div data-col="actions">
          <span data-tip="Edit burg" class="icon-pencil"></span>
          <span class="locks pointer ${
            b.lock ? "icon-lock" : "icon-lock-open inactive"
          }" onmouseover="showElementLockTip(event)"></span>
          <span data-tip="Remove burg" class="icon-trash-empty"></span>
        </div>
      </div>`;
  }
  body.insertAdjacentHTML("beforeend", lines);

  ensureEl("burgsFooterBurgs").innerHTML = `${view.all.length} of ${validCount}`;
  ensureEl("burgsFooterPopulation").innerHTML = view.all.length ? si(totalPopulation / view.all.length) : "0";
  ensureEl("burgsFooterGrossProduct").innerHTML = view.all.length ? String(rn(totalProduct / view.all.length, 2)) : "0";
  ensureEl("burgsFooterProductPerCapita").innerHTML = view.all.length
    ? String(rn(totalProductPerCapita / view.all.length, 2))
    : "0";
  ensureEl("burgsFooterTreasury").innerHTML = view.all.length ? String(rn(totalTreasury / view.all.length, 2)) : "0";

  renderEditorPagination(ensureEl("burgsFooter"), view, burgsTable.goto);

  // add listeners
  body.querySelectorAll("div.states").forEach(el => void el.addEventListener("mouseenter", ev => burgHighlightOn(ev)));
  body.querySelectorAll("div.states").forEach(el => void el.addEventListener("mouseleave", () => burgHighlightOff()));
  body.querySelectorAll("div > span.icon-dot-circled").forEach(el => void el.addEventListener("click", zoomIntoBurg));
  body.querySelectorAll("div > span.locks").forEach(el => void el.addEventListener("click", toggleBurgLockStatus));
  body.querySelectorAll("div > span.icon-pencil").forEach(el => void el.addEventListener("click", openBurgEditor));
  body
    .querySelectorAll("div > span.icon-trash-empty")
    .forEach(el => void el.addEventListener("click", triggerBurgRemove));
}

function burgHighlightOn(event: Event): void {
  const burg = +(event.target as HTMLElement).dataset.id!;
  const label = select("#labels").select(`[data-label-type='burg'][data-id='${burg}']`);
  if (label.size()) label.classed("drag", true);
}

function burgHighlightOff(): void {
  select("#labels").selectAll("text[data-label-type='burg'].drag").classed("drag", false);
}

function zoomIntoBurg(this: HTMLElement): void {
  const burg = +(this.closest(".states") as HTMLElement).dataset.id!;
  const { x, y } = pack.burgs[burg];
  zoomTo(x, y, 8, 2000);
}

function toggleBurgLockStatus(this: HTMLElement): void {
  const burgId = +(this.closest(".states") as HTMLElement).dataset.id!;

  const burg = pack.burgs[burgId];
  burg.lock = !burg.lock;

  if (this.classList.contains("icon-lock")) {
    this.classList.remove("icon-lock");
    this.classList.add("icon-lock-open");
    this.classList.add("inactive");
  } else {
    this.classList.remove("icon-lock-open");
    this.classList.add("icon-lock");
    this.classList.remove("inactive");
  }
}

function openBurgEditor(this: HTMLElement): void {
  const burg = +(this.closest(".states") as HTMLElement).dataset.id!;
  Controllers.BurgEditor.open(burg);
}

function triggerBurgRemove(this: HTMLElement): void {
  const burgId = +(this.closest(".states") as HTMLElement).dataset.id!;
  if (pack.burgs[burgId].capital) {
    tip("You cannot remove the capital. Please change the state capital first", false, "error");
    return;
  }

  confirmationDialog({
    title: "Remove burg",
    message: "Are you sure you want to remove the burg? <br>This action cannot be reverted",
    confirm: "Remove",
    onConfirm: () => {
      Burgs.remove(burgId);
      removeEmblem("burg", burgId);
      burgsTable.refresh();
      Layers.draw("burgIcons", "labels");
    }
  });
}

function regenerateNames(): void {
  // regenerate across the full filtered set (all pages), not just the visible page
  for (const b of getFilteredBurgs()) {
    if (b.lock) continue;
    b.name = Names.getCulture(b.culture!);
  }

  burgsTable.refresh();
  Layers.draw("labels");
}

function showBurgsChart(): void {
  // build hierarchy tree
  const states = pack.states.map(s => {
    const color = s.color ? s.color : "#ccc";
    const name = s.fullName ? s.fullName : s.name;
    return { id: s.i, state: s.i ? 0 : null, color, name };
  });

  const burgs = pack.burgs
    .filter(b => b.i && !b.removed)
    .map(b => {
      const id = b.i + states.length - 1;
      const population = b.population;
      const capital = b.capital;
      const province = pack.cells.province[b.cell];
      const parent = province ? province + states.length - 1 : b.state;
      return {
        id,
        i: b.i,
        state: b.state,
        culture: b.culture,
        province,
        parent,
        name: b.name,
        population,
        capital,
        x: b.x,
        y: b.y
      };
    });
  const data: any[] = (states as any[]).concat(burgs);
  if (data.length < 2) {
    tip("No burgs to show", false, "error");
    return;
  }

  const root = (stratify() as any)
    .parentId((d: any) => d.state)(data)
    .sum((d: any) => d.population)
    .sort((a: any, b: any) => b.value - a.value);

  const uiSize = ensureEl<HTMLInputElement>("uiSize").valueAsNumber;
  const width = 150 + 200 * uiSize;
  const height = 150 + 200 * uiSize;
  const margin = { top: 0, right: -50, bottom: -10, left: -50 };
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;
  const treeLayout = packLayout().size([w, h]).padding(3);

  // prepare svg
  alertMessage.innerHTML = /* html */ `<select id="burgsTreeType" style="display:block; margin-left:13px; font-size:11px">
      <option value="states" selected>Group by state</option>
      <option value="cultures">Group by culture</option>
      <option value="parent">Group by province and state</option>
      <option value="provinces">Group by province</option>
    </select>`;
  alertMessage.innerHTML += `<div id='burgsInfo' class='chartInfo'>&#8205;</div>`;
  const svg = select("#alertMessage")
    .insert("svg", "#burgsInfo")
    .attr("id", "burgsTree")
    .attr("width", width)
    .attr("height", height - 10)
    .attr("stroke-width", 2);
  const graph = svg.append("g").attr("transform", `translate(-50, -10)`);
  ensureEl("burgsTreeType").addEventListener("change", updateChart);

  treeLayout(root);

  const node = graph
    .selectAll("circle")
    .data(root.leaves())
    .join("circle")
    .attr("data-id", (d: any) => d.data.i)
    .attr("r", (d: any) => d.r)
    .attr("fill", (d: any) => d.parent.data.color)
    .attr("cx", (d: any) => d.x)
    .attr("cy", (d: any) => d.y)
    .on("mouseenter", (event: any, d: any) => showInfo(event, d))
    .on("mouseleave", (event: any) => hideInfo(event))
    .on("click", (_event: any, d: any) => zoomTo(d.data.x, d.data.y, 8, 2000));

  function showInfo(ev: any, d: any): void {
    select(ev.target).transition().duration(1500).attr("stroke", "#c13119");
    const name = d.data.name;
    const parent = d.parent.data.name;
    const population = si(d.value * populationRate * urbanization);

    ensureEl("burgsInfo").innerHTML = /* html */ `${name}. ${parent}. Population: ${population}`;
    burgHighlightOn(ev);
    tip("Click to zoom into view");
  }

  function hideInfo(ev: any): void {
    burgHighlightOff();
    if (!ensureEl("burgsInfo")) return;
    ensureEl("burgsInfo").innerHTML = "&#8205;";
    select(ev.target).transition().attr("stroke", null);
    tip("");
  }

  function updateChart(this: HTMLSelectElement): void {
    const getStatesData = () =>
      pack.states.map(s => {
        const color = s.color ? s.color : "#ccc";
        const name = s.fullName ? s.fullName : s.name;
        return { id: s.i, state: s.i ? 0 : null, color, name };
      });

    const getCulturesData = () =>
      pack.cultures.map(c => {
        const color = c.color ? c.color : "#ccc";
        return { id: c.i, culture: c.i ? 0 : null, color, name: c.name };
      });

    const getParentData = () => {
      const states = pack.states.map(s => {
        const color = s.color ? s.color : "#ccc";
        const name = s.fullName ? s.fullName : s.name;
        return { id: s.i, parent: s.i ? 0 : null, color, name };
      });
      const provinces = pack.provinces
        .filter(p => p.i && !p.removed)
        .map(p => {
          return { id: p.i + states.length - 1, parent: p.state, color: p.color, name: p.fullName };
        });
      return (states as any[]).concat(provinces);
    };

    const getProvincesData = () =>
      pack.provinces.map(p => {
        const color = p.color ? p.color : "#ccc";
        const name = p.fullName ? p.fullName : p.name;
        return { id: p.i ? p.i : 0, province: p.i ? 0 : null, color, name };
      });

    const value = (d: any) => {
      if (this.value === "states") return d.state;
      if (this.value === "cultures") return d.culture;
      if (this.value === "parent") return d.parent;
      if (this.value === "provinces") return d.province;
    };

    const mapping: Record<string, () => any[]> = {
      states: getStatesData,
      cultures: getCulturesData,
      parent: getParentData,
      provinces: getProvincesData
    };

    const base = mapping[this.value]();
    burgs.forEach(b => {
      b.id = b.i + base.length - 1;
    });

    const data: any[] = base.concat(burgs);

    const root = (stratify() as any)
      .parentId((d: any) => value(d))(data)
      .sum((d: any) => d.population)
      .sort((a: any, b: any) => b.value - a.value);

    node
      .data((treeLayout(root) as any).leaves())
      .transition()
      .duration(2000)
      .attr("data-id", (d: any) => d.data.i)
      .attr("fill", (d: any) => d.parent.data.color)
      .attr("cx", (d: any) => d.x)
      .attr("cy", (d: any) => d.y)
      .attr("r", (d: any) => d.r);
  }

  $("#alert").dialog({
    title: "Burgs bubble chart",
    width: "fit-content",
    position: { my: "left bottom", at: "left+10 bottom-10", of: "svg" },
    buttons: {},
    close: () => (alertMessage.innerHTML = "")
  });
}

function downloadBurgsData(): void {
  let data = `Id,Burg,Province,Province Full Name,State,State Full Name,Culture,Religion,Group,Population,X,Y,Latitude,Longitude,Elevation (${heightUnit.value}),Temperature,Temperature likeness,Capital,Port,Citadel,Walls,Plaza,Temple,Shanty Town,Emblem,Preview link\n`; // headers
  const valid = pack.burgs.filter(b => b.i && !b.removed); // all valid burgs

  valid.forEach(b => {
    data += `${b.i},`;
    data += `${b.name},`;
    const province = pack.cells.province[b.cell];
    data += province ? `${pack.provinces[province].name},` : ",";
    data += province ? `${pack.provinces[province].fullName},` : ",";
    data += `${pack.states[b.state!].name},`;
    data += `${pack.states[b.state!].fullName},`;
    data += `${pack.cultures[b.culture!].name},`;
    data += `${pack.religions[pack.cells.religion[b.cell]].name},`;
    data += `${b.group},`;
    data += `${rn(b.population! * populationRate * urbanization)},`;

    // add geography data
    data += `${b.x},`;
    data += `${b.y},`;
    data += `${getLatitude(b.y, mapCoordinates, graphHeight, 2)},`;
    data += `${getLongitude(b.x, mapCoordinates, graphWidth, 2)},`;
    data += `${parseInt(getHeight(pack.cells.h[b.cell]), 10)},`;
    const temperature = grid.cells.temp[pack.cells.g[b.cell]];
    data += `${convertTemperature(temperature)},`;
    data += `${getTemperatureLikeness(temperature)},`;

    // add status data
    data += b.capital ? "capital," : ",";
    data += b.port ? "port," : ",";
    data += b.citadel ? "citadel," : ",";
    data += b.walls ? "walls," : ",";
    data += b.plaza ? "plaza," : ",";
    data += b.temple ? "temple," : ",";
    data += b.shanty ? "shanty town," : ",";
    data += b.coa ? `${JSON.stringify(b.coa).replace(/"/g, "").replace(/,/g, ";")},` : ",";
    data += Burgs.getPreview(b).link;

    data += "\n";
  });

  const name = `${getFileName("Burgs")}.csv`;
  downloadFile(data, name);
}

function renameBurgsInBulk(): void {
  alertMessage.innerHTML = /* html */ `Download burgs list as a text file, make changes and re-upload the file. Make sure the file is a plain text document with each
    name on its own line (the dilimiter is CRLF). If you do not want to change the name, just leave it as is`;

  $("#alert").dialog({
    title: "Burgs bulk renaming",
    width: "22em",
    position: { my: "center", at: "center", of: "svg" },
    buttons: {
      Download: () => {
        const data = pack.burgs
          .filter(b => b.i && !b.removed)
          .map(b => b.name)
          .join("\r\n");
        const name = `${getFileName("Burg names")}.txt`;
        downloadFile(data, name);
      },
      Upload: () => ensureEl("burgsListToLoad").click(),
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function importBurgNames(dataLoaded: string): void {
  if (!dataLoaded) {
    tip("Cannot load the file, please check the format", false, "error");
    return;
  }
  const data = dataLoaded
    .replace(/\r\n|\r/g, "\n")
    .split("\n")
    .filter(Boolean);
  if (!data.length) {
    tip("Cannot parse the list, please check the file format", false, "error");
    return;
  }

  const change: { id: number; name: string }[] = [];
  let message = `Burgs to be renamed as below:`;
  message += `<table class="overflow-table"><tr><th>Id</th><th>Current name</th><th>New Name</th></tr>`;

  const burgs = pack.burgs.filter(b => b.i && !b.removed);
  for (let i = 0; i < data.length && i <= burgs.length; i++) {
    const v = data[i];
    if (!v || !burgs[i] || v === burgs[i].name) continue;
    change.push({ id: burgs[i].i, name: v });
    message += `<tr><td style="width:20%">${burgs[i].i}</td><td style="width:40%">${burgs[i].name}</td><td style="width:40%">${v}</td></tr>`;
  }
  message += `</tr></table>`;

  if (!change.length) message = "No changes found in the file. Please change some names to get a result";
  alertMessage.innerHTML = message;

  const onConfirm = () => {
    for (let i = 0; i < change.length; i++) {
      const id = change[i].id;
      pack.burgs[id].name = change[i].name;
    }
    burgsTable.refresh();
    Layers.draw("labels");
  };

  confirmationDialog({
    title: "Burgs bulk renaming",
    message,
    confirm: "Rename",
    onConfirm
  });
}

function triggerAllBurgsRemove(): void {
  const number = pack.burgs.filter(b => b.i && !b.removed && !b.capital && !b.lock).length;
  confirmationDialog({
    title: `Remove ${number} burgs`,
    message: `
        Are you sure you want to remove all <i>unlocked</i> burgs except for capitals?
        <br><i>To remove a capital you have to remove its state first</i>`,
    confirm: "Remove",
    onConfirm: () => {
      pack.burgs
        .filter(b => b.i && !(b.capital || b.lock))
        .forEach(b => {
          Burgs.remove(b.i);
          removeEmblem("burg", b.i);
        });
      burgsTable.refresh();
      Layers.draw("burgIcons", "labels");
    }
  });
}

function toggleLockAll(): void {
  const activeBurgs = pack.burgs.filter(b => b.i && !b.removed);
  const allLocked = activeBurgs.every(burg => burg.lock);

  activeBurgs.forEach(burg => {
    burg.lock = !allLocked;
  });

  burgsTable.refresh();
  ensureEl("burgsLockAll").className = allLocked ? "icon-lock" : "icon-lock-open";
}

function updateLockAllIcon(): void {
  const allLocked = pack.burgs.every(({ lock, i, removed }) => lock || !i || removed);
  ensureEl("burgsLockAll").className = allLocked ? "icon-lock-open" : "icon-lock";
}

export const BurgsOverview = { open };
