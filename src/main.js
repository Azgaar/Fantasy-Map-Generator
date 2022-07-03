// Azgaar (azgaar.fmg@yandex.com). Minsk, 2017-2022. MIT License
// https://github.com/Azgaar/Fantasy-Map-Generator

import "./components";
import {clearLegend} from "./modules/legend";
import {Rulers} from "./modules/measurers";
import {applyStoredOptions} from "./modules/ui/options";
import {addGlobalListeners} from "./scripts/listeners";
import {tip} from "./scripts/tooltips";
import {byId} from "./utils/shorthands";

addGlobalListeners();

window.fmg = {
  modules: {}
};

// default options
options = {
  pinNotes: false,
  showMFCGMap: true,
  winds: [225, 45, 225, 315, 135, 315],
  stateLabelsMode: "auto"
};

populationRate = +byId("populationRateInput").value;
distanceScale = +byId("distanceScaleInput").value;
urbanization = +byId("urbanizationInput").value;
urbanDensity = +byId("urbanDensityInput").value;
statesNeutral = 1; // statesEditor growth parameter

applyStoredOptions();

rulers = new Rulers();
biomesData = Biomes.getDefault();
nameBases = Names.getNameBases(); // cultures-related data

// voronoi graph extension, cannot be changed after generation
graphWidth = +byId("mapWidthInput").value;
graphHeight = +byId("mapHeightInput").value;

// svg canvas resolution, can be changed
svgWidth = graphWidth;
svgHeight = graphHeight;

defineSvg(graphWidth, graphHeight);

scaleBar.on("mousemove", () => tip("Click to open Units Editor")).on("click", () => editUnits());
legend
  .on("mousemove", () => tip("Drag to change the position. Click to hide the legend"))
  .on("click", () => clearLegend());
