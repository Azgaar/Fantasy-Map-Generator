import { beforeEach, describe, expect, test } from "vitest";
import { getLabel3dStyle } from "./label-3d-style";

describe("getLabel3dStyle", () => {
  beforeEach(() => {
    globalThis.style = {
      labels: {
        groups: {
          states: { "font-family": "State Font", "data-size": 20, fill: "#111111", "letter-spacing": 0.5 },
          town: { "font-family": "Town Font", "data-size": 4, fill: "#222222" },
          addedLabels: {},
          shared: { "font-family": "Shared Font", "data-size": 12, fill: "#abcdef", "letter-spacing": 1 }
        }
      },
      burgIcons: {},
      anchors: {}
    };
  });

  test("resolves custom groups and applies per-label typography overrides", () => {
    expect(getLabel3dStyle("state", "shared", { fontSize: 150, letterSpacing: 2 }, 0.5)).toEqual({
      font: "Shared Font",
      size: 9,
      color: "#abcdef",
      letterSpacing: 2
    });
  });

  test("falls back through the unified Label Group resolver", () => {
    expect(getLabel3dStyle("burg", "missing")).toEqual({
      font: "Town Font",
      size: 4,
      color: "#222222",
      letterSpacing: 0
    });
  });
});
