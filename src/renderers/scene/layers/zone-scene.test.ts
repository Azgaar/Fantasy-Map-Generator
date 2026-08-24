import { describe, expect, it } from "vitest";
import type { PackedGraph } from "@/types/PackedGraph";
import { buildZoneScene } from "./zone-scene";

const source = {
  cells: {
    v: [
      [0, 1, 2],
      [1, 3, 2]
    ]
  },
  vertices: {
    p: [
      [0, 0],
      [10, 0],
      [0, 10],
      [10, 10]
    ]
  },
  zones: [
    { cells: [0, 1], color: "#ff0000", i: 4, name: "War", type: "Invasion" },
    { cells: [1], color: "#0000ff", i: 7, name: "Plague", type: "Disease" },
    { cells: [0], color: "#00ff00", hidden: true, i: 9, name: "Hidden", type: "Disaster" }
  ]
} as unknown as Pick<PackedGraph, "cells" | "vertices" | "zones">;

describe("zone scene", () => {
  it("keeps overlapping memberships in ordered per-zone polygon batches", () => {
    const scene = buildZoneScene(source, "zones:3");

    expect(scene).toMatchObject({
      bounds: { maxX: 10, maxY: 10, minX: 0, minY: 0 },
      layer: "zones",
      revision: "zones:3"
    });
    expect(
      scene.zones.map(({ color, domainIds, polygons, zoneId }) => [zoneId, color, domainIds, polygons.length])
    ).toEqual([
      [4, "#ff0000", [4], 2],
      [7, "#0000ff", [7], 1]
    ]);
    expect(scene.zones[0].polygons[1].domainId).toBe(4);
    expect(scene.zones[1].polygons[0].domainId).toBe(7);
  });

  it("applies the semantic type filter and skips invalid cell geometry", () => {
    expect(buildZoneScene(source, 0, { filterType: "Disease" }).zones.map(zone => zone.zoneId)).toEqual([7]);
    expect(buildZoneScene(source, 0, { filterType: "Missing" }).zones).toEqual([]);
  });
});
