import { describe, expect, it } from "vitest";
import { DEFAULT_PIXI_MAP_STYLE } from "../styles";
import { buildOceanDepthScene, resolveOceanDepthLimits } from "./ocean-depth-scene";

const source = {
  cells: { b: Uint8Array.from([0]), c: [[]], i: Uint16Array.from([0]), t: Int8Array.from([-1]), v: [[]] },
  vertices: { c: [], p: [], v: [] }
};

describe("ocean depth scene", () => {
  it("parses explicit bands and disables the scene for none", () => {
    expect(resolveOceanDepthLimits("-1,-6,-3,-3,20", [])).toEqual([-6, -3, -1]);
    expect(resolveOceanDepthLimits("none", [])).toEqual([]);
  });

  it("resolves random bands deterministically from world data", () => {
    const cells = Int8Array.from([-1, -2, 1, -7]);
    expect(resolveOceanDepthLimits("random", cells)).toEqual(resolveOceanDepthLimits("random", cells));
  });

  it("reports unsupported legacy filters", () => {
    const style = structuredClone(DEFAULT_PIXI_MAP_STYLE.ocean);
    style.bands.filter = "url(#sepia)";
    const scene = buildOceanDepthScene(source as never, { height: 10, width: 20 }, style, "ocean:3");
    expect(scene).toMatchObject({ layer: "ocean", revision: "ocean:3" });
    expect(scene.unsupportedEffects).toEqual(["bands:filter:url(#sepia)"]);
  });
});
