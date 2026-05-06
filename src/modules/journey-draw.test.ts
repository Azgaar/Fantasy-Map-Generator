import { describe, expect, it } from "vitest";
import {
  arrowPositionsAlongPolyline,
  bendSegmentChord,
  chordKey,
  directedChordOccurrenceIndex,
  journeyRampColor,
  laneMultipliersForSegments,
  segmentUInterval,
} from "./journey-draw";

describe("segmentUInterval", () => {
  it("slices the unified ramp into equal spans", () => {
    expect(segmentUInterval(4, 0)).toEqual([0, 0.25]);
    expect(segmentUInterval(4, 3)).toEqual([0.75, 1]);
  });

  it("returns zeros when there are no segments", () => {
    expect(segmentUInterval(0, 0)).toEqual([0, 0]);
  });
});

describe("journeyRampColor", () => {
  it("returns CSS color strings for clamped parameters", () => {
    expect(journeyRampColor(0)).toMatch(/^(#|rgb|rgba)/);
    expect(journeyRampColor(1)).toMatch(/^(#|rgb|rgba)/);
    expect(journeyRampColor(-5)).toBe(journeyRampColor(0));
    expect(journeyRampColor(5)).toBe(journeyRampColor(1));
  });
});

describe("directedChordOccurrenceIndex", () => {
  it("counts 0,1,2 for identical directed chords in order", () => {
    const pts: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 0],
      [10, 0],
      [0, 0],
      [10, 0],
    ];
    const occ = directedChordOccurrenceIndex(pts);
    expect(occ).toHaveLength(6);
    expect(chordKey([0, 0], [10, 0])).toBeTruthy();
    expect(occ[0]).toBe(0);
    expect(occ[1]).toBe(0);
    expect(occ[2]).toBe(0);
    expect(occ[3]).toBe(1);
    expect(occ[4]).toBe(0);
    expect(occ[5]).toBe(2);
  });
});

describe("bendSegmentChord", () => {
  it("scales with chord length and repeat index", () => {
    const len = 100;
    const b0 = bendSegmentChord(len, 0);
    const b1 = bendSegmentChord(len, 1);
    expect(b1).toBeGreaterThan(b0);
    expect(b0).toBeCloseTo(14, 5);
  });
});

describe("laneMultipliersForSegments", () => {
  it("separates duplicate directed chords", () => {
    const pts: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 0],
      [10, 0],
    ];
    const lanes = laneMultipliersForSegments(pts);
    expect(lanes).toHaveLength(4);
    expect(chordKey([0, 0], [10, 0])).toBe("0,0->10,0");
    expect(lanes[0]).not.toBe(0);
    expect(lanes[3]).not.toBe(0);
    expect(lanes[0]).not.toBe(lanes[3]);
  });
});

describe("arrowPositionsAlongPolyline", () => {
  it("spaces arrows along length", () => {
    const pts: [number, number][] = [
      [0, 0],
      [100, 0],
    ];
    const arrows = arrowPositionsAlongPolyline(pts, 30);
    expect(arrows.length).toBeGreaterThanOrEqual(3);
  });
});
