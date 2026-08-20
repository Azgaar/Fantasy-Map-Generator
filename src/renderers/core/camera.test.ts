import { describe, expect, it } from "vitest";
import { camerasEqual, normalizeCamera } from "./camera";

describe("map camera", () => {
  it("normalizes invalid values at the renderer boundary", () => {
    expect(normalizeCamera({ height: 0, scale: Number.NaN, width: 10.4, x: Number.NaN, y: 4 })).toEqual({
      height: 1,
      scale: 1,
      width: 10,
      x: 0,
      y: 4
    });
  });

  it("compares every camera and viewport component", () => {
    const camera = { height: 600, scale: 2, width: 800, x: 10, y: 20 };
    expect(camerasEqual(camera, { ...camera })).toBe(true);
    expect(camerasEqual(camera, { ...camera, scale: 3 })).toBe(false);
  });
});
