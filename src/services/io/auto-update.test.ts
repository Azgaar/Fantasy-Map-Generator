// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { resolveVersionConflicts } from "./auto-update";

beforeEach(() => {
  document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox"></g></svg>`;
});

describe("v1.144 layer id migration", () => {
  it("maps exceptional legacy toggle ids and preserves unknown dependencies", () => {
    globalThis.options = {
      labels: {
        groups: ["toggleHeight", "toggleMarketsLayer", "toggleBurgIcons", "toggleScaleBar", "customLayer"].map(
          (layerDependency, index) => ({
            name: `group-${index}`,
            type: "added",
            layerDependency,
            zoom: { min: null, max: null }
          })
        )
      }
    } as typeof globalThis.options;
    const data: string[] = [];

    resolveVersionConflicts("1.143.0", data);

    expect(options.labels?.groups.map(group => group.layerDependency)).toEqual([
      "heightmap",
      "markets",
      "burgIcons",
      "scaleBar",
      "customLayer"
    ]);
    expect(JSON.parse(data[50])).toEqual({ order: [], active: [] });
  });
});
