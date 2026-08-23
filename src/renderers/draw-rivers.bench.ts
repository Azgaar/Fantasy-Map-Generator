// @vitest-environment jsdom
import { bench, describe } from "vitest";

// River-cell chains are built by walking a grid graph, mimicking the branching
// shape real drainage networks have (a handful of long trunks fed by shorter tributaries).
function buildSyntheticPack(riverCount: number, cellsPerRiver: number, gridSize: number) {
  const p: [number, number][] = [];
  const h: number[] = [];
  const fl: number[] = [];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      p.push([x * 2, y * 2]);
      h.push(25 + ((x + y) % 50));
      fl.push(0);
    }
  }

  const rivers = [];
  for (let riverIndex = 0; riverIndex < riverCount; riverIndex++) {
    const startX = (riverIndex * 7) % gridSize;
    let cell = startX; // row 0
    const cells: number[] = [cell];
    for (let step = 1; step < cellsPerRiver; step++) {
      const row = Math.floor(cell / gridSize);
      if (row >= gridSize - 1) break;
      const drift = step % 3 === 0 ? 1 : step % 5 === 0 ? -1 : 0;
      const col = Math.min(gridSize - 1, Math.max(0, (cell % gridSize) + drift));
      cell = (row + 1) * gridSize + col;
      cells.push(cell);
      fl[cell] += 20;
    }

    rivers.push({
      i: riverIndex,
      cells,
      points: undefined,
      widthFactor: 1,
      sourceWidth: 0.5
    });
  }

  return { cells: { p, h, fl }, rivers };
}

async function setupModule() {
  globalThis.TIME = false;
  globalThis.ERROR = false;
  await import("../generators/river-generator");
  const { drawRivers } = await import("./draw-rivers");
  return drawRivers;
}

function primePack(riverCount: number, cellsPerRiver: number, gridSize: number) {
  (globalThis as unknown as { graphWidth: number }).graphWidth = gridSize * 2;
  (globalThis as unknown as { graphHeight: number }).graphHeight = gridSize * 2;
  globalThis.pack = buildSyntheticPack(riverCount, cellsPerRiver, gridSize) as unknown as typeof globalThis.pack;
  document.body.innerHTML = /* html */ `<svg><g id="rivers"></g></svg>`;
}

describe("drawRivers", async () => {
  const drawRivers = await setupModule();

  bench(
    "medium map (300 rivers x 20 cells, 100x100 grid)",
    () => {
      drawRivers();
    },
    {
      iterations: 20,
      setup: () => primePack(300, 20, 100)
    }
  );

  bench(
    "large map (800 rivers x 30 cells, 160x160 grid)",
    () => {
      drawRivers();
    },
    {
      iterations: 10,
      setup: () => primePack(800, 30, 160)
    }
  );

  bench(
    "redraw with no river changes (800 rivers, e.g. re-trigger from another layer)",
    () => {
      drawRivers();
      drawRivers();
    },
    {
      iterations: 10,
      setup: () => primePack(800, 30, 160)
    }
  );
});
