// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { setViewportSize, setViewportTransform } from "@/components/viewport";
import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";

const mocks = vi.hoisted(() => ({ layerOn: true }));
vi.mock("@/components/layers", () => ({ Layers: { isOn: () => mocks.layerOn } }));

import "@/generators/styles";
import { drawBurgIcons } from "./draw-burg-icons";

beforeEach(() => {
  mocks.layerOn = true;
  setViewportSize(100, 100);
  setViewportTransform(1, 0, 0);
  (globalThis as Record<string, unknown>).TIME = false;
  document.body.innerHTML = `<svg id="map">
      <g id="icons"><g id="burgIcons"></g><g id="anchors"></g></g>
    </svg>`;
  globalThis.pack = { burgs: [{}, { i: 1, group: "town", x: 10, y: 10 }] } as never;
  styles.burgIcons.burgIcons.groups.town.options.size = 3;
  styles.burgIcons.burgIcons.groups.town.options.icon = "#icon-circle";
  styles.burgIcons.anchors.groups.town.options.size = 3;
  options.map.burgs.groups = [{ name: "town", order: 0 }] as never;
});

test("drawBurgIcons styles groups from the store, ignoring stale DOM attrs", () => {
  styles.burgIcons.burgIcons.groups.town.attrs.fill = "#123456";
  styles.burgIcons.burgIcons.groups.town.options.size = 3;

  drawBurgIcons();
  const first = document.querySelector<SVGGElement>("#burgIcons > g#town")!;
  expect(first.getAttribute("fill")).toBe("#123456");

  // simulate the retired editor-writes-DOM model leaving a stale value
  first.setAttribute("fill", "#ff0000");
  styles.burgIcons.burgIcons.groups.town.attrs.fill = "#123456";

  drawBurgIcons();
  const redrawn = document.querySelector<SVGGElement>("#burgIcons > g#town")!;
  expect(redrawn.getAttribute("fill")).toBe("#123456");
  expect(styles.burgIcons.burgIcons.groups.town.attrs.fill).toBe("#123456");
  expect(redrawn.getAttribute("font-size")).toBe("3");
});

test("panning culls icons and anchors and repeated rendering produces the same markup", () => {
  pack.burgs[1].port = 1;
  pack.burgs.push({ ...pack.burgs[1], i: 2, x: 500 });
  drawBurgIcons();
  const icon = document.getElementById("burg1");
  expect(icon).not.toBeNull();
  expect(document.getElementById("anchor1")).not.toBeNull();
  expect(document.getElementById("burg2")).toBeNull();
  expect(document.getElementById("anchor2")).toBeNull();

  const markup = document.getElementById("icons")!.innerHTML;
  ViewportLayers.renderNow();
  expect(document.getElementById("icons")!.innerHTML).toBe(markup);
  setViewportTransform(1, -450, 0);
  ViewportLayers.renderNow();
  expect(document.getElementById("burg1")).toBeNull();
  expect(document.getElementById("anchor1")).toBeNull();
  expect(document.getElementById("burg2")).not.toBeNull();
  expect(document.getElementById("anchor2")).not.toBeNull();
});

test("full-map export includes offscreen burgs without changing the live viewport", () => {
  pack.burgs.push({ ...pack.burgs[1], i: 2, x: 500, port: 1 });
  drawBurgIcons();
  const clone = document.getElementById("map")!.cloneNode(true) as SVGSVGElement;
  ViewportLayers.renderTo(clone);
  expect(clone.querySelectorAll("#burgIcons use")).toHaveLength(2);
  expect(clone.querySelector("#anchor2")).not.toBeNull();
  expect(document.getElementById("burg2")).toBeNull();
  expect(document.getElementById("anchor2")).toBeNull();
  ViewportLayers.renderTo(clone);
  expect(clone.querySelectorAll("#burgIcons use")).toHaveLength(2);
});

test("redrawing applies relocation, port changes, deletion and replacement map data", () => {
  drawBurgIcons();
  pack.burgs[1].port = 1;
  drawBurgIcons();
  expect(document.getElementById("anchor1")).not.toBeNull();
  pack.burgs[1].x = 500;
  drawBurgIcons();
  expect(document.getElementById("burg1")).toBeNull();
  expect(document.getElementById("anchor1")).toBeNull();
  pack.burgs[1] = { ...pack.burgs[1], x: 50, port: 0 };
  ViewportLayers.renderNow();
  expect(document.getElementById("burg1")?.getAttribute("x")).toBe("50");
  expect(document.getElementById("anchor1")).toBeNull();
  pack.burgs[1].removed = true;
  drawBurgIcons();
  ViewportLayers.renderNow();
  expect(document.getElementById("burg1")).toBeNull();
});

test("group order, fallback styles and empty groups survive culling and reassignment", () => {
  options.map.burgs.groups.push({ name: "custom", order: -1 } as never);
  pack.burgs[1].group = "custom";
  pack.burgs[1].port = 1;
  drawBurgIcons();
  expect(Array.from(document.querySelectorAll("#burgIcons > g"), group => group.id)).toEqual(["custom", "town"]);
  expect(document.querySelector("#burgIcons > #custom")?.getAttribute("font-size")).toBe("3");
  expect(document.querySelector("#anchors > #custom > #anchor1")).not.toBeNull();
  expect(document.querySelector("#burgIcons > #town")?.childElementCount).toBe(0);

  pack.burgs[1].group = "town";
  options.map.burgs.groups = options.map.burgs.groups.filter(group => group.name !== "custom");
  drawBurgIcons();
  expect(document.querySelector("#burgIcons > #custom")).toBeNull();
  expect(document.querySelector("#burgIcons > #town > #burg1")).not.toBeNull();
  expect(document.querySelector("#anchors > #town > #anchor1")).not.toBeNull();
});

test("symbol and size edits apply to offscreen icons and account for overflowing artwork", () => {
  pack.burgs[1].x = 200;
  pack.burgs[1].port = 1;
  drawBurgIcons();
  expect(document.getElementById("burg1")).toBeNull();
  styles.burgIcons.burgIcons.groups.town.options.size = 20;
  styles.burgIcons.burgIcons.groups.town.options.icon = "#icon-watabou-city";
  drawBurgIcons();
  expect(document.getElementById("burg1")?.getAttribute("href")).toBe("#icon-watabou-city");
  expect(document.getElementById("anchor1")).toBeNull();
  styles.burgIcons.anchors.groups.town.options.size = 20;
  drawBurgIcons();
  expect(document.getElementById("anchor1")).not.toBeNull();
});

test("viewport reconciliation does not repopulate a hidden layer", () => {
  drawBurgIcons();
  mocks.layerOn = false;
  document.getElementById("burgIcons")!.replaceChildren();
  document.getElementById("anchors")!.replaceChildren();
  ViewportLayers.renderNow();
  expect(document.querySelectorAll("#icons use")).toHaveLength(0);
  mocks.layerOn = true;
  drawBurgIcons();
  expect(document.getElementById("burg1")).not.toBeNull();
});

test("loaded legacy markup is replaced by the current icon projection", () => {
  pack.burgs[1].port = 1;
  document.getElementById("burgIcons")!.innerHTML =
    '<g id="town"><circle id="burg1" data-id="1" r="5"/><use id="burg99" data-id="99"/></g>';
  document.getElementById("anchors")!.innerHTML =
    '<g id="town"><use id="anchor1" data-id="1" width="8" height="8" transform="translate(20,20)"/></g>';
  drawBurgIcons();
  expect(document.querySelector("#burgIcons circle")).toBeNull();
  expect(document.querySelectorAll("#burgIcons use")).toHaveLength(1);
  expect(document.getElementById("burg1")?.tagName).toBe("use");
  const anchor = document.getElementById("anchor1")!;
  expect(anchor.getAttribute("transform")).toBeNull();
  expect(anchor.getAttribute("width")).toBeNull();
  expect(anchor.getAttribute("height")).toBeNull();
  expect(anchor.getAttribute("x")).toBe("10");
});

test("markup preserves special characters in group names, symbols and styles", () => {
  const name = 'town & "port"';
  const icon = '#icon-&"circle';
  const fill = 'url(#pattern-&"fill)';
  options.map.burgs.groups[0].name = name;
  pack.burgs[1].group = name;
  styles.burgIcons.burgIcons.groups.town.options.icon = icon;
  styles.burgIcons.burgIcons.groups.town.attrs.fill = fill;
  styles.burgIcons.burgIcons.groups.town.attrs.filter = null;

  drawBurgIcons();
  const group = document.querySelector("#burgIcons > g")!;
  expect(group.id).toBe(name);
  expect(group.getAttribute("data-group")).toBe(name);
  expect(group.getAttribute("data-icon")).toBe(icon);
  expect(group.getAttribute("fill")).toBe(fill);
  expect(group.hasAttribute("filter")).toBe(false);
  expect(document.getElementById("burg1")?.getAttribute("href")).toBe(icon);
});
