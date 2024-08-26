// Azgaar (azgaar.fmg@yandex.com). Minsk, 2017-2022. MIT License
// https://github.com/Azgaar/Fantasy-Map-Generator

import "./components";
// @ts-expect-error js-module
import {defineSvg} from "./modules/define-svg";
// @ts-expect-error js-module
import {clearLegend} from "./modules/legend";
// @ts-expect-error js-module
import {Rulers} from "./modules/measurers";
// @ts-expect-error js-module
import {applyStoredOptions} from "./modules/ui/options";
import {addGlobalListeners} from "./scripts/listeners";
import {checkForUpdates} from "./scripts/updater";
import {getInputNumber} from "utils/nodeUtils";
import {defaultNameBases} from "config/namebases";

// default options
options = {
  pinNotes: false,
  showMFCGMap: true,
  winds: [225, 45, 225, 315, 135, 315],
  stateLabelsMode: "auto",
  year: 0,
};

checkForUpdates();
applyStoredOptions();

populationRate = getInputNumber("populationRateInput");
distanceScale = getInputNumber("distanceScaleInput");
urbanization = getInputNumber("urbanizationInput");
urbanDensity = getInputNumber("urbanDensityInput");
statesNeutral = 1; // statesEditor growth parameter

rulers = new Rulers();
biomesData = window.Biomes.getDefault();
nameBases = [...defaultNameBases];

// voronoi graph extension, cannot be changed after generation
graphWidth = getInputNumber("mapWidthInput");
graphHeight = getInputNumber("mapHeightInput");

// svg canvas resolution, can be changed
svgWidth = graphWidth;
svgHeight = graphHeight;

defineSvg(graphWidth, graphHeight);
addGlobalListeners();
