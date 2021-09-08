// Functions to save and load the map
"use strict";

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

async function loadFromDropbox() {
  const mapPath = document.getElementById("#loadFromDropboxSelect")?.value;

  DEBUG && console.log("Loading map from Dropbox:", mapPath);
  const blob = await Cloud.providers.dropbox.load(map);
  uploadMap(blob);
}

async function createSharableDropboxLink() {
  const mapFile = document.querySelector("#loadFromDropbox select").value;
  const sharableLink = document.getElementById("sharableLink");
  const sharableLinkContainer = document.getElementById("sharableLinkContainer");
  let url;
  try {
    url = await Cloud.providers.dropbox.getLink(mapFile);
  } catch {
    tip("Dropbox API error. Can not create link.", true, "error", 2000);
    return;
  }

  const fmg = window.location.href.split("?")[0];
  const reallink = `${fmg}?maplink=${url}`;
  // voodoo magic required by the yellow god of CORS
  const link = reallink.replace("www.dropbox.com/s/", "dl.dropboxusercontent.com/1/view/");
  const shortLink = link.slice(0, 50) + "...";

  sharableLinkContainer.style.display = "block";
  sharableLink.innerText = shortLink;
  sharableLink.setAttribute("href", link);
}

function loadMapPrompt(blob) {
  const workingTime = (Date.now() - last(mapHistory).created) / 60000; // minutes
  if (workingTime < 5) {
    loadLastSavedMap();
    return;
  }

  alertMessage.innerHTML = `Are you sure you want to load saved map?<br>
  All unsaved changes made to the current map will be lost`;
  $("#alert").dialog({
    resizable: false,
    title: "Load saved map",
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      Load: function () {
        loadLastSavedMap();
        $(this).dialog("close");
      }
    }
  });

  function loadLastSavedMap() {
    WARN && console.warn("Load last saved map");
    try {
      uploadMap(blob);
    } catch (error) {
      ERROR && console.error(error);
      tip("Cannot load last saved map", true, "error", 2000);
    }
  }
}

function loadMapFromURL(maplink, random) {
  const URL = decodeURIComponent(maplink);

  fetch(URL, {method: "GET", mode: "cors"})
    .then(response => {
      if (response.ok) return response.blob();
      throw new Error("Cannot load map from URL");
    })
    .then(blob => uploadMap(blob))
    .catch(error => {
      showUploadErrorMessage(error.message, URL, random);
      if (random) generateMapOnLoad();
    });
}

function showUploadErrorMessage(error, URL, random) {
  ERROR && console.error(error);
  alertMessage.innerHTML = `Cannot load map from the ${link(URL, "link provided")}.
    ${random ? `A new random map is generated. ` : ""}
    Please ensure the linked file is reachable and CORS is allowed on server side`;
  $("#alert").dialog({
    title: "Loading error",
    width: "32em",
    buttons: {
      OK: function () {
        $(this).dialog("close");
      }
    }
  });
}

function uploadMap(file, callback) {
  uploadMap.timeStart = performance.now();
  const OLDEST_SUPPORTED_VERSION = 0.7;
  const currentVersion = parseFloat(version);

  const fileReader = new FileReader();
  fileReader.onload = function (fileLoadedEvent) {
    if (callback) callback();
    document.getElementById("coas").innerHTML = ""; // remove auto-generated emblems
    const result = fileLoadedEvent.target.result;
    const [mapData, mapVersion] = parseLoadedResult(result);

    const isInvalid = !mapData || isNaN(mapVersion) || mapData.length < 26 || !mapData[5];
    const isUpdated = mapVersion === currentVersion;
    const isAncient = mapVersion < OLDEST_SUPPORTED_VERSION;
    const isNewer = mapVersion > currentVersion;
    const isOutdated = mapVersion < currentVersion;

    if (isInvalid) return showUploadMessage("invalid", mapData, mapVersion);
    if (isUpdated) return parseLoadedData(mapData);
    if (isAncient) return showUploadMessage("ancient", mapData, mapVersion);
    if (isNewer) return showUploadMessage("newer", mapData, mapVersion);
    if (isOutdated) return showUploadMessage("outdated", mapData, mapVersion);
  };

  fileReader.readAsText(file, "UTF-8");
}

function parseLoadedResult(result) {
  try {
    // data can be in FMG internal format or base64 encoded
    const isDelimited = result.substr(0, 10).includes("|");
    const decoded = isDelimited ? result : decodeURIComponent(atob(result));
    const mapData = decoded.split("\r\n");
    const mapVersion = parseFloat(mapData[0].split("|")[0] || mapData[0]);
    return [mapData, mapVersion];
  } catch (error) {
    console.error(error);
    return [null, null];
  }
}

function showUploadMessage(type, mapData, mapVersion) {
  const archive = link("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog", "archived version");
  let message, title, canBeLoaded;

  if (type === "invalid") {
    message = `The file does not look like a valid <i>.map</i> file.<br>Please check the data format`;
    title = "Invalid file";
    canBeLoaded = false;
  } else if (type === "ancient") {
    message = `The map version you are trying to load (${mapVersion}) is too old and cannot be updated to the current version.<br>Please keep using an ${archive}`;
    title = "Ancient file";
    canBeLoaded = false;
  } else if (type === "newer") {
    message = `The map version you are trying to load (${mapVersion}) is newer than the current version.<br>Please load the file in the appropriate version`;
    title = "Newer file";
    canBeLoaded = false;
  } else if (type === "outdated") {
    message = `The map version (${mapVersion}) does not match the Generator version (${version}).<br>Click OK to get map <b>auto-updated</b>.<br>In case of issues please keep using an ${archive} of the Generator`;
    title = "Outdated file";
    canBeLoaded = true;
  }

  alertMessage.innerHTML = message;
  const buttons = {
    OK: function () {
      $(this).dialog("close");
      if (canBeLoaded) parseLoadedData(mapData);
    }
  };
  $("#alert").dialog({title, buttons});
}

function parseLoadedData(data) {
  try {
    // exit customization
    if (window.closeDialogs) closeDialogs();
    customization = 0;
    if (customizationMenu.offsetParent) styleTab.click();

    const reliefIcons = document.getElementById("defs-relief").innerHTML; // save relief icons
    const hatching = document.getElementById("hatching").cloneNode(true); // save hatching

    void (function parseParameters() {
      const params = data[0].split("|");
      if (params[3]) {
        seed = params[3];
        optionsSeed.value = seed;
      }
      if (params[4]) graphWidth = +params[4];
      if (params[5]) graphHeight = +params[5];
      mapId = params[6] ? +params[6] : Date.now();
    })();

    INFO && console.group("Loaded Map " + seed);

    void (function parseSettings() {
      const settings = data[1].split("|");
      if (settings[0]) applyOption(distanceUnitInput, settings[0]);
      if (settings[1]) distanceScaleInput.value = distanceScaleOutput.value = settings[1];
      if (settings[2]) areaUnit.value = settings[2];
      if (settings[3]) applyOption(heightUnit, settings[3]);
      if (settings[4]) heightExponentInput.value = heightExponentOutput.value = settings[4];
      if (settings[5]) temperatureScale.value = settings[5];
      if (settings[6]) barSizeInput.value = barSizeOutput.value = settings[6];
      if (settings[7] !== undefined) barLabel.value = settings[7];
      if (settings[8] !== undefined) barBackOpacity.value = settings[8];
      if (settings[9]) barBackColor.value = settings[9];
      if (settings[10]) barPosX.value = settings[10];
      if (settings[11]) barPosY.value = settings[11];
      if (settings[12]) populationRate = populationRateInput.value = populationRateOutput.value = settings[12];
      if (settings[13]) urbanization = urbanizationInput.value = urbanizationOutput.value = settings[13];
      if (settings[14]) mapSizeInput.value = mapSizeOutput.value = Math.max(Math.min(settings[14], 100), 1);
      if (settings[15]) latitudeInput.value = latitudeOutput.value = Math.max(Math.min(settings[15], 100), 0);
      if (settings[16]) temperatureEquatorInput.value = temperatureEquatorOutput.value = settings[16];
      if (settings[17]) temperaturePoleInput.value = temperaturePoleOutput.value = settings[17];
      if (settings[18]) precInput.value = precOutput.value = settings[18];
      if (settings[19]) options = JSON.parse(settings[19]);
      if (settings[20]) mapName.value = settings[20];
      if (settings[21]) hideLabels.checked = +settings[21];
      if (settings[22]) stylePreset.value = settings[22];
      if (settings[23]) rescaleLabels.checked = settings[23];
    })();

    void (function parseConfiguration() {
      if (data[2]) mapCoordinates = JSON.parse(data[2]);
      if (data[4]) notes = JSON.parse(data[4]);
      if (data[33]) rulers.fromString(data[33]);

      const biomes = data[3].split("|");
      biomesData = applyDefaultBiomesSystem();
      biomesData.color = biomes[0].split(",");
      biomesData.habitability = biomes[1].split(",").map(h => +h);
      biomesData.name = biomes[2].split(",");

      // push custom biomes if any
      for (let i = biomesData.i.length; i < biomesData.name.length; i++) {
        biomesData.i.push(biomesData.i.length);
        biomesData.iconsDensity.push(0);
        biomesData.icons.push([]);
        biomesData.cost.push(50);
      }
    })();

    void (function replaceSVG() {
      svg.remove();
      document.body.insertAdjacentHTML("afterbegin", data[5]);
    })();

    void (function redefineElements() {
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
    })();

    loadUsedFonts();

    void (function parseGridData() {
      grid = JSON.parse(data[6]);
      calculateVoronoi(grid, grid.points);
      grid.cells.h = Uint8Array.from(data[7].split(","));
      grid.cells.prec = Uint8Array.from(data[8].split(","));
      grid.cells.f = Uint16Array.from(data[9].split(","));
      grid.cells.t = Int8Array.from(data[10].split(","));
      grid.cells.temp = Int8Array.from(data[11].split(","));
    })();

    void (function parsePackData() {
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
          nameBases[i] = {name: e[0], min: e[1], max: e[2], d: e[3], m: e[4], b};
        });
      }
    })();

    void (function restoreLayersState() {
      // helper functions
      const notHidden = selection => selection.node() && selection.style("display") !== "none";
      const hasChildren = selection => selection.node()?.hasChildNodes();
      const hasChild = (selection, selector) => selection.node()?.querySelector(selector);
      const turnOn = el => document.getElementById(el).classList.remove("buttonoff");

      // turn all layers off
      document
        .getElementById("mapLayers")
        .querySelectorAll("li")
        .forEach(el => el.classList.add("buttonoff"));

      // turn on active layers
      if (notHidden(texture) && hasChild(texture, "image")) turnOn("toggleTexture");
      if (hasChildren(terrs)) turnOn("toggleHeight");
      if (hasChildren(biomes)) turnOn("toggleBiomes");
      if (hasChildren(cells)) turnOn("toggleCells");
      if (hasChildren(gridOverlay)) turnOn("toggleGrid");
      if (hasChildren(coordinates)) turnOn("toggleCoordinates");
      if (notHidden(compass) && hasChild(compass, "use")) turnOn("toggleCompass");
      if (hasChildren(rivers)) turnOn("toggleRivers");
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
    })();

    void (function restoreEvents() {
      scaleBar.on("mousemove", () => tip("Click to open Units Editor")).on("click", () => editUnits());
      legend.on("mousemove", () => tip("Drag to change the position. Click to hide the legend")).on("click", () => clearLegend());
    })();

    void (function resolveVersionConflicts() {
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
        legend.attr("font-family", "Almendra SC").attr("data-font", "Almendra+SC").attr("font-size", 13).attr("data-size", 13).attr("data-x", 99).attr("data-y", 93).attr("stroke-width", 2.5).attr("stroke", "#812929").attr("stroke-dasharray", "0 4 10 4").attr("stroke-linecap", "round");

        // 1.0 separated drawBorders fron drawStates()
        stateBorders = borders.append("g").attr("id", "stateBorders");
        provinceBorders = borders.append("g").attr("id", "provinceBorders");
        borders.attr("opacity", null).attr("stroke", null).attr("stroke-width", null).attr("stroke-dasharray", null).attr("stroke-linecap", null).attr("filter", null);
        stateBorders.attr("opacity", 0.8).attr("stroke", "#56566d").attr("stroke-width", 1).attr("stroke-dasharray", "2").attr("stroke-linecap", "butt");
        provinceBorders.attr("opacity", 0.8).attr("stroke", "#56566d").attr("stroke-width", 0.5).attr("stroke-dasharray", "1").attr("stroke-linecap", "butt");

        // 1.0 adds state relations, provinces, forms and full names
        provs = viewbox.insert("g", "#borders").attr("id", "provs").attr("opacity", 0.6);
        BurgsAndStates.collectStatistics();
        BurgsAndStates.generateCampaigns();
        BurgsAndStates.generateDiplomacy();
        BurgsAndStates.defineStateForms();
        drawStates();
        BurgsAndStates.generateProvinces();
        drawBorders();
        if (!layerIsOn("toggleBorders")) $("#borders").fadeOut();
        if (!layerIsOn("toggleStates")) regions.attr("display", "none").selectAll("path").remove();

        // 1.0 adds hatching
        document.getElementsByTagName("defs")[0].appendChild(hatching);

        // 1.0 adds zones layer
        zones = viewbox.insert("g", "#borders").attr("id", "zones").attr("display", "none");
        zones.attr("opacity", 0.6).attr("stroke", null).attr("stroke-width", 0).attr("stroke-dasharray", null).attr("stroke-linecap", "butt");
        addZones();
        if (!markers.selectAll("*").size()) {
          addMarkers();
          turnButtonOn("toggleMarkers");
        }

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
        labels.selectAll("textPath").each(function () {
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
          s.diplomacy = s.diplomacy.map(r => (r === "Sympathy" ? "Friendly" : r));
        }

        // labels should be toggled via style attribute, so remove display attribute
        labels.attr("display", null);

        // v 1.0 added religions heirarchy tree
        if (pack.religions[1] && !pack.religions[1].code) {
          pack.religions
            .filter(r => r.i)
            .forEach(r => {
              r.origin = 0;
              r.code = r.name.slice(0, 2);
            });
        }

        if (!document.getElementById("freshwater")) {
          lakes.append("g").attr("id", "freshwater");
          lakes.select("#freshwater").attr("opacity", 0.5).attr("fill", "#a6c1fd").attr("stroke", "#5f799d").attr("stroke-width", 0.7).attr("filter", null);
        }

        if (!document.getElementById("salt")) {
          lakes.append("g").attr("id", "salt");
          lakes.select("#salt").attr("opacity", 0.5).attr("fill", "#409b8a").attr("stroke", "#388985").attr("stroke-width", 0.7).attr("filter", null);
        }

        // v 1.1 added new lake and coast groups
        if (!document.getElementById("sinkhole")) {
          lakes.append("g").attr("id", "sinkhole");
          lakes.append("g").attr("id", "frozen");
          lakes.append("g").attr("id", "lava");
          lakes.select("#sinkhole").attr("opacity", 1).attr("fill", "#5bc9fd").attr("stroke", "#53a3b0").attr("stroke-width", 0.7).attr("filter", null);
          lakes.select("#frozen").attr("opacity", 0.95).attr("fill", "#cdd4e7").attr("stroke", "#cfe0eb").attr("stroke-width", 0).attr("filter", null);
          lakes.select("#lava").attr("opacity", 0.7).attr("fill", "#90270d").attr("stroke", "#f93e0c").attr("stroke-width", 2).attr("filter", "url(#crumpled)");

          coastline.append("g").attr("id", "sea_island");
          coastline.append("g").attr("id", "lake_island");
          coastline.select("#sea_island").attr("opacity", 0.5).attr("stroke", "#1f3846").attr("stroke-width", 0.7).attr("filter", "url(#dropShadow)");
          coastline.select("#lake_island").attr("opacity", 1).attr("stroke", "#7c8eaf").attr("stroke-width", 0.35).attr("filter", null);
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
          pack.cultures
            .filter(c => c.i)
            .forEach(c => {
              c.origin = 0;
              c.code = c.name.slice(0, 2);
            });
        }

        // v 1.11 had an issue with fogging being displayed on load
        unfog();

        // v 1.2 added new terrain attributes
        if (!terrain.attr("set")) terrain.attr("set", "simple");
        if (!terrain.attr("size")) terrain.attr("size", 1);
        if (!terrain.attr("density")) terrain.attr("density", 0.4);
      }

      if (version < 1.21) {
        // v 1.11 replaced "display" attribute by "display" style
        viewbox.selectAll("g").each(function () {
          if (this.hasAttribute("display")) {
            this.removeAttribute("display");
            this.style.display = "none";
          }
        });

        // v 1.21 added rivers data to pack
        pack.rivers = []; // rivers data
        rivers.selectAll("path").each(function () {
          const i = +this.id.slice(5);
          const length = this.getTotalLength() / 2;
          const s = this.getPointAtLength(length),
            e = this.getPointAtLength(0);
          const source = findCell(s.x, s.y),
            mouth = findCell(e.x, e.y);
          const name = Rivers.getName(mouth);
          const type = length < 25 ? rw({Creek: 9, River: 3, Brook: 3, Stream: 1}) : "River";
          pack.rivers.push({i, parent: 0, length, source, mouth, basin: i, name, type});
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
        const era = Names.getBaseShort(P(0.7) ? 1 : rand(nameBases.length)) + " Era";
        const eraShort = era[0] + "E";
        const military = Military.getDefaultOptions();
        options = {winds, year, era, eraShort, military};

        // v 1.3 added campaings data for all states
        BurgsAndStates.generateCampaigns();

        // v 1.3 added militry layer
        armies = viewbox.insert("g", "#icons").attr("id", "armies");
        armies.attr("opacity", 1).attr("fill-opacity", 1).attr("font-size", 6).attr("box-size", 3).attr("stroke", "#000").attr("stroke-width", 0.3);
        turnButtonOn("toggleMilitary");
        Military.generate();
      }

      if (version < 1.4) {
        // v 1.35 added dry lakes
        if (!lakes.select("#dry").size()) {
          lakes.append("g").attr("id", "dry");
          lakes.select("#dry").attr("opacity", 1).attr("fill", "#c9bfa7").attr("stroke", "#8e816f").attr("stroke-width", 0.7).attr("filter", null);
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
        pack.states.filter(s => s.military).forEach(s => s.military.forEach(r => (r.state = s.i)));
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
        terrain.selectAll("use").each(function () {
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
          const el = document.getElementById("river" + river.i);
          if (el) {
            river.widthFactor = +el.getAttribute("data-width");
            el.removeAttribute("data-width");
            el.removeAttribute("data-increment");
            river.discharge = pack.cells.fl[river.mouth] || 1;
            river.width = rn(river.length / 100, 2);
            river.sourceWidth = 0.1;
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
          const evaporation = ((700 * (f.temp + 0.006 * height)) / 50 + 75) / (80 - f.temp);
          f.evaporation = rn(evaporation * f.cells);
          f.name = f.name || Lakes.getName(f);
          delete f.river;
        }
      }

      if (version < 1.61) {
        // v 1.61 changed rulers data
        ruler.style("display", null);
        rulers = new Rulers();

        ruler.selectAll(".ruler > .white").each(function () {
          const x1 = +this.getAttribute("x1");
          const y1 = +this.getAttribute("y1");
          const x2 = +this.getAttribute("x2");
          const y2 = +this.getAttribute("y2");
          if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return;
          const points = [
            [x1, y1],
            [x2, y2]
          ];
          rulers.create(Ruler, points);
        });

        ruler.selectAll("g.opisometer").each(function () {
          const pointsString = this.dataset.points;
          if (!pointsString) return;
          const points = JSON.parse(pointsString);
          rulers.create(Opisometer, points);
        });

        ruler.selectAll("path.planimeter").each(function () {
          const length = this.getTotalLength();
          if (length < 30) return;

          const step = length > 1000 ? 40 : length > 400 ? 20 : 10;
          const increment = length / Math.ceil(length / step);
          const points = [];
          for (let i = 0; i <= length; i += increment) {
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
        pattern.innerHTML = `<image id="oceanicPattern" href=${href} width="100" height="100" opacity="0.2"></image>`;
      }

      if (version < 1.62) {
        // v 1.62 changed grid data
        gridOverlay.attr("size", null);
      }

      if (version < 1.63) {
        // v.1.63 changed ocean pattern opacity element
        const oceanPattern = document.getElementById("oceanPattern");
        if (oceanPattern) oceanPattern.removeAttribute("opacity");
        const oceanicPattern = document.getElementById("oceanicPattern");
        if (!oceanicPattern.getAttribute("opacity")) oceanicPattern.setAttribute("opacity", 0.2);

        // v 1.63 moved label text-shadow from css to editable inline style
        burgLabels.select("#cities").style("text-shadow", "white 0 0 4px");
        burgLabels.select("#towns").style("text-shadow", "white 0 0 4px");
        labels.select("#states").style("text-shadow", "white 0 0 4px");
        labels.select("#addedLabels").style("text-shadow", "white 0 0 4px");
      }

      if (version < 1.64) {
        // v.1.64 change states style
        const opacity = regions.attr("opacity");
        const filter = regions.attr("filter");
        statesBody.attr("opacity", opacity).attr("filter", filter);
        statesHalo.attr("opacity", opacity).attr("filter", "blur(5px)");
        regions.attr("opacity", null).attr("filter", null);
      }

      if (version < 1.65) {
        // v 1.65 changed rivers data
        d3.select("#rivers").attr("style", null); // remove style to unhide layer
        const {cells, rivers} = pack;

        for (const river of rivers) {
          const node = document.getElementById("river" + river.i);
          if (node && !river.cells) {
            const riverCells = [];
            const riverPoints = [];

            const length = node.getTotalLength() / 2;
            const segments = Math.ceil(length / 6);
            const increment = length / segments;

            for (let i = 0; i <= segments; i++) {
              const shift = increment * i;
              const {x: x1, y: y1} = node.getPointAtLength(length + shift);
              const {x: x2, y: y2} = node.getPointAtLength(length - shift);
              const x = rn((x1 + x2) / 2, 1);
              const y = rn((y1 + y2) / 2, 1);

              const cell = findCell(x, y);
              riverPoints.push([x, y]);
              riverCells.push(cell);
            }

            river.cells = riverCells;
            river.points = riverPoints;
          }

          river.widthFactor = 1;

          cells.i.forEach(i => {
            const riverInWater = cells.r[i] && cells.h[i] < 20;
            if (riverInWater) cells.r[i] = 0;
          });
        }
      }

      if (version < 1.652) {
        // remove style to unhide layers
        rivers.attr("style", null);
        borders.attr("style", null);
      }
    })();

    void (function checkDataIntegrity() {
      const cells = pack.cells;

      if (pack.cells.i.length !== pack.cells.state.length) {
        ERROR && console.error("Striping issue. Map data is corrupted. The only solution is to edit the heightmap in erase mode");
      }

      const invalidStates = [...new Set(cells.state)].filter(s => !pack.states[s] || pack.states[s].removed);
      invalidStates.forEach(s => {
        const invalidCells = cells.i.filter(i => cells.state[i] === s);
        invalidCells.forEach(i => (cells.state[i] = 0));
        ERROR && console.error("Data Integrity Check. Invalid state", s, "is assigned to cells", invalidCells);
      });

      const invalidProvinces = [...new Set(cells.province)].filter(p => p && (!pack.provinces[p] || pack.provinces[p].removed));
      invalidProvinces.forEach(p => {
        const invalidCells = cells.i.filter(i => cells.province[i] === p);
        invalidCells.forEach(i => (cells.province[i] = 0));
        ERROR && console.error("Data Integrity Check. Invalid province", p, "is assigned to cells", invalidCells);
      });

      const invalidCultures = [...new Set(cells.culture)].filter(c => !pack.cultures[c] || pack.cultures[c].removed);
      invalidCultures.forEach(c => {
        const invalidCells = cells.i.filter(i => cells.culture[i] === c);
        invalidCells.forEach(i => (cells.province[i] = 0));
        ERROR && console.error("Data Integrity Check. Invalid culture", c, "is assigned to cells", invalidCells);
      });

      const invalidReligions = [...new Set(cells.religion)].filter(r => !pack.religions[r] || pack.religions[r].removed);
      invalidReligions.forEach(r => {
        const invalidCells = cells.i.filter(i => cells.religion[i] === r);
        invalidCells.forEach(i => (cells.religion[i] = 0));
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
        invalidCells.forEach(i => (cells.burg[i] = 0));
        ERROR && console.error("Data Integrity Check. Invalid burg", b, "is assigned to cells", invalidCells);
      });

      const invalidRivers = [...new Set(cells.r)].filter(r => r && !pack.rivers.find(river => river.i === r));
      invalidRivers.forEach(r => {
        const invalidCells = cells.i.filter(i => cells.r[i] === r);
        invalidCells.forEach(i => (cells.r[i] = 0));
        rivers.select("river" + r).remove();
        ERROR && console.error("Data Integrity Check. Invalid river", r, "is assigned to cells", invalidCells);
      });

      pack.burgs.forEach(b => {
        if (!b.i || b.removed) return;
        if (b.port < 0) {
          ERROR && console.error("Data Integrity Check. Burg", b.i, "has invalid port value", b.port);
          b.port = 0;
        }

        if (b.cell >= cells.i.length) {
          ERROR && console.error("Data Integrity Check. Burg", b.i, "is linked to invalid cell", b.cell);
          b.cell = findCell(b.x, b.y);
          cells.i.filter(i => cells.burg[i] === b.i).forEach(i => (cells.burg[i] = 0));
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
    })();

    changeMapSize();

    // remove href from emblems, to trigger rendering on load
    emblems.selectAll("use").attr("href", null);

    // draw data layers (no kept in svg)
    if (rulers && layerIsOn("toggleRulers")) rulers.draw();
    if (layerIsOn("toggleGrid")) drawGrid();

    // set options
    yearInput.value = options.year;
    eraInput.value = options.era;
    shapeRendering.value = viewbox.attr("shape-rendering") || "geometricPrecision";

    if (window.restoreDefaultEvents) restoreDefaultEvents();
    focusOn(); // based on searchParams focus on point, cell or burg
    invokeActiveZooming();

    WARN && console.warn(`TOTAL: ${rn((performance.now() - uploadMap.timeStart) / 1000, 2)}s`);
    showStatistics();
    INFO && console.groupEnd("Loaded Map " + seed);
    tip("Map is successfully loaded", true, "success", 7000);
  } catch (error) {
    ERROR && console.error(error);
    clearMainTip();

    alertMessage.innerHTML = `An error is occured on map loading. Select a different file to load,
      <br>generate a new random map or cancel the loading
      <p id="errorBox">${parseError(error)}</p>`;
    $("#alert").dialog({
      resizable: false,
      title: "Loading error",
      maxWidth: "50em",
      buttons: {
        "Select file": function () {
          $(this).dialog("close");
          mapToLoad.click();
        },
        "New map": function () {
          $(this).dialog("close");
          regenerateMap();
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      },
      position: {my: "center", at: "center", of: "svg"}
    });
  }
}
