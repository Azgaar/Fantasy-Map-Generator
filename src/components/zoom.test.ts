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
import { applyZoomBehavior, setMapZoom } from "./zoom";

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
      app: {
        performance: {
          shapeRendering: "optimizeSpeed",
          stateHalos: false,
          viewportRedraw: "continuous"
        }
      }
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
    styles.states.groups.statesHalo.attrs["stroke-width"] = 8;
    setViewportTransform(2, viewport.x, viewport.y);
    invokeActiveZooming();
    const halo = document.getElementById("statesHalo")!;
    expect(halo.getAttribute("stroke-width")).toBe(String(rn(8 / 2 ** 0.8, 2)));
  });

  it("sizes the viewbox font half-way with the zoom", () => {
    const viewbox = document.getElementById("viewbox")!;
    setViewportTransform(4, viewport.x, viewport.y);
    invokeActiveZooming();
    expect(viewbox.getAttribute("font-size")).toBe("62.5px"); // (100 + 100 / 4) / 2
  });
});
