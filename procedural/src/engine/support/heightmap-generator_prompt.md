# heightmap-generator.js

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

Now, please apply these principles to refactor the following module: `heightmap-generator.js`.

**File Content:**
```javascript
"use strict";

window.HeightmapGenerator = (function () {
  let grid = null;
  let heights = null;
  let blobPower;
  let linePower;

  const setGraph = graph => {
    const {cellsDesired, cells, points} = graph;
    heights = cells.h ? Uint8Array.from(cells.h) : createTypedArray({maxValue: 100, length: points.length});
    blobPower = getBlobPower(cellsDesired);
    linePower = getLinePower(cellsDesired);
    grid = graph;
  };

  const getHeights = () => heights;

  const clearData = () => {
    heights = null;
    grid = null;
  };

  const fromTemplate = (graph, id) => {
    const templateString = heightmapTemplates[id]?.template || "";
    const steps = templateString.split("\n");

    if (!steps.length) throw new Error(`Heightmap template: no steps. Template: ${id}. Steps: ${steps}`);
    setGraph(graph);

    for (const step of steps) {
      const elements = step.trim().split(" ");
      if (elements.length < 2) throw new Error(`Heightmap template: steps < 2. Template: ${id}. Step: ${elements}`);
      addStep(...elements);
    }

    return heights;
  };

  const fromPrecreated = (graph, id) => {
    return new Promise(resolve => {
      // create canvas where 1px corresponts to a cell
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const {cellsX, cellsY} = graph;
      canvas.width = cellsX;
      canvas.height = cellsY;

      // load heightmap into image and render to canvas
      const img = new Image();
      img.src = `./heightmaps/${id}.png`;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, cellsX, cellsY);
        const imageData = ctx.getImageData(0, 0, cellsX, cellsY);
        setGraph(graph);
        getHeightsFromImageData(imageData.data);
        canvas.remove();
        img.remove();
        resolve(heights);
      };
    });
  };

  const generate = async function (graph) {
    TIME && console.time("defineHeightmap");
    const id = byId("templateInput").value;

    Math.random = aleaPRNG(seed);
    const isTemplate = id in heightmapTemplates;
    const heights = isTemplate ? fromTemplate(graph, id) : await fromPrecreated(graph, id);
    TIME && console.timeEnd("defineHeightmap");

    clearData();
    return heights;
  };

  function addStep(tool, a2, a3, a4, a5) {
    if (tool === "Hill") return addHill(a2, a3, a4, a5);
    if (tool === "Pit") return addPit(a2, a3, a4, a5);
    if (tool === "Range") return addRange(a2, a3, a4, a5);
    if (tool === "Trough") return addTrough(a2, a3, a4, a5);
    if (tool === "Strait") return addStrait(a2, a3);
    if (tool === "Mask") return mask(a2);
    if (tool === "Invert") return invert(a2, a3);
    if (tool === "Add") return modify(a3, +a2, 1);
    if (tool === "Multiply") return modify(a3, 0, +a2);
    if (tool === "Smooth") return smooth(a2);
  }

  function getBlobPower(cells) {
    const blobPowerMap = {
      1000: 0.93,
      2000: 0.95,
      5000: 0.97,
      10000: 0.98,
      20000: 0.99,
      30000: 0.991,
      40000: 0.993,
      50000: 0.994,
      60000: 0.995,
      70000: 0.9955,
      80000: 0.996,
      90000: 0.9964,
      100000: 0.9973
    };
    return blobPowerMap[cells] || 0.98;
  }

  function getLinePower() {
    const linePowerMap = {
      1000: 0.75,
      2000: 0.77,
      5000: 0.79,
      10000: 0.81,
      20000: 0.82,
      30000: 0.83,
      40000: 0.84,
      50000: 0.86,
      60000: 0.87,
      70000: 0.88,
      80000: 0.91,
      90000: 0.92,
      100000: 0.93
    };

    return linePowerMap[cells] || 0.81;
  }

  const addHill = (count, height, rangeX, rangeY) => {
    count = getNumberInRange(count);
    while (count > 0) {
      addOneHill();
      count--;
    }

    function addOneHill() {
      const change = new Uint8Array(heights.length);
      let limit = 0;
      let start;
      let h = lim(getNumberInRange(height));

      do {
        const x = getPointInRange(rangeX, graphWidth);
        const y = getPointInRange(rangeY, graphHeight);
        start = findGridCell(x, y, grid);
        limit++;
      } while (heights[start] + h > 90 && limit < 50);

      change[start] = h;
      const queue = [start];
      while (queue.length) {
        const q = queue.shift();

        for (const c of grid.cells.c[q]) {
          if (change[c]) continue;
          change[c] = change[q] ** blobPower * (Math.random() * 0.2 + 0.9);
          if (change[c] > 1) queue.push(c);
        }
      }

      heights = heights.map((h, i) => lim(h + change[i]));
    }
  };

  const addPit = (count, height, rangeX, rangeY) => {
    count = getNumberInRange(count);
    while (count > 0) {
      addOnePit();
      count--;
    }

    function addOnePit() {
      const used = new Uint8Array(heights.length);
      let limit = 0,
        start;
      let h = lim(getNumberInRange(height));

      do {
        const x = getPointInRange(rangeX, graphWidth);
        const y = getPointInRange(rangeY, graphHeight);
        start = findGridCell(x, y, grid);
        limit++;
      } while (heights[start] < 20 && limit < 50);

      const queue = [start];
      while (queue.length) {
        const q = queue.shift();
        h = h ** blobPower * (Math.random() * 0.2 + 0.9);
        if (h < 1) return;

        grid.cells.c[q].forEach(function (c, i) {
          if (used[c]) return;
          heights[c] = lim(heights[c] - h * (Math.random() * 0.2 + 0.9));
          used[c] = 1;
          queue.push(c);
        });
      }
    }
  };

  // fromCell, toCell are options cell ids
  const addRange = (count, height, rangeX, rangeY, startCell, endCell) => {
    count = getNumberInRange(count);
    while (count > 0) {
      addOneRange();
      count--;
    }

    function addOneRange() {
      const used = new Uint8Array(heights.length);
      let h = lim(getNumberInRange(height));

      if (rangeX && rangeY) {
        // find start and end points
        const startX = getPointInRange(rangeX, graphWidth);
        const startY = getPointInRange(rangeY, graphHeight);

        let dist = 0,
          limit = 0,
          endX,
          endY;

        do {
          endX = Math.random() * graphWidth * 0.8 + graphWidth * 0.1;
          endY = Math.random() * graphHeight * 0.7 + graphHeight * 0.15;
          dist = Math.abs(endY - startY) + Math.abs(endX - startX);
          limit++;
        } while ((dist < graphWidth / 8 || dist > graphWidth / 3) && limit < 50);

        startCell = findGridCell(startX, startY, grid);
        endCell = findGridCell(endX, endY, grid);
      }

      let range = getRange(startCell, endCell);

      // get main ridge
      function getRange(cur, end) {
        const range = [cur];
        const p = grid.points;
        used[cur] = 1;

        while (cur !== end) {
          let min = Infinity;
          grid.cells.c[cur].forEach(function (e) {
            if (used[e]) return;
            let diff = (p[end][0] - p[e][0]) ** 2 + (p[end][1] - p[e][1]) ** 2;
            if (Math.random() > 0.85) diff = diff / 2;
            if (diff < min) {
              min = diff;
              cur = e;
            }
          });
          if (min === Infinity) return range;
          range.push(cur);
          used[cur] = 1;
        }

        return range;
      }

      // add height to ridge and cells around
      let queue = range.slice(),
        i = 0;
      while (queue.length) {
        const frontier = queue.slice();
        (queue = []), i++;
        frontier.forEach(i => {
          heights[i] = lim(heights[i] + h * (Math.random() * 0.3 + 0.85));
        });
        h = h ** linePower - 1;
        if (h < 2) break;
        frontier.forEach(f => {
          grid.cells.c[f].forEach(i => {
            if (!used[i]) {
              queue.push(i);
              used[i] = 1;
            }
          });
        });
      }

      // generate prominences
      range.forEach((cur, d) => {
        if (d % 6 !== 0) return;
        for (const l of d3.range(i)) {
          const min = grid.cells.c[cur][d3.scan(grid.cells.c[cur], (a, b) => heights[a] - heights[b])]; // downhill cell
          heights[min] = (heights[cur] * 2 + heights[min]) / 3;
          cur = min;
        }
      });
    }
  };

  const addTrough = (count, height, rangeX, rangeY, startCell, endCell) => {
    count = getNumberInRange(count);
    while (count > 0) {
      addOneTrough();
      count--;
    }

    function addOneTrough() {
      const used = new Uint8Array(heights.length);
      let h = lim(getNumberInRange(height));

      if (rangeX && rangeY) {
        // find start and end points
        let limit = 0,
          startX,
          startY,
          dist = 0,
          endX,
          endY;
        do {
          startX = getPointInRange(rangeX, graphWidth);
          startY = getPointInRange(rangeY, graphHeight);
          startCell = findGridCell(startX, startY, grid);
          limit++;
        } while (heights[startCell] < 20 && limit < 50);

        limit = 0;
        do {
          endX = Math.random() * graphWidth * 0.8 + graphWidth * 0.1;
          endY = Math.random() * graphHeight * 0.7 + graphHeight * 0.15;
          dist = Math.abs(endY - startY) + Math.abs(endX - startX);
          limit++;
        } while ((dist < graphWidth / 8 || dist > graphWidth / 2) && limit < 50);

        endCell = findGridCell(endX, endY, grid);
      }

      let range = getRange(startCell, endCell);

      // get main ridge
      function getRange(cur, end) {
        const range = [cur];
        const p = grid.points;
        used[cur] = 1;

        while (cur !== end) {
          let min = Infinity;
          grid.cells.c[cur].forEach(function (e) {
            if (used[e]) return;
            let diff = (p[end][0] - p[e][0]) ** 2 + (p[end][1] - p[e][1]) ** 2;
            if (Math.random() > 0.8) diff = diff / 2;
            if (diff < min) {
              min = diff;
              cur = e;
            }
          });
          if (min === Infinity) return range;
          range.push(cur);
          used[cur] = 1;
        }

        return range;
      }

      // add height to ridge and cells around
      let queue = range.slice(),
        i = 0;
      while (queue.length) {
        const frontier = queue.slice();
        (queue = []), i++;
        frontier.forEach(i => {
          heights[i] = lim(heights[i] - h * (Math.random() * 0.3 + 0.85));
        });
        h = h ** linePower - 1;
        if (h < 2) break;
        frontier.forEach(f => {
          grid.cells.c[f].forEach(i => {
            if (!used[i]) {
              queue.push(i);
              used[i] = 1;
            }
          });
        });
      }

      // generate prominences
      range.forEach((cur, d) => {
        if (d % 6 !== 0) return;
        for (const l of d3.range(i)) {
          const min = grid.cells.c[cur][d3.scan(grid.cells.c[cur], (a, b) => heights[a] - heights[b])]; // downhill cell
          //debug.append("circle").attr("cx", p[min][0]).attr("cy", p[min][1]).attr("r", 1);
          heights[min] = (heights[cur] * 2 + heights[min]) / 3;
          cur = min;
        }
      });
    }
  };

  const addStrait = (width, direction = "vertical") => {
    width = Math.min(getNumberInRange(width), grid.cellsX / 3);
    if (width < 1 && P(width)) return;
    const used = new Uint8Array(heights.length);
    const vert = direction === "vertical";
    const startX = vert ? Math.floor(Math.random() * graphWidth * 0.4 + graphWidth * 0.3) : 5;
    const startY = vert ? 5 : Math.floor(Math.random() * graphHeight * 0.4 + graphHeight * 0.3);
    const endX = vert
      ? Math.floor(graphWidth - startX - graphWidth * 0.1 + Math.random() * graphWidth * 0.2)
      : graphWidth - 5;
    const endY = vert
      ? graphHeight - 5
      : Math.floor(graphHeight - startY - graphHeight * 0.1 + Math.random() * graphHeight * 0.2);

    const start = findGridCell(startX, startY, grid);
    const end = findGridCell(endX, endY, grid);
    let range = getRange(start, end);
    const query = [];

    function getRange(cur, end) {
      const range = [];
      const p = grid.points;

      while (cur !== end) {
        let min = Infinity;
        grid.cells.c[cur].forEach(function (e) {
          let diff = (p[end][0] - p[e][0]) ** 2 + (p[end][1] - p[e][1]) ** 2;
          if (Math.random() > 0.8) diff = diff / 2;
          if (diff < min) {
            min = diff;
            cur = e;
          }
        });
        range.push(cur);
      }

      return range;
    }

    const step = 0.1 / width;

    while (width > 0) {
      const exp = 0.9 - step * width;
      range.forEach(function (r) {
        grid.cells.c[r].forEach(function (e) {
          if (used[e]) return;
          used[e] = 1;
          query.push(e);
          heights[e] **= exp;
          if (heights[e] > 100) heights[e] = 5;
        });
      });
      range = query.slice();

      width--;
    }
  };

  const modify = (range, add, mult, power) => {
    const min = range === "land" ? 20 : range === "all" ? 0 : +range.split("-")[0];
    const max = range === "land" || range === "all" ? 100 : +range.split("-")[1];
    const isLand = min === 20;

    heights = heights.map(h => {
      if (h < min || h > max) return h;

      if (add) h = isLand ? Math.max(h + add, 20) : h + add;
      if (mult !== 1) h = isLand ? (h - 20) * mult + 20 : h * mult;
      if (power) h = isLand ? (h - 20) ** power + 20 : h ** power;
      return lim(h);
    });
  };

  const smooth = (fr = 2, add = 0) => {
    heights = heights.map((h, i) => {
      const a = [h];
      grid.cells.c[i].forEach(c => a.push(heights[c]));
      if (fr === 1) return d3.mean(a) + add;
      return lim((h * (fr - 1) + d3.mean(a) + add) / fr);
    });
  };

  const mask = (power = 1) => {
    const fr = power ? Math.abs(power) : 1;

    heights = heights.map((h, i) => {
      const [x, y] = grid.points[i];
      const nx = (2 * x) / graphWidth - 1; // [-1, 1], 0 is center
      const ny = (2 * y) / graphHeight - 1; // [-1, 1], 0 is center
      let distance = (1 - nx ** 2) * (1 - ny ** 2); // 1 is center, 0 is edge
      if (power < 0) distance = 1 - distance; // inverted, 0 is center, 1 is edge
      const masked = h * distance;
      return lim((h * (fr - 1) + masked) / fr);
    });
  };

  const invert = (count, axes) => {
    if (!P(count)) return;

    const invertX = axes !== "y";
    const invertY = axes !== "x";
    const {cellsX, cellsY} = grid;

    const inverted = heights.map((h, i) => {
      const x = i % cellsX;
      const y = Math.floor(i / cellsX);

      const nx = invertX ? cellsX - x - 1 : x;
      const ny = invertY ? cellsY - y - 1 : y;
      const invertedI = nx + ny * cellsX;
      return heights[invertedI];
    });

    heights = inverted;
  };

  function getPointInRange(range, length) {
    if (typeof range !== "string") {
      ERROR && console.error("Range should be a string");
      return;
    }

    const min = range.split("-")[0] / 100 || 0;
    const max = range.split("-")[1] / 100 || min;
    return rand(min * length, max * length);
  }

  function getHeightsFromImageData(imageData) {
    for (let i = 0; i < heights.length; i++) {
      const lightness = imageData[i * 4] / 255;
      const powered = lightness < 0.2 ? lightness : 0.2 + (lightness - 0.2) ** 0.8;
      heights[i] = minmax(Math.floor(powered * 100), 0, 100);
    }
  }

  return {
    setGraph,
    getHeights,
    generate,
    fromTemplate,
    fromPrecreated,
    addHill,
    addRange,
    addTrough,
    addStrait,
    addPit,
    smooth,
    modify,
    mask,
    invert
  };
})();
```

**Instructions:**

Provide a response in three parts:

1.  **Refactored Code:** The complete JavaScript code for the new ES module in ./heightmap-generator.js
2.  **Engine Dependencies:**
    *   List the external modules the refactored code will need to `import` (e.g., `Names`, `COA`) in ./heightmap-generator_external.md
    *   **List the new `config` properties you identified and used** (e.g., `statesNumber`, `growthRate`) in heightmap-generator_config.md This is essential.
3.  **Removed Rendering/UI Logic:** List all the code blocks related to DOM manipulation or SVG rendering that you have **removed** so they can be moved to the Viewer application.
