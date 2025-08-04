// config-presets.js
// Predefined configuration presets for common map generation scenarios

/**
 * Default balanced configuration
 * Suitable for most use cases with moderate complexity
 */
export const defaultConfig = {
  seed: undefined, // Auto-generate
  
  graph: {
    width: 1920,
    height: 1080,
    cellsDesired: 10000,
    boundary: "box"
  },
  
  map: {
    coordinatesSize: 1,
    latitude: 0
  },
  
  heightmap: {
    templateId: "continents",
    template: "continents"
  },
  
  temperature: {
    heightExponent: 1.8,
    temperatureScale: "C",
    temperatureBase: 25
  },
  
  precipitation: {
    moisture: 1
  },
  
  features: {},
  biomes: {},
  
  lakes: {
    lakeElevationLimit: 50,
    heightExponent: 2
  },
  
  rivers: {
    resolveDepressionsSteps: 1000
  },
  
  oceanLayers: {
    outline: "-1,-2,-3"
  },
  
  cultures: {
    culturesInput: 12,
    culturesInSetNumber: 15,
    culturesSet: "european",
    sizeVariety: 1,
    neutralRate: 1,
    emblemShape: "random",
    emblemShapeGroup: "Diversiform"
  },
  
  burgs: {
    statesNumber: 15,
    sizeVariety: 1,
    manorsInput: 1000,
    growthRate: 1,
    statesGrowthRate: 1
  },
  
  religions: {
    religionsNumber: 5,
    growthRate: 1
  },
  
  provinces: {
    provincesRatio: 50
  },
  
  military: {
    year: 1400,
    eraShort: "AD",
    era: "Anno Domini"
  },
  
  markers: {
    culturesSet: "european"
  },
  
  zones: {
    globalModifier: 1
  },
  
  debug: {
    TIME: false,
    WARN: true,
    INFO: false,
    ERROR: true
  }
};

/**
 * Continents configuration
 * Large landmasses with expansive territories
 */
export const continentsConfig = {
  ...defaultConfig,
  
  graph: {
    width: 2560,
    height: 1440,
    cellsDesired: 20000,
    boundary: "box"
  },
  
  heightmap: {
    templateId: "continents",
    template: "continents"
  },
  
  temperature: {
    heightExponent: 2,
    temperatureScale: "C",
    temperatureBase: 22
  },
  
  lakes: {
    lakeElevationLimit: 45,
    heightExponent: 2.2
  },
  
  rivers: {
    resolveDepressionsSteps: 1500
  },
  
  cultures: {
    culturesInput: 18,
    culturesInSetNumber: 20,
    culturesSet: "all-world",
    sizeVariety: 1.5,
    neutralRate: 0.8,
    emblemShape: "random",
    emblemShapeGroup: "Diversiform"
  },
  
  burgs: {
    statesNumber: 20,
    sizeVariety: 1.2,
    manorsInput: 1000,
    growthRate: 1.1,
    statesGrowthRate: 1.1
  },
  
  religions: {
    religionsNumber: 8,
    growthRate: 1.2
  },
  
  provinces: {
    provincesRatio: 60
  }
};

/**
 * Archipelago configuration
 * Island chains and maritime cultures
 */
export const archipelagoConfig = {
  ...defaultConfig,
  
  graph: {
    width: 1920,
    height: 1080,
    cellsDesired: 15000,
    boundary: "box"
  },
  
  heightmap: {
    templateId: "archipelago",
    template: "archipelago"
  },
  
  temperature: {
    heightExponent: 1.5,
    temperatureScale: "C",
    temperatureBase: 28
  },
  
  lakes: {
    lakeElevationLimit: 60,
    heightExponent: 1.8
  },
  
  rivers: {
    resolveDepressionsSteps: 800
  },
  
  oceanLayers: {
    outline: "-1,-2,-3,-4"
  },
  
  cultures: {
    culturesInput: 16,
    culturesInSetNumber: 20,
    culturesSet: "oriental",
    sizeVariety: 2,
    neutralRate: 0.6,
    emblemShape: "round",
    emblemShapeGroup: "Basic"
  },
  
  burgs: {
    statesNumber: 25,
    sizeVariety: 2,
    manorsInput: 1000,
    growthRate: 0.8,
    statesGrowthRate: 0.7
  },
  
  religions: {
    religionsNumber: 10,
    growthRate: 0.6
  },
  
  provinces: {
    provincesRatio: 40
  },
  
  markers: {
    culturesSet: "oriental"
  }
};

/**
 * High Fantasy configuration
 * Many diverse cultures, magical elements, varied terrain
 */
export const fantasyConfig = {
  ...defaultConfig,
  
  graph: {
    width: 2048,
    height: 2048,
    cellsDesired: 25000,
    boundary: "box"
  },
  
  heightmap: {
    templateId: "highland",
    template: "highland"
  },
  
  temperature: {
    heightExponent: 1.6,
    temperatureScale: "C",
    temperatureBase: 20
  },
  
  lakes: {
    lakeElevationLimit: 55,
    heightExponent: 2.5
  },
  
  rivers: {
    resolveDepressionsSteps: 2000
  },
  
  oceanLayers: {
    outline: "random"
  },
  
  cultures: {
    culturesInput: 25,
    culturesInSetNumber: 30,
    culturesSet: "highFantasy",
    sizeVariety: 3,
    neutralRate: 1.2,
    emblemShape: "fantasy1",
    emblemShapeGroup: "Fantasy"
  },
  
  burgs: {
    statesNumber: 30,
    sizeVariety: 2.5,
    manorsInput: 1000,
    growthRate: 1.5,
    statesGrowthRate: 1.3
  },
  
  religions: {
    religionsNumber: 15,
    growthRate: 1.8
  },
  
  provinces: {
    provincesRatio: 70
  },
  
  military: {
    year: 1000,
    eraShort: "Age",
    era: "Third Age"
  },
  
  markers: {
    culturesSet: "highFantasy"
  },
  
  zones: {
    globalModifier: 1.5
  }
};

/**
 * Realistic Earth-like configuration
 * Natural terrain distribution, realistic cultures
 */
export const realisticConfig = {
  ...defaultConfig,
  
  graph: {
    width: 1920,
    height: 1080,
    cellsDesired: 12000,
    boundary: "box"
  },
  
  heightmap: {
    templateId: "continents",
    template: "continents"
  },
  
  temperature: {
    heightExponent: 2.1,
    temperatureScale: "C",
    temperatureBase: 15
  },
  
  precipitation: {
    moisture: 0.9
  },
  
  lakes: {
    lakeElevationLimit: 48,
    heightExponent: 2.3
  },
  
  rivers: {
    resolveDepressionsSteps: 1200
  },
  
  oceanLayers: {
    outline: "-1,-2,-3"
  },
  
  cultures: {
    culturesInput: 8,
    culturesInSetNumber: 12,
    culturesSet: "european",
    sizeVariety: 0.8,
    neutralRate: 0.9,
    emblemShape: "heater",
    emblemShapeGroup: "Basic"
  },
  
  burgs: {
    statesNumber: 10,
    sizeVariety: 0.7,
    manorsInput: 1000,
    growthRate: 0.8,
    statesGrowthRate: 0.8
  },
  
  religions: {
    religionsNumber: 3,
    growthRate: 0.7
  },
  
  provinces: {
    provincesRatio: 45
  },
  
  military: {
    year: 1450,
    eraShort: "AD",
    era: "Anno Domini"
  },
  
  markers: {
    culturesSet: "european"
  },
  
  zones: {
    globalModifier: 0.8
  }
};

/**
 * Island Nations configuration
 * Small isolated islands with unique cultures
 */
export const islandNationsConfig = {
  ...defaultConfig,
  
  graph: {
    width: 1920,
    height: 1080,
    cellsDesired: 8000,
    boundary: "box"
  },
  
  heightmap: {
    templateId: "islands",
    template: "islands"
  },
  
  temperature: {
    heightExponent: 1.4,
    temperatureScale: "C",
    temperatureBase: 26
  },
  
  lakes: {
    lakeElevationLimit: 65,
    heightExponent: 1.5
  },
  
  rivers: {
    resolveDepressionsSteps: 600
  },
  
  oceanLayers: {
    outline: "-1,-2"
  },
  
  cultures: {
    culturesInput: 20,
    culturesInSetNumber: 25,
    culturesSet: "oriental",
    sizeVariety: 2.5,
    neutralRate: 0.5,
    emblemShape: "oval",
    emblemShapeGroup: "Basic"
  },
  
  burgs: {
    statesNumber: 30,
    sizeVariety: 3,
    manorsInput: 1000,
    growthRate: 0.6,
    statesGrowthRate: 0.5
  },
  
  religions: {
    religionsNumber: 12,
    growthRate: 0.5
  },
  
  provinces: {
    provincesRatio: 35
  },
  
  zones: {
    globalModifier: 0.7
  }
};

/**
 * Ancient World configuration
 * Classical antiquity setting
 */
export const ancientWorldConfig = {
  ...defaultConfig,
  
  graph: {
    width: 1920,
    height: 1080,
    cellsDesired: 10000,
    boundary: "box"
  },
  
  heightmap: {
    templateId: "inland",
    template: "inland"
  },
  
  temperature: {
    heightExponent: 1.9,
    temperatureScale: "C",
    temperatureBase: 24
  },
  
  lakes: {
    lakeElevationLimit: 52,
    heightExponent: 2.1
  },
  
  rivers: {
    resolveDepressionsSteps: 1100
  },
  
  cultures: {
    culturesInput: 10,
    culturesInSetNumber: 12,
    culturesSet: "antique",
    sizeVariety: 1.1,
    neutralRate: 1,
    emblemShape: "roman",
    emblemShapeGroup: "Historical"
  },
  
  burgs: {
    statesNumber: 12,
    sizeVariety: 1.3,
    manorsInput: 1000,
    growthRate: 0.9,
    statesGrowthRate: 0.9
  },
  
  religions: {
    religionsNumber: 6,
    growthRate: 0.8
  },
  
  provinces: {
    provincesRatio: 55
  },
  
  military: {
    year: 100,
    eraShort: "AD",
    era: "Anno Domini"
  },
  
  markers: {
    culturesSet: "antique"
  }
};

/**
 * Dark Fantasy configuration
 * Grim, dangerous world with hostile territories
 */
export const darkFantasyConfig = {
  ...defaultConfig,
  
  graph: {
    width: 1920,
    height: 1080,
    cellsDesired: 15000,
    boundary: "box"
  },
  
  heightmap: {
    templateId: "highland",
    template: "highland"
  },
  
  temperature: {
    heightExponent: 2.2,
    temperatureScale: "C",
    temperatureBase: 12
  },
  
  precipitation: {
    moisture: 0.7
  },
  
  lakes: {
    lakeElevationLimit: 40,
    heightExponent: 2.8
  },
  
  rivers: {
    resolveDepressionsSteps: 1800
  },
  
  oceanLayers: {
    outline: "-1,-2,-3,-4,-5"
  },
  
  cultures: {
    culturesInput: 15,
    culturesInSetNumber: 20,
    culturesSet: "darkFantasy",
    sizeVariety: 2,
    neutralRate: 1.5,
    emblemShape: "gothic",
    emblemShapeGroup: "Fantasy"
  },
  
  burgs: {
    statesNumber: 18,
    sizeVariety: 1.8,
    manorsInput: 1000,
    growthRate: 0.7,
    statesGrowthRate: 0.6
  },
  
  religions: {
    religionsNumber: 8,
    growthRate: 1.4
  },
  
  provinces: {
    provincesRatio: 65
  },
  
  military: {
    year: 666,
    eraShort: "DR",
    era: "Dark Reckoning"
  },
  
  markers: {
    culturesSet: "darkFantasy"
  },
  
  zones: {
    globalModifier: 2
  }
};

/**
 * Get a preset by name
 * @param {string} name - Name of the preset
 * @returns {Object|null} Preset configuration or null if not found
 */
export function getPreset(name) {
  const presets = {
    default: defaultConfig,
    continents: continentsConfig,
    archipelago: archipelagoConfig,
    fantasy: fantasyConfig,
    realistic: realisticConfig,
    islandNations: islandNationsConfig,
    ancientWorld: ancientWorldConfig,
    darkFantasy: darkFantasyConfig
  };
  
  return presets[name] || null;
}

/**
 * Get all available preset names
 * @returns {string[]} Array of preset names
 */
export function getPresetNames() {
  return [
    "default",
    "continents",
    "archipelago",
    "fantasy",
    "realistic",
    "islandNations",
    "ancientWorld",
    "darkFantasy"
  ];
}

/**
 * Get preset descriptions
 * @returns {Object} Object mapping preset names to descriptions
 */
export function getPresetDescriptions() {
  return {
    default: "Balanced configuration suitable for most use cases",
    continents: "Large landmasses with expansive territories",
    archipelago: "Island chains and maritime cultures",
    fantasy: "High fantasy with many diverse cultures and magical elements",
    realistic: "Earth-like terrain with realistic culture distribution",
    islandNations: "Small isolated islands with unique cultures",
    ancientWorld: "Classical antiquity setting with ancient civilizations",
    darkFantasy: "Grim, dangerous world with hostile territories"
  };
}