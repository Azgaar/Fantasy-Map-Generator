import { describe, expect, it, vi } from "vitest";
import { getViewportBounds, shouldReconcileViewport, ViewportRenderer } from "./viewport-renderer";

describe("ViewportRenderer", () => {
  it("coalesces scheduled renders and uses the latest viewport", () => {
    let callback: FrameRequestCallback | undefined;
    const viewport = { scale: 1, x: 0, y: 0, width: 100, height: 100 };
    const render = vi.fn();
    const renderer = new ViewportRenderer({
      getViewport: () => viewport,
      requestFrame: cb => {
        callback = cb;
        return 1;
      },
      cancelFrame: vi.fn()
    });
    renderer.register({ id: "labels", render });

    renderer.schedule();
    viewport.x = -200;
    renderer.schedule();
    expect(render).not.toHaveBeenCalled();
    callback?.(0);

    expect(render).toHaveBeenCalledOnce();
    expect(render.mock.calls[0][0]).toMatchObject({
      root: document,
      renderAll: false,
      bounds: { scale: 1, x0: 160, x1: 340 }
    });
  });

  it("uses inclusive scale bounds and isolates registered layers", () => {
    const viewport = { scale: 2, x: 0, y: 0, width: 100, height: 100 };
    const low = vi.fn();
    const high = vi.fn();
    const renderer = createRenderer(viewport);
    renderer.register({ id: "low", scaleMin: 2, scaleMax: 4, render: low });
    renderer.register({ id: "high", scaleMin: 5, render: high });

    renderer.renderNow();
    viewport.scale = 4;
    renderer.renderNow();
    expect(low).toHaveBeenCalledTimes(2);
    expect(high).not.toHaveBeenCalled();
  });

  it("returns an unregister function scoped to the registered layer", () => {
    const render = vi.fn();
    const renderer = createRenderer();
    const unregister = renderer.register({ id: "labels", render });

    renderer.renderNow();
    unregister();
    renderer.renderNow();
    expect(render).toHaveBeenCalledOnce();
  });

  it("renderAll ignores viewport, scale, and enabled gates", () => {
    const render = vi.fn();
    const renderer = createRenderer();
    renderer.register({ id: "off", scaleMin: 10, enabled: () => false, render });
    renderer.renderAll(document);

    expect(render).toHaveBeenCalledOnce();
    expect(render.mock.calls[0][0]).toEqual({
      root: document,
      renderAll: true,
      bounds: { scale: 1, x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity }
    });
  });
});

describe("viewport bounds", () => {
  it("converts screen padding to world units", () => {
    expect(getViewportBounds({ scale: 2, x: -100, y: -50 }, { width: 800, height: 600 })).toEqual({
      scale: 2,
      x0: 10,
      y0: -15,
      x1: 490,
      y1: 365
    });
  });

  it("reconciles only after the visible viewport crosses the guard", () => {
    const materialized = { scale: 2, x0: 0, y0: 0, x1: 500, y1: 400 };
    expect(shouldReconcileViewport(materialized, { scale: 2, x0: 40, y0: 40, x1: 460, y1: 360 })).toBe(false);
    expect(shouldReconcileViewport(materialized, { scale: 2, x0: 10, y0: 40, x1: 430, y1: 360 })).toBe(true);
  });
});

function createRenderer(viewport = { scale: 1, x: 0, y: 0, width: 100, height: 100 }) {
  return new ViewportRenderer({ getViewport: () => viewport, requestFrame: vi.fn(), cancelFrame: vi.fn() });
}
