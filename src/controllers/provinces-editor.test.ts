import { describe, expect, test } from "vitest";
import { collectProvinceStatistics } from "./provinces-editor";

describe("provinces editor statistics", () => {
  test("finds the dominant culture from rural and urban population", () => {
    const statistics = collectProvinceStatistics({
      cells: {
        i: [0, 1, 2],
        province: Uint16Array.from([1, 1, 2]),
        culture: Uint16Array.from([1, 2, 3]),
        area: Uint16Array.from([10, 20, 30]),
        pop: Float32Array.from([60, 50, 0]),
        burg: Uint16Array.from([1, 0, 0])
      },
      burgs: [{}, { population: 10 }],
      urbanization: 2
    });

    expect(statistics.get(1)).toEqual({
      area: 30,
      rural: 110,
      urban: 10,
      burgs: [1],
      dominantCulture: { cultureId: 1, percentage: (80 / 130) * 100 }
    });
    expect(statistics.get(2)).toEqual({ area: 30, rural: 0, urban: 0, burgs: [] });
  });

  test("uses the lower culture id to break an exact population tie", () => {
    const statistics = collectProvinceStatistics({
      cells: {
        i: [0, 1],
        province: Uint16Array.from([1, 1]),
        culture: Uint16Array.from([2, 1]),
        area: Uint16Array.from([1, 1]),
        pop: Float32Array.from([10, 10]),
        burg: Uint16Array.from([0, 0])
      },
      burgs: [{}],
      urbanization: 1
    });

    expect(statistics.get(1)?.dominantCulture).toEqual({ cultureId: 1, percentage: 50 });
  });

  test("treats culture 0 as a valid dominant culture", () => {
    const statistics = collectProvinceStatistics({
      cells: {
        i: [0],
        province: Uint16Array.from([1]),
        culture: Uint16Array.from([0]),
        area: Uint16Array.from([1]),
        pop: Float32Array.from([10]),
        burg: Uint16Array.from([0])
      },
      burgs: [{}],
      urbanization: 1
    });

    expect(statistics.get(1)?.dominantCulture).toEqual({ cultureId: 0, percentage: 100 });
  });
});
