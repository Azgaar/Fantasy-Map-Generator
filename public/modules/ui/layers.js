// UI module stub to control map layers
"use strict";

const LAYER_CONTROLS_CHANGE_EVENT = "fmg-layer-controls-change";

let presets = {}; // global object
restoreCustomPresets(); // run on-load

function getDefaultPresets() {
  return {
    political: [
      "toggleBorders",
      "toggleBurgIcons",
      "toggleIce",
      "toggleLabels",
      "toggleLakes",
      "toggleRivers",
      "toggleRoutes",
      "toggleScaleBar",
      "toggleStates",
      "toggleVignette"
    ],
    cultural: [
      "toggleBorders",
      "toggleBurgIcons",
      "toggleCultures",
      "toggleLabels",
      "toggleLakes",
      "toggleRivers",
      "toggleRoutes",
      "toggleScaleBar",
      "toggleVignette"
    ],
    religions: [
      "toggleBorders",
      "toggleBurgIcons",
      "toggleLabels",
      "toggleLakes",
      "toggleReligions",
      "toggleRivers",
      "toggleRoutes",
      "toggleScaleBar",
      "toggleVignette"
    ],
    provinces: [
      "toggleBorders",
      "toggleBurgIcons",
      "toggleLabels",
      "toggleLakes",
      "toggleProvinces",
      "toggleRivers",
      "toggleScaleBar",
      "toggleVignette"
    ],
    biomes: ["toggleBiomes", "toggleIce", "toggleLakes", "toggleRivers", "toggleScaleBar", "toggleVignette"],
    heightmap: ["toggleHeight", "toggleLakes", "toggleRivers", "toggleVignette"],
    physical: [
      "toggleCoordinates",
      "toggleHeight",
      "toggleIce",
      "toggleLakes",
      "toggleRivers",
      "toggleScaleBar",
      "toggleVignette"
    ],
    poi: [
      "toggleBorders",
      "toggleBurgIcons",
      "toggleHeight",
      "toggleIce",
      "toggleLakes",
      "toggleMarkers",
      "toggleRivers",
      "toggleRoutes",
      "toggleScaleBar",
      "toggleVignette"
    ],
    goods: [
      "toggleBorders",
      "toggleBurgIcons",
      "toggleCells",
      "toggleGoods",
      "toggleMarketsLayer",
      "toggleLakes",
      "toggleRivers",
      "toggleRoutes",
      "toggleScaleBar",
      "toggleTrade",
      "toggleVignette"
    ],
    trade: [
      "toggleBorders",
      "toggleBurgIcons",
      "toggleLakes",
      "toggleRivers",
      "toggleRoutes",
      "toggleScaleBar",
      "toggleStates",
      "toggleTrade",
      "toggleVignette"
    ],
    military: [
      "toggleBorders",
      "toggleBurgIcons",
      "toggleLabels",
      "toggleLakes",
      "toggleMilitary",
      "toggleRivers",
      "toggleRoutes",
      "toggleScaleBar",
      "toggleStates",
      "toggleVignette"
    ],
    emblems: [
      "toggleBorders",
      "toggleBurgIcons",
      "toggleIce",
      "toggleEmblems",
      "toggleLakes",
      "toggleRivers",
      "toggleRoutes",
      "toggleScaleBar",
      "toggleStates",
      "toggleVignette"
    ],
    landmass: ["toggleScaleBar"]
  };
}

function restoreCustomPresets() {
  presets = getDefaultPresets();
  const storedPresets = JSON.parse(localStorage.getItem("presets"));
  if (!storedPresets) return;

  for (const preset in storedPresets) {
    if (presets[preset]) continue;
    layersPreset.add(new Option(preset, preset));
  }

  presets = storedPresets;
}

// run on map generation
function applyLayersPreset() {
  let preset = localStorage.getItem("preset") || ensureEl("layersPreset").value;
  if (!(preset in presets)) preset = "political"; // fallback to default if preset is removed
  setLayersPreset(preset);

  const layers = presets[preset]; // layers to be turned on
  document.querySelectorAll("#mapLayers > li").forEach(el => {
    const shouldBeOn = layers.includes(el.id);
    if (shouldBeOn) el.classList.remove("buttonoff");
    else el.classList.add("buttonoff");
  });
  notifyLayerControlsChanged();
}

function setLayersPreset(preset) {
  ensureEl("layersPreset").value = preset;
  localStorage.setItem("preset", preset);

  const isDefault = getDefaultPresets()[preset];
  ensureEl("removePresetButton").style.display = isDefault ? "none" : "inline-block";
  ensureEl("savePresetButton").style.display = "none";
}

// toggle layers on manual preset change
function handleLayersPresetChange(preset) {
  setLayersPreset(preset);

  const layers = presets[preset]; // layers to be turned on
  document.querySelectorAll("#mapLayers > li").forEach(el => {
    const isOn = layerIsOn(el.id);
    const shouldBeOn = layers.includes(el.id);
    if (shouldBeOn && !isOn) el.click();
    if (isOn && !shouldBeOn) el.click();
  });

  if (findEl("canvas3d")) setTimeout(() => window.Controllers.View3d.update(), 400);
  notifyLayerControlsChanged();
}

function savePreset() {
  prompt("Please provide a preset name", { default: "" }, savePresetByName);
}

function savePresetByName(preset) {
  if (!preset) return;
  presets[preset] = Array.from(ensureEl("mapLayers").querySelectorAll("li:not(.buttonoff)"))
    .map(node => node.id)
    .sort();

  const layersPreset = ensureEl("layersPreset");
  const existingOption = Array.from(layersPreset.options).find(option => option.value === preset);
  if (existingOption) layersPreset.value = preset;
  else layersPreset.add(new Option(preset, preset, false, true));

  localStorage.setItem("presets", JSON.stringify(presets));
  localStorage.setItem("preset", preset);
  ensureEl("removePresetButton").style.display = "inline-block";
  ensureEl("savePresetButton").style.display = "none";
  notifyLayerControlsChanged();
}

function removePreset() {
  const preset = layersPreset.value;
  delete presets[preset];
  const index = Array.from(layersPreset.options).findIndex(o => o.value === preset);
  layersPreset.options.remove(index);
  layersPreset.value = "custom";
  removePresetButton.style.display = "none";
  savePresetButton.style.display = "inline-block";

  localStorage.setItem("presets", JSON.stringify(presets));
  localStorage.removeItem("preset");
  notifyLayerControlsChanged();
}

function getCurrentPreset() {
  const layers = Array.from(document.querySelectorAll("#mapLayers > li:not(.buttonoff)"))
    .map(node => node.id)
    .sort();

  for (const preset in presets) {
    if (JSON.stringify(presets[preset].sort()) === JSON.stringify(layers)) {
      layersPreset.value = preset;
      const isDefault = getDefaultPresets()[preset];
      removePresetButton.style.display = isDefault ? "none" : "inline-block";
      savePresetButton.style.display = "none";
      notifyLayerControlsChanged();
      return;
    }
  }

  layersPreset.value = "custom";
  removePresetButton.style.display = "none";
  savePresetButton.style.display = "inline-block";
  notifyLayerControlsChanged();
}

// run on each map generation
function drawLayers() {
  const measureLayer = (name, action) =>
    window.MapPerformance ? window.MapPerformance.measure(`render:${name}`, action) : action();
  const drawActiveLayers = () => {
    measureLayer("features", drawFeatures);
    if (layerIsOn("toggleTexture")) measureLayer("texture", drawTexture);
    if (layerIsOn("toggleHeight")) measureLayer("height", drawHeightmap);
    if (layerIsOn("toggleBiomes")) measureLayer("biomes", drawBiomes);
    if (layerIsOn("toggleCells")) measureLayer("cells", drawCells);
    if (layerIsOn("toggleGrid")) measureLayer("grid", drawGrid);
    if (layerIsOn("toggleCoordinates")) measureLayer("coordinates", drawCoordinates);
    if (layerIsOn("toggleCompass")) {
      measureLayer("compass", () => {
        if (!compass.select("use").size()) compass.append("use").attr("xlink:href", "#defs-compass-rose");
        compass.style("display", "block");
      });
    }
    if (layerIsOn("toggleRivers")) measureLayer("rivers", drawRivers);
    measureLayer("relief", drawRelief);
    if (layerIsOn("toggleReligions")) measureLayer("religions", drawReligions);
    if (layerIsOn("toggleCultures")) measureLayer("cultures", drawCultures);
    if (layerIsOn("toggleStates")) measureLayer("states", drawStates);
    if (layerIsOn("toggleProvinces")) measureLayer("provinces", drawProvinces);
    if (layerIsOn("toggleTrade")) measureLayer("trade", () => TradeAnimation.start());
    if (layerIsOn("toggleZones")) measureLayer("zones", drawZones);
    if (layerIsOn("toggleBorders")) measureLayer("borders", drawBorders);
    if (layerIsOn("toggleRoutes")) measureLayer("routes", drawRoutes);
    if (layerIsOn("toggleTemperature")) measureLayer("temperature", drawTemperature);
    if (layerIsOn("togglePopulation")) measureLayer("population", drawPopulation);
    if (layerIsOn("toggleIce")) measureLayer("ice", drawIce);
    if (layerIsOn("togglePrecipitation")) measureLayer("precipitation", drawPrecipitation);
    if (layerIsOn("toggleGoods")) measureLayer("goods", drawGoods);
    if (layerIsOn("toggleMarketsLayer")) measureLayer("markets", drawMarketsLayer);
    if (layerIsOn("toggleEmblems")) measureLayer("emblems", drawEmblems);
    measureLayer("labels", drawLabels);
    if (layerIsOn("toggleBurgIcons")) measureLayer("burg-icons", drawBurgIcons);
    if (layerIsOn("toggleMilitary")) measureLayer("military", drawMilitary);
    if (layerIsOn("toggleMarkers")) measureLayer("markers", drawMarkers);
    if (layerIsOn("toggleRulers")) measureLayer("rulers", drawMeasurers);
    // scale bar
    // vignette
  };
  return window.MapPerformance ? window.MapPerformance.measure("render:total", drawActiveLayers) : drawActiveLayers();
}

function toggleHeight(event) {
  if (customization === 1) return tip("You cannot turn off the layer when heightmap is in edit mode", false, "error");

  const children = terrs.selectAll("#oceanHeights > *, #landHeights > *");
  if (!children.size()) {
    turnButtonOn("toggleHeight");
    drawHeightmap();
    if (event && isCtrlClick(event)) editStyle("terrs");
  } else {
    if (event && isCtrlClick(event)) return editStyle("terrs");
    turnButtonOff("toggleHeight");
    children.remove();
  }
}

function toggleTemperature(event) {
  if (!temperature.selectAll("*").size()) {
    turnButtonOn("toggleTemperature");
    drawTemperature();
    if (event && isCtrlClick(event)) editStyle("temperature");
  } else {
    if (event && isCtrlClick(event)) return editStyle("temperature");
    turnButtonOff("toggleTemperature");
    temperature.selectAll("*").remove();
  }
}

function toggleBiomes(event) {
  if (!biomes.selectAll("path").size()) {
    turnButtonOn("toggleBiomes");
    drawBiomes();
    if (event && isCtrlClick(event)) editStyle("biomes");
  } else {
    if (event && isCtrlClick(event)) return editStyle("biomes");
    biomes.selectAll("path").remove();
    turnButtonOff("toggleBiomes");
  }
}

function togglePrecipitation(event) {
  if (!layerIsOn("togglePrecipitation")) {
    turnButtonOn("togglePrecipitation");
    drawPrecipitation();
    if (event && isCtrlClick(event)) editStyle("prec");
  } else {
    if (event && isCtrlClick(event)) return editStyle("prec");
    turnButtonOff("togglePrecipitation");
    if (window.ViewportPrecipitation) {
      window.ViewportPrecipitation.clear();
      prec.style("display", "none");
      return;
    }
    const hide = d3.transition().duration(1000).ease(d3.easeSinIn);
    prec.selectAll("text").attr("opacity", 1).transition(hide).attr("opacity", 0);
    prec.selectAll("circle").transition(hide).attr("r", 0).remove();
    prec.transition().delay(1000).style("display", "none");
  }
}

function drawPrecipitation() {
  if (window.ViewportPrecipitation) return window.ViewportPrecipitation.draw();
  TIME && console.time("drawPrecipitation");

  prec.selectAll("circle").remove();
  const { cells, points } = grid;

  const show = d3.transition().duration(800).ease(d3.easeSinIn);
  prec.selectAll("text").attr("opacity", 0).transition(show).attr("opacity", 1);

  const cellsNumberModifier = (pointsInput.dataset.cells / 10000) ** 0.25;
  const data = cells.i.filter(i => cells.h[i] >= 20 && cells.prec[i]);
  const getRadius = prec => rn(Math.sqrt(prec / 4) / cellsNumberModifier, 2);

  prec
    .style("display", "block")
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", d => points[d][0])
    .attr("cy", d => points[d][1])
    .attr("r", 0)
    .transition(show)
    .attr("r", d => getRadius(cells.prec[d]));

  TIME && console.timeEnd("drawPrecipitation");
}

function togglePopulation(event) {
  if (!layerIsOn("togglePopulation")) {
    turnButtonOn("togglePopulation");
    drawPopulation();
    if (event && isCtrlClick(event)) editStyle("population");
  } else {
    if (event && isCtrlClick(event)) return editStyle("population");
    turnButtonOff("togglePopulation");
    if (window.ViewportPopulation) return window.ViewportPopulation.clear();

    const isD3data = population.select("line").datum();
    if (!isD3data) {
      // just remove
      population.selectAll("line").remove();
    } else {
      // remove with animation
      const hide = d3.transition().duration(1000).ease(d3.easeSinIn);
      population
        .select("#rural")
        .selectAll("line")
        .transition(hide)
        .attr("y2", d => d[1])
        .remove();
      population
        .select("#urban")
        .selectAll("line")
        .transition(hide)
        .delay(1000)
        .attr("y2", d => d[1])
        .remove();
    }
  }
}

function drawPopulation() {
  if (window.ViewportPopulation) return window.ViewportPopulation.draw();
  population.selectAll("line").remove();

  const { cells, burgs } = pack;
  const show = d3.transition().duration(2000).ease(d3.easeSinIn);

  const rural = Array.from(
    cells.i.filter(i => cells.pop[i] > 0),
    i => [...cells.p[i], cells.p[i][1] - cells.pop[i] / 5]
  );

  population
    .select("#rural")
    .selectAll("line")
    .data(rural)
    .enter()
    .append("line")
    .attr("x1", d => d[0])
    .attr("y1", d => d[1])
    .attr("x2", d => d[0])
    .attr("y2", d => d[1])
    .transition(show)
    .attr("y2", d => d[2]);

  const urban = burgs.filter(b => b.i && !b.removed).map(b => [b.x, b.y, b.y - (b.population / 5) * urbanization]);
  population
    .select("#urban")
    .selectAll("line")
    .data(urban)
    .enter()
    .append("line")
    .attr("x1", d => d[0])
    .attr("y1", d => d[1])
    .attr("x2", d => d[0])
    .attr("y2", d => d[1])
    .transition(show)
    .delay(500)
    .attr("y2", d => d[2]);
}

function toggleCells(event) {
  if (!layerIsOn("toggleCells")) {
    turnButtonOn("toggleCells");
    drawCells();
    if (event && isCtrlClick(event)) editStyle("cells");
  } else {
    if (event && isCtrlClick(event)) return editStyle("cells");
    turnButtonOff("toggleCells");
    if (window.ViewportCells) return window.ViewportCells.clear();
    cells.selectAll("path").remove();
  }
}

function drawCells() {
  if (window.ViewportCells) return window.ViewportCells.draw();
  const cells = customization === 1 ? grid.cells.i : pack.cells.i;
  const polygon = customization === 1 ? getGridPolygon : getPackPolygon;
  const paths = Array.from(cells).map(i => "M" + polygon(i));
  ensureEl("cells").innerHTML = `<path d="${paths.join("")}" />`;
}

function toggleIce(event) {
  if (!layerIsOn("toggleIce")) {
    turnButtonOn("toggleIce");
    ensureEl("ice").style.display = "";
    if (!ice.selectAll("*").size()) drawIce();
    if (event && isCtrlClick(event)) editStyle("ice");
  } else {
    if (event && isCtrlClick(event)) return editStyle("ice");
    ensureEl("ice").style.display = "none";
    turnButtonOff("toggleIce");
  }
}

function toggleCultures(event) {
  const cultures = pack.cultures.filter(c => c.i && !c.removed);
  const empty = !cults.selectAll("path").size();
  if (empty && cultures.length) {
    turnButtonOn("toggleCultures");
    drawCultures();
    if (event && isCtrlClick(event)) editStyle("cults");
  } else {
    if (event && isCtrlClick(event)) return editStyle("cults");
    cults.selectAll("path").remove();
    turnButtonOff("toggleCultures");
  }
}

function drawCultures() {
  TIME && console.time("drawCultures");
  const { cells, cultures } = pack;

  const bodyPaths = new Array(cultures.length - 1);
  const isolines = getIsolines(pack, cellId => cells.culture[cellId], { fill: true, waterGap: true });
  Object.entries(isolines).forEach(([index, { fill, waterGap }]) => {
    const color = cultures[index].color;
    bodyPaths.push(getGappedFillPaths("culture", fill, waterGap, color, index));
  });

  ensureEl("cults").innerHTML = bodyPaths.join("");

  TIME && console.timeEnd("drawCultures");
}

function toggleReligions(event) {
  const religions = pack.religions.filter(r => r.i && !r.removed);
  if (!relig.selectAll("path").size() && religions.length) {
    turnButtonOn("toggleReligions");
    drawReligions();
    if (event && isCtrlClick(event)) editStyle("relig");
  } else {
    if (event && isCtrlClick(event)) return editStyle("relig");
    relig.selectAll("path").remove();
    turnButtonOff("toggleReligions");
  }
}

function drawReligions() {
  TIME && console.time("drawReligions");
  const { cells, religions } = pack;

  const bodyPaths = new Array(religions.length - 1);
  const isolines = getIsolines(pack, cellId => cells.religion[cellId], { fill: true, waterGap: true });
  Object.entries(isolines).forEach(([index, { fill, waterGap }]) => {
    const color = religions[index].color;
    bodyPaths.push(getGappedFillPaths("religion", fill, waterGap, color, index));
  });

  ensureEl("relig").innerHTML = bodyPaths.join("");

  TIME && console.timeEnd("drawReligions");
}

function toggleStates(event) {
  if (!layerIsOn("toggleStates")) {
    turnButtonOn("toggleStates");
    drawStates();
    if (event && isCtrlClick(event)) editStyle("regions");
  } else {
    if (event && isCtrlClick(event)) return editStyle("regions");
    regions.selectAll("path").remove();
    turnButtonOff("toggleStates");
  }
}

function drawStates() {
  TIME && console.time("drawStates");
  const { cells, states } = pack;

  const maxLength = states.length - 1;
  const bodyPaths = new Array(maxLength);
  const clipPaths = new Array(maxLength);
  const haloPaths = new Array(maxLength);

  const renderHalo = shapeRendering.value === "geometricPrecision";
  const isolines = getIsolines(pack, cellId => cells.state[cellId], { fill: true, waterGap: true, halo: renderHalo });
  Object.entries(isolines).forEach(([index, { fill, waterGap, halo }]) => {
    const color = states[index].color;
    bodyPaths.push(getGappedFillPaths("state", fill, waterGap, color, index));

    if (renderHalo) {
      const haloColor = d3.color(color)?.darker().hex() || "#666666";
      clipPaths.push(/* html */ `<clipPath id="state-clip${index}"><use href="#state${index}"/></clipPath>`);
      haloPaths.push(
        /* html */ `<path id="state-border${index}" d="${halo}" clip-path="url(#state-clip${index})" stroke="${haloColor}"/>`
      );
    }
  });

  ensureEl("statesBody").innerHTML = bodyPaths.join("");
  ensureEl("statePaths").innerHTML = renderHalo ? clipPaths.join("") : "";
  ensureEl("statesHalo").innerHTML = renderHalo ? haloPaths.join("") : "";

  TIME && console.timeEnd("drawStates");
}

function toggleBorders(event) {
  if (!layerIsOn("toggleBorders")) {
    turnButtonOn("toggleBorders");
    drawBorders();
    if (event && isCtrlClick(event)) editStyle("borders");
  } else {
    if (event && isCtrlClick(event)) return editStyle("borders");
    turnButtonOff("toggleBorders");
    borders.selectAll("path").remove();
  }
}

function toggleProvinces(event) {
  if (!layerIsOn("toggleProvinces")) {
    turnButtonOn("toggleProvinces");
    drawProvinces();
    if (event && isCtrlClick(event)) editStyle("provs");
  } else {
    if (event && isCtrlClick(event)) return editStyle("provs");
    provs.selectAll("*").remove();
    turnButtonOff("toggleProvinces");
  }
}

function drawProvinces() {
  TIME && console.time("drawProvinces");
  const { cells, provinces } = pack;

  const bodyPaths = new Array(provinces.length - 1);
  const isolines = getIsolines(pack, cellId => cells.province[cellId], { fill: true, waterGap: true });
  Object.entries(isolines).forEach(([index, { fill, waterGap }]) => {
    const color = provinces[index].color;
    bodyPaths.push(getGappedFillPaths("province", fill, waterGap, color, index));
  });

  ensureEl("provs").innerHTML = /* html */ `
    <g id='provincesBody'>${bodyPaths.join("")}</g>
  `;

  TIME && console.timeEnd("drawProvinces");
}

function toggleGrid(event) {
  if (!gridOverlay.selectAll("*").size()) {
    turnButtonOn("toggleGrid");
    drawGrid();
    calculateFriendlyGridSize();
    if (event && isCtrlClick(event)) editStyle("gridOverlay");
  } else {
    if (event && isCtrlClick(event)) return editStyle("gridOverlay");
    turnButtonOff("toggleGrid");
    gridOverlay.selectAll("*").remove();
  }
}

function drawGrid() {
  gridOverlay.selectAll("*").remove();
  const pattern = "#pattern_" + (gridOverlay.attr("type") || "pointyHex");
  const stroke = gridOverlay.attr("stroke") || "#808080";
  const width = gridOverlay.attr("stroke-width") || 0.5;
  const dasharray = gridOverlay.attr("stroke-dasharray") || null;
  const linecap = gridOverlay.attr("stroke-linecap") || null;
  const scale = gridOverlay.attr("scale") || 1;
  const dx = gridOverlay.attr("dx") || 0;
  const dy = gridOverlay.attr("dy") || 0;
  const tr = `scale(${scale}) translate(${dx} ${dy})`;

  const maxWidth = Math.max(+mapWidthInput.value, graphWidth);
  const maxHeight = Math.max(+mapHeightInput.value, graphHeight);

  d3.select(pattern)
    .attr("stroke", stroke)
    .attr("stroke-width", width)
    .attr("stroke-dasharray", dasharray)
    .attr("stroke-linecap", linecap)
    .attr("patternTransform", tr);
  gridOverlay
    .append("rect")
    .attr("width", maxWidth)
    .attr("height", maxHeight)
    .attr("fill", "url(" + pattern + ")")
    .attr("stroke", "none");
}

function toggleCoordinates(event) {
  if (!coordinates.selectAll("*").size()) {
    turnButtonOn("toggleCoordinates");
    drawCoordinates();
    if (event && isCtrlClick(event)) editStyle("coordinates");
  } else {
    if (event && isCtrlClick(event)) return editStyle("coordinates");
    turnButtonOff("toggleCoordinates");
    coordinates.selectAll("*").remove();
  }
}

function drawCoordinates() {
  coordinates.selectAll("*").remove(); // remove every time

  const steps = [0.5, 1, 2, 5, 10, 15, 30]; // possible steps
  const goal = mapCoordinates.lonT / scale / 10;
  const step = steps.reduce((p, c) => (Math.abs(c - goal) < Math.abs(p - goal) ? c : p));

  const desired = +coordinates.attr("data-size"); // desired label size
  coordinates.attr("font-size", Math.max(rn(desired / scale ** 0.8, 2), 0.1)); // actual label size

  const graticule = d3
    .geoGraticule()
    .extent([
      [mapCoordinates.lonW, mapCoordinates.latN],
      [mapCoordinates.lonE + 0.1, mapCoordinates.latS + 0.1]
    ])
    .stepMajor([400, 400])
    .stepMinor([step, step]);
  const projection = d3.geoEquirectangular().fitSize([graphWidth, graphHeight], graticule());

  const grid = coordinates.append("g").attr("id", "coordinateGrid");
  const labels = coordinates.append("g").attr("id", "coordinateLabels");

  const point = new DOMPoint(scale + desired + 2, scale + desired / 2);
  const p = point.matrixTransform(ensureEl("viewbox").getScreenCTM().inverse());

  const data = graticule.lines().map(d => {
    const isLatitude = d.coordinates[0][1] === d.coordinates[1][1];
    const coordinate = d.coordinates[0];
    const position = projection(coordinate); // map coordinates
    const [x, y] = isLatitude ? [rn(p.x, 2), rn(position[1], 2)] : [rn(position[0], 2), rn(p.y, 2)]; // labels position
    const value = isLatitude ? coordinate[1] : coordinate[0]; // label

    let text = "";
    if (!value) {
      text = value;
    } else if (Number.isInteger(value)) {
      if (isLatitude) {
        text = coordinate[1] < 0 ? -coordinate[1] + "°S" : coordinate[1] + "°N";
      } else {
        text = coordinate[0] < 0 ? -coordinate[0] + "°W" : coordinate[0] + "°E";
      }
    }

    return { x, y, text };
  });

  const path = round(d3.geoPath(projection)(graticule()));
  grid.append("path").attr("d", path).attr("vector-effect", "non-scaling-stroke");
  labels
    .selectAll("text")
    .data(data)
    .enter()
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .attr("x", d => d.x)
    .attr("y", d => d.y)
    .text(d => d.text);
}

function toggleCompass(event) {
  if (!layerIsOn("toggleCompass")) {
    turnButtonOn("toggleCompass");
    if (!compass.select("use").size()) compass.append("use").attr("xlink:href", "#defs-compass-rose");
    ensureEl("compass").style.display = "";
    if (event && isCtrlClick(event)) editStyle("compass");
  } else {
    if (event && isCtrlClick(event)) return editStyle("compass");
    ensureEl("compass").style.display = "none";
    turnButtonOff("toggleCompass");
  }
}

function toggleRelief(event) {
  if (!layerIsOn("toggleRelief")) {
    turnButtonOn("toggleRelief");
    if (event && isCtrlClick(event)) editStyle("terrain");
  } else {
    if (event && isCtrlClick(event)) return editStyle("terrain");
    turnButtonOff("toggleRelief");
  }
  drawRelief();
}

function toggleLakes(event) {
  if (!layerIsOn("toggleLakes")) {
    turnButtonOn("toggleLakes");
    ensureEl("lakes").style.display = "";
    if (event && isCtrlClick(event)) editStyle("lakes");
  } else {
    if (event && isCtrlClick(event)) return editStyle("lakes");
    ensureEl("lakes").style.display = "none";
    turnButtonOff("toggleLakes");
  }
}

function toggleTexture(event) {
  if (!layerIsOn("toggleTexture")) {
    turnButtonOn("toggleTexture");
    drawTexture();
    if (event && isCtrlClick(event)) editStyle("texture");
  } else {
    if (event && isCtrlClick(event)) return editStyle("texture");
    turnButtonOff("toggleTexture");
    texture.select("image").remove();
  }
}

function drawTexture() {
  const x = Number(texture.attr("data-x") || 0);
  const y = Number(texture.attr("data-y") || 0);
  const href = texture.attr("data-href");

  texture
    .append("image")
    .attr("preserveAspectRatio", "xMidYMid slice")
    .attr("x", x)
    .attr("y", y)
    .attr("width", graphWidth - x)
    .attr("height", graphHeight - y)
    .attr("href", href);
}

function toggleRivers(event) {
  if (!layerIsOn("toggleRivers")) {
    turnButtonOn("toggleRivers");
    drawRivers();
    if (event && isCtrlClick(event)) editStyle("rivers");
  } else {
    if (event && isCtrlClick(event)) return editStyle("rivers");
    rivers.selectAll("*").remove();
    turnButtonOff("toggleRivers");
  }
}

function drawRivers() {
  TIME && console.time("drawRivers");
  rivers.selectAll("*").remove();

  const riverPaths = pack.rivers.map(({ cells, points, i, widthFactor, sourceWidth }) => {
    if (!cells || cells.length < 2) return;

    if (points && points.length !== cells.length) {
      console.error(
        `River ${i} has ${cells.length} cells, but only ${points.length} points defined. Resetting points data`
      );
      points = undefined;
    }

    const meanderedPoints = Rivers.addMeandering(cells, points);
    const path = Rivers.getRiverPath(meanderedPoints, widthFactor, sourceWidth);
    return `<path id="river${i}" d="${path}"/>`;
  });
  rivers.html(riverPaths.join(""));

  TIME && console.timeEnd("drawRivers");
}

function toggleRoutes(event) {
  if (!layerIsOn("toggleRoutes")) {
    turnButtonOn("toggleRoutes");
    drawRoutes();
    if (event && isCtrlClick(event)) editStyle("routes");
  } else {
    if (event && isCtrlClick(event)) return editStyle("routes");
    routes.selectAll("path").remove();
    turnButtonOff("toggleRoutes");
  }
}

function drawRoutes() {
  TIME && console.time("drawRoutes");
  const routePaths = {};

  for (const route of pack.routes) {
    const { i, group, points } = route;
    if (!points || points.length < 2) continue;
    if (!routePaths[group]) routePaths[group] = [];
    routePaths[group].push(`<path id="route${i}" d="${Routes.getPath(route)}"/>`);
  }

  routes.attr("fill", "none").selectAll("path").remove();
  for (const group in routePaths) {
    routes.select("#" + group).html(routePaths[group].join(""));
  }

  TIME && console.timeEnd("drawRoutes");
}

function drawRoute(route) {
  routes
    .select("#" + route.group)
    .append("path")
    .attr("d", Routes.getPath(route))
    .attr("id", "route" + route.i);
}

function toggleMilitary(event) {
  if (!layerIsOn("toggleMilitary")) {
    turnButtonOn("toggleMilitary");
    drawMilitary();
    if (event && isCtrlClick(event)) editStyle("armies");
  } else {
    if (event && isCtrlClick(event)) return editStyle("armies");
    armies.selectAll("g").remove();
    turnButtonOff("toggleMilitary");
  }
}

function toggleMarkers(event) {
  if (!layerIsOn("toggleMarkers")) {
    turnButtonOn("toggleMarkers");
    drawMarkers();
    if (event && isCtrlClick(event)) editStyle("markers");
  } else {
    if (event && isCtrlClick(event)) return editStyle("markers");
    markers.html("");
    turnButtonOff("toggleMarkers");
  }
}

function toggleTrade(event) {
  if (!layerIsOn("toggleTrade")) {
    turnButtonOn("toggleTrade");
    tradeAnimation.style("display", null);
    TradeAnimation.start();
    if (event && isCtrlClick(event)) editStyle("tradeAnimation");
  } else {
    if (event && isCtrlClick(event)) return editStyle("tradeAnimation");
    tradeAnimation.style("display", "none");
    TradeAnimation.stop();
    turnButtonOff("toggleTrade");
  }
}

function toggleLabels(event) {
  if (!layerIsOn("toggleLabels")) {
    turnButtonOn("toggleLabels");
    if (event && isCtrlClick(event)) editStyle("labels");
  } else {
    if (event && isCtrlClick(event)) return editStyle("labels");
    turnButtonOff("toggleLabels");
  }
  drawLabels();
}

function toggleBurgIcons(event) {
  if (!layerIsOn("toggleBurgIcons")) {
    turnButtonOn("toggleBurgIcons");
    drawBurgIcons();
    if (event && isCtrlClick(event)) editStyle("burgIcons");
  } else {
    if (event && isCtrlClick(event)) return editStyle("burgIcons");
    turnButtonOff("toggleBurgIcons");
    icons.selectAll("circle, use").remove();
  }
}

function toggleRulers(event) {
  if (!layerIsOn("toggleRulers")) {
    turnButtonOn("toggleRulers");
    if (event && isCtrlClick(event)) editStyle("ruler");
    drawMeasurers();
    ruler.style("display", null);
  } else {
    if (event && isCtrlClick(event)) return editStyle("ruler");
    turnButtonOff("toggleRulers");
    ruler.selectAll("*").remove();
    ruler.style("display", "none");
  }
}

function toggleScaleBar(event) {
  if (!layerIsOn("toggleScaleBar")) {
    turnButtonOn("toggleScaleBar");
    ensureEl("scaleBar").style.display = "";
    if (event && isCtrlClick(event)) editStyle("scaleBar");
  } else {
    if (event && isCtrlClick(event)) return editStyle("scaleBar");
    ensureEl("scaleBar").style.display = "none";
    turnButtonOff("toggleScaleBar");
  }
}

function toggleZones(event) {
  if (!layerIsOn("toggleZones")) {
    turnButtonOn("toggleZones");
    drawZones();
    if (event && isCtrlClick(event)) editStyle("zones");
  } else {
    if (event && isCtrlClick(event)) return editStyle("zones");
    turnButtonOff("toggleZones");
    zones.selectAll("*").remove();
  }
}

function drawZones() {
  const filterBy = document.getElementById("zonesFilterType")?.value;
  const isFiltered = filterBy && filterBy !== "all";
  const visibleZones = pack.zones.filter(
    ({ hidden, cells, type }) => !hidden && cells.length && (!isFiltered || type === filterBy)
  );
  zones.html(visibleZones.map(drawZone).join(""));
}

function drawZone({ i, cells, type, color }) {
  const path = getVertexPath(cells);
  return `<path id="zone${i}" data-id="${i}" data-type="${type}" d="${path}" fill="${color}" />`;
}

function toggleEmblems(event) {
  if (!layerIsOn("toggleEmblems")) {
    turnButtonOn("toggleEmblems");
    if (!emblems.selectAll("use").size()) drawEmblems();
    ensureEl("emblems").style.display = "";
    invokeActiveZooming();
    if (event && isCtrlClick(event)) editStyle("emblems");
  } else {
    if (event && isCtrlClick(event)) return editStyle("emblems");
    ensureEl("emblems").style.display = "none";
    turnButtonOff("toggleEmblems");
  }
}

function toggleVignette(event) {
  if (!layerIsOn("toggleVignette")) {
    turnButtonOn("toggleVignette");
    ensureEl("vignette").style.display = "";
    if (event && isCtrlClick(event)) editStyle("vignette");
  } else {
    if (event && isCtrlClick(event)) return editStyle("vignette");
    ensureEl("vignette").style.display = "none";
    turnButtonOff("toggleVignette");
  }
}

function getGappedFillPaths(elementName, fill, waterGap, color, index) {
  let html = "";
  if (fill) html += /* html */ `<path d="${fill}" fill="${color}" id="${elementName}${index}" />`;
  if (waterGap)
    html += /* html */ `<path d="${waterGap}" fill="none" stroke="${color}" stroke-width="3" id="${elementName}-gap${index}" />`;
  return html;
}

function layerIsOn(el) {
  return ensureEl(el).classList.contains("buttonoff") ? false : true;
}

function turnButtonOff(el) {
  ensureEl(el).classList.add("buttonoff");
  getCurrentPreset();
  ViewportLayers.invalidateAll();
}

function turnButtonOn(el) {
  ensureEl(el).classList.remove("buttonoff");
  getCurrentPreset();
  ViewportLayers.invalidateAll();
}

// move layers on mapLayers dragging
window.enableVerticalSortable({
  container: ensureEl("mapLayers"),
  handleSelector: ".fmg-layer-row__handle",
  itemSelector: "li:not(.solid)",
  onUpdate: moveLayer
});
function moveLayer(item) {
  moveLayerById(item.id, item.previousElementSibling?.id, item.nextElementSibling?.id);
  notifyLayerControlsChanged();
}

function moveLayerById(id, previousId, nextId) {
  const el = getLayer(id);
  if (!el) return;
  const prev = previousId ? getLayer(previousId) : null;
  const next = nextId ? getLayer(nextId) : null;
  if (prev) prev.after(el);
  else if (next) next.before(el);
}

// define connection between option layer buttons and actual svg groups to move the element
function getLayer(id) {
  const layerIds = {
    toggleLakes: "lakes",
    toggleHeight: "terrs",
    toggleBiomes: "biomes",
    toggleCells: "cells",
    toggleGrid: "gridOverlay",
    toggleCoordinates: "coordinates",
    toggleCompass: "compass",
    toggleRivers: "rivers",
    toggleRelief: "terrain",
    toggleReligions: "relig",
    toggleCultures: "cults",
    toggleStates: "regions",
    toggleProvinces: "provs",
    toggleZones: "zones",
    toggleBorders: "borders",
    toggleRoutes: "routes",
    toggleTemperature: "temperature",
    togglePrecipitation: "prec",
    togglePopulation: "population",
    toggleIce: "ice",
    toggleTexture: "texture",
    toggleGoods: "goods",
    toggleMarketsLayer: "markets",
    toggleEmblems: "emblems",
    toggleLabels: "labels",
    toggleBurgIcons: "icons",
    toggleMilitary: "armies",
    toggleMarkers: "markers",
    toggleTrade: "tradeAnimation",
    toggleRulers: "ruler"
  };
  return document.getElementById(layerIds[id]);
}

function getLayerControlsSnapshot() {
  const layers = Array.from(ensureEl("mapLayers").querySelectorAll("li")).map(layer => ({
    description: layer.dataset.tip || "",
    fixed: layer.classList.contains("solid"),
    id: layer.id,
    label: layer.dataset.layerLabel || layer.textContent.trim(),
    shortcut: layer.dataset.shortcut || "",
    visible: !layer.classList.contains("buttonoff")
  }));
  const presetSelect = ensureEl("layersPreset");
  const selectedPreset = presetSelect.value;
  const presetOptions = Array.from(presetSelect.options).map(option => ({
    hidden: option.hidden,
    label: option.textContent,
    value: option.value
  }));
  const isDefaultPreset = Boolean(getDefaultPresets()[selectedPreset]);

  return {
    canRemovePreset: selectedPreset !== "custom" && !isDefaultPreset,
    canSavePreset: selectedPreset === "custom",
    layers,
    presetOptions,
    selectedPreset
  };
}

function notifyLayerControlsChanged() {
  window.dispatchEvent(
    new CustomEvent(LAYER_CONTROLS_CHANGE_EVENT, {
      detail: getLayerControlsSnapshot()
    })
  );
}

const layerToggleHandlers = {
  toggleTexture: event => toggleTexture(event),
  toggleHeight: event => toggleHeight(event),
  toggleLakes: event => toggleLakes(event),
  toggleBiomes: event => toggleBiomes(event),
  toggleCells: event => toggleCells(event),
  toggleGrid: event => toggleGrid(event),
  toggleCoordinates: event => toggleCoordinates(event),
  toggleCompass: event => toggleCompass(event),
  toggleRivers: event => toggleRivers(event),
  toggleRelief: event => toggleRelief(event),
  toggleReligions: event => toggleReligions(event),
  toggleCultures: event => toggleCultures(event),
  toggleStates: event => toggleStates(event),
  toggleProvinces: event => toggleProvinces(event),
  toggleZones: event => toggleZones(event),
  toggleBorders: event => toggleBorders(event),
  toggleRoutes: event => toggleRoutes(event),
  toggleTemperature: event => toggleTemperature(event),
  toggleIce: event => toggleIce(event),
  toggleGoods: event => window.toggleGoods(event),
  toggleMarketsLayer: event => window.toggleMarketsLayer(event),
  toggleTrade: event => toggleTrade(event),
  togglePrecipitation: event => togglePrecipitation(event),
  togglePopulation: event => togglePopulation(event),
  toggleEmblems: event => toggleEmblems(event),
  toggleBurgIcons: event => toggleBurgIcons(event),
  toggleLabels: event => toggleLabels(event),
  toggleMilitary: event => toggleMilitary(event),
  toggleMarkers: event => toggleMarkers(event),
  toggleRulers: event => toggleRulers(event),
  toggleScaleBar: event => toggleScaleBar(event),
  toggleVignette: event => toggleVignette(event)
};

window.LayerControls = {
  applyPreset: handleLayersPresetChange,
  getSnapshot: getLayerControlsSnapshot,
  moveLayer: moveLayerById,
  removePreset,
  savePreset: savePresetByName,
  toggleLayer(id, modifiers = {}) {
    const handler = layerToggleHandlers[id];
    if (!handler) return false;
    handler(new MouseEvent("click", modifiers));
    return true;
  }
};
