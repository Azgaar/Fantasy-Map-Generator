import { describe, expect, it } from "vitest";
import type { MapCamera } from "../core/camera";
import {
  getMapInteractionOverlayLayout,
  nudgeMapInteractionPoint,
  resolveMapInteractionPointer
} from "./map-interaction-overlay";

const camera: MapCamera = { height: 600, scale: 2, width: 800, x: 40, y: -20 };

describe("map interaction overlay", () => {
  it("uses the renderer camera transform and keeps handles at a fixed screen radius", () => {
    expect(getMapInteractionOverlayLayout(camera)).toEqual({
      handleRadius: 3,
      height: 600,
      transform: "translate(40 -20) scale(2)",
      width: 800
    });
  });

  it("keeps world alignment when the viewport is resized", () => {
    const resized = getMapInteractionOverlayLayout({ ...camera, height: 900, width: 1200 });
    expect(resized.transform).toBe("translate(40 -20) scale(2)");
    expect(resized).toMatchObject({ height: 900, width: 1200 });
  });

  it("resolves mouse and touch pointer coordinates through the shared transform", () => {
    expect(resolveMapInteractionPointer({ x: 260, y: 170 }, { left: 20, top: 10 }, camera)).toEqual({
      screenPoint: { x: 240, y: 160 },
      worldPoint: { x: 100, y: 90 }
    });
  });

  it("supports scale-independent keyboard movement for accessible handles", () => {
    expect(nudgeMapInteractionPoint({ x: 10, y: 20 }, "ArrowRight", camera)).toEqual({ x: 10.5, y: 20 });
    expect(nudgeMapInteractionPoint({ x: 10, y: 20 }, "ArrowUp", camera, { large: true })).toEqual({
      x: 10,
      y: 15
    });
    expect(nudgeMapInteractionPoint({ x: 10, y: 20 }, "Enter", camera)).toBeNull();
  });
});
