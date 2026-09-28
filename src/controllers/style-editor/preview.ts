// A style card's header preview:

import { Icons } from "@/components/icons";
import { HeightmapColorSchemes } from "@/renderers/heightmap-color-schemes";

export type PreviewValues = { attrs: Record<string, unknown>; options: Record<string, unknown> };

export type PreviewContext = {
  sample: string; // the words a font sample shows, read from the map's own labels
  off: boolean; // the card's gate is off: the look is stored but not drawn
  neutral?: string; // the tone a card that sets no colour of its own is sampled in
};

const SVG_NS = "http://www.w3.org/2000/svg";
const CHIP_WIDTH = 48;
const CHIP_HEIGHT = 26;
const CHIP_TILE = 20; // the width a grid pattern tile is scaled to in a chip
export const NEUTRAL = "#3b3b3b";
const NEUTRAL_TIP = "Sample shape: this section sets no color of its own";

/** The tone a section with no colour is sampled in: the theme's darkest solid var */
export const sampleColor = (): string =>
  getComputedStyle(document.documentElement).getPropertyValue("--dark-solid").trim() || NEUTRAL;

const svgEl = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
};

type Read = {
  value: (name: string) => unknown;
  has: (name: string) => boolean;
  text: (name: string) => string | undefined;
  number: (name: string, fallback: number) => number;
};

/** fill and stroke as the card declares them; `color`/`width` are an option's own paint, not an attr */
type Paint = {
  fill?: string;
  fillOpacity: number;
  stroke?: string;
  strokeOpacity: number;
  width: number;
  dash?: string;
  cap?: string;
};

export function cardPreview(values: PreviewValues, { sample, off, neutral = NEUTRAL }: PreviewContext): Element[] {
  const read = reader(values);
  const filter = read.text("filter");
  const live = filter && filter !== "none" ? filter : undefined;
  const preview: Element[] = [];

  const scheme = read.text("scheme");
  const image = read.text("href");
  const icon = read.text("icon");
  const font = read.text("font-family");
  const grid = read.text("type");
  const tile = grid && document.querySelector(`#pattern_${grid}`) ? patternChip(grid, read) : undefined;

  if (scheme) preview.push(ramp(scheme));
  else if (image) preview.push(thumbnail(image));
  else if (icon) preview.push(iconChip(icon, read));
  else if (font) preview.push(textSample(font, read, sample));
  else if (tile) preview.push(tile);
  else preview.push(...shapePreview(read, live, neutral));

  for (const chip of preview) {
    if (live) {
      (chip as HTMLElement).style.filter = live;
      const name = `Filter: ${filterName(live)}`;
      chip.setAttribute(
        "data-tip",
        chip.getAttribute("data-tip") ? `${chip.getAttribute("data-tip")} · ${name}` : name
      );
    }
    if (off) chip.classList.add("off");
  }
  return preview;
}

const reader = (values: PreviewValues): Read => {
  const has = (name: string): boolean => name in values.attrs || name in values.options;
  const value = (name: string): unknown => values.attrs[name] ?? values.options[name];
  return {
    value,
    has,
    text: name => (typeof value(name) === "string" ? (value(name) as string) : undefined),
    number: (name, fallback) => (typeof value(name) === "number" ? (value(name) as number) : fallback)
  };
};

// a card with no colour of its own still has a look: it is sampled in the theme tone, solid at full
// opacity, with the width, blur or filter it does set
function shapePreview(read: Read, live: string | undefined, neutral: string): Element[] {
  const paint = paintOf(read);
  const painted = paint && paintChip(paint);
  if (painted) return [painted];

  const width = read.number("stroke-width", Number.NaN);
  const opacity = read.number("opacity", 1);
  const touched = live || read.has("opacity") || read.has("stroke-width") || read.has("width");
  if (!touched) return [];
  // a stroke that draws nothing at width 0 still leaves the card's opacity and filter to sample
  const sample =
    !Number.isNaN(width) && width > 0
      ? paintChip({
          stroke: neutral,
          strokeOpacity: opacity,
          fillOpacity: 1,
          width,
          dash: read.text("stroke-dasharray"),
          cap: read.text("stroke-linecap")
        })
      : paintChip({ fill: neutral, fillOpacity: opacity, strokeOpacity: 1, width: 1 });
  if (!sample) return [];
  sample.setAttribute("data-tip", NEUTRAL_TIP);
  return [sample];
}

function paintOf(read: Read): Paint | undefined {
  // a fill is the card's own fill, else the tint an option lays over an area; an option `color` is a
  // stroke when the card also sets a width, else the only paint it has
  const shore = read.text("shore");
  const width = read.number("stroke-width", read.number("width", Number.NaN));
  const optionColor = read.text("color");
  const fill = read.text("fill") ?? shore ?? (Number.isNaN(width) && !read.text("stroke") ? optionColor : undefined);
  const stroke = read.text("stroke") ?? (Number.isNaN(width) ? undefined : optionColor);
  if (!fill && !stroke) return undefined;

  const opacity = read.number("opacity", 1);
  return {
    fill,
    fillOpacity: read.number("fill-opacity", opacity) * (shore ? read.number("shade", 1) : 1),
    stroke,
    strokeOpacity: read.number("stroke-opacity", opacity),
    width: Number.isNaN(width) ? 2 : width,
    dash: read.text("stroke-dasharray"),
    cap: read.text("stroke-linecap")
  };
}

// fill and stroke on one shape; a card that only strokes its element gets a line instead. A zero
// width draws nothing on the map, so a stroke with one is no preview at all
function paintChip(paint: Paint): SVGSVGElement | undefined {
  const line = !paint.fill;
  const width = paint.width > 0 ? Math.max(1, Math.min(paint.width, 6)) : 0;
  if (line && !width) return undefined;

  const chip = svgEl("svg", {
    class: "chip",
    width: CHIP_WIDTH,
    height: CHIP_HEIGHT,
    viewBox: `0 0 ${CHIP_WIDTH} ${CHIP_HEIGHT}`
  });
  const shape = line
    ? svgEl("line", { x1: 4, y1: CHIP_HEIGHT / 2, x2: CHIP_WIDTH - 4, y2: CHIP_HEIGHT / 2 })
    : svgEl("rect", { x: 5, y: 5, width: CHIP_WIDTH - 10, height: CHIP_HEIGHT - 10, rx: 3 });

  if (paint.fill) {
    shape.setAttribute("fill", paint.fill);
    shape.setAttribute("fill-opacity", String(paint.fillOpacity));
  }
  if (paint.stroke && width) {
    shape.setAttribute("stroke", paint.stroke);
    shape.setAttribute("stroke-opacity", String(paint.strokeOpacity));
    shape.setAttribute("stroke-width", String(width));
    if (paint.dash && paint.dash !== "none") shape.setAttribute("stroke-dasharray", paint.dash);
    if (paint.cap) shape.setAttribute("stroke-linecap", paint.cap);
  }
  chip.append(shape);
  return chip;
}

// a grid card tiles the map's own pattern geometry over a light patch, stroked as the card says and
// scaled so the chip always shows a few cells, whatever the tile of the chosen grid type
function patternChip(type: string, read: Read): SVGSVGElement | undefined {
  const source = document.querySelector<SVGPatternElement>(`#pattern_${type}`);
  const tileWidth = Number(source?.getAttribute("width"));
  const shape = source?.querySelector("path");
  if (!source || !shape || !tileWidth) return undefined;

  const id = `style-preview-${type}`;
  const fit = CHIP_TILE / tileWidth; // the pattern scale that fits a tile into the chip
  const weight = Math.max(0.6, Math.min(read.number("stroke-width", 0.5), 2)) * 2; // about a pixel on screen
  const tile = svgEl("pattern", {
    id,
    width: source.getAttribute("width")!,
    height: source.getAttribute("height")!,
    patternUnits: "userSpaceOnUse",
    patternTransform: `scale(${fit})`,
    fill: "none",
    stroke: read.text("stroke") ?? "#808080",
    "stroke-width": weight / fit,
    "stroke-dasharray": read.text("stroke-dasharray") ?? "none",
    "stroke-linecap": read.text("stroke-linecap") ?? "butt"
  });
  tile.append(shape.cloneNode(true));

  const chip = svgEl("svg", {
    class: "chip",
    width: CHIP_WIDTH,
    height: CHIP_HEIGHT,
    viewBox: `0 0 ${CHIP_WIDTH} ${CHIP_HEIGHT}`
  });
  const patch = { x: 1, y: 1, width: CHIP_WIDTH - 2, height: CHIP_HEIGHT - 2, rx: 2 };
  const defs = svgEl("defs");
  defs.append(tile);
  chip.append(
    defs,
    svgEl("rect", { ...patch, fill: "#ffffff", "fill-opacity": 0.5 }),
    svgEl("rect", { ...patch, fill: `url(#${id})` })
  );
  return chip;
}

// the map's own words in the card's type, with everything the card sets on them
function textSample(font: string, read: Read, sample: string): HTMLElement {
  const span = document.createElement("span");
  span.className = "sample";
  span.textContent = sample;
  span.style.fontFamily = font;
  span.style.fontWeight = read.text("font-weight") ?? "";
  span.style.fontStyle = read.text("font-style") ?? "";
  span.style.letterSpacing = `${read.number("letter-spacing", 0)}px`;
  const fill = read.text("fill") ?? read.text("color");
  if (fill) span.style.color = fill;
  span.style.opacity = String(read.number("fill-opacity", read.number("opacity", 1)));

  // the label cssText holds the shadow and the letter case; its shift is placement, not type, so it
  // stays out of the sample
  const style = read.text("style");
  if (style) {
    const type = style
      .split(";")
      .filter(declaration => !declaration.trim().startsWith("transform"))
      .join(";");
    span.style.cssText += type.endsWith(";") || !type ? type : `${type};`;
  }

  const stroke = read.text("stroke");
  const width = read.number("stroke-width", 0);
  if (stroke && width > 0) span.style.webkitTextStroke = `${Math.min(width, 1)}px ${stroke}`;
  return span;
}

function ramp(scheme: string): HTMLElement {
  const span = document.createElement("span");
  span.className = "ramp";
  const stops = [0, 0.25, 0.5, 0.75, 1].map(at => HeightmapColorSchemes.get(scheme)(at));
  span.style.background = `linear-gradient(to right, ${stops.join(",")})`;
  span.dataset.tip = `Color scheme: ${scheme.startsWith("#") ? "custom" : scheme}`;
  return span;
}

function thumbnail(href: string): HTMLElement {
  const span = document.createElement("span");
  span.className = "tex";
  span.style.backgroundImage = `url("${href.replaceAll('"', "")}")`;
  span.dataset.tip = href.split("/").pop() ?? href;
  return span;
}

function iconChip(id: string, read: Read): HTMLElement {
  const span = document.createElement("span");
  span.className = "icon";
  span.innerHTML = Icons.html(id);
  const svg = span.querySelector("svg");
  if (svg) {
    svg.style.fill = read.text("fill") ?? ""; // the style's paint over the default one
    svg.style.stroke = read.text("stroke") ?? "";
  }
  return span;
}

// url(#splotch) → the def's name; a CSS function list → its function names
function filterName(filter: string): string {
  const id = filter.match(/^url\(#(.+)\)$/)?.[1];
  if (id) return document.getElementById(id)?.getAttribute("name") ?? id;
  return Array.from(filter.matchAll(/([a-z-]+)\(/g), match => match[1]).join(", ");
}
