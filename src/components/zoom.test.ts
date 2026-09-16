// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/layers", () => ({ Layers: { draw: vi.fn() } }));
vi.mock("@/renderers/viewport/viewport-renderer", () => ({
  ViewportLayers: { schedule: vi.fn(), renderNow: vi.fn() }
}));

import "@/generators/styles";
import { setViewportSize, setViewportTransform, viewport } from "@/components/viewport";
import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";
import { rn } from "@/utils/numberUtils";
import { applyZoomBehavior, setMapZoom, setTranslateExtent, setZoomExtent, zoomTo } from "./zoom";

beforeEach(() => {
  document.body.innerHTML = /* html */ `
    <svg id="map">
      <g id="viewbox"></g>
      <g id="labels"></g>
      <g id="emblems" style="display: none"></g>
      <g id="statesHalo"></g>
    </svg>
  `;

  const map = document.getElementById("map")!;
  Object.defineProperties(map, {
    width: { value: { baseVal: { value: 1000 } } },
    height: { value: { baseVal: { value: 600 } } }
  });

  Object.assign(globalThis, {
    customization: 0,
    options: {
      map: { labels: { resizeOnZoom: false } },
      app: { performance: { shapeRendering: "optimizeSpeed", stateHalos: false, viewportRedraw: "continuous" } }
    }
  });
  setViewportSize(1000, 600);
  setViewportTransform(1, 0, 0);

  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1)
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.mocked(ViewportLayers.schedule).mockClear();
  vi.mocked(ViewportLayers.renderNow).mockClear();
  applyZoomBehavior();
});

describe("programmatic zoom", () => {
  it("updates the viewport when a hotkey sets the scale", () => {
    setMapZoom(4);

    expect(viewport.scale).toBe(4);
    expect(document.getElementById("viewbox")!.getAttribute("transform")).toBe("translate(-1500 -900) scale(4)");
  });
});

describe("zoomTo", () => {
  beforeEach(() => {
    setZoomExtent(1, 20);
    setTranslateExtent(0, 0, 1000, 600);
  });

  it("centres a point that has room on every side", () => {
    zoomTo(500, 300, 4, 0);
    expect(viewport).toMatchObject({ scale: 4, x: -1500, y: -900 });
  });

  it("stops at the map edge instead of centring a point next to it", () => {
    zoomTo(10, 10, 4, 0);
    expect(viewport).toMatchObject({ scale: 4, x: 0, y: 0 });

    zoomTo(990, 590, 4, 0);
    expect(viewport).toMatchObject({ scale: 4, x: -3000, y: -1800 });
  });

  it("clamps the requested scale to the extent", () => {
    setZoomExtent(2, 6);
    zoomTo(500, 300, 8, 0);
    expect(viewport.scale).toBe(6);
  });

  it("never leaves the map on the way between two corners", async () => {
    // the transition runs on d3's own clock, which is bound on import and out of reach of faked timers
    zoomTo(75, 50, 8, 0);
    zoomTo(925, 550, 8, 400);

    const epsilon = 1e-9; // the view-to-transform round trip leaves float noise
    for (let elapsed = 0; elapsed < 400; elapsed += 25) {
      await new Promise(resolve => setTimeout(resolve, 25));
      const { scale, x, y } = viewport;
      expect(scale).toBeGreaterThanOrEqual(1 - epsilon);
      expect(x).toBeLessThanOrEqual(epsilon);
      expect(y).toBeLessThanOrEqual(epsilon);
      expect(1000 * scale + x).toBeGreaterThanOrEqual(1000 - epsilon);
      expect(600 * scale + y).toBeGreaterThanOrEqual(600 - epsilon);
    }
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(viewport).toMatchObject({ scale: 8, x: -6900, y: -4100 });
  });
});

describe("viewport redraw during zoom", () => {
  it("redraws viewport layers per frame and again when the gesture settles", () => {
    setMapZoom(4);

    expect(ViewportLayers.schedule).toHaveBeenCalledTimes(1);
    expect(ViewportLayers.renderNow).toHaveBeenCalledTimes(1);
  });

  it("skips the per-frame redraw when set to redraw after the zoom only", () => {
    options.app.performance.viewportRedraw = "settled";
    setMapZoom(4);

    expect(ViewportLayers.schedule).not.toHaveBeenCalled();
    expect(ViewportLayers.renderNow).toHaveBeenCalledTimes(1);
  });
});

describe("invokeActiveZooming", () => {
  beforeEach(() => {
    options.app.performance.stateHalos = true;
  });

  it("derives statesHalo stroke-width from the store width", () => {
    styles.states.statesHalo.options.width = 8;
    setViewportTransform(2, viewport.x, viewport.y);
    invokeActiveZooming();
    const halo = document.getElementById("statesHalo")!;
    expect(halo.getAttribute("stroke-width")).toBe(String(rn(8 / 2 ** 0.8, 2)));
  });
});
