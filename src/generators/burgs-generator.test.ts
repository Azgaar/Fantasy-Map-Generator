import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cellSlotAfterRemoval,
  groundSlotOnPlacement,
  nearestBurgId,
  skyburgAltitude,
  skyburgGroupFromPopulation,
  skyburgPlacementWeight,
  transferTreasuryOnRemoval
} from "./burgs-generator";

// ---------------------------------------------------------------------------
// Fork tests: skyburg helpers
// ---------------------------------------------------------------------------

describe("skyburgGroupFromPopulation", () => {
  it("assigns 'skyburg' to population >= 0.8", () => {
    expect(skyburgGroupFromPopulation(0.8)).toBe("skyburg");
    expect(skyburgGroupFromPopulation(1.0)).toBe("skyburg");
    expect(skyburgGroupFromPopulation(1.5)).toBe("skyburg");
  });

  it("assigns 'skyburg-mid' to population 0.4–0.799", () => {
    expect(skyburgGroupFromPopulation(0.4)).toBe("skyburg-mid");
    expect(skyburgGroupFromPopulation(0.6)).toBe("skyburg-mid");
    expect(skyburgGroupFromPopulation(0.799)).toBe("skyburg-mid");
  });

  it("assigns 'skyburg-small' to population < 0.4", () => {
    expect(skyburgGroupFromPopulation(0.2)).toBe("skyburg-small");
    expect(skyburgGroupFromPopulation(0.39)).toBe("skyburg-small");
  });

  it("boundary: 0.8 is 'skyburg', 0.799 is 'skyburg-mid'", () => {
    expect(skyburgGroupFromPopulation(0.8)).toBe("skyburg");
    expect(skyburgGroupFromPopulation(0.799)).toBe("skyburg-mid");
  });

  it("boundary: 0.4 is 'skyburg-mid', 0.399 is 'skyburg-small'", () => {
    expect(skyburgGroupFromPopulation(0.4)).toBe("skyburg-mid");
    expect(skyburgGroupFromPopulation(0.399)).toBe("skyburg-small");
  });
});

describe("skyburgAltitude", () => {
  it("clamps to 50 ft at and below the population floor", () => {
    expect(skyburgAltitude(0.1)).toBe(50);
    expect(skyburgAltitude(0.05)).toBe(50);
  });

  it("clamps to 500 ft at and above 1.5 units (sky capital range)", () => {
    expect(skyburgAltitude(1.5)).toBe(500);
    expect(skyburgAltitude(4)).toBe(500);
  });

  it("is monotonic non-decreasing and rounded to 10 ft", () => {
    let prev = 0;
    for (let p = 0.1; p <= 1.5; p += 0.05) {
      const alt = skyburgAltitude(p);
      expect(alt % 10).toBe(0);
      expect(alt).toBeGreaterThanOrEqual(prev);
      prev = alt;
    }
  });

  it("midpoint of the range sits near the middle of 50-500", () => {
    expect(skyburgAltitude(0.8)).toBe(280); // 50 + 450 * 0.5 = 275 -> 280
  });
});

describe("skyburgPlacementWeight", () => {
  it("full weight on coastal cells (|t| = 1)", () => {
    expect(skyburgPlacementWeight(1)).toBe(1);
    expect(skyburgPlacementWeight(-1)).toBe(1);
  });

  it("half weight one ring out (|t| = 2)", () => {
    expect(skyburgPlacementWeight(2)).toBe(0.5);
    expect(skyburgPlacementWeight(-2)).toBe(0.5);
  });

  it("low weight everywhere else (deep water t=0, far inland t>=3, far offshore t<=-3)", () => {
    expect(skyburgPlacementWeight(0)).toBe(0.15);
    expect(skyburgPlacementWeight(3)).toBe(0.15);
    expect(skyburgPlacementWeight(-3)).toBe(0.15);
  });
});

describe("nearestBurgId", () => {
  const burgs = [0, { x: 10, y: 10 }, { x: 50, y: 50 }, { x: 51, y: 49 }] as any[];

  it("returns the id of the burg closest to the point", () => {
    expect(nearestBurgId(burgs, [1, 2, 3], 0, 0)).toBe(1);
    expect(nearestBurgId(burgs, [1, 2, 3], 52, 48)).toBe(3);
  });

  it("only considers the given ids", () => {
    expect(nearestBurgId(burgs, [2], 0, 0)).toBe(2);
  });

  it("returns -1 for an empty id list", () => {
    expect(nearestBurgId(burgs, [], 0, 0)).toBe(-1);
  });
});

describe("definePopulation for flying burgs", () => {
  let Burgs: any;

  beforeAll(async () => {
    const g = globalThis as any;
    g.window = g.window ?? {};
    g.document = g.document ?? {
      readyState: "complete",
      getElementById: () => null,
      addEventListener: () => {},
      querySelector: () => null
    };
    g.TIME = false;
    g.WARN = false;
    g.ERROR = false;
    g.pack = g.pack ?? {};
    await import("./burgs-generator");
    Burgs = (g.window as any).Burgs;
  });

  const makeFlying = (over: any = {}) => ({ i: 7, cell: 13, flying: 1, ...over }) as any;

  it("never drops below 100 people at default rates", () => {
    options.map.units.population.scale = 1000;
    options.map.units.population.urbanization.rate = 1;
    for (let n = 0; n < 200; n++) {
      const burg = makeFlying({ i: n + 1, cell: (n * 37) % 100 });
      (Burgs as any).definePopulation(burg);
      expect(burg.population * 1000 * 1).toBeGreaterThanOrEqual(100);
    }
  });

  it("holds the 100-person floor when urbanization shrinks people-per-unit", () => {
    options.map.units.population.scale = 1000;
    options.map.units.population.urbanization.rate = 0.2; // people = units * 200 — old 0.1-unit floor would mean 20 people
    for (let n = 0; n < 200; n++) {
      const burg = makeFlying({ i: n + 1, cell: (n * 37) % 100 });
      (Burgs as any).definePopulation(burg);
      expect(burg.population * 1000 * 0.2).toBeGreaterThanOrEqual(100 - 0.5); // rn() rounds to 3 decimals
    }
    options.map.units.population.urbanization.rate = 1;
  });

  it("gives the sky capital 2-6 units (~2k-6k people)", () => {
    options.map.units.population.scale = 1000;
    options.map.units.population.urbanization.rate = 1;
    for (let n = 0; n < 50; n++) {
      const burg = makeFlying({ i: n + 1, cell: (n * 37) % 100, capital: 1 });
      (Burgs as any).definePopulation(burg);
      expect(burg.population).toBeGreaterThanOrEqual(1.9); // gauss min 2 minus jitter
      expect(burg.population).toBeLessThanOrEqual(6.1); // gauss max 6 plus jitter
    }
  });
});

// ---------------------------------------------------------------------------
// Upstream tests: BurgsModule.assignPorts
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Fork tests: multi-burg-per-cell slot rules
// ---------------------------------------------------------------------------

const makeBurg = (i: number, cell: number, extra: Record<string, unknown> = {}) =>
  ({ i, cell, x: 0, y: 0, state: 0, culture: 0, name: `b${i}`, feature: 0, capital: 0, port: 0, ...extra }) as any;

describe("cellSlotAfterRemoval", () => {
  it("clears the slot when the removed burg owns it and has no co-residents", () => {
    const b = makeBurg(3, 10);
    expect(cellSlotAfterRemoval(3, b, [makeBurg(0, 0), b])).toBe(0);
  });

  it("promotes a co-located ground burg when the slot owner is removed", () => {
    const primary = makeBurg(3, 10);
    const secondary = makeBurg(7, 10);
    expect(cellSlotAfterRemoval(3, primary, [makeBurg(0, 0), primary, secondary])).toBe(7);
  });

  it("does NOT promote a flying co-resident", () => {
    const primary = makeBurg(3, 10);
    const sky = makeBurg(7, 10, { flying: 1 });
    expect(cellSlotAfterRemoval(3, primary, [makeBurg(0, 0), primary, sky])).toBe(0);
  });

  it("does NOT promote a removed co-resident", () => {
    const primary = makeBurg(3, 10);
    const dead = makeBurg(7, 10, { removed: true });
    expect(cellSlotAfterRemoval(3, primary, [makeBurg(0, 0), primary, dead])).toBe(0);
  });

  it("leaves the slot alone when removing a secondary (non-owner) burg", () => {
    const secondary = makeBurg(7, 10);
    expect(cellSlotAfterRemoval(3, secondary, [makeBurg(0, 0), makeBurg(3, 10), secondary])).toBe(3);
  });

  it("leaves the slot alone when removing a flying burg above a ground burg (live wrong-clear bug)", () => {
    const sky = makeBurg(7, 10, { flying: 1 });
    expect(cellSlotAfterRemoval(3, sky, [makeBurg(0, 0), makeBurg(3, 10), sky])).toBe(3);
  });

  it("leaves an empty slot empty when removing a flying burg over open terrain", () => {
    const sky = makeBurg(7, 10, { flying: 1 });
    expect(cellSlotAfterRemoval(0, sky, [makeBurg(0, 0), sky])).toBe(0);
  });
});

describe("transferTreasuryOnRemoval", () => {
  it("moves the removed anchor's treasury to the promoted successor", () => {
    const anchor = makeBurg(3, 10, { treasury: 120.5 });
    const successor = makeBurg(7, 10, { treasury: 10 });
    transferTreasuryOnRemoval(anchor, 7, [makeBurg(0, 0), anchor, successor]);
    expect(successor.treasury).toBe(130.5);
    expect(anchor.treasury).toBe(0);
  });

  it("does nothing when there is no successor", () => {
    const anchor = makeBurg(3, 10, { treasury: 50 });
    transferTreasuryOnRemoval(anchor, 0, [makeBurg(0, 0), anchor]);
    expect(anchor.treasury).toBe(50); // no successor -> pool dies with the burg (cell emptied)
  });

  it("does nothing when the removed burg has no treasury", () => {
    const poor = makeBurg(4, 11);
    const other = makeBurg(9, 11, { treasury: 5 });
    transferTreasuryOnRemoval(poor, 9, [makeBurg(0, 0), poor, other]);
    expect(other.treasury).toBe(5);
  });
});

describe("groundSlotOnPlacement", () => {
  it("first ground burg claims an empty slot", () => {
    expect(groundSlotOnPlacement(0, 5, false)).toBe(5);
  });

  it("later ground burgs do not steal an occupied slot", () => {
    expect(groundSlotOnPlacement(3, 5, false)).toBe(3);
  });

  it("flying burgs never claim the slot, even when empty", () => {
    expect(groundSlotOnPlacement(0, 5, true)).toBe(0);
    expect(groundSlotOnPlacement(3, 5, true)).toBe(3);
  });
});

describe("generate on an all-water map", () => {
  it("assigns the empty burgs array to pack instead of leaving it undefined", () => {
    const g = globalThis as any;
    g.TIME = false;
    g.ERROR = false;
    g.pack = { cells: { i: [0, 1, 2], s: [0, 0, 0], culture: [0, 0, 0] } };

    g.window.Burgs.generate();

    expect(g.pack.burgs).toEqual([0]);
    expect(Array.from(g.pack.cells.burg)).toEqual([0, 0, 0]);
  });
});

describe("ensureBurgGroupStyles", () => {
  it("seeds icon and anchor styles for custom groups from the fallback group, keeping existing entries", async () => {
    globalThis.window = globalThis.window || ({} as any);
    await import("./burgs-generator");
    const Burgs = (globalThis as any).Burgs;

    options.map.burgs.groups = [{ name: "town" }, { name: "fortresses" }] as never;
    const town = { attrs: { fill: "#aaa" }, options: { size: 1, icon: "#icon-burg" } };
    const townAnchor = { attrs: { fill: "#bbb" }, options: { size: 2 } };
    (globalThis as any).styles = {
      burgIcons: {
        burgIcons: { groups: { town: structuredClone(town) } },
        anchors: { groups: { town: structuredClone(townAnchor) } }
      }
    };

    Burgs.ensureBurgGroupStyles();

    const { burgIcons, anchors } = (globalThis as any).styles.burgIcons;
    expect(burgIcons.groups.town).toEqual(town);
    expect(burgIcons.groups.fortresses).toEqual(town);
    expect(burgIcons.groups.fortresses).not.toBe(burgIcons.groups.town);
    expect(anchors.groups.fortresses).toEqual(townAnchor);
  });
});

describe("BurgsModule.parseStoredGroups", () => {
  let Burgs: any;

  beforeEach(async () => {
    globalThis.TIME = false;
    globalThis.window = globalThis.window || ({} as any);
    await import("./burgs-generator");
    Burgs = (globalThis as any).Burgs;
  });

  it("falls back to the defaults when the stored value holds no usable group", () => {
    const defaults = Burgs.getDefaultGroups();
    expect(Burgs.parseStoredGroups(null)).toEqual(defaults);
    expect(Burgs.parseStoredGroups("[]")).toEqual(defaults);
    expect(Burgs.parseStoredGroups("not json")).toEqual(defaults);
    expect(Burgs.parseStoredGroups(JSON.stringify([{ order: 1 }]))).toEqual(defaults);
  });

  it("keeps usable stored groups and drops the rest", () => {
    const usable = { name: "outpost", order: 3 };
    const stored = JSON.stringify([usable, { order: 4 }, { name: "noOrder" }]);
    const groups = Burgs.parseStoredGroups(stored);
    expect(groups.map((group: any) => group.name)).toEqual(["outpost"]);
  });

  it("always leaves a default group for burg assignment to fall back on", () => {
    const groups = Burgs.parseStoredGroups(JSON.stringify([{ name: "outpost", order: 3 }]));
    expect(groups.filter((group: any) => group.isDefault).length).toBe(1);
  });
});
