import { beforeEach, expect, it } from "vitest";
import { Options } from "@/model/options/options-model";
import { collectDevelopmentStatistics } from "./development-editor";

beforeEach(() => {
  options = Options.getDefaultOptions();
  options.map.units.population.scale = 1;
  options.map.units.population.urbanization.rate = 1;
});

it("counts land by era and weighs the average by people, rural and urban", () => {
  const statistics = collectDevelopmentStatistics({
    cells: {
      i: [0, 1, 2, 3],
      area: Uint16Array.from([5, 10, 20, 30]),
      pop: Float32Array.from([0, 2, 2, 4]),
      burg: Uint16Array.from([0, 1, 0, 0]),
      development: Uint8Array.from([0, 30, 31, 12])
    },
    burgs: [undefined, { population: 4 }]
  });

  expect(statistics.cells).toBe(3);
  expect(statistics.eras[10]).toEqual({ cells: 2, area: 30, rural: 4, urban: 4, burgs: 1 }); // High Middle Ages, 30–32
  expect(statistics.eras[4]).toEqual({ cells: 1, area: 30, rural: 4, urban: 0, burgs: 0 }); // Bronze Age, 12–14
  expect(statistics.mean).toBe((2 * 30 + 4 * 30 + 2 * 31 + 4 * 12) / 12);
  expect([statistics.min, statistics.max]).toEqual([12, 31]);
});
