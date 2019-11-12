// Fantasy Map Generator main script
// Azgaar (azgaar.fmg@yandex.by). Minsk, 2017-2019
// https://github.com/Azgaar/Fantasy-Map-Generator
// MIT License

// I don't mind of any help with programming.
// See also https://github.com/Azgaar/Fantasy-Map-Generator/issues/153

"use strict";
const version = "1.22"; // generator version
document.title += " v" + version;

// if map version is not stored, clear localStorage and show a message
if (rn(localStorage.getItem("version"), 2) !== rn(version, 2)) {
  localStorage.clear();
  setTimeout(showWelcomeMessage, 8000);
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
let compass = viewbox.append("g").attr("id", "compass");
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
let prec = viewbox.append("g").attr("id", "prec").style("display", "none");
let population = viewbox.append("g").attr("id", "population");
let labels = viewbox.append("g").attr("id", "labels");
let icons = viewbox.append("g").attr("id", "icons");
let burgIcons = icons.append("g").attr("id", "burgIcons");
let anchors = icons.append("g").attr("id", "anchors");
let markers = viewbox.append("g").attr("id", "markers").style("display", "none");
let fogging = viewbox.append("g").attr("id", "fogging-cont").attr("mask", "url(#fog)")
  .append("g").attr("id", "fogging").style("display", "none");
let ruler = viewbox.append("g").attr("id", "ruler").style("display", "none");
let debug = viewbox.append("g").attr("id", "debug");

// lake and coast groups
lakes.append("g").attr("id", "freshwater");
lakes.append("g").attr("id", "salt");
lakes.append("g").attr("id", "sinkhole");
lakes.append("g").attr("id", "frozen");
lakes.append("g").attr("id", "lava");
coastline.append("g").attr("id", "sea_island");
coastline.append("g").attr("id", "lake_island");

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

// fogging
fogging.append("rect").attr("x", 0).attr("y", 0).attr("width", "100%").attr("height", "100%");

// assign events separately as not a viewbox child
scaleBar.on("mousemove", () => tip("Click to open Units Editor"));
legend.on("mousemove", () => tip("Drag to change the position. Click to hide the legend")).on("click", () => clearLegend());

class Icons {
  constructor(iconList = {}, density = 0){
    this.density = density;
    this.probability = [];

    for(var item in iconList) {
        if ( iconList.hasOwnProperty(item) ) { // Safety
            for( var i=0; i<iconList[item]; i++ ) {
                this.probability.push(item);
            }
        }
    }
  }
}

class Biome {
  constructor(name, color, habitability, icons = new Icons(), cost = 50){
    this.name = name;
    this.color = color;
    this.habitability = habitability;
    this.icons = icons;
    this.cost = cost;

    this.resetStatistics();
  }

  resetStatistics(){
    this.cells = 0;
    this.area = 0;
    this.rural = 0;
    this.urban = 0;
  }

  addCell(cell, cells){
    this.cells += 1;
    this.area += cells.area[cell];
    this.rural += cells.pop[cell];
    if (cells.burg[cell]) this.urban += pack.burgs[cells.burg[cell]].population;
  }
}

// main data variables
let grid = {}; // initial grapg based on jittered square grid and data
let pack = {}; // packed graph and data
let seed, mapHistory = [], elSelected, modules = {}, notes = [];
let customization = 0; // 0 - no; 1 = heightmap draw; 2 - states draw; 3 - add state/burg; 4 - cultures draw
let mapCoordinates = {}; // map coordinates on globe
let winds = [225, 45, 225, 315, 135, 315]; // default wind directions
applyDefaultBiomesSystem();
let nameBases = Names.getNameBases(); // cultures-related data
const fonts = ["Almendra+SC", "Georgia", "Arial", "Times+New+Roman", "Comic+Sans+MS", "Lucida+Sans+Unicode", "Courier+New"]; // default web-safe fonts

let color = d3.scaleSequential(d3.interpolateSpectral); // default color scheme
const lineGen = d3.line().curve(d3.curveBasis); // d3 line generator with default curve interpolation

// d3 zoom behavior
let scale = 1, viewX = 0, viewY = 0;
const zoom = d3.zoom().scaleExtent([1, 20]).on("zoom", zoomed);

applyStoredOptions();
let graphWidth = +mapWidthInput.value; // voronoi graph extention, should be stable for each map
let graphHeight = +mapHeightInput.value;
let svgWidth = graphWidth, svgHeight = graphHeight; // svg canvas resolution, can vary for each map
landmass.append("rect").attr("x", 0).attr("y", 0).attr("width", graphWidth).attr("height", graphHeight);
oceanPattern.append("rect").attr("fill", "url(#oceanic)").attr("x", 0).attr("y", 0).attr("width", graphWidth).attr("height", graphHeight);
oceanLayers.append("rect").attr("id", "oceanBase").attr("x", 0).attr("y", 0).attr("width", graphWidth).attr("height", graphHeight);

void function removeLoading() {
  d3.select("#loading").transition().duration(4000).style("opacity", 0).remove();
  d3.select("#initial").transition().duration(4000).attr("opacity", 0).remove();
  d3.select("#optionsContainer").transition().duration(3000).style("opacity", 1);
  d3.select("#tooltip").transition().duration(4000).style("opacity", 1);
}()

// decide which map should be loaded or generated on page load
void function checkLoadParameters() {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  // of there is a valid maplink, try to load .map file from URL
  if (params.get("maplink")) {
    console.warn("Load map from URL");
    const maplink = params.get("maplink");
    const pattern = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
    const valid = pattern.test(maplink);
    if (valid) {loadMapFromURL(maplink, 1); return;}
    else showUploadErrorMessage("Map link is not a valid URL", maplink);
  }

  // if there is a seed (user of MFCG provided), generate map for it
  if (params.get("seed")) {
    console.warn("Generate map for seed");
    generateMapOnLoad();
    return;
  }

  // open latest map if option is active and map is stored
  if (onloadMap.value === "saved") {
    ldb.get("lastMap", blob => {
      if (blob) {
        console.warn("Load last saved map");
        try {
          uploadMap(blob);
        }
        catch(error) {
          console.error(error);
          console.warn("Cannot load stored map, random map to be generated");
          generateMapOnLoad();
        }
      } else {
        console.error("No map stored, random map to be generated");
        generateMapOnLoad();
      }
    });
    return;
  }

  console.warn("Generate random map");
  generateMapOnLoad();
}()

function loadMapFromURL(maplink, random) {
  const URL = decodeURIComponent(maplink);

  fetch(URL, {method: 'GET', mode: 'cors'})
    .then(response => {
      if(response.ok) return response.blob();
      throw new Error("Cannot load map from URL");
    }).then(blob => uploadMap(blob))
    .catch(error => {
      showUploadErrorMessage(error.message, URL, random);
      if (random) generateMapOnLoad();
    });
}

function showUploadErrorMessage(error, URL, random) {
  console.error(error);
  alertMessage.innerHTML = `Cannot load map from the ${link(URL, "link provided")}.
    ${random?`A new random map is generated. `:''}
    Please ensure the linked file is reachable and CORS is allowed on server side`;
  $("#alert").dialog({title: "Loading error", width: "32em", buttons: {OK: function() {$(this).dialog("close");}}});
}

function generateMapOnLoad() {
  applyStyleOnLoad(); // apply default of previously selected style
  generate(); // generate map
  focusOn(); // based on searchParams focus on point, cell or burg from MFCG
  applyPreset(); // apply saved layers preset
}

// focus on coordinates, cell or burg provided in searchParams
function focusOn() {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  if (params.get("from") === "MFCG") {
    if (params.get("seed").length === 13) {
      // show back burg from MFCG
      params.set("burg", params.get("seed").slice(-4));
    } else {
      // select burg for MFCG
      findBurgForMFCG(params);
      return;
    }
  }

  const s = +params.get("scale") || 8;
  let x = +params.get("x");
  let y = +params.get("y");

  const c = +params.get("cell");
  if (c) {
    x = pack.cells.p[c][0];
    y = pack.cells.p[c][1];
  }

  const b = +params.get("burg");
  if (b && pack.burgs[b]) {
    x = pack.burgs[b].x;
    y = pack.burgs[b].y;
  }

  if (x && y) zoomTo(x, y, s, 1600);
}

// find burg for MFCG and focus on it
function findBurgForMFCG(params) {
  const cells = pack.cells, burgs = pack.burgs;
  if (pack.burgs.length < 2) {console.error("Cannot select a burg for MFCG"); return;}

  const size = +params.get("size");
  const name = params.get("name");
  let coast = +params.get("coast");
  let port = +params.get("port");
  let river = +params.get("river");

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
  const b = selection[selected].i;
  if (!b) {console.error("Cannot select a burg for MFCG"); return;}
  if (size) burgs[b].population = size;
  if (name) burgs[b].name = name;

  const label = burgLabels.select("[data-id='" + b + "']");
  if (label.size()) {
    tip("Here stands the glorious city of " + burgs[b].name, true, "success", 12000);
    label.text(burgs[b].name).classed("drag", true).on("mouseover", function() {
      d3.select(this).classed("drag", false);
      label.on("mouseover", null);
    });
  }

  zoomTo(burgs[b].x, burgs[b].y, 8, 1600);
  invokeActiveZooming();
}

// apply default biomes data
function applyDefaultBiomesSystem() {
  pack.biomes = [
    new Biome ("Marine", "#53679f", 0, new Icons({}, 0), 10),
    new Biome ("Hot desert", "#fbe79f", 2, new Icons({dune:3, cactus:6, deadTree:1}, 3), 200),
    new Biome ("Cold desert", "#b5b887", 5, new Icons({dune:9, deadTree:1}, 2), 150),
    new Biome ("Savanna", "#d2d082", 20, new Icons({acacia:1, grass:9}, 120), 60),
    new Biome ("Grassland", "#c8d68f", 30, new Icons({grass:1}, 120), 50),
    new Biome ("Tropical seasonal forest", "#b6d95d", 50, new Icons({acacia:8, palm:1}, 120), 70),
    new Biome ("Temperate deciduous forest", "#29bc56", 100, new Icons({deciduous:1}, 120), 70),
    new Biome ("Tropical rainforest", "#7dcb35", 80, new Icons({acacia:5, palm:3, deciduous:1, swamp:1}, 150), 80),
    new Biome ("Temperate rainforest", "#409c43", 90, new Icons({deciduous:6, swamp:1}, 150), 90),
    new Biome ("Taiga", "#4b6b32", 10, new Icons({conifer:1}, 100), 80),
    new Biome ("Tundra", "#96784b", 2, new Icons({grass:1}, 5), 100),
    new Biome ("Glacier", "#d5e7eb", 0, new Icons({}, 0), 255),
    new Biome ("Wetland", "#0b9131", 12, new Icons({swamp:1}, 150), 150),
  ];

  //it is occasionally useful to have the "ID" be in the object
  pack.biomes.forEach((e, i) => {e.id = i;});

  // For sanity
  // console.assert(pack.biomes[0].name == "Marine");
  // console.assert(pack.biomes[11].name == "Glacier");
  // console.assert(pack.biomes[12].name == "Wetland");

  pack.biomesMartix = [
    // hot ↔ cold; dry ↕ wet
    new Uint8Array([1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2]),
    new Uint8Array([3,3,3,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,9,9,9,9,9,10,10]),
    new Uint8Array([5,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,9,9,9,9,9,10,10,10]),
    new Uint8Array([5,6,6,6,6,6,6,8,8,8,8,8,8,8,8,8,8,9,9,9,9,9,9,10,10,10]),
    new Uint8Array([7,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,9,9,9,9,9,9,10,10,10])
  ];
}

function showWelcomeMessage() {
  const post = link("https://www.reddit.com/r/FantasyMapGenerator/comments/dlow3k/update_new_version_is_published_v_12", "Main changes:"); // announcement on Reddit
  const changelog = link("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog", "previous version");
  const reddit = link("https://www.reddit.com/r/FantasyMapGenerator", "Reddit community");
  const discord = link("https://discordapp.com/invite/X7E84HU", "Discord server");
  const patreon = link("https://www.patreon.com/azgaar", "Patreon");

  alertMessage.innerHTML = `The Fantasy Map Generator is updated up to version <b>${version}</b>.
    This version is compatible with ${changelog}, loaded <i>.map</i> files will be auto-updated.

    <ul>${post}
      <li>3d scene and Globe view</li>
      <li>Ability to save map as JPEG image</li>
      <li>Diplomacy Editor enhancements</li>
      <li>Rivers Overview screen [v 1.21] <b>*</b></li>
    </ul>

    <p style="color:#990000; font-style: italic"><b>*</b> It's recommended to regenerate rivers to get clean data for Rivers Overview.<p>

    <p class="announcement">We are happy to invite you to participate in our first map making contest! 
    Valuable prizes for winners and our respect for all participants. 
    See ${link("https://www.reddit.com/r/FantasyMapGenerator/comments/dn2sqv/azgaars_fantasy_map_generator_mapmaking_contest/", "Reddit post")} for the details.</p>

    <p>Join our ${reddit} and ${discord} to ask questions, share maps, discuss the Generator, report bugs and propose new features.</p>
    <p>Thanks for all supporters on ${patreon}!</i></p>`;

  $("#alert").dialog(
    {resizable: false, title: "Fantasy Map Generator update", width: "28em",
    buttons: {OK: function() {$(this).dialog("close")}},
    position: {my: "center", at: "center", of: "svg"},
    close: () => localStorage.setItem("version", version)}
  );
}

function zoomed() {
  const transform = d3.event.transform;
  const scaleDiff = scale - transform.k;
  const positionDiff = viewX - transform.x | viewY - transform.y;
  if (!positionDiff && !scaleDiff) return;

  scale = transform.k;
  viewX = transform.x;
  viewY = transform.y;
  viewbox.attr("transform", transform);

  // update grid only if view position
  if (positionDiff) drawCoordinates();

  // rescale only if zoom is changed
  if (scaleDiff) {
    invokeActiveZooming();
    drawScaleBar();
  }

  // zoom image converter overlay
  const canvas = document.getElementById("canvas");
  if (canvas && +canvas.style.opacity) {
    const img = document.getElementById("image");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, viewX, viewY);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
}

// Zoom to a specific point
function zoomTo(x, y, z = 8, d = 2000) {
  const transform = d3.zoomIdentity.translate(x * -z + graphWidth / 2, y * -z + graphHeight / 2).scale(z);
  svg.transition().duration(d).call(zoom.transform, transform);
}

// Reset zoom to initial
function resetZoom(d = 1000) {
  svg.transition().duration(d).call(zoom.transform, d3.zoomIdentity);
}

// calculate x,y extreme points of viewBox
function getViewBoxExtent() {
  // x = trX / scale * -1 + graphWidth / scale
  // y = trY / scale * -1 + graphHeight / scale
  return [[Math.abs(viewX / scale), Math.abs(viewY / scale)], [Math.abs(viewX / scale) + graphWidth / scale, Math.abs(viewY / scale) + graphHeight / scale]];
}

// active zooming feature
function invokeActiveZooming() {
  if (coastline.select("#sea_island").size() && +coastline.select("#sea_island").attr("auto-filter")) {
    // toggle shade/blur filter for coatline on zoom
    const filter = scale > 1.5 && scale <= 2.6 ? null : scale > 2.6 ? "url(#blurFilter)" : "url(#dropShadow)";
    coastline.select("#sea_island").attr("filter", filter);
  }

  // rescale lables on zoom
  if (labels.style("display") !== "none") {
    labels.selectAll("g").each(function(d) {
      if (this.id === "burgLabels") return;
      const desired = +this.dataset.size;
      const relative = Math.max(rn((desired + desired / scale) / 2, 2), 1);
      this.getAttribute("font-size", relative);
      const hidden = hideLabels.checked && (relative * scale < 6 || relative * scale > 50);
      if (hidden) this.classList.add("hidden"); else this.classList.remove("hidden");
    });
  }

  // turn off ocean pattern if scale is big (improves performance)
  oceanPattern.select("rect").attr("fill", scale > 10 ? "#fff" : "url(#oceanic)").attr("opacity", scale > 10 ? .2 : null);

  // change states halo width
  if (!customization) {
    const haloSize = rn(statesHalo.attr("data-width") / scale, 1);
    statesHalo.attr("stroke-width", haloSize).style("display", haloSize > 3 ? "block" : "none");
  }

  // rescale map markers
  if (+markers.attr("rescale") && markers.style("display") !== "none") {
    markers.selectAll("use").each(function(d) {
      const x = +this.dataset.x, y = +this.dataset.y, desired = +this.dataset.size;
      const size = Math.max(desired * 5 + 25 / scale, 1);
      d3.select(this).attr("x", x - size/2).attr("y", y - size).attr("width", size).attr("height", size);
    });
  }

  // rescale rulers to have always the same size
  if (ruler.style("display") !== "none") {
    const size = rn(1 / scale ** .3 * 2, 1);
    ruler.selectAll("circle").attr("r", 2 * size).attr("stroke-width", .5 * size);
    ruler.selectAll("rect").attr("stroke-width", .5 * size);
    ruler.selectAll("text").attr("font-size", 10 * size);
    ruler.selectAll("line, path").attr("stroke-width", size);
  }
}

// Pull request from @evyatron
void function addDragToUpload() {
  document.addEventListener('dragover', function(e) {
    e.stopPropagation();
    e.preventDefault();
    $('#map-dragged').show();
  });

  document.addEventListener('dragleave', function(e) {
    $('#map-dragged').hide();
  });

  document.addEventListener('drop', function(e) {
    e.stopPropagation();
    e.preventDefault();
    $('#map-dragged').hide();
    // no files or more than one
    if (e.dataTransfer.items == null || e.dataTransfer.items.length != 1) {return;}
    const file = e.dataTransfer.items[0].getAsFile();
    // not a .map file
    if (file.name.indexOf('.map') == -1) {
      alertMessage.innerHTML = 'Please upload a <b>.map</b> file you have previously downloaded';
      $("#alert").dialog({
        resizable: false, title: "Invalid file format",
        width: "40em", buttons: {
          Close: function() { $(this).dialog("close"); }
        }, position: {my: "center", at: "center", of: "svg"}
      });
      return;
    }
    // all good - show uploading text and load the map
    $("#map-dragged > p").text("Uploading<span>.</span><span>.</span><span>.</span>");
    closeDialogs();
    uploadMap(file, function onUploadFinish() {
      $("#map-dragged > p").text("Drop to upload");
    });
  });
}()

function generate() {
  try {
    const timeStart = performance.now();
    invokeActiveZooming();
    generateSeed();
    console.group("Generated Map " + seed);
    applyMapSize();
    randomizeOptions();
    placePoints();
    calculateVoronoi(grid, grid.points);
    drawScaleBar();
    HeightmapGenerator.generate();
    markFeatures();
    openNearSeaLakes();
    OceanLayers();
    calculateMapCoordinates();
    calculateTemperatures();
    generatePrecipitation();
    reGraph();
    drawCoastline();

    elevateLakes();
    Rivers.generate();
    defineBiomes();

    rankCells();
    Cultures.generate();
    Cultures.expand();
    BurgsAndStates.generate();
    Religions.generate();
    BurgsAndStates.defineStateForms();
    BurgsAndStates.generateProvinces();
    BurgsAndStates.defineBurgFeatures();

    drawStates();
    drawBorders();
    BurgsAndStates.drawStateLabels();

    Rivers.specify();
    addMarkers();
    addZones();
    Names.getMapName();

    console.warn(`TOTAL: ${rn((performance.now()-timeStart)/1000,2)}s`);
    showStatistics();
    console.groupEnd("Generated Map " + seed);
  }
  catch(error) {
    console.error(error);
    clearMainTip();

    alertMessage.innerHTML = `An error is occured on map generation. Please retry.
      <br>If error is critical, clear the stored data and try again.
      <p id="errorBox">${parseError(error)}</p>`;
    $("#alert").dialog({
      resizable: false, title: "Generation error", width:"32em", buttons: {
        "Clear data": function() {localStorage.clear(); localStorage.setItem("version", version);},
        Regenerate: function() {regenerateMap(); $(this).dialog("close");},
        Ignore: function() {$(this).dialog("close");}
      }, position: {my: "center", at: "center", of: "svg"}
    });
  }

}

// generate map seed (string!) or get it from URL searchParams
function generateSeed() {
  const first = !mapHistory[0];
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const urlSeed = url.searchParams.get("seed");
  if (first && params.get("from") === "MFCG" && urlSeed.length === 13) seed = urlSeed.slice(0,-4);
  else if (first && urlSeed) seed = urlSeed;
  else if (optionsSeed.value && optionsSeed.value != seed) seed = optionsSeed.value;
  else seed = Math.floor(Math.random() * 1e9).toString();
  optionsSeed.value = seed;
  Math.seedrandom(seed);
}

// Place points to calculate Voronoi diagram
function placePoints() {
  console.time("placePoints");
  const cellsDesired = 10000 * densityInput.value; // generate 10k points for each densityInput point
  const spacing = grid.spacing = rn(Math.sqrt(graphWidth * graphHeight / cellsDesired), 2); // spacing between points before jirrering
  grid.boundary = getBoundaryPoints(graphWidth, graphHeight, spacing);
  grid.points = getJitteredGrid(graphWidth, graphHeight, spacing); // jittered square grid
  grid.cellsX = Math.floor((graphWidth + 0.5 * spacing) / spacing);
  grid.cellsY = Math.floor((graphHeight + 0.5 * spacing) / spacing);
  console.timeEnd("placePoints");
}

// calculate Delaunay and then Voronoi diagram
function calculateVoronoi(graph, points) {
  console.time("calculateDelaunay");
  const n = points.length;
  const allPoints = points.concat(grid.boundary);
  const delaunay = Delaunator.from(allPoints);
  console.timeEnd("calculateDelaunay");

  console.time("calculateVoronoi");
  const voronoi = Voronoi(delaunay, allPoints, n);
  graph.cells = voronoi.cells;
  graph.cells.i = n < 65535 ? Uint16Array.from(d3.range(n)) : Uint32Array.from(d3.range(n)); // array of indexes
  graph.vertices = voronoi.vertices;
  console.timeEnd("calculateVoronoi");
}

// Mark features (ocean, lakes, islands)
function markFeatures() {
  console.time("markFeatures");
  Math.seedrandom(seed); // restart Math.random() to get the same result on heightmap edit in Erase mode
  const cells = grid.cells, heights = grid.cells.h;
  cells.f = new Uint16Array(cells.i.length); // cell feature number
  cells.t = new Int8Array(cells.i.length); // cell type: 1 = land coast; -1 = water near coast;
  grid.features = [0];

  for (let i=1, queue=[0]; queue[0] !== -1; i++) {
    cells.f[queue[0]] = i; // feature number
    const land = heights[queue[0]] >= 20;
    let border = false; // true if feature touches map border

    while (queue.length) {
      const q = queue.pop();
      if (cells.b[q]) border = true;
      cells.c[q].forEach(function(e) {
        const eLand = heights[e] >= 20;
        //if (eLand) cells.t[e] = 2;
        if (land === eLand && cells.f[e] === 0) {
          cells.f[e] = i;
          queue.push(e);
        }
        if (land && !eLand) {
          cells.t[q] = 1; 
          cells.t[e] = -1;
        }
      });
    }
    const type = land ? "island" : border ? "ocean" : "lake";
    grid.features.push({i, land, border, type});

    queue[0] = cells.f.findIndex(f => !f); // find unmarked cell
  }

  console.timeEnd("markFeatures");
}

// How to handle lakes generated near seas? They can be both open or closed.
// As these lakes are usually get a lot of water inflow, most of them should have brake the treshold and flow to sea via river or strait (see Ancylus Lake).
// So I will help this process and open these kind of lakes setting a treshold cell heigh below the sea level (=19).
function openNearSeaLakes() {
  if (templateInput.value === "Atoll") return; // no need for Atolls
  const cells = grid.cells, features = grid.features;
  if (!features.find(f => f.type === "lake")) return; // no lakes
  console.time("openLakes");
  const limit = 50; // max height that can be breached by water

  for (let t = 0, removed = true; t < 5 && removed; t++) {
    removed = false;

    for (const i of cells.i) {
      const lake = cells.f[i];
      if (features[lake].type !== "lake") continue; // not a lake cell

      check_neighbours:
      for (const c of cells.c[i]) {
        if (cells.t[c] !== 1 || cells.h[c] > limit) continue; // water cannot brake this

        for (const n of cells.c[c]) {
          const ocean = cells.f[n];
          if (features[ocean].type !== "ocean") continue; // not an ocean
          removed = removeLake(c, lake, ocean);
          break check_neighbours;
        }
      }
    }

  }

  function removeLake(treshold, lake, ocean) {
    cells.h[treshold] = 19;
    cells.t[treshold] = -1;
    cells.f[treshold] = ocean;
    cells.c[treshold].forEach(function(c) {
      if (cells.h[c] >= 20) cells.t[c] = 1; // mark as coastline
    });
    features[lake].type = "ocean"; // mark former lake as ocean
    return true;
  }

  console.timeEnd("openLakes");
}

// calculate map position on globe
function calculateMapCoordinates() {
  const size = +document.getElementById("mapSizeOutput").value;
  const latShift = +document.getElementById("latitudeOutput").value;

  const latT = size / 100 * 180;
  const latN = 90 - (180 - latT) * latShift / 100;
  const latS = latN - latT;

  const lon = Math.min(graphWidth / graphHeight * latT / 2, 180);
  mapCoordinates = {latT, latN, latS, lonT: lon*2, lonW: -lon, lonE: lon};
}

// temperature model
function calculateTemperatures() {
  console.time('calculateTemperatures');
  const cells = grid.cells;
  cells.temp = new Int8Array(cells.i.length); // temperature array

  const tEq = +temperatureEquatorInput.value;
  const tPole = +temperaturePoleInput.value;
  const tDelta = tEq - tPole;

  d3.range(0, cells.i.length, grid.cellsX).forEach(function(r) {
    const y = grid.points[r][1];
    const lat = Math.abs(mapCoordinates.latN - y / graphHeight * mapCoordinates.latT);
    const initTemp = tEq - lat / 90 * tDelta;
    for (let i = r; i < r+grid.cellsX; i++) {
      cells.temp[i] = initTemp - convertToFriendly(cells.h[i]);
    }
  });

  // temperature decreases by 6.5 degree C per 1km
  function convertToFriendly(h) {
    if (h < 20) return 0;
    const exponent = +heightExponentInput.value;
    const height = Math.pow(h - 18, exponent);
    return rn(height / 1000 * 6.5);
  }

  console.timeEnd('calculateTemperatures');
}

// simplest precipitation model
function generatePrecipitation() {
  console.time('generatePrecipitation');
  prec.selectAll("*").remove();
  const cells = grid.cells;
  cells.prec = new Uint8Array(cells.i.length); // precipitation array
  const modifier = precInput.value / 100; // user's input
  const cellsX = grid.cellsX, cellsY = grid.cellsY;
  let westerly = [], easterly = [], southerly = 0, northerly = 0;

  {// latitude bands
  // x4 = 0-5 latitude: wet throught the year (rising zone)
  // x2 = 5-20 latitude: wet summer (rising zone), dry winter (sinking zone)
  // x1 = 20-30 latitude: dry all year (sinking zone)
  // x2 = 30-50 latitude: wet winter (rising zone), dry summer (sinking zone)
  // x3 = 50-60 latitude: wet all year (rising zone)
  // x2 = 60-70 latitude: wet summer (rising zone), dry winter (sinking zone)
  // x1 = 70-90 latitude: dry all year (sinking zone)
  }
  const lalitudeModifier = [4,2,2,2,1,1,2,2,2,2,3,3,2,2,1,1,1,0.5]; // by 5d step

  // difine wind directions based on cells latitude and prevailing winds there
  d3.range(0, cells.i.length, cellsX).forEach(function(c, i) {
    const lat = mapCoordinates.latN - i / cellsY * mapCoordinates.latT;
    const band = (Math.abs(lat) - 1) / 5 | 0;
    const latMod = lalitudeModifier[band];
    const tier = Math.abs(lat - 89) / 30 | 0; // 30d tiers from 0 to 5 from N to S
    if (winds[tier] > 40 && winds[tier] < 140) westerly.push([c, latMod, tier]);
    else if (winds[tier] > 220 && winds[tier] < 320) easterly.push([c + cellsX -1, latMod, tier]);
    if (winds[tier] > 100 && winds[tier] < 260) northerly++;
    else if (winds[tier] > 280 || winds[tier] < 80) southerly++;
  });

  // distribute winds by direction
  if (westerly.length) passWind(westerly, 120 * modifier, 1, cellsX);
  if (easterly.length) passWind(easterly, 120 * modifier, -1, cellsX);
  const vertT = (southerly + northerly);
  if (northerly) {
    const bandN = (Math.abs(mapCoordinates.latN) - 1) / 5 | 0;
    const latModN = mapCoordinates.latT > 60 ? d3.mean(lalitudeModifier) : lalitudeModifier[bandN];
    const maxPrecN = northerly / vertT * 60 * modifier * latModN;
    passWind(d3.range(0, cellsX, 1), maxPrecN, cellsX, cellsY);
  }
  if (southerly) {
    const bandS = (Math.abs(mapCoordinates.latS) - 1) / 5 | 0;
    const latModS = mapCoordinates.latT > 60 ? d3.mean(lalitudeModifier) : lalitudeModifier[bandS];
    const maxPrecS = southerly / vertT * 60 * modifier * latModS;
    passWind(d3.range(cells.i.length - cellsX, cells.i.length, 1), maxPrecS, -cellsX, cellsY);
  }

  function passWind(source, maxPrec, next, steps) {
    const maxPrecInit = maxPrec;
    for (let first of source) {
      if (first[0]) {maxPrec = Math.min(maxPrecInit * first[1], 255); first = first[0];}
      let humidity = maxPrec - cells.h[first]; // initial water amount
      if (humidity <= 0) continue; // if first cell in row is too elevated cosdired wind dry
      for (let s = 0, current = first; s < steps; s++, current += next) {
        // no flux on permafrost
        if (cells.temp[current] < -5) continue;
        // water cell
        if (cells.h[current] < 20) {
          if (cells.h[current+next] >= 20) {
            cells.prec[current+next] += Math.max(humidity / rand(10, 20), 1); // coastal precipitation
          } else {
            humidity = Math.min(humidity + 5 * modifier, maxPrec); // wind gets more humidity passing water cell
            cells.prec[current] += 5 * modifier; // water cells precipitation (need to correctly pour water through lakes)
          }
          continue;
        }

        // land cell
        const precipitation = getPrecipitation(humidity, current, next);
        cells.prec[current] += precipitation;
        const evaporation = precipitation > 1.5 ? 1 : 0; // some humidity evaporates back to the atmosphere
        humidity = Math.min(Math.max(humidity - precipitation + evaporation, 0), maxPrec);
      }
    }
  }

  function getPrecipitation(humidity, i, n) {
    if (cells.h[i+n] > 85) return humidity; // 85 is max passable height
    const normalLoss = Math.max(humidity / (10 * modifier), 1); // precipitation in normal conditions
    const diff = Math.max(cells.h[i+n] - cells.h[i], 0); // difference in height
    const mod = (cells.h[i+n] / 70) ** 2; // 50 stands for hills, 70 for mountains
    return Math.min(Math.max(normalLoss + diff * mod, 1), humidity);
  }

  void function drawWindDirection() {
     const wind = prec.append("g").attr("id", "wind");

    d3.range(0, 6).forEach(function(t) {
      if (westerly.length > 1) {
        const west = westerly.filter(w => w[2] === t);
        if (west && west.length > 3) {
          const from = west[0][0], to = west[west.length-1][0];
          const y = (grid.points[from][1] + grid.points[to][1]) / 2;
          wind.append("text").attr("x", 20).attr("y", y).text("\u21C9");
        }
      }
      if (easterly.length > 1) {
        const east = easterly.filter(w => w[2] === t);
        if (east && east.length > 3) {
          const from = east[0][0], to = east[east.length-1][0];
          const y = (grid.points[from][1] + grid.points[to][1]) / 2;
          wind.append("text").attr("x", graphWidth - 52).attr("y", y).text("\u21C7");
        }
      }
    });

    if (northerly) wind.append("text").attr("x", graphWidth / 2).attr("y", 42).text("\u21CA");
    if (southerly) wind.append("text").attr("x", graphWidth / 2).attr("y", graphHeight - 20).text("\u21C8");
  }();

  console.timeEnd('generatePrecipitation');
}

// recalculate Voronoi Graph to pack cells
function reGraph() {
  console.time("reGraph");
  let cells = grid.cells, points = grid.points, features = grid.features;
  const newCells = {p:[], g:[], h:[], t:[], f:[], r:[], biome:[]}; // to store new data
  const spacing2 = grid.spacing ** 2;

  for (const i of cells.i) {
    const height = cells.h[i];
    const type = cells.t[i];
    if (height < 20 && type !== -1 && type !== -2) continue; // exclude all deep ocean points
    if (type === -2 && (i%4=== 0 || features[cells.f[i]].type === "lake")) continue; // exclude non-coastal lake points
    const x = points[i][0], y = points[i][1];

    addNewPoint(x, y); // add point to array
    // add additional points for cells along coast
    if (type === 1 || type === -1) {
      if (cells.b[i]) continue; // not for near-border cells
      cells.c[i].forEach(function(e) {
        if (i > e) return;
        if (cells.t[e] === type) {
          const dist2 = (y - points[e][1]) ** 2 + (x - points[e][0]) ** 2;
          if (dist2 < spacing2) return; // too close to each other
          const x1 = rn((x + points[e][0]) / 2, 1);
          const y1 = rn((y + points[e][1]) / 2, 1);
          addNewPoint(x1, y1);
        }
      });
    }

    function addNewPoint(x, y) {
      newCells.p.push([x, y]);
      newCells.g.push(i);
      newCells.h.push(height);
    }
  }

  calculateVoronoi(pack, newCells.p);
  cells = pack.cells;
  cells.p = newCells.p; // points coordinates [x, y]
  cells.g = grid.cells.i.length < 65535 ? Uint16Array.from(newCells.g) : Uint32Array.from(newCells.g); // reference to initial grid cell
  cells.q = d3.quadtree(cells.p.map((p, d) => [p[0], p[1], d])); // points quadtree for fast search
  cells.h = new Uint8Array(newCells.h); // heights
  cells.area = new Uint16Array(cells.i.length); // cell area
  cells.i.forEach(i => cells.area[i] = Math.abs(d3.polygonArea(getPackPolygon(i))));

  console.timeEnd("reGraph");
}

// Detect and draw the coasline
function drawCoastline() {
  console.time('drawCoastline');
  reMarkFeatures();
  const cells = pack.cells, vertices = pack.vertices, n = cells.i.length, features = pack.features;
  const used = new Uint8Array(features.length); // store conneted features
  const largestLand = d3.scan(features.map(f => f.land ? f.cells : 0), (a, b) => b - a);
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
    let points = vchain.map(v => vertices.p[v]);
    const area = d3.polygonArea(points); // area with lakes/islands
    if (area > 0 && features[f].type === "lake") {
      points = points.reverse();
      vchain = vchain.reverse();
    }

    features[f].area = Math.abs(area);
    features[f].vertices = vchain;

    const path = round(lineGen(points));
    if (features[f].type === "lake") {
      landMask.append("path").attr("d", path).attr("fill", "black").attr("id", "land_"+f);
      // waterMask.append("path").attr("d", path).attr("fill", "white").attr("id", "water_"+id); // uncomment to show over lakes
      lakes.select("#"+features[f].group).append("path").attr("d", path).attr("id", "lake_"+f).attr("data-f", f); // draw the lake
    } else {
      landMask.append("path").attr("d", path).attr("fill", "white").attr("id", "land_"+f);
      waterMask.append("path").attr("d", path).attr("fill", "black").attr("id", "water_"+f);
      const g = features[f].group === "lake_island" ? "lake_island" : "sea_island";
      coastline.select("#"+g).append("path").attr("d", path).attr("id", "island_"+f).attr("data-f", f); // draw the coastline
    }

    // draw ruler to cover the biggest land piece
    if (f === largestLand) {
      const from = points[d3.scan(points, (a, b) => a[0] - b[0])];
      const to = points[d3.scan(points, (a, b) => b[0] - a[0])];
      addRuler(from[0], from[1], to[0], to[1]);
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
    for (let i=0, current = start; i === 0 || current !== start && i < 10000; i++) {
      const prev = chain[chain.length-1]; // previous vertex in chain
      //d3.select("#labels").append("text").attr("x", vertices.p[current][0]).attr("y", vertices.p[current][1]).text(i).attr("font-size", "1px");
      chain.push(current); // add current vertex to sequence
      const c = vertices.c[current] // cells adjacent to vertex
      const v = vertices.v[current] // neighboring vertices
      const c0 = c[0] >= n || cells.t[c[0]] === t;
      const c1 = c[1] >= n || cells.t[c[1]] === t;
      const c2 = c[2] >= n || cells.t[c[2]] === t;
      if (v[0] !== prev && c0 !== c1) current = v[0]; else
      if (v[1] !== prev && c1 !== c2) current = v[1]; else
      if (v[2] !== prev && c0 !== c2) current = v[2];
      if (current === chain[chain.length-1]) {console.error("Next vertex is not found"); break;}
    }
    //chain.push(chain[0]); // push first vertex as the last one
    return chain;
  }

  // move vertices that are too close to already added ones
  function relax(vchain, r) {
    const p = vertices.p, tree = d3.quadtree();

    for (let i=0; i < vchain.length; i++) {
      const v = vchain[i];
      let [x, y] = [p[v][0], p[v][1]];
      if (i && vchain[i+1] && tree.find(x, y, r) !== undefined) {
        const v1 = vchain[i-1], v2 = vchain[i+1];
        const [x1, y1] = [p[v1][0], p[v1][1]];
        const [x2, y2] = [p[v2][0], p[v2][1]];
        [x, y] = [(x1 + x2) / 2, (y1 + y2) / 2];
        p[v] = [x, y];
      }
      tree.add([x, y]);
    }
  }

  console.timeEnd('drawCoastline');
}

// Re-mark features (ocean, lakes, islands)
function reMarkFeatures() {
  console.time("reMarkFeatures");
  const cells = pack.cells, features = pack.features = [0];
  cells.f = new Uint16Array(cells.i.length); // cell feature number
  cells.t = new Int16Array(cells.i.length); // cell type: 1 = land along coast; -1 = water along coast;
  cells.haven = new Uint16Array(cells.i.length); // cell haven (opposite water cell);
  cells.harbor = new Uint16Array(cells.i.length); // cell harbor (number of adjacent water cells);

  for (let i=1, queue=[0]; queue[0] !== -1; i++) {
    const start = queue[0]; // first cell
    cells.f[start] = i; // assign feature number
    const land = cells.h[start] >= 20;
    let border = false; // true if feature touches map border
    let cellNumber = 1; // to count cells number in a feature

    while (queue.length) {
      const q = queue.pop();
      if (cells.b[q]) border = true;
      cells.c[q].forEach(function(e) {
        const eLand = cells.h[e] >= 20;
        if (land && !eLand) {
          cells.t[q] = 1;
          cells.t[e] = -1;
          cells.harbor[q]++;
          if (!cells.haven[q]) cells.haven[q] = e;
        } else if (land && eLand) {
          if (!cells.t[e] && cells.t[q] === 1) cells.t[e] = 2;
          else if (!cells.t[q] && cells.t[e] === 1) cells.t[q] = 2;
        }
        if (land === eLand && cells.f[e] === 0) {
          cells.f[e] = i;
          queue.push(e);
          cellNumber++;
        }
      });
    }

    const type = land ? "island" : border ? "ocean" : "lake";
    let group;
    if (type === "lake") group = defineLakeGroup(start, cellNumber);
    else if (type === "ocean") group = "ocean"; 
    else if (type === "island") group = defineIslandGroup(start, cellNumber);
    features.push({i, land, border, type, cells: cellNumber, firstCell: start, group});
    queue[0] = cells.f.findIndex(f => !f); // find unmarked cell
  }

  function defineLakeGroup(cell, number) {
    const temp = grid.cells.temp[cells.g[cell]];
    if (temp > 24) return "salt";
    if (temp < -3) return "frozen";
    const height = d3.max(cells.c[cell].map(c => cells.h[c]));
    if (height > 69 && number < 3 && cell%5 === 0) return "sinkhole";
    if (height > 69 && number < 10 && cell%5 === 0) return "lava";
    return "freshwater";
  }

  function defineIslandGroup(cell, number) {
    if (cell && features[cells.f[cell-1]].type === "lake") return "lake_island";
    if (number > grid.cells.i.length / 10) return "continent";
    if (number > grid.cells.i.length / 1000) return "island";
    return "isle";
  }

  console.timeEnd("reMarkFeatures");
}

// temporary elevate some lakes to resolve depressions and flux the water to form an open (exorheic) lake
function elevateLakes() {
  if (templateInput.value === "Atoll") return; // no need for Atolls
  console.time('elevateLakes');
  const cells = pack.cells, features = pack.features;
  const maxCells = cells.i.length / 100; // size limit; let big lakes be closed (endorheic)
  cells.i.forEach(i => {
    if (cells.h[i] >= 20) return;
    if (features[cells.f[i]].group !== "freshwater" || features[cells.f[i]].cells > maxCells) return;
    cells.h[i] = 20;
    //debug.append("circle").attr("cx", cells.p[i][0]).attr("cy", cells.p[i][1]).attr("r", .5).attr("fill", "blue");
  });

  console.timeEnd('elevateLakes');
}

// assign biome id for each cell
function defineBiomes() {
  console.time("defineBiomes");
  const cells = pack.cells, f = pack.features;
  cells.biome = new Uint8Array(cells.i.length); // biomes array

  for (const i of cells.i) {
    if (f[cells.f[i]].group === "freshwater") cells.h[i] = 19; // de-elevate lakes
    if (cells.h[i] < 20) continue; // water cells have biome 0
    let moist = grid.cells.prec[cells.g[i]];
    if (cells.r[i]) moist += Math.max(cells.fl[i] / 20, 2);
    const n = cells.c[i].filter(isLand).map(c => grid.cells.prec[cells.g[c]]).concat([moist]);
    moist = rn(4 + d3.mean(n));
    const temp = grid.cells.temp[cells.g[i]]; // flux from precipitation
    cells.biome[i] = getBiomeId(moist, temp, cells.h[i]);
  }

  console.timeEnd("defineBiomes");
}

function getBiomeId(moisture, temperature, height) {
  if (temperature < -5) return 11; // permafrost biome
  if (moisture > 40 && height < 25 || moisture > 24 && height > 24) return 12; // wetland biome
  const m = Math.min(moisture / 5 | 0, 4); // moisture band from 0 to 4
  const t = Math.min(Math.max(20 - temperature, 0), 25); // temparature band from 0 to 25
  return pack.biomesMartix[m][t];
}

// assess cells suitability to calculate population and rand cells for culture center and burgs placement
function rankCells() {
  console.time('rankCells');
  const cells = pack.cells, f = pack.features;
  cells.s = new Int16Array(cells.i.length); // cell suitability array
  cells.pop = new Float32Array(cells.i.length); // cell population array

  const flMean = d3.median(cells.fl.filter(f => f)), flMax = d3.max(cells.fl) + d3.max(cells.conf); // to normalize flux
  const areaMean = d3.mean(cells.area); // to adjust population by cell area

  for (const i of cells.i) {
    let s = +pack.biomes[cells.biome[i]].habitability; // base suitability derived from biome habitability
    if (!s) continue; // uninhabitable biomes has 0 suitability
    s += normalize(cells.fl[i] + cells.conf[i], flMean, flMax) * 250; // big rivers and confluences are valued
    s -= (cells.h[i] - 50) / 5; // low elevation is valued, high is not;

    if (cells.t[i] === 1) {
      if (cells.r[i]) s += 15; // estuary is valued
      const type = f[cells.f[cells.haven[i]]].type;
      const group = f[cells.f[cells.haven[i]]].group;
      if (type === "lake") {
        // lake coast is valued
        if (group === "freshwater") s += 30;
        else if (group !== "lava") s += 10;
      } else {
        s += 5; // ocean coast is valued
        if (cells.harbor[i] === 1) s += 20; // safe sea harbor is valued
      }
    }

    cells.s[i] = s / 5; // general population rate
    // cell rural population is suitability adjusted by cell area
    cells.pop[i] = cells.s[i] > 0 ? cells.s[i] * cells.area[i] / areaMean : 0;
  }

  console.timeEnd('rankCells');
}

// generate some markers
function addMarkers(number = 1) {
  if (!number) return;
  console.time("addMarkers");
  const cells = pack.cells;

  void function addVolcanoes() {
    let mounts = Array.from(cells.i).filter(i => cells.h[i] > 70).sort((a, b) => cells.h[b] - cells.h[a]);
    let count = mounts.length < 10 ? 0 : Math.ceil(mounts.length / 300 * number);
    if (count) addMarker("volcano", "🌋", 52, 52, 17.5);

    while (count) {
      const cell = mounts.splice(biased(0, mounts.length-1, 5), 1);
      const x = cells.p[cell][0], y = cells.p[cell][1];
      const id = getNextId("markerElement");
      markers.append("use").attr("id", id).attr("data-cell", cell)
        .attr("xlink:href", "#marker_volcano").attr("data-id", "#marker_volcano")
        .attr("data-x", x).attr("data-y", y).attr("x", x - 15).attr("y", y - 30)
        .attr("data-size", 1).attr("width", 30).attr("height", 30);
      const height = getFriendlyHeight([x, y]);
      const proper = Names.getCulture(cells.culture[cell]);
      const name = Math.random() < .3 ? "Mount " + proper : Math.random() > .3 ? proper + " Volcano" : proper;
      notes.push({id, name, legend:`Active volcano. Height: ${height}`});
      count--;
    }
  }()

  void function addHotSprings() {
    let springs = Array.from(cells.i).filter(i => cells.h[i] > 50).sort((a, b) => cells.h[b]-cells.h[a]);
    let count = springs.length < 30 ? 0 : Math.ceil(springs.length / 1000 * number);
    if (count) addMarker("hot_springs", "♨", 50, 50, 19.5);

    while (count) {
      const cell = springs.splice(biased(1, springs.length-1, 3), 1);
      const x = cells.p[cell][0], y = cells.p[cell][1];
      const id = getNextId("markerElement");
      markers.append("use").attr("id", id)
        .attr("xlink:href", "#marker_hot_springs").attr("data-id", "#marker_hot_springs")
        .attr("data-x", x).attr("data-y", y).attr("x", x - 15).attr("y", y - 30)
        .attr("data-size", 1).attr("width", 30).attr("height", 30);

      const proper = Names.getCulture(cells.culture[cell]);
      const temp = convertTemperature(gauss(30,15,20,100));
      notes.push({id, name: proper + " Hot Springs", legend:`A hot springs area. Temperature: ${temp}`});
      count--;
    }
  }()

  void function addMines() {
    let hills = Array.from(cells.i).filter(i => cells.h[i] > 47 && cells.burg[i]);
    let count = !hills.length ? 0 : Math.ceil(hills.length / 7 * number);
    if (!count) return;

    addMarker("mine", "⚒", 50, 50, 20);
    const resources = {"salt":5, "gold":2, "silver":4, "copper":2, "iron":3, "lead":1, "tin":1};

    while (count) {
      const cell = hills.splice(Math.floor(Math.random() * hills.length), 1);
      const x = cells.p[cell][0], y = cells.p[cell][1];
      const id = getNextId("markerElement");
      markers.append("use").attr("id", id)
        .attr("xlink:href", "#marker_mine").attr("data-id", "#marker_mine")
        .attr("data-x", x).attr("data-y", y).attr("x", x - 15).attr("y", y - 30)
        .attr("data-size", 1).attr("width", 30).attr("height", 30);
      const resource = rw(resources);
      const burg = pack.burgs[cells.burg[cell]];
      const name = `${burg.name} - ${resource} mining town`;
      const population = rn(burg.population * populationRate.value * urbanization.value);
      const legend = `${burg.name} is a mining town of ${population} people just nearby the ${resource} mine`;
      notes.push({id, name, legend});
      count--;
    }
  }()

  void function addBridges() {
    const meanRoad = d3.mean(cells.road.filter(r => r));
    const meanFlux = d3.mean(cells.fl.filter(fl => fl));

    let bridges = Array.from(cells.i)
      .filter(i => cells.burg[i] && cells.h[i] >= 20 && cells.r[i] && cells.fl[i] > meanFlux && cells.road[i] > meanRoad)
      .sort((a, b) => (cells.road[b] + cells.fl[b] / 10) - (cells.road[a] + cells.fl[a] / 10));

    let count = !bridges.length ? 0 : Math.ceil(bridges.length / 12 * number);
    if (count) addMarker("bridge", "🌉", 50, 50, 16.5);

    while (count) {
      const cell = bridges.splice(0, 1);
      const x = cells.p[cell][0], y = cells.p[cell][1];
      const id = getNextId("markerElement");
      markers.append("use").attr("id", id)
        .attr("xlink:href", "#marker_bridge").attr("data-id", "#marker_bridge")
        .attr("data-x", x).attr("data-y", y).attr("x", x - 15).attr("y", y - 30)
        .attr("data-size", 1).attr("width", 30).attr("height", 30);

      const burg = pack.burgs[cells.burg[cell]];
      const river = pack.rivers.find(r => r.i === pack.cells.r[cell]);
      const riverName = river ? `${river.name} ${river.type}` : "river";
      const name = river && Math.random() < .2 ? river.name : burg.name;
      notes.push({id, name:`${name} Bridge`, legend:`A stone bridge over the ${riverName} near ${burg.name}`});
      count--;
    }
  }()

  void function addInns() {
    const maxRoad = d3.max(cells.road) * .9;
    let taverns = Array.from(cells.i).filter(i => cells.crossroad[i] && cells.h[i] >= 20 && cells.road[i] > maxRoad);
    if (!taverns.length) return;
    const count = Math.ceil(4 * number);
    addMarker("inn", "🍻", 50, 50, 17.5);

    const color = ["Dark", "Light", "Bright", "Golden", "White", "Black", "Red", "Pink", "Purple", "Blue", "Green", "Yellow", "Amber", "Orange", "Brown", "Grey"];
    const animal = ["Antelope", "Ape", "Badger", "Bear", "Beaver", "Bison", "Boar", "Buffalo", "Cat", "Crane", "Crocodile", "Crow", "Deer", "Dog", "Eagle", "Elk", "Fox", "Goat", "Goose", "Hare", "Hawk", "Heron", "Horse", "Hyena", "Ibis", "Jackal", "Jaguar", "Lark", "Leopard", "Lion", "Mantis", "Marten", "Moose", "Mule", "Narwhal", "Owl", "Panther", "Rat", "Raven", "Rook", "Scorpion", "Shark", "Sheep", "Snake", "Spider", "Swan", "Tiger", "Turtle", "Wolf", "Wolverine", "Camel", "Falcon", "Hound", "Ox"];
    const adj = ["New", "Good", "High", "Old", "Great", "Big", "Major", "Happy", "Main", "Huge", "Far", "Beautiful", "Fair", "Prime", "Ancient", "Golden", "Proud", "Lucky", "Fat", "Honest", "Giant", "Distant", "Friendly", "Loud", "Hungry", "Magical", "Superior", "Peaceful", "Frozen", "Divine", "Favorable", "Brave", "Sunny", "Flying"];

    for (let i=0; i < taverns.length && i < count; i++) {
      const cell = taverns.splice(Math.floor(Math.random() * taverns.length), 1);
      const x = cells.p[cell][0], y = cells.p[cell][1];
      const id = getNextId("markerElement");

      markers.append("use").attr("id", id)
        .attr("xlink:href", "#marker_inn").attr("data-id", "#marker_inn")
        .attr("data-x", x).attr("data-y", y).attr("x", x - 15).attr("y", y - 30)
        .attr("data-size", 1).attr("width", 30).attr("height", 30);

      const type = Math.random() > .7 ? "inn" : "tavern";
      const name = Math.random() < .5 ? ra(color) + " " + ra(animal) : Math.random() < .6 ? ra(adj) + " " + ra(animal) : ra(adj) + " " + capitalize(type);
      notes.push({id, name: "The " + name, legend:`A big and famous roadside ${type}`});
    }
  }()

  void function addLighthouses() {
    const lands = cells.i.filter(i => cells.harbor[i] > 6 && cells.c[i].some(c => cells.h[c] < 20 && cells.road[c]));
    const lighthouses = Array.from(lands).map(i => [i, cells.v[i][cells.c[i].findIndex(c => cells.h[c] < 20 && cells.road[c])]]);
    if (lighthouses.length) addMarker("lighthouse", "🚨", 50, 50, 16);
    const count = Math.ceil(4 * number);

    for (let i=0; i < lighthouses.length && i < count; i++) {
      const cell = lighthouses[i][0], vertex = lighthouses[i][1];
      const x = pack.vertices.p[vertex][0], y = pack.vertices.p[vertex][1];
      const id = getNextId("markerElement");

      markers.append("use").attr("id", id)
        .attr("xlink:href", "#marker_lighthouse").attr("data-id", "#marker_lighthouse")
        .attr("data-x", x).attr("data-y", y).attr("x", x - 15).attr("y", y - 30)
        .attr("data-size", 1).attr("width", 30).attr("height", 30);

      const proper = cells.burg[cell] ? pack.burgs[cells.burg[cell]].name : Names.getCulture(cells.culture[cell]);
      notes.push({id, name: getAdjective(proper) + " Lighthouse" + name, legend:`A lighthouse to keep the navigation safe`});
    }
  }()

  void function addWaterfalls() {
    const waterfalls = cells.i.filter(i => cells.r[i] && cells.h[i] > 70);
    if (waterfalls.length) addMarker("waterfall", "⟱", 50, 54, 16.5);
    const count = Math.ceil(3 * number);

    for (let i=0; i < waterfalls.length && i < count; i++) {
      const cell = waterfalls[i];
      const x = cells.p[cell][0], y = cells.p[cell][1];
      const id = getNextId("markerElement");

      markers.append("use").attr("id", id)
        .attr("xlink:href", "#marker_waterfall").attr("data-id", "#marker_waterfall")
        .attr("data-x", x).attr("data-y", y).attr("x", x - 15).attr("y", y - 30)
        .attr("data-size", 1).attr("width", 30).attr("height", 30);

      const proper = cells.burg[cell] ? pack.burgs[cells.burg[cell]].name : Names.getCulture(cells.culture[cell]);
      notes.push({id, name: getAdjective(proper) + " Waterfall" + name, legend:`An extremely beautiful waterfall`});
    }
  }()

  void function addBattlefields() {
    let battlefields = Array.from(cells.i).filter(i => cells.pop[i] > 2 && cells.h[i] < 50 && cells.h[i] > 25);
    let count = battlefields.length < 100 ? 0 : Math.ceil(battlefields.length / 500 * number);
    const era = Names.getCulture(0, 3, 7, "", 0) + " Era";
    if (count) addMarker("battlefield", "⚔", 50, 50, 20);

    while (count) {
      const cell = battlefields.splice(Math.floor(Math.random() * battlefields.length), 1);
      const x = cells.p[cell][0], y = cells.p[cell][1];
      const id = getNextId("markerElement");
      markers.append("use").attr("id", id)
        .attr("xlink:href", "#marker_battlefield").attr("data-id", "#marker_battlefield")
        .attr("data-x", x).attr("data-y", y).attr("x", x - 15).attr("y", y - 30)
        .attr("data-size", 1).attr("width", 30).attr("height", 30);

      const name = Names.getCulture(cells.culture[cell]) + " Battlefield";
      const date = new Date(rand(100, 1000),rand(12),rand(31)).toLocaleDateString("en", {year:'numeric', month:'long', day:'numeric'}) + " " + era;
      notes.push({id, name, legend:`A historical battlefield spot. \r\nDate: ${date}`});
      count--;
    }
  }()

  function addMarker(id, icon, x, y, size) {
    const markers = svg.select("#defs-markers");
    if (markers.select("#marker_"+id).size()) return;

    const symbol = markers.append("symbol").attr("id", "marker_"+id).attr("viewBox", "0 0 30 30");
    symbol.append("path").attr("d", "M6,19 l9,10 L24,19").attr("fill", "#000000").attr("stroke", "none");
    symbol.append("circle").attr("cx", 15).attr("cy", 15).attr("r", 10).attr("fill", "#ffffff").attr("stroke", "#000000").attr("stroke-width", 1);
    symbol.append("text").attr("x", x+"%").attr("y", y+"%").attr("fill", "#000000").attr("stroke", "#3200ff").attr("stroke-width", 0)
      .attr("font-size", size+"px").attr("dominant-baseline", "central").text(icon);
  }

  console.timeEnd("addMarkers");
}

// regenerate some zones
function addZones(number = 1) {
  console.time("addZones");
  const data = [], cells = pack.cells, states = pack.states, burgs = pack.burgs;
  const used = new Uint8Array(cells.i.length); // to store used cells

  for (let i=0; i < rn(Math.random() * 1.8 * number); i++) addInvasion(); // invasion of enemy lands
  for (let i=0; i < rn(Math.random() * 1.6 * number); i++) addRebels(); // rebels along a state border
  for (let i=0; i < rn(Math.random() * 1.6 * number); i++) addProselytism(); // proselitism of organized religion
  for (let i=0; i < rn(Math.random() * 1.6 * number); i++) addCrusade(); // crusade on heresy lands
  for (let i=0; i < rn(Math.random() * 1.8 * number); i++) addDisease(); // disease starting in a random city
  for (let i=0; i < rn(Math.random() * 1.4 * number); i++) addDisaster(); // disaster starting in a random city
  for (let i=0; i < rn(Math.random() * 1.4 * number); i++) addEruption(); // volcanic eruption aroung volcano
  for (let i=0; i < rn(Math.random() * 1.0 * number); i++) addAvalanche(); // avalanche impacting highland road
  for (let i=0; i < rn(Math.random() * 1.4 * number); i++) addFault(); // fault line in elevated areas
  for (let i=0; i < rn(Math.random() * 1.4 * number); i++) addFlood() // flood on river banks
  for (let i=0; i < rn(Math.random() * 1.2 * number); i++) addTsunami() // tsunami starting near coast

  function addInvasion() {
    const atWar = states.filter(s => s.diplomacy && s.diplomacy.some(d => d === "Enemy"));
    if (!atWar.length) return;

    const invader = ra(atWar);
    const target = invader.diplomacy.findIndex(d => d === "Enemy");

    const cell = ra(cells.i.filter(i => cells.state[i] === target && cells.c[i].some(c => cells.state[c] === invader.i)));
    if (!cell) return;

    const cellsArray = [], queue = [cell], power = rand(5, 30);

    while (queue.length) {
      const q = Math.random() < .4 ? queue.shift() : queue.pop();
      cellsArray.push(q);
      if (cellsArray.length > power) break;

      cells.c[q].forEach(e => {
        if (used[e]) return;
        if (cells.state[e] !== target) return;
        used[e] = 1;
        queue.push(e);
      });
    }

    const invasion = rw({"Invasion":4, "Occupation":3, "Raid":2, "Conquest":2, 
      "Subjugation":1, "Foray":1, "Skirmishes":1, "Incursion":2, "Pillaging":1, "Intervention":1});
    const name = getAdjective(invader.name) + " " + invasion;
    data.push({name, type:"Invasion", cells:cellsArray, fill:"url(#hatch1)"});
  }

  function addRebels() {
    const state = ra(states.filter(s => s.i && s.neighbors.some(n => n)));
    if (!state) return;

    const neib = ra(state.neighbors.filter(n => n));
    const cell = cells.i.find(i => cells.state[i] === state.i && cells.c[i].some(c => cells.state[c] === neib));
    const cellsArray = [], queue = [cell], power = rand(10, 30);

    while (queue.length) {
      const q = queue.shift();
      cellsArray.push(q);
      if (cellsArray.length > power) break;

      cells.c[q].forEach(e => {
        if (used[e]) return;
        if (cells.state[e] !== state.i) return;
        used[e] = 1;
        if (e%4 !== 0 && !cells.c[e].some(c => cells.state[c] === neib)) return;
        queue.push(e);
      });
    }

    const rebels = rw({"Rebels":5, "Insurgents":2, "Mutineers":1, "Rioters":1, "Separatists":1, 
      "Secessionists":1, "Insurrection":2, "Rebellion":1, "Conspiracy":2});
    const name = getAdjective(states[neib].name) + " " + rebels;
    data.push({name, type:"Rebels", cells:cellsArray, fill:"url(#hatch3)"});
  }

  function addProselytism() {
    const organized = ra(pack.religions.filter(r => r.type === "Organized"));
    if (!organized) return;

    const cell = ra(cells.i.filter(i => cells.religion[i] && cells.religion[i] !== organized.i && cells.c[i].some(c => cells.religion[c] === organized.i)));
    if (!cell) return;
    const target = cells.religion[cell];
    const cellsArray = [], queue = [cell], power = rand(10, 30);

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
    data.push({name, type:"Proselytism", cells:cellsArray, fill:"url(#hatch6)"});
  }

  function addCrusade() {
    const heresy = ra(pack.religions.filter(r => r.type === "Heresy"));
    if (!heresy) return;

    const cellsArray = cells.i.filter(i => !used[i] && cells.religion[i] === heresy.i);
    if (!cellsArray.length) return;
    cellsArray.forEach(i => used[i] = 1);

    const name = getAdjective(heresy.name.split(" ")[0]) + " Crusade";
    data.push({name, type:"Crusade", cells:cellsArray, fill:"url(#hatch6)"});
  }

  function addDisease() {
    const burg = ra(burgs.filter(b => !used[b.cell] && b.i && !b.removed)); // random burg
    if (!burg) return;

    const cellsArray = [], cost = [], power = rand(20, 37);
    const queue = new PriorityQueue({comparator: (a, b) => a.p - b.p});
    queue.queue({e:burg.cell, p:0});

    while (queue.length) {
      const next = queue.dequeue();
      if (cells.burg[next.e] || cells.pop[next.e]) cellsArray.push(next.e);
      used[next.e] = 1;

      cells.c[next.e].forEach(function(e) {
        const r = cells.road[next.e];
        const c = r ? Math.max(10 - r, 1) : 100;
        const p = next.p + c;
        if (p > power) return;

        if (!cost[e] || p < cost[e]) {
          cost[e] = p;
          queue.queue({e, p});
        }
      });
    }

    const adjective = () => ra(["Great", "Silent", "Severe", "Blind", "Unknown", "Loud", "Deadly", "Burning", "Bloody", "Brutal", "Fatal"]);
    const animal = () => ra(["Ape", "Bear", "Boar", "Cat", "Cow", "Dog", "Pig", "Fox", "Bird", "Horse", "Rat", "Raven", "Sheep", "Spider", "Wolf"]);
    const color = () => ra(["Golden", "White", "Black", "Red", "Pink", "Purple", "Blue", "Green", "Yellow", "Amber", "Orange", "Brown", "Grey"]);

    const type = rw({"Fever":5, "Pestilence":2, "Flu":2, "Pox":2, "Smallpox":2, "Plague":4, "Cholera":2, "Dropsy":1, "Leprosy":2});
    const name = rw({[color()]:4, [animal()]:2, [adjective()]:1}) + " " + type;
    data.push({name, type:"Disease", cells:cellsArray, fill:"url(#hatch12)"});
  }

  function addDisaster() {
    const burg = ra(burgs.filter(b => !used[b.cell] && b.i && !b.removed)); // random burg
    if (!burg) return;

    const cellsArray = [], cost = [], power = rand(5, 25);
    const queue = new PriorityQueue({comparator: (a, b) => a.p - b.p});
    queue.queue({e:burg.cell, p:0});

    while (queue.length) {
      const next = queue.dequeue();
      if (cells.burg[next.e] || cells.pop[next.e]) cellsArray.push(next.e);
      used[next.e] = 1;

      cells.c[next.e].forEach(function(e) {
        const c = rand(1, 10);
        const p = next.p + c;
        if (p > power) return;

        if (!cost[e] || p < cost[e]) {
          cost[e] = p;
          queue.queue({e, p});
        }
      });
    }

    const type = rw({"Famine":5, "Dearth":1, "Drought":3, "Earthquake":3, "Tornadoes":1, "Wildfires":1});
    const name = getAdjective(burg.name) + " " + type;
    data.push({name, type:"Disaster", cells:cellsArray, fill:"url(#hatch5)"});
  }

  function addEruption() {
    const volcanoes = [];
    markers.selectAll("use[data-id='#marker_volcano']").each(function() {
      volcanoes.push(this.dataset.cell);
    });
    if (!volcanoes.length) return;

    const cell = +ra(volcanoes);
    const id = markers.select("use[data-cell='"+cell+"']").attr("id");
    const note = notes.filter(n => n.id === id);

    if (note[0]) note[0].legend = note[0].legend.replace("Active volcano", "Erupting volcano");
    const name = note[0] ? note[0].name.replace(" Volcano", "") + " Eruption" : "Volcano Eruption";

    const cellsArray = [], queue = [cell], power = rand(10, 30);

    while (queue.length) {
      const q = Math.random() < .5 ? queue.shift() : queue.pop();
      cellsArray.push(q);
      if (cellsArray.length > power) break;
      cells.c[q].forEach(e => {
        if (used[e]) return;
        used[e] = 1;
        queue.push(e);
      });
    }

    data.push({name, type:"Disaster", cells:cellsArray, fill:"url(#hatch7)"});
  }

  function addAvalanche() {
    const roads = cells.i.filter(i => !used[i] && cells.road[i] && cells.h[i] >= 70);
    if (!roads.length) return;

    const cell = +ra(roads);
    const cellsArray = [], queue = [cell], power = rand(3, 15);

    while (queue.length) {
      const q = Math.random() < .3 ? queue.shift() : queue.pop();
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
    data.push({name, type:"Disaster", cells:cellsArray, fill:"url(#hatch5)"});
  }

  function addFault() {
    const elevated = cells.i.filter(i => !used[i] && cells.h[i] > 50 && cells.h[i] < 70);
    if (!elevated.length) return;

    const cell = ra(elevated);
    const cellsArray = [], queue = [cell], power = rand(3, 15);

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
    data.push({name, type:"Disaster", cells:cellsArray, fill:"url(#hatch2)"});
  }

  function addFlood() {
    const fl = cells.fl.filter(fl => fl), meanFlux = d3.mean(fl), maxFlux = d3.max(fl), flux = (maxFlux - meanFlux) / 2 + meanFlux;
    const rivers = cells.i.filter(i => !used[i] && cells.h[i] < 50 && cells.r[i] && cells.fl[i] > flux && cells.burg[i]);
    if (!rivers.length) return;

    const cell = +ra(rivers), river = cells.r[cell];
    const cellsArray = [], queue = [cell], power = rand(5, 30);

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
    data.push({name, type:"Disaster", cells:cellsArray, fill:"url(#hatch13)"});
  }

  function addTsunami() {
    const coastal = cells.i.filter(i => !used[i] && cells.t[i] === -1 && pack.features[cells.f[i]].type !== "lake");
    if (!coastal.length) return;

    const cell = +ra(coastal);
    const cellsArray = [], queue = [cell], power = rand(10, 30);

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
    data.push({name, type:"Disaster", cells:cellsArray, fill:"url(#hatch13)"});
  }

  void function drawZones() {
    zones.selectAll("g").data(data).enter().append("g")
      .attr("id", (d, i) => "zone"+i).attr("data-description", d => d.name).attr("data-type", d => d.type)
      .attr("data-cells", d => d.cells.join(",")).attr("fill", d => d.fill)
      .selectAll("polygon").data(d => d.cells).enter().append("polygon")
      .attr("points", d => getPackPolygon(d)).attr("id", function(d) {return this.parentNode.id+"_"+d});
  }()

  console.timeEnd("addZones");
}

// show map stats on generation complete
function showStatistics() {
  const template = templateInput.value;
  const templateRandom = locked("template") ? "" : "(random)";
  const stats = `  Seed: ${seed}
  Size: ${graphWidth}x${graphHeight}
  Template: ${template} ${templateRandom}
  Points: ${grid.points.length}
  Cells: ${pack.cells.i.length}
  States: ${pack.states.length-1}
  Provinces: ${pack.provinces.length-1}
  Burgs: ${pack.burgs.length-1}
  Religions: ${pack.religions.length-1}
  Culture set: ${culturesSet.selectedOptions[0].innerText}
  Cultures: ${pack.cultures.length-1}`;
  mapHistory.push({seed, width:graphWidth, height:graphHeight, template, created: Date.now()});
  console.log(stats);
}

const regenerateMap = debounce(function() {
  console.warn("Generate new random map");
  closeDialogs("#worldConfigurator, #options3d");
  customization = 0;
  undraw();
  resetZoom(1000);
  generate();
  restoreLayers();
  const canvas3d = document.getElementById("canvas3d");
  if (canvas3d) ThreeD.redraw();
  if ($("#worldConfigurator").is(":visible")) editWorld();
}, 500);

// Clear the map
function undraw() {
  viewbox.selectAll("path, circle, polygon, line, text, use, #zones > g, #ruler > g").remove();
  defs.selectAll("path, clipPath").remove();
  notes = [];
  unfog();
}
