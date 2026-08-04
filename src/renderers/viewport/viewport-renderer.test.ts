import { describe, expect, it, vi } from "vitest";
import { getViewportBounds, shouldReconcileViewport, ViewportRenderer } from "./viewport-renderer";

describe("ViewportRenderer", () => {
  it("coalesces scheduled renders and uses the latest context", () => {
    let callback: FrameRequestCallback | undefined;
    const render = vi.fn();
    const renderer = new ViewportRenderer(cb => {
      callback = cb;
      return 1;
    }, vi.fn());
    renderer.register({ id: "labels", render });
    const first = context(1);
    const last = context(3);

    renderer.schedule(first);
    renderer.schedule(last);
    expect(render).not.toHaveBeenCalled();
    callback?.(0);
    expect(render).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledWith(last);
  });

  it("uses inclusive scale bounds and isolates registered entries", () => {
    const low = vi.fn();
    const high = vi.fn();
    const renderer = new ViewportRenderer(vi.fn(), vi.fn());
    renderer.register({ id: "low", scaleMin: 2, scaleMax: 4, render: low });
    renderer.register({ id: "high", scaleMin: 5, render: high });

    renderer.renderNow(context(2));
    renderer.renderNow(context(4));
    expect(low).toHaveBeenCalledTimes(2);
    expect(high).not.toHaveBeenCalled();
  });

  it("renderAll ignores scale and enabled gates", () => {
    const render = vi.fn();
    const renderer = new ViewportRenderer(vi.fn(), vi.fn());
    renderer.register({ id: "off", scaleMin: 10, enabled: () => false, render });
    renderer.renderAll(document, context(1).bounds);
    expect(render).toHaveBeenCalledOnce();
    expect(render.mock.calls[0][0].renderAll).toBe(true);
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

function context(scale: number) {
  return { root: document, renderAll: false, bounds: { scale, x0: 0, y0: 0, x1: 100, y1: 100 } };
}
