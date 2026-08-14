// The map layers. Registration order is the z-order, the init order and the draw order.
// Layers are referenced as values: import the layer, never its id.
import { select } from "d3";
import { drawBiomes } from "../draw-biomes";
import { drawBorders } from "../draw-borders";
import { drawBurgIcons } from "../draw-burg-icons";
import { drawCells } from "../draw-cells";
import { drawCoordinates } from "../draw-coordinates";
import { drawCultures } from "../draw-cultures";
import { drawEmblems } from "../draw-emblems";
import { drawFeatures } from "../draw-features";
import { drawGoods } from "../draw-goods";
import { drawGrid } from "../draw-grid";
import { drawHeightmap } from "../draw-heightmap";
import { drawIce } from "../draw-ice";
import { drawMarkers } from "../draw-markers";
import { drawMarkets } from "../draw-markets";
import { drawMeasurers } from "../draw-measurers";
import { drawMilitary } from "../draw-military";
import { drawPopulation } from "../draw-population";
import { drawPrecipitation } from "../draw-precipitation";
import { drawProvinces } from "../draw-provinces";
import { drawRelief, removeRelief } from "../draw-relief-icons";
import { drawReligions } from "../draw-religions";
import { drawRivers } from "../draw-rivers";
import { drawRoutes } from "../draw-routes";
import { drawStates } from "../draw-states";
import { drawTemperature } from "../draw-temperature";
import { drawTexture } from "../draw-texture";
import { drawZones } from "../draw-zones";
import { drawLabels, removeLabels } from "../labels/labels-renderer";
import { tradeAnimation } from "../trade-animation";
import { Layer, Layers } from "./layers";

export const oceanLayer = new Layer({
  id: "ocean",
  element: "ocean",
  parent: "viewbox",
  children: ["oceanLayers", "oceanPattern"],
  alwaysOn: true,
  keepContent: true
});

export const landmassLayer = new Layer({
  id: "landmass",
  element: "landmass",
  parent: "viewbox",
  alwaysOn: true,
  keepContent: true,
  draw: drawFeatures
});

export const textureLayer = new Layer({
  id: "texture",
  element: "texture",
  parent: "viewbox",
  draw: drawTexture
});

export const heightmapLayer = new Layer({
  id: "heightmap",
  element: "terrs",
  parent: "viewbox",
  children: ["oceanHeights", "landHeights"],
  draw: drawHeightmap
});

export const lakesLayer = new Layer({
  id: "lakes",
  element: "lakes",
  parent: "viewbox",
  children: ["freshwater", "salt", "sinkhole", "frozen", "lava", "dry"],
  keepContent: true
});

export const biomesLayer = new Layer({ id: "biomes", element: "biomes", parent: "viewbox", draw: drawBiomes });

export const cellsLayer = new Layer({ id: "cells", element: "cells", parent: "viewbox", draw: drawCells });

export const gridLayer = new Layer({ id: "grid", element: "gridOverlay", parent: "viewbox", draw: drawGrid });

export const coordinatesLayer = new Layer({
  id: "coordinates",
  element: "coordinates",
  parent: "viewbox",
  draw: drawCoordinates
});

export const compassLayer = new Layer({
  id: "compass",
  element: "compass",
  parent: "viewbox",
  keepContent: true
});

export const riversLayer = new Layer({ id: "rivers", element: "rivers", parent: "viewbox", draw: drawRivers });

export const reliefLayer = new Layer({
  id: "relief",
  element: "terrain",
  parent: "viewbox",
  draw: drawRelief,
  erase: removeRelief
});

export const religionsLayer = new Layer({
  id: "religions",
  element: "relig",
  parent: "viewbox",
  draw: drawReligions
});

export const culturesLayer = new Layer({
  id: "cultures",
  element: "cults",
  parent: "viewbox",
  draw: drawCultures
});

export const statesLayer = new Layer({
  id: "states",
  element: "regions",
  parent: "viewbox",
  children: ["statesBody", "statesHalo"],
  draw: drawStates
});

export const provincesLayer = new Layer({
  id: "provinces",
  element: "provs",
  parent: "viewbox",
  draw: drawProvinces
});

export const zonesLayer = new Layer({ id: "zones", element: "zones", parent: "viewbox", draw: drawZones });

export const bordersLayer = new Layer({
  id: "borders",
  element: "borders",
  parent: "viewbox",
  children: ["stateBorders", "provinceBorders"],
  draw: drawBorders
});

export const routesLayer = new Layer({
  id: "routes",
  element: "routes",
  parent: "viewbox",
  children: ["roads", "trails", "searoutes"],
  draw: drawRoutes
});

export const temperatureLayer = new Layer({
  id: "temperature",
  element: "temperature",
  parent: "viewbox",
  draw: drawTemperature
});

export const coastlineLayer = new Layer({
  id: "coastline",
  element: "coastline",
  parent: "viewbox",
  children: ["sea_island", "lake_island"],
  alwaysOn: true,
  keepContent: true
});

export const iceLayer = new Layer({
  id: "ice",
  element: "ice",
  parent: "viewbox",
  keepContent: true,
  draw: layer => {
    if (!layer.getEl().children.length) drawIce();
  }
});

export const goodsLayer = new Layer({
  id: "goods",
  element: "goods",
  parent: "viewbox",
  children: ["goodsCells", "goodsIcons", "goodsBurgs"],
  draw: drawGoods
});

export const marketsLayer = new Layer({ id: "markets", element: "markets", parent: "viewbox", draw: drawMarkets });

export const tradeLayer = new Layer({
  id: "trade",
  element: "tradeAnimation",
  parent: "viewbox",
  keepContent: true,
  draw: () => tradeAnimation.start(),
  erase: () => tradeAnimation.stop()
});

export const precipitationLayer = new Layer({
  id: "precipitation",
  element: "prec",
  parent: "viewbox",
  draw: drawPrecipitation
});

export const populationLayer = new Layer({
  id: "population",
  element: "population",
  parent: "viewbox",
  children: ["rural", "urban"],
  draw: drawPopulation
});

export const emblemsLayer = new Layer({
  id: "emblems",
  element: "emblems",
  parent: "viewbox",
  children: ["burgEmblems", "provinceEmblems", "stateEmblems"],
  keepContent: true,
  draw: layer => {
    if (!layer.getEl().querySelector("use")) drawEmblems();
    invokeActiveZooming();
  }
});

export const burgIconsLayer = new Layer({
  id: "burgIcons",
  element: "icons",
  parent: "viewbox",
  children: ["burgIcons", "anchors"],
  draw: drawBurgIcons
});

export const labelsLayer = new Layer({
  id: "labels",
  element: "labels",
  parent: "viewbox",
  attrs: { "font-size": "100px" },
  draw: drawLabels,
  erase: removeLabels
});

export const militaryLayer = new Layer({ id: "military", element: "armies", parent: "viewbox", draw: drawMilitary });

export const markersLayer = new Layer({ id: "markers", element: "markers", parent: "viewbox", draw: drawMarkers });

export const foggingLayer = new Layer({
  id: "fogging",
  element: "fogging",
  parent: "viewbox",
  attrs: { mask: "url(#fog)" },
  keepContent: true
});

export const rulersLayer = new Layer({ id: "rulers", element: "ruler", parent: "viewbox", draw: drawMeasurers });

export const debugLayer = new Layer({
  id: "debug",
  element: "debug",
  parent: "viewbox",
  alwaysOn: true,
  keepContent: true
});

export const scaleBarLayer = new Layer({
  id: "scaleBar",
  element: "scaleBar",
  parent: "map",
  keepContent: true,
  draw: layer => drawScaleBar(select(layer.getEl()), scale)
});

export const vignetteLayer = new Layer({
  id: "vignette",
  element: "vignette",
  parent: "map",
  attrs: { mask: "url(#vignette-mask)" },
  keepContent: true
});

export const legendLayer = new Layer({
  id: "legend",
  element: "legend",
  parent: "map",
  alwaysOn: true,
  keepContent: true
});

Layers.register(
  oceanLayer,
  landmassLayer,
  textureLayer,
  heightmapLayer,
  lakesLayer,
  biomesLayer,
  cellsLayer,
  gridLayer,
  coordinatesLayer,
  compassLayer,
  riversLayer,
  reliefLayer,
  religionsLayer,
  culturesLayer,
  statesLayer,
  provincesLayer,
  zonesLayer,
  bordersLayer,
  routesLayer,
  temperatureLayer,
  coastlineLayer,
  iceLayer,
  goodsLayer,
  marketsLayer,
  tradeLayer,
  precipitationLayer,
  populationLayer,
  emblemsLayer,
  burgIconsLayer,
  labelsLayer,
  militaryLayer,
  markersLayer,
  foggingLayer,
  rulersLayer,
  debugLayer,
  scaleBarLayer,
  vignetteLayer,
  legendLayer
);
