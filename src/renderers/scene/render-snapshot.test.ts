import { describe, expect, it } from "vitest";
import { STATIC_VIEWER_WORLD } from "@/viewer/static-map-fixture";
import { assertRenderSnapshot, createRenderSnapshot, RENDER_SNAPSHOT_VERSION } from "./render-snapshot";
import { DEFAULT_PIXI_MAP_STYLE } from "./styles";

describe("render snapshot", () => {
  it("detaches world, style, and visibility from mutable editor inputs", () => {
    const world = structuredClone(STATIC_VIEWER_WORLD);
    const style = structuredClone(DEFAULT_PIXI_MAP_STYLE);
    const visibility = { borders: true };
    const snapshot = createRenderSnapshot({ layerVisibility: visibility, style, world });

    world.cells.state[0] = 99;
    style.states.opacity = 0;
    visibility.borders = false;

    expect(snapshot.version).toBe(RENDER_SNAPSHOT_VERSION);
    expect(snapshot.world.cells.state[0]).toBe(1);
    expect(snapshot.style.states.opacity).not.toBe(0);
    expect(snapshot.layerVisibility.borders).toBe(true);
    expect(snapshot.bounds).toEqual({ height: 60, width: 100 });
  });

  it("rejects unsupported versions and missing topology", () => {
    expect(() => assertRenderSnapshot({ version: 2 })).toThrow("Unsupported viewer data version");
    expect(() => assertRenderSnapshot({ bounds: { height: 1, width: 1 }, style: {}, version: 1, world: {} })).toThrow(
      "topology"
    );
  });
});
