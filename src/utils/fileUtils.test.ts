// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isImageIcon, sanitizeSvgIcon, scopeSvgIcon, svgToDataUri } from "./fileUtils";

describe("sanitizeSvgIcon", () => {
  it("returns the svg element from the file markup", () => {
    const svg = sanitizeSvgIcon(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10"/></svg>'
    );
    expect(svg?.tagName.toLowerCase()).toBe("svg");
    expect(svg?.querySelector("path")).not.toBeNull();
  });

  it("strips inkscape and sodipodi attributes", () => {
    const svg = sanitizeSvgIcon(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" inkscape:version="1.1" sodipodi:docname="icon.svg"><path inkscape:label="p" d="M0 0"/></svg>'
    );
    expect(svg?.getAttributeNames().some(attr => attr.includes("inkscape") || attr.includes("sodipodi"))).toBe(false);
    expect(svg?.querySelector("path")?.getAttributeNames()).toEqual(["d"]);
  });

  it("removes attribution text from Noun Project files", () => {
    const svg = sanitizeSvgIcon(
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/><text>Created by Artist from the Noun Project</text></svg>'
    );
    expect(svg?.querySelector("text")).toBeNull();
  });

  it("keeps text elements in files without attribution", () => {
    const svg = sanitizeSvgIcon('<svg xmlns="http://www.w3.org/2000/svg"><text>label</text></svg>');
    expect(svg?.querySelector("text")).not.toBeNull();
  });

  it("returns null when the markup has no svg", () => {
    expect(sanitizeSvgIcon("<div>not an svg</div>")).toBeNull();
  });

  it("removes scripting and external references", () => {
    const svg = sanitizeSvgIcon(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><foreignObject><div></div></foreignObject>' +
        '<a href="java\tscript:alert(3)"><path d="M0 0"/></a><image href="https://example.com/x.png"/><use href="#p"/>' +
        '<image href="data:image/png;base64,AA"/><set attributeName="href" to="javascript:alert(4)"/></svg>'
    )!;
    expect(svg.outerHTML).not.toMatch(/alert|script|foreignObject|example\.com/i);
    expect(svg.querySelector("use")?.getAttribute("href")).toBe("#p");
    expect(svg.querySelectorAll("image")[1].getAttribute("href")).toBe("data:image/png;base64,AA");
  });

  it("returns an element owned by the document", () => {
    expect(sanitizeSvgIcon('<svg xmlns="http://www.w3.org/2000/svg"/>')?.ownerDocument).toBe(document);
  });
});

describe("scopeSvgIcon", () => {
  it("prefixes inner ids and classes and every reference to them", () => {
    const svg = sanitizeSvgIcon(
      '<svg xmlns="http://www.w3.org/2000/svg" id="root" class="cls-1"><defs><style>.cls-1{fill:url(#a)} #ab{stroke:#abc}</style>' +
        '<linearGradient id="a"/><path id="ab" d="M0 0"/></defs><use href="#ab" class="cls-1 cls-2" style="fill:url(#a)"/>' +
        '<path fill="url(\'#a\')" stroke="#abc"/></svg>'
    )!;
    scopeSvgIcon(svg, "custom-goods-x");
    expect(svg.id).toBe("root");
    expect(svg.getAttribute("class")).toBe("custom-goods-x-cls-1");
    expect(svg.querySelector("linearGradient")?.id).toBe("custom-goods-x-a");
    expect(svg.querySelector("style")?.textContent).toBe(
      ".custom-goods-x-cls-1{fill:url(#custom-goods-x-a)} #custom-goods-x-ab{stroke:#abc}"
    );
    const use = svg.querySelector("use")!;
    expect(use.getAttribute("href")).toBe("#custom-goods-x-ab");
    expect(use.getAttribute("class")).toBe("custom-goods-x-cls-1 custom-goods-x-cls-2");
    expect(use.getAttribute("style")).toBe("fill:url(#custom-goods-x-a)");
    const path = svg.querySelectorAll("path")[1];
    expect(path.getAttribute("fill")).toBe("url('#custom-goods-x-a')");
    expect(path.getAttribute("stroke")).toBe("#abc");
  });
});

describe("svgToDataUri", () => {
  it("encodes markup as a base64 svg data uri", () => {
    const markup = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10"/></svg>';
    const uri = svgToDataUri(markup);
    expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const decoded = Buffer.from(uri.split(",")[1], "base64").toString("utf8");
    expect(decoded).toBe(markup);
  });

  it("round-trips non-latin characters", () => {
    const markup = '<svg xmlns="http://www.w3.org/2000/svg"><text>Привет 城市</text></svg>';
    const decoded = Buffer.from(svgToDataUri(markup).split(",")[1], "base64").toString("utf8");
    expect(decoded).toBe(markup);
  });
});

describe("isImageIcon", () => {
  it("recognises http and data image URLs", () => {
    expect(isImageIcon("https://example.com/icon.png")).toBe(true);
    expect(isImageIcon("data:image/svg+xml;base64,PHN2Zy8+")).toBe(true);
  });

  it("rejects emoji, plain text and other schemes", () => {
    expect(isImageIcon("⛏️")).toBe(false);
    expect(isImageIcon("")).toBe(false);
    expect(isImageIcon("javascript:alert(1)")).toBe(false);
    expect(isImageIcon("httpx")).toBe(false);
    expect(isImageIcon('" onerror="alert(1)" data:image/')).toBe(false);
  });
});
