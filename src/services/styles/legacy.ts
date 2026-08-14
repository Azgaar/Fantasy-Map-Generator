import { parseStyle, type Style } from "./schema";

type Attrs = Record<string, unknown>;
type MutableNode = {
  presentation?: Record<string, unknown>;
  options?: Record<string, unknown>;
  children?: Record<string, MutableNode>;
};
type Layers = Record<string, MutableNode>;

class UnknownSelectorError extends Error {
  constructor(selector: string) {
    super(`Unknown legacy selector "${selector}"`);
  }
}

const normalize = (value: unknown): unknown => (value === "null" ? null : value);

function ensureLayer(layers: Layers, layerId: string): MutableNode {
  if (!layers[layerId]) layers[layerId] = {};
  return layers[layerId];
}

function ensureChild(layers: Layers, layerId: string, childId: string): MutableNode {
  const layer = ensureLayer(layers, layerId);
  if (!layer.children) layer.children = {};
  if (!layer.children[childId]) layer.children[childId] = {};
  return layer.children[childId];
}

function applyAttrs(node: MutableNode, attrs: Attrs, renames: Record<string, string> = {}, drop: string[] = []): void {
  for (const [key, raw] of Object.entries(attrs)) {
    if (key === "id" || drop.includes(key)) continue;
    const value = normalize(raw);
    const optionKey = renames[key];
    if (optionKey) {
      node.options ??= {};
      node.options[optionKey] = value;
    } else {
      node.presentation ??= {};
      node.presentation[key] = value;
    }
  }
}

function pickKeys(attrs: Attrs, keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) if (key in attrs) result[key] = normalize(attrs[key]);
  return result;
}

function pickRenamed(attrs: Attrs, renames: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, target] of Object.entries(renames)) if (key in attrs) result[target] = normalize(attrs[key]);
  return result;
}

// layer ids reached directly as "#<id>" (row 2 of the mapping table)
const FLAT_LAYERS = [
  "map",
  "armies",
  "biomes",
  "cells",
  "coastline",
  "compass",
  "coordinates",
  "cults",
  "emblems",
  "fogging",
  "gridOverlay",
  "ice",
  "labels",
  "lakes",
  "landmass",
  "legend",
  "markers",
  "markets",
  "population",
  "prec",
  "provs",
  "relig",
  "rivers",
  "routes",
  "ruler",
  "scaleBar",
  "temperature",
  "terrain",
  "terrs",
  "texture",
  "tradeAnimation",
  "vignette",
  "zones",
  "oceanLayers",
  "borders",
  "burgIcons",
  "anchors"
];
const FLAT_LAYERS_SET = new Set(FLAT_LAYERS);

// per-flat-layer attribute renames into options (rows 39, 41, 43-48)
const FLAT_RENAMES: Partial<Record<string, Record<string, string>>> = {
  terrain: { set: "set", size: "size" },
  texture: { "data-x": "x", "data-y": "y", "data-href": "href" },
  legend: { "data-x": "x", "data-y": "y", "data-columns": "columns", "data-size": "fontSize" },
  gridOverlay: { type: "type", scale: "scale", dx: "dx", dy: "dy" },
  markers: { rescale: "rescale" },
  markets: { "data-size": "size", "data-icon": "icon", "font-size": "fontSize" },
  ruler: { "data-size": "fontSize" },
  coordinates: { "data-size": "fontSize" },
  temperature: { "data-size": "fontSize" },
  armies: { "box-size": "boxSize", "font-size": "fontSize" },
  scaleBar: {
    "data-bar-size": "barSize",
    "data-x": "x",
    "data-y": "y",
    "data-label": "label",
    "font-size": "fontSize"
  },
  oceanLayers: { layers: "layers" }
};

// row 39: density never lands anywhere, not even presentation
const FLAT_DROPS: Partial<Record<string, string[]>> = { terrain: ["density"] };

// nested child selectors that aren't parameterized groups (rows 22-28)
const CHILD_RULES: Record<string, { layer: string; child: string; renames?: Record<string, string> }> = {
  "#stateBorders": { layer: "borders", child: "stateBorders" },
  "#provinceBorders": { layer: "borders", child: "provinceBorders" },
  "#sea_island": { layer: "coastline", child: "sea_island" },
  "#lake_island": { layer: "coastline", child: "lake_island" },
  "#freshwater": { layer: "lakes", child: "freshwater" },
  "#salt": { layer: "lakes", child: "salt" },
  "#sinkhole": { layer: "lakes", child: "sinkhole" },
  "#frozen": { layer: "lakes", child: "frozen" },
  "#lava": { layer: "lakes", child: "lava" },
  "#dry": { layer: "lakes", child: "dry" },
  "#rural": { layer: "population", child: "rural" },
  "#urban": { layer: "population", child: "urban" },
  "#roads": { layer: "routes", child: "roads" },
  "#trails": { layer: "routes", child: "trails" },
  "#searoutes": { layer: "routes", child: "searoutes" },
  "#statesBody": { layer: "regions", child: "statesBody" },
  "#statesHalo": { layer: "regions", child: "statesHalo", renames: { "data-width": "width" } },
  "#goodsCells": { layer: "goods", child: "goodsCells" },
  "#goodsIcons": { layer: "goods", child: "goodsIcons", renames: { "data-size": "size", "data-circle": "circle" } },
  "#goodsBurgs": { layer: "goods", child: "goodsBurgs", renames: { "data-size": "size" } }
};

// parameterized group prefixes (rows 29-32)
const LABELS_RE = /^#labels > #(.+)$/;
const BURG_ICONS_RE = /^#burgIcons > g#(.+)$/;
const ANCHORS_RE = /^#anchors > g#(.+)$/;
const TERRS_RE = /^#terrs (?:> )?#(landHeights|oceanHeights)$/;
const EMBLEMS_RE = /^#emblems > #(.+)$/;

const LABELS_RENAMES = { "data-size": "fontSize", "data-dx": "dx", "data-dy": "dy" };
const ICON_RENAMES = { "font-size": "size" };
const HEIGHTS_RENAMES = { scheme: "scheme", terracing: "terracing", skip: "skip", relax: "relax", curve: "curve" };
const EMBLEMS_RENAMES = { "data-size": "size" };

// single-instance selectors that land on a sub-key of a flat layer's options (rows 33-37)
const COMPASS_USE_ATTRS = ["transform"];
const VIGNETTE_RECT_KEYS = ["x", "y", "width", "height", "rx", "ry", "filter"];
const SCALE_BAR_BACK_RENAMES = {
  opacity: "opacity",
  fill: "fill",
  stroke: "stroke",
  "stroke-width": "strokeWidth",
  filter: "filter",
  "data-top": "top",
  "data-right": "right",
  "data-bottom": "bottom",
  "data-left": "left"
};
const OCEAN_BASE_ATTRS = ["fill"];
const OCEANIC_PATTERN_KEYS = ["href", "opacity"];

function parseCompassTransform(transform: unknown): { x?: number; y?: number; scale?: number } {
  const match = String(transform ?? "").match(/translate\(([-\d.]+)\s+([-\d.]+)\)\s*scale\(([-\d.]+)\)/);
  if (!match) return {};
  return { x: Number(match[1]), y: Number(match[2]), scale: Number(match[3]) };
}

function applySelector(layers: Layers, selector: string, attrs: Attrs): void {
  const flatId = selector.startsWith("#") ? selector.slice(1) : "";
  if (FLAT_LAYERS_SET.has(flatId)) {
    applyAttrs(ensureLayer(layers, flatId), attrs, FLAT_RENAMES[flatId], FLAT_DROPS[flatId]);
    return;
  }

  const childRule = CHILD_RULES[selector];
  if (childRule) {
    applyAttrs(ensureChild(layers, childRule.layer, childRule.child), attrs, childRule.renames);
    return;
  }

  const labelsMatch = selector.match(LABELS_RE);
  if (labelsMatch) {
    applyAttrs(ensureChild(layers, "labels", labelsMatch[1]), attrs, LABELS_RENAMES);
    return;
  }

  const burgIconsMatch = selector.match(BURG_ICONS_RE);
  if (burgIconsMatch) {
    applyAttrs(ensureChild(layers, "burgIcons", burgIconsMatch[1]), attrs, ICON_RENAMES);
    return;
  }

  const anchorsMatch = selector.match(ANCHORS_RE);
  if (anchorsMatch) {
    applyAttrs(ensureChild(layers, "anchors", anchorsMatch[1]), attrs, ICON_RENAMES);
    return;
  }

  const terrsMatch = selector.match(TERRS_RE);
  if (terrsMatch) {
    applyAttrs(ensureChild(layers, "terrs", terrsMatch[1]), attrs, HEIGHTS_RENAMES);
    return;
  }

  const emblemsMatch = selector.match(EMBLEMS_RE);
  if (emblemsMatch) {
    applyAttrs(ensureChild(layers, "emblems", emblemsMatch[1]), attrs, EMBLEMS_RENAMES);
    return;
  }

  if (selector === "#compass > use") {
    const node = ensureLayer(layers, "compass");
    node.options ??= {};
    node.options.use = parseCompassTransform(attrs.transform);
    return;
  }

  if (selector === "#vignette-rect") {
    const node = ensureLayer(layers, "vignette");
    node.options ??= {};
    node.options.rect = pickKeys(attrs, VIGNETTE_RECT_KEYS);
    return;
  }

  if (selector === "#scaleBarBack") {
    const node = ensureLayer(layers, "scaleBar");
    node.options ??= {};
    node.options.back = pickRenamed(attrs, SCALE_BAR_BACK_RENAMES);
    return;
  }

  if (selector === "#oceanBase") {
    const node = ensureLayer(layers, "oceanLayers");
    node.options ??= {};
    node.options.baseFill = normalize(attrs.fill);
    return;
  }

  if (selector === "#oceanicPattern") {
    const node = ensureLayer(layers, "oceanLayers");
    node.options ??= {};
    node.options.pattern = pickKeys(attrs, OCEANIC_PATTERN_KEYS);
    return;
  }

  if (selector === "#legendBox") {
    applyAttrs(ensureLayer(layers, "legend"), attrs);
    return;
  }

  throw new UnknownSelectorError(selector);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function isLegacyPreset(json: object): boolean {
  return Object.keys(json).some(key => key.startsWith("#"));
}
// guarded: this module is also imported by tools/convert-style-presets.mjs under plain node (no window)
if (typeof window !== "undefined") window.isLegacyPreset = isLegacyPreset;

export function upgradeLegacyPreset(
  legacy: Record<string, Record<string, unknown>>,
  { onUnknownSelector = "throw" }: { onUnknownSelector?: "throw" | "skip" } = {}
): Style {
  const layers: Layers = {};

  for (const [selector, attrs] of Object.entries(legacy)) {
    try {
      applySelector(layers, selector, attrs);
    } catch (error) {
      if (onUnknownSelector === "skip" && error instanceof UnknownSelectorError) continue;
      throw error;
    }
  }

  return parseStyle({ layers });
}
if (typeof window !== "undefined") window.upgradeLegacyPreset = upgradeLegacyPreset;

// presentation-only attrs per selector, lifted verbatim from the `attributes` map that used to
// live in collectStyleData (public/modules/ui/style-presets.js) - the authoritative record of what
// a real old map's DOM carries beyond the option-routed attrs above. Kept separate from the
// renames/drops tables (rather than folded in) so neither table has to restate the other's keys;
// buildSelectorAttributes unions them per selector.
const FLAT_PRESENTATION_EXTRAS: Partial<Record<string, string[]>> = {
  map: ["background-color", "filter", "data-filter"],
  armies: ["stroke", "stroke-width", "fill-opacity", "filter"],
  biomes: ["opacity", "filter", "mask"],
  cells: ["opacity", "stroke", "stroke-width", "filter", "mask"],
  gridOverlay: [
    "opacity",
    "stroke",
    "stroke-width",
    "stroke-dasharray",
    "stroke-linecap",
    "transform",
    "filter",
    "mask"
  ],
  coordinates: [
    "opacity",
    "font-size",
    "stroke",
    "stroke-width",
    "stroke-dasharray",
    "stroke-linecap",
    "filter",
    "mask"
  ],
  compass: ["opacity", "transform", "filter", "mask", "shape-rendering"],
  relig: ["opacity", "stroke", "stroke-width", "filter"],
  cults: ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
  landmass: ["opacity", "fill", "filter"],
  markers: ["opacity", "filter"],
  prec: ["opacity", "stroke", "stroke-width", "fill", "filter"],
  population: ["opacity", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
  markets: ["opacity", "stroke-width", "fill-opacity", "stroke-opacity", "filter"],
  tradeAnimation: ["opacity", "filter"],
  terrain: ["opacity", "filter", "mask"],
  rivers: ["opacity", "filter", "fill"],
  ruler: ["opacity", "font-size", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
  provs: ["opacity", "fill", "font-size", "font-family", "filter"],
  temperature: [
    "opacity",
    "font-size",
    "fill",
    "fill-opacity",
    "stroke",
    "stroke-width",
    "stroke-dasharray",
    "stroke-linecap",
    "filter"
  ],
  ice: ["opacity", "fill", "stroke", "stroke-width", "filter"],
  emblems: ["opacity", "stroke-width", "filter"],
  texture: ["opacity", "filter", "mask"],
  zones: ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
  oceanLayers: ["filter"],
  legend: ["font-size", "font-family", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap"],
  fogging: ["opacity", "fill", "filter"],
  vignette: ["opacity", "fill", "filter"],
  scaleBar: ["opacity", "fill"]
};

const CHILD_PRESENTATION_EXTRAS: Partial<Record<string, string[]>> = {
  "#stateBorders": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
  "#provinceBorders": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
  "#sea_island": ["opacity", "stroke", "stroke-width", "filter", "auto-filter"],
  "#lake_island": ["opacity", "stroke", "stroke-width", "filter"],
  "#freshwater": ["opacity", "fill", "stroke", "stroke-width", "filter"],
  "#salt": ["opacity", "fill", "stroke", "stroke-width", "filter"],
  "#sinkhole": ["opacity", "fill", "stroke", "stroke-width", "filter"],
  "#frozen": ["opacity", "fill", "stroke", "stroke-width", "filter"],
  "#lava": ["opacity", "fill", "stroke", "stroke-width", "filter"],
  "#dry": ["opacity", "fill", "stroke", "stroke-width", "filter"],
  "#rural": ["stroke"],
  "#urban": ["stroke"],
  "#roads": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
  "#trails": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
  "#searoutes": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
  "#statesBody": ["opacity", "filter"],
  "#statesHalo": ["opacity", "stroke-width", "filter"],
  "#goodsCells": ["opacity", "filter"],
  "#goodsIcons": ["opacity", "stroke-width", "filter"],
  "#goodsBurgs": ["opacity", "stroke", "stroke-width", "filter"]
};

// derived from the rename/drop tables plus the presentation-extras above so it can't drift from
// the routing logic; consumed by the DOM-harvesting upgrader (Task 7) to know which attributes to
// read per selector. Only concrete, single-element selectors - the parameterized group containers
// (labels/burgIcons/anchors, whose children are named per burg group, including custom ones) are
// covered by LEGACY_GROUP_ATTRIBUTES instead, since they can't be enumerated statically.
export const LEGACY_SELECTOR_ATTRIBUTES: Record<string, string[]> = buildSelectorAttributes();

function buildSelectorAttributes(): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const id of FLAT_LAYERS) {
    result[`#${id}`] = unique([
      ...Object.keys(FLAT_RENAMES[id] ?? {}),
      ...(FLAT_DROPS[id] ?? []),
      ...(FLAT_PRESENTATION_EXTRAS[id] ?? [])
    ]);
  }

  for (const [selector, rule] of Object.entries(CHILD_RULES)) {
    result[selector] = unique([...Object.keys(rule.renames ?? {}), ...(CHILD_PRESENTATION_EXTRAS[selector] ?? [])]);
  }

  result["#terrs > #landHeights"] = [...Object.keys(HEIGHTS_RENAMES), "opacity", "filter", "mask"];
  result["#terrs > #oceanHeights"] = [...Object.keys(HEIGHTS_RENAMES), "data-render", "opacity", "filter", "mask"];
  result["#emblems > #stateEmblems"] = Object.keys(EMBLEMS_RENAMES);
  result["#emblems > #provinceEmblems"] = Object.keys(EMBLEMS_RENAMES);
  result["#emblems > #burgEmblems"] = Object.keys(EMBLEMS_RENAMES);

  result["#compass > use"] = COMPASS_USE_ATTRS;
  result["#vignette-rect"] = VIGNETTE_RECT_KEYS;
  result["#scaleBarBack"] = Object.keys(SCALE_BAR_BACK_RENAMES);
  result["#oceanBase"] = OCEAN_BASE_ATTRS;
  result["#oceanicPattern"] = OCEANIC_PATTERN_KEYS;
  result["#legendBox"] = ["fill", "fill-opacity"];

  return result;
}

// labels/burgIcons/anchors children are named per burg group (including custom, user-defined
// groups), so they can't be enumerated as literal selectors like the table above. The harvester
// (harvestLegacyLayerStyles, auto-update.ts) walks the live DOM under each container instead and
// builds a "#<layer> > [g#]<childId>" selector per child, which the *_RE patterns above already
// route correctly. attributes = renames ∪ presentation extras, same convention as the table above.
export const LEGACY_GROUP_ATTRIBUTES: { layerId: "labels" | "burgIcons" | "anchors"; attributes: string[] }[] = [
  {
    layerId: "labels",
    attributes: unique([
      ...Object.keys(LABELS_RENAMES),
      "opacity",
      "fill",
      "stroke",
      "stroke-width",
      "style",
      "letter-spacing",
      "font-size",
      "font-family",
      "filter"
    ])
  },
  {
    layerId: "burgIcons",
    attributes: unique([
      ...Object.keys(ICON_RENAMES),
      "opacity",
      "data-icon",
      "fill",
      "fill-opacity",
      "stroke",
      "stroke-dasharray",
      "stroke-linecap",
      "stroke-linejoin",
      "stroke-width",
      "filter"
    ])
  },
  {
    layerId: "anchors",
    attributes: unique([...Object.keys(ICON_RENAMES), "opacity", "fill", "stroke", "stroke-width", "filter"])
  }
];
