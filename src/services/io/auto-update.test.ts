// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { resolveVersionConflicts } from "./auto-update";

beforeEach(() => {
  document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox"></g></svg>`;
  localStorage.clear();
  globalThis.options = { labels: { groups: [] } } as unknown as typeof globalThis.options;
});

describe("v1.144 layer id migration", () => {
  it("clears legacy fogging state", () => {
    document.body.innerHTML = /* html */ `<svg id="map">
      <defs id="deftemp"><mask id="fog"><rect></rect><path id="focusState1"></path></mask></defs>
      <g id="viewbox"><g id="fogging-cont"><g id="fogging"><rect></rect></g></g></g>
    </svg>`;

    resolveVersionConflicts("1.143.0", []);

    expect(document.querySelectorAll("#fog path")).toHaveLength(0);
    expect(document.querySelectorAll("#fogging rect")).toHaveLength(0);
  });

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

  // the presets outlive the map file in localStorage, so they carry the old ids until this pass rewrites them
  it("remaps the stored layers presets, passing ids it does not know through", () => {
    localStorage.setItem(
      "presets",
      JSON.stringify({
        political: ["toggleStates", "toggleBorders", "toggleScaleBar"],
        mine: ["toggleBiomes", "customLayer"]
      })
    );

    resolveVersionConflicts("1.143.0", []);

    expect(JSON.parse(localStorage.getItem("presets")!)).toEqual({
      political: ["states", "borders", "scaleBar"],
      mine: ["biomes", "customLayer"]
    });
  });

  it("rewrites already-current presets to themselves, so a repeated pass is harmless", () => {
    localStorage.setItem("presets", JSON.stringify({ mine: ["biomes", "states"] }));

    resolveVersionConflicts("1.143.0", []);
    resolveVersionConflicts("1.143.0", []);

    expect(JSON.parse(localStorage.getItem("presets")!)).toEqual({ mine: ["biomes", "states"] });
  });

  it("leaves unparsable stored presets alone instead of failing the load", () => {
    localStorage.setItem("presets", "{not json");

    expect(() => resolveVersionConflicts("1.143.0", [])).not.toThrow();
    expect(localStorage.getItem("presets")).toBe("{not json");
  });
});

describe("v1.145 svg layer cleanup", () => {
  it("removes empty groups and keeps one non-empty group for duplicated ids", () => {
    document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox">
      <g id="routes">
        <g id="roads"> </g>
        <g id="roads"><path id="road1"></path></g>
        <g id="trails"><path id="trail1"></path></g>
        <g id="trails"><path id="trail2"></path></g>
        <g id="empty"> </g>
      </g>
    </g></svg>`;

    resolveVersionConflicts("1.144.0", []);

    expect(document.querySelectorAll("#routes > #roads")).toHaveLength(1);
    expect(document.querySelector("#routes > #roads #road1")).not.toBeNull();
    expect(document.querySelectorAll("#routes > #trails")).toHaveLength(1);
    expect(document.querySelector("#routes > #trails #trail1")).not.toBeNull();
    expect(document.querySelector("#routes > #empty")).toBeNull();
  });

  it("does not clean current maps", () => {
    document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox">
      <g id="routes"><g id="empty"></g></g>
    </g></svg>`;

    resolveVersionConflicts("1.145.0", []);

    expect(document.querySelector("#routes > #empty")).not.toBeNull();
  });
});
