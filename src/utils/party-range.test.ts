import { describe, expect, it } from "vitest";
import { fitZoom, radiusPxFor } from "./party-range";

describe("radiusPxFor", () => {
  it("converts a distance (in the map unit) to pixels via distanceScale", () => {
    expect(radiusPxFor(24, 3)).toBe(8); // 24 units / 3 units-per-px
    expect(radiusPxFor(678, 3)).toBe(226);
  });

  it("is unit-agnostic — the value is already in the map's unit", () => {
    expect(radiusPxFor(24, 4)).toBe(6);
  });
});

describe("fitZoom", () => {
  const extent: [number, number] = [1, 20];

  it("fits the ring diameter into the smaller viewport dimension", () => {
    // radius 56 px, viewport 1000 → 0.9*1000/(2*56) ≈ 8.04
    expect(fitZoom(56, 1000, 1000, extent)).toBeCloseTo(8.036, 2);
  });

  it("clamps to the max zoom for tiny radii", () => {
    expect(fitZoom(8, 1000, 1000, extent)).toBe(20); // raw ≈ 56 → clamped
  });

  it("clamps to the min zoom for huge radii", () => {
    expect(fitZoom(5000, 1000, 1000, extent)).toBe(1);
  });

  it("uses the smaller of width/height", () => {
    expect(fitZoom(56, 2000, 800, extent)).toBeCloseTo((0.9 * 800) / (2 * 56), 5);
  });

  it("never returns NaN for a sub-pixel radius", () => {
    expect(fitZoom(0, 1000, 1000, extent)).toBe(20);
  });
});
