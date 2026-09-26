// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import indexHtml from "@/index.html?raw";
import "@/generators/added-labels";
import "@/generators/features-generator"; // migrations call the Features module through its global
import "@/generators/burgs-generator"; // the burg sets that tell style icon references from text
import "@/generators/goods-generator"; // the goods icon namespace the 1.154 step migrates into
import "@/generators/relief-generator"; // the relief set namespace the 1.154 step migrates into
import { confirmationDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { Styles } from "@/generators/styles";
import * as versioning from "@/services/versioning";
import { VERSION } from "@/services/versioning";
import { downloadFile } from "@/utils";
import { safeParseJSON } from "@/utils/stringUtils";
import { migrateLegacySettings, resolveVersionConflicts } from "./auto-update";

beforeEach(() => {
  document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox"></g></svg>`;
  localStorage.clear();
  options.map.labels.groups = [];
  options.map.style.preset = "default";
  globalThis.pack = { features: [] } as unknown as typeof globalThis.pack; // migrations run against a loaded map
});

vi.mock("@/services/style-presets", () => ({
  StylePresetsService: { load: async () => ({ name: "default", styles: {} }) }
}));

it.each([18, 180])("keeps legacy custom labels after saving and reloading a font size of %s", async fontSize => {
  const data = readFileSync("tests/fixtures/1.139.4.map", "utf8").split("\r\n");
  migrateLegacySettings("1.139.4", data);
  Options.applyLoaded(JSON.parse(data[1]));
  document.body.innerHTML = data[5];
  document.getElementById("forests")!.dataset.size = String(fontSize);
  globalThis.pack = {
    states: JSON.parse(data[14]),
    burgs: JSON.parse(data[15]),
    addedLabels: []
  } as unknown as typeof pack;

  // Exercise the label migration without unrelated versions' graph and DOM setup.
  const compare = vi.spyOn(versioning, "compareVersions");
  compare.mockImplementation((_a, b) => ({ isOlder: b === "1.140.0", isNewer: false, isEqual: false }));
  try {
    await resolveVersionConflicts("1.139.4", data);
  } finally {
    compare.mockRestore();
  }

  const group = structuredClone(options.map.labels.groups.find(group => group.name === "forests"));
  expect(group?.zoom.min).toBe(0);
  expect(group?.zoom.max).toBeGreaterThanOrEqual(0);
  expect(pack.addedLabels.some(label => label.label.group === "forests")).toBe(true);
  Options.applyLoaded(JSON.parse(JSON.stringify(options.map)));
  expect(options.map.labels.groups.find(group => group.name === "forests")).toEqual(group);
});

describe("v1.144 layer id migration", () => {
  it.each(["1.143.0", VERSION])(
    "repairs nested duplicate fogging groups in %s saves across reload",
    async mapVersion => {
      document.body.innerHTML = /* html */ `<svg id="map">
      <defs id="deftemp"><mask id="fog"><rect></rect><path id="focusState1"></path></mask></defs>
      <g id="viewbox"><g id="fogging-cont" mask="url(#fog)">
        <g id="fogging" opacity="0.7"><rect></rect></g>
      </g><g id="fogging-cont"><g id="fogging"><rect></rect></g></g></g>
    </svg>`;
      const data: string[] = [];
      await resolveVersionConflicts(mapVersion, data);
      Layers.restore(data[50] ? JSON.parse(data[50]) : { order: [], active: [] });

      const clone = document.getElementById("map")!.cloneNode(true);
      const savedSvg = new XMLSerializer().serializeToString(clone);
      const savedLayers = JSON.stringify(Layers.state);
      document.getElementById("map")!.remove();
      document.body.insertAdjacentHTML("afterbegin", savedSvg);
      await resolveVersionConflicts(VERSION, data);
      Layers.restore(JSON.parse(savedLayers));

      expect(document.querySelectorAll("#fogging")).toHaveLength(1);
      expect(document.querySelectorAll("#viewbox > #fogging")).toHaveLength(1);
      expect(document.getElementById("fogging-cont")).toBeNull();
      expect(document.getElementById("fogging")?.getAttribute("opacity")).toBe("0.7");
      expect(document.querySelectorAll("#fog path, #fogging rect")).toHaveLength(mapVersion === VERSION ? 2 : 0);
    }
  );

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
    const groups = ["toggleHeight", "toggleMarketsLayer", "toggleBurgIcons", "toggleScaleBar", "customLayer"].map(
      (layerDependency, index) => ({
        name: `group-${index}`,
        type: "added",
        layerDependency,
        zoom: { min: null, max: null }
      })
    );
    const settings = Array<string>(20).fill("");
    settings[19] = JSON.stringify({ labels: { groups } });
    const data = ["1.143.0||||1280|800", settings.join("|")];

    migrateLegacySettings("1.143.0", data);
    resolveVersionConflicts("1.143.0", data);

    const migratedGroups: { layerDependency: string }[] = JSON.parse(data[1]).labels.groups;
    expect(migratedGroups.map(group => group.layerDependency)).toEqual([
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
      cells: { culture: [0], p: [[10, 10]] },
      cultures: [{ i: 0, base: 0 }],
      features: [
        0,
        { i: 1, type: "island", group: "continent", firstCell: 0 },
        { i: 2, type: "island", group: "lake_island", firstCell: 0 },
        { i: 3, type: "lake", group: "salt", firstCell: 0 },
        { i: 4, type: "lake", group: "freshwater", firstCell: 0 } // the old group is the classification
      ]
    } as unknown as typeof globalThis.pack;
    globalThis.Names = { getCulture: () => "Named" } as unknown as typeof Names;

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
describe("v1.151.2 label group display cleanup", () => {
  // v1.140-1.151 harvested the zoom auto-visibility display: none into the persisted label group
  // style, and since v1.150 the store is re-applied over the saved svg, so the record has to be cleaned
  function stylesRecord(style: string | null) {
    const record = structuredClone(Styles.defaults) as {
      labels: { groups: Record<string, { attrs: { style: string | null } }> };
    };
    record.labels.groups.hamlet = {
      ...record.labels.groups.city,
      attrs: { ...record.labels.groups.city.attrs, style }
    };
    return record;
  }

  it("strips display from stored label group styles, keeping the rest of the record", () => {
    const data: string[] = [];
    data[48] = JSON.stringify(
      stylesRecord("text-shadow: white 0px 0px 4px; display: none; transform: translate(0em, -0.4em)")
    );

    resolveVersionConflicts("1.151.1", data);

    const expected = stylesRecord("text-shadow: white 0px 0px 4px; transform: translate(0em, -0.4em)");
    expect(JSON.parse(data[48])).toEqual(expected);
  });

  it("stores null when display was the only declaration", () => {
    const data: string[] = [];
    data[48] = JSON.stringify(stylesRecord("display: none"));

    resolveVersionConflicts("1.151.1", data);

    expect(JSON.parse(data[48]).labels.groups.hamlet.attrs.style).toBeNull();
  });

  it("leaves current maps alone", () => {
    const data: string[] = [];
    data[48] = JSON.stringify(stylesRecord("display: none"));

    resolveVersionConflicts(VERSION, data);

    expect(JSON.parse(data[48]).labels.groups.hamlet.attrs.style).toBe("display: none");
  });
});

describe("v1.153.0 empty burg style groups", () => {
  /** the pre-v1.154 shape: two records keyed by the same burg group names */
  function legacyBurgRecord() {
    const record = JSON.parse(JSON.stringify(Styles.defaults));
    delete record.burgIcons;
    record.burgIcons = { burgIcons: { groups: {} }, anchors: { groups: {} } };
    return record;
  }

  it("recovers empty records from the saved SVG and preserves them across saving", async () => {
    document.body.innerHTML = `<svg id="map">
      <g id="burgIcons"><g id="cities" font-size="18"></g></g>
      <g id="anchors"><g id="cities" font-size="18"></g><g id="towns" font-size="12"></g></g>
    </svg>`;
    const data: string[] = [];
    data[48] = JSON.stringify(legacyBurgRecord());

    await resolveVersionConflicts("1.152.0", data);
    const parsed = Styles.parse(JSON.parse(data[48]));
    expect(parsed.burgIcons.groups.cities.groups.icons.options.size).toBe(18);
    expect(parsed.burgIcons.groups.cities.groups.anchors.options.size).toBe(18);
    expect(parsed.burgIcons.groups.towns.groups.anchors.options.size).toBe(12);
    parsed.burgIcons.groups.cities.groups.icons.options.size = 6;
    data[48] = JSON.stringify(parsed);

    await resolveVersionConflicts(VERSION, data);
    expect(Styles.parse(JSON.parse(data[48])).burgIcons.groups.cities.groups.icons.options.size).toBe(6);
  });

  it("uses parser defaults when empty groups have no saved SVG styles", async () => {
    const data: string[] = [];
    data[48] = JSON.stringify(legacyBurgRecord());

    await resolveVersionConflicts("1.152.0", data);

    expect(Styles.parse(JSON.parse(data[48])).burgIcons).toEqual(Styles.defaults.burgIcons);
  });
});

describe("v1.154.0 style record normalization", () => {
  it("restores the anchor icon on port groups that carry the burg default", async () => {
    const record = JSON.parse(JSON.stringify(Styles.defaults));
    const icons = structuredClone(record.burgIcons.groups.town.groups.icons);
    icons.options.icon = "#icon-circle";
    const anchors = structuredClone(record.burgIcons.groups.town.groups.anchors);
    anchors.options = { size: 2, icon: "#icon-circle" };
    delete record.burgIcons;
    record.burgIcons = { burgIcons: { groups: { town: icons } }, anchors: { groups: { town: anchors } } };
    const data: string[] = [];
    data[48] = JSON.stringify(record);

    await resolveVersionConflicts("1.153.0", data);
    const parsed = Styles.parse(JSON.parse(data[48]));
    expect(parsed.burgIcons.groups.town.groups.anchors.options).toEqual({ size: 2, icon: "ports-anchor" });
    expect(parsed.burgIcons.groups.town.groups.icons.options.icon).toBe("burgs-atlas-circle");
  });

  it("drops the old #icons layer element so the #burgIcons layer takes over", async () => {
    document.body.innerHTML = `<svg id="map"><g id="viewbox">
      <g id="icons" data-layer="burgIcons"><g id="burgIcons"><g id="towns"></g></g><g id="anchors"></g></g>
    </g></svg>`;

    await resolveVersionConflicts("1.153.0", []);

    // all three old elements go; the registry recreates #burgIcons under #viewbox
    expect(document.getElementById("icons")).toBeNull();
    expect(document.getElementById("burgIcons")).toBeNull();
    expect(document.getElementById("anchors")).toBeNull();
  });
});

describe("v1.153.0 feature subtype and lake group styles", () => {
  function stylesRecord() {
    const record = structuredClone(Styles.defaults) as unknown as { lakes: Record<string, unknown> };
    const groups = record.lakes.groups as Record<string, { attrs: { fill: string } }>;
    groups.freshwater.attrs.fill = "#0000ff";
    record.lakes = groups; // v1.150-1.152 kept the stock groups directly under lakes
    return record;
  }

  beforeEach(() => {
    globalThis.pack = {
      cells: {
        i: [0, 1],
        f: [1, 2],
        area: [30, 20],
        culture: [1, 1],
        p: [
          [10, 10],
          [20, 20]
        ]
      },
      features: [
        0,
        { i: 1, type: "ocean", subtype: "ocean", group: "sea_island", firstCell: 0, cells: 500, area: 0 }, // v1.146 gave oceans both
        { i: 2, type: "island", subtype: "isle", group: "sea_island", firstCell: 1 },
        { i: 3, type: "lake", subtype: "my_lakes", group: "my_lakes", firstCell: 1, name: "My Lake" }, // the old lake editor copied the group name
        { i: 4, type: "lake", subtype: "salt", group: "freshwater", firstCell: 1 }
      ],
      cultures: [
        { i: 0, base: 0 },
        { i: 1, base: 1 }
      ]
    } as unknown as typeof globalThis.pack;
    globalThis.grid = { cells: { i: new Array(1000) } } as unknown as typeof grid;
    globalThis.Names = { getCulture: () => "Named" } as unknown as typeof Names;

    document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox">
      <g id="lakes">
        <g id="freshwater" data-group="freshwater"><use data-f="4"></use></g>
        <g id="my_lakes" fill="#123456" opacity="0.3"><use data-f="3"></use></g>
      </g>
    </g></svg>`;
  });

  it("keeps stock subtypes, resets invented ones and clears the ocean group", () => {
    resolveVersionConflicts("1.152.0", []);

    expect(pack.features.slice(1).map(feature => feature.subtype)).toEqual(["ocean", "isle", "freshwater", "salt"]);
    expect(pack.features.slice(1).map(feature => feature.group)).toEqual([
      undefined,
      "sea_island",
      "my_lakes", // the rendering group is untouched
      "freshwater"
    ]);
    expect(pack.features[1].area).toBe(30); // summed from its cells: the ocean ring is open at the border
  });

  it("names the features that had no name and keeps the existing ones", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5); // no adjective roll
    resolveVersionConflicts("1.152.0", []);
    random.mockRestore();

    expect(pack.features[1].name).toBeTruthy();
    expect(pack.features[2].name).toBe("Named");
    expect(pack.features[3].name).toBe("My Lake");
    expect(pack.features[4].name).toBe("Named");
  });

  it("names a feature by an adjective when its cell points at a dropped culture", () => {
    pack.cells.culture = [0, 7] as unknown as typeof pack.cells.culture; // no such culture in the map
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    resolveVersionConflicts("1.152.0", []);
    random.mockRestore();

    expect(pack.features[2].name).toBeTruthy();
    expect(pack.features[2].name).not.toBe("Named");
  });

  it("nests the stock lake styles under groups and harvests custom groups from the svg", () => {
    const data: string[] = [];
    data[48] = JSON.stringify(stylesRecord());

    resolveVersionConflicts("1.152.0", data);

    const { groups } = JSON.parse(data[48]).lakes;
    expect(Object.keys(groups)).toEqual([...Object.keys(Styles.defaults.lakes.groups), "my_lakes"]);
    expect(groups.freshwater.attrs.fill).toBe("#0000ff");
    expect(groups.my_lakes.attrs.fill).toBe("#123456");
    expect(groups.my_lakes.attrs.opacity).toBe(0.3);
    expect(groups.my_lakes.attrs.stroke).toBe(groups.freshwater.attrs.stroke); // the rest follows freshwater
    expect(document.getElementById("my_lakes")?.dataset.group).toBe("my_lakes");
  });

  it("is harmless on a record already in the new shape", () => {
    const data: string[] = [];
    data[48] = JSON.stringify(Styles.defaults);

    resolveVersionConflicts("1.152.0", data);

    const { lakes } = JSON.parse(data[48]);
    expect(Object.keys(lakes)).toEqual(["groups"]);
    expect(lakes.groups.freshwater).toEqual(Styles.defaults.lakes.groups.freshwater);
  });

  it("leaves current maps alone", () => {
    const data: string[] = [];
    data[48] = JSON.stringify(stylesRecord());

    resolveVersionConflicts(VERSION, data);

    expect(pack.features[3].subtype).toBe("my_lakes");
    expect(JSON.parse(data[48]).lakes.groups).toBeUndefined();
  });
});

describe("v1.61 ocean pattern migration", () => {
  it("writes an empty href for a map that had no pattern", async () => {
    document.body.innerHTML = /* html */ `<svg id="map"><defs><pattern id="oceanic"><rect></rect></pattern></defs><g id="viewbox"></g></svg>`;
    const compare = vi.spyOn(versioning, "compareVersions");
    compare.mockImplementation((_a, b) => ({ isOlder: b === "1.61.0", isNewer: false, isEqual: false }));
    try {
      await resolveVersionConflicts("1.60.0", []);
    } finally {
      compare.mockRestore();
    }

    const image = document.getElementById("oceanicPattern")!;
    expect(image.getAttribute("href")).toBe("");
    expect(image.getAttribute("width")).toBe("100");
  });

  it.each([
    ['width="100"', ""],
    ["./images/pattern3.png", "./images/pattern3.png"]
  ])("v1.153.2 heals the stored pattern %s to %s", async (pattern, expected) => {
    document.body.innerHTML = /* html */ `<svg id="map"><defs><pattern id="oceanic"><image id="oceanicPattern" href="${pattern}"></image></pattern></defs><g id="viewbox"></g></svg>`;
    // a pre-1.154.0 record kept the pattern in the ocean options; the 1.154.0 step moves it to the pattern group
    const record = structuredClone(Styles.defaults) as unknown as { ocean: { options: Record<string, unknown> } };
    record.ocean.options.pattern = pattern;
    const data: string[] = [];
    data[48] = JSON.stringify(record);

    await resolveVersionConflicts("1.153.1", data);

    expect(JSON.parse(data[48]).ocean.groups.pattern.attrs.href).toBe(expected);
    expect(document.getElementById("oceanicPattern")).toBeNull(); // the stray defs tile is dropped; the renderer rebuilds it
  });
});

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

vi.mock("@/components/dialog/dialog-helpers", () => ({ confirmationDialog: vi.fn(), destroyDialog: vi.fn() }));
vi.mock("@/utils", async importOriginal => ({
  ...(await importOriginal<typeof import("@/utils")>()),
  downloadFile: vi.fn()
}));

describe("v1.152.0 notes moved onto entities", () => {
  async function migrate(notes: object[], versions = ["1.152.0"]) {
    const data = Array<string>(52).fill("");
    data[4] = JSON.stringify(notes);

    const compare = vi.spyOn(versioning, "compareVersions");
    compare.mockImplementation((_a, b) => ({ isOlder: versions.includes(b ?? ""), isNewer: false, isEqual: false }));
    try {
      await resolveVersionConflicts("1.151.2", data);
    } finally {
      compare.mockRestore();
    }
    return data;
  }

  beforeEach(() => {
    vi.mocked(confirmationDialog).mockClear();
    vi.mocked(downloadFile).mockClear();
    globalThis.pack = {
      burgs: [0, { i: 1, name: "Vaeltown" }],
      states: [
        { i: 0, name: "Neutrals" },
        { i: 1, name: "Ardenia", fullName: "Duchy of Ardenia", military: [{ i: 0, name: "1st Cavalry" }] }
      ],
      markers: [
        { i: 4, type: "hot-springs" },
        { i: 5, type: "volcanoes" }
      ],
      rivers: [0, { i: 1, name: "Ald", type: "River" }],
      features: [],
      routes: [],
      provinces: [],
      zones: [],
      journeys: [],
      markets: [],
      addedLabels: [],
      cultures: [],
      religions: [],
      biomes: [],
      goods: []
    } as unknown as typeof pack;
  });

  it("attaches a note to its entity and empties the legacy slot", async () => {
    const data = await migrate([{ id: "burg1", name: "Vaeltown", legend: "A river port" }]);

    expect(pack.burgs[1].note).toBe("A river port");
    expect(data[4]).toBe("");
    expect(confirmationDialog).not.toHaveBeenCalled();
  });

  it("collides the two notes of a river, the element note first", async () => {
    await migrate([
      { id: "riverLabel1", name: "Ald River", legend: "<p>Named for the elder trees</p>" },
      { id: "river1", name: "Ald River", legend: "<p>Fed by three lakes</p>" }
    ]);

    expect(pack.rivers[1].note).toBe("<p>Fed by three lakes</p><p>Named for the elder trees</p>");
  });

  it("preserves lore attached to legacy lake and road ids", async () => {
    pack.features = [{ i: 9, name: "Mirror Lake" }] as typeof pack.features;
    pack.routes = [{ i: 5, name: "Old Road" }] as typeof pack.routes;

    const data = await migrate([
      { id: "lake_9", name: "Mirror Lake", legend: "<p>The drowned city lies below.</p>" },
      { id: "road5", name: "The King's March", legend: "<p>The king never returned.</p>" }
    ]);

    expect(pack.features[0].note).toBe("<p>The drowned city lies below.</p>");
    expect(pack.routes[0].note).toBe("<h3>The King's March</h3><p>The king never returned.</p>");
    expect(data[4]).toBe("");
    expect(confirmationDialog).not.toHaveBeenCalled();
  });

  it("follows renumbered roads and offers lore from a road that cannot be migrated", async () => {
    document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox"><g id="routes"><g id="roads">
      <path id="road0"></path><path id="road7"></path><path id="road1"></path>
    </g></g></g></svg>`;
    for (const node of document.querySelectorAll("path")) {
      Object.assign(node, {
        getTotalLength: () => (node.id === "road0" ? 0 : 10),
        getPointAtLength: (length: number) => ({ x: length, y: 0 })
      });
    }
    pack.cells = { f: new Uint16Array([1, 1]) } as typeof pack.cells;
    vi.stubGlobal("grid", { spacing: 10 });
    vi.stubGlobal("Pack", { findCell: (x: number) => (x < 5 ? 0 : 1) });
    try {
      await migrate(
        [
          { id: "road0", name: "Lost Road", legend: "Lost lore" },
          { id: "road7", name: "road7", legend: "First road lore" },
          { id: "road1", name: "road1", legend: "Second road lore" }
        ],
        ["1.99.0", "1.152.0"]
      );
    } finally {
      vi.unstubAllGlobals();
    }

    expect(pack.routes.map(({ i, note }) => ({ i, note }))).toEqual([
      { i: 0, note: "First road lore" },
      { i: 1, note: "Second road lore" }
    ]);
    expect(confirmationDialog).toHaveBeenCalledOnce();
    const [dialog] = vi.mocked(confirmationDialog).mock.calls[0];
    expect(dialog.message).toContain("1 note(s)");
    dialog.onConfirm?.();
    expect(vi.mocked(downloadFile).mock.calls[0][0]).toBe('id,name,note\n"road0","Lost Road","Lost lore"');
  });

  it("keeps a note title that differs from the entity name as a heading", async () => {
    await migrate([{ id: "burg1", name: "The Siege of Vaeltown", legend: "<p>It held.</p>" }]);

    expect(pack.burgs[1].note).toBe("<h3>The Siege of Vaeltown</h3><p>It held.</p>");
  });

  it("moves a marker note title onto the marker and names the rest from their type", async () => {
    await migrate([{ id: "marker4", name: "Steaming Pools", legend: "Warm all year" }]);

    expect(pack.markers[0]).toMatchObject({ name: "Steaming Pools", note: "Warm all year" });
    expect(pack.markers[1].name).toBe("Volcanoes"); // no note to take a name from
    expect(pack.markers[1].note).toBeUndefined();
  });

  it("drops an empty legacy note rather than turning its title into a heading", async () => {
    await migrate([
      { id: "river1", name: "river1", legend: "" }, // old maps title an untitled note with its element id
      { id: "burg1", name: "Vaeltown", legend: "" }
    ]);

    expect(pack.rivers[1].note).toBeUndefined();
    expect(pack.burgs[1].note).toBeUndefined();
    expect(confirmationDialog).not.toHaveBeenCalled();
  });

  it("does not turn an untitled note's element id into a heading", async () => {
    await migrate([{ id: "river1", name: "river1", legend: "<p>Fed by three lakes</p>" }]);

    expect(pack.rivers[1].note).toBe("<p>Fed by three lakes</p>");
  });

  it("keeps the marker name of an empty note", async () => {
    await migrate([{ id: "marker4", name: "Steaming Pools", legend: "" }]);

    expect(pack.markers[0].name).toBe("Steaming Pools");
    expect(pack.markers[0].note).toBeUndefined();
  });

  it("does not offer an empty note whose element is gone", async () => {
    await migrate([{ id: "burg99", name: "Lost Town", legend: "" }]);

    expect(confirmationDialog).not.toHaveBeenCalled();
  });

  it("does not repeat the short name the labels editor titled a state note with", async () => {
    await migrate([{ id: "stateLabel1", name: "Ardenia", legend: "<p>Founded in 500</p>" }]);

    expect(pack.states[1].note).toBe("<p>Founded in 500</p>");
  });

  it("gives the second note of a duplicated marker id to the second marker", async () => {
    pack.markers = [
      { i: 4, type: "hot-springs" },
      { i: 4, type: "volcanoes" }
    ] as unknown as typeof pack.markers;

    await migrate([
      { id: "marker4", name: "Steaming Pools", legend: "Warm all year" },
      { id: "marker4", name: "Ash Cone", legend: "Last erupted a century ago" }
    ]);

    expect(pack.markers[0]).toMatchObject({ name: "Steaming Pools", note: "Warm all year" });
    expect(pack.markers[1]).toMatchObject({ name: "Ash Cone", note: "Last erupted a century ago" });
  });

  it("does not name a marker after its own element id", async () => {
    await migrate([{ id: "marker4", name: "marker4", legend: "Warm all year" }]);

    expect(pack.markers[0]).toMatchObject({ name: "Hot springs", note: "Warm all year" });
  });

  it("attaches a regiment note through its state", async () => {
    await migrate([{ id: "regiment1-0", name: "1st Cavalry", legend: "Formed in 900 AD" }]);

    expect(pack.states[1].military![0].note).toBe("Formed in 900 AD");
  });

  it.each(["regiment1-99", "regiment99-0", "regiment0-0", "regiment2-0"])(
    "silently drops an unmatched regiment note (%s)",
    async id => {
      pack.states.push({ i: 2, name: "Unarmed State" } as (typeof pack.states)[number]);
      const data = await migrate([{ id, name: "Old Regiment", legend: "Formed in 900 AD" }]);

      expect(data[4]).toBe("");
      expect(confirmationDialog).not.toHaveBeenCalled();
      expect(downloadFile).not.toHaveBeenCalled();
      expect(pack.states[1].military![0].note).toBeUndefined();
    }
  );

  it("offers notes whose element is gone as a csv, and keeps the rest", async () => {
    await migrate([
      { id: "burg1", name: "Vaeltown", legend: "kept" },
      { id: "regiment1-0", name: "1st Cavalry", legend: "Formed in 900 AD" },
      { id: "regiment1-99", name: "Old Regiment", legend: "stale generated description" },
      { id: "burg99", name: "Lost Town", legend: 'dropped, with a "quote"' },
      { id: "someLegacyThing", name: "Older still", legend: "dropped too" }
    ]);

    expect(pack.burgs[1].note).toBe("kept");
    expect(pack.states[1].military![0].note).toBe("Formed in 900 AD");
    expect(confirmationDialog).toHaveBeenCalledOnce();

    const [dialog] = vi.mocked(confirmationDialog).mock.calls[0];
    expect(dialog.message).toContain("2 note(s)");

    dialog.onConfirm?.();
    const [csv, fileName] = vi.mocked(downloadFile).mock.calls[0];
    expect(fileName).toContain(".csv");
    expect(String(csv).split("\n")).toEqual([
      "id,name,note",
      '"burg99","Lost Town","dropped, with a ""quote"""',
      '"someLegacyThing","Older still","dropped too"'
    ]);
  });
});

describe("v1.154 relief descriptors", () => {
  const stylesPayload = (set: string, size = 1): string => {
    const record = JSON.parse(JSON.stringify(Styles.parse(undefined)));
    record.relief.options.set = set;
    record.relief.options.size = size;
    return JSON.stringify(record);
  };

  // isolate one version step: the migration runs after the style steps, without unrelated DOM setup
  const runMigration = async (mapVersion: string, data: string[], versions: string[]): Promise<void> => {
    const compare = vi.spyOn(versioning, "compareVersions");
    compare.mockImplementation((_a, b) => ({
      isOlder: !!b && versions.includes(b),
      isNewer: false,
      isEqual: false
    }));
    try {
      await resolveVersionConflicts(mapVersion, data);
    } finally {
      compare.mockRestore();
    }
  };

  const migrate = async (icons: unknown[], set: string, size = 1): Promise<typeof pack.relief> => {
    document.body.innerHTML = '<svg id="map"><defs id="deftemp"/><g id="viewbox"><g id="terrain"></g></g></svg>';
    const data: string[] = [];
    data[48] = stylesPayload(set, size);
    globalThis.pack = { relief: structuredClone(icons) } as unknown as typeof pack;
    await runMigration("1.153.1", data, ["1.154.0"]);
    return pack.relief;
  };

  it("renames goods symbols into the set namespace and uploads into the reserved custom one", async () => {
    document.body.innerHTML = '<svg id="map"><defs id="deftemp"/><g id="viewbox"><g id="terrain"></g></g></svg>';
    const data: string[] = [];
    data[48] = stylesPayload("colored");
    globalThis.pack = {
      relief: [],
      goods: [{ icon: "good-wood" }, { icon: "good-salted-fish" }, { icon: "good-custom-ab12" }, { icon: "goods-tea" }]
    } as unknown as typeof pack;
    await runMigration("1.153.1", data, ["1.154.0"]);
    expect(pack.goods.map(good => good.icon)).toEqual([
      "goods-wood",
      "goods-salted-fish",
      "custom-goods-ab12",
      "goods-tea"
    ]);
  });

  it("moves goods uploads and inline images into custom icons, and text into glyphs", async () => {
    document.body.innerHTML = '<svg id="map"><defs id="deftemp"/><g id="viewbox"><g id="terrain"></g></g></svg>';
    const data: string[] = [];
    const legacyStyles = JSON.parse(stylesPayload("colored"));
    legacyStyles.markets.options.icon = "⚖️";
    legacyStyles.burgIcons.groups.city.groups.icons.options.icon = "#burgs-atlas-circle";
    data[48] = JSON.stringify(legacyStyles);
    data[45] =
      '<svg id="good-custom-ab12" viewBox="0 0 20 20" fill="navy"><script>x()</script><path id="leaf" d="M0 0"/></svg>' +
      '<svg id="custom-goods-img" viewBox="0 0 200 200"><image width="200" height="200" href="data:image/png;base64,AA"/></svg>';
    options.map.customIcons = [];
    options.map.military.units = [{ ...options.map.military.units[0], icon: "⚔️" }];
    globalThis.pack = {
      relief: [],
      goods: [{ icon: "good-custom-ab12" }, { icon: "custom-goods-img" }],
      markers: [{ icon: "https://a.b/c.png" }, { icon: "https://a.b/c.png" }, { icon: "🌋" }, { icon: "hq-2" }],
      states: [{ i: 0 }, { i: 1, military: [{ icon: "XIV" }] }]
    } as unknown as typeof pack;
    await runMigration("1.153.1", data, ["1.154.0"]);

    expect(options.map.customIcons.map(icon => [icon.id, icon.kind])).toEqual([
      ["custom-goods-ab12", "svg"],
      ["custom-goods-img", "image"],
      [pack.markers[0].icon, "image"] // markers sharing an image point at one icon
    ]);
    const [vector, raster] = options.map.customIcons;
    expect(vector.viewBox).toBe("0 0 20 20");
    expect(vector.content).toContain('fill="navy"'); // the root's paint, on the wrapping group
    expect(vector.content).toContain('id="custom-goods-ab12-leaf"');
    expect(vector.content).not.toContain("script");
    expect(raster).toMatchObject({ content: "data:image/png;base64,AA", viewBox: "0 0 100 100" });
    expect(pack.goods.map(good => good.icon)).toEqual(["custom-goods-ab12", "custom-goods-img"]);
    expect(pack.markers[1].icon).toBe(pack.markers[0].icon);
    expect(pack.markers[2].icon).toBe("glyph-1f30b");
    expect(pack.markers[3].icon).toBe("glyph-68-71-2d-32"); // looks like an id, but no icon set owns it
    expect(pack.states[1].military![0].icon).toBe("glyph-58-49-56");
    expect(options.map.military.units[0].icon).toBe("glyph-2694-fe0f");
    const styles = JSON.parse(data[48]);
    expect(styles.markets.options.icon).toBe("glyph-2696-fe0f");
    expect(styles.burgIcons.groups.city.groups.icons.options.icon).toBe("burgs-atlas-circle");
  });

  it("renumbers variants and recovers pins against the incoming map's set", async () => {
    const relief = await migrate(
      [
        { icon: "relief-mount-1", x: 1, y: 2, s: 3 },
        { icon: "relief-mount-7", x: 1, y: 2, s: 3 },
        { icon: "relief-hill-5-bw", x: 1, y: 2, s: 3 },
        { icon: "relief-mount-3-illustrated", x: 1, y: 2, s: 3 },
        { icon: "relief-mountSnow-6-bw", x: 1, y: 2, s: 3 },
        { icon: "relief-cactus-3", x: 1, y: 2, s: 3 },
        { icon: "relief-swamp-3", x: 1, y: 2, s: 3 }
      ],
      "colored"
    );

    expect(relief).toEqual([
      { type: "mount", set: "simple", x: 1, y: 2, s: 3 }, // an absent variant means 1, so it is not stored
      { type: "mount", variant: 6, x: 1, y: 2, s: 3 },
      { type: "hill", variant: 4, set: "gray", x: 1, y: 2, s: 3 },
      { type: "mount", variant: 3, set: "illustrated", x: 1, y: 2, s: 3 },
      { type: "mountSnow", variant: 6, set: "gray", x: 1, y: 2, s: 3 },
      { type: "cactus", variant: 3, x: 1, y: 2, s: 3 },
      { type: "swamp", variant: 2, x: 1, y: 2, s: 3 }
    ]);
  });

  it("uses the incoming map's set, not the previously open map's style", async () => {
    globalThis.styles = Styles.parse(undefined);
    styles.relief.options.set = "simple";
    const relief = await migrate([{ icon: "relief-mount-2", x: 0, y: 0, s: 1 }], "colored");
    expect(relief).toEqual([{ type: "mount", x: 0, y: 0, s: 1 }]);
  });

  it("lifts SVG relief out of #terrain and resolves its descriptor", async () => {
    document.body.innerHTML =
      '<svg id="map"><defs id="deftemp"/><g id="viewbox"><g id="terrain" set="gray" size="1" density="0.4"><use href="#relief-mount-3-bw" x="12" y="23" width="14"/></g></g></svg>';
    const data: string[] = [];
    data[48] = stylesPayload("gray");
    globalThis.pack = { relief: [], features: [] } as unknown as typeof pack;
    await runMigration("1.141.0", data, ["1.142.0", "1.154.0"]);
    expect(pack.relief).toEqual([{ type: "mount", variant: 2, x: 12, y: 23, s: 14 }]);
  });

  it("recovers a pre-1.142 map's set and size through the whole chain, with no style record to read", async () => {
    // the 1.142 step lifts the terrain attributes into the styles global, the 1.150 step serializes that into
    // data[48], and the 1.154 step must read the record rather than the global the previously open map left
    globalThis.styles = Styles.parse(undefined);
    styles.relief.options.set = "simple";
    document.body.innerHTML =
      '<svg id="map"><defs id="deftemp"/><g id="viewbox"><g id="terrain" set="colored" size="2" density="0.4"><use href="#relief-mount-3" x="10" y="20" width="12"/><use href="#relief-mount-1" x="0" y="0" width="4"/></g></g></svg>';
    const data: string[] = [];
    globalThis.pack = { relief: [], features: [] } as unknown as typeof pack;
    await runMigration("1.141.0", data, ["1.142.0", "1.150.0", "1.154.0"]);
    expect(Styles.parse(safeParseJSON(data[48])).relief.options).toMatchObject({ set: "colored", size: 2 });
    expect(pack.relief).toEqual([
      { type: "mount", set: "simple", x: 1, y: 1, s: 2 },
      { type: "mount", variant: 2, x: 13, y: 23, s: 6 }
    ]);
  });

  it("compensates old simple grass exactly once", async () => {
    const once = await migrate([{ icon: "relief-grass-1", x: 12.25, y: 33.76, s: 12 }], "simple");
    expect(once[0]).toEqual({ type: "grass", x: 13.25, y: 34.76, s: 10 });
    const twice = await migrate(structuredClone(once), "simple");
    expect(twice).toEqual(once);
  });

  it("gives the old style size back to the data, now that size is a render multiplier", async () => {
    const relief = await migrate([{ icon: "relief-mount-3", x: 10, y: 20, s: 12 }], "colored", 2);
    expect(relief).toEqual([{ type: "mount", variant: 2, x: 13, y: 23, s: 6 }]);
  });

  it("keeps an unrecognised legacy id from failing the load", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const relief = await migrate([{ icon: "relief-mystery-1", x: 0, y: 0, s: 1 }], "simple");
    expect(relief).toEqual([]);
    warn.mockRestore();
  });
});
