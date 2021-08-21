"use strict";

function editHeightmap() {
  void (function selectEditMode() {
    alertMessage.innerHTML = `Heightmap is a core element on which all other data (rivers, burgs, states etc) is based.
      So the best edit approach is to <i>erase</i> the secondary data and let the system automatically regenerate it on edit completion.
      <p><i>Erase</i> mode also allows you Convert an Image into a heightmap or use Template Editor.</p>
      <p>You can <i>keep</i> the data, but you won't be able to change the coastline.</p>
      <p>Try <i>risk</i> mode to change the coastline and keep the data. The data will be restored as much as possible, but it can cause unpredictable errors.</p>
      <p>Please <span class="pseudoLink" onclick=saveMap(); editHeightmap();>save the map</span> before editing the heightmap!</p>
      <p>Check out ${link("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Heightmap-customization", "wiki")} for guidance.</p>`;

    $("#alert").dialog({
      resizable: false,
      title: "Edit Heightmap",
      width: "28em",
      buttons: {
        Erase: function () {
          enterHeightmapEditMode("erase");
        },
        Keep: function () {
          enterHeightmapEditMode("keep");
        },
        Risk: function () {
          enterHeightmapEditMode("risk");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  })();

  restartHistory();
  viewbox.insert("g", "#terrs").attr("id", "heights");

  if (modules.editHeightmap) return;
  modules.editHeightmap = true;

  // add listeners
  document.getElementById("paintBrushes").addEventListener("click", openBrushesPanel);
  document.getElementById("applyTemplate").addEventListener("click", openTemplateEditor);
  document.getElementById("convertImage").addEventListener("click", openImageConverter);
  document.getElementById("heightmapPreview").addEventListener("click", toggleHeightmapPreview);
  document.getElementById("heightmap3DView").addEventListener("click", changeViewMode);
  document.getElementById("finalizeHeightmap").addEventListener("click", finalizeHeightmap);
  document.getElementById("renderOcean").addEventListener("click", mockHeightmap);
  document.getElementById("templateUndo").addEventListener("click", () => restoreHistory(edits.n - 1));
  document.getElementById("templateRedo").addEventListener("click", () => restoreHistory(edits.n + 1));

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
      undraw();
      changeOnlyLand.checked = false;
    } else if (type === "keep") {
      viewbox.selectAll("#landmass, #lakes").style("display", "none");
      changeOnlyLand.checked = true;
    } else if (type === "risk") {
      defs.selectAll("#land, #water").selectAll("path").remove();
      viewbox.selectAll("#coastline path, #lakes path, #oceanLayers path").remove();
      changeOnlyLand.checked = false;
    }

    // show convert and template buttons for Erase mode only
    applyTemplate.style.display = type === "erase" ? "inline-block" : "none";
    convertImage.style.display = type === "erase" ? "inline-block" : "none";

    // hide erosion checkbox if mode is Keep
    allowErosionBox.style.display = type === "keep" ? "none" : "inline-block";

    // show finalize button
    if (!sessionStorage.getItem("noExitButtonAnimation")) {
      sessionStorage.setItem("noExitButtonAnimation", true);
      exitCustomization.style.opacity = 0;
      const width = 12 * uiSizeOutput.value * 11;
      exitCustomization.style.right = (svgWidth - width) / 2 + "px";
      exitCustomization.style.bottom = svgHeight / 2 + "px";
      exitCustomization.style.transform = "scale(2)";
      exitCustomization.style.display = "block";
      d3.select("#exitCustomization").transition().duration(1000).style("opacity", 1).transition().duration(2000).ease(d3.easeSinInOut).style("right", "10px").style("bottom", "10px").style("transform", "scale(1)");
    } else exitCustomization.style.display = "block";

    openBrushesPanel();
    turnButtonOn("toggleHeight");
    layersPreset.value = "heightmap";
    layersPreset.disabled = true;
    mockHeightmap();
    viewbox.on("touchmove mousemove", moveCursor);
  }

  function moveCursor() {
    const p = d3.mouse(this),
      cell = findGridCell(p[0], p[1]);
    heightmapInfoX.innerHTML = rn(p[0]);
    heightmapInfoY.innerHTML = rn(p[1]);
    heightmapInfoCell.innerHTML = cell;
    heightmapInfoHeight.innerHTML = `${grid.cells.h[cell]} (${getHeight(grid.cells.h[cell])})`;
    if (tooltip.dataset.main) showMainTip();

    // move radius circle if drag mode is active
    const pressed = document.getElementById("brushesButtons").querySelector("button.pressed");
    if (!pressed) return;
    moveCircle(p[0], p[1], brushRadius.valueAsNumber, "#333");
  }

  // get user-friendly (real-world) height value from map data
  function getHeight(h) {
    const unit = heightUnit.value;
    let unitRatio = 3.281; // default calculations are in feet
    if (unit === "m") unitRatio = 1;
    // if meter
    else if (unit === "f") unitRatio = 0.5468; // if fathom

    let height = -990;
    if (h >= 20) height = Math.pow(h - 18, +heightExponentInput.value);
    else if (h < 20 && h > 0) height = ((h - 20) / h) * 50;

    return rn(height * unitRatio) + " " + unit;
  }

  // Exit customization mode
  function finalizeHeightmap() {
    if (viewbox.select("#heights").selectAll("*").size() < 200) return tip("Insufficient land area! There should be at least 200 land cells to finalize the heightmap", null, "error");
    if (document.getElementById("imageConverter").offsetParent) return tip("Please exit the Image Conversion mode first", null, "error");

    delete window.edits; // remove global variable
    redo.disabled = templateRedo.disabled = true;
    undo.disabled = templateUndo.disabled = true;

    customization = 0;
    customizationMenu.style.display = "none";
    if (document.getElementById("options").querySelector(".tab > button.active").id === "toolsTab") toolsContent.style.display = "block";
    layersPreset.disabled = false;
    exitCustomization.style.display = "none"; // hide finalize button
    restoreDefaultEvents();
    clearMainTip();
    closeDialogs();
    resetZoom();

    if (document.getElementById("preview")) document.getElementById("preview").remove();
    if (document.getElementById("canvas3d")) enterStandardView();

    const mode = heightmapEditMode.innerHTML;
    if (mode === "erase") regenerateErasedData();
    else if (mode === "keep") restoreKeptData();
    else if (mode === "risk") restoreRiskedData();

    // restore initial layers
    //viewbox.select("#heights").remove();
    document.getElementById("heights").remove();
    turnButtonOff("toggleHeight");
    document
      .getElementById("mapLayers")
      .querySelectorAll("li")
      .forEach(function (e) {
        if (editHeightmap.layers.includes(e.id) && !layerIsOn(e.id)) e.click();
        // turn on
        else if (!editHeightmap.layers.includes(e.id) && layerIsOn(e.id)) e.click(); // turn off
      });
    getCurrentPreset();
  }

  function regenerateErasedData() {
    INFO && console.group("Edit Heightmap");
    TIME && console.time("regenerateErasedData");

    const erosionAllowed = allowErosion.checked;
    markFeatures();
    markupGridOcean();
    if (erosionAllowed) {
      addLakesInDeepDepressions();
      openNearSeaLakes();
    }
    OceanLayers();
    calculateTemperatures();
    generatePrecipitation();
    reGraph();
    drawCoastline();

    Rivers.generate(erosionAllowed);

    if (!erosionAllowed) {
      for (const i of pack.cells.i) {
        const g = pack.cells.g[i];
        if (pack.cells.h[i] !== grid.cells.h[g] && pack.cells.h[i] >= 20 === grid.cells.h[g] >= 20) pack.cells.h[i] = grid.cells.h[g];
      }
    }

    drawRivers();
    Lakes.defineGroup();
    defineBiomes();
    rankCells();
    Cultures.generate();
    Cultures.expand();
    BurgsAndStates.generate();
    Religions.generate();
    BurgsAndStates.defineStateForms();
    BurgsAndStates.generateProvinces();
    BurgsAndStates.defineBurgFeatures();

    drawStates();
    drawBorders();
    BurgsAndStates.drawStateLabels();

    Rivers.specify();
    Lakes.generateName();

    Military.generate();
    addMarkers();
    addZones();
    TIME && console.timeEnd("regenerateErasedData");
    INFO && console.groupEnd("Edit Heightmap");
  }

  function restoreKeptData() {
    viewbox.selectAll("#landmass, #lakes").style("display", null);
    for (const i of pack.cells.i) {
      pack.cells.h[i] = grid.cells.h[pack.cells.g[i]];
    }
  }

  function restoreRiskedData() {
    INFO && console.group("Edit Heightmap");
    TIME && console.time("restoreRiskedData");
    const erosionAllowed = allowErosion.checked;

    // assign pack data to grid cells
    const l = grid.cells.i.length;
    const biome = new Uint8Array(l);
    const pop = new Uint16Array(l);
    const road = new Uint16Array(l);
    const crossroad = new Uint16Array(l);
    const s = new Uint16Array(l);
    const burg = new Uint16Array(l);
    const state = new Uint16Array(l);
    const province = new Uint16Array(l);
    const culture = new Uint16Array(l);
    const religion = new Uint16Array(l);

    // rivers data, stored only if allowErosion is unchecked
    const fl = new Uint16Array(l);
    const r = new Uint16Array(l);
    const conf = new Uint8Array(l);

    for (const i of pack.cells.i) {
      const g = pack.cells.g[i];
      biome[g] = pack.cells.biome[i];
      culture[g] = pack.cells.culture[i];
      pop[g] = pack.cells.pop[i];
      road[g] = pack.cells.road[i];
      crossroad[g] = pack.cells.crossroad[i];
      s[g] = pack.cells.s[i];
      state[g] = pack.cells.state[i];
      province[g] = pack.cells.province[i];
      burg[g] = pack.cells.burg[i];
      religion[g] = pack.cells.religion[i];

      if (!erosionAllowed) {
        fl[g] = pack.cells.fl[i];
        r[g] = pack.cells.r[i];
        conf[g] = pack.cells.conf[i];
      }
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

    // recalculate zones to grid
    zones.selectAll("g").each(function () {
      const zone = d3.select(this);
      const dataCells = zone.attr("data-cells");
      const cells = dataCells ? dataCells.split(",").map(i => +i) : [];
      const g = cells.map(i => pack.cells.g[i]);
      zone.attr("data-cells", g);
      zone.selectAll("*").remove();
    });

    markFeatures();
    markupGridOcean();
    if (erosionAllowed) addLakesInDeepDepressions();
    OceanLayers();
    calculateTemperatures();
    generatePrecipitation();
    reGraph();
    drawCoastline();

    if (erosionAllowed) Rivers.generate(true);

    // assign saved pack data from grid back to pack
    const n = pack.cells.i.length;
    pack.cells.pop = new Float32Array(n);
    pack.cells.road = new Uint16Array(n);
    pack.cells.crossroad = new Uint16Array(n);
    pack.cells.s = new Uint16Array(n);
    pack.cells.burg = new Uint16Array(n);
    pack.cells.state = new Uint16Array(n);
    pack.cells.province = new Uint16Array(n);
    pack.cells.culture = new Uint16Array(n);
    pack.cells.religion = new Uint16Array(n);
    pack.cells.biome = new Uint8Array(n);

    if (!erosionAllowed) {
      pack.cells.r = new Uint16Array(n);
      pack.cells.conf = new Uint8Array(n);
      pack.cells.fl = new Uint16Array(n);
    }

    for (const i of pack.cells.i) {
      const g = pack.cells.g[i];
      const isLand = pack.cells.h[i] >= 20;

      // check biome
      pack.cells.biome[i] = isLand && biome[g] ? biome[g] : getBiomeId(grid.cells.prec[g], grid.cells.temp[g], pack.cells.h[i]);

      // rivers data
      if (!erosionAllowed) {
        pack.cells.r[i] = r[g];
        pack.cells.conf[i] = conf[g];
        pack.cells.fl[i] = fl[g];
      }

      if (!isLand) continue;
      pack.cells.culture[i] = culture[g];
      pack.cells.pop[i] = pop[g];
      pack.cells.road[i] = road[g];
      pack.cells.crossroad[i] = crossroad[g];
      pack.cells.s[i] = s[g];
      pack.cells.state[i] = state[g];
      pack.cells.province[i] = province[g];
      pack.cells.religion[i] = religion[g];
    }

    // find closest land cell to burg
    const findBurgCell = function (x, y) {
      let i = findCell(x, y);
      if (pack.cells.h[i] >= 20) return i;
      const dist = pack.cells.c[i].map(c => (pack.cells.h[c] < 20 ? Infinity : (pack.cells.p[c][0] - x) ** 2 + (pack.cells.p[c][1] - y) ** 2));
      return pack.cells.c[i][d3.scan(dist)];
    };

    // find best cell for burgs
    for (const b of pack.burgs) {
      if (!b.i || b.removed) continue;
      b.cell = findBurgCell(b.x, b.y);
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
      else {
        p.center = provCells[0];
        p.burg = pack.cells.burg[p.center];
      }
    }

    for (const c of pack.cultures) {
      if (!c.i || c.removed) continue;
      c.center = findCell(c.x, c.y);
    }

    BurgsAndStates.drawStateLabels();
    drawStates();
    drawBorders();

    if (erosionAllowed) {
      Rivers.specify();
      Lakes.generateName();
    }

    // restore zones from grid
    zones.selectAll("g").each(function () {
      const zone = d3.select(this);
      const g = zone.attr("data-cells");
      const gCells = g ? g.split(",").map(i => +i) : [];
      const cells = pack.cells.i.filter(i => gCells.includes(pack.cells.g[i]));

      zone.attr("data-cells", cells);
      zone.selectAll("*").remove();
      const base = zone.attr("id") + "_"; // id generic part
      zone
        .selectAll("*")
        .data(cells)
        .enter()
        .append("polygon")
        .attr("points", d => getPackPolygon(d))
        .attr("id", d => base + d);
    });

    TIME && console.timeEnd("restoreRiskedData");
    INFO && console.groupEnd("Edit Heightmap");
  }

  // trigger heightmap redraw and history update if at least 1 cell is changed
  function updateHeightmap() {
    const prev = last(edits);
    const changed = grid.cells.h.reduce((s, h, i) => (h !== prev[i] ? s + 1 : s), 0);
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
    viewbox
      .select("#heights")
      .selectAll("polygon")
      .data(data)
      .join("polygon")
      .attr("points", d => getGridPolygon(d))
      .attr("id", d => "cell" + d)
      .attr("fill", d => getColor(grid.cells.h[d], scheme));
  }

  // draw or update heightmap for a selection of cells
  function mockHeightmapSelection(selection) {
    const ocean = renderOcean.checked;
    const scheme = getColorScheme();

    selection.forEach(function (i) {
      let cell = viewbox.select("#heights").select("#cell" + i);
      if (!ocean && grid.cells.h[i] < 20) {
        cell.remove();
        return;
      }
      if (!cell.size())
        cell = viewbox
          .select("#heights")
          .append("polygon")
          .attr("points", getGridPolygon(i))
          .attr("id", "cell" + i);
      cell.attr("fill", getColor(grid.cells.h[i], scheme));
    });
  }

  function updateStatistics() {
    const landCells = grid.cells.h.reduce((s, h) => (h >= 20 ? s + 1 : s));
    landmassCounter.innerHTML = `${landCells} (${rn((landCells / grid.cells.i.length) * 100)}%)`;
    landmassAverage.innerHTML = rn(d3.mean(grid.cells.h));
  }

  function updateHistory(noStat) {
    const step = edits.n;
    edits = edits.slice(0, step);
    edits[step] = grid.cells.h.slice();
    edits.n = step + 1;

    undo.disabled = templateUndo.disabled = edits.n <= 1;
    redo.disabled = templateRedo.disabled = true;
    if (!noStat) {
      updateStatistics();
      if (document.getElementById("preview")) drawHeightmapPreview(); // update heightmap preview if opened
      if (document.getElementById("canvas3d")) ThreeD.redraw(); // update 3d heightmap preview if opened
    }
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
    if (document.getElementById("canvas3d")) ThreeD.redraw(); // update 3d heightmap preview if opened
  }

  // restart edits from 1st step
  function restartHistory() {
    window.edits = []; // declare temp global variable
    window.edits.n = 0;
    redo.disabled = templateRedo.disabled = true;
    undo.disabled = templateUndo.disabled = true;
    updateHistory();
  }

  function openBrushesPanel() {
    if ($("#brushesPanel").is(":visible")) return;
    $("#brushesPanel")
      .dialog({
        title: "Paint Brushes",
        resizable: false,
        position: {my: "right top", at: "right-10 top+10", of: "svg"}
      })
      .on("dialogclose", exitBrushMode);

    if (modules.openBrushesPanel) return;
    modules.openBrushesPanel = true;

    // add listeners
    document.getElementById("brushesButtons").addEventListener("click", e => toggleBrushMode(e));
    document.getElementById("changeOnlyLand").addEventListener("click", e => changeOnlyLandClick(e));
    document.getElementById("undo").addEventListener("click", () => restoreHistory(edits.n - 1));
    document.getElementById("redo").addEventListener("click", () => restoreHistory(edits.n + 1));
    document.getElementById("rescaleShow").addEventListener("click", () => {
      document.getElementById("modifyButtons").style.display = "none";
      document.getElementById("rescaleSection").style.display = "block";
    });
    document.getElementById("rescaleHide").addEventListener("click", () => {
      document.getElementById("modifyButtons").style.display = "block";
      document.getElementById("rescaleSection").style.display = "none";
    });
    document.getElementById("rescaler").addEventListener("change", e => rescale(e.target.valueAsNumber));
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

    const dragBrushThrottled = throttle(dragBrush, 100);
    function toggleBrushMode(e) {
      if (e.target.classList.contains("pressed")) {
        exitBrushMode();
        return;
      }
      exitBrushMode();
      document.getElementById("brushesSliders").style.display = "block";
      e.target.classList.add("pressed");
      viewbox.style("cursor", "crosshair").call(d3.drag().on("start", dragBrushThrottled));
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
      function lim(v) {
        return Math.max(Math.min(v, 100), land ? 20 : 0);
      }
      const h = grid.cells.h;

      const brush = document.querySelector("#brushesButtons > button.pressed").id;
      if (brush === "brushRaise") s.forEach(i => (h[i] = h[i] < 20 ? 20 : lim(h[i] + power)));
      else if (brush === "brushElevate") s.forEach((i, d) => (h[i] = lim(h[i] + interpolate(d / Math.max(s.length - 1, 1)))));
      else if (brush === "brushLower") s.forEach(i => (h[i] = lim(h[i] - power)));
      else if (brush === "brushDepress") s.forEach((i, d) => (h[i] = lim(h[i] - interpolate(d / Math.max(s.length - 1, 1)))));
      else if (brush === "brushAlign") s.forEach(i => (h[i] = lim(h[start])));
      else if (brush === "brushSmooth") s.forEach(i => (h[i] = rn((d3.mean(grid.cells.c[i].filter(i => (land ? h[i] >= 20 : 1)).map(c => h[c])) + h[i] * (10 - power) + 0.6) / (11 - power), 1)));
      else if (brush === "brushDisrupt") s.forEach(i => (h[i] = h[i] < 15 ? h[i] : lim(h[i] + power / 1.6 - Math.random() * power)));

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
      grid.cells.h = grid.cells.h.map(h => (land && (h < 20 || h + v < 20) ? h : lim(h + v)));
      updateHeightmap();
      document.getElementById("rescaler").value = 0;
    }

    function rescaleWithCondition() {
      const range = rescaleLower.value + "-" + rescaleHigher.value;
      const operator = conditionSign.value;
      const operand = rescaleModifier.valueAsNumber;
      if (Number.isNaN(operand)) {
        tip("Operand should be a number", false, "error");
        return;
      }
      if ((operator === "add" || operator === "subtract") && !Number.isInteger(operand)) {
        tip("Operand should be an integer", false, "error");
        return;
      }

      if (operator === "multiply") HeightmapGenerator.modify(range, 0, operand, 0);
      else if (operator === "divide") HeightmapGenerator.modify(range, 0, 1 / operand, 0);
      else if (operator === "add") HeightmapGenerator.modify(range, operand, 1, 0);
      else if (operator === "subtract") HeightmapGenerator.modify(range, -1 * operand, 1, 0);
      else if (operator === "exponent") HeightmapGenerator.modify(range, 0, 1, operand);

      updateHeightmap();
    }

    function smoothAllHeights() {
      HeightmapGenerator.smooth(4, 1.5);
      updateHeightmap();
    }

    function disruptAllHeights() {
      grid.cells.h = grid.cells.h.map(h => (h < 15 ? h : lim(h + 2.5 - Math.random() * 4)));
      updateHeightmap();
    }

    function startFromScratch() {
      if (changeOnlyLand.checked) {
        tip("Not allowed when 'Change only land cells' mode is set", false, "error");
        return;
      }
      const someHeights = grid.cells.h.some(h => h);
      if (!someHeights) {
        tip("Heightmap is already cleared, please do not click twice if not required", false, "error");
        return;
      }
      grid.cells.h = new Uint8Array(grid.cells.i.length);
      viewbox.select("#heights").selectAll("*").remove();
      updateHistory();
    }
  }

  function openTemplateEditor() {
    if ($("#templateEditor").is(":visible")) return;
    const body = document.getElementById("templateBody");

    $("#templateEditor").dialog({
      title: "Template Editor",
      minHeight: "auto",
      width: "fit-content",
      resizable: false,
      position: {my: "right top", at: "right-10 top+10", of: "svg"}
    });

    if (modules.openTemplateEditor) return;
    modules.openTemplateEditor = true;

    $("#templateBody").sortable({items: "> div", handle: ".icon-resize-vertical", containment: "#templateBody", axis: "y"});

    // add listeners
    body.addEventListener("click", function (ev) {
      const el = ev.target;
      if (el.classList.contains("icon-check")) {
        el.classList.remove("icon-check");
        el.classList.add("icon-check-empty");
        el.parentElement.style.opacity = 0.5;
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
        el.parentElement.remove();
        return;
      }
    });

    document.getElementById("templateTools").addEventListener("click", e => addStepOnClick(e));
    document.getElementById("templateSelect").addEventListener("change", e => selectTemplate(e));
    document.getElementById("templateRun").addEventListener("click", executeTemplate);
    document.getElementById("templateSave").addEventListener("click", downloadTemplate);
    document.getElementById("templateLoad").addEventListener("click", () => templateToLoad.click());
    document.getElementById("templateToLoad").addEventListener("change", function () {
      uploadFile(this, uploadTemplate);
    });

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
        for (const o of elDist.options) {
          if (o.value === dist) elDist.value = dist;
        }
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

      const TempY = `<span>y:<input class="templateY" data-tip="Placement range percentage along Y axis (minY-maxY)" value=${arg5 || "20-80"}></span>`;
      const TempX = `<span>x:<input class="templateX" data-tip="Placement range percentage along X axis (minX-maxX)" value=${arg4 || "15-85"}></span>`;
      const Height = `<span>h:<input class="templateHeight" data-tip="Blob maximum height, use hyphen to get a random number in range" value=${arg3 || "40-50"}></span>`;
      const Count = `<span>n:<input class="templateCount" data-tip="Blobs to add, use hyphen to get a random number in range" value=${count || "1-2"}></span>`;
      const blob = `${common}${TempY}${TempX}${Height}${Count}</div>`;

      if (type === "Hill" || type === "Pit" || type === "Range" || type === "Trough") return blob;
      if (type === "Strait") return `${common}<span>d:<select class="templateDist" data-tip="Strait direction"><option value="vertical" selected>vertical</option><option value="horizontal">horizontal</option></select></span><span>w:<input class="templateCount" data-tip="Strait width, use hyphen to get a random number in range" value=${count || "2-7"}></span></div>`;
      if (type === "Add") return `${common}<span>to:<select class="templateDist" data-tip="Change only land or all cells"><option value="all" selected>all cells</option><option value="land">land only</option><option value="interval">interval</option></select></span><span>v:<input class="templateCount" data-tip="Add value to height of all cells (negative values are allowed)" type="number" value=${count || -10} min=-100 max=100 step=1></span></div>`;
      if (type === "Multiply") return `${common}<span>to:<select class="templateDist" data-tip="Change only land or all cells"><option value="all" selected>all cells</option><option value="land">land only</option><option value="interval">interval</option></select></span><span>v:<input class="templateCount" data-tip="Multiply all cells Height by the value" type="number" value=${count || 1.1} min=0 max=10 step=.1></span></div>`;
      if (type === "Smooth") return `${common}<span>f:<input class="templateCount" data-tip="Set smooth fraction. 1 - full smooth, 2 - half-smooth, etc." type="number" min=1 max=10 value=${count || 2}></span></div>`;
    }

    function setRange(event) {
      if (event.target.value !== "interval") return;

      prompt("Set a height interval. Avoid space, use hyphen as a separator", {default: "17-20"}, v => {
        const opt = document.createElement("option");
        opt.value = opt.innerHTML = v;
        event.target.add(opt);
        event.target.value = v;
      });
    }

    function selectTemplate(e) {
      const body = document.getElementById("templateBody");
      const steps = body.querySelectorAll("div").length;
      const changed = +body.getAttribute("data-changed");
      const template = e.target.value;
      if (!steps || !changed) {
        changeTemplate(template);
        return;
      }

      alertMessage.innerHTML = "Are you sure you want to select a different template? All changes will be lost.";
      $("#alert").dialog({
        resizable: false,
        title: "Change Template",
        buttons: {
          Change: function () {
            changeTemplate(template);
            $(this).dialog("close");
          },
          Cancel: function () {
            $(this).dialog("close");
          }
        }
      });
    }

    function changeTemplate(template) {
      const body = document.getElementById("templateBody");
      body.setAttribute("data-changed", 0);
      body.innerHTML = "";

      const templateString = HeightmapTemplates[template];
      if (!templateString) return;

      const steps = templateString.split("\n");
      if (!steps.length) return tip(`Heightmap template: no steps defined`, false, "error");

      for (const step of steps) {
        const elements = step.trim().split(" ");
        addStep(...elements);
      }
    }

    function executeTemplate() {
      const body = document.getElementById("templateBody");
      const steps = body.querySelectorAll("#templateBody > div");
      if (!steps.length) return;

      grid.cells.h = new Uint8Array(grid.cells.i.length); // clean all heights

      for (const s of steps) {
        if (s.style.opacity == 0.5) continue;
        const type = s.dataset.type;

        const elCount = s.querySelector(".templateCount") || "";
        const elHeight = s.querySelector(".templateHeight") || "";

        const elDist = s.querySelector(".templateDist");
        const dist = elDist ? elDist.value : null;

        const templateX = s.querySelector(".templateX");
        const x = templateX ? templateX.value : null;
        const templateY = s.querySelector(".templateY");
        const y = templateY ? templateY.value : null;

        if (type === "Hill") HeightmapGenerator.addHill(elCount.value, elHeight.value, x, y);
        else if (type === "Pit") HeightmapGenerator.addPit(elCount.value, elHeight.value, x, y);
        else if (type === "Range") HeightmapGenerator.addRange(elCount.value, elHeight.value, x, y);
        else if (type === "Trough") HeightmapGenerator.addTrough(elCount.value, elHeight.value, x, y);
        else if (type === "Strait") HeightmapGenerator.addStrait(elCount.value, dist);
        else if (type === "Add") HeightmapGenerator.modify(dist, +elCount.value, 1);
        else if (type === "Multiply") HeightmapGenerator.modify(dist, 0, +elCount.value);
        else if (type === "Smooth") HeightmapGenerator.smooth(+elCount.value);

        updateHistory("noStat"); // update history every step
      }

      updateStatistics();
      mockHeightmap();
      if (document.getElementById("preview")) drawHeightmapPreview(); // update heightmap preview if opened
      if (document.getElementById("canvas3d")) ThreeD.redraw(); // update 3d heightmap preview if opened
    }

    function downloadTemplate() {
      const body = document.getElementById("templateBody");
      body.dataset.changed = 0;
      const steps = body.querySelectorAll("#templateBody > div");
      if (!steps.length) return;

      let data = "";
      for (const s of steps) {
        if (s.style.opacity == 0.5) continue;
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
        data += `${type} ${count} ${arg3} ${x} ${y}\r\n`;
      }

      const name = "template_" + Date.now() + ".txt";
      downloadFile(data, name);
    }

    function uploadTemplate(dataLoaded) {
      const steps = dataLoaded.split("\r\n");
      if (!steps.length) {
        tip("Cannot parse the template, please check the file", false, "error");
        return;
      }
      templateBody.innerHTML = "";
      for (const s of steps) {
        const step = s.split(" ");
        if (step.length !== 5) {
          ERROR && console.error("Cannot parse step, wrong arguments count", s);
          continue;
        }
        addStep(step[0], step[1], step[2], step[3], step[4]);
      }
    }
  }

  function openImageConverter() {
    if ($("#imageConverter").is(":visible")) return;
    imageToLoad.click();
    closeDialogs("#imageConverter");

    $("#imageConverter").dialog({
      title: "Image Converter",
      maxHeight: svgHeight * 0.8,
      minHeight: "auto",
      width: "20em",
      position: {my: "right top", at: "right-10 top+10", of: "svg"},
      beforeClose: closeImageConverter
    });

    // create canvas for image
    const canvas = document.createElement("canvas");
    canvas.id = "canvas";
    canvas.width = graphWidth;
    canvas.height = graphHeight;
    document.body.insertBefore(canvas, optionsContainer);

    setOverlayOpacity(0);
    clearMainTip();
    tip("Image Converter is opened. Upload image and assign height value for each color", false, "warn"); // main tip

    // remove all heights
    grid.cells.h = new Uint8Array(grid.cells.i.length);
    viewbox.select("#heights").selectAll("*").remove();
    updateHistory();

    if (modules.openImageConverter) return;
    modules.openImageConverter = true;

    // add color pallete
    void (function createColorPallete() {
      d3.select("#imageConverterPalette")
        .selectAll("div")
        .data(d3.range(101))
        .enter()
        .append("div")
        .attr("data-color", i => i)
        .style("background-color", i => color(1 - (i < 20 ? i - 5 : i) / 100))
        .style("width", i => (i < 40 || i > 68 ? ".2em" : ".1em"))
        .on("touchmove mousemove", showPalleteHeight)
        .on("click", assignHeight);
    })();

    // add listeners
    document.getElementById("convertImageLoad").addEventListener("click", () => imageToLoad.click());
    document.getElementById("imageToLoad").addEventListener("change", loadImage);
    document.getElementById("convertAutoLum").addEventListener("click", () => autoAssing("lum"));
    document.getElementById("convertAutoHue").addEventListener("click", () => autoAssing("hue"));
    document.getElementById("convertAutoFMG").addEventListener("click", () => autoAssing("scheme"));
    document.getElementById("convertColorsButton").addEventListener("click", setConvertColorsNumber);
    document.getElementById("convertComplete").addEventListener("click", applyConversion);
    document.getElementById("convertCancel").addEventListener("click", cancelConversion);
    document.getElementById("convertOverlay").addEventListener("input", function () {
      setOverlayOpacity(this.value);
    });
    document.getElementById("convertOverlayNumber").addEventListener("input", function () {
      setOverlayOpacity(this.value);
    });

    function showPalleteHeight() {
      const height = +this.getAttribute("data-color");
      colorsSelectValue.innerHTML = height;
      colorsSelectFriendly.innerHTML = getHeight(height);
      const former = imageConverterPalette.querySelector(".hoveredColor");
      if (former) former.className = "";
      this.className = "hoveredColor";
    }

    function loadImage() {
      const file = this.files[0];
      this.value = ""; // reset input value to get triggered if the file is re-uploaded
      const reader = new FileReader();

      const img = new Image();
      img.id = "imageToConvert";
      img.style.display = "none";
      document.body.appendChild(img);

      img.onload = function () {
        const ctx = document.getElementById("canvas").getContext("2d");
        ctx.drawImage(img, 0, 0, graphWidth, graphHeight);
        heightsFromImage(+convertColors.value);
        resetZoom();
      };

      reader.onloadend = () => (img.src = reader.result);
      reader.readAsDataURL(file);
    }

    function heightsFromImage(count) {
      const sourceImage = document.getElementById("canvas");
      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = grid.cellsX;
      sampleCanvas.height = grid.cellsY;
      sampleCanvas.getContext("2d").drawImage(sourceImage, 0, 0, grid.cellsX, grid.cellsY);

      const q = new RgbQuant({colors: count});
      q.sample(sampleCanvas);
      const data = q.reduce(sampleCanvas);
      const pallete = q.palette(true);

      viewbox.select("#heights").selectAll("*").remove();
      d3.select("#imageConverter").selectAll("div.color-div").remove();
      colorsSelect.style.display = "block";
      colorsUnassigned.style.display = "block";
      colorsAssigned.style.display = "none";
      sampleCanvas.remove(); // no need to keep

      viewbox
        .select("#heights")
        .selectAll("polygon")
        .data(grid.cells.i)
        .join("polygon")
        .attr("points", d => getGridPolygon(d))
        .attr("id", d => "cell" + d)
        .attr("fill", d => `rgb(${data[d * 4]}, ${data[d * 4 + 1]}, ${data[d * 4 + 2]})`)
        .on("click", mapClicked);

      const colors = pallete.map(p => `rgb(${p[0]}, ${p[1]}, ${p[2]})`);
      d3.select("#colorsUnassigned")
        .selectAll("div")
        .data(colors)
        .enter()
        .append("div")
        .attr("data-color", i => i)
        .style("background-color", i => i)
        .attr("class", "color-div")
        .on("click", colorClicked);

      document.getElementById("colorsUnassignedNumber").innerHTML = colors.length;
    }

    function mapClicked() {
      const fill = this.getAttribute("fill");
      const palleteColor = imageConverter.querySelector(`div[data-color="${fill}"]`);
      palleteColor.click();
    }

    function colorClicked() {
      viewbox.select("#heights").selectAll(".selectedCell").attr("class", null);
      const unselect = this.classList.contains("selectedColor");

      const selectedColor = imageConverter.querySelector("div.selectedColor");
      if (selectedColor) selectedColor.classList.remove("selectedColor");
      const hoveredColor = imageConverterPalette.querySelector("div.hoveredColor");
      if (hoveredColor) hoveredColor.classList.remove("hoveredColor");
      colorsSelectValue.innerHTML = colorsSelectFriendly.innerHTML = 0;

      if (unselect) return;
      this.classList.add("selectedColor");

      if (this.dataset.height) {
        const height = +this.dataset.height;
        imageConverterPalette.querySelector(`div[data-color="${height}"]`).classList.add("hoveredColor");
        colorsSelectValue.innerHTML = height;
        colorsSelectFriendly.innerHTML = getHeight(height);
      }

      const color = this.getAttribute("data-color");
      viewbox.select("#heights").selectAll("polygon.selectedCell").classed("selectedCell", 0);
      viewbox
        .select("#heights")
        .selectAll("polygon[fill='" + color + "']")
        .classed("selectedCell", 1);
    }

    function assignHeight() {
      const height = +this.dataset.color;
      const rgb = color(1 - (height < 20 ? height - 5 : height) / 100);
      const selectedColor = imageConverter.querySelector("div.selectedColor");
      selectedColor.style.backgroundColor = rgb;
      selectedColor.setAttribute("data-color", rgb);
      selectedColor.setAttribute("data-height", height);

      viewbox
        .select("#heights")
        .selectAll(".selectedCell")
        .each(function () {
          this.setAttribute("fill", rgb);
          this.setAttribute("data-height", height);
        });

      if (selectedColor.parentNode.id === "colorsUnassigned") {
        colorsAssigned.appendChild(selectedColor);
        colorsAssigned.style.display = "block";

        document.getElementById("colorsUnassignedNumber").innerHTML = colorsUnassigned.childElementCount - 2;
        document.getElementById("colorsAssignedNumber").innerHTML = colorsAssigned.childElementCount - 2;
      }
    }

    // auto assign color based on luminosity or hue
    function autoAssing(type) {
      let unassigned = colorsUnassigned.querySelectorAll("div");
      if (!unassigned.length) {
        heightsFromImage(+convertColors.value);
        unassigned = colorsUnassigned.querySelectorAll("div");
        if (!unassigned.length) {
          tip("No unassigned colors. Please load an image and click the button again", false, "error");
          return;
        }
      }

      const getHeightByHue = function (color) {
        let hue = d3.hsl(color).h;
        if (hue > 300) hue -= 360;
        if (hue > 170) return (Math.abs(hue - 250) / 3) | 0; // water
        return (Math.abs(hue - 250 + 20) / 3) | 0; // land
      };

      const getHeightByLum = function (color) {
        let lum = d3.lab(color).l;
        if (lum < 13) return ((lum / 13) * 20) | 0; // water
        return lum | 0; // land
      };

      const scheme = d3.range(101).map(i => getColor(i, color()));
      const hues = scheme.map(rgb => d3.hsl(rgb).h | 0);
      const getHeightByScheme = function (color) {
        let height = scheme.indexOf(color);
        if (height !== -1) return height; // exact match
        const hue = d3.hsl(color).h;
        const closest = hues.reduce((prev, curr) => (Math.abs(curr - hue) < Math.abs(prev - hue) ? curr : prev));
        return hues.indexOf(closest);
      };

      const assinged = []; // store assigned heights
      unassigned.forEach(el => {
        const clr = el.dataset.color;
        const height = type === "hue" ? getHeightByHue(clr) : type === "lum" ? getHeightByLum(clr) : getHeightByScheme(clr);
        const colorTo = color(1 - (height < 20 ? (height - 5) / 100 : height / 100));
        viewbox
          .select("#heights")
          .selectAll("polygon[fill='" + clr + "']")
          .attr("fill", colorTo)
          .attr("data-height", height);

        if (assinged[height]) {
          el.remove();
          return;
        } // if color is already added, remove it
        el.style.backgroundColor = el.dataset.color = colorTo;
        el.dataset.height = height;
        colorsAssigned.appendChild(el);
        assinged[height] = true;
      });

      // sort assigned colors by height
      Array.from(colorsAssigned.children)
        .sort((a, b) => +a.dataset.height - +b.dataset.height)
        .forEach(line => colorsAssigned.appendChild(line));

      colorsAssigned.style.display = "block";
      colorsUnassigned.style.display = "none";
      document.getElementById("colorsAssignedNumber").innerHTML = colorsAssigned.childElementCount - 2;
    }

    function setConvertColorsNumber() {
      prompt(`Please set maximum number of colors. <br>An actual number is usually lower and depends on color scheme`, {default: +convertColors.value, step: 1, min: 3, max: 255}, number => {
        convertColors.value = number;
        heightsFromImage(number);
      });
    }

    function setOverlayOpacity(v) {
      convertOverlay.value = convertOverlayNumber.value = v;
      document.getElementById("canvas").style.opacity = v;
    }

    function applyConversion() {
      if (colorsAssigned.childElementCount < 3) return tip("Please do the assignment first", false, "error");

      viewbox
        .select("#heights")
        .selectAll("polygon")
        .each(function () {
          const height = +this.dataset.height || 0;
          const i = +this.id.slice(4);
          grid.cells.h[i] = height;
        });

      viewbox.select("#heights").selectAll("polygon").remove();
      updateHeightmap();
      restoreImageConverterState();
    }

    function cancelConversion() {
      restoreImageConverterState();
      viewbox.select("#heights").selectAll("polygon").remove();
      restoreHistory(edits.n - 1);
    }

    function restoreImageConverterState() {
      const canvas = document.getElementById("canvas");
      if (canvas) canvas.remove();

      const image = document.getElementById("imageToConvert");
      if (image) image.remove();

      d3.select("#imageConverter").selectAll("div.color-div").remove();
      colorsAssigned.style.display = "none";
      colorsUnassigned.style.display = "none";
      colorsSelectValue.innerHTML = colorsSelectFriendly.innerHTML = 0;
      viewbox.style("cursor", "default").on(".drag", null);
      tip('Heightmap edit mode is active. Click on "Exit Customization" to finalize the heightmap', true);
      $("#imageConverter").dialog("destroy");
      openBrushesPanel();
    }

    function closeImageConverter(event) {
      event.preventDefault();
      event.stopPropagation();
      alertMessage.innerHTML = `
        Are you sure you want to close the Image Converter? 
        Click "Cancel" to geck back to convertion. 
        Click "Complete" to apply the conversion. 
        Click "Close" to exit conversion mode and restore previous heightmap`;

      $("#alert").dialog({
        resizable: false,
        title: "Close Image Converter",
        buttons: {
          Cancel: function () {
            $(this).dialog("close");
          },
          Complete: function () {
            $(this).dialog("close");
            applyConversion();
          },
          Close: function () {
            $(this).dialog("close");
            restoreImageConverterState();
            viewbox.select("#heights").selectAll("polygon").remove();
            restoreHistory(edits.n - 1);
          }
        }
      });
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
      const v = (h / 100) * 255;
      imageData.data[i * 4] = v;
      imageData.data[i * 4 + 1] = v;
      imageData.data[i * 4 + 2] = v;
      imageData.data[i * 4 + 3] = 255;
    });

    ctx.putImageData(imageData, 0, 0);
  }

  function downloadPreview() {
    const preview = document.getElementById("preview");
    const dataURL = preview.toDataURL("image/png");

    const img = new Image();
    img.src = dataURL;

    img.onload = function () {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = svgWidth;
      canvas.height = svgHeight;
      document.body.insertBefore(canvas, optionsContainer);
      ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
      const imgBig = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = getFileName("Heightmap") + ".png";
      link.href = imgBig;
      link.click();
      canvas.remove();
    };
  }
}
