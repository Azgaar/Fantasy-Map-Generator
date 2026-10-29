import { expect, it } from "vitest";
import "./graph/pack-generator";
import "./economy/routes-generator";
import "./economy/transports-generator";
import { type IntegrityRule, MapIntegrity } from "./map-integrity";

// cells 0 and 1 lie on a line; cell 2 borders cell 1 only
function check(rule: IntegrityRule, { routes = [], journeys = [] }: { routes?: unknown[]; journeys?: unknown[] }) {
  globalThis.pack = {
    cells: {
      i: [0, 1, 2],
      c: [[1], [0, 2], [1]],
      p: [
        [0, 0],
        [10, 0],
        [10, 8]
      ],
      h: [30, 30, 30],
      f: [1, 1, 1],
      burg: [0, 0, 0],
      routes: {}
    },
    features: [0, { i: 1, type: "island", land: true, name: "Isle", group: "isle" }],
    rivers: [],
    routes,
    journeys,
    markers: [],
    burgs: [],
    states: [],
    provinces: [],
    cultures: [],
    religions: [],
    zones: []
  } as unknown as typeof pack;
  return MapIntegrity.check().find(violation => violation.rule === rule);
}

const route = (points: number[][]) => ({ routes: [{ i: 0, group: "searoutes", points }] });
const journey = (transport: string, points: number[][]) => ({
  journeys: [{ i: 0, segments: [{ transport, points }] }]
});

it("lets a meandered point bend next to the cell the route steps to", () => {
  const points = [
    [0, 0, 0],
    [9, 7, 0],
    [10, 0, 1]
  ];
  expect(check("route-points", route(points))).toBeUndefined();
});

it("flags a point off its cell with no next cell beside it", () => {
  const points = [
    [0, 0, 0],
    [10, 8, 0]
  ];
  expect(check("route-points", route(points))).toMatchObject({ count: 1 });
});

it("lets a flight skip cells, but not a walk", () => {
  const points = [
    [0, 0, 0],
    [10, 8, 2]
  ];
  expect(check("journey-steps", journey("Dirigible", points))).toBeUndefined();
  expect(check("journey-steps", journey("On foot (light)", points))).toMatchObject({ count: 1 });
});
