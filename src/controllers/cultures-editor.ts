import { csvParse, drag, easeSinIn, select, transition } from "d3";
import { closeDialogs, confirmationDialog, destroyDialog, updateDialog } from "@/components/dialog/dialog-helpers";
import { applyLineHighlighting } from "@/components/dialog/highlighting";
import { bindColumnSorting, sortDataByColumns } from "@/components/dialog/sorting";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  setModeHiddenColumns,
  type TableView
} from "@/components/dialog/table";
import type { FillBoxElement } from "@/components/fill-box";
import { Layers } from "@/components/layers";
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import { CULTURE_TYPES, type Culture } from "@/generators/cultures-generator";
import { Emblems } from "@/generators/emblems-generator";
import { clearLegend, drawLegend } from "@/renderers/draw-legend";
import { EmblemRenderer } from "@/renderers/emblems/renderer";
import { highlightElement } from "@/renderers/overlays/highlight";
import type { Emblem } from "@/types/emblems";
import { downloadFile, getArea, getAreaUnit, getFileName } from "@/utils";
import { abbreviate, capitalize, debounce, ensureEl, getPointer, isLand, parseTransform, ra, rn, si } from "../utils";

const dialogId = "culturesEditor" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
const columns: EditorColumn<Culture>[] = [
  { key: "color", width: "1.2em", permanent: true },
  {
    key: "name",
    label: "Culture",
    width: "10em",
    permanent: true,
    sortBy: culture => culture.name || "",
    sortType: "alpha"
  },
  {
    key: "type",
    label: "Type",
    width: "6em",
    mobileHidden: true,
    sortBy: culture => culture.type || "",
    sortType: "alpha"
  },
  {
    key: "base",
    label: "Namesbase",
    width: "9em",
    mobileHidden: true,
    sortBy: culture => culture.base
  },
  {
    key: "cells",
    label: "Cells",
    width: "5em",
    hidden: true,
    sortBy: culture => culture.cells || 0
  },
  {
    key: "expansionism",
    label: "Expansion",
    width: "5em",
    hidden: true,
    mobileHidden: true,
    sortBy: culture => culture.expansionism || 0
  },
  {
    key: "area",
    label: "Area",
    width: "7em",
    mobileHidden: true,
    sortBy: culture => culture.area || 0
  },
  {
    key: "population",
    label: "Population",
    width: "6em",
    defaultSort: "desc",
    sortBy: culture => (culture.rural || 0) * populationRate + (culture.urban || 0) * populationRate * urbanization
  },
  {
    key: "emblems",
    label: "Emblems",
    width: "7em",
    hidden: true,
    mobileHidden: true,
    sortBy: culture => culture.shield || "",
    sortType: "alpha"
  },
  { key: "actions", width: "3.2em", permanent: true, align: "right" }
];

const culturesTable = initEditorTable<Culture>({
  getData: () =>
    sortDataByColumns(
      dialogId,
      pack.cultures.filter(c => !c.removed),
      columns
    ),
  onUpdate: culturesEditorAddLines
});

function open(): void {
  if (customization) return;
  closeDialogs(`#${dialogId}, .stable`);
  Layers.show("cultures");
  Layers.hide("states", "biomes");
  Layers.hide("religions", "provinces");

  renderDialog();
  culturesCollectStatistics();
  drawCultureCenters();
  culturesTable.reset();

  $(`#${dialogId}`).dialog({
    title: "Cultures Editor",
    resizable: false,
    width: "fit-content",
    close: closeCulturesEditor,
    position
  });
}

function renderDialog(): void {
  destroyDialog("culturesEditor");
  const editorHtml = /* html */ `<div id="culturesEditor" class="dialog stable editorDialog">
    <div id="culturesBody" class="table" data-type="absolute">${renderEditorHeader({ dialogId, columns })}</div>

    <div id="culturesFooter" class="totalLine">
      <div data-tip="Cultures number" style="margin-left: 12px">Cultures:&nbsp;<span id="culturesFooterCultures">0</span></div>
      <div data-tip="Total land cells number" style="margin-left: 12px" data-col="cells">Cells:&nbsp;<span id="culturesFooterCells">0</span></div>
      <div data-tip="Total land area" style="margin-left: 12px" data-col="area">Land Area:&nbsp;<span id="culturesFooterArea">0</span></div>
      <div data-tip="Total population" style="margin-left: 12px" data-col="population">Population:&nbsp;<span id="culturesFooterPopulation">0</span></div>
    </div>

    <div id="culturesBottom" class="editorToolbar">
      <button id="culturesEditorRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
      <button id="culturesEditStyle" data-tip="Edit cultures style in Style Editor" class="icon-adjust"></button>
      <button id="culturesLegend" data-tip="Toggle Legend box" class="icon-list-bullet"></button>
      <button id="culturesPercentage" data-tip="Toggle percentage / absolute values display mode" class="icon-percent"></button>
      <button id="culturesHeirarchy" data-tip="Show cultures hierarchy tree" class="icon-sitemap"></button>
      <button id="culturesManually" data-tip="Manually re-assign cultures" class="icon-brush"></button>
      <button id="culturesEditNamesBase" data-tip="Edit a database used for names generation" class="icon-font"></button>
      <button id="culturesAdd" data-tip="Add a new culture. Hold Shift to add multiple" class="icon-plus"></button>
      <button id="culturesExport" data-tip="Download cultures-related data" class="icon-download"></button>
      <button id="culturesImport" data-tip="Upload cultures-related data" class="icon-upload"></button>
      <button id="culturesRecalculate" data-tip="Recalculate cultures based on current values of growth-related attributes" class="icon-retweet"></button>
      <span
        data-tip="Allow culture centers, expansion and type changes to take an immediate effect"
        class="editorToolbarPanel"
        style="display: inline-flex"
      >
        <input id="culturesAutoChange" class="checkbox" type="checkbox" />
        <label for="culturesAutoChange" class="checkbox-label"><i>auto-apply changes</i></label>
      </span>
    </div>
  </div>`;

  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  bindColumnSorting(dialogId, culturesTable.reset);
  applyLineHighlighting(dialogId, ({ cellId }) => pack.cells.culture[cellId]);

  ensureEl("culturesEditorRefresh").addEventListener("click", refreshCulturesEditor);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });
  ensureEl("culturesEditStyle").addEventListener("click", () => editStyle("cults"));
  ensureEl("culturesLegend").addEventListener("click", toggleLegend);
  ensureEl("culturesPercentage").addEventListener("click", togglePercentageMode);
  ensureEl("culturesHeirarchy").addEventListener("click", showHierarchy);
  ensureEl("culturesRecalculate").addEventListener("click", () => recalculateCultures(true));
  ensureEl("culturesManually").addEventListener("click", openPaintEditor);
  ensureEl("culturesEditNamesBase").addEventListener("click", () => Controllers.NamesbaseEditor.open());
  ensureEl("culturesAdd").addEventListener("click", enterAddCulturesMode);
  ensureEl("culturesExport").addEventListener("click", downloadCulturesCsv);
  ensureEl("culturesImport").addEventListener("click", () => ensureEl("culturesCSVToLoad").click());
  ensureEl("culturesCSVToLoad").addEventListener("change", uploadCulturesData);
}

function refreshCulturesEditor(): void {
  culturesCollectStatistics();
  culturesTable.refresh();
  drawCultureCenters();
}

function culturesCollectStatistics(): void {
  const { cells, cultures, burgs } = pack as any;
  cultures.forEach((c: any) => {
    c.cells = c.area = c.rural = c.urban = 0;
  });

  for (const i of cells.i) {
    if (cells.h[i] < 20) continue;
    const cultureId = cells.culture[i];
    cultures[cultureId].cells += 1;
    cultures[cultureId].area += cells.area[i];
    cultures[cultureId].rural += cells.pop[i];
    const burgId = cells.burg[i];
    if (burgId) cultures[cultureId].urban += burgs[burgId].population;
  }
}

function culturesEditorAddLines(view: TableView<Culture>): void {
  const unit = getAreaUnit();
  let lines = "";
  let totalArea = 0;
  let totalPopulation = 0;

  // totals span the full filtered set, not just the current page
  for (const c of view.all) {
    totalArea += getArea(c.area ?? 0);
    totalPopulation += rn((c.rural ?? 0) * populationRate + (c.urban ?? 0) * populationRate * urbanization);
  }

  for (const c of view.rows) {
    const area = getArea(c.area ?? 0);
    const rural = (c.rural ?? 0) * populationRate;
    const urban = (c.urban ?? 0) * populationRate * urbanization;
    const population = rn(rural + urban);
    const populationTip = `Total population: ${si(population)}. Rural population: ${si(rural)}. Urban population: ${si(
      urban
    )}. Click to edit`;

    if (!c.i) {
      // Uncultured (neutral) line
      lines += /* html */ `<div
          class="states"
          data-id="${c.i}"
          data-name="${c.name}"
          data-color=""
          data-cells="${c.cells}"
          data-area="${area}"
          data-population="${population}"
          data-base="${c.base}"
          data-type=""
          data-expansionism=""
          data-emblems="${c.shield}"
        >
          <svg width="11" height="11" class="placeholder" data-col="color"></svg>
          <div data-col="name">
            <input data-tip="Neutral culture name. Click and type to change" class="cultureName italic"
              value="${c.name}" autocorrect="off" spellcheck="false" />
            <span class="icon-cw placeholder"></span>
          </div>
          <select class="cultureType placeholder" data-col="type">${getTypeOptions(c.type)}</select>
          <div data-col="base">
            <span data-tip="Click to re-generate names for burgs with this culture assigned" class="icon-arrows-cw"></span>
            <select data-tip="Culture namesbase. Click to change. Click on arrows to re-generate names"
              class="cultureBase">${getBaseOptions(c.base)}</select>
          </div>
          <div data-col="cells">
            <span data-tip="Cells count" class="icon-check-empty"></span>
            <div data-tip="Cells count" class="cultureCells">${c.cells}</div>
          </div>
          <div data-col="expansionism">
            <span class="icon-resize-full placeholder"></span>
            <input class="cultureExpan placeholder" type="number" />
          </div>
          <div data-col="area">
            <span data-tip="Culture area" class="icon-map-o"></span>
            <div data-tip="Culture area" class="cultureArea">${si(area)} ${unit}</div>
          </div>
          <div data-col="population">
            <span data-tip="${populationTip}" class="icon-male"></span>
            <div data-tip="${populationTip}" class="culturePopulation pointer">${si(population)}</div>
          </div>
          <div data-col="emblems">${getShapeOptions(Emblems.isDiversiform, c.shield)}</div>
          <div data-col="actions"></div>
        </div>`;
      continue;
    }

    lines += /* html */ `<div
        class="states"
        data-id="${c.i}"
        data-name="${c.name}"
        data-color="${c.color}"
        data-cells="${c.cells}"
        data-area="${area}"
        data-population="${population}"
        data-base="${c.base}"
        data-type="${c.type}"
        data-expansionism="${c.expansionism}"
        data-emblems="${c.shield}"
      >
        <fill-box fill="${c.color}" data-col="color"></fill-box>
        <div data-col="name">
          <input data-tip="Culture name. Click and type to change" class="cultureName"
            value="${c.name}" autocorrect="off" spellcheck="false" />
          <span data-tip="Regenerate culture name" class="icon-cw hiddenIcon" style="visibility: hidden"></span>
        </div>
        <select data-tip="Culture type. Defines growth model. Click to change"
          class="cultureType" data-col="type">${getTypeOptions(c.type)}</select>
        <div data-col="base">
          <span data-tip="Click to re-generate names for burgs with this culture assigned" class="icon-arrows-cw"></span>
          <select data-tip="Culture namesbase. Click to change. Click on arrows to re-generate names"
            class="cultureBase">${getBaseOptions(c.base)}</select>
        </div>
        <div data-col="cells">
          <span data-tip="Cells count" class="icon-check-empty"></span>
          <div data-tip="Cells count" class="cultureCells">${c.cells}</div>
        </div>
        <div data-col="expansionism">
          <span data-tip="Culture expansionism. Defines competitive size" class="icon-resize-full"></span>
          <input
            data-tip="Culture expansionism. Defines competitive size. Click to change, then click Recalculate to apply change"
            class="cultureExpan"
            type="number"
            min="0"
            max="99"
            step=".1"
            value=${c.expansionism}
          />
        </div>
        <div data-col="area">
          <span data-tip="Culture area" class="icon-map-o"></span>
          <div data-tip="Culture area" class="cultureArea">${si(area)} ${unit}</div>
        </div>
        <div data-col="population">
          <span data-tip="${populationTip}" class="icon-male"></span>
          <div data-tip="${populationTip}" class="culturePopulation pointer">${si(population)}</div>
        </div>
        <div data-col="emblems">${getShapeOptions(Emblems.isDiversiform, c.shield)}</div>
        <div data-col="actions">
          <span data-tip="Locate the culture" class="icon-target"></span>
          <span data-tip="Lock culture" class="icon-lock${c.lock ? "" : "-open"}"></span>
          <span data-tip="Remove culture" class="icon-trash-empty"></span>
        </div>
      </div>`;
  }
  const body = ensureEl("culturesBody");
  body.querySelectorAll(":scope > .states").forEach(row => {
    row.remove();
  });
  body.insertAdjacentHTML("beforeend", lines);
  // update footer
  ensureEl("culturesFooterCultures").innerHTML = String(pack.cultures.filter(c => c.i && !c.removed).length);
  ensureEl("culturesFooterCells").innerHTML = String((pack.cells.h as unknown as number[]).filter(h => h >= 20).length);
  ensureEl("culturesFooterArea").innerHTML = `${si(totalArea)} ${unit}`;
  ensureEl("culturesFooterPopulation").innerHTML = si(totalPopulation);
  ensureEl("culturesFooterArea").dataset.area = String(totalArea);
  ensureEl("culturesFooterPopulation").dataset.population = String(totalPopulation);

  renderEditorPagination(ensureEl("culturesFooter"), view, culturesTable.goto);

  // add listeners
  ensureEl("culturesBody")
    .querySelectorAll(":scope > div.states")
    .forEach($line => {
      $line.addEventListener("mouseenter", cultureHighlightOn);
      $line.addEventListener("mouseleave", cultureHighlightOff);
    });
  ensureEl("culturesBody")
    .querySelectorAll("fill-box")
    .forEach($el => void $el.addEventListener("click", cultureChangeColor));
  ensureEl("culturesBody")
    .querySelectorAll("div > input.cultureName")
    .forEach($el => void $el.addEventListener("input", cultureChangeName));
  ensureEl("culturesBody")
    .querySelectorAll("div > span.icon-cw")
    .forEach($el => void $el.addEventListener("click", cultureRegenerateName));
  ensureEl("culturesBody")
    .querySelectorAll("div > input.cultureExpan")
    .forEach($el => void $el.addEventListener("change", cultureChangeExpansionism));
  ensureEl("culturesBody")
    .querySelectorAll("div > select.cultureType")
    .forEach($el => void $el.addEventListener("change", cultureChangeType));
  ensureEl("culturesBody")
    .querySelectorAll("div > select.cultureBase")
    .forEach($el => void $el.addEventListener("change", cultureChangeBase));
  ensureEl("culturesBody")
    .querySelectorAll("div > select.cultureEmblems")
    .forEach($el => void $el.addEventListener("change", cultureChangeEmblemsShape));
  ensureEl("culturesBody")
    .querySelectorAll("div > div.culturePopulation")
    .forEach($el => void $el.addEventListener("click", changePopulation));
  ensureEl("culturesBody")
    .querySelectorAll("div > span.icon-arrows-cw")
    .forEach($el => void $el.addEventListener("click", cultureRegenerateBurgs));
  ensureEl("culturesBody")
    .querySelectorAll("div > span.icon-target")
    .forEach($el => void $el.addEventListener("click", cultureHighlightElement));
  ensureEl("culturesBody")
    .querySelectorAll("div > span.icon-trash-empty")
    .forEach($el => void $el.addEventListener("click", cultureRemovePrompt));
  ensureEl("culturesBody")
    .querySelectorAll("div > span.icon-lock")
    .forEach($el => void $el.addEventListener("click", updateLockStatus));
  ensureEl("culturesBody")
    .querySelectorAll("div > span.icon-lock-open")
    .forEach($el => void $el.addEventListener("click", updateLockStatus));

  setModeHiddenColumns(dialogId, Emblems.isDiversiform ? [] : ["emblems"]);

  if (ensureEl("culturesBody").dataset.type === "percentage") {
    ensureEl("culturesBody").dataset.type = "absolute";
    togglePercentageMode();
  }
  updateDialog(dialogId, { width: "fit-content", position });
}

function getTypeOptions(type: string): string {
  let options = "";
  CULTURE_TYPES.forEach(t => {
    options += `<option ${type === t ? "selected" : ""} value="${t}">${t}</option>`;
  });
  return options;
}

function getBaseOptions(base: number): string {
  let options = "";
  Names.nameBases.forEach((n, i) => {
    options += `<option ${base === i ? "selected" : ""} value="${i}">${n.name}</option>`;
  });
  if (!Names.nameBases[base]) options += `<option selected value="${base}">removed</option>`; // in case namesbase was removed
  return options;
}

function getShapeOptions(isDiversiform: boolean, selected: string): string {
  if (!isDiversiform) return "";

  const shapes = Object.keys(Emblems.shields.types).flatMap(type => Object.keys(Emblems.shields[type]));
  const options = shapes.map(
    shape => `<option ${shape === selected ? "selected" : ""} value="${shape}">${capitalize(shape)}</option>`
  );
  return `<select data-tip="Emblem shape associated with culture. Click to change" class="cultureEmblems">${options}</select>`;
}

const cultureHighlightOn = debounce((event: any) => {
  const cultureId = Number(event.id || event.target.dataset.id);

  if (!Layers.isOn("cultures")) return;
  if (customization) return;

  const animate = transition().duration(2000).ease(easeSinIn);
  select("#cults")
    .select(`#culture${cultureId}`)
    .raise()
    .transition(animate)
    .attr("stroke-width", 2.5)
    .attr("stroke", "#d0240f");
  select("#debug")
    .select(`#cultureCenter${cultureId}`)
    .raise()
    .transition(animate)
    .attr("r", 3)
    .attr("stroke", "#d0240f");
}, 200);

function cultureHighlightOff(event: any): void {
  const cultureId = Number(event.id || event.target.dataset.id);

  if (!Layers.isOn("cultures")) return;
  select("#cults").select(`#culture${cultureId}`).transition().attr("stroke-width", null).attr("stroke", null);
  select("#debug").select(`#cultureCenter${cultureId}`).transition().attr("r", 2).attr("stroke", null);
}

function cultureChangeColor(this: FillBoxElement): void {
  const currentFill = this.getAttribute("fill") || "#ffffff";
  const cultureId = +(this.parentNode as HTMLElement).dataset.id!;

  const callback = (newFill: string) => {
    this.fill = newFill;
    pack.cultures[cultureId].color = newFill;
    select("#cults").select(`#culture${cultureId}`).attr("fill", newFill);
    select("#debug").select(`#cultureCenter${cultureId}`).attr("fill", newFill);
  };

  void Controllers.ColorPicker.open(currentFill, callback);
}

function cultureChangeName(this: HTMLInputElement): void {
  const row = this.closest(".states") as HTMLElement;
  const culture = +row.dataset.id!;
  row.dataset.name = this.value;
  const cultures = pack.cultures;
  cultures[culture].name = this.value;
  cultures[culture].code = abbreviate(
    this.value,
    cultures.flatMap(c => (c.code ? [c.code] : []))
  );
}

function cultureRegenerateName(this: HTMLElement): void {
  const cultureId = +(this.closest(".states") as HTMLElement).dataset.id!;
  const base = pack.cultures[cultureId].base;
  if (!Names.nameBases[base]) {
    tip("Namesbase is not defined, please select a valid namesbase", false, "error", 5000);
    return;
  }

  const name = Names.getCultureShort(cultureId);
  (this.parentNode as HTMLElement).querySelector<HTMLInputElement>("input.cultureName")!.value = name;
  pack.cultures[cultureId].name = name;
}

function cultureChangeExpansionism(this: HTMLInputElement): void {
  const row = this.closest(".states") as HTMLElement;
  const culture = +row.dataset.id!;
  row.dataset.expansionism = this.value;
  pack.cultures[culture].expansionism = +this.value;
  recalculateCultures();
}

function cultureChangeType(this: HTMLSelectElement): void {
  const culture = +(this.parentNode as HTMLElement).dataset.id!;
  (this.parentNode as HTMLElement).dataset.type = this.value;
  const type = this.value as (typeof pack.cultures)[number]["type"];
  pack.cultures[culture].type = type;
  recalculateCultures();
}

function cultureChangeBase(this: HTMLSelectElement): void {
  const row = this.closest(".states") as HTMLElement;
  const culture = +row.dataset.id!;
  const v = +this.value;
  pack.cultures[culture].base = v;
  row.dataset.base = String(v);
}

function cultureChangeEmblemsShape(this: HTMLSelectElement): void {
  const row = this.closest(".states") as HTMLElement;
  const culture = +row.dataset.id!;
  const shape = this.value;
  row.dataset.emblems = pack.cultures[culture].shield = shape;

  const rerenderCOA = (id: string, coa: Emblem) => {
    const $coa = document.getElementById(id);
    if (!$coa) return; // not rendered
    $coa.remove();
    EmblemRenderer.trigger(id, coa);
  };

  pack.states.forEach(state => {
    if (state.culture !== culture || !state.i || state.removed || !state.coa || state.coa.custom) return;
    if (shape === state.coa.shield) return;
    state.coa.shield = shape;
    rerenderCOA(`stateCOA${state.i}`, state.coa);
  });

  pack.provinces.forEach(province => {
    if (
      pack.cells.culture[province.center] !== culture ||
      !province.i ||
      province.removed ||
      !province.coa ||
      province.coa.custom
    )
      return;
    if (shape === province.coa.shield) return;
    province.coa.shield = shape;
    rerenderCOA(`provinceCOA${province.i}`, province.coa);
  });

  pack.burgs.forEach(burg => {
    if (burg.culture !== culture || !burg.i || burg.removed || !burg.coa || burg.coa.custom) return;
    if (shape === burg.coa.shield) return;
    burg.coa.shield = shape;
    rerenderCOA(`burgCOA${burg.i}`, burg.coa);
  });
}

function changePopulation(this: HTMLElement): void {
  const cultureId = +(this.closest(".states") as HTMLElement).dataset.id!;
  const culture = pack.cultures[cultureId];
  if (!culture.cells) {
    tip("Culture does not have any cells, cannot change population", false, "error");
    return;
  }

  const rural = rn((culture.rural ?? 0) * populationRate);
  const urban = rn((culture.urban ?? 0) * populationRate * urbanization);
  const total = rural + urban;
  const format = (n: number) => Number(n).toLocaleString();
  const burgs = pack.burgs.filter(b => !b.removed && b.culture === cultureId);

  alertMessage.innerHTML = /* html */ `<div>
    <i>Change population of all cells assigned to the culture</i>
    <div style="margin: 0.5em 0">
      Rural: <input type="number" min="0" step="1" id="ruralPop" value=${rural} style="width:6em" />
      Urban: <input type="number" min="0" step="1" id="urbanPop" value=${urban} style="width:6em"
        ${burgs.length ? "" : "disabled"} />
    </div>
    <div>Total population: ${format(total)} ⇒ <span id="totalPop">${format(total)}</span>
      (<span id="totalPopPerc">100</span>%)
    </div>
  </div>`;

  const ruralPop = ensureEl<HTMLInputElement>("ruralPop");
  const urbanPop = ensureEl<HTMLInputElement>("urbanPop");
  const totalPop = ensureEl("totalPop");
  const totalPopPerc = ensureEl("totalPopPerc");

  const update = () => {
    const totalNew = ruralPop.valueAsNumber + urbanPop.valueAsNumber;
    if (Number.isNaN(totalNew)) return;
    totalPop.innerHTML = format(totalNew);
    totalPopPerc.innerHTML = String(rn((totalNew / total) * 100));
  };

  ruralPop.oninput = () => update();
  urbanPop.oninput = () => update();

  $("#alert").dialog({
    resizable: false,
    title: "Change culture population",
    width: "24em",
    buttons: {
      Apply: function (this: HTMLElement) {
        applyPopulationChange(rural, urban, +ruralPop.value, +urbanPop.value, cultureId);
        $(this).dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    },
    position: { my: "center", at: "center", of: "svg" }
  });
}

function applyPopulationChange(
  oldRural: number,
  oldUrban: number,
  newRural: number,
  newUrban: number,
  culture: number
): void {
  const ruralChange = newRural / oldRural;
  if (Number.isFinite(ruralChange) && ruralChange !== 1) {
    const cells = (pack.cells.i as unknown as number[]).filter(i => pack.cells.culture[i] === culture);
    cells.forEach(i => {
      pack.cells.pop[i] *= ruralChange;
    });
  }
  if (!Number.isFinite(ruralChange) && +newRural > 0) {
    const points = newRural / populationRate;
    const cells = (pack.cells.i as unknown as number[]).filter(i => pack.cells.culture[i] === culture);
    const pop = rn(points / cells.length);
    cells.forEach(i => {
      pack.cells.pop[i] = pop;
    });
  }

  const burgs = pack.burgs.filter(b => !b.removed && b.culture === culture);
  const urbanChange = newUrban / oldUrban;
  if (Number.isFinite(urbanChange) && urbanChange !== 1) {
    burgs.forEach(b => {
      b.population = rn((b.population ?? 0) * urbanChange, 4);
    });
  }
  if (!Number.isFinite(urbanChange) && +newUrban > 0) {
    const points = newUrban / populationRate / urbanization;
    const population = rn(points / burgs.length, 4);
    burgs.forEach(b => {
      b.population = population;
    });
  }

  Layers.draw("population");
  refreshCulturesEditor();
}

function cultureRegenerateBurgs(this: HTMLElement): void {
  if (customization === 4) return;

  const cultureId = +(this.closest(".states") as HTMLElement).dataset.id!;
  const base = pack.cultures[cultureId].base;
  if (!Names.nameBases[base]) {
    tip("Namesbase is not defined, please select a valid namesbase", false, "error", 5000);
    return;
  }

  const cultureBurgs = pack.burgs.filter(b => b.culture === cultureId && !b.removed && !b.lock);
  cultureBurgs.forEach(b => {
    b.name = Names.getCulture(cultureId);
  });
  Layers.draw("labels");
  tip(`Names for ${cultureBurgs.length} burgs are regenerated`, false, "success");
}

function removeCulture(cultureId: number): void {
  select("#cults").select(`#culture${cultureId}`).remove();
  select("#debug").select(`#cultureCenter${cultureId}`).remove();

  const { burgs, states, cells, cultures } = pack as any;

  burgs
    .filter((b: any) => b.culture === cultureId)
    .forEach((b: any) => {
      b.culture = 0;
    });
  states.forEach((s: any) => {
    if (s.culture === cultureId) s.culture = 0;
  });
  cells.culture.forEach((c: number, i: number) => {
    if (c === cultureId) cells.culture[i] = 0;
  });
  cultures[cultureId].removed = true;

  cultures
    .filter((c: any) => c.i && !c.removed)
    .forEach((c: any) => {
      c.origins = (c.origins ?? []).filter((origin: number) => origin !== cultureId);
      if (!c.origins.length) c.origins = [0];
    });
  refreshCulturesEditor();
}

function cultureHighlightElement(this: HTMLElement): void {
  const cultureId = +(this.closest(".states") as HTMLElement).dataset.id!;
  highlightElement(select("#cults").select(`#culture${cultureId}`).node() as Element, 4);
}

function cultureRemovePrompt(this: HTMLElement): void {
  if (customization) return;

  const cultureId = +(this.closest(".states") as HTMLElement).dataset.id!;
  confirmationDialog({
    title: "Remove culture",
    message: "Are you sure you want to remove the culture? <br>This action cannot be reverted",
    confirm: "Remove",
    onConfirm: () => removeCulture(cultureId)
  });
}

function drawCultureCenters(): void {
  const tooltip = "Drag to move the culture center (ancestral home)";
  const debugLayer = select("#debug");
  debugLayer.select("#cultureCenters").remove();
  const cultureCenters = debugLayer
    .append("g")
    .attr("id", "cultureCenters")
    .attr("stroke-width", 0.8)
    .attr("stroke", "#444444")
    .style("cursor", "move");

  const data = pack.cultures.filter(c => c.i && !c.removed);
  cultureCenters
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("id", (d: any) => `cultureCenter${d.i}`)
    .attr("data-id", (d: any) => d.i)
    .attr("r", 2)
    .attr("fill", (d: any) => d.color)
    .attr("cx", (d: any) => pack.cells.p[d.center][0])
    .attr("cy", (d: any) => pack.cells.p[d.center][1])
    .on("mouseenter", (event: any, d: any) => {
      tip(tooltip, true);
      ensureEl("culturesBody").querySelector(`div[data-id='${d.i}']`)?.classList.add("selected");
      cultureHighlightOn(event);
    })
    .on("mouseleave", (event: any, d: any) => {
      tip("", true);
      ensureEl("culturesBody").querySelector(`div[data-id='${d.i}']`)?.classList.remove("selected");
      cultureHighlightOff(event);
    })
    .call(drag<SVGCircleElement, any>().on("start", cultureCenterDrag));
}

function cultureCenterDrag(this: any, event: any): void {
  const cultureId = +this.id.slice(13);
  const tr = parseTransform(this.getAttribute("transform"));
  const x0 = +tr[0] - event.x;
  const y0 = +tr[1] - event.y;

  function handleDrag(this: any, dragEvent: any) {
    const { x, y } = dragEvent;
    this.setAttribute("transform", `translate(${x0 + x},${y0 + y})`);
    const cell = Pack.findCell(x, y);
    if (cell == null || pack.cells.h[cell] < 20) return; // ignore dragging on water

    pack.cultures[cultureId].center = cell;
    recalculateCultures();
  }

  const dragDebounced = debounce(handleDrag, 50);
  event.on("drag", dragDebounced);
}

function toggleLegend(): void {
  if (select("#legend").selectAll("*").size()) {
    clearLegend();
    return;
  }

  const data = pack.cultures
    .filter(c => c.i && !c.removed && c.cells)
    .sort((a, b) => (b.area ?? 0) - (a.area ?? 0))
    .map(c => [c.i, c.color, c.name]);
  drawLegend("Cultures", data);
}

function togglePercentageMode(): void {
  if (ensureEl("culturesBody").dataset.type === "absolute") {
    ensureEl("culturesBody").dataset.type = "percentage";
    const totalCells = +ensureEl("culturesFooterCells").innerText;
    const totalArea = +ensureEl("culturesFooterArea").dataset.area!;
    const totalPopulation = +ensureEl("culturesFooterPopulation").dataset.population!;

    ensureEl("culturesBody")
      .querySelectorAll<HTMLElement>(":scope > div.states")
      .forEach(el => {
        const { cells, area, population } = el.dataset;
        el.querySelector<HTMLElement>(".cultureCells")!.innerText = `${rn((+cells! / totalCells) * 100)}%`;
        el.querySelector<HTMLElement>(".cultureArea")!.innerText = `${rn((+area! / totalArea) * 100)}%`;
        el.querySelector<HTMLElement>(".culturePopulation")!.innerText =
          `${rn((+population! / totalPopulation) * 100)}%`;
      });
  } else {
    ensureEl("culturesBody").dataset.type = "absolute";
    culturesTable.refresh();
  }
}

async function showHierarchy(): Promise<void> {
  if (customization) return;

  const getDescription = (culture: any) => {
    const { name, type, rural, urban } = culture;

    const population = rural * populationRate + urban * populationRate * urbanization;
    const populationText = population > 0 ? `${si(rn(population))} people` : "Extinct";
    return `${name} culture. ${type}. ${populationText}`;
  };

  const getShape = ({ type }: any) => {
    if (type === "Generic") return "circle";
    if (type === "River") return "diamond";
    if (type === "Lake") return "hexagon";
    if (type === "Naval") return "square";
    if (type === "Highland") return "concave";
    if (type === "Nomadic") return "octagon";
    if (type === "Hunting") return "pentagon";
  };

  Controllers.HierarchyTree.open({
    type: "cultures",
    data: pack.cultures as any,
    onNodeEnter: cultureHighlightOn,
    onNodeLeave: cultureHighlightOff,
    getDescription,
    getShape
  });
}

function recalculateCultures(force?: boolean): void {
  if (force || ensureEl<HTMLInputElement>("culturesAutoChange").checked) {
    Cultures.expand();
    Layers.draw("cultures");
    pack.burgs.forEach(b => {
      if (!b.i || b.removed) return;
      b.culture = pack.cells.culture[b.cell];
    });
    refreshCulturesEditor();
  }
}

function openPaintEditor(): void {
  Layers.show("cultures");

  void Controllers.PaintEditor.open({
    title: "Paint Cultures",
    parentDialogId: dialogId,
    onClose: open,
    items: pack.cultures
      .filter(culture => !culture.removed)
      .map(culture => ({ id: culture.i, name: culture.name, color: culture.color || "#ffffff" })),
    dontOverrideControl: true,
    getValue: cell => pack.cells.culture[cell],
    filterCell: cell => isLand(cell, pack),
    onApply: applyCulturePaint
  });
}

function applyCulturePaint(changes: ReadonlyMap<number, number>): void {
  for (const [cell, culture] of changes) {
    pack.cells.culture[cell] = culture;
    if (pack.cells.burg[cell]) pack.burgs[pack.cells.burg[cell]].culture = culture;
  }
  if (changes.size) {
    Layers.draw("cultures");
    if (document.getElementById(dialogId)) refreshCulturesEditor();
  }
}

function enterAddCulturesMode(this: HTMLElement): void {
  if (this.classList.contains("pressed")) {
    exitAddCultureMode();
    return;
  }

  customization = 9;
  this.classList.add("pressed");
  tip("Click on the map to add a new culture", true);
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addCulture);
  ensureEl("culturesBody")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.pointerEvents = "none";
    });
}

function exitAddCultureMode(): void {
  customization = 0;
  applyDefaultViewboxEvents();
  clearMainTip();
  ensureEl("culturesBody")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.removeProperty("pointer-events");
    });
  const culturesAdd = ensureEl("culturesAdd");
  if (culturesAdd.classList.contains("pressed")) culturesAdd.classList.remove("pressed");
}

function addCulture(this: SVGElement, event: MouseEvent): void {
  const point = getPointer(event, this);
  const center = Pack.findCell(point[0], point[1])!;

  if (pack.cells.h[center] < 20) {
    tip("You cannot place culture center into the water. Please click on a land cell", false, "error");
    return;
  }

  const occupied = pack.cultures.some(c => !c.removed && c.center === center);
  if (occupied) {
    tip("This cell is already a culture center. Please select a different cell", false, "error");
    return;
  }

  if (event.shiftKey === false) exitAddCultureMode();
  Cultures.add(center);

  drawCultureCenters();
  culturesTable.refresh();
}

function downloadCulturesCsv(): void {
  const unit = getAreaUnit("2");
  const headers = `Id,Name,Color,Cells,Expansionism,Type,Area ${unit},Population,Namesbase,Emblems Shape,Origins`;
  // export the full filtered set (all pages), not just the visible page
  const data = culturesTable.view().all.map(c => {
    const area = getArea(c.area ?? 0);
    const population = rn((c.rural ?? 0) * populationRate + (c.urban ?? 0) * populationRate * urbanization);
    const namesbase = Names.nameBases[c.base].name;
    const originList = (c.origins ?? [])
      .filter((origin): origin is number => Boolean(origin))
      .map(origin => pack.cultures[origin].name);
    const originText = `"${originList.join(", ")}"`;
    return [
      c.i,
      c.name,
      c.i ? c.color || "" : "",
      c.cells || 0,
      c.i ? c.expansionism || 0 : "",
      c.i ? c.type : "",
      area,
      population,
      namesbase,
      c.shield,
      originText
    ].join(",");
  });
  const csvData = [headers].concat(data).join("\n");

  const name = `${getFileName("Cultures")}.csv`;
  downloadFile(csvData, name);
}

function closeCulturesEditor(): void {
  select("#debug #cultureCenters").remove();
  if (customization === 9) exitAddCultureMode();
  $("#culturesEditor").dialog("destroy");
  ensureEl("culturesEditor").remove();
}

async function uploadCulturesData(this: HTMLInputElement): Promise<void> {
  const file = this.files![0];
  this.value = "";
  const csv = await file.text();
  const data: any[] = csvParse(csv, d => ({
    name: d.Name,
    i: +d.Id!,
    color: d.Color,
    expansionism: +d.Expansionism!,
    type: d.Type,
    population: +d.Population!,
    emblemsShape: d["Emblems Shape"],
    origins: d.Origins,
    namesbase: d.Namesbase
  }));

  const { cultures, cells } = pack as any;
  const shapes = Object.keys(Emblems.shields.types).flatMap(type => Object.keys(Emblems.shields[type]));

  const populated = cells.pop.map((c: number, i: number) => (c ? i : null)).filter((c: number | null) => c);
  cultures.forEach((item: any) => {
    if (item.i) item.removed = true;
  });

  for (const culture of data) {
    let current: any;
    if (culture.i < cultures.length) {
      current = cultures[culture.i];

      const ratio = current.urban / (current.rural + current.urban);
      applyPopulationChange(
        current.rural,
        current.urban,
        culture.population * (1 - ratio),
        culture.population * ratio,
        culture.i
      );
    } else {
      current = { i: cultures.length, center: ra(populated), area: 0, cells: 0, origins: [0], rural: 0, urban: 0 };
      cultures.push(current);
    }

    current.removed = false;
    current.name = culture.name;

    if (current.i) {
      current.code = abbreviate(
        current.name,
        cultures.map((c: any) => c.code)
      );

      current.color = culture.color;
      current.expansionism = +culture.expansionism;

      if (CULTURE_TYPES.includes(culture.type)) current.type = culture.type;
      else current.type = "Generic";
    }

    culture.origins = current.i ? restoreOrigins(culture.origins || "") : [null];
    current.shield = shapes.includes(culture.emblemsShape) ? culture.emblemsShape : "heater";
    current.base = Names.nameBases.findIndex(n => n.name === culture.namesbase); // can be -1 if namesbase is not found

    function restoreOrigins(originsString: string) {
      const originNames = originsString
        .replaceAll('"', "")
        .split(",")
        .map(s => s.trim())
        .filter(s => s);

      const originIds = originNames.map(name => {
        const id = cultures.findIndex((c: any) => c.name === name);
        return id === -1 ? null : id;
      });

      current.origins = originIds.filter((id: number | null) => id !== null);
      if (!current.origins.length) current.origins = [0];
    }
  }

  cultures
    .filter((c: any) => c.removed)
    .forEach((c: any) => {
      removeCulture(c.i);
    });

  Layers.draw("cultures");
  refreshCulturesEditor();
}

function updateLockStatus(this: HTMLElement): void {
  if (customization) return;

  const cultureId = +(this.closest(".states") as HTMLElement).dataset.id!;
  const classList = this.classList;
  const c = pack.cultures[cultureId];
  c.lock = !c.lock;

  classList.toggle("icon-lock-open");
  classList.toggle("icon-lock");
}

export const CulturesEditor = { open };
