import { color as d3Color, easeSinIn, interpolate, interpolateString, select, stratify, transition, treemap } from "d3";
import { closeDialogs, confirmationDialog, destroyDialog, updateDialog } from "@/components/dialog/dialog-helpers";
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
import type { FillBoxElement } from "@/components/fill-box";
import { Layers } from "@/components/layers";
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import { Emblems } from "@/generators/emblems-generator";
import type { Province } from "@/generators/provinces-generator";
import { redrawEmblem, redrawEmblems, removeEmblem } from "@/renderers/draw-emblems";
import { EmblemRenderer } from "@/renderers/emblems/renderer";
import { fog, unfog } from "@/renderers/overlays/fogging";
import { highlightElement } from "@/renderers/overlays/highlight";
import { applyOption, downloadFile, getArea, getAreaUnit, getFileName, speak } from "@/utils";
import { ensureEl, findEl, getPointer, getRandomColor, isLand, P, rand, rn, si, unique } from "../utils";

const dialogId = "provincesEditor" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
let filterState: { stateId: number };

const getProvinceArea = (province: Province) => getArea(province.area!);
const getProvincePopulation = (province: Province) =>
  rn(province.rural! * populationRate + province.urban! * populationRate * urbanization);
const columns: EditorColumn<Province>[] = [
  { key: "color", width: "1.2em", permanent: true },
  {
    key: "name",
    label: "Province",
    width: "7em",
    permanent: true,
    sortBy: province => province.name || "",
    sortType: "alpha"
  },
  { key: "emblem", width: "1.4em" },
  {
    key: "form",
    label: "Form",
    width: "7em",
    mobileHidden: true,
    sortBy: province => province.formName || "",
    sortType: "alpha"
  },
  {
    key: "capital",
    label: "Capital",
    width: "7em",
    sortBy: province => (province.burg ? pack.burgs[province.burg]?.name || "" : ""),
    sortType: "alpha"
  },
  {
    key: "state",
    label: "State",
    width: "7em",
    permanent: true,
    sortBy: province => pack.states[province.state]?.name || "",
    sortType: "alpha"
  },
  {
    key: "burgs",
    label: "Burgs",
    width: "5em",
    mobileHidden: true,
    sortBy: province => province.burgs?.length || 0
  },
  {
    key: "area",
    label: "Area",
    width: "7em",
    mobileHidden: true,
    defaultSort: "desc",
    sortBy: getProvinceArea
  },
  { key: "population", label: "Population", width: "6em", sortBy: getProvincePopulation },
  { key: "actions", width: "5.4em", permanent: true, align: "right" }
];
const provincesTable = initEditorTable<Province>({ getData: getProvincesData, onUpdate: renderProvincesPage });

function open(): void {
  if (customization) return;
  filterState = dialogState.get(dialogId, "filters", () => ({ stateId: 1 }));
  closeDialogs("#provincesEditor, .stable");
  Layers.show("provinces", "borders");
  Layers.hide("states", "cultures");

  renderDialog();
  refreshProvincesEditor();

  $("#provincesEditor").dialog({
    title: "Provinces Editor",
    resizable: false,
    width: "fit-content",
    close: closeProvincesEditor,
    position
  });
}

function renderDialog(): void {
  destroyDialog("provincesEditor");
  const editorHtml = /* html */ `<div id="provincesEditor" class="dialog stable editorDialog">
      <div id="provincesBodySection" class="table" data-type="absolute">
        ${renderEditorHeader({ dialogId, columns })}
      </div>
      <div id="provincesFooter" class="totalLine">
        <div data-tip="Provinces displayed" style="margin-left: 4px">
          Provinces:&nbsp;<span id="provincesFooterNumber">0</span>
        </div>
        <div data-tip="Total burgs number" style="margin-left: 12px" data-col="burgs">
          Burgs:&nbsp;<span id="provincesFooterBurgs">0</span>
        </div>
        <div data-tip="Average area" style="margin-left: 14px" data-col="area">
          Mean area:&nbsp;<span id="provincesFooterArea">0</span>
        </div>
        <div data-tip="Average population" style="margin-left: 14px" data-col="population">
          Mean population:&nbsp;<span id="provincesFooterPopulation">0</span>
        </div>
      </div>
      <div id="provincesBottom" class="editorToolbar">
        <button id="provincesEditorRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
        <button id="provincesEditStyle" data-tip="Edit provinces style in Style Editor" class="icon-adjust"></button>
        <button
          id="provincesRecolor"
          data-tip="Recolor listed provinces based on state color"
          class="icon-paint-roller"
        ></button>
        <button
          id="provincesPercentage"
          data-tip="Toggle percentage / absolute values views"
          class="icon-percent"
        ></button>
        <button id="provincesChart" data-tip="Show provinces chart" class="icon-chart-area"></button>
        <button
          id="provincesExport"
          data-tip="Save provinces-related data as a text file (.csv)"
          class="icon-download"
        ></button>
        <button id="provincesManually" data-tip="Manually re-assign provinces" class="icon-brush"></button>
        <button
          id="provincesRelease"
          data-tip="Release all provinces. It will make all provinces with burgs independent"
          class="icon-flag"
        ></button>
        <button
          id="provincesAdd"
          data-tip="Add a new province. Hold Shift to add multiple"
          class="icon-plus"
        ></button>
        <button id="provincesMerge" data-tip="Merge several provinces into one" class="icon-layer-group"></button>
        <button
          id="provincesRemoveAll"
          data-tip="Remove all provinces. States will remain as they are"
          class="icon-trash"
        ></button>
        <span>State: </span>
        <select id="provincesFilterState"></select>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  bindColumnSorting(dialogId, provincesTable.reset);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });
  applyLineHighlighting("provincesEditor", ({ cellId }) => pack.cells.province[cellId]);

  ensureEl("provincesEditorRefresh").addEventListener("click", refreshProvincesEditor);
  ensureEl("provincesEditStyle").addEventListener("click", () => editStyle("provs"));
  ensureEl("provincesFilterState").addEventListener("change", event => {
    filterState.stateId = +(event.target as HTMLSelectElement).value;
    dialogState.set(dialogId, "filters", filterState);
    provincesTable.reset();
  });
  ensureEl("provincesPercentage").addEventListener("click", togglePercentageMode);
  ensureEl("provincesChart").addEventListener("click", showChart);
  ensureEl("provincesExport").addEventListener("click", downloadProvincesData);
  ensureEl("provincesRemoveAll").addEventListener("click", removeAllProvinces);
  ensureEl("provincesManually").addEventListener("click", openPaintEditor);
  ensureEl("provincesRelease").addEventListener("click", triggerProvincesRelease);
  ensureEl("provincesAdd").addEventListener("click", enterAddProvinceMode);
  ensureEl("provincesMerge").addEventListener("click", openProvinceMergeDialog);
  ensureEl("provincesRecolor").addEventListener("click", recolorProvinces);

  ensureEl("provincesBodySection").addEventListener("click", (ev: Event) => {
    if (customization) return;
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
  stateFilter.options.add(new Option(`all`, "-1", false, filterState.stateId === -1));
  const statesSorted = pack.states.filter(s => s.i && !s.removed).sort((a, b) => (a.name > b.name ? 1 : -1));
  statesSorted.forEach(s => {
    stateFilter.options.add(new Option(s.name, String(s.i), false, s.i === filterState.stateId));
  });
  dialogState.set(dialogId, "filters", filterState);
}

function getProvincesData(): Province[] {
  const provinces = pack.provinces.filter(province => province.i && !province.removed);
  const filtered =
    filterState.stateId === -1 ? provinces : provinces.filter(province => province.state === filterState.stateId);
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
      const rural = p.rural! * populationRate;
      const urban = p.urban! * populationRate * urbanization;
      const population = getProvincePopulation(p);
      const populationTip = `Total population: ${si(population)}; Rural population: ${si(rural)}; Urban population: ${si(urban)}`;
      const stateName = pack.states[p.state].name;
      const separable = p.burg && p.burg !== pack.states[p.state].capital;
      const focused = select<SVGElement, unknown>("#deftemp").select(`#fog #focusProvince${p.i}`).size();
      EmblemRenderer.trigger(`provinceCOA${p.i}`, p.coa);
      return /* html */ `<div class="states" data-id=${p.i}>
      <fill-box data-col="color" fill="${p.color}"></fill-box>
      <input data-col="name" data-tip="Province name. Click to change" class="name pointer" value="${p.name}" readonly />
      <svg data-col="emblem" data-tip="Click to show and edit province emblem" class="coaIcon pointer" viewBox="0 0 200 200"><use href="#provinceCOA${p.i}"></use></svg>
      <input data-col="form" data-tip="Province form name. Click to change" class="name pointer" value="${p.formName}" readonly />
      <div data-col="capital">
        <span data-tip="Province capital. Click to zoom into view" class="icon-star-empty pointer ${p.burg ? "" : "placeholder"}"></span>
        <select data-tip="Province capital. Click to select from burgs within the state. No capital means the province is governed from the state capital" class="cultureBase ${p.burgs!.length ? "" : "placeholder"}">${p.burgs!.length ? getCapitalOptions(p.burgs!, p.burg) : ""}</select>
      </div>
      <input data-col="state" data-tip="Province owner" class="provinceOwner" value="${stateName}" disabled>
      <div data-col="burgs">
        <span data-tip="Click to overview province burgs" class="icon-dot-circled pointer"></span>
        <span data-tip="Burgs count" class="provinceBurgs">${percentage ? `${rn(totals.burgs ? (p.burgs!.length / totals.burgs) * 100 : 0)}%` : p.burgs!.length}</span>
      </div>
      <div data-col="area">
        <span data-tip="Province area" class="icon-map-o" style="padding-right: 4px"></span>
        <span data-tip="Province area" class="biomeArea">${percentage ? `${rn(totals.area ? (area / totals.area) * 100 : 0)}%` : si(area) + unit}</span>
      </div>
      <div data-col="population">
        <span data-tip="${populationTip}" class="icon-male"></span>
        <span data-tip="${populationTip}" class="culturePopulation">${percentage ? `${rn(totals.population ? (population / totals.population) * 100 : 0)}%` : si(population)}</span>
      </div>
      <div data-col="actions"><span data-tip="Declare province independence (turn non-capital province with burgs into a new state)" class="icon-flag-empty ${separable ? "" : "placeholder"}"></span><span data-tip="Locate the province" class="icon-target"></span><span data-tip="Toggle province focus" class="icon-pin ${focused ? "" : " inactive"}"></span><span data-tip="Lock the province" class="icon-lock${p.lock ? "" : "-open"}"></span><span data-tip="Remove the province" class="icon-trash-empty"></span></div>
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

  updateDialog(dialogId, { width: "fit-content", position });
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
  if (customization) return;
  const animate = transition().duration(2000).ease(easeSinIn);
  select<SVGGElement, unknown>("#provs")
    .select(`#province${province}`)
    .raise()
    .transition(animate)
    .attr("stroke-width", 2.5)
    .attr("stroke", "#d0240f");
}

function provinceHighlightOff(event: Event): void {
  const province = (event.target as HTMLElement)?.dataset?.id ? +(event.target as HTMLElement).dataset.id! : null;
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
  confirmationDialog({
    title: "Declare independence",
    message: "Are you sure you want to declare province independence? <br>It will turn province into a new state",
    confirm: "Declare",
    onConfirm: () => {
      const result = declareProvinceIndependence(p);
      if (!result) return;
      const [oldStateId, newStateId] = result;
      updateStatesPostRelease([oldStateId], [newStateId]);
    }
  });
}

function declareProvinceIndependence(provinceId: number): [number, number] | undefined {
  const { states, provinces, cells, burgs } = pack;
  const province = provinces[provinceId];
  const { name, burg: burgId, burgs: provinceBurgs } = province;

  if (provinceBurgs!.some(b => burgs[b].capital)) {
    tip("Cannot declare independence of a province having capital burg. Please change capital first", false, "error");
    return;
  }
  if (!burgId) {
    tip("Cannot declare independence of a province without burg", false, "error");
    return;
  }

  const oldStateId = province.state;
  const newStateId = states.length;

  // turn province burg into a capital
  const capital = burgs[burgId];
  capital.capital = 1;
  Burgs.changeGroup(capital);
  Layers.draw("burgIcons", "labels");

  // move all burgs to a new state
  province.burgs!.forEach(b => {
    burgs[b].state = newStateId;
  });

  // define new state attributes
  const { cell: center, culture } = burgs[burgId];
  const color = getRandomColor();
  const coa = province.coa;
  const coaEl = findEl(`provinceCOA${provinceId}`); // not rendered unless the emblem was in the viewport
  if (coaEl) coaEl.id = `stateCOA${newStateId}`;
  removeEmblem("province", provinceId);

  // update cells
  cells.i
    .filter(i => cells.province[i] === provinceId)
    .forEach(i => {
      cells.province[i] = 0;
      cells.state[i] = newStateId;
    });

  // update diplomacy and reverse relations
  const diplomacy = states.map(s => {
    if (!s.i || s.removed) return "x";
    let relations = states[oldStateId].diplomacy![s.i]; // relations between Nth state and old overlord
    // new state is Enemy to its old owner
    if (s.i === oldStateId) relations = "Enemy";
    else if (relations === "Ally") relations = "Suspicion";
    else if (relations === "Friendly") relations = "Suspicion";
    else if (relations === "Suspicion") relations = "Neutral";
    else if (relations === "Enemy") relations = "Friendly";
    else if (relations === "Rival") relations = "Friendly";
    else if (relations === "Vassal") relations = "Suspicion";
    else if (relations === "Suzerain") relations = "Enemy";
    s.diplomacy!.push(relations);
    return relations;
  });
  diplomacy.push("x");
  (states[0].diplomacy as unknown as string[][]).push([
    `Independance declaration`,
    `${name} declared its independance from ${states[oldStateId].name}`
  ]);

  // create new state
  states.push({
    i: newStateId,
    name,
    diplomacy,
    provinces: [],
    color,
    expansionism: 0.5,
    capital: burgId,
    type: "Generic",
    center,
    culture,
    military: [],
    alert: 1,
    coa
  } as unknown as (typeof states)[number]);

  // remove old province
  states[oldStateId].provinces = states[oldStateId].provinces!.filter(p => p !== provinceId);
  provinces[provinceId] = { i: provinceId, removed: true } as Province;

  return [oldStateId, newStateId];
}

function updateStatesPostRelease(oldStates: number[], newStates: number[]): void {
  const allStates = unique([...oldStates, ...newStates]);

  Layers.hide("provinces");
  Layers.show("states", "borders");

  States.getPoles();
  States.findNeighbors();
  States.collectStatistics();
  States.defineStateForms(newStates);
  Layers.draw("labels");

  redrawEmblems(allStates.map(stateId => ["state", stateId] as const));

  Layers.hide("provinces");
  Layers.show("states", "borders");

  unfog();
  closeDialogs();
  void Controllers.StatesEditor.open();
}

function changePopulation(province: number): void {
  const p = pack.provinces[province];
  const cells = pack.cells.i.filter(i => pack.cells.province[i] === province);
  if (!cells.length) {
    tip("Province does not have any cells, cannot change population", false, "error");
    return;
  }
  const rural = rn(p.rural! * populationRate);
  const urban = rn(p.urban! * populationRate * urbanization);
  const total = rural + urban;
  const l = (n: number): string => Number(n).toLocaleString();

  alertMessage.innerHTML = /* html */ ` Rural: <input type="number" min="0" step="1" id="ruralPop" value=${rural} style="width:6em" /> Urban:
    <input type="number" min="0" step="1" id="urbanPop" value=${urban} style="width:6em" ${p.burgs!.length ? "" : "disabled"} />
    <p>Total population: ${l(total)} ⇒ <span id="totalPop">${l(total)}</span> (<span id="totalPopPerc">100</span>%)</p>`;

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

  $("#alert").dialog({
    resizable: false,
    title: "Change province population",
    width: "24em",
    buttons: {
      Apply: function (this: HTMLElement) {
        applyPopulationChange();
        $(this).dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    },
    position: { my: "center", at: "center", of: "svg" }
  });

  function applyPopulationChange(): void {
    const ruralChange = +ruralPop.value / rural;
    if (Number.isFinite(ruralChange) && ruralChange !== 1) {
      cells.forEach(i => {
        pack.cells.pop[i] *= ruralChange;
      });
    }
    if (!Number.isFinite(ruralChange) && +ruralPop.value > 0) {
      const points = +ruralPop.value / populationRate;
      const pop = rn(points / cells.length);
      cells.forEach(i => {
        pack.cells.pop[i] = pop;
      });
    }

    const urbanChange = +urbanPop.value / urban;
    if (Number.isFinite(urbanChange) && urbanChange !== 1) {
      p.burgs!.forEach(b => {
        pack.burgs[b].population = rn((pack.burgs[b].population ?? 0) * urbanChange, 4);
      });
    }
    if (!Number.isFinite(urbanChange) && +urbanPop.value > 0) {
      const points = +urbanPop.value / populationRate / urbanization;
      const population = rn(points / p.burgs!.length, 4);
      p.burgs!.forEach(b => {
        pack.burgs[b].population = population;
      });
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
  alertMessage.innerHTML = /* html */ `Are you sure you want to remove the province? <br />This action cannot be reverted`;
  $("#alert").dialog({
    resizable: false,
    title: "Remove province",
    buttons: {
      Remove: function (this: HTMLElement) {
        pack.cells.province.forEach((province, i) => {
          if (province === p) pack.cells.province[i] = 0;
        });
        const s = pack.provinces[p].state;
        const state = pack.states[s];
        if (state.provinces!.includes(p)) state.provinces!.splice(state.provinces!.indexOf(p), 1);

        unfog(`focusProvince${p}`);

        removeEmblem("province", p);
        pack.provinces[p] = { i: p, removed: true } as Province;

        const g = select<SVGGElement, unknown>("#provs").select("#provincesBody");
        g.select(`#province${p}`).remove();
        g.select(`#province-gap${p}`).remove();
        Layers.draw("borders");
        Layers.draw("labels");
        refreshProvincesEditor();
        $(this).dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
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
  ensureEl("provinceCultureDisplay").innerText = pack.cultures[cultureId].name;

  $("#provinceNameEditor").dialog({
    resizable: false,
    title: "Change province name",
    buttons: {
      Apply: function (this: HTMLElement) {
        applyNameChange(p);
        $(this).dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    },
    position: { my: "center", at: "center", of: "svg" },
    close: closeProvinceNameEditor
  });
}

function renderNameEditor(): void {
  destroyDialog("provinceNameEditor");
  const nameEditorHtml = /* html */ `<div id="provinceNameEditor" class="dialog" data-province="0">
      <div>
        <div data-tip="Province short name" class="label">Short name:</div>
        <input
          id="provinceNameEditorShort"
          data-tip="Type to change the short name"
          autocorrect="off"
          spellcheck="false"
          style="width: 11em"
        />
        <span id="provinceNameEditorShortSpeak" data-tip="Speak the name. You can change voice and language in options" class="speaker">🔊</span>
        <span
          id="provinceNameEditorShortCulture"
          data-tip="Generate culture-specific name for the province"
          class="icon-book pointer"
        ></span>
        <span id="provinceNameEditorShortRandom" data-tip="Generate random name" class="icon-globe pointer"></span>
      </div>
      <div data-tip="Select form name">
        <div data-tip="Province form name" class="label">Form name:</div>
        <select id="provinceNameEditorSelectForm" style="display: inline-block; width: 11em; height: 1.645em">
          <option value="">blank</option>
          <option value="Area">Area</option>
          <option value="Autonomy">Autonomy</option>
          <option value="Barony">Barony</option>
          <option value="Canton">Canton</option>
          <option value="Captaincy">Captaincy</option>
          <option value="Chiefdom">Chiefdom</option>
          <option value="Clan">Clan</option>
          <option value="Colony">Colony</option>
          <option value="Council">Council</option>
          <option value="County">County</option>
          <option value="Deanery">Deanery</option>
          <option value="Department">Department</option>
          <option value="Dependency">Dependency</option>
          <option value="Diaconate">Diaconate</option>
          <option value="District">District</option>
          <option value="Earldom">Earldom</option>
          <option value="Governorate">Governorate</option>
          <option value="Island">Island</option>
          <option value="Islands">Islands</option>
          <option value="Land">Land</option>
          <option value="Landgrave">Landgrave</option>
          <option value="Mandate">Mandate</option>
          <option value="Margrave">Margrave</option>
          <option value="Municipality">Municipality</option>
          <option value="Occupation zone">Occupation zone</option>
          <option value="Parish">Parish</option>
          <option value="Prefecture">Prefecture</option>
          <option value="Province">Province</option>
          <option value="Region">Region</option>
          <option value="Republic">Republic</option>
          <option value="Reservation">Reservation</option>
          <option value="Seneschalty">Seneschalty</option>
          <option value="Shire">Shire</option>
          <option value="State">State</option>
          <option value="Territory">Territory</option>
          <option value="Tribe">Tribe</option>
        </select>
        <input
          id="provinceNameEditorCustomForm"
          placeholder="type form name"
          data-tip="Create custom province form name"
          style="display: none; width: 11em"
        />
        <span
          id="provinceNameEditorAddForm"
          data-tip="Click to add custom province form name to the list"
          class="icon-plus pointer"
        ></span>
      </div>
      <div>
        <div data-tip="Province full name" class="label">Full name:</div>
        <input
          id="provinceNameEditorFull"
          data-tip="Type to change the full name"
          autocorrect="off"
          spellcheck="false"
          style="width: 11em"
        />
        <span id="provinceNameEditorFullSpeak" data-tip="Speak the name. You can change voice and language in options" class="speaker">🔊</span>
        <span
          id="provinceNameEditorFullRegenerate"
          data-tip="Click to re-generate full name"
          class="icon-arrows-cw pointer"
        ></span>
      </div>
      <div
        id="provinceCultureName"
        data-tip="Dominant culture in the province. This defines culture-based naming. Can be changed via the Cultures Editor"
        style="margin-top: 0.2em"
      >
        Dominant culture:&nbsp;<span id="provinceCultureDisplay"></span>
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
  $("#provinceNameEditor").dialog("destroy");
  ensureEl("provinceNameEditor").remove();
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
  p.name = ensureEl<HTMLInputElement>("provinceNameEditorShort").value;
  p.formName = ensureEl<HTMLSelectElement>("provinceNameEditorSelectForm").value;
  p.fullName = ensureEl<HTMLInputElement>("provinceNameEditorFull").value;
  Layers.draw("provinces");
  Layers.draw("labels");
  refreshProvincesEditor();
}

function changeCapital(p: number, line: HTMLElement, value: string): void {
  line.dataset.capital = pack.burgs[+value].name;
  pack.provinces[p].center = pack.burgs[+value].cell;
  pack.provinces[p].burg = +value;
}

function togglePercentageMode(): void {
  const body = ensureEl("provincesBodySection");
  body.dataset.type = body.dataset.type === "absolute" ? "percentage" : "absolute";
  provincesTable.refresh();
}

type TreeNode = any;

function showChart(): void {
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
  alertMessage.innerHTML = /* html */ `<select id="provincesTreeType" style="display:block; margin-left:13px; font-size:11px">
    <option value="area" selected>Area</option>
    <option value="population">Total population</option>
    <option value="rural">Rural population</option>
    <option value="urban">Urban population</option>
  </select>`;
  alertMessage.innerHTML += `<div id='provinceInfo' class='chartInfo'>&#8205;</div>`;
  const svg = select("#alertMessage")
    .insert("svg", "#provinceInfo")
    .attr("id", "provincesTree")
    .attr("width", width)
    .attr("height", height)
    .attr("font-size", "10px");
  const graph = svg.append("g").attr("transform", `translate(10, 0)`);
  ensureEl("provincesTreeType").addEventListener("change", updateChart);

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
    const rural = rn(d.data.rural * populationRate);
    const urban = rn(d.data.urban * populationRate * urbanization);

    const typeValue = ensureEl<HTMLSelectElement>("provincesTreeType").value;
    const value =
      typeValue === "area"
        ? `Area: ${area}`
        : typeValue === "rural"
          ? `Rural population: ${si(rural)}`
          : typeValue === "urban"
            ? `Urban population: ${si(urban)}`
            : `Population: ${si(rural + urban)}`;

    ensureEl("provinceInfo").innerHTML = /* html */ `${name}. ${state}. ${value}`;
    provinceHighlightOn(ev);
  }

  function hideInfo(ev: any): void {
    provinceHighlightOff(ev);
    if (!document.getElementById("provinceInfo")) return;
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

  $("#alert").dialog({
    title: "Provinces chart",
    width: "fit-content",
    position: { my: "left bottom", at: "left+10 bottom-10", of: "svg" },
    buttons: {},
    close: () => {
      alertMessage.innerHTML = "";
    }
  });

  hideNonfittingLabels();
}

function triggerProvincesRelease(): void {
  confirmationDialog({
    title: "Release provinces",
    message: `Are you sure you want to release all provinces?
        </br>It will turn all separable provinces into independent states.
        </br>Capital province and provinces without any burgs will state as they are`,
    confirm: "Release",
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
    title: "Paint Provinces",
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
      tip("Province center cannot be assigned to a different region. Please remove the province first", false, "error");
      return false;
    },
    dontOverrideControl: true,
    onApply: applyProvincePaint
  });
}

function applyProvincePaint(changes: ReadonlyMap<number, number>): void {
  for (const [cell, province] of changes) pack.cells.province[cell] = province;

  Provinces.getPoles();
  Layers.draw("borders", "provinces");
  Layers.draw("labels");

  if (document.getElementById(dialogId)) refreshProvincesEditor();
}

function enterAddProvinceMode(this: HTMLElement): void {
  if (this.classList.contains("pressed")) {
    exitAddProvinceMode();
    return;
  }

  customization = 12;
  this.classList.add("pressed");
  tip("Click on the map to place a new province center", true);
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addProvince);
  ensureEl("provincesBodySection")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.pointerEvents = "none";
    });
}

function addProvince(this: SVGElement, event: any): void {
  const { cells, provinces } = pack;
  const point = getPointer(event, this);
  const center = Pack.findCell(point[0], point[1])!;
  if (cells.h[center] < 20) {
    tip("You cannot place province into the water. Please click on a land cell", false, "error");
    return;
  }

  const oldProvince = cells.province[center];
  if (oldProvince && provinces[oldProvince].center === center) {
    tip("The cell is already a center of a different province. Select other cell", false, "error");
    return;
  }

  const state = cells.state[center];
  if (!state) {
    tip("You cannot create a province in neutral lands. Please assign this land to a state first", false, "error");
    return;
  }

  if (event.shiftKey === false) exitAddProvinceMode();

  const province = provinces.length;
  pack.states[state].provinces!.push(province);
  const burg = cells.burg[center];
  const c = cells.culture[center];
  const name = burg ? pack.burgs[burg].name : Names.getState(Names.getCultureShort(c), c);
  const formName = oldProvince ? provinces[oldProvince].formName : "Province";
  const fullName = `${name} ${formName}`;
  const stateColor = pack.states[state].color!;
  const rndColor = getRandomColor();
  const color = stateColor[0] === "#" ? d3Color(interpolate(stateColor, rndColor)(0.2))!.hex() : rndColor;

  // generate emblem
  const kinship = burg ? 0.8 : 0.4;
  const parent = burg ? pack.burgs[burg].coa : pack.states[state].coa;
  const port = burg ? pack.burgs[burg].port : undefined;
  const type = Burgs.getType(center, port);
  const coa = Emblems.generate(parent, kinship, +P(0.1), type);
  coa.shield = Emblems.getShield(c, state);
  provinces.push({ i: province, state, center, burg, name, formName, fullName, color, coa } as Province);
  redrawEmblem("province", province);

  cells.province[center] = province;
  cells.c[center].forEach(nc => {
    if (cells.h[nc] < 20 || cells.state[nc] !== state) return;
    if (provinces.find(p => !p.removed && p.center === nc)) return;
    cells.province[nc] = province;
  });

  Layers.draw("borders", "provinces");
  Layers.draw("labels");

  collectStatistics();
  filterState.stateId = state;
  dialogState.set(dialogId, "filters", filterState);
  ensureEl<HTMLSelectElement>("provincesFilterState").value = String(filterState.stateId);
  provincesTable.reset();
}

function exitAddProvinceMode(): void {
  customization = 0;
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

  Layers.show("provinces");
}

function downloadProvincesData(): void {
  const unit = areaUnit.value === "square" ? `${distanceUnitInput.value}2` : areaUnit.value;
  let data = `Id,Province,Full Name,Form,State,Color,Capital,Area ${unit},Total Population,Rural Population,Urban Population,Burgs\n`; // headers

  for (const province of getProvincesData()) {
    const capital = province.burg ? pack.burgs[province.burg].name : "";
    data += `${province.i},${province.name},${province.fullName},${province.formName},${pack.states[province.state].name},${province.color},${capital},${getProvinceArea(province)},${getProvincePopulation(province)},${Math.round(province.rural! * populationRate)},${Math.round(province.urban! * populationRate * urbanization)},${province.burgs!.length}\n`;
  }

  const name = `${getFileName("Provinces")}.csv`;
  downloadFile(data, name);
}

function removeAllProvinces(): void {
  alertMessage.innerHTML = /* html */ `Are you sure you want to remove all provinces? <br />This action cannot be reverted`;
  $("#alert").dialog({
    resizable: false,
    title: "Remove all provinces",
    buttons: {
      Remove: function (this: HTMLElement) {
        $(this).dialog("close");

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
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function closeProvincesEditor(): void {
  if (customization === 12) exitAddProvinceMode();
  $("#provincesEditor").dialog("destroy");
  ensureEl("provincesEditor").remove();
}

function openProvinceMergeDialog(): void {
  const selectedState = filterState.stateId;
  if (selectedState === -1) {
    alertMessage.innerHTML = "Please select a specific state from the filter to merge provinces within that state.";
    $("#alert").dialog({
      title: "Merge Provinces",
      buttons: {
        OK: function (this: HTMLElement) {
          $(this).dialog("close");
        }
      }
    });
    return;
  }
  const provincesToMerge = pack.provinces.filter(p => p.i && !p.removed && p.state === selectedState);
  if (provincesToMerge.length < 2) {
    alertMessage.innerHTML = "Not enough provinces in the selected state to merge.";
    $("#alert").dialog({
      title: "Merge Provinces",
      buttons: {
        OK: function (this: HTMLElement) {
          $(this).dialog("close");
        }
      }
    });
    return;
  }

  const emblem = (i: number): string =>
    /* html */ `<svg class="coaIcon" viewBox="0 0 200 200"><use href="#provinceCOA${i}"></use></svg>`;
  const provincesSelector = provincesToMerge
    .map(
      p => /* html */ `
    <div data-id="${p.i}" data-tip="${p.fullName || p.name}" style="cursor:default">
      <input type="radio" name="rulingProvince" value="${p.i}" />
      <input id="selectProvince${p.i}" class="checkbox" type="checkbox" name="provincesToMerge" value="${p.i}" />
      <label for="selectProvince${p.i}" class="checkbox-label"><fill-box fill="${p.color}" disabled></fill-box>${emblem(p.i)}${p.name}</label>
    </div>
  `
    )
    .join("");

  alertMessage.innerHTML = /* html */ `
    <form id='mergeProvincesForm' style="overflow: hidden; display: flex; flex-direction: column; gap: 1em;">
      <p style="margin:0">
        Check the <b>checkbox</b> next to each province you want to merge.
        Use the <b>radio button</b> to pick the <em>primary province</em> that will absorb all others.
        Hover over a row to highlight the province on the map.
      </p>
      <main style='display: grid; grid-template-columns: 1fr 1fr; gap: .3em;'>
        ${provincesSelector}
      </main>
    </form>
  `;

  ensureEl("mergeProvincesForm")
    .querySelectorAll("div[data-id]")
    .forEach(el => {
      el.addEventListener("mouseenter", highlightProvinceOnMergeHover);
      el.addEventListener("mouseleave", provinceHighlightOff);
    });

  $("#alert").dialog({
    width: 600,
    title: `Merge provinces`,
    close: provinceHighlightOff,
    buttons: {
      Merge: function (this: HTMLElement) {
        const formData = new FormData(ensureEl<HTMLFormElement>("mergeProvincesForm"));
        const primaryProvinceId = Number(formData.get("rulingProvince"));
        if (!primaryProvinceId) {
          tip("Please select a province to merge into", false, "error");
          return;
        }

        const provincesToMergeIds = formData
          .getAll("provincesToMerge")
          .map(Number)
          .filter(provinceId => provinceId !== primaryProvinceId);
        if (!provincesToMergeIds.length) {
          tip("Please select several provinces to merge", false, "error");
          return;
        }

        confirmationDialog({
          title: "Merge provinces",
          message: /* html */ `
            <p>The following provinces will be <strong>removed</strong>: ${provincesToMergeIds
              .map(provinceId => `${emblem(provinceId)}${pack.provinces[provinceId].name}`)
              .join(", ")}.</p>
            <p>Removed provinces data (burgs and cells) will be assigned to ${emblem(primaryProvinceId)}${pack.provinces[primaryProvinceId].name}.</p>
            <p>Are you sure you want to merge provinces? This action cannot be reverted.</p>`,
          confirm: "Merge",
          onConfirm: () => {
            mergeProvinces(provincesToMergeIds, primaryProvinceId);
            $(this).dialog("close");
          }
        });
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function highlightProvinceOnMergeHover(event: Event): void {
  if (!Layers.isOn("provinces")) return;
  const province = +(event.currentTarget as HTMLElement).dataset.id!;
  if (!province) return;
  const d = select<SVGGElement, unknown>("#provs").select(`#province${province}`).attr("d");
  if (!d) return;

  provinceHighlightOff(event);

  const path = select("#debug")
    .append("path")
    .attr("class", "highlight")
    .attr("d", d)
    .attr("fill", "none")
    .attr("stroke", "red")
    .attr("stroke-width", 1)
    .attr("opacity", 1)
    .attr("filter", "url(#blur1)");

  const totalLength = (path.node() as SVGPathElement).getTotalLength();
  const duration = (totalLength + 5000) / 2;
  const interp = interpolateString(`0, ${totalLength}`, `${totalLength}, ${totalLength}`);
  path
    .transition()
    .duration(duration)
    .attrTween("stroke-dasharray", () => interp);
}

function cleanupMergedProvince(provinceId: number): void {
  // Clean up UI artifacts for a province being merged (similar to removeProvince cleanup)
  unfog(`focusProvince${provinceId}`);

  removeEmblem("province", provinceId);
}

function mergeProvinces(ids: number[], primary: number): void {
  const primaryProvince = pack.provinces[primary];
  const provinceIdMap = new Map<number, number>();

  ids.forEach(id => {
    if (id === primary) return;
    const province = pack.provinces[id];

    // merge burgs
    province.burgs!.forEach(b => {
      (pack.burgs[b] as unknown as { province: number }).province = primary;
      if (!primaryProvince.burgs!.includes(b)) primaryProvince.burgs!.push(b);
    });
    if (!primaryProvince.burg && province.burg) {
      primaryProvince.burg = province.burg;
    }

    // Add to map for later cell reassignment
    provinceIdMap.set(id, primary);

    // Clean up UI artifacts before marking as removed
    cleanupMergedProvince(id);

    // remove province
    pack.provinces[id] = { i: id, removed: true } as Province;
  });

  // Single pass over cells to remap all merged province ids at once
  pack.cells.province.forEach((oldProvinceId, cellIndex) => {
    const newProvinceId = provinceIdMap.get(oldProvinceId);
    if (newProvinceId !== undefined) {
      pack.cells.province[cellIndex] = newProvinceId;
    }
  });

  // update state's provinces list
  const state = pack.states[primaryProvince.state];
  state.provinces = state.provinces!.filter(p => !pack.provinces[p].removed);

  // recalculate province statistics and poles
  collectStatistics();
  Provinces.getPoles();

  // redraw layers that may have changed
  Layers.draw("provinces", "borders");
  Layers.draw("labels");

  // clear any fog or debug highlights
  unfog();
  select("#debug").selectAll(".highlight").remove();

  refreshProvincesEditor();
}

function updateLockStatus(provinceId: number, classList: DOMTokenList): void {
  const p = pack.provinces[provinceId];
  p.lock = !p.lock;

  classList.toggle("icon-lock-open");
  classList.toggle("icon-lock");
}

export const ProvincesEditor = { open };
