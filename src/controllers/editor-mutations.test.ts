import { describe, expect, it } from "vitest";
import type { PackedGraph } from "@/types/PackedGraph";
import {
  commitMarketAssignments,
  commitTerritoryAssignments,
  insertReliefIcon,
  insertRiverPoint,
  insertRoutePoint,
  moveFeatureVertex,
  moveIce,
  moveMarker,
  moveReliefIcon,
  moveRiverPoint,
  moveRoutePoint,
  moveTerritoryCenter,
  paintMarketAssignments,
  paintTerritoryAssignments,
  removeReliefIcons,
  removeRiverPoint,
  removeRoutePoint,
  reorderReliefIcon,
  replaceRoutePoints,
  resizeReliefIcon,
  setFeatureGroup,
  setLabelOverride,
  setReliefIconType,
  setZoneCells,
  toggleCellGood
} from "./editor-mutations";

const createGraph = () =>
  ({
    burgs: [{ i: 0 }, { cell: 1, i: 1, market: 1 }],
    cells: {
      burg: new Uint16Array([0, 1, 0]),
      good: new Uint16Array([0, 0, 0]),
      market: new Uint16Array([1, 1, 2])
    },
    goods: [{ i: 4, visible: false }],
    ice: [
      {
        i: 3,
        points: [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4]
        ],
        type: "iceberg"
      }
    ],
    markers: [{ cell: 0, i: 8, x: 1, y: 2 }]
  }) as unknown as PackedGraph;

describe("editor mutations", () => {
  it("moves point entities and reports stable affected IDs", () => {
    const graph = createGraph();
    expect(moveMarker(graph, 8, { x: 10, y: 20 }, 2)).toMatchObject({
      affectedCellIds: [2],
      affectedDomainIds: [8],
      changed: true,
      layers: ["markers"]
    });
    expect(graph.markers[0]).toMatchObject({ cell: 2, x: 10, y: 20 });
  });

  it("stores ice movement as an offset from immutable polygon points", () => {
    const graph = createGraph();
    expect(moveIce(graph, 3, { x: 5, y: 6 })).toMatchObject({ affectedDomainIds: [3], changed: true });
    expect(graph.ice[0].offset).toEqual([3, 4]);
  });

  it("toggles bonus goods and exposes the changed cell", () => {
    const graph = createGraph();
    expect(toggleCellGood(graph, 1, 4)).toMatchObject({ affectedCellIds: [1], changed: true });
    expect(graph.cells.good[1]).toBe(4);
    expect(graph.goods[0].visible).toBe(true);
    toggleCellGood(graph, 1, 4);
    expect(graph.cells.good[1]).toBe(0);
  });

  it("paints and commits market assignments with undo-friendly working arrays", () => {
    const graph = createGraph();
    const working = Uint16Array.from(graph.cells.market);
    expect(paintMarketAssignments(working, [0, 2], 3)).toMatchObject({
      affectedCellIds: [0, 2],
      affectedDomainIds: [3, 1, 2],
      changed: true
    });
    expect(Array.from(graph.cells.market)).toEqual([1, 1, 2]);
    expect(commitMarketAssignments(graph, working)).toMatchObject({ affectedCellIds: [0, 2], changed: true });
    expect(Array.from(graph.cells.market)).toEqual([3, 1, 3]);
    expect(graph.burgs[1].market).toBe(1);
  });

  it("mutates route control points and reports every touched cell", () => {
    const route = {
      feature: 1,
      group: "roads",
      i: 7,
      points: [
        [0, 0, 1],
        [5, 5, 2]
      ]
    };
    expect(insertRoutePoint(route, 1, [2, 2, 3])).toMatchObject({
      affectedCellIds: [3],
      affectedDomainIds: [7],
      changed: true,
      layers: ["routes"]
    });
    expect(moveRoutePoint(route, 1, [3, 3, 4])).toMatchObject({ affectedCellIds: [3, 4], changed: true });
    expect(removeRoutePoint(route, 1)).toMatchObject({ affectedCellIds: [4], changed: true });
    expect(
      replaceRoutePoints(route, [
        [1, 1, 5],
        [6, 6, 6]
      ])
    ).toMatchObject({
      affectedCellIds: [1, 2, 5, 6],
      changed: true
    });
  });

  it("mutates river control points and reports every touched cell", () => {
    const river = {
      i: 9,
      points: [
        [0, 0],
        [5, 5]
      ]
    } as Parameters<typeof insertRiverPoint>[0];
    expect(insertRiverPoint(river, 1, [2, 2], 3)).toMatchObject({
      affectedCellIds: [3],
      affectedDomainIds: [9],
      changed: true,
      layers: ["rivers"]
    });
    expect(moveRiverPoint(river, 1, [3, 3], 3, 4)).toMatchObject({ affectedCellIds: [3, 4], changed: true });
    expect(removeRiverPoint(river, 1, 4)).toMatchObject({ affectedCellIds: [4], changed: true });
  });

  it("paints and commits generic territory assignments", () => {
    const target = new Uint16Array([1, 1, 2]);
    const working = target.slice();
    expect(paintTerritoryAssignments("cultures", working, [0, 2], 3)).toMatchObject({
      affectedCellIds: [0, 2],
      affectedDomainIds: [3, 1, 2],
      changed: true,
      layers: ["cultures"]
    });
    expect(Array.from(target)).toEqual([1, 1, 2]);
    expect(commitTerritoryAssignments("cultures", target, working)).toMatchObject({
      affectedCellIds: [0, 2],
      changed: true
    });
    expect(Array.from(target)).toEqual([3, 1, 3]);
  });

  it("moves a territory center through an explicit domain mutation", () => {
    const domains = [{ center: 2, i: 4 }];
    expect(moveTerritoryCenter("cultures", domains, 4, 7)).toMatchObject({
      affectedCellIds: [2, 7],
      affectedDomainIds: [4],
      changed: true,
      layers: ["cultures"]
    });
    expect(domains[0].center).toBe(7);
  });

  it("updates overlapping zone membership without touching other zones", () => {
    const zones = [
      { cells: [1, 2], color: "#fff", i: 3, name: "A", type: "test" },
      { cells: [2, 4], color: "#000", i: 4, name: "B", type: "test" }
    ];
    expect(setZoneCells(zones, 3, [2, 5])).toMatchObject({
      affectedCellIds: [1, 5],
      affectedDomainIds: [3],
      changed: true,
      layers: ["zones"]
    });
    expect(zones[1].cells).toEqual([2, 4]);
  });

  it("moves a feature vertex and reports dependent geometry layers", () => {
    const graph = {
      features: [{ area: 4, i: 2, vertices: [0, 1, 2, 3] }],
      vertices: {
        c: [[0], [0, 1], [0], [0]],
        p: [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2]
        ]
      }
    } as unknown as Pick<PackedGraph, "features" | "vertices">;
    expect(moveFeatureVertex(graph, 2, 1, [3, 0])).toMatchObject({
      affectedCellIds: [0, 1],
      affectedDomainIds: [2],
      changed: true
    });
    expect(graph.features[0].area).toBe(5);
    expect(graph.vertices.p[1]).toEqual([3, 0]);
  });

  it("changes a feature's semantic renderer group", () => {
    const graph = {
      features: [{ group: "freshwater", i: 2, type: "lake" }]
    } as unknown as Pick<PackedGraph, "features">;
    expect(setFeatureGroup(graph, 2, "salt")).toMatchObject({
      affectedDomainIds: [2],
      changed: true,
      layers: ["lakes"]
    });
    expect(graph.features[0].group).toBe("salt");
  });

  it("mutates stable relief entities without relying on array position", () => {
    const graph = {
      relief: [
        { i: 2, icon: "relief-hill-1", s: 4, x: 0, y: 0 },
        { i: 8, icon: "relief-mount-1", s: 6, x: 10, y: 10 }
      ]
    } as Pick<PackedGraph, "relief">;
    expect(moveReliefIcon(graph, 8, { x: 12, y: 13 })).toMatchObject({ affectedDomainIds: [8], changed: true });
    resizeReliefIcon(graph, 8, 8);
    expect(graph.relief[1]).toMatchObject({ s: 8, x: 11, y: 12 });
    setReliefIconType(graph, 8, "relief-mount-2");
    reorderReliefIcon(graph, 8, "back");
    expect(graph.relief[0].i).toBe(8);
    const inserted: Parameters<typeof insertReliefIcon>[1] = { icon: "relief-hill-2", s: 3, x: 4, y: 5 };
    insertReliefIcon(graph, inserted);
    expect(inserted.i).toBe(9);
    removeReliefIcons(graph, new Set([2, 9]));
    expect(graph.relief.map(icon => icon.i)).toEqual([8]);
  });

  it("stores label overrides with a stable typed entity result", () => {
    const entity = { i: 4 };
    expect(setLabelOverride(entity, "state", { dx: 2, dy: 3, text: "North" })).toMatchObject({
      affectedDomainIds: ["state:4"],
      changed: true,
      layers: ["labels"]
    });
    expect(entity).toEqual({ i: 4, label: { dx: 2, dy: 3, text: "North" } });
  });
});
