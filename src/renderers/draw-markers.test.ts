// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { setViewportSize, setViewportTransform } from "@/components/viewport";
import type { Marker } from "@/generators/markers-generator";
import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";

const mocks = vi.hoisted(() => ({ layerOn: true }));
vi.mock("@/components/layers", () => ({ Layers: { isOn: () => mocks.layerOn } }));
import "@/generators/styles";
import { drawMarkers, setEditedMarker, setMarkersFilter } from "./draw-markers";

function marker(i: number, x = 50, y = 50): Marker {
  return { i, x, y, icon: "🌋", type: "volcano", name: "Volcano", cell: 0 };
}

beforeEach(() => {
  mocks.layerOn = true;
  document.body.innerHTML = '<svg id="map"><g id="markers"></g></svg>';
  globalThis.pack = { markers: [marker(1), marker(2, 500)] } as never;
  styles.markers.options.rescale = 1;
  setViewportSize(100, 100);
  setViewportTransform(1, 0, 0);
  setMarkersFilter(null);
  setEditedMarker(null);
});

test("panning culls markers and repeated rendering produces the same markup", () => {
  drawMarkers();
  expect(document.getElementById("marker1")).not.toBeNull();
  const markup = document.getElementById("markers")!.innerHTML;
  ViewportLayers.renderNow();
  expect(document.getElementById("markers")!.innerHTML).toBe(markup);
  expect(document.getElementById("marker2")).toBeNull();

  setViewportTransform(1, -450, 0);
  ViewportLayers.renderNow();
  expect(document.getElementById("marker1")).toBeNull();
  expect(document.getElementById("marker2")).not.toBeNull();
});

test("culling includes partially visible pins and uses their zoomed size", () => {
  pack.markers = [marker(1, 190), marker(2, 50, 200), marker(3, 196), marker(4, 50, -81)];
  drawMarkers();
  expect(document.getElementById("marker1")).not.toBeNull();
  expect(document.getElementById("marker2")).not.toBeNull();
  expect(document.getElementById("marker3")).toBeNull();
  expect(document.getElementById("marker4")).toBeNull();

  setViewportTransform(2, 0, 0);
  ViewportLayers.renderNow();
  expect(document.querySelectorAll("#markers > svg")).toHaveLength(0);
});

test("zoom sizing respects the rescale option and full-map export uses scale one", () => {
  setViewportTransform(4, 0, 0);
  drawMarkers();
  expect(document.getElementById("marker1")?.getAttribute("width")).toBe("12");
  const clone = document.getElementById("map")!.cloneNode(true) as SVGSVGElement;
  ViewportLayers.renderTo(clone);
  expect(clone.querySelectorAll("#markers > svg")).toHaveLength(2);
  expect(clone.querySelector("#marker2")?.getAttribute("width")).toBe("30");
  expect(document.getElementById("marker2")).toBeNull();
  expect(document.getElementById("marker1")?.getAttribute("width")).toBe("12");
  ViewportLayers.renderTo(clone);
  expect(clone.querySelectorAll("#markers > svg")).toHaveLength(2);

  styles.markers.options.rescale = 0;
  pack.markers[0].size = 60;
  drawMarkers();
  expect(document.getElementById("marker1")?.getAttribute("width")).toBe("60");
  expect(document.getElementById("marker1")?.getAttribute("x")).toBe("20");
  expect(document.getElementById("marker1")?.getAttribute("y")).toBe("-10");
});

test("pinning, overview filters and hidden markers apply during redraw and export", () => {
  pack.markers = [marker(1), { ...marker(2), pinned: true }, { ...marker(3), pinned: true, hidden: true }];
  drawMarkers();
  expect(document.querySelectorAll("#markers > svg")).toHaveLength(1);
  expect(document.getElementById("marker2")).not.toBeNull();
  setMarkersFilter([1]);
  ViewportLayers.renderNow();
  expect(document.querySelectorAll("#markers > svg")).toHaveLength(0);
  delete pack.markers[1].pinned;
  delete pack.markers[2].pinned;
  ViewportLayers.renderNow();
  expect(document.getElementById("marker1")).not.toBeNull();
  const clone = document.getElementById("map")!.cloneNode(true) as SVGSVGElement;
  ViewportLayers.renderTo(clone);
  expect(clone.querySelectorAll("#markers > svg")).toHaveLength(1);
  setMarkersFilter([]);
  drawMarkers();
  expect(document.querySelectorAll("#markers > svg")).toHaveLength(0);
});

test("an offscreen edited marker stays attached until editing ends", () => {
  const edited = pack.markers[1];
  setEditedMarker(edited);
  const element = document.getElementById("marker2");
  expect(element).not.toBeNull();
  const listener = vi.fn();
  element!.addEventListener("click", listener);
  element!.classList.add("draggable");
  ViewportLayers.renderNow();
  expect(document.getElementById("marker2")).toBe(element);
  edited.icon = "https://example.com/marker.png";
  edited.pin = "no";
  edited.px = 20;
  drawMarkers();
  expect(document.getElementById("marker2")).toBe(element);
  expect(element?.querySelector("image")?.getAttribute("href")).toBe(edited.icon);
  expect(element?.querySelector("g")?.childElementCount).toBe(0);
  expect(element?.classList.contains("draggable")).toBe(true);
  expect(element?.namespaceURI).toBe("http://www.w3.org/2000/svg");
  element!.dispatchEvent(new Event("click"));
  expect(listener).toHaveBeenCalledOnce();
  setEditedMarker(null);
  expect(document.getElementById("marker2")).toBeNull();
});

test("offscreen edits, deletion and replacement map data are reflected when rendered", () => {
  pack.markers[1].icon = "🏰";
  setViewportTransform(1, -450, 0);
  ViewportLayers.renderNow();
  expect(document.querySelector("#marker2 > text")?.textContent).toBe("🏰");
  pack.markers = [marker(3, 500)];
  ViewportLayers.renderNow();
  expect(document.getElementById("marker2")).toBeNull();
  expect(document.getElementById("marker3")).not.toBeNull();
});

test("viewport rendering does not repopulate a disabled layer", () => {
  mocks.layerOn = false;
  document.getElementById("markers")!.replaceChildren();
  ViewportLayers.renderNow();
  expect(document.querySelectorAll("#markers > svg")).toHaveLength(0);
  mocks.layerOn = true;
  drawMarkers();
  expect(document.getElementById("marker1")).not.toBeNull();
});
