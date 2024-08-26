import {TIME} from "config/logging";
import {drawBiomes} from "./drawBiomes";
import {drawBorders} from "./drawBorders";
import {drawBurgs} from "./drawBurgs";
import {drawCells} from "./drawCells";
import {drawCoordinates} from "./drawCoordinates.js"; //MARKER: drawCoordinates.js
import {drawCultures} from "./drawCultures";
import {drawEmblems} from "./drawEmblems.js"; //MARKER: drawEmblems.js
import {drawFeatures} from "./drawFeatures";
import {drawGrid} from "./drawGrid.js"; //MARKER: drawGrid.js
import {drawHeightmap} from "./drawHeightmap.js";
import {drawIce} from "./drawIce.js"; //MARKER: drawIce.js
import {drawLabels} from "./drawLabels";
import {drawMarkers} from "./drawMarkers.js"; //MARKER: drawMarkers.js
import {drawPopulation} from "./drawPopulation.js"; //MARKER: drawPopulation.js
import {drawPrecipitation} from "./drawPrecipitation.js"; //MARKER: drawPrecipitation.js
import {drawProvinces} from "./drawProvinces";
import {drawReligions} from "./drawReligions";
import {drawRivers} from "./drawRivers";
import {drawRoutes} from "./drawRoutes";
import {drawStates} from "./drawStates";
import {drawTemperature} from "./drawTemperature.js"; //MARKER: drawTemperature.js

// Note: missed renderers are in toggle functions
const layerRenderersMap = {
  biomes: drawBiomes,
  borders: drawBorders,
  burgs: drawBurgs,
  cells: drawCells,
  coordinates: drawCoordinates,
  cultures: drawCultures,
  emblems: drawEmblems,
  features: drawFeatures,
  grid: drawGrid,
  heightmap: drawHeightmap,
  ice: drawIce,
  labels: drawLabels,
  markers: drawMarkers,
  population: drawPopulation,
  precipitation: drawPrecipitation,
  provinces: drawProvinces,
  religions: drawReligions,
  rivers: drawRivers,
  routes: drawRoutes,
  states: drawStates,
  temperature: drawTemperature
};

// export function renderLayer(layerName: keyof typeof layerRenderersMap, ...args: any[]) {
export function renderLayer(layerName: keyof typeof layerRenderersMap) {
  const renderer = layerRenderersMap[layerName];
  TIME && console.time(renderer.name);
  // renderer(...args); MARKER: for now we are not passing any arguments
  renderer();
  TIME && console.timeEnd(renderer.name);
}
