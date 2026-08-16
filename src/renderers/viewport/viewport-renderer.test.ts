import { describe, expect, it } from "vitest";
import { SpatialIndex, ViewportRenderer } from "./viewport-renderer";

describe("SpatialIndex", () => {
  it("returns only items from buckets intersecting finite viewport bounds", () => {
    const index = new SpatialIndex<number>(10);
    const points = [
      [2, 2],
      [12, 2],
      [22, 22]
    ] as const;

    index.replace([0, 1, 2], id => points[id]);

    expect([...index.values({ scale: 1, x0: 0, y0: 0, x1: 19, y1: 9 })]).toEqual([0, 1]);
  });

  it("preserves source order inside buckets and supports unbounded export renders", () => {
    const index = new SpatialIndex<number>(10);
    index.replace([3, 1, 2], id => [id, id]);

    expect([...index.values()]).toEqual([3, 1, 2]);
    expect([...index.values({ scale: 1, x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity })]).toEqual([
      3, 1, 2
    ]);
  });

  it("drops excluded items and releases all data on clear", () => {
    const index = new SpatialIndex<number>();
    index.replace([0, 1, 2], id => (id === 1 ? null : [id, id]));
    expect([...index.values()]).toEqual([0, 2]);

    index.clear();
    expect(index.valid).toBe(false);
    expect([...index.values()]).toEqual([]);
  });
});

describe("ViewportRenderer interaction suspension", () => {
  it("keeps layers stable while suspended and reconciles once on resume", () => {
    const renderer = new ViewportRenderer({
      getViewport: () => ({ scale: 1, x: 0, y: 0, width: 100, height: 100 }),
      overscanPixels: 20,
      guardPixels: 10
    });
    let renders = 0;
    const layer = renderer.register({ id: "test", render: () => renders++ });

    renderer.suspend();
    layer.invalidate();
    renderer.schedule();
    expect(renders).toBe(0);

    renderer.resume();
    expect(renders).toBe(1);

    renderer.resume();
    expect(renders).toBe(1);
  });
});
