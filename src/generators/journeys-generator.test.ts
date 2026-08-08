import { beforeEach, describe, expect, it } from "vitest";
import type { Journey, Segment } from "@/types/Journey";
import {
  effectiveSpeed,
  formatTravelTime,
  journeyTotals,
  OFF_ROAD_SPEED_FACTOR,
  segmentLengthKm,
  segmentTimeHours
} from "./journeys-generator";

beforeEach(() => {
  (globalThis as any).distanceScale = 1;
});

const makeSeg = (distance: number, speed: number, avoidRoads = false): Segment => ({
  id: 0,
  name: "s",
  visible: true,
  from: 0,
  to: 1,
  transportType: "On Foot",
  speed,
  distance,
  points: [],
  avoidRoads
});

describe("journey metrics", () => {
  it("segmentLengthKm multiplies by distanceScale", () => {
    (globalThis as any).distanceScale = 2;
    expect(segmentLengthKm(makeSeg(10, 5))).toBe(20);
  });

  it("segmentTimeHours = km/speed", () => {
    expect(segmentTimeHours(makeSeg(10, 5))).toBe(2);
  });

  it("segmentTimeHours returns 0 for zero speed", () => {
    expect(segmentTimeHours(makeSeg(10, 0))).toBe(0);
  });

  it("effectiveSpeed returns base speed for on-road", () => {
    expect(effectiveSpeed(makeSeg(10, 8))).toBe(8);
  });

  it("effectiveSpeed applies OFF_ROAD_SPEED_FACTOR when avoidRoads", () => {
    const seg = makeSeg(10, 8, true);
    expect(effectiveSpeed(seg)).toBe(8 * OFF_ROAD_SPEED_FACTOR);
  });

  it("segmentTimeHours is slower for off-road segments", () => {
    const onRoad = segmentTimeHours(makeSeg(10, 5, false));
    const offRoad = segmentTimeHours(makeSeg(10, 5, true));
    expect(offRoad).toBeGreaterThan(onRoad);
    expect(offRoad).toBe(onRoad / OFF_ROAD_SPEED_FACTOR);
  });

  it("journeyTotals sums correctly with weighted avg speed", () => {
    const j: Journey = {
      i: 0,
      name: "j",
      visible: true,
      color: "#000",
      segments: [makeSeg(10, 5), makeSeg(20, 10)]
    };
    const t = journeyTotals(j);
    expect(t.totalKm).toBe(30);
    expect(t.totalHours).toBe(4); // 2 + 2
    expect(t.avgSpeed).toBe(7.5);
  });

  it("journeyTotals accounts for off-road penalty", () => {
    const j: Journey = {
      i: 0,
      name: "j",
      visible: true,
      color: "#000",
      segments: [makeSeg(10, 5, false), makeSeg(10, 5, true)]
    };
    const t = journeyTotals(j);
    expect(t.totalKm).toBe(20);
    const onRoadHours = 10 / 5;
    const offRoadHours = 10 / (5 * OFF_ROAD_SPEED_FACTOR);
    expect(t.totalHours).toBe(onRoadHours + offRoadHours);
  });

  it("formatTravelTime handles days/hours/minutes with default 8h/day", () => {
    expect(formatTravelTime(0)).toBe("0m");
    expect(formatTravelTime(0.5)).toBe("30m");
    expect(formatTravelTime(1.5)).toBe("1h 30m");
    // 25h at 8h/day = 3d 1h
    expect(formatTravelTime(25)).toBe("3d 1h");
  });

  it("formatTravelTime respects a custom hoursPerDay", () => {
    // 25h at 24h/day = 1d 1h (legacy behaviour)
    expect(formatTravelTime(25, 24)).toBe("1d 1h");
    // 20h at 10h/day = 2d
    expect(formatTravelTime(20, 10)).toBe("2d");
  });

  it("stay-domain segment contributes duration to totalHours, not distance/speed", () => {
    const stay = { ...makeSeg(0, 0), duration: 4 };
    const walk = makeSeg(10, 5);
    const j: Journey = {
      i: 0,
      name: "j",
      visible: true,
      color: "#000",
      segments: [walk, stay]
    };
    const t = journeyTotals(j);
    expect(t.totalKm).toBe(10);
    expect(t.totalHours).toBe(2 + 4);
    // avgSpeed based on moving hours only
    expect(t.avgSpeed).toBe(10 / 2);
  });
});

describe("land pathfinding stays on land", () => {
  let Journeys: any;

  /**
   * Cells 0-1-2-3 in a row. Cell 2 is open water, and pack.cells.routes links
   * 1-2-3 as a "sea route". pack.cells.routes merges every route group into one
   * graph, so a land path must not be allowed to follow it across the water.
   *
   *   0 (land) — 1 (land) — 2 (WATER) — 3 (land)
   *                  └────── sea route ─────┘
   */
  beforeEach(async () => {
    // Minimal stand-in for the legacy FlatQueue global used by A*
    (globalThis as any).FlatQueue = class {
      items: { id: number; priority: number }[] = [];
      get length() {
        return this.items.length;
      }
      push(id: number, priority: number) {
        this.items.push({ id, priority });
        this.items.sort((a, b) => a.priority - b.priority);
      }
      pop() {
        return this.items.shift()?.id;
      }
    };

    (globalThis as any).pack = {
      cells: {
        h: [30, 30, 5, 30], // cell 2 is water
        p: [
          [0, 0],
          [10, 0],
          [20, 0],
          [30, 0]
        ],
        c: [[1], [0, 2], [1, 3], [2]], // neighbours: a straight chain
        g: [0, 1, 2, 3],
        routes: {
          1: { 2: 0 },
          2: { 1: 0, 3: 0 },
          3: { 2: 0 }
        }
      },
      routes: [{ i: 0, group: "searoutes", points: [] }]
    };
    (globalThis as any).grid = { cells: { temp: [20, 20, 20, 20] } };

    await import("./journeys-generator");
    Journeys = (globalThis as any).Journeys;
  });

  it("does not follow a sea route across water", () => {
    const { points } = Journeys.findPath(1, 3, "land");
    const crossesWater = points.slice(1, -1).some((p: number[]) => (globalThis as any).pack.cells.h[p[2]] < 20);
    expect(crossesWater).toBe(false);
  });

  it("reports no land route when the only connection is by sea", () => {
    // 1 and 3 are separated by water and have no land neighbours in common,
    // so once the sea route is rejected there is genuinely no way across.
    expect(Journeys.findPath(1, 3, "land").errorCode).toBe("no-land-path");
  });

  it("still finds a path between cells that are connected by land", () => {
    const { points } = Journeys.findPath(0, 1, "land");
    expect(points.map((p: number[]) => p[2])).toEqual([0, 1]);
  });
});

describe("Journeys.isValidPath", () => {
  let Journeys: any;
  const at = (cellId: number): [number, number, number] => [cellId * 10, 0, cellId];

  beforeEach(async () => {
    (globalThis as any).pack = { cells: { h: [30, 30, 5, 30] } }; // cell 2 is water
    await import("./journeys-generator");
    Journeys = (globalThis as any).Journeys;
  });

  it("rejects a land path whose middle crosses water", () => {
    expect(Journeys.isValidPath([at(0), at(2), at(3)], "land")).toBe(false);
  });

  it("accepts a land path that stays on land", () => {
    expect(Journeys.isValidPath([at(0), at(1), at(3)], "land")).toBe(true);
  });

  it("ignores the endpoints, so a water path may start and end on the coast", () => {
    expect(Journeys.isValidPath([at(0), at(2), at(3)], "water")).toBe(true);
  });

  it("rejects a water path that runs overland mid-route", () => {
    expect(Journeys.isValidPath([at(2), at(1), at(2)], "water")).toBe(false);
  });

  it("accepts any path for unrestricted domains", () => {
    expect(Journeys.isValidPath([at(0), at(2), at(3)], "air")).toBe(true);
    expect(Journeys.isValidPath([at(0), at(2), at(3)], "stay")).toBe(true);
  });

  it("accepts paths too short to have a middle", () => {
    expect(Journeys.isValidPath([at(0), at(3)], "land")).toBe(true);
  });
});
