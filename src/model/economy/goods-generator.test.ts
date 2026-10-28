import { beforeEach, describe, expect, it } from "vitest";
import { Goods } from "./goods-generator";

describe("GoodsModule", () => {
  let goodsModule: any;

  beforeEach(async () => {
    options.map.seed = "seed";
    globalThis.window = globalThis.window || ({} as any);
    globalThis.grid = { cells: { temp: [20, 20, 20, 20] } } as any;
    globalThis.pack = {
      biomes: Array.from({ length: 20 }, (_, i) => ({ i, habitability: 50 })),
      cells: {
        i: [0, 1, 2, 3],
        biome: Uint8Array.from([0, 0, 0, 0]),
        h: Uint8Array.from([20, 20, 20, 20]),
        t: Uint16Array.from([1, 1, 1, 1]),
        r: Uint16Array.from([0, 0, 0, 0]),
        g: Uint16Array.from([0, 0, 0, 0]),
        f: Uint16Array.from([0, 0, 0, 0]),
        c: [[1], [0, 2], [1, 3], [2]],
        good: Uint16Array.from([1, 2, 1, 2])
      },
      features: [{ type: "land" }],
      goods: [
        {
          i: 1,
          name: "Custom A",
          tags: [],
          value: 1,
          unit: "unit",
          icon: "icon-a",
          color: "#ffffff",
          deposits: [2, 2],
          distribution: "true"
        },
        {
          i: 2,
          name: "Custom B",
          tags: [],
          value: 1,
          unit: "unit",
          icon: "icon-b",
          color: "#000000",
          deposits: [2, 2],
          distribution: "true"
        }
      ]
    } as any;

    const { GoodsModule } = await import("./goods-generator");
    goodsModule = new GoodsModule();
    Object.assign(Goods, goodsModule);
  });

  it("keeps the current catalogue when rerolling placement", () => {
    goodsModule.generate({ randomSeed: 123 });

    expect(globalThis.pack.goods).toHaveLength(2);
    expect(globalThis.pack.goods[0].name).toBe("Custom A");
    expect(globalThis.pack.goods[1].name).toBe("Custom B");
  });

  it("restores the default catalogue when requested explicitly", () => {
    goodsModule.restoreDefaults();

    expect(globalThis.pack.goods.some((good: any) => good.name === "Wood")).toBe(true);
    expect(globalThis.pack.goods[0].name).not.toBe("Custom A");
  });

  it("restores the original defaults even after the current catalogue was edited", () => {
    goodsModule.generate();
    globalThis.pack.goods[0].name = "Edited Wood";

    goodsModule.restoreDefaults();

    expect(globalThis.pack.goods[0].name).toBe("Wood");
  });

  it("initialises the catalogue from defaults when none exists yet", () => {
    globalThis.pack.goods = [];
    goodsModule.generate();

    expect(globalThis.pack.goods.some((good: any) => good.name === "Wood")).toBe(true);
  });

  it("does not corrupt the default template when a restored good is edited", () => {
    goodsModule.restoreDefaults();
    const wood = globalThis.pack.goods.find((good: any) => good.name === "Wood")!;
    wood.name = "Edited Wood";

    goodsModule.restoreDefaults();

    expect(globalThis.pack.goods.find((good: any) => good.name === "Edited Wood")).toBeUndefined();
    expect(globalThis.pack.goods.some((good: any) => good.name === "Wood")).toBe(true);
  });

  it("clears a single good when it is no longer placeable", () => {
    globalThis.pack.goods[0].deposits = [0, 0];
    goodsModule.regeneratePlacement(1);

    const goodIds = Array.from(globalThis.pack.cells.good);
    expect(goodIds.some(id => id === 1)).toBe(false);
    expect(goodIds.filter(id => id === 2)).toHaveLength(2);
  });

  it("places as many deposits as the good's range gives", () => {
    globalThis.pack.goods[1].deposits = [0, 0];
    goodsModule.generate({ randomSeed: 1 });

    expect(Array.from(globalThis.pack.cells.good).filter(id => id === 1)).toHaveLength(2);
    expect(Array.from(globalThis.pack.cells.good)).not.toContain(2);
  });

  it("places deposits only where the distribution allows", () => {
    globalThis.pack.cells.biome = Uint8Array.from([0, 1, 1, 0]);
    globalThis.pack.goods[0].distribution = "biome(1)";
    globalThis.pack.goods[1].deposits = [0, 0];
    goodsModule.generate({ randomSeed: 2 });

    expect(Array.from(globalThis.pack.cells.good)).toEqual([0, 1, 1, 0]);
  });

  it("picks a whole count within the range, rounding fractions up", () => {
    globalThis.pack.goods[1].deposits = [0, 0];
    const placed = (deposits: [number, number]) => {
      globalThis.pack.goods[0].deposits = deposits;
      return new Set(
        Array.from({ length: 50 }, (_, seed) => {
          goodsModule.generate({ randomSeed: seed });
          return Array.from(globalThis.pack.cells.good).filter(id => id === 1).length;
        })
      );
    };

    expect(placed([1, 3])).toEqual(new Set([1, 2, 3]));
    expect(placed([0.2, 0.4])).toEqual(new Set([1]));
    expect(placed([0, 0])).toEqual(new Set([0]));
  });

  it("places deposits until they yield the units asked, leaving other goods in place", () => {
    globalThis.pack.cells.good = Uint16Array.from([0, 0, 0, 2]);
    const placed = goodsModule.placeOutput(1, 5, () => 2);

    expect(placed).toBe(3);
    expect(Array.from(globalThis.pack.cells.good)).toEqual([1, 1, 1, 2]);
  });

  it("spreads spending over options by price per coverage, cheaper ones getting more", async () => {
    const { getVarietyShares } = await import("./goods-generator");
    const [cheap, dear, none] = getVarietyShares([1, 2, 0]);
    expect(cheap / dear).toBeCloseTo(8, 5); // (2 / 1)^3
    expect(cheap + dear).toBeCloseTo(1, 5);
    expect(none).toBe(0);
  });
});
