// UI module stub to control map layers
"use strict";

let presets = {}; // global object
restoreCustomPresets(); // run on-load

function getDefaultPresets() {
  return {
    political: [
      "toggleBorders",
      "toggleBurgIcons",
      "toggleIce",
      "toggleLabels",
      "toggleRivers",
      "toggleRoutes",
      "toggleScaleBar",
      "toggleStates",
      "toggleVignette"
    ],
    cultural: [
      "toggleBorders",
      "toggleCultures",
      "toggleBurgIcons",
      "toggleLabels",
      "toggleRivers",
      "toggleRoutes",
      "toggleScaleBar",
      "toggleVignette"
    ],
    religions: [
      "toggleBorders",
      "toggleBurgIcons",
      "toggleLabels",
      "toggleReligions",
      "toggleRivers",
      "toggleRoutes",
      "toggleScaleBar",
      "toggleVignette"
    ],
    provinces: [
      "toggleBorders",
      "toggleBurgIcons",
      "toggleProvinces",
      "toggleRivers",
      "toggleScaleBar",
      "toggleVignette"
    ],
    biomes: ["toggleBiomes", "toggleIce", "toggleRivers", "toggleScaleBar", "toggleVignette"],
    heightmap: ["toggleHeight", "toggleRivers", "toggleVignette"],
    physical: ["toggleCoordinates", "toggleHeight", "toggleIce", "toggleRivers", "toggleScaleBar", "toggleVignette"],
    poi: [
      "toggleBorders",
      "toggleHeight",
      "toggleIce",
      "toggleBurgIcons",
      "toggleMarkers",
      "toggleRivers",
      "toggleRoutes",
      "toggleScaleBar",
      "toggleVignette"
    ],
    military: [
      "toggleBorders",
      "toggleBurgIcons",
      "toggleLabels",
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
  const preset = localStorage.getItem("preset") || byId("layersPreset").value;
  changeLayersPreset(preset);
}

// toggle layers on preset change
function changeLayersPreset(preset) {
  const layers = presets[preset]; // layers to be turned on
  layersPreset.value = preset;
  localStorage.setItem("preset", preset);
  const isDefault = getDefaultPresets()[preset];
  byId("removePresetButton").style.display = isDefault ? "none" : "inline-block";
  byId("savePresetButton").style.display = "none";

  document.querySelectorAll("#mapLayers > li").forEach(e => (e.className = layers.includes(e.id) ? null : "buttonoff"));
  drawLayers();
  if (byId("canvas3d")) setTimeout(() => ThreeD.update(), 400);
}

function savePreset() {
  prompt("Please provide a preset name", {default: ""}, preset => {
    presets[preset] = Array.from(byId("mapLayers").querySelectorAll("li:not(.buttonoff)"))
      .map(node => node.id)
      .sort();
    layersPreset.add(new Option(preset, preset, false, true));
    localStorage.setItem("presets", JSON.stringify(presets));
    localStorage.setItem("preset", preset);
    removePresetButton.style.display = "inline-block";
    savePresetButton.style.display = "none";
  });
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
}

function getCurrentPreset() {
  const layers = Array.from(byId("mapLayers").querySelectorAll("li:not(.buttonoff)"))
    .map(node => node.id)
    .sort();
  const defaultPresets = getDefaultPresets();

  for (const preset in presets) {
    if (JSON.stringify(presets[preset]) !== JSON.stringify(layers)) continue;
    layersPreset.value = preset;
    removePresetButton.style.display = defaultPresets[preset] ? "none" : "inline-block";
    savePresetButton.style.display = "none";
    return;
  }

  layersPreset.value = "custom";
  removePresetButton.style.display = "none";
  savePresetButton.style.display = "inline-block";
}

// run on each map generation
function drawLayers() {
  drawFeatures();
  if (layerIsOn("toggleTexture")) drawTexture();
  if (layerIsOn("toggleHeight")) drawHeightmap();
  if (layerIsOn("toggleBiomes")) drawBiomes();
  if (layerIsOn("toggleCells")) drawCells();
  if (layerIsOn("toggleGrid")) drawGrid();
  if (layerIsOn("toggleCoordinates")) drawCoordinates();
  if (layerIsOn("toggleCompass")) compass.style("display", "block");
  if (layerIsOn("toggleRivers")) drawRivers();
  if (layerIsOn("toggleRelief")) ReliefIcons.draw();
  if (layerIsOn("toggleReligions")) drawReligions();
  if (layerIsOn("toggleCultures")) drawCultures();
  if (layerIsOn("toggleStates")) drawStates();
  if (layerIsOn("toggleProvinces")) drawProvinces();
  if (layerIsOn("toggleZones")) drawZones();
  if (layerIsOn("toggleBorders")) drawBorders();
  if (layerIsOn("toggleRoutes")) drawRoutes();
  if (layerIsOn("toggleTemperature")) drawTemperature();
  if (layerIsOn("togglePopulation")) drawPopulation();
  if (layerIsOn("toggleIce")) drawIce();
  if (layerIsOn("togglePrecipitation")) drawPrecipitation();
  if (layerIsOn("toggleEmblems")) drawEmblems();
  if (layerIsOn("toggleLabels")) drawLabels();
  if (layerIsOn("toggleBurgIcons")) drawBurgIcons();
  if (layerIsOn("toggleMilitary")) drawMilitary();
  if (layerIsOn("toggleMarkers")) drawMarkers();
  if (layerIsOn("toggleRulers")) rulers.draw();
  // scale bar
  // vignette
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

function drawBiomes() {
  TIME && console.time("drawBiomes");

  const cells = pack.cells;
  const bodyPaths = new Array(biomesData.i.length - 1);
  const isolines = getIsolines(pack, cellId => cells.biome[cellId], {fill: true, waterGap: true});
  Object.entries(isolines).forEach(([index, {fill, waterGap}]) => {
    const color = biomesData.color[index];
    bodyPaths.push(getGappedFillPaths("biome", fill, waterGap, color, index));
  });

  byId("biomes").innerHTML = bodyPaths.join("");

  TIME && console.timeEnd("drawBiomes");
}

function togglePrecipitation(event) {
  if (!prec.selectAll("circle").size()) {
    turnButtonOn("togglePrecipitation");
    drawPrecipitation();
    if (event && isCtrlClick(event)) editStyle("prec");
  } else {
    if (event && isCtrlClick(event)) return editStyle("prec");
    turnButtonOff("togglePrecipitation");
    const hide = d3.transition().duration(1000).ease(d3.easeSinIn);
    prec.selectAll("text").attr("opacity", 1).transition(hide).attr("opacity", 0);
    prec.selectAll("circle").transition(hide).attr("r", 0).remove();
    prec.transition().delay(1000).style("display", "none");
  }
}

function drawPrecipitation() {
  TIME && console.time("drawPrecipitation");

  prec.selectAll("circle").remove();
  const {cells, points} = grid;

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
  if (!population.selectAll("line").size()) {
    turnButtonOn("togglePopulation");
    drawPopulation();
    if (event && isCtrlClick(event)) editStyle("population");
  } else {
    if (event && isCtrlClick(event)) return editStyle("population");
    turnButtonOff("togglePopulation");

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
  population.selectAll("line").remove();

  const {cells, burgs} = pack;
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
  if (!cells.selectAll("path").size()) {
    turnButtonOn("toggleCells");
    drawCells();
    if (event && isCtrlClick(event)) editStyle("cells");
  } else {
    if (event && isCtrlClick(event)) return editStyle("cells");
    cells.selectAll("path").remove();
    turnButtonOff("toggleCells");
  }
}

function drawCells() {
  const cells = customization === 1 ? grid.cells.i : pack.cells.i;
  const polygon = customization === 1 ? getGridPolygon : getPackPolygon;
  const paths = Array.from(cells).map(i => "M" + polygon(i));
  byId("cells").innerHTML = `<path d="${paths.join("")}" />`;
}

function toggleIce(event) {
  if (!layerIsOn("toggleIce")) {
    turnButtonOn("toggleIce");
    $("#ice").fadeIn();
    if (!ice.selectAll("*").size()) drawIce();
    if (event && isCtrlClick(event)) editStyle("ice");
  } else {
    if (event && isCtrlClick(event)) return editStyle("ice");
    $("#ice").fadeOut();
    turnButtonOff("toggleIce");
  }
}

function drawIce() {
  TIME && console.time("drawIce");

  const {cells, features} = grid;
  const {temp, h} = cells;
  Math.random = aleaPRNG(seed);

  const ICEBERG_MAX_TEMP = 1;
  const ICE_SHIELD_MAX_TEMP = -8;

  // very cold: draw ice shields
  {
    const type = "iceShield";
    const getType = cellId => (temp[cellId] <= ICE_SHIELD_MAX_TEMP ? type : null);
    const isolines = getIsolines(grid, getType, {polygons: true});
    isolines[type]?.polygons?.forEach(points => {
      const clipped = clipPoly(points);
      ice.append("polygon").attr("points", clipped).attr("type", type);
    });
  }

  // mildly cold: draw icebergs
  for (const cellId of grid.cells.i) {
    const t = temp[cellId];
    if (t > ICEBERG_MAX_TEMP) continue; // too warm: no icebergs
    if (t <= ICE_SHIELD_MAX_TEMP) continue; // already drawn as ice shield
    if (h[cellId] >= 20) continue; // no icebergs on land
    if (features[cells.f[cellId]].type === "lake") continue; // no icebers on lakes

    const tNormalized = normalize(t, -8, 2);
    const randomFactor = t > -5 ? 0.4 + rand() * 1.2 : 1;
    if (P(tNormalized ** 0.5 * randomFactor)) continue; // cold: skip some cells

    let defaultSize = 1 - tNormalized; // iceberg size: 0 = zero size, 1 = full size
    if (cells.t[cellId] === -1) defaultSize /= 1.3; // coasline: smaller icebergs
    const size = minmax(rn(defaultSize * randomFactor, 2), 0.08, 1);

    const [cx, cy] = grid.points[cellId];
    const points = getGridPolygon(cellId).map(([x, y]) => [rn(lerp(cx, x, size), 2), rn(lerp(cy, y, size), 2)]);
    ice.append("polygon").attr("points", points).attr("cell", cellId).attr("size", size);
  }

  TIME && console.timeEnd("drawIce");
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
  const {cells, cultures} = pack;

  const bodyPaths = new Array(cultures.length - 1);
  const isolines = getIsolines(pack, cellId => cells.culture[cellId], {fill: true, waterGap: true});
  Object.entries(isolines).forEach(([index, {fill, waterGap}]) => {
    const color = cultures[index].color;
    bodyPaths.push(getGappedFillPaths("culture", fill, waterGap, color, index));
  });

  byId("cults").innerHTML = bodyPaths.join("");

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
  const {cells, religions} = pack;

  const bodyPaths = new Array(religions.length - 1);
  const isolines = getIsolines(pack, cellId => cells.religion[cellId], {fill: true, waterGap: true});
  Object.entries(isolines).forEach(([index, {fill, waterGap}]) => {
    const color = religions[index].color;
    bodyPaths.push(getGappedFillPaths("religion", fill, waterGap, color, index));
  });

  byId("relig").innerHTML = bodyPaths.join("");

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
  const {cells, states} = pack;

  const maxLength = states.length - 1;
  const bodyPaths = new Array(maxLength);
  const clipPaths = new Array(maxLength);
  const haloPaths = new Array(maxLength);

  const renderHalo = shapeRendering.value === "geometricPrecision";
  const isolines = getIsolines(pack, cellId => cells.state[cellId], {fill: true, waterGap: true, halo: renderHalo});
  Object.entries(isolines).forEach(([index, {fill, waterGap, halo}]) => {
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

  byId("statesBody").innerHTML = bodyPaths.join("");
  byId("statePaths").innerHTML = renderHalo ? clipPaths.join("") : "";
  byId("statesHalo").innerHTML = renderHalo ? haloPaths.join("") : "";

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
  const {cells, provinces} = pack;

  const bodyPaths = new Array(provinces.length - 1);
  const isolines = getIsolines(pack, cellId => cells.province[cellId], {fill: true, waterGap: true});
  Object.entries(isolines).forEach(([index, {fill, waterGap}]) => {
    const color = provinces[index].color;
    bodyPaths.push(getGappedFillPaths("province", fill, waterGap, color, index));
  });

  const labels = provinces
    .filter(p => p.i && !p.removed)
    .map(p => {
      const [x, y] = p.pole || cells.p[p.center];
      return /* html */ `<text x="${x}" y="${y}" id="provinceLabel${p.i}">${p.name}</text>`;
    });

  byId("provs").innerHTML = /* html */ `
    <g id='provincesBody'>${bodyPaths.join("")}</g>
    <g id='provinceLabels'>${labels.join("")}</g>
  `;
  byId("provinceLabels").style.display = byId("provs").dataset.labels === "1" ? "block" : "none";

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
  const p = point.matrixTransform(byId("viewbox").getScreenCTM().inverse());

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

    return {x, y, text};
  });

  const path = round(d3.geoPath(projection)(graticule()));
  grid.append("path").attr("d", path).attr("vector-effect", "non-scaling-stroke");
  labels
    .selectAll("text")
    .data(data)
    .enter()
    .append("text")
    .attr("x", d => d.x)
    .attr("y", d => d.y)
    .text(d => d.text);
}

function toggleCompass(event) {
  if (!layerIsOn("toggleCompass")) {
    turnButtonOn("toggleCompass");
    $("#compass").fadeIn();
    if (event && isCtrlClick(event)) editStyle("compass");
  } else {
    if (event && isCtrlClick(event)) return editStyle("compass");
    $("#compass").fadeOut();
    turnButtonOff("toggleCompass");
  }
}

function toggleRelief(event) {
  if (!layerIsOn("toggleRelief")) {
    turnButtonOn("toggleRelief");
    if (!terrain.selectAll("*").size()) ReliefIcons.draw();
    $("#terrain").fadeIn();
    if (event && isCtrlClick(event)) editStyle("terrain");
  } else {
    if (event && isCtrlClick(event)) return editStyle("terrain");
    $("#terrain").fadeOut();
    turnButtonOff("toggleRelief");
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

  lineGen.curve(d3.curveCatmullRom.alpha(0.1));
  const riverPaths = pack.rivers.map(({cells, points, i, widthFactor, sourceWidth}) => {
    if (!cells || cells.length < 2) return;

    if (points && points.length !== cells.length) {
      console.error(
        `River ${i} has ${cells.length} cells, but only ${points.length} points defined.`,
        "Resetting points data"
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
    const {i, group, points} = route;
    if (!points || points.length < 2) continue;
    if (!routePaths[group]) routePaths[group] = [];
    routePaths[group].push(`<path id="route${i}" d="${Routes.getPath(route)}"/>`);
  }

  routes.selectAll("path").remove();
  for (const group in routePaths) {
    routes.select("#" + group).html(routePaths[group].join(""));
  }

  TIME && console.timeEnd("drawRoutes");
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
    markers.selectAll("*").remove();
    turnButtonOff("toggleMarkers");
  }
}

function toggleLabels(event) {
  if (!layerIsOn("toggleLabels")) {
    turnButtonOn("toggleLabels");
    $("#labels").fadeIn();
    // don't redraw labels as they are not stored in data yet
    if (labels.selectAll("text").size() === 0) drawLabels();
    if (event && isCtrlClick(event)) editStyle("labels");
  } else {
    if (event && isCtrlClick(event)) return editStyle("labels");
    turnButtonOff("toggleLabels");
    $("#labels").fadeOut();
  }
}

function drawLabels() {
  drawStateLabels();
  drawBurgLabels();
  invokeActiveZooming();
}

function toggleBurgIcons(event) {
  if (!layerIsOn("toggleBurgIcons")) {
    turnButtonOn("toggleBurgIcons");
    $("#icons").fadeIn();
    drawBurgIcons();
    if (event && isCtrlClick(event)) editStyle("burgIcons");
  } else {
    if (event && isCtrlClick(event)) return editStyle("burgIcons");
    turnButtonOff("toggleBurgIcons");
    icons.selectAll("circle, use").remove();
    $("#icons").fadeOut();
  }
}

function toggleRulers(event) {
  if (!layerIsOn("toggleRulers")) {
    turnButtonOn("toggleRulers");
    if (event && isCtrlClick(event)) editStyle("ruler");
    rulers.draw();
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
    $("#scaleBar").fadeIn();
    if (event && isCtrlClick(event)) editStyle("scaleBar");
  } else {
    if (event && isCtrlClick(event)) return editStyle("scaleBar");
    $("#scaleBar").fadeOut();
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
  const filterBy = byId("zonesFilterType").value;
  const isFiltered = filterBy && filterBy !== "all";
  const visibleZones = pack.zones.filter(
    ({hidden, cells, type}) => !hidden && cells.length && (!isFiltered || type === filterBy)
  );
  zones.html(visibleZones.map(drawZone).join(""));
}

function drawZone({i, cells, type, color}) {
  const path = getVertexPath(cells);
  return `<path id="zone${i}" data-id="${i}" data-type="${type}" d="${path}" fill="${color}" />`;
}

function toggleEmblems(event) {
  if (!layerIsOn("toggleEmblems")) {
    turnButtonOn("toggleEmblems");
    if (!emblems.selectAll("use").size()) drawEmblems();
    $("#emblems").fadeIn();
    if (event && isCtrlClick(event)) editStyle("emblems");
  } else {
    if (event && isCtrlClick(event)) return editStyle("emblems");
    $("#emblems").fadeOut();
    turnButtonOff("toggleEmblems");
  }
}

function toggleVignette(event) {
  if (!layerIsOn("toggleVignette")) {
    turnButtonOn("toggleVignette");
    $("#vignette").fadeIn();
    if (event && isCtrlClick(event)) editStyle("vignette");
  } else {
    if (event && isCtrlClick(event)) return editStyle("vignette");
    $("#vignette").fadeOut();
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
  return byId(el).classList.contains("buttonoff") ? false : true;
}

function turnButtonOff(el) {
  byId(el).classList.add("buttonoff");
  getCurrentPreset();
}

function turnButtonOn(el) {
  byId(el).classList.remove("buttonoff");
  getCurrentPreset();
}

// move layers on mapLayers dragging (jquery sortable)
$("#mapLayers").sortable({items: "li:not(.solid)", containment: "parent", cancel: ".solid", update: moveLayer});
function moveLayer(event, ui) {
  const el = getLayer(ui.item.attr("id"));
  if (!el) return;
  const prev = getLayer(ui.item.prev().attr("id"));
  const next = getLayer(ui.item.next().attr("id"));
  if (prev) el.insertAfter(prev);
  else if (next) el.insertBefore(next);
}

// define connection between option layer buttons and actual svg groups to move the element
function getLayer(id) {
  if (id === "toggleHeight") return $("#terrs");
  if (id === "toggleBiomes") return $("#biomes");
  if (id === "toggleCells") return $("#cells");
  if (id === "toggleGrid") return $("#gridOverlay");
  if (id === "toggleCoordinates") return $("#coordinates");
  if (id === "toggleCompass") return $("#compass");
  if (id === "toggleRivers") return $("#rivers");
  if (id === "toggleRelief") return $("#terrain");
  if (id === "toggleReligions") return $("#relig");
  if (id === "toggleCultures") return $("#cults");
  if (id === "toggleStates") return $("#regions");
  if (id === "toggleProvinces") return $("#provs");
  if (id === "toggleBorders") return $("#borders");
  if (id === "toggleRoutes") return $("#routes");
  if (id === "toggleTemperature") return $("#temperature");
  if (id === "togglePrecipitation") return $("#prec");
  if (id === "togglePopulation") return $("#population");
  if (id === "toggleIce") return $("#ice");
  if (id === "toggleTexture") return $("#texture");
  if (id === "toggleEmblems") return $("#emblems");
  if (id === "toggleLabels") return $("#labels");
  if (id === "toggleBurgIcons") return $("#icons");
  if (id === "toggleMarkers") return $("#markers");
  if (id === "toggleRulers") return $("#ruler");
}
