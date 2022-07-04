// Azgaar (azgaar.fmg@yandex.com). Minsk, 2017-2022. MIT License
// https://github.com/Azgaar/Fantasy-Map-Generator

import "./components";
// @ts-expect-error js-module
import {clearLegend} from "./modules/legend";
// @ts-expect-error js-module
import {Rulers} from "./modules/measurers";
// @ts-expect-error js-module
import {applyStoredOptions} from "./modules/ui/options";
import {addGlobalListeners} from "./scripts/listeners";
import {tip} from "./scripts/tooltips";
import {checkForUpdates} from "./scripts/updater";
import {getInputNumber} from "utils/nodeUtils";

checkForUpdates();
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

populationRate = getInputNumber("populationRateInput");
distanceScale = getInputNumber("distanceScaleInput");
urbanization = getInputNumber("urbanizationInput");
urbanDensity = getInputNumber("urbanDensityInput");
statesNeutral = 1; // statesEditor growth parameter

applyStoredOptions();

rulers = new Rulers();
biomesData = Biomes.getDefault();
nameBases = Names.getNameBases(); // cultures-related data

// voronoi graph extension, cannot be changed after generation
graphWidth = getInputNumber("mapWidthInput");
graphHeight = getInputNumber("mapHeightInput");

// svg canvas resolution, can be changed
svgWidth = graphWidth;
svgHeight = graphHeight;

defineSvg(graphWidth, graphHeight);

scaleBar.on("mousemove", () => tip("Click to open Units Editor")).on("click", () => editUnits());
legend
  .on("mousemove", () => tip("Drag to change the position. Click to hide the legend"))
  .on("click", () => clearLegend());
