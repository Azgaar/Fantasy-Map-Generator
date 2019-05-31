"use strict";
function editCultures() {
  if (customization) return;
  closeDialogs("#culturesEditor, .stable");
  if (!layerIsOn("toggleCultures")) toggleCultures();
  if (layerIsOn("toggleStates")) toggleStates();
  if (layerIsOn("toggleBiomes")) toggleBiomes();

  const body = document.getElementById("culturesBody");
  const animate = d3.transition().duration(2000).ease(d3.easeSinIn);  
  drawCultureCenters();
  refreshCulturesEditor();

  if (modules.editCultures) return;
  modules.editCultures = true;

  $("#culturesEditor").dialog({
    title: "Cultures Editor", width: fitContent(), close: closeCulturesEditor,
    position: {my: "right top", at: "right-10 top+10", of: "svg"}
  });

  // add listeners
  document.getElementById("culturesEditorRefresh").addEventListener("click", refreshCulturesEditor);
  document.getElementById("culturesPercentage").addEventListener("click", togglePercentageMode);
  document.getElementById("culturesRecalculate").addEventListener("click", recalculateCultures);
  document.getElementById("culturesManually").addEventListener("click", enterCultureManualAssignent);
  document.getElementById("culturesManuallyApply").addEventListener("click", applyCultureManualAssignent);
  document.getElementById("culturesManuallyCancel").addEventListener("click", exitCulturesManualAssignment);
  document.getElementById("culturesEditNamesBase").addEventListener("click", editNamesbase);
  document.getElementById("culturesAdd").addEventListener("click", addCulture);
  document.getElementById("culturesExport").addEventListener("click", downloadCulturesData);

  function refreshCulturesEditor() {
    culturesCollectStatistics();
    culturesEditorAddLines();
  }

  function culturesCollectStatistics() {
    const cells = pack.cells, cultures = pack.cultures;
    cultures.forEach(c => c.cells = c.area = c.rural = c.urban = 0);

    for (const i of cells.i) {
      if (cells.h[i] < 20) continue;
      const c = cells.culture[i];
      cultures[c].cells += 1;
      cultures[c].area += cells.area[i];
      cultures[c].rural += cells.pop[i];
      if (cells.burg[i]) cultures[c].urban += pack.burgs[cells.burg[i]].population;
    }
  }

  // add line for each culture
  function culturesEditorAddLines() {
    const unit = areaUnit.value === "square" ? " " + distanceUnit.value + "²" : " " + areaUnit.value;
    let lines = "", totalArea = 0, totalPopulation = 0;

    for (const c of pack.cultures) {
      if (c.removed) continue;
      const area = c.area * (distanceScale.value ** 2);
      const rural = c.rural * populationRate.value;
      const urban = c.urban * populationRate.value * urbanization.value;
      const population = rural + urban;
      const populationTip = `Total population: ${si(population)}; Rural population: ${si(rural)}; Urban population: ${si(urban)}`;
      totalArea += area;
      totalPopulation += population;

      if (!c.i) {
        // Uncultured (neutral) line
        lines += `<div class="states" data-id=${c.i} data-name="${c.name}" data-color="" data-cells=${c.cells}
        data-area=${area} data-population=${population} data-base=${c.base} data-type="" data-expansionism="">
          <input class="stateColor placeholder" type="color">
          <input data-tip="Culture name. Click and type to change" class="cultureName italic" value="${c.name}" autocorrect="off" spellcheck="false">
          <span data-tip="Cells count" class="icon-check-empty"></span>
          <div data-tip="Cells count" class="stateCells">${c.cells}</div>
          <span class="icon-resize-full placeholder"></span>
          <input class="statePower placeholder" type="number">
          <select class="cultureType placeholder">${getTypeOptions(c.type)}</select>
          <span data-tip="Culture area" style="padding-right: 4px" class="icon-map-o"></span>
          <div data-tip="Culture area" class="biomeArea">${si(area) + unit}</div>
          <span data-tip="${populationTip}" class="icon-male"></span>
          <div data-tip="${populationTip}" class="culturePopulation">${si(population)}</div>
          <span data-tip="Click to re-generate names for burgs with this culture assigned" class="icon-arrows-cw"></span>
          <select data-tip="Culture namesbase. Click to change" class="cultureBase">${getBaseOptions(c.base)}</select>
        </div>`;
        continue;
      }

      lines += `<div class="states cultures" data-id=${c.i} data-name="${c.name}" data-color="${c.color}" data-cells=${c.cells}
      data-area=${area} data-population=${population} data-base=${c.base} data-type=${c.type} data-expansionism=${c.expansionism}>
        <input data-tip="Culture color. Click to change" class="stateColor" type="color" value="${c.color}">
        <input data-tip="Culture name. Click and type to change" class="cultureName" value="${c.name}" autocorrect="off" spellcheck="false">
        <span data-tip="Cells count" class="icon-check-empty"></span>
        <div data-tip="Cells count" class="stateCells">${c.cells}</div>
        <span data-tip="Culture expansionism (defines competitive size)" class="icon-resize-full"></span>
        <input data-tip="Expansionism (defines competitive size). Change to re-calculate cultures based on new value" class="statePower" type="number" min=0 max=99 step=.1 value=${c.expansionism}>
        <select data-tip="Culture type. Change to re-calculate cultures based on new value" class="cultureType">${getTypeOptions(c.type)}</select>
        <span data-tip="Culture area" style="padding-right: 4px" class="icon-map-o"></span>
        <div data-tip="Culture area" class="biomeArea">${si(area) + unit}</div>
        <span data-tip="${populationTip}" class="icon-male"></span>
        <div data-tip="${populationTip}" class="culturePopulation">${si(population)}</div>
        <span data-tip="Click to re-generate names for burgs with this culture assigned" class="icon-arrows-cw"></span>
        <select data-tip="Culture namesbase. Change and then click on the Re-generate button to get new names" class="cultureBase">${getBaseOptions(c.base)}</select>
        <span data-tip="Remove culture" class="icon-trash-empty"></span>
      </div>`;
    }
    body.innerHTML = lines;

    // update footer
    culturesFooterCultures.innerHTML = pack.cultures.filter(c => c.i && !c.removed).length;
    culturesFooterCells.innerHTML = pack.cells.h.filter(h => h >= 20).length;
    culturesFooterArea.innerHTML = si(totalArea) + unit;
    culturesFooterPopulation.innerHTML = si(totalPopulation);
    culturesFooterArea.dataset.area = totalArea;
    culturesFooterPopulation.dataset.population = totalPopulation;

    // add listeners
    body.querySelectorAll("div.cultures").forEach(el => el.addEventListener("mouseenter", ev => cultureHighlightOn(ev)));
    body.querySelectorAll("div.cultures").forEach(el => el.addEventListener("mouseleave", ev => cultureHighlightOff(ev)));
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("click", selectCultureOnLineClick));
    body.querySelectorAll("div > input[type='color']").forEach(el => el.addEventListener("input", cultureChangeColor));
    body.querySelectorAll("div > input.cultureName").forEach(el => el.addEventListener("input", cultureChangeName));
    body.querySelectorAll("div > input.statePower").forEach(el => el.addEventListener("input", cultureChangeExpansionism));
    body.querySelectorAll("div > select.cultureType").forEach(el => el.addEventListener("change", cultureChangeType));
    body.querySelectorAll("div > select.cultureBase").forEach(el => el.addEventListener("click", updateBaseOptions));
    body.querySelectorAll("div > select.cultureBase").forEach(el => el.addEventListener("change", cultureUpdateBase));
    body.querySelectorAll("div > span.icon-arrows-cw").forEach(el => el.addEventListener("click", cultureRegenerateBurgs));
    body.querySelectorAll("div > span.icon-trash-empty").forEach(el => el.addEventListener("click", cultureRemove));

    if (body.dataset.type === "percentage") {body.dataset.type = "absolute"; togglePercentageMode();}
    applySorting(culturesHeader);
    $("#culturesEditor").dialog();
  }

  function getTypeOptions(type) {
    let options = "";
    const types = ["Generic", "River", "Lake", "Naval", "Nomadic", "Hunting", "Highland"];
    types.forEach(t => options += `<option ${type === t ? "selected" : ""} value="${t}">${t}</option>`);
    return options;
  }
  
  function getBaseOptions(base) {
    let options = "";
    nameBases.forEach((n, i) => options += `<option ${base === i ? "selected" : ""} value="${i}">${n.name}</option>`);
    return options;
  }
 
  function cultureHighlightOn(event) {
    if (customization === 4) return;
    const culture = +event.target.dataset.id;
    const color = d3.interpolateLab(pack.cultures[culture].color, "#ff0000")(.8)
    cults.select("#culture"+culture).raise().transition(animate).attr("stroke-width", 3).attr("stroke", color);
    debug.select("#cultureCenter"+culture).raise().transition(animate).attr("r", 8);
  }

  function cultureHighlightOff(event) {
    if (customization === 4) return;
    const culture = +event.target.dataset.id;
    cults.select("#culture"+culture).transition().attr("stroke-width", .7).attr("stroke", pack.cultures[culture].color);
    debug.select("#cultureCenter"+culture).transition().attr("r", 6);
  }

  function cultureChangeColor() {
    const culture = +this.parentNode.dataset.id;
    pack.cultures[culture].color = this.value;
    cults.select("#culture"+culture).attr("fill", this.value).attr("stroke", this.value);
    debug.select("#cultureCenter"+culture).attr("fill", this.value);    
  }

  function cultureChangeName() {
    const culture = +this.parentNode.dataset.id;
    this.parentNode.dataset.name = this.value;
    pack.cultures[culture].name = this.value;    
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

  function updateBaseOptions() {
    const culture = +this.parentNode.dataset.id;
    const v = +this.value;
    this.parentNode.dataset.base = pack.cultures[culture].base = v;    
    this.options.length = 0;
    nameBases.forEach((b, i) => this.options.add(new Option(b.name, i, false, i === v)));
  }

  function cultureUpdateBase() {
    const culture = +this.parentNode.dataset.id;
    const v = +this.value;
    pack.cultures.find(el => el.i === culture).base = v;
  }

  function cultureRegenerateBurgs() {
    if (customization === 4) return;
    const culture = +this.parentNode.dataset.id;
    const cBurgs = pack.burgs.filter(b => b.culture === culture);
    cBurgs.forEach(b => {
      b.name = Names.getCulture(culture);
      labels.select("[data-id='" + b.i +"']").text(b.name);
    });
    tip(`Names for ${cBurgs.length} burgs are re-generated`);
  }

  function cultureRemove() {
    if (customization === 4) return;
    const culture = +this.parentNode.dataset.id;
    cults.select("#culture"+culture).remove();
    debug.select("#cultureCenter"+culture).remove();

    pack.burgs.filter(b => b.culture === culture).forEach(b => b.culture = 0);
    pack.cells.culture.forEach((c, i) => {if(c === culture) pack.cells.culture[i] = 0;});
    pack.cultures[culture].removed = true;

    refreshCulturesEditor();
  }

  function drawCultureCenters() {
    const tooltip = 'Drag to move the culture center (ancestral home)';
    debug.select("#cultureCenters").remove();
    const cultureCenters = debug.append("g").attr("id", "cultureCenters");

    const data = pack.cultures.filter(c => c.i && !c.removed);
    cultureCenters.selectAll("circle").data(data).enter().append("circle")
      .attr("id", d => "cultureCenter"+d.i).attr("data-id", d => d.i)
      .attr("r", 6).attr("fill", d => d.color)
      .attr("cx", d => pack.cells.p[d.center][0]).attr("cy", d => pack.cells.p[d.center][1])
      .on("mouseenter", d => {tip(tooltip, true); body.querySelector(`div[data-id='${d.i}']`).classList.add("selected"); cultureHighlightOn(event);})
      .on("mouseleave", d => {tip('', true); body.querySelector(`div[data-id='${d.i}']`).classList.remove("selected"); cultureHighlightOff(event);})
      .call(d3.drag().on("start", cultureCenterDrag));
  }

  function cultureCenterDrag() {
    const el = d3.select(this);
    const c = +this.id.slice(13);
    d3.event.on("drag", () => {
      el.attr("cx", d3.event.x).attr("cy", d3.event.y);
      const cell = findCell(d3.event.x, d3.event.y);
      if (pack.cells.h[cell] < 20) return; // ignore dragging on water
      pack.cultures[c].center = cell;
      recalculateCultures();
    });
  }
  
  function togglePercentageMode() {
    if (body.dataset.type === "absolute") {
      body.dataset.type = "percentage";
      const totalCells = +culturesFooterCells.innerHTML;
      const totalArea = +culturesFooterArea.dataset.area;
      const totalPopulation = +culturesFooterPopulation.dataset.population;

      body.querySelectorAll(":scope > div").forEach(function(el) {
        el.querySelector(".stateCells").innerHTML = rn(+el.dataset.cells / totalCells * 100) + "%";
        el.querySelector(".biomeArea").innerHTML = rn(+el.dataset.area / totalArea * 100) + "%";
        el.querySelector(".culturePopulation").innerHTML = rn(+el.dataset.population / totalPopulation * 100) + "%";
      });
    } else {
      body.dataset.type = "absolute";
      culturesEditorAddLines();
    }
  }

  // re-calculate cultures
  function recalculateCultures() {
    pack.cells.culture = new Int8Array(pack.cells.i.length);
    pack.cultures.forEach(function(c) {
      if (!c.i || c.removed) return;
      pack.cells.culture[c.center] = c.i;
    });
    Cultures.expand();
    drawCultures();
    pack.burgs.forEach(b => b.culture = pack.cells.culture[b.cell]);
    refreshCulturesEditor();
  }
  
  function enterCultureManualAssignent() {
    if (!layerIsOn("toggleCultures")) toggleCultures();  
    customization = 4;
    cults.append("g").attr("id", "temp");
    document.querySelectorAll("#culturesBottom > button").forEach(el => el.style.display = "none");
    document.getElementById("culturesManuallyButtons").style.display = "inline-block";    
    debug.select("#cultureCenters").style("display", "none");

    tip("Click on culture to select, drag the circle to change culture", true);
    viewbox.style("cursor", "crosshair").call(d3.drag()
      .on("drag", dragCultureBrush))
      .on("click", selectCultureOnMapClick)
      .on("touchmove mousemove", moveCultureBrush);

    body.querySelectorAll("div > *").forEach(e => e.disabled = true);
    body.querySelector("div").classList.add("selected");
  }

  function selectCultureOnLineClick(i) {
    if (customization !== 4) return;
    body.querySelector("div.selected").classList.remove("selected");
    this.classList.add("selected");    
  }

  function selectCultureOnMapClick() {
    const point = d3.mouse(this);
    const i = findCell(point[0], point[1]);
    if (pack.cells.h[i] < 20) return;

    const assigned = cults.select("#temp").select("polygon[data-cell='"+i+"']");
    const culture = assigned.size() ? +assigned.attr("data-culture") : pack.cells.culture[i];

    body.querySelector("div.selected").classList.remove("selected");
    body.querySelector("div[data-id='"+culture+"']").classList.add("selected");
  }
  
  function dragCultureBrush() {
    const p = d3.mouse(this);
    const r = +culturesManuallyBrush.value;
    moveCircle(p[0], p[1], r);

    const found = r > 5 ? findAll(p[0], p[1], r) : [findCell(p[0], p[1], r)];
    const selection = found.filter(isLand);
    if (selection) changeCultureForSelection(selection);    
  }

  // change culture within selection
  function changeCultureForSelection(selection) {
    const temp = cults.select("#temp");
    const selected = body.querySelector("div.selected");

    const cultureNew = +selected.dataset.id;
    const color = pack.cultures[cultureNew].color;

    selection.forEach(function(i) {
      const exists = temp.select("polygon[data-cell='"+i+"']");
      const cultureOld = exists.size() ? +exists.attr("data-culture") : pack.cells.culture[i];
      if (cultureNew === cultureOld) return;

      // change of append new element
      if (exists.size()) exists.attr("data-culture", cultureNew).attr("fill", color).attr("stroke", color);
      else temp.append("polygon").attr("data-cell", i).attr("data-culture", cultureNew).attr("points", getPackPolygon(i)).attr("fill", color).attr("stroke", color);
    });
  }

  function moveCultureBrush() {
    showMainTip();
    const point = d3.mouse(this);
    const radius = +culturesManuallyBrush.value;
    moveCircle(point[0], point[1], radius);
  }

  function applyCultureManualAssignent() {
    const changed = cults.select("#temp").selectAll("polygon");
    changed.each(function() {
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
 
  function exitCulturesManualAssignment() {
    customization = 0;
    cults.select("#temp").remove();
    removeCircle();
    document.querySelectorAll("#culturesBottom > button").forEach(el => el.style.display = "inline-block");
    document.getElementById("culturesManuallyButtons").style.display = "none";
    body.querySelectorAll("div > *").forEach(e => e.disabled = false);
    debug.select("#cultureCenters").style("display", null);
    restoreDefaultEvents();
    clearMainTip();
    const selected = body.querySelector("div.selected");
    if (selected) selected.classList.remove("selected");
  }
  
  function addCulture() {
    const defaultCultures = Cultures.getDefault();
    let culture, base, name;
    if (pack.cultures.length < defaultCultures.length) {
      // add one of the default cultures
      culture = pack.cultures.length;
      base = defaultCultures[culture].base;
      name = defaultCultures[culture].name;
    } else {
      // add random culture besed on one of the current ones
      culture = rand(pack.cultures.length - 1);
      name = Names.getCulture(culture, 5, 8, "");
      base = pack.cultures[culture].base;
    }
    const i = pack.cultures.length;
    const color = d3.color(d3.scaleSequential(d3.interpolateRainbow)(Math.random())).hex();
    const land = pack.cells.i.filter(isLand);
    const center = land[Math.floor(Math.random() * land.length - 1)];
    pack.cultures.push({name, color, base, center, i, expansionism:1, type:"Generic", cells:0, area:0, rural:0, urban:0});
    drawCultureCenters();
    culturesEditorAddLines();
  }

  function downloadCulturesData() {
    const unit = areaUnit.value === "square" ? distanceUnit.value + "2" : areaUnit.value;
    let data = "Id,Culture,Color,Cells,Expansionism,Type,Area "+unit+",Population,Namesbase\n"; // headers
    
    body.querySelectorAll(":scope > div").forEach(function(el) {
      data += el.dataset.id + ",";
      data += el.dataset.name + ",";
      data += el.dataset.color + ",";
      data += el.dataset.cells + ",";
      data += el.dataset.expansionism + ",";
      data += el.dataset.type + ",";
      data += el.dataset.area + ",";
      data += el.dataset.population + ",";
      const base = +el.dataset.base;
      data += nameBases[base].name + "\n";
    });

    const dataBlob = new Blob([data], {type: "text/plain"});
    const url = window.URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    document.body.appendChild(link);
    link.download = "cultures_data" + Date.now() + ".csv";
    link.href = url;
    link.click();
    window.setTimeout(function() {window.URL.revokeObjectURL(url);}, 2000);
  }
  
  function closeCulturesEditor() {
    debug.select("#cultureCenters").remove();
    exitCulturesManualAssignment();
  }

}
