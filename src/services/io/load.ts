import { Services } from "@/services";
import { calculateVoronoi, ensureEl, last, link, minmax, parseError, rn } from "@/utils";

async function quickLoad(): Promise<void> {
  const blob = await ldb.get("lastMap");
  if (blob) loadMapPrompt(blob);
  else {
    tip("No map stored. Save map to browser storage first", true, "error", 2000);
    ERROR && console.error("No map stored");
  }
}

async function loadFromDropbox(): Promise<void> {
  const mapPath = ensureEl<HTMLInputElement>("loadFromDropboxSelect").value;

  console.info("Loading map from Dropbox:", mapPath);
  const blob = await Services.Cloud.load(mapPath);
  uploadMap(blob);
}

async function createSharableDropboxLink(): Promise<void> {
  const mapFile = (document.querySelector("#loadFromDropbox select") as HTMLSelectElement).value;
  const sharableLink = ensureEl("sharableLink");
  const sharableLinkContainer = ensureEl("sharableLinkContainer");

  try {
    const previewLink = await Services.Cloud.getLink(mapFile);
    const directLink = previewLink.replace("www.dropbox.com", "dl.dropboxusercontent.com"); // DL allows CORS
    const finalLink = `${location.origin}${location.pathname}?maplink=${directLink}`;

    sharableLink.innerText = `${finalLink.slice(0, 45)}...`;
    sharableLink.setAttribute("href", finalLink);
    sharableLinkContainer.style.display = "block";
  } catch (error) {
    ERROR && console.error(error);
    return tip("Dropbox API error. Can not create link.", true, "error", 2000);
  }
}

function loadMapPrompt(blob: Blob): void {
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
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      },
      Load: function (this: HTMLElement) {
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

async function loadMapFromURL(maplink: string, random?: boolean): Promise<void> {
  const controller = new AbortController();
  const TIMEOUT = 120000; // 120 seconds
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const url = decodeURIComponent(maplink);
    const response = await fetch(url, { method: "GET", mode: "cors", signal: controller.signal });
    if (!response.ok) throw new Error("Cannot load map from URL");

    const blob = await response.blob();
    uploadMap(blob);
  } catch (error) {
    const message =
      (error as Error)?.name === "AbortError"
        ? "Cannot load map from URL: request timed out"
        : (error as Error).message;
    showUploadErrorMessage(message, maplink, random);
    if (random) generateMapOnLoad();
  } finally {
    clearTimeout(timeoutId);
  }
}

function showUploadErrorMessage(error: string, maplink: string, random?: boolean): void {
  ERROR && console.error(error);
  alertMessage.innerHTML = /* html */ `Cannot load map from the ${link(maplink, "link provided")}. ${
    random ? `A new random map is generated. ` : ""
  } Please ensure the
  linked file is reachable and CORS is allowed on server side`;
  $("#alert").dialog({
    title: "Loading error",
    width: "32em",
    buttons: {
      "Clear cache": () => cleanupData(),
      OK: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

let uploadTimeStart = 0;

function uploadMap(file: Blob, callback?: () => void): void {
  uploadTimeStart = performance.now();

  const fileReader = new FileReader();
  fileReader.onloadend = async fileLoadedEvent => {
    if (callback) callback();
    ensureEl("coas").innerHTML = ""; // remove auto-generated emblems

    const result = fileLoadedEvent.target!.result as ArrayBuffer;
    const { mapData, mapVersion } = await parseLoadedResult(result);

    const isInvalid = !mapData || !isValidVersion(mapVersion!) || mapData.length < 10 || !mapData[5];
    if (isInvalid) return showUploadMessage("invalid", mapData, mapVersion);

    const isUpdated = compareVersions(mapVersion!, VERSION).isEqual;
    if (isUpdated) return showUploadMessage("updated", mapData, mapVersion);

    const isAncient = compareVersions(mapVersion!, "0.70.0").isOlder;
    if (isAncient) return showUploadMessage("ancient", mapData, mapVersion);

    const isNewer = compareVersions(mapVersion!, VERSION).isNewer;
    if (isNewer) return showUploadMessage("newer", mapData, mapVersion);

    const isOutdated = compareVersions(mapVersion!, VERSION).isOlder;
    if (isOutdated) return showUploadMessage("outdated", mapData, mapVersion);
  };

  fileReader.readAsArrayBuffer(file);
}

async function uncompress(compressedData: ArrayBuffer): Promise<Uint8Array | null> {
  try {
    const uncompressedStream = new Blob([compressedData]).stream().pipeThrough(new DecompressionStream("gzip"));

    let uncompressedData: number[] = [];
    for await (const chunk of uncompressedStream) {
      uncompressedData = uncompressedData.concat(Array.from(chunk));
    }

    return new Uint8Array(uncompressedData);
  } catch (error) {
    ERROR && console.error(error);
    return null;
  }
}

async function parseLoadedResult(
  result: ArrayBuffer | Uint8Array
): Promise<{ mapData: string[] | null; mapVersion: string | null }> {
  try {
    const resultAsString = new TextDecoder().decode(result);

    // data can be in FMG internal format or base64 encoded
    const isDelimited = resultAsString.substring(0, 10).includes("|");
    let content = isDelimited ? resultAsString : decodeURIComponent(atob(resultAsString));

    // fix if svg part has CRLF line endings instead of LF
    const svgMatch = content.match(/<svg[^>]*id="map"[\s\S]*?<\/svg>/);
    const svgContent = svgMatch![0];
    const hasCrlfEndings = svgContent.includes("\r\n");
    if (hasCrlfEndings) {
      const correctedSvgContent = svgContent.replace(/\r\n/g, "\n");
      content = content.replace(svgContent, correctedSvgContent);
    }

    const mapData = content.split("\r\n"); // split by CRLF
    const mapVersion = parseMapVersion(mapData[0].split("|")[0] || mapData[0] || "");

    return { mapData, mapVersion };
  } catch (error) {
    const uncompressedData = await uncompress(result as ArrayBuffer); // file can be gzip compressed
    if (uncompressedData) return parseLoadedResult(uncompressedData);

    ERROR && console.error(error);
    return { mapData: null, mapVersion: null };
  }
}

function showUploadMessage(type: string, mapData: string[] | null, mapVersion: string | null): void {
  let message = "";
  let title = "";

  if (type === "invalid") {
    message = "The file does not look like a valid save file.<br>Please check the data format";
    title = "Invalid file";
  } else if (type === "updated") {
    parseLoadedData(mapData!, mapVersion);
    return;
  } else if (type === "ancient") {
    const archive = link("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog", "archived version");
    message = `The map version you are trying to load (${mapVersion}) is too old and cannot be updated to the current version.<br>Please keep using an ${archive}`;
    title = "Ancient file";
  } else if (type === "newer") {
    message = `The map version you are trying to load (${mapVersion}) is newer than the current version.<br>Please load the file in the appropriate version`;
    title = "Newer file";
  } else if (type === "outdated") {
    INFO && console.info(`Loading map. Auto-updating from ${mapVersion} to ${VERSION}`);
    parseLoadedData(mapData!, mapVersion);
    return;
  }

  alertMessage.innerHTML = message;
  $("#alert").dialog({
    title,
    buttons: {
      "Clear cache": () => cleanupData(),
      OK: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

async function parseLoadedData(data: string[], mapVersion: string | null): Promise<void> {
  try {
    // exit customization
    if (typeof window.closeDialogs === "function") closeDialogs();
    customization = 0;
    if (ensureEl("customizationMenu").offsetParent) ensureEl("styleTab").click();

    {
      const params = data[0].split("|");
      if (params[3]) {
        seed = params[3];
        ensureEl<HTMLInputElement>("optionsSeed").value = seed;
        INFO && console.group(`Loaded Map ${seed}`);
      } else INFO && console.group("Loaded Map");
      if (params[4]) graphWidth = +params[4];
      if (params[5]) graphHeight = +params[5];
      mapId = params[6] ? +params[6] : Date.now();
    }

    {
      const settings = data[1].split("|");
      if (settings[0]) applyOption(distanceUnitInput, settings[0]);
      if (settings[1]) {
        ensureEl<HTMLInputElement>("distanceScaleInput").value = settings[1];
        distanceScale = +settings[1];
      }
      if (settings[2]) areaUnit.value = settings[2];
      if (settings[3]) applyOption(heightUnit, settings[3]);
      if (settings[4]) heightExponentInput.value = settings[4];
      if (settings[5]) temperatureScale.value = settings[5];
      // setting 6-11 (scaleBar) are part of style now, kept as "" in newer versions for compatibility
      if (settings[12]) {
        ensureEl<HTMLInputElement>("populationRateInput").value = settings[12];
        populationRate = +settings[12];
      }
      if (settings[13]) {
        ensureEl<HTMLInputElement>("urbanizationInput").value = settings[13];
        urbanization = +settings[13];
      }
      if (settings[14]) {
        const mapSize = String(minmax(+settings[14], 1, 100));
        ensureEl<HTMLInputElement>("mapSizeInput").value = mapSize;
        mapSizeOutput.value = mapSize;
      }
      if (settings[15]) {
        const latitude = String(minmax(+settings[15], 0, 100));
        ensureEl<HTMLInputElement>("latitudeInput").value = latitude;
        latitudeOutput.value = latitude;
      }
      if (settings[18]) {
        ensureEl<HTMLInputElement>("precInput").value = settings[18];
        precOutput.value = settings[18];
      }
      if (settings[19]) options = JSON.parse(settings[19]);
      // setting 16 and 17 (temperature) are part of options now, kept as "" in newer versions for compatibility
      if (settings[16]) options.temperatureEquator = +settings[16];
      if (settings[17]) options.temperatureNorthPole = options.temperatureSouthPole = +settings[17];
      if (settings[20]) mapName.value = settings[20];
      if (settings[21]) hideLabels.checked = Boolean(+settings[21]);
      if (settings[22]) stylePreset.value = settings[22];
      if (settings[23]) rescaleLabels.checked = Boolean(+settings[23]);
      if (settings[24]) {
        ensureEl<HTMLInputElement>("urbanDensityInput").value = settings[24];
        urbanDensity = +settings[24];
      }
      if (settings[25]) {
        const longitude = String(minmax(+(settings[25] || 50), 0, 100));
        ensureEl<HTMLInputElement>("longitudeInput").value = longitude;
        longitudeOutput.value = longitude;
      }
      if (settings[26]) ensureEl<HTMLInputElement>("growthRate").value = settings[26];
    }
    ensureEl<HTMLInputElement>("stateLabelsModeInput").value = options.stateLabelsMode;
    ensureEl<HTMLInputElement>("yearInput").value = String(options.year);
    ensureEl<HTMLInputElement>("eraInput").value = options.era;
    ensureEl<HTMLInputElement>("shapeRendering").value = viewbox.attr("shape-rendering") || "geometricPrecision";
    if (data[2]) mapCoordinates = JSON.parse(data[2]);
    if (data[4]) notes = JSON.parse(data[4]);
    if (data[33]) rulers.fromString(data[33]);
    if (data[34]) {
      const usedFonts = JSON.parse(data[34]);
      usedFonts.forEach((usedFont: (typeof fonts)[number]) => {
        const { family: usedFamily, unicodeRange: usedRange, variant: usedVariant } = usedFont;
        const defaultFont = fonts.find(
          ({ family, unicodeRange, variant }) =>
            family === usedFamily && unicodeRange === usedRange && variant === usedVariant
        );
        if (!defaultFont) fonts.push(usedFont);
        declareFont(usedFont);
      });
    }

    {
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
    }
    svg.remove();
    document.body.insertAdjacentHTML("afterbegin", data[5]);
    // Reselect with the global d3 v5 (not the bundled d3 v7 `select`): the global
    // `svg`/`viewbox` selections are consumed by legacy v5 code (zoom behavior,
    // `d3.mouse`, `d3.event`). A v7 selection dispatches events without setting the
    // v5 global `d3.event`, breaking mouse/zoom handlers after a map load (#1508).
    // Every layer selection below chains off `svg`, so they all inherit v5.
    svg = (window as any).d3.select("#map") as typeof svg;
    defs = svg.select<SVGDefsElement>("#deftemp");
    viewbox = svg.select<SVGElement>("#viewbox");
    scaleBar = svg.select<SVGGElement>("#scaleBar");
    legend = svg.select("#legend");
    ocean = viewbox.select<SVGGElement>("#ocean");
    oceanLayers = ocean.select<SVGGElement>("#oceanLayers");
    oceanPattern = ocean.select<SVGGElement>("#oceanPattern");
    lakes = viewbox.select<SVGGElement>("#lakes");
    landmass = viewbox.select<SVGGElement>("#landmass");
    texture = viewbox.select<SVGGElement>("#texture");
    terrs = viewbox.select<SVGGElement>("#terrs");
    biomes = viewbox.select<SVGGElement>("#biomes");
    ice = viewbox.select<SVGGElement>("#ice");
    cells = viewbox.select<SVGGElement>("#cells");
    gridOverlay = viewbox.select<SVGGElement>("#gridOverlay");
    coordinates = viewbox.select<SVGGElement>("#coordinates");
    compass = viewbox.select<SVGGElement>("#compass");
    rivers = viewbox.select<SVGElement>("#rivers");
    terrain = viewbox.select<SVGGElement>("#terrain");
    relig = viewbox.select<SVGGElement>("#relig");
    cults = viewbox.select<SVGGElement>("#cults");
    regions = viewbox.select<SVGGElement>("#regions");
    statesBody = regions.select<SVGGElement>("#statesBody");
    statesHalo = regions.select<SVGGElement>("#statesHalo");
    provs = viewbox.select<SVGGElement>("#provs");
    zones = viewbox.select<SVGGElement>("#zones");
    borders = viewbox.select<SVGGElement>("#borders");
    stateBorders = borders.select<SVGGElement>("#stateBorders");
    provinceBorders = borders.select<SVGGElement>("#provinceBorders");
    routes = viewbox.select<SVGElement>("#routes");
    roads = routes.select<SVGGElement>("#roads");
    trails = routes.select<SVGGElement>("#trails");
    searoutes = routes.select<SVGGElement>("#searoutes");
    temperature = viewbox.select<SVGGElement>("#temperature");
    coastline = viewbox.select<SVGGElement>("#coastline");
    prec = viewbox.select<SVGGElement>("#prec");
    population = viewbox.select<SVGGElement>("#population");
    goods = viewbox.select<SVGGElement>("#goods");
    markets = viewbox.select<SVGGElement>("#markets");
    emblems = viewbox.select<SVGElement>("#emblems");
    labels = viewbox.select<SVGGElement>("#labels");
    icons = viewbox.select<SVGGElement>("#icons");
    burgIcons = icons.select<SVGGElement>("#burgIcons");
    anchors = icons.select<SVGGElement>("#anchors");
    armies = viewbox.select<SVGGElement>("#armies");
    markers = viewbox.select<SVGGElement>("#markers");
    tradeAnimation = viewbox.select<SVGGElement>("#tradeAnimation");
    ruler = viewbox.select<SVGGElement>("#ruler");
    fogging = viewbox.select<SVGGElement>("#fogging");
    debug = viewbox.select<SVGElement>("#debug");
    burgLabels = labels.select<SVGGElement>("#burgLabels");

    if (!texture.size()) {
      texture = viewbox
        .insert("g", "#landmass")
        .attr("id", "texture")
        .attr("data-href", "./images/textures/plaster.jpg");
    }
    if (!emblems.size()) {
      emblems = viewbox
        .insert("g", "#labels")
        .attr("id", "emblems")
        .style("display", "none") as unknown as typeof emblems;
    }

    {
      grid = JSON.parse(data[6]);
      const { cells, vertices } = calculateVoronoi(grid.points, grid.boundary);
      grid.cells = cells;
      grid.vertices = vertices;
      grid.cells.h = Uint8Array.from(data[7].split(","), Number);
      grid.cells.prec = Uint8Array.from(data[8].split(","), Number);
      grid.cells.f = Uint16Array.from(data[9].split(","), Number);
      grid.cells.t = Int8Array.from(data[10].split(","), Number);
      grid.cells.temp = Int8Array.from(data[11].split(","), Number);
    }
    reGraph();
    Features.markupPack();
    pack.features = JSON.parse(data[12]);
    pack.cultures = JSON.parse(data[13]);
    pack.states = JSON.parse(data[14]);
    pack.burgs = JSON.parse(data[15]);
    pack.religions = data[29] ? JSON.parse(data[29]) : ([{ i: 0, name: "No religion" }] as typeof pack.religions);
    pack.provinces = data[30] ? JSON.parse(data[30]) : ([0] as unknown as typeof pack.provinces);
    pack.rivers = data[32] ? JSON.parse(data[32]) : [];
    pack.markers = data[35] ? JSON.parse(data[35]) : [];
    pack.routes = data[37] ? JSON.parse(data[37]) : [];
    pack.zones = data[38] ? JSON.parse(data[38]) : [];
    pack.cells.biome = Uint8Array.from(data[16].split(","), Number);
    pack.cells.burg = Uint16Array.from(data[17].split(","), Number);
    pack.cells.conf = Uint8Array.from(data[18].split(","), Number);
    pack.cells.culture = Uint16Array.from(data[19].split(","), Number);
    pack.cells.fl = Uint16Array.from(data[20].split(","), Number);
    pack.cells.pop = Float32Array.from(data[21].split(","), Number);
    pack.cells.r = Uint16Array.from(data[22].split(","), Number);
    // data[23] had deprecated cells.road
    pack.cells.s = Uint16Array.from(data[24].split(","), Number);
    pack.cells.state = Uint16Array.from(data[25].split(","), Number);
    pack.cells.religion = data[26]
      ? Uint16Array.from(data[26].split(","), Number)
      : new Uint16Array(pack.cells.i.length);
    pack.cells.province = data[27]
      ? Uint16Array.from(data[27].split(","), Number)
      : new Uint16Array(pack.cells.i.length);
    // data[28] had deprecated cells.crossroad
    pack.cells.routes = data[36] ? JSON.parse(data[36]) : {};
    pack.ice = data[39] ? JSON.parse(data[39]) : [];
    pack.cells.good = data[40] ? Uint16Array.from(data[40].split(","), Number) : new Uint16Array(pack.cells.i.length);
    pack.goods = data[41] ? JSON.parse(data[41]) : [];
    pack.markets = data[42] ? JSON.parse(data[42]) : [];
    pack.deals = data[43] ? JSON.parse(data[43]) : [];
    pack.cells.market = data[44] ? Uint16Array.from(data[44].split(","), Number) : new Uint16Array(pack.cells.i.length);

    if (data[31]) {
      const namesDL = data[31].split("/");
      namesDL.forEach((d, i) => {
        const e = d.split("|");
        if (!e.length) return;
        const b = e[5].split(",").length > 2 || !nameBases[i] ? e[5] : nameBases[i].b;
        nameBases[i] = { name: e[0], i, min: +e[1], max: +e[2], d: e[3], m: +e[4], b };
      });
    }

    // data[45]: custom good icons
    if (data[45]) {
      const goodIconsDefs = document.getElementById("good-icons");
      if (goodIconsDefs) goodIconsDefs.insertAdjacentHTML("beforeend", data[45]);
    }

    {
      const isVisible = (selection: { node(): Element | null; style(name: string): string }) =>
        selection.node() && selection.style("display") !== "none";
      const isVisibleNode = (node: HTMLElement | null) => node && node.style.display !== "none";
      const hasChildren = (selection: { node(): Element | null }) => selection.node()?.hasChildNodes();
      const hasChild = (selection: { node(): Element | null }, selector: string) =>
        selection.node()?.querySelector(selector);
      const turnOn = (el: string) => ensureEl(el).classList.remove("buttonoff");

      // turn all layers off
      ensureEl("mapLayers")
        .querySelectorAll("li")
        .forEach(el => {
          el.classList.add("buttonoff");
        });

      // turn on active layers
      if (hasChild(texture, "image")) turnOn("toggleTexture");
      if (hasChildren(terrs.select("#landHeights"))) turnOn("toggleHeight");
      if (isVisible(lakes)) turnOn("toggleLakes");
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
      if (hasChildren(temperature)) turnOn("toggleTemperature");
      if (hasChild(population, "line")) turnOn("togglePopulation");
      if (isVisible(ice)) turnOn("toggleIce");
      if (hasChild(prec, "circle")) turnOn("togglePrecipitation");
      if (isVisible(emblems) && hasChild(emblems, "use")) turnOn("toggleEmblems");
      if (isVisible(labels)) turnOn("toggleLabels");
      if (isVisible(icons)) turnOn("toggleBurgIcons");
      if (hasChildren(armies) && isVisible(armies)) turnOn("toggleMilitary");
      if (hasChild(markers, "svg")) turnOn("toggleMarkers");
      if (isVisible(tradeAnimation)) turnOn("toggleTrade");
      if (isVisible(goods) && hasChildren(goods)) turnOn("toggleGoods");
      if (isVisible(markets) && hasChildren(markets)) turnOn("toggleMarketsLayer");
      if (isVisible(ruler)) turnOn("toggleRulers");
      if (isVisible(scaleBar)) turnOn("toggleScaleBar");
      if (isVisibleNode(ensureEl("vignette"))) turnOn("toggleVignette");

      getCurrentPreset();
      Goods.sync();
      Markets.sync();
      Routes.sync();
      TradeAnimation.sync();
    }
    scaleBar.on("mousemove", () => tip("Click to open Units Editor")).on("click", () => editUnits());
    legend
      .on("mousemove", () => tip("Drag to change the position. Click to hide the legend"))
      .on("click", () => clearLegend());

    {
      // dynamically import and run auto-update script
      const { resolveVersionConflicts } = await import("./auto-update");
      resolveVersionConflicts(mapVersion!);
    }

    // add custom heightmap color scheme if any
    if (heightmapColorSchemes) {
      const oceanHeights = document.getElementById("oceanHeights");
      const oceanScheme = oceanHeights?.getAttribute("scheme");
      if (oceanScheme && !(oceanScheme in heightmapColorSchemes)) addCustomColorScheme(oceanScheme);
      const landHeights = document.getElementById("landHeights");
      const landScheme = landHeights?.getAttribute("scheme");
      if (landScheme && !(landScheme in heightmapColorSchemes)) addCustomColorScheme(landScheme);
    }

    {
      // add custom texture if any
      const textureHref = texture.attr("data-href");
      if (textureHref) updateTextureSelectValue(textureHref);
    }

    // data integrity checks
    {
      const { cells, vertices } = pack;

      const cellsMismatch = cells.i.length !== cells.state.length;
      const featureVerticesMismatch = pack.features.some(f => f?.vertices?.some(vertex => !vertices.p[vertex]));

      if (cellsMismatch || featureVerticesMismatch) {
        const message = "[Data integrity] Striping issue detected. To fix try to edit the heightmap in ERASE mode";
        throw new Error(message);
      }

      const invalidStates = [...new Set(cells.state)].filter(s => !pack.states[s] || pack.states[s].removed);
      invalidStates.forEach(s => {
        const invalidCells = cells.i.filter(i => cells.state[i] === s);
        invalidCells.forEach(i => {
          cells.state[i] = 0;
        });
        ERROR && console.error("[Data integrity] Invalid state", s, "is assigned to cells", invalidCells);
      });

      const invalidProvinces = [...new Set(cells.province)].filter(
        p => p && (!pack.provinces[p] || (pack.provinces[p] as { removed?: boolean }).removed)
      );
      invalidProvinces.forEach(p => {
        const invalidCells = cells.i.filter(i => cells.province[i] === p);
        invalidCells.forEach(i => {
          cells.province[i] = 0;
        });
        ERROR && console.error("[Data integrity] Invalid province", p, "is assigned to cells", invalidCells);
      });

      const invalidCultures = [...new Set(cells.culture)].filter(c => !pack.cultures[c] || pack.cultures[c].removed);
      invalidCultures.forEach(c => {
        const invalidCells = cells.i.filter(i => cells.culture[i] === c);
        invalidCells.forEach(i => {
          cells.province[i] = 0;
        });
        ERROR && console.error("[Data integrity] Invalid culture", c, "is assigned to cells", invalidCells);
      });

      const invalidReligions = [...new Set(cells.religion)].filter(
        r => !pack.religions[r] || pack.religions[r].removed
      );
      invalidReligions.forEach(r => {
        const invalidCells = cells.i.filter(i => cells.religion[i] === r);
        invalidCells.forEach(i => {
          cells.religion[i] = 0;
        });
        ERROR && console.error("[Data integrity] Invalid religion", r, "is assigned to cells", invalidCells);
      });

      const invalidFeatures = [...new Set(cells.f)].filter(f => f && !pack.features[f]);
      invalidFeatures.forEach(f => {
        const invalidCells = cells.i.filter(i => cells.f[i] === f);
        // No fix as for now
        ERROR && console.error("[Data integrity] Invalid feature", f, "is assigned to cells", invalidCells);
      });

      const invalidBurgs = [...new Set(cells.burg)].filter(
        burgId => burgId && (!pack.burgs[burgId] || pack.burgs[burgId].removed)
      );
      invalidBurgs.forEach(burgId => {
        const invalidCells = cells.i.filter(i => cells.burg[i] === burgId);
        invalidCells.forEach(i => {
          cells.burg[i] = 0;
        });
        ERROR && console.error("[Data integrity] Invalid burg", burgId, "is assigned to cells", invalidCells);
      });

      const invalidRivers = [...new Set(cells.r)].filter(r => r && !pack.rivers.find(river => river.i === r));
      invalidRivers.forEach(r => {
        const invalidCells = cells.i.filter(i => cells.r[i] === r);
        invalidCells.forEach(i => {
          cells.r[i] = 0;
        });
        rivers.select(`river${r}`).remove();
        ERROR && console.error("[Data integrity] Invalid river", r, "is assigned to cells", invalidCells);
      });

      pack.burgs.forEach(burg => {
        if (typeof burg.capital === "boolean") burg.capital = Number(burg.capital);

        if (!burg.i && burg.lock) {
          ERROR && console.error(`[Data integrity] Burg 0 is marked as locked, removing the status`);
          delete burg.lock;
          return;
        }

        if (burg.removed && burg.lock) {
          ERROR && console.error(`[Data integrity] Removed burg ${burg.i} is marked as locked. Unlocking the burg`);
          delete burg.lock;
          return;
        }

        if (!burg.i || burg.removed) return;

        if (burg.cell === undefined || burg.x === undefined || burg.y === undefined) {
          ERROR &&
            console.error(`[Data integrity] Burg ${burg.i} is missing cell info or coordinates. Removing the burg`);
          burg.removed = true;
        }

        if ((burg.port ?? 0) < 0) {
          ERROR && console.error("[Data integrity] Burg", burg.i, "has invalid port value", burg.port);
          burg.port = 0;
        }

        if (burg.cell >= cells.i.length) {
          ERROR && console.error("[Data integrity] Burg", burg.i, "is linked to invalid cell", burg.cell);
          burg.cell = findCell(burg.x, burg.y)!;
          cells.i
            .filter(i => cells.burg[i] === burg.i)
            .forEach(i => {
              cells.burg[i] = 0;
            });
          cells.burg[burg.cell] = burg.i;
        }

        if (burg.state && !pack.states[burg.state]) {
          ERROR && console.error("[Data integrity] Burg", burg.i, "is linked to invalid state", burg.state);
          burg.state = 0;
        }

        if (burg.state && pack.states[burg.state].removed) {
          ERROR && console.error("[Data integrity] Burg", burg.i, "is linked to removed state", burg.state);
          burg.state = 0;
        }

        if (burg.state === undefined) {
          ERROR && console.error("[Data integrity] Burg", burg.i, "has no state data");
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
              `[Data integrity] Neutral burgs (${capitalBurgs.map(b => b.i).join(", ")}) marked as capitals`
            );

          capitalBurgs.forEach(burg => {
            burg.capital = 0;
            Burgs.changeGroup(burg, null);
          });

          return;
        }

        if (capitalBurgs.length > 1) {
          const message = `[Data integrity] State ${state.i} has multiple capitals (${capitalBurgs
            .map(b => b.i)
            .join(", ")}) assigned. Keeping the first as capital and moving others`;
          ERROR && console.error(message);

          capitalBurgs.forEach((burg, i) => {
            if (!i) return;
            burg.capital = 0;
            Burgs.changeGroup(burg, null);
          });

          return;
        }

        if (state.i && stateBurgs.length && !capitalBurgs.length) {
          ERROR && console.error(`[Data integrity] State ${state.i} has no capital. Making the first burg capital`);
          const capital = stateBurgs[0];
          capital.capital = 1;
          Burgs.changeGroup(capital, null);
        }
      });

      pack.provinces.forEach(p => {
        if (!p?.i || p?.removed) return;
        const state = pack.states[p.state];
        if (state && !state.removed) return;
        ERROR &&
          console.error(
            `[Data integrity] Province ${p.i} is linked to removed state ${p.state}. Removing the province`
          );
        p.removed = true;
      });

      pack.routes.forEach(route => {
        if (!route.points || route.points.length < 2) {
          ERROR && console.error(`[Data integrity] Route ${route.i} has less than 2 points. Removing the route`);
          Routes.remove(route);
        }
      });

      for (const from in pack.cells.routes) {
        const value = pack.cells.routes[+from];
        if (!value) continue;

        if (Object.keys(value).length === 0) {
          // remove empty object
          delete pack.cells.routes[+from];
          continue;
        }

        for (const to in value) {
          const routeId = value[+to];
          const route = pack.routes.find(r => r.i === routeId);
          if (!route) {
            ERROR &&
              console.error(`[Data integrity] Route ${routeId} from ${from} to ${to} is missing. Removing the route`);
            delete pack.cells.routes[+from][+to];
          }
        }
      }

      {
        const markerIds: boolean[] = [];
        let nextId = (last(pack.markers)?.i ?? -1) + 1 || 0;

        pack.markers.forEach(marker => {
          if (markerIds[marker.i]) {
            ERROR && console.error("[Data integrity] Marker", marker.i, "has non-unique id. Changing to", nextId);

            const domElements = document.querySelectorAll<HTMLElement>(`#marker${marker.i}`);
            if (domElements[1]) domElements[1].id = `marker${nextId}`; // rename 2nd dom element

            const noteElements = notes.filter(note => note.id === `marker${marker.i}`);
            if (noteElements[1]) noteElements[1].id = `marker${nextId}`; // rename 2nd note

            marker.i = nextId;
            nextId += 1;
          } else {
            markerIds[marker.i] = true;
          }
        });

        // sort markers by index
        pack.markers.sort((a, b) => a.i - b.i);
      }
    }
    // remove href from emblems, to trigger rendering on load
    emblems.selectAll("use").attr("href", null);
    // draw data layers (not kept in svg)
    if (rulers && layerIsOn("toggleRulers")) rulers.draw();
    if (layerIsOn("toggleGrid")) drawGrid();
    if (typeof window.restoreDefaultEvents === "function") restoreDefaultEvents();
    focusOn(); // based on searchParams focus on point, cell or burg
    invokeActiveZooming();
    fitMapToScreen();

    WARN && console.warn(`TOTAL: ${rn((performance.now() - uploadTimeStart) / 1000, 2)}s`);
    showStatistics();
    INFO && console.groupEnd();
    tip("Map is successfully loaded", true, "success", 7000);
  } catch (error) {
    ERROR && console.error(error);
    clearMainTip();

    alertMessage.innerHTML = /* html */ `An error occurred while loading the map. Select a different file to load, <br>generate a new random map or cancel the loading.<br>Map version: ${mapVersion}. Generator version: ${VERSION}.
      <p id="errorBox">${parseError(error as Error)}</p>`;

    $("#alert").dialog({
      resizable: false,
      title: "Loading error",
      maxWidth: "40em",
      buttons: {
        "Clear cache": () => cleanupData(),
        "Select file": function (this: HTMLElement) {
          $(this).dialog("close");
          ensureEl("mapToLoad").click();
        },
        "New map": function (this: HTMLElement) {
          $(this).dialog("close");
          regenerateMap("loading error");
        },
        Cancel: function (this: HTMLElement) {
          $(this).dialog("close");
        }
      },
      position: { my: "center", at: "center", of: "svg" }
    });
  }
}

export const Load = {
  quickLoad,
  loadFromDropbox,
  createSharableDropboxLink,
  loadMapFromURL,
  showUploadErrorMessage,
  uploadMap
};
