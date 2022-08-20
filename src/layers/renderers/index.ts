import {TIME} from "config/logging";
import {drawBiomes} from "./drawBiomes";
import {drawBorders} from "./drawBorders";
import {drawBurgs} from "./drawBurgs";
import {drawCells} from "./drawCells";
import {drawCoordinates} from "./drawCoordinates";
import {drawCultures} from "./drawCultures";
import {drawEmblems} from "./drawEmblems";
import {drawFeatures} from "./drawFeatures";
import {drawGrid} from "./drawGrid";
import {drawHeightmap} from "./drawHeightmap";
import {drawIce} from "./drawIce";
import {drawLabels} from "./drawLabels";
import {drawMarkers} from "./drawMarkers";
import {drawPopulation} from "./drawPopulation";
import {drawPrecipitation} from "./drawPrecipitation";
import {drawProvinces} from "./drawProvinces";
import {drawReligions} from "./drawReligions";
import {drawRivers} from "./drawRivers";
import {drawRoutes} from "./drawRoutes";
import {drawStates} from "./drawStates";
import {drawTemperature} from "./drawTemperature";

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

export function renderLayer(layerName: keyof typeof layerRenderersMap, ...args: any[]) {
  const renderer = layerRenderersMap[layerName];
  TIME && console.time(renderer.name);
  renderer(...args);
  TIME && console.timeEnd(renderer.name);
}
