// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/layers", () => ({ Layers: { draw: vi.fn() } }));
vi.mock("@/renderers/viewport/viewport-renderer", () => ({
  ViewportLayers: { schedule: vi.fn(), renderNow: vi.fn() }
}));

import "@/generators/styles";
import { rn } from "@/utils/numberUtils";
import { applyZoomBehavior, setMapZoom } from "./zoom";

beforeEach(() => {
  document.body.innerHTML = /* html */ `
    <svg id="map">
      <g id="viewbox"></g>
      <g id="labels"></g>
      <g id="emblems" style="display: none"></g>
      <g id="statesHalo"></g>
      <g id="markers"><image id="marker0" width="30" height="30" x="185" y="170"></image></g>
    </svg>
    <select id="shapeRendering"><option value="optimizeSpeed" selected></option></select>
  `;

  const map = document.getElementById("map")!;
  Object.defineProperties(map, {
    width: { value: { baseVal: { value: 1000 } } },
    height: { value: { baseVal: { value: 600 } } }
  });

  Object.assign(globalThis, {
    scale: 1,
    viewX: 0,
    viewY: 0,
    svgWidth: 1000,
    svgHeight: 600,
    customization: 0,
    options: { labels: { resizeOnZoom: false } },
    pack: { markers: [{ i: 0, x: 200, y: 200, size: 30, hidden: false }] }
  });

  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1)
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  applyZoomBehavior();
});

describe("programmatic zoom", () => {
  it("updates the viewport when a hotkey sets the scale", () => {
    setMapZoom(4);

    expect(scale).toBe(4);
    expect(document.getElementById("viewbox")!.getAttribute("transform")).toBe("translate(-1500 -900) scale(4)");
  });
});

describe("invokeActiveZooming", () => {
  beforeEach(() => {
    (document.getElementById("shapeRendering") as HTMLSelectElement).value = "auto";
  });

  it("derives statesHalo stroke-width from the store width", () => {
    styles.states.statesHalo.options.width = 8;
    (globalThis as any).scale = 2;
    invokeActiveZooming();
    const halo = document.getElementById("statesHalo")!;
    expect(halo.getAttribute("stroke-width")).toBe(String(rn(8 / 2 ** 0.8, 2)));
  });

  it("resizes markers only when the store rescale option is on", () => {
    const marker = document.getElementById("marker0")!;
    const before = {
      width: marker.getAttribute("width"),
      height: marker.getAttribute("height"),
      x: marker.getAttribute("x"),
      y: marker.getAttribute("y")
    };

    styles.markers.options.rescale = 0;
    invokeActiveZooming();
    expect({
      width: marker.getAttribute("width"),
      height: marker.getAttribute("height"),
      x: marker.getAttribute("x"),
      y: marker.getAttribute("y")
    }).toEqual(before);

    (globalThis as any).scale = 2;
    styles.markers.options.rescale = 1;
    invokeActiveZooming();
    const expectedSize = String(rn(30 / 5 + 24 / 2, 2));
    expect(marker.getAttribute("width")).toBe(expectedSize);
    expect(marker.getAttribute("height")).toBe(expectedSize);
    expect(marker.getAttribute("x")).toBe(String(rn(200 - Number(expectedSize) / 2, 1)));
    expect(marker.getAttribute("y")).toBe(String(rn(200 - Number(expectedSize), 1)));
  });
});
