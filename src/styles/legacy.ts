import { parseStyleData, type StyleData } from "./schema";

type Attrs = Record<string, unknown>;
type Node = {
  attrs?: Record<string, unknown>;
  options?: Record<string, unknown>;
  children?: Record<string, Node>;
};
type Layers = Record<string, Node>;

class UnknownSelectorError extends Error {
  constructor(selector: string) {
    super(`Unknown legacy selector "${selector}"`);
  }
}

const normalize = (value: unknown): unknown => (value === "null" ? null : value);

function ensureLayer(layers: Layers, layerId: string): Node {
  if (!layers[layerId]) layers[layerId] = {};
  return layers[layerId];
}

function ensureChild(layers: Layers, layerId: string, childId: string): Node {
  const layer = ensureLayer(layers, layerId);
  layer.children ??= {};
  if (!layer.children[childId]) layer.children[childId] = {};
  return layer.children[childId];
}

// `#legend`'s data-size and `#ruler`/`#coordinates`'s data-size both duplicate an accompanying
// font-size attr; once data-size is renamed to options.fontSize, the raw font-size is redundant.
function applyAttrs(node: Node, attrs: Attrs, renames: Record<string, string> = {}, drop: string[] = []): void {
  const dualSize = renames["data-size"] === "fontSize" && "data-size" in attrs && "font-size" in attrs;
  for (const [key, raw] of Object.entries(attrs)) {
    if (key === "id" || drop.includes(key)) continue;
    if (key === "font-size" && dualSize) continue;
    const value = normalize(raw);
    const optionKey = renames[key];
    if (optionKey) {
      node.options ??= {};
      node.options[optionKey] = value;
    } else {
      node.attrs ??= {};
      node.attrs[key] = value;
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

// bare "#<id>" selectors, mapped from the svg group id they name to the registry layer id
const FLAT_LAYER_MAP: Record<string, string> = {
  map: "map",
  armies: "military",
  biomes: "biomes",
  cells: "cells",
  compass: "compass",
  coordinates: "coordinates",
  cults: "cultures",
  emblems: "emblems",
  fogging: "fogging",
  gridOverlay: "grid",
  ice: "ice",
  landmass: "landmass",
  legend: "legend",
  markers: "markers",
  markets: "markets",
  population: "population",
  prec: "precipitation",
  provs: "provinces",
  relig: "religions",
  rivers: "rivers",
  ruler: "rulers",
  scaleBar: "scaleBar",
  temperature: "temperature",
  terrain: "relief",
  texture: "texture",
  tradeAnimation: "trade",
  vignette: "vignette",
  zones: "zones",
  oceanLayers: "ocean"
};

// per-selector attribute renames into options, keyed by the legacy selector id (not the target layer id)
const FLAT_RENAMES: Partial<Record<string, Record<string, string>>> = {
  armies: { "box-size": "boxSize", "font-size": "fontSize" },
  gridOverlay: { type: "type", scale: "scale", dx: "dx", dy: "dy" },
  legend: { "data-x": "x", "data-y": "y", "data-columns": "columns", "data-size": "fontSize" },
  markers: { rescale: "rescale" },
  markets: { "data-size": "size", "data-icon": "icon", "font-size": "fontSize" },
  ruler: { "data-size": "fontSize" },
  coordinates: { "data-size": "fontSize" },
  temperature: { "data-size": "fontSize" },
  scaleBar: {
    "data-bar-size": "barSize",
    "data-x": "x",
    "data-y": "y",
    "data-label": "label",
    "font-size": "fontSize"
  },
  oceanLayers: { layers: "outline" },
  texture: { "data-x": "x", "data-y": "y", "data-href": "href" },
  terrain: { set: "set", size: "size" },
  map: { "data-filter": "dataFilter" }
};

// row 39: density never lands anywhere, not even attrs
const FLAT_DROPS: Partial<Record<string, string[]>> = { terrain: ["density"] };

// nested child selectors that aren't parameterized groups
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
  "#statesBody": { layer: "states", child: "statesBody" },
  "#statesHalo": { layer: "states", child: "statesHalo", renames: { "data-width": "width" } },
  "#goodsCells": { layer: "goods", child: "goodsCells" },
  "#goodsIcons": { layer: "goods", child: "goodsIcons", renames: { "data-size": "size", "data-circle": "circle" } },
  "#goodsBurgs": { layer: "goods", child: "goodsBurgs", renames: { "data-size": "size" } }
};

// parameterized group prefixes
const LABELS_RE = /^#labels > #(.+)$/;
const BURG_ICONS_RE = /^#burgIcons > g#(.+)$/;
const ANCHORS_RE = /^#anchors > g#(.+)$/;
const TERRS_RE = /^#terrs (?:> )?#(landHeights|oceanHeights)$/;
const EMBLEMS_RE = /^#emblems > #(.+)$/;

const LABELS_RENAMES = { "data-size": "fontSize", "data-dx": "dx", "data-dy": "dy" };
const ICON_RENAMES: Record<string, string> = { "font-size": "size", "data-icon": "icon" };
const HEIGHTS_RENAMES = {
  scheme: "scheme",
  terracing: "terracing",
  skip: "skip",
  relax: "relax",
  curve: "curve",
  "data-render": "render"
};
const EMBLEMS_RENAMES = { "data-size": "size" };

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
const OCEANIC_PATTERN_KEYS = ["href", "opacity"];
const LEGEND_BOX_RENAMES = { fill: "fill", "fill-opacity": "fillOpacity" };

function parseCompassTransform(transform: unknown): { x?: number; y?: number; scale?: number } {
  const match = String(transform ?? "").match(/translate\(([-\d.]+)\s+([-\d.]+)\)\s*scale\(([-\d.]+)\)/);
  if (!match) return {};
  return { x: Number(match[1]), y: Number(match[2]), scale: Number(match[3]) };
}

// `#burgIcons > g#X` / `#anchors > g#X`: the two containers are style layers of their own, so a
// burg-type group is an ordinary child of one of them, keyed by the group id. Each group is a
// full node: `font-size` (renamed to `size`) and `data-icon` are the renderer knobs and go to
// `options`, everything else the schema recognizes (fill, stroke, opacity, ...) goes to `attrs`.
function applyIconGroup(layers: Layers, container: "burgIcons" | "anchors", groupId: string, attrs: Attrs): void {
  const node = ensureChild(layers, container, groupId);
  for (const [key, raw] of Object.entries(attrs)) {
    if (key === "id") continue;
    const value = normalize(raw);
    if (key in ICON_RENAMES) {
      node.options ??= {};
      node.options[ICON_RENAMES[key]] = value;
    } else {
      node.attrs ??= {};
      node.attrs[key] = value;
    }
  }
}

function applySelector(layers: Layers, selector: string, attrs: Attrs): void {
  const flatId = selector.startsWith("#") ? selector.slice(1) : "";
  const targetLayer = FLAT_LAYER_MAP[flatId];
  if (targetLayer) {
    applyAttrs(ensureLayer(layers, targetLayer), attrs, FLAT_RENAMES[flatId], FLAT_DROPS[flatId]);
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
    applyIconGroup(layers, "burgIcons", burgIconsMatch[1], attrs);
    return;
  }

  const anchorsMatch = selector.match(ANCHORS_RE);
  if (anchorsMatch) {
    applyIconGroup(layers, "anchors", anchorsMatch[1], attrs);
    return;
  }

  const terrsMatch = selector.match(TERRS_RE);
  if (terrsMatch) {
    applyAttrs(ensureChild(layers, "heightmap", terrsMatch[1]), attrs, HEIGHTS_RENAMES);
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
    const node = ensureLayer(layers, "ocean");
    node.options ??= {};
    node.options.baseFill = normalize(attrs.fill);
    return;
  }

  if (selector === "#oceanicPattern") {
    const node = ensureLayer(layers, "ocean");
    node.options ??= {};
    node.options.pattern = pickKeys(attrs, OCEANIC_PATTERN_KEYS);
    return;
  }

  if (selector === "#legendBox") {
    const node = ensureLayer(layers, "legend");
    node.options ??= {};
    node.options.box = pickRenamed(attrs, LEGEND_BOX_RENAMES);
    return;
  }

  throw new UnknownSelectorError(selector);
}

// Three paint attrs a legacy preset never carried, because they were hardcoded on the registry's
// layer entries instead. An upgraded preset must ship them or the map renders unmasked. This is
// migration-only: a new-format document is taken at its word, and omitting one of these there is
// the author's choice, not an oversight.
export function applyStaticDefaults(layers: Layers): void {
  const labels = ensureLayer(layers, "labels");
  labels.attrs ??= {};
  if (!("font-size" in labels.attrs)) labels.attrs["font-size"] = "100px";

  const fogging = ensureLayer(layers, "fogging");
  fogging.attrs ??= {};
  if (!("mask" in fogging.attrs)) fogging.attrs.mask = "url(#fog)";

  const vignette = ensureLayer(layers, "vignette");
  vignette.attrs ??= {};
  if (!("mask" in vignette.attrs)) vignette.attrs.mask = "url(#vignette-mask)";
}

export function isLegacyPreset(json: object): boolean {
  return Object.keys(json).some(key => key.startsWith("#"));
}

export function upgradeLegacyPreset(legacy: Record<string, Record<string, unknown>>): StyleData {
  const layers: Layers = {};

  for (const [selector, attrs] of Object.entries(legacy)) {
    try {
      applySelector(layers, selector, attrs);
    } catch (error) {
      if (error instanceof UnknownSelectorError) {
        console.warn(`upgradeLegacyPreset: skipping unknown legacy selector "${selector}"`);
        continue;
      }
      throw error;
    }
  }

  // before the parse, not after it: the defaults are part of the upgraded document, so they go
  // through the same schema validation as everything the legacy file itself carried.
  applyStaticDefaults(layers);

  return parseStyleData(layers);
}
