// Heightmap customization tab: tools, options and statistics

import { t } from "@/utils/i18n";
import { ensureEl } from "@/utils/nodeUtils";

const TEMPLATE = /* html */ `
  <p>${t("Heightmap customization tools")}:</p>
  <div id="customizeTools">
    <button data-tip="${t("Display brushes panel")}" id="paintBrushes">${t("Paint Brushes")}</button>
    <button data-tip="${t("Template Editor")}" id="applyTemplate" style="display: none">${t("Template Editor")}</button>
    <button data-tip="${t("Image Converter")}" id="convertImage" style="display: none">${t("Image Converter")}</button>
    <button data-tip="${t("Render heightmap data as a small monochrome image")}" id="heightmapPreview">${t("Preview")}</button>
    <button data-tip="${t("Preview the heightmap in a 3D scene")}" id="heightmap3DView">${t("3D scene")}</button>
  </div>
  <p>${t("Options")}:</p>
  <div id="customizeOptions">
    <div data-tip="${t("Heightmap edit mode")}">${t("Edit mode")}: <span id="heightmapEditMode"></span></div>
    <div data-tip="${t("Render cells below sea level (with a height less than 20)")}">
      <input id="renderOcean" class="checkbox" type="checkbox" />
      <label for="renderOcean" class="checkbox-label">${t("Render ocean cells")}</label>
    </div>
    <div data-tip="${t("Show where water flows: arrows point downhill, hatching marks depressions that get filled, blue hatching marks the ones deep enough to become lakes")}">
      <input id="showDrainage" class="checkbox" type="checkbox" />
      <label for="showDrainage" class="checkbox-label">${t("Show drainage")}</label>
    </div>
    <div
      id="allowErosionBox"
      data-tip="${t("Regenerate rivers and allow water flow to change heights and form new lakes. Recommended")}"
    >
      <input id="allowErosion" class="checkbox" type="checkbox" />
      <label for="allowErosion" class="checkbox-label">${t("Allow water erosion")}</label>
    </div>
    <div
      data-tip="${t("Maximum number of iterations to fill depressions. Increase if rivers end without reaching a lake or the sea")}"
    >
      <div>${t("Maximum depression filling iterations")}:</div>
      <input
        id="resolveDepressionsStepsInput"
        data-option="resolveDepressionsSteps"
        type="range"
        min="0"
        max="500"
        value="250"
      />
      <input
        id="resolveDepressionsStepsOutput"
        data-option="resolveDepressionsSteps"
        type="number"
        min="0"
        max="1000"
        value="250"
      />
    </div>
    <div data-tip="${t("Depression depth needed to form a new lake. Increase to reduce the number of generated lakes")}">
      <div>${t("Depression depth threshold")}:</div>
      <input
        id="lakeElevationLimitInput"
        data-option="lakeElevationLimit"
        type="range"
        min="0"
        max="80"
        value="20"
      />
      <input
        id="lakeElevationLimitOutput"
        data-option="lakeElevationLimit"
        type="number"
        min="0"
        max="80"
        value="20"
      />
    </div>
  </div>
  <p>${t("Statistics")}:</p>
  <div>
    <span>${t("Land cells")}: </span><span id="landmassCounter">0</span>
    <span style="margin-left: 0.9em">${t("Mean height")}: </span><span id="landmassAverage">0</span>
  </div>
  <p>${t("Cell info")}:</p>
  <div>
    <span>${t("Coord")}: </span><span id="heightmapInfoX"></span>/<span id="heightmapInfoY"></span><br />
    <span>${t("Cell")}: </span><span id="heightmapInfoCell"></span><br />
    <span>${t("Height")}: </span><span id="heightmapInfoHeight"></span>
  </div>
`;

ensureEl("customizationMenu").innerHTML = TEMPLATE;
