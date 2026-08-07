import { beforeEach, describe, expect, it } from "vitest";
import type { Journey, Segment } from "@/types/Journey";
import {
  effectiveSpeed,
  formatTravelTime,
  journeyTotals,
  OFF_ROAD_SPEED_FACTOR,
  segmentLengthKm,
  segmentTimeHours
} from "./journey-metrics";

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

describe("journey-metrics", () => {
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

  it("formatTravelTime handles days/hours/minutes", () => {
    expect(formatTravelTime(0)).toBe("0m");
    expect(formatTravelTime(0.5)).toBe("30m");
    expect(formatTravelTime(1.5)).toBe("1h 30m");
    expect(formatTravelTime(25)).toBe("1d 1h");
  });
});
