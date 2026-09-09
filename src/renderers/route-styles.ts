/**
 * Single source of truth for the route line hierarchy: per-type and per-group defaults for the
 * road network's line character. Values are SCREEN pixels — route paths carry
 * `vector-effect: non-scaling-stroke` (see public/index.css), so stroke width and dash pattern are
 * evaluated in screen space and never balloon as you zoom in.
 *
 * These are DEFAULTS. A style preset may override any of them per type/group; this module is the
 * fallback so a stripped or custom preset still renders the hierarchy instead of one flat dash.
 * Colour and opacity are intentionally NOT set here — presets own those.
 *
 * `stroke-dasharray: null` means a solid line (the attribute is removed).
 */
export interface RouteLineStyle {
  "stroke-width": number;
  "stroke-dasharray": string | null;
  "stroke-linecap": string;
}

const solid = (width: number): RouteLineStyle => ({
  "stroke-width": width,
  "stroke-dasharray": null,
  "stroke-linecap": "butt"
});
const dashed = (width: number, dash: string): RouteLineStyle => ({
  "stroke-width": width,
  "stroke-dasharray": dash,
  "stroke-linecap": "butt"
});
const dotted = (width: number, dash: string): RouteLineStyle => ({
  "stroke-width": width,
  "stroke-dasharray": dash,
  "stroke-linecap": "round"
});

/**
 * Route types, most-important first. Overland: solid trunk roads → dashed secondary → dotted
 * paths. The sea-trade tiers keep the searoutes dash and differ only in weight, so a long-haul
 * feeder reads as the heavier lane without ever looking like a road.
 */
export const ROUTE_TYPE_DEFAULTS: Record<string, RouteLineStyle> = {
  royal: solid(2.0),
  main: solid(1.4),
  market: dashed(1.1, "6 4"),
  town: dashed(0.9, "4 3"),
  trail: dotted(0.6, "0.5 3"),
  footpath: dotted(0.5, "0.5 2"),
  feeder: dotted(1.0, "1 4"),
  coastal: dotted(0.7, "1 4")
};

/** Route groups: overland catch-alls (for routes with no type) plus the special sea/air/trade lanes. */
export const ROUTE_GROUP_DEFAULTS: Record<string, RouteLineStyle> = {
  roads: solid(1.4),
  trails: dotted(0.6, "0.5 3"),
  searoutes: dotted(0.8, "1 4"),
  airroutes: dotted(0.9, "6 4"),
  traderoutes: dashed(1.3, "6 2 1 2")
};

export function routeTypeStyle(type: string): RouteLineStyle | undefined {
  return ROUTE_TYPE_DEFAULTS[type];
}
export function routeGroupStyle(group: string): RouteLineStyle | undefined {
  return ROUTE_GROUP_DEFAULTS[group];
}

/**
 * Apply a route line style to an element: the default hierarchy for this type/group, with any
 * preset attributes layered on top (preset wins). A `null` value removes the attribute (solid line
 * / cleared stale dash). `presetStyle` is the preset's own attribute map for this type/group, or
 * undefined when the preset defines nothing.
 */
export function applyRouteLineStyle(
  el: Element,
  fallback: RouteLineStyle | undefined,
  presetStyle: Record<string, unknown> | undefined
): void {
  const merged: Record<string, unknown> = { ...(fallback || {}), ...(presetStyle || {}) };
  for (const attr in merged) {
    const value = merged[attr];
    if (value === null || value === "null" || value === undefined) el.removeAttribute(attr);
    else el.setAttribute(attr, String(value));
  }
}

/**
 * Read the attributes a caller cares about off an element, skipping absent ones. Used to treat a
 * route group's preset-set attributes as the winning `presetStyle` in applyRouteLineStyle, so the
 * default hierarchy only fills attributes the preset did not set (rather than clobbering them).
 */
export function readPresetAttrs(el: Element, attrs: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of attrs) if (el.hasAttribute(a)) out[a] = el.getAttribute(a)!;
  return out;
}

// public/modules/ui/layers.js is a classic script and can only reach TS through globals.
if (typeof window !== "undefined") {
  Object.assign(window, { routeTypeStyle, routeGroupStyle, applyRouteLineStyle, readPresetAttrs });
}
