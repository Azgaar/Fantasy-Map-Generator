// Conversions between the legacy `style` object shapes and the styles store
import "./styles";
import { Layers } from "@/components/layers";
import { safeParseJSON } from "@/utils";
import type { Styles } from "./styles-schema";
import { stylesSchema } from "./styles-schema";

// selector -> store path, plus the legacy-key -> option-name renames for that node.
type PresetRoute = {
  path: string[];
  options?: Record<string, string>;
  bools?: string[];
  strings?: string[]; // options that must stay strings
  kind?: "label" | "burg" | "route";
  drop?: string[];
  ownAttrs?: boolean;
};

const SELECTOR_ALIASES: Record<string, string> = {
  "#terrs #landHeights": "#terrs > #landHeights",
  "#terrs #oceanHeights": "#terrs > #oceanHeights"
};

const PRESET_ROUTES: Record<string, PresetRoute> = {
  "#map": { path: ["map"], options: { "data-filter": "dataFilter" }, drop: ["background-color"] },
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
  "#provs": { path: ["provinces"], drop: ["data-size"] },
  "#zones": { path: ["zones"] },
  "#stateBorders": { path: ["borders", "stateBorders"] },
  "#provinceBorders": { path: ["borders", "provinceBorders"] },
  "#roads": { path: ["routes", "groups", "roads"] },
  "#trails": { path: ["routes", "groups", "trails"] },
  "#searoutes": { path: ["routes", "groups", "searoutes"] },
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
const LABEL_SCHEMA_ATTRS = Object.keys(Object.values(Styles.defaults.labels.groups)[0].attrs);
const BURG_SCHEMA_ATTRS = Object.keys(Object.values(Styles.defaults.burgIcons.burgIcons.groups)[0].attrs);

// The v1.150.0 style migration auto-update
export async function migrateStyles(legacyStyleString: string | undefined): Promise<string> {
  const legacyStyleObj = legacyStyleString ? safeParseJSON(legacyStyleString) : undefined;
  if (legacyStyleObj) migrateLegacyStyleObj(legacyStyleObj); // updates pre-v1.150 style object

  harvestStylesFromSvg({ hasStyleRecord: Boolean(legacyStyleObj) });

  stripMigratedAttributes();
  return JSON.stringify(styles);
}

function migrateLegacyStyleObj(obj: unknown): void {
  const legacy = (typeof obj === "object" ? obj : {}) as Record<string, any>;
  if (legacy.labels?.groups)
    styles.labels.groups = Object.fromEntries(
      Object.entries(legacy.labels.groups).map(([name, group]) => [name, labelGroupFromLegacy(group)])
    );

  if (legacy.burgIcons)
    styles.burgIcons.burgIcons.groups = Object.fromEntries(
      Object.entries(legacy.burgIcons).map(([name, group]) => [name, burgGroupFromLegacy(group)])
    );

  if (legacy.anchors)
    styles.burgIcons.anchors.groups = Object.fromEntries(
      Object.entries(legacy.anchors).map(([name, group]) => [name, burgGroupFromLegacy(group)])
    );

  if (legacy.relief)
    styles.relief.options = {
      set: strOr(legacy.relief.set, null) ?? "simple",
      size: toNumber(legacy.relief.size, 1),
      density: toNumber(legacy.relief.density, 0.4)
    };
}

export function stylesFromMap(root: ParentNode = document): Styles {
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
  if (hasStyleRecord) harvested.burgIcons = structuredClone(styles.burgIcons);
  harvested.relief.options = structuredClone(styles.relief.options);
  // post-migration maps carry no rescale/data-width attrs, so the store owns these
  // options; a loaded old map's attrs win here until the load-time strip removes them
  if (!document.getElementById("markers")?.hasAttribute("rescale"))
    harvested.markers.options = structuredClone(styles.markers.options);

  // the pre-v1.150 style editor wrote to the layer group itself whenever the layer had no groups
  const strandedOpacity: Record<(typeof STRANDED_OPACITY_LAYERS)[number], { attrs: { opacity: number | null } }[]> = {
    regions: [harvested.states.statesBody],
    terrs: Object.values(harvested.heightmap),
    lakes: Object.values(harvested.lakes),
    coastline: Object.values(harvested.coastline),
    borders: Object.values(harvested.borders),
    routes: Object.values(harvested.routes.groups),
    labels: Object.values(harvested.labels.groups),
    burgIcons: Object.values(harvested.burgIcons.burgIcons.groups),
    anchors: Object.values(harvested.burgIcons.anchors.groups)
  };
  for (const [layer, groups] of Object.entries(strandedOpacity)) {
    const opacity = document.getElementById(layer)?.getAttribute("opacity");
    if (opacity === null || opacity === undefined) continue;
    for (const group of groups) group.attrs.opacity = Number(opacity) || null;
  }

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
          : element === "routes"
            ? `#routes > g#${group}`
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
  const routeGroup = selector.match(/^#routes > g#(.+)$/);
  if (routeGroup) return { path: ["routes", "groups", routeGroup[1]], kind: "route" };
  const emblem = selector.match(/^#emblems > #(.+)$/);
  if (emblem) return { path: ["emblems", emblem[1]], options: { "data-size": "size" } };
  return undefined;
}

function fail(onUnknown: "throw" | "skip", message: string): void {
  if (onUnknown === "skip") console.warn(message);
  else throw new Error(message);
}

// overlays a legacy bag onto a node already seeded with its Styles.defaults value: an absent
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
    table[selector] = [...new Set([...attrs, ...Object.keys(route.options ?? {}), ...(route.drop ?? [])])];
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
    const inline = (el as HTMLElement).style?.[attr as any];
    const value = inline ? inline : el.getAttribute(attr);
    if (value !== null && value !== undefined) bag[attr] = harvestValue(value);
    else if (nullableAttrs.includes(attr)) bag[attr] = null;
  }
  return bag;
}

/** A legacy '#'-keyed preset carries the attr bag directly; a store-format preset (every system
 * preset since v1.150) resolves through the same selector route table the preset upgrader uses */
export function presetBagFor(
  preset: Record<string, any>,
  ...selectors: string[]
): Record<string, string | number | null> | undefined {
  for (const selector of selectors) {
    if (!isStoreStyles(preset)) {
      if (preset[selector]) return preset[selector];
      continue;
    }
    const route = routeFor(selector);
    const node = route && (getPath(preset, route.path) as { attrs?: Record<string, string | number | null> });
    if (node?.attrs) return node.attrs;
  }
  return undefined;
}

// v1.145-1.147 saved maps with the layer styling stripped out. Seed the groups that carry none
// at all from the preset the user has applied, so the harvest in migrateStyles reads real styling
// instead of recording bare groups; the caller gates this to the affected version range, because
// in older maps a bare group is normal and would wrongly take on the preset's attrs
export async function restoreStrippedLayerStyles(): Promise<void> {
  const [, preset] = await (window as any).getStylePreset(localStorage.getItem("presetStyle") || "default");

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
  strip("markers", "rescale");
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
  const built = structuredClone(Styles.defaults) as any;

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
      const fromLegacy =
        route.kind === "label"
          ? labelGroupFromLegacy
          : route.kind === "burg"
            ? burgGroupFromLegacy
            : routeGroupFromLegacy;
      parent[route.path.at(-1) as string] = fromLegacy(bag);
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

export function labelGroupFromLegacy(legacy: unknown): Styles["labels"]["groups"][string] {
  const bag = legacy as Record<string, unknown>;
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
      "font-size": strOr(bag["data-size"], null) ?? strOr(bag["font-size"], "18%") ?? "18%",
      "font-family": strOr(bag["font-family"], "Almendra SC") ?? "Almendra SC",
      style: labelStyleFromLegacy(bag),
      filter: strOr(bag.filter, null)
    }
  };
}

function labelStyleFromLegacy(bag: Record<string, unknown>): string | null {
  const style = strOr(bag.style, null);
  const dx = toNumber(bag["data-dx"], 0);
  const dy = toNumber(bag["data-dy"], 0);
  const declarations = style?.trim().replace(/;+$/, "") || "";
  const transform = dx || dy ? `transform: translate(${dx}em, ${dy}em)` : "";
  const cssText = [declarations, transform].filter(Boolean).join("; ");
  return cssText ?? null;
}

// legacy wrote stored burg-group bags to the DOM verbatim with no per-key defaults; only
// size and icon are required by the renderer (anchors ignore icon - they always draw #icon-anchor)
export function burgGroupFromLegacy(legacy: unknown): Styles["burgIcons"]["burgIcons"]["groups"][string] {
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

function routeGroupFromLegacy(legacy: object): Styles["routes"]["groups"][string] {
  const bag = legacy as Record<string, unknown>;
  return {
    attrs: {
      opacity: numOr(bag.opacity, null),
      stroke: strOr(bag.stroke, null),
      "stroke-width": numOr(bag["stroke-width"], null),
      "stroke-dasharray": strOr(bag["stroke-dasharray"], null),
      "stroke-linecap": strOr(bag["stroke-linecap"], null),
      filter: strOr(bag.filter, null),
      mask: strOr(bag.mask, null)
    }
  };
}

// the attrs at a store path that accept null, i.e. may be harvested as "attribute not set"
function nullableAttrsAt(path: string[]): string[] {
  let node: any = stylesSchema;
  for (const key of [...path, "attrs"]) node = node?.shape?.[key];
  const shape = node?.shape;
  if (!shape) return [];
  return Object.keys(shape).filter(attr => shape[attr].safeParse(null).success);
}

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

function getPath(obj: any, path: string[]): any {
  return path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function coerce(v: unknown): unknown {
  return v === "null" ? null : v;
}

function coerceLegacyAttr(key: string, value: unknown): unknown {
  return key === "stroke-dasharray" && typeof value === "number" ? String(value) : coerce(value);
}

// the legacy preset pipeline (public/modules/ui/style-presets.js) converts through these
globalThis.stylesLegacy = {
  styleNodeFor,
  presetBagFor,
  labelGroupFromLegacy,
  burgGroupFromLegacy,
  presetFromLegacy,
  isLegacyPreset,
  isStoreStyles,
  harvestAttributes,
  stylesFromMap,
  harvestStylesFromSvg,
  migrateStyles,
  restoreStrippedLayerStyles,
  stripMigratedAttributes
};
