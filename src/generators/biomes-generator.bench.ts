import { bench, describe } from "vitest";

// Assigns pack.cells.biome[cellId] for every cell based on climate/terrain
// data (height, temperature, precipitation, river flux, neighbors). Runs
// once per cell, so it scales with cell count.

function buildSyntheticPack(cellCount: number) {
  const h = new Uint8Array(cellCount);
  const fl = new Float32Array(cellCount);
  const r = new Uint16Array(cellCount);
  const g = new Uint32Array(cellCount);
  const c: number[][] = [];

  for (let i = 0; i < cellCount; i++) {
    // roughly 60% land, mix of heights above/below the MIN_LAND_HEIGHT threshold (20)
    h[i] = 10 + ((i * 37) % 90);
    fl[i] = i % 7 === 0 ? (i * 3) % 500 : 0;
    r[i] = i % 7 === 0 ? 1 : 0;
    g[i] = i;

    const neighbors: number[] = [];
    if (i - 1 >= 0) neighbors.push(i - 1);
    if (i + 1 < cellCount) neighbors.push(i + 1);
    const gridWidth = Math.max(1, Math.floor(Math.sqrt(cellCount)));
    if (i - gridWidth >= 0) neighbors.push(i - gridWidth);
    if (i + gridWidth < cellCount) neighbors.push(i + gridWidth);
    c.push(neighbors);
  }

  const temp = new Int8Array(cellCount);
  const prec = new Uint8Array(cellCount);
  for (let i = 0; i < cellCount; i++) {
    temp[i] = -10 + ((i * 13) % 45); // spans -10..34
    prec[i] = (i * 17) % 60;
  }

  return {
    pack: {
      cells: {
        i: new Uint32Array(cellCount),
        fl,
        r,
        h,
        c,
        g
      }
    },
    grid: {
      cells: { temp, prec }
    }
  };
}

async function setupModule() {
  globalThis.TIME = false;
  globalThis.ERROR = false;
  await import("./biomes-generator");
  return globalThis.Biomes;
}

function primePack(cellCount: number) {
  const { pack, grid } = buildSyntheticPack(cellCount);
  globalThis.pack = pack as unknown as typeof globalThis.pack;
  globalThis.grid = grid as unknown as typeof globalThis.grid;
}

describe("Biomes.define", async () => {
  const Biomes = await setupModule();

  bench(
    "small map (3,000 cells)",
    () => {
      Biomes.define();
    },
    {
      iterations: 30,
      setup: () => primePack(3_000)
    }
  );

  bench(
    "medium map (10,000 cells)",
    () => {
      Biomes.define();
    },
    {
      iterations: 20,
      setup: () => primePack(10_000)
    }
  );

  bench(
    "large map (30,000 cells)",
    () => {
      Biomes.define();
    },
    {
      iterations: 10,
      setup: () => primePack(30_000)
    }
  );
});
