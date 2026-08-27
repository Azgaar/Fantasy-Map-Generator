// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

// fonts populates the font selector at import time, which needs the real app dom
vi.mock("@/services/fonts", () => ({ getUsedFonts: vi.fn(), loadFontsAsDataURI: vi.fn() }));

import { flattenSymbolReferences, relocateRootFilter } from "./export";

const SVG_NS = "http://www.w3.org/2000/svg";

function makeSymbolSvg(
  symbolAttrs: Record<string, string>,
  useAttrs: Record<string, string>,
  groupAttrs: Record<string, string> = {}
): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  const defs = document.createElementNS(SVG_NS, "defs");
  const symbol = document.createElementNS(SVG_NS, "symbol");
  symbol.id = "icon-test";
  for (const [key, value] of Object.entries(symbolAttrs)) symbol.setAttribute(key, value);
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("r", "5");
  symbol.appendChild(circle);
  defs.appendChild(symbol);
  svg.appendChild(defs);

  const group = document.createElementNS(SVG_NS, "g");
  for (const [key, value] of Object.entries(groupAttrs)) group.setAttribute(key, value);
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", "#icon-test");
  for (const [key, value] of Object.entries(useAttrs)) use.setAttribute(key, value);
  group.appendChild(use);
  svg.appendChild(group);
  return svg;
}

function makeSvg(rootFilter: string | null, withViewbox = true): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  if (rootFilter) svg.setAttribute("filter", rootFilter);
  const defs = document.createElementNS(SVG_NS, "defs");
  for (const id of ["filter-tint", "dropShadow01"]) {
    const filter = document.createElementNS(SVG_NS, "filter");
    filter.id = id;
    defs.appendChild(filter);
  }
  svg.appendChild(defs);
  if (withViewbox) {
    const viewbox = document.createElementNS(SVG_NS, "g");
    viewbox.id = "viewbox";
    svg.appendChild(viewbox);
  }
  return svg;
}

describe("relocateRootFilter", () => {
  it("moves the filter attribute from the root svg to the #viewbox group", () => {
    const svg = makeSvg("url(#filter-tint)");
    relocateRootFilter(svg);
    expect(svg.getAttribute("filter")).toBeNull();
    expect(svg.querySelector("#viewbox")?.getAttribute("filter")).toBe("url(#filter-tint)");
  });

  it("gives every filter an explicit region covering the viewport", () => {
    const svg = makeSvg("url(#filter-tint)");
    relocateRootFilter(svg);
    for (const id of ["filter-tint", "dropShadow01"]) {
      const filter = svg.querySelector(`#${id}`)!;
      expect(filter.getAttribute("filterUnits")).toBe("userSpaceOnUse");
      expect(filter.getAttribute("x")).toBe("0");
      expect(filter.getAttribute("y")).toBe("0");
      expect(filter.getAttribute("width")).toBe("100%");
      expect(filter.getAttribute("height")).toBe("100%");
    }
  });

  it("leaves other filters untouched when the root svg has no filter", () => {
    const svg = makeSvg(null);
    relocateRootFilter(svg);
    expect(svg.querySelector("#dropShadow01")?.getAttribute("filterUnits")).toBeNull();
  });

  it("does nothing when the root svg has no filter", () => {
    const svg = makeSvg(null);
    relocateRootFilter(svg);
    expect(svg.getAttribute("filter")).toBeNull();
    expect(svg.querySelector("#viewbox")?.getAttribute("filter")).toBeNull();
  });

  it("keeps the root filter when there is no #viewbox to move it to", () => {
    const svg = makeSvg("url(#filter-tint)", false);
    relocateRootFilter(svg);
    expect(svg.getAttribute("filter")).toBe("url(#filter-tint)");
  });
});

describe("flattenSymbolReferences", () => {
  const iconSymbol = { viewBox: "0 0 10 10", width: "1em", height: "1em", overflow: "visible" };

  it("converts an em-sized symbol use into a transform scaled by the group font-size", () => {
    const svg = makeSymbolSvg(iconSymbol, { x: "100", y: "50" }, { "font-size": "4" });
    flattenSymbolReferences(svg);
    const use = svg.querySelector("use")!;
    expect(use.getAttribute("transform")).toBe("translate(100,50) scale(0.4)");
    expect(use.getAttribute("x")).toBeNull();
    expect(use.getAttribute("y")).toBeNull();
  });

  it("resolves the em size from an inlined font shorthand style", () => {
    const svg = makeSymbolSvg(iconSymbol, { x: "10", y: "10" }, { style: 'font:0.5px "Times New Roman";' });
    flattenSymbolReferences(svg);
    expect(svg.querySelector("use")!.getAttribute("transform")).toBe("translate(10,10) scale(0.05)");
  });

  it("replaces the symbol with a plain group without sizing attributes", () => {
    const svg = makeSymbolSvg(iconSymbol, { x: "0", y: "0" }, { "font-size": "4" });
    flattenSymbolReferences(svg);
    expect(svg.querySelector("symbol")).toBeNull();
    const g = svg.querySelector("defs > g#icon-test")!;
    expect(g.getAttribute("viewBox")).toBeNull();
    expect(g.getAttribute("width")).toBeNull();
    expect(g.querySelector("circle")).not.toBeNull();
  });

  it("uses explicit width and height from the use element when present", () => {
    const svg = makeSymbolSvg({ viewBox: "0 0 100 100" }, { x: "10", y: "20", width: "30", height: "30" });
    flattenSymbolReferences(svg);
    const use = svg.querySelector("use")!;
    expect(use.getAttribute("transform")).toBe("translate(10,20) scale(0.3)");
    expect(use.getAttribute("width")).toBeNull();
    expect(use.getAttribute("height")).toBeNull();
  });

  it("offsets the translation for a viewBox with a nonzero origin", () => {
    const svg = makeSymbolSvg({ viewBox: "-3 -8 65 80" }, { x: "0", y: "0", width: "65", height: "80" });
    flattenSymbolReferences(svg);
    expect(svg.querySelector("use")!.getAttribute("transform")).toBe("translate(3,8) scale(1)");
  });

  it("centers content with uniform scale when aspect ratios differ", () => {
    const svg = makeSymbolSvg({ viewBox: "0 0 10 20" }, { x: "0", y: "0", width: "10", height: "10" });
    flattenSymbolReferences(svg);
    expect(svg.querySelector("use")!.getAttribute("transform")).toBe("translate(2.5,0) scale(0.5)");
  });

  it("keeps presentation attributes on the converted symbol", () => {
    const svg = makeSymbolSvg(
      { ...iconSymbol, stroke: "#000", "stroke-width": "14" },
      { x: "0", y: "0" },
      { "font-size": "4" }
    );
    flattenSymbolReferences(svg);
    const g = svg.querySelector("defs > g#icon-test")!;
    expect(g.getAttribute("stroke")).toBe("#000");
    expect(g.getAttribute("stroke-width")).toBe("14");
  });

  it("ignores uses that reference non-symbol elements", () => {
    const svg = document.createElementNS(SVG_NS, "svg");
    const path = document.createElementNS(SVG_NS, "path");
    path.id = "feature_1";
    svg.appendChild(path);
    const use = document.createElementNS(SVG_NS, "use");
    use.setAttribute("href", "#feature_1");
    use.setAttribute("x", "5");
    svg.appendChild(use);
    flattenSymbolReferences(svg);
    expect(use.getAttribute("x")).toBe("5");
    expect(use.getAttribute("transform")).toBeNull();
  });
});
