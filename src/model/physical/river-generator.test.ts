import { beforeEach, describe, expect, it } from "vitest";
import { MIN_NAVIGABLE_FLUX, Rivers } from "./river-generator";

describe("RiverModule helpers", () => {
  beforeEach(async () => {
    globalThis.TIME = false;
    globalThis.window = globalThis.window || ({} as any);
    globalThis.pack = {
      cells: { r: [], fl: [], f: [] },
      features: [],
      rivers: []
    } as any;

    await import("./river-generator");
  });

  function setCells(cells: { r?: number[]; fl?: number[]; f?: number[] }) {
    globalThis.pack.cells = { r: [], fl: [], f: [], ...cells } as any;
  }

  describe("isNavigable", () => {
    it("returns true when cell has a river and flux meets the threshold", () => {
      setCells({ r: [0, 1, 1], fl: [0, MIN_NAVIGABLE_FLUX, MIN_NAVIGABLE_FLUX + 50] });
      expect(Rivers.isNavigable(1)).toBe(true);
      expect(Rivers.isNavigable(2)).toBe(true);
    });

    it("returns false for cells with no river", () => {
      setCells({ r: [0, 0], fl: [500, 500] });
      expect(Rivers.isNavigable(0)).toBe(false);
    });

    it("returns false for river cells below the threshold", () => {
      setCells({ r: [0, 1], fl: [0, MIN_NAVIGABLE_FLUX - 1] });
      expect(Rivers.isNavigable(1)).toBe(false);
    });
  });

  describe("resolveDrainFeature", () => {
    it("returns the ocean feature id when river drains into the sea", () => {
      // cell 5 is the river-bearing land cell; cell 6 is the sea cell at the mouth
      setCells({ r: [0, 0, 0, 0, 0, 1, 0], f: [0, 0, 0, 0, 0, 0, 2] });
      globalThis.pack.features = [null, null, { i: 2, type: "ocean" }] as any;
      globalThis.pack.rivers = [{ i: 1, cells: [5, 6] }] as any;

      expect(Rivers.resolveDrainFeature(5)).toBe(2);
    });

    it("returns the closed lake feature id when river terminates in a closed lake", () => {
      setCells({ r: [0, 0, 1, 0], f: [0, 0, 0, 3] });
      globalThis.pack.features = [
        null,
        null,
        null,
        { i: 3, type: "lake" } // no outlet => closed
      ] as any;
      globalThis.pack.rivers = [{ i: 1, cells: [2, 3] }] as any;

      expect(Rivers.resolveDrainFeature(2)).toBe(3);
    });

    it("follows lake outlet onward to the final receiving sea", () => {
      // river 1 ends in lake (feature 3, has outlet to river 2); river 2 ends in ocean (feature 4)
      setCells({ r: [0, 1, 0, 2, 0], f: [0, 0, 3, 0, 4] });
      globalThis.pack.features = [null, null, null, { i: 3, type: "lake", outlet: 2 }, { i: 4, type: "ocean" }] as any;
      globalThis.pack.rivers = [
        { i: 1, cells: [1, 2] },
        { i: 2, cells: [3, 4] }
      ] as any;

      expect(Rivers.resolveDrainFeature(1)).toBe(4);
    });

    it("returns null when river leaves the map", () => {
      setCells({ r: [0, 1], f: [0, 0] });
      globalThis.pack.features = [null, null] as any;
      globalThis.pack.rivers = [{ i: 1, cells: [1, -1] }] as any;

      expect(Rivers.resolveDrainFeature(1)).toBeNull();
    });

    it("returns null for a cell with no river", () => {
      setCells({ r: [0, 0] });
      expect(Rivers.resolveDrainFeature(0)).toBeNull();
    });
  });

  describe("resolveLakeDrainFeature", () => {
    it("returns the ocean feature id when the lake outlet chain reaches the sea", () => {
      // lake feature 2 has outlet river 1; river 1 ends in ocean feature 3
      setCells({ r: [0, 1, 0], f: [0, 0, 3] });
      globalThis.pack.features = [null, null, { i: 2, type: "lake", outlet: 1 }, { i: 3, type: "ocean" }] as any;
      globalThis.pack.rivers = [{ i: 1, cells: [1, 2] }] as any;

      expect(Rivers.resolveLakeDrainFeature(2)).toBe(3);
    });

    it("follows a chain through an intermediate open lake to reach the ocean", () => {
      // lake 2 → river 1 → lake 3 (open) → river 2 → ocean 4
      setCells({ r: [0, 1, 0, 2, 0], f: [0, 0, 3, 0, 4] });
      globalThis.pack.features = [
        null,
        null,
        { i: 2, type: "lake", outlet: 1 },
        { i: 3, type: "lake", outlet: 2 },
        { i: 4, type: "ocean" }
      ] as any;
      globalThis.pack.rivers = [
        { i: 1, cells: [1, 2] }, // river 1 drains lake 2 into lake 3
        { i: 2, cells: [3, 4] } // river 2 drains lake 3 into ocean 4
      ] as any;

      expect(Rivers.resolveLakeDrainFeature(2)).toBe(4);
    });

    it("returns the closed downstream lake feature id when the chain terminates there", () => {
      // lake 2 (open) → river 1 → lake 3 (closed, no outlet)
      setCells({ r: [0, 1, 0], f: [0, 0, 3] });
      globalThis.pack.features = [
        null,
        null,
        { i: 2, type: "lake", outlet: 1 },
        { i: 3, type: "lake" } // no outlet — closed
      ] as any;
      globalThis.pack.rivers = [{ i: 1, cells: [1, 2] }] as any;

      expect(Rivers.resolveLakeDrainFeature(2)).toBe(3);
    });

    it("returns null when the outlet river exits the map", () => {
      setCells({ r: [0, 1], f: [0, 0] });
      globalThis.pack.features = [null, null, { i: 2, type: "lake", outlet: 1 }] as any;
      globalThis.pack.rivers = [{ i: 1, cells: [1, -1] }] as any;

      expect(Rivers.resolveLakeDrainFeature(2)).toBeNull();
    });

    it("returns the lake's own feature id when the lake has no outlet (closed lake)", () => {
      globalThis.pack.features = [null, null, { i: 2, type: "lake" }] as any;
      globalThis.pack.rivers = [] as any;

      expect(Rivers.resolveLakeDrainFeature(2)).toBe(2);
    });

    it("returns null for a non-lake feature id", () => {
      globalThis.pack.features = [null, null, { i: 2, type: "ocean" }] as any;
      globalThis.pack.rivers = [] as any;

      expect(Rivers.resolveLakeDrainFeature(2)).toBeNull();
    });

    it("returns null for an unknown feature id", () => {
      globalThis.pack.features = [null] as any;
      globalThis.pack.rivers = [] as any;

      expect(Rivers.resolveLakeDrainFeature(99)).toBeNull();
    });
  });
});

describe("RiverModule.rename", () => {
  it("renames a river by id and keeps its custom label pattern", async () => {
    await import("./river-generator");
    globalThis.pack = { rivers: [{ i: 7, name: "Ald", type: "River", label: { text: "Ald Falls" } }] } as any;
    Rivers.rename(7, "Brae");
    expect(pack.rivers[0]).toMatchObject({ name: "Brae", label: { text: "Brae Falls" } });
    expect(() => Rivers.rename(1, "X")).toThrow("River 1 does not exist");
  });
});

describe("locked rivers", () => {
  type LockedRiver = import("./river-generator").LockedRiver;
  type River = import("./river-generator").River;
  type Internals = { mergeLocked(locked: LockedRiver[]): void; linkLockedLakes(locked: LockedRiver[]): void };
  let internals: Internals;

  // cells 0-10 are land on a line, cell 11 is the sea
  const heights = [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 10];
  const river = (i: number, cells: number[], data: Partial<River> = {}) =>
    ({ i, cells, parent: i, widthFactor: 1, sourceWidth: 0, ...data }) as River;

  beforeEach(async () => {
    globalThis.TIME = false;
    globalThis.window = globalThis.window || ({} as typeof window);
    globalThis.pack = {
      cells: {
        i: heights.map((_, i) => i),
        p: heights.map((_, i) => [i * 10, 10]),
        h: Uint8Array.from(heights),
        f: Uint16Array.from(heights.map(h => (h < 20 ? 2 : 1))),
        fl: Uint16Array.from([1, 1, 1, 1, 9, 9, 9, 9, 4, 4, 4, 0]),
        r: new Uint16Array(heights.length),
        conf: new Uint8Array(heights.length)
      },
      features: [0, { i: 1, type: "island" }, { i: 2, type: "ocean" }],
      rivers: []
    } as unknown as typeof pack;
    await import("./river-generator");
    internals = Rivers as unknown as Internals;
  });

  it("drops a generated river along a locked course and cuts one reaching it into its tributary", () => {
    const locked = river(1, [0, 1, 2, 3, 11], { parent: 3, name: "Kept" });
    pack.rivers = [
      river(5, [1, 2, 3, 11]), // along the locked course
      river(6, [4, 5, 6, 2, 3, 11]), // reaches it at cell 2
      river(7, [7, 1, 3]), // reaches it too soon to stay a river
      river(8, [8, 9, 10, 11]) // apart
    ];

    internals.mergeLocked([{ river: locked, flux: [5, 6, 7, 8, 0] }]);

    expect(pack.rivers.map(r => r.i)).toEqual([1, 6, 8]);
    expect(pack.rivers[0]).toMatchObject({ name: "Kept", parent: 1 }); // it reaches the sea: a mainstem
    expect(pack.rivers[1]).toMatchObject({ cells: [4, 5, 6, 2], mouth: 6, discharge: 9, parent: 1 });
    expect(Array.from(pack.cells.r)).toEqual([1, 1, 1, 1, 6, 6, 6, 0, 8, 8, 8, 0]);
    expect(Array.from(pack.cells.conf)).toEqual([0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(Array.from(pack.cells.fl).slice(0, 4)).toEqual([5, 6, 7, 8]); // as before, never less downstream
  });

  it("lets a locked tributary join a generated river without cutting it", () => {
    const locked = river(1, [0, 1, 9], { parent: 4 });
    pack.rivers = [river(8, [8, 9, 10, 11])];

    internals.mergeLocked([{ river: locked, flux: [0, 0, 0] }]);

    expect(pack.rivers[1].cells).toEqual([8, 9, 10, 11]);
    expect(pack.cells.r[9]).toBe(8); // the junction belongs to the river flowing through it
    expect(pack.cells.conf[9]).toBe(1);
    expect(locked.parent).toBe(8);
  });

  it("keeps a locked parent", () => {
    const main = river(1, [0, 1, 2, 11]);
    const tributary = river(2, [5, 4, 3, 1], { parent: 1 });

    internals.mergeLocked([
      { river: main, flux: [] },
      { river: tributary, flux: [] }
    ]);

    expect(tributary.parent).toBe(1);
    expect(pack.cells.r[1]).toBe(1);
  });

  it("lists a locked river in the lakes it flows out of and into", () => {
    pack.cells.f = Uint16Array.from([3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 2]);
    pack.features = [
      0,
      { i: 1, type: "island" },
      { i: 2, type: "ocean" },
      { i: 3, type: "lake" },
      { i: 4, type: "lake", inlets: [7] }
    ] as unknown as typeof pack.features;

    internals.linkLockedLakes([{ river: river(1, [0, 1, 2, 10]), flux: [] }]);

    expect(pack.features[3].outlet).toBe(1);
    expect(pack.features[4].inlets).toEqual([7, 1]);
  });

  it("captures the flux along locked rivers for a regeneration", () => {
    pack.rivers = [river(1, [4, 5, -1], { lock: true }), river(2, [6, 7])];

    expect(Rivers.getLocked()).toEqual([{ river: pack.rivers[0], flux: [9, 9, 0] }]);
  });

  it("keeps the name and type of a locked river when rivers are specified", () => {
    pack.rivers = [river(1, [0, 1, 11], { name: "Kept", type: "Brook", lock: true, mouth: 1 })];

    Rivers.specify();

    expect(pack.rivers[0]).toMatchObject({ name: "Kept", type: "Brook" });
  });

  it("locks and unlocks a river", () => {
    pack.rivers = [river(1, [0, 1])];
    Rivers.setLocked(1, true);
    expect(pack.rivers[0].lock).toBe(true);
    Rivers.setLocked(1, false);
    expect(pack.rivers[0]).not.toHaveProperty("lock");
    expect(() => Rivers.setLocked(9, true)).toThrow();
  });
});
