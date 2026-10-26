import { expect, it } from "vitest";
import "./graph/pack-generator";
import "./economy/routes-generator";
import "./economy/transports-generator";
import { type IntegrityRule, MapIntegrity } from "./map-integrity";

// cells 0 and 1 lie on a line; cell 2 borders cell 1 only
function check(
  rule: IntegrityRule,
  {
    routes = [],
    journeys = [],
    burgs = [],
    links = {},
    markets = []
  }: { routes?: unknown[]; journeys?: unknown[]; burgs?: unknown[]; links?: object; markets?: unknown[] }
) {
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
      market: [1, 1, 2],
      routes: links
    },
    features: [0, { i: 1, type: "island", land: true, name: "Isle", group: "isle" }],
    rivers: [],
    routes,
    journeys,
    markers: [],
    burgs: [0, ...burgs],
    markets,
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

it("flags a burg off the route network", () => {
  const routes = [
    {
      i: 0,
      group: "trails",
      points: [
        [0, 0, 0],
        [10, 0, 1]
      ]
    }
  ];
  const links = { 0: { 1: 0 }, 1: { 0: 0 } };
  const burgs = [
    { i: 1, cell: 1, x: 10, y: 0, feature: 1 },
    { i: 2, cell: 2, x: 10, y: 8, feature: 1 }
  ];
  expect(check("burg-routes", { routes, links, burgs })).toMatchObject({ count: 1, examples: ["2"] });
});

it("flags a burg with no market, a removed one or not the one of its cell", () => {
  const burgs = [
    { i: 1, cell: 0, x: 0, y: 0, feature: 1, market: 1 },
    { i: 2, cell: 1, x: 10, y: 0, feature: 1 },
    { i: 3, cell: 2, x: 10, y: 8, feature: 1, market: 1 }
  ];
  const markets = [{ i: 1, centerBurgId: 1, goods: {} }];
  expect(check("burg-markets", { burgs, markets })).toMatchObject({ count: 2, examples: ["2", "3"] });
});
