"use strict";
// Azgaar (azgaar.fmg@yandex.com). Minsk, 2017-2023. MIT License
// https://github.com/Azgaar/Fantasy-Map-Generator

// set debug options
const PRODUCTION = location.hostname && location.hostname !== "localhost" && location.hostname !== "127.0.0.1";
const DEBUG = localStorage.getItem("debug");
const INFO = true;
const TIME = true;
const WARN = true;
const ERROR = true;

// detect device
const MOBILE = window.innerWidth < 600 || navigator.userAgentData?.mobile;

// typed arrays max values
const UINT8_MAX = 255;
const UINT16_MAX = 65535;
const UINT32_MAX = 4294967295;

if (PRODUCTION && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(err => {
      console.error("ServiceWorker registration failed: ", err);
    });
  });

  window.addEventListener(
    "beforeinstallprompt",
    async event => {
      event.preventDefault();
      const Installation = await import("./modules/dynamic/installation.js?v=1.89.19");
      Installation.init(event);
    },
    {once: true}
  );
}

// append svg layers (in default order)
let svg = d3.select("#map");
let defs = svg.select("#deftemp");
let viewbox = svg.select("#viewbox");
let scaleBar = svg.select("#scaleBar");
let legend = svg.append("g").attr("id", "legend");
let ocean = viewbox.append("g").attr("id", "ocean");
let oceanLayers = ocean.append("g").attr("id", "oceanLayers");
let oceanPattern = ocean.append("g").attr("id", "oceanPattern");
let lakes = viewbox.append("g").attr("id", "lakes");
let landmass = viewbox.append("g").attr("id", "landmass");
let texture = viewbox.append("g").attr("id", "texture");
let terrs = viewbox.append("g").attr("id", "terrs");
let biomes = viewbox.append("g").attr("id", "biomes");
let cells = viewbox.append("g").attr("id", "cells");
let gridOverlay = viewbox.append("g").attr("id", "gridOverlay");
let coordinates = viewbox.append("g").attr("id", "coordinates");
let compass = viewbox.append("g").attr("id", "compass").style("display", "none");
let rivers = viewbox.append("g").attr("id", "rivers");
let terrain = viewbox.append("g").attr("id", "terrain");
let relig = viewbox.append("g").attr("id", "relig");
let cults = viewbox.append("g").attr("id", "cults");
let regions = viewbox.append("g").attr("id", "regions");
let statesBody = regions.append("g").attr("id", "statesBody");
let statesHalo = regions.append("g").attr("id", "statesHalo");
let provs = viewbox.append("g").attr("id", "provs");
let zones = viewbox.append("g").attr("id", "zones").style("display", "none");
let borders = viewbox.append("g").attr("id", "borders");
let stateBorders = borders.append("g").attr("id", "stateBorders");
let provinceBorders = borders.append("g").attr("id", "provinceBorders");
let routes = viewbox.append("g").attr("id", "routes");
let roads = routes.append("g").attr("id", "roads");
let trails = routes.append("g").attr("id", "trails");
let searoutes = routes.append("g").attr("id", "searoutes");
let temperature = viewbox.append("g").attr("id", "temperature");
let coastline = viewbox.append("g").attr("id", "coastline");
let ice = viewbox.append("g").attr("id", "ice").style("display", "none");
let prec = viewbox.append("g").attr("id", "prec").style("display", "none");
let population = viewbox.append("g").attr("id", "population");
let emblems = viewbox.append("g").attr("id", "emblems").style("display", "none");
let labels = viewbox.append("g").attr("id", "labels");
let icons = viewbox.append("g").attr("id", "icons");
let burgIcons = icons.append("g").attr("id", "burgIcons");
let anchors = icons.append("g").attr("id", "anchors");
let armies = viewbox.append("g").attr("id", "armies").style("display", "none");
let markers = viewbox.append("g").attr("id", "markers");
let fogging = viewbox
  .append("g")
  .attr("id", "fogging-cont")
  .attr("mask", "url(#fog)")
  .append("g")
  .attr("id", "fogging")
  .style("display", "none");
let ruler = viewbox.append("g").attr("id", "ruler").style("display", "none");
let debug = viewbox.append("g").attr("id", "debug");

lakes.append("g").attr("id", "freshwater");
lakes.append("g").attr("id", "salt");
lakes.append("g").attr("id", "sinkhole");
lakes.append("g").attr("id", "frozen");
lakes.append("g").attr("id", "lava");
lakes.append("g").attr("id", "dry");

coastline.append("g").attr("id", "sea_island");
coastline.append("g").attr("id", "lake_island");

terrs.append("g").attr("id", "oceanHeights");
terrs.append("g").attr("id", "landHeights");

labels.append("g").attr("id", "states");
labels.append("g").attr("id", "addedLabels");

let burgLabels = labels.append("g").attr("id", "burgLabels");
burgIcons.append("g").attr("id", "cities");
burgLabels.append("g").attr("id", "cities");
anchors.append("g").attr("id", "cities");

burgIcons.append("g").attr("id", "towns");
burgLabels.append("g").attr("id", "towns");
anchors.append("g").attr("id", "towns");

// population groups
population.append("g").attr("id", "rural");
population.append("g").attr("id", "urban");

// emblem groups
emblems.append("g").attr("id", "burgEmblems");
emblems.append("g").attr("id", "provinceEmblems");
emblems.append("g").attr("id", "stateEmblems");

// compass
compass.append("use").attr("xlink:href", "#defs-compass-rose");

// fogging
fogging.append("rect").attr("x", 0).attr("y", 0).attr("width", "100%").attr("height", "100%");
fogging
  .append("rect")
  .attr("x", 0)
  .attr("y", 0)
  .attr("width", "100%")
  .attr("height", "100%")
  .attr("fill", "#e8f0f6")
  .attr("filter", "url(#splotch)");

// assign events separately as not a viewbox child
scaleBar.on("mousemove", () => tip("Click to open Units Editor")).on("click", () => editUnits());
legend
  .on("mousemove", () => tip("Drag to change the position. Click to hide the legend"))
  .on("click", () => clearLegend());

// main data variables
let grid = {}; // initial graph based on jittered square grid and data
let pack = {}; // packed graph and data
let seed;
let mapId;
let mapHistory = [];
let elSelected;
let modules = {};
let notes = [];
let rulers = new Rulers();
let customization = 0;

let biomesData = Biomes.getDefault();
let nameBases = Names.getNameBases(); // cultures-related data

let color = d3.scaleSequential(d3.interpolateSpectral); // default color scheme
const lineGen = d3.line().curve(d3.curveBasis); // d3 line generator with default curve interpolation

// d3 zoom behavior
let scale = 1;
let viewX = 0;
let viewY = 0;

function onZoom() {
  const {k, x, y} = d3.event.transform;

  const isScaleChanged = Boolean(scale - k);
  const isPositionChanged = Boolean(viewX - x || viewY - y);
  if (!isScaleChanged && !isPositionChanged) return;

  scale = k;
  viewX = x;
  viewY = y;

  handleZoom(isScaleChanged, isPositionChanged);
}
const onZoomDebouced = debounce(onZoom, 50);
const zoom = d3.zoom().scaleExtent([1, 20]).on("zoom", onZoomDebouced);

// default options, based on Earth data
let options = {
  pinNotes: false,
  winds: [225, 45, 225, 315, 135, 315],
  temperatureEquator: 27,
  temperatureNorthPole: -30,
  temperatureSouthPole: -15,
  stateLabelsMode: "auto",
  showBurgPreview: true,
  villageMaxPopulation: 2000
};

let mapCoordinates = {}; // map coordinates on globe
let populationRate = +byId("populationRateInput").value;
let distanceScale = +byId("distanceScaleInput").value;
let urbanization = +byId("urbanizationInput").value;
let urbanDensity = +byId("urbanDensityInput").value;

applyStoredOptions();

// voronoi graph extension, cannot be changed after generation
let graphWidth = +mapWidthInput.value;
let graphHeight = +mapHeightInput.value;

// svg canvas resolution, can be changed
let svgWidth = graphWidth;
let svgHeight = graphHeight;

landmass.append("rect").attr("x", 0).attr("y", 0).attr("width", graphWidth).attr("height", graphHeight);
oceanPattern
  .append("rect")
  .attr("fill", "url(#oceanic)")
  .attr("x", 0)
  .attr("y", 0)
  .attr("width", graphWidth)
  .attr("height", graphHeight);
oceanLayers
  .append("rect")
  .attr("id", "oceanBase")
  .attr("x", 0)
  .attr("y", 0)
  .attr("width", graphWidth)
  .attr("height", graphHeight);

document.addEventListener("DOMContentLoaded", async () => {
  if (!location.hostname) {
    const wiki = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Run-FMG-locally";
    alertMessage.innerHTML = /* html */ `Fantasy Map Generator cannot run serverless. Follow the <a href="${wiki}" target="_blank">instructions</a> on how you can easily run a local web-server`;

    $("#alert").dialog({
      resizable: false,
      title: "Loading error",
      width: "28em",
      position: {my: "center center-4em", at: "center", of: "svg"},
      buttons: {
        OK: function () {
          $(this).dialog("close");
        }
      }
    });
  } else {
    hideLoading();
    await checkLoadParameters();
  }
  restoreDefaultEvents(); // apply default viewbox events
  initiateAutosave();
});

function hideLoading() {
  d3.select("#loading").transition().duration(3000).style("opacity", 0);
  d3.select("#optionsContainer").transition().duration(2000).style("opacity", 1);
  d3.select("#tooltip").transition().duration(3000).style("opacity", 1);
}

function showLoading() {
  d3.select("#loading").transition().duration(200).style("opacity", 1);
  d3.select("#optionsContainer").transition().duration(100).style("opacity", 0);
  d3.select("#tooltip").transition().duration(200).style("opacity", 0);
}

// decide which map should be loaded or generated on page load
async function checkLoadParameters() {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  // of there is a valid maplink, try to load .map/.gz file from URL
  if (params.get("maplink")) {
    WARN && console.warn("Load map from URL");
    const maplink = params.get("maplink");
    const pattern = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
    const valid = pattern.test(maplink);
    if (valid) {
      setTimeout(() => {
        loadMapFromURL(maplink, 1);
      }, 1000);
      return;
    } else showUploadErrorMessage("Map link is not a valid URL", maplink);
  }

  // if there is a seed (user of MFCG provided), generate map for it
  if (params.get("seed")) {
    WARN && console.warn("Generate map for seed");
    await generateMapOnLoad();
    return;
  }

  // check if there is a map saved to indexedDB
  if (byId("onloadBehavior").value === "lastSaved") {
    try {
      const blob = await ldb.get("lastMap");
      if (blob) {
        WARN && console.warn("Loading last stored map");
        uploadMap(blob);
        return;
      }
    } catch (error) {
      ERROR && console.error(error);
    }
  }

  // else generate random map
  WARN && console.warn("Generate random map");
  generateMapOnLoad();
}

async function generateMapOnLoad() {
  await applyStyleOnLoad(); // apply previously selected default or custom style
  await generate(); // generate map
  applyPreset(); // apply saved layers preset
  fitMapToScreen();
  focusOn(); // based on searchParams focus on point, cell or burg from MFCG
}

// focus on coordinates, cell or burg provided in searchParams
function focusOn() {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  const fromMGCG = params.get("from") === "MFCG" && document.referrer;
  if (fromMGCG) {
    if (params.get("seed").length === 13) {
      // show back burg from MFCG
      const burgSeed = params.get("seed").slice(-4);
      params.set("burg", burgSeed);
    } else {
      // select burg for MFCG
      findBurgForMFCG(params);
      return;
    }
  }

  const scaleParam = params.get("scale");
  const cellParam = params.get("cell");
  const burgParam = params.get("burg");

  if (scaleParam || cellParam || burgParam) {
    const scale = +scaleParam || 8;

    if (cellParam) {
      const cell = +params.get("cell");
      const [x, y] = pack.cells.p[cell];
      zoomTo(x, y, scale, 1600);
      return;
    }

    if (burgParam) {
      const burg = isNaN(+burgParam) ? pack.burgs.find(burg => burg.name === burgParam) : pack.burgs[+burgParam];
      if (!burg) return;

      const {x, y} = burg;
      zoomTo(x, y, scale, 1600);
      return;
    }

    const x = +params.get("x") || graphWidth / 2;
    const y = +params.get("y") || graphHeight / 2;
    zoomTo(x, y, scale, 1600);
  }
}

// find burg for MFCG and focus on it
function findBurgForMFCG(params) {
  const cells = pack.cells,
    burgs = pack.burgs;
  if (pack.burgs.length < 2) {
    ERROR && console.error("Cannot select a burg for MFCG");
    return;
  }

  // used for selection
  const size = +params.get("size");
  const coast = +params.get("coast");
  const port = +params.get("port");
  const river = +params.get("river");

  let selection = defineSelection(coast, port, river);
  if (!selection.length) selection = defineSelection(coast, !port, !river);
  if (!selection.length) selection = defineSelection(!coast, 0, !river);
  if (!selection.length) selection = [burgs[1]]; // select first if nothing is found

  function defineSelection(coast, port, river) {
    if (port && river) return burgs.filter(b => b.port && cells.r[b.cell]);
    if (!port && coast && river) return burgs.filter(b => !b.port && cells.t[b.cell] === 1 && cells.r[b.cell]);
    if (!coast && !river) return burgs.filter(b => cells.t[b.cell] !== 1 && !cells.r[b.cell]);
    if (!coast && river) return burgs.filter(b => cells.t[b.cell] !== 1 && cells.r[b.cell]);
    if (coast && river) return burgs.filter(b => cells.t[b.cell] === 1 && cells.r[b.cell]);
    return [];
  }

  // select a burg with closest population from selection
  const selected = d3.scan(selection, (a, b) => Math.abs(a.population - size) - Math.abs(b.population - size));
  const burgId = selection[selected].i;
  if (!burgId) {
    ERROR && console.error("Cannot select a burg for MFCG");
    return;
  }

  const b = burgs[burgId];
  const referrer = new URL(document.referrer);
  for (let p of referrer.searchParams) {
    if (p[0] === "name") b.name = p[1];
    else if (p[0] === "size") b.population = +p[1];
    else if (p[0] === "seed") b.MFCG = +p[1];
    else if (p[0] === "shantytown") b.shanty = +p[1];
    else b[p[0]] = +p[1]; // other parameters
  }
  if (params.get("name") && params.get("name") != "null") b.name = params.get("name");

  const label = burgLabels.select("[data-id='" + burgId + "']");
  if (label.size()) {
    label
      .text(b.name)
      .classed("drag", true)
      .on("mouseover", function () {
        d3.select(this).classed("drag", false);
        label.on("mouseover", null);
      });
  }

  zoomTo(b.x, b.y, 8, 1600);
  invokeActiveZooming();
  tip("Here stands the glorious city of " + b.name, true, "success", 15000);
}

function handleZoom(isScaleChanged, isPositionChanged) {
  viewbox.attr("transform", `translate(${viewX} ${viewY}) scale(${scale})`);

  if (isPositionChanged) drawCoordinates();

  if (isScaleChanged) {
    invokeActiveZooming();
    drawScaleBar(scaleBar, scale);
    fitScaleBar(scaleBar, svgWidth, svgHeight);
  }

  // zoom image converter overlay
  if (customization === 1) {
    const canvas = byId("canvas");
    if (!canvas || canvas.style.opacity === "0") return;

    const img = byId("imageToConvert");
    if (!img) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, viewX, viewY);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
}

// Zoom to a specific point
function zoomTo(x, y, z = 8, d = 2000) {
  const transform = d3.zoomIdentity.translate(x * -z + svgWidth / 2, y * -z + svgHeight / 2).scale(z);
  svg.transition().duration(d).call(zoom.transform, transform);
}

// Reset zoom to initial
function resetZoom(d = 1000) {
  svg.transition().duration(d).call(zoom.transform, d3.zoomIdentity);
}

// calculate x y extreme points of viewBox
function getViewBoxExtent() {
  return [
    [Math.abs(viewX / scale), Math.abs(viewY / scale)],
    [Math.abs(viewX / scale) + graphWidth / scale, Math.abs(viewY / scale) + graphHeight / scale]
  ];
}

// active zooming feature
function invokeActiveZooming() {
  const isOptimized = shapeRendering.value === "optimizeSpeed";

  if (coastline.select("#sea_island").size() && +coastline.select("#sea_island").attr("auto-filter")) {
    // toggle shade/blur filter for coatline on zoom
    const filter = scale > 1.5 && scale <= 2.6 ? null : scale > 2.6 ? "url(#blurFilter)" : "url(#dropShadow)";
    coastline.select("#sea_island").attr("filter", filter);
  }

  // rescale labels on zoom
  if (labels.style("display") !== "none") {
    labels.selectAll("g").each(function () {
      if (this.id === "burgLabels") return;
      const desired = +this.dataset.size;
      const relative = Math.max(rn((desired + desired / scale) / 2, 2), 1);
      if (rescaleLabels.checked) this.setAttribute("font-size", relative);

      const hidden = hideLabels.checked && (relative * scale < 6 || relative * scale > 60);
      if (hidden) this.classList.add("hidden");
      else this.classList.remove("hidden");
    });
  }

  // rescale emblems on zoom
  if (emblems.style("display") !== "none") {
    emblems.selectAll("g").each(function () {
      const size = this.getAttribute("font-size") * scale;
      const hidden = hideEmblems.checked && (size < 25 || size > 300);
      if (hidden) this.classList.add("hidden");
      else this.classList.remove("hidden");
      if (!hidden && window.COArenderer && this.children.length && !this.children[0].getAttribute("href"))
        renderGroupCOAs(this);
    });
  }

  // turn off ocean pattern if scale is big (improves performance)
  oceanPattern
    .select("rect")
    .attr("fill", scale > 10 ? "#fff" : "url(#oceanic)")
    .attr("opacity", scale > 10 ? 0.2 : null);

  // change states halo width
  if (!customization && !isOptimized) {
    const desired = +statesHalo.attr("data-width");
    const haloSize = rn(desired / scale ** 0.8, 2);
    statesHalo.attr("stroke-width", haloSize).style("display", haloSize > 0.1 ? "block" : "none");
  }

  // rescale map markers
  +markers.attr("rescale") &&
    pack.markers?.forEach(marker => {
      const {i, x, y, size = 30, hidden} = marker;
      const el = !hidden && byId(`marker${i}`);
      if (!el) return;

      const zoomedSize = Math.max(rn(size / 5 + 24 / scale, 2), 1);
      el.setAttribute("width", zoomedSize);
      el.setAttribute("height", zoomedSize);
      el.setAttribute("x", rn(x - zoomedSize / 2, 1));
      el.setAttribute("y", rn(y - zoomedSize, 1));
    });

  // rescale rulers to have always the same size
  if (ruler.style("display") !== "none") {
    const size = rn((10 / scale ** 0.3) * 2, 2);
    ruler.selectAll("text").attr("font-size", size);
  }
}

async function renderGroupCOAs(g) {
  const [group, type] =
    g.id === "burgEmblems"
      ? [pack.burgs, "burg"]
      : g.id === "provinceEmblems"
      ? [pack.provinces, "province"]
      : [pack.states, "state"];
  for (let use of g.children) {
    const i = +use.dataset.i;
    const id = type + "COA" + i;
    COArenderer.trigger(id, group[i].coa);
    use.setAttribute("href", "#" + id);
  }
}

// add drag to upload logic, pull request from @evyatron
void (function addDragToUpload() {
  document.addEventListener("dragover", function (e) {
    e.stopPropagation();
    e.preventDefault();
    byId("mapOverlay").style.display = null;
  });

  document.addEventListener("dragleave", function (e) {
    byId("mapOverlay").style.display = "none";
  });

  document.addEventListener("drop", function (e) {
    e.stopPropagation();
    e.preventDefault();

    const overlay = byId("mapOverlay");
    overlay.style.display = "none";
    if (e.dataTransfer.items == null || e.dataTransfer.items.length !== 1) return; // no files or more than one
    const file = e.dataTransfer.items[0].getAsFile();

    if (!file.name.endsWith(".map") && !file.name.endsWith(".gz")) {
      alertMessage.innerHTML =
        "Please upload a map file (<i>.map</i> or <i>.gz</i> formats) you have previously downloaded";
      $("#alert").dialog({
        resizable: false,
        title: "Invalid file format",
        position: {my: "center", at: "center", of: "svg"},
        buttons: {
          Close: function () {
            $(this).dialog("close");
          }
        }
      });
      return;
    }

    // all good - show uploading text and load the map
    overlay.style.display = null;
    overlay.innerHTML = "Uploading<span>.</span><span>.</span><span>.</span>";
    if (closeDialogs) closeDialogs();
    uploadMap(file, () => {
      overlay.style.display = "none";
      overlay.innerHTML = "Drop a map file to open";
    });
  });
})();

async function generate(options) {
  try {
    const timeStart = performance.now();
    const {seed: precreatedSeed, graph: precreatedGraph} = options || {};

    invokeActiveZooming();
    setSeed(precreatedSeed);
    INFO && console.group("Generated Map " + seed);

    applyGraphSize();
    randomizeOptions();

    if (shouldRegenerateGrid(grid, precreatedSeed)) grid = precreatedGraph || generateGrid();
    else delete grid.cells.h;
    grid.cells.h = await HeightmapGenerator.generate(grid);
    pack = {}; // reset pack

    markFeatures();
    markupGridOcean();
    addLakesInDeepDepressions();
    openNearSeaLakes();

    OceanLayers();
    defineMapSize();
    calculateMapCoordinates();
    calculateTemperatures();
    generatePrecipitation();

    reGraph();
    drawCoastline();

    Rivers.generate();
    drawRivers();
    Lakes.defineGroup();
    Biomes.define();

    rankCells();
    Cultures.generate();
    Cultures.expand();
    BurgsAndStates.generate();
    Routes.generate();
    Religions.generate();
    BurgsAndStates.defineStateForms();
    BurgsAndStates.generateProvinces();
    BurgsAndStates.defineBurgFeatures();

    drawStates();
    drawBorders();
    drawStateLabels();

    Rivers.specify();
    Lakes.generateName();

    Military.generate();
    Markers.generate();
    addZones();

    drawScaleBar(scaleBar, scale);
    Names.getMapName();

    WARN && console.warn(`TOTAL: ${rn((performance.now() - timeStart) / 1000, 2)}s`);
    showStatistics();
    INFO && console.groupEnd("Generated Map " + seed);
  } catch (error) {
    ERROR && console.error(error);
    const parsedError = parseError(error);
    clearMainTip();

    alertMessage.innerHTML = /* html */ `An error has occurred on map generation. Please retry. <br />If error is critical, clear the stored data and try again.
      <p id="errorBox">${parsedError}</p>`;
    $("#alert").dialog({
      resizable: false,
      title: "Generation error",
      width: "32em",
      buttons: {
        "Clear data": function () {
          localStorage.clear();
          localStorage.setItem("version", version);
        },
        Regenerate: function () {
          regenerateMap("generation error");
          $(this).dialog("close");
        },
        Ignore: function () {
          $(this).dialog("close");
        }
      },
      position: {my: "center", at: "center", of: "svg"}
    });
  }
}

// set map seed (string!)
function setSeed(precreatedSeed) {
  if (!precreatedSeed) {
    const first = !mapHistory[0];
    const params = new URL(window.location.href).searchParams;
    const urlSeed = params.get("seed");
    if (first && params.get("from") === "MFCG" && urlSeed.length === 13) seed = urlSeed.slice(0, -4);
    else if (first && urlSeed) seed = urlSeed;
    else seed = generateSeed();
  } else {
    seed = precreatedSeed;
  }

  byId("optionsSeed").value = seed;
  Math.random = aleaPRNG(seed);
}

// Mark features (ocean, lakes, islands) and calculate distance field
function markFeatures() {
  TIME && console.time("markFeatures");
  Math.random = aleaPRNG(seed); // get the same result on heightmap edit in Erase mode

  const cells = grid.cells;
  const heights = grid.cells.h;
  cells.f = new Uint16Array(cells.i.length); // cell feature number
  cells.t = new Int8Array(cells.i.length); // cell type: 1 = land coast; -1 = water near coast
  grid.features = [0];

  for (let i = 1, queue = [0]; queue[0] !== -1; i++) {
    cells.f[queue[0]] = i; // feature number
    const land = heights[queue[0]] >= 20;
    let border = false; // true if feature touches map border

    while (queue.length) {
      const q = queue.pop();
      if (cells.b[q]) border = true;

      cells.c[q].forEach(c => {
        const cLand = heights[c] >= 20;
        if (land === cLand && !cells.f[c]) {
          cells.f[c] = i;
          queue.push(c);
        } else if (land && !cLand) {
          cells.t[q] = 1;
          cells.t[c] = -1;
        }
      });
    }
    const type = land ? "island" : border ? "ocean" : "lake";
    grid.features.push({i, land, border, type});

    queue[0] = cells.f.findIndex(f => !f); // find unmarked cell
  }

  TIME && console.timeEnd("markFeatures");
}

function markupGridOcean() {
  TIME && console.time("markupGridOcean");
  markup(grid.cells, -2, -1, -10);
  TIME && console.timeEnd("markupGridOcean");
}

// Calculate cell-distance to coast for every cell
function markup(cells, start, increment, limit) {
  for (let t = start, count = Infinity; count > 0 && t > limit; t += increment) {
    count = 0;
    const prevT = t - increment;
    for (let i = 0; i < cells.i.length; i++) {
      if (cells.t[i] !== prevT) continue;

      for (const c of cells.c[i]) {
        if (cells.t[c]) continue;
        cells.t[c] = t;
        count++;
      }
    }
  }
}

function addLakesInDeepDepressions() {
  TIME && console.time("addLakesInDeepDepressions");
  const {cells, features} = grid;
  const {c, h, b} = cells;
  const ELEVATION_LIMIT = +byId("lakeElevationLimitOutput").value;
  if (ELEVATION_LIMIT === 80) return;

  for (const i of cells.i) {
    if (b[i] || h[i] < 20) continue;

    const minHeight = d3.min(c[i].map(c => h[c]));
    if (h[i] > minHeight) continue;

    let deep = true;
    const threshold = h[i] + ELEVATION_LIMIT;
    const queue = [i];
    const checked = [];
    checked[i] = true;

    // check if elevated cell can potentially pour to water
    while (deep && queue.length) {
      const q = queue.pop();

      for (const n of c[q]) {
        if (checked[n]) continue;
        if (h[n] >= threshold) continue;
        if (h[n] < 20) {
          deep = false;
          break;
        }

        checked[n] = true;
        queue.push(n);
      }
    }

    // if not, add a lake
    if (deep) {
      const lakeCells = [i].concat(c[i].filter(n => h[n] === h[i]));
      addLake(lakeCells);
    }
  }

  function addLake(lakeCells) {
    const f = features.length;

    lakeCells.forEach(i => {
      cells.h[i] = 19;
      cells.t[i] = -1;
      cells.f[i] = f;
      c[i].forEach(n => !lakeCells.includes(n) && (cells.t[c] = 1));
    });

    features.push({i: f, land: false, border: false, type: "lake"});
  }

  TIME && console.timeEnd("addLakesInDeepDepressions");
}

// near sea lakes usually get a lot of water inflow, most of them should break threshold and flow out to sea (see Ancylus Lake)
function openNearSeaLakes() {
  if (byId("templateInput").value === "Atoll") return; // no need for Atolls

  const cells = grid.cells;
  const features = grid.features;
  if (!features.find(f => f.type === "lake")) return; // no lakes
  TIME && console.time("openLakes");
  const LIMIT = 22; // max height that can be breached by water

  for (const i of cells.i) {
    const lakeFeatureId = cells.f[i];
    if (features[lakeFeatureId].type !== "lake") continue; // not a lake

    check_neighbours: for (const c of cells.c[i]) {
      if (cells.t[c] !== 1 || cells.h[c] > LIMIT) continue; // water cannot break this

      for (const n of cells.c[c]) {
        const ocean = cells.f[n];
        if (features[ocean].type !== "ocean") continue; // not an ocean
        removeLake(c, lakeFeatureId, ocean);
        break check_neighbours;
      }
    }
  }

  function removeLake(thresholdCellId, lakeFeatureId, oceanFeatureId) {
    cells.h[thresholdCellId] = 19;
    cells.t[thresholdCellId] = -1;
    cells.f[thresholdCellId] = oceanFeatureId;
    cells.c[thresholdCellId].forEach(function (c) {
      if (cells.h[c] >= 20) cells.t[c] = 1; // mark as coastline
    });

    cells.i.forEach(i => {
      if (cells.f[i] === lakeFeatureId) cells.f[i] = oceanFeatureId;
    });
    features[lakeFeatureId].type = "ocean"; // mark former lake as ocean
  }

  TIME && console.timeEnd("openLakes");
}

// define map size and position based on template and random factor
function defineMapSize() {
  const [size, latitude, longitude] = getSizeAndLatitude();
  const randomize = new URL(window.location.href).searchParams.get("options") === "default"; // ignore stored options
  if (randomize || !locked("mapSize")) mapSizeOutput.value = mapSizeInput.value = size;
  if (randomize || !locked("latitude")) latitudeOutput.value = latitudeInput.value = latitude;
  if (randomize || !locked("longitude")) longitudeOutput.value = longitudeInput.value = longitude;

  function getSizeAndLatitude() {
    const template = byId("templateInput").value; // heightmap template

    if (template === "africa-centric") return [45, 53, 38];
    if (template === "arabia") return [20, 35, 35];
    if (template === "atlantics") return [42, 23, 65];
    if (template === "britain") return [7, 20, 51.3];
    if (template === "caribbean") return [15, 40, 74.8];
    if (template === "east-asia") return [11, 28, 9.4];
    if (template === "eurasia") return [38, 19, 27];
    if (template === "europe") return [20, 16, 44.8];
    if (template === "europe-accented") return [14, 22, 44.8];
    if (template === "europe-and-central-asia") return [25, 10, 39.5];
    if (template === "europe-central") return [11, 22, 46.4];
    if (template === "europe-north") return [7, 18, 48.9];
    if (template === "greenland") return [22, 7, 55.8];
    if (template === "hellenica") return [8, 27, 43.5];
    if (template === "iceland") return [2, 15, 55.3];
    if (template === "indian-ocean") return [45, 55, 14];
    if (template === "mediterranean-sea") return [10, 29, 45.8];
    if (template === "middle-east") return [8, 31, 34.4];
    if (template === "north-america") return [37, 17, 87];
    if (template === "us-centric") return [66, 27, 100];
    if (template === "us-mainland") return [16, 30, 77.5];
    if (template === "world") return [78, 27, 40];
    if (template === "world-from-pacific") return [75, 32, 30]; // longitude doesn't fit

    const part = grid.features.some(f => f.land && f.border); // if land goes over map borders
    const max = part ? 80 : 100; // max size
    const lat = () => gauss(P(0.5) ? 40 : 60, 20, 25, 75); // latitude shift

    if (!part) {
      if (template === "pangea") return [100, 50, 50];
      if (template === "shattered" && P(0.7)) return [100, 50, 50];
      if (template === "continents" && P(0.5)) return [100, 50, 50];
      if (template === "archipelago" && P(0.35)) return [100, 50, 50];
      if (template === "highIsland" && P(0.25)) return [100, 50, 50];
      if (template === "lowIsland" && P(0.1)) return [100, 50, 50];
    }

    if (template === "pangea") return [gauss(70, 20, 30, max), lat(), 50];
    if (template === "volcano") return [gauss(20, 20, 10, max), lat(), 50];
    if (template === "mediterranean") return [gauss(25, 30, 15, 80), lat(), 50];
    if (template === "peninsula") return [gauss(15, 15, 5, 80), lat(), 50];
    if (template === "isthmus") return [gauss(15, 20, 3, 80), lat(), 50];
    if (template === "atoll") return [gauss(3, 2, 1, 5, 1), lat(), 50];

    return [gauss(30, 20, 15, max), lat(), 50]; // Continents, Archipelago, High Island, Low Island
  }
}

// calculate map position on globe
function calculateMapCoordinates() {
  const sizeFraction = +byId("mapSizeOutput").value / 100;
  const latShift = +byId("latitudeOutput").value / 100;
  const lonShift = +byId("longitudeOutput").value / 100;

  const latT = rn(sizeFraction * 180, 1);
  const latN = rn(90 - (180 - latT) * latShift, 1);
  const latS = rn(latN - latT, 1);

  const lonT = rn(Math.min((graphWidth / graphHeight) * latT, 360), 1);
  const lonE = rn(180 - (360 - lonT) * lonShift, 1);
  const lonW = rn(lonE - lonT, 1);
  mapCoordinates = {latT, latN, latS, lonT, lonW, lonE};
}

// temperature model, trying to follow real-world data
// based on http://www-das.uwyo.edu/~geerts/cwx/notes/chap16/Image64.gif
function calculateTemperatures() {
  TIME && console.time("calculateTemperatures");
  const cells = grid.cells;
  cells.temp = new Int8Array(cells.i.length); // temperature array

  const {temperatureEquator, temperatureNorthPole, temperatureSouthPole} = options;
  const tropics = [16, -20]; // tropics zone
  const tropicalGradient = 0.15;

  const tempNorthTropic = temperatureEquator - tropics[0] * tropicalGradient;
  const northernGradient = (tempNorthTropic - temperatureNorthPole) / (90 - tropics[0]);

  const tempSouthTropic = temperatureEquator + tropics[1] * tropicalGradient;
  const southernGradient = (tempSouthTropic - temperatureSouthPole) / (90 + tropics[1]);

  const exponent = +heightExponentInput.value;

  for (let rowCellId = 0; rowCellId < cells.i.length; rowCellId += grid.cellsX) {
    const [, y] = grid.points[rowCellId];
    const rowLatitude = mapCoordinates.latN - (y / graphHeight) * mapCoordinates.latT; // [90; -90]
    const tempSeaLevel = calculateSeaLevelTemp(rowLatitude);
    DEBUG && console.info(`${rn(rowLatitude)}° sea temperature: ${rn(tempSeaLevel)}°C`);

    for (let cellId = rowCellId; cellId < rowCellId + grid.cellsX; cellId++) {
      const tempAltitudeDrop = getAltitudeTemperatureDrop(cells.h[cellId]);
      cells.temp[cellId] = minmax(tempSeaLevel - tempAltitudeDrop, -128, 127);
    }
  }

  function calculateSeaLevelTemp(latitude) {
    const isTropical = latitude <= 16 && latitude >= -20;
    if (isTropical) return temperatureEquator - Math.abs(latitude) * tropicalGradient;

    return latitude > 0
      ? tempNorthTropic - (latitude - tropics[0]) * northernGradient
      : tempSouthTropic + (latitude - tropics[1]) * southernGradient;
  }

  // temperature drops by 6.5°C per 1km of altitude
  function getAltitudeTemperatureDrop(h) {
    if (h < 20) return 0;
    const height = Math.pow(h - 18, exponent);
    return rn((height / 1000) * 6.5);
  }

  TIME && console.timeEnd("calculateTemperatures");
}

// simplest precipitation model
function generatePrecipitation() {
  TIME && console.time("generatePrecipitation");
  prec.selectAll("*").remove();
  const {cells, cellsX, cellsY} = grid;
  cells.prec = new Uint8Array(cells.i.length); // precipitation array

  const cellsNumberModifier = (pointsInput.dataset.cells / 10000) ** 0.25;
  const precInputModifier = precInput.value / 100;
  const modifier = cellsNumberModifier * precInputModifier;

  const westerly = [];
  const easterly = [];
  let southerly = 0;
  let northerly = 0;

  // precipitation modifier per latitude band
  // x4 = 0-5 latitude: wet through the year (rising zone)
  // x2 = 5-20 latitude: wet summer (rising zone), dry winter (sinking zone)
  // x1 = 20-30 latitude: dry all year (sinking zone)
  // x2 = 30-50 latitude: wet winter (rising zone), dry summer (sinking zone)
  // x3 = 50-60 latitude: wet all year (rising zone)
  // x2 = 60-70 latitude: wet summer (rising zone), dry winter (sinking zone)
  // x1 = 70-85 latitude: dry all year (sinking zone)
  // x0.5 = 85-90 latitude: dry all year (sinking zone)
  const latitudeModifier = [4, 2, 2, 2, 1, 1, 2, 2, 2, 2, 3, 3, 2, 2, 1, 1, 1, 0.5];
  const MAX_PASSABLE_ELEVATION = 85;

  // define wind directions based on cells latitude and prevailing winds there
  d3.range(0, cells.i.length, cellsX).forEach(function (c, i) {
    const lat = mapCoordinates.latN - (i / cellsY) * mapCoordinates.latT;
    const latBand = ((Math.abs(lat) - 1) / 5) | 0;
    const latMod = latitudeModifier[latBand];
    const windTier = (Math.abs(lat - 89) / 30) | 0; // 30d tiers from 0 to 5 from N to S
    const {isWest, isEast, isNorth, isSouth} = getWindDirections(windTier);

    if (isWest) westerly.push([c, latMod, windTier]);
    if (isEast) easterly.push([c + cellsX - 1, latMod, windTier]);
    if (isNorth) northerly++;
    if (isSouth) southerly++;
  });

  // distribute winds by direction
  if (westerly.length) passWind(westerly, 120 * modifier, 1, cellsX);
  if (easterly.length) passWind(easterly, 120 * modifier, -1, cellsX);

  const vertT = southerly + northerly;
  if (northerly) {
    const bandN = ((Math.abs(mapCoordinates.latN) - 1) / 5) | 0;
    const latModN = mapCoordinates.latT > 60 ? d3.mean(latitudeModifier) : latitudeModifier[bandN];
    const maxPrecN = (northerly / vertT) * 60 * modifier * latModN;
    passWind(d3.range(0, cellsX, 1), maxPrecN, cellsX, cellsY);
  }

  if (southerly) {
    const bandS = ((Math.abs(mapCoordinates.latS) - 1) / 5) | 0;
    const latModS = mapCoordinates.latT > 60 ? d3.mean(latitudeModifier) : latitudeModifier[bandS];
    const maxPrecS = (southerly / vertT) * 60 * modifier * latModS;
    passWind(d3.range(cells.i.length - cellsX, cells.i.length, 1), maxPrecS, -cellsX, cellsY);
  }

  function getWindDirections(tier) {
    const angle = options.winds[tier];

    const isWest = angle > 40 && angle < 140;
    const isEast = angle > 220 && angle < 320;
    const isNorth = angle > 100 && angle < 260;
    const isSouth = angle > 280 || angle < 80;

    return {isWest, isEast, isNorth, isSouth};
  }

  function passWind(source, maxPrec, next, steps) {
    const maxPrecInit = maxPrec;

    for (let first of source) {
      if (first[0]) {
        maxPrec = Math.min(maxPrecInit * first[1], 255);
        first = first[0];
      }

      let humidity = maxPrec - cells.h[first]; // initial water amount
      if (humidity <= 0) continue; // if first cell in row is too elevated consider wind dry

      for (let s = 0, current = first; s < steps; s++, current += next) {
        if (cells.temp[current] < -5) continue; // no flux in permafrost

        if (cells.h[current] < 20) {
          // water cell
          if (cells.h[current + next] >= 20) {
            cells.prec[current + next] += Math.max(humidity / rand(10, 20), 1); // coastal precipitation
          } else {
            humidity = Math.min(humidity + 5 * modifier, maxPrec); // wind gets more humidity passing water cell
            cells.prec[current] += 5 * modifier; // water cells precipitation (need to correctly pour water through lakes)
          }
          continue;
        }

        // land cell
        const isPassable = cells.h[current + next] <= MAX_PASSABLE_ELEVATION;
        const precipitation = isPassable ? getPrecipitation(humidity, current, next) : humidity;
        cells.prec[current] += precipitation;
        const evaporation = precipitation > 1.5 ? 1 : 0; // some humidity evaporates back to the atmosphere
        humidity = isPassable ? minmax(humidity - precipitation + evaporation, 0, maxPrec) : 0;
      }
    }
  }

  function getPrecipitation(humidity, i, n) {
    const normalLoss = Math.max(humidity / (10 * modifier), 1); // precipitation in normal conditions
    const diff = Math.max(cells.h[i + n] - cells.h[i], 0); // difference in height
    const mod = (cells.h[i + n] / 70) ** 2; // 50 stands for hills, 70 for mountains
    return minmax(normalLoss + diff * mod, 1, humidity);
  }

  void (function drawWindDirection() {
    const wind = prec.append("g").attr("id", "wind");

    d3.range(0, 6).forEach(function (t) {
      if (westerly.length > 1) {
        const west = westerly.filter(w => w[2] === t);
        if (west && west.length > 3) {
          const from = west[0][0],
            to = west[west.length - 1][0];
          const y = (grid.points[from][1] + grid.points[to][1]) / 2;
          wind.append("text").attr("x", 20).attr("y", y).text("\u21C9");
        }
      }
      if (easterly.length > 1) {
        const east = easterly.filter(w => w[2] === t);
        if (east && east.length > 3) {
          const from = east[0][0],
            to = east[east.length - 1][0];
          const y = (grid.points[from][1] + grid.points[to][1]) / 2;
          wind
            .append("text")
            .attr("x", graphWidth - 52)
            .attr("y", y)
            .text("\u21C7");
        }
      }
    });

    if (northerly)
      wind
        .append("text")
        .attr("x", graphWidth / 2)
        .attr("y", 42)
        .text("\u21CA");
    if (southerly)
      wind
        .append("text")
        .attr("x", graphWidth / 2)
        .attr("y", graphHeight - 20)
        .text("\u21C8");
  })();

  TIME && console.timeEnd("generatePrecipitation");
}

// recalculate Voronoi Graph to pack cells
function reGraph() {
  TIME && console.time("reGraph");
  const {cells: gridCells, points, features} = grid;
  const newCells = {p: [], g: [], h: []}; // store new data
  const spacing2 = grid.spacing ** 2;

  for (const i of gridCells.i) {
    const height = gridCells.h[i];
    const type = gridCells.t[i];

    if (height < 20 && type !== -1 && type !== -2) continue; // exclude all deep ocean points
    if (type === -2 && (i % 4 === 0 || features[gridCells.f[i]].type === "lake")) continue; // exclude non-coastal lake points

    const [x, y] = points[i];
    addNewPoint(i, x, y, height);

    // add additional points for cells along coast
    if (type === 1 || type === -1) {
      if (gridCells.b[i]) continue; // not for near-border cells
      gridCells.c[i].forEach(function (e) {
        if (i > e) return;
        if (gridCells.t[e] === type) {
          const dist2 = (y - points[e][1]) ** 2 + (x - points[e][0]) ** 2;
          if (dist2 < spacing2) return; // too close to each other
          const x1 = rn((x + points[e][0]) / 2, 1);
          const y1 = rn((y + points[e][1]) / 2, 1);
          addNewPoint(i, x1, y1, height);
        }
      });
    }
  }

  function addNewPoint(i, x, y, height) {
    newCells.p.push([x, y]);
    newCells.g.push(i);
    newCells.h.push(height);
  }

  const {cells: packCells, vertices} = calculateVoronoi(newCells.p, grid.boundary);
  pack.vertices = vertices;
  pack.cells = packCells;
  pack.cells.p = newCells.p;
  pack.cells.g = createTypedArray({maxValue: grid.points.length, from: newCells.g});
  pack.cells.q = d3.quadtree(newCells.p.map(([x, y], i) => [x, y, i]));
  pack.cells.h = createTypedArray({maxValue: 100, from: newCells.h});
  pack.cells.area = createTypedArray({maxValue: UINT16_MAX, length: packCells.i.length}).map((_, cellId) => {
    const area = Math.abs(d3.polygonArea(getPackPolygon(cellId)));
    return Math.min(area, UINT16_MAX);
  });

  TIME && console.timeEnd("reGraph");
}

// Detect and draw the coastline
function drawCoastline() {
  TIME && console.time("drawCoastline");
  reMarkFeatures();

  const cells = pack.cells,
    vertices = pack.vertices,
    n = cells.i.length,
    features = pack.features;
  const used = new Uint8Array(features.length); // store connected features
  const largestLand = d3.scan(
    features.map(f => (f.land ? f.cells : 0)),
    (a, b) => b - a
  );
  const landMask = defs.select("#land");
  const waterMask = defs.select("#water");
  lineGen.curve(d3.curveBasisClosed);

  for (const i of cells.i) {
    const startFromEdge = !i && cells.h[i] >= 20;
    if (!startFromEdge && cells.t[i] !== -1 && cells.t[i] !== 1) continue; // non-edge cell
    const f = cells.f[i];
    if (used[f]) continue; // already connected
    if (features[f].type === "ocean") continue; // ocean cell

    const type = features[f].type === "lake" ? 1 : -1; // type value to search for
    const start = findStart(i, type);
    if (start === -1) continue; // cannot start here
    let vchain = connectVertices(start, type);
    if (features[f].type === "lake") relax(vchain, 1.2);
    used[f] = 1;
    let points = clipPoly(
      vchain.map(v => vertices.p[v]),
      1
    );
    const area = d3.polygonArea(points); // area with lakes/islands
    if (area > 0 && features[f].type === "lake") {
      points = points.reverse();
      vchain = vchain.reverse();
    }

    features[f].area = Math.abs(area);
    features[f].vertices = vchain;

    const path = round(lineGen(points));

    if (features[f].type === "lake") {
      landMask
        .append("path")
        .attr("d", path)
        .attr("fill", "black")
        .attr("id", "land_" + f);
      // waterMask.append("path").attr("d", path).attr("fill", "white").attr("id", "water_"+id); // uncomment to show over lakes
      lakes
        .select("#freshwater")
        .append("path")
        .attr("d", path)
        .attr("id", "lake_" + f)
        .attr("data-f", f); // draw the lake
    } else {
      landMask
        .append("path")
        .attr("d", path)
        .attr("fill", "white")
        .attr("id", "land_" + f);
      waterMask
        .append("path")
        .attr("d", path)
        .attr("fill", "black")
        .attr("id", "water_" + f);
      const g = features[f].group === "lake_island" ? "lake_island" : "sea_island";
      coastline
        .select("#" + g)
        .append("path")
        .attr("d", path)
        .attr("id", "island_" + f)
        .attr("data-f", f); // draw the coastline
    }

    // draw ruler to cover the biggest land piece
    if (f === largestLand) {
      const from = points[d3.scan(points, (a, b) => a[0] - b[0])];
      const to = points[d3.scan(points, (a, b) => b[0] - a[0])];
      rulers.create(Ruler, [from, to]);
    }
  }

  // find cell vertex to start path detection
  function findStart(i, t) {
    if (t === -1 && cells.b[i]) return cells.v[i].find(v => vertices.c[v].some(c => c >= n)); // map border cell
    const filtered = cells.c[i].filter(c => cells.t[c] === t);
    const index = cells.c[i].indexOf(d3.min(filtered));
    return index === -1 ? index : cells.v[i][index];
  }

  // connect vertices to chain
  function connectVertices(start, t) {
    const chain = []; // vertices chain to form a path
    for (let i = 0, current = start; i === 0 || (current !== start && i < 50000); i++) {
      const prev = chain[chain.length - 1]; // previous vertex in chain
      chain.push(current); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      const v = vertices.v[current]; // neighboring vertices
      const c0 = c[0] >= n || cells.t[c[0]] === t;
      const c1 = c[1] >= n || cells.t[c[1]] === t;
      const c2 = c[2] >= n || cells.t[c[2]] === t;
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

  // move vertices that are too close to already added ones
  function relax(vchain, r) {
    const p = vertices.p,
      tree = d3.quadtree();

    for (let i = 0; i < vchain.length; i++) {
      const v = vchain[i];
      let [x, y] = [p[v][0], p[v][1]];
      if (i && vchain[i + 1] && tree.find(x, y, r) !== undefined) {
        const v1 = vchain[i - 1],
          v2 = vchain[i + 1];
        const [x1, y1] = [p[v1][0], p[v1][1]];
        const [x2, y2] = [p[v2][0], p[v2][1]];
        [x, y] = [(x1 + x2) / 2, (y1 + y2) / 2];
        p[v] = [x, y];
      }
      tree.add([x, y]);
    }
  }

  TIME && console.timeEnd("drawCoastline");
}

// Re-mark features (ocean, lakes, islands)
function reMarkFeatures() {
  TIME && console.time("reMarkFeatures");
  const cells = pack.cells;
  const features = (pack.features = [0]);

  cells.f = new Uint16Array(cells.i.length); // cell feature number
  cells.t = new Int8Array(cells.i.length); // cell type: 1 = land along coast; -1 = water along coast;
  cells.haven = cells.i.length < 65535 ? new Uint16Array(cells.i.length) : new Uint32Array(cells.i.length); // cell haven (opposite water cell);
  cells.harbor = new Uint8Array(cells.i.length); // cell harbor (number of adjacent water cells);

  if (!cells.i.length) return; // no cells -> there is nothing to do
  for (let i = 1, queue = [0]; queue[0] !== -1; i++) {
    const start = queue[0]; // first cell
    cells.f[start] = i; // assign feature number
    const land = cells.h[start] >= 20;
    let border = false; // true if feature touches map border
    let cellNumber = 1; // to count cells number in a feature

    while (queue.length) {
      const q = queue.pop();
      if (cells.b[q]) border = true;
      cells.c[q].forEach(function (e) {
        const eLand = cells.h[e] >= 20;
        if (land && !eLand) {
          cells.t[q] = 1;
          cells.t[e] = -1;
          if (!cells.haven[q]) defineHaven(q);
        } else if (land && eLand) {
          if (!cells.t[e] && cells.t[q] === 1) cells.t[e] = 2;
          else if (!cells.t[q] && cells.t[e] === 1) cells.t[q] = 2;
        }
        if (!cells.f[e] && land === eLand) {
          queue.push(e);
          cells.f[e] = i;
          cellNumber++;
        }
      });
    }

    const type = land ? "island" : border ? "ocean" : "lake";
    let group;
    if (type === "ocean") group = defineOceanGroup(cellNumber);
    else if (type === "island") group = defineIslandGroup(start, cellNumber);
    features.push({i, land, border, type, cells: cellNumber, firstCell: start, group});
    queue[0] = cells.f.findIndex(f => !f); // find unmarked cell
  }

  markup(pack.cells, 3, 1, 0); // markupPackLand
  markup(pack.cells, -2, -1, -10); // markupPackWater

  function defineHaven(i) {
    const water = cells.c[i].filter(c => cells.h[c] < 20);
    const dist2 = water.map(c => (cells.p[i][0] - cells.p[c][0]) ** 2 + (cells.p[i][1] - cells.p[c][1]) ** 2);
    const closest = water[dist2.indexOf(Math.min.apply(Math, dist2))];

    cells.haven[i] = closest;
    cells.harbor[i] = water.length;
  }

  function defineOceanGroup(number) {
    if (number > grid.cells.i.length / 25) return "ocean";
    if (number > grid.cells.i.length / 100) return "sea";
    return "gulf";
  }

  function defineIslandGroup(cell, number) {
    if (cell && features[cells.f[cell - 1]].type === "lake") return "lake_island";
    if (number > grid.cells.i.length / 10) return "continent";
    if (number > grid.cells.i.length / 1000) return "island";
    return "isle";
  }

  TIME && console.timeEnd("reMarkFeatures");
}

function isWetLand(moisture, temperature, height) {
  if (moisture > 40 && temperature > -2 && height < 25) return true; //near coast
  if (moisture > 24 && temperature > -2 && height > 24 && height < 60) return true; //off coast
  return false;
}

// assess cells suitability to calculate population and rand cells for culture center and burgs placement
function rankCells() {
  TIME && console.time("rankCells");
  const {cells, features} = pack;
  cells.s = new Int16Array(cells.i.length); // cell suitability array
  cells.pop = new Float32Array(cells.i.length); // cell population array

  const flMean = d3.median(cells.fl.filter(f => f)) || 0,
    flMax = d3.max(cells.fl) + d3.max(cells.conf); // to normalize flux
  const areaMean = d3.mean(cells.area); // to adjust population by cell area

  for (const i of cells.i) {
    if (cells.h[i] < 20) continue; // no population in water
    let s = +biomesData.habitability[cells.biome[i]]; // base suitability derived from biome habitability
    if (!s) continue; // uninhabitable biomes has 0 suitability
    if (flMean) s += normalize(cells.fl[i] + cells.conf[i], flMean, flMax) * 250; // big rivers and confluences are valued
    s -= (cells.h[i] - 50) / 5; // low elevation is valued, high is not;

    if (cells.t[i] === 1) {
      if (cells.r[i]) s += 15; // estuary is valued
      const feature = features[cells.f[cells.haven[i]]];
      if (feature.type === "lake") {
        if (feature.group === "freshwater") s += 30;
        else if (feature.group == "salt") s += 10;
        else if (feature.group == "frozen") s += 1;
        else if (feature.group == "dry") s -= 5;
        else if (feature.group == "sinkhole") s -= 5;
        else if (feature.group == "lava") s -= 30;
      } else {
        s += 5; // ocean coast is valued
        if (cells.harbor[i] === 1) s += 20; // safe sea harbor is valued
      }
    }

    cells.s[i] = s / 5; // general population rate
    // cell rural population is suitability adjusted by cell area
    cells.pop[i] = cells.s[i] > 0 ? (cells.s[i] * cells.area[i]) / areaMean : 0;
  }

  TIME && console.timeEnd("rankCells");
}

// generate zones
function addZones(number = 1) {
  TIME && console.time("addZones");
  const {cells, states, burgs} = pack;
  const used = new Uint8Array(cells.i.length); // to store used cells
  const zonesData = [];

  for (let i = 0; i < rn(Math.random() * 1.8 * number); i++) addInvasion(); // invasion of enemy lands
  for (let i = 0; i < rn(Math.random() * 1.6 * number); i++) addRebels(); // rebels along a state border
  for (let i = 0; i < rn(Math.random() * 1.6 * number); i++) addProselytism(); // proselitism of organized religion
  for (let i = 0; i < rn(Math.random() * 1.6 * number); i++) addCrusade(); // crusade on heresy lands
  for (let i = 0; i < rn(Math.random() * 1.8 * number); i++) addDisease(); // disease starting in a random city
  for (let i = 0; i < rn(Math.random() * 1.4 * number); i++) addDisaster(); // disaster starting in a random city
  for (let i = 0; i < rn(Math.random() * 1.4 * number); i++) addEruption(); // volcanic eruption aroung volcano
  for (let i = 0; i < rn(Math.random() * 1.0 * number); i++) addAvalanche(); // avalanche impacting highland road
  for (let i = 0; i < rn(Math.random() * 1.4 * number); i++) addFault(); // fault line in elevated areas
  for (let i = 0; i < rn(Math.random() * 1.4 * number); i++) addFlood(); // flood on river banks
  for (let i = 0; i < rn(Math.random() * 1.2 * number); i++) addTsunami(); // tsunami starting near coast

  drawZones();

  function addInvasion() {
    const atWar = states.filter(s => s.diplomacy && s.diplomacy.some(d => d === "Enemy"));
    if (!atWar.length) return;

    const invader = ra(atWar);
    const target = invader.diplomacy.findIndex(d => d === "Enemy");

    const cell = ra(
      cells.i.filter(i => cells.state[i] === target && cells.c[i].some(c => cells.state[c] === invader.i))
    );
    if (!cell) return;

    const cellsArray = [],
      queue = [cell],
      power = rand(5, 30);

    while (queue.length) {
      const q = P(0.4) ? queue.shift() : queue.pop();
      cellsArray.push(q);
      if (cellsArray.length > power) break;

      cells.c[q].forEach(e => {
        if (used[e]) return;
        if (cells.state[e] !== target) return;
        used[e] = 1;
        queue.push(e);
      });
    }

    const invasion = rw({
      Invasion: 4,
      Occupation: 3,
      Raid: 2,
      Conquest: 2,
      Subjugation: 1,
      Foray: 1,
      Skirmishes: 1,
      Incursion: 2,
      Pillaging: 1,
      Intervention: 1
    });
    const name = getAdjective(invader.name) + " " + invasion;
    zonesData.push({name, type: "Invasion", cells: cellsArray, fill: "url(#hatch1)"});
  }

  function addRebels() {
    const state = ra(states.filter(s => s.i && !s.removed && s.neighbors.some(n => n)));
    if (!state) return;

    const neib = ra(state.neighbors.filter(n => n && !states[n].removed));
    if (!neib) return;
    const cell = cells.i.find(
      i => cells.state[i] === state.i && !state.removed && cells.c[i].some(c => cells.state[c] === neib)
    );
    const cellsArray = [];
    const queue = [];
    if (cell) queue.push(cell);

    const power = rand(10, 30);

    while (queue.length) {
      const q = queue.shift();
      cellsArray.push(q);
      if (cellsArray.length > power) break;

      cells.c[q].forEach(e => {
        if (used[e]) return;
        if (cells.state[e] !== state.i) return;
        used[e] = 1;
        if (e % 4 !== 0 && !cells.c[e].some(c => cells.state[c] === neib)) return;
        queue.push(e);
      });
    }

    const rebels = rw({
      Rebels: 5,
      Insurgents: 2,
      Mutineers: 1,
      Rioters: 1,
      Separatists: 1,
      Secessionists: 1,
      Insurrection: 2,
      Rebellion: 1,
      Conspiracy: 2
    });
    const name = getAdjective(states[neib].name) + " " + rebels;
    zonesData.push({name, type: "Rebels", cells: cellsArray, fill: "url(#hatch3)"});
  }

  function addProselytism() {
    const organized = ra(pack.religions.filter(r => r.type === "Organized"));
    if (!organized) return;

    const cell = ra(
      cells.i.filter(
        i =>
          cells.religion[i] &&
          cells.religion[i] !== organized.i &&
          cells.c[i].some(c => cells.religion[c] === organized.i)
      )
    );
    if (!cell) return;
    const target = cells.religion[cell];
    const cellsArray = [],
      queue = [cell],
      power = rand(10, 30);

    while (queue.length) {
      const q = queue.shift();
      cellsArray.push(q);
      if (cellsArray.length > power) break;

      cells.c[q].forEach(e => {
        if (used[e]) return;
        if (cells.religion[e] !== target) return;
        if (cells.h[e] < 20) return;
        used[e] = 1;
        //if (e%2 !== 0 && !cells.c[e].some(c => cells.state[c] === neib)) return;
        queue.push(e);
      });
    }

    const name = getAdjective(organized.name.split(" ")[0]) + " Proselytism";
    zonesData.push({name, type: "Proselytism", cells: cellsArray, fill: "url(#hatch6)"});
  }

  function addCrusade() {
    const heresy = ra(pack.religions.filter(r => r.type === "Heresy"));
    if (!heresy) return;

    const cellsArray = cells.i.filter(i => !used[i] && cells.religion[i] === heresy.i);
    if (!cellsArray.length) return;
    cellsArray.forEach(i => (used[i] = 1));

    const name = getAdjective(heresy.name.split(" ")[0]) + " Crusade";
    zonesData.push({name, type: "Crusade", cells: cellsArray, fill: "url(#hatch6)"});
  }

  function addDisease() {
    const burg = ra(burgs.filter(b => !used[b.cell] && b.i && !b.removed)); // random burg
    if (!burg) return;

    const cellsArray = [];
    const cost = [];
    const power = rand(20, 37);

    const queue = new PriorityQueue({comparator: (a, b) => a.p - b.p});
    queue.queue({e: burg.cell, p: 0});

    while (queue.length) {
      const next = queue.dequeue();
      if (cells.burg[next.e] || cells.pop[next.e]) cellsArray.push(next.e);
      used[next.e] = 1;

      cells.c[next.e].forEach(nextCellId => {
        const c = Routes.getRoute(next.e, nextCellId) ? 5 : 100;
        const p = next.p + c;
        if (p > power) return;

        if (!cost[nextCellId] || p < cost[nextCellId]) {
          cost[nextCellId] = p;
          queue.queue({e: nextCellId, p});
        }
      });
    }

    const adjective = () =>
      ra(["Great", "Silent", "Severe", "Blind", "Unknown", "Loud", "Deadly", "Burning", "Bloody", "Brutal", "Fatal"]);
    const animal = () =>
      ra([
        "Ape",
        "Bear",
        "Boar",
        "Cat",
        "Cow",
        "Dog",
        "Pig",
        "Fox",
        "Bird",
        "Horse",
        "Rat",
        "Raven",
        "Sheep",
        "Spider",
        "Wolf"
      ]);
    const color = () =>
      ra([
        "Golden",
        "White",
        "Black",
        "Red",
        "Pink",
        "Purple",
        "Blue",
        "Green",
        "Yellow",
        "Amber",
        "Orange",
        "Brown",
        "Grey"
      ]);

    const type = rw({
      Fever: 5,
      Pestilence: 2,
      Flu: 2,
      Pox: 2,
      Smallpox: 2,
      Plague: 4,
      Cholera: 2,
      Dropsy: 1,
      Leprosy: 2
    });
    const name = rw({[color()]: 4, [animal()]: 2, [adjective()]: 1}) + " " + type;
    zonesData.push({name, type: "Disease", cells: cellsArray, fill: "url(#hatch12)"});
  }

  function addDisaster() {
    const burg = ra(burgs.filter(b => !used[b.cell] && b.i && !b.removed)); // random burg
    if (!burg) return;

    const cellsArray = [],
      cost = [],
      power = rand(5, 25);
    const queue = new PriorityQueue({comparator: (a, b) => a.p - b.p});
    queue.queue({e: burg.cell, p: 0});

    while (queue.length) {
      const next = queue.dequeue();
      if (cells.burg[next.e] || cells.pop[next.e]) cellsArray.push(next.e);
      used[next.e] = 1;

      cells.c[next.e].forEach(function (e) {
        const c = rand(1, 10);
        const p = next.p + c;
        if (p > power) return;

        if (!cost[e] || p < cost[e]) {
          cost[e] = p;
          queue.queue({e, p});
        }
      });
    }

    const type = rw({Famine: 5, Dearth: 1, Drought: 3, Earthquake: 3, Tornadoes: 1, Wildfires: 1});
    const name = getAdjective(burg.name) + " " + type;
    zonesData.push({name, type: "Disaster", cells: cellsArray, fill: "url(#hatch5)"});
  }

  function addEruption() {
    const volcano = byId("markers").querySelector("use[data-id='#marker_volcano']");
    if (!volcano) return;

    const x = +volcano.dataset.x,
      y = +volcano.dataset.y,
      cell = findCell(x, y);
    const id = volcano.id;
    const note = notes.filter(n => n.id === id);

    if (note[0]) note[0].legend = note[0].legend.replace("Active volcano", "Erupting volcano");
    const name = note[0] ? note[0].name.replace(" Volcano", "") + " Eruption" : "Volcano Eruption";

    const cellsArray = [],
      queue = [cell],
      power = rand(10, 30);

    while (queue.length) {
      const q = P(0.5) ? queue.shift() : queue.pop();
      cellsArray.push(q);
      if (cellsArray.length > power) break;
      cells.c[q].forEach(e => {
        if (used[e] || cells.h[e] < 20) return;
        used[e] = 1;
        queue.push(e);
      });
    }

    zonesData.push({name, type: "Disaster", cells: cellsArray, fill: "url(#hatch7)"});
  }

  function addAvalanche() {
    const routes = cells.i.filter(i => !used[i] && Routes.isConnected(i) && cells.h[i] >= 70);
    if (!routes.length) return;

    const cell = +ra(routes);
    const cellsArray = [],
      queue = [cell],
      power = rand(3, 15);

    while (queue.length) {
      const q = P(0.3) ? queue.shift() : queue.pop();
      cellsArray.push(q);
      if (cellsArray.length > power) break;
      cells.c[q].forEach(e => {
        if (used[e] || cells.h[e] < 65) return;
        used[e] = 1;
        queue.push(e);
      });
    }

    const proper = getAdjective(Names.getCultureShort(cells.culture[cell]));
    const name = proper + " Avalanche";
    zonesData.push({name, type: "Disaster", cells: cellsArray, fill: "url(#hatch5)"});
  }

  function addFault() {
    const elevated = cells.i.filter(i => !used[i] && cells.h[i] > 50 && cells.h[i] < 70);
    if (!elevated.length) return;

    const cell = ra(elevated);
    const cellsArray = [],
      queue = [cell],
      power = rand(3, 15);

    while (queue.length) {
      const q = queue.pop();
      if (cells.h[q] >= 20) cellsArray.push(q);
      if (cellsArray.length > power) break;
      cells.c[q].forEach(e => {
        if (used[e] || cells.r[e]) return;
        used[e] = 1;
        queue.push(e);
      });
    }

    const proper = getAdjective(Names.getCultureShort(cells.culture[cell]));
    const name = proper + " Fault";
    zonesData.push({name, type: "Disaster", cells: cellsArray, fill: "url(#hatch2)"});
  }

  function addFlood() {
    const fl = cells.fl.filter(fl => fl),
      meanFlux = d3.mean(fl),
      maxFlux = d3.max(fl),
      flux = (maxFlux - meanFlux) / 2 + meanFlux;
    const rivers = cells.i.filter(
      i => !used[i] && cells.h[i] < 50 && cells.r[i] && cells.fl[i] > flux && cells.burg[i]
    );
    if (!rivers.length) return;

    const cell = +ra(rivers),
      river = cells.r[cell];
    const cellsArray = [],
      queue = [cell],
      power = rand(5, 30);

    while (queue.length) {
      const q = queue.pop();
      cellsArray.push(q);
      if (cellsArray.length > power) break;

      cells.c[q].forEach(e => {
        if (used[e] || cells.h[e] < 20 || cells.r[e] !== river || cells.h[e] > 50 || cells.fl[e] < meanFlux) return;
        used[e] = 1;
        queue.push(e);
      });
    }

    const name = getAdjective(burgs[cells.burg[cell]].name) + " Flood";
    zonesData.push({name, type: "Disaster", cells: cellsArray, fill: "url(#hatch13)"});
  }

  function addTsunami() {
    const coastal = cells.i.filter(i => !used[i] && cells.t[i] === -1 && pack.features[cells.f[i]].type !== "lake");
    if (!coastal.length) return;

    const cell = +ra(coastal);
    const cellsArray = [],
      queue = [cell],
      power = rand(10, 30);

    while (queue.length) {
      const q = queue.shift();
      if (cells.t[q] === 1) cellsArray.push(q);
      if (cellsArray.length > power) break;

      cells.c[q].forEach(e => {
        if (used[e]) return;
        if (cells.t[e] > 2) return;
        if (pack.features[cells.f[e]].type === "lake") return;
        used[e] = 1;
        queue.push(e);
      });
    }

    const proper = getAdjective(Names.getCultureShort(cells.culture[cell]));
    const name = proper + " Tsunami";
    zonesData.push({name, type: "Disaster", cells: cellsArray, fill: "url(#hatch13)"});
  }

  function drawZones() {
    zones
      .selectAll("g")
      .data(zonesData)
      .enter()
      .append("g")
      .attr("id", (d, i) => "zone" + i)
      .attr("data-description", d => d.name)
      .attr("data-type", d => d.type)
      .attr("data-cells", d => d.cells.join(","))
      .attr("fill", d => d.fill)
      .selectAll("polygon")
      .data(d => d.cells)
      .enter()
      .append("polygon")
      .attr("points", d => getPackPolygon(d))
      .attr("id", function (d) {
        return this.parentNode.id + "_" + d;
      });
  }

  TIME && console.timeEnd("addZones");
}

// show map stats on generation complete
function showStatistics() {
  const heightmap = byId("templateInput").value;
  const isTemplate = heightmap in heightmapTemplates;
  const heightmapType = isTemplate ? "template" : "precreated";
  const isRandomTemplate = isTemplate && !locked("template") ? "random " : "";

  const stats = `  Seed: ${seed}
    Canvas size: ${graphWidth}x${graphHeight} px
    Heightmap: ${heightmap} (${isRandomTemplate}${heightmapType})
    Points: ${grid.points.length}
    Cells: ${pack.cells.i.length}
    Map size: ${mapSizeOutput.value}%
    States: ${pack.states.length - 1}
    Provinces: ${pack.provinces.length - 1}
    Burgs: ${pack.burgs.length - 1}
    Religions: ${pack.religions.length - 1}
    Culture set: ${culturesSet.selectedOptions[0].innerText}
    Cultures: ${pack.cultures.length - 1}`;

  mapId = Date.now(); // unique map id is it's creation date number
  mapHistory.push({seed, width: graphWidth, height: graphHeight, template: heightmap, created: mapId});
  INFO && console.info(stats);
}

const regenerateMap = debounce(async function (options) {
  WARN && console.warn("Generate new random map");

  const cellsDesired = +byId("pointsInput").dataset.cells;
  const shouldShowLoading = cellsDesired > 10000;
  shouldShowLoading && showLoading();

  closeDialogs("#worldConfigurator, #options3d");
  customization = 0;
  resetZoom(1000);
  undraw();
  await generate(options);
  restoreLayers();
  if (ThreeD.options.isOn) ThreeD.redraw();
  if ($("#worldConfigurator").is(":visible")) editWorld();

  fitMapToScreen();
  shouldShowLoading && hideLoading();
  clearMainTip();
}, 250);

// clear the map
function undraw() {
  viewbox
    .selectAll("path, circle, polygon, line, text, use, #texture > image, #zones > g, #armies > g, #ruler > g")
    .remove();
  document
    .getElementById("deftemp")
    .querySelectorAll("path, clipPath, svg")
    .forEach(el => el.remove());
  byId("coas").innerHTML = ""; // remove auto-generated emblems
  notes = [];
  rulers = new Rulers();
  unfog();
}
