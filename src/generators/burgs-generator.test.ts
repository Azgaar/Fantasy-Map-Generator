import { beforeEach, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Minimal pack geometry used across all scenarios
// ---------------------------------------------------------------------------
//
// Cell layout (index = cell id):
//   0 – dummy land cell
//   1 – land cell, burg 1 lives here; voronoi-adjacent to lake cell 4
//   2 – land cell, burg 2 lives here; voronoi-adjacent to lake cell 4
//   3 – unused
//   4 – lake water cell (belongs to whichever lake feature the test sets up)
//   5 – ocean water cell (feature 2 – ocean)
//
// Vertices shared between land and lake cells (required by getCloseToEdgePoint):
//   v0, v1  →  shared by cell 1 and cell 4
//   v2, v3  →  shared by cell 2 and cell 4
//
// River 10 is the outlet river that flows [cell 4 → cell 5] (lake → ocean)
// and is used in the "open lake draining to ocean" scenario.

const BASE_CELLS = {
  haven: [0, 4, 4, 0, 0, 0], // cells 1 & 2 look onto lake cell 4
  harbor: [0, 1, 1, 0, 0, 0], // safe harbour on both land cells
  f: [0, 0, 0, 0, 1, 2], // cell 4 → feature 1 (lake); cell 5 → feature 2 (ocean)
  g: [0, 0, 0, 0, 0, 0], // grid-cell index for temperature lookup
  r: [0, 0, 0, 0, 0, 0], // no rivers on land cells
  fl: [0, 0, 0, 0, 0, 0], // no flux
  p: [
    [0, 0],
    [0, 5],
    [10, 5],
    [0, 0],
    [5, 5],
    [20, 5]
  ] as [number, number][],
  v: [[], [0, 1], [2, 3], [], [], []] // cell 1 → vertices 0,1; cell 2 → vertices 2,3
};

const BASE_VERTICES = {
  // c[v] = cells that share vertex v
  c: [
    [1, 4],
    [1, 4],
    [2, 4],
    [2, 4]
  ],
  // p[v] = [x, y] of vertex v
  p: [
    [5, 0],
    [5, 10],
    [15, 0],
    [15, 10]
  ] as [number, number][]
};

function makeBurgs() {
  return [
    0 as any, // index 0 is the dummy placeholder
    { i: 1, cell: 1, x: 0, y: 5, capital: 0 },
    { i: 2, cell: 2, x: 10, y: 5, capital: 0 }
  ];
}

// ---------------------------------------------------------------------------

describe("BurgsModule.assignPorts — open-lake port promotion", () => {
  let Burgs: any;

  beforeEach(async () => {
    globalThis.TIME = false;
    globalThis.window = globalThis.window || ({} as any);
    globalThis.grid = { cells: { temp: new Array(10).fill(20) } } as any;

    // Modules are cached by Vitest; re-import is a no-op after the first run,
    // so we re-wire the globals each time instead.
    await import("./river-generator");
    await import("./burgs-generator");
    Burgs = (globalThis as any).Burgs;
  });

  // -------------------------------------------------------------------------
  it("gives lake-shore burgs burg.port = oceanFeatureId when the lake drains to the sea", () => {
    // Feature 1 = open lake (outlet → river 10); feature 2 = ocean.
    // River 10: lake cell 4 → ocean cell 5.
    globalThis.pack = {
      burgs: makeBurgs(),
      cells: { ...BASE_CELLS },
      features: [null, { i: 1, type: "lake", cells: 3, outlet: 10 }, { i: 2, type: "ocean" }],
      vertices: BASE_VERTICES,
      rivers: [{ i: 10, cells: [4, 5] }]
    } as any;

    Burgs.assignPorts();

    const burgs = globalThis.pack.burgs;
    expect(burgs[1].port).toBe(2); // ocean feature id
    expect(burgs[2].port).toBe(2);
  });

  // -------------------------------------------------------------------------
  it("keeps burg.port = lakeFeatureId for burgs on a closed lake (no outlet)", () => {
    // Feature 1 = closed lake (no outlet property).
    globalThis.pack = {
      burgs: makeBurgs(),
      cells: { ...BASE_CELLS },
      features: [
        null,
        { i: 1, type: "lake", cells: 3 }, // no outlet
        { i: 2, type: "ocean" }
      ],
      vertices: BASE_VERTICES,
      rivers: []
    } as any;

    Burgs.assignPorts();

    const burgs = globalThis.pack.burgs;
    expect(burgs[1].port).toBe(1); // lake feature id
    expect(burgs[2].port).toBe(1);
  });

  // -------------------------------------------------------------------------
  it.each(["dry", "frozen", "lava"])("does not make ports on a %s lake (cannot be sailed)", group => {
    globalThis.pack = {
      burgs: makeBurgs(),
      cells: { ...BASE_CELLS },
      features: [null, { i: 1, type: "lake", cells: 3, group }, { i: 2, type: "ocean" }],
      vertices: BASE_VERTICES,
      rivers: []
    } as any;

    Burgs.assignPorts();

    const burgs = globalThis.pack.burgs;
    expect(burgs[1].port).toBeUndefined();
    expect(burgs[2].port).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  it("keeps burg.port = lakeFeatureId when the outlet river exits the map", () => {
    // River 10's last cell is -1 (off-map), so resolveLakeDrainFeature returns null.
    globalThis.pack = {
      burgs: makeBurgs(),
      cells: { ...BASE_CELLS },
      features: [null, { i: 1, type: "lake", cells: 3, outlet: 10 }, { i: 2, type: "ocean" }],
      vertices: BASE_VERTICES,
      rivers: [{ i: 10, cells: [4, -1] }] // -1 = exits map
    } as any;

    Burgs.assignPorts();

    const burgs = globalThis.pack.burgs;
    expect(burgs[1].port).toBe(1); // stays on lake, not promoted to ocean
    expect(burgs[2].port).toBe(1);
  });

  // -------------------------------------------------------------------------
  it("promotes lake-shore burgs to a downstream closed lake when the chain ends there", () => {
    // Feature 1 = open lake (outlet → river 10).
    // River 10 ends in cell 6 which belongs to feature 3 = closed lake.
    const cells = {
      ...BASE_CELLS,
      f: [0, 0, 0, 0, 1, 2, 3], // cell 6 → feature 3 (closed downstream lake)
      haven: [0, 4, 4, 0, 0, 0, 0],
      harbor: [0, 1, 1, 0, 0, 0, 0],
      g: [0, 0, 0, 0, 0, 0, 0],
      r: [0, 0, 0, 0, 0, 0, 0],
      fl: [0, 0, 0, 0, 0, 0, 0],
      p: [
        [0, 0],
        [0, 5],
        [10, 5],
        [0, 0],
        [5, 5],
        [20, 5],
        [30, 5]
      ] as [number, number][],
      v: [[], [0, 1], [2, 3], [], [], [], []]
    };

    globalThis.pack = {
      burgs: makeBurgs(),
      cells,
      features: [
        null,
        { i: 1, type: "lake", cells: 3, outlet: 10 }, // open lake
        { i: 2, type: "ocean" },
        { i: 3, type: "lake", cells: 2 } // closed downstream lake
      ],
      vertices: BASE_VERTICES,
      rivers: [{ i: 10, cells: [4, 6] }] // drains into closed lake cell 6
    } as any;

    Burgs.assignPorts();

    const burgs = globalThis.pack.burgs;
    expect(burgs[1].port).toBe(3); // closed-lake feature id
    expect(burgs[2].port).toBe(3);
  });

  // -------------------------------------------------------------------------
  it("does not assign a port when fewer than 2 candidates share a feature", () => {
    // Only burg 1 qualifies (burg 2 has no harbour).
    const cells = {
      ...BASE_CELLS,
      harbor: [0, 1, 0, 0, 0, 0] // only cell 1 has a safe harbour
    };

    globalThis.pack = {
      burgs: makeBurgs(),
      cells,
      features: [null, { i: 1, type: "lake", cells: 3, outlet: 10 }, { i: 2, type: "ocean" }],
      vertices: BASE_VERTICES,
      rivers: [{ i: 10, cells: [4, 5] }]
    } as any;

    Burgs.assignPorts();

    const burgs = globalThis.pack.burgs;
    expect(burgs[1].port).toBeUndefined(); // single candidate → no port
    expect(burgs[2].port).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  it("does not alter locked burgs", () => {
    globalThis.pack = {
      burgs: [
        0 as any,
        { i: 1, cell: 1, x: 0, y: 5, capital: 0, lock: true, port: 99 },
        { i: 2, cell: 2, x: 10, y: 5, capital: 0 }
      ],
      cells: { ...BASE_CELLS },
      features: [null, { i: 1, type: "lake", cells: 3, outlet: 10 }, { i: 2, type: "ocean" }],
      vertices: BASE_VERTICES,
      rivers: [{ i: 10, cells: [4, 5] }]
    } as any;

    Burgs.assignPorts();

    const burgs = globalThis.pack.burgs;
    expect(burgs[1].port).toBe(99); // locked — unchanged
    expect(burgs[2].port).toBeUndefined(); // alone after locking → no port
  });

  // -------------------------------------------------------------------------
  // Two islands share ocean feature 2. Island A's burg has a safe harbour;
  // island B's burg only has an exposed coast (harbor = 2, not a capital).
  // Both must become ports so neither island is cut off from sea trade.
  it("promotes an exposed coastal burg so its island is not left portless", () => {
    globalThis.pack = {
      burgs: [0 as any, { i: 1, cell: 1, x: 5, y: 5, capital: 0 }, { i: 2, cell: 2, x: 15, y: 5, capital: 0 }],
      cells: {
        haven: [0, 3, 3, 0],
        harbor: [0, 1, 2, 0], // burg 1 safe harbour, burg 2 exposed coast
        f: [0, 10, 11, 2], // burg 1 → island 10, burg 2 → island 11, cell 3 → ocean 2
        g: [0, 0, 0, 0],
        r: [0, 0, 0, 0],
        fl: [0, 0, 0, 0],
        p: [
          [0, 0],
          [5, 5],
          [15, 5],
          [10, 5]
        ] as [number, number][],
        v: [[], [0, 1], [2, 3], []]
      },
      features: [null, null, { i: 2, type: "ocean", cells: 5 }],
      vertices: {
        c: [
          [1, 3],
          [1, 3],
          [2, 3],
          [2, 3]
        ],
        p: [
          [5, 0],
          [5, 10],
          [15, 0],
          [15, 10]
        ] as [number, number][]
      },
      rivers: []
    } as any;

    Burgs.assignPorts();

    const burgs = globalThis.pack.burgs;
    expect(burgs[1].port).toBe(2); // safe-harbour island
    expect(burgs[2].port).toBe(2); // exposed-coast island — now reachable
  });

  // -------------------------------------------------------------------------
  // A single island borders its own sea with two exposed coastal burgs and no
  // safe harbour. Both should become ports so an internal sea route can form.
  it("gives a lone island two ports when it has no safe harbour", () => {
    globalThis.pack = {
      burgs: [0 as any, { i: 1, cell: 1, x: 5, y: 5, capital: 0 }, { i: 2, cell: 2, x: 15, y: 5, capital: 0 }],
      cells: {
        haven: [0, 3, 3, 0],
        harbor: [0, 2, 2, 0], // both exposed, neither a safe harbour
        f: [0, 10, 10, 2], // both burgs on island 10; cell 3 → ocean 2
        g: [0, 0, 0, 0],
        r: [0, 0, 0, 0],
        fl: [0, 0, 0, 0],
        p: [
          [0, 0],
          [5, 5],
          [15, 5],
          [10, 5]
        ] as [number, number][],
        v: [[], [0, 1], [2, 3], []]
      },
      features: [null, null, { i: 2, type: "ocean", cells: 5 }],
      vertices: {
        c: [
          [1, 3],
          [1, 3],
          [2, 3],
          [2, 3]
        ],
        p: [
          [5, 0],
          [5, 10],
          [15, 0],
          [15, 10]
        ] as [number, number][]
      },
      rivers: []
    } as any;

    Burgs.assignPorts();

    const burgs = globalThis.pack.burgs;
    expect(burgs[1].port).toBe(2);
    expect(burgs[2].port).toBe(2);
  });
});

describe("BurgsModule.assignPorts — river-bank shift", () => {
  let Burgs: any;

  beforeEach(async () => {
    globalThis.TIME = false;
    globalThis.window = globalThis.window || ({} as any);
    globalThis.grid = { cells: { temp: new Array(10).fill(20) } } as any;

    await import("./river-generator");
    await import("./burgs-generator");
    Burgs = (globalThis as any).Burgs;
  });

  it("shifts a non-port river burg perpendicular to the local river course", () => {
    // River 10 runs diagonally [1 → 2 → 3] along (1,1); burg sits on the middle cell.
    // The river stays on land (no drain feature) so the burg never becomes a port.
    globalThis.pack = {
      burgs: [0 as any, { i: 1, cell: 2, x: 10, y: 10, capital: 0 }],
      cells: {
        h: [20, 25, 25, 25],
        r: [0, 10, 10, 10],
        fl: [0, 300, 300, 300],
        f: [0, 0, 0, 0],
        g: [0, 0, 0, 0],
        haven: [0, 0, 0, 0],
        harbor: [0, 0, 0, 0],
        v: [[], [], [], []],
        p: [
          [0, 0],
          [0, 0],
          [10, 10],
          [20, 20]
        ] as [number, number][]
      },
      features: [null],
      vertices: { c: [], p: [] },
      rivers: [{ i: 10, cells: [1, 2, 3] }]
    } as any;

    Burgs.assignPorts();

    const burg = globalThis.pack.burgs[1];
    const dx = burg.x - 10;
    const dy = burg.y - 10;

    // Displacement is perpendicular to the river tangent (1,1): dot product ≈ 0.
    expect(dx * 1 + dy * 1).toBeCloseTo(0, 6);
    // Displacement magnitude is the shift amount min(fl/200, 0.6) (±2-decimal rounding).
    const expectedShift = Math.min(300 / 200, 0.6);
    expect(Math.hypot(dx, dy)).toBeCloseTo(expectedShift, 1);
    // The burg actually moved off the cell center.
    expect(dx === 0 && dy === 0).toBe(false);
  });

  it("falls back to an axis nudge for a single-cell river (no course direction)", () => {
    globalThis.pack = {
      burgs: [0 as any, { i: 1, cell: 1, x: 5, y: 5, capital: 0 }],
      cells: {
        h: [20, 25],
        r: [0, 10],
        fl: [0, 150],
        f: [0, 0],
        g: [0, 0],
        haven: [0, 0],
        harbor: [0, 0],
        v: [[], []],
        p: [
          [0, 0],
          [5, 5]
        ] as [number, number][]
      },
      features: [null],
      vertices: { c: [], p: [] },
      rivers: [{ i: 10, cells: [1] }] // single cell → no tangent
    } as any;

    Burgs.assignPorts();

    const burg = globalThis.pack.burgs[1];
    // Still shifted (axis-aligned fallback), just not crashing on the missing course.
    expect(burg.x === 5 && burg.y === 5).toBe(false);
  });
});
