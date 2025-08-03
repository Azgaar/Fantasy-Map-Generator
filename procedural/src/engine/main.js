// src/engine/main.js

// Import all the refactored engine modules
import * as Biomes from "./modules/biomes.js";
import * as BurgsAndStates from "./modules/burgs-and-states.js";
import * as COA from "./modules/coa-generator.js";
import * as COArenderer from "./modules/coa-renderer.js";
import * as Cultures from "./modules/cultures-generator.js";
import * as Features from "./modules/features.js";
import * as Heightmap from "./modules/heightmap-generator.js";
import * as Lakes from "./modules/lakes.js";
import * as Markers from "./modules/markers-generator.js";
import * as Military from "./modules/military-generator.js";
import * as Names from "./modules/names-generator.js";
import * as Provinces from "./modules/provinces-generator.js";
import * as Religions from "./modules/religions-generator.js";
import * as Rivers from "./modules/river-generator.js";
import * as Routes from "./modules/routes-generator.js";
import * as Zones from "./modules/zones-generator.js";
import { Voronoi } from "./modules/voronoi.js";
import * as Utils from "./utils/index.js";

// Import the new utility modules
import * as Graph from "./utils/graphUtils.js";
import * as Geography from "./utils/geography.js";
import * as Cell from "./utils/cell.js";

/**
 * The main entry point for the headless map generation engine.
 * @param {object} config - A comprehensive configuration object.
 * @returns {object} An object containing the complete generated map data { grid, pack, notes, etc. }.
 */
export function generate(config) {
  const timeStart = performance.now();
  const { TIME, WARN, INFO, ERROR } = Utils; // Core logging utils

  // Set up PRNG
  const seed = config.seed || Utils.generateSeed();
  Math.random = Utils.aleaPRNG(seed);
  INFO && console.group("Generating Map with Seed: " + seed);

  // --- Grid Generation ---
  let grid = Graph.generateGrid(config.graph);
  grid.cells.h = Heightmap.generate(grid, config.heightmap, Utils);
  grid = Features.markupGrid(grid, config, Utils);
  const { mapCoordinates } = Geography.defineMapSize(grid, config.map);
  grid = Geography.addLakesInDeepDepressions(grid, config.lakes, Utils);
  grid = Geography.openNearSeaLakes(grid, config.lakes, Utils);

  // --- Core Data Calculation ---
  const { temp } = Geography.calculateTemperatures(grid, mapCoordinates, config.temperature, Utils);
  grid.cells.temp = temp;
  const { prec } = Geography.generatePrecipitation(grid, mapCoordinates, config.precipitation, Utils);
  grid.cells.prec = prec;

  // --- Pack Generation ---
  let pack = Graph.reGraph(grid, Utils);
  pack = Features.markupPack(pack, config, Utils, { Lakes });
  
  // --- River Generation ---
  const riverGenerationResult = Rivers.generate(pack, grid, config.rivers, Utils, { Lakes, Names });
  pack = riverGenerationResult.pack;

  // --- Biome and Population ---
  const { biome } = Biomes.define(pack, grid, config.biomes, Utils);
  pack.cells.biome = biome;
  const { s, pop } = Cell.rankCells(pack, grid, Utils, { biomesData: Biomes.getDefault() });
  pack.cells.s = s;
  pack.cells.pop = pop;

  // --- Cultures, States, and Burgs ---
  const culturesResult = Cultures.generate(pack, grid, config.cultures, Utils, { Names });
  pack.cultures = culturesResult.cultures;
  pack.cells.culture = culturesResult.culture;
  Cultures.expand(pack, config.cultures, Utils, { biomesData: Biomes.getDefault() });
  
  const burgsAndStatesResult = BurgsAndStates.generate(pack, grid, config.burgs, Utils, { Names, COA, getPolesOfInaccessibility: Utils.getPolesOfInaccessibility });
  pack.burgs = burgsAndStatesResult.burgs;
  pack.states = burgsAndStatesResult.states;
  pack.cells.burg = burgsAndStatesResult.cells.burg;
  pack.cells.state = burgsAndStatesResult.cells.state;

  // --- Final Touches ---
  // Routes.generate(pack, Utils);
  // Religions.generate(pack, config.religions, Utils, { Names, BurgsAndStates });
  // BurgsAndStates.defineStateForms(null, pack, Utils, { Names });
  // Provinces.generate(pack, config.provinces, Utils, { BurgsAndStates, Names, COA });
  // BurgsAndStates.defineBurgFeatures(null, pack, Utils);
  // Rivers.specify(pack, Utils, { Names });
  // Features.specify(pack, grid, Utils, { Lakes });
  // Military.generate(pack, config.military, Utils, { Names });
  // Markers.generate(pack, config.markers, Utils);
  // Zones.generate(pack, config.zones, Utils);

  WARN && console.warn(`TOTAL GENERATION TIME: ${Utils.rn((performance.now() - timeStart) / 1000, 2)}s`);
  INFO && console.groupEnd("Generated Map " + seed);
  
  // Return all the generated data
  return { seed, grid, pack, mapCoordinates };
}