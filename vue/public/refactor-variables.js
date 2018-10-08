// Fantasy Map Generator main script
// Azgaar (maxganiev@yandex.com). Minsk, 2017-2018
// https://github.com/Azgaar/Fantasy-Map-Generator
// GNU General Public License v3.0

// To programmers:
  // I don't mind of any help with programming
  // I know the code is badly structurized and it's hard to read it as a single page
  // Meanwhile a core part takes only 300-500 lines

// What should be done generally:
  // Refactor the code
  // Modernize the code (ES6)
  // Optimize the code
  // Modulize the code

// And particularry:
  // Migrate from d3-voronoi to mapbox-delunator or d3-delaunay
  // Use typed arrays instead of array of objects
  // Get rid of jQuery as d3.js can almost all the same and more
  // Re-build UI on reactive approach, vue.js

"use strict";
//fantasyMap();
//function fantasyMap() {
  // Version control
  const version = "0.60b";
  document.title += " v. " + version;

  // Declare variables
  let svg = d3.select("svg");
  let defs = svg.select("#deftemp");
  let viewbox = svg.append("g").attr("id", "viewbox");
  let ocean = viewbox.append("g").attr("id", "ocean");
  let oceanLayers = ocean.append("g").attr("id", "oceanLayers");
  let oceanPattern = ocean.append("g").attr("id", "oceanPattern");
  let landmass = viewbox.append("g").attr("id", "landmass");
  let terrs = viewbox.append("g").attr("id", "terrs");
  let grid = viewbox.append("g").attr("id", "grid");
  let overlay = viewbox.append("g").attr("id", "overlay");
  let rivers = viewbox.append("g").attr("id", "rivers");
  let terrain = viewbox.append("g").attr("id", "terrain");
  let cults = viewbox.append("g").attr("id", "cults");
  let regions = viewbox.append("g").attr("id", "regions");
  let borders = viewbox.append("g").attr("id", "borders");
  let stateBorders = borders.append("g").attr("id", "stateBorders");
  let neutralBorders = borders.append("g").attr("id", "neutralBorders");
  let lakes = viewbox.append("g").attr("id", "lakes");
  let routes = viewbox.append("g").attr("id", "routes");
  let roads = routes.append("g").attr("id", "roads").attr("data-type", "land");
  let trails = routes.append("g").attr("id", "trails").attr("data-type", "land");
  let searoutes = routes.append("g").attr("id", "searoutes").attr("data-type", "sea");
  let coastline = viewbox.append("g").attr("id", "coastline");
  let labels = viewbox.append("g").attr("id", "labels");
  let burgLabels = labels.append("g").attr("id", "burgLabels");
  let icons = viewbox.append("g").attr("id", "icons");
  let burgIcons = icons.append("g").attr("id", "burgIcons");
  let markers = viewbox.append("g").attr("id", "markers");
  let ruler = viewbox.append("g").attr("id", "ruler");
  let debug = viewbox.append("g").attr("id", "debug");

  labels.append("g").attr("id", "countries");
  burgIcons.append("g").attr("id", "capitals");
  burgLabels.append("g").attr("id", "capitals");
  burgIcons.append("g").attr("id", "towns");
  burgLabels.append("g").attr("id", "towns");
  icons.append("g").attr("id", "capital-anchors");
  icons.append("g").attr("id", "town-anchors");
  terrain.append("g").attr("id", "hills");
  terrain.append("g").attr("id", "mounts");
  terrain.append("g").attr("id", "swamps");
  terrain.append("g").attr("id", "forests");

  // append ocean pattern
  oceanPattern.append("rect").attr("fill", "url(#oceanic)").attr("stroke", "none");
  oceanLayers.append("rect").attr("id", "oceanBase");

  // main data variables
  let seed;
  let params;
  let voronoi;
  let diagram;
  let polygons;
  let spacing;
  let points = [];
  let heights;
  // Common variables
  const modules = {};
  let customization = 0;
  let history = [];
  let historyStage = 0;
  let elSelected;
  let autoResize = true;
  let graphSize;
  let cells = [];
  let land = [];
  let riversData = [];
  let manors = [];
  let states = [];
  let features = [];
  let notes = [];
  let queue = [];
  const fonts = ["Almendra+SC", "Georgia", "Times+New+Roman", "Comic+Sans+MS", "Lucida+Sans+Unicode", "Courier+New"];

  // Cultures-related data
  let defaultCultures = [];
  let cultures = [];
  const chain = {};
  let nameBases = [];
  let nameBase = [];
  let cultureTree;
  const vowels = "aeiouy";

  // canvas element for raster images
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  // Color schemes
  let color = d3.scaleSequential(d3.interpolateSpectral);
  const colors8 = d3.scaleOrdinal(d3.schemeSet2);
  const colors20 = d3.scaleOrdinal(d3.schemeCategory20);

  // D3 drag and zoom behavior
  let scale = 1, viewX = 0, viewY = 0;
