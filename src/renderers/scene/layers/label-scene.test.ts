import { describe, expect, it } from "vitest";
import type { LabelRenderState } from "./label-scene";
import { buildLabelScene, layoutCurvedGlyphs, resolveLabelStyle } from "./label-scene";

describe("label scene", () => {
  it("builds ordered groups with stable domain data and reports unsupported filters", () => {
    const state: LabelRenderState = {
      groups: [
        { layerDependency: "toggleStates", name: "state", type: "state", zoom: { max: 4.5, min: null } },
        { active: false, name: "added", type: "added", zoom: { max: 6, min: 0.2 } }
      ],
      labels: [
        {
          anchor: [10, 12],
          dx: 2,
          dy: -1,
          entityId: 1,
          fontSize: 50,
          group: "state",
          id: "stateLabel1",
          text: "North|Realm",
          type: "state"
        },
        { anchor: [5, 5], entityId: 2, group: "added", hidden: true, id: "addedLabel2", text: "Hidden", type: "added" }
      ],
      resizeOnZoom: true,
      showAll: false,
      styles: {
        added: labelStyle({ "font-size": "18%" }),
        state: labelStyle({
          filter: "url(#blur5)",
          "font-size": "20%",
          style: "text-shadow: white 0px 1px 4px"
        })
      }
    };

    const scene = buildLabelScene(state, "world:3");

    expect(scene.revision).toBe("labels:world:3");
    expect(scene.groups.map(group => group.name)).toEqual(["state", "added"]);
    expect(scene.groups[0]).toMatchObject({ active: true, dependency: "states", maxScale: 4.5, minScale: null });
    expect(scene.groups[0].labels[0]).toMatchObject({
      anchorX: 12,
      anchorY: 11,
      domainId: "stateLabel1",
      fontSize: 10,
      text: "North\nRealm"
    });
    expect(scene.groups[1].labels).toEqual([]);
    expect(scene.bounds).toEqual({ maxX: 12, maxY: 11, minX: 12, minY: 11 });
    expect(scene.unsupportedEffects).toEqual(["state:filter:url(#blur5)"]);
  });

  it("resolves text shadows and samples curved glyph positions deterministically", () => {
    expect(resolveLabelStyle(labelStyle({ style: "text-shadow: #fff -2px 3px 6px" })).shadow).toEqual({
      blur: 6,
      color: "#fff",
      distance: Math.hypot(-2, 3),
      offsetX: -2,
      offsetY: 3
    });

    const first = layoutCurvedGlyphs(
      "Road",
      [
        [0, 0],
        [5, 2],
        [10, 0]
      ],
      2,
      0.2,
      50
    );
    const second = layoutCurvedGlyphs(
      "Road",
      [
        [0, 0],
        [5, 2],
        [10, 0]
      ],
      2,
      0.2,
      50
    );
    expect(first).toEqual(second);
    expect(first).toHaveLength(4);
    expect(first.every(glyph => Number.isFinite(glyph.x) && Number.isFinite(glyph.y))).toBe(true);
  });
});

function labelStyle(overrides: Partial<LabelRenderState["styles"][string]> = {}) {
  return {
    fill: "#3e3e4b",
    filter: null,
    "font-family": "Almendra SC",
    "font-size": "18%",
    "letter-spacing": 0,
    opacity: 1,
    stroke: "#3a3a3a",
    "stroke-width": 0,
    style: null,
    ...overrides
  };
}
