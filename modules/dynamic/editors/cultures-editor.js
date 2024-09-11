const $body = insertEditorHtml();
addListeners();

const cultureTypes = ["Generic", "River", "Lake", "Naval", "Nomadic", "Hunting", "Highland"];

export function open() {
  closeDialogs("#culturesEditor, .stable");
  if (!layerIsOn("toggleCultures")) toggleCultures();
  if (layerIsOn("toggleStates")) toggleStates();
  if (layerIsOn("toggleBiomes")) toggleBiomes();
  if (layerIsOn("toggleReligions")) toggleReligions();
  if (layerIsOn("toggleProvinces")) toggleProvinces();

  refreshCulturesEditor();

  $("#culturesEditor").dialog({
    title: "Cultures Editor",
    resizable: false,
    close: closeCulturesEditor,
    position: {my: "right top", at: "right-10 top+10", of: "svg"}
  });
  $body.focus();
}

function insertEditorHtml() {
  const editorHtml = /* html */ `<div id="culturesEditor" class="dialog stable">
    <div id="culturesHeader" class="header" style="grid-template-columns: 10em 7em 9em 4em 8em 5em 7em 8em">
      <div data-tip="Click to sort by culture name" class="sortable alphabetically" data-sortby="name">Culture&nbsp;</div>
      <div data-tip="Click to sort by type" class="sortable alphabetically" data-sortby="type">Type&nbsp;</div>
      <div data-tip="Click to sort by culture namesbase" class="sortable" data-sortby="base">Namesbase&nbsp;</div>
      <div data-tip="Click to sort by culture cells count" class="sortable hide" data-sortby="cells">Cells&nbsp;</div>
      <div data-tip="Click to sort by expansionism" class="sortable hide" data-sortby="expansionism">Expansion&nbsp;</div>
      <div data-tip="Click to sort by culture area" class="sortable hide" data-sortby="area">Area&nbsp;</div>
      <div data-tip="Click to sort by culture population" class="sortable hide icon-sort-number-down" data-sortby="population">Population&nbsp;</div>
      <div data-tip="Click to sort by culture emblems shape" class="sortable alphabetically hide" data-sortby="emblems">Emblems&nbsp;</div>
    </div>
    <div id="culturesBody" class="table" data-type="absolute"></div>

    <div id="culturesFooter" class="totalLine">
      <div data-tip="Cultures number" style="margin-left: 12px">Cultures:&nbsp;<span id="culturesFooterCultures">0</span></div>
      <div data-tip="Total land cells number" style="margin-left: 12px">Cells:&nbsp;<span id="culturesFooterCells">0</span></div>
      <div data-tip="Total land area" style="margin-left: 12px">Land Area:&nbsp;<span id="culturesFooterArea">0</span></div>
      <div data-tip="Total population" style="margin-left: 12px">Population:&nbsp;<span id="culturesFooterPopulation">0</span></div>
    </div>

    <div id="culturesBottom">
      <button id="culturesEditorRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
      <button id="culturesEditStyle" data-tip="Edit cultures style in Style Editor" class="icon-adjust"></button>
      <button id="culturesLegend" data-tip="Toggle Legend box" class="icon-list-bullet"></button>
      <button id="culturesPercentage" data-tip="Toggle percentage / absolute values display mode" class="icon-percent"></button>
      <button id="culturesHeirarchy" data-tip="Show cultures hierarchy tree" class="icon-sitemap"></button>
      <button id="culturesManually" data-tip="Manually re-assign cultures" class="icon-brush"></button>
      <div id="culturesManuallyButtons" style="display: none">
        <div data-tip="Change brush size. Shortcut: + to increase; – to decrease" style="margin-block: 0.3em;">
          <slider-input id="culturesBrush" min="1" max="100" value="15">Brush size:</slider-input>
        </div>
        <button id="culturesManuallyApply" data-tip="Apply assignment" class="icon-check"></button>
        <button id="culturesManuallyCancel" data-tip="Cancel assignment" class="icon-cancel"></button>
      </div>
      <button id="culturesEditNamesBase" data-tip="Edit a database used for names generation" class="icon-font"></button>
      <button id="culturesAdd" data-tip="Add a new culture. Hold Shift to add multiple" class="icon-plus"></button>
      <button id="culturesExport" data-tip="Download cultures-related data" class="icon-download"></button>
      <button id="culturesImport" data-tip="Upload cultures-related data" class="icon-upload"></button>
      <button id="culturesRecalculate" data-tip="Recalculate cultures based on current values of growth-related attributes" class="icon-retweet"></button>
      <span data-tip="Allow culture centers, expansion and type changes to take an immediate effect">
        <input id="culturesAutoChange" class="checkbox" type="checkbox" />
        <label for="culturesAutoChange" class="checkbox-label"><i>auto-apply changes</i></label>
      </span>
    </div>
  </div>`;

  byId("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  return byId("culturesBody");
}

function addListeners() {
  applySortingByHeader("culturesHeader");

  byId("culturesEditorRefresh").on("click", refreshCulturesEditor);
  byId("culturesEditStyle").on("click", () => editStyle("cults"));
  byId("culturesLegend").on("click", toggleLegend);
  byId("culturesPercentage").on("click", togglePercentageMode);
  byId("culturesHeirarchy").on("click", showHierarchy);
  byId("culturesRecalculate").on("click", () => recalculateCultures(true));
  byId("culturesManually").on("click", enterCultureManualAssignent);
  byId("culturesManuallyApply").on("click", applyCultureManualAssignent);
  byId("culturesManuallyCancel").on("click", () => exitCulturesManualAssignment());
  byId("culturesEditNamesBase").on("click", editNamesbase);
  byId("culturesAdd").on("click", enterAddCulturesMode);
  byId("culturesExport").on("click", downloadCulturesCsv);
  byId("culturesImport").on("click", () => byId("culturesCSVToLoad").click());
  byId("culturesCSVToLoad").on("change", uploadCulturesData);
}

function refreshCulturesEditor() {
  culturesCollectStatistics();
  culturesEditorAddLines();
  drawCultureCenters();
}

function culturesCollectStatistics() {
  const {cells, cultures, burgs} = pack;
  cultures.forEach(c => {
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

function culturesEditorAddLines() {
  const unit = getAreaUnit();
  let lines = "";
  let totalArea = 0;
  let totalPopulation = 0;

  const emblemShapeGroup = byId("emblemShape")?.selectedOptions[0]?.parentNode?.label;
  const selectShape = emblemShapeGroup === "Diversiform";

  for (const c of pack.cultures) {
    if (c.removed) continue;
    const area = getArea(c.area);
    const rural = c.rural * populationRate;
    const urban = c.urban * populationRate * urbanization;
    const population = rn(rural + urban);
    const populationTip = `Total population: ${si(population)}. Rural population: ${si(rural)}. Urban population: ${si(
      urban
    )}. Click to edit`;
    totalArea += area;
    totalPopulation += population;

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
          <svg width="11" height="11" class="placeholder"></svg>
          <input data-tip="Neutral culture name. Click and type to change" class="cultureName italic" style="width: 7em"
            value="${c.name}" autocorrect="off" spellcheck="false" />
          <span class="icon-cw placeholder"></span>
          <select class="cultureType placeholder">${getTypeOptions(c.type)}</select>
          <span data-tip="Click to re-generate names for burgs with this culture assigned" class="icon-arrows-cw hide"></span>
          <select data-tip="Culture namesbase. Click to change. Click on arrows to re-generate names"
            class="cultureBase">${getBaseOptions(c.base)}</select>
          <span data-tip="Cells count" class="icon-check-empty hide"></span>
          <div data-tip="Cells count" class="cultureCells hide" style="width: 4em">${c.cells}</div>
          <span class="icon-resize-full placeholder hide"></span>
          <input class="cultureExpan placeholder hide" type="number" />
          <span data-tip="Culture area" style="padding-right: 4px" class="icon-map-o hide"></span>
          <div data-tip="Culture area" class="cultureArea hide" style="width: 6em">${si(area)} ${unit}</div>
          <span data-tip="${populationTip}" class="icon-male hide"></span>
          <div data-tip="${populationTip}" class="culturePopulation hide pointer"
            style="width: 4em">${si(population)}</div>
          ${getShapeOptions(selectShape, c.shield)}
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
        <fill-box fill="${c.color}"></fill-box>
        <input data-tip="Culture name. Click and type to change" class="cultureName" style="width: 7em"
          value="${c.name}" autocorrect="off" spellcheck="false" />
        <span data-tip="Regenerate culture name" class="icon-cw hiddenIcon" style="visibility: hidden"></span>
        <select data-tip="Culture type. Defines growth model. Click to change"
          class="cultureType">${getTypeOptions(c.type)}</select>
        <span data-tip="Click to re-generate names for burgs with this culture assigned" class="icon-arrows-cw hide"></span>
        <select data-tip="Culture namesbase. Click to change. Click on arrows to re-generate names"
          class="cultureBase">${getBaseOptions(c.base)}</select>
        <span data-tip="Cells count" class="icon-check-empty hide"></span>
        <div data-tip="Cells count" class="cultureCells hide" style="width: 4em">${c.cells}</div>
        <span data-tip="Culture expansionism. Defines competitive size" class="icon-resize-full hide"></span>
        <input
          data-tip="Culture expansionism. Defines competitive size. Click to change, then click Recalculate to apply change"
          class="cultureExpan hide"
          type="number"
          min="0"
          max="99"
          step=".1"
          value=${c.expansionism}
        />
        <span data-tip="Culture area" style="padding-right: 4px" class="icon-map-o hide"></span>
        <div data-tip="Culture area" class="cultureArea hide" style="width: 6em">${si(area)} ${unit}</div>
        <span data-tip="${populationTip}" class="icon-male hide"></span>
        <div data-tip="${populationTip}" class="culturePopulation hide pointer"
          style="width: 4em">${si(population)}</div>
        ${getShapeOptions(selectShape, c.shield)}
        <span data-tip="Lock culture" class="icon-lock${c.lock ? "" : "-open"} hide"></span>
        <span data-tip="Remove culture" class="icon-trash-empty hide"></span>
      </div>`;
  }
  $body.innerHTML = lines;

  // update footer
  byId("culturesFooterCultures").innerHTML = pack.cultures.filter(c => c.i && !c.removed).length;
  byId("culturesFooterCells").innerHTML = pack.cells.h.filter(h => h >= 20).length;
  byId("culturesFooterArea").innerHTML = `${si(totalArea)} ${unit}`;
  byId("culturesFooterPopulation").innerHTML = si(totalPopulation);
  byId("culturesFooterArea").dataset.area = totalArea;
  byId("culturesFooterPopulation").dataset.population = totalPopulation;

  // add listeners
  $body.querySelectorAll(":scope > div").forEach($line => {
    $line.on("mouseenter", cultureHighlightOn);
    $line.on("mouseleave", cultureHighlightOff);
    $line.on("click", selectCultureOnLineClick);
  });
  $body.querySelectorAll("fill-box").forEach($el => $el.on("click", cultureChangeColor));
  $body.querySelectorAll("div > input.cultureName").forEach($el => $el.on("input", cultureChangeName));
  $body.querySelectorAll("div > span.icon-cw").forEach($el => $el.on("click", cultureRegenerateName));
  $body.querySelectorAll("div > input.cultureExpan").forEach($el => $el.on("change", cultureChangeExpansionism));
  $body.querySelectorAll("div > select.cultureType").forEach($el => $el.on("change", cultureChangeType));
  $body.querySelectorAll("div > select.cultureBase").forEach($el => $el.on("change", cultureChangeBase));
  $body.querySelectorAll("div > select.cultureEmblems").forEach($el => $el.on("change", cultureChangeEmblemsShape));
  $body.querySelectorAll("div > div.culturePopulation").forEach($el => $el.on("click", changePopulation));
  $body.querySelectorAll("div > span.icon-arrows-cw").forEach($el => $el.on("click", cultureRegenerateBurgs));
  $body.querySelectorAll("div > span.icon-trash-empty").forEach($el => $el.on("click", cultureRemovePrompt));
  $body.querySelectorAll("div > span.icon-lock").forEach($el => $el.on("click", updateLockStatus));
  $body.querySelectorAll("div > span.icon-lock-open").forEach($el => $el.on("click", updateLockStatus));

  const $culturesHeader = byId("culturesHeader");
  $culturesHeader.querySelector("div[data-sortby='emblems']").style.display = selectShape ? "inline-block" : "none";

  if ($body.dataset.type === "percentage") {
    $body.dataset.type = "absolute";
    togglePercentageMode();
  }
  applySorting($culturesHeader);
  $("#culturesEditor").dialog({width: fitContent()});
}

function getTypeOptions(type) {
  let options = "";
  cultureTypes.forEach(t => (options += `<option ${type === t ? "selected" : ""} value="${t}">${t}</option>`));
  return options;
}

function getBaseOptions(base) {
  let options = "";
  nameBases.forEach((n, i) => (options += `<option ${base === i ? "selected" : ""} value="${i}">${n.name}</option>`));
  return options;
}

function getShapeOptions(selectShape, selected) {
  if (!selectShape) return "";

  const shapes = Object.keys(COA.shields.types)
    .map(type => Object.keys(COA.shields[type]))
    .flat();
  const options = shapes.map(
    shape => `<option ${shape === selected ? "selected" : ""} value="${shape}">${capitalize(shape)}</option>`
  );
  return `<select data-tip="Emblem shape associated with culture. Click to change" class="cultureEmblems hide">${options}</select>`;
}

const cultureHighlightOn = debounce(event => {
  const cultureId = Number(event.id || event.target.dataset.id);

  if (!layerIsOn("toggleCultures")) return;
  if (customization) return;

  const animate = d3.transition().duration(2000).ease(d3.easeSinIn);
  cults
    .select("#culture" + cultureId)
    .raise()
    .transition(animate)
    .attr("stroke-width", 2.5)
    .attr("stroke", "#d0240f");
  debug
    .select("#cultureCenter" + cultureId)
    .raise()
    .transition(animate)
    .attr("r", 3)
    .attr("stroke", "#d0240f");
}, 200);

function cultureHighlightOff(event) {
  const cultureId = Number(event.id || event.target.dataset.id);

  if (!layerIsOn("toggleCultures")) return;
  cults
    .select("#culture" + cultureId)
    .transition()
    .attr("stroke-width", null)
    .attr("stroke", null);
  debug
    .select("#cultureCenter" + cultureId)
    .transition()
    .attr("r", 2)
    .attr("stroke", null);
}

function cultureChangeColor() {
  const $el = this;
  const currentFill = $el.getAttribute("fill");
  const cultureId = +$el.parentNode.dataset.id;

  const callback = newFill => {
    $el.fill = newFill;
    pack.cultures[cultureId].color = newFill;
    cults.select("#culture" + cultureId).attr("fill", newFill);
    debug.select("#cultureCenter" + cultureId).attr("fill", newFill);
  };

  openPicker(currentFill, callback);
}

function cultureChangeName() {
  const culture = +this.parentNode.dataset.id;
  this.parentNode.dataset.name = this.value;
  pack.cultures[culture].name = this.value;
  pack.cultures[culture].code = abbreviate(
    this.value,
    pack.cultures.map(c => c.code)
  );
}

function cultureRegenerateName() {
  const culture = +this.parentNode.dataset.id;
  const name = Names.getCultureShort(culture);
  this.parentNode.querySelector("input.cultureName").value = name;
  pack.cultures[culture].name = name;
}

function cultureChangeExpansionism() {
  const culture = +this.parentNode.dataset.id;
  this.parentNode.dataset.expansionism = this.value;
  pack.cultures[culture].expansionism = +this.value;
  recalculateCultures();
}

function cultureChangeType() {
  const culture = +this.parentNode.dataset.id;
  this.parentNode.dataset.type = this.value;
  pack.cultures[culture].type = this.value;
  recalculateCultures();
}

function cultureChangeBase() {
  const culture = +this.parentNode.dataset.id;
  const v = +this.value;
  this.parentNode.dataset.base = pack.cultures[culture].base = v;
}

function cultureChangeEmblemsShape() {
  const culture = +this.parentNode.dataset.id;
  const shape = this.value;
  this.parentNode.dataset.emblems = pack.cultures[culture].shield = shape;

  const rerenderCOA = (id, coa) => {
    const $coa = byId(id);
    if (!$coa) return; // not rendered
    $coa.remove();
    COArenderer.trigger(id, coa);
  };

  pack.states.forEach(state => {
    if (state.culture !== culture || !state.i || state.removed || !state.coa || state.coa.custom) return;
    if (shape === state.coa.shield) return;
    state.coa.shield = shape;
    rerenderCOA("stateCOA" + state.i, state.coa);
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
    rerenderCOA("provinceCOA" + province.i, province.coa);
  });

  pack.burgs.forEach(burg => {
    if (burg.culture !== culture || !burg.i || burg.removed || !burg.coa || burg.coa.custom) return;
    if (shape === burg.coa.shield) return;
    burg.coa.shield = shape;
    rerenderCOA("burgCOA" + burg.i, burg.coa);
  });
}

function changePopulation() {
  const cultureId = +this.parentNode.dataset.id;
  const culture = pack.cultures[cultureId];
  if (!culture.cells) return tip("Culture does not have any cells, cannot change population", false, "error");

  const rural = rn(culture.rural * populationRate);
  const urban = rn(culture.urban * populationRate * urbanization);
  const total = rural + urban;
  const format = n => Number(n).toLocaleString();
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

  const update = function () {
    const totalNew = ruralPop.valueAsNumber + urbanPop.valueAsNumber;
    if (isNaN(totalNew)) return;
    totalPop.innerHTML = l(totalNew);
    totalPopPerc.innerHTML = rn((totalNew / total) * 100);
  };

  ruralPop.oninput = () => update();
  urbanPop.oninput = () => update();

  $("#alert").dialog({
    resizable: false,
    title: "Change culture population",
    width: "24em",
    buttons: {
      Apply: function () {
        applyPopulationChange(rural, urban, ruralPop.value, urbanPop.value, cultureId);
        $(this).dialog("close");
      },
      Cancel: function () {
        $(this).dialog("close");
      }
    },
    position: {my: "center", at: "center", of: "svg"}
  });
}

function applyPopulationChange(oldRural, oldUrban, newRural, newUrban, culture) {
  const ruralChange = newRural / oldRural;
  if (isFinite(ruralChange) && ruralChange !== 1) {
    const cells = pack.cells.i.filter(i => pack.cells.culture[i] === culture);
    cells.forEach(i => (pack.cells.pop[i] *= ruralChange));
  }
  if (!isFinite(ruralChange) && +newRural > 0) {
    const points = newRural / populationRate;
    const cells = pack.cells.i.filter(i => pack.cells.culture[i] === culture);
    const pop = rn(points / cells.length);
    cells.forEach(i => (pack.cells.pop[i] = pop));
  }

  const burgs = pack.burgs.filter(b => !b.removed && b.culture === culture);
  const urbanChange = newUrban / oldUrban;
  if (isFinite(urbanChange) && urbanChange !== 1) {
    burgs.forEach(b => (b.population = rn(b.population * urbanChange, 4)));
  }
  if (!isFinite(urbanChange) && +newUrban > 0) {
    const points = newUrban / populationRate / urbanization;
    const population = rn(points / burgs.length, 4);
    burgs.forEach(b => (b.population = population));
  }

  refreshCulturesEditor();
}

function cultureRegenerateBurgs() {
  if (customization === 4) return;

  const cultureId = +this.parentNode.dataset.id;
  const cBurgs = pack.burgs.filter(b => b.culture === cultureId && !b.lock);
  cBurgs.forEach(b => {
    b.name = Names.getCulture(cultureId);
    labels.select("[data-id='" + b.i + "']").text(b.name);
  });
  tip(`Names for ${cBurgs.length} burgs are regenerated`, false, "success");
}

function removeCulture(cultureId) {
  cults.select("#culture" + cultureId).remove();
  debug.select("#cultureCenter" + cultureId).remove();

  const {burgs, states, cells, cultures} = pack;

  burgs.filter(b => b.culture == cultureId).forEach(b => (b.culture = 0));
  states.forEach(s => {
    if (s.culture === cultureId) s.culture = 0;
  });
  cells.culture.forEach((c, i) => {
    if (c === cultureId) cells.culture[i] = 0;
  });
  cultures[cultureId].removed = true;

  cultures
    .filter(c => c.i && !c.removed)
    .forEach(c => {
      c.origins = c.origins.filter(origin => origin !== cultureId);
      if (!c.origins.length) c.origins = [0];
    });
  refreshCulturesEditor();
}

function cultureRemovePrompt() {
  if (customization) return;

  const cultureId = +this.parentNode.dataset.id;
  confirmationDialog({
    title: "Remove culture",
    message: "Are you sure you want to remove the culture? <br>This action cannot be reverted",
    confirm: "Remove",
    onConfirm: () => removeCulture(cultureId)
  });
}

function drawCultureCenters() {
  const tooltip = "Drag to move the culture center (ancestral home)";
  debug.select("#cultureCenters").remove();
  const cultureCenters = debug
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
    .attr("id", d => "cultureCenter" + d.i)
    .attr("data-id", d => d.i)
    .attr("r", 2)
    .attr("fill", d => d.color)
    .attr("cx", d => pack.cells.p[d.center][0])
    .attr("cy", d => pack.cells.p[d.center][1])
    .on("mouseenter", d => {
      tip(tooltip, true);
      $body.querySelector(`div[data-id='${d.i}']`).classList.add("selected");
      cultureHighlightOn(event);
    })
    .on("mouseleave", d => {
      tip("", true);
      $body.querySelector(`div[data-id='${d.i}']`).classList.remove("selected");
      cultureHighlightOff(event);
    })
    .call(d3.drag().on("start", cultureCenterDrag));
}

function cultureCenterDrag() {
  const cultureId = +this.id.slice(13);
  const tr = parseTransform(this.getAttribute("transform"));
  const x0 = +tr[0] - d3.event.x;
  const y0 = +tr[1] - d3.event.y;

  function handleDrag() {
    const {x, y} = d3.event;
    this.setAttribute("transform", `translate(${x0 + x},${y0 + y})`);
    const cell = findCell(x, y);
    if (pack.cells.h[cell] < 20) return; // ignore dragging on water

    pack.cultures[cultureId].center = cell;
    recalculateCultures();
  }

  const dragDebounced = debounce(handleDrag, 50);
  d3.event.on("drag", dragDebounced);
}

function toggleLegend() {
  if (legend.selectAll("*").size()) return clearLegend();

  const data = pack.cultures
    .filter(c => c.i && !c.removed && c.cells)
    .sort((a, b) => b.area - a.area)
    .map(c => [c.i, c.color, c.name]);
  drawLegend("Cultures", data);
}

function togglePercentageMode() {
  if ($body.dataset.type === "absolute") {
    $body.dataset.type = "percentage";
    const totalCells = +byId("culturesFooterCells").innerText;
    const totalArea = +byId("culturesFooterArea").dataset.area;
    const totalPopulation = +byId("culturesFooterPopulation").dataset.population;

    $body.querySelectorAll(":scope > div").forEach(function (el) {
      const {cells, area, population} = el.dataset;
      el.querySelector(".cultureCells").innerText = rn((+cells / totalCells) * 100) + "%";
      el.querySelector(".cultureArea").innerText = rn((+area / totalArea) * 100) + "%";
      el.querySelector(".culturePopulation").innerText = rn((+population / totalPopulation) * 100) + "%";
    });
  } else {
    $body.dataset.type = "absolute";
    culturesEditorAddLines();
  }
}

async function showHierarchy() {
  if (customization) return;
  const HeirarchyTree = await import("../hierarchy-tree.js?v=1.88.06");

  const getDescription = culture => {
    const {name, type, rural, urban} = culture;

    const population = rural * populationRate + urban * populationRate * urbanization;
    const populationText = population > 0 ? si(rn(population)) + " people" : "Extinct";
    return `${name} culture. ${type}. ${populationText}`;
  };

  const getShape = ({type}) => {
    if (type === "Generic") return "circle";
    if (type === "River") return "diamond";
    if (type === "Lake") return "hexagon";
    if (type === "Naval") return "square";
    if (type === "Highland") return "concave";
    if (type === "Nomadic") return "octagon";
    if (type === "Hunting") return "pentagon";
  };

  HeirarchyTree.open({
    type: "cultures",
    data: pack.cultures,
    onNodeEnter: cultureHighlightOn,
    onNodeLeave: cultureHighlightOff,
    getDescription,
    getShape
  });
}

function recalculateCultures(force) {
  if (force || culturesAutoChange.checked) {
    Cultures.expand();
    drawCultures();
    pack.burgs.forEach(b => (b.culture = pack.cells.culture[b.cell]));
    refreshCulturesEditor();
  }
}

function enterCultureManualAssignent() {
  if (!layerIsOn("toggleCultures")) toggleCultures();
  customization = 4;
  cults.append("g").attr("id", "temp");
  document.querySelectorAll("#culturesBottom > *").forEach(el => (el.style.display = "none"));
  byId("culturesManuallyButtons").style.display = "inline-block";
  debug.select("#cultureCenters").style("display", "none");

  culturesEditor.querySelectorAll(".hide").forEach(el => el.classList.add("hidden"));
  culturesFooter.style.display = "none";
  $body.querySelectorAll("div > input, select, span, svg").forEach(e => (e.style.pointerEvents = "none"));
  $("#culturesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg"}});

  tip("Click on culture to select, drag the circle to change culture", true);
  viewbox
    .style("cursor", "crosshair")
    .on("click", selectCultureOnMapClick)
    .call(d3.drag().on("start", dragCultureBrush))
    .on("touchmove mousemove", moveCultureBrush);

  $body.querySelector("div").classList.add("selected");
}

function selectCultureOnLineClick(i) {
  if (customization !== 4) return;
  $body.querySelector("div.selected").classList.remove("selected");
  this.classList.add("selected");
}

function selectCultureOnMapClick() {
  const point = d3.mouse(this);
  const i = findCell(point[0], point[1]);
  if (pack.cells.h[i] < 20) return;

  const assigned = cults.select("#temp").select("polygon[data-cell='" + i + "']");
  const culture = assigned.size() ? +assigned.attr("data-culture") : pack.cells.culture[i];

  $body.querySelector("div.selected").classList.remove("selected");
  $body.querySelector("div[data-id='" + culture + "']").classList.add("selected");
}

function dragCultureBrush() {
  const radius = +culturesBrush.value;

  d3.event.on("drag", () => {
    if (!d3.event.dx && !d3.event.dy) return;
    const p = d3.mouse(this);
    moveCircle(p[0], p[1], radius);

    const found = radius > 5 ? findAll(p[0], p[1], radius) : [findCell(p[0], p[1], radius)];
    const selection = found.filter(isLand);
    if (selection) changeCultureForSelection(selection);
  });
}

function changeCultureForSelection(selection) {
  const temp = cults.select("#temp");
  const selected = $body.querySelector("div.selected");

  const cultureNew = +selected.dataset.id;
  const color = pack.cultures[cultureNew].color || "#ffffff";

  selection.forEach(function (i) {
    const exists = temp.select("polygon[data-cell='" + i + "']");
    const cultureOld = exists.size() ? +exists.attr("data-culture") : pack.cells.culture[i];
    if (cultureNew === cultureOld) return;

    // change of append new element
    if (exists.size()) exists.attr("data-culture", cultureNew).attr("fill", color).attr("stroke", color);
    else
      temp
        .append("polygon")
        .attr("data-cell", i)
        .attr("data-culture", cultureNew)
        .attr("points", getPackPolygon(i))
        .attr("fill", color)
        .attr("stroke", color);
  });
}

function moveCultureBrush() {
  showMainTip();
  const point = d3.mouse(this);
  const radius = +culturesBrush.value;
  moveCircle(point[0], point[1], radius);
}

function applyCultureManualAssignent() {
  const changed = cults.select("#temp").selectAll("polygon");
  changed.each(function () {
    const i = +this.dataset.cell;
    const c = +this.dataset.culture;
    pack.cells.culture[i] = c;
    if (pack.cells.burg[i]) pack.burgs[pack.cells.burg[i]].culture = c;
  });

  if (changed.size()) {
    drawCultures();
    refreshCulturesEditor();
  }
  exitCulturesManualAssignment();
}

function exitCulturesManualAssignment(close) {
  customization = 0;
  cults.select("#temp").remove();
  removeCircle();
  document.querySelectorAll("#culturesBottom > *").forEach(el => (el.style.display = "inline-block"));
  byId("culturesManuallyButtons").style.display = "none";

  culturesEditor.querySelectorAll(".hide").forEach(el => el.classList.remove("hidden"));
  culturesFooter.style.display = "block";
  $body.querySelectorAll("div > input, select, span, svg").forEach(e => (e.style.pointerEvents = "all"));
  if (!close) $("#culturesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg"}});

  debug.select("#cultureCenters").style("display", null);
  restoreDefaultEvents();
  clearMainTip();
  const selected = $body.querySelector("div.selected");
  if (selected) selected.classList.remove("selected");
}

function enterAddCulturesMode() {
  if (this.classList.contains("pressed")) return exitAddCultureMode();

  customization = 9;
  this.classList.add("pressed");
  tip("Click on the map to add a new culture", true);
  viewbox.style("cursor", "crosshair").on("click", addCulture);
  $body.querySelectorAll("div > input, select, span, svg").forEach(e => (e.style.pointerEvents = "none"));
}

function exitAddCultureMode() {
  customization = 0;
  restoreDefaultEvents();
  clearMainTip();
  $body.querySelectorAll("div > input, select, span, svg").forEach(e => (e.style.pointerEvents = "all"));
  if (culturesAdd.classList.contains("pressed")) culturesAdd.classList.remove("pressed");
}

function addCulture() {
  const point = d3.mouse(this);
  const center = findCell(point[0], point[1]);

  if (pack.cells.h[center] < 20)
    return tip("You cannot place culture center into the water. Please click on a land cell", false, "error");

  const occupied = pack.cultures.some(c => !c.removed && c.center === center);
  if (occupied) return tip("This cell is already a culture center. Please select a different cell", false, "error");

  if (d3.event.shiftKey === false) exitAddCultureMode();
  Cultures.add(center);

  drawCultureCenters();
  culturesEditorAddLines();
}

function downloadCulturesCsv() {
  const unit = getAreaUnit("2");
  const headers = `Id,Name,Color,Cells,Expansionism,Type,Area ${unit},Population,Namesbase,Emblems Shape,Origins`;
  const lines = Array.from($body.querySelectorAll(":scope > div"));
  const data = lines.map($line => {
    const {id, name, color, cells, expansionism, type, area, population, emblems, base} = $line.dataset;
    const namesbase = nameBases[+base].name;
    const {origins} = pack.cultures[+id];
    const originList = origins.filter(origin => origin).map(origin => pack.cultures[origin].name);
    const originText = '"' + originList.join(", ") + '"';
    return [id, name, color, cells, expansionism, type, area, population, namesbase, emblems, originText].join(",");
  });
  const csvData = [headers].concat(data).join("\n");

  const name = getFileName("Cultures") + ".csv";
  downloadFile(csvData, name);
}

function closeCulturesEditor() {
  debug.select("#cultureCenters").remove();
  exitCulturesManualAssignment("close");
  exitAddCultureMode();
}

async function uploadCulturesData() {
  const file = this.files[0];
  this.value = "";
  const csv = await file.text();
  const data = d3.csvParse(csv, d => ({
    i: +d.Id,
    name: d.Name,
    color: d.Color,
    expansionism: +d.Expansionism,
    type: d.Type,
    population: +d.Population,
    emblemsShape: d["Emblems Shape"],
    origins: d.Origins
  }));

  const {cultures, cells} = pack;
  const shapes = Object.keys(COA.shields.types)
    .map(type => Object.keys(COA.shields[type]))
    .flat();

  const populated = cells.pop.map((c, i) => (c ? i : null)).filter(c => c);
  cultures.forEach(item => {
    if (item.i) item.removed = true;
  });

  for (const culture of data) {
    let current;
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
      current = {i: cultures.length, center: ra(populated), area: 0, cells: 0, origin: 0, rural: 0, urban: 0};
      cultures.push(current);
    }

    current.removed = false;
    current.name = culture.name;

    if (current.i) {
      current.code = abbreviate(
        current.name,
        cultures.map(c => c.code)
      );

      current.color = culture.color;
      current.expansionism = +culture.expansionism;

      if (cultureTypes.includes(culture.type)) current.type = culture.type;
      else current.type = "Generic";
    }

    function restoreOrigins(originsString) {
      const originNames = originsString
        .replaceAll('"', "")
        .split(",")
        .map(s => s.trim())
        .filter(s => s);

      const originIds = originNames.map(name => {
        const id = cultures.findIndex(c => c.name === name);
        return id === -1 ? null : id;
      });

      current.origins = originIds.filter(id => id !== null);
      if (!current.origins.length) current.origins = [0];
    }

    culture.origins = current.i ? restoreOrigins(culture.origins || "") : [null];
    current.shield = shapes.includes(culture.emblemsShape) ? culture.emblemsShape : "heater";

    const nameBaseIndex = nameBases.findIndex(n => n.name == culture.namesbase);
    current.base = nameBaseIndex === -1 ? 0 : nameBaseIndex;
  }

  cultures.filter(c => c.removed).forEach(c => removeCulture(c.i));

  drawCultures();
  refreshCulturesEditor();
}

function updateLockStatus() {
  if (customization) return;

  const cultureId = +this.parentNode.dataset.id;
  const classList = this.classList;
  const c = pack.cultures[cultureId];
  c.lock = !c.lock;

  classList.toggle("icon-lock-open");
  classList.toggle("icon-lock");
}
