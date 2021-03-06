// Functions to save and load the map
"use strict";

// download map as SVG
async function saveSVG() {
  TIME && console.time("saveSVG");
  const url = await getMapURL("svg");
  const link = document.createElement("a");
  link.download = getFileName() + ".svg";
  link.href = url;
  link.click();

  tip(`${link.download} is saved. Open "Downloads" screen (crtl + J) to check. You can set image scale in options`, true, "success", 5000);
  TIME && console.timeEnd("saveSVG");
}

// download map as PNG
async function savePNG() {
  TIME && console.time("savePNG");
  const url = await getMapURL("png");

  const link = document.createElement("a");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = svgWidth * pngResolutionInput.value;
  canvas.height = svgHeight * pngResolutionInput.value;
  const img = new Image();
  img.src = url;

  img.onload = function() {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    link.download = getFileName() + ".png";
    canvas.toBlob(function(blob) {
        link.href = window.URL.createObjectURL(blob);
        link.click();
        window.setTimeout(function() {
          canvas.remove();
          window.URL.revokeObjectURL(link.href);
          tip(`${link.download} is saved. Open "Downloads" screen (crtl + J) to check. You can set image scale in options`, true, "success", 5000);
        }, 1000);
    });
  }

  TIME && console.timeEnd("savePNG");
}

// download map as JPEG
async function saveJPEG() {
  TIME && console.time("saveJPEG");
  const url = await getMapURL("png");

  const canvas = document.createElement("canvas");
  canvas.width = svgWidth * pngResolutionInput.value;
  canvas.height = svgHeight * pngResolutionInput.value;
  const img = new Image();
  img.src = url;

  img.onload = async function() {
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const quality = Math.min(rn(1 - pngResolutionInput.value / 20, 2), .92);
    const URL = await canvas.toDataURL("image/jpeg", quality);
    const link = document.createElement("a");
    link.download = getFileName() + ".jpeg";
    link.href = URL;
    link.click();
    tip(`${link.download} is saved. Open "Downloads" screen (CTRL + J) to check`, true, "success", 7000);
    window.setTimeout(() => window.URL.revokeObjectURL(URL), 5000);
  }

  TIME && console.timeEnd("saveJPEG");
}

// parse map svg to object url
async function getMapURL(type, subtype) {
  const cloneEl = document.getElementById("map").cloneNode(true); // clone svg
  cloneEl.id = "fantasyMap";
  document.body.appendChild(cloneEl);
  const clone = d3.select(cloneEl);
  clone.select("#debug").remove();

  const cloneDefs = cloneEl.getElementsByTagName("defs")[0];
  const svgDefs = document.getElementById("defElements");

  const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
  if (isFirefox && type === "mesh") clone.select("#oceanPattern").remove();
  if (subtype === "globe") clone.select("#scaleBar").remove();
  if (subtype === "noWater") {clone.select("#oceanBase").attr("opacity", 0); clone.select("#oceanPattern").attr("opacity", 0);}
  if (type !== "png") {
    // reset transform to show the whole map
    clone.attr("width", graphWidth).attr("height", graphHeight);
    clone.select("#viewbox").attr("transform", null);
  }
  if (type === "svg") removeUnusedElements(clone);
  if (customization && type === "mesh") updateMeshCells(clone);
  inlineStyle(clone);

  // remove unused filters
  const filters = cloneEl.querySelectorAll("filter");
  for (let i=0; i < filters.length; i++) {
    const id = filters[i].id;
    if (cloneEl.querySelector("[filter='url(#"+id+")']")) continue;
    if (cloneEl.getAttribute("filter") === "url(#"+id+")") continue;
    filters[i].remove();
  }

  // remove unused patterns
  const patterns = cloneEl.querySelectorAll("pattern");
  for (let i=0; i < patterns.length; i++) {
    const id = patterns[i].id;
    if (cloneEl.querySelector("[fill='url(#"+id+")']")) continue;
    patterns[i].remove();
  }

  // remove unused symbols
  const symbols = cloneEl.querySelectorAll("symbol");
  for (let i=0; i < symbols.length; i++) {
    const id = symbols[i].id;
    if (cloneEl.querySelector("use[*|href='#"+id+"']")) continue;
    symbols[i].remove();
  }

  // add displayed emblems
  if (layerIsOn("toggleEmblems") && emblems.selectAll("use").size()) {
    cloneEl.getElementById("emblems")?.querySelectorAll("use").forEach(el => {
      const href = el.getAttribute("href") || el.getAttribute("xlink:href");
      if (!href) return;
      const emblem = document.getElementById(href.slice(1));
      if (emblem) cloneDefs.append(emblem.cloneNode(true));
    });
  } else {
    cloneDefs.querySelector("#defs-emblems")?.remove();
  }

  // replace ocean pattern href to base64
  if (cloneEl.getElementById("oceanicPattern")) {
    const el = cloneEl.getElementById("oceanicPattern");
    const url = el.getAttribute("href");
    getBase64(url, base64 => el.setAttribute("href", base64));
  }

  // add relief icons
  if (cloneEl.getElementById("terrain")) {
    const uniqueElements = new Set();
    const terrainNodes = cloneEl.getElementById("terrain").childNodes;
    for (let i=0; i < terrainNodes.length; i++) {
      const href = terrainNodes[i].getAttribute("href") || terrainNodes[i].getAttribute("xlink:href");
      uniqueElements.add(href);
    }

    const defsRelief = svgDefs.getElementById("defs-relief");
    for (const terrain of [...uniqueElements]) {
      const element = defsRelief.querySelector(terrain);
      if (element) cloneDefs.appendChild(element.cloneNode(true));
    }
  }

  // add wind rose
  if (cloneEl.getElementById("compass")) {
    const rose = svgDefs.getElementById("rose");
    if (rose) cloneDefs.appendChild(rose.cloneNode(true));
  }

  // add port icon
  if (cloneEl.getElementById("anchors")) {
    const anchor = svgDefs.getElementById("icon-anchor");
    if (anchor) cloneDefs.appendChild(anchor.cloneNode(true));
  }

  if (!cloneEl.getElementById("hatching").children.length) cloneEl.getElementById("hatching").remove(); //remove unused hatching group
  if (!cloneEl.getElementById("fogging-cont")) cloneEl.getElementById("fog").remove(); //remove unused fog
  if (!cloneEl.getElementById("regions")) cloneEl.getElementById("statePaths").remove(); // removed unused statePaths
  if (!cloneEl.getElementById("labels")) cloneEl.getElementById("textPaths").remove(); // removed unused textPaths

  // add armies style
  if (cloneEl.getElementById("armies")) cloneEl.insertAdjacentHTML("afterbegin", "<style>#armies text {stroke: none; fill: #fff; text-shadow: 0 0 4px #000; dominant-baseline: central; text-anchor: middle; font-family: Helvetica; fill-opacity: 1;}#armies text.regimentIcon {font-size: .8em;}</style>");

  const fontStyle = await GFontToDataURI(getFontsToLoad(clone)); // load non-standard fonts
  if (fontStyle) clone.select("defs").append("style").text(fontStyle.join('\n')); // add font to style
  clone.remove();

  const serialized = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>` + (new XMLSerializer()).serializeToString(cloneEl);
  const blob = new Blob([serialized], {type: 'image/svg+xml;charset=utf-8'});
  const url = window.URL.createObjectURL(blob);
  window.setTimeout(() => window.URL.revokeObjectURL(url), 5000);
  return url;
}

// remove hidden g elements and g elements without children to make downloaded svg smaller in size
function removeUnusedElements(clone) {
  if (!terrain.selectAll("use").size()) clone.select("#defs-relief").remove();
  if (markers.style("display") === "none") clone.select("#defs-markers").remove();

  for (let empty = 1; empty;) {
    empty = 0;
    clone.selectAll("g").each(function() {
      if (!this.hasChildNodes() || this.style.display === "none" || this.classList.contains("hidden")) {empty++; this.remove();}
      if (this.hasAttribute("display") && this.style.display === "inline") this.removeAttribute("display");
    });
  }
}

function updateMeshCells(clone) {
  const data = renderOcean.checked ? grid.cells.i : grid.cells.i.filter(i => grid.cells.h[i] >= 20);
  const scheme = getColorScheme();
  clone.select("#heights").attr("filter", "url(#blur1)");
  clone.select("#heights").selectAll("polygon").data(data).join("polygon").attr("points", d => getGridPolygon(d))
    .attr("id", d => "cell"+d).attr("stroke", d => getColor(grid.cells.h[d], scheme));
}

// for each g element get inline style
function inlineStyle(clone) {
  const emptyG = clone.append("g").node();
  const defaultStyles = window.getComputedStyle(emptyG);

  clone.selectAll("g, #ruler *, #scaleBar > text").each(function() {
    const compStyle = window.getComputedStyle(this);
    let style = "";

    for (let i=0; i < compStyle.length; i++) {
      const key = compStyle[i];
      const value = compStyle.getPropertyValue(key);

      // Firefox mask hack
      if (key === "mask-image" && value !== defaultStyles.getPropertyValue(key)) {
        style += "mask-image: url('#land');";
        continue;
      }

      if (key === "cursor") continue; // cursor should be default
      if (this.hasAttribute(key)) continue; // don't add style if there is the same attribute
      if (value === defaultStyles.getPropertyValue(key)) continue;
      style += key + ':' + value + ';';
    }

    for (const key in compStyle) {
      const value = compStyle.getPropertyValue(key);

      if (key === "cursor") continue; // cursor should be default
      if (this.hasAttribute(key)) continue; // don't add style if there is the same attribute
      if (value === defaultStyles.getPropertyValue(key)) continue;
      style += key + ':' + value + ';';
    }

    if (style != "") this.setAttribute('style', style);
  });

  emptyG.remove();
}

// get non-standard fonts used for labels to fetch them from web
function getFontsToLoad(clone) {
  const webSafe = ["Georgia", "Times+New+Roman", "Comic+Sans+MS", "Lucida+Sans+Unicode", "Courier+New", "Verdana", "Arial", "Impact"]; // fonts to not fetch

  const fontsInUse = new Set(); // to store fonts currently in use
  clone.selectAll("#labels > g").each(function() {
    if (!this.hasChildNodes()) return;
    const font = this.dataset.font;
    if (!font || webSafe.includes(font)) return;
    fontsInUse.add(font);
  });
  const legendFont = legend.attr("data-font");
  if (legend.node().hasChildNodes() && !webSafe.includes(legendFont)) fontsInUse.add(legendFont);
  const fonts = [...fontsInUse];
  return fonts.length ? "https://fonts.googleapis.com/css?family=" + fonts.join("|") : null;
}

// code from Kaiido's answer https://stackoverflow.com/questions/42402584/how-to-use-google-fonts-in-canvas-when-drawing-dom-objects-in-svg
function GFontToDataURI(url) {
  if (!url) return Promise.resolve();
  return fetch(url) // first fecth the embed stylesheet page
    .then(resp => resp.text()) // we only need the text of it
    .then(text => {
      let s = document.createElement('style');
      s.innerHTML = text;
      document.head.appendChild(s);
      const styleSheet = Array.prototype.filter.call(document.styleSheets, sS => sS.ownerNode === s)[0];

      const FontRule = rule => {
        const src = rule.style.getPropertyValue('src');
        const url = src ? src.split('url(')[1].split(')')[0] : "";
        return {rule, src, url: url.substring(url.length - 1, 1)};
      }
      const fontProms = [];

      for (const r of styleSheet.cssRules) {
        let fR = FontRule(r);
        if (!fR.url) continue;

        fontProms.push(
          fetch(fR.url) // fetch the actual font-file (.woff)
          .then(resp => resp.blob())
          .then(blob => {
            return new Promise(resolve => {
              let f = new FileReader();
              f.onload = e => resolve(f.result);
              f.readAsDataURL(blob);
            })
          })
          .then(dataURL => fR.rule.cssText.replace(fR.url, dataURL))
        )
      }
      document.head.removeChild(s); // clean up
      return Promise.all(fontProms); // wait for all this has been done
    });
}

// prepare map data for saving
function getMapData() {
  TIME && console.time("createMapDataBlob");

  return new Promise(resolve => {
    const date = new Date();
    const dateString = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
    const license = "File can be loaded in azgaar.github.io/Fantasy-Map-Generator";
    const params = [version, license, dateString, seed, graphWidth, graphHeight, mapId].join("|");
    const settings = [distanceUnitInput.value, distanceScaleInput.value, areaUnit.value,
      heightUnit.value, heightExponentInput.value, temperatureScale.value,
      barSize.value, barLabel.value, barBackOpacity.value, barBackColor.value,
      barPosX.value, barPosY.value, populationRate.value, urbanization.value,
      mapSizeOutput.value, latitudeOutput.value, temperatureEquatorOutput.value,
      temperaturePoleOutput.value, precOutput.value, JSON.stringify(options),
      mapName.value].join("|");
    const coords = JSON.stringify(mapCoordinates);
    const biomes = [biomesData.color, biomesData.habitability, biomesData.name].join("|");
    const notesData = JSON.stringify(notes);
    const rulersString = rulers.toString();

    // clone svg
    const cloneEl = document.getElementById("map").cloneNode(true);

    // set transform values to default
    cloneEl.setAttribute("width", graphWidth);
    cloneEl.setAttribute("height", graphHeight);
    cloneEl.querySelector("#viewbox").removeAttribute("transform");

    // always remove rulers
    cloneEl.querySelector("#ruler").innerHTML = "";

    const svg_xml = (new XMLSerializer()).serializeToString(cloneEl);

    const gridGeneral = JSON.stringify({spacing:grid.spacing, cellsX:grid.cellsX, cellsY:grid.cellsY, boundary:grid.boundary, points:grid.points, features:grid.features});
    const features = JSON.stringify(pack.features);
    const cultures = JSON.stringify(pack.cultures);
    const states = JSON.stringify(pack.states);
    const burgs = JSON.stringify(pack.burgs);
    const religions = JSON.stringify(pack.religions);
    const provinces = JSON.stringify(pack.provinces);
    const rivers = JSON.stringify(pack.rivers);

    // store name array only if it is not the same as default
    const defaultNB = Names.getNameBases();
    const namesData = nameBases.map((b,i) => {
      const names = defaultNB[i] && defaultNB[i].b === b.b ? "" : b.b;
      return `${b.name}|${b.min}|${b.max}|${b.d}|${b.m}|${names}`;
    }).join("/");

    // round population to save resources
    const pop = Array.from(pack.cells.pop).map(p => rn(p, 4));

    // data format as below
    const data = [params, settings, coords, biomes, notesData, svg_xml,
      gridGeneral, grid.cells.h, grid.cells.prec, grid.cells.f, grid.cells.t, grid.cells.temp,
      features, cultures, states, burgs,
      pack.cells.biome, pack.cells.burg, pack.cells.conf, pack.cells.culture, pack.cells.fl,
      pop, pack.cells.r, pack.cells.road, pack.cells.s, pack.cells.state,
      pack.cells.religion, pack.cells.province, pack.cells.crossroad, religions, provinces,
      namesData, rivers, rulersString].join("\r\n");
    const blob = new Blob([data], {type: "text/plain"});

    TIME && console.timeEnd("createMapDataBlob");
    resolve(blob);
  });
}

// Download .map file
async function saveMap() {
  if (customization) {tip("Map cannot be saved when edit mode is active, please exit the mode and retry", false, "error"); return;}
  closeDialogs("#alert");

  const blob = await getMapData();
  const URL = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = getFileName() + ".map";
  link.href = URL;
  link.click();
  tip(`${link.download} is saved. Open "Downloads" screen (CTRL + J) to check`, true, "success", 7000);
  window.URL.revokeObjectURL(URL);
}

function saveGeoJSON_Cells() {
  const json = {type: "FeatureCollection", features: []};
  const cells = pack.cells;
  const getPopulation = i => {const [r, u] = getCellPopulation(i); return rn(r+u)};
  const getHeight = i => parseInt(getFriendlyHeight([cells.p[i][0],cells.p[i][1]]));

  cells.i.forEach(i => {
    const coordinates = getCellCoordinates(cells.v[i]);
    const height = getHeight(i);
    const biome = cells.biome[i];
    const type = pack.features[cells.f[i]].type;
    const population = getPopulation(i);
    const state = cells.state[i];
    const province = cells.province[i];
    const culture = cells.culture[i];
    const religion = cells.religion[i];
    const neighbors = cells.c[i];

    const properties = {id:i, height, biome, type, population, state, province, culture, religion, neighbors}
    const feature = {type: "Feature", geometry: {type: "Polygon", coordinates}, properties};
    json.features.push(feature);
  });

  const name = getFileName("Cells") + ".geojson";
  downloadFile(JSON.stringify(json), name, "application/json");
}

function saveGeoJSON_Routes() {
  const json = {type: "FeatureCollection", features: []};

  routes.selectAll("g > path").each(function() {
    const coordinates = getRoutePoints(this);
    const id = this.id;
    const type = this.parentElement.id;

    const feature = {type: "Feature", geometry: {type: "LineString", coordinates}, properties: {id, type}};
    json.features.push(feature);
  });

  const name = getFileName("Routes") + ".geojson";
  downloadFile(JSON.stringify(json), name, "application/json");
}

function saveGeoJSON_Rivers() {
  const json = {type: "FeatureCollection", features: []};

  rivers.selectAll("path").each(function() {
    const coordinates = getRiverPoints(this);
    const id = this.id;
    const width = +this.dataset.increment;
    const increment = +this.dataset.increment;
    const river = pack.rivers.find(r => r.i === +id.slice(5));
    const name = river ? river.name : "";
    const type = river ? river.type : "";
    const i = river ? river.i : "";
    const basin = river ? river.basin : "";

    const feature = {type: "Feature", geometry: {type: "LineString", coordinates}, properties: {id, i, basin, name, type, width, increment}};
    json.features.push(feature);
  });

  const name = getFileName("Rivers") + ".geojson";
  downloadFile(JSON.stringify(json), name, "application/json");
}

function saveGeoJSON_Markers() {
  const json = {type: "FeatureCollection", features: []};

  markers.selectAll("use").each(function() {
    const coordinates = getQGIScoordinates(this.dataset.x, this.dataset.y);
    const id = this.id;
    const type = (this.dataset.id).substring(1);
    const icon = document.getElementById(type).textContent;
    const note = notes.length ? notes.find(note => note.id === this.id) : null;
    const name = note ? note.name : "";
    const legend = note ? note.legend : "";

    const feature = {type: "Feature", geometry: {type: "Point", coordinates}, properties: {id, type, icon, name, legend}};
    json.features.push(feature);
  });

  const name = getFileName("Markers") + ".geojson";
  downloadFile(JSON.stringify(json), name, "application/json");
}

function getCellCoordinates(vertices) {
  const p = pack.vertices.p;
  const coordinates = vertices.map(n => getQGIScoordinates(p[n][0], p[n][1]));
  return [coordinates.concat([coordinates[0]])];
}

function getRoutePoints(node) {
  let points = [];
  const l = node.getTotalLength();
  const increment = l / Math.ceil(l / 2);
  for (let i=0; i <= l; i += increment) {
    const p = node.getPointAtLength(i);
    points.push(getQGIScoordinates(p.x, p.y));
  }
  return points;
}

function getRiverPoints(node) {
  let points = [];
  const l = node.getTotalLength() / 2; // half-length
  const increment = 0.25; // defines density of points
  for (let i=l, c=i; i >= 0; i -= increment, c += increment) {
    const p1 = node.getPointAtLength(i);
    const p2 = node.getPointAtLength(c);
    const [x, y] = getQGIScoordinates((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
    points.push([x,y]);
  }
  return points;
}

async function quickSave() {
  if (customization) {tip("Map cannot be saved when edit mode is active, please exit the mode and retry", false, "error"); return;}
  const blob = await getMapData();
  if (blob) ldb.set("lastMap", blob); // auto-save map
  tip("Map is saved to browser memory. Please also save as .map file to secure progress", true, "success", 2000);
}

function quickLoad() {
  ldb.get("lastMap", blob => {
    if (blob) {
      loadMapPrompt(blob);
    } else {
      tip("No map stored. Save map to storage first", true, "error", 2000);
      ERROR && console.error("No map stored");
    }
  });
}

function loadMapPrompt(blob) {
  const workingTime = (Date.now() - last(mapHistory).created) / 60000; // minutes
  if (workingTime < 5) {loadLastSavedMap(); return;}

  alertMessage.innerHTML = `Are you sure you want to load saved map?<br>
  All unsaved changes made to the current map will be lost`;
  $("#alert").dialog({resizable: false, title: "Load saved map",
    buttons: {
      Cancel: function() {$(this).dialog("close");},
      Load: function() {loadLastSavedMap(); $(this).dialog("close");}
    }
  });

  function loadLastSavedMap() {
    WARN && console.warn("Load last saved map");
    try {
      uploadMap(blob);
    }
    catch(error) {
      ERROR && console.error(error);
      tip("Cannot load last saved map", true, "error", 2000);
    }
  }
}

const saveReminder = function() {
  if (localStorage.getItem("noReminder")) return;
  const message = ["Please don't forget to save your work as a .map file",
    "Please remember to save work as a .map file",
    "Saving in .map format will ensure your data won't be lost in case of issues",
    "Safety is number one priority. Please save the map",
    "Don't forget to save your map on a regular basis!",
    "Just a gentle reminder for you to save the map",
    "Please don't forget to save your progress (saving as .map is the best option)",
    "Don't want to be reminded about need to save? Press CTRL+Q"];

  saveReminder.reminder = setInterval(() => {
    if (customization) return;
    tip(ra(message), true, "warn", 2500);
  }, 1e6);
  saveReminder.status = 1;
}

saveReminder();

function toggleSaveReminder() {
  if (saveReminder.status) {
    tip("Save reminder is turned off. Press CTRL+Q again to re-initiate", true, "warn", 2000);
    clearInterval(saveReminder.reminder);
    localStorage.setItem("noReminder", true);
    saveReminder.status = 0;
  } else {
    tip("Save reminder is turned on. Press CTRL+Q to turn off", true, "warn", 2000);
    localStorage.removeItem("noReminder");
    saveReminder();
  }
}

function uploadMap(file, callback) {
  uploadMap.timeStart = performance.now();

  const fileReader = new FileReader();
  fileReader.onload = function(fileLoadedEvent) {
    if (callback) callback();
    document.getElementById("coas").innerHTML = ""; // remove auto-generated emblems

    const dataLoaded = fileLoadedEvent.target.result;
    const data = dataLoaded.split("\r\n");

    const mapVersion = data[0].split("|")[0] || data[0];
    if (mapVersion === version) {parseLoadedData(data); return;}

    const archive = link("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog", "archived version");
    const parsed = parseFloat(mapVersion);
    let message = "", load = false;
    if (isNaN(parsed) || data.length < 26 || !data[5]) {
      message = `The file you are trying to load is outdated or not a valid .map file.
                <br>Please try to open it using an ${archive}`;
    } else if (parsed < 0.7) {
      message = `The map version you are trying to load (${mapVersion}) is too old and cannot be updated to the current version.
                <br>Please keep using an ${archive}`;
    } else {
      load = true;
      message =  `The map version (${mapVersion}) does not match the Generator version (${version}).
                 <br>Click OK to get map <b>auto-updated</b>. In case of issues please keep using an ${archive} of the Generator`;
    }
    alertMessage.innerHTML = message;
    $("#alert").dialog({title: "Version conflict", width: "38em", buttons: {
      OK: function() {$(this).dialog("close"); if (load) parseLoadedData(data);}
    }});
  };

  fileReader.readAsText(file, "UTF-8");
}

function parseLoadedData(data) {
  try {
    // exit customization
    if (window.closeDialogs) closeDialogs();
    customization = 0;
    if (customizationMenu.offsetParent) styleTab.click();

    const reliefIcons = document.getElementById("defs-relief").innerHTML; // save relief icons
    const hatching = document.getElementById("hatching").cloneNode(true); // save hatching

    void function parseParameters() {
      const params = data[0].split("|");
      if (params[3]) {seed = params[3]; optionsSeed.value = seed;}
      if (params[4]) graphWidth = +params[4];
      if (params[5]) graphHeight = +params[5];
      mapId = params[6] ? +params[6] : Date.now();
    }()

    INFO && console.group("Loaded Map " + seed);

    void function parseSettings() {
      const settings = data[1].split("|");
      if (settings[0]) applyOption(distanceUnitInput, settings[0]);
      if (settings[1]) distanceScaleInput.value = distanceScaleOutput.value = settings[1];
      if (settings[2]) areaUnit.value = settings[2];
      if (settings[3]) applyOption(heightUnit, settings[3]);
      if (settings[4]) heightExponentInput.value = heightExponentOutput.value = settings[4];
      if (settings[5]) temperatureScale.value = settings[5];
      if (settings[6]) barSize.value = barSizeOutput.value = settings[6];
      if (settings[7] !== undefined) barLabel.value = settings[7];
      if (settings[8] !== undefined) barBackOpacity.value = settings[8];
      if (settings[9]) barBackColor.value = settings[9];
      if (settings[10]) barPosX.value = settings[10];
      if (settings[11]) barPosY.value = settings[11];
      if (settings[12]) populationRate.value = populationRateOutput.value = settings[12];
      if (settings[13]) urbanization.value = urbanizationOutput.value = settings[13];
      if (settings[14]) mapSizeInput.value = mapSizeOutput.value = Math.max(Math.min(settings[14], 100), 1);
      if (settings[15]) latitudeInput.value = latitudeOutput.value = Math.max(Math.min(settings[15], 100), 0);
      if (settings[16]) temperatureEquatorInput.value = temperatureEquatorOutput.value = settings[16];
      if (settings[17]) temperaturePoleInput.value = temperaturePoleOutput.value = settings[17];
      if (settings[18]) precInput.value = precOutput.value = settings[18];
      if (settings[19]) options = JSON.parse(settings[19]);
      if (settings[20]) mapName.value = settings[20];
    }()

    void function parseConfiguration() {
      if (data[2]) mapCoordinates = JSON.parse(data[2]);
      if (data[4]) notes = JSON.parse(data[4]);
      if (data[33]) rulers.fromString(data[33]);

      const biomes = data[3].split("|");
      biomesData = applyDefaultBiomesSystem();
      biomesData.color = biomes[0].split(",");
      biomesData.habitability = biomes[1].split(",").map(h => +h);
      biomesData.name = biomes[2].split(",");

      // push custom biomes if any
      for (let i=biomesData.i.length; i < biomesData.name.length; i++) {
        biomesData.i.push(biomesData.i.length);
        biomesData.iconsDensity.push(0);
        biomesData.icons.push([]);
        biomesData.cost.push(50);
      }
    }()

    void function replaceSVG() {
      svg.remove();
      document.body.insertAdjacentHTML("afterbegin", data[5]);
    }()

    void function redefineElements() {
      svg = d3.select("#map");
      defs = svg.select("#deftemp");
      viewbox = svg.select("#viewbox");
      scaleBar = svg.select("#scaleBar");
      legend = svg.select("#legend");
      ocean = viewbox.select("#ocean");
      oceanLayers = ocean.select("#oceanLayers");
      oceanPattern = ocean.select("#oceanPattern");
      lakes = viewbox.select("#lakes");
      landmass = viewbox.select("#landmass");
      texture = viewbox.select("#texture");
      terrs = viewbox.select("#terrs");
      biomes = viewbox.select("#biomes");
      ice = viewbox.select("#ice");
      cells = viewbox.select("#cells");
      gridOverlay = viewbox.select("#gridOverlay");
      coordinates = viewbox.select("#coordinates");
      compass = viewbox.select("#compass");
      rivers = viewbox.select("#rivers");
      terrain = viewbox.select("#terrain");
      relig = viewbox.select("#relig");
      cults = viewbox.select("#cults");
      regions = viewbox.select("#regions");
      statesBody = regions.select("#statesBody");
      statesHalo = regions.select("#statesHalo");
      provs = viewbox.select("#provs");
      zones = viewbox.select("#zones");
      borders = viewbox.select("#borders");
      stateBorders = borders.select("#stateBorders");
      provinceBorders = borders.select("#provinceBorders");
      routes = viewbox.select("#routes");
      roads = routes.select("#roads");
      trails = routes.select("#trails");
      searoutes = routes.select("#searoutes");
      temperature = viewbox.select("#temperature");
      coastline = viewbox.select("#coastline");
      prec = viewbox.select("#prec");
      population = viewbox.select("#population");
      emblems = viewbox.select("#emblems");
      labels = viewbox.select("#labels");
      icons = viewbox.select("#icons");
      burgIcons = icons.select("#burgIcons");
      anchors = icons.select("#anchors");
      armies = viewbox.select("#armies");
      markers = viewbox.select("#markers");
      ruler = viewbox.select("#ruler");
      fogging = viewbox.select("#fogging");
      debug = viewbox.select("#debug");
      burgLabels = labels.select("#burgLabels");
    }()

    void function parseGridData() {
      grid = JSON.parse(data[6]);
      calculateVoronoi(grid, grid.points);
      grid.cells.h = Uint8Array.from(data[7].split(","));
      grid.cells.prec = Uint8Array.from(data[8].split(","));
      grid.cells.f = Uint16Array.from(data[9].split(","));
      grid.cells.t = Int8Array.from(data[10].split(","));
      grid.cells.temp = Int8Array.from(data[11].split(","));
    }()

    void function parsePackData() {
      pack = {};
      reGraph();
      reMarkFeatures();
      pack.features = JSON.parse(data[12]);
      pack.cultures = JSON.parse(data[13]);
      pack.states = JSON.parse(data[14]);
      pack.burgs = JSON.parse(data[15]);
      pack.religions = data[29] ? JSON.parse(data[29]) : [{i: 0, name: "No religion"}];
      pack.provinces = data[30] ? JSON.parse(data[30]) : [0];
      pack.rivers = data[32] ? JSON.parse(data[32]) : [];

      const cells = pack.cells;
      cells.biome = Uint8Array.from(data[16].split(","));
      cells.burg = Uint16Array.from(data[17].split(","));
      cells.conf = Uint8Array.from(data[18].split(","));
      cells.culture = Uint16Array.from(data[19].split(","));
      cells.fl = Uint16Array.from(data[20].split(","));
      cells.pop = Float32Array.from(data[21].split(","));
      cells.r = Uint16Array.from(data[22].split(","));
      cells.road = Uint16Array.from(data[23].split(","));
      cells.s = Uint16Array.from(data[24].split(","));
      cells.state = Uint16Array.from(data[25].split(","));
      cells.religion = data[26] ? Uint16Array.from(data[26].split(",")) : new Uint16Array(cells.i.length);
      cells.province = data[27] ? Uint16Array.from(data[27].split(",")) : new Uint16Array(cells.i.length);
      cells.crossroad = data[28] ? Uint16Array.from(data[28].split(",")) : new Uint16Array(cells.i.length);

      if (data[31]) {
        const namesDL = data[31].split("/");
        namesDL.forEach((d, i) => {
          const e = d.split("|");
          if (!e.length) return;
          const b = e[5].split(",").length > 2 || !nameBases[i] ? e[5] : nameBases[i].b;
          nameBases[i] = {name:e[0], min:e[1], max:e[2], d:e[3], m:e[4], b};
        });
      }
    }()

    const notHidden = selection => selection.node() && selection.style("display") !== "none";
    const hasChildren = selection => selection.node()?.hasChildNodes();
    const hasChild = (selection, selector) => selection.node()?.querySelector(selector);
    const turnOn = el => document.getElementById(el).classList.remove("buttonoff");

    void function restoreLayersState() {
      // turn all layers off
      document.getElementById("mapLayers").querySelectorAll("li").forEach(el => el.classList.add("buttonoff"));

      // turn on active layers
      if (notHidden(texture) && hasChild(texture, "image")) turnOn("toggleTexture");
      if (hasChildren(terrs)) turnOn("toggleHeight");
      if (hasChildren(biomes)) turnOn("toggleBiomes");
      if (hasChildren(cells)) turnOn("toggleCells");
      if (hasChildren(gridOverlay)) turnOn("toggleGrid");
      if (hasChildren(coordinates)) turnOn("toggleCoordinates");
      if (notHidden(compass) && hasChild(compass, "use")) turnOn("toggleCompass");
      if (notHidden(rivers)) turnOn("toggleRivers");
      if (notHidden(terrain) && hasChildren(terrain)) turnOn("toggleRelief");
      if (hasChildren(relig)) turnOn("toggleReligions");
      if (hasChildren(cults)) turnOn("toggleCultures");
      if (hasChildren(statesBody)) turnOn("toggleStates");
      if (hasChildren(provs)) turnOn("toggleProvinces");
      if (hasChildren(zones) && notHidden(zones)) turnOn("toggleZones");
      if (notHidden(borders) && hasChild(compass, "use")) turnOn("toggleBorders");
      if (notHidden(routes) && hasChild(routes, "path")) turnOn("toggleRoutes");
      if (hasChildren(temperature)) turnOn("toggleTemp");
      if (hasChild(population, "line")) turnOn("togglePopulation");
      if (hasChildren(ice)) turnOn("toggleIce");
      if (hasChild(prec, "circle")) turnOn("togglePrec");
      if (notHidden(emblems) && hasChild(emblems, "use")) turnOn("toggleEmblems");
      if (notHidden(labels)) turnOn("toggleLabels");
      if (notHidden(icons)) turnOn("toggleIcons");
      if (hasChildren(armies) && notHidden(armies)) turnOn("toggleMilitary");
      if (hasChildren(markers) && notHidden(markers)) turnOn("toggleMarkers");
      if (notHidden(ruler)) turnOn("toggleRulers");
      if (notHidden(scaleBar)) turnOn("toggleScaleBar");

      getCurrentPreset();
    }()

    void function restoreEvents() {
      scaleBar.on("mousemove", () => tip("Click to open Units Editor")).on("click", () => editUnits());
      legend.on("mousemove", () => tip("Drag to change the position. Click to hide the legend")).on("click", () => clearLegend());
    }()

    void function resolveVersionConflicts() {
      const version = parseFloat(data[0].split("|")[0]);
      if (version < 0.9) {
        // 0.9 has additional relief icons to be included into older maps
        document.getElementById("defs-relief").innerHTML = reliefIcons;
      }

      if (version < 1) {
        // 1.0 adds a new religions layer
        relig = viewbox.insert("g", "#terrain").attr("id", "relig");
        Religions.generate();

        // 1.0 adds a legend box
        legend = svg.append("g").attr("id", "legend");
        legend.attr("font-family", "Almendra SC").attr("data-font", "Almendra+SC")
          .attr("font-size", 13).attr("data-size", 13).attr("data-x", 99).attr("data-y", 93)
          .attr("stroke-width", 2.5).attr("stroke", "#812929").attr("stroke-dasharray", "0 4 10 4").attr("stroke-linecap", "round");

        // 1.0 separated drawBorders fron drawStates()
        stateBorders = borders.append("g").attr("id", "stateBorders");
        provinceBorders = borders.append("g").attr("id", "provinceBorders");
        borders.attr("opacity", null).attr("stroke", null).attr("stroke-width", null).attr("stroke-dasharray", null).attr("stroke-linecap", null).attr("filter", null);
        stateBorders.attr("opacity", .8).attr("stroke", "#56566d").attr("stroke-width", 1).attr("stroke-dasharray", "2").attr("stroke-linecap", "butt");
        provinceBorders.attr("opacity", .8).attr("stroke", "#56566d").attr("stroke-width", .5).attr("stroke-dasharray", "1").attr("stroke-linecap", "butt");

        // 1.0 adds state relations, provinces, forms and full names
        provs = viewbox.insert("g", "#borders").attr("id", "provs").attr("opacity", .6);
        BurgsAndStates.collectStatistics();
        BurgsAndStates.generateCampaigns();
        BurgsAndStates.generateDiplomacy();
        BurgsAndStates.defineStateForms();
        drawStates();
        BurgsAndStates.generateProvinces();
        drawBorders();
        if (!layerIsOn("toggleBorders")) $('#borders').fadeOut();
        if (!layerIsOn("toggleStates")) regions.attr("display", "none").selectAll("path").remove();

        // 1.0 adds hatching
        document.getElementsByTagName("defs")[0].appendChild(hatching);

        // 1.0 adds zones layer
        zones = viewbox.insert("g", "#borders").attr("id", "zones").attr("display", "none");
        zones.attr("opacity", .6).attr("stroke", null).attr("stroke-width", 0).attr("stroke-dasharray", null).attr("stroke-linecap", "butt");
        addZones();
        if (!markers.selectAll("*").size()) {addMarkers(); turnButtonOn("toggleMarkers");}

        // 1.0 add fogging layer (state focus)
        fogging = viewbox.insert("g", "#ruler").attr("id", "fogging-cont").attr("mask", "url(#fog)").append("g").attr("id", "fogging").style("display", "none");
        fogging.append("rect").attr("x", 0).attr("y", 0).attr("width", "100%").attr("height", "100%");
        defs.append("mask").attr("id", "fog").append("rect").attr("x", 0).attr("y", 0).attr("width", "100%").attr("height", "100%").attr("fill", "white");

        // 1.0 changes states opacity bask to regions level
        if (statesBody.attr("opacity")) {
          regions.attr("opacity", statesBody.attr("opacity"));
          statesBody.attr("opacity", null);
        }

        // 1.0 changed labels to multi-lined
        labels.selectAll("textPath").each(function() {
          const text = this.textContent;
          const shift = this.getComputedTextLength() / -1.5;
          this.innerHTML = `<tspan x="${shift}">${text}</tspan>`;
        });

        // 1.0 added new biome - Wetland
        biomesData.name.push("Wetland");
        biomesData.color.push("#0b9131");
        biomesData.habitability.push(12);
      }

      if (version < 1.1) {
        // v 1.0 initial code had a bug with religion layer id
        if (!relig.size()) relig = viewbox.insert("g", "#terrain").attr("id", "relig");

        // v 1.0 initially has Sympathy status then relaced with Friendly
        for (const s of pack.states) {
          if (!s.diplomacy) continue;
          s.diplomacy = s.diplomacy.map(r => r === "Sympathy" ? "Friendly" : r);
        }

        // labels should be toggled via style attribute, so remove display attribute
        labels.attr("display", null);

        // v 1.0 added religions heirarchy tree
        if (pack.religions[1] && !pack.religions[1].code) {
          pack.religions.filter(r => r.i).forEach(r => {
            r.origin = 0;
            r.code = r.name.slice(0, 2);
          });
        }

        if (!document.getElementById("freshwater")) {
          lakes.append("g").attr("id", "freshwater");
          lakes.select("#freshwater").attr("opacity", .5).attr("fill", "#a6c1fd").attr("stroke", "#5f799d").attr("stroke-width", .7).attr("filter", null);
        }

        if (!document.getElementById("salt")) {
          lakes.append("g").attr("id", "salt");
          lakes.select("#salt").attr("opacity", .5).attr("fill", "#409b8a").attr("stroke", "#388985").attr("stroke-width", .7).attr("filter", null);
        }

        // v 1.1 added new lake and coast groups
        if (!document.getElementById("sinkhole")) {
          lakes.append("g").attr("id", "sinkhole");
          lakes.append("g").attr("id", "frozen");
          lakes.append("g").attr("id", "lava");
          lakes.select("#sinkhole").attr("opacity", 1).attr("fill", "#5bc9fd").attr("stroke", "#53a3b0").attr("stroke-width", .7).attr("filter", null);
          lakes.select("#frozen").attr("opacity", .95).attr("fill", "#cdd4e7").attr("stroke", "#cfe0eb").attr("stroke-width", 0).attr("filter", null);
          lakes.select("#lava").attr("opacity", .7).attr("fill", "#90270d").attr("stroke", "#f93e0c").attr("stroke-width", 2).attr("filter", "url(#crumpled)");

          coastline.append("g").attr("id", "sea_island");
          coastline.append("g").attr("id", "lake_island");
          coastline.select("#sea_island").attr("opacity", .5).attr("stroke", "#1f3846").attr("stroke-width", .7).attr("filter", "url(#dropShadow)");
          coastline.select("#lake_island").attr("opacity", 1).attr("stroke", "#7c8eaf").attr("stroke-width", .35).attr("filter", null);
        }

        // v 1.1 features stores more data
        defs.select("#land").selectAll("path").remove();
        defs.select("#water").selectAll("path").remove();
        coastline.selectAll("path").remove();
        lakes.selectAll("path").remove();
        drawCoastline();
      }

      if (version < 1.11) {
        // v 1.11 added new attributes
        terrs.attr("scheme", "bright").attr("terracing", 0).attr("skip", 5).attr("relax", 0).attr("curve", 0);
        svg.select("#oceanic > *").attr("id", "oceanicPattern");
        oceanLayers.attr("layers", "-6,-3,-1");
        gridOverlay.attr("type", "pointyHex").attr("size", 10);

        // v 1.11 added cultures heirarchy tree
        if (pack.cultures[1] && !pack.cultures[1].code) {
          pack.cultures.filter(c => c.i).forEach(c => {
            c.origin = 0;
            c.code = c.name.slice(0, 2);
          });
        }

        // v 1.11 had an issue with fogging being displayed on load
        unfog();

        // v 1.2 added new terrain attributes
        if (!terrain.attr("set")) terrain.attr("set", "simple");
        if (!terrain.attr("size")) terrain.attr("size", 1);
        if (!terrain.attr("density")) terrain.attr("density", .4);
      }

      if (version < 1.21) {
        // v 1.11 replaced "display" attribute by "display" style
        viewbox.selectAll("g").each(function() {
          if (this.hasAttribute("display")) {
            this.removeAttribute("display");
            this.style.display = "none";
          }
        });

        // v 1.21 added rivers data to pack
        pack.rivers = []; // rivers data
        rivers.selectAll("path").each(function() {
          const i = +this.id.slice(5);
          const length = this.getTotalLength() / 2;
          const s = this.getPointAtLength(length), e = this.getPointAtLength(0);
          const source = findCell(s.x, s.y), mouth = findCell(e.x, e.y);
          const name = Rivers.getName(mouth);
          const type = length < 25 ? rw({"Creek":9, "River":3, "Brook":3, "Stream":1}) : "River";
          pack.rivers.push({i, parent:0, length, source, mouth, basin:i, name, type});
        });

      }

      if (version < 1.22) {
        // v 1.22 changed state neighbors from Set object to array
        BurgsAndStates.collectStatistics();
      }

      if (version < 1.3) {
        // v 1.3 added global options object
        const winds = options.slice(); // previostly wind was saved in settings[19]
        const year = rand(100, 2000);
        const era = Names.getBaseShort(P(.7) ? 1 : rand(nameBases.length)) + " Era";
        const eraShort = era[0] + "E";
        const military = Military.getDefaultOptions();
        options = {winds, year, era, eraShort, military};

        // v 1.3 added campaings data for all states
        BurgsAndStates.generateCampaigns();

        // v 1.3 added militry layer
        armies = viewbox.insert("g", "#icons").attr("id", "armies");
        armies.attr("opacity", 1).attr("fill-opacity", 1).attr("font-size", 6).attr("box-size", 3).attr("stroke", "#000").attr("stroke-width", .3);
        turnButtonOn("toggleMilitary");
        Military.generate();
      }

      if (version < 1.4) {
        // v 1.35 added dry lakes
        if (!lakes.select("#dry").size()) {
          lakes.append("g").attr("id", "dry");
          lakes.select("#dry").attr("opacity", 1).attr("fill", "#c9bfa7").attr("stroke", "#8e816f").attr("stroke-width", .7).attr("filter", null);
        }

        // v 1.4 added ice layer
        ice = viewbox.insert("g", "#coastline").attr("id", "ice").style("display", "none");
        ice.attr("opacity", null).attr("fill", "#e8f0f6").attr("stroke", "#e8f0f6").attr("stroke-width", 1).attr("filter", "url(#dropShadow05)");
        drawIce();

        // v 1.4 added icon and power attributes for units
        for (const unit of options.military) {
          if (!unit.icon) unit.icon = getUnitIcon(unit.type);
          if (!unit.power) unit.power = unit.crew;
        }

        function getUnitIcon(type) {
          if (type === "naval") return "🌊";
          if (type === "ranged") return "🏹";
          if (type === "mounted") return "🐴";
          if (type === "machinery") return "💣";
          if (type === "armored") return "🐢";
          if (type === "aviation") return "🦅";
          if (type === "magical") return "🔮";
          else return "⚔️";
        }

        // 1.4 added state reference for regiments
        pack.states.filter(s => s.military).forEach(s => s.military.forEach(r => r.state = s.i));
      }

      if (version < 1.5) {
        // not need to store default styles from v 1.5
        localStorage.removeItem("styleClean");
        localStorage.removeItem("styleGloom");
        localStorage.removeItem("styleAncient");
        localStorage.removeItem("styleMonochrome");

        // v 1.5 cultures has shield attribute
        pack.cultures.forEach(culture => {
          if (culture.removed) return;
          culture.shield = Cultures.getRandomShield();
        });

        // v 1.5 added burg type value
        pack.burgs.forEach(burg => {
          if (!burg.i || burg.removed) return;
          burg.type = BurgsAndStates.getType(burg.cell, burg.port);
        });

        // v 1.5 added emblems
        defs.append("g").attr("id", "defs-emblems");
        emblems = viewbox.insert("g", "#population").attr("id", "emblems").style("display", "none");
        emblems.append("g").attr("id", "burgEmblems");
        emblems.append("g").attr("id", "provinceEmblems");
        emblems.append("g").attr("id", "stateEmblems");
        regenerateEmblems();
        toggleEmblems();

        // v 1.5 changed releif icons data
        terrain.selectAll("use").each(function() {
          const type = this.getAttribute("data-type") || this.getAttribute("xlink:href");
          this.removeAttribute("xlink:href");
          this.removeAttribute("data-type");
          this.removeAttribute("data-size");
          this.setAttribute("href", type);
        });
      }

      if (version < 1.6) {
        // v 1.6 changed rivers data
        for (const river of pack.rivers) {
          const el = document.getElementById("river"+river.i);
          if (el) {
            river.widthFactor = +el.getAttribute("data-width");
            el.removeAttribute("data-width");
            el.removeAttribute("data-increment");
            river.discharge = pack.cells.fl[river.mouth] || 1;
            river.width = rn(river.length / 100, 2);
            river.sourceWidth = .1;
          } else {
            Rivers.remove(river.i);
          }
        }

        // v 1.6 changed lakes data
        for (const f of pack.features) {
          if (f.type !== "lake") continue;
          if (f.evaporation) continue;

          f.flux = f.flux || f.cells * 3;
          f.temp = grid.cells.temp[pack.cells.g[f.firstCell]];
          f.height = f.height || d3.min(pack.cells.c[f.firstCell].map(c => pack.cells.h[c]).filter(h => h >= 20));
          const height = (f.height - 18) ** heightExponentInput.value;
          const evaporation = (700 * (f.temp + .006 * height) / 50 + 75) / (80 - f.temp);
          f.evaporation = rn(evaporation * f.cells);
          f.name = f.name || Lakes.getName(f);
          delete f.river;
        }
      }

      if (version < 1.61) {
        // v 1.61 changed rulers data
        ruler.style("display", null);
        rulers = new Rulers();

        ruler.selectAll(".ruler > .white").each(function() {
          const x1 = +this.getAttribute("x1");
          const y1 = +this.getAttribute("y1");
          const x2 = +this.getAttribute("x2");
          const y2 = +this.getAttribute("y2");
          if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return;
          const points = [[x1, y1], [x2, y2]];
          rulers.create(Ruler, points);
        });

        ruler.selectAll("g.opisometer").each(function() {
          const pointsString = this.dataset.points;
          if (!pointsString) return;
          const points = JSON.parse(pointsString);
          rulers.create(Opisometer, points);
        });

        ruler.selectAll("path.planimeter").each(function() {
          const length = this.getTotalLength();
          if (length < 30) return;

          const step = length > 1000 ? 40 : length > 400 ? 20 : 10;
          const increment = length / Math.ceil(length / step);
          const points = [];
          for (let i=0; i <= length; i += increment) {
            const point = this.getPointAtLength(i);
            points.push([point.x | 0, point.y | 0]);
          }

          rulers.create(Planimeter, points);
        });

        ruler.selectAll("*").remove();

        if (rulers.data.length) {
          turnButtonOn("toggleRulers");
          rulers.draw();
        } else turnButtonOff("toggleRulers");

        // 1.61 changed oceanicPattern from rect to image
        const pattern = document.getElementById("oceanic");
        const filter = pattern.firstElementChild.getAttribute("filter");
        const href = filter ? "./images/" + filter.replace("url(#", "").replace(")", "") + ".png" : "";
        pattern.innerHTML = `<image id="oceanicPattern" href=${href} width="100" height="100" opacity=".2"></image>`;
      }
    }()

    void function checkDataIntegrity() {
      const cells = pack.cells;

      const invalidStates = [...new Set(cells.state)].filter(s => !pack.states[s] || pack.states[s].removed);
      invalidStates.forEach(s => {
        const invalidCells = cells.i.filter(i => cells.state[i] === s);
        invalidCells.forEach(i => cells.state[i] = 0);
        ERROR && console.error("Data Integrity Check. Invalid state", s, "is assigned to cells", invalidCells);
      });

      const invalidProvinces = [...new Set(cells.province)].filter(p => p && (!pack.provinces[p] || pack.provinces[p].removed));
      invalidProvinces.forEach(p => {
        const invalidCells = cells.i.filter(i => cells.province[i] === p);
        invalidCells.forEach(i => cells.province[i] = 0);
        ERROR && console.error("Data Integrity Check. Invalid province", p, "is assigned to cells", invalidCells);
      });

      const invalidCultures = [...new Set(cells.culture)].filter(c => !pack.cultures[c] || pack.cultures[c].removed);
      invalidCultures.forEach(c => {
        const invalidCells = cells.i.filter(i => cells.culture[i] === c);
        invalidCells.forEach(i => cells.province[i] = 0);
        ERROR && console.error("Data Integrity Check. Invalid culture", c, "is assigned to cells", invalidCells);
      });

      const invalidReligions = [...new Set(cells.religion)].filter(r => !pack.religions[r] || pack.religions[r].removed);
      invalidReligions.forEach(r => {
        const invalidCells = cells.i.filter(i => cells.religion[i] === r);
        invalidCells.forEach(i => cells.religion[i] = 0);
        ERROR && console.error("Data Integrity Check. Invalid religion", c, "is assigned to cells", invalidCells);
      });

      const invalidFeatures = [...new Set(cells.f)].filter(f => f && !pack.features[f]);
      invalidFeatures.forEach(f => {
        const invalidCells = cells.i.filter(i => cells.f[i] === f);
        // No fix as for now
        ERROR && console.error("Data Integrity Check. Invalid feature", f, "is assigned to cells", invalidCells);
      });

      const invalidBurgs = [...new Set(cells.burg)].filter(b => b && (!pack.burgs[b] || pack.burgs[b].removed));
      invalidBurgs.forEach(b => {
        const invalidCells = cells.i.filter(i => cells.burg[i] === b);
        invalidCells.forEach(i => cells.burg[i] = 0);
        ERROR && console.error("Data Integrity Check. Invalid burg", b, "is assigned to cells", invalidCells);
      });

      const invalidRivers = [...new Set(cells.r)].filter(r => r && !pack.rivers.find(river => river.i === r));
      invalidRivers.forEach(r => {
        const invalidCells = cells.i.filter(i => cells.r[i] === r);
        invalidCells.forEach(i => cells.r[i] = 0);
        rivers.select("river"+r).remove();
        ERROR && console.error("Data Integrity Check. Invalid river", r, "is assigned to cells", invalidCells);
      });

      pack.burgs.forEach(b => {
        if (!b.i || b.removed) return;
        if (b.port < 0) {ERROR && console.error("Data Integrity Check. Burg", b.i, "has invalid port value", b.port); b.port = 0;}

        if (b.cell >= cells.i.length) {
          ERROR && console.error("Data Integrity Check. Burg", b.i, "is linked to invalid cell", b.cell);
          b.cell = findCell(b.x, b.y);
          cells.i.filter(i => cells.burg[i] === b.i).forEach(i => cells.burg[i] = 0);
          cells.burg[b.cell] = b.i;
        }

        if (b.state && !pack.states[b.state]) {
          ERROR && console.error("Data Integrity Check. Burg", b.i, "is linked to invalid state", b.state);
          b.state = 0;
        }
      });

      pack.provinces.forEach(p => {
        if (!p.i || p.removed) return;
        if (pack.states[p.state] && !pack.states[p.state].removed) return;
        ERROR && console.error("Data Integrity Check. Province", p.i, "is linked to removed state", p.state);
        p.removed = true; // remove incorrect province
      });
    }()

    changeMapSize();

    // remove href from emblems, to trigger rendering on load
    emblems.selectAll("use").attr("href", null);

    // draw data layers (no kept in svg)
    if (rulers && layerIsOn("toggleRulers")) rulers.draw();

    // set options
    yearInput.value = options.year;
    eraInput.value = options.era;

    if (window.restoreDefaultEvents) restoreDefaultEvents();
    focusOn(); // based on searchParams focus on point, cell or burg
    invokeActiveZooming();

    WARN && console.warn(`TOTAL: ${rn((performance.now()-uploadMap.timeStart)/1000,2)}s`);
    showStatistics();
    INFO && console.groupEnd("Loaded Map " + seed);
    tip("Map is successfully loaded", true, "success", 7000);
  }
  catch(error) {
    ERROR && console.error(error);
    clearMainTip();

    alertMessage.innerHTML = `An error is occured on map loading. Select a different file to load,
      <br>generate a new random map or cancel the loading
      <p id="errorBox">${parseError(error)}</p>`;
    $("#alert").dialog({
      resizable: false, title: "Loading error", maxWidth:"50em", buttons: {
        "Select file": function() {$(this).dialog("close"); mapToLoad.click();},
        "New map": function() {$(this).dialog("close"); regenerateMap();},
        Cancel: function() {$(this).dialog("close")}
      }, position: {my: "center", at: "center", of: "svg"}
    });
  }

}
