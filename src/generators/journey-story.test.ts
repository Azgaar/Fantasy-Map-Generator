import { beforeEach, describe, expect, it } from "vitest";
import { getDefaultTransportTypes } from "@/data/transport-types";
import type { JouneySegment, JourneyPoint, TransportDomain } from "@/types/Journey";
import { generateStoryJourney, type JourneyPathfinder } from "./journey-story";

/**
 * A 10×10 land grid, 100px apart, with eight burgs scattered over two states.
 * Cell id = row * 10 + col; cells 0-99 are all land so any pair is reachable.
 */
const GRID = 10;
const STEP = 100;

const cellPoint = (cellId: number): [number, number] => [(cellId % GRID) * STEP, Math.floor(cellId / GRID) * STEP];

const BURG_CELLS = [0, 7, 23, 35, 48, 62, 79, 94];

/** Straight-line path with enough intermediate points that camp splitting is reachable. */
const straightPath = (from: number, to: number): JourneyPoint[] => {
  const [x1, y1] = cellPoint(from);
  const [x2, y2] = cellPoint(to);
  const steps = 12;
  const points: JourneyPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = x1 + ((x2 - x1) * i) / steps;
    const y = y1 + ((y2 - y1) * i) / steps;
    const cellId =
      i === 0 ? from : i === steps ? to : Math.min(99, Math.max(0, Math.round(y / STEP) * GRID + Math.round(x / STEP)));
    points.push([x, y, cellId]);
  }
  return points;
};

const pathfinder: JourneyPathfinder = {
  findPath: (from: number, to: number) => {
    const points = straightPath(from, to);
    return { points, distance: pathfinder.getPathLength(points) };
  },
  isValidPath: () => true,
  getPathLength: points => {
    let total = 0;
    for (let i = 1; i < points.length; i++)
      total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    return total;
  }
};

const isStay = (segment: JouneySegment) => segment.speed === 0;

describe("generateStoryJourney", () => {
  beforeEach(() => {
    const cells = {
      i: Array.from({ length: GRID * GRID }, (_, i) => i),
      p: Array.from({ length: GRID * GRID }, (_, i) => cellPoint(i)),
      h: new Uint8Array(GRID * GRID).fill(30),
      biome: new Uint8Array(GRID * GRID).fill(6),
      f: new Uint8Array(GRID * GRID).fill(1),
      burg: new Uint16Array(GRID * GRID),
      c: Array.from({ length: GRID * GRID }, () => [] as number[])
    };

    const burgs: any[] = [0];
    BURG_CELLS.forEach((cell, index) => {
      const i = index + 1;
      const [x, y] = cellPoint(cell);
      burgs.push({
        i,
        cell,
        x,
        y,
        name: `Burg${i}`,
        state: index < 4 ? 1 : 2,
        capital: index % 4 === 0 ? 1 : 0,
        port: index % 2 === 0 ? 1 : 0,
        population: 10 - index
      });
      cells.burg[cell] = i;
    });

    (globalThis as any).graphWidth = GRID * STEP;
    (globalThis as any).graphHeight = GRID * STEP;
    (globalThis as any).pack = {
      cells,
      burgs,
      states: [0, { i: 1, name: "Alderia" }, { i: 2, name: "Brennmark" }],
      biomes: [
        { i: 0, name: "Marine" },
        ...Array.from({ length: 12 }, (_, i) => ({ i: i + 1, name: "Temperate deciduous forest" }))
      ],
      features: [0, { i: 1, type: "ocean", subtype: "sea", name: "" }],
      transportTypes: getDefaultTransportTypes()
    };
  });

  it("returns null when the map has fewer than two burgs", () => {
    (globalThis as any).pack.burgs = [0, { i: 1, cell: 0, x: 0, y: 0 }];
    expect(generateStoryJourney(pathfinder)).toBeNull();
  });

  it("plots a named, multi-segment journey", () => {
    const journey = generateStoryJourney(pathfinder)!;
    expect(journey).not.toBeNull();
    expect(journey.name).toBeTruthy();
    expect(journey.segments.length).toBeGreaterThan(1);
    expect(journey.visible).toBe(true);
  });

  // Invariants must hold for every party the generator can invent, so sample many
  it("holds its invariants across many rolls", () => {
    for (let run = 0; run < 100; run++) {
      const journey = generateStoryJourney(pathfinder)!;
      expect(journey).not.toBeNull();
      const { segments } = journey;

      // ids are sequential, names are set, everything is visible
      segments.forEach((segment, index) => {
        expect(segment.id).toBe(index);
        expect(segment.name).toBeTruthy();
        expect(segment.visible).toBe(true);
      });

      // the route is continuous: every segment starts where the previous one ended
      for (let i = 1; i < segments.length; i++) expect(segments[i].from).toBe(segments[i - 1].to);

      // legs are committed whole, so the route both starts and ends at a burg
      expect(BURG_CELLS.includes(segments[0].from!)).toBe(true);
      expect(BURG_CELLS.includes(segments[segments.length - 1].to!)).toBe(true);
      expect(segments.length).toBeLessThanOrEqual(12);

      // at least one rest, and every rest is a zero-speed stay with a duration and no distance
      const stays = segments.filter(isStay);
      expect(stays.length).toBeGreaterThan(0);
      for (const stay of stays) {
        expect(transportDomain(stay.transportType)).toBe("stay");
        expect(stay.duration).toBeGreaterThan(0);
        expect(stay.distance).toBe(0);
        expect(stay.from).toBe(stay.to);
      }

      // travel segments carry a real path and a speed matching their transport type
      const travel = segments.filter(segment => !isStay(segment));
      expect(travel.length).toBeGreaterThan(0);
      for (const segment of travel) {
        expect(segment.points.length).toBeGreaterThan(1);
        expect(segment.distance).toBeGreaterThan(0);
        expect(segment.speed).toBe(transportSpeed(segment.transportType));
        expect(segment.points[0][2]).toBe(segment.from);
        expect(segment.points[segment.points.length - 1][2]).toBe(segment.to);
      }
    }
  });

  it("varies the party, the route and the transport between runs", () => {
    const names = new Set<string>();
    const transports = new Set<string>();
    for (let run = 0; run < 40; run++) {
      const journey = generateStoryJourney(pathfinder)!;
      names.add(journey.name);
      for (const segment of journey.segments) transports.add(segment.transportType);
    }
    expect(names.size).toBeGreaterThan(10);
    expect(transports.size).toBeGreaterThan(2);
  });
});

const transportSpeed = (name: string): number =>
  ((globalThis as any).pack.transportTypes.find((type: any) => type.name === name)?.speed ?? -1) as number;

const transportDomain = (name: string): TransportDomain =>
  (globalThis as any).pack.transportTypes.find((type: any) => type.name === name)?.domain;
