import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { States } from "./states-generator";

const WIDTH = 12;
const HEIGHT = 8;
const CELLS = WIDTH * HEIGHT;

const cellAt = (index: number) => [index % WIDTH, Math.floor(index / WIDTH)] as const;
const position = (index: number): [number, number] => {
  const [x, y] = cellAt(index);
  return [x * 100 + 50, y * 100 + 50];
};
const neighbors = (index: number): number[] => {
  const [x, y] = cellAt(index);
  const result: number[] = [];
  if (x > 0) result.push(index - 1);
  if (x < WIDTH - 1) result.push(index + 1);
  if (y > 0) result.push(index - WIDTH);
  if (y < HEIGHT - 1) result.push(index + WIDTH);
  return result;
};

const capitals = [{ burg: 1, cell: 0 }];
const candidates = [
  { burg: 2, cell: 60 },
  { burg: 3, cell: 94 },
  { burg: 4, cell: 47 },
  { burg: 5, cell: 50 }
];

// Minimal FlatQueue polyfill (correct, not optimised — tests only), the legacy global expandStates reads
class TestFlatQueue {
  private items: Array<{ id: unknown; value: number }> = [];
  get length() {
    return this.items.length;
  }
  push(id: unknown, value: number) {
    this.items.push({ id, value });
    this.items.sort((a, b) => a.value - b.value);
  }
  pop() {
    return this.items.shift()?.id;
  }
}

beforeEach(() => {
  // 0.5 keeps every draw on its middle branch, so the fixture is predictable
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  (globalThis as unknown as { FlatQueue: typeof TestFlatQueue }).FlatQueue = TestFlatQueue;
  globalThis.options = {
    map: { seed: "123456", graph: { width: 1200, height: 800 } },
    generation: { states: { limit: 1, sizeVariety: 2, growthRate: 10, freeBurgs: 0 } }
  } as unknown as typeof options;

  globalThis.pack = {
    cells: {
      i: Array.from({ length: CELLS }, (_, index) => index),
      state: new Uint16Array(CELLS),
      c: Array.from({ length: CELLS }, (_, index) => neighbors(index)),
      p: Array.from({ length: CELLS }, (_, index) => position(index)),
      culture: Array.from({ length: CELLS }, () => 1),
      h: Array.from({ length: CELLS }, () => 30),
      s: Array.from({ length: CELLS }, () => 50),
      biome: Array.from({ length: CELLS }, () => 1),
      f: Array.from({ length: CELLS }, () => 0),
      r: Array.from({ length: CELLS }, () => 0),
      fl: Array.from({ length: CELLS }, () => 0),
      t: Array.from({ length: CELLS }, () => -1)
    },
    burgs: [
      { i: 0 },
      ...[...capitals, ...candidates].map(({ burg, cell }) => ({
        i: burg,
        cell,
        x: position(cell)[0],
        y: position(cell)[1],
        population: 50,
        culture: 1,
        state: 0,
        capital: burg === 1 ? 1 : 0
      }))
    ],
    features: [],
    biomes: [],
    cultures: [
      { i: 0, name: "Wildlings", base: "ENGLI", center: 0, type: "Generic" },
      { i: 1, name: "Aeloran", base: "ENGLI", center: 40, type: "Generic" }
    ],
    states: [
      { i: 0, name: "Neutrals", salesTax: 0, pollTax: 0, treasury: 0 },
      { i: 1, name: "Aeloria", capital: 1, center: 0, culture: 1, type: "Generic", expansionism: 1 }
    ]
  } as unknown as typeof pack;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("States.expandStates with free burgs", () => {
  it("fills the map when the share is 0", () => {
    States.expandStates();

    expect([...pack.cells.state].every(state => state === 1)).toBe(true);
    expect(pack.burgs.slice(1).every(burg => burg.state === 1)).toBe(true);
  });

  it("keeps the requested share of burgs neutral, each with neutral land around it", () => {
    options.generation.states.freeBurgs = 50; // 4 candidates -> 2 are guaranteed free
    States.expandStates();

    const neutral = pack.burgs.filter(burg => burg.i && !burg.capital && burg.state === 0);
    expect(neutral.length).toBeGreaterThanOrEqual(2);
    for (const burg of neutral) expect(pack.cells.state[burg.cell]).toBe(0);

    const neutralCells = [...pack.cells.state].filter(state => state === 0).length;
    expect(neutralCells).toBeGreaterThan(4); // more than the burgs' own cells: they grew territory
  });

  it("honors a smaller share", () => {
    options.generation.states.freeBurgs = 25; // 4 candidates -> 1 is guaranteed free
    States.expandStates();

    const neutral = pack.burgs.filter(burg => burg.i && !burg.capital && burg.state === 0);
    expect(neutral.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps every candidate burg free at 100", () => {
    options.generation.states.freeBurgs = 100;
    States.expandStates();

    expect(pack.burgs.filter(burg => burg.i && !burg.capital && burg.state === 0)).toHaveLength(4);
  });

  it("keeps the same burgs free when states are redrawn", () => {
    options.generation.states.freeBurgs = 50;
    States.expandStates();
    const first = pack.burgs.filter(burg => burg.i && burg.state === 0).map(burg => burg.i);

    pack.cells.state.fill(0);
    for (const burg of pack.burgs) if (burg.i) burg.state = 0;
    States.expandStates();
    const second = pack.burgs.filter(burg => burg.i && burg.state === 0).map(burg => burg.i);

    expect(second).toEqual(first);
  });
});
