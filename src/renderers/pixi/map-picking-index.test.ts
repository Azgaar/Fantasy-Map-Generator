import { describe, expect, it } from "vitest";
import type { MapLayerId } from "../core/layer-registry";
import { type MapPickEntry, MapPickingIndex } from "./map-picking-index";

const visible =
  (hidden: MapLayerId[] = []) =>
  (layer: MapLayerId) =>
    !hidden.includes(layer);

describe("MapPickingIndex", () => {
  it("uses canonical layer order as deterministic overlap precedence", () => {
    const index = new MapPickingIndex();
    index.replaceEntries([
      point("labels", "label", "label:1", 10, 10, 5, "label"),
      point("markers", "marker", 7, 10, 10, 5)
    ]);

    expect(index.pick({ x: 10, y: 10 }, { cameraScale: 1, isLayerVisible: visible(), tolerance: 8 })).toMatchObject({
      domainId: 7,
      domainKind: "marker",
      layer: "markers"
    });
  });

  it("excludes invisible layers and respects dependency visibility", () => {
    const index = new MapPickingIndex();
    index.replaceEntries([
      point("markers", "marker", 7, 10, 10, 5),
      { ...point("labels", "label", "label:1", 10, 10, 5, "label"), dependency: "routes" }
    ]);

    expect(
      index.pick({ x: 10, y: 10 }, { cameraScale: 1, isLayerVisible: visible(["markers", "routes"]), tolerance: 8 })
    ).toBeNull();
    expect(
      index.pick({ x: 10, y: 10 }, { cameraScale: 1, isLayerVisible: visible(["markers"]), tolerance: 8 })
    ).toMatchObject({ domainId: "label:1" });
  });

  it("supports zoom-dependent world tolerances for polylines", () => {
    const index = new MapPickingIndex();
    index.replaceEntries([
      {
        domainId: 4,
        domainKind: "route",
        hitWidth: 1,
        kind: "line",
        layer: "routes",
        points: [
          [0, 0],
          [20, 0]
        ],
        shape: "line"
      }
    ]);

    expect(index.pick({ x: 10, y: 5 }, { cameraScale: 1, isLayerVisible: visible(), tolerance: 8 })).toMatchObject({
      distance: 4.5,
      domainId: 4
    });
    expect(index.pick({ x: 10, y: 5 }, { cameraScale: 2, isLayerVisible: visible(), tolerance: 4 })).toBeNull();
  });

  it("distinguishes strict filled polygons from line-like polygon boundaries", () => {
    const index = new MapPickingIndex();
    const square = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10]
    ] as const;
    index.replaceEntries([
      { domainId: 1, domainKind: "lake", kind: "area", layer: "lakes", points: square, shape: "polygon", strict: true },
      {
        domainId: 2,
        domainKind: "river",
        hitWidth: 1,
        kind: "line",
        layer: "rivers",
        points: square,
        shape: "polygon",
        strict: false
      }
    ]);

    expect(index.pick({ x: 5, y: 5 }, { cameraScale: 1, isLayerVisible: visible(), tolerance: 1 })).toMatchObject({
      domainId: 2,
      domainKind: "river"
    });
    expect(
      index.pick({ x: 11, y: 5 }, { cameraScale: 1, isLayerVisible: visible(["rivers"]), tolerance: 2 })
    ).toBeNull();
  });
});

function point(
  layer: MapLayerId,
  domainKind: "label" | "marker",
  domainId: number | string,
  x: number,
  y: number,
  radius: number,
  kind: "label" | "point" = "point"
): MapPickEntry {
  return { domainId, domainKind, kind, layer, radius, shape: "point", x, y };
}
