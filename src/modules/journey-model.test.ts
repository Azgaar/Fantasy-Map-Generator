import { describe, expect, it } from "vitest";
import {
  journeyResolvedCoordinates,
  normalizePackJourney,
  nextDefaultWaypointName,
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

  it("drops unknown stop ids", () => {
    const j = {
      stopIds: ["missing", "b"],
      waypoints: [{ id: "b", name: "B", x: 0, y: 0 }],
    };
    normalizePackJourney(j);
    expect(j.stopIds).toEqual(["b"]);
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

describe("nextDefaultWaypointName", () => {
  it("increments Stop n from existing labels", () => {
    expect(nextDefaultWaypointName([])).toBe("Stop 1");
    expect(nextDefaultWaypointName([{ id: "a", name: "Stop 3", x: 0, y: 0 }])).toBe(
      "Stop 4",
    );
  });
});
