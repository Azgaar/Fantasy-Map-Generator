import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LegendItem } from "@/types/legend";
import { notify } from "@/utils/notices";
import { Layers } from "./layers";
import { getAltitudeBands, LegendBoxes } from "./legend-boxes";

vi.mock("./layers", () => ({ Layers: { draw: vi.fn() } }));
vi.mock("@/utils/notices", () => ({ notify: vi.fn() }));
vi.mock("@/renderers/legend-positions", () => ({ legendPositions: { release: vi.fn() } }));

describe("LegendBoxes", () => {
  const items: LegendItem[] = [[1, "#ff0000", "Alpha"]];

  beforeEach(() => {
    globalThis.pack = { legends: [] } as unknown as typeof pack;
    vi.mocked(Layers.draw).mockClear();
    vi.mocked(notify).mockClear();
  });

  it("toggles a box in the map data and draws the legend layer each time", () => {
    LegendBoxes.toggle("States", () => items, "No states");
    expect(pack.legends).toEqual([{ name: "States", items }]);

    LegendBoxes.toggle("States", () => items, "No states");
    expect(pack.legends).toEqual([]);
    expect(Layers.draw).toHaveBeenCalledTimes(2);
    expect(Layers.draw).toHaveBeenCalledWith("legend");
  });

  it("reports a box with nothing to list instead of showing it", () => {
    LegendBoxes.toggle("States", () => [], "No states");
    expect(pack.legends).toEqual([]);
    expect(notify).toHaveBeenCalledWith("No states", "error");
  });

  it("hides the named box alone", () => {
    pack.legends = [
      { name: "States", items },
      { name: "Zones", items }
    ];
    LegendBoxes.hide("States");
    expect(pack.legends).toEqual([{ name: "Zones", items }]);
  });
});

// the generator formulas at the default exponent, with values in meters
const landHeight = (meters: number) => 18 + Math.sqrt(meters);
const oceanHeight = (depth: number) => 1000 / (50 + depth);

const bounds = (bands: { from: number; to?: number }[]) => bands.map(({ from, to }) => [from, to]);

describe("getAltitudeBands", () => {
  it("splits the land at round heights, from sea level to an open-ended top", () => {
    expect(bounds(getAltitudeBands(100, landHeight))).toEqual([
      [0, 100],
      [100, 200],
      [200, 500],
      [500, 1000],
      [1000, 2000],
      [2000, 5000],
      [5000, undefined]
    ]);
  });

  it("offers no bound above the highest point of the map", () => {
    const bands = getAltitudeBands(60, landHeight); // 1764 m
    expect(bands.at(-1)).toMatchObject({ from: 1000, to: undefined });
  });

  it("splits the ocean at round depths", () => {
    expect(bounds(getAltitudeBands(0, oceanHeight))).toEqual([
      [0, 20],
      [20, 50],
      [50, 200],
      [200, undefined]
    ]);
  });

  it("keeps every band wide enough for its colour to stand out", () => {
    const feet = (value: number) => landHeight(value / 3.281);
    for (const band of getAltitudeBands(100, feet)) {
      const low = band.from ? feet(band.from) : 20;
      const high = band.to ? feet(band.to) : 100;
      expect(high - low).toBeGreaterThanOrEqual(4);
      expect(band.height).toBe((low + high) / 2);
    }
  });

  it("gives a flat land a single band", () => {
    expect(bounds(getAltitudeBands(22, landHeight))).toEqual([[0, undefined]]);
  });
});
