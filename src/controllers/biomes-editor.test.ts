import { describe, expect, test } from "vitest";
import type { Biome } from "@/generators/biomes-generator";
import { collectBiomeStatistics, createCustomBiome, removeCustomBiome } from "./biomes-editor";

const createBiome = (i: number): Biome => ({
  i,
  name: `Biome ${i}`,
  color: `#00000${i}`,
  habitability: 50,
  iconsDensity: 0,
  icons: [],
  cost: 50
});

describe("biome editor operations", () => {
  test("creates a custom biome at the next stable index", () => {
    const biomes = Array.from({ length: 13 }, (_, i) => createBiome(i));

    const biome = createCustomBiome(biomes, "#123456");

    expect(biome).toEqual({
      i: 13,
      name: "Custom",
      color: "#123456",
      habitability: 50,
      iconsDensity: 0,
      icons: [],
      cost: 50
    });
    expect(biomes[13]).toBe(biome);
    expect(biome).not.toHaveProperty("cells");
    expect(biome).not.toHaveProperty("area");
    expect(biome).not.toHaveProperty("rural");
    expect(biome).not.toHaveProperty("urban");
  });

  test("does not create more than 255 indexed biomes", () => {
    const biomes = Array.from({ length: 255 }, (_, i) => createBiome(i));

    expect(createCustomBiome(biomes, "#123456")).toBeNull();
    expect(biomes).toHaveLength(255);
  });

  test("removes only unassigned custom biomes", () => {
    const biomes = Array.from({ length: 15 }, (_, i) => createBiome(i));
    const assignments = Uint8Array.from([1, 13]);

    expect(removeCustomBiome(biomes, assignments, 12)).toBe(false);
    expect(removeCustomBiome(biomes, assignments, 13)).toBe(false);
    expect(removeCustomBiome(biomes, assignments, 14)).toBe(true);
    expect(biomes[14].removed).toBe(true);
    expect(removeCustomBiome(biomes, assignments, 14)).toBe(false);
  });

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
