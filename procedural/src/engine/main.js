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
import * as voronoi from "./modules/voronoi.js";
import * as Utils from "./utils/index.js";
import * as graphUtils from "./utils/graphUtils.js"

// Import the new utility modules
import * as Graph from "./utils/graph.js";
import * as Geography from "./utils/geography.js";
import * as Cell from "./utils/cell.js";

/**
 * The main entry point for the headless map generation engine.
 * @param {object} config - A comprehensive configuration object.
 * @returns {object} An object containing the complete generated map data { grid, pack, notes, etc. }.
 */
export async function generate(config) {
    const timeStart = performance.now();

    // CORRECT: Get debug flags (values) from the config object.
    const { TIME, WARN, INFO } = config.debug;

    // CORRECT: Call utility functions directly from the Utils object.
    const seed = config.seed || Utils.generateSeed();
    Math.random = Utils.aleaPRNG(seed);

    // This now works, because INFO is a boolean from config.debug
    INFO && console.group("Generating Map with Seed: " + seed);


    // 2. Pass the entire config to generateGrid (it needs graph and debug sections)
    let grid = graphUtils.generateGrid(config);

    // --- Heightmap and Features (assumed to be already modular) ---
    grid.cells.h = await Heightmap.generate(grid, config, Utils);
    grid = Features.markupGrid(grid, config, Utils);

    // 3. Pass 'map' and 'lakes' configs to the new geography utilities
    const { mapCoordinates } = Geography.defineMapSize(grid, config, Utils);
    grid = Geography.addLakesInDeepDepressions(grid, config.lakes, Utils);
    grid = Geography.openNearSeaLakes(grid, config.lakes, Utils);

    // 4. Pass specific config sections for temperature and precipitation
    const { temp } = Geography.calculateTemperatures(grid, mapCoordinates, config.temperature, Utils);
    grid.cells.temp = temp;
    const { prec } = Geography.generatePrecipitation(grid, mapCoordinates, config.precipitation, Utils);
    grid.cells.prec = prec;

    // --- Pack Generation ---
    let pack = Graph.reGraph(grid, Utils);
    pack = Features.markupPack(pack, grid, config, Utils, { Lakes });

    // --- River Generation ---
    const riverResult = Rivers.generate(pack, grid, config, Utils, { Lakes, Names });
    pack = riverResult.pack;

    // --- Biome and Population ---
    const { biome } = Biomes.define(pack, grid, config, Utils);
    pack.cells.biome = biome;

    // 5. Call the new cell ranking utility
    const { s, pop } = Cell.rankCells(pack, grid, config, Utils, { biomesData: Biomes.getDefault() });
    pack.cells.s = s;
    pack.cells.pop = pop;

    // 6. Cultures, States, and Burgs
    const culturesResult = Cultures.generate(pack, grid, config, Utils, { Names });
    let packWithCultures = { ...pack, cultures: culturesResult.cultures };
    packWithCultures.cells.culture = culturesResult.culture;

    const expandedCulturesData = Cultures.expand(packWithCultures, config.cultures, Utils, { biomesData: Biomes.getDefault() });
    pack = { ...packWithCultures, ...expandedCulturesData }; // Assumes expand returns an object with updated pack properties

    const burgsAndStatesResult = BurgsAndStates.generate(pack, grid, config.burgs, Utils);
    pack = {
      ...pack,
      burgs: burgsAndStatesResult.burgs,
      states: burgsAndStatesResult.states
    };
    pack.cells.burg = burgsAndStatesResult.burg;
    pack.cells.state = burgsAndStatesResult.state;

    const routesResult = Routes.generate(pack, grid, Utils, []);
    pack = { ...pack, ...routesResult }; // Merge new routes data

    const religionsResult = Religions.generate(pack, grid, config.religions, Utils);
    pack = { ...pack, ...religionsResult }; // Merge new religions data

    const stateFormsResult = BurgsAndStates.defineStateForms(undefined, pack, Utils);
    pack = { ...pack, ...stateFormsResult }; // Merge updated state forms

    const provincesResult = Provinces.generate(pack, config.provinces, Utils);
    pack = { ...pack, ...provincesResult }; // Merge new provinces data

    const burgFeaturesResult = BurgsAndStates.defineBurgFeatures(undefined, pack, Utils);
    pack = { ...pack, ...burgFeaturesResult }; // Merge updated burg features

    const specifiedRiversResult = Rivers.specify(pack, { Names }, Utils);
    pack = { ...pack, ...specifiedRiversResult }; // Merge specified river data

    const specifiedFeaturesResult = Features.specify(pack, grid, { Lakes });
    pack = { ...pack, ...specifiedFeaturesResult }; // Merge specified feature data

    // Initialize notes array for modules that require it
    const notes = [];

    const militaryResult = Military.generate(pack, config.military, Utils, notes);
    pack = { ...pack, ...militaryResult }; // Merge new military data

    const markersResult = Markers.generateMarkers(pack, config.markers, Utils);
    pack = { ...pack, ...markersResult }; // Merge new markers data

    const zonesResult = Zones.generate(pack, notes, Utils, config.zones);
    pack = { ...pack, ...zonesResult }; // Merge new zones data


  WARN && console.warn(`TOTAL GENERATION TIME: ${Utils.rn((performance.now() - timeStart) / 1000, 2)}s`);
  INFO && console.groupEnd("Generated Map " + seed);

  // Return all the generated data
  return { seed, grid, pack, mapCoordinates };
}
