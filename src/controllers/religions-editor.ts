import { drag, easeSinIn, select, transition } from "d3";
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
import { Layers } from "@/components/layers";
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import type { Religion } from "@/generators/religions-generator";
import { clearLegend, drawLegend } from "@/renderers/draw-legend";
import { highlightElement } from "@/renderers/overlays/highlight";
import { downloadFile, getArea, getAreaUnit, getFileName } from "@/utils";
import { abbreviate, debounce, ensureEl, getPointer, isLand, parseTransform, rn, si } from "../utils";

const dialogId = "religionsEditor" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
let filterState: { showExtinct: boolean };

const columns: EditorColumn<Religion>[] = [
  { key: "color", width: "1.2em", permanent: true },
  {
    key: "name",
    label: "Religion",
    width: "14em",
    permanent: true,
    sortBy: religion => religion.name || "",
    sortType: "alpha"
  },
  {
    key: "type",
    label: "Type",
    width: "6em",
    defaultSort: "asc",
    sortBy: religion => religion.type || "",
    sortType: "alpha"
  },
  {
    key: "form",
    label: "Form",
    width: "7em",
    mobileHidden: true,
    sortBy: religion => religion.form || "",
    sortType: "alpha"
  },
  {
    key: "deity",
    label: "Deity",
    width: "14em",
    mobileHidden: true,
    sortBy: religion => religion.deity || "",
    sortType: "alpha"
  },
  {
    key: "area",
    label: "Area",
    width: "7em",
    mobileHidden: true,
    sortBy: religion => religion.area || 0
  },
  {
    key: "population",
    label: "Population",
    width: "6em",
    sortBy: religion => (religion.rural || 0) * populationRate + (religion.urban || 0) * populationRate * urbanization
  },
  {
    key: "expansion",
    label: "Expansion",
    width: "5em",
    hidden: true,
    mobileHidden: true,
    sortBy: religion => religion.expansion || "",
    sortType: "alpha"
  },
  {
    key: "expansionism",
    label: "Expansionism",
    width: "5em",
    hidden: true,
    mobileHidden: true,
    sortBy: religion => religion.expansionism || 0
  },
  { key: "actions", width: "3.2em", permanent: true, align: "right" }
];

function getFilteredReligions(): Religion[] {
  return pack.religions.filter(r => !r.removed && !(r.i && !r.cells && !filterState.showExtinct));
}

const religionsTable = initEditorTable<Religion>({
  getData: () => sortDataByColumns(dialogId, getFilteredReligions(), columns),
  onUpdate: religionsEditorAddLines
});

function open(): void {
  if (customization) return;
  filterState = dialogState.get(dialogId, "filters", () => ({ showExtinct: false }));
  closeDialogs(`#${dialogId}, .stable`);
  Layers.show("religions");
  Layers.hide("states", "biomes");
  Layers.hide("cultures", "provinces");

  renderDialog();
  religionsCollectStatistics();
  drawReligionCenters();
  religionsTable.reset();

  $(`#${dialogId}`).dialog({
    title: "Religions Editor",
    resizable: false,
    width: "fit-content",
    close: closeReligionsEditor,
    position
  });
}

function renderDialog(): void {
  destroyDialog("religionsEditor");
  const editorHtml = /* html */ `<div id="religionsEditor" class="dialog stable editorDialog">
    <div id="religionsBody" class="table" data-type="absolute">${renderEditorHeader({ dialogId, columns })}</div>

    <div id="religionsFooter" class="totalLine">
      <div data-tip="Total number of organized religions" style="margin-left: 12px">
        Organized:&nbsp;<span id="religionsOrganized">0</span>
      </div>
      <div data-tip="Total number of heresies" style="margin-left: 12px">
        Heresies:&nbsp;<span id="religionsHeresies">0</span>
      </div>
      <div data-tip="Total number of cults" style="margin-left: 12px">
        Cults:&nbsp;<span id="religionsCults">0</span>
      </div>
      <div data-tip="Total number of folk religions" style="margin-left: 12px">
        Folk:&nbsp;<span id="religionsFolk">0</span>
      </div>
      <div data-tip="Total land area" style="margin-left: 12px" data-col="area">
        Land Area:&nbsp;<span id="religionsFooterArea">0</span>
      </div>
      <div data-tip="Total number of believers (population)" style="margin-left: 12px" data-col="population">
        Believers:&nbsp;<span id="religionsFooterPopulation">0</span>
      </div>
    </div>

    <div id="religionsBottom" class="editorToolbar">
      <button id="religionsEditorRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
      <button id="religionsEditStyle" data-tip="Edit religions style in Style Editor" class="icon-adjust"></button>
      <button id="religionsLegend" data-tip="Toggle Legend box" class="icon-list-bullet"></button>
      <button id="religionsPercentage" data-tip="Toggle percentage / absolute values display mode" class="icon-percent"></button>
      <button id="religionsHeirarchy" data-tip="Show religions hierarchy tree" class="icon-sitemap"></button>
      <button id="religionsExtinct" data-tip="Show/hide extinct religions (religions without cells)" class="icon-eye-off"></button>

      <button id="religionsManually" data-tip="Manually re-assign religions" class="icon-brush"></button>
      <button id="religionsAdd" data-tip="Add a new religion. Hold Shift to add multiple" class="icon-plus"></button>
      <button id="religionsExport" data-tip="Download religions-related data" class="icon-download"></button>
      <button id="religionsRecalculate" data-tip="Recalculate religions based on current values of growth-related attributes" class="icon-retweet"></button>
      <span
        data-tip="Allow religion center, extent, and expansionism changes to take an immediate effect"
        class="editorToolbarPanel"
      >
        <input id="religionsAutoChange" class="checkbox" type="checkbox" />
        <label for="religionsAutoChange" class="checkbox-label"><i>auto-apply changes</i></label>
      </span>
    </div>
  </div>`;

  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  syncFilterControls();
  bindColumnSorting(dialogId, religionsTable.reset);
  applyLineHighlighting(dialogId, ({ cellId }) => pack.cells.religion[cellId]);

  ensureEl("religionsEditorRefresh").addEventListener("click", refreshReligionsEditor);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });
  ensureEl("religionsEditStyle").addEventListener("click", () => editStyle("relig"));
  ensureEl("religionsLegend").addEventListener("click", toggleLegend);
  ensureEl("religionsPercentage").addEventListener("click", togglePercentageMode);
  ensureEl("religionsHeirarchy").addEventListener("click", showHierarchy);
  ensureEl("religionsExtinct").addEventListener("click", toggleExtinct);
  ensureEl("religionsManually").addEventListener("click", openPaintEditor);
  ensureEl("religionsAdd").addEventListener("click", enterAddReligionMode);
  ensureEl("religionsExport").addEventListener("click", downloadReligionsCsv);
  ensureEl("religionsRecalculate").addEventListener("click", () => recalculateReligions(true));
}

function refreshReligionsEditor(): void {
  religionsCollectStatistics();
  religionsTable.refresh();
}

function religionsCollectStatistics(): void {
  const { cells, religions, burgs } = pack as any;
  religions.forEach((r: any) => {
    r.cells = r.area = r.rural = r.urban = 0;
  });

  for (const i of cells.i) {
    if (cells.h[i] < 20) continue;
    const religionId = cells.religion[i];
    religions[religionId].cells += 1;
    religions[religionId].area += cells.area[i];
    religions[religionId].rural += cells.pop[i];
    const burgId = cells.burg[i];
    if (burgId) religions[religionId].urban += burgs[burgId].population;
  }
}

// add line for each religion
function religionsEditorAddLines(view: TableView<Religion>): void {
  const unit = ` ${getAreaUnit()}`;
  let lines = "";
  let totalArea = 0;
  let totalPopulation = 0;

  // totals span the full filtered set, not just the current page
  for (const r of view.all) {
    totalArea += getArea(r.area ?? 0);
    totalPopulation += rn((r.rural ?? 0) * populationRate + (r.urban ?? 0) * populationRate * urbanization);
  }

  for (const r of view.rows) {
    const area = getArea(r.area ?? 0);
    const rural = (r.rural ?? 0) * populationRate;
    const urban = (r.urban ?? 0) * populationRate * urbanization;
    const population = rn(rural + urban);
    const populationTip = `Believers: ${si(population)}; Rural areas: ${si(rural)}; Urban areas: ${si(
      urban
    )}. Click to change`;

    if (!r.i) {
      // No religion (neutral) line
      lines += /* html */ `<div
        class="states"
        data-id="${r.i}"
        data-name="${r.name}"
        data-color=""
        data-area="${area}"
        data-population="${population}"
        data-type=""
        data-form=""
        data-deity=""
        data-expansion=""
        data-expansionism=""
      >
        <svg width="9" height="9" class="placeholder" data-col="color"></svg>
        <input data-tip="Religion name. Click and type to change" class="religionName italic"
          value="${r.name}" autocorrect="off" spellcheck="false" data-col="name" />
        <select data-tip="Religion type" class="religionType placeholder" data-col="type">
          ${getTypeOptions(r.type)}
        </select>
        <input data-tip="Religion form" class="religionForm placeholder" value="" autocorrect="off" spellcheck="false" data-col="form" />
        <div data-col="deity">
          <span class="icon-arrows-cw placeholder"></span>
          <input class="religionDeity placeholder" value="" autocorrect="off" spellcheck="false" />
        </div>
        <div data-col="area">
          <span data-tip="Religion area" style="padding-right: 4px" class="icon-map-o"></span>
          <div data-tip="Religion area" class="religionArea">${si(area) + unit}</div>
        </div>
        <div data-col="population">
          <span data-tip="${populationTip}" class="icon-male"></span>
          <div data-tip="${populationTip}" class="religionPopulation pointer">${si(population)}</div>
        </div>
        <div data-col="expansion">
          <span class="icon-resize-full-alt placeholder" style="padding-right: 2px"></span>
          <span class="religionExtent placeholder">n/a</span>
        </div>
        <div data-col="expansionism">
          <span class="icon-resize-full placeholder"></span>
          <input class="religionExpantion placeholder" disabled type="number" value="0" />
        </div>
        <div data-col="actions"></div>
      </div>`;
      continue;
    }

    lines += /* html */ `<div
      class="states"
      data-id=${r.i}
      data-name="${r.name}"
      data-color="${r.color}"
      data-area=${area}
      data-population=${population}
      data-type="${r.type}"
      data-form="${r.form}"
      data-deity="${r.deity || ""}"
      data-expansion="${r.expansion}"
      data-expansionism="${r.expansionism}"
    >
      <fill-box fill="${r.color}" data-col="color"></fill-box>
      <input data-tip="Religion name. Click and type to change" class="religionName"
        value="${r.name}" autocorrect="off" spellcheck="false" data-col="name" />
      <select data-tip="Religion type" class="religionType" data-col="type">
        ${getTypeOptions(r.type)}
      </select>
      <input data-tip="Religion form" class="religionForm"
        value="${r.form}" autocorrect="off" spellcheck="false" data-col="form" />
      <div data-col="deity">
        <span data-tip="Click to re-generate supreme deity" class="icon-arrows-cw pointer"></span>
        <input data-tip="Religion supreme deity" class="religionDeity"
          value="${r.deity || ""}" autocorrect="off" spellcheck="false" />
      </div>
      <div data-col="area">
        <span data-tip="Religion area" style="padding-right: 4px" class="icon-map-o"></span>
        <div data-tip="Religion area" class="religionArea">${si(area) + unit}</div>
      </div>
      <div data-col="population">
        <span data-tip="${populationTip}" class="icon-male"></span>
        <div data-tip="${populationTip}" class="religionPopulation pointer">${si(population)}</div>
      </div>
      ${getExpansionColumns(r)}
      <div data-col="actions">
        <span data-tip="Locate the religion" class="icon-target"></span>
        <span data-tip="Lock this religion" class="icon-lock${r.lock ? "" : "-open"}"></span>
        <span data-tip="Remove religion" class="icon-trash-empty"></span>
      </div>
    </div>`;
  }
  const body = ensureEl("religionsBody");
  body.querySelectorAll(":scope > .states").forEach(row => {
    row.remove();
  });
  body.insertAdjacentHTML("beforeend", lines);

  // update footer
  const validReligions = pack.religions.filter(r => r.i && !r.removed);
  ensureEl("religionsOrganized").innerHTML = String(validReligions.filter(r => r.type === "Organized").length);
  ensureEl("religionsHeresies").innerHTML = String(validReligions.filter(r => r.type === "Heresy").length);
  ensureEl("religionsCults").innerHTML = String(validReligions.filter(r => r.type === "Cult").length);
  ensureEl("religionsFolk").innerHTML = String(validReligions.filter(r => r.type === "Folk").length);
  ensureEl("religionsFooterArea").innerHTML = si(totalArea) + unit;
  ensureEl("religionsFooterPopulation").innerHTML = si(totalPopulation);
  ensureEl("religionsFooterArea").dataset.area = String(totalArea);
  ensureEl("religionsFooterPopulation").dataset.population = String(totalPopulation);

  renderEditorPagination(ensureEl("religionsFooter"), view, religionsTable.goto);

  // add listeners
  ensureEl("religionsBody")
    .querySelectorAll(":scope > .states")
    .forEach($line => {
      $line.addEventListener("mouseenter", religionHighlightOn);
      $line.addEventListener("mouseleave", religionHighlightOff);
    });
  ensureEl("religionsBody")
    .querySelectorAll("fill-box")
    .forEach(el => void el.addEventListener("click", religionChangeColor));
  ensureEl("religionsBody")
    .querySelectorAll("div > input.religionName")
    .forEach(el => void el.addEventListener("input", religionChangeName));
  ensureEl("religionsBody")
    .querySelectorAll("div > select.religionType")
    .forEach(el => void el.addEventListener("change", religionChangeType));
  ensureEl("religionsBody")
    .querySelectorAll("div > input.religionForm")
    .forEach(el => void el.addEventListener("input", religionChangeForm));
  ensureEl("religionsBody")
    .querySelectorAll("div > input.religionDeity")
    .forEach(el => void el.addEventListener("input", religionChangeDeity));
  ensureEl("religionsBody")
    .querySelectorAll("div > span.icon-arrows-cw")
    .forEach(el => void el.addEventListener("click", regenerateDeity));
  ensureEl("religionsBody")
    .querySelectorAll("div > div.religionPopulation")
    .forEach(el => void el.addEventListener("click", changePopulation));
  ensureEl("religionsBody")
    .querySelectorAll("div > select.religionExtent")
    .forEach(el => void el.addEventListener("change", religionChangeExtent));
  ensureEl("religionsBody")
    .querySelectorAll("div > input.religionExpantion")
    .forEach(el => void el.addEventListener("change", religionChangeExpansionism));
  ensureEl("religionsBody")
    .querySelectorAll("div > span.icon-trash-empty")
    .forEach(el => void el.addEventListener("click", religionRemovePrompt));
  ensureEl("religionsBody")
    .querySelectorAll("div > span.icon-target")
    .forEach($el => void $el.addEventListener("click", highlightReligion));
  ensureEl("religionsBody")
    .querySelectorAll("div > span.icon-lock")
    .forEach($el => void $el.addEventListener("click", updateLockStatus));
  ensureEl("religionsBody")
    .querySelectorAll("div > span.icon-lock-open")
    .forEach($el => void $el.addEventListener("click", updateLockStatus));

  if (ensureEl("religionsBody").dataset.type === "percentage") {
    ensureEl("religionsBody").dataset.type = "absolute";
    togglePercentageMode();
  }

  updateDialog(dialogId, { width: "fit-content", position });
}

function getTypeOptions(type: string): string {
  let options = "";
  const types = ["Folk", "Organized", "Cult", "Heresy"];
  types.forEach(t => {
    options += `<option ${type === t ? "selected" : ""} value="${t}">${t}</option>`;
  });
  return options;
}

function getExpansionColumns(r: any): string {
  if (r.type === "Folk") {
    const folkTip =
      "Folk religions are not competitive and do not expand. Initially they cover all cells of their parent culture, but get ousted by organized religions when they expand";
    return /* html */ `
      <div data-col="expansion">
        <span data-tip="${folkTip}" class="icon-resize-full-alt" style="padding-right: 2px"></span>
        <span data-tip="${folkTip}" class="religionExtent">culture</span>
      </div>
      <div data-col="expansionism">
        <span data-tip="${folkTip}" class="icon-resize-full"></span>
        <input data-tip="${folkTip}" class="religionExpantion" disabled type="number" value='0' />
      </div>`;
  }

  return /* html */ `
    <div data-col="expansion">
      <span data-tip="Potential religion extent" class="icon-resize-full-alt" style="padding-right: 2px"></span>
      <select data-tip="Potential religion extent" class="religionExtent">
        ${getExtentOptions(r.expansion)}
      </select>
    </div>
    <div data-col="expansionism">
      <span data-tip="Religion expansionism. Defines competitive size" class="icon-resize-full"></span>
      <input
        data-tip="Religion expansionism. Defines competitive size. Click to change, then click Recalculate to apply change"
        class="religionExpantion"
        type="number"
        min="0"
        max="99"
        step=".1"
        value=${r.expansionism}
      />
    </div>`;
}

function getExtentOptions(type: string): string {
  let options = "";
  const types = ["global", "state", "culture"];
  types.forEach(t => {
    options += `<option ${type === t ? "selected" : ""} value="${t}">${t}</option>`;
  });
  return options;
}

const religionHighlightOn = debounce((event: any) => {
  const religionId = Number(event.id || event.target.dataset.id);
  const $el = ensureEl("religionsBody").querySelector(`div[data-id='${religionId}']`);
  if ($el) $el.classList.add("active");

  if (!Layers.isOn("religions")) return;
  if (customization) return;

  const animate = transition().duration(2000).ease(easeSinIn);
  select("#relig")
    .select(`#religion${religionId}`)
    .raise()
    .transition(animate)
    .attr("stroke-width", 2.5)
    .attr("stroke", "#d0240f");
  select("#debug")
    .select(`#religionsCenter${religionId}`)
    .raise()
    .transition(animate)
    .attr("r", 3)
    .attr("stroke", "#d0240f");
}, 200);

function religionHighlightOff(event: any): void {
  const religionId = Number(event.id || event.target.dataset.id);
  const $el = ensureEl("religionsBody").querySelector(`div[data-id='${religionId}']`);
  if ($el) $el.classList.remove("active");

  select("#relig").select(`#religion${religionId}`).transition().attr("stroke-width", null).attr("stroke", null);
  select("#debug").select(`#religionsCenter${religionId}`).transition().attr("r", 2).attr("stroke", null);
}

function religionChangeColor(this: HTMLElement): void {
  const currentFill = this.getAttribute("fill") || "#ffffff";
  const religionId = +(this.parentNode as HTMLElement).dataset.id!;

  const callback = (newFill: string) => {
    (this as any).fill = newFill;
    pack.religions[religionId].color = newFill;
    select("#relig").select(`#religion${religionId}`).attr("fill", newFill);
    select("#debug").select(`#religionsCenter${religionId}`).attr("fill", newFill);
  };

  void Controllers.ColorPicker.open(currentFill, callback);
}

function religionChangeName(this: HTMLInputElement): void {
  const religionId = +(this.parentNode as HTMLElement).dataset.id!;
  (this.parentNode as HTMLElement).dataset.name = this.value;
  const religions = pack.religions;
  religions[religionId].name = this.value;
  religions[religionId].code = abbreviate(
    this.value,
    religions.flatMap(c => (c.code ? [c.code] : []))
  );
}

function religionChangeType(this: HTMLSelectElement): void {
  const religionId = +(this.parentNode as HTMLElement).dataset.id!;
  (this.parentNode as HTMLElement).dataset.type = this.value;
  const type = this.value as (typeof pack.religions)[number]["type"];
  pack.religions[religionId].type = type;
}

function religionChangeForm(this: HTMLInputElement): void {
  const religionId = +(this.parentNode as HTMLElement).dataset.id!;
  (this.parentNode as HTMLElement).dataset.form = this.value;
  pack.religions[religionId].form = this.value;
}

function religionChangeDeity(this: HTMLInputElement): void {
  const row = this.closest(".states") as HTMLElement;
  const religionId = +row.dataset.id!;
  row.dataset.deity = this.value;
  pack.religions[religionId].deity = this.value;
}

function regenerateDeity(this: HTMLElement): void {
  const row = this.closest(".states") as HTMLElement;
  const religionId = +row.dataset.id!;
  const cultureId = pack.religions[religionId].culture;
  const deity = Religions.getDeityName(cultureId) ?? "";
  row.dataset.deity = deity;
  pack.religions[religionId].deity = deity;
  (this.nextElementSibling as HTMLInputElement).value = deity;
}

function changePopulation(this: HTMLElement): void {
  const religionId = +(this.closest(".states") as HTMLElement).dataset.id!;
  const religion = pack.religions[religionId];
  if (!religion.cells) {
    tip("Religion does not have any cells, cannot change population", false, "error");
    return;
  }

  const rural = rn((religion.rural ?? 0) * populationRate);
  const urban = rn((religion.urban ?? 0) * populationRate * urbanization);
  const total = rural + urban;
  const format = (n: number) => Number(n).toLocaleString();
  const burgs = pack.burgs.filter(b => !b.removed && pack.cells.religion[b.cell] === religionId);

  alertMessage.innerHTML = /* html */ `<div>
    <i>All population of religion territory is considered believers of this religion. It means believers number change will directly affect population</i>
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
    title: "Change believers number",
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

  function applyPopulationChange() {
    const ruralChange = +ruralPop.value / rural;
    if (Number.isFinite(ruralChange) && ruralChange !== 1) {
      const cells = (pack.cells.i as unknown as number[]).filter(i => pack.cells.religion[i] === religionId);
      cells.forEach(i => {
        pack.cells.pop[i] *= ruralChange;
      });
    }
    if (!Number.isFinite(ruralChange) && +ruralPop.value > 0) {
      const points = +ruralPop.value / populationRate;
      const cells = (pack.cells.i as unknown as number[]).filter(i => pack.cells.religion[i] === religionId);
      const pop = rn(points / cells.length);
      cells.forEach(i => {
        pack.cells.pop[i] = pop;
      });
    }

    const urbanChange = +urbanPop.value / urban;
    if (Number.isFinite(urbanChange) && urbanChange !== 1) {
      burgs.forEach(b => {
        b.population = rn((b.population ?? 0) * urbanChange, 4);
      });
    }
    if (!Number.isFinite(urbanChange) && +urbanPop.value > 0) {
      const points = +urbanPop.value / populationRate / urbanization;
      const population = rn(points / burgs.length, 4);
      burgs.forEach(b => {
        b.population = population;
      });
    }

    Layers.draw("population");
    refreshReligionsEditor();
  }
}

function religionChangeExtent(this: HTMLSelectElement): void {
  const row = this.closest(".states") as HTMLElement;
  const religion = +row.dataset.id!;
  row.dataset.expansion = this.value;
  pack.religions[religion].expansion = this.value;
  recalculateReligions();
}

function religionChangeExpansionism(this: HTMLInputElement): void {
  const row = this.closest(".states") as HTMLElement;
  const religion = +row.dataset.id!;
  row.dataset.expansionism = this.value;
  pack.religions[religion].expansionism = +this.value;
  recalculateReligions();
}

function religionRemovePrompt(this: HTMLElement): void {
  if (customization) return;

  const religionId = +(this.closest(".states") as HTMLElement).dataset.id!;
  confirmationDialog({
    title: "Remove religion",
    message: "Are you sure you want to remove the religion? <br>This action cannot be reverted",
    confirm: "Remove",
    onConfirm: () => removeReligion(religionId)
  });
}

function removeReligion(religionId: number): void {
  select("#relig").select(`#religion${religionId}`).remove();
  select("#relig").select(`#religion-gap${religionId}`).remove();
  select("#debug").select(`#religionsCenter${religionId}`).remove();

  pack.cells.religion.forEach((r: number, i: number) => {
    if (r === religionId) pack.cells.religion[i] = 0;
  });
  pack.religions[religionId].removed = true;

  pack.religions
    .filter(r => r.i && !r.removed)
    .forEach(r => {
      r.origins = (r.origins ?? []).filter((origin: number) => origin !== religionId);
      if (!r.origins.length) r.origins = [0];
    });

  refreshReligionsEditor();
}

function drawReligionCenters(): void {
  const debugLayer = select("#debug");
  debugLayer.select("#religionCenters").remove();
  const religionCenters = debugLayer
    .append("g")
    .attr("id", "religionCenters")
    .attr("stroke-width", 0.8)
    .attr("stroke", "#444444")
    .style("cursor", "move");

  let data = pack.religions.filter(r => r.i && r.center && !r.removed);
  if (!filterState.showExtinct) data = data.filter(r => (r.cells ?? 0) > 0);

  religionCenters
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("id", (d: any) => `religionsCenter${d.i}`)
    .attr("data-id", (d: any) => d.i)
    .attr("r", 2)
    .attr("fill", (d: any) => d.color)
    .attr("cx", (d: any) => pack.cells.p[d.center][0])
    .attr("cy", (d: any) => pack.cells.p[d.center][1])
    .on("mouseenter", (event: any, d: any) => {
      tip(`${d.name}. Drag to move the religion center`, true);
      religionHighlightOn(event);
    })
    .on("mouseleave", (event: any) => {
      tip("", true);
      religionHighlightOff(event);
    })
    .call(drag<SVGCircleElement, any>().on("start", religionCenterDrag));
}

function religionCenterDrag(this: any, event: any): void {
  const religionId = +this.dataset.id;
  const tr = parseTransform(this.getAttribute("transform"));
  const x0 = +tr[0] - event.x;
  const y0 = +tr[1] - event.y;

  function handleDrag(this: any, dragEvent: any) {
    const { x, y } = dragEvent;
    this.setAttribute("transform", `translate(${x0 + x},${y0 + y})`);
    const cell = Pack.findCell(x, y);
    if (cell == null || pack.cells.h[cell] < 20) return; // ignore dragging on water

    pack.religions[religionId].center = cell;
    recalculateReligions();
  }

  const dragDebounced = debounce(handleDrag, 50);
  event.on("drag", dragDebounced);
}

function toggleLegend(): void {
  if (select("#legend").selectAll("*").size()) {
    clearLegend(); // hide legend
    return;
  }

  const data = pack.religions
    .filter(r => r.i && !r.removed && r.area)
    .sort((a, b) => (b.area ?? 0) - (a.area ?? 0))
    .map(r => [r.i, r.color, r.name]);
  drawLegend("Religions", data);
}

function togglePercentageMode(): void {
  if (ensureEl("religionsBody").dataset.type === "absolute") {
    ensureEl("religionsBody").dataset.type = "percentage";
    const totalArea = +ensureEl("religionsFooterArea").dataset.area!;
    const totalPopulation = +ensureEl("religionsFooterPopulation").dataset.population!;

    ensureEl("religionsBody")
      .querySelectorAll<HTMLElement>(":scope > .states")
      .forEach($el => {
        const { area, population } = $el.dataset;
        $el.querySelector<HTMLElement>(".religionArea")!.innerText = `${rn((+area! / totalArea) * 100)}%`;
        $el.querySelector<HTMLElement>(".religionPopulation")!.innerText =
          `${rn((+population! / totalPopulation) * 100)}%`;
      });
  } else {
    ensureEl("religionsBody").dataset.type = "absolute";
    religionsTable.refresh();
  }
}

async function showHierarchy(): Promise<void> {
  if (customization) return;

  const getDescription = (religion: any) => {
    const { name, type, form, rural, urban } = religion;

    const getTypeText = () => {
      if (name.includes(type)) return "";
      if (form.includes(type)) return "";
      if (type === "Folk" || type === "Organized") return `. ${type} religion`;
      return `. ${type}`;
    };

    const formText = form === type ? "" : `. ${form}`;
    const population = rural * populationRate + urban * populationRate * urbanization;
    const populationText = population > 0 ? `${si(rn(population))} people` : "Extinct";

    return `${name}${getTypeText()}${formText}. ${populationText}`;
  };

  const getShape = ({ type }: any) => {
    if (type === "Folk") return "circle";
    if (type === "Organized") return "square";
    if (type === "Cult") return "hexagon";
    if (type === "Heresy") return "diamond";
  };

  Controllers.HierarchyTree.open({
    type: "religions",
    data: pack.religions as any,
    onNodeEnter: religionHighlightOn,
    onNodeLeave: religionHighlightOff,
    getDescription,
    getShape
  });
}

function toggleExtinct(): void {
  filterState.showExtinct = !filterState.showExtinct;
  dialogState.set(dialogId, "filters", filterState);
  syncFilterControls();
  religionsTable.reset();
  drawReligionCenters();
}

function syncFilterControls(): void {
  ensureEl("religionsBody").dataset.extinct = filterState.showExtinct ? "show" : "hide";
  ensureEl("religionsExtinct").classList.toggle("active", filterState.showExtinct);
}

function openPaintEditor(): void {
  Layers.show("religions");

  void Controllers.PaintEditor.open({
    title: "Paint Religions",
    parentDialogId: dialogId,
    onClose: open,
    items: pack.religions
      .filter(religion => !religion.removed && (!religion.i || religion.cells))
      .map(religion => ({ id: religion.i, name: religion.name, color: religion.color || "#ffffff" })),
    dontOverrideControl: true,
    getValue: cell => pack.cells.religion[cell],
    filterCell: cell => isLand(cell, pack),
    onApply: applyReligionPaint
  });
}

function applyReligionPaint(changes: ReadonlyMap<number, number>): void {
  for (const [cell, religion] of changes) pack.cells.religion[cell] = religion;
  if (changes.size) {
    Layers.draw("religions");
    if (document.getElementById(dialogId)) refreshReligionsEditor();
    drawReligionCenters();
  }
}

function enterAddReligionMode(this: HTMLElement): void {
  if (this.classList.contains("pressed")) {
    exitAddReligionMode();
    return;
  }

  customization = 8;
  this.classList.add("pressed");
  tip("Click on the map to add a new religion", true);
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addReligion);
  ensureEl("religionsBody")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.pointerEvents = "none";
    });
}

function exitAddReligionMode(): void {
  customization = 0;
  applyDefaultViewboxEvents();
  clearMainTip();
  ensureEl("religionsBody")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.removeProperty("pointer-events");
    });
  const religionsAdd = ensureEl("religionsAdd");
  if (religionsAdd.classList.contains("pressed")) religionsAdd.classList.remove("pressed");
}

function addReligion(this: SVGElement, event: MouseEvent): void {
  const [x, y] = getPointer(event, this);
  const center = Pack.findCell(x, y)!;
  if (pack.cells.h[center] < 20) {
    tip("You cannot place religion center into the water. Please click on a land cell", false, "error");
    return;
  }

  const occupied = pack.religions.some(r => !r.removed && r.center === center);
  if (occupied) {
    tip("This cell is already a religion center. Please select a different cell", false, "error");
    return;
  }

  if (event.shiftKey === false) exitAddReligionMode();
  Religions.add(center);

  Layers.draw("religions");
  refreshReligionsEditor();
  drawReligionCenters();
}

function downloadReligionsCsv(): void {
  const unit = getAreaUnit("2");
  const headers = `Id,Name,Color,Type,Form,Supreme Deity,Area ${unit},Believers,Origins,Potential,Expansionism`;
  // export the full filtered set (all pages), not just the visible page
  const data = religionsTable.view().all.map(r => {
    const area = getArea(r.area ?? 0);
    const population = rn((r.rural ?? 0) * populationRate + (r.urban ?? 0) * populationRate * urbanization);
    const deityText = `"${r.deity || ""}"`;
    const originList = (r.origins ?? [])
      .filter((origin): origin is number => Boolean(origin))
      .map(origin => pack.religions[origin].name);
    const originText = `"${originList.join(", ")}"`;
    return [
      r.i,
      r.name,
      r.color ?? "",
      r.type ?? "",
      r.form ?? "",
      deityText,
      area,
      population,
      originText,
      r.expansion ?? "",
      r.i ? (r.expansionism ?? "") : ""
    ].join(",");
  });
  const csvData = [headers].concat(data).join("\n");

  const name = `${getFileName("Religions")}.csv`;
  downloadFile(csvData, name);
}

function highlightReligion(this: HTMLElement): void {
  const religionId = +(this.closest(".states") as HTMLElement).dataset.id!;
  const el = select("#relig").select(`#religion${religionId}`).node() as Element | null;
  if (el) highlightElement(el, 4);
}

function updateLockStatus(this: HTMLElement): void {
  if (customization) return;

  const religionId = +(this.closest(".states") as HTMLElement).dataset.id!;
  const classList = this.classList;
  const r = pack.religions[religionId];
  r.lock = !r.lock;

  classList.toggle("icon-lock-open");
  classList.toggle("icon-lock");
}

function recalculateReligions(must?: boolean): void {
  if (!must && !ensureEl<HTMLInputElement>("religionsAutoChange").checked) return;

  Religions.recalculate();

  Layers.draw("religions");
  refreshReligionsEditor();
  drawReligionCenters();
}

function closeReligionsEditor(): void {
  select("#debug").select("#religionCenters").remove();
  if (customization === 8) exitAddReligionMode();
  $("#religionsEditor").dialog("destroy");
  ensureEl("religionsEditor").remove();
}

export const ReligionsEditor = { open };
