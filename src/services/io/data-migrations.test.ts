import { describe, expect, it } from "vitest";
import { applyMapDataMigrations, type MapDataMigrationContext } from "./data-migrations";

describe("applyMapDataMigrations", () => {
  it("normalizes legacy biome data before other migrations consume it", () => {
    const pack: MapDataMigrationContext["pack"] = { features: [] };
    applyMapDataMigrations({
      mapVersion: "1.138.0",
      data: ["", "", "", "#111111,#222222|20,30|removed,Custom"],
      pack,
      getDefaultBiomes: () => [
        { i: 0, name: "Ocean", color: "#000000", habitability: 0, iconsDensity: 1, icons: ["wave"], cost: 1 }
      ],
      defineLakeShoreline: () => []
    });

    expect(pack.biomes).toEqual([
      {
        i: 0,
        name: "removed",
        color: "#111111",
        habitability: 20,
        iconsDensity: 1,
        icons: ["wave"],
        cost: 1,
        removed: true
      },
      {
        i: 1,
        name: "Custom",
        color: "#222222",
        habitability: 30,
        iconsDensity: 0,
        icons: [],
        cost: 50
      }
    ]);
  });

  it("repairs lake shorelines without touching non-lake features", () => {
    const lake: { type: string; shoreline?: unknown } = { type: "lake" };
    const existing: { type: string; shoreline?: unknown } = { type: "lake", shoreline: [1] };
    const ocean: { type: string; shoreline?: unknown } = { type: "ocean" };
    applyMapDataMigrations({
      mapVersion: "1.141.0",
      data: [],
      pack: { features: [null, lake, existing, ocean] },
      getDefaultBiomes: () => [],
      defineLakeShoreline: () => [2, 3]
    });

    expect(lake.shoreline).toEqual([2, 3]);
    expect(existing.shoreline).toEqual([1]);
    expect(ocean.shoreline).toBeUndefined();
  });

  it("removes legacy state label overrides", () => {
    const pack: MapDataMigrationContext["pack"] = {
      features: [],
      states: [
        {
          i: 1,
          label: {
            text: "Old country label",
            pathPoints: [
              [0, 0],
              [1, 1]
            ]
          }
        },
        { i: 2 }
      ]
    };

    applyMapDataMigrations({
      mapVersion: "1.143.3",
      data: [],
      pack,
      getDefaultBiomes: () => [],
      defineLakeShoreline: () => []
    });

    expect(pack.states).toEqual([{ i: 1 }, { i: 2 }]);
  });
});
