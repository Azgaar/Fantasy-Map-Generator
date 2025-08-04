// cli.js
import { generate } from './src/engine/main.js';
import { getPreset } from './src/viewer/config-presets.js';
import { validateConfig, sanitizeConfig } from './src/viewer/config-validator.js';
import fs from 'fs';

// Load config from file
function loadConfig(filepath) {
  const jsonString = fs.readFileSync(filepath, 'utf8');
  return JSON.parse(jsonString);
}

// Generate from CLI
async function generateFromCLI(options) {
  let config;

  if (options.preset) {
    config = getPreset(options.preset);
  } else if (options.config) {
    config = loadConfig(options.config);
  } else {
    config = getPreset('default');
  }

  // Override with CLI arguments
  if (options.seed) config.seed = options.seed;
  if (options.width) config.graph.width = parseInt(options.width);
  if (options.height) config.graph.height = parseInt(options.height);

  // Validate and fix
  const validation = validateConfig(config);
  if (!validation.valid) {
    console.warn('Config validation warnings:', validation.warnings);
    config = sanitizeConfig(config);
  }

  // Generate
  const mapData = generate(config);

  // Save output
  fs.writeFileSync(options.output || 'map.json', JSON.stringify(mapData));
}
