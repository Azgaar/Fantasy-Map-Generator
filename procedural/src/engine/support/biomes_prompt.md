# biomes.js

**You are an expert senior JavaScript developer specializing in refactoring legacy code into modern, modular, and environment-agnostic libraries. You have a deep understanding of design patterns like dependency injection and the separation of concerns.**

**Your Goal:**

Your task is to refactor a single JavaScript module from a legacy Fantasy Map Generator application. The goal is to migrate it from its old, browser-dependent format into a pure, headless-first ES module that will be part of a core generation engine. This engine must be able to run in any JavaScript environment, including Node.js, without any dependencies on a browser or DOM.

**Architectural Context:**

*   **Old Architecture:** The original code is wrapped in an IIFE and attaches its exports to the global `window` object. It directly reads from and mutates global state variables like `pack` and `grid`, and directly accesses the DOM via `byId()`.
*   **New Architecture (Target):**
    1.  **Core Engine:** A collection of pure ES modules. It receives all necessary data (`pack`, `grid`) and configuration as function arguments. It performs its logic and returns the newly generated data. It has **zero** knowledge of the browser.
    2.  **Viewer/Client:** The application responsible for all DOM interaction, UI, and rendering SVG based on the data object produced by the engine.

**The Golden Rules of Refactoring for the Core Engine:**

1.  **No Globals:** Remove the IIFE and the attachment to the `window` object.
2.  **Use ES Modules:** All exported functions and data must use the `export` keyword.
3.  **Dependency Injection:** Functions must not read from or mutate global state. All data they need (`pack`, `grid`) must be passed in as arguments.
4.  **Introduce a `config` Object:**
    *   **When you find code that reads a value from the DOM (e.g., `byId("statesNumber").value`), this is a configuration parameter.**
    *   **You must replace this DOM call with a property from a `config` object (e.g., `config.statesNumber`).**
    *   Add this `config` object as a new argument to the function's signature.
5.  **Return New Data:** Instead of modifying an object in place (e.g., `pack.cells.biome = ...`), functions should create the new data and return it. The calling function will be responsible for merging this data into the main state object.
6.  **Strict Separation of Concerns (Crucial):**
    *   **UI Input Reading:** As per Rule #4, these `byId()` calls are your guide to what properties the `config` object needs.
    *   **Rendering Logic:** Any code that **writes to the DOM or SVG** (e.g., `d3.select`, `document.getElementById(...).innerHTML = ...`, creating `<path>` elements, etc.) is considered rendering logic.
    *   **You must REMOVE all rendering logic** from the engine module.
7.  **Maintain Style:** Preserve the original code style, comments, and variable names as much as possible for consistency.

---

**Concrete Example of Refactoring:**

**BEFORE (Legacy `burgs-and-states.txt`):**

```javascript
// ...
function placeCapitals() {
  // Direct DOM read - THIS IS A CONFIGURATION VALUE
  let count = +byId("statesNumber").value; 
  // ...
}
// ...
```

**AFTER (Refactored `engine/modules/burgsAndStates.js`):**

```javascript
// ...
// Dependencies, including the new `config` object, are injected.
export function placeCapitals(cells, graphWidth, graphHeight, config) {
  // DOM read is replaced by a property from the `config` object.
  let count = config.statesNumber; 
  // ...
  // Returns the generated data
  return { burgs, states };
}
// ...
```

---

**Your Specific Task:**

Now, please apply these principles to refactor the following module: `biomes.js`.

**File Content:**
```javascript
"use strict";

window.Biomes = (function () {
  const MIN_LAND_HEIGHT = 20;

  const getDefault = () => {
    const name = [
      "Marine",
      "Hot desert",
      "Cold desert",
      "Savanna",
      "Grassland",
      "Tropical seasonal forest",
      "Temperate deciduous forest",
      "Tropical rainforest",
      "Temperate rainforest",
      "Taiga",
      "Tundra",
      "Glacier",
      "Wetland"
    ];

    const color = [
      "#466eab",
      "#fbe79f",
      "#b5b887",
      "#d2d082",
      "#c8d68f",
      "#b6d95d",
      "#29bc56",
      "#7dcb35",
      "#409c43",
      "#4b6b32",
      "#96784b",
      "#d5e7eb",
      "#0b9131"
    ];
    const habitability = [0, 4, 10, 22, 30, 50, 100, 80, 90, 12, 4, 0, 12];
    const iconsDensity = [0, 3, 2, 120, 120, 120, 120, 150, 150, 100, 5, 0, 250];
    const icons = [
      {},
      {dune: 3, cactus: 6, deadTree: 1},
      {dune: 9, deadTree: 1},
      {acacia: 1, grass: 9},
      {grass: 1},
      {acacia: 8, palm: 1},
      {deciduous: 1},
      {acacia: 5, palm: 3, deciduous: 1, swamp: 1},
      {deciduous: 6, swamp: 1},
      {conifer: 1},
      {grass: 1},
      {},
      {swamp: 1}
    ];
    const cost = [10, 200, 150, 60, 50, 70, 70, 80, 90, 200, 1000, 5000, 150]; // biome movement cost
    const biomesMartix = [
      // hot ↔ cold [>19°C; <-4°C]; dry ↕ wet
      new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 10]),
      new Uint8Array([3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 9, 9, 9, 9, 10, 10, 10]),
      new Uint8Array([5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 9, 9, 9, 9, 9, 10, 10, 10]),
      new Uint8Array([5, 6, 6, 6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 10, 10, 10]),
      new Uint8Array([7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 10, 10])
    ];

    // parse icons weighted array into a simple array
    for (let i = 0; i < icons.length; i++) {
      const parsed = [];
      for (const icon in icons[i]) {
        for (let j = 0; j < icons[i][icon]; j++) {
          parsed.push(icon);
        }
      }
      icons[i] = parsed;
    }

    return {i: d3.range(0, name.length), name, color, biomesMartix, habitability, iconsDensity, icons, cost};
  };

  // assign biome id for each cell
  function define() {
    TIME && console.time("defineBiomes");

    const {fl: flux, r: riverIds, h: heights, c: neighbors, g: gridReference} = pack.cells;
    const {temp, prec} = grid.cells;
    pack.cells.biome = new Uint8Array(pack.cells.i.length); // biomes array

    for (let cellId = 0; cellId < heights.length; cellId++) {
      const height = heights[cellId];
      const moisture = height < MIN_LAND_HEIGHT ? 0 : calculateMoisture(cellId);
      const temperature = temp[gridReference[cellId]];
      pack.cells.biome[cellId] = getId(moisture, temperature, height, Boolean(riverIds[cellId]));
    }

    function calculateMoisture(cellId) {
      let moisture = prec[gridReference[cellId]];
      if (riverIds[cellId]) moisture += Math.max(flux[cellId] / 10, 2);

      const moistAround = neighbors[cellId]
        .filter(neibCellId => heights[neibCellId] >= MIN_LAND_HEIGHT)
        .map(c => prec[gridReference[c]])
        .concat([moisture]);
      return rn(4 + d3.mean(moistAround));
    }

    TIME && console.timeEnd("defineBiomes");
  }

  function getId(moisture, temperature, height, hasRiver) {
    if (height < 20) return 0; // all water cells: marine biome
    if (temperature < -5) return 11; // too cold: permafrost biome
    if (temperature >= 25 && !hasRiver && moisture < 8) return 1; // too hot and dry: hot desert biome
    if (isWetland(moisture, temperature, height)) return 12; // too wet: wetland biome

    // in other cases use biome matrix
    const moistureBand = Math.min((moisture / 5) | 0, 4); // [0-4]
    const temperatureBand = Math.min(Math.max(20 - temperature, 0), 25); // [0-25]
    return biomesData.biomesMartix[moistureBand][temperatureBand];
  }

  function isWetland(moisture, temperature, height) {
    if (temperature <= -2) return false; // too cold
    if (moisture > 40 && height < 25) return true; // near coast
    if (moisture > 24 && height > 24 && height < 60) return true; // off coast
    return false;
  }

  return {getDefault, define, getId};
})();
```

**Instructions:**

Provide a response in three parts:

1.  **Refactored Code:** The complete JavaScript code for the new ES module in ./biomes.js
2.  **Engine Dependencies:**
    *   List the external modules the refactored code will need to `import` (e.g., `Names`, `COA`) in ./biomes_external.md
    *   **List the new `config` properties you identified and used** (e.g., `statesNumber`, `growthRate`) in biomes_config.md This is essential.
3.  **Removed Rendering/UI Logic:** List all the code blocks related to DOM manipulation or SVG rendering that you have **removed** so they can be moved to the Viewer application.
