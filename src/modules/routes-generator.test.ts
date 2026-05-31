import { beforeEach, describe, expect, it } from "vitest";
import { MIN_NAVIGABLE_FLUX } from "./river-generator";

describe("RoutesModule river-aware water cost", () => {
  let Routes: any;

  beforeEach(async () => {
    globalThis.TIME = false;
    globalThis.window = globalThis.window || ({} as any);
    // Defaults overridden per-test; needs to exist before module import so window.Routes wires up
    globalThis.pack = {
      cells: {
        h: [] as number[],
        r: [] as number[],
        fl: [] as number[],
        p: [] as [number, number][],
        t: [] as number[],
        g: [] as number[]
      },
      rivers: [],
      routes: []
    } as any;
    globalThis.grid = { cells: { temp: [20, 20, 20, 20, 20, 20, 20, 20] } } as any;

    await import("./routes-generator");
    Routes = (globalThis as any).Routes;
  });

  function setupTwoRiverPack() {
    // Layout: two parallel rivers (A: cells 1->2, B: cells 3->4), both with flux >= threshold.
    // Cells 2 and 3 are voronoi-neighbors (banks face each other across a watershed) but they
    // belong to different rivers and must NOT be river-adjacent.
    globalThis.pack.cells = {
      h: [20, 25, 25, 25, 25, 5], // 5 is sea
      r: [0, 1, 1, 2, 2, 0],
      fl: [0, MIN_NAVIGABLE_FLUX, MIN_NAVIGABLE_FLUX + 50, MIN_NAVIGABLE_FLUX, MIN_NAVIGABLE_FLUX + 50, 0],
      p: [
        [0, 0],
        [10, 0],
        [20, 0],
        [10, 5],
        [20, 5],
        [30, 0]
      ],
      t: [1, 1, 1, 1, 1, -1],
      g: [0, 0, 0, 0, 0, 0]
    } as any;
    // River A flows 1 -> 2 -> 5 (sea); River B flows 3 -> 4 -> 5 (sea)
    globalThis.pack.rivers = [
      { i: 1, cells: [1, 2, 5] },
      { i: 2, cells: [3, 4, 5] }
    ] as any;
    Routes.sync();
  }

  it("allows a step along the river course above the flux threshold", () => {
    setupTwoRiverPack();
    expect(Routes.getWaterPathCost(1, 2)).toBeLessThan(Infinity);
    expect(Routes.getWaterPathCost(2, 1)).toBeLessThan(Infinity);
  });

  it("rejects a step between voronoi-adjacent cells of different rivers", () => {
    setupTwoRiverPack();
    expect(Routes.getWaterPathCost(2, 3)).toBe(Infinity);
    expect(Routes.getWaterPathCost(3, 2)).toBe(Infinity);
  });

  it("rejects a step onto a river cell with flux below the threshold", () => {
    globalThis.pack.cells = {
      h: [20, 25, 25],
      r: [0, 1, 1],
      fl: [0, MIN_NAVIGABLE_FLUX, MIN_NAVIGABLE_FLUX - 1],
      p: [
        [0, 0],
        [10, 0],
        [20, 0]
      ],
      t: [1, 1, 1],
      g: [0, 0, 0]
    } as any;
    globalThis.pack.rivers = [{ i: 1, cells: [1, 2] }] as any;
    Routes.sync();

    expect(Routes.getWaterPathCost(1, 2)).toBe(Infinity);
  });

  it("permits the river mouth ↔ sea transition", () => {
    setupTwoRiverPack();
    expect(Routes.getWaterPathCost(2, 5)).toBeLessThan(Infinity);
    expect(Routes.getWaterPathCost(5, 2)).toBeLessThan(Infinity);
  });

  it("allows a coastal non-river land cell to exit to any adjacent water cell", () => {
    // cell 0 is a coastal port (land, no river); cells 1 and 2 are adjacent sea cells
    globalThis.pack.cells = {
      h: [25, 5, 5],
      r: [0, 0, 0],
      fl: [0, 0, 0],
      p: [
        [0, 0],
        [10, 0],
        [0, 10]
      ],
      t: [1, -1, -1],
      g: [0, 0, 0]
    } as any;
    globalThis.pack.rivers = [] as any;
    Routes.sync();

    expect(Routes.getWaterPathCost(0, 1)).toBeLessThan(Infinity);
    expect(Routes.getWaterPathCost(0, 2)).toBeLessThan(Infinity);
  });

  it("forces a coastal port to exit through its haven cell", () => {
    // cell 0 is a coastal port with two adjacent sea cells; its haven is cell 1.
    // The route must leave through the haven so it meets the burg shifted toward it.
    globalThis.pack.cells = {
      h: [25, 5, 5],
      r: [0, 0, 0],
      fl: [0, 0, 0],
      haven: [1, 0, 0], // cell 0's haven is cell 1
      p: [
        [0, 0],
        [10, 0],
        [0, 10]
      ],
      t: [1, -1, -1],
      g: [0, 0, 0]
    } as any;
    globalThis.pack.rivers = [] as any;
    Routes.sync();

    expect(Routes.getWaterPathCost(0, 1)).toBeLessThan(Infinity); // haven — allowed
    expect(Routes.getWaterPathCost(0, 2)).toBe(Infinity); // non-haven water — blocked
  });

  it("rejects exit from a river-mouth land cell into a non-mouth water cell", () => {
    // River 1 mouth at cell 2; recorded sea exit is cell 5.
    // Cell 6 is a sea cell also voronoi-adjacent to the mouth but not the recorded outlet.
    globalThis.pack.cells = {
      h: [25, 25, 25, 5, 5, 5, 5],
      r: [0, 1, 1, 0, 0, 0, 0],
      fl: [0, MIN_NAVIGABLE_FLUX, MIN_NAVIGABLE_FLUX + 50, 0, 0, 0, 0],
      p: [
        [0, 0],
        [10, 0],
        [20, 0],
        [25, 0],
        [25, 5],
        [25, -5],
        [30, 0]
      ],
      t: [1, 1, 1, -1, -1, -1, -2],
      g: [0, 0, 0, 0, 0, 0, 0]
    } as any;
    globalThis.pack.rivers = [{ i: 1, cells: [1, 2, 5] }] as any;
    Routes.sync();

    expect(Routes.getWaterPathCost(2, 5)).toBeLessThan(Infinity); // recorded outlet — allowed
    expect(Routes.getWaterPathCost(2, 6)).toBe(Infinity); // adjacent water but not the river's outlet
  });

  it("rejects land cells that are not on a river at all", () => {
    globalThis.pack.cells = {
      h: [20, 25, 25],
      r: [0, 0, 1],
      fl: [0, 0, MIN_NAVIGABLE_FLUX],
      p: [
        [0, 0],
        [10, 0],
        [20, 0]
      ],
      t: [1, 1, 1],
      g: [0, 0, 0]
    } as any;
    globalThis.pack.rivers = [{ i: 1, cells: [2] }] as any;
    Routes.sync();

    expect(Routes.getWaterPathCost(0, 1)).toBe(Infinity);
  });
});

describe("RoutesModule.addMeandering", () => {
  let Routes: any;
  let Rivers: any;

  beforeEach(async () => {
    globalThis.TIME = false;
    globalThis.window = globalThis.window || ({} as any);
    globalThis.graphWidth = 1000;
    globalThis.graphHeight = 1000;
    globalThis.pack = {
      cells: {
        h: [] as number[],
        r: [] as number[],
        fl: [] as number[],
        p: [] as [number, number][],
        t: [] as number[],
        g: [] as number[],
        burg: [] as number[]
      },
      burgs: [],
      rivers: [],
      routes: []
    } as any;
    globalThis.grid = { cells: { temp: [20, 20, 20, 20, 20, 20, 20, 20] } } as any;

    await import("./routes-generator");
    await import("./river-generator");
    Routes = (globalThis as any).Routes;
    Rivers = (globalThis as any).Rivers;
  });

  function setupRiverPack() {
    // 5 cells along a single river [1,2,3,4], cell 5 is sea (mouth water)
    globalThis.pack.cells = {
      h: [20, 25, 25, 25, 25, 5],
      r: [0, 1, 1, 1, 1, 0],
      fl: [0, 200, 200, 200, 200, 0],
      p: [
        [0, 0],
        [10, 0],
        [25, 0],
        [40, 0],
        [55, 0],
        [70, 0]
      ],
      t: [1, 1, 1, 1, 1, -1],
      g: [0, 0, 0, 0, 0, 0],
      burg: [0, 0, 0, 0, 0, 0]
    } as any;
    globalThis.pack.rivers = [{ i: 1, cells: [1, 2, 3, 4, 5] }] as any;
    Routes.sync();
  }

  it("emits an anchor for each input cell and interior meander points between river-edge anchors", () => {
    setupRiverPack();
    const routeCells = [1, 2, 3, 4];
    const anchors = routeCells.map(c => globalThis.pack.cells.p[c]);
    const result = Routes.addMeandering(routeCells, anchors);

    // Every input cell appears in the output, and interpolation produces extra points.
    const emittedCellIds = new Set(result.map((p: number[]) => p[2]));
    for (const c of routeCells) {
      expect(emittedCellIds.has(c)).toBe(true);
    }
    expect(result.length).toBeGreaterThan(routeCells.length);
  });

  it("emits one point per cell when there are no river edges (open sea)", () => {
    globalThis.pack.cells = {
      h: [5, 5, 5],
      r: [0, 0, 0],
      fl: [0, 0, 0],
      p: [
        [0, 0],
        [10, 0],
        [20, 0]
      ],
      t: [-1, -1, -1],
      g: [0, 0, 0],
      burg: [0, 0, 0]
    } as any;
    globalThis.pack.rivers = [] as any;
    Routes.sync();

    const routeCells = [0, 1, 2];
    const anchors = routeCells.map(c => globalThis.pack.cells.p[c]);
    const result = Routes.addMeandering(routeCells, anchors);

    expect(result.length).toBe(routeCells.length);
    expect(result.map((p: number[]) => p[2])).toEqual(routeCells);
  });

  it("matches anchor positions when route runs upstream (mouth→source)", () => {
    setupRiverPack();
    const downstreamCells = [1, 2, 3, 4];
    const upstreamCells = downstreamCells.slice().reverse();
    const downstreamAnchors = downstreamCells.map(c => globalThis.pack.cells.p[c]);
    const upstreamAnchors = upstreamCells.map(c => globalThis.pack.cells.p[c]);

    const down = Routes.addMeandering(downstreamCells, downstreamAnchors);
    const up = Routes.addMeandering(upstreamCells, upstreamAnchors);

    // The number of points produced is the same in both directions.
    expect(up.length).toBe(down.length);

    // Reversing the upstream output should give the same anchor coordinates as the downstream output
    const downAnchorXY = down.map((p: number[]) => [p[0], p[1]]);
    const upReversedXY = up
      .slice()
      .reverse()
      .map((p: number[]) => [p[0], p[1]]);
    expect(upReversedXY).toEqual(downAnchorXY);
  });

  it("splits the run at a confluence (each river meandered independently)", () => {
    // Two rivers joining at cell 3.
    // River 1: 1 → 2 → 3 (downstream). River 2: 5 → 4 → 3 (downstream).
    // Route walks tributary [5,4,3] then continues onto river 1 backwards [3,2,1] (upstream),
    // which exercises the confluence split.
    globalThis.pack.cells = {
      h: [20, 25, 25, 25, 25, 25],
      r: [0, 1, 1, 1, 2, 2],
      fl: [0, 200, 200, 300, 200, 200],
      p: [
        [0, 0],
        [10, 0],
        [25, 0],
        [40, 0],
        [40, 15],
        [40, 30]
      ],
      t: [1, 1, 1, 1, 1, 1],
      g: [0, 0, 0, 0, 0, 0],
      burg: [0, 0, 0, 0, 0, 0]
    } as any;
    globalThis.pack.rivers = [
      { i: 1, cells: [1, 2, 3] },
      { i: 2, cells: [5, 4, 3] }
    ] as any;
    Routes.sync();

    const routeCells = [5, 4, 3, 2, 1];
    const anchors = routeCells.map(c => globalThis.pack.cells.p[c]);
    const result = Routes.addMeandering(routeCells, anchors);

    // The cellId sequence should transition through the route order, with no spurious gaps.
    const cellIds = result.map((p: number[]) => p[2]);
    const transitions: number[] = [];
    for (let i = 0; i < cellIds.length; i++) {
      if (i === 0 || cellIds[i] !== cellIds[i - 1]) transitions.push(cellIds[i]);
    }
    expect(transitions).toEqual(routeCells);
  });

  it("anchors river-following cells at cell centers, ignoring shifted burg coords", () => {
    setupRiverPack();
    const routeCells = [1, 2, 3, 4];
    // Burg at cell 3 is shifted off its cell center; the route must still follow the river.
    const anchors: [number, number][] = [
      [10, 0],
      [25, 0],
      [40, 3], // burg shifted off cell center (cell 3 center is [40, 0])
      [55, 0]
    ];
    const result = Routes.addMeandering(routeCells, anchors);

    // The anchor for cell 3 must be the cell center [40, 0], not the burg coord [40, 3].
    const cell3Anchors = result.filter(
      (p: number[], idx: number, arr: number[][]) => p[2] === 3 && (idx === 0 || arr[idx - 1][2] !== 3)
    );
    expect(cell3Anchors.length).toBeGreaterThan(0);
    const cell3Anchor = cell3Anchors[0];
    expect(cell3Anchor[0]).toBe(40);
    expect(cell3Anchor[1]).toBe(0);
  });

  it("keeps a port cell on the river course — burg markers never move a river route", () => {
    setupRiverPack();
    // Ports at both an interior cell (3) and the terminal cell (4), each with a burg marker shifted
    // off the river. A river-following route ignores the markers entirely and stays on the course.
    globalThis.pack.cells.burg = [0, 0, 0, 7, 9, 0] as any;
    const routeCells = [1, 2, 3, 4];
    const anchors: [number, number][] = [
      [10, 0],
      [25, 0],
      [40, 9], // interior port marker — ignored
      [55, 8] // terminal port marker — ignored
    ];
    const result = Routes.addMeandering(routeCells, anchors);

    // Interior port (cell 3) stays at its river cell center [40, 0].
    const cell3Anchor = result.find(
      (p: number[], idx: number, arr: number[][]) => p[2] === 3 && (idx === 0 || arr[idx - 1][2] !== 3)
    );
    expect([cell3Anchor[0], cell3Anchor[1]]).toEqual([40, 0]);

    // Terminal port (cell 4) also stays at its river cell center [55, 0], not the marker [55, 8].
    const last = result[result.length - 1];
    expect(last[2]).toBe(4);
    expect([last[0], last[1]]).toEqual([55, 0]);
  });

  it("buildLinks does not create self-links from interior meander points", () => {
    setupRiverPack();
    const routeCells = [1, 2, 3, 4];
    const anchors = routeCells.map(c => globalThis.pack.cells.p[c]);
    const result = Routes.addMeandering(routeCells, anchors);

    const route = { i: 0, group: "searoutes", feature: 0, points: result };
    const links = Routes.buildLinks([route]);

    // No cell should link to itself
    for (const fromStr of Object.keys(links)) {
      const from = Number(fromStr);
      expect(links[from][from]).toBeUndefined();
    }
    // Adjacent cells in the route should be linked
    expect(links[1][2]).toBe(0);
    expect(links[2][3]).toBe(0);
    expect(links[3][4]).toBe(0);
  });

  it("produces geometry identical to the river polygon along the same cells", () => {
    setupRiverPack();
    const riverCells = [1, 2, 3, 4, 5];

    // River polygon geometry: cell centers, [x, y, flux]
    const polygon = Rivers.addMeandering(riverCells);

    // Route geometry along the same cells (downstream), anchored at cell centers internally
    const routeAnchors = riverCells.map(c => globalThis.pack.cells.p[c]);
    const route = Routes.addMeandering(riverCells, routeAnchors);

    // Same number of points, and every x/y coincides — the route overlays the river exactly.
    expect(route.length).toBe(polygon.length);
    for (let i = 0; i < polygon.length; i++) {
      expect(route[i][0]).toBeCloseTo(polygon[i][0], 6);
      expect(route[i][1]).toBeCloseTo(polygon[i][1], 6);
    }
  });

  it("a partial route run overlays the river polygon exactly, even where acute angles were relaxed", () => {
    // A sharp zig-zag river (cells 1..5 on land, 6 the sea mouth) so the meander relaxation flips
    // acute cusps. A route covering only the interior cells [2,3,4] must still trace the same
    // curve the polygon does over those cells — re-meandering its own slice would relax the run
    // boundaries differently and drift off the river.
    globalThis.pack.cells = {
      h: [20, 25, 25, 25, 25, 25, 5],
      r: [0, 1, 1, 1, 1, 1, 0],
      fl: [0, 200, 200, 200, 200, 200, 0],
      p: [
        [0, 0],
        [0, 0],
        [15, 16],
        [30, 0],
        [45, 16],
        [60, 0],
        [75, 5]
      ],
      t: [1, 1, 1, 1, 1, 1, -1],
      g: [0, 0, 0, 0, 0, 0, 0],
      burg: [0, 0, 0, 0, 0, 0, 0]
    } as any;
    globalThis.pack.rivers = [{ i: 1, cells: [1, 2, 3, 4, 5, 6] }] as any;
    Routes.sync();

    const polygon = Rivers.addMeandering([1, 2, 3, 4, 5, 6]);

    // Anchors are never moved by relaxation, so each cell center appears verbatim in the polygon.
    const anchorIndexOf = (cell: number) => {
      const [cx, cy] = globalThis.pack.cells.p[cell];
      return polygon.findIndex((point: number[]) => point[0] === cx && point[1] === cy);
    };
    const from = anchorIndexOf(2);
    const to = anchorIndexOf(4);
    const polygonSlice = polygon.slice(from, to + 1);

    const runCells = [2, 3, 4];
    const route = Routes.addMeandering(
      runCells,
      runCells.map(c => globalThis.pack.cells.p[c])
    );

    expect(route.length).toBe(polygonSlice.length);
    for (let i = 0; i < polygonSlice.length; i++) {
      expect(route[i][0]).toBeCloseTo(polygonSlice[i][0], 6);
      expect(route[i][1]).toBeCloseTo(polygonSlice[i][1], 6);
    }
  });
});
