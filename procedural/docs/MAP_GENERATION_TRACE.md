# Exhaustive Step-by-Step Trace of Fantasy Map Generator Execution Flow

## Starting Point: "Generate Map" Button Click

**File**: `/home/user/Fantasy-Map-Generator/procedural/index.html`
- **Line 262**: `<button id="newMapButton" class="primary">🗺️ Generate Map</button>`
- **Line 263**: `<button id="generateButton" class="primary">Generate (Alt)</button>`

## Phase 1: Event Handler Registration and Initialization

**File**: `/home/user/Fantasy-Map-Generator/procedural/src/viewer/main.js`

### Step 1: DOM Content Loaded
- **Line 210**: `window.addEventListener('DOMContentLoaded', () => { ... })`
- **Data Created**: DOM content loaded event listener
- **Function Called**: Anonymous function for initialization

### Step 2: Button Event Handler Registration
- **Lines 222-225**: Button event handler registration
```javascript
const generateBtn = byId("newMapButton") || byId("generateButton");
if (generateBtn) {
    generateBtn.addEventListener("click", handleGenerateClick);
}
```
- **Data Created**: Event listener for click event
- **Function Called**: `handleGenerateClick` when clicked

## Phase 2: Configuration Building and Validation

**File**: `/home/user/Fantasy-Map-Generator/procedural/src/viewer/main.js`

### Step 3: Generate Click Handler Starts
- **Line 32**: `async function handleGenerateClick()` starts execution
- **Function Called**: `handleGenerateClick()`

### Step 4: Build Configuration from UI
- **Line 36**: `const config = buildConfigFromUI();`
- **File**: `/home/user/Fantasy-Map-Generator/procedural/src/viewer/config-builder.js`
- **Function Called**: `buildConfigFromUI()` (Line 8)
- **Data Created**: Complete configuration object with sections:

### Step 5: Configuration Object Structure Created
- **Lines 9-31** in config-builder.js: Configuration object structure created
```javascript
const config = {
  seed: getSeed(),                      // Line 61: Gets seed from UI or generates new one
  graph: buildGraphConfig(),            // Line 67: { width, height, cellsDesired }
  map: buildMapConfig(),               // Line 79: { coordinatesSize, latitude }
  heightmap: buildHeightmapConfig(),   // Line 86: { templateId }
  temperature: buildTemperatureConfig(), // Line 93: { heightExponent, temperatureScale, temperatureBase }
  precipitation: buildPrecipitationConfig(), // Line 101: { winds, moisture }
  features: {},
  biomes: {},
  lakes: buildLakesConfig(),           // Line 110: { lakeElevationLimit, heightExponent }
  rivers: buildRiversConfig(),         // Line 119: { resolveDepressionsSteps, cellsCount }
  oceanLayers: buildOceanLayersConfig(), // Line 129: { outline }
  cultures: buildCulturesConfig(),     // Line 137: { culturesInput, culturesSet, emblemShape, etc. }
  burgs: buildBurgsConfig(),          // Line 162: { statesNumber, manorsInput, growthRate, etc. }
  religions: buildReligionsConfig(),   // Line 178: { religionsNumber, growthRate }
  provinces: buildProvincesConfig(),   // Line 185: { provincesRatio }
  military: buildMilitaryConfig(),     // Line 192: { year, eraShort, era }
  markers: buildMarkersConfig(),       // Line 196: { culturesSet }
  zones: buildZonesConfig(),          // Line 202: { globalModifier }
  debug: buildDebugConfig()           // Line 208: { TIME, WARN, INFO, ERROR }
};
```

### Step 6: Configuration Validation
- **Line 39** in main.js: `const { fixed, originalValidation, fixedValidation, wasFixed } = validateAndFix(config);`
- **File**: `/home/user/Fantasy-Map-Generator/procedural/src/viewer/config-validator.js`
- **Function Called**: `validateAndFix(config)`
- **Data Created**: Validation results and fixed configuration

### Step 7: Validation Logging
- **Lines 42-60** in main.js: Validation logging and error handling
- **Objects Received**: `originalValidation`, `fixedValidation`, `wasFixed` boolean
- **Expected**: Validation objects with `errors`, `warnings`, `valid` properties

### Step 8: Save Configuration to LocalStorage
- **Line 64**: `localStorage.setItem('fmg-last-config', saveConfigToJSON(fixed));`
- **Function Called**: `saveConfigToJSON(fixed)` from config-builder.js
- **Data Created**: JSON string representation of configuration stored in localStorage

## Phase 3: Engine Generation Call

**File**: `/home/user/Fantasy-Map-Generator/procedural/src/viewer/main.js`

### Step 9: Call Engine Generate Function
- **Line 70**: `const mapData = await generateMapEngine(fixed);`
- **File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/main.js`
- **Function Called**: `generate(config)` (imported as `generateMapEngine`, Line 33)
- **Data Passed**: Validated and fixed configuration object

## Phase 4: Engine Initialization

**File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/main.js`

### Step 10: Start Performance Timer
- **Line 34**: `const timeStart = performance.now();`
- **Data Created**: Timestamp for performance measurement

### Step 11: Extract Debug Flags
- **Line 37**: `const { TIME, WARN, INFO } = config.debug;`
- **Data Extracted**: Debug flags from configuration

### Step 12: Seed Initialization
- **Line 40**: `const seed = config.seed || Utils.generateSeed();`
- **Function Called**: `Utils.generateSeed()` if no seed provided
- **Data Created**: Final seed value for generation

### Step 13: Initialize Seeded Random Number Generator
- **Line 41**: `Math.random = Utils.aleaPRNG(seed);`
- **Function Called**: `Utils.aleaPRNG(seed)` from `/home/user/Fantasy-Map-Generator/procedural/src/engine/utils/alea.js`
- **Data Modified**: Global Math.random function replaced with seeded PRNG

### Step 14: Console Group Start
- **Line 44**: `INFO && console.group("Generating Map with Seed: " + seed);`
- **Action**: Console group started if INFO debug flag is true

## Phase 5: Grid Generation

**File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/main.js`

### Step 15: Generate Initial Grid
- **Line 48**: `let grid = Graph.generateGrid(config.graph);`
- **File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/utils/graph.js`
- **Function Called**: `generateGrid(config)` (Line 13)
- **Data Passed**: `config.graph` object containing `{ width, height, cellsDesired }`
- **Data Created**: Initial grid object

### Step 16: Grid Generation Process
- **Lines 15-17** in graph.js: Grid generation process
```javascript
const { spacing, cellsDesired, boundary, points, cellsX, cellsY } = placePoints(config);
const { cells, vertices } = calculateVoronoi(points, boundary);
return { spacing, cellsDesired, boundary, points, cellsX, cellsY, cells, vertices };
```
- **Functions Called**: `placePoints(config)` (Line 21), `calculateVoronoi(points, boundary)` (Line 34)
- **Data Created**: Voronoi diagram with cells and vertices

### Step 17: Point Placement
- **Lines 21-31** in graph.js: Point placement
- **Function Called**: `getBoundaryPoints()`, `getJitteredGrid()`
- **Data Created**: Array of points for Voronoi calculation
- **Objects Created**: `{ spacing, cellsDesired, boundary, points, cellsX, cellsY }`

### Step 18: Voronoi Calculation
- **Lines 34-50** in graph.js: Voronoi calculation
- **External Library**: Delaunator for Delaunay triangulation
- **Function Called**: `new Voronoi(delaunay, allPoints, points.length)`
- **Data Created**: `cells` and `vertices` objects with neighbor relationships

## Phase 6: Heightmap Generation

**File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/main.js`

### Step 19: Generate Heightmap
- **Line 51**: `grid.cells.h = await Heightmap.generate(grid, config, Utils);`
- **File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/modules/heightmap-generator.js`
- **Function Called**: `generate(graph, config, utils)` (Line 3)
- **Data Passed**: `grid` object, `config` object, `Utils` module
- **Data Created**: Height values array assigned to `grid.cells.h`

### Step 20: Heightmap Processing
- **Lines 3-18** in heightmap-generator.js: Heightmap generation
- **Data Extracted**: `templateId` from `config.heightmap`
- **Function Called**: `fromTemplate(graph, templateId, config, utils)` (Line 32)
- **Data Created**: Heights array for all grid cells

### Step 21: Template Processing
- **Lines 32-48** in heightmap-generator.js: Template processing
- **Data Accessed**: `heightmapTemplates[id].template` string
- **Function Called**: `setGraph(graph, utils)`, `addStep()` for each template step
- **Data Created**: Final heights array with template-based terrain

## Phase 7: Features Markup

**File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/main.js`

### Step 22: Markup Grid Features
- **Line 52**: `grid = Features.markupGrid(grid, config, Utils);`
- **File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/modules/features.js`
- **Function Called**: `markupGrid(grid, config, utils)` (Line 28)
- **Data Passed**: Grid with heights, config, utils
- **Data Modified**: Grid object enhanced with feature information

### Step 23: Grid Markup Process
- **Lines 28-50** in features.js: Grid markup process
- **Data Created**: `distanceField` (Int8Array), `featureIds` (Uint16Array), `features` array
- **Algorithm**: Flood-fill to identify connected land/water regions
- **Data Added to Grid**: Distance fields and feature classifications

## Phase 8: Geography and Climate

**File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/main.js`

### Step 24: Define Map Size
- **Line 55**: `const { mapCoordinates } = Geography.defineMapSize(grid, config, Utils);`
- **File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/utils/geography.js`
- **Function Called**: `defineMapSize(grid, config, Utils)`
- **Data Created**: `mapCoordinates` object with geographic bounds

### Step 25: Add Lakes in Deep Depressions
- **Line 56**: `grid = Geography.addLakesInDeepDepressions(grid, config.lakes, Utils);`
- **Function Called**: `addLakesInDeepDepressions(grid, config.lakes, Utils)`
- **Data Modified**: Grid enhanced with lake information

### Step 26: Open Near-Sea Lakes
- **Line 57**: `grid = Geography.openNearSeaLakes(grid, config.lakes, Utils);`
- **Function Called**: `openNearSeaLakes(grid, config.lakes, Utils)`
- **Data Modified**: Lake connectivity to ocean processed

### Step 27: Calculate Temperatures
- **Line 60**: `const { temp } = Geography.calculateTemperatures(grid, mapCoordinates, config.temperature, Utils);`
- **Function Called**: `calculateTemperatures()`
- **Data Created**: Temperature array for all cells
- **Line 61**: `grid.cells.temp = temp;` - Temperature data assigned to grid

### Step 28: Generate Precipitation
- **Line 62**: `const { prec } = Geography.generatePrecipitation(grid, mapCoordinates, config.precipitation, Utils);`
- **Function Called**: `generatePrecipitation()`
- **Data Created**: Precipitation array for all cells
- **Line 63**: `grid.cells.prec = prec;` - Precipitation data assigned to grid

## Phase 9: Pack Generation (Refined Mesh)

**File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/main.js`

### Step 29: Generate Refined Mesh (Pack)
- **Line 66**: `let pack = Graph.reGraph(grid, Utils);`
- **File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/utils/graph.js`
- **Function Called**: `reGraph(grid, Utils)`
- **Data Created**: Refined mesh (`pack`) with higher resolution than grid
- **Purpose**: Creates detailed mesh for final map features

### Step 30: Markup Pack Features
- **Line 67**: `pack = Features.markupPack(pack, grid, config, Utils, { Lakes });`
- **Function Called**: `Features.markupPack()`
- **Data Passed**: Pack mesh, original grid, config, utils, Lakes module
- **Data Modified**: Pack enhanced with feature information

## Phase 10: River Generation

**File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/main.js`

### Step 31: Generate Rivers
- **Line 70**: `const riverResult = Rivers.generate(pack, grid, config.rivers, Utils, { Lakes, Names });`
- **File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/modules/river-generator.js`
- **Function Called**: `generate(pack, grid, config.rivers, Utils, { Lakes, Names })`
- **Data Passed**: Pack mesh, grid, river config, utilities, Lakes and Names modules
- **Data Created**: River system data

### Step 32: Update Pack with Rivers
- **Line 71**: `pack = riverResult.pack;`
- **Data Modified**: Pack object updated with river information

## Phase 11: Biome Assignment

**File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/main.js`

### Step 33: Define Biomes
- **Line 74**: `const { biome } = Biomes.define(pack, grid, config.biomes, Utils);`
- **File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/modules/biomes.js`
- **Function Called**: `define(pack, grid, config.biomes, Utils)`
- **Data Created**: Biome classifications for each cell

### Step 34: Assign Biomes to Pack
- **Line 75**: `pack.cells.biome = biome;`
- **Data Modified**: Biome data assigned to pack cells

## Phase 12: Cell Ranking and Population

**File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/main.js`

### Step 35: Rank Cells
- **Line 78**: `const { s, pop } = Cell.rankCells(pack, Utils, { biomesData: Biomes.getDefault() });`
- **File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/utils/cell.js`
- **Function Called**: `rankCells(pack, Utils, { biomesData })`
- **Data Passed**: Pack, utilities, default biomes data
- **Data Created**: Cell suitability rankings (`s`) and population values (`pop`)

### Step 36: Assign Cell Rankings
- **Lines 79-80**: Cell data assignment
```javascript
pack.cells.s = s;
pack.cells.pop = pop;
```

## Phase 13: Culture Generation

**File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/main.js`

### Step 37: Generate Cultures
- **Line 83**: `const culturesResult = Cultures.generate(pack, grid, config.cultures, Utils, { Names });`
- **File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/modules/cultures-generator.js`
- **Function Called**: `generate(pack, grid, config.cultures, Utils, { Names })`
- **Data Created**: Cultures data and culture assignments

### Step 38: Integrate Culture Data
- **Lines 84-85**: Culture data integration
```javascript
let packWithCultures = { ...pack, cultures: culturesResult.cultures };
packWithCultures.cells.culture = culturesResult.culture;
```

### Step 39: Expand Cultures
- **Line 87**: `const expandedCulturesData = Cultures.expand(packWithCultures, config.cultures, Utils, { biomesData: Biomes.getDefault() });`
- **Function Called**: `Cultures.expand()`
- **Data Created**: Expanded culture territories

### Step 40: Update Pack with Expanded Cultures
- **Line 88**: `pack = { ...packWithCultures, ...expandedCulturesData };`
- **Data Modified**: Pack updated with expanded culture data

## Phase 14: Burgs and States Generation

**File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/main.js`

### Step 41: Generate Burgs and States
- **Line 90**: `const burgsAndStatesResult = BurgsAndStates.generate(pack, grid, config.burgs, Utils);`
- **File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/modules/burgs-and-states.js`
- **Function Called**: `generate(pack, grid, config.burgs, Utils)`
- **Data Created**: Settlements (burgs) and political entities (states)

### Step 42: Integrate Burgs and States Data
- **Lines 91-97**: Burgs and states data integration
```javascript
pack = {
  ...pack,
  burgs: burgsAndStatesResult.burgs,
  states: burgsAndStatesResult.states
};
pack.cells.burg = burgsAndStatesResult.burg;
pack.cells.state = burgsAndStatesResult.state;
```

## Phase 15: Additional Features Generation

**File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/main.js`

### Step 43: Generate Routes
- **Line 99**: `const routesResult = Routes.generate(pack, grid, Utils, []);`
- **File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/modules/routes-generator.js`
- **Function Called**: `generate(pack, grid, Utils, [])`
- **Data Created**: Trade and travel routes

### Step 44: Generate Religions
- **Line 102**: `const religionsResult = Religions.generate(pack, grid, config.religions, Utils);`
- **File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/modules/religions-generator.js`
- **Function Called**: `generate(pack, grid, config.religions, Utils)`
- **Data Created**: Religious systems and distributions

### Step 45: Define State Forms
- **Line 105**: `const stateFormsResult = BurgsAndStates.defineStateForms(undefined, pack, Utils);`
- **Function Called**: `BurgsAndStates.defineStateForms()`
- **Data Created**: Government forms for states

### Step 46: Generate Provinces
- **Line 108**: `const provincesResult = Provinces.generate(pack, config.provinces, Utils);`
- **File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/modules/provinces-generator.js`
- **Function Called**: `generate(pack, config.provinces, Utils)`
- **Data Created**: Provincial subdivisions

### Step 47: Define Burg Features
- **Line 111**: `const burgFeaturesResult = BurgsAndStates.defineBurgFeatures(undefined, pack, Utils);`
- **Function Called**: `BurgsAndStates.defineBurgFeatures()`
- **Data Created**: Detailed settlement features

### Step 48: Specify Rivers
- **Line 114**: `const specifiedRiversResult = Rivers.specify(pack, { Names }, Utils);`
- **Function Called**: `Rivers.specify()`
- **Data Created**: Named and detailed river information

### Step 49: Specify Features
- **Line 117**: `const specifiedFeaturesResult = Features.specify(pack, grid, { Lakes });`
- **Function Called**: `Features.specify()`
- **Data Created**: Detailed geographic feature information

### Step 50: Initialize Notes Array
- **Line 121**: `const notes = [];`
- **Data Created**: Notes array for modules requiring annotation

### Step 51: Generate Military
- **Line 123**: `const militaryResult = Military.generate(pack, config.military, Utils, notes);`
- **File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/modules/military-generator.js`
- **Function Called**: `generate(pack, config.military, Utils, notes)`
- **Data Created**: Military units and fortifications

### Step 52: Generate Markers
- **Line 126**: `const markersResult = Markers.generateMarkers(pack, config.markers, Utils);`
- **File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/modules/markers-generator.js`
- **Function Called**: `generateMarkers(pack, config.markers, Utils)`
- **Data Created**: Map markers and labels

### Step 53: Generate Zones
- **Line 129**: `const zonesResult = Zones.generate(pack, notes, Utils, config.zones);`
- **File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/modules/zones-generator.js`
- **Function Called**: `generate(pack, notes, Utils, config.zones)`
- **Data Created**: Special zones and areas

## Phase 16: Generation Completion

**File**: `/home/user/Fantasy-Map-Generator/procedural/src/engine/main.js`

### Step 54: Log Performance Timing
- **Line 133**: `WARN && console.warn(\`TOTAL GENERATION TIME: ${Utils.rn((performance.now() - timeStart) / 1000, 2)}s\`);`
- **Action**: Performance timing logged if WARN debug flag is true

### Step 55: Close Console Group
- **Line 134**: `INFO && console.groupEnd("Generated Map " + seed);`
- **Action**: Console group ended if INFO debug flag is true

### Step 56: Return Generated Map Data
- **Line 137**: `return { seed, grid, pack, mapCoordinates };`
- **Data Returned**: Complete map data object containing:
  - `seed`: Generation seed
  - `grid`: Coarse Voronoi mesh with basic geographic data
  - `pack`: Refined mesh with all generated features
  - `mapCoordinates`: Geographic coordinate system

## Phase 17: Return to Viewer

**File**: `/home/user/Fantasy-Map-Generator/procedural/src/viewer/main.js`

### Step 57: Log Map Generation Complete
- **Line 72**: `console.log("Engine finished. Map data generated:", mapData);`
- **Data Received**: Complete `mapData` object from engine
- **Objects Available**: `{ seed, grid, pack, mapCoordinates }`

### Step 58: Render Map (Currently Commented Out)
- **Line 74**: `// renderMap(mapData);` (commented out)
- **Expected Next Step**: Rendering system would take the mapData and create visual representation
- **Current State**: Generation complete, awaiting rendering implementation

## Summary of Data Flow

### Key Data Transformations:
1. **UI → Configuration**: HTML form values → structured config object
2. **Configuration → Grid**: Config parameters → Voronoi mesh
3. **Grid → Heightmap**: Mesh structure → elevation data
4. **Grid → Features**: Heights → land/water classification
5. **Grid → Pack**: Coarse mesh → refined mesh
6. **Pack → Biomes**: Climate data → biome assignments
7. **Pack → Cultures**: Suitability → cultural territories
8. **Pack → Complete Map**: Sequential module processing → final map data

### Module Interaction Pattern:
- Each module receives: `(pack/grid, config_section, Utils, dependencies)`
- Each module returns: New data to merge into pack/grid
- Modules are stateless and pure (no side effects beyond returned data)
- Sequential processing builds up complexity from basic terrain to complete civilization

### Common Data Mismatches:
1. **Modules expecting properties that don't exist yet** (e.g., expecting `cells.culture` before Cultures module runs)
2. **Config sections missing expected fields** (validation tries to fix this)
3. **Pack/Grid structure differences** (pack is refined version of grid)
4. **Module dependencies** (Rivers needs Lakes, Cultures needs Names)

This trace shows the complete execution flow from button click to final map data generation, with each step clearly identifying the files, functions, data transformations, and object relationships involved in the Fantasy Map Generator's procedural generation process.