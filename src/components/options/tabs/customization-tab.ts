// Heightmap customization tab: tools, options and statistics
import { ensureEl } from "@/utils/nodeUtils";

const TEMPLATE = /* html */ `
  <p>Heightmap customization tools:</p>
  <div id="customizeTools">
    <button data-tip="Display brushes panel" id="paintBrushes">Paint Brushes</button>
    <button data-tip="Open template editor" id="applyTemplate" style="display: none">Template Editor</button>
    <button data-tip="Open Image Converter" id="convertImage" style="display: none">Image Converter</button>
    <button
      data-tip="Save the painted heightmap to a draft file to continue later without generating a map"
      id="saveHeightmapDraft"
      style="display: none"
    >
      Save Draft
    </button>
    <button data-tip="Load a heightmap draft file and continue painting" id="loadHeightmapDraft" style="display: none">
      Load Draft
    </button>
    <button data-tip="Render heightmap data as a small monochrome image" id="heightmapPreview">Preview</button>
    <button data-tip="Preview the heightmap in a 3D scene" id="heightmap3DView">3D scene</button>
  </div>
  <p>Options:</p>
  <div id="customizeOptions">
    <div data-tip="Heightmap edit mode">Edit mode: <span id="heightmapEditMode"></span></div>
    <div data-tip="Render cells below sea level (with a height less than 20)">
      <input id="renderOcean" class="checkbox" type="checkbox" />
      <label for="renderOcean" class="checkbox-label">Render ocean cells</label>
    </div>
    <div
      id="allowErosionBox"
      data-tip="Regenerate rivers and allow water flow to change heights and form new lakes. Recommended"
    >
      <input id="allowErosion" class="checkbox" type="checkbox" checked />
      <label for="allowErosion" class="checkbox-label">Allow water erosion</label>
    </div>
    <div
      data-tip="Maximum number of iterations to fill depressions. Increase if rivers end without reaching a lake or the sea"
    >
      <div>Maximum depression filling iterations:</div>
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
    <div data-tip="Depression depth needed to form a new lake. Increase to reduce the number of generated lakes">
      <div>Depression depth threshold:</div>
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
  <p>Statistics:</p>
  <div>
    <span>Land cells: </span><span id="landmassCounter">0</span>
    <span style="margin-left: 0.9em">Mean height: </span><span id="landmassAverage">0</span>
  </div>
  <p>Cell info:</p>
  <div>
    <span>Coord: </span><span id="heightmapInfoX"></span>/<span id="heightmapInfoY"></span><br />
    <span>Cell: </span><span id="heightmapInfoCell"></span><br />
    <span>Height: </span><span id="heightmapInfoHeight"></span>
  </div>
`;

ensureEl("customizationMenu").innerHTML = TEMPLATE;
