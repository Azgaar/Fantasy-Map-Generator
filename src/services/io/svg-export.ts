import { createEl } from "@/utils/nodeUtils";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

// Inkscape ignores multiline textPath resets.
export function splitLabelLines(svg: SVGSVGElement): void {
  for (const textPath of svg.querySelectorAll<SVGTextPathElement>("#labels text > textPath")) {
    const text = textPath.parentElement!;
    if (text.children.length !== 1) continue;
    const spans = Array.from(textPath.children);
    if (spans.length < 2 || !spans.every(span => span.localName === "tspan" && span.getAttribute("x") === "0"))
      continue;
    const offsets = spans.map(span => span.getAttribute("dy")?.match(/^(-?[\d.]+)em$/));
    if (offsets.some(offset => !offset || !Number.isFinite(Number(offset[1])))) continue;

    const group = svg.ownerDocument.createElementNS(SVG_NS, "g");
    for (const attribute of text.attributes) {
      if (attribute.name === "id" || attribute.name === "transform" || attribute.name.startsWith("data-"))
        group.setAttribute(attribute.name, attribute.value);
    }
    let dy = 0;
    spans.forEach((span, index) => {
      dy += Number(offsets[index]![1]);
      const line = text.cloneNode(false) as SVGTextElement;
      line.removeAttribute("id");
      line.removeAttribute("transform");
      const path = textPath.cloneNode(false) as SVGTextPathElement;
      const content = span.cloneNode(true) as SVGTSpanElement;
      content.removeAttribute("x");
      content.setAttribute("dy", `${dy}em`);
      path.appendChild(content);
      line.appendChild(path);
      group.appendChild(line);
    });
    text.replaceWith(group);
  }
}

// Inkscape ignores text-transform.
export function resolveLabelCase(svg: SVGSVGElement): void {
  const labels = svg.querySelector("#labels");
  if (!labels) return;
  const walker = svg.ownerDocument.createTreeWalker(labels, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const parent = node.parentElement;
    if (!parent?.closest("text")) continue;
    const transform = window.getComputedStyle(parent).textTransform;
    if (transform === "uppercase") node.textContent = node.textContent!.toUpperCase();
    if (transform === "lowercase") node.textContent = node.textContent!.toLowerCase();
  }
}

export function getReferencedDefinitions(svg: SVGSVGElement): Set<string> {
  const ids = new Set<string>();
  for (const element of [svg, ...svg.querySelectorAll("*")]) {
    for (const { value } of element.attributes) {
      for (const match of value.matchAll(/url\(\s*(['"]?)#([^'"\s)]+)\1\s*\)/g)) ids.add(match[2]);
    }
  }
  return ids;
}

// SVG 1.1 requires filter URLs.
export function convertBlurFilters(svg: SVGSVGElement): void {
  const defs = svg.querySelector("defs")!;
  let index = 0;
  for (const element of svg.querySelectorAll<SVGGraphicsElement>("[filter], [style]")) {
    const value = element.style.filter || element.getAttribute("filter") || "";
    const blur = value.match(/^blur\(\s*(\d*\.?\d+)(?:px)?\s*\)$/);
    if (!blur) continue;
    let id: string;
    do id = `export-blur-${index++}`;
    while (svg.getElementById(id));
    // Prevent blur clipping.
    const bounds = element.getBBox();
    const margin = Number(blur[1]) * 3;
    const filter = createEl("filter", id, {
      "color-interpolation-filters": "sRGB",
      filterUnits: "userSpaceOnUse",
      x: String(bounds.x - margin),
      y: String(bounds.y - margin),
      width: String(bounds.width + margin * 2),
      height: String(bounds.height + margin * 2)
    });
    const gaussian = svg.ownerDocument.createElementNS(SVG_NS, "feGaussianBlur");
    gaussian.setAttribute("stdDeviation", blur[1]);
    filter.appendChild(gaussian);
    defs.appendChild(filter);
    element.style.removeProperty("filter");
    element.setAttribute("filter", `url(#${id})`);
  }
}

export function normalizeSvgLinks(svg: SVGSVGElement): void {
  for (const element of svg.querySelectorAll("*")) {
    const href = element.getAttribute("href") ?? element.getAttribute("xlink:href");
    if (href === null) continue;
    element.removeAttribute("xlink:href");
    if (!href) {
      element.removeAttribute("href");
      continue;
    }
    element.setAttribute("href", href);
    element.setAttributeNS(XLINK_NS, "xlink:href", href);
  }
}
