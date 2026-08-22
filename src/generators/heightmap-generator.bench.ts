// @vitest-environment jsdom
import { bench, describe } from "vitest";

// Builds a synthetic square grid graph shaped like the real Voronoi-derived
// grid used by HeightmapGenerator: regularly spaced points plus a
// precomputed 4-neighbor adjacency list (cells.c), which is all the
// heightmap steps (Hill/Range/Trough/Smooth/etc.) actually read.
function buildGrid(cellsX: number, cellsY: number, spacing: number) {
  const cellsDesired = cellsX * cellsY;
  const points: [number, number][] = [];
  const neighbors: number[][] = [];

  for (let y = 0; y < cellsY; y++) {
    for (let x = 0; x < cellsX; x++) {
      points.push([x * spacing, y * spacing]);
    }
  }

  for (let y = 0; y < cellsY; y++) {
    for (let x = 0; x < cellsX; x++) {
      const i = y * cellsX + x;
      const c: number[] = [];
      if (x > 0) c.push(i - 1);
      if (x < cellsX - 1) c.push(i + 1);
      if (y > 0) c.push(i - cellsX);
      if (y < cellsY - 1) c.push(i + cellsX);
      neighbors.push(c);
    }
  }

  return {
    spacing,
    cellsX,
    cellsY,
    cellsDesired,
    points,
    cells: { c: neighbors }
  };
}

async function setupModule() {
  globalThis.TIME = false;
  globalThis.ERROR = false;
  globalThis.seed = "1";

  document.body.innerHTML = /* html */ `<input id="templateInput" value="lowIsland" />`;

  const module = await import("./heightmap-generator");
  return module;
}

function primeGraph(cellsX: number, cellsY: number, spacing: number) {
  (globalThis as unknown as { graphWidth: number }).graphWidth = cellsX * spacing;
  (globalThis as unknown as { graphHeight: number }).graphHeight = cellsY * spacing;
  return buildGrid(cellsX, cellsY, spacing);
}

describe("HeightmapGenerator.fromTemplate", async () => {
  await setupModule();

  bench(
    "small grid (~2.5k cells, 50x50)",
    () => {
      const graph = primeGraph(50, 50, 2);
      window.HeightmapGenerator.fromTemplate(graph, "lowIsland");
    },
    { iterations: 30 }
  );

  bench(
    "medium grid (~10k cells, 100x100)",
    () => {
      const graph = primeGraph(100, 100, 2);
      window.HeightmapGenerator.fromTemplate(graph, "lowIsland");
    },
    { iterations: 15 }
  );

  bench(
    "large grid (~40k cells, 200x200)",
    () => {
      const graph = primeGraph(200, 200, 2);
      window.HeightmapGenerator.fromTemplate(graph, "lowIsland");
    },
    { iterations: 5 }
  );
});
