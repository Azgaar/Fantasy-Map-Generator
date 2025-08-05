Looking more carefully at the code flow:

  1. findGridCell vs Voronoi Cell Indices

  The key insight is that findGridCell in graphUtils.js:100-105 is used for coordinate-to-grid mapping, but the
  actual iteration in heightmap-generator.js happens over different indices.

  2. Actual Iteration Patterns

  In heightmap-generator.js, the problematic iterations are:

  - Line 165: for (const c of grid.cells.c[q]) - but q comes from queue.shift() where queue starts with [start]
  - Line 209: grid.cells.c[q].forEach(...) - same pattern
  - Line 268: grid.cells.c[cur].forEach(...) - cur is tracked through valid cell traversal
  - Line 516: grid.cells.c[i].forEach(...) - i is the map index over heights

  3. The Critical Constraint

  Looking at voronoi.js:22-27, cells.c[p] is only populated when:
  if (p < this.pointsN && !this.cells.c[p]) {
    // populate cells.c[p]
  }

  4. Why No Errors Occur

  The code works because:

  1. heights array length matches valid cells: In the original ../modules/heightmap-generator.js:11, heights is created with length: 
  points.length, which equals pointsN
  ```javascript
const setGraph = graph => {
const {cellsDesired, cells, points} = graph;
heights = cells.h ? Uint8Array.from(cells.h) : createTypedArray({maxValue: 100, length: points.length});
blobPower = getBlobPower(cellsDesired);
linePower = getLinePower(cellsDesired);
grid = graph;
};
```
  1. Queue propagation stays within bounds: When iterating grid.cells.c[q], the q values come from:
    - Initial valid starting points from findGridCell
    - Subsequent values from grid.cells.c[previous_q] which only contains valid adjacent cell indices
  2. Voronoi adjacency constraint: The cells.c[p] arrays only contain indices of valid neighboring cells (<
  pointsN), so the iteration naturally stays within the populated sparse array bounds
  3. Map iteration bounds: In line 468's heights.map((h, i) => ...), i ranges from 0 to heights.length-1, which
  equals pointsN-1, so grid.cells.c[i] is always within the populated range.

  The sparse array works because the algorithm's traversal patterns are naturally constrained to only access
  indices that were populated during Voronoi construction.

## TASKS

1. analyze ../modules heightmap-generator.js and src/engine/modules/heightmap-generator.js to determine why the logic has deviated. Produce docs/HEIGHTMAP_ASSESSMENT.md with findings and recommendations