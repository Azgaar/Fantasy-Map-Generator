import { beforeEach, describe, expect, it } from "vitest";
import { MIN_NAVIGABLE_FLUX } from "./river-generator";

describe("RiverModule helpers", () => {
  let Rivers: any;

  beforeEach(async () => {
    globalThis.TIME = false;
    globalThis.window = globalThis.window || ({} as any);
    globalThis.pack = {
      cells: { r: [], fl: [], f: [] },
      features: [],
      rivers: []
    } as any;

    await import("./river-generator");
    Rivers = (globalThis as any).Rivers;
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
