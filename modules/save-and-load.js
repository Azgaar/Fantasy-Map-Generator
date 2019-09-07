// Functions to save and load the map
"use strict";

// download map data as GeoJSON
function saveGeoJSON() {
    saveGeoJSON_Cells();
    saveGeoJSON_Roads();
    saveGeoJSON_Rivers();
}

function saveGeoJSON_Roads() {
    // this is work-in-progress
    roads = routes.select("#roads");
    trails = routes.select("#trails");
    searoutes = routes.select("#searoutes");

    let data = "{ \"type\": \"FeatureCollection\", \"features\": [\n";

    routes._groups[0][0].childNodes.forEach(n => {
        //console.log(n.id);
        n.childNodes.forEach(r => {
            data += "{\n   \"type\": \"Feature\",\n   \"geometry\": { \"type\": \"LineString\", \"coordinates\": ";
            data += JSON.stringify(getRoadPoints(r));
            data += " },\n   \"properties\": {\n";
            data += "      \"id\": \""+r.id+"\",\n";
            data += "      \"type\": \""+n.id+"\"\n";
            data +="   }\n},\n";
        });
    });
    data = data.substring(0, data.length - 2)+"\n"; // remove trailing comma
    data += "]}";

    const dataBlob = new Blob([data], {type: "application/json"});
    const url = window.URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    document.body.appendChild(link);
    link.download = "fmg_routes_" + Date.now() + ".geojson";
    link.href = url;
    link.click();
    window.setTimeout(function() {window.URL.revokeObjectURL(url);}, 2000);
}

function saveGeoJSON_Rivers() {
    let data = "{ \"type\": \"FeatureCollection\", \"features\": [\n";

    rivers._groups[0][0].childNodes.forEach(n => {
        data += "{\n   \"type\": \"Feature\",\n   \"geometry\": { \"type\": \"LineString\", \"coordinates\": ";
        data += JSON.stringify(getRiverPoints(n));
        data += " },\n   \"properties\": {\n";
        data += "      \"id\": \""+n.id+"\",\n";
        data += "      \"width\": \""+n.dataset.width+"\",\n";
        data += "      \"increment\": \""+n.dataset.increment+"\"\n";
        data +="   }\n},\n";
    });
    data = data.substring(0, data.length - 2)+"\n"; // remove trailing comma
    data += "]}";

    const dataBlob = new Blob([data], {type: "application/json"});
    const url = window.URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    document.body.appendChild(link);
    link.download = "fmg_rivers_" + Date.now() + ".geojson";
    link.href = url;
    link.click();
    window.setTimeout(function() {window.URL.revokeObjectURL(url);}, 2000);
}

function getRoadPoints(node) {
    let points = [];
    const l = node.getTotalLength();
    const increment = l / Math.ceil(l / 2);
    for (let i=0; i <= l; i += increment) {
        const p = node.getPointAtLength(i);

        let x = mapCoordinates.lonW + (p.x / graphWidth) * mapCoordinates.lonT;
        let y = mapCoordinates.latN - (p.y / graphHeight) * mapCoordinates.latT; // this is inverted in QGIS otherwise

        points.push([x,y]);
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

        let x = mapCoordinates.lonW + (((p1.x+p2.x)/2) / graphWidth) * mapCoordinates.lonT;
        let y = mapCoordinates.latN - (((p1.y+p2.y)/2) / graphHeight) * mapCoordinates.latT; // this is inverted in QGIS otherwise

        points.push([x,y]);
    }
    return points;
}


function saveGeoJSON_Cells() {
    let data = "{ \"type\": \"FeatureCollection\", \"features\": [\n";

    const cells = pack.cells;
    const v = pack.vertices;

    /*
        my guesses on the cells structure:

        cells.h = height
        cells.p = coordinates of center point (of the voronoi cell)
        cells.pop = population

        // from voronoi.js:
        const cells = {v: [], c: [], b: []}; // voronoi cells: v = cell vertices, c = adjacent cells, b = near-border cell
        const vertices = {p: [], v: [], c: []}; // cells vertices: p = vertex coordinates, v = neighboring vertices, c = adjacent cells


    */

    cells.i.forEach(i => {
        data += "{\n   \"type\": \"Feature\",\n   \"geometry\": { \"type\": \"Polygon\", \"coordinates\": [[";
        cells.v[i].forEach(n => {
            let x = mapCoordinates.lonW + (v.p[n][0] / graphWidth) * mapCoordinates.lonT;
            let y = mapCoordinates.latN - (v.p[n][1] / graphHeight) * mapCoordinates.latT; // this is inverted in QGIS otherwise
            data += "["+x+","+y+"],";
        });
        // close the ring
        let x = mapCoordinates.lonW + (v.p[cells.v[i][0]][0] / graphWidth) * mapCoordinates.lonT;
        let y = mapCoordinates.latN - (v.p[cells.v[i][0]][1] / graphHeight) * mapCoordinates.latT; // this is inverted in QGIS otherwise
        data += "["+x+","+y+"]";

        data += "]] },\n   \"properties\": {\n";

        let height = parseInt(getFriendlyHeight(cells.h[i]));

        data += "      \"id\": \""+i+"\",\n";
        data += "      \"height\": \""+height+"\",\n";
        data += "      \"biome\": \""+cells.biome[i]+"\",\n";
        data += "      \"population\": \""+cells.pop[i]+"\",\n";
        data += "      \"state\": \""+cells.state[i]+"\",\n";
        data += "      \"province\": \""+cells.province[i]+"\",\n";
        data += "      \"culture\": \""+cells.culture[i]+"\",\n";
        data += "      \"religion\": \""+cells.religion[i]+"\"\n";
        data +="   }\n},\n";
    });

/*
    cells.i.forEach(i => {
        let x = (cells.p[i][0] / graphWidth) * mapCoordinates.lonT + mapCoordinates.lonW;
        let y = mapCoordinates.latN - (cells.p[i][1] / graphHeight) * mapCoordinates.lonT; // inverted in QGIS otherwise
        let height = parseInt(getFriendlyHeight(cells.h[i]));

        data += "{\n   \"type\": \"Feature\",\n   \"geometry\": { \"type\": \"Point\", \"coordinates\": ["+x+", "+y+", "+height+"] },\n   \"properties\": {\n";
        data += "      \"id\": \""+i+"\",\n";
        data += "      \"biome\": \""+cells.biome[i]+"\",\n";
        data += "      \"height\": \""+cells.h[i]+"\"\n";
        data +="   }\n},\n";
    });
*/

    data = data.substring(0, data.length - 2)+"\n"; // remove trailing comma
    data += "]}";

    const dataBlob = new Blob([data], {type: "application/json"});
    const url = window.URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    document.body.appendChild(link);
    link.download = "fmg_cells_" + Date.now() + ".geojson";
    link.href = url;
    link.click();
    window.setTimeout(function() {window.URL.revokeObjectURL(url);}, 2000);
}

// download map as SVG or PNG file
function saveAsImage(type) {
  console.time("saveAsImage");

  // clone svg
  const cloneEl = document.getElementById("map").cloneNode(true);
  cloneEl.id = "fantasyMap";
  document.getElementsByTagName("body")[0].appendChild(cloneEl);
  const clone = d3.select("#fantasyMap");

  if (type === "svg") clone.select("#viewbox").attr("transform", null); // reset transform to show whole map

  // remove unused elements
  if (!clone.select("#terrain").selectAll("use").size()) clone.select("#defs-relief").remove();
  if (!clone.select("#prec").selectAll("circle").size()) clone.select("#prec").remove();
  const removeEmptyGroups = function() {
    let empty = 0;
    clone.selectAll("g").each(function() {
      if (!this.hasChildNodes() || this.style.display === "none") {empty++; this.remove();}
      if (this.hasAttribute("display") && this.style.display === "inline") this.removeAttribute("display");
    });
    return empty;
  }
  while(removeEmptyGroups()) {removeEmptyGroups();}

  // for each g element get inline style
  const emptyG = clone.append("g").node();
  const defaultStyles = window.getComputedStyle(emptyG);
  clone.selectAll("g, #ruler > g > *, #scaleBar > text").each(function(d) {
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
    if (style != "") this.setAttribute('style', style);
  });
  emptyG.remove();

  // load fonts as dataURI so they will be available in downloaded svg/png
  GFontToDataURI(getFontsToLoad()).then(cssRules => {
    clone.select("defs").append("style").text(cssRules.join('\n'));
    const svg_xml = (new XMLSerializer()).serializeToString(clone.node());
    clone.remove();
    const blob = new Blob([svg_xml], {type: 'image/svg+xml;charset=utf-8'});
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.target = "_blank";

    if (type === "png") {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = svgWidth * pngResolutionInput.value;
      canvas.height = svgHeight * pngResolutionInput.value;
      const img = new Image();
      img.src = url;
      img.onload = function() {
        window.URL.revokeObjectURL(url);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        link.download = "fantasy_map_" + Date.now() + ".png";
        canvas.toBlob(function(blob) {
           link.href = window.URL.createObjectURL(blob);
           document.body.appendChild(link);
           link.click();
           window.setTimeout(function() {
             canvas.remove();
             window.URL.revokeObjectURL(link.href);
           }, 1000);
        });
      }
    } else {
      link.download = "fantasy_map_" + Date.now() + ".svg";
      link.href = url;
      document.body.appendChild(link);
      link.click();
      tip(`${link.download} is saved. Open "Downloads" screen (crtl + J) to check`, true, "warning");
    }

    window.setTimeout(function() {
      window.URL.revokeObjectURL(url);
      clearMainTip();
    }, 3000);
    console.timeEnd("saveAsImage");
  });
}

// get non-standard fonts used for labels to fetch them from web
function getFontsToLoad() {
  const webSafe = ["Georgia", "Times+New+Roman", "Comic+Sans+MS", "Lucida+Sans+Unicode", "Courier+New", "Verdana", "Arial", "Impact"];

  const fontsInUse = new Set(); // to store fonts currently in use
  labels.selectAll("g").each(function() {
    const font = this.dataset.font;
    if (!font) return;
    if (webSafe.includes(font)) return; // do not fetch web-safe fonts
    fontsInUse.add(font);
  });
  const legendFont = legend.attr("data-font");
  if (!webSafe.includes(legendFont)) fontsInUse.add();
  return "https://fonts.googleapis.com/css?family=" + [...fontsInUse].join("|");
}

// code from Kaiido's answer https://stackoverflow.com/questions/42402584/how-to-use-google-fonts-in-canvas-when-drawing-dom-objects-in-svg
function GFontToDataURI(url) {
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

// Save in .map format
function saveMap() {
  if (customization) {tip("Map cannot be saved when is in edit mode, please exit the mode and retry", false, "error"); return;}
  console.time("saveMap");
  closeDialogs();
  const date = new Date();
  const dateString = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
  const license = "File can be loaded in azgaar.github.io/Fantasy-Map-Generator";
  const params = [version, license, dateString, seed, graphWidth, graphHeight].join("|");
  const options = [distanceUnitInput.value, distanceScaleInput.value, areaUnit.value, heightUnit.value, heightExponentInput.value, temperatureScale.value,
    barSize.value, barLabel.value, barBackOpacity.value, barBackColor.value, barPosX.value, barPosY.value, populationRate.value, urbanization.value,
    mapSizeOutput.value, latitudeOutput.value, temperatureEquatorOutput.value, temperaturePoleOutput.value, precOutput.value, JSON.stringify(winds)].join("|");
  const coords = JSON.stringify(mapCoordinates);
  const biomes = [biomesData.color, biomesData.habitability, biomesData.name].join("|");
  const notesData = JSON.stringify(notes);

  // set transform values to default
  svg.attr("width", graphWidth).attr("height", graphHeight);
  const transform = d3.zoomTransform(svg.node());
  viewbox.attr("transform", null);
  const svg_xml = (new XMLSerializer()).serializeToString(svg.node());

  const gridGeneral = JSON.stringify({spacing:grid.spacing, cellsX:grid.cellsX, cellsY:grid.cellsY, boundary:grid.boundary, points:grid.points, features:grid.features});
  const features = JSON.stringify(pack.features);
  const cultures = JSON.stringify(pack.cultures);
  const states = JSON.stringify(pack.states);
  const burgs = JSON.stringify(pack.burgs);
  const religions = JSON.stringify(pack.religions);
  const provinces = JSON.stringify(pack.provinces);

  // data format as below
  const data = [params, options, coords, biomes, notesData, svg_xml,
    gridGeneral, grid.cells.h, grid.cells.prec, grid.cells.f, grid.cells.t, grid.cells.temp,
    features, cultures, states, burgs,
    pack.cells.biome, pack.cells.burg, pack.cells.conf, pack.cells.culture, pack.cells.fl,
    pack.cells.pop, pack.cells.r, pack.cells.road, pack.cells.s, pack.cells.state,
    pack.cells.religion, pack.cells.province, pack.cells.crossroad, religions, provinces].join("\r\n");
  const dataBlob = new Blob([data], {type: "text/plain"});
  const dataURL = window.URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.download = "fantasy_map_" + Date.now() + ".map";
  link.href = dataURL;
  document.body.appendChild(link);
  link.click();
  tip(`${link.download} is saved. Open "Downloads" screen (crtl + J) to check`, true, "warning");

  // restore initial values
  svg.attr("width", svgWidth).attr("height", svgHeight);
  zoom.transform(svg, transform);

  window.setTimeout(function() {
    window.URL.revokeObjectURL(dataURL);
    clearMainTip();
  }, 3000);
  console.timeEnd("saveMap");
}

function uploadFile(file, callback) {
  console.time("loadMap");
  const fileReader = new FileReader();
  fileReader.onload = function(fileLoadedEvent) {
    const dataLoaded = fileLoadedEvent.target.result;
    const data = dataLoaded.split("\r\n");

    const mapVersion = data[0].split("|")[0] || data[0];
    if (mapVersion === version) {parseLoadedData(data); return;}

    const archive = "<a href='https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog' target='_blank'>archived version</a>";
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
                 <br>The map will be auto-updated. In case of issues please keep using an ${archive} of the Generator`;
    }
    alertMessage.innerHTML = message;
    $("#alert").dialog({title: "Version conflict", width: 380, buttons: {
      OK: function() {$(this).dialog("close"); if (load) parseLoadedData(data);}
    }});
  };

  fileReader.readAsText(file, "UTF-8");
  if (callback) callback();
}

function parseLoadedData(data) {
  closeDialogs();
  const reliefIcons = document.getElementById("defs-relief").innerHTML; // save relief icons
  const hatching = document.getElementById("hatching").cloneNode(true); // save hatching

  void function parseParameters() {
    const params = data[0].split("|");
    if (params[3]) {seed = params[3]; optionsSeed.value = seed;}
    if (params[4]) graphWidth = +params[4];
    if (params[5]) graphHeight = +params[5];
  }()

  void function parseOptions() {
    const options = data[1].split("|");
    if (options[0]) applyOption(distanceUnitInput, options[0]);
    if (options[1]) distanceScaleInput.value = distanceScaleOutput.value = options[1];
    if (options[2]) areaUnit.value = options[2];
    if (options[3]) applyOption(heightUnit, options[3]);
    if (options[4]) heightExponentInput.value = heightExponentOutput.value = options[4];
    if (options[5]) temperatureScale.value = options[5];
    if (options[6]) barSize.value = barSizeOutput.value = options[6];
    if (options[7] !== undefined) barLabel.value = options[7];
    if (options[8] !== undefined) barBackOpacity.value = options[8];
    if (options[9]) barBackColor.value = options[9];
    if (options[10]) barPosX.value = options[10];
    if (options[11]) barPosY.value = options[11];
    if (options[12]) populationRate.value = populationRateOutput.value = options[12];
    if (options[13]) urbanization.value = urbanizationOutput.value = options[13];
    if (options[14]) mapSizeInput.value = mapSizeOutput.value = Math.max(Math.min(options[14], 100), 1);
    if (options[15]) latitudeInput.value = latitudeOutput.value = Math.max(Math.min(options[15], 100), 0);
    if (options[16]) temperatureEquatorInput.value = temperatureEquatorOutput.value = options[16];
    if (options[17]) temperaturePoleInput.value = temperaturePoleOutput.value = options[17];
    if (options[18]) precInput.value = precOutput.value = options[18];
    if (options[19]) winds = JSON.parse(options[19]);
  }()

  void function parseConfiguration() {
    if (data[2]) mapCoordinates = JSON.parse(data[2]);
    if (data[4]) notes = JSON.parse(data[4]);

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
    labels = viewbox.select("#labels");
    icons = viewbox.select("#icons");
    burgIcons = icons.select("#burgIcons");
    anchors = icons.select("#anchors");
    markers = viewbox.select("#markers");
    ruler = viewbox.select("#ruler");
    fogging = viewbox.select("#fogging");
    debug = viewbox.select("#debug");
    freshwater = lakes.select("#freshwater");
    salt = lakes.select("#salt");
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

    const cells = pack.cells;
    cells.biome = Uint8Array.from(data[16].split(","));
    cells.burg = Uint16Array.from(data[17].split(","));
    cells.conf = Uint8Array.from(data[18].split(","));
    cells.culture = Uint16Array.from(data[19].split(","));
    cells.fl = Uint16Array.from(data[20].split(","));
    cells.pop = Uint16Array.from(data[21].split(","));
    cells.r = Uint16Array.from(data[22].split(","));
    cells.road = Uint16Array.from(data[23].split(","));
    cells.s = Uint16Array.from(data[24].split(","));
    cells.state = Uint16Array.from(data[25].split(","));
    cells.religion = data[26] ? Uint16Array.from(data[26].split(",")) : new Uint16Array(cells.i.length);
    cells.province = data[27] ? Uint16Array.from(data[27].split(",")) : new Uint16Array(cells.i.length);
    cells.crossroad = data[28] ? Uint16Array.from(data[28].split(",")) : new Uint16Array(cells.i.length);
  }()

  void function restoreLayersState() {
    if (texture.style("display") !== "none" && texture.select("image").size()) turnButtonOn("toggleTexture"); else turnButtonOff("toggleTexture");
    if (terrs.selectAll("*").size()) turnButtonOn("toggleHeight"); else turnButtonOff("toggleHeight");
    if (biomes.selectAll("*").size()) turnButtonOn("toggleBiomes"); else turnButtonOff("toggleBiomes");
    if (cells.selectAll("*").size()) turnButtonOn("toggleCells"); else turnButtonOff("toggleCells");
    if (gridOverlay.selectAll("*").size()) turnButtonOn("toggleGrid"); else turnButtonOff("toggleGrid");
    if (coordinates.selectAll("*").size()) turnButtonOn("toggleCoordinates"); else turnButtonOff("toggleCoordinates");
    if (compass.style("display") !== "none" && compass.select("use").size()) turnButtonOn("toggleCompass"); else turnButtonOff("toggleCompass");
    if (rivers.style("display") !== "none") turnButtonOn("toggleRivers"); else turnButtonOff("toggleRivers");
    if (terrain.style("display") !== "none" && terrain.selectAll("*").size()) turnButtonOn("toggleRelief"); else turnButtonOff("toggleRelief");
    if (relig.selectAll("*").size()) turnButtonOn("toggleReligions"); else turnButtonOff("toggleReligions");
    if (cults.selectAll("*").size()) turnButtonOn("toggleCultures"); else turnButtonOff("toggleCultures");
    if (statesBody.selectAll("*").size()) turnButtonOn("toggleStates"); else turnButtonOff("toggleStates");
    if (provs.selectAll("*").size()) turnButtonOn("toggleProvinces"); else turnButtonOff("toggleProvinces");
    if (zones.selectAll("*").size() && zones.style("display") !== "none") turnButtonOn("toggleZones"); else turnButtonOff("toggleZones");
    if (borders.style("display") !== "none") turnButtonOn("toggleBorders"); else turnButtonOff("toggleBorders");
    if (routes.style("display") !== "none" && routes.selectAll("path").size()) turnButtonOn("toggleRoutes"); else turnButtonOff("toggleRoutes");
    if (temperature.selectAll("*").size()) turnButtonOn("toggleTemp"); else turnButtonOff("toggleTemp");
    if (prec.selectAll("circle").size()) turnButtonOn("togglePrec"); else turnButtonOff("togglePrec");
    if (labels.style("display") !== "none") turnButtonOn("toggleLabels"); else turnButtonOff("toggleLabels");
    if (icons.style("display") !== "none") turnButtonOn("toggleIcons"); else turnButtonOff("toggleIcons");
    if (markers.selectAll("*").size() && markers.style("display") !== "none") turnButtonOn("toggleMarkers"); else turnButtonOff("toggleMarkers");
    if (ruler.style("display") !== "none") turnButtonOn("toggleRulers"); else turnButtonOff("toggleRulers");
    if (scaleBar.style("display") !== "none") turnButtonOn("toggleScaleBar"); else turnButtonOff("toggleScaleBar");

    // special case for population bars
    const populationIsOn = population.selectAll("line").size();
    if (populationIsOn) drawPopulation();
    if (populationIsOn) turnButtonOn("togglePopulation"); else turnButtonOff("togglePopulation");

    getCurrentPreset();
  }()

  void function restoreRulersEvents() {
    ruler.selectAll("g").call(d3.drag().on("start", dragRuler));
    ruler.selectAll("text").on("click", removeParent);
    ruler.selectAll("g.ruler circle").call(d3.drag().on("drag", dragRulerEdge));
    ruler.selectAll("g.ruler circle").call(d3.drag().on("drag", dragRulerEdge));
    ruler.selectAll("g.ruler rect").call(d3.drag().on("start", rulerCenterDrag));
    ruler.selectAll("g.opisometer circle").call(d3.drag().on("start", dragOpisometerEnd));
    ruler.selectAll("g.opisometer circle").call(d3.drag().on("start", dragOpisometerEnd));
  }()

  void function resolveVersionConflicts() {
    const version = parseFloat(data[0].split("|")[0]);
    if (version == 0.8) {
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
      addZone();
      if (!markers.selectAll("*").size()) {addMarkers(); turnButtonOn("toggleMarkers");}

      // 1.0 add fogging layer (state focus)
      let fogging = viewbox.insert("g", "#ruler").attr("id", "fogging-cont").attr("mask", "url(#fog)")
        .append("g").attr("id", "fogging").attr("display", "none");
      fogging.append("rect").attr("x", 0).attr("y", 0).attr("width", "100%").attr("height", "100%");
      defs.append("mask").attr("id", "fog").append("rect").attr("x", 0).attr("y", 0).attr("width", "100%")
        .attr("height", "100%").attr("fill", "white");

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

    if (version == 1) {
      // v 1.0 initial code had a bug with religion layer id
      if (!relig.size()) relig = viewbox.insert("g", "#terrain").attr("id", "relig");

      // v 1.0 initially has Sympathy status then relaced with Friendly
      for (const s of pack.states) {
        s.diplomacy = s.diplomacy.map(r => r === "Sympathy" ? "Friendly" : r);
      }
    }
  }()

  changeMapSize();
  restoreDefaultEvents();
  invokeActiveZooming();
  tip("Map is loaded");
  console.timeEnd("loadMap");
}
