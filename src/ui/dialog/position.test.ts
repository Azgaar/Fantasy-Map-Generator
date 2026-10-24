import { describe, expect, it } from "vitest";
import { placeBox } from "./position";

const viewport = { left: 0, top: 0, width: 1400, height: 900 };
const size = { width: 300, height: 200 };

describe("placeBox", () => {
  it("centers on the target by default", () => {
    expect(placeBox({}, size, viewport, viewport)).toEqual({ left: 550, top: 350 });
  });

  it("aligns a corner to the target's corner with pixel offsets", () => {
    const point = placeBox(
      { my: "right top", at: "right-10 top+10" },
      { width: 627.86, height: 500 },
      viewport,
      viewport
    );
    expect(point.left).toBeCloseTo(762.14);
    expect(point.top).toBe(10);
  });

  it("reads a lone vertical keyword as centered horizontally, and keywords in either order", () => {
    expect(placeBox({ my: "center", at: "top+60" }, size, viewport, viewport)).toEqual({ left: 550, top: 0 });
    expect(placeBox({ my: "top left", at: "bottom right" }, { width: 10, height: 10 }, viewport, viewport)).toEqual({
      left: 1390,
      top: 890
    });
  });

  it("takes percent offsets of the target for `at` and of the element for `my`", () => {
    expect(placeBox({ my: "left+10% top", at: "left+50% top" }, size, viewport, viewport)).toEqual({
      left: 730,
      top: 0
    });
  });

  it("aligns to an element target", () => {
    const target = { left: 100, top: 50, width: 200, height: 100 };
    expect(placeBox({ my: "left top", at: "left+10 bottom" }, size, target, viewport)).toEqual({ left: 110, top: 150 });
  });

  it("fits a window that would overflow back inside the viewport", () => {
    expect(placeBox({ my: "left top", at: "right top" }, size, viewport, viewport)).toEqual({ left: 1100, top: 0 });
    expect(placeBox({ my: "right bottom", at: "left top" }, size, viewport, viewport)).toEqual({ left: 0, top: 0 });
  });

  it("pins a window larger than the viewport to its start, never above the top", () => {
    expect(placeBox({}, { width: 2000, height: 1200 }, viewport, viewport)).toEqual({ left: 0, top: 0 });
  });
});
