// @vitest-environment jsdom
import Delaunator from "delaunator";
import { bench, describe } from "vitest";
import type { Point } from "@/generators/voronoi";
import { Voronoi } from "@/generators/voronoi";

// Builds a real Voronoi diagram (same structure produced during map generation)
// and assigns synthetic land/state/province data, splitting the grid into a
// checkerboard-like patchwork of states (and provinces within states) so that
// drawBorders has to trace a realistic amount of border geometry.
function buildSyntheticPack(pointCount: number, stateCount: number, provincesPerState: number) {
  const points: Point[] = [];
  const side = Math.ceil(Math.sqrt(pointCount));
  const spacing = 1000 / side;
  for (let i = 0; i < pointCount; i++) {
    const x = (i % side) * spacing;
    const y = Math.floor(i / side) * spacing;
    points.push([x, y]);
  }

  // Real map generation surrounds the grid with a ring of boundary points
  // (see src/utils/graphUtils.ts getBoundaryPoints) so that edge cells get
  // real neighboring triangles instead of unbounded "ghost" ones (which
  // would otherwise produce -1 vertex/cell indices). Replicate that here.
  const boundary: Point[] = [];
  const offset = -spacing;
  const bSpacing = spacing * 2;
  const width = 1000;
  const height = 1000;
  const numberX = Math.ceil(width / bSpacing) - 1;
  const numberY = Math.ceil(height / bSpacing) - 1;
  for (let i = 0; i < numberX; i++) {
    const x = Math.ceil((i + 0.5) * (width / numberX));
    boundary.push([x, offset], [x, height - offset]);
  }
  for (let i = 0; i < numberY; i++) {
    const y = Math.ceil((i + 0.5) * (height / numberY));
    boundary.push([offset, y], [width - offset, y]);
  }

  const allPoints = points.concat(boundary);
  const delaunay = Delaunator.from(allPoints);
  const voronoi = new Voronoi(delaunay, allPoints, points.length);
  const { cells: voronoiCells, vertices } = voronoi;

  const cellsN = points.length;
  const h = new Uint8Array(cellsN);
  const state = new Uint16Array(cellsN);
  const province = new Uint16Array(cellsN);
  const cellsPerRow = side;

  // block size in cells so we get roughly stateCount blocks across the grid
  const blocksPerSide = Math.max(1, Math.round(Math.sqrt(stateCount)));
  const blockSize = Math.max(1, Math.floor(cellsPerRow / blocksPerSide));

  for (let i = 0; i < cellsN; i++) {
    h[i] = 30; // all land

    const col = i % cellsPerRow;
    const row = Math.floor(i / cellsPerRow);
    const blockCol = Math.floor(col / blockSize);
    const blockRow = Math.floor(row / blockSize);
    const stateId = 1 + ((blockRow * blocksPerSide + blockCol) % stateCount);
    state[i] = stateId;

    // subdivide each state block into provinces along columns
    const subCol = col % blockSize;
    const provinceIndex = Math.floor((subCol / blockSize) * provincesPerState);
    province[i] = stateId * 100 + provinceIndex;
  }

  const cells = {
    i: Uint32Array.from({ length: cellsN }, (_, i) => i),
    c: voronoiCells.c,
    v: voronoiCells.v,
    h,
    state,
    province
  };

  return { cells, vertices };
}

async function setupModule() {
  globalThis.TIME = false;
  globalThis.ERROR = false;
  const { drawBorders } = await import("./draw-borders");
  return drawBorders;
}

function primePack(pointCount: number, stateCount: number, provincesPerState: number) {
  globalThis.pack = buildSyntheticPack(pointCount, stateCount, provincesPerState) as unknown as typeof globalThis.pack;
  document.body.innerHTML = /* html */ `<svg id="map"><g id="borders"></g><g id="stateBorders"></g><g id="provinceBorders"></g></svg>`;
}

describe("drawBorders", async () => {
  const drawBorders = await setupModule();

  bench(
    "small map (1,000 cells, 8 states x 3 provinces)",
    () => {
      drawBorders();
    },
    {
      iterations: 20,
      setup: () => primePack(1_000, 8, 3)
    }
  );

  bench(
    "medium map (5,000 cells, 20 states x 4 provinces)",
    () => {
      drawBorders();
    },
    {
      iterations: 10,
      setup: () => primePack(5_000, 20, 4)
    }
  );

  bench(
    "large map (10,000 cells, 40 states x 5 provinces)",
    () => {
      drawBorders();
    },
    {
      iterations: 5,
      setup: () => primePack(10_000, 40, 5)
    }
  );
});
