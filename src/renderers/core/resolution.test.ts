import { describe, expect, it } from "vitest";
import { selectRendererResolution } from "./resolution";

describe("selectRendererResolution", () => {
  it("caps device pixel ratio for ordinary desktop viewports", () => {
    expect(selectRendererResolution({ devicePixelRatio: 3, height: 720, width: 1280 })).toBe(2);
  });

  it("reduces resolution on constrained-memory devices", () => {
    expect(selectRendererResolution({ deviceMemoryGb: 4, devicePixelRatio: 2, height: 720, width: 1280 })).toBe(1.5);
    expect(selectRendererResolution({ deviceMemoryGb: 2, devicePixelRatio: 2, height: 720, width: 1280 })).toBe(1);
  });

  it("stays within the backing-canvas pixel budget", () => {
    const resolution = selectRendererResolution({ devicePixelRatio: 2, height: 2160, width: 3840 });
    expect(resolution).toBe(1.01);
    expect(3840 * 2160 * resolution ** 2).toBeLessThanOrEqual(8 * 1024 * 1024 * 1.01);
  });

  it("normalizes invalid runtime capabilities", () => {
    expect(selectRendererResolution({ devicePixelRatio: Number.NaN, height: 0, width: Number.NaN })).toBe(1);
  });
});
