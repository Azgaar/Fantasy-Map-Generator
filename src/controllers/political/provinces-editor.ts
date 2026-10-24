import { color as d3Color, easeSinIn, interpolate, select, stratify, transition, treemap } from "d3";
import { Controllers } from "@/controllers";
import type { Burg } from "@/model/political/burgs-generator";
import type { Province } from "@/model/political/provinces-generator";
import { Provinces } from "@/model/political/provinces-generator";
import { Names } from "@/model/society/names-generator";
import { Tags } from "@/model/tags";
import { getArea, getAreaUnit } from "@/model/units";
import { redrawEmblem, redrawEmblems, removeEmblem } from "@/renderers/draw-emblems";
import { EmblemRenderer } from "@/renderers/emblems/renderer";
import { Layers } from "@/renderers/layers";
import { fog, unfog } from "@/renderers/overlays/fogging";
import { Csv } from "@/services/io/csv";
import { speak } from "@/services/speech";
import { Dialog } from "@/ui/dialog/dialog";
import { noteIcon } from "@/ui/dialog/dialog-helpers";
import { applyLineHighlighting } from "@/ui/dialog/highlighting";
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
import type { FillBoxElement } from "@/ui/elements/fill-box";
import { createAnnexMode } from "@/ui/map/annex-mode";
import { highlightElement, highlightOutline } from "@/ui/map/highlight";
import { applyDefaultViewboxEvents } from "@/ui/map/viewbox-events";
import { zoomTo } from "@/ui/map/zoom";
import { clearMainTip, tip } from "@/ui/tooltips";
import { groupByValue, unique } from "@/utils/array-utils";
import { getRandomColor } from "@/utils/color-utils";
import { isLand } from "@/utils/height-utils";
import { sentences, t } from "@/utils/i18n";
import { applyOption, ensureEl, findEl, getPointer } from "@/utils/node-utils";
import { rn, si } from "@/utils/number-utils";
import { rand } from "@/utils/probability-utils";
import { errorText } from "@/utils/string-utils";

const dialogId = "provincesEditor" as const;
const CSV_COLUMNS = [
  "Id",
  "Province",
  "Full Name",
  "Form",
  "State",
  "Color",
  "Capital",
  "Area",
  "Total Population",
  "Rural Population",
  "Urban Population",
  "Burgs",
  "Tags"
];
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
let filterState: { stateId: number; search?: string };

const getProvinceArea = (province: Province) => getArea(province.area!);
const getProvincePopulation = (province: Province) =>
  rn(
    province.rural! * options.map.units.population.scale +
      province.urban! * options.map.units.population.scale * options.map.units.population.urbanization.rate
  );
const columns: EditorColumn<Province>[] = [
  { key: "color", width: "1.2em", permanent: true },
  {
    key: "name",
    label: t("Province"),
    width: "7em",
    permanent: true,
    sortBy: province => province.name || "",
    sortType: "alpha"
  },
  { key: "emblem", width: "1.4em" },
  {
    key: "form",
    label: t("Form"),
    width: "7em",
    mobileHidden: true,
    sortBy: province => province.formName || "",
    sortType: "alpha"
  },
  {
    key: "capital",
    label: t("Capital"),
    width: "7em",
    sortBy: province => (province.burg ? pack.burgs[province.burg]?.name || "" : ""),
    sortType: "alpha"
  },
  {
    key: "state",
    label: t("State"),
    width: "7em",
    permanent: true,
    sortBy: province => pack.states[province.state]?.name || "",
    sortType: "alpha"
  },
  {
    key: "burgs",
    label: t("Burgs"),
    width: "5em",
    mobileHidden: true,
    sortBy: province => province.burgs?.length || 0
  },
  {
    key: "area",
    label: t("Area"),
    width: "7em",
    mobileHidden: true,
    defaultSort: "desc",
    sortBy: getProvinceArea
  },
  { key: "population", label: t("Population"), width: "6em", sortBy: getProvincePopulation },
  {
    key: "tags",
    label: t("Tags"),
    width: "10em",
    hidden: true,
    sortBy: province => Tags.format(province.tags),
    sortType: "alpha"
  },
  { key: "note", width: "1.1em" },
  { key: "independence", width: "1.1em" },
  { key: "locate", width: "1.1em" },
  { key: "focus", width: "1.1em" },
  { key: "lock", width: "1.1em" },
  { key: "remove", width: "1.4em", permanent: true }
];
const provincesTable = initEditorTable<Province>({ getData: getProvincesData, onUpdate: renderProvincesPage });

function open(): void {
  if (options.app.mode) return;
  filterState = dialogState.get(dialogId, "filters", () => ({ stateId: 1, search: "" }));
  Dialog.closeAll("#provincesEditor, .stable");
  Layers.show("provinces", "borders");
  Layers.hide("states", "cultures");

  renderDialog();
  refreshProvincesEditor();

  Dialog.open("provincesEditor", {
    title: t("Provinces Editor"),
    width: "fit-content",
    onClose: closeProvincesEditor,
    position
  });
}

function onSearchInput(): void {
  filterState.search = ensureEl<HTMLInputElement>("provincesSearch").value;
  dialogState.set(dialogId, "filters", filterState);
  provincesTable.reset();
}

function renderDialog(): void {
  Dialog.destroy("provincesEditor");
  const editorHtml = /* html */ `<div id="provincesEditor" class="dialog stable editorDialog">
      <div id="provincesBodySection" class="table" data-type="absolute">
        ${renderEditorHeader({ dialogId, columns })}
      </div>
      <div id="provincesFilters" data-tip="${t("Apply a filter")}" class="editorFilters">
        <label for="provincesSearch" data-tip="${t("Filter by name, form, capital, state, or tag")}">
          ${t("Search")}: <input id="provincesSearch" type="search" />
        </label>
      </div>
      <div id="provincesFooter" class="totalLine">
        <div data-tip="${t("Provinces displayed")}" style="margin-left: 4px">
          ${t("Provinces")}:&nbsp;<span id="provincesFooterNumber">0</span>
        </div>
        <div data-tip="${t("Number of burgs")}" style="margin-left: 12px" data-col="burgs">
          ${t("Burgs")}:&nbsp;<span id="provincesFooterBurgs">0</span>
        </div>
        <div data-tip="${t("Average area")}" style="margin-left: 14px" data-col="area">
          ${t("Mean area")}:&nbsp;<span id="provincesFooterArea">0</span>
        </div>
        <div data-tip="${t("Average population")}" style="margin-left: 14px" data-col="population">
          ${t("Mean population")}:&nbsp;<span id="provincesFooterPopulation">0</span>
        </div>
      </div>
      <div id="provincesBottom" class="editorToolbar">
        <button id="provincesEditorRefresh" data-tip="${t("Refresh")}" class="icon-cw"></button>
        <button id="provincesEditStyle" data-tip="${t("Edit style in Style Editor")}" class="icon-adjust"></button>
        <button
          id="provincesRecolor"
          data-tip="${t("Recolor listed provinces based on state color")}"
          class="icon-paint-roller"
        ></button>
        <button
          id="provincesPercentage"
          data-tip="${t("Toggle percentage / absolute values views")}"
          class="icon-percent"
        ></button>
        <button id="provincesChart" data-tip="${t("Provinces chart")}" class="icon-chart-area"></button>
        <button
          id="provincesExport"
          data-tip="${t("Save data as a CSV file")}"
          class="icon-download"
        ></button>
        <button id="provincesImport" data-tip="${t("Upload data from a CSV file")}" class="icon-upload"></button>
        <button id="provincesManually" data-tip="${t("Manually re-assign provinces")}" class="icon-brush"></button>
        <button
          id="provincesRelease"
          data-tip="${t("Release all provinces. It will make all provinces with burgs independent")}"
          class="icon-flag"
        ></button>
        <button
          id="provincesAdd"
          data-tip="${sentences(t("Add"), t("Hold Shift to add multiple"))}"
          class="icon-plus"
        ></button>
        <button id="provincesMerge" data-tip="${t("Merge several provinces into one")}" class="icon-layer-group"></button>
        <button
          id="provincesAnnex"
          data-tip="${sentences(t("Annex provinces: click the annexing province, then the provinces of the same state it absorbs"), t("Hold Shift to keep annexing"))}"
          class="icon-crown"
        ></button>
        <button
          id="provincesRemoveAll"
          data-tip="${sentences(t("Remove all provinces"), t("States will remain as they are"))}"
          class="icon-trash"
        ></button>
        <span>${t("State")}: </span>
        <select id="provincesFilterState"></select>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  const searchInput = ensureEl<HTMLInputElement>("provincesSearch");
  searchInput.value = filterState.search ?? "";
  searchInput.addEventListener("input", onSearchInput);
  bindColumnSorting(dialogId, provincesTable.reset);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => Dialog.update(dialogId, { width: "fit-content", position })
  });
  applyLineHighlighting("provincesEditor", ({ cellId }) => pack.cells.province[cellId]);

  ensureEl("provincesEditorRefresh").addEventListener("click", refreshProvincesEditor);
  ensureEl("provincesEditStyle").addEventListener("click", () => void Controllers.StyleEditor.open("provinces"));
  ensureEl("provincesFilterState").addEventListener("change", event => {
    filterState.stateId = +(event.target as HTMLSelectElement).value;
    dialogState.set(dialogId, "filters", filterState);
    provincesTable.reset();
  });
  ensureEl("provincesPercentage").addEventListener("click", togglePercentageMode);
  ensureEl("provincesChart").addEventListener("click", showChart);
  ensureEl("provincesExport").addEventListener("click", downloadProvincesData);
  ensureEl("provincesImport").addEventListener("click", () => Csv.pick(uploadProvincesCsv));
  ensureEl("provincesRemoveAll").addEventListener("click", removeAllProvinces);
  ensureEl("provincesManually").addEventListener("click", openPaintEditor);
  ensureEl("provincesRelease").addEventListener("click", triggerProvincesRelease);
  ensureEl("provincesAdd").addEventListener("click", enterAddProvinceMode);
  ensureEl("provincesMerge").addEventListener("click", openProvinceMergeDialog);
  ensureEl("provincesAnnex").addEventListener("click", provincesAnnex.toggle);
  ensureEl("provincesRecolor").addEventListener("click", recolorProvinces);

  ensureEl("provincesBodySection").addEventListener("click", (ev: Event) => {
    if (options.app.mode) return;
    const el = ev.target as HTMLElement;
    const cl = el.classList;
    const line = el.closest<HTMLElement>(".states");
    if (!line) return;
    const p = +line.dataset.id!;
    const stateId = pack.provinces[p].state;

    if (el.tagName === "FILL-BOX") changeFill(el as FillBoxElement);
    else if (cl.contains("name")) editProvinceName(p);
    else if (cl.contains("coaIcon"))
      void Controllers.EmblemsEditor.open("province", `provinceCOA${p}`, pack.provinces[p]);
    else if (cl.contains("icon-star-empty")) capitalZoomIn(p);
    else if (cl.contains("icon-flag-empty")) triggerIndependencePromps(p);
    else if (cl.contains("icon-dot-circled")) void Controllers.BurgsOverview.open({ stateId });
    else if (cl.contains("culturePopulation")) changePopulation(p);
    else if (cl.contains("icon-target"))
      highlightElement(select<SVGGElement, unknown>("#provs").select(`#province${p}`).node() as Element, 8);
    else if (cl.contains("icon-pin")) toggleFog(p, cl);
    else if (cl.contains("icon-book")) void Controllers.NotesEditor.open({ type: "province", id: p });
    else if (cl.contains("icon-trash-empty")) removeProvince(p);
    else if (cl.contains("icon-lock") || cl.contains("icon-lock-open")) updateLockStatus(p, cl);
  });

  ensureEl("provincesBodySection").addEventListener("change", (ev: Event) => {
    const el = ev.target as HTMLSelectElement;
    const cl = el.classList;
    const line = el.closest<HTMLElement>(".states");
    if (!line) return;
    const p = +line.dataset.id!;
    if (cl.contains("cultureBase")) changeCapital(p, line, el.value);
  });
}

function refreshProvincesEditor(): void {
  collectStatistics();
  updateFilter();
  provincesTable.reset();
}

function collectStatistics(): void {
  const { cells, provinces, burgs } = pack;

  provinces.forEach(p => {
    if (!p.i || p.removed) return;
    p.area = p.rural = p.urban = 0;
    p.burgs = [];
    if ((p.burg && !burgs[p.burg]) || burgs[p.burg]?.removed) p.burg = 0;
  });

  for (const i of cells.i) {
    const p = cells.province[i];
    if (!p) continue;

    provinces[p].area! += cells.area[i];
    provinces[p].rural! += cells.pop[i];
    if (!cells.burg[i]) continue;
    provinces[p].urban! += burgs[cells.burg[i]].population ?? 0;
    provinces[p].burgs!.push(cells.burg[i]);
  }

  provinces.forEach(p => {
    if (!p.i || p.removed) return;
    if (!p.burg && p.burgs!.length) p.burg = p.burgs![0];
  });
}

function updateFilter(): void {
  const stateFilter = ensureEl<HTMLSelectElement>("provincesFilterState");
  if (filterState.stateId !== -1 && !pack.states.some(s => s.i === filterState.stateId && !s.removed)) {
    filterState.stateId = -1;
  }
  stateFilter.options.length = 0; // remove all options
  stateFilter.options.add(new Option(t("All"), "-1", false, filterState.stateId === -1));
  const statesSorted = pack.states.filter(s => s.i && !s.removed).sort((a, b) => (a.name > b.name ? 1 : -1));
  statesSorted.forEach(s => {
    stateFilter.options.add(new Option(s.name, String(s.i), false, s.i === filterState.stateId));
  });
  dialogState.set(dialogId, "filters", filterState);
}

function getProvincesData(): Province[] {
  const provinces = pack.provinces.filter(province => province.i && !province.removed);
  let filtered =
    filterState.stateId === -1 ? provinces : provinces.filter(province => province.state === filterState.stateId);
  const searchText = filterState?.search?.toLowerCase().trim();
  if (searchText) {
    filtered = filtered.filter(p => {
      const capital = p.burg ? pack.burgs[p.burg]?.name : "";
      const state = pack.states[p.state]?.name;
      return Tags.matches(searchText, p.name, p.tags, [p.formName, capital, state]);
    });
  }
  return sortDataByColumns(dialogId, filtered, columns);
}

function renderProvincesPage(view: TableView<Province>): void {
  const body = ensureEl("provincesBodySection");
  const unit = ` ${getAreaUnit()}`;
  const totals = view.all.reduce(
    (sum, province) => ({
      area: sum.area + getProvinceArea(province),
      population: sum.population + getProvincePopulation(province),
      burgs: sum.burgs + province.burgs!.length
    }),
    { area: 0, population: 0, burgs: 0 }
  );
  const percentage = body.dataset.type === "percentage";
  const lines = view.rows
    .map(p => {
      const area = getProvinceArea(p);
      const rural = p.rural! * options.map.units.population.scale;
      const urban = p.urban! * options.map.units.population.scale * options.map.units.population.urbanization.rate;
      const population = getProvincePopulation(p);
      const populationTip = sentences(
        `${t("Total population")}: ${si(population)}`,
        `${t("Rural population")}: ${si(rural)}`,
        `${t("Urban population")}: ${si(urban)}`
      );
      const stateName = pack.states[p.state].name;
      const separable = p.burg && p.burg !== pack.states[p.state].capital;
      const focused = select<SVGElement, unknown>("#deftemp").select(`#fog #focusProvince${p.i}`).size();
      EmblemRenderer.trigger(`provinceCOA${p.i}`, p.coa);
      return /* html */ `<div class="states" data-id=${p.i}>
      <fill-box data-col="color" fill="${p.color}"></fill-box>
      <input data-col="name" data-tip="${sentences(t("Name"), t("Click to change"))}" class="name pointer" value="${p.name}" readonly />
      <svg data-col="emblem" data-tip="${t("Edit Emblem")}" class="coaIcon pointer" viewBox="0 0 200 200"><use href="#provinceCOA${p.i}"></use></svg>
      <input data-col="form" data-tip="${sentences(t("Form name"), t("Click to change"))}" class="name pointer" value="${p.formName}" readonly />
      <div data-col="capital">
        <span data-tip="${sentences(t("Province capital"), t("Click to zoom"))}" class="icon-star-empty pointer ${p.burg ? "" : "placeholder"}"></span>
        <select data-tip="${sentences(t("Province capital"), t("Click to select from burgs within the state"), t("No capital means the province is governed from the state capital"))}" class="cultureBase ${p.burgs!.length ? "" : "placeholder"}">${p.burgs!.length ? getCapitalOptions(p.burgs!, p.burg) : ""}</select>
      </div>
      <input data-col="state" data-tip="${t("Province owner")}" class="provinceOwner" value="${stateName}" disabled>
      <div data-col="burgs">
        <span data-tip="${t("Click to overview province burgs")}" class="icon-dot-circled pointer"></span>
        <span data-tip="${t("Number of burgs")}" class="provinceBurgs">${percentage ? `${rn(totals.burgs ? (p.burgs!.length / totals.burgs) * 100 : 0)}%` : p.burgs!.length}</span>
      </div>
      <div data-col="area">
        <span data-tip="${t("Province area")}" class="icon-map-o" style="padding-right: 4px"></span>
        <span data-tip="${t("Province area")}" class="biomeArea">${percentage ? `${rn(totals.area ? (area / totals.area) * 100 : 0)}%` : si(area) + unit}</span>
      </div>
      <div data-col="population">
        <span data-tip="${populationTip}" class="icon-male"></span>
        <span data-tip="${populationTip}" class="culturePopulation">${percentage ? `${rn(totals.population ? (population / totals.population) * 100 : 0)}%` : si(population)}</span>
      </div>
      <div data-col="tags">
        <input
          data-tip="${t("Tags (comma-separated)")}"
          class="provinceTags"
          value="${Tags.format(p.tags)}"
          placeholder="${t("Tags")}"
          autocorrect="off"
          spellcheck="false"
        />
      </div>
      ${noteIcon(t("Edit free text notes (legend)"))}
      <span data-col="independence" data-tip="${t("Declare province independence (turn non-capital province with burgs into a new state)")}" class="icon-flag-empty ${separable ? "" : "placeholder"}"></span>
      <span data-col="locate" data-tip="${t("Locate on map")}" class="icon-target"></span>
      <span data-col="focus" data-tip="${t("Toggle province focus")}" class="icon-pin ${focused ? "" : " inactive"}"></span>
      <span data-col="lock" data-tip="${t("Lock")}" class="icon-lock${p.lock ? "" : "-open"}"></span>
      <span data-col="remove" data-tip="${t("Remove")}" class="icon-trash-empty"></span>
    </div>`;
    })
    .join("");
  body.querySelectorAll(":scope > .states").forEach(line => {
    line.remove();
  });
  body.insertAdjacentHTML("beforeend", lines);

  ensureEl("provincesFooterNumber").innerHTML = String(view.all.length);
  ensureEl("provincesFooterBurgs").innerHTML = String(totals.burgs);
  ensureEl("provincesFooterArea").innerHTML = view.all.length ? si(totals.area / view.all.length) + unit : `0${unit}`;
  ensureEl("provincesFooterPopulation").innerHTML = view.all.length ? si(totals.population / view.all.length) : "0";
  ensureEl("provincesFooterArea").dataset.area = String(totals.area);
  ensureEl("provincesFooterPopulation").dataset.population = String(totals.population);
  renderEditorPagination(ensureEl("provincesFooter"), view, provincesTable.goto);

  body.querySelectorAll("div.states").forEach(el => {
    el.addEventListener("mouseenter", provinceHighlightOn);
    el.addEventListener("mouseleave", provinceHighlightOff);
  });
  body.querySelectorAll("input.provinceTags").forEach(el => {
    el.addEventListener("change", provinceChangeTags);
  });

  Dialog.update(dialogId, { width: "fit-content", position });
}

function provinceChangeTags(this: HTMLInputElement): void {
  const line = this.closest(".states") as HTMLElement;
  const provinceId = Number(line.dataset.id);
  const province = pack.provinces[provinceId];
  if (!province) return;

  Tags.set(province, this.value);
  this.value = Tags.format(province.tags);
  if (filterState.search) provincesTable.refresh();
}

function getCapitalOptions(burgs: number[], capital: number): string {
  let options = "";
  burgs.forEach(b => {
    options += `<option ${b === capital ? "selected" : ""} value="${b}">${pack.burgs[b].name}</option>`;
  });
  return options;
}

function provinceHighlightOn(event: Event): void {
  const province = +(event.target as HTMLElement).dataset.id!;
  const el = ensureEl("provincesBodySection").querySelector(`div[data-id='${province}']`);
  if (el) el.classList.add("active");

  if (!Layers.isOn("provinces")) return;
  if (options.app.mode) return;
  const animate = transition().duration(2000).ease(easeSinIn);
  select<SVGGElement, unknown>("#provs")
    .select(`#province${province}`)
    .raise()
    .transition(animate)
    .attr("stroke-width", 2.5)
    .attr("stroke", "#d0240f");
}

function provinceHighlightOff(event?: Event): void {
  const id = (event?.target as HTMLElement | undefined)?.dataset?.id;
  const province = id ? +id : null;
  if (province) {
    const el = ensureEl("provincesBodySection").querySelector(`div[data-id='${province}']`);
    if (el) el.classList.remove("active");
  }

  if (!Layers.isOn("provinces") || !province) {
    select("#debug").selectAll(".highlight").remove();
    return;
  }
  select<SVGGElement, unknown>("#provs")
    .select(`#province${province}`)
    .transition()
    .attr("stroke-width", null)
    .attr("stroke", null);
  select("#debug").selectAll(".highlight").remove();
}

function changeFill(fillBox: FillBoxElement): void {
  const currentFill = fillBox.getAttribute("fill")!;
  const p = +fillBox.closest<HTMLElement>(".states")!.dataset.id!;

  const callback = (newFill: string): void => {
    fillBox.fill = newFill;
    pack.provinces[p].color = newFill;
    Layers.draw("provinces");
  };

  void Controllers.ColorPicker.open(currentFill, callback);
}

function capitalZoomIn(p: number): void {
  const capital = pack.provinces[p].burg;
  const { x, y } = pack.burgs[capital];
  zoomTo(x, y, 8, 2000);
}

function triggerIndependencePromps(p: number): void {
  Dialog.confirm({
    title: t("Declare independence"),
    message: `${t("Are you sure you want to declare province independence?")}<br>${t("It will turn province into a new state")}`,
    confirm: t("Declare"),
    onConfirm: () => {
      const result = declareProvinceIndependence(p);
      if (!result) return;
      const [oldStateId, newStateId] = result;
      updateStatesPostRelease([oldStateId], [newStateId]);
    }
  });
}

function declareProvinceIndependence(provinceId: number): [number, number] | undefined {
  const oldStateId = pack.provinces[provinceId].state;
  try {
    const newStateId = Provinces.declareIndependence(provinceId);
    removeEmblem("province", provinceId);
    return [oldStateId, newStateId];
  } catch (error) {
    tip(errorText(error), false, "error");
  }
}

function updateStatesPostRelease(oldStates: number[], newStates: number[]): void {
  const allStates = unique([...oldStates, ...newStates]);

  Layers.hide("provinces");
  Layers.show("states", "borders");
  Layers.draw("burgIcons", "labels");
  redrawEmblems(allStates.map(stateId => ["state", stateId] as const));

  unfog();
  Dialog.closeAll();
  void Controllers.StatesEditor.open();
}

function changePopulation(province: number): void {
  const p = pack.provinces[province];
  const cells = pack.cells.i.filter(i => pack.cells.province[i] === province);
  if (!cells.length) {
    tip(t("No cells, cannot change population"), false, "error");
    return;
  }
  const rural = rn(p.rural! * options.map.units.population.scale);
  const urban = rn(p.urban! * options.map.units.population.scale * options.map.units.population.urbanization.rate);
  const total = rural + urban;
  const l = (n: number): string => Number(n).toLocaleString();

  Dialog.message({
    message: /* html */ ` ${t("Rural")}: <input type="number" min="0" step="1" id="ruralPop" value=${rural} style="width:6em" /> ${t("Urban")}:
    <input type="number" min="0" step="1" id="urbanPop" value=${urban} style="width:6em" ${p.burgs!.length ? "" : "disabled"} />
    <p>${t("Total population")}: ${l(total)} ⇒ <span id="totalPop">${l(total)}</span> (<span id="totalPopPerc">100</span>%)</p>`,
    title: t("Change province population"),
    width: "24em",
    buttons: [
      {
        label: t("Apply"),
        onClick: () => {
          applyPopulationChange();
        }
      },
      { label: t("Cancel") }
    ]
  });

  const ruralPop = ensureEl<HTMLInputElement>("ruralPop");
  const urbanPop = ensureEl<HTMLInputElement>("urbanPop");

  const update = (): void => {
    const totalNew = ruralPop.valueAsNumber + urbanPop.valueAsNumber;
    if (Number.isNaN(totalNew)) return;
    ensureEl("totalPop").innerHTML = l(totalNew);
    ensureEl("totalPopPerc").innerHTML = String(rn((totalNew / total) * 100));
  };

  ruralPop.oninput = () => update();
  urbanPop.oninput = () => update();

  function applyPopulationChange(): void {
    try {
      Provinces.setPopulation(province, +ruralPop.value || 0, +urbanPop.value || 0);
    } catch (error) {
      tip(errorText(error), false, "error");
      return;
    }
    Layers.draw("population");
    refreshProvincesEditor();
  }
}

function toggleFog(p: number, cl: DOMTokenList): void {
  const path = select<SVGGElement, unknown>("#provs").select(`#province${p}`).attr("d");
  const id = `focusProvince${p}`;
  if (cl.contains("inactive")) fog(id, path);
  else unfog(id);
  cl.toggle("inactive");
}

function removeProvince(p: number): void {
  Dialog.confirm({
    title: t("Remove"),
    message: `${t("Are you sure you want to remove the province?")}<br>${t("This action cannot be reverted")}`,
    confirm: t("Remove"),
    onConfirm: () => {
      Provinces.remove(p);
      unfog(`focusProvince${p}`);
      removeEmblem("province", p);

      const g = select<SVGGElement, unknown>("#provs").select("#provincesBody");
      g.select(`#province${p}`).remove();
      g.select(`#province-gap${p}`).remove();
      Layers.draw("borders");
      Layers.draw("labels");
      refreshProvincesEditor();
    }
  });
}

function editProvinceName(province: number): void {
  renderNameEditor();
  const p = pack.provinces[province];
  ensureEl("provinceNameEditor").dataset.province = String(province);
  ensureEl<HTMLInputElement>("provinceNameEditorShort").value = p.name;
  applyOption(ensureEl("provinceNameEditorSelectForm"), p.formName);
  ensureEl<HTMLInputElement>("provinceNameEditorFull").value = p.fullName;

  const cultureId = pack.cells.culture[p.center];
  ensureEl("provinceCultureDisplay").textContent = pack.cultures[cultureId].name;

  Dialog.open("provinceNameEditor", {
    title: t("Change province name"),
    buttons: [
      {
        label: t("Apply"),
        onClick: () => {
          applyNameChange(p);
          Dialog.close("provinceNameEditor");
        }
      },
      {
        label: t("Cancel"),
        onClick: () => {
          Dialog.close("provinceNameEditor");
        }
      }
    ],
    position: { my: "center", at: "center", of: "svg" },
    onClose: closeProvinceNameEditor
  });
}

function renderNameEditor(): void {
  Dialog.destroy("provinceNameEditor");
  const nameEditorHtml = /* html */ `<div id="provinceNameEditor" class="dialog" data-province="0">
      <div>
        <div data-tip="${t("Short name")}" class="label">${t("Short name")}:</div>
        <input
          id="provinceNameEditorShort"
          data-tip="${t("Type to change the short name")}"
          autocorrect="off"
          spellcheck="false"
          style="width: 11em"
        />
        <span id="provinceNameEditorShortSpeak" data-tip="${sentences(t("Speak the name"), t("You can change voice and language in options"))}" class="speaker">🔊</span>
        <span
          id="provinceNameEditorShortCulture"
          data-tip="${t("Generate culture-specific name")}"
          class="icon-book pointer"
        ></span>
        <span id="provinceNameEditorShortRandom" data-tip="${t("Generate random name")}" class="icon-globe pointer"></span>
      </div>
      <div data-tip="${t("Select form name")}">
        <div data-tip="${t("Form name")}" class="label">${t("Form name")}:</div>
        <select id="provinceNameEditorSelectForm" style="display: inline-block; width: 11em; height: 1.645em">
          <option value="">${t("blank")}</option>
          <option value="Area">${t("Area")}</option>
          <option value="Autonomy">${t("Autonomy")}</option>
          <option value="Barony">${t("Barony")}</option>
          <option value="Canton">${t("Canton")}</option>
          <option value="Captaincy">${t("Captaincy")}</option>
          <option value="Chiefdom">${t("Chiefdom")}</option>
          <option value="Clan">${t("Clan")}</option>
          <option value="Colony">${t("Colony")}</option>
          <option value="Council">${t("Council")}</option>
          <option value="County">${t("County")}</option>
          <option value="Deanery">${t("Deanery")}</option>
          <option value="Department">${t("Department")}</option>
          <option value="Dependency">${t("Dependency")}</option>
          <option value="Diaconate">${t("Diaconate")}</option>
          <option value="District">${t("District")}</option>
          <option value="Earldom">${t("Earldom")}</option>
          <option value="Governorate">${t("Governorate")}</option>
          <option value="Island">${t("Island")}</option>
          <option value="Islands">${t("Islands")}</option>
          <option value="Land">${t("Land")}</option>
          <option value="Landgrave">${t("Landgrave")}</option>
          <option value="Mandate">${t("Mandate")}</option>
          <option value="Margrave">${t("Margrave")}</option>
          <option value="Municipality">${t("Municipality")}</option>
          <option value="Occupation zone">${t("Occupation zone")}</option>
          <option value="Parish">${t("Parish")}</option>
          <option value="Prefecture">${t("Prefecture")}</option>
          <option value="Province">${t("Province")}</option>
          <option value="Region">${t("Region")}</option>
          <option value="Republic">${t("Republic")}</option>
          <option value="Reservation">${t("Reservation")}</option>
          <option value="Seneschalty">${t("Seneschalty")}</option>
          <option value="Shire">${t("Shire")}</option>
          <option value="State">${t("State")}</option>
          <option value="Territory">${t("Territory")}</option>
          <option value="Tribe">${t("Tribe")}</option>
        </select>
        <input
          id="provinceNameEditorCustomForm"
          placeholder="${t("Enter custom form name")}"
          data-tip="${t("Create custom province form name")}"
          style="display: none; width: 11em"
        />
        <span
          id="provinceNameEditorAddForm"
          data-tip="${t("Click to add custom province form name to the list")}"
          class="icon-plus pointer"
        ></span>
      </div>
      <div>
        <div data-tip="${t("Full name")}" class="label">${t("Full name")}:</div>
        <input
          id="provinceNameEditorFull"
          data-tip="${t("Type to change the full name")}"
          autocorrect="off"
          spellcheck="false"
          style="width: 11em"
        />
        <span id="provinceNameEditorFullSpeak" data-tip="${sentences(t("Speak the name"), t("You can change voice and language in options"))}" class="speaker">🔊</span>
        <span
          id="provinceNameEditorFullRegenerate"
          data-tip="${t("Click to re-generate full name")}"
          class="icon-arrows-cw pointer"
        ></span>
      </div>
      <div
        id="provinceCultureName"
        data-tip="${t("Dominant culture in the province. This defines culture-based naming. Can be changed via the Cultures Editor")}"
        style="margin-top: 0.2em"
      >
        ${t("Dominant culture")}:&nbsp;<span id="provinceCultureDisplay"></span>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", nameEditorHtml);

  ensureEl("provinceNameEditorShortCulture").addEventListener("click", regenerateShortNameCulture);
  ensureEl("provinceNameEditorShortRandom").addEventListener("click", regenerateShortNameRandom);
  ensureEl("provinceNameEditorShortSpeak").addEventListener("click", () =>
    speak(ensureEl<HTMLInputElement>("provinceNameEditorShort").value)
  );
  ensureEl("provinceNameEditorAddForm").addEventListener("click", addCustomForm);
  ensureEl("provinceNameEditorFullRegenerate").addEventListener("click", regenerateFullName);
  ensureEl("provinceNameEditorFullSpeak").addEventListener("click", () =>
    speak(ensureEl<HTMLInputElement>("provinceNameEditorFull").value)
  );
}

function closeProvinceNameEditor(): void {
  Dialog.destroy("provinceNameEditor");
}

function regenerateShortNameCulture(): void {
  const province = +ensureEl("provinceNameEditor").dataset.province!;
  const culture = pack.cells.culture[pack.provinces[province].center];
  const name = Names.getState(Names.getCultureShort(culture), culture);
  ensureEl<HTMLInputElement>("provinceNameEditorShort").value = name;
}

function regenerateShortNameRandom(): void {
  const base = rand(Names.nameBases.length - 1);
  const name = Names.getState(Names.getBase(base), undefined as unknown as number, base);
  ensureEl<HTMLInputElement>("provinceNameEditorShort").value = name;
}

function addCustomForm(): void {
  const customForm = ensureEl<HTMLInputElement>("provinceNameEditorCustomForm");
  const selectForm = ensureEl("provinceNameEditorSelectForm");
  const value = customForm.value;
  const displayed = customForm.style.display === "inline-block";
  customForm.style.display = displayed ? "none" : "inline-block";
  selectForm.style.display = displayed ? "inline-block" : "none";
  if (displayed) applyOption(selectForm, value);
}

function regenerateFullName(): void {
  const short = ensureEl<HTMLInputElement>("provinceNameEditorShort").value;
  const form = ensureEl<HTMLSelectElement>("provinceNameEditorSelectForm").value;
  const getFullName = (): string => {
    if (!form) return short;
    if (!short && form) return `The ${form}`;
    return `${short} ${form}`;
  };
  ensureEl<HTMLInputElement>("provinceNameEditorFull").value = getFullName();
}

function applyNameChange(p: Province): void {
  const name = ensureEl<HTMLInputElement>("provinceNameEditorShort").value.trim();
  const formName = ensureEl<HTMLSelectElement>("provinceNameEditorSelectForm").value;
  const fullName = ensureEl<HTMLInputElement>("provinceNameEditorFull").value.trim();
  const oldFullName = p.fullName;
  if (name && name !== p.name) Provinces.rename(p.i, name);
  if (formName !== (p.formName ?? "")) Provinces.setForm(p.i, formName);
  if (fullName && fullName !== oldFullName) Provinces.setFullName(p.i, fullName);
  Layers.draw("provinces");
  Layers.draw("labels");
  refreshProvincesEditor();
}

function changeCapital(p: number, line: HTMLElement, value: string): void {
  Provinces.setCapital(p, +value);
  line.dataset.capital = pack.burgs[+value].name;
}

function togglePercentageMode(): void {
  const body = ensureEl("provincesBodySection");
  body.dataset.type = body.dataset.type === "absolute" ? "percentage" : "absolute";
  provincesTable.refresh();
}

type TreeNode = any;

function showChart(): void {
  collectStatistics(); // the chart can open from search before the editor ever did

  // build hierarchy tree
  const getColor = (s: TreeNode): string =>
    !s.i || s.removed || s.color[0] !== "#" ? "#666" : String(d3Color(s.color)!.darker());
  const states = pack.states.map(s => ({ id: s.i, state: s.i ? 0 : null, color: getColor(s) }));
  const provinces = pack.provinces
    .filter(p => p.i && !p.removed)
    .map(p => ({
      id: p.i + states.length - 1,
      i: p.i,
      state: p.state,
      color: p.color,
      name: p.name,
      fullName: p.fullName,
      area: p.area,
      urban: p.urban,
      rural: p.rural
    }));
  const data: TreeNode[] = [...states, ...provinces];
  const root = stratify<TreeNode>()
    .parentId((d: TreeNode) => d.state)(data)
    .sum((d: TreeNode) => d.area);

  const uiSizeValue = +ensureEl<HTMLInputElement>("uiSize").value;
  const width = 300 + 300 * uiSizeValue;
  const height = 90 + 90 * uiSizeValue;
  const margin = { top: 10, right: 10, bottom: 0, left: 10 };
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;
  const treeLayout = treemap<TreeNode>().size([w, h]).padding(2);

  // prepare svg
  const chart = document.createElement("div");
  chart.innerHTML = /* html */ `<select id="provincesTreeType" style="display:block; margin-left:13px; font-size:11px">
    <option value="area" selected>${t("Area")}</option>
    <option value="population">${t("Total population")}</option>
    <option value="rural">${t("Rural population")}</option>
    <option value="urban">${t("Urban population")}</option>
  </select><div id='provinceInfo' class='chartInfo'>&#8205;</div>`;
  const svg = select(chart)
    .insert("svg", "#provinceInfo")
    .attr("id", "provincesTree")
    .attr("width", width)
    .attr("height", height)
    .attr("font-size", "10px");
  const graph = svg.append("g").attr("transform", `translate(10, 0)`);
  chart.querySelector("#provincesTreeType")!.addEventListener("change", updateChart);

  treeLayout(root);

  const node = graph
    .selectAll<SVGGElement, TreeNode>("g")
    .data(root.leaves())
    .enter()
    .append("g")
    .attr("data-id", (d: TreeNode) => d.data.i)
    .on("mouseenter", (event: any, d: TreeNode) => showInfo(event, d))
    .on("mouseleave", (event: any) => hideInfo(event));

  function showInfo(ev: any, d: TreeNode): void {
    select(ev.currentTarget as SVGGElement)
      .select("rect")
      .classed("selected", true);
    const name = d.data.fullName;
    const state = pack.states[d.data.state].fullName;

    const area = `${getArea(d.data.area)} ${getAreaUnit()}`;
    const rural = rn(d.data.rural * options.map.units.population.scale);
    const urban = rn(
      d.data.urban * options.map.units.population.scale * options.map.units.population.urbanization.rate
    );

    const typeValue = ensureEl<HTMLSelectElement>("provincesTreeType").value;
    const value =
      typeValue === "area"
        ? `${t("Area")}: ${area}`
        : typeValue === "rural"
          ? `${t("Rural population")}: ${si(rural)}`
          : typeValue === "urban"
            ? `${t("Urban population")}: ${si(urban)}`
            : `${t("Population")}: ${si(rural + urban)}`;

    ensureEl("provinceInfo").innerHTML = /* html */ `${name}. ${state}. ${value}`;
    provinceHighlightOn(ev);
  }

  function hideInfo(ev: any): void {
    provinceHighlightOff(ev);
    if (!findEl("provinceInfo")) return;
    ensureEl("provinceInfo").innerHTML = "&#8205;";
    select(ev.currentTarget as SVGGElement)
      .select("rect")
      .classed("selected", false);
  }

  node
    .append("rect")
    .attr("stroke", (d: TreeNode) => d.parent.data.color)
    .attr("stroke-width", 1)
    .attr("fill", (d: TreeNode) => d.data.color)
    .attr("x", (d: TreeNode) => d.x0)
    .attr("y", (d: TreeNode) => d.y0)
    .attr("width", (d: TreeNode) => d.x1 - d.x0)
    .attr("height", (d: TreeNode) => d.y1 - d.y0);

  node
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .attr("dx", ".2em")
    .attr("dy", "1em")
    .attr("x", (d: TreeNode) => d.x0)
    .attr("y", (d: TreeNode) => d.y0);

  function hideNonfittingLabels(): void {
    node.select<SVGTextElement>("text").each(function (d: TreeNode) {
      this.innerHTML = d.data.name;
      let b = this.getBBox();
      if (b.y + b.height > d.y1 + 1) this.innerHTML = "";

      for (let i = 0; i < 15 && b.width > 0 && b.x + b.width > d.x1; i++) {
        if (this.innerHTML.length < 3) {
          this.innerHTML = "";
          break;
        }
        this.innerHTML = `${this.innerHTML.slice(0, -2)}…`;
        b = this.getBBox();
      }
    });
  }

  function updateChart(this: HTMLSelectElement): void {
    const value: (d: TreeNode) => number =
      this.value === "area"
        ? (d: TreeNode) => d.area
        : this.value === "rural"
          ? (d: TreeNode) => d.rural
          : this.value === "urban"
            ? (d: TreeNode) => d.urban
            : (d: TreeNode) => d.rural + d.urban;

    root.sum(value);
    node.data(treeLayout(root).leaves());

    node
      .select("rect")
      .transition()
      .duration(1500)
      .attr("x", (d: TreeNode) => d.x0)
      .attr("y", (d: TreeNode) => d.y0)
      .attr("width", (d: TreeNode) => d.x1 - d.x0)
      .attr("height", (d: TreeNode) => d.y1 - d.y0);

    node
      .select("text")
      .transition()
      .duration(1500)
      .attr("x", (d: TreeNode) => d.x0)
      .attr("y", (d: TreeNode) => d.y0);

    setTimeout(hideNonfittingLabels, 2000);
  }

  Dialog.message({
    message: chart,
    title: t("Provinces chart"),
    width: "fit-content",
    position: { my: "left bottom", at: "left+10 bottom-10", of: "svg" },
    buttons: []
  });

  hideNonfittingLabels();
}

function triggerProvincesRelease(): void {
  Dialog.confirm({
    title: t("Release provinces"),
    message: `${t("Are you sure you want to release all provinces?")}<br>${t("It will turn all separable provinces into independent states.")}<br>${t("Capital province and provinces without any burgs will state as they are")}`,
    confirm: t("Release"),
    onConfirm: () => {
      const oldStateIds: number[] = [];
      const newStateIds: number[] = [];

      getProvincesData().forEach(province => {
        if (!province.burg) return;
        if (province.burg === pack.states[province.state].capital) return;
        if (province.burgs!.some(burgId => pack.burgs[burgId].capital)) return;

        const result = declareProvinceIndependence(province.i);
        if (!result) return;
        oldStateIds.push(result[0]);
        newStateIds.push(result[1]);
      });

      updateStatesPostRelease(unique(oldStateIds), newStateIds);
    }
  });
}

function openPaintEditor(): void {
  Layers.show("provinces", "borders");

  void Controllers.PaintEditor.open({
    title: t("Paint Provinces"),
    parentDialogId: dialogId,
    onClose: open,
    items: getProvincesData().map(province => ({
      id: province.i,
      name: province.name,
      color: province.color || "#ffffff"
    })),
    getValue: cell => pack.cells.province[cell],
    filterCell: (cell, currentProvince, nextProvince) => {
      if (!isLand(cell, pack) || !pack.cells.state[cell]) return false;
      if (pack.cells.state[cell] !== pack.provinces[nextProvince].state) return false;
      if (!currentProvince || cell !== pack.provinces[currentProvince].center) return true;
      tip(
        t("Province center cannot be assigned to a different region. Please remove the province first"),
        false,
        "error"
      );
      return false;
    },
    dontOverrideControl: true,
    onApply: applyProvincePaint
  });
}

function applyProvincePaint(changes: ReadonlyMap<number, number>): void {
  for (const [province, cells] of groupByValue(changes)) Provinces.setCells(province, cells);

  Layers.draw("borders", "provinces");
  Layers.draw("labels");

  if (findEl(dialogId)) refreshProvincesEditor();
}

function enterAddProvinceMode(this: HTMLElement): void {
  if (this.classList.contains("pressed")) {
    exitAddProvinceMode();
    return;
  }

  options.app.mode = "addProvince";
  this.classList.add("pressed");
  tip(t("Click on the map to place a new province center"), true);
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addProvince);
  ensureEl("provincesBodySection")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.pointerEvents = "none";
    });
}

function addProvince(this: SVGElement, event: any): void {
  const [x, y] = getPointer(event, this);
  let province: number;
  try {
    province = Provinces.add(x, y);
  } catch (error) {
    tip(errorText(error), false, "error");
    return;
  }
  if (event.shiftKey === false) exitAddProvinceMode();

  redrawEmblem("province", province);
  Layers.draw("borders", "provinces", "labels");

  collectStatistics();
  filterState.stateId = pack.provinces[province].state;
  dialogState.set(dialogId, "filters", filterState);
  ensureEl<HTMLSelectElement>("provincesFilterState").value = String(filterState.stateId);
  provincesTable.reset();
}

function exitAddProvinceMode(): void {
  options.app.mode = null;
  applyDefaultViewboxEvents();
  clearMainTip();
  ensureEl("provincesBodySection")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.removeProperty("pointer-events");
    });
  const provincesAdd = ensureEl("provincesAdd");
  if (provincesAdd.classList.contains("pressed")) provincesAdd.classList.remove("pressed");
}

function recolorProvinces(): void {
  const state = filterState.stateId;

  pack.provinces.forEach(p => {
    if (!p || p.removed) return;
    if (state !== -1 && p.state !== state) return;
    const stateColor = pack.states[p.state].color!;
    const rndColor = getRandomColor();
    p.color = stateColor[0] === "#" ? d3Color(interpolate(stateColor, rndColor)(0.2))!.hex() : rndColor;
  });

  Layers.draw("provinces");
  provincesTable.refresh();
}

function downloadProvincesData(): void {
  const unit =
    options.map.units.area.unit === "square" ? `${options.map.units.distance.unit}2` : options.map.units.area.unit;
  const { scale, urbanization } = options.map.units.population;
  const headers = CSV_COLUMNS.map(column => (column === "Area" ? `Area ${unit}` : column));
  const rows = getProvincesData().map(province => [
    province.i,
    province.name,
    province.fullName,
    province.formName,
    pack.states[province.state].name,
    province.color,
    province.burg ? pack.burgs[province.burg].name : "",
    getProvinceArea(province),
    getProvincePopulation(province),
    Math.round(province.rural! * scale),
    Math.round(province.urban! * scale * urbanization.rate),
    province.burgs!.length,
    Tags.format(province.tags)
  ]);
  Csv.download("Provinces", headers, rows);
}

function removeAllProvinces(): void {
  Dialog.confirm({
    title: t("Remove all provinces"),
    message: `${t("Are you sure you want to remove all provinces?")}<br>${t("This action cannot be reverted")}`,
    confirm: t("Remove"),
    onConfirm: () => {
      // remove emblems
      pack.provinces.forEach(province => {
        if (province.i) removeEmblem("province", province.i);
      });

      // remove data
      pack.provinces = [0] as unknown as Province[];
      pack.cells.province = new Uint16Array(pack.cells.i.length);
      pack.states.forEach(s => {
        s.provinces = [];
      });

      unfog();
      Layers.draw("borders");
      select<SVGGElement, unknown>("#provs").select("#provincesBody").remove();
      Layers.hide("provinces");
      Layers.draw("labels");

      provincesTable.reset();
    }
  });
}

function closeProvincesEditor(): void {
  if (options.app.mode === "addProvince") exitAddProvinceMode();
  provincesAnnex.exit();
  Controllers.ColorPicker.close();
  const view = provincesTable.view();
  view.rows = [];
  view.all = [];
  Dialog.destroy("provincesEditor");
}

function openProvinceMergeDialog(): void {
  const selectedState = filterState.stateId;
  if (selectedState === -1) {
    Dialog.message({
      message: t("Please select a specific state from the filter to merge provinces within that state."),
      title: t("Merge Provinces")
    });
    return;
  }
  const provincesToMerge = pack.provinces.filter(p => p.i && !p.removed && p.state === selectedState);
  if (provincesToMerge.length < 2) {
    Dialog.message({ message: t("Not enough provinces in the selected state to merge."), title: t("Merge Provinces") });
    return;
  }

  const provincesSelector = provincesToMerge
    .map(
      p => /* html */ `
    <div data-id="${p.i}" data-tip="${p.fullName || p.name}" style="cursor:default">
      <input type="radio" name="rulingProvince" value="${p.i}" />
      <input id="selectProvince${p.i}" class="checkbox" type="checkbox" name="provincesToMerge" value="${p.i}" />
      <label for="selectProvince${p.i}" class="checkbox-label"><fill-box fill="${p.color}" disabled></fill-box>${provinceEmblem(p.i)}${p.name}</label>
    </div>
  `
    )
    .join("");

  Dialog.message({
    id: "mergeProvinces",
    message: /* html */ `
    <form id='mergeProvincesForm' style="overflow: hidden; display: flex; flex-direction: column; gap: 1em;">
      <p style="margin:0">
        ${t("Check the checkbox next to each province you want to merge. Use the radio button to pick the primary province that will absorb all others. Hover over a row to highlight the province on the map.")}
      </p>
      <main style='display: grid; grid-template-columns: 1fr 1fr; gap: .3em;'>
        ${provincesSelector}
      </main>
    </form>
  `,
    width: 600,
    title: t("Merge Provinces"),
    onClose: () => provinceHighlightOff(),
    buttons: [
      {
        label: t("Merge"),
        onClick: () => {
          const formData = new FormData(ensureEl<HTMLFormElement>("mergeProvincesForm"));
          const primaryProvinceId = Number(formData.get("rulingProvince"));
          if (!primaryProvinceId) {
            tip(t("Please select a province to merge into"), false, "error");
            return false;
          }

          const provincesToMergeIds = formData
            .getAll("provincesToMerge")
            .map(Number)
            .filter(provinceId => provinceId !== primaryProvinceId);
          if (!provincesToMergeIds.length) {
            tip(t("Please select several provinces to merge"), false, "error");
            return false;
          }

          confirmProvincesMerge(provincesToMergeIds, primaryProvinceId, () => Dialog.close("mergeProvinces"));
          return false; // stays open until the merge is confirmed
        }
      },
      { label: t("Cancel") }
    ]
  });

  ensureEl("mergeProvincesForm")
    .querySelectorAll("div[data-id]")
    .forEach(el => {
      el.addEventListener("mouseenter", highlightProvinceOnMergeHover);
      el.addEventListener("mouseleave", provinceHighlightOff);
    });
}

const provinceEmblem = (i: number): string =>
  /* html */ `<svg class="coaIcon" viewBox="0 0 200 200"><use href="#provinceCOA${i}"></use></svg>`;

function confirmProvincesMerge(provincesToMerge: number[], primaryProvinceId: number, onConfirm?: () => void): void {
  Dialog.confirm({
    title: t("Merge Provinces"),
    message: /* html */ `
      <p>${t("The following provinces will be removed")}: ${provincesToMerge
        .map(provinceId => `${provinceEmblem(provinceId)}${pack.provinces[provinceId].name}`)
        .join(", ")}.</p>
      <p>${t("Removed provinces data (burgs and cells) will be assigned to {{- province}}.", {
        province: `${provinceEmblem(primaryProvinceId)}${pack.provinces[primaryProvinceId].name}`
      })}</p>
      <p>${sentences(t("Are you sure you want to merge provinces?"), t("This action cannot be reverted"))}</p>`,
    confirm: t("Merge"),
    onConfirm: () => {
      mergeProvinces(provincesToMerge, primaryProvinceId);
      onConfirm?.();
    }
  });
}

const provincesAnnex = createAnnexMode({
  buttonId: "provincesAnnex",
  bodySectionId: "provincesBodySection",
  tips: {
    start: sentences(
      t("Click the province that annexes, then the provinces it absorbs"),
      t("Hold Shift to keep annexing")
    ),
    pickLand: t("Click on a land cell to pick a province"),
    nothingHere: t("There is no province here"),
    annexing: name =>
      sentences(
        t("Annexing into {{province}}", { province: name }),
        t("Click the provinces to annex"),
        t("Hold Shift to keep annexing")
      ),
    isParent: name => t("{{province}} is the annexing province", { province: name })
  },
  ownerOf: cellId => pack.cells.province[cellId],
  colorOf: provinceId => pack.provinces[provinceId].color,
  nameOf: provinceId => pack.provinces[provinceId].name,
  rejectReason: (primaryId, provinceId) =>
    pack.provinces[provinceId].state === pack.provinces[primaryId].state
      ? undefined
      : t("{{province}} belongs to another state. Merge states first, or pick a province of {{state}}", {
          province: pack.provinces[provinceId].name,
          state: pack.states[pack.provinces[primaryId].state].name
        }),
  commit: (primaryProvinceId, provincesToMerge) => confirmProvincesMerge(provincesToMerge, primaryProvinceId)
});

function highlightProvinceOnMergeHover(event: Event): void {
  if (!Layers.isOn("provinces")) return;
  const province = +(event.currentTarget as HTMLElement).dataset.id!;
  if (!province) return;
  const d = select<SVGGElement, unknown>("#provs").select(`#province${province}`).attr("d");
  if (!d) return;

  provinceHighlightOff(event);
  highlightOutline(d);
}

function cleanupMergedProvince(provinceId: number): void {
  // Clean up UI artifacts for a province being merged (similar to removeProvince cleanup)
  unfog(`focusProvince${provinceId}`);

  removeEmblem("province", provinceId);
}

function mergeProvinces(ids: number[], primary: number): void {
  for (const id of ids) if (id !== primary) cleanupMergedProvince(id);
  Provinces.merge(primary, ids);
  collectStatistics();

  Layers.draw("provinces", "borders", "labels");
  unfog();
  select("#debug").selectAll(".highlight").remove();
  refreshProvincesEditor();
}

function updateLockStatus(provinceId: number, classList: DOMTokenList): void {
  Provinces.setLocked(provinceId, !pack.provinces[provinceId].lock);

  classList.toggle("icon-lock-open");
  classList.toggle("icon-lock");
}

/** Update existing provinces from a CSV in the export format */
async function uploadProvincesCsv(text: string): Promise<void> {
  const { scale, urbanization } = options.map.units.population;
  const find = (id: number) => {
    const province = pack.provinces[id];
    return id && province && !province.removed ? province : undefined;
  };
  const textColumns = ["Province", "Full Name", "Form", "Tags"];
  const updated = await Controllers.CsvUpload.update(
    text,
    CSV_COLUMNS,
    { find, units: ["Area"], text: textColumns },
    (id, row) => {
      const province = find(id)!;
      const fullName = province.fullName; // a new name or form rebuilds it, so an unchanged cell must not restore the old one
      row.apply("Province", name => Provinces.rename(id, name), province.name);
      row.apply("Form", form => Provinces.setForm(id, form), province.formName);
      row.apply("Full Name", name => Provinces.setFullName(id, name), fullName);
      row.apply("Color", color => Provinces.recolor(id, color), province.color);
      row.apply(
        "State",
        name => Provinces.setState(id, Csv.byName(pack.states, name).i),
        pack.states[province.state].name
      );
      const inProvince = (burg: Burg) => pack.cells.province[burg.cell] === id;
      row.apply(
        "Capital",
        name => Provinces.setCapital(id, Csv.byName(pack.burgs, name, inProvince).i),
        pack.burgs[province.burg]?.name
      );
      row.assign("Tags", tags => Tags.set(province, tags), Tags.format(province.tags));
      row.population(
        [(province.rural ?? 0) * scale, (province.urban ?? 0) * scale * urbanization.rate],
        (rural, urban) => Provinces.setPopulation(id, rural, urban)
      );
    }
  );
  if (!updated) return;

  Layers.draw("states", "provinces", "borders", "burgIcons", "labels", "emblems", "population");
  refreshProvincesEditor();
}

export const ProvincesEditor = { open, showChart };
