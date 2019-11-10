"use strict";
function editBiomes() {
  if (customization) return;
  closeDialogs("#biomesEditor, .stable");
  if (!layerIsOn("toggleBiomes")) toggleBiomes();
  if (layerIsOn("toggleStates")) toggleStates();
  if (layerIsOn("toggleCultures")) toggleCultures();
  if (layerIsOn("toggleReligions")) toggleReligions();
  if (layerIsOn("toggleProvinces")) toggleProvinces();

  const body = document.getElementById("biomesBody");
  const animate = d3.transition().duration(2000).ease(d3.easeSinIn);
  refreshBiomesEditor();

  if (modules.editBiomes) return;
  modules.editBiomes = true;

  $("#biomesEditor").dialog({
    title: "Biomes Editor", resizable: false, width: fitContent(), close: closeBiomesEditor,
    position: {my: "right top", at: "right-10 top+10", of: "svg"}
  });

  // add listeners
  document.getElementById("biomesEditorRefresh").addEventListener("click", refreshBiomesEditor);
  document.getElementById("biomesEditStyle").addEventListener("click", () => editStyle("biomes"));
  document.getElementById("biomesLegend").addEventListener("click", toggleLegend);
  document.getElementById("biomesPercentage").addEventListener("click", togglePercentageMode);
  document.getElementById("biomesManually").addEventListener("click", enterBiomesCustomizationMode);
  document.getElementById("biomesManuallyApply").addEventListener("click", applyBiomesChange);
  document.getElementById("biomesManuallyCancel").addEventListener("click", () => exitBiomesCustomizationMode());
  document.getElementById("biomesRestore").addEventListener("click", restoreInitialBiomes);
  document.getElementById("biomesAdd").addEventListener("click", addCustomBiome);
  document.getElementById("biomesRegenerateReliefIcons").addEventListener("click", regenerateIcons);
  document.getElementById("biomesExport").addEventListener("click", downloadBiomesData);

  body.addEventListener("click", function(ev) {
    const el = ev.target, cl = el.classList;
    if (cl.contains("zoneFill")) biomeChangeColor(el); else
    if (cl.contains("icon-info-circled")) openWiki(el); else
    if (cl.contains("icon-trash-empty")) removeCustomBiome(el);
    if (customization === 6) selectBiomeOnLineClick(el);
  });

  body.addEventListener("change", function(ev) {
    const el = ev.target, cl = el.classList;
    if (cl.contains("biomeName")) biomeChangeName(el); else
    if (cl.contains("biomeHabitability")) biomeChangeHabitability(el);
  });

  function refreshBiomesEditor() {
    biomesCollectStatistics();
    biomesEditorAddLines();
  }

  function biomesCollectStatistics() {
    const cells = pack.cells;

    biomesData.biomeList.forEach((biome) => {
      biome.resetStatistics();
    });

    for (const i of cells.i) {
      if (cells.h[i] < 20) continue;
      biomesData.biomeList[cells.biome[i]].addCell(i, cells);
    }
  }

  function biomesEditorAddLines() {
    const unit = areaUnit.value === "square" ? " " + distanceUnitInput.value + "²" : " " + areaUnit.value;
    const l = biomesData.biomeList;
    let lines = "", totalArea = 0, totalPopulation = 0;;

    for (const b of l) {
      if (!b.id || b.name === "removed") continue; // ignore water and removed biomes
      const area = b.area * distanceScaleInput.value ** 2;
      const rural = b.rural * populationRate.value;
      const urban = b.urban * populationRate.value * urbanization.value;
      const population = rn(rural + urban);
      const populationTip = `Total population: ${si(population)}; Rural population: ${si(rural)}; Urban population: ${si(urban)}`;
      totalArea += area;
      totalPopulation += population;

      lines += `<div class="states biomes" data-id="${b.id}" data-name="${b.name}" data-habitability="${b.habitability}"
      data-cells=${b.cells} data-area=${area} data-population=${population} data-color=${b.color}>
        <svg data-tip="Biomes fill style. Click to change" width=".9em" height=".9em" style="margin-bottom:-1px"><rect x="0" y="0" width="100%" height="100%" fill="${b.color}" class="zoneFill"></svg>
        <input data-tip="Biome name. Click and type to change" class="biomeName" value="${b.name}" autocorrect="off" spellcheck="false">
        <span data-tip="Biome habitability percent" class="hide">%</span>
        <input data-tip="Biome habitability percent. Click and set new value to change" type="number" min=0 max=9999 class="biomeHabitability hide" value=${b.habitability}>
        <span data-tip="Cells count" class="icon-check-empty hide"></span>
        <div data-tip="Cells count" class="biomeCells hide">${b.cells}</div>
        <span data-tip="Biome area" style="padding-right: 4px" class="icon-map-o hide"></span>
        <div data-tip="Biome area" class="biomeArea hide">${si(area) + unit}</div>
        <span data-tip="${populationTip}" class="icon-male hide"></span>
        <div data-tip="${populationTip}" class="biomePopulation hide">${si(population)}</div>
        <span data-tip="Open Wikipedia articale about the biome" class="icon-info-circled pointer hide"></span>
        ${b.id>12 && !b.cells ? '<span data-tip="Remove the custom biome" class="icon-trash-empty hide"></span>' : ''}
      </div>`;
    }
    body.innerHTML = lines;

    // update footer
    biomesFooterBiomes.innerHTML = body.querySelectorAll(":scope > div").length;
    biomesFooterCells.innerHTML = pack.cells.h.filter(h => h >= 20).length;
    biomesFooterArea.innerHTML = si(totalArea) + unit;
    biomesFooterPopulation.innerHTML = si(totalPopulation);
    biomesFooterArea.dataset.area = totalArea;
    biomesFooterPopulation.dataset.population = totalPopulation;

    // add listeners
    body.querySelectorAll("div.biomes").forEach(el => el.addEventListener("mouseenter", ev => biomeHighlightOn(ev)));
    body.querySelectorAll("div.biomes").forEach(el => el.addEventListener("mouseleave", ev => biomeHighlightOff(ev)));

    if (body.dataset.type === "percentage") {body.dataset.type = "absolute"; togglePercentageMode();}
    applySorting(biomesHeader);
    $("#biomesEditor").dialog({width: fitContent()});
  }

  function biomeHighlightOn(event) {
    if (customization === 6) return;
    const biome = biomesData.biomeList[+event.target.dataset.id];
    biomes.select("#biome"+biome.id).raise().transition(animate).attr("stroke-width", 2).attr("stroke", "#cd4c11");
  }

  function biomeHighlightOff(event) {
    if (customization === 6) return;
    const biome = biomesData.biomeList[+event.target.dataset.id];
    biomes.select("#biome"+biome.id).transition().attr("stroke-width", .7).attr("stroke", biome.color);
  }
  
  function biomeChangeColor(el) {
    const currentFill = el.getAttribute("fill");
    const biome = biomesData.biomeList[+el.parentNode.parentNode.dataset.id];

    const callback = function(fill) {
      el.setAttribute("fill", fill);
      biome.color = fill;
      biomes.select("#biome"+biome.id).attr("fill", biome.color).attr("stroke", fill);
    }

    openPicker(currentFill, callback);
  }
  
  function biomeChangeName(el) {
    const biome = biomesData.biomeList[+el.parentNode.dataset.id];
    el.parentNode.dataset.name = el.value;
    biome.name = el.value;
  }

  function biomeChangeHabitability(el) {
    const biome = biomesData.biomeList[+el.parentNode.dataset.id];
    const failed = isNaN(+el.value) || +el.value < 0 || +el.value > 9999;
    if (failed) {
      el.value = biome.habitability;
      tip("Please provide a valid number in range 0-9999", false, "error");
      return;
    }
    biome.habitability = +el.value;
    el.parentNode.dataset.habitability = el.value;
    recalculatePopulation();
    refreshBiomesEditor();
  }

  function openWiki(el) {
    const name = el.parentNode.dataset.name;
    if (name === "Custom" || !name) {tip("Please provide a biome name", false, "error"); return;}
    const wiki = "https://en.wikipedia.org/wiki/";

    switch (name) {
      case "Hot desert": openURL(wiki + "Desert_climate#Hot_desert_climates");
      case "Cold desert": openURL(wiki + "Desert_climate#Cold_desert_climates");
      case "Savanna": openURL(wiki + "Tropical_and_subtropical_grasslands,_savannas,_and_shrublands");
      case "Grassland": openURL(wiki + "Temperate_grasslands,_savannas,_and_shrublands");
      case "Tropical seasonal forest": openURL(wiki + "Seasonal_tropical_forest");
      case "Temperate deciduous forest": openURL(wiki + "Temperate_deciduous_forest");
      case "Tropical rainforest": openURL(wiki + "Tropical_rainforest");
      case "Temperate rainforest": openURL(wiki + "Temperate_rainforest");
      case "Taiga": openURL(wiki + "Taiga");
      case "Tundra": openURL(wiki + "Tundra");
      case "Glacier": openURL(wiki + "Glacier");
      case "Wetland": openURL(wiki + "Wetland");
      default: openURL(`https://en.wikipedia.org/w/index.php?search=${name}`);
    }
  }

  function toggleLegend() {
    if (legend.selectAll("*").size()) {clearLegend(); return;}; // hide legend
    const d = biomesData;
    const data = Array.from(d.biomeList)  //shallow copy existing array
      .filter(i => i.cells)               //remove biomes with 0 cells
      .sort((a, b) => b.area - a.area)    //sort by size
      .map(i => [i.id, i.color, i.name]); //return index, color, and name
    drawLegend("Biomes", data);
  }

  function togglePercentageMode() {
    if (body.dataset.type === "absolute") {
      body.dataset.type = "percentage";
      const totalCells = +biomesFooterCells.innerHTML;
      const totalArea = +biomesFooterArea.dataset.area;
      const totalPopulation = +biomesFooterPopulation.dataset.population;      

      body.querySelectorAll(":scope>  div").forEach(function(el) {
        el.querySelector(".biomeCells").innerHTML = rn(+el.dataset.cells / totalCells * 100) + "%";
        el.querySelector(".biomeArea").innerHTML = rn(+el.dataset.area / totalArea * 100) + "%";
        el.querySelector(".biomePopulation").innerHTML = rn(+el.dataset.population / totalPopulation * 100) + "%";        
      });
    } else {
      body.dataset.type = "absolute";
      biomesEditorAddLines();
    }
  }

  function addCustomBiome() {
    const b = biomesData.biomeList, i = b.length;
    b.push(new Biome("Custom", getRandomColor(), 50))
    b[i].id = i; //don't forget the ID!

    const unit = areaUnit.value === "square" ? " " + distanceUnitInput.value + "²" : " " + areaUnit.value;
    const line = `<div class="states biomes" data-id="${b[i].id}" data-name="${b[i].name}" data-habitability=${b[i].habitability} data-cells=0 data-area=0 data-population=0 data-color=${b[i].color}>
      <svg data-tip="Biomes fill style. Click to change" width=".9em" height=".9em" style="margin-bottom:-1px"><rect x="0" y="0" width="100%" height="100%" fill="${b[i].color}" class="zoneFill"></svg>
      <input data-tip="Biome name. Click and type to change" class="biomeName" value="${b[i].name}" autocorrect="off" spellcheck="false">
      <span data-tip="Biome habitability percent" class="hide">%</span>
      <input data-tip="Biome habitability percent. Click and set new value to change" type="number" min=0 max=9999 step=1 class="biomeHabitability hide" value=${b[i].habitability}>
      <span data-tip="Cells count" class="icon-check-empty hide"></span>
      <div data-tip="Cells count" class="biomeCells hide">${b[i].cells}</div>
      <span data-tip="Biome area" style="padding-right: 4px" class="icon-map-o hide"></span>
      <div data-tip="Biome area" class="biomeArea hide">0 ${unit}</div>
      <span data-tip="Total population: 0" class="icon-male hide"></span>
      <div data-tip="Total population: 0" class="biomePopulation hide">0</div>
      <span data-tip="Remove the custom biome" class="icon-trash-empty hide"></span>
    </div>`;

    body.insertAdjacentHTML("beforeend", line);
    biomesFooterBiomes.innerHTML = body.querySelectorAll(":scope > div").length;
    $("#biomesEditor").dialog({width: fitContent()});
  }

  function removeCustomBiome(el) {
    const biome = biomesData.biomeList[+el.parentNode.dataset.id];
    el.parentNode.remove();
    biome.name = "removed";
    biomesFooterBiomes.innerHTML = +biomesFooterBiomes.innerHTML - 1;
  }

  function regenerateIcons() {
    ReliefIcons();
    if (!layerIsOn("toggleRelief")) toggleRelief();
  }

  function downloadBiomesData() {
    const unit = areaUnit.value === "square" ? distanceUnitInput.value + "2" : areaUnit.value;
    let data = "Id,Biome,Color,Habitability,Cells,Area "+unit+",Population\n"; // headers

    body.querySelectorAll(":scope > div").forEach(function(el) {
      data += el.dataset.id + ",";
      data += el.dataset.name + ",";
      data += el.dataset.color + ",";
      data += el.dataset.habitability + "%,";
      data += el.dataset.cells + ",";
      data += el.dataset.area + ",";
      data += el.dataset.population + "\n";
    });

    const name = getFileName("Biomes") + ".csv";
    downloadFile(data, name);
  }

  function enterBiomesCustomizationMode() {
    if (!layerIsOn("toggleBiomes")) toggleBiomes();
    customization = 6;
    biomes.append("g").attr("id", "temp");

    document.querySelectorAll("#biomesBottom > button").forEach(el => el.style.display = "none");
    document.querySelectorAll("#biomesBottom > div").forEach(el => el.style.display = "block");
    body.querySelector("div.biomes").classList.add("selected");

    biomesEditor.querySelectorAll(".hide").forEach(el => el.classList.add("hidden"));
    body.querySelectorAll("div > input, select, span, svg").forEach(e => e.style.pointerEvents = "none");
    biomesFooter.style.display = "none";
    $("#biomesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg"}});

    tip("Click on biome to select, drag the circle to change biome", true);
    viewbox.style("cursor", "crosshair")
      .on("click", selectBiomeOnMapClick)
      .call(d3.drag().on("start", dragBiomeBrush))
      .on("touchmove mousemove", moveBiomeBrush);
  }

  function selectBiomeOnLineClick(line) {
    const selected = body.querySelector("div.selected");
    if (selected) selected.classList.remove("selected");
    line.classList.add("selected");
  }

  function selectBiomeOnMapClick() {
    const point = d3.mouse(this);
    const i = findCell(point[0], point[1]);
    if (pack.cells.h[i] < 20) {tip("You cannot reassign water via biomes. Please edit the Heightmap to change water", false, "error"); return;}

    const assigned = biomes.select("#temp").select("polygon[data-cell='"+i+"']");
    const biome = assigned.size() ? +assigned.attr("data-biome") : pack.cells.biome[i];

    body.querySelector("div.selected").classList.remove("selected");
    body.querySelector("div[data-id='"+biome+"']").classList.add("selected");    
  }

  function dragBiomeBrush() {
    const r = +biomesManuallyBrush.value;

    d3.event.on("drag", () => {
      if (!d3.event.dx && !d3.event.dy) return;
      const p = d3.mouse(this);
      moveCircle(p[0], p[1], r);
     
      const found = r > 5 ? findAll(p[0], p[1], r) : [findCell(p[0], p[1], r)];
      const selection = found.filter(isLand);
      if (selection) changeBiomeForSelection(selection);
    });
  }

  // change region within selection
  function changeBiomeForSelection(selection) {
    const temp = biomes.select("#temp");
    const selected = body.querySelector("div.selected");

    const biomeNew = biomesData.biomeList[+selected.dataset.id];
    const color = biomeNew.color;

    selection.forEach(function(i) {
      const exists = temp.select("polygon[data-cell='"+i+"']");
      const biomeOld = exists.size() ? +exists.attr("data-biome") : pack.cells.biome[i];
      if (biomeNew.id === biomeOld) return;

      // change of append new element
      if (exists.size()) exists.attr("data-biome", biomeNew.id).attr("fill", color).attr("stroke", color);
      else temp.append("polygon").attr("data-cell", i).attr("data-biome", biomeNew.id).attr("points", getPackPolygon(i)).attr("fill", color).attr("stroke", color);
    });
  }

  function moveBiomeBrush() {
    showMainTip();
    const point = d3.mouse(this);
    const radius = +biomesManuallyBrush.value;
    moveCircle(point[0], point[1], radius);
  }
  
  function applyBiomesChange() {
    const changed = biomes.select("#temp").selectAll("polygon");
    changed.each(function() {
      const i = +this.dataset.cell;
      const b = +this.dataset.biome;
      pack.cells.biome[i] = b;
    });
    
    if (changed.size()) {
      drawBiomes();
      refreshBiomesEditor();
    }
    exitBiomesCustomizationMode();
  }

  function exitBiomesCustomizationMode(close) {
    customization = 0;
    biomes.select("#temp").remove();
    removeCircle();

    document.querySelectorAll("#biomesBottom > button").forEach(el => el.style.display = "inline-block");
    document.querySelectorAll("#biomesBottom > div").forEach(el => el.style.display = "none");

    body.querySelectorAll("div > input, select, span, svg").forEach(e => e.style.pointerEvents = "all");
    biomesEditor.querySelectorAll(".hide").forEach(el => el.classList.remove("hidden"));
    biomesFooter.style.display = "block";
    if (!close) $("#biomesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg"}});

    restoreDefaultEvents();
    clearMainTip();
    const selected = document.querySelector("#biomesBody > div.selected");
    if (selected) selected.classList.remove("selected");
  }
  
  function restoreInitialBiomes() {
    biomesData = applyDefaultBiomesSystem();
    defineBiomes();
    drawBiomes();
    recalculatePopulation();
    refreshBiomesEditor();
  }

  function closeBiomesEditor() {
    exitBiomesCustomizationMode("close");
  }
}
