// config-builder.js
// Builds configuration objects PURELY from the UI state for the FMG engine.

/**
 * Main function to build a complete configuration object from the current UI state.
 * @returns {Object} Complete configuration object for the FMG engine.
 */
export function buildConfigFromUI() {
  const config = {
    seed: getSeed(),
    graph: buildGraphConfig(),
    map: buildMapConfig(),
    heightmap: buildHeightmapConfig(),
    temperature: buildTemperatureConfig(),
    precipitation: buildPrecipitationConfig(),
    features: {}, // No UI config
    biomes: {},   // No UI config
    lakes: buildLakesConfig(),
    rivers: buildRiversConfig(),
    oceanLayers: buildOceanLayersConfig(),
    cultures: buildCulturesConfig(),
    burgs: buildBurgsConfig(),
    religions: buildReligionsConfig(),
    provinces: buildProvincesConfig(),
    military: buildMilitaryConfig(),
    markers: buildMarkersConfig(),
    zones: buildZonesConfig(),
    debug: buildDebugConfig()
  };

  return config;
}

// --- Helper Functions ---

function byId(id) {
  return document.getElementById(id);
}

function getNumericValue(id, defaultValue = 0) {
  const element = byId(id);
  // Ensure the element exists before trying to read its value
  if (!element || element.value === "") return defaultValue;

  const value = element.valueAsNumber || +element.value;
  return isNaN(value) ? defaultValue : value;
}

function getStringValue(id, defaultValue = "") {
  const element = byId(id);
  return element ? element.value : defaultValue;
}

function getCheckboxValue(id, defaultValue = false) {
    const element = byId(id);
    return element ? element.checked : defaultValue;
}

// --- Section Builders ---

function getSeed() {
  const seedValue = getStringValue("seed");
  // Generate a new seed only if the input is empty
  return seedValue || Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function buildGraphConfig() {
  // REMOVED: Fallback to global `graphWidth` and `graphHeight`.
  // The builder must only read from the DOM as the single source of truth.
  return {
    width: getNumericValue("mapWidth", 1920),
    height: getNumericValue("mapHeight", 1080),
    cellsDesired: getNumericValue("pointsInput", 10000)
    // NOTE: 'cellsNumber' and 'points' are often outputs of the generation, not inputs.
    // They are omitted here to avoid confusion. The engine will calculate them.
  };
}

function buildMapConfig() {
  return {
    coordinatesSize: getNumericValue("coordinatesSize", 1),
    latitude: getNumericValue("latitude", 0)
  };
}

function buildHeightmapConfig() {
  return {
    templateId: getStringValue("templateInput", "continents")
    // NOTE: `template` property was redundant with `templateId`. Removed for clarity.
  };
}

function buildTemperatureConfig() {
  return {
    heightExponent: getNumericValue("heightExponentInput", 1.8),
    temperatureScale: getStringValue("temperatureScale", "C"),
    temperatureBase: getNumericValue("temperatureBase", 25)
  };
}

function buildPrecipitationConfig() {
  // REMOVED: Fallback to global `windPatterns`. This should be handled by presets
  // or a more advanced UI control in the future. For now, it defaults to empty.
  return {
    winds: [],
    moisture: getNumericValue("moisture", 1)
  };
}

function buildLakesConfig() {
  // Assuming a different input for lake's height exponent if needed,
  // otherwise, it correctly re-uses the temperature one.
  return {
    lakeElevationLimit: getNumericValue("lakeElevationLimitOutput", 50),
    heightExponent: getNumericValue("heightExponentInput", 2)
  };
}

function buildRiversConfig() {
  const pointsInput = byId("pointsInput");
  const cellsCount = pointsInput ? getNumericValue("pointsInput", 10000) : 10000;

  return {
    resolveDepressionsSteps: getNumericValue("resolveDepressionsStepsOutput", 1000),
    cellsCount: cellsCount
  };
}

function buildOceanLayersConfig() {
  const oceanLayersEl = byId("oceanLayers");
  // Reading from a data attribute is fine if that's how your UI is structured.
  const outline = oceanLayersEl ? oceanLayersEl.getAttribute("layers") : "-1,-2,-3";

  return { outline: outline || "-1,-2,-3" };
}

function buildCulturesConfig() {
  const culturesSetEl = byId("culturesSet");
  const emblemShapeEl = byId("emblemShape");

  let culturesInSetNumber = 15;
  if (culturesSetEl?.selectedOptions[0]) {
    culturesInSetNumber = +culturesSetEl.selectedOptions[0].dataset.max || 15;
  }

  let emblemShapeGroup = "Diversiform";
  if (emblemShapeEl?.selectedOptions[0]?.parentNode?.label) {
    emblemShapeGroup = emblemShapeEl.selectedOptions[0].parentNode.label;
  }

  return {
    culturesInput: getNumericValue("culturesInput", 12),
    culturesInSetNumber: culturesInSetNumber,
    culturesSet: getStringValue("culturesSet", "european"),
    sizeVariety: getNumericValue("sizeVariety", 1),
    neutralRate: getNumericValue("neutralRate", 1),
    emblemShape: getStringValue("emblemShape", "random"),
    emblemShapeGroup: emblemShapeGroup
  };
}

function buildBurgsConfig() {
  return {
    statesNumber: getNumericValue("statesNumber", 15),
    sizeVariety: getNumericValue("sizeVariety", 1),
    manorsInput: getNumericValue("manorsInput", 1000),
    growthRate: getNumericValue("growthRate", 1),
    statesGrowthRate: getNumericValue("statesGrowthRate", 1)
  };
}

function buildReligionsConfig() {
  return {
    religionsNumber: getNumericValue("religionsNumber", 5),
    growthRate: getNumericValue("growthRate", 1)
  };
}

function buildProvincesConfig() {
  return {
    provincesRatio: getNumericValue("provincesRatio", 50)
  };
}

function buildMilitaryConfig() {
  // REMOVED: Fallback to global `options` object.
  // All military settings should be read from their own UI elements.
  return {
    // military: [], // This would need a dedicated UI to build
    year: getNumericValue("yearInput", 1400),
    eraShort: getStringValue("eraShortInput", "AD"),
    era: getStringValue("eraInput", "Anno Domini")
  };
}

function buildMarkersConfig() {
  return {
    culturesSet: getStringValue("culturesSet", "european")
  };
}

function buildZonesConfig() {
  return {
    globalModifier: getNumericValue("zonesGlobalModifier", 1)
  };
}

function buildDebugConfig() {
  // REMOVED: Fallback to global TIME, WARN, INFO flags.
  // These should be controlled by UI elements, like checkboxes.
  return {
    TIME: getCheckboxValue("debugTime", false),
    WARN: getCheckboxValue("debugWarn", true),
    INFO: getCheckboxValue("debugInfo", false),
    ERROR: getCheckboxValue("debugError", true)
  };
}

// NOTE: The preset, JSON, and UI application functions below are well-structured
// and do not need changes. They correctly support the new architecture.

/* ... (buildConfigFromPreset, buildConfigFromJSON, saveConfigToJSON, deepMerge, applyConfigToUI) ... */

/**
 * Build configuration from a preset object, merging with UI values
 * @param {Object} preset - Preset configuration to use as base
 * @returns {Object} Complete configuration object
 */
export function buildConfigFromPreset(preset) {
  const uiConfig = buildConfigFromUI();
  return deepMerge(preset, uiConfig);
}

/**
 * Build configuration from JSON string
 * @param {string} jsonString - JSON string containing configuration
 * @returns {Object} Parsed configuration object
 */
export function buildConfigFromJSON(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Failed to parse configuration JSON:", error);
    return null;
  }
}

/**
 * Save configuration to JSON string
 * @param {Object} config - Configuration object to serialize
 * @returns {string} JSON string representation
 */
export function saveConfigToJSON(config) {
  return JSON.stringify(config, null, 2);
}

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object to merge
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}

/**
 * Apply configuration to UI elements
 * @param {Object} config - Configuration object to apply to UI
 */
export function applyConfigToUI(config) {
  // Core parameters
  if (config.seed && byId("seed")) {
    byId("seed").value = config.seed;
  }

  // Graph configuration
  if (config.graph) {
    if (config.graph.width && byId("mapWidth")) byId("mapWidth").value = config.graph.width;
    if (config.graph.height && byId("mapHeight")) byId("mapHeight").value = config.graph.height;
    if (config.graph.cellsDesired && byId("pointsInput")) byId("pointsInput").value = config.graph.cellsDesired;
  }

  // Heightmap configuration
  if (config.heightmap && config.heightmap.templateId && byId("templateInput")) {
    byId("templateInput").value = config.heightmap.templateId;
  }

  // Temperature configuration
  if (config.temperature) {
    if (config.temperature.heightExponent && byId("heightExponentInput")) {
      byId("heightExponentInput").value = config.temperature.heightExponent;
    }
    if (config.temperature.temperatureScale && byId("temperatureScale")) {
      byId("temperatureScale").value = config.temperature.temperatureScale;
    }
  }

  // Lakes configuration
  if (config.lakes) {
    if (config.lakes.lakeElevationLimit && byId("lakeElevationLimitOutput")) {
      byId("lakeElevationLimitOutput").value = config.lakes.lakeElevationLimit;
    }
  }

  // Rivers configuration
  if (config.rivers) {
    if (config.rivers.resolveDepressionsSteps && byId("resolveDepressionsStepsOutput")) {
      byId("resolveDepressionsStepsOutput").value = config.rivers.resolveDepressionsSteps;
    }
  }

  // Cultures configuration
  if (config.cultures) {
    if (config.cultures.culturesInput && byId("culturesInput")) {
      byId("culturesInput").value = config.cultures.culturesInput;
    }
    if (config.cultures.culturesSet && byId("culturesSet")) {
      byId("culturesSet").value = config.cultures.culturesSet;
    }
    if (config.cultures.sizeVariety && byId("sizeVariety")) {
      byId("sizeVariety").value = config.cultures.sizeVariety;
    }
    if (config.cultures.emblemShape && byId("emblemShape")) {
      byId("emblemShape").value = config.cultures.emblemShape;
    }
  }

  // Burgs and States configuration
  if (config.burgs) {
    if (config.burgs.statesNumber && byId("statesNumber")) {
      byId("statesNumber").value = config.burgs.statesNumber;
    }
    if (config.burgs.manorsInput && byId("manorsInput")) {
      byId("manorsInput").value = config.burgs.manorsInput;
    }
    if (config.burgs.growthRate && byId("growthRate")) {
      byId("growthRate").value = config.burgs.growthRate;
    }
  }

  // Religions configuration
  if (config.religions) {
    if (config.religions.religionsNumber && byId("religionsNumber")) {
      byId("religionsNumber").value = config.religions.religionsNumber;
    }
  }

  // Provinces configuration
  if (config.provinces) {
    if (config.provinces.provincesRatio && byId("provincesRatio")) {
      byId("provincesRatio").value = config.provinces.provincesRatio;
    }
  }

  // Update any UI labels or displays
  updateUILabels();
}

/**
 * Update UI labels to reflect current values
 */
function updateUILabels() {
  // Update any output labels that show current values
  const outputs = document.querySelectorAll("output");
  outputs.forEach(output => {
    const forId = output.getAttribute("for");
    if (forId) {
      const input = byId(forId);
      if (input) {
        output.value = input.value;
      }
    }
  });
}
