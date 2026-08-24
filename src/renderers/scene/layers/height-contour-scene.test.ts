import { describe, expect, it } from "vitest";
import { DEFAULT_PIXI_MAP_STYLE } from "../styles";
import { buildHeightContourScene, getHeightColor } from "./height-contour-scene";

const source = {
  cells: {
    c: [[1], [0]],
    h: Uint8Array.from([10, 20]),
    i: Uint16Array.from([0, 1]),
    v: [[], []]
  },
  vertices: { c: [], p: [], v: [] }
};

describe("height contour scene", () => {
  it("builds deterministic ocean and land bases without touching SVG", () => {
    const style = structuredClone(DEFAULT_PIXI_MAP_STYLE.height);
    style.ocean.render = true;
    const scene = buildHeightContourScene(source as never, { height: 50, width: 100 }, style, "height:2");

    expect(scene).toMatchObject({ layer: "height", revision: "height:2" });
    expect(scene.groups.map(group => ({ baseColor: group.baseColor, scope: group.scope }))).toEqual([
      { baseColor: getHeightColor(0), scope: "ocean" },
      { baseColor: getHeightColor(20), scope: "land" }
    ]);
  });

  it("reports unsupported legacy filters and validates bounds", () => {
    const style = structuredClone(DEFAULT_PIXI_MAP_STYLE.height);
    style.land.filter = "url(#turbulence)";
    expect(buildHeightContourScene(source as never, { height: 1, width: 1 }, style).unsupportedEffects).toEqual([
      "land:filter:url(#turbulence)"
    ]);
    expect(() => buildHeightContourScene(source as never, { height: 0, width: 1 }, style)).toThrow(
      "Invalid height contour bounds"
    );
  });
});
