// Functions to save and load the map
"use strict";

// download map as SVG or PNG file
function saveAsImage(type) {
  console.time("saveAsImage");

  // clone svg
  const cloneEl = document.getElementById("map").cloneNode(true);
  cloneEl.id = "fantasyMap";
  document.getElementsByTagName("body")[0].appendChild(cloneEl);
  const clone = d3.select("#fantasyMap");

  if (type === "svg") clone.select("#viewbox").attr("transform", null); // reset transform to show whole map
  if (layerIsOn("texture") && type === "png") clone.select("#texture").remove(); // no texture for png

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
    }

    window.setTimeout(function() {window.URL.revokeObjectURL(url);}, 2000);
    console.timeEnd("saveAsImage");
  });
}

// get non-standard fonts used for labels to fetch them from web
function getFontsToLoad() {
  const webSafe = ["Georgia", "Times+New+Roman", "Comic+Sans+MS", "Lucida+Sans+Unicode", "Courier+New", "Verdana", "Arial", "Impact"];

  const fontsInUse = []; // to store fonts currently in use
  labels.selectAll("g").each(function() {
    const font = this.dataset.font;
    if (!font) return;
    if (webSafe.includes(font)) return; // do not fetch web-safe fonts
    if (!fontsInUse.includes(font)) fontsInUse.push(font);
  });
  return "https://fonts.googleapis.com/css?family=" + fontsInUse.join("|");
}

// code from Kaiido's answer https://stackoverflow.com/questions/42402584/how-to-use-google-fonts-in-canvas-when-drawing-dom-objects-in-svg
function GFontToDataURI(url) {
  return fetch(url) // first fecth the embed stylesheet page
    .then(resp => resp.text()) // we only need the text of it
    .then(text => {
      let s = document.createElement('style');
      s.innerHTML = text;
      document.head.appendChild(s);
      let styleSheet = Array.prototype.filter.call(
        document.styleSheets,
        sS => sS.ownerNode === s)[0];
      let FontRule = rule => {
        let src = rule.style.getPropertyValue('src');
        let url = src.split('url(')[1].split(')')[0];
        return {rule: rule, src: src, url: url.substring(url.length - 1, 1)};
      };
      let fontRules = [], fontProms = [];

      for (let r of styleSheet.cssRules) {
        let fR = FontRule(r);
        fontRules.push(fR);
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
          .then(dataURL => {
            return fR.rule.cssText.replace(fR.url, dataURL);
          })
        )
      }
      document.head.removeChild(s); // clean up
      return Promise.all(fontProms); // wait for all this has been done
    });
}

// Save in .map format
function saveMap() {
  if (customization) {tip("Map cannot be saved when is in edit mode, please exit the mode and re-try", false, "error"); return;}
  console.time("saveMap");
  const date = new Date();
  const dateString = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
  const license = "File can be loaded in azgaar.github.io/Fantasy-Map-Generator";
  const params = [version, license, dateString, seed, graphWidth, graphHeight].join("|");
  const options = [distanceUnit.value, distanceScale.value, areaUnit.value, heightUnit.value, heightExponent.value, temperatureScale.value, 
    barSize.value, barLabel.value, barBackOpacity.value, barBackColor.value, barPosX.value, barPosY.value, populationRate.value, urbanization.value, 
    equatorOutput.value, equidistanceOutput.value, temperatureEquatorOutput.value, temperaturePoleOutput.value, precOutput.value, JSON.stringify(winds)].join("|");
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

  const data = [params, options, coords, biomes, notesData, svg_xml, 
    gridGeneral, grid.cells.h, grid.cells.prec, grid.cells.f, grid.cells.t, grid.cells.temp,
    features, cultures, states, burgs,
    pack.cells.biome, pack.cells.burg, pack.cells.conf, pack.cells.culture, pack.cells.fl, 
    pack.cells.pop, pack.cells.r, pack.cells.road, pack.cells.s, pack.cells.state].join("\r\n");
  const dataBlob = new Blob([data], {type: "text/plain"});
  const dataURL = window.URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.download = "fantasy_map_" + Date.now() + ".map";
  link.href = dataURL;
  document.body.appendChild(link);
  link.click();

  // restore initial values
  svg.attr("width", svgWidth).attr("height", svgHeight);
  zoom.transform(svg, transform);

  window.setTimeout(function() {window.URL.revokeObjectURL(dataURL);}, 2000);
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
      message =  `The map version (${mapVersion}) does not match the Generator version (${version}). The map will be auto-updated.
                 <br>In case of issues please keep using an ${archive} of the Generator`;
    }
    alertMessage.innerHTML = message;
    $("#alert").dialog({title: "Version conflict", buttons: {
      OK: function() {$(this).dialog("close"); if (load) parseLoadedData(data);}
    }});
  };

  fileReader.readAsText(file, "UTF-8");
  if (callback) callback();
}

function parseLoadedData(data) {
  closeDialogs();

  void function parseParameters() {
    const params = data[0].split("|");
    if (params[3]) {seed = params[3]; optionsSeed.value = seed;}
    if (params[4]) graphWidth = +params[4];
    if (params[5]) graphHeight = +params[5];
  }()

  void function parseOptions() {
    const options = data[1].split("|");
    if (options[0]) distanceUnit.value = distanceUnitOutput.innerHTML = options[0];
    if (options[1]) distanceScale.value = distanceScaleSlider.value = options[1];
    if (options[2]) areaUnit.value = options[2];
    if (options[3]) heightUnit.value= options[3];
    if (options[4]) heightExponent.value = heightExponentSlider.value = options[4];
    if (options[5]) temperatureScale.value = options[5];
    if (options[6]) barSize.value = barSizeSlider.value = options[6];
    if (options[7] !== undefined) barLabel.value = options[7];
    if (options[8] !== undefined) barBackOpacity.value = options[8];
    if (options[9]) barBackColor.value = options[9];
    if (options[10]) barPosX.value = options[10];
    if (options[11]) barPosY.value = options[11];
    if (options[12]) populationRate.value = populationRateSlider.value = options[12];
    if (options[13]) urbanization.value = urbanizationSlider.value = options[13];
    if (options[14]) equatorInput.value = equatorOutput.value = options[14];
    if (options[15]) equidistanceInput.value = equidistanceOutput.value = options[15];
    if (options[16]) temperatureEquatorInput.value = temperatureEquatorOutput.value = options[16];
    if (options[17]) temperaturePoleInput.value = temperaturePoleOutput.value = options[17];
    if (options[18]) precInput.value = precOutput.value = options[18];
    if (options[19]) winds = JSON.parse(options[19]);
  }()

  void function parseConfiguration() {
    if (data[2]) mapCoordinates = JSON.parse(data[2]);
    if (data[4]) notes = JSON.parse(data[4]);

    const biomes = data[3].split("|");
    const name = biomes[2].split(",");
    if (name.length !== biomesData.name.length) {
      console.error("Biomes data is not correct and will not be loaded");
      return;
    }
    biomesData.color = biomes[0].split(",");
    biomesData.habitability = biomes[1].split(",");
    biomesData.name = name;
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
    cults = viewbox.select("#cults");
    regions = viewbox.select("#regions");
    statesBody = regions.select("#statesBody");
    statesHalo = regions.select("#statesHalo");
    borders = viewbox.select("#borders");
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

    pack.cells.biome = Uint8Array.from(data[16].split(","));
    pack.cells.burg = Uint16Array.from(data[17].split(","));
    pack.cells.conf = Uint8Array.from(data[18].split(","));
    pack.cells.culture = Uint8Array.from(data[19].split(","));
    pack.cells.fl = Uint16Array.from(data[20].split(","));
    pack.cells.pop = Uint16Array.from(data[21].split(","));
    pack.cells.r = Uint16Array.from(data[22].split(","));
    pack.cells.road = Uint16Array.from(data[23].split(","));
    pack.cells.s = Uint16Array.from(data[24].split(","));
    pack.cells.state = Uint8Array.from(data[25].split(","));
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
    if (cults.selectAll("*").size()) turnButtonOn("toggleCultures"); else turnButtonOff("toggleCultures");
    if (statesBody.selectAll("*").size()) turnButtonOn("toggleStates"); else turnButtonOff("toggleStates");
    if (borders.style("display") !== "none" && borders.selectAll("*").size()) turnButtonOn("toggleBorders"); else turnButtonOff("toggleBorders");
    if (routes.style("display") !== "none" && routes.selectAll("path").size()) turnButtonOn("toggleRoutes"); else turnButtonOff("toggleRoutes");
    if (temperature.selectAll("*").size()) turnButtonOn("toggleTemp"); else turnButtonOff("toggleTemp");
    if (population.select("#rural").selectAll("*").size()) turnButtonOn("togglePopulation"); else turnButtonOff("togglePopulation");
    if (prec.selectAll("circle").size()) turnButtonOn("togglePrec"); else turnButtonOff("togglePrec");
    if (labels.style("display") !== "none") turnButtonOn("toggleLabels"); else turnButtonOff("toggleLabels");
    if (icons.style("display") !== "none") turnButtonOn("toggleIcons"); else turnButtonOff("toggleIcons");
    if (markers.style("display") !== "none") turnButtonOn("toggleMarkers"); else turnButtonOff("toggleMarkers");
    if (ruler.style("display") !== "none") turnButtonOn("toggleRulers"); else turnButtonOff("toggleRulers");
    if (scaleBar.style("display") !== "none") turnButtonOn("toggleScaleBar"); else turnButtonOff("toggleScaleBar");
  }()

  changeMapSize();
  restoreDefaultEvents();
  invokeActiveZooming();
  tip("Map is loaded");
  console.timeEnd("loadMap");
}
