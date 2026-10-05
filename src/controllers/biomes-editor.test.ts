import { describe, expect, test } from "vitest";
import type { Biome } from "@/generators/biomes-generator";
import { collectBiomeStatistics } from "./biomes-editor";

const createBiome = (i: number): Biome => ({
  i,
  name: `Biome ${i}`,
  color: `#00000${i}`,
  habitability: 50,
  iconsDensity: 0,
  icons: {},
  cost: 50
});

describe("biome editor operations", () => {
  test("calculates statistics without mutating biome definitions", () => {
    const biomes = [createBiome(0), createBiome(1), createBiome(2)];
    const originalBiomes = structuredClone(biomes);
    const source: Parameters<typeof collectBiomeStatistics>[0] = {
      biomes,
      cells: {
        i: [0, 1, 2, 3],
        h: Uint8Array.from([10, 20, 30, 30]),
        biome: Uint8Array.from([0, 1, 1, 2]),
        area: Uint16Array.from([5, 10, 20, 30]),
        pop: Float32Array.from([0, 2, 3, 4]),
        burg: Uint16Array.from([0, 1, 0, 2])
      },
      burgs: [{}, { population: 10 }, { population: 5 }]
    };

    expect(collectBiomeStatistics(source)).toEqual([
      { cells: 0, area: 0, rural: 0, urban: 0 },
      { cells: 2, area: 30, rural: 5, urban: 10 },
      { cells: 1, area: 30, rural: 4, urban: 5 }
    ]);
    expect(biomes).toEqual(originalBiomes);
  });
});
