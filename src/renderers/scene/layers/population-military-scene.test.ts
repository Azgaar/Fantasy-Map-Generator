import { describe, expect, it } from "vitest";
import type { PackedGraph } from "@/types/PackedGraph";
import { STATIC_VIEWER_WORLD } from "@/viewer/static-map-fixture";
import type { MapRenderWorld } from "../render-world";
import { buildMilitaryScene, buildPopulationScene } from "./population-military-scene";

const createWorld = (): MapRenderWorld => structuredClone(STATIC_VIEWER_WORLD as PackedGraph);

describe("population and military scenes", () => {
  it("builds rural and urban population lines from domain values", () => {
    const world = createWorld();
    world.cells.pop = Uint8Array.from([10, 0]);
    world.burgs = [0 as never, { cell: 1, i: 1, population: 20, x: 40, y: 30 }];

    const scene = buildPopulationScene(world, 2, "population:1");

    expect(scene.domainIds).toEqual(["rural:0", "urban:1"]);
    expect(scene.paths[0]).toMatchObject({
      points: [
        [33, 30],
        [33, 28]
      ],
      role: "rural"
    });
    expect(scene.paths[1]).toMatchObject({
      points: [
        [40, 30],
        [40, 22]
      ],
      role: "urban"
    });
  });

  it("builds stable regiment badges and formats large totals", () => {
    const world = createWorld();
    world.states = [
      {} as never,
      {
        color: "#6699cc",
        i: 1,
        military: [
          {
            a: 1_200,
            angle: 15,
            bx: 10,
            by: 20,
            cell: 0,
            i: 3,
            icon: "⚓",
            n: 1,
            name: "Fleet",
            s: 0,
            state: 1,
            t: 1_200,
            type: "naval",
            u: {},
            x: 10,
            y: 20
          }
        ]
      } as never
    ];

    const scene = buildMilitaryScene(world, "military:1");

    expect(scene.domainIds).toEqual(["1:3"]);
    expect(scene.regiments[0]).toMatchObject({
      angle: 15,
      color: "#6699cc",
      domainId: "1:3",
      icon: "⚓",
      naval: true,
      regimentId: 3,
      stateId: 1,
      text: "1.2K",
      x: 10,
      y: 20
    });
  });
});
