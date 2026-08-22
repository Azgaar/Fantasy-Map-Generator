import { bench, describe } from "vitest";

// A minimal binary-heap priority queue with the same push/pop/length surface
// as the real FlatQueue (public/libs/flatqueue.js), used by expand()'s BFS.
class TestFlatQueue {
  private ids: { cellId: number; cultureId: number; priority: number }[] = [];
  private priorities: number[] = [];
  length = 0;

  push(item: { cellId: number; cultureId: number; priority: number }, priority: number) {
    let pos = this.length++;
    this.ids.push(item);
    this.priorities.push(priority);
    while (pos > 0) {
      const parent = (pos - 1) >> 1;
      if (this.priorities[parent] <= priority) break;
      this.ids[pos] = this.ids[parent];
      this.priorities[pos] = this.priorities[parent];
      pos = parent;
    }
    this.ids[pos] = item;
    this.priorities[pos] = priority;
  }

  pop() {
    if (this.length === 0) return undefined;
    const top = this.ids[0];
    const last = this.length - 1;
    this.length = last;
    if (last > 0) {
      const item = this.ids[last];
      const priority = this.priorities[last];
      let pos = 0;
      while (true) {
        let left = pos * 2 + 1;
        const right = left + 1;
        if (left >= last) break;
        if (right < last && this.priorities[right] < this.priorities[left]) left = right;
        if (this.priorities[left] >= priority) break;
        this.ids[pos] = this.ids[left];
        this.priorities[pos] = this.priorities[left];
        pos = left;
      }
      this.ids[pos] = item;
      this.priorities[pos] = priority;
    }
    this.ids.length = last;
    this.priorities.length = last;
    return top;
  }
}

// Builds a grid-shaped synthetic pack: 4-neighbor connectivity, varied biome/
// height/river/type fields, and evenly spaced culture centers, mimicking the
// map data that Cultures.expand() walks in a real generated world.
function buildSyntheticPack(gridSize: number, cultureCount: number) {
  const n = gridSize * gridSize;
  const i = new Array(n);
  const p: [number, number][] = new Array(n);
  const c: number[][] = new Array(n);
  const biome = new Uint8Array(n);
  const h = new Uint8Array(n);
  const r = new Uint16Array(n);
  const fl = new Uint16Array(n);
  const t = new Int8Array(n);
  const area = new Float32Array(n);
  const pop = new Float32Array(n);
  const f = new Uint8Array(n).fill(1);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const cell = y * gridSize + x;
      i[cell] = cell;
      p[cell] = [x * 2, y * 2];

      const neighbors: number[] = [];
      if (x > 0) neighbors.push(cell - 1);
      if (x < gridSize - 1) neighbors.push(cell + 1);
      if (y > 0) neighbors.push(cell - gridSize);
      if (y < gridSize - 1) neighbors.push(cell + gridSize);
      c[cell] = neighbors;

      biome[cell] = (x + y) % 12;
      h[cell] = 20 + ((x * 3 + y * 7) % 60);
      r[cell] = cell % 17 === 0 ? 1 : 0;
      fl[cell] = r[cell] ? 50 + (cell % 200) : 0;
      t[cell] = cell % 23 === 0 ? 1 : cell % 29 === 0 ? 2 : -1;
      area[cell] = 1;
      pop[cell] = 1; // every cell is populated so expand() can claim it
    }
  }

  const types = ["Generic", "Hunting", "Highland", "River", "Lake", "Naval", "Nomadic"];
  const cultures: any[] = [{ i: 0, name: "Neutral", removed: true }];
  const spacing = gridSize / Math.ceil(Math.sqrt(cultureCount));
  for (let ci = 0; ci < cultureCount; ci++) {
    const cx = Math.floor(((ci % Math.ceil(Math.sqrt(cultureCount))) + 0.5) * spacing) % gridSize;
    const cy = Math.floor((Math.floor(ci / Math.ceil(Math.sqrt(cultureCount))) + 0.5) * spacing) % gridSize;
    const center = Math.min(n - 1, cy * gridSize + cx);
    cultures.push({
      i: ci + 1,
      name: `Culture${ci + 1}`,
      center,
      type: types[ci % types.length],
      expansionism: 0.5 + (ci % 5) * 0.3,
      removed: false,
      lock: false
    });
  }

  return {
    cells: { i, p, c, biome, h, r, fl, t, area, pop, f, culture: new Uint16Array(n) },
    cultures,
    biomes: Array.from({ length: 12 }, (_, idx) => ({ cost: 10 + idx * 5 })),
    features: [null, { i: 1, type: "mainland" }]
  };
}

async function setupModule() {
  globalThis.TIME = false;
  globalThis.ERROR = false;
  globalThis.WARN = false;
  globalThis.FlatQueue = TestFlatQueue as any;
  globalThis.window = globalThis.window || ({} as any);
  await import("./cultures-generator");
  return (globalThis as any).Cultures;
}

function primePack(gridSize: number, cultureCount: number) {
  globalThis.pack = buildSyntheticPack(gridSize, cultureCount) as unknown as typeof globalThis.pack;
}

describe("Cultures.expand", async () => {
  const Cultures = await setupModule();

  bench(
    "small map (60x60 grid, 8 cultures)",
    () => {
      Cultures.expand();
    },
    {
      iterations: 20,
      setup: () => primePack(60, 8)
    }
  );

  bench(
    "medium map (120x120 grid, 16 cultures)",
    () => {
      Cultures.expand();
    },
    {
      iterations: 10,
      setup: () => primePack(120, 16)
    }
  );

  bench(
    "large map (200x200 grid, 24 cultures)",
    () => {
      Cultures.expand();
    },
    {
      iterations: 5,
      setup: () => primePack(200, 24)
    }
  );
});
