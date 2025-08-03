# features.js

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
8. **Efficient Destructuring:** When passing a utils object, only destructure the specific properties needed within the scope of the function that uses them, rather than destructuring the entire object at the top of every function. This improves clarity and reduces code repetition.

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

Now, please apply these principles to refactor the following module: `features.js`.

**File Content:**
```javascript
"use strict";

window.Features = (function () {
  const DEEPER_LAND = 3;
  const LANDLOCKED = 2;
  const LAND_COAST = 1;
  const UNMARKED = 0;
  const WATER_COAST = -1;
  const DEEP_WATER = -2;

  // calculate distance to coast for every cell
  function markup({distanceField, neighbors, start, increment, limit = INT8_MAX}) {
    for (let distance = start, marked = Infinity; marked > 0 && distance !== limit; distance += increment) {
      marked = 0;
      const prevDistance = distance - increment;
      for (let cellId = 0; cellId < neighbors.length; cellId++) {
        if (distanceField[cellId] !== prevDistance) continue;

        for (const neighborId of neighbors[cellId]) {
          if (distanceField[neighborId] !== UNMARKED) continue;
          distanceField[neighborId] = distance;
          marked++;
        }
      }
    }
  }

  // mark Grid features (ocean, lakes, islands) and calculate distance field
  function markupGrid() {
    TIME && console.time("markupGrid");
    Math.random = aleaPRNG(seed); // get the same result on heightmap edit in Erase mode

    const {h: heights, c: neighbors, b: borderCells, i} = grid.cells;
    const cellsNumber = i.length;
    const distanceField = new Int8Array(cellsNumber); // gird.cells.t
    const featureIds = new Uint16Array(cellsNumber); // gird.cells.f
    const features = [0];

    const queue = [0];
    for (let featureId = 1; queue[0] !== -1; featureId++) {
      const firstCell = queue[0];
      featureIds[firstCell] = featureId;

      const land = heights[firstCell] >= 20;
      let border = false; // set true if feature touches map edge

      while (queue.length) {
        const cellId = queue.pop();
        if (!border && borderCells[cellId]) border = true;

        for (const neighborId of neighbors[cellId]) {
          const isNeibLand = heights[neighborId] >= 20;

          if (land === isNeibLand && featureIds[neighborId] === UNMARKED) {
            featureIds[neighborId] = featureId;
            queue.push(neighborId);
          } else if (land && !isNeibLand) {
            distanceField[cellId] = LAND_COAST;
            distanceField[neighborId] = WATER_COAST;
          }
        }
      }

      const type = land ? "island" : border ? "ocean" : "lake";
      features.push({i: featureId, land, border, type});

      queue[0] = featureIds.findIndex(f => f === UNMARKED); // find unmarked cell
    }

    // markup deep ocean cells
    markup({distanceField, neighbors, start: DEEP_WATER, increment: -1, limit: -10});

    grid.cells.t = distanceField;
    grid.cells.f = featureIds;
    grid.features = features;

    TIME && console.timeEnd("markupGrid");
  }

  // mark Pack features (ocean, lakes, islands), calculate distance field and add properties
  function markupPack() {
    TIME && console.time("markupPack");

    const {cells, vertices} = pack;
    const {c: neighbors, b: borderCells, i} = cells;
    const packCellsNumber = i.length;
    if (!packCellsNumber) return; // no cells -> there is nothing to do

    const distanceField = new Int8Array(packCellsNumber); // pack.cells.t
    const featureIds = new Uint16Array(packCellsNumber); // pack.cells.f
    const haven = createTypedArray({maxValue: packCellsNumber, length: packCellsNumber}); // haven: opposite water cell
    const harbor = new Uint8Array(packCellsNumber); // harbor: number of adjacent water cells
    const features = [0];

    const queue = [0];
    for (let featureId = 1; queue[0] !== -1; featureId++) {
      const firstCell = queue[0];
      featureIds[firstCell] = featureId;

      const land = isLand(firstCell);
      let border = Boolean(borderCells[firstCell]); // true if feature touches map border
      let totalCells = 1; // count cells in a feature

      while (queue.length) {
        const cellId = queue.pop();
        if (borderCells[cellId]) border = true;
        if (!border && borderCells[cellId]) border = true;

        for (const neighborId of neighbors[cellId]) {
          const isNeibLand = isLand(neighborId);

          if (land && !isNeibLand) {
            distanceField[cellId] = LAND_COAST;
            distanceField[neighborId] = WATER_COAST;
            if (!haven[cellId]) defineHaven(cellId);
          } else if (land && isNeibLand) {
            if (distanceField[neighborId] === UNMARKED && distanceField[cellId] === LAND_COAST)
              distanceField[neighborId] = LANDLOCKED;
            else if (distanceField[cellId] === UNMARKED && distanceField[neighborId] === LAND_COAST)
              distanceField[cellId] = LANDLOCKED;
          }

          if (!featureIds[neighborId] && land === isNeibLand) {
            queue.push(neighborId);
            featureIds[neighborId] = featureId;
            totalCells++;
          }
        }
      }

      features.push(addFeature({firstCell, land, border, featureId, totalCells}));
      queue[0] = featureIds.findIndex(f => f === UNMARKED); // find unmarked cell
    }

    markup({distanceField, neighbors, start: DEEPER_LAND, increment: 1}); // markup pack land
    markup({distanceField, neighbors, start: DEEP_WATER, increment: -1, limit: -10}); // markup pack water

    pack.cells.t = distanceField;
    pack.cells.f = featureIds;
    pack.cells.haven = haven;
    pack.cells.harbor = harbor;
    pack.features = features;

    TIME && console.timeEnd("markupPack");

    function defineHaven(cellId) {
      const waterCells = neighbors[cellId].filter(isWater);
      const distances = waterCells.map(neibCellId => dist2(cells.p[cellId], cells.p[neibCellId]));
      const closest = distances.indexOf(Math.min.apply(Math, distances));

      haven[cellId] = waterCells[closest];
      harbor[cellId] = waterCells.length;
    }

    function addFeature({firstCell, land, border, featureId, totalCells}) {
      const type = land ? "island" : border ? "ocean" : "lake";
      const [startCell, featureVertices] = getCellsData(type, firstCell);
      const points = clipPoly(featureVertices.map(vertex => vertices.p[vertex]));
      const area = d3.polygonArea(points); // feature perimiter area
      const absArea = Math.abs(rn(area));

      const feature = {
        i: featureId,
        type,
        land,
        border,
        cells: totalCells,
        firstCell: startCell,
        vertices: featureVertices,
        area: absArea
      };

      if (type === "lake") {
        if (area > 0) feature.vertices = feature.vertices.reverse();
        feature.shoreline = unique(feature.vertices.map(vertex => vertices.c[vertex].filter(isLand)).flat());
        feature.height = Lakes.getHeight(feature);
      }

      return feature;

      function getCellsData(featureType, firstCell) {
        if (featureType === "ocean") return [firstCell, []];

        const getType = cellId => featureIds[cellId];
        const type = getType(firstCell);
        const ofSameType = cellId => getType(cellId) === type;
        const ofDifferentType = cellId => getType(cellId) !== type;

        const startCell = findOnBorderCell(firstCell);
        const featureVertices = getFeatureVertices(startCell);
        return [startCell, featureVertices];

        function findOnBorderCell(firstCell) {
          const isOnBorder = cellId => borderCells[cellId] || neighbors[cellId].some(ofDifferentType);
          if (isOnBorder(firstCell)) return firstCell;

          const startCell = cells.i.filter(ofSameType).find(isOnBorder);
          if (startCell === undefined)
            throw new Error(`Markup: firstCell ${firstCell} is not on the feature or map border`);

          return startCell;
        }

        function getFeatureVertices(startCell) {
          const startingVertex = cells.v[startCell].find(v => vertices.c[v].some(ofDifferentType));
          if (startingVertex === undefined)
            throw new Error(`Markup: startingVertex for cell ${startCell} is not found`);

          return connectVertices({vertices, startingVertex, ofSameType, closeRing: false});
        }
      }
    }
  }

  // add properties to pack features
  function specify() {
    const gridCellsNumber = grid.cells.i.length;
    const OCEAN_MIN_SIZE = gridCellsNumber / 25;
    const SEA_MIN_SIZE = gridCellsNumber / 1000;
    const CONTINENT_MIN_SIZE = gridCellsNumber / 10;
    const ISLAND_MIN_SIZE = gridCellsNumber / 1000;

    for (const feature of pack.features) {
      if (!feature || feature.type === "ocean") continue;

      feature.group = defineGroup(feature);

      if (feature.type === "lake") {
        feature.height = Lakes.getHeight(feature);
        feature.name = Lakes.getName(feature);
      }
    }

    function defineGroup(feature) {
      if (feature.type === "island") return defineIslandGroup(feature);
      if (feature.type === "ocean") return defineOceanGroup();
      if (feature.type === "lake") return defineLakeGroup(feature);
      throw new Error(`Markup: unknown feature type ${feature.type}`);
    }

    function defineOceanGroup(feature) {
      if (feature.cells > OCEAN_MIN_SIZE) return "ocean";
      if (feature.cells > SEA_MIN_SIZE) return "sea";
      return "gulf";
    }

    function defineIslandGroup(feature) {
      const prevFeature = pack.features[pack.cells.f[feature.firstCell - 1]];
      if (prevFeature && prevFeature.type === "lake") return "lake_island";
      if (feature.cells > CONTINENT_MIN_SIZE) return "continent";
      if (feature.cells > ISLAND_MIN_SIZE) return "island";
      return "isle";
    }

    function defineLakeGroup(feature) {
      if (feature.temp < -3) return "frozen";
      if (feature.height > 60 && feature.cells < 10 && feature.firstCell % 10 === 0) return "lava";

      if (!feature.inlets && !feature.outlet) {
        if (feature.evaporation > feature.flux * 4) return "dry";
        if (feature.cells < 3 && feature.firstCell % 10 === 0) return "sinkhole";
      }

      if (!feature.outlet && feature.evaporation > feature.flux) return "salt";

      return "freshwater";
    }
  }

  return {markupGrid, markupPack, specify};
})();
```

**Instructions:**

Provide a response in three parts:

1.  **Refactored Code:** The complete JavaScript code for the new ES module in ./features.js
2.  **Engine Dependencies:**
    *   List the external modules the refactored code will need to `import` (e.g., `Names`, `COA`) in ./features_external.md
    *   **List the new `config` properties you identified and used** (e.g., `statesNumber`, `growthRate`) in features_config.md This is essential.
3.  **Removed Rendering/UI Logic:** List all the code blocks related to DOM manipulation or SVG rendering that you have **removed** so they can be moved to the Viewer application into features_render.md
