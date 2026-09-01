// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import indexHtml from "@/index.html?raw";
import "@/generators/features"; // migrations call the Features module through its global
import { VERSION } from "@/services/versioning";
import { resolveVersionConflicts } from "./auto-update";

beforeEach(() => {
  document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox"></g></svg>`;
  localStorage.clear();
  globalThis.options = { labels: { groups: [] } } as unknown as typeof globalThis.options;
  globalThis.pack = { features: [] } as unknown as typeof globalThis.pack; // migrations run against a loaded map
  (globalThis as typeof globalThis & { getStylePreset: () => Promise<[string, object]> }).getStylePreset = async () => [
    "default",
    {}
  ];
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

  it("keeps an empty layer group that is the only one with its id", () => {
    document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox">
      <g id="cults" opacity="0.6" stroke="#777777" stroke-width="0.5" style="display: none;"></g>
      <g id="texture" data-href="./images/textures/marble-big.jpg" mask="url(#land)" style="display: none;"></g>
    </g></svg>`;

    resolveVersionConflicts("1.144.0", []);

    const cults = document.querySelector("#cults");
    expect(cults).not.toBeNull();
    expect(cults?.getAttribute("stroke")).toBe("#777777");
    expect(cults?.getAttribute("stroke-width")).toBe("0.5");
    // the style migration harvests store-owned attrs off the DOM: the href now lives in the store
    expect(document.querySelector("#texture")).not.toBeNull();
    expect(document.querySelector("#texture")?.getAttribute("data-href")).toBeNull();
    expect((globalThis as any).styles.texture.options.href).toBe("./images/textures/marble-big.jpg");
  });

  it("keeps an empty declared child group that is the only one with its id", () => {
    document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox">
      <g id="routes">
        <g id="roads" stroke="#d06324" stroke-width="0.35"><path id="road1"></path></g>
        <g id="searoutes" stroke="#ffffff" stroke-width="0.35" stroke-dasharray="1 2"></g>
      </g>
    </g></svg>`;

    resolveVersionConflicts("1.144.0", []);

    const searoutes = document.querySelector("#routes > #searoutes");
    expect(searoutes).not.toBeNull();
    expect(searoutes?.getAttribute("stroke")).toBe("#ffffff");
    expect(searoutes?.getAttribute("stroke-width")).toBe("0.35");
  });

  it("does not clean current maps", () => {
    document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox">
      <g id="routes"><g id="empty"></g></g>
    </g></svg>`;

    resolveVersionConflicts("1.145.0", []);

    expect(document.querySelector("#routes > #empty")).not.toBeNull();
  });
});

describe("v1.145.2 moved vertices recovery", () => {
  // a ring of 4 vertices around the central one, each connected to its two neighbors and to the center
  const createGraph = () => ({
    features: [],
    vertices: {
      p: [
        [10, 10],
        [0, 0],
        [20, 0],
        [20, 20],
        [0, 20]
      ],
      v: [
        [1, 2, 3],
        [4, 2, 0],
        [1, 3, 0],
        [2, 4, 0],
        [3, 1, 0]
      ]
    }
  });

  const withStates = (d: string) => /* html */ `<svg id="map"><g id="viewbox"><g id="regions"><g id="statesBody">
    <path fill="#aaa" d="${d}"></path></g></g></g></svg>`;

  beforeEach(() => {
    globalThis.pack = createGraph() as unknown as typeof globalThis.pack;
  });

  it("recovers a vertex dragged out of its generated position", () => {
    document.body.innerHTML = withStates("M0,0 L20,0 24.5,21 0,20 Z"); // vertex 3 was dragged
    const data: string[] = [];

    resolveVersionConflicts("1.145.1", data);

    expect(JSON.parse(data[51])).toEqual({
      pack: {
        vertices: {
          p: {
            3: [
              [20, 20],
              [24.5, 21]
            ]
          }
        }
      }
    });
  });

  it("keeps out of the way when nothing was dragged", () => {
    document.body.innerHTML = withStates("M0,0 L20,0 20,20 0,20 Z");
    const data: string[] = [];

    resolveVersionConflicts("1.145.1", data);

    expect(data[51]).toBeUndefined();
  });

  it("ignores an svg that does not match the graph", () => {
    document.body.innerHTML = withStates("M1,1 L2,2 3,3 4,4 5,5 6,6 7,7 8,8 Z");
    const data: string[] = [];

    resolveVersionConflicts("1.145.1", data);

    expect(data[51]).toBeUndefined();
  });

  it("does not touch maps that carry the data", () => {
    document.body.innerHTML = withStates("M0,0 L20,0 24.5,21 0,20 Z");
    const data: string[] = [];
    data[51] = "{}";

    resolveVersionConflicts("1.145.1", data);
    resolveVersionConflicts("1.146.0", data);

    expect(data[51]).toBe("{}");
  });
});

describe("v1.146 rendering groups", () => {
  beforeEach(() => {
    globalThis.pack = {
      features: [
        0,
        { i: 1, type: "island", group: "continent" },
        { i: 2, type: "island", group: "lake_island" },
        { i: 3, type: "lake", group: "salt" },
        { i: 4, type: "lake", group: "freshwater" } // the old group is the classification
      ]
    } as unknown as typeof globalThis.pack;

    document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox">
      <g id="coastline">
        <g id="sea_island"><use data-f="1"></use></g>
        <g id="lake_island"><use data-f="2"></use></g>
      </g>
      <g id="lakes">
        <g id="freshwater"><use data-f="4"></use></g>
        <g id="my_lakes"><use data-f="3"></use></g>
      </g>
    </g></svg>`;
  });

  it("adopts the svg placement of every feature", () => {
    resolveVersionConflicts("1.145.1", []);

    expect(pack.features.slice(1).map(feature => feature.group)).toEqual([
      "sea_island",
      "lake_island",
      "my_lakes", // the subtype says salt, the svg says the user moved it
      "freshwater"
    ]);
    expect(pack.features.slice(1).map(feature => feature.subtype)).toEqual([
      "continent",
      "lake_island",
      "salt",
      "freshwater"
    ]);
  });

  it("derives a group for features the svg does not place", () => {
    document.body.innerHTML = '<svg id="map"><g id="viewbox"></g></svg>'; // nothing was drawn

    resolveVersionConflicts("1.145.1", []);

    expect(pack.features.slice(1).map(feature => feature.group)).toEqual([
      "sea_island",
      "lake_island",
      "salt",
      "freshwater"
    ]);
  });

  it("leaves current maps alone", () => {
    resolveVersionConflicts("1.146.0", []);

    expect(pack.features.slice(1).every(feature => !feature.subtype)).toBe(true);
  });
});

// the .map file carries the whole #map svg, so its defs are only what the file was saved with
describe("missing svg defs", () => {
  const getDeftempIds = () => Array.from(document.querySelectorAll("#deftemp > *"), node => node.id);

  it("recreates the defs an old saved svg never had", () => {
    document.body.innerHTML = /* html */ `<svg id="map"><defs></defs><g id="viewbox"></g></svg>`;

    resolveVersionConflicts("1.147.0", []);

    expect(getDeftempIds()).toEqual([
      "featurePaths",
      "textPaths",
      "statePaths",
      "defs-emblems",
      "land",
      "water",
      "fog"
    ]);
    expect(document.querySelector("#fog rect")).not.toBeNull();
    expect(document.getElementById("oceanicPattern")).not.toBeNull();
    expect(document.getElementById("vignette-rect")).not.toBeNull();
  });

  // a pre-v1.104 svg: the feature geometry is inlined into the masks and #featurePaths is absent
  it("adds only what is missing, leaving the existing defs alone", () => {
    document.body.innerHTML = /* html */ `<svg id="map">
      <defs>
        <g id="deftemp">
          <mask id="land"><path id="land_2"></path></mask>
          <mask id="water"><path id="water_2"></path></mask>
          <g id="textPaths"><path id="textPath_1"></path></g>
          <g id="statePaths"></g>
          <mask id="fog"><rect></rect></mask>
        </g>
      </defs>
      <g id="viewbox"></g>
    </svg>`;

    resolveVersionConflicts("1.147.0", []);

    expect(getDeftempIds()).toEqual([
      "land",
      "water",
      "textPaths",
      "statePaths",
      "fog",
      "featurePaths",
      "defs-emblems"
    ]);
    expect(document.querySelectorAll("#textPaths path")).toHaveLength(1); // existing content is left alone
    expect(document.getElementById("vignette-rect")).not.toBeNull();
  });

  it("leaves current maps alone", () => {
    document.body.innerHTML = /* html */ `<svg id="map"><defs></defs><g id="viewbox"></g></svg>`;

    resolveVersionConflicts(VERSION, []);

    expect(document.getElementById("deftemp")).toBeNull();
  });

  // the migration carries its own copy of the markup, so it drifts the moment index.html gains a
  // defs element it does not know about. #filters is out of scope: it is large, static and old maps have it
  it("restores every defs element index.html declares", () => {
    const defs = indexHtml.slice(
      indexHtml.indexOf("<defs>", indexHtml.indexOf('id="map"')),
      indexHtml.indexOf("</defs>")
    );
    const declared = Array.from(defs.replace(/<g id="filters">[\s\S]*?<\/g>/, "").matchAll(/\bid="([^"]+)"/g));

    document.body.innerHTML = /* html */ `<svg id="map"><defs></defs><g id="viewbox"></g></svg>`;
    resolveVersionConflicts("1.147.0", []);

    const restored = Array.from(document.querySelectorAll("#map defs [id]"), node => node.id);
    expect(restored).toEqual(declared.map(([, id]) => id));
  });
});
