import { Grid } from "../../core/types";

// Calculate the distance field 't' for grid cells:
// Positive values for distance inland, negative values for distance into water bodies.
export function calculateDistanceField(grid: Grid, heights: Uint8Array): Int8Array {
  const pointsN = heights.length;
  const t = new Int8Array(pointsN);
  const queue: number[] = [];

  // Step 1: Initialize coastlines
  for (let i = 0; i < pointsN; i++) {
    const isLand = heights[i] >= 20;
    let isCoast = false;
    for (const c of grid.cells.c[i]) {
      const neighborLand = heights[c] >= 20;
      if (isLand !== neighborLand) {
        isCoast = true;
        break;
      }
    }
    if (isCoast) {
      t[i] = isLand ? 1 : -1;
      queue.push(i);
    }
  }

  // Step 2: Breadth-first propagation
  let head = 0;
  while (head < queue.length) {
    const q = queue[head++];
    const val = t[q];
    for (const c of grid.cells.c[q]) {
      if (t[c] === 0) {
        if (val > 0 && heights[c] >= 20) {
          t[c] = val + 1;
          queue.push(c);
        } else if (val < 0 && heights[c] < 20) {
          t[c] = val - 1;
          queue.push(c);
        }
      }
    }
  }

  return t;
}

// Simple depression filling algorithm to ensure all cells flow to the ocean (height < 20)
export function fillDepressions(grid: Grid, heights: Uint8Array): Uint8Array {
  const pointsN = heights.length;
  const filledHeights = new Uint8Array(heights);

  // We find depressions (local minima on land) and slowly raise their heights
  // until they can spill over to a neighbor that leads to the sea.
  // Standard priority-queue based depression filling:
  const heap: number[] = [];
  const visited = new Uint8Array(pointsN);

  // Initialize heap with ocean cells and boundary cells
  for (let i = 0; i < pointsN; i++) {
    if (filledHeights[i] < 20 || grid.cells.b[i] === 1) {
      heap.push(i);
      visited[i] = 1;
    }
  }

  // Sort heap ascending so lowest ocean/boundary cells are processed first
  heap.sort((a, b) => filledHeights[a] - filledHeights[b]);

  while (heap.length > 0) {
    const u = heap.shift() as number;
    for (const v of grid.cells.c[u]) {
      if (visited[v] !== 0) continue;
      if (filledHeights[v] < filledHeights[u]) {
        filledHeights[v] = filledHeights[u];
      }
      visited[v] = 1;
      // Insert in sorted position
      let inserted = false;
      for (let idx = 0; idx < heap.length; idx++) {
        if (filledHeights[v] < filledHeights[heap[idx]]) {
          heap.splice(idx, 0, v);
          inserted = true;
          break;
        }
      }
      if (!inserted) heap.push(v);
    }
  }

  return filledHeights;
}

export interface HydrologyResult {
  heights: Uint8Array; // depression-filled heights
  t: Int8Array; // distance field
  flowDirections: Int32Array; // downhill neighbor index for each cell (-1 if none or water)
  flux: Float32Array; // flow accumulation flux
  rivers: Uint16Array; // river IDs (0 if none)
}

export function generateHydrology(
  grid: Grid,
  heights: Uint8Array,
  precipitation: Uint8Array
): HydrologyResult {
  const pointsN = heights.length;
  const filledHeights = fillDepressions(grid, heights);
  const t = calculateDistanceField(grid, filledHeights);

  const flowDirections = new Int32Array(pointsN).fill(-1);
  const flux = new Float32Array(pointsN);

  // Step 1: Compute flow directions
  for (let i = 0; i < pointsN; i++) {
    if (filledHeights[i] < 20) continue; // Water cells don't flow further
    let minNeighbor = i;
    let minH = filledHeights[i];
    for (const c of grid.cells.c[i]) {
      if (filledHeights[c] < minH) {
        minH = filledHeights[c];
        minNeighbor = c;
      }
    }
    if (minNeighbor !== i) {
      flowDirections[i] = minNeighbor;
    }
  }

  // Step 2: Flow accumulation (flux)
  // Sort land cell indices by height descending so we accumulate from high to low
  const landIndices: number[] = [];
  for (let i = 0; i < pointsN; i++) {
    if (filledHeights[i] >= 20) {
      landIndices.push(i);
      // Initialize with local precipitation
      flux[i] = precipitation ? precipitation[i] || 1.0 : 1.0;
    }
  }
  landIndices.sort((a, b) => filledHeights[b] - filledHeights[a]);

  for (const i of landIndices) {
    const next = flowDirections[i];
    if (next !== -1) {
      flux[next] += flux[i];
    }
  }

  // Step 3: Route rivers based on flux threshold (e.g., flux > 100)
  const rivers = new Uint16Array(pointsN);
  let nextRiverId = 1;

  // We trace rivers starting from highest flux down to the ocean
  const fluxSorted = landIndices.slice().sort((a, b) => flux[b] - flux[a]);
  for (const i of fluxSorted) {
    if (flux[i] < 80 || rivers[i] !== 0) continue;

    // Proclaim a new river
    const riverId = nextRiverId++;
    let curr = i;
    while (curr !== -1 && filledHeights[curr] >= 20) {
      rivers[curr] = riverId;
      curr = flowDirections[curr];
    }
    // Set river in water mouth cell too
    if (curr !== -1) {
      rivers[curr] = riverId;
    }
  }

  return {
    heights: filledHeights,
    t,
    flowDirections,
    flux,
    rivers
  };
}
