import { describe, expect, it } from "vitest";
import {
  burgJourneyStopRef,
  journeyResolvedCoordinates,
  markerJourneyStopRef,
  normalizePackJourney,
  nextDefaultWaypointName,
  parseJourneyStopRef,
  resolveJourneyStopPosition,
  type JourneyResolutionContext,
  type PackJourney,
} from "./journey-model";

describe("normalizePackJourney", () => {
  it("strips stray points key without inferring waypoints", () => {
    const j: Record<string, unknown> = { points: [[10, 20], [30, 40]] };
    normalizePackJourney(j);
    expect(j.points).toBeUndefined();
    const normalized = j as unknown as PackJourney;
    expect(normalized.stopIds).toEqual([]);
    expect(normalized.waypoints).toEqual([]);
    expect(journeyResolvedCoordinates(normalized)).toEqual([]);
  });

  it("keeps new format and strips stray points key", () => {
    const j = {
      stopIds: ["a"],
      waypoints: [{ id: "a", name: "Alpha", x: 1, y: 2 }],
      points: [[99, 99]] as [number, number][],
    };
    normalizePackJourney(j);
    expect((j as { points?: unknown }).points).toBeUndefined();
    expect(j.stopIds).toEqual(["a"]);
    expect(j.waypoints.length).toBe(1);
  });

  it("drops unknown waypoint stop ids", () => {
    const j = {
      stopIds: ["missing", "b"],
      waypoints: [{ id: "b", name: "B", x: 0, y: 0 }],
    };
    normalizePackJourney(j);
    expect(j.stopIds).toEqual(["b"]);
  });

  it("keeps well-formed burg/marker refs without pack", () => {
    const j = {
      stopIds: ["wp_1", burgJourneyStopRef(3), markerJourneyStopRef(7)],
      waypoints: [{ id: "wp_1", name: "A", x: 1, y: 2 }],
    };
    normalizePackJourney(j);
    expect(j.stopIds).toEqual(["wp_1", burgJourneyStopRef(3), markerJourneyStopRef(7)]);
  });

  it("drops burg/marker refs when pack says missing", () => {
    const j = {
      stopIds: ["a", burgJourneyStopRef(5), markerJourneyStopRef(2)],
      waypoints: [{ id: "a", name: "A", x: 0, y: 0 }],
    };
    normalizePackJourney(j, {
      burgs: [{ i: 5, removed: false }],
      markers: [],
    });
    expect(j.stopIds).toEqual(["a", burgJourneyStopRef(5)]);
  });

  it("strips points when catalog exists without stops", () => {
    const j = {
      stopIds: [],
      waypoints: [{ id: "x", name: "Lonely", x: 5, y: 5 }],
      points: [[1, 1]] as [number, number][],
    };
    normalizePackJourney(j);
    expect(j.waypoints.length).toBe(1);
    expect(j.waypoints[0].id).toBe("x");
    expect(j.stopIds.length).toBe(0);
    expect((j as { points?: unknown }).points).toBeUndefined();
  });
});

describe("parseJourneyStopRef", () => {
  it("parses burg and marker prefixes", () => {
    expect(parseJourneyStopRef("burg:12")).toEqual({ kind: "burg", i: 12 });
    expect(parseJourneyStopRef("marker:3")).toEqual({ kind: "marker", i: 3 });
    expect(parseJourneyStopRef("wp_x")).toEqual({ kind: "waypoint", id: "wp_x" });
  });
});

describe("journeyResolvedCoordinates", () => {
  const j: PackJourney = {
    stopIds: ["w1", burgJourneyStopRef(10), markerJourneyStopRef(2)],
    waypoints: [{ id: "w1", name: "W", x: 100, y: 200 }],
  };
  const ctx: JourneyResolutionContext = {
    burgs: [{ i: 10, x: 10, y: 20, removed: false }],
    markers: [{ i: 2, x: 30, y: 40 }],
  };

  it("resolves waypoint then burg then marker", () => {
    expect(journeyResolvedCoordinates(j, ctx)).toEqual([
      [100, 200],
      [10, 20],
      [30, 40],
    ]);
  });

  it("skips missing burg/marker", () => {
    const partial: PackJourney = {
      stopIds: ["w1", burgJourneyStopRef(999)],
      waypoints: j.waypoints,
    };
    expect(journeyResolvedCoordinates(partial, ctx)).toEqual([[100, 200]]);
  });
});

describe("resolveJourneyStopPosition", () => {
  it("returns null for removed burg", () => {
    const j: PackJourney = { stopIds: [], waypoints: [] };
    const ctx: JourneyResolutionContext = {
      burgs: [{ i: 1, x: 1, y: 2, removed: true }],
      markers: [],
    };
    expect(resolveJourneyStopPosition(burgJourneyStopRef(1), j, ctx)).toBeNull();
  });
});

describe("nextDefaultWaypointName", () => {
  it("increments Stop n from existing labels", () => {
    expect(nextDefaultWaypointName([])).toBe("Stop 1");
    expect(nextDefaultWaypointName([{ id: "a", name: "Stop 3", x: 0, y: 0 }])).toBe(
      "Stop 4",
    );
  });
});
