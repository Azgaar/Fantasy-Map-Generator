"use strict";
function editBiomes() {
  if (customization) return;
  closeDialogs("#biomesEditor, .stable");
  if (!layerIsOn("toggleBiomes")) toggleBiomes();
  if (layerIsOn("toggleStates")) toggleStates();
  if (layerIsOn("toggleCultures")) toggleCultures();

  const body = document.getElementById("biomesBody");
  const animate = d3.transition().duration(2000).ease(d3.easeSinIn);
  refreshBiomesEditor();

  if (modules.editBiomes) return;
  modules.editBiomes = true;

  $("#biomesEditor").dialog({
    title: "Biomes Editor", width: fitContent(), close: closeBiomesEditor,
    position: {my: "right top", at: "right-10 top+10", of: "svg"}
  });

  // add listeners
  document.getElementById("biomesEditorRefresh").addEventListener("click", refreshBiomesEditor);
  document.getElementById("biomesPercentage").addEventListener("click", togglePercentageMode);
  document.getElementById("biomesManually").addEventListener("click", enterBiomesCustomizationMode);
  document.getElementById("biomesManuallyApply").addEventListener("click", applyBiomesChange);
  document.getElementById("biomesManuallyCancel").addEventListener("click", exitBiomesCustomizationMode);
  document.getElementById("biomesRestore").addEventListener("click", restoreInitialBiomes);
  document.getElementById("biomesRegenerateReliefIcons").addEventListener("click", regenerateIcons);
  document.getElementById("biomesExport").addEventListener("click", downloadBiomesData);

  function refreshBiomesEditor() {
    biomesCollectStatistics();
    biomesEditorAddLines();
  }

  function biomesCollectStatistics() {
    const cells = pack.cells;
    biomesData.cells = new Uint32Array(biomesData.i.length);
    biomesData.area = new Uint32Array(biomesData.i.length);
    biomesData.rural = new Uint32Array(biomesData.i.length);
    biomesData.urban = new Uint32Array(biomesData.i.length);

    for (const i of cells.i) {
      if (cells.h[i] < 20) continue;
      const b = cells.biome[i];
      biomesData.cells[b] += 1;
      biomesData.area[b] += cells.area[i];
      biomesData.rural[b] += cells.pop[i];
      if (cells.burg[i]) biomesData.urban[b] += pack.burgs[cells.burg[i]].population;
    }
  }

  function biomesEditorAddLines() {
    const unit = areaUnit.value === "square" ? " " + distanceUnit.value + "²" : " " + areaUnit.value;
    const b = biomesData;
    let lines = "", totalArea = 0, totalPopulation = 0;;

    for (const i of b.i) {
      if (!i) continue; // ignore marine (water) biome
      const area = b.area[i] * distanceScale.value ** 2;
      const rural = b.rural[i] * populationRate.value;
      const urban = b.urban[i] * populationRate.value * urbanization.value;
      const population = rural + urban;
      const populationTip = `Total population: ${si(population)}; Rural population: ${si(rural)}; Urban population: ${si(urban)}`;
      totalArea += area;
      totalPopulation += population;

      lines += `<div class="states biomes" data-id="${i}" data-name="${b.name[i]}" data-habitability="${b.habitability[i]}"
      data-cells=${b.cells[i]} data-area=${area} data-population=${population} data-color=${b.color[i]}>
        <input data-tip="Biome color. Click to change" class="stateColor" type="color" value="${b.color[i]}">
        <input data-tip="Biome name. Click and type to change" class="biomeName" value="${b.name[i]}" autocorrect="off" spellcheck="false">
        <span data-tip="Biome habitability percent">%</span>
        <input data-tip="Biome habitability percent. Click and set new value to change" type="number" min=0 max=9999 step=1 class="biomeHabitability" value=${b.habitability[i]}>
        <span data-tip="Cells count" class="icon-check-empty"></span>
        <div data-tip="Cells count" class="biomeCells">${b.cells[i]}</div>
        <span data-tip="Biome area" style="padding-right: 4px" class="icon-map-o"></span>
        <div data-tip="Biome area" class="biomeArea">${si(area) + unit}</div>
        <span data-tip="${populationTip}" class="icon-male"></span>
        <div data-tip="${populationTip}" class="biomePopulation">${si(population)}</div>
      </div>`;
    }
    body.innerHTML = lines;

    // update footer
    biomesFooterBiomes.innerHTML = b.i.length - 1;
    biomesFooterCells.innerHTML = pack.cells.h.filter(h => h >= 20).length;
    biomesFooterArea.innerHTML = si(totalArea) + unit;
    biomesFooterPopulation.innerHTML = si(totalPopulation);
    biomesFooterArea.dataset.area = totalArea;
    biomesFooterPopulation.dataset.population = totalPopulation;

    // add listeners
    body.querySelectorAll("div.biomes").forEach(el => el.addEventListener("mouseenter", ev => biomeHighlightOn(ev)));
    body.querySelectorAll("div.biomes").forEach(el => el.addEventListener("mouseleave", ev => biomeHighlightOff(ev)));
    body.querySelectorAll("div.biomes").forEach(el => el.addEventListener("click", selectBiomeOnLineClick));
    body.querySelectorAll("div > input[type='color']").forEach(el => el.addEventListener("input", biomeChangeColor));
    body.querySelectorAll("div > input.biomeName").forEach(el => el.addEventListener("input", biomeChangeName));
    body.querySelectorAll("div > input.biomeHabitability").forEach(el => el.addEventListener("change", biomeChangeHabitability));

    if (body.dataset.type === "percentage") {body.dataset.type = "absolute"; togglePercentageMode();}
    applySorting(biomesHeader);
    $("#biomesEditor").dialog();
  }

  function biomeHighlightOn(event) {
    if (customization === 6) return;
    const biome = +event.target.dataset.id;
    biomes.select("#biome"+biome).raise().transition(animate).attr("stroke-width", 2).attr("stroke", "#cd4c11");
  }

  function biomeHighlightOff(event) {
    if (customization === 6) return;
    const biome = +event.target.dataset.id;
    const color = biomesData.color[biome];
    biomes.select("#biome"+biome).transition().attr("stroke-width", .7).attr("stroke", color);
  }
  
  function biomeChangeColor() {
    const biome = +this.parentNode.dataset.id;
    biomesData.color[biome] = this.value;
    biomes.select("#biome"+biome).attr("fill", this.value).attr("stroke", this.value);  
  }
  
  function biomeChangeName() {
    const biome = +this.parentNode.dataset.id;
    this.parentNode.dataset.name = this.value;
    biomesData.name[biome] = this.value;
  }

  function biomeChangeHabitability() {
    const biome = +this.parentNode.dataset.id;
    const failed = isNaN(+this.value) || +this.value < 0 || +this.value > 9999;
    if (failed) {
      this.value = biomesData.habitability[biome];
      tip("Please provide a valid number in range 0-9999", false, "error");
      return;
    }
    biomesData.habitability[biome] = +this.value;
    this.parentNode.dataset.habitability = this.value;
    recalculatePopulation();
    refreshBiomesEditor();
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

  function regenerateIcons() {
    ReliefIcons();
    if (!layerIsOn("toggleRelief")) toggleRelief();
  }

  function downloadBiomesData() {
    const unit = areaUnit.value === "square" ? distanceUnit.value + "2" : areaUnit.value;
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

    const dataBlob = new Blob([data], {type: "text/plain"});
    const url = window.URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    document.body.appendChild(link);
    link.download = "states_data" + Date.now() + ".csv";
    link.href = url;
    link.click();
    window.setTimeout(function() {window.URL.revokeObjectURL(url);}, 2000);    
  }

  function enterBiomesCustomizationMode() {
    if (!layerIsOn("toggleBiomes")) toggleBiomes();
    customization = 6;
    biomes.append("g").attr("id", "temp");
    body.querySelectorAll("div > *").forEach(e => e.disabled = true);

    document.querySelectorAll("#biomesBottom > button").forEach(el => el.style.display = "none");
    document.querySelectorAll("#biomesBottom > div").forEach(el => el.style.display = "block");
    body.querySelector("div.biomes").classList.add("selected");

    tip("Click on biome to select, drag the circle to change biome", true);
    viewbox.style("cursor", "crosshair").call(d3.drag()
      .on("drag", dragBiomeBrush))
      .on("click", selectBiomeOnMapClick)
      .on("touchmove mousemove", moveBiomeBrush);
  }

  function selectBiomeOnLineClick() {
    if (customization !== 6) return;
    const selected = body.querySelector("div.selected");
    if (selected) selected.classList.remove("selected");
    this.classList.add("selected");
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
    const p = d3.mouse(this);
    const r = +biomesManuallyBrush.value;
    moveCircle(p[0], p[1], r);
   
    const found = r > 5 ? findAll(p[0], p[1], r) : [findCell(p[0], p[1], r)];
    const selection = found.filter(isLand);
    if (selection) changeBiomeForSelection(selection);    
  }

  // change region within selection
  function changeBiomeForSelection(selection) {
    const temp = biomes.select("#temp");
    const selected = body.querySelector("div.selected");

    const biomeNew = selected.dataset.id;
    const color = biomesData.color[biomeNew];

    selection.forEach(function(i) {
      const exists = temp.select("polygon[data-cell='"+i+"']");
      const biomeOld = exists.size() ? +exists.attr("data-biome") : pack.cells.biome[i];
      if (biomeNew === biomeOld) return;

      // change of append new element
      if (exists.size()) exists.attr("data-biome", biomeNew).attr("fill", color).attr("stroke", color);
      else temp.append("polygon").attr("data-cell", i).attr("data-biome", biomeNew).attr("points", getPackPolygon(i)).attr("fill", color).attr("stroke", color);
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

  function exitBiomesCustomizationMode() {
    customization = 0;
    biomes.select("#temp").remove();
    removeCircle();
    document.querySelectorAll("#biomesBottom > button").forEach(el => el.style.display = "inline-block");
    document.querySelectorAll("#biomesBottom > div").forEach(el => el.style.display = "none");
    body.querySelectorAll("div > *").forEach(e => e.disabled = false);
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
    //biomes.on("mousemove", null).on("mouseleave", null);
    exitBiomesCustomizationMode();
  }
}
