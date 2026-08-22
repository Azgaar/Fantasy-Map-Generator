// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/generators/added-labels";
import "@/generators/features"; // migrations call the Features module through its global
import "@/generators/labels-generator";
import { resolveVersionConflicts, restoreLayerStyles } from "./auto-update";

beforeEach(() => {
  document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox"></g></svg>`;
  localStorage.clear();
  globalThis.options = { labels: { groups: [] } } as unknown as typeof globalThis.options;
  globalThis.pack = { features: [] } as unknown as typeof globalThis.pack; // migrations run against a loaded map
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
    expect(document.querySelector("#texture")?.getAttribute("data-href")).toBe("./images/textures/marble-big.jpg");
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

const PRESET = {
  "#cults": { opacity: 0.6, stroke: "#777777", "stroke-width": 0.5, filter: null },
  "#searoutes": { opacity: 0.9, stroke: "#ffffff", "stroke-width": 0.35, mask: null },
  "#terrain": { opacity: 0.8, set: "simple", size: 1, density: 0.4 },
  "#fogging": { opacity: 0.98, fill: "#30426f" },
  "#terrs > #landHeights": { opacity: 1, scheme: "bright", mask: "url(#land)" }
};

const viewbox = (html: string) => {
  document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox">${html}</g></svg>`;
};

const attrs = (id: string) => {
  const el = document.getElementById(id)!;
  return Object.fromEntries(Array.from(el.attributes, a => [a.name, a.value]));
};

beforeEach(() => {
  viewbox("");
  localStorage.clear();
  (globalThis as { getStylePreset?: unknown }).getStylePreset = vi.fn(async () => ["default", PRESET]);
});

describe("restoreLayerStyles", () => {
  it("restores the preset style of a bare layer group", async () => {
    viewbox(/* html */ `<g id="cults" style="display: none;"></g>`);

    await restoreLayerStyles();

    expect(attrs("cults")).toMatchObject({ opacity: "0.6", stroke: "#777777", "stroke-width": "0.5" });
  });

  it("restores the preset style of a bare declared child group", async () => {
    viewbox(/* html */ `<g id="routes"><g id="searoutes"></g></g>`);

    await restoreLayerStyles();

    expect(attrs("searoutes")).toMatchObject({ opacity: "0.9", stroke: "#ffffff", "stroke-width": "0.35" });
  });

  it("resolves a child group through its parent selector", async () => {
    viewbox(/* html */ `<g id="terrs"><g id="landHeights"></g></g>`);

    await restoreLayerStyles();

    expect(attrs("landHeights")).toMatchObject({ scheme: "bright", mask: "url(#land)" });
  });

  it("skips the attributes the preset nulls out", async () => {
    viewbox(/* html */ `<g id="cults"></g>`);

    await restoreLayerStyles();

    expect(document.getElementById("cults")!.hasAttribute("filter")).toBe(false);
  });

  it("leaves a group that still has any style attribute alone", async () => {
    viewbox(/* html */ `<g id="cults" stroke="#123456"></g>`);

    await restoreLayerStyles();

    expect(attrs("cults")).toEqual({ id: "cults", stroke: "#123456" });
  });

  it("heals a group whose only attributes are the ones the registry declares", async () => {
    viewbox(/* html */ `<g id="fogging" mask="url(#fog)"></g>`);

    await restoreLayerStyles();

    expect(attrs("fogging")).toMatchObject({ opacity: "0.98", fill: "#30426f" });
  });

  it("does not write the relief options onto the terrain group", async () => {
    viewbox(/* html */ `<g id="terrain"></g>`);

    await restoreLayerStyles();

    expect(attrs("terrain")).toEqual({ id: "terrain", opacity: "0.8" });
  });

  it("leaves a bare group the preset says nothing about alone", async () => {
    viewbox(/* html */ `<g id="debug"></g>`);

    await restoreLayerStyles();

    expect(attrs("debug")).toEqual({ id: "debug" });
  });

  it("ignores an element that is not a group", async () => {
    viewbox(/* html */ `<rect id="cults"></rect>`);

    await restoreLayerStyles();

    expect(attrs("cults")).toEqual({ id: "cults" });
  });

  it("uses the preset the user last selected", async () => {
    localStorage.setItem("presetStyle", "ancient");
    viewbox(/* html */ `<g id="cults"></g>`);

    await restoreLayerStyles();

    expect((globalThis as unknown as { getStylePreset: unknown }).getStylePreset).toHaveBeenCalledWith("ancient");
  });

  describe("wound detection", () => {
    it("does not run for maps saved at or after the version that shipped it", async () => {
      viewbox(/* html */ `<g id="cults"></g>`);

      await resolveVersionConflicts("1.148.0", []);

      expect(attrs("cults")).toEqual({ id: "cults" });
    });

    it("runs as a standard migration for older maps", async () => {
      viewbox(/* html */ `<g id="cults"></g>`);

      await resolveVersionConflicts("1.147.1", []);

      expect(attrs("cults")).toMatchObject({ opacity: "0.6" });
    });

    it("heals the first version that could be damaged", async () => {
      viewbox(/* html */ `<g id="cults"></g>`);

      await restoreLayerStyles();

      expect(document.getElementById("cults")!.getAttribute("stroke")).toBe("#777777");
    });
  });
});

describe("v1.140 label group migration", () => {
  // a legacy burg group can be named like a group the migration creates by a fixed name
  const LEGACY_BURG_GROUPS = [
    { id: "towns", size: 3 },
    { id: "river", size: 50 }
  ];

  function setupLegacyMap() {
    const burgGroups = LEGACY_BURG_GROUPS.map(
      ({ id, size }) => `<g id="${id}" data-size="${size}" fill="#3e3e4b"></g>`
    ).join("");

    document.body.innerHTML = /* html */ `<svg id="map">
      <defs id="deftemp"></defs>
      <g id="viewbox">
        <g id="labels">
          <g id="burgLabels">${burgGroups}</g>
          <g id="addedLabels" data-size="120"></g>
          <g id="states" data-size="70"></g>
        </g>
      </g>
    </svg>`;

    globalThis.options = {
      labels: { groups: [] },
      burgs: { groups: LEGACY_BURG_GROUPS.map(({ id }) => ({ name: id })) }
    } as unknown as typeof globalThis.options;
    globalThis.style = { labels: { groups: {} } } as unknown as typeof globalThis.style;
    globalThis.pack = {
      features: [],
      burgs: [0, { i: 1, group: "river" }],
      addedLabels: []
    } as unknown as typeof globalThis.pack;
    globalThis.notes = [];
  }

  // the Label Groups editor renders the bounds into <input type="number" min="0.01">, so a bound
  // below that leaves the form invalid and Apply does nothing until every such row is hand-edited
  it("derives zoom bounds the Label Groups editor accepts", () => {
    setupLegacyMap();

    resolveVersionConflicts("1.139.0", []);

    const outOfRange = options.labels.groups
      .filter(({ zoom }) => (zoom.min !== null && zoom.min < 0.01) || (zoom.max !== null && zoom.max < 0.01))
      .map(({ name, zoom }) => `${name}[${zoom.min}, ${zoom.max}]`);
    expect(outOfRange).toEqual([]);

    // a group already larger than 12px at any zoom has no lower bound
    expect(options.labels.groups.find(({ name }) => name === "state")?.zoom).toEqual({ min: null, max: 2.4 });
    expect(options.labels.groups.find(({ name }) => name === "towns")?.zoom).toEqual({ min: 7, max: 79 });
  });
});
