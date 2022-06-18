"use strict";
// Functions to load and parse .map files

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
  const mapPath = document.getElementById("loadFromDropboxSelect")?.value;

  DEBUG && console.log("Loading map from Dropbox:", mapPath);
  const blob = await Cloud.providers.dropbox.load(mapPath);
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
    return tip("Dropbox API error. Can not create link.", true, "error", 2000);
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

  alertMessage.innerHTML = /* html */ `Are you sure you want to load saved map?<br />
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
  alertMessage.innerHTML = /* html */ `Cannot load map from the ${link(URL, "link provided")}. ${
    random ? `A new random map is generated. ` : ""
  } Please ensure the
  linked file is reachable and CORS is allowed on server side`;
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
    ERROR && console.error(error);
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

async function parseLoadedData(data) {
  try {
    // exit customization
    if (window.closeDialogs) closeDialogs();
    customization = 0;
    if (customizationMenu.offsetParent) styleTab.click();

    const params = data[0].split("|");
    void (function parseParameters() {
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
      if (settings[1]) distanceScale = distanceScaleInput.value = distanceScaleOutput.value = settings[1];
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
      if (settings[14]) mapSizeInput.value = mapSizeOutput.value = minmax(settings[14], 1, 100);
      if (settings[15]) latitudeInput.value = latitudeOutput.value = minmax(settings[15], 0, 100);
      if (settings[16]) temperatureEquatorInput.value = temperatureEquatorOutput.value = settings[16];
      if (settings[17]) temperaturePoleInput.value = temperaturePoleOutput.value = settings[17];
      if (settings[18]) precInput.value = precOutput.value = settings[18];
      if (settings[19]) options = JSON.parse(settings[19]);
      if (settings[20]) mapName.value = settings[20];
      if (settings[21]) hideLabels.checked = +settings[21];
      if (settings[22]) stylePreset.value = settings[22];
      if (settings[23]) rescaleLabels.checked = +settings[23];
      if (settings[24]) urbanDensity = urbanDensityInput.value = urbanDensityOutput.value = +settings[24];
      if (settings[25]) gridAlgorithm.value = settings[25];
    })();

    void (function applyOptionsToUI() {
      stateLabelsModeInput.value = options.stateLabelsMode;
    })();

    void (function parseConfiguration() {
      if (data[2]) mapCoordinates = JSON.parse(data[2]);
      if (data[4]) notes = JSON.parse(data[4]);
      if (data[33]) rulers.fromString(data[33]);
      if (data[34]) {
        const usedFonts = JSON.parse(data[34]);
        usedFonts.forEach(usedFont => {
          const {family: usedFamily, unicodeRange: usedRange, variant: usedVariant} = usedFont;
          const defaultFont = fonts.find(
            ({family, unicodeRange, variant}) =>
              family === usedFamily && unicodeRange === usedRange && variant === usedVariant
          );
          if (!defaultFont) fonts.push(usedFont);
          declareFont(usedFont);
        });
      }

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

    void (function parseGridData() {
      grid = JSON.parse(data[6]);

      const {cells, vertices} = calculateVoronoi(grid.points, grid.boundary);
      grid.cells = cells;
      grid.vertices = vertices;

      grid.cells.h = Uint8Array.from(data[7].split(","));
      grid.cells.prec = Uint8Array.from(data[8].split(","));
      grid.cells.f = Uint16Array.from(data[9].split(","));
      grid.cells.t = Int8Array.from(data[10].split(","));
      grid.cells.temp = Int8Array.from(data[11].split(","));
    })();

    void (function parsePackData() {
      reGraph();
      reMarkFeatures();
      pack.features = JSON.parse(data[12]);
      pack.cultures = JSON.parse(data[13]);
      pack.states = JSON.parse(data[14]);
      pack.burgs = JSON.parse(data[15]);
      pack.religions = data[29] ? JSON.parse(data[29]) : [{i: 0, name: "No religion"}];
      pack.provinces = data[30] ? JSON.parse(data[30]) : [0];
      pack.rivers = data[32] ? JSON.parse(data[32]) : [];
      pack.markers = data[35] ? JSON.parse(data[35]) : [];

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
      if (hasChildren(markers)) turnOn("toggleMarkers");
      if (notHidden(ruler)) turnOn("toggleRulers");
      if (notHidden(scaleBar)) turnOn("toggleScaleBar");

      getCurrentPreset();
    })();

    void (function restoreEvents() {
      scaleBar.on("mousemove", () => tip("Click to open Units Editor")).on("click", () => editUnits());
      legend
        .on("mousemove", () => tip("Drag to change the position. Click to hide the legend"))
        .on("click", () => clearLegend());
    })();

    {
      // dynamically import and run auto-udpdate script
      const versionNumber = parseFloat(params[0]);
      const {resolveVersionConflicts} = await import("../dynamic/auto-update.js?v=06062022");
      resolveVersionConflicts(versionNumber);
    }

    void (function checkDataIntegrity() {
      const cells = pack.cells;

      if (pack.cells.i.length !== pack.cells.state.length) {
        ERROR &&
          console.error(
            "Striping issue. Map data is corrupted. The only solution is to edit the heightmap in erase mode"
          );
      }

      const invalidStates = [...new Set(cells.state)].filter(s => !pack.states[s] || pack.states[s].removed);
      invalidStates.forEach(s => {
        const invalidCells = cells.i.filter(i => cells.state[i] === s);
        invalidCells.forEach(i => (cells.state[i] = 0));
        ERROR && console.error("Data Integrity Check. Invalid state", s, "is assigned to cells", invalidCells);
      });

      const invalidProvinces = [...new Set(cells.province)].filter(
        p => p && (!pack.provinces[p] || pack.provinces[p].removed)
      );
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

      const invalidReligions = [...new Set(cells.religion)].filter(
        r => !pack.religions[r] || pack.religions[r].removed
      );
      invalidReligions.forEach(r => {
        const invalidCells = cells.i.filter(i => cells.religion[i] === r);
        invalidCells.forEach(i => (cells.religion[i] = 0));
        ERROR && console.error("Data Integrity Check. Invalid religion", r, "is assigned to cells", invalidCells);
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

      pack.burgs.forEach(burg => {
        if (!burg.i || burg.removed) return;
        if (burg.port < 0) {
          ERROR && console.error("Data Integrity Check. Burg", burg.i, "has invalid port value", burg.port);
          burg.port = 0;
        }

        if (burg.cell >= cells.i.length) {
          ERROR && console.error("Data Integrity Check. Burg", burg.i, "is linked to invalid cell", burg.cell);
          burg.cell = findCell(burg.x, burg.y);
          cells.i.filter(i => cells.burg[i] === burg.i).forEach(i => (cells.burg[i] = 0));
          cells.burg[burg.cell] = burg.i;
        }

        if (burg.state && !pack.states[burg.state]) {
          ERROR && console.error("Data Integrity Check. Burg", burg.i, "is linked to invalid state", burg.state);
          burg.state = 0;
        }

        if (burg.state === undefined) {
          ERROR && console.error("Data Integrity Check. Burg", burg.i, "has no state data");
          burg.state = 0;
        }
      });

      pack.provinces.forEach(p => {
        if (!p.i || p.removed) return;
        if (pack.states[p.state] && !pack.states[p.state].removed) return;
        ERROR && console.error("Data Integrity Check. Province", p.i, "is linked to removed state", p.state);
        p.removed = true; // remove incorrect province
      });

      {
        const markerIds = [];
        let nextId = last(pack.markers)?.i + 1 || 0;

        pack.markers.forEach(marker => {
          if (markerIds[marker.i]) {
            ERROR && console.error("Data Integrity Check. Marker", marker.i, "has non-unique id. Changing to", nextId);

            const domElements = document.querySelectorAll("#marker" + marker.i);
            if (domElements[1]) domElements[1].id = "marker" + nextId; // rename 2nd dom element

            const noteElements = notes.filter(note => note.id === "marker" + marker.i);
            if (noteElements[1]) noteElements[1].id = "marker" + nextId; // rename 2nd note

            marker.i = nextId;
            nextId += 1;
          } else {
            markerIds[marker.i] = true;
          }
        });

        // sort markers by index
        pack.markers.sort((a, b) => a.i - b.i);
      }
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

    alertMessage.innerHTML = /* html */ `An error is occured on map loading. Select a different file to load, <br />generate a new random map or cancel the loading
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
          regenerateMap("loading error");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      },
      position: {my: "center", at: "center", of: "svg"}
    });
  }
}
