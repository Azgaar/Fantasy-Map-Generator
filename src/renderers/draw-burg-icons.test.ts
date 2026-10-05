// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { setViewportSize, setViewportTransform } from "@/components/viewport";
import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";

const mocks = vi.hoisted(() => ({ layerOn: true }));
vi.mock("@/components/layers", () => ({ Layers: { isOn: () => mocks.layerOn } }));
// set art is anchored at its frame's corner here, so a group's translate is its shift alone
vi.mock("@/components/icon-sets", () => ({ IconSets: { setForId: () => undefined } }));
vi.mock("@/components/icons", () => ({
  Icons: {
    loadAll: vi.fn().mockResolvedValue(undefined),
    href: (id: string) => `#${id}`,
    anchoredBox: (id: string) => (/^(burgs|ports)-/.test(id) ? [0, 0, 1, 1] : null)
  }
}));

import "@/generators/styles";
import { drawBurgIcons } from "./draw-burg-icons";

beforeEach(() => {
  mocks.layerOn = true;
  setViewportSize(100, 100);
  setViewportTransform(1, 0, 0);
  (globalThis as Record<string, unknown>).TIME = false;
  document.body.innerHTML = `<svg id="map">
      <g id="burgIcons"></g>
    </svg>`;
  globalThis.pack = { burgs: [{}, { i: 1, group: "town", x: 10, y: 10 }] } as never;
  styles.burgIcons.groups.town.groups.icons.options.size = 3;
  styles.burgIcons.groups.town.groups.icons.options.icon = "burgs-atlas-circle";
  styles.burgIcons.groups.town.groups.anchors.options = { size: 3, icon: "ports-anchor" };
  options.map.burgs.groups = [{ name: "town", order: 0 }] as never;
});

test("drawBurgIcons styles groups from the store, ignoring stale DOM attrs", async () => {
  styles.burgIcons.groups.town.groups.icons.attrs.fill = "#123456";
  styles.burgIcons.groups.town.groups.icons.options.size = 3;

  await drawBurgIcons();
  const first = document.querySelector<SVGGElement>('#burgIcons > g#town > [data-group="icons"]')!;
  expect(first.getAttribute("fill")).toBe("#123456");

  // simulate the retired editor-writes-DOM model leaving a stale value
  first.setAttribute("fill", "#ff0000");
  styles.burgIcons.groups.town.groups.icons.attrs.fill = "#123456";

  await drawBurgIcons();
  const redrawn = document.querySelector<SVGGElement>('#burgIcons > g#town > [data-group="icons"]')!;
  expect(redrawn.getAttribute("fill")).toBe("#123456");
  expect(styles.burgIcons.groups.town.groups.icons.attrs.fill).toBe("#123456");
  expect(redrawn.getAttribute("font-size")).toBe("3%");
});

test("panning culls icons and anchors and repeated rendering produces the same markup", async () => {
  pack.burgs[1].port = 1;
  pack.burgs.push({ ...pack.burgs[1], i: 2, x: 500 });
  await drawBurgIcons();
  const icon = document.getElementById("burg1");
  expect(icon).not.toBeNull();
  expect(document.getElementById("anchor1")).not.toBeNull();
  expect(document.getElementById("burg2")).toBeNull();
  expect(document.getElementById("anchor2")).toBeNull();

  const markup = document.getElementById("burgIcons")!.innerHTML;
  ViewportLayers.renderNow();
  expect(document.getElementById("burgIcons")!.innerHTML).toBe(markup);
  setViewportTransform(1, -450, 0);
  ViewportLayers.renderNow();
  expect(document.getElementById("burg1")).toBeNull();
  expect(document.getElementById("anchor1")).toBeNull();
  expect(document.getElementById("burg2")).not.toBeNull();
  expect(document.getElementById("anchor2")).not.toBeNull();
});

test("full-map export includes offscreen burgs without changing the live viewport", async () => {
  pack.burgs.push({ ...pack.burgs[1], i: 2, x: 500, port: 1 });
  await drawBurgIcons();
  const clone = document.getElementById("map")!.cloneNode(true) as SVGSVGElement;
  ViewportLayers.renderTo(clone);
  expect(clone.querySelectorAll('#burgIcons [data-group="icons"] use')).toHaveLength(2);
  expect(clone.querySelector("#anchor2")).not.toBeNull();
  expect(document.getElementById("burg2")).toBeNull();
  expect(document.getElementById("anchor2")).toBeNull();
  ViewportLayers.renderTo(clone);
  expect(clone.querySelectorAll('#burgIcons [data-group="icons"] use')).toHaveLength(2);
});

test("redrawing applies relocation, port changes, deletion and replacement map data", async () => {
  await drawBurgIcons();
  pack.burgs[1].port = 1;
  await drawBurgIcons();
  expect(document.getElementById("anchor1")).not.toBeNull();
  pack.burgs[1].x = 500;
  await drawBurgIcons();
  expect(document.getElementById("burg1")).toBeNull();
  expect(document.getElementById("anchor1")).toBeNull();
  pack.burgs[1] = { ...pack.burgs[1], x: 50, port: 0 };
  ViewportLayers.renderNow();
  expect(document.getElementById("burg1")?.getAttribute("x")).toBe("50");
  expect(document.getElementById("anchor1")).toBeNull();
  pack.burgs[1].removed = true;
  await drawBurgIcons();
  ViewportLayers.renderNow();
  expect(document.getElementById("burg1")).toBeNull();
});

test("group order, fallback styles and empty groups survive culling and reassignment", async () => {
  options.map.burgs.groups.push({ name: "custom", order: -1 } as never);
  pack.burgs[1].group = "custom";
  pack.burgs[1].port = 1;
  await drawBurgIcons();
  expect(Array.from(document.querySelectorAll("#burgIcons > g"), group => group.id)).toEqual(["custom", "town"]);
  expect(document.querySelector('#burgIcons > #custom > [data-group="icons"]')?.getAttribute("font-size")).toBe("3%");
  expect(document.querySelector('#burgIcons > #custom > [data-group="anchors"] > #anchor1')).not.toBeNull();
  expect(document.querySelectorAll("#burgIcons > #town use")).toHaveLength(0);

  pack.burgs[1].group = "town";
  options.map.burgs.groups = options.map.burgs.groups.filter(group => group.name !== "custom");
  await drawBurgIcons();
  expect(document.querySelector("#burgIcons > #custom")).toBeNull();
  expect(document.querySelector('#burgIcons > #town > [data-group="icons"] > #burg1')).not.toBeNull();
  expect(document.querySelector('#burgIcons > #town > [data-group="anchors"] > #anchor1')).not.toBeNull();
});

test("symbol and size edits apply to offscreen icons and account for overflowing artwork", async () => {
  pack.burgs[1].x = 200;
  pack.burgs[1].port = 1;
  await drawBurgIcons();
  expect(document.getElementById("burg1")).toBeNull();
  styles.burgIcons.groups.town.groups.icons.options.size = 20;
  styles.burgIcons.groups.town.groups.icons.options.icon = "burgs-watabou-city";
  await drawBurgIcons();
  expect(document.getElementById("burg1")?.getAttribute("href")).toBe("#burgs-watabou-city");
  expect(document.getElementById("anchor1")).toBeNull();
  styles.burgIcons.groups.town.groups.anchors.options.size = 20;
  await drawBurgIcons();
  expect(document.getElementById("anchor1")).not.toBeNull();
});

test("viewport reconciliation does not repopulate a hidden layer", async () => {
  await drawBurgIcons();
  mocks.layerOn = false;
  document.getElementById("burgIcons")!.replaceChildren();
  ViewportLayers.renderNow();
  expect(document.querySelectorAll("#burgIcons use")).toHaveLength(0);
  mocks.layerOn = true;
  await drawBurgIcons();
  expect(document.getElementById("burg1")).not.toBeNull();
});

test("loaded legacy markup is replaced by the current icon projection", async () => {
  pack.burgs[1].port = 1;
  document.getElementById("burgIcons")!.innerHTML =
    '<g id="town" data-group="town"><g data-group="icons"><circle id="burg1" data-id="1" r="5"/><use id="burg99" data-id="99"/></g><g data-group="anchors"><use id="anchor1" data-id="1" width="8" height="8" transform="translate(20,20)"/></g></g>';
  await drawBurgIcons();
  expect(document.querySelector("#burgIcons circle")).toBeNull();
  expect(document.querySelectorAll('#burgIcons [data-group="icons"] use')).toHaveLength(1);
  expect(document.getElementById("burg1")?.tagName).toBe("use");
  const anchor = document.getElementById("anchor1")!;
  expect(anchor.getAttribute("transform")).toBeNull();
  expect(anchor.getAttribute("width")).toBe("1em");
  expect(anchor.getAttribute("height")).toBe("1em");
  expect(anchor.getAttribute("x")).toBe("10");
});

test("markup preserves special characters in group names, symbols and styles", async () => {
  const name = 'town & "port"';
  const icon = 'burgs-&"circle';
  const fill = 'url(#pattern-&"fill)';
  options.map.burgs.groups[0].name = name;
  pack.burgs[1].group = name;
  styles.burgIcons.groups.town.groups.icons.options.icon = icon;
  styles.burgIcons.groups.town.groups.icons.attrs.fill = fill;
  styles.burgIcons.groups.town.groups.icons.attrs.filter = null;

  await drawBurgIcons();
  const group = document.querySelector("#burgIcons > g")!;
  const icons = group.querySelector('[data-group="icons"]')!;
  expect(group.id).toBe(name);
  expect(group.getAttribute("data-group")).toBe(name);
  expect(icons.getAttribute("data-icon")).toBe(icon);
  expect(icons.getAttribute("fill")).toBe(fill);
  expect(icons.hasAttribute("filter")).toBe(false);
  expect(document.getElementById("burg1")?.getAttribute("href")).toBe(`#${icon}`);
});

test("anchor symbol and shifts survive redraw, relocation and full-map rendering", async () => {
  pack.burgs[1].port = 1;
  Object.assign(styles.burgIcons.groups.town.groups.anchors.options, { icon: "ports-harbor", dx: -2, dy: 1 });
  await drawBurgIcons();
  const anchor = document.getElementById("anchor1")!;
  expect(anchor.getAttribute("href")).toBe("#ports-harbor");
  expect(anchor.getAttribute("x")).toBe("10");
  expect(anchor.getAttribute("y")).toBe("10");
  expect(anchor.parentElement?.getAttribute("style")).toBe("transform: translate(-2em, 1em)");
  expect(document.getElementById("burg1")?.getAttribute("x")).toBe("10");
  expect(pack.burgs[1].x).toBe(10);

  pack.burgs[1].x = 500;
  await drawBurgIcons();
  const clone = document.getElementById("map")!.cloneNode(true) as SVGSVGElement;
  ViewportLayers.renderTo(clone);
  expect(clone.querySelector("#anchor1")?.getAttribute("x")).toBe("500");
  expect(clone.querySelector("#anchor1")?.getAttribute("href")).toBe("#ports-harbor");
  expect(document.getElementById("anchor1")).toBeNull();
});

test("viewport culling uses the shifted anchor position", async () => {
  pack.burgs[1].port = 1;
  pack.burgs[1].x = 500;
  Object.assign(styles.burgIcons.groups.town.groups.anchors.options, { dx: -160, dy: 0 });
  await drawBurgIcons();
  expect(document.getElementById("burg1")).toBeNull();
  expect(document.getElementById("anchor1")?.getAttribute("x")).toBe("500");
  pack.burgs[1].x = 10;
  await drawBurgIcons();
  expect(document.getElementById("burg1")).not.toBeNull();
  expect(document.getElementById("anchor1")).toBeNull();
});

test("icons follow the layer font through the zoom and cull by their zoomed size", async () => {
  pack.burgs[1].port = 1;
  Object.assign(styles.burgIcons.groups.town.groups.anchors.options, { dx: 0, dy: 0 });
  await drawBurgIcons();
  expect(document.querySelector('[data-group="anchors"]')?.hasAttribute("style")).toBe(false);

  // at scale 4 the view (with overscan) starts at x = -20 and the icon em is 3% of 96.39px = 2.89 map units,
  // so the padding is 2 * (2.89 + stroke 1) = 7.78 and a burg at -28 is out; a map-fixed 3-unit em would keep it
  styles.burgIcons.groups.town.groups.icons.attrs["stroke-width"] = 1;
  pack.burgs[1].x = -28;
  setViewportTransform(4, 0, 0);
  ViewportLayers.renderNow();
  expect(document.getElementById("burg1")).toBeNull();
  setViewportTransform(1, 0, 0);
  ViewportLayers.renderNow();
  expect(document.getElementById("burg1")).not.toBeNull();
});

test("an icon from outside the burg sets is a 1em box centred on the burg", async () => {
  styles.burgIcons.groups.town.groups.icons.options.icon = "glyph-1f3f0";
  await drawBurgIcons();
  const icons = document.querySelector('#burgIcons [data-group="icons"]')!;
  expect(icons.getAttribute("style")).toBe("transform: translate(-0.5em, -0.5em)");
  const burg = document.getElementById("burg1")!;
  expect(burg.getAttribute("href")).toBe("#glyph-1f3f0");
  expect([burg.getAttribute("width"), burg.getAttribute("height")]).toEqual(["1em", "1em"]);
});

test("clearing burg and port icons keeps them absent through redraw and export", async () => {
  pack.burgs[1].port = 1;
  await drawBurgIcons();
  styles.burgIcons.groups.town.groups.icons.options.icon = "";
  styles.burgIcons.groups.town.groups.anchors.options.icon = "";
  await drawBurgIcons();
  expect(document.querySelectorAll("#burgIcons use")).toHaveLength(0);
  ViewportLayers.renderNow();
  const clone = document.getElementById("map")!.cloneNode(true) as SVGSVGElement;
  ViewportLayers.renderTo(clone);
  expect(clone.querySelectorAll("#burgIcons use")).toHaveLength(0);
});
