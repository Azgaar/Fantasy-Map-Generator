"use strict";
// Functions to load and parse .map/.gz files
async function quickLoad() {
  const blob = await ldb.get("lastMap");
  if (blob) loadMapPrompt(blob);
  else {
    tip("No map stored. Save map to browser storage first", true, "error", 2000);
    ERROR && console.error("No map stored");
  }
}

async function loadFromDropbox() {
  const mapPath = byId("loadFromDropboxSelect")?.value;

  DEBUG && console.info("Loading map from Dropbox:", mapPath);
  const blob = await Cloud.providers.dropbox.load(mapPath);
  uploadMap(blob);
}

async function createSharableDropboxLink() {
  const mapFile = document.querySelector("#loadFromDropbox select").value;
  const sharableLink = byId("sharableLink");
  const sharableLinkContainer = byId("sharableLinkContainer");

  try {
    const previewLink = await Cloud.providers.dropbox.getLink(mapFile);
    const directLink = previewLink.replace("www.dropbox.com", "dl.dropboxusercontent.com"); // DL allows CORS
    const finalLink = `${location.origin}${location.pathname}?maplink=${directLink}`;

    sharableLink.innerText = finalLink.slice(0, 45) + "...";
    sharableLink.setAttribute("href", finalLink);
    sharableLinkContainer.style.display = "block";
  } catch (error) {
    ERROR && console.error(error);
    return tip("Dropbox API error. Can not create link.", true, "error", 2000);
  }
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
  fileReader.onloadend = async function (fileLoadedEvent) {
    if (callback) callback();
    byId("coas").innerHTML = ""; // remove auto-generated emblems
    const result = fileLoadedEvent.target.result;
    const [mapData, mapVersion] = await parseLoadedResult(result);

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

  fileReader.readAsArrayBuffer(file);
}

async function uncompress(compressedData) {
  try {
    const uncompressedStream = new Blob([compressedData]).stream().pipeThrough(new DecompressionStream("gzip"));

    let uncompressedData = [];
    for await (const chunk of uncompressedStream) {
      uncompressedData = uncompressedData.concat(Array.from(chunk));
    }

    return new Uint8Array(uncompressedData);
  } catch (error) {
    ERROR && console.error(error);
    return null;
  }
}

async function parseLoadedResult(result) {
  try {
    const resultAsString = new TextDecoder().decode(result);
    // data can be in FMG internal format or base64 encoded
    const isDelimited = resultAsString.substring(0, 10).includes("|");
    const decoded = isDelimited ? resultAsString : decodeURIComponent(atob(resultAsString));

    const mapData = decoded.split("\r\n");
    const mapVersion = parseFloat(mapData[0].split("|")[0] || mapData[0]);
    return [mapData, mapVersion];
  } catch (error) {
    // map file can be compressed with gzip
    const uncompressedData = await uncompress(result);
    if (uncompressedData) return parseLoadedResult(uncompressedData);

    ERROR && console.error(error);
    return [null, null];
  }
}

function showUploadMessage(type, mapData, mapVersion) {
  const archive = link("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog", "archived version");
  let message, title, canBeLoaded;

  if (type === "invalid") {
    message = `The file does not look like a valid save file.<br>Please check the data format`;
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
    INFO && console.info(`Loading map. Auto-update from ${mapVersion} to ${version}`);
    parseLoadedData(mapData, mapVersion);
    return;
  }

  alertMessage.innerHTML = message;
  const buttons = {
    OK: function () {
      $(this).dialog("close");
      if (canBeLoaded) parseLoadedData(mapData, mapVersion);
    }
  };
  $("#alert").dialog({title, buttons});
}

async function parseLoadedData(data, mapVersion) {
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

    // TODO: move all to options object
    void (function parseSettings() {
      const settings = data[1].split("|");
      if (settings[0]) applyOption(distanceUnitInput, settings[0]);
      if (settings[1]) distanceScale = distanceScaleInput.value = distanceScaleOutput.value = settings[1];
      if (settings[2]) areaUnit.value = settings[2];
      if (settings[3]) applyOption(heightUnit, settings[3]);
      if (settings[4]) heightExponentInput.value = heightExponentOutput.value = settings[4];
      if (settings[5]) temperatureScale.value = settings[5];
      // setting 6-11 (scaleBar) are part of style now, kept as "" in newer versions for compatibility
      if (settings[12]) populationRate = populationRateInput.value = populationRateOutput.value = settings[12];
      if (settings[13]) urbanization = urbanizationInput.value = urbanizationOutput.value = settings[13];
      if (settings[14]) mapSizeInput.value = mapSizeOutput.value = minmax(settings[14], 1, 100);
      if (settings[15]) latitudeInput.value = latitudeOutput.value = minmax(settings[15], 0, 100);
      if (settings[18]) precInput.value = precOutput.value = settings[18];
      if (settings[19]) options = JSON.parse(settings[19]);
      // setting 16 and 17 (temperature) are part of options now, kept as "" in newer versions for compatibility
      if (settings[16]) options.temperatureEquator = +settings[16];
      if (settings[17]) options.temperatureNorthPole = options.temperatureSouthPole = +settings[17];
      if (settings[20]) mapName.value = settings[20];
      if (settings[21]) hideLabels.checked = +settings[21];
      if (settings[22]) stylePreset.value = settings[22];
      if (settings[23]) rescaleLabels.checked = +settings[23];
      if (settings[24]) urbanDensity = urbanDensityInput.value = urbanDensityOutput.value = +settings[24];
    })();

    void (function applyOptionsToUI() {
      stateLabelsModeInput.value = options.stateLabelsMode;
      yearInput.value = options.year;
      eraInput.value = options.era;
      shapeRendering.value = viewbox.attr("shape-rendering") || "geometricPrecision";
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
      biomesData = Biomes.getDefault();
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

    void (function addMissingElements() {
      if (!texture.size()) {
        texture = viewbox
          .insert("g", "#landmass")
          .attr("id", "texture")
          .attr("data-href", "./images/textures/plaster.jpg");
      }
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
      const isVisible = selection => selection.node() && selection.style("display") !== "none";
      const isVisibleNode = node => node && node.style.display !== "none";
      const hasChildren = selection => selection.node()?.hasChildNodes();
      const hasChild = (selection, selector) => selection.node()?.querySelector(selector);
      const turnOn = el => byId(el).classList.remove("buttonoff");

      // turn all layers off
      byId("mapLayers")
        .querySelectorAll("li")
        .forEach(el => el.classList.add("buttonoff"));

      // turn on active layers
      if (hasChild(texture, "image")) turnOn("toggleTexture");
      if (hasChildren(terrs)) turnOn("toggleHeight");
      if (hasChildren(biomes)) turnOn("toggleBiomes");
      if (hasChildren(cells)) turnOn("toggleCells");
      if (hasChildren(gridOverlay)) turnOn("toggleGrid");
      if (hasChildren(coordinates)) turnOn("toggleCoordinates");
      if (isVisible(compass) && hasChild(compass, "use")) turnOn("toggleCompass");
      if (hasChildren(rivers)) turnOn("toggleRivers");
      if (isVisible(terrain) && hasChildren(terrain)) turnOn("toggleRelief");
      if (hasChildren(relig)) turnOn("toggleReligions");
      if (hasChildren(cults)) turnOn("toggleCultures");
      if (hasChildren(statesBody)) turnOn("toggleStates");
      if (hasChildren(provs)) turnOn("toggleProvinces");
      if (hasChildren(zones) && isVisible(zones)) turnOn("toggleZones");
      if (isVisible(borders) && hasChild(borders, "path")) turnOn("toggleBorders");
      if (isVisible(routes) && hasChild(routes, "path")) turnOn("toggleRoutes");
      if (hasChildren(temperature)) turnOn("toggleTemp");
      if (hasChild(population, "line")) turnOn("togglePopulation");
      if (hasChildren(ice)) turnOn("toggleIce");
      if (hasChild(prec, "circle")) turnOn("togglePrec");
      if (isVisible(emblems) && hasChild(emblems, "use")) turnOn("toggleEmblems");
      if (isVisible(labels)) turnOn("toggleLabels");
      if (isVisible(icons)) turnOn("toggleIcons");
      if (hasChildren(armies) && isVisible(armies)) turnOn("toggleMilitary");
      if (hasChildren(markers)) turnOn("toggleMarkers");
      if (isVisible(ruler)) turnOn("toggleRulers");
      if (isVisible(scaleBar)) turnOn("toggleScaleBar");
      if (isVisibleNode(byId("vignette"))) turnOn("toggleVignette");

      getCurrentPreset();
    })();

    void (function restoreEvents() {
      scaleBar.on("mousemove", () => tip("Click to open Units Editor")).on("click", () => editUnits());
      legend
        .on("mousemove", () => tip("Drag to change the position. Click to hide the legend"))
        .on("click", () => clearLegend());
    })();

    {
      // dynamically import and run auto-update script
      const versionNumber = parseFloat(params[0]);
      const {resolveVersionConflicts} = await import("../dynamic/auto-update.js?v=1.97.04");
      resolveVersionConflicts(versionNumber);
    }

    // add custom heightmap color scheme if any
    if (heightmapColorSchemes) {
      const oceanScheme = byId("oceanHeights")?.getAttribute("scheme");
      if (oceanScheme && !(oceanScheme in heightmapColorSchemes)) addCustomColorScheme(oceanScheme);
      const landScheme = byId("#landHeights")?.getAttribute("scheme");
      if (landScheme && !(landScheme in heightmapColorSchemes)) addCustomColorScheme(landScheme);
    }

    {
      // add custom texture if any
      const textureHref = texture.attr("data-href");
      if (textureHref) updateTextureSelectValue(textureHref);
    }

    void (function checkDataIntegrity() {
      const cells = pack.cells;

      if (pack.cells.i.length !== pack.cells.state.length) {
        const message = "Data integrity check. Striping issue detected. To fix edit the heightmap in ERASE mode";
        ERROR && console.error(message);
      }

      const invalidStates = [...new Set(cells.state)].filter(s => !pack.states[s] || pack.states[s].removed);
      invalidStates.forEach(s => {
        const invalidCells = cells.i.filter(i => cells.state[i] === s);
        invalidCells.forEach(i => (cells.state[i] = 0));
        ERROR && console.error("Data integrity check. Invalid state", s, "is assigned to cells", invalidCells);
      });

      const invalidProvinces = [...new Set(cells.province)].filter(
        p => p && (!pack.provinces[p] || pack.provinces[p].removed)
      );
      invalidProvinces.forEach(p => {
        const invalidCells = cells.i.filter(i => cells.province[i] === p);
        invalidCells.forEach(i => (cells.province[i] = 0));
        ERROR && console.error("Data integrity check. Invalid province", p, "is assigned to cells", invalidCells);
      });

      const invalidCultures = [...new Set(cells.culture)].filter(c => !pack.cultures[c] || pack.cultures[c].removed);
      invalidCultures.forEach(c => {
        const invalidCells = cells.i.filter(i => cells.culture[i] === c);
        invalidCells.forEach(i => (cells.province[i] = 0));
        ERROR && console.error("Data integrity check. Invalid culture", c, "is assigned to cells", invalidCells);
      });

      const invalidReligions = [...new Set(cells.religion)].filter(
        r => !pack.religions[r] || pack.religions[r].removed
      );
      invalidReligions.forEach(r => {
        const invalidCells = cells.i.filter(i => cells.religion[i] === r);
        invalidCells.forEach(i => (cells.religion[i] = 0));
        ERROR && console.error("Data integrity check. Invalid religion", r, "is assigned to cells", invalidCells);
      });

      const invalidFeatures = [...new Set(cells.f)].filter(f => f && !pack.features[f]);
      invalidFeatures.forEach(f => {
        const invalidCells = cells.i.filter(i => cells.f[i] === f);
        // No fix as for now
        ERROR && console.error("Data integrity check. Invalid feature", f, "is assigned to cells", invalidCells);
      });

      const invalidBurgs = [...new Set(cells.burg)].filter(
        burgId => burgId && (!pack.burgs[burgId] || pack.burgs[burgId].removed)
      );
      invalidBurgs.forEach(burgId => {
        const invalidCells = cells.i.filter(i => cells.burg[i] === burgId);
        invalidCells.forEach(i => (cells.burg[i] = 0));
        ERROR && console.error("Data integrity check. Invalid burg", burgId, "is assigned to cells", invalidCells);
      });

      const invalidRivers = [...new Set(cells.r)].filter(r => r && !pack.rivers.find(river => river.i === r));
      invalidRivers.forEach(r => {
        const invalidCells = cells.i.filter(i => cells.r[i] === r);
        invalidCells.forEach(i => (cells.r[i] = 0));
        rivers.select("river" + r).remove();
        ERROR && console.error("Data integrity check. Invalid river", r, "is assigned to cells", invalidCells);
      });

      pack.burgs.forEach(burg => {
        if (typeof burg.capital === "boolean") burg.capital = Number(burg.capital);

        if (!burg.i && burg.lock) {
          ERROR && console.error(`Data integrity check. Burg 0 is marked as locked, removing the status`);
          delete burg.lock;
          return;
        }

        if (burg.removed && burg.lock) {
          ERROR &&
            console.error(`Data integrity check. Removed burg ${burg.i} is marked as locked. Unlocking the burg`);
          delete burg.lock;
          return;
        }

        if (!burg.i || burg.removed) return;

        if (burg.cell === undefined || burg.x === undefined || burg.y === undefined) {
          ERROR &&
            console.error(
              `Data integrity check. Burg ${burg.i} is missing cell info or coordinates. Removing the burg`
            );
          burg.removed = true;
        }

        if (burg.port < 0) {
          ERROR && console.error("Data integrity check. Burg", burg.i, "has invalid port value", burg.port);
          burg.port = 0;
        }

        if (burg.cell >= cells.i.length) {
          ERROR && console.error("Data integrity check. Burg", burg.i, "is linked to invalid cell", burg.cell);
          burg.cell = findCell(burg.x, burg.y);
          cells.i.filter(i => cells.burg[i] === burg.i).forEach(i => (cells.burg[i] = 0));
          cells.burg[burg.cell] = burg.i;
        }

        if (burg.state && !pack.states[burg.state]) {
          ERROR && console.error("Data integrity check. Burg", burg.i, "is linked to invalid state", burg.state);
          burg.state = 0;
        }

        if (burg.state && pack.states[burg.state].removed) {
          ERROR && console.error("Data integrity check. Burg", burg.i, "is linked to removed state", burg.state);
          burg.state = 0;
        }

        if (burg.state === undefined) {
          ERROR && console.error("Data integrity check. Burg", burg.i, "has no state data");
          burg.state = 0;
        }
      });

      pack.states.forEach(state => {
        if (state.removed) return;

        const stateBurgs = pack.burgs.filter(b => b.state === state.i && !b.removed);
        const capitalBurgs = stateBurgs.filter(b => b.capital);

        if (!state.i && capitalBurgs.length) {
          ERROR &&
            console.error(
              `Data integrity check. Neutral burgs (${capitalBurgs
                .map(b => b.i)
                .join(", ")}) marked as capitals. Moving them to towns`
            );

          capitalBurgs.forEach(burg => {
            burg.capital = 0;
            moveBurgToGroup(burg.i, "towns");
          });

          return;
        }

        if (capitalBurgs.length > 1) {
          const message = `Data integrity check. State ${state.i} has multiple capitals (${capitalBurgs
            .map(b => b.i)
            .join(", ")}) assigned. Keeping the first as capital and moving others to towns`;
          ERROR && console.error(message);

          capitalBurgs.forEach((burg, i) => {
            if (!i) return;
            burg.capital = 0;
            moveBurgToGroup(burg.i, "towns");
          });

          return;
        }

        if (state.i && stateBurgs.length && !capitalBurgs.length) {
          ERROR &&
            console.error(`Data integrity check. State ${state.i} has no capital. Assigning the first burg as capital`);
          stateBurgs[0].capital = 1;
          moveBurgToGroup(stateBurgs[0].i, "cities");
        }
      });

      pack.provinces.forEach(p => {
        if (!p.i || p.removed) return;
        if (pack.states[p.state] && !pack.states[p.state].removed) return;
        ERROR && console.error("Data integrity check. Province", p.i, "is linked to removed state", p.state);
        p.removed = true; // remove incorrect province
      });

      {
        const markerIds = [];
        let nextId = last(pack.markers)?.i + 1 || 0;

        pack.markers.forEach(marker => {
          if (markerIds[marker.i]) {
            ERROR && console.error("Data integrity check. Marker", marker.i, "has non-unique id. Changing to", nextId);

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

    fitMapToScreen();

    // remove href from emblems, to trigger rendering on load
    emblems.selectAll("use").attr("href", null);

    // draw data layers (no kept in svg)
    if (rulers && layerIsOn("toggleRulers")) rulers.draw();
    if (layerIsOn("toggleGrid")) drawGrid();

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

    alertMessage.innerHTML = /* html */ `An error is occured on map loading. Select a different file to load, <br>generate a new random map or cancel the loading.<br>Map version: ${mapVersion}. Generator version: ${version}.
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
