import { beforeEach, describe, expect, it } from "vitest";
import { clearEntityMultipliers } from "@/data/goods";
import { Goods } from "./goods-generator";

describe("remapEntityMultipliers", () => {
  it("moves a kept entity's multiplier to its new id and drops the rest", () => {
    options.map.goods = [
      { i: 1, multipliers: { state: { 2: 0, 5: 3 }, biome: { 1: 2 } } },
      { i: 2, multipliers: { state: { 5: 3 } } }
    ] as never;
    Goods.remapEntityMultipliers("state", new Map([[2, 1]]));
    expect(options.map.goods[0].multipliers).toEqual({ state: { 1: 0 }, biome: { 1: 2 } });
    expect(options.map.goods[1].multipliers).toEqual({});
  });
});

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
      features: [{ type: "land" }]
    } as any;
    options.map.goods = [
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
    ] as never;

    const { GoodsModule } = await import("./goods-generator");
    goodsModule = new GoodsModule();
    Object.assign(Goods, goodsModule);
  });

  it("matches a feature by its type or its subtype", () => {
    pack.features = [{ type: "ocean", subtype: "gulf" }] as never;
    const { type } = Goods.getMethods(0);
    expect(type("ocean")).toBe(true);
    expect(type("gulf")).toBe(true);
    expect(type("sea")).toBe(false);
  });

  it("removes a good with its deposits, the recipes taking it and its share of the run, keeping the roster for later maps", () => {
    pack.deals = [[1, 1, 1, 0, 2, 3] as never, [1, 1, 2, 0, 2, 3] as never];
    pack.burgs = [
      {
        production: [
          [1, 2],
          [2, 3]
        ]
      },
      {}
    ] as never;
    pack.markets = [
      {
        goods: { 1: { stock: 1, price: 1 }, 2: { stock: 1, price: 1 } },
        rural: {
          bought: [[1, 1]],
          kept: [
            [1, 1],
            [2, 1]
          ]
        }
      }
    ] as never;
    options.map.goods.push(
      { i: 3, name: "Made", recipes: [{ 1: 1 }, { 2: 1 }] } as never,
      { i: 4, name: "Only A", recipes: [{ 1: 1 }] } as never
    );
    const units = options.map.military.units;
    options.map.military.units = [{ name: "Guard", goods: [1, 2] }] as never;
    Goods.remove(1);
    expect(options.map.military.units[0].goods).toEqual([1, 2]);
    options.map.military.units = units;
    expect(Goods.get(1)).toBeUndefined();
    expect(Array.from(pack.cells.good)).toEqual([0, 2, 0, 2]);
    expect(Goods.get(3)?.recipes).toEqual([{ 2: 1 }]);
    expect(Goods.get(4)?.recipes).toBeUndefined();
    expect(pack.deals.map(deal => deal[2])).toEqual([2]);
    expect(pack.burgs[0].production).toEqual([[2, 3]]);
    expect(pack.burgs[1].production).toBeUndefined();
    expect(Object.keys(pack.markets[0].goods)).toEqual(["2"]);
    expect(pack.markets[0].rural).toEqual({ bought: [], kept: [[2, 1]] });
  });

  it("keeps the current catalogue when rerolling placement", () => {
    goodsModule.generate({ randomSeed: 123 });

    expect(globalThis.options.map.goods).toHaveLength(2);
    expect(globalThis.options.map.goods[0].name).toBe("Custom A");
    expect(globalThis.options.map.goods[1].name).toBe("Custom B");
  });

  it("restores the default catalogue when requested explicitly", () => {
    goodsModule.restoreDefaults();

    expect(globalThis.options.map.goods.some((good: any) => good.name === "Wood")).toBe(true);
    expect(globalThis.options.map.goods[0].name).not.toBe("Custom A");
  });

  it("restores the original defaults even after the current catalogue was edited", () => {
    goodsModule.generate();
    globalThis.options.map.goods[0].name = "Edited Wood";

    goodsModule.restoreDefaults();

    expect(globalThis.options.map.goods[0].name).toBe("Wood");
  });

  it("initialises the catalogue from defaults when none exists yet", () => {
    globalThis.options.map.goods = [];
    goodsModule.generate();

    expect(globalThis.options.map.goods.some((good: any) => good.name === "Wood")).toBe(true);
  });

  it("does not corrupt the default template when a restored good is edited", () => {
    goodsModule.restoreDefaults();
    const wood = globalThis.options.map.goods.find((good: any) => good.name === "Wood")!;
    wood.name = "Edited Wood";

    goodsModule.restoreDefaults();

    expect(globalThis.options.map.goods.find((good: any) => good.name === "Edited Wood")).toBeUndefined();
    expect(globalThis.options.map.goods.some((good: any) => good.name === "Wood")).toBe(true);
  });

  it("clears a single good when it is no longer placeable", () => {
    globalThis.options.map.goods[0].deposits = [0, 0];
    goodsModule.regeneratePlacement(1);

    const goodIds = Array.from(globalThis.pack.cells.good);
    expect(goodIds.some(id => id === 1)).toBe(false);
    expect(goodIds.filter(id => id === 2)).toHaveLength(2);
  });

  it("places as many deposits as the good's range gives", () => {
    globalThis.options.map.goods[1].deposits = [0, 0];
    goodsModule.generate({ randomSeed: 1 });

    expect(Array.from(globalThis.pack.cells.good).filter(id => id === 1)).toHaveLength(2);
    expect(Array.from(globalThis.pack.cells.good)).not.toContain(2);
  });

  it("places deposits only where the distribution allows", () => {
    globalThis.pack.cells.biome = Uint8Array.from([0, 1, 1, 0]);
    globalThis.options.map.goods[0].distribution = "biome(1)";
    globalThis.options.map.goods[1].deposits = [0, 0];
    goodsModule.generate({ randomSeed: 2 });

    expect(Array.from(globalThis.pack.cells.good)).toEqual([0, 1, 1, 0]);
  });

  it("picks a whole count within the range, rounding fractions up", () => {
    globalThis.options.map.goods[1].deposits = [0, 0];
    const placed = (deposits: [number, number]) => {
      globalThis.options.map.goods[0].deposits = deposits;
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

  it("clears only the multipliers keyed by a map's entities", () => {
    const multipliers = {
      cultureType: { Naval: 2 },
      biome: { 5: 2 },
      culture: { 1: 2 },
      state: { 3: 0 },
      religion: { 1: 2 },
      zone: { 1: 2 }
    };
    const good = { i: 1, name: "Custom", value: 777, visible: true, multipliers } as any;

    clearEntityMultipliers([good]);

    expect(good).toEqual({
      i: 1,
      name: "Custom",
      value: 777,
      visible: true,
      multipliers: { cultureType: { Naval: 2 }, biome: { 5: 2 } }
    });
  });

  it("spreads spending over options by price per coverage, cheaper ones getting more", async () => {
    const { getVarietyShares, VARIETY } = await import("./demand");
    const [cheap, dear, none] = getVarietyShares([1, 2, 0]);
    expect(cheap / dear).toBeCloseTo(2 ** VARIETY, 5); // (2 / 1)^VARIETY
    expect(cheap + dear).toBeCloseTo(1, 5);
    expect(none).toBe(0);
  });
});
