# Port Project

This project is decoupling a tightly-integrated browser application into a core procedural engine and a separate presentation layer. The goal of maintaining full cross-compatibility is not only achievable but is the natural outcome of a well-architected port.

Recommended design for porting the Fantasy Map Generator to a headless system.

### High-Level Architectural Vision

The fundamental flaw of the current architecture for headless operation is the **tight coupling of generation logic and presentation (UI/rendering) logic**. Everything relies on the global `window` object, reads configuration from DOM elements, and directly manipulates SVG with libraries like `d3`.

Our primary goal is to refactor this into two distinct, well-defined components:

1.  **The FMG Core Engine**: A pure, environment-agnostic JavaScript library. It will contain all the procedural generation logic. It will have no knowledge of browsers, DOM, or SVG. Its only job is to take a configuration object and produce a serializable data object representing the map. This engine will be the heart of both the headless system and the refactored web application.

2.  **The FMG Viewer/Client**: The existing web application, refactored to act as a client to the FMG Core Engine. It will handle user input, manage the SVG canvas, and call renderer modules to visualize the data produced by the engine.

This separation is the key to achieving your cross-compatibility goal. The serialized data object (the `.map` file) becomes the universal "source of truth" that both systems can produce and consume.

---

### Phase 1: Designing the FMG Core Engine

This is the most critical phase. The engine must be a collection of pure JavaScript modules that can run in any modern JS environment (Node.js, Deno, Bun, or a browser).

#### 1.1. Input: The Configuration Object

All functions that currently read from the DOM (`byId("statesNumber").value`, `manorsInput.valueAsNumber`, etc.) must be refactored. The main generation function of the engine will accept a single `config` object.

**Example `config` object:**

```javascript
const config = {
  seed: "123456789",
  graph: {
    width: 1920,
    height: 1080,
    points: 10000
  },
  generation: {
    template: "continents",
    cultures: 12,
    culturesSet: "european",
    states: 10,
    provincesRatio: 40,
    manors: 1000,
    neutralRate: 1.2
  },
  display: {
    populationRate: 10,
    urbanization: 1,
    // ... other options from the options panel
  }
};
```

#### 1.2. Output: The `MapData` Object

The engine's primary function, let's call it `generateMap(config)`, will return a single, serializable object. This object will contain everything that is currently stored in global variables like `grid`, `pack`, `notes`, `options`, `seed`, etc.

**Example `MapData` structure:**

```javascript
{
  meta: {
    version: "1.9", // FMG version for compatibility
    generated: new Date().toISOString()
  },
  seed: "123456789",
  config: { /* the config object used for generation */ },
  grid: { /* grid data */ },
  pack: { /* pack data */ },
  notes: [ /* notes array */ ],
  // ... any other top-level state
}
```

#### 1.3. Module Refactoring Strategy

Each of your provided `.js` files will be converted into an ES module within the engine.

*   **Remove IIFE and `window`:** Replace `window.MyModule = (function () { ... })();` with standard `export` statements.
*   **Dependency Injection & Pure Functions:** Modules should not rely on or modify a global `pack` or `grid` object. Instead, they should receive the current state of the map data as an argument and return the new data they've generated.

**Example Refactoring: `biomes.js`**

**Before (biomes.js):**

```javascript
"use strict";
window.Biomes = (function () {
  // ...
  function define() {
    // ... reads from global `pack` and `grid`
    pack.cells.biome = new Uint8Array(pack.cells.i.length); // Direct modification
    // ...
  }
  return {getDefault, define, getId};
})();
```

**After (engine/modules/biomes.js):**

```javascript
"use strict";
// No IIFE, no window dependency

export function getDefaultBiomesData() {
  // ... returns default biome data
}

export function defineBiomes(pack, grid) {
  const {fl, r, h, c, g} = pack.cells;
  const {temp, prec} = grid.cells;
  const biome = new Uint8Array(pack.cells.i.length);

  for (let cellId = 0; cellId < h.length; cellId++) {
    // ... calculations ...
    biome[cellId] = getId(/* ... */);
  }
  
  // Return only the data this module is responsible for
  return { biome }; 
}

// ... other helper functions (getId, etc.)
```

#### 1.4. The Orchestrator (`engine/main.js`)

A new "main" module in the engine will orchestrate the entire generation process, calling the refactored modules in the correct sequence and composing the final `MapData` object.

```javascript
// engine/main.js
import { generateGrid } from './grid.js';
import * as Heightmap from './heightmap.js';
import * as Biomes from './biomes.js';
// ... import all other engine modules

export function generateMap(config) {
  const seed = setSeed(config.seed);

  let grid = generateGrid(config.graph);
  grid.cells.h = Heightmap.generate(grid, config.generation.template);
  
  // ... other initial grid steps (features, temperatures, etc.)
  
  let pack = reGraph(grid); // Assume reGraph is refactored

  // Sequentially build the pack object
  const { biome } = Biomes.defineBiomes(pack, grid);
  pack.cells.biome = biome;

  const { cultures, cellsCulture } = Cultures.generate(pack, grid, config);
  pack.cultures = cultures;
  pack.cells.culture = cellsCulture;
  
  // ... continue for states, burgs, rivers, etc.
  
  return { meta, seed, config, grid, pack, notes: [] };
}
```

---

### Phase 2: Refactoring the Web Application (Viewer)

The web app becomes a consumer of the Core Engine.

#### 2.1. Separating Renderers

All modules with rendering logic (`coa-renderer.js`, `ocean-layers.js`, parts of `routes-generator.js`, `markers-generator.js`) must be moved out of the engine and into a `viewer/renderers/` directory.

*   `COArenderer.draw` is already well-designed for this. It takes a `coa` object and renders it. Perfect.
*   The `Markers.generate` function should be split. The logic for *selecting candidate cells* (`listVolcanoes`, etc.) goes into the engine. The logic for *drawing the marker icon* (`addMarker` which creates SVG elements) goes into a `viewer/renderers/markers.js` module.
*   All `d3.select` and direct SVG manipulation must live exclusively in the Viewer.

#### 2.2. New Web App Workflow

1.  **UI Interaction:** The user changes options in the UI.
2.  **Build Config:** A function gathers all UI settings and builds the `config` object.
3.  **Call Engine:** It calls `FMG_Engine.generateMap(config)`. This happens entirely in memory, with no DOM updates.
4.  **Receive `MapData`:** It receives the complete `MapData` object.
5.  **Render:** It calls a main `renderMap(MapData)` function, which in turn calls all the specific renderers (`renderBiomes`, `renderStates`, `renderRoutes`, etc.) to draw the SVG.

---

### Phase 3: Building the Headless System

This now becomes incredibly simple. The headless application is just a new entry point that uses the FMG Core Engine.

#### 3.1. Node.js CLI Application

A simple command-line tool.

**`package.json` dependencies:**
`"dependencies": { "d3-quadtree": "...", "d3-polygon": "...", "delaunator": "..." }`
(Note the absence of browser-specific libraries).

**`generate.js`:**

```javascript
import { generateMap } from './engine/main.js';
import fs from 'fs';

// Load config from a JSON file passed as an argument
const configFile = process.argv[2];
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));

console.log(`Generating map with seed: ${config.seed}...`);
const mapData = generateMap(config);

// Save the output
const outputFile = config.output || `map_${config.seed}.map`;
fs.writeFileSync(outputFile, JSON.stringify(mapData));
console.log(`Map data saved to ${outputFile}`);
```

You could run it like: `node generate.js my_config.json`

#### 3.2. REST API Server

Similarly, you could wrap the engine in a web server (e.g., using Express.js) to provide map generation as a service.

---

### Data Persistence and Cross-Compatibility

The `.map` file is the lynchpin.

*   **Format:** It should be a **JSON serialization of the `MapData` object**. This is human-readable, universally compatible, and simple. For large maps, consider compressing it with Gzip (resulting in a `.map.gz` file), which is standard practice.
*   **Workflow:**
    *   **Web App Save:** `const mapFileContent = JSON.stringify(currentMapData);` -> User downloads this content as `my_world.map`.
    *   **Headless Generation:** The CLI tool saves the `JSON.stringify(mapData)` output.
    *   **Web App Load:** User uploads a `.map` file -> `const mapData = JSON.parse(fileContent);` -> `renderMap(mapData);`.

Since both systems use the **exact same FMG Core Engine** to generate the data structure, and they both save/load this structure in the same format (JSON), they are **guaranteed to be cross-compatible**.

### Proposed Project Structure

```
/fmg
├── /src
│   ├── /engine          # FMG Core Engine (headless, browser-agnostic)
│   │   ├── main.js      # Orchestrator (generateMap function)
│   │   ├── modules/     # Refactored modules (biomes.js, cultures.js, etc.)
│   │   └── utils/       # Agnostic utilities (math, array, etc.)
│   │
│   ├── /viewer          # Web Application (UI and rendering)
│   │   ├── main.js      # Main UI logic, event handlers, orchestrates rendering
│   │   ├── renderers/   # SVG rendering modules (mapRenderer.js, coaRenderer.js)
│   │   └── ui/          # UI components, dialogs, etc.
│   │
│   └── /headless        # Headless Application
│       ├── cli.js       # Command-line interface entry point
│       └── server.js    # (Optional) REST API server entry point
│
├── /assets              # SVGs for charges, icons, etc.
├── index.html
├── package.json
└── ...
```

### Step-by-Step Roadmap

1.  **Setup & Scaffolding:** Create the new project structure. Set up a build process (like Vite or Webpack) to handle modules for the browser.
2.  **Isolate Utilities:** [x] *DONE* Move all environment-agnostic utility functions (`arrayUtils`, `colorUtils`, `probabilityUtils`, etc.) into `engine/utils`.
3.  **Create the `config` Object:** Define the structure of the `config` object and modify the web app to build this object from the UI instead of having modules read from the DOM directly.
4.  **Refactor Incrementally:**
    *   Start with the simplest, most self-contained modules (e.g., `biomes`, `names-generator`). Convert them to the new engine module pattern (take data, return new data).
    *   Create the `engine/main.js` orchestrator and have it call these first few refactored modules.
    *   Modify the `viewer/main.js` to call the new `generateMap` function and then manually merge the results back into the global `pack`/`grid` objects for now.
    *   Separate the corresponding renderer for the refactored module.
5.  **Iterate:** Continue this process for all modules, one by one. `BurgsAndStates` and `Routes` will be the most complex due to their interdependencies and mixed logic.
6.  **Build Headless Entry Point:** Once the engine is fully decoupled, create the `headless/cli.js` file. It should be trivial at this point.
7.  **Finalize Viewer:** Complete the refactoring of the web app to fully rely on the `MapData` object returned by the engine, calling a master `renderMap` function instead of many individual `draw*` functions.

This phased approach ensures that you can test and validate at each step, maintaining a working application throughout the process while moving methodically toward the final, robust, and portable architecture.