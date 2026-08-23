// @vitest-environment jsdom
import { bench, describe } from "vitest";

// Minimal but functionally-real binary-heap priority queue, matching the
// public/libs/flatqueue.js implementation States.expandStates() relies on
// for its cost-based BFS/Dijkstra-style territory flood-fill.
class FlatQueueImpl {
  ids: unknown[] = [];
  values: number[] = [];
  length = 0;

  push(id: unknown, value: number) {
    let pos = this.length++;
    this.ids[pos] = id;
    this.values[pos] = value;
    while (pos > 0) {
      const parent = (pos - 1) >> 1;
      if (this.values[parent] <= this.values[pos]) break;
      [this.ids[parent], this.ids[pos]] = [this.ids[pos], this.ids[parent]];
      [this.values[parent], this.values[pos]] = [this.values[pos], this.values[parent]];
      pos = parent;
    }
  }

  pop() {
    if (this.length === 0) return undefined;
    const top = this.ids[0];
    this.length--;
    this.ids[0] = this.ids[this.length];
    this.values[0] = this.values[this.length];
    this.ids.length = this.values.length = this.length;

    let pos = 0;
    for (;;) {
      const left = pos * 2 + 1;
      const right = pos * 2 + 2;
      let smallest = pos;
      if (left < this.length && this.values[left] < this.values[smallest]) smallest = left;
      if (right < this.length && this.values[right] < this.values[smallest]) smallest = right;
      if (smallest === pos) break;
      [this.ids[pos], this.ids[smallest]] = [this.ids[smallest], this.ids[pos]];
      [this.values[pos], this.values[smallest]] = [this.values[smallest], this.values[pos]];
      pos = smallest;
    }

    return top;
  }
}

// Builds a synthetic square grid with real 4-neighbor adjacency (cells.c),
// mimicking the Voronoi-derived pack.cells graph States.expandStates() walks.
// Cells are mostly land (h=50) with a thin sea border, a few state capitals
// scattered evenly across the grid, and one culture per state so the
// same-culture cost discount applies realistically during expansion.
function buildPack(cellsX: number, cellsY: number, statesCount: number) {
  const cellsCount = cellsX * cellsY;

  const c: number[][] = [];
  const h = new Uint8Array(cellsCount);
  const s = new Uint8Array(cellsCount);
  const culture = new Uint16Array(cellsCount);
  const biome = new Uint8Array(cellsCount);
  const f = new Uint8Array(cellsCount);
  const r = new Uint16Array(cellsCount);
  const t = new Int8Array(cellsCount);
  const fl = new Uint16Array(cellsCount);
  const burgArr = new Uint16Array(cellsCount);
  const i: number[] = [];

  for (let y = 0; y < cellsY; y++) {
    for (let x = 0; x < cellsX; x++) {
      const cellId = y * cellsX + x;
      i.push(cellId);

      const neighbors: number[] = [];
      if (x > 0) neighbors.push(cellId - 1);
      if (x < cellsX - 1) neighbors.push(cellId + 1);
      if (y > 0) neighbors.push(cellId - cellsX);
      if (y < cellsY - 1) neighbors.push(cellId + cellsX);
      c.push(neighbors);

      const isBorder = x === 0 || y === 0 || x === cellsX - 1 || y === cellsY - 1;
      h[cellId] = isBorder ? 15 : 50;
      s[cellId] = isBorder ? 0 : 10;
      biome[cellId] = 5;
      f[cellId] = 0;
      t[cellId] = isBorder ? 1 : -1;
    }
  }

  const states: any[] = [{ i: 0, name: "Neutrals", removed: false, salesTax: 0, pollTax: 0, treasury: 0 }];
  const cultures: any[] = [{ i: 0, name: "Wildlands" }];
  const burgs: any[] = [{ i: 0 }];

  const cols = Math.ceil(Math.sqrt(statesCount));
  const rows = Math.ceil(statesCount / cols);
  const stepX = Math.max(1, Math.floor(cellsX / (cols + 1)));
  const stepY = Math.max(1, Math.floor(cellsY / (rows + 1)));

  for (let stateId = 1; stateId <= statesCount; stateId++) {
    const col = (stateId - 1) % cols;
    const row = Math.floor((stateId - 1) / cols);
    const x = Math.min(cellsX - 2, (col + 1) * stepX);
    const y = Math.min(cellsY - 2, (row + 1) * stepY);
    const capitalCell = y * cellsX + x;

    burgArr[capitalCell] = stateId;
    burgs.push({ i: stateId, cell: capitalCell, capital: 1, removed: false, culture: stateId, state: 0 });
    cultures.push({ i: stateId, center: capitalCell, type: "Generic" });
    states.push({
      i: stateId,
      name: `State ${stateId}`,
      type: "Generic",
      capital: stateId,
      center: capitalCell,
      culture: stateId,
      expansionism: 1.2,
      removed: false,
      salesTax: 0,
      pollTax: 0,
      treasury: 0
    });
    culture[capitalCell] = stateId;
  }

  return {
    cells: { i, c, h, s, culture, biome, f, r, t, fl, burg: burgArr, state: new Uint16Array(cellsCount) },
    states,
    cultures,
    burgs,
    features: [{ type: "ocean" }]
  };
}

async function setupModule() {
  globalThis.TIME = false;
  globalThis.rn = (v: number, d = 0) => {
    const m = 10 ** d;
    return Math.round(v * m) / m;
  };
  globalThis.FlatQueue = FlatQueueImpl as any;
  await import("./states-generator");
  return (globalThis as any).States;
}

function primePack(cellsX: number, cellsY: number, statesCount: number) {
  (globalThis as unknown as { graphWidth: number }).graphWidth = cellsX * 2;
  (globalThis as unknown as { graphHeight: number }).graphHeight = cellsY * 2;
  globalThis.pack = buildPack(cellsX, cellsY, statesCount) as unknown as typeof globalThis.pack;
  document.body.innerHTML = "";
}

describe("StatesModule.expandStates", async () => {
  const States = await setupModule();

  bench(
    "small map (~2.5k cells, 10 states)",
    () => {
      States.expandStates();
    },
    { iterations: 20, setup: () => primePack(50, 50, 10) }
  );

  bench(
    "medium map (~10k cells, 25 states)",
    () => {
      States.expandStates();
    },
    { iterations: 10, setup: () => primePack(100, 100, 25) }
  );

  bench(
    "large map (~40k cells, 50 states)",
    () => {
      States.expandStates();
    },
    { iterations: 5, setup: () => primePack(200, 200, 50) }
  );
});
