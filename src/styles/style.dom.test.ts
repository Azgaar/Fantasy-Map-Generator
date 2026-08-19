import { afterEach, describe, expect, test, vi } from "vitest";
import type { Layer } from "@/components/layers";
import { Style, setActiveStyle } from "./style";

// "map" isn't a registry layer, so the redraw scheduler's dynamic `import("@/components/layers")`
// must not receive it; Layers.draw is mocked here purely to assert that. The scheduler drops any
// batch whose instance is no longer the map style, so the setAttr() calls other tests make on
// throwaway instances (to populate a tree they then read via applyTo() directly) can never reach
// this mock - `has`/`get` throw by default, and each redraw test installs the behaviour it needs.
const layersDraw = vi.fn();
const layersHas = vi.fn((_id: string): boolean => {
  throw new Error("Layers.has: unexpected scheduler flush - no test installed a mock for it");
});
const layersGet = vi.fn((_id: string): Layer => {
  throw new Error("not registered in this mock");
});
vi.mock("@/components/layers", () => ({
  Layers: {
    has: (id: string) => layersHas(id),
    get: (id: string) => layersGet(id),
    draw: (...ids: string[]) => layersDraw(...ids)
  }
}));

afterEach(() => {
  layersDraw.mockClear();
  layersHas.mockReset().mockImplementation(() => {
    throw new Error("Layers.has: unexpected scheduler flush - no test installed a mock for it");
  });
  layersGet.mockReset().mockImplementation(() => {
    throw new Error("not registered in this mock");
  });
});

// Runs under vitest.browser.config.ts (real chromium + real DOM), NOT the default node config -
// applyTo/writeNode/resolveElement need querySelector/createElementNS/setAttribute, which the
// node env's minimal document stub (test-setup.ts) doesn't provide. See vitest.config.ts's
// `exclude: [..., "**/*.dom.test.ts"]`.
//
// applyTo(layer) only reads `layer.id` and calls `layer.getEl()`, so a minimal stand-in avoids
// pulling in the real (renderer-heavy) Layer class as a runtime import - only its type is used.
function fakeLayer(id: string, root: Element): Layer {
  return { id, getEl: () => root } as unknown as Layer;
}

function svg(tag: string, id: string, parent?: Element): SVGGElement {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag) as unknown as SVGGElement;
  el.setAttribute("id", id);
  parent?.appendChild(el);
  return el;
}

describe("applyTo - DOM writes", () => {
  test("null removes the attribute; non-null sets it", () => {
    const root = svg("g", "routes");
    root.setAttribute("opacity", "0.5");
    root.setAttribute("mask", "url(#old)");

    const style = Style.fromJSON({ routes: { attrs: { opacity: null, mask: "url(#land)" } } });
    style.applyTo(fakeLayer("routes", root));

    expect(root.hasAttribute("opacity")).toBe(false);
    expect(root.getAttribute("mask")).toBe("url(#land)");
  });

  test("a declared child missing from the DOM is skipped - no element is created", () => {
    const root = svg("g", "routes");
    svg("g", "roads", root); // only "roads" exists; "trails" does not

    const style = Style.fromJSON({
      routes: { children: { roads: { attrs: { stroke: "#d06324" } }, trails: { attrs: { stroke: "#fff" } } } }
    });
    style.applyTo(fakeLayer("routes", root));

    expect(root.children.length).toBe(1);
    expect(root.querySelector("#roads")?.getAttribute("stroke")).toBe("#d06324");
    expect(root.querySelector("#trails")).toBeNull();
  });

  test(":scope prevents matching a same-id element nested deeper than a direct child", () => {
    const root = svg("g", "routes");
    const wrapper = svg("g", "wrapper", root);
    const nestedRoads = svg("g", "roads", wrapper); // NOT a direct child of #routes

    const style = Style.fromJSON({ routes: { children: { roads: { attrs: { stroke: "#d06324" } } } } });
    style.applyTo(fakeLayer("routes", root));

    expect(nestedRoads.hasAttribute("stroke")).toBe(false);
  });

  // the registry's icons layer is <g id="icons">, which nests both container groups; the
  // `burgIcons` and `anchors` style layers are mapped onto them here and nowhere else
  test("the icons layer maps its two style layers onto their container groups", () => {
    const root = svg("g", "icons");
    const burgIcons = svg("g", "burgIcons", root);
    const anchors = svg("g", "anchors", root);
    svg("g", "capital", burgIcons);
    const anchorCapital = svg("g", "capital", anchors);

    const style = Style.fromJSON({});
    style.setAttr("anchors", "opacity", 0.5);
    style.setAttr("anchors", "capital", "fill", "#ffffff");
    style.applyTo(fakeLayer("burgIcons", root));

    expect(anchors.getAttribute("opacity")).toBe("0.5");
    expect(anchorCapital.getAttribute("fill")).toBe("#ffffff");
    expect(root.hasAttribute("opacity")).toBe(false); // never the layer element itself
    expect(burgIcons.querySelector("#capital")?.hasAttribute("fill")).toBe(false);
  });

  test("a hostile group name (leading digit, embedded quote) is skipped, not thrown, when absent", () => {
    const root = svg("g", "icons");
    svg("g", "anchors", root);

    const style = Style.fromJSON({});
    style.setAttr("anchors", '1 bad"name', "fill", "#ffffff");

    expect(() => style.applyTo(fakeLayer("burgIcons", root))).not.toThrow();
  });

  test("a hostile group name that DOES exist in the DOM is still matched and written correctly", () => {
    const root = svg("g", "icons");
    const anchors = svg("g", "anchors", root);
    const hostile = svg("g", "placeholder", anchors);
    hostile.setAttribute("id", '1 bad"name');

    const style = Style.fromJSON({});
    style.setAttr("anchors", '1 bad"name', "fill", "#ffffff");
    style.applyTo(fakeLayer("burgIcons", root));

    expect(hostile.getAttribute("fill")).toBe("#ffffff");
  });

  test("a labels child key resolves to the group's labels-<key> element id", () => {
    const root = svg("g", "labels");
    const capital = svg("g", "labels-capital", root);

    const style = Style.fromJSON({});
    style.setAttr("labels", "capital", "fill", "#123456");
    style.applyTo(fakeLayer("labels", root));

    expect(capital.getAttribute("fill")).toBe("#123456");
  });

  test("a layer absent from the tree is a no-op - nothing is touched, nothing thrown", () => {
    const root = svg("g", "routes");
    root.setAttribute("opacity", "1");

    const style = Style.fromJSON({});
    expect(() => style.applyTo(fakeLayer("routes", root))).not.toThrow();
    expect(root.getAttribute("opacity")).toBe("1");
  });
});

describe('setAttr("map", ...) redraw routing', () => {
  test("repaints the svg root via applyMapStyle, and never reaches Layers.draw", async () => {
    layersDraw.mockClear();
    const mapEl = svg("svg", "map");
    document.body.appendChild(mapEl);

    const style = Style.fromJSON({});
    setActiveStyle(style); // the scheduler only flushes a batch whose instance is still the map style
    layersHas.mockImplementation(() => false);
    style.setAttr("map", "fill", "#111111");

    // the scheduler's rAF callback awaits a dynamic import, so the write can land any number of
    // ticks later (a cold module load loses that race) - poll the DOM instead of counting ticks
    await vi.waitFor(() => expect(mapEl.getAttribute("fill")).toBe("#111111"));
    expect(layersDraw).not.toHaveBeenCalledWith("map");

    document.body.removeChild(mapEl);
  });
});

describe("setAttr(<real layer id>, ...) redraw routing", () => {
  // draw() itself never applies style (components/layers.ts) - the scheduler is the sole path
  // that pushes a live setAttr/setOptions edit to the DOM, so it needs its own coverage rather
  // than relying on the "map" test above (which exercises applyMapStyle, a different branch).
  test("applies the edit to the DOM via Layers.get before asking Layers.draw to redraw it", async () => {
    const root = svg("g", "routes");
    document.body.appendChild(root);
    layersHas.mockImplementation((id: string) => id === "routes");
    layersGet.mockImplementation((id: string) => fakeLayer(id, root));

    const style = Style.fromJSON({});
    setActiveStyle(style);
    style.setAttr("routes", "opacity", 0.42);

    await vi.waitFor(() => expect(root.getAttribute("opacity")).toBe("0.42"));
    expect(layersDraw).toHaveBeenCalledWith("routes");

    document.body.removeChild(root);
  });
});

describe("a stale instance never repaints the map", () => {
  // setAttr schedules a redraw for the instance it was called on; by the time the frame runs, a
  // preset switch or a map load may have made a different instance the map style. The queued
  // batch must be dropped, not applied over the live one.
  test("editing an instance that is no longer the map style leaves the DOM alone", async () => {
    const root = svg("g", "routes");
    root.setAttribute("opacity", "1");
    document.body.appendChild(root);
    layersHas.mockImplementation((id: string) => id === "routes");
    layersGet.mockImplementation((id: string) => fakeLayer(id, root));

    const stale = Style.fromJSON({});
    setActiveStyle(stale);
    stale.setAttr("routes", "opacity", 0.42); // queued against `stale`

    const live = Style.fromJSON({});
    setActiveStyle(live); // ...and superseded before the frame runs

    // give the scheduler its frame (and the dynamic import that follows it) room to run
    await new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));

    expect(root.getAttribute("opacity")).toBe("1");
    expect(layersDraw).not.toHaveBeenCalled();

    document.body.removeChild(root);
  });
});
