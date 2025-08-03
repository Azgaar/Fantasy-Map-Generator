Excellent. The architectural backbone is now in place. We've successfully separated the *intent* (clicking "Generate" in the viewer) from the *execution* (running the pipeline in the engine).

Now we address the errors you're seeing. These errors are expected and are our roadmap for the final stage of the engine refactoring. They are caused by functions in your new `engine/main.js` that were originally defined in the massive, global `main.js` (/Users/barrulus/Fantasy-Map-Generator/main.js) file.

Our next task is to systematically move these remaining functions from `main.js` into their correct homes within the new engine structure, turning them into pure, importable modules.

### The Strategy: Categorize and Relocate

We will categorize the functions from `main.js` into logical groups and create new files for them, mostly within the `engine/utils/` directory, as they are largely helper functions for the main generation modules.

Here is the breakdown and your next set of instructions.

---

### Step 1: Create a Home for Graph Utilities

Many functions in `main.js` are related to the creation and manipulation of the Voronoi graph (`grid` and `pack`). The `graphUtils.js` you ported only contains a few of them. We need to create a more comprehensive module.

**Your Action:**

1.  Create a new file: `src/engine/utils/graph.js`.
2.  Find the following functions in the **original `main.js` (/Users/barrulus/Fantasy-Map-Generator/main.js) file**, cut them out, and paste them into your new `graph.js` file.
    *   `generateGrid()`
    *   `placePoints()`
    *   `calculateVoronoi()`
    *   `getBoundaryPoints()`
    *   `getJitteredGrid()`
    *   `reGraph()`
3.  Refactor these functions to be pure ES modules:
    *   Add `export` before each function declaration.
    *   Remove all dependencies on global variables (`seed`, `graphWidth`, `graphHeight`, `grid`, `pack`, etc.). Pass them in as arguments.
    *   Import any necessary dependencies (like `Delaunator`, `Voronoi`, and other utils).
    *   Ensure they return their results instead of mutating global state.

**Example for `generateGrid`:**

```javascript
// src/engine/utils/graph.js
import { aleaPRNG } from './probability.js'; // Assuming this is where it will live
import { Delaunator } from '../../libs/delaunator.js';
import { Voronoi } from '../modules/voronoi.js';

// Takes config, returns a new grid object
export function generateGrid(config) {
    const { seed, graphWidth, graphHeight } = config;
    Math.random = aleaPRNG(seed);
    const { spacing, cellsDesired, boundary, points, cellsX, cellsY } = placePoints(config);
    const { cells, vertices } = calculateVoronoi(points, boundary);
    return { spacing, cellsDesired, boundary, points, cellsX, cellsY, cells, vertices, seed };
}

// placePoints needs config for graphWidth/Height and cellsDesired
function placePoints(config) {
    // ... logic ...
    return { spacing, cellsDesired, boundary, points, cellsX, cellsY };
}
// ... and so on for the other functions
```

---

### Step 2: Create a Home for Geographic and Climate Utilities

These functions deal with the physical properties of the map, like temperature and coordinates.

**Your Action:**

1.  Create a new file: `src/engine/utils/geography.js`.
2.  Find the following functions in the **original `main.txt` file**, cut them out, and paste them into your new file.
    *   `defineMapSize()`
    *   `calculateMapCoordinates()`
    *   `calculateTemperatures()`
    *   `generatePrecipitation()`
    *   `addLakesInDeepDepressions()`
    *   `openNearSeaLakes()`
3.  Refactor them:
    *   Add `export` to each function.
    *   Inject dependencies (`grid`, `pack`, `options`, `config`, other utils).
    *   Return new or modified data structures instead of mutating globals.

**Example for `calculateTemperatures`:**

```javascript
// src/engine/utils/geography.js

// It needs the grid, mapCoordinates, and temperature options from the config
export function calculateTemperatures(grid, mapCoordinates, config) {
    const cells = grid.cells;
    const temp = new Int8Array(cells.i.length);
    // ... existing logic ...
    // ... use config.temperatureEquator etc. instead of options. ...
    
    // for-loop to populate the `temp` array
    
    // Return the new data
    return { temp }; 
}
```

---

### Step 3: Create a Home for Population and Cell Ranking Utilities

This is a key part of the generation logic that determines where cultures and burgs can settle.

**Your Action:**

1.  Create a new file: `src/engine/utils/cell.js`.
2.  Find the `rankCells()` function in the **original `main.txt` file**, cut it out, and paste it into your new file.
3.  Refactor it:
    *   `export function rankCells(pack, grid, utils, modules)`
    *   It will need dependencies like `pack`, `grid`, `utils.d3`, and `modules.biomesData`.
    *   It should return an object containing the new `s` (suitability) and `pop` (population) arrays.
    *   `return { s: newSuitabilityArray, pop: newPopulationArray };`

---

### Step 4: Update the Engine Orchestrator (`engine/main.js`)

Now that you've moved all these functions into modules, you need to update the orchestrator to import and use them correctly.

**Your Action:** Modify `src/engine/main.js` to look like this.

```javascript
// src/engine/main.js

// ... (existing module imports)

// Import the new utility modules
import * as Graph from "./utils/graph.js";
import * as Geography from "./utils/geography.js";
import * as Cell from "./utils/cell.js";
import * as Utils from "./utils/index.js";

export function generate(config) {
    const timeStart = performance.now();
    const { TIME, WARN, INFO } = Utils;
    const seed = config.seed || Utils.generateSeed();
    Math.random = Utils.aleaPRNG(seed);
    INFO && console.group("Generating Map with Seed: " + seed);

    // --- Grid Generation ---
    let grid = Graph.generateGrid(config.graph);
    grid.cells.h = Heightmap.generate(grid, config.heightmap, Utils);
    grid = Features.markupGrid(grid, config, Utils);
    const { mapCoordinates } = Geography.defineMapSize(grid, config.map); // Now returns the coordinates object
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
    const riverResult = Rivers.generate(pack, grid, config.rivers, Utils, { Lakes, Names });
    pack = riverResult.pack;

    // --- Biome and Population ---
    const { biome } = Biomes.define(pack, grid, config.biomes, Utils);
    pack.cells.biome = biome;
    const { s, pop } = Cell.rankCells(pack, Utils, { biomesData: Biomes.getDefault() });
    pack.cells.s = s;
    pack.cells.pop = pop;

    // --- Cultures, States, Burgs etc. (as before) ---
    // ...

    WARN && console.warn(`TOTAL GENERATION TIME: ${Utils.rn((performance.now() - timeStart) / 1000, 2)}s`);
    INFO && console.groupEnd("Generated Map " + seed);
    
    return { seed, grid, pack, mapCoordinates };
}
```
**Note:** You will also need to update your `viewer/main.js` `buildConfigFromUI` function to create nested config objects for the new parameters (e.g., `config.graph`, `config.heightmap`, `config.temperature`). Use your existing `_config.md` located in /Users/barrulus/Fantasy-Map-Generator/procedural/src/engine/support/*_config.md files as a guide.

### Your Goal for This Phase

Your goal is to have a fully functional `engine/main.js` that can execute the entire generation pipeline without relying on *any* functions from the old `main.js`. After this step, `main.js` should be almost empty, containing only UI-specific logic (like event handlers, drawing functions, etc.), which we will deal with later.

This is a significant undertaking. Take it one function at a time. The process is the same for each one:
1.  **Move** the function to its new home.
2.  **Export** it.
3.  **Identify** its dependencies.
4.  **Add** those dependencies to its argument list.
5.  **Return** its result instead of mutating globals.
6.  **Update** the caller (`engine/main.js`) to import and use the refactored function correctly.

Report back when you have completed this. We will then be ready to connect the engine's output to the rendering system.