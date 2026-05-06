import { describe, expect, it } from "vitest";
import {
  arrowPositionsAlongPolyline,
  bendSegmentChord,
  chordGradientT,
  chordKey,
  directedChordOccurrenceIndex,
  journeyArrowSpacingMapUnits,
  journeyArrowSpacingMulForTier,
  journeyLodTier,
  journeyPolylineSamplesForTier,
  journeyRampColor,
  journeyRampSamplerForConfig,
  JOURNEY_DEFAULT_SOLID_STROKE,
  laneMultipliersForSegments,
  parseJourneyRainbowStops,
  readJourneyStyleConfig,
  segmentUInterval,
} from "./journey-draw";

describe("journeyLodTier", () => {
  it("is 0 at zoomMin and increases when scale doubles relative to zoomMin", () => {
    expect(journeyLodTier(0.05, 0.05)).toBe(0);
    expect(journeyLodTier(0.1, 0.05)).toBe(1);
    expect(journeyLodTier(0.2, 0.05)).toBe(2);
  });

  it("clamps to max tier", () => {
    expect(journeyLodTier(1e9, 0.05)).toBe(6);
  });
});

describe("journeyPolylineSamplesForTier", () => {
  it("rises with tier then caps", () => {
    expect(journeyPolylineSamplesForTier(0)).toBeLessThan(
      journeyPolylineSamplesForTier(4),
    );
    expect(journeyPolylineSamplesForTier(6)).toBe(journeyPolylineSamplesForTier(10));
  });
});

describe("journeyArrowSpacingMulForTier", () => {
  it("is higher when zoomed out (low tier)", () => {
    expect(journeyArrowSpacingMulForTier(0)).toBeGreaterThan(
      journeyArrowSpacingMulForTier(6),
    );
  });
});

describe("journeyArrowSpacingMapUnits", () => {
  it("shrinks map spacing when scale increases (same tier)", () => {
    const tier = 3;
    const a = journeyArrowSpacingMapUnits(1, tier);
    const b = journeyArrowSpacingMapUnits(4, tier);
    expect(b).toBeLessThan(a);
  });
});

describe("chordGradientT", () => {
  const a: [number, number] = [0, 0];
  const b: [number, number] = [100, 0];

  it("is 0 at A, 1 at B, ~0.5 at the midpoint", () => {
    expect(chordGradientT(a, b, 0, 0)).toBe(0);
    expect(chordGradientT(a, b, 100, 0)).toBe(1);
    expect(chordGradientT(a, b, 50, 0)).toBeCloseTo(0.5);
  });

  it("matches gradient axis (offset perpendicular does not change t)", () => {
    expect(chordGradientT(a, b, 40, 99)).toBeCloseTo(0.4);
  });

  it("clamps outside the segment", () => {
    expect(chordGradientT(a, b, -50, 0)).toBe(0);
    expect(chordGradientT(a, b, 200, 0)).toBe(1);
  });
});

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

describe("parseJourneyRainbowStops", () => {
  it("returns null for empty or single token", () => {
    expect(parseJourneyRainbowStops(null)).toBeNull();
    expect(parseJourneyRainbowStops("")).toBeNull();
    expect(parseJourneyRainbowStops("#ff0000")).toBeNull();
  });

  it("parses comma-separated colors", () => {
    expect(parseJourneyRainbowStops("#ff0000, #00ff00")).toEqual([
      "#ff0000",
      "#00ff00",
    ]);
  });
});

describe("readJourneyStyleConfig", () => {
  it("uses defaults when element is null", () => {
    const c = readJourneyStyleConfig(null);
    expect(c.colorMode).toBe("rainbow");
    expect(c.solidStroke).toBe(JOURNEY_DEFAULT_SOLID_STROKE);
    expect(c.lineScreenPx).toBe(6);
    expect(c.waypointFill).toBe("#ffffff");
    expect(c.outlineColor).toBe("#000000");
  });

  it("reads data-color-mode solid and custom attrs", () => {
    const attrs: Record<string, string> = {
      "data-color-mode": "solid",
      "data-solid-stroke": "#abc",
      "data-line-screen-px": "12",
    };
    const el = {
      getAttribute(name: string) {
        return attrs[name] ?? null;
      },
    } as unknown as Element;
    const c = readJourneyStyleConfig(el);
    expect(c.colorMode).toBe("solid");
    expect(c.solidStroke).toBe("#abc");
    expect(c.lineScreenPx).toBe(12);
  });
});

describe("journeyRampSamplerForConfig", () => {
  it("returns constant color in solid mode", () => {
    const cfg = readJourneyStyleConfig(null);
    const solidCfg = { ...cfg, colorMode: "solid" as const, solidStroke: "#112233" };
    const f = journeyRampSamplerForConfig(solidCfg);
    expect(f(0)).toBe("#112233");
    expect(f(1)).toBe("#112233");
  });

  it("varies along u in rainbow mode", () => {
    const cfg = readJourneyStyleConfig(null);
    const f = journeyRampSamplerForConfig(cfg);
    expect(f(0)).not.toBe(f(1));
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
