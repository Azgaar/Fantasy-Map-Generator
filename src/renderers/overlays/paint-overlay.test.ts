// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import type { PackedGraph } from "@/types/PackedGraph";
import { openPaintOverlay, removePaintOverlay, removePaintOverlayCells, updatePaintOverlay } from "./paint-overlay";
import "@/generators/pack-generator"; // registers the Pack global the overlay builds polygons with

const graph = {
  cells: {
    v: [
      [0, 1, 2],
      [1, 3, 2]
    ]
  },
  vertices: {
    p: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1]
    ]
  }
} as unknown as PackedGraph;

beforeEach(() => {
  removePaintOverlay();
  document.body.innerHTML = '<svg><g id="debug"></g></svg>';
});

describe("paint overlay", () => {
  it("updates only the cells passed to it", () => {
    openPaintOverlay();
    updatePaintOverlay(graph, [{ cell: 0, values: [{ id: 1, color: "#ff0000" }] }]);

    const firstPolygon = document.querySelector<SVGPolygonElement>('polygon[data-cell="0"]')!;

    updatePaintOverlay(graph, [{ cell: 1, values: [{ id: 2, color: "#0000ff" }] }]);

    expect(document.querySelector('polygon[data-cell="0"]')).toBe(firstPolygon);
    expect(document.querySelector('polygon[data-cell="1"]')?.getAttribute("fill")).toBe("#0000ff");
  });

  it("replaces only the requested cell preview", () => {
    openPaintOverlay();
    updatePaintOverlay(graph, [{ cell: 0, values: [{ id: 1, color: "#ff0000" }] }]);
    const previous = document.querySelector<SVGPolygonElement>('polygon[data-cell="0"]')!;

    updatePaintOverlay(graph, [{ cell: 0, values: [{ id: 2, color: "#0000ff" }] }]);

    const current = document.querySelector<SVGPolygonElement>('polygon[data-cell="0"]')!;
    expect(previous.isConnected).toBe(false);
    expect(current.dataset.value).toBe("2");
    expect(current.getAttribute("fill")).toBe("#0000ff");
  });

  it("renders and removes an empty assignment", () => {
    openPaintOverlay();
    updatePaintOverlay(graph, [{ cell: 0, values: [] }]);

    const polygon = document.querySelector<SVGPolygonElement>('polygon[data-cell="0"]')!;
    expect(polygon.dataset.value).toBe("");
    expect(polygon.getAttribute("fill")).toBe("#ffffff");

    removePaintOverlayCells([0]);
    expect(document.querySelector('[data-cell="0"]')).toBeNull();
  });
});
