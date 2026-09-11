// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { setViewportSize, setViewportTransform } from "@/components/viewport";
import type { River } from "@/generators/river-generator";
import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";

const mocks = vi.hoisted(() => ({ layerOn: true }));
vi.mock("@/components/layers", () => ({ Layers: { isOn: () => mocks.layerOn } }));

import {
  drawRivers,
  getRiverBox,
  redrawRiver,
  removeRivers,
  setEditedRiver,
  toggleBasinHighlight
} from "./draw-rivers";

function river(i: number, x: number, basin = i): River {
  const points: [number, number][] = [
    [x, 10],
    [x + 20, 30],
    [x + 40, 50]
  ];
  return { i, basin, points, cells: [1, 2, 3], widthFactor: 1, sourceWidth: 0.1 } as River;
}

const addMeandering = vi.fn(
  (cells: number[], points?: [number, number][]) =>
    (points ?? cells.map((cell): [number, number] => [cell, cell])).map(([x, y]) => [x, y, 0]) as [
      number,
      number,
      number
    ][]
);
const getRiverPath = vi.fn(
  (points: [number, number, number][]) => `M${points.map(([x, y]) => `${x},${y}`).join("L")}Z`
);

beforeEach(() => {
  mocks.layerOn = true;
  document.body.innerHTML = '<svg id="map"><g id="rivers"></g></svg>';
  globalThis.pack = { rivers: [river(1, 0), river(2, 500)] } as never;
  globalThis.Rivers = { addMeandering, getRiverPath, getOffset: () => 1 } as never;
  addMeandering.mockClear();
  setViewportSize(100, 100);
  setViewportTransform(1, 0, 0);
  setEditedRiver(null);
});

test("panning culls rivers and reuses the elements already materialized", () => {
  drawRivers();
  const first = document.getElementById("river1");
  expect(first).not.toBeNull();
  expect(document.getElementById("river2")).toBeNull();

  ViewportLayers.renderNow();
  expect(document.getElementById("river1")).toBe(first);
  expect(addMeandering).toHaveBeenCalledTimes(2); // paths are built once, not per frame

  setViewportTransform(1, -500, 0);
  ViewportLayers.renderNow();
  expect(document.getElementById("river1")).toBeNull();
  expect(document.getElementById("river2")?.getAttribute("d")).toBe("M500,10L520,30L540,50Z");
  expect(addMeandering).toHaveBeenCalledTimes(2);
});

test("the edited river stays rendered off-screen and keeps its node across redraws", () => {
  drawRivers();
  setEditedRiver(2);
  const edited = document.getElementById("river2");
  expect(edited).not.toBeNull();

  pack.rivers[1].cells = [1, 2];
  pack.rivers[1].points = [
    [500, 10],
    [560, 60]
  ];
  redrawRiver(pack.rivers[1]);
  expect(document.getElementById("river2")).toBe(edited);
  expect(edited?.getAttribute("d")).toBe("M500,10L560,60Z");

  setEditedRiver(null);
  ViewportLayers.renderNow();
  expect(document.getElementById("river2")).toBeNull();
});

test("basin highlight paints every river and is reapplied to newly materialized ones", () => {
  drawRivers();
  expect(toggleBasinHighlight()).toBe(true);
  expect(document.getElementById("river1")?.getAttribute("fill")).toBe("#1f77b4");

  setViewportTransform(1, -500, 0);
  ViewportLayers.renderNow();
  expect(document.getElementById("river2")?.getAttribute("fill")).toBe("#ff7f0e");

  expect(toggleBasinHighlight()).toBe(false);
  expect(document.getElementById("river2")?.hasAttribute("fill")).toBe(false);
});

test("redraw picks up new courses and removed rivers", () => {
  drawRivers();
  const oldPath = document.getElementById("river1")!.getAttribute("d");

  pack.rivers[0].cells = [1, 2];
  pack.rivers[0].points = [
    [5, 15],
    [25, 35]
  ];
  pack.rivers = [pack.rivers[0]];
  drawRivers();
  expect(document.getElementById("river1")?.getAttribute("d")).not.toBe(oldPath);
  expect(document.getElementById("rivers")!.childElementCount).toBe(1);
  expect(getRiverBox(2)).toBeNull();
});

test("a river bounding box is available whether or not the river is on screen", () => {
  drawRivers();
  const box = getRiverBox(2)!;
  expect(box.x).toBe(499); // the course inflated by the river width
  expect(box.width).toBe(42);
});

test("erasing the layer drops the scene, not just the paths", () => {
  drawRivers();
  removeRivers();
  expect(document.getElementById("rivers")!.childElementCount).toBe(0);
  expect(getRiverBox(1)).toBeNull(); // a hidden layer holds no geometry, of this map or the previous one

  ViewportLayers.renderNow();
  expect(document.getElementById("rivers")!.childElementCount).toBe(0);
  drawRivers();
  expect(getRiverBox(1)).not.toBeNull();
});

test("full-map export materializes every river at once, leaving the live map culled", () => {
  drawRivers();
  const clone = document.getElementById("map")!.cloneNode(true) as SVGSVGElement;
  ViewportLayers.renderTo(clone);
  expect(clone.querySelectorAll("#rivers > path")).toHaveLength(2);
  expect(document.getElementById("river2")).toBeNull();
});

test("viewport rendering leaves a disabled layer empty", () => {
  drawRivers();
  mocks.layerOn = false;
  document.getElementById("rivers")!.replaceChildren(); // the layer registry erases the content when hidden
  ViewportLayers.renderNow();
  expect(document.getElementById("rivers")!.childElementCount).toBe(0);

  mocks.layerOn = true;
  ViewportLayers.renderNow();
  expect(document.getElementById("river1")).not.toBeNull();
});

test("rivers with mismatched points fall back to the cell course", () => {
  pack.rivers = [{ ...river(1, 0), points: [[0, 0]] } as River];
  drawRivers();
  expect(addMeandering).toHaveBeenCalledWith([1, 2, 3], undefined);
});
