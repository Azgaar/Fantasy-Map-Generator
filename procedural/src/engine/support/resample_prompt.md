# resample.js

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

Now, please apply these principles to refactor the following module: `resample.js`.

**File Content:**
```javascript
"use strict";

window.Resample = (function () {
  /*
    generate new map based on an existing one (resampling parentMap)
    parentMap: {grid, pack, notes} from original map
    projection: f(Number, Number) -> [Number, Number]
    inverse: f(Number, Number) -> [Number, Number]
    scale: Number
  */
  function process({projection, inverse, scale}) {
    const parentMap = {grid: deepCopy(grid), pack: deepCopy(pack), notes: deepCopy(notes)};
    const riversData = saveRiversData(pack.rivers);

    grid = generateGrid();
    pack = {};
    notes = parentMap.notes;

    resamplePrimaryGridData(parentMap, inverse, scale);

    Features.markupGrid();
    addLakesInDeepDepressions();
    openNearSeaLakes();

    OceanLayers();
    calculateMapCoordinates();
    calculateTemperatures();

    reGraph();
    Features.markupPack();
    createDefaultRuler();

    restoreCellData(parentMap, inverse, scale);
    restoreRivers(riversData, projection, scale);
    restoreCultures(parentMap, projection);
    restoreBurgs(parentMap, projection, scale);
    restoreStates(parentMap, projection);
    restoreRoutes(parentMap, projection);
    restoreReligions(parentMap, projection);
    restoreProvinces(parentMap);
    restoreFeatureDetails(parentMap, inverse);
    restoreMarkers(parentMap, projection);
    restoreZones(parentMap, projection, scale);

    showStatistics();
  }

  function resamplePrimaryGridData(parentMap, inverse, scale) {
    grid.cells.h = new Uint8Array(grid.points.length);
    grid.cells.temp = new Int8Array(grid.points.length);
    grid.cells.prec = new Uint8Array(grid.points.length);

    grid.points.forEach(([x, y], newGridCell) => {
      const [parentX, parentY] = inverse(x, y);
      const parentPackCell = parentMap.pack.cells.q.find(parentX, parentY, Infinity)[2];
      const parentGridCell = parentMap.pack.cells.g[parentPackCell];

      grid.cells.h[newGridCell] = parentMap.grid.cells.h[parentGridCell];
      grid.cells.temp[newGridCell] = parentMap.grid.cells.temp[parentGridCell];
      grid.cells.prec[newGridCell] = parentMap.grid.cells.prec[parentGridCell];
    });

    if (scale >= 2) smoothHeightmap();
  }

  function smoothHeightmap() {
    grid.cells.h.forEach((height, newGridCell) => {
      const heights = [height, ...grid.cells.c[newGridCell].map(c => grid.cells.h[c])];
      const meanHeight = d3.mean(heights);
      grid.cells.h[newGridCell] = isWater(grid, newGridCell) ? Math.min(meanHeight, 19) : Math.max(meanHeight, 20);
    });
  }

  function restoreCellData(parentMap, inverse, scale) {
    pack.cells.biome = new Uint8Array(pack.cells.i.length);
    pack.cells.fl = new Uint16Array(pack.cells.i.length);
    pack.cells.s = new Int16Array(pack.cells.i.length);
    pack.cells.pop = new Float32Array(pack.cells.i.length);
    pack.cells.culture = new Uint16Array(pack.cells.i.length);
    pack.cells.state = new Uint16Array(pack.cells.i.length);
    pack.cells.burg = new Uint16Array(pack.cells.i.length);
    pack.cells.religion = new Uint16Array(pack.cells.i.length);
    pack.cells.province = new Uint16Array(pack.cells.i.length);

    const parentPackCellGroups = groupCellsByType(parentMap.pack);
    const parentPackLandCellsQuadtree = d3.quadtree(parentPackCellGroups.land);

    for (const newPackCell of pack.cells.i) {
      const [x, y] = inverse(...pack.cells.p[newPackCell]);
      if (isWater(pack, newPackCell)) continue;

      const parentPackCell = parentPackLandCellsQuadtree.find(x, y, Infinity)[2];
      const parentCellArea = parentMap.pack.cells.area[parentPackCell];
      const areaRatio = pack.cells.area[newPackCell] / parentCellArea;
      const scaleRatio = areaRatio / scale;

      pack.cells.biome[newPackCell] = parentMap.pack.cells.biome[parentPackCell];
      pack.cells.fl[newPackCell] = parentMap.pack.cells.fl[parentPackCell];
      pack.cells.s[newPackCell] = parentMap.pack.cells.s[parentPackCell] * scaleRatio;
      pack.cells.pop[newPackCell] = parentMap.pack.cells.pop[parentPackCell] * scaleRatio;
      pack.cells.culture[newPackCell] = parentMap.pack.cells.culture[parentPackCell];
      pack.cells.state[newPackCell] = parentMap.pack.cells.state[parentPackCell];
      pack.cells.religion[newPackCell] = parentMap.pack.cells.religion[parentPackCell];
      pack.cells.province[newPackCell] = parentMap.pack.cells.province[parentPackCell];
    }
  }

  function saveRiversData(parentRivers) {
    return parentRivers.map(river => {
      const meanderedPoints = Rivers.addMeandering(river.cells, river.points);
      return {...river, meanderedPoints};
    });
  }

  function restoreRivers(riversData, projection, scale) {
    pack.cells.r = new Uint16Array(pack.cells.i.length);
    pack.cells.conf = new Uint8Array(pack.cells.i.length);

    pack.rivers = riversData
      .map(river => {
        let wasInMap = true;
        const points = [];

        river.meanderedPoints.forEach(([parentX, parentY]) => {
          const [x, y] = projection(parentX, parentY);
          const inMap = isInMap(x, y);
          if (inMap || wasInMap) points.push([rn(x, 2), rn(y, 2)]);
          wasInMap = inMap;
        });
        if (points.length < 2) return null;

        const cells = points.map(point => findCell(...point));
        cells.forEach(cellId => {
          if (pack.cells.r[cellId]) pack.cells.conf[cellId] = 1;
          pack.cells.r[cellId] = river.i;
        });

        const widthFactor = river.widthFactor * scale;
        return {...river, cells, points, source: cells.at(0), mouth: cells.at(-2), widthFactor};
      })
      .filter(Boolean);

    pack.rivers.forEach(river => {
      river.basin = Rivers.getBasin(river.i);
      river.length = Rivers.getApproximateLength(river.points);
    });
  }

  function restoreCultures(parentMap, projection) {
    const validCultures = new Set(pack.cells.culture);
    const culturePoles = getPolesOfInaccessibility(pack, cellId => pack.cells.culture[cellId]);
    pack.cultures = parentMap.pack.cultures.map(culture => {
      if (!culture.i || culture.removed) return culture;
      if (!validCultures.has(culture.i)) return {...culture, removed: true, lock: false};

      const [xp, yp] = projection(...parentMap.pack.cells.p[culture.center]);
      const [x, y] = [rn(xp, 2), rn(yp, 2)];
      const centerCoords = isInMap(x, y) ? [x, y] : culturePoles[culture.i];
      const center = findCell(...centerCoords);
      return {...culture, center};
    });
  }

  function restoreBurgs(parentMap, projection, scale) {
    const packLandCellsQuadtree = d3.quadtree(groupCellsByType(pack).land);
    const findLandCell = (x, y) => packLandCellsQuadtree.find(x, y, Infinity)?.[2];

    pack.burgs = parentMap.pack.burgs.map(burg => {
      if (!burg.i || burg.removed) return burg;
      burg.population *= scale; // adjust for populationRate change

      const [xp, yp] = projection(burg.x, burg.y);
      if (!isInMap(xp, yp)) return {...burg, removed: true, lock: false};

      const closestCell = findCell(xp, yp);
      const cell = isWater(pack, closestCell) ? findLandCell(xp, yp) : closestCell;

      if (pack.cells.burg[cell]) {
        WARN && console.warn(`Cell ${cell} already has a burg. Removing burg ${burg.name} (${burg.i})`);
        return {...burg, removed: true, lock: false};
      }

      pack.cells.burg[cell] = burg.i;
      const [x, y] = getBurgCoordinates(burg, closestCell, cell, xp, yp);
      return {...burg, cell, x, y};
    });

    function getBurgCoordinates(burg, closestCell, cell, xp, yp) {
      const haven = pack.cells.haven[cell];
      if (burg.port && haven) return BurgsAndStates.getCloseToEdgePoint(cell, haven);

      if (closestCell !== cell) return pack.cells.p[cell];
      return [rn(xp, 2), rn(yp, 2)];
    }
  }

  function restoreStates(parentMap, projection) {
    const validStates = new Set(pack.cells.state);
    pack.states = parentMap.pack.states.map(state => {
      if (!state.i || state.removed) return state;
      if (validStates.has(state.i)) return state;
      return {...state, removed: true, lock: false};
    });

    BurgsAndStates.getPoles();
    const regimentCellsMap = {};
    const VERTICAL_GAP = 8;

    pack.states = pack.states.map(state => {
      if (!state.i || state.removed) return state;

      const capital = pack.burgs[state.capital];
      state.center = !capital || capital.removed ? findCell(...state.pole) : capital.cell;

      const military = state.military.map(regiment => {
        const cellCoords = projection(...parentMap.pack.cells.p[regiment.cell]);
        const cell = isInMap(...cellCoords) ? findCell(...cellCoords) : state.center;

        const [xPos, yPos] = projection(regiment.x, regiment.y);
        const [xBase, yBase] = projection(regiment.bx, regiment.by);
        const [xCell, yCell] = pack.cells.p[cell];

        const regsOnCell = regimentCellsMap[cell] || 0;
        regimentCellsMap[cell] = regsOnCell + 1;

        const name =
          isInMap(xPos, yPos) || regiment.name.includes("[relocated]") ? regiment.name : `[relocated] ${regiment.name}`;

        const pos = isInMap(xPos, yPos)
          ? {x: rn(xPos, 2), y: rn(yPos, 2)}
          : {x: xCell, y: yCell + regsOnCell * VERTICAL_GAP};

        const base = isInMap(xBase, yBase) ? {bx: rn(xBase, 2), by: rn(yBase, 2)} : {bx: xCell, by: yCell};

        return {...regiment, cell, name, ...base, ...pos};
      });

      const neighbors = state.neighbors.filter(stateId => validStates.has(stateId));
      return {...state, neighbors, military};
    });
  }

  function restoreRoutes(parentMap, projection) {
    pack.routes = parentMap.pack.routes
      .map(route => {
        let wasInMap = true;
        const points = [];

        route.points.forEach(([parentX, parentY]) => {
          const [x, y] = projection(parentX, parentY);
          const inMap = isInMap(x, y);
          if (inMap || wasInMap) points.push([rn(x, 2), rn(y, 2)]);
          wasInMap = inMap;
        });
        if (points.length < 2) return null;

        const bbox = [0, 0, graphWidth, graphHeight];
        const clipped = lineclip(points, bbox)[0].map(([x, y]) => [rn(x, 2), rn(y, 2), findCell(x, y)]);
        const firstCell = clipped[0][2];
        const feature = pack.cells.f[firstCell];
        return {...route, feature, points: clipped};
      })
      .filter(Boolean);

    pack.cells.routes = Routes.buildLinks(pack.routes);
  }

  function restoreReligions(parentMap, projection) {
    const validReligions = new Set(pack.cells.religion);
    const religionPoles = getPolesOfInaccessibility(pack, cellId => pack.cells.religion[cellId]);

    pack.religions = parentMap.pack.religions.map(religion => {
      if (!religion.i || religion.removed) return religion;
      if (!validReligions.has(religion.i)) return {...religion, removed: true, lock: false};

      const [xp, yp] = projection(...parentMap.pack.cells.p[religion.center]);
      const [x, y] = [rn(xp, 2), rn(yp, 2)];
      const centerCoords = isInMap(x, y) ? [x, y] : religionPoles[religion.i];
      const center = findCell(...centerCoords);
      return {...religion, center};
    });
  }

  function restoreProvinces(parentMap) {
    const validProvinces = new Set(pack.cells.province);
    pack.provinces = parentMap.pack.provinces.map(province => {
      if (!province.i || province.removed) return province;
      if (!validProvinces.has(province.i)) return {...province, removed: true, lock: false};

      return province;
    });

    Provinces.getPoles();

    pack.provinces.forEach(province => {
      if (!province.i || province.removed) return;
      const capital = pack.burgs[province.burg];
      province.center = !capital?.removed ? capital.cell : findCell(...province.pole);
    });
  }

  function restoreMarkers(parentMap, projection) {
    pack.markers = parentMap.pack.markers;
    pack.markers.forEach(marker => {
      const [x, y] = projection(marker.x, marker.y);
      if (!isInMap(x, y)) Markers.deleteMarker(marker.i);

      const cell = findCell(x, y);
      marker.x = rn(x, 2);
      marker.y = rn(y, 2);
      marker.cell = cell;
    });
  }

  function restoreZones(parentMap, projection, scale) {
    const getSearchRadius = cellId => Math.sqrt(parentMap.pack.cells.area[cellId] / Math.PI) * scale;

    pack.zones = parentMap.pack.zones.map(zone => {
      const cells = zone.cells
        .map(cellId => {
          const [x, y] = projection(...parentMap.pack.cells.p[cellId]);
          if (!isInMap(x, y)) return null;
          return findAll(x, y, getSearchRadius(cellId));
        })
        .filter(Boolean)
        .flat();

      return {...zone, cells: unique(cells)};
    });
  }

  function restoreFeatureDetails(parentMap, inverse) {
    pack.features.forEach(feature => {
      if (!feature) return;
      const [x, y] = pack.cells.p[feature.firstCell];
      const [parentX, parentY] = inverse(x, y);
      const parentCell = parentMap.pack.cells.q.find(parentX, parentY, Infinity)[2];
      if (parentCell === undefined) return;
      const parentFeature = parentMap.pack.features[parentMap.pack.cells.f[parentCell]];

      if (parentFeature.group) feature.group = parentFeature.group;
      if (parentFeature.name) feature.name = parentFeature.name;
      if (parentFeature.height) feature.height = parentFeature.height;
    });
  }

  function groupCellsByType(graph) {
    return graph.cells.p.reduce(
      (acc, [x, y], cellId) => {
        const group = isWater(graph, cellId) ? "water" : "land";
        acc[group].push([x, y, cellId]);
        return acc;
      },
      {land: [], water: []}
    );
  }

  function isWater(graph, cellId) {
    return graph.cells.h[cellId] < 20;
  }

  function isInMap(x, y) {
    return x >= 0 && x <= graphWidth && y >= 0 && y <= graphHeight;
  }

  return {process};
})();

```

**Instructions:**

Provide a response in three parts:

1.  **Refactored Code:** The complete JavaScript code for the new ES module in ./resample.js
2.  **Engine Dependencies:**
    *   List the external modules the refactored code will need to `import` (e.g., `Names`, `COA`) in ./resample_external.md
    *   **List the new `config` properties you identified and used** (e.g., `statesNumber`, `growthRate`) in resample_config.md This is essential.
3.  **Removed Rendering/UI Logic:** List all the code blocks related to DOM manipulation or SVG rendering that you have **removed** so they can be moved to the Viewer application into resample_render.md
