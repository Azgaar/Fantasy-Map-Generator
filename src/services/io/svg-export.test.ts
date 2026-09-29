// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  convertBlurFilters,
  getReferencedDefinitions,
  normalizeSvgLinks,
  resolveLabelCase,
  splitLabelLines
} from "./svg-export";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";
function makeSvg(content: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.innerHTML = content;
  return svg;
}
afterEach(() => vi.restoreAllMocks());

describe("SVG editor label compatibility", () => {
  it("gives each curved line its own text path with the accumulated baseline offset", () => {
    const svg = makeSvg(`<g id="labels"><text id="stateLabel1" transform="translate(5,8)" opacity="0.6">
      <textPath href="#curve" startOffset="35%" font-size="160%" text-anchor="middle">
        <tspan x="0" dy="-1em">Holy State</tspan><tspan x="0" dy="1em">of</tspan><tspan x="0" dy="1em">Echily</tspan>
      </textPath></text></g>`);
    splitLabelLines(svg);
    const label = svg.querySelector("#stateLabel1")!;
    expect(label.localName).toBe("g");
    expect(label.getAttribute("transform")).toBe("translate(5,8)");
    expect(label.hasAttribute("opacity")).toBe(false);
    const lines = Array.from(label.querySelectorAll("text"));
    expect(lines).toHaveLength(3);
    expect(lines.map(line => line.textContent)).toEqual(["Holy State", "of", "Echily"]);
    expect(lines.map(line => line.querySelector("tspan")!.getAttribute("dy"))).toEqual(["-1em", "0em", "1em"]);
    for (const line of lines) {
      expect(line.hasAttribute("transform")).toBe(false);
      expect(line.hasAttribute("id")).toBe(false);
      expect(line.getAttribute("opacity")).toBe("0.6");
      const path = line.querySelector("textPath")!;
      expect(path.getAttribute("href")).toBe("#curve");
      expect(path.getAttribute("startOffset")).toBe("35%");
      expect(path.getAttribute("font-size")).toBe("160%");
      expect(path.getAttribute("text-anchor")).toBe("middle");
      expect(path.querySelector("tspan")!.hasAttribute("x")).toBe(false);
    }
  });

  it("leaves single-line paths, positioned text and unfamiliar line markup intact", () => {
    const svg = makeSvg(`<g id="labels"><text><textPath href="#p">Single</textPath></text>
      <text x="40" y="50">Town</text><text><textPath href="#q"><tspan x="5" dy="2px">One</tspan>
      <tspan x="5" dy="4px">Two</tspan></textPath></text></g>`);
    const before = svg.outerHTML;
    splitLabelLines(svg);
    expect(svg.outerHTML).toBe(before);
  });

  it("materializes displayed case without changing path references or non-label text", () => {
    const svg =
      makeSvg(`<g id="labels"><text><textPath href="#CaseSensitive"><tspan>Échily</tspan></textPath></text></g>
      <text id="scale">Miles</text>`);
    vi.spyOn(window, "getComputedStyle").mockReturnValue({ textTransform: "uppercase" } as CSSStyleDeclaration);
    resolveLabelCase(svg);
    expect(svg.querySelector("tspan")!.textContent).toBe("ÉCHILY");
    expect(svg.querySelector("textPath")!.getAttribute("href")).toBe("#CaseSensitive");
    expect(svg.querySelector("#scale")!.textContent).toBe("Miles");
  });
});

describe("SVG filter compatibility", () => {
  it("replaces CSS blur in attributes and styles with equivalent sRGB Gaussian filters", () => {
    const svg = makeSvg(`<defs><filter id="export-blur-0"/></defs><rect filter="blur(20px)"/>
      <g style="filter: blur(5px); opacity: 0.5"/><path filter="url(#existing)"/>`);
    for (const element of svg.querySelectorAll("rect, g"))
      Object.defineProperty(element, "getBBox", { value: () => ({ x: 10, y: 20, width: 30, height: 40 }) });
    convertBlurFilters(svg);
    for (const [selector, deviation] of [
      ["rect", "20"],
      ["g", "5"]
    ]) {
      const element = svg.querySelector(selector)!;
      const id = element.getAttribute("filter")!.slice(5, -1);
      const filter = svg.getElementById(id)!;
      expect(filter.querySelector("feGaussianBlur")!.getAttribute("stdDeviation")).toBe(deviation);
      expect(filter.getAttribute("color-interpolation-filters")).toBe("sRGB");
      expect(filter.getAttribute("filterUnits")).toBe("userSpaceOnUse");
      expect(Number(filter.getAttribute("x"))).toBe(10 - Number(deviation) * 3);
      expect(Number(filter.getAttribute("width"))).toBe(30 + Number(deviation) * 6);
    }
    expect(svg.querySelector("g")!.style.filter).toBe("");
    expect(svg.querySelector("g")!.style.opacity).toBe("0.5");
    expect(svg.querySelector("path")!.getAttribute("filter")).toBe("url(#existing)");
    expect(svg.querySelectorAll("#export-blur-0")).toHaveLength(1);
  });

  it("leaves compound and relative-unit filters intact instead of silently discarding effects", () => {
    const svg = makeSvg('<defs/><g filter="blur(2em)"/><g filter="blur(2px) brightness(0.5)"/>');
    const before = svg.outerHTML;
    convertBlurFilters(svg);
    expect(svg.outerHTML).toBe(before);
  });

  it("keeps definitions referenced by quoted inline styles and root attributes", () => {
    const svg = makeSvg(`<defs/><g style="filter: url('#shadow'); fill: url(&quot;#paper&quot;)"/>
      <path fill="url(#hatch)"/><g filter="url(#shadow)"/>`);
    svg.setAttribute("filter", "url(#tint)");
    expect(getReferencedDefinitions(svg)).toEqual(new Set(["tint", "shadow", "paper", "hatch"]));
  });
});

describe("SVG reference serialization", () => {
  it("writes matching namespaced SVG 1.1 links and SVG 2 links, with modern href taking precedence", () => {
    const svg = makeSvg('<defs><pattern><image href="data:image/png;base64,AAAA"/></pattern></defs><use href="#new"/>');
    svg.querySelector("use")!.setAttribute("xlink:href", "#stale");
    normalizeSvgLinks(svg);
    const parsed = new DOMParser().parseFromString(new XMLSerializer().serializeToString(svg), "image/svg+xml");
    expect(parsed.querySelector("parsererror")).toBeNull();
    for (const element of parsed.querySelectorAll("image, use"))
      expect(element.getAttributeNS(XLINK_NS, "href")).toBe(element.getAttribute("href"));
    expect(parsed.querySelector("use")!.getAttribute("href")).toBe("#new");
  });

  it("supports legacy references and removes empty links that editors treat as missing images", () => {
    const svg = makeSvg('<image/><image href=""/><image href=""/>');
    const images = svg.querySelectorAll("image");
    images[0].setAttributeNS(XLINK_NS, "xlink:href", "data:image/png;base64,AAAA");
    images[2].setAttributeNS(XLINK_NS, "xlink:href", "old.png");
    normalizeSvgLinks(svg);
    expect(images[0].getAttribute("href")).toBe("data:image/png;base64,AAAA");
    for (const image of [images[1], images[2]]) {
      expect(image.hasAttribute("href")).toBe(false);
      expect(image.hasAttributeNS(XLINK_NS, "href")).toBe(false);
    }
  });
});
