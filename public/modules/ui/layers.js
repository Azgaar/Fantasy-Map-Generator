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
      measureLayer("compass", () => redrawPixiLayer("compass"));
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
    if (layerIsOn("togglePopulation")) measureLayer("population", () => redrawPixiLayer("population"));
    if (layerIsOn("toggleIce")) measureLayer("ice", () => redrawPixiLayer("ice"));
    if (layerIsOn("togglePrecipitation")) measureLayer("precipitation", drawPrecipitation);
    if (layerIsOn("toggleGoods")) measureLayer("goods", () => redrawPixiLayer("goods"));
    if (layerIsOn("toggleMarketsLayer")) measureLayer("markets", () => redrawPixiLayer("markets"));
    if (layerIsOn("toggleEmblems")) measureLayer("emblems", drawEmblems);
    measureLayer("labels", drawLabels);
    if (layerIsOn("toggleBurgIcons")) measureLayer("burg-icons", () => redrawPixiLayer("burgIcons"));
    if (layerIsOn("toggleMilitary")) measureLayer("military", () => redrawPixiLayer("military"));
    if (layerIsOn("toggleMarkers")) measureLayer("markers", () => redrawPixiLayer("markers"));
    if (layerIsOn("toggleRulers")) measureLayer("rulers", drawMeasurers);
    // scale bar
    // vignette
  };
  const result = window.MapPerformance ? window.MapPerformance.measure("render:total", drawActiveLayers) : drawActiveLayers();
  window.dispatchEvent(
    new CustomEvent("map:pixi-renderer:command", {detail: {command: "queue-rebuild"}})
  );
  return result;
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
  if (!layerIsOn("toggleTemperature")) {
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
  if (!layerIsOn("toggleBiomes")) {
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
  }
}

function drawPrecipitation() {
  TIME && console.time("drawPrecipitation");
  redrawPixiLayer("precipitation", "prec");
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
  }
}

function drawPopulation() {
  redrawPixiLayer("population");
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
  if (customization === 1 && window.ViewportCells) return window.ViewportCells.draw();
  window.ViewportCells?.clear();
  redrawPixiLayer("cells", "cells");
}

function toggleIce(event) {
  if (!layerIsOn("toggleIce")) {
    turnButtonOn("toggleIce");
    redrawPixiLayer("ice");
    if (event && isCtrlClick(event)) editStyle("ice");
  } else {
    if (event && isCtrlClick(event)) return editStyle("ice");
    turnButtonOff("toggleIce");
  }
}

function toggleCultures(event) {
  if (!layerIsOn("toggleCultures")) {
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
  redrawPixiLayer("cultures", "cults");
  TIME && console.timeEnd("drawCultures");
}

function toggleReligions(event) {
  if (!layerIsOn("toggleReligions")) {
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
  redrawPixiLayer("religions", "relig");
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
  redrawPixiLayer("states", "statesBody", "statesHalo", "statePaths");
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
  redrawPixiLayer("provinces", "provs");
  TIME && console.timeEnd("drawProvinces");
}

function toggleGrid(event) {
  if (!layerIsOn("toggleGrid")) {
    turnButtonOn("toggleGrid");
    drawGrid();
    calculateFriendlyGridSize();
    if (event && isCtrlClick(event)) editStyle("gridOverlay");
  } else {
    if (event && isCtrlClick(event)) return editStyle("gridOverlay");
    turnButtonOff("toggleGrid");
  }
}

function drawGrid() {
  style.mapRenderer ||= {};
  const current = style.mapRenderer.grid || {};
  const currentStroke = current.stroke || {};
  style.mapRenderer.grid = {
    ...current,
    dx: Number(gridOverlay.attr("dx") || 0),
    dy: Number(gridOverlay.attr("dy") || 0),
    opacity: Number(gridOverlay.attr("opacity") ?? 1),
    scale: Number(gridOverlay.attr("scale") || 1),
    stroke: {
      ...currentStroke,
      cap: gridOverlay.attr("stroke-linecap") || currentStroke.cap || "butt",
      color: gridOverlay.attr("stroke") || currentStroke.color || "#777777",
      dash: gridOverlay.attr("stroke-dasharray") || "",
      opacity: 1,
      width: Number(gridOverlay.attr("stroke-width") || 0.5)
    },
    type: gridOverlay.attr("type") || "pointyHex"
  };
  redrawPixiLayer("grid", "gridOverlay");
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
    redrawPixiLayer("compass");
    if (event && isCtrlClick(event)) editStyle("compass");
  } else {
    if (event && isCtrlClick(event)) return editStyle("compass");
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
    turnButtonOff("toggleRivers");
  }
}

function drawRivers() {
  TIME && console.time("drawRivers");
  window.dispatchEvent(
    new CustomEvent("map:pixi-renderer:command", {
      detail: {command: "invalidate-layer", layer: "rivers"}
    })
  );
  TIME && console.timeEnd("drawRivers");
}

function toggleRoutes(event) {
  if (!layerIsOn("toggleRoutes")) {
    turnButtonOn("toggleRoutes");
    drawRoutes();
    if (event && isCtrlClick(event)) editStyle("routes");
  } else {
    if (event && isCtrlClick(event)) return editStyle("routes");
    turnButtonOff("toggleRoutes");
  }
}

function drawRoutes() {
  TIME && console.time("drawRoutes");
  window.dispatchEvent(
    new CustomEvent("map:pixi-renderer:command", {
      detail: {command: "invalidate-layer", layer: "routes"}
    })
  );
  TIME && console.timeEnd("drawRoutes");
}

function drawRoute(route) {
  drawRoutes();
}

function toggleMilitary(event) {
  if (!layerIsOn("toggleMilitary")) {
    turnButtonOn("toggleMilitary");
    redrawPixiLayer("military");
    if (event && isCtrlClick(event)) editStyle("armies");
  } else {
    if (event && isCtrlClick(event)) return editStyle("armies");
    turnButtonOff("toggleMilitary");
  }
}

function toggleMarkers(event) {
  if (!layerIsOn("toggleMarkers")) {
    turnButtonOn("toggleMarkers");
    redrawPixiLayer("markers");
    if (event && isCtrlClick(event)) tip("Markers now use semantic Pixi styles", false, "warn");
  } else {
    if (event && isCtrlClick(event)) return tip("Markers now use semantic Pixi styles", false, "warn");
    turnButtonOff("toggleMarkers");
  }
}

function toggleTrade(event) {
  if (!layerIsOn("toggleTrade")) {
    turnButtonOn("toggleTrade");
    redrawPixiLayer("trade");
    TradeAnimation.start();
    if (event && isCtrlClick(event)) editStyle("tradeAnimation");
  } else {
    if (event && isCtrlClick(event)) return editStyle("tradeAnimation");
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
    redrawPixiLayer("burgIcons");
    if (event && isCtrlClick(event)) tip("Burg symbols now use semantic Pixi styles", false, "warn");
  } else {
    if (event && isCtrlClick(event)) return tip("Burg symbols now use semantic Pixi styles", false, "warn");
    turnButtonOff("toggleBurgIcons");
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
  style.mapRenderer ||= {};
  const current = style.mapRenderer.zones || {};
  style.mapRenderer.zones = {
    ...current,
    filterType: filterBy && filterBy !== "all" ? filterBy : null,
    opacity: current.opacity ?? Number(zones.attr("opacity") || 1)
  };
  redrawPixiLayer("zones", "zones");
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

function redrawPixiLayer(layer, ...svgLayerIds) {
  for (const id of svgLayerIds) document.getElementById(id)?.replaceChildren();
  window.dispatchEvent(
    new CustomEvent("map:pixi-renderer:command", {
      detail: {command: "invalidate-layer", layer}
    })
  );
}

function layerIsOn(el) {
  return ensureEl(el).classList.contains("buttonoff") ? false : true;
}

function turnButtonOff(el) {
  ensureEl(el).classList.add("buttonoff");
  getCurrentPreset();
  ViewportLayers.invalidateAll();
  notifyLayerControlsChanged();
}

function turnButtonOn(el) {
  ensureEl(el).classList.remove("buttonoff");
  getCurrentPreset();
  ViewportLayers.invalidateAll();
  notifyLayerControlsChanged();
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
