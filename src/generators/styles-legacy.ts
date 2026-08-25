// Conversions between the legacy `style` object shapes and the styles store. Only migration
// edges use this: map-file save/load and legacy preset routing. Dies when those write the new
// format natively.

import "./styles";
import type { Styles } from "./styles-schema";
import { DEFAULT_STYLES } from "./styles-schema";

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
  return {
    attrs: {
      opacity: numOr(bag.opacity, 1),
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
      size: toNumber(bag["font-size"], 1),
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
  "#markets": { path: ["markets"], options: { "data-size": "size", "font-size": "fontSize", "data-icon": "icon" } },
  "#tradeAnimation": { path: ["trade"] },
  "#markers": { path: ["markers"], options: { rescale: "rescale" } },
  "#ruler": { path: ["rulers"], options: { "data-size": "fontSize", "font-size": "fontSize" } },
  "#scaleBar": {
    path: ["scaleBar"],
    options: { "data-bar-size": "barSize", "data-x": "x", "data-y": "y", "data-label": "label" }
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
  "#oceanLayers": { path: ["ocean", "oceanLayers"], options: { layers: "outline" } },
  "#oceanBase": { path: ["ocean", "base"] },
  "#oceanicPattern": { path: ["ocean"], options: { href: "pattern", opacity: "patternOpacity" } },
  "#landmass": { path: ["landmass"] }
};

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
    node.options[optionKey] = route.bools?.includes(optionKey) ? Boolean(Number(value)) : value;
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

// a schema attr the element does not carry becomes an explicit null, so a preset-nulled
// attr round-trips as null instead of the seeded default; options keep omit-means-default
function harvestBag(
  el: Element,
  attrs: string[],
  schemaAttrs: string[] = attrs
): Record<string, string | number | null> {
  const bag: Record<string, string | number | null> = {};
  for (const attr of attrs) {
    const inline = (el as HTMLElement).style?.[attr as any];
    const value = inline ? inline : el.getAttribute(attr);
    if (value !== null && value !== undefined) bag[attr] = harvestValue(value);
    else if (schemaAttrs.includes(attr)) bag[attr] = null;
  }
  return bag;
}

const LABEL_SCHEMA_ATTRS = Object.keys(Object.values(DEFAULT_STYLES.labels.groups)[0].attrs);
const LABEL_ATTRS = [...LABEL_SCHEMA_ATTRS, "data-dx", "data-dy", "data-size"];
const BURG_SCHEMA_ATTRS = Object.keys(Object.values(DEFAULT_STYLES.burgIcons.burgIcons.groups)[0].attrs);
const BURG_ATTRS = [...BURG_SCHEMA_ATTRS, "font-size", "data-icon"];

export function stylesFromMap(root: ParentNode = document): Styles {
  const bags: Record<string, Record<string, unknown>> = {};

  for (const [selector, attrs] of Object.entries(harvestAttributes())) {
    const el = root.querySelector(selector);
    if (!el) continue;
    const route = PRESET_ROUTES[selector];
    const schemaAttrs = route.ownAttrs === false ? [] : attrKeysAt(route.path);
    bags[selector] = harvestBag(el, attrs, schemaAttrs);
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

  return presetFromLegacy(bags, { onUnknown: "skip" });
}

// runs on both edges (save, and record-less old-map migration on load): harvest the
// DOM-authoritative layers, overlay the domains the store owns
export function syncStylesFromMap(): void {
  const harvested = stylesFromMap();
  harvested.labels = structuredClone(styles.labels);
  harvested.burgIcons = structuredClone(styles.burgIcons);
  for (const el of document.querySelectorAll("#burgIcons > g")) {
    if (el.id) harvested.burgIcons.burgIcons.groups[el.id] = burgGroupFromElement(el);
  }
  for (const el of document.querySelectorAll("#anchors > g")) {
    if (el.id) harvested.burgIcons.anchors.groups[el.id] = burgGroupFromElement(el);
  }
  harvested.relief.options = structuredClone(styles.relief.options);
  // post-migration maps carry no rescale/data-width attrs, so the store owns these
  // options; a loaded old map's attrs win here until the load-time strip removes them
  if (!document.getElementById("markers")?.hasAttribute("rescale"))
    harvested.markers.options = structuredClone(styles.markers.options);
  if (!document.getElementById("statesHalo")?.hasAttribute("data-width"))
    harvested.states.statesHalo.options = structuredClone(styles.states.statesHalo.options);
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
