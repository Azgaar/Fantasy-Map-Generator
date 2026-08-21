import { describe, expect, it } from "vitest";
import type { PackedGraph } from "@/types/PackedGraph";
import { STATIC_VIEWER_WORLD } from "@/viewer/static-map-fixture";
import type { MapRenderWorld } from "../render-world";
import { buildGoodsScene, buildIceScene, buildMarketScene, type GoodsProductionSource } from "./economic-ice-scene";

const createWorld = (): MapRenderWorld => structuredClone(STATIC_VIEWER_WORLD as PackedGraph);

describe("economic and ice scenes", () => {
  it("applies stored ice offsets without mutating domain geometry", () => {
    const world = createWorld();
    world.ice = [
      {
        i: 7,
        offset: [2, -1],
        points: [
          [1, 1],
          [3, 1],
          [2, 4]
        ],
        type: "glacier"
      }
    ];

    const scene = buildIceScene(world, "ice:1");

    expect(scene.domainIds).toEqual([7]);
    expect(scene.polygons[0]).toMatchObject({
      points: [
        [3, 0],
        [5, 0],
        [4, 3]
      ],
      role: "glacier"
    });
    expect(world.ice[0].points[0]).toEqual([1, 1]);
  });

  it("builds visible goods cells, resource icons, and burg production plates", () => {
    const world = createWorld();
    world.goods = [
      { color: "#996633", i: 1, icon: "good-wood", name: "Wood", tags: [], unit: "pile", value: 1, visible: true },
      { color: "#cccccc", i: 2, icon: "good-stone", name: "Stone", tags: [], unit: "pile", value: 1 }
    ];
    world.cells.good = Uint16Array.from([1, 2]);
    world.burgs = [0 as never, { cell: 0, i: 1, production: [] as never[], x: 20, y: 10 }];
    const production: GoodsProductionSource = {
      getBurgProduction: () => ({ 1: 4, 2: 20 }),
      getCellProduction: (cellId): Record<number, number> => (cellId === 0 ? { 1: 2, 2: 9 } : {})
    };

    const scene = buildGoodsScene(world, production, 3);

    expect(scene.cells).toHaveLength(1);
    expect(scene.icons).toEqual([expect.objectContaining({ cellId: 0, goodId: 1, icon: "good-wood" })]);
    expect(scene.burgs[0]).toMatchObject({ burgId: 1, entries: [{ goodId: 1, value: 4 }] });
  });

  it("builds market territories, external borders, and centers with stable IDs", () => {
    const world = createWorld();
    world.cells.market = Uint16Array.from([1, 1]);
    world.burgs = [0 as never, { cell: 0, i: 1, x: 10, y: 20 }];
    world.markets = [{ centerBurgId: 1, color: "#dababf", goods: {}, i: 1 }];

    const scene = buildMarketScene(world, "markets:1");

    expect(scene.markets[0]).toMatchObject({ center: { burgId: 1, x: 10, y: 20 }, marketId: 1 });
    expect(scene.markets[0].polygons).toHaveLength(2);
    expect(scene.markets[0].borders.length).toBeGreaterThan(0);
    expect(scene.markets[0].polygons.map(polygon => polygon.domainId)).toEqual(["1:0", "1:1"]);
  });
});
