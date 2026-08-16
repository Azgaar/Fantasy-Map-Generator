import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpatialIndex, ViewportRenderer } from "./viewport-renderer";

let animationFrames: Map<number, FrameRequestCallback>;
let nextFrameId: number;

beforeEach(() => {
  animationFrames = new Map();
  nextFrameId = 1;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextFrameId++;
    animationFrames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => animationFrames.delete(id));
});

afterEach(() => vi.unstubAllGlobals());

function runAnimationFrame(): void {
  const callbacks = [...animationFrames.values()];
  animationFrames.clear();
  for (const callback of callbacks) callback(performance.now());
}

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

  it("preserves source order across multiple queried buckets", () => {
    const index = new SpatialIndex<number>(10);
    const points = new Map([
      [3, [25, 5]],
      [1, [5, 5]],
      [2, [15, 5]]
    ]);
    index.replace([3, 1, 2], id => points.get(id) as [number, number]);

    expect([...index.values({ scale: 1, x0: 0, y0: 0, x1: 29, y1: 9 })]).toEqual([3, 1, 2]);
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
    expect(renders).toBe(0);
    runAnimationFrame();
    expect(renders).toBe(1);

    renderer.resume();
    expect(renders).toBe(1);
  });

  it("skips a full reconcile when the settled viewport is already materialized", () => {
    let viewport = { scale: 1, x: 0, y: 0, width: 100, height: 100 };
    const renderer = new ViewportRenderer({
      getViewport: () => viewport,
      overscanPixels: 20,
      guardPixels: 10
    });
    let renders = 0;
    renderer.register({ id: "test", render: () => renders++ });
    renderer.renderNow();

    renderer.suspend();
    viewport = { ...viewport, scale: 1.1, x: -5, y: -5 };
    renderer.resume();
    runAnimationFrame();

    expect(renders).toBe(1);
  });

  it("reconciles after the viewport moves beyond the materialized guard", () => {
    let viewport = { scale: 1, x: 0, y: 0, width: 100, height: 100 };
    const renderer = new ViewportRenderer({
      getViewport: () => viewport,
      overscanPixels: 20,
      guardPixels: 10
    });
    let renders = 0;
    renderer.register({ id: "test", render: () => renders++ });
    renderer.renderNow();

    renderer.suspend();
    viewport = { ...viewport, x: -50 };
    renderer.resume();
    expect(renders).toBe(1);
    runAnimationFrame();

    expect(renders).toBe(2);
  });

  it("does not treat a canceled render as materialized", () => {
    const renderer = new ViewportRenderer({
      getViewport: () => ({ scale: 1, x: 0, y: 0, width: 100, height: 100 }),
      overscanPixels: 20,
      guardPixels: 10
    });
    let renders = 0;
    renderer.register({ id: "test", render: () => renders++ });

    renderer.schedule();
    renderer.suspend();
    renderer.resume();
    runAnimationFrame();

    expect(renders).toBe(1);
  });
});
