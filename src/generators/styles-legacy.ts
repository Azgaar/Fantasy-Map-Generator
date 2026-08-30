// Conversions between the legacy `style` object shapes and the styles store. Only migration
// edges use this: map-file save/load and legacy preset routing. Dies when those write the new
// format natively.

import { Layers } from "@/components/layers";
import "./styles";
import type { Styles } from "./styles-schema";
import { DEFAULT_STYLES, nullableAttrsAt } from "./styles-schema";

type LabelGroupStyle = Styles["labels"]["groups"][string];

const toNumber = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
// legacy read the store as {...BASE_STYLE, ...bag}: a missing key takes the base default,
// an explicit null stays null (= attribute not written). These mirror that merge exactly.
const numOr = (value: unknown, fallback: number | null): number | null =>
  value === undefined ? fallback : value === null ? null : toNumber(value, 0);
const strOr = (value: unknown, fallback: string | null): string | null =>
  value === undefined || value === "" ? fallback : value === null ? null : String(value);

export function labelGroupFromLegacy(legacy: object): LabelGroupStyle {
  const bag = legacy as Record<string, unknown>;
  // legacy builds rewrote label-group opacity on every zoom, so a saved 0 is the fade state
  // at save-time, not a preference - the culled renderer would keep the group invisible forever
  const opacity = numOr(bag.opacity, 1);
  return {
    attrs: {
      opacity: opacity === 0 ? 1 : opacity,
      fill: strOr(bag.fill, "#3e3e4b"),
      "fill-opacity": numOr(bag["fill-opacity"], null),
      stroke: strOr(bag.stroke, "#3a3a3a"),
      "stroke-width": numOr(bag["stroke-width"], 0),
      "stroke-dasharray": strOr(bag["stroke-dasharray"], null),
      "stroke-linecap": strOr(bag["stroke-linecap"], null),
      "letter-spacing": numOr(bag["letter-spacing"], 0),
      // legacy wrote the BASE size under data-size (font-size held the live zoom-rescaled value);
      // prefer data-size when present, matching what the style editor's size input reads
      "font-size": strOr(bag["data-size"], null) ?? strOr(bag["font-size"], "18%") ?? "18%",
      "font-family": strOr(bag["font-family"], "Almendra SC") ?? "Almendra SC",
      style: strOr(bag.style, null),
      filter: strOr(bag.filter, null)
    },
    options: {
      dx: toNumber(bag["data-dx"], 0),
      dy: toNumber(bag["data-dy"], 0)
    }
  };
}

export function labelGroupToLegacy(group: LabelGroupStyle): Record<string, unknown> {
  const legacy: Record<string, unknown> = { ...group.attrs };
  if (group.options.dx) legacy["data-dx"] = group.options.dx;
  if (group.options.dy) legacy["data-dy"] = group.options.dy;
  return legacy;
}

export function labelGroupsFromLegacy(groups: Record<string, object>): Record<string, LabelGroupStyle> {
  return Object.fromEntries(Object.entries(groups).map(([name, group]) => [name, labelGroupFromLegacy(group)]));
}

type BurgGroupStyle = Styles["burgIcons"]["burgIcons"]["groups"][string];

// legacy wrote stored burg-group bags to the DOM verbatim with no per-key defaults; only
// size and icon are required by the renderer (anchors ignore icon - they always draw #icon-anchor)
export function burgGroupFromLegacy(legacy: object): BurgGroupStyle {
  const bag = legacy as Record<string, unknown>;
  return {
    attrs: {
      opacity: numOr(bag.opacity, null),
      fill: strOr(bag.fill, null),
      "fill-opacity": numOr(bag["fill-opacity"], null),
      stroke: strOr(bag.stroke, null),
      "stroke-width": numOr(bag["stroke-width"], null),
      "stroke-dasharray": strOr(bag["stroke-dasharray"], null),
      "stroke-linecap": strOr(bag["stroke-linecap"], null),
      "stroke-linejoin": strOr(bag["stroke-linejoin"], null),
      filter: strOr(bag.filter, null)
    },
    options: {
      // pre-1.9x maps carry the group size as a bare `size` attr instead of font-size
      size: toNumber(bag["font-size"], toNumber(bag.size, 1)),
      icon: strOr(bag["data-icon"], null) ?? "#icon-circle"
    }
  };
}

// the style editor edits burg groups on the DOM; drawing harvests them back into the store
export function burgGroupFromElement(el: Element): BurgGroupStyle {
  const bag: Record<string, string> = {};
  for (const { name, value } of Array.from(el.attributes)) bag[name] = value;
  return burgGroupFromLegacy(bag);
}

export function burgGroupToLegacy(group: BurgGroupStyle, withIcon = true): Record<string, unknown> {
  const legacy: Record<string, unknown> = { ...group.attrs, "font-size": group.options.size };
  if (withIcon) legacy["data-icon"] = group.options.icon;
  return legacy;
}

export function burgGroupsFromLegacy(groups: Record<string, object>): Record<string, BurgGroupStyle> {
  return Object.fromEntries(Object.entries(groups).map(([name, group]) => [name, burgGroupFromLegacy(group)]));
}

export function reliefFromLegacy(legacy: object): Styles["relief"]["options"] {
  const bag = legacy as Record<string, unknown>;
  return {
    set: strOr(bag.set, null) ?? "simple",
    size: toNumber(bag.size, 1),
    density: toNumber(bag.density, 0.4)
  };
}

export function stylesFromLegacy(json: unknown): void {
  const legacy = (typeof json === "object" && json !== null ? json : {}) as Record<string, any>;
  if (legacy.labels?.groups) styles.labels.groups = labelGroupsFromLegacy(legacy.labels.groups);
  if (legacy.burgIcons) styles.burgIcons.burgIcons.groups = burgGroupsFromLegacy(legacy.burgIcons);
  if (legacy.anchors) styles.burgIcons.anchors.groups = burgGroupsFromLegacy(legacy.anchors);
  if (legacy.relief) styles.relief.options = reliefFromLegacy(legacy.relief);
}

// selector -> store path, plus the legacy-key -> option-name renames for that node. Attrs need
// no listing: any bag key left after options are pulled out is overlaid onto the path's attrs
// by name, so an unrecognized key is what "unknown legacy attribute" catches.
type PresetRoute = {
  path: string[];
  options?: Record<string, string>;
  bools?: string[];
  // options that must stay strings: the DOM harvest and legacy preset saver numify
  // numeric-looking values ("-6", "100"), which the string schema would reject
  strings?: string[];
  kind?: "label" | "burg";
  drop?: string[];
  ownAttrs?: boolean;
};

const SELECTOR_ALIASES: Record<string, string> = {
  "#terrs #landHeights": "#terrs > #landHeights",
  "#terrs #oceanHeights": "#terrs > #oceanHeights"
};

const PRESET_ROUTES: Record<string, PresetRoute> = {
  "#map": { path: ["map"], options: { "data-filter": "dataFilter" } },
  "#armies": { path: ["military"], options: { "font-size": "fontSize", "box-size": "boxSize" } },
  "#biomes": { path: ["biomes"] },
  "#cells": { path: ["cells"] },
  "#gridOverlay": { path: ["grid"], options: { type: "type", scale: "scale", dx: "dx", dy: "dy" } },
  "#coordinates": { path: ["coordinates"], options: { "data-size": "fontSize", "font-size": "fontSize" } },
  "#compass": { path: ["compass"] },
  "#compass > use": { path: ["compass", "compassRose"] },
  "#rivers": { path: ["rivers"] },
  "#freshwater": { path: ["lakes", "freshwater"] },
  "#salt": { path: ["lakes", "salt"] },
  "#sinkhole": { path: ["lakes", "sinkhole"] },
  "#frozen": { path: ["lakes", "frozen"] },
  "#lava": { path: ["lakes", "lava"] },
  "#dry": { path: ["lakes", "dry"] },
  "#sea_island": { path: ["coastline", "sea_island"], options: { "auto-filter": "autoFilter" } },
  "#lake_island": { path: ["coastline", "lake_island"] },
  "#terrs > #landHeights": {
    path: ["heightmap", "landHeights"],
    options: {
      scheme: "scheme",
      terracing: "terracing",
      skip: "skip",
      relax: "relax",
      curve: "curve"
    }
  },
  "#terrs > #oceanHeights": {
    path: ["heightmap", "oceanHeights"],
    options: {
      scheme: "scheme",
      terracing: "terracing",
      skip: "skip",
      relax: "relax",
      curve: "curve",
      "data-render": "render"
    },
    bools: ["render"]
  },
  "#terrain": { path: ["relief"], options: { set: "set", size: "size", density: "density" } },
  "#relig": { path: ["religions"] },
  "#cults": { path: ["cultures"] },
  "#statesBody": { path: ["states", "statesBody"] },
  "#statesHalo": { path: ["states", "statesHalo"], options: { "data-width": "width" } },
  // data-size was never written by collectStyleData (public/modules/ui/style-presets.js);
  // it's dead cargo left over next to font-size in older saves/presets
  "#provs": { path: ["provinces"], drop: ["data-size"] },
  "#zones": { path: ["zones"] },
  "#stateBorders": { path: ["borders", "stateBorders"] },
  "#provinceBorders": { path: ["borders", "provinceBorders"] },
  "#roads": { path: ["routes", "roads"] },
  "#trails": { path: ["routes", "trails"] },
  "#searoutes": { path: ["routes", "searoutes"] },
  "#journeys": { path: ["journeys"] },
  "#temperature": { path: ["temperature"] },
  "#ice": { path: ["ice"] },
  "#prec": { path: ["precipitation"] },
  "#population": { path: ["population"] },
  "#rural": { path: ["population", "rural"] },
  "#urban": { path: ["population", "urban"] },
  "#emblems": { path: ["emblems"] },
  "#texture": { path: ["texture"], options: { "data-href": "href", "data-x": "x", "data-y": "y" } },
  "#goodsCells": { path: ["goods", "goodsCells"] },
  "#goodsIcons": {
    path: ["goods", "goodsIcons"],
    options: { "data-size": "size", "data-circle": "circle" },
    bools: ["circle"]
  },
  "#goodsBurgs": { path: ["goods", "goodsBurgs"], options: { "data-size": "size" } },
  "#markets": {
    path: ["markets"],
    options: { "data-size": "size", "font-size": "fontSize", "data-icon": "icon" },
    strings: ["icon"]
  },
  "#tradeAnimation": { path: ["trade"] },
  "#markers": { path: ["markers"], options: { rescale: "rescale" } },
  "#ruler": { path: ["rulers"], options: { "data-size": "fontSize", "font-size": "fontSize" } },
  "#scaleBar": {
    path: ["scaleBar"],
    options: { "data-bar-size": "barSize", "data-x": "x", "data-y": "y", "data-label": "label" },
    strings: ["label"]
  },
  "#scaleBarBack": {
    path: ["scaleBar", "back"],
    options: { "data-top": "top", "data-right": "right", "data-bottom": "bottom", "data-left": "left" }
  },
  "#legend": {
    path: ["legend"],
    options: {
      "data-size": "fontSize",
      "font-size": "fontSize",
      "data-x": "x",
      "data-y": "y",
      "data-columns": "columns"
    }
  },
  "#legendBox": { path: ["legend", "box"] },
  "#fogging": { path: ["fogging"] },
  "#vignette": { path: ["vignette"] },
  "#vignette-rect": {
    path: ["vignette"],
    options: { x: "x", y: "y", width: "width", height: "height", rx: "rx", ry: "ry", filter: "filter" },
    ownAttrs: false
  },
  "#oceanLayers": { path: ["ocean", "oceanLayers"], options: { layers: "outline" }, strings: ["outline"] },
  "#oceanBase": { path: ["ocean", "base"] },
  "#oceanicPattern": { path: ["ocean"], options: { href: "pattern", opacity: "patternOpacity" } },
  "#landmass": { path: ["landmass"] }
};

// The style editor's element/group selection resolves through the same route table the preset
// upgrader uses; the first path segment is the store layer to rewrite.
export function styleNodeFor(element: string, group: string): { node: object; layer: keyof Styles } | undefined {
  const selector =
    !group || group === element
      ? `#${element}`
      : element === "labels"
        ? `#labels > #${group}`
        : element === "burgIcons" || element === "anchors"
          ? `#${element} > g#${group}`
          : element === "terrs"
            ? `#terrs > #${group}`
            : `#${group}`;
  const route = routeFor(selector);
  if (!route) return undefined;
  const node = getPath(styles, route.path);
  return node ? { node, layer: route.path[0] as keyof Styles } : undefined;
}

function routeFor(selector: string): PresetRoute | undefined {
  if (selector in PRESET_ROUTES) return PRESET_ROUTES[selector];
  const label = selector.match(/^#labels > #(.+)$/);
  if (label) return { path: ["labels", "groups", label[1]], kind: "label" };
  const burg = selector.match(/^#burgIcons > g#(.+)$/);
  if (burg) return { path: ["burgIcons", "burgIcons", "groups", burg[1]], kind: "burg" };
  const anchor = selector.match(/^#anchors > g#(.+)$/);
  if (anchor) return { path: ["burgIcons", "anchors", "groups", anchor[1]], kind: "burg" };
  const emblem = selector.match(/^#emblems > #(.+)$/);
  if (emblem) return { path: ["emblems", emblem[1]], options: { "data-size": "size" } };
  return undefined;
}

const getPath = (obj: any, path: string[]): any => path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
const coerce = (v: unknown): unknown => (v === "null" ? null : v);

function fail(onUnknown: "throw" | "skip", message: string): void {
  if (onUnknown === "skip") console.warn(message);
  else throw new Error(message);
}

// overlays a legacy bag onto a node already seeded with its DEFAULT_STYLES value: an absent
// key leaves the default in place (legacy left it alone), an explicit null clears it.
function applyPresetBag(
  node: any,
  bag: Record<string, unknown>,
  route: PresetRoute,
  selector: string,
  onUnknown: "throw" | "skip"
): void {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(bag)) if (key !== "id" && !route.drop?.includes(key)) rest[key] = value;

  const seen: Record<string, unknown> = {};
  for (const [legacyKey, optionKey] of Object.entries(route.options ?? {})) {
    if (!(legacyKey in rest)) continue;
    const value = coerce(rest[legacyKey]);
    delete rest[legacyKey];
    if (optionKey in seen && seen[optionKey] !== value) {
      fail(onUnknown, `unknown legacy attribute "${legacyKey}" on "${selector}" conflicts for option "${optionKey}"`);
      continue;
    }
    seen[optionKey] = value;
    node.options[optionKey] = route.bools?.includes(optionKey)
      ? Boolean(Number(value))
      : route.strings?.includes(optionKey) && value != null
        ? String(value)
        : value;
  }

  if (node.attrs && route.ownAttrs !== false) {
    for (const key of Object.keys(rest)) {
      if (key in node.attrs) {
        node.attrs[key] = coerce(rest[key]);
        delete rest[key];
      }
    }
  }

  for (const key of Object.keys(rest)) fail(onUnknown, `unknown legacy attribute "${key}" on "${selector}"`);
}

function attrKeysAt(path: string[]): string[] {
  const node = getPath(DEFAULT_STYLES, path) as { attrs?: object } | undefined;
  return node?.attrs ? Object.keys(node.attrs) : [];
}

export function harvestAttributes(): Record<string, string[]> {
  const table: Record<string, string[]> = {};
  for (const [selector, route] of Object.entries(PRESET_ROUTES)) {
    const attrs = route.ownAttrs === false ? [] : attrKeysAt(route.path);
    table[selector] = [...new Set([...attrs, ...Object.keys(route.options ?? {}), ...(route.drop ?? [])])];
  }
  return table;
}

function harvestValue(value: string): string | number {
  if (value === "") return "";
  const n = Number(value);
  return Number.isNaN(n) ? value : n;
}

// a nullable schema attr the element does not carry becomes an explicit null, so a preset-nulled
// attr round-trips as null instead of the seeded default; a non-nullable one is omitted, keeping
// the default the schema demands. Options keep omit-means-default either way
function harvestBag(
  el: Element,
  attrs: string[],
  nullableAttrs: string[] = attrs
): Record<string, string | number | null> {
  const bag: Record<string, string | number | null> = {};
  for (const attr of attrs) {
    const inline = (el as HTMLElement).style?.[attr as any];
    const value = inline ? inline : el.getAttribute(attr);
    if (value !== null && value !== undefined) bag[attr] = harvestValue(value);
    else if (nullableAttrs.includes(attr)) bag[attr] = null;
  }
  return bag;
}

const LABEL_SCHEMA_ATTRS = Object.keys(Object.values(DEFAULT_STYLES.labels.groups)[0].attrs);
const LABEL_ATTRS = [...LABEL_SCHEMA_ATTRS, "data-dx", "data-dy", "data-size"];
const BURG_SCHEMA_ATTRS = Object.keys(Object.values(DEFAULT_STYLES.burgIcons.burgIcons.groups)[0].attrs);
const BURG_ATTRS = [...BURG_SCHEMA_ATTRS, "font-size", "size", "data-icon"];

export function stylesFromMap(root: ParentNode = document): Styles {
  const bags: Record<string, Record<string, unknown>> = {};

  for (const [selector, attrs] of Object.entries(harvestAttributes())) {
    const el = root.querySelector(selector);
    if (!el) continue;
    const route = PRESET_ROUTES[selector];
    const nullable = route.ownAttrs === false ? [] : nullableAttrsAt(route.path);
    bags[selector] = harvestBag(el, attrs, nullable);
  }
  for (const el of root.querySelectorAll("#labels > *")) {
    const name = (el as HTMLElement).dataset.group || el.id.replace(/^labels-/, "");
    if (name) bags[`#labels > #${name}`] = harvestBag(el, LABEL_ATTRS, LABEL_SCHEMA_ATTRS);
  }
  for (const el of root.querySelectorAll("#burgIcons > g")) {
    if (el.id) bags[`#burgIcons > g#${el.id}`] = harvestBag(el, BURG_ATTRS, BURG_SCHEMA_ATTRS);
  }
  for (const el of root.querySelectorAll("#anchors > g")) {
    if (el.id) bags[`#anchors > g#${el.id}`] = harvestBag(el, BURG_ATTRS, BURG_SCHEMA_ATTRS);
  }
  for (const name of ["stateEmblems", "provinceEmblems", "burgEmblems"]) {
    const el = root.querySelector(`#emblems > #${name}`);
    if (el) bags[`#emblems > #${name}`] = harvestBag(el, ["data-size"], []);
  }

  return presetFromLegacy(bags, { onUnknown: "skip" });
}

// load-only migration for maps without a store record: harvest the DOM-authoritative
// layers, overlay the domains the store owns
export function syncStylesFromMap({ hasStyleRecord = false } = {}): void {
  const harvested = stylesFromMap();
  // the labels migration seeds styles.labels from the DOM before this runs, and a legacy
  // record seeds burg groups via stylesFromLegacy; with no record at all the map's own
  // DOM groups are the only source of their styling, so the harvest keeps them
  harvested.labels = structuredClone(styles.labels);
  if (hasStyleRecord) harvested.burgIcons = structuredClone(styles.burgIcons);
  harvested.relief.options = structuredClone(styles.relief.options);
  // post-migration maps carry no rescale/data-width attrs, so the store owns these
  // options; a loaded old map's attrs win here until the load-time strip removes them
  if (!document.getElementById("markers")?.hasAttribute("rescale"))
    harvested.markers.options = structuredClone(styles.markers.options);
  if (!document.getElementById("statesHalo")?.hasAttribute("data-width"))
    harvested.states.statesHalo.options = structuredClone(styles.states.statesHalo.options);
  // gated on data-size alone: #coordinates' font-size is the zoom-derived render value, never the base
  if (!document.getElementById("coordinates")?.hasAttribute("data-size"))
    harvested.coordinates.options = structuredClone(styles.coordinates.options);
  if (!document.getElementById("ruler")?.hasAttribute("data-size"))
    harvested.rulers.options = structuredClone(styles.rulers.options);
  if (!document.getElementById("legend")?.hasAttribute("data-size"))
    harvested.legend.options.fontSize = styles.legend.options.fontSize;
  if (!document.getElementById("legend")?.hasAttribute("data-x")) {
    harvested.legend.options.x = styles.legend.options.x;
    harvested.legend.options.y = styles.legend.options.y;
  }
  if (!document.getElementById("legend")?.hasAttribute("data-columns"))
    harvested.legend.options.columns = styles.legend.options.columns;
  for (const key of ["stateEmblems", "provinceEmblems", "burgEmblems"] as const) {
    if (!document.getElementById(key)?.hasAttribute("data-size"))
      harvested.emblems[key].options = structuredClone(styles.emblems[key].options);
  }
  // per-key: goodsIcons' circle and markets' fontSize/icon are still attr-authoritative
  if (!document.getElementById("goodsIcons")?.hasAttribute("data-size"))
    harvested.goods.goodsIcons.options.size = styles.goods.goodsIcons.options.size;
  if (!document.getElementById("goodsBurgs")?.hasAttribute("data-size"))
    harvested.goods.goodsBurgs.options = structuredClone(styles.goods.goodsBurgs.options);
  if (!document.getElementById("markets")?.hasAttribute("data-size"))
    harvested.markets.options.size = styles.markets.options.size;
  for (const key of ["landHeights", "oceanHeights"] as const) {
    if (!document.getElementById(key)?.hasAttribute("scheme"))
      harvested.heightmap[key].options = structuredClone(styles.heightmap[key].options);
  }
  if (!document.getElementById("armies")?.hasAttribute("box-size"))
    harvested.military.options = structuredClone(styles.military.options);
  if (!document.getElementById("gridOverlay")?.hasAttribute("type"))
    harvested.grid.options = structuredClone(styles.grid.options);
  if (!document.getElementById("map")?.hasAttribute("data-filter"))
    harvested.map.options.dataFilter = styles.map.options.dataFilter;
  if (!document.getElementById("sea_island")?.hasAttribute("auto-filter"))
    harvested.coastline.sea_island.options.autoFilter = styles.coastline.sea_island.options.autoFilter;
  if (!document.getElementById("markets")?.hasAttribute("font-size"))
    harvested.markets.options.fontSize = styles.markets.options.fontSize;
  if (!document.getElementById("markets")?.hasAttribute("data-icon"))
    harvested.markets.options.icon = styles.markets.options.icon;
  if (!document.getElementById("goodsIcons")?.hasAttribute("data-circle"))
    harvested.goods.goodsIcons.options.circle = styles.goods.goodsIcons.options.circle;
  if (!document.getElementById("texture")?.hasAttribute("data-href"))
    harvested.texture.options = structuredClone(styles.texture.options);
  if (!document.getElementById("oceanLayers")?.hasAttribute("layers"))
    harvested.ocean.oceanLayers.options.outline = styles.ocean.oceanLayers.options.outline;
  if (!document.getElementById("scaleBar")?.hasAttribute("data-bar-size"))
    harvested.scaleBar.options = structuredClone(styles.scaleBar.options);
  if (!document.getElementById("scaleBarBack")?.hasAttribute("data-top"))
    harvested.scaleBar.back.options = structuredClone(styles.scaleBar.back.options);
  // the layer registry stamps its declared attrs after this runs, so a map predating one
  // harvests it as null; the store keeps the attr until the element itself carries it
  for (const layer of Layers.all) {
    const node = (harvested as Record<string, any>)[layer.id]?.attrs;
    const stored = (styles as Record<string, any>)[layer.id]?.attrs;
    if (!node || !stored) continue;
    const el = document.getElementById(layer.elementId);
    for (const attr of Object.keys(layer.params.attrs ?? {})) {
      if (attr in node && !el?.hasAttribute(attr)) node[attr] = stored[attr];
    }
  }
  Styles.set(harvested);
}

export function isLegacyPreset(json: object): boolean {
  return Object.keys(json).some(key => key.startsWith("#"));
}

export function isStoreStyles(json: unknown): boolean {
  return typeof json === "object" && json !== null && "map" in json;
}

export function presetFromLegacy(
  legacy: Record<string, Record<string, unknown>>,
  opts: { onUnknown?: "throw" | "skip" } = {}
): Styles {
  const onUnknown = opts.onUnknown ?? "throw";
  const built = structuredClone(DEFAULT_STYLES) as any;

  for (const [rawSelector, bag] of Object.entries(legacy)) {
    const selector = SELECTOR_ALIASES[rawSelector] ?? rawSelector;
    const route = routeFor(selector);
    if (!route) {
      fail(onUnknown, `unknown legacy selector "${selector}"`);
      continue;
    }
    if (route.kind) {
      const parent = getPath(built, route.path.slice(0, -1));
      if (!parent) {
        fail(onUnknown, `unknown legacy selector "${selector}"`);
        continue;
      }
      parent[route.path.at(-1) as string] =
        route.kind === "label" ? labelGroupFromLegacy(bag) : burgGroupFromLegacy(bag);
      continue;
    }
    const node = getPath(built, route.path);
    if (!node) {
      fail(onUnknown, `unknown legacy selector "${selector}"`);
      continue;
    }
    applyPresetBag(node, bag, route, selector, onUnknown);
  }

  return Styles.parse(built);
}

// bag[legacyKey] = node.options[optionKey], the inverse of applyPresetBag's option overlay;
// bools re-spell as 0/1 (matching every other bool-attribute writer in this codebase, not "true"/"false")
function bagFromNode(node: any, route: PresetRoute): Record<string, string | number | null> {
  const bag: Record<string, string | number | null> = route.ownAttrs === false ? {} : { ...(node.attrs ?? {}) };
  for (const [legacyKey, optionKey] of Object.entries(route.options ?? {})) {
    const value = node.options?.[optionKey];
    bag[legacyKey] = route.bools?.includes(optionKey) ? Number(value) : value;
  }
  return bag;
}

// the inverse of presetFromLegacy: store shape -> legacy selector-keyed bags, reusing
// PRESET_ROUTES/routeFor as the single source of truth for selectors and option renames
export function presetToLegacy(source: Styles): Record<string, Record<string, string | number | null>> {
  const legacy: Record<string, Record<string, string | number | null>> = {};

  for (const [selector, route] of Object.entries(PRESET_ROUTES)) {
    const node = getPath(source, route.path);
    if (node) legacy[selector] = bagFromNode(node, route);
  }

  for (const [name, group] of Object.entries(source.labels.groups)) {
    legacy[`#labels > #${name}`] = labelGroupToLegacy(group) as Record<string, string | number | null>;
  }
  for (const [name, group] of Object.entries(source.burgIcons.burgIcons.groups)) {
    legacy[`#burgIcons > g#${name}`] = burgGroupToLegacy(group, true) as Record<string, string | number | null>;
  }
  for (const [name, group] of Object.entries(source.burgIcons.anchors.groups)) {
    legacy[`#anchors > g#${name}`] = burgGroupToLegacy(group, false) as Record<string, string | number | null>;
  }
  for (const name of ["stateEmblems", "provinceEmblems", "burgEmblems"] as const) {
    const selector = `#emblems > #${name}`;
    const route = routeFor(selector) as PresetRoute;
    legacy[selector] = bagFromNode(getPath(source, route.path), route);
  }

  return legacy;
}

// the legacy preset pipeline (public/modules/ui/style-presets.js) converts through these
globalThis.stylesLegacy = {
  styleNodeFor,
  labelGroupFromLegacy,
  labelGroupToLegacy,
  labelGroupsFromLegacy,
  burgGroupFromLegacy,
  burgGroupFromElement,
  burgGroupToLegacy,
  burgGroupsFromLegacy,
  reliefFromLegacy,
  stylesFromLegacy,
  presetFromLegacy,
  presetToLegacy,
  isLegacyPreset,
  isStoreStyles,
  harvestAttributes,
  stylesFromMap,
  syncStylesFromMap
};
