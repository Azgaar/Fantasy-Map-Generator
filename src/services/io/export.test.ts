// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

// fonts populates the font selector at import time, which needs the real app dom
vi.mock("@/services/fonts", () => ({ getUsedFonts: vi.fn(), loadFontsAsDataURI: vi.fn() }));

import { relocateRootFilter } from "./export";

const SVG_NS = "http://www.w3.org/2000/svg";

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
