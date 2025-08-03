# lakes.js

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
6. **Pure functions:** Functions should not have side effects. They should either return a new state object or a specific piece of data.
7.  **Strict Separation of Concerns (Crucial):**
    *   **UI Input Reading:** As per Rule #4, these `byId()` calls are your guide to what properties the `config` object needs.
    *   **Rendering Logic:** Any code that **writes to the DOM or SVG** (e.g., `d3.select`, `document.getElementById(...).innerHTML = ...`, creating `<path>` elements, etc.) is considered rendering logic.
    *   **You must REMOVE all rendering logic** from the engine module.
8.  **Maintain Style:** Preserve the original code style, comments, and variable names as much as possible for consistency.
9. **Efficient Destructuring:** When passing a utils object, only destructure the specific properties needed within the scope of the function that uses them, rather than destructuring the entire object at the top of every function. This improves clarity and reduces code repetition.

---

**Concrete Example of Refactoring:**

**BEFORE (Legacy `burgs-and-states.js`):**

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

Now, please apply these principles to refactor the following module: `lakes.js`.

**File Content:**
```javascript
"use strict";

window.Lakes = (function () {
  const LAKE_ELEVATION_DELTA = 0.1;

  // check if lake can be potentially open (not in deep depression)
  const detectCloseLakes = h => {
    const {cells} = pack;
    const ELEVATION_LIMIT = +byId("lakeElevationLimitOutput").value;

    pack.features.forEach(feature => {
      if (feature.type !== "lake") return;
      delete feature.closed;

      const MAX_ELEVATION = feature.height + ELEVATION_LIMIT;
      if (MAX_ELEVATION > 99) {
        feature.closed = false;
        return;
      }

      let isDeep = true;
      const lowestShorelineCell = feature.shoreline.sort((a, b) => h[a] - h[b])[0];
      const queue = [lowestShorelineCell];
      const checked = [];
      checked[lowestShorelineCell] = true;

      while (queue.length && isDeep) {
        const cellId = queue.pop();

        for (const neibCellId of cells.c[cellId]) {
          if (checked[neibCellId]) continue;
          if (h[neibCellId] >= MAX_ELEVATION) continue;

          if (h[neibCellId] < 20) {
            const nFeature = pack.features[cells.f[neibCellId]];
            if (nFeature.type === "ocean" || feature.height > nFeature.height) isDeep = false;
          }

          checked[neibCellId] = true;
          queue.push(neibCellId);
        }
      }

      feature.closed = isDeep;
    });
  };

  const defineClimateData = function (heights) {
    const {cells, features} = pack;
    const lakeOutCells = new Uint16Array(cells.i.length);

    features.forEach(feature => {
      if (feature.type !== "lake") return;
      feature.flux = getFlux(feature);
      feature.temp = getLakeTemp(feature);
      feature.evaporation = getLakeEvaporation(feature);
      if (feature.closed) return; // no outlet for lakes in depressed areas

      feature.outCell = getLowestShoreCell(feature);
      lakeOutCells[feature.outCell] = feature.i;
    });

    return lakeOutCells;

    function getFlux(lake) {
      return lake.shoreline.reduce((acc, c) => acc + grid.cells.prec[cells.g[c]], 0);
    }

    function getLakeTemp(lake) {
      if (lake.cells < 6) return grid.cells.temp[cells.g[lake.firstCell]];
      return rn(d3.mean(lake.shoreline.map(c => grid.cells.temp[cells.g[c]])), 1);
    }

    function getLakeEvaporation(lake) {
      const height = (lake.height - 18) ** heightExponentInput.value; // height in meters
      const evaporation = ((700 * (lake.temp + 0.006 * height)) / 50 + 75) / (80 - lake.temp); // based on Penman formula, [1-11]
      return rn(evaporation * lake.cells);
    }

    function getLowestShoreCell(lake) {
      return lake.shoreline.sort((a, b) => heights[a] - heights[b])[0];
    }
  };

  const cleanupLakeData = function () {
    for (const feature of pack.features) {
      if (feature.type !== "lake") continue;
      delete feature.river;
      delete feature.enteringFlux;
      delete feature.outCell;
      delete feature.closed;
      feature.height = rn(feature.height, 3);

      const inlets = feature.inlets?.filter(r => pack.rivers.find(river => river.i === r));
      if (!inlets || !inlets.length) delete feature.inlets;
      else feature.inlets = inlets;

      const outlet = feature.outlet && pack.rivers.find(river => river.i === feature.outlet);
      if (!outlet) delete feature.outlet;
    }
  };

  const getHeight = function (feature) {
    const heights = pack.cells.h;
    const minShoreHeight = d3.min(feature.shoreline.map(cellId => heights[cellId])) || 20;
    return rn(minShoreHeight - LAKE_ELEVATION_DELTA, 2);
  };

  const getName = function (feature) {
    const landCell = pack.cells.c[feature.firstCell].find(c => pack.cells.h[c] >= 20);
    const culture = pack.cells.culture[landCell];
    return Names.getCulture(culture);
  };

  return {defineClimateData, cleanupLakeData, detectCloseLakes, getHeight, getName};
})();

```

**Instructions:**

Provide a response in three parts:

1.  **Refactored Code:** The complete JavaScript code for the new ES module in ./lakes.js
2.  **Engine Dependencies:**
    *   List the external modules the refactored code will need to `import` (e.g., `Names`, `COA`) in ./lakes_external.md
    *   **List the new `config` properties you identified and used** (e.g., `statesNumber`, `growthRate`) in lakes_config.md This is essential.
3.  **Removed Rendering/UI Logic:** List all the code blocks related to DOM manipulation or SVG rendering that you have **removed** so they can be moved to the Viewer application into lakes_render.md
