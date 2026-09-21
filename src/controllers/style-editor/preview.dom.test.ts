// Browser-mode tests (vitest.browser.config.ts): what a style card's header preview draws
import { afterEach, expect, test } from "vitest";
import { cardPreview, type PreviewValues, sampleColor } from "./preview";

const SVG_NS = "http://www.w3.org/2000/svg";

afterEach(() => document.body.replaceChildren());

const preview = (values: Partial<PreviewValues>, sample = "Sample", off = false, neutral = "#3b3b3b") =>
  cardPreview({ attrs: values.attrs ?? {}, options: values.options ?? {} }, { sample, off, neutral });

const chipOf = (nodes: Element[]) => nodes[0] as SVGSVGElement;
const shapeOf = (nodes: Element[]) => chipOf(nodes).firstElementChild!;

test("one chip carries both the fill and the stroke of a card", () => {
  const nodes = preview({ attrs: { fill: "#4a7a52", "fill-opacity": 0.5, stroke: "#22331f", "stroke-width": 2 } });

  expect(nodes).toHaveLength(1);
  const shape = shapeOf(nodes);
  expect(shape.tagName).toBe("rect");
  expect(shape.getAttribute("fill")).toBe("#4a7a52");
  expect(shape.getAttribute("fill-opacity")).toBe("0.5");
  expect(shape.getAttribute("stroke")).toBe("#22331f");
  expect(shape.getAttribute("stroke-width")).toBe("2");
});

test("a card that only strokes its element draws a line with the width, dash and linecap it sets", () => {
  const nodes = preview({
    attrs: { stroke: "#1f3846", "stroke-width": 0.5, "stroke-dasharray": "5 2", "stroke-linecap": "round" }
  });

  const shape = shapeOf(nodes);
  expect(shape.tagName).toBe("line");
  expect(shape.getAttribute("stroke")).toBe("#1f3846");
  expect(shape.getAttribute("stroke-width")).toBe("1"); // clamped to stay visible
  expect(shape.getAttribute("stroke-dasharray")).toBe("5 2");
  expect(shape.getAttribute("stroke-linecap")).toBe("round");
});

test("an option colour is the stroke when the card sets a width, else the fill", () => {
  const line = shapeOf(preview({ options: { color: "#5c513e", width: 0.35 } }));
  expect(line.tagName).toBe("line");
  expect(line.getAttribute("stroke")).toBe("#5c513e");

  const swatch = shapeOf(preview({ options: { color: "#5c513e" } }));
  expect(swatch.tagName).toBe("rect");
  expect(swatch.getAttribute("fill")).toBe("#5c513e");
});

test("a coastal band chip takes the shore tint as fill and the outline colour as stroke", () => {
  const shape = shapeOf(preview({ options: { color: "#575448", width: 0.25, shore: "#b9b6a1", shade: 0.35 } }));

  expect(shape.getAttribute("fill")).toBe("#b9b6a1");
  expect(shape.getAttribute("fill-opacity")).toBe("0.35");
  expect(shape.getAttribute("stroke")).toBe("#575448");
});

test("a font card shows the map's own words in the card's type", () => {
  const [sample] = preview(
    {
      attrs: {
        "font-family": "Almendra SC",
        "font-size": "22%",
        fill: "#3e3e4b",
        "letter-spacing": 2,
        style: "text-shadow: white 0 0 4px; text-transform: uppercase"
      }
    },
    "Rustwater"
  );

  expect(sample.className).toBe("sample");
  expect(sample.textContent).toBe("Rustwater");
  expect(sample.getAttribute("style")).toContain('font-family: "Almendra SC"');
  expect(sample.getAttribute("style")).toContain("letter-spacing: 2px");
  expect(sample.getAttribute("style")).toContain("text-transform: uppercase");
  expect(sample.getAttribute("style")).toContain("color: rgb(62, 62, 75)");
});

test("a card with no colour of its own is sampled in the theme tone, solid at full opacity", () => {
  const [disc] = preview({ attrs: { opacity: 0.4, filter: null } });
  expect(disc.getAttribute("class")).toBe("chip");
  expect(shapeOf([disc]).getAttribute("fill")).toBe("#3b3b3b");
  expect(shapeOf([disc]).getAttribute("fill-opacity")).toBe("0.4");

  const [solid] = preview({ attrs: { opacity: null, filter: null } }, "Sample", false, "rgb(1, 2, 3)");
  expect(shapeOf([solid]).getAttribute("fill")).toBe("rgb(1, 2, 3)");
  expect(shapeOf([solid]).getAttribute("fill-opacity")).toBe("1");

  const [halo] = preview({ attrs: { opacity: 0.4, "stroke-width": 10, filter: "blur(3.5px)" } });
  expect(shapeOf([halo]).tagName).toBe("line");
  expect(shapeOf([halo]).getAttribute("stroke-width")).toBe("6"); // clamped
  expect(halo.getAttribute("style")).toContain("filter: blur(3.5px)");
});

test("the sample tone comes from the theme's darkest var", () => {
  document.documentElement.style.setProperty("--dark-solid", "rgb(9, 8, 7)");
  expect(sampleColor()).toBe("rgb(9, 8, 7)");
  document.documentElement.style.removeProperty("--dark-solid");
  expect(sampleColor()).toBe("#3b3b3b"); // the fallback while the theme is not applied
});

test("a grid card tiles the map's own pattern, scaled to the chip", () => {
  const source = document.createElementNS(SVG_NS, "svg");
  source.innerHTML =
    '<pattern id="pattern_square" width="25" height="25" patternUnits="userSpaceOnUse" fill="none"><path d="M 25 0 L 0 0 0 25"/></pattern>';
  document.body.append(source);

  const [chip] = preview({ attrs: { stroke: "#777777", "stroke-width": 1 }, options: { type: "square" } });
  const tile = chip.querySelector("pattern")!;
  expect(tile.id).toBe("style-preview-square");
  expect(tile.querySelector("path")?.getAttribute("d")).toBe("M 25 0 L 0 0 0 25");
  expect(tile.getAttribute("patternTransform")).toBe("scale(0.8)"); // a 25-unit tile fits in 20 chip units
  expect(tile.getAttribute("stroke")).toBe("#777777");
  expect(chip.lastElementChild?.getAttribute("fill")).toBe("url(#style-preview-square)");
});

test("a colour scheme, a texture and an icon each get their own preview", () => {
  const [ramp] = preview({ options: { scheme: "bright" } });
  expect(ramp.className).toBe("ramp");
  expect(ramp.getAttribute("style")).toContain("linear-gradient");

  const [texture] = preview({ options: { href: "./images/textures/marble-big.jpg" } });
  expect(texture.className).toBe("tex");
  expect(texture.getAttribute("style")).toContain('url("./images/textures/marble-big.jpg")');

  const [icon] = preview({ attrs: { fill: "#fff", stroke: "#000" }, options: { icon: "#icon-anchor" } });
  expect(icon.className).toBe("icon");
  expect(icon.querySelector("use")?.getAttribute("href")).toBe("#icon-anchor");

  const [emoji] = preview({ options: { icon: "⚓" } });
  expect(emoji.className).toBe("emoji");
  expect(emoji.textContent).toBe("⚓");
});

test("a set filter is applied to the preview and named in its tip", () => {
  const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
  filter.id = "splotch";
  filter.setAttribute("name", "Splotch");
  document.body.append(filter);

  const [chip] = preview({ attrs: { fill: "#4a7a52", filter: "url(#splotch)" } });
  expect(chip.getAttribute("style")).toContain('filter: url("#splotch")');
  expect(chip.getAttribute("data-tip")).toBe("Filter: Splotch");
});

test("a card whose gate is off is dimmed, and one with nothing to draw stays empty", () => {
  const [off] = preview({ attrs: { fill: "#4a7a52" } }, "Sample", true);
  expect(off.classList.contains("off")).toBe(true);

  expect(preview({ options: { size: 2 } })).toHaveLength(0);
  expect(preview({ attrs: { filter: "none" } })).toHaveLength(0);

  // a zero width draws no line, but the card's opacity is still worth sampling
  const [zero] = preview({ attrs: { stroke: "#333333", "stroke-width": 0, opacity: 0.6 } });
  expect(shapeOf([zero]).tagName).toBe("rect");
  expect(shapeOf([zero]).getAttribute("fill-opacity")).toBe("0.6");
});
