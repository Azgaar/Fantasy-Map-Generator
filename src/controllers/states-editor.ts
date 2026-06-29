import { color, drag, interpolateString, max, pack as packLayout, pointer, select, stratify } from "d3";
import { Controllers } from "@/controllers";
import type { Province } from "@/generators/provinces-generator";
import type { State } from "@/generators/states-generator";
import {
  ensureEl,
  findAllCellsInRadius,
  formatPrice,
  getAdjective,
  getMixedColor,
  getPackPolygon,
  getRandomColor,
  isLand,
  P,
  ra,
  rand,
  rn,
  si
} from "../utils";

const $body = insertEditorHtml();
addListeners();
let statesManualHistory: string[] = [];

function open(): void {
  if (customization) return;
  closeDialogs("#statesEditor, .stable");
  if (!layerIsOn("toggleStates")) toggleStates();
  if (!layerIsOn("toggleBorders")) toggleBorders();
  if (layerIsOn("toggleCultures")) toggleCultures();
  if (layerIsOn("toggleBiomes")) toggleBiomes();
  if (layerIsOn("toggleReligions")) toggleReligions();

  refreshStatesEditor();

  $("#statesEditor").dialog({
    title: "States Editor",
    resizable: false,
    close: closeStatesEditor,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });
}

function insertEditorHtml(): HTMLElement {
  const editorHtml = /* html */ `<div id="statesEditor" class="dialog stable">
    <div id="statesHeader" class="header" style="grid-template-columns: 11em 8em 7em 7em 5em 6em 6em 7em 7em 6em 7em">
      <div data-tip="Click to sort by state name" class="sortable alphabetically" data-sortby="name">State&nbsp;</div>
      <div data-tip="Click to sort by state form name" class="sortable alphabetically" data-sortby="form">Form&nbsp;</div>
      <div data-tip="Click to sort by capital name" class="sortable alphabetically" data-sortby="capital">Capital&nbsp;</div>
      <div data-tip="Click to sort by state dominant culture" class="sortable alphabetically hide" data-sortby="culture">Culture&nbsp;</div>
      <div data-tip="Click to sort by state burgs count" class="sortable hide" data-sortby="burgs">Burgs&nbsp;</div>
      <div data-tip="Click to sort by state cells count" class="sortable hide" data-sortby="cells">Cells&nbsp;</div>
      <div data-tip="Click to sort by state area" class="sortable hide icon-sort-number-down" data-sortby="area">Area&nbsp;</div>
      <div data-tip="Click to sort by state population" class="sortable hide" data-sortby="population">Population&nbsp;</div>
      <div data-tip="Click to sort by state treasury. Click on a value to view and edit taxes" class="sortable hide" data-sortby="treasury">Treasury&nbsp;</div>
      <div data-tip="Click to sort by state type" class="sortable alphabetically hidden show hide" data-sortby="type">Type&nbsp;</div>
      <div data-tip="Click to sort by state expansion value" class="sortable hidden show hide" data-sortby="expansionism">Expansion&nbsp;</div>
    </div>

    <div id="statesBodySection" class="table" data-type="absolute"></div>

    <div id="statesFooter" class="totalLine">
      <div data-tip="States number" style="margin-left: 5px">States:&nbsp;<span id="statesFooterStates">0</span></div>
      <div data-tip="Total burgs number" style="margin-left: 12px">Burgs:&nbsp;<span id="statesFooterBurgs">0</span></div>
      <div data-tip="Total land area" style="margin-left: 12px">Land Area:&nbsp;<span id="statesFooterArea">0</span></div>
      <div data-tip="Total population" style="margin-left: 12px">Population:&nbsp;<span id="statesFooterPopulation">0</span></div>
    </div>

    <div id="statesBottom">
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
      <div id="statesManuallyButtons" style="display: none">
        <div data-tip="Change brush size. Shortcuts: + / ] to increase; - / [ to decrease" style="margin-block: 0.3em;">
          <slider-input id="statesBrush" min="1" max="100" value="15">Brush size:</slider-input>
        </div>
        <button id="statesManuallyUndo" data-tip="Undo last brush stroke" class="icon-ccw"></button>
        <button id="statesManuallyApply" data-tip="Apply assignment" class="icon-check"></button>
        <button id="statesManuallyCancel" data-tip="Cancel assignment" class="icon-cancel"></button>
        <div data-tip="When enabled, only neutral cells can be painted" style="display: inline-block">
          <input id="statesManuallyProtect" class="checkbox" type="checkbox" />
          <label for="statesManuallyProtect" class="checkbox-label"><i>do not overwrite existing</i></label>
        </div>
      </div>

      <button id="statesAdd" data-tip="Add a new state. Hold Shift to add multiple" class="icon-plus"></button>
      <button id="statesMerge" data-tip="Merge several states into one" class="icon-layer-group"></button>
      <button id="statesExport" data-tip="Save state-related data as a text file (.csv)" class="icon-download"></button>
    </div>
  </div>`;

  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  return ensureEl("statesBodySection");
}

function addListeners(): void {
  applySortingByHeader("statesHeader");

  ensureEl("statesEditorRefresh").on("click", refreshStatesEditor);
  ensureEl("statesEditStyle").on("click", () => editStyle("regions"));
  ensureEl("statesLegend").on("click", toggleLegend);
  ensureEl("statesPercentage").on("click", togglePercentageMode);
  ensureEl("statesChart").on("click", showStatesChart);
  ensureEl("statesRegenerate").on("click", openRegenerationMenu);
  ensureEl("statesRegenerateBack").on("click", exitRegenerationMenu);
  ensureEl("statesRecalculate").on("click", () => recalculateStates(true));
  ensureEl("statesRandomize").on("click", randomizeStatesExpansion);
  ensureEl("statesGrowthRate").on("input", () => recalculateStates(false));
  ensureEl("statesManually").on("click", enterStatesManualAssignent);
  ensureEl("statesManuallyUndo").on("click", undoStatesManualAssignment);
  ensureEl("statesManuallyApply").on("click", applyStatesManualAssignent);
  ensureEl("statesManuallyCancel").on("click", () => exitStatesManualAssignment(false));
  ensureEl("statesAdd").on("click", enterAddStateMode);
  ensureEl("statesMerge").on("click", openStateMergeDialog);
  ensureEl("statesExport").on("click", downloadStatesCsv);

  $body.on("click", event => {
    const $element = (event as MouseEvent).target as HTMLElement;
    const classList = $element.classList;
    const stateId = Number(($element.parentNode as HTMLElement)?.dataset?.id);
    if ($element.tagName === "FILL-BOX") stateChangeFill($element);
    else if (classList.contains("name")) editStateName(stateId);
    else if (classList.contains("coaIcon")) editEmblem("state", `stateCOA${stateId}`, pack.states[stateId]);
    else if (classList.contains("icon-star-empty")) stateCapitalZoomIn(stateId);
    else if (classList.contains("icon-dot-circled")) Controllers.BurgsOverview.open({ stateId });
    else if (classList.contains("statePopulation")) changePopulation(stateId);
    else if (classList.contains("stateTreasury")) openTreasuryDialog(stateId);
    else if (classList.contains("icon-pin")) toggleFog(stateId, classList);
    else if (classList.contains("icon-target"))
      highlightElement(regions.select(`#state${stateId}`).node() as Element, 4);
    else if (classList.contains("icon-trash-empty")) stateRemovePrompt(stateId);
    else if (classList.contains("icon-lock") || classList.contains("icon-lock-open"))
      updateLockStatus(stateId, classList);
  });

  $body.on("input", ev => {
    const $element = (ev as Event).target as HTMLInputElement;
    const classList = $element.classList;
    const line = $element.parentNode as HTMLElement;
    const state = +line.dataset.id!;
    if (classList.contains("stateCapital")) stateChangeCapitalName(state, line, $element.value);
  });

  $body.on("change", ev => {
    const $element = (ev as Event).target as HTMLInputElement;
    const classList = $element.classList;
    const line = $element.parentNode as HTMLElement;
    const state = +line.dataset.id!;
    if (classList.contains("stateCulture")) stateChangeCulture(state, line, $element.value);
    else if (classList.contains("cultureType")) stateChangeType(state, line, $element.value);
    else if (classList.contains("statePower")) stateChangeExpansionism(state, line, $element.value);
  });
}

function refreshStatesEditor(): void {
  States.collectStatistics();
  statesEditorAddLines();
}

// add line for each state
function statesEditorAddLines(): void {
  const unit = getAreaUnit();
  const hidden = ensureEl("statesRegenerateButtons").style.display === "block" ? "" : "hidden"; // toggle regenerate columns
  let lines = "";
  let totalArea = 0;
  let totalPopulation = 0;
  let totalBurgs = 0;

  for (const s of pack.states) {
    if (s.removed) continue;
    const area = getArea(s.area || 0);
    const rural = (s.rural || 0) * populationRate;
    const urban = (s.urban || 0) * populationRate * urbanization;
    const population = rn(rural + urban);
    const populationTip = `Total population: ${si(population)}; Rural population: ${si(rural)}; Urban population: ${si(
      urban
    )}. Click to change`;
    totalArea += area;
    totalPopulation += population;
    totalBurgs += s.burgs || 0;
    const focused = defs.select(`#fog #focusState${s.i}`).size();
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
        <svg width="1em" height="1em" class="placeholder"></svg>
        <input data-tip="Neutral lands name. Click to change" class="stateName name pointer italic" value="${
          s.name
        }" readonly />
        <svg class="coaIcon placeholder"></svg>
        <input class="stateForm placeholder" value="none" />
        <span class="icon-star-empty placeholder"></span>
        <input class="stateCapital placeholder" />
        <select class="stateCulture placeholder hide">${getCultureOptions(0)}</select>
        <span data-tip="Click to overview neutral burgs" class="icon-dot-circled pointer hide" style="padding-right: 1px"></span>
        <div data-tip="Burgs count" class="stateBurgs hide">${s.burgs}</div>
        <span data-tip="Cells count" class="icon-check-empty hide"></span>
        <div data-tip="Cells count" class="stateCells hide">${s.cells}</div>
        <span data-tip="Neutral lands area" style="padding-right: 4px" class="icon-map-o hide"></span>
        <div data-tip="Neutral lands area" class="stateArea hide" style="width: 6em">${si(area)} ${unit}</div>
        <span data-tip="${populationTip}" class="icon-male hide"></span>
        <div data-tip="${populationTip}" class="statePopulation pointer hide" style="width: 5em">${si(population)}</div>
        <div data-tip="Neutrals collect no taxes" class="stateTreasury placeholder hide" style="width: 6em"></div>
        <select class="cultureType ${hidden} placeholder show hide">${getTypeOptions(0)}</select>
        <span class="icon-resize-full ${hidden} placeholder show hide"></span>
        <input class="statePower ${hidden} placeholder show hide" type="number" value="0" />
      </div>`;
      continue;
    }

    const capital = pack.burgs[s.capital].name;
    COArenderer.trigger(`stateCOA${s.i}`, s.coa);
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
      <fill-box fill="${s.color}"></fill-box>
      <input data-tip="State name. Click to change" class="stateName name pointer" value="${s.name}" readonly />
      <svg data-tip="Click to show and edit state emblem" class="coaIcon pointer" viewBox="0 0 200 200"><use href="#stateCOA${
        s.i
      }"></use></svg>
      <input data-tip="State form name. Click to change" class="stateForm name pointer" value="${
        s.formName
      }" readonly />
      <span data-tip="State capital. Click to zoom into view" class="icon-star-empty pointer"></span>
      <input data-tip="Capital name. Click and type to rename" class="stateCapital" value="${capital}" autocorrect="off" spellcheck="false" />
      <select data-tip="Dominant culture. Click to change" class="stateCulture hide">${getCultureOptions(
        s.culture
      )}</select>
      <span data-tip="Click to overview state burgs" style="padding-right: 1px" class="icon-dot-circled pointer hide"></span>
      <div data-tip="Burgs count" class="stateBurgs hide">${s.burgs}</div>
      <span data-tip="Cells count" class="icon-check-empty hide"></span>
      <div data-tip="Cells count" class="stateCells hide">${s.cells}</div>
      <span data-tip="State area" style="padding-right: 4px" class="icon-map-o hide"></span>
      <div data-tip="State area" class="stateArea hide" style="width: 6em">${si(area)} ${unit}</div>
      <span data-tip="${populationTip}" class="icon-male hide"></span>
      <div data-tip="${populationTip}" class="statePopulation pointer hide" style="width: 5em">${si(population)}</div>
      <div data-tip="${treasuryTip}" class="stateTreasury pointer hide" style="width: 6em">🟡 ${si(s.treasury)}</div>
      <select data-tip="State type. Defines growth model. Click to change" class="cultureType ${hidden} show hide">${getTypeOptions(
        s.type
      )}</select>
      <span data-tip="State expansionism" class="icon-resize-full ${hidden} show hide"></span>
      <input data-tip="Expansionism (defines competitive size). Change to re-calculate states based on new value"
        class="statePower ${hidden} show hide" type="number" min="0" max="99" step=".1" value=${s.expansionism} />
      <span data-tip="Locate the state" class="icon-target hide"></span>
      <span data-tip="Toggle state focus" class="icon-pin ${focused ? "" : " inactive"} hide"></span>
      <span data-tip="Lock the state to protect it from re-generation" class="icon-lock${
        s.lock ? "" : "-open"
      } hide"></span>
      <span data-tip="Remove the state" class="icon-trash-empty hide"></span>
    </div>`;
  }
  $body.innerHTML = lines;

  // update footer
  ensureEl("statesFooterStates").innerHTML = String(pack.states.filter(s => s.i && !s.removed).length);
  ensureEl("statesFooterBurgs").innerHTML = String(totalBurgs);
  ensureEl("statesFooterArea").innerHTML = si(totalArea) + unit;
  ensureEl("statesFooterArea").dataset.area = String(totalArea);
  ensureEl("statesFooterPopulation").innerHTML = si(totalPopulation);
  ensureEl("statesFooterPopulation").dataset.population = String(totalPopulation);

  // add listeners
  $body.querySelectorAll(":scope > div").forEach($line => {
    $line.on("mouseenter", stateHighlightOn);
    $line.on("mouseleave", stateHighlightOff);
    $line.on("click", selectStateOnLineClick);
  });

  if ($body.dataset.type === "percentage") {
    $body.dataset.type = "absolute";
    togglePercentageMode();
  }
  applySorting(ensureEl("statesHeader"));
  $("#statesEditor").dialog({ width: fitContent() });
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
  if (!layerIsOn("toggleStates")) return;
  if (defs.select("#fog path").size()) return;

  const state = +event.target.dataset.id;
  if (customization || !state) return;
  const d = regions.select(`#state${state}`).attr("d");

  const path = debug
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
  debug.selectAll(".highlight").each(function (this: any) {
    select(this).transition().duration(1000).attr("opacity", 0).remove();
  });
}

function stateChangeFill(el: HTMLElement): void {
  const currentFill = el.getAttribute("fill") || "#ffffff";
  const state = +(el.parentNode as HTMLElement).dataset.id!;

  const callback = (newFill: string) => {
    (el as any).fill = newFill;
    pack.states[state].color = newFill;
    statesBody.select(`#state${state}`).attr("fill", newFill);
    statesBody.select(`#state-gap${state}`).attr("stroke", newFill);
    const halo = color(newFill)?.darker().hex() ?? "#666666";
    statesHalo.select(`#state-border${state}`).attr("stroke", halo);

    // recolor regiments
    const solidColor = newFill[0] === "#" ? newFill : "#999";
    const darkerColor = color(solidColor)?.darker().hex() ?? "#666666";
    armies.select(`#army${state}`).attr("fill", solidColor);
    armies.select(`#army${state}`).selectAll("g > rect:nth-of-type(2)").attr("fill", darkerColor);
  };

  openPicker(currentFill, callback);
}

function editStateName(state: number): void {
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
    position: { my: "center", at: "center", of: "svg" }
  });

  if (modules.editStateName) return;
  modules.editStateName = true;

  // add listeners
  ensureEl("stateNameEditorShortCulture").on("click", regenerateShortNameCulture);
  ensureEl("stateNameEditorShortRandom").on("click", regenerateShortNameRandom);
  ensureEl("stateNameEditorAddForm").on("click", addCustomForm);
  ensureEl("stateNameEditorCustomForm").on("change", addCustomForm);
  ensureEl("stateNameEditorFullRegenerate").on("click", regenerateFullName);

  function regenerateShortNameCulture() {
    const state = +ensureEl("stateNameEditor").dataset.state!;
    const culture = pack.states[state].culture;
    const name = Names.getState(Names.getCultureShort(culture), culture);
    ensureEl<HTMLInputElement>("stateNameEditorShort").value = name;
  }

  function regenerateShortNameRandom() {
    const base = rand(nameBases.length - 1);
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
    if (changed && ensureEl<HTMLInputElement>("stateNameEditorUpdateLabel").checked) drawStateLabels([s.i]);
    refreshStatesEditor();
  }
}

function stateChangeCapitalName(state: number, line: HTMLElement, value: string): void {
  line.dataset.capital = value;
  const capital = pack.states[state].capital;
  if (!capital) return;
  pack.burgs[capital].name = value;
  (document.querySelector(`#burgLabel${capital}`) as HTMLElement).textContent = value;
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

    if (layerIsOn("togglePopulation")) drawPopulation();
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
  const label = burgLabels.select(`[data-id='${capital}']`);
  const x = +label.attr("x");
  const y = +label.attr("y");
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
  const path = statesBody.select(`#state${state}`).attr("d");
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
  statesBody.select(`#state${stateId}`).remove();
  statesBody.select(`#state-gap${stateId}`).remove();
  statesHalo.select(`#state-border${stateId}`).remove();
  labels.select(`#stateLabel${stateId}`).remove();
  defs.select(`#textPath_stateLabel${stateId}`).remove();

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

  pack.cells.state.forEach((s: number, i: number) => {
    if (s === stateId) pack.cells.state[i] = 0;
  });

  // remove emblem
  const coaId = `stateCOA${stateId}`;
  ensureEl(coaId).remove();
  emblems.select(`#stateEmblems > use[data-i='${stateId}']`).remove();

  // remove provinces
  (pack.states[stateId].provinces || []).forEach((p: number) => {
    pack.provinces[p] = { i: p, removed: true } as Province;
    pack.cells.province.forEach((pr: number, i: number) => {
      if (pr === p) pack.cells.province[i] = 0;
    });

    const coaId = `provinceCOA${p}`;
    if (document.getElementById(coaId)) ensureEl(coaId).remove();
    emblems.select(`#provinceEmblems > use[data-i='${p}']`).remove();
    const g = provs.select("#provincesBody");
    g.select(`#province${p}`).remove();
    g.select(`#province-gap${p}`).remove();
  });

  // remove military
  (pack.states[stateId].military || []).forEach((m: any) => {
    const id = `regiment${stateId}-${m.i}`;
    const index = notes.findIndex(n => n.id === id);
    if (index !== -1) notes.splice(index, 1);
  });
  armies.select(`g#army${stateId}`).remove();

  // clean up neighbors references from other states
  pack.states.forEach(state => {
    if (!state.i || state.removed || !state.neighbors) return;
    state.neighbors = state.neighbors.filter((n: number) => n !== stateId);
  });

  pack.states[stateId] = { i: stateId, removed: true } as State;

  debug.selectAll(".highlight").remove();

  if (layerIsOn("toggleStates")) drawStates();
  if (layerIsOn("toggleBorders")) drawBorders();
  if (layerIsOn("toggleProvinces")) drawProvinces();

  refreshStatesEditor();
}

function toggleLegend(): void {
  if (legend.selectAll("*").size()) {
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
  if ($body.dataset.type === "absolute") {
    $body.dataset.type = "percentage";
    const totalBurgs = +ensureEl("statesFooterBurgs").innerText;
    const totalArea = +ensureEl("statesFooterArea").dataset.area!;
    const totalPopulation = +ensureEl("statesFooterPopulation").dataset.population!;
    const totalTreasury = pack.states.reduce((sum, s) => sum + (s.treasury || 0), 0);
    const totalCells = pack.states.reduce((sum, s) => sum + (s.i && !s.removed ? s.cells || 0 : 0), 0);

    $body.querySelectorAll<HTMLElement>(":scope > div").forEach(el => {
      const { burgs, area, population, treasury, cells } = el.dataset;
      el.querySelector<HTMLElement>(".stateBurgs")!.innerText = `${rn((+burgs! / totalBurgs) * 100)}%`;
      el.querySelector<HTMLElement>(".stateCells")!.innerText = `${rn((+cells! / totalCells) * 100)}%`;
      el.querySelector<HTMLElement>(".stateArea")!.innerText = `${rn((+area! / totalArea) * 100)}%`;
      el.querySelector<HTMLElement>(".statePopulation")!.innerText = `${rn((+population! / totalPopulation) * 100)}%`;
      el.querySelector<HTMLElement>(".stateTreasury")!.innerText = `${rn((+treasury! / totalTreasury) * 100, 2)}%`;
    });
  } else {
    $body.dataset.type = "absolute";
    statesEditorAddLines();
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
  ensureEl("statesTreeType").on("change", updateChart);

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
    width: fitContent(),
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

  ensureEl("statesEditor")
    .querySelectorAll(".show")
    .forEach(el => {
      el.classList.remove("hidden");
    });
  $("#statesEditor").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" } });
}

function recalculateStates(must?: boolean): void {
  if (!must && !ensureEl<HTMLInputElement>("statesAutoChange").checked) return;

  States.expandStates();
  Provinces.generate();
  Provinces.getPoles();
  States.getPoles();

  if (layerIsOn("toggleStates")) drawStates();
  if (layerIsOn("toggleBorders")) drawBorders();
  if (layerIsOn("toggleProvinces")) drawProvinces();
  if (ensureEl<HTMLInputElement>("adjustLabels").checked) drawStateLabels();

  refreshStatesEditor();
}

function randomizeStatesExpansion(): void {
  pack.states.forEach(s => {
    if (!s.i || s.removed) return;
    const expansionism = rn(Math.random() * 4 + 1, 1);
    s.expansionism = expansionism;
    ($body.querySelector(`div.states[data-id='${s.i}'] > input.statePower`) as HTMLInputElement).value =
      String(expansionism);
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
  ensureEl("statesEditor")
    .querySelectorAll(".show")
    .forEach(el => {
      el.classList.add("hidden");
    });
  $("#statesEditor").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" } });
}

function enterStatesManualAssignent(): void {
  if (!layerIsOn("toggleStates")) toggleStates();
  customization = 2;
  statesBody.append("g").attr("id", "temp");
  document.querySelectorAll<HTMLElement>("#statesBottom > button").forEach(el => {
    el.style.display = "none";
  });
  ensureEl("statesManuallyButtons").style.display = "inline-block";
  ensureEl("statesHalo").style.display = "none";

  ensureEl("statesEditor")
    .querySelectorAll(".hide")
    .forEach(el => {
      el.classList.add("hidden");
    });
  ensureEl("statesFooter").style.display = "none";
  $body.querySelectorAll<HTMLElement>("div > input, select, span, svg").forEach(e => {
    e.style.pointerEvents = "none";
  });
  $("#statesEditor").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" } });

  tip("Click on state to select, drag the circle to change state", true);
  select<SVGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .on("click", selectStateOnMapClick)
    .call(drag<SVGElement, unknown>().on("start", dragStateBrush))
    .on("touchmove mousemove", moveStateBrush);

  $body.querySelector("div")?.classList.add("selected");
  statesManualHistory = [];
}

function selectStateOnLineClick(this: HTMLElement): void {
  if (customization !== 2) return;
  if ((this.parentNode as HTMLElement).id !== "statesBodySection") return;
  $body.querySelector("div.selected")?.classList.remove("selected");
  this.classList.add("selected");
}

function selectStateOnMapClick(this: any, event: any): void {
  const point = pointer(event, this);
  const i = findCell(point[0], point[1]);
  if (pack.cells.h[i!] < 20) return;

  const assigned = statesBody.select("#temp").select(`polygon[data-cell='${i}']`);
  const state = assigned.size() ? +assigned.attr("data-state") : pack.cells.state[i!];

  $body.querySelector("div.selected")?.classList.remove("selected");
  $body.querySelector(`div[data-id='${state}']`)?.classList.add("selected");
}

function dragStateBrush(this: any, event: any): void {
  const r = +ensureEl<HTMLInputElement>("statesBrush").value;
  saveStatesManualSnapshot();

  event.on("drag", (dragEvent: any) => {
    if (!dragEvent.dx && !dragEvent.dy) return;
    const p = pointer(dragEvent, this);
    moveCircle(p[0], p[1], r);

    const found = r > 5 ? findAllCellsInRadius(p[0], p[1], r, pack) : [findCell(p[0], p[1])];
    const selection = found.filter((i): i is number => i !== undefined && isLand(i, pack));
    if (selection) changeStateForSelection(selection);
  });
}

// change state within selection
function changeStateForSelection(selection: number[]): void {
  const temp = statesBody.select("#temp");

  const $selected = $body.querySelector<HTMLElement>("div.selected")!;
  const stateNew = +$selected.dataset.id!;
  const color = pack.states[stateNew].color || "#ffffff";
  const preventOverwrite = (document.getElementById("statesManuallyProtect") as HTMLInputElement | null)?.checked;

  selection.forEach(i => {
    const exists = temp.select(`polygon[data-cell='${i}']`);
    const stateOld = exists.size() ? +exists.attr("data-state") : pack.cells.state[i];
    if (stateNew === stateOld) return;
    if (preventOverwrite && stateOld) return;
    if (i === pack.states[stateOld].center) return;

    // change of append new element
    if (exists.size()) exists.attr("data-state", stateNew).attr("fill", color).attr("stroke", color);
    else
      temp
        .append("polygon")
        .attr("data-cell", i)
        .attr("data-state", stateNew)
        .attr("points", getPackPolygon(i, pack))
        .attr("fill", color)
        .attr("stroke", color);
  });
}

function moveStateBrush(this: any, event: any): void {
  showMainTip();
  const point = pointer(event, this);
  const radius = +ensureEl<HTMLInputElement>("statesBrush").value;
  moveCircle(point[0], point[1], radius);
}

function applyStatesManualAssignent(): void {
  const { cells } = pack as any;
  const affectedStates: number[] = [];
  const affectedProvinces: number[] = [];

  statesBody
    .select("#temp")
    .selectAll<SVGPolygonElement, unknown>("polygon")
    .each(function () {
      const i = +this.dataset.cell!;
      const c = +this.dataset.state!;
      affectedStates.push(cells.state[i], c);
      affectedProvinces.push(cells.province[i]);
      cells.state[i] = c;
      if (cells.burg[i]) pack.burgs[cells.burg[i]].state = c;
    });

  if (affectedStates.length) {
    refreshStatesEditor();
    States.getPoles();
    layerIsOn("toggleStates") ? drawStates() : toggleStates();
    if (ensureEl<HTMLInputElement>("adjustLabels").checked) drawStateLabels([...new Set(affectedStates)]);
    adjustProvinces([...new Set(affectedProvinces)]);
    layerIsOn("toggleBorders") ? drawBorders() : toggleBorders();
    if (layerIsOn("toggleProvinces")) drawProvinces();
  }

  exitStatesManualAssignment(false);
}

function adjustProvinces(affectedProvinces: number[]): void {
  const { cells, provinces, states, burgs } = pack as any;

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
    const coa = COA.generate(burg?.coa || states[stateId].coa, kinship, burg ? null : 0.9, type);
    coa.shield = COA.getShield(culture, stateId);

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

function exitStatesManualAssignment(close: boolean): void {
  customization = 0;
  statesManualHistory = [];
  statesBody.select("#temp").remove();
  removeCircle();
  document.querySelectorAll<HTMLElement>("#statesBottom > button").forEach(el => {
    el.style.display = "inline-block";
  });
  ensureEl("statesManuallyButtons").style.display = "none";
  ensureEl("statesHalo").style.display = "block";

  ensureEl("statesEditor")
    .querySelectorAll(".hide:not(.show)")
    .forEach(el => {
      el.classList.remove("hidden");
    });
  ensureEl("statesFooter").style.display = "block";
  $body.querySelectorAll<HTMLElement>("div > input, select, span, svg").forEach(e => {
    e.style.pointerEvents = "all";
  });
  if (!close)
    $("#statesEditor").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" } });

  restoreDefaultEvents();
  clearMainTip();
  const selected = $body.querySelector("div.selected");
  if (selected) selected.classList.remove("selected");
}

function saveStatesManualSnapshot(): void {
  const temp = statesBody.select("#temp").node() as HTMLElement | null;
  if (!temp) return;

  statesManualHistory.push(temp.innerHTML);
  if (statesManualHistory.length > 100) statesManualHistory.shift();
}

function undoStatesManualAssignment(): void {
  const temp = statesBody.select("#temp").node() as HTMLElement | null;
  if (!temp || !statesManualHistory.length) return;

  temp.innerHTML = statesManualHistory.pop()!;
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
  $body.querySelectorAll<HTMLElement>("div > input, select, span, svg").forEach(e => {
    e.style.pointerEvents = "none";
  });
}

function addState(this: SVGElement, event: MouseEvent): void {
  const { cells, states, burgs } = pack as any;
  const point = pointer(event, this);
  const center = findCell(point[0], point[1])!;
  if (cells.h[center] < 20) {
    tip("You cannot place state into the water. Please click on a land cell", false, "error");
    return;
  }

  let burgId = cells.burg[center];
  if (burgId && burgs[burgId].capital) {
    tip("Existing capital cannot be selected as a new state capital! Select other cell", false, "error");
    return;
  }

  if (!burgId) burgId = Burgs.add(point as [number, number]);

  const oldState = cells.state[center];
  const newState = states.length;

  // turn burg into a capital
  burgs[burgId].capital = 1;
  burgs[burgId].state = newState;
  Burgs.changeGroup(burgs[burgId], null);

  if (event.shiftKey === false) exitAddStateMode();

  const culture = cells.culture[center];
  const basename = center % 5 === 0 ? burgs[burgId].name : Names.getCulture(culture);
  const name = Names.getState(basename, culture);
  const color = getRandomColor();

  // generate emblem
  const cultureType = pack.cultures[culture].type;
  const coa = COA.generate(burgs[burgId].coa, 0.4, null, cultureType);
  coa.shield = COA.getShield(culture, undefined);

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

  drawStateLabels([newState]);
  COArenderer.add("state", newState, coa as any, states[newState].pole[0], states[newState].pole[1]);

  layerIsOn("toggleProvinces") && toggleProvinces();
  layerIsOn("toggleStates") ? drawStates() : toggleStates();
  layerIsOn("toggleBorders") ? drawBorders() : toggleBorders();

  statesEditorAddLines();
}

function exitAddStateMode(): void {
  customization = 0;
  restoreDefaultEvents();
  clearMainTip();
  $body.querySelectorAll<HTMLElement>("div > input, select, span, svg").forEach(e => {
    e.style.pointerEvents = "all";
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

  function highlightStateOnMergeHover(event: any) {
    if (!layerIsOn("toggleStates")) return;
    const state = +event.currentTarget.dataset.id;
    if (!state) return;
    const d = regions.select(`#state${state}`).attr("d");
    if (!d) return;

    stateHighlightOff();

    const path = debug
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

      statesBody.select(`#state${stateId}`).remove();
      statesBody.select(`#state-gap${stateId}`).remove();
      statesHalo.select(`#state-border${stateId}`).remove();
      labels.select(`#stateLabel${stateId}`).remove();
      defs.select(`#textPath_stateLabel${stateId}`).remove();

      ensureEl(`stateCOA${stateId}`).remove();
      emblems.select(`#stateEmblems > use[data-i='${stateId}']`).remove();

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

      armies.select(`g#army${stateId}`).remove();
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
    debug.selectAll(".highlight").remove();

    States.getPoles();
    layerIsOn("toggleStates") ? drawStates() : toggleStates();
    layerIsOn("toggleBorders") ? drawBorders() : toggleBorders();
    layerIsOn("toggleProvinces") && drawProvinces();
    drawStateLabels([rulingStateId]);

    refreshStatesEditor();
  }
}

function downloadStatesCsv(): void {
  const unit = getAreaUnit("2");
  const headers = `Id,State,Full Name,Form,Color,Capital,Culture,Type,Expansionism,Cells,Burgs,Area ${unit},Total Population,Rural Population,Urban Population`;
  const lines = Array.from($body.querySelectorAll<HTMLElement>(":scope > div"));
  const data = lines.map($line => {
    const { id, name, form, color, capital, culture, type, expansionism, cells, burgs, area, population } =
      $line.dataset;
    const { fullName = "", rural, urban } = pack.states[+id!];
    const ruralPopulation = Math.round((rural ?? 0) * populationRate);
    const urbanPopulation = Math.round((urban ?? 0) * populationRate * urbanization);
    return [
      id,
      name,
      fullName,
      form,
      color,
      capital,
      culture,
      type,
      expansionism,
      cells,
      burgs,
      area,
      population,
      ruralPopulation,
      urbanPopulation
    ].join(",");
  });
  const csvData = [headers].concat(data).join("\n");

  const name = `${getFileName("States")}.csv`;
  downloadFile(csvData, name);
}

function closeStatesEditor(): void {
  if (customization === 2) exitStatesManualAssignment(true);
  if (customization === 3) exitAddStateMode();
  debug.selectAll(".highlight").remove();
  $body.innerHTML = "";
}

function updateLockStatus(stateId: number, classList: DOMTokenList): void {
  const s = pack.states[stateId];
  s.lock = !s.lock;

  classList.toggle("icon-lock-open");
  classList.toggle("icon-lock");
}

export const StatesEditor = { open };
