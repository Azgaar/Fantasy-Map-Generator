"use strict";
function editStates() {
  if (customization) return;
  closeDialogs("#statesEditor, .stable");
  if (!layerIsOn("toggleStates")) toggleStates();
  if (!layerIsOn("toggleBorders")) toggleBorders();
  if (layerIsOn("toggleCultures")) toggleCultures();
  if (layerIsOn("toggleBiomes")) toggleBiomes();

  const body = document.getElementById("statesBodySection");
  refreshStatesEditor();

  if (modules.editStates) return;
  modules.editStates = true;

  $("#statesEditor").dialog({
    title: "States Editor", width: fitContent(), close: closeStatesEditor,
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  // add listeners
  document.getElementById("statesEditorRefresh").addEventListener("click", refreshStatesEditor);
  document.getElementById("statesPercentage").addEventListener("click", togglePercentageMode);
  document.getElementById("regenerateStateNames").addEventListener("click", regenerateNames);
  document.getElementById("statesRegenerate").addEventListener("click", openRegenerationMenu);
  document.getElementById("statesRegenerateBack").addEventListener("click", exitRegenerationMenu);
  document.getElementById("statesRecalculate").addEventListener("click", recalculateStates);
  document.getElementById("statesJustify").addEventListener("click", justifyStates);
  document.getElementById("statesRandomize").addEventListener("click", randomizeStatesExpansion);
  document.getElementById("statesNeutral").addEventListener("input", recalculateStates);
  document.getElementById("statesNeutralNumber").addEventListener("click", recalculateStates);
  document.getElementById("statesManually").addEventListener("click", enterStatesManualAssignent);
  document.getElementById("statesManuallyApply").addEventListener("click", applyStatesManualAssignent);
  document.getElementById("statesManuallyCancel").addEventListener("click", exitStatesManualAssignment);
  document.getElementById("statesAdd").addEventListener("click", enterAddStateMode);
  document.getElementById("statesExport").addEventListener("click", downloadStatesData);

  function refreshStatesEditor() {
    statesCollectStatistics();
    statesEditorAddLines();
  }

  function statesCollectStatistics() {
    const cells = pack.cells, states = pack.states;
    states.forEach(s => s.cells = s.area = s.burgs = s.rural = s.urban = 0);

    for (const i of cells.i) {
      if (cells.h[i] < 20) continue;
      const s = cells.state[i];
      states[s].cells += 1;
      states[s].area += cells.area[i];
      states[s].rural += cells.pop[i];
      if (cells.burg[i]) {
        states[s].urban += pack.burgs[cells.burg[i]].population; 
        states[s].burgs++;
      }
    }
  }

  // add line for each state
  function statesEditorAddLines() {
    const unit = areaUnit.value === "square" ? " " + distanceUnit.value + "²" : " " + areaUnit.value;
    const hidden = statesRegenerateButtons.style.display === "block" ? "visible" : "hidden"; // show/hide regenerate columns
    let lines = "", totalArea = 0, totalPopulation = 0, totalBurgs = 0;

    for (const s of pack.states) {
      if (s.removed) continue;
      const area = s.area * (distanceScale.value ** 2);
      const rural = s.rural * populationRate.value;
      const urban = s.urban * populationRate.value * urbanization.value;
      const population = rural + urban;
      const populationTip = `Total population: ${si(population)}; Rural population: ${si(rural)}; Urban population: ${si(urban)}`;
      totalArea += area;
      totalPopulation += population;
      totalBurgs += s.burgs;

      if (!s.i) {
        // Neutral line
        lines += `<div class="states" data-id=${s.i} data-name="${s.name}" data-cells=${s.cells} data-area=${area} 
        data-population=${population} data-burgs=${s.burgs} data-color="" data-capital="" data-culture="" data-type="" data-expansionism="">
          <input class="stateColor placeholder" type="color">
          <input data-tip="State name. Click and type to change" class="stateName italic" value="${s.name}" autocorrect="off" spellcheck="false">
          <span class="icon-star-empty placeholder"></span>
          <input class="stateCapital placeholder">
          <select class="stateCulture placeholder">${getCultureOptions(0)}</select>
          <select class="cultureType ${hidden} placeholder">${getTypeOptions(0)}</select>
          <span class="icon-resize-full ${hidden} placeholder"></span>
          <input class="statePower ${hidden} placeholder" type="number" value=0>
          <span data-tip="Cells count" class="icon-check-empty"></span>
          <div data-tip="Cells count" class="stateCells">${s.cells}</div>
          <span data-tip="Burgs count" style="padding-right: 1px" class="icon-dot-circled"></span>
          <div data-tip="Burgs count" class="stateBurgs">${s.burgs}</div>
          <span data-tip="State area" style="padding-right: 4px" class="icon-map-o"></span>
          <div data-tip="State area" class="biomeArea">${si(area) + unit}</div>
          <span data-tip="${populationTip}" class="icon-male"></span>
          <div data-tip="${populationTip}" class="culturePopulation">${si(population)}</div>
        </div>`;
        continue;
      }
      const capital = pack.burgs[s.capital].name;
      lines += `<div class="states" data-id=${s.i} data-name="${s.name}" data-capital="${capital}" data-color="${s.color}" data-cells=${s.cells}
        data-area=${area} data-population=${population} data-burgs=${s.burgs} data-culture=${pack.cultures[s.culture].name} data-type=${s.type} data-expansionism=${s.expansionism}>
        <input data-tip="State color. Click to change" class="stateColor" type="color" value="${s.color}">
        <input data-tip="State name. Click and type to change" class="stateName" value="${s.name}" autocorrect="off" spellcheck="false">
        <span data-tip="State capital. Click to zoom into view" class="icon-star-empty pointer"></span>
        <input data-tip="Capital name. Click and type to rename" class="stateCapital" value="${capital}" autocorrect="off" spellcheck="false"/>
        <select data-tip="Dominant culture. Click to change" class="stateCulture">${getCultureOptions(s.culture)}</select>
        <select data-tip="State type. Click to change" class="cultureType ${hidden}">${getTypeOptions(s.type)}</select>      
        <span data-tip="State expansionism" class="icon-resize-full ${hidden}"></span>
        <input data-tip="Expansionism (defines competitive size). Change to re-calculate states based on new value" class="statePower ${hidden}" type="number" min=0 max=99 step=.1 value=${s.expansionism}>
        <span data-tip="Cells count" class="icon-check-empty"></span>
        <div data-tip="Cells count" class="stateCells">${s.cells}</div>
        <span data-tip="Burgs count" style="padding-right: 1px" class="icon-dot-circled"></span>
        <div data-tip="Burgs count" class="stateBurgs">${s.burgs}</div>
        <span data-tip="State area" style="padding-right: 4px" class="icon-map-o"></span>
        <div data-tip="State area" class="biomeArea">${si(area) + unit}</div>
        <span data-tip="${populationTip}" class="icon-male"></span>
        <div data-tip="${populationTip}" class="culturePopulation">${si(population)}</div>
        <span data-tip="Remove state" class="icon-trash-empty"></span>
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

    // add listeners
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseenter", ev => stateHighlightOn(ev)));
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseleave", ev => stateHighlightOff(ev)));
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("click", selectStateOnLineClick));
    body.querySelectorAll("div > input.stateColor").forEach(el => el.addEventListener("input", stateChangeColor));
    body.querySelectorAll("div > input.stateName").forEach(el => el.addEventListener("input", stateChangeName));
    body.querySelectorAll("div > input.stateCapital").forEach(el => el.addEventListener("input", stateChangeCapitalName));
    body.querySelectorAll("div > span.icon-star-empty").forEach(el => el.addEventListener("click", stateCapitalZoomIn));
    body.querySelectorAll("div > select.stateCulture").forEach(el => el.addEventListener("change", stateChangeCulture));
    body.querySelectorAll("div > select.cultureType").forEach(el => el.addEventListener("input", stateChangeType));
    body.querySelectorAll("div > input.statePower").forEach(el => el.addEventListener("input", stateChangeExpansionism));
    body.querySelectorAll("div > span.icon-trash-empty").forEach(el => el.addEventListener("click", stateRemove));

    if (body.dataset.type === "percentage") {body.dataset.type = "absolute"; togglePercentageMode();}
    applySorting(statesHeader);
    $("#statesEditor").dialog();
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
    if (!layerIsOn("toggleStates")) return;
    const state = +event.target.dataset.id;
    if (customization || !state) return;
    const path = regions.select("#state"+state).attr("d");
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
    debug.selectAll(".highlight").each(function(el) {
      d3.select(this).call(removePath);
    });
  }

  function stateChangeColor() {
    const state = +this.parentNode.dataset.id;
    pack.states[state].color = this.value;
    regions.select("#state"+state).attr("fill", this.value);
    regions.select("#state-gap"+state).attr("stroke", this.value);
    regions.select("#state-border"+state).attr("stroke", d3.color(this.value).darker().hex());
  }

  function stateChangeName() {
    const state = +this.parentNode.dataset.id;
    this.parentNode.dataset.name = this.value;
    pack.states[state].name = this.value;
    document.querySelector("#stateLabel"+state+" > textPath").textContent = this.value;
  }

  function stateChangeCapitalName() {
    const state = +this.parentNode.dataset.id;
    this.parentNode.dataset.capital = this.value;
    const capital = pack.states[state].capital;
    if (!capital) return;
    pack.burgs[capital].name = this.value; 
    document.querySelector("#burgLabel"+capital).textContent = this.value;
  }

  function stateCapitalZoomIn() {
    const state = +this.parentNode.dataset.id;
    const capital = pack.states[state].capital;
    const l = burgLabels.select("[data-id='" + capital + "']");
    const x = +l.attr("x"), y = +l.attr("y");
    zoomTo(x, y, 8, 2000);
  }

  function stateChangeCulture() {
    const state = +this.parentNode.dataset.id;
    const v = +this.value;
    this.parentNode.dataset.base = pack.states[state].culture = v;
  }

  function stateChangeType() {
    const state = +this.parentNode.dataset.id;
    this.parentNode.dataset.type = this.value;
    pack.states[state].type = this.value;
    recalculateStates();
  }

  function stateChangeExpansionism() {
    const state = +this.parentNode.dataset.id;
    this.parentNode.dataset.expansionism = this.value;
    pack.states[state].expansionism = +this.value;
    recalculateStates();
  }

  function stateRemove() {
    if (customization) return;
    const state = +this.parentNode.dataset.id;
    regions.select("#state"+state).remove();
    regions.select("#state-gap"+state).remove();
    regions.select("#state-border"+state).remove();
    document.querySelector("#stateLabel"+state+" > textPath").remove();
    pack.burgs.forEach(b => {if(b.state === state) b.state = 0;});
    pack.cells.state.forEach((s, i) => {if(s === state) pack.cells.state[i] = 0;});
    pack.states[state].removed = true;
    
    const capital = pack.states[state].capital;
    pack.burgs[capital].capital = false;
    pack.burgs[capital].state = 0;
    moveBurgToGroup(capital, "towns");
    
    if (!layerIsOn("toggleStates")) toggleStates(); else drawStatesWithBorders();
    refreshStatesEditor();
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

  function regenerateNames() {
    body.querySelectorAll(":scope > div").forEach(function(el) {
      const state = +el.dataset.id;
      if (!state) return;
      const culture = pack.states[state].culture;
      const name = Names.getState(Names.getCulture(culture, 4, 7, ""), culture);
      el.querySelector(".stateName").value = name;
      pack.states[state].name = el.dataset.name = name;
      labels.select("#stateLabel"+state+" > textPath").text(name);
    });
    if (adjustLabels.checked) BurgsAndStates.drawStateLabels();
  }

  function openRegenerationMenu() {
    statesBottom.querySelectorAll(":scope > button").forEach(el => el.style.display = "none");
    statesRegenerateButtons.style.display = "block";
    statesEditor.querySelectorAll(".hidden").forEach(el => {el.classList.remove("hidden"); el.classList.add("visible");});
    $("#statesEditor").dialog({position: {my: "right top", at: "right top", of: $("#statesEditor").parent(), collision: "fit"}});
  }

  function recalculateStates() {
    BurgsAndStates.expandStates();
    if (!layerIsOn("toggleStates")) toggleStates(); else drawStatesWithBorders();
    if (adjustLabels.checked) BurgsAndStates.drawStateLabels();
    refreshStatesEditor();
  }

  function justifyStates() {
    BurgsAndStates.normalizeStates();
    if (!layerIsOn("toggleStates")) toggleStates(); else drawStatesWithBorders();
    if (adjustLabels.checked) BurgsAndStates.drawStateLabels();
    refreshStatesEditor();
  }

  function randomizeStatesExpansion() {
    pack.states.slice(1).forEach(s => {
      const expansionism = rn(Math.random() * 4 + 1, 1);
      s.expansionism = expansionism;
      body.querySelector("div.states[data-id='"+s.i+"'] > input.statePower").value = expansionism;
    });
    recalculateStates();
  }

  function exitRegenerationMenu() {
    statesBottom.querySelectorAll(":scope > button").forEach(el => el.style.display = "inline-block");
    statesRegenerateButtons.style.display = "none";
    statesEditor.querySelectorAll(".visible").forEach(el => {el.classList.remove("visible"); el.classList.add("hidden");});
  }

  function enterStatesManualAssignent() {
    if (!layerIsOn("toggleStates")) toggleStates();
    customization = 2;
    regions.append("g").attr("id", "temp");
    document.querySelectorAll("#statesBottom > button").forEach(el => el.style.display = "none");
    document.getElementById("statesManuallyButtons").style.display = "inline-block";
    document.getElementById("statesHalo").style.display = "none";

    tip("Click on state to select, drag the circle to change state", true);
    viewbox.style("cursor", "crosshair").call(d3.drag()
      .on("drag", dragStateBrush))
      .on("click", selectStateOnMapClick)
      .on("touchmove mousemove", moveStateBrush);

    body.querySelectorAll("div > *").forEach(e => e.disabled = true);
    body.querySelector("div").classList.add("selected");
  }

  function selectStateOnLineClick(i) {
    if (customization !== 2) return;
    body.querySelector("div.selected").classList.remove("selected");
    this.classList.add("selected");
  }

  function selectStateOnMapClick() {
    const point = d3.mouse(this);
    const i = findCell(point[0], point[1]);
    if (pack.cells.h[i] < 20) return;

    const assigned = regions.select("#temp").select("polygon[data-cell='"+i+"']");
    const state = assigned.size() ? +assigned.attr("data-state") : pack.cells.state[i];

    body.querySelector("div.selected").classList.remove("selected");
    body.querySelector("div[data-id='"+state+"']").classList.add("selected");
  }

  function dragStateBrush() {
    const p = d3.mouse(this);
    const r = +statesManuallyBrush.value;
    moveCircle(p[0], p[1], r);

    const found = r > 5 ? findAll(p[0], p[1], r) : [findCell(p[0], p[1], r)];
    const selection = found.filter(isLand);
    if (selection) changeStateForSelection(selection);    
  }

  // change state within selection
  function changeStateForSelection(selection) {
    const temp = regions.select("#temp");
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
    const cells = pack.cells;
    const changed = regions.select("#temp").selectAll("polygon");
    changed.each(function() {
      const i = +this.dataset.cell;
      const c = +this.dataset.state;
      cells.state[i] = c;
      if (cells.burg[i]) pack.burgs[cells.burg[i]].state = c;
    });

    if (changed.size()) {
      refreshStatesEditor();
      if (!layerIsOn("toggleStates")) toggleStates(); else drawStatesWithBorders();
      if (adjustLabels.checked) BurgsAndStates.drawStateLabels();
    }
    exitStatesManualAssignment();
  }
 
  function exitStatesManualAssignment() {
    customization = 0;
    regions.select("#temp").remove();
    removeCircle();
    document.querySelectorAll("#statesBottom > button").forEach(el => el.style.display = "inline-block");
    document.getElementById("statesManuallyButtons").style.display = "none";
    document.getElementById("statesHalo").style.display = "block";
    body.querySelectorAll("div > *").forEach(e => e.disabled = false);
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
    body.querySelectorAll("div > *").forEach(e => e.disabled = true);
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

    exitAddStateMode();
    const culture = pack.cells.culture[center];
    const basename = center%5 === 0 ? pack.burgs[burg].name : Names.getCulture(culture);
    const name = Names.getState(basename, culture);
    const color = d3.color(d3.scaleSequential(d3.interpolateRainbow)(Math.random())).hex();

    pack.cells.state[center] = pack.states.length;
    pack.cells.c[center].forEach(c => {
      if (pack.cells.h[c] < 20) return;
      if (pack.cells.burg[c]) return;
      pack.cells.state[c] = pack.states.length;
    });
    pack.states.push({i:pack.states.length, name, color, expansionism:.5, capital:burg, type:"Generic", center, culture});

    if (!layerIsOn("toggleStates")) toggleStates(); else drawStatesWithBorders();
    if (adjustLabels.checked) BurgsAndStates.drawStateLabels();
    refreshStatesEditor();
  }

  function exitAddStateMode() {
    customization = 0;
    restoreDefaultEvents();
    clearMainTip();
    body.querySelectorAll("div > *").forEach(e => e.disabled = false);
    if (statesAdd.classList.contains("pressed")) statesAdd.classList.remove("pressed");
  }
  
  function downloadStatesData() {
    const unit = areaUnit.value === "square" ? distanceUnit.value + "2" : areaUnit.value;
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
    link.download = "states_data" + Date.now() + ".csv";
    link.href = url;
    link.click();
    window.setTimeout(function() {window.URL.revokeObjectURL(url);}, 2000);    
  }

  function closeStatesEditor() {
    if (customization === 2) exitStatesManualAssignment();
    if (customization === 3) exitAddStateMode();
  }
}
