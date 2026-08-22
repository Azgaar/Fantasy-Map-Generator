import { bench, describe } from "vitest";
import type { Burg } from "./burgs-generator";

// A minimal but reasonably fast binary-heap priority queue, matching the shape
// `findPath` expects from `window.FlatQueue` (push/pop/peekValue/length).
// A naive O(n) sort-based stand-in would mask an accidental algorithmic
// regression inside findPath itself, so we use a real heap here.
class BenchFlatQueue {
  private ids: number[] = [];
  private values: number[] = [];

  get length() {
    return this.ids.length;
  }

  push(id: number, value: number) {
    let pos = this.ids.length;
    this.ids.push(id);
    this.values.push(value);
    while (pos > 0) {
      const parent = (pos - 1) >> 1;
      if (this.values[parent] <= this.values[pos]) break;
      this.swap(parent, pos);
      pos = parent;
    }
  }

  pop(): number | undefined {
    if (!this.ids.length) return undefined;
    const top = this.ids[0];
    const last = this.ids.length - 1;
    this.ids[0] = this.ids[last];
    this.values[0] = this.values[last];
    this.ids.pop();
    this.values.pop();

    let pos = 0;
    const n = this.ids.length;
    for (;;) {
      const left = pos * 2 + 1;
      const right = left + 1;
      let smallest = pos;
      if (left < n && this.values[left] < this.values[smallest]) smallest = left;
      if (right < n && this.values[right] < this.values[smallest]) smallest = right;
      if (smallest === pos) break;
      this.swap(pos, smallest);
      pos = smallest;
    }

    return top;
  }

  peekValue(): number | undefined {
    return this.values[0];
  }

  private swap(a: number, b: number) {
    [this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]];
    [this.values[a], this.values[b]] = [this.values[b], this.values[a]];
  }
}

// Builds a deterministic square-grid "continent" (land interior, a one-cell-wide
// water border) with burgs spread evenly across the land, mimicking the shape
// routes-generator.ts expects of `pack`: a road/trail network is grown as the
// Urquhart graph of burgs-per-feature, each edge resolved via Dijkstra
// (findPath) over land cells.
function buildSyntheticPack(gridSize: number, burgCount: number) {
  const p: [number, number][] = [];
  const h: number[] = [];
  const biome: number[] = [];
  const g: number[] = [];
  const c: number[][] = [];
  const burg: number[] = [];

  const isBorder = (x: number, y: number) => x === 0 || y === 0 || x === gridSize - 1 || y === gridSize - 1;
  const idx = (x: number, y: number) => y * gridSize + x;

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      p.push([x * 10, y * 10]);
      const land = !isBorder(x, y);
      h.push(land ? 30 : 10);
      biome.push(land ? 1 : 0);
      g.push(0);
      burg.push(0);

      const neighbors: number[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
          neighbors.push(idx(nx, ny));
        }
      }
      c.push(neighbors);
    }
  }

  const burgs: Burg[] = [0 as unknown as Burg];
  const landInterior = gridSize - 2;
  const stride = Math.max(1, Math.floor((landInterior * landInterior) / burgCount));

  let placed = 0;
  for (let n = 0; n < landInterior * landInterior && placed < burgCount; n++) {
    if (n % stride !== 0) continue;
    const localX = n % landInterior;
    const localY = Math.floor(n / landInterior);
    const x = 1 + localX;
    const y = 1 + localY;
    if (y >= gridSize - 1) break;

    const cellId = idx(x, y);
    const burgId = placed + 1;
    burg[cellId] = burgId;
    burgs.push({
      i: burgId,
      name: `Burg${burgId}`,
      cell: cellId,
      x: p[cellId][0],
      y: p[cellId][1],
      feature: 1,
      capital: placed % 6 === 0 ? 1 : 0,
      port: 0,
      removed: false
    } as unknown as Burg);
    placed++;
  }

  return {
    cells: { p, h, biome, g, c, burg, routes: {} },
    burgs,
    biomes: [{ habitability: 0 }, { habitability: 60 }],
    rivers: [],
    routes: [] as unknown[]
  };
}

async function setupModule() {
  globalThis.TIME = false;
  globalThis.ERROR = false;
  globalThis.window = globalThis.window || ({} as any);
  (globalThis as any).FlatQueue = BenchFlatQueue;
  globalThis.grid = { cells: { temp: [20] } } as any;
  globalThis.seed = "bench-seed";
  globalThis.pack = { cells: { p: [], h: [], biome: [], g: [], c: [], burg: [], routes: {} }, burgs: [], biomes: [], rivers: [], routes: [] } as any;
  const module = await import("./routes-generator");
  return module;
}

function primePack(gridSize: number, burgCount: number) {
  globalThis.pack = buildSyntheticPack(gridSize, burgCount) as unknown as typeof globalThis.pack;
}

describe("RoutesModule.generate", async () => {
  await setupModule();
  const Routes = (globalThis as any).Routes;

  bench(
    "small map (40x40 grid, 20 burgs)",
    () => {
      Routes.generate();
    },
    {
      iterations: 20,
      setup: () => primePack(40, 20)
    }
  );

  bench(
    "medium map (80x80 grid, 80 burgs)",
    () => {
      Routes.generate();
    },
    {
      iterations: 10,
      setup: () => primePack(80, 80)
    }
  );

  bench(
    "large map (120x120 grid, 200 burgs)",
    () => {
      Routes.generate();
    },
    {
      iterations: 5,
      setup: () => primePack(120, 200)
    }
  );
});
