import { describe, expect, it } from "vitest";
import {
  buildJourneyResolutionContext,
  burgJourneyStopRef,
  ensurePackJourneyNormalized,
  journeyLegToRefString,
  journeyRefStringToLeg,
  journeyResolvedCoordinates,
  journeyResolvedStopEntries,
  markerJourneyStopRef,
  normalizePackJourney,
  parseJourneyStopRef,
  resolveJourneyLeg,
  resolveJourneyStopPosition,
  type JourneyResolutionContext,
  type JourneyStopLeg,
  type PackJourney,
  type PackWithOptionalJourney,
} from "./journey-model";

describe("ensurePackJourneyNormalized", () => {
  it("creates pack.journey when absent and normalizes", () => {
    const pack: PackWithOptionalJourney = { burgs: [], markers: [] };
    ensurePackJourneyNormalized(pack);
    expect(pack.journey).toEqual({ stops: [] });
  });
});

describe("normalizePackJourney", () => {
  it("strips stray points/stopIds/waypoints and yields empty stops", () => {
    const j: Record<string, unknown> = {
      points: [[10, 20], [30, 40]],
      stopIds: [],
      waypoints: [],
    };
    normalizePackJourney(j);
    expect(j.points).toBeUndefined();
    expect(j.stopIds).toBeUndefined();
    expect(j.waypoints).toBeUndefined();
    const normalized = j as unknown as PackJourney;
    expect(normalized.stops).toEqual([]);
    expect(journeyResolvedCoordinates(normalized)).toEqual([]);
  });

  it("keeps stops array and strips legacy keys", () => {
    const j = {
      stops: [{ kind: "burg" as const, id: 1 }],
      stopIds: ["burg:99"],
      waypoints: [{ id: "x" }],
    };
    normalizePackJourney(j);
    expect(j.stopIds).toBeUndefined();
    expect(j.waypoints).toBeUndefined();
    expect(j.stops.length).toBe(1);
    expect(j.stops[0]).toEqual({ kind: "burg", id: 1 });
  });

  it("does not infer stops from legacy stopIds (only stops[] is authoritative)", () => {
    const j: Record<string, unknown> = {
      stopIds: ["wp_skip", burgJourneyStopRef(3), markerJourneyStopRef(7)],
      waypoints: [{ id: "wp_skip", name: "A", x: 1, y: 2 }],
    };
    normalizePackJourney(j);
    expect((j as unknown as PackJourney).stops).toEqual([]);
    expect(j.stopIds).toBeUndefined();
    expect(j.waypoints).toBeUndefined();
  });

  it("drops legs when pack says missing burg/marker", () => {
    const j: PackJourney = {
      stops: [
        { kind: "burg", id: 5 },
        { kind: "marker", id: 2 },
      ],
    };
    normalizePackJourney(j, {
      burgs: [{ i: 5, removed: false }],
      markers: [],
    });
    expect(j.stops).toEqual([{ kind: "burg", id: 5 }]);
  });

  it("keeps stops[] when stray stopIds also present", () => {
    const j: Record<string, unknown> = {
      stops: [{ kind: "marker" as const, id: 1 }],
      stopIds: [burgJourneyStopRef(9)],
    };
    normalizePackJourney(j);
    expect((j as unknown as PackJourney).stops).toEqual([{ kind: "marker", id: 1 }]);
    expect(j.stopIds).toBeUndefined();
  });
});

describe("parseJourneyStopRef", () => {
  it("parses burg and marker prefixes", () => {
    expect(parseJourneyStopRef("burg:12")).toEqual({ kind: "burg", id: 12 });
    expect(parseJourneyStopRef("marker:3")).toEqual({ kind: "marker", id: 3 });
    expect(parseJourneyStopRef("wp_x")).toBeNull();
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
