// config-validator.js
// Validation functions for FMG configuration objects

/**
 * Valid heightmap templates
 */
const VALID_TEMPLATES = [
  "continents", "archipelago", "highland", "inland", "lakes",
  "islands", "atoll", "volcano", "crater", "shattered"
];

/**
 * Valid culture sets
 */
const VALID_CULTURE_SETS = [
  "european", "oriental", "english", "antique",
  "highFantasy", "darkFantasy", "random", "all-world"
];

/**
 * Valid emblem shapes
 */
const VALID_EMBLEM_SHAPES = [
  "random", "heater", "spanish", "french", "horsehead", "horsehead2",
  "polish", "hessen", "swiss", "boeotian", "roman", "kite",
  "oldFrench", "renaissance", "baroque", "targe", "targe2",
  "pavise", "wedged", "round", "oval", "square", "diamond",
  "flag", "pennon", "guidon", "banner", "dovetail", "gonfalon",
  "pennant", "fantasy1", "fantasy2", "fantasy3", "fantasy4",
  "fantasy5", "noldor", "gondor", "easterling", "erebor",
  "ironHills", "urukHai", "moriaOrc", "gothic"
];

/**
 * Configuration value ranges
 */
const RANGES = {
  "graph.width": { min: 100, max: 8192 },
  "graph.height": { min: 100, max: 8192 },
  "graph.cellsDesired": { min: 1000, max: 100000 },
  "cultures.culturesInput": { min: 0, max: 99 },
  "burgs.statesNumber": { min: 0, max: 999 },
  "burgs.manorsInput": { min: 0, max: 10000 },
  "religions.religionsNumber": { min: 0, max: 99 },
  "provinces.provincesRatio": { min: 0, max: 100 },
  "lakes.lakeElevationLimit": { min: 0, max: 100 },
  "rivers.resolveDepressionsSteps": { min: 100, max: 10000 },
  "growthRate": { min: 0.1, max: 10 },
  "sizeVariety": { min: 0, max: 5 },
  "temperature.heightExponent": { min: 0.5, max: 5 },
  "zones.globalModifier": { min: 0.1, max: 10 }
};

/**
 * Main validation function
 * @param {Object} config - Configuration object to validate
 * @returns {Object} Validation result with valid flag, errors, and warnings
 */
export function validateConfig(config) {
  const result = {
    valid: true,
    errors: [],
    warnings: []
  };
  
  // Check required properties
  validateRequiredProperties(config, result);
  
  // Validate data types
  validateDataTypes(config, result);
  
  // Validate ranges
  validateRanges(config, result);
  
  // Validate enums
  validateEnums(config, result);
  
  // Validate logical constraints
  validateLogicalConstraints(config, result);
  
  // Validate required fields for modules
  validateRequiredFields(config, result);
  
  // Set valid flag based on errors
  result.valid = result.errors.length === 0;
  
  return result;
}

/**
 * Validate required properties exist
 */
function validateRequiredProperties(config, result) {
  // Required top-level properties
  if (!config.graph) {
    result.errors.push("Missing required property: graph");
  } else {
    if (typeof config.graph.width === 'undefined') {
      result.errors.push("Missing required property: graph.width");
    }
    if (typeof config.graph.height === 'undefined') {
      result.errors.push("Missing required property: graph.height");
    }
  }
  
  if (!config.heightmap) {
    result.errors.push("Missing required property: heightmap");
  } else {
    if (!config.heightmap.templateId && !config.heightmap.template) {
      result.errors.push("Missing required property: heightmap.templateId or heightmap.template");
    }
  }
}

/**
 * Validate data types
 */
function validateDataTypes(config, result) {
  // Check numeric types
  const numericProperties = [
    "graph.width", "graph.height", "graph.cellsDesired",
    "cultures.culturesInput", "cultures.sizeVariety", "cultures.neutralRate",
    "burgs.statesNumber", "burgs.sizeVariety", "burgs.manorsInput",
    "burgs.growthRate", "burgs.statesGrowthRate",
    "religions.religionsNumber", "religions.growthRate",
    "provinces.provincesRatio",
    "lakes.lakeElevationLimit", "lakes.heightExponent",
    "rivers.resolveDepressionsSteps",
    "temperature.heightExponent", "temperature.temperatureBase",
    "zones.globalModifier"
  ];
  
  numericProperties.forEach(path => {
    const value = getNestedProperty(config, path);
    if (value !== undefined && (typeof value !== 'number' || isNaN(value))) {
      result.errors.push(`${path} must be a valid number, got: ${typeof value}`);
    }
  });
  
  // Check string types
  const stringProperties = [
    "seed", "heightmap.templateId", "heightmap.template",
    "cultures.culturesSet", "cultures.emblemShape",
    "oceanLayers.outline", "temperature.temperatureScale"
  ];
  
  stringProperties.forEach(path => {
    const value = getNestedProperty(config, path);
    if (value !== undefined && typeof value !== 'string') {
      result.errors.push(`${path} must be a string, got: ${typeof value}`);
    }
  });
  
  // Check boolean types
  const booleanProperties = [
    "debug.TIME", "debug.WARN", "debug.INFO", "debug.ERROR"
  ];
  
  booleanProperties.forEach(path => {
    const value = getNestedProperty(config, path);
    if (value !== undefined && typeof value !== 'boolean') {
      result.errors.push(`${path} must be a boolean, got: ${typeof value}`);
    }
  });
}

/**
 * Validate value ranges
 */
function validateRanges(config, result) {
  Object.keys(RANGES).forEach(path => {
    const value = getNestedProperty(config, path);
    if (value !== undefined && typeof value === 'number') {
      const range = RANGES[path];
      if (value < range.min || value > range.max) {
        result.errors.push(
          `${path} must be between ${range.min} and ${range.max}, got: ${value}`
        );
      }
    }
  });
  
  // Special case for growth rates
  const growthRates = [
    "burgs.growthRate", "burgs.statesGrowthRate", "religions.growthRate"
  ];
  
  growthRates.forEach(path => {
    const value = getNestedProperty(config, path);
    if (value !== undefined && typeof value === 'number') {
      if (value < 0.1 || value > 10) {
        result.warnings.push(
          `${path} is outside recommended range (0.1-10): ${value}`
        );
      }
    }
  });
}

/**
 * Validate enum values
 */
function validateEnums(config, result) {
  // Validate heightmap template
  const template = config.heightmap?.templateId || config.heightmap?.template;
  if (template && !VALID_TEMPLATES.includes(template)) {
    result.warnings.push(
      `Unknown heightmap template: ${template}. Valid options: ${VALID_TEMPLATES.join(", ")}`
    );
  }
  
  // Validate culture set
  if (config.cultures?.culturesSet && !VALID_CULTURE_SETS.includes(config.cultures.culturesSet)) {
    result.warnings.push(
      `Unknown culture set: ${config.cultures.culturesSet}. Valid options: ${VALID_CULTURE_SETS.join(", ")}`
    );
  }
  
  // Validate emblem shape
  if (config.cultures?.emblemShape && 
      config.cultures.emblemShape !== "random" &&
      !VALID_EMBLEM_SHAPES.includes(config.cultures.emblemShape)) {
    result.warnings.push(
      `Unknown emblem shape: ${config.cultures.emblemShape}`
    );
  }
  
  // Validate temperature scale
  if (config.temperature?.temperatureScale && 
      !["C", "F"].includes(config.temperature.temperatureScale)) {
    result.errors.push(
      `Temperature scale must be "C" or "F", got: ${config.temperature.temperatureScale}`
    );
  }
  
  // Validate ocean outline
  if (config.oceanLayers?.outline) {
    const outline = config.oceanLayers.outline;
    if (outline !== "none" && outline !== "random") {
      // Check if it's a valid comma-separated list of numbers
      const parts = outline.split(",");
      const valid = parts.every(part => {
        const num = parseInt(part.trim());
        return !isNaN(num) && num <= 0;
      });
      if (!valid) {
        result.errors.push(
          `Ocean outline must be "none", "random", or comma-separated negative numbers, got: ${outline}`
        );
      }
    }
  }
}

/**
 * Validate logical constraints between properties
 */
function validateLogicalConstraints(config, result) {
  // Check that cultures input doesn't exceed max for set
  if (config.cultures?.culturesInput && config.cultures?.culturesInSetNumber) {
    if (config.cultures.culturesInput > config.cultures.culturesInSetNumber) {
      result.warnings.push(
        `culturesInput (${config.cultures.culturesInput}) exceeds max for culture set (${config.cultures.culturesInSetNumber})`
      );
    }
  }
  
  // Check that states number is reasonable relative to cells
  if (config.burgs?.statesNumber && config.graph?.cellsDesired) {
    const ratio = config.burgs.statesNumber / config.graph.cellsDesired;
    if (ratio > 0.05) {
      result.warnings.push(
        `High states to cells ratio (${ratio.toFixed(3)}). Consider reducing states number or increasing cells.`
      );
    }
  }
  
  // Check manorsInput auto-calculate value
  if (config.burgs?.manorsInput === 1000) {
    result.warnings.push(
      "manorsInput set to 1000 (auto-calculate mode)"
    );
  }
  
  // Check map dimensions aspect ratio
  if (config.graph?.width && config.graph?.height) {
    const aspectRatio = config.graph.width / config.graph.height;
    if (aspectRatio < 0.5 || aspectRatio > 3) {
      result.warnings.push(
        `Unusual aspect ratio (${aspectRatio.toFixed(2)}). Standard ratios are between 0.5 and 3.`
      );
    }
  }
  
  // Check cells desired vs map size
  if (config.graph?.cellsDesired && config.graph?.width && config.graph?.height) {
    const area = config.graph.width * config.graph.height;
    const cellDensity = config.graph.cellsDesired / area;
    if (cellDensity < 0.001) {
      result.warnings.push(
        "Very low cell density. Consider increasing cellsDesired for better detail."
      );
    } else if (cellDensity > 0.1) {
      result.warnings.push(
        "Very high cell density. This may impact performance."
      );
    }
  }
}

/**
 * Validate required fields for modules
 */
function validateRequiredFields(config, result) {
  const requiredFields = {
    'cultures.culturesInSetNumber': (config) => {
      // Ensure this field exists based on culturesSet
      const maxCultures = getCultureSetMax(config.cultures.culturesSet);
      return maxCultures;
    },
    'rivers.cellsCount': (config) => {
      // Ensure this matches the actual cell count
      return config.graph.cellsDesired || 10000;
    }
  };

  // Check each required field
  Object.keys(requiredFields).forEach(fieldPath => {
    const value = getNestedProperty(config, fieldPath);
    if (value === undefined) {
      const defaultValue = requiredFields[fieldPath](config);
      result.warnings.push(`Missing field ${fieldPath}, would default to ${defaultValue}`);
    }
  });
}

/**
 * Get maximum cultures for a culture set
 */
function getCultureSetMax(culturesSet) {
  const sets = {
    european: 25,
    oriental: 20,
    english: 15,
    antique: 18,
    highFantasy: 30,
    darkFantasy: 25,
    random: 50,
    'all-world': 100
  };
  return sets[culturesSet] || 25;
}

/**
 * Helper function to get nested property value
 */
function getNestedProperty(obj, path) {
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  
  return current;
}

/**
 * Sanitize configuration object
 * Removes invalid values and applies defaults
 * @param {Object} config - Configuration object to sanitize
 * @returns {Object} Sanitized configuration
 */
export function sanitizeConfig(config) {
  const sanitized = JSON.parse(JSON.stringify(config)); // Deep clone
  
  // Apply defaults for missing required properties
  if (!sanitized.graph) sanitized.graph = {};
  if (!sanitized.graph.width) sanitized.graph.width = 1920;
  if (!sanitized.graph.height) sanitized.graph.height = 1080;
  if (!sanitized.graph.cellsDesired) sanitized.graph.cellsDesired = 10000;
  
  if (!sanitized.heightmap) sanitized.heightmap = {};
  if (!sanitized.heightmap.templateId && !sanitized.heightmap.template) {
    sanitized.heightmap.templateId = "continents";
  }
  
  // Ensure all number values are valid
  function sanitizeNumbers(obj, path = '') {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const fullPath = path ? `${path}.${key}` : key;
        
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeNumbers(obj[key], fullPath);
        } else if (typeof obj[key] === 'number' && isNaN(obj[key])) {
          // Replace NaN with default
          const range = RANGES[fullPath];
          obj[key] = range ? range.min : 0;
        }
      }
    }
  }
  
  sanitizeNumbers(sanitized);
  
  // Clamp values to valid ranges
  Object.keys(RANGES).forEach(path => {
    const value = getNestedProperty(sanitized, path);
    if (value !== undefined && typeof value === 'number') {
      const range = RANGES[path];
      const parts = path.split('.');
      let current = sanitized;
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      
      current[parts[parts.length - 1]] = Math.max(range.min, Math.min(range.max, value));
    }
  });
  
  return sanitized;
}

/**
 * Validate and fix configuration
 * @param {Object} config - Configuration to validate and fix
 * @returns {Object} Object with fixed config and validation result
 */
export function validateAndFix(config) {
  const validationResult = validateConfig(config);
  
  if (!validationResult.valid) {
    const fixed = sanitizeConfig(config);
    const revalidation = validateConfig(fixed);
    
    return {
      original: config,
      fixed: fixed,
      originalValidation: validationResult,
      fixedValidation: revalidation,
      wasFixed: true
    };
  }
  
  return {
    original: config,
    fixed: config,
    originalValidation: validationResult,
    fixedValidation: validationResult,
    wasFixed: false
  };
}

/**
 * Get a human-readable validation report
 * @param {Object} validationResult - Result from validateConfig
 * @returns {string} Formatted validation report
 */
export function getValidationReport(validationResult) {
  let report = [];
  
  if (validationResult.valid) {
    report.push("✓ Configuration is valid");
  } else {
    report.push("✗ Configuration has errors");
  }
  
  if (validationResult.errors.length > 0) {
    report.push("\nErrors:");
    validationResult.errors.forEach(error => {
      report.push(`  • ${error}`);
    });
  }
  
  if (validationResult.warnings.length > 0) {
    report.push("\nWarnings:");
    validationResult.warnings.forEach(warning => {
      report.push(`  • ${warning}`);
    });
  }
  
  return report.join("\n");
}