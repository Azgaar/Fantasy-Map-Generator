// UI module stub to control map layers
"use strict";

// on map regeneration restore layers if they was turned on 
function restoreLayers() {
  if (layerIsOn("toggleHeight")) drawHeightmap();
  if (layerIsOn("toggleCells")) drawCells();
  if (layerIsOn("toggleGrid")) drawGrid();
  if (layerIsOn("toggleCoordinates")) drawCoordinates();
  if (layerIsOn("toggleCompass")) compass.attr("display", "block");
  if (layerIsOn("toggleTemp")) drawTemp();
  if (layerIsOn("togglePrec")) drawPrec();
  if (layerIsOn("togglePopulation")) drawPopulation();
  if (layerIsOn("toggleBiomes")) drawBiomes();
  if (layerIsOn("toggleRelief")) ReliefIcons();
  if (layerIsOn("toggleCultures")) drawCultures();
  if (layerIsOn("toggleProvinces")) drawProvinces();
  if (layerIsOn("toggleReligions")) drawReligions();

  // states are getting rendered each time, if it's not required than layers should be hidden
  if (!layerIsOn("toggleBorders")) $('#borders').fadeOut();
  if (!layerIsOn("toggleStates")) regions.attr("display", "none").selectAll("path").remove();
}

restoreLayers(); // run on-load
let presets = {}; // global object
restoreCustomPresets(); // run on-load

function getDefaultPresets() {
  return {
    "political": ["toggleBorders", "toggleIcons", "toggleLabels", "toggleRivers", "toggleRoutes", "toggleScaleBar", "toggleStates"],
    "cultural": ["toggleBorders", "toggleCultures", "toggleIcons", "toggleLabels", "toggleRivers", "toggleRoutes", "toggleScaleBar"],
    "religions": ["toggleBorders", "toggleIcons", "toggleLabels", "toggleReligions", "toggleRivers", "toggleRoutes", "toggleScaleBar"],
    "provinces": ["toggleBorders", "toggleIcons", "toggleProvinces", "toggleRivers", "toggleScaleBar"],
    "biomes": ["toggleBiomes", "toggleRivers", "toggleScaleBar"],
    "heightmap": ["toggleHeight", "toggleRivers", "toggleScaleBar"],
    "poi": ["toggleBorders", "toggleHeight", "toggleIcons", "toggleMarkers", "toggleRivers", "toggleRoutes", "toggleScaleBar"],
    "landmass": ["toggleScaleBar"]
  }
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

function applyPreset() {
  const selected = localStorage.getItem("preset");
  if (selected) changePreset(selected);
}

// toggle layers on preset change
function changePreset(preset) {
  const layers = presets[preset]; // layers to be turned on
  document.getElementById("mapLayers").querySelectorAll("li").forEach(function(e) {
    if (layers.includes(e.id) && !layerIsOn(e.id)) e.click(); // turn on
    else if (!layers.includes(e.id) && layerIsOn(e.id)) e.click(); // turn off
  });
  layersPreset.value = preset;
  localStorage.setItem("preset", preset);

  const isDefault = getDefaultPresets()[preset];
  removePresetButton.style.display = isDefault ? "none" : "inline-block";
  savePresetButton.style.display = "none";
}

function savePreset() {
  const preset = prompt("Please provide a preset name"); // preset name
  if (!preset) return;
  presets[preset] = Array.from(document.getElementById("mapLayers").querySelectorAll("li:not(.buttonoff)")).map(node => node.id).sort();
  layersPreset.add(new Option(preset, preset, false, true));
  localStorage.setItem("presets", JSON.stringify(presets));
  localStorage.setItem("preset", preset);
  removePresetButton.style.display = "inline-block";
  savePresetButton.style.display = "none";
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
  const layers = Array.from(document.getElementById("mapLayers").querySelectorAll("li:not(.buttonoff)")).map(node => node.id).sort();
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

function toggleHeight() {
  if (!terrs.selectAll("*").size()) {
    turnButtonOn("toggleHeight");
    drawHeightmap();
  } else {
    if (customization === 1) {tip("You cannot turn off the layer when heightmap is in edit mode", false, "error"); return;}
    turnButtonOff("toggleHeight");
    terrs.selectAll("*").remove();
  }
}

function drawHeightmap() {
  console.time("drawHeightmap");
  terrs.selectAll("*").remove();
  const cells = pack.cells, vertices = pack.vertices, n = cells.i.length;
  const used = new Uint8Array(cells.i.length);
  const paths = new Array(101).fill("");

  const scheme = getColorScheme();
  const terracing = +styleHeightmapTerracingInput.value / 10; // add additional shifted darker layer for pseudo-3d effect
  const skip = +styleHeightmapSkipOutput.value + 1;
  const simplification = +styleHeightmapSimplificationInput.value;
  switch (+styleHeightmapCurveInput.value) {
    case 0: lineGen.curve(d3.curveBasisClosed); break;
    case 1: lineGen.curve(d3.curveLinear); break;
    case 2: lineGen.curve(d3.curveStep); break;
    default: lineGen.curve(d3.curveBasisClosed);
  }

  let currentLayer = 20;
  const heights = cells.i.sort((a, b) => cells.h[a] - cells.h[b]); 
  for (const i of heights) {
    const h = cells.h[i];
    if (h > currentLayer) currentLayer += skip;
    if (currentLayer > 100) break; // no layers possible with height > 100
    if (h < currentLayer) continue;
    if (used[i]) continue; // already marked
    const onborder = cells.c[i].some(n => cells.h[n] < h);
    if (!onborder) continue;
    const vertex = cells.v[i].find(v => vertices.c[v].some(i => cells.h[i] < h));
    const chain = connectVertices(vertex, h);
    if (chain.length < 3) continue;
    const points = simplifyLine(chain).map(v => vertices.p[v]);
    paths[h] += round(lineGen(points));
  }

  terrs.append("rect").attr("x", 0).attr("y", 0).attr("width", "100%").attr("height", "100%").attr("fill", scheme(.8)); // draw base layer
  for (const i of d3.range(20, 101)) {
    if (paths[i].length < 10) continue;
    const color = getColor(i, scheme);
    if (terracing) terrs.append("path").attr("d", paths[i]).attr("transform", "translate(.7,1.4)").attr("fill", d3.color(color).darker(terracing)).attr("data-height", i);
    terrs.append("path").attr("d", paths[i]).attr("fill", color).attr("data-height", i);
  }

  // connect vertices to chain
  function connectVertices(start, h) {
    const chain = []; // vertices chain to form a path
    for (let i=0, current = start; i === 0 || current !== start && i < 20000; i++) {
      const prev = chain[chain.length - 1]; // previous vertex in chain
      chain.push(current); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter(c => cells.h[c] === h).forEach(c => used[c] = 1);
      const c0 = c[0] >= n || cells.h[c[0]] < h;
      const c1 = c[1] >= n || cells.h[c[1]] < h;
      const c2 = c[2] >= n || cells.h[c[2]] < h;
      const v = vertices.v[current]; // neighboring vertices
      if (v[0] !== prev && c0 !== c1) current = v[0];
      else if (v[1] !== prev && c1 !== c2) current = v[1];
      else if (v[2] !== prev && c0 !== c2) current = v[2];
      if (current === chain[chain.length - 1]) {console.error("Next vertex is not found"); break;}
    }
    return chain;
  }

  function simplifyLine(chain) {
    if (!simplification) return chain;
    const n = simplification + 1; // filter each nth element
    return chain.filter((d, i) => i % n === 0);
  }
  
  console.timeEnd("drawHeightmap");
}

function getColorScheme() {
  const scheme = styleHeightmapSchemeInput.value;
  if (scheme === "bright") return d3.scaleSequential(d3.interpolateSpectral);
  if (scheme === "light") return d3.scaleSequential(d3.interpolateRdYlGn);
  if (scheme === "green") return d3.scaleSequential(d3.interpolateGreens);
  if (scheme === "monochrome") return d3.scaleSequential(d3.interpolateGreys);
}

function getColor(value, scheme = getColorScheme()) {
  return scheme(1 - (value < 20 ? value - 5 : value) / 100);
}

function toggleTemp() {
  if (!temperature.selectAll("*").size()) {
    turnButtonOn("toggleTemp");
    drawTemp();
  } else {
    turnButtonOff("toggleTemp");
    temperature.selectAll("*").remove();
  }
}

function drawTemp() {
  console.time("drawTemp");
  temperature.selectAll("*").remove();
  lineGen.curve(d3.curveBasisClosed);
  const scheme = d3.scaleSequential(d3.interpolateSpectral);
  const tMax = +temperatureEquatorOutput.max, tMin = +temperatureEquatorOutput.min, delta = tMax - tMin;

  const cells = grid.cells, vertices = grid.vertices, n = cells.i.length;
  const used = new Uint8Array(n); // to detect already passed cells
  const min = d3.min(cells.temp), max = d3.max(cells.temp);
  const step = Math.max(Math.round(Math.abs(min - max) / 5), 1);
  const isolines = d3.range(min+step, max, step); 
  const chains = [], labels = []; // store label coordinates

  for (const i of cells.i) {
    const t = cells.temp[i];
    if (used[i] || !isolines.includes(t)) continue;
    const start = findStart(i, t);
    if (!start) continue;
    used[i] = 1;
    //debug.append("circle").attr("r", 3).attr("cx", vertices.p[start][0]).attr("cy", vertices.p[start][1]).attr("fill", "red").attr("stroke", "black").attr("stroke-width", .3);

    const chain = connectVertices(start, t); // vertices chain to form a path
    const relaxed = chain.filter((v, i) => i%4 === 0 || vertices.c[v].some(c => c >= n));
    if (relaxed.length < 6) continue;
    const points = relaxed.map(v => vertices.p[v]);
    chains.push([t, points]);
    addLabel(points, t);
  }

  // min temp isoline covers all map
  temperature.append("path").attr("d", `M0,0 h${svgWidth} v${svgHeight} h${-svgWidth} Z`).attr("fill", scheme(1 - (min - tMin) / delta)).attr("stroke", "none");

  for (const t of isolines) {
    const path = chains.filter(c => c[0] === t).map(c => round(lineGen(c[1]))).join();
    if (!path) continue;
    const fill = scheme(1 - (t - tMin) / delta), stroke = d3.color(fill).darker(.2);
    temperature.append("path").attr("d", path).attr("fill", fill).attr("stroke", stroke);
  }

  const tempLabels = temperature.append("g").attr("id", "tempLabels").attr("fill-opacity", 1);
  tempLabels.selectAll("text").data(labels).enter().append("text").attr("x", d => d[0]).attr("y", d => d[1]).text(d => convertTemperature(d[2]));

  // find cell with temp < isotherm and find vertex to start path detection
  function findStart(i, t) {
    if (cells.b[i]) return cells.v[i].find(v => vertices.c[v].some(c => c >= n)); // map border cell
    return cells.v[i][cells.c[i].findIndex(c => cells.temp[c] < t || !cells.temp[c])];
  }

  function addLabel(points, t) {
    const c = svgWidth / 2; // map center x coordinate
    // add label on isoline top center
    const tc = points[d3.scan(points, (a, b) => (a[1] - b[1]) + (Math.abs(a[0] - c) - Math.abs(b[0] - c)) / 2)];
    pushLabel(tc[0], tc[1], t);

    // add label on isoline bottom center
    if (points.length > 20) {
      const bc = points[d3.scan(points, (a, b) => (b[1] - a[1]) + (Math.abs(a[0] - c) - Math.abs(b[0] - c)) / 2)];
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
    for (let i=0, current = start; i === 0 || current !== start && i < 20000; i++) {
      const prev = chain[chain.length - 1]; // previous vertex in chain
      chain.push(current); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter(c => cells.temp[c] === t).forEach(c => used[c] = 1);
      const c0 = c[0] >= n || cells.temp[c[0]] < t;
      const c1 = c[1] >= n || cells.temp[c[1]] < t;
      const c2 = c[2] >= n || cells.temp[c[2]] < t;
      const v = vertices.v[current]; // neighboring vertices
      if (v[0] !== prev && c0 !== c1) current = v[0];
      else if (v[1] !== prev && c1 !== c2) current = v[1];
      else if (v[2] !== prev && c0 !== c2) current = v[2];
      if (current === chain[chain.length - 1]) {console.error("Next vertex is not found"); break;}
    }
    chain.push(start);
    return chain;
  }
  console.timeEnd("drawTemp");
}

function toggleBiomes() {
  if (!biomes.selectAll("path").size()) {
    turnButtonOn("toggleBiomes");
    drawBiomes();
  } else {
    biomes.selectAll("path").remove();
    turnButtonOff("toggleBiomes");
  }
}

function drawBiomes() {
  biomes.selectAll("path").remove();
  const cells = pack.cells, vertices = pack.vertices, n = cells.i.length;
  const used = new Uint8Array(cells.i.length);
  const paths = new Array(biomesData.i.length).fill("");
  
  for (const i of cells.i) {
    if (!cells.biome[i]) continue; // no need to mark water
    if (used[i]) continue; // already marked
    const b = cells.biome[i];
    const onborder = cells.c[i].some(n => cells.biome[n] !== b);
    if (!onborder) continue;
    const edgeVerticle = cells.v[i].find(v => vertices.c[v].some(i => cells.biome[i] !== b));
    const chain = connectVertices(edgeVerticle, b);
    if (chain.length < 3) continue;
    const points = chain.map(v => vertices.p[v]);
    paths[b] += "M" + points.join("L") + "Z";
  }

  paths.forEach(function(d, i) {
    if (d.length < 10) return;
    biomes.append("path").attr("d", d).attr("fill", biomesData.color[i]).attr("stroke", biomesData.color[i]).attr("id", "biome"+i);
  });

  // connect vertices to chain
  function connectVertices(start, b) {
    const chain = []; // vertices chain to form a path
    for (let i=0, current = start; i === 0 || current !== start && i < 20000; i++) {
      const prev = chain[chain.length - 1]; // previous vertex in chain
      chain.push(current); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter(c => cells.biome[c] === b).forEach(c => used[c] = 1);
      const c0 = c[0] >= n || cells.biome[c[0]] !== b;
      const c1 = c[1] >= n || cells.biome[c[1]] !== b;
      const c2 = c[2] >= n || cells.biome[c[2]] !== b;
      const v = vertices.v[current]; // neighboring vertices
      if (v[0] !== prev && c0 !== c1) current = v[0];
      else if (v[1] !== prev && c1 !== c2) current = v[1];
      else if (v[2] !== prev && c0 !== c2) current = v[2];
      if (current === chain[chain.length - 1]) {console.error("Next vertex is not found"); break;}
    }
    return chain;
  }
}

function togglePrec() {
  if (!prec.selectAll("circle").size()) {
    turnButtonOn("togglePrec");
    drawPrec();
  } else {
    turnButtonOff("togglePrec");
    const hide = d3.transition().duration(1000).ease(d3.easeSinIn);
    prec.selectAll("text").attr("opacity", 1).transition(hide).attr("opacity", 0);
    prec.selectAll("circle").transition(hide).attr("r", 0).remove();
    prec.transition().delay(1000).attr("display", "none");
  }
}

function drawPrec() {
  prec.selectAll("circle").remove();
  const cells = grid.cells, p = grid.points;
  prec.attr("display", "block");
  const show = d3.transition().duration(800).ease(d3.easeSinIn);
  prec.selectAll("text").attr("opacity", 0).transition(show).attr("opacity", 1);

  const data = cells.i.filter(i => cells.h[i] >= 20 && cells.prec[i]);
  prec.selectAll("circle").data(data).enter().append("circle")
    .attr("cx", d => p[d][0]).attr("cy", d => p[d][1]).attr("r", 0)
    .transition(show).attr("r", d => rn(Math.max(Math.sqrt(cells.prec[d] * .5), .8),2)); 
}

function togglePopulation() {
  if (!population.selectAll("line").size()) {
    turnButtonOn("togglePopulation");
    drawPopulation();
  } else {
    turnButtonOff("togglePopulation");
    const hide = d3.transition().duration(1000).ease(d3.easeSinIn);
    population.select("#rural").selectAll("line").transition(hide).attr("y2", d => d[1]).remove();
    population.select("#urban").selectAll("line").transition(hide).delay(1000).attr("y2", d => d[1]).remove();
  }
}

function drawPopulation() {
  population.selectAll("line").remove();
  const cells = pack.cells, p = cells.p, burgs = pack.burgs;
  const show = d3.transition().duration(2000).ease(d3.easeSinIn);

  const rural = Array.from(cells.i.filter(i => cells.pop[i] > 0), i => [p[i][0], p[i][1], p[i][1] - cells.pop[i] / 8]);
  population.select("#rural").selectAll("line").data(rural).enter().append("line")
    .attr("x1", d => d[0]).attr("y1", d => d[1])
    .attr("x2", d => d[0]).attr("y2", d => d[1])
    .transition(show).attr("y2", d => d[2]);

  const urban = burgs.filter(b => b.i && !b.removed).map(b => [b.x, b.y, b.y - b.population / 8 * urbanization.value]);
  population.select("#urban").selectAll("line").data(urban).enter().append("line")
    .attr("x1", d => d[0]).attr("y1", d => d[1])
    .attr("x2", d => d[0]).attr("y2", d => d[1])
    .transition(show).delay(500).attr("y2", d => d[2]);
}

function toggleCells() {
  if (!cells.selectAll("path").size()) {
    turnButtonOn("toggleCells");
    drawCells();
  } else {
    cells.selectAll("path").remove();
    turnButtonOff("toggleCells");
  }
}

function drawCells() {
  cells.selectAll("path").remove();
  const data = customization === 1 ? grid.cells.i : pack.cells.i;
  const polygon = customization === 1 ? getGridPolygon : getPackPolygon;
  let path = "";
  data.forEach(i => path += "M" + polygon(i));
  cells.append("path").attr("d", path);
}

function toggleCultures() {
  if (!cults.selectAll("path").size()) {
    turnButtonOn("toggleCultures");
    drawCultures();
  } else {
    cults.selectAll("path").remove();
    turnButtonOff("toggleCultures");
  }
}

function drawCultures() {
  console.time("drawCultures");
  
  cults.selectAll("path").remove();
  const cells = pack.cells, vertices = pack.vertices, cultures = pack.cultures, n = cells.i.length;
  const used = new Uint8Array(cells.i.length);
  const paths = new Array(cultures.length).fill("");

  for (const i of cells.i) {
    if (!cells.culture[i]) continue;
    if (used[i]) continue;
    used[i] = 1;
    const c = cells.culture[i];
    const onborder = cells.c[i].some(n => cells.culture[n] !== c);
    if (!onborder) continue;
    const vertex = cells.v[i].find(v => vertices.c[v].some(i => cells.culture[i] !== c));
    const chain = connectVertices(vertex, c);
    if (chain.length < 3) continue;
    const points = chain.map(v => vertices.p[v]);
    paths[c] += "M" + points.join("L") + "Z";
  }

  const data = paths.map((p, i) => [p, i]).filter(d => d[0].length > 10);
  cults.selectAll("path").data(data).enter().append("path").attr("d", d => d[0]).attr("fill", d => cultures[d[1]].color).attr("id", d => "culture"+d[1]);

  // connect vertices to chain
  function connectVertices(start, t) {
    const chain = []; // vertices chain to form a path
    for (let i=0, current = start; i === 0 || current !== start && i < 20000; i++) {
      const prev = chain[chain.length - 1]; // previous vertex in chain
      chain.push(current); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter(c => cells.culture[c] === t).forEach(c => used[c] = 1);
      const c0 = c[0] >= n || cells.culture[c[0]] !== t;
      const c1 = c[1] >= n || cells.culture[c[1]] !== t;
      const c2 = c[2] >= n || cells.culture[c[2]] !== t;
      const v = vertices.v[current]; // neighboring vertices
      if (v[0] !== prev && c0 !== c1) current = v[0];
      else if (v[1] !== prev && c1 !== c2) current = v[1];
      else if (v[2] !== prev && c0 !== c2) current = v[2];
      if (current === chain[chain.length - 1]) {console.error("Next vertex is not found"); break;}
    }
    return chain;
  }
  console.timeEnd("drawCultures");
}

function toggleReligions() {
  if (!relig.selectAll("path").size()) {
    turnButtonOn("toggleReligions");
    drawReligions();
  } else {
    relig.selectAll("path").remove();
    turnButtonOff("toggleReligions");
  }
}

function drawReligions() {
  console.time("drawReligions");

  relig.selectAll("path").remove();
  const cells = pack.cells, vertices = pack.vertices, religions = pack.religions, n = cells.i.length;
  const used = new Uint8Array(cells.i.length);
  const paths = new Array(religions.length).fill("");

  for (const i of cells.i) {
    if (!cells.religion[i]) continue;
    if (used[i]) continue;
    used[i] = 1;
    const r = cells.religion[i];
    const onborder = cells.c[i].some(n => cells.religion[n] !== r);
    if (!onborder) continue;
    const vertex = cells.v[i].find(v => vertices.c[v].some(i => cells.religion[i] !== r));
    const chain = connectVertices(vertex, r);
    if (chain.length < 3) continue;
    const points = chain.map(v => vertices.p[v]);
    paths[r] += "M" + points.join("L") + "Z";
  }

  const data = paths.map((p, i) => [p, i]).filter(d => d[0].length > 10);
  relig.selectAll("path").data(data).enter().append("path").attr("d", d => d[0]).attr("fill", d => religions[d[1]].color).attr("id", d => "religion"+d[1]);

  // connect vertices to chain
  function connectVertices(start, t) {
    const chain = []; // vertices chain to form a path
    for (let i=0, current = start; i === 0 || current !== start && i < 20000; i++) {
      const prev = chain[chain.length - 1]; // previous vertex in chain
      chain.push(current); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter(c => cells.religion[c] === t).forEach(c => used[c] = 1);
      const c0 = c[0] >= n || cells.religion[c[0]] !== t;
      const c1 = c[1] >= n || cells.religion[c[1]] !== t;
      const c2 = c[2] >= n || cells.religion[c[2]] !== t;
      const v = vertices.v[current]; // neighboring vertices
      if (v[0] !== prev && c0 !== c1) current = v[0];
      else if (v[1] !== prev && c1 !== c2) current = v[1];
      else if (v[2] !== prev && c0 !== c2) current = v[2];
      if (current === chain[chain.length - 1]) {console.error("Next vertex is not found"); break;}
    }
    return chain;
  }
  console.timeEnd("drawReligions");
}

function toggleStates() {
  if (!layerIsOn("toggleStates")) {
    turnButtonOn("toggleStates");
    regions.attr("display", null);
    drawStates();
  } else {
    regions.attr("display", "none").selectAll("path").remove();
    turnButtonOff("toggleStates");
  }
}

// draw states
function drawStates() {
  console.time("drawStates");
  regions.selectAll("path").remove();

  const cells = pack.cells, vertices = pack.vertices, states = pack.states, n = cells.i.length;
  const used = new Uint8Array(cells.i.length);
  const vArray = new Array(states.length); // store vertices array
  const body = new Array(states.length).fill(""); // store path around each state
  const gap = new Array(states.length).fill(""); // store path along water for each state to fill the gaps

  for (const i of cells.i) {
    if (!cells.state[i] || used[i]) continue;
    const s = cells.state[i];
    const onborder = cells.c[i].some(n => cells.state[n] !== s);
    if (!onborder) continue;

    const borderWith = cells.c[i].map(c => cells.state[c]).find(n => n !== s);
    const vertex = cells.v[i].find(v => vertices.c[v].some(i => cells.state[i] === borderWith));
    const chain = connectVertices(vertex, s, borderWith);
    if (chain.length < 3) continue;
    const points = chain.map(v => vertices.p[v[0]]);
    if (!vArray[s]) vArray[s] = [];
    vArray[s].push(points);
    body[s] += "M" + points.join("L");
    gap[s] += "M" + vertices.p[chain[0][0]] + chain.reduce((r,v,i,d) => !i ? r : !v[2] ? r + "L" + vertices.p[v[0]] : d[i+1] && !d[i+1][2] ? r + "M" +  vertices.p[v[0]] : r, "");
  }

  // find state visual center
  vArray.forEach((ar, i) => {
    const sorted = ar.sort((a, b) => b.length - a.length); // sort by points number
    states[i].pole = polylabel(sorted, 1.0); // pole of inaccessibility
  });

  const bodyData = body.map((p, i) => [p.length > 10 ? p : null, i, states[i].color]).filter(d => d[0]);
  statesBody.selectAll("path").data(bodyData).enter().append("path").attr("d", d => d[0]).attr("fill", d => d[2]).attr("stroke", "none").attr("id", d => "state"+d[1]);
  const gapData = gap.map((p, i) => [p.length > 10 ? p : null, i, states[i].color]).filter(d => d[0]);
  statesBody.selectAll(".path").data(gapData).enter().append("path").attr("d", d => d[0]).attr("fill", "none").attr("stroke", d => d[2]).attr("id", d => "state-gap"+d[1]);

  defs.select("#statePaths").selectAll("clipPath").remove();
  defs.select("#statePaths").selectAll("clipPath").data(bodyData).enter().append("clipPath").attr("id", d => "state-clip"+d[1]).append("use").attr("href", d => "#state"+d[1]);
  statesHalo.selectAll(".path").data(bodyData).enter().append("path")
    .attr("d", d => d[0]).attr("stroke", d => d3.color(d[2]) ? d3.color(d[2]).darker().hex() : "#666666")
    .attr("id", d => "state-border"+d[1]).attr("clip-path", d => "url(#state-clip"+d[1]+")");

  // connect vertices to chain
  function connectVertices(start, t, state) {
    const chain = []; // vertices chain to form a path
    let land = vertices.c[start].some(c => cells.h[c] >= 20 && cells.state[c] !== t);
    function check(i) {state = cells.state[i]; land = cells.h[i] >= 20;}
    
    for (let i=0, current = start; i === 0 || current !== start && i < 20000; i++) {
      const prev = chain[chain.length - 1] ? chain[chain.length - 1][0] : -1; // previous vertex in chain
      chain.push([current, state, land]); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter(c => cells.state[c] === t).forEach(c => used[c] = 1);
      const c0 = c[0] >= n || cells.state[c[0]] !== t;
      const c1 = c[1] >= n || cells.state[c[1]] !== t;
      const c2 = c[2] >= n || cells.state[c[2]] !== t;
      const v = vertices.v[current]; // neighboring vertices
      if (v[0] !== prev && c0 !== c1) {current = v[0]; check(c0 ? c[0] : c[1]);} else
      if (v[1] !== prev && c1 !== c2) {current = v[1]; check(c1 ? c[1] : c[2]);} else
      if (v[2] !== prev && c0 !== c2) {current = v[2]; check(c2 ? c[2] : c[0]);}
      if (current === chain[chain.length - 1][0]) {console.error("Next vertex is not found"); break;}
    }
    chain.push([start, state, land]); // add starting vertex to sequence to close the path
    return chain;
  }
  invokeActiveZooming();
  console.timeEnd("drawStates");
}

// draw state and province borders
function drawBorders() {
  console.time("drawBorders");
  borders.selectAll("path").remove();

  const cells = pack.cells, vertices = pack.vertices, n = cells.i.length;
  const sPath = [], pPath = [];
  const sUsed = new Array(pack.states.length).fill("").map(a => []);
  const pUsed = new Array(pack.provinces.length).fill("").map(a => []);

  for (let i=0; i < cells.i.length; i++) {
    if (!cells.state[i]) continue;
    const p = cells.province[i];
    const s = cells.state[i];

    // if cell is on province border
    const provToCell = cells.c[i].find(n => cells.state[n] === s && p > cells.province[n] && pUsed[p][n] !== cells.province[n]);
    if (provToCell) {
      const provTo = cells.province[provToCell];
      pUsed[p][provToCell] = provTo;
      const vertex = cells.v[i].find(v => vertices.c[v].some(i => cells.province[i] === provTo));
      const chain = connectVertices(vertex, p, cells.province, provTo, pUsed);

      if (chain.length > 1) {
        pPath.push("M" + chain.map(c => vertices.p[c]).join(" "));
        i--;
        continue;
      }
    }

    // if cell is on state border
    const stateToCell = cells.c[i].find(n => cells.h[n] >= 20 && s > cells.state[n] && sUsed[s][n] !== cells.state[n]);
    if (stateToCell !== undefined) {
      const stateTo = cells.state[stateToCell];
      sUsed[s][stateToCell] = stateTo;
      const vertex = cells.v[i].find(v => vertices.c[v].some(i => cells.h[i] >= 20 && cells.state[i] === stateTo));
      const chain = connectVertices(vertex, s, cells.state, stateTo, sUsed);
      
      if (chain.length > 1) {
        sPath.push("M" + chain.map(c => vertices.p[c]).join(" "));
        i--;
        continue;
      }
    }
  }

  stateBorders.append("path").attr("d", sPath.join(" "));
  provinceBorders.append("path").attr("d", pPath.join(" "));

  // connect vertices to chain
  function connectVertices(current, f, array, t, used) {
    let chain = [];
    const checkCell = c => c >= n || array[c] !== f;
    const checkVertex = v => vertices.c[v].some(c => array[c] === f) && vertices.c[v].some(c => array[c] === t && cells.h[c] >= 20);

    // find starting vertex
    for (let i=0; i < 1000; i++) {
      if (i === 999) console.error("Find starting vertex: limit is reached", current, f, t);
      const p = chain[chain.length-2] || -1; // previous vertex
      const v = vertices.v[current], c = vertices.c[current]; 

      const v0 = checkCell(c[0]) !== checkCell(c[1]) && checkVertex(v[0]);
      const v1 = checkCell(c[1]) !== checkCell(c[2]) && checkVertex(v[1]);
      const v2 = checkCell(c[0]) !== checkCell(c[2]) && checkVertex(v[2]);
      if (v0 + v1 + v2 === 1) break;
      current = v0 && p !== v[0] ? v[0] : v1 && p !== v[1] ? v[1] : v[2];

      if (current === chain[0]) break;
      if (current === p) return [];
      chain.push(current);
    }

    chain = [current]; // vertices chain to form a path
    // find path
    for (let i=0; i < 1000; i++) {
      if (i === 999) console.error("Find path: limit is reached", current, f, t);
      const p = chain[chain.length-2] || -1; // previous vertex
      const v = vertices.v[current], c = vertices.c[current];
      c.filter(c => array[c] === t).forEach(c => used[f][c] = t);

      const v0 = checkCell(c[0]) !== checkCell(c[1]) && checkVertex(v[0]);
      const v1 = checkCell(c[1]) !== checkCell(c[2]) && checkVertex(v[1]);
      const v2 = checkCell(c[0]) !== checkCell(c[2]) && checkVertex(v[2]);
      current = v0 && p !== v[0] ? v[0] : v1 && p !== v[1] ? v[1] : v[2];

      if (current === p) break;
      if (current === chain[chain.length-1]) break;
      if (chain.length > 1 && v0 + v1 + v2 < 2) break;
      chain.push(current);
      if (current === chain[0]) break;
    }

    return chain;
  }

  console.timeEnd("drawBorders");
}

function toggleBorders() {
  if (!layerIsOn("toggleBorders")) {
    turnButtonOn("toggleBorders");
    $('#borders').fadeIn();
  } else {
    turnButtonOff("toggleBorders");
    $('#borders').fadeOut();
  }  
}

function toggleProvinces() {
  if (!layerIsOn("toggleProvinces")) {
    turnButtonOn("toggleProvinces");
    drawProvinces();
  } else {
    provs.selectAll("*").remove();
    turnButtonOff("toggleProvinces");
  }
}

function drawProvinces() {
  console.time("drawProvinces");
  const labelsOn = provs.attr("data-labels") == 1;
  provs.selectAll("*").remove();

  const cells = pack.cells, vertices = pack.vertices, provinces = pack.provinces, n = cells.i.length;
  const used = new Uint8Array(cells.i.length);
  const vArray = new Array(provinces.length); // store vertices array
  const body = new Array(provinces.length).fill(""); // store path around each province
  const gap = new Array(provinces.length).fill(""); // store path along water for each province to fill the gaps

  for (const i of cells.i) {
    if (!cells.province[i] || used[i]) continue;
    const p = cells.province[i];
    const onborder = cells.c[i].some(n => cells.province[n] !== p);
    if (!onborder) continue;

    const borderWith = cells.c[i].map(c => cells.province[c]).find(n => n !== p);
    const vertex = cells.v[i].find(v => vertices.c[v].some(i => cells.province[i] === borderWith));
    const chain = connectVertices(vertex, p, borderWith);
    if (chain.length < 3) continue;
    const points = chain.map(v => vertices.p[v[0]]);
    if (!vArray[p]) vArray[p] = [];
    vArray[p].push(points);
    body[p] += "M" + points.join("L");
    gap[p] += "M" + vertices.p[chain[0][0]] + chain.reduce((r,v,i,d) => !i ? r : !v[2] ? r + "L" + vertices.p[v[0]] : d[i+1] && !d[i+1][2] ? r + "M" +  vertices.p[v[0]] : r, "");
  }

  // find state visual center
  vArray.forEach((ar, i) => {
    const sorted = ar.sort((a, b) => b.length - a.length); // sort by points number
    provinces[i].pole = polylabel(sorted, 1.0); // pole of inaccessibility
  });

  const g = provs.append("g").attr("id", "provincesBody");
  const bodyData = body.map((p, i) => [p.length > 10 ? p : null, i, provinces[i].color]).filter(d => d[0]);
  g.selectAll("path").data(bodyData).enter().append("path").attr("d", d => d[0]).attr("fill", d => d[2]).attr("stroke", "none").attr("id", d => "province"+d[1]);
  const gapData = gap.map((p, i) => [p.length > 10 ? p : null, i, provinces[i].color]).filter(d => d[0]);
  g.selectAll(".path").data(gapData).enter().append("path").attr("d", d => d[0]).attr("fill", "none").attr("stroke", d => d[2]).attr("id", d => "province-gap"+d[1]);

  const labels = provs.append("g").attr("id", "provinceLabels");
  labels.style("display", `${labelsOn ? "block" : "none"}`);
  const labelData = provinces.filter(p => p.i && !p.removed);
  labels.selectAll(".path").data(labelData).enter().append("text")
    .attr("x", d => d.pole[0]).attr("y", d => d.pole[1])
    .attr("id", d => "provinceLabel"+d.i).text(d => d.name);

  // connect vertices to chain
  function connectVertices(start, t, province) {
    const chain = []; // vertices chain to form a path
    let land = vertices.c[start].some(c => cells.h[c] >= 20 && cells.province[c] !== t);
    function check(i) {province = cells.province[i]; land = cells.h[i] >= 20;}

    for (let i=0, current = start; i === 0 || current !== start && i < 20000; i++) {
      const prev = chain[chain.length - 1] ? chain[chain.length - 1][0] : -1; // previous vertex in chain
      chain.push([current, province, land]); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter(c => cells.province[c] === t).forEach(c => used[c] = 1);
      const c0 = c[0] >= n || cells.province[c[0]] !== t;
      const c1 = c[1] >= n || cells.province[c[1]] !== t;
      const c2 = c[2] >= n || cells.province[c[2]] !== t;
      const v = vertices.v[current]; // neighboring vertices
      if (v[0] !== prev && c0 !== c1) {current = v[0]; check(c0 ? c[0] : c[1]);} else
      if (v[1] !== prev && c1 !== c2) {current = v[1]; check(c1 ? c[1] : c[2]);} else
      if (v[2] !== prev && c0 !== c2) {current = v[2]; check(c2 ? c[2] : c[0]);}
      if (current === chain[chain.length-1][0]) {console.error("Next vertex is not found"); break;}
    }
    chain.push([start, province, land]); // add starting vertex to sequence to close the path
    return chain;
  }
  console.timeEnd("drawProvinces");
}

function toggleGrid() {
  if (!gridOverlay.selectAll("*").size()) {
    turnButtonOn("toggleGrid");
    drawGrid();
    calculateFriendlyGridSize();
  } else {
    turnButtonOff("toggleGrid");
    gridOverlay.selectAll("*").remove();
  }
}

function drawGrid() {
  console.time("drawGrid");
  gridOverlay.selectAll("*").remove();
  const type = styleGridType.value;
  const size = +styleGridSize.value;
  if (type === "pointyHex" || type === "flatHex") {
    const points = getHexGridPoints(size, type);
    const hex = "m" + getHex(size, type).slice(0, 4).join("l");
    const d = points.map(p => "M" + p + hex).join("");
    gridOverlay.append("path").attr("d", d);
  } else if (type === "square") {
    const pathX = d3.range(size, svgWidth, size).map(x => "M" + rn(x, 2) + ",0v" + svgHeight);
    const pathY = d3.range(size, svgHeight, size).map(y => "M0," + rn(y, 2) + "h" + svgWidth);
    gridOverlay.append("path").attr("d", pathX + pathY);
  }

  // calculate hexes centers
  function getHexGridPoints(size, type) {
    const points = [];
    const rt3 = Math.sqrt(3);
    const off = type === "pointyHex" ? rn(rt3 * size / 2, 2) : rn(size * 3 / 2, 2);
    const ySpace = type === "pointyHex" ? rn(size * 3 / 2, 2) : rn(rt3 * size / 2, 2);
    const xSpace = type === "pointyHex" ? rn(rt3 * size, 2) : rn(size * 3, 2);
    for (let y = 0, l = 0; y < graphHeight+ySpace; y += ySpace, l++) {
      for (let x = l % 2 ? 0 : off; x < graphWidth+xSpace; x += xSpace) {points.push([rn(x, 2), rn(y, 2)]);}
    }
    return points;
  }

  // calculate hex points
  function getHex(radius, type) {
    let x0 = 0, y0 = 0;
    const s = type === "pointyHex" ? 0 : Math.PI / -6;
    const thirdPi = Math.PI / 3;
    let angles = [s, s + thirdPi, s + 2 * thirdPi, s + 3 * thirdPi, s + 4 * thirdPi, s + 5 * thirdPi];
    return angles.map(function(a) {
      const x1 = Math.sin(a) * radius;
      const y1 = -Math.cos(a) * radius;
      const dx = rn(x1 - x0, 2);
      const dy = rn(y1 - y0, 2);
      x0 = x1, y0 = y1;
      return [rn(dx, 2), rn(dy, 2)];
    });
  }

  console.timeEnd("drawGrid");
}

function toggleCoordinates() {
  if (!coordinates.selectAll("*").size()) {
    turnButtonOn("toggleCoordinates");
    drawCoordinates();
  } else {
    turnButtonOff("toggleCoordinates");
    coordinates.selectAll("*").remove();
  }
}

function drawCoordinates() {
  if (!layerIsOn("toggleCoordinates")) return;
  coordinates.selectAll("*").remove(); // remove every time
  const steps = [.5, 1, 2, 5, 10, 15, 30]; // possible steps
  const goal = mapCoordinates.lonT / scale / 10;
  const step = steps.reduce((p, c) => Math.abs(c - goal) < Math.abs(p - goal) ? c : p);

  const desired = +coordinates.attr("data-size"); // desired label size
  coordinates.attr("font-size", Math.max(rn(desired / scale ** .8, 2), .1)); // actual label size
  const graticule = d3.geoGraticule().extent([[mapCoordinates.lonW, mapCoordinates.latN], [mapCoordinates.lonE, mapCoordinates.latS]])
    .stepMajor([400, 400]).stepMinor([step, step]);
  const projection = d3.geoEquirectangular().fitSize([graphWidth, graphHeight], graticule());

  const grid = coordinates.append("g").attr("id", "coordinateGrid");
  const labels = coordinates.append("g").attr("id", "coordinateLabels");

  const p = getViewPoint(scale + desired + 2, scale + desired / 2); // on border point on viexBox
  const data = graticule.lines().map(d => {
    const lat = d.coordinates[0][1] === d.coordinates[1][1]; // check if line is latitude or longitude
    const c = d.coordinates[0], pos = projection(c); // map coordinates
    const [x, y] = lat ? [rn(p.x, 2), rn(pos[1], 2)] : [rn(pos[0], 2), rn(p.y, 2)]; // labels position
    const v = lat ? c[1] : c[0]; // label
    const text = !v ? v : Number.isInteger(v) ? lat ? c[1] < 0 ? -c[1] + "°S" : c[1] + "°N" : c[0] < 0 ? -c[0] + "°W" : c[0] + "°E" : "";
    return {lat, x, y, text};
  });

  const d = round(d3.geoPath(projection)(graticule()));
  grid.append("path").attr("d", d).attr("vector-effect", "non-scaling-stroke");
  labels.selectAll('text').data(data).enter().append("text").attr("x", d => d.x).attr("y", d => d.y).text(d => d.text);
}

// conver svg point into viewBox point
function getViewPoint(x, y) {
  const view = document.getElementById('viewbox');
  const svg = document.getElementById('map');
  const pt = svg.createSVGPoint();
  pt.x = x, pt.y = y;
  return pt.matrixTransform(view.getScreenCTM().inverse());
}

function toggleCompass() {
  if (!layerIsOn("toggleCompass")) {
    turnButtonOn("toggleCompass");
    $('#compass').fadeIn();
    if (!compass.selectAll("*").size()) {
      const tr = `translate(80 80) scale(.25)`;
      d3.select("#rose").attr("transform", tr);
      compass.append("use").attr("xlink:href","#rose");
      // prolongate rose lines
      svg.select("g#rose > g#sL > line#sL1").attr("y1", -19000).attr("y2", 19000);
      svg.select("g#rose > g#sL > line#sL2").attr("x1", -19000).attr("x2", 19000);
    }
  } else {
    $('#compass').fadeOut();
    turnButtonOff("toggleCompass");
  }
}

function toggleRelief() {
  if (!layerIsOn("toggleRelief")) {
    turnButtonOn("toggleRelief");
    if (!terrain.selectAll("*").size()) ReliefIcons();
    $('#terrain').fadeIn();
  } else {
    $('#terrain').fadeOut();
    turnButtonOff("toggleRelief");
  }
}

function toggleTexture() {
  if (!layerIsOn("toggleTexture")) {
    turnButtonOn("toggleTexture");
    // append default texture image selected by default. Don't append on load to not harm performance
    if (!texture.selectAll("*").size()) {
      texture.append("image").attr("x", 0).attr("y", 0).attr("width", graphWidth).attr("height", graphHeight)
        .attr('xlink:href', getDefaultTexture()).attr('preserveAspectRatio', "xMidYMid slice");
    }
    $('#texture').fadeIn();
    zoom.scaleBy(svg, 1.00001); // enforce browser re-draw
  } else {
    $('#texture').fadeOut();
    turnButtonOff("toggleTexture");
  }
}

function toggleRivers() {
  if (!layerIsOn("toggleRivers")) {
    turnButtonOn("toggleRivers");
    $('#rivers').fadeIn();
  } else {
    $('#rivers').fadeOut();
    turnButtonOff("toggleRivers");
  }
}

function toggleRoutes() {
  if (!layerIsOn("toggleRoutes")) {
    turnButtonOn("toggleRoutes");
    $('#routes').fadeIn();
  } else {
    $('#routes').fadeOut();
    turnButtonOff("toggleRoutes");
  }
}

function toggleMarkers() {
  if (!layerIsOn("toggleMarkers")) {
    turnButtonOn("toggleMarkers");
    $('#markers').fadeIn();
  } else {
    $('#markers').fadeOut();
    turnButtonOff("toggleMarkers");
  }
}

function toggleLabels() {
  if (!layerIsOn("toggleLabels")) {
    turnButtonOn("toggleLabels");
    labels.style("display", null)
    invokeActiveZooming();
  } else {
    turnButtonOff("toggleLabels");
    labels.style("display", "none");
  }
}

function toggleIcons() {
  if (!layerIsOn("toggleIcons")) {
    turnButtonOn("toggleIcons");
    $('#icons').fadeIn();
  } else {
    turnButtonOff("toggleIcons");
    $('#icons').fadeOut();
  }  
}

function toggleRulers() {
  if (!layerIsOn("toggleRulers")) {
    turnButtonOn("toggleRulers");
    $('#ruler').fadeIn();
  } else {
    $('#ruler').fadeOut();
    turnButtonOff("toggleRulers");
  }
}

function toggleScaleBar() {
  if (!layerIsOn("toggleScaleBar")) {
    turnButtonOn("toggleScaleBar");
    $('#scaleBar').fadeIn();
  } else {
    $('#scaleBar').fadeOut();
    turnButtonOff("toggleScaleBar");
  }
}

function toggleZones() {
  if (!layerIsOn("toggleZones")) {
    turnButtonOn("toggleZones");
    $('#zones').fadeIn();
  } else {
    turnButtonOff("toggleZones");
    $('#zones').fadeOut();
  }  
}

function layerIsOn(el) {
  const buttonoff = document.getElementById(el).classList.contains("buttonoff");
  return !buttonoff;
}

function turnButtonOff(el) {
  document.getElementById(el).classList.add("buttonoff");
  getCurrentPreset();
}

function turnButtonOn(el) {
  document.getElementById(el).classList.remove("buttonoff");
  getCurrentPreset();
}

// move layers on mapLayers dragging (jquery sortable)
$("#mapLayers").sortable({items: "li:not(.solid)", containment: "parent", cancel: ".solid", update: moveLayer});
function moveLayer(event, ui) {
  const el = getLayer(ui.item.attr("id"));
  if (!el) return;
  const prev = getLayer(ui.item.prev().attr("id"));
  const next = getLayer(ui.item.next().attr("id"));
  if (prev) el.insertAfter(prev); else if (next) el.insertBefore(next);
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
  if (id === "toggleCultures") return $("#cults");
  if (id === "toggleStates") return $("#regions");
  if (id === "toggleProvinces") return $("#provs");
  if (id === "toggleBorders") return $("#borders");
  if (id === "toggleRoutes") return $("#routes");
  if (id === "toggleTemp") return $("#temperature");
  if (id === "togglePrec") return $("#prec");
  if (id === "togglePopulation") return $("#population");
  if (id === "toggleTexture") return $("#texture");
  if (id === "toggleLabels") return $("#labels");
  if (id === "toggleIcons") return $("#icons");
  if (id === "toggleMarkers") return $("#markers");
  if (id === "toggleRulers") return $("#ruler");
}