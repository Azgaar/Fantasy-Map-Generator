// @vitest-environment jsdom
import Delaunator from "delaunator";
import { bench, describe } from "vitest";
import type { Point } from "../generators/voronoi";
import { Voronoi } from "../generators/voronoi";

// Build a realistic-ish grid: jittered lattice points fed through the real
// Voronoi/Delaunay pipeline, with heights following a radial gradient so the
// generated grid has a plausible mix of ocean and land contour bands (like a
// roughly circular island), similar to what drawHeightmap operates on in the app.
function buildSyntheticGrid(gridSize: number, cellSize: number) {
  const points: Point[] = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const jitterX = ((x * 37 + y * 17) % 10) / 10 - 0.5;
      const jitterY = ((x * 13 + y * 29) % 10) / 10 - 0.5;
      points.push([(x + jitterX) * cellSize, (y + jitterY) * cellSize]);
    }
  }

  const delaunay = Delaunator.from(points);
  const voronoi = new Voronoi(delaunay, points, points.length);
  const { cells, vertices } = voronoi;

  const width = gridSize * cellSize;
  const height = gridSize * cellSize;
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  const h = new Uint8Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const [px, py] = points[i];
    const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2) / maxDist; // 0 (center) .. 1 (edge)
    // Radial gradient from high mountains at the center down to deep ocean at the edges,
    // with a bit of noise so height bands aren't perfectly smooth circles.
    const noise = ((i * 31) % 11) - 5;
    const raw = 90 - dist * 110 + noise;
    h[i] = Math.max(0, Math.min(100, Math.round(raw)));
  }

  return { cells: { ...cells, h }, vertices, width, height };
}

async function setupModule() {
  globalThis.TIME = false;
  globalThis.ERROR = false;
  globalThis.customization = 0;
  globalThis.getColorScheme = () => (t: number) =>
    `rgb(${Math.round(t * 255)},${Math.round(t * 255)},${Math.round(t * 255)})`;
  globalThis.getColor = (heightValue: number, scheme: (t: number) => string) => scheme(heightValue / 100);
  const { drawHeightmap } = await import("./draw-heightmap");
  return drawHeightmap;
}

function primeGrid(gridSize: number, cellSize: number) {
  const grid = buildSyntheticGrid(gridSize, cellSize);
  (globalThis as unknown as { graphWidth: number }).graphWidth = grid.width;
  (globalThis as unknown as { graphHeight: number }).graphHeight = grid.height;
  globalThis.grid = grid as unknown as typeof globalThis.grid;
  document.body.innerHTML = /* html */ `<svg>
    <g id="terrs">
      <g id="oceanHeights" data-render="1" scheme="bright"></g>
      <g id="landHeights" scheme="bright"></g>
    </g>
  </svg>`;
}

describe("drawHeightmap", async () => {
  const drawHeightmap = await setupModule();

  bench(
    "small grid (40x40 cells)",
    () => {
      drawHeightmap();
    },
    {
      iterations: 20,
      setup: () => primeGrid(40, 10)
    }
  );

  bench(
    "medium grid (80x80 cells)",
    () => {
      drawHeightmap();
    },
    {
      iterations: 10,
      setup: () => primeGrid(80, 10)
    }
  );

  bench(
    "large grid (120x120 cells)",
    () => {
      drawHeightmap();
    },
    {
      iterations: 5,
      setup: () => primeGrid(120, 10)
    }
  );
});
