import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PackedGraph } from "@/types/PackedGraph";
import { createAvailableLandCellFinder, MapRestoration } from "./map-restoration";
import type { LockedRiver } from "./river-generator";

type Projection = (x: number, y: number) => [number, number];
type Links = { under: Int32Array; sameType: Int32Array };
type Snapshot = { pack: PackedGraph; spacing: number; riverAnchors: [number, number][][] };
const internals = MapRestoration as unknown as {
  restoreRivers(snapshot: Snapshot, links: Links, projection: Projection, scale: number): void;
  restoreFeatures(parent: PackedGraph, links: Links): Map<number, number>;
  restoreRiverData(parent: PackedGraph, links: Links, projection: Projection): void;
  restoreLockedRivers(snapshot: Snapshot, links: Links, projection: Projection, scale: number): LockedRiver[];
  restoreRelief(parent: PackedGraph, links: Links, projection: Projection): void;
  restoreAddedLabels(parent: PackedGraph, projection: Projection): void;
  restoreBurgs(parent: PackedGraph, projection: Projection, scale: number): void;
  restoreProvinces(parent: PackedGraph, projection: Projection): void;
  restoreRoutes(parent: PackedGraph, projection: Projection, featureIds: Map<number, number>): void;
  restoreZones(parent: PackedGraph, links: Links): void;
  fillPathGaps(points: [number, number, number][]): [number, number, number][];
  restoreJourneys(parent: PackedGraph, projection: Projection): void;
};

const identity: Projection = (x, y) => [x, y];
const graph = (data: object) => data as unknown as PackedGraph;
const links = (under: number[], sameType = under): Links => ({
  under: Int32Array.from(under),
  sameType: Int32Array.from(sameType)
});

// cells on a line: cell i sits at (i * 10, 0), each one next to i - 1 and i + 1
const lineCells = (heights: number[]) => ({
  i: heights.map((_, i) => i),
  p: heights.map((_, i) => [i * 10, 0]),
  c: heights.map((_, i) => [i - 1, i + 1].filter(n => n >= 0 && n < heights.length)),
  h: Uint8Array.from(heights)
});
const findOnLine = (x: number) => Math.max(0, Math.round(x / 10));

beforeEach(() => {
  options.map.graph = { width: 1000, height: 1000, points: 100, sampling: "square", jitter: 0.9 };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createAvailableLandCellFinder", () => {
  const cells = {
    h: [25, 30, 18, 40],
    p: [
      [0, 0],
      [10, 0],
      [5, 0],
      [100, 0]
    ] as [number, number][]
  };

  it("returns the nearest land cell and removes it from later assignments", () => {
    const findCell = createAvailableLandCellFinder(cells);

    expect(findCell(1, 0)).toBe(0);
    expect(findCell(1, 0)).toBe(1);
    expect(findCell(1, 0)).toBe(3);
  });

  it("never returns water cells", () => {
    expect(createAvailableLandCellFinder(cells)(5, 0)).not.toBe(2);
  });

  it("returns undefined when no land cell remains", () => {
    expect(createAvailableLandCellFinder({ h: [10], p: [[0, 0]] })(0, 0)).toBeUndefined();
  });
});

describe("restoreRivers", () => {
  beforeEach(() => {
    vi.stubGlobal("Pack", { findCell: findOnLine });
    vi.stubGlobal("Rivers", {
      getParent: (i: number) => i,
      getBasin: (i: number) => i,
      getApproximateLength: () => 1,
      addMeandering: () => []
    });
  });

  it("finds the cells again by position, keeps the flow off the map edge and takes the flux under the cells", () => {
    // cell 3 is a lake: a river crossing it goes on
    const cells = { ...lineCells([30, 30, 30, 10]), f: [1, 1, 1, 2] };
    vi.stubGlobal("pack", graph({ cells, features: [0, { type: "island" }, { type: "lake" }] }));
    const parent = graph({
      cells: { fl: [0, 5, 6, 7, 8], conf: [0, 0, 300, 0, 0] },
      rivers: [
        { i: 1, cells: [91, 92, 93, -1], widthFactor: 1 },
        { i: 2, cells: [94, 95], widthFactor: 1 }
      ]
    });
    const riverAnchors: [number, number][][] = [
      [
        [0, 0],
        [10, 0],
        [30, 0],
        [1000, 0]
      ],
      [
        [10, 0],
        [20, 0]
      ]
    ];

    internals.restoreRivers({ pack: parent, spacing: 10, riverAnchors }, links([1, 2, 3, 4]), identity, 2);

    const [first, second] = pack.rivers;
    expect(first).toMatchObject({ cells: [0, 1, 3, -1], source: 0, mouth: 3, widthFactor: 2 });
    expect(first.points).toEqual(riverAnchors[0]);
    expect(Array.from(pack.cells.r)).toEqual([1, 1, 2, 0]); // the water cell gets no river
    expect(Array.from(pack.cells.conf)).toEqual([0, 300, 0, 0]); // the second river joins the first: the confluence keeps its flux
    expect(second.cells).toEqual([1, 2]);
    expect(Array.from(pack.cells.fl)).toEqual([5, 6, 7, 8]); // water too: a lake outlet holds flux
  });

  it("ends a river where its land went under the sea, and drops one left without land", () => {
    const cells = { ...lineCells([30, 30, 10, 30]), f: [1, 1, 2, 3] };
    vi.stubGlobal("pack", graph({ cells, features: [0, { type: "island" }, { type: "ocean" }, { type: "island" }] }));
    const parent = graph({
      cells: { fl: [], conf: [] },
      rivers: [
        { i: 1, cells: [91, 92, 93, 94], widthFactor: 1 },
        { i: 2, cells: [95, 96], widthFactor: 1 }
      ]
    });
    const anchors = (xs: number[]) => xs.map((x): [number, number] => [x, 0]);

    internals.restoreRivers(
      { pack: parent, spacing: 10, riverAnchors: [anchors([0, 10, 20, 30]), anchors([20, 20])] },
      links([1, 2, 3, 4]),
      identity,
      1
    );

    expect(pack.rivers).toHaveLength(1);
    expect(pack.rivers[0]).toMatchObject({ cells: [0, 1, 2], points: anchors([0, 10, 20]), source: 0, mouth: 1 });
    expect(Array.from(pack.cells.r)).toEqual([1, 1, 0, 0]);
  });

  it("drops a river left with less than two points on the map", () => {
    vi.stubGlobal("pack", graph({ cells: { ...lineCells([30, 30]), f: [1, 1] }, features: [0, { type: "island" }] }));
    const parent = graph({ cells: { fl: [], conf: [] }, rivers: [{ i: 1, cells: [5, 6], widthFactor: 1 }] });
    const offMap: Projection = (x, y) => [x - 5000, y];

    internals.restoreRivers(
      {
        pack: parent,
        spacing: 10,
        riverAnchors: [
          [
            [0, 0],
            [10, 0]
          ]
        ]
      },
      links([0, 1]),
      offMap,
      1
    );

    expect(pack.rivers).toEqual([]);
  });
});

describe("restoreFeatures", () => {
  const EMPTY = undefined; // features hold a 0 placeholder
  type FeatureData = Record<string, unknown> | undefined;

  beforeEach(() => {
    vi.stubGlobal("Features", { defineGroups: () => {} });
  });

  const parent = (features: FeatureData[], featureIds = [1, 1, 1, 2, 2, 2]) =>
    graph({ cells: { f: Uint16Array.from(featureIds) }, features });
  const setPack = (featureIds: number[], features: FeatureData[]) =>
    vi.stubGlobal(
      "pack",
      graph({ cells: { i: featureIds.map((_, i) => i), f: Uint16Array.from(featureIds) }, features, rivers: [] })
    );
  const lakeAndSea = parent([
    EMPTY,
    { i: 1, type: "lake", name: "Mirror Lake", note: "Deep and cold", subtype: "salt", group: "salt" },
    { i: 2, type: "ocean", name: "Ald Sea" }
  ]);

  it("hands the user data to the new feature covering the same ground", () => {
    setPack(
      [3, 3, 4, 4, 4, 4],
      [EMPTY, EMPTY, EMPTY, { i: 3, type: "lake", name: "Generated", subtype: "freshwater" }, { i: 4, type: "ocean" }]
    );

    const featureIds = internals.restoreFeatures(lakeAndSea, links([0, 1, 2, 3, 4, 5]));

    expect(pack.features[3]).toMatchObject({
      name: "Mirror Lake",
      note: "Deep and cold",
      subtype: "salt",
      group: "salt"
    });
    expect(pack.features[4].name).toBe("Ald Sea");
    expect([...featureIds]).toEqual([
      [2, 4],
      [1, 3]
    ]);
  });

  it("keeps the data of a lake that shrank", () => {
    setPack([5, 4, 4, 4, 4, 4], [EMPTY, EMPTY, EMPTY, EMPTY, { i: 4, type: "ocean" }, { i: 5, type: "lake" }]);

    const featureIds = internals.restoreFeatures(lakeAndSea, links([0, 1, 2, 3, 4, 5]));

    expect(pack.features[5].name).toBe("Mirror Lake");
    expect(featureIds.get(1)).toBe(5);
  });

  it("does not hand the data to a new feature only partly over the old one", () => {
    setPack([4, 4, 5, 5, 5, 5], [EMPTY, EMPTY, EMPTY, EMPTY, { i: 4, type: "ocean" }, { i: 5, type: "lake" }]);

    internals.restoreFeatures(lakeAndSea, links([0, 1, 2, 3, 4, 5]));

    expect(pack.features[5].name).toBeUndefined();
  });

  it("does not hand a lake's data to the island that replaced it", () => {
    setPack(
      [3, 3, 3, 4, 4, 4],
      [EMPTY, EMPTY, EMPTY, { i: 3, type: "island", name: "Generated" }, { i: 4, type: "ocean" }]
    );

    internals.restoreFeatures(lakeAndSea, links([0, 1, 2, 3, 4, 5]));

    expect(pack.features[3]).toMatchObject({ name: "Generated" });
    expect(pack.features[3].note).toBeUndefined();
  });

  it("keeps the subtype of a lake island, which the heightmap defines", () => {
    const islands = parent(
      [EMPTY, { i: 1, type: "island", subtype: "lake_island", tags: ["home"] }, { i: 2, type: "ocean" }],
      [1, 1, 1, 2, 2, 2]
    );
    setPack(
      [3, 3, 3, 4, 4, 4],
      [EMPTY, EMPTY, EMPTY, { i: 3, type: "island", subtype: "isle", group: "sea_island" }, { i: 4, type: "ocean" }]
    );

    internals.restoreFeatures(islands, links([0, 1, 2, 3, 4, 5]));

    expect(pack.features[3]).toMatchObject({ subtype: "isle", group: "sea_island", tags: ["home"] });
  });
});

describe("restoreBurgs", () => {
  beforeEach(() => {
    vi.stubGlobal("WARN", false);
    vi.stubGlobal("Pack", { findCell: findOnLine });
    vi.stubGlobal("Burgs", { getPortWater: () => 7 });
  });

  const setPack = (heights: number[]) =>
    vi.stubGlobal(
      "pack",
      graph({
        cells: {
          ...lineCells(heights),
          f: Uint16Array.from(heights.map((_, i) => i + 1)),
          haven: new Uint16Array(heights.length),
          burg: new Uint16Array(heights.length)
        }
      })
    );

  it("gives each burg its own land cell, capitals first, and moves a burg off water", () => {
    setPack([25, 25, 10, 25]);
    const parent = graph({
      burgs: [
        {},
        { i: 1, x: 1, y: 0, population: 2, label: { text: "One", dx: 5, pathPoints: [[1, 1]] } },
        { i: 2, x: 2, y: 0, population: 3, capital: 1, port: 5, label: { dx: 5 } },
        { i: 3, x: 21, y: 0, population: 1 }
      ]
    });

    internals.restoreBurgs(parent, identity, 2);

    const [, first, capital, third] = pack.burgs;
    expect(capital).toMatchObject({ cell: 0, x: 2, y: 0, feature: 1, port: 7, population: 6 });
    expect(first).toMatchObject({ cell: 1, x: 10, y: 0, population: 4 });
    expect(first.port).toBeUndefined(); // not a port, and no port field added
    expect(first.label).toEqual({ text: "One", dx: 0, dy: 0, pathPoints: undefined }); // moved: the layout is reset
    expect(capital.label).toEqual({ dx: 5 });
    expect(third).toMatchObject({ cell: 3, x: 30, y: 0 });
    expect(Array.from(pack.cells.burg)).toEqual([2, 1, 0, 3]);
  });

  it("removes a burg with no land left, and one projected off the map", () => {
    setPack([25, 10]);
    const parent = graph({
      burgs: [
        {},
        { i: 1, x: 0, y: 0, capital: 1, population: 1 },
        { i: 2, x: 1, y: 0, population: 1, capital: 1 },
        { i: 3, x: 0, y: 0, removed: true },
        { i: 4, x: 5000, y: 0, population: 1 }
      ]
    });

    internals.restoreBurgs(parent, identity, 1);

    expect(pack.burgs[1]).toMatchObject({ cell: 0 });
    expect(pack.burgs[2]).toMatchObject({ removed: true, capital: 0 });
    expect(pack.burgs[3]).toBe(parent.burgs[3]);
    expect(pack.burgs[4]).toMatchObject({ removed: true });
  });
});

describe("restoreProvinces", () => {
  it("drops a province without cells, and gives one whose capital left its most populous burg", () => {
    vi.stubGlobal("Provinces", {
      getPoles: () => {
        pack.provinces[1].pole = [20, 0];
        pack.provinces[3].pole = [30, 0];
      },
      setCapital: (provinceId: number, burgId: number) =>
        Object.assign(pack.provinces[provinceId], { burg: burgId, center: pack.burgs[burgId].cell })
    });
    vi.stubGlobal("Pack", { findCell: findOnLine });
    vi.stubGlobal(
      "pack",
      graph({
        cells: { province: Uint16Array.from([0, 1, 1, 3]), burg: Uint16Array.from([0, 5, 4, 0]) },
        burgs: [
          {},
          {},
          {},
          { i: 3, removed: true },
          { i: 4, cell: 2, population: 5 },
          { i: 5, cell: 1, population: 9 }
        ],
        states: [{}, { i: 1, provinces: [1, 2, 3] }]
      })
    );
    const parent = graph({
      cells: { p: { 7: [30, 0], 8: [0, 0], 9: [50, 0] } },
      provinces: [
        {},
        { i: 1, state: 1, burg: 3, center: 9 },
        { i: 2, state: 1, burg: 0, center: 8 },
        { i: 3, state: 1, burg: 3, center: 7 } // no burg left: it keeps its center, without a capital
      ]
    });

    internals.restoreProvinces(parent, identity);

    expect(pack.provinces[1]).toMatchObject({ center: 1, burg: 5 });
    expect(pack.provinces[2]).toMatchObject({ removed: true });
    expect(pack.provinces[3]).toMatchObject({ center: 3, burg: 0 });
    expect(pack.states[1].provinces).toEqual([1, 3]);
  });
});

describe("restoreRoutes", () => {
  beforeEach(() => {
    vi.stubGlobal("grid", { spacing: 10 });
    vi.stubGlobal("Pack", { findCell: findOnLine });
    vi.stubGlobal("Routes", { buildLinks: () => ({ built: true }), sync: () => {} });
    vi.stubGlobal(
      "pack",
      graph({ cells: { ...lineCells([25, 10, 10, 25, 25]), f: Uint16Array.from([1, 2, 2, 3, 3]) } })
    );
  });

  it("keeps a path cell next to its point, else takes the cell under the point, and maps the feature", () => {
    options.map.graph.width = 25;
    const parent = graph({
      cells: { p: { 5: [0, 0], 6: [10, 0], 7: [30, 0], 8: [60, 0] } },
      features: [0, { land: true }, { land: false }],
      routes: [
        {
          i: 1,
          feature: 2,
          points: [
            [0, 0, 5],
            [16, 0, 6], // over cell 2, routed through its neighbor: cell 6 is now cell 1
            [30, 0, 5], // just off the map edge: kept. Cell 5 is now cell 0, far from the point
            [100, 0, 8] // far off the map: the route is cut a cell spacing beyond the edge
          ]
        }
      ]
    });

    internals.restoreRoutes(parent, identity, new Map([[2, 9]]));

    expect(pack.routes[0].points).toEqual([
      [0, 0, 0],
      [16, 0, 1],
      [20, 0, 2], // cells 1 and 3 are not neighbors: the cell between is filled in
      [30, 0, 3],
      [35, 0, 4]
    ]);
    expect(pack.routes[0].feature).toBe(9);
    expect(pack.cells.routes).toEqual({ built: true });
  });

  it("puts a sea route whose water body is gone on the water it crosses", () => {
    const parent = graph({
      cells: { p: { 5: [0, 0], 6: [10, 0] } },
      features: [0, { land: true }, { land: false }],
      routes: [
        {
          i: 1,
          feature: 2,
          points: [
            [0, 0, 5],
            [10, 0, 6]
          ]
        }
      ]
    });

    internals.restoreRoutes(parent, identity, new Map());

    expect(pack.routes[0].feature).toBe(2); // the first water cell, not the land port
  });
});

describe("fillPathGaps", () => {
  beforeEach(() => {
    vi.stubGlobal("Pack", { findCell: findOnLine });
    vi.stubGlobal("pack", graph({ cells: lineCells([25, 25, 25, 25, 25, 25]) }));
  });

  it("fills a gap with the cells between, on the line the path was drawn along", () => {
    const filled = internals.fillPathGaps([
      [0, 2, 0],
      [50, 2, 5]
    ]);

    expect(filled).toEqual([
      [0, 2, 0],
      [10, 2, 1],
      [20, 2, 2],
      [30, 2, 3],
      [40, 2, 4],
      [50, 2, 5]
    ]);
  });

  it("searches around where a walk toward the next cell gets stuck, and puts a cell far from the line at its center", () => {
    // cell 0 can only step away from cell 3, to cell 1; the way goes on over cell 2
    const p = [
      [0, 0],
      [-10, 0],
      [10, 30],
      [30, 0]
    ];
    const nearest = (x: number, y: number) =>
      p.reduce(
        (best, [px, py], cell) =>
          Math.hypot(px - x, py - y) < Math.hypot(p[best][0] - x, p[best][1] - y) ? cell : best,
        0
      );
    vi.stubGlobal("Pack", { findCell: nearest });
    vi.stubGlobal("pack", graph({ cells: { p, c: [[1], [0, 2], [1, 3], [2]] } }));

    const filled = internals.fillPathGaps([
      [0, 0, 0],
      [30, 0, 3]
    ]);

    expect(filled).toEqual([
      [0, 0, 0],
      [0, 0, 1], // on the line, next to cell 1
      [10, 30, 2], // the line passes far from cell 2: its center
      [30, 0, 3]
    ]);
  });

  it("leaves a path of neighbors as it is", () => {
    const path: [number, number, number][] = [
      [0, 0, 0],
      [10, 0, 1],
      [10, 0, 1],
      [20, 0, 2]
    ];

    expect(internals.fillPathGaps(path)).toEqual(path);
  });
});

describe("restoreZones", () => {
  it("puts a cell in the zones of the snapshot cell under it", () => {
    vi.stubGlobal("pack", graph({ cells: { i: [0, 1, 2, 3] } }));
    const parent = graph({
      zones: [
        { i: 0, cells: [7, 8] },
        { i: 1, cells: [8] },
        { i: 2, cells: [] }
      ]
    });

    internals.restoreZones(parent, links([7, 8, 8, 9]));

    expect(pack.zones.map(zone => zone.cells)).toEqual([[0, 1, 2], [1, 2], []]);
  });
});

describe("restoreJourneys", () => {
  beforeEach(() => {
    vi.stubGlobal("WARN", false);
    vi.stubGlobal("Pack", { findCell: (x: number) => Math.round(x) });
    vi.stubGlobal("Journeys", { getPathLength: (points: unknown[]) => points.length });
    // cells 20 apart are neighbors too, so the points below need no filling
    const c = Array.from({ length: 101 }, (_, i) => [i - 1, i + 1, i - 20, i + 20]);
    vi.stubGlobal("pack", graph({ cells: { c } }));
  });

  // parent point (30, 30) lands at (10, 10); parent point (10, 10) lands off-map at (-30, -30)
  const projection: Projection = (x, y) => [x * 2 - 50, y * 2 - 50];
  const segment = (i: number, points: [number, number, number][]) => ({
    i,
    transport: "Horse rider",
    from: points[0][2],
    to: points[points.length - 1][2],
    points
  });

  it("remaps surviving segments, drops out-of-map segments and empty journeys", () => {
    const parent = graph({
      cells: { p: { 7: [30, 30], 8: [40, 30], 9: [10, 10], 10: [15, 10] } },
      journeys: [
        {
          i: 0,
          name: "kept",
          segments: [
            segment(0, [
              [30, 30, 7],
              [40, 30, 8]
            ]),
            segment(1, [
              [30, 30, 7],
              [10, 10, 9] // projects off-map: the segment goes
            ])
          ]
        },
        {
          i: 1,
          name: "gone",
          segments: [
            segment(0, [
              [10, 10, 9],
              [15, 10, 10]
            ])
          ]
        }
      ]
    });

    internals.restoreJourneys(parent, projection);

    expect(pack.journeys).toHaveLength(1);
    expect(pack.journeys[0].segments).toHaveLength(1);
    expect(pack.journeys[0].segments[0]).toMatchObject({
      points: [
        [10, 10, 10],
        [30, 10, 30]
      ],
      from: 10,
      to: 30,
      distance: 2
    });
  });

  it("restores an empty array when the snapshot has no journeys", () => {
    internals.restoreJourneys(graph({}), projection);
    expect(pack.journeys).toEqual([]);
  });
});

describe("restoreRiverData", () => {
  it("gives a generated river the user data of the old river whose course it follows", () => {
    vi.stubGlobal(
      "pack",
      graph({
        cells: { r: Uint16Array.from([1, 1, 1, 2, 2, 0]) },
        rivers: [
          { i: 1, name: "Generated", type: "River", tags: [] },
          { i: 2, name: "Other", type: "Creek", tags: [] }
        ]
      })
    );
    const parent = graph({
      cells: { r: Uint16Array.from([7, 7, 7, 7, 0, 8]) },
      rivers: [
        { i: 7, name: "Seven", type: "Brook", note: "Old", label: { pathPoints: [[0, 0]] } },
        { i: 8, name: "Eight", type: "Fork" }
      ]
    });

    internals.restoreRiverData(parent, links([0, 1, 2, 3, 4, 5]), (x, y) => [x + 5, y]);

    expect(pack.rivers[0]).toEqual({
      i: 1,
      name: "Seven",
      type: "Brook",
      note: "Old",
      tags: [],
      label: { pathPoints: [[5, 0]] }
    });
    expect(pack.rivers[1]).toMatchObject({ name: "Other", type: "Creek" }); // only a bit of Seven's course
  });

  it("leaves locked rivers out: they keep their own data", () => {
    vi.stubGlobal(
      "pack",
      graph({
        cells: { r: Uint16Array.from([7, 7, 2, 2]) },
        rivers: [
          { i: 7, name: "Locked", lock: true },
          { i: 2, name: "Generated" }
        ]
      })
    );
    const parent = graph({
      cells: { r: Uint16Array.from([7, 7, 7, 7]) },
      rivers: [{ i: 7, name: "Locked", lock: true }]
    });

    internals.restoreRiverData(parent, links([0, 1, 2, 3]), identity);

    expect(pack.rivers.map(river => river.name)).toEqual(["Locked", "Generated"]);
  });
});

describe("restoreRelief", () => {
  let covered: number[];

  beforeEach(() => {
    covered = [];
    vi.stubGlobal("Pack", { findCell: findOnLine });
    vi.stubGlobal("Relief", {
      regenerate: (covers: (cell: number) => boolean) => {
        covered = [0, 1, 2].filter(covers);
      }
    });
    vi.stubGlobal("pack", graph({ cells: lineCells([25, 10, 25]) }));
  });

  const icon = (ref: object, x: number) => ({ ...ref, x: x - 2, y: -2, s: 4 });

  it("drops icons where land went under the sea unless the sea has them, and places relief on raised land", () => {
    const parent = graph({
      cells: lineCells([25, 25, 10]),
      biomes: [{ icons: { "glyph-whale": { weight: 1 } } }],
      relief: [
        icon({ type: "mount" }, 0),
        icon({ type: "hill" }, 10), // land gone under the sea
        icon({ icon: "glyph-whale" }, 10), // a marine icon
        icon({ icon: "glyph-ship" }, 20) // placed on the sea by hand
      ]
    });

    internals.restoreRelief(parent, links([0, 1, 2]), identity);

    expect(pack.relief).toEqual([
      icon({ type: "mount" }, 0),
      icon({ icon: "glyph-whale" }, 10),
      icon({ icon: "glyph-ship" }, 20)
    ]);
    expect(covered).toEqual([2]);
  });

  it("leaves relief never drawn to the first draw", () => {
    internals.restoreRelief(graph({ cells: lineCells([25]), relief: [] }), links([0, 1, 2]), identity);

    expect(pack.relief).toEqual([]);
    expect(covered).toEqual([]);
  });
});

describe("restoreAddedLabels", () => {
  const parent = graph({
    addedLabels: [
      {
        i: 0,
        x: 10,
        y: 20,
        label: {
          text: "Path",
          dx: 2,
          dy: 3,
          pathPoints: [
            [0, 0],
            [10, 10]
          ]
        }
      },
      { i: 1, x: 0, y: 0, label: { text: "Plain", pathPoints: [] } }
    ]
  });

  it("projects the position and a custom path, and turns the offset with the map", () => {
    vi.stubGlobal("pack", graph({}));
    const turn: Projection = (x, y) => [100 - y, x]; // a quarter turn with a shift

    internals.restoreAddedLabels(parent, turn);

    expect(pack.addedLabels).toEqual([
      {
        i: 0,
        x: 80,
        y: 10,
        label: {
          text: "Path",
          dx: -3,
          dy: 2,
          pathPoints: [
            [100, 0],
            [90, 10]
          ]
        }
      },
      { i: 1, x: 100, y: 0, label: { text: "Plain", pathPoints: [] } }
    ]);
  });

  it("keeps the labels as they are when nothing moves", () => {
    vi.stubGlobal("pack", graph({}));

    internals.restoreAddedLabels(parent, identity);

    expect(pack.addedLabels).toEqual(parent.addedLabels);
  });
});

describe("restoreLockedRivers", () => {
  const anchors = (cells: number[]): [number, number][] => cells.map(cell => [cell * 10, 0]);
  const restore = (rivers: object[]) =>
    internals.restoreLockedRivers(
      {
        pack: graph({ cells: { fl: [10, 20, 30, 40, 50, 60] }, rivers }),
        spacing: 10,
        riverAnchors: rivers.map(river => anchors((river as { cells: number[] }).cells))
      },
      links([0, 1, 2, 3, 4, 5]),
      identity,
      1
    );

  beforeEach(() => {
    vi.stubGlobal("WARN", false);
    vi.stubGlobal("Pack", { findCell: findOnLine });
    // cell 3 went under the sea
    const cells = { ...lineCells([25, 25, 25, 10, 25, 25]), f: Uint16Array.from([1, 1, 1, 2, 1, 1]) };
    vi.stubGlobal("pack", graph({ cells, features: [0, { type: "island" }, { type: "ocean" }] }));
  });

  it("keeps the course of a locked river up to where it now runs into the sea, with its flux", () => {
    const [{ river, flux }] = restore([{ i: 4, lock: true, cells: [0, 1, 2, 3, 4, 5], widthFactor: 1 }]);

    expect(river).toMatchObject({ i: 4, cells: [0, 1, 2, 3], source: 0, mouth: 2 });
    expect(river.points).toEqual(anchors([0, 1, 2, 3]));
    expect(flux).toEqual([10, 20, 30, 0]);
  });

  it("starts a river whose source went under the sea where its course is land again", () => {
    const [{ river }] = restore([{ i: 4, lock: true, cells: [3, 4, 5, -1], widthFactor: 1 }]);

    expect(river.cells).toEqual([4, 5, -1]);
  });

  it("drops a locked river now wholly under the sea and skips unlocked ones", () => {
    expect(
      restore([
        { i: 4, lock: true, cells: [3, 3], widthFactor: 1 },
        { i: 5, cells: [0, 1, 2], widthFactor: 1 }
      ])
    ).toEqual([]);
  });
});
