import * as d3 from "d3";

export function defineSvg(width, height) {
  // append svg layers (in default order)
  svg = d3.select("#map");
  defs = svg.select("#deftemp");
  viewbox = svg.select("#viewbox");
  scaleBar = svg.select("#scaleBar");
  legend = svg.append("g").attr("id", "legend");
  ocean = viewbox.append("g").attr("id", "ocean");
  oceanLayers = ocean.append("g").attr("id", "oceanLayers");
  oceanPattern = ocean.append("g").attr("id", "oceanPattern");
  lakes = viewbox.append("g").attr("id", "lakes");
  landmass = viewbox.append("g").attr("id", "landmass");
  texture = viewbox.append("g").attr("id", "texture");
  terrs = viewbox.append("g").attr("id", "terrs");
  biomes = viewbox.append("g").attr("id", "biomes");
  cells = viewbox.append("g").attr("id", "cells");
  gridOverlay = viewbox.append("g").attr("id", "gridOverlay");
  coordinates = viewbox.append("g").attr("id", "coordinates");
  compass = viewbox.append("g").attr("id", "compass");
  rivers = viewbox.append("g").attr("id", "rivers");
  terrain = viewbox.append("g").attr("id", "terrain");
  relig = viewbox.append("g").attr("id", "relig");
  cults = viewbox.append("g").attr("id", "cults");
  regions = viewbox.append("g").attr("id", "regions");
  statesBody = regions.append("g").attr("id", "statesBody");
  statesHalo = regions.append("g").attr("id", "statesHalo");
  provs = viewbox.append("g").attr("id", "provs");
  zones = viewbox.append("g").attr("id", "zones").style("display", "none");
  borders = viewbox.append("g").attr("id", "borders");
  stateBorders = borders.append("g").attr("id", "stateBorders");
  provinceBorders = borders.append("g").attr("id", "provinceBorders");
  routes = viewbox.append("g").attr("id", "routes");
  roads = routes.append("g").attr("id", "roads");
  trails = routes.append("g").attr("id", "trails");
  searoutes = routes.append("g").attr("id", "searoutes");
  temperature = viewbox.append("g").attr("id", "temperature");
  coastline = viewbox.append("g").attr("id", "coastline");
  ice = viewbox.append("g").attr("id", "ice").style("display", "none");
  prec = viewbox.append("g").attr("id", "prec").style("display", "none");
  population = viewbox.append("g").attr("id", "population");
  emblems = viewbox.append("g").attr("id", "emblems").style("display", "none");
  labels = viewbox.append("g").attr("id", "labels");
  icons = viewbox.append("g").attr("id", "icons");
  burgIcons = icons.append("g").attr("id", "burgIcons");
  anchors = icons.append("g").attr("id", "anchors");
  armies = viewbox.append("g").attr("id", "armies").style("display", "none");
  markers = viewbox.append("g").attr("id", "markers");
  fogging = viewbox
    .append("g")
    .attr("id", "fogging-cont")
    .attr("mask", "url(#fog)")
    .append("g")
    .attr("id", "fogging")
    .style("display", "none");
  ruler = viewbox.append("g").attr("id", "ruler").style("display", "none");
  debug = viewbox.append("g").attr("id", "debug");

  // lake and coast groups
  lakes.append("g").attr("id", "freshwater");
  lakes.append("g").attr("id", "salt");
  lakes.append("g").attr("id", "sinkhole");
  lakes.append("g").attr("id", "frozen");
  lakes.append("g").attr("id", "lava");
  lakes.append("g").attr("id", "dry");
  coastline.append("g").attr("id", "sea_island");
  coastline.append("g").attr("id", "lake_island");

  labels.append("g").attr("id", "states");
  labels.append("g").attr("id", "addedLabels");

  burgLabels = labels.append("g").attr("id", "burgLabels");
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

  landmass.append("rect").attr("x", 0).attr("y", 0).attr("width", width).attr("height", height);

  oceanPattern
    .append("rect")
    .attr("fill", "url(#oceanic)")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height);

  oceanLayers
    .append("rect")
    .attr("id", "oceanBase")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height);
}
