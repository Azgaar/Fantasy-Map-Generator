"use strict";
function editStates() {
  if (customization) return;
  closeDialogs("#statesEditor, .stable");
  if (!layerIsOn("toggleStates")) toggleStates();
  if (!layerIsOn("toggleBorders")) toggleBorders();
  if (layerIsOn("toggleCultures")) toggleCultures();
  if (layerIsOn("toggleBiomes")) toggleBiomes();
  if (layerIsOn("toggleReligions")) toggleReligions();
  if (layerIsOn("toggleTexture")) toggleTexture();

  const body = document.getElementById("statesBodySection");
  refreshStatesEditor();

  if (modules.editStates) return;
  modules.editStates = true;

  $("#statesEditor").dialog({
    title: "States Editor", resizable: false, width: fitContent(), close: closeStatesEditor,
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  // add listeners
  document.getElementById("statesEditorRefresh").addEventListener("click", refreshStatesEditor);
  document.getElementById("statesLegend").addEventListener("click", toggleLegend);
  document.getElementById("statesPercentage").addEventListener("click", togglePercentageMode);
  document.getElementById("statesRegenerate").addEventListener("click", openRegenerationMenu);
  document.getElementById("statesRegenerateBack").addEventListener("click", exitRegenerationMenu);
  document.getElementById("statesRecalculate").addEventListener("click", () => recalculateStates(true));
  document.getElementById("statesRandomize").addEventListener("click", randomizeStatesExpansion);
  document.getElementById("statesNeutral").addEventListener("input", () => recalculateStates(false));
  document.getElementById("statesNeutralNumber").addEventListener("change", () => recalculateStates(false));
  document.getElementById("statesManually").addEventListener("click", enterStatesManualAssignent);
  document.getElementById("statesManuallyApply").addEventListener("click", applyStatesManualAssignent);
  document.getElementById("statesManuallyCancel").addEventListener("click", () => exitStatesManualAssignment());
  document.getElementById("statesAdd").addEventListener("click", enterAddStateMode);
  document.getElementById("statesExport").addEventListener("click", downloadStatesData);

  body.addEventListener("click", function(ev) {
    const el = ev.target, cl = el.classList, line = el.parentNode, state = +line.dataset.id;
    if (cl.contains("zoneFill")) stateChangeFill(el); else
    if (cl.contains("icon-fleur")) stateOpenCOA(state); else
    if (cl.contains("icon-star-empty")) stateCapitalZoomIn(state); else
    if (cl.contains("icon-pin")) focusOnState(state, cl); else
    if (cl.contains("icon-trash-empty")) stateRemove(state); else
    if (cl.contains("hoverButton") && cl.contains("stateName")) regenerateName(state, line); else
    if (cl.contains("hoverButton") && cl.contains("stateForm")) regenerateForm(state, line);
  });

  body.addEventListener("input", function(ev) {
    const el = ev.target, cl = el.classList, line = el.parentNode, state = +line.dataset.id;
    if (cl.contains("stateName")) stateChangeName(state, line, el.value); else
    if (cl.contains("stateForm")) stateChangeForm(state, line, el.value); else
    if (cl.contains("stateCapital")) stateChangeCapitalName(state, line, el.value); else
    if (cl.contains("cultureType")) stateChangeType(state, line, el.value); else
    if (cl.contains("stateCulture")) stateChangeCulture(state, line, el.value); else
    if (cl.contains("statePower")) stateChangeExpansionism(state, line, el.value);
  });

  function refreshStatesEditor() {
    BurgsAndStates.collectStatistics();
    statesEditorAddLines();
  }

  // add line for each state
  function statesEditorAddLines() {
    const unit = areaUnit.value === "square" ? " " + distanceUnitInput.value + "²" : " " + areaUnit.value;
    const hidden = statesRegenerateButtons.style.display === "block" ? "" : "hidden"; // show/hide regenerate columns
    let lines = "", totalArea = 0, totalPopulation = 0, totalBurgs = 0;

    for (const s of pack.states) {
      if (s.removed) continue;
      const area = s.area * (distanceScaleInput.value ** 2);
      const rural = s.rural * populationRate.value;
      const urban = s.urban * populationRate.value * urbanization.value;
      const population = rn(rural + urban);
      const populationTip = `Total population: ${si(population)}; Rural population: ${si(rural)}; Urban population: ${si(urban)}`;
      totalArea += area;
      totalPopulation += population;
      totalBurgs += s.burgs;
      const focused = defs.select("#fog #focusState"+s.i).size();

      if (!s.i) {
        // Neutral line
        lines += `<div class="states" data-id=${s.i} data-name="${s.name}" data-cells=${s.cells} data-area=${area} 
        data-population=${population} data-burgs=${s.burgs} data-color="" data-form="" data-capital="" data-culture="" data-type="" data-expansionism="">
          <svg width="9" height="9" class="placeholder"></svg>
          <input data-tip="State name. Click and type to change" class="stateName italic" value="${s.name}" autocorrect="off" spellcheck="false">
          <span class="icon-fleur placeholder hide"></span>
          <input class="stateForm placeholder" value="none">
          <span class="icon-star-empty placeholder hide"></span>
          <input class="stateCapital placeholder hide">
          <select class="stateCulture placeholder hide">${getCultureOptions(0)}</select>
          <span data-tip="Burgs count" style="padding-right: 1px" class="icon-dot-circled hide"></span>
          <div data-tip="Burgs count" class="stateBurgs hide">${s.burgs}</div>
          <span data-tip="State area" style="padding-right: 4px" class="icon-map-o hide"></span>
          <div data-tip="State area" class="biomeArea hide">${si(area) + unit}</div>
          <span data-tip="${populationTip}" class="icon-male hide"></span>
          <div data-tip="${populationTip}" class="culturePopulation hide">${si(population)}</div>
          <select class="cultureType ${hidden} placeholder show hide">${getTypeOptions(0)}</select>
          <span class="icon-resize-full ${hidden} placeholder show hide"></span>
          <input class="statePower ${hidden} placeholder show hide" type="number" value=0>
          <span data-tip="Cells count" class="icon-check-empty ${hidden} show hide"></span>
          <div data-tip="Cells count" class="stateCells ${hidden} show hide">${s.cells}</div>
        </div>`;
        continue;
      }
      const capital = pack.burgs[s.capital].name;
      lines += `<div class="states" data-id=${s.i} data-name="${s.name}" data-form="${s.formName}" data-capital="${capital}" data-color="${s.color}" data-cells=${s.cells}
        data-area=${area} data-population=${population} data-burgs=${s.burgs} data-culture=${pack.cultures[s.culture].name} data-type=${s.type} data-expansionism=${s.expansionism}>
        <svg data-tip="State fill style. Click to change" width=".9em" height=".9em" style="margin-bottom:-1px"><rect x="0" y="0" width="100%" height="100%" fill="${s.color}" class="zoneFill"></svg>
        <input data-tip="State name. Click and type to change" class="stateName" value="${s.name}" autocorrect="off" spellcheck="false">
        <span data-tip="Click to re-generate name" class="icon-arrows-cw stateName hoverButton placeholder"></span>
        <span data-tip="Click to open state COA in the Iron Arachne Heraldry Generator" class="icon-fleur pointer hide"></span>
        <input data-tip="State form name. Click and type to change" class="stateForm" value="${s.formName}" autocorrect="off" spellcheck="false">
        <span data-tip="Click to re-generate form name" class="icon-arrows-cw stateForm hoverButton placeholder"></span>
        <span data-tip="State capital. Click to zoom into view" class="icon-star-empty pointer hide"></span>
        <input data-tip="Capital name. Click and type to rename" class="stateCapital hide" value="${capital}" autocorrect="off" spellcheck="false"/>
        <select data-tip="Dominant culture. Click to change" class="stateCulture hide">${getCultureOptions(s.culture)}</select>
        <span data-tip="Burgs count" style="padding-right: 1px" class="icon-dot-circled hide"></span>
        <div data-tip="Burgs count" class="stateBurgs hide">${s.burgs}</div>
        <span data-tip="State area" style="padding-right: 4px" class="icon-map-o hide"></span>
        <div data-tip="State area" class="biomeArea hide">${si(area) + unit}</div>
        <span data-tip="${populationTip}" class="icon-male hide"></span>
        <div data-tip="${populationTip}" class="culturePopulation hide">${si(population)}</div>
        <select data-tip="State type. Defines growth model. Click to change" class="cultureType ${hidden} show hide">${getTypeOptions(s.type)}</select>
        <span data-tip="State expansionism" class="icon-resize-full ${hidden} show hide"></span>
        <input data-tip="Expansionism (defines competitive size). Change to re-calculate states based on new value" class="statePower ${hidden} show hide" type="number" min=0 max=99 step=.1 value=${s.expansionism}>
        <span data-tip="Cells count" class="icon-check-empty ${hidden} show hide"></span>
        <div data-tip="Cells count" class="stateCells ${hidden} show hide">${s.cells}</div>
        <span data-tip="Toggle state focus" class="icon-pin ${focused?'':' inactive'} hide"></span>
        <span data-tip="Remove the state" class="icon-trash-empty hide"></span>
      </div>`;
    }
    body.innerHTML = lines;

    // update footer
    statesFooterStates.innerHTML = pack.states.filter(s => s.i && !s.removed).length;
    statesFooterCells.innerHTML = pack.cells.h.filter(h => h >= 20).length;
    statesFooterBurgs.innerHTML = totalBurgs;
    statesFooterArea.innerHTML = si(totalArea) + unit;
    statesFooterPopulation.innerHTML = si(totalPopulation);
    statesFooterArea.dataset.area = totalArea;
    statesFooterPopulation.dataset.population = totalPopulation;

    body.querySelectorAll("div.states").forEach(el => {
      el.addEventListener("click", selectStateOnLineClick);
      el.addEventListener("mouseenter", ev => stateHighlightOn(ev));
      el.addEventListener("mouseleave", ev => stateHighlightOff(ev));
    });

    if (body.dataset.type === "percentage") {body.dataset.type = "absolute"; togglePercentageMode();}
    applySorting(statesHeader);
    $("#statesEditor").dialog({width: fitContent()});
  }
  
  function getCultureOptions(culture) {
    let options = "";
    pack.cultures.slice(1).forEach(c => options += `<option ${c.i === culture ? "selected" : ""} value="${c.i}">${c.name}</option>`);
    return options;
  }

  function getTypeOptions(type) {
    let options = "";
    const types = ["Generic", "River", "Lake", "Naval", "Nomadic", "Hunting", "Highland"];
    types.forEach(t => options += `<option ${type === t ? "selected" : ""} value="${t}">${t}</option>`);
    return options;
  }

  function stateHighlightOn(event) {
    if (!customization) event.target.querySelectorAll(".hoverButton").forEach(el => el.classList.remove("placeholder"));
    if (!layerIsOn("toggleStates")) return;
    const state = +event.target.dataset.id;
    if (customization || !state) return;
    const path = statesBody.select("#state"+state).attr("d");
    debug.append("path").attr("class", "highlight").attr("d", path)
      .attr("fill", "none").attr("stroke", "red").attr("stroke-width", 1).attr("opacity", 1)
      .attr("filter", "url(#blur1)").call(transition);
  }

  function transition(path) {
    const duration = (path.node().getTotalLength() + 5000) / 2;
    path.transition().duration(duration).attrTween("stroke-dasharray", tweenDash);
  }

  function tweenDash() {
    const l = this.getTotalLength();
    const i = d3.interpolateString("0," + l, l + "," + l);
    return t => i(t);
  }
  
  function removePath(path) {
    path.transition().duration(1000).attr("opacity", 0).remove();
  }

  function stateHighlightOff() {
    event.target.querySelectorAll(".hoverButton").forEach(el => el.classList.add("placeholder"));
    debug.selectAll(".highlight").each(function(el) {
      d3.select(this).call(removePath);
    });
  }

  function stateChangeFill(el) {
    const currentFill = el.getAttribute("fill");
    const state = +el.parentNode.parentNode.dataset.id;

    const callback = function(fill) {
      el.setAttribute("fill", fill);
      pack.states[state].color = fill;
      statesBody.select("#state"+state).attr("fill", fill);
      statesBody.select("#state-gap"+state).attr("stroke", fill);
      const halo = d3.color(fill) ? d3.color(fill).darker().hex() : "#666666";
      statesHalo.select("#state-border"+state).attr("stroke", halo);
    }

    openPicker(currentFill, callback);
  }

  function stateChangeName(state, line, value) {
    const oldName = pack.states[state].name;
    pack.states[state].name = line.dataset.name = value;
    pack.states[state].fullName = BurgsAndStates.getFullName(pack.states[state]);
    changeLabel(state, oldName, value);
  }

  function regenerateName(state, line) {
    const culture = pack.states[state].culture;
    const oldName = pack.states[state].name;
    const newName = Names.getState(Names.getCultureShort(culture), culture);
    pack.states[state].name = line.dataset.name = line.querySelector(".stateName").value = newName;
    pack.states[state].fullName = BurgsAndStates.getFullName(pack.states[state]);
    changeLabel(state, oldName, newName);
  }

  function stateChangeForm(state, line, value) {
    const oldForm = pack.states[state].formName;
    pack.states[state].formName = line.dataset.form = value;
    pack.states[state].fullName = BurgsAndStates.getFullName(pack.states[state]);
    changeLabel(state, oldForm, value, true);
  }

  function regenerateForm(state, line) {
    const oldForm = pack.states[state].formName;
    let newForm = oldForm;

    for (let i=0; newForm === oldForm && i < 50; i++) {
      BurgsAndStates.defineStateForms([state]);
      newForm = pack.states[state].formName;
    }

    line.dataset.form = line.querySelector(".stateForm").value = newForm;
    changeLabel(state, oldForm, newForm, true);
  }

  function changeLabel(state, oldName, newName, form) {
    const label = document.getElementById("stateLabel"+state);
    if (!label) return;

    const tspan = Array.from(label.querySelectorAll('tspan'));
    const tspanAdj = !form && oldName && newName && pack.states[state].formName ? tspan.find(el => el.textContent.includes(getAdjective(oldName))) : null;
    const tspanName = tspanAdj || !oldName || !newName ? null : tspan.find(el => el.textContent.includes(oldName));

    if (tspanAdj) {
      tspanAdj.textContent = tspanAdj.textContent.replace(getAdjective(oldName), getAdjective(newName));
      const l = tspanAdj.getComputedTextLength();
      tspanAdj.setAttribute("x", l / -2);
    } if (tspanName) {
      tspanName.textContent = tspanName.textContent.replace(oldName, newName);
      const l = tspanName.getComputedTextLength();
      tspanName.setAttribute("x", l / -2);
    } else {
      BurgsAndStates.drawStateLabels([state]);
    }

    tip("State label is automatically changed. To make a custom change click on a label and edit the text there", false, "warn");
  }

  function stateChangeCapitalName(state, line, value) {
    line.dataset.capital = value;
    const capital = pack.states[state].capital;
    if (!capital) return;
    pack.burgs[capital].name = value;
    document.querySelector("#burgLabel"+capital).textContent = value;
  }

  function stateOpenCOA(state) {
    const url = `https://ironarachne.com/heraldry/${seed}-s${state}`;
    window.open(url, '_blank');
  }

  function stateCapitalZoomIn(state) {
    const capital = pack.states[state].capital;
    const l = burgLabels.select("[data-id='" + capital + "']");
    const x = +l.attr("x"), y = +l.attr("y");
    zoomTo(x, y, 8, 2000);
  }

  function stateChangeCulture(state, line, value) {
    line.dataset.base = pack.states[state].culture = +value;
  }

  function stateChangeType(state, line, value) {
    line.dataset.type = pack.states[state].type = value;
    recalculateStates();
  }

  function stateChangeExpansionism(state, line, value) {
    line.dataset.expansionism = pack.states[state].expansionism  = value;
    recalculateStates();
  }

  function focusOnState(state, cl) {
    if (customization) return;

    const inactive = cl.contains("inactive");
    cl.toggle("inactive");

    if (inactive) {
      if (defs.select("#fog #focusState"+state).size()) return;
      fogging.attr("display", "block");
      const path = statesBody.select("#state"+state).attr("d");
      defs.select("#fog").append("path").attr("d", path).attr("fill", "black").attr("id", "focusState"+state);
      fogging.append("path").attr("d", path).attr("id", "focusStateHalo"+state)
        .attr("fill", "none").attr("stroke", pack.states[state].color).attr("filter", "url(#blur5)");
    } else unfocus(state);
  }

  function unfocus(s) {
    defs.select("#focusState"+s).remove();
    fogging.select("#focusStateHalo"+s).remove();
    if (!defs.selectAll("#fog path").size()) fogging.attr("display", "none"); // all items are de-focused
  }

  function stateRemove(state) {
    if (customization) return;
    statesBody.select("#state"+state).remove();
    statesBody.select("#state-gap"+state).remove();
    statesHalo.select("#state-border"+state).remove();
    unfocus(state);
    const label = document.querySelector("#stateLabel"+state);
    if (label) label.remove();
    pack.burgs.forEach(b => {if(b.state === state) b.state = 0;});
    pack.cells.state.forEach((s, i) => {if(s === state) pack.cells.state[i] = 0;});
    pack.states[state].removed = true;

    // remove provinces
    pack.states[state].provinces.forEach(p => {
      pack.provinces[p].removed = true;
      pack.cells.province.forEach((pr, i) => {if(pr === p) pack.cells.province[i] = 0;});
    });

    const capital = pack.states[state].capital;
    pack.burgs[capital].capital = false;
    pack.burgs[capital].state = 0;
    moveBurgToGroup(capital, "towns");

    debug.selectAll(".highlight").remove();
    if (!layerIsOn("toggleStates")) toggleStates(); else drawStates();
    if (!layerIsOn("toggleBorders")) toggleBorders(); else drawBorders();
    if (layerIsOn("toggleProvinces")) drawProvinces();
    refreshStatesEditor();
  }

  function toggleLegend() {
    if (legend.selectAll("*").size()) {clearLegend(); return;}; // hide legend
    const data = pack.states.filter(s => s.i && !s.removed && s.cells).sort((a, b) => b.area - a.area).map(s => [s.i, s.color, s.name]);
    drawLegend("States", data);
  }

  function togglePercentageMode() {
    if (body.dataset.type === "absolute") {
      body.dataset.type = "percentage";
      const totalCells = +statesFooterCells.innerHTML;
      const totalBurgs = +statesFooterBurgs.innerHTML;
      const totalArea = +statesFooterArea.dataset.area;
      const totalPopulation = +statesFooterPopulation.dataset.population;

      body.querySelectorAll(":scope > div").forEach(function(el) {
        el.querySelector(".stateCells").innerHTML = rn(+el.dataset.cells / totalCells * 100) + "%";
        el.querySelector(".stateBurgs").innerHTML = rn(+el.dataset.burgs / totalBurgs * 100) + "%";
        el.querySelector(".biomeArea").innerHTML = rn(+el.dataset.area / totalArea * 100) + "%";
        el.querySelector(".culturePopulation").innerHTML = rn(+el.dataset.population / totalPopulation * 100) + "%";
      });
    } else {
      body.dataset.type = "absolute";
      statesEditorAddLines();
    }
  }

  function openRegenerationMenu() {
    statesBottom.querySelectorAll(":scope > button").forEach(el => el.style.display = "none");
    statesRegenerateButtons.style.display = "block";

    statesEditor.querySelectorAll(".show").forEach(el => el.classList.remove("hidden"));
    $("#statesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}});
  }

  function recalculateStates(must) {
    if (!must && !statesAutoChange.checked) return;

    BurgsAndStates.expandStates();
    BurgsAndStates.generateProvinces();
    if (!layerIsOn("toggleStates")) toggleStates(); else drawStates();
    if (!layerIsOn("toggleBorders")) toggleBorders(); else drawBorders();
    if (layerIsOn("toggleProvinces")) drawProvinces();
    if (adjustLabels.checked) BurgsAndStates.drawStateLabels();
    refreshStatesEditor();
  }

  function randomizeStatesExpansion() {
    pack.states.forEach(s => {
      if (!s.i || s.removed) return;
      const expansionism = rn(Math.random() * 4 + 1, 1);
      s.expansionism = expansionism;
      body.querySelector("div.states[data-id='"+s.i+"'] > input.statePower").value = expansionism;
    });
    recalculateStates(true, true);
  }

  function exitRegenerationMenu() {
    statesBottom.querySelectorAll(":scope > button").forEach(el => el.style.display = "inline-block");
    statesRegenerateButtons.style.display = "none";
    statesEditor.querySelectorAll(".show").forEach(el => el.classList.add("hidden"));
    $("#statesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}});
  }

  function enterStatesManualAssignent() {
    if (!layerIsOn("toggleStates")) toggleStates();
    customization = 2;
    statesBody.append("g").attr("id", "temp");
    document.querySelectorAll("#statesBottom > button").forEach(el => el.style.display = "none");
    document.getElementById("statesManuallyButtons").style.display = "inline-block";
    document.getElementById("statesHalo").style.display = "none";

    statesEditor.querySelectorAll(".hide").forEach(el => el.classList.add("hidden"));
    statesFooter.style.display = "none";
    body.querySelectorAll("div > input, select, span, svg").forEach(e => e.style.pointerEvents = "none");
    $("#statesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}});

    tip("Click on state to select, drag the circle to change state", true);
    viewbox.style("cursor", "crosshair")
      .on("click", selectStateOnMapClick)
      .call(d3.drag().on("start", dragStateBrush))
      .on("touchmove mousemove", moveStateBrush);

    body.querySelector("div").classList.add("selected");
  }

  function selectStateOnLineClick() {
    if (customization !== 2) return;
    if (this.parentNode.id !== "statesBodySection") return;
    body.querySelector("div.selected").classList.remove("selected");
    this.classList.add("selected");
  }

  function selectStateOnMapClick() {
    const point = d3.mouse(this);
    const i = findCell(point[0], point[1]);
    if (pack.cells.h[i] < 20) return;

    const assigned = statesBody.select("#temp").select("polygon[data-cell='"+i+"']");
    const state = assigned.size() ? +assigned.attr("data-state") : pack.cells.state[i];

    body.querySelector("div.selected").classList.remove("selected");
    body.querySelector("div[data-id='"+state+"']").classList.add("selected");
  }

  function dragStateBrush() {
    const r = +statesManuallyBrush.value;

    d3.event.on("drag", () => {
      if (!d3.event.dx && !d3.event.dy) return;
      const p = d3.mouse(this);
      moveCircle(p[0], p[1], r);

      const found = r > 5 ? findAll(p[0], p[1], r) : [findCell(p[0], p[1], r)];
      const selection = found.filter(isLand);
      if (selection) changeStateForSelection(selection);
    });
  }

  // change state within selection
  function changeStateForSelection(selection) {
    const temp = statesBody.select("#temp");
    const selected = body.querySelector("div.selected");

    const stateNew = +selected.dataset.id;
    const color = pack.states[stateNew].color || "#ffffff";

    selection.forEach(function(i) {
      const exists = temp.select("polygon[data-cell='"+i+"']");
      const stateOld = exists.size() ? +exists.attr("data-state") : pack.cells.state[i];
      if (stateNew === stateOld) return;
      if (i === pack.states[stateOld].center) return;

      // change of append new element
      if (exists.size()) exists.attr("data-state", stateNew).attr("fill", color).attr("stroke", color);
      else temp.append("polygon").attr("data-cell", i).attr("data-state", stateNew).attr("points", getPackPolygon(i)).attr("fill", color).attr("stroke", color);
    });
  }

  function moveStateBrush() {
    showMainTip();
    const point = d3.mouse(this);
    const radius = +statesManuallyBrush.value;
    moveCircle(point[0], point[1], radius);
  }

  function applyStatesManualAssignent() {
    const cells = pack.cells, affectedStates = [], affectedProvinces = [];

    statesBody.select("#temp").selectAll("polygon").each(function() {
      const i = +this.dataset.cell;
      const c = +this.dataset.state;
      affectedStates.push(cells.state[i], c);
      affectedProvinces.push(cells.province[i]);
      cells.state[i] = c;
      if (cells.burg[i]) pack.burgs[cells.burg[i]].state = c;
    });

    if (affectedStates.length) {
      refreshStatesEditor();
      if (!layerIsOn("toggleStates")) toggleStates(); else drawStates();
      if (adjustLabels.checked) BurgsAndStates.drawStateLabels([...new Set(affectedStates)]);
      adjustProvinces([...new Set(affectedProvinces)]);
      if (!layerIsOn("toggleBorders")) toggleBorders(); else drawBorders();
      if (layerIsOn("toggleProvinces")) drawProvinces();
    }
    exitStatesManualAssignment();
  }

  function adjustProvinces(affectedProvinces) {
    const cells = pack.cells, provinces = pack.provinces, states = pack.states;
    const form = {"Zone":1, "Area":1, "Territory":2, "Province":1};

    affectedProvinces.forEach(p => {
      // do nothing if neutral lands are captured
      if (!p) return;

      // remove province from state provinces list
      const old = provinces[p].state;
      if (states[old].provinces.includes(p)) states[old].provinces.splice(states[old].provinces.indexOf(p), 1);

      // find states owning at least 1 province cell
      const provCells = cells.i.filter(i => cells.province[i] === p);
      const provStates = [...new Set(provCells.map(i => cells.state[i]))];

      // assign province its center owner; if center is neutral, remove province
      const owner = cells.state[provinces[p].center];
      if (owner) {
        const name = provinces[p].name;

        // if province is historical part of abouther state province, unite with old province
        const part = states[owner].provinces.find(n => name.includes(provinces[n].name));
        if (part) {
          provinces[p].removed = true;
          provCells.filter(i => cells.state[i] === owner).forEach(i => cells.province[i] = part);
        } else {
          provinces[p].state = owner;
          states[owner].provinces.push(p);
          provinces[p].color = getMixedColor(states[owner].color);
        }
      } else {
        provinces[p].removed = true;
        provCells.filter(i => !cells.state[i]).forEach(i => cells.province[i] = 0);
      }

      // create new provinces for non-main part
      provStates.filter(s => s && s !== owner).forEach(s => createProvince(p, s, provCells.filter(i => cells.state[i] === s)));
    });

    function createProvince(initProv, state, provCells) {
      const province = provinces.length;
      provCells.forEach(i => cells.province[i] = province);

      const burgCell = provCells.find(i => cells.burg[i]);
      const center = burgCell ? burgCell : provCells[0];
      const burg = burgCell ? cells.burg[burgCell] : 0;

      const name = burgCell && Math.random() < .7 
        ? getAdjective(pack.burgs[burg].name) 
        : getAdjective(states[state].name) + " " + provinces[initProv].name.split(" ").slice(-1)[0];
      const formName = name.split(" ").length > 1 ? provinces[initProv].formName : rw(form);
      const fullName = name + " " + formName;
      const color = getMixedColor(states[state].color);
      provinces.push({i:province, state, center, burg, name, formName, fullName, color});
    }

  }
 
  function exitStatesManualAssignment(close) {
    customization = 0;
    statesBody.select("#temp").remove();
    removeCircle();
    document.querySelectorAll("#statesBottom > button").forEach(el => el.style.display = "inline-block");
    document.getElementById("statesManuallyButtons").style.display = "none";
    document.getElementById("statesHalo").style.display = "block";

    statesEditor.querySelectorAll(".hide:not(.show)").forEach(el => el.classList.remove("hidden"));
    statesFooter.style.display = "block";
    body.querySelectorAll("div > input, select, span, svg").forEach(e => e.style.pointerEvents = "all");
    if(!close) $("#statesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}});

    restoreDefaultEvents();
    clearMainTip();
    const selected = body.querySelector("div.selected");
    if (selected) selected.classList.remove("selected");
  }

  function enterAddStateMode() {
    if (this.classList.contains("pressed")) {exitAddStateMode(); return;};
    customization = 3;
    this.classList.add("pressed");
    tip("Click on the map to create a new capital or promote an existing burg", true);
    viewbox.style("cursor", "crosshair").on("click", addState);
    body.querySelectorAll("div > input, select, span, svg").forEach(e => e.style.pointerEvents = "none");
  }

  function addState() {
    const point = d3.mouse(this);
    const center = findCell(point[0], point[1]);
    if (pack.cells.h[center] < 20) {tip("You cannot place state into the water. Please click on a land cell", false, "error"); return;}
    let burg = pack.cells.burg[center];
    if (burg && pack.burgs[burg].capital) {tip("Existing capital cannot be selected as a new state capital! Select other cell", false, "error"); return;}
    if (!burg) burg = addBurg(point); // add new burg

    // turn burg into a capital
    pack.burgs[burg].capital = true;
    pack.burgs[burg].state = pack.states.length;
    moveBurgToGroup(burg, "cities");

    if (d3.event.shiftKey === false) exitAddStateMode();

    const i = pack.states.length;
    const culture = pack.cells.culture[center];
    const basename = center%5 === 0 ? pack.burgs[burg].name : Names.getCulture(culture);
    const name = Names.getState(basename, culture);
    const color = d3.color(d3.scaleSequential(d3.interpolateRainbow)(Math.random())).hex();
    const diplomacy = pack.states.map(s => s.i ? "Neutral" : "x")
    diplomacy.push("x");
    pack.states.forEach(s => {if (s.i) {s.diplomacy.push("Neutral");}});
    const provinces = [];

    const affected = [pack.states.length, pack.cells.state[center]];

    pack.cells.state[center] = pack.states.length;
    pack.cells.c[center].forEach(c => {
      if (pack.cells.h[c] < 20) return;
      if (pack.cells.burg[c]) return;
      affected.push(pack.cells.state[c]);
      pack.cells.state[c] = pack.states.length;
    });
    pack.states.push({i, name, diplomacy, provinces, color, expansionism:.5, capital:burg, type:"Generic", center, culture});
    BurgsAndStates.collectStatistics();
    BurgsAndStates.defineStateForms([i]);

    if (!layerIsOn("toggleStates")) toggleStates(); else drawStates();
    if (!layerIsOn("toggleBorders")) toggleBorders(); else drawBorders();
    BurgsAndStates.drawStateLabels(affected);
    statesEditorAddLines();
  }

  function exitAddStateMode() {
    customization = 0;
    restoreDefaultEvents();
    clearMainTip();
    body.querySelectorAll("div > input, select, span, svg").forEach(e => e.style.pointerEvents = "all");
    if (statesAdd.classList.contains("pressed")) statesAdd.classList.remove("pressed");
  }
  
  function downloadStatesData() {
    const unit = areaUnit.value === "square" ? distanceUnitInput.value + "2" : areaUnit.value;
    let data = "Id,State,Color,Capital,Culture,Type,Expansionism,Cells,Burgs,Area "+unit+",Population\n"; // headers

    body.querySelectorAll(":scope > div").forEach(function(el) {
      data += el.dataset.id + ",";
      data += el.dataset.name + ",";
      data += el.dataset.color + ",";
      data += el.dataset.capital + ",";
      data += el.dataset.culture + ",";
      data += el.dataset.type + ",";
      data += el.dataset.expansionism + ",";
      data += el.dataset.cells + ",";
      data += el.dataset.burgs + ",";
      data += el.dataset.area + ",";
      data += el.dataset.population + "\n";
    });

    const dataBlob = new Blob([data], {type: "text/plain"});
    const url = window.URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    document.body.appendChild(link);
    link.download = getFileName("States") + ".csv";
    link.href = url;
    link.click();
    window.setTimeout(function() {window.URL.revokeObjectURL(url);}, 2000);
  }

  function closeStatesEditor() {
    if (customization === 2) exitStatesManualAssignment("close");
    if (customization === 3) exitAddStateMode();
    debug.selectAll(".highlight").remove();
  }
}
