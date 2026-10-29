// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Epochs } from "./epochs-generator";

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

const cities = [
  { cell: 0, population: 100 },
  { cell: 3, population: 90 },
  { cell: 6, population: 80 },
  { cell: 9, population: 70 },
  { cell: 51, population: 60 }
];

// Minimal FlatQueue polyfill (correct, not optimised — tests only), the legacy global expandStates reads
class TestFlatQueue {
  private items: Array<{ id: number; value: number }> = [];
  get length() {
    return this.items.length;
  }
  push(id: number, value: number) {
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
    map: {
      graph: { width: 1200, height: 800 },
      cultures: { set: "world" },
      lore: {
        name: "",
        description: "",
        calendar: { year: 1000, era: "Era", eraShort: "E" },
        history: { span: 1000, realms: 0, density: 1, echoes: false, renames: false }
      }
    },
    generation: { states: { limit: 4, sizeVariety: 2, growthRate: 10 } }
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
      ...cities.map((city, index) => ({
        i: index + 1,
        cell: city.cell,
        x: position(city.cell)[0],
        y: position(city.cell)[1],
        population: city.population,
        culture: 1,
        state: 0
      }))
    ],
    features: [],
    biomes: [],
    cultures: [
      { i: 0, name: "Wildlings", base: "ENGLI", center: 0, type: "Generic" },
      { i: 1, name: "Aeloran", base: "ENGLI", center: 40, type: "Generic" }
    ],
    states: [{ i: 0, name: "Neutrals", salesTax: 0, pollTax: 0, treasury: 0 }]
  } as unknown as typeof pack;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Epochs", () => {
  it("produces contiguous epochs ending at the present", () => {
    const { epochs } = Epochs.generate(2);
    expect(epochs).toHaveLength(2);
    expect(epochs[0].from).toBe(0); // year - span
    expect(epochs[0].to).toBe(epochs[1].from);
    expect(epochs[1].to).toBe(1000);
    expect(epochs.map(epoch => epoch.snapshot)).toEqual([0, 1]);
    expect(epochs[0].era).toBeTruthy();
    expect(epochs[1].era).toBe("Era"); // the configured present age stays the present's name
  });

  it("gives every epoch a full-length snapshot of valid polity ids", () => {
    const { snapshots, polities } = Epochs.generate(2);
    const ids = new Set(polities.map(polity => polity.id));
    expect(snapshots).toHaveLength(2);
    for (const snapshot of snapshots) {
      expect(snapshot).toHaveLength(CELLS);
      for (const id of snapshot) expect(id === 0 || ids.has(id)).toBe(true);
    }
  });

  it("moves the borders between epochs", () => {
    const { snapshots } = Epochs.generate(2);
    expect(snapshots[0].some((id, cell) => id !== snapshots[1][cell])).toBe(true);
  });

  it("collapses a polity and lets the next epoch flood its land", () => {
    const { epochs, snapshots, polities } = Epochs.generate(2);
    const fallen = epochs[0].polities.find(polity => polity.fallen !== undefined);
    expect(fallen).toBeDefined();

    const heartland = Array.from(snapshots[0])
      .map((id, cell) => ({ id, cell }))
      .filter(({ id }) => id === fallen!.id);
    expect(heartland.length).toBeGreaterThan(0);

    const reclaimed = heartland.filter(({ cell }) => {
      const id = snapshots[1][cell];
      return id !== 0 && id !== fallen!.id;
    });
    expect(reclaimed.length).toBeGreaterThan(0);

    const heir = polities.find(polity => polity.successorOf === fallen!.id);
    expect(heir).toBeDefined();
  });

  it("writes the events that describe the collapse", () => {
    const { epochs, events, polities } = Epochs.generate(2);
    const collapse = events.find(event => event.type === "collapse");
    expect(collapse).toBeDefined();
    expect(collapse!.year).toBe(epochs[0].to);
    expect(collapse!.text).toBeTruthy();
    expect(collapse!.actors.length).toBeGreaterThan(1);

    const fallen = collapse!.actors[0]!;
    const heir = polities.find(polity =>
      collapse!.actors.some(ref => ref.kind === "polity" && ref.id === polity.id && polity.id !== fallen.id)
    );
    expect(heir).toBeDefined();
    expect(collapse!.text).toContain(heir!.name);
    expect(events.some(event => event.type === "independence")).toBe(true);

    const battle = events.find(event => event.type === "battle");
    expect(battle).toBeDefined();
    expect(battle!.loc).toBeTypeOf("number");
  });

  it("keeps every event reference resolvable", () => {
    const { events, polities } = Epochs.generate(2);
    const ids = new Set(polities.map(polity => polity.id));
    for (const event of events) {
      expect(event.actors.length).toBeGreaterThan(0);
      for (const ref of event.actors) {
        expect(ref.kind).toBe("polity");
        expect(ids.has(ref.id)).toBe(true);
      }
    }
  });

  it("sorts events by year with sequential ids", () => {
    const { events } = Epochs.generate(3);
    expect(events.map(event => event.i)).toEqual(events.map((_, index) => index));
    for (let i = 1; i < events.length; i++) expect(events[i].year).toBeGreaterThanOrEqual(events[i - 1].year);
  });

  it("is deterministic for the same random source", () => {
    const prng = (seed: number) => {
      let state = seed;
      return () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
      };
    };
    vi.spyOn(Math, "random").mockImplementation(prng(42));
    const first = Epochs.generate(3);
    vi.spyOn(Math, "random").mockImplementation(prng(42));
    expect(Epochs.generate(3)).toEqual(first);
  });

  it("leaves the live pack untouched", () => {
    const states = pack.states;
    const cellState = pack.cells.state;
    const burgStates = pack.burgs.map(burg => burg?.state);

    Epochs.generate(2);

    expect(pack.states).toBe(states);
    expect(pack.cells.state).toBe(cellState);
    expect(pack.burgs.map(burg => burg?.state)).toEqual(burgStates);
    expect(options.generation.states.growthRate).toBe(10);
  });
});
