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

  test("burg icon and anchor groups are addressed through their containers", () => {
    const el = mount("burgIcons", ["burgIcons", "anchors"]);
    for (const container of el.children) {
      const g = document.createElementNS(SVG, "g");
      g.setAttribute("data-group", "capital");
      container.append(g);
    }
    styles.burgIcons.burgIcons.groups.capital.attrs.fill = "#111111";
    styles.burgIcons.anchors.groups.capital.attrs.fill = "#222222";
    Styles.apply("burgIcons");
    expect(el.querySelector('[data-group="burgIcons"] > [data-group="capital"]')?.getAttribute("fill")).toBe("#111111");
    expect(el.querySelector('[data-group="anchors"] > [data-group="capital"]')?.getAttribute("fill")).toBe("#222222");
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
