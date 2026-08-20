import { describe, expect, it } from "vitest";
import { getInitialPixiTheme } from "./pixi-renderer-startup";

describe("Pixi renderer startup", () => {
  it("defaults to the states theme without a renderer parameter", () => {
    expect(getInitialPixiTheme("")).toBe("states");
  });

  it("allows the Pixi theme to be selected without a renderer parameter", () => {
    expect(getInitialPixiTheme("?pixiTheme=biomes")).toBe("biomes");
  });

  it("keeps explicit Pixi renderer URLs working", () => {
    expect(getInitialPixiTheme("?renderer=pixi")).toBe("states");
  });

  it("allows opting out to the SVG renderer", () => {
    expect(getInitialPixiTheme("?renderer=svg")).toBeNull();
  });
});
