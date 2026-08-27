import { interpolateString, max, pack as packLayout, select, stratify } from "d3";
import { closeDialogs, confirmationDialog, destroyDialog, updateDialog } from "@/components/dialog/dialog-helpers";
import { applyLineHighlighting } from "@/components/dialog/highlighting";
import { bindColumnSorting, sortDataByColumns } from "@/components/dialog/sorting";
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
import type { State } from "@/generators/states-generator";
import { redrawEmblem, redrawEmblems, removeEmblem } from "@/renderers/draw-emblems";
import { clearLegend, drawLegend } from "@/renderers/draw-legend";
import { EmblemRenderer } from "@/renderers/emblems/renderer";
import { fog, unfog } from "@/renderers/overlays/fogging";
import { highlightElement } from "@/renderers/overlays/highlight";
import { applyOption, downloadFile, getArea, getAreaUnit, getFileName, speak } from "@/utils";
import {
  ensureEl,
  formatPrice,
  getAdjective,
  getMixedColor,
  getPointer,
  getRandomColor,
  isLand,
  P,
  ra,
  rand,
  rn,
  si
} from "../utils";

const dialogId = "statesEditor" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
const columns: EditorColumn<State>[] = [
  { key: "color", width: "1.2em", permanent: true },
  {
    key: "name",
    label: "State",
    width: "7em",
    permanent: true,
    sortBy: s => s.name || "",
    sortType: "alpha"
  },
  { key: "emblem", width: "1.4em" },
  {
    key: "form",
    label: "Form",
    width: "8em",
    mobileHidden: true,
    sortBy: s => (s.i ? s.formName || "" : ""),
    sortType: "alpha"
  },
  {
    key: "capital",
    label: "Capital",
    width: "7em",
    sortBy: s => (s.i ? pack.burgs[s.capital]?.name || "" : ""),
    sortType: "alpha"
  },
  {
    key: "culture",
    label: "Culture",
    width: "10em",
    mobileHidden: true,
    sortBy: s => (s.i ? pack.cultures[s.culture]?.name || "" : ""),
    sortType: "alpha"
  },
  {
    key: "burgs",
    label: "Burgs",
    width: "5em",
    mobileHidden: true,
    sortBy: s => s.burgs || 0
  },
  {
    key: "cells",
    label: "Cells",
    width: "5em",
    hidden: true,
    mobileHidden: true,
    sortBy: s => s.cells || 0
  },
  {
    key: "area",
    label: "Area",
    width: "7em",
    mobileHidden: true,
    defaultSort: "desc",
    sortBy: s => getArea(s.area || 0)
  },
  {
    key: "population",
    label: "Population",
    width: "6em",
    sortBy: s => rn((s.rural || 0) * populationRate + (s.urban || 0) * populationRate * urbanization)
  },
  {
    key: "treasury",
    label: "Treasury",
    width: "6em",
    mobileHidden: true,
    tip: "Click to sort by state treasury. Click on a value to view and edit taxes",
    sortBy: s => s.treasury || 0
  },
  {
    key: "type",
    label: "Type",
    width: "5em",
    hidden: true,
    sortBy: s => (s.i ? s.type || "" : ""),
    sortType: "alpha"
  },
  {
    key: "expansionism",
    label: "Expansion",
    width: "5em",
    hidden: true,
    sortBy: s => (s.i ? s.expansionism || 0 : 0)
  },
  { key: "actions", width: "4.2em", permanent: true, align: "right" }
];

const statesTable = initEditorTable<State>({
  getData: () =>
    sortDataByColumns(
      dialogId,
      pack.states.filter(s => !s.removed),
      columns
    ),
  onUpdate: renderStatesPage
});

function open(): void {
  if (customization) return;

  closeDialogs(`#${dialogId}, .stable`);
  Layers.show("states", "borders");
  Layers.hide("cultures", "biomes", "religions");

  renderDialog();
  States.collectStatistics();
  statesTable.reset();

  $(`#${dialogId}`).dialog({
    title: "States Editor",
    resizable: false,
    width: "fit-content",
    position,
    close: closeStatesEditor
  });
}

function renderDialog(): void {
  destroyDialog(dialogId);
  const editorHtml = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
    <div id="statesBodySection" class="table" data-type="absolute">
      ${renderEditorHeader({ dialogId, columns })}
    </div>

    <div id="statesFooter" class="totalLine">
      <div data-tip="States number" style="margin-left: 5px">States:&nbsp;<span id="statesFooterStates">0</span></div>
      <div data-tip="Total burgs number" style="margin-left: 12px" data-col="burgs">Burgs:&nbsp;<span id="statesFooterBurgs">0</span></div>
      <div data-tip="Total land area" style="margin-left: 12px" data-col="area">Land Area:&nbsp;<span id="statesFooterArea">0</span></div>
      <div data-tip="Total population" style="margin-left: 12px" data-col="population">Population:&nbsp;<span id="statesFooterPopulation">0</span></div>
    </div>

    <div id="statesBottom" class="editorToolbar">
      <button id="statesEditorRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
      <button id="statesEditStyle" data-tip="Edit states style in Style Editor" class="icon-adjust"></button>
      <button id="statesLegend" data-tip="Toggle Legend box" class="icon-list-bullet"></button>
      <button id="statesPercentage" data-tip="Toggle percentage / absolute values views" class="icon-percent"></button>
      <button id="statesChart" data-tip="Show states bubble chart" class="icon-chart-area"></button>

      <button id="statesRegenerate" data-tip="Show the regeneration menu and more data" class="icon-cog-alt"></button>
      <div id="statesRegenerateButtons" style="display: none">
        <button id="statesRegenerateBack" data-tip="Hide the regeneration menu" class="icon-cog-alt"></button>
        <button id="statesRandomize" data-tip="Randomize states Expansion value and re-calculate states and provinces" class="icon-shuffle"></button>
        <div data-tip="Additional growth rate. Defines how many land cells remain neutral" style="display: inline-block">
          <slider-input id="statesGrowthRate" min=".1" max="3" step=".05" value="1">Growth rate:</slider-input>
        </div>
        <button id="statesRecalculate" data-tip="Recalculate states based on current values of growth-related attributes" class="icon-retweet"></button>
        <div data-tip="Allow states neutral distance, expansion and type changes to take an immediate effect" style="display: inline-block">
          <input id="statesAutoChange" class="checkbox" type="checkbox" />
          <label for="statesAutoChange" class="checkbox-label"><i>auto-apply changes</i></label>
        </div>
        <div data-tip="Allow system to change state labels when states data is change" style="display: inline-block">
          <input id="adjustLabels" class="checkbox" type="checkbox" />
          <label for="adjustLabels" class="checkbox-label"><i>auto-change labels</i></label>
        </div>
      </div>

      <button id="statesManually" data-tip="Manually re-assign states" class="icon-brush"></button>

      <button id="statesAdd" data-tip="Add a new state. Hold Shift to add multiple" class="icon-plus"></button>
      <button id="statesMerge" data-tip="Merge several states into one" class="icon-layer-group"></button>
      <button id="statesExport" data-tip="Save state-related data as a text file (.csv)" class="icon-download"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);

  bindColumnSorting(dialogId, statesTable.reset);
  applyLineHighlighting(dialogId, ({ cellId }) => (pack.cells.h[cellId] < 20 ? undefined : pack.cells.state[cellId]));
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });

  ensureEl("statesEditorRefresh").addEventListener("click", refreshStatesEditor);
  ensureEl("statesEditStyle").addEventListener("click", () => editStyle("regions"));
  ensureEl("statesLegend").addEventListener("click", toggleLegend);
  ensureEl("statesPercentage").addEventListener("click", togglePercentageMode);
  ensureEl("statesChart").addEventListener("click", showStatesChart);
  ensureEl("statesRegenerate").addEventListener("click", openRegenerationMenu);
  ensureEl("statesRegenerateBack").addEventListener("click", exitRegenerationMenu);
  ensureEl("statesRecalculate").addEventListener("click", () => recalculateStates(true));
  ensureEl("statesRandomize").addEventListener("click", randomizeStatesExpansion);
  ensureEl("statesGrowthRate").addEventListener("input", () => recalculateStates(false));
  ensureEl("statesManually").addEventListener("click", openPaintEditor);
  ensureEl("statesAdd").addEventListener("click", enterAddStateMode);
  ensureEl("statesMerge").addEventListener("click", openStateMergeDialog);
  ensureEl("statesExport").addEventListener("click", downloadStatesCsv);

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
    else if (classList.contains("stateTreasury")) openTreasuryDialog(stateId);
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
  });
}

function closeStatesEditor(): void {
  if (customization === 3) exitAddStateMode();
  select("#debug").selectAll(".highlight").remove();
  destroyDialog(dialogId);
}

function refreshStatesEditor(): void {
  States.collectStatistics();
  statesTable.refresh();
}

function renderStatesPage(view: TableView<State>): void {
  const unit = getAreaUnit();

  let totalArea = 0;
  let totalPopulation = 0;
  let totalBurgs = 0;
  for (const s of view.all) {
    totalArea += getArea(s.area || 0);
    const rural = (s.rural || 0) * populationRate;
    const urban = (s.urban || 0) * populationRate * urbanization;
    totalPopulation += rn(rural + urban);
    totalBurgs += s.burgs || 0;
  }

  let lines = "";
  for (const s of view.rows) {
    const area = getArea(s.area || 0);
    const rural = (s.rural || 0) * populationRate;
    const urban = (s.urban || 0) * populationRate * urbanization;
    const population = rn(rural + urban);
    const populationTip = `Total population: ${si(population)}; Rural population: ${si(rural)}; Urban population: ${si(
      urban
    )}. Click to change`;
    const focused = select("#deftemp").select(`#fog #focusState${s.i}`).size();
    const treasuryTip = `Current treasury: 🟡 ${si(s.treasury)}. Sales Tax: ${rn((s.salesTax || 0) * 100, 1)}%. Poll Tax: ${rn((s.pollTax || 0) * 100, 1)}%. Click to view and edit taxes`;

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
        data-color=""
        data-form=""
        data-capital=""
        data-culture=""
        data-type=""
        data-expansionism=""
      >
        <svg width="1em" height="1em" class="placeholder" data-col="color"></svg>
        <input data-tip="Neutral lands name. Click to change" class="stateName name pointer italic" value="${
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
          <span data-tip="Click to overview neutral burgs" class="icon-dot-circled pointer" style="padding-right: 1px"></span>
          <div data-tip="Burgs count" class="stateBurgs">${s.burgs}</div>
        </div>
        <div data-col="cells">
          <span data-tip="Cells count" class="icon-check-empty"></span>
          <div data-tip="Cells count" class="stateCells">${s.cells}</div>
        </div>
        <div data-col="area">
          <span data-tip="Neutral lands area" style="padding-right: 4px" class="icon-map-o"></span>
          <div data-tip="Neutral lands area" class="stateArea">${si(area)} ${unit}</div>
        </div>
        <div data-col="population">
          <span data-tip="${populationTip}" class="icon-male"></span>
          <div data-tip="${populationTip}" class="statePopulation pointer">${si(population)}</div>
        </div>
        <div data-tip="Neutrals collect no taxes" class="stateTreasury placeholder" data-col="treasury"></div>
        <select class="cultureType placeholder" data-col="type">${getTypeOptions(0)}</select>
        <div data-col="expansionism">
          <span class="icon-resize-full placeholder"></span>
          <input class="statePower placeholder" type="number" value="0" />
        </div>
        <div data-col="actions"></div>
      </div>`;
      continue;
    }

    const capital = pack.burgs[s.capital].name;
    EmblemRenderer.trigger(`stateCOA${s.i}`, s.coa);
    lines += /* html */ `<div
      class="states"
      data-id=${s.i}
      data-name="${s.name}"
      data-form="${s.formName}"
      data-capital="${capital}"
      data-color="${s.color}"
      data-cells=${s.cells}
      data-area=${area}
      data-population=${population}
      data-burgs=${s.burgs}
      data-treasury="${s.treasury}"
      data-culture=${pack.cultures[s.culture].name}
      data-type=${s.type}
      data-expansionism=${s.expansionism}
    >
      <fill-box fill="${s.color}" data-col="color"></fill-box>
      <input data-tip="State name. Click to change" class="stateName name pointer" value="${s.name}" readonly data-col="name" />
      <svg data-tip="Click to show and edit state emblem" class="coaIcon pointer" viewBox="0 0 200 200" data-col="emblem"><use href="#stateCOA${s.i}"></use></svg>
      <input data-tip="State form name. Click to change" class="stateForm name pointer" value="${
        s.formName
      }" readonly data-col="form" />
      <div data-col="capital">
        <span data-tip="State capital. Click to zoom into view" class="icon-star-empty pointer"></span>
        <div data-tip="Capital name" class="stateCapital">${capital}</div>
      </div>
      <select data-tip="Dominant culture. Click to change" class="stateCulture" data-col="culture">${getCultureOptions(
        s.culture
      )}</select>
      <div data-col="burgs">
        <span data-tip="Click to overview state burgs" style="padding-right: 1px" class="icon-dot-circled pointer"></span>
        <div data-tip="Burgs count" class="stateBurgs">${s.burgs}</div>
      </div>
      <div data-col="cells">
        <span data-tip="Cells count" class="icon-check-empty"></span>
        <div data-tip="Cells count" class="stateCells">${s.cells}</div>
      </div>
      <div data-col="area">
        <span data-tip="State area" style="padding-right: 4px" class="icon-map-o"></span>
        <div data-tip="State area" class="stateArea">${si(area)} ${unit}</div>
      </div>
      <div data-col="population">
        <span data-tip="${populationTip}" class="icon-male"></span>
        <div data-tip="${populationTip}" class="statePopulation pointer">${si(population)}</div>
      </div>
      <div data-tip="${treasuryTip}" class="stateTreasury pointer" data-col="treasury">🟡 ${si(s.treasury)}</div>
      <select data-tip="State type. Defines growth model. Click to change" class="cultureType" data-col="type">${getTypeOptions(
        s.type
      )}</select>
      <div data-col="expansionism">
        <span data-tip="State expansionism" class="icon-resize-full"></span>
        <input data-tip="Expansionism (defines competitive size). Change to re-calculate states based on new value"
          class="statePower" type="number" min="0" max="99" step=".1" value=${s.expansionism} />
      </div>
      <div data-col="actions">
        <span data-tip="Locate the state" class="icon-target"></span>
        <span data-tip="Toggle state focus" class="icon-pin ${focused ? "" : " inactive"}"></span>
        <span data-tip="Lock the state to protect it from re-generation" class="icon-lock${
          s.lock ? "" : "-open"
        }"></span>
        <span data-tip="Remove the state" class="icon-trash-empty"></span>
      </div>
    </div>`;
  }
  const body = ensureEl("statesBodySection");
  body.querySelectorAll(":scope > .states").forEach(el => {
    el.remove();
  });
  body.insertAdjacentHTML("beforeend", lines);

  // update footer
  ensureEl("statesFooterStates").innerHTML = String(pack.states.filter(s => s.i && !s.removed).length);
  ensureEl("statesFooterBurgs").innerHTML = String(totalBurgs);
  ensureEl("statesFooterArea").innerHTML = si(totalArea) + unit;
  ensureEl("statesFooterArea").dataset.area = String(totalArea);
  ensureEl("statesFooterPopulation").innerHTML = si(totalPopulation);
  ensureEl("statesFooterPopulation").dataset.population = String(totalPopulation);

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
  updateDialog(dialogId, { width: "fit-content", position });
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
    options += `<option ${type === t ? "selected" : ""} value="${t}">${t}</option>`;
  });
  return options;
}

function stateHighlightOn(event: any): void {
  if (!Layers.isOn("states")) return;
  if (select("#deftemp").select("#fog path").size()) return;

  const state = +event.target.dataset.id;
  if (customization || !state) return;
  const d = select("#regions").select(`#state${state}`).attr("d");

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
  const interpolate = interpolateString(`0, ${totalLength}`, `${totalLength}, ${totalLength}`);
  path
    .transition()
    .duration(duration)
    .attrTween("stroke-dasharray", () => interpolate);
}

function stateHighlightOff(): void {
  select("#debug")
    .selectAll(".highlight")
    .each(function (this: any) {
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

  $("#stateNameEditor").dialog({
    resizable: false,
    title: "Change state name",
    buttons: {
      Apply: function (this: HTMLElement) {
        applyNameChange(s);
        $(this).dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    },
    position: { my: "center", at: "center", of: "svg" },
    close: closeStateNameEditor
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

  function applyNameChange(s: any) {
    const nameInput = ensureEl<HTMLInputElement>("stateNameEditorShort");
    const formSelect = ensureEl<HTMLSelectElement>("stateNameEditorSelectForm");
    const fullNameInput = ensureEl<HTMLInputElement>("stateNameEditorFull");

    const nameChanged = nameInput.value !== s.name;
    const formChanged = formSelect.value !== s.formName;
    const fullNameChanged = fullNameInput.value !== s.fullName;
    const changed = nameChanged || formChanged || fullNameChanged;

    if (formChanged) {
      const selected = formSelect.selectedOptions[0];
      const form = selected.parentElement?.getAttribute("label") || null;
      if (form) s.form = form;
    }

    s.name = nameInput.value;
    s.formName = formSelect.value;
    s.fullName = fullNameInput.value;
    if (changed && ensureEl<HTMLInputElement>("stateNameEditorUpdateLabel").checked) {
      if (s.label?.text) delete s.label.text;
      Layers.draw("labels");
    }
    refreshStatesEditor();
  }
}

function renderNameEditor(): void {
  destroyDialog("stateNameEditor");
  const nameEditorHtml = /* html */ `<div id="stateNameEditor" class="dialog" data-state="0">
      <div>
        <div data-tip="State short name" class="label">Short name:</div>
        <input
          id="stateNameEditorShort"
          data-tip="Type to change the short name"
          autocorrect="off"
          spellcheck="false"
          style="width: 11em"
        />
        <span id="stateNameEditorShortSpeak" data-tip="Speak the name. You can change voice and language in options" class="speaker">🔊</span>
        <span
          id="stateNameEditorShortCulture"
          data-tip="Generate culture-specific name"
          class="icon-book pointer"
        ></span>
        <span id="stateNameEditorShortRandom" data-tip="Generate random name" class="icon-globe pointer"></span>
      </div>
      <div data-tip="Select form name">
        <div data-tip="State form name" class="label">Form name:</div>
        <select id="stateNameEditorSelectForm" style="width: 11em">
          <option value="">blank</option>
          <optgroup label="Monarchy">
            <option value="Beylik">Beylik</option>
            <option value="Despotate">Despotate</option>
            <option value="Dominion">Dominion</option>
            <option value="Duchy">Duchy</option>
            <option value="Emirate">Emirate</option>
            <option value="Empire">Empire</option>
            <option value="Horde">Horde</option>
            <option value="Grand Duchy">Grand Duchy</option>
            <option value="Heptarchy">Heptarchy</option>
            <option value="Khaganate">Khaganate</option>
            <option value="Khanate">Khanate</option>
            <option value="Kingdom">Kingdom</option>
            <option value="Marches">Marches</option>
            <option value="Principality">Principality</option>
            <option value="Satrapy">Satrapy</option>
            <option value="Shogunate">Shogunate</option>
            <option value="Sultanate">Sultanate</option>
            <option value="Tsardom">Tsardom</option>
            <option value="Ulus">Ulus</option>
            <option value="Viceroyalty">Viceroyalty</option>
          </optgroup>
          <optgroup label="Republic">
            <option value="Chancellery">Chancellery</option>
            <option value="City-state">City-state</option>
            <option value="Diarchy">Diarchy</option>
            <option value="Federation">Federation</option>
            <option value="Free City">Free City</option>
            <option value="Most Serene Republic">Most Serene Republic</option>
            <option value="Oligarchy">Oligarchy</option>
            <option value="Protectorate">Protectorate</option>
            <option value="Republic">Republic</option>
            <option value="Tetrarchy">Tetrarchy</option>
            <option value="Trade Company">Trade Company</option>
            <option value="Triumvirate">Triumvirate</option>
          </optgroup>
          <optgroup label="Union">
            <option value="Confederacy">Confederacy</option>
            <option value="Confederation">Confederation</option>
            <option value="Conglomerate">Conglomerate</option>
            <option value="Commonwealth">Commonwealth</option>
            <option value="League">League</option>
            <option value="Union">Union</option>
            <option value="United Hordes">United Hordes</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="United Provinces">United Provinces</option>
            <option value="United Republic">United Republic</option>
            <option value="United States">United States</option>
            <option value="United Tribes">United Tribes</option>
          </optgroup>
          <optgroup label="Theocracy">
            <option value="Bishopric">Bishopric</option>
            <option value="Brotherhood">Brotherhood</option>
            <option value="Caliphate">Caliphate</option>
            <option value="Diocese">Diocese</option>
            <option value="Divine Duchy">Divine Duchy</option>
            <option value="Divine Grand Duchy">Divine Grand Duchy</option>
            <option value="Divine Principality">Divine Principality</option>
            <option value="Divine Kingdom">Divine Kingdom</option>
            <option value="Divine Empire">Divine Empire</option>
            <option value="Eparchy">Eparchy</option>
            <option value="Exarchate">Exarchate</option>
            <option value="Holy State">Holy State</option>
            <option value="Imamah">Imamah</option>
            <option value="Patriarchate">Patriarchate</option>
            <option value="Theocracy">Theocracy</option>
          </optgroup>
          <optgroup label="Anarchy">
            <option value="Commune">Commune</option>
            <option value="Community">Community</option>
            <option value="Council">Council</option>
            <option value="Free Territory">Free Territory</option>
            <option value="Tribes">Tribes</option>
          </optgroup>
        </select>
        <input
          id="stateNameEditorCustomForm"
          placeholder="type form name"
          data-tip="Enter custom form name"
          style="display: none; width: 11em"
        />
        <span
          id="stateNameEditorAddForm"
          data-tip="Click to add custom state form name to the list"
          class="icon-plus pointer"
        ></span>
      </div>
      <div>
        <div data-tip="State full name" class="label">Full name:</div>
        <input
          id="stateNameEditorFull"
          data-tip="Type to change the full name"
          autocorrect="off"
          spellcheck="false"
          style="width: 11em"
        />
        <span id="stateNameEditorFullSpeak" data-tip="Speak the name. You can change voice and language in options" class="speaker">🔊</span>
        <span
          id="stateNameEditorFullRegenerate"
          data-tip="Click to re-generate full name"
          data-tick="0"
          class="icon-arrows-cw pointer"
        ></span>
      </div>
      <div data-tip="Uncheck to not update state label on name change" style="padding-block: 0.2em">
        <input id="stateNameEditorUpdateLabel" class="checkbox" type="checkbox" checked />
        <label for="stateNameEditorUpdateLabel" class="checkbox-label"><i>Update label on Apply</i></label>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", nameEditorHtml);
}

function closeStateNameEditor(): void {
  $("#stateNameEditor").dialog("destroy");
  ensureEl("stateNameEditor").remove();
}

function changePopulation(stateId: number): void {
  const state = pack.states[stateId];
  if (!state.cells) {
    tip("State does not have any cells, cannot change population", false, "error");
    return;
  }

  const rural = rn((state.rural || 0) * populationRate);
  const urban = rn((state.urban || 0) * populationRate * urbanization);
  const total = rural + urban;
  const format = (n: number) => Number(n).toLocaleString();

  alertMessage.innerHTML = /* html */ `<div>
    <i>Change population of all cells assigned to the state</i>
    <div style="margin: 0.5em 0">
      Rural: <input type="number" min="0" step="1" id="ruralPop" value=${rural} style="width:6em" />
      Urban: <input type="number" min="0" step="1" id="urbanPop" value=${urban} style="width:6em" />
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
    title: "Change state population",
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
      const cells = (pack.cells.i as unknown as number[]).filter(i => pack.cells.state[i] === stateId);
      cells.forEach(i => {
        pack.cells.pop[i] *= ruralChange;
      });
    }
    if (!Number.isFinite(ruralChange) && +ruralPop.value > 0) {
      const points = +ruralPop.value / populationRate;
      const cells = (pack.cells.i as unknown as number[]).filter(i => pack.cells.state[i] === stateId);
      const pop = points / cells.length;
      cells.forEach(i => {
        pack.cells.pop[i] = pop;
      });
    }

    const urbanChange = +urbanPop.value / urban;
    if (Number.isFinite(urbanChange) && urbanChange !== 1) {
      const burgs = pack.burgs.filter(b => !b.removed && b.state === stateId);
      burgs.forEach(b => {
        b.population = rn((b.population || 0) * urbanChange, 4);
      });
    }
    if (!Number.isFinite(urbanChange) && +urbanPop.value > 0) {
      const points = +urbanPop.value / populationRate / urbanization;
      const burgs = pack.burgs.filter(b => !b.removed && b.state === stateId);
      const population = rn(points / burgs.length, 4);
      burgs.forEach(b => {
        b.population = population;
      });
    }

    Layers.draw("population");
    refreshStatesEditor();
  }
}

function openTreasuryDialog(stateId: number): void {
  const state = pack.states[stateId];
  if (!stateId || !state || state.removed) return;

  const pollTaxRevenue = rn(state.pollTax * ((state.rural || 0) + (state.urban || 0)), 2);
  const salesTaxRevenue = pack.deals.reduce((sum, deal) => {
    if (!deal.tax) return sum;
    let sellerStateId = 0;
    if (deal.sellerType === "burg") {
      sellerStateId = pack.burgs[deal.seller]?.state || 0;
    } else if (deal.sellerType === "market") {
      const market = Markets.get(deal.seller);
      const centerBurgId = market?.centerBurgId;
      sellerStateId = centerBurgId ? pack.burgs[centerBurgId]?.state || 0 : 0;
    }
    return sellerStateId === stateId ? sum + deal.tax : sum;
  }, 0);

  alertMessage.innerHTML = /* html */ `<div data-tip="Sales tax is applied to deals with a seller from the state. Poll tax is applied to all population of the state. Tax changes take effect on Production regeneration" style="margin: 0.6em 0; display: grid; grid-template-columns: 7em auto auto; row-gap: 0.4em; align-items: center">
      <label for="stateSalesTaxInput">Sales Tax:</label>
      <input id="stateSalesTaxInput" type="number" min="0" max="1" step="0.01" value="${state.salesTax}" style="width: 6em"/> = ${formatPrice(salesTaxRevenue)}
      <label for="statePollTaxInput">Poll Tax:</label>
      <input id="statePollTaxInput" type="number" min="0" max="10" step="0.01" value="${state.pollTax}" style="width: 6em"/> = ${formatPrice(pollTaxRevenue)}
      <label for="stateTreasuryInput">Treasury:</label>
      <input id="stateTreasuryInput" type="number" step="1" value="${state.treasury}" style="width: 6em" />
    </div>`;

  $("#alert").dialog({
    resizable: false,
    title: `Taxes and Treasury: ${state.name}`,
    width: "26em",
    buttons: {
      Apply: function (this: HTMLElement) {
        const salesInput = ensureEl<HTMLInputElement>("stateSalesTaxInput");
        const pollInput = ensureEl<HTMLInputElement>("statePollTaxInput");
        const treasuryInput = ensureEl<HTMLInputElement>("stateTreasuryInput");
        const newSales = Math.max(0, Math.min(1, +salesInput.value));
        const newPoll = Math.max(0, +pollInput.value);
        const newTreasury = +treasuryInput.value;
        if (Number.isFinite(newSales)) state.salesTax = rn(newSales, 4);
        if (Number.isFinite(newPoll)) state.pollTax = rn(newPoll, 4);
        if (Number.isFinite(newTreasury)) state.treasury = rn(newTreasury, 2);
        refreshStatesEditor();
        $(this).dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    },
    position: { my: "center", at: "center", of: "svg" }
  });
}

function stateCapitalZoomIn(state: number): void {
  const capital = pack.states[state].capital;
  const { x, y } = pack.burgs[capital];
  zoomTo(x, y, 8, 2000);
}

function stateChangeCulture(state: number, line: HTMLElement, value: string): void {
  pack.states[state].culture = +value;
  line.dataset.base = String(+value);
}

function stateChangeType(state: number, line: HTMLElement, value: string): void {
  pack.states[state].type = value;
  line.dataset.type = value;
  recalculateStates();
}

function stateChangeExpansionism(state: number, line: HTMLElement, value: string): void {
  pack.states[state].expansionism = Number(value);
  line.dataset.expansionism = value;
  recalculateStates();
}

function toggleFog(state: number, cl: DOMTokenList): void {
  if (customization) return;
  const path = select("#statesBody").select(`#state${state}`).attr("d");
  const id = `focusState${state}`;
  cl.contains("inactive") ? fog(id, path) : unfog(id);
  cl.toggle("inactive");
}

function stateRemovePrompt(state: number): void {
  if (customization) return;

  confirmationDialog({
    title: "Remove state",
    message: "Are you sure you want to remove the state? <br>This action cannot be reverted",
    confirm: "Remove",
    onConfirm: () => stateRemove(state)
  });
}

function stateRemove(stateId: number): void {
  select("#statesBody").select(`#state${stateId}`).remove();
  select("#statesBody").select(`#state-gap${stateId}`).remove();
  select("#statesHalo").select(`#state-border${stateId}`).remove();
  delete pack.states[stateId].label;

  unfog(`focusState${stateId}`);

  pack.burgs.forEach(burg => {
    if (burg.state === stateId) {
      burg.state = 0;
      if (burg.capital) {
        burg.capital = 0;
        Burgs.changeGroup(burg, null);
      }
    }
  });
  Layers.draw("burgIcons", "labels");

  pack.cells.state.forEach((s: number, i: number) => {
    if (s === stateId) pack.cells.state[i] = 0;
  });

  // remove emblem
  removeEmblem("state", stateId);

  // remove provinces
  (pack.states[stateId].provinces || []).forEach((p: number) => {
    pack.provinces[p] = { i: p, removed: true } as Province;
    pack.cells.province.forEach((pr: number, i: number) => {
      if (pr === p) pack.cells.province[i] = 0;
    });

    removeEmblem("province", p);
    const g = select("#provs").select("#provincesBody");
    g.select(`#province${p}`).remove();
    g.select(`#province-gap${p}`).remove();
  });

  // remove military
  (pack.states[stateId].military || []).forEach((m: any) => {
    const id = `regiment${stateId}-${m.i}`;
    const index = notes.findIndex(n => n.id === id);
    if (index !== -1) notes.splice(index, 1);
  });
  select(`#armies g#army${stateId}`).remove();

  // clean up neighbors references from other states
  pack.states.forEach(state => {
    if (!state.i || state.removed || !state.neighbors) return;
    state.neighbors = state.neighbors.filter((n: number) => n !== stateId);
  });

  pack.states[stateId] = { i: stateId, removed: true } as State;

  select("#debug").selectAll(".highlight").remove();

  Layers.draw("states", "borders", "provinces");

  refreshStatesEditor();
}

function toggleLegend(): void {
  if (select("#legend").selectAll("*").size()) {
    clearLegend(); // hide legend
    return;
  }

  const data = pack.states
    .filter(s => s.i && !s.removed && s.cells)
    .sort((a, b) => (b.area ?? 0) - (a.area ?? 0))
    .map(s => [s.i, s.color, s.name]);
  drawLegend("States", data);
}

function togglePercentageMode(): void {
  if (ensureEl("statesBodySection").dataset.type === "absolute") {
    ensureEl("statesBodySection").dataset.type = "percentage";
    const totalBurgs = +ensureEl("statesFooterBurgs").innerText;
    const totalArea = +ensureEl("statesFooterArea").dataset.area!;
    const totalPopulation = +ensureEl("statesFooterPopulation").dataset.population!;
    const totalTreasury = pack.states.reduce((sum, s) => sum + (s.treasury || 0), 0);
    const totalCells = pack.states.reduce((sum, s) => sum + (s.i && !s.removed ? s.cells || 0 : 0), 0);

    ensureEl("statesBodySection")
      .querySelectorAll<HTMLElement>(":scope > .states")
      .forEach(el => {
        const { burgs, area, population, treasury, cells } = el.dataset;
        el.querySelector<HTMLElement>(".stateBurgs")!.innerText = `${rn((+burgs! / totalBurgs) * 100)}%`;
        el.querySelector<HTMLElement>(".stateCells")!.innerText = `${rn((+cells! / totalCells) * 100)}%`;
        el.querySelector<HTMLElement>(".stateArea")!.innerText = `${rn((+area! / totalArea) * 100)}%`;
        el.querySelector<HTMLElement>(".statePopulation")!.innerText = `${rn((+population! / totalPopulation) * 100)}%`;
        el.querySelector<HTMLElement>(".stateTreasury")!.innerText = `${rn((+treasury! / totalTreasury) * 100, 2)}%`;
      });
  } else {
    ensureEl("statesBodySection").dataset.type = "absolute";
    statesTable.refresh();
  }
}

function showStatesChart(): void {
  const statesData = pack.states.filter(s => !s.removed);
  if (statesData.length < 2) {
    tip("There are no states to show", false, "error");
    return;
  }

  const root: any = stratify<any>()
    .id(d => String(d.i))
    .parentId(d => (d.i ? "0" : null))(statesData)
    .sum((d: any) => d.area)
    .sort((a: any, b: any) => b.value - a.value);

  const size = 150 + 200 * ensureEl<HTMLInputElement>("uiSize").valueAsNumber;
  const margin = { top: 0, right: -50, bottom: 0, left: -50 };
  const w = size - margin.left - margin.right;
  const h = size - margin.top - margin.bottom;
  const treeLayout = packLayout<any>().size([w, h]).padding(3);

  // prepare svg
  alertMessage.innerHTML = /* html */ `<select id="statesTreeType" style="display:block; margin-left:13px; font-size:11px">
    <option value="area" selected>Area</option>
    <option value="population">Total population</option>
    <option value="rural">Rural population</option>
    <option value="urban">Urban population</option>
    <option value="burgs">Burgs number</option>
  </select>`;
  alertMessage.innerHTML += `<div id='statesInfo' class='chartInfo'>&#8205;</div>`;

  const svg = select("#alertMessage")
    .insert("svg", "#statesInfo")
    .attr("id", "statesTree")
    .attr("width", size)
    .attr("height", size)
    .style("font-family", "Almendra SC")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central");
  const graph = svg.append("g").attr("transform", `translate(-50, 0)`);
  ensureEl("statesTreeType").addEventListener("change", updateChart);

  treeLayout(root);

  const node = graph
    .selectAll("g")
    .data(root.leaves())
    .enter()
    .append("g")
    .attr("transform", (d: any) => `translate(${d.x},${d.y})`)
    .attr("data-id", (d: any) => d.data.i)
    .on("mouseenter", (event: any, d: any) => showInfo(event, d))
    .on("mouseleave", (event: any) => hideInfo(event));

  node
    .append("circle")
    .attr("fill", (d: any) => d.data.color)
    .attr("r", (d: any) => d.r);

  const exp = /(?=[A-Z][^A-Z])/g;
  const lp = (n: string) => (max(n.split(exp).map(p => p.length)) ?? 0) + 1; // longest name part + 1

  node
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .style("font-size", (d: any) => `${rn((d.r ** 0.97 * 4) / lp(d.data.name), 2)}px`)
    .selectAll("tspan")
    .data((d: any) => d.data.name.split(exp))
    .join("tspan")
    .attr("x", 0)
    .text((d: any) => d)
    .attr("dy", (_d: any, i: number, n: any) => `${i ? 1 : (n.length - 1) / -2}em`);

  function showInfo(ev: any, d: any) {
    select(ev.target).select("circle").classed("selected", true);
    const state = d.data.fullName;

    const area = `${getArea(d.data.area)} ${getAreaUnit()}`;
    const rural = rn(d.data.rural * populationRate);
    const urban = rn(d.data.urban * populationRate * urbanization);

    const option = ensureEl<HTMLSelectElement>("statesTreeType").value;
    const value =
      option === "area"
        ? `Area: ${area}`
        : option === "rural"
          ? `Rural population: ${si(rural)}`
          : option === "urban"
            ? `Urban population: ${si(urban)}`
            : option === "burgs"
              ? `Burgs number: ${d.data.burgs}`
              : `Population: ${si(rural + urban)}`;

    ensureEl("statesInfo").innerHTML = /* html */ `${state}. ${value}`;
    stateHighlightOn(ev);
  }

  function hideInfo(ev: any) {
    stateHighlightOff();
    if (!document.getElementById("statesInfo")) return;
    ensureEl("statesInfo").innerHTML = "&#8205;";
    select(ev.target).select("circle").classed("selected", false);
  }

  function updateChart(this: HTMLSelectElement) {
    const value =
      this.value === "area"
        ? (d: any) => d.area
        : this.value === "rural"
          ? (d: any) => d.rural
          : this.value === "urban"
            ? (d: any) => d.urban
            : this.value === "burgs"
              ? (d: any) => d.burgs
              : (d: any) => d.rural + d.urban;

    root.sum(value);
    node.data(treeLayout(root).leaves());

    node
      .transition()
      .duration(1500)
      .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    node
      .select("circle")
      .transition()
      .duration(1500)
      .attr("r", (d: any) => d.r);
    node
      .select("text")
      .transition()
      .duration(1500)
      .style("font-size", (d: any) => `${rn((d.r ** 0.97 * 4) / lp(d.data.name), 2)}px`);
  }

  $("#alert").dialog({
    title: "States bubble chart",
    width: "fit-content",
    position: { my: "left bottom", at: "left+10 bottom-10", of: "svg" },
    buttons: {},
    close: () => {
      alertMessage.innerHTML = "";
    }
  });
}

function openRegenerationMenu(): void {
  ensureEl("statesBottom")
    .querySelectorAll<HTMLElement>(":scope > button")
    .forEach(el => {
      el.style.display = "none";
    });
  ensureEl("statesRegenerateButtons").style.display = "block";
  $("#statesEditor").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" } });
}

function recalculateStates(must?: boolean): void {
  if (!must && !ensureEl<HTMLInputElement>("statesAutoChange").checked) return;

  States.expandStates();
  Provinces.generate();
  Provinces.getPoles();
  States.getPoles();

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
  $("#statesEditor").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" } });
}

function openPaintEditor(): void {
  Layers.show("states");
  const adjustLabels = ensureEl<HTMLInputElement>("adjustLabels").checked;

  void Controllers.PaintEditor.open({
    title: "Paint States",
    parentDialogId: dialogId,
    onClose: open,
    items: pack.states
      .filter(state => !state.removed)
      .map(state => ({ id: state.i, name: state.name, color: state.color || "#ffffff" })),
    dontOverrideControl: true,
    getValue: cell => pack.cells.state[cell],
    filterCell: (cell, currentState) => isLand(cell, pack) && cell !== pack.states[currentState].center,
    onApply: changes => applyStatesPaint(changes, adjustLabels)
  });
}

function applyStatesPaint(changes: ReadonlyMap<number, number>, adjustLabels: boolean): void {
  const { cells } = pack;
  const affectedStates: number[] = [];
  const affectedProvinces: number[] = [];

  for (const [cell, state] of changes) {
    affectedStates.push(cells.state[cell], state);
    affectedProvinces.push(cells.province[cell]);
    cells.state[cell] = state;
    if (cells.burg[cell]) pack.burgs[cells.burg[cell]].state = state;
  }

  if (affectedStates.length) {
    States.getPoles();
    adjustProvinces([...new Set(affectedProvinces)]);
    Layers.draw("states", "borders", "provinces");

    if (adjustLabels) {
      const statesToRefit = [...new Set(affectedStates)];
      for (const stateId of statesToRefit) {
        if (pack.states[stateId].label) delete pack.states[stateId].label;
      }
      Layers.draw("labels");
    }

    if (document.getElementById(dialogId)) refreshStatesEditor();
  }
}

function adjustProvinces(affectedProvinces: number[]): void {
  const { cells, provinces, states, burgs } = pack as any;
  const createdProvinces: number[] = [];

  affectedProvinces.forEach(provinceId => {
    if (!provinces[provinceId]) return; // lands without province captured => do nothing

    // find states owning at least 1 province cell
    const provCells = cells.i.filter((i: number) => cells.province[i] === provinceId);
    const provStates = [...new Set(provCells.map((i: number) => cells.state[i]))] as number[];

    // province is captured completely => change owner or remove
    if (provinceId && provStates.length === 1) {
      changeProvinceOwner(provinceId, provStates[0], provCells);
      return;
    }

    // province is captured partially => split province
    splitProvince(provinceId, provStates, provCells);
  });

  redrawEmblems(createdProvinces.map(provinceId => ["province", provinceId] as const));

  function changeProvinceOwner(provinceId: number, newOwnerId: number, provinceCells: number[]) {
    const province = provinces[provinceId];
    const prevOwner = states[province.state];

    // remove province from old owner list
    prevOwner.provinces = prevOwner.provinces.filter((province: number) => province !== provinceId);

    if (newOwnerId) {
      // new owner is a state => change owner
      province.state = newOwnerId;
      states[newOwnerId].provinces.push(provinceId);
    } else {
      // new owner is neutral => remove province
      provinces[provinceId] = { i: provinceId, removed: true };
      removeEmblem("province", provinceId);
      provinceCells.forEach(i => {
        cells.province[i] = 0;
      });
    }
  }

  function splitProvince(provinceId: number, provinceStates: number[], provinceCells: number[]) {
    const province = provinces[provinceId];
    const prevOwner = states[province.state];
    const provinceCenterOwner = cells.state[province.center];

    provinceStates.forEach(stateId => {
      const stateProvinceCells = provinceCells.filter(i => cells.state[i] === stateId);

      if (stateId === provinceCenterOwner) {
        // province center is owned by the same state => do nothing for this state
        if (stateId === prevOwner.i) return;

        // province center is captured by neutrals => remove province
        if (!stateId) {
          provinces[provinceId] = { i: provinceId, removed: true };
          removeEmblem("province", provinceId);
          stateProvinceCells.forEach(i => {
            cells.province[i] = 0;
          });
          return;
        }

        // reassign province ownership to province center owner
        prevOwner.provinces = prevOwner.provinces.filter((province: number) => province !== provinceId);
        province.state = stateId;
        province.color = getMixedColor(states[stateId].color);
        states[stateId].provinces.push(provinceId);
        return;
      }

      // province cells captured by neutrals => remove captured cells from province
      if (!stateId) {
        stateProvinceCells.forEach(i => {
          cells.province[i] = 0;
        });
        return;
      }

      // a few province cells owned by state => add to closes province
      if (stateProvinceCells.length < 20) {
        const closestProvince = findClosestProvince(provinceId, stateId, stateProvinceCells);
        if (closestProvince) {
          stateProvinceCells.forEach(i => {
            cells.province[i] = closestProvince;
          });
          return;
        }
      }

      // some province cells owned by state => create new province
      createProvince(province, stateId, stateProvinceCells);
    });
  }

  function createProvince(oldProvince: any, stateId: number, provinceCells: number[]) {
    const newProvinceId = provinces.length;
    const burgCell = provinceCells.find(i => cells.burg[i]);
    const center = burgCell ? burgCell : provinceCells[0];
    const burgId = burgCell ? cells.burg[burgCell] : 0;
    const burg = burgId ? burgs[burgId] : null;
    const culture = cells.culture[center];

    const nameByBurg = burgCell && P(0.5);
    const name = nameByBurg ? burg.name : oldProvince.name || Names.getState(Names.getCultureShort(culture), culture);

    const formOptions = ["Zone", "Area", "Territory", "Province"];
    const formName = burgCell && oldProvince.formName ? oldProvince.formName : ra(formOptions);

    const color = getMixedColor(states[stateId].color);

    const kinship = nameByBurg ? 0.8 : 0.4;
    const type = Burgs.getType(center, burg?.port);
    const coa = Emblems.generate(burg?.coa || states[stateId].coa, kinship, burg ? null : 0.9, type);
    coa.shield = Emblems.getShield(culture, stateId);

    provinces.push({
      i: newProvinceId,
      state: stateId,
      center,
      burg: burgId,
      name,
      formName,
      fullName: `${name} ${formName}`,
      color,
      coa
    });

    provinceCells.forEach(i => {
      cells.province[i] = newProvinceId;
    });

    states[stateId].provinces.push(newProvinceId);
    createdProvinces.push(newProvinceId);
  }

  function findClosestProvince(provinceId: number, stateId: number, sourceCells: number[]) {
    const borderCell = sourceCells.find(i =>
      cells.c[i].some((c: number) => {
        return cells.state[c] === stateId && cells.province[c] && cells.province[c] !== provinceId;
      })
    );

    const closesProvince =
      borderCell &&
      cells.c[borderCell]
        .map((c: number) => cells.province[c])
        .find((province: number) => province && province !== provinceId);
    return closesProvince;
  }
}

function enterAddStateMode(this: HTMLElement): void {
  if (this.classList.contains("pressed")) {
    exitAddStateMode();
    return;
  }
  customization = 3;
  this.classList.add("pressed");
  tip("Click on the map to create a new capital or promote an existing burg", true);
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addState);
  ensureEl("statesBodySection")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.pointerEvents = "none";
    });
}

function addState(this: SVGElement, event: MouseEvent): void {
  const { cells, states, burgs } = pack as any;
  const point = getPointer(event, this);
  const center = Pack.findCell(point[0], point[1])!;
  if (cells.h[center] < 20) {
    tip("You cannot place state into the water. Please click on a land cell", false, "error");
    return;
  }

  let burgId = cells.burg[center];
  if (burgId && burgs[burgId].capital) {
    tip("Existing capital cannot be selected as a new state capital! Select other cell", false, "error");
    return;
  }

  if (!burgId) {
    burgId = Burgs.add(point as [number, number]);
    redrawEmblem("burg", burgId);
  }

  const oldState = cells.state[center];
  const newState = states.length;

  // turn burg into a capital
  burgs[burgId].capital = 1;
  burgs[burgId].state = newState;
  Burgs.changeGroup(burgs[burgId], null);
  Layers.draw("burgIcons", "labels", "routes");

  if (event.shiftKey === false) exitAddStateMode();

  const culture = cells.culture[center];
  const basename = center % 5 === 0 ? burgs[burgId].name : Names.getCulture(culture);
  const name = Names.getState(basename, culture);
  const color = getRandomColor();

  // generate emblem
  const cultureType = pack.cultures[culture].type;
  const coa = Emblems.generate(burgs[burgId].coa, 0.4, null, cultureType);
  coa.shield = Emblems.getShield(culture, undefined);

  // update diplomacy and reverse relations
  const diplomacy = states.map((s: any) => {
    if (!s.i || s.removed) return "x";
    if (!oldState) {
      s.diplomacy.push("Neutral");
      return "Neutral";
    }

    let relations = states[oldState].diplomacy[s.i]; // relations between Nth state and old overlord
    if (s.i === oldState) relations = "Enemy";
    // new state is Enemy to its old overlord
    else if (relations === "Ally") relations = "Suspicion";
    else if (relations === "Friendly") relations = "Suspicion";
    else if (relations === "Suspicion") relations = "Neutral";
    else if (relations === "Enemy") relations = "Friendly";
    else if (relations === "Rival") relations = "Friendly";
    else if (relations === "Vassal") relations = "Suspicion";
    else if (relations === "Suzerain") relations = "Enemy";
    s.diplomacy.push(relations);
    return relations;
  });
  diplomacy.push("x");
  states[0].diplomacy.push([
    `Independance declaration`,
    `${name} declared its independance from ${states[oldState].name}`
  ]);

  cells.state[center] = newState;
  cells.province[center] = 0;

  states.push({
    i: newState,
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
  });

  States.getPoles();
  States.findNeighbors();
  States.collectStatistics();
  States.defineStateForms([newState]);
  adjustProvinces([cells.province[center]]);

  Layers.draw("labels");
  redrawEmblem("state", newState);

  Layers.hide("provinces");
  Layers.show("states", "borders");

  statesTable.refresh();
}

function exitAddStateMode(): void {
  customization = 0;
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

function openStateMergeDialog(): void {
  const emblem = (i: number) =>
    /* html */ `<svg class="coaIcon" viewBox="0 0 200 200"><use href="#stateCOA${i}"></use></svg>`;
  const validStates = pack.states.filter(s => s.i && !s.removed);

  const statesSelector = validStates
    .map(
      s => /* html */ `
      <div data-id="${s.i}" data-tip="${s.fullName}" style="cursor:default">
        <input type="radio" name="rulingState" value="${s.i}" />
        <input id="selectState${s.i}" class="checkbox" type="checkbox" name="statesToMerge" value="${s.i}" />
        <label for="selectState${s.i}" class="checkbox-label"><fill-box fill="${s.color}" disabled></fill-box>${emblem(s.i)}${s.fullName}</label>
      </div>
    `
    )
    .join("");

  alertMessage.innerHTML = /* html */ `
    <form id='mergeStatesForm' style="overflow: hidden; display: flex; flex-direction: column; gap: 1em;">
      <p style="margin:0">
        Check the <b>checkbox</b> next to each state you want to merge.
        Use the <b>radio button</b> to pick the <em>ruling state</em> that will absorb all others (its name, color, and capital will be kept).
        Hover over a row to highlight the state on the map.
      </p>
      <main style='display: grid; grid-template-columns: 1fr 1fr; gap: .3em;'>
        ${statesSelector}
      </main>
    </form>
  `;

  ensureEl("mergeStatesForm")
    .querySelectorAll("div[data-id]")
    .forEach(el => {
      el.addEventListener("mouseenter", highlightStateOnMergeHover);
      el.addEventListener("mouseleave", stateHighlightOff);
    });
  applyLineHighlighting("mergeStatesForm", ({ cellId }) => pack.cells.state[cellId]);

  function highlightStateOnMergeHover(event: any) {
    if (!Layers.isOn("states")) return;
    const state = +event.currentTarget.dataset.id;
    if (!state) return;
    const d = select("#regions").select(`#state${state}`).attr("d");
    if (!d) return;

    stateHighlightOff();

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
    const interpolate = interpolateString(`0, ${totalLength}`, `${totalLength}, ${totalLength}`);
    path
      .transition()
      .duration(duration)
      .attrTween("stroke-dasharray", () => interpolate);
  }

  $("#alert").dialog({
    width: 600,
    title: `Merge states`,
    close: stateHighlightOff,
    buttons: {
      Merge: function (this: HTMLElement) {
        const formData = new FormData(ensureEl<HTMLFormElement>("mergeStatesForm"));

        const rulingStateId = Number(formData.get("rulingState"));
        if (!rulingStateId) {
          tip("Please select a state to merge into", false, "error");
          return;
        }
        const rullingState = pack.states[rulingStateId];

        const statesToMerge = formData
          .getAll("statesToMerge")
          .map(Number)
          .filter(stateId => stateId !== rulingStateId);
        if (!statesToMerge.length) {
          tip("Please select several states to merge", false, "error");
          return;
        }

        confirmationDialog({
          title: "Merge states",
          // prettier-ignore
          message: /* html */ `
            <p>The following states will be <strong>removed</strong>: ${statesToMerge.map(stateId => `${emblem(stateId)}${(pack.states)[stateId].name}`).join(", ")}.</p>
            <p>Removed states data (burgs, provinces, regiments) will be assigned to ${emblem(rullingState.i)}${rullingState.name}.</p>
            <p>Are you sure you want to merge states? This action cannot be reverted.</p>`,
          confirm: "Merge",
          onConfirm: () => {
            mergeStates(statesToMerge, rulingStateId);
            $(this).dialog("close");
          }
        });
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });

  function mergeStates(statesToMerge: number[], rulingStateId: number) {
    const rulingState = pack.states[rulingStateId];
    const rulingStateArmy = ensureEl(`army${rulingStateId}`);

    // remove states to be merged
    statesToMerge.forEach(stateId => {
      const state = pack.states[stateId];
      state.removed = true;

      select("#statesBody").select(`#state${stateId}`).remove();
      select("#statesBody").select(`#state-gap${stateId}`).remove();
      select("#statesHalo").select(`#state-border${stateId}`).remove();
      delete pack.states[stateId].label;

      removeEmblem("state", stateId);

      // add merged state regiments to the ruling state
      (state.military || []).forEach((regiment: any) => {
        const oldId = `regiment${stateId}-${regiment.i}`;
        const newIndex = (rulingState.military || []).length;
        (rulingState.military || []).push({ ...regiment, i: newIndex });
        const newId = `regiment${rulingStateId}-${newIndex}`;

        const note = notes.find(n => n.id === oldId);
        if (note) note.id = newId;

        const element = document.getElementById(oldId);
        if (element) {
          element.id = newId;
          element.dataset.state = String(rulingStateId);
          element.dataset.id = String(newIndex);
          rulingStateArmy.appendChild(element);
        }
      });

      select(`#armies g#army${stateId}`).remove();
    });

    // reassing burgs
    pack.burgs.forEach(burg => {
      if (statesToMerge.includes(burg.state ?? 0)) {
        if (burg.capital) {
          burg.capital = 0;
          Burgs.changeGroup(burg, null);
        }
        burg.state = rulingStateId;
      }
    });

    // reassign provinces
    pack.provinces.forEach(province => {
      if (statesToMerge.includes(province.state)) province.state = rulingStateId;
    });

    // reassing cells
    pack.cells.state.forEach((s: number, i: number) => {
      if (statesToMerge.includes(s)) pack.cells.state[i] = rulingStateId;
    });

    unfog();
    select("#debug").selectAll(".highlight").remove();

    States.getPoles();

    if (!pack.states[rulingStateId].label) delete pack.states[rulingStateId].label;

    Layers.show("states", "borders");
    Layers.draw("burgIcons", "labels", "provinces");
    refreshStatesEditor();
  }
}

function downloadStatesCsv(): void {
  const unit = getAreaUnit("2");
  const headers = `Id,State,Full Name,Form,Color,Capital,Culture,Type,Expansionism,Cells,Burgs,Area ${unit},Total Population,Rural Population,Urban Population`;
  const data = statesTable.view().all.map(s => {
    const rural = s.rural || 0;
    const urban = s.urban || 0;
    const population = rn(rural * populationRate + urban * populationRate * urbanization);
    return [
      s.i,
      s.name,
      s.fullName || "",
      s.i ? s.formName : "",
      s.i ? s.color : "",
      s.i ? pack.burgs[s.capital].name : "",
      s.i ? pack.cultures[s.culture].name : "",
      s.i ? s.type : "",
      s.i ? s.expansionism : "",
      s.cells,
      s.burgs,
      getArea(s.area || 0),
      population,
      Math.round(rural * populationRate),
      Math.round(urban * populationRate * urbanization)
    ].join(",");
  });
  const csvData = [headers].concat(data).join("\n");

  const name = `${getFileName("States")}.csv`;
  downloadFile(csvData, name);
}

function updateLockStatus(stateId: number, classList: DOMTokenList): void {
  const s = pack.states[stateId];
  s.lock = !s.lock;

  classList.toggle("icon-lock-open");
  classList.toggle("icon-lock");
}

export const StatesEditor = { open };
