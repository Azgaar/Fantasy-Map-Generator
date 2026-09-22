// Conversions between the legacy `style` object shapes and the styles store
import type { z } from "zod";
import { Layers } from "@/components/layers";
import { OCEAN_PATTERNS } from "@/data/ocean-patterns";
import { FONT_STYLES, FONT_WEIGHTS, LINECAPS, LINEJOINS, MAP_FILTERS } from "@/data/style-choices";
import type { StylesData } from "@/types/styles";
import { safeParseJSON } from "@/utils";
import { toColorHex } from "@/utils/colorUtils";
import { getPath } from "@/utils/objectUtils";
import { Styles } from "./styles";
import { stylesSchema } from "./styles-schema";

// selector -> store path, plus the legacy-key -> option-name renames for that node.
type PresetRoute = {
  path: string[];
  options?: Record<string, string>;
  bools?: string[];
  strings?: string[]; // options that must stay strings
  rename?: Record<string, string>; // legacy attr -> the attr the store keeps it as
  kind?: "label" | "burg" | "anchor" | "route" | "lake";
  drop?: string[];
  ownAttrs?: boolean;
};

const SELECTOR_ALIASES: Record<string, string> = {
  "#terrs #landHeights": "#terrs > #landHeights",
  "#terrs #oceanHeights": "#terrs > #oceanHeights"
};

const PRESET_ROUTES: Record<string, PresetRoute> = {
  // legacy kept the pick in data-filter, the store in the filter attr: normalizeStyles folds the option into it
  "#map": { path: ["map"], options: { "data-filter": "dataFilter" }, drop: ["background-color"] },
  "#armies": { path: ["military"], options: { "box-size": "boxSize" }, drop: ["font-size"] }, // sized from the box
  "#biomes": { path: ["biomes"], drop: ["mask"] },
  "#cells": { path: ["cells"], rename: { opacity: "stroke-opacity" } },
  "#gridOverlay": { path: ["grid"], options: { type: "type", scale: "scale", dx: "dx", dy: "dy" } },
  "#coordinates": { path: ["coordinates"], rename: { "data-size": "font-size" }, drop: ["font-size"] },
  "#compass": { path: ["compass"], drop: ["shape-rendering"] },
  "#compass > use": { path: ["compass", "groups", "compassRose"] },
  "#rivers": { path: ["rivers"] },
  "#freshwater": { path: ["lakes", "groups", "freshwater"] },
  "#salt": { path: ["lakes", "groups", "salt"] },
  "#sinkhole": { path: ["lakes", "groups", "sinkhole"] },
  "#frozen": { path: ["lakes", "groups", "frozen"] },
  "#lava": { path: ["lakes", "groups", "lava"] },
  "#dry": { path: ["lakes", "groups", "dry"] },
  "#sea_island": {
    path: ["coastline", "groups", "sea_island"],
    drop: ["auto-filter", "stroke-dasharray", "stroke-linecap"]
  },
  "#lake_island": { path: ["coastline", "groups", "lake_island"], drop: ["stroke-dasharray", "stroke-linecap"] },
  "#terrs > #landHeights": {
    path: ["heightmap", "groups", "landHeights"],
    options: {
      scheme: "scheme",
      terracing: "terracing",
      skip: "skip",
      relax: "relax",
      curve: "curve"
    }
  },
  "#terrs > #oceanHeights": {
    path: ["heightmap", "groups", "oceanHeights"],
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
  "#statesBody": { path: ["states", "groups", "statesBody"] },
  // #statesHalo's stroke-width is the zoom-derived render value; data-width is the base
  "#statesHalo": {
    path: ["states", "groups", "statesHalo"],
    rename: { "data-width": "stroke-width" },
    drop: ["stroke-width"]
  },
  "#provs": { path: ["provinces"], drop: ["data-size", "fill", "font-size", "font-family"] },
  "#zones": { path: ["zones"] },
  "#stateBorders": { path: ["borders", "groups", "stateBorders"] },
  "#provinceBorders": { path: ["borders", "groups", "provinceBorders"] },
  "#roads": { path: ["routes", "groups", "roads"] },
  "#trails": { path: ["routes", "groups", "trails"] },
  "#searoutes": { path: ["routes", "groups", "searoutes"] },
  "#journeys": { path: ["journeys"] },
  "#temperature": { path: ["temperature"], rename: { opacity: "stroke-opacity" } },
  "#ice": { path: ["ice"] },
  "#prec": { path: ["precipitation"] },
  "#population": { path: ["population"] },
  "#rural": { path: ["population", "groups", "rural"] },
  "#urban": { path: ["population", "groups", "urban"] },
  "#emblems": { path: ["emblems"] },
  "#texture": { path: ["texture"], options: { "data-href": "href", "data-x": "x", "data-y": "y" } },
  "#goodsCells": { path: ["goods", "groups", "goodsCells"] },
  "#goodsIcons": {
    path: ["goods", "groups", "goodsIcons"],
    options: { "data-size": "size", "data-circle": "circle" },
    bools: ["circle"]
  },
  "#goodsBurgs": { path: ["goods", "groups", "goodsBurgs"], options: { "data-size": "size" } },
  "#markets": {
    path: ["markets"],
    options: { "data-size": "size", "font-size": "iconSize", "data-icon": "icon" },
    strings: ["icon"],
    drop: ["opacity", "fill"]
  },
  "#tradeAnimation": { path: ["trade"] },
  "#markers": { path: ["markers"], drop: ["rescale"] }, // markers are sized in em: they follow the zoom as text does
  "#ruler": { path: ["rulers"], rename: { "data-size": "font-size" } },
  "#scaleBar": {
    path: ["scaleBar"],
    options: { "data-bar-size": "barSize", "data-x": "x", "data-y": "y", "data-label": "label" },
    strings: ["label"]
  },
  "#scaleBarBack": {
    path: ["scaleBar", "groups", "back"],
    options: { "data-top": "top", "data-right": "right", "data-bottom": "bottom", "data-left": "left" }
  },
  "#legend": {
    path: ["legend"],
    options: { "data-columns": "columns" },
    rename: { "data-size": "font-size" },
    drop: ["data-x", "data-y"]
  },
  "#legendBox": { path: ["legend", "groups", "box"] },
  "#fogging": { path: ["fogging"] },
  "#vignette": { path: ["vignette"] },
  "#vignette-rect": {
    path: ["vignette"],
    options: { x: "x", y: "y", width: "width", height: "height", rx: "rx", ry: "ry", filter: "filter" },
    ownAttrs: false
  },
  "#oceanLayers": { path: ["ocean", "groups", "oceanLayers"], options: { layers: "outline" }, strings: ["outline"] },
  "#oceanBase": { path: ["ocean", "groups", "base"] },
  "#oceanicPattern": { path: ["ocean", "groups", "pattern"] },
  "#landmass": { path: ["landmass"] }
};

// layers that can carry an opacity the store keeps on their style groups alone, see the harvest
const STRANDED_OPACITY_LAYERS = [
  "regions",
  "terrs",
  "lakes",
  "coastline",
  "borders",
  "routes",
  "labels",
  "burgIcons",
  "anchors"
] as const;

const DEFAULT_ROUTE_GROUPS = Object.keys(Styles.defaults.routes.groups);
const DEFAULT_LAKE_GROUPS = Object.keys(Styles.defaults.lakes.groups);
// the attr and option keys the schema types as colors
const COLOR_KEYS = new Set(["fill", "stroke", "color", "shore"]);
const LABEL_SCHEMA_ATTRS = Object.keys(Object.values(Styles.defaults.labels.groups)[0].attrs);
const BURG_SCHEMA_ATTRS = Object.keys(Object.values(Styles.defaults.burgIcons.groups)[0].groups.icons.attrs);

// The v1.150.0 style migration auto-update
export async function migrateStyles(legacyStyleString: string | undefined): Promise<string> {
  const legacyStyleObj = legacyStyleString ? safeParseJSON(legacyStyleString) : undefined;
  if (legacyStyleObj) migrateLegacyStyleObj(legacyStyleObj); // updates pre-v1.150 style object

  harvestStylesFromSvg({ hasStyleRecord: Boolean(legacyStyleObj) });

  stripMigratedAttributes();
  return JSON.stringify(styles);
}

// the shape of the legacy JS `style` object this upgrader absorbs
type LegacyStyleObj = {
  labels?: { groups?: Record<string, unknown> };
  burgIcons?: Record<string, unknown>;
  anchors?: Record<string, unknown>;
  relief?: { set?: unknown; size?: unknown; density?: unknown };
};

function migrateLegacyStyleObj(obj: unknown): void {
  const legacy = (typeof obj === "object" && obj !== null ? obj : {}) as LegacyStyleObj;
  if (legacy.labels?.groups)
    styles.labels.groups = Object.fromEntries(
      Object.entries(legacy.labels.groups).map(([name, group]) => [name, labelGroupFromLegacy(group)])
    );

  if (legacy.burgIcons || legacy.anchors) {
    const groups = styles.burgIcons.groups;
    const names = new Set([...Object.keys(legacy.burgIcons ?? {}), ...Object.keys(legacy.anchors ?? {})]);
    for (const name of names) {
      groups[name] = {
        groups: {
          icons: burgGroupFromLegacy(legacy.burgIcons?.[name]),
          anchors: anchorGroupFromLegacy(legacy.anchors?.[name])
        }
      };
    }
  }

  if (legacy.relief)
    styles.relief.options = {
      set: Relief.sets.find(set => set === legacy.relief?.set) ?? "simple",
      size: toNumber(legacy.relief.size, 1),
      density: toNumber(legacy.relief.density, 0.4)
    };
}

export function stylesFromMap(root: ParentNode = document): StylesData {
  const bags: Record<string, Record<string, unknown>> = {};

  for (const [selector, attrs] of Object.entries(harvestAttributes())) {
    const route = PRESET_ROUTES[selector];
    const nullable = route.ownAttrs === false ? [] : nullableAttrsAt(route.path);
    const el = root.querySelector(selector);

    if (!el) {
      // a map predating the child groups styles the layer group itself; leaving the child at its
      // default would stamp it over the parent, so record the parent's attrs as "not set" here
      const parent = layerElementFor(route, root);
      const inherited = parent ? nullable.filter(attr => parent.hasAttribute(attr)) : [];
      if (inherited.length) bags[selector] = Object.fromEntries(inherited.map(attr => [attr, null]));
      continue;
    }

    bags[selector] = harvestBag(el, attrs, nullable);
  }

  for (const el of root.querySelectorAll("#labels > *")) {
    const name = (el as HTMLElement).dataset.group || el.id.replace(/^labels-/, "");
    if (name)
      bags[`#labels > #${name}`] = harvestBag(
        el,
        [...LABEL_SCHEMA_ATTRS, "data-dx", "data-dy", "data-size"],
        LABEL_SCHEMA_ATTRS
      );
  }

  for (const el of root.querySelectorAll<SVGGElement>("#routes > g")) {
    if (el.id) el.dataset.group = el.id;
    if (el.id && !DEFAULT_ROUTE_GROUPS.includes(el.id)) {
      bags[`#routes > g#${el.id}`] = harvestBag(el, Object.keys(Object.values(Styles.defaults.routes.groups)[0].attrs));
    }
  }

  for (const el of root.querySelectorAll<SVGGElement>("#lakes > g")) {
    if (el.id) el.dataset.group = el.id;
    if (el.id && !DEFAULT_LAKE_GROUPS.includes(el.id)) {
      // no nullables: an attr the custom group never carried keeps the freshwater default
      bags[`#lakes > g#${el.id}`] = harvestBag(el, Object.keys(Styles.defaults.lakes.groups.freshwater.attrs), []);
    }
  }

  for (const el of root.querySelectorAll("#burgIcons > g")) {
    if (el.id)
      bags[`#burgIcons > g#${el.id}`] = harvestBag(
        el,
        [...BURG_SCHEMA_ATTRS, "font-size", "size", "data-icon"],
        BURG_SCHEMA_ATTRS
      );
  }

  for (const el of root.querySelectorAll("#anchors > g")) {
    if (el.id)
      bags[`#anchors > g#${el.id}`] = harvestBag(
        el,
        [...BURG_SCHEMA_ATTRS, "font-size", "size", "data-icon"],
        BURG_SCHEMA_ATTRS
      );
  }

  for (const name of ["stateEmblems", "provinceEmblems", "burgEmblems"]) {
    const el = root.querySelector(`#emblems > #${name}`);
    if (el) bags[`#emblems > #${name}`] = harvestBag(el, ["data-size"], []);
  }

  return presetFromLegacy(bags, { onUnknown: "skip" });
}

// migration for pre v1.150 maps: harvest the DOM
export function harvestStylesFromSvg({ hasStyleRecord = false } = {}): void {
  const harvested = stylesFromMap();
  harvested.labels = structuredClone(styles.labels);
  // Empty legacy records need the saved SVG styles.
  if (hasStyleRecord && Object.keys(styles.burgIcons.groups).length) {
    harvested.burgIcons.groups = structuredClone(styles.burgIcons.groups);
  }
  harvested.relief.options = structuredClone(styles.relief.options);

  // the pre-v1.150 style editor wrote to the layer group itself whenever the layer had no groups
  const strandedOpacity: Record<(typeof STRANDED_OPACITY_LAYERS)[number], { attrs: { opacity: number | null } }[]> = {
    regions: [harvested.states.groups.statesBody],
    terrs: Object.values(harvested.heightmap.groups),
    lakes: Object.values(harvested.lakes.groups),
    coastline: Object.values(harvested.coastline.groups),
    borders: Object.values(harvested.borders.groups),
    routes: Object.values(harvested.routes.groups),
    labels: Object.values(harvested.labels.groups),
    burgIcons: Object.values(harvested.burgIcons.groups).map(entry => entry.groups.icons),
    anchors: Object.values(harvested.burgIcons.groups).map(entry => entry.groups.anchors)
  };
  for (const [layer, groups] of Object.entries(strandedOpacity)) {
    const opacity = document.getElementById(layer)?.getAttribute("opacity");
    if (opacity === null || opacity === undefined) continue;
    for (const group of groups) group.attrs.opacity = Number(opacity) || null;
  }

  if (!document.getElementById("legend")?.hasAttribute("data-columns"))
    harvested.legend.options.columns = styles.legend.options.columns;
  for (const key of ["stateEmblems", "provinceEmblems", "burgEmblems"] as const) {
    if (!document.getElementById(key)?.hasAttribute("data-size"))
      harvested.emblems.groups[key].options = structuredClone(styles.emblems.groups[key].options);
  }
  // per-key: goodsIcons' circle and markets' fontSize/icon are still attr-authoritative
  if (!document.getElementById("goodsIcons")?.hasAttribute("data-size"))
    harvested.goods.groups.goodsIcons.options.size = styles.goods.groups.goodsIcons.options.size;
  if (!document.getElementById("goodsBurgs")?.hasAttribute("data-size"))
    harvested.goods.groups.goodsBurgs.options = structuredClone(styles.goods.groups.goodsBurgs.options);
  if (!document.getElementById("markets")?.hasAttribute("data-size"))
    harvested.markets.options.size = styles.markets.options.size;
  for (const key of ["landHeights", "oceanHeights"] as const) {
    if (!document.getElementById(key)?.hasAttribute("scheme"))
      harvested.heightmap.groups[key].options = structuredClone(styles.heightmap.groups[key].options);
  }
  if (!document.getElementById("armies")?.hasAttribute("box-size"))
    harvested.military.options = structuredClone(styles.military.options);
  if (!document.getElementById("gridOverlay")?.hasAttribute("type"))
    harvested.grid.options = structuredClone(styles.grid.options);
  if (!document.getElementById("markets")?.hasAttribute("font-size"))
    harvested.markets.options.iconSize = styles.markets.options.iconSize;
  if (!document.getElementById("markets")?.hasAttribute("data-icon"))
    harvested.markets.options.icon = styles.markets.options.icon;
  if (!document.getElementById("goodsIcons")?.hasAttribute("data-circle"))
    harvested.goods.groups.goodsIcons.options.circle = styles.goods.groups.goodsIcons.options.circle;
  if (!document.getElementById("texture")?.hasAttribute("data-href"))
    harvested.texture.options = structuredClone(styles.texture.options);
  if (!document.getElementById("oceanLayers")?.hasAttribute("layers"))
    harvested.ocean.groups.oceanLayers.options.outline = styles.ocean.groups.oceanLayers.options.outline;
  if (!document.getElementById("scaleBar")?.hasAttribute("data-bar-size"))
    harvested.scaleBar.options = structuredClone(styles.scaleBar.options);
  if (!document.getElementById("scaleBarBack")?.hasAttribute("data-top"))
    harvested.scaleBar.groups.back.options = structuredClone(styles.scaleBar.groups.back.options);
  // the layer registry stamps its declared attrs after this runs, so a map predating one
  // harvests it as null; the store keeps the attr until the element itself carries it
  for (const layer of Layers.all) {
    const node = (harvested as unknown as Record<string, { attrs?: Record<string, unknown> }>)[layer.id]?.attrs;
    const stored = (styles as unknown as Record<string, { attrs?: Record<string, unknown> }>)[layer.id]?.attrs;
    if (!node || !stored) continue;
    const el = document.getElementById(layer.elementId);
    for (const attr of Object.keys(layer.params.attrs ?? {})) {
      if (attr in node && !el?.hasAttribute(attr)) node[attr] = stored[attr];
    }
  }
  normalizeColorValues(harvested);
  Styles.set(harvested);
}

function routeFor(selector: string): PresetRoute | undefined {
  if (selector in PRESET_ROUTES) return PRESET_ROUTES[selector];
  const label = selector.match(/^#labels > #(.+)$/);
  if (label) return { path: ["labels", "groups", label[1]], kind: "label" };
  const burg = selector.match(/^#burgIcons > g#(.+)$/);
  if (burg) return { path: ["burgIcons", "groups", burg[1], "groups", "icons"], kind: "burg" };
  const anchor = selector.match(/^#anchors > g#(.+)$/);
  if (anchor) return { path: ["burgIcons", "groups", anchor[1], "groups", "anchors"], kind: "anchor" };
  const routeGroup = selector.match(/^#routes > g#(.+)$/);
  if (routeGroup) return { path: ["routes", "groups", routeGroup[1]], kind: "route" };
  const lakeGroup = selector.match(/^#lakes > g#(.+)$/);
  if (lakeGroup) return PRESET_ROUTES[`#${lakeGroup[1]}`] ?? { path: ["lakes", "groups", lakeGroup[1]], kind: "lake" };
  const emblem = selector.match(/^#emblems > #(.+)$/);
  if (emblem) return { path: ["emblems", "groups", emblem[1]], options: { "data-size": "size" } };
  return undefined;
}

function fail(onUnknown: "throw" | "skip", message: string): void {
  if (onUnknown === "skip") console.warn(message);
  else throw new Error(message);
}

// a node of a preset record: its attrs and options bags, navigated by the route table
type PresetNode = { attrs?: Record<string, unknown>; options?: Record<string, unknown> };

// overlays a legacy bag onto a node already seeded with its Styles.defaults value: an absent
// key leaves the default in place (legacy left it alone), an explicit null clears it.
function applyPresetBag(
  node: PresetNode,
  bag: Record<string, unknown>,
  route: PresetRoute,
  selector: string,
  onUnknown: "throw" | "skip"
): void {
  // a route may map a legacy attr into an option the schema no longer declares; normalizeStyles folds it away
  if (route.options && !node.options) node.options = {};
  const options = node.options;
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(bag)) if (key !== "id" && !route.drop?.includes(key)) rest[key] = value;
  for (const [from, to] of Object.entries(route.rename ?? {})) {
    if (!(from in rest)) continue;
    // the legacy base (data-size, data-width, opacity) outranks the render value beside it
    rest[to] = rest[from];
    delete rest[from];
  }

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
    if (options)
      options[optionKey] = route.bools?.includes(optionKey)
        ? Boolean(Number(value))
        : route.strings?.includes(optionKey) && value != null
          ? String(value)
          : value;
  }

  if (node.attrs && route.ownAttrs !== false) {
    for (const key of Object.keys(rest)) {
      if (key in node.attrs) {
        node.attrs[key] = coerceLegacyAttr(key, rest[key]);
        delete rest[key];
      }
    }
  }

  for (const key of Object.keys(rest)) fail(onUnknown, `unknown legacy attribute "${key}" on "${selector}"`);
}

function attrKeysAt(path: string[]): string[] {
  const node = getPath(Styles.defaults, path) as { attrs?: object } | undefined;
  return node?.attrs ? Object.keys(node.attrs) : [];
}

export function harvestAttributes(): Record<string, string[]> {
  const table: Record<string, string[]> = {};
  for (const [selector, route] of Object.entries(PRESET_ROUTES)) {
    const attrs = route.ownAttrs === false ? [] : attrKeysAt(route.path);
    table[selector] = [
      ...new Set([
        ...attrs,
        ...Object.keys(route.options ?? {}),
        ...Object.keys(route.rename ?? {}),
        ...(route.drop ?? [])
      ])
    ];
  }
  return table;
}

// the group a child route hangs off: #sea_island's is #coastline, #landHeights' is #terrs
function layerElementFor(route: PresetRoute, root: ParentNode): Element | null {
  if (route.path.length < 2) return null;
  const layer = Layers.all.find(({ id }) => id === route.path[0]);
  return layer ? root.querySelector(`#${layer.elementId}`) : null;
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
    const inline = (el as HTMLElement).style?.[attr as unknown as keyof CSSStyleDeclaration];
    const raw = typeof inline === "string" && inline ? inline : el.getAttribute(attr);
    if (raw !== null && raw !== undefined) {
      // the browser serializes a computed color as rgb(), the store keeps hex
      const value = harvestValue(raw);
      bag[attr] = COLOR_KEYS.has(attr) && typeof value === "string" ? toColorHex(value) : value;
    } else if (nullableAttrs.includes(attr)) bag[attr] = null;
  }
  return bag;
}

/** A legacy '#'-keyed preset carries the attr bag directly; a store-format preset (every system
 * preset since v1.150) resolves through the same selector route table the preset upgrader uses */
export function presetBagFor(
  preset: Record<string, unknown>,
  ...selectors: string[]
): Record<string, string | number | null> | undefined {
  for (const selector of selectors) {
    if (!isStoreStyles(preset)) {
      const bag = preset[selector];
      if (bag) return bag as Record<string, string | number | null>;
      continue;
    }
    const route = routeFor(selector);
    const node = route && (getPath(preset, route.path) as { attrs?: Record<string, string | number | null> });
    if (node?.attrs) return node.attrs;
  }
  return undefined;
}

// v1.145-1.147 saved maps with the layer styling stripped out; `preset` is the map's style preset record
export function restoreStrippedLayerStyles(preset: Record<string, unknown>): void {
  const isBareGroup = (group: Element, declared: Record<string, string> = {}): boolean => {
    const ignored = new Set(["id", "style", "data-layer", "data-group", ...Object.keys(declared)]);
    return Array.from(group.attributes).every(attribute => ignored.has(attribute.name));
  };

  const restore = (
    id: string,
    style: Record<string, string | number | null> | undefined,
    declared?: Record<string, string>
  ): void => {
    const group = document.getElementById(id);
    if (!style || group?.tagName !== "g" || !isBareGroup(group, declared)) return;

    for (const [name, value] of Object.entries(style)) {
      if (value === null || value === "null") continue;
      if (id === "terrain" && ["set", "size", "density"].includes(name)) continue;
      group.setAttribute(name, String(value));
    }
  };

  for (const layer of Layers.all) {
    restore(layer.elementId, presetBagFor(preset, `#${layer.elementId}`), layer.params.attrs);
    for (const child of layer.children) {
      restore(child.id, presetBagFor(preset, `#${child.id}`, `#${layer.elementId} > #${child.id}`), child.attrs);
    }
  }
}

// the attributes the store took over. They are dropped rather than left in place because the
// harvest above reads them: a stale one beside a store record would outrank it forever
export function stripMigratedAttributes(): void {
  const strip = (id: string, ...attrs: string[]) => {
    const el = document.getElementById(id);
    for (const attr of attrs) el?.removeAttribute(attr);
  };

  // layer-level opacity the style groups took over on harvest: left here it composites over them
  for (const layer of STRANDED_OPACITY_LAYERS) strip(layer, "opacity");
  // the store keeps the legacy opacity of these as stroke-opacity; left here it composites over it
  for (const id of ["cells", "temperature"]) strip(id, "opacity");
  strip("markers", "rescale", "pinned");
  strip("statesHalo", "data-width");
  strip("coordinates", "data-size");
  strip("ruler", "data-size", "font-size");
  strip("legend", "data-size", "data-x", "data-y", "data-columns");
  for (const id of ["stateEmblems", "provinceEmblems", "burgEmblems", "goodsBurgs"]) strip(id, "data-size");
  for (const id of ["landHeights", "oceanHeights"]) strip(id, "scheme", "terracing", "skip", "relax", "curve");
  strip("oceanHeights", "data-render");
  strip("armies", "box-size");
  strip("gridOverlay", "type", "scale", "dx", "dy");
  strip("map", "data-filter");
  strip("sea_island", "auto-filter");
  strip("markets", "data-size", "font-size", "data-icon");
  strip("goodsIcons", "data-size", "data-circle");
  strip("texture", "data-href", "data-x", "data-y");
  strip("oceanLayers", "layers");
  strip("scaleBar", "data-bar-size", "data-x", "data-y", "data-label");
  strip("scaleBarBack", "data-top", "data-right", "data-bottom", "data-left");
  for (const el of document.querySelectorAll("#labels > *")) {
    el.removeAttribute("data-dx");
    el.removeAttribute("data-dy");
  }
}

// attrs that meant "not set" as "" or "inherit" before the schema pinned their formats (v1.154.0)
const EMPTY_MEANS_UNSET = new Set(["filter", "mask", "stroke-dasharray"]);
const INHERIT_MEANS_UNSET = new Set(["stroke-linecap", "stroke-linejoin"]);

// the fields the schema pins to a closed list, by their store path: a value outside it is "not set"
const CHOICE_AT: Record<string, Record<string, string>> = {
  "map.attrs.filter": MAP_FILTERS,
  "ocean.groups.pattern.attrs.href": OCEAN_PATTERNS
};

// a font size used to take any unit; the schema pins one per element, so the number keeps its value and
// takes that unit: a label group is relative to the layer (which is 100px before the zoom), the rest absolute
const fontSizeWithUnit = (path: string[], value: string): string => {
  const size = Number.parseFloat(value);
  if (!Number.isFinite(size)) return value;
  return `${size}${path[0] === "labels" && path[1] === "groups" ? "%" : "px"}`;
};

// a record node walked by key, without committing to the shape a given version wrote
type ShapeNode = { attrs?: Record<string, unknown>; options?: Record<string, unknown>; [key: string]: unknown };

const asNode = (value: unknown): ShapeNode | undefined =>
  typeof value === "object" && value !== null ? (value as ShapeNode) : undefined;

// the fixed children that moved under their element's `groups` in v1.154.0
const FOLDED_CHILDREN: Record<string, string[]> = {
  borders: ["stateBorders", "provinceBorders"],
  coastline: ["sea_island", "lake_island"],
  compass: ["compassRose"],
  emblems: ["stateEmblems", "provinceEmblems", "burgEmblems"],
  goods: ["goodsCells", "goodsIcons", "goodsBurgs"],
  heightmap: ["landHeights", "oceanHeights"],
  legend: ["box"],
  ocean: ["base", "pattern", "oceanLayers", "oceanWaves"],
  population: ["rural", "urban"],
  scaleBar: ["back"],
  states: ["statesBody", "statesHalo"]
};

/** v1.154.0 folded every fixed named child under its element's `groups` and merged the two burg records */
function foldChildrenIntoGroups(root: ShapeNode): void {
  const nodeAt = (parent: ShapeNode, key: string): ShapeNode => {
    let node = asNode(parent[key]);
    if (!node) {
      node = {};
      parent[key] = node;
    }
    return node;
  };

  for (const [element, children] of Object.entries(FOLDED_CHILDREN)) {
    const node = asNode(root[element]);
    if (!node) continue;
    const groups = nodeAt(node, "groups");
    for (const child of children) {
      if (node[child] === undefined) continue;
      groups[child] = node[child];
      delete node[child];
    }
  }

  // the two burg records, keyed by the same group names, became the icons and anchors parts
  const element = asNode(root.burgIcons);
  if (!element) return;

  const oldIcons = asNode(element.burgIcons)?.groups as Record<string, unknown> | undefined;
  const oldAnchors = asNode(element.anchors)?.groups as Record<string, unknown> | undefined;
  if (!oldIcons && !oldAnchors) return;

  const groups = nodeAt(element, "groups");
  const partsOf = (name: string): ShapeNode => nodeAt(nodeAt(groups, name), "groups");
  for (const [name, part] of Object.entries(oldIcons ?? {})) partsOf(name).icons = part;
  for (const [name, part] of Object.entries(oldAnchors ?? {})) partsOf(name).anchors = part;
  delete element.burgIcons;
  delete element.anchors;
}

// version ? folded the fields that mirrored or duplicated an attr into the attr itself
function upgradeShape(record: unknown): void {
  const root = asNode(record);
  if (!root) return;
  foldChildrenIntoGroups(root);

  const px = (n: unknown) => (typeof n === "number" ? `${n}px` : n);
  const attrs = (node: ShapeNode): Record<string, unknown> => (node.attrs ??= {});
  // an option that became an attr; the options bag goes when nothing is left in it
  const toAttr = (node: unknown, option: string, attr: string, map: (v: unknown) => unknown = v => v) => {
    const target = asNode(node);
    const options = target?.options;
    if (!target || !options) return;
    if (options[option] !== undefined) attrs(target)[attr] = map(options[option]);
    delete options[option];
    if (!Object.keys(options).length) delete target.options;
  };
  const rename = (bag: unknown, from: string, to: string) => {
    const target = asNode(bag);
    if (!target || target[from] === undefined) return;
    target[to] = target[from];
    delete target[from];
  };

  toAttr(root.map, "dataFilter", "filter", picked => (picked ? `url(#filter-${picked})` : null));
  const ocean = asNode(root.ocean);
  if (ocean) {
    let groups = asNode(ocean.groups);
    if (!groups) {
      groups = {};
      ocean.groups = groups;
    }
    if (ocean.options && "pattern" in ocean.options) {
      const { pattern, patternOpacity } = ocean.options as { pattern: unknown; patternOpacity: unknown };
      groups.pattern = { attrs: { href: pattern, opacity: patternOpacity ?? 1 } };
      delete (ocean.options as Record<string, unknown>).pattern;
      delete (ocean.options as Record<string, unknown>).patternOpacity;
    }
  }
  toAttr(asNode(asNode(root.states)?.groups)?.statesHalo, "width", "stroke-width");
  const military = asNode(root.military);
  if (military?.options) delete military.options.fontSize; // the renderer sizes the font from the box
  if (military?.attrs) delete military.attrs["font-size"];
  const labels = asNode(root.labels);
  if (labels) delete labels.attrs; // the zoom sets the layer font the groups size from
  toAttr(root.coordinates, "fontSize", "font-size", px);
  toAttr(root.rulers, "fontSize", "font-size", px);
  toAttr(root.legend, "fontSize", "font-size", px);
  const legendOptions = asNode(root.legend)?.options;
  if (legendOptions) for (const key of ["x", "y"]) delete legendOptions[key];
  const scaleBar = asNode(root.scaleBar);
  if (scaleBar?.attrs) scaleBar.attrs["font-size"] = px(scaleBar.attrs["font-size"] ?? 10);
  rename(asNode(root.temperature)?.attrs, "opacity", "stroke-opacity");
  rename(asNode(root.cells)?.attrs, "opacity", "stroke-opacity");
  const biomes = asNode(root.biomes);
  if (biomes?.attrs) delete biomes.attrs.mask; // the schema dropped the mask
  rename(asNode(root.markets)?.options, "fontSize", "iconSize");
  const markers = asNode(root.markers);
  if (markers) delete markers.options;
  const seaIsland = asNode(asNode(asNode(root.coastline)?.groups)?.sea_island);
  if (seaIsland) delete seaIsland.options;
  // the schema dropped the coastline dash/linecap and the markets fill/opacity
  for (const key of ["sea_island", "lake_island"]) {
    const attrs = asNode(asNode(asNode(root.coastline)?.groups)?.[key])?.attrs;
    if (attrs) for (const attr of ["stroke-dasharray", "stroke-linecap"]) delete attrs[attr];
  }
  const marketAttrs = asNode(root.markets)?.attrs;
  if (marketAttrs) for (const attr of ["fill", "opacity"]) delete marketAttrs[attr];
  const compassAttrs = asNode(root.compass)?.attrs;
  if (compassAttrs) delete compassAttrs["shape-rendering"];
  const landHeights = asNode(asNode(asNode(root.heightmap)?.groups)?.landHeights);
  if (landHeights?.options) delete landHeights.options.render;
}

/** Rewrite a store-format record in place so it matches the current schema: the shape and the string formats */
export function normalizeStyles<T>(record: T): T {
  if (typeof record === "object" && record !== null) upgradeShape(record);
  const visit = (node: unknown, path: string[], bag: boolean): void => {
    if (typeof node !== "object" || node === null) return;
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "object") {
        visit(value, [...path, key], key === "attrs" || key === "options");
        continue;
      }
      if (!bag || typeof value !== "string") continue;
      const trimmed = value.trim();
      // a fixed-list value the schema does not know means "not set", not a substituted default look
      const choices = CHOICE_AT[[...path, key].join(".")];
      if (choices) {
        (node as Record<string, unknown>)[key] = trimmed in choices ? trimmed : null;
        continue;
      }
      const unset =
        (EMPTY_MEANS_UNSET.has(key) && trimmed === "") || (INHERIT_MEANS_UNSET.has(key) && trimmed === "inherit");
      (node as Record<string, unknown>)[key] = unset
        ? null
        : key === "font-size"
          ? fontSizeWithUnit(path, trimmed)
          : key === "icon" && path[0] === "burgIcons"
            ? burgIconId(trimmed)
            : trimmed;
    }
  };
  visit(record, [], false);
  normalizeColorValues(record);
  return record;
}

/** Convert every color-typed attr and option in a store record to hex, in place */
export function normalizeColorValues(record: unknown): void {
  const visit = (node: unknown, bag: boolean): void => {
    if (typeof node !== "object" || node === null) return;
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "object") {
        visit(value, key === "attrs" || key === "options");
        continue;
      }
      if (bag && typeof value === "string" && COLOR_KEYS.has(key)) {
        (node as Record<string, unknown>)[key] = toColorHex(value);
      }
    }
  };
  visit(record, false);
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
): StylesData {
  const onUnknown = opts.onUnknown ?? "throw";
  const built = structuredClone(Styles.defaults) as unknown as StylesData;

  for (const [rawSelector, bag] of Object.entries(legacy)) {
    const selector = SELECTOR_ALIASES[rawSelector] ?? rawSelector;
    const route = routeFor(selector);
    if (!route) {
      fail(onUnknown, `unknown legacy selector "${selector}"`);
      continue;
    }
    if (route.kind) {
      if (route.kind === "burg" || route.kind === "anchor") {
        // `#burgIcons > g#name` and `#anchors > g#name` are the two parts of one burg group
        const name = route.path[2];
        const groups = built.burgIcons.groups;
        const entry = groups[name] ?? structuredClone(groups.town ?? Object.values(groups)[0]);
        if (route.kind === "burg") entry.groups.icons = burgGroupFromLegacy(bag);
        else entry.groups.anchors = anchorGroupFromLegacy(bag);
        groups[name] = entry;
        continue;
      }
      const parent = getPath(built, route.path.slice(0, -1)) as Record<string, unknown> | undefined;
      if (!parent) {
        fail(onUnknown, `unknown legacy selector "${selector}"`);
        continue;
      }
      const fromLegacy =
        route.kind === "label"
          ? labelGroupFromLegacy
          : route.kind === "lake"
            ? lakeGroupFromLegacy
            : routeGroupFromLegacy;
      parent[route.path.at(-1) as string] = fromLegacy(bag);
      continue;
    }
    const node = getPath(built, route.path) as PresetNode | undefined;
    if (!node) {
      fail(onUnknown, `unknown legacy selector "${selector}"`);
      continue;
    }
    applyPresetBag(node, bag, route, selector, onUnknown);
  }

  return Styles.parse(normalizeStyles(built));
}

export function labelGroupFromLegacy(legacy: unknown): StylesData["labels"]["groups"][string] {
  const bag = legacy as Record<string, unknown>;
  const opacity = numOr(bag.opacity, 1);
  return {
    attrs: {
      opacity: opacity === 0 ? 1 : opacity,
      fill: strOr(bag.fill, "#3e3e4b"),
      "fill-opacity": numOr(bag["fill-opacity"], null),
      stroke: strOr(bag.stroke, "#3a3a3a"),
      "stroke-opacity": numOr(bag["stroke-opacity"], null),
      "stroke-width": numOr(bag["stroke-width"], 0) ?? 0,
      "stroke-dasharray": strOr(bag["stroke-dasharray"], null),
      "stroke-linecap": oneOf(bag["stroke-linecap"], LINECAP_VALUES),
      "stroke-linejoin": oneOf(bag["stroke-linejoin"], LINEJOIN_VALUES),
      "letter-spacing": numOr(bag["letter-spacing"], 0),
      "font-size": strOr(bag["data-size"], null) ?? strOr(bag["font-size"], "18%") ?? "18%",
      "font-family": strOr(bag["font-family"], "Almendra SC") ?? "Almendra SC",
      "font-style": oneOf(bag["font-style"], FONT_STYLE_VALUES),
      "font-weight": oneOf(numOr(bag["font-weight"], null), FONT_WEIGHTS),
      style: labelStyleFromLegacy(bag),
      filter: strOr(bag.filter, null)
    }
  };
}

function labelStyleFromLegacy(bag: Record<string, unknown>): string | null {
  const dx = toNumber(bag["data-dx"], 0);
  const dy = toNumber(bag["data-dy"], 0);
  const transform = dx || dy ? `transform: translate(${dx}em, ${dy}em)` : "";
  return stripDisplay([strOr(bag.style, null), transform].filter(Boolean).join("; "));
}

// pre-1.140 zoom auto-visibility hid a group with an inline display: none, which a map saved while
// zoomed out carries in the style attribute; it is layer state, not style, and must not be persisted
export function stripDisplay(style: string | null): string | null {
  const declarations = (style || "").split(";").map(declaration => declaration.trim());
  return declarations.filter(declaration => declaration && !/^display\s*:/.test(declaration)).join("; ") || null;
}

type BurgIconsPart = StylesData["burgIcons"]["groups"][string]["groups"]["icons"];
type BurgAnchorsPart = StylesData["burgIcons"]["groups"][string]["groups"]["anchors"];

// legacy wrote stored burg-group bags to the DOM verbatim with no per-key defaults; only size and icon are required by the renderer
export function burgGroupFromLegacy(legacy: unknown): BurgIconsPart {
  const bag = (legacy ?? {}) as Record<string, unknown>;
  return {
    attrs: {
      opacity: numOr(bag.opacity, null),
      fill: strOr(bag.fill, null),
      "fill-opacity": numOr(bag["fill-opacity"], null),
      stroke: strOr(bag.stroke, null),
      "stroke-opacity": numOr(bag["stroke-opacity"], null),
      "stroke-width": numOr(bag["stroke-width"], null),
      "stroke-dasharray": strOr(bag["stroke-dasharray"], null),
      "stroke-linecap": oneOf(bag["stroke-linecap"], LINECAP_VALUES),
      "stroke-linejoin": oneOf(bag["stroke-linejoin"], LINEJOIN_VALUES),
      filter: strOr(bag.filter, null)
    },
    options: {
      // pre-1.9x maps carry the group size as a bare `size` attr instead of font-size
      size: toNumber(bag["font-size"], toNumber(bag.size, 1)),
      icon: burgIconId(strOr(bag["data-icon"], null)) ?? "#burgs-atlas-circle"
    }
  };
}

// anchors ignored data-icon before ports became stylable, so older records carry no icon or the burg default
export function anchorGroupFromLegacy(legacy: unknown): BurgAnchorsPart {
  const group = burgGroupFromLegacy(legacy);
  if (group.options.icon === "#burgs-atlas-circle") group.options.icon = "#ports-anchor";
  return group as BurgAnchorsPart;
}

/** Symbol ids were `#icon-<name>` for burgs and ports alike before v1.154 derived them from the set directories:
 * the plain glyphs are the `atlas` style, `watabou-*` and `illustrated-*` already carried their style */
export function burgIconId(id: string | null): string | null {
  const legacy = id?.match(/^#icon-(.+)$/)?.[1];
  if (!legacy) return id;
  if (legacy === "anchor" || legacy === "harbor") return `#ports-${legacy}`;
  if (legacy.startsWith("watabou-") || legacy.startsWith("illustrated-")) return `#burgs-${legacy}`;
  return `#burgs-atlas-${legacy}`;
}

function routeGroupFromLegacy(legacy: object): StylesData["routes"]["groups"][string] {
  const bag = legacy as Record<string, unknown>;
  return {
    attrs: {
      opacity: numOr(bag.opacity, null),
      stroke: strOr(bag.stroke, null),
      "stroke-opacity": numOr(bag["stroke-opacity"], null),
      "stroke-width": numOr(bag["stroke-width"], null),
      "stroke-dasharray": strOr(bag["stroke-dasharray"], null),
      "stroke-linecap": oneOf(bag["stroke-linecap"], LINECAP_VALUES),
      "stroke-linejoin": oneOf(bag["stroke-linejoin"], LINEJOIN_VALUES),
      filter: strOr(bag.filter, null),
      mask: oneOf(bag.mask, ["url(#land)", "url(#water)"])
    }
  };
}

type LakeGroupStyle = StylesData["lakes"]["groups"][string];

// a custom lake group: the template's attrs under whatever the legacy bag carries
function lakeGroupFromLegacy(legacy: object, template: LakeGroupStyle = Styles.defaults.lakes.groups.freshwater) {
  const group = structuredClone(template) as LakeGroupStyle;
  const attrs = group.attrs as Record<string, unknown>;
  for (const [key, value] of Object.entries(legacy)) if (key in attrs) attrs[key] = coerceLegacyAttr(key, value);
  return group;
}

/** A custom lake group that lived only in the svg: its element attrs over the template (freshwater by default) */
export function lakeGroupFromSvg(el: Element, template?: LakeGroupStyle): LakeGroupStyle {
  const attrs = Object.keys((template ?? Styles.defaults.lakes.groups.freshwater).attrs);
  return lakeGroupFromLegacy(harvestBag(el, attrs, []), template); // no nullables: an attr never carried keeps the template's
}

// the attrs at a store path that accept null, i.e. may be harvested as "attribute not set"
function nullableAttrsAt(path: string[]): string[] {
  let node: unknown = stylesSchema;
  for (const key of [...path, "attrs"]) node = asZodObject(node)?.shape?.[key];
  const shape = asZodObject(node)?.shape;
  if (!shape) return [];
  return Object.keys(shape).filter(attr => shape[attr].safeParse(null).success);
}

const asZodObject = (value: unknown): { shape?: Record<string, z.ZodType> } | undefined =>
  typeof value === "object" && value !== null ? (value as { shape?: Record<string, z.ZodType> }) : undefined;

function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function numOr(value: unknown, fallback: number | null): number | null {
  return value === undefined ? fallback : value === null ? null : toNumber(value, 0);
}

function strOr(value: unknown, fallback: string | null): string | null {
  return value === undefined || value === "" ? fallback : value === null ? null : String(value);
}

type Linecap = keyof typeof LINECAPS;
type Linejoin = keyof typeof LINEJOINS;
type FontStyle = keyof typeof FONT_STYLES;

const LINECAP_VALUES = Object.keys(LINECAPS) as Linecap[];
const LINEJOIN_VALUES = Object.keys(LINEJOINS) as Linejoin[];
const FONT_STYLE_VALUES = Object.keys(FONT_STYLES) as FontStyle[];

// a legacy value outside the fixed list ("inherit", a stray weight) means "not set"
function oneOf<T extends string | number>(value: unknown, allowed: readonly T[]): T | null {
  return allowed.includes(value as T) ? (value as T) : null;
}

function coerce(v: unknown): unknown {
  return v === "null" ? null : v;
}

// a bare number for a string attr keeps its value as a string; a font size gets its unit in normalizeStyles
function coerceLegacyAttr(key: string, value: unknown): unknown {
  return ["stroke-dasharray", "font-size"].includes(key) && typeof value === "number" ? String(value) : coerce(value);
}
