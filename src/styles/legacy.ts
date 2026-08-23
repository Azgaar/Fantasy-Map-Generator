// Conversions between the legacy `style` object shapes and the styles store. Only migration
// edges use this: map-file save/load and legacy preset routing. Dies when those write the new
// format natively.
import { DEFAULT_STYLES } from "./defaults";
import { parseStyles, type Styles, styles } from "./styles";

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
      "font-size": strOr(bag["font-size"], "18%") ?? "18%",
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

export function labelGroupsToLegacy(groups: Record<string, LabelGroupStyle>): Record<string, object> {
  return Object.fromEntries(Object.entries(groups).map(([name, group]) => [name, labelGroupToLegacy(group)]));
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

export function burgGroupsToLegacy(groups: Record<string, BurgGroupStyle>, withIcon: boolean): Record<string, object> {
  return Object.fromEntries(Object.entries(groups).map(([name, group]) => [name, burgGroupToLegacy(group, withIcon)]));
}

export function reliefFromLegacy(legacy: object): Styles["relief"]["options"] {
  const bag = legacy as Record<string, unknown>;
  return {
    set: strOr(bag.set, null) ?? "simple",
    size: toNumber(bag.size, 1),
    density: toNumber(bag.density, 0.4)
  };
}

// the map file's style record keeps the legacy shape until persistence migrates, so files
// stay loadable on master in both directions
export function stylesToLegacy(): Record<string, unknown> {
  return {
    labels: { groups: labelGroupsToLegacy(styles.labels.groups) },
    burgIcons: burgGroupsToLegacy(styles.burgIcons.burgIcons.groups, true),
    anchors: burgGroupsToLegacy(styles.burgIcons.anchors.groups, false),
    relief: { ...styles.relief.options }
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
      curve: "curve",
      "data-render": "render"
    },
    bools: ["render"]
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
  // data-size was never written by collectStyleData (public/modules/ui/style-presets.js:291);
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
    options: { x: "x", y: "y", width: "width", height: "height", rx: "rx", ry: "ry", filter: "filter" }
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

  if (node.attrs) {
    for (const key of Object.keys(rest)) {
      if (key in node.attrs) {
        node.attrs[key] = coerce(rest[key]);
        delete rest[key];
      }
    }
  }

  for (const key of Object.keys(rest)) fail(onUnknown, `unknown legacy attribute "${key}" on "${selector}"`);
}

export function isLegacyPreset(json: object): boolean {
  return Object.keys(json).some(key => key.startsWith("#"));
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

  return parseStyles(built);
}

// bag[legacyKey] = node.options[optionKey], the inverse of applyPresetBag's option overlay;
// bools re-spell as 0/1 (matching every other bool-attribute writer in this codebase, not "true"/"false")
function bagFromNode(node: any, route: PresetRoute): Record<string, string | number | null> {
  const bag: Record<string, string | number | null> = { ...(node.attrs ?? {}) };
  for (const [legacyKey, optionKey] of Object.entries(route.options ?? {})) {
    const value = node.options?.[optionKey];
    bag[legacyKey] = route.bools?.includes(optionKey) ? Number(value) : value;
  }
  return bag;
}

// the inverse of presetFromLegacy: store shape -> legacy selector-keyed bags, reusing
// PRESET_ROUTES/routeFor as the single source of truth for selectors and option renames
export function presetToLegacy(styles: Styles): Record<string, Record<string, string | number | null>> {
  const legacy: Record<string, Record<string, string | number | null>> = {};

  for (const [selector, route] of Object.entries(PRESET_ROUTES)) {
    const node = getPath(styles, route.path);
    if (node) legacy[selector] = bagFromNode(node, route);
  }

  for (const [name, group] of Object.entries(styles.labels.groups)) {
    legacy[`#labels > #${name}`] = labelGroupToLegacy(group) as Record<string, string | number | null>;
  }
  for (const [name, group] of Object.entries(styles.burgIcons.burgIcons.groups)) {
    legacy[`#burgIcons > g#${name}`] = burgGroupToLegacy(group, true) as Record<string, string | number | null>;
  }
  for (const [name, group] of Object.entries(styles.burgIcons.anchors.groups)) {
    legacy[`#anchors > g#${name}`] = burgGroupToLegacy(group, false) as Record<string, string | number | null>;
  }
  for (const name of ["stateEmblems", "provinceEmblems", "burgEmblems"] as const) {
    const selector = `#emblems > #${name}`;
    const route = routeFor(selector) as PresetRoute;
    legacy[selector] = bagFromNode(getPath(styles, route.path), route);
  }

  return legacy;
}

// the legacy preset pipeline (public/modules/ui/style-presets.js) converts through these
globalThis.stylesLegacy = {
  labelGroupFromLegacy,
  labelGroupToLegacy,
  labelGroupsFromLegacy,
  labelGroupsToLegacy,
  burgGroupFromLegacy,
  burgGroupFromElement,
  burgGroupToLegacy,
  burgGroupsFromLegacy,
  burgGroupsToLegacy,
  reliefFromLegacy,
  stylesToLegacy,
  stylesFromLegacy,
  presetFromLegacy,
  presetToLegacy,
  isLegacyPreset
};
