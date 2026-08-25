import { describe, expect, it } from "vitest";
import { createRasterExportPlan, getRasterExportHiddenLayers, throwIfRasterExportAborted } from "./raster-export";

describe("raster export plan", () => {
  it("hides burg icons together with labels", () => {
    expect(getRasterExportHiddenLayers({ noIce: true, noLabels: true, noWater: true })).toEqual([
      "ice",
      "labels",
      "burgIcons",
      "ocean"
    ]);
  });

  it("covers every output pixel once while keeping overlapped frames within the texture limit", () => {
    const plan = createRasterExportPlan({
      columns: 2,
      height: 600,
      maxTextureSize: 1024,
      overlap: 1,
      rows: 2,
      scale: 3,
      width: 1000
    });

    expect(plan.columns).toBe(3);
    expect(plan.rows).toBe(2);
    expect(plan.tiles).toHaveLength(6);
    expect(plan.tiles.every(tile => Math.round(tile.frame.width * 3) <= 1024)).toBe(true);
    expect(plan.tiles.every(tile => Math.round(tile.frame.height * 3) <= 1024)).toBe(true);
    expect(plan.tiles.reduce((area, tile) => area + tile.width * tile.height, 0)).toBe(plan.width * plan.height);
    expect(plan.tiles[1].crop.x).toBe(1);
  });

  it("honors a requested grid when it is already below the device limit", () => {
    const plan = createRasterExportPlan({
      columns: 4,
      height: 500,
      maxTextureSize: 4096,
      rows: 3,
      scale: 1,
      width: 800
    });
    expect({ columns: plan.columns, rows: plan.rows, tiles: plan.tiles.length }).toEqual({
      columns: 4,
      rows: 3,
      tiles: 12
    });
  });

  it("rejects invalid dimensions and observes cancellation", () => {
    expect(() =>
      createRasterExportPlan({ columns: 1, height: 0, maxTextureSize: 4096, rows: 1, scale: 1, width: 100 })
    ).toThrow("height");
    const controller = new AbortController();
    controller.abort();
    expect(() => throwIfRasterExportAborted(controller.signal)).toThrow();
  });
});
