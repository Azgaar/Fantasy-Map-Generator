# ocean-layers.js

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

Now, please apply these principles to refactor the following module: `ocean-layers.js`.

**File Content:**
```javascript
"use strict";

window.OceanLayers = (function () {
  let cells, vertices, pointsN, used;

  const OceanLayers = function OceanLayers() {
    const outline = oceanLayers.attr("layers");
    if (outline === "none") return;
    TIME && console.time("drawOceanLayers");

    lineGen.curve(d3.curveBasisClosed);
    (cells = grid.cells), (pointsN = grid.cells.i.length), (vertices = grid.vertices);
    const limits = outline === "random" ? randomizeOutline() : outline.split(",").map(s => +s);

    const chains = [];
    const opacity = rn(0.4 / limits.length, 2);
    used = new Uint8Array(pointsN); // to detect already passed cells

    for (const i of cells.i) {
      const t = cells.t[i];
      if (t > 0) continue;
      if (used[i] || !limits.includes(t)) continue;
      const start = findStart(i, t);
      if (!start) continue;
      used[i] = 1;
      const chain = connectVertices(start, t); // vertices chain to form a path
      if (chain.length < 4) continue;
      const relax = 1 + t * -2; // select only n-th point
      const relaxed = chain.filter((v, i) => !(i % relax) || vertices.c[v].some(c => c >= pointsN));
      if (relaxed.length < 4) continue;
      const points = clipPoly(
        relaxed.map(v => vertices.p[v]),
        1
      );
      chains.push([t, points]);
    }

    for (const t of limits) {
      const layer = chains.filter(c => c[0] === t);
      let path = layer.map(c => round(lineGen(c[1]))).join("");
      if (path) oceanLayers.append("path").attr("d", path).attr("fill", "#ecf2f9").attr("fill-opacity", opacity);
    }

    // find eligible cell vertex to start path detection
    function findStart(i, t) {
      if (cells.b[i]) return cells.v[i].find(v => vertices.c[v].some(c => c >= pointsN)); // map border cell
      return cells.v[i][cells.c[i].findIndex(c => cells.t[c] < t || !cells.t[c])];
    }

    TIME && console.timeEnd("drawOceanLayers");
  };

  function randomizeOutline() {
    const limits = [];
    let odd = 0.2;
    for (let l = -9; l < 0; l++) {
      if (P(odd)) {
        odd = 0.2;
        limits.push(l);
      } else {
        odd *= 2;
      }
    }
    return limits;
  }

  // connect vertices to chain
  function connectVertices(start, t) {
    const chain = []; // vertices chain to form a path
    for (let i = 0, current = start; i === 0 || (current !== start && i < 10000); i++) {
      const prev = chain[chain.length - 1]; // previous vertex in chain
      chain.push(current); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter(c => cells.t[c] === t).forEach(c => (used[c] = 1));
      const v = vertices.v[current]; // neighboring vertices
      const c0 = !cells.t[c[0]] || cells.t[c[0]] === t - 1;
      const c1 = !cells.t[c[1]] || cells.t[c[1]] === t - 1;
      const c2 = !cells.t[c[2]] || cells.t[c[2]] === t - 1;
      if (v[0] !== undefined && v[0] !== prev && c0 !== c1) current = v[0];
      else if (v[1] !== undefined && v[1] !== prev && c1 !== c2) current = v[1];
      else if (v[2] !== undefined && v[2] !== prev && c0 !== c2) current = v[2];
      if (current === chain[chain.length - 1]) {
        ERROR && console.error("Next vertex is not found");
        break;
      }
    }
    chain.push(chain[0]); // push first vertex as the last one
    return chain;
  }

  return OceanLayers;
})();

```

**Instructions:**

Provide a response in three parts:

1.  **Refactored Code:** The complete JavaScript code for the new ES module in ./ocean-layers.js
2.  **Engine Dependencies:**
    *   List the external modules the refactored code will need to `import` (e.g., `Names`, `COA`) in ./ocean-layers_external.md
    *   **List the new `config` properties you identified and used** (e.g., `statesNumber`, `growthRate`) in ocean-layers_config.md This is essential.
3.  **Removed Rendering/UI Logic:** List all the code blocks related to DOM manipulation or SVG rendering that you have **removed** so they can be moved to the Viewer application into ocean-layers_render.md
