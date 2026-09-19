// Browser-mode tests (vitest.browser.config.ts) for the DOM half: applyStyles addresses
// [data-layer]/[data-group], writes attrs, removes nulls, and never writes options.
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/components/layers", () => ({ Layers: { draw: vi.fn() } }));

import { Layers } from "@/components/layers";
import { Styles } from "./styles";

const SVG = "http://www.w3.org/2000/svg";

function mount(layer: string, groups: string[] = []): SVGGElement {
  const el = document.createElementNS(SVG, "g");
  el.setAttribute("data-layer", layer);
  for (const g of groups) {
    const child = document.createElementNS(SVG, "g");
    child.setAttribute("data-group", g);
    el.append(child);
  }
  document.body.append(el);
  return el;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.mocked(Layers.draw).mockClear();
});

describe("applyStyles", () => {
  test("writes attrs to the layer and its groups, removes nulls, skips options", () => {
    const el = mount("rivers");
    styles.rivers.attrs.fill = "#123456";
    styles.rivers.attrs.filter = null;
    el.setAttribute("filter", "url(#stale)");
    Styles.apply("rivers");
    expect(el.getAttribute("fill")).toBe("#123456");
    expect(el.hasAttribute("filter")).toBe(false);
    expect(Layers.draw).toHaveBeenCalledWith("rivers");

    const routes = mount("routes", ["roads", "trails", "searoutes"]);
    styles.routes.groups.roads.attrs.stroke = "#803a2b";
    Styles.apply("routes");
    expect(routes.querySelector('[data-group="roads"]')?.getAttribute("stroke")).toBe("#803a2b");
  });

  test("options never reach the DOM", () => {
    const el = mount("markers");
    Styles.apply("markers");
    expect(el.hasAttribute("rescale")).toBe(false);
    expect(el.hasAttribute("options")).toBe(false);
  });

  test("a dynamic group present in styles but absent from the DOM is skipped", () => {
    mount("labels");
    styles.labels.groups.capital = structuredClone(Object.values(styles.labels.groups)[0]);
    expect(() => Styles.apply("labels")).not.toThrow();
  });

  test("burg icon and anchor parts are addressed through their group element", () => {
    const el = mount("burgIcons");
    const group = document.createElementNS(SVG, "g");
    group.setAttribute("data-group", "capital");
    for (const part of ["icons", "anchors"]) {
      const g = document.createElementNS(SVG, "g");
      g.setAttribute("data-group", part);
      group.append(g);
    }
    el.append(group);
    styles.burgIcons.groups.capital.groups.icons.attrs.fill = "#111111";
    styles.burgIcons.groups.capital.groups.anchors.attrs.fill = "#222222";
    Styles.apply("burgIcons");
    expect(el.querySelector('[data-group="capital"] > [data-group="icons"]')?.getAttribute("fill")).toBe("#111111");
    expect(el.querySelector('[data-group="capital"] > [data-group="anchors"]')?.getAttribute("fill")).toBe("#222222");
  });

  test("a missing layer element is a no-op, the rest still apply", () => {
    const el = mount("rivers");
    styles.rivers.attrs.fill = "#654321";
    expect(() => Styles.apply("compass", "rivers")).not.toThrow();
    expect(el.getAttribute("fill")).toBe("#654321");
  });

  test("writeStyles writes attrs without drawing", () => {
    const el = mount("rivers");
    styles.rivers.attrs.fill = "hotpink";
    Styles.write("rivers");
    expect(el.getAttribute("fill")).toBe("hotpink");
    expect(Layers.draw).not.toHaveBeenCalled();
  });
});

describe("writeAttr", () => {
  test("sets or removes the one attribute at a store path, through groups and records", () => {
    const rivers = mount("rivers");
    styles.rivers.attrs.fill = "#abcdef";
    Styles.writeAttr(["rivers", "attrs", "fill"]);
    expect(rivers.getAttribute("fill")).toBe("#abcdef");
    styles.rivers.attrs.filter = null;
    rivers.setAttribute("filter", "url(#stale)");
    Styles.writeAttr(["rivers", "attrs", "filter"]);
    expect(rivers.hasAttribute("filter")).toBe(false);

    const routes = mount("routes", ["roads"]);
    styles.routes.groups.roads.attrs.stroke = "#111111";
    Styles.writeAttr(["routes", "groups", "roads", "attrs", "stroke"]);
    expect(routes.querySelector('[data-group="roads"]')?.getAttribute("stroke")).toBe("#111111");

    const states = mount("states", ["statesHalo"]);
    styles.states.groups.statesHalo.attrs.opacity = 0.3;
    Styles.writeAttr(["states", "groups", "statesHalo", "attrs", "opacity"]);
    expect(states.querySelector('[data-group="statesHalo"]')?.getAttribute("opacity")).toBe("0.3");
    expect(Layers.draw).not.toHaveBeenCalled();
  });
});
