"use strict";
// define global vabiable, each to be refactored and de-globalized 1-by-1

let grid = {}; // initial graph based on jittered square grid and data
let pack = {}; // packed graph and data

let seed;
let mapId;
let mapHistory = [];

let elSelected;

let notes = [];
let customization = 0;

let rulers;
let biomesData;
let nameBases;

// defined in main.ts
let graphWidth;
let graphHeight;
let svgWidth;
let svgHeight;

let options = {};
let populationRate;
let distanceScale;
let urbanization;
let urbanDensity;
let statesNeutral;

// svg d3 selections
let svg,
  defs,
  viewbox,
  scaleBar,
  legend,
  ocean,
  oceanLayers,
  oceanPattern,
  lakes,
  landmass,
  texture,
  terrs,
  biomes,
  //  cells,
  gridOverlay,
  coordinates,
  compass,
  rivers,
  terrain,
  relig,
  cults,
  regions,
  statesBody,
  statesHalo,
  provs,
  zones,
  borders,
  stateBorders,
  provinceBorders,
  routes,
  roads,
  trails,
  searoutes,
  temperature,
  coastline,
  ice,
  prec,
  population,
  emblems,
  labels,
  icons,
  burgLabels,
  burgIcons,
  anchors,
  armies,
  markers,
  fogging,
  ruler,
  debug;
