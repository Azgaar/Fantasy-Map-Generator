import { describe, expect, it } from "vitest";
import { RendererResourceTracker } from "./resource-budget";

describe("RendererResourceTracker", () => {
  it("accounts resources and reports per-kind budget overflow", () => {
    const tracker = new RendererResourceTracker({ geometry: 10, glyph: 20, texture: 30 });
    tracker.acquire("positions", "geometry", 8);
    tracker.acquire("indices", "geometry", 4);
    tracker.acquire("atlas", "texture", 20);

    expect(tracker.getSnapshot()).toEqual({
      bytes: { geometry: 12, glyph: 0, texture: 20 },
      counts: { geometry: 2, glyph: 0, texture: 1 },
      overBudget: ["geometry"],
      totalBytes: 32,
      totalCount: 3
    });

    tracker.release("indices");
    expect(tracker.getSnapshot().overBudget).toEqual([]);
    expect(tracker.getSnapshot().totalBytes).toBe(28);
  });

  it("rejects duplicate ids and invalid byte sizes", () => {
    const tracker = new RendererResourceTracker();
    tracker.acquire("mesh", "geometry", 1);
    expect(() => tracker.acquire("mesh", "geometry", 1)).toThrow("already tracked");
    expect(() => tracker.acquire("bad", "texture", -1)).toThrow("Invalid renderer resource size");
  });

  it("returns to baseline after clear", () => {
    const tracker = new RendererResourceTracker();
    tracker.acquire("mesh", "geometry", 100);
    tracker.clear();
    expect(tracker.getSnapshot().totalCount).toBe(0);
    expect(tracker.getSnapshot().totalBytes).toBe(0);
  });
});
