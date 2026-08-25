import { describe, expect, it, vi } from "vitest";
import { MAP_MUTATED_EVENT } from "@/services/map-mutation";
import type { PackedGraph } from "@/types/PackedGraph";
import {
  commitHeightValues,
  commitMarketAssignments,
  commitTerritoryAssignments,
  insertMeasurerPoint,
  insertMilitaryRegiment,
  insertReliefIcon,
  insertRiverPoint,
  insertRoutePoint,
  mergeMilitaryRegiments,
  moveEmblem,
  moveFeatureVertex,
  moveIce,
  moveMarker,
  moveMeasurerPoint,
  moveMilitaryRegiment,
  moveRegimentBase,
  moveReliefIcon,
  moveRiverPoint,
  moveRoutePoint,
  moveTerritoryCenter,
  paintMarketAssignments,
  paintTerritoryAssignments,
  removeMeasurerPoint,
  removeMilitaryRegiment,
  removeReliefIcons,
  removeRiverPoint,
  removeRoutePoint,
  reorderReliefIcon,
  replaceMeasurerPoints,
  replaceRoutePoints,
  resizeReliefIcon,
  rotateMilitaryRegiment,
  setFeatureGroup,
  setLabelOverride,
  setReliefIconType,
  setZoneCells,
  toggleCellGood,
  updateCompassStyle
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
  it("publishes a semantic mutation event only after document mutation helpers commit", () => {
    const graph = createGraph();
    const dispatchEvent = vi.fn();
    const globalWindow = window as unknown as { dispatchEvent?: (event: Event) => boolean };
    const originalDispatchEvent = globalWindow.dispatchEvent;
    globalWindow.dispatchEvent = dispatchEvent;

    const working = Uint16Array.from(graph.cells.market);
    paintMarketAssignments(working, [0], 3);
    expect(dispatchEvent).not.toHaveBeenCalled();

    toggleCellGood(graph, 1, 4);
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: MAP_MUTATED_EVENT }));
    globalWindow.dispatchEvent = originalDispatchEvent;
  });

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

  it("moves emblems through their stable owner identity", () => {
    const entity = { coa: { shield: "heater" }, i: 6 } as Parameters<typeof moveEmblem>[0];
    expect(moveEmblem(entity, "state", { x: 12, y: 14 })).toMatchObject({
      affectedDomainIds: ["state:6"],
      changed: true,
      layers: ["emblems"]
    });
    expect(entity.coa).toMatchObject({ x: 12, y: 14 });
  });

  it("updates semantic compass placement without a rendered node", () => {
    const compass = { opacity: 0.8, scale: 0.25, x: 80, y: 80 };
    expect(updateCompassStyle(compass, { x: 120, y: 90 })).toMatchObject({
      affectedDomainIds: ["compass"],
      changed: true,
      layers: ["compass"]
    });
    expect(compass).toEqual({ opacity: 0.8, scale: 0.25, x: 120, y: 90 });
  });

  it("edits measurer control points through renderer-neutral commands", () => {
    const measurer = {
      i: 5,
      points: [
        [0, 0],
        [10, 0]
      ],
      type: "Ruler"
    } as Parameters<typeof moveMeasurerPoint>[0];
    insertMeasurerPoint(measurer, 1, [5, 2]);
    moveMeasurerPoint(measurer, 1, [5, 3]);
    expect(removeMeasurerPoint(measurer, 1, 2)).toMatchObject({
      affectedDomainIds: ["measurer:5"],
      changed: true,
      layers: ["rulers"]
    });
    replaceMeasurerPoints(measurer, [
      [1, 1],
      [9, 1]
    ]);
    expect(measurer.points).toEqual([
      [1, 1],
      [9, 1]
    ]);
  });

  it("commits height working values with explicit affected cells", () => {
    const heights = new Uint8Array([10, 20, 30]);
    expect(commitHeightValues(heights, new Uint8Array([12, 20, 35]), [0, 2])).toMatchObject({
      affectedCellIds: [0, 2],
      affectedDomainIds: [0, 2],
      changed: true,
      layers: ["height"]
    });
    expect(Array.from(heights)).toEqual([12, 20, 35]);
  });

  it("mutates military entities through stable state and regiment IDs", () => {
    const source = {
      a: 3,
      bx: 1,
      by: 2,
      cell: 4,
      i: 7,
      n: 0,
      state: 2,
      u: { archers: 3 },
      x: 3,
      y: 4
    } as unknown as Parameters<typeof moveMilitaryRegiment>[0];
    const target = {
      ...source,
      a: 5,
      cell: 8,
      i: 9,
      state: 3,
      u: { archers: 2, cavalry: 3 }
    };

    expect(moveMilitaryRegiment(source, { x: 10, y: 11 })).toMatchObject({
      affectedDomainIds: ["2:7"],
      changed: true,
      layers: ["military"]
    });
    moveRegimentBase(source, { x: 6, y: 7 });
    rotateMilitaryRegiment(source, 45);
    expect(source).toMatchObject({ angle: 45, bx: 6, by: 7, x: 10, y: 11 });

    expect(mergeMilitaryRegiments(source, target)).toMatchObject({
      affectedCellIds: [4, 8],
      affectedDomainIds: ["2:7", "3:9"],
      changed: true
    });
    expect(target).toMatchObject({ a: 8, u: { archers: 5, cavalry: 3 } });

    const military = [source];
    const inserted = { ...target, i: 10 };
    expect(insertMilitaryRegiment(military, inserted).changed).toBe(true);
    expect(removeMilitaryRegiment(military, 2, 7)).toMatchObject({ affectedDomainIds: ["2:7"], changed: true });
    expect(military).toEqual([inserted]);
  });
});
