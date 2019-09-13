// heightmap-editor module. To be added to window as for now
"use strict";

function editHeightmap() {
  void function selectEditMode() {
    alertMessage.innerHTML = `<p>Heightmap is a core element on which all other data (rivers, burgs, states etc) is based.
    So the best edit approach is to <i>erase</i> the secondary data and let the system automatically regenerate it on edit completion.</p> 

    <p>You can also <i>keep</i> all the data, but you won't be able to change the coastline.</p>

    <p>If you need to change the coastline and keep the data, you may try the <i>risk</i> edit option. 
    The data will be restored as much as possible, but the coastline change can cause unexpected fluctuations and errors.</p>

    <p>Check out <a href="https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Heightmap-customization" target="_blank">wiki</a> for guidance.</p>
    
    <p>Please save the map before edditing the heightmap!</p>`;

    $("#alert").dialog({resizable: false, title: "Edit Heightmap", width: "28em",
      buttons: {
        Save: function() {saveMap();},
        Erase: function() {enterHeightmapEditMode("erase");},
        Keep: function() {enterHeightmapEditMode("keep");},
        Risk: function() {enterHeightmapEditMode("risk");},
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }()

  let edits = [];
  restartHistory();

  if (modules.editHeightmap) return;
  modules.editHeightmap = true;

  // add listeners
  document.getElementById("paintBrushes").addEventListener("click", openBrushesPanel);
  document.getElementById("applyTemplate").addEventListener("click", openTemplateEditor);
  document.getElementById("convertImage").addEventListener("click", openImageConverter);
  document.getElementById("heightmapPreview").addEventListener("click", toggleHeightmapPreview);
  document.getElementById("finalizeHeightmap").addEventListener("click", finalizeHeightmap);
  document.getElementById("renderOcean").addEventListener("click", mockHeightmap);
  document.getElementById("templateUndo").addEventListener("click", () => restoreHistory(edits.n-1));
  document.getElementById("templateRedo").addEventListener("click", () => restoreHistory(edits.n+1));

  function enterHeightmapEditMode(type) {
    editHeightmap.layers = Array.from(mapLayers.querySelectorAll("li:not(.buttonoff)")).map(node => node.id); // store layers preset
    editHeightmap.layers.forEach(l => document.getElementById(l).click()); // turn off all layers

    customization = 1;
    closeDialogs();
    tip('Heightmap edit mode is active. Click on "Exit Customization" to finalize the heightmap', true);
    customizationMenu.style.display = "block";
    toolsContent.style.display = "none";
    heightmapEditMode.innerHTML = type;

    if (type === "erase") {
      terrs.attr("mask", null);
      undraw();
      changeOnlyLand.checked = false;
    } else if (type === "keep") {
      viewbox.selectAll("#landmass, #lakes").attr("display", "none");
      changeOnlyLand.checked = true;
    } else if (type === "risk") {
      terrs.attr("mask", null);
      defs.selectAll("#land, #water").selectAll("path").remove();
      viewbox.selectAll("#coastline *, #lakes *, #oceanLayers path").remove();
      changeOnlyLand.checked = false;
    }

    // hide convert and template buttons for the Keep mode
    applyTemplate.style.display = type === "keep" ? "none" : "inline-block";
    convertImage.style.display = type === "keep" ? "none" : "inline-block";

    openBrushesPanel();
    turnButtonOn("toggleHeight");
    layersPreset.value = "heightmap";
    layersPreset.disabled = true;
    mockHeightmap();
    viewbox.on("touchmove mousemove", moveCursor);
  }

  function moveCursor() {
    const p = d3.mouse(this), cell = findGridCell(p[0], p[1]);
    heightmapInfoX.innerHTML = rn(p[0]);
    heightmapInfoY.innerHTML = rn(p[1]);
    heightmapInfoCell.innerHTML = cell;
    heightmapInfoHeight.innerHTML = `${grid.cells.h[cell]} (${getHeight(grid.cells.h[cell])})`;
    if (tooltip.dataset.main) showMainTip();

    // move radius circle if drag mode is active
    const pressed = document.querySelector("#brushesButtons > button.pressed");
    if (!pressed) return;
    moveCircle(p[0], p[1], brushRadius.valueAsNumber, "#333");
  }

// get user-friendly (real-world) height value from map data
function getHeight(h) {
  const unit = heightUnit.value;
  let unitRatio = 3.281; // default calculations are in feet
  if (unit === "m") unitRatio = 1; // if meter
  else if (unit === "f") unitRatio = 0.5468; // if fathom

  let height = -990;
  if (h >= 20) height = Math.pow(h - 18, +heightExponentInput.value);
  else if (h < 20 && h > 0) height = (h - 20) / h * 50;

  return rn(height * unitRatio) + " " + unit;
}

  // Exit customization mode
  function finalizeHeightmap() {
    if (terrs.selectAll("*").size() < 200) {
      tip("Insufficient land area! There should be at least 200 land cells to finalize the heightmap", null, "error");
      return;
    }

    customization = 0;
    customizationMenu.style.display = "none";
    toolsContent.style.display = "block";
    layersPreset.disabled = false;
    restoreDefaultEvents();
    clearMainTip();
    closeDialogs();
    resetZoom();

    restartHistory();
    if (document.getElementById("preview")) document.getElementById("preview").remove();

    const mode = heightmapEditMode.innerHTML;
    if (mode === "erase") regenerateErasedData();
    else if (mode === "keep") restoreKeptData();
    else if (mode === "risk") restoreRiskedData();

    // restore initial layers
    terrs.selectAll("*").remove();
    turnButtonOff("toggleHeight");
    document.getElementById("mapLayers").querySelectorAll("li").forEach(function(e) {
      if (editHeightmap.layers.includes(e.id) && !layerIsOn(e.id)) e.click(); // turn on
      else if (!editHeightmap.layers.includes(e.id) && layerIsOn(e.id)) e.click(); // turn off
    });
    getCurrentPreset();
  }

  function regenerateErasedData() {
    console.group("Edit Heightmap");
    console.time("regenerateErasedData");
    terrs.attr("mask", "url(#land)");

    const change = changeHeights.checked;
    markFeatures();
    if (change) openNearSeaLakes();
    OceanLayers();
    calculateTemperatures();
    generatePrecipitation();
    reGraph();
    drawCoastline();

    elevateLakes();
    Rivers.generate();

    if (!change) {
      for (const i of pack.cells.i) {
        const g = pack.cells.g[i];
        if (pack.cells.h[i] !== grid.cells.h[g] && pack.cells.h[i] >= 20 === grid.cells.h[g] >= 20) pack.cells.h[i] = grid.cells.h[g];
      }
    }

    defineBiomes();

    rankCells();
    Cultures.generate();
    Cultures.expand();
    BurgsAndStates.generate();
    Religions.generate();
    drawStates();
    drawBorders();
    BurgsAndStates.drawStateLabels();
    addZone();
    addMarkers();
    console.timeEnd("regenerateErasedData");
    console.groupEnd("Edit Heightmap");
  }

  function restoreKeptData() {
    viewbox.selectAll("#landmass, #lakes").attr("display", null);
    for (const i of pack.cells.i) {
      pack.cells.h[i] = grid.cells.h[pack.cells.g[i]];
    }
  }

  function restoreRiskedData() {
    console.group("Edit Heightmap");
    console.time("restoreRiskedData");
    terrs.attr("mask", "url(#land)");

    // assign pack data to grid cells
    const change = changeHeights.checked;
    const l = grid.cells.i.length;
    const biome = new Uint8Array(l);
    const conf = new Uint8Array(l);
    const fl = new Uint16Array(l);
    const pop = new Uint16Array(l);
    const r = new Uint16Array(l);
    const road = new Uint16Array(l);
    const crossroad = new Uint16Array(l);
    const s = new Uint16Array(l);
    const burg = new Uint16Array(l);
    const state = new Uint16Array(l);
    const province = new Uint16Array(l);
    const culture = new Uint16Array(l);
    const religion = new Uint16Array(l);

    for (const i of pack.cells.i) {
      const g = pack.cells.g[i];
      biome[g] = pack.cells.biome[i];
      conf[g] = pack.cells.conf[i];
      culture[g] = pack.cells.culture[i];
      fl[g] = pack.cells.fl[i];
      pop[g] = pack.cells.pop[i];
      r[g] = pack.cells.r[i];
      road[g] = pack.cells.road[i];
      crossroad[g] = pack.cells.crossroad[i];
      s[g] = pack.cells.s[i];
      state[g] = pack.cells.state[i];
      province[g] = pack.cells.province[i];
      burg[g] = pack.cells.burg[i];
      religion[g] = pack.cells.religion[i];
    }

    // do not allow to remove land with burgs
    for (const i of grid.cells.i) {
      if (!burg[i]) continue;
      if (grid.cells.h[i] < 20) grid.cells.h[i] = 20;
    }

    // save culture centers x and y to restore center cell id after re-graph
    for (const c of pack.cultures) {
      if (!c.i || c.removed) continue;
      const p = pack.cells.p[c.center];
      c.x = p[0];
      c.y = p[1];
    }

    markFeatures();
    OceanLayers();
    calculateTemperatures();
    generatePrecipitation();
    reGraph();
    drawCoastline();

    if (change) {
      elevateLakes();
      Rivers.generate();
      defineBiomes();
    }

    // assign saved pack data from grid back to pack
    const n = pack.cells.i.length;
    pack.cells.pop = new Uint16Array(n);
    pack.cells.road = new Uint16Array(n);
    pack.cells.crossroad = new Uint16Array(n);
    pack.cells.s = new Uint16Array(n);
    pack.cells.burg = new Uint16Array(n);
    pack.cells.state = new Uint16Array(n);
    pack.cells.province = new Uint16Array(n);
    pack.cells.culture = new Uint16Array(n);
    pack.cells.religion = new Uint16Array(n);

    if (!change) {
      pack.cells.r = new Uint16Array(n);
      pack.cells.conf = new Uint8Array(n);
      pack.cells.fl = new Uint16Array(n);
      pack.cells.biome = new Uint8Array(n);
    }

    for (const i of pack.cells.i) {
      const g = pack.cells.g[i];
      const land = pack.cells.h[i] >= 20;

      if (!change) {
        pack.cells.r[i] = r[g];
        pack.cells.conf[i] = conf[g];
        pack.cells.fl[i] = fl[g];
        if (land && !biome[g]) pack.cells.biome[i] = getBiomeId(grid.cells.prec[g], grid.cells.temp[g]); else 
        if (!land && biome[g]) pack.cells.biome[i] = 0; else
        pack.cells.biome[i] = biome[g];
      }

      if (!land) continue;
      pack.cells.culture[i] = culture[g];
      pack.cells.pop[i] = pop[g];
      pack.cells.road[i] = road[g];
      pack.cells.crossroad[i] = crossroad[g];
      pack.cells.s[i] = s[g];
      pack.cells.state[i] = state[g];
      pack.cells.province[i] = province[g];
      pack.cells.religion[i] = religion[g];
    }

    for (const b of pack.burgs) {
      if (!b.i || b.removed) continue;
      b.cell = findCell(b.x, b.y);
      b.feature = pack.cells.f[b.cell];
      pack.cells.burg[b.cell] = b.i;
      if (!b.capital && pack.cells.h[b.cell] < 20) removeBurg(b.i);
      if (b.capital) pack.states[b.state].center = b.cell;
    }

    for (const p of pack.provinces) {
      if (!p.i || p.removed) continue;
      const provCells = pack.cells.i.filter(i => pack.cells.province[i] === p.i);
      if (!provCells.length) {
        const state = p.state;
        const stateProvs = pack.states[state].provinces;
        if (stateProvs.includes(p.i)) pack.states[state].provinces.splice(stateProvs.indexOf(p), 1);
  
        p.removed = true;
        continue;
      }

      if (p.burg && !pack.burgs[p.burg].removed) p.center = pack.burgs[p.burg].cell;
      else {p.center = provCells[0]; p.burg = pack.cells.burg[p.center];}
    }

    for (const c of pack.cultures) {
      if (!c.i || c.removed) continue;
      c.center = findCell(c.x, c.y);
    }

    BurgsAndStates.drawStateLabels();
    drawStates();
    drawBorders();

    console.timeEnd("restoreRiskedData");
    console.groupEnd("Edit Heightmap");
  }

  // trigger heightmap redraw and history update if at least 1 cell is changed
  function updateHeightmap() {
    const prev = last(edits);
    const changed = grid.cells.h.reduce((s, h, i) => h !== prev[i] ? s+1 : s, 0);
    tip("Cells changed: " + changed);
    if (!changed) return;

    // check ocean cells are not checged if olny land edit is allowed
    if (changeOnlyLand.checked) {
      for (const i of grid.cells.i) {
        if (prev[i] < 20 || grid.cells.h[i] < 20) grid.cells.h[i] = prev[i];
      }
    }

    mockHeightmap();
    updateHistory();
  }

  // draw or update heightmap
  function mockHeightmap() {
    const data = renderOcean.checked ? grid.cells.i : grid.cells.i.filter(i => grid.cells.h[i] >= 20);
    const scheme = getColorScheme();
    terrs.selectAll("polygon").data(data).join("polygon").attr("points", d => getGridPolygon(d))
      .attr("id", d => "cell"+d).attr("fill", d => getColor(grid.cells.h[d], scheme));
  }

  // draw or update heightmap for a selection of cells
  function mockHeightmapSelection(selection) {
    const ocean = renderOcean.checked;
    const scheme = getColorScheme();

    selection.forEach(function(i) {
      let cell = terrs.select("#cell"+i);
      if (!ocean && grid.cells.h[i] < 20) {cell.remove(); return;}
      if (!cell.size()) cell = terrs.append("polygon").attr("points", getGridPolygon(i)).attr("id", "cell"+i);
      cell.attr("fill", getColor(grid.cells.h[i], scheme));
    });
  }

  function updateStatistics() {
    const landCells = grid.cells.h.reduce((s, h) => h >= 20 ? s+1 : s);
    landmassCounter.innerHTML = `${landCells} (${rn(landCells/grid.cells.i.length*100)}%)`;
    landmassAverage.innerHTML = rn(d3.mean(grid.cells.h));    
  }

  function updateHistory(noStat) {
    const step = edits.n;
    edits = edits.slice(0, step);
    edits[step] = grid.cells.h.slice();
    edits.n = step + 1;

    undo.disabled = templateUndo.disabled = edits.n <= 1;
    redo.disabled = templateRedo.disabled = true;
    if (!noStat) updateStatistics();

    if (document.getElementById("preview")) drawHeightmapPreview(); // update heightmap preview if opened
  }

  // restoreHistory
  function restoreHistory(step) {
    edits.n = step;
    redo.disabled = templateRedo.disabled = edits.n >= edits.length;
    undo.disabled = templateUndo.disabled = edits.n <= 1;
    if (edits[edits.n - 1] === undefined) return;
    grid.cells.h = edits[edits.n - 1].slice();
    mockHeightmap();
    updateStatistics();
    
    if (document.getElementById("preview")) drawHeightmapPreview(); // update heightmap preview if opened
  }

  // restart edits from 1st step
  function restartHistory() {
    edits = [];
    edits.n = 0;
    redo.disabled = templateRedo.disabled = true;
    undo.disabled = templateUndo.disabled = true;
    updateHistory();
  }

  function openBrushesPanel() {
    if ($("#brushesPanel").is(":visible")) return;
    $("#brushesPanel").dialog({
      title: "Paint Brushes", resizable: false,
      position: {my: "right top", at: "right-10 top+10", of: "svg"}
    }).on('dialogclose', exitBrushMode);

    if (modules.openBrushesPanel) return;
    modules.openBrushesPanel = true;

    // add listeners
    document.getElementById("brushesButtons").addEventListener("click", e => toggleBrushMode(e));
    document.getElementById("changeOnlyLand").addEventListener("click", e => changeOnlyLandClick(e));
    document.getElementById("undo").addEventListener("click", () => restoreHistory(edits.n-1));
    document.getElementById("redo").addEventListener("click", () => restoreHistory(edits.n+1));  
    document.getElementById("rescaleShow").addEventListener("click", () => {
      document.getElementById("modifyButtons").style.display = "none";
      document.getElementById("rescaleSection").style.display = "block";    
    });
    document.getElementById("rescaleHide").addEventListener("click", () => {
      document.getElementById("modifyButtons").style.display = "block";
      document.getElementById("rescaleSection").style.display = "none";    
    }); 
    document.getElementById("rescaler").addEventListener("change", (e) => rescale(e.target.valueAsNumber));
    document.getElementById("rescaleCondShow").addEventListener("click", () => {
      document.getElementById("modifyButtons").style.display = "none";
      document.getElementById("rescaleCondSection").style.display = "block";
    });
    document.getElementById("rescaleCondHide").addEventListener("click", () => {
      document.getElementById("modifyButtons").style.display = "block";
      document.getElementById("rescaleCondSection").style.display = "none";
    });
    document.getElementById("rescaleExecute").addEventListener("click", rescaleWithCondition);
    document.getElementById("smoothHeights").addEventListener("click", smoothAllHeights);
    document.getElementById("disruptHeights").addEventListener("click", disruptAllHeights);
    document.getElementById("brushClear").addEventListener("click", startFromScratch);
    
    function exitBrushMode() {
      const pressed = document.querySelector("#brushesButtons > button.pressed");
      if (!pressed) return;
      pressed.classList.remove("pressed");

      viewbox.style("cursor", "default").on(".drag", null);
      removeCircle();
      document.getElementById("brushesSliders").style.display = "none";
    }

    function toggleBrushMode(e) {
      if (e.target.classList.contains("pressed")) {exitBrushMode(); return;}
      exitBrushMode();
      document.getElementById("brushesSliders").style.display = "block";
      e.target.classList.add("pressed");
      viewbox.style("cursor", "crosshair").call(d3.drag().on("start", dragBrush));
    }

    function dragBrush() {
      const r = brushRadius.valueAsNumber;
      const point = d3.mouse(this);
      const start = findGridCell(point[0], point[1]);

      d3.event.on("drag", () => {
        const p = d3.mouse(this);
        moveCircle(p[0], p[1], r, "#333");
        if (~~d3.event.sourceEvent.timeStamp % 5 != 0) return; // slow down the edit

        const inRadius = findGridAll(p[0], p[1], r);
        const selection = changeOnlyLand.checked ? inRadius.filter(i => grid.cells.h[i] >= 20) : inRadius;
        if (selection && selection.length) changeHeightForSelection(selection, start);
      });

      d3.event.on("end", updateHeightmap);
    }

    function changeHeightForSelection(s, start) {
      const power = brushPower.valueAsNumber;
      const interpolate = d3.interpolateRound(power, 1);
      const land = changeOnlyLand.checked;
      function lim(v) {return Math.max(Math.min(v, 100), land ? 20 : 0);}
      const h = grid.cells.h;

      const brush = document.querySelector("#brushesButtons > button.pressed").id;
      if (brush === "brushRaise") s.forEach(i => h[i] = h[i] < 20 ? 20 : lim(h[i] + power)); else
      if (brush === "brushElevate") s.forEach((i,d) => h[i] = lim(h[i] + interpolate(d/Math.max(s.length-1, 1)))); else
      if (brush === "brushLower") s.forEach(i => h[i] = lim(h[i] - power)); else
      if (brush === "brushDepress") s.forEach((i,d) => h[i] = lim(h[i] - interpolate(d/Math.max(s.length-1, 1)))); else
      if (brush === "brushAlign") s.forEach(i => h[i] = lim(h[start])); else
      if (brush === "brushSmooth") s.forEach(i => h[i] = rn((d3.mean(grid.cells.c[i].filter(i => land ? h[i] >= 20 : 1).map(c => h[c])) + h[i]*(10-power)) / (11-power),1)); else
      if (brush === "brushDisrupt") s.forEach(i => h[i] = h[i] < 17 ? h[i] : lim(h[i] + power/2 - Math.random()*power));

      mockHeightmapSelection(s);
      // updateHistory(); uncomment to update history every step
    }

    function changeOnlyLandClick(e) {
      if (heightmapEditMode.innerHTML !== "keep") return;
      e.preventDefault();
      tip("You cannot change the coastline in 'Keep' edit mode", false, "error");
    }

    function rescale(v) {
      const land = changeOnlyLand.checked;
      grid.cells.h = grid.cells.h.map(h => land && (h < 20 || h+v < 20) ? h : lim(h+v));
      updateHeightmap();
      document.getElementById("rescaler").value = 0;
    }

    function rescaleWithCondition() {
      const range = rescaleLower.value + "-" + rescaleHigher.value;
      const operator = conditionSign.value;
      const operand = rescaleModifier.valueAsNumber;
      if (Number.isNaN(operand)) {tip("Operand should be a number", false, "error"); return;}
      if ((operator === "add" || operator === "subtract") && !Number.isInteger(operand)) {tip("Operand should be an integer", false, "error"); return;}

      if (operator === "multiply") HeightmapGenerator.modify(range, 0, operand, 0); else
      if (operator === "divide") HeightmapGenerator.modify(range, 0, 1 / operand, 0); else
      if (operator === "add") HeightmapGenerator.modify(range, operand, 1, 0); else
      if (operator === "subtract") HeightmapGenerator.modify(range, -1 * operand, 1, 0); else
      if (operator === "exponent") HeightmapGenerator.modify(range, 0, 1, operand);
      
      updateHeightmap();
    }

    function smoothAllHeights() {
      HeightmapGenerator.smooth(4);
      updateHeightmap();
    }

    function disruptAllHeights() {
      grid.cells.h = grid.cells.h.map(h => h < 17 ? h : lim(h + 2 - Math.random()*4));
      updateHeightmap();
    }
  
    function startFromScratch() {
      if (changeOnlyLand.checked) {tip("Not allowed when 'Change only land cells' mode is set", false, "error"); return;}
      const someHeights = grid.cells.h.some(h => h);
      if (!someHeights) {tip("Heightmap is already cleared, please do not click twice if not required", false, "error"); return;}
      grid.cells.h = new Uint8Array(grid.cells.i.length);
      terrs.selectAll("*").remove();
      updateHistory();
    }
    
  }

  function openTemplateEditor() {
    if ($("#templateEditor").is(":visible")) return;
    const body = document.getElementById("templateBody");

    $("#templateEditor").dialog({
      title: "Template Editor", minHeight: "auto", width: "fit-content", resizable: false,
      position: {my: "right top", at: "right-10 top+10", of: "svg"}
    });

    if (modules.openTemplateEditor) return;
    modules.openTemplateEditor = true;
    
    $("#templateBody").sortable({items: "div", handle: ".icon-resize-vertical", containment: "parent", axis: "y"});

    // add listeners
    body.addEventListener("click", function(ev) {
      const el = ev.target;
      if (el.classList.contains("icon-check")) {
        el.classList.remove("icon-check");
        el.classList.add("icon-check-empty");
        el.parentElement.style.opacity = .5;
        body.dataset.changed = 1;
        return;
      }
      if (el.classList.contains("icon-check-empty")) {
        el.classList.add("icon-check");
        el.classList.remove("icon-check-empty");
        el.parentElement.style.opacity = 1;
        return;
      }
      if (el.classList.contains("icon-trash-empty")) {
        el.parentElement.remove(); return;
      }
    });

    document.getElementById("templateTools").addEventListener("click", e => addStepOnClick(e));
    document.getElementById("templateSelect").addEventListener("change", e => selectTemplate(e));
    document.getElementById("templateRun").addEventListener("click", executeTemplate);
    document.getElementById("templateSave").addEventListener("click", downloadTemplate);
    document.getElementById("templateLoad").addEventListener("click", e => templateToLoad.click());
    document.getElementById("templateToLoad").addEventListener("change", uploadTemplate);

    function addStepOnClick(e) {
      if (e.target.tagName !== "BUTTON") return;
      const type = e.target.id.replace("template", "");
      document.getElementById("templateBody").dataset.changed = 1;
      addStep(type);
    }

    function addStep(type, count, dist, arg4, arg5) {
      const body = document.getElementById("templateBody"); 
      body.insertAdjacentHTML("beforeend", getStepHTML(type, count, dist, arg4, arg5));
      const elDist = body.querySelector("div:last-child").querySelector(".templateDist");
      if (elDist) elDist.addEventListener("change", setRange);
      if (dist && elDist && elDist.tagName === "SELECT") {
        for (const o of elDist.options) {if (o.value === dist) elDist.value = dist;}
        if (elDist.value !== dist) {
          const opt = document.createElement("option");
          opt.value = opt.innerHTML = dist;
          elDist.add(opt);
          elDist.value = dist;
        }
      }
    }

    function getStepHTML(type, count, arg3, arg4, arg5) {
      const Trash = `<i class="icon-trash-empty pointer" data-tip="Click to remove the step"></i>`;
      const Hide = `<div class="icon-check" data-tip="Click to skip the step"></div>`;
      const Reorder = `<i class="icon-resize-vertical" data-tip="Drag to reorder"></i>`;
      const common = `<div data-type="${type}">${Hide}<div style="width:4em">${type}</div>${Trash}${Reorder}`;

      const TempY = `<span>y:<input class="templateY" data-tip="Placement range percentage along Y axis (minY-maxY)" value=${arg5||"20-80"}></span>`;
      const TempX = `<span>x:<input class="templateX" data-tip="Placement range percentage along X axis (minX-maxX)" value=${arg4||"15-85"}></span>`;
      const Height = `<span>h:<input class="templateHeight" data-tip="Blob maximum height, use hyphen to get a random number in range" value=${arg3||"40-50"}></span>`;
      const Count = `<span>n:<input class="templateCount" data-tip="Blobs to add, use hyphen to get a random number in range" value=${count||"1-2"}></span>`;
      const blob = `${common}${TempY}${TempX}${Height}${Count}</div>`;

      if (type === "Hill" || type === "Pit" || type === "Range" || type === "Trough") return blob;
      if (type === "Strait") return `${common}<span>d:<select class="templateDist" data-tip="Strait direction"><option value="vertical" selected>vertical</option><option value="horizontal">horizontal</option></select></span><span>w:<input class="templateCount" data-tip="Strait width, use hyphen to get a random number in range" value=${count||"2-7"}></span></div>`;
      if (type === "Add") return `${common}<span>to:<select class="templateDist" data-tip="Change only land or all cells"><option value="all" selected>all cells</option><option value="land">land only</option><option value="interval">interval</option></select></span><span>v:<input class="templateCount" data-tip="Add value to height of all cells (negative values are allowed)" type="number" value=${count||-10} min=-100 max=100 step=1></span></div>`;
      if (type === "Multiply") return `${common}<span>to:<select class="templateDist" data-tip="Change only land or all cells"><option value="all" selected>all cells</option><option value="land">land only</option><option value="interval">interval</option></select></span><span>v:<input class="templateCount" data-tip="Multiply all cells Height by the value" type="number" value=${count||1.1} min=0 max=10 step=.1></span></div>`;
      if (type === "Smooth") return `${common}<span>f:<input class="templateCount" data-tip="Set smooth fraction. 1 - full smooth, 2 - half-smooth, etc." type="number" min=1 max=10 value=${count||2}></span></div>`;
    }

    function setRange(event) {
      if (event.target.value !== "interval") return;
      const interval = prompt("Set a height interval. E.g. '17-20'. Avoid space, use hyphen as a separator");
      if (!interval || interval === "") return;
      const opt = document.createElement("option");
      opt.value = opt.innerHTML = interval;
      event.target.add(opt);
      event.target.value = interval;
    }

    function selectTemplate(e) {
      const body = document.getElementById("templateBody");
      const steps = body.querySelectorAll("div").length;
      const changed = +body.getAttribute("data-changed");
      const template = e.target.value;
      if (!steps || !changed) {changeTemplate(template); return;}

      alertMessage.innerHTML = "Are you sure you want to select a different template? All changes will be lost.";
      $("#alert").dialog({resizable: false, title: "Change Template",
        buttons: {
          Change: function() {changeTemplate(template); $(this).dialog("close");},
          Cancel: function() {$(this).dialog("close");}}
      });
    }

    function changeTemplate(template) {
      const body = document.getElementById("templateBody");
      body.setAttribute("data-changed", 0);
      body.innerHTML = "";

      if (template === "templateVolcano") {
        addStep("Hill", "1", "90-100", "44-56", "40-60");
        addStep("Multiply", .8, "50-100");
        addStep("Range", "1.5", "30-55", "45-55", "40-60");
        addStep("Smooth", 2);
        addStep("Hill", "1.5", "25-35", "25-30", "20-75");
        addStep("Hill", "1", "25-35", "75-80", "25-75");
        addStep("Hill", "0.5", "20-25", "10-15", "20-25");
      }

      else if (template === "templateHighIsland") {
        addStep("Hill", "1", "90-100", "65-75", "47-53");
        addStep("Add", 5, "all");
        addStep("Hill", "6", "20-23", "25-55", "45-55");
        addStep("Range", "1", "40-50", "45-55", "45-55");
        addStep("Smooth", 2);
        addStep("Trough", "2-3", "20-30", "20-30", "20-30");
        addStep("Trough", "2-3", "20-30", "60-80", "70-80");
        addStep("Hill", "1", "10-15", "60-60", "50-50");
        addStep("Hill", "1.5", "13-16", "15-20", "20-75");
        addStep("Multiply", .8, "20-100");
        addStep("Range", "1.5", "30-40", "15-85", "30-40");
        addStep("Range", "1.5", "30-40", "15-85", "60-70");
        addStep("Pit", "2-3", "10-15", "15-85", "20-80");
      }

      else if (template === "templateLowIsland") {
        addStep("Hill", "1", "90-99", "60-80", "45-55");
        addStep("Hill", "4-5", "25-35", "20-65", "40-60");
        addStep("Range", "1", "40-50", "45-55", "45-55");
        addStep("Smooth", 3);
        addStep("Trough", "1.5", "20-30", "15-85", "20-30");
        addStep("Trough", "1.5", "20-30", "15-85", "70-80");
        addStep("Hill", "1.5", "10-15", "5-15", "20-80");
        addStep("Hill", "1", "10-15", "85-95", "70-80");
        addStep("Pit", "3-5", "10-15", "15-85", "20-80");
        addStep("Multiply", .4, "20-100");
      }

      else if (template === "templateContinents") {
        addStep("Hill", "1", "80-85", "75-80", "40-60");
        addStep("Hill", "1", "80-85", "20-25", "40-60");
        addStep("Multiply", .22, "20-100");
        addStep("Hill", "5-6", "15-20", "25-75", "20-82");
        addStep("Range", ".8", "30-60", "5-15", "20-45");
        addStep("Range", ".8", "30-60", "5-15", "55-80");
        addStep("Range", "0-3", "30-60", "80-90", "20-80");
        addStep("Trough", "3-4", "15-20", "15-85", "20-80");
        addStep("Strait", "2", "vertical");
        addStep("Smooth", 2);
        addStep("Trough", "1-2", "5-10", "45-55", "45-55");
        addStep("Pit", "3-4", "10-15", "15-85", "20-80");
        addStep("Hill", "1", "5-10", "40-60", "40-60");
      }

      else if (template === "templateArchipelago") {
        addStep("Add", 11, "all");
        addStep("Range", "2-3", "40-60", "20-80", "20-80");
        addStep("Hill", "5", "15-20", "10-90", "30-70");
        addStep("Hill", "2", "10-15", "10-30", "20-80");
        addStep("Hill", "2", "10-15", "60-90", "20-80");
        addStep("Smooth", 3);
        addStep("Trough", "10", "20-30", "5-95", "5-95");
        addStep("Strait", "2", "vertical");
        addStep("Strait", "2", "horizontal");
      }

      else if (template === "templateAtoll") {
        addStep("Hill", "1", "75-80", "50-60", "45-55");
        addStep("Hill", "1.5", "30-50", "25-75", "30-70");
        addStep("Hill", ".5", "30-50", "25-35", "30-70");
        addStep("Smooth", 1);
        addStep("Multiply", .2, "25-100");
        addStep("Hill", ".5", "10-20", "50-55", "48-52"); 
      }

      else if (template === "templateMediterranean") {
        addStep("Range", "3-4", "30-50", "0-100", "0-10");
        addStep("Range", "3-4", "30-50", "0-100", "90-100");
        addStep("Hill", "5-6", "30-70", "0-100", "0-5");
        addStep("Hill", "5-6", "30-70", "0-100", "95-100");
        addStep("Smooth", 1);
        addStep("Hill", "2-3", "30-70", "0-5", "20-80");
        addStep("Hill", "2-3", "30-70", "95-100", "20-80");
        addStep("Multiply", .8, "land");
        addStep("Trough", "3-5", "40-50", "0-100", "0-10");
        addStep("Trough", "3-5", "40-50", "0-100", "90-100");
      }

      else if (template === "templatePeninsula") {
        addStep("Range", "2-3", "20-35", "40-50", "0-15");
        addStep("Add", 5, "all");
        addStep("Hill", "1", "90-100", "10-90", "0-5");
        addStep("Add", 13, "all");
        addStep("Hill", "3-4", "3-5", "5-95", "80-100");
        addStep("Hill", "1-2", "3-5", "5-95", "40-60");
        addStep("Trough", "5-6", "10-25", "5-95", "5-95");
        addStep("Smooth", 3);
      }

      else if (template === "templatePangea") {
        addStep("Hill", "1-2", "25-40", "15-50", "0-10");
        addStep("Hill", "1-2", "5-40", "50-85", "0-10");
        addStep("Hill", "1-2", "25-40", "50-85", "90-100");
        addStep("Hill", "1-2", "5-40", "15-50", "90-100");
        addStep("Hill", "8-12", "20-40", "20-80", "48-52");
        addStep("Smooth", 2);
        addStep("Multiply", .7, "land");
        addStep("Trough", "3-4", "25-35", "5-95", "10-20");
        addStep("Trough", "3-4", "25-35", "5-95", "80-90");
        addStep("Range", "5-6", "30-40", "10-90", "35-65");
      }

      else if (template === "templateIsthmus") {
        addStep("Hill", "5-10", "15-30", "0-30", "0-20");
        addStep("Hill", "5-10", "15-30", "10-50", "20-40");
        addStep("Hill", "5-10", "15-30", "30-70", "40-60");
        addStep("Hill", "5-10", "15-30", "50-90", "60-80");
        addStep("Hill", "5-10", "15-30", "70-100", "80-100");
        addStep("Smooth", 2);
        addStep("Trough", "4-8", "15-30", "0-30", "0-20");
        addStep("Trough", "4-8", "15-30", "10-50", "20-40");
        addStep("Trough", "4-8", "15-30", "30-70", "40-60");
        addStep("Trough", "4-8", "15-30", "50-90", "60-80");
        addStep("Trough", "4-8", "15-30", "70-100", "80-100");
      }

    }

    function executeTemplate() {
      const body = document.getElementById("templateBody");
      const steps = body.querySelectorAll("#templateBody > div");
      if (!steps.length) return;

      grid.cells.h = new Uint8Array(grid.cells.i.length); // clean all heights

      for (const s of steps) {
        if (s.style.opacity == .5) continue;
        const type = s.getAttribute("data-type");
        const elCount = s.querySelector(".templateCount") || "";
        const elHeight = s.querySelector(".templateHeight") || "";

        const elDist = s.querySelector(".templateDist");
        const dist = elDist ? elDist.value : null;

        const templateX = s.querySelector(".templateX");
        const x = templateX ? templateX.value : null;
        const templateY = s.querySelector(".templateY");
        const y = templateY ? templateY.value : null;

        if (type === "Hill") HeightmapGenerator.addHill(elCount.value, elHeight.value, x, y); else
        if (type === "Pit") HeightmapGenerator.addPit(elCount.value, elHeight.value, x, y); else
        if (type === "Range") HeightmapGenerator.addRange(elCount.value, elHeight.value, x, y); else
        if (type === "Trough") HeightmapGenerator.addTrough(elCount.value, elHeight.value, x, y); else
        if (type === "Strait") HeightmapGenerator.addStrait(elCount.value, dist); else
        if (type === "Add") HeightmapGenerator.modify(dist, +elCount.value, 1); else
        if (type === "Multiply") HeightmapGenerator.modify(dist, 0, +elCount.value); else
        if (type === "Smooth") HeightmapGenerator.smooth(+elCount.value);

        updateHistory("noStat"); // update history every step
      }

      updateStatistics();
      mockHeightmap();
    }

    function downloadTemplate() {
      const body = document.getElementById("templateBody");
      body.dataset.changed = 0;
      const steps = body.querySelectorAll("#templateBody > div");
      if (!steps.length) return;

      let stepsData = "";
      for (const s of steps) {
        if (s.style.opacity == .5) continue;
        const type = s.getAttribute("data-type");
        const elCount = s.querySelector(".templateCount");
        const count = elCount ? elCount.value : "0";
        const elHeight = s.querySelector(".templateHeight");
        const elDist = s.querySelector(".templateDist");
        const arg3 = elHeight ? elHeight.value : elDist ? elDist.value : "0";
        const templateX = s.querySelector(".templateX");
        const x = templateX ? templateX.value : "0";
        const templateY = s.querySelector(".templateY");
        const y = templateY ? templateY.value : "0";
        stepsData += `${type} ${count} ${arg3} ${x} ${y}\r\n`;
      }

      const dataBlob = new Blob([stepsData], {type: "text/plain"});
      const url = window.URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.download = "template_" + Date.now() + ".txt";
      link.href = url;
      link.click();
    }

    function uploadTemplate(c) {
      const body = document.getElementById("templateBody");
      const el = document.getElementById("templateToLoad");
      const fileToLoad = el.files[0];
      el.value = "";
      const fileReader = new FileReader();

      fileReader.onload = function(e) {
        const dataLoaded = e.target.result;
        const steps = dataLoaded.split("\r\n");
        if (!steps.length) {tip("Cannot parse the template, please check the file", false, "error"); return;}
        body.innerHTML = "";
        for (const s of steps) {
          const step = s.split(" ");
          if (step.length !== 5) {console.error("Cannot parse step, wrong arguments count", s); continue;}
          addStep(step[0], step[1], step[2], step[3], step[4]);
        }
      }
      
      fileReader.readAsText(fileToLoad, "UTF-8");
    }
  }

  function openImageConverter() {
    if ($("#imageConverter").is(":visible")) return;
    closeDialogs("#imageConverter");

    $("#imageConverter").dialog({
      title: "Image Converter", minHeight: "auto", width: "19.5em", resizable: false,
      position: {my: "right top", at: "right-10 top+10", of: "svg"}
    }).on('dialogclose', closeImageConverter);

    // create canvas for image
    const canvas = document.createElement("canvas");
    canvas.id = "canvas";
    canvas.width = graphWidth;
    canvas.height = graphHeight;
    document.body.insertBefore(canvas, optionsContainer);
    setOverlayOpacity(0);
    
    document.getElementById("convertImageLoad").classList.add("glow"); // add glow effect
    tip('Image Converter is opened. Upload the image and assign the colors to desired heights', true, "warn"); // main tip

    // remove all heights
    grid.cells.h = new Uint8Array(grid.cells.i.length);
    terrs.selectAll("*").remove();
    updateHistory();

    if (modules.openImageConverter) return;
    modules.openImageConverter = true;

    // add color pallete
    void function createColorPallete() {
      const container = d3.select("#colorScheme");
      container.selectAll("div").data(d3.range(101)).enter().append("div").attr("data-color", i => i)
        .style("background-color", i => color(1-i/100))
        .style("width", i => i < 20 || i > 70 ? ".2em" : ".1em")
        .on("touchmove mousemove", showPalleteHeight).on("click", assignHeight);
    }()

    // add listeners
    document.getElementById("convertImageLoad").addEventListener("click", () => imageToLoad.click());
    document.getElementById("imageToLoad").addEventListener("change", loadImage);
    document.getElementById("convertAutoLum").addEventListener("click", () => autoAssing("lum"));
    document.getElementById("convertAutoHue").addEventListener("click", () => autoAssing("hue"));
    document.getElementById("convertColorsPlus").addEventListener("click", () => changeConvertColorsNumber(1));
    document.getElementById("convertColorsMinus").addEventListener("click", () => changeConvertColorsNumber(-1));
    document.getElementById("convertComplete").addEventListener("click", () => $("#imageConverter").dialog("close"));
    document.getElementById("convertOverlay").addEventListener("input", function() {setOverlayOpacity(this.value)});
    document.getElementById("convertOverlayNumber").addEventListener("input", function() {setOverlayOpacity(this.value)});

    function showPalleteHeight() {
      colorsSelectValue.innerHTML = this.getAttribute("data-color");
      const former = colorScheme.querySelector(".hoveredColor")
      if (former) former.className = "";
      this.className = "hoveredColor";
    }

    function loadImage() {
      const file = this.files[0];
      this.value = ""; // reset input value to get triggered if the file is re-uploaded
      const reader = new FileReader();
      const img = new Image;

      img.onload = function() {
        const ctx = document.getElementById("canvas").getContext("2d");
        ctx.drawImage(img, 0, 0, graphWidth, graphHeight);
        heightsFromImage(+convertColors.value);
        resetZoom();
        convertImageLoad.classList.remove("glow");
      };

      reader.onloadend = function() {img.src = reader.result;};
      reader.readAsDataURL(file);
    }

    function heightsFromImage(count) {
      const ctx = document.getElementById("canvas").getContext("2d");
      const imageData = ctx.getImageData(0, 0, graphWidth, graphHeight);
      const data = imageData.data;

      terrs.selectAll("*").remove();
      d3.select("#imageConverter").selectAll("div.color-div").remove();
      colorsSelect.style.display = "block";
      colorsUnassigned.style.display = "block";
      colorsAssigned.style.display = "none";

      const gridColors = grid.points.map(p => {
        const x = Math.floor(p[0]-.01), y = Math.floor(p[1]-.01);
        const i = (x + y * graphWidth) * 4;
        const r = data[i], g = data[i+1], b = data[i+2];
        return [r, g, b];
      });

      const cmap = MMCQ.quantize(gridColors, count);
      const usedColors = new Set();

      terrs.selectAll("polygon").data(grid.cells.i).join("polygon").attr("points", d => getGridPolygon(d))
        .attr("id", d => "cell"+d).attr("fill", d => {
          const clr = `rgb(${cmap.nearest(gridColors[d])})`;
          usedColors.add(clr);
          return clr;
        }).on("click", mapClicked);

      const unassigned = [...usedColors].sort((a, b) => d3.lab(a).l - d3.lab(b).l);
      const unassignedContainer = d3.select("#colorsUnassigned");
      unassignedContainer.selectAll("div").data(unassigned).enter().append("div")
        .attr("data-color", i => i).style("background-color", i => i)
        .attr("class", "color-div").on("click", colorClicked);
    }

    function mapClicked() {
      const fill = this.getAttribute("fill");
      const palleteColor = imageConverter.querySelector(`div[data-color="${fill}"]`);
      palleteColor.click();
    }

    function colorClicked() {
      terrs.selectAll(".selectedCell").attr("class", null);
      const unselect = this.classList.contains("selectedColor");

      const selectedColor = imageConverter.querySelector("div.selectedColor");
      if (selectedColor) selectedColor.classList.remove("selectedColor");
      const hoveredColor = colorScheme.querySelector("div.hoveredColor");
      if (hoveredColor) hoveredColor.classList.remove("hoveredColor");
      colorsSelectValue.innerHTML = "";

      if (unselect) return;
      this.classList.add("selectedColor");

      if (this.getAttribute("data-height")) {
        const height = this.getAttribute("data-height");
        colorScheme.querySelector(`div[data-color="${height}"]`).classList.add("hoveredColor");
        colorsSelectValue.innerHTML = height;
      }

      const color = this.getAttribute("data-color");
      terrs.selectAll("polygon.selectedCell").classed("selectedCell", 0);
      terrs.selectAll("polygon[fill='" + color + "']").classed("selectedCell", 1);
    }

    function assignHeight() {
      const height = +this.getAttribute("data-color");
      const rgb = color(1 - height/100);

      const selectedColor = imageConverter.querySelector("div.selectedColor");
      selectedColor.style.backgroundColor = rgb;
      selectedColor.setAttribute("data-color", rgb);
      selectedColor.setAttribute("data-height", height);

      terrs.selectAll(".selectedCell").each(function() {
        this.setAttribute("fill", rgb); 
        this.setAttribute("data-height", height);
      });

      if (selectedColor.parentNode.id === "colorsUnassigned") {
        colorsAssigned.appendChild(selectedColor);
        colorsAssigned.style.display = "block";
      }

    }

    // auto assign color based on luminosity or hue
    function autoAssing(type) {
      const unassigned = colorsUnassigned.querySelectorAll("div");
      if (!unassigned.length) {tip("No unassigned colors. Please load an image and click the button again", false, "error"); return;}

      unassigned.forEach(function(el) {
        const colorFrom = el.getAttribute("data-color");
        const lab = d3.lab(colorFrom);
        const normalized = type === "hue" ? rn(normalize(lab.b + lab.a / 2, -50, 200), 2) : rn(normalize(lab.l, -15, 100), 2);
        const colorTo = color(1 - normalized);
        const heightTo = normalized * 100;

        terrs.selectAll("polygon[fill='" + colorFrom + "']").attr("fill", colorTo).attr("data-height", heightTo);
        el.style.backgroundColor = colorTo;
        el.setAttribute("data-color", colorTo);
        el.setAttribute("data-height", heightTo);
        colorsAssigned.appendChild(el);
      });
      
      colorsAssigned.style.display = "block";
      colorsUnassigned.style.display = "none";
    }
    
    function changeConvertColorsNumber(change) {
      const number = Math.max(Math.min(+convertColors.value + change, 255), 3);
      convertColors.value = number;
      heightsFromImage(number);
    }

    function setOverlayOpacity(v) {
      convertOverlay.value = convertOverlayNumber.value = v;
      document.getElementById("canvas").style.opacity = v;
    }

    function closeImageConverter() {
      const canvas = document.getElementById("canvas");
      if (canvas) canvas.remove(); else return;

      d3.select("#imageConverter").selectAll("div.color-div").remove();
      colorsAssigned.style.display = "none";
      colorsUnassigned.style.display = "none";
      colorsSelectValue.innerHTML = "";
      viewbox.style("cursor", "default").on(".drag", null);
      tip('Heightmap edit mode is active. Click on "Exit Customization" to finalize the heightmap', true);

      terrs.selectAll("polygon").each(function() {
        const height = +this.getAttribute("data-height") || 0;
        const i = +this.id.slice(4);
        grid.cells.h[i] = height;
      });

      terrs.selectAll("polygon").remove();
      updateHeightmap();
    }
    
  }

  function toggleHeightmapPreview() {
    if (document.getElementById("preview")) {
      document.getElementById("preview").remove();
      return;
    }
    const preview = document.createElement("canvas");
    preview.id = "preview";
    preview.width = grid.cellsX;
    preview.height = grid.cellsY;
    document.body.insertBefore(preview, optionsContainer);
    preview.addEventListener("mouseover", () => tip("Heightmap preview. Click to download a screen-sized image"));
    preview.addEventListener("click", downloadPreview);
    drawHeightmapPreview();
  }

  function drawHeightmapPreview() {
    const ctx = document.getElementById("preview").getContext("2d");
    const imageData = ctx.createImageData(grid.cellsX, grid.cellsY);

    grid.cells.h.forEach((height, i) => {
      let h = height < 20 ? Math.max(height / 1.5, 0) : height;
      const v = h / 100 * 255;
      imageData.data[i*4] = v;
      imageData.data[i*4 + 1] = v;
      imageData.data[i*4 + 2] = v;
      imageData.data[i*4 + 3] = 255;
    });

    ctx.putImageData(imageData, 0, 0);
  }

  function downloadPreview() {
    const preview = document.getElementById("preview");
    const dataURL = preview.toDataURL("image/png");

    const img = new Image();
    img.src = dataURL;

    img.onload = function() {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = svgWidth;
      canvas.height = svgHeight;
      document.body.insertBefore(canvas, optionsContainer);
      ctx.drawImage(img, 0, 0, svgWidth, svgHeight);

      // const simplex = new SimplexNoise(); // SimplexNoise by Jonas Wagner
      // const noise = (nx, ny) => simplex.noise2D(nx, ny) / 2 + .5;

      // const imageData = ctx.getImageData(0, 0, svgWidth, svgHeight);
      // for (let i=0; i < imageData.data.length; i+=4) {
      //   const v = imageData.data[i];
      //   if (v < 51) {
      //     // water
      //     // imageData.data[i] = imageData.data[i+1] = imageData.data[i+2] = 46;
      //     continue;
      //   }

      //   const x = i / 4 % svgWidth, y = Math.floor(i / 4 / svgWidth);
      //   const nx = x / svgWidth - .5, ny = y / svgHeight - .5;
      //   const n = noise(4 * nx, 4 * ny) / 4 + noise(16 * nx, 16 * ny) / 16;
      //   const nv = Math.max(Math.min((v + 255 * n) / 2, 255), 51);
      //   imageData.data[i] = imageData.data[i+1] = imageData.data[i+2] = nv;
      // }
      // ctx.putImageData(imageData, 0, 0);

      const imgBig = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.target = "_blank";
      link.download = getFileName("Heightmap") + ".png";
      link.href = imgBig;
      document.body.appendChild(link);
      link.click();
      canvas.remove();
    }
  }

}