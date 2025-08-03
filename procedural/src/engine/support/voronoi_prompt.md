# voronoi.js

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

Now, please apply these principles to refactor the following module: `voronoi.js`.

**File Content:**
```javascript
class Voronoi {
  /**
   * Creates a Voronoi diagram from the given Delaunator, a list of points, and the number of points. The Voronoi diagram is constructed using (I think) the {@link https://en.wikipedia.org/wiki/Bowyer%E2%80%93Watson_algorithm |Bowyer-Watson Algorithm}
   * The {@link https://github.com/mapbox/delaunator/ |Delaunator} library uses {@link https://en.wikipedia.org/wiki/Doubly_connected_edge_list |half-edges} to represent the relationship between points and triangles.
   * @param {{triangles: Uint32Array, halfedges: Int32Array}} delaunay A {@link https://github.com/mapbox/delaunator/blob/master/index.js |Delaunator} instance.
   * @param {[number, number][]} points A list of coordinates.
   * @param {number} pointsN The number of points.
   */
  constructor(delaunay, points, pointsN) {
    this.delaunay = delaunay;
    this.points = points;
    this.pointsN = pointsN;
    this.cells = { v: [], c: [], b: [] }; // voronoi cells: v = cell vertices, c = adjacent cells, b = near-border cell
    this.vertices = { p: [], v: [], c: [] }; // cells vertices: p = vertex coordinates, v = neighboring vertices, c = adjacent cells

    // Half-edges are the indices into the delaunator outputs:
    // delaunay.triangles[e] gives the point ID where the half-edge starts
    // delaunay.halfedges[e] returns either the opposite half-edge in the adjacent triangle, or -1 if there's not an adjacent triangle.
    for (let e = 0; e < this.delaunay.triangles.length; e++) {

      const p = this.delaunay.triangles[this.nextHalfedge(e)];
      if (p < this.pointsN && !this.cells.c[p]) {
        const edges = this.edgesAroundPoint(e);
        this.cells.v[p] = edges.map(e => this.triangleOfEdge(e));                                   // cell: adjacent vertex
        this.cells.c[p] = edges.map(e => this.delaunay.triangles[e]).filter(c => c < this.pointsN); // cell: adjacent valid cells
        this.cells.b[p] = edges.length > this.cells.c[p].length ? 1 : 0;                            // cell: is border
      }

      const t = this.triangleOfEdge(e);
      if (!this.vertices.p[t]) {
        this.vertices.p[t] = this.triangleCenter(t);              // vertex: coordinates
        this.vertices.v[t] = this.trianglesAdjacentToTriangle(t); // vertex: adjacent vertices
        this.vertices.c[t] = this.pointsOfTriangle(t);            // vertex: adjacent cells
      }
    }
  }

  /**
   * Gets the IDs of the points comprising the given triangle. Taken from {@link https://mapbox.github.io/delaunator/#triangle-to-points| the Delaunator docs.}
   * @param {number} t The index of the triangle
   * @returns {[number, number, number]} The IDs of the points comprising the given triangle.
   */
  pointsOfTriangle(t) {
    return this.edgesOfTriangle(t).map(edge => this.delaunay.triangles[edge]);
  }

  /**
   * Identifies what triangles are adjacent to the given triangle. Taken from {@link https://mapbox.github.io/delaunator/#triangle-to-triangles| the Delaunator docs.}
   * @param {number} t The index of the triangle
   * @returns {number[]} The indices of the triangles that share half-edges with this triangle.
   */
  trianglesAdjacentToTriangle(t) {
    let triangles = [];
    for (let edge of this.edgesOfTriangle(t)) {
      let opposite = this.delaunay.halfedges[edge];
      triangles.push(this.triangleOfEdge(opposite));
    }
    return triangles;
  }

  /**
   * Gets the indices of all the incoming and outgoing half-edges that touch the given point. Taken from {@link https://mapbox.github.io/delaunator/#point-to-edges| the Delaunator docs.}
   * @param {number} start The index of an incoming half-edge that leads to the desired point
   * @returns {number[]} The indices of all half-edges (incoming or outgoing) that touch the point.
   */
  edgesAroundPoint(start) {
    const result = [];
    let incoming = start;
    do {
      result.push(incoming);
      const outgoing = this.nextHalfedge(incoming);
      incoming = this.delaunay.halfedges[outgoing];
    } while (incoming !== -1 && incoming !== start && result.length < 20);
    return result;
  }

  /**
   * Returns the center of the triangle located at the given index.
   * @param {number} t The index of the triangle
   * @returns {[number, number]}
   */
  triangleCenter(t) {
    let vertices = this.pointsOfTriangle(t).map(p => this.points[p]);
    return this.circumcenter(vertices[0], vertices[1], vertices[2]);
  }

  /**
   * Retrieves all of the half-edges for a specific triangle `t`. Taken from {@link https://mapbox.github.io/delaunator/#edge-and-triangle| the Delaunator docs.}
   * @param {number} t The index of the triangle
   * @returns {[number, number, number]} The edges of the triangle.
   */
  edgesOfTriangle(t) { return [3 * t, 3 * t + 1, 3 * t + 2]; }

  /**
   * Enables lookup of a triangle, given one of the half-edges of that triangle. Taken from {@link https://mapbox.github.io/delaunator/#edge-and-triangle| the Delaunator docs.}
   * @param {number} e The index of the edge
   * @returns {number} The index of the triangle
   */
  triangleOfEdge(e) { return Math.floor(e / 3); }

  /**
   * Moves to the next half-edge of a triangle, given the current half-edge's index. Taken from {@link https://mapbox.github.io/delaunator/#edge-to-edges| the Delaunator docs.}
   * @param {number} e The index of the current half edge
   * @returns {number} The index of the next half edge
   */
  nextHalfedge(e) { return (e % 3 === 2) ? e - 2 : e + 1; }

  /**
   * Moves to the previous half-edge of a triangle, given the current half-edge's index. Taken from {@link https://mapbox.github.io/delaunator/#edge-to-edges| the Delaunator docs.}
   * @param {number} e The index of the current half edge
   * @returns {number} The index of the previous half edge
   */
  prevHalfedge(e) { return (e % 3 === 0) ? e + 2 : e - 1; }

  /**
   * Finds the circumcenter of the triangle identified by points a, b, and c. Taken from {@link https://en.wikipedia.org/wiki/Circumscribed_circle#Circumcenter_coordinates| Wikipedia}
   * @param {[number, number]} a The coordinates of the first point of the triangle
   * @param {[number, number]} b The coordinates of the second point of the triangle
   * @param {[number, number]} c The coordinates of the third point of the triangle
   * @return {[number, number]} The coordinates of the circumcenter of the triangle.
   */
  circumcenter(a, b, c) {
    const [ax, ay] = a;
    const [bx, by] = b;
    const [cx, cy] = c;
    const ad = ax * ax + ay * ay;
    const bd = bx * bx + by * by;
    const cd = cx * cx + cy * cy;
    const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    return [
      Math.floor(1 / D * (ad * (by - cy) + bd * (cy - ay) + cd * (ay - by))),
      Math.floor(1 / D * (ad * (cx - bx) + bd * (ax - cx) + cd * (bx - ax)))
    ];
  }
}
```

**Instructions:**

Provide a response in three parts:

1.  **Refactored Code:** The complete JavaScript code for the new ES module in ./voronoi.js
2.  **Engine Dependencies:**
    *   List the external modules the refactored code will need to `import` (e.g., `Names`, `COA`) in ./voronoi_external.md
    *   **List the new `config` properties you identified and used** (e.g., `statesNumber`, `growthRate`) in voronoi_config.md This is essential.
3.  **Removed Rendering/UI Logic:** List all the code blocks related to DOM manipulation or SVG rendering that you have **removed** so they can be moved to the Viewer application into voronoi_render.md
