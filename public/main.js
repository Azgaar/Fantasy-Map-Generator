"use strict";
// Azgaar and contributors, 2017-2026. MIT License
// https://github.com/Azgaar/Fantasy-Map-Generator

// set debug options
const PRODUCTION = location.hostname && location.hostname !== "localhost" && location.hostname !== "127.0.0.1";
const DEBUG = JSON.safeParse(localStorage.getItem("debug")) || {};
const INFO = true;
const TIME = true;
const WARN = true;
const ERROR = true;

// detect device
const MOBILE = window.innerWidth < 600 || navigator.userAgentData?.mobile;

// the desktop app ships its own copy of the assets, so it has nothing to cache offline
if (PRODUCTION && !window.electron && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(err => {
      console.error("ServiceWorker registration failed: ", err);
    });
  });
}

Layers.init(); // create the svg layer groups

// assign events separately as not a viewbox child
d3.select("#scaleBar")
  .on("mousemove", () => tip("Click to open Units Editor"))
  .on("click", () => window.Controllers.UnitsEditor.open());
const helpAssistantBubble = document.getElementById("helpAssistantBubble");
helpAssistantBubble?.addEventListener("click", () => window.Controllers.HelpAssistant.toggle());
helpAssistantBubble?.addEventListener("mouseover", showDataTip);
d3.select("#legend")
  .on("mousemove", () => tip("Drag to change the position. Click to hide the legend"))
  .on("click", () => clearLegend());

// main data variables
var grid = {}; // initial graph based on jittered square grid and data
var pack = {}; // packed graph and data
var seed;
let mapId;
let mapHistory = [];
let modules = {};
let notes = [];
let customization = 0;

// global options; in v2.0 to be used for all UI settings
let options = {
  pinNotes: false,
  winds: [225, 45, 225, 315, 135, 315],
  temperatureEquator: 27,
  temperatureNorthPole: -30,
  temperatureSouthPole: -15,
  mapSize: 100, // map size in % of the world
  latitude: 50, // North-South map shift in %, 50 is centered on equator
  longitude: 50, // West-East map shift in %, 50 is centered on prime meridian
  prec: 100, // precipitation modifier in %
  showBurgPreview: true,
  burgs: {
    groups: Burgs.parseStoredGroups(localStorage.getItem("burg-groups"))
  },
  labels: Labels.parseStoredOptions(localStorage.getItem("options-labels")),
  emblems: { showAll: false },
  trade: {
    animation: JSON.safeParse(localStorage.getItem("trade-animation")) || TradeAnimation.getDefaultOptions()
  },
  threeD: { ...window.ThreeDOptions }
};

// global style object; in v2.0 to be used for all map styles and render settings

let color = d3.scaleSequential(d3.interpolateSpectral); // default color scheme
const lineGen = d3.line().curve(d3.curveBasis); // d3 line generator with default curve interpolation

// current map view transform, written by the zoom handlers in src/components/zoom.ts
let scale = 1;
let viewX = 0;
let viewY = 0;

var mapCoordinates = {}; // map coordinates on globe
let populationRate = +ensureEl("populationRateInput").value;
let distanceScale = +ensureEl("distanceScaleInput").value;
let urbanization = +ensureEl("urbanizationInput").value;
let urbanDensity = +ensureEl("urbanDensityInput").value;

applyStoredOptions();

// voronoi graph extension, cannot be changed after generation
var graphWidth = +mapWidthInput.value;
var graphHeight = +mapHeightInput.value;

// svg canvas resolution, can be changed
let svgWidth = graphWidth;
let svgHeight = graphHeight;

d3.select("#oceanPattern")
  .append("rect")
  .attr("fill", "url(#oceanic)")
  .attr("x", 0)
  .attr("y", 0)
  .attr("width", graphWidth)
  .attr("height", graphHeight);
d3.select("#oceanLayers")
  .append("rect")
  .attr("id", "oceanBase")
  .attr("data-group", "base")
  .attr("x", 0)
  .attr("y", 0)
  .attr("width", graphWidth)
  .attr("height", graphHeight);

document.addEventListener("DOMContentLoaded", async () => {
  // OAuth callback from the help gateway: stash the fragment token and scrub the URL.
  // Storage key must match TOKEN_STORAGE in src/services/help/auth.ts. The token is taken
  // verbatim after "#token=" (opaque token assumed; revisit if the gateway ever appends more
  // fragment params).
  if (location.hash.startsWith("#token=")) {
    // Token-fixation guard: only accept the fragment token if THIS client initiated sign-in
    // (flag set in signIn(), src/services/help/api.ts) — otherwise a third party could plant
    // #token=<their token> in a link and silently sign the victim in as them.
    let signInPending = false;
    try {
      signInPending = sessionStorage.getItem("fmg-help-signin-pending") === "1";
    } catch {
      // storage unavailable — treat as not pending, i.e. do not accept the token
    }
    try {
      sessionStorage.removeItem("fmg-help-signin-pending");
    } catch {
      // nothing to clear
    }
    if (signInPending) {
      try {
        localStorage.setItem("fmg-help-token", location.hash.slice("#token=".length));
      } catch {
        // storage unavailable — the user simply stays signed out
      }
    }
    // Always scrub the fragment, accepted or not — an unexpected token must not linger in the URL.
    history.replaceState(null, "", location.pathname + location.search);
  }

  // binds the zoom behaviour and its handlers (see src/components/viewbox-events.ts), so it has to
  // run before checkLoadParameters - deep links (MFCG, a stored view position) zoom the map on load
  applyDefaultViewboxEvents();

  if (!location.hostname) {
    const wiki = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Run-FMG-locally";
    alertMessage.innerHTML = /* html */ `Fantasy Map Generator cannot run serverless. Follow the <a href="${wiki}" target="_blank">instructions</a> on how you can easily run a local web-server`;

    $("#alert").dialog({
      resizable: false,
      title: "Loading error",
      width: "28em",
      position: { my: "center center-4em", at: "center", of: "svg" },
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
  initiateAutosave();
  initTourPromptButton();
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
        window.Services.Load.loadMapFromURL(maplink, 1);
      }, 1000);
      return;
    } else window.Services.Load.showUploadErrorMessage("Map link is not a valid URL", maplink);
  }

  // if there is a seed (user of MFCG provided), generate map for it
  if (params.get("seed")) {
    WARN && console.warn("Generate map for seed", params.get("seed"));
    await generateMapOnLoad();
    return;
  }

  // check if there is a map saved to indexedDB
  if (ensureEl("onloadBehavior").value === "lastSaved") {
    try {
      const blob = await ldb.get("lastMap");
      if (blob) {
        WARN && console.warn("Loading last stored map");
        window.Services.Load.uploadMap(blob);
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
  applyLayersPreset(); // apply saved layers preset and reder layers
  Layers.drawAll();
  fitMapToScreen();
  focusOn(); // based on searchParams focus on point, cell or burg from MFCG
  toggleAssistant();
}

// focus on coordinates, cell or burg provided in searchParams
function focusOn() {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  applyURLLayers(params);

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

      const { x, y } = burg;
      zoomTo(x, y, scale, 1600);
      return;
    }

    const x = +params.get("x") || graphWidth / 2;
    const y = +params.get("y") || graphHeight / 2;
    zoomTo(x, y, scale, 1600);
  }
}

function toggleAssistant() {
  if (window.electron) return;

  const bubble = document.getElementById("helpAssistantBubble");
  if (!bubble) return;
  const showAssistant = document.getElementById("azgaarAssistant")?.value === "show";
  bubble.style.display = showAssistant ? "flex" : "none";
}

function initTourPromptButton() {
  const MAX_SHOWS = 3;
  const STORAGE_KEY = "fmg-tour-prompt-count";

  const count = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
  if (count >= MAX_SHOWS) return;

  const btn = document.getElementById("tourPromptButton");
  if (!btn) return;

  btn.style.display = "flex";
  btn.addEventListener("click", async () => {
    window.Services.UiTour.start();
    localStorage.setItem(STORAGE_KEY, MAX_SHOWS);
  });
  localStorage.setItem(STORAGE_KEY, count + 1);
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

  const label = d3.select("#labels").select("[data-label-type='burg'][data-id='" + burgId + "']");
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
  tip("Here stands the glorious city of " + b.name, true, "success", 15000);
}

// add drag to upload logic, pull request from @evyatron
void (function addDragToUpload() {
  document.addEventListener("dragover", function (e) {
    e.stopPropagation();
    e.preventDefault();
    ensureEl("mapOverlay").style.display = null;
  });

  document.addEventListener("dragleave", function (e) {
    ensureEl("mapOverlay").style.display = "none";
  });

  document.addEventListener("drop", function (e) {
    e.stopPropagation();
    e.preventDefault();

    const overlay = ensureEl("mapOverlay");
    overlay.style.display = "none";
    if (e.dataTransfer.items == null || e.dataTransfer.items.length !== 1) return; // no files or more than one
    const file = e.dataTransfer.items[0].getAsFile();

    if (!file.name.endsWith(".map") && !file.name.endsWith(".gz")) {
      alertMessage.innerHTML =
        "Please upload a map file (<i>.map</i> or <i>.gz</i> formats) you have previously downloaded";
      $("#alert").dialog({
        resizable: false,
        title: "Invalid file format",
        position: { my: "center", at: "center", of: "svg" },
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
    window.Services.Load.uploadMap(file, () => {
      overlay.style.display = "none";
      overlay.innerHTML = "Drop a map file to open";
    });
  });
})();

async function generate(options) {
  try {
    const { seed: precreatedSeed, graph: precreatedGraph } = options || {};
    setSeed(precreatedSeed);
    applyGraphSize();
    randomizeOptions();

    await GenerationPipeline.run({ seed: precreatedSeed, graph: precreatedGraph });

    logStats();
    invokeActiveZooming();
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
        "Cleanup data": () => cleanupData(),
        Regenerate: function () {
          regenerateMap("generation error");
          $(this).dialog("close");
        },
        Ignore: function () {
          $(this).dialog("close");
        }
      },
      position: { my: "center", at: "center", of: "svg" }
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

  ensureEl("optionsSeed").value = seed;
  Math.random = aleaPRNG(seed);
}

function logStats() {
  const heightmap = ensureEl("templateInput").value;
  const isTemplate = heightmap in heightmapTemplates;
  const heightmapType = isTemplate ? "template" : "precreated";
  const isRandomTemplate = isTemplate && !stored("template") ? "random " : "";

  const stats = `  Seed: ${seed}
    Canvas size: ${graphWidth}x${graphHeight} px
    Heightmap: ${heightmap}
    Template: ${isRandomTemplate}${heightmapType}
    Points: ${grid.points.length}
    Cells: ${pack.cells.i.length}
    Map size: ${options.mapSize}%
    States: ${pack.states.length - 1}
    Provinces: ${pack.provinces.length - 1}
    Burgs: ${pack.burgs.length - 1}
    Religions: ${pack.religions.length - 1}
    Culture set: ${culturesSet.value}
    Cultures: ${pack.cultures.length - 1}`;

  mapId = Date.now(); // unique map id is it's creation date number
  window.mapId = mapId; // expose for test automation
  mapHistory.push({ seed, width: graphWidth, height: graphHeight, template: heightmap, created: mapId });
  INFO && console.info(stats);

  // Dispatch event for test automation and external integrations
  window.dispatchEvent(new CustomEvent("map:generated", { detail: { seed, mapId } }));
}

const regenerateMap = debounce(async function (config) {
  WARN && console.warn("Generate new random map");

  const cellsDesired = +ensureEl("pointsInput").dataset.cells;
  const shouldShowLoading = cellsDesired > 10000;
  shouldShowLoading && showLoading();

  closeDialogs("#worldConfigurator, #options3d");
  customization = 0;
  resetZoom(1000);
  undraw();
  await generate(config);
  Layers.drawAll();
  if (options.threeD.isOn) window.Controllers.View3d.redraw();
  if (findEl("worldConfigurator")?.offsetParent) window.Controllers.WorldConfigurator.open();

  fitMapToScreen();
  shouldShowLoading && hideLoading();
  clearMainTip();
}, 250);

// clear the map
function undraw() {
  Layers.eraseAll();
  ensureEl("deftemp")
    .querySelectorAll("path, clipPath, svg")
    .forEach(el => el.remove());
  ensureEl("coas").innerHTML = ""; // remove auto-generated emblems
  notes = [];
  unfog();
}
