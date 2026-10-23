// Map restoration on real generated maps: Risk heightmap edits, Submap and Transform. See docs/prd/map-restoration-tests.md
import { afterEach, describe, expect, it, vi } from "vitest";
import { Production } from "@/model/economy/production-generator";
import { Features } from "@/model/physical/features-generator";
import { Rivers } from "@/model/physical/river-generator";
import type { IntegrityRule } from "./map-integrity";
import { circle, generateMap, living, newViolations, riskEdit, violations } from "./real-map.testing";

const { MapRestoration } = await import("./map-restoration");
const { Resample } = await import("./resample");

/** the data a restore must keep, by cell where it lives on cells */
function fingerprint() {
  const { cells } = pack;
  const at = (cell: number) => cells.p[cell].join();
  const byCell = (values: ArrayLike<number>) => Array.from(cells.i, cell => `${at(cell)}:${values[cell]}`).sort();
  return {
    cells: Object.fromEntries(
      (
        [
          "h",
          "biome",
          "culture",
          "state",
          "province",
          "religion",
          "pop",
          "s",
          "good",
          "r",
          "fl",
          "conf",
          "burg"
        ] as const
      ).map(key => [key, byCell(cells[key])])
    ),
    burgs: pack.burgs.map(burg => burg.i && [at(burg.cell), burg.name, burg.state, burg.port, burg.treasury]),
    states: pack.states.map(state => [state.name, state.capital, state.i && at(state.center)]),
    provinces: pack.provinces.map(province => province.i && [province.burg, at(province.center)]),
    cultures: pack.cultures.map(culture => culture.i && at(culture.center!)),
    religions: pack.religions.map(religion => religion.i && at(religion.center)),
    routes: pack.routes.map(route => [route.name, route.points.map(([, , cell]) => at(cell))]),
    rivers: pack.rivers.map(river => [river.i, river.name, river.cells.map(cell => (cell < 0 ? cell : at(cell)))]),
    features: pack.features.map(feature => feature && [feature.type, feature.name, feature.cells]),
    markers: pack.markers.map(marker => at(marker.cell)),
    zones: pack.zones.map(zone => zone.cells.map(at).sort()),
    journeys: pack.journeys.map(journey =>
      journey.segments.map(segment => segment.points.map(([, , cell]) => at(cell)))
    ),
    markets: pack.markets.map(market => market.centerBurgId)
  };
}

/** what must not disappear when no land under it is lost */
const counts = () => ({
  burgs: living(pack.burgs).length,
  states: living(pack.states).length,
  routes: pack.routes.length,
  markers: pack.markers.length,
  zones: pack.zones.length,
  journeys: pack.journeys.reduce((sum, journey) => sum + journey.segments.length, 0)
});

const largestCapital = () => {
  const state = living(pack.states).sort((a, b) => (b.cells ?? 0) - (a.cells ?? 0))[0];
  return pack.burgs[state.capital];
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Risk heightmap edit", () => {
  it("that changes no height keeps the map as it was", async () => {
    await generateMap({ seed: "restoration-identity" });
    const [before, sound] = [fingerprint(), violations()];

    riskEdit(() => {}, false);

    expect(fingerprint()).toEqual(before);
    expect(newViolations(sound)).toEqual([]);
  });

  const edits: [string, (heights: Uint8Array) => void][] = [
    ["sinks an inland patch", circle(0.5, 0.5, 80, 8, "land")],
    ["raises a sea corner", circle(0.08, 0.1, 120, 30, "water")],
    [
      "sinks most of the land",
      heights => {
        for (let cell = 0; cell < heights.length; cell++) if (heights[cell] >= 20 && cell % 10 < 7) heights[cell] = 5;
      }
    ],
    [
      "sinks the land around a capital",
      heights => {
        const { x, y } = largestCapital();
        const { width, height } = options.map.graph;
        circle(x / width, y / height, 60, 5, "land")(heights);
      }
    ]
  ];

  for (const erosion of [true, false]) {
    for (const [name, edit] of edits) {
      it(`${name}, ${erosion ? "with" : "without"} water erosion, without breaking the map`, async () => {
        await generateMap({ seed: `restoration-${name}` });
        const before = violations();
        const kept = counts();

        riskEdit(edit, erosion);

        expect(newViolations(before)).toEqual([]);
        expect(counts()).toEqual(kept); // land under burgs is never sunk, so nothing goes
      });
    }
  }

  it("keeps route and journey paths continuous where the coast changed", async () => {
    await generateMap({ seed: "restoration-sinks an inland patch" });
    const before = violations();
    const continuity = (rule: IntegrityRule) => rule === "route-steps" || rule === "journey-steps";

    riskEdit(circle(0.5, 0.5, 80, 8, "land"), false);

    expect(newViolations(before).filter(({ rule }) => continuity(rule))).toEqual([]);
  });

  it("without water erosion, ends rivers where their land went under the sea", async () => {
    await generateMap({ seed: "restoration-sinks an inland patch" });
    const before = violations();

    riskEdit(circle(0.5, 0.5, 90, 8, "land"), false);

    expect(violations().has("river-sea")).toBe(false);
    expect(newViolations(before)).toEqual([]);
  });

  it("without water erosion, keeps the carved heights of untouched land and the drawn heights of edited land", async () => {
    await generateMap({ seed: "restoration-heights" });
    const at = (cell: number) => pack.cells.p[cell].join();
    const eroded = new Map(Array.from(pack.cells.i, cell => [at(cell), pack.cells.h[cell]]));
    const previous = grid.cells.h.slice();
    expect(Array.from(pack.cells.i).some(cell => pack.cells.h[cell] !== previous[pack.cells.g[cell]])).toBe(true);

    riskEdit(circle(0.5, 0.5, 80, 8, "land"), false);

    const { h, g } = pack.cells;
    const [edited, untouched] = [[], []] as [number[], number[]];
    for (const cell of pack.cells.i) (grid.cells.h[g[cell]] === previous[g[cell]] ? untouched : edited).push(cell);
    expect(edited.length).toBeGreaterThan(0);
    for (const cell of edited) expect(h[cell]).toBe(grid.cells.h[g[cell]]);
    for (const cell of untouched) if (eroded.has(at(cell))) expect(h[cell]).toBe(eroded.get(at(cell)));
  });

  it("keeps the map sound through chained edits", async () => {
    await generateMap({ seed: "restoration-chained" });
    const before = violations();

    riskEdit(circle(0.3, 0.6, 70, 8, "land"), false);
    riskEdit(circle(0.7, 0.3, 90, 35, "water"), true);
    riskEdit(circle(0.5, 0.5, 50, 6, "land"), false);

    expect(newViolations(before)).toEqual([]);
  });

  it("keeps a locked river's course and data when rivers are generated again", async () => {
    await generateMap({ seed: "restoration-locked-river" });
    const river = pack.rivers.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
    Rivers.setLocked(river.i, true);
    const points = Rivers.getRiverPoints(river.cells, river.points ?? null).map(([x, y]) =>
      [x, y].map(v => +v.toFixed(2))
    );

    riskEdit(circle(0.9, 0.9, 40, 30, "water"), true);

    const kept = pack.rivers.find(r => r.i === river.i)!;
    expect(kept).toMatchObject({ name: river.name, lock: true });
    const keptPoints = Rivers.getRiverPoints(kept.cells, kept.points ?? null);
    expect(keptPoints).toEqual(points.slice(0, keptPoints.length));
  });

  it("leaves the map as it was when the restore fails", async () => {
    await generateMap({ seed: "restoration-rollback" });
    const [previous, heights, before] = [pack, grid.cells.h.slice(), fingerprint()];
    vi.spyOn(Production, "regenerateEconomy").mockImplementation(() => {
      throw new Error("injected");
    });

    expect(() => riskEdit(circle(0.5, 0.5, 80, 8, "land"), true)).toThrow("injected");

    expect(pack).toBe(previous);
    expect(grid.cells.h).toEqual(heights);
    expect(fingerprint()).toEqual(before);
  });
});

describe("Submap and Transform", () => {
  const { width, height } = { width: 960, height: 540 };
  type Projection = (x: number, y: number) => [number, number];
  const resample = (projection: Projection, inverse: Projection, scale: number) =>
    MapRestoration.transaction(() => Resample.process({ projection, inverse, scale }));
  /** a turn around the map center */
  const turn =
    (angle: number): Projection =>
    (x, y) => {
      const [cos, sin, cx, cy] = [Math.cos(angle), Math.sin(angle), width / 2, height / 2];
      return [cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos];
    };

  it("a ×2 submap keeps the map sound", async () => {
    await generateMap({ seed: "restoration-submap" });
    const before = violations();
    const [x0, y0, scale] = [width / 4, height / 4, 2];

    resample(
      (x, y) => [(x - x0) * scale, (y - y0) * scale],
      (x, y) => [x / scale + x0, y / scale + y0],
      scale
    );

    expect(newViolations(before)).toEqual([]);
  });

  it("a mirrored and shifted transform keeps the map sound and moves everything with it", async () => {
    await generateMap({ seed: "restoration-transform" });
    const before = violations();
    const burg = living(pack.burgs).find(b => b.x > 200 && b.x < width - 200)!;
    const [x, y] = [burg.x, burg.y];

    resample(
      (px, py) => [width - px - 20, py],
      (px, py) => [width - px - 20, py],
      1
    );

    expect(newViolations(before)).toEqual([]);
    expect(pack.burgs[burg.i].x).toBeCloseTo(width - x - 20, 2);
    expect(pack.burgs[burg.i].y).toBeCloseTo(y, 2);
  });

  it("a rotated transform keeps route and journey paths continuous", async () => {
    await generateMap({ seed: "restoration-rotation" });
    const before = violations();
    resample(turn(Math.PI / 6), turn(-Math.PI / 6), 1);

    expect(newViolations(before)).toEqual([]);
    expect(violations().has("route-steps")).toBe(false);
  });

  it("a submap gives a state and a province whose capital left the map its most populous burg as the new one", async () => {
    await generateMap({ seed: "restoration-submap" });
    const [x0, y0, scale] = [480, 270, 4];
    const capitals = new Set(
      living(pack.burgs)
        .filter(burg => burg.capital)
        .map(burg => burg.i)
    );

    resample(
      (x, y) => [(x - x0) * scale, (y - y0) * scale],
      (x, y) => [x / scale + x0, y / scale + y0],
      scale
    );

    const { cells } = pack;
    const promoted = living(pack.states).filter(state => !capitals.has(state.capital));
    expect(promoted.length).toBeGreaterThan(0); // the region was chosen so a capital leaves it
    for (const state of promoted) {
      const capital = pack.burgs[state.capital];
      const own = living(pack.burgs).filter(burg => burg.state === state.i && cells.state[burg.cell] === state.i);
      expect(capital).toMatchObject({ capital: 1, state: state.i });
      expect(capital.population).toBe(Math.max(...own.map(burg => burg.population!)));
      expect(state.center).toBe(capital.cell);
    }
    for (const province of living(pack.provinces)) {
      const capital = pack.burgs[province.burg];
      if (province.burg) expect(cells.province[capital.cell]).toBe(province.i);
      else expect(living(pack.burgs).some(burg => cells.province[burg.cell] === province.i)).toBe(false);
    }
    expect(violations().has("state-capitals")).toBe(false);
  }, 15000);

  it("a submap founds a capital for a state left with land but no burg", async () => {
    await generateMap({ seed: "restoration-founded-capital" });
    const before = violations();
    const firstNewBurg = pack.burgs.length;
    const [x0, y0, scale] = [420, 230, 8];

    resample(
      (x, y) => [(x - x0) * scale, (y - y0) * scale],
      (x, y) => [x / scale + x0, y / scale + y0],
      scale
    );

    expect(newViolations(before)).toEqual([]);
    const founded = living(pack.states).filter(state => state.capital >= firstNewBurg);
    expect(founded.length).toBeGreaterThan(0); // the region was chosen so a state keeps no burg
    for (const state of living(pack.states)) {
      const capital = pack.burgs[state.capital];
      expect(capital).toMatchObject({ capital: 1, state: state.i, cell: state.center });
      expect(pack.cells.state[capital.cell]).toBe(state.i);
    }
  }, 15000);

  for (const [name, projection, inverse, scale] of [
    ["a ×2 submap", (x, y) => [(x - 240) * 2, (y - 135) * 2], (x, y) => [x / 2 + 240, y / 2 + 135], 2],
    ["a rotation", turn(Math.PI / 6), turn(-Math.PI / 6), 1]
  ] as [string, Projection, Projection, number][]) {
    it(`a Risk edit that changes no height after ${name} keeps the map as it was`, async () => {
      await generateMap({ seed: "restoration-fixed-point" });
      resample(projection, inverse, scale);
      const before = fingerprint();

      riskEdit(() => {}, false);

      expect(fingerprint()).toEqual(before); // a restore of a restored map changes nothing
    }, 15000);
  }

  it("leaves the map as it was when resampling fails", async () => {
    await generateMap({ seed: "restoration-resample-rollback" });
    const [previous, previousGrid, map, before] = [pack, grid, structuredClone(options.map), fingerprint()];
    vi.spyOn(Features, "markupPack").mockImplementation(() => {
      throw new Error("injected");
    });

    expect(() =>
      resample(
        (px, py) => [px, py],
        (px, py) => [px, py],
        1
      )
    ).toThrow("injected");

    expect(pack).toBe(previous);
    expect(grid).toBe(previousGrid);
    expect(options.map).toEqual(map);
    expect(fingerprint()).toEqual(before);
  });
});
