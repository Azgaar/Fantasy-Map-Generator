import { describe, expect, it } from "vitest";
import { clampPanZoom, MAX_ZOOM, MIN_ZOOM, PAN_ZOOM_IDENTITY, panBy, zoomAt } from "./panZoomUtils";

const viewport = { width: 400, height: 320 };

describe("zoomAt", () => {
  it("keeps the content point under the cursor fixed while zooming", () => {
    const t = zoomAt(PAN_ZOOM_IDENTITY, { x: 100, y: 80 }, 2, viewport);
    expect(t).toEqual({ k: 2, x: -100, y: -80 });
  });

  it("compounds zooms toward different points", () => {
    const once = zoomAt(PAN_ZOOM_IDENTITY, { x: 100, y: 80 }, 2, viewport);
    const twice = zoomAt(once, { x: 200, y: 160 }, 2, viewport);
    expect(twice).toEqual({ k: 4, x: -400, y: -320 });
  });

  it("clamps scale at MAX_ZOOM and anchors with the clamped factor", () => {
    const t = zoomAt(PAN_ZOOM_IDENTITY, { x: 100, y: 80 }, 1000, viewport);
    expect(t).toEqual({ k: MAX_ZOOM, x: -3100, y: -2480 });
  });

  it("clamps scale at MIN_ZOOM and recentres to identity", () => {
    const t = zoomAt({ k: 1, x: 0, y: 0 }, { x: 200, y: 160 }, 0.5, viewport);
    expect(t).toEqual({ k: MIN_ZOOM, x: 0, y: 0 });
  });

  it("re-clamps pan when zooming out from a corner", () => {
    const cornered = { k: 4, x: -1200, y: -960 };
    const t = zoomAt(cornered, { x: 0, y: 0 }, 0.25, viewport);
    expect(t).toEqual({ k: 1, x: 0, y: 0 });
  });

  it("honours a per-call maxK below MAX_ZOOM, anchoring with the clamped factor", () => {
    const t = zoomAt(PAN_ZOOM_IDENTITY, { x: 100, y: 80 }, 1000, viewport, 3);
    expect(t).toEqual({ k: 3, x: -200, y: -160 });
  });

  it("never lets maxK drop below MIN_ZOOM", () => {
    const t = zoomAt(PAN_ZOOM_IDENTITY, { x: 100, y: 80 }, 2, viewport, 0.5);
    expect(t).toEqual({ k: MIN_ZOOM, x: 0, y: 0 });
  });
});

describe("panBy", () => {
  it("moves the content by the pointer delta", () => {
    const zoomed = { k: 2, x: -100, y: -80 };
    const t = panBy(zoomed, -50, 30, viewport);
    expect(t).toEqual({ k: 2, x: -150, y: -50 });
  });

  it("clamps pan at all four edges", () => {
    const zoomed = { k: 2, x: -100, y: -80 };
    expect(panBy(zoomed, 9999, 9999, viewport)).toEqual({ k: 2, x: 0, y: 0 });
    expect(panBy(zoomed, -9999, -9999, viewport)).toEqual({ k: 2, x: -400, y: -320 });
  });

  it("cannot pan at 1x", () => {
    expect(panBy(PAN_ZOOM_IDENTITY, 40, 40, viewport)).toEqual(PAN_ZOOM_IDENTITY);
  });
});

describe("clampPanZoom", () => {
  it("returns offsets to zero at scale 1", () => {
    expect(clampPanZoom({ k: 1, x: -50, y: 20 }, viewport)).toEqual({ k: 1, x: 0, y: 0 });
  });
});
