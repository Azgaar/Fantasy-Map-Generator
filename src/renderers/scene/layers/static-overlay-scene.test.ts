import { describe, expect, it } from "vitest";
import { DEFAULT_PIXI_MAP_STYLE } from "../styles";
import { buildCompassScene } from "./static-overlay-scene";

describe("static overlay scene", () => {
  it("builds a stable semantic compass placement without DOM input", () => {
    expect(buildCompassScene(DEFAULT_PIXI_MAP_STYLE.compass, "style:4")).toEqual({
      domainId: "compass",
      opacity: 0.8,
      revision: "compass:style:4",
      scale: 0.25,
      x: 80,
      y: 80
    });
  });
});
