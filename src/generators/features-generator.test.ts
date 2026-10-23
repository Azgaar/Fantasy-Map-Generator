import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Feature } from "./features-generator";

describe("feature naming", () => {
  beforeAll(async () => {
    await import("./features-generator");
  });

  beforeEach(() => {
    // cells: 0 island (culture 1), 1 land shore of the lake (culture 2), 2 lake, 3 ocean
    globalThis.pack = {
      cells: {
        i: [0, 1, 2, 3],
        culture: [1, 2, 0, 0],
        p: [
          [10, 10],
          [20, 10],
          [30, 10],
          [5, 50]
        ]
      },
      cultures: [{ base: 0 }, { base: 1 }, { base: 2 }],
      features: [
        undefined,
        { i: 1, type: "island", firstCell: 0 },
        { i: 2, type: "lake", firstCell: 2, shoreline: [1] },
        { i: 3, type: "ocean", firstCell: 3, cells: 50 },
        { i: 4, type: "ocean", firstCell: 3, cells: 1, name: "Kept Sea" }
      ]
    } as unknown as typeof pack;
    globalThis.grid = { cells: { i: new Array(1000) } } as unknown as typeof grid;
    globalThis.options = { map: { seed: "1", graph: { width: 100, height: 100 } } } as unknown as typeof options;
    globalThis.Names = { getCulture: (culture: number) => `name-of-${culture}` } as unknown as typeof Names;
  });

  it("takes the culture of the first cell for islands and of a shore cell for lakes", () => {
    Math.random = () => 0.5; // no adjective roll
    expect(Features.getName(pack.features[1])).toBe("name-of-1");
    expect(Features.getName(pack.features[2])).toBe("name-of-2");
  });

  it("sizes the ocean subtype by cell count", () => {
    expect(Features.getOceanSubtype(pack.features[3])).toBe("ocean");
    expect(Features.getOceanSubtype({ cells: 5 } as Feature)).toBe("sea");
    expect(Features.getOceanSubtype(pack.features[4])).toBe("gulf");
  });

  it("names oceans with an adjective or a map side instead of a culture name", () => {
    for (let i = 0; i < 20; i++) {
      expect(Features.getName(pack.features[3])).toMatch(/^(\w+|Western|Eastern|Northern|Southern)$/);
      expect(Features.getName(pack.features[3])).not.toMatch(/^name-of-/);
    }
  });

  it("names only the features without a name", () => {
    Features.defineNames();
    expect(pack.features[1].name).toBe("name-of-1");
    expect(pack.features[3].name).toBeTruthy();
    expect(pack.features[3].name).not.toMatch(/^name-of-/);
    expect(pack.features[4].name).toBe("Kept Sea");
  });
});
