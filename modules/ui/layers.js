// UI module stub to control map layers
"use strict";

let presets = {}; // global object
restoreCustomPresets(); // run on-load

function getDefaultPresets() {
  return {
    political: [
      "toggleBorders",
      "toggleIcons",
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
      "toggleIcons",
      "toggleLabels",
      "toggleRivers",
      "toggleRoutes",
      "toggleScaleBar",
      "toggleVignette"
    ],
    religions: [
      "toggleBorders",
      "toggleIcons",
      "toggleLabels",
      "toggleReligions",
      "toggleRivers",
      "toggleRoutes",
      "toggleScaleBar",
      "toggleVignette"
    ],
    provinces: ["toggleBorders", "toggleIcons", "toggleProvinces", "toggleRivers", "toggleScaleBar", "toggleVignette"],
    biomes: ["toggleBiomes", "toggleIce", "toggleRivers", "toggleScaleBar", "toggleVignette"],
    heightmap: ["toggleHeight", "toggleRivers", "toggleVignette"],
    physical: ["toggleCoordinates", "toggleHeight", "toggleIce", "toggleRivers", "toggleScaleBar", "toggleVignette"],
    poi: [
      "toggleBorders",
      "toggleHeight",
      "toggleIce",
      "toggleIcons",
      "toggleMarkers",
      "toggleRivers",
      "toggleRoutes",
      "toggleScaleBar",
      "toggleVignette"
    ],
    military: [
      "toggleBorders",
      "toggleIcons",
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
      "toggleIcons",
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
function applyPreset() {
  const preset = localStorage.getItem("preset") || byId("layersPreset").value;
  changePreset(preset);
}

// toggle layers on preset change
function changePreset(preset) {
  const layers = presets[preset]; // layers to be turned on
  document
    .getElementById("mapLayers")
    .querySelectorAll("li")
    .forEach(function (e) {
      if (layers.includes(e.id) && !layerIsOn(e.id)) e.click();
      else if (!layers.includes(e.id) && layerIsOn(e.id)) e.click();
    });
  layersPreset.value = preset;
  localStorage.setItem("preset", preset);

  const isDefault = getDefaultPresets()[preset];
  removePresetButton.style.display = isDefault ? "none" : "inline-block";
  savePresetButton.style.display = "none";
  if (byId("canvas3d")) setTimeout(ThreeD.update(), 400);
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

// run on map regeneration
function restoreLayers() {
  if (layerIsOn("toggleTexture")) drawTexture();
  if (layerIsOn("toggleHeight")) drawHeightmap();
  if (layerIsOn("toggleCells")) drawCells();
  if (layerIsOn("toggleGrid")) drawGrid();
  if (layerIsOn("toggleCoordinates")) drawCoordinates();
  if (layerIsOn("toggleCompass")) compass.style("display", "block");
  if (layerIsOn("toggleRoutes")) drawRoutes();
  if (layerIsOn("toggleTemp")) drawTemp();
  if (layerIsOn("togglePrec")) drawPrec();
  if (layerIsOn("togglePopulation")) drawPopulation();
  if (layerIsOn("toggleBiomes")) drawBiomes();
  if (layerIsOn("toggleRelief")) ReliefIcons.draw();
  if (layerIsOn("toggleCultures")) drawCultures();
  if (layerIsOn("toggleProvinces")) drawProvinces();
  if (layerIsOn("toggleReligions")) drawReligions();
  if (layerIsOn("toggleIce")) drawIce();
  if (layerIsOn("toggleEmblems")) drawEmblems();
  if (layerIsOn("toggleMarkers")) drawMarkers();
  if (layerIsOn("toggleZones")) drawZones();
  if (layerIsOn("toggleBorders")) drawBorders();
  if (layerIsOn("toggleStates")) drawStates();

  // some layers are rendered each time, remove them if they are not on
  if (!layerIsOn("toggleRivers")) rivers.selectAll("*").remove();
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

function drawHeightmap() {
  TIME && console.time("drawHeightmap");

  const ocean = terrs.select("#oceanHeights");
  const land = terrs.select("#landHeights");

  ocean.selectAll("*").remove();
  land.selectAll("*").remove();

  const paths = new Array(101);

  // ocean cells
  const renderOceanCells = Boolean(+ocean.attr("data-render"));
  if (renderOceanCells) {
    const {cells, vertices} = grid;
    const used = new Uint8Array(cells.i.length);

    const skip = +ocean.attr("skip") + 1 || 1;
    const relax = +ocean.attr("relax") || 0;
    lineGen.curve(d3[ocean.attr("curve") || "curveBasisClosed"]);

    let currentLayer = 0;
    const heights = Array.from(cells.i).sort((a, b) => cells.h[a] - cells.h[b]);

    for (const i of heights) {
      const h = cells.h[i];
      if (h > currentLayer) currentLayer += skip;
      if (h < currentLayer) continue;
      if (currentLayer >= 20) break;
      if (used[i]) continue; // already marked
      const onborder = cells.c[i].some(n => cells.h[n] < h);
      if (!onborder) continue;
      const vertex = cells.v[i].find(v => vertices.c[v].some(i => cells.h[i] < h));
      const chain = connectVertices(cells, vertices, vertex, h, used);
      if (chain.length < 3) continue;
      const points = simplifyLine(chain, relax).map(v => vertices.p[v]);
      if (!paths[h]) paths[h] = "";
      paths[h] += round(lineGen(points));
    }
  }

  // land cells
  {
    const {cells, vertices} = pack;
    const used = new Uint8Array(cells.i.length);

    const skip = +land.attr("skip") + 1 || 1;
    const relax = +land.attr("relax") || 0;
    lineGen.curve(d3[land.attr("curve") || "curveBasisClosed"]);

    let currentLayer = 20;
    const heights = Array.from(cells.i).sort((a, b) => cells.h[a] - cells.h[b]);
    for (const i of heights) {
      const h = cells.h[i];
      if (h > currentLayer) currentLayer += skip;
      if (h < currentLayer) continue;
      if (currentLayer > 100) break; // no layers possible with height > 100
      if (used[i]) continue; // already marked
      const onborder = cells.c[i].some(n => cells.h[n] < h);
      if (!onborder) continue;
      const vertex = cells.v[i].find(v => vertices.c[v].some(i => cells.h[i] < h));
      const chain = connectVertices(cells, vertices, vertex, h, used);
      if (chain.length < 3) continue;
      const points = simplifyLine(chain, relax).map(v => vertices.p[v]);
      if (!paths[h]) paths[h] = "";
      paths[h] += round(lineGen(points));
    }
  }

  // render paths
  for (const height of d3.range(0, 101)) {
    const group = height < 20 ? ocean : land;
    const scheme = getColorScheme(group.attr("scheme"));

    if (height === 0 && renderOceanCells) {
      // draw base ocean layer
      group
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", graphWidth)
        .attr("height", graphHeight)
        .attr("fill", scheme(1));
    }

    if (height === 20) {
      // draw base land layer
      group
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", graphWidth)
        .attr("height", graphHeight)
        .attr("fill", scheme(0.8));
    }

    if (paths[height] && paths[height].length >= 10) {
      const terracing = group.attr("terracing") / 10 || 0;
      const color = getColor(height, scheme);

      if (terracing) {
        group
          .append("path")
          .attr("d", paths[height])
          .attr("transform", "translate(.7,1.4)")
          .attr("fill", d3.color(color).darker(terracing))
          .attr("data-height", height);
      }
      group.append("path").attr("d", paths[height]).attr("fill", color).attr("data-height", height);
    }
  }

  // connect vertices to chain
  function connectVertices(cells, vertices, start, h, used) {
    const n = cells.i.length;
    const chain = []; // vertices chain to form a path
    for (let i = 0, current = start; i === 0 || (current !== start && i < 20000); i++) {
      const prev = chain[chain.length - 1]; // previous vertex in chain
      chain.push(current); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter(c => cells.h[c] === h).forEach(c => (used[c] = 1));
      const c0 = c[0] >= n || cells.h[c[0]] < h;
      const c1 = c[1] >= n || cells.h[c[1]] < h;
      const c2 = c[2] >= n || cells.h[c[2]] < h;
      const v = vertices.v[current]; // neighboring vertices
      if (v[0] !== prev && c0 !== c1) current = v[0];
      else if (v[1] !== prev && c1 !== c2) current = v[1];
      else if (v[2] !== prev && c0 !== c2) current = v[2];
      if (current === chain[chain.length - 1]) {
        ERROR && console.error("Next vertex is not found");
        break;
      }
    }
    return chain;
  }

  function simplifyLine(chain, simplification) {
    if (!simplification) return chain;
    const n = simplification + 1; // filter each nth element
    return chain.filter((d, i) => i % n === 0);
  }

  TIME && console.timeEnd("drawHeightmap");
}

function getColor(value, scheme = getColorScheme("bright")) {
  return scheme(1 - (value < 20 ? value - 5 : value) / 100);
}

function toggleTemp(event) {
  if (!temperature.selectAll("*").size()) {
    turnButtonOn("toggleTemp");
    drawTemp();
    if (event && isCtrlClick(event)) editStyle("temperature");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("temperature");
      return;
    }
    turnButtonOff("toggleTemp");
    temperature.selectAll("*").remove();
  }
}

function drawTemp() {
  TIME && console.time("drawTemp");
  temperature.selectAll("*").remove();
  lineGen.curve(d3.curveBasisClosed);
  const scheme = d3.scaleSequential(d3.interpolateSpectral);
  const tMax = +temperatureEquatorOutput.max,
    tMin = +temperatureEquatorOutput.min,
    delta = tMax - tMin;

  const cells = grid.cells,
    vertices = grid.vertices,
    n = cells.i.length;
  const used = new Uint8Array(n); // to detect already passed cells
  const min = d3.min(cells.temp),
    max = d3.max(cells.temp);
  const step = Math.max(Math.round(Math.abs(min - max) / 5), 1);
  const isolines = d3.range(min + step, max, step);
  const chains = [],
    labels = []; // store label coordinates

  for (const i of cells.i) {
    const t = cells.temp[i];
    if (used[i] || !isolines.includes(t)) continue;
    const start = findStart(i, t);
    if (!start) continue;
    used[i] = 1;

    const chain = connectVertices(start, t); // vertices chain to form a path
    const relaxed = chain.filter((v, i) => i % 4 === 0 || vertices.c[v].some(c => c >= n));
    if (relaxed.length < 6) continue;
    const points = relaxed.map(v => vertices.p[v]);
    chains.push([t, points]);
    addLabel(points, t);
  }

  // min temp isoline covers all graph
  temperature
    .append("path")
    .attr("d", `M0,0 h${graphWidth} v${graphHeight} h${-graphWidth} Z`)
    .attr("fill", scheme(1 - (min - tMin) / delta))
    .attr("stroke", "none");

  for (const t of isolines) {
    const path = chains
      .filter(c => c[0] === t)
      .map(c => round(lineGen(c[1])))
      .join("");
    if (!path) continue;
    const fill = scheme(1 - (t - tMin) / delta),
      stroke = d3.color(fill).darker(0.2);
    temperature.append("path").attr("d", path).attr("fill", fill).attr("stroke", stroke);
  }

  const tempLabels = temperature.append("g").attr("id", "tempLabels").attr("fill-opacity", 1);
  tempLabels
    .selectAll("text")
    .data(labels)
    .enter()
    .append("text")
    .attr("x", d => d[0])
    .attr("y", d => d[1])
    .text(d => convertTemperature(d[2]));

  // find cell with temp < isotherm and find vertex to start path detection
  function findStart(i, t) {
    if (cells.b[i]) return cells.v[i].find(v => vertices.c[v].some(c => c >= n)); // map border cell
    return cells.v[i][cells.c[i].findIndex(c => cells.temp[c] < t || !cells.temp[c])];
  }

  function addLabel(points, t) {
    const c = svgWidth / 2; // map center x coordinate
    // add label on isoline top center
    const tc = points[d3.scan(points, (a, b) => a[1] - b[1] + (Math.abs(a[0] - c) - Math.abs(b[0] - c)) / 2)];
    pushLabel(tc[0], tc[1], t);

    // add label on isoline bottom center
    if (points.length > 20) {
      const bc = points[d3.scan(points, (a, b) => b[1] - a[1] + (Math.abs(a[0] - c) - Math.abs(b[0] - c)) / 2)];
      const dist2 = (tc[1] - bc[1]) ** 2 + (tc[0] - bc[0]) ** 2; // square distance between this and top point
      if (dist2 > 100) pushLabel(bc[0], bc[1], t);
    }
  }

  function pushLabel(x, y, t) {
    if (x < 20 || x > svgWidth - 20) return;
    if (y < 20 || y > svgHeight - 20) return;
    labels.push([x, y, t]);
  }

  // connect vertices to chain
  function connectVertices(start, t) {
    const chain = []; // vertices chain to form a path
    for (let i = 0, current = start; i === 0 || (current !== start && i < 20000); i++) {
      const prev = chain[chain.length - 1]; // previous vertex in chain
      chain.push(current); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter(c => cells.temp[c] === t).forEach(c => (used[c] = 1));
      const c0 = c[0] >= n || cells.temp[c[0]] < t;
      const c1 = c[1] >= n || cells.temp[c[1]] < t;
      const c2 = c[2] >= n || cells.temp[c[2]] < t;
      const v = vertices.v[current]; // neighboring vertices
      if (v[0] !== prev && c0 !== c1) current = v[0];
      else if (v[1] !== prev && c1 !== c2) current = v[1];
      else if (v[2] !== prev && c0 !== c2) current = v[2];
      if (current === chain[chain.length - 1]) {
        ERROR && console.error("Next vertex is not found");
        break;
      }
    }
    chain.push(start);
    return chain;
  }
  TIME && console.timeEnd("drawTemp");
}

function toggleBiomes(event) {
  if (!biomes.selectAll("path").size()) {
    turnButtonOn("toggleBiomes");
    drawBiomes();
    if (event && isCtrlClick(event)) editStyle("biomes");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("biomes");
      return;
    }
    biomes.selectAll("path").remove();
    turnButtonOff("toggleBiomes");
  }
}

function drawBiomes() {
  biomes.selectAll("path").remove();
  const cells = pack.cells,
    vertices = pack.vertices,
    n = cells.i.length;
  const used = new Uint8Array(cells.i.length);
  const paths = new Array(biomesData.i.length).fill("");

  for (const i of cells.i) {
    if (!cells.biome[i]) continue; // no need to mark marine biome (liquid water)
    if (used[i]) continue; // already marked
    const b = cells.biome[i];
    const onborder = cells.c[i].some(n => cells.biome[n] !== b);
    if (!onborder) continue;
    const edgeVerticle = cells.v[i].find(v => vertices.c[v].some(i => cells.biome[i] !== b));
    const chain = connectVertices(edgeVerticle, b);
    if (chain.length < 3) continue;
    const points = clipPoly(
      chain.map(v => vertices.p[v]),
      1
    );
    paths[b] += "M" + points.join("L") + "Z";
  }

  paths.forEach(function (d, i) {
    if (d.length < 10) return;
    biomes
      .append("path")
      .attr("d", d)
      .attr("fill", biomesData.color[i])
      .attr("stroke", biomesData.color[i])
      .attr("id", "biome" + i);
  });

  // connect vertices to chain
  function connectVertices(start, b) {
    const chain = []; // vertices chain to form a path
    for (let i = 0, current = start; i === 0 || (current !== start && i < 20000); i++) {
      const prev = chain[chain.length - 1]; // previous vertex in chain
      chain.push(current); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter(c => cells.biome[c] === b).forEach(c => (used[c] = 1));
      const c0 = c[0] >= n || cells.biome[c[0]] !== b;
      const c1 = c[1] >= n || cells.biome[c[1]] !== b;
      const c2 = c[2] >= n || cells.biome[c[2]] !== b;
      const v = vertices.v[current]; // neighboring vertices
      if (v[0] !== prev && c0 !== c1) current = v[0];
      else if (v[1] !== prev && c1 !== c2) current = v[1];
      else if (v[2] !== prev && c0 !== c2) current = v[2];
      if (current === chain[chain.length - 1]) {
        ERROR && console.error("Next vertex is not found");
        break;
      }
    }
    return chain;
  }
}

function togglePrec(event) {
  if (!prec.selectAll("circle").size()) {
    turnButtonOn("togglePrec");
    drawPrec();
    if (event && isCtrlClick(event)) editStyle("prec");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("prec");
      return;
    }
    turnButtonOff("togglePrec");
    const hide = d3.transition().duration(1000).ease(d3.easeSinIn);
    prec.selectAll("text").attr("opacity", 1).transition(hide).attr("opacity", 0);
    prec.selectAll("circle").transition(hide).attr("r", 0).remove();
    prec.transition().delay(1000).style("display", "none");
  }
}

function drawPrec() {
  prec.selectAll("circle").remove();
  const {cells, points} = grid;

  prec.style("display", "block");
  const show = d3.transition().duration(800).ease(d3.easeSinIn);
  prec.selectAll("text").attr("opacity", 0).transition(show).attr("opacity", 1);

  const cellsNumberModifier = (pointsInput.dataset.cells / 10000) ** 0.25;
  const data = cells.i.filter(i => cells.h[i] >= 20 && cells.prec[i]);
  const getRadius = prec => rn(Math.sqrt(prec / 4) / cellsNumberModifier, 2);

  prec
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", d => points[d][0])
    .attr("cy", d => points[d][1])
    .attr("r", 0)
    .transition(show)
    .attr("r", d => getRadius(cells.prec[d]));
}

function togglePopulation(event) {
  if (!population.selectAll("line").size()) {
    turnButtonOn("togglePopulation");
    drawPopulation();
    if (event && isCtrlClick(event)) editStyle("population");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("population");
      return;
    }
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

function drawPopulation(event) {
  population.selectAll("line").remove();
  const cells = pack.cells,
    p = cells.p,
    burgs = pack.burgs;
  const show = d3.transition().duration(2000).ease(d3.easeSinIn);

  const rural = Array.from(
    cells.i.filter(i => cells.pop[i] > 0),
    i => [p[i][0], p[i][1], p[i][1] - cells.pop[i] / 8]
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

  const urban = burgs.filter(b => b.i && !b.removed).map(b => [b.x, b.y, b.y - (b.population / 8) * urbanization]);
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
    if (event && isCtrlClick(event)) {
      editStyle("cells");
      return;
    }
    cells.selectAll("path").remove();
    turnButtonOff("toggleCells");
  }
}

function drawCells() {
  cells.selectAll("path").remove();
  const data = customization === 1 ? grid.cells.i : pack.cells.i;
  const polygon = customization === 1 ? getGridPolygon : getPackPolygon;
  let path = "";
  data.forEach(i => (path += "M" + polygon(i)));
  cells.append("path").attr("d", path);
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
  if (!layerIsOn("toggleCoordinates")) return;
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

  const p = getViewPoint(scale + desired + 2, scale + desired / 2); // on border point on viexBox

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

  const d = round(d3.geoPath(projection)(graticule()));
  grid.append("path").attr("d", d).attr("vector-effect", "non-scaling-stroke");
  labels
    .selectAll("text")
    .data(data)
    .enter()
    .append("text")
    .attr("x", d => d.x)
    .attr("y", d => d.y)
    .text(d => d.text);
}

// convert svg point into viewBox point
function getViewPoint(x, y) {
  const point = new DOMPoint(x, y);
  return point.matrixTransform(byId("viewbox").getScreenCTM().inverse());
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

  const {addMeandering, getRiverPath} = Rivers;
  lineGen.curve(d3.curveCatmullRom.alpha(0.1));

  const riverPaths = pack.rivers.map(({cells, points, i, widthFactor, sourceWidth}) => {
    if (!cells || cells.length < 2) return;

    if (points && points.length !== cells.length) {
      console.error(
        `River ${i} has ${cells.length} cells, but only ${points.length} points defined. Resetting points data`
      );
      points = undefined;
    }

    const meanderedPoints = addMeandering(cells, points);
    const path = getRiverPath(meanderedPoints, widthFactor, sourceWidth);
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

function toggleMilitary() {
  if (!layerIsOn("toggleMilitary")) {
    turnButtonOn("toggleMilitary");
    $("#armies").fadeIn();
    if (event && isCtrlClick(event)) editStyle("armies");
  } else {
    if (event && isCtrlClick(event)) {
      editStyle("armies");
      return;
    }
    $("#armies").fadeOut();
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

function drawMarkers() {
  const rescale = +markers.attr("rescale");
  const pinned = +markers.attr("pinned");

  const markersData = pinned ? pack.markers.filter(({pinned}) => pinned) : pack.markers;
  const html = markersData.map(marker => drawMarker(marker, rescale));
  markers.html(html.join(""));
}

// prettier-ignore
const pinShapes = {
  bubble: (fill, stroke) => `<path d="M6,19 l9,10 L24,19" fill="${stroke}" stroke="none" /><circle cx="15" cy="15" r="10" fill="${fill}" stroke="${stroke}"/>`,
  pin: (fill, stroke) => `<path d="m 15,3 c -5.5,0 -9.7,4.09 -9.7,9.3 0,6.8 9.7,17 9.7,17 0,0 9.7,-10.2 9.7,-17 C 24.7,7.09 20.5,3 15,3 Z" fill="${fill}" stroke="${stroke}"/>`,
  square: (fill, stroke) => `<path d="m 20,25 -5,4 -5,-4 z" fill="${stroke}"/><path d="M 5,5 H 25 V 25 H 5 Z" fill="${fill}" stroke="${stroke}"/>`,
  squarish: (fill, stroke) => `<path d="m 5,5 h 20 v 20 h -6 l -4,4 -4,-4 H 5 Z" fill="${fill}" stroke="${stroke}" />`,
  diamond: (fill, stroke) => `<path d="M 2,15 15,1 28,15 15,29 Z" fill="${fill}" stroke="${stroke}" />`,
  hex: (fill, stroke) => `<path d="M 15,29 4.61,21 V 9 L 15,3 25.4,9 v 12 z" fill="${fill}" stroke="${stroke}" />`,
  hexy: (fill, stroke) => `<path d="M 15,29 6,21 5,8 15,4 25,8 24,21 Z" fill="${fill}" stroke="${stroke}" />`,
  shieldy: (fill, stroke) => `<path d="M 15,29 6,21 5,7 c 0,0 5,-3 10,-3 5,0 10,3 10,3 l -1,14 z" fill="${fill}" stroke="${stroke}" />`,
  shield: (fill, stroke) => `<path d="M 4.6,5.2 H 25 v 6.7 A 20.3,20.4 0 0 1 15,29 20.3,20.4 0 0 1 4.6,11.9 Z" fill="${fill}" stroke="${stroke}" />`,
  pentagon: (fill, stroke) => `<path d="M 4,16 9,4 h 12 l 5,12 -11,13 z" fill="${fill}" stroke="${stroke}" />`,
  heptagon: (fill, stroke) => `<path d="M 15,29 6,22 4,12 10,4 h 10 l 6,8 -2,10 z" fill="${fill}" stroke="${stroke}" />`,
  circle: (fill, stroke) => `<circle cx="15" cy="15" r="11" fill="${fill}" stroke="${stroke}" />`,
  no: () => ""
};

const getPin = (shape = "bubble", fill = "#fff", stroke = "#000") => {
  const shapeFunction = pinShapes[shape] || pinShapes.bubble;
  return shapeFunction(fill, stroke);
};

function drawMarker(marker, rescale = 1) {
  const {i, icon, x, y, dx = 50, dy = 50, px = 12, size = 30, pin, fill, stroke} = marker;
  const id = `marker${i}`;
  const zoomSize = rescale ? Math.max(rn(size / 5 + 24 / scale, 2), 1) : size;
  const viewX = rn(x - zoomSize / 2, 1);
  const viewY = rn(y - zoomSize, 1);
  const pinHTML = getPin(pin, fill, stroke);

  return `<svg id="${id}" viewbox="0 0 30 30" width="${zoomSize}" height="${zoomSize}" x="${viewX}" y="${viewY}"><g>${pinHTML}</g><text x="${dx}%" y="${dy}%" font-size="${px}px" >${icon}</text></svg>`;
}

function toggleLabels(event) {
  if (!layerIsOn("toggleLabels")) {
    turnButtonOn("toggleLabels");
    labels.style("display", null);
    invokeActiveZooming();
    if (event && isCtrlClick(event)) editStyle("labels");
  } else {
    if (event && isCtrlClick(event)) return editStyle("labels");
    turnButtonOff("toggleLabels");
    labels.style("display", "none");
  }
}

function toggleIcons(event) {
  if (!layerIsOn("toggleIcons")) {
    turnButtonOn("toggleIcons");
    $("#icons").fadeIn();
    if (event && isCtrlClick(event)) editStyle("burgIcons");
  } else {
    if (event && isCtrlClick(event)) return editStyle("burgIcons");
    turnButtonOff("toggleIcons");
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

function drawScaleBar(scaleBar, scaleLevel) {
  if (!scaleBar.size() || scaleBar.style("display") === "none") return;

  const unit = distanceUnitInput.value;
  const size = +scaleBar.attr("data-bar-size");

  const length = (function () {
    const init = 100;
    let val = (init * size * distanceScale) / scaleLevel; // bar length in distance unit
    if (val > 900) val = rn(val, -3); // round to 1000
    else if (val > 90) val = rn(val, -2); // round to 100
    else if (val > 9) val = rn(val, -1); // round to 10
    else val = rn(val); // round to 1
    const length = (val * scaleLevel) / distanceScale; // actual length in pixels on this scale
    return length;
  })();

  scaleBar.select("#scaleBarContent").remove(); // redraw content every time
  const content = scaleBar.append("g").attr("id", "scaleBarContent");

  const lines = content.append("g");
  lines
    .append("line")
    .attr("x1", 0.5)
    .attr("y1", 0)
    .attr("x2", length + size - 0.5)
    .attr("y2", 0)
    .attr("stroke-width", size)
    .attr("stroke", "white");
  lines
    .append("line")
    .attr("x1", 0)
    .attr("y1", size)
    .attr("x2", length + size)
    .attr("y2", size)
    .attr("stroke-width", size)
    .attr("stroke", "#3d3d3d");
  lines
    .append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", length + size)
    .attr("y2", 0)
    .attr("stroke-width", rn(size * 3, 2))
    .attr("stroke-dasharray", size + " " + rn(length / 5 - size, 2))
    .attr("stroke", "#3d3d3d");

  const texts = content.append("g").attr("text-anchor", "middle").attr("font-family", "var(--serif)");
  texts
    .selectAll("text")
    .data(d3.range(0, 6))
    .enter()
    .append("text")
    .attr("x", d => rn((d * length) / 5, 2))
    .attr("y", 0)
    .attr("dy", "-.6em")
    .text(d => rn((((d * length) / 5) * distanceScale) / scaleLevel) + (d < 5 ? "" : " " + unit));

  const label = scaleBar.attr("data-label");
  if (label) {
    texts
      .append("text")
      .attr("x", (length + 1) / 2)
      .attr("dy", ".6em")
      .attr("dominant-baseline", "text-before-edge")
      .text(label);
  }

  const scaleBarBack = scaleBar.select("#scaleBarBack");
  if (scaleBarBack.size()) {
    const bbox = content.node().getBBox();
    const paddingTop = +scaleBarBack.attr("data-top") || 0;
    const paddingLeft = +scaleBarBack.attr("data-left") || 0;
    const paddingRight = +scaleBarBack.attr("data-right") || 0;
    const paddingBottom = +scaleBarBack.attr("data-bottom") || 0;

    scaleBar
      .select("#scaleBarBack")
      .attr("x", -paddingLeft)
      .attr("y", -paddingTop)
      .attr("width", bbox.width + paddingRight)
      .attr("height", bbox.height + paddingBottom);
  }
}

// fit ScaleBar to screen size
function fitScaleBar(scaleBar, fullWidth, fullHeight) {
  if (!scaleBar.select("rect").size() || scaleBar.style("display") === "none") return;

  const posX = +scaleBar.attr("data-x") || 99;
  const posY = +scaleBar.attr("data-y") || 99;
  const bbox = scaleBar.select("rect").node().getBBox();

  const x = rn((fullWidth * posX) / 100 - bbox.width + 10);
  const y = rn((fullHeight * posY) / 100 - bbox.height + 20);
  scaleBar.attr("transform", `translate(${x},${y})`);
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

function drawEmblems() {
  TIME && console.time("drawEmblems");
  const {states, provinces, burgs} = pack;

  const validStates = states.filter(s => s.i && !s.removed && s.coa && s.coa.size !== 0);
  const validProvinces = provinces.filter(p => p.i && !p.removed && p.coa && p.coa.size !== 0);
  const validBurgs = burgs.filter(b => b.i && !b.removed && b.coa && b.coa.size !== 0);

  const getStateEmblemsSize = () => {
    const startSize = minmax((graphHeight + graphWidth) / 40, 10, 100);
    const statesMod = 1 + validStates.length / 100 - (15 - validStates.length) / 200; // states number modifier
    const sizeMod = +emblems.select("#stateEmblems").attr("data-size") || 1;
    return rn((startSize / statesMod) * sizeMod); // target size ~50px on 1536x754 map with 15 states
  };

  const getProvinceEmblemsSize = () => {
    const startSize = minmax((graphHeight + graphWidth) / 100, 5, 70);
    const provincesMod = 1 + validProvinces.length / 1000 - (115 - validProvinces.length) / 1000; // states number modifier
    const sizeMod = +emblems.select("#provinceEmblems").attr("data-size") || 1;
    return rn((startSize / provincesMod) * sizeMod); // target size ~20px on 1536x754 map with 115 provinces
  };

  const getBurgEmblemSize = () => {
    const startSize = minmax((graphHeight + graphWidth) / 185, 2, 50);
    const burgsMod = 1 + validBurgs.length / 1000 - (450 - validBurgs.length) / 1000; // states number modifier
    const sizeMod = +emblems.select("#burgEmblems").attr("data-size") || 1;
    return rn((startSize / burgsMod) * sizeMod); // target size ~8.5px on 1536x754 map with 450 burgs
  };

  const sizeBurgs = getBurgEmblemSize();
  const burgCOAs = validBurgs.map(burg => {
    const {x, y} = burg;
    const size = burg.coa.size || 1;
    const shift = (sizeBurgs * size) / 2;
    return {type: "burg", i: burg.i, x: burg.coa.x || x, y: burg.coa.y || y, size, shift};
  });

  const sizeProvinces = getProvinceEmblemsSize();
  const provinceCOAs = validProvinces.map(province => {
    const [x, y] = province.pole || pack.cells.p[province.center];
    const size = province.coa.size || 1;
    const shift = (sizeProvinces * size) / 2;
    return {type: "province", i: province.i, x: province.coa.x || x, y: province.coa.y || y, size, shift};
  });

  const sizeStates = getStateEmblemsSize();
  const stateCOAs = validStates.map(state => {
    const [x, y] = state.pole || pack.cells.p[state.center];
    const size = state.coa.size || 1;
    const shift = (sizeStates * size) / 2;
    return {type: "state", i: state.i, x: state.coa.x || x, y: state.coa.y || y, size, shift};
  });

  const nodes = burgCOAs.concat(provinceCOAs).concat(stateCOAs);
  const simulation = d3
    .forceSimulation(nodes)
    .alphaMin(0.6)
    .alphaDecay(0.2)
    .velocityDecay(0.6)
    .force(
      "collision",
      d3.forceCollide().radius(d => d.shift)
    )
    .stop();

  d3.timeout(function () {
    const n = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
    for (let i = 0; i < n; ++i) {
      simulation.tick();
    }

    const burgNodes = nodes.filter(node => node.type === "burg");
    const burgString = burgNodes
      .map(
        d =>
          `<use data-i="${d.i}" x="${rn(d.x - d.shift)}" y="${rn(d.y - d.shift)}" width="${d.size}em" height="${
            d.size
          }em"/>`
      )
      .join("");
    emblems.select("#burgEmblems").attr("font-size", sizeBurgs).html(burgString);

    const provinceNodes = nodes.filter(node => node.type === "province");
    const provinceString = provinceNodes
      .map(
        d =>
          `<use data-i="${d.i}" x="${rn(d.x - d.shift)}" y="${rn(d.y - d.shift)}" width="${d.size}em" height="${
            d.size
          }em"/>`
      )
      .join("");
    emblems.select("#provinceEmblems").attr("font-size", sizeProvinces).html(provinceString);

    const stateNodes = nodes.filter(node => node.type === "state");
    const stateString = stateNodes
      .map(
        d =>
          `<use data-i="${d.i}" x="${rn(d.x - d.shift)}" y="${rn(d.y - d.shift)}" width="${d.size}em" height="${
            d.size
          }em"/>`
      )
      .join("");
    emblems.select("#stateEmblems").attr("font-size", sizeStates).html(stateString);

    invokeActiveZooming();
  });

  TIME && console.timeEnd("drawEmblems");
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
  return /* html */ `
    <path d="${fill}" fill="${color}" id="${elementName}${index}" />
    <path d="${waterGap}" fill="none" stroke="${color}" stroke-width="3" id="${elementName}-gap${index}" />
  `;
}

function layerIsOn(el) {
  const buttonoff = byId(el).classList.contains("buttonoff");
  return !buttonoff;
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
  if (id === "toggleTemp") return $("#temperature");
  if (id === "togglePrec") return $("#prec");
  if (id === "togglePopulation") return $("#population");
  if (id === "toggleIce") return $("#ice");
  if (id === "toggleTexture") return $("#texture");
  if (id === "toggleEmblems") return $("#emblems");
  if (id === "toggleLabels") return $("#labels");
  if (id === "toggleIcons") return $("#icons");
  if (id === "toggleMarkers") return $("#markers");
  if (id === "toggleRulers") return $("#ruler");
}
