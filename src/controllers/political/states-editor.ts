import { type HierarchyCircularNode, max, pack as packLayout, select, stratify } from "d3";
import { Controllers } from "@/controllers";
import { CULTURE_TYPE_LABELS, EXPENSE_LABELS } from "@/data/id-labels";
import { StateEconomy } from "@/model/economy/state-economy";
import { Pack } from "@/model/graph/pack-generator";
import { Burgs } from "@/model/political/burgs-generator";
import { Districts } from "@/model/political/districts";
import { Stability } from "@/model/political/stability";
import { EXPENSES, STATE_FORMS, type State, States } from "@/model/political/states-generator";
import { Names } from "@/model/society/names-generator";
import { Tags } from "@/model/tags";
import { getArea, getAreaUnit } from "@/model/units";
import { redrawEmblem, removeEmblem } from "@/renderers/draw-emblems";
import { EmblemRenderer } from "@/renderers/emblems/renderer";
import { Layers } from "@/renderers/layers";
import { LegendBoxes } from "@/renderers/legend-boxes";
import { fog, unfog } from "@/renderers/overlays/fogging";
import { Csv } from "@/services/io/csv";
import { speak } from "@/services/speech";
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
import {
  adjustmentsFromText,
  adjustmentsToText,
  EconomyTerms,
  prosperityTip,
  renderProsperityPercent
} from "@/ui/economy-view";
import type { FillBoxElement } from "@/ui/elements/fill-box";
import { createAnnexMode } from "@/ui/map/annex-mode";
import { highlightElement, highlightOutline } from "@/ui/map/highlight";
import { applyDefaultViewboxEvents } from "@/ui/map/viewbox-events";
import { zoomTo } from "@/ui/map/zoom";
import { clearMainTip, tip } from "@/ui/tooltips";
import { groupByValue } from "@/utils/array-utils";
import { isLand } from "@/utils/height-utils";
import { sentences, t } from "@/utils/i18n";
import { getAdjective } from "@/utils/language-utils";
import { applyOption, ensureEl, findEl, getPointer } from "@/utils/node-utils";
import { rn, si } from "@/utils/number-utils";
import { rand } from "@/utils/probability-utils";
import { errorText } from "@/utils/string-utils";

const dialogId = "statesEditor" as const;
const LEGEND_NAME = "States"; // the legend box this editor toggles
const position = { my: "right top", at: "right-10 top+10", of: "svg" };
let filterState: { search: string };

/** Taxes as a percentage of the state's product; null for the neutral lands or before an economy run */
const taxBurden = (s: State): number | null => {
  const accounts = s.i ? StateEconomy.getAccounts(s.i) : null;
  return accounts?.product ? (accounts.taxes / accounts.product) * 100 : null;
};

const columns: EditorColumn<State>[] = [
  { key: "color", width: "1.2em", permanent: true },
  {
    key: "name",
    label: t("State"),
    width: "7em",
    permanent: true,
    sortBy: s => s.name || "",
    sortType: "alpha"
  },
  { key: "emblem", width: "1.4em" },
  {
    key: "form",
    label: t("Form"),
    width: "8em",
    mobileHidden: true,
    sortBy: s => (s.i ? s.formName || "" : ""),
    sortType: "alpha"
  },
  {
    key: "capital",
    label: t("Capital"),
    width: "7em",
    sortBy: s => (s.i ? pack.burgs[s.capital]?.name || "" : ""),
    sortType: "alpha"
  },
  {
    key: "culture",
    label: t("Culture"),
    width: "6em",
    mobileHidden: true,
    sortBy: s => (s.i ? pack.cultures[s.culture]?.name || "" : ""),
    sortType: "alpha"
  },
  {
    key: "burgs",
    label: t("Burgs"),
    width: "5em",
    mobileHidden: true,
    sortBy: s => s.burgs || 0
  },
  {
    key: "cells",
    label: t("Cells"),
    width: "5em",
    hidden: true,
    mobileHidden: true,
    sortBy: s => s.cells || 0
  },
  {
    key: "area",
    label: t("Area"),
    width: "7em",
    mobileHidden: true,
    defaultSort: "desc",
    sortBy: s => getArea(s.area || 0)
  },
  {
    key: "population",
    label: t("Population"),
    width: "6em",
    sortBy: s =>
      rn(
        (s.rural || 0) * options.map.units.population.scale +
          (s.urban || 0) * options.map.units.population.scale * options.map.units.population.urbanization.rate
      )
  },
  {
    key: "treasury",
    label: t("Balance"),
    width: "6em",
    mobileHidden: true,
    tip: sentences(EconomyTerms.stateTreasury(), EconomyTerms.openValue()),
    sortBy: s => s.economy.treasury || 0
  },
  {
    key: "burden",
    label: t("Tax burden"),
    width: "6em",
    hidden: true,
    mobileHidden: true,
    tip: sentences(t("Tax burden: the taxes' share of the product"), EconomyTerms.openValue()),
    sortBy: s => taxBurden(s) ?? -1
  },
  {
    key: "corruption",
    label: t("Corruption"),
    width: "6em",
    hidden: true,
    mobileHidden: true,
    tip: sentences(EconomyTerms.corruption(), EconomyTerms.openValue()),
    sortBy: s => (s.i ? Districts.getStateCorruption(s, s.economy.collected) : 0)
  },
  ...EXPENSES.map(
    (expense): EditorColumn<State> => ({
      key: expense,
      label: EXPENSE_LABELS[expense],
      width: "6em",
      hidden: true,
      mobileHidden: true,
      tip: sentences(EconomyTerms.expenseTip(expense), EconomyTerms.openValue()),
      sortBy: s => (s.i ? s.economy.budget[expense] : -1)
    })
  ),
  {
    key: "prosperity",
    label: t("Prosperity"),
    width: "6em",
    mobileHidden: true,
    tip: sentences(EconomyTerms.prosperity(), EconomyTerms.openValue()),
    sortBy: s => StateEconomy.getAccounts(s.i)?.prosperity ?? -1
  },
  {
    key: "stability",
    label: t("Stability"),
    width: "6em",
    mobileHidden: true,
    tip: sentences(EconomyTerms.stability(), t("Click a value to open the stability overview")),
    sortBy: s => Stability.get(s.i)?.stability ?? -1
  },
  {
    key: "product",
    label: t("Product"),
    width: "6em",
    hidden: true,
    mobileHidden: true,
    tip: sentences(EconomyTerms.stateProduct(), EconomyTerms.openValue()),
    sortBy: s => StateEconomy.getAccounts(s.i)?.product ?? 0
  },
  {
    key: "wealth",
    label: t("Wealth"),
    width: "6em",
    hidden: true,
    mobileHidden: true,
    tip: sentences(EconomyTerms.wealth(), EconomyTerms.openValue()),
    sortBy: s => StateEconomy.getAccounts(s.i)?.wealth ?? 0
  },
  {
    key: "type",
    label: t("Type"),
    width: "5em",
    hidden: true,
    sortBy: s => (s.i ? s.type || "" : ""),
    sortType: "alpha"
  },
  {
    key: "expansionism",
    label: t("Expansion"),
    width: "5em",
    hidden: true,
    sortBy: s => (s.i ? s.expansionism || 0 : 0)
  },
  {
    key: "tags",
    label: t("Tags"),
    width: "10em",
    hidden: true,
    sortBy: s => Tags.format(s.tags),
    sortType: "alpha"
  },
  { key: "note", width: "1.1em" },
  { key: "locate", width: "1.1em" },
  { key: "focus", width: "1.1em" },
  { key: "lock", width: "1.1em" },
  { key: "remove", width: "1.4em", permanent: true }
];

const CSV_COLUMNS = [
  "Id",
  "State",
  "Full Name",
  "Form",
  "Color",
  "Capital",
  "Culture",
  "Type",
  "Expansionism",
  "Cells",
  "Burgs",
  "Area",
  "Total Population",
  "Rural Population",
  "Urban Population",
  "Provinces",
  "Neighbors",
  "Sales Tax",
  "Poll Tax",
  "Market License",
  "Adjustments",
  "Court",
  "Administration",
  "Infrastructure",
  "Military",
  "Corruption",
  "Treasury",
  "Tags"
];

function getFilteredStates(): State[] {
  const query = filterState?.search;
  const states = pack.states.filter(s => !s.removed);
  if (!query) return states;
  return states.filter(s => {
    if (!s.i) return Tags.matches(query, s.name);
    return Tags.matches(query, s.name, s.tags, [s.fullName]);
  });
}

const statesTable = initEditorTable<State>({
  getData: () => sortDataByColumns(dialogId, getFilteredStates(), columns),
  onUpdate: renderStatesPage
});

function open(): void {
  if (options.app.mode) return;
  filterState = dialogState.get(dialogId, "filters", () => ({ search: "" }));

  Dialog.closeAll(`#${dialogId}, .stable`);
  Layers.show("states", "borders");
  Layers.hide("cultures", "biomes", "religions");

  renderDialog();
  States.collectStatistics();
  statesTable.reset();

  Dialog.open(dialogId, {
    title: t("States Editor"),
    resizable: false,
    position,
    onClose: closeStatesEditor
  });
}

function renderDialog(): void {
  Dialog.destroy(dialogId);
  const editorHtml = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
    <div id="statesBodySection" class="table" data-type="absolute">
      ${renderEditorHeader({ dialogId, columns })}
    </div>

    <div id="statesFilters" class="editorFilters">
      <label for="statesSearch" data-tip="${t("Filter by name or tag")}">${t("Search")}: <input id="statesSearch" type="search" autocomplete="off" /></label>
    </div>

    <div id="statesFooter" class="totalLine">
      <div data-tip="${t("States number")}" style="margin-left: 5px">${t("States")}:&nbsp;<span id="statesFooterStates">0</span></div>
      <div data-tip="${t("Number of burgs")}" style="margin-left: 12px" data-col="burgs">${t("Burgs")}:&nbsp;<span id="statesFooterBurgs">0</span></div>
      <div data-tip="${t("Total land area")}" style="margin-left: 12px" data-col="area">${t("Land area")}:&nbsp;<span id="statesFooterArea">0</span></div>
      <div data-tip="${t("Total population")}" style="margin-left: 12px" data-col="population">${t("Population")}:&nbsp;<span id="statesFooterPopulation">0</span></div>
      <div data-tip="${EconomyTerms.stateTreasury()}" style="margin-left: 12px" data-col="treasury">${t("Avg balance")}:&nbsp;<span id="statesFooterTreasury">0</span></div>
      <div data-tip="${EconomyTerms.prosperity()}" style="margin-left: 12px" data-col="prosperity">${t("Avg prosperity")}:&nbsp;<span id="statesFooterProsperity">—</span></div>
    </div>

    <div id="statesBottom" class="editorToolbar">
      <button id="statesEditorRefresh" data-tip="${t("Refresh")}" class="icon-cw"></button>
      <button id="statesEditStyle" data-tip="${t("Edit style in Style Editor")}" class="icon-adjust"></button>
      <button id="statesLegend" data-tip="${t("Toggle Legend box")}" class="icon-list-bullet"></button>
      <button id="statesPercentage" data-tip="${t("Toggle percentage / absolute values views")}" class="icon-percent"></button>
      <button id="statesChart" data-tip="${t("States bubble chart")}" class="icon-chart-area"></button>

      <button id="statesRegenerate" data-tip="${t("Show")}" class="icon-cog-alt"></button>
      <div id="statesRegenerateButtons" style="display: none">
        <button id="statesRegenerateBack" data-tip="${t("Hide")}" class="icon-cog-alt"></button>
        <button id="statesRandomize" data-tip="${t("Randomize states Expansion value and re-calculate states and provinces")}" class="icon-shuffle"></button>
        <button id="statesRecalculate" data-tip="${t("Recalculate states based on current values of growth-related attributes")}" class="icon-retweet"></button>
        <div data-tip="${t("Allow states neutral distance, expansion and type changes to take an immediate effect")}" style="display: inline-block">
          <input id="statesAutoChange" class="checkbox" type="checkbox" />
          <label for="statesAutoChange" class="checkbox-label"><i>${t("auto-apply changes")}</i></label>
        </div>
        <div data-tip="${t("Allow system to change state labels when states data is change")}" style="display: inline-block">
          <input id="adjustLabels" class="checkbox" type="checkbox" />
          <label for="adjustLabels" class="checkbox-label"><i>${t("auto-change labels")}</i></label>
        </div>
      </div>

      <button id="statesManually" data-tip="${t("Manually re-assign states")}" class="icon-brush"></button>

      <button id="statesAdd" data-tip="${sentences(t("Add"), t("Hold Shift to add multiple"))}" class="icon-plus"></button>
      <button id="statesMerge" data-tip="${t("Merge several states into one")}" class="icon-layer-group"></button>
      <button id="statesAnnex" data-tip="${sentences(t("Annex states: click the annexing state, then the states it absorbs"), t("Hold Shift to keep annexing"))}" class="icon-crown"></button>
      <button id="statesExport" data-tip="${t("Save data as a CSV file")}" class="icon-download"></button>
      <button id="statesImport" data-tip="${t("Upload data from a CSV file")}" class="icon-upload"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  ensureEl<HTMLInputElement>("statesSearch").value = filterState.search;

  bindColumnSorting(dialogId, statesTable.reset);
  applyLineHighlighting(dialogId, ({ cellId }) => (pack.cells.h[cellId] < 20 ? undefined : pack.cells.state[cellId]));
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => Dialog.update(dialogId, { width: "fit-content", position })
  });

  ensureEl("statesSearch").addEventListener("input", onSearchInput);

  ensureEl("statesEditorRefresh").addEventListener("click", refreshStatesEditor);
  ensureEl("statesEditStyle").addEventListener("click", () => void Controllers.StyleEditor.open("states"));
  ensureEl("statesLegend").addEventListener("click", toggleLegend);
  ensureEl("statesPercentage").addEventListener("click", togglePercentageMode);
  ensureEl("statesChart").addEventListener("click", showStatesChart);
  ensureEl("statesRegenerate").addEventListener("click", openRegenerationMenu);
  ensureEl("statesRegenerateBack").addEventListener("click", exitRegenerationMenu);
  ensureEl("statesRecalculate").addEventListener("click", () => recalculateStates(true));
  ensureEl("statesRandomize").addEventListener("click", randomizeStatesExpansion);
  ensureEl("statesManually").addEventListener("click", openPaintEditor);
  ensureEl("statesAdd").addEventListener("click", enterAddStateMode);
  ensureEl("statesMerge").addEventListener("click", openStateMergeDialog);
  ensureEl("statesAnnex").addEventListener("click", statesAnnex.toggle);
  ensureEl("statesExport").addEventListener("click", downloadStatesCsv);
  ensureEl("statesImport").addEventListener("click", () => Csv.pick(uploadStatesCsv));

  ensureEl("statesBodySection").addEventListener("click", event => {
    const $element = (event as MouseEvent).target as HTMLElement;
    const classList = $element.classList;
    const row = $element.closest(".states") as HTMLElement | null;
    if (!row) return; // guards clicks originating in the generated header, which is now a sibling inside this container
    const stateId = Number(row.dataset.id);
    if ($element.tagName === "FILL-BOX") stateChangeFill($element as FillBoxElement);
    else if (classList.contains("name")) editStateName(stateId);
    else if (classList.contains("coaIcon"))
      void Controllers.EmblemsEditor.open("state", `stateCOA${stateId}`, pack.states[stateId]);
    else if (classList.contains("icon-star-empty")) stateCapitalZoomIn(stateId);
    else if (classList.contains("icon-dot-circled")) Controllers.BurgsOverview.open({ stateId });
    else if (classList.contains("statePopulation")) changePopulation(stateId);
    else if ($element.closest(".stateEconomy")) Controllers.StateEconomyOverview.open(stateId);
    else if ($element.closest(".stateStability")) Controllers.StabilityOverview.open(stateId);
    else if (classList.contains("icon-book")) void Controllers.NotesEditor.open({ type: "state", id: stateId });
    else if (classList.contains("icon-pin")) toggleFog(stateId, classList);
    else if (classList.contains("icon-target"))
      highlightElement(select("#regions").select(`#state${stateId}`).node() as Element, 4);
    else if (classList.contains("icon-trash-empty")) stateRemovePrompt(stateId);
    else if (classList.contains("icon-lock") || classList.contains("icon-lock-open"))
      updateLockStatus(stateId, classList);
  });

  ensureEl("statesBodySection").addEventListener("change", ev => {
    const $element = (ev as Event).target as HTMLInputElement;
    const classList = $element.classList;
    const line = $element.closest(".states") as HTMLElement | null;
    if (!line) return;
    const state = +line.dataset.id!;
    if (classList.contains("stateCulture")) stateChangeCulture(state, line, $element.value);
    else if (classList.contains("cultureType")) stateChangeType(state, line, $element.value);
    else if (classList.contains("statePower")) stateChangeExpansionism(state, line, $element.value);
    else if (classList.contains("stateTags")) stateChangeTags(state, line, $element);
  });
}

function onSearchInput(event: Event): void {
  filterState.search = (event.target as HTMLInputElement).value;
  dialogState.set(dialogId, "filters", filterState);
  statesTable.reset();
}

function stateChangeTags(stateId: number, line: HTMLElement, input: HTMLInputElement): void {
  const state = pack.states[stateId];
  if (!state) return;
  Tags.set(state, input.value);
  input.value = Tags.format(state.tags);
  line.dataset.tags = Tags.format(state.tags);
  if (filterState.search) statesTable.refresh();
}

function closeStatesEditor(): void {
  if (options.app.mode === "addState") exitAddStateMode();
  statesAnnex.exit();
  Controllers.ColorPicker.close();
  select("#debug").selectAll(".highlight").remove();
  const view = statesTable.view();
  view.rows = [];
  view.all = [];
}

function refreshStatesEditor(): void {
  States.collectStatistics();
  if (Dialog.isOpen(dialogId)) statesTable.refresh();
}

function renderStatesPage(view: TableView<State>): void {
  const unit = getAreaUnit();

  let totalArea = 0;
  let totalPopulation = 0;
  let totalBurgs = 0;
  for (const s of view.all) {
    totalArea += getArea(s.area || 0);
    const rural = (s.rural || 0) * options.map.units.population.scale;
    const urban = (s.urban || 0) * options.map.units.population.scale * options.map.units.population.urbanization.rate;
    totalPopulation += rn(rural + urban);
    totalBurgs += s.burgs || 0;
  }

  let lines = "";
  for (const s of view.rows) {
    const area = getArea(s.area || 0);
    const rural = (s.rural || 0) * options.map.units.population.scale;
    const urban = (s.urban || 0) * options.map.units.population.scale * options.map.units.population.urbanization.rate;
    const population = rn(rural + urban);
    const populationTip = sentences(
      `${t("Total population")}: ${si(population)}`,
      `${t("Rural population")}: ${si(rural)}`,
      `${t("Urban population")}: ${si(urban)}`,
      t("Click to edit")
    );
    const focused = select("#deftemp").select(`#fog #focusState${s.i}`).size();
    const treasuryTip = sentences(
      EconomyTerms.stateTreasury(),
      t("Sales tax: {{rate}}%", { rate: rn((s.economy.salesTax || 0) * 100, 1) }),
      t("Poll tax: {{rate}} a head", { rate: rn(s.economy.pollTax || 0, 2) }),
      t("Market license: {{fee}}", { fee: rn(s.economy.marketFee || 0, 2) }),
      t("Corruption: {{rate}}%", { rate: rn(Districts.getStateCorruption(s, s.economy.collected)) }),
      EconomyTerms.open()
    );
    const accounts = s.i ? StateEconomy.getAccounts(s.i) : null;
    const stability = Stability.get(s.i);
    const burden = taxBurden(s);
    const expenses = s.economy.budget;
    const neutrals = s.i ? null : StateEconomy.getAccounts(0);

    if (!s.i) {
      // Neutral line
      lines += /* html */ `<div
        class="states"
        data-id=${s.i}
        data-name="${s.name}"
        data-cells=${s.cells}
        data-area=${area}
        data-population=${population}
        data-burgs=${s.burgs}
        data-treasury="0"
        data-prosperity="${neutrals?.prosperity ?? ""}"
        data-product="${neutrals?.product ?? ""}"
        data-wealth="${neutrals?.wealth ?? ""}"
        data-color=""
        data-form=""
        data-capital=""
        data-culture=""
        data-type=""
        data-expansionism=""
        data-tags=""
      >
        <svg width="1em" height="1em" class="placeholder" data-col="color"></svg>
        <input data-tip="${sentences(t("Neutral lands name"), t("Click to change"))}" class="stateName name pointer italic" value="${
          s.name
        }" readonly data-col="name" />
        <svg class="coaIcon placeholder" viewBox="0 0 200 200" data-col="emblem"></svg>
        <input class="stateForm placeholder" value="none" data-col="form" />
        <div data-col="capital">
          <span class="icon-star-empty placeholder"></span>
          <div class="stateCapital placeholder"></div>
        </div>
        <select class="stateCulture placeholder" data-col="culture">${getCultureOptions(0)}</select>
        <div data-col="burgs">
          <span data-tip="${t("Click to overview neutral burgs")}" class="icon-dot-circled pointer" style="padding-right: 1px"></span>
          <div data-tip="${t("Number of burgs")}" class="stateBurgs">${s.burgs}</div>
        </div>
        <div data-col="cells">
          <span data-tip="${t("Number of cells")}" class="icon-check-empty"></span>
          <div data-tip="${t("Number of cells")}" class="stateCells">${s.cells}</div>
        </div>
        <div data-col="area">
          <span data-tip="${t("Neutral lands area")}" style="padding-right: 4px" class="icon-map-o"></span>
          <div data-tip="${t("Neutral lands area")}" class="stateArea">${si(area)} ${unit}</div>
        </div>
        <div data-col="population">
          <span data-tip="${populationTip}" class="icon-male"></span>
          <div data-tip="${populationTip}" class="statePopulation pointer">${si(population)}</div>
        </div>
        <div data-tip="${t("Neutrals collect no taxes")}" class="stateTreasury placeholder" data-col="treasury"></div>
        <div data-tip="${t("Neutrals collect no taxes")}" class="placeholder" data-col="burden"></div>
        <div data-tip="${t("Neutrals collect no taxes")}" class="placeholder" data-col="corruption"></div>
        ${EXPENSES.map(expense => `<div data-tip="${t("Neutrals collect no taxes")}" class="placeholder" data-col="${expense}"></div>`).join("")}
        ${
          s.cells || s.burgs
            ? /* html */ `<div data-tip="${sentences(EconomyTerms.prosperity(), EconomyTerms.open())}" class="stateEconomy stateProsperity pointer" data-col="prosperity">${neutrals?.prosperity == null ? "—" : renderProsperityPercent(neutrals.prosperity)}</div>
        <div data-tip="${t("Neutral lands have no government")}" class="placeholder" data-col="stability"></div>
        <div data-tip="${sentences(EconomyTerms.stateProduct(), EconomyTerms.open())}" class="stateEconomy stateProduct pointer" data-col="product">🟡 ${si(neutrals?.product ?? 0)}</div>
        <div data-tip="${sentences(EconomyTerms.wealth(), EconomyTerms.open())}" class="stateEconomy stateWealth pointer" data-col="wealth">🟡 ${rn(neutrals?.wealth ?? 0, 2)}</div>`
            : `<div class="stateProsperity placeholder" data-col="prosperity"></div>
        <div class="placeholder" data-col="stability"></div>
        <div class="stateProduct placeholder" data-col="product"></div>
        <div class="stateWealth placeholder" data-col="wealth"></div>`
        }
        <select class="cultureType placeholder" data-col="type">${getTypeOptions(0)}</select>
        <div data-col="expansionism">
          <span class="icon-resize-full placeholder"></span>
          <input class="statePower placeholder" type="number" value="0" />
        </div>
        <div data-col="tags" class="placeholder"></div>
        <div data-col="note"></div>
        <div data-col="locate"></div>
        <div data-col="focus"></div>
        <div data-col="lock"></div>
        <div data-col="remove"></div>
      </div>`;
      continue;
    }

    const capital = pack.burgs[s.capital].name;
    EmblemRenderer.trigger(`stateCOA${s.i}`, s.coa);
    lines += /* html */ `<div
      class="states"
      data-id=${s.i}
      data-name="${s.name}"
      data-form="${s.formName || ""}"
      data-capital="${capital}"
      data-color="${s.color}"
      data-cells=${s.cells}
      data-area=${area}
      data-population=${population}
      data-burgs=${s.burgs}
      data-treasury="${s.economy.treasury}"
      data-prosperity="${accounts?.prosperity ?? ""}"
      data-product="${accounts?.product ?? ""}"
      data-wealth="${accounts?.wealth ?? ""}"
      data-culture=${pack.cultures[s.culture].name}
      data-type=${s.type}
      data-expansionism=${s.expansionism}
      data-tags="${Tags.format(s.tags)}"
    >
      <fill-box fill="${s.color}" data-col="color"></fill-box>
      <input data-tip="${sentences(t("Name"), t("Click to change"))}" class="stateName name pointer" value="${s.name}" readonly data-col="name" />
      <svg data-tip="${t("Edit Emblem")}" class="coaIcon pointer" viewBox="0 0 200 200" data-col="emblem"><use href="#stateCOA${s.i}"></use></svg>
      <input data-tip="${sentences(t("Form name"), t("Click to change"))}" class="stateForm name pointer" value="${s.formName || ""}" readonly data-col="form" />
      <div data-col="capital">
        <span data-tip="${sentences(t("State capital"), t("Click to zoom"))}" class="icon-star-empty pointer"></span>
        <div data-tip="${t("Capital name")}" class="stateCapital">${capital}</div>
      </div>
      <select data-tip="${sentences(t("Dominant culture"), t("Click to change"))}" class="stateCulture" data-col="culture">${getCultureOptions(
        s.culture
      )}</select>
      <div data-col="burgs">
        <span data-tip="${t("Click to overview state burgs")}" style="padding-right: 1px" class="icon-dot-circled pointer"></span>
        <div data-tip="${t("Number of burgs")}" class="stateBurgs">${s.burgs}</div>
      </div>
      <div data-col="cells">
        <span data-tip="${t("Number of cells")}" class="icon-check-empty"></span>
        <div data-tip="${t("Number of cells")}" class="stateCells">${s.cells}</div>
      </div>
      <div data-col="area">
        <span data-tip="${t("State area")}" style="padding-right: 4px" class="icon-map-o"></span>
        <div data-tip="${t("State area")}" class="stateArea">${si(area)} ${unit}</div>
      </div>
      <div data-col="population">
        <span data-tip="${populationTip}" class="icon-male"></span>
        <div data-tip="${populationTip}" class="statePopulation pointer">${si(population)}</div>
      </div>
      <div data-tip="${treasuryTip}" class="stateTreasury stateEconomy pointer" data-col="treasury">🟡 ${si(s.economy.treasury)}</div>
      <div data-tip="${sentences(t("Tax burden: the taxes' share of the product"), EconomyTerms.open())}" class="stateEconomy pointer" data-col="burden">${burden === null ? "—" : `${rn(burden, 1)}%`}</div>
      <div data-tip="${sentences(EconomyTerms.corruption(), t("Before administration: {{rate}}%", { rate: s.economy.budget.corruption || 0 }), EconomyTerms.open())}" class="stateEconomy pointer" data-col="corruption">${rn(Districts.getStateCorruption(s, s.economy.collected))}%</div>
      ${EXPENSES.map(expense => `<div data-tip="${sentences(EconomyTerms.expenseTip(expense), EconomyTerms.open())}" class="stateEconomy pointer" data-col="${expense}">${expenses[expense]}%</div>`).join("")}
      <div data-tip="${accounts?.prosperity == null ? EconomyTerms.noData() : sentences(prosperityTip(accounts.prosperity), EconomyTerms.open())}" class="stateEconomy stateProsperity pointer" data-col="prosperity">${accounts?.prosperity == null ? "—" : renderProsperityPercent(accounts.prosperity)}</div>
      <div data-tip="${stability ? sentences(EconomyTerms.stability(), t("Click to open the stability overview")) : EconomyTerms.noData()}" class="stateStability pointer" data-col="stability">${stability ? `${rn(stability.stability * 100)}%` : "—"}</div>
      <div data-tip="${sentences(EconomyTerms.stateProduct(), EconomyTerms.open())}" class="stateEconomy stateProduct pointer" data-col="product">🟡 ${si(accounts?.product ?? 0)}</div>
      <div data-tip="${sentences(EconomyTerms.wealth(), EconomyTerms.open())}" class="stateEconomy stateWealth pointer" data-col="wealth">🟡 ${rn(accounts?.wealth ?? 0, 2)}</div>
      <select data-tip="${sentences(t("State type"), t("Defines growth model"), t("Click to change"))}" class="cultureType" data-col="type">${getTypeOptions(
        s.type
      )}</select>
      <div data-col="expansionism">
        <span data-tip="${t("State expansionism")}" class="icon-resize-full"></span>
        <input data-tip="${t("Expansionism (defines competitive size). Change to re-calculate states based on new value")}"
          class="statePower" type="number" min="0" max="99" step=".1" value=${s.expansionism} />
      </div>
      <div data-col="tags">
        <input data-tip="${sentences(t("State tags"), t("Comma-separated list of tags"))}" class="stateTags" placeholder="${t("none")}" value="${Tags.format(s.tags)}" />
      </div>
      ${noteIcon(t("Edit free text notes (legend)"))}
      <span data-col="locate" data-tip="${t("Locate on map")}" class="icon-target"></span>
      <span data-col="focus" data-tip="${t("Toggle state focus")}" class="icon-pin ${focused ? "" : " inactive"}"></span>
      <span data-col="lock" data-tip="${t("Lock")}" class="icon-lock${s.lock ? "" : "-open"}"></span>
      <span data-col="remove" data-tip="${t("Remove")}" class="icon-trash-empty"></span>
    </div>`;
  }
  const body = ensureEl("statesBodySection");
  body.querySelectorAll(":scope > .states").forEach(el => {
    el.remove();
  });
  body.insertAdjacentHTML("beforeend", lines);

  // update footer
  const totalStates = pack.states.filter(s => s.i && !s.removed).length;
  const shownStates = view.all.filter(s => s.i && !s.removed).length;
  ensureEl("statesFooterStates").innerHTML =
    shownStates === totalStates
      ? String(totalStates)
      : t("{{shown}} of {{total}}", { shown: shownStates, total: totalStates });
  ensureEl("statesFooterBurgs").innerHTML = String(totalBurgs);
  ensureEl("statesFooterArea").innerHTML = si(totalArea) + unit;
  ensureEl("statesFooterArea").dataset.area = String(totalArea);
  ensureEl("statesFooterPopulation").innerHTML = si(totalPopulation);
  ensureEl("statesFooterPopulation").dataset.population = String(totalPopulation);
  const shown = view.all.filter(s => s.i && !s.removed);
  const treasury = shown.reduce((sum, s) => sum + (s.economy.treasury || 0), 0);
  ensureEl("statesFooterTreasury").innerHTML = `🟡 ${si(shown.length ? treasury / shown.length : 0)}`;
  // by people, as a state's own prosperity is
  const lived = shown.flatMap(s => {
    const accounts = StateEconomy.getAccounts(s.i);
    return accounts?.prosperity == null ? [] : [{ people: accounts.people, prosperity: accounts.prosperity }];
  });
  const people = lived.reduce((sum, row) => sum + row.people, 0);
  ensureEl("statesFooterProsperity").innerHTML = people
    ? renderProsperityPercent(lived.reduce((sum, row) => sum + row.people * row.prosperity, 0) / people)
    : "—";

  renderEditorPagination(ensureEl("statesFooter"), view, statesTable.goto);

  // add listeners
  ensureEl("statesBodySection")
    .querySelectorAll(":scope > .states")
    .forEach($line => {
      $line.addEventListener("mouseenter", stateHighlightOn);
      $line.addEventListener("mouseleave", stateHighlightOff);
    });

  if (ensureEl("statesBodySection").dataset.type === "percentage") {
    ensureEl("statesBodySection").dataset.type = "absolute";
    togglePercentageMode();
  }
  Dialog.update(dialogId, { width: "fit-content", position });
}

function getCultureOptions(culture: number): string {
  let options = "";
  pack.cultures.forEach(c => {
    if (!c.removed) {
      options += `<option ${c.i === culture ? "selected" : ""} value="${c.i}">${c.name}</option>`;
    }
  });
  return options;
}

function getTypeOptions(type: string | number): string {
  let options = "";
  const types = ["Generic", "River", "Lake", "Naval", "Nomadic", "Hunting", "Highland"];
  types.forEach(t => {
    options += `<option ${type === t ? "selected" : ""} value="${t}">${CULTURE_TYPE_LABELS[t] ?? t}</option>`;
  });
  return options;
}

function stateHighlightOn(event: Event): void {
  if (!Layers.isOn("states")) return;
  if (select("#deftemp").select("#fog path").size()) return;

  const state = Number((event.target as HTMLElement).dataset.id);
  if (options.app.mode || !state) return;
  highlightOutline(select("#regions").select(`#state${state}`).attr("d"));
}

function stateHighlightOff(): void {
  select("#debug")
    .selectAll(".highlight")
    .each(function () {
      select(this).transition().duration(1000).attr("opacity", 0).remove();
    });
}

function stateChangeFill(fillBox: FillBoxElement): void {
  const currentFill = fillBox.getAttribute("fill") || "#ffffff";
  const state = +(fillBox.closest(".states") as HTMLElement).dataset.id!;

  const callback = (newFill: string) => {
    fillBox.fill = newFill;
    pack.states[state].color = newFill;
    Layers.draw("states");
    Layers.draw("military");
  };

  void Controllers.ColorPicker.open(currentFill, callback);
}

function editStateName(state: number): void {
  renderNameEditor();
  const stateNameEditorCustomForm = ensureEl<HTMLInputElement>("stateNameEditorCustomForm");
  const stateNameEditorSelectForm = ensureEl<HTMLSelectElement>("stateNameEditorSelectForm");

  // reset input value and close add mode
  stateNameEditorCustomForm.value = "";
  const addModeActive = stateNameEditorCustomForm.style.display === "inline-block";
  if (addModeActive) {
    stateNameEditorCustomForm.style.display = "none";
    stateNameEditorSelectForm.style.display = "inline-block";
  }

  const s = pack.states[state];
  ensureEl("stateNameEditor").dataset.state = String(state);
  ensureEl<HTMLInputElement>("stateNameEditorShort").value = s.name || "";
  applyOption(stateNameEditorSelectForm, s.formName || "");
  ensureEl<HTMLInputElement>("stateNameEditorFull").value = s.fullName || "";

  Dialog.open("stateNameEditor", {
    resizable: false,
    title: t("Change state name"),
    buttons: [
      {
        label: t("Apply"),
        onClick: () => {
          applyNameChange(s);
          Dialog.close("stateNameEditor");
        }
      },
      { label: t("Cancel"), onClick: () => Dialog.close("stateNameEditor") }
    ],
    position: { my: "center", at: "center", of: "svg" }
  });

  ensureEl("stateNameEditorShortCulture").addEventListener("click", regenerateShortNameCulture);
  ensureEl("stateNameEditorShortRandom").addEventListener("click", regenerateShortNameRandom);
  ensureEl("stateNameEditorShortSpeak").addEventListener("click", () =>
    speak(ensureEl<HTMLInputElement>("stateNameEditorShort").value)
  );
  ensureEl("stateNameEditorAddForm").addEventListener("click", addCustomForm);
  ensureEl("stateNameEditorCustomForm").addEventListener("change", addCustomForm);
  ensureEl("stateNameEditorFullRegenerate").addEventListener("click", regenerateFullName);
  ensureEl("stateNameEditorFullSpeak").addEventListener("click", () =>
    speak(ensureEl<HTMLInputElement>("stateNameEditorFull").value)
  );

  function regenerateShortNameCulture() {
    const state = +ensureEl("stateNameEditor").dataset.state!;
    const culture = pack.states[state].culture;
    const name = Names.getState(Names.getCultureShort(culture), culture);
    ensureEl<HTMLInputElement>("stateNameEditorShort").value = name;
  }

  function regenerateShortNameRandom() {
    const base = rand(Names.nameBases.length - 1);
    const name = Names.getState(Names.getBase(base), undefined as unknown as number, base);
    ensureEl<HTMLInputElement>("stateNameEditorShort").value = name;
  }

  function addCustomForm() {
    const value = stateNameEditorCustomForm.value;
    const addModeActive = stateNameEditorCustomForm.style.display === "inline-block";
    stateNameEditorCustomForm.style.display = addModeActive ? "none" : "inline-block";
    stateNameEditorSelectForm.style.display = addModeActive ? "inline-block" : "none";
    if (value && addModeActive) applyOption(stateNameEditorSelectForm, value);
    stateNameEditorCustomForm.value = "";
  }

  function regenerateFullName() {
    const short = ensureEl<HTMLInputElement>("stateNameEditorShort").value;
    const form = ensureEl<HTMLSelectElement>("stateNameEditorSelectForm").value;
    ensureEl<HTMLInputElement>("stateNameEditorFull").value = getFullName();

    function getFullName() {
      if (!form) return short;
      if (!short && form) return `The ${form}`;
      const $regen = ensureEl("stateNameEditorFullRegenerate");
      const tick = +$regen.dataset.tick!;
      $regen.dataset.tick = String(tick + 1);
      return tick % 2 ? `${getAdjective(short)} ${form}` : `${form} of ${short}`;
    }
  }

  function applyNameChange(s: State) {
    const name = ensureEl<HTMLInputElement>("stateNameEditorShort").value.trim();
    const formName = ensureEl<HTMLSelectElement>("stateNameEditorSelectForm").value;
    const fullName = ensureEl<HTMLInputElement>("stateNameEditorFull").value.trim();
    const oldFullName = s.fullName;
    const changed = name !== s.name || formName !== (s.formName ?? "") || fullName !== oldFullName;

    if (name && name !== s.name) States.rename(s.i, name);
    if (formName !== (s.formName ?? "")) States.setForm(s.i, formName);
    if (fullName && fullName !== oldFullName) States.setFullName(s.i, fullName);
    if (changed && ensureEl<HTMLInputElement>("stateNameEditorUpdateLabel").checked) {
      if (s.label?.text) delete s.label.text;
      Layers.draw("labels");
    }
    refreshStatesEditor();
  }
}

function renderNameEditor(): void {
  Dialog.destroy("stateNameEditor");
  const nameEditorHtml = /* html */ `<div id="stateNameEditor" class="dialog" data-state="0">
      <div>
        <div data-tip="${t("Short name")}" class="label">${t("Short name")}:</div>
        <input
          id="stateNameEditorShort"
          data-tip="${t("Type to change the short name")}"
          autocorrect="off"
          spellcheck="false"
          style="width: 11em"
        />
        <span id="stateNameEditorShortSpeak" data-tip="${sentences(t("Speak the name"), t("You can change voice and language in options"))}" class="speaker">🔊</span>
        <span
          id="stateNameEditorShortCulture"
          data-tip="${t("Generate culture-specific name")}"
          class="icon-book pointer"
        ></span>
        <span id="stateNameEditorShortRandom" data-tip="${t("Generate random name")}" class="icon-globe pointer"></span>
      </div>
      <div data-tip="${t("Select form name")}">
        <div data-tip="${t("Form name")}" class="label">${t("Form name")}:</div>
        <select id="stateNameEditorSelectForm" style="width: 11em">
          <option value="">${t("blank")}</option>
          ${Object.entries(STATE_FORMS)
            .map(
              ([form, names]) =>
                `<optgroup label="${form}">${names.map(name => `<option value="${name}">${name}</option>`).join("")}</optgroup>`
            )
            .join("")}
        </select>
        <input
          id="stateNameEditorCustomForm"
          placeholder="${t("Enter custom form name")}"
          data-tip="${t("Enter custom form name")}"
          style="display: none; width: 11em"
        />
        <span
          id="stateNameEditorAddForm"
          data-tip="${t("Click to add custom state form name to the list")}"
          class="icon-plus pointer"
        ></span>
      </div>
      <div>
        <div data-tip="${t("Full name")}" class="label">${t("Full name")}:</div>
        <input
          id="stateNameEditorFull"
          data-tip="${t("Type to change the full name")}"
          autocorrect="off"
          spellcheck="false"
          style="width: 11em"
        />
        <span id="stateNameEditorFullSpeak" data-tip="${sentences(t("Speak the name"), t("You can change voice and language in options"))}" class="speaker">🔊</span>
        <span
          id="stateNameEditorFullRegenerate"
          data-tip="${t("Click to re-generate full name")}"
          data-tick="0"
          class="icon-arrows-cw pointer"
        ></span>
      </div>
      <div data-tip="${t("Uncheck to not update state label on name change")}" style="padding-block: 0.2em">
        <input id="stateNameEditorUpdateLabel" class="checkbox" type="checkbox" checked />
        <label for="stateNameEditorUpdateLabel" class="checkbox-label"><i>${t("Update label on Apply")}</i></label>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", nameEditorHtml);
}

function changePopulation(stateId: number): void {
  const state = pack.states[stateId];
  if (!state.cells) {
    tip(t("No cells, cannot change population"), false, "error");
    return;
  }

  const rural = rn((state.rural || 0) * options.map.units.population.scale);
  const urban = rn(
    (state.urban || 0) * options.map.units.population.scale * options.map.units.population.urbanization.rate
  );
  const total = rural + urban;
  const format = (n: number) => Number(n).toLocaleString();

  Dialog.message({
    message: /* html */ `<div>
    <i>${t("Change population of all cells assigned to the state")}</i>
    <div style="margin: 0.5em 0">
      ${t("Rural")}: <input type="number" min="0" step="1" id="ruralPop" value=${rural} style="width:6em" />
      ${t("Urban")}: <input type="number" min="0" step="1" id="urbanPop" value=${urban} style="width:6em" />
    </div>
    <div>${t("Total population")}: ${format(total)} ⇒ <span id="totalPop">${format(total)}</span>
      (<span id="totalPopPerc">100</span>%)
    </div>
  </div>`,
    title: t("Change state population"),
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
      States.setPopulation(stateId, +ruralPop.value || 0, +urbanPop.value || 0);
    } catch (error) {
      tip(errorText(error), false, "error");
      return;
    }
    Layers.draw("population");
    refreshStatesEditor();
  }
}

function stateCapitalZoomIn(state: number): void {
  const capital = pack.states[state].capital;
  const { x, y } = pack.burgs[capital];
  zoomTo(x, y, 8, 2000);
}

function stateChangeCulture(state: number, line: HTMLElement, value: string): void {
  States.setCulture(state, +value);
  line.dataset.base = String(+value);
}

function stateChangeType(state: number, line: HTMLElement, value: string): void {
  States.setType(state, value);
  line.dataset.type = value;
  recalculateStates();
}

function stateChangeExpansionism(state: number, line: HTMLElement, value: string): void {
  const expansionism = Number(value);
  if (!(expansionism >= 0 && expansionism <= 99)) return;
  States.setExpansionism(state, expansionism);
  line.dataset.expansionism = value;
  recalculateStates();
}

function toggleFog(state: number, cl: DOMTokenList): void {
  if (options.app.mode) return;
  const path = select("#statesBody").select(`#state${state}`).attr("d");
  const id = `focusState${state}`;
  cl.contains("inactive") ? fog(id, path) : unfog(id);
  cl.toggle("inactive");
}

function stateRemovePrompt(state: number): void {
  if (options.app.mode) return;

  Dialog.confirm({
    title: t("Remove"),
    message: `${t("Are you sure you want to remove the state?")}<br>${t("This action cannot be reverted")}`,
    confirm: t("Remove"),
    onConfirm: () => stateRemove(state)
  });
}

function stateRemove(stateId: number): void {
  unfog(`focusState${stateId}`);
  removeEmblem("state", stateId);
  for (const province of pack.states[stateId].provinces || []) removeEmblem("province", province);
  States.remove(stateId);
  select("#debug").selectAll(".highlight").remove();

  Layers.draw("burgIcons", "labels", "military", "borders", "provinces", "states");
  refreshStatesEditor();
}

function toggleLegend(): void {
  const getItems = () =>
    pack.states
      .filter(s => s.i && !s.removed && s.cells)
      .sort((a, b) => (b.area ?? 0) - (a.area ?? 0))
      .map((s): LegendItem => [s.i, s.color ?? "", s.name]);
  LegendBoxes.toggle(LEGEND_NAME, getItems, t("No states to show"));
}

function togglePercentageMode(): void {
  if (ensureEl("statesBodySection").dataset.type === "absolute") {
    ensureEl("statesBodySection").dataset.type = "percentage";
    const totalBurgs = +ensureEl("statesFooterBurgs").textContent;
    const totalArea = +ensureEl("statesFooterArea").dataset.area!;
    const totalPopulation = +ensureEl("statesFooterPopulation").dataset.population!;
    const totalTreasury = pack.states.reduce((sum, s) => sum + (s.economy.treasury || 0), 0);
    const world = StateEconomy.getWorld();
    const totalCells = pack.states.reduce((sum, s) => sum + (s.i && !s.removed ? s.cells || 0 : 0), 0);

    ensureEl("statesBodySection")
      .querySelectorAll<HTMLElement>(":scope > .states")
      .forEach(el => {
        const { burgs, area, population, treasury, cells } = el.dataset;
        el.querySelector<HTMLElement>(".stateBurgs")!.textContent = `${rn((+burgs! / totalBurgs) * 100)}%`;
        el.querySelector<HTMLElement>(".stateCells")!.textContent = `${rn((+cells! / totalCells) * 100)}%`;
        el.querySelector<HTMLElement>(".stateArea")!.textContent = `${rn((+area! / totalArea) * 100)}%`;
        el.querySelector<HTMLElement>(".statePopulation")!.textContent =
          `${rn((+population! / totalPopulation) * 100)}%`;
        el.querySelector<HTMLElement>(".stateTreasury")!.textContent = `${rn((+treasury! / totalTreasury) * 100, 2)}%`;
        // product is a share of the world's; wealth and prosperity are against the world's average
        const { prosperity, product, wealth } = el.dataset;
        const share = (value: string | undefined, total: number | null | undefined) =>
          value && total ? `${rn((+value / total) * 100, 1)}%` : "—";
        const cell = (name: string) => el.querySelector<HTMLElement>(name);
        if (cell(".stateProduct")) cell(".stateProduct")!.textContent = share(product, world?.product);
        if (cell(".stateWealth")) cell(".stateWealth")!.textContent = share(wealth, world?.wealth);
        if (cell(".stateProsperity")) cell(".stateProsperity")!.textContent = share(prosperity, world?.prosperity);
      });
  } else {
    ensureEl("statesBodySection").dataset.type = "absolute";
    statesTable.refresh();
  }
}

function showStatesChart(): void {
  const statesData = pack.states.filter(s => !s.removed);
  if (statesData.length < 2) {
    tip(t("No states to show"), false, "error");
    return;
  }

  const root = stratify<State>()
    .id(d => String(d.i))
    .parentId(d => (d.i ? "0" : null))(statesData)
    .sum(d => d.area ?? 0)
    .sort((a, b) => b.value! - a.value!);

  const size = 150 + 200 * ensureEl<HTMLInputElement>("uiSize").valueAsNumber;
  const margin = { top: 0, right: -50, bottom: 0, left: -50 };
  const w = size - margin.left - margin.right;
  const h = size - margin.top - margin.bottom;
  const treeLayout = packLayout<State>().size([w, h]).padding(3);

  // prepare svg
  const chart = document.createElement("div");
  chart.innerHTML = /* html */ `<select id="statesTreeType" style="display:block; margin-left:13px; font-size:11px">
    <option value="area" selected>${t("Area")}</option>
    <option value="population">${t("Total population")}</option>
    <option value="rural">${t("Rural population")}</option>
    <option value="urban">${t("Urban population")}</option>
    <option value="burgs">${t("Number of burgs")}</option>
  </select><div id='statesInfo' class='chartInfo'>&#8205;</div>`;

  const svg = select(chart)
    .insert("svg", "#statesInfo")
    .attr("id", "statesTree")
    .attr("width", size)
    .attr("height", size)
    .style("font-family", "Almendra SC")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central");
  const graph = svg.append("g").attr("transform", `translate(-50, 0)`);
  chart.querySelector("#statesTreeType")!.addEventListener("change", updateChart);

  const node = graph
    .selectAll<SVGGElement, HierarchyCircularNode<State>>("g")
    .data(treeLayout(root).leaves())
    .enter()
    .append("g")
    .attr("transform", d => `translate(${d.x},${d.y})`)
    .attr("data-id", d => d.data.i)
    .on("mouseenter", (event: MouseEvent, d) => showInfo(event, d))
    .on("mouseleave", (event: MouseEvent) => hideInfo(event));

  node
    .append("circle")
    .attr("fill", d => d.data.color ?? null)
    .attr("r", d => d.r);

  const exp = /(?=[A-Z][^A-Z])/g;
  const lp = (n: string) => (max(n.split(exp).map(p => p.length)) ?? 0) + 1; // longest name part + 1

  node
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .style("font-size", d => `${rn((d.r ** 0.97 * 4) / lp(d.data.name), 2)}px`)
    .selectAll("tspan")
    .data(d => d.data.name.split(exp))
    .join("tspan")
    .attr("x", 0)
    .text(d => d)
    .attr("dy", (_d, i, n) => `${i ? 1 : (n.length - 1) / -2}em`);

  function showInfo(ev: MouseEvent, d: HierarchyCircularNode<State>) {
    select(ev.target as SVGGElement)
      .select("circle")
      .classed("selected", true);
    const state = d.data.fullName;

    const area = `${getArea(d.data.area!)} ${getAreaUnit()}`;
    const rural = rn(d.data.rural! * options.map.units.population.scale);
    const urban = rn(
      d.data.urban! * options.map.units.population.scale * options.map.units.population.urbanization.rate
    );

    const option = ensureEl<HTMLSelectElement>("statesTreeType").value;
    const value =
      option === "area"
        ? `${t("Area")}: ${area}`
        : option === "rural"
          ? `${t("Rural population")}: ${si(rural)}`
          : option === "urban"
            ? `${t("Urban population")}: ${si(urban)}`
            : option === "burgs"
              ? t("Burgs number: {{burgs}}", { burgs: d.data.burgs })
              : `${t("Population")}: ${si(rural + urban)}`;

    ensureEl("statesInfo").innerHTML = /* html */ `${state}. ${value}`;
    stateHighlightOn(ev);
  }

  function hideInfo(ev: MouseEvent) {
    stateHighlightOff();
    if (!findEl("statesInfo")) return;
    ensureEl("statesInfo").innerHTML = "&#8205;";
    select(ev.target as SVGGElement)
      .select("circle")
      .classed("selected", false);
  }

  function updateChart(this: HTMLSelectElement) {
    const value =
      this.value === "area"
        ? (d: State) => d.area ?? 0
        : this.value === "rural"
          ? (d: State) => d.rural ?? 0
          : this.value === "urban"
            ? (d: State) => d.urban ?? 0
            : this.value === "burgs"
              ? (d: State) => d.burgs ?? 0
              : (d: State) => (d.rural ?? 0) + (d.urban ?? 0);

    root.sum(value);
    node.data(treeLayout(root).leaves());

    node
      .transition()
      .duration(1500)
      .attr("transform", d => `translate(${d.x},${d.y})`);
    node
      .select("circle")
      .transition()
      .duration(1500)
      .attr("r", d => d.r);
    node
      .select("text")
      .transition()
      .duration(1500)
      .style("font-size", d => `${rn((d.r ** 0.97 * 4) / lp(d.data.name), 2)}px`);
  }

  Dialog.message({
    message: chart,
    title: t("States bubble chart"),
    width: "fit-content",
    position: { my: "left bottom", at: "left+10 bottom-10", of: "svg" },
    buttons: []
  });
}

function openRegenerationMenu(): void {
  ensureEl("statesBottom")
    .querySelectorAll<HTMLElement>(":scope > button")
    .forEach(el => {
      el.style.display = "none";
    });
  ensureEl("statesRegenerateButtons").style.display = "block";
}

function recalculateStates(must?: boolean): void {
  if (!must && !ensureEl<HTMLInputElement>("statesAutoChange").checked) return;

  // opt-in regeneration ("auto-apply changes"), so it takes the current request for the province
  // ratio rather than a fact of the map. See docs/architecture/configuration.md#the-test
  States.recalculate();

  Layers.draw("states", "borders", "provinces", "goods", "emblems");
  if (ensureEl<HTMLInputElement>("adjustLabels").checked) {
    for (const state of pack.states) if (state.label) state.label.pathPoints = undefined;
    Layers.draw("labels");
  }

  refreshStatesEditor();
}

function randomizeStatesExpansion(): void {
  pack.states.forEach(s => {
    if (!s.i || s.removed) return;
    const expansionism = rn(Math.random() * 4 + 1, 1);
    s.expansionism = expansionism;
    (
      ensureEl("statesBodySection").querySelector(`div.states[data-id='${s.i}'] input.statePower`) as HTMLInputElement
    ).value = String(expansionism);
  });
  recalculateStates(true);
}

function exitRegenerationMenu(): void {
  ensureEl("statesBottom")
    .querySelectorAll<HTMLElement>(":scope > button")
    .forEach(el => {
      el.style.display = "inline-block";
    });
  ensureEl("statesRegenerateButtons").style.display = "none";
}

function openPaintEditor(): void {
  Layers.show("states");
  const adjustLabels = ensureEl<HTMLInputElement>("adjustLabels").checked;

  void Controllers.PaintEditor.open({
    title: t("Paint States"),
    parentDialogId: dialogId,
    onClose: open,
    items: pack.states
      .filter(state => !state.removed)
      .map(state => ({ id: state.i, name: state.name, color: state.color || "#ffffff", lock: Boolean(state.lock) })),
    dontOverrideControl: true,
    getValue: cell => pack.cells.state[cell],
    filterCell: (cell, currentState) => isLand(cell, pack) && cell !== pack.states[currentState].center,
    onApply: changes => applyStatesPaint(changes, adjustLabels)
  });
}

function applyStatesPaint(changes: ReadonlyMap<number, number>, adjustLabels: boolean): void {
  if (!changes.size) return;
  const affectedStates = new Set<number>();
  for (const [stateId, cells] of groupByValue(changes)) {
    for (const cell of cells) affectedStates.add(pack.cells.state[cell]).add(stateId);
    States.setCells(stateId, cells);
  }

  Layers.draw("states", "borders", "provinces", "emblems");
  if (adjustLabels) {
    for (const stateId of affectedStates) delete pack.states[stateId].label;
    Layers.draw("labels");
  }
  if (findEl(dialogId)) refreshStatesEditor();
}

function enterAddStateMode(this: HTMLElement): void {
  if (this.classList.contains("pressed")) {
    exitAddStateMode();
    return;
  }
  options.app.mode = "addState";
  this.classList.add("pressed");
  tip(t("Click on the map to create a new capital or promote an existing burg"), true);
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addState);
  ensureEl("statesBodySection")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.pointerEvents = "none";
    });
}

function addState(this: SVGElement, event: MouseEvent): void {
  const [x, y] = getPointer(event, this);
  const hadBurg = pack.cells.burg[Pack.findCell(x, y)!];
  let stateId: number;
  try {
    stateId = States.add(x, y);
  } catch (error) {
    tip(errorText(error), false, "error");
    return;
  }
  if (event.shiftKey === false) exitAddStateMode();

  if (!hadBurg) redrawEmblem("burg", pack.states[stateId].capital);
  redrawEmblem("state", stateId);
  Layers.hide("provinces");
  Layers.draw("burgIcons", "labels", "routes", "states", "borders");
  statesTable.refresh();
}

function exitAddStateMode(): void {
  options.app.mode = null;
  applyDefaultViewboxEvents();
  clearMainTip();
  ensureEl("statesBodySection")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.removeProperty("pointer-events");
    });
  const statesAdd = ensureEl("statesAdd");
  if (statesAdd.classList.contains("pressed")) statesAdd.classList.remove("pressed");
}

const stateEmblem = (i: number) =>
  /* html */ `<svg class="coaIcon" viewBox="0 0 200 200"><use href="#stateCOA${i}"></use></svg>`;

function openStateMergeDialog(): void {
  const validStates = pack.states.filter(s => s.i && !s.removed);

  const statesSelector = validStates
    .map(
      s => /* html */ `
      <div data-id="${s.i}" style="cursor:default">
        <input type="radio" name="rulingState" value="${s.i}" />
        <input id="selectState${s.i}" class="checkbox" type="checkbox" name="statesToMerge" value="${s.i}" />
        <label for="selectState${s.i}" class="checkbox-label"><fill-box fill="${s.color}" disabled></fill-box>${stateEmblem(s.i)}${s.fullName}</label>
      </div>
    `
    )
    .join("");

  Dialog.message({
    id: "mergeStates",
    message: /* html */ `
    <form id='mergeStatesForm' style="overflow: hidden; display: flex; flex-direction: column; gap: 1em;">
      <p style="margin:0">
        ${t("Check the checkbox next to each state you want to merge. Use the radio button to pick the ruling state that will absorb all others (its name, color, and capital will be kept). Hover over a row to highlight the state on the map.")}
      </p>
      <main style='display: grid; grid-template-columns: 1fr 1fr; gap: .3em;'>
        ${statesSelector}
      </main>
    </form>
  `,
    width: 600,
    title: t("Merge states"),
    onClose: stateHighlightOff,
    buttons: [
      {
        label: t("Merge"),
        onClick: () => {
          const formData = new FormData(ensureEl<HTMLFormElement>("mergeStatesForm"));

          const rulingStateId = Number(formData.get("rulingState"));
          if (!rulingStateId) {
            tip(t("Please select a state to merge into"), false, "error");
            return false;
          }

          const statesToMerge = formData
            .getAll("statesToMerge")
            .map(Number)
            .filter(stateId => stateId !== rulingStateId);
          if (!statesToMerge.length) {
            tip(t("Please select several states to merge"), false, "error");
            return false;
          }

          confirmStatesMerge(statesToMerge, rulingStateId, () => Dialog.close("mergeStates"));
          return false; // stays open until the merge is confirmed
        }
      },
      { label: t("Cancel") }
    ]
  });

  ensureEl("mergeStatesForm")
    .querySelectorAll("div[data-id]")
    .forEach(el => {
      el.addEventListener("mouseenter", highlightStateOnMergeHover);
      el.addEventListener("mouseleave", stateHighlightOff);
    });
  applyLineHighlighting("mergeStates", ({ cellId }) => pack.cells.state[cellId]);

  function highlightStateOnMergeHover(event: Event) {
    if (!Layers.isOn("states")) return;
    const state = Number((event.currentTarget as HTMLElement).dataset.id);
    if (!state) return;
    const d = select("#regions").select(`#state${state}`).attr("d");
    if (!d) return;

    stateHighlightOff();
    highlightOutline(d);
  }
}

function confirmStatesMerge(statesToMerge: number[], rulingStateId: number, onConfirm?: () => void): void {
  const rulingState = pack.states[rulingStateId];
  const ruler = `${stateEmblem(rulingState.i)}${rulingState.name}`;
  Dialog.confirm({
    title: t("Merge states"),
    // prettier-ignore
    message: /* html */ `
      <p>${t("The following states will be removed")}: ${statesToMerge.map(stateId => `${stateEmblem(stateId)}${(pack.states)[stateId].name}`).join(", ")}.</p>
      <p>${t("Removed states data (burgs, provinces, regiments) will be assigned to {{- ruler}}.", { ruler })}</p>
      <label style="display: flex; align-items: center"><input id="mergeStatesAsProvinces" class="checkbox native" type="checkbox"> ${t("Keep each removed state as a province of {{- ruler}}, replacing its own provinces", { ruler })}</label>
      <p>${sentences(t("Are you sure you want to merge states?"), t("This action cannot be reverted"))}</p>`,
    confirm: t("Merge"),
    onConfirm: () => {
      mergeStates(statesToMerge, rulingStateId, ensureEl<HTMLInputElement>("mergeStatesAsProvinces").checked);
      onConfirm?.();
    }
  });
}

const statesAnnex = createAnnexMode({
  buttonId: "statesAnnex",
  bodySectionId: "statesBodySection",
  tips: {
    start: sentences(t("Click the state that annexes, then the states it absorbs"), t("Hold Shift to keep annexing")),
    pickLand: t("Click on a land cell to pick a state"),
    nothingHere: t("There is no state here"),
    annexing: name =>
      sentences(
        t("Annexing into {{state}}", { state: name }),
        t("Click the states to annex"),
        t("Hold Shift to keep annexing")
      ),
    isParent: name => t("{{state}} is the annexing state", { state: name })
  },
  ownerOf: cellId => pack.cells.state[cellId],
  colorOf: stateId => pack.states[stateId].color ?? "#999999",
  nameOf: stateId => pack.states[stateId].name,
  commit: (rulingStateId, statesToMerge) => confirmStatesMerge(statesToMerge, rulingStateId)
});

function mergeStates(statesToMerge: number[], rulingStateId: number, asProvinces = false): void {
  for (const stateId of statesToMerge) removeEmblem("state", stateId);
  States.merge(rulingStateId, statesToMerge, asProvinces);

  unfog();
  select("#debug").selectAll(".highlight").remove();
  Layers.draw("states", "borders", "burgIcons", "labels", "provinces", "military", "emblems");
  if (asProvinces) Layers.show("provinces");
  refreshStatesEditor();
}

function downloadStatesCsv(): void {
  const { scale, urbanization } = options.map.units.population;
  const headers = CSV_COLUMNS.map(column => (column === "Area" ? `Area ${getAreaUnit("2")}` : column));
  const rows = statesTable.view().all.map(s => {
    const rural = Math.round((s.rural || 0) * scale);
    const urban = Math.round((s.urban || 0) * scale * urbanization.rate);
    const neighbors = (s.neighbors || []).filter(n => n && !pack.states[n]?.removed);
    return [
      s.i,
      s.name,
      s.i ? s.fullName || "" : "",
      s.i ? s.formName || "" : "",
      s.i ? s.color || "" : "",
      s.i ? pack.burgs[s.capital].name || "" : "",
      s.i ? pack.cultures[s.culture].name : "",
      s.i ? s.type : "",
      s.i ? s.expansionism : "",
      s.cells || 0,
      s.burgs || 0,
      getArea(s.area || 0),
      rural + urban,
      rural,
      urban,
      s.i ? (s.provinces || []).filter(p => !pack.provinces[p]?.removed).length : "",
      s.i ? neighbors.map(n => pack.states[n].name).join(";") : "",
      s.i ? s.economy.salesTax || 0 : "",
      s.i ? s.economy.pollTax || 0 : "",
      s.i ? s.economy.marketFee || 0 : "",
      s.i ? adjustmentsToText(s.economy.adjustments) : "",
      ...EXPENSES.map(expense => (s.i ? s.economy.budget[expense] : "")),
      s.i ? s.economy.budget.corruption || 0 : "",
      s.i ? s.economy.treasury || 0 : "",
      s.i ? (s.tags || []).join(";") : ""
    ];
  });

  Csv.download("States", headers, rows);
}

/** Update existing states from a CSV in the export format; blank cells and derived columns are skipped */
async function uploadStatesCsv(text: string): Promise<void> {
  const { scale, urbanization } = options.map.units.population;
  const find = (id: number) => (pack.states[id]?.removed ? undefined : pack.states[id]);
  const updated = await Controllers.CsvUpload.update(
    text,
    CSV_COLUMNS,
    { find, units: ["Area"], text: ["State", "Full Name", "Form", "Tags"] },
    (id, row) => {
      const state = find(id)!;
      const fullName = state.fullName; // a new name or form rebuilds it, so an unchanged cell must not restore the old one
      row.apply("State", name => States.rename(id, name), state.name);
      if (id) {
        row.apply("Form", form => States.setForm(id, form), state.formName);
        row.apply("Full Name", name => States.setFullName(id, name), fullName);
        row.apply("Color", color => States.recolor(id, color), state.color); // recolor rejects hatched fills, so keep them when unchanged
        row.apply(
          "Capital",
          name => Burgs.setCapital(Csv.byName(pack.burgs, name, burg => burg.state === id).i),
          pack.burgs[state.capital]?.name
        );
        row.apply(
          "Culture",
          name => States.setCulture(id, Csv.byName(pack.cultures, name).i),
          pack.cultures[state.culture]?.name
        );
        row.apply("Type", type => States.setType(id, type), state.type);
        row.apply("Expansionism", value => States.setExpansionism(id, +value), state.expansionism);
        row.apply(
          "Sales Tax",
          value => States.setTaxes(id, +value, state.economy.pollTax || 0),
          state.economy.salesTax || 0
        );
        row.apply(
          "Poll Tax",
          value => States.setTaxes(id, state.economy.salesTax || 0, +value),
          state.economy.pollTax || 0
        );
        row.apply("Market License", value => States.setMarketFee(id, +value), state.economy.marketFee || 0);
        const expenses = state.economy.budget;

        const CSV_EXPENSES = {
          court: "Court",
          administration: "Administration",
          infrastructure: "Infrastructure",
          military: "Military"
        };
        for (const expense of EXPENSES) {
          row.apply(CSV_EXPENSES[expense], value => States.setBudget(id, { [expense]: +value }), expenses[expense]);
        }
        row.apply("Corruption", value => States.setCorruption(id, +value), state.economy.budget.corruption || 0);
        row.assign(
          "Adjustments",
          text => States.setAdjustments(id, adjustmentsFromText(text)),
          adjustmentsToText(state.economy.adjustments)
        );
        row.assign("Tags", tags => States.setTags(id, tags), (state.tags ?? []).join(";"));
      } else {
        for (const column of [
          "Full Name",
          "Form",
          "Color",
          "Capital",
          "Culture",
          "Type",
          "Expansionism",
          "Sales Tax",
          "Poll Tax",
          "Market License",
          "Adjustments",
          "Court",
          "Administration",
          "Infrastructure",
          "Military",
          "Corruption",
          "Tags"
        ])
          row.apply(column, () => {
            throw new Error(t("Neutral lands have no government"));
          });
      }
      row.population(
        [Math.round((state.rural || 0) * scale), Math.round((state.urban || 0) * scale * urbanization.rate)],
        (rural, urban) => States.setPopulation(id, rural, urban)
      );
    }
  );
  if (!updated) return;

  Layers.draw("states", "borders", "burgIcons", "labels", "provinces", "military", "emblems", "population");
  refreshStatesEditor();
}

function updateLockStatus(stateId: number, classList: DOMTokenList): void {
  States.setLocked(stateId, !pack.states[stateId].lock);

  classList.toggle("icon-lock-open");
  classList.toggle("icon-lock");
}

export const StatesEditor = { open, showChart: showStatesChart, refresh: refreshStatesEditor };
