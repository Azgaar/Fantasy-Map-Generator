import { describe, expect, it } from "vitest";
import {
  buildJourneyResolutionContext,
  ensurePackJourneyNormalized,
  journeyLegToRefString,
  journeyRefStringToLeg,
  journeyResolvedCoordinates,
  journeyResolvedStopEntries,
  markerJourneyStopRef,
  normalizePackJourney,
  resolveJourneyLeg,
  resolveJourneyStopPosition,
  type JourneyResolutionContext,
  type JourneyStopLeg,
  type PackJourney,
  type PackWithOptionalJourney,
} from "./journey-model";

describe("ensurePackJourneyNormalized", () => {
  it("creates pack.journey when absent and normalizes", () => {
    const pack: PackWithOptionalJourney = {};
    ensurePackJourneyNormalized(pack);
    expect(pack.journey).toEqual({ stops: [] });
  });
});

describe("normalizePackJourney", () => {
  it("keeps unknown keys and yields empty stops when stops[] is absent", () => {
    const j: Record<string, unknown> = {
      points: [[10, 20], [30, 40]],
      stopIds: [],
      waypoints: [],
    };
    normalizePackJourney(j);
    expect(j.points).toEqual([[10, 20], [30, 40]]);
    expect(j.stopIds).toEqual([]);
    expect(j.waypoints).toEqual([]);
    const normalized = j as unknown as PackJourney;
    expect(normalized.stops).toEqual([]);
    expect(journeyResolvedCoordinates(normalized)).toEqual([]);
  });

  it("uses only stops[] as source of truth", () => {
    const j = {
      stops: [{ kind: "burg" as const, id: 1 }],
      stopIds: ["burg:99"],
      waypoints: [{ id: "x" }],
    };
    normalizePackJourney(j);
    expect(j.stops.length).toBe(1);
    expect(j.stops[0]).toEqual({ kind: "burg", id: 1 });
    expect(j.stopIds).toEqual(["burg:99"]);
    expect(j.waypoints).toEqual([{ id: "x" }]);
  });

  it("does not infer stops from stopIds / waypoints", () => {
    const j: Record<string, unknown> = {
      stopIds: ["wp_skip", "burg:3", "marker:7"],
      waypoints: [{ id: "wp_skip", name: "A", x: 1, y: 2 }],
    };
    normalizePackJourney(j);
    expect((j as unknown as PackJourney).stops).toEqual([]);
    expect(j.stopIds).toEqual(["wp_skip", "burg:3", "marker:7"]);
    expect(j.waypoints).toEqual([{ id: "wp_skip", name: "A", x: 1, y: 2 }]);
  });

  it("filters malformed stops entries only", () => {
    const j: Record<string, unknown> = {
      stops: [
        { kind: "burg", id: 5 },
        { kind: "marker", id: 2 },
        { kind: "burg", id: -1 },
        { kind: "wp", id: 9 },
        { kind: "marker", id: "x" },
      ],
    };
    normalizePackJourney(j);
    expect((j as unknown as PackJourney).stops).toEqual([
      { kind: "burg", id: 5 },
      { kind: "marker", id: 2 },
    ]);
  });

  it("does not prune missing legs from pack context", () => {
    const j: Record<string, unknown> = {
      stops: [
        { kind: "burg", id: 5 },
        { kind: "marker", id: 2 },
      ],
    };
    normalizePackJourney(j);
    expect((j as unknown as PackJourney).stops).toEqual([
      { kind: "burg", id: 5 },
      { kind: "marker", id: 2 },
    ]);
  });
});

describe("journeyLegToRefString / journeyRefStringToLeg", () => {
  it("roundtrips", () => {
    const leg: JourneyStopLeg = { kind: "burg", id: 4 };
    expect(journeyRefStringToLeg(journeyLegToRefString(leg))).toEqual(leg);
  });
});

describe("journeyResolvedCoordinates", () => {
  const j: PackJourney = {
    stops: [
      { kind: "burg", id: 10 },
      { kind: "marker", id: 2 },
    ],
  };
  const ctx: JourneyResolutionContext = {
    burgs: [{ i: 10, x: 10, y: 20, removed: false }],
    markers: [{ i: 2, x: 30, y: 40 }],
  };

  it("resolves burg then marker", () => {
    expect(journeyResolvedCoordinates(j, ctx)).toEqual([
      [10, 20],
      [30, 40],
    ]);
  });

  it("skips missing burg", () => {
    expect(journeyResolvedCoordinates({ stops: [{ kind: "burg", id: 999 }] }, ctx)).toEqual([]);
  });
});

describe("buildJourneyResolutionContext", () => {
  it("matches linear resolve for burgs and markers", () => {
    const burgs = [
      { i: 1, x: 10, y: 20, removed: true },
      { i: 1, x: 11, y: 21, removed: false },
      { i: 2, x: 30, y: 40, removed: false },
    ];
    const markers = [
      { i: 0, x: 0, y: 1 },
      { i: 3, x: 50, y: 60 },
    ];
    const plain: JourneyResolutionContext = { burgs, markers };
    const indexed = buildJourneyResolutionContext(burgs, markers);
    expect(resolveJourneyLeg({ kind: "burg", id: 1 }, indexed)).toEqual(
      resolveJourneyLeg({ kind: "burg", id: 1 }, plain),
    );
    expect(resolveJourneyLeg({ kind: "burg", id: 2 }, indexed)).toEqual(
      resolveJourneyLeg({ kind: "burg", id: 2 }, plain),
    );
    expect(resolveJourneyLeg({ kind: "marker", id: 3 }, indexed)).toEqual(
      resolveJourneyLeg({ kind: "marker", id: 3 }, plain),
    );
    expect(resolveJourneyLeg({ kind: "marker", id: 999 }, indexed)).toEqual(
      resolveJourneyLeg({ kind: "marker", id: 999 }, plain),
    );
  });
});

describe("journeyResolvedStopEntries", () => {
  const j: PackJourney = {
    stops: [
      { kind: "burg", id: 10 },
      { kind: "marker", id: 2 },
    ],
  };
  const ctx: JourneyResolutionContext = {
    burgs: [{ i: 10, x: 10, y: 20, removed: false }],
    markers: [{ i: 2, x: 30, y: 40 }],
  };

  it("matches journeyResolvedCoordinates coords and carries legs", () => {
    const rows = journeyResolvedStopEntries(j, ctx);
    expect(rows.map((r) => r.coord)).toEqual(journeyResolvedCoordinates(j, ctx));
    expect(rows.map((r) => journeyLegToRefString(r.leg))).toEqual(["burg:10", "marker:2"]);
  });
});

describe("resolveJourneyLeg", () => {
  it("returns null for removed burg", () => {
    const ctx: JourneyResolutionContext = {
      burgs: [{ i: 1, x: 1, y: 2, removed: true }],
      markers: [],
    };
    expect(resolveJourneyLeg({ kind: "burg", id: 1 }, ctx)).toBeNull();
  });
});

describe("resolveJourneyStopPosition", () => {
  it("resolves ref string", () => {
    const ctx: JourneyResolutionContext = {
      burgs: [],
      markers: [{ i: 3, x: 5, y: 6 }],
    };
    expect(resolveJourneyStopPosition(markerJourneyStopRef(3), ctx)).toEqual([5, 6]);
  });
});
