import { describe, expect, it } from "vitest";
import { buildGrid } from "@/generators/grid-builder";
import type { ClimateRenderGrid } from "../render-world";
import { buildPrecipitationScene, buildTemperatureScene } from "./climate-scene";

const climate = {
  cells: {
    b: [true, true, true],
    c: [[], [], []],
    f: new Uint16Array(3),
    h: Uint8Array.from([19, 20, 40]),
    i: Uint16Array.from([0, 1, 2]),
    prec: Uint8Array.from([100, 16, 36]),
    t: new Int8Array(3),
    temp: Int8Array.from([10, 10, 10]),
    v: [[], [], []]
  },
  points: [
    [5, 5],
    [20, 30],
    [40, 50]
  ],
  requestedCells: 10_000,
  temperatureScale: "°F",
  vertices: { c: [], p: [], v: [] }
} as unknown as ClimateRenderGrid;

describe("climate scenes", () => {
  it("builds precipitation circles only for wet land cells", () => {
    const scene = buildPrecipitationScene(climate, "precipitation:1");

    expect(scene).toMatchObject({ kind: "circle-batch", layer: "precipitation", revision: "precipitation:1" });
    expect(scene.circles).toEqual([
      { domainId: 1, radius: 2, x: 20, y: 30 },
      { domainId: 2, radius: 3, x: 40, y: 50 }
    ]);
    expect(scene.bounds).toEqual({ maxX: 43, maxY: 53, minX: 18, minY: 28 });
  });

  it("always emits a full-map base temperature band for a uniform climate", () => {
    const scene = buildTemperatureScene(climate, { height: 60, width: 80 }, "temperature:1");

    expect(scene).toMatchObject({ maximum: 10, minimum: 10, step: 1 });
    expect(scene.bands.polygons).toEqual([
      {
        domainId: "temperature:base:10",
        points: [
          [0, 0],
          [80, 0],
          [80, 60],
          [0, 60]
        ],
        role: "base:10"
      }
    ]);
    expect(scene.labels.labels).toEqual([]);
  });

  it("extracts stable temperature contours from the generation-grid topology", () => {
    const generated = buildGrid({ cellsDesired: 400, graphHeight: 200, graphWidth: 300, seed: "climate-scene" });
    const count = generated.cells.i.length;
    const detailedClimate = {
      cells: {
        ...generated.cells,
        f: new Uint16Array(count),
        h: new Uint8Array(count).fill(30),
        prec: new Uint8Array(count),
        t: new Int8Array(count),
        temp: Int8Array.from(generated.points, ([x]) => Math.round(x / 30) * 5 - 25)
      },
      points: generated.points,
      requestedCells: 400,
      temperatureScale: "°C",
      vertices: generated.vertices
    } as ClimateRenderGrid;

    const first = buildTemperatureScene(detailedClimate, { height: 200, width: 300 }, "temperature:contours");
    const second = buildTemperatureScene(detailedClimate, { height: 200, width: 300 }, "temperature:contours");

    expect(first.bands.polygons.length).toBeGreaterThan(1);
    expect(first.bands).toEqual(second.bands);
    expect(first.labels).toEqual(second.labels);
    expect(first.labels.labels.every(label => label.text.endsWith("°C"))).toBe(true);
  });
});
