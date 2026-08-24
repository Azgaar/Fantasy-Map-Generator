import { describe, expect, it } from "vitest";
import { clientToViewport, screenToWorld, worldToScreen } from "./camera";

describe("map camera transforms", () => {
  const camera = { height: 600, scale: 2.5, width: 800, x: -120, y: 45 };

  it("round-trips transformed coordinates", () => {
    const world = { x: 73.25, y: -18.5 };
    const screen = worldToScreen(world, camera);
    expect(screenToWorld(screen, camera)).toEqual(world);
  });

  it("converts client coordinates into renderer-local screen coordinates", () => {
    expect(clientToViewport({ x: 350, y: 275 }, { left: 100, top: 25 })).toEqual({ x: 250, y: 250 });
  });

  it("normalizes an invalid camera consistently in both directions", () => {
    const invalid = { height: 0, scale: 0, width: 0, x: Number.NaN, y: Number.NaN };
    expect(screenToWorld(worldToScreen({ x: 2, y: 3 }, invalid), invalid)).toEqual({ x: 2, y: 3 });
  });
});
