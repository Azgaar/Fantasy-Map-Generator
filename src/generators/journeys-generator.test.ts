import { beforeEach, describe, expect, it } from "vitest";
import type { Journey, JourneySegment } from "@/types/Journey";

const makeSeg = (
  distance: number,
  speed: number,
  avoidRoads = false,
  transport = "On foot (laden)"
): JourneySegment => ({
  i: 0,
  name: "s",
  visible: true,
  from: 0,
  to: 1,
  transport,
  speed,
  distance,
  points: [],
  avoidRoads
});

describe("journey metrics", () => {
  let Journeys: any;

  beforeEach(async () => {
    (globalThis as any).distanceScale = 1;
    await import("./transports-generator");
    (globalThis as any).options = { transports: (globalThis as any).Transports.getDefaults() };
    await import("./journeys-generator");
    Journeys = (globalThis as any).Journeys;
  });

  it("getSegmentDistance multiplies by distanceScale", () => {
    (globalThis as any).distanceScale = 2;
    expect(Journeys.getSegmentDistance(makeSeg(10, 5))).toBe(20);
  });

  it("getSegmentTime = distance/speed", () => {
    expect(Journeys.getSegmentTime(makeSeg(10, 5))).toBe(2);
  });

  it("getSegmentTime returns 0 for zero speed", () => {
    expect(Journeys.getSegmentTime(makeSeg(10, 0))).toBe(0);
  });

  it("getEffectiveSpeed returns base speed for on-road", () => {
    expect(Journeys.getEffectiveSpeed(makeSeg(10, 8))).toBe(8);
  });

  it("getTotals sums correctly with weighted avg speed", () => {
    const j: Journey = {
      i: 0,
      name: "j",
      type: "Travel",
      visible: true,
      color: "#000",
      segments: [makeSeg(10, 5), makeSeg(20, 10)]
    };
    const t = Journeys.getTotals(j);
    expect(t.totalDistance).toBe(30);
    expect(t.totalHours).toBe(4); // 2 + 2
    expect(t.avgSpeed).toBe(7.5);
  });

  it("getSegmentHoursPerDay comes from the transport type", () => {
    expect(Journeys.getSegmentHoursPerDay(makeSeg(10, 3))).toBe(8); // On foot (laden)
    expect(Journeys.getSegmentHoursPerDay(makeSeg(10, 20, false, "Dirigible"))).toBe(24);
    expect(Journeys.getSegmentHoursPerDay(makeSeg(10, 5, false, "Removed type"))).toBe(8); // unknown: domain fallback
  });

  it("getTotals counts days per segment transport", () => {
    const j: Journey = {
      i: 0,
      name: "j",
      type: "Travel",
      visible: true,
      color: "#000",
      // 24h on foot is 3 travel days, the same 24h aboard a dirigible is 1
      segments: [makeSeg(72, 3), makeSeg(480, 20, false, "Dirigible")]
    };
    const t = Journeys.getTotals(j);
    expect(t.totalHours).toBe(48);
    expect(t.totalDays).toBe(4);
    expect(t.hoursPerDay).toBe(12); // the rate that reproduces 4 days from 48 hours
    expect(Journeys.formatTravelTime(t.totalHours, t.hoursPerDay)).toBe("4d");
  });

  it("formatTravelTime handles days/hours/minutes", () => {
    expect(Journeys.formatTravelTime(0, 8)).toBe("0m");
    expect(Journeys.formatTravelTime(0.5, 8)).toBe("30m");
    expect(Journeys.formatTravelTime(1.5, 8)).toBe("1h 30m");
    // 25h at 8h/day = 3d 1h
    expect(Journeys.formatTravelTime(25, 8)).toBe("3d 1h");
  });

  it("formatTravelTime drops the smaller unit once the larger dominates", () => {
    expect(Journeys.formatTravelTime(2400, 8)).toBe("300d"); // 300 travel days at 8h/day
    expect(Journeys.formatTravelTime(2404.15, 8)).toBe("300d"); // the odd hours are noise
    expect(Journeys.formatTravelTime(75, 8)).toBe("9d 3h"); // under 10 days, hours still matter
    expect(Journeys.formatTravelTime(11.5, 24)).toBe("11h"); // hours-only above the threshold
    expect(Journeys.formatTravelTime(3.25, 24)).toBe("3h 15m"); // below it, minutes still show
  });

  it("formatTravelTime keeps whole minutes at a fractional (mixed-transport) rate", () => {
    expect(Journeys.formatTravelTimeFull(77.248512, 12.5)).toBe("6d 2h 15m");
    expect(Journeys.formatTravelTimeFull(10, 9.9)).toBe("1d 6m");
  });

  it("formatTravelTimeFull keeps every unit for the tooltip", () => {
    expect(Journeys.formatTravelTimeFull(2404.15, 8)).toBe("300d 4h 9m");
    expect(Journeys.formatTravelTimeFull(0, 8)).toBe("0m");
    expect(Journeys.formatTravelTimeFull(25, 24)).toBe("1d 1h");
  });

  it("formatTravelTime respects a custom hoursPerDay", () => {
    // 25h at 24h/day = 1d 1h (legacy behaviour)
    expect(Journeys.formatTravelTime(25, 24)).toBe("1d 1h");
    // 20h at 10h/day = 2d
    expect(Journeys.formatTravelTime(20, 10)).toBe("2d");
  });

  it("stay-domain segment contributes duration to totalHours, not distance/speed", () => {
    const stay = { ...makeSeg(0, 0, false, "Stay"), duration: 4 };
    const walk = makeSeg(10, 5);
    const j: Journey = {
      i: 0,
      name: "j",
      type: "Travel",
      visible: true,
      color: "#000",
      segments: [walk, stay]
    };
    const t = Journeys.getTotals(j);
    expect(t.totalDistance).toBe(10);
    expect(t.totalHours).toBe(2 + 4);
    // avgSpeed based on moving hours only
    expect(t.avgSpeed).toBe(10 / 2);
  });

  it("a zero speed does not turn a moving segment into a stay", () => {
    // a stay is a transport domain, not a speed: a leg the user zeroed out still covers its ground
    const stalled = makeSeg(10, 0);
    expect(Journeys.isStaySegment(stalled)).toBe(false);
    expect(Journeys.getSegmentDistance(stalled)).toBe(10);
    expect(Journeys.isStaySegment(makeSeg(10, 0, false, "Stay"))).toBe(true);
  });

  it("duration overrides the calculated time on a moving segment", () => {
    const ride = { ...makeSeg(10, 5), duration: 7 };
    expect(Journeys.getSegmentTime(ride)).toBe(7);
    expect(Journeys.getSegmentDistance(ride)).toBe(10); // still covers the ground
  });

  it("a zero duration overrides too, but a missing one falls back to distance/speed", () => {
    expect(Journeys.getSegmentTime({ ...makeSeg(10, 5), duration: 0 })).toBe(0);
    expect(Journeys.getSegmentTime(makeSeg(10, 5))).toBe(2);
  });

  it("an overridden segment still counts toward avg speed", () => {
    const j: Journey = {
      i: 0,
      name: "j",
      type: "Travel",
      color: "#000",
      segments: [{ ...makeSeg(10, 5), duration: 5 }]
    };
    const t = Journeys.getTotals(j);
    expect(t.totalHours).toBe(5);
    expect(t.avgSpeed).toBe(10 / 5);
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

  const navigable = new Set<number>();

  beforeEach(async () => {
    (globalThis as any).pack = { cells: { h: [30, 30, 5, 30] } }; // cell 2 is water
    navigable.clear();
    (globalThis as any).Rivers = { isNavigable: (cellId: number) => navigable.has(cellId) };
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

  it("lets a water path run overland along a navigable river", () => {
    navigable.add(1);
    expect(Journeys.isValidPath([at(2), at(1), at(2)], "water")).toBe(true);
  });

  it("accepts any path for unrestricted domains", () => {
    expect(Journeys.isValidPath([at(0), at(2), at(3)], "air")).toBe(true);
    expect(Journeys.isValidPath([at(0), at(2), at(3)], "stay")).toBe(true);
  });

  it("accepts paths too short to have a middle", () => {
    expect(Journeys.isValidPath([at(0), at(3)], "land")).toBe(true);
  });
});
