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
    await import("../transports-generator");
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

  it("getTotals leaves hidden segments out of every total", () => {
    const j: Journey = {
      i: 0,
      name: "j",
      type: "Travel",
      visible: true,
      color: "#000",
      segments: [makeSeg(24, 3), { ...makeSeg(48, 3), visible: false }]
    };
    const t = Journeys.getTotals(j);
    expect(t.totalDistance).toBe(24); // the hidden leg's 48 are not there
    expect(t.totalHours).toBe(8);
    expect(t.elapsedHours).toBe(24); // one walking day
    expect(t.avgSpeed).toBe(3);
    expect(t.hiddenSegments).toBe(1);
  });

  it("getElapsedHours spends a whole day on every full travel day", () => {
    expect(Journeys.getElapsedHours(25, 8)).toBe(73); // 3 travel days (72h of calendar) + 1 leftover hour
    expect(Journeys.getElapsedHours(8, 8)).toBe(24); // a walker's day fills the calendar day
    expect(Journeys.getElapsedHours(12, 24)).toBe(12); // waiting hours are calendar hours
    expect(Journeys.getElapsedHours(0, 8)).toBe(0);
    expect(Journeys.getElapsedHours(12, 0)).toBe(12); // a corrupt rate falls back to the longest day
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
    expect(t.elapsedHours).toBe(96); // 3 walking days + 1 flying day of calendar time
    expect(t.totalDays).toBe(4);
    expect(Journeys.formatTravelTime(t.elapsedHours)).toBe("4d");
  });

  it("getTotals adds the calendar hours of each segment, never a blended rate", () => {
    const j: Journey = {
      i: 0,
      name: "j",
      type: "Travel",
      visible: true,
      color: "#000",
      // a full walking day (24h of calendar) followed by a 12h wait
      segments: [makeSeg(24, 3), { ...makeSeg(0, 0, false, "Stay"), duration: 12 }]
    };
    const t = Journeys.getTotals(j);
    expect(t.totalHours).toBe(20);
    expect(t.elapsedHours).toBe(36);
    expect(Journeys.formatTravelTime(t.elapsedHours)).toBe("1d 12h");
  });

  it("formatTravelTime handles days/hours/minutes", () => {
    expect(Journeys.formatTravelTime(0)).toBe("0m");
    expect(Journeys.formatTravelTime(0.5)).toBe("30m");
    expect(Journeys.formatTravelTime(1.5)).toBe("1h 30m");
    // 25h on foot at 8h/day = 3 days and an hour
    expect(Journeys.formatTravelTime(Journeys.getElapsedHours(25, 8))).toBe("3d 1h");
  });

  it("formatTravelTime drops the smaller unit once the larger dominates", () => {
    expect(Journeys.formatTravelTime(7200)).toBe("300d"); // 300 days
    expect(Journeys.formatTravelTime(7204.15)).toBe("300d"); // the odd hours are noise
    expect(Journeys.formatTravelTime(219)).toBe("9d 3h"); // under 10 days, hours still matter
    expect(Journeys.formatTravelTime(11.5)).toBe("11h"); // hours-only above the threshold
    expect(Journeys.formatTravelTime(3.25)).toBe("3h 15m"); // below it, minutes still show
  });

  it("formatTravelTime keeps whole minutes at a fractional hour", () => {
    expect(Journeys.formatTravelTimeFull(146.2521)).toBe("6d 2h 15m");
    expect(Journeys.formatTravelTimeFull(24.1)).toBe("1d 6m");
  });

  it("formatTravelTimeFull keeps every unit for the tooltip", () => {
    expect(Journeys.formatTravelTimeFull(7204.15)).toBe("300d 4h 9m");
    expect(Journeys.formatTravelTimeFull(0)).toBe("0m");
    expect(Journeys.formatTravelTimeFull(25)).toBe("1d 1h");
  });

  it("a stay of half a day stays half a day", () => {
    // the reason the elapsed conversion exists: 12h of waiting is 12h, not 1d 4h
    expect(Journeys.formatTravelTime(Journeys.getElapsedHours(12, 24))).toBe("12h");
    // while 12h of walking at 8h/day is a day and a half of calendar time
    expect(Journeys.formatTravelTime(Journeys.getElapsedHours(12, 8))).toBe("1d 4h");
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
        f: [1, 1, 2, 3], // cells 0-1 share a landmass; cell 3 is a separate island across water 2
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

/** Minimal FlatQueue polyfill (correct, not optimised — tests only). */
class TestFlatQueue {
  private items: Array<{ id: number; value: number }> = [];
  get length() {
    return this.items.length;
  }
  push(id: number, value: number) {
    this.items.push({ id, value });
    this.items.sort((a, b) => a.value - b.value);
  }
  pop() {
    return this.items.shift()?.id;
  }
}

/**
 * A 9x9 land grid, 10px apart, 4-way connected. Cell id = row * 9 + col.
 * Everything is lowland grassland until a test paints harsher ground on it.
 */
const TERRAIN_GRID = 9;
const TERRAIN_STEP = 10;
const CELL_COUNT = TERRAIN_GRID * TERRAIN_GRID;
const GRASSLAND = 4;
const GLACIER = 11;
const cellAt = (row: number, col: number) => row * TERRAIN_GRID + col;

function makeTerrainPack() {
  const c: number[][] = [];
  const p: [number, number][] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const [row, col] = [Math.floor(i / TERRAIN_GRID), i % TERRAIN_GRID];
    p.push([col * TERRAIN_STEP, row * TERRAIN_STEP]);
    const neibs: number[] = [];
    if (row > 0) neibs.push(cellAt(row - 1, col));
    if (row < TERRAIN_GRID - 1) neibs.push(cellAt(row + 1, col));
    if (col > 0) neibs.push(cellAt(row, col - 1));
    if (col < TERRAIN_GRID - 1) neibs.push(cellAt(row, col + 1));
    c.push(neibs);
  }

  return {
    cells: {
      p,
      c,
      h: new Uint8Array(CELL_COUNT).fill(25), // lowland: no height penalty
      biome: new Uint8Array(CELL_COUNT).fill(GRASSLAND),
      f: new Uint8Array(CELL_COUNT).fill(1), // one landmass
      routes: {} as Record<number, Record<number, number>>
    },
    // the default biome table, of which only `cost` matters here
    biomes: Array.from({ length: 13 }, (_, i) => ({
      i,
      cost: [10, 200, 150, 60, 50, 70, 70, 80, 90, 200, 1000, 5000, 150][i]
    })),
    routes: [],
    journeys: []
  };
}

describe("land pathfinding respects terrain", () => {
  let Journeys: any;

  /** Straight west→east crossing of the middle row, with room to detour north or south */
  const [START, END] = [cellAt(4, 0), cellAt(4, 8)];
  const rowsOf = (points: any[]) => points.map(([, , cellId]) => Math.floor(cellId / TERRAIN_GRID));

  beforeEach(async () => {
    (globalThis as any).FlatQueue = TestFlatQueue;
    (globalThis as any).distanceScale = 1;
    (globalThis as any).pack = makeTerrainPack();
    await import("../transports-generator");
    (globalThis as any).options = { transports: (globalThis as any).Transports.getDefaults() };
    await import("./journeys-generator");
    Journeys = (globalThis as any).Journeys;
  });

  it("goes straight across uniform lowland", () => {
    const { points } = Journeys.findPath(START, END, "land", { avoidRoads: true });
    expect(points).toHaveLength(9);
    expect(rowsOf(points).every(row => row === 4)).toBe(true);
  });

  it("rounds a glacier instead of ploughing through it", () => {
    const { cells } = (globalThis as any).pack;
    // a 3x3 ice field squarely astride the straight line
    for (let row = 3; row <= 5; row++) for (let col = 3; col <= 5; col++) cells.biome[cellAt(row, col)] = GLACIER;

    const { points } = Journeys.findPath(START, END, "land", { avoidRoads: true });
    const crossed = points.map(([, , cellId]: any) => cellId);
    expect(crossed.includes(START)).toBe(true);
    expect(crossed.includes(END)).toBe(true);
    expect(crossed.some((cellId: number) => cells.biome[cellId] === GLACIER)).toBe(false);
  });

  it("rounds a mountain range instead of climbing it", () => {
    const { cells } = (globalThis as any).pack;
    // a block of peaks squarely astride the straight line, open to the north and south
    for (let row = 3; row <= 5; row++) for (let col = 3; col <= 5; col++) cells.h[cellAt(row, col)] = 100;

    const { points } = Journeys.findPath(START, END, "land", { avoidRoads: true });
    expect(points.every(([, , cellId]: any) => cells.h[cellId] < 100)).toBe(true);
  });

  it("still crosses a glacier when there is no way around it", () => {
    const { cells } = (globalThis as any).pack;
    // ice from edge to edge: expensive, but a polar crossing must stay plottable
    for (let row = 0; row < TERRAIN_GRID; row++) cells.biome[cellAt(row, 4)] = GLACIER;

    const { points, errorCode } = Journeys.findPath(START, END, "land", { avoidRoads: true });
    expect(errorCode).toBeUndefined();
    expect(points.some(([, , cellId]: any) => cells.biome[cellId] === GLACIER)).toBe(true);
  });

  it("applies terrain on-road too, not just off-road", () => {
    const { cells } = (globalThis as any).pack;
    for (let row = 3; row <= 5; row++) for (let col = 3; col <= 5; col++) cells.biome[cellAt(row, col)] = GLACIER;

    const { points } = Journeys.findPath(START, END, "land", { avoidRoads: false });
    expect(points.some(([, , cellId]: any) => cells.biome[cellId] === GLACIER)).toBe(false);
  });
});
