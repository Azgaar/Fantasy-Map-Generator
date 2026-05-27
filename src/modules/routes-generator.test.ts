import { beforeEach, describe, expect, it } from "vitest";
import { MIN_NAVIGABLE_FLUX } from "./river-generator";

describe("RoutesModule river-aware water cost", () => {
  let Routes: any;

  beforeEach(async () => {
    globalThis.TIME = false;
    globalThis.window = globalThis.window || ({} as any);
    // Defaults overridden per-test; needs to exist before module import so window.Routes wires up
    globalThis.pack = {
      cells: {
        h: [] as number[],
        r: [] as number[],
        fl: [] as number[],
        p: [] as [number, number][],
        t: [] as number[],
        g: [] as number[]
      },
      rivers: [],
      routes: []
    } as any;
    globalThis.grid = { cells: { temp: [20, 20, 20, 20, 20, 20, 20, 20] } } as any;

    await import("./routes-generator");
    Routes = (globalThis as any).Routes;
  });

  function setupTwoRiverPack() {
    // Layout: two parallel rivers (A: cells 1->2, B: cells 3->4), both with flux >= threshold.
    // Cells 2 and 3 are voronoi-neighbors (banks face each other across a watershed) but they
    // belong to different rivers and must NOT be river-adjacent.
    globalThis.pack.cells = {
      h: [20, 25, 25, 25, 25, 5], // 5 is sea
      r: [0, 1, 1, 2, 2, 0],
      fl: [0, MIN_NAVIGABLE_FLUX, MIN_NAVIGABLE_FLUX + 50, MIN_NAVIGABLE_FLUX, MIN_NAVIGABLE_FLUX + 50, 0],
      p: [
        [0, 0],
        [10, 0],
        [20, 0],
        [10, 5],
        [20, 5],
        [30, 0]
      ],
      t: [1, 1, 1, 1, 1, -1],
      g: [0, 0, 0, 0, 0, 0]
    } as any;
    // River A flows 1 -> 2 -> 5 (sea); River B flows 3 -> 4 -> 5 (sea)
    globalThis.pack.rivers = [
      { i: 1, cells: [1, 2, 5] },
      { i: 2, cells: [3, 4, 5] }
    ] as any;
    Routes.sync();
  }

  it("allows a step along the river course above the flux threshold", () => {
    setupTwoRiverPack();
    expect(Routes.getWaterPathCost(1, 2)).toBeLessThan(Infinity);
    expect(Routes.getWaterPathCost(2, 1)).toBeLessThan(Infinity);
  });

  it("rejects a step between voronoi-adjacent cells of different rivers", () => {
    setupTwoRiverPack();
    expect(Routes.getWaterPathCost(2, 3)).toBe(Infinity);
    expect(Routes.getWaterPathCost(3, 2)).toBe(Infinity);
  });

  it("rejects a step onto a river cell with flux below the threshold", () => {
    globalThis.pack.cells = {
      h: [20, 25, 25],
      r: [0, 1, 1],
      fl: [0, MIN_NAVIGABLE_FLUX, MIN_NAVIGABLE_FLUX - 1],
      p: [
        [0, 0],
        [10, 0],
        [20, 0]
      ],
      t: [1, 1, 1],
      g: [0, 0, 0]
    } as any;
    globalThis.pack.rivers = [{ i: 1, cells: [1, 2] }] as any;
    Routes.sync();

    expect(Routes.getWaterPathCost(1, 2)).toBe(Infinity);
  });

  it("permits the river mouth ↔ sea transition", () => {
    setupTwoRiverPack();
    expect(Routes.getWaterPathCost(2, 5)).toBeLessThan(Infinity);
    expect(Routes.getWaterPathCost(5, 2)).toBeLessThan(Infinity);
  });

  it("allows a coastal non-river land cell to exit to any adjacent water cell", () => {
    // cell 0 is a coastal port (land, no river); cells 1 and 2 are adjacent sea cells
    globalThis.pack.cells = {
      h: [25, 5, 5],
      r: [0, 0, 0],
      fl: [0, 0, 0],
      p: [
        [0, 0],
        [10, 0],
        [0, 10]
      ],
      t: [1, -1, -1],
      g: [0, 0, 0]
    } as any;
    globalThis.pack.rivers = [] as any;
    Routes.sync();

    expect(Routes.getWaterPathCost(0, 1)).toBeLessThan(Infinity);
    expect(Routes.getWaterPathCost(0, 2)).toBeLessThan(Infinity);
  });

  it("rejects exit from a river-mouth land cell into a non-mouth water cell", () => {
    // River 1 mouth at cell 2; recorded sea exit is cell 5.
    // Cell 6 is a sea cell also voronoi-adjacent to the mouth but not the recorded outlet.
    globalThis.pack.cells = {
      h: [25, 25, 25, 5, 5, 5, 5],
      r: [0, 1, 1, 0, 0, 0, 0],
      fl: [0, MIN_NAVIGABLE_FLUX, MIN_NAVIGABLE_FLUX + 50, 0, 0, 0, 0],
      p: [
        [0, 0],
        [10, 0],
        [20, 0],
        [25, 0],
        [25, 5],
        [25, -5],
        [30, 0]
      ],
      t: [1, 1, 1, -1, -1, -1, -2],
      g: [0, 0, 0, 0, 0, 0, 0]
    } as any;
    globalThis.pack.rivers = [{ i: 1, cells: [1, 2, 5] }] as any;
    Routes.sync();

    expect(Routes.getWaterPathCost(2, 5)).toBeLessThan(Infinity); // recorded outlet — allowed
    expect(Routes.getWaterPathCost(2, 6)).toBe(Infinity); // adjacent water but not the river's outlet
  });

  it("rejects land cells that are not on a river at all", () => {
    globalThis.pack.cells = {
      h: [20, 25, 25],
      r: [0, 0, 1],
      fl: [0, 0, MIN_NAVIGABLE_FLUX],
      p: [
        [0, 0],
        [10, 0],
        [20, 0]
      ],
      t: [1, 1, 1],
      g: [0, 0, 0]
    } as any;
    globalThis.pack.rivers = [{ i: 1, cells: [2] }] as any;
    Routes.sync();

    expect(Routes.getWaterPathCost(0, 1)).toBe(Infinity);
  });
});
