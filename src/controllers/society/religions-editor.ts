import { type D3DragEvent, drag, easeSinIn, select, transition } from "d3";
import { Controllers } from "@/controllers";
import { RELIGION_EXPANSION_LABELS, RELIGION_TYPE_LABELS } from "@/data/id-labels";
import { Pack } from "@/model/graph/pack-generator";
import type { Religion } from "@/model/society/religions-generator";
import { Religions } from "@/model/society/religions-generator";
import { Tags } from "@/model/tags";
import { getArea, getAreaUnit } from "@/model/units";
import { Layers } from "@/renderers/layers";
import { LegendBoxes } from "@/renderers/legend-boxes";
import { Csv } from "@/services/io/csv";
import type { LegendItem } from "@/types/legend";
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
import { highlightElement } from "@/ui/map/highlight";
import { applyDefaultViewboxEvents } from "@/ui/map/viewbox-events";
import { clearMainTip, tip } from "@/ui/tooltips";
import { groupByValue } from "@/utils/array-utils";
import { debounce } from "@/utils/common-utils";
import { isLand } from "@/utils/height-utils";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl, getPointer } from "@/utils/node-utils";
import { rn, si } from "@/utils/number-utils";
import { errorText, parseTransform } from "@/utils/string-utils";

const dialogId = "religionsEditor" as const;
const CSV_COLUMNS = [
  "Id",
  "Name",
  "Color",
  "Type",
  "Form",
  "Supreme Deity",
  "Culture",
  "Area",
  "Cells",
  "Believers",
  "Origins",
  "Potential",
  "Expansionism",
  "Tags"
];
const LEGEND_NAME = "Religions"; // the legend box this editor toggles
const position = { my: "right top", at: "right-10 top+10", of: "svg" };
let filterState: { showExtinct: boolean; search?: string };

const columns: EditorColumn<Religion>[] = [
  { key: "color", width: "1.2em", permanent: true },
  {
    key: "name",
    label: t("Religion"),
    width: "14em",
    permanent: true,
    sortBy: religion => religion.name || "",
    sortType: "alpha"
  },
  {
    key: "type",
    label: t("Type"),
    width: "7.5em",
    defaultSort: "asc",
    sortBy: religion => religion.type || "",
    sortType: "alpha"
  },
  {
    key: "form",
    label: t("Form"),
    width: "7em",
    mobileHidden: true,
    sortBy: religion => religion.form || "",
    sortType: "alpha"
  },
  {
    key: "deity",
    label: t("Deity"),
    width: "14em",
    mobileHidden: true,
    sortBy: religion => religion.deity || "",
    sortType: "alpha"
  },
  {
    key: "area",
    label: t("Area"),
    width: "7em",
    mobileHidden: true,
    sortBy: religion => religion.area || 0
  },
  {
    key: "population",
    label: t("Population"),
    width: "6em",
    sortBy: religion =>
      (religion.rural || 0) * options.map.units.population.scale +
      (religion.urban || 0) * options.map.units.population.scale * options.map.units.population.urbanization.rate
  },
  {
    key: "expansion",
    label: t("Expansion"),
    width: "5em",
    hidden: true,
    mobileHidden: true,
    sortBy: religion => religion.expansion || "",
    sortType: "alpha"
  },
  {
    key: "expansionism",
    label: t("Expansionism"),
    width: "5em",
    hidden: true,
    mobileHidden: true,
    sortBy: religion => religion.expansionism || 0
  },
  {
    key: "tags",
    label: t("Tags"),
    width: "10em",
    hidden: true,
    sortBy: religion => Tags.format(religion.tags),
    sortType: "alpha"
  },
  { key: "note", width: "1.1em" },
  { key: "locate", width: "1.1em" },
  { key: "lock", width: "1.1em" },
  { key: "remove", width: "1.4em", permanent: true }
];

function getFilteredReligions(): Religion[] {
  const searchText = filterState?.search?.toLowerCase().trim();
  const religions = pack.religions.filter(r => !r.removed && !(r.i && !r.cells && !filterState.showExtinct));
  if (!searchText) return religions;
  return religions.filter(r => Tags.matches(searchText, r.name, r.tags, [r.deity, r.form, r.type]));
}

const religionsTable = initEditorTable<Religion>({
  getData: () => sortDataByColumns(dialogId, getFilteredReligions(), columns),
  onUpdate: religionsEditorAddLines
});

function open(): void {
  if (options.app.mode) return;
  filterState = dialogState.get(dialogId, "filters", () => ({ showExtinct: false, search: "" }));
  Dialog.closeAll(`#${dialogId}, .stable`);
  Layers.show("religions");
  Layers.hide("states", "biomes");
  Layers.hide("cultures", "provinces");

  renderDialog();
  religionsCollectStatistics();
  drawReligionCenters();
  religionsTable.reset();

  Dialog.open(dialogId, {
    title: t("Religions Editor"),
    width: "fit-content",
    onClose: closeReligionsEditor,
    position
  });
}

function onSearchInput(): void {
  filterState.search = ensureEl<HTMLInputElement>("religionsSearch").value;
  dialogState.set(dialogId, "filters", filterState);
  religionsTable.reset();
}

function renderDialog(): void {
  Dialog.destroy("religionsEditor");
  const editorHtml = /* html */ `<div id="religionsEditor" class="dialog stable editorDialog">
    <div id="religionsBody" class="table" data-type="absolute">${renderEditorHeader({ dialogId, columns })}</div>
    <div id="religionsFilters" data-tip="${t("Apply a filter")}" class="editorFilters">
      <label for="religionsSearch" data-tip="${t("Filter by name, deity, form, type, or tag")}">
        ${t("Search")}: <input id="religionsSearch" type="search" />
      </label>
    </div>

    <div id="religionsFooter" class="totalLine">
      <div data-tip="${t("Total number of organized religions")}" style="margin-left: 12px">
        ${t("Organized", { context: "count" })}:&nbsp;<span id="religionsOrganized">0</span>
      </div>
      <div data-tip="${t("Total number of heresies")}" style="margin-left: 12px">
        ${t("Heresies")}:&nbsp;<span id="religionsHeresies">0</span>
      </div>
      <div data-tip="${t("Total number of cults")}" style="margin-left: 12px">
        ${t("Cults")}:&nbsp;<span id="religionsCults">0</span>
      </div>
      <div data-tip="${t("Total number of folk religions")}" style="margin-left: 12px">
        ${t("Folk", { context: "count" })}:&nbsp;<span id="religionsFolk">0</span>
      </div>
      <div data-tip="${t("Total land area")}" style="margin-left: 12px" data-col="area">
        ${t("Land area")}:&nbsp;<span id="religionsFooterArea">0</span>
      </div>
      <div data-tip="${t("Total number of believers (population)")}" style="margin-left: 12px" data-col="population">
        ${t("Believers")}:&nbsp;<span id="religionsFooterPopulation">0</span>
      </div>
    </div>

    <div id="religionsBottom" class="editorToolbar">
      <button id="religionsEditorRefresh" data-tip="${t("Refresh")}" class="icon-cw"></button>
      <button id="religionsEditStyle" data-tip="${t("Edit style in Style Editor")}" class="icon-adjust"></button>
      <button id="religionsLegend" data-tip="${t("Toggle Legend box")}" class="icon-list-bullet"></button>
      <button id="religionsPercentage" data-tip="${t("Toggle percentage / absolute values views")}" class="icon-percent"></button>
      <button id="religionsHeirarchy" data-tip="${t("Religions tree")}" class="icon-sitemap"></button>
      <button id="religionsExtinct" data-tip="${t("Show/hide extinct religions (religions without cells)")}" class="icon-eye-off"></button>

      <button id="religionsManually" data-tip="${t("Manually re-assign religions")}" class="icon-brush"></button>
      <button id="religionsAdd" data-tip="${sentences(t("Add"), t("Hold Shift to add multiple"))}" class="icon-plus"></button>
      <button id="religionsExport" data-tip="${t("Save data as a CSV file")}" class="icon-download"></button>
      <button id="religionsImport" data-tip="${t("Upload data from a CSV file")}" class="icon-upload"></button>
      <button id="religionsRecalculate" data-tip="${t("Recalculate religions based on current values of growth-related attributes")}" class="icon-retweet"></button>
      <span
        data-tip="${t("Allow religion center, extent, and expansionism changes to take an immediate effect")}"
        class="editorToolbarPanel"
      >
        <input id="religionsAutoChange" class="checkbox" type="checkbox" />
        <label for="religionsAutoChange" class="checkbox-label"><i>${t("auto-apply changes")}</i></label>
      </span>
    </div>
  </div>`;

  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  syncFilterControls();
  const searchInput = ensureEl<HTMLInputElement>("religionsSearch");
  searchInput.value = filterState.search ?? "";
  searchInput.addEventListener("input", onSearchInput);
  bindColumnSorting(dialogId, religionsTable.reset);
  applyLineHighlighting(dialogId, ({ cellId }) => pack.cells.religion[cellId]);

  ensureEl("religionsEditorRefresh").addEventListener("click", refreshReligionsEditor);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => Dialog.update(dialogId, { width: "fit-content", position })
  });
  ensureEl("religionsEditStyle").addEventListener("click", () => void Controllers.StyleEditor.open("religions"));
  ensureEl("religionsLegend").addEventListener("click", toggleLegend);
  ensureEl("religionsPercentage").addEventListener("click", togglePercentageMode);
  ensureEl("religionsHeirarchy").addEventListener("click", showHierarchy);
  ensureEl("religionsExtinct").addEventListener("click", toggleExtinct);
  ensureEl("religionsManually").addEventListener("click", openPaintEditor);
  ensureEl("religionsAdd").addEventListener("click", enterAddReligionMode);
  ensureEl("religionsExport").addEventListener("click", downloadReligionsCsv);
  ensureEl("religionsImport").addEventListener("click", () => Csv.pick(uploadReligionsCsv));
  ensureEl("religionsRecalculate").addEventListener("click", () => recalculateReligions(true));
}

function refreshReligionsEditor(): void {
  religionsCollectStatistics();
  religionsTable.refresh();
}

function religionsCollectStatistics(): void {
  const { cells, religions, burgs } = pack;
  religions.forEach(r => {
    r.cells = r.area = r.rural = r.urban = 0;
  });

  for (const i of cells.i) {
    if (cells.h[i] < 20) continue;
    const religionId = cells.religion[i];
    religions[religionId].cells! += 1;
    religions[religionId].area! += cells.area[i];
    religions[religionId].rural! += cells.pop[i];
    const burgId = cells.burg[i];
    if (burgId) religions[religionId].urban! += burgs[burgId].population!;
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
    totalPopulation += rn(
      (r.rural ?? 0) * options.map.units.population.scale +
        (r.urban ?? 0) * options.map.units.population.scale * options.map.units.population.urbanization.rate
    );
  }

  for (const r of view.rows) {
    const area = getArea(r.area ?? 0);
    const rural = (r.rural ?? 0) * options.map.units.population.scale;
    const urban = (r.urban ?? 0) * options.map.units.population.scale * options.map.units.population.urbanization.rate;
    const population = rn(rural + urban);
    const populationTip = sentences(
      t("Believers: {{total}}; Rural areas: {{rural}}; Urban areas: {{urban}}", {
        total: si(population),
        rural: si(rural),
        urban: si(urban)
      }),
      t("Click to change")
    );

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
        <input data-tip="${sentences(t("Name"), t("Click and type to change"))}" class="religionName italic"
          value="${r.name}" autocorrect="off" spellcheck="false" data-col="name" />
        <select data-tip="${t("Religion type")}" class="religionType placeholder" data-col="type">
          ${getTypeOptions(r.type)}
        </select>
        <input data-tip="${t("Religion form")}" class="religionForm placeholder" value="" autocorrect="off" spellcheck="false" data-col="form" />
        <div data-col="deity">
          <span class="icon-arrows-cw placeholder"></span>
          <input class="religionDeity placeholder" value="" autocorrect="off" spellcheck="false" />
        </div>
        <div data-col="area">
          <span data-tip="${t("Religion area")}" style="padding-right: 4px" class="icon-map-o"></span>
          <div data-tip="${t("Religion area")}" class="religionArea">${si(area) + unit}</div>
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
        <div data-col="tags"></div>
        <div data-col="note"></div>
        <div data-col="locate"></div>
        <div data-col="lock"></div>
        <div data-col="remove"></div>
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
      <input data-tip="${sentences(t("Name"), t("Click and type to change"))}" class="religionName"
        value="${r.name}" autocorrect="off" spellcheck="false" data-col="name" />
      <select data-tip="${t("Religion type")}" class="religionType" data-col="type">
        ${getTypeOptions(r.type)}
      </select>
      <input data-tip="${t("Religion form")}" class="religionForm"
        value="${r.form}" autocorrect="off" spellcheck="false" data-col="form" />
      <div data-col="deity">
        <span data-tip="${t("Click to re-generate supreme deity")}" class="icon-arrows-cw pointer"></span>
        <input data-tip="${t("Religion supreme deity")}" class="religionDeity"
          value="${r.deity || ""}" autocorrect="off" spellcheck="false" />
      </div>
      <div data-col="area">
        <span data-tip="${t("Religion area")}" style="padding-right: 4px" class="icon-map-o"></span>
        <div data-tip="${t("Religion area")}" class="religionArea">${si(area) + unit}</div>
      </div>
      <div data-col="population">
        <span data-tip="${populationTip}" class="icon-male"></span>
        <div data-tip="${populationTip}" class="religionPopulation pointer">${si(population)}</div>
      </div>
      ${getExpansionColumns(r)}
      <div data-col="tags">
        <input
          data-tip="${t("Tags (comma-separated)")}"
          class="religionTags"
          value="${Tags.format(r.tags)}"
          placeholder="${t("Tags")}"
          autocorrect="off"
          spellcheck="false"
        />
      </div>
      ${noteIcon(t("Edit free text notes (legend)"))}
      <span data-col="locate" data-tip="${t("Locate on map")}" class="icon-target"></span>
      <span data-col="lock" data-tip="${t("Lock")}" class="icon-lock${r.lock ? "" : "-open"}"></span>
      <span data-col="remove" data-tip="${t("Remove")}" class="icon-trash-empty"></span>
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
    .querySelectorAll("div > input.religionTags")
    .forEach(el => void el.addEventListener("change", religionChangeTags));
  ensureEl("religionsBody")
    .querySelectorAll("div > span.icon-trash-empty")
    .forEach(el => void el.addEventListener("click", religionRemovePrompt));
  ensureEl("religionsBody")
    .querySelectorAll("div > span.icon-book")
    .forEach($el => void $el.addEventListener("click", editReligionNote));
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

  Dialog.update(dialogId, { width: "fit-content", position });
}

function getTypeOptions(type: string): string {
  let options = "";
  const types = ["Folk", "Organized", "Cult", "Heresy"];
  types.forEach(t => {
    options += `<option ${type === t ? "selected" : ""} value="${t}">${RELIGION_TYPE_LABELS[t] ?? t}</option>`;
  });
  return options;
}

function getExpansionColumns(r: Religion): string {
  if (r.type === "Folk") {
    const folkTip = t(
      "Folk religions are not competitive and do not expand. Initially they cover all cells of their parent culture, but get ousted by organized religions when they expand"
    );
    return /* html */ `
      <div data-col="expansion">
        <span data-tip="${folkTip}" class="icon-resize-full-alt" style="padding-right: 2px"></span>
        <span data-tip="${folkTip}" class="religionExtent">${t("culture")}</span>
      </div>
      <div data-col="expansionism">
        <span data-tip="${folkTip}" class="icon-resize-full"></span>
        <input data-tip="${folkTip}" class="religionExpantion" disabled type="number" value='0' />
      </div>`;
  }

  return /* html */ `
    <div data-col="expansion">
      <span data-tip="${t("Potential religion extent")}" class="icon-resize-full-alt" style="padding-right: 2px"></span>
      <select data-tip="${t("Potential religion extent")}" class="religionExtent">
        ${getExtentOptions(r.expansion)}
      </select>
    </div>
    <div data-col="expansionism">
      <span data-tip="${sentences(t("Religion expansionism"), t("Defines competitive size"))}" class="icon-resize-full"></span>
      <input
        data-tip="${sentences(t("Religion expansionism"), t("Defines competitive size"), t("Click to change, then click Recalculate to apply"))}"
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
    options += `<option ${type === t ? "selected" : ""} value="${t}">${RELIGION_EXPANSION_LABELS[t] ?? t}</option>`;
  });
  return options;
}

// a table row or center circle event, or a hierarchy tree node
type HighlightSource = Event | { id?: string; data: { name: string; shadow?: boolean } };
const highlightedId = (source: HighlightSource) =>
  Number("data" in source ? source.id : (source.target as HTMLElement | null)?.dataset.id);

const religionHighlightOn = debounce((event: HighlightSource) => {
  const religionId = highlightedId(event);
  const $el = ensureEl("religionsBody").querySelector(`div[data-id='${religionId}']`);
  if ($el) $el.classList.add("active");

  if (!Layers.isOn("religions")) return;
  if (options.app.mode) return;

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
    .attr("r", "6em")
    .attr("stroke", "#d0240f");
}, 200);

function religionHighlightOff(event: HighlightSource): void {
  const religionId = highlightedId(event);
  const $el = ensureEl("religionsBody").querySelector(`div[data-id='${religionId}']`);
  if ($el) $el.classList.remove("active");

  select("#relig").select(`#religion${religionId}`).transition().attr("stroke-width", null).attr("stroke", null);
  select("#debug").select(`#religionsCenter${religionId}`).transition().attr("r", "4em").attr("stroke", null);
}

function religionChangeColor(this: FillBoxElement): void {
  const currentFill = this.getAttribute("fill") || "#ffffff";
  const religionId = +(this.parentNode as HTMLElement).dataset.id!;

  const callback = (newFill: string) => {
    this.fill = newFill;
    pack.religions[religionId].color = newFill;
    select("#relig").select(`#religion${religionId}`).attr("fill", newFill);
    select("#debug").select(`#religionsCenter${religionId}`).attr("fill", newFill);
  };

  void Controllers.ColorPicker.open(currentFill, callback);
}

function religionChangeName(this: HTMLInputElement): void {
  const religionId = +(this.parentNode as HTMLElement).dataset.id!;
  (this.parentNode as HTMLElement).dataset.name = this.value;
  if (this.value.trim()) Religions.rename(religionId, this.value);
}

function religionChangeType(this: HTMLSelectElement): void {
  const religionId = +(this.parentNode as HTMLElement).dataset.id!;
  (this.parentNode as HTMLElement).dataset.type = this.value;
  Religions.setType(religionId, this.value);
}

function religionChangeForm(this: HTMLInputElement): void {
  const religionId = +(this.parentNode as HTMLElement).dataset.id!;
  (this.parentNode as HTMLElement).dataset.form = this.value;
  if (this.value.trim()) Religions.setForm(religionId, this.value);
}

function religionChangeDeity(this: HTMLInputElement): void {
  const row = this.closest(".states") as HTMLElement;
  const religionId = +row.dataset.id!;
  row.dataset.deity = this.value;
  Religions.setDeity(religionId, this.value);
}

function religionChangeTags(this: HTMLInputElement): void {
  const line = this.closest(".states") as HTMLElement;
  const religionId = Number(line.dataset.id);
  const religion = pack.religions[religionId];
  if (!religion) return;

  Tags.set(religion, this.value);
  this.value = Tags.format(religion.tags);
  if (filterState.search) religionsTable.refresh();
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
    tip(t("No cells, cannot change population"), false, "error");
    return;
  }

  const rural = rn((religion.rural ?? 0) * options.map.units.population.scale);
  const urban = rn(
    (religion.urban ?? 0) * options.map.units.population.scale * options.map.units.population.urbanization.rate
  );
  const total = rural + urban;
  const format = (n: number) => Number(n).toLocaleString();
  const burgs = pack.burgs.filter(b => !b.removed && pack.cells.religion[b.cell] === religionId);

  Dialog.message({
    message: /* html */ `<div>
    <i>${t("All population of religion territory is considered believers of this religion. It means believers number change will directly affect population")}</i>
    <div style="margin: 0.5em 0">
      ${t("Rural")}: <input type="number" min="0" step="1" id="ruralPop" value=${rural} style="width:6em" />
      ${t("Urban")}: <input type="number" min="0" step="1" id="urbanPop" value=${urban} style="width:6em"
        ${burgs.length ? "" : "disabled"} />
    </div>
    <div>${t("Total population")}: ${format(total)} ⇒ <span id="totalPop">${format(total)}</span>
      (<span id="totalPopPerc">100</span>%)
    </div>
  </div>`,
    title: t("Change believers number"),
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

  function applyPopulationChange() {
    try {
      Religions.setPopulation(religionId, +ruralPop.value || 0, +urbanPop.value || 0);
    } catch (error) {
      tip(errorText(error), false, "error");
      return;
    }
    Layers.draw("population");
    refreshReligionsEditor();
  }
}

function religionChangeExtent(this: HTMLSelectElement): void {
  const row = this.closest(".states") as HTMLElement;
  const religion = +row.dataset.id!;
  row.dataset.expansion = this.value;
  Religions.setExpansion(religion, this.value);
  recalculateReligions();
}

function religionChangeExpansionism(this: HTMLInputElement): void {
  const row = this.closest(".states") as HTMLElement;
  const religion = +row.dataset.id!;
  row.dataset.expansionism = this.value;
  if (!(+this.value >= 0 && +this.value <= 99)) return;
  Religions.setExpansionism(religion, +this.value);
  recalculateReligions();
}

function religionRemovePrompt(this: HTMLElement): void {
  if (options.app.mode) return;

  const religionId = +(this.closest(".states") as HTMLElement).dataset.id!;
  Dialog.confirm({
    title: t("Remove"),
    message: `${t("Are you sure you want to remove the religion?")}<br>${t("This action cannot be reverted")}`,
    confirm: t("Remove"),
    onConfirm: () => removeReligion(religionId)
  });
}

function removeReligion(religionId: number): void {
  select("#relig").select(`#religion${religionId}`).remove();
  select("#relig").select(`#religion-gap${religionId}`).remove();
  select("#debug").select(`#religionsCenter${religionId}`).remove();

  Religions.remove(religionId);

  refreshReligionsEditor();
}

function drawReligionCenters(): void {
  const debugLayer = select("#debug");
  debugLayer.select("#religionCenters").remove();
  const religionCenters = debugLayer
    .append("g")
    .attr("id", "religionCenters")
    .attr("stroke", "#444444")
    .style("cursor", "move");

  let data = pack.religions.filter(r => r.i && r.center && !r.removed);
  if (!filterState.showExtinct) data = data.filter(r => (r.cells ?? 0) > 0);

  religionCenters
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("id", d => `religionsCenter${d.i}`)
    .attr("data-id", d => d.i)
    .attr("r", "4em")
    .attr("fill", d => d.color)
    .attr("cx", d => pack.cells.p[d.center][0])
    .attr("cy", d => pack.cells.p[d.center][1])
    .on("mouseenter", (event: MouseEvent, d) => {
      tip(t("{{religion}}. Drag to move the religion center", { religion: d.name }), true);
      religionHighlightOn(event);
    })
    .on("mouseleave", (event: MouseEvent) => {
      tip("", true);
      religionHighlightOff(event);
    })
    .call(drag<SVGCircleElement, Religion>().on("start", religionCenterDrag));
}

function religionCenterDrag(this: SVGCircleElement, event: D3DragEvent<SVGCircleElement, Religion, Religion>): void {
  const religionId = Number(this.dataset.id);
  const tr = parseTransform(this.getAttribute("transform"));
  const x0 = +tr[0] - event.x;
  const y0 = +tr[1] - event.y;

  function handleDrag(this: SVGCircleElement, dragEvent: D3DragEvent<SVGCircleElement, Religion, Religion>) {
    const { x, y } = dragEvent;
    this.setAttribute("transform", `translate(${x0 + x},${y0 + y})`);
    const cell = Pack.findCell(x, y);
    if (cell == null || pack.cells.h[cell] < 20) return; // ignore dragging on water

    try {
      Religions.moveCenter(religionId, x, y);
    } catch (error) {
      tip(error instanceof Error ? error.message : String(error), false, "error", 2000); // another center is there
      return;
    }
    recalculateReligions();
  }

  const dragDebounced = debounce(handleDrag, 50);
  event.on("drag", dragDebounced);
}

function toggleLegend(): void {
  const getItems = () =>
    pack.religions
      .filter(r => r.i && !r.removed && r.area)
      .sort((a, b) => (b.area ?? 0) - (a.area ?? 0))
      .map((r): LegendItem => [r.i, r.color, r.name]);
  LegendBoxes.toggle(LEGEND_NAME, getItems, t("No religions to show"));
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
        $el.querySelector<HTMLElement>(".religionArea")!.textContent = `${rn((+area! / totalArea) * 100)}%`;
        $el.querySelector<HTMLElement>(".religionPopulation")!.textContent =
          `${rn((+population! / totalPopulation) * 100)}%`;
      });
  } else {
    ensureEl("religionsBody").dataset.type = "absolute";
    religionsTable.refresh();
  }
}

async function showHierarchy(): Promise<void> {
  if (options.app.mode) return;

  const getDescription = (religion: Religion) => {
    const { name, type, form, rural, urban } = religion;

    const getTypeText = () => {
      if (name.includes(type) || form.includes(type)) return "";
      if (type === "Folk") return t("Folk religion");
      if (type === "Organized") return t("Organized religion");
      return RELIGION_TYPE_LABELS[type] ?? type;
    };

    const population =
      (rural ?? 0) * options.map.units.population.scale +
      (urban ?? 0) * options.map.units.population.scale * options.map.units.population.urbanization.rate;
    const populationText =
      population > 0 ? t("{{- population}} people", { population: si(rn(population)) }) : t("Extinct");

    return sentences(...[name, getTypeText(), form === type ? "" : form, populationText].filter(Boolean));
  };

  const getShape = ({ type }: Religion) => {
    if (type === "Folk") return "circle";
    if (type === "Organized") return "square";
    if (type === "Cult") return "hexagon";
    if (type === "Heresy") return "diamond";
  };

  Controllers.HierarchyTree.open({
    type: "religions",
    data: pack.religions,
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
    title: t("Paint Religions"),
    parentDialogId: dialogId,
    onClose: open,
    items: pack.religions
      .filter(religion => !religion.removed)
      .map(religion => ({ id: religion.i, name: religion.name, color: religion.color || "#ffffff" })),
    dontOverrideControl: true,
    getValue: cell => pack.cells.religion[cell],
    filterCell: cell => isLand(cell, pack),
    onApply: applyReligionPaint
  });
}

function applyReligionPaint(changes: ReadonlyMap<number, number>): void {
  for (const [religion, cells] of groupByValue(changes)) Religions.setCells(religion, cells);
  if (changes.size) {
    Layers.draw("religions");
    if (findEl(dialogId)) refreshReligionsEditor();
    drawReligionCenters();
  }
}

function enterAddReligionMode(this: HTMLElement): void {
  if (this.classList.contains("pressed")) {
    exitAddReligionMode();
    return;
  }

  options.app.mode = "addReligion";
  this.classList.add("pressed");
  tip(t("Click on the map to add a new religion"), true);
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addReligion);
  ensureEl("religionsBody")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.pointerEvents = "none";
    });
}

function exitAddReligionMode(): void {
  options.app.mode = null;
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
  try {
    Religions.add(x, y);
  } catch (error) {
    tip(errorText(error), false, "error");
    return;
  }
  if (event.shiftKey === false) exitAddReligionMode();

  Layers.draw("religions");
  refreshReligionsEditor();
  drawReligionCenters();
}

function downloadReligionsCsv(): void {
  const { scale, urbanization } = options.map.units.population;
  const headers = CSV_COLUMNS.map(column => (column === "Area" ? `Area ${getAreaUnit("2")}` : column));
  // export the full filtered set (all pages), not just the visible page
  const rows = religionsTable.view().all.map(r => {
    return [
      r.i,
      r.name,
      r.color,
      r.type,
      r.form,
      r.deity,
      r.i ? pack.cultures[r.culture]?.name : "",
      getArea(r.area ?? 0),
      r.cells,
      rn((r.rural ?? 0) * scale + (r.urban ?? 0) * scale * urbanization.rate),
      originNames(r),
      r.expansion,
      r.i ? r.expansionism : "",
      Tags.format(r.tags)
    ];
  });
  Csv.download("Religions", headers, rows);
}

function editReligionNote(this: HTMLElement): void {
  const id = +(this.closest(".states") as HTMLElement).dataset.id!;
  void Controllers.NotesEditor.open({ type: "religion", id });
}

function highlightReligion(this: HTMLElement): void {
  const religionId = +(this.closest(".states") as HTMLElement).dataset.id!;
  const el = select("#relig").select(`#religion${religionId}`).node() as Element | null;
  if (el) highlightElement(el, 4);
}

function updateLockStatus(this: HTMLElement): void {
  if (options.app.mode) return;

  const religionId = +(this.closest(".states") as HTMLElement).dataset.id!;
  const classList = this.classList;
  Religions.setLocked(religionId, !pack.religions[religionId].lock);

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
  if (options.app.mode === "addReligion") exitAddReligionMode();
  Controllers.ColorPicker.close();
  const view = religionsTable.view();
  view.rows = [];
  view.all = [];
  Dialog.destroy("religionsEditor");
}

const originNames = (religion: Religion) =>
  (religion.origins ?? [])
    .filter((origin): origin is number => Boolean(origin))
    .map(origin => pack.religions[origin].name)
    .join(", ");
const splitNames = (names: string) =>
  names
    .split(",")
    .map(name => name.trim())
    .filter(Boolean);

/** Update existing religions from a CSV in the export format */
async function uploadReligionsCsv(text: string): Promise<void> {
  const { scale, urbanization } = options.map.units.population;
  const find = (id: number) => (pack.religions[id]?.removed ? undefined : pack.religions[id]);
  const textColumns = ["Name", "Type", "Form", "Supreme Deity", "Potential", "Tags"];
  // a renamed religion keeps its old name in other rows' origins, so they are read by the names as downloaded
  const living = pack.religions.filter(religion => !religion.removed);
  const origins = new Map(living.map(religion => [religion.i, originNames(religion)]));
  const ids = new Map(living.map(religion => [religion.name, religion.i]));
  const originId = (name: string) => ids.get(name) ?? Csv.byName(pack.religions, name).i;
  const updated = await Controllers.CsvUpload.update(
    text,
    CSV_COLUMNS,
    { find, units: ["Area"], text: textColumns },
    (id, row) => {
      const religion = find(id)!;
      row.apply("Name", name => Religions.rename(id, name), religion.name);
      row.apply("Color", color => Religions.recolor(id, color), religion.color);
      row.apply("Type", type => Religions.setType(id, type), religion.type);
      row.apply("Form", form => Religions.setForm(id, form), religion.form);
      row.apply("Supreme Deity", deity => Religions.setDeity(id, deity), religion.deity);
      row.apply("Potential", expansion => Religions.setExpansion(id, expansion), religion.expansion);
      row.apply("Expansionism", value => Religions.setExpansionism(id, +value), religion.expansionism);
      row.assign(
        "Origins",
        names => Religions.setOrigins(id, names ? splitNames(names).map(originId) : [0]), // empty is the top level
        origins.get(id)
      );
      row.assign("Tags", tags => Tags.set(religion, tags), Tags.format(religion.tags));
      row.population(
        [(religion.rural ?? 0) * scale, (religion.urban ?? 0) * scale * urbanization.rate],
        (rural, urban) => Religions.setPopulation(id, rural, urban),
        ["Believers"]
      );
    }
  );
  if (!updated) return;

  Layers.draw("religions");
  refreshReligionsEditor();
}

export const ReligionsEditor = { open, showHierarchy };
