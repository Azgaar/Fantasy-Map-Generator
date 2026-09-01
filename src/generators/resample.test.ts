import { beforeEach, describe, expect, it } from "vitest";

describe("restoreJourneys", () => {
  let Resample: any;
  let Journeys: any;

  beforeEach(async () => {
    globalThis.window = globalThis.window || ({} as any);
    (globalThis as any).WARN = false;
    (globalThis as any).graphWidth = 100;
    (globalThis as any).graphHeight = 100;
    (globalThis as any).Pack = { findCell: (x: number, _y: number) => Math.round(x) };
    (globalThis as any).pack = {};

    await import("./journeys/journeys-generator");
    Journeys = (globalThis as any).Journeys;
    Resample = (await import("./resample")).Resample;
  });

  // parent point (30, 30) lands at (10, 10); parent point (10, 10) lands off-map at (-30, -30)
  const projection = (x: number, y: number): [number, number] => [x * 2 - 50, y * 2 - 50];

  const segment = (i: number, points: [number, number, number][]) => ({
    i,
    name: `segment ${i}`,
    transport: "Horse rider",
    speed: 10,
    distance: 999,
    from: points[0][2],
    to: points[points.length - 1][2],
    points
  });

  it("remaps surviving segments, drops out-of-map segments and empty journeys", () => {
    const parentMap = {
      pack: {
        journeys: [
          {
            i: 0,
            name: "kept",
            type: "Quest",
            color: "#333",
            segments: [
              segment(0, [
                [30, 30, 7],
                [40, 30, 8]
              ]),
              segment(1, [
                [30, 30, 7],
                [10, 10, 9] // projects off-map: the segment goes
              ])
            ]
          },
          {
            i: 1,
            name: "gone",
            type: "Raid",
            color: "#444",
            segments: [
              segment(0, [
                [10, 10, 9],
                [15, 10, 10]
              ])
            ]
          }
        ]
      }
    };

    Resample.restoreJourneys(parentMap, projection);

    const journeys = (globalThis as any).pack.journeys;
    expect(journeys).toHaveLength(1);
    expect(journeys[0].name).toBe("kept");
    expect(journeys[0].segments).toHaveLength(1);

    const seg = journeys[0].segments[0];
    expect(seg.points).toEqual([
      [10, 10, 10],
      [30, 10, 30]
    ]);
    expect(seg.from).toBe(10);
    expect(seg.to).toBe(30);
    expect(seg.distance).toBe(Journeys.getPathLength(seg.points));
  });

  it("restores an empty array when the parent map has no journeys", () => {
    Resample.restoreJourneys({ pack: {} }, projection);
    expect((globalThis as any).pack.journeys).toEqual([]);
  });
});
