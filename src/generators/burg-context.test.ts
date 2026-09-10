import { describe, expect, it } from "vitest";
import {
  type Approach,
  collectWindow,
  compassBearing,
  effectiveWindowRadiusKm,
  elevationMetres,
  hashSeedToInt,
  kmToWorldUnits,
  LARGE_HARBOUR_MIN_POPULATION,
  MAX_TOP_GOODS,
  MIN_WINDOW_RINGS,
  orderRouteCellsOutward,
  type RouteGroup,
  readApproaches,
  readClimate,
  readCorridor,
  readEconomy,
  readHydrology,
  readTerrain,
  scaledPopulation
} from "./burg-context";

describe("compassBearing", () => {
  // SVG coordinates: y grows DOWNWARD, so north is negative dy
  it("maps the four cardinals with the y-down sign convention", () => {
    expect(compassBearing(0, -1)).toBe(0); // north
    expect(compassBearing(1, 0)).toBe(90); // east
    expect(compassBearing(0, 1)).toBe(180); // south
    expect(compassBearing(-1, 0)).toBe(270); // west
  });

  it("returns a value in [0, 360)", () => {
    expect(compassBearing(-1, -1)).toBeCloseTo(315, 6);
    expect(compassBearing(0, 0)).toBe(0); // degenerate: no displacement
  });
});

describe("elevationMetres", () => {
  it("uses the land formula above sea level", () => {
    expect(elevationMetres(20, 2)).toBe(4); // (20-18)^2
    expect(elevationMetres(30, 2)).toBe(144); // (30-18)^2
  });

  it("uses the depth formula below sea level", () => {
    expect(elevationMetres(10, 2)).toBe(-50); // ((10-20)/10)*50
  });

  it("returns the deep-water sentinel at or below zero height", () => {
    expect(elevationMetres(0, 2)).toBe(-990);
  });
});

describe("kmToWorldUnits", () => {
  it("divides by the km-per-world-unit scale", () => {
    expect(kmToWorldUnits(12, 3)).toBe(4);
  });

  it("falls back to a scale of 1 when distanceScale is zero or missing", () => {
    expect(kmToWorldUnits(12, 0)).toBe(12);
  });
});

describe("hashSeedToInt", () => {
  it("is deterministic", () => {
    expect(hashSeedToInt("1234560007")).toBe(hashSeedToInt("1234560007"));
  });

  it("separates burgs on the same map and the same burg across maps", () => {
    expect(hashSeedToInt("1234560007")).not.toBe(hashSeedToInt("1234560008"));
    expect(hashSeedToInt("1234560007")).not.toBe(hashSeedToInt("9999990007"));
  });

  it("returns a non-negative 32-bit integer", () => {
    const h = hashSeedToInt("anything");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("scaledPopulation", () => {
  it("applies the same population scaling the watabou builders use", () => {
    expect(scaledPopulation(10, 1000, 0.5)).toBe(5000);
  });

  it("rounds to a whole number of people", () => {
    expect(scaledPopulation(0.0031, 1000, 0.5)).toBe(2);
  });
});

describe("collectWindow", () => {
  // A straight chain of 5 cells spaced 1 world unit apart on the x axis:
  // 0 -- 1 -- 2 -- 3 -- 4
  const cellsC = [[1], [0, 2], [1, 3], [2, 4], [3]];
  const cellsP = [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0]
  ] as [number, number][];

  it("includes the centre and every cell inside the radius", () => {
    // radiusKm 2 at distanceScale 1 => 2 world units => cells 0,1,2,3 from centre 2... within 2 of x=2
    const w = collectWindow(2, cellsC, cellsP, 2, 1);
    expect(w.center).toBe(2);
    expect([...w.cellIds].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
    expect(w.radiusKm).toBe(2);
  });

  it("excludes cells beyond the radius", () => {
    const w = collectWindow(0, cellsC, cellsP, 2, 1);
    expect([...w.cellIds].sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it("converts km to world units via distanceScale", () => {
    // radiusKm 6 at distanceScale 3 => 2 world units, same as above
    const w = collectWindow(0, cellsC, cellsP, 6, 3);
    expect([...w.cellIds].sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it("returns just the centre for an isolated cell", () => {
    const w = collectWindow(0, [[]], [[0, 0]] as [number, number][], 5, 1);
    expect(w.cellIds).toEqual([0]);
  });

  it("does not revisit cells in a cyclic graph", () => {
    const ringC = [
      [1, 2],
      [0, 2],
      [0, 1]
    ];
    const ringP = [
      [0, 0],
      [1, 0],
      [0, 1]
    ] as [number, number][];
    const w = collectWindow(0, ringC, ringP, 5, 1);
    expect(w.cellIds).toHaveLength(3);
  });
});

describe("effectiveWindowRadiusKm", () => {
  it("keeps the metric radius when it already spans several grid rings", () => {
    // spacing 1 world unit at scale 1 => floor of 2km, well under the 12km intent
    expect(effectiveWindowRadiusKm(12, 1, 1)).toBe(12);
  });

  it("floors the radius at MIN_WINDOW_RINGS of grid spacing", () => {
    // default settings: distanceScale 3, spacing ~10 units => floor of 60km beats 12km
    expect(effectiveWindowRadiusKm(12, 3, 10)).toBe(MIN_WINDOW_RINGS * 10 * 3);
  });

  it("keeps the window non-degenerate when spacing exceeds the metric radius", () => {
    // 12km at distanceScale 3 is 4 world units — less than the 10-unit cell spacing, so
    // the raw radius would return the burg's own cell alone.
    const cellsC = [[1], [0, 2], [1]];
    const cellsP = [
      [0, 0],
      [10, 0],
      [20, 0]
    ] as [number, number][];
    expect(collectWindow(0, cellsC, cellsP, 12, 3).cellIds).toEqual([0]);

    const floored = collectWindow(0, cellsC, cellsP, effectiveWindowRadiusKm(12, 3, 10), 3);
    expect(floored.cellIds.length).toBeGreaterThan(1);
  });
});

describe("readApproaches", () => {
  //        7 (north)
  //        |
  //  4 --- 5 --- 6      (5 is the burg cell)
  const cellsP = [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [-1, 0], // 4, west of 5
    [0, 0], // 5, the burg
    [1, 0], // 6, east of 5
    [0, -1] // 7, north of 5
  ] as [number, number][];

  const routeById = new Map<number, { group: RouteGroup; type?: string; name?: string }>([
    [1, { group: "roads", type: "highway", name: "Kings Road" }],
    [2, { group: "trails", type: "trail" }]
  ]);

  it("emits one approach per connected neighbour, sorted by bearing", () => {
    const cellsRoutes = { 5: { 4: 1, 6: 1, 7: 2 } };
    const approaches = readApproaches(5, cellsRoutes, cellsP, routeById);
    expect(approaches.map(a => a.bearingDeg)).toEqual([0, 90, 270]);
    expect(approaches.map(a => a.routeId)).toEqual([2, 1, 1]);
  });

  it("marks a route reaching the cell from two sides as through, and a single-sided one as terminating", () => {
    const cellsRoutes = { 5: { 4: 1, 6: 1, 7: 2 } };
    const approaches = readApproaches(5, cellsRoutes, cellsP, routeById);
    const road = approaches.filter(a => a.routeId === 1);
    expect(road).toHaveLength(2);
    expect(road.every(a => a.through)).toBe(true);
    const trail = approaches.find(a => a.routeId === 2)!;
    expect(trail.through).toBe(false);
  });

  it("carries group, type and name through from the route", () => {
    const approaches = readApproaches(5, { 5: { 6: 1 } }, cellsP, routeById);
    expect(approaches[0]).toMatchObject({ group: "roads", type: "highway", name: "Kings Road" });
  });

  it("measures the two sides from edited route points rather than cell centres", () => {
    const routes = new Map([
      [
        1,
        {
          group: "roads",
          type: "royal",
          points: [
            [-2, 1, 4],
            [0.5, 0.5, 5],
            [1, -2, 6]
          ]
        }
      ]
    ]);
    const approaches = readApproaches(5, { 5: { 4: 1, 6: 1 } }, cellsP, routes);
    expect(approaches).toHaveLength(2);
    expect(approaches.map(a => a.bearingDeg)).toEqual([compassBearing(0.5, -2.5), compassBearing(-2.5, 0.5)]);
    expect(approaches.map(a => a.neighbourCell)).toEqual([6, 4]);
    expect(approaches.every(a => a.through && a.routeId === 1)).toBe(true);
  });

  it("returns an empty array for a burg with no routes — never undefined", () => {
    expect(readApproaches(5, {}, cellsP, routeById)).toEqual([]);
    expect(readApproaches(5, { 5: {} }, cellsP, routeById)).toEqual([]);
  });

  it("skips connections whose route is missing from the index", () => {
    expect(readApproaches(5, { 5: { 6: 99 } }, cellsP, routeById)).toEqual([]);
  });
});

describe("readHydrology", () => {
  const cellsP = [
    [0, 0], // 0, the burg
    [0, -1], // 1, haven to the north
    [5, 5] // 2, elsewhere
  ] as [number, number][];

  const base = {
    window: { center: 0, cellIds: [0, 1, 2], radiusKm: 12 },
    cellsHaven: [1, 0, 0],
    cellsHarbor: [1, 0, 0],
    cellsF: [1, 2, 3],
    cellsP,
    cellsR: [0, 9, 0],
    featureTypeById: (id: number) => ({ 1: "island", 2: "ocean", 3: "lake" })[id],
    featureNameById: (id: number) => ({ 1: "Mainland", 2: "The Deep", 3: "Still Water" })[id],
    riverById: (id: number) =>
      id === 9 ? { name: "Greenwater", type: "River", discharge: 120, width: 0.4, cells: [1, 5] } : undefined,
    approaches: [] as Approach[],
    isPort: true,
    population: 100
  };

  it("bearings toward the haven cell in compass degrees", () => {
    expect(readHydrology(base).oceanBearingDeg).toBe(0); // haven is due north
  });

  it("omits ocean bearing and harbour size for a landlocked burg", () => {
    const h = readHydrology({ ...base, isPort: false, cellsHaven: [0, 0, 0], cellsHarbor: [0, 0, 0] });
    expect("oceanBearingDeg" in h).toBe(false);
    expect("harbourSize" in h).toBe(false);
    expect(h.coastal).toBe(false);
  });

  it("calls a harbour large only with a sea/trade route AND enough population", () => {
    const seaRoute: Approach[] = [{ routeId: 1, group: "searoutes", bearingDeg: 90, through: false }];
    expect(readHydrology({ ...base, approaches: seaRoute, population: LARGE_HARBOUR_MIN_POPULATION }).harbourSize).toBe(
      "large"
    );
    // route but too small
    expect(readHydrology({ ...base, approaches: seaRoute, population: 100 }).harbourSize).toBe("small");
    // big but no sea route
    expect(readHydrology({ ...base, population: 100000 }).harbourSize).toBe("small");
    // traderoutes with sufficient population also yields large
    const tradeRoute: Approach[] = [{ routeId: 2, group: "traderoutes", bearingDeg: 180, through: false }];
    expect(
      readHydrology({ ...base, approaches: tradeRoute, population: LARGE_HARBOUR_MIN_POPULATION }).harbourSize
    ).toBe("large");
  });

  it("detects a lake in the window", () => {
    expect(readHydrology(base).lakeside).toBe(true);
    expect(readHydrology({ ...base, cellsF: [1, 2, 2] }).lakeside).toBe(false);
  });

  it("treats a harbor cell as coastal even without the port flag", () => {
    expect(readHydrology({ ...base, isPort: false }).coastal).toBe(true);
  });
});

describe("readTerrain", () => {
  it("reports the burg cell's own elevation in metres", () => {
    const t = readTerrain({
      window: { center: 1, cellIds: [0, 1, 2], radiusKm: 12 },
      cellsH: [20, 30, 40],
      cellsP: [
        [0, 0],
        [1, 0],
        [2, 0]
      ],
      heightExponent: 2,
      distanceScale: 1,
      coastal: false
    });
    expect(t.elevationM).toBe(144); // (30-18)^2
  });
});

describe("readTerrain statistics", () => {
  const cellsP = [
    [0, 0],
    [1, 0],
    [2, 0]
  ] as [number, number][];
  const base = {
    window: { center: 1, cellIds: [0, 1, 2], radiusKm: 12 },
    cellsP,
    heightExponent: 2,
    distanceScale: 1,
    coastal: false
  };

  it("reports the window's elevation span and relief", () => {
    const t = readTerrain({ ...base, cellsH: [20, 30, 40] });
    expect(t.windowMinM).toBe(4); // (20-18)^2
    expect(t.windowMaxM).toBe(484); // (40-18)^2
    expect(t.reliefM).toBe(480);
  });

  it("calls a coastal burg coast regardless of relief", () => {
    expect(readTerrain({ ...base, cellsH: [20, 30, 40], coastal: true }).setting).toBe("coast");
  });

  it("calls a very high burg mountain", () => {
    expect(readTerrain({ ...base, cellsH: [70, 75, 80] }).setting).toBe("mountain");
  });

  it("calls a low burg among high ground a valley", () => {
    expect(readTerrain({ ...base, cellsH: [60, 22, 60] }).setting).toBe("valley");
  });

  it("calls a high but level inland burg a plateau", () => {
    // metres [900, 1024, 1156]: above the plateau floor, relief 256m below the hills threshold
    expect(readTerrain({ ...base, cellsH: [48, 50, 52] }).setting).toBe("plateau");
  });

  it("calls a flat low burg a plain", () => {
    expect(readTerrain({ ...base, cellsH: [21, 21, 21] }).setting).toBe("plain");
  });

  it("reports a mean gradient of zero on level ground", () => {
    expect(readTerrain({ ...base, cellsH: [21, 21, 21] }).meanGradient).toBe(0);
  });

  // Pins the unit conversion (world units -> km via distanceScale -> m): a
  // dropped `* 1000` or a dropped `distanceScale` factor would still pass the
  // flat-ground (0) case above, so this fixture must produce a nonzero value.
  // center (cell 1) elevationM = (30-18)^2 = 144
  // cell 0: elevationM = (20-18)^2 = 4, run = hypot(0-1,0-0) * 1 * 1000 = 1000m, gradient = |4-144|/1000 = 0.14
  // cell 2: elevationM = (40-18)^2 = 484, run = hypot(2-1,0-0) * 1 * 1000 = 1000m, gradient = |484-144|/1000 = 0.34
  // mean = (0.14 + 0.34) / 2 = 0.24
  it("reports a nonzero mean gradient computed from the unit conversion", () => {
    const t = readTerrain({ ...base, cellsH: [20, 30, 40] });
    expect(t.meanGradient).toBeCloseTo(0.24);
  });
});

describe("readClimate", () => {
  const base = {
    window: { center: 1, cellIds: [0, 1, 2], radiusKm: 12 },
    cellsG: [0, 7, 3], // burg cell 1 maps to grid cell 7
    cellsBiome: [1, 5, 5],
    gridTemp: [0, 0, 0, 0, 0, 0, 0, 14],
    biomeNameById: (id: number) => ({ 1: "Hot desert", 5: "Temperate deciduous forest" })[id]
  };

  it("reads temperature through the cell's grid index", () => {
    expect(readClimate(base).temperatureC).toBe(14);
  });

  it("names the burg cell's biome", () => {
    expect(readClimate(base).biome).toBe("Temperate deciduous forest");
  });

  it("falls back to an empty biome name when the id is unknown", () => {
    expect(readClimate({ ...base, biomeNameById: () => undefined }).biome).toBe("");
  });
});

describe("readClimate biome mix", () => {
  const base = {
    window: { center: 0, cellIds: [0, 1, 2, 3], radiusKm: 12 },
    cellsG: [0, 1, 2, 3],
    cellsBiome: [5, 5, 5, 6],
    gridTemp: [14, 14, 14, 14],
    biomeNameById: (id: number) => ({ 5: "Grassland", 6: "Taiga" })[id]
  };

  it("reports window composition sorted by descending share", () => {
    const mix = readClimate(base).biomeMix;
    expect(mix).toEqual([
      { name: "Grassland", share: 0.75 },
      { name: "Taiga", share: 0.25 }
    ]);
  });

  it("produces shares summing to 1", () => {
    const total = readClimate(base).biomeMix.reduce((sum, entry) => sum + entry.share, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("returns a single entry when the window is uniform", () => {
    expect(readClimate({ ...base, cellsBiome: [5, 5, 5, 5] }).biomeMix).toEqual([{ name: "Grassland", share: 1 }]);
  });

  it("skips unnamed biomes and normalises over the named total, so shares still sum to 1", () => {
    // base window is 4 cells: three of biome 5, one of biome 6. Naming only 5 leaves
    // three named cells, and the share is 3/3 — NOT 3/4. The denominator is the named
    // total, so biomeMix is always a distribution.
    const named = { ...base, biomeNameById: (id: number) => (id === 5 ? "Grassland" : undefined) };
    const mix = readClimate(named).biomeMix;
    expect(mix).toEqual([{ name: "Grassland", share: 1 }]);
    expect(mix.reduce((sum, entry) => sum + entry.share, 0)).toBeCloseTo(1, 6);
  });
});

describe("readCorridor", () => {
  // A straight run of 4 cells, 1 world unit apart, distanceScale 1 => 1km per step
  const cellsP = [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0]
  ] as [number, number][];

  const base = {
    routeCells: [0, 1, 2, 3],
    cellsP,
    cellsR: [0, 0, 0, 0],
    cellsG: [0, 1, 2, 3],
    cellsBiome: [5, 5, 6, 6],
    gridTemp: [10, 8, 4, -3],
    biomeNameById: (id: number) => ({ 5: "Grassland", 6: "Taiga" })[id],
    heightExponent: 2,
    distanceScale: 1
  };

  it("measures the sampled distance along the route", () => {
    expect(readCorridor({ ...base, cellsH: [20, 20, 20, 20] }).sampledKm).toBe(3);
  });

  it("reports a climbing corridor as an ascent with a positive delta", () => {
    const c = readCorridor({ ...base, cellsH: [20, 30, 40, 50] });
    expect(c.elevationDeltaM).toBeGreaterThan(0);
    expect(c.relief).toBe("ascent");
  });

  it("reports a corridor descending from mountains toward the burg as a descent", () => {
    const c = readCorridor({ ...base, cellsH: [50, 40, 30, 20] });
    expect(c.elevationDeltaM).toBeLessThan(0);
    expect(c.relief).toBe("descent");
  });

  it("recognises a valley: both ends above the middle", () => {
    expect(readCorridor({ ...base, cellsH: [45, 25, 25, 45] }).relief).toBe("valley");
  });

  it("recognises a ridge: both ends below the middle", () => {
    expect(readCorridor({ ...base, cellsH: [22, 48, 48, 22] }).relief).toBe("ridge");
  });

  it("classifies a valley even when the overall delta would read as an ascent", () => {
    // metres: [729, 49, 49, 1764]; elevationDeltaM = +1035 (well over tolerance) yet both
    // ends sit far above the middle, so valley must be checked before ascent/descent.
    const c = readCorridor({ ...base, cellsH: [45, 25, 25, 60] });
    expect(c.elevationDeltaM).toBeGreaterThan(0);
    expect(c.relief).toBe("valley");
  });

  it("classifies a ridge even when the overall delta would read as an ascent", () => {
    // metres: [16, 900, 900, 484]; elevationDeltaM = +468 (well over tolerance) yet the
    // middle sits far above both ends, so ridge must be checked before ascent/descent.
    const c = readCorridor({ ...base, cellsH: [22, 48, 48, 40] });
    expect(c.elevationDeltaM).toBeGreaterThan(0);
    expect(c.relief).toBe("ridge");
  });

  it("calls a level corridor flat", () => {
    expect(readCorridor({ ...base, cellsH: [30, 30, 30, 30] }).relief).toBe("flat");
  });

  it("flags a corridor following a river and names the river", () => {
    const c = readCorridor({ ...base, cellsH: [30, 30, 30, 30], cellsR: [0, 4, 4, 4] });
    expect(c.followsRiver).toBe(true);
    expect(c.riverId).toBe(4);
  });

  it("does not flag a river touched by a single cell", () => {
    const c = readCorridor({ ...base, cellsH: [30, 30, 30, 30], cellsR: [0, 4, 0, 0] });
    expect(c.followsRiver).toBe(false);
  });

  it("lists distinct biomes in the order encountered and the coldest temperature", () => {
    const c = readCorridor({ ...base, cellsH: [30, 30, 30, 30] });
    expect(c.biomes).toEqual(["Grassland", "Taiga"]);
    expect(c.minTempC).toBe(-3); // drives "icy pass"
  });

  it("degrades safely on a one-cell corridor", () => {
    const c = readCorridor({ ...base, routeCells: [0], cellsH: [30, 30, 30, 30] });
    expect(c.sampledKm).toBe(0);
    expect(c.elevationDeltaM).toBe(0);
    expect(c.maxGradient).toBe(0);
    expect(c.relief).toBe("flat");
  });
});

describe("orderRouteCellsOutward", () => {
  it("returns the tail after the burg when the burg is at the start", () => {
    expect(orderRouteCellsOutward([5, 6, 7, 8], 5)).toEqual([5, 6, 7, 8]);
  });

  it("reverses so the walk always leads away from the burg", () => {
    expect(orderRouteCellsOutward([8, 7, 6, 5], 5)).toEqual([5, 6, 7, 8]);
  });

  it("splits a through-route at the burg and returns the longer arm", () => {
    // burg at index 2; arms are [5,1,0] backwards and [5,9] forwards
    expect(orderRouteCellsOutward([0, 1, 5, 9], 5)).toEqual([5, 1, 0]);
  });

  it("samples each approach's own side even when the opposite arm is longer", () => {
    expect(orderRouteCellsOutward([0, 1, 5, 9], 5, 1)).toEqual([5, 1, 0]);
    expect(orderRouteCellsOutward([0, 1, 5, 9], 5, 9)).toEqual([5, 9]);
    expect(orderRouteCellsOutward([0, 1, 5, 9], 5, 7)).toEqual([5, 7]);
  });

  it("returns just the burg cell when the route does not contain it", () => {
    expect(orderRouteCellsOutward([1, 2, 3], 5)).toEqual([5]);
  });
});

describe("readHydrology rivers and water features", () => {
  const cellsP = [
    [0, 0], // 0, the burg
    [0, -1], // 1, north
    [1, 0] // 2, east
  ] as [number, number][];

  const input = {
    window: { center: 0, cellIds: [0, 1, 2], radiusKm: 12 },
    cellsHaven: [0, 0, 0],
    cellsHarbor: [0, 0, 0],
    cellsF: [1, 2, 3],
    cellsP,
    cellsR: [0, 9, 0],
    featureTypeById: (id: number) => ({ 1: "island", 2: "ocean", 3: "lake" })[id],
    featureNameById: (id: number) => ({ 1: "Mainland", 2: "The Deep", 3: "Still Water" })[id],
    riverById: (id: number) =>
      id === 9 ? { name: "Greenwater", type: "River", discharge: 120, width: 0.4, cells: [1, 5] } : undefined,
    approaches: [] as Approach[],
    isPort: false,
    population: 100
  };

  it("lists rivers in the window with bearing, discharge and width", () => {
    const [river] = readHydrology(input).rivers;
    expect(river).toMatchObject({ id: 9, name: "Greenwater", type: "River", dischargeM3s: 120, widthKm: 0.4 });
    expect(river.bearingDeg).toBe(0); // the river cell is due north
  });

  it("marks a river running through the burg cell", () => {
    expect(readHydrology(input).rivers[0].throughBurg).toBe(false);
    const through = readHydrology({ ...input, cellsR: [9, 9, 0] });
    expect(through.rivers[0].throughBurg).toBe(true);
  });

  it("lists distinct water features touching the window, excluding land", () => {
    const water = readHydrology(input).waterFeatures;
    expect(water).toEqual([
      { featureId: 2, type: "ocean", name: "The Deep" },
      { featureId: 3, type: "lake", name: "Still Water" }
    ]);
  });

  it("omits the bearing when the river runs through the burg's own cell", () => {
    // the nearest river cell IS the burg, so the vector is (0,0) — no direction to report
    const [river] = readHydrology({ ...input, cellsR: [9, 9, 0] }).rivers;
    expect("bearingDeg" in river).toBe(false);
    expect(river.throughBurg).toBe(true);
  });

  it("reports one entry per water feature even when several window cells share it", () => {
    const shared = readHydrology({ ...input, cellsF: [1, 2, 2] }).waterFeatures;
    expect(shared).toEqual([{ featureId: 2, type: "ocean", name: "The Deep" }]);
  });

  it("returns empty arrays for a burg with no water nearby", () => {
    const dry = readHydrology({ ...input, cellsR: [0, 0, 0], cellsF: [1, 1, 1] });
    expect(dry.rivers).toEqual([]);
    expect(dry.waterFeatures).toEqual([]);
  });
});

describe("readEconomy", () => {
  const base = {
    burgId: 7,
    tradeRole: "hub" as const,
    treasury: 900,
    marketId: 2,
    marketById: (id: number) => (id === 2 ? { name: "Salt Exchange", centerBurgId: 7 } : undefined),
    producedGoods: [
      { goodId: 1, units: 5 },
      { goodId: 2, units: 30 },
      { goodId: 3, units: 12 }
    ],
    goodNameById: (id: number) => ({ 1: "Wool", 2: "Salt", 3: "Fish" })[id]
  };

  it("sums units per good, so a burg that both gathers and manufactures one good lists it once", () => {
    const economy = readEconomy({
      ...base,
      producedGoods: [
        { goodId: 2, units: 30 }, // gathered
        { goodId: 2, units: 12 }, // manufactured
        { goodId: 1, units: 5 }
      ]
    });
    expect(economy.topGoods).toEqual([
      { id: 2, name: "Salt", units: 42 },
      { id: 1, name: "Wool", units: 5 }
    ]);
  });

  it("ranks goods by units and caps the list", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ goodId: i + 1, units: i + 1 }));
    const economy = readEconomy({
      ...base,
      producedGoods: many,
      goodNameById: (id: number) => `Good ${id}`
    });
    expect(economy.topGoods).toHaveLength(MAX_TOP_GOODS);
    expect(economy.topGoods[0]).toEqual({ id: 12, name: "Good 12", units: 12 });
  });

  it("names the burg's market and flags it as the centre", () => {
    const economy = readEconomy(base);
    expect(economy.marketName).toBe("Salt Exchange");
    expect(economy.isMarketCentre).toBe(true);
    expect(readEconomy({ ...base, burgId: 8 }).isMarketCentre).toBe(false);
  });

  it("bands the treasury rather than exposing the raw figure", () => {
    expect(readEconomy({ ...base, treasury: -10 }).treasuryBand).toBe("poor");
    expect(readEconomy({ ...base, treasury: 100 }).treasuryBand).toBe("modest");
    expect(readEconomy({ ...base, treasury: 900 }).treasuryBand).toBe("prosperous");
    expect(readEconomy({ ...base, treasury: 99999 }).treasuryBand).toBe("rich");
    expect(readEconomy({ ...base, treasury: undefined }).treasuryBand).toBe("modest");
  });

  it("degrades safely when the economy sim has not run", () => {
    const economy = readEconomy({
      ...base,
      tradeRole: undefined,
      marketId: undefined,
      producedGoods: [],
      treasury: undefined
    });
    expect(economy.topGoods).toEqual([]);
    expect(economy.marketId).toBeUndefined();
    expect(economy.marketName).toBeUndefined();
    expect(economy.isMarketCentre).toBe(false);
    expect(economy.tradeRole).toBeUndefined();
  });

  it("skips goods with no name", () => {
    const economy = readEconomy({ ...base, goodNameById: (id: number) => (id === 2 ? "Salt" : undefined) });
    expect(economy.topGoods).toEqual([{ id: 2, name: "Salt", units: 30 }]);
  });
});
