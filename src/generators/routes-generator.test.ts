import FlatQueue from "flatqueue";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { isWrapEnabled, portImportance, type Route, wrapDeltaX, wrapDistanceSquared } from "./routes-generator";

// ---------------------------------------------------------------------------
// Fork tests
// ---------------------------------------------------------------------------

let Routes: any;

beforeAll(async () => {
  const g = globalThis as any;
  g.window = g.window ?? {};
  g.Node =
    g.Node ??
    class {
      addEventListener() {}
      removeEventListener() {}
    };
  g.document = g.document ?? {
    readyState: "complete",
    getElementById: () => null,
    addEventListener: () => {},
    querySelector: () => null
  };
  g.pack = {};
  g.TIME = false;
  g.WARN = false;
  g.ERROR = false;

  await import("./routes-generator");
  Routes = g.window.Routes;
});

function buildPack(routeCount: number, groupCycle: string[] = ["roads", "trails", "searoutes"]) {
  const routes: any[] = [0];
  const cellRoutes: Record<number, Record<number, number>> = {};

  for (let i = 1; i <= routeCount; i++) {
    const group = groupCycle[(i - 1) % groupCycle.length];
    routes.push({ i, group });
    if (!cellRoutes[i]) cellRoutes[i] = {};
    cellRoutes[i][i + 1] = i;
    if (!cellRoutes[i + 1]) cellRoutes[i + 1] = {};
    cellRoutes[i + 1][i] = i;
  }

  (globalThis as any).pack = {
    routes,
    cells: { routes: cellRoutes }
  };
}

describe("Routes.getRoute", () => {
  it("returns the route object for a connected cell pair", () => {
    buildPack(5);
    const route = Routes.getRoute(3, 4);
    expect(route).not.toBeNull();
    expect(route.i).toBe(3);
    expect(route.group).toBe("searoutes");
  });

  it("returns null for cell pairs with no connection", () => {
    buildPack(5);
    expect(Routes.getRoute(1, 99)).toBeNull();
    expect(Routes.getRoute(50, 51)).toBeNull();
  });

  it("returns null when from cell has no entries", () => {
    buildPack(5);
    expect(Routes.getRoute(999, 1000)).toBeNull();
  });
});

describe("Routes.hasRoad", () => {
  it("returns true when the cell has any road connection", () => {
    (globalThis as any).pack = {
      routes: [0, { i: 1, group: "roads" }],
      cells: { routes: { 10: { 11: 1 }, 11: { 10: 1 } } }
    };
    expect(Routes.hasRoad(10)).toBe(true);
  });

  it("returns false when the cell only has non-road connections", () => {
    (globalThis as any).pack = {
      routes: [0, { i: 1, group: "trails" }, { i: 2, group: "searoutes" }],
      cells: { routes: { 10: { 11: 1, 12: 2 } } }
    };
    expect(Routes.hasRoad(10)).toBe(false);
  });

  it("returns false when the cell has no connections", () => {
    (globalThis as any).pack = { routes: [0], cells: { routes: {} } };
    expect(Routes.hasRoad(9999)).toBe(false);
  });
});

describe("Routes.isCrossroad", () => {
  it("returns true when a cell has 4+ route connections", () => {
    (globalThis as any).pack = {
      routes: [
        0,
        { i: 1, group: "roads" },
        { i: 2, group: "roads" },
        { i: 3, group: "roads" },
        { i: 4, group: "roads" }
      ],
      cells: { routes: { 100: { 101: 1, 102: 2, 103: 3, 104: 4 } } }
    };
    expect(Routes.isCrossroad(100)).toBe(true);
  });

  it("returns true when a cell has 3+ road connections", () => {
    (globalThis as any).pack = {
      routes: [0, { i: 1, group: "roads" }, { i: 2, group: "roads" }, { i: 3, group: "roads" }],
      cells: { routes: { 100: { 101: 1, 102: 2, 103: 3 } } }
    };
    expect(Routes.isCrossroad(100)).toBe(true);
  });

  it("returns false when a cell has 2 connections", () => {
    (globalThis as any).pack = {
      routes: [0, { i: 1, group: "roads" }, { i: 2, group: "roads" }],
      cells: { routes: { 100: { 101: 1, 102: 2 } } }
    };
    expect(Routes.isCrossroad(100)).toBe(false);
  });
});

describe("Routes lookup performance", () => {
  it("getRoute lookup time does not scale with total route count", () => {
    // 50,000 routes — about the scale that triggers the bug in real maps
    buildPack(50_000);

    // Realistic mixed-id lookup pattern (10K lookups spread across the id range).
    // With O(n) array.find: ~10K × ~25K avg scan = ~250M ops → 200–800ms in v8.
    // With O(1) Map.get: ~10K × O(1) → typically <30ms.
    const start = performance.now();
    let found = 0;
    for (let i = 0; i < 10_000; i++) {
      const id = ((i * 4999) % 50_000) + 1;
      const route = Routes.getRoute(id, id + 1);
      if (route) found++;
    }
    const elapsed = performance.now() - start;

    expect(found).toBe(10_000); // sanity: every lookup hits
    // Threshold is generous: a Map should finish in <50ms, but we allow 150ms
    // for slow CI hardware. The current O(n) impl typically takes 250ms+.
    expect(elapsed).toBeLessThan(150);
  });

  it("getConnectivityRate does not scale with total route count", () => {
    // definePopulation calls this once per burg; with pack.routes.find it is
    // O(routes) per connection and dominated specifyBurgs (~3s at 80k burgs).
    buildPack(50_000);

    const start = performance.now();
    let total = 0;
    for (let i = 0; i < 10_000; i++) {
      const id = ((i * 4999) % 50_000) + 1;
      total += Routes.getConnectivityRate(id);
    }
    const elapsed = performance.now() - start;

    expect(total).toBeGreaterThan(0); // sanity: connections were found and rated
    expect(elapsed).toBeLessThan(150);
  });
});

describe("buildSeaAdjacency", () => {
  it("links west-edge water cells to the nearest east-edge water cell by latitude", () => {
    const g = globalThis as any;
    g.graphWidth = 100;
    g.grid = { spacing: 20 };
    // cells: 0 west-water(y10), 1 east-water(y12), 2 interior-water, 3 west-LAND, 4 east-water(y82), 5 west-water(y78)
    g.pack = {
      cells: {
        i: new Uint32Array([0, 1, 2, 3, 4, 5]),
        h: [0, 0, 0, 30, 0, 0],
        p: [
          [10, 10],
          [90, 12],
          [50, 50],
          [10, 80],
          [88, 82],
          [12, 78]
        ] as [number, number][],
        c: [[], [], [], [], [], []] as number[][]
      }
    };

    const adj = (Routes as any).buildSeaAdjacency();

    expect(adj[0]).toContain(1); // west(y10) -> east(y12)
    expect(adj[1]).toContain(0); // bidirectional
    expect(adj[5]).toContain(4); // west(y78) -> east(y82)
    expect(adj[4]).toContain(5);
    expect(adj[3]).toEqual([]); // land edge cell untouched
    expect(g.pack.cells.c[0]).toEqual([]); // global graph NOT mutated
  });
});

describe("wrap helpers", () => {
  it("wrapDeltaX returns the shorter cylinder gap", () => {
    expect(wrapDeltaX(10, 100)).toBe(10); // direct is shorter
    expect(wrapDeltaX(90, 100)).toBe(10); // around the seam is shorter
    expect(wrapDeltaX(-90, 100)).toBe(10); // sign-independent
    expect(wrapDeltaX(50, 100)).toBe(50); // exactly half
  });

  it("wrapDistanceSquared wraps X only when enabled", () => {
    const a: [number, number] = [5, 40];
    const b: [number, number] = [95, 40];
    expect(wrapDistanceSquared(a, b, false, 100)).toBe(90 * 90); // flat: far
    expect(wrapDistanceSquared(a, b, true, 100)).toBe(10 * 10); // wrapped: close
  });

  it("isWrapEnabled is true only at lonT === 360", () => {
    const g = globalThis as any;
    g.mapCoordinates = { lonT: 360 };
    expect(isWrapEnabled()).toBe(true);
    g.mapCoordinates = { lonT: 359.9 };
    expect(isWrapEnabled()).toBe(false);
    g.mapCoordinates = undefined;
    expect(isWrapEnabled()).toBe(false);
  });
});

describe("calculateUrquhartEdges wrap", () => {
  const hasEdge = (edges: number[][], a: number, b: number) =>
    edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  it("connects points across the seam only when wrap is enabled", () => {
    // 0 & 1 hug opposite edges at the same latitude; 2 & 3 are interior anchors
    const points: [number, number][] = [
      [5, 50], // 0 west edge
      [95, 50], // 1 east edge
      [40, 10], // 2
      [60, 90] // 3
    ];

    const flat = (Routes as any).calculateUrquhartEdges(points, false, 100);
    const wrapped = (Routes as any).calculateUrquhartEdges(points, true, 100);

    expect(hasEdge(flat, 0, 1)).toBe(false); // far apart on the flat map
    expect(hasEdge(wrapped, 0, 1)).toBe(true); // close across the seam
  });
});

describe("getPath seam split", () => {
  beforeAll(() => {
    const g = globalThis as any;
    g.graphWidth = 1000;
    g.mapCoordinates = { lonT: 360 };
  });

  const countMoves = (d: string) => (d.match(/M/g) || []).length;

  it("splits a seam-crossing route into two stubs reaching both frame edges", () => {
    // crosses the seam: x jumps from 980 to 20 (|dx| = 960 > 500)
    const points = [
      [940, 300, 0],
      [980, 305, 1],
      [20, 310, 2],
      [60, 315, 3]
    ];
    const d = (Routes as any).getPath({ group: "searoutes", points });
    expect(countMoves(d)).toBe(2); // two sub-paths
    expect(d).toContain("1000"); // one stub runs to the east frame (x=graphWidth)
    expect(/M\s*0[ ,]/.test(d) || d.includes("M0")).toBe(true); // other stub starts at x=0
  });

  it("leaves a normal (non-crossing) route as a single path", () => {
    const points = [
      [100, 300, 0],
      [200, 305, 1],
      [300, 310, 2]
    ];
    const d = (Routes as any).getPath({ group: "searoutes", points });
    expect(countMoves(d)).toBe(1);
  });
});

describe("getLength wrapped", () => {
  it("measures a seam route by wrapped distance, not the screen gap", () => {
    const g = globalThis as any;
    g.graphWidth = 1000;
    g.mapCoordinates = { lonT: 360 };
    g.pack = {
      routes: [
        {
          i: 7,
          group: "searoutes",
          points: [
            [980, 300, 0],
            [20, 300, 1]
          ]
        } // |dx|=960 seam crossing
      ]
    };

    const len = Routes.getLength(7);
    // wrapped horizontal gap is 40, not 960
    expect(len).toBeCloseTo(40, 5);
  });
});

describe("portImportance", () => {
  const port = (population: number, settlementType: string, capital = 0) =>
    ({ population, settlementType, capital }) as any;

  it("ranks roles capital > largePort > regionalCenter > marketTown > village > hamlet at equal population", () => {
    const cap = portImportance(port(1, "capital"));
    const lp = portImportance(port(1, "largePort"));
    const rc = portImportance(port(1, "regionalCenter"));
    const mt = portImportance(port(1, "marketTown"));
    const vil = portImportance(port(1, "largeVillage"));
    const ham = portImportance(port(1, "hamlet"));
    expect(cap).toBeGreaterThan(lp);
    expect(lp).toBeGreaterThan(rc);
    expect(rc).toBeGreaterThan(mt);
    expect(mt).toBeGreaterThan(vil);
    expect(vil).toBeGreaterThan(ham);
  });

  it("scales with population within a role", () => {
    expect(portImportance(port(2, "marketTown"))).toBeGreaterThan(portImportance(port(1, "marketTown")));
  });

  it("treats the capital flag as the capital role regardless of settlementType", () => {
    expect(portImportance(port(1, "hamlet", 1))).toBe(portImportance(port(1, "capital")));
  });

  it("defaults unknown roles to a 1.0 multiplier and missing population to 0", () => {
    expect(portImportance(port(2, "mystery"))).toBe(2);
    expect(portImportance({} as any)).toBe(0);
  });
});

describe("collectSeamLinks", () => {
  it("pairs each west-edge water cell with the nearest east-edge water cell by latitude", () => {
    const g = globalThis as any;
    g.graphWidth = 100;
    g.grid = { spacing: 20 };
    g.pack = {
      cells: {
        i: new Uint32Array([0, 1, 2, 3, 4, 5]),
        h: [0, 0, 0, 30, 0, 0],
        p: [
          [10, 10],
          [90, 12],
          [50, 50],
          [10, 80],
          [88, 82],
          [12, 78]
        ] as [number, number][],
        c: [[], [], [], [], [], []] as number[][]
      }
    };

    const links = (Routes as any).collectSeamLinks() as Array<[number, number]>;
    const has = (a: number, b: number) => links.some(([w, e]) => w === a && e === b);
    expect(has(0, 1)).toBe(true); // west(y10) -> east(y12)
    expect(has(5, 4)).toBe(true); // west(y78) -> east(y82)
    expect(links.length).toBe(2); // only the two west water cells produce links
  });

  it("returns no links when an edge has no water", () => {
    const g = globalThis as any;
    g.graphWidth = 100;
    g.grid = { spacing: 20 };
    g.pack = {
      cells: {
        i: new Uint32Array([0, 1]),
        h: [0, 0],
        p: [
          [10, 10],
          [50, 50]
        ] as [number, number][],
        c: [[], []] as number[][]
      }
    };
    expect((Routes as any).collectSeamLinks()).toEqual([]);
  });
});

describe("buildNavigableComponents", () => {
  // Two edge water cells (feature 1 west, feature 2 east) + ports on each feature.
  const setup = (lonT: number) => {
    const g = globalThis as any;
    g.graphWidth = 100;
    g.grid = { spacing: 20 };
    g.mapCoordinates = { lonT };
    g.pack = {
      cells: {
        i: new Uint32Array([0, 1]),
        h: [0, 0],
        f: [1, 2],
        p: [
          [10, 50],
          [90, 50]
        ] as [number, number][],
        c: [[], []] as number[][]
      },
      burgs: [{}, { i: 1, port: 1, cell: 0 }, { i: 2, port: 2, cell: 1 }]
    };
  };

  it("keeps each port-feature its own component on a non-360 map", () => {
    setup(180);
    const comp = (Routes as any).buildNavigableComponents() as Map<number, number>;
    expect(comp.get(1)).not.toBe(comp.get(2));
  });

  it("unions seam-joined features into one component on a 360 map", () => {
    setup(360);
    const comp = (Routes as any).buildNavigableComponents() as Map<number, number>;
    expect(comp.get(1)).toBe(comp.get(2));
  });
});

describe("generateSeaTradeNetwork hub dedup", () => {
  // A 7x7 all-water grid (4-connected). Cell id = y*7 + x; position is its grid
  // coordinate scaled to span 0..1000 so mapScale === 1 (km === pixel distance).
  const N = 7;
  const STEP = 1000 / (N - 1);
  const CELLS = N * N;

  // Build the packed water graph + globals findPath/cost evaluation read.
  const makeWaterGrid = () => {
    const i = new Uint32Array(CELLS);
    const c: number[][] = [];
    const p: [number, number][] = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const id = y * N + x;
        i[id] = id;
        p.push([x * STEP, y * STEP]);
        const neibs: number[] = [];
        if (x > 0) neibs.push(id - 1);
        if (x < N - 1) neibs.push(id + 1);
        if (y > 0) neibs.push(id - N);
        if (y < N - 1) neibs.push(id + N);
        c.push(neibs);
      }
    }
    return {
      i,
      c,
      p,
      h: new Array(CELLS).fill(0), // all water (h < 20)
      t: new Array(CELLS).fill(0), // ROUTE_TYPE_MODIFIERS.default
      g: new Array(CELLS).fill(0), // grid-cell index -> temp[0]
      f: new Array(CELLS).fill(0) // landmass; ports overwrite with distinct ids
    };
  };

  // hub (24, centre) + four ports within SEA_FEEDER_CAP_KM (300px) arranged in
  // cardinal directions. Each outer port routes to the hub as the highest-gravity
  // partner within reach — exactly the "many routes converge on one port" case.
  // All ports are on distinct landmasses so there are no same-landmass feeder caps.
  // STEP ≈ 166.67px, so cell ±1 in x or y is ~167px and cell ±1 diagonally is ~236px.
  const HUB = 24; // centre cell (3, 3) = (500, 500)
  const ports = [
    { i: 1, port: 1, cell: HUB, x: 500, y: 500, population: 100, settlementType: "capital", capital: 1 },
    { i: 2, port: 1, cell: 23, x: 500 - STEP, y: 500, population: 100, settlementType: "capital", capital: 1 },
    { i: 3, port: 1, cell: 25, x: 500 + STEP, y: 500, population: 100, settlementType: "capital", capital: 1 },
    { i: 4, port: 1, cell: 17, x: 500, y: 500 - STEP, population: 100, settlementType: "capital", capital: 1 },
    { i: 5, port: 1, cell: 31, x: 500, y: 500 + STEP, population: 100, settlementType: "capital", capital: 1 }
  ] as any[];
  const landmassOf: Record<number, number> = { [HUB]: 1, 23: 2, 25: 3, 17: 4, 31: 5 };

  beforeAll(() => {
    const g = globalThis as any;
    g.window = g.window ?? {};
    g.window.FlatQueue = FlatQueue;
    g.graphWidth = 1000;
    g.graphHeight = 1000; // mapScale = 1
    g.mapCoordinates = { lonT: 180 }; // wrap off
    const cells = makeWaterGrid();
    for (const [cell, lm] of Object.entries(landmassOf)) {
      cells.f[Number(cell)] = lm;
      cells.h[Number(cell)] = 30; // ports sit on LAND, reached across water (like real maps)
    }
    g.pack = { cells };
    g.grid = { cells: { temp: [20] } }; // >= MIN_PASSABLE_SEA_TEMP
  });

  it("emits each undirected cell-edge at most once across all routes", () => {
    const connections = new Set<number>();
    const burgIndex = { portsByFeature: { 1: ports } } as any;
    const components = new Map<number, number>([[1, 0]]); // all ports share one component

    const { localRoutes } = (Routes as any).generateSeaTradeNetwork(connections, burgIndex, components, undefined);
    const allRoutes = [...localRoutes];

    // The scenario must be real: the hub is a junction of >= 3 distinct corridors.
    const hubNeighbours = new Set<number>();
    const edgeCounts = new Map<number, number>();
    for (const route of allRoutes) {
      const cs: number[] = route.cells;
      for (let k = 0; k < cs.length - 1; k++) {
        const a = cs[k];
        const b = cs[k + 1];
        if (a === HUB) hubNeighbours.add(b);
        if (b === HUB) hubNeighbours.add(a);
        const key = Math.min(a, b) * CELLS + Math.max(a, b);
        edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
      }
    }

    expect(hubNeighbours.size).toBeGreaterThanOrEqual(3); // hub really is a convergence point

    const duplicated = [...edgeCounts.entries()].filter(([, count]) => count > 1);
    expect(duplicated).toEqual([]); // no cell-edge drawn twice
  });
});

describe("generateSeaTradeNetwork feeder multi-target", () => {
  // 13x13 grid, all LAND except a forced 3-cell water channel {14,27,40} = column 1
  // rows 1-3. A feeder source port (cell 1, on land at the channel head) reaches two
  // coastal land ports (39 and 41) that flank the channel mouth (cell 40). Both
  // feeder paths must share the channel corridor, so the network must (a) actually
  // lay feeder routes to land ports and (b) draw the shared corridor only once.
  const N = 13;
  const STEP = 1000 / (N - 1);
  const CHANNEL = [14, 27, 40];

  const buildChannelGrid = () => {
    const i = new Uint32Array(N * N);
    const c: number[][] = [];
    const p: [number, number][] = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const id = y * N + x;
        i[id] = id;
        p.push([x * STEP, y * STEP]);
        const neibs: number[] = [];
        if (x > 0) neibs.push(id - 1);
        if (x < N - 1) neibs.push(id + 1);
        if (y > 0) neibs.push(id - N);
        if (y < N - 1) neibs.push(id + N);
        c.push(neibs);
      }
    }
    const h = new Array(N * N).fill(30); // all land
    for (const w of CHANNEL) h[w] = 0; // carve the water channel
    return {
      i,
      c,
      p,
      h,
      t: new Array(N * N).fill(0),
      g: new Array(N * N).fill(0),
      f: new Array(N * N).fill(1) // single landmass -> no trunk, pure feeders
    };
  };

  // x,y derived from cell id so positions match cells.p exactly.
  const port = (id: number, cellId: number) =>
    ({
      i: id,
      port: 1,
      cell: cellId,
      x: (cellId % N) * STEP,
      y: Math.floor(cellId / N) * STEP,
      population: 100,
      settlementType: "capital",
      capital: 1
    }) as any;
  const SOURCE = 1;
  const PL = 39;
  const PR = 41;

  beforeAll(() => {
    const g = globalThis as any;
    g.window = g.window ?? {};
    g.window.FlatQueue = FlatQueue;
    g.graphWidth = 1000;
    g.graphHeight = 1000;
    g.mapCoordinates = { lonT: 180 };
    g.pack = { cells: buildChannelGrid() };
    g.grid = { cells: { temp: [20] } };
  });

  it("lays feeder routes to land ports and draws the shared corridor only once", () => {
    const connections = new Set<number>();
    const burgIndex = { portsByFeature: { 1: [port(1, SOURCE), port(2, PL), port(3, PR)] } } as any;
    const components = new Map<number, number>([[1, 0]]);

    const { localRoutes } = (Routes as any).generateSeaTradeNetwork(connections, burgIndex, components, undefined);

    expect(localRoutes.length).toBeGreaterThan(0); // feeders to land ports ARE produced

    const cellsByEdge = new Map<number, number>();
    const visited = new Set<number>();
    for (const route of localRoutes) {
      const cs: number[] = route.cells;
      for (const cell of cs) visited.add(cell);
      for (let k = 0; k < cs.length - 1; k++) {
        const key = Math.min(cs[k], cs[k + 1]) * N * N + Math.max(cs[k], cs[k + 1]);
        cellsByEdge.set(key, (cellsByEdge.get(key) ?? 0) + 1);
      }
    }

    // both coastal ports are reached, and no corridor edge is drawn twice
    expect(visited.has(PL)).toBe(true);
    expect(visited.has(PR)).toBe(true);
    expect([...cellsByEdge.values()].filter(count => count > 1)).toEqual([]);
  });

  it("tags each sea route with the tier that laid it", () => {
    const connections = new Set<number>();
    const burgIndex = { portsByFeature: { 1: [port(1, SOURCE), port(2, PL), port(3, PR)] } } as any;
    const components = new Map<number, number>([[1, 0]]);

    const { localRoutes } = (Routes as any).generateSeaTradeNetwork(connections, burgIndex, components, undefined);

    const types = localRoutes.map((route: Route) => route.type);
    expect(types).toContain("feeder");
    expect(types.every((type: string) => type === "feeder" || type === "coastal")).toBe(true);
  });
});

describe("selectSeaTradeEdges", () => {
  // Each capital sits on its own landmass (10/20/30); the hamlet cluster shares a
  // fourth landmass (40). cells.f is indexed by burg.cell, which the trunk tier
  // reads to keep only inter-landmass crossings.
  const landmass = [10, 20, 30, 40, 40, 40];

  beforeAll(() => {
    const g = globalThis as any;
    g.graphWidth = 1000;
    g.graphHeight = 1000; // mapScale = 1 -> km == pixel distance
    g.mapCoordinates = { lonT: 180 }; // wrap off
    g.pack = { cells: { f: landmass } };
  });

  // Three high-importance capital hubs (0,1,2) on three separate landmasses,
  // surrounding a tight low-importance hamlet cluster (3,4,5) on a fourth. The hubs
  // dominate every hamlet's gravity top picks, so the short hamlet-hamlet Urquhart
  // edges fall out of the feeder tier and survive only as coastal edges; every
  // capital sits within SEA_FEEDER_CAP_KM of at least one hamlet so all ports
  // participate in the network.
  const ports = [
    { x: 200, y: 400, population: 100, settlementType: "capital", capital: 1, cell: 0, port: 1 },
    { x: 200, y: 700, population: 100, settlementType: "capital", capital: 1, cell: 1, port: 1 },
    { x: 520, y: 550, population: 100, settlementType: "capital", capital: 1, cell: 2, port: 1 },
    { x: 340, y: 530, population: 1, settlementType: "hamlet", cell: 3, port: 1 },
    { x: 370, y: 555, population: 1, settlementType: "hamlet", cell: 4, port: 1 },
    { x: 345, y: 580, population: 1, settlementType: "hamlet", cell: 5, port: 1 }
  ] as any[];

  const isCapital = (i: number) => i <= 2;
  const km = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y);

  it("emits feeder+coastal tiers, links every port, dedupes pairs, and respects caps", () => {
    const edges = (Routes as any).selectSeaTradeEdges(ports) as Array<{
      from: number;
      to: number;
      tier: string;
    }>;

    // every port participates in at least one edge
    const touched = new Set<number>();
    edges.forEach(e => {
      touched.add(e.from);
      touched.add(e.to);
    });
    expect(touched.size).toBe(ports.length);

    // no duplicate unordered pair
    const keys = edges.map(e => `${Math.min(e.from, e.to)}-${Math.max(e.from, e.to)}`);
    expect(new Set(keys).size).toBe(keys.length);

    expect(edges.every(e => e.tier !== "trunk")).toBe(true); // trunk tier removed

    // at least one feeder and one coastal edge exist
    expect(edges.some(e => e.tier === "feeder")).toBe(true);
    expect(edges.some(e => e.tier === "coastal")).toBe(true);

    // coastal edges are the short hamlet-hamlet pairs (same landmass, non-capital)
    expect(edges.every(e => e.tier !== "coastal" || (!isCapital(e.from) && !isCapital(e.to)))).toBe(true);

    // coastal edges stay within the coastal cap
    edges.forEach(e => {
      if (e.tier === "coastal") expect(km(ports[e.from], ports[e.to])).toBeLessThanOrEqual(120);
    });
  });
});

describe("generateTradeNetwork", () => {
  const N = 13;
  const STEP = 1000 / (N - 1);

  const buildGrid = (landCells: number[]) => {
    const i = new Uint32Array(N * N);
    const c: number[][] = [];
    const p: [number, number][] = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const id = y * N + x;
        i[id] = id;
        p.push([x * STEP, y * STEP]);
        const neibs: number[] = [];
        if (x > 0) neibs.push(id - 1);
        if (x < N - 1) neibs.push(id + 1);
        if (y > 0) neibs.push(id - N);
        if (y < N - 1) neibs.push(id + N);
        c.push(neibs);
      }
    }
    const h = new Array(N * N).fill(0); // water
    for (const land of landCells) h[land] = 30;
    return { i, c, p, h, t: new Array(N * N).fill(0), g: new Array(N * N).fill(0), f: new Array(N * N).fill(1) };
  };

  it("produces trade routes connecting state hubs via waystations", () => {
    const g = globalThis as any;
    g.window = g.window ?? {};
    g.window.FlatQueue = FlatQueue; // needed if any leg uses the water-path fallback
    g.graphWidth = 1000;
    g.graphHeight = 1000;
    g.mapCoordinates = { lonT: 180 };

    // Legs must be <= TRADE_LEG_RANGE_KM (300px at mapScale 1) = 3.6 cells. Hubs at
    // cells 1 and 7 are 500px apart (one leg too far), so they only connect via the
    // waystation at cell 4: cap1-way = 250px, way-cap2 = 250px. all land, rest water.
    const cap1 = {
      i: 1,
      state: 1,
      capital: 1,
      port: 1,
      cell: 1,
      x: STEP,
      y: 0,
      population: 50,
      settlementType: "largePort"
    } as any;
    const cap2 = {
      i: 2,
      state: 2,
      capital: 1,
      port: 1,
      cell: 7,
      x: 7 * STEP,
      y: 0,
      population: 50,
      settlementType: "largePort"
    } as any;
    const way = {
      i: 3,
      state: 1,
      port: 1,
      cell: 4,
      x: 4 * STEP,
      y: 0,
      population: 20,
      settlementType: "largePort"
    } as any;
    const burgs = [{}, cap1, cap2, way] as any[];
    g.pack = { cells: buildGrid([1, 4, 7]), burgs };
    g.grid = { cells: { temp: [20] } };

    const routes = (Routes as any).generateTradeNetwork(new Map<number, number>());

    expect(cap1.tradeRole).toBe("hub");
    expect(cap2.tradeRole).toBe("hub");
    expect(way.tradeRole).toBe("waystation");
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((r: any) => r.group === "traderoutes")).toBe(true);
    // the union of leg endpoints covers both hubs (route reaches hub cells 1 and 7)
    const cells = new Set<number>(routes.flatMap((r: any) => r.points.map((pt: number[]) => pt[2])));
    expect(cells.has(1)).toBe(true);
    expect(cells.has(7)).toBe(true);
    expect(routes.length).toBe(2); // two legs: cap1<->way and way<->cap2 (no direct hub-hub leg)
    // no single route connects the two hubs directly
    const direct = routes.some((r: any) => {
      const cs = r.points.map((pt: number[]) => pt[2]);
      return cs.includes(1) && cs.includes(7);
    });
    expect(direct).toBe(false);
  });
});

describe("rebuildTradeRoutes", () => {
  const N = 13;
  const STEP = 1000 / (N - 1);

  const buildGrid = (landCells: number[]) => {
    const i = new Uint32Array(N * N);
    const c: number[][] = [];
    const p: [number, number][] = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const id = y * N + x;
        i[id] = id;
        p.push([x * STEP, y * STEP]);
        const neibs: number[] = [];
        if (x > 0) neibs.push(id - 1);
        if (x < N - 1) neibs.push(id + 1);
        if (y > 0) neibs.push(id - N);
        if (y < N - 1) neibs.push(id + N);
        c.push(neibs);
      }
    }
    const h = new Array(N * N).fill(0); // water
    for (const land of landCells) h[land] = 30;
    return { i, c, p, h, t: new Array(N * N).fill(0), g: new Array(N * N).fill(0), f: new Array(N * N).fill(1) };
  };

  const setupPack = () => {
    const g = globalThis as any;
    g.window = g.window ?? {};
    g.window.FlatQueue = FlatQueue;
    g.graphWidth = 1000;
    g.graphHeight = 1000;
    g.mapCoordinates = { lonT: 180 };
    g.Layers = { isOn: () => false }; // rebuild must not try to draw in the test env

    const cap1 = {
      i: 1,
      state: 1,
      capital: 1,
      port: 1,
      cell: 1,
      x: STEP,
      y: 0,
      population: 50,
      settlementType: "largePort"
    } as any;
    const cap2 = {
      i: 2,
      state: 2,
      capital: 1,
      port: 1,
      cell: 7,
      x: 7 * STEP,
      y: 0,
      population: 50,
      settlementType: "largePort"
    } as any;
    const way = {
      i: 3,
      state: 1,
      port: 1,
      cell: 4,
      x: 4 * STEP,
      y: 0,
      population: 20,
      settlementType: "largePort"
    } as any;

    // pre-existing routes: a road that must survive, a stale trade lane that must go
    const road = {
      i: 0,
      group: "roads",
      feature: 1,
      points: [
        [STEP, 0, 1],
        [4 * STEP, 0, 4]
      ]
    } as any;
    const staleTrade = {
      i: 1,
      group: "traderoutes",
      feature: 1,
      points: [
        [4 * STEP, 0, 4],
        [7 * STEP, 0, 7]
      ]
    } as any;

    g.pack = { cells: buildGrid([1, 4, 7]), burgs: [{}, cap1, cap2, way], routes: [road, staleTrade] };
    g.pack.cells.routes = (Routes as any).buildLinks(g.pack.routes);
    g.grid = { cells: { temp: [20] } };

    return { cap1, cap2, way, road };
  };

  it("replaces traderoutes, renumbers uniquely, and leaves other groups untouched", () => {
    const { road } = setupPack();
    (Routes as any).rebuildTradeRoutes();

    const pack = (globalThis as any).pack;
    const trade = pack.routes.filter((r: any) => r.group === "traderoutes");
    const roads = pack.routes.filter((r: any) => r.group === "roads");

    expect(roads).toEqual([road]); // untouched
    expect(trade.length).toBe(2); // cap1<->way and way<->cap2, as in generateTradeNetwork
    const ids = pack.routes.map((r: any) => r.i);
    expect(new Set(ids).size).toBe(ids.length); // unique ids after renumbering

    // cells.routes was rebuilt: every link points at an existing route
    const routeIds = new Set(ids);
    for (const links of Object.values(pack.cells.routes) as any[]) {
      for (const routeId of Object.values(links) as number[]) {
        expect(routeIds.has(routeId)).toBe(true);
      }
    }
  });

  it("manual none on a hub excludes it and promotes the next-best port", () => {
    const { cap1, way } = setupPack();
    cap1.tradeRole = undefined;
    cap1.tradeRoleManual = true;

    (Routes as any).rebuildTradeRoutes();

    const pack = (globalThis as any).pack;
    expect(cap1.tradeRole).toBeUndefined(); // manual override survives assignTradeRoles
    expect(way.tradeRole).toBe("hub"); // nearest remaining state-1 port takes over

    const trade = pack.routes.filter((r: any) => r.group === "traderoutes");
    expect(trade.length).toBeGreaterThan(0);
    // the excluded burg's cell is not an endpoint of any trade lane
    const endpoints = trade.flatMap((r: any) => [r.points[0][2], r.points[r.points.length - 1][2]]);
    expect(endpoints).not.toContain(1);
  });

  it("manual hub role survives the rebuild", () => {
    const { way } = setupPack();
    way.tradeRole = "hub";
    way.tradeRoleManual = true;

    (Routes as any).rebuildTradeRoutes();

    expect(way.tradeRole).toBe("hub"); // not demoted back to waystation
  });

  it("is idempotent: consecutive rebuilds keep counts stable with no leftovers", () => {
    setupPack();
    (Routes as any).rebuildTradeRoutes();
    const pack = (globalThis as any).pack;
    const countAfterFirst = pack.routes.filter((r: any) => r.group === "traderoutes").length;
    const totalAfterFirst = pack.routes.length;

    (Routes as any).rebuildTradeRoutes();
    expect(pack.routes.filter((r: any) => r.group === "traderoutes").length).toBe(countAfterFirst);
    expect(pack.routes.length).toBe(totalAfterFirst);
    const ids = pack.routes.map((r: any) => r.i);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("RoutesModule.remove", () => {
  let Routes: any;

  beforeEach(async () => {
    globalThis.TIME = false;
    globalThis.window = globalThis.window || ({} as any);
    // d3 select() needs a document in the node env
    globalThis.document = { querySelector: () => null, documentElement: {} } as any;
    globalThis.pack = { cells: {}, routes: [] } as any;
    await import("./routes-generator");
    Routes = (globalThis as any).Routes;
  });

  it("removes a route when the link index is asymmetric (reverse cell absent)", () => {
    globalThis.pack.routes = [
      {
        i: 1,
        group: "roads",
        points: [
          [0, 0, 10],
          [0, 0, 20]
        ]
      }
    ] as any;
    // asymmetric index: forward link 10->20 exists but cell 20 has no reverse entry
    globalThis.pack.cells.routes = { 10: { 20: 1 } } as any;

    expect(() => Routes.remove(globalThis.pack.routes[0])).not.toThrow();
    expect(globalThis.pack.routes).toHaveLength(0);
    expect(globalThis.pack.cells.routes[10][20]).toBeUndefined();
  });
});

describe("RoutesModule.remove", () => {
  let Routes: any;

  beforeEach(async () => {
    globalThis.TIME = false;
    globalThis.window = globalThis.window || ({} as any);
    // d3 select() needs a document in the node env
    globalThis.document = { querySelector: () => null, documentElement: {} } as any;
    globalThis.pack = { cells: {}, routes: [] } as any;
    await import("./routes-generator");
    Routes = (globalThis as any).Routes;
  });

  it("removes a route when the link index is asymmetric (reverse cell absent)", () => {
    globalThis.pack.routes = [
      {
        i: 1,
        group: "roads",
        points: [
          [0, 0, 10],
          [0, 0, 20]
        ]
      }
    ] as any;
    // asymmetric index: forward link 10->20 exists but cell 20 has no reverse entry
    globalThis.pack.cells.routes = { 10: { 20: 1 } } as any;

    expect(() => Routes.remove(globalThis.pack.routes[0])).not.toThrow();
    expect(globalThis.pack.routes).toHaveLength(0);
    expect(globalThis.pack.cells.routes[10][20]).toBeUndefined();
  });
});

describe("ensureRouteGroupStyles", () => {
  it("seeds styles for route groups missing from the store, keeping existing entries", async () => {
    globalThis.TIME = false;
    globalThis.window = globalThis.window || ({} as any);
    globalThis.grid = { cells: { temp: [20] } } as any;
    globalThis.pack = {
      cells: { h: [], r: [], fl: [], p: [], t: [], g: [] },
      rivers: [],
      routes: [
        { i: 0, group: "roads", points: [] },
        { i: 1, group: "route-royal", points: [] }
      ]
    } as any;
    await import("./routes-generator");
    const Routes = (globalThis as any).Routes;

    const roads = { attrs: { opacity: 0.9, stroke: "#d06324", "stroke-width": 0.7 } };
    (globalThis as any).styles = { routes: { groups: { roads: structuredClone(roads) } } };

    Routes.ensureRouteGroupStyles();

    const groups = (globalThis as any).styles.routes.groups;
    expect(groups.roads).toEqual(roads);
    expect(groups["route-royal"]).toEqual(roads);
    expect(groups["route-royal"]).not.toBe(groups.roads);
  });
});

describe("ensureRouteGroupStyles before a map exists", () => {
  it("is a no-op when the pack has no routes yet (style preset applied on initial load)", async () => {
    globalThis.TIME = false;
    globalThis.window = globalThis.window || ({} as any);
    globalThis.grid = { cells: { temp: [20] } } as any;
    globalThis.pack = {} as any;
    await import("./routes-generator");
    const Routes = (globalThis as any).Routes;

    (globalThis as any).styles = { routes: { groups: { roads: { attrs: { opacity: 0.9 } } } } };

    expect(() => Routes.ensureRouteGroupStyles()).not.toThrow();
    expect(Object.keys((globalThis as any).styles.routes.groups)).toEqual(["roads"]);
  });
});
