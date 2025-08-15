"use strict";
// Functions to export map to image or data files

async function exportToSvg() {
  TIME && console.time("exportToSvg");
  const url = await getMapURL("svg", {fullMap: true});
  const link = document.createElement("a");
  link.download = getFileName() + ".svg";
  link.href = url;
  link.click();

  const message = `${link.download} is saved. Open 'Downloads' screen (ctrl + J) to check`;
  tip(message, true, "success", 5000);
  TIME && console.timeEnd("exportToSvg");
}

async function exportToPng() {
  TIME && console.time("exportToPng");
  const url = await getMapURL("png");

  const link = document.createElement("a");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = svgWidth * pngResolutionInput.value;
  canvas.height = svgHeight * pngResolutionInput.value;
  const img = new Image();
  img.src = url;

  img.onload = function () {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    link.download = getFileName() + ".png";
    canvas.toBlob(function (blob) {
      link.href = window.URL.createObjectURL(blob);
      link.click();
      window.setTimeout(function () {
        canvas.remove();
        window.URL.revokeObjectURL(link.href);

        const message = `${link.download} is saved. Open 'Downloads' screen (ctrl + J) to check. You can set image scale in options`;
        tip(message, true, "success", 5000);
      }, 1000);
    });
  };

  TIME && console.timeEnd("exportToPng");
}

async function exportToJpeg() {
  TIME && console.time("exportToJpeg");
  const url = await getMapURL("png");

  const canvas = document.createElement("canvas");
  canvas.width = svgWidth * pngResolutionInput.value;
  canvas.height = svgHeight * pngResolutionInput.value;
  const img = new Image();
  img.src = url;

  img.onload = async function () {
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const quality = Math.min(rn(1 - pngResolutionInput.value / 20, 2), 0.92);
    const URL = await canvas.toDataURL("image/jpeg", quality);
    const link = document.createElement("a");
    link.download = getFileName() + ".jpeg";
    link.href = URL;
    link.click();
    tip(`${link.download} is saved. Open "Downloads" screen (CTRL + J) to check`, true, "success", 7000);
    window.setTimeout(() => window.URL.revokeObjectURL(URL), 5000);
  };

  TIME && console.timeEnd("exportToJpeg");
}

async function exportToPngTiles() {
  const status = byId("tileStatus");
  status.innerHTML = "Preparing files...";

  const urlSchema = await getMapURL("tiles", {debug: true, fullMap: true});
  await import("../../libs/jszip.min.js");
  const zip = new window.JSZip();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = graphWidth;
  canvas.height = graphHeight;

  const imgSchema = new Image();
  imgSchema.src = urlSchema;
  await loadImage(imgSchema);

  status.innerHTML = "Rendering schema...";
  ctx.drawImage(imgSchema, 0, 0, canvas.width, canvas.height);
  const blob = await canvasToBlob(canvas, "image/png");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  zip.file("schema.png", blob);

  // download tiles
  const url = await getMapURL("tiles", {fullMap: true});
  const tilesX = +byId("tileColsOutput").value || 2;
  const tilesY = +byId("tileRowsOutput").value || 2;
  const scale = +byId("tileScaleOutput").value || 1;
  const tolesTotal = tilesX * tilesY;

  const tileW = (graphWidth / tilesX) | 0;
  const tileH = (graphHeight / tilesY) | 0;

  const width = graphWidth * scale;
  const height = width * (tileH / tileW);
  canvas.width = width;
  canvas.height = height;

  const img = new Image();
  img.src = url;
  await loadImage(img);

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function getRowLabel(row) {
    const first = row >= alphabet.length ? alphabet[Math.floor(row / alphabet.length) - 1] : "";
    const last = alphabet[row % alphabet.length];
    return first + last;
  }

  for (let y = 0, row = 0, id = 1; y + tileH <= graphHeight; y += tileH, row++) {
    const rowName = getRowLabel(row);

    for (let x = 0, cell = 1; x + tileW <= graphWidth; x += tileW, cell++, id++) {
      status.innerHTML = `Rendering tile ${rowName}${cell} (${id} of ${tolesTotal})...`;
      ctx.drawImage(img, x, y, tileW, tileH, 0, 0, width, height);
      const blob = await canvasToBlob(canvas, "image/png");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      zip.file(`${rowName}${cell}.png`, blob);
    }
  }

  status.innerHTML = "Zipping files...";
  zip.generateAsync({type: "blob"}).then(blob => {
    status.innerHTML = "Downloading the archive...";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = getFileName() + ".zip";
    link.click();
    link.remove();

    status.innerHTML = 'Done. Check .zip file in "Downloads" (crtl + J)';
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  });

  // promisified img.onload
  function loadImage(img) {
    return new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = err => reject(err);
    });
  }

  // promisified canvas.toBlob
  function canvasToBlob(canvas, mimeType, qualityArgument = 1) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob() error"));
        },
        mimeType,
        qualityArgument
      );
    });
  }
}

// parse map svg to object url
async function getMapURL(type, options) {
  const {
    debug = false,
    noLabels = false,
    noWater = false,
    noScaleBar = false,
    noIce = false,
    noVignette = false,
    fullMap = false
  } = options || {};

  const cloneEl = byId("map").cloneNode(true); // clone svg
  cloneEl.id = "fantasyMap";
  document.body.appendChild(cloneEl);
  const clone = d3.select(cloneEl);
  if (!debug) clone.select("#debug")?.remove();

  const cloneDefs = cloneEl.getElementsByTagName("defs")[0];
  const svgDefs = byId("defElements");

  const isFirefox = navigator.userAgent.toLowerCase().indexOf("firefox") > -1;
  if (isFirefox && type === "mesh") clone.select("#oceanPattern")?.remove();
  if (noLabels) {
    clone.select("#labels #states")?.remove();
    clone.select("#labels #burgLabels")?.remove();
    clone.select("#icons #burgIcons")?.remove();
  }
  if (noWater) {
    clone.select("#oceanBase").attr("opacity", 0);
    clone.select("#oceanPattern").attr("opacity", 0);
  }
  if (noIce) clone.select("#ice")?.remove();
  if (noVignette) clone.select("#vignette")?.remove();
  if (fullMap) {
    // reset transform to show the whole map
    clone.attr("width", graphWidth).attr("height", graphHeight);
    clone.select("#viewbox").attr("transform", null);

    if (!noScaleBar) {
      drawScaleBar(clone.select("#scaleBar"), 1);
      fitScaleBar(clone.select("#scaleBar"), graphWidth, graphHeight);
    }
  }
  if (noScaleBar) clone.select("#scaleBar")?.remove();

  if (type === "svg") removeUnusedElements(clone);
  if (customization && type === "mesh") updateMeshCells(clone);
  inlineStyle(clone);

  // remove unused filters
  const filters = cloneEl.querySelectorAll("filter");
  for (let i = 0; i < filters.length; i++) {
    const id = filters[i].id;
    if (cloneEl.querySelector("[filter='url(#" + id + ")']")) continue;
    if (cloneEl.getAttribute("filter") === "url(#" + id + ")") continue;
    filters[i].remove();
  }

  // remove unused patterns
  const patterns = cloneEl.querySelectorAll("pattern");
  for (let i = 0; i < patterns.length; i++) {
    const id = patterns[i].id;
    if (cloneEl.querySelector("[fill='url(#" + id + ")']")) continue;
    patterns[i].remove();
  }

  // remove unused symbols
  const symbols = cloneEl.querySelectorAll("symbol");
  for (let i = 0; i < symbols.length; i++) {
    const id = symbols[i].id;
    if (cloneEl.querySelector("use[*|href='#" + id + "']")) continue;
    symbols[i].remove();
  }

  // add displayed emblems
  if (layerIsOn("toggleEmblems") && emblems.selectAll("use").size()) {
    cloneEl
      .getElementById("emblems")
      ?.querySelectorAll("use")
      .forEach(el => {
        const href = el.getAttribute("href") || el.getAttribute("xlink:href");
        if (!href) return;
        const emblem = byId(href.slice(1));
        if (emblem) cloneDefs.append(emblem.cloneNode(true));
      });
  } else {
    cloneDefs.querySelector("#defs-emblems")?.remove();
  }

  {
    // replace ocean pattern href to base64
    const image = cloneEl.getElementById("oceanicPattern");
    const href = image?.getAttribute("href");
    if (href) {
      await new Promise(resolve => {
        getBase64(href, base64 => {
          image.setAttribute("href", base64);
          resolve();
        });
      });
    }
  }

  {
    // replace texture href to base64
    const image = cloneEl.querySelector("#texture > image");
    const href = image?.getAttribute("href");
    if (href) {
      await new Promise(resolve => {
        getBase64(href, base64 => {
          image.setAttribute("href", base64);
          resolve();
        });
      });
    }
  }

  // add relief icons
  if (cloneEl.getElementById("terrain")) {
    const uniqueElements = new Set();
    const terrainNodes = cloneEl.getElementById("terrain").childNodes;
    for (let i = 0; i < terrainNodes.length; i++) {
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
    const rose = svgDefs.getElementById("defs-compass-rose");
    if (rose) cloneDefs.appendChild(rose.cloneNode(true));
  }

  // add port icon
  if (cloneEl.getElementById("anchors")) {
    const anchor = svgDefs.getElementById("icon-anchor");
    if (anchor) cloneDefs.appendChild(anchor.cloneNode(true));
  }

  // add grid pattern
  if (cloneEl.getElementById("gridOverlay")?.hasChildNodes()) {
    const type = cloneEl.getElementById("gridOverlay").getAttribute("type");
    const pattern = svgDefs.getElementById("pattern_" + type);
    if (pattern) cloneDefs.appendChild(pattern.cloneNode(true));
  }

  {
    // replace external marker icons
    const externalMarkerImages = cloneEl.querySelectorAll('#markers image[href]:not([href=""])');
    const imageHrefs = Array.from(externalMarkerImages).map(img => img.getAttribute("href"));

    for (const url of imageHrefs) {
      await new Promise(resolve => {
        getBase64(url, base64 => {
          externalMarkerImages.forEach(img => {
            if (img.getAttribute("href") === url) img.setAttribute("href", base64);
          });
          resolve();
        });
      });
    }
  }

  {
    // replace external regiment icons
    const externalRegimentImages = cloneEl.querySelectorAll('#armies image[href]:not([href=""])');
    const imageHrefs = Array.from(externalRegimentImages).map(img => img.getAttribute("href"));

    for (const url of imageHrefs) {
      await new Promise(resolve => {
        getBase64(url, base64 => {
          externalRegimentImages.forEach(img => {
            if (img.getAttribute("href") === url) img.setAttribute("href", base64);
          });
          resolve();
        });
      });
    }
  }

  if (!cloneEl.getElementById("fogging-cont")) cloneEl.getElementById("fog")?.remove(); // remove unused fog
  if (!cloneEl.getElementById("regions")) cloneEl.getElementById("statePaths")?.remove(); // removed unused statePaths
  if (!cloneEl.getElementById("labels")) cloneEl.getElementById("textPaths")?.remove(); // removed unused textPaths

  // add armies style
  if (cloneEl.getElementById("armies")) {
    cloneEl.insertAdjacentHTML(
      "afterbegin",
      "<style>#armies text {stroke: none; fill: #fff; text-shadow: 0 0 4px #000; dominant-baseline: central; text-anchor: middle; font-family: Helvetica; fill-opacity: 1;}#armies text.regimentIcon {font-size: .8em;}</style>"
    );
  }

  // add xlink: for href to support svg 1.1
  if (type === "svg") {
    cloneEl.querySelectorAll("[href]").forEach(el => {
      const href = el.getAttribute("href");
      el.removeAttribute("href");
      el.setAttribute("xlink:href", href);
    });
  }

  // add hatchings
  const hatchingUsers = cloneEl.querySelectorAll(`[fill^='url(#hatch']`);
  const hatchingFills = unique(Array.from(hatchingUsers).map(el => el.getAttribute("fill")));
  const hatchingIds = hatchingFills.map(fill => fill.slice(5, -1));
  for (const hatchingId of hatchingIds) {
    const hatching = svgDefs.getElementById(hatchingId);
    if (hatching) cloneDefs.appendChild(hatching.cloneNode(true));
  }

  // load fonts
  const usedFonts = getUsedFonts(cloneEl);
  const fontsToLoad = usedFonts.filter(font => font.src);
  if (fontsToLoad.length) {
    const dataURLfonts = await loadFontsAsDataURI(fontsToLoad);

    const fontFaces = dataURLfonts
      .map(({family, src, unicodeRange = "", variant = "normal"}) => {
        return `@font-face {font-family: "${family}"; src: ${src}; unicode-range: ${unicodeRange}; font-variant: ${variant};}`;
      })
      .join("\n");

    const style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.innerHTML = fontFaces;
    cloneEl.querySelector("defs").appendChild(style);
  }

  clone.remove();

  const serialized =
    `<?xml version="1.0" encoding="UTF-8" standalone="no"?>` + new XMLSerializer().serializeToString(cloneEl);
  const blob = new Blob([serialized], {type: "image/svg+xml;charset=utf-8"});
  const url = window.URL.createObjectURL(blob);
  window.setTimeout(() => window.URL.revokeObjectURL(url), 5000);
  return url;
}

// remove hidden g elements and g elements without children to make downloaded svg smaller in size
function removeUnusedElements(clone) {
  if (!terrain.selectAll("use").size()) clone.select("#defs-relief")?.remove();

  for (let empty = 1; empty; ) {
    empty = 0;
    clone.selectAll("g").each(function () {
      if (!this.hasChildNodes() || this.style.display === "none" || this.classList.contains("hidden")) {
        empty++;
        this.remove();
      }
      if (this.hasAttribute("display") && this.style.display === "inline") this.removeAttribute("display");
    });
  }
}

function updateMeshCells(clone) {
  const data = renderOcean.checked ? grid.cells.i : grid.cells.i.filter(i => grid.cells.h[i] >= 20);
  const scheme = getColorScheme(terrs.select("#landHeights").attr("scheme"));
  clone.select("#heights").attr("filter", "url(#blur1)");
  clone
    .select("#heights")
    .selectAll("polygon")
    .data(data)
    .join("polygon")
    .attr("points", d => getGridPolygon(d))
    .attr("id", d => "cell" + d)
    .attr("stroke", d => getColor(grid.cells.h[d], scheme));
}

// for each g element get inline style
function inlineStyle(clone) {
  const emptyG = clone.append("g").node();
  const defaultStyles = window.getComputedStyle(emptyG);

  clone.selectAll("g, #ruler *, #scaleBar > text").each(function () {
    const compStyle = window.getComputedStyle(this);
    let style = "";

    for (let i = 0; i < compStyle.length; i++) {
      const key = compStyle[i];
      const value = compStyle.getPropertyValue(key);

      if (key === "cursor") continue; // cursor should be default
      if (this.hasAttribute(key)) continue; // don't add style if there is the same attribute
      if (value === defaultStyles.getPropertyValue(key)) continue;
      style += key + ":" + value + ";";
    }

    for (const key in compStyle) {
      const value = compStyle.getPropertyValue(key);

      if (key === "cursor") continue; // cursor should be default
      if (this.hasAttribute(key)) continue; // don't add style if there is the same attribute
      if (value === defaultStyles.getPropertyValue(key)) continue;
      style += key + ":" + value + ";";
    }

    if (style != "") this.setAttribute("style", style);
  });

  emptyG.remove();
}

// Helper function to get meters per pixel based on distance unit
function getMetersPerPixel() {
  const unit = distanceUnitInput.value.toLowerCase();

  switch(unit) {
    case 'km':
      return distanceScale * 1000;
    case 'm':
    case 'meter':
    case 'meters':
      return distanceScale;
    case 'mi':
    case 'mile':
    case 'miles':
      return distanceScale * 1609.344;
    case 'yd':
    case 'yard':
    case 'yards':
      return distanceScale * 0.9144;
    case 'ft':
    case 'foot':
    case 'feet':
      return distanceScale * 0.3048;
    case 'league':
    case 'leagues':
      return distanceScale * 4828.032;
    default:
      console.warn(`Unknown distance unit: ${unit}, defaulting to km`);
      return distanceScale * 1000;
  }
}

// Convert from map pixel coordinates to fantasy world coordinates
// Using the exact same values as prepareMapData
function getFantasyCoordinates(x, y, decimals = 2) {
  // Convert distanceScale to meters based on the unit
  let pixelScaleInMeters;
  const unit = distanceUnitInput.value.toLowerCase();

  switch(unit) {
    case 'km':
      pixelScaleInMeters = distanceScale * 1000; // km to meters
      break;
    case 'm':
    case 'meter':
    case 'meters':
      pixelScaleInMeters = distanceScale; // already in meters
      break;
    case 'mi':
    case 'mile':
    case 'miles':
      pixelScaleInMeters = distanceScale * 1609.344; // miles to meters
      break;
    case 'yd':
    case 'yard':
    case 'yards':
      pixelScaleInMeters = distanceScale * 0.9144; // yards to meters
      break;
    case 'ft':
    case 'foot':
    case 'feet':
      pixelScaleInMeters = distanceScale * 0.3048; // feet to meters
      break;
    case 'league':
    case 'leagues':
      pixelScaleInMeters = distanceScale * 4828.032; // leagues (3 miles) to meters
      break;
    default:
      // Default to km if unit is not recognized
      console.warn(`Unknown distance unit: ${unit}, defaulting to km`);
      pixelScaleInMeters = distanceScale * 1000;
  }

  // Convert pixel coordinates to world coordinates in meters
  const worldX = x * pixelScaleInMeters;
  const worldY = -y * pixelScaleInMeters; // Negative because Y increases downward in pixels

  // Round to specified decimal places
  const factor = Math.pow(10, decimals);
  return [
    Math.round(worldX * factor) / factor,
    Math.round(worldY * factor) / factor
  ];
}

function saveGeoJsonCells() {
  const {cells, vertices} = pack;

  // Calculate meters per pixel based on unit
  const metersPerPixel = getMetersPerPixel();

  // Use the same global variables as prepareMapData
  const json = {
    type: "FeatureCollection",
    features: [],
    // Include metadata using the same sources as prepareMapData
    metadata: {
      generator: "Azgaar's Fantasy Map Generator",
      version: VERSION,
      mapName: mapName.value,
      mapId: mapId,
      seed: seed,
      dimensions: {
        width_px: graphWidth,
        height_px: graphHeight
      },
      scale: {
        distance: distanceScale,
        unit: distanceUnitInput.value,
        meters_per_pixel: metersPerPixel
      },
      units: {
        distance: distanceUnitInput.value,
        area: areaUnit.value,
        height: heightUnit.value,
        temperature: temperatureScale.value
      },
      bounds_meters: {
        minX: 0,
        maxX: graphWidth * metersPerPixel,
        minY: -(graphHeight * metersPerPixel),
        maxY: 0
      },
      settings: {
        populationRate: populationRate,
        urbanization: urbanization,
        urbanDensity: urbanDensity,
        growthRate: growthRate.value,
        mapSize: mapSizeOutput.value,
        latitude: latitudeOutput.value,
        longitude: longitudeOutput.value,
        precipitation: precOutput.value
      },
      crs: "Fantasy Map Cartesian (meters)",
      exportedAt: new Date().toISOString()
    }
  };

  const getPopulation = i => {
    const [r, u] = getCellPopulation(i);
    return rn(r + u);
  };

  const getHeight = i => parseInt(getFriendlyHeight([...cells.p[i]]));

  function getCellCoordinates(cellVertices) {
    const coordinates = cellVertices.map(vertex => {
      const [x, y] = vertices.p[vertex];
      return getFantasyCoordinates(x, y, 2);
    });
    return [[...coordinates, coordinates[0]]];
  }

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

    const properties = {id: i, height, biome, type, population, state, province, culture, religion, neighbors};
    const feature = {type: "Feature", geometry: {type: "Polygon", coordinates}, properties};
    json.features.push(feature);
  });

  const fileName = getFileName("Cells") + ".geojson";
  downloadFile(JSON.stringify(json), fileName, "application/json");
}

function saveGeoJsonRoutes() {
  const metersPerPixel = getMetersPerPixel();
  const features = pack.routes.map(({i, points, group, name = null, type, feature}) => {
    const coordinates = points.map(([x, y]) => getFantasyCoordinates(x, y, 2));
    return {
      type: "Feature",
      geometry: {type: "LineString", coordinates},
      properties: {id: i, group, name, type, feature}
    };
  });

  const json = {
    type: "FeatureCollection",
    features,
    metadata: {
      crs: "Fantasy Map Cartesian (meters)",
      mapName: mapName.value,
      scale: {
        distance: distanceScale,
        unit: distanceUnitInput.value,
        meters_per_pixel: metersPerPixel
      }
    }
  };

  const fileName = getFileName("Routes") + ".geojson";
  downloadFile(JSON.stringify(json), fileName, "application/json");
}

function saveGeoJsonRivers() {
  const metersPerPixel = getMetersPerPixel();
  const features = pack.rivers.map(
    ({i, cells, points, source, mouth, parent, basin, widthFactor, sourceWidth, discharge, length, width, name, type}) => {
      if (!cells || cells.length < 2) return;
      const meanderedPoints = Rivers.addMeandering(cells, points);
      const coordinates = meanderedPoints.map(([x, y]) => getFantasyCoordinates(x, y, 2));
      return {
        type: "Feature",
        geometry: {type: "LineString", coordinates},
        properties: {id: i, source, mouth, parent, basin, widthFactor, sourceWidth, discharge, length, width, name, type}
      };
    }
  ).filter(f => f); // Remove undefined entries

  const json = {
    type: "FeatureCollection",
    features,
    metadata: {
      crs: "Fantasy Map Cartesian (meters)",
      mapName: mapName.value,
      scale: {
        distance: distanceScale,
        unit: distanceUnitInput.value,
        meters_per_pixel: metersPerPixel
      }
    }
  };

  const fileName = getFileName("Rivers") + ".geojson";
  downloadFile(JSON.stringify(json), fileName, "application/json");
}

function saveGeoJsonMarkers() {
  const metersPerPixel = getMetersPerPixel();
  const features = pack.markers.map(marker => {
    const {i, type, icon, x, y, size, fill, stroke} = marker;
    const coordinates = getFantasyCoordinates(x, y, 2);
    // Find the associated note if it exists
    const note = notes.find(note => note.id === `marker${i}`);
    const properties = {
      id: i,
      type,
      icon,
      x_px: x,
      y_px: y,
      size,
      fill,
      stroke,
      ...(note && {note: note.legend}) // Add note text if it exists
    };
    return {type: "Feature", geometry: {type: "Point", coordinates}, properties};
  });

  const json = {
    type: "FeatureCollection",
    features,
    metadata: {
      crs: "Fantasy Map Cartesian (meters)",
      mapName: mapName.value,
      scale: {
        distance: distanceScale,
        unit: distanceUnitInput.value,
        meters_per_pixel: metersPerPixel
      }
    }
  };

  const fileName = getFileName("Markers") + ".geojson";
  downloadFile(JSON.stringify(json), fileName, "application/json");
}

function saveGeoJsonBurgs() {
  const metersPerPixel = getMetersPerPixel();
  const valid = pack.burgs.filter(b => b.i && !b.removed);
  
  const features = valid.map(b => {
    const coordinates = getFantasyCoordinates(b.x, b.y, 2);
    const province = pack.cells.province[b.cell];
    const temperature = grid.cells.temp[pack.cells.g[b.cell]];
    
    // Calculate world coordinates same as CSV export
    const xWorld = b.x * metersPerPixel;
    const yWorld = -b.y * metersPerPixel;
    
    return {
      type: "Feature",
      geometry: {type: "Point", coordinates},
      properties: {
        id: b.i,
        name: b.name,
        province: province ? pack.provinces[province].name : null,
        provinceFull: province ? pack.provinces[province].fullName : null,
        state: pack.states[b.state].name,
        stateFull: pack.states[b.state].fullName,
        culture: pack.cultures[b.culture].name,
        religion: pack.religions[pack.cells.religion[b.cell]].name,
        population: rn(b.population * populationRate * urbanization),
        populationRaw: b.population,
        xWorld: rn(xWorld, 2),
        yWorld: rn(yWorld, 2),
        xPixel: b.x,
        yPixel: b.y,
        elevation: parseInt(getHeight(pack.cells.h[b.cell])),
        temperature: convertTemperature(temperature),
        temperatureLikeness: getTemperatureLikeness(temperature),
        capital: !!b.capital,
        port: !!b.port,
        citadel: !!b.citadel,
        walls: !!b.walls,
        plaza: !!b.plaza,
        temple: !!b.temple,
        shanty: !!b.shanty,
        emblem: b.coa || null,
        cell: b.cell
      }
    };
  });

  const json = {
    type: "FeatureCollection",
    features,
    metadata: {
      crs: "Fantasy Map Cartesian (meters)",
      mapName: mapName.value,
      scale: {
        distance: distanceScale,
        unit: distanceUnitInput.value,
        meters_per_pixel: metersPerPixel
      }
    }
  };

  const fileName = getFileName("Burgs") + ".geojson";
  downloadFile(JSON.stringify(json), fileName, "application/json");
}