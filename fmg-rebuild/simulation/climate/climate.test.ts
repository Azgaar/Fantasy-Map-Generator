import { describe, it, expect } from "vitest";
import { generateJitteredGrid } from "../grid/grid-generator";
import { generateClimate, ClimateOptions } from "./climate-generator";

describe("Climate Generator", () => {
  it("should generate temperature and precipitation maps", () => {
    const grid = generateJitteredGrid(800, 600, 1000, "climate-test-seed");
    const pointsN = grid.points.length;
    const heights = new Uint8Array(pointsN).fill(25); // Land elevation

    const options: ClimateOptions = {
      temperatureEquator: 27,
      temperatureNorthPole: -30,
      temperatureSouthPole: -15,
      winds: [225, 45, 225, 315, 135, 315], // standard winds
      precInput: 100
    };

    const { temp, prec } = generateClimate(grid, heights, 800, 600, options);

    expect(temp.length).toBe(pointsN);
    expect(prec.length).toBe(pointsN);

    // Latitude gradient check: cells closer to the top (y -> 0, north latitude)
    // should generally be colder than equator latitude
    let northPoleIndex = -1;
    let equatorIndex = -1;

    for (let i = 0; i < pointsN; i++) {
      const [, y] = grid.points[i];
      if (y < 50 && northPoleIndex === -1) northPoleIndex = i;
      if (Math.abs(y - 300) < 20 && equatorIndex === -1) equatorIndex = i;
    }

    if (northPoleIndex !== -1 && equatorIndex !== -1) {
      expect(temp[northPoleIndex]).toBeLessThan(temp[equatorIndex]);
    }
  });
});
