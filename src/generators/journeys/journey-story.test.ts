import { beforeEach, describe, expect, it } from "vitest";
import { JOURNEY_ARCHETYPES } from "@/data/journey-lore";
import type { JourneyPoint, JourneySegment } from "@/types/Journey";
import type { TransportDomain } from "../transports-generator";
import { generateStoryJourney, type JourneyPathfinder } from "./journey-story";
import "../transports-generator";

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

const isStay = (segment: JourneySegment) => segment.speed === 0;

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
      features: [0, { i: 1, type: "ocean", subtype: "sea", name: "" }]
    };

    (globalThis as any).options = { transports: Transports.getDefaults() };
  });

  it("returns null when the map has fewer than two burgs", () => {
    (globalThis as any).pack.burgs = [0, { i: 1, cell: 0, x: 0, y: 0 }];
    expect(generateStoryJourney(pathfinder)).toBeNull();
  });

  it("plots a named journey", () => {
    const journey = generateStoryJourney(pathfinder)!;
    expect(journey).not.toBeNull();
    expect(journey.name).toBeTruthy();
    expect(journey.type).toBeTruthy(); // the party's kind of travel, shown in the overview
    expect(journey.segments.length).toBeGreaterThan(0);
    expect(journey.visible).not.toBe(false);
  });

  // Invariants must hold for every party the generator can invent, so sample many
  it("holds its invariants across many rolls", () => {
    const lengths: number[] = [];

    for (let run = 0; run < 100; run++) {
      const journey = generateStoryJourney(pathfinder)!;
      expect(journey).not.toBeNull();
      const { segments } = journey;

      // ids are sequential, names are set, everything is visible
      segments.forEach((segment, index) => {
        expect(segment.i).toBe(index);
        expect(segment.name).toBeTruthy();
        expect(segment.visible).not.toBe(false);
      });

      // the route is continuous: every segment starts where the previous one ended
      for (let i = 1; i < segments.length; i++) expect(segments[i].from).toBe(segments[i - 1].to);

      // legs are committed whole, so the route both starts and ends at a burg
      expect(BURG_CELLS.includes(segments[0].from!)).toBe(true);
      expect(BURG_CELLS.includes(segments[segments.length - 1].to!)).toBe(true);
      expect(segments.length).toBeLessThanOrEqual(20);
      lengths.push(segments.length);

      // every rest is a zero-speed stay with a duration and no distance
      const stays = segments.filter(isStay);
      for (const stay of stays) {
        expect(transportDomain(stay.transport)).toBe("stay");
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
        expect(segment.speed).toBe(transportSpeed(segment.transport));
        expect(segment.points[0][2]).toBe(segment.from);
        expect(segment.points[segment.points.length - 1][2]).toBe(segment.to);
      }
    }

    // journeys come in different sizes: some are a single hop, some run long
    expect(Math.min(...lengths)).toBeLessThanOrEqual(2);
    expect(Math.max(...lengths)).toBeGreaterThanOrEqual(6);
  });

  // the point of the domain weights: a party built around one way of travelling should
  // read as that party, not as a land journey with an occasional flight
  it("keeps an air party in the air", () => {
    let air = 0;
    let ground = 0;

    for (let run = 0; run < 600; run++) {
      const journey = generateStoryJourney(pathfinder)!;
      if (journey.type !== JOURNEY_ARCHETYPES.skyfarers.type) continue;

      for (const segment of journey.segments.filter(s => !isStay(s))) {
        if (transportDomain(segment.transport) === "air") air++;
        else ground++;
      }
    }

    expect(air).toBeGreaterThan(0); // the archetype has to turn up at all for this to mean anything
    expect(air / (air + ground)).toBeGreaterThan(0.6);
  });

  it("varies the party, the route and the transport between runs", () => {
    const names = new Set<string>();
    const transports = new Set<string>();
    for (let run = 0; run < 40; run++) {
      const journey = generateStoryJourney(pathfinder)!;
      names.add(journey.name);
      for (const segment of journey.segments) transports.add(segment.transport);
    }
    expect(names.size).toBeGreaterThan(10);
    expect(transports.size).toBeGreaterThan(2);
  });
});

/** Types kept in the default list for modern maps, which generation must never reach for on its own */
const MODERN_TYPES = [
  "Train",
  "Automobile",
  "Modern Automobile",
  "Steamship",
  "Modern Ship",
  "Aircraft",
  "Helicopter",
  "Modern Airplane"
];

describe("archetype transport preferences", () => {
  beforeEach(() => {
    (globalThis as any).options = { transports: Transports.getDefaults() };
  });

  // A preference is matched by name against the configured types, so a renamed default
  // silently degrades every party of that archetype to the slowest type of the domain
  it("names a transport type that exists in the right domain", () => {
    for (const [key, archetype] of Object.entries(JOURNEY_ARCHETYPES)) {
      for (const [domain, weights] of Object.entries(archetype.transports)) {
        for (const name of Object.keys(weights)) {
          expect(`${key}: ${name} (${transportDomain(name)})`).toBe(`${key}: ${name} (${domain})`);
        }
      }
    }
  });

  // the two maps describe the same journey from different sides: a domain the party travels
  // with nothing to travel it in, or transports for a domain it never enters, is a config slip
  it("declares transports for exactly the domains it travels", () => {
    for (const [key, archetype] of Object.entries(JOURNEY_ARCHETYPES)) {
      expect(`${key}: ${Object.keys(archetype.transports).sort()}`).toBe(
        `${key}: ${Object.keys(archetype.domains).sort()}`
      );
      for (const [domain, weight] of Object.entries(archetype.domains)) {
        expect(`${key}.${domain}: ${weight > 0}`).toBe(`${key}.${domain}: true`);
      }
    }
  });

  it("leaves the modern types to the user", () => {
    for (const [key, archetype] of Object.entries(JOURNEY_ARCHETYPES)) {
      const named = Object.values(archetype.transports).flatMap(weights => Object.keys(weights));
      expect(`${key}: ${named.filter(name => MODERN_TYPES.includes(name))}`).toBe(`${key}: `);
    }
  });

  // every configured type a party could want should be reachable, or it only ever
  // arrives when the user picks it by hand
  it("covers every default type a fantasy party would use", () => {
    const named = new Set(
      Object.values(JOURNEY_ARCHETYPES).flatMap(archetype =>
        Object.values(archetype.transports).flatMap(weights => Object.keys(weights))
      )
    );
    const unused = Transports.getDefaults()
      .filter(type => type.domain !== "stay" && !MODERN_TYPES.includes(type.name) && !named.has(type.name))
      .map(type => type.name);
    expect(unused).toEqual([]);
  });
});

const transportSpeed = (name: string): number => Transports.get(name)?.speed ?? -1;

const transportDomain = (name: string): TransportDomain => Transports.getDomain(name);
