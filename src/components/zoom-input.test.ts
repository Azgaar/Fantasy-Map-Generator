import { describe, expect, it } from "vitest";
import zoomSource from "./zoom.ts?raw";

describe("map zoom input", () => {
  it("keeps browser touch gestures from taking over the map surface", () => {
    expect(zoomSource.includes('.style("touch-action", "none")')).toBe(true);
  });
});
