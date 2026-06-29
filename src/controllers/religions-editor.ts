import { drag, easeSinIn, pointer, select, transition } from "d3";
import { Controllers } from "@/controllers";
import {
  abbreviate,
  debounce,
  ensureEl,
  findAllCellsInRadius,
  getPackPolygon,
  isLand,
  parseTransform,
  rn,
  si
} from "../utils";

const $body = insertEditorHtml();
addListeners();

function open(): void {
  if (customization) return;
  closeDialogs("#religionsEditor, .stable");
  if (!layerIsOn("toggleReligions")) toggleReligions();
  if (layerIsOn("toggleStates")) toggleStates();
  if (layerIsOn("toggleBiomes")) toggleBiomes();
  if (layerIsOn("toggleCultures")) toggleCultures();
  if (layerIsOn("toggleProvinces")) toggleProvinces();

  refreshReligionsEditor();
  drawReligionCenters();

  $("#religionsEditor").dialog({
    title: "Religions Editor",
    resizable: false,
    close: closeReligionsEditor,
    position: { my: "right top", at: "right-10 top+10", of: "svg" }
  });
  $body.focus();
}

function insertEditorHtml(): HTMLElement {
  const editorHtml = /* html */ `<div id="religionsEditor" class="dialog stable">
    <div id="religionsHeader" class="header" style="grid-template-columns: 13em 6em 7em 18em 6em 7em 6em 7em">
      <div data-tip="Click to sort by religion name" class="sortable alphabetically" data-sortby="name">Religion&nbsp;</div>
      <div data-tip="Click to sort by religion type" class="sortable alphabetically icon-sort-name-down" data-sortby="type">Type&nbsp;</div>
      <div data-tip="Click to sort by religion form" class="sortable alphabetically" data-sortby="form">Form&nbsp;</div>
      <div data-tip="Click to sort by supreme deity" class="sortable alphabetically hide" data-sortby="deity">Supreme Deity&nbsp;</div>
      <div data-tip="Click to sort by religion area" class="sortable hide" data-sortby="area">Area&nbsp;</div>
      <div data-tip="Click to sort by number of believers (religion area population)" class="sortable hide" data-sortby="population">Believers&nbsp;</div>
      <div data-tip="Click to sort by potential extent type" class="sortable alphabetically hide" data-sortby="expansion">Potential&nbsp;</div>
      <div data-tip="Click to sort by expansionism" class="sortable hide" data-sortby="expansionism">Expansion&nbsp;</div>
    </div>
    <div id="religionsBody" class="table" data-type="absolute"></div>

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
      <div data-tip="Total land area" style="margin-left: 12px">
        Land Area:&nbsp;<span id="religionsFooterArea">0</span>
      </div>
      <div data-tip="Total number of believers (population)" style="margin-left: 12px">
        Believers:&nbsp;<span id="religionsFooterPopulation">0</span>
      </div>
    </div>

    <div id="religionsBottom">
      <button id="religionsEditorRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
      <button id="religionsEditStyle" data-tip="Edit religions style in Style Editor" class="icon-adjust"></button>
      <button id="religionsLegend" data-tip="Toggle Legend box" class="icon-list-bullet"></button>
      <button id="religionsPercentage" data-tip="Toggle percentage / absolute values display mode" class="icon-percent"></button>
      <button id="religionsHeirarchy" data-tip="Show religions hierarchy tree" class="icon-sitemap"></button>
      <button id="religionsExtinct" data-tip="Show/hide extinct religions (religions without cells)" class="icon-eye-off"></button>

      <button id="religionsManually" data-tip="Manually re-assign religions" class="icon-brush"></button>
      <div id="religionsManuallyButtons" style="display: none">
        <div data-tip="Change brush size. Shortcuts: + or ] to increase; - or [ to decrease" style="margin-block: 0.3em;">
          <slider-input id="religionsBrush" min="1" max="100" value="15">Brush size:</slider-input>
        </div>
        <button id="religionsManuallyApply" data-tip="Apply assignment" class="icon-check"></button>
        <button id="religionsManuallyCancel" data-tip="Cancel assignment" class="icon-cancel"></button>
        <div data-tip="When enabled, only cells without religion can be painted" style="display: inline-block">
          <input id="religionsManuallyProtect" class="checkbox" type="checkbox" />
          <label for="religionsManuallyProtect" class="checkbox-label"><i>do not overwrite existing</i></label>
        </div>
      </div>
      <button id="religionsAdd" data-tip="Add a new religion. Hold Shift to add multiple" class="icon-plus"></button>
      <button id="religionsExport" data-tip="Download religions-related data" class="icon-download"></button>
      <button id="religionsRecalculate" data-tip="Recalculate religions based on current values of growth-related attributes" class="icon-retweet"></button>
      <span data-tip="Allow religion center, extent, and expansionism changes to take an immediate effect">
        <input id="religionsAutoChange" class="checkbox" type="checkbox" />
        <label for="religionsAutoChange" class="checkbox-label"><i>auto-apply changes</i></label>
      </span>
    </div>
  </div>`;

  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  return ensureEl("religionsBody");
}

function addListeners(): void {
  applySortingByHeader("religionsHeader");

  ensureEl("religionsEditorRefresh").on("click", refreshReligionsEditor);
  ensureEl("religionsEditStyle").on("click", () => editStyle("relig"));
  ensureEl("religionsLegend").on("click", toggleLegend);
  ensureEl("religionsPercentage").on("click", togglePercentageMode);
  ensureEl("religionsHeirarchy").on("click", showHierarchy);
  ensureEl("religionsExtinct").on("click", toggleExtinct);
  ensureEl("religionsManually").on("click", enterReligionsManualAssignent);
  ensureEl("religionsManuallyApply").on("click", applyReligionsManualAssignent);
  ensureEl("religionsManuallyCancel").on("click", () => exitReligionsManualAssignment());
  ensureEl("religionsAdd").on("click", enterAddReligionMode);
  ensureEl("religionsExport").on("click", downloadReligionsCsv);
  ensureEl("religionsRecalculate").on("click", () => recalculateReligions(true));
}

function refreshReligionsEditor(): void {
  religionsCollectStatistics();
  religionsEditorAddLines();
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
function religionsEditorAddLines(): void {
  const unit = ` ${getAreaUnit()}`;
  let lines = "";
  let totalArea = 0;
  let totalPopulation = 0;

  for (const r of pack.religions) {
    if (r.removed) continue;
    if (r.i && !r.cells && $body.dataset.extinct !== "show") continue; // hide extinct religions

    const area = getArea(r.area ?? 0);
    const rural = (r.rural ?? 0) * populationRate;
    const urban = (r.urban ?? 0) * populationRate * urbanization;
    const population = rn(rural + urban);
    const populationTip = `Believers: ${si(population)}; Rural areas: ${si(rural)}; Urban areas: ${si(
      urban
    )}. Click to change`;
    totalArea += area;
    totalPopulation += population;

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
        <svg width="9" height="9" class="placeholder"></svg>
        <input data-tip="Religion name. Click and type to change" class="religionName italic" style="width: 11em"
          value="${r.name}" autocorrect="off" spellcheck="false" />
        <select data-tip="Religion type" class="religionType placeholder" style="width: 5em">
          ${getTypeOptions(r.type)}
        </select>
        <input data-tip="Religion form" class="religionForm placeholder" style="width: 6em" value="" autocorrect="off" spellcheck="false" />
        <span data-tip="Click to re-generate supreme deity" class="icon-arrows-cw placeholder hide"></span>
        <input data-tip="Religion supreme deity" class="religionDeity placeholder hide" style="width: 17em" value="" autocorrect="off" spellcheck="false" />
        <span data-tip="Religion area" style="padding-right: 4px" class="icon-map-o hide"></span>
        <div data-tip="Religion area" class="religionArea hide" style="width: 6em">${si(area) + unit}</div>
        <span data-tip="${populationTip}" class="icon-male hide"></span>
        <div data-tip="${populationTip}" class="religionPopulation hide pointer" style="width: 5em">${si(
          population
        )}</div>
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
      <fill-box fill="${r.color}"></fill-box>
      <input data-tip="Religion name. Click and type to change" class="religionName" style="width: 11em"
        value="${r.name}" autocorrect="off" spellcheck="false" />
      <select data-tip="Religion type" class="religionType" style="width: 5em">
        ${getTypeOptions(r.type)}
      </select>
      <input data-tip="Religion form" class="religionForm" style="width: 6em"
        value="${r.form}" autocorrect="off" spellcheck="false" />
      <span data-tip="Click to re-generate supreme deity" class="icon-arrows-cw hide"></span>
      <input data-tip="Religion supreme deity" class="religionDeity hide" style="width: 17em"
        value="${r.deity || ""}" autocorrect="off" spellcheck="false" />
      <span data-tip="Religion area" style="padding-right: 4px" class="icon-map-o hide"></span>
      <div data-tip="Religion area" class="religionArea hide" style="width: 6em">${si(area) + unit}</div>
      <span data-tip="${populationTip}" class="icon-male hide"></span>
      <div data-tip="${populationTip}" class="religionPopulation hide pointer" style="width: 5em">${si(
        population
      )}</div>
      ${getExpansionColumns(r)}
      <span data-tip="Locate the religion" class="icon-target hide"></span>
      <span data-tip="Lock this religion" class="icon-lock${r.lock ? "" : "-open"} hide"></span>
      <span data-tip="Remove religion" class="icon-trash-empty hide"></span>
    </div>`;
  }
  $body.innerHTML = lines;

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

  // add listeners
  $body.querySelectorAll(":scope > div").forEach($line => {
    $line.on("mouseenter", religionHighlightOn);
    $line.on("mouseleave", religionHighlightOff);
    $line.on("click", selectReligionOnLineClick);
  });
  $body.querySelectorAll("fill-box").forEach(el => void el.on("click", religionChangeColor));
  $body.querySelectorAll("div > input.religionName").forEach(el => void el.on("input", religionChangeName));
  $body.querySelectorAll("div > select.religionType").forEach(el => void el.on("change", religionChangeType));
  $body.querySelectorAll("div > input.religionForm").forEach(el => void el.on("input", religionChangeForm));
  $body.querySelectorAll("div > input.religionDeity").forEach(el => void el.on("input", religionChangeDeity));
  $body.querySelectorAll("div > span.icon-arrows-cw").forEach(el => void el.on("click", regenerateDeity));
  $body.querySelectorAll("div > div.religionPopulation").forEach(el => void el.on("click", changePopulation));
  $body.querySelectorAll("div > select.religionExtent").forEach(el => void el.on("change", religionChangeExtent));
  $body
    .querySelectorAll("div > input.religionExpantion")
    .forEach(el => void el.on("change", religionChangeExpansionism));
  $body.querySelectorAll("div > span.icon-trash-empty").forEach(el => void el.on("click", religionRemovePrompt));
  $body.querySelectorAll("div > span.icon-target").forEach($el => void $el.on("click", highlightReligion));
  $body.querySelectorAll("div > span.icon-lock").forEach($el => void $el.on("click", updateLockStatus));
  $body.querySelectorAll("div > span.icon-lock-open").forEach($el => void $el.on("click", updateLockStatus));

  if ($body.dataset.type === "percentage") {
    $body.dataset.type = "absolute";
    togglePercentageMode();
  }

  applySorting(ensureEl("religionsHeader"));
  $("#religionsEditor").dialog({ width: fitContent() });
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
      <span data-tip="${folkTip}" class="icon-resize-full-alt hide" style="padding-right: 2px"></span>
      <span data-tip="${folkTip}" class="religionExtent hide" style="width: 5em">culture</span>
      <span data-tip="${folkTip}" class="icon-resize-full hide"></span>
      <input data-tip="${folkTip}" class="religionExpantion hide" disabled type="number" value='0' />`;
  }

  return /* html */ `
    <span data-tip="Potential religion extent" class="icon-resize-full-alt hide" style="padding-right: 2px"></span>
    <select data-tip="Potential religion extent" class="religionExtent hide" style="width: 5em">
      ${getExtentOptions(r.expansion)}
    </select>
    <span data-tip="Religion expansionism. Defines competitive size" class="icon-resize-full hide"></span>
    <input
      data-tip="Religion expansionism. Defines competitive size. Click to change, then click Recalculate to apply change"
      class="religionExpantion hide"
      type="number"
      min="0"
      max="99"
      step=".1"
      value=${r.expansionism}
    />`;
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
  const $el = $body.querySelector(`div[data-id='${religionId}']`);
  if ($el) $el.classList.add("active");

  if (!layerIsOn("toggleReligions")) return;
  if (customization) return;

  const animate = transition().duration(2000).ease(easeSinIn);
  relig
    .select(`#religion${religionId}`)
    .raise()
    .transition(animate)
    .attr("stroke-width", 2.5)
    .attr("stroke", "#d0240f");
  debug.select(`#religionsCenter${religionId}`).raise().transition(animate).attr("r", 3).attr("stroke", "#d0240f");
}, 200);

function religionHighlightOff(event: any): void {
  const religionId = Number(event.id || event.target.dataset.id);
  const $el = $body.querySelector(`div[data-id='${religionId}']`);
  if ($el) $el.classList.remove("active");

  relig.select(`#religion${religionId}`).transition().attr("stroke-width", null).attr("stroke", null);
  debug.select(`#religionsCenter${religionId}`).transition().attr("r", 2).attr("stroke", null);
}

function religionChangeColor(this: HTMLElement): void {
  const currentFill = this.getAttribute("fill") || "#ffffff";
  const religionId = +(this.parentNode as HTMLElement).dataset.id!;

  const callback = (newFill: string) => {
    (this as any).fill = newFill;
    pack.religions[religionId].color = newFill;
    relig.select(`#religion${religionId}`).attr("fill", newFill);
    debug.select(`#religionsCenter${religionId}`).attr("fill", newFill);
  };

  openPicker(currentFill, callback);
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
  const religionId = +(this.parentNode as HTMLElement).dataset.id!;
  (this.parentNode as HTMLElement).dataset.deity = this.value;
  pack.religions[religionId].deity = this.value;
}

function regenerateDeity(this: HTMLElement): void {
  const religionId = +(this.parentNode as HTMLElement).dataset.id!;
  const cultureId = pack.religions[religionId].culture;
  const deity = Religions.getDeityName(cultureId) ?? "";
  (this.parentNode as HTMLElement).dataset.deity = deity;
  pack.religions[religionId].deity = deity;
  (this.nextElementSibling as HTMLInputElement).value = deity;
}

function changePopulation(this: HTMLElement): void {
  const religionId = +(this.parentNode as HTMLElement).dataset.id!;
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

    if (layerIsOn("togglePopulation")) drawPopulation();
    refreshReligionsEditor();
  }
}

function religionChangeExtent(this: HTMLSelectElement): void {
  const religion = +(this.parentNode as HTMLElement).dataset.id!;
  (this.parentNode as HTMLElement).dataset.expansion = this.value;
  pack.religions[religion].expansion = this.value;
  recalculateReligions();
}

function religionChangeExpansionism(this: HTMLInputElement): void {
  const religion = +(this.parentNode as HTMLElement).dataset.id!;
  (this.parentNode as HTMLElement).dataset.expansionism = this.value;
  pack.religions[religion].expansionism = +this.value;
  recalculateReligions();
}

function religionRemovePrompt(this: HTMLElement): void {
  if (customization) return;

  const religionId = +(this.parentNode as HTMLElement).dataset.id!;
  confirmationDialog({
    title: "Remove religion",
    message: "Are you sure you want to remove the religion? <br>This action cannot be reverted",
    confirm: "Remove",
    onConfirm: () => removeReligion(religionId)
  });
}

function removeReligion(religionId: number): void {
  relig.select(`#religion${religionId}`).remove();
  relig.select(`#religion-gap${religionId}`).remove();
  debug.select(`#religionsCenter${religionId}`).remove();

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
  const showExtinct = $body.dataset.extinct === "show";
  if (!showExtinct) data = data.filter(r => (r.cells ?? 0) > 0);

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
    const cell = findCell(x, y);
    if (cell == null || pack.cells.h[cell] < 20) return; // ignore dragging on water

    pack.religions[religionId].center = cell;
    recalculateReligions();
  }

  const dragDebounced = debounce(handleDrag, 50);
  event.on("drag", dragDebounced);
}

function toggleLegend(): void {
  if (legend.selectAll("*").size()) {
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
  if ($body.dataset.type === "absolute") {
    $body.dataset.type = "percentage";
    const totalArea = +ensureEl("religionsFooterArea").dataset.area!;
    const totalPopulation = +ensureEl("religionsFooterPopulation").dataset.population!;

    $body.querySelectorAll<HTMLElement>(":scope > div").forEach($el => {
      const { area, population } = $el.dataset;
      $el.querySelector<HTMLElement>(".religionArea")!.innerText = `${rn((+area! / totalArea) * 100)}%`;
      $el.querySelector<HTMLElement>(".religionPopulation")!.innerText =
        `${rn((+population! / totalPopulation) * 100)}%`;
    });
  } else {
    $body.dataset.type = "absolute";
    religionsEditorAddLines();
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
  $body.dataset.extinct = $body.dataset.extinct !== "show" ? "show" : "hide";
  religionsEditorAddLines();
  drawReligionCenters();
}

function enterReligionsManualAssignent(): void {
  if (!layerIsOn("toggleReligions")) toggleReligions();
  customization = 7;
  relig.append("g").attr("id", "temp");
  document.querySelectorAll<HTMLElement>("#religionsBottom > *").forEach(el => {
    el.style.display = "none";
  });
  ensureEl("religionsManuallyButtons").style.display = "inline-block";
  debug.select("#religionCenters").style("display", "none");

  ensureEl("religionsEditor")
    .querySelectorAll(".hide")
    .forEach(el => {
      el.classList.add("hidden");
    });
  ensureEl("religionsFooter").style.display = "none";
  $body.querySelectorAll<HTMLElement>("div > input, select, span, svg").forEach(e => {
    e.style.pointerEvents = "none";
  });
  $("#religionsEditor").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg" } });

  tip("Click on religion to select, drag the circle to change religion", true);
  select<SVGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .on("click", selectReligionOnMapClick)
    .call(drag<SVGElement, unknown>().on("start", dragReligionBrush))
    .on("touchmove mousemove", moveReligionBrush);

  $body.querySelector("div")?.classList.add("selected");
}

function selectReligionOnLineClick(this: HTMLElement): void {
  if (customization !== 7) return;
  const prev = $body.querySelector("div.selected");
  if (prev) prev.classList.remove("selected");
  this.classList.add("selected");
}

function selectReligionOnMapClick(this: any, event: any): void {
  const point = pointer(event, this);
  const i = findCell(point[0], point[1]);
  if (pack.cells.h[i!] < 20) return;

  const assigned = relig.select("#temp").select(`polygon[data-cell='${i}']`);
  const religion = assigned.size() ? +assigned.attr("data-religion") : pack.cells.religion[i!];

  $body.querySelector("div.selected")?.classList.remove("selected");
  $body.querySelector(`div[data-id='${religion}']`)?.classList.add("selected");
}

function dragReligionBrush(this: any, event: any): void {
  const radius = +ensureEl<HTMLInputElement>("religionsBrush").value;

  event.on("drag", (dragEvent: any) => {
    if (!dragEvent.dx && !dragEvent.dy) return;
    const [x, y] = pointer(dragEvent, this);
    moveCircle(x, y, radius);

    const found = radius > 5 ? findAllCellsInRadius(x, y, radius, pack) : [findCell(x, y, radius)];
    const selection = found.filter((i): i is number => i !== undefined && isLand(i, pack));
    if (selection) changeReligionForSelection(selection);
  });
}

// change religion within selection
function changeReligionForSelection(selection: number[]): void {
  const temp = relig.select("#temp");
  const selected = $body.querySelector<HTMLElement>("div.selected")!;
  const religionNew = +selected.dataset.id!;
  const color = pack.religions[religionNew].color || "#ffffff";
  const preventOverwrite = (document.getElementById("religionsManuallyProtect") as HTMLInputElement | null)?.checked;

  selection.forEach(i => {
    const exists = temp.select(`polygon[data-cell='${i}']`);
    const religionOld = exists.size() ? +exists.attr("data-religion") : pack.cells.religion[i];
    if (religionNew === religionOld) return;
    if (preventOverwrite && religionOld) return;

    // change of append new element
    if (exists.size()) exists.attr("data-religion", religionNew).attr("fill", color);
    else
      temp
        .append("polygon")
        .attr("data-cell", i)
        .attr("data-religion", religionNew)
        .attr("points", getPackPolygon(i, pack))
        .attr("fill", color);
  });
}

function moveReligionBrush(this: any, event: any): void {
  showMainTip();
  const [x, y] = pointer(event, this);
  const radius = +ensureEl<HTMLInputElement>("religionsBrush").value;
  moveCircle(x, y, radius);
}

function applyReligionsManualAssignent(): void {
  const changed = relig.select("#temp").selectAll<SVGPolygonElement, unknown>("polygon");
  changed.each(function () {
    const i = +this.dataset.cell!;
    const r = +this.dataset.religion!;
    pack.cells.religion[i] = r;
  });

  if (changed.size()) {
    drawReligions();
    refreshReligionsEditor();
    drawReligionCenters();
  }
  exitReligionsManualAssignment();
}

function exitReligionsManualAssignment(close?: string): void {
  customization = 0;
  relig.select("#temp").remove();
  removeCircle();
  document.querySelectorAll<HTMLElement>("#religionsBottom > *").forEach(el => {
    el.style.display = "inline-block";
  });
  ensureEl("religionsManuallyButtons").style.display = "none";

  ensureEl("religionsEditor")
    .querySelectorAll(".hide")
    .forEach(el => {
      el.classList.remove("hidden");
    });
  ensureEl("religionsFooter").style.display = "block";
  $body.querySelectorAll<HTMLElement>("div > input, select, span, svg").forEach(e => {
    e.style.pointerEvents = "all";
  });
  if (!close) $("#religionsEditor").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg" } });

  debug.select("#religionCenters").style("display", null);
  restoreDefaultEvents();
  clearMainTip();
  const $selected = $body.querySelector("div.selected");
  if ($selected) $selected.classList.remove("selected");
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
  $body.querySelectorAll<HTMLElement>("div > input, select, span, svg").forEach(e => {
    e.style.pointerEvents = "none";
  });
}

function exitAddReligionMode(): void {
  customization = 0;
  restoreDefaultEvents();
  clearMainTip();
  $body.querySelectorAll<HTMLElement>("div > input, select, span, svg").forEach(e => {
    e.style.pointerEvents = "all";
  });
  const religionsAdd = ensureEl("religionsAdd");
  if (religionsAdd.classList.contains("pressed")) religionsAdd.classList.remove("pressed");
}

function addReligion(this: SVGElement, event: MouseEvent): void {
  const [x, y] = pointer(event, this);
  const center = findCell(x, y)!;
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

  drawReligions();
  refreshReligionsEditor();
  drawReligionCenters();
}

function downloadReligionsCsv(): void {
  const unit = getAreaUnit("2");
  const headers = `Id,Name,Color,Type,Form,Supreme Deity,Area ${unit},Believers,Origins,Potential,Expansionism`;
  const lines = Array.from($body.querySelectorAll<HTMLElement>(":scope > div"));
  const data = lines.map($line => {
    const { id, name, color, type, form, deity, area, population, expansion, expansionism } = $line.dataset;
    const deityText = `"${deity}"`;
    const { origins } = pack.religions[+id!];
    const originList = (origins || [])
      .filter((origin: number) => origin)
      .map((origin: number) => pack.religions[origin].name);
    const originText = `"${originList.join(", ")}"`;
    return [id, name, color, type, form, deityText, area, population, originText, expansion, expansionism].join(",");
  });
  const csvData = [headers].concat(data).join("\n");

  const name = `${getFileName("Religions")}.csv`;
  downloadFile(csvData, name);
}

function highlightReligion(this: HTMLElement): void {
  const religionId = +(this.parentNode as HTMLElement).dataset.id!;
  const el = relig.select(`#religion${religionId}`).node() as Element | null;
  if (el) highlightElement(el, 4);
}

function updateLockStatus(this: HTMLElement): void {
  if (customization) return;

  const religionId = +(this.parentNode as HTMLElement).dataset.id!;
  const classList = this.classList;
  const r = pack.religions[religionId];
  r.lock = !r.lock;

  classList.toggle("icon-lock-open");
  classList.toggle("icon-lock");
}

function recalculateReligions(must?: boolean): void {
  if (!must && !ensureEl<HTMLInputElement>("religionsAutoChange").checked) return;

  Religions.recalculate();

  drawReligions();
  refreshReligionsEditor();
  drawReligionCenters();
}

function closeReligionsEditor(): void {
  debug.select("#religionCenters").remove();
  exitReligionsManualAssignment("close");
  exitAddReligionMode();
}

export const ReligionsEditor = { open };
